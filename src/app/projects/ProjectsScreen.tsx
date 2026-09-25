"use client";

import Link from "next/link";
import { useState } from "react";
import { AppTop, Dock } from "@/components/AppFrame";
import { Choice } from "@/components/Choice";
import { ProjectRow } from "@/components/ProjectRow";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { GROUPS, projectGroup, todayIso, type ProjectGroup } from "@/lib/status";
import { useLive } from "@/lib/useLive";
import styles from "./Projects.module.css";

type Filter = "all" | ProjectGroup;

/** S1 Projects as the PROJECTS tab (H5), and E4 when there are none (§8). */
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
      <AppTop>
        <h1 className={styles.title}>PROJECTS</h1>
      </AppTop>

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

      <Dock current="projects">
        <Link href="/new" className={ui.primary}>
          + NEW PROJECT
        </Link>
      </Dock>
    </div>
  );
}

/** E4: the empty Projects tab. */
function EmptyProjects() {
  return (
    <div className={ui.screen}>
      <AppTop />
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
        <p className={ui.hint}>
          No account needed. Everything stays on this phone until you decide otherwise, and it all works with no signal.
        </p>
      </div>
      <Dock current="projects">
        <Link href="/new" className={ui.primary}>
          + NEW PROJECT
        </Link>
      </Dock>
    </div>
  );
}
