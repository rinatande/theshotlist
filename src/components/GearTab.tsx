"use client";

import Link from "next/link";
import { projectBrief } from "@/lib/brief";
import { db } from "@/lib/db";
import { kitDiff, togglePacked } from "@/lib/gear";
import type { Project } from "@/lib/types";
import { readsLeft } from "@/lib/readClient";
import { useLive } from "@/lib/useLive";
import { useOnline } from "@/lib/useOnline";
import { useEffect, useState } from "react";
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
  const online = useOnline();
  const [left, setLeft] = useState<{ available: boolean; remaining: number } | null>(null);
  useEffect(() => {
    readsLeft().then(setLeft);
  }, [online]);
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
        <SuggestFromKit project={project} online={online} left={left} />
      </div>
    </>
  );
}

/**
 * Shots for this kit come from reading the brief with it — so the button
 * only shows with a brief, and says it may cost a read (Rina, 23 Sep). A read
 * of the same brief and gear is reused for free; a changed kit reads again.
 */
function SuggestFromKit({ project, online, left }: { project: Project; online: boolean; left: { available: boolean; remaining: number } | null }) {
  if (!projectBrief(project)?.text.trim())
    return (
      <>
        <p className={ui.hint}>Write a brief first — shots for this kit come from reading it.</p>
        <Link href={`/brief?id=${project.id}`} className={ui.secondary}>
          WRITE THE BRIEF
        </Link>
      </>
    );
  const why = !online ? "No signal — reading needs a connection." : left && (!left.available || left.remaining === 0) ? "No reads left today." : undefined;
  if (why)
    return (
      <>
        <p className={ui.hint} id="kit-why">
          {why} Your gear is saved; suggest from it when you can read again.
        </p>
        <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="kit-why">
          SUGGEST SHOTS FROM THIS KIT
        </button>
      </>
    );
  return (
    <>
      <p className={ui.hint}>
        This reads your brief again with this kit, so it may use one of today&apos;s full reads
        {left ? ` (${left.remaining} left)` : ""}. You choose what&apos;s added — nothing on your list is replaced unless you say so.
      </p>
      <Link href={`/brief/read?id=${project.id}`} className={ui.primary}>
        SUGGEST SHOTS FROM THIS KIT
      </Link>
    </>
  );
}
