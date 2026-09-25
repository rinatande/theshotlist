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
import { readContext, shotTarget, type ReadFailure } from "@/lib/read";
import { runRead, type ReadProgress } from "@/lib/readClient";
import type { Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import { useNow } from "@/lib/useShoot";
import styles from "../Brief.module.css";
import read from "./Read.module.css";

/** Where the read has got, from what the server streams — never from a timer (Rina, 23 Sep). */
type Stage = "sending" | "thinking" | "writing" | "topup" | "finishing";
interface Progress {
  stage: Stage;
  count: number;
  subject?: string;
}
const START: Progress = { stage: "sending", count: 0 };

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
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  return <Review key={project.id} project={project} />;
}

function Review({ project }: { project: Project }) {
  const [state, setState] = useState<State>({ phase: "reading" });
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<Progress>(START);
  const [since, setSince] = useState(() => Date.now());
  const started = useRef(-1);

  // One read per attempt, never two — React may run effects twice in development.
  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    (async () => {
      const outcome = await runRead(project, (p: ReadProgress) =>
        setProgress((prev) => (p.type === "stage" ? { ...prev, stage: p.stage } : { ...prev, count: p.count, subject: p.subject })),
      );
      if (!outcome.ok) return setState({ phase: "failed", failure: outcome.failure });
      if (!outcome.cached) {
        setProgress((prev) => ({ ...prev, stage: "finishing" }));
        const latest = (await db.projects.get(project.id)) ?? project;
        await saveProject(saveRead(latest, { hash: outcome.hash, model: outcome.response.model, result: outcome.response.result }));
      }
      setState({ phase: "read", cached: outcome.cached, remaining: outcome.response.remaining });
    })();
  }, [project, attempt]);

  const back = { label: "← EDIT BRIEF", href: `/brief?id=${project.id}` };

  if (state.phase === "reading") return <Reading project={project} progress={progress} since={since} back={back} />;

  const brief = projectBrief(project);
  if (state.phase === "read" && brief?.read) return <FullRead project={project} state={state} back={back} />;
  return (
    <Failed
      project={project}
      failure={state.phase === "failed" ? state.failure : { reason: "error", message: "The read didn't come back." }}
      back={back}
      onRetry={() => {
        setState({ phase: "reading" });
        setProgress(START);
        setSince(Date.now());
        setAttempt((a) => a + 1);
      }}
    />
  );
}

// ─── While it reads (Rina, 23 Sep) ────────────────────────────────────────────

/**
 * A minute is a long time to stare at a still screen. Everything here is
 * real: the stage the read has reached, each shot as it finishes writing it,
 * and how long it's been — so a stuck read would look stuck.
 */
function Reading({ project, progress, since, back }: { project: Project; progress: Progress; since: number; back: { label: string; href: string } }) {
  const now = useNow(1000);
  const target = Math.max(1, shotTarget(readContext(project)).room);
  const secs = Math.max(0, Math.floor((now.getTime() - since) / 1000));
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const { stage, count, subject } = progress;
  const line =
    stage === "sending"
      ? "Sending your brief…"
      : stage === "thinking"
        ? "Reading it through…"
        : stage === "finishing"
          ? "Putting it together…"
          : stage === "topup"
            ? `Finding a few more to reach your budget — ${count} of ${target}`
            : count === 0
              ? "Planning the shots…"
              : `Planning the shots — ${count} of ${target}`;
  // Screen readers hear each stage once, not every shot.
  const spoken = stage === "writing" || stage === "topup" ? "Planning the shots." : line;

  return (
    <div className={ui.screen}>
      <StepHeader label="What it read" back={back} />
      <div className={ui.body} aria-busy="true">
        <p className={read.lead}>Reading your brief…</p>

        <div className={read.progress}>
          <div className={read.statusRow}>
            <span className={read.status}>{line}</span>
            <span className={read.elapsed} aria-label={`${secs} seconds so far`}>
              {elapsed}
            </span>
          </div>
          <div className={read.meter} role="progressbar" aria-label="Shots planned" aria-valuemin={0} aria-valuemax={target} aria-valuenow={count}>
            <span style={{ width: `${Math.min(100, (count / target) * 100)}%` }} />
          </div>
          {subject && <p className={read.latest}>&ldquo;{subject}&rdquo;</p>}
        </div>
        <p className={read.sr} aria-live="polite">
          {spoken}
        </p>

        <p className={ui.boxTextMuted}>
          It reads the whole brief once — not as you type — and nothing is built until you&apos;ve seen what it took. Keep this screen open: a longer video takes about a minute.
        </p>
      </div>
    </div>
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
