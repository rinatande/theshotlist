import { clockIn, dateIn, sunTimes, type SunTimes } from "./sun";
import { formatClock, type TimeFormat } from "./timeFormat";
import type { ClockMinutes, Coords, Id, IsoDate, Location, Project } from "./types";

/**
 * The LIGHT boxes (E1, E3): what the sun is doing, said plainly (§5.10).
 * Every function returns undefined when there's nothing honest to say — the
 * box is then absent, never an error (§5.10, "Where the sun times come from").
 */

/** Which coordinates apply to a location: its own, else the project's. */
export function coordsFor(project: Pick<Project, "coords">, location?: Pick<Location, "coords">): Coords | undefined {
  return location?.coords ?? project.coords;
}

/** The date a location is shot on: its day's, else the project's start. */
export function dateFor(project: Pick<Project, "days" | "startDate">, dayId?: Id): IsoDate | undefined {
  return project.days.find((d) => d.id === dayId)?.date ?? project.startDate;
}

export function sunFor(project: Project, location?: Pick<Location, "coords" | "dayId">): SunTimes | undefined {
  const coords = coordsFor(project, location);
  const date = dateFor(project, location?.dayId);
  if (!coords || !date) return undefined;
  return sunTimes(date, coords);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "19 Sep" — sentence case, since these are sentences. */
const inText = (date: IsoDate) => {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

const mins = (n: number) => (n === 1 ? "1 minute" : `${n} minutes`);

/**
 * E1: "Sunrise is 6:02 at Headland on 19 Sep and golden hour holds to about
 * 6:45. A 6:10 start gives you 35 minutes of it."
 */
export function startTimeLight(
  sun: SunTimes,
  place: string,
  date: IsoDate,
  start: ClockMinutes | undefined,
  tf: TimeFormat,
): string | undefined {
  const t = (m: number) => formatClock(m, tf);
  const { sunrise, sunset, goldenMorningEnd: gm, goldenEveningStart: ge } = sun;
  if (sunrise === undefined || sunset === undefined) return undefined;
  const at = `at ${place} on ${inText(date)}`;

  if (start !== undefined && gm !== undefined && start < gm && start >= sunrise - 30) {
    const lead = `Sunrise is ${t(sunrise)} ${at} and golden hour holds to about ${t(gm)}.`;
    if (start < sunrise) return `${lead} A ${t(start)} start has you set up ${mins(sunrise - start)} before it.`;
    return `${lead} A ${t(start)} start gives you ${mins(gm - start)} of it.`;
  }
  if (start !== undefined && ge !== undefined && start >= ge - 60) {
    const lead = `Golden hour starts about ${t(ge)} ${at}, and sunset is ${t(sunset)}.`;
    if (start >= sunset) return `Sunset is ${t(sunset)} ${at}. A ${t(start)} start is after it — the light will be gone.`;
    if (start < ge) return `${lead} A ${t(start)} start puts you there ${mins(ge - start)} before it.`;
    return `${lead} A ${t(start)} start gives you ${mins(sunset - start)} of it.`;
  }
  if (start !== undefined && start < sunrise - 30) {
    return `Sunrise is ${t(sunrise)} ${at}. A ${t(start)} start is in the dark.`;
  }
  const day = `Sunrise is ${t(sunrise)} and sunset is ${t(sunset)} ${at}.`;
  return start === undefined ? day : `${day} A ${t(start)} start is in full daylight.`;
}

/**
 * E3: "The headland at 5:40 PM is the last of the good light — sunset is
 * 5:52. Everything after it will be dark." Speaks about the day's last timed
 * location, and only when the light is the story.
 */
export function runningOrderLight(project: Project, dayLocations: Location[], tf: TimeFormat): string | undefined {
  const timed = dayLocations.filter((l) => l.startTime !== undefined);
  const last = timed[timed.length - 1];
  if (!last) return undefined;
  const sun = sunFor(project, dayLocations.find((l) => l.coords) ?? last);
  if (!sun?.sunset || sun.goldenEveningStart === undefined) return undefined;
  const t = (m: number) => formatClock(m, tf);
  const start = last.startTime!;
  if (start >= sun.sunset) return `${last.name} at ${t(start)} is after sunset (${t(sun.sunset)}) — it will be dark.`;
  if (start >= sun.goldenEveningStart - 30)
    return `${last.name} at ${t(start)} is the last of the good light — sunset is ${t(sun.sunset)}. Everything after it will be dark.`;
  return undefined;
}

/**
 * Shoot mode's pinned line (N4): what the sun does next today where you're
 * shooting, and how long until it does — "LIGHT GOES 6:10 PM · 46 MIN".
 * Absent after sunset, or with no place to work from.
 */
export function lightLeft(project: Project, location: Pick<Location, "coords"> | undefined, now: Date, tf: TimeFormat): string | undefined {
  const coords = coordsFor(project, location);
  if (!coords) return undefined;
  const sun = sunTimes(dateIn(now, coords.timeZone), coords);
  const m = clockIn(now, coords.timeZone);
  const left = (d: number) => (d < 60 ? `${d} MIN` : `${Math.floor(d / 60)} H${d % 60 ? ` ${d % 60} MIN` : ""}`);
  if (sun.sunrise !== undefined && m < sun.sunrise) return `SUNRISE ${formatClock(sun.sunrise, tf)} · ${left(sun.sunrise - m)}`;
  if (sun.sunset !== undefined && m < sun.sunset) return `LIGHT GOES ${formatClock(sun.sunset, tf)} · ${left(sun.sunset - m)}`;
  return undefined;
}
