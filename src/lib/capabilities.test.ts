import { describe, expect, it } from "vitest";
import { capabilities, THRESHOLDS } from "./capabilities";
import type { GearItem, GearSpecs } from "./types";

const item = (specs: GearSpecs): GearItem => ({ id: specs.category, name: specs.category, specs });
const caps = (...specs: GearSpecs[]) => [...capabilities(specs.map(item))].sort();

describe("capabilities", () => {
  it("is empty with nothing packed", () => {
    expect(caps()).toEqual([]);
  });

  it("reads a zoom lens at both ends of its range", () => {
    expect(caps({ category: "lens", focalMin: 18, focalMax: 105, maxAperture: 4 })).toEqual(["tele", "wide"]);
  });

  it("grants fast at the threshold, not above it", () => {
    const at = { category: "lens", focalMin: 50, focalMax: 50, maxAperture: THRESHOLDS.fastMaxAperture } as const;
    expect(caps(at)).toEqual(["fast"]);
    expect(caps({ ...at, maxAperture: 2.8 })).toEqual([]);
  });

  it("uses the edges of the thresholds inclusively", () => {
    expect(caps({ category: "lens", focalMin: 24, focalMax: 24, maxAperture: 4 })).toEqual(["wide"]);
    expect(caps({ category: "lens", focalMin: 70, focalMax: 70, maxAperture: 4 })).toEqual(["tele"]);
    expect(caps({ category: "lens", focalMin: 25, focalMax: 69, maxAperture: 4 })).toEqual([]);
  });

  it("knows the 85 f/1.8 is tele and fast", () => {
    expect(caps({ category: "lens", focalMin: 85, focalMax: 85, maxAperture: 1.8 })).toEqual(["fast", "tele"]);
  });

  it("maps support by type; a monopod grants nothing yet", () => {
    expect(caps({ category: "support", type: "tripod" })).toEqual(["tripod"]);
    expect(caps({ category: "support", type: "gimbal" })).toEqual(["gimbal"]);
    expect(caps({ category: "support", type: "monopod" })).toEqual([]);
  });

  it("gives any audio 'mic', and a lav 'lav' as well", () => {
    expect(caps({ category: "audio", type: "shotgun" })).toEqual(["mic"]);
    expect(caps({ category: "audio", type: "lav" })).toEqual(["lav", "mic"]);
  });

  it("reads slow motion from the camera's frame rate", () => {
    expect(caps({ category: "camera", maxFps: 120 })).toEqual(["slowmo"]);
    expect(caps({ category: "camera", maxFps: 60 })).toEqual([]);
    expect(caps({ category: "camera" })).toEqual([]);
  });

  it("combines a pocket kit into one set", () => {
    expect(
      caps(
        { category: "lens", focalMin: 15, focalMax: 15, maxAperture: 2 },
        { category: "power", capacityMah: 10000 },
        { category: "drone" },
        { category: "light" },
        { category: "grip" },
      ),
    ).toEqual(["drone", "fast", "light", "power", "wide"]);
  });
});
