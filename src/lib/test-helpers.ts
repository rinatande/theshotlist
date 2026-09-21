import type { Day, Format, Location, Project, Shot } from "./types";

// Small builders so each test states only what it's about.

export const REEL_SILENT: Format = { genre: "travel", treatment: "silent", delivery: "reel", aspect: "9:16" };

export function day(id: string, index: number, extra: Partial<Day> = {}): Day {
  return { id, index, ...extra };
}

export function loc(id: string, order: number, extra: Partial<Location> = {}): Location {
  return { id, name: id, order, ...extra };
}

export function shot(id: string, order: number, extra: Partial<Shot> = {}): Shot {
  return { id, size: "WS", subject: id, order, status: "unshot", source: "manual", ...extra };
}

export function project(extra: Partial<Project> = {}): Project {
  return {
    id: "p",
    name: "Test",
    format: REEL_SILENT,
    dayCount: 1,
    cast: { lead: "me", supporting: [], operatorPresence: "part" },
    gearIds: [],
    packedIds: [],
    days: [],
    locations: [],
    shots: [],
    briefs: [],
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    ...extra,
  };
}
