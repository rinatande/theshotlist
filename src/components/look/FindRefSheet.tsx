"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { hashtag, queryFor, searchUrl, setRefQuery, SITES, startSearch, waitingSearch } from "@/lib/findRef";
import type { Project, Shot } from "@/lib/types";
import { useOnline } from "@/lib/useOnline";
import { saveProject } from "@/lib/useProject";
import { sharesIn, usePhotoPicker } from "./LookTab";
import styles from "./FindRefSheet.module.css";

const store = () => window.localStorage;

/**
 * S3k Find a ref (§5.17): a phrase made from the shot and the look, and
 * three places to search for it. Tapping one leaves a search waiting, so the
 * screenshot you come back with is ready to pin to this shot. Nothing is
 * fetched here — the rows are only links.
 */
export function FindRefSheet({ project, shot, shotNo, onClose }: { project: Project; shot: Shot; shotNo?: string; onClose: () => void }) {
  const online = useOnline();
  const [query, setQuery] = useState(() => queryFor(project, shot));
  const [waiting, setWaiting] = useState(() => waitingSearch(store())?.shotId === shot.id);
  const photos = usePhotoPicker(project.id);
  const tag = hashtag(project, shot.subject);
  const forShot = shotNo ?? "this shot";

  const keep = async () => {
    const latest = (await db.projects.get(project.id)) ?? project;
    const next = setRefQuery(latest, shot.id, query);
    if (next !== latest) await saveProject(next);
  };

  const title = ["FIND A REF", shotNo && `SHOT ${shotNo}`, shot.subject.toUpperCase()].filter(Boolean).join(" · ");

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className={styles.query}>
        <label htmlFor="find-query" className={ui.label}>
          SEARCH FOR
        </label>
        <textarea id="find-query" className={styles.textarea} rows={2} value={query} onChange={(e) => setQuery(e.target.value)} onBlur={keep} />
        <span className={styles.hint}>Made from the shot and your look&apos;s notes. Change anything.</span>
      </div>

      {SITES.map(({ site, label, hint }) => {
        const href = searchUrl(site, query, tag);
        const why = site === "instagram" ? (tag ? `${hint}: #${tag}` : "Needs a word in the subject to make a hashtag from.") : hint;
        if (!online || !href) {
          return (
            <div key={site} className={styles.rowOff} aria-disabled="true">
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{online ? label : `${label} · NEEDS SIGNAL`}</span>
                <span className={styles.rowHint}>{why}</span>
              </span>
            </div>
          );
        }
        return (
          <a
            key={site}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.row}
            onClick={() => {
              startSearch(store(), project.id, shot.id);
              setWaiting(true);
              void keep();
            }}
          >
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{label}</span>
              <span className={styles.rowHint}>{why}</span>
            </span>
            <span aria-hidden="true" className={styles.chevron}>
              ›
            </span>
          </a>
        );
      })}

      <div className={styles.then}>
        <span className={styles.thenLabel}>THEN</span>
        <span className={styles.thenText}>
          {sharesIn()
            ? `Screenshot one that fits your look and share it here. It'll be ready to pin to ${forShot}.`
            : `Screenshot one that fits your look, then come back and add it. It'll be ready to pin to ${forShot}.`}
        </span>
      </div>

      {waiting && (
        <div className={styles.foot}>
          {photos.element}
          <button type="button" className={ui.secondary} onClick={photos.open}>
            ADD YOUR SCREENSHOT
          </button>
        </div>
      )}
      {!waiting && <div className={styles.end} />}
    </BottomSheet>
  );
}
