import dictionary from "@/data/chips.json";
import type { Chip, Light } from "./types";

/**
 * Offline brief matching (design.md §5.6): the words you typed, turned into
 * quoted chips, on the device. Runs on a pause in typing, never per keystroke
 * and never over the network.
 */

interface Entry {
  label: string;
  kind: Chip["kind"];
  light?: Light;
  words: string[];
}

const ENTRIES = dictionary as Entry[];

/** A quoted chip, plus the light it implies when it's a time of day. */
export interface QuotedChip extends Chip {
  light?: Light;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every dictionary word, so the place rule doesn't turn "Sunrise" into a place. */
const KNOWN = new Set(ENTRIES.flatMap((e) => e.words.map((w) => w.toLowerCase())));

/** Capitalised words that aren't places. */
const NOT_PLACES = new Set(
  [
    "i", "i'm", "i'll", "i've", "we", "they", "the", "a", "an", "my", "our", "their", "it", "this", "that", "then", "and", "but", "or",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "day", "rest", "also", "maybe", "need", "they're", "there",
  ].map((w) => w.toLowerCase()),
);

export function matchChips(text: string): QuotedChip[] {
  const lower = text.toLowerCase();
  const found = new Map<string, QuotedChip>();

  for (const e of ENTRIES) {
    const hit = e.words.some((w) => new RegExp(`(^|[^a-z])${escape(w.toLowerCase())}($|[^a-z])`).test(lower));
    if (hit) found.set(e.label, { label: e.label, kind: e.kind as Chip["kind"], light: e.light });
  }

  // Place names can't be listed in advance: a capitalised word that isn't the
  // first of its sentence, and isn't a dictionary word, becomes a place (§5.6).
  // Consecutive capitalised words stay together: "Nagi Coffee".
  for (const sentence of text.split(/(?<=[.!?\n])\s*/)) {
    const words = sentence.split(/\s+/).filter(Boolean);
    let run: string[] = [];
    const flush = () => {
      if (run.length) {
        const label = run.join(" ").toUpperCase();
        if (!found.has(label)) found.set(label, { label, kind: "place" });
      }
      run = [];
    };
    words.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}]+|[^\p{L}']+$/gu, "");
      const capital = /^\p{Lu}/u.test(w) && !/^\p{Lu}+$/u.test(w.length > 1 ? w : "x");
      // A dictionary word can carry on a name already started ("Nagi Coffee"), not start one.
      const usable = i > 0 && capital && !NOT_PLACES.has(w.toLowerCase()) && (run.length > 0 || !KNOWN.has(w.toLowerCase()));
      if (usable) run.push(w);
      else flush();
      // Punctuation after a word ends the run: "Kyoto, Osaka" is two places.
      if (usable && /[,;:]$/.test(raw)) flush();
    });
    flush();
  }

  return [...found.values()];
}
