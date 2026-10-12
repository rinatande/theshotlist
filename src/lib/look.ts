import type { FrameRef, Id, IsoDateTime, LinkRef, NoteRef, NoteTag, Project, Ref } from "./types";

/**
 * The look (design.md §5.16): frames, links and notes, one look per project.
 * Pure, so it's tested; the screens and the image store only draw and save.
 * Nothing here is ever sent to the read.
 */

// ─── Times ───────────────────────────────────────────────────────────────────

/** "0:12", "1:12", "1:02:05". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "m:ss" (or "h:mm:ss", or plain seconds) as typed under a frame; undefined if it isn't a time. */
export function parseTime(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[3]) > 59) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** A URL's t= / start=: "40", "72s", "1m12s", "1h2m3s". */
function urlTime(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+s?$/.test(value)) return parseInt(value, 10);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !value) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

// ─── Video links ─────────────────────────────────────────────────────────────

export interface Video {
  site: "youtube" | "instagram" | "other";
  /** YouTube video id, or Instagram's reel / post code. */
  id?: string;
  /** An Instagram handle, when the link carries one (instagram.com/<handle>/reel/…). */
  handle?: string;
  /** The time the link starts at, in seconds. */
  start?: number;
  /** One key per video, however its link was written — what groups refs on the board. */
  key: string;
  /** The link as given, with https:// when it was left off. */
  url: string;
}

const withScheme = (raw: string) => (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);

/** Read a pasted link: which site, which video, and the time it starts at. Undefined if it isn't a link. */
export function parseVideo(raw: string): Video | undefined {
  let u: URL;
  try {
    u = new URL(withScheme(raw));
  } catch {
    return undefined;
  }
  if (!u.hostname.includes(".")) return undefined;
  const host = u.hostname.replace(/^(www|m)\./, "").toLowerCase();
  const url = u.toString();
  const start = urlTime(u.searchParams.get("t")) ?? urlTime(u.searchParams.get("start")) ?? urlTime(u.hash.replace(/^#t=/, "") || null);

  if (host === "youtu.be") {
    const id = u.pathname.split("/")[1];
    if (id) return { site: "youtube", id, start, key: `yt:${id}`, url };
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    if (id) return { site: "youtube", id, start, key: `yt:${id}`, url };
  }
  if (host === "instagram.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const at = parts.findIndex((p) => p === "reel" || p === "reels" || p === "p" || p === "tv");
    if (at >= 0 && parts[at + 1]) {
      const handle = at > 0 ? parts[at - 1] : undefined;
      return { site: "instagram", id: parts[at + 1], handle, start, key: `ig:${parts[at + 1]}`, url };
    }
  }
  return { site: "other", start, key: `url:${host}${u.pathname.replace(/\/$/, "")}`, url };
}

/** The key refs from one video share, or undefined for none. */
export const sourceKey = (raw?: string) => (raw ? parseVideo(raw)?.key : undefined);

/** Where an OPEN button goes: YouTube at the moment (watch?v=ID&t=72s); anything else as given. */
export function openAt(raw: string, at?: number): string {
  const v = parseVideo(raw);
  if (!v) return withScheme(raw);
  if (v.site === "youtube" && v.id) return `https://www.youtube.com/watch?v=${v.id}${at !== undefined ? `&t=${Math.round(at)}s` : ""}`;
  return v.url;
}

/** Instagram can't open at a time, so its button says what it does (§5.16). */
export const opensAtTime = (raw: string) => parseVideo(raw)?.site === "youtube";

export function siteLabel(raw: string): string {
  const site = parseVideo(raw)?.site;
  return site === "youtube" ? "YOUTUBE" : site === "instagram" ? "INSTAGRAM" : "LINK";
}

// ─── Making refs ─────────────────────────────────────────────────────────────

export function makeLink(raw: string, moments: number[], now: Date, id: Id): LinkRef | undefined {
  const v = parseVideo(raw);
  if (!v) return undefined;
  return { id, kind: "link", url: v.url, addedAt: now.toISOString() as IsoDateTime, moments: [...new Set(moments)].sort((a, b) => a - b) };
}

export function makeNote(text: string, tags: NoteTag[], now: Date, id: Id): NoteRef {
  return { id, kind: "note", text: text.trim(), tags, addedAt: now.toISOString() as IsoDateTime };
}

const touch = (p: Project, now: Date): Project => ({ ...p, updatedAt: now.toISOString() });

export function addRefs(p: Project, refs: Ref[], now = new Date()): Project {
  return touch({ ...p, refs: [...(p.refs ?? []), ...refs] }, now);
}

/** What can change on a ref after it's made. */
export type RefPatch = Partial<{ why: string; at: number; source: string; text: string; tags: NoteTag[]; moments: number[]; url: string; title: string; channel: string }>;

export function updateRef(p: Project, id: Id, patch: RefPatch, now = new Date()): Project {
  return touch({ ...p, refs: (p.refs ?? []).map((r) => (r.id === id ? ({ ...r, ...patch, id: r.id, kind: r.kind } as Ref) : r)) }, now);
}

/** Delete a ref, and take it off every shot it was pinned to. The image goes separately (lookImages.ts). */
export function deleteRef(p: Project, id: Id, now = new Date()): Project {
  return touch(
    {
      ...p,
      refs: (p.refs ?? []).filter((r) => r.id !== id),
      shots: p.shots.map((s) => (s.refIds?.includes(id) ? { ...s, refIds: s.refIds.filter((x) => x !== id) } : s)),
    },
    now,
  );
}

// ─── Pins ────────────────────────────────────────────────────────────────────

/** Pin a ref to these shots, keeping any pins it already has (L4: "A ref can sit on more than one shot."). */
export function pinRef(p: Project, refId: Id, shotIds: Id[], now = new Date()): Project {
  const on = new Set(shotIds);
  return touch({ ...p, shots: p.shots.map((s) => (on.has(s.id) && !s.refIds?.includes(refId) ? { ...s, refIds: [...(s.refIds ?? []), refId] } : s)) }, now);
}

export function unpinRef(p: Project, refId: Id, shotId: Id, now = new Date()): Project {
  return touch({ ...p, shots: p.shots.map((s) => (s.id === shotId ? { ...s, refIds: (s.refIds ?? []).filter((x) => x !== refId) } : s)) }, now);
}

/** Set exactly which refs sit on one shot, in order (shot detail's + PIN). */
export function setShotRefs(p: Project, shotId: Id, refIds: Id[], now = new Date()): Project {
  return touch({ ...p, shots: p.shots.map((s) => (s.id === shotId ? { ...s, refIds: refIds.length ? refIds : undefined } : s)) }, now);
}

export function shotsWithRef(p: Pick<Project, "shots">, refId: Id) {
  return p.shots.filter((s) => s.refIds?.includes(refId));
}

/** A shot's refs, in the order they were pinned, skipping any that are gone. */
export function refsForShot(p: Pick<Project, "refs">, shot: { refIds?: Id[] }): Ref[] {
  const byId = new Map((p.refs ?? []).map((r) => [r.id, r]));
  return (shot.refIds ?? []).flatMap((id) => byId.get(id) ?? []);
}

/** "20 REFS · 4 PINNED TO SHOTS" */
export function lookCounts(p: Pick<Project, "refs" | "shots">): { refs: number; pinned: number } {
  const pinned = new Set(p.shots.flatMap((s) => s.refIds ?? []));
  const refs = p.refs ?? [];
  return { refs: refs.length, pinned: refs.filter((r) => pinned.has(r.id)).length };
}

// ─── The board ───────────────────────────────────────────────────────────────

export interface LookGroup {
  /** sourceKey, or "other". */
  key: string;
  /** "FROM @MM_FAVE · INSTAGRAM", "OTHER REFS". */
  label: string;
  /** "4 FRAMES", "3 FRAMES · 2 MOMENTS", "14". */
  count: string;
  /** The video's link, for an OPEN on the band. */
  url?: string;
  refs: Ref[];
}

const refSource = (r: Ref) => (r.kind === "frame" ? r.source : r.kind === "link" ? r.url : undefined);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "S"}`;

/**
 * The board's groups (L1): refs that share a video sit together under a band,
 * the link's moments with its frames. A video with only one ref isn't a group.
 * Groups go newest first; within one, frames by their time in the video. The
 * rest are OTHER REFS, newest first.
 */
export function groupRefs(p: Pick<Project, "refs" | "sourceNames">): LookGroup[] {
  const refs = p.refs ?? [];
  const byKey = new Map<string, Ref[]>();
  for (const r of refs) {
    const key = sourceKey(refSource(r));
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  const newest = (rs: Ref[]) => rs.reduce((t, r) => (r.addedAt > t ? r.addedAt : t), "");
  const grouped = [...byKey].filter(([, rs]) => rs.length > 1);
  const inGroup = new Set(grouped.flatMap(([, rs]) => rs.map((r) => r.id)));

  const groups: LookGroup[] = grouped
    .sort((a, b) => newest(b[1]).localeCompare(newest(a[1])))
    .map(([key, rs]) => {
      const sorted = [...rs].sort((a, b) => (a.kind === "link" ? 1 : 0) - (b.kind === "link" ? 1 : 0) || ((a as FrameRef).at ?? Infinity) - ((b as FrameRef).at ?? Infinity) || a.addedAt.localeCompare(b.addedAt));
      const frames = rs.filter((r) => r.kind === "frame").length;
      const moments = rs.reduce((n, r) => n + (r.kind === "link" ? r.moments.length : 0), 0);
      const url = refSource(rs.find((r) => r.kind === "link") ?? rs[0])!;
      return {
        key,
        label: `FROM ${sourceLabel(p, url, rs)}`,
        count: [frames ? plural(frames, "FRAME") : "", moments ? plural(moments, "MOMENT") : ""].filter(Boolean).join(" · "),
        url,
        refs: sorted,
      };
    });

  const other = refs.filter((r) => !inGroup.has(r.id)).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  if (other.length) groups.push({ key: "other", label: "OTHER REFS", count: String(other.length), refs: other });
  return groups;
}

/**
 * Who a video is from, for a band or FROM line: a name you gave it, a
 * YouTube channel, an Instagram handle in the link — or, failing those,
 * "INSTAGRAM · REEL C9XYZ".
 */
export function sourceLabel(p: Pick<Project, "sourceNames" | "refs">, raw: string, refs: Ref[] = p.refs ?? []): string {
  const v = parseVideo(raw);
  if (!v) return raw.toUpperCase();
  const site = siteLabel(raw);
  const named = p.sourceNames?.[v.key]?.trim();
  if (named) return `${named.toUpperCase()} · ${site}`;
  const link = refs.find((r): r is LinkRef => r.kind === "link" && sourceKey(r.url) === v.key);
  if (link?.channel) return `${link.channel.toUpperCase()} · ${site}`;
  if (v.handle) return `@${v.handle.toUpperCase()} · ${site}`;
  if (v.site === "instagram") return `INSTAGRAM · ${v.id?.toUpperCase().slice(0, 8)}`;
  return site;
}

/** The two-column board (L1): each tile to the shorter column, so it fills like the board draws it. */
export function columns<T>(items: T[], height: (item: T) => number): [T[], T[]] {
  const cols: [T[], T[]] = [[], []];
  const h = [0, 0];
  for (const item of items) {
    const i = h[0] <= h[1] ? 0 : 1;
    cols[i].push(item);
    h[i] += height(item);
  }
  return cols;
}

// ─── Images ──────────────────────────────────────────────────────────────────

export const FULL_EDGE = 1600;
export const THUMB_EDGE = 400;

/** The size an image is stored at: the long edge at most `edge`, never enlarged, aspect kept. */
export function fitSize(width: number, height: number, edge: number): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A tile's height for its width: the image's own aspect, but nothing taller than 4:5 on the board. */
export function tileHeight(width: number, height: number, tileWidth: number): number {
  return Math.round(tileWidth * Math.min(height / width, 5 / 4));
}
