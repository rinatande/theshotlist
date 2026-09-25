"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectHeader, type Tab } from "@/components/ProjectHeader";
import { MoveSheet } from "@/components/MoveSheet";
import { ShotDelete } from "@/components/ShotDelete";
import { GearTab } from "@/components/GearTab";
import { ShotList, type Selection } from "@/components/ShotList";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { writeLastViewed } from "@/lib/lastViewed";
import { fillCoords } from "@/lib/place";
import { currentDay } from "@/lib/shoot";
import { deleteShots } from "@/lib/shots";
import { readTimeFormat } from "@/lib/timeFormat";
import type { Id } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
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
  const [deleting, setDeleting] = useState(false);
  const selection: Selection = {
    ids: picked,
    start: (ids = []) => setPicked(new Set(ids)),
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
    writeLastViewed(id);
    fillCoords(id);
    const online = () => fillCoords(id);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [id]);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <Missing />;
  // Picks still on the list, in case one was deleted elsewhere.
  const live = (ids: Set<Id>) => [...ids].filter((id) => project.shots.some((s) => s.id === id));

  return (
    <div className={ui.screen}>
      <ProjectHeader project={project} tab={tab} onTab={setTab} onActions={() => setActions(true)} />

      {tab === "shots" ? (
        <>
          {picked && (
            <div className={styles.picking}>
              <span role="status" className={styles.pickCount}>
                {live(picked).length} SELECTED
              </span>
              <button type="button" className={styles.pickCancel} onClick={() => setPicked(null)}>
                CANCEL
              </button>
            </div>
          )}
          <div className={ui.flush}>
            <ShotList project={project} selection={selection} />
          </div>
          {picked ? (
            <SelectFooter
              ids={live(picked)}
              duplicateHref={`/shot/new?id=${project.id}&copy=${live(picked)[0]}&from=list`}
              onMove={() => setMoving(true)}
              onDelete={() => setDeleting(true)}
            />
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

      {deleting && picked && (
        <ShotDelete
          project={project}
          ids={live(picked)}
          onClose={() => setDeleting(false)}
          onDelete={async () => {
            const ids = live(picked);
            setDeleting(false);
            setPicked(null);
            await saveProject(deleteShots(project, ids));
          }}
        />
      )}

      {actions && (
        <ProjectActions
          project={project}
          onClose={() => setActions(false)}
          onDelete={async () => {
            await db.projects.delete(project.id);
            router.replace("/projects");
          }}
        />
      )}
    </div>
  );
}

/**
 * While picking (SL3, SL4): one shot can be duplicated, moved or deleted;
 * several can be deleted or moved together. CANCEL is in the strip above the
 * list. Delete always asks first (§5.13).
 */
function SelectFooter({ ids, duplicateHref, onMove, onDelete }: { ids: Id[]; duplicateHref: string; onMove: () => void; onDelete: () => void }) {
  const count = ids.length;
  return (
    <div className={ui.footer}>
      {count === 0 ? (
        <>
          <p className={ui.hint} id="pick-why">
            Tick the shots, or ALL on a band.
          </p>
          <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="pick-why">
            MOVE TO…
          </button>
        </>
      ) : count === 1 ? (
        <div className={styles.pickBar}>
          <Link href={duplicateHref} className={styles.pickButton}>
            DUPLICATE
          </Link>
          <button type="button" className={styles.pickButton} onClick={onMove}>
            MOVE…
          </button>
          <button type="button" className={`${styles.pickButton} ${styles.pickWarn}`} onClick={onDelete}>
            DELETE
          </button>
        </div>
      ) : (
        <div className={styles.pickBar}>
          <button type="button" className={`${styles.pickButton} ${styles.pickWarn} ${styles.pickFixed}`} onClick={onDelete}>
            DELETE {count}
          </button>
          <button type="button" className={`${ui.primary} ${styles.pickMove}`} onClick={onMove}>
            MOVE {count} TO…
          </button>
        </div>
      )}
    </div>
  );
}

function Missing() {
  return (
    <div className={ui.screen}>
      <div className={ui.body}>
        <h1 className={styles.missingTitle}>NOT ON THIS PHONE</h1>
        <p className={styles.coming}>This project isn&apos;t stored here. It may have been deleted.</p>
        <Link href="/projects" className={ui.secondary}>
          ← PROJECTS
        </Link>
      </div>
    </div>
  );
}
