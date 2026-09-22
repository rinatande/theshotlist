"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief } from "@/lib/brief";
import { db } from "@/lib/db";
import { projectBudget } from "@/lib/budget";
import { addSuggestions, suggest, type Suggestion } from "@/lib/engine";
import { budgetLabel } from "@/lib/labels";
import type { Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import { capitalise, inWords } from "@/lib/words";
import styles from "./Suggest.module.css";

/** Shown before "+ N MORE" — enough to judge the list without scrolling a wall. */
const FIRST = 6;

/**
 * B2 Shots from your brief (or, from E5's route 02, from your format). Each
 * suggestion carries its reason line (§6.2 step 5); nothing lands on the
 * list until it's added.
 */
function Suggestions() {
  const { project, params } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  return <List key={project.id} project={project} fromBrief={params.get("from") === "brief"} />;
}

function List({ project, fromBrief }: { project: Project; fromBrief: boolean }) {
  const router = useRouter();
  const brief = fromBrief ? projectBrief(project) : undefined;
  const chips = brief?.extraction?.quoted ?? [];

  // Worked out once when the screen opens, so adding one doesn't reshuffle the rest.
  const [result] = useState(() => suggest(project, { brief: brief?.text, chips }));
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const pending = result.suggestions.filter((s) => !added.has(s.templateId));
  const b = projectBudget(project);
  const planned = project.shots.filter((s) => s.status !== "dropped").length;
  const locationName = useMemo(() => new Map(project.locations.map((l) => [l.id, l.name])), [project.locations]);
  const dayIndex = (id?: string) => project.days.find((d) => d.id === id)?.index;
  const source = fromBrief ? "brief" : "template";
  const list = `/project?id=${project.id}`;

  const add = async (picks: Suggestion[]) => {
    // Re-read first, so two quick taps never overwrite each other.
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(addSuggestions(latest, picks, source));
    setAdded((a) => new Set([...a, ...picks.map((p) => p.templateId)]));
  };

  const heading = chips.length ? `SUGGESTED — ${chips.slice(0, 3).map((c) => c.label).join(", ")}` : "SUGGESTED";
  // Coverage built from the brief's own actions, shown whole; templates collapse after a few.
  const own = result.suggestions.filter((s) => s.fromBrief);
  const others = result.suggestions.filter((s) => !s.fromBrief);
  const shown = expanded ? others : others.slice(0, FIRST);
  const short = result.suggestions.length < result.room;

  const row = (s: Suggestion) => {
    const done = added.has(s.templateId);
    const where = s.locationId ? locationName.get(s.locationId)?.toUpperCase() : "UNPLACED";
    const day = project.days.length > 1 ? `DAY ${dayIndex(s.dayId)} · ` : "";
    return (
      <li key={s.templateId} className={styles.row}>
        <span className={styles.size}>{s.size}</span>
        <span className={styles.stack}>
          <span className={done ? styles.subjectDone : styles.subject}>{s.subject}</span>
          <span className={styles.reason}>{s.reason}</span>
          <span className={styles.meta}>
            {day}
            {where}
          </span>
        </span>
        {done ? (
          <span className={styles.added}>ADDED</span>
        ) : (
          <button type="button" className={styles.plus} aria-label={`Add ${s.subject}`} onClick={() => add([s])}>
            +
          </button>
        )}
      </li>
    );
  };

  return (
    <div className={ui.screen}>
      <StepHeader
        label={`${fromBrief ? "From your brief" : "From your format"} · ${result.suggestions.length}`}
        back={{ label: fromBrief ? "← BRIEF" : "← SHOT LIST", href: fromBrief ? `/brief/read?id=${project.id}` : list }}
      />

      <div className={ui.flush}>
        {result.suggestions.length === 0 ? (
          <p className={styles.note}>
            {result.room === 0
              ? `The list is already at the top of its ${budgetLabel(b)} budget — there's no room to suggest more.`
              : "Nothing new fits this format right now. More appear as templates are written, or when gear arrives."}
          </p>
        ) : (
          <>
            {own.length > 0 && (
              <section aria-labelledby="own">
                <h2 id="own" className={styles.band}>
                  <span>FROM YOUR BRIEF</span>
                  <span>{String(own.length).padStart(2, "0")}</span>
                </h2>
                <ul className={styles.rows}>{own.map(row)}</ul>
              </section>
            )}
            {others.length > 0 && (
              <section aria-labelledby="others">
                <h2 id="others" className={styles.band}>
                  <span>{own.length ? "ALSO WORTH GETTING" : heading}</span>
                  <span>{String(others.length).padStart(2, "0")}</span>
                </h2>
                <ul className={styles.rows}>{shown.map(row)}</ul>
                {!expanded && others.length > FIRST && (
                  <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
                    + {others.length - FIRST} MORE
                  </button>
                )}
              </section>
            )}
          </>
        )}

        {short && result.suggestions.length > 0 && (
          <p className={styles.note}>
            {capitalise(inWords(result.suggestions.length))} {result.suggestions.length === 1 ? "shot fits" : "shots fit"} this format, and the budget has room for{" "}
            {result.room}. More appear as templates are written, or when gear arrives.
          </p>
        )}
        {result.withheld > 0 && (
          <p className={styles.note}>
            {capitalise(inWords(result.withheld))} more {result.withheld === 1 ? "needs" : "need"} gear — a tripod, a mic, a longer lens. They appear once gear is in.
          </p>
        )}
      </div>

      <div className={ui.footer}>
        {pending.length > 0 && (
          <p className={ui.hint}>
            Adding {pending.length === result.suggestions.length ? "all" : "the rest"} puts the list at {planned + pending.length}, against a budget of{" "}
            {budgetLabel(b).replace(" — ", "—")}.
          </p>
        )}
        {pending.length > 0 ? (
          <button
            type="button"
            className={ui.primary}
            onClick={async () => {
              await add(pending);
              router.replace(list);
            }}
          >
            {pending.length === result.suggestions.length ? `ADD ALL ${pending.length}` : `ADD THE OTHER ${pending.length}`}
          </button>
        ) : (
          <button type="button" className={ui.primary} onClick={() => router.replace(list)}>
            DONE
          </button>
        )}
      </div>
    </div>
  );
}

export default function SuggestPage() {
  return (
    <Suspense>
      <Suggestions />
    </Suspense>
  );
}
