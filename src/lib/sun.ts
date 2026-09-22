import type { ClockMinutes, Coords, IsoDate } from "./types";

/**
 * Sunrise, sunset and golden hour, calculated on the device (design.md
 * §5.10) with the standard sunrise equation — accurate to a minute or two,
 * which is all a start time needs. No network, no library.
 *
 * Golden hour is taken as the sun below 6° above the horizon.
 */

const RAD = Math.PI / 180;
const J2000 = 2451545;
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;

const toJulian = (ms: number) => ms / MS_PER_DAY + UNIX_EPOCH_JD;
const fromJulian = (j: number) => new Date((j - UNIX_EPOCH_JD) * MS_PER_DAY);

export interface SunInstants {
  sunrise: Date | null; // null: the sun doesn't rise (polar night) or set (midnight sun)
  sunset: Date | null;
  goldenMorningEnd: Date | null;
  goldenEveningStart: Date | null;
}

/** The day's sun events at a place, as instants. */
export function sunInstants(date: IsoDate, lat: number, lng: number): SunInstants {
  const [y, m, d] = date.split("-").map(Number);
  const n = Math.round(toJulian(Date.UTC(y, m - 1, d, 12)) - J2000 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const at = (altitude: number): [Date | null, Date | null] => {
    const cosH = (Math.sin(altitude * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
    if (cosH < -1 || cosH > 1) return [null, null];
    const h = Math.acos(cosH) / RAD / 360;
    return [fromJulian(transit - h), fromJulian(transit + h)];
  };

  const [sunrise, sunset] = at(-0.833);
  const [goldenMorningEnd, goldenEveningStart] = at(6);
  return { sunrise, sunset, goldenMorningEnd, goldenEveningStart };
}

export interface SunTimes {
  sunrise?: ClockMinutes;
  sunset?: ClockMinutes;
  goldenMorningEnd?: ClockMinutes;
  goldenEveningStart?: ClockMinutes;
}

/** The same events as clock times where the place is — "6:02 at Headland". */
export function sunTimes(date: IsoDate, coords: Pick<Coords, "lat" | "lng" | "timeZone">): SunTimes {
  const s = sunInstants(date, coords.lat, coords.lng);
  const clock = (d: Date | null) => (d ? clockIn(d, coords.timeZone) : undefined);
  return {
    sunrise: clock(s.sunrise),
    sunset: clock(s.sunset),
    goldenMorningEnd: clock(s.goldenMorningEnd),
    goldenEveningStart: clock(s.goldenEveningStart),
  };
}

/** Minutes after local midnight in a time zone. */
export function clockIn(instant: Date, timeZone: string): ClockMinutes {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** The calendar date in a time zone, as ISO. */
export function dateIn(instant: Date, timeZone: string): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Round up to the next five minutes, so a quick time always lands inside the light it names. */
export const round5 = (m: ClockMinutes) => Math.ceil(m / 5) * 5;
