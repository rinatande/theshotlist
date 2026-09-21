"use client";

import { useEffect, useState } from "react";

/** True once the service worker holds the app, so it will open with no signal. */
export function useOfflineReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let live = true;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) navigator.serviceWorker.ready.then(() => live && setReady(true));
    });
    return () => {
      live = false;
    };
  }, []);

  return ready;
}
