import { describe, expect, it } from "vitest";
import { beatLabel, guessBeat } from "./beats";
import { runningOrderLight, startTimeLight } from "./light";
import { shotNumbers } from "./shotNumbers";
import {
  addLocation,
  addShot,
  arrangeShots,
  coverageGap,
  deleteConsequence,
  deleteLocation,
  deleteShot,
  duplicateShot,
  findDuplicate,
  moveShots,
  numberIfAdded,
  reorderLocations,
  toggleExposed,
  updateLocation,
  updateShot,
  clientsOf,
} from "./shots";
import { suggestAudio, suggestMovement } from "./suggest";
import { day, loc, project, REEL_SILENT, shot } from "./test-helpers";

let n = 0;
const ids = () => `id${n++}`;
const at = new Date("2026-09-22T00:00:00Z");
const nums = (p: ReturnType<typeof project>) => Object.fromEntries(shotNumbers(p));

describe("suggestMovement", () => {
  it("reads the subject first", () => {
    expect(suggestMovement({ size: "WS", support: "tripod", subject: "Drone pull-back from the cliff" })).toBe("pull-back");
    expect(suggestMovement({ size: "MS", subject: "Sliding the door to reveal the garden" })).toBe("reveal");
    expect(suggestMovement({ size: "MS", support: "gimbal", subject: "Walking under the torii" })).toBe("tracking");
    expect(suggestMovement({ size: "MS", subject: "Walking under the torii" })).toBe("follow");
  });

  it("falls back on the support and size", () => {
    expect(suggestMovement({ size: "WS", support: "tripod", subject: "The view over the valley" })).toBe("slow-pan");
    expect(suggestMovement({ size: "CU", support: "tripod", subject: "Steam off the cup" })).toBe("static");
    expect(suggestMovement({ size: "CU", support: "gimbal", subject: "Hands on the rope" })).toBe("push-in");
    expect(suggestMovement({ size: "INS", subject: "Watch face" })).toBe("static");
    expect(suggestMovement({ size: "MS", subject: "Market stall" })).toBe("handheld");
  });
});

describe("suggestAudio", () => {
  it("wants speech when someone talks, and the place's sound otherwise", () => {
    expect(suggestAudio({ size: "MS", subject: "Say the name out loud" }, "silent")).toBe("natural");
    expect(suggestAudio({ size: "MS", subject: "Intro to camera" }, "talking-to-camera")).toBe("speech");
    expect(suggestAudio({ size: "WS", subject: "Harbour at dawn" }, "talking-to-camera")).toBe("natural");
    expect(suggestAudio({ size: "CU", subject: "Owner answers" }, "interview")).toBe("speech");
  });

  it("needs no sound under narration, except room sound on wides", () => {
    expect(suggestAudio({ size: "CU", subject: "Hands on the dough" }, "narrated")).toBe("none");
    expect(suggestAudio({ size: "WS", subject: "The kitchen" }, "narrated")).toBe("natural");
  });
});

describe("beats", () => {
  it("names beats by delivery, with reel timings", () => {
    expect(beatLabel(REEL_SILENT, "opener")).toBe("HOOK — FIRST 3 SEC");
    expect(beatLabel(REEL_SILENT, "body")).toBe("BUILD");
    expect(beatLabel({ ...REEL_SILENT, delivery: "mid" }, "closer")).toBe("OUTRO");
  });

  it("guesses from the closest template, then from size and place", () => {
    const p = project({ locations: [loc("first", 0), loc("mid", 1), loc("last", 2)] });
    expect(guessBeat({ subject: "Steam off my coffee", size: "CU", locationId: "mid" }, p)).toBe("opener"); // steam-backlit
    expect(guessBeat({ subject: "Zzz", size: "WS", locationId: "first" }, p)).toBe("opener");
    expect(guessBeat({ subject: "Zzz", size: "CU", locationId: "last" }, p)).toBe("closer");
    expect(guessBeat({ subject: "Zzz", size: "CU", locationId: "mid" }, p)).toBe("body");
    expect(guessBeat({ subject: "Zzz", size: "CU" }, p)).toBe("body");
  });
});

describe("adding and changing shots", () => {
  it("adds to the end of its location and numbers it there", () => {
    const base = project({ locations: [loc("a", 0), loc("b", 1)], shots: [shot("a1", 0, { locationId: "a" }), shot("b1", 0, { locationId: "b" })] });
    const [p, id] = addShot(base, { size: "CU", subject: " Hands ", locationId: "a" }, at, ids);
    expect(p.shots.find((s) => s.id === id)).toMatchObject({ subject: "Hands", order: 1, status: "unshot", source: "manual" });
    expect(nums(p)[id]).toBe(2);
    expect(numberIfAdded(base, { size: "CU", subject: "x", locationId: "a" })).toBe(2);
  });

  it("puts a shot with no location on the first day of a multi-day shoot", () => {
    const [p, id] = addShot(project({ days: [day("d1", 1), day("d2", 2)] }), { size: "WS", subject: "x" }, at, ids);
    expect(p.shots.find((s) => s.id === id)?.dayId).toBe("d1");
  });

  it("toggles exposed, and exposing a flagged shot settles the flag", () => {
    const base = project({ shots: [shot("s", 0, { status: "flagged", flagNote: "NO COVERAGE YET" })] });
    const p = toggleExposed(base, "s", at);
    expect(p.shots[0]).toMatchObject({ status: "exposed", flagNote: undefined });
    expect(toggleExposed(p, "s", at).shots[0].status).toBe("unshot");
  });

  it("duplicates straight after the original: same spec, next number", () => {
    const base = project({ shots: [shot("s1", 0), shot("s2", 1, { status: "exposed", lens: "85mm" }), shot("s3", 2)] });
    const [p, copy] = duplicateShot(base, "s2", at, ids);
    expect(nums(p)).toEqual({ s1: 1, s2: 2, [copy]: 3, s3: 4 });
    expect(p.shots.find((s) => s.id === copy)).toMatchObject({ lens: "85mm", status: "unshot" });
  });

  it("says what deleting does, then does it (§5.13: 04 becomes 03)", () => {
    const base = project({ shots: ["s1", "s2", "s3", "s4"].map((id, i) => shot(id, i)) });
    expect(deleteConsequence(base, "s3")).toBe("Shots below move up — 04 becomes 03. Anything already exposed keeps its mark.");
    expect(deleteConsequence(base, "s4")).toBe("It's the last shot, so nothing else moves.");
    expect(nums(deleteShot(base, "s3"))).toEqual({ s1: 1, s2: 2, s4: 3 });
  });
});

describe("gaps and duplicates (§8 Add shot)", () => {
  const base = project({ locations: [loc("h", 0)], shots: [shot("w", 0, { locationId: "h", size: "WS", subject: "Drone pull-back", lens: "24mm" })] });

  it("names a size the location still lacks, not the one being added", () => {
    expect(coverageGap(base, "MS", "h")).toBe("CU"); // has WS, adding MS: CU is next missing
    expect(coverageGap(base, "CU", "h")).toBe("INS");
    expect(coverageGap(base, "INS", undefined)).toBeUndefined();
  });

  it("says nothing about an empty location", () => {
    expect(coverageGap(project({ locations: [loc("e", 0)] }), "WS", "e")).toBeUndefined();
  });

  it("matches a duplicate ignoring case and spacing, not a near miss", () => {
    expect(findDuplicate(base, { size: "WS", subject: "  drone   PULL-BACK ", locationId: "h", lens: "24MM" })?.id).toBe("w");
    expect(findDuplicate(base, { size: "WS", subject: "Drone pull-back", locationId: "h", lens: "35mm" })).toBeUndefined();
    expect(findDuplicate(base, { size: "WS", subject: "Drone pull-back", locationId: "h", lens: "24mm" }, "w")).toBeUndefined();
  });
});

describe("locations", () => {
  it("never deletes shots: they fall to UNPLACED on the location's day (§5.10)", () => {
    const base = project({
      days: [day("d1", 1), day("d2", 2)],
      locations: [loc("a", 0, { dayId: "d2" })],
      shots: [shot("a1", 0, { locationId: "a", dayId: "d2" }), shot("a2", 1, { locationId: "a", dayId: "d2" })],
    });
    const p = deleteLocation(base, "a", at);
    expect(p.locations).toHaveLength(0);
    expect(p.shots.map((s) => [s.id, s.locationId, s.dayId])).toEqual([
      ["a1", undefined, "d2"],
      ["a2", undefined, "d2"],
    ]);
  });

  it("keeps a deleted location's shots in their running order", () => {
    const base = project({ locations: [loc("a", 0)], shots: [shot("made-first", 2, { locationId: "a" }), shot("top", 0, { locationId: "a" }), shot("mid", 1, { locationId: "a" })] });
    expect(Object.keys(nums(deleteLocation(base, "a", at)))).toEqual(["top", "mid", "made-first"]);
  });

  it("moves a location's shots with it to another day (E2)", () => {
    const base = project({ days: [day("d1", 1), day("d2", 2)], locations: [loc("a", 0, { dayId: "d1" })], shots: [shot("a1", 0, { locationId: "a", dayId: "d1" })] });
    const p = updateLocation(base, "a", { name: "a", dayId: "d2" }, at);
    expect(p.locations[0].dayId).toBe("d2");
    expect(p.shots[0].dayId).toBe("d2");
  });

  it("forgets coordinates when the place name changes", () => {
    const coords = { lat: 1, lng: 2, timeZone: "UTC", source: "name" as const, from: "Headland" };
    const base = project({ locations: [loc("a", 0, { where: "Headland", coords })] });
    expect(updateLocation(base, "a", { name: "a", where: "Headland" }, at).locations[0].coords).toEqual(coords);
    expect(updateLocation(base, "a", { name: "a", where: "Bondi" }, at).locations[0].coords).toBeUndefined();
  });

  it("adds a location at the end of its day", () => {
    const [p, id] = addLocation(project({ locations: [loc("a", 0), loc("b", 3)] }), { name: " Lunch " }, at, ids);
    expect(p.locations.find((l) => l.id === id)).toMatchObject({ name: "Lunch", order: 4 });
  });

  it("reorders untimed locations and leaves timed ones to the clock", () => {
    const base = project({ locations: [loc("t", 9, { startTime: 360 }), loc("x", 0), loc("y", 1)] });
    const p = reorderLocations(base, undefined, ["y", "x", "t"], at);
    expect(p.locations.map((l) => [l.id, l.order])).toEqual([
      ["t", 9],
      ["x", 1],
      ["y", 0],
    ]);
  });

  it("moves a shot across a band into another location (S7)", () => {
    const base = project({ locations: [loc("a", 0), loc("b", 1)], shots: [shot("a1", 0, { locationId: "a" }), shot("b1", 0, { locationId: "b" })] });
    const p = arrangeShots(base, undefined, new Map([["a", []], ["b", ["a1", "b1"]]]), at);
    expect(nums(p)).toEqual({ a1: 1, b1: 2 });
    expect(p.shots.find((s) => s.id === "a1")?.locationId).toBe("b");
  });
});

describe("light lines", () => {
  const sun = { sunrise: 362, goldenMorningEnd: 405, goldenEveningStart: 1045, sunset: 1072 };

  it("E1: says what a morning start buys you", () => {
    expect(startTimeLight(sun, "Headland", "2026-09-19", 370, "12h")).toBe(
      "Sunrise is 6:02 AM at Headland on 19 Sep and golden hour holds to about 6:45 AM. A 6:10 AM start gives you 35 minutes of it.",
    );
  });

  it("E1: evening, after dark, and no start time", () => {
    expect(startTimeLight(sun, "Headland", "2026-09-19", 1050, "12h")).toContain("gives you 22 minutes of it");
    expect(startTimeLight(sun, "Headland", "2026-09-19", 1100, "12h")).toContain("after it — the light will be gone");
    expect(startTimeLight(sun, "Headland", "2026-09-19", undefined, "24h")).toBe("Sunrise is 0602 and sunset is 1752 at Headland on 19 Sep.");
  });

  it("E3: flags the last of the good light", () => {
    const coords = { lat: -33.87, lng: 151.21, timeZone: "Australia/Sydney", source: "name" as const };
    const locations = [loc("Cliff path", 0, { startTime: 380 }), loc("The headland", 1, { startTime: 17 * 60 + 25 })];
    const p = project({ coords, startDate: "2026-09-19", locations });
    expect(runningOrderLight(p, locations, "12h")).toMatch(/^The headland at 5:25 PM is the last of the good light — sunset is 5:\d\d PM\./);
  });
});

describe("moveShots", () => {
  it("moves many unplaced shots into a location, in list order, after what's there", () => {
    const p = project({
      locations: [loc("kitchen", 0)],
      shots: [shot("k1", 0, { locationId: "kitchen" }), shot("u1", 0), shot("u2", 1), shot("u3", 2)],
    });
    const q = moveShots(p, ["u3", "u1"], { locationId: "kitchen" });
    const kitchen = q.shots.filter((s) => s.locationId === "kitchen").sort((a, b) => a.order - b.order);
    expect(kitchen.map((s) => s.id)).toEqual(["k1", "u1", "u3"]);
    expect(q.shots.find((s) => s.id === "u2")!.locationId).toBeUndefined();
    // Numbers follow the move: kitchen's three, then what's left unplaced.
    const n = shotNumbers(q);
    expect([n.get("k1"), n.get("u1"), n.get("u3"), n.get("u2")]).toEqual([1, 2, 3, 4]);
  });

  it("takes the location's day on a multi-day shoot, and can send shots back to a day's UNPLACED", () => {
    const p = project({
      days: [day("d1", 1), day("d2", 2)],
      locations: [loc("temple", 0, { dayId: "d2" })],
      shots: [shot("a", 0, { dayId: "d1" }), shot("b", 1, { dayId: "d1" })],
    });
    const q = moveShots(p, ["a", "b"], { locationId: "temple" });
    expect(q.shots.every((s) => s.locationId === "temple" && s.dayId === "d2")).toBe(true);
    const r = moveShots(q, ["b"], { dayId: "d1" });
    expect(r.shots.find((s) => s.id === "b")).toMatchObject({ locationId: undefined, dayId: "d1" });
  });

  it("does nothing for a location that doesn't exist", () => {
    const p = project({ shots: [shot("a", 0)] });
    expect(moveShots(p, ["a"], { locationId: "gone" })).toBe(p);
  });
});

describe("a beat and [★] set by hand (§10 items 16, 17)", () => {
  it("keeps a picked beat and lets an edit correct a guessed one", () => {
    const p = project({ shots: [] });
    const [a, id] = addShot(p, { size: "MS", subject: "Something vague" }, at, ids);
    expect(a.shots[0].beat).toBe(guessBeat({ subject: "Something vague", size: "MS" }, p));
    const b = updateShot(a, id, { size: "MS", subject: "Something vague", beat: "closer" }, at);
    expect(b.shots[0].beat).toBe("closer");
    // An edit that doesn't send a beat leaves it alone.
    expect(updateShot(b, id, { size: "MS", subject: "Something vague" }, at).shots[0].beat).toBe("closer");
  });

  it("marks and unmarks a shot as required, trimming the client", () => {
    const p = project({ shots: [] });
    const [a, id] = addShot(p, { size: "CU", subject: "Logo on the pack", required: { client: "  Sable Outdoor " } }, at, ids);
    expect(a.shots[0].required).toEqual({ client: "Sable Outdoor" });
    expect(clientsOf(a)).toEqual(["Sable Outdoor"]);
    // Required shots are never numbered.
    expect(nums(a)[id]).toBeUndefined();
    const b = updateShot(a, id, { size: "CU", subject: "Logo on the pack" }, at);
    expect(b.shots[0].required).toBeUndefined();
    expect(nums(b)[id]).toBe(1);
  });

  it("treats a blank client as not required", () => {
    const [a] = addShot(project({ shots: [] }), { size: "CU", subject: "Logo", required: { client: "  " } }, at, ids);
    expect(a.shots[0].required).toBeUndefined();
  });
});
