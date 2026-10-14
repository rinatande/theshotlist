"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { MOODBOARD_PRIVACY } from "@/lib/read";
import { db } from "@/lib/db";
import { addRefs, makeNote, updateRef } from "@/lib/look";
import type { NoteRef, NoteTag } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "../Look.module.css";

const TAGS: NoteTag[] = ["mood", "grade", "pace", "sound"];

/** L6 Note: the look in your own words, tagged so it reads at a glance on the board (§5.16). */
function NoteScreen() {
  const router = useRouter();
  const { project, params } = useProject();
  const [text, setText] = useState<string | null>(null);
  const [tags, setTags] = useState<NoteTag[] | null>(null);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  const editing = project.refs?.find((r): r is NoteRef => r.id === params.get("ref") && r.kind === "note");
  const body = text ?? editing?.text ?? "";
  const on = tags ?? editing?.tags ?? [];
  const look = `/project?id=${project.id}&tab=look`;
  const back = editing ? `/look/ref?id=${project.id}&ref=${editing.id}` : look;

  const save = async () => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(editing ? updateRef(latest, editing.id, { text: body.trim(), tags: on }) : addRefs(latest, [makeNote(body, on, new Date(), crypto.randomUUID())]));
    router.replace(back);
  };

  return (
    <div className={ui.screen}>
      <StepHeader label="Note" back={{ label: editing ? "← REF" : "← MOODBOARD", href: back }} />
      <div className={ui.body}>
        <div className={ui.field}>
          <label htmlFor="note" className={ui.label}>
            THE FEEL, IN YOUR WORDS
          </label>
          <textarea
            id="note"
            className={`${ui.input} ${styles.textarea}`}
            rows={5}
            value={body}
            placeholder="Slow, soft and quiet. Warm grade with soft highlights."
            onChange={(e) => setText(e.target.value)}
            aria-describedby="note-read"
          />
          {/* Notes go with the brief when you generate; nothing else on the moodboard does (§5.16). */}
          <p id="note-read" className={ui.hint}>
            {MOODBOARD_PRIVACY}
          </p>
        </div>
        <div className={ui.fieldset}>
          <span id="about" className={ui.label}>
            ABOUT · OPTIONAL
          </span>
          <div role="group" aria-labelledby="about" className={ui.chips}>
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                role="checkbox"
                aria-checked={on.includes(t)}
                className={ui.chip}
                onClick={() => setTags(on.includes(t) ? on.filter((x) => x !== t) : [...on, t])}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <p className={ui.hint}>Shows above the note on the board, so you can tell a grade note from a sound note at a glance.</p>
        </div>
      </div>
      <div className={ui.footer}>
        {body.trim() ? (
          <button type="button" className={ui.primary} onClick={save}>
            SAVE NOTE
          </button>
        ) : (
          <>
            <p className={ui.hint} id="note-why">
              Write the note first.
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="note-why">
              SAVE NOTE
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NotePage() {
  return (
    <Suspense>
      <NoteScreen />
    </Suspense>
  );
}
