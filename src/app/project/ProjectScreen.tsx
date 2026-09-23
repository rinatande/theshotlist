"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectHeader, type Tab } from "@/components/ProjectHeader";
import { MoveSheet } from "@/components/MoveSheet";
import { GearTab } from "@/components/GearTab";
import { ShotList, type Selection } from "@/components/ShotList";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { fillCoords } from "@/lib/place";
import { currentDay } from "@/lib/shoot";
import { readTimeFormat } from "@/lib/timeFormat";
import type { Id } from "@/lib/types";
import { useProject } from "@/lib/useProject";
import styles from "./Project.module.css";

const LOOK_COMING = "The look board is coming. It's where references for this shoot will live.";

/** A project behind its header and tabs (§7). SHOTS is the shot list, GEAR the gear tab; LOOK is a stub. */
export function ProjectScreen() {
  const router = useRouter();
  const { id, project, params } = useProject();
  // ?tab=gear brings you back to the tab you left from (the gear screens use it).
  const [tab, setTab] = useState<Tab>(() => (params.get("tab") === "gear" ? "gear" : "shots"));
  const [actions, setActions] = useState(false);
  const [picked, setPicked] = useState<Set<Id> | null>(null);
  const [moving, setMoving] = useState(false);
  const selection: Selection = {
    ids: picked,
    start: () => setPicked(new Set()),
    pick: (ids, on) =>
      setPicked((prev) => {
        const next = new Set(prev ?? []);
        for (const id of ids) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    cancel: () => setPicked(null),
  };

  // With signal, look up any place names not yet turned into coordinates (§5.10).
  useEffect(() => {
    if (!id) return;
    fillCoords(id);
    const online = () => fillCoords(id);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [id]);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <Missing />;

  return (
    <div className={ui.screen}>
      <ProjectHeader project={project} tab={tab} onTab={setTab} onActions={() => setActions(true)} />

      {tab === "shots" ? (
        <>
          <div className={ui.flush}>
            <ShotList project={project} selection={selection} />
          </div>
          {picked ? (
            <SelectFooter count={[...picked].filter((id) => project.shots.some((s) => s.id === id)).length} onMove={() => setMoving(true)} onCancel={() => setPicked(null)} />
          ) : (
            <div className={ui.footer}>
              {/* Two actions in the thumb zone (§8 Shot list). Shoot mode goes once every day is wrapped. */}
              <div className={styles.actions}>
                {project.shots.length > 0 && currentDay(project) && (
                  <Link href={`/shoot?id=${project.id}`} className={`${ui.secondary} ${styles.shoot}`}>
                    SHOOT MODE
                  </Link>
                )}
                <Link href={`/shot/new?id=${project.id}`} className={ui.primary}>
                  + ADD SHOT
                </Link>
              </div>
            </div>
          )}
        </>
      ) : tab === "gear" ? (
        <GearTab project={project} />
      ) : (
        <div className={ui.body}>
          <p className={styles.coming}>{LOOK_COMING}</p>
        </div>
      )}

      {moving && picked && (
        <MoveSheet
          project={project}
          ids={[...picked].filter((id) => project.shots.some((s) => s.id === id))}
          tf={readTimeFormat()}
          onClose={() => setMoving(false)}
          onMoved={() => {
            setMoving(false);
            setPicked(null);
          }}
        />
      )}

      {actions && (
        <ProjectActions
          project={project}
          onClose={() => setActions(false)}
          onDelete={async () => {
            await db.projects.delete(project.id);
            router.replace("/");
          }}
        />
      )}
    </div>
  );
}

/** While picking: how many, where they go, or back out (design.md §10, 23). */
function SelectFooter({ count, onMove, onCancel }: { count: number; onMove: () => void; onCancel: () => void }) {
  return (
    <div className={ui.footer}>
      <p className={ui.hint} aria-live="polite" id="pick-why">
        {count === 0 ? "Tick the shots to move, or ALL on a band." : count === 1 ? "1 shot picked." : `${count} shots picked.`}
      </p>
      {count > 0 ? (
        <button type="button" className={ui.primary} onClick={onMove}>
          MOVE {count} TO…
        </button>
      ) : (
        <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="pick-why">
          MOVE TO…
        </button>
      )}
      <button type="button" className={ui.secondary} onClick={onCancel}>
        CANCEL
      </button>
    </div>
  );
}

function Missing() {
  return (
    <div className={ui.screen}>
      <div className={ui.body}>
        <h1 className={styles.missingTitle}>NOT ON THIS PHONE</h1>
        <p className={styles.coming}>This project isn&apos;t stored here. It may have been deleted.</p>
        <Link href="/" className={ui.secondary}>
          ← PROJECTS
        </Link>
      </div>
    </div>
  );
}
