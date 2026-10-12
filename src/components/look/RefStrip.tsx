"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import ui from "@/components/ui.module.css";
import { formatTime, siteLabel } from "@/lib/look";
import { useRefImage } from "@/lib/lookImages";
import type { FrameRef, Id, Project, Ref } from "@/lib/types";
import styles from "./RefStrip.module.css";

/** A ref as a small tile: a frame's thumbnail, a note on --band, a link dark with ▶. */
export function RefThumb({ r, square }: { r: Ref; square?: boolean }) {
  const src = useRefImage(r.kind === "frame" ? r.imageId : undefined, "thumb");
  if (r.kind === "frame") {
    return (
      <span className={styles.frame} style={square ? undefined : { aspectRatio: `${r.width} / ${r.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a Blob from this phone */}
        {src && <img src={src} alt="" />}
      </span>
    );
  }
  if (r.kind === "note") {
    return (
      <span className={styles.note}>
        <span className={styles.noteText}>{r.text}</span>
      </span>
    );
  }
  return (
    <span className={styles.link}>
      <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
        <path d="M7 4.5v13l11-6.5z" fill="currentColor" />
      </svg>
      <span className={styles.linkText}>{r.moments.length ? r.moments.map(formatTime).join(" · ") : siteLabel(r.url)}</span>
    </span>
  );
}

const describe = (r: Ref) => (r.kind === "frame" ? `Frame${(r as FrameRef).at !== undefined ? ` at ${formatTime((r as FrameRef).at!)}` : ""}` : r.kind === "note" ? `Note: ${r.text}` : `Link${r.title ? `, ${r.title}` : ""}`);

/** S3g: a shot's refs as a strip of 96px-tall tiles under its reason line. Tapping one opens it. */
export function RefStrip({ project, refs, fresh = [] }: { project: Project; refs: Ref[]; fresh?: Id[] }) {
  return (
    <div className={styles.strip}>
      {refs.map((r) => (
        <Link key={r.id} href={`/look/ref?id=${project.id}&ref=${r.id}`} aria-label={`Open ${describe(r)}${fresh.includes(r.id) ? ", just added" : ""}`} className={styles.cell}>
          <RefThumb r={r} />
          {/* S3j: just added from FIND A REF, until you leave (§5.17). */}
          {fresh.includes(r.id) && (
            <span className={styles.new} aria-hidden="true">
              NEW
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** + PIN from a shot: which of the look's refs sit on it. */
export function RefPickSheet({ project, title, initial, onClose, onSave }: { project: Project; title: string; initial: Id[]; onClose: () => void; onSave: (ids: Id[]) => void }) {
  const [picked, setPicked] = useState<Id[]>(initial);
  const refs = project.refs ?? [];
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className={styles.pickList}>
        {refs.length === 0 && <p className={styles.none}>Nothing on the look yet. Add refs on the LOOK tab, then pin them here.</p>}
        {refs.map((r) => {
          const on = picked.includes(r.id);
          return (
            <label key={r.id} className={on ? `${styles.pick} ${styles.on}` : styles.pick}>
              <input type="checkbox" className={styles.tick} checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== r.id) : [...picked, r.id])} />
              <span className={styles.pickThumb}>
                <RefThumb r={r} square />
              </span>
              <span className={styles.pickText}>{describe(r)}</span>
            </label>
          );
        })}
      </div>
      <div className={styles.foot}>
        <button type="button" className={ui.primary} onClick={() => onSave(picked)}>
          {picked.length === 1 ? "PIN 1 REF" : `PIN ${picked.length} REFS`}
        </button>
        <button type="button" className={ui.secondary} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </BottomSheet>
  );
}
