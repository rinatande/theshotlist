"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./page.module.css";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Network and service-worker state, so "opens with no signal" can be checked on the phone. */
export function OfflineStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => null,
  );
  const [worker, setWorker] = useState<"checking" | "ready" | "none">("checking");

  useEffect(() => {
    const registration =
      "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined);
    registration.then((reg) => {
      if (!reg) setWorker("none");
      else navigator.serviceWorker.ready.then(() => setWorker("ready"));
    });
  }, []);

  return (
    <dl className={styles.status}>
      <div>
        <dt>NETWORK</dt>
        <dd>{online === null ? "…" : online ? "ONLINE" : "OFFLINE"}</dd>
      </div>
      <div>
        <dt>OFFLINE COPY</dt>
        <dd>{worker === "checking" ? "…" : worker === "ready" ? "[✓] SAVED" : "[ ] NOT YET"}</dd>
      </div>
    </dl>
  );
}
