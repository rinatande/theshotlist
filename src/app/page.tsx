import { GlyphCheck } from "./GlyphCheck";
import { OfflineStatus } from "./OfflineStatus";
import { ThemeControl } from "./ThemeControl";
import styles from "./page.module.css";

// M0 proof page: both themes, the font, and offline. Replaced by Projects in M2.

const TOKENS: { name: string; role: string }[] = [
  { name: "--ground", role: "app background" },
  { name: "--band", role: "section header bands" },
  { name: "--field", role: "input fill" },
  { name: "--ink", role: "primary text" },
  { name: "--ink-muted", role: "metadata, exposed rows" },
  { name: "--ink-faint", role: "text on band" },
  { name: "--rule", role: "hairlines" },
  { name: "--accent", role: "primary action, selected" },
  { name: "--accent-ink", role: "text on accent" },
  { name: "--ok", role: "exposed, complete" },
  { name: "--warn", role: "gap, flag, over budget" },
  { name: "--track", role: "progress track" },
  { name: "--scrim", role: "behind a bottom sheet" },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.label}>M0 · THEME PROOF</p>
        <h1 className={styles.title}>THESHOTLIST</h1>
        <OfflineStatus />
      </header>

      <section aria-labelledby="theme-h">
        <h2 id="theme-h" className={styles.band}>
          THEME <span className={styles.bandNote}>TEMPORARY — MOVES TO SETTINGS</span>
        </h2>
        <div className={styles.body}>
          <ThemeControl />
        </div>
      </section>

      <section aria-labelledby="tokens-h">
        <h2 id="tokens-h" className={styles.band}>
          TOKENS
        </h2>
        <ul className={styles.tokens}>
          {TOKENS.map((t) => (
            <li key={t.name} className={styles.tokenRow}>
              <span className={styles.swatch} style={{ background: `var(${t.name})` }} aria-hidden="true" />
              <span className={styles.tokenName}>{t.name}</span>
              <span className={styles.tokenRole}>{t.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type-h">
        <h2 id="type-h" className={styles.band}>
          TYPE · JETBRAINS MONO
        </h2>
        <div className={styles.body}>
          <p className={styles.screenTitle}>COASTAL BRAND FILM</p>
          <p className={styles.w400}>400 — Hands on the rope, 85mm, slow push in.</p>
          <p className={styles.w500}>500 — Hands on the rope, 85mm, slow push in.</p>
          <p className={styles.w700}>700 — Hands on the rope, 85mm, slow push in.</p>
          <p className={styles.meta}>24MM · TRIPOD · 6:10 AM · 04/12 · 18—24</p>
        </div>
      </section>

      <section aria-labelledby="marks-h">
        <h2 id="marks-h" className={styles.band}>
          STATUS MARKS
        </h2>
        <ul className={styles.marks}>
          <li>
            <span className={styles.muted}>[ ]</span> planned
          </li>
          <li>
            <span className={styles.ok}>[✓]</span> <s className={styles.muted}>exposed</s>
          </li>
          <li>
            <span className={styles.accent}>[★]</span> required
          </li>
          <li>
            <span className={styles.accent}>(•)</span> selected <span className={styles.muted}>( )</span> not
          </li>
          <li>
            <span className={styles.warn}>! NO COVERAGE YET</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="glyphs-h">
        <h2 id="glyphs-h" className={styles.band}>
          GLYPH CHECK
        </h2>
        <p className={styles.body}>
          Whether each symbol the boards use is in JetBrains Mono, or is being drawn by a fallback font.
        </p>
        <GlyphCheck />
      </section>
    </main>
  );
}
