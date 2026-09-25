"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Choice } from "@/components/Choice";
import { ThemeControl } from "@/components/ThemeControl";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { formatClock, readTimeFormat, writeTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import { useLive } from "@/lib/useLive";
import { useOfflineReady } from "@/lib/useOfflineReady";
import { forgetInvite, inviteCode, readsLeft } from "@/lib/readClient";
import styles from "./Settings.module.css";

/** The event Chrome and Android fire when the app can be installed. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** S5 Settings, v0 rows (§8): theme, time format, storage, install. */
export function SettingsScreen() {
  const router = useRouter();
  const count = useLive(() => db.projects.count(), []);
  const offlineReady = useOfflineReady();
  const [time, setTime] = useState<TimeFormat>("12h");
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [invite, setInvite] = useState<string | undefined>(undefined);
  const [left, setLeft] = useState<{ available: boolean; remaining: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(readTimeFormat());
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setInvite(inviteCode());
    readsLeft().then(setLeft);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className={ui.screen}>
      <header className={styles.header}>
        {/* Reached from the profile square on any tab, so it goes back where you were. */}
        <button type="button" className={ui.backLink} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>
          ← BACK
        </button>
        <h1 className={styles.title}>SETTINGS</h1>
      </header>

      <section aria-labelledby="appearance">
        <h2 id="appearance" className={ui.band}>
          APPEARANCE
        </h2>
        <div className={styles.group}>
          <ThemeControl />
        </div>
      </section>

      <section aria-labelledby="lists">
        <h2 id="lists" className={ui.band}>
          SHOT LISTS
        </h2>
        <div className={styles.group}>
          <Choice
            label="Time format"
            variant="segmented"
            options={[
              { value: "12h", label: "12-HOUR" },
              { value: "24h", label: "24-HOUR" },
            ]}
            value={time}
            onChange={(t) => {
              setTime(t);
              writeTimeFormat(t);
            }}
            hint={`Start times read ${formatClock(370, time)}.`}
          />
        </div>
      </section>

      <section aria-labelledby="data" className={ui.flush}>
        <h2 id="data" className={ui.band}>
          DATA
        </h2>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Offline storage</dt>
            <dd className={styles.value}>
              {count === undefined ? "…" : count === 1 ? "1 PROJECT" : `${count} PROJECTS`}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Full brief reads</dt>
            <dd className={styles.value}>
              {left?.available ? (left.remaining === 1 ? "1 LEFT" : `${left.remaining} LEFT`) + (invite ? "" : " TODAY") : "OFFLINE"}
            </dd>
          </div>
          {invite && (
            <div className={styles.row}>
              <dt>Invite · {invite.toUpperCase()}</dt>
              <dd className={styles.value}>
                <button
                  type="button"
                  className={styles.install}
                  onClick={() => {
                    forgetInvite();
                    setInvite(undefined);
                    readsLeft().then(setLeft);
                  }}
                >
                  FORGET
                </button>
              </dd>
            </div>
          )}
          <div className={styles.row}>
            <dt>Add to home screen</dt>
            <dd className={styles.value}>
              {installed ? (
                "INSTALLED"
              ) : install ? (
                <button
                  type="button"
                  className={styles.install}
                  onClick={async () => {
                    await install.prompt();
                    const { outcome } = await install.userChoice;
                    if (outcome === "accepted") setInstalled(true);
                    setInstall(null);
                  }}
                >
                  INSTALL
                </button>
              ) : (
                <span className={styles.how}>Browser menu › Add to Home Screen</span>
              )}
            </dd>
          </div>
        </dl>
        <p className={styles.note}>Your projects are stored on this phone, not on a server. A brief is sent once when it&apos;s read in full, and isn&apos;t stored.</p>
      </section>

      <footer className={styles.footer}>
        THESHOTLIST v0.1{offlineReady ? " · OFFLINE OK" : ""}
      </footer>
    </div>
  );
}
