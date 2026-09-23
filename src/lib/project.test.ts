import { describe, expect, it } from "vitest";
import { addDays, createProject, defaultProjectName } from "./project";
import { REEL_SILENT } from "./test-helpers";

let n = 0;
const ids = () => `id${n++}`;
const now = new Date(2026, 8, 18, 9, 0);

describe("createProject", () => {
  it("falls back to '<date> shoot' when no name is typed (§5.1)", () => {
    expect(createProject({ format: REEL_SILENT, dayCount: 1 }, now, ids).name).toBe("18 Sep shoot");
    expect(createProject({ name: "   ", format: REEL_SILENT, dayCount: 1 }, now, ids).name).toBe("18 Sep shoot");
    expect(createProject({ name: " Kyoto ", format: REEL_SILENT, dayCount: 1 }, now, ids).name).toBe("Kyoto");
  });

  it("makes one day per day of shooting, dated from the start", () => {
    const p = createProject({ format: REEL_SILENT, dayCount: 3, startDate: "2026-09-30" }, now, ids);
    expect(p.days.map((d) => [d.index, d.date])).toEqual([
      [1, "2026-09-30"],
      [2, "2026-10-01"],
      [3, "2026-10-02"],
    ]);
  });

  it("starts self-shot with nothing planned", () => {
    const p = createProject({ format: REEL_SILENT, dayCount: 1 }, now, ids);
    expect(p.cast.lead).toBe("me");
    expect(p.cast.leadMember?.presence).toBe("part");
    expect([p.shots, p.locations, p.briefs, p.gear]).toEqual([[], [], [], []]);
  });
});

describe("defaultProjectName", () => {
  it("uses day and short month", () => {
    expect(defaultProjectName(new Date(2026, 0, 2))).toBe("2 Jan shoot");
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
