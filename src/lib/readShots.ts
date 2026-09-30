import type { ReadResult, ReadShot } from "./read";
import { multiPerson, peopleFromNames } from "./cast";
import { addLocation, addShot } from "./shots";
import { DIRECTIONS, suggestAngle, suggestRoll } from "./suggest";
import type { Id, Project, ShotSize, ShotView } from "./types";
import { capitalise } from "./words";

/**
 * Turning an online read into shots (M6). Each read shot gets a stable id
 * from the read's hash and its position, so reading the same brief again
 * never duplicates what's already on the list.
 */

/** A read shot as the app uses it: sizes and tags current, direction checked. */
export type TidyShot = Omit<ReadShot, "size" | "view"> & { size: ShotSize; view?: ShotView };

export interface ReadPick {
  id: string;
  shot: TidyShot;
  client?: string;
  locationId?: Id;
  dayId?: Id;
  /** A location the read suggested that isn't on the project yet; adding the shot creates it. */
  newLocation?: string;
  /** A required shot whose subject is already on the list as required. */
  alreadyOn: boolean;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function place(project: Project, shot: TidyShot, suggested: ReadResult["locations"] = []): { locationId?: Id; dayId?: Id; newLocation?: string } {
  const location = shot.location ? project.locations.find((l) => norm(l.name) === norm(shot.location!)) : undefined;
  if (location) return { locationId: location.id, dayId: location.dayId };
  const dayOf = (index: number | null | undefined) => (project.days.length > 1 && index ? project.days.find((d) => d.index === index)?.id : undefined);
  const suggestion = shot.location ? suggested.find((l) => norm(l.name) === norm(shot.location!)) : undefined;
  if (suggestion) return { newLocation: suggestion.name.trim(), dayId: dayOf(suggestion.day) ?? dayOf(shot.day) };
  return { dayId: dayOf(shot.day) };
}

/**
 * Subjects start with a capital, however the read wrote them. A size of OTS,
 * from a read saved before 29 Sep, is a medium tagged OTS (§5.15). A direction
 * that doesn't start with one of the five is dropped: never guessed.
 */
export function tidy(shot: ReadShot): TidyShot {
  const ots = shot.size === "OTS";
  const direction = shot.direction?.trim().replace(/[.\s]+$/, "");
  const known = direction && DIRECTIONS.some((d) => direction.toLowerCase().startsWith(d));
  return {
    ...shot,
    subject: capitalise(shot.subject.trim()),
    size: ots ? "MS" : (shot.size as ShotSize),
    view: ots ? "ots" : shot.view === "pov" || shot.view === "ots" ? shot.view : undefined,
    direction: known ? `${capitalise(direction)}.` : undefined,
  };
}

/** Everything a read offers, minus what's dropped or already on the list. */
export function readPicks(project: Project, read: { hash: string; result: ReadResult; dropped: string[] }) {
  const onList = new Set(project.shots.map((s) => s.templateId).filter(Boolean));
  const requiredOnList = new Set(project.shots.filter((s) => s.required).map((s) => norm(s.subject)));
  const prefix = `read:${read.hash.slice(0, 12)}`;
  const dropped = new Set(read.dropped.map(norm));

  const required = read.result.deliverables
    .filter((d) => !dropped.has(norm(d.client)))
    .map((d, di) => ({
      client: d.client,
      picks: d.shots
        .map(tidy)
        .map((shot, si): ReadPick => ({
          id: `${prefix}:req:${di}:${si}`,
          shot,
          client: d.client,
          ...place(project, shot, read.result.locations),
          alreadyOn: requiredOnList.has(norm(shot.subject)),
        }))
        .filter((p) => !dropped.has(norm(p.shot.subject)) && !onList.has(p.id)),
    }))
    .filter((d) => d.picks.length > 0);

  const shots = read.result.shots
    .map(tidy)
    .map((shot, i): ReadPick => ({ id: `${prefix}:${i}`, shot, ...place(project, shot, read.result.locations), alreadyOn: false }))
    .filter((p) => !onList.has(p.id));

  return { required, shots };
}

/** Add read shots as shots, keeping the reason line, and marking deliverables [★]. */
export function addReadPicks(project: Project, picks: ReadPick[], now = new Date(), newId = () => crypto.randomUUID()): Project {
  let next = project;
  for (const p of picks) {
    if (p.alreadyOn) continue;
    let locationId = p.locationId;
    if (p.newLocation) {
      // Created by the first shot that needs it; the rest find it by name.
      const made = next.locations.find((l) => norm(l.name) === norm(p.newLocation!) && (next.days.length < 2 || l.dayId === (p.dayId ?? next.days[0]?.id)));
      if (made) locationId = made.id;
      else [next, locationId] = addLocation(next, { name: p.newLocation, dayId: p.dayId }, now, newId);
    }
    const treatment = project.format.treatment;
    // A read cached before 29 Sep has no angle or roll: suggest them, as for a hand-added shot.
    const [q, id] = addShot(
      next,
      {
        size: p.shot.size,
        subject: p.shot.subject,
        locationId,
        dayId: p.dayId,
        beat: p.shot.beat,
        angle: p.shot.angle ?? suggestAngle(p.shot, treatment),
        view: p.shot.view,
        movement: p.shot.movement,
        audio: p.shot.sound,
        roll: p.shot.roll ?? suggestRoll({ ...p.shot, audio: p.shot.sound }, treatment),
        note: p.shot.direction,
        // WHO'S IN IT only matters with more than one person on camera (§5.8).
        people: multiPerson(project.cast) && p.shot.people ? peopleFromNames(project.cast, p.shot.people) : undefined,
      },
      now,
      newId,
    );
    next = {
      ...q,
      shots: q.shots.map((s) =>
        s.id === id ? { ...s, source: "brief" as const, templateId: p.id, reason: p.shot.reason, required: p.client ? { client: p.client } : undefined } : s,
      ),
    };
  }
  return next;
}

/**
 * B10's "replace": clears every shot not yet shot, and keeps the ones that
 * are — exposed shots are a morning's work (§5.6), and dropped ones stay in
 * the day's record (§5.12). The board cleared exposed shots too; the build
 * keeps them (build-journal, 22 Sep).
 */
export function clearUnshot(project: Project, now = new Date()): Project {
  return {
    ...project,
    shots: project.shots.filter((s) => s.status === "exposed" || s.status === "dropped"),
    updatedAt: now.toISOString(),
  };
}
