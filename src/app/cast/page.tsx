"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Choice } from "@/components/Choice";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { addSupporting, castConflict, leadOf, presenceLabel, setLead, YOU } from "@/lib/cast";
import type { LeadKind, Project } from "@/lib/types";
import { useProject } from "@/lib/useProject";
import { castBack, saveCast } from "./castNav";
import styles from "./Cast.module.css";

/**
 * B7 Cast (§5.8): who the video is about, who else is in it, and you behind
 * the camera. Each person opens On camera (B5). DONE goes back — through the
 * conflict screen (B6) first when the treatment needs someone on screen and
 * nobody is.
 */
function CastScreen() {
  const router = useRouter();
  const { project, params } = useProject();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState<string | null>(null);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;

  const from = params.get("from");
  const back = castBack(project, from);
  const cast = project.cast;
  const lead = leadOf(cast);
  const person = (id: string) => `/cast/person?id=${project.id}&who=${id}${from ? `&from=${from}` : ""}`;
  const leadName = name ?? (cast.lead === "someone" ? (lead?.name ?? "") : "");

  const done = async () => {
    if (cast.lead === "someone" && name !== null && name.trim()) await saveCast(project, (c) => setLead(c, "someone", name));
    router.push(castConflict(project.format.treatment, cast) ? `/cast/conflict?id=${project.id}${from ? `&from=${from}` : ""}` : back.href);
  };

  return (
    <div className={ui.screen}>
      <StepHeader label="Cast" back={back} />

      <div className={ui.flush}>
        <h2 className={styles.band}>WHO IS THIS VIDEO ABOUT?</h2>
        <div className={styles.section}>
          <Choice
            label="Who the video is about"
            hideLabel
            variant="segmented"
            options={[
              { value: "me", label: "ME" },
              { value: "someone", label: "SOMEONE ELSE" },
              { value: "no-one", label: "NO ONE" },
            ]}
            value={cast.lead}
            onChange={(l: LeadKind) => {
              setName(null);
              void saveCast(project, (c) => setLead(c, l, l === "someone" ? "" : undefined));
            }}
          />
          {cast.lead === "someone" && (
            <>
              <div className={ui.field}>
                <label htmlFor="lead" className={ui.label}>
                  THEIR NAME
                </label>
                <input
                  id="lead"
                  className={ui.input}
                  type="text"
                  value={leadName}
                  autoComplete="off"
                  placeholder="Priya"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name !== null && name.trim() && saveCast(project, (c) => setLead(c, "someone", name))}
                />
              </div>
              <p className={ui.hint}>Shots will use the name — &quot;Priya to camera&quot;, &quot;Priya&apos;s hands on the dough&quot; — so the list reads like something you could hand to an assistant.</p>
            </>
          )}
          {cast.lead === "no-one" && <p className={ui.hint}>No human subject: the product, food, place or architecture carries every shot.</p>}
        </div>

        {lead && (
          <Link href={person(lead.id)} className={styles.person}>
            <span className={styles.who}>
              <span className={styles.name}>{lead.id === YOU ? "You" : lead.name || "Someone"}</span>
              <span className={styles.what}>LEAD</span>
            </span>
            <span className={styles.levelLead}>{presenceLabel(lead.presence).toUpperCase()} ›</span>
          </Link>
        )}

        <h2 className={styles.band}>
          <span>ALSO IN IT</span>
          <span>{String(cast.supporting.length).padStart(2, "0")}</span>
        </h2>
        <ul className={styles.list}>
          {cast.supporting.map((m) => (
            <li key={m.id}>
              <Link href={person(m.id)} className={styles.person}>
                <span className={styles.who}>
                  <span className={styles.name}>{m.name}</span>
                  {m.role && <span className={styles.what}>{m.role.toUpperCase()}</span>}
                </span>
                <span className={styles.level}>{presenceLabel(m.presence).toUpperCase()} ›</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <button type="button" className={ui.secondary} onClick={() => setAdding(true)}>
            + ADD SOMEONE
          </button>
        </div>

        {cast.lead !== "me" && (
          <>
            <h2 className={styles.band}>BEHIND THE CAMERA</h2>
            <Link href={person(YOU)} className={styles.person}>
              <span className={styles.name}>You</span>
              <span className={styles.level}>{presenceLabel(cast.operatorPresence).toUpperCase()} ›</span>
            </Link>
            {cast.lead === "someone" && (
              <p className={styles.line}>
                <span className={styles.lineHead}>NOTE</span>
                You&apos;re off camera by default when the video is about someone else. Raise it if you want a two-shot, an over-shoulder with you in it, or an
                intro of your own.
              </p>
            )}
          </>
        )}

        {/* Project-wide, so here rather than on one person's screen (Rina, 30 Sep). */}
        <h2 className={styles.band}>LOCATION</h2>
        <button
          type="button"
          role="switch"
          aria-checked={cast.flagDetails !== false}
          className={styles.switch}
          onClick={() => saveCast(project, (c) => ({ ...c, flagDetails: c.flagDetails === false ? undefined : false }))}
        >
          <span className={styles.switchRow}>
            <span className={styles.switchLabel}>Flag identifying details</span>
            <span className={cast.flagDetails !== false ? styles.on : styles.off}>{cast.flagDetails !== false ? "ON" : "OFF"}</span>
          </span>
          <span className={styles.switchHint}>The read keeps street signs, house numbers, station names and a recognisable home out of shot, or says so in the reason line.</span>
        </button>
      </div>

      <div className={ui.footer}>
        <button type="button" className={ui.primary} onClick={done}>
          DONE
        </button>
      </div>

      {adding && <AddSomeone project={project} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddSomeone({ project, onClose }: { project: Project; onClose: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  return (
    <BottomSheet title="ADD SOMEONE" onClose={onClose}>
      <div className={styles.sheetBody}>
        <div className={ui.field}>
          <label htmlFor="who-name" className={ui.label}>
            NAME
          </label>
          <input id="who-name" className={ui.input} type="text" value={name} autoComplete="off" placeholder="Mei" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={ui.field}>
          <label htmlFor="who-role" className={ui.label}>
            ROLE · OPTIONAL
          </label>
          <input id="who-role" className={ui.input} type="text" value={role} autoComplete="off" placeholder="sous chef" onChange={(e) => setRole(e.target.value)} />
        </div>
        <p className={ui.hint}>They start at part of it. Tap them after to change how much.</p>
        {name.trim() ? (
          <button
            type="button"
            className={ui.primary}
            onClick={async () => {
              await saveCast(project, (c) => addSupporting(c, name, role)[0]);
              onClose();
            }}
          >
            ADD {name.trim().toUpperCase()}
          </button>
        ) : (
          <button type="button" className={ui.disabled} aria-disabled="true">
            ADD
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

export default function CastPage() {
  return (
    <Suspense>
      <CastScreen />
    </Suspense>
  );
}
