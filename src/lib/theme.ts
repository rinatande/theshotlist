/**
 * Theme choice (design.md §9).
 *
 * Day or Night pins it by setting data-theme on <html>. Auto, the default,
 * follows sunset where you are: when the app knows where that is (the phone's
 * location, if already allowed, else today's project), it sets data-theme to
 * day or night itself and caches today's sunrise and sunset so the next launch
 * paints right first time. When it doesn't know, it leaves data-theme off and
 * tokens.css follows prefers-color-scheme with no JS.
 *
 * Choices live in localStorage, not IndexedDB, because they must be known
 * before first paint — THEME_SCRIPT runs in <head>.
 */

export type ThemeChoice = "day" | "night" | "auto";

export const THEME_KEY = "tsl-theme";
/** Today's sun at the last known place: {date, sunrise, sunset} as ISO instants. */
export const SUN_KEY = "tsl-sun";
/** Fired when the choice changes, so Auto can re-resolve. */
export const THEME_EVENT = "tsl-theme-change";
/** Fired when Auto has worked out today's sunset, so Settings can say when it switches. */
export const SUN_EVENT = "tsl-sun-change";

/** Inlined in <head>. Keep it tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var r=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t==="day"||t==="night"){r.setAttribute("data-theme",t);return}var s=JSON.parse(localStorage.getItem("${SUN_KEY}")||"null"),n=new Date(),d=n.getFullYear()+"-"+("0"+(n.getMonth()+1)).slice(-2)+"-"+("0"+n.getDate()).slice(-2);if(s&&s.date===d&&s.sunrise&&s.sunset){r.setAttribute("data-theme",n>=new Date(s.sunrise)&&n<new Date(s.sunset)?"day":"night")}}catch(e){}})()`;

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
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Point every theme-color meta at the resolved --ground, so the OS chrome
 * follows (§3). Read from the token rather than hard-coded, so night stays a
 * pure token swap. With no data-theme, the media-matched defaults return.
 */
export function syncThemeColor(): void {
  const set = document.documentElement.hasAttribute("data-theme");
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.dataset.auto) meta.dataset.auto = meta.content;
    meta.content = set ? ground : meta.dataset.auto;
  });
}

export interface CachedSun {
  date: string;
  sunrise: string;
  sunset: string;
}

export function readCachedSun(): CachedSun | null {
  try {
    return JSON.parse(localStorage.getItem(SUN_KEY) ?? "null") as CachedSun | null;
  } catch {
    return null;
  }
}
