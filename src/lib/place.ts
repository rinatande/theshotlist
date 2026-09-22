"use client";

import { db } from "./db";
import type { Coords, Project } from "./types";

/**
 * Turning a place name into coordinates (design.md §5.10). The one network
 * call on the offline path, and it only ever sends the place name — never a
 * brief, a shot or a project name. Each name is looked up once; the result is
 * stored, so sun times work offline from then on.
 */

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

export async function lookupPlace(name: string): Promise<Coords | null> {
  const query = name.trim();
  if (!query || !navigator.onLine) return null;
  try {
    const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ name: query, count: "1", language: "en", format: "json" })}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { latitude: number; longitude: number; timezone?: string }[] };
    const hit = data.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.latitude,
      lng: hit.longitude,
      timeZone: hit.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      source: "name",
      from: query,
    };
  } catch {
    return null; // Offline, blocked or down: try again next time there's signal.
  }
}

/** The phone's own position, behind the browser's permission prompt. */
export function deviceCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          source: "device",
        }),
      () => resolve(null),
      { maximumAge: 30 * 60_000, timeout: 10_000 },
    );
  });
}

/**
 * The geocoder matches place names, not addresses, so "Higashiyama, Kyoto" is
 * tried whole, then each part after the first comma ("Kyoto"), then the first.
 */
async function lookupLoose(name: string): Promise<Coords | null> {
  const whole = await lookupPlace(name);
  if (whole) return whole;
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts.slice(1).concat(parts.slice(0, 1))) {
    const hit = await lookupPlace(part);
    if (hit) return { ...hit, from: name.trim() };
  }
  return null;
}

const stale = (c: Coords | undefined, where: string | undefined) =>
  !!where?.trim() && (!c || (c.source === "name" && c.from !== where.trim()));

/**
 * Fill in any coordinates the project is missing, when there's signal. Called
 * when a project opens and after a location is saved; does nothing offline.
 */
export async function fillCoords(projectId: string): Promise<void> {
  if (!navigator.onLine) return;
  const project = await db.projects.get(projectId);
  if (!project) return;

  const updates: Partial<Project> = {};
  if (stale(project.coords, project.where)) {
    const c = await lookupLoose(project.where!);
    if (c) updates.coords = c;
  }
  let locationsChanged = false;
  const locations = await Promise.all(
    project.locations.map(async (l) => {
      if (!stale(l.coords, l.where)) return l;
      const c = await lookupLoose(l.where!);
      if (!c) return l;
      locationsChanged = true;
      return { ...l, coords: c };
    }),
  );
  if (locationsChanged) updates.locations = locations;
  if (Object.keys(updates).length === 0) return;

  // Re-read so an edit made while the lookup was in flight isn't overwritten.
  await db.transaction("rw", db.projects, async () => {
    const latest = await db.projects.get(projectId);
    if (!latest) return;
    await db.projects.put({
      ...latest,
      coords: updates.coords ?? latest.coords,
      locations: latest.locations.map((l) => {
        // Only if the place name is still the one that was looked up.
        const found = updates.locations?.find((u) => u.id === l.id && u.where === l.where);
        return found?.coords && found.coords !== l.coords ? { ...l, coords: found.coords } : l;
      }),
    });
  });
}
