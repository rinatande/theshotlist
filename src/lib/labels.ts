import { PRESET_SECONDS } from "./budget";
import type { Aspect, Budget, Delivery, Format, Genre, IsoDate, Project, Treatment } from "./types";

/** Words from the boards, verbatim. */

export const GENRES: { value: Genre; label: string }[] = [
  { value: "travel", label: "TRAVEL" },
  { value: "documentary", label: "DOCUMENTARY" },
  { value: "brand", label: "BRAND" },
  { value: "event", label: "EVENT" },
  { value: "tutorial", label: "TUTORIAL" },
  { value: "personal", label: "PERSONAL" },
];

export const TREATMENTS: { value: Treatment; label: string; short: string }[] = [
  { value: "talking-to-camera", label: "TALKING TO CAMERA", short: "TALKING" },
  { value: "silent", label: "SILENT / OBSERVATIONAL", short: "SILENT" },
  { value: "interview", label: "INTERVIEW-LED", short: "INTERVIEW" },
  { value: "narrated", label: "NARRATED (VO)", short: "VO" },
  { value: "scripted", label: "SCRIPTED", short: "SCRIPTED" },
];

export const DELIVERIES: { value: Delivery; label: string; length: string }[] = [
  { value: "reel", label: "REEL 15—60S", length: "REEL" },
  { value: "short", label: "SHORT 1—3 MIN", length: "1—3 MIN" },
  { value: "mid", label: "MID 5—10 MIN", length: "5—10 MIN" },
  { value: "long", label: "LONG 10—20 MIN", length: "10—20 MIN" },
  { value: "custom", label: "CUSTOM", length: "CUSTOM" },
];

export const ASPECTS: Aspect[] = ["9:16", "16:9", "4:5", "1:1"];

const genreLabel = (g: Genre) => GENRES.find((x) => x.value === g)!.label;
const treatmentShort = (t: Treatment) => TREATMENTS.find((x) => x.value === t)!.short;

export function lengthLabel(format: Format): string {
  if (format.delivery !== "custom") return DELIVERIES.find((d) => d.value === format.delivery)!.length;
  const s = format.lengthSeconds ?? 60;
  return s < 120 ? `${s}S` : `${Math.round(s / 60)} MIN`;
}

/** "TRAVEL / SILENT · REEL · 9:16" — one shape everywhere a project is summarised. */
export function formatLine(format: Format): string {
  return `${genreLabel(format.genre)} / ${treatmentShort(format.treatment)} · ${lengthLabel(format)} · ${format.aspect}`;
}

/** "TRAVEL × SILENT", the consequence box's heading. */
export function comboLabel(genre: Genre, treatment: Treatment): string {
  return `${genreLabel(genre)} × ${treatmentShort(treatment)}`;
}

/** Beats each delivery arrives with (§5.2). Custom borrows from the nearest preset. */
const STRUCTURE: Record<Exclude<Delivery, "custom">, string> = {
  reel: "HOOK / BUILD / PAYOFF",
  short: "OPEN / MIDDLE / CLOSE",
  mid: "INTRO / SEGMENTS / OUTRO",
  long: "COLD OPEN / INTRO / CHAPTERS / OUTRO",
};

export function nearestPreset(format: Format): Exclude<Delivery, "custom"> {
  if (format.delivery !== "custom") return format.delivery;
  const s = format.lengthSeconds ?? 60;
  const presets = Object.entries(PRESET_SECONDS) as [Exclude<Delivery, "custom">, number][];
  return presets.reduce((best, cur) => (Math.abs(cur[1] - s) < Math.abs(best[1] - s) ? cur : best))[0];
}

export function structureLabel(format: Format): string {
  return STRUCTURE[nearestPreset(format)];
}

/** "18 — 24", as the boards write a range. */
export function budgetLabel(b: Budget): string {
  return `${b.min} — ${b.max}`;
}


const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function parts(date: IsoDate) {
  const [, m, d] = date.split("-").map(Number);
  return { day: String(d).padStart(2, "0"), month: MONTHS[m - 1] };
}

/** "24 SEP" */
export function shortDate(date: IsoDate): string {
  const { day, month } = parts(date);
  return `${day} ${month}`;
}

/** "18—19 SEP", "30 SEP—02 OCT", "02 OCT" — the span a project's days cover. */
export function dateSpan(project: Pick<Project, "days">): string | undefined {
  const dates = project.days.map((d) => d.date).filter((d): d is IsoDate => !!d).sort();
  if (dates.length === 0) return undefined;
  const first = parts(dates[0]);
  const last = parts(dates[dates.length - 1]);
  if (dates[0] === dates[dates.length - 1]) return shortDate(dates[0]);
  if (first.month === last.month) return `${first.day}—${last.day} ${last.month}`;
  return `${shortDate(dates[0])}—${shortDate(dates[dates.length - 1])}`;
}
