"use client";

import Link from "next/link";
import { projectBrief } from "@/lib/brief";
import { db } from "@/lib/db";
import { kitDiff, togglePacked } from "@/lib/gear";
import type { Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { saveProject } from "@/lib/useProject";
import { EmptyGear } from "./EmptyGear";
import styles from "./Gear.module.css";
import { GearCheckRow } from "./GearRows";
import ui from "./ui.module.css";

/**
 * G4 / NG4, the GEAR tab: what this shoot is bringing, then IN THE BAG —
 * a packing checklist with the shot row's [ ] / [✓]. Ticking the bag never
 * changes what's suggested; suggestions use everything you're bringing
 * (Rina, 23 Sep).
 */
export function GearTab({ project }: { project: Project }) {
  const data = useLive(async () => ({ count: await db.gear.count(), kits: await db.kits.toArray() }), []);
  if (!data) return <div className={ui.flush} aria-busy="true" />;
  if (data.count === 0 && project.gear.length === 0) return <EmptyGear project={project} />;

  const edit = `/gear/shoot?id=${project.id}`;
  if (project.gear.length === 0)
    return (
      <>
        <div className={styles.empty}>
          <p className={styles.emptyLead}>No gear chosen for this shoot.</p>
          <p className={styles.emptyText}>Pick what&apos;s coming — start from a kit or tick items — and suggestions start fitting your bag.</p>
        </div>
        <div className={ui.footer}>
          <Link href={edit} className={ui.primary}>
            CHOOSE GEAR
          </Link>
        </div>
      </>
    );

  const kit = data.kits.find((k) => k.id === project.kitId);
  const { added, removed } = kitDiff(project, kit);
  const packed = project.gear.filter((g) => project.packedIds.includes(g.id)).length;

  const toggle = async (id: string) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(togglePacked(latest, id));
  };

  return (
    <>
      <div className={ui.flush}>
        <div className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.kitHead}>
              {kit ? kit.name.toUpperCase() : "YOUR OWN PICK"}
              {(added > 0 || removed > 0) && (
                <span className={styles.diff}>
                  {added > 0 && ` +${added}`}
                  {removed > 0 && ` −${removed}`}
                </span>
              )}
            </span>
            <span className={styles.line}>
              {project.gear.length} {project.gear.length === 1 ? "ITEM" : "ITEMS"} FOR THIS SHOOT
            </span>
          </span>
          <Link href={edit} className={styles.edit}>
            EDIT ›
          </Link>
        </div>

        <section aria-labelledby="bag">
          <h2 id="bag" className={styles.band}>
            <span>IN THE BAG</span>
            <span>
              {packed} / {project.gear.length}
            </span>
          </h2>
          <ul className={styles.rows}>
            {project.gear.map((g) => {
              const inBag = project.packedIds.includes(g.id);
              return <GearCheckRow key={g.id} item={g} checked={inBag} struck label={inBag ? "in the bag" : "not packed yet"} onToggle={() => toggle(g.id)} />;
            })}
          </ul>
        </section>
      </div>

      <div className={ui.footer}>
        {/* With a brief, the kit's shots come through it — the read with signal, the brief's words without —
            so they fit the shoot, not just the bag (Rina, 23 Sep). */}
        <Link href={projectBrief(project)?.text.trim() ? `/brief/read?id=${project.id}` : `/suggest?id=${project.id}&from=gear`} className={ui.primary}>
          SUGGEST SHOTS FROM THIS KIT
        </Link>
      </div>
    </>
  );
}
