"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { PinSheet } from "@/components/look/PinSheet";
import { RequiredMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import sheet from "@/components/ProjectActions.module.css";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/labels";
import { deleteRef, formatTime, groupRefs, openAt, opensAtTime, pinRef, shotsWithRef, siteLabel, sourceKey, sourceLabel, unpinRef, updateRef } from "@/lib/look";
import { deleteImage, useRefImage } from "@/lib/lookImages";
import { StripFrame } from "@/components/look/StripFrame";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import type { FrameRef, IsoDate, LinkRef, NoteRef, Project, Ref } from "@/lib/types";
import { useOnline } from "@/lib/useOnline";
import { saveProject, useProject } from "@/lib/useProject";
import styles from "../Look.module.css";

const EDGE_PX = 24;
const SWIPE_PX = 60;

/**
 * A ref, open (§5.16): a frame (L9, L3), a link (L5) or a note. What it is
 * at the top; then where it came from, the shots it's pinned to, and why
 * this one. Swipe moves through the refs in its group on the board.
 */
function RefScreen() {
  const router = useRouter();
  const { project, params } = useProject();
  const online = useOnline();
  const [sheetOpen, setSheetOpen] = useState<"menu" | "delete" | "pin" | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  const ref = project?.refs?.find((r) => r.id === params.get("ref"));
  if (!project || !ref) return <NotHere href={project ? `/project?id=${project.id}&tab=look` : "/projects"} label="← LOOK" />;

  const look = `/project?id=${project.id}&tab=look`;
  const group = groupRefs(project).find((g) => g.refs.some((r) => r.id === ref.id))!;
  const i = group.refs.findIndex((r) => r.id === ref.id);
  const go = (to?: Ref) => to && router.replace(`/look/ref?id=${project.id}&ref=${to.id}`);
  const save = async (change: (p: Project) => Project) => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(change(latest));
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(t.clientY - start.y) * 1.5) return;
    go(dx < 0 ? group.refs[i + 1] : group.refs[i - 1]);
  };

  const position = group.refs.length > 1 ? `${group.key === "other" ? "" : `${group.label.replace(/^FROM /, "").split(" · ")[0]} · `}${i + 1} / ${group.refs.length}` : "";
  const bar = (dark: boolean) => (
    <div className={dark ? styles.topBar : styles.bandBar}>
      <Link href={look} className={dark ? styles.topBack : ui.backLink}>
        ← LOOK
      </Link>
      <span className={styles.topRight}>
        <span className={styles.position}>{position}</span>
        <button type="button" className={styles.more} aria-label="Ref options" onClick={() => setSheetOpen("menu")} data-light={!dark || undefined}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
            <circle cx="4" cy="10" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="16" cy="10" r="1.6" />
          </svg>
        </button>
      </span>
    </div>
  );

  const numbers = shotNumbers(project);
  const pinned = shotsWithRef(project, ref.id);
  const kindWord = ref.kind === "frame" ? "SCREENSHOT" : ref.kind === "link" ? "LINK" : "NOTE";
  const editHref = ref.kind === "link" ? `/look/link?id=${project.id}&ref=${ref.id}` : ref.kind === "note" ? `/look/note?id=${project.id}&ref=${ref.id}` : undefined;
  const whyText = why ?? ref.why ?? "";

  return (
    <div className={ui.screen} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {ref.kind === "frame" && <FrameTop r={ref} bar={bar(true)} />}
      {ref.kind === "link" && <LinkTop project={project} r={ref} bar={bar(true)} />}
      {ref.kind === "note" && <NoteTop r={ref} bar={bar(false)} />}

      <div className={styles.body}>
        {ref.kind === "frame" && ref.source && <FrameFrom project={project} r={ref} online={online} />}
        {ref.kind === "link" && <LinkMoments project={project} r={ref} online={online} />}

        <section className={styles.section} aria-labelledby="pinned">
          <span id="pinned" className={ui.label}>
            PINNED TO
          </span>
          <div className={styles.rows}>
            {pinned.map((s) => (
              <div key={s.id} className={styles.row}>
                <span className={styles.rowNo}>{numbers.has(s.id) ? formatShotNumber(numbers.get(s.id)!) : ""}</span>
                <span className={styles.rowSize}>{s.size}</span>
                <Link href={`/shot?id=${project.id}&shot=${s.id}`} className={styles.rowText}>
                  <span>{s.subject}</span>
                  {s.required && (
                    <span className={styles.rowRequired}>
                      <RequiredMark label="Required" /> FOR {s.required.client.toUpperCase()}
                    </span>
                  )}
                </Link>
                <button type="button" className={styles.rowAction} onClick={() => save((p) => unpinRef(p, ref.id, s.id))}>
                  UNPIN<span className={ui.visuallyHidden}> from {s.subject}</span>
                </button>
              </div>
            ))}
            {project.shots.length > pinned.length ? (
              <button type="button" className={styles.addPin} onClick={() => setSheetOpen("pin")}>
                {pinned.length ? "+ PIN TO ANOTHER SHOT" : "+ PIN TO A SHOT"}
              </button>
            ) : (
              pinned.length === 0 && <p className={styles.whyEmpty}>No shots yet to pin it to.</p>
            )}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="why">
          <span className={styles.sectionHead}>
            <span id="why" className={ui.label}>
              WHY THIS ONE
            </span>
            {why === null && (
              <button type="button" className={styles.sectionEdit} onClick={() => setWhy(ref.why ?? "")}>
                {ref.why ? "EDIT" : "+ ADD"}
              </button>
            )}
          </span>
          {why !== null ? (
            <>
              <textarea
                aria-labelledby="why"
                className={`${ui.input} ${styles.textarea}`}
                rows={3}
                value={whyText}
                placeholder="What to take from it: the light, the angle, the pace."
                onChange={(e) => setWhy(e.target.value)}
              />
              <button
                type="button"
                className={ui.secondary}
                onClick={async () => {
                  await save((p) => updateRef(p, ref.id, { why: whyText.trim() || undefined }));
                  setWhy(null);
                }}
              >
                SAVE
              </button>
            </>
          ) : ref.why ? (
            <p className={styles.why}>{ref.why}</p>
          ) : (
            <p className={styles.whyEmpty}>A line on what to take from it, so it still makes sense on the day.</p>
          )}
        </section>

        <span className={styles.meta}>
          {kindWord} · ADDED {shortDate(ref.addedAt.slice(0, 10) as IsoDate)} · ON THIS PHONE
        </span>
      </div>

      {sheetOpen === "menu" && (
        <BottomSheet title={`${kindWord} · ${position || "OPTIONS"}`} onClose={() => setSheetOpen(null)}>
          <ul className={sheet.rows}>
            {editHref && (
              <li>
                <Link href={editHref} className={sheet.row}>
                  <span className={sheet.rowText}>
                    <span className={sheet.rowTitle}>{ref.kind === "link" ? "EDIT MOMENTS" : "EDIT NOTE"}</span>
                  </span>
                  <span aria-hidden="true" className={sheet.chevron}>
                    ›
                  </span>
                </Link>
              </li>
            )}
            <li>
              <button type="button" className={`${sheet.row} ${sheet.warn}`} onClick={() => setSheetOpen("delete")}>
                <span className={sheet.rowText}>
                  <span className={sheet.rowTitle}>DELETE REF</span>
                  <span className={sheet.rowHint}>Asks you first.</span>
                </span>
                <span aria-hidden="true" className={sheet.chevron}>
                  ›
                </span>
              </button>
            </li>
          </ul>
        </BottomSheet>
      )}
      {sheetOpen === "delete" && (
        <BottomSheet kicker={`DELETE · ${kindWord}`} title="Delete this ref?" onClose={() => setSheetOpen(null)}>
          <div className={styles.body}>
            <p className={styles.whyEmpty}>
              {ref.kind === "frame" ? "The image goes from this phone" : ref.kind === "link" ? `The link and its ${ref.moments.length === 1 ? "moment go" : "moments go"}` : "The note goes"}
              {pinned.length ? `, and it comes off ${pinned.length === 1 ? "the shot" : `the ${pinned.length} shots`} it's pinned to` : ""}. This can&apos;t be undone.
            </p>
            <button
              type="button"
              className={`${ui.primary} ${ui.destructive}`}
              onClick={async () => {
                router.replace(look);
                await save((p) => deleteRef(p, ref.id));
                if (ref.kind === "frame") await deleteImage(ref.imageId);
              }}
            >
              YES, DELETE
            </button>
            <button type="button" className={ui.secondary} onClick={() => setSheetOpen(null)}>
              CANCEL
            </button>
          </div>
        </BottomSheet>
      )}
      {sheetOpen === "pin" && (
        <PinSheet
          project={project}
          already={pinned.map((s) => s.id)}
          onClose={() => setSheetOpen(null)}
          onPin={async (ids) => {
            setSheetOpen(null);
            await save((p) => pinRef(p, ref.id, ids));
          }}
        />
      )}
    </div>
  );
}

function FrameTop({ r, bar }: { r: FrameRef; bar: ReactNode }) {
  const src = useRefImage(r.imageId, "full");
  return (
    <div className={styles.top}>
      {bar}
      {/* eslint-disable-next-line @next/next/no-img-element -- a Blob from this phone */}
      {src ? <img src={src} alt={r.why ?? "Reference frame"} className={styles.whole} /> : <div className={styles.imagePlaceholder} aria-hidden="true" />}
    </div>
  );
}

function LinkTop({ project, r, bar }: { project: Project; r: LinkRef; bar: ReactNode }) {
  const n = r.moments.length;
  return (
    <div className={styles.top}>
      {bar}
      <div className={styles.linkHead}>
        <svg width="28" height="28" viewBox="0 0 22 22" aria-hidden="true" className={styles.play}>
          <path d="M7 4.5v13l11-6.5z" fill="currentColor" />
        </svg>
        <h1 className={styles.linkTitle}>{r.title ?? (siteLabel(r.url) === "INSTAGRAM" ? "Instagram" : r.url.replace(/^https?:\/\/(www\.)?/, ""))}</h1>
        <span className={styles.linkMeta}>
          {[r.channel ? r.channel.toUpperCase() : sourceLabel(project, r.url).split(" · ")[0], siteLabel(r.url), n === 1 ? "1 MOMENT" : `${n} MOMENTS`]
            .filter((x, k, a) => a.indexOf(x) === k)
            .join(" · ")}
        </span>
      </div>
    </div>
  );
}

function NoteTop({ r, bar }: { r: NoteRef; bar: ReactNode }) {
  return (
    <>
      {bar}
      <div className={styles.noteHead}>
        <span className={styles.noteTags}>{["NOTE", ...r.tags.map((t) => t.toUpperCase())].join(" · ")}</span>
        <h1 className={styles.noteText}>{r.text}</h1>
      </div>
    </>
  );
}

/** FROM: the video, opening at the frame's time where it can (L9). */
function FrameFrom({ project, r, online }: { project: Project; r: FrameRef; online: boolean }) {
  const source = r.source!;
  const atTime = opensAtTime(source);
  const whose = sourceLabel(project, source).split(" · ")[0];
  const label = `${whose}${r.at !== undefined ? ` · AT ${formatTime(r.at)}` : ""}`;
  const action = atTime ? (r.at !== undefined ? `OPEN AT ${formatTime(r.at)}` : "OPEN THE VIDEO") : siteLabel(source) === "INSTAGRAM" ? "OPEN THE REEL" : "OPEN THE LINK";
  return (
    <section className={styles.section} aria-labelledby="from">
      <span id="from" className={ui.label}>
        FROM
      </span>
      {online ? (
        <a href={openAt(source, r.at)} target="_blank" rel="noreferrer" className={styles.open}>
          <span>{label}</span>
          <span>{action} ›</span>
        </a>
      ) : (
        <span className={styles.openOff} role="link" aria-disabled="true">
          <span>{label}</span>
          <span>OPEN · NEEDS SIGNAL</span>
        </span>
      )}
      {!atTime && r.at !== undefined && siteLabel(source) === "INSTAGRAM" && (
        <p className={ui.hint}>Instagram doesn&apos;t open at a time, so {formatTime(r.at)} is your reminder.</p>
      )}
    </section>
  );
}

/** L5: each moment opens the video there; with no signal, the buttons say why they can't. */
function LinkMoments({ project, r, online }: { project: Project; r: LinkRef; online: boolean }) {
  const key = sourceKey(r.url);
  const frames = (project.refs ?? []).filter((x): x is FrameRef => x.kind === "frame" && !!x.source && sourceKey(x.source) === key);
  return (
    <>
      {!online && (
        <div className={ui.box} role="status">
          <span className={ui.boxHeadingWarn}>! NO SIGNAL</span>
          <p className={ui.boxText}>The video opens when you&apos;re back online. Moments, frames and pins are on this phone.</p>
        </div>
      )}
      <section className={styles.section} aria-labelledby="moments">
        <span id="moments" className={ui.label}>
          MOMENTS
        </span>
        <div className={styles.rows}>
          {r.moments.length === 0 && (
            <div className={styles.row}>
              <span className={styles.rowText}>The whole video</span>
              {online ? (
                <a href={openAt(r.url)} target="_blank" rel="noreferrer" className={styles.sectionEdit}>
                  OPEN ›
                </a>
              ) : (
                <span className={styles.momentNote}>OPEN · NEEDS SIGNAL</span>
              )}
            </div>
          )}
          {r.moments.map((m) => (
            <div key={m} className={styles.row}>
              <span className={styles.rowText}>{formatTime(m)}</span>
              {online ? (
                <a href={openAt(r.url, m)} target="_blank" rel="noreferrer" className={styles.open}>
                  {opensAtTime(r.url) ? `OPEN AT ${formatTime(m)} ›` : "OPEN THE REEL ›"}
                </a>
              ) : (
                <span className={styles.openOff} role="link" aria-disabled="true">
                  OPEN · NEEDS SIGNAL
                </span>
              )}
            </div>
          ))}
        </div>
        {!opensAtTime(r.url) && r.moments.length > 0 && <p className={ui.hint}>Instagram doesn&apos;t open at a time, so the moments are your reminder.</p>}
      </section>
      <section className={styles.section} aria-labelledby="frames">
        <span id="frames" className={ui.label}>
          FRAMES FROM THIS VIDEO · {frames.length}
        </span>
        {frames.length ? (
          <div className={styles.strip}>
            {frames.map((f) => (
              <StripFrame key={f.id} project={project} f={f} />
            ))}
          </div>
        ) : (
          <p className={styles.whyEmpty}>Screenshot the moments while you watch and add them here with this link. They&apos;ll sit with it.</p>
        )}
      </section>
    </>
  );
}

export default function RefPage() {
  return (
    <Suspense>
      <RefScreen />
    </Suspense>
  );
}
