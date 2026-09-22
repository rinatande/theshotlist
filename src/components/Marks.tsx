import styles from "./Marks.module.css";

/**
 * ★, drawn. JetBrains Mono has no star (§10, 22), and the phone's fallback
 * font draws one heavier and larger than the brackets, differently on every
 * phone. This sits in one mono cell at the brackets' weight, in currentColor.
 */
export function Star() {
  return (
    <svg className={styles.star} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 17l-5.8 3.4 1.5-6.5-5-4.4 6.6-.6z" />
    </svg>
  );
}

/** [★] — required. The words are for screen readers; the brackets carry it visually (§3). */
export function RequiredMark({ label = "Required" }: { label?: string }) {
  return (
    <span className={styles.required}>
      <span aria-hidden="true">[</span>
      <Star />
      <span aria-hidden="true">]</span>
      <span className={styles.sr}>{label}</span>
    </span>
  );
}

/**
 * [ ] / [✓]. `fresh` plays the one noticeable motion in the app: the tick
 * wipes in left to right over 120ms (§3, Motion).
 */
export function StatusMark({ exposed, fresh }: { exposed: boolean; fresh?: boolean }) {
  return (
    <span className={exposed ? styles.exposed : styles.unshot} aria-hidden="true">
      [<span className={exposed && fresh ? styles.wipe : styles.cell}>{exposed ? "✓" : " "}</span>]
    </span>
  );
}
