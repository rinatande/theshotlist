"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief, setBriefText } from "@/lib/brief";
import { matchChips, type QuotedChip } from "@/lib/chips";
import { db } from "@/lib/db";
import type { Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "./Brief.module.css";

/** Matching waits for a pause in typing — never per keystroke (§5.6). */
const PAUSE_MS = 600;

/** B0 (nothing written) and B1 (written): one project brief in v0. */
function BriefScreen() {
  const router = useRouter();
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  return <Editor key={project.id} project={project} onGenerate={() => router.push(`/brief/read?id=${project.id}`)} />;
}

function Editor({ project, onGenerate }: { project: Project; onGenerate: () => void }) {
  const [text, setText] = useState(projectBrief(project)?.text ?? "");
  const [chips, setChips] = useState<QuotedChip[]>(() => matchChips(text));
  const [copying, setCopying] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const others = useLive(() => db.projects.toArray(), []);
  const pastBriefs = (others ?? []).filter((p) => p.id !== project.id && projectBrief(p)?.text.trim());

  // Match and save on a pause in typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(async () => {
      setChips(matchChips(text));
      const latest = await db.projects.get(project.id);
      if (latest && (projectBrief(latest)?.text ?? "") !== text) await saveProject(setBriefText(latest, text));
    }, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text, project.id]);

  const empty = text.trim().length === 0;
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
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <p className={ui.hint}>A sentence or three paragraphs — both work. Say what has to be captured and what the day feels like.</p>
        </div>

        <div className={styles.matched} aria-live="polite">
          <span className={ui.boxHeading}>MATCHED AS YOU TYPE</span>
          {chips.length > 0 ? (
            <ul className={styles.chips}>
              {chips.map((c) => (
                <li key={c.label} className={styles.chip}>
                  {c.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className={ui.boxTextMuted}>
              Nothing yet. A place, a time of day or a client name will show up here as you write — matched on the device, before anything is sent anywhere.
            </p>
          )}
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
              <p className={styles.skipText}>No brief? The list still builds from your format — blunter, but it works.</p>
              <Link href={`/suggest?id=${project.id}`} className={ui.textLink}>
                SKIP ›
              </Link>
            </div>
          </>
        ) : (
          <div className={ui.box}>
            <span className={ui.boxHeading}>ON THIS PHONE</span>
            <p className={ui.boxText}>Matched here, free and offline. A fuller read that picks out client deliverables comes later.</p>
          </div>
        )}
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
