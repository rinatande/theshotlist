import { describe, expect, it } from "vitest";
import { runningOrder } from "./runningOrder";
import { formatShotNumber, shotNumbers } from "./shotNumbers";
import { day, loc, project, shot } from "./test-helpers";

const names = (locations: { id: string }[]) => locations.map((l) => l.id);
const numbers = (p: ReturnType<typeof project>) => Object.fromEntries(shotNumbers(p));

describe("runningOrder", () => {
  it("puts timed locations first by the clock, then untimed by drag order", () => {
    const p = project({
      locations: [
        loc("untimed-b", 2),
        loc("headland", 0, { startTime: 17 * 60 + 40 }),
        loc("untimed-a", 1),
        loc("cliff", 5, { startTime: 6 * 60 + 10 }),
      ],
    });
    expect(names(runningOrder(p))).toEqual(["cliff", "headland", "untimed-a", "untimed-b"]);
  });

  it("filters to one day when asked", () => {
    const p = project({
      days: [day("d1", 1), day("d2", 2)],
      locations: [loc("a", 0, { dayId: "d2" }), loc("b", 0, { dayId: "d1" })],
    });
    expect(names(runningOrder(p, "d1"))).toEqual(["b"]);
  });

  it("orders the whole project day by day, then locations on no day", () => {
    const p = project({
      days: [day("d2", 2), day("d1", 1)],
      locations: [loc("later", 0, { dayId: "d2" }), loc("loose", 0), loc("first", 0, { dayId: "d1" })],
    });
    expect(names(runningOrder(p))).toEqual(["first", "later", "loose"]);
  });
});

describe("shotNumbers", () => {
  it("numbers shots in running order, not in the order they were added", () => {
    const p = project({
      locations: [loc("headland", 0, { startTime: 1060 }), loc("cliff", 1, { startTime: 370 })],
      shots: [shot("h1", 0, { locationId: "headland" }), shot("c2", 1, { locationId: "cliff" }), shot("c1", 0, { locationId: "cliff" })],
    });
    expect(numbers(p)).toEqual({ c1: 1, c2: 2, h1: 3 });
  });

  it("puts UNPLACED shots last", () => {
    const p = project({
      locations: [loc("cliff", 0)],
      shots: [shot("loose", 0), shot("c1", 0, { locationId: "cliff" })],
    });
    expect(numbers(p)).toEqual({ c1: 1, loose: 2 });
  });

  it("runs continuously across days, each day's UNPLACED at its own foot (§5.10)", () => {
    const p = project({
      dayCount: 2,
      days: [day("d1", 1), day("d2", 2)],
      locations: [loc("a", 0, { dayId: "d1" }), loc("b", 0, { dayId: "d2" })],
      shots: [
        shot("b1", 0, { locationId: "b" }),
        shot("d1-loose", 0, { dayId: "d1" }),
        shot("a1", 0, { locationId: "a" }),
        shot("a2", 1, { locationId: "a" }),
        shot("no-day", 0),
      ],
    });
    expect(numbers(p)).toEqual({ a1: 1, a2: 2, "d1-loose": 3, b1: 4, "no-day": 5 });
  });

  it("takes a shot's day from its location over its own dayId", () => {
    const p = project({
      days: [day("d1", 1), day("d2", 2)],
      locations: [loc("a", 0, { dayId: "d1" }), loc("b", 0, { dayId: "d2" })],
      shots: [shot("moved", 0, { locationId: "a", dayId: "d2" }), shot("b1", 0, { locationId: "b" })],
    });
    expect(numbers(p)).toEqual({ moved: 1, b1: 2 });
  });

  it("gives required shots no number and doesn't skip one for them (§5.7)", () => {
    const p = project({
      shots: [shot("s1", 0), shot("star", 1, { required: { client: "Nagi Coffee" } }), shot("s2", 2)],
    });
    expect(numbers(p)).toEqual({ s1: 1, s2: 2 });
  });

  it("keeps a dropped shot's number, so un-dropping doesn't renumber", () => {
    const p = project({ shots: [shot("s1", 0), shot("gone", 1, { status: "dropped" }), shot("s3", 2)] });
    expect(numbers(p)).toEqual({ s1: 1, gone: 2, s3: 3 });
  });

  it("renumbers when a shot is deleted: 05 becomes 04 (§5.13)", () => {
    const shots = ["s1", "s2", "s3", "s4", "s5"].map((id, i) => shot(id, i));
    const p = project({ shots: shots.filter((s) => s.id !== "s4") });
    expect(shotNumbers(p).get("s5")).toBe(4);
  });

  it("treats a shot whose location was deleted as UNPLACED", () => {
    const p = project({ locations: [loc("a", 0)], shots: [shot("orphan", 0, { locationId: "gone" }), shot("a1", 0, { locationId: "a" })] });
    expect(numbers(p)).toEqual({ a1: 1, orphan: 2 });
  });
});

describe("formatShotNumber", () => {
  it("pads to two digits", () => {
    expect(formatShotNumber(4)).toBe("04");
    expect(formatShotNumber(112)).toBe("112");
  });
});
