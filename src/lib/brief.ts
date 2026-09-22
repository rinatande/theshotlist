import type { QuotedChip } from "./chips";
import type { Brief, Project } from "./types";

/** v0 has one brief, for the whole project (§5.6). */
export function projectBrief(p: Project): Brief | undefined {
  return p.briefs.find((b) => b.scope === "project");
}

export function setBriefText(p: Project, text: string, now = new Date(), newId = () => crypto.randomUUID()): Project {
  const existing = projectBrief(p);
  const brief: Brief = existing ? { ...existing, text } : { id: newId(), scope: "project", text };
  return {
    ...p,
    briefs: existing ? p.briefs.map((b) => (b.id === existing.id ? brief : b)) : [...p.briefs, brief],
    updatedAt: now.toISOString(),
  };
}

/** Keep the chips the person didn't drop on B9, so the list builds from what they confirmed. */
export function setQuoted(p: Project, chips: QuotedChip[], now = new Date()): Project {
  const existing = projectBrief(p);
  if (!existing) return p;
  const brief: Brief = { ...existing, extraction: { quoted: chips, inferred: [], deliverables: [] } };
  return { ...p, briefs: p.briefs.map((b) => (b.id === existing.id ? brief : b)), updatedAt: now.toISOString() };
}

/** Keep an online read on the brief (M6), so reopening it costs nothing. */
export function saveRead(
  p: Project,
  read: { hash: string; model: string; result: NonNullable<Brief["read"]>["result"] },
  now = new Date(),
): Project {
  const existing = projectBrief(p);
  if (!existing) return p;
  const brief: Brief = {
    ...existing,
    readHash: read.hash,
    readAt: now.toISOString(),
    read: { ...read, text: existing.text, at: now.toISOString(), dropped: [] },
  };
  return { ...p, briefs: p.briefs.map((b) => (b.id === existing.id ? brief : b)), updatedAt: now.toISOString() };
}

/** What the person dropped on B9: inferred chips and deliverable shots they said it got wrong. */
export function setDropped(p: Project, dropped: string[], now = new Date()): Project {
  const existing = projectBrief(p);
  if (!existing?.read) return p;
  const brief: Brief = { ...existing, read: { ...existing.read, dropped } };
  return { ...p, briefs: p.briefs.map((b) => (b.id === existing.id ? brief : b)), updatedAt: now.toISOString() };
}
