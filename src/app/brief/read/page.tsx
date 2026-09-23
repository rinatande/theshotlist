"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { RequiredMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief, saveRead, setDropped } from "@/lib/brief";
import { db } from "@/lib/db";
import type { ReadFailure } from "@/lib/read";
import { runRead } from "@/lib/readClient";
import type { Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "../Brief.module.css";
import read from "./Read.module.css";

type State = { phase: "reading" } | { phase: "read"; cached: boolean; remaining: number } | { phase: "failed"; failure: ReadFailure };

/**
 * B9 What it read (§5.6). GENERATE lands here: with signal it reads the whole
 * brief once — or reuses the last read of the same brief, for free — and
 * shows what it took before anything is built. Offline, over a limit, or if
 * the read fails, it says why and offers to try again or add shots by hand —
 * there's no phone-only list any more (Rina, 23 Sep).
 */
function WhatItRead() {
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  return <Review key={project.id} project={project} />;
}

function Review({ project }: { project: Project }) {
  const [state, setState] = useState<State>({ phase: "reading" });
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  // One read per attempt, never two — React may run effects twice in development.
  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    (async () => {
      const outcome = await runRead(project);
      if (!outcome.ok) return setState({ phase: "failed", failure: outcome.failure });
      if (!outcome.cached) {
        const latest = (await db.projects.get(project.id)) ?? project;
        await saveProject(saveRead(latest, { hash: outcome.hash, model: outcome.response.model, result: outcome.response.result }));
      }
      setState({ phase: "read", cached: outcome.cached, remaining: outcome.response.remaining });
    })();
  }, [project, attempt]);

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
            Half a minute for a reel, up to a minute or so for a longer cut. It reads the whole thing once — not as you type — and nothing is built until you&apos;ve seen what it took.
          </p>
        </div>
      </div>
    );
  }

  const brief = projectBrief(project);
  if (state.phase === "read" && brief?.read) return <FullRead project={project} state={state} back={back} />;
  return (
    <Failed
      project={project}
      failure={state.phase === "failed" ? state.failure : { reason: "error", message: "The read didn't come back." }}
      back={back}
      onRetry={() => {
        setState({ phase: "reading" });
        setAttempt((a) => a + 1);
      }}
    />
  );
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
              ? "Read earlier from this same brief and gear, so it didn't run again — reopening this costs nothing."
              : "One request, just now. It won't run again unless you change the brief or your gear — reopening this costs nothing."}{" "}
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

/**
 * When the read can't happen. Nothing is built from the phone's own matching:
 * it was too generic to use (Rina, 23 Sep). The brief is kept, nothing is
 * charged, and shots can still be added by hand.
 */
function Failed({ project, failure, back, onRetry }: { project: Project; failure: ReadFailure; back: { label: string; href: string }; onRetry: () => void }) {
  const offline = failure.reason === "offline";
  const limit = failure.reason === "limit";
  const why = offline ? "No signal. Generating reads your brief online, so it needs a connection." : failure.message;

  return (
    <div className={ui.screen}>
      <StepHeader label="What it read" back={back} />

      <div className={ui.body}>
        <p className={read.lead}>{offline ? "Couldn't read your brief without signal." : limit ? "No reads left for now." : "The read didn't work this time."}</p>
        <div className={ui.box}>
          <span className={ui.boxHeadingWarn}>{offline ? "NO SIGNAL" : limit ? "LIMIT" : "NOT READ"}</span>
          <p className={ui.boxText}>{why}</p>
        </div>
        <p className={ui.boxTextMuted}>
          Your brief is saved. Everything else works as usual — add shots by hand now, or generate again {offline ? "once you have signal" : limit ? "when reads come back" : "in a moment"}.
        </p>
      </div>

      <div className={ui.footer}>
        {!limit && (
          <button type="button" className={ui.primary} onClick={onRetry}>
            TRY AGAIN
          </button>
        )}
        <Link href={`/shot/new?id=${project.id}`} className={limit ? ui.primary : ui.secondary}>
          + ADD A SHOT BY HAND
        </Link>
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
