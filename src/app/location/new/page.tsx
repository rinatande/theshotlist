"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { LocationForm } from "@/components/LocationForm";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { fillCoords } from "@/lib/place";
import { addLocation } from "@/lib/shots";
import { saveProject, useProject } from "@/lib/useProject";

/** E1 New location. ?day= preselects the day on a multi-day shoot. */
function NewLocation() {
  const router = useRouter();
  const { project, params } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;

  const back = params.get("from") === "order" ? `/order?id=${project.id}` : `/project?id=${project.id}`;
  const day = params.get("day");
  const dayId = project.days.length > 1 ? (project.days.find((d) => d.id === day)?.id ?? project.days[0]?.id) : undefined;

  return (
    <LocationForm
      project={project}
      initial={{ name: "", dayId }}
      cancelHref={back}
      onSubmit={async (input) => {
        const [next] = addLocation(project, input);
        await saveProject(next);
        fillCoords(project.id);
        router.replace(back);
      }}
    />
  );
}

export default function NewLocationPage() {
  return (
    <Suspense>
      <NewLocation />
    </Suspense>
  );
}
