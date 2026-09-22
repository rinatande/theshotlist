import { describe, expect, it } from "vitest";
import { coverageFor, findActions } from "./actions";

const COFFEE = "Aesthetic vlog of me descaling and flushing coffee machine at home then making a latte.";
const KYOTO =
  "Brand deal with Nagi Coffee. They need a hero shot of the bag, someone pouring, and a short clip where I say the name out loud. Rest of the day is wandering Higashiyama at sunrise — quiet, no talking, lots of texture and steam.";

const phrases = (t: string) => findActions(t).map((a) => a.phrase);

describe("findActions", () => {
  it("finds the actions in Rina's coffee brief, sharing an object across 'and'", () => {
    expect(phrases(COFFEE)).toEqual(["Descaling the coffee machine", "Flushing the coffee machine", "Making a latte"]);
    expect(findActions(COFFEE)[0].place).toBe("home");
  });

  it("reads the board's Kyoto brief: someone pouring, wandering a place; not 'no talking'", () => {
    const found = findActions(KYOTO);
    expect(found.map((a) => a.phrase)).toEqual(["Someone pouring", "Wandering Higashiyama"]);
    expect(found[1].kind).toBe("movement");
  });

  it("turns a plain verb after 'then' or 'I'll' into an action", () => {
    expect(phrases("Prep the veg, then cook the stir fry and I'll plate it up.")).toEqual(["Cooking the stir fry", "Plating it up"]);
  });

  it("ignores -ing words that aren't actions, and talk about filming", () => {
    expect(phrases("Morning at the wedding, filming the evening, nothing else.")).toEqual([]);
    expect(phrases("I need a clean shot and want to be quick.")).toEqual([]);
  });
});

describe("coverageFor", () => {
  it("covers each task as a sequence and ends on what was made", () => {
    const shots = coverageFor(findActions(COFFEE));
    const subjects = shots.map((s) => `${s.size} ${s.subject}`);
    expect(subjects[0]).toBe("WS Home — the whole set-up, wide");
    expect(subjects).toContain("MS Descaling the coffee machine");
    expect(subjects).toContain("INS Flushing the coffee machine — hands, close");
    expect(subjects).toContain("CU Making a latte — the moment you can see it working");
    expect(subjects[subjects.length - 1]).toBe("CU The finished latte");
    expect(shots[1].reason).toContain("You said “descaling the coffee machine”.");
  });

  it("covers moving through a place differently from a task", () => {
    const shots = coverageFor(findActions("Wandering Higashiyama at sunrise."));
    expect(shots.map((s) => s.subject)).toEqual([
      "Wandering Higashiyama — wide, small in the frame",
      "Wandering Higashiyama — following from behind",
      "Wandering Higashiyama — feet on the ground",
    ]);
  });

  it("gives every shot a stable id, so generating again doesn't duplicate", () => {
    const a = coverageFor(findActions(COFFEE)).map((s) => s.id);
    const b = coverageFor(findActions(COFFEE)).map((s) => s.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});
