import { db } from "@/lib/db";
import type { Cast, Project } from "@/lib/types";
import { saveProject } from "@/lib/useProject";

/** Where the cast screens were opened from, and so where DONE and ← go back to. */
export function castBack(project: Project, from: string | null): { href: string; label: string } {
  return from === "list" ? { href: `/project?id=${project.id}`, label: "← SHOT LIST" } : { href: `/brief?id=${project.id}`, label: "← BRIEF" };
}

/** Save a change to the cast on top of whatever's newest, so no edit is lost. */
export async function saveCast(project: Project, change: (c: Cast) => Cast) {
  const latest = (await db.projects.get(project.id)) ?? project;
  await saveProject({ ...latest, cast: change(latest.cast), updatedAt: new Date().toISOString() });
}

