import { describe, expect, it } from "vitest";
import { dateSpan } from "./labels";
import { projectGroup, projectMarker, progress } from "./status";
import { day, project, shot } from "./test-helpers";

const TODAY = "2026-09-21";

describe("projectGroup", () => {
  it("is planning before anything happens", () => {
    expect(projectGroup(project({ days: [day("d1", 1, { date: "2026-10-02" })] }), TODAY)).toBe("planning");
  });

  it("is in progress once a shot is exposed, a day is wrapped, or the dates include today", () => {
    expect(projectGroup(project({ shots: [shot("s", 0, { status: "exposed" })] }), TODAY)).toBe("in-progress");
    expect(
      projectGroup(project({ days: [day("d1", 1, { wrappedAt: "x" }), day("d2", 2)] }), TODAY),
    ).toBe("in-progress");
    expect(
      projectGroup(project({ days: [day("d1", 1, { date: "2026-09-20" }), day("d2", 2, { date: "2026-09-22" })] }), TODAY),
    ).toBe("in-progress");
  });

  it("is wrapped when every day is", () => {
    expect(projectGroup(project({ days: [day("d1", 1, { wrappedAt: "x" })] }), TODAY)).toBe("wrapped");
  });
});

describe("projectMarker", () => {
  it("shows ! NO LIST on a project with no shots", () => {
    expect(projectMarker(project({ days: [day("d1", 1)] }), TODAY)).toEqual({ kind: "no-list", text: "! NO LIST" });
  });

  it("puts deliverables due ahead of the day", () => {
    const p = project({
      days: [day("d1", 1, { wrappedAt: "x" }), day("d2", 2)],
      shots: [shot("r", 0, { required: { client: "Nagi" } }), shot("s", 1, { status: "exposed" })],
    });
    expect(projectMarker(p, TODAY)).toEqual({ kind: "due", text: "★ 1 DUE" });
  });

  it("names the current day on a multi-day shoot in progress", () => {
    const p = project({ days: [day("d1", 1, { wrappedAt: "x" }), day("d2", 2), day("d3", 3)], shots: [shot("s", 0)] });
    expect(projectMarker(p, TODAY)).toEqual({ kind: "day", text: "DAY 2/3" });
  });
});

describe("progress", () => {
  it("leaves dropped shots out of the count", () => {
    const p = project({
      shots: [shot("a", 0, { status: "exposed" }), shot("b", 1), shot("c", 2, { status: "dropped" })],
    });
    expect(progress(p)).toMatchObject({ exposed: 1, planned: 2 });
  });
});

describe("dateSpan", () => {
  it("writes one date, a span in a month, or a span across months", () => {
    expect(dateSpan({ days: [day("a", 1, { date: "2026-10-02" })] })).toBe("02 OCT");
    expect(dateSpan({ days: [day("a", 1, { date: "2026-09-18" }), day("b", 2, { date: "2026-09-19" })] })).toBe("18—19 SEP");
    expect(dateSpan({ days: [day("a", 1, { date: "2026-09-30" }), day("b", 2, { date: "2026-10-02" })] })).toBe("30 SEP—02 OCT");
    expect(dateSpan({ days: [day("a", 1)] })).toBeUndefined();
  });
});
