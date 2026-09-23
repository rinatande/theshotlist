import { describe, expect, it } from "vitest";
import { capabilities } from "./capabilities";
import { bagLine, fromStarter, kitDiff, kitFromShoot, kitLine, setShootGear, specLine, specsComplete, startFromKit, STARTER_KITS, togglePacked, unlocksLine } from "./gear";
import { project } from "./test-helpers";
import type { GearItem } from "./types";

const item = (id: string, name: string, specs: GearItem["specs"]): GearItem => ({ id, name, specs });
const fx30 = item("fx30", "Sony FX30", { category: "camera", mount: "E", batteries: 4 });
const zv1 = item("zv1", "Sony ZV-1", { category: "camera", batteries: 2, builtInLens: { focalMin: 24, focalMax: 70, maxAperture: 1.8 } });
const sigma = item("sigma", "Sigma 18—50 f/2.8", { category: "lens", focalMin: 18, focalMax: 50, maxAperture: 2.8 });
const eightyFive = item("85", "Sony 85 f/1.8", { category: "lens", focalMin: 85, focalMax: 85, maxAperture: 1.8 });
const laowa = item("laowa", "Laowa 15 Macro", { category: "lens", focalMin: 15, focalMax: 15, maxAperture: 4, macro: true });
const befree = item("befree", "Manfrotto Befree", { category: "support", type: "tripod", maxLoadKg: 4, maxHeightCm: 150 });
const mic = item("mic", "DJI Mic 2", { category: "audio", type: "lav", channels: 2 });
const anker = item("anker", "Anker 737", { category: "power", capacityMah: 24000 });
const library = [fx30, sigma, eightyFive, laowa, befree, mic, anker];

describe("labels", () => {
  it("says the key spec the way the boards do", () => {
    expect(specLine(fx30.specs)).toBe("E · 4 BATT");
    expect(specLine(zv1.specs)).toBe("FIXED 24—70 · 2 BATT");
    expect(specLine(sigma.specs)).toBe("18—50 · f2.8");
    expect(specLine(eightyFive.specs)).toBe("85 · f1.8");
    expect(specLine(laowa.specs)).toBe("15 · f4 · MACRO");
    expect(specLine(befree.specs)).toBe("TRIPOD · 4KG · 150CM");
    expect(specLine(mic.specs)).toBe("LAV ×2");
    expect(specLine(anker.specs)).toBe("24000MAH");
  });

  it("sums a kit by category, or says EVERYTHING", () => {
    expect(kitLine({ id: "k", name: "Doc day", itemIds: ["fx30", "sigma", "85", "befree", "mic", "anker"] }, library)).toBe("CAM · 2 LENS · SUPPORT · AUDIO · PWR");
    expect(kitLine({ id: "k", name: "All", itemIds: library.map((g) => g.id) }, library)).toBe("EVERYTHING");
  });

  it("writes the kit line with what's missing named", () => {
    expect(bagLine([zv1, mic, anker])).toBe("SONY ZV-1 · DJI MIC 2 · ANKER 737 · NO SUPPORT · NO LIGHT");
  });
});

describe("what gear unlocks", () => {
  it("counts a phone or compact's own lens", () => {
    expect([...capabilities([zv1])].sort()).toEqual(["fast", "tele", "wide"]);
  });

  it("explains an item before you've felt it, and says when it adds nothing new", () => {
    expect(unlocksLine(eightyFive.specs, [fx30, sigma])).toBe("Tight inserts and compressed backgrounds. The read plans shots around it, and names it where it earns one.");
    expect(unlocksLine(eightyFive.specs, [fx30, sigma, eightyFive])).toMatch(/already covers that/);
    expect(unlocksLine({ category: "camera", mount: "E" })).toMatch(/^Nothing new on its own/);
  });

  it("waits for the specs the engine needs", () => {
    expect(specsComplete({ category: "lens", focalMin: 85, focalMax: 0, maxAperture: 1.8 })).toBe(false);
    expect(specsComplete(eightyFive.specs)).toBe(true);
    expect(specsComplete({ category: "support", type: "tripod" })).toBe(true);
  });
});

describe("starter kits", () => {
  it("become your own items and a kit, with fresh ids", () => {
    let n = 0;
    const { items, kit } = fromStarter(STARTER_KITS[0], () => `id${n++}`);
    expect(kit.name).toBe("Pocket");
    expect(items).toHaveLength(3);
    expect(kit.itemIds).toEqual(items.map((i) => i.id));
    expect(capabilities(items).has("lav")).toBe(true);
  });
});

describe("a shoot's gear", () => {
  const docDay = { id: "doc", name: "Doc day", itemIds: ["fx30", "sigma", "85", "befree", "mic"] };

  it("starts from a kit, as copies", () => {
    const p = startFromKit(project(), docDay, library);
    expect(p.kitId).toBe("doc");
    expect(p.gear.map((g) => g.id)).toEqual(["fx30", "sigma", "85", "befree", "mic"]);
    expect(p.gear[0]).not.toBe(fx30);
  });

  it("keeps its own copy when the library item is gone — a snapshot, not a pointer", () => {
    const p = startFromKit(project(), docDay, library);
    const sold = library.filter((g) => g.id !== "85");
    const q = setShootGear(p, ["fx30", "85", "laowa"], sold);
    expect(q.gear.map((g) => g.name)).toEqual(["Sony FX30", "Sony 85 f/1.8", "Laowa 15 Macro"]);
  });

  it("counts the difference from its kit: DOC DAY +2", () => {
    const p = setShootGear(startFromKit(project(), docDay, library), ["fx30", "sigma", "85", "befree", "mic", "laowa", "anker"], library);
    expect(kitDiff(p, docDay)).toEqual({ added: 2, removed: 0 });
    expect(kitDiff(setShootGear(p, ["fx30"], library), docDay)).toEqual({ added: 0, removed: 4 });
  });

  it("ticks the bag without changing what's coming, and drops ticks for what's left behind", () => {
    let p = startFromKit(project(), docDay, library);
    p = togglePacked(togglePacked(p, "fx30"), "mic");
    expect(p.packedIds).toEqual(["fx30", "mic"]);
    expect(p.gear).toHaveLength(5);
    expect(setShootGear(p, ["fx30"], library).packedIds).toEqual(["fx30"]);
  });

  it("saves what's coming as a new kit, leaving out anything no longer in the library", () => {
    const p = setShootGear(project(), ["fx30", "85"], library);
    const kit = kitFromShoot(p, " Coast ", library.filter((g) => g.id !== "85"), () => "k1");
    expect(kit).toEqual({ id: "k1", name: "Coast", itemIds: ["fx30"] });
  });
});

describe("filters", () => {
  const f = (type: "nd" | "vnd" | "cpl" | "closeup" | "diffusion", strength?: string): GearItem => ({ id: type, name: type, specs: { category: "filter", type, strength } });

  it("unlock what they make possible — ND, polariser, close-up as macro — and diffusion unlocks nothing", () => {
    expect([...capabilities([f("vnd")])]).toEqual(["nd"]);
    expect([...capabilities([f("cpl")])]).toEqual(["polariser"]);
    expect([...capabilities([f("closeup")])]).toEqual(["macro"]);
    expect([...capabilities([f("diffusion")])]).toEqual([]);
    expect(unlocksLine(f("diffusion").specs)).toMatch(/changes the look, not what you can shoot/);
  });

  it("read the way they're written on the ring", () => {
    expect(specLine(f("nd", "6 stops").specs)).toBe("ND · 6 STOPS");
    expect(specLine(f("closeup", "+4").specs)).toBe("CLOSE-UP · +4");
  });
});
