/**
 * Theme choice (design.md §9).
 *
 * Auto is the default and needs no JS: tokens.css follows prefers-color-scheme.
 * Day or Night pins it by setting data-theme on <html>. The choice lives in
 * localStorage, not IndexedDB, because it must be known before first paint —
 * THEME_SCRIPT runs in <head> so a pinned Night never flashes Day.
 *
 * Auto following sunset needs sun times, which arrive with locations (M3).
 * Until then Auto means prefers-color-scheme.
 */

export type ThemeChoice = "day" | "night" | "auto";

export const THEME_KEY = "tsl-theme";

/** Inlined in <head>. Keep it tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="day"||t==="night")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "day" || t === "night" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  try {
    if (choice === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }

  syncThemeColor();
}

/**
 * Point every theme-color meta at the resolved --ground, so the OS chrome
 * follows a pinned theme (§3). Read from the token rather than hard-coded, so
 * night stays a pure token swap. Auto restores the media-matched defaults.
 */
export function syncThemeColor(): void {
  const pinned = document.documentElement.hasAttribute("data-theme");
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.dataset.auto) meta.dataset.auto = meta.content;
    meta.content = pinned ? ground : meta.dataset.auto;
  });
}
