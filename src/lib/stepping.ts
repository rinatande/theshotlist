import { beatName, ROLES, shotsByBeat } from "./beats";
import { shotNumbers } from "./shotNumbers";
import type { Id, Project } from "./types";

/**
 * Stepping through shots from shot detail (S3, S3c; Rina, 25 Sep): ‹ and ›,
 * or a swipe, in the order the list is showing — by location or by beat.
 * Every shot is in it, exposed and dropped ones too, and it stops at both
 * ends rather than wrapping.
 */

export type ListView = "location" | "beat";

export interface Step {
  id: Id;
  /** Which location (or UNPLACED, or beat) the shot is in, for the NOW AT band. */
  group: string;
  /** "NOW AT HEADLAND", "NOW UNPLACED", "NOW IN BUILD". */
  arrival: string;
}

/** The list's grouping, as the SHOTS tab last showed it on this phone. */
export function readListView(projectId: Id): ListView {
  try {
    return sessionStorage.getItem(`tsl-view-${projectId}`) === "beat" ? "beat" : "location";
  } catch {
    return "location";
  }
}

export function stepOrder(p: Project, view: ListView): Step[] {
  const numbers = shotNumbers(p);
  const byNumber = (a: Id, b: Id) => (numbers.get(a) ?? 0) - (numbers.get(b) ?? 0);

  if (view === "beat") {
    const groups = shotsByBeat(p);
    return ROLES.flatMap((role) =>
      groups[role].sort(byNumber).map((id) => ({ id, group: `beat:${role}`, arrival: `NOW IN ${beatName(p.format, role)}` })),
    );
  }

  // By location: the list's order is the numbered order — days, then each
  // day's locations in running order, then that day's UNPLACED (§5.10).
  const locations = new Map(p.locations.map((l) => [l.id, l]));
  const shots = new Map(p.shots.map((s) => [s.id, s]));
  return [...numbers.keys()].sort(byNumber).map((id) => {
    const s = shots.get(id)!;
    const l = s.locationId ? locations.get(s.locationId) : undefined;
    return l
      ? { id, group: `loc:${l.id}`, arrival: `NOW AT ${l.name.toUpperCase()}` }
      : { id, group: `unplaced:${s.dayId ?? ""}`, arrival: "NOW UNPLACED" };
  });
}

export interface Neighbours {
  prev?: Id;
  next?: Id;
  /** Shown when this shot opens a different group from the one you stepped from. */
  arrival?: { text: string; count: number };
}

/** The shots either side, and whether arriving from `came` crossed into a new group. */
export function neighbours(order: Step[], id: Id, came?: "prev" | "next"): Neighbours {
  const i = order.findIndex((s) => s.id === id);
  if (i < 0) return {};
  const here = order[i];
  // Stepping forward, you came from the shot before; backward, from the one after.
  const from = came === "next" ? order[i - 1] : came === "prev" ? order[i + 1] : undefined;
  const crossed = from && from.group !== here.group;
  return {
    prev: order[i - 1]?.id,
    next: order[i + 1]?.id,
    arrival: crossed ? { text: here.arrival, count: order.filter((s) => s.group === here.group).length } : undefined,
  };
}
