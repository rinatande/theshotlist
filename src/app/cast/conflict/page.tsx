"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { castConflict } from "@/lib/cast";
import { TREATMENTS } from "@/lib/labels";
import { useProject } from "@/lib/useProject";
import styles from "../Cast.module.css";
import { castBack, saveCast } from "../castNav";

/** What "keep both" does, shown rather than described (B6). */
const REWRITES: [string, string, string][] = [
  ["MS", "Intro, straight to lens", "Walking in, camera ahead — voice-over over it"],
  ["CU", "Reaction, face", "Hands stopping mid-task"],
  ["MS", "Sign-off to camera", "Back of head, walking out of frame"],
];

/**
 * B6 (§5.8): the treatment needs someone talking on screen — to camera, or in
 * an interview (Rina, 30 Sep) — and nobody in the cast is at "part of it" or
 * above. Both came from the person, so the app shows the contradiction and
 * three ways out; it doesn't pick a side.
 */
function Conflict() {
  const router = useRouter();
  const { project, params } = useProject();

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;

  const from = params.get("from");
  const back = castBack(project, from);
  const cast = `/cast?id=${project.id}${from ? `&from=${from}` : ""}`;
  const treatment = TREATMENTS.find((t) => t.value === project.format.treatment)!;
  const interview = project.format.treatment === "interview";
  const settled = !castConflict(project.format.treatment, project.cast);

  return (
    <div className={ui.screen}>
      <StepHeader label="Conflict" back={{ label: "← CAST", href: cast }} />

      <div className={ui.flush}>
        <div className={styles.pair}>
          <span className={styles.pairLabel}>TREATMENT</span>
          <span className={styles.pairValue}>{treatment.label}</span>
        </div>
        <div className={styles.pair}>
          <span className={styles.pairLabel}>ON CAMERA</span>
          <span className={styles.pairValue}>NOBODY AT PART OF IT OR MORE</span>
        </div>

        <div className={styles.disagree} role="status">
          <span className={ui.boxHeadingWarn}>{settled ? "SETTLED" : "! THESE TWO DISAGREE"}</span>
          <p className={ui.boxText}>
            {interview ? "An interview" : "Talking to camera"} assumes someone is on screen. Nobody in the cast is. Nothing is broken — but the app needs to know which
            way to lean before it suggests anything.
          </p>
        </div>

        <h2 className={`${styles.band} ${styles.gapAbove}`}>
          IF YOU KEEP BOTH
        </h2>
        <p className={styles.line}>Pieces to camera become voice-over, and the read rewrites rather than removes:</p>
        <ul className={styles.rewrites}>
          {REWRITES.map(([size, before, after]) => (
            <li key={before} className={styles.rewrite}>
              <span className={styles.rewriteSize}>{size}</span>
              <span className={styles.before}>
                <span className={ui.visuallyHidden}>Instead of </span>
                {before}
              </span>
              <span className={styles.after}>{after}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={ui.footer}>
        <div className={styles.choices}>
          <button
            type="button"
            className={ui.primary}
            onClick={async () => {
              await saveCast(project, (c) => ({ ...c, voiceOver: true }));
              router.push(back.href);
            }}
          >
            KEEP BOTH — USE VOICE-OVER
          </button>
          <Link href={`/project/edit?id=${project.id}`} className={ui.secondary}>
            CHANGE TREATMENT
          </Link>
          <Link href={cast} className={ui.secondary}>
            CHANGE PRESENCE
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConflictPage() {
  return (
    <Suspense>
      <Conflict />
    </Suspense>
  );
}
