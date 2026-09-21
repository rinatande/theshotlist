"use client";

import Link from "next/link";
import { useState } from "react";
import type { Project } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import styles from "./ProjectActions.module.css";
import ui from "./ui.module.css";

interface Props {
  project: Project;
  onClose: () => void;
  onDelete: () => void;
}

/**
 * The ⋯ sheet (A1) and its delete confirmation (A2), which replaces the
 * sheet's content rather than stacking a second sheet (§5.14, §7).
 */
export function ProjectActions({ project, onClose, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const title = project.name.toUpperCase();

  if (confirming) {
    return (
      <BottomSheet title={`DELETE · ${title}`} onClose={onClose}>
        <div className={styles.confirm}>
          <p className={styles.question}>
            Are you sure you want to delete this project? {deleteConsequence(project)} This can&apos;t be undone.
          </p>
          <button type="button" className={`${ui.primary} ${ui.destructive}`} onClick={onDelete}>
            YES, DELETE
          </button>
          <button type="button" className={ui.secondary} onClick={onClose}>
            CANCEL
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={title} onClose={onClose}>
      <ul className={styles.rows}>
        <li>
          <Link href={`/project/edit?id=${project.id}`} className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>EDIT PROJECT</span>
              <span className={styles.rowHint}>Name, kind, format, days, where.</span>
            </span>
            <span aria-hidden="true" className={styles.chevron}>
              ›
            </span>
          </Link>
        </li>
        <li>
          <button type="button" className={`${styles.row} ${styles.warn}`} onClick={() => setConfirming(true)}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>DELETE PROJECT</span>
              <span className={styles.rowHint}>Asks you first.</span>
            </span>
            <span aria-hidden="true" className={styles.chevron}>
              ›
            </span>
          </button>
        </li>
      </ul>
    </BottomSheet>
  );
}

/** "12 shots, 3 days and the brief go with it." — counted, not generic (§5.14). */
export function deleteConsequence(p: Project): string {
  const parts: string[] = [];
  if (p.shots.length) parts.push(p.shots.length === 1 ? "1 shot" : `${p.shots.length} shots`);
  if (p.locations.length) parts.push(p.locations.length === 1 ? "1 location" : `${p.locations.length} locations`);
  if (p.dayCount > 1) parts.push(`${p.dayCount} days`);
  if (p.briefs.length) parts.push("the brief");
  if (parts.length === 0) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list[0].toUpperCase()}${list.slice(1)} go with it.`;
}
