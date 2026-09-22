import templates from "@/data/templates.json";
import { nearestPreset } from "./labels";
import { runningOrder } from "./runningOrder";
import type { BeatRole, Format, Id, Project, Shot, TemplateShot } from "./types";

/**
 * Beats (design.md §5.2, §5.4). Every shot has one, even one added by hand:
 * the app guesses it, the way it does for suggestions. It's a guess — §10 (17).
 */

type Role = Exclude<BeatRole, "any">;
export const ROLES: Role[] = ["opener", "body", "closer"];

const NAMES: Record<ReturnType<typeof nearestPreset>, Record<Role, string>> = {
  reel: { opener: "HOOK", body: "BUILD", closer: "PAYOFF" },
  short: { opener: "OPEN", body: "MIDDLE", closer: "CLOSE" },
  mid: { opener: "INTRO", body: "SEGMENTS", closer: "OUTRO" },
  long: { opener: "COLD OPEN + INTRO", body: "CHAPTERS", closer: "OUTRO" },
};

/** "HOOK — FIRST 3 SEC" on a reel (P3); just the name elsewhere. */
export function beatLabel(format: Format, role: Role): string {
  const preset = nearestPreset(format);
  const name = NAMES[preset][role];
  if (preset !== "reel") return name;
  if (role === "opener") return `${name} — FIRST 3 SEC`;
  if (role === "closer") return `${name} — LAST 8 SEC`;
  return name;
}

const STOP = new Set(["the", "a", "an", "of", "on", "in", "at", "to", "and", "with", "off", "from", "into", "one", "over", "under"]);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** The template whose keywords and subject share the most words with this subject. */
function closestTemplate(subject: string): TemplateShot | undefined {
  const mine = words(subject);
  if (mine.size === 0) return undefined;
  let best: TemplateShot | undefined;
  let bestScore = 0;
  for (const t of templates as TemplateShot[]) {
    const theirs = new Set([...words(t.subject), ...(t.keywords ?? []).map((k) => k.toLowerCase())]);
    let score = 0;
    for (const w of mine) if (theirs.has(w)) score++;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Guess a beat: the closest template's, else by size and place — a wide in the
 * day's first location opens, anything in its last location closes, the rest
 * is body (§5.4).
 */
export function guessBeat(
  shot: Pick<Shot, "subject" | "size" | "locationId">,
  project: Pick<Project, "locations" | "days">,
): Role {
  const template = closestTemplate(shot.subject);
  if (template && template.beat !== "any") return template.beat;

  const location = project.locations.find((l) => l.id === shot.locationId);
  if (!location) return "body";
  const order = runningOrder(project, location.dayId);
  if (order.length > 1 && order[order.length - 1].id === location.id) return "closer";
  if (order[0]?.id === location.id && shot.size === "WS") return "opener";
  return "body";
}

/** A shot's beat for the beat view: stored if it has one, guessed if not. */
export function beatOf(shot: Shot, project: Pick<Project, "locations" | "days">): Role {
  return shot.beat && shot.beat !== "any" ? shot.beat : guessBeat(shot, project);
}

export function shotsByBeat(project: Project): Record<Role, Id[]> {
  const out: Record<Role, Id[]> = { opener: [], body: [], closer: [] };
  for (const s of project.shots) if (!s.required) out[beatOf(s, project)].push(s.id);
  return out;
}
