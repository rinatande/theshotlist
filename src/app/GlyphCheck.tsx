"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

// Every non-ASCII glyph the boards rely on.
const GLYPHS: { glyph: string; use: string }[] = [
  { glyph: "✓", use: "exposed [✓]" },
  { glyph: "★", use: "required [★]" },
  { glyph: "•", use: "selected radio (•)" },
  { glyph: "⋯", use: "project actions" },
  { glyph: "←", use: "back link" },
  { glyph: "›", use: "row chevron" },
  { glyph: "—", use: "ranges 18—24" },
  { glyph: "·", use: "separators" },
  { glyph: "×", use: "genre × treatment" },
];

type Result = "checking" | "in-font" | "fallback";

/**
 * A glyph is in JetBrains Mono if it measures the same whichever generic
 * family sits behind it AND is exactly one mono cell wide. The second test
 * matters: a missing symbol is often drawn by an OS symbol font whatever the
 * stack says, which passes the first test on its own.
 */
function inFont(family: string, glyph: string): boolean {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return false;
  const widths = ["monospace", "serif", "sans-serif"].map((fallback) => {
    ctx.font = `400 40px ${family}, ${fallback}`;
    return ctx.measureText(glyph).width;
  });
  const cell = ctx.measureText("M").width;
  return widths.every((w) => Math.abs(w - cell) < 0.01);
}

export function GlyphCheck() {
  const [results, setResults] = useState<Result[]>(GLYPHS.map(() => "checking"));

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      // First entry of the stack is next/font's generated family name.
      const family = getComputedStyle(document.body).fontFamily.split(",")[0].trim();
      setResults(GLYPHS.map(({ glyph }) => (inFont(family, glyph) ? "in-font" : "fallback")));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ul className={styles.glyphs}>
      {GLYPHS.map(({ glyph, use }, i) => (
        <li key={glyph} className={styles.glyphRow}>
          <span className={styles.glyph} aria-hidden="true">
            {glyph}
          </span>
          <span className={styles.glyphUse}>{use}</span>
          <span className={results[i] === "fallback" ? styles.warn : styles.muted}>
            {results[i] === "checking" ? "…" : results[i] === "in-font" ? "IN FONT" : "! FALLBACK"}
          </span>
        </li>
      ))}
    </ul>
  );
}
