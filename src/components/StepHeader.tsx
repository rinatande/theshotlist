import Link from "next/link";
import ui from "./ui.module.css";

interface Props {
  label: string;
  /** Stepped forms show the 3px step meter; single screens leave it out. */
  step?: number;
  /** How many steps the form has (new project has three since v1 gear). */
  steps?: number;
  back: { label: string; href?: string; onClick?: () => void };
}

/** "← CANCEL · New project · 1/2", with the step meter under it when there are steps. */
export function StepHeader({ label, step, steps = 2, back }: Props) {
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
      {step && (
        <div className={ui.stepMeter} aria-hidden="true">
          <span style={{ width: `${(step / steps) * 100}%` }} />
        </div>
      )}
    </>
  );
}
