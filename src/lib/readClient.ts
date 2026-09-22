"use client";

import { projectBrief } from "./brief";
import { readContext, readHash, type ReadFailure, type ReadResponse } from "./read";
import type { Project } from "./types";

/**
 * The phone's side of the online read. Each read is kept on the brief against
 * a hash of the brief and plan, so the same brief never costs a second read.
 */

const DEVICE_KEY = "tsl-device";
const INVITE_KEY = "tsl-invite";

/** A random id for this phone, used only to count reads. Not tied to anything else. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function inviteCode(): string | undefined {
  try {
    return localStorage.getItem(INVITE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remember an invite from a link like /?invite=acme. */
export function rememberInvite(code: string): void {
  const clean = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  if (!clean) return;
  try {
    localStorage.setItem(INVITE_KEY, clean);
  } catch {}
}

export function forgetInvite(): void {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {}
}

export async function readsLeft(): Promise<{ available: boolean; remaining: number } | null> {
  if (!navigator.onLine) return null;
  try {
    const params = new URLSearchParams({ device: deviceId() });
    const invite = inviteCode();
    if (invite) params.set("invite", invite);
    const res = await fetch(`/api/quota?${params}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The saved read, if it was made from this exact brief text. */
export function currentRead(project: Project) {
  const brief = projectBrief(project);
  return brief?.read && brief.read.text.trim() === brief.text.trim() ? brief.read : undefined;
}

export type ReadOutcome = { ok: true; response: ReadResponse; hash: string; cached: boolean } | { ok: false; failure: ReadFailure };

export async function runRead(project: Project): Promise<ReadOutcome> {
  const brief = projectBrief(project)?.text.trim() ?? "";
  const req = { brief, context: readContext(project) };
  const hash = await readHash(req);
  const saved = projectBrief(project)?.read;
  if (saved && saved.hash === hash) {
    return { ok: true, cached: true, hash, response: { result: saved.result, model: saved.model, remaining: -1 } };
  }
  if (!navigator.onLine) return { ok: false, failure: { reason: "offline" } };

  try {
    const res = await fetch("/api/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...req, device: deviceId(), invite: inviteCode() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, failure: { reason: data.reason ?? "error", message: data.message ?? "The read didn't work this time." } };
    return { ok: true, cached: false, hash, response: data as ReadResponse };
  } catch {
    return { ok: false, failure: { reason: "offline" } };
  }
}
