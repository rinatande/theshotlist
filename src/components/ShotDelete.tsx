"use client";

import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { deleteGoes, deleteRenumber } from "@/lib/shots";
import type { Id, Project, Shot } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { RequiredMark } from "./Marks";
import styles from "./ShotDelete.module.css";
import ui from "./ui.module.css";

interface Props {
  project: Project;
  ids: Id[];
  onClose: () => void;
  onDelete: () => void;
}

/**
 * Deleting shots always asks first (S3b for one, SL5 for several), and says
 * what goes: the subject, and what happens to the numbers below. A shot
 * already exposed, or required by a client, is named on its own — those are
 * the ones you'd regret (Rina, 25 Sep).
 */
export function ShotDelete({ project, ids, onClose, onDelete }: Props) {
  const shots = project.shots.filter((s) => ids.includes(s.id));
  const numbers = shotNumbers(project);
  const one = shots.length === 1;
  const no = (s: Shot) => (numbers.has(s.id) ? formatShotNumber(numbers.get(s.id)!) : "");
  const exposed = shots.filter((s) => s.status === "exposed");
  const required = shots.filter((s) => s.required);
  const count = (n: number, verb: [string, string]) => `${n} ${n === 1 ? verb[0] : verb[1]}`;

  return (
    <BottomSheet
      kicker={one ? `DELETE · SHOT ${no(shots[0])}` : `DELETE · ${shots.length} SHOTS`}
      title={one ? "Delete this shot?" : `Delete ${shots.length} shots?`}
      onClose={onClose}
    >
      <div className={styles.body}>
        {exposed.length > 0 && (
          <div className={styles.callout} role="status">
            <span className={styles.calloutHead}>! {count(exposed.length, ["IS", "ARE"])} ALREADY SHOT</span>
            {exposed.map((s) => (
              <span key={s.id} className={styles.calloutLine}>
                {no(s)} {s.subject} — its mark goes with it, and it leaves the exposed count.
              </span>
            ))}
          </div>
        )}
        {required.length > 0 && (
          <div className={styles.callout} role="status">
            <span className={styles.calloutHead}>
              <RequiredMark label="Required" /> {count(required.length, ["IS", "ARE"])} REQUIRED FOR A CLIENT
            </span>
            {required.map((s) => (
              <span key={s.id} className={styles.calloutLine}>
                {no(s)} {s.subject} — for {s.required!.client}. It leaves what {s.required!.client} is owed.
              </span>
            ))}
          </div>
        )}
        <p className={styles.text}>
          {one ? `${deleteGoes(shots[0])} ` : ""}
          {deleteRenumber(project, ids)} This can&apos;t be undone.
        </p>
      </div>
      <div className={styles.buttons}>
        <button type="button" className={`${ui.primary} ${ui.destructive}`} onClick={onDelete}>
          {one ? "YES, DELETE" : `YES, DELETE ${shots.length}`}
        </button>
        <button type="button" className={ui.secondary} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </BottomSheet>
  );
}
