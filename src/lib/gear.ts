import starterKits from "@/data/starterKits.json";
import templates from "@/data/templates.json";
import { capabilities } from "./capabilities";
import { capitalise, inWords } from "./words";
import type { Capability, GearCategory, GearItem, GearSpecs, Id, Kit, Project, TemplateShot } from "./types";

/**
 * Gear (design.md §6) as pure functions: labels, what an item unlocks,
 * starter kits, and the gear a project brings. Gear generates, it never
 * polices — nothing here hides or flags a shot.
 */

const touch = (p: Project, now: Date): Project => ({ ...p, updatedAt: now.toISOString() });

/** Chip order on Add gear (G2). Grip is left out: it unlocks nothing (Rina, 23 Sep). */
export const CATEGORIES: { value: Exclude<GearCategory, "grip">; label: string; band: string }[] = [
  { value: "camera", label: "CAMERA", band: "CAMERAS" },
  { value: "lens", label: "LENS", band: "LENSES" },
  { value: "support", label: "SUPPORT", band: "SUPPORT" },
  { value: "light", label: "LIGHT", band: "LIGHT" },
  { value: "audio", label: "AUDIO", band: "AUDIO" },
  { value: "power", label: "POWER", band: "POWER" },
  { value: "drone", label: "DRONE", band: "DRONES" },
];

const SHORT: Record<GearCategory, string> = { camera: "CAM", lens: "LENS", support: "SUPPORT", light: "LIGHT", audio: "AUDIO", power: "PWR", grip: "GRIP", drone: "DRONE" };

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}—${max}`);
const f = (n: number) => `f${n}`;

/** The key spec on the right of a row (G1, G3, G4): "85 · f1.8", "TRIPOD · 4KG · 150CM". */
export function specLine(specs: GearSpecs): string {
  const parts: (string | number | false | undefined)[] = [];
  switch (specs.category) {
    case "camera":
      if (specs.builtInLens) parts.push(`FIXED ${range(specs.builtInLens.focalMin, specs.builtInLens.focalMax)}`);
      else if (specs.mount) parts.push(specs.mount.toUpperCase());
      if (specs.maxFps && specs.maxFps >= 100) parts.push(`${specs.maxFps}FPS`);
      if (specs.batteries) parts.push(`${specs.batteries} BATT`);
      break;
    case "lens":
      parts.push(range(specs.focalMin, specs.focalMax), f(specs.maxAperture), specs.macro && "MACRO");
      break;
    case "support":
      parts.push(specs.type.toUpperCase(), specs.maxLoadKg && `${specs.maxLoadKg}KG`, specs.maxHeightCm && `${specs.maxHeightCm}CM`);
      break;
    case "light":
      parts.push(specs.outputW && `${specs.outputW}W`, specs.colour && (specs.colour === "bi" ? "BI-COLOUR" : specs.colour.toUpperCase()), specs.battery && "BATTERY");
      break;
    case "audio":
      parts.push(specs.type === "lav" && (specs.channels ?? 1) > 1 ? `LAV ×${specs.channels}` : specs.type.toUpperCase());
      break;
    case "power":
      parts.push(`${specs.capacityMah}MAH`);
      break;
    case "drone":
      parts.push("DRONE", specs.maxWindKmh && `${specs.maxWindKmh}KM/H WIND`);
      break;
    case "grip":
      parts.push("GRIP");
      break;
  }
  return parts.filter(Boolean).join(" · ");
}

/** "CAM · 2 LENS · SUPPORT · AUDIO · PWR" — or EVERYTHING when a kit is the whole library (G1). */
export function kitLine(kit: Kit, library: GearItem[]): string {
  const items = library.filter((g) => kit.itemIds.includes(g.id));
  if (library.length > 0 && items.length === library.length) return "EVERYTHING";
  const counts = new Map<GearCategory, number>();
  for (const g of items) counts.set(g.specs.category, (counts.get(g.specs.category) ?? 0) + 1);
  const order: GearCategory[] = ["camera", "lens", "support", "light", "audio", "power", "drone", "grip"];
  return order
    .filter((c) => counts.has(c))
    .map((c) => (counts.get(c)! > 1 ? `${counts.get(c)} ${SHORT[c]}` : SHORT[c]))
    .join(" · ");
}

const WHAT: Record<Capability, string> = {
  wide: "Wide establishing shots, and room to work in tight spaces.",
  tele: "Tight inserts and compressed backgrounds.",
  fast: "Shallow focus, and shooting on past dusk.",
  macro: "Extreme close detail — texture, droplets, frost.",
  tripod: "Locked-off shots, lapses and long holds.",
  gimbal: "Smooth moving shots — follows and one-take walks.",
  slider: "Slow reveals and parallax moves.",
  drone: "Aerials — reveals from above and top-down frames.",
  mic: "Sound worth keeping, not just guide audio.",
  lav: "Speech that holds up — pieces to camera and interviews.",
  slowmo: "Slow motion — pours, splashes, hair in the wind.",
  light: "Interiors, and shooting on after the light goes.",
  power: "Long lapses without touching a battery.",
};

const ALL = templates as TemplateShot[];

/**
 * G2's UNLOCKS block: what adding this item does to your suggestions — the
 * one place the app explains itself before you've felt the benefit (§6.3).
 * Only what it adds beyond gear you already have is counted.
 */
export function unlocksLine(specs: GearSpecs, library: GearItem[] = []): string {
  const have = capabilities(library);
  const mine = [...capabilities([{ id: "", name: "", specs }])];
  if (mine.length === 0) return "Nothing new on its own — it's recorded on the shots that use it.";
  const fresh = mine.filter((c) => !have.has(c));
  const lead = mine.map((c) => WHAT[c])[0];
  if (fresh.length === 0) return `${lead} Your gear already covers that, so suggestions won't change.`;
  const opened = ALL.filter((t) => t.requires.some((r) => fresh.includes(r)) && t.requires.every((r) => have.has(r) || mine.includes(r))).length;
  return `${lead} ${opened === 0 ? "Suggestions will name it where it earns a shot." : `${opened === 1 ? "One more suggestion" : `${capitalise(inWords(opened))} more suggestions`} will start appearing.`}`;
}


// ─── Starter kits (E6) ───────────────────────────────────────────────────────

export interface StarterKit {
  id: string;
  name: string;
  line: string;
  items: { name: string; specs: GearSpecs }[];
}

export const STARTER_KITS = starterKits as StarterKit[];

/** A starter kit as your own gear: new library items and a kit holding them, to rename and edit. */
export function fromStarter(starter: StarterKit, newId: () => string = () => crypto.randomUUID()): { items: GearItem[]; kit: Kit } {
  const items = starter.items.map((i) => ({ id: newId(), name: i.name, specs: structuredClone(i.specs) }));
  return { items, kit: { id: newId(), name: starter.name, itemIds: items.map((i) => i.id) } };
}

// ─── A shoot's gear (G3, G4) ─────────────────────────────────────────────────

/** Start from a kit: its items, copied in, as what's coming. Packing ticks for anything left behind go. */
export function startFromKit(p: Project, kit: Kit, library: GearItem[], now = new Date()): Project {
  const gear = library.filter((g) => kit.itemIds.includes(g.id)).map((g) => structuredClone(g));
  return touch({ ...p, kitId: kit.id, gear, packedIds: p.packedIds.filter((id) => gear.some((g) => g.id === id)) }, now);
}

/**
 * Save what's coming: fresh copies of library items, and the project's own
 * copy of anything no longer in the library (§8: a snapshot, not a pointer).
 */
export function setShootGear(p: Project, ids: Id[], library: GearItem[], now = new Date()): Project {
  const byId = new Map([...p.gear, ...library].map((g) => [g.id, g]));
  const gear = ids.map((id) => byId.get(id)).filter((g): g is GearItem => !!g).map((g) => structuredClone(g));
  return touch({ ...p, gear, packedIds: p.packedIds.filter((id) => ids.includes(id)) }, now);
}

/** "DOC DAY +2": how this shoot's gear differs from the kit it started from (G4). */
export function kitDiff(p: Pick<Project, "gear">, kit: Kit | undefined): { added: number; removed: number } {
  if (!kit) return { added: 0, removed: 0 };
  const ids = new Set(p.gear.map((g) => g.id));
  return { added: p.gear.filter((g) => !kit.itemIds.includes(g.id)).length, removed: kit.itemIds.filter((id) => !ids.has(id)).length };
}

/** IN THE BAG: the packing checklist. It never changes what's suggested. */
export function togglePacked(p: Project, id: Id, now = new Date()): Project {
  const packed = p.packedIds.includes(id) ? p.packedIds.filter((x) => x !== id) : [...p.packedIds, id];
  return touch({ ...p, packedIds: packed }, now);
}

/** SAVE AS NEW KIT: what this shoot is bringing, as a kit — only items still in the library. */
export function kitFromShoot(p: Project, name: string, library: GearItem[], newId: () => string = () => crypto.randomUUID()): Kit {
  const inLibrary = new Set(library.map((g) => g.id));
  return { id: newId(), name: name.trim(), itemIds: p.gear.map((g) => g.id).filter((id) => inLibrary.has(id)) };
}

/** The kit line on the Gear tab and above gear suggestions: "ZV-1 · DJI MIC 2 · NO SUPPORT · NO LIGHT". */
export function bagLine(gear: GearItem[]): string {
  const has = (c: GearCategory) => gear.some((g) => g.specs.category === c);
  const names = gear.filter((g) => g.specs.category !== "lens").slice(0, 4).map((g) => g.name.toUpperCase());
  const lenses = gear.filter((g) => g.specs.category === "lens").length;
  const parts = [...names, lenses === 1 ? "1 LENS" : lenses > 1 ? `${lenses} LENS` : ""];
  if (!has("support")) parts.push("NO SUPPORT");
  if (!has("light")) parts.push("NO LIGHT");
  return parts.filter(Boolean).join(" · ");
}

/** Whether the specs are enough for the engine to reason with — SAVE TO GEAR waits for these. */
export function specsComplete(specs: GearSpecs): boolean {
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
  switch (specs.category) {
    case "lens":
      return ok(specs.focalMin) && ok(specs.focalMax) && specs.focalMax >= specs.focalMin && ok(specs.maxAperture);
    case "camera":
      return !specs.builtInLens || specsComplete({ category: "lens", ...specs.builtInLens });
    case "power":
      return ok(specs.capacityMah);
    default:
      return true;
  }
}
