import { describe, expect, it } from "vitest";
import {
  applyWrap,
  currentDay,
  dayCount,
  defaultPlan,
  flagShot,
  lastDayMissedSentence,
  markExposed,
  moveDropped,
  shootQueue,
  skip,
  undecided,
  undrop,
  wrapSentence,
  wrapView,
} from "./shoot";
import { lightLeft } from "./light";
import { day, loc, project, shot } from "./test-helpers";

// Budget for the reel/silent helper format is 18–24.
const three = () =>
  project({
    days: [day("d1", 1, { wrappedAt: "2026-09-21T20:00:00.000Z" }), day("d2", 2), day("d3", 3)],
    locations: [loc("cliff", 0, { dayId: "d2", startTime: 370 }), loc("head", 1, { dayId: "d2", startTime: 600 }), loc("town", 0, { dayId: "d3" })],
    shots: [
      shot("h1", 0, { locationId: "head" }),
      shot("c1", 0, { locationId: "cliff" }),
      shot("c2", 1, { locationId: "cliff" }),
      shot("u1", 0, { dayId: "d2" }),
      shot("t1", 0, { locationId: "town" }),
    ],
  });

describe("today", () => {
  it("is the first day not wrapped, whatever the dates say", () => {
    const p = project({ days: [day("d2", 2, { date: "2026-09-01" }), day("d1", 1, { wrappedAt: "x", date: "2026-12-01" })] });
    expect(currentDay(p)?.id).toBe("d2");
    expect(currentDay(project({ days: [day("d1", 1, { wrappedAt: "x" })] }))).toBeUndefined();
  });
});

describe("the queue", () => {
  it("runs in running order, unplaced last, and only the day's open shots", () => {
    const p = three();
    expect(shootQueue(p, "d2").map((s) => s.id)).toEqual(["c1", "c2", "h1", "u1"]);
  });

  it("sends a skipped shot to the back, and again if skipped again", () => {
    const p = three();
    let skipped = skip([], "c1");
    expect(shootQueue(p, "d2", skipped).map((s) => s.id)).toEqual(["c2", "h1", "u1", "c1"]);
    skipped = skip(skip(skipped, "c2"), "c1");
    expect(shootQueue(p, "d2", skipped).map((s) => s.id)).toEqual(["h1", "u1", "c2", "c1"]);
  });

  it("drops a flagged shot out of the queue and keeps its note as the ! line; GOT IT counts it", () => {
    let p = flagShot(three(), "c1", "  horizon wonky ");
    expect(p.shots.find((s) => s.id === "c1")).toMatchObject({ status: "flagged", flagNote: "horizon wonky" });
    expect(shootQueue(p, "d2").map((s) => s.id)).not.toContain("c1");
    p = markExposed(p, "c2");
    expect(dayCount(p, "d2")).toEqual({ exposed: 1, total: 4 });
  });

  it("works on a single-day project, where shots carry no day", () => {
    const p = project({ days: [day("d1", 1)], shots: [shot("a", 1), shot("b", 0)] });
    expect(shootQueue(p, "d1").map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("wrapping a day", () => {
  it("sorts the day into exposed, flagged and not shot, and moves the missed to the next day by default", () => {
    const p = flagShot(markExposed(three(), "c1"), "c2", "No coverage yet");
    const view = wrapView(p, "d2")!;
    expect(view.last).toBe(false);
    expect(view.exposed).toBe(1);
    expect(view.flagged.map((s) => s.id)).toEqual(["c2"]);
    expect(view.missed.map((s) => s.id)).toEqual(["h1", "u1"]);
    const plan = defaultPlan(view);
    expect(plan.missed).toEqual({ h1: "d3", u1: "d3" });
    expect(undecided(plan)).toBe(1);
  });

  it("applies the plan: reshoot moves and resets, accept exposes, drop keeps the shot, and the day is wrapped", () => {
    const p = flagShot(flagShot(three(), "c1", "soft"), "c2", "wonky");
    const plan = { flagged: { c1: "reshoot" as const, c2: "accept" as const }, missed: { h1: "drop", u1: "d3" } };
    const q = applyWrap(p, "d2", plan, new Date("2026-09-22T10:00:00Z"));
    const by = (id: string) => q.shots.find((s) => s.id === id)!;
    expect(by("c1")).toMatchObject({ status: "unshot", dayId: "d3", locationId: undefined, flagNote: "soft" });
    expect(by("c2")).toMatchObject({ status: "exposed", flagNote: "wonky" });
    expect(by("h1")).toMatchObject({ status: "dropped", droppedAt: "2026-09-22T10:00:00.000Z" });
    expect(by("u1")).toMatchObject({ dayId: "d3", locationId: undefined });
    expect(q.shots).toHaveLength(p.shots.length); // wrap never deletes
    expect(q.days.find((d) => d.id === "d2")!.wrappedAt).toBe("2026-09-22T10:00:00.000Z");
    expect(currentDay(q)?.id).toBe("d3");
  });

  it("on the last day, drops what's missed but leaves an outstanding [★] as it is", () => {
    const p = project({ days: [day("d1", 1)], shots: [shot("a", 0), shot("logo", 1, { required: { client: "Sable" } })] });
    const view = wrapView(p, "d1")!;
    expect(view.last).toBe(true);
    expect(view.missed.map((s) => s.id)).toEqual(["a"]);
    expect(view.outstanding.map((s) => s.id)).toEqual(["logo"]);
    const q = applyWrap(p, "d1", defaultPlan(view));
    expect(q.shots.find((s) => s.id === "a")!.status).toBe("dropped");
    expect(q.shots.find((s) => s.id === "logo")!.status).toBe("unshot");
  });

  it("un-drops from the record, or moves a dropped shot to a later day", () => {
    const wrapped = applyWrap(three(), "d2", { flagged: {}, missed: { c1: "drop", c2: "drop", h1: "drop", u1: "drop" } });
    expect(undrop(wrapped, "c1").shots.find((s) => s.id === "c1")).toMatchObject({ status: "unshot", droppedAt: undefined });
    expect(moveDropped(wrapped, "c2", "d3").shots.find((s) => s.id === "c2")).toMatchObject({ status: "unshot", dayId: "d3", locationId: undefined });
  });
});

describe("what wrap says", () => {
  const exposed = (n: number, extra = {}) => Array.from({ length: n }, (_, i) => shot(`e${i}`, i, { status: "exposed", dayId: "d1", ...extra }));

  it("ties a middle day to the cut, never to you", () => {
    const p = project({ days: [day("d1", 1), day("d2", 2)], shots: [...exposed(9), ...Array.from({ length: 10 }, (_, i) => shot(`l${i}`, i, { dayId: "d2" }))] });
    expect(wrapSentence(p, wrapView(p, "d1")!)).toBe("Nine of the eighteen this cut needs, with a day still to go. There's nothing you have to chase tomorrow.");
    const thin = project({ days: [day("d1", 1), day("d2", 2)], shots: exposed(9) });
    expect(wrapSentence(thin, wrapView(thin, "d1")!)).toBe("Nine of the eighteen this cut needs, with a day still to go. Even with the rest of the list it's nine short — worth adding a few for tomorrow.");
  });

  it("says when the last day ends the shoot, and whether it's enough", () => {
    const p = project({ days: [day("d1", 1, { wrappedAt: "x" }), day("d2", 2)], shots: exposed(20) });
    expect(wrapSentence(p, wrapView(p, "d2")!)).toBe("Twenty across two days, for a cut that wants eighteen to twenty-four. That's enough — and it's the last day, so wrapping it ends the shoot.");
    const one = project({ days: [day("d1", 1)], shots: [...exposed(4), shot("m1", 5), shot("m2", 6)] });
    expect(lastDayMissedSentence(one, wrapView(one, "d1")!)).toEqual({ short: true, text: "You're short of the cut — worth going back for one of these before you wrap?" });
  });

  it("names the client when a paid-for shot isn't in the can", () => {
    const p = project({
      days: [day("d1", 1), day("d2", 2)],
      shots: [...exposed(18), ...["a", "b"].map((id, i) => shot(id, 20 + i, { status: "exposed", dayId: "d1", required: { client: "Sable" } })), shot("logo", 30, { dayId: "d1", required: { client: "Sable" } })],
    });
    expect(wrapSentence(p, wrapView(p, "d1")!)).toBe("Enough for the cut, but one of the three shots Sable is paying for isn't in the can.");
  });
});

describe("the light line", () => {
  const sydney = project({ coords: { lat: -33.8688, lng: 151.2093, timeZone: "Australia/Sydney", source: "name" } });
  it("counts down to sunset in the afternoon, and to sunrise before dawn", () => {
    // 17:04 AEST on 19 Sep; sunset is about 17:50.
    expect(lightLeft(sydney, undefined, new Date("2026-09-19T07:04:00Z"), "12h")).toMatch(/^LIGHT GOES 5:(4|5)\d PM · 4\d MIN$/);
    // 03:00 AEST: sunrise about 05:49.
    expect(lightLeft(sydney, undefined, new Date("2026-09-18T17:00:00Z"), "12h")).toMatch(/^SUNRISE 5:4\d AM · 2 H 4\d MIN$/);
  });
  it("says nothing after sunset, or with no place", () => {
    expect(lightLeft(sydney, undefined, new Date("2026-09-19T10:00:00Z"), "12h")).toBeUndefined();
    expect(lightLeft(project(), undefined, new Date(), "12h")).toBeUndefined();
  });
});
