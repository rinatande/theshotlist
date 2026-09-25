import { budgetLabel } from "./labels";
import { sunFor } from "./light";
import { runningOrder } from "./runningOrder";
import { currentDay, dayShots } from "./shoot";
import { progress } from "./status";
import { formatClock, type TimeFormat } from "./timeFormat";
import type { Day, Id, IsoDate, Project } from "./types";

/**
 * Home (H1–H4): one card, chosen by the situation. Today's shoot beats a
 * shoot coming up, which beats the project you were last in; with no
 * projects it's the first run. Pure, so it's tested; the screen only draws.
 */

/** A shoot shows as coming up when it's this close; further out, it's LATER. */
export const SOON_DAYS = 14;

export type HomeCase =
  | { kind: "first-run" }
  | { kind: "today"; project: Project; day: Day }
  | { kind: "coming-up"; project: Project; day: Day; date: IsoDate; later: Project[] }
  | { kind: "last-viewed"; project: Project; recent: Project[] };

/** A day's date: its own, else the project's start for day 1. */
export function dayDate(p: Pick<Project, "startDate">, day: Day): IsoDate | undefined {
  return day.date ?? (day.index === 1 ? p.startDate : undefined);
}

/** Whole days from `from` to `to`, both ISO dates. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const at = (d: IsoDate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/**
 * The day a project shoots next and its date — its first day not yet
 * wrapped, as shoot mode uses. A date already past doesn't count: the shoot
 * slipped, or the day was never wrapped, and Home can't say which.
 */
function nextShoot(p: Project, today: IsoDate): { day: Day; date: IsoDate } | undefined {
  const day = currentDay(p);
  const date = day && dayDate(p, day);
  return day && date && date >= today ? { day, date } : undefined;
}

export function homeCase(projects: Project[], today: IsoDate, lastViewedId?: Id): HomeCase {
  if (projects.length === 0) return { kind: "first-run" };

  const dated = projects
    .map((project) => ({ project, next: nextShoot(project, today) }))
    .filter((x): x is { project: Project; next: { day: Day; date: IsoDate } } => !!x.next)
    .sort((a, b) => a.next.date.localeCompare(b.next.date) || a.next.day.index - b.next.day.index);

  const shooting = dated.find((x) => x.next.date === today);
  if (shooting) return { kind: "today", project: shooting.project, day: shooting.next.day };

  const [soon, ...rest] = dated;
  if (soon && daysBetween(today, soon.next.date) <= SOON_DAYS) {
    return { kind: "coming-up", project: soon.project, day: soon.next.day, date: soon.next.date, later: rest.map((x) => x.project) };
  }

  const byRecent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const project = byRecent.find((p) => p.id === lastViewedId) ?? byRecent[0];
  return { kind: "last-viewed", project, recent: byRecent.filter((p) => p.id !== project.id).slice(0, 3) };
}

/** "Morning." until noon, "Afternoon." until six, then "Evening.". */
export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Morning." : h < 18 ? "Afternoon." : "Evening.";
}

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "THURSDAY 24 SEP" */
export function longDate(now: Date): string {
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/** "SAT 26 SEP" */
export function shortWeekdayDate(date: IsoDate): string {
  const d = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "IN 2 DAYS", "TOMORROW". */
export function inDays(today: IsoDate, date: IsoDate): string {
  const n = daysBetween(today, date);
  return n <= 0 ? "TODAY" : n === 1 ? "TOMORROW" : `IN ${n} DAYS`;
}

/** When you were last in a project: "TODAY", "YESTERDAY", "3 DAYS AGO", else the date. */
export function whenViewed(today: IsoDate, viewed: IsoDate): string {
  const n = daysBetween(viewed, today);
  if (n <= 0) return "TODAY";
  if (n === 1) return "YESTERDAY";
  if (n < 7) return `${n} DAYS AGO`;
  return `${+viewed.slice(8, 10)} ${MONTHS[+viewed.slice(5, 7) - 1]}`;
}

export type ReadyKey = "brief" | "list" | "light" | "gear";

export interface ReadyItem {
  key: ReadyKey;
  label: string;
  done: boolean;
  /** The line under it, when there's something to count. */
  detail?: string;
}

/** H3 GETTING READY: four things a shoot needs before you go, read off the project. */
export function gettingReady(p: Project, day: Day, tf: TimeFormat): ReadyItem[] {
  const brief = p.briefs.some((b) => b.scope === "project" && b.text.trim());
  const { planned, budget } = progress(p);
  const first = runningOrder(p, p.days.length > 1 ? day.id : undefined)[0];
  const sun = sunFor(p, { coords: first?.coords, dayId: day.id });
  const packed = p.gear.filter((g) => p.packedIds.includes(g.id)).length;
  const t = (m: number) => formatClock(m, tf);
  return [
    { key: "brief", label: "Brief written", done: brief },
    {
      key: "list",
      label: "List generated",
      done: planned > 0,
      detail: `${planned === 1 ? "1 SHOT" : `${planned} SHOTS`} · BUDGET ${budgetLabel(budget).replace(" — ", "—")}`,
    },
    {
      key: "light",
      label: "Light found",
      done: sun?.sunrise !== undefined && sun.sunset !== undefined,
      detail:
        sun?.sunrise !== undefined && sun.sunset !== undefined
          ? `SUNRISE ${t(sun.sunrise)} · SUNSET ${t(sun.sunset)}`
          : "NEEDS WHERE IT IS",
    },
    {
      key: "gear",
      label: "Gear packed",
      done: p.gear.length > 0 && packed === p.gear.length,
      detail: p.gear.length ? `${packed} OF ${p.gear.length} IN THE BAG` : "NO GEAR CHOSEN",
    },
  ];
}

export interface TodayView {
  /** "Cliff path · 6:20 AM" — the day's first location. */
  firstUp?: string;
  /** "Sunrise 5:58 · goes 6:10 PM" */
  light?: string;
  /** Each client's [★] shots today: how many are still to get, of how many. */
  clients: { client: string; left: number; of: number }[];
  exposed: number;
  total: number;
}

/** H4 SHOOTING TODAY, read off the day. */
export function todayView(p: Project, day: Day, tf: TimeFormat): TodayView {
  const first = runningOrder(p, p.days.length > 1 ? day.id : undefined)[0];
  const sun = sunFor(p, { coords: first?.coords, dayId: day.id });
  const t = (m: number) => formatClock(m, tf);
  const shots = dayShots(p, day.id).filter((s) => s.status !== "dropped");
  const clients = new Map<string, { left: number; of: number }>();
  for (const s of shots) {
    if (!s.required) continue;
    const c = clients.get(s.required.client) ?? { left: 0, of: 0 };
    c.of++;
    if (s.status !== "exposed") c.left++;
    clients.set(s.required.client, c);
  }
  return {
    firstUp: first ? [first.name, first.startTime !== undefined ? t(first.startTime) : undefined].filter(Boolean).join(" · ") : undefined,
    light:
      sun?.sunrise !== undefined && sun.sunset !== undefined ? `Sunrise ${t(sun.sunrise)} · goes ${t(sun.sunset)}` : undefined,
    clients: [...clients].map(([client, c]) => ({ client, ...c })),
    exposed: shots.filter((s) => s.status === "exposed").length,
    total: shots.length,
  };
}
