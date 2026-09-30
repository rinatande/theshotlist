"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { leadCounts, memberFor, PRESENCES, presenceLine, removeSupporting, updateMember, YOU } from "@/lib/cast";
import { useProject } from "@/lib/useProject";
import styles from "../Cast.module.css";
import { saveCast } from "../castNav";

/**
 * B5 On camera (§5.8): how much of the video one person is in — a radio, one
 * level per person for the whole project — and whether they speak on camera.
 * You're here too: as the lead on a self-shoot, or behind the camera.
 */
function OnCamera() {
  const router = useRouter();
  const { project, params } = useProject();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  const found = project && memberFor(project.cast, params.get("who") ?? "");
  if (!project || !found) return <NotHere href={project ? `/cast?id=${project.id}` : "/projects"} label="← CAST" />;

  const from = params.get("from");
  const cast = `/cast?id=${project.id}${from ? `&from=${from}` : ""}`;
  const { member, kind } = found;
  const you = member.id === YOU;
  const display = you ? "YOU" : (member.name || "Someone").toUpperCase();
  const what = kind === "lead" ? `LEAD · ${project.name.toUpperCase()}` : kind === "operator" ? "BEHIND THE CAMERA" : member.role?.toUpperCase() ?? "ALSO IN IT";
  const question = you ? "HOW MUCH OF THE VIDEO IS YOU?" : `HOW MUCH IS ${display} IN IT?`;
  const save = (patch: Parameters<typeof updateMember>[2]) => saveCast(project, (c) => updateMember(c, member.id, patch));

  return (
    <div className={ui.screen}>
      <StepHeader label="On camera" back={{ label: "← CAST", href: cast }} />

      <div className={ui.flush}>
        <div className={styles.whoRow}>
          <span className={styles.whoName}>{display}</span>
          <span className={styles.whoWhat}>{what}</span>
        </div>

        {kind === "supporting" && (
          <div className={styles.section}>
            <div className={ui.field}>
              <label htmlFor="name" className={ui.label}>
                NAME
              </label>
              <input
                id="name"
                className={ui.input}
                type="text"
                value={name ?? member.name}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name !== null && name.trim() && save({ name: name.trim() })}
              />
            </div>
            <div className={ui.field}>
              <label htmlFor="role" className={ui.label}>
                ROLE · OPTIONAL
              </label>
              <input
                id="role"
                className={ui.input}
                type="text"
                value={role ?? member.role ?? ""}
                autoComplete="off"
                onChange={(e) => setRole(e.target.value)}
                onBlur={() => role !== null && save({ role: role.trim() || undefined })}
              />
            </div>
          </div>
        )}

        <h2 className={styles.band} id="presence">
          <span>{question}</span>
          <span>PICK ONE</span>
        </h2>
        <div role="radiogroup" aria-labelledby="presence">
          {PRESENCES.map((p) => {
            const on = member.presence === p.value;
            return (
              <button key={p.value} type="button" role="radio" aria-checked={on} className={styles.radio} onClick={() => save({ presence: p.value })}>
                <span className={on ? styles.markOn : styles.mark} aria-hidden="true">
                  {on ? "(•)" : "( )"}
                </span>
                <span className={styles.radioText}>
                  <span className={on ? styles.radioLabelOn : styles.radioLabel}>{p.label}</span>
                  <span className={styles.radioLine}>{presenceLine(p.value, you ? undefined : member.name || "They")}</span>
                </span>
              </button>
            );
          })}
        </div>

        {kind === "lead" && (
          <p className={styles.line}>
            <span className={styles.lineHead}>ON THE LIST</span>
            Shots with {you ? "you" : member.name || "them"} in them count as <span className={styles.strong}>{display} {leadCounts(project).find((l) => l.name === display)?.count ?? 0}</span> beside the budget, so the balance is
            checkable without counting rows.
          </p>
        )}
        <p className={styles.line}>
          <span className={styles.lineHead}>SCOPE</span>
          One level per person, set once for the whole project.
        </p>

        {kind !== "operator" && (
          <>
            <h2 className={styles.band}>VOICE</h2>
            <button type="button" role="switch" aria-checked={member.voice} className={styles.switch} onClick={() => save({ voice: !member.voice })}>
              <span className={styles.switchRow}>
                <span className={styles.switchLabel}>{you ? "My voice on camera" : `${member.name || "Their"}${member.name ? "'s" : ""} voice on camera`}</span>
                <span className={member.voice ? styles.on : styles.off}>{member.voice ? "ALLOWED" : "OFF"}</span>
              </span>
              <span className={styles.switchHint}>
                {member.voice ? "Turn it off and nothing they say is recorded on camera — faceless with narration still works." : "Nothing they say is planned on camera."}
              </span>
            </button>
          </>
        )}

        {kind === "supporting" && (
          <div className={styles.remove}>
            <button
              type="button"
              className={ui.destructive + " " + ui.primary}
              onClick={async () => {
                router.replace(cast);
                await saveCast(project, (c) => removeSupporting(c, member.id));
              }}
            >
              REMOVE {display}
            </button>
          </div>
        )}
      </div>

      <div className={ui.footer}>
        <button type="button" className={ui.primary} onClick={() => router.push(cast)}>
          DONE
        </button>
      </div>
    </div>
  );
}

export default function OnCameraPage() {
  return (
    <Suspense>
      <OnCamera />
    </Suspense>
  );
}
