import { describe, expect, it } from "vitest";
import { buildQuery, clearSearch, hashtag, lookWords, queryFor, QUERY_WORDS, searchUrl, setRefQuery, startSearch, WAITING_KEY, WAITING_MS, waitingSearch } from "./findRef";
import type { ReadResult, ReadShot } from "./read";
import { addReadPicks, readPicks } from "./readShots";
import { updateShot } from "./shots";
import { project, shot } from "./test-helpers";
import type { Brief, NoteRef, Project } from "./types";

const note = (id: string, text: string, tags: NoteRef["tags"]): NoteRef => ({ id, kind: "note", text, tags, addedAt: "2026-10-12T00:00:00.000Z" });
const LOOK = [note("n1", "Slow, soft aesthetic silent video. Warm grade with soft highlights.", ["mood", "grade"])];

/** A project whose brief has been read, with these chips. */
function withRead(chips: { label: string; kind: string }[], extra: Partial<Project> = {}): Project {
  const result: ReadResult = { quoted: chips, inferred: [], deliverables: [], shots: [] };
  const brief: Brief = { id: "b", scope: "project", text: "Coffee morning", read: { hash: "h", text: "Coffee morning", at: "2026-10-12T00:00:00.000Z", model: "m", result, dropped: [] } };
  return project({ briefs: [brief], ...extra });
}

const pour = shot("s3", 0, { size: "MS", subject: "The pour", angle: "surface", note: "Side-on, cup in front. Hands only, no faces." });

class MemoryStore {
  items = new Map<string, string>();
  getItem = (k: string) => this.items.get(k) ?? null;
  setItem = (k: string, v: string) => void this.items.set(k, v);
  removeItem = (k: string) => void this.items.delete(k);
}

describe("the search phrase (§5.17)", () => {
  it("builds S3k's phrase from the shot, the read and the look", () => {
    const p = withRead([{ label: "ESPRESSO", kind: "subject" }], { refs: LOOK, shots: [pour] });
    expect(buildQuery(p, pour)).toBe("espresso pour, medium shot, side on, surface level, warm soft light");
  });

  it("names what the read named, and says how close (Rina, 12 Oct)", () => {
    const flip = shot("f", 0, { size: "INS", subject: "My hand flipping the machine's power switch", note: "Front-on, switch in the middle." });
    expect(buildQuery(project(), { ...flip, searchWords: "Breville Barista Pro power switch" })).toBe("breville barista pro power switch, close up detail, front on");
    // Without the read's words: no owners, but still the size.
    expect(buildQuery(project(), flip)).toBe("hand flipping the machine power switch, close up detail, front on");
  });

  it("says every size in a photo site's words", () => {
    const sized = (size: "WS" | "MS" | "CU" | "INS") => buildQuery(project(), shot("x", 0, { size, subject: "Kettle" }));
    expect([sized("WS"), sized("MS"), sized("CU"), sized("INS")]).toEqual(["kettle, wide shot", "kettle, medium shot", "kettle, close up", "kettle, close up detail"]);
  });

  it("works with no look notes, no direction and no read", () => {
    const plain = shot("s1", 0, { subject: "Empty lane before the crowds", angle: "eye-level", note: "Wait for the shutters." });
    expect(buildQuery(project(), plain)).toBe("empty lane before the crowds, wide shot, eye level");
    expect(buildQuery(project(), shot("s2", 0, { subject: "The pour" }))).toBe("pour, wide shot");
  });

  it("only takes look words from MOOD and GRADE notes, light words with 'light'", () => {
    expect(lookWords({ refs: [note("n", "Warm and golden", ["pace"])] })).toEqual([]);
    expect(buildQuery(project({ refs: [note("n", "Muted, grainy, film.", ["grade"])] }), pour)).toBe("pour, medium shot, side on, surface level, muted grainy film");
    expect(lookWords({ refs: [note("n", "warm cool golden soft hard", ["mood"])] })).toHaveLength(3);
  });

  it("adds context only for a short subject that doesn't already say it", () => {
    const p = withRead([{ label: "Coffee", kind: "work" }]);
    expect(buildQuery(p, shot("a", 0, { subject: "Coffee pour" }))).toBe("coffee pour, wide shot");
    expect(buildQuery(p, shot("b", 0, { subject: "Beans into the grinder" }))).toBe("beans into the grinder, wide shot");
    expect(buildQuery(withRead([{ label: "KYOTO", kind: "place" }]), shot("c", 0, { subject: "The pour" }))).toBe("pour, wide shot");
  });

  it("keeps to about twelve words, dropping look words first, then angle, then direction — never the size", () => {
    const p = project({ refs: LOOK });
    const long = shot("l", 0, { subject: "Barista wiping the steam wand after the rush", angle: "surface", note: "Side-on." });
    const q = buildQuery(p, long);
    expect(q.split(/[s,]+/).filter(Boolean).length).toBeLessThanOrEqual(QUERY_WORDS);
    expect(q).toBe("barista wiping the steam wand after the rush, wide shot, side on");
    expect(buildQuery(p, { ...long, subject: "Barista wiping down the steam wand after the rush" })).toBe("barista wiping down the steam wand after the rush, wide shot");
  });

  it("keeps the read's words on the shot, and drops them when the subject changes", () => {
    const read: ReadShot = { size: "INS", subject: "My hand flipping the machine's power switch", search: " Breville Barista Pro power switch ", reason: "r", beat: "opener", light: "any", movement: "static", sound: "natural", location: null, day: null };
    const p = project();
    const next = addReadPicks(p, readPicks(p, { hash: "h".repeat(20), dropped: [], result: { quoted: [], inferred: [], deliverables: [], shots: [read] } }).shots, new Date(0), () => "n");
    expect(next.shots[0].searchWords).toBe("Breville Barista Pro power switch");
    const same = updateShot(next, "n", { size: "INS", subject: "My hand flipping the machine's power switch" });
    expect(same.shots[0].searchWords).toBe("Breville Barista Pro power switch");
    const changed = updateShot(next, "n", { size: "INS", subject: "My hand on the steam wand" });
    expect(changed.shots[0].searchWords).toBeUndefined();
  });

  it("remembers an edit per shot, and forgets it when cleared", () => {
    const p = project({ shots: [pour] });
    const edited = setRefQuery(p, "s3", "  espresso shot slow motion ");
    expect(queryFor(edited, edited.shots[0])).toBe("espresso shot slow motion");
    const cleared = setRefQuery(edited, "s3", "");
    expect(cleared.shots[0].refQuery).toBeUndefined();
    expect(setRefQuery(p, "s3", buildQuery(p, pour))).toBe(p);
  });
});

describe("where to search (§5.17)", () => {
  it("encodes the phrase", () => {
    expect(searchUrl("pinterest", "espresso pour, warm & soft", "")).toBe("https://www.pinterest.com/search/pins/?q=espresso%20pour%2C%20warm%20%26%20soft");
    expect(searchUrl("youtube", " café  latte ", "")).toBe("https://www.youtube.com/results?search_query=caf%C3%A9%20latte");
    expect(searchUrl("pinterest", "   ", "")).toBeUndefined();
  });

  it("makes one clean hashtag from what it's of", () => {
    expect(hashtag(withRead([{ label: "ESPRESSO", kind: "subject" }]), { subject: "The pour" })).toBe("espressopour");
    expect(hashtag(project(), { subject: "My hand", searchWords: "Breville Barista Pro power switch" })).toBe("brevillebarista");
    expect(hashtag(project(), { subject: "Empty lane before the crowds" })).toBe("emptylane");
    expect(hashtag(project(), { subject: "Café crème — the pour!" })).toBe("cafecreme");
    expect(hashtag(project(), { subject: "Into the" })).toBe("");
    expect(searchUrl("instagram", "anything", "emptylane")).toBe("https://www.instagram.com/explore/tags/emptylane/");
    expect(searchUrl("instagram", "anything", "")).toBeUndefined();
  });
});

describe("the waiting search (§5.17)", () => {
  const start = new Date("2026-10-12T09:00:00Z");
  const later = (ms: number) => new Date(start.getTime() + ms);

  it("waits for an hour, then clears itself", () => {
    const store = new MemoryStore();
    startSearch(store, "p", "s3", start);
    expect(waitingSearch(store, later(59 * 60 * 1000))).toEqual({ projectId: "p", shotId: "s3", startedAt: start.toISOString() });
    expect(waitingSearch(store, later(WAITING_MS))).toBeUndefined();
    expect(store.items.has(WAITING_KEY)).toBe(false);
  });

  it("clears on add or cancel, and ignores anything damaged", () => {
    const store = new MemoryStore();
    startSearch(store, "p", "s3", start);
    clearSearch(store);
    expect(waitingSearch(store, start)).toBeUndefined();
    store.setItem(WAITING_KEY, "{not json");
    expect(waitingSearch(store, start)).toBeUndefined();
    expect(store.items.has(WAITING_KEY)).toBe(false);
  });

  it("copes with storage that throws", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => startSearch(blocked, "p", "s3")).not.toThrow();
    expect(waitingSearch(blocked)).toBeUndefined();
  });
});
