"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectHeader, type Tab } from "@/components/ProjectHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { useLive } from "@/lib/useLive";
import styles from "./Project.module.css";

const COMING: Record<Tab, string> = {
  shots: "The shot list comes in the next build: locations, shots, and ticking them off.",
  look: "The look board is coming. It's where references for this shoot will live.",
  gear: "Gear is coming. Until then, suggestions work without it.",
};

/**
 * A project, behind its header and tabs. In M2 every tab is a placeholder;
 * the header and ⋯ are real, so edit and delete work end to end.
 */
export function ProjectScreen() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  // null = looked and it isn't there; undefined = still looking.
  const project = useLive(async () => (await db.projects.get(id)) ?? null, [id]);
  const [tab, setTab] = useState<Tab>("shots");
  const [actions, setActions] = useState(false);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <Missing />;

  return (
    <div className={ui.screen}>
      <ProjectHeader project={project} tab={tab} onTab={setTab} onActions={() => setActions(true)} />
      <div className={ui.body}>
        <p className={styles.coming}>{COMING[tab]}</p>
      </div>

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
