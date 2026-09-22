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
    expect(prompt).toContain("room for about 23 more");
    expect(prompt).not.toContain("Secret client film");
  });

  it("hashes the same brief and plan the same way, and a changed brief differently", async () => {
    const ctx = readContext(project());
    expect(await readHash({ brief: "a brief ", context: ctx })).toBe(await readHash({ brief: "a brief", context: ctx }));
    expect(await readHash({ brief: "a brief", context: ctx })).not.toBe(await readHash({ brief: "another", context: ctx }));
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

  it("replace clears what isn't shot and keeps what is (B10, kept safer than the board)", () => {
    const list = project({ shots: [shot("done", 0, { status: "exposed" }), shot("todo", 1), shot("flag", 2, { status: "flagged" }), shot("gone", 3, { status: "dropped" })] });
    expect(clearUnshot(list).shots.map((x) => x.id)).toEqual(["done", "gone"]);
  });
});
