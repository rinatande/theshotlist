"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectHeader, type Tab } from "@/components/ProjectHeader";
import { ShotList } from "@/components/ShotList";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { fillCoords } from "@/lib/place";
import { useProject } from "@/lib/useProject";
import styles from "./Project.module.css";

const COMING: Record<Exclude<Tab, "shots">, string> = {
  look: "The look board is coming. It's where references for this shoot will live.",
  gear: "Gear is coming. Until then, shots are planned without it — lens is typed, support is picked.",
};

/** A project behind its header and tabs (§7). SHOTS is the shot list; LOOK and GEAR are stubs. */
export function ProjectScreen() {
  const router = useRouter();
  const { id, project } = useProject();
  const [tab, setTab] = useState<Tab>("shots");
  const [actions, setActions] = useState(false);

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
            <ShotList project={project} />
          </div>
          <div className={ui.footer}>
            <Link href={`/shot/new?id=${project.id}`} className={ui.primary}>
              + ADD SHOT
            </Link>
          </div>
        </>
      ) : (
        <div className={ui.body}>
          <p className={styles.coming}>{COMING[tab]}</p>
        </div>
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
