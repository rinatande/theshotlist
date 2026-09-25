"use client";

import Link from "next/link";
import { Suspense } from "react";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { currentRead } from "@/lib/readClient";
import { useProject } from "@/lib/useProject";
import { ReadList } from "./ReadList";

/**
 * B2 / B10: the shots a read found, to add. Suggestions only ever come from
 * reading the brief — the phone's own template list was too generic to use
 * (Rina, 23 Sep).
 */
function Suggestions() {
  const { project } = useProject();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/projects" label="← PROJECTS" />;
  if (currentRead(project)) return <ReadList key={project.id} project={project} />;
  return (
    <div className={ui.screen}>
      <StepHeader label="Suggested" back={{ label: "← SHOT LIST", href: `/project?id=${project.id}` }} />
      <div className={ui.body}>
        <p className={ui.boxText}>Nothing to add yet. Shots are suggested by reading your brief — write it, then generate.</p>
        <Link href={`/brief?id=${project.id}`} className={ui.primary}>
          WRITE THE BRIEF
        </Link>
      </div>
    </div>
  );
}

export default function SuggestPage() {
  return (
    <Suspense>
      <Suggestions />
    </Suspense>
  );
}
