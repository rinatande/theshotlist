"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { lockNight } from "./theme";

/** Night only while the screen is open (§8 Shoot mode); layout effect so day never paints first. */
export function useNightLock(): void {
  useLayoutEffect(() => lockNight(), []);
}

/**
 * Keep the phone awake in shoot mode: a screen that locks between takes is a
 * screen you unlock with cold hands (Rina, 22 Sep). The browser drops the
 * lock when the page is hidden, so it's asked for again on return. Where
 * the API is missing, nothing happens.
 */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const request = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else next.release().catch(() => {});
      } catch {
        // Battery saver or a denied request: the screen just sleeps as usual.
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** The time, updated every `ms` — for "LIGHT GOES 6:10 PM · 46 MIN". */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
