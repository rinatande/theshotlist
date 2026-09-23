"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { draftInput, EMPTY_DRAFT, ProjectForm, type Draft } from "@/components/ProjectForm";
import { db } from "@/lib/db";
import { fromStarter, startFromKit, STARTER_KITS } from "@/lib/gear";
import { createProject, defaultProjectName } from "@/lib/project";
import { useDraft } from "@/lib/useDraft";
import { useLive } from "@/lib/useLive";

const DRAFT_KEY = "tsl-new-project";

/** P0a / P0b / P1, P2, then gear and frame rate. The step lives in the URL so the back button works. */
export function NewProjectScreen() {
  const router = useRouter();
  const stepParam = useSearchParams().get("step");
  const step = stepParam === "3" ? 3 : stepParam === "2" ? 2 : 1;
  const [draft, setDraft, clearDraft, loaded] = useDraft<Draft>(DRAFT_KEY, EMPTY_DRAFT);
  const past = useLive(() => db.projects.orderBy("updatedAt").reverse().toArray(), []);
  const gear = useLive(async () => ({ library: await db.gear.toArray(), kits: await db.kits.toArray() }), []);
  const [today] = useState(() => new Date());
  const input = draftInput(draft);

  // Steps 2 and 3 need step 1's answers; a reload that lost them goes back for them.
  useEffect(() => {
    if (loaded && step > 1 && !input) router.replace("/new");
  }, [loaded, step, input, router]);

  if (!loaded || past === undefined || gear === undefined || (step > 1 && !input)) return null;

  return (
    <ProjectForm
      mode="new"
      step={step}
      draft={draft}
      onDraft={setDraft}
      defaultName={defaultProjectName(today)}
      pastProjects={past}
      kits={gear.kits}
      library={gear.library}
      cancelHref="/"
      onNext={() => router.push(`/new?step=${step + 1}`)}
      onBack={() => router.back()}
      onSubmit={async () => {
        if (!input) return;
        let project = createProject(input, today);
        // Start the shoot from the kit picked on step 3, so the first GENERATE knows the bag.
        const starter = STARTER_KITS.find((s) => "starter:" + s.id === draft.kit);
        if (starter) {
          const { items, kit } = fromStarter(starter);
          await db.transaction("rw", db.gear, db.kits, async () => {
            await db.gear.bulkAdd(items);
            await db.kits.add({ ...kit, isDefault: true });
          });
          project = startFromKit(project, kit, items);
        } else {
          const kit = gear.kits.find((k) => k.id === draft.kit);
          if (kit) project = startFromKit(project, kit, gear.library);
        }
        await db.projects.add(project);
        clearDraft();
        router.replace(`/project?id=${project.id}`);
      }}
    />
  );
}
