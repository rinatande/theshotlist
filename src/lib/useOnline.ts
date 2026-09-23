"use client";

import { useSyncExternalStore } from "react";

const subscribe = (on: () => void) => {
  window.addEventListener("online", on);
  window.addEventListener("offline", on);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", on);
  };
};

/**
 * Whether the phone has signal. Generating needs the read (Rina, 23 Sep), so
 * the screens that generate say plainly when it can't happen. Assumed online
 * while rendering on the server.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
