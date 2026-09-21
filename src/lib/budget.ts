import type { Budget, Day, Delivery, Format, Id, Project, Treatment } from "./types";

/**
 * The shot budget (design.md §5.2): a rough guide to how many planned shots
 * cover a cut of this length. Always a range — a range reads as advice, a
 * number as a target. The figures are reasoned, not measured (§10, 6).
 */

type Preset = Exclude<Delivery, "custom">;

/** Representative running time of each preset, used to interpolate Custom. */
export const PRESET_SECONDS: Record<Preset, number> = {
  reel: 45,
  short: 120,
  mid: 450,
  long: 900,
};

const PRESETS: Preset[] = ["reel", "short", "mid", "long"];

/** Planned shots by treatment and delivery. Silent ≈ 1.5× talking (§5.1). */
export const BUDGET_TABLE: Record<Treatment, Record<Preset, Budget>> = {
  "talking-to-camera": { reel: { min: 12, max: 16 }, short: { min: 20, max: 26 }, mid: { min: 32, max: 42 }, long: { min: 44, max: 58 } },
  silent:              { reel: { min: 18, max: 24 }, short: { min: 30, max: 40 }, mid: { min: 48, max: 64 }, long: { min: 66, max: 88 } },
  interview:           { reel: { min: 10, max: 14 }, short: { min: 18, max: 24 }, mid: { min: 28, max: 36 }, long: { min: 36, max: 48 } },
  narrated:            { reel: { min: 16, max: 22 }, short: { min: 28, max: 36 }, mid: { min: 44, max: 56 }, long: { min: 60, max: 76 } },
  scripted:            { reel: { min: 14, max: 20 }, short: { min: 24, max: 32 }, mid: { min: 40, max: 52 }, long: { min: 56, max: 72 } },
};

/** A custom delivery with no length yet reads as a one-minute cut. */
const CUSTOM_FALLBACK_SECONDS = 60;

export function budget(format: Format): Budget {
  const row = BUDGET_TABLE[format.treatment];
  if (format.delivery !== "custom") return row[format.delivery];
  return interpolate(row, format.lengthSeconds ?? CUSTOM_FALLBACK_SECONDS);
}

/** The project's budget: the person's override if they set one, else the table. */
export function projectBudget(project: Pick<Project, "format" | "budgetOverride">): Budget {
  return project.budgetOverride ?? budget(project.format);
}

/**
 * Custom lengths slide between the columns either side. Shorter than a reel,
 * the reel's range shrinks in proportion to the length (carrying the
 * reel→short rate down would give a 1-second clip 11 shots). Longer than a
 * long cut, the mid→long rate carries on.
 */
function interpolate(row: Record<Preset, Budget>, seconds: number): Budget {
  if (seconds < PRESET_SECONDS.reel) {
    const scale = Math.max(0, seconds) / PRESET_SECONDS.reel;
    const min = Math.max(1, Math.round(row.reel.min * scale));
    return { min, max: Math.max(min, Math.round(row.reel.max * scale)) };
  }

  let i = PRESETS.findIndex((p) => seconds <= PRESET_SECONDS[p]);
  if (i === -1) i = PRESETS.length - 1;
  if (i === 0) i = 1;
  const a = PRESETS[i - 1];
  const b = PRESETS[i];
  const t = (seconds - PRESET_SECONDS[a]) / (PRESET_SECONDS[b] - PRESET_SECONDS[a]);
  const lerp = (x: number, y: number) => x + (y - x) * t;

  const min = Math.max(1, Math.round(lerp(row[a].min, row[b].min)));
  const max = Math.max(min, Math.round(lerp(row[a].max, row[b].max)));
  return { min, max };
}

/**
 * Each day's share of the budget (§5.2, §5.9). Days the person has edited keep
 * their figure; the rest split what's left evenly, earlier days taking the
 * remainder, so the days always sum to the whole.
 */
export function dayBudgets(project: Pick<Project, "format" | "budgetOverride" | "days">): Map<Id, Budget> {
  const whole = projectBudget(project);
  const days = [...project.days].sort((x, y) => x.index - y.index);
  const fixed = days.filter((d) => d.budget);
  const open = days.filter((d) => !d.budget);

  const share = (total: number) => {
    const rest = Math.max(0, total);
    const base = Math.floor(rest / open.length);
    return (i: number) => base + (i < rest % open.length ? 1 : 0);
  };
  const minShare = share(whole.min - sum(fixed, "min"));
  const maxShare = share(whole.max - sum(fixed, "max"));

  const result = new Map<Id, Budget>();
  let openIndex = 0;
  for (const day of days) {
    if (day.budget) {
      result.set(day.id, day.budget);
    } else {
      const min = minShare(openIndex);
      result.set(day.id, { min, max: Math.max(min, maxShare(openIndex)) });
      openIndex++;
    }
  }
  return result;
}

function sum(days: Day[], key: keyof Budget): number {
  return days.reduce((total, d) => total + (d.budget?.[key] ?? 0), 0);
}
