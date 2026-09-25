import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AppFrame.module.css";

/**
 * The frame the three top-level screens share (H1–H6): THESHOTLIST and the
 * profile square above, HOME · PROJECTS · GEAR below. Inside a project, and
 * in shoot mode and wrap, there's no bar — those are places you go into.
 */

export type Section = "home" | "projects" | "gear";

/** Brand row with the profile square, then whatever heads the screen. */
export function AppTop({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.top}>
      <div className={styles.brandRow}>
        <span className={styles.brand}>THESHOTLIST</span>
        <ProfileSquare />
      </div>
      {children}
    </div>
  );
}

/**
 * Settings lives behind the square, not a cog: a cog beside a bar that says
 * GEAR reads as the same word twice (case-study-log 2.29). No sign-in yet, so
 * it carries a person, never an initial.
 */
function ProfileSquare() {
  return (
    <Link href="/settings" aria-label="Settings — not signed in" className={styles.profile}>
      <span className={styles.square}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="5.5" r="2.75" />
          <path d="M2.5 14.5c0-3 2.5-4.75 5.5-4.75s5.5 1.75 5.5 4.75" />
        </svg>
      </span>
    </Link>
  );
}

const TABS: { section: Section; href: string; label: string; icon: ReactNode }[] = [
  {
    section: "home",
    href: "/",
    label: "HOME",
    icon: (
      <>
        <path d="M3 9.5 10 4l7 5.5" />
        <path d="M5 8.5V16h10V8.5" />
      </>
    ),
  },
  { section: "projects", href: "/projects", label: "PROJECTS", icon: <path d="M4 6h12M4 10h12M4 14h8" /> },
  {
    section: "gear",
    href: "/gear",
    label: "GEAR",
    icon: (
      <>
        <rect x="3" y="6.5" width="14" height="9.5" />
        <circle cx="10" cy="11.25" r="2.75" />
        <path d="M7.5 6.5 8.5 4.5h3l1 2" />
      </>
    ),
  },
];

/** The screen's main action, if it has one, sitting on the bar. */
export function Dock({ current, children }: { current: Section; children?: ReactNode }) {
  return (
    <div className={styles.dock}>
      {children && <div className={styles.action}>{children}</div>}
      <nav aria-label="Main" className={styles.bar}>
        {TABS.map((t) => {
          const on = t.section === current;
          return (
            <Link key={t.section} href={t.href} aria-current={on ? "page" : undefined} className={on ? `${styles.tab} ${styles.current}` : styles.tab}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={on ? 1.75 : 1.4}>
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
