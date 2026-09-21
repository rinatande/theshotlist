"use client";

import { useEffect, useState } from "react";

/**
 * Form state that survives moving between steps and a reload mid-form. Kept
 * in sessionStorage — a per-tab convenience, gone when the form is done.
 */
export function useDraft<T>(key: string, initial: T): [T, (update: (prev: T) => T) => void, () => void, boolean] {
  const [draft, setDraft] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft(JSON.parse(saved) as T);
    } catch {
      // Storage unavailable: the form still works, it just won't survive a reload.
    }
    setLoaded(true);
  }, [key]);

  // Updates merge into the latest draft, so two quick taps never overwrite each other.
  const update = (fn: (prev: T) => T) => {
    setDraft((prev) => {
      const next = fn(prev);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  };

  return [draft, update, clear, loaded];
}
