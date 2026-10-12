"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { RequiredMark } from "@/components/Marks";
import ui from "@/components/ui.module.css";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { stepOrder } from "@/lib/stepping";
import type { Id, Project } from "@/lib/types";
import styles from "./PinSheet.module.css";

interface Props {
  project: Project;
  /** Shots it's already on, left out of the list. */
  already?: Id[];
  /** Ticked when the sheet opens. */
  initial?: Id[];
  onClose: () => void;
  onPin: (shotIds: Id[]) => void;
}

/**
 * L4 Pin to shots: the shots under their location bands, in running order,
 * each with a tick box. "A ref can sit on more than one shot."
 */
export function PinSheet({ project, already = [], initial = [], onClose, onPin }: Props) {
  const [picked, setPicked] = useState<Set<Id>>(new Set(initial));
  const numbers = shotNumbers(project);
  const byId = new Map(project.shots.map((s) => [s.id, s]));
  const order = stepOrder(project, "location").filter((s) => !already.includes(s.id) && byId.get(s.id)?.status !== "dropped");
  const toggle = (id: Id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <BottomSheet title="PIN TO SHOTS" onClose={onClose}>
      <div className={styles.list}>
        {order.length === 0 && <p className={styles.none}>{project.shots.length ? "It's on every shot already." : "No shots yet. Add some, then pin refs to them."}</p>}
        {order.map((step, i) => {
          const shot = byId.get(step.id)!;
          const band = i === 0 || order[i - 1].group !== step.group ? step.arrival.replace(/^NOW (AT |IN )?/, "") : undefined;
          const on = picked.has(shot.id);
          const n = numbers.get(shot.id);
          return (
            <div key={shot.id}>
              {band && <h3 className={styles.band}>{band}</h3>}
              <label className={on ? `${styles.row} ${styles.on}` : styles.row}>
                <input type="checkbox" className={styles.tick} checked={on} onChange={() => toggle(shot.id)} />
                <span className={styles.no}>{n !== undefined ? formatShotNumber(n) : ""}</span>
                <span className={styles.size}>{shot.size}</span>
                <span className={styles.subject}>
                  <span>{shot.subject}</span>
                  {shot.required && (
                    <span className={styles.required}>
                      <RequiredMark label="Required" /> FOR {shot.required.client.toUpperCase()}
                    </span>
                  )}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      <div className={styles.foot}>
        <p className={ui.hint}>A ref can sit on more than one shot.</p>
        {picked.size ? (
          <button type="button" className={ui.primary} onClick={() => onPin([...picked])}>
            PIN TO {picked.size}
          </button>
        ) : (
          <button type="button" className={ui.disabled} aria-disabled="true">
            PIN TO…
          </button>
        )}
        <button type="button" className={ui.secondary} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </BottomSheet>
  );
}
