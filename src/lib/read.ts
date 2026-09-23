import { projectBudget } from "./budget";
import { specLine } from "./gear";
import { formatLine } from "./labels";
import { runningOrder } from "./runningOrder";
import type { Audio, BeatRole, Light, Movement, Project, ShotSize } from "./types";

/**
 * The online read (design.md §5.6, M6): what the phone sends, what comes
 * back, and the instructions the model works from. Shared by the route
 * handler and the client, so both agree on the shape.
 *
 * Sent: the brief, and what the model needs to plan against — kind,
 * treatment, length, budget, days, location names and times, and the
 * subjects already on the list. Never the project's name, gear or shots'
 * notes.
 */

export const READ_MODEL = "claude-sonnet-5";

/**
 * How hard the read thinks. At the default, a 64-shot read of a 5–10 minute
 * cut ran past the server's time limit (Rina, 23 Sep); medium is faster and,
 * for writing a list, loses little.
 */
export const READ_EFFORT = "medium" as const;

/** Longest brief the read accepts — three long paragraphs and a pasted client email. */
export const MAX_BRIEF = 6000;

/**
 * Bumped when the read's instructions change what it returns. v2 (23 Sep): the
 * budget became a count to hit — reads made before it came back short, so they
 * run once more instead of being served from the cache.
 */
export const READ_VERSION = 2;

export interface ReadContext {
  format: string;
  treatment: string;
  budget: { min: number; max: number };
  planned: number;
  days: { day: number; date?: string }[];
  locations: { name: string; day?: number; start?: string }[];
  onList: string[];
  onCamera: string;
  /** What the shoot is bringing, as "Sony 85 f/1.8 (lens: 85 · f1.8)" — names and specs, nothing personal (Rina, 23 Sep). */
  gear: string[];
  /** Frame rate the shoot is filmed at, when chosen: 24/25/30 means real time throughout. */
  frameRate?: number | "mixed";
}

export interface ReadRequest {
  brief: string;
  context: ReadContext;
}

export interface ReadShot {
  size: ShotSize;
  subject: string;
  reason: string;
  beat: Exclude<BeatRole, "any">;
  light: Light;
  movement: Movement;
  sound: Audio;
  /** Exactly one of the location names sent, or null. */
  location: string | null;
  /** 1-based day on a multi-day shoot, or null. */
  day: number | null;
}

export interface ReadResult {
  quoted: { label: string; kind: string }[];
  inferred: { label: string; kind: string }[];
  deliverables: { client: string; shots: ReadShot[] }[];
  shots: ReadShot[];
  /**
   * Places it suggests when the project has none yet, so its shots arrive
   * placed rather than in UNPLACED (design.md §10, 23). Absent on reads saved
   * before this existed.
   */
  locations?: { name: string; day: number | null }[];
}

export interface ReadResponse {
  result: ReadResult;
  model: string;
  /** Reads left for this device or invite today, after this one. */
  remaining: number;
}

export type ReadFailure =
  | { reason: "offline" }
  | { reason: "limit"; message: string }
  | { reason: "declined" | "busy" | "error" | "unconfigured"; message: string };

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (m?: number) => (m === undefined ? undefined : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`);

/** What the phone sends besides the brief — the least the model needs to plan well. */
export function readContext(project: Project): ReadContext {
  const multi = project.days.length > 1;
  const dayOf = (id?: string) => project.days.find((d) => d.id === id)?.index;
  return {
    format: formatLine(project.format),
    treatment: project.format.treatment,
    budget: projectBudget(project),
    planned: project.shots.filter((s) => s.status !== "dropped").length,
    days: [...project.days].sort((a, b) => a.index - b.index).map((d) => ({ day: d.index, date: d.date })),
    locations: runningOrder(project).map((l) => ({ name: l.name, day: multi ? dayOf(l.dayId) : undefined, start: clock(l.startTime) })),
    onList: project.shots.filter((s) => s.status !== "dropped").slice(0, 80).map((s) => s.subject),
    onCamera: "the videographer themselves, part of it — hands and body are fine, face optional",
    gear: (project.gear ?? []).map((g) => `${g.name} (${g.specs.category}: ${specLine(g.specs)})`),
    frameRate: project.frameRate,
  };
}

const SHOT_SCHEMA = {
  type: "object",
  properties: {
    size: { type: "string", enum: ["WS", "MS", "CU", "OTS", "INS"] },
    subject: { type: "string" },
    reason: { type: "string" },
    beat: { type: "string", enum: ["opener", "body", "closer"] },
    light: { type: "string", enum: ["any", "sunrise", "golden", "blue", "night", "day"] },
    movement: { type: "string", enum: ["static", "slow-pan", "push-in", "pull-back", "tracking", "follow", "handheld", "reveal"] },
    sound: { type: "string", enum: ["speech", "natural", "none"] },
    location: { type: ["string", "null"] },
    day: { type: ["integer", "null"] },
  },
  required: ["size", "subject", "reason", "beat", "light", "movement", "sound", "location", "day"],
  additionalProperties: false,
} as const;

const CHIP_SCHEMA = {
  type: "object",
  properties: { label: { type: "string" }, kind: { type: "string" } },
  required: ["label", "kind"],
  additionalProperties: false,
} as const;

export const READ_SCHEMA = {
  type: "object",
  properties: {
    quoted: { type: "array", items: CHIP_SCHEMA },
    inferred: { type: "array", items: CHIP_SCHEMA },
    deliverables: {
      type: "array",
      items: {
        type: "object",
        properties: { client: { type: "string" }, shots: { type: "array", items: SHOT_SCHEMA } },
        required: ["client", "shots"],
        additionalProperties: false,
      },
    },
    shots: { type: "array", items: SHOT_SCHEMA },
    locations: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, day: { type: ["integer", "null"] } },
        required: ["name", "day"],
        additionalProperties: false,
      },
    },
  },
  required: ["quoted", "inferred", "deliverables", "shots", "locations"],
  additionalProperties: false,
} as const;

/** Stable instructions — kept byte-identical so the prefix can be cached. */
export const READ_SYSTEM = `You plan shot lists for a solo videographer inside an app called TheShotList. You read the brief they wrote for a shoot and return the list they'll take on the day.

What good looks like:
- Shots specific to this brief, in the order the thing actually happens. Name the real objects and moments ("descaler going into the water tank", not "a detail shot").
- A list one person can shoot alone, with whatever they carry: nothing that needs a crew.
- Every shot has a reason line: one plain sentence, under 25 words, on why it's worth getting or how to get it on the day. Practical and specific — framing, light, timing, what to match it to. Never generic praise like "looks satisfying".
- Subjects are short and start with a capital letter. The person holding the camera is "me" ("Me walking away down the alley", "My hands pouring the beans"), never "the videographer".
- Plain words, not film-set jargon. Say "location", not "setup"; "start time", not "call time".
- Sizes: WS (wide), MS (medium), CU (close-up), OTS (over the shoulder), INS (insert). Beats: opener, body, closer. Light: any, sunrise, golden, blue, night, day.
- Sound: "speech" when someone talks on camera, "natural" when there's no talking but the place's sound is worth recording, "none" only when music or voice-over will cover it entirely. In a silent or observational film, natural sound is the soundtrack — use "natural", not "none".
- Locations. If location names are given, set each shot's "location" to exactly one of those names where it clearly belongs, else null, and return "locations" empty. If none are given, suggest the places this shoot happens in "locations": short names a person would write on their own list ("Kitchen", "Nagi Coffee", "Higashiyama streets"), in the order they'd be shot, and as few as honestly cover it — usually one to four; a shoot in one room is one location. On a multi-day shoot give each its day, else null. Then set every shot's "location" to one of those names.
- Set a shot's "day" to the day number only on a multi-day shoot, else null.
- Gear. If gear is listed, plan only shots that gear can make, and when a piece of it earns a shot, name it in the reason line and say what it buys ("The 85 at f1.8 compresses the flame behind the hands"). Where the kit can't do something the brief wants, rewrite the shot so it can ("No tripod packed — set it on the table edge and hold twenty seconds") rather than dropping it. If no gear is listed, keep every shot possible with just a camera, and make each reason line about why the shot works, not about gear. Gear changes how you shoot a moment, never how many moments you cover.

Chips:
- "quoted": places, times of day, moods, subjects, clients and people exactly as they appear in the brief's own words. Never the project settings — no aspect ratios, lengths, shot counts or treatment names unless the brief itself says them.
- "inferred": judgements about the brief that its words don't say outright (e.g. BRAND DEAL, 3 DELIVERABLES, KITCHEN). Few and honest — none is fine. Labels short and upper case. Never restate the project settings or budget you were given (no PERSONAL PROJECT, BUDGET FULL, SILENT, 9:16): the person chose those and can already see them.

Deliverables: only shots a client or brand explicitly requires, grouped under that client's name. Put them in "deliverables", not in "shots". A personal video usually has none.

Budget: the shot budget is how many shots the edit of this length needs — a count to hit, not a ceiling to stay under. Return the number of shots you're asked for (deliverables count toward it), and never fewer than the minimum you're given. A longer cut doesn't need more topics; it needs coverage. Shoot each moment of the brief several ways — a wide that places it, a medium on the action, close-ups and inserts of the hands and the objects, the detail that shows it worked, a cutaway to the place around it, a way in and a way out — and add the in-between shots an edit leans on: arriving, the light changing, textures, time passing, the room at rest. Every shot must still belong to this brief; never repeat anything already on the list.`;

/** What the read is asked for: the top of the range, and never fewer than the bottom (§5.6). */
export function shotTarget(c: Pick<ReadContext, "budget" | "planned">): { room: number; floor: number } {
  return { room: Math.max(0, c.budget.max - c.planned), floor: Math.max(0, c.budget.min - c.planned) };
}

/** The follow-up when a read comes back short: the missing number, nothing repeated. */
export function topUpPrompt(count: number, floor: number, room: number): string {
  return [
    `You returned ${count} shots, but this cut needs at least ${floor} and ideally ${room}.`,
    `Return the same JSON with ${room - count} more shots in "shots" — new moments from the brief, or new coverage of the ones you planned (another angle, a detail, a way in or out). Don't repeat any shot above.`,
    'Leave "quoted", "inferred", "deliverables" and "locations" empty; only "shots" is used.',
  ].join("\n");
}

/** Adds a top-up's shots to the first read, skipping any it repeated. */
export function mergeTopUp(first: ReadResult, more: ReadResult): ReadResult {
  const seen = new Set([...first.shots, ...first.deliverables.flatMap((d) => d.shots)].map((s) => s.subject.trim().toLowerCase()));
  const extra = more.shots.filter((s) => {
    const k = s.subject.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...first, shots: [...first.shots, ...extra] };
}

/** How the frame rate reads to the model — nothing when it's left to the camera. */
function frameRateLine(fr?: number | "mixed"): string[] {
  if (fr === undefined || fr === "mixed") return [];
  if (fr <= 30) return [`Frame rate: everything at ${fr}fps — real time throughout. No slow motion: don't plan shots around slowing footage down.`];
  return [`Frame rate: shooting at ${fr}fps, so slow motion is available where it earns a shot.`];
}

export function readPrompt(req: ReadRequest): string {
  const c = req.context;
  // Fill to the top of the range (§5.6); the bottom is the floor the read must reach (Rina, 23 Sep).
  const { room, floor } = shotTarget(c);
  return [
    `Project: ${c.format} (treatment: ${c.treatment}).`,
    `Budget: ${c.budget.min}–${c.budget.max} shots for the whole cut. ${c.planned} already planned. Return ${room} shots (deliverables included), and at least ${floor}.`,
    c.days.length > 1 ? `Days: ${c.days.map((d) => `day ${d.day}${d.date ? ` (${d.date})` : ""}`).join(", ")}.` : "One day.",
    c.locations.length ? `Locations: ${c.locations.map((l) => `"${l.name}"${l.day ? ` day ${l.day}` : ""}${l.start ? ` from ${l.start}` : ""}`).join("; ")}.` : "No locations yet.",
    `On camera: ${c.onCamera}.`,
    c.gear?.length ? `Gear coming: ${c.gear.join("; ")}.` : "No gear listed.",
    ...frameRateLine(c.frameRate),
    c.onList.length ? `Already on the list (don't repeat): ${c.onList.map((s) => `"${s}"`).join("; ")}.` : "Nothing on the list yet.",
    "",
    "Brief:",
    req.brief,
  ].join("\n");
}

/**
 * The brief text and the gear, hashed. The screen promises a read "won't run
 * again unless you change the brief or your gear" (§5.6), so nothing else goes
 * in — adding the read's own shots used to change the planned count and buy a
 * second read. Gear and frame rate joined in v1 (Rina, 23 Sep), and READ_VERSION
 * lets a change to the instructions re-run reads they got wrong.
 */
export async function readHash(req: ReadRequest): Promise<string> {
  const gear = [...(req.context.gear ?? [])].sort();
  const frameRate = req.context.frameRate;
  const bytes = new TextEncoder().encode(
    JSON.stringify({ model: READ_MODEL, v: READ_VERSION, brief: req.brief.trim(), ...(gear.length ? { gear } : {}), ...(frameRate !== undefined ? { frameRate } : {}) }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
