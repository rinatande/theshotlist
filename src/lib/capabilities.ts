import type { Capability, GearItem } from "./types";

/**
 * What the packed gear makes possible (design.md §6.2). Derived from specs,
 * never stored. Every threshold lives here so it can be tuned in one place.
 *
 * Focal lengths are taken as written on the lens — no crop-factor adjustment
 * yet, since the camera's sensor size isn't in the model.
 */
export const THRESHOLDS = {
  wideMaxFocal: 24, // mm: a lens reaching this wide or wider grants 'wide'
  teleMinFocal: 70, // mm: a lens reaching this long or longer grants 'tele'
  fastMaxAperture: 2, // f-number: this fast or faster grants 'fast'
  slowmoMinFps: 100, // a camera shooting at least this grants 'slowmo'
} as const;

export function capabilities(packed: GearItem[]): Set<Capability> {
  const caps = new Set<Capability>();
  for (const { specs } of packed) {
    switch (specs.category) {
      case "camera":
        if ((specs.maxFps ?? 0) >= THRESHOLDS.slowmoMinFps) caps.add("slowmo");
        break;
      case "lens":
        if (specs.focalMin <= THRESHOLDS.wideMaxFocal) caps.add("wide");
        if (specs.focalMax >= THRESHOLDS.teleMinFocal) caps.add("tele");
        if (specs.maxAperture <= THRESHOLDS.fastMaxAperture) caps.add("fast");
        if (specs.macro) caps.add("macro");
        break;
      case "support":
        if (specs.type === "tripod" || specs.type === "gimbal" || specs.type === "slider") caps.add(specs.type);
        break;
      case "light":
        caps.add("light");
        break;
      case "audio":
        caps.add("mic");
        if (specs.type === "lav") caps.add("lav");
        break;
      case "power":
        caps.add("power");
        break;
      case "drone":
        caps.add("drone");
        break;
      case "grip":
        break;
    }
  }
  return caps;
}
