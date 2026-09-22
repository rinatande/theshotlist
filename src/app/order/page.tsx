"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Choice } from "@/components/Choice";
import { RequiredMark, StatusMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { shortDate } from "@/lib/labels";
import { runningOrderLight } from "@/lib/light";
import { runningOrder } from "@/lib/runningOrder";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { arrangeShots, dayOfShot, reorderLocations } from "@/lib/shots";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import type { Id, Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import { useReorder } from "@/lib/useReorder";
import { capitalise, inWords } from "@/lib/words";
import styles from "./Order.module.css";

type View = "locations" | "shots";

/** E3 / S7 Running order: one screen, LOCATIONS | SHOTS (§5.13). */
function RunningOrder() {
  const { project, params } = useProject();
  const [view, setView] = useState<View>(params.get("view") === "shots" ? "shots" : "locations");
  const [dayId, setDayId] = useState<Id | undefined>(params.get("day") ?? undefined);
  const [tf, setTf] = useState<TimeFormat>("12h");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTf(readTimeFormat()), []);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;

  const multi = project.days.length > 1;
  const day = multi ? (project.days.find((d) => d.id === dayId) ?? [...project.days].sort((a, b) => a.index - b.index)[0]) : undefined;
  const back = `/project?id=${project.id}`;

  return (
    <div className={ui.screen}>
      <header className={styles.header}>
        <Link href={back} className={ui.backLink}>
          ← DONE
        </Link>
        <h1 className={styles.title}>RUNNING ORDER</h1>
        {day && (
          <p className={styles.day}>
            DAY {day.index}
            {day.date ? ` · ${shortDate(day.date)}` : ""}
          </p>
        )}
      </header>

      <div className={styles.controls}>
        {multi && (
          <Choice
            label="Day"
            hideLabel
            small
            options={[...project.days].sort((a, b) => a.index - b.index).map((d) => ({ value: d.id, label: `DAY ${d.index}` }))}
            value={day?.id}
            onChange={setDayId}
          />
        )}
        <Choice
          label="Reorder"
          hideLabel
          variant="segmented"
          options={[
            { value: "locations", label: "LOCATIONS" },
            { value: "shots", label: "SHOTS" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className={ui.flush}>
        {view === "locations" ? (
          <Locations project={project} dayId={day?.id} tf={tf} />
        ) : (
          <Shots project={project} dayId={day?.id} tf={tf} />
        )}
      </div>

      <div className={`${ui.footer} ${styles.footer}`}>
        {view === "locations" ? (
          <Link href={`/location/new?id=${project.id}${day ? `&day=${day.id}` : ""}&from=order`} className={ui.secondary}>
            + LOCATION
          </Link>
        ) : (
          <Link href={`/shot/new?id=${project.id}`} className={ui.secondary}>
            + ADD SHOT
          </Link>
        )}
        <Link href={back} className={ui.primary}>
          DONE
        </Link>
      </div>
    </div>
  );
}

// ─── Locations (E3) ───────────────────────────────────────────────────────────

function Locations({ project, dayId, tf }: { project: Project; dayId?: Id; tf: TimeFormat }) {
  const ordered = runningOrder(project, dayId);
  const timed = ordered.filter((l) => l.startTime !== undefined);
  const untimed = ordered.filter((l) => l.startTime === undefined);
  const count = (id: Id) => project.shots.filter((s) => s.locationId === id).length;
  const shotTotal = project.shots.filter((s) => (project.days.length > 1 ? dayOfShot(project, s) === dayId : true)).length;
  const byId = new Map(ordered.map((l) => [l.id, l]));

  const drag = useReorder(
    untimed.map((l) => l.id),
    {
      onCommit: (ids) => saveProject(reorderLocations(project, dayId, ids)),
      describe: (ids, id) => `${byId.get(id)?.name} moved to ${ids.indexOf(id) + 1 + timed.length} of ${ordered.length}.`,
    },
  );

  const light = runningOrderLight(project, ordered, tf);
  const meta = (id: Id, time?: number) => {
    const n = count(id);
    return `${time !== undefined ? formatClock(time, tf) : "—"} · ${n === 1 ? "1 SHOT" : `${n} SHOTS`}`;
  };

  if (ordered.length === 0) {
    return <p className={styles.intro}>No locations yet. Add one and the running order starts here.</p>;
  }

  return (
    <>
      <p className={styles.intro}>
        {capitalise(inWords(ordered.length))} {ordered.length === 1 ? "location" : "locations"}, {shotTotal} {shotTotal === 1 ? "shot" : "shots"}. Anything with a start time sorts itself by the
        clock{untimed.length > 1 ? "; drag the rest into the order you'll get to them" : ""}.
      </p>
      <ul className={styles.rows}>
        {timed.map((l) => (
          <li key={l.id} className={styles.row}>
            {/* No handle: the clock decides where a timed location goes. */}
            <span className={styles.handleSpace} aria-hidden="true" />
            <LocationLink project={project} id={l.id} name={l.name} meta={meta(l.id, l.startTime)} />
          </li>
        ))}
      </ul>
      {untimed.length > 0 && (
        <>
          <h2 className={ui.band}>NO TIME SET</h2>
          <ul className={styles.rows}>
            {drag.order.map((id) => {
              const l = byId.get(id)!;
              return (
                <li key={id} ref={drag.rowRef(id)} className={drag.dragging === id ? `${styles.row} ${styles.lifted}` : styles.row}>
                  <button type="button" className={styles.handle} aria-label={`Move ${l.name}. Use the up and down arrow keys.`} {...drag.handleProps(id)}>
                    ⋮⋮
                  </button>
                  <LocationLink project={project} id={id} name={l.name} meta={meta(id)} />
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className={styles.sr} aria-live="polite">
        {drag.announcement}
      </p>
      {light && (
        <div className={`${ui.box} ${styles.box}`}>
          <span className={ui.boxHeading}>LIGHT</span>
          <p className={ui.boxText}>{light}</p>
        </div>
      )}
    </>
  );
}

function LocationLink({ project, id, name, meta }: { project: Project; id: Id; name: string; meta: string }) {
  return (
    <Link href={`/location/edit?id=${project.id}&loc=${id}&from=order`} className={styles.locationLink}>
      <span className={styles.locationText}>
        <span className={styles.locationName}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
      <span aria-hidden="true" className={styles.chevron}>
        ›
      </span>
    </Link>
  );
}

// ─── Shots (S7) ───────────────────────────────────────────────────────────────

const BAND = "band:";

function Shots({ project, dayId, tf }: { project: Project; dayId?: Id; tf: TimeFormat }) {
  const multi = project.days.length > 1;
  const locations = runningOrder(project, multi ? dayId : undefined);
  const locationIds = new Set(project.locations.map((l) => l.id));
  const inDay = project.shots.filter((s) => !s.required && (multi ? dayOfShot(project, s) === dayId : true));
  const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

  // One flat list: each location's band, then its shots; UNPLACED last, always there to drop into.
  const flat: string[] = [];
  for (const l of locations) {
    flat.push(BAND + l.id);
    inDay.filter((s) => s.locationId === l.id).sort(byOrder).forEach((s) => flat.push(s.id));
  }
  flat.push(BAND);
  inDay.filter((s) => !s.locationId || !locationIds.has(s.locationId)).sort(byOrder).forEach((s) => flat.push(s.id));

  const toGroups = (ids: string[]) => {
    const groups = new Map<string, Id[]>();
    let current = "";
    for (const id of ids) {
      if (id.startsWith(BAND)) {
        current = id.slice(BAND.length);
        groups.set(current, []);
      } else groups.get(current)!.push(id);
    }
    return groups;
  };

  const shotsById = new Map(project.shots.map((s) => [s.id, s]));
  const locationsById = new Map(project.locations.map((l) => [l.id, l]));

  const drag = useReorder(flat, {
    fixed: (id) => id.startsWith(BAND),
    minIndex: 1, // nothing goes above the first band
    onCommit: (ids) => saveProject(arrangeShots(project, dayId, toGroups(ids))),
    describe: (ids, id) => {
      const numbers = shotNumbers(arrangeShots(project, dayId, toGroups(ids)));
      const band = [...ids.slice(0, ids.indexOf(id))].reverse().find((x) => x.startsWith(BAND))!.slice(BAND.length);
      return `Now ${formatShotNumber(numbers.get(id) ?? 0)}, at ${band ? locationsById.get(band)?.name : "unplaced"}.`;
    },
  });

  // Numbers follow the order live while dragging (§5.13).
  const preview = drag.order === flat ? project : arrangeShots(project, dayId, toGroups(drag.order));
  const numbers = shotNumbers(preview);

  if (inDay.length === 0) return <p className={styles.intro}>No shots yet. Add some and reorder them here.</p>;

  return (
    <>
      <p className={styles.intro}>
        Drag a shot within its location, or across the band to move it. Numbers follow the order, so moving one renumbers the rest — anything already exposed keeps its mark.
      </p>
      <ul className={styles.rows}>
        {drag.order.map((id) => {
          if (id.startsWith(BAND)) {
            const l = locationsById.get(id.slice(BAND.length));
            return (
              <li key={id} ref={drag.rowRef(id)} className={styles.bandRow}>
                <span>{l ? l.name.toUpperCase() : "UNPLACED"}</span>
                <span>{l?.startTime !== undefined ? formatClock(l.startTime, tf) : ""}</span>
              </li>
            );
          }
          const s = shotsById.get(id)!;
          const exposed = s.status === "exposed";
          return (
            <li key={id} ref={drag.rowRef(id)} className={drag.dragging === id ? `${styles.row} ${styles.lifted}` : styles.row}>
              <button type="button" className={styles.handle} aria-label={`Move ${s.subject}. Use the up and down arrow keys.`} {...drag.handleProps(id)}>
                ⋮⋮
              </button>
              <span className={styles.shot}>
                <span className={styles.no}>{s.required ? <RequiredMark /> : formatShotNumber(numbers.get(id) ?? 0)}</span>
                <span className={styles.size}>{s.size}</span>
                <span className={exposed ? styles.subjectDone : styles.subject}>{s.subject}</span>
                <StatusMark exposed={exposed} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.sr} aria-live="polite">
        {drag.announcement}
      </p>
      <div className={`${ui.box} ${styles.box}`}>
        <span className={ui.boxHeading}>NOTE</span>
        <p className={ui.boxText}>Shooting order, not edit order. Switch the list to BEAT if you want to see how it cuts.</p>
      </div>
    </>
  );
}

export default function OrderPage() {
  return (
    <Suspense>
      <RunningOrder />
    </Suspense>
  );
}
