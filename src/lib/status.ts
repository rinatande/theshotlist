import { projectBudget } from "./budget";
import type { Budget, IsoDate, Project } from "./types";

/**
 * Where a project sits on the Projects screen (design.md §8, Projects).
 * Worked out, never stored:
 * - wrapped: every day wrapped
 * - in progress: anything exposed, a day wrapped, or today within its dates
 * - planning: everything else
 */
export type ProjectGroup = "in-progress" | "planning" | "wrapped";

export const GROUPS: { value: ProjectGroup; label: string }[] = [
  { value: "in-progress", label: "IN PROGRESS" },
  { value: "planning", label: "PLANNING" },
  { value: "wrapped", label: "WRAPPED" },
];

export function projectGroup(project: Project, today: IsoDate): ProjectGroup {
  const days = project.days;
  if (days.length > 0 && days.every((d) => d.wrappedAt)) return "wrapped";
  if (project.shots.some((s) => s.status === "exposed")) return "in-progress";
  if (days.some((d) => d.wrappedAt)) return "in-progress";
  const dates = days.map((d) => d.date).filter((d): d is IsoDate => !!d).sort();
  if (dates.length && dates[0] <= today && today <= dates[dates.length - 1]) return "in-progress";
  return "planning";
}

export interface Progress {
  exposed: number;
  /** Shots still in play: dropped ones have left the count (§5.12). */
  planned: number;
  budget: Budget;
}

export function progress(project: Project): Progress {
  const live = project.shots.filter((s) => s.status !== "dropped");
  return {
    exposed: live.filter((s) => s.status === "exposed").length,
    planned: live.length,
    budget: projectBudget(project),
  };
}

/**
 * The marker at the right of a project row, most important first. Each one
 * carries its own words, so none relies on colour (§3).
 */
export type Marker =
  | { kind: "wrapped"; text: "[✓]" }
  | { kind: "due"; text: string }
  | { kind: "no-list"; text: "! NO LIST" }
  | { kind: "day"; text: string }
  | { kind: "none" };

export function projectMarker(project: Project, today: IsoDate): Marker {
  const group = projectGroup(project, today);
  if (group === "wrapped") return { kind: "wrapped", text: "[✓]" };

  const due = project.shots.filter((s) => s.required && s.status !== "exposed").length;
  if (due > 0) return { kind: "due", text: `★ ${due} DUE` };

  if (project.shots.length === 0) return { kind: "no-list", text: "! NO LIST" };

  if (group === "in-progress" && project.days.length > 1) {
    const ordered = [...project.days].sort((a, b) => a.index - b.index);
    const current = ordered.find((d) => !d.wrappedAt) ?? ordered[ordered.length - 1];
    return { kind: "day", text: `DAY ${current.index}/${ordered.length}` };
  }
  return { kind: "none" };
}

/** Today as an ISO date in the phone's own timezone. */
export function todayIso(now: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
