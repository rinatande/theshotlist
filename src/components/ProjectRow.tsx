import Link from "next/link";
import { budgetLabel, dateSpan, formatLine } from "@/lib/labels";
import { progress, projectMarker } from "@/lib/status";
import type { IsoDate, Project } from "@/lib/types";
import styles from "./ProjectRow.module.css";

/** A project as a row: S1's list, and the cards on Home (H2, H3) with `boxed`. */
export function ProjectRow({ project, today, boxed }: { project: Project; today: IsoDate; boxed?: boolean }) {
  const marker = projectMarker(project, today);
  const { exposed, planned, budget } = progress(project);
  const wrapped = marker.kind === "wrapped";
  const pad = (n: number) => String(n).padStart(2, "0");
  // With nothing planned yet, the count reads against the budget, as the empty list's plan bar does.
  const count = planned > 0 ? `${pad(exposed)}/${pad(planned)}` : `0 / ${budgetLabel(budget).replace(" — ", "—")}`;
  const fill = planned > 0 ? Math.round((exposed / planned) * 100) : 0;
  const meta = [dateSpan(project) ?? (boxed ? "NO DATE" : undefined), project.where?.toUpperCase()].filter(Boolean).join(" · ");

  return (
    <Link href={`/project?id=${project.id}`} className={boxed ? `${styles.row} ${styles.boxed}` : styles.row}>
      <span className={styles.rowTop}>
        <span className={wrapped ? `${styles.name} ${styles.muted}` : styles.name}>{project.name}</span>
        {marker.kind !== "none" && <span className={styles[`marker-${marker.kind}`]}>{marker.text}</span>}
      </span>
      <span className={styles.meter}>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${fill}%` }} />
        </span>
        <span className={exposed > 0 ? styles.countOk : styles.count}>
          <span className={styles.visuallyHidden}>Exposed </span>
          {count}
        </span>
      </span>
      <span className={styles.metaRow}>
        <span className={styles.meta}>{meta}</span>
        <span className={styles.formatLine}>{formatLine(project.format)}</span>
      </span>
    </Link>
  );
}
