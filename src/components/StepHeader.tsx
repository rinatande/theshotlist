import Link from "next/link";
import ui from "./ui.module.css";

interface Props {
  label: string;
  step: 1 | 2;
  back: { label: string; href?: string; onClick?: () => void };
}

/** "← CANCEL · New project · 1/2" with the 3px step meter under it. */
export function StepHeader({ label, step, back }: Props) {
  return (
    <>
      <header className={ui.stepHeader}>
        {back.href ? (
          <Link href={back.href} className={ui.backLink}>
            {back.label}
          </Link>
        ) : (
          <button type="button" className={ui.backLink} onClick={back.onClick}>
            {back.label}
          </button>
        )}
        <h1 className={ui.stepLabel}>{label}</h1>
      </header>
      <div className={ui.stepMeter} aria-hidden="true">
        <span style={{ width: step === 1 ? "50%" : "100%" }} />
      </div>
    </>
  );
}
