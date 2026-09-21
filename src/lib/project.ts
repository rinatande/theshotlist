import type { Cast, Day, Format, Id, IsoDate, IsoDateTime, Project } from "./types";

export interface NewProjectInput {
  name?: string;
  format: Format;
  startDate?: IsoDate;
  dayCount: number;
  where?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Sep shoot" — the name a project gets when none is typed (§5.1). */
export function defaultProjectName(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} shoot`;
}

/** v0 has no cast screen: every project starts self-shot, "part of it" (§5.8). */
export function defaultCast(): Cast {
  return {
    lead: "me",
    leadMember: { id: "you", name: "You", presence: "part", voice: true },
    supporting: [],
    operatorPresence: "part",
  };
}

/** Day 1…n, dated from the start date when there is one. */
export function makeDays(dayCount: number, startDate: IsoDate | undefined, newId: () => Id): Day[] {
  return Array.from({ length: Math.max(1, dayCount) }, (_, i) => ({
    id: newId(),
    index: i + 1,
    date: startDate ? addDays(startDate, i) : undefined,
  }));
}

export function createProject(
  input: NewProjectInput,
  now: Date = new Date(),
  newId: () => Id = () => crypto.randomUUID(),
): Project {
  const at: IsoDateTime = now.toISOString();
  const name = input.name?.trim() || defaultProjectName(now);
  return {
    id: newId(),
    name,
    format: input.format,
    startDate: input.startDate,
    dayCount: Math.max(1, input.dayCount),
    where: input.where?.trim() || undefined,
    cast: defaultCast(),
    gearIds: [],
    packedIds: [],
    days: makeDays(input.dayCount, input.startDate, newId),
    locations: [],
    shots: [],
    briefs: [],
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * What shortening the shoot does to planned shots (§5.14), for the CHANGES
 * box. Null when nothing moves: then the box doesn't appear.
 */
export interface DayChange {
  from: number;
  to: number;
  removed: number[]; // day indexes that go
  shotCount: number; // shots that move onto day `to`
}

export function dayChange(project: Project, newCount: number): DayChange | null {
  const to = Math.max(1, newCount);
  if (to >= project.dayCount) return null;
  const removed = project.days.filter((d) => d.index > to);
  const removedIds = new Set(removed.map((d) => d.id));
  const locationDay = new Map(project.locations.map((l) => [l.id, l.dayId]));
  const shotCount = project.shots.filter((s) => {
    const dayId = (s.locationId && locationDay.get(s.locationId)) || s.dayId;
    return dayId !== undefined && removedIds.has(dayId);
  }).length;
  if (shotCount === 0) return null;
  return { from: project.dayCount, to, removed: removed.map((d) => d.index).sort((a, b) => a - b), shotCount };
}

/**
 * Apply an edit (§5.14). Nothing is ever deleted by an edit: when days go,
 * their locations and shots move onto the new last day, after what's there.
 * More days adds empty ones. Every day is re-dated from the start date.
 */
export function applyEdit(
  project: Project,
  input: NewProjectInput,
  now: Date = new Date(),
  newId: () => Id = () => crypto.randomUUID(),
): Project {
  const count = Math.max(1, input.dayCount);
  const ordered = [...project.days].sort((a, b) => a.index - b.index);
  const kept = ordered.slice(0, count);
  const extra = makeDays(count, input.startDate, newId).slice(kept.length);
  const days: Day[] = [...kept, ...extra].map((d, i) => ({
    ...d,
    index: i + 1,
    date: input.startDate ? addDays(input.startDate, i) : undefined,
  }));

  const removedIds = new Set(ordered.slice(count).map((d) => d.id));
  const last = days[days.length - 1].id;
  const moveTo = (dayId: Id | undefined) => (dayId !== undefined && removedIds.has(dayId) ? last : dayId);

  // Moved locations and shots go after what the last day already holds.
  const locOffset = Math.max(-1, ...project.locations.filter((l) => l.dayId === last).map((l) => l.order)) + 1;
  const locations = project.locations.map((l) =>
    l.dayId !== undefined && removedIds.has(l.dayId) ? { ...l, dayId: last, order: l.order + locOffset } : l,
  );
  const shotOffset = Math.max(-1, ...project.shots.filter((s) => s.dayId === last && !s.locationId).map((s) => s.order)) + 1;
  const shots = project.shots.map((s) =>
    s.dayId !== undefined && removedIds.has(s.dayId)
      ? { ...s, dayId: moveTo(s.dayId), order: s.locationId ? s.order : s.order + shotOffset }
      : s,
  );

  return {
    ...project,
    name: input.name?.trim() || defaultProjectName(new Date(project.createdAt)),
    format: input.format,
    startDate: input.startDate,
    where: input.where?.trim() || undefined,
    dayCount: count,
    days,
    locations,
    shots,
    updatedAt: now.toISOString(),
  };
}

/** Calendar arithmetic on an ISO date, in UTC so no timezone can shift it. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
