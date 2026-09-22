"use client";

import Link from "next/link";
import { formatLine } from "@/lib/labels";
import { progress } from "@/lib/status";
import type { Project } from "@/lib/types";
import { useOfflineReady } from "@/lib/useOfflineReady";
import styles from "./ProjectHeader.module.css";

export type Tab = "shots" | "look" | "gear";

const TABS: { value: Tab; label: string }[] = [
  { value: "shots", label: "SHOTS" },
  { value: "look", label: "LOOK" },
  { value: "gear", label: "GEAR" },
];

interface Props {
  project: Project;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onActions: () => void;
}

/**
 * Project header + tabs (§7): identical on every tab, and it stays when a tab
 * is empty — an empty tab is a state of the project, not a different place.
 */
export function ProjectHeader({ project, tab, onTab, onActions }: Props) {
  const offlineReady = useOfflineReady();
  const { exposed, planned } = progress(project);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <Link href="/" className={styles.back}>
          ← PROJECTS
        </Link>
        {offlineReady && <span className={styles.status}>OFFLINE OK</span>}
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.name}>{project.name}</h1>
        <button type="button" className={styles.more} aria-label="Project options" onClick={onActions}>
          ⋯
        </button>
      </div>
      <p className={styles.format}>{formatLine(project.format)}</p>

      {planned > 0 && (
        <div className={styles.meter}>
          <span className={styles.meterLabel}>EXPOSED</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${Math.round((exposed / planned) * 100)}%` }} />
          </span>
          <span className={exposed === planned ? styles.countDone : styles.count}>
            {pad(exposed)}/{pad(planned)}
          </span>
        </div>
      )}

      <nav className={styles.tabs} aria-label="Project">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={styles.tab}
            aria-current={t.value === tab ? "page" : undefined}
            onClick={() => onTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
