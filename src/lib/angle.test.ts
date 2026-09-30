import { describe, expect, it } from "vitest";
import { budget } from "./budget";
import { moveOtsToView } from "./migrate";
import type { ReadShot } from "./read";
import { addReadPicks, readPicks, tidy } from "./readShots";
import { varietyLine } from "./shoot";
import { rollLine, splitDirection, suggestAngle, suggestRoll } from "./suggest";
import { day, loc, project, REEL_SILENT, shot } from "./test-helpers";
import type { Format } from "./types";

// Angle, direction and roll (design.md §5.15).

describe("suggestAngle", () => {
  it("puts a POV where you stand: high", () => {
    expect(suggestAngle({ size: "CU", subject: "My hands on the grinder", view: "pov" }, "silent")).toBe("high");
  });

  it("reads the subject first", () => {
    expect(suggestAngle({ size: "INS", subject: "Latte art in the cup" }, "narrated")).toBe("top-down");
    expect(suggestAngle({ size: "WS", subject: "The shopfront against the morning" }, "silent")).toBe("low");
    expect(suggestAngle({ size: "CU", subject: "Her face as she tastes it" }, "silent")).toBe("eye-level");
    // A tray in a wide with people isn't a flat lay.
    expect(suggestAngle({ size: "WS", subject: "Mei passing Priya the tray" }, "interview")).toBe("eye-level");
  });

  it("leans on SURFACE for the small stuff in observational work", () => {
    expect(suggestAngle({ size: "INS", subject: "Beans in the hopper" }, "silent")).toBe("surface");
    expect(suggestAngle({ size: "CU", subject: "The cup" }, "silent")).toBe("surface");
    expect(suggestAngle({ size: "INS", subject: "Beans in the hopper" }, "narrated")).toBe("high");
  });

  it("keeps people and wides at eye level", () => {
    expect(suggestAngle({ size: "MS", subject: "The barista at the counter" }, "silent")).toBe("eye-level");
    expect(suggestAngle({ size: "MS", subject: "Two of them talking", view: "ots" }, "interview")).toBe("eye-level");
  });
});

describe("suggestRoll", () => {
  it("follows the table: move, then action, then a hold", () => {
    expect(suggestRoll({ size: "WS", subject: "Walking in", movement: "tracking" }, "narrated")).toBe("move");
    expect(suggestRoll({ size: "CU", subject: "The pour", movement: "static" }, "narrated")).toBe("action");
    expect(suggestRoll({ size: "MS", subject: "Me explaining the grind", movement: "static", audio: "speech" }, "talking-to-camera")).toBe("action");
    expect(suggestRoll({ size: "INS", subject: "Beans", movement: "static" }, "narrated")).toBe("6s");
    expect(suggestRoll({ size: "WS", subject: "The room", movement: "static" }, "narrated")).toBe("10s");
  });

  it("holds longer for observational work", () => {
    expect(suggestRoll({ size: "INS", subject: "Beans", movement: "static" }, "silent")).toBe("10s");
    expect(suggestRoll({ size: "WS", subject: "The room", movement: "static" }, "silent")).toBe("15s");
  });

  it("doesn't count handheld as a move, or a close-up as an action", () => {
    expect(suggestRoll({ size: "MS", subject: "Close-up of the sign", movement: "handheld" }, "narrated")).toBe("6s");
  });
});

describe("rollLine", () => {
  it("says the budget in seconds, as a range", () => {
    expect(rollLine(REEL_SILENT, budget(REEL_SILENT))).toBe("18—24 shots at about 2—3s each makes a 45s reel — roll longer than you'll use.");
  });

  it("stays quiet where talking carries the length, or the cut is long", () => {
    const talking: Format = { ...REEL_SILENT, treatment: "talking-to-camera" };
    expect(rollLine(talking, budget(talking))).toBeUndefined();
    const long: Format = { ...REEL_SILENT, delivery: "long" };
    expect(rollLine(long, budget(long))).toBeUndefined();
    const short: Format = { ...REEL_SILENT, delivery: "short" };
    expect(rollLine(short, budget(short))).toBe("30—40 shots at about 3—4s each makes a 2-minute cut — roll longer than you'll use.");
  });
});

describe("splitDirection", () => {
  it("finds the direction a note opens with", () => {
    expect(splitDirection("Side-on, cup in front. Hands only, no faces.")).toEqual({ direction: "Side-on, cup in front.", rest: "Hands only, no faces." });
    expect(splitDirection("Along the counter, bowl in front.")).toEqual({ direction: "Along the counter, bowl in front.", rest: "" });
  });

  it("leaves a note alone when it doesn't", () => {
    expect(splitDirection("Wait for the steam. Two takes.")).toEqual({ rest: "Wait for the steam. Two takes." });
  });
});

describe("moveOtsToView (Dexie v3)", () => {
  it("makes an OTS shot a medium tagged OTS, and touches nothing else", () => {
    const old = shot("o", 3, { size: "OTS" as never, status: "exposed", note: "Keep her hands in", subject: "Over her shoulder" });
    const p = moveOtsToView(project({ shots: [old, shot("w", 0)] }));
    expect(p.shots[0]).toEqual({ ...old, size: "MS", view: "ots" });
    expect(p.shots[1]).toEqual(shot("w", 0));
  });

  it("returns the same project when there's nothing to move", () => {
    const p = project({ shots: [shot("w", 0)] });
    expect(moveOtsToView(p)).toBe(p);
  });
});

describe("varietyLine", () => {
  const onDay = (angles: (string | undefined)[]) =>
    project({ days: [day("d1", 1)], shots: angles.map((a, i) => shot(`s${i}`, i, { angle: a as never })) });

  it("says it once when a day leans on one angle", () => {
    const p = onDay([...Array(11).fill("eye-level"), "high", "high", "low"]);
    expect(varietyLine(p, "d1")).toBe("11 of 14 today are eye level — a surface or top-down shot would help the cut.");
  });

  it("stays quiet under the share, or with too few angles to judge", () => {
    expect(varietyLine(onDay([...Array(6).fill("eye-level"), "high", "high", "low", "surface"]), "d1")).toBeUndefined();
    expect(varietyLine(onDay([...Array(7).fill("eye-level"), undefined, undefined]), "d1")).toBeUndefined();
  });

  it("leaves dropped shots out of the count", () => {
    const p = onDay(Array(9).fill("eye-level"));
    p.shots[0] = { ...p.shots[0], status: "dropped" };
    expect(varietyLine(p, "d1")).toBe("8 of 8 today are eye level — a surface or top-down shot would help the cut.");
  });
});

describe("reads cached before §5.15", () => {
  const old: ReadShot = {
    size: "OTS",
    subject: "over her shoulder at the grinder",
    reason: "Why",
    beat: "body",
    light: "any",
    movement: "static",
    sound: "natural",
    location: null,
    day: null,
  };

  it("maps OTS to a medium tagged OTS, with no direction", () => {
    expect(tidy(old)).toMatchObject({ size: "MS", view: "ots", direction: undefined, subject: "Over her shoulder at the grinder" });
  });

  it("keeps a direction only when it starts with one of the five", () => {
    expect(tidy({ ...old, size: "CU", view: "none", direction: "side-on, cup in front" })).toMatchObject({ size: "CU", view: undefined, direction: "Side-on, cup in front." });
    expect(tidy({ ...old, direction: "Diagonal from the door." }).direction).toBeUndefined();
  });

  it("fills angle and roll from the suggester when they're missing", () => {
    const p = project({ locations: [loc("a", 0)] });
    const read = { hash: "h".repeat(20), dropped: [], result: { quoted: [], inferred: [], deliverables: [], shots: [old] } };
    const next = addReadPicks(p, readPicks(p, read).shots, new Date(0), () => "n");
    expect(next.shots[0]).toMatchObject({ size: "MS", view: "ots", angle: "eye-level", roll: "10s", note: undefined });
  });

  it("keeps what a new read says, and opens the note with its direction", () => {
    const p = project();
    const fresh: ReadShot = { ...old, size: "CU", angle: "surface", view: "none", roll: "action", direction: "Side-on, cup in front" };
    const read = { hash: "h".repeat(20), dropped: [], result: { quoted: [], inferred: [], deliverables: [], shots: [fresh] } };
    const next = addReadPicks(p, readPicks(p, read).shots, new Date(0), () => "n");
    expect(next.shots[0]).toMatchObject({ angle: "surface", roll: "action", view: undefined, note: "Side-on, cup in front." });
  });
});
