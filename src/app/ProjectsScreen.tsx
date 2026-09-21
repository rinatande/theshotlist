"use client";

import Link from "next/link";
import { useState } from "react";
import { Choice } from "@/components/Choice";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { budgetLabel, dateSpan, formatLine } from "@/lib/labels";
import { GROUPS, progress, projectGroup, projectMarker, todayIso, type ProjectGroup } from "@/lib/status";
import type { Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import styles from "./Projects.module.css";

type Filter = "all" | ProjectGroup;

/** S1 Projects, and E4 when there are none. The entry point (§8). */
export function ProjectsScreen() {
  const projects = useLive(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const [filter, setFilter] = useState<Filter>("all");

  if (projects === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (projects.length === 0) return <EmptyProjects />;

  const today = todayIso();
  const grouped = GROUPS.map((g) => ({
    ...g,
    projects: projects.filter((p) => projectGroup(p, today) === g.value),
  })).filter((g) => g.projects.length > 0 && (filter === "all" || filter === g.value));

  return (
    <div className={ui.screen}>
      <TopBar />
      <h1 className={styles.title}>PROJECTS</h1>

      <div className={styles.filters}>
        <Choice
          label="Show"
          hideLabel
          small
          options={[
            { value: "all", label: `ALL ${projects.length}` },
            ...GROUPS.map((g) => ({ value: g.value, label: g.label })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className={ui.flush}>
        {grouped.map((g) => (
          <section key={g.value} aria-labelledby={`band-${g.value}`}>
            <h2 id={`band-${g.value}`} className={ui.band}>
              {g.label}
            </h2>
            <ul className={styles.list}>
              {g.projects.map((p) => (
                <li key={p.id}>
                  <ProjectRow project={p} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {grouped.length === 0 && <p className={styles.none}>Nothing here.</p>}
      </div>

      <div className={ui.footer}>
        <Link href="/new" className={ui.primary}>
          + NEW PROJECT
        </Link>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className={styles.topBar}>
      <span className={styles.brand}>THESHOTLIST</span>
      <span className={styles.topLinks}>
        <Link href="/gear" className={styles.topLink}>
          GEAR
        </Link>
        <Link href="/settings" className={styles.topLink}>
          SETTINGS
        </Link>
      </span>
    </div>
  );
}

function ProjectRow({ project, today }: { project: Project; today: string }) {
  const marker = projectMarker(project, today);
  const { exposed, planned, budget } = progress(project);
  const wrapped = marker.kind === "wrapped";
  const pad = (n: number) => String(n).padStart(2, "0");
  // With nothing planned yet, the count reads against the budget, as the empty list's plan bar does.
  const count = planned > 0 ? `${pad(exposed)}/${pad(planned)}` : `0 / ${budgetLabel(budget).replace(" — ", "—")}`;
  const fill = planned > 0 ? Math.round((exposed / planned) * 100) : 0;
  const meta = [dateSpan(project), project.where?.toUpperCase()].filter(Boolean).join(" · ");

  return (
    <Link href={`/project?id=${project.id}`} className={styles.row}>
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

/** E4: the empty Projects screen doubles as onboarding (§10, 12). */
function EmptyProjects() {
  return (
    <div className={ui.screen}>
      <TopBar />
      <h1 className={styles.pitch}>Know what you&apos;re shooting before you get there.</h1>
      <ol className={styles.steps}>
        <li>
          <span className={styles.stepNo}>01</span> Say what the day is. Loose or detailed.
        </li>
        <li>
          <span className={styles.stepNo}>02</span> Get a shot list that fits your kit and your format.
        </li>
        <li>
          <span className={styles.stepNo}>03</span> Tick it off on the day. <span className={styles.ok}>[✓]</span>
        </li>
      </ol>
      <div className={`${ui.body} ${styles.emptyBody}`}>
        <p className={styles.nothing}>
          Nothing here yet. Start with a project, or tell it what&apos;s in your bag first — either way round works.
        </p>
      </div>
      <div className={ui.footer}>
        <Link href="/new" className={ui.primary}>
          + NEW PROJECT
        </Link>
        <Link href="/gear" className={ui.secondary}>
          SET UP MY GEAR
        </Link>
        <p className={ui.hint}>
          No account needed. Everything stays on this phone until you decide otherwise, and it all works with no signal.
        </p>
      </div>
    </div>
  );
}
