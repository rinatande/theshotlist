"use client";

import { useEffect, useState } from "react";
import { db } from "./db";
import { addRefs, deleteRef, FULL_EDGE, fitSize, THUMB_EDGE } from "./look";
import type { FrameRef, Id, IsoDateTime, Project, RefImage } from "./types";
import { useLive } from "./useLive";

/**
 * The look's images on this phone (§5.16): resized on import to 1600px on the
 * long edge plus a 400px thumbnail, stored as Blobs in their own table. If
 * there's no room, nothing is added and the person is told so plainly.
 */

export class OutOfSpace extends Error {
  constructor() {
    super("This phone is out of space for images — nothing was added.");
  }
}

const isQuota = (e: unknown) =>
  e instanceof Error && (e.name === "QuotaExceededError" || (e as { inner?: Error }).inner?.name === "QuotaExceededError" || /quota/i.test(e.message));

/** Ask once that images aren't cleared when the phone is short of space. */
async function persist() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}

async function encode(bitmap: ImageBitmap, edge: number): Promise<Blob> {
  const { width, height } = fitSize(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), "image/jpeg", 0.85));
}

export interface ImportedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Read and shrink one picked or shared file. */
export async function importImage(file: Blob): Promise<ImportedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, FULL_EDGE);
    return { full: await encode(bitmap, FULL_EDGE), thumb: await encode(bitmap, THUMB_EDGE), width, height };
  } finally {
    bitmap.close();
  }
}

export interface NewFrame {
  image: ImportedImage;
  at?: number;
  source?: string;
}

/**
 * Add frames to a project's look, and pin them, in one transaction: all of
 * them go in, or none do. Throws OutOfSpace when the phone is full. Returns
 * the new refs' ids. `pinFirst` puts them at the front of each shot's
 * strip — a ref you went looking for leads it (§5.17).
 */
export async function addFrames(
  projectId: Id,
  frames: NewFrame[],
  options: { pinTo?: Id[]; pinFirst?: boolean; sourceName?: { key: string; name: string } } = {},
  now = new Date(),
): Promise<Id[]> {
  const added: Id[] = [];
  await persist();
  try {
    await db.transaction("rw", db.projects, db.refImages, async () => {
      const project = await db.projects.get(projectId);
      if (!project) throw new Error("That project isn't on this phone any more.");
      const refs: FrameRef[] = [];
      for (const f of frames) {
        const image: RefImage = { id: crypto.randomUUID(), projectId, full: f.image.full, thumb: f.image.thumb };
        await db.refImages.add(image);
        refs.push({
          id: crypto.randomUUID(),
          kind: "frame",
          imageId: image.id,
          width: f.image.width,
          height: f.image.height,
          source: f.source,
          at: f.at,
          addedAt: now.toISOString() as IsoDateTime,
        });
      }
      let next: Project = addRefs(project, refs, now);
      if (options.pinTo?.length) {
        const ids = new Set(refs.map((r) => r.id));
        const pin = (have: Id[]) => (options.pinFirst ? [...ids, ...have.filter((x) => !ids.has(x))] : [...have.filter((x) => !ids.has(x)), ...ids]);
        next = { ...next, shots: next.shots.map((s) => (options.pinTo!.includes(s.id) ? { ...s, refIds: pin(s.refIds ?? []) } : s)) };
      }
      if (options.sourceName?.name.trim()) next = { ...next, sourceNames: { ...next.sourceNames, [options.sourceName.key]: options.sourceName.name.trim() } };
      await db.projects.put(next);
      added.push(...refs.map((r) => r.id));
    });
  } catch (e) {
    throw isQuota(e) ? new OutOfSpace() : e;
  }
  return added;
}

/** Take refs back off the look, with their pins and images: S3j's UNDO. */
export async function removeRefs(projectId: Id, refIds: Id[], now = new Date()): Promise<void> {
  await db.transaction("rw", db.projects, db.refImages, async () => {
    const project = await db.projects.get(projectId);
    if (!project) return;
    const going = (project.refs ?? []).filter((r) => refIds.includes(r.id));
    let next = project;
    for (const r of going) next = deleteRef(next, r.id, now);
    for (const r of going) if (r.kind === "frame") await db.refImages.delete(r.imageId);
    await db.projects.put(next);
  });
}

/** Remove a frame's image along with its ref. */
export async function deleteImage(imageId: Id) {
  await db.refImages.delete(imageId);
}

/** A project's images, when the project goes. */
export async function deleteProjectImages(projectId: Id) {
  await db.refImages.where("projectId").equals(projectId).delete();
}

/** An image as a URL an <img> can show, released when the component goes. */
export function useRefImage(imageId: Id | undefined, size: "thumb" | "full"): string | undefined {
  const image = useLive(async () => (imageId ? ((await db.refImages.get(imageId)) ?? null) : null), [imageId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image) return;
    const u = URL.createObjectURL(image[size]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image, size]);
  return image ? url : undefined;
}
