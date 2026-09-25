import { todayIso } from "./status";
import type { Id, IsoDate } from "./types";

/**
 * The project you were last in, for Home's PICK UP WHERE YOU LEFT OFF (H2).
 * Kept on this phone, not on the project: opening something isn't a change
 * to it (Rina, 25 Sep).
 */

const KEY = "tsl-last-viewed";

export interface LastViewed {
  id: Id;
  on: IsoDate;
}

export function readLastViewed(): LastViewed | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.id === "string" && typeof v.on === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function writeLastViewed(id: Id, now = new Date()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, on: todayIso(now) }));
  } catch {}
}
