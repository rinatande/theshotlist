import { describe, expect, it } from "vitest";
import { readContext, readHash, readPrompt, type ReadResult, type ReadShot } from "./read";
import { addReadPicks, clearUnshot, readPicks } from "./readShots";
import { shotNumbers } from "./shotNumbers";
import { day, loc, project, shot } from "./test-helpers";

const s = (subject: string, extra: Partial<ReadShot> = {}): ReadShot => ({
  size: "CU",
  subject,
  reason: `Why ${subject}`,
  beat: "body",
  light: "any",
  movement: "static",
  sound: "natural",
  location: null,
  day: null,
  ...extra,
});

const RESULT: ReadResult = {
  quoted: [{ label: "SUNRISE", kind: "time" }],
  inferred: [{ label: "BRAND DEAL", kind: "work" }],
  deliverables: [{ client: "Nagi Coffee", shots: [s("Hero shot of the bag", { size: "INS" }), s("Someone pouring")] }],
  shots: [s("Steam off the cup", { location: "cliff path" }), s("Empty lane", { day: 2 })],
};
const read = { hash: "abcdef0123456789", result: RESULT, dropped: [] as string[] };

describe("what the read is sent", () => {
  it("sends format, budget, locations and what's on the list — never the project name", () => {
    const p = project({ name: "Secret client film", locations: [loc("Cliff path", 0, { name: "Cliff path", startTime: 370 })], shots: [shot("a", 0, { subject: "Drone pull-back" })] });
    const prompt = readPrompt({ brief: "Sunrise at the cliffs", context: readContext(p) });
    expect(prompt).toContain('"Cliff path" from 06:10');
    expect(prompt).toContain('"Drone pull-back"');
    expect(prompt).toContain("Return 23 shots (deliverables included), and at least 17.");
    expect(prompt).not.toContain("Secret client film");
  });

  it("hashes the same brief and plan the same way, and a changed brief differently", async () => {
    const ctx = readContext(project());
    expect(await readHash({ brief: "a brief ", context: ctx })).toBe(await readHash({ brief: "a brief", context: ctx }));
    expect(await readHash({ brief: "a brief", context: ctx })).not.toBe(await readHash({ brief: "another", context: ctx }));
  });

  it("reads again when the gear changes, but a read with no gear keeps its old hash", async () => {
    const none = readContext(project());
    const withGear = readContext(project({ gear: [{ id: "85", name: "Sony 85 f/1.8", specs: { category: "lens", focalMin: 85, focalMax: 85, maxAperture: 1.8 } }] }));
    expect(withGear.gear).toEqual(["Sony 85 f/1.8 (lens: 85 · f1.8)"]);
    expect(await readHash({ brief: "a brief", context: none })).not.toBe(await readHash({ brief: "a brief", context: withGear }));
    expect(readPrompt({ brief: "a brief", context: withGear })).toContain("Gear coming: Sony 85 f/1.8 (lens: 85 · f1.8).");
    expect(readPrompt({ brief: "a brief", context: none })).toContain("No gear listed.");
  });

  it("tells the read the frame rate, and reads again when it changes", async () => {
    const at24 = readContext(project({ frameRate: 24 }));
    expect(readPrompt({ brief: "b", context: at24 })).toContain("everything at 24fps — real time throughout");
    expect(readPrompt({ brief: "b", context: readContext(project({ frameRate: 120 })) })).toContain("slow motion is available");
    expect(await readHash({ brief: "b", context: at24 })).not.toBe(await readHash({ brief: "b", context: readContext(project()) }));
  });

  it("doesn't read again because the list grew — only a changed brief does", async () => {
    const before = readContext(project());
    const after = readContext(project({ shots: [shot("a", 0, { subject: "Tamping" })] }));
    expect(await readHash({ brief: "a brief", context: before })).toBe(await readHash({ brief: "a brief", context: after }));
  });
});

describe("turning a read into shots", () => {
  const p = project({ days: [day("d1", 1), day("d2", 2)], locations: [loc("cliff", 0, { name: "Cliff path", dayId: "d1" })] });

  it("places shots by location name or day, and groups deliverables by client", () => {
    const { required, shots } = readPicks(p, read);
    expect(required[0].client).toBe("Nagi Coffee");
    expect(shots[0]).toMatchObject({ locationId: "cliff", dayId: "d1" });
    expect(shots[1]).toMatchObject({ dayId: "d2" });
  });

  it("adds deliverables as [★] shots, keeping reason lines", () => {
    const { required, shots } = readPicks(p, read);
    const next = addReadPicks(p, [...required[0].picks, ...shots], new Date(0));
    const hero = next.shots.find((x) => x.subject === "Hero shot of the bag")!;
    expect(hero.required).toEqual({ client: "Nagi Coffee" });
    expect(hero.source).toBe("brief");
    expect(hero.reason).toBe("Why Hero shot of the bag");
    expect(shotNumbers(next).has(hero.id)).toBe(false); // ★ takes no number
  });

  it("never offers the same read shot twice, and leaves out what was dropped", () => {
    const { shots } = readPicks(p, read);
    const next = addReadPicks(p, shots, new Date(0));
    expect(readPicks(next, read).shots).toHaveLength(0);
    const dropped = readPicks(p, { ...read, dropped: ["Someone pouring"] });
    expect(dropped.required[0].picks.map((x) => x.shot.subject)).toEqual(["Hero shot of the bag"]);
    expect(readPicks(p, { ...read, dropped: ["Nagi Coffee"] }).required).toHaveLength(0);
  });

  it("marks a deliverable already on the list, and doesn't add it again", () => {
    const has = project({ ...p, shots: [shot("x", 0, { subject: "hero shot of the bag", required: { client: "Nagi Coffee" } })] });
    const pick = readPicks(has, read).required[0].picks[0];
    expect(pick.alreadyOn).toBe(true);
    expect(addReadPicks(has, [pick]).shots).toHaveLength(1);
  });

  it("places shots in the locations it suggests when there are none, creating each once", () => {
    const bare = project();
    const suggesting = {
      ...read,
      result: { ...RESULT, deliverables: [], locations: [{ name: "Kitchen", day: null }], shots: [s("Descaler in", { location: "kitchen" }), s("Tank back in", { location: "Kitchen" }), s("Somewhere", { location: null })] },
    };
    const { shots } = readPicks(bare, suggesting);
    expect(shots.map((x) => x.newLocation)).toEqual(["Kitchen", "Kitchen", undefined]);
    const next = addReadPicks(bare, shots, new Date(0));
    expect(next.locations.map((l) => l.name)).toEqual(["Kitchen"]);
    const kitchen = next.locations[0].id;
    expect(next.shots.filter((x) => x.locationId === kitchen)).toHaveLength(2);
    expect(next.shots.find((x) => x.subject === "Somewhere")!.locationId).toBeUndefined();
    // Once it exists, a later read's shot finds it rather than suggesting it again.
    expect(readPicks(next, { ...suggesting, hash: "ffff" }).shots[0]).toMatchObject({ locationId: kitchen });
    expect(readPicks(next, { ...suggesting, hash: "ffff" }).shots[0].newLocation).toBeUndefined();
  });

  it("puts a suggested location on its day on a multi-day shoot", () => {
    const suggesting = { ...read, result: { ...RESULT, deliverables: [], locations: [{ name: "Temple", day: 2 }], shots: [s("Roofline", { location: "Temple" })] } };
    const next = addReadPicks(p, readPicks(p, suggesting).shots, new Date(0));
    const temple = next.locations.find((l) => l.name === "Temple")!;
    expect(temple.dayId).toBe("d2");
    expect(next.shots.find((x) => x.subject === "Roofline")).toMatchObject({ locationId: temple.id, dayId: "d2" });
  });

  it("replace clears what isn't shot and keeps what is (B10, kept safer than the board)", () => {
    const list = project({ shots: [shot("done", 0, { status: "exposed" }), shot("todo", 1), shot("flag", 2, { status: "flagged" }), shot("gone", 3, { status: "dropped" })] });
    expect(clearUnshot(list).shots.map((x) => x.id)).toEqual(["done", "gone"]);
  });
});

describe("the backstop for a short read", () => {
  it("asks for the top of the range, never under the bottom", async () => {
    const { shotTarget, topUpPrompt } = await import("./read");
    expect(shotTarget({ budget: { min: 48, max: 64 }, planned: 4 })).toEqual({ room: 60, floor: 44 });
    expect(topUpPrompt(26, 48, 64)).toContain("You returned 26 shots, but this cut needs at least 48 and ideally 64.");
    expect(topUpPrompt(26, 48, 64)).toContain("38 more shots");
  });

  it("adds the top-up's shots and skips any it repeated", async () => {
    const { mergeTopUp } = await import("./read");
    const first: ReadResult = { ...RESULT, shots: [s("Steam off the cup")] };
    const more: ReadResult = { quoted: [], inferred: [], deliverables: [], locations: [], shots: [s("steam off the cup "), s("Hands on the grinder"), s("Someone pouring")] };
    // "Someone pouring" is already a deliverable in RESULT, so it's a repeat too.
    expect(mergeTopUp(first, more).shots.map((x) => x.subject)).toEqual(["Steam off the cup", "Hands on the grinder"]);
    expect(mergeTopUp(first, more).deliverables).toEqual(first.deliverables);
  });
});

describe("progress while the read runs", () => {
  it("counts only finished subjects, and reads the last one", async () => {
    const { progressOf } = await import("./read");
    expect(progressOf('{"quoted":[{"label":"SUNRISE","kind":"time"}],"shots":[')).toEqual({ count: 0, subject: undefined });
    expect(progressOf('{"shots":[{"size":"CU","subject":"Descaler going into the tank","reason":"x"},{"size":"WS","subject":"Milk fro')).toEqual({ count: 1, subject: "Descaler going into the tank" });
    expect(progressOf('{"deliverables":[{"client":"Nagi","shots":[{"subject":"Hero shot of the bag"}]}],"shots":[{"subject":"Say \\"Nagi\\" out loud"}')).toEqual({ count: 2, subject: 'Say "Nagi" out loud' });
  });
});
