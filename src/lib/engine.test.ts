import { describe, expect, it } from "vitest";
import { matchChips } from "./chips";
import { addSuggestions, suggest } from "./engine";
import { shotNumbers } from "./shotNumbers";
import { day, loc, project, REEL_SILENT, shot } from "./test-helpers";
import type { GearItem } from "./types";

const labels = (text: string) => matchChips(text).map((c) => c.label);
const KYOTO =
  "Brand deal with Nagi Coffee. They need a hero shot of the bag, someone pouring, and a short clip where I say the name out loud. Rest of the day is wandering Higashiyama at sunrise — quiet, no talking, lots of texture and steam.";

describe("matchChips (§5.6, offline)", () => {
  it("finds the board's chips in the board's brief", () => {
    const found = labels(KYOTO);
    for (const l of ["SUNRISE", "SILENT B-ROLL", "HIGASHIYAMA", "BRAND DEAL", "QUIET", "TEXTURE", "SAY THE NAME"]) expect(found).toContain(l);
  });

  it("keeps a run of capitalised words together as one place", () => {
    expect(labels(KYOTO)).toContain("NAGI COFFEE");
  });

  it("doesn't take the first word of a sentence, a day or a dictionary word as a place", () => {
    const found = labels("Sunrise at the lake. Then Tuesday we drive. Market day in Orange, Bathurst.");
    expect(found).not.toContain("SUNRISE TUESDAY");
    expect(found).not.toContain("TUESDAY");
    expect(found).not.toContain("THEN");
    expect(found).toEqual(expect.arrayContaining(["SUNRISE", "ORANGE", "BATHURST"]));
  });

  it("matches whole words and phrases only", () => {
    expect(labels("a snowboard")).not.toContain("SNOW");
    expect(labels("golden hour on the cliffs")).toContain("GOLDEN HOUR");
  });

  it("gives time-of-day chips their light", () => {
    expect(matchChips("shoot at dusk").find((c) => c.label === "SUNSET")?.light).toBe("golden");
  });
});

describe("suggest (§6.2)", () => {
  const travel = project({ format: REEL_SILENT, budgetOverride: { min: 18, max: 24 } });

  it("fills toward the top of the budget, less what's planned", () => {
    const r = suggest(travel);
    expect(r.room).toBe(24);
    expect(r.suggestions.length).toBeLessThanOrEqual(24);
    expect(r.suggestions.length).toBeGreaterThan(8);
    const withShots = project({ ...travel, shots: [shot("a", 0), shot("b", 1)] });
    expect(suggest(withShots).room).toBe(22);
  });

  it("only offers templates that fit the kind and treatment", () => {
    const r = suggest(travel);
    expect(r.suggestions.find((s) => s.templateId === "interview-main")).toBeUndefined(); // interview-only
    expect(r.suggestions.find((s) => s.templateId === "hero-product")).toBeUndefined(); // brand-only
  });

  it("with no gear, rewrites what it can and withholds the rest (§6.2 step 4)", () => {
    const r = suggest(travel, { limit: 100 });
    const lapse = r.suggestions.find((s) => s.templateId === "cloud-lapse");
    expect(lapse?.fallback).toBe(true);
    expect(r.suggestions.find((s) => s.templateId === "neon-night")).toBeUndefined(); // needs a fast lens, no fallback
    expect(r.withheld).toBeGreaterThan(0);
  });

  it("names the gear item that earned a shot", () => {
    const tripod: GearItem = { id: "t", name: "Peak travel tripod", specs: { category: "support", type: "tripod" } };
    const lapse = suggest(travel, { packed: [tripod], limit: 100 }).suggestions.find((s) => s.templateId === "sunset-lapse");
    expect(lapse?.fallback).toBe(false);
    expect(lapse?.reason).toContain("Peak travel tripod");
  });

  it("ranks what the brief asks for first", () => {
    const r = suggest(travel, { brief: "coffee and steam at sunrise", chips: matchChips("coffee and steam at sunrise"), limit: 3 });
    expect(r.suggestions.map((s) => s.templateId)).toContain("steam-backlit");
  });

  it("never suggests a template already on the list", () => {
    const has = project({ ...travel, shots: [shot("s", 0, { templateId: "steam-backlit", source: "template" })] });
    expect(suggest(has, { limit: 100 }).suggestions.find((s) => s.templateId === "steam-backlit")).toBeUndefined();
  });

  it("doesn't need a face when nobody's on camera", () => {
    const noOne = project({ ...travel, cast: { lead: "no-one", supporting: [], operatorPresence: "none" } });
    const r = suggest(noOne, { limit: 100 });
    expect(r.suggestions.every((s) => !["reaction-cu"].includes(s.templateId))).toBe(true);
  });

  it("varies the sizes instead of stacking one", () => {
    const sizes = new Set(suggest(travel, { limit: 6 }).suggestions.map((s) => s.size));
    expect(sizes.size).toBeGreaterThanOrEqual(4);
  });
});

describe("coverage from the brief (build-journal, 22 Sep)", () => {
  const vlog = project({ format: { genre: "personal", treatment: "silent", delivery: "short", aspect: "9:16" } });
  const brief = "Aesthetic vlog of me descaling and flushing coffee machine at home then making a latte.";

  it("puts Rina's coffee brief's own actions first, in order", () => {
    const r = suggest(vlog, { brief, chips: matchChips(brief) });
    const top = r.suggestions.slice(0, 5).map((s) => s.subject);
    expect(top[0]).toBe("Home — the whole set-up, wide");
    expect(top).toContain("Descaling the coffee machine");
    expect(r.suggestions.some((s) => s.subject === "The finished latte")).toBe(true);
    expect(r.suggestions.filter((s) => s.fromBrief).length).toBeGreaterThanOrEqual(10);
  });

  it("still fills the rest from templates, up to the budget", () => {
    const r = suggest(vlog, { brief });
    expect(r.suggestions.some((s) => !s.fromBrief)).toBe(true);
    expect(r.suggestions.length).toBeLessThanOrEqual(r.room);
  });

  it("places brief coverage in a location whose name matches", () => {
    const withHome = project({ ...vlog, locations: [loc("home", 0, { name: "Home kitchen" })] });
    const setup = suggest(withHome, { brief }).suggestions.find((s) => s.subject.startsWith("Home —"));
    expect(setup?.locationId).toBe("home");
  });

  it("doesn't suggest the same coverage twice once it's on the list", () => {
    const first = suggest(vlog, { brief });
    const after = addSuggestions(vlog, first.suggestions.slice(0, 3), "brief", new Date(0));
    const again = suggest(after, { brief }).suggestions.map((s) => s.templateId);
    for (const s of first.suggestions.slice(0, 3)) expect(again).not.toContain(s.templateId);
  });
});

describe("placing and adding", () => {
  it("puts sunrise shots in the morning location and golden ones in the evening", () => {
    const p = project({
      format: REEL_SILENT,
      locations: [loc("dawn", 0, { startTime: 360 }), loc("dusk", 1, { startTime: 1050 }), loc("free", 2)],
    });
    const r = suggest(p, { limit: 100 });
    expect(r.suggestions.find((s) => s.light === "sunrise")?.locationId).toBe("dawn");
    expect(r.suggestions.find((s) => s.light === "golden")?.locationId).toBe("dusk");
  });

  it("spreads unplaced shots across days by their budgets", () => {
    const p = project({ format: REEL_SILENT, dayCount: 2, days: [day("d1", 1), day("d2", 2)], budgetOverride: { min: 10, max: 10 } });
    const r = suggest(p);
    const d1 = r.suggestions.filter((s) => s.dayId === "d1").length;
    const d2 = r.suggestions.filter((s) => s.dayId === "d2").length;
    expect(Math.abs(d1 - d2)).toBeLessThanOrEqual(1);
  });

  it("adds them as shots that keep their reason and template", () => {
    const p = project({ format: REEL_SILENT });
    const picks = suggest(p, { limit: 3 }).suggestions;
    const next = addSuggestions(p, picks, "template", new Date(0));
    expect(next.shots).toHaveLength(3);
    expect(next.shots.every((s) => s.reason && s.templateId && s.source === "template" && s.movement && s.audio)).toBe(true);
    expect(shotNumbers(next).size).toBe(3);
  });
});
