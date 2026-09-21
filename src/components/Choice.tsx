"use client";

import { useId, type KeyboardEvent } from "react";
import ui from "./ui.module.css";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  label: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** chips wrap and hug their text; segments share one ruled box (§7). */
  variant?: "chips" | "segmented";
  hint?: string;
  /** Keep the label for screen readers only, where the board draws none. */
  hideLabel?: boolean;
  /** 11px chips, for filter rows (S1). Still 44px tall. */
  small?: boolean;
}

/**
 * One choice from a few: a radio group drawn as chips or a segmented control.
 * Arrow keys move between options, as a radio group should.
 */
export function Choice<T extends string>({ label, options, value, onChange, variant = "chips", hint, hideLabel, small }: Props<T>) {
  const id = useId();
  const enabled = options.filter((o) => !o.disabled);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || enabled.length === 0) return;
    e.preventDefault();
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + step + enabled.length) % enabled.length];
    onChange(next.value);
    (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
  }

  // Only the selected option (or the first) sits in the tab order.
  const focusable = value ?? enabled[0]?.value;

  return (
    <div className={ui.fieldset}>
      <span id={id} className={hideLabel ? ui.visuallyHidden : ui.label}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className={variant === "chips" ? ui.chips : ui.segmented}
        onKeyDown={onKeyDown}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-value={o.value}
            aria-checked={o.value === value}
            aria-disabled={o.disabled || undefined}
            tabIndex={o.value === focusable ? 0 : -1}
            className={variant === "chips" ? (small ? `${ui.chip} ${ui.chipSmall}` : ui.chip) : ui.segment}
            onClick={() => !o.disabled && onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className={ui.hint}>{hint}</p>}
    </div>
  );
}
