"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ShotForm } from "@/components/ShotForm";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { runningOrder } from "@/lib/runningOrder";
import { addShot, addShotAfter, shotInputFrom } from "@/lib/shots";
import type { BeatRole } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";

/**
 * S4 Add shot. ?loc= preselects a location; ?beat= comes from a beat's + ADD;
 * ?day= sets the day for a shot with no location; ?from=shoot returns to shoot mode.
 * ?copy= is DUPLICATE (S4c): the form opens filled from that shot, and nothing
 * is added until ADD AS NN puts it in after the original. ?from=list returns
 * to the list, where select mode's DUPLICATE came from; otherwise to the shot.
 */
function NewShot() {
  const router = useRouter();
  const { project, params } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;

  const list = `/project?id=${project.id}`;
  const copyOf = project.shots.find((s) => s.id === params.get("copy"));
  if (copyOf) {
    const cancel = params.get("from") === "list" ? list : `/shot?id=${project.id}&shot=${copyOf.id}`;
    return (
      <ShotForm
        project={project}
        copyOf={copyOf}
        initial={shotInputFrom(copyOf)}
        cancelHref={cancel}
        onSubmit={async (input) => {
          const [next] = addShotAfter(project, input, copyOf.id);
          await saveProject(next);
          router.replace(list);
        }}
      />
    );
  }

  const back = params.get("from") === "shoot" ? `/shoot?id=${project.id}` : list;
  const day = params.get("day");
  const dayId = day && project.days.some((d) => d.id === day) ? day : undefined;
  const loc = params.get("loc");
  const beat = params.get("beat") as BeatRole | null;
  // Default to the first location in the running order, like the board's CLIFF PATH.
  const locationId = loc && project.locations.some((l) => l.id === loc) ? loc : dayId ? runningOrder(project, dayId)[0]?.id : runningOrder(project)[0]?.id;

  return (
    <ShotForm
      project={project}
      initial={{ size: "WS", subject: "", locationId, dayId, beat: beat ?? undefined }}
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
