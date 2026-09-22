"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequiredMark, StatusMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { deleteConsequence, deleteShot, duplicateShot, toggleExposed } from "@/lib/shots";
import { audioLabel, movementLabel, supportLabel } from "@/lib/suggest";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "./Shot.module.css";

/** S3 Shot detail: the spec you check at the camera (§8). */
function ShotDetail() {
  const router = useRouter();
  const { project, params } = useProject();
  const shotId = params.get("shot") ?? "";
  const [tf, setTf] = useState<TimeFormat>("12h");
  const [fresh, setFresh] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTf(readTimeFormat()), []);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  const shot = project?.shots.find((s) => s.id === shotId);
  if (!project || !shot) return <NotHere href={project ? `/project?id=${project.id}` : "/"} />;

  const numbers = shotNumbers(project);
  const n = numbers.get(shot.id);
  const location = project.locations.find((l) => l.id === shot.locationId);
  const exposed = shot.status === "exposed";
  const where = location
    ? [location.name.toUpperCase(), location.startTime !== undefined ? formatClock(location.startTime, tf) : undefined].filter(Boolean).join(" · ")
    : "UNPLACED";

  // Only the rows that say something (§8: the information you check at the camera).
  const spec = [
    ["LENS", shot.lens?.toUpperCase()],
    ["SUPPORT", shot.support && supportLabel(shot.support)],
    ["MOVEMENT", shot.movement && movementLabel(shot.movement)],
    ["SOUND", shot.audio && audioLabel(shot.audio)],
  ].filter(([, v]) => v) as [string, string][];

  const list = `/project?id=${project.id}`;

  return (
    <div className={ui.screen}>
      <header className={styles.header}>
        <Link href={list} className={ui.backLink}>
          ← SHOT LIST
        </Link>
        <span className={styles.position}>
          {shot.required ? <RequiredMark /> : n !== undefined ? `${formatShotNumber(n)} / ${formatShotNumber(numbers.size)}` : ""}
        </span>
      </header>

      <div className={ui.body}>
        <div className={styles.line}>
          <span className={styles.sizeChip}>{shot.size}</span>
          <span className={styles.where}>{where}</span>
        </div>
        <h1 className={exposed ? styles.titleDone : styles.title}>{shot.subject}</h1>
        {exposed && (
          <p className={styles.state}>
            <StatusMark exposed fresh={fresh} /> EXPOSED
          </p>
        )}
        {shot.flagNote && !exposed && <p className={styles.flag}>! {shot.flagNote.toUpperCase()}</p>}
        {/* Why a suggested shot is here — the line that ties it to the brief or the kit (§6.2). */}
        {shot.reason && <p className={styles.reason}>{shot.reason}</p>}

        {spec.length > 0 && (
          <dl className={styles.spec}>
            {spec.map(([k, v]) => (
              <div key={k} className={styles.specRow}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {shot.note && (
          <div>
            <h2 className={ui.label}>NOTE</h2>
            <p className={styles.note}>{shot.note}</p>
          </div>
        )}

        {/* Here rather than in edit, so neither needs the form opened first (§5.13). */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionRow}
            onClick={async () => {
              const [next, copy] = duplicateShot(project, shot.id);
              await saveProject(next);
              router.push(`/shot?id=${project.id}&shot=${copy}`);
            }}
          >
            <span className={styles.actionTitle}>DUPLICATE</span>
            <span className={styles.actionHint}>Same spec, next number. For a second take, or the same insert somewhere else.</span>
          </button>
          <button
            type="button"
            className={`${styles.actionRow} ${styles.warn}`}
            onClick={async () => {
              // States its consequence rather than confirming (§5.13). Leave first,
              // so this screen never renders a shot that's gone.
              router.replace(list);
              await saveProject(deleteShot(project, shot.id));
            }}
          >
            <span className={styles.actionTitle}>DELETE</span>
            <span className={styles.actionHint}>{deleteConsequence(project, shot.id)}</span>
          </button>
        </div>
      </div>

      <div className={`${ui.footer} ${styles.footer}`}>
        <Link href={`/shot/edit?id=${project.id}&shot=${shot.id}`} className={ui.secondary}>
          EDIT
        </Link>
        <button
          type="button"
          className={exposed ? ui.secondary : ui.primary}
          onClick={async () => {
            setFresh(!exposed);
            await saveProject(toggleExposed(project, shot.id));
          }}
        >
          {exposed ? "UNMARK" : "MARK EXPOSED"}
        </button>
      </div>
    </div>
  );
}

export default function ShotPage() {
  return (
    <Suspense>
      <ShotDetail />
    </Suspense>
  );
}
