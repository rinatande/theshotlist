"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { RequiredMark, StatusMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/labels";
import { todayIso } from "@/lib/status";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import { dayCount, dayShots, laterDays, moveDropped, undrop } from "@/lib/shoot";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import type { Id, Project, Shot } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "./Day.module.css";

/**
 * A wrapped day, opened as a record (§5.12): what was planned, what was
 * exposed, what was dropped. It doesn't un-wrap the day — it's where a
 * dropped shot is un-dropped, or moved to a later day.
 */
function DayRecord() {
  const { project, params } = useProject();
  const [moving, setMoving] = useState<Shot | null>(null);
  const [tf, setTf] = useState<TimeFormat>("12h");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTf(readTimeFormat()), []);
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  const day = project.days.find((d) => d.id === params.get("day"));
  if (!day) return <NotHere href={`/project?id=${project.id}`} label="← SHOT LIST" />;

  const multi = project.days.length > 1;
  const shots = dayShots(project, day.id);
  const count = dayCount(project, day.id);
  const numbers = shotNumbers(project);
  const later = laterDays(project, day.id);
  const exposed = shots.filter((s) => s.status === "exposed");
  const open = shots.filter((s) => s.status === "unshot" || s.status === "flagged");
  const dropped = shots.filter((s) => s.status === "dropped");
  const when = day.wrappedAt ? new Date(day.wrappedAt) : undefined;

  const save = async (change: (p: Project) => Project) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(change(latest));
  };

  const mark = (s: Shot) => (s.required ? <RequiredMark label={`Required for ${s.required.client}`} /> : numbers.has(s.id) ? formatShotNumber(numbers.get(s.id)!) : "");

  return (
    <div className={ui.screen}>
      <StepHeader label={`${multi ? `Day ${day.index}` : "The day"} · ${day.wrappedAt ? "wrapped" : "open"}`} back={{ label: "← SHOT LIST", href: `/project?id=${project.id}` }} />

      <div className={styles.head}>
        <p className={styles.count}>
          <span className={styles.got}>{String(count.exposed).padStart(2, "0")}</span>
          <span className={styles.of}>/{String(count.total).padStart(2, "0")}</span>
          <span className={styles.label}> EXPOSED</span>
        </p>
        <p className={styles.lead}>
          {when ? `Wrapped ${shortDate(todayIso(when))} at ${formatClock(when.getHours() * 60 + when.getMinutes(), tf)}. ` : ""}
          Wrapping locks nothing — un-drop a shot you got after all{later.length ? ", or move it to a later day" : ""}.
        </p>
      </div>

      <div className={ui.flush}>
        {open.length > 0 && (
          <Group title="STILL OPEN" count={open.length}>
            {open.map((s) => (
              <Row key={s.id} shot={s} project={project} mark={mark(s)} />
            ))}
          </Group>
        )}

        {dropped.length > 0 && (
          <Group title="DROPPED" count={dropped.length}>
            {dropped.map((s) => (
              <li key={s.id} className={styles.dropRow}>
                <span className={styles.no}>{mark(s)}</span>
                <span className={styles.size}>{s.size}</span>
                <span className={styles.struck}>{s.subject}</span>
                <span className={styles.actions}>
                  <button type="button" className={styles.action} onClick={() => save((p) => undrop(p, s.id))}>
                    UN-DROP<span className={styles.sr}> {s.subject}</span>
                  </button>
                  {later.length > 0 && (
                    <button type="button" className={styles.action} onClick={() => setMoving(s)}>
                      MOVE ›<span className={styles.sr}> {s.subject} to a later day</span>
                    </button>
                  )}
                </span>
              </li>
            ))}
          </Group>
        )}

        {exposed.length > 0 && (
          <Group title="EXPOSED" count={exposed.length}>
            {exposed.map((s) => (
              <Row key={s.id} shot={s} project={project} mark={mark(s)} />
            ))}
          </Group>
        )}

        {shots.length === 0 && <p className={styles.empty}>Nothing was planned for this day.</p>}
      </div>

      {moving && (
        <BottomSheet title={`MOVE ${moving.subject.toUpperCase()} TO`} onClose={() => setMoving(null)}>
          <ul className={styles.sheetList}>
            {later.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={styles.sheetRow}
                  onClick={async () => {
                    const id: Id = moving.id;
                    setMoving(null);
                    await save((p) => moveDropped(p, id, d.id));
                  }}
                >
                  <span className={styles.sheetLabel}>DAY {d.index}</span>
                  <span className={ui.hint}>Back on the list for that day, unplaced, as [ ].</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className={styles.band}>
        <span>{title}</span>
        <span>{String(count).padStart(2, "0")}</span>
      </h2>
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

function Row({ shot, project, mark }: { shot: Shot; project: Project; mark: React.ReactNode }) {
  const exposed = shot.status === "exposed";
  return (
    <li>
      <Link href={`/shot?id=${project.id}&shot=${shot.id}`} className={styles.row}>
        <span className={styles.no}>{mark}</span>
        <span className={styles.size}>{shot.size}</span>
        <span className={styles.stack}>
          <span className={exposed ? styles.subjectDone : styles.subject}>{shot.subject}</span>
          {shot.flagNote && <span className={styles.flag}>! {shot.flagNote.toUpperCase()}</span>}
        </span>
        <StatusMark exposed={exposed} />
      </Link>
    </li>
  );
}

export default function DayPage() {
  return (
    <Suspense>
      <DayRecord />
    </Suspense>
  );
}
