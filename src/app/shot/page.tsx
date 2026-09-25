"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { RequiredMark, StatusMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import sheet from "@/components/ProjectActions.module.css";
import { ShotDelete } from "@/components/ShotDelete";
import ui from "@/components/ui.module.css";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { deleteShots, toggleExposed } from "@/lib/shots";
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
  // The ⋯ sheet (S3a), and its delete confirmation (S3b) in its place.
  const [sheetOpen, setSheetOpen] = useState<"menu" | "delete" | null>(null);
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
    // A gear chip is a reference to an item the shoot is bringing (§6.4), so it says which.
    ["LENS", [shot.lens?.toUpperCase(), project.gear.find((g) => g.id === shot.lensId)?.name].filter(Boolean).join(" · ")],
    ["SUPPORT", shot.support && [supportLabel(shot.support), project.gear.find((g) => g.id === shot.supportId)?.name].filter(Boolean).join(" · ")],
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
          <span className={styles.positionNo}>{n !== undefined ? `${formatShotNumber(n)} / ${formatShotNumber(numbers.size)}` : ""}</span>
          <button type="button" className={styles.more} aria-label="Shot options" onClick={() => setSheetOpen("menu")}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
              <circle cx="4" cy="10" r="1.6" />
              <circle cx="10" cy="10" r="1.6" />
              <circle cx="16" cy="10" r="1.6" />
            </svg>
          </button>
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
        {shot.required && (
          <p className={styles.required}>
            <RequiredMark label="Required" /> FOR {shot.required.client.toUpperCase()}
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

      {/* Duplicate and delete sit behind ⋯, out of reach of a stray tap (§5.13, Rina 25 Sep). */}
      {sheetOpen === "menu" && (
        <BottomSheet title={`SHOT ${n !== undefined ? formatShotNumber(n) : ""} · ${shot.subject.toUpperCase()}`} onClose={() => setSheetOpen(null)}>
          <ul className={sheet.rows}>
            <li>
              <Link href={`/shot/edit?id=${project.id}&shot=${shot.id}`} className={sheet.row}>
                <span className={sheet.rowText}>
                  <span className={sheet.rowTitle}>EDIT SHOT</span>
                  <span className={sheet.rowHint}>Size, lens, movement, sound, note.</span>
                </span>
                <span aria-hidden="true" className={sheet.chevron}>
                  ›
                </span>
              </Link>
            </li>
            <li>
              <Link href={`/shot/new?id=${project.id}&copy=${shot.id}`} className={sheet.row}>
                <span className={sheet.rowText}>
                  <span className={sheet.rowTitle}>DUPLICATE</span>
                  <span className={sheet.rowHint}>Opens a copy to change. Nothing is added until you save it.</span>
                </span>
                <span aria-hidden="true" className={sheet.chevron}>
                  ›
                </span>
              </Link>
            </li>
            <li>
              <button type="button" className={`${sheet.row} ${sheet.warn}`} onClick={() => setSheetOpen("delete")}>
                <span className={sheet.rowText}>
                  <span className={sheet.rowTitle}>DELETE SHOT</span>
                  <span className={sheet.rowHint}>Asks you first.</span>
                </span>
                <span aria-hidden="true" className={sheet.chevron}>
                  ›
                </span>
              </button>
            </li>
          </ul>
        </BottomSheet>
      )}
      {sheetOpen === "delete" && (
        <ShotDelete
          project={project}
          ids={[shot.id]}
          onClose={() => setSheetOpen(null)}
          onDelete={async () => {
            // Leave first, so this screen never renders a shot that's gone.
            router.replace(list);
            await saveProject(deleteShots(project, [shot.id]));
          }}
        />
      )}
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
