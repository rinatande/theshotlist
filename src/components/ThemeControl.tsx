"use client";

import { useEffect, useState } from "react";
import { applyThemeChoice, readThemeChoice, syncThemeColor, type ThemeChoice } from "@/lib/theme";
import { Choice } from "./Choice";

// Interim copy: §9's "Auto follows sunset where you are" becomes true in M3,
// when sun times exist. Until then Auto follows the phone's setting.
const HELP: Record<ThemeChoice, string> = {
  day: "Day is pinned on. Switch to Auto to follow your phone's light or dark setting.",
  night: "Night is pinned on. Switch to Auto to follow your phone's light or dark setting.",
  auto: "Auto follows your phone's light or dark setting. Following sunset where you are comes with locations.",
};

/** Settings → Appearance → Theme (§9): DAY / NIGHT / AUTO, helper text beneath. */
export function ThemeControl() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  useEffect(() => {
    // localStorage is only readable on the client; the head script has
    // already applied the theme, so this only syncs the control and meta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readThemeChoice());
    syncThemeColor();
  }, []);

  return (
    <Choice
      label="Theme"
      variant="segmented"
      options={[
        { value: "day", label: "DAY" },
        { value: "night", label: "NIGHT" },
        { value: "auto", label: "AUTO" },
      ]}
      value={choice}
      onChange={(next) => {
        setChoice(next);
        applyThemeChoice(next);
      }}
      hint={HELP[choice]}
    />
  );
}
