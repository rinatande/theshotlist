import Link from "next/link";
import ui from "./ui.module.css";

/** Shown when a link points at something that's no longer on this phone. */
export function NotHere({ href, label = "← BACK" }: { href: string; label?: string }) {
  return (
    <div className={ui.screen}>
      <div className={ui.body}>
        <h1 className={ui.stepLabel}>Not on this phone</h1>
        <p className={ui.boxTextMuted}>It may have been deleted.</p>
        <Link href={href} className={ui.secondary}>
          {label}
        </Link>
      </div>
    </div>
  );
}
