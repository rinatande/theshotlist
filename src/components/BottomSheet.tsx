"use client";

import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";
import styles from "./BottomSheet.module.css";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet (§7): over a scrim, dismissed by tapping the scrim, swiping
 * down, Escape or CLOSE. Focus moves in on open and back out on close.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") trapFocus(e, sheet.current);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 60) onClose();
    startY.current = null;
  };

  return (
    <div className={styles.layer}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className={styles.sheet}
      >
        <div className={styles.grab} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <span aria-hidden="true" className={styles.grabber} />
          <div className={styles.head}>
            <h2 id="sheet-title" className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.close} onClick={onClose}>
              CLOSE
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = root.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex='0']");
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
