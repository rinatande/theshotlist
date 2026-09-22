"use client";

import { useSearchParams } from "next/navigation";
import { db } from "./db";
import type { Project } from "./types";
import { useLive } from "./useLive";

/**
 * The project named by ?id=, kept live. undefined while loading, null when
 * it isn't on this phone.
 */
export function useProject(): { id: string; project: Project | null | undefined; params: URLSearchParams } {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const project = useLive(async () => (await db.projects.get(id)) ?? null, [id]);
  return { id, project, params: new URLSearchParams(params.toString()) };
}

/** Save a changed project. Every screen writes the whole project back. */
export async function saveProject(next: Project): Promise<void> {
  await db.projects.put(next);
}
