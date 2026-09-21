"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { draftInput, EMPTY_DRAFT, ProjectForm, type Draft } from "@/components/ProjectForm";
import { db } from "@/lib/db";
import { createProject, defaultProjectName } from "@/lib/project";
import { useDraft } from "@/lib/useDraft";
import { useLive } from "@/lib/useLive";

const DRAFT_KEY = "tsl-new-project";

/** P0a / P0b / P1 then P2. The step lives in the URL so the back button works. */
export function NewProjectScreen() {
  const router = useRouter();
  const step = useSearchParams().get("step") === "2" ? 2 : 1;
  const [draft, setDraft, clearDraft, loaded] = useDraft<Draft>(DRAFT_KEY, EMPTY_DRAFT);
  const past = useLive(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const [today] = useState(() => new Date());
  const input = draftInput(draft);

  // Step 2 needs step 1's answers; a reload that lost them goes back for them.
  useEffect(() => {
    if (loaded && step === 2 && !input) router.replace("/new");
  }, [loaded, step, input, router]);

  if (!loaded || past === undefined || (step === 2 && !input)) return null;

  return (
    <ProjectForm
      mode="new"
      step={step}
      draft={draft}
      onDraft={setDraft}
      defaultName={defaultProjectName(today)}
      pastProjects={past}
      cancelHref="/"
      onNext={() => router.push("/new?step=2")}
      onBack={() => router.back()}
      onSubmit={async () => {
        if (!input) return;
        const project = createProject(input, today);
        await db.projects.add(project);
        clearDraft();
        router.replace(`/project?id=${project.id}`);
      }}
    />
  );
}
