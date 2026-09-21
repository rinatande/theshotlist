"use client";

import { useEffect, useState } from "react";
import { applyThemeChoice, readThemeChoice, syncThemeColor, type ThemeChoice } from "@/lib/theme";
import styles from "./page.module.css";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "day", label: "DAY" },
  { value: "night", label: "NIGHT" },
  { value: "auto", label: "AUTO" },
];

// Interim copy: §9's "Auto follows sunset where you are" becomes true in M3,
// when sun times exist. Until then Auto follows the phone's setting.
const HELP: Record<ThemeChoice, string> = {
  day: "Day is pinned on. Switch to Auto to follow your phone's light or dark setting.",
  night: "Night is pinned on. Switch to Auto to follow your phone's light or dark setting.",
  auto: "Auto follows your phone's light or dark setting. Following sunset where you are comes with locations.",
};

/**
 * Temporary: the real control lives in Settings → Appearance → Theme (§9).
 * Segmented control per §7.
 */
export function ThemeControl() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  useEffect(() => {
    // Reading localStorage has to wait for the client; the head script has
    // already applied the theme, so this only syncs the control and meta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readThemeChoice());
    syncThemeColor();
  }, []);

  function choose(next: ThemeChoice) {
    setChoice(next);
    applyThemeChoice(next);
  }

  return (
    <div>
      <div className={styles.segmented} role="group" aria-label="Theme">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={styles.segment}
            aria-pressed={choice === o.value}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className={styles.help} aria-live="polite">
        {HELP[choice]}
      </p>
    </div>
  );
}
