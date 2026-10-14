import { describe, expect, it } from "vitest";
import { deleteRef, fitSize, formatTime, groupRefs, lookCounts, makeLink, openAt, parseTime, parseVideo, pinRef, refsForShot, sourceLabel, tileHeight, unpinRef } from "./look";
import { readContext } from "./read";
import { deleteShots } from "./shots";
import { project, shot } from "./test-helpers";
import type { FrameRef, Ref } from "./types";

const at = new Date("2026-10-12T00:00:00Z");
const frame = (id: string, extra: Partial<FrameRef> = {}): FrameRef => ({ id, kind: "frame", imageId: `img-${id}`, width: 1080, height: 1920, addedAt: "2026-10-12T00:00:00.000Z", ...extra });

describe("times in a video link (§5.16)", () => {
  it("reads all three formats, and no time", () => {
    expect(parseVideo("youtu.be/abc123?t=40")).toMatchObject({ site: "youtube", id: "abc123", start: 40 });
    expect(parseVideo("https://www.youtube.com/watch?v=abc123&t=72")).toMatchObject({ id: "abc123", start: 72 });
    expect(parseVideo("https://www.youtube.com/watch?v=abc123&t=72s")?.start).toBe(72);
    expect(parseVideo("https://youtube.com/watch?v=abc123&t=1m12s")?.start).toBe(72);
    expect(parseVideo("https://www.youtube.com/watch?v=abc123")?.start).toBeUndefined();
    expect(parseVideo("https://youtube.com/shorts/xyz9")).toMatchObject({ id: "xyz9", key: "yt:xyz9" });
  });

  it("reads an Instagram reel, with or without a handle", () => {
    expect(parseVideo("https://www.instagram.com/reel/C9xYz12/?igsh=abc")).toMatchObject({ site: "instagram", id: "C9xYz12", handle: undefined, key: "ig:C9xYz12" });
    expect(parseVideo("instagram.com/mm_fave/reel/C9xYz12/")).toMatchObject({ handle: "mm_fave", key: "ig:C9xYz12" });
    expect(parseVideo("not a link")).toBeUndefined();
  });

  it("opens YouTube at the moment, and Instagram as it is", () => {
    expect(openAt("youtu.be/abc123?t=40", 72)).toBe("https://www.youtube.com/watch?v=abc123&t=72s");
    expect(openAt("https://www.instagram.com/reel/C9xYz12/", 12)).toBe("https://www.instagram.com/reel/C9xYz12/");
  });

  it("formats and reads m:ss", () => {
    expect(formatTime(12)).toBe("0:12");
    expect(formatTime(72)).toBe("1:12");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(parseTime("0:12")).toBe(12);
    expect(parseTime("1:02:05")).toBe(3725);
    expect(parseTime("40")).toBe(40);
    expect(parseTime("1:75")).toBeUndefined();
    expect(parseTime("")).toBeUndefined();
  });
});

describe("the board (L1)", () => {
  const reel = "https://www.instagram.com/reel/C9xYz12/";
  const yt = "https://youtu.be/abc123";
  const refs: Ref[] = [
    frame("a", { source: reel, at: 12, addedAt: "2026-10-12T01:00:00.000Z" }),
    frame("b", { source: `${reel}?igsh=x`, at: 4, addedAt: "2026-10-12T01:00:01.000Z" }),
    frame("c", { addedAt: "2026-10-12T02:00:00.000Z" }),
    { id: "l", kind: "link", url: `${yt}?t=40`, moments: [40, 72], channel: "Taro's House", addedAt: "2026-10-12T00:30:00.000Z" },
    frame("d", { source: yt, at: 72, addedAt: "2026-10-12T00:31:00.000Z" }),
    frame("e", { source: "https://youtu.be/lonely" }),
  ];

  it("groups refs from one video — the link's moments with its frames — and leaves the rest to OTHER REFS", () => {
    const groups = groupRefs({ refs, sourceNames: { "ig:C9xYz12": "@mm_fave" } });
    expect(groups.map((g) => [g.label, g.count, g.refs.map((r) => r.id)])).toEqual([
      ["FROM @MM_FAVE · INSTAGRAM", "2 FRAMES", ["b", "a"]],
      ["FROM TARO'S HOUSE · YOUTUBE", "1 FRAME · 2 MOMENTS", ["d", "l"]],
      ["OTHER REFS", "2", ["c", "e"]],
    ]);
  });

  it("names an Instagram source without a handle by its code", () => {
    expect(sourceLabel({ refs: [] }, reel)).toBe("INSTAGRAM · C9XYZ12");
    expect(sourceLabel({ refs: [] }, "instagram.com/amon_zip/reel/Q1/")).toBe("@AMON_ZIP · INSTAGRAM");
  });

  it("counts refs and the ones pinned", () => {
    const p = project({ refs, shots: [shot("s1", 0, { refIds: ["a", "c"] }), shot("s2", 1, { refIds: ["a"] })] });
    expect(lookCounts(p)).toEqual({ refs: 6, pinned: 2 });
  });
});

describe("pins", () => {
  it("pins to several shots, unpins one, and keeps the shot's order", () => {
    let p = project({ refs: [frame("a"), frame("b")], shots: [shot("s1", 0, { refIds: ["b"] }), shot("s2", 1)] });
    p = pinRef(p, "a", ["s1", "s2"], at);
    expect(refsForShot(p, p.shots[0]).map((r) => r.id)).toEqual(["b", "a"]);
    p = unpinRef(p, "a", "s2", at);
    expect(p.shots[1].refIds).toEqual([]);
  });

  it("goes when the shot is deleted, and when the ref is", () => {
    const p = project({ refs: [frame("a")], shots: [shot("s1", 0, { refIds: ["a"] }), shot("s2", 1, { refIds: ["a"] })] });
    expect(lookCounts(deleteShots(p, ["s1", "s2"])).pinned).toBe(0);
    expect(deleteRef(p, "a", at).shots.map((s) => s.refIds)).toEqual([[], []]);
  });

  it("only its notes are read — frames, links and why-lines stay on the phone (Rina, 14 Oct)", () => {
    const p = project({
      refs: [
        frame("a", { why: "Backlit by the machine", source: "https://www.instagram.com/reel/C9x/" }),
        makeLink("https://youtu.be/abc123?t=40", [40], at, "l")!,
        { id: "n", kind: "note", text: "Warm grade", tags: ["grade"], addedAt: "x", why: "the colour" },
      ],
      shots: [shot("s1", 0, { refIds: ["a"] })],
    });
    const sent = JSON.stringify(readContext(p));
    expect(sent).toMatch(/Warm grade/);
    expect(sent).not.toMatch(/img-a|Backlit|C9x|abc123|youtu|the colour/);
  });
});

describe("images", () => {
  it("stores the long edge at 1600 and a 400 thumbnail, never enlarging", () => {
    expect(fitSize(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(1080, 1920, 400)).toEqual({ width: 225, height: 400 });
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("crops anything taller than 4:5 on the board", () => {
    expect(tileHeight(1080, 1920, 194)).toBe(243);
    expect(tileHeight(1920, 1080, 194)).toBe(109);
  });

  it("makes a link with its moments in order", () => {
    expect(makeLink("youtu.be/abc?t=40", [72, 40, 40], at, "l")).toMatchObject({ url: "https://youtu.be/abc?t=40", moments: [40, 72] });
  });
});
