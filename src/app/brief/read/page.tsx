"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { RequiredMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief, saveRead, setDropped, setQuoted } from "@/lib/brief";
import { matchChips } from "@/lib/chips";
import { db } from "@/lib/db";
import type { ReadFailure } from "@/lib/read";
import { runRead } from "@/lib/readClient";
import type { Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "../Brief.module.css";
import read from "./Read.module.css";

type State = { phase: "reading" } | { phase: "read"; cached: boolean; remaining: number } | { phase: "local"; failure: ReadFailure };

/**
 * B9 What it read (§5.6). GENERATE lands here: with signal it reads the whole
 * brief once — or reuses the last read of the same brief, for free — and
 * shows what it took before anything is built. Offline, over a limit, or if
 * the read fails, it shows the on-phone match and says why.
 */
function WhatItRead() {
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  return <Review key={project.id} project={project} />;
}

function Review({ project }: { project: Project }) {
  const [state, setState] = useState<State>({ phase: "reading" });
  const started = useRef(false);

  // One read per visit, never two — React may run effects twice in development.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const outcome = await runRead(project);
      if (!outcome.ok) return setState({ phase: "local", failure: outcome.failure });
      if (!outcome.cached) {
        const latest = (await db.projects.get(project.id)) ?? project;
        await saveProject(saveRead(latest, { hash: outcome.hash, model: outcome.response.model, result: outcome.response.result }));
      }
      setState({ phase: "read", cached: outcome.cached, remaining: outcome.response.remaining });
    })();
  }, [project]);

  const back = { label: "← EDIT BRIEF", href: `/brief?id=${project.id}` };

  if (state.phase === "reading") {
    return (
      <div className={ui.screen}>
        <StepHeader label="What it read" back={back} />
        <div className={ui.body} aria-busy="true">
          <p className={read.lead} aria-live="polite">
            Reading your brief…
          </p>
          <p className={ui.boxTextMuted}>
            This takes about half a minute. It reads the whole thing once — not as you type — and nothing is built until you&apos;ve seen what it took.
          </p>
        </div>
      </div>
    );
  }

  const brief = projectBrief(project);
  if (state.phase === "read" && brief?.read) return <FullRead project={project} state={state} back={back} />;
  return <LocalRead project={project} failure={state.phase === "local" ? state.failure : { reason: "offline" }} back={back} />;
}

// ─── Full read (online) ───────────────────────────────────────────────────────

function FullRead({ project, state, back }: { project: Project; state: { cached: boolean; remaining: number }; back: { label: string; href: string } }) {
  const router = useRouter();
  const r = projectBrief(project)!.read!;
  const [dropped, setDroppedState] = useState<Set<string>>(new Set(r.dropped));
  const toggle = (key: string) =>
    setDroppedState((d) => {
      const next = new Set(d);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={ui.screen}>
      <StepHeader label="What it read" back={back} />

      <div className={ui.body}>
        <p className={read.lead}>
          Here&apos;s what it took from your brief. Correct anything wrong before it builds the list — a misread here becomes a wrong shot on the day.
        </p>

        {r.result.quoted.length > 0 && (
          <div className={styles.matched}>
            <span className={ui.boxHeading}>FROM YOUR WORDS</span>
            <ul className={styles.chips}>
              {r.result.quoted.map((c) => (
                <li key={c.label} className={styles.chip}>
                  {c.label.toUpperCase()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.result.inferred.length > 0 && (
          <div className={styles.matched}>
            <span className={ui.boxHeading}>READ FROM THE BRIEF · CHECK THESE</span>
            <ul className={styles.chips}>
              {r.result.inferred.map((c) => (
                <li key={c.label}>
                  <Droppable label={c.label.toUpperCase()} off={dropped.has(c.label)} filled onToggle={() => toggle(c.label)} />
                </li>
              ))}
            </ul>
            <p className={ui.hint}>These were worked out, not quoted. Tap to drop one it got wrong.</p>
          </div>
        )}

        {r.result.deliverables.map((d) => (
          <div key={d.client} className={read.deliverables}>
            <div className={read.client}>
              <span>{d.client.toUpperCase()}</span>
              <span>
                {d.shots.length} REQUIRED
              </span>
            </div>
            <ul className={read.required}>
              {d.shots.map((s) => {
                const off = dropped.has(s.subject) || dropped.has(d.client);
                return (
                  <li key={s.subject} className={read.requiredRow}>
                    <RequiredMark label={`Required for ${d.client}`} />
                    <span className={off ? read.subjectOff : read.subject}>{s.subject}</span>
                    <button
                      type="button"
                      className={read.drop}
                      aria-label={off ? `Keep ${s.subject}` : `Drop ${s.subject} — it isn't required`}
                      onClick={() => toggle(s.subject)}
                    >
                      {off ? "+" : "✕"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className={ui.box}>
          <span className={ui.boxHeading}>{state.cached ? "READ ALREADY" : "READ ONCE"}</span>
          <p className={ui.boxText}>
            {state.cached
              ? "Read earlier from this same brief, so it didn't run again — reopening this costs nothing."
              : "One request, just now. It won't run again unless you change the brief — reopening this costs nothing."}{" "}
            Sent once to be read. Not stored by this app.
          </p>
          {state.remaining >= 0 && <p className={ui.hint}>{state.remaining === 1 ? "1 full read left today." : `${state.remaining} full reads left today.`}</p>}
        </div>
      </div>

      <div className={ui.footer}>
        <button
          type="button"
          className={ui.primary}
          onClick={async () => {
            const latest = (await db.projects.get(project.id)) ?? project;
            await saveProject(setDropped(latest, [...dropped]));
            router.push(`/suggest?id=${project.id}&from=read`);
          }}
        >
          BUILD THE LIST
        </button>
      </div>
    </div>
  );
}

function Droppable({ label, off, filled, onToggle }: { label: string; off: boolean; filled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`${read.chip} ${filled ? read.filled : ""} ${off ? read.dropped : ""}`}
      aria-pressed={!off}
      aria-label={off ? `${label}, dropped. Tap to keep it.` : `${label}. Tap to drop it.`}
      onClick={onToggle}
    >
      {label}
      <span aria-hidden="true" className={read.x}>
        {off ? "+" : "✕"}
      </span>
    </button>
  );
}

// ─── On the phone (offline, over a limit, or the read failed) ────────────────

const WHY: Record<ReadFailure["reason"], string> = {
  offline: "No signal, so this is matched on the phone. Generate again with signal for the full read.",
  limit: "",
  declined: "",
  busy: "",
  error: "",
  unconfigured: "",
};

function LocalRead({ project, failure, back }: { project: Project; failure: ReadFailure; back: { label: string; href: string } }) {
  const router = useRouter();
  const text = projectBrief(project)?.text ?? "";
  const chips = matchChips(text);
  const [dropped, setDroppedState] = useState<Set<string>>(() => {
    const kept = projectBrief(project)?.extraction?.quoted.map((c) => c.label);
    return new Set(kept ? chips.map((c) => c.label).filter((l) => !kept.includes(l)) : []);
  });
  const toggle = (label: string) =>
    setDroppedState((d) => {
      const next = new Set(d);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const why = failure.reason === "offline" ? WHY.offline : failure.message;

  return (
    <div className={ui.screen}>
      <StepHeader label="What it read" back={back} />

      <div className={ui.body}>
        <p className={read.lead}>
          Here&apos;s what it matched in your brief. Drop anything wrong before it builds the list — a misread here becomes a wrong shot on the day.
        </p>

        <div className={styles.matched}>
          <span className={ui.boxHeading}>FROM YOUR WORDS</span>
          {chips.length > 0 ? (
            <>
              <ul className={styles.chips}>
                {chips.map((c) => (
                  <li key={c.label}>
                    <Droppable label={c.label} off={dropped.has(c.label)} onToggle={() => toggle(c.label)} />
                  </li>
                ))}
              </ul>
              <p className={ui.hint}>Tap one to drop it. Dropped words don&apos;t steer the list.</p>
            </>
          ) : (
            <p className={ui.boxTextMuted}>Nothing matched — the list will build from what the brief describes, and your format.</p>
          )}
        </div>

        <div className={ui.box}>
          <span className={ui.boxHeading}>ON THIS PHONE</span>
          <p className={ui.boxText}>{why}</p>
        </div>
      </div>

      <div className={ui.footer}>
        <button
          type="button"
          className={ui.primary}
          onClick={async () => {
            await saveProject(setQuoted(project, chips.filter((c) => !dropped.has(c.label))));
            router.push(`/suggest?id=${project.id}&from=brief`);
          }}
        >
          BUILD THE LIST
        </button>
      </div>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense>
      <WhatItRead />
    </Suspense>
  );
}
