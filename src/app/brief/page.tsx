"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief, setBriefText } from "@/lib/brief";
import { bagLine } from "@/lib/gear";
import { db } from "@/lib/db";
import { MAX_BRIEF } from "@/lib/read";
import { readsLeft } from "@/lib/readClient";
import type { Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { useOnline } from "@/lib/useOnline";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "./Brief.module.css";

/** The brief saves on a pause in typing, not on every key. */
const PAUSE_MS = 600;

/** B0 (nothing written) and B1 (written): one project brief in v0. */
function BriefScreen() {
  const router = useRouter();
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  return <Editor key={project.id} project={project} onGenerate={() => router.push(`/brief/read?id=${project.id}`)} />;
}

function Editor({ project, onGenerate }: { project: Project; onGenerate: () => void }) {
  const [text, setText] = useState(projectBrief(project)?.text ?? "");
  const [copying, setCopying] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const [left, setLeft] = useState<{ available: boolean; remaining: number } | null>(null);
  const online = useOnline();
  // Asked again when signal comes back, so the screen never shows a stale "no signal".
  useEffect(() => {
    // A check that fails with signal reads as unavailable, not as "checking…" forever.
    readsLeft().then((l) => setLeft(l ?? { available: false, remaining: 0 }));
  }, [online]);
  const others = useLive(() => db.projects.toArray(), []);
  const pastBriefs = (others ?? []).filter((p) => p.id !== project.id && projectBrief(p)?.text.trim());

  // Save on a pause in typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const latest = await db.projects.get(project.id);
      if (latest && (projectBrief(latest)?.text ?? "") !== text) await saveProject(setBriefText(latest, text));
    }, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text, project.id]);

  const empty = text.trim().length === 0;
  // Generating is the read, and only the read (Rina, 23 Sep): no signal or no reads, no generating.
  const canRead = online && !!left?.available && left.remaining > 0;
  const why = !online
    ? "No signal. Generating reads your brief online — connect to generate."
    : left && !left.available
      ? "Generating isn't available right now."
      : left?.remaining === 0
        ? "No reads left today — they come back tomorrow."
        : undefined;
  const focus = (hint: string) => {
    setPlaceholder(hint);
    area.current?.focus();
  };
  const back = `/project?id=${project.id}`;

  return (
    <div className={ui.screen}>
      <StepHeader label="Brief" back={{ label: "← SHOT LIST", href: back }} />

      <div className={ui.body}>
        <div className={ui.field}>
          <label htmlFor="brief" className={ui.label}>
            WHAT ARE YOU SHOOTING?
          </label>
          <textarea
            id="brief"
            ref={area}
            className={`${ui.input} ${styles.brief}`}
            value={text}
            maxLength={MAX_BRIEF}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <p className={ui.hint}>A sentence or three paragraphs — both work. Say what has to be captured and what the day feels like.</p>
        </div>

        {empty ? (
          <>
            {/* Exactly three ways in, the first recommended (§7 Empty state). */}
            <ol className={styles.routes}>
              <li>
                <button type="button" className={styles.route} onClick={() => focus("Paste the client's email or brief here.")}>
                  <span className={styles.routeNo}>01</span>
                  <span className={styles.routeText}>
                    <span className={styles.routeTitle}>Paste what the client sent</span>
                    <span className={styles.routeLine}>Best results — their wording is where the deliverables are, and none of them get missed.</span>
                  </span>
                  <span aria-hidden="true" className={styles.chevron}>
                    ›
                  </span>
                </button>
              </li>
              <li>
                <button type="button" className={styles.route} onClick={() => focus("Wandering Higashiyama at sunrise, quiet.")}>
                  <span className={styles.routeNo}>02</span>
                  <span className={styles.routeText}>
                    <span className={styles.routeTitle}>Say it in one line</span>
                    <span className={styles.routeLine}>Where you&apos;ll be and what the light&apos;s doing is enough to work from.</span>
                  </span>
                  <span aria-hidden="true" className={styles.chevron}>
                    ›
                  </span>
                </button>
              </li>
              <li>
                {pastBriefs.length > 0 ? (
                  <button type="button" className={styles.route} onClick={() => setCopying(true)}>
                    <span className={styles.routeNo}>03</span>
                    <span className={styles.routeText}>
                      <span className={styles.routeTitle}>Copy a brief from a past project</span>
                      <span className={styles.routeLine}>A lot of shoots repeat themselves. Bring one over and edit what changed.</span>
                    </span>
                    <span aria-hidden="true" className={styles.chevron}>
                      ›
                    </span>
                  </button>
                ) : (
                  <div className={styles.route}>
                    <span className={styles.routeNo}>03</span>
                    <span className={styles.routeText}>
                      <span className={styles.routeTitleMuted}>Copy a brief from a past project</span>
                      <span className={styles.routeLine}>None of your other projects has a brief yet.</span>
                    </span>
                  </div>
                )}
              </li>
            </ol>
            <div className={styles.skip}>
              <p className={styles.skipText}>No brief? Add shots by hand instead.</p>
              <Link href={`/shot/new?id=${project.id}`} className={ui.textLink}>
                ADD A SHOT ›
              </Link>
            </div>
          </>
        ) : (
          canRead ? (
            <div className={ui.box}>
              <span className={ui.boxHeading}>READ ONCE</span>
              <p className={ui.boxText}>
                Your brief is read in full once, when you generate — not as you type. You&apos;ll see what it read before anything is built. Sent once to be read, not stored by this app.
              </p>
              <p className={ui.hint}>{left!.remaining === 1 ? "1 full read left today." : `${left!.remaining} full reads left today.`}</p>
            </div>
          ) : (
            why && (
              <div className={ui.box}>
                <span className={ui.boxHeadingWarn}>{!online ? "NO SIGNAL" : left?.remaining === 0 ? "NO READS LEFT TODAY" : "CAN'T GENERATE"}</span>
                <p className={ui.boxText}>
                  {why} Your brief is saved, and everything else works as usual — shots can be added by hand, and the list goes with you offline.
                </p>
              </div>
            )
          )
        )}

        {/* What generating will know about how you're shooting (Rina, 23 Sep). */}
        <Link href={`/project?id=${project.id}&tab=gear`} className={styles.gearLine}>
          <span className={ui.boxHeading}>GEAR</span>
          <span className={styles.gearText}>
            {project.gear.length ? bagLine(project.gear) : "NONE CHOSEN — SUGGESTIONS STAY GEAR-FREE"}
            {typeof project.frameRate === "number" ? ` · ${project.frameRate}FPS` : ""}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      <div className={ui.footer}>
        {empty ? (
          <>
            <p className={ui.hint} id="gen-why">
              Write something first, or skip above.
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="gen-why">
              GENERATE SHOTS
            </button>
          </>
        ) : !canRead ? (
          <>
            <p className={ui.hint} id="gen-why">
              {/* The box above says why in full; this is the button's short reason. */}
              {!online ? "Needs signal to generate." : left?.remaining === 0 ? "No reads left today." : (why ?? "Checking for reads…")}
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="gen-why">
              GENERATE SHOTS
            </button>
            <Link href={`/shot/new?id=${project.id}`} className={ui.secondary}>
              + ADD A SHOT BY HAND
            </Link>
          </>
        ) : (
          <button
            type="button"
            className={ui.primary}
            onClick={async () => {
              // Save now, rather than waiting for the pause.
              const latest = await db.projects.get(project.id);
              if (latest) await saveProject(setBriefText(latest, text));
              onGenerate();
            }}
          >
            GENERATE SHOTS
          </button>
        )}
      </div>

      {copying && (
        <BottomSheet title="COPY A BRIEF FROM" onClose={() => setCopying(false)}>
          <ul className={styles.sheetList}>
            {pastBriefs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.sheetRow}
                  onClick={() => {
                    setText(projectBrief(p)!.text);
                    setCopying(false);
                  }}
                >
                  <span className={styles.sheetTitle}>{p.name}</span>
                  <span className={ui.hint}>{projectBrief(p)!.text.slice(0, 80)}…</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}

export default function BriefPage() {
  return (
    <Suspense>
      <BriefScreen />
    </Suspense>
  );
}
