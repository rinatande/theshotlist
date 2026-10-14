import { projectBrief } from "./brief";
import { DIRECTIONS, splitDirection } from "./suggest";
import type { Angle, Id, Project, Shot, ShotSize } from "./types";

/**
 * Find a ref (design.md §5.17): a search phrase built on the phone from the
 * shot and the look, and links to search for it elsewhere. Nothing is
 * fetched and nothing goes to the read — the searches are only links.
 */

// ─── The phrase ──────────────────────────────────────────────────────────────

/** About as long as a search box wants. Look words go first when it's over. */
export const QUERY_WORDS = 12;

/** Sizes in the words photo sites tag with. "Insert" is set talk; searched, it finds diagrams (Rina, 12 Oct). */
const SIZE_WORDS: Record<ShotSize, string> = {
  WS: "wide shot",
  MS: "medium shot",
  CU: "close up",
  INS: "close up detail",
};

const ANGLE_WORDS: Record<Angle, string> = {
  "top-down": "top down",
  high: "high angle",
  "eye-level": "eye level",
  surface: "surface level",
  low: "low angle",
};

/** Look words, in the order they're used: colour, then quality, then the grade. */
const LIGHT_WORDS = ["warm", "cool", "golden", "soft", "hard", "harsh", "diffused", "dappled", "bright", "dim", "natural"];
const GRADE_WORDS = ["moody", "muted", "dark", "hazy", "grainy", "film", "filmic", "pastel", "faded", "desaturated", "contrasty", "airy", "dreamy", "nostalgic"];
const LOOK_WORDS = [...LIGHT_WORDS, ...GRADE_WORDS];

const ARTICLE = /^(the|a|an)\s+/i;

/** Words that make a hashtag worse: #emptylane, not #emptylanebeforethecrowds. */
const FILLER = new Set(["the", "a", "an", "and", "or", "of", "in", "into", "on", "onto", "at", "to", "from", "with", "by", "for", "before", "after", "over", "under", "through", "out", "up", "down", "off", "its", "their", "her", "his", "my", "our", "your"]);

/** Whose it is means nothing to a search: "my hand", "the machine's switch" → "hand", "machine switch". */
// Spaces, not \b: \b is ASCII-only, so "crème" would lose its "me".
const OWNER = /(^|\s)(me|my|mine|your|our|his|her|their|its)(?=\s|$)/gi;

/** The subject as a search would want it: no leading article, no owners. */
const bare = (subject: string) =>
  subject
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/['’]s(?=\s|$)/gi, "")
    .replace(OWNER, "$1")
    .replace(ARTICLE, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * One word of context from the brief's read, for a subject too short to search
 * on: "The pour" → "coffee pour". Only a subject or work chip, and only when
 * the subject doesn't already say it.
 */
export function contextWord(project: Project, subject: string): string | undefined {
  const words = bare(subject).split(/\s+/).filter(Boolean);
  if (words.length > 2) return undefined;
  const read = projectBrief(project)?.read?.result;
  const chips = [...(read?.quoted ?? []), ...(read?.inferred ?? [])];
  const chip = chips.find((c) => /^(subject|work)$/i.test(c.kind));
  const word = chip?.label.trim().toLowerCase().split(/\s+/)[0];
  if (!word || words.some((w) => w.toLowerCase() === word)) return undefined;
  return word;
}

/** The note's opening direction, as search words: "Side-on, cup in front." → "side on". */
export function directionWords(note: string | undefined): string | undefined {
  if (!note) return undefined;
  const { direction } = splitDirection(note.trim());
  if (!direction) return undefined;
  const d = DIRECTIONS.find((x) => direction.toLowerCase().startsWith(x));
  return d?.replace(/-/g, " ");
}

/** Up to three look words from the look's MOOD and GRADE notes. */
export function lookWords(project: Pick<Project, "refs">, max = 3): string[] {
  const text = (project.refs ?? [])
    .filter((r) => r.kind === "note" && r.tags.some((t) => t === "mood" || t === "grade"))
    .map((r) => (r.kind === "note" ? r.text.toLowerCase() : ""))
    .join(" ");
  const found = new Set(text.match(/[a-z]+/g) ?? []);
  return LOOK_WORDS.filter((w) => found.has(w)).slice(0, max);
}

/** "warm soft light" when they're all about light; grade words stand alone. */
function lookPhrase(words: string[]): string | undefined {
  if (!words.length) return undefined;
  return words.every((w) => LIGHT_WORDS.includes(w)) ? `${words.join(" ")} light` : words.join(" ");
}

/**
 * What the shot is of, for a search. The read's words when it gave some —
 * it names things as the brief does: "breville barista pro power switch" —
 * else the subject, tidied, with a word of context when it's short.
 */
export function searchSubject(project: Project, shot: Pick<Shot, "subject" | "searchWords">): string {
  if (shot.searchWords?.trim()) return shot.searchWords.trim().toLowerCase().replace(/[.!?]+$/, "");
  return [contextWord(project, shot.subject), bare(shot.subject).toLowerCase()].filter(Boolean).join(" ");
}

/**
 * The phrase the sheet opens with: what it's of, the size, direction, angle,
 * look — "breville barista pro power switch, close up detail, front on".
 * Over about twelve words, look words go first, then the angle, then the
 * direction.
 */
export function buildQuery(project: Project, shot: Pick<Shot, "subject" | "searchWords" | "size" | "angle" | "note">): string {
  const subject = searchSubject(project, shot);
  const size = SIZE_WORDS[shot.size];
  let direction = directionWords(shot.note);
  let angle = shot.angle ? ANGLE_WORDS[shot.angle] : undefined;
  let look = lookWords(project);
  const phrase = () => [subject, size, direction, angle, lookPhrase(look)].filter(Boolean).join(", ");
  const words = () => phrase().split(/[\s,]+/).filter(Boolean).length;
  while (look.length && words() > QUERY_WORDS) look = look.slice(0, -1);
  if (words() > QUERY_WORDS) angle = undefined;
  if (words() > QUERY_WORDS) direction = undefined;
  return phrase();
}

/** What the sheet shows: the shot's edited phrase, else the built one. */
export function queryFor(project: Project, shot: Shot): string {
  return shot.refQuery?.trim() || buildQuery(project, shot);
}

/** An edit is kept on the shot; clearing it, or writing the built phrase back, forgets it. */
export function setRefQuery(project: Project, shotId: Id, text: string, now = new Date()): Project {
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) return project;
  const edited = text.trim() && text.trim() !== buildQuery(project, shot) ? text.trim() : undefined;
  if (edited === shot.refQuery) return project;
  return {
    ...project,
    shots: project.shots.map((s) => (s.id === shotId ? { ...s, refQuery: edited } : s)),
    updatedAt: now.toISOString() as Project["updatedAt"],
  };
}

// ─── Where to search ─────────────────────────────────────────────────────────

/** One hashtag from what it's of: "breville barista pro …" → "brevillebarista". Empty when there's nothing to make one from. */
export function hashtag(project: Project, shot: Pick<Shot, "subject" | "searchWords">): string {
  const words = searchSubject(project, shot)
    .split(/\s+/)
    .map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w && !FILLER.has(w));
  return words.slice(0, 2).join("");
}

export type SearchSite = "pinterest" | "youtube" | "instagram";

export const SITES: { site: SearchSite; label: string; hint: string }[] = [
  { site: "pinterest", label: "PINTEREST", hint: "Stills, often graded. Good for light and colour." },
  { site: "youtube", label: "YOUTUBE", hint: "Whole sequences. Note the time when you screenshot." },
  { site: "instagram", label: "INSTAGRAM", hint: "Searches one hashtag" },
];

/** Where a row goes. Instagram has no search link without signing in, so it's a hashtag page. */
export function searchUrl(site: SearchSite, query: string, tag: string): string | undefined {
  const q = encodeURIComponent(query.trim().replace(/\s+/g, " "));
  if (site === "pinterest") return q ? `https://www.pinterest.com/search/pins/?q=${q}` : undefined;
  if (site === "youtube") return q ? `https://www.youtube.com/results?search_query=${q}` : undefined;
  return tag ? `https://www.instagram.com/explore/tags/${tag}/` : undefined;
}

// ─── The waiting search ──────────────────────────────────────────────────────

/**
 * Tapping a row leaves a search waiting, so the screenshot you come back with
 * lands ready to pin to its shot. On this phone only, for an hour.
 */
export interface WaitingSearch {
  projectId: Id;
  shotId: Id;
  startedAt: string;
}

export const WAITING_KEY = "tsl-find-ref";
export const WAITING_MS = 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function startSearch(store: Store, projectId: Id, shotId: Id, now = new Date()) {
  try {
    store.setItem(WAITING_KEY, JSON.stringify({ projectId, shotId, startedAt: now.toISOString() } satisfies WaitingSearch));
  } catch {
    // Storage can be blocked; the screenshot just arrives without its shot.
  }
}

export function clearSearch(store: Store) {
  try {
    store.removeItem(WAITING_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The search still waiting, if it's under an hour old. An old one is cleared on the way. */
export function waitingSearch(store: Store, now = new Date()): WaitingSearch | undefined {
  let raw: string | null = null;
  try {
    raw = store.getItem(WAITING_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    const w = JSON.parse(raw) as WaitingSearch;
    const age = now.getTime() - Date.parse(w.startedAt);
    if (w.projectId && w.shotId && age >= 0 && age < WAITING_MS) return w;
  } catch {
    // Not ours, or damaged: treat as expired.
  }
  clearSearch(store);
  return undefined;
}
