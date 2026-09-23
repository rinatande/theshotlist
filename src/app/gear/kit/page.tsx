"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import styles from "@/components/Gear.module.css";
import { GearBand, GearCheckRow } from "@/components/GearRows";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/gear";
import type { GearItem, Kit } from "@/lib/types";
import { useLive } from "@/lib/useLive";

/**
 * A kit: a name and the items in it, ticked from your library. Not drawn —
 * G1's kit rows needed somewhere to go (Rina, 23 Sep). Deleting a kit never
 * touches a project: a project's gear is its own copy (§8).
 */
function KitScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const kitId = params.get("kit");
  const data = useLive(async () => ({ gear: await db.gear.toArray(), kits: await db.kits.toArray() }), []);
  if (!data) return <div className={ui.screen} aria-busy="true" />;
  const kit = kitId ? data.kits.find((k) => k.id === kitId) : undefined;
  if (kitId && !kit) return <NotHere href="/gear" label="← MY GEAR" />;
  return <KitForm key={kitId ?? "new"} kit={kit} library={data.gear} onDone={() => router.replace("/gear")} />;
}

function KitForm({ kit, library, onDone }: { kit?: Kit; library: GearItem[]; onDone: () => void }) {
  const [name, setName] = useState(kit?.name ?? "");
  const [ids, setIds] = useState<string[]>(() => kit?.itemIds.filter((id) => library.some((g) => g.id === id)) ?? []);
  const [deleting, setDeleting] = useState(false);
  const ready = name.trim().length > 0 && ids.length > 0;

  const save = async () => {
    await db.kits.put({ id: kit?.id ?? crypto.randomUUID(), name: name.trim(), itemIds: ids, isDefault: kit?.isDefault });
    onDone();
  };

  return (
    <div className={ui.screen}>
      <StepHeader label={kit ? "Kit" : "New kit"} back={{ label: "← MY GEAR", href: "/gear" }} />

      <div className={ui.body}>
        <div className={ui.field}>
          <label htmlFor="kit-name" className={ui.label}>
            NAME
          </label>
          <input id="kit-name" className={ui.input} autoComplete="off" value={name} placeholder="Doc day" onChange={(e) => setName(e.target.value)} />
          <p className={ui.hint}>Tick what usually goes in the bag for this kind of shoot. Each project can still add or leave things out.</p>
        </div>
      </div>

      <div className={ui.flush}>
        {CATEGORIES.map((c) => {
          const items = library.filter((g) => g.specs.category === c.value).sort((a, b) => a.name.localeCompare(b.name));
          if (items.length === 0) return null;
          return (
            <GearBand key={c.value} title={c.band} count={items.filter((g) => ids.includes(g.id)).length}>
              {items.map((g) => (
                <GearCheckRow
                  key={g.id}
                  item={g}
                  checked={ids.includes(g.id)}
                  label={ids.includes(g.id) ? "in this kit" : "not in this kit"}
                  onToggle={() => setIds((x) => (x.includes(g.id) ? x.filter((i) => i !== g.id) : [...x, g.id]))}
                />
              ))}
            </GearBand>
          );
        })}
        {kit && (
          <p className={styles.note}>
            <button type="button" className={styles.edit} onClick={() => setDeleting(true)}>
              DELETE KIT
            </button>
          </p>
        )}
      </div>

      <div className={ui.footer}>
        {!ready && (
          <p className={ui.hint} id="kit-why">
            {!name.trim() ? "Give it a name." : "Tick at least one item."}
          </p>
        )}
        {ready ? (
          <button type="button" className={ui.primary} onClick={save}>
            SAVE KIT · {ids.length}
          </button>
        ) : (
          <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="kit-why">
            SAVE KIT
          </button>
        )}
      </div>

      {deleting && kit && (
        <BottomSheet title={`DELETE ${kit.name.toUpperCase()}?`} onClose={() => setDeleting(false)}>
          <div className={styles.empty}>
            <p className={ui.boxText}>The kit goes; the gear in it stays in your library. Projects that started from it keep what they&apos;re bringing.</p>
            <button
              type="button"
              className={ui.destructive}
              onClick={async () => {
                await db.kits.delete(kit.id);
                onDone();
              }}
            >
              DELETE KIT
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

export default function KitPage() {
  return (
    <Suspense>
      <KitScreen />
    </Suspense>
  );
}
