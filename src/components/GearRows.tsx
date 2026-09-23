import Link from "next/link";
import type { ReactNode } from "react";
import { specLine } from "@/lib/gear";
import type { GearItem } from "@/lib/types";
import styles from "./Gear.module.css";
import { StatusMark } from "./Marks";

/** A category band with its count, like a location band (G1, G3). */
export function GearBand({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className={styles.band}>
        <span>{title}</span>
        <span>{String(count).padStart(2, "0")}</span>
      </h2>
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

/** G1: an item in the library — name, key spec on the right, into its edit screen. */
export function GearLinkRow({ item, href }: { item: GearItem; href: string }) {
  return (
    <li>
      <Link href={href} className={styles.linkRow}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.spec}>{specLine(item.specs)}</span>
      </Link>
    </li>
  );
}

/**
 * G3, G4 and the kit screen: the same [ ] / [✓] control as a shot row (§6.3).
 * `struck` strikes the name through once it's in the bag (G4) — muted ink,
 * never opacity (§3).
 */
export function GearCheckRow({
  item,
  checked,
  line,
  lineAccent,
  struck,
  label,
  onToggle,
}: {
  item: GearItem;
  checked: boolean;
  line?: string;
  lineAccent?: boolean;
  struck?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <li>
      <button type="button" className={styles.checkRow} aria-pressed={checked} aria-label={`${item.name}: ${label}`} onClick={onToggle}>
        <span className={styles.stack}>
          <span className={struck && checked ? styles.nameDone : styles.name}>{item.name}</span>
          <span className={lineAccent ? styles.lineAccent : styles.line}>{line ?? specLine(item.specs)}</span>
        </span>
        <StatusMark exposed={checked} />
      </button>
    </li>
  );
}
