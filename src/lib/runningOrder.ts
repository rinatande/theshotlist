import type { Id, Location, Project, Shot } from "./types";

/**
 * Locations in shooting order (design.md §5.10): anything with a start time
 * by the clock, then the untimed ones in the order they were dragged into.
 *
 * With a dayId, only that day's locations. Without one, the whole project,
 * day by day, then any location not on a day.
 */
export function runningOrder(project: Pick<Project, "locations" | "days">, dayId?: Id): Location[] {
  if (dayId !== undefined) return sortDay(project.locations.filter((l) => l.dayId === dayId));

  const days = [...project.days].sort((a, b) => a.index - b.index);
  const dayIds = new Set(days.map((d) => d.id));
  return [
    ...days.flatMap((d) => sortDay(project.locations.filter((l) => l.dayId === d.id))),
    ...sortDay(project.locations.filter((l) => l.dayId === undefined || !dayIds.has(l.dayId))),
  ];
}

function sortDay(locations: Location[]): Location[] {
  const timed = locations
    .filter((l) => l.startTime !== undefined)
    .sort((a, b) => a.startTime! - b.startTime! || a.order - b.order);
  const untimed = locations.filter((l) => l.startTime === undefined).sort((a, b) => a.order - b.order);
  return [...timed, ...untimed];
}

/**
 * Which day a shot is on: its location's day if it has one, else its own.
 * On a single-day project there's no day layer and this is undefined.
 */
export function shotDayId(shot: Shot, locationsById: Map<Id, Location>): Id | undefined {
  const location = shot.locationId ? locationsById.get(shot.locationId) : undefined;
  return location?.dayId ?? shot.dayId;
}
