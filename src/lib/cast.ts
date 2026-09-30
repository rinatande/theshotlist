import type { Cast, CastMember, Id, LeadKind, Presence, Project, Shot, Treatment } from "./types";

/**
 * Cast and presence (design.md §5.8, boards B5–B8): who is on camera, and how
 * much. Pure, so it's tested; the screens only draw.
 */

/** You, whether you're the lead or behind the camera. */
export const YOU: Id = "you";

export const PRESENCES: { value: Presence; label: string }[] = [
  { value: "none", label: "Not at all" },
  { value: "background", label: "In the background" },
  { value: "part", label: "Part of it" },
  { value: "subject", label: "The subject" },
];

export const presenceLabel = (p: Presence) => PRESENCES.find((x) => x.value === p)!.label;

/** What each level does, said to you or about someone by name (B5). */
export function presenceLine(p: Presence, name?: string): string {
  const you = !name;
  const they = name ?? "you";
  switch (p) {
    case "none":
      return `Hands, POV, back of head, silhouette, reflections. No pieces to camera — voice-over instead.`;
    case "background":
      return `${you ? "You turn" : `${name} turns`} up incidentally — a figure in a wide, a shadow, a hand entering frame. The place leads.`;
    case "part":
      return `${you ? "You're" : `${name}'s`} in it properly and as often as it needs — walking through, reacting, talking. The place still leads the cut.`;
    case "subject":
      return `Built around ${they}. Adds a presenter beat, and B-roll starts supporting ${you ? "you" : "them"} rather than the other way round.`;
  }
}

/**
 * A new project's cast from step 1's WHO IS ON CAMERA (§5.8): you, part of it;
 * someone you name, part of it, with you off camera; or no one, and you off
 * camera too.
 */
export function castFor(lead: LeadKind, name = "", newId: () => Id = () => crypto.randomUUID()): Cast {
  if (lead === "me") return { lead, leadMember: { id: YOU, name: "You", presence: "part", voice: true }, supporting: [], operatorPresence: "part" };
  if (lead === "us") {
    return {
      lead,
      leadMember: { id: YOU, name: "You", presence: "part", voice: true },
      coLeads: [{ id: newId(), name: name.trim(), presence: "part", voice: true }],
      supporting: [],
      operatorPresence: "part",
    };
  }
  if (lead === "someone") return { lead, leadMember: { id: newId(), name: name.trim(), presence: "part", voice: true }, supporting: [], operatorPresence: "none" };
  return { lead, supporting: [], operatorPresence: "none" };
}

/** Changing the lead on the cast screen keeps everyone else, and what you'd set for yourself. */
export function setLead(cast: Cast, lead: LeadKind, name = "", newId: () => Id = () => crypto.randomUUID()): Cast {
  if (lead === cast.lead && lead !== "someone" && lead !== "us") return cast;
  if (lead === "someone" && cast.lead === "someone" && cast.leadMember) {
    return { ...cast, leadMember: { ...cast.leadMember, name: name.trim() || cast.leadMember.name } };
  }
  if (lead === "us" && cast.lead === "us" && cast.coLeads?.length) {
    const [first, ...rest] = cast.coLeads;
    return { ...cast, coLeads: [{ ...first, name: name.trim() || first.name }, ...rest] };
  }
  const next = castFor(lead, name, newId);
  // The person named before carries across: someone else → us makes them a co-lead, and back again.
  const named = cast.lead === "someone" ? cast.leadMember : cast.lead === "us" ? cast.coLeads?.[0] : undefined;
  if (named && !name.trim()) {
    if (lead === "us") next.coLeads = [named];
    if (lead === "someone") next.leadMember = named;
  }
  return { ...next, supporting: cast.supporting, voiceOver: cast.voiceOver, flagDetails: cast.flagDetails, unattended: cast.unattended };
}

/** Whether you're one of the leads — so in shot, and the camera may be on its own. */
export const youLead = (cast: Cast) => cast.lead === "me" || cast.lead === "us";

/** The lead as a person. A self-shoot saved without one is you, at your operator presence. */
export function leadOf(cast: Cast): CastMember | undefined {
  if (cast.leadMember) return cast.leadMember;
  return youLead(cast) ? { id: YOU, name: "You", presence: cast.operatorPresence, voice: true } : undefined;
}

/** Everyone the video is about: you and your co-leads with US, else the one lead. */
export function leadsOf(cast: Cast): CastMember[] {
  const lead = leadOf(cast);
  return lead ? [lead, ...(cast.lead === "us" ? (cast.coLeads ?? []) : [])] : [];
}

/** Everyone who could be in a shot: the lead, the rest of the cast, and you behind the camera. */
export function castMembers(cast: Cast): CastMember[] {
  const out: CastMember[] = [...leadsOf(cast), ...cast.supporting];
  if (!youLead(cast)) out.push({ id: YOU, name: "You", presence: cast.operatorPresence, voice: true });
  return out;
}

/** Whether WHO'S IN IT is worth asking: more than one person can be in a shot. */
export function multiPerson(cast: Cast): boolean {
  return castMembers(cast).filter((m) => m.presence !== "none").length > 1;
}

const RANK: Record<Presence, number> = { none: 0, background: 1, part: 2, subject: 3 };

/**
 * B6: the treatment needs someone talking on screen — to camera, or in an
 * interview — and nobody in the cast is at "part of it" or above. Settled
 * once the person chooses voice-over.
 */
export function castConflict(treatment: Treatment, cast: Cast): boolean {
  if (treatment !== "talking-to-camera" && treatment !== "interview") return false;
  if (cast.voiceOver) return false;
  return !castMembers(cast).some((m) => RANK[m.presence] >= RANK.part);
}

const PRESENCE_WORDS: Record<Presence, string> = {
  none: "not at all — never identifiably on screen: hands, POV, back of head, silhouette, reflections",
  background: "in the background — turns up incidentally, the place leads",
  part: "part of it — in it properly and as often as it needs",
  subject: "the subject — the video is built around them",
};

/** What the read is told about who's on camera (§5.6, §5.8). */
export function onCameraLine(cast: Cast): string {
  const person = (m: CastMember, who: string) =>
    `${who}: ${PRESENCE_WORDS[m.presence]}${m.voice ? "" : "; no voice on camera"}`;
  const parts: string[] = [];
  const lead = leadOf(cast);
  if (cast.lead === "me" && lead) parts.push(person(lead, "the lead is me, the person filming"));
  else if (cast.lead === "us" && lead) {
    const others = (cast.coLeads ?? []).map((m) => m.name || "someone not named yet");
    parts.push(`the video is about me, the person filming, and ${others.join(" and ")} equally — share the coverage evenly between us`);
    parts.push(person(lead, "me"));
    for (const m of cast.coLeads ?? []) parts.push(person(m, m.name || "my co-lead"));
  } else if (cast.lead === "someone" && lead) parts.push(person(lead, `the lead is ${lead.name || "someone else, not named yet"}`));
  else parts.push("no one is the subject — product, food, place or architecture");
  for (const m of cast.supporting) parts.push(person(m, `${m.name}${m.role ? ` (${m.role})` : ""}`));
  if (!youLead(cast)) parts.push(`me, the person filming: ${PRESENCE_WORDS[cast.operatorPresence]}`);
  if (youLead(cast) && cast.unattended) {
    parts.push(
      "the camera is on a tripod with nobody behind it, so every shot is locked off: framed first, then we walk into it. Every shot's movement is 'static' — someone running or walking into frame is still static. No POV, no handheld, nothing that needs someone behind the camera; for moving action, frame wide and let it cross",
    );
  }
  if (cast.voiceOver) parts.push("nobody talks on screen: pieces to camera become voice-over, and those shots are rewritten, not dropped");
  if (cast.flagDetails !== false) parts.push("avoid street signs, house numbers, station names and a recognisable home exterior, or say so in the reason line");
  return parts.join(". ");
}

/** The read's description for a brand-new self-shoot, which the cache key leaves out. */
export const DEFAULT_ON_CAMERA = onCameraLine(castFor("me"));

const ME = /\b(me|my|i|i'm|myself|mine)\b/i;

/** Whether someone is in a shot: its WHO'S IN IT when set, else the subject's wording. */
export function inShot(shot: Pick<Shot, "people" | "subject">, member: Pick<CastMember, "id" | "name">): boolean {
  if (shot.people) return shot.people.includes(member.id);
  if (member.id === YOU) return ME.test(shot.subject);
  const name = member.name.trim().toLowerCase();
  return !!name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(shot.subject);
}

/** B8's counter: each lead's name and how many live shots they're in — "YOU 12 · SAM 11" with US. None for NO ONE. */
export function leadCounts(p: Pick<Project, "cast" | "shots">): { name: string; count: number }[] {
  return leadsOf(p.cast).map((lead) => ({
    name: lead.id === YOU ? "YOU" : (lead.name || "Someone").toUpperCase(),
    count: p.shots.filter((s) => s.status !== "dropped" && inShot(s, lead)).length,
  }));
}

/** B8's strip: "Priya (lead) · Mei · Buno · you off camera". */
export function castLine(cast: Cast): string {
  const parts: string[] = [];
  if (cast.lead === "me") parts.push("You (lead)");
  else if (cast.lead === "us") parts.push(`${["You", ...(cast.coLeads ?? []).map((m) => m.name || "Someone")].join(" & ")} (leads)`);
  else if (cast.lead === "someone") parts.push(`${leadOf(cast)?.name || "Someone"} (lead)`);
  else parts.push("No one on camera");
  parts.push(...cast.supporting.map((m) => m.name));
  if (!youLead(cast)) parts.push(cast.operatorPresence === "none" ? "you off camera" : `you ${presenceLabel(cast.operatorPresence).toLowerCase()}`);
  if (youLead(cast) && cast.unattended) parts.push("camera on a tripod");
  return parts.join(" · ");
}

/** The people a read's names point at, by cast id; unknown names are left out. */
export function peopleFromNames(cast: Cast, names: string[]): Id[] {
  const members = castMembers(cast);
  const ids = names.flatMap((n) => {
    const k = n.trim().toLowerCase();
    if (k === "me" || k === "you") return [YOU];
    return members.filter((m) => m.name.toLowerCase() === k).map((m) => m.id);
  });
  return [...new Set(ids)];
}

/**
 * Change one person's presence or voice ("you" is the lead on a self-shoot,
 * else the operator). Raising anyone to "part of it" or above settles B6 on
 * its own, so a voice-over choice made for an empty cast is cleared.
 */
export function updateMember(cast: Cast, id: Id, patch: Partial<Pick<CastMember, "presence" | "voice" | "name" | "role">>): Cast {
  let next: Cast;
  if (cast.leadMember?.id === id || (id === YOU && youLead(cast))) {
    const lead = leadOf(cast)!;
    next = { ...cast, leadMember: { ...lead, ...patch }, operatorPresence: youLead(cast) ? (patch.presence ?? lead.presence) : cast.operatorPresence };
  } else if (cast.coLeads?.some((m) => m.id === id)) {
    next = { ...cast, coLeads: cast.coLeads.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
  } else if (id === YOU) {
    next = { ...cast, operatorPresence: patch.presence ?? cast.operatorPresence };
  } else {
    next = { ...cast, supporting: cast.supporting.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
  }
  return next.voiceOver && castMembers(next).some((m) => RANK[m.presence] >= RANK.part) ? { ...next, voiceOver: undefined } : next;
}

/** + ADD SOMEONE (B7): part of it, voice allowed, like everyone to start. */
export function addSupporting(cast: Cast, name: string, role = "", newId: () => Id = () => crypto.randomUUID()): [Cast, Id] {
  const member: CastMember = { id: newId(), name: name.trim(), role: role.trim() || undefined, presence: "part", voice: true };
  return [{ ...cast, supporting: [...cast.supporting, member] }, member.id];
}

export function removeSupporting(cast: Cast, id: Id): Cast {
  return { ...cast, supporting: cast.supporting.filter((m) => m.id !== id) };
}

/** A person by cast id, and what they are to the project, for B5's header. */
export function memberFor(cast: Cast, id: Id): { member: CastMember; kind: "lead" | "supporting" | "operator" } | undefined {
  const lead = leadOf(cast);
  if (lead && lead.id === id) return { member: lead, kind: "lead" };
  const co = cast.coLeads?.find((x) => x.id === id);
  if (co) return { member: co, kind: "lead" };
  if (id === YOU) return { member: { id: YOU, name: "You", presence: cast.operatorPresence, voice: true }, kind: "operator" };
  const m = cast.supporting.find((x) => x.id === id);
  return m ? { member: m, kind: "supporting" } : undefined;
}
