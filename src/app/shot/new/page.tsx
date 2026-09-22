"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ShotForm } from "@/components/ShotForm";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { runningOrder } from "@/lib/runningOrder";
import { addShot } from "@/lib/shots";
import type { BeatRole } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";

/** S4 Add shot. ?loc= preselects a location; ?beat= comes from a beat's + ADD. */
function NewShot() {
  const router = useRouter();
  const { project, params } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;

  const back = `/project?id=${project.id}`;
  const loc = params.get("loc");
  const beat = params.get("beat") as BeatRole | null;
  // Default to the first location in the running order, like the board's CLIFF PATH.
  const locationId = loc && project.locations.some((l) => l.id === loc) ? loc : runningOrder(project)[0]?.id;

  return (
    <ShotForm
      project={project}
      initial={{ size: "WS", subject: "", locationId, beat: beat ?? undefined }}
      cancelHref={back}
      onSubmit={async (input) => {
        const [next] = addShot(project, input);
        await saveProject(next);
        router.replace(back);
      }}
    />
  );
}

export default function NewShotPage() {
  return (
    <Suspense>
      <NewShot />
    </Suspense>
  );
}
