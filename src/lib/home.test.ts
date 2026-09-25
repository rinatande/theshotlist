import { describe, expect, it } from "vitest";
import { daysBetween, gettingReady, greeting, homeCase, inDays, longDate, todayView, whenViewed } from "./home";
import { day, loc, project, shot } from "./test-helpers";

const TODAY = "2026-09-24";

describe("homeCase", () => {
  it("is the first run with no projects", () => {
    expect(homeCase([], TODAY)).toEqual({ kind: "first-run" });
  });

  it("shows today's shoot above one coming up", () => {
    const soon = project({ id: "soon", days: [day("s1", 1, { date: "2026-09-26" })] });
    const now = project({ id: "now", days: [day("n1", 1, { date: TODAY })] });
    const home = homeCase([soon, now], TODAY);
    expect(home.kind).toBe("today");
    if (home.kind === "today") expect(home.project.id).toBe("now");
  });

  it("follows the first day not wrapped, as shoot mode does", () => {
    const p = project({
      days: [day("d1", 1, { date: "2026-09-23", wrappedAt: "2026-09-23T18:00:00Z" }), day("d2", 2, { date: TODAY }), day("d3", 3, { date: "2026-09-25" })],
    });
    const home = homeCase([p], TODAY);
    expect(home.kind === "today" && home.day.id).toBe("d2");
  });

  it("doesn't call a slipped day today", () => {
    // Day 1 was yesterday and never wrapped: Home can't tell if it slipped, so it says nothing about it.
    const p = project({ days: [day("d1", 1, { date: "2026-09-23" }), day("d2", 2, { date: TODAY })] });
    expect(homeCase([p], TODAY).kind).toBe("last-viewed");
  });

  it("uses the start date when day 1 has none", () => {
    const p = project({ startDate: "2026-09-26", days: [day("d1", 1)] });
    const home = homeCase([p], TODAY);
    expect(home.kind === "coming-up" && home.date).toBe("2026-09-26");
  });

  it("puts the soonest shoot first and the rest under LATER", () => {
    const a = project({ id: "a", days: [day("a1", 1, { date: "2026-10-02" })] });
    const b = project({ id: "b", days: [day("b1", 1, { date: "2026-09-26" })] });
    const c = project({ id: "c", days: [day("c1", 1, { date: "2026-12-01" })] });
    const home = homeCase([a, b, c], TODAY);
    expect(home.kind).toBe("coming-up");
    if (home.kind === "coming-up") {
      expect(home.project.id).toBe("b");
      expect(home.later.map((p) => p.id)).toEqual(["a", "c"]);
    }
  });

  it("falls back to the last project viewed beyond two weeks", () => {
    const far = project({ id: "far", updatedAt: "2026-09-20T00:00:00Z", days: [day("f1", 1, { date: "2026-10-20" })] });
    const old = project({ id: "old", updatedAt: "2026-09-01T00:00:00Z" });
    const home = homeCase([far, old], TODAY, "old");
    expect(home.kind).toBe("last-viewed");
    if (home.kind === "last-viewed") {
      expect(home.project.id).toBe("old");
      expect(home.recent.map((p) => p.id)).toEqual(["far"]);
    }
    // With nothing remembered, the most recently changed.
    expect(homeCase([old, far], TODAY).kind === "last-viewed" && (homeCase([old, far], TODAY) as { project: { id: string } }).project.id).toBe("far");
  });
});

describe("the words", () => {
  it("greets by the clock", () => {
    expect(greeting(new Date(2026, 8, 24, 5, 12))).toBe("Morning.");
    expect(greeting(new Date(2026, 8, 24, 12, 0))).toBe("Afternoon.");
    expect(greeting(new Date(2026, 8, 24, 18, 0))).toBe("Evening.");
  });

  it("dates", () => {
    expect(longDate(new Date(2026, 8, 24))).toBe("THURSDAY 24 SEP");
    expect(daysBetween("2026-09-30", "2026-10-02")).toBe(2);
    expect(inDays(TODAY, "2026-09-25")).toBe("TOMORROW");
    expect(inDays(TODAY, "2026-09-26")).toBe("IN 2 DAYS");
    expect(whenViewed(TODAY, "2026-09-23")).toBe("YESTERDAY");
    expect(whenViewed(TODAY, "2026-09-01")).toBe("1 SEP");
  });
});

describe("gettingReady", () => {
  it("reads the four things off the project", () => {
    const gear = [{ id: "g1" }, { id: "g2" }] as never;
    const p = project({
      days: [day("d1", 1, { date: "2026-09-26" })],
      briefs: [{ id: "b", scope: "project", text: "Sunrise at the temple" }],
      shots: [shot("s1", 0), shot("s2", 1)],
      gear,
      packedIds: ["g1"],
    });
    const items = gettingReady(p, p.days[0], "12h");
    expect(items.map((i) => [i.key, i.done])).toEqual([
      ["brief", true],
      ["list", true],
      ["light", false],
      ["gear", false],
    ]);
    expect(items[3].detail).toBe("1 OF 2 IN THE BAG");
  });

  it("finds the light once the place is known", () => {
    const p = project({
      days: [day("d1", 1, { date: "2026-09-26" })],
      coords: { lat: 35.0, lng: 135.78, timeZone: "Asia/Tokyo" } as never,
    });
    const light = gettingReady(p, p.days[0], "12h")[2];
    expect(light.done).toBe(true);
    expect(light.detail).toMatch(/^SUNRISE 5:\d\d AM · SUNSET 5:\d\d PM$/);
  });
});

describe("todayView", () => {
  it("counts today's shots and each client's [★] still to get", () => {
    const p = project({
      days: [day("d1", 1, { date: TODAY })],
      locations: [loc("Cliff path", 0, { startTime: 380 })],
      shots: [
        shot("a", 0, { locationId: "Cliff path", status: "exposed", required: { client: "Sable" } }),
        shot("b", 1, { locationId: "Cliff path", required: { client: "Sable" } }),
        shot("c", 2, { locationId: "Cliff path" }),
        shot("d", 3, { locationId: "Cliff path", status: "dropped" }),
      ],
    });
    const v = todayView(p, p.days[0], "12h");
    expect(v.firstUp).toBe("Cliff path · 6:20 AM");
    expect(v.clients).toEqual([{ client: "Sable", left: 1, of: 2 }]);
    expect([v.exposed, v.total]).toEqual([1, 3]);
    expect(v.light).toBeUndefined();
  });
});
