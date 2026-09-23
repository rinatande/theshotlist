"use client";

import Link from "next/link";
import { useState } from "react";
import { lensChips, supportChips } from "@/lib/gear";
import { runningOrder } from "@/lib/runningOrder";
import { coverageGap, findDuplicate, numberIfAdded, type ShotInput } from "@/lib/shots";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { AUDIO, MOVEMENTS, suggestAudio, suggestMovement, SUPPORTS } from "@/lib/suggest";
import type { Audio, Movement, Project, Shot, ShotSize } from "@/lib/types";
import { Choice } from "./Choice";
import styles from "./ShotForm.module.css";
import { StepHeader } from "./StepHeader";
import ui from "./ui.module.css";

const SIZES: ShotSize[] = ["WS", "MS", "CU", "OTS", "INS"];
const TYPED = "__typed";

interface Props {
  project: Project;
  /** Editing this shot; absent when adding. */
  shot?: Shot;
  initial: ShotInput;
  cancelHref: string;
  onSubmit: (input: ShotInput) => void;
  onClearFlag?: () => void;
}

/**
 * Add shot (S4) and edit shot (S6): the same screen, field for field (§5.13).
 * Duplicate and delete live on shot detail, not here.
 * Movement and audio are filled in by the app and follow the other fields
 * until the person picks one themselves.
 */
export function ShotForm({ project, shot, initial, cancelHref, onSubmit, onClearFlag }: Props) {
  const [draft, setDraft] = useState<ShotInput>(initial);
  // Once touched, a suggestion stops following the other fields. Editing an existing shot starts touched.
  const [ownMovement, setOwnMovement] = useState(!!shot?.movement);
  const [ownAudio, setOwnAudio] = useState(!!shot?.audio);

  const movement: Movement = ownMovement && draft.movement ? draft.movement : suggestMovement(draft);
  const audio: Audio = ownAudio && draft.audio ? draft.audio : suggestAudio(draft, project.format.treatment);
  const set = (patch: Partial<ShotInput>) => setDraft((d) => ({ ...d, ...patch }));
  const final: ShotInput = { ...draft, movement, audio };

  const editing = !!shot;
  const n = editing ? shotNumbers(project).get(shot.id) : numberIfAdded(project, final);
  const label = `${editing ? "Edit shot" : "New shot"}${n !== undefined ? ` · ${formatShotNumber(n)}` : ""}`;
  const ready = draft.subject.trim().length > 0;

  // Gear chips (§6.4) once this shoot has gear; typed lens and fixed supports before that.
  const lenses = lensChips(project.gear);
  const typedLens = draft.lens && !draft.lensId ? draft.lens : undefined;
  const supports = project.gear.length ? supportChips(project.gear) : undefined;

  const multi = project.days.length > 1;
  const locations = runningOrder(project);
  const dayIndex = (dayId?: string) => project.days.find((d) => d.id === dayId)?.index;
  const locationOptions = [
    ...locations.map((l) => ({
      value: l.id,
      label: multi ? `D${dayIndex(l.dayId) ?? "?"} · ${l.name.toUpperCase()}` : l.name.toUpperCase(),
    })),
    { value: "", label: "NO LOCATION" },
  ];

  const duplicate = findDuplicate(project, final, shot?.id);
  // Called out as you type (§8), so only once there's a subject.
  const gap = draft.subject.trim() ? coverageGap(project, draft.size, draft.locationId, shot?.id) : undefined;
  const locationName = locations.find((l) => l.id === draft.locationId)?.name;
  const dupNumber = duplicate ? shotNumbers(project).get(duplicate.id) : undefined;

  return (
    <div className={ui.screen}>
      <StepHeader label={label} back={{ label: "← CANCEL", href: cancelHref }} />

      <div className={ui.body}>
        <Choice label="Shot size" variant="segmented" options={SIZES.map((s) => ({ value: s, label: s }))} value={draft.size} onChange={(size) => set({ size })} />

        <div className={ui.field}>
          <label htmlFor="subject" className={ui.label}>
            SUBJECT
          </label>
          <input
            id="subject"
            className={`${ui.input} ${styles.subject}`}
            type="text"
            value={draft.subject}
            autoComplete="off"
            placeholder="Hands on the rope"
            onChange={(e) => set({ subject: e.target.value })}
          />
        </div>

        {lenses.length > 0 ? (
          // §6.4: chips from this shoot's gear, so the spec stays honest. A lens typed before gear stays as its own chip.
          <div className={styles.gearField}>
            <Choice
              label="Lens"
              options={[...lenses.map((l) => ({ value: l.id, label: l.label })), ...(typedLens ? [{ value: TYPED, label: typedLens.toUpperCase() }] : [])]}
              value={draft.lensId ?? (typedLens ? TYPED : undefined)}
              onChange={(id) => {
                if (id === TYPED) return;
                const l = lenses.find((x) => x.id === id)!;
                set(draft.lensId === id ? { lensId: undefined, lens: undefined } : { lensId: id, lens: l.lens });
              }}
            />
            <Link href={`/gear/shoot?id=${project.id}`} className={styles.gearLink}>
              FROM THIS SHOOT&apos;S GEAR ›
            </Link>
          </div>
        ) : (
          <div className={ui.field}>
            <label htmlFor="lens" className={ui.label}>
              LENS · OPTIONAL
            </label>
            <input id="lens" className={ui.input} type="text" value={draft.lens ?? ""} autoComplete="off" placeholder="e.g. 35mm" onChange={(e) => set({ lens: e.target.value, lensId: undefined })} />
            <p className={ui.hint}>
              {project.gear.length ? "No lens in this shoot's gear — type it, or add one to the shoot." : "Typed for now. Choose this shoot's gear and it picks from what you're bringing."}
            </p>
          </div>
        )}

        {supports ? (
          <Choice
            label="Support"
            options={supports.map((s) => ({ value: s.id, label: s.label }))}
            value={draft.supportId ?? (draft.support === "handheld" ? "handheld" : undefined)}
            onChange={(id) => {
              const s = supports.find((x) => x.id === id)!;
              const same = (draft.supportId ?? draft.support) === id;
              set(same ? { support: undefined, supportId: undefined } : { support: s.support, supportId: id === "handheld" ? undefined : id });
            }}
          />
        ) : (
          <Choice label="Support" options={SUPPORTS} value={draft.support} onChange={(support) => set({ support: draft.support === support ? undefined : support })} />
        )}

        <Choice
          label={ownMovement ? "Movement" : "Movement · suggested"}
          options={MOVEMENTS}
          value={movement}
          onChange={(m) => {
            setOwnMovement(true);
            set({ movement: m });
          }}
          hint={ownMovement ? undefined : "Worked out from the size, support and subject. Pick another to change it."}
        />

        <Choice
          label={ownAudio ? "Sound" : "Sound · suggested"}
          options={AUDIO}
          value={audio}
          onChange={(a) => {
            setOwnAudio(true);
            set({ audio: a });
          }}
          hint={AUDIO.find((a) => a.value === audio)!.hint}
        />

        {locations.length > 0 && (
          <Choice label="Location" options={locationOptions} value={draft.locationId ?? ""} onChange={(v) => set({ locationId: v || undefined })} />
        )}
        {multi && !draft.locationId && (
          <Choice
            label="On which day"
            options={project.days.map((d) => ({ value: d.id, label: `DAY ${d.index}` }))}
            value={draft.dayId ?? project.days[0]?.id}
            onChange={(dayId) => set({ dayId })}
          />
        )}

        <div className={ui.field}>
          <label htmlFor="note" className={ui.label}>
            NOTE
          </label>
          <textarea id="note" className={`${ui.input} ${styles.note}`} value={draft.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
        </div>

        {(duplicate || (gap && locationName)) && (
          // The one place the app talks to you rather than listing (§7 Suggestion block).
          <div className={styles.suggestion} aria-live="polite">
            <span className={ui.boxHeadingWarn}>SUGGESTED</span>
            {duplicate ? (
              <p className={ui.boxText}>
                This matches shot {dupNumber !== undefined ? formatShotNumber(dupNumber) : "already on the list"}. Fine for a second take — otherwise, change
                something so they&apos;re different.
              </p>
            ) : (
              <p className={ui.boxText}>
                You have no {gap} at {locationName} yet.
              </p>
            )}
          </div>
        )}

        {editing && shot.flagNote && shot.status !== "exposed" && (
          <div className={styles.actions}>
            <button type="button" className={styles.actionRow} onClick={onClearFlag}>
              <span className={styles.actionTitleWarn}>! {shot.flagNote.toUpperCase()}</span>
              <span className={styles.actionHint}>Clear the flag. The shot goes back to not shot.</span>
            </button>
          </div>
        )}
      </div>

      <div className={ui.footer}>
        {ready ? (
          <button type="button" className={ui.primary} onClick={() => onSubmit(final)}>
            {editing ? "SAVE" : "ADD TO LIST"}
          </button>
        ) : (
          <>
            <p className={ui.hint} id="add-why">
              Say what the shot is.
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="add-why">
              {editing ? "SAVE" : "ADD TO LIST"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
