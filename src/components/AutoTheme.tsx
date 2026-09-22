"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { deviceCoords } from "@/lib/place";
import { todayIso } from "@/lib/status";
import { sunInstants } from "@/lib/sun";
import { readThemeChoice, SUN_EVENT, SUN_KEY, syncThemeColor, THEME_EVENT, themeLocked, type CachedSun } from "@/lib/theme";
import type { Coords } from "@/lib/types";

/**
 * Auto follows sunset where you are (§9). Mounted once in the layout; renders
 * nothing. Works offline: sun times are calculated on the device from
 * coordinates the app already has.
 */
export function AutoTheme() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function resolve() {
      clearTimeout(timer);
      if (readThemeChoice() !== "auto" || themeLocked()) return;

      const coords = await whereYouAre();
      if (themeLocked()) return; // shoot mode or wrap opened while this was looking
      const root = document.documentElement;
      if (!coords) {
        root.removeAttribute("data-theme"); // prefers-color-scheme takes over
        syncThemeColor();
        return;
      }

      const now = new Date();
      const today = todayIso(now);
      const sun = sunInstants(today, coords.lat, coords.lng);
      if (!sun.sunrise || !sun.sunset) {
        root.removeAttribute("data-theme");
        syncThemeColor();
        return;
      }
      const day = now >= sun.sunrise && now < sun.sunset;
      root.setAttribute("data-theme", day ? "day" : "night");
      syncThemeColor();
      try {
        const cache: CachedSun = { date: today, sunrise: sun.sunrise.toISOString(), sunset: sun.sunset.toISOString() };
        localStorage.setItem(SUN_KEY, JSON.stringify(cache));
      } catch {}
      window.dispatchEvent(new Event(SUN_EVENT));

      // Switch again at the next sunrise or sunset (or check again in an hour).
      const next = [sun.sunrise, sun.sunset].map((d) => d.getTime() - now.getTime()).filter((ms) => ms > 0);
      timer = setTimeout(resolve, Math.min(60 * 60_000, ...next) + 1000);
    }

    resolve();
    window.addEventListener(THEME_EVENT, resolve);
    document.addEventListener("visibilitychange", resolve);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(THEME_EVENT, resolve);
      document.removeEventListener("visibilitychange", resolve);
    };
  }, []);

  return null;
}

/**
 * The phone's position if location is already allowed — Auto never asks for
 * it — else the place of a project shooting today.
 */
async function whereYouAre(): Promise<Coords | null> {
  try {
    const permission = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (permission?.state === "granted") {
      const here = await deviceCoords();
      if (here) return here;
    }
  } catch {}

  const today = todayIso();
  const projects = await db.projects.toArray();
  for (const p of projects) {
    const day = p.days.find((d) => d.date === today);
    if (!day) continue;
    const located = p.locations.find((l) => l.dayId === day.id && l.coords) ?? p.locations.find((l) => l.coords);
    const coords = located?.coords ?? p.coords;
    if (coords) return coords;
  }
  return null;
}
