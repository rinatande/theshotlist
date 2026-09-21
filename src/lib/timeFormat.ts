/**
 * Settings → Shot lists → Time format (§5.10). "6:10 AM" by default, "0610"
 * for anyone who prefers it. A display preference for this phone, so it
 * lives in localStorage beside the theme.
 */
export type TimeFormat = "12h" | "24h";

const KEY = "tsl-time-format";

export function readTimeFormat(): TimeFormat {
  try {
    return localStorage.getItem(KEY) === "24h" ? "24h" : "12h";
  } catch {
    return "12h";
  }
}

export function writeTimeFormat(format: TimeFormat): void {
  try {
    localStorage.setItem(KEY, format);
  } catch {}
}

/** Minutes after midnight → "6:10 AM" or "0610". */
export function formatClock(minutes: number, format: TimeFormat): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const mm = String(m).padStart(2, "0");
  if (format === "24h") return `${String(h).padStart(2, "0")}${mm}`;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${suffix}`;
}
