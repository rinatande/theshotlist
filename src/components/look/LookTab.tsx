"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { columns, formatTime, groupRefs, lookCounts, siteLabel } from "@/lib/look";
import { useRefImage } from "@/lib/lookImages";
import { fillTitles } from "@/lib/lookTitles";
import { stashFiles } from "@/lib/shareInbox";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import type { FrameRef, Id, LinkRef, NoteRef, Project, Ref } from "@/lib/types";
import styles from "./Look.module.css";

/** Android's installed app is in the share sheet; iOS has no web share target, so it never says so (§5.16). */
export function sharesIn(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return !/iPhone|iPad|iPod/.test(ua) && !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** PHOTOS: the gallery picker, landing on the same screen as a share (L8). */
export function usePhotoPicker(projectId: Id) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      hidden
      data-testid="look-photos"
      onChange={async (e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (!files.length) return;
        await stashFiles(window.caches, files);
        router.push(`/look/share?id=${projectId}`);
      }}
    />
  );
  return { element, open: () => input.current?.click() };
}

/**
 * The LOOK tab (§5.16): L1 the board, L0 when it's empty. The one screen that
 * breaks the paper-and-rules format on purpose — a full-bleed grid of images
 * with 2px gaps, no side padding, no borders.
 */
export function LookTab({ project }: { project: Project }) {
  const [adding, setAdding] = useState(false);
  const photos = usePhotoPicker(project.id);
  const share = sharesIn();

  // Links saved with no signal get their titles once there's some.
  useEffect(() => {
    void fillTitles(project.id);
    const online = () => void fillTitles(project.id);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [project.id]);

  const refs = project.refs ?? [];
  if (refs.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>
          <p className={styles.emptyLead}>Nothing on the look yet.</p>
          <p className={styles.emptyLine}>
            Collect what you want this to feel like.{share ? " Watching something good? Screenshot the moments and share them here." : ""} Pin any ref to a shot and
            it&apos;s there on set.
          </p>
        </div>
        <AddRoutes project={project} share={share} onPhotos={photos.open} />
        {photos.element}
      </div>
    );
  }

  const { pinned } = lookCounts(project);
  const numbers = shotNumbers(project);
  const pinsOf = (id: Id) => project.shots.filter((s) => s.refIds?.includes(id)).map((s) => numbers.get(s.id)).filter((n): n is number => n !== undefined);

  return (
    <div className={styles.look}>
      <p className={styles.counts}>
        {refs.length === 1 ? "1 REF" : `${refs.length} REFS`} · {pinned} PINNED TO SHOTS
      </p>
      <div className={styles.board}>
        {groupRefs(project).map((g) => {
          const [left, right] = columns(g.refs, tileRatio);
          return (
            <section key={g.key} aria-label={g.label}>
              <Link href={`/look/ref?id=${project.id}&ref=${g.refs[0].id}`} className={styles.band}>
                <span>{g.label}</span>
                <span>
                  {g.count}
                  {g.key === "other" ? "" : " ›"}
                </span>
              </Link>
              <div className={styles.grid}>
                {[left, right].map((col, i) => (
                  <div key={i} className={styles.column}>
                    {col.map((r) => (
                      <Tile key={r.id} project={project} r={r} pins={pinsOf(r.id)} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className={styles.fabWrap}>
        <button type="button" className={styles.fab} onClick={() => setAdding(true)}>
          + ADD
        </button>
      </div>

      {adding && (
        <BottomSheet title="ADD TO LOOK" onClose={() => setAdding(false)}>
          <AddRoutes
            project={project}
            share={share}
            onPhotos={() => {
              setAdding(false);
              photos.open();
            }}
          />
        </BottomSheet>
      )}
      {photos.element}
    </div>
  );
}

/** PHOTOS · LINK · NOTE — L0 and the L2 sheet share them. */
function AddRoutes({ project, share, onPhotos }: { project: Project; share: boolean; onPhotos: () => void }) {
  return (
    <ul className={styles.routes}>
      <li>
        <button type="button" className={styles.route} onClick={onPhotos}>
          <span className={styles.routeText}>
            <span className={styles.routeTitle}>PHOTOS</span>
            <span className={styles.routeLine}>From your gallery.{share ? " Or share screenshots straight from it: TheShotList is in the share sheet." : ""}</span>
          </span>
          <span aria-hidden="true" className={styles.chev}>
            ›
          </span>
        </button>
      </li>
      <li>
        <Link href={`/look/link?id=${project.id}`} className={styles.route}>
          <span className={styles.routeText}>
            <span className={styles.routeTitle}>LINK</span>
            <span className={styles.routeLine}>Save the moments you want from a video. Each one opens it right there.</span>
          </span>
          <span aria-hidden="true" className={styles.chev}>
            ›
          </span>
        </Link>
      </li>
      <li>
        <Link href={`/look/note?id=${project.id}`} className={styles.route}>
          <span className={styles.routeText}>
            <span className={styles.routeTitle}>NOTE</span>
            <span className={styles.routeLine}>Grade, pace, sound or mood, in your own words.</span>
          </span>
          <span aria-hidden="true" className={styles.chev}>
            ›
          </span>
        </Link>
      </li>
    </ul>
  );
}

/** Height over width, for laying out the two columns: images as they'll be drawn, notes and links roughly. */
function tileRatio(r: Ref): number {
  if (r.kind === "frame") return Math.min(r.height / r.width, 5 / 4);
  if (r.kind === "note") return 0.35 + Math.min(r.text.length, 240) / 400;
  return 0.6;
}

function Tile({ project, r, pins }: { project: Project; r: Ref; pins: number[] }) {
  if (r.kind === "frame") return <FrameTile project={project} r={r} pins={pins} />;
  if (r.kind === "link") return <LinkTile project={project} r={r} pins={pins} />;
  return <NoteTile project={project} r={r} pins={pins} />;
}

/** "→ 03", or "→ 03 +2" when it sits on more than one shot. */
const pinTag = (pins: number[]) => (pins.length ? `→ ${formatShotNumber(pins[0])}${pins.length > 1 ? ` +${pins.length - 1}` : ""}` : undefined);
const pinWords = (pins: number[]) => (pins.length ? `, pinned to shot ${pins.map(formatShotNumber).join(", ")}` : "");

function FrameTile({ project, r, pins }: { project: Project; r: FrameRef; pins: number[] }) {
  const src = useRefImage(r.imageId, "thumb");
  const tag = pinTag(pins);
  return (
    <Link
      href={`/look/ref?id=${project.id}&ref=${r.id}`}
      aria-label={`Frame${r.at !== undefined ? ` at ${formatTime(r.at)}` : ""}${pinWords(pins)}${r.why ? `. ${r.why}` : ""}`}
      className={styles.frame}
      style={{ aspectRatio: `${r.width} / ${Math.min(r.height, r.width * 1.25)}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a Blob URL from this phone, not something next/image can fetch */}
      {src && <img src={src} alt="" className={styles.img} />}
      {tag && <span className={`${styles.tag} ${styles.tagLeft}`}>{tag}</span>}
      {r.at !== undefined && <span className={`${styles.tag} ${styles.tagRight}`}>{formatTime(r.at)}</span>}
    </Link>
  );
}

function NoteTile({ project, r, pins }: { project: Project; r: NoteRef; pins: number[] }) {
  const tag = pinTag(pins);
  return (
    <Link href={`/look/ref?id=${project.id}&ref=${r.id}`} className={styles.note} aria-label={`Note${pinWords(pins)}: ${r.text}`}>
      <span className={styles.noteHead}>{["NOTE", ...r.tags.map((t) => t.toUpperCase())].join(" · ")}</span>
      <span className={styles.noteText}>{r.text}</span>
      {tag && <span className={styles.noteTag}>{tag}</span>}
    </Link>
  );
}

function LinkTile({ project, r, pins }: { project: Project; r: LinkRef; pins: number[] }) {
  const tag = pinTag(pins);
  const n = r.moments.length;
  return (
    <Link href={`/look/ref?id=${project.id}&ref=${r.id}`} className={styles.link} aria-label={`Video link${r.title ? `, ${r.title}` : ""}, ${n} moments${pinWords(pins)}`}>
      <span className={styles.linkTop}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <path d="M7 4.5v13l11-6.5z" fill="currentColor" />
        </svg>
        <span className={styles.linkMeta}>{n === 1 ? "1 MOMENT" : `${n} MOMENTS`}</span>
      </span>
      <span className={styles.linkTitle}>{r.title ?? (siteLabel(r.url) === "INSTAGRAM" ? "Instagram" : r.url.replace(/^https?:\/\/(www\.)?/, ""))}</span>
      <span className={styles.linkMeta}>{[...r.moments.map(formatTime), siteLabel(r.url)].join(" · ")}</span>
      {tag && <span className={styles.noteTag}>{tag}</span>}
    </Link>
  );
}
