"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { RequiredMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { lightLeft } from "@/lib/light";
import { currentDay, dayCount, dayShots, flagShot, markExposed, shootQueue, skip } from "@/lib/shoot";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { movementLabel, supportLabel } from "@/lib/suggest";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import type { Id, Project, Shot } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import { useNightLock, useNow, useWakeLock } from "@/lib/useShoot";
import styles from "./Shoot.module.css";

/**
 * N4 Shoot mode: night only, one shot at a time, no way to get lost (§8).
 * The queue follows the running order whatever the list's toggle says.
 */
function ShootScreen() {
  const { project, params } = useProject();
  useNightLock();
  useWakeLock();

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  const day = currentDay(project);
  if (!day) return <NotHere href={`/project?id=${project.id}`} label="← SHOT LIST" />;
  return <Shooting key={`${project.id}:${day.id}`} project={project} dayId={day.id} first={params.get("shot")} />;
}

const skipKey = (projectId: Id, dayId: Id) => `tsl-skip-${projectId}-${dayId}`;

function Shooting({ project, dayId, first }: { project: Project; dayId: Id; first: string | null }) {
  const now = useNow();
  const [tf, setTf] = useState<TimeFormat>("12h");
  // Skips last for the visit to this day, so leaving and coming back keeps the queue.
  const [skipped, setSkipped] = useState<Id[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(skipKey(project.id, dayId)) ?? "[]") as Id[];
    } catch {
      return [];
    }
  });
  // SHOOT IT NOW from wrap puts that shot first, once.
  const [front, setFront] = useState<Id | null>(first);
  const [flagging, setFlagging] = useState(false);
  const [said, setSaid] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTf(readTimeFormat()), []);
  useEffect(() => {
    try {
      sessionStorage.setItem(skipKey(project.id, dayId), JSON.stringify(skipped));
    } catch {}
  }, [skipped, project.id, dayId]);

  const numbers = shotNumbers(project);
  const pinned = front ? dayShots(project, dayId).find((s) => s.id === front && s.status !== "exposed" && s.status !== "dropped") : undefined;
  const queue = shootQueue(project, dayId, skipped).filter((s) => s.id !== pinned?.id);
  const line = pinned ? [pinned, ...queue] : queue;
  const current = line[0];
  const next = line.slice(1, 3);
  const count = dayCount(project, dayId);
  const multi = project.days.length > 1;
  const dayIndex = project.days.find((d) => d.id === dayId)!.index;
  const location = current ? project.locations.find((l) => l.id === current.locationId) : undefined;
  const light = lightLeft(project, location, now, tf);
  const flagged = dayShots(project, dayId).filter((s) => s.status === "flagged").length;
  const label = (s: Shot) => (s.required ? `required for ${s.required.client}` : `shot ${formatShotNumber(numbers.get(s.id) ?? 0)}`);

  const save = async (change: (p: Project) => Project) => {
    // Re-read first: a tap here must never undo one made a moment ago.
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(change(latest));
  };

  const gotIt = async () => {
    if (!current) return;
    setFront(null);
    setSaid(`Got ${label(current)}.${next[0] ? ` Now: ${next[0].subject}.` : ""}`);
    await save((p) => markExposed(p, current.id));
  };

  return (
    <div className={`${ui.screen} ${styles.screen}`}>
      <header className={styles.top}>
        <h1 className={styles.mode}>SHOOT MODE{multi ? ` · DAY ${dayIndex}` : ""}</h1>
        <nav className={styles.nav} aria-label="Leave shoot mode">
          <Link href={`/wrap?id=${project.id}`} className={styles.wrap}>
            WRAP
          </Link>
          <Link href={`/project?id=${project.id}`} className={styles.exit}>
            EXIT
          </Link>
        </nav>
      </header>

      <div className={styles.pinned}>
        <div className={styles.where}>
          <span className={styles.place}>
            {current
              ? location
                ? `${location.name.toUpperCase()}${location.startTime !== undefined ? ` · ${formatClock(location.startTime, tf)}` : ""}`
                : "UNPLACED"
              : `DAY ${dayIndex}`}
          </span>
          {light && <span className={styles.light}>{light}</span>}
        </div>
        <p className={styles.counter} aria-label={`${count.exposed} of ${count.total} exposed today`}>
          <span className={styles.got}>{String(count.exposed).padStart(2, "0")}</span>
          <span className={styles.of}>/{String(count.total).padStart(2, "0")}</span>
        </p>
      </div>

      <p className={styles.sr} aria-live="polite">
        {said}
      </p>

      {current ? (
        <>
          <section className={styles.now} aria-labelledby="now">
            <h2 id="now" className={styles.band}>
              NOW
            </h2>
            <div className={styles.shot}>
              <div className={styles.idLine}>
                <span className={styles.size}>{current.size}</span>
                {current.required ? (
                  <span className={styles.required}>
                    <RequiredMark label={`Required for ${current.required.client}`} /> {current.required.client.toUpperCase()}
                  </span>
                ) : (
                  <span className={styles.number}>SHOT {formatShotNumber(numbers.get(current.id) ?? 0)}</span>
                )}
              </div>
              <p className={styles.subject}>{current.subject}</p>
              <Spec shot={current} />
              {current.flagNote && <p className={styles.flag}>! {current.flagNote.toUpperCase()}</p>}
              {(current.note || current.reason) && <p className={styles.why}>{current.note || current.reason}</p>}
            </div>
          </section>

          {next.length > 0 && (
            <section aria-labelledby="next">
              <h2 id="next" className={styles.band}>
                NEXT
              </h2>
              <ul className={styles.next}>
                {next.map((s, i) => {
                  const prev = i === 0 ? current : next[i - 1];
                  const moves = s.locationId !== prev.locationId;
                  const where = project.locations.find((l) => l.id === s.locationId);
                  return (
                    <li key={s.id} className={styles.nextRow}>
                      <span className={styles.nextSize}>{s.size}</span>
                      <span className={styles.nextText}>
                        <span className={styles.nextSubject}>{s.subject}</span>
                        {moves && <span className={styles.nextWhere}>{where ? where.name.toUpperCase() : "UNPLACED"}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.gotIt} onClick={gotIt}>
              [✓] GOT IT
            </button>
            <div className={styles.pair}>
              <button
                type="button"
                className={styles.skip}
                onClick={() => {
                  setFront(null);
                  setSkipped((s) => skip(s, current.id));
                  setSaid(`Skipped. It comes round again at the end.${next[0] ? ` Now: ${next[0].subject}.` : ""}`);
                }}
              >
                SKIP
              </button>
              <button type="button" className={styles.flagButton} onClick={() => setFlagging(true)}>
                FLAG
              </button>
            </div>
          </div>
        </>
      ) : (
        <Through project={project} dayId={dayId} total={count.total} flagged={flagged} />
      )}

      {flagging && current && (
        <FlagSheet
          heading={current.required ? "FLAG THIS SHOT" : `FLAG SHOT ${formatShotNumber(numbers.get(current.id) ?? 0)}`}
          onClose={() => setFlagging(false)}
          onFlag={async (note) => {
            setFlagging(false);
            setFront(null);
            setSaid(`Flagged. Wrap will ask about it.${next[0] ? ` Now: ${next[0].subject}.` : ""}`);
            await save((p) => flagShot(p, current.id, note));
          }}
        />
      )}
    </div>
  );
}

/** Lens, support and movement as chips — what you set the camera to (N4). */
function Spec({ shot }: { shot: Shot }) {
  const chips = [shot.lens?.toUpperCase(), shot.support ? supportLabel(shot.support) : undefined, shot.movement ? movementLabel(shot.movement).toUpperCase() : undefined].filter(
    (c): c is string => !!c,
  );
  if (chips.length === 0) return null;
  return (
    <ul className={styles.chips} aria-label="Spec">
      {chips.map((c) => (
        <li key={c} className={styles.chip}>
          {c}
        </li>
      ))}
    </ul>
  );
}

/** Everything's through: it doesn't jump to wrap — you might want to add one (§5.12). */
function Through({ project, dayId, total, flagged }: { project: Project; dayId: Id; total: number; flagged: number }) {
  const lastLocation = [...dayShots(project, dayId)].reverse().find((s) => s.locationId)?.locationId;
  const add = `/shot/new?id=${project.id}&from=shoot${lastLocation ? `&loc=${lastLocation}` : project.days.length > 1 ? `&day=${dayId}` : ""}`;
  return (
    <div className={styles.through}>
      <p className={styles.throughLead}>{total === 0 ? "Nothing's planned for today yet." : "Everything on today's list is through."}</p>
      {flagged > 0 && (
        <p className={styles.throughLine}>
          {flagged === 1 ? "One is flagged" : `${flagged} are flagged`} — wrap asks what to do about {flagged === 1 ? "it" : "them"}.
        </p>
      )}
      <div className={styles.throughActions}>
        <Link href={`/wrap?id=${project.id}`} className={ui.primary}>
          WRAP
        </Link>
        <Link href={add} className={ui.secondary}>
          + ADD SHOT
        </Link>
      </div>
    </div>
  );
}

/** FLAG asks for a short note, then moves on (§8). */
function FlagSheet({ heading, onClose, onFlag }: { heading: string; onClose: () => void; onFlag: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <BottomSheet title={heading} onClose={onClose}>
      <form
        className={styles.flagForm}
        onSubmit={(e) => {
          e.preventDefault();
          onFlag(note);
        }}
      >
        <div className={ui.field}>
          <label htmlFor="flag-note" className={ui.label}>
            WHAT NEEDS CHECKING?
          </label>
          <input
            id="flag-note"
            className={ui.input}
            value={note}
            maxLength={60}
            placeholder="No coverage yet"
            autoComplete="off"
            onChange={(e) => setNote(e.target.value)}
          />
          <p className={ui.hint}>It shows under the shot as a ! line, and wrap asks what to do about it.</p>
        </div>
        <button type="submit" className={ui.primary}>
          FLAG AND MOVE ON
        </button>
      </form>
    </BottomSheet>
  );
}

export default function ShootPage() {
  return (
    <Suspense>
      <ShootScreen />
    </Suspense>
  );
}
