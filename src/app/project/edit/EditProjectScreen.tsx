"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { draftFromProject, draftInput, ProjectForm, type Draft } from "@/components/ProjectForm";
import { db } from "@/lib/db";
import { applyEdit, dayChange, defaultProjectName } from "@/lib/project";
import type { Project } from "@/lib/types";

/** PE1 / PE2: the create flow, prefilled, ending in SAVE (§5.14). */
export function EditProjectScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const step = params.get("step") === "3" ? 3 : params.get("step") === "2" ? 2 : 1;
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | undefined>(undefined);

  // Read once: the form edits a copy, and nothing is written until SAVE.
  useEffect(() => {
    db.projects.get(id).then((p) => {
      setProject(p ?? null);
      if (p) setDraft(draftFromProject(p));
    });
  }, [id]);

  useEffect(() => {
    if (project === null) router.replace("/projects");
  }, [project, router]);

  if (!project || !draft) return null;
  const input = draftInput(draft);
  const back = `/project?id=${project.id}`;

  return (
    <ProjectForm
      mode="edit"
      step={step}
      draft={draft}
      onDraft={(update) => setDraft((d) => (d ? update(d) : d))}
      defaultName={defaultProjectName(new Date(project.createdAt))}
      dayChange={dayChange(project, draft.dayCount)}
      cancelHref={back}
      onNext={() => router.push(`/project/edit?id=${project.id}&step=${step + 1}`)}
      project={project}
      onBack={() => router.back()}
      onSubmit={async () => {
        if (!input) return;
        // Re-read, so an edit made elsewhere since this form opened isn't lost.
        const latest = (await db.projects.get(project.id)) ?? project;
        await db.projects.put(applyEdit(latest, input));
        router.replace(back);
      }}
    />
  );
}
