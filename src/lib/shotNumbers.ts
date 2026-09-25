import { runningOrder, shotDayId } from "./runningOrder";
import type { Id, Location, Project, Shot } from "./types";

/**
 * Shot numbers, derived from the running order and never stored — a number
 * is a position, not an identity (design.md §5.10).
 *
 * - One sequence for the whole project, continuous across days.
 * - Within a day: located shots in running order, then that day's UNPLACED.
 * - Shots on no day come after the last day.
 * - Required [★] shots are numbered like any other: they sit in the running
 *   order, and the star is a callout beside the number (Rina, 25 Sep; §5.7).
 * - Dropped shots keep their number: they stay in the day's record, struck
 *   through, and un-dropping one shouldn't renumber the list.
 */
export function shotNumbers(project: Pick<Project, "locations" | "days" | "shots">): Map<Id, number> {
  const numbers = new Map<Id, number>();
  let next = 1;
  for (const shot of numberedOrder(project)) numbers.set(shot.id, next++);
  return numbers;
}

/** "07", as the boards write it. */
export function formatShotNumber(n: number): string {
  return String(n).padStart(2, "0");
}

function numberedOrder(project: Pick<Project, "locations" | "days" | "shots">): Shot[] {
  const locationsById = new Map(project.locations.map((l) => [l.id, l]));
  const shots = project.shots;
  const byOrder = (a: Shot, b: Shot) => a.order - b.order;

  const days = [...project.days].sort((a, b) => a.index - b.index);
  const dayIds = new Set(days.map((d) => d.id));
  const dayOf = (s: Shot) => {
    const d = shotDayId(s, locationsById);
    return d !== undefined && dayIds.has(d) ? d : undefined;
  };

  const located = (locations: Location[], pool: Shot[]) =>
    locations.flatMap((l) => pool.filter((s) => s.locationId === l.id).sort(byOrder));
  const unplaced = (pool: Shot[]) =>
    pool.filter((s) => !s.locationId || !locationsById.has(s.locationId)).sort(byOrder);

  const ordered: Shot[] = [];
  for (const day of days) {
    const pool = shots.filter((s) => dayOf(s) === day.id);
    ordered.push(...located(runningOrder(project, day.id), pool), ...unplaced(pool));
  }

  // No day: single-day projects, and anything not attached to a real day.
  const loose = shots.filter((s) => dayOf(s) === undefined);
  const looseLocations = runningOrder(project).filter((l) => l.dayId === undefined || !dayIds.has(l.dayId));
  ordered.push(...located(looseLocations, loose), ...unplaced(loose));

  return ordered;
}
