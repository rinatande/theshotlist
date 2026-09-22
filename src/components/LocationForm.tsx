"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { shortDate } from "@/lib/labels";
import { coordsFor, dateFor, startTimeLight } from "@/lib/light";
import { deviceCoords, lookupPlace } from "@/lib/place";
import { runningOrder } from "@/lib/runningOrder";
import { todayIso } from "@/lib/status";
import { type LocationInput } from "@/lib/shots";
import { round5, sunTimes } from "@/lib/sun";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import type { Location, Project } from "@/lib/types";
import { inWords } from "@/lib/words";
import { Choice } from "./Choice";
import styles from "./LocationForm.module.css";
import { StepHeader } from "./StepHeader";
import ui from "./ui.module.css";

interface Props {
  project: Project;
  /** Editing this location (E2); absent when adding (E1). */
  location?: Location;
  initial: LocationInput;
  cancelHref: string;
  onSubmit: (input: LocationInput) => void;
  onDelete?: () => void;
}

const toTime = (m?: number) => (m === undefined ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : undefined;
};

/** New location (E1) and edit location (E2), §5.10. */
export function LocationForm({ project, location, initial, cancelHref, onSubmit, onDelete }: Props) {
  const [draft, setDraft] = useState<LocationInput>(initial);
  const [tf, setTf] = useState<TimeFormat>("12h");
  const [locating, setLocating] = useState<"idle" | "asking" | "denied">("idle");
  const set = (patch: Partial<LocationInput>) => setDraft((d) => ({ ...d, ...patch }));
  const editing = !!location;
  const multi = project.days.length > 1;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTf(readTimeFormat()), []);

  // With signal, look the place name up on a pause in typing — once per name (§5.10).
  const looked = useRef(new Set<string>());
  useEffect(() => {
    const where = draft.where?.trim();
    if (!where || draft.coords?.source === "device" || draft.coords?.from === where || looked.current.has(where)) return;
    const timer = setTimeout(async () => {
      looked.current.add(where);
      const c = await lookupPlace(where);
      if (c) setDraft((d) => (d.where?.trim() === where ? { ...d, coords: c } : d));
    }, 700);
    return () => clearTimeout(timer);
  }, [draft.where, draft.coords]);

  const coords = draft.coords ?? coordsFor(project);
  // No date on the project yet: speak about today, so the light still helps.
  const date = dateFor(project, multi ? draft.dayId : undefined) ?? todayIso();
  const sun = coords && date ? sunTimes(date, coords) : undefined;
  const place = draft.where?.trim() || (draft.coords?.source === "device" ? "where you are" : project.where) || draft.name.trim() || "this location";
  const light = sun && date ? startTimeLight(sun, place, date, draft.startTime, tf) : undefined;

  const quick = [
    { value: "sunrise", label: "SUNRISE", time: sun?.sunrise !== undefined ? round5(sun.sunrise) : undefined },
    { value: "midday", label: "MIDDAY", time: 12 * 60 },
    { value: "golden", label: "GOLDEN", time: sun?.goldenEveningStart !== undefined ? round5(sun.goldenEveningStart) : undefined },
  ];

  const ready = draft.name.trim().length > 0;

  return (
    <div className={ui.screen}>
      <StepHeader label={editing ? "Edit location" : "New location"} back={{ label: "← CANCEL", href: cancelHref }} />

      <div className={ui.body}>
        <div className={ui.field}>
          <label htmlFor="lname" className={ui.label}>
            NAME
          </label>
          <input id="lname" className={ui.input} type="text" value={draft.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
          <p className={ui.hint}>A place, or what you&apos;re doing there. &ldquo;Breakfast at the ryokan&rdquo; works as well as &ldquo;Headland ridge&rdquo;.</p>
        </div>

        <div className={ui.field}>
          <label htmlFor="lwhere" className={ui.label}>
            WHERE · OPTIONAL
          </label>
          <div className={styles.whereRow}>
            <input
              id="lwhere"
              className={ui.input}
              type="text"
              value={draft.where ?? ""}
              autoComplete="off"
              onChange={(e) => set({ where: e.target.value, coords: draft.coords?.source === "device" ? draft.coords : undefined })}
            />
            <button
              type="button"
              className={styles.current}
              onClick={async () => {
                setLocating("asking");
                const c = await deviceCoords();
                setLocating(c ? "idle" : "denied");
                if (c) set({ coords: c });
              }}
            >
              {locating === "asking" ? "…" : "USE CURRENT"}
            </button>
          </div>
          {draft.coords?.source === "device" && <p className={ui.hint}>Using where you are now for the light.</p>}
          {locating === "denied" && <p className={ui.hint}>Couldn&apos;t get your location. Type a place instead.</p>}
          {!draft.coords && draft.where?.trim() && (
            <p className={ui.hint}>
              {typeof navigator !== "undefined" && !navigator.onLine
                ? "Offline — the light is worked out once this place name is looked up with signal."
                : "Only the place name is looked up, once, to work out the light. Nothing else leaves the phone."}
            </p>
          )}
        </div>

        <div className={ui.field}>
          <label htmlFor="ltime" className={ui.label}>
            START TIME · OPTIONAL
          </label>
          <div className={styles.timeRow}>
            <input
              id="ltime"
              className={`${ui.input} ${styles.time}`}
              type="time"
              value={toTime(draft.startTime)}
              onChange={(e) => set({ startTime: e.target.value ? fromTime(e.target.value) : undefined })}
            />
            <Choice
              label="Quick times"
              hideLabel
              small
              options={quick.map((q) => ({ value: q.value, label: q.label, disabled: q.time === undefined }))}
              value={quick.find((q) => q.time !== undefined && q.time === draft.startTime)?.value}
              onChange={(v) => set({ startTime: quick.find((q) => q.value === v)?.time })}
            />
          </div>
          {editing && draft.startTime !== undefined && (
            <button type="button" className={ui.textLink} onClick={() => set({ startTime: undefined })}>
              CLEAR THE TIME
            </button>
          )}
          <p className={ui.hint}>
            {editing && orderChange(project, location, draft, tf)
              ? orderChange(project, location, draft, tf)
              : "Leave it blank if the day isn't planned to the hour. With a time, the list runs in the order you'll actually shoot."}
          </p>
          {!sun && <p className={ui.hint}>SUNRISE and GOLDEN need a place to work from — type where, or use where you are.</p>}
        </div>

        {light && (
          <div className={ui.box} aria-live="polite">
            <span className={ui.boxHeading}>LIGHT</span>
            <p className={ui.boxText}>{light}</p>
          </div>
        )}

        {multi && (
          <Choice
            label="On which day"
            options={project.days.map((d) => ({ value: d.id, label: `DAY ${d.index}${d.date ? ` · ${shortDate(d.date)}` : ""}` }))}
            value={draft.dayId ?? project.days[0]?.id}
            onChange={(dayId) => set({ dayId })}
            hint={dayHint(project, location, draft)}
          />
        )}

        {editing && <WhatsHere project={project} location={location} />}
      </div>

      <div className={ui.footer}>
        {ready ? (
          <button type="button" className={ui.primary} onClick={() => onSubmit({ ...draft, coords: draft.coords })}>
            {editing ? "SAVE" : "ADD LOCATION"}
          </button>
        ) : (
          <>
            <p className={ui.hint} id="loc-why">
              Give it a name.
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="loc-why">
              {editing ? "SAVE" : "ADD LOCATION"}
            </button>
          </>
        )}
        {editing && (
          // States the consequence in place rather than confirming (§5.10).
          <button type="button" className={styles.delete} onClick={onDelete}>
            {deleteLabel(project, location)}
          </button>
        )}
      </div>
    </div>
  );
}

function WhatsHere({ project, location }: { project: Project; location: Location }) {
  const shots = project.shots.filter((s) => s.locationId === location.id);
  const exposed = shots.filter((s) => s.status === "exposed").length;
  return (
    <div className={styles.here}>
      <span className={ui.label}>WHAT&apos;S HERE</span>
      <span className={styles.hereCount}>
        {shots.length === 1 ? "1 SHOT" : `${shots.length} SHOTS`}
        {exposed > 0 ? ` · ${exposed} EXPOSED` : ""}
      </span>
      <Link href={`/order?id=${project.id}${location.dayId ? `&day=${location.dayId}` : ""}`} className={ui.textLink}>
        RUNNING ORDER ›
      </Link>
    </div>
  );
}

function deleteLabel(project: Project, location: Location): string {
  const n = project.shots.filter((s) => s.locationId === location.id).length;
  if (n === 0) return "DELETE LOCATION";
  return n === 1 ? "DELETE · ITS SHOT MOVES TO UNPLACED" : `DELETE · ITS ${n} SHOTS MOVE TO UNPLACED`;
}

/** "Moving this to 6:20 puts it after the lane in the running order. Nothing else changes." (E2) */
function orderChange(project: Project, location: Location, draft: LocationInput, tf: TimeFormat): string | undefined {
  if (draft.startTime === location.startTime) return undefined;
  const dayId = project.days.length > 1 ? (draft.dayId ?? location.dayId) : undefined;
  const others = runningOrder(project, dayId).filter((l) => l.id !== location.id);
  const moved = { ...location, startTime: draft.startTime, dayId };
  const next = runningOrder({ ...project, locations: [...others, moved] }, dayId);
  const i = next.findIndex((l) => l.id === location.id);
  const before = runningOrder(project, dayId).findIndex((l) => l.id === location.id);
  const what = draft.startTime === undefined ? "Clearing the time" : `Moving this to ${formatClock(draft.startTime, tf)}`;
  if (i === before) return `${what} keeps its place in the running order. Nothing else changes.`;
  const where = i === 0 ? "puts it first" : `puts it after ${next[i - 1].name}`;
  return `${what} ${where} in the running order. Nothing else changes.`;
}

/** "Move it to day 2 and its seven shots go with it." (E2) */
function dayHint(project: Project, location: Location | undefined, draft: LocationInput): string {
  if (location && draft.dayId && draft.dayId !== location.dayId) {
    const n = project.shots.filter((s) => s.locationId === location.id).length;
    const day = project.days.find((d) => d.id === draft.dayId)?.index;
    if (n === 0) return `Move it to day ${day}. It has no shots yet.`;
    return `Move it to day ${day} and its ${n === 1 ? "shot goes" : `${inWords(n)} shots go`} with it.`;
  }
  return "Only shows on a shoot longer than a day — set that when you make the project.";
}

