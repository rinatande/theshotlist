import templates from "@/data/templates.json";
import { coverageFor, findActions } from "./actions";
import { dayBudgets, projectBudget } from "./budget";
import { capabilities } from "./capabilities";
import type { QuotedChip } from "./chips";
import { runningOrder } from "./runningOrder";
import { addShot } from "./shots";
import { suggestAudio, suggestMovement } from "./suggest";
import type { Capability, GearItem, Id, Light, Location, Presence, Project, TemplateShot } from "./types";

/**
 * The suggestion engine (design.md §6.2), offline. Templates × format ×
 * packed gear × cast presence × the brief's quoted chips → shots, each with
 * the reason it's there. Pure: it proposes, the screen adds.
 */

export interface Suggestion {
  templateId: string;
  size: TemplateShot["size"];
  subject: string;
  reason: string;
  beat: TemplateShot["beat"];
  light: Light;
  /** Rewritten because a requirement wasn't packed (§6.2 step 4). */
  fallback: boolean;
  locationId?: Id;
  dayId?: Id;
  score: number;
  /** Built from the brief's own actions rather than a template. */
  fromBrief?: boolean;
  /** For placing brief coverage, which has no template to read keywords from. */
  keywords?: string[];
}

export interface SuggestResult {
  suggestions: Suggestion[];
  /** How many the budget has room for: top of the range, less what's planned. */
  room: number;
  /** Templates that would fit if gear were packed, with no gear-free version. */
  withheld: number;
}

const ALL = templates as TemplateShot[];

/** Which presence levels allow what a template needs to see (types.ts PersonNeed). */
function personAllowed(need: TemplateShot["person"], presence: Presence): boolean {
  if (need === "none") return true;
  if (need === "face") return presence === "part" || presence === "subject";
  return presence !== "none"; // body: hands, feet, backs of heads
}

const words = (text: string) => text.toLowerCase();
const mentions = (text: string, keyword: string) =>
  new RegExp(`(^|[^a-z])${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);

export function suggest(
  project: Project,
  opts: { chips?: QuotedChip[]; brief?: string; packed?: GearItem[]; limit?: number } = {},
): SuggestResult {
  const caps = capabilities(opts.packed ?? []);
  const brief = words(opts.brief ?? "");
  const lights = new Set((opts.chips ?? []).map((c) => c.light).filter(Boolean) as Light[]);
  const presence = project.cast.leadMember?.presence ?? (project.cast.lead === "no-one" ? "none" : "part");
  const onList = new Set(project.shots.map((s) => s.templateId).filter(Boolean));

  let withheld = 0;
  const candidates: Suggestion[] = [];
  for (const t of ALL) {
    if (onList.has(t.id)) continue; // never suggest what's already there
    if (t.genres.length && !t.genres.includes(project.format.genre)) continue;
    if (t.treatments.length && !t.treatments.includes(project.format.treatment)) continue;
    if (!personAllowed(t.person, presence)) continue;

    const met = t.requires.every((r) => caps.has(r as Capability));
    if (!met && !t.fallback) {
      withheld++;
      continue;
    }

    // Rank (§6.2 step 2): what the brief says, what the kit unlocks, how specific the template is.
    // What the brief mentions outweighs everything else; with a brief, a template
    // it doesn't touch sinks below the ones it does.
    let score = 0;
    let relevant = false;
    for (const k of t.keywords ?? []) {
      if (brief && mentions(brief, k)) {
        score += 6;
        relevant = true;
      }
    }
    if (t.light !== "any" && lights.has(t.light)) {
      score += 4;
      relevant = true;
    }
    if (brief && !relevant) score -= 3;
    if (met && t.unlockedBy && caps.has(t.unlockedBy)) score += 2;
    if (t.treatments.length) score += 1.5;
    if (t.genres.length) score += 0.5;

    const unlocking = met && t.unlockedBy ? opts.packed?.find((g) => capabilities([g]).has(t.unlockedBy!)) : undefined;
    candidates.push({
      templateId: t.id,
      size: t.size,
      subject: met ? t.subject : t.fallback!.subject,
      reason: met ? t.reason.replace("{item}", unlocking?.name ?? "kit") : t.fallback!.reason,
      beat: t.beat,
      light: t.light,
      fallback: !met,
      score,
    });
  }

  // Fill toward the top of the budget (§5.6), diversifying sizes as we go (§6.2 step 3).
  const planned = project.shots.filter((s) => s.status !== "dropped").length;
  const room = Math.max(0, projectBudget(project).max - planned);
  const limit = opts.limit ?? room;
  const sizeCount = new Map<string, number>();
  for (const s of project.shots) sizeCount.set(s.size, (sizeCount.get(s.size) ?? 0) + 1);
  const chosen: Suggestion[] = [];

  // The brief's own actions go first, in the order they happen: they're the
  // shots only this brief could ask for. Templates fill the rest.
  for (const c of coverageFor(findActions(opts.brief ?? ""))) {
    if (chosen.length >= limit) break;
    if (onList.has(c.id) || !personAllowed(c.person, presence)) continue;
    chosen.push({ templateId: c.id, size: c.size, subject: c.subject, reason: c.reason, beat: c.beat, light: "any", fallback: false, score: 100, fromBrief: true, keywords: c.keywords });
    sizeCount.set(c.size, (sizeCount.get(c.size) ?? 0) + 1);
  }
  const pool = [...candidates];
  while (chosen.length < limit && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      // Each shot of a size already chosen costs more than a template's specificity is worth.
      const s = c.score - 2 * (sizeCount.get(c.size) ?? 0);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    const [pick] = pool.splice(best, 1);
    sizeCount.set(pick.size, (sizeCount.get(pick.size) ?? 0) + 1);
    chosen.push(pick);
  }

  return { suggestions: place(project, chosen), room, withheld };
}

// ─── Placing (§5.6 "What generating builds") ────────────────────────────────

/** A time-of-day template goes to the location whose start time matches its light. */
function byLight(light: Light, timed: Location[]): Location | undefined {
  const t = (l: Location) => l.startTime!;
  switch (light) {
    case "sunrise":
      return timed.find((l) => t(l) < 10 * 60);
    case "golden":
    case "blue":
      return [...timed].reverse().find((l) => t(l) >= 15 * 60);
    case "night":
      return [...timed].reverse().find((l) => t(l) >= 18 * 60);
    case "day":
      return timed.find((l) => t(l) >= 10 * 60 && t(l) < 16 * 60);
    default:
      return undefined;
  }
}

function place(project: Project, chosen: Suggestion[]): Suggestion[] {
  const multi = project.days.length > 1;
  const days = [...project.days].sort((a, b) => a.index - b.index);
  const ordered = runningOrder(project);
  const timed = ordered.filter((l) => l.startTime !== undefined).sort((a, b) => a.startTime! - b.startTime!);
  const template = new Map(ALL.map((t) => [t.id, t]));

  // Unplaced suggestions spread across days in proportion to each day's budget.
  const share = multi ? dayBudgets(project) : new Map<Id, { max: number }>();
  const given = new Map<Id, number>();
  const nextDay = (): Id | undefined => {
    if (!multi) return undefined;
    let best = days[0].id;
    let bestGap = -Infinity;
    for (const d of days) {
      const gap = (share.get(d.id)?.max ?? 0) - (given.get(d.id) ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        best = d.id;
      }
    }
    given.set(best, (given.get(best) ?? 0) + 1);
    return best;
  };

  return chosen.map((s) => {
    const keys = s.keywords ?? template.get(s.templateId)?.keywords ?? [];
    const byWord = ordered.find((l) => keys.some((k) => mentions(words(`${l.name} ${l.where ?? ""}`), k)));
    const location = byLight(s.light, timed) ?? byWord;
    if (location) {
      if (multi && location.dayId) given.set(location.dayId, (given.get(location.dayId) ?? 0) + 1);
      return { ...s, locationId: location.id, dayId: location.dayId };
    }
    return { ...s, dayId: nextDay() };
  });
}

/** Add suggestions to the project as shots, each keeping its reason line. */
export function addSuggestions(
  project: Project,
  picks: Suggestion[],
  source: "template" | "brief" = "template",
  now = new Date(),
  newId = () => crypto.randomUUID(),
): Project {
  let next = project;
  for (const s of picks) {
    const input = { size: s.size, subject: s.subject, locationId: s.locationId, dayId: s.dayId, beat: s.beat === "any" ? undefined : s.beat };
    const [p, id] = addShot(
      next,
      { ...input, movement: suggestMovement(input), audio: suggestAudio(input, project.format.treatment) },
      now,
      newId,
    );
    next = { ...p, shots: p.shots.map((x) => (x.id === id ? { ...x, source, templateId: s.templateId, reason: s.reason } : x)) };
  }
  return next;
}
