"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RequiredMark } from "@/components/Marks";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBudget } from "@/lib/budget";
import { db } from "@/lib/db";
import { addSuggestions, suggest, type Suggestion } from "@/lib/engine";
import { budgetLabel } from "@/lib/labels";
import { projectBrief } from "@/lib/brief";
import { matchChips } from "@/lib/chips";
import { currentRead } from "@/lib/readClient";
import { addReadPicks, clearUnshot, readPicks, type ReadPick } from "@/lib/readShots";
import type { Project } from "@/lib/types";
import { saveProject } from "@/lib/useProject";
import { inWords } from "@/lib/words";
import styles from "./Suggest.module.css";

/**
 * B2 after an online read, and B10 when a list already exists (§5.6):
 * required shots under their client, then the read's shots, then the
 * template library, collapsed. Nothing lands until it's added; replacing is
 * never the default and says exactly what it clears.
 */
export function ReadList({ project }: { project: Project }) {
  const router = useRouter();
  const read = currentRead(project)!;
  const list = `/project?id=${project.id}`;

  // Worked out once, so adding one doesn't reshuffle the rest.
  const [start] = useState(() => project);
  const { required, shots } = useMemo(() => readPicks(start, read), [start, read]);
  // A read that comes back short of the budget's minimum is filled from the library,
  // matched to the brief, so the list is never half of what the cut needs (Rina, 23 Sep).
  const [fill] = useState(() => {
    const offered = required.reduce((n, r) => n + r.picks.filter((p) => !p.alreadyOn).length, 0) + shots.length;
    const planned = start.shots.filter((s) => s.status !== "dropped").length;
    return Math.max(0, projectBudget(start).min - planned - offered);
  });
  const [library] = useState(() => {
    const text = projectBrief(start)?.text ?? "";
    return suggest(start, { brief: text, chips: matchChips(text), coverage: false, limit: Math.max(12, fill) }).suggestions;
  });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showLibrary, setShowLibrary] = useState(fill > 0);

  const live = start.shots.filter((s) => s.status !== "dropped");
  const exposed = live.filter((s) => s.status === "exposed").length;
  const existing = live.length > 0; // B10: there's a list already
  const allPicks = [...required.flatMap((r) => r.picks.filter((p) => !p.alreadyOn)), ...shots];
  const pendingRead = allPicks.filter((p) => !added.has(p.id));
  const fillPicks = library.slice(0, fill);
  const pendingFill = fillPicks.filter((s) => !added.has(s.templateId));
  const pendingCount = pendingRead.length + pendingFill.length;
  const offeredCount = allPicks.length + fillPicks.length;
  const b = projectBudget(project);
  const planned = project.shots.filter((s) => s.status !== "dropped").length;
  const locationName = new Map(project.locations.map((l) => [l.id, l.name]));
  const dayIndex = (id?: string) => project.days.find((d) => d.id === id)?.index;

  const addPicks = async (picks: ReadPick[]) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(addReadPicks(latest, picks));
    setAdded((a) => new Set([...a, ...picks.map((p) => p.id)]));
  };
  const addLibrary = async (picks: Suggestion[]) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(addSuggestions(latest, picks, "template"));
    setAdded((a) => new Set([...a, ...picks.map((p) => p.templateId)]));
  };

  const where = (locationId?: string, dayId?: string, newLocation?: string) =>
    `${project.days.length > 1 && dayId ? `DAY ${dayIndex(dayId)} · ` : ""}${
      newLocation ? `${newLocation.toUpperCase()} · NEW` : locationId ? (locationName.get(locationId) ?? "").toUpperCase() : "UNPLACED"
    }`;
  // Locations the read suggested because there were none (design.md §10, 23).
  const suggested = [...new Set(allPicks.map((p) => p.newLocation).filter((n): n is string => !!n))];

  const row = (key: string, size: string, subject: string, reason: string, meta: string, onAdd: () => void, mark?: React.ReactNode, note?: string) => {
    const done = added.has(key);
    return (
      <li key={key} className={styles.row}>
        <span className={styles.size}>{mark ?? size}</span>
        <span className={styles.stack}>
          <span className={done ? styles.subjectDone : styles.subject}>
            {mark ? `${size} · ` : ""}
            {subject}
          </span>
          <span className={styles.reason}>{reason}</span>
          <span className={styles.meta}>{meta}</span>
        </span>
        {note ? (
          <span className={styles.added}>{note}</span>
        ) : done ? (
          <span className={styles.added}>ADDED</span>
        ) : (
          <button type="button" className={styles.plus} aria-label={`Add ${subject}`} onClick={onAdd}>
            +
          </button>
        )}
      </li>
    );
  };

  return (
    <div className={ui.screen}>
      <StepHeader label={existing ? "Read again" : `From your brief · ${allPicks.length}`} back={{ label: "← WHAT IT READ", href: `/brief/read?id=${project.id}` }} />

      <div className={ui.flush}>
        {existing && (
          <div className={styles.changed}>
            <p className={styles.changedLead}>There&apos;s already a list — nothing has happened to it yet. Add what&apos;s new, or replace what you haven&apos;t shot.</p>
            <p className={styles.changedCount}>
              ON THE LIST NOW · {live.length} {live.length === 1 ? "SHOT" : "SHOTS"}
              {exposed ? ` · ${exposed} EXPOSED` : ""}
            </p>
          </div>
        )}

        {suggested.length > 0 && (
          <p className={styles.note}>
            No locations yet, so it suggests {suggested.length === 1 ? "one" : inWords(suggested.length)}: {suggested.join(", ")}. Adding a shot creates its
            location — rename them, or move shots between them, from the list.
          </p>
        )}

        {required.map((r) => (
          <section key={r.client} aria-label={`Required — ${r.client}`}>
            <h2 className={`${styles.band} ${styles.requiredBand}`}>
              <span>REQUIRED — {r.client.toUpperCase()}</span>
              <span>{String(r.picks.length).padStart(2, "0")}</span>
            </h2>
            <ul className={styles.rows}>
              {r.picks.map((p) =>
                row(p.id, p.shot.size, p.shot.subject, p.shot.reason, where(p.locationId, p.dayId, p.newLocation), () => addPicks([p]), <RequiredMark label={`Required for ${r.client}`} />, p.alreadyOn ? "ALREADY ON" : undefined),
              )}
            </ul>
          </section>
        ))}

        {shots.length > 0 && (
          <section aria-labelledby="read-shots">
            <h2 id="read-shots" className={styles.band}>
              <span>FROM YOUR BRIEF</span>
              <span>{String(shots.length).padStart(2, "0")}</span>
            </h2>
            <ul className={styles.rows}>{shots.map((p) => row(p.id, p.shot.size, p.shot.subject, p.shot.reason, where(p.locationId, p.dayId, p.newLocation), () => addPicks([p])))}</ul>
          </section>
        )}

        {allPicks.length === 0 && <p className={styles.note}>Everything this read suggested is already on your list.</p>}

        {library.length > 0 &&
          (showLibrary ? (
            <section aria-labelledby="library">
              <h2 id="library" className={styles.band}>
                <span>{fill > 0 ? "TO REACH THE BUDGET" : "ALSO FROM THE LIBRARY"}</span>
                <span>{String(library.length).padStart(2, "0")}</span>
              </h2>
              {fill > 0 && (
                <p className={styles.note}>
                  The read gave {allPicks.length}; a cut this length needs at least {b.min}. The first {fill} below, matched to your brief, are added with the rest.
                </p>
              )}
              <ul className={styles.rows}>
                {library.map((s) => row(s.templateId, s.size, s.subject, s.reason, where(s.locationId, s.dayId), () => addLibrary([s])))}
              </ul>
            </section>
          ) : (
            <button type="button" className={styles.more} onClick={() => setShowLibrary(true)}>
              + {library.length} MORE FROM THE LIBRARY
            </button>
          ))}
      </div>

      <div className={ui.footer}>
        {existing && pendingCount > 0 && (
          <div className={styles.careful}>
            <span className={ui.boxHeadingWarn}>CAREFUL</span>
            <p className={ui.boxText}>
              Replacing clears the {live.length - exposed} you haven&apos;t shot{exposed ? ` and keeps the ${exposed} you have` : ""}. Adding leaves every one of them where it is.
            </p>
          </div>
        )}
        {!existing && pendingCount > 0 && (
          <p className={ui.hint}>
            Adding {pendingCount === offeredCount ? "all" : "the rest"} puts the list at {planned + pendingCount}, against a budget of {budgetLabel(b).replace(" — ", "—")}.
          </p>
        )}
        {pendingCount > 0 ? (
          <>
            <button
              type="button"
              className={ui.primary}
              onClick={async () => {
                await addPicks(pendingRead);
                if (pendingFill.length) await addLibrary(pendingFill);
                router.replace(list);
              }}
            >
              {existing ? `ADD ${pendingCount} NEW` : pendingCount === offeredCount ? `ADD ALL ${pendingCount}` : `ADD THE OTHER ${pendingCount}`}
            </button>
            {existing && (
              <button
                type="button"
                className={ui.secondary}
                onClick={async () => {
                  const latest = (await db.projects.get(project.id)) ?? project;
                  await saveProject(addSuggestions(addReadPicks(clearUnshot(latest), pendingRead), pendingFill, "template"));
                  router.replace(list);
                }}
              >
                REPLACE — KEEP WHAT&apos;S SHOT
              </button>
            )}
          </>
        ) : (
          <button type="button" className={ui.primary} onClick={() => router.replace(list)}>
            DONE
          </button>
        )}
      </div>
    </div>
  );
}
