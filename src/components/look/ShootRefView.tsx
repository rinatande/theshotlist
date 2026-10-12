"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { formatTime, siteLabel } from "@/lib/look";
import { useRefImage } from "@/lib/lookImages";
import type { Ref } from "@/lib/types";
import { RefThumb } from "./RefStrip";
import styles from "./ShootRefView.module.css";

const SWIPE_PX = 60;
const EDGE_PX = 24;

/** N4c: the first pinned ref beside the subject, with how many there are. Absent when nothing's pinned. */
export function ShootRefThumb({ refs, shotLabel, onOpen }: { refs: Ref[]; shotLabel: string; onOpen: () => void }) {
  if (refs.length === 0) return null;
  return (
    <button type="button" className={styles.thumb} aria-label={`Open refs for ${shotLabel}, ${refs.length === 1 ? "1 ref" : `${refs.length} refs`}`} onClick={onOpen}>
      <RefThumb r={refs[0]} square />
      <span className={styles.count}>1/{refs.length}</span>
    </button>
  );
}

/**
 * N4d: a shot's refs full screen, in shoot mode's night. The why-note under
 * each, swipe for the next, and BACK TO THE SHOT — outlined, so it can't be
 * mistaken for GOT IT. Everything here is on the phone; nothing needs signal.
 */
export function ShootRefView({ refs, shotNo, onClose }: { refs: Ref[]; shotNo: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const r = refs[Math.min(i, refs.length - 1)];
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, refs.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, refs.length]);

  if (!r) return null;
  return (
    <div
      className={styles.view}
      role="dialog"
      aria-modal="true"
      aria-label={`Refs for shot ${shotNo}`}
      onTouchStart={(e: TouchEvent) => {
        const t = e.touches[0];
        touch.current = t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX ? null : { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e: TouchEvent) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(t.clientY - start.y) * 1.5) return;
        setI((x) => (dx < 0 ? Math.min(x + 1, refs.length - 1) : Math.max(x - 1, 0)));
      }}
    >
      <div className={styles.bar}>
        <button type="button" className={styles.backLink} onClick={onClose}>
          ← SHOT {shotNo}
        </button>
        <span className={styles.position} aria-live="polite">
          REF {i + 1} / {refs.length}
        </span>
      </div>

      <div className={styles.body}>
        <Shown r={r} />
        {r.why && (
          <div className={styles.why}>
            <span className={styles.label}>WHY THIS ONE</span>
            <p className={styles.whyText}>{r.why}</p>
          </div>
        )}
      </div>

      {refs.length > 1 && <p className={styles.hint}>SWIPE FOR THE NEXT REF</p>}
      <div className={styles.foot}>
        <button ref={back} type="button" className={styles.back} onClick={onClose}>
          BACK TO THE SHOT
        </button>
      </div>
    </div>
  );
}

function Shown({ r }: { r: Ref }) {
  const src = useRefImage(r.kind === "frame" ? r.imageId : undefined, "full");
  if (r.kind === "frame") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- a Blob from this phone */}
        {src ? <img src={src} alt={r.why ?? "Reference frame"} className={styles.image} /> : <div className={styles.placeholder} />}
      </>
    );
  }
  if (r.kind === "note") {
    return (
      <div className={styles.note}>
        <span className={styles.label}>{["NOTE", ...r.tags.map((t) => t.toUpperCase())].join(" · ")}</span>
        <p className={styles.noteText}>{r.text}</p>
      </div>
    );
  }
  return (
    <div className={styles.note}>
      <span className={styles.label}>{siteLabel(r.url)} · {r.moments.length === 1 ? "1 MOMENT" : `${r.moments.length} MOMENTS`}</span>
      <p className={styles.noteText}>{r.title ?? r.url.replace(/^https?:\/\/(www\.)?/, "")}</p>
      {r.moments.length > 0 && <p className={styles.moments}>{r.moments.map(formatTime).join(" · ")}</p>}
    </div>
  );
}
