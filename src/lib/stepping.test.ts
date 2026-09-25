import { describe, expect, it } from "vitest";
import { neighbours, stepOrder } from "./stepping";
import { loc, project, shot } from "./test-helpers";

const p = project({
  locations: [loc("cliff", 0, { name: "Cliff path" }), loc("head", 1, { name: "Headland" })],
  shots: [
    shot("c1", 0, { locationId: "cliff", status: "exposed" }),
    shot("c2", 1, { locationId: "cliff", beat: "closer" }),
    shot("h1", 0, { locationId: "head", beat: "opener" }),
    shot("h2", 1, { locationId: "head", status: "dropped" }),
    shot("u1", 0),
  ],
});

describe("stepping through shots (S3, S3c)", () => {
  it("follows the list by location, exposed and dropped shots included", () => {
    expect(stepOrder(p, "location").map((s) => s.id)).toEqual(["c1", "c2", "h1", "h2", "u1"]);
  });

  it("follows the list by beat when that's how it's grouped", () => {
    const order = stepOrder(p, "beat");
    // Shots with no beat stored are guessed, as the beat view does (§5.4).
    expect(order.map((s) => `${s.id}:${s.arrival}`)).toEqual(["c1:NOW IN HOOK", "h1:NOW IN HOOK", "u1:NOW IN BUILD", "c2:NOW IN PAYOFF", "h2:NOW IN PAYOFF"]);
  });

  it("stops at both ends — no wrap", () => {
    const order = stepOrder(p, "location");
    expect(neighbours(order, "c1")).toMatchObject({ prev: undefined, next: "c2" });
    expect(neighbours(order, "u1")).toMatchObject({ prev: "h2", next: undefined });
  });

  it("says NOW AT only when a step crosses into a new location", () => {
    const order = stepOrder(p, "location");
    expect(neighbours(order, "h1", "next").arrival).toEqual({ text: "NOW AT HEADLAND", count: 2 });
    expect(neighbours(order, "h2", "next").arrival).toBeUndefined();
    // Back across the boundary is an arrival too.
    expect(neighbours(order, "c2", "prev").arrival).toEqual({ text: "NOW AT CLIFF PATH", count: 2 });
    // Opened from the list, not stepped to: no band.
    expect(neighbours(order, "h1").arrival).toBeUndefined();
    expect(neighbours(order, "u1", "next").arrival).toEqual({ text: "NOW UNPLACED", count: 1 });
  });
});
