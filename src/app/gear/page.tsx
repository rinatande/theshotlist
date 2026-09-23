"use client";

import Link from "next/link";
import { EmptyGear } from "@/components/EmptyGear";
import styles from "@/components/Gear.module.css";
import { GearBand, GearLinkRow } from "@/components/GearRows";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { CATEGORIES, kitLine } from "@/lib/gear";
import type { GearCategory } from "@/lib/types";
import { useLive } from "@/lib/useLive";

/** Light, audio and power share a band, as G1 draws them. */
const BANDS: { title: string; categories: GearCategory[] }[] = [
  { title: "CAMERAS", categories: ["camera"] },
  { title: "LENSES", categories: ["lens"] },
  { title: "SUPPORT", categories: ["support"] },
  { title: "LIGHT · AUDIO · POWER", categories: ["light", "audio", "power"] },
  { title: "FILTERS", categories: ["filter"] },
  { title: "DRONES", categories: ["drone"] },
];

/**
 * G1 My gear: the library — kits first, then every item by category with
 * its key spec (§6.3). Reached from Projects: gear is content, not a setting.
 */
export default function GearLibrary() {
  const data = useLive(async () => ({ gear: await db.gear.toArray(), kits: await db.kits.toArray() }), []);
  if (!data) return <div className={ui.screen} aria-busy="true" />;
  const { gear, kits } = data;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const order = new Map(CATEGORIES.map((c, i) => [c.value, i]));

  return (
    <div className={ui.screen}>
      <header className={styles.header}>
        <Link href="/" className={ui.backLink}>
          ← PROJECTS
        </Link>
        <h1 className={styles.title}>My gear · {gear.length}</h1>
      </header>

      {gear.length === 0 ? (
        <EmptyGear />
      ) : (
        <>
          <div className={ui.flush}>
            <GearBand title="KITS" count={kits.length}>
              {[...kits].sort(byName).map((k) => (
                <li key={k.id}>
                  <Link href={`/gear/kit?kit=${k.id}`} className={styles.kitRow}>
                    <span className={styles.stack}>
                      <span className={styles.kitName}>{k.name}</span>
                      <span className={styles.line}>{kitLine(k, gear) || "EMPTY"}</span>
                    </span>
                    <span className={styles.kitCount}>
                      {k.itemIds.filter((id) => gear.some((g) => g.id === id)).length} <span aria-hidden="true">›</span>
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/gear/kit" className={styles.addRow}>
                  + NEW KIT
                </Link>
              </li>
            </GearBand>

            {BANDS.map((b) => {
              const items = gear
                .filter((g) => b.categories.includes(g.specs.category))
                .sort((x, y) => (order.get(x.specs.category as never) ?? 9) - (order.get(y.specs.category as never) ?? 9) || byName(x, y));
              if (items.length === 0) return null;
              return (
                <GearBand key={b.title} title={b.title} count={items.length}>
                  {items.map((g) => (
                    <GearLinkRow key={g.id} item={g} href={`/gear/item?item=${g.id}`} />
                  ))}
                </GearBand>
              );
            })}
          </div>

          <div className={ui.footer}>
            <Link href="/gear/item" className={ui.primary}>
              + ADD GEAR
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
