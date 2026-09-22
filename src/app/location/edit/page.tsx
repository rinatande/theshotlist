"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { LocationForm } from "@/components/LocationForm";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { fillCoords } from "@/lib/place";
import { deleteLocation, updateLocation } from "@/lib/shots";
import { saveProject, useProject } from "@/lib/useProject";

/** E2 Edit location. Reached by tapping a location band (§5.10). */
function EditLocation() {
  const router = useRouter();
  const { project, params } = useProject();
  const locId = params.get("loc") ?? "";
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  const location = project?.locations.find((l) => l.id === locId);
  if (!project || !location) return <NotHere href={project ? `/project?id=${project.id}` : "/"} />;

  const back = params.get("from") === "order" ? `/order?id=${project.id}` : `/project?id=${project.id}`;

  return (
    <LocationForm
      key={location.id}
      project={project}
      location={location}
      initial={{ name: location.name, where: location.where, startTime: location.startTime, dayId: location.dayId, coords: location.coords }}
      cancelHref={back}
      onSubmit={async (input) => {
        await saveProject(updateLocation(project, location.id, input));
        fillCoords(project.id);
        router.replace(back);
      }}
      onDelete={async () => {
        router.replace(back);
        await saveProject(deleteLocation(project, location.id));
      }}
    />
  );
}

export default function EditLocationPage() {
  return (
    <Suspense>
      <EditLocation />
    </Suspense>
  );
}
