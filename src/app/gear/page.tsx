import Link from "next/link";
import ui from "@/components/ui.module.css";

/** Stub (CLAUDE.md v0 scope): the screen loads and says gear is coming. */
export default function GearPage() {
  return (
    <div className={ui.screen}>
      <div className={ui.body}>
        <Link href="/" className={ui.backLink}>
          ← PROJECTS
        </Link>
        <h1 className={ui.stepLabel}>My gear</h1>
        <p className={ui.boxTextMuted}>
          Gear is coming. Until then, shot suggestions work without it — they just won&apos;t name the lens that earned
          them.
        </p>
      </div>
    </div>
  );
}
