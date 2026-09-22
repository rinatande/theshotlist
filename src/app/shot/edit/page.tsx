"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ShotForm } from "@/components/ShotForm";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { clearFlag, deleteShot, duplicateShot, updateShot } from "@/lib/shots";
import { saveProject, useProject } from "@/lib/useProject";

/** S6 Edit shot: add, field for field, plus duplicate and delete (§5.13). */
function EditShot() {
  const router = useRouter();
  const { project, params } = useProject();
  const shotId = params.get("shot") ?? "";
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  const shot = project?.shots.find((s) => s.id === shotId);
  if (!project || !shot) return <NotHere href={project ? `/project?id=${project.id}` : "/"} />;

  const list = `/project?id=${project.id}`;
  const detail = `/shot?id=${project.id}&shot=${shot.id}`;

  return (
    <ShotForm
      key={shot.id}
      project={project}
      shot={shot}
      initial={{
        size: shot.size,
        subject: shot.subject,
        lens: shot.lens,
        support: shot.support,
        movement: shot.movement,
        audio: shot.audio,
        locationId: shot.locationId,
        dayId: shot.dayId,
        note: shot.note,
      }}
      cancelHref={detail}
      onSubmit={async (input) => {
        await saveProject(updateShot(project, shot.id, input));
        router.replace(detail);
      }}
      onDuplicate={async () => {
        const [next, copy] = duplicateShot(project, shot.id);
        await saveProject(next);
        router.replace(`/shot/edit?id=${project.id}&shot=${copy}`);
      }}
      onDelete={async () => {
        // States its consequence in place rather than confirming (§5.13).
        // Leave first, so this screen never renders a shot that's gone.
        router.replace(list);
        await saveProject(deleteShot(project, shot.id));
      }}
      onClearFlag={async () => {
        await saveProject(clearFlag(project, shot.id));
      }}
    />
  );
}

export default function EditShotPage() {
  return (
    <Suspense>
      <EditShot />
    </Suspense>
  );
}
