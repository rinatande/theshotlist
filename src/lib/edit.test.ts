import { describe, expect, it } from "vitest";
import { applyEdit, dayChange } from "./project";
import { shotNumbers } from "./shotNumbers";
import { day, loc, project, REEL_SILENT, shot } from "./test-helpers";

let n = 0;
const ids = () => `new${n++}`;

const threeDays = () =>
  project({
    dayCount: 3,
    startDate: "2026-09-24",
    days: [day("d1", 1), day("d2", 2), day("d3", 3)],
    locations: [loc("a", 0, { dayId: "d2" }), loc("c", 0, { dayId: "d3" })],
    shots: [
      shot("a1", 0, { locationId: "a" }),
      shot("c1", 0, { locationId: "c" }),
      shot("c2", 1, { locationId: "c" }),
      shot("d3-loose", 0, { dayId: "d3" }),
      shot("d3-loose2", 1, { dayId: "d3" }),
    ],
  });

const edit = (count: number, extra = {}) => ({ format: REEL_SILENT, dayCount: count, startDate: "2026-09-24", ...extra });

describe("dayChange", () => {
  it("says which shots move when days go (§5.14: 3 days to 2)", () => {
    expect(dayChange(threeDays(), 2)).toEqual({ from: 3, to: 2, removed: [3], shotCount: 4 });
  });

  it("is null when the shoot grows, or nothing sits on the days that go", () => {
    expect(dayChange(threeDays(), 4)).toBeNull();
    expect(dayChange(project({ dayCount: 2, days: [day("d1", 1), day("d2", 2)] }), 1)).toBeNull();
  });
});

describe("applyEdit", () => {
  it("never deletes a shot or a location", () => {
    const p = applyEdit(threeDays(), edit(1), new Date(), ids);
    expect(p.shots).toHaveLength(5);
    expect(p.locations).toHaveLength(2);
    expect(p.days.map((d) => d.id)).toEqual(["d1"]);
  });

  it("moves a removed day's locations and shots onto the new last day, after what's there", () => {
    const p = applyEdit(threeDays(), edit(2), new Date(), ids);
    expect(p.locations.find((l) => l.id === "c")).toMatchObject({ dayId: "d2", order: 1 });
    expect(p.shots.find((s) => s.id === "d3-loose")).toMatchObject({ dayId: "d2" });
    // Day 2 now runs: location a, then c, then the moved unplaced shots.
    expect(Object.fromEntries(shotNumbers(p))).toEqual({ a1: 1, c1: 2, c2: 3, "d3-loose": 4, "d3-loose2": 5 });
  });

  it("adds empty days when the shoot grows, and re-dates every day", () => {
    const p = applyEdit(threeDays(), edit(4, { startDate: "2026-10-01" }), new Date(), ids);
    expect(p.days.map((d) => [d.index, d.date])).toEqual([
      [1, "2026-10-01"],
      [2, "2026-10-02"],
      [3, "2026-10-03"],
      [4, "2026-10-04"],
    ]);
    expect(p.days.slice(0, 3).map((d) => d.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("falls back to the created date's name when the name is cleared", () => {
    const p = applyEdit(project({ createdAt: new Date(2026, 8, 18).toISOString() }), edit(1, { name: "" }), new Date(), ids);
    expect(p.name).toBe("18 Sep shoot");
  });
});
