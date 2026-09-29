import type { Project, Shot } from "./types";

/**
 * Data changes between Dexie versions, as pure functions so they're tested
 * (db.ts runs them). Each touches only the fields it's about — a status, an
 * exposed mark or a note is never rewritten.
 */

/**
 * v3 (§5.15, 29 Sep): OTS left the size control. It said whose view the shot
 * is, not how much is in frame, so an OTS shot becomes a medium tagged OTS.
 */
export function moveOtsToView<P extends Pick<Project, "shots">>(p: P): P {
  if (!p.shots.some((s) => (s.size as string) === "OTS")) return p;
  return {
    ...p,
    shots: p.shots.map((s): Shot => ((s.size as string) === "OTS" ? { ...s, size: "MS", view: s.view ?? "ots" } : s)),
  };
}
