"use client";

import Link from "next/link";
import { formatTime } from "@/lib/look";
import { useRefImage } from "@/lib/lookImages";
import type { FrameRef, Project } from "@/lib/types";

/** A frame in a 96px strip (L5, S3g): its own aspect, tapping opens it. */
export function StripFrame({ project, f }: { project: Project; f: FrameRef }) {
  const src = useRefImage(f.imageId, "thumb");
  return (
    <Link href={`/look/ref?id=${project.id}&ref=${f.id}`} aria-label={`Open frame${f.at !== undefined ? ` at ${formatTime(f.at)}` : ""}`} style={{ aspectRatio: `${f.width} / ${f.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a Blob from this phone */}
      {src && <img src={src} alt="" />}
    </Link>
  );
}
