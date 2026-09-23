"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBudget } from "@/lib/budget";
import { db } from "@/lib/db";
import { addSuggestions, suggest, type Suggestion } from "@/lib/engine";
import { bagLine, needsLine } from "@/lib/gear";
import { budgetLabel, formatLine } from "@/lib/labels";
import type { Kit, Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { saveProject } from "@/lib/useProject";
import styles from "./Suggest.module.css";

/** When gear arrives on an existing list, a handful of what it earns — never a replace (Rina, 23 Sep). */
const GEAR_ADDITIONS = 8;

/**
 * G5 / G6: shots from this kit. The kit is stated at the top, every reason
 * line names the item that earned the shot, and what the kit can't do is
 * rewritten or counted — never listed as impossible (§6.2).
 */
export function GearList({ project }: { project: Project }) {
  const router = useRouter();
  const kits = useLive(() => db.kits.toArray(), []);
  const existing = project.shots.some((s) => s.status !== "dropped");
  const [result] = useState(() => {
    // An empty list fills to the top of the budget; an existing one gets only what the gear earns.
    const room = Math.max(0, projectBudget(project).max - project.shots.filter((s) => s.status !== "dropped").length);
    return existing ? suggest(project, { gearOnly: true, limit: Math.max(room, GEAR_ADDITIONS) }) : suggest(project);
  });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const pending = result.suggestions.filter((s) => !added.has(s.templateId));
  const b = projectBudget(project);
  const planned = project.shots.filter((s) => s.status !== "dropped").length;
  const back = `/project?id=${project.id}&tab=gear`;
  const kit: Kit | undefined = kits?.find((k) => k.id === project.kitId);
  const locationName = new Map(project.locations.map((l) => [l.id, l.name]));
  const dayIndex = (id?: string) => project.days.find((d) => d.id === id)?.index;
  const notShown = needsLine(result.withheld, result.needs);

  const add = async (picks: Suggestion[]) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(addSuggestions(latest, picks, "template"));
    setAdded((a) => new Set([...a, ...picks.map((p) => p.templateId)]));
  };

  return (
    <div className={ui.screen}>
      <StepHeader label={`Suggested · ${result.suggestions.length}`} back={{ label: "← GEAR", href: back }} />

      <div className={styles.kit}>
        <span className={styles.kitName}>{kit ? kit.name.toUpperCase() : "THIS SHOOT'S GEAR"}</span>
        <span className={styles.kitFormat}>{formatLine(project.format)}</span>
        <span className={styles.kitBag}>{project.gear.length ? bagLine(project.gear) : "NO GEAR CHOSEN"}</span>
      </div>

      <div className={ui.flush}>
        {result.suggestions.length === 0 ? (
          <p className={styles.note}>
            {existing
              ? "Nothing new for this kit — everything it earns is already on the list."
              : `The list is already at the top of its ${budgetLabel(b)} budget — there's no room to suggest more.`}
          </p>
        ) : (
          <ul className={styles.rows}>
            {result.suggestions.map((s) => {
              const done = added.has(s.templateId);
              const where = `${project.days.length > 1 ? `DAY ${dayIndex(s.dayId)} · ` : ""}${s.locationId ? locationName.get(s.locationId)?.toUpperCase() : "UNPLACED"}`;
              return (
                <li key={s.templateId} className={styles.row}>
                  <span className={styles.size}>{s.size}</span>
                  <span className={styles.stack}>
                    <span className={done ? styles.subjectDone : styles.subject}>{s.subject}</span>
                    <span className={styles.reason}>{s.reason}</span>
                    <span className={styles.meta}>{where}</span>
                  </span>
                  {done ? (
                    <span className={styles.added}>ADDED</span>
                  ) : (
                    <button type="button" className={styles.plus} aria-label={`Add ${s.subject}`} onClick={() => add([s])}>
                      +
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {notShown && (
          <div className={`${ui.box} ${styles.notShown}`}>
            <span className={ui.boxHeading}>NOT SHOWN</span>
            <p className={ui.boxText}>{notShown}</p>
            <Link href={`/gear/shoot?id=${project.id}`} className={ui.textLink}>
              ADD GEAR ›
            </Link>
          </div>
        )}
      </div>

      <div className={ui.footer}>
        {pending.length > 0 && (
          <p className={ui.hint}>
            Adding {pending.length === result.suggestions.length ? "all" : "the rest"} puts the list at {planned + pending.length}, against a budget of {budgetLabel(b).replace(" — ", "—")}.
          </p>
        )}
        <div className={styles.footerRow}>
          <Link href={back} className={ui.secondary}>
            {pending.length ? "NOT NOW" : "DONE"}
          </Link>
          {pending.length > 0 && (
            <button
              type="button"
              className={ui.primary}
              onClick={async () => {
                await add(pending);
                router.replace(`/project?id=${project.id}`);
              }}
            >
              {existing ? `ADD ${pending.length} NEW` : pending.length === result.suggestions.length ? `ADD ALL ${pending.length}` : `ADD THE OTHER ${pending.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
