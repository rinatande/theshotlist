"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Drag to reorder a flat list, by touch, mouse or keyboard (§3: no hover-only
 * affordances; real controls). Entries marked `fixed` (location bands) don't
 * move, but others can be dragged past them — that's how a shot changes
 * location. No library: pointer events plus row midpoints.
 */
export function useReorder(ids: string[], opts: { fixed?: (id: string) => boolean; minIndex?: number; onCommit: (ids: string[]) => void; describe: (ids: string[], id: string) => string }) {
  const [live, setLive] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const rows = useRef(new Map<string, HTMLElement>());
  const order = live ?? ids;
  const min = opts.minIndex ?? 0;

  const place = (list: string[], id: string, index: number) => {
    const without = list.filter((x) => x !== id);
    const at = Math.max(min, Math.min(without.length, index));
    return [...without.slice(0, at), id, ...without.slice(at)];
  };

  const handleProps = (id: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks; the drag still works without capture.
      }
      setDragging(id);
      setLive(order);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (dragging !== id || !live) return;
      // Where the pointer sits among the other rows' midpoints is where the row goes.
      const others = live.filter((x) => x !== id);
      let index = 0;
      for (const other of others) {
        const el = rows.current.get(other);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) index++;
      }
      const next = place(live, id, index);
      if (next.join() !== live.join()) setLive(next);
    },
    onPointerUp: () => {
      if (dragging !== id) return;
      setDragging(null);
      if (live && live.join() !== ids.join()) {
        opts.onCommit(live);
        setAnnouncement(opts.describe(live, id));
      }
      setLive(null);
    },
    onPointerCancel: () => {
      setDragging(null);
      setLive(null);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      e.preventDefault();
      const i = order.indexOf(id);
      const next = place(order, id, i + step);
      if (next.join() === order.join()) return;
      opts.onCommit(next);
      setAnnouncement(opts.describe(next, id));
    },
  });

  const rowRef = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };

  return { order, dragging, handleProps, rowRef, announcement, isFixed: opts.fixed ?? (() => false) };
}
