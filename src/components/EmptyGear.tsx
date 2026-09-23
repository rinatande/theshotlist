"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { fromStarter, startFromKit, STARTER_KITS, type StarterKit } from "@/lib/gear";
import type { Project } from "@/lib/types";
import { saveProject } from "@/lib/useProject";
import styles from "./Gear.module.css";
import ui from "./ui.module.css";

/**
 * E6: nothing in the bag yet. The same content in both places gear lives —
 * standalone from Projects, and a project's GEAR tab, where the header and
 * tabs stay (§6.3). A starter kit becomes your own items, to rename after.
 */
export function EmptyGear({ project }: { project?: Project }) {
  const router = useRouter();
  const back = project ? `/project?id=${project.id}&tab=gear` : "/gear";

  const start = async (starter: StarterKit) => {
    const { items, kit } = fromStarter(starter);
    await db.transaction("rw", db.gear, db.kits, async () => {
      await db.gear.bulkAdd(items);
      await db.kits.add({ ...kit, isDefault: true });
    });
    if (!project) return; // the library screen fills in by itself
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(startFromKit(latest, kit, items));
    router.push(`/gear/shoot?id=${project.id}`);
  };

  return (
    <div className={styles.empty}>
      <p className={styles.emptyLead}>Nothing in the bag yet.</p>
      <p className={styles.emptyText}>Start from a kit that&apos;s close and edit it — faster than typing every item, and you can change anything after.</p>

      <span className={ui.label}>START FROM A KIT</span>
      <ul className={styles.starters}>
        {STARTER_KITS.map((s) => (
          <li key={s.id}>
            <button type="button" className={styles.starter} onClick={() => start(s)}>
              <span className={styles.starterText}>
                <span className={styles.starterName}>{s.name}</span>
                <span className={styles.starterLine}>{s.line}</span>
              </span>
              <span aria-hidden="true" className={styles.chevron}>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.or}>OR</p>
      <Link href={`/gear/item?back=${encodeURIComponent(back)}`} className={styles.starter}>
        <span className={styles.starterText}>
          <span className={styles.starterName}>Add one item by hand</span>
        </span>
        <span aria-hidden="true" className={styles.chevron}>
          ›
        </span>
      </Link>

      <div className={ui.box}>
        <span className={ui.boxHeading}>WHY TYPED</span>
        <p className={ui.boxText}>
          &ldquo;Sony 85 f/1.8&rdquo; is just a name. Recording it as 85mm at f1.8 is what lets the app know you can get a tight insert and still shoot past dusk.
        </p>
      </div>
      <p className={ui.hint}>Skip this and the app still works — it just suggests generic shots instead of ones that fit your bag.</p>
    </div>
  );
}
