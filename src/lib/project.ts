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

/** Calendar arithmetic on an ISO date, in UTC so no timezone can shift it. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
