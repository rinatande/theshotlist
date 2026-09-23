"use client";

import { useState } from "react";
import consequences from "@/data/consequences.json";
import { budget } from "@/lib/budget";
import {
  ASPECTS,
  budgetLabel,
  comboLabel,
  DELIVERIES,
  GENRES,
  nearestPreset,
  structureLabel,
  TREATMENTS,
} from "@/lib/labels";
import type { DayChange, NewProjectInput } from "@/lib/project";
import { kitLine, STARTER_KITS } from "@/lib/gear";
import type { Aspect, Delivery, Format, FrameRate, GearItem, Genre, Kit, Project, Treatment } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { Choice } from "./Choice";
import styles from "./ProjectForm.module.css";
import { StepHeader } from "./StepHeader";
import ui from "./ui.module.css";

/** Everything the three steps collect. Kind and treatment start unpicked (§5.1). */
export interface Draft {
  name: string;
  genre?: Genre;
  treatment?: Treatment;
  delivery: Delivery;
  lengthSeconds?: number;
  aspect: Aspect;
  startDate: string;
  where: string;
  dayCount: number;
  /** Step 3 (v1, Rina 23 Sep). */
  frameRate?: FrameRate;
  /** A library kit's id, "starter:<id>" for a starter kit, or empty to decide later. */
  kit?: string;
}

export const EMPTY_DRAFT: Draft = {
  name: "",
  delivery: "reel",
  aspect: "9:16",
  startDate: "",
  where: "",
  dayCount: 1,
};

export function draftFromProject(p: Project): Draft {
  return {
    name: p.name,
    genre: p.format.genre,
    treatment: p.format.treatment,
    delivery: p.format.delivery,
    lengthSeconds: p.format.lengthSeconds,
    aspect: p.format.aspect,
    startDate: p.startDate ?? "",
    where: p.where ?? "",
    dayCount: p.dayCount,
    frameRate: p.frameRate,
    kit: p.kitId,
  };
}

function draftFormat(d: Draft): Format | undefined {
  if (!d.genre || !d.treatment) return undefined;
  return {
    genre: d.genre,
    treatment: d.treatment,
    delivery: d.delivery,
    lengthSeconds: d.delivery === "custom" ? d.lengthSeconds : undefined,
    aspect: d.aspect,
  };
}

export function draftInput(d: Draft): NewProjectInput | undefined {
  const format = draftFormat(d);
  if (!format) return undefined;
  return {
    name: d.name,
    format,
    startDate: d.startDate || undefined,
    dayCount: d.dayCount,
    where: d.where,
    frameRate: d.frameRate,
  };
}

interface Props {
  mode: "new" | "edit";
  step: 1 | 2 | 3;
  /** Step 3: the gear library's kits and items, to start the shoot from one. */
  kits?: Kit[];
  library?: GearItem[];
  /** Edit only: the project as saved, for its gear line. */
  project?: Project;
  draft: Draft;
  onDraft: (update: (d: Draft) => Draft) => void;
  /** Placeholder for the name: "18 Sep shoot". */
  defaultName: string;
  /** New project only: earlier projects to copy the format from. */
  pastProjects?: Project[];
  /** Edit only: what shortening the shoot would move. */
  dayChange?: DayChange | null;
  cancelHref: string;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function ProjectForm(props: Props) {
  return props.step === 1 ? <StepOne {...props} /> : props.step === 2 ? <StepTwo {...props} /> : <StepThree {...props} />;
}

// ─── Step 1: name, kind, treatment, who's on camera ──────────────────────────

function StepOne({ mode, draft, onDraft, defaultName, pastProjects, cancelHref, onNext }: Props) {
  const [copying, setCopying] = useState(false);
  const ready = !!draft.genre && !!draft.treatment;
  const set = (patch: Partial<Draft>) => onDraft((d) => ({ ...d, ...patch }));
  const firstEver = mode === "new" && pastProjects?.length === 0;

  return (
    <div className={ui.screen}>
      <StepHeader
        step={1}
        steps={3}
        label={mode === "new" ? "New project · 1/3" : "Edit project · 1/3"}
        back={{ label: "← CANCEL", href: cancelHref }}
      />

      <div className={ui.body}>
        <div className={ui.field}>
          <label htmlFor="pname" className={ui.label}>
            {mode === "new" ? "NAME" : "PROJECT NAME"}
          </label>
          <input
            id="pname"
            className={ui.input}
            type="text"
            value={draft.name}
            placeholder={defaultName}
            autoComplete="off"
            onChange={(e) => set({ name: e.target.value })}
          />
          {mode === "new" && (
            <p className={ui.hint}>Leave it and that&apos;s the name. Rename it whenever the shoot tells you what it is.</p>
          )}
          {mode === "new" && !firstEver && pastProjects && (
            <button type="button" className={ui.textLink} onClick={() => setCopying(true)}>
              FROM A PAST PROJECT ›
            </button>
          )}
        </div>

        <Choice
          label="What kind of video?"
          options={GENRES}
          value={draft.genre}
          onChange={(genre) => set({ genre })}
        />
        <Choice
          label="How are you telling it?"
          options={TREATMENTS}
          value={draft.treatment}
          onChange={(treatment) => set({ treatment })}
        />
        <Choice
          label="Who is on camera?"
          options={[
            { value: "me", label: "ME" },
            { value: "someone", label: "SOMEONE ELSE", disabled: true },
            { value: "no-one", label: "NO ONE", disabled: true },
          ]}
          value="me"
          onChange={() => {}}
          hint="Just you for now. Filming someone else, or no one at all, comes with the cast screen."
        />

        <Consequence genre={draft.genre} treatment={draft.treatment} />
      </div>

      <div className={ui.footer}>
        {ready ? (
          <button type="button" className={ui.primary} onClick={onNext}>
            NEXT — FORMAT
          </button>
        ) : (
          <>
            <p className={ui.hint} id="next-why">
              Pick a kind and a treatment.
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="next-why">
              NEXT — FORMAT
            </button>
          </>
        )}
      </div>

      {copying && pastProjects && (
        <BottomSheet title="COPY THE FORMAT FROM" onClose={() => setCopying(false)}>
          <ul className={styles.sheetList}>
            {pastProjects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.sheetRow}
                  onClick={() => {
                    // Format, aspect, frame rate and kit — never shots or the brief (§5.1).
                    set({
                      genre: p.format.genre,
                      treatment: p.format.treatment,
                      delivery: p.format.delivery,
                      lengthSeconds: p.format.lengthSeconds,
                      aspect: p.format.aspect,
                      // v1: how it was filmed and the kit it started from come too (§5.1 names the kit).
                      frameRate: p.frameRate,
                      kit: p.kitId,
                    });
                    setCopying(false);
                  }}
                >
                  <span className={styles.sheetRowTitle}>{p.name}</span>
                  <span className={ui.hint}>{comboLabel(p.format.genre, p.format.treatment)}</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}

function Consequence({ genre, treatment }: { genre?: Genre; treatment?: Treatment }) {
  if (!genre || !treatment) {
    // The box waits rather than vanishes (§5.1).
    return (
      <div className={ui.box} aria-live="polite">
        <span className={ui.boxHeading}>WHAT THIS SETS UP</span>
        <p className={ui.boxTextMuted}>
          Pick a kind and a treatment, and this says what they mean for your list — before you commit to them.
        </p>
      </div>
    );
  }
  const extra = (consequences.genre as Partial<Record<Genre, string>>)[genre];
  return (
    <div className={ui.box} aria-live="polite">
      <span className={ui.boxHeadingWarn}>{comboLabel(genre, treatment)}</span>
      <p className={ui.boxText}>
        {consequences.treatment[treatment]}
        {extra ? ` ${extra}` : ""}
      </p>
    </div>
  );
}

// ─── Step 2: length, aspect, what that sets up, when, where, days ────────────

const DAY_OPTIONS = ["1", "2", "3", "4", "5+"] as const;

function StepTwo({ mode, draft, onDraft, dayChange, onBack, onNext }: Props) {
  const set = (patch: Partial<Draft>) => onDraft((d) => ({ ...d, ...patch }));
  const format = draftFormat(draft)!;
  const b = budget(format);
  const dayChoice = draft.dayCount >= 5 ? "5+" : (String(draft.dayCount) as (typeof DAY_OPTIONS)[number]);

  return (
    <div className={ui.screen}>
      <StepHeader
        step={2}
        steps={3}
        label={mode === "new" ? "New project · 2/3" : "Edit project · 2/3"}
        back={{ label: "← BACK", onClick: onBack }}
      />

      <div className={ui.body}>
        <Choice
          label="How long is the finished video?"
          options={DELIVERIES}
          value={draft.delivery}
          onChange={(delivery) => set({ delivery, lengthSeconds: delivery === "custom" ? (draft.lengthSeconds ?? 90) : undefined })}
        />
        {draft.delivery === "custom" && (
          <div className={ui.field}>
            <label htmlFor="length" className={ui.label}>
              LENGTH IN SECONDS
            </label>
            <input
              id="length"
              className={ui.input}
              type="number"
              inputMode="numeric"
              min={1}
              max={7200}
              value={draft.lengthSeconds ?? ""}
              onChange={(e) => set({ lengthSeconds: clamp(Number(e.target.value), 1, 7200) || undefined })}
            />
          </div>
        )}

        <Choice
          label="Aspect"
          options={ASPECTS.map((a) => ({ value: a, label: a }))}
          value={draft.aspect}
          onChange={(aspect) => set({ aspect })}
        />

        <SetsUp format={format} budgetText={budgetLabel(b)} />

        <div className={ui.row}>
          <div className={ui.field} style={{ flex: "1 1 0", minWidth: "9.5em" }}>
            <label htmlFor="when" className={ui.label}>
              STARTS
            </label>
            <input
              id="when"
              className={ui.input}
              type="date"
              value={draft.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </div>
          <div className={ui.field} style={{ flex: "1 1 0" }}>
            <label htmlFor="where" className={ui.label}>
              WHERE
            </label>
            <input
              id="where"
              className={ui.input}
              type="text"
              value={draft.where}
              autoComplete="off"
              onChange={(e) => set({ where: e.target.value })}
            />
          </div>
        </div>

        <Choice
          label="How many days are you shooting?"
          options={DAY_OPTIONS.map((d) => ({ value: d, label: d }))}
          value={dayChoice}
          onChange={(d) => set({ dayCount: d === "5+" ? Math.max(5, draft.dayCount) : Number(d) })}
          hint="More than one and the list splits into days, and each location can sit on the day you'll shoot it. Change it later if the trip stretches."
        />
        {dayChoice === "5+" && (
          <div className={ui.field}>
            <label htmlFor="days" className={ui.label}>
              DAYS
            </label>
            <input
              id="days"
              className={ui.input}
              type="number"
              inputMode="numeric"
              min={5}
              max={30}
              value={draft.dayCount}
              onChange={(e) => set({ dayCount: clamp(Number(e.target.value), 5, 30) })}
            />
          </div>
        )}
      </div>

      <div className={ui.footer}>
        {dayChange && (
          <div className={ui.box} aria-live="polite">
            <span className={ui.boxHeadingWarn}>CHANGES</span>
            <p className={ui.boxText}>{dayChangeText(dayChange)}</p>
          </div>
        )}
        <button type="button" className={ui.primary} onClick={onNext}>
          NEXT — GEAR
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: frame rate and gear (v1, Rina 23 Sep) ───────────────────────────

const FRAME_RATES: { value: string; label: string }[] = [
  ...[24, 25, 30, 50, 60, 120].map((n) => ({ value: String(n), label: String(n) })),
  { value: "mixed", label: "MIXED" },
];

function frameRateHint(fr?: FrameRate): string {
  if (fr === undefined || fr === "mixed") return "Slow motion is suggested where your camera can shoot it.";
  if (fr <= 30) return "Real time throughout — no slow-motion shots suggested.";
  return "Slow motion's on the table — pours, splashes and walks can be slowed right down.";
}

/**
 * So the first GENERATE already knows how the shoot is filmed and what's in
 * the bag. Both can wait: nothing here is required.
 */
function StepThree({ mode, draft, onDraft, kits = [], library = [], project, onBack, onSubmit }: Props) {
  const set = (patch: Partial<Draft>) => onDraft((d) => ({ ...d, ...patch }));
  const starters = kits.length === 0;
  const kitOptions = starters
    ? STARTER_KITS.map((s) => ({ value: "starter:" + s.id, label: s.name.toUpperCase() }))
    : kits.map((k) => ({ value: k.id, label: k.name.toUpperCase() }));
  const chosenKit = kits.find((k) => k.id === draft.kit);
  const chosenStarter = STARTER_KITS.find((s) => "starter:" + s.id === draft.kit);
  const gearHint = chosenKit
    ? kitLine(chosenKit, library) + ". Add or leave out items on the GEAR tab."
    : chosenStarter
      ? chosenStarter.line + " It becomes your own gear, to rename on the GEAR tab."
      : starters
        ? "A starter kit becomes your own gear to edit — or set it up later from the GEAR tab. Suggestions work either way."
        : "Pick a kit and the first suggestions fit what you're bringing. You can change it on the GEAR tab.";
  const count = project?.gear.length ?? 0;

  return (
    <div className={ui.screen}>
      <StepHeader step={3} steps={3} label={mode === "new" ? "New project · 3/3" : "Edit project · 3/3"} back={{ label: "← BACK", onClick: onBack }} />

      <div className={ui.body}>
        <Choice
          label="What frame rate are you shooting?"
          options={FRAME_RATES}
          value={draft.frameRate === undefined ? undefined : String(draft.frameRate)}
          onChange={(v) => {
            const fr: FrameRate = v === "mixed" ? "mixed" : (Number(v) as FrameRate);
            set({ frameRate: draft.frameRate === fr ? undefined : fr });
          }}
          hint={frameRateHint(draft.frameRate)}
        />

        {mode === "new" ? (
          <Choice label="What are you bringing?" options={[...kitOptions, { value: "", label: "DECIDE LATER" }]} value={draft.kit ?? ""} onChange={(kit) => set({ kit })} hint={gearHint} />
        ) : (
          <div className={ui.box}>
            <span className={ui.boxHeading}>GEAR</span>
            <p className={ui.boxText}>
              {count ? count + (count === 1 ? " item" : " items") + " for this shoot. Change what's coming on the GEAR tab." : "Nothing chosen for this shoot yet. Pick it on the GEAR tab."}
            </p>
          </div>
        )}
      </div>

      <div className={ui.footer}>
        <button type="button" className={ui.primary} onClick={onSubmit}>
          {mode === "new" ? "CREATE PROJECT" : "SAVE"}
        </button>
      </div>
    </div>
  );
}

function SetsUp({ format, budgetText }: { format: Format; budgetText: string }) {
  const preset = nearestPreset(format);
  const sentence =
    format.delivery === "custom"
      ? consequences.delivery.custom.replace("{length}", customLength(format.lengthSeconds ?? 60))
      : consequences.delivery[preset];
  return (
    <div className={styles.setsUp} aria-live="polite">
      <div className={styles.setsUpHead}>WHAT THAT SETS UP</div>
      <div className={styles.setsUpRow}>
        <span className={ui.muted}>SHOT BUDGET</span>
        <strong>{budgetText}</strong>
      </div>
      <div className={styles.setsUpRow}>
        <span className={ui.muted}>STRUCTURE</span>
        <strong>{structureLabel(format)}</strong>
      </div>
      <p className={styles.setsUpText}>
        {sentence} {consequences.deliveryTail}
      </p>
    </div>
  );
}

/** "Going from 3 days to 2: day 3's 4 shots move to day 2. …" (§5.14) */
export function dayChangeText(c: DayChange): string {
  const days =
    c.removed.length === 1
      ? `day ${c.removed[0]}'s`
      : `days ${c.removed.slice(0, -1).join(", ")} and ${c.removed[c.removed.length - 1]}'s`;
  const shots = c.shotCount === 1 ? "1 shot moves" : `${c.shotCount} shots move`;
  return `Going from ${c.from} days to ${c.to}: ${days} ${shots} to day ${c.to}. Nothing is deleted — you can move them again from the list.`;
}

function customLength(seconds: number): string {
  if (seconds < 120) return `${seconds}-second`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}-minute`;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

