"use client";

import { useEffect, useState } from "react";
import { clockIn } from "@/lib/sun";
import { applyThemeChoice, readCachedSun, readThemeChoice, SUN_EVENT, syncThemeColor, type ThemeChoice } from "@/lib/theme";
import { formatClock, readTimeFormat } from "@/lib/timeFormat";
import { todayIso } from "@/lib/status";
import { Choice } from "./Choice";

/** Helper text under the control (§9), with the switch time when Auto knows it. */
function help(choice: ThemeChoice): string {
  if (choice === "day") return "Day is pinned on. Switch to Auto to follow sunset where you are.";
  if (choice === "night") return "Night is pinned on. Switch to Auto to follow sunset where you are.";

  const sun = readCachedSun();
  if (sun && sun.date === todayIso()) {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const at = formatClock(clockIn(new Date(sun.sunset), zone), readTimeFormat());
    return new Date() < new Date(sun.sunset)
      ? `Auto follows sunset where you are. Tonight it switches to Night at ${at}.`
      : `Auto follows sunset where you are. It switched to Night at ${at}, and Day comes back at sunrise.`;
  }
  return "Auto follows sunset where you are, once it knows where that is — give today's project a place, or allow location. Until then it follows your phone's light or dark setting.";
}

/** Settings → Appearance → Theme (§9): DAY / NIGHT / AUTO, helper text beneath. */
export function ThemeControl() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");
  const [hint, setHint] = useState("");

  useEffect(() => {
    // localStorage is only readable on the client; the head script has
    // already applied the theme, so this only syncs the control and meta.
    const c = readThemeChoice();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(c);
    setHint(help(c));
    syncThemeColor();
    const onSun = () => setHint(help(readThemeChoice()));
    window.addEventListener(SUN_EVENT, onSun);
    return () => window.removeEventListener(SUN_EVENT, onSun);
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
        setHint(help(next));
      }}
      hint={hint}
    />
  );
}
