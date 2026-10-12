"use client";

import { db } from "./db";
import { parseVideo, updateRef } from "./look";
import type { Id, LinkRef } from "./types";

/** Ask the server for a YouTube link's title and channel; undefined offline or for anything else. */
export async function lookUpTitle(url: string): Promise<{ title?: string; channel?: string } | undefined> {
  if (parseVideo(url)?.site !== "youtube" || !navigator.onLine) return undefined;
  try {
    const res = await fetch(`/api/oembed?url=${encodeURIComponent(url)}`);
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Links saved with no signal get their titles once there is some (§5.16):
 * run when the look opens, and again on "online".
 */
export async function fillTitles(projectId: Id) {
  const project = await db.projects.get(projectId);
  const missing = (project?.refs ?? []).filter((r): r is LinkRef => r.kind === "link" && !r.title && parseVideo(r.url)?.site === "youtube");
  for (const link of missing) {
    const found = await lookUpTitle(link.url);
    if (!found?.title) continue;
    const latest = await db.projects.get(projectId);
    if (latest) await db.projects.put(updateRef(latest, link.id, { title: found.title, channel: found.channel }));
  }
}
