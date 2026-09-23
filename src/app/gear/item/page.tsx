"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Choice } from "@/components/Choice";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { CATEGORIES, FILTER_TYPES, specsComplete, unlocksLine } from "@/lib/gear";
import type { FilterType, GearCategory, GearItem, GearSpecs, Kit } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { useSearchParams } from "next/navigation";
import styles from "./Item.module.css";

type Category = Exclude<GearCategory, "grip">;

/** The form's own shape: numbers stay text until saved, so a half-typed "1." isn't lost. */
interface Draft {
  category: Category;
  name: string;
  num: Record<string, string>;
  flag: Record<string, boolean>;
  mount: string;
  /** A filter's strength as written on it: "6 stops", "+4", "1/8". */
  strength: string;
  kind?: string; // support type, audio type, light colour, or filter type
  kitIds: string[];
}

const blank = (category: Category = "lens"): Draft => ({ category, name: "", num: {}, flag: {}, mount: "", strength: "", kitIds: [] });

function toDraft(item: GearItem, kits: Kit[]): Draft {
  const d = blank(item.specs.category === "grip" ? "camera" : item.specs.category);
  d.name = item.name;
  d.kitIds = kits.filter((k) => k.itemIds.includes(item.id)).map((k) => k.id);
  const s = item.specs;
  const n = (v?: number) => (v === undefined ? "" : String(v));
  switch (s.category) {
    case "camera":
      Object.assign(d.num, { maxFps: n(s.maxFps), batteries: n(s.batteries) });
      d.mount = s.mount ?? "";
      d.flag = { stabilised: !!s.stabilised, builtIn: !!s.builtInLens, macro: !!s.builtInLens?.macro };
      if (s.builtInLens) Object.assign(d.num, { focalMin: n(s.builtInLens.focalMin), focalMax: n(s.builtInLens.focalMax), maxAperture: n(s.builtInLens.maxAperture) });
      break;
    case "lens":
      Object.assign(d.num, { focalMin: n(s.focalMin), focalMax: n(s.focalMax), maxAperture: n(s.maxAperture) });
      d.mount = s.mount ?? "";
      d.flag = { macro: !!s.macro, stabilised: !!s.stabilised };
      break;
    case "support":
      Object.assign(d.num, { maxLoadKg: n(s.maxLoadKg), maxHeightCm: n(s.maxHeightCm) });
      d.kind = s.type;
      d.flag = { fluidHead: !!s.fluidHead };
      break;
    case "light":
      d.num.outputW = n(s.outputW);
      d.kind = s.colour;
      d.flag = { battery: !!s.battery };
      break;
    case "audio":
      d.num.channels = n(s.channels);
      d.kind = s.type;
      d.flag = { windshield: !!s.windshield };
      break;
    case "power":
      d.num.capacityMah = n(s.capacityMah);
      break;
    case "drone":
      d.num.maxWindKmh = n(s.maxWindKmh);
      break;
    case "filter":
      d.kind = s.type;
      d.strength = s.strength ?? "";
      break;
  }
  return d;
}

function toSpecs(d: Draft): GearSpecs {
  const n = (k: string) => {
    const v = parseFloat((d.num[k] ?? "").replace(",", "."));
    return Number.isFinite(v) ? v : undefined;
  };
  const focal = () => {
    const min = n("focalMin") ?? 0;
    return { focalMin: min, focalMax: n("focalMax") ?? min, maxAperture: n("maxAperture") ?? 0 };
  };
  switch (d.category) {
    case "camera":
      return {
        category: "camera",
        mount: d.mount.trim() || undefined,
        maxFps: n("maxFps"),
        batteries: n("batteries"),
        stabilised: d.flag.stabilised || undefined,
        builtInLens: d.flag.builtIn ? { ...focal(), macro: d.flag.macro || undefined } : undefined,
      };
    case "lens":
      return { category: "lens", ...focal(), mount: d.mount.trim() || undefined, macro: d.flag.macro || undefined, stabilised: d.flag.stabilised || undefined };
    case "support":
      return { category: "support", type: (d.kind as "tripod") ?? "tripod", maxLoadKg: n("maxLoadKg"), maxHeightCm: n("maxHeightCm"), fluidHead: d.flag.fluidHead || undefined };
    case "light":
      return { category: "light", outputW: n("outputW"), colour: d.kind as "bi" | undefined, battery: d.flag.battery || undefined };
    case "audio":
      return { category: "audio", type: (d.kind as "shotgun") ?? "shotgun", channels: n("channels"), windshield: d.flag.windshield || undefined };
    case "power":
      return { category: "power", capacityMah: n("capacityMah") ?? 0 };
    case "drone":
      return { category: "drone", maxWindKmh: n("maxWindKmh") };
    case "filter":
      return { category: "filter", type: (d.kind as FilterType) ?? "nd", strength: d.strength.trim() || undefined };
  }
}

/** Kinds that must be picked before saving; the rest have sensible defaults. */
const KINDS: Partial<Record<Category, { label: string; options: { value: string; label: string }[] }>> = {
  support: { label: "TYPE", options: ["tripod", "gimbal", "slider", "monopod"].map((v) => ({ value: v, label: v.toUpperCase() })) },
  audio: { label: "TYPE", options: [{ value: "shotgun", label: "SHOTGUN" }, { value: "lav", label: "LAV" }, { value: "recorder", label: "RECORDER" }] },
  light: { label: "COLOUR", options: [{ value: "daylight", label: "DAYLIGHT" }, { value: "bi", label: "BI-COLOUR" }, { value: "rgb", label: "RGB" }] },
  filter: { label: "TYPE", options: FILTER_TYPES },
};

function ItemScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get("item");
  const backParam = params.get("back");
  const back = backParam?.startsWith("/") ? backParam : "/gear";
  const data = useLive(async () => ({ gear: await db.gear.toArray(), kits: await db.kits.toArray() }), []);
  if (!data) return <div className={ui.screen} aria-busy="true" />;
  const item = itemId ? data.gear.find((g) => g.id === itemId) : undefined;
  if (itemId && !item) return <NotHere href="/gear" label="← MY GEAR" />;
  return <ItemForm key={itemId ?? "new"} item={item} library={data.gear} kits={data.kits} back={back} onDone={() => router.replace(back)} />;
}

function ItemForm({ item, library, kits, back, onDone }: { item?: GearItem; library: GearItem[]; kits: Kit[]; back: string; onDone: () => void }) {
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => {
    if (item) return toDraft(item, kits);
    const cat = params.get("cat");
    return blank(CATEGORIES.some((c) => c.value === cat) ? (cat as Category) : "lens");
  });
  const [deleting, setDeleting] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const num = (k: string, v: string) => setDraft((d) => ({ ...d, num: { ...d.num, [k]: v } }));
  const flag = (k: string) => setDraft((d) => ({ ...d, flag: { ...d.flag, [k]: !d.flag[k] } }));

  const specs = toSpecs(draft);
  const kind = KINDS[draft.category];
  const ready = draft.name.trim().length > 0 && specsComplete(specs) && (!kind || draft.kind !== undefined || draft.category === "light");
  const others = library.filter((g) => g.id !== item?.id);
  const label = CATEGORIES.find((c) => c.value === draft.category)!.label;

  const save = async () => {
    const id = item?.id ?? crypto.randomUUID();
    const saved: GearItem = { id, name: draft.name.trim(), specs, notes: item?.notes };
    // Added from a shoot's gear screen: it's coming on that shoot too.
    const bring = !item ? params.get("bring") : null;
    await db.transaction("rw", db.gear, db.kits, db.projects, async () => {
      await db.gear.put(saved);
      const p = bring ? await db.projects.get(bring) : undefined;
      if (p) await db.projects.put({ ...p, gear: [...p.gear.filter((g) => g.id !== id), structuredClone(saved)], updatedAt: new Date().toISOString() });
      for (const k of kits) {
        const want = draft.kitIds.includes(k.id);
        const has = k.itemIds.includes(id);
        if (want !== has) await db.kits.put({ ...k, itemIds: want ? [...k.itemIds, id] : k.itemIds.filter((x) => x !== id) });
      }
    });
    onDone();
  };

  const remove = async () => {
    // Projects keep their own copy (§8): only the library and its kits change.
    await db.transaction("rw", db.gear, db.kits, async () => {
      await db.gear.delete(item!.id);
      for (const k of kits) if (k.itemIds.includes(item!.id)) await db.kits.put({ ...k, itemIds: k.itemIds.filter((x) => x !== item!.id) });
    });
    onDone();
  };

  const field = (key: string, text: string, hint?: string) => (
    <div className={ui.field}>
      <label htmlFor={`g-${key}`} className={ui.label}>
        {text}
      </label>
      <input id={`g-${key}`} className={ui.input} inputMode="decimal" autoComplete="off" value={draft.num[key] ?? ""} placeholder={hint} onChange={(e) => num(key, e.target.value)} />
    </div>
  );
  const toggles = (items: { key: string; text: string }[]) => (
    <div className={ui.chips}>
      {items.map((t) => (
        <button key={t.key} type="button" role="checkbox" aria-checked={!!draft.flag[t.key]} className={ui.chip} onClick={() => flag(t.key)}>
          {t.text}
        </button>
      ))}
    </div>
  );
  const focal = (
    <div className={styles.three}>
      {field("focalMin", "FOCAL MIN", "mm")}
      {field("focalMax", "FOCAL MAX", "mm")}
      {field("maxAperture", "MAX f", "1.8")}
    </div>
  );
  const mount = (
    <div className={ui.field}>
      <label htmlFor="g-mount" className={ui.label}>
        MOUNT · OPTIONAL
      </label>
      <input id="g-mount" className={ui.input} autoComplete="off" value={draft.mount} placeholder="E, RF, L, MFT" onChange={(e) => set({ mount: e.target.value })} />
    </div>
  );

  const specFields: Record<Category, ReactNode> = {
    camera: (
      <>
        <div className={styles.two}>
          {field("maxFps", "MAX FPS", "120")}
          {field("batteries", "BATTERIES", "2")}
        </div>
        {!draft.flag.builtIn && mount}
        {toggles([
          { key: "stabilised", text: "STABILISED" },
          { key: "builtIn", text: "BUILT-IN LENS" },
        ])}
        {draft.flag.builtIn && (
          <>
            <p className={ui.hint}>A phone or compact: its lens counts like any other, so it can unlock wide, tight and low-light shots.</p>
            {focal}
            {toggles([{ key: "macro", text: "MACRO" }])}
          </>
        )}
      </>
    ),
    lens: (
      <>
        {focal}
        {toggles([
          { key: "macro", text: "MACRO" },
          { key: "stabilised", text: "STABILISED" },
        ])}
        {mount}
      </>
    ),
    support: (
      <>
        <div className={styles.two}>
          {field("maxLoadKg", "MAX LOAD KG", "4")}
          {field("maxHeightCm", "MAX HEIGHT CM", "150")}
        </div>
        {toggles([{ key: "fluidHead", text: "FLUID HEAD" }])}
      </>
    ),
    light: (
      <>
        {field("outputW", "OUTPUT W", "60")}
        {toggles([{ key: "battery", text: "RUNS ON BATTERY" }])}
      </>
    ),
    audio: (
      <>
        {field("channels", "CHANNELS", "2")}
        {toggles([{ key: "windshield", text: "WINDSHIELD" }])}
      </>
    ),
    power: field("capacityMah", "CAPACITY MAH", "20000"),
    drone: field("maxWindKmh", "MAX WIND KM/H · OPTIONAL", "38"),
    filter: (
      <div className={ui.field}>
        <label htmlFor="g-strength" className={ui.label}>
          STRENGTH · OPTIONAL
        </label>
        <input id="g-strength" className={ui.input} autoComplete="off" value={draft.strength} placeholder="6 stops, +4, 1/8" onChange={(e) => set({ strength: e.target.value })} />
      </div>
    ),
  };

  const why = !draft.name.trim() ? "Give it a name." : !ready ? (kind && !draft.kind && draft.category !== "light" ? `Pick a ${kind.label.toLowerCase()}.` : "Fill in the specs above — they're what the app reasons with.") : undefined;

  return (
    <div className={ui.screen}>
      <StepHeader label={item ? "Edit gear" : "New gear"} back={{ label: "← CANCEL", href: back }} />

      <div className={ui.body}>
        <Choice
          label="CATEGORY"
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          value={draft.category}
          onChange={(c) => set({ category: c, kind: undefined, flag: {} })}
        />

        <div className={ui.field}>
          <label htmlFor="g-name" className={ui.label}>
            NAME
          </label>
          <input id="g-name" className={ui.input} autoComplete="off" value={draft.name} placeholder="Sony 85 f/1.8" onChange={(e) => set({ name: e.target.value })} />
        </div>

        <section className={styles.specs} aria-label={`${label} specs`}>
          <span className={ui.label}>{label} SPECS</span>
          {kind && <Choice label={kind.label} options={kind.options} value={draft.kind} onChange={(v) => set({ kind: v })} />}
          {specFields[draft.category]}
        </section>

        {kits.length > 0 && (
          <div className={ui.fieldset}>
            <span className={ui.label}>IN KITS</span>
            <div className={ui.chips}>
              {kits.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="checkbox"
                  aria-checked={draft.kitIds.includes(k.id)}
                  className={ui.chip}
                  onClick={() => set({ kitIds: draft.kitIds.includes(k.id) ? draft.kitIds.filter((x) => x !== k.id) : [...draft.kitIds, k.id] })}
                >
                  {k.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {specsComplete(specs) && (
          <div className={ui.box} aria-live="polite">
            <span className={ui.boxHeading}>UNLOCKS</span>
            <p className={ui.boxText}>{unlocksLine(specs, others)}</p>
          </div>
        )}

        {item && (
          <button type="button" className={styles.delete} onClick={() => setDeleting(true)}>
            DELETE FROM MY GEAR
          </button>
        )}
      </div>

      <div className={ui.footer}>
        {why && (
          <p className={ui.hint} id="save-why">
            {why}
          </p>
        )}
        {ready ? (
          <button type="button" className={ui.primary} onClick={save}>
            SAVE TO GEAR
          </button>
        ) : (
          <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="save-why">
            SAVE TO GEAR
          </button>
        )}
      </div>

      {deleting && item && (
        <BottomSheet title={`DELETE ${item.name.toUpperCase()}?`} onClose={() => setDeleting(false)}>
          <div className={styles.sheet}>
            <p className={ui.boxText}>It leaves your library and your kits. Projects that are bringing it keep their own copy, so no shot list changes.</p>
            <button type="button" className={ui.destructive} onClick={remove}>
              DELETE
            </button>
            <button type="button" className={ui.secondary} onClick={() => setDeleting(false)}>
              KEEP IT
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

export default function ItemPage() {
  return (
    <Suspense>
      <ItemScreen />
    </Suspense>
  );
}
