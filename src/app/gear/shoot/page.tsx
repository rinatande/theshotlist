"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Choice } from "@/components/Choice";
import { EmptyGear } from "@/components/EmptyGear";
import styles from "@/components/Gear.module.css";
import { GearBand, GearCheckRow } from "@/components/GearRows";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { CATEGORIES, setShootGear, specLine } from "@/lib/gear";
import type { GearItem, Kit, Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { saveProject, useProject } from "@/lib/useProject";

/**
 * G3 Gear for this shoot: start from a kit, then tick items in or out, in
 * three bands — bringing, added for this shoot, leaving behind (§6.3).
 * Nothing is saved until DONE.
 */
function ShootGear() {
  const { project } = useProject();
  const data = useLive(async () => ({ gear: await db.gear.toArray(), kits: await db.kits.toArray() }), []);
  if (project === undefined || !data) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  if (data.gear.length === 0 && project.gear.length === 0)
    return (
      <div className={ui.screen}>
        <StepHeader label="Gear for this shoot" back={{ label: "← GEAR", href: `/project?id=${project.id}&tab=gear` }} />
        <EmptyGear project={project} />
      </div>
    );
  return <Picker key={project.id} project={project} library={data.gear} kits={data.kits} />;
}

const categoryLabel = (g: GearItem) => CATEGORIES.find((c) => c.value === g.specs.category)?.label ?? "GEAR";

function Picker({ project, library, kits }: { project: Project; library: GearItem[]; kits: Kit[] }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(() => project.gear.map((g) => g.id));
  const [kitId, setKitId] = useState<string | undefined>(() => (kits.some((k) => k.id === project.kitId) ? project.kitId : undefined));
  const [naming, setNaming] = useState(false);
  const back = `/project?id=${project.id}&tab=gear`;

  // Everything that could come: the library, plus this project's own copies of anything since removed from it.
  const all = [...library, ...project.gear.filter((g) => !library.some((l) => l.id === g.id))];
  const order = new Map(CATEGORIES.map((c, i) => [c.value, i]));
  const sorted = (items: GearItem[]) => [...items].sort((a, b) => (order.get(a.specs.category as never) ?? 9) - (order.get(b.specs.category as never) ?? 9) || a.name.localeCompare(b.name));
  const kit = kits.find((k) => k.id === kitId);
  const bringing = sorted(all.filter((g) => ids.includes(g.id) && (!kit || kit.itemIds.includes(g.id))));
  const added = kit ? sorted(all.filter((g) => ids.includes(g.id) && !kit.itemIds.includes(g.id))) : [];
  const leaving = sorted(all.filter((g) => !ids.includes(g.id)));
  const toggle = (id: string) => setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));

  const done = async () => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject({ ...setShootGear(latest, ids, library), kitId });
    router.replace(back);
  };

  return (
    <div className={ui.screen}>
      <StepHeader label="Gear for this shoot" back={{ label: "← GEAR", href: back }} />

      {kits.length > 0 && (
        <div className={ui.body}>
          <Choice
            label="START FROM A KIT"
            options={kits.map((k) => ({ value: k.id, label: k.name.toUpperCase() }))}
            value={kitId}
            onChange={(id) => {
              const k = kits.find((x) => x.id === id)!;
              setKitId(id);
              setIds(k.itemIds.filter((i) => all.some((g) => g.id === i)));
            }}
          />
        </div>
      )}

      <div className={ui.flush}>
        <GearBand title="BRINGING" count={bringing.length}>
          {bringing.map((g) => (
            <GearCheckRow key={g.id} item={g} checked line={`${categoryLabel(g)} · ${specLine(g.specs)}`} label="bringing — tap to leave it behind" onToggle={() => toggle(g.id)} />
          ))}
        </GearBand>
        {added.length > 0 && (
          <GearBand title="ADDED FOR THIS SHOOT" count={added.length}>
            {added.map((g) => (
              <GearCheckRow key={g.id} item={g} checked line={`+ NOT IN ${kit!.name.toUpperCase()}`} lineAccent label="added for this shoot — tap to leave it behind" onToggle={() => toggle(g.id)} />
            ))}
          </GearBand>
        )}
        {leaving.length > 0 && (
          <GearBand title="LEAVING BEHIND" count={leaving.length}>
            {leaving.map((g) => (
              <GearCheckRow key={g.id} item={g} checked={false} line={`${categoryLabel(g)} · ${specLine(g.specs)}`} label="leaving behind — tap to bring it" onToggle={() => toggle(g.id)} />
            ))}
          </GearBand>
        )}
        <Link href={`/gear/item?back=${encodeURIComponent(`/gear/shoot?id=${project.id}`)}&bring=${project.id}`} className={styles.addRow}>
          + ADD GEAR TO MY LIBRARY
        </Link>
      </div>

      <div className={ui.footer}>
        <div className={styles.footerRow}>
          {ids.length > 0 && (
            <button type="button" className={ui.secondary} onClick={() => setNaming(true)}>
              SAVE AS NEW KIT
            </button>
          )}
          <button type="button" className={ui.primary} onClick={done}>
            DONE
          </button>
        </div>
      </div>

      {naming && (
        <NameKit
          onClose={() => setNaming(false)}
          onSave={async (name) => {
            const kit: Kit = { id: crypto.randomUUID(), name, itemIds: ids.filter((id) => library.some((g) => g.id === id)) };
            await db.kits.add(kit);
            setKitId(kit.id);
            setNaming(false);
          }}
        />
      )}
    </div>
  );
}

function NameKit({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <BottomSheet title="SAVE AS NEW KIT" onClose={onClose}>
      <form
        className={styles.empty}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <div className={ui.field}>
          <label htmlFor="kit-name" className={ui.label}>
            NAME
          </label>
          <input id="kit-name" className={ui.input} autoComplete="off" value={name} placeholder="Coast day" onChange={(e) => setName(e.target.value)} />
          <p className={ui.hint}>What this shoot is bringing becomes a kit you can start the next one from.</p>
        </div>
        <button type="submit" className={name.trim() ? ui.primary : ui.disabled} aria-disabled={!name.trim() || undefined}>
          SAVE KIT
        </button>
      </form>
    </BottomSheet>
  );
}

export default function ShootGearPage() {
  return (
    <Suspense>
      <ShootGear />
    </Suspense>
  );
}
