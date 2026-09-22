import { projectBudget } from "./budget";
import { runningOrder } from "./runningOrder";
import { dayOfShot, moveShots } from "./shots";
import type { Day, Id, Project, Shot } from "./types";
import { capitalise, inWords } from "./words";

/**
 * Shoot mode and wrap (§5.12, §8 Shoot mode), as pure functions. A day is the
 * unit: shoot mode works through one, and wrap closes one — never a project.
 */

const touch = (p: Project, now: Date): Project => ({ ...p, updatedAt: now.toISOString() });

export function orderedDays(p: Pick<Project, "days">): Day[] {
  return [...p.days].sort((a, b) => a.index - b.index);
}

/**
 * "Today" is the first day not yet wrapped. Dates are ignored even when set,
 * because shoots slip (Rina, 22 Sep). Undefined once every day is wrapped.
 */
export function currentDay(p: Pick<Project, "days">): Day | undefined {
  return orderedDays(p).find((d) => !d.wrappedAt);
}

/** Later days still open — where MOVE and RESHOOT TOMORROW can send a shot. */
export function laterDays(p: Pick<Project, "days">, dayId: Id): Day[] {
  const day = p.days.find((d) => d.id === dayId);
  if (!day) return [];
  return orderedDays(p).filter((d) => d.index > day.index && !d.wrappedAt);
}

/** Every shot on a day, in running order: timed locations by clock, then drag order, UNPLACED last (§5.10). */
export function dayShots(p: Project, dayId: Id): Shot[] {
  const multi = p.days.length > 1;
  const locations = multi ? runningOrder(p, dayId) : runningOrder(p);
  const rank = new Map(locations.map((l, i) => [l.id, i]));
  const at = (s: Shot) => (s.locationId !== undefined && rank.has(s.locationId) ? rank.get(s.locationId)! : locations.length);
  return p.shots.filter((s) => !multi || dayOfShot(p, s) === dayId).sort((a, b) => at(a) - at(b) || a.order - b.order);
}

/** The counter: today's exposed over today's shots, dropped ones out of both (§8 Shoot mode). */
export function dayCount(p: Project, dayId: Id): { exposed: number; total: number } {
  const live = dayShots(p, dayId).filter((s) => s.status !== "dropped");
  return { exposed: live.filter((s) => s.status === "exposed").length, total: live.length };
}

/**
 * What's left to shoot, in running order. Skipped shots go to the end, in
 * the order they were skipped; flagged shots have left the queue and wait
 * for wrap (Rina, 22 Sep).
 */
export function shootQueue(p: Project, dayId: Id, skipped: Id[] = []): Shot[] {
  const open = dayShots(p, dayId).filter((s) => s.status === "unshot");
  const skip = new Map(skipped.map((id, i) => [id, i]));
  return [...open.filter((s) => !skip.has(s.id)), ...open.filter((s) => skip.has(s.id)).sort((a, b) => skip.get(a.id)! - skip.get(b.id)!)];
}

/** SKIP again and it goes to the back again. */
export function skip(skipped: Id[], id: Id): Id[] {
  return [...skipped.filter((x) => x !== id), id];
}

export function markExposed(p: Project, id: Id, now = new Date()): Project {
  return touch({ ...p, shots: p.shots.map((s) => (s.id === id ? { ...s, status: "exposed" as const, flagNote: undefined } : s)) }, now);
}

/** FLAG: the note becomes the shot's `!` line (§4.4), and wrap asks about it. */
export function flagShot(p: Project, id: Id, note: string, now = new Date()): Project {
  const flagNote = note.trim() || "Check this one";
  return touch({ ...p, shots: p.shots.map((s) => (s.id === id ? { ...s, status: "flagged" as const, flagNote } : s)) }, now);
}

// ─── Wrap (W1–W3) ────────────────────────────────────────────────────────────

export type FlagChoice = "reshoot" | "accept" | "drop";
/** A later day's id, or drop. */
export type MissChoice = Id | "drop";

export interface WrapPlan {
  flagged: Record<Id, FlagChoice | undefined>;
  missed: Record<Id, MissChoice>;
}

export interface ClientTally {
  client: string;
  delivered: number;
  total: number;
  outstanding: Shot[];
}

export interface WrapView {
  day: Day;
  dayCount: number;
  later: Day[];
  last: boolean;
  exposed: number;
  total: number;
  flagged: Shot[];
  /** Not shot and not flagged. On the last day, required shots aren't here — they stay [★]. */
  missed: Shot[];
  clients: ClientTally[];
  /** Required shots on this day that aren't exposed: the W2 guard. */
  outstanding: Shot[];
}

export function wrapView(p: Project, dayId: Id): WrapView | undefined {
  const day = p.days.find((d) => d.id === dayId);
  if (!day) return undefined;
  const later = laterDays(p, dayId);
  const last = later.length === 0;
  const live = dayShots(p, dayId).filter((s) => s.status !== "dropped");
  const outstanding = live.filter((s) => s.required && s.status !== "exposed");
  const clients = [...new Set(live.filter((s) => s.required).map((s) => s.required!.client))].map((client) => {
    const mine = live.filter((s) => s.required?.client === client);
    return { client, delivered: mine.filter((s) => s.status === "exposed").length, total: mine.length, outstanding: mine.filter((s) => s.status !== "exposed") };
  });
  return {
    day,
    dayCount: p.days.length,
    later,
    last,
    exposed: live.filter((s) => s.status === "exposed").length,
    total: live.length,
    flagged: live.filter((s) => s.status === "flagged"),
    missed: live.filter((s) => s.status === "unshot" && !(last && s.required)),
    clients,
    outstanding,
  };
}

/** Missed shots go to the next day unless you say otherwise; on the last day they drop. Flags wait for a decision. */
export function defaultPlan(view: WrapView): WrapPlan {
  const next = view.later[0]?.id;
  return {
    flagged: Object.fromEntries(view.flagged.map((s) => [s.id, undefined])),
    missed: Object.fromEntries(view.missed.map((s) => [s.id, next ?? "drop"])),
  };
}

/** A flag shouldn't survive the day unexamined (§5.12). */
export const undecided = (plan: WrapPlan) => Object.values(plan.flagged).filter((c) => c === undefined).length;

/**
 * Close the day. Nothing is deleted: dropped shots stay in the day's record
 * and can be un-dropped (§5.12). Moved and reshot shots land in the new
 * day's UNPLACED — their location belongs to this day. A required shot left
 * on the last day stays [★] and outstanding.
 */
export function applyWrap(p: Project, dayId: Id, plan: WrapPlan, now = new Date()): Project {
  const next = laterDays(p, dayId)[0];
  const moves = new Map<Id, Id[]>();
  const to = (day: Id, id: Id) => moves.set(day, [...(moves.get(day) ?? []), id]);
  const status = new Map<Id, Shot["status"]>();

  for (const [id, choice] of Object.entries(plan.flagged)) {
    if (choice === "reshoot" && next) {
      to(next.id, id);
      status.set(id, "unshot");
    } else if (choice === "accept") status.set(id, "exposed");
    else if (choice === "drop" || (choice === "reshoot" && !next)) status.set(id, "dropped");
  }
  for (const [id, choice] of Object.entries(plan.missed)) {
    if (choice === "drop") status.set(id, "dropped");
    else if (laterDays(p, dayId).some((d) => d.id === choice)) to(choice, id);
  }

  let q = p;
  for (const [day, ids] of moves) q = moveShots(q, ids, { dayId: day }, now);
  const stamp = now.toISOString();
  return touch(
    {
      ...q,
      shots: q.shots.map((s) => {
        const next = status.get(s.id);
        if (!next) return s;
        return { ...s, status: next, droppedAt: next === "dropped" ? stamp : undefined };
      }),
      days: q.days.map((d) => (d.id === dayId ? { ...d, wrappedAt: stamp } : d)),
    },
    now,
  );
}

/** From a wrapped day's record: you got it after all, or want it back on the list. */
export function undrop(p: Project, id: Id, now = new Date()): Project {
  return touch({ ...p, shots: p.shots.map((s) => (s.id === id ? { ...s, status: "unshot" as const, droppedAt: undefined } : s)) }, now);
}

/** From the record: a dropped shot onto a later day, back to [ ]. */
export function moveDropped(p: Project, id: Id, dayId: Id, now = new Date()): Project {
  return moveShots(undrop(p, id, now), [id], { dayId }, now);
}

// ─── What wrap says (§5.12) ──────────────────────────────────────────────────

const Words = (n: number) => capitalise(inWords(n));

/** The line under the count. It ties back to the cut, never to you — no celebration (§5.12). */
export function wrapSentence(p: Project, view: WrapView): string {
  const b = projectBudget(p);
  const exposed = p.shots.filter((s) => s.status === "exposed").length;
  const enough = exposed >= b.min;

  if (view.outstanding.length > 0) {
    const client = view.outstanding[0].required!.client;
    const all = p.shots.filter((s) => s.required?.client === client).length;
    const out = view.outstanding.filter((s) => s.required!.client === client).length;
    const lead = enough ? "Enough for the cut" : "Short of the cut so far";
    if (view.outstanding.length > out) return `${lead}, but ${inWords(view.outstanding.length)} shots your clients are paying for aren't in the can.`;
    if (all === 1) return `${lead}, but the one shot ${client} is paying for isn't in the can.`;
    return `${lead}, but ${inWords(out)} of the ${inWords(all)} shots ${client} is paying for ${out === 1 ? "isn't" : "aren't"} in the can.`;
  }

  if (view.last) {
    const range = `a cut that wants ${inWords(b.min)} to ${inWords(b.max)}`;
    const lead = view.dayCount > 1 ? `${Words(exposed)} across ${inWords(view.dayCount)} days, for ${range}.` : `${Words(exposed)} exposed, for ${range}.`;
    const verdict = enough ? "That's enough" : "That's short of it";
    return `${lead} ${verdict} — ${view.dayCount > 1 ? "and it's the last day, so wrapping it ends the shoot" : "and wrapping ends the shoot"}.`;
  }

  const togo = view.later.length === 1 ? "a day still to go" : `${inWords(view.later.length)} days still to go`;
  if (enough) return `${Words(exposed)} exposed — already enough for the cut, with ${togo}.`;
  const laterIds = new Set(view.later.map((d) => d.id));
  const ahead =
    p.shots.filter((s) => (s.status === "unshot" || s.status === "flagged") && laterIds.has(dayOfShot(p, s) ?? "")).length + view.missed.length + view.flagged.length;
  const lead = `${Words(exposed)} of the ${inWords(b.min)} this cut needs, with ${togo}.`;
  if (exposed + ahead >= b.min) return `${lead} There's nothing you have to chase tomorrow.`;
  return `${lead} Even with the rest of the list it's ${inWords(b.min - exposed - ahead)} short — worth adding a few for tomorrow.`;
}

/** W3: the budget changes the sentence, not the options (§5.12). */
export function lastDayMissedSentence(p: Project, view: WrapView): { text: string; short: boolean } {
  const exposed = p.shots.filter((s) => s.status === "exposed").length;
  const short = exposed < projectBudget(p).min;
  const n = view.missed.length;
  if (short) return { short, text: `You're short of the cut — worth going back for ${n === 1 ? "it" : "one of these"} before you wrap?` };
  return { short, text: `You have enough for the cut. ${n === 1 ? "This one drops" : `These ${inWords(n)} drop`} when you wrap.` };
}
