import { guessBeat } from "./beats";
import { shotDayId } from "./runningOrder";
import { formatShotNumber, shotNumbers } from "./shotNumbers";
import type { Audio, Id, Location, Movement, Project, Shot, ShotSize, Support } from "./types";

/**
 * Changes to a project's shots and locations, as pure functions: each takes a
 * project and returns the next one. Screens save the result; nothing here
 * touches the database, so all of it is tested.
 */

export interface ShotInput {
  size: ShotSize;
  subject: string;
  lens?: string;
  /** The shoot's gear item behind the lens chip (§6.4); `lens` keeps the focal as text. */
  lensId?: Id;
  support?: Support;
  supportId?: Id;
  movement?: Movement;
  audio?: Audio;
  locationId?: Id;
  /** Only for a shot with no location on a multi-day project. */
  dayId?: Id;
  note?: string;
  /** Set when added from a beat's + ADD; otherwise guessed. */
  beat?: Shot["beat"];
}

const touch = (p: Project, now: Date): Project => ({ ...p, updatedAt: now.toISOString() });

const clean = (s?: string) => s?.trim() || undefined;

/** Next free `order` within a location (or within a day's UNPLACED). */
function nextOrder(p: Project, locationId: Id | undefined, dayId: Id | undefined): number {
  const siblings = p.shots.filter((s) =>
    locationId ? s.locationId === locationId : !s.locationId && s.dayId === dayId,
  );
  return Math.max(-1, ...siblings.map((s) => s.order)) + 1;
}

function dayFor(p: Project, input: Pick<ShotInput, "locationId" | "dayId">): Id | undefined {
  const location = p.locations.find((l) => l.id === input.locationId);
  if (location) return location.dayId;
  if (p.days.length > 1) return input.dayId ?? p.days[0]?.id;
  return undefined;
}

export function addShot(p: Project, input: ShotInput, now = new Date(), newId = () => crypto.randomUUID()): [Project, Id] {
  const locationId = input.locationId && p.locations.some((l) => l.id === input.locationId) ? input.locationId : undefined;
  const dayId = dayFor(p, { ...input, locationId });
  const shot: Shot = {
    id: newId(),
    size: input.size,
    subject: input.subject.trim(),
    lens: clean(input.lens),
    lensId: input.lensId,
    support: input.support,
    supportId: input.supportId,
    movement: input.movement,
    audio: input.audio,
    locationId,
    dayId,
    note: clean(input.note),
    beat: input.beat ?? guessBeat({ subject: input.subject, size: input.size, locationId }, p),
    order: nextOrder(p, locationId, dayId),
    status: "unshot",
    source: "manual",
  };
  return [touch({ ...p, shots: [...p.shots, shot] }, now), shot.id];
}

export function updateShot(p: Project, id: Id, input: ShotInput, now = new Date()): Project {
  return touch(
    {
      ...p,
      shots: p.shots.map((s) => {
        if (s.id !== id) return s;
        const moved = s.locationId !== input.locationId;
        const locationId = input.locationId && p.locations.some((l) => l.id === input.locationId) ? input.locationId : undefined;
        const dayId = dayFor(p, { ...input, locationId });
        return {
          ...s,
          size: input.size,
          subject: input.subject.trim(),
          lens: clean(input.lens),
          lensId: input.lensId,
          support: input.support,
          supportId: input.supportId,
          movement: input.movement,
          audio: input.audio,
          note: clean(input.note),
          locationId,
          dayId,
          // A shot moved to another location goes to the end of it.
          order: moved ? nextOrder(p, locationId, dayId) : s.order,
        };
      }),
    },
    now,
  );
}

/** Tap on the status control (§7): [ ] ↔ [✓]. Exposing a flagged shot settles the flag. */
export function toggleExposed(p: Project, id: Id, now = new Date()): Project {
  return touch(
    {
      ...p,
      shots: p.shots.map((s) =>
        s.id !== id
          ? s
          : s.status === "exposed"
            ? { ...s, status: "unshot" }
            : { ...s, status: "exposed", flagNote: undefined },
      ),
    },
    now,
  );
}

export function clearFlag(p: Project, id: Id, now = new Date()): Project {
  return touch(
    { ...p, shots: p.shots.map((s) => (s.id === id ? { ...s, status: "unshot", flagNote: undefined } : s)) },
    now,
  );
}

/** Same spec, next number (§5.13): the copy goes straight after the original. */
export function duplicateShot(p: Project, id: Id, now = new Date(), newId = () => crypto.randomUUID()): [Project, Id] {
  const original = p.shots.find((s) => s.id === id);
  if (!original) return [p, id];
  const copy: Shot = { ...original, id: newId(), status: "unshot", flagNote: undefined, droppedAt: undefined, order: original.order + 1 };
  const sameGroup = (s: Shot) =>
    original.locationId ? s.locationId === original.locationId : !s.locationId && s.dayId === original.dayId;
  const shots = p.shots.map((s) => (s.id !== id && sameGroup(s) && s.order > original.order ? { ...s, order: s.order + 1 } : s));
  return [touch({ ...p, shots: [...shots, copy] }, now), copy.id];
}

export function deleteShot(p: Project, id: Id, now = new Date()): Project {
  return touch({ ...p, shots: p.shots.filter((s) => s.id !== id) }, now);
}

/** "Shots below move up — 04 becomes 03. Anything already exposed keeps its mark." (S6) */
export function deleteConsequence(p: Project, id: Id): string {
  const numbers = shotNumbers(p);
  const mine = numbers.get(id);
  if (mine === undefined) return "It leaves the list. Nothing else moves.";
  const next = [...numbers.entries()].find(([, n]) => n === mine + 1);
  if (!next) return "It's the last shot, so nothing else moves.";
  return `Shots below move up — ${formatShotNumber(mine + 1)} becomes ${formatShotNumber(mine)}. Anything already exposed keeps its mark.`;
}

/** The number a new shot would get, for "New shot · 07" (S4). */
export function numberIfAdded(p: Project, input: ShotInput): number | undefined {
  const [next, id] = addShot(p, input, new Date(0), () => "__preview__");
  return shotNumbers(next).get(id);
}

// ─── Gaps and duplicates (§8 Add shot) ─────────────────────────────────────────

const GAP_ORDER: ShotSize[] = ["WS", "CU", "INS", "MS", "OTS"];

/**
 * A coverage gap: a size this location has none of yet, other than the one
 * being added (that shot fills its own gap). Only once the location has some
 * shots — on an empty location everything is missing, which says nothing.
 */
export function coverageGap(p: Project, adding: ShotSize, locationId: Id | undefined, exceptId?: Id): ShotSize | undefined {
  if (!locationId) return undefined;
  const here = p.shots.filter((s) => s.id !== exceptId && s.locationId === locationId && s.status !== "dropped");
  if (here.length === 0) return undefined;
  const sizes = new Set([...here.map((s) => s.size), adding]);
  return GAP_ORDER.find((size) => !sizes.has(size));
}

const same = (a?: string, b?: string) => (a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === (b ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** A duplicate matches on size, subject (ignoring case and spacing), location, lens and support. */
export function findDuplicate(p: Project, input: ShotInput, exceptId?: Id): Shot | undefined {
  if (!input.subject.trim()) return undefined;
  return p.shots.find(
    (s) =>
      s.id !== exceptId &&
      s.size === input.size &&
      same(s.subject, input.subject) &&
      (s.locationId ?? "") === (input.locationId ?? "") &&
      same(s.lens, input.lens) &&
      (s.support ?? "") === (input.support ?? ""),
  );
}

// ─── Locations (§5.10) ─────────────────────────────────────────────────────────

export interface LocationInput {
  name: string;
  where?: string;
  startTime?: number;
  dayId?: Id;
  coords?: Location["coords"];
}

export function addLocation(p: Project, input: LocationInput, now = new Date(), newId = () => crypto.randomUUID()): [Project, Id] {
  const dayId = p.days.length > 1 ? (input.dayId ?? p.days[0]?.id) : undefined;
  const order = Math.max(-1, ...p.locations.filter((l) => l.dayId === dayId).map((l) => l.order)) + 1;
  const location: Location = {
    id: newId(),
    name: input.name.trim(),
    where: clean(input.where),
    startTime: input.startTime,
    dayId,
    order,
    coords: input.coords,
  };
  return [touch({ ...p, locations: [...p.locations, location] }, now), location.id];
}

/** Moving a location to another day takes its shots with it (E2). */
export function updateLocation(p: Project, id: Id, input: LocationInput, now = new Date()): Project {
  const before = p.locations.find((l) => l.id === id);
  if (!before) return p;
  const dayId = p.days.length > 1 ? (input.dayId ?? before.dayId) : undefined;
  const movedDay = dayId !== before.dayId;
  const order = movedDay ? Math.max(-1, ...p.locations.filter((l) => l.dayId === dayId).map((l) => l.order)) + 1 : before.order;
  const whereChanged = clean(input.where) !== before.where;
  return touch(
    {
      ...p,
      locations: p.locations.map((l) =>
        l.id === id
          ? {
              ...l,
              name: input.name.trim(),
              where: clean(input.where),
              startTime: input.startTime,
              dayId,
              order,
              // A new place name needs a new lookup, unless the caller brought coords.
              coords: input.coords ?? (whereChanged ? undefined : l.coords),
            }
          : l,
      ),
      shots: movedDay ? p.shots.map((s) => (s.locationId === id ? { ...s, dayId } : s)) : p.shots,
    },
    now,
  );
}

/** Deleting a location never deletes shots: they fall to UNPLACED on its day (§5.10). */
export function deleteLocation(p: Project, id: Id, now = new Date()): Project {
  const location = p.locations.find((l) => l.id === id);
  if (!location) return p;
  // They keep the order they had, after anything already unplaced that day.
  const start = nextOrder(p, undefined, location.dayId);
  const moving = p.shots.filter((s) => s.locationId === id).sort((x, y) => x.order - y.order);
  const newOrder = new Map(moving.map((s, i) => [s.id, start + i]));
  const shots = p.shots.map((s) => (newOrder.has(s.id) ? { ...s, locationId: undefined, dayId: location.dayId, order: newOrder.get(s.id)! } : s));
  return touch({ ...p, locations: p.locations.filter((l) => l.id !== id), shots }, now);
}

// ─── Running order (E3, S7) ────────────────────────────────────────────────────

/**
 * Reorder the untimed locations of one day to match `orderedIds`. Timed
 * locations sort by the clock and aren't draggable, so they're left alone.
 */
export function reorderLocations(p: Project, dayId: Id | undefined, orderedIds: Id[], now = new Date()): Project {
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  return touch(
    {
      ...p,
      locations: p.locations.map((l) => (l.dayId === dayId && l.startTime === undefined && rank.has(l.id) ? { ...l, order: rank.get(l.id)! } : l)),
    },
    now,
  );
}

/**
 * Put shots in the given groups, in the given order: `groups` maps a location
 * id (or "" for that day's UNPLACED) to its shot ids top to bottom (S7).
 */
export function arrangeShots(p: Project, dayId: Id | undefined, groups: Map<string, Id[]>, now = new Date()): Project {
  const placement = new Map<Id, { locationId?: Id; order: number }>();
  for (const [locationId, ids] of groups) ids.forEach((id, order) => placement.set(id, { locationId: locationId || undefined, order }));
  const locationsById = new Map(p.locations.map((l) => [l.id, l]));
  return touch(
    {
      ...p,
      shots: p.shots.map((s) => {
        const place = placement.get(s.id);
        if (!place) return s;
        const newDay = place.locationId ? locationsById.get(place.locationId)?.dayId : dayId;
        return { ...s, locationId: place.locationId, order: place.order, dayId: newDay ?? (p.days.length > 1 ? dayId : undefined) };
      }),
    },
    now,
  );
}

/** Which day a shot is on, for grouping. */
export function dayOfShot(p: Project, s: Shot): Id | undefined {
  return shotDayId(s, new Map(p.locations.map((l) => [l.id, l])));
}

/**
 * Move many shots at once — to a location, or to a day's UNPLACED — in the
 * order they sit on the list now, after whatever is already there. Numbers
 * follow, because a number is a position (§5.10). Built after Rina placed
 * 40 generated shots one at a time (design.md §10, 23).
 */
export function moveShots(p: Project, ids: Id[], target: { locationId?: Id; dayId?: Id }, now = new Date()): Project {
  const location = target.locationId ? p.locations.find((l) => l.id === target.locationId) : undefined;
  if (target.locationId && !location) return p;
  const dayId = p.days.length > 1 ? (location ? location.dayId : (target.dayId ?? p.days[0]?.id)) : undefined;
  const moving = new Set(ids);
  const numbers = shotNumbers(p);
  const rank = (s: Shot) => numbers.get(s.id) ?? Number.MAX_SAFE_INTEGER;
  const picked = p.shots.filter((s) => moving.has(s.id)).sort((a, b) => rank(a) - rank(b) || a.order - b.order);
  const start = nextOrder({ ...p, shots: p.shots.filter((s) => !moving.has(s.id)) }, location?.id, dayId);
  const order = new Map(picked.map((s, i) => [s.id, start + i]));
  return touch(
    { ...p, shots: p.shots.map((s) => (order.has(s.id) ? { ...s, locationId: location?.id, dayId, order: order.get(s.id)! } : s)) },
    now,
  );
}
