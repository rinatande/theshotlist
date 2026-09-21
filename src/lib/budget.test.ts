import { describe, expect, it } from "vitest";
import { BUDGET_TABLE, budget, dayBudgets, projectBudget } from "./budget";
import { day, project, REEL_SILENT } from "./test-helpers";
import type { Format } from "./types";

const custom = (lengthSeconds: number | undefined, treatment: Format["treatment"] = "silent"): Format => ({
  ...REEL_SILENT,
  treatment,
  delivery: "custom",
  lengthSeconds,
});

describe("budget", () => {
  it("reads the table for a preset", () => {
    expect(budget(REEL_SILENT)).toEqual({ min: 18, max: 24 });
    expect(budget({ ...REEL_SILENT, treatment: "scripted", delivery: "short" })).toEqual({ min: 24, max: 32 });
  });

  it("keeps silent at about 1.5x talking to camera (§5.1)", () => {
    for (const delivery of ["reel", "short", "mid", "long"] as const) {
      const talking = BUDGET_TABLE["talking-to-camera"][delivery];
      const silent = BUDGET_TABLE.silent[delivery];
      expect(silent.min / talking.min).toBeCloseTo(1.5, 1);
      expect(silent.max / talking.max).toBeCloseTo(1.5, 1);
    }
  });

  it("is always a range with min below max", () => {
    for (const row of Object.values(BUDGET_TABLE)) {
      for (const b of Object.values(row)) expect(b.min).toBeLessThan(b.max);
    }
  });

  it("matches a preset exactly when custom is that preset's length", () => {
    expect(budget(custom(45))).toEqual(budget(REEL_SILENT));
    expect(budget(custom(900))).toEqual(BUDGET_TABLE.silent.long);
  });

  it("interpolates custom between the columns either side", () => {
    // Halfway between short (120s: 30–40) and mid (450s: 48–64).
    expect(budget(custom(285))).toEqual({ min: 39, max: 52 });
  });

  it("shrinks in proportion below a reel, never under one shot", () => {
    expect(budget(custom(15))).toEqual({ min: 6, max: 8 }); // a third of 18–24
    expect(budget(custom(1))).toEqual({ min: 1, max: 1 });
  });

  it("carries on growing past a long cut", () => {
    expect(budget(custom(1800)).max).toBeGreaterThan(BUDGET_TABLE.silent.long.max);
  });

  it("treats a custom delivery with no length yet as one minute", () => {
    expect(budget(custom(undefined))).toEqual(budget(custom(60)));
  });
});

describe("projectBudget", () => {
  it("uses the person's override when there is one", () => {
    expect(projectBudget(project({ budgetOverride: { min: 5, max: 9 } }))).toEqual({ min: 5, max: 9 });
    expect(projectBudget(project())).toEqual({ min: 18, max: 24 });
  });
});

describe("dayBudgets", () => {
  const threeDays = [day("d1", 1), day("d2", 2), day("d3", 3)];

  it("splits evenly and always sums to the whole", () => {
    const b = dayBudgets(project({ budgetOverride: { min: 44, max: 52 }, days: threeDays }));
    expect([...b.values()]).toEqual([
      { min: 15, max: 18 },
      { min: 15, max: 17 },
      { min: 14, max: 17 },
    ]);
  });

  it("gives earlier days the remainder, in day order not array order", () => {
    const b = dayBudgets(project({ budgetOverride: { min: 10, max: 11 }, days: [day("d2", 2), day("d1", 1), day("d3", 3)] }));
    expect(b.get("d1")).toEqual({ min: 4, max: 4 });
    expect(b.get("d2")).toEqual({ min: 3, max: 4 });
    expect(b.get("d3")).toEqual({ min: 3, max: 3 });
  });

  it("keeps an edited day and splits the rest between the others", () => {
    const days = [day("d1", 1), day("d2", 2, { budget: { min: 20, max: 24 } }), day("d3", 3)];
    const b = dayBudgets(project({ budgetOverride: { min: 44, max: 52 }, days }));
    expect(b.get("d2")).toEqual({ min: 20, max: 24 });
    expect(b.get("d1")).toEqual({ min: 12, max: 14 });
    expect(b.get("d3")).toEqual({ min: 12, max: 14 });
  });

  it("never goes negative when edited days already exceed the whole", () => {
    const days = [day("d1", 1, { budget: { min: 30, max: 40 } }), day("d2", 2)];
    expect(dayBudgets(project({ days })).get("d2")).toEqual({ min: 0, max: 0 });
  });

  it("gives a single day the whole budget", () => {
    expect(dayBudgets(project({ days: [day("d1", 1)] })).get("d1")).toEqual({ min: 18, max: 24 });
  });
});
