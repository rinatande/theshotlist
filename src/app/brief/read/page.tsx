"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { projectBrief, setQuoted } from "@/lib/brief";
import { matchChips } from "@/lib/chips";
import type { Project } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "../Brief.module.css";
import read from "./Read.module.css";

/**
 * B9 What it read — the offline version: quoted chips only, because the
 * full read (inferred chips, deliverables) is M6 (§5.6). Nothing is built
 * until the person has seen what it took from their words.
 */
function WhatItRead() {
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  return <Review key={project.id} project={project} />;
}

function Review({ project }: { project: Project }) {
  const router = useRouter();
  const text = projectBrief(project)?.text ?? "";
  const chips = matchChips(text);
  const [dropped, setDropped] = useState<Set<string>>(() => {
    // Chips dropped last time stay dropped, as long as the words are still there.
    const kept = projectBrief(project)?.extraction?.quoted.map((c) => c.label);
    return new Set(kept ? chips.map((c) => c.label).filter((l) => !kept.includes(l)) : []);
  });
  const toggle = (label: string) =>
    setDropped((d) => {
      const next = new Set(d);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <div className={ui.screen}>
      <StepHeader label="What it read" back={{ label: "← EDIT BRIEF", href: `/brief?id=${project.id}` }} />

      <div className={ui.body}>
        <p className={read.lead}>
          Here&apos;s what it matched in your brief. Drop anything wrong before it builds the list — a misread here becomes a wrong shot on the day.
        </p>

        <div className={styles.matched}>
          <span className={ui.boxHeading}>FROM YOUR WORDS</span>
          {chips.length > 0 ? (
            <>
              <ul className={styles.chips}>
                {chips.map((c) => {
                  const off = dropped.has(c.label);
                  return (
                    <li key={c.label}>
                      <button
                        type="button"
                        className={off ? `${read.chip} ${read.dropped}` : read.chip}
                        aria-pressed={!off}
                        aria-label={off ? `${c.label}, dropped. Tap to keep it.` : `${c.label}. Tap to drop it.`}
                        onClick={() => toggle(c.label)}
                      >
                        {c.label}
                        <span aria-hidden="true" className={read.x}>
                          {off ? "+" : "✕"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className={ui.hint}>Tap one to drop it. Dropped words don&apos;t steer the list.</p>
            </>
          ) : (
            <p className={ui.boxTextMuted}>Nothing matched — the list will build from your format and length instead.</p>
          )}
        </div>

        <div className={ui.box}>
          <span className={ui.boxHeading}>ON THIS PHONE</span>
          <p className={ui.boxText}>
            Matched here, free and offline, from your words only. Picking out a client&apos;s deliverables needs the fuller read, which comes later.
          </p>
        </div>
      </div>

      <div className={ui.footer}>
        <button
          type="button"
          className={ui.primary}
          onClick={async () => {
            await saveProject(setQuoted(project, chips.filter((c) => !dropped.has(c.label))));
            router.push(`/suggest?id=${project.id}&from=brief`);
          }}
        >
          BUILD THE LIST
        </button>
      </div>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense>
      <WhatItRead />
    </Suspense>
  );
}
