"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { readLastViewed } from "@/lib/lastViewed";
import type { Id, Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import styles from "./PinSheet.module.css";

/**
 * TO (L8): which project's look a share goes to. Sharing starts outside the
 * app, so it's changeable; it starts on the project you were last in.
 */
export function useShareProject(given: Id | null) {
  const projects = useLive(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const [chosen, setChosen] = useState<Id | null>(null);
  if (!projects) return { projects: undefined, project: undefined, choose: setChosen };
  const last = typeof window !== "undefined" ? readLastViewed()?.id : undefined;
  const id = chosen ?? given ?? (projects.some((p) => p.id === last) ? last : projects[0]?.id);
  return { projects, project: projects.find((p) => p.id === id), choose: setChosen };
}

export function ProjectTo({ projects, project, onChoose }: { projects: Project[]; project?: Project; onChoose: (id: Id) => void }) {
  const [open, setOpen] = useState(false);
  if (!project) {
    return (
      <div className={ui.field}>
        <span className={ui.label}>TO</span>
        <p className={ui.hint}>There&apos;s no project on this phone to add it to yet.</p>
        <Link href="/new" className={ui.secondary}>
          + NEW PROJECT
        </Link>
      </div>
    );
  }
  return (
    <div className={ui.field}>
      <span id="to" className={ui.label}>
        TO
      </span>
      <button type="button" aria-labelledby="to" className={styles.to} onClick={() => setOpen(true)} disabled={projects.length < 2}>
        <span>{project.name.toUpperCase()} · MOODBOARD</span>
        {projects.length > 1 && <span className={styles.change}>CHANGE</span>}
      </button>
      {open && (
        <BottomSheet title="ADD TO WHICH MOODBOARD" onClose={() => setOpen(false)}>
          <ul className={styles.projects}>
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={p.id === project.id ? `${styles.row} ${styles.on}` : styles.row}
                  aria-current={p.id === project.id || undefined}
                  onClick={() => {
                    onChoose(p.id);
                    setOpen(false);
                  }}
                >
                  <span className={styles.subject}>{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
