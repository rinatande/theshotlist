"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PinSheet } from "@/components/look/PinSheet";
import { ProjectTo, useShareProject } from "@/components/look/ProjectPicker";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { parseTime, parseVideo, sourceLabel } from "@/lib/look";
import { clearSearch, waitingSearch, type WaitingSearch } from "@/lib/findRef";
import { addFrames, importImage, OutOfSpace } from "@/lib/lookImages";
import { clearInbox, readInbox, type InboxMeta } from "@/lib/shareInbox";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import type { Id } from "@/lib/types";
import styles from "../Look.module.css";

/**
 * L8 Share-in (§5.16): screenshots shared from another app, or picked with
 * PHOTOS. Where in the video each one is, which look, which video they came
 * from, and a shot to pin them to — all optional — then ADD N TO LOOK.
 *
 * L8b (§5.17): with a FIND A REF search waiting, they're for that shot — the
 * look is its project's, the shot is ticked, and adding goes back to it.
 */
function ShareIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { projects, project, choose } = useShareProject(params.get("id"));
  const [inbox, setInbox] = useState<{ meta: InboxMeta; files: Blob[]; previews: string[] } | null | undefined>(undefined);
  const [times, setTimes] = useState<string[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [pinTo, setPinTo] = useState<Id[]>([]);
  const [pinning, setPinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [search, setSearch] = useState<WaitingSearch | undefined>(undefined);

  useEffect(() => {
    let previews: string[] = [];
    void readInbox(window.caches).then((r) => {
      if (!r || r.files.length === 0) return setInbox(null);
      previews = r.files.map((f) => URL.createObjectURL(f));
      setInbox({ ...r, previews });
      setTimes(r.files.map(() => ""));
      // A search from FIND A REF, still under an hour old, sets the look and the shot.
      const w = waitingSearch(window.localStorage);
      if (w) {
        setSearch(w);
        choose(w.projectId);
        setPinTo([w.shotId]);
      }
    });
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
    // choose is a state setter: this runs once, on arrival.
  }, [choose]);

  const cancelTo = project ? `/project?id=${project.id}&tab=look` : "/";
  if (params.get("nosw") || inbox === null) {
    return (
      <div className={ui.screen}>
        <StepHeader label="Add to look" back={{ label: "← BACK", href: cancelTo }} />
        <div className={ui.body}>
          <p className={ui.boxText}>
            {params.get("nosw")
              ? "The share didn't reach the app — it needs to be open once first. Open TheShotList, then share the screenshots again."
              : "Nothing to add — the screenshots weren't kept. Share them again, or add them with PHOTOS on the look."}
          </p>
          <Link href={cancelTo} className={ui.secondary}>
            {project ? "TO THE LOOK" : "TO THE APP"}
          </Link>
        </div>
      </div>
    );
  }
  if (inbox === undefined || !projects) return <div className={ui.screen} aria-busy="true" />;

  const n = inbox.files.length;
  const link = from ?? inbox.meta.url ?? "";
  const video = link.trim() ? parseVideo(link) : undefined;
  const parsed = times.map((t) => parseTime(t));
  const badTime = times.find((t, i) => t.trim() && parsed[i] === undefined);
  const needsName = video?.site === "instagram" && !video.handle && !project?.sourceNames?.[video.key];
  const numbers = project ? shotNumbers(project) : new Map();
  const pinnedLabel = pinTo.map((id) => numbers.get(id)).filter((x) => x !== undefined).map((x) => formatShotNumber(x as number)).join(", ");
  const ready = !!project && !badTime && !(link.trim() && !video) && !busy;
  // The search's shot, if it's still there — a deleted one just means an ordinary share.
  const sought = search && project?.id === search.projectId ? project.shots.find((s) => s.id === search.shotId) : undefined;
  const pinned = project ? pinTo.flatMap((id) => project.shots.find((s) => s.id === id) ?? []) : [];
  const action = sought && pinnedLabel ? `ADD${n === 1 ? "" : ` ${n}`} AND PIN TO ${pinnedLabel}` : n === 1 ? "ADD 1 TO LOOK" : `ADD ${n} TO LOOK`;

  const add = async () => {
    if (!project) return;
    setBusy(true);
    setProblem(null);
    try {
      const images = [];
      for (const f of inbox.files) images.push(await importImage(f));
      const ids = await addFrames(
        project.id,
        images.map((image, i) => ({ image, at: parsed[i], source: video?.url })),
        { pinTo, pinFirst: !!sought, sourceName: video && source.trim() ? { key: video.key, name: source } : undefined },
      );
      await clearInbox(window.caches);
      clearSearch(window.localStorage);
      // Back to the shot you were finding a ref for, with what you added marked (S3j).
      const back = sought && pinTo.length ? (pinTo.includes(sought.id) ? sought.id : pinTo[0]) : undefined;
      router.replace(back ? `/shot?id=${project.id}&shot=${back}&added=${ids.join(",")}` : `/project?id=${project.id}&tab=look`);
    } catch (e) {
      setBusy(false);
      setProblem(e instanceof OutOfSpace ? e.message : "Those couldn't be added — one of them may not be an image. Nothing was added.");
    }
  };

  const whose = video && project ? sourceLabel({ ...project, sourceNames: source.trim() ? { ...project.sourceNames, [video.key]: source.trim() } : project.sourceNames }, video.url) : undefined;

  return (
    <div className={ui.screen}>
      <StepHeader
        label={n === 1 ? "Add 1 screenshot" : `Add ${n} screenshots`}
        back={{
          label: "CANCEL",
          onClick: async () => {
            await clearInbox(window.caches);
            clearSearch(window.localStorage);
            router.replace(sought ? `/shot?id=${project!.id}&shot=${sought.id}` : cancelTo);
          },
        }}
      />
      {sought && (
        <div className={styles.forShot}>
          YOU WERE FINDING A REF FOR {[numbers.get(sought.id) !== undefined ? formatShotNumber(numbers.get(sought.id)) : undefined, sought.subject.toUpperCase()].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className={ui.body}>
        <div className={ui.fieldset}>
          <span id="at" className={ui.label}>
            WHERE IN THE VIDEO · OPTIONAL
          </span>
          <div role="group" aria-labelledby="at" className={styles.frames}>
            {inbox.previews.map((src, i) => (
              <div key={src} className={styles.frameCell}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local Blob, not something next/image can fetch */}
                <img src={src} alt={`Screenshot ${i + 1}`} />
                <input
                  className={ui.input}
                  aria-label={`Time in the video for screenshot ${i + 1}`}
                  inputMode="numeric"
                  placeholder="m:ss"
                  value={times[i] ?? ""}
                  onChange={(e) => setTimes(times.map((t, j) => (j === i ? e.target.value : t)))}
                />
              </div>
            ))}
          </div>
          {badTime && <p className={ui.hint}>&quot;{badTime}&quot; isn&apos;t a time. Write it as m:ss, like 0:12.</p>}
        </div>

        {sought && project && (
          <div className={ui.field}>
            <span id="pin-to" className={ui.label}>
              PIN TO
            </span>
            <div role="group" aria-labelledby="pin-to" className={styles.pinned}>
              {/* CHANGE sits on the last row, as L8b draws it on the one. */}
              {(pinned.length ? pinned : [undefined]).map((s, i, all) => (
                <span key={s?.id ?? "none"} className={s ? styles.pinnedShot : styles.pinnedNone}>
                  {s ? (
                    <>
                      <span aria-hidden="true" className={styles.pinnedTick}>✓</span>
                      <span className={styles.pinnedNo}>{numbers.get(s.id) !== undefined ? formatShotNumber(numbers.get(s.id)) : ""}</span>
                      <span className={styles.pinnedSize}>{s.size}</span>
                      <span className={styles.pinnedSubject}>{s.subject}</span>
                    </>
                  ) : (
                    <span className={styles.pinnedSubject}>No shot — it goes on the look only.</span>
                  )}
                  {i === all.length - 1 && (
                    <button type="button" className={styles.pinnedChange} onClick={() => setPinning(true)} aria-label="Change which shots it's pinned to">
                      CHANGE
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {!sought && (
          <ProjectTo projects={projects} project={project} onChoose={(id) => {
            choose(id);
            setPinTo([]);
          }} />
        )}

        <div className={ui.field}>
          <label htmlFor="from" className={ui.label}>
            FROM A VIDEO · OPTIONAL
          </label>
          <input id="from" className={ui.input} type="url" inputMode="url" autoComplete="off" value={link} placeholder="instagram.com/reel/… or youtu.be/…" onChange={(e) => setFrom(e.target.value)} />
          {link.trim() && !video && <p className={ui.hint}>That doesn&apos;t look like a link.</p>}
          {video && (
            <p className={ui.hint}>
              <span className={styles.strongLine}>{whose}.</span> {n === 1 ? "It opens" : `The ${n} sit together on the board, and each opens`}{" "}
              {video.site === "youtube" ? "the video at its time." : video.site === "instagram" ? "the reel." : "the link."}
            </p>
          )}
        </div>

        {needsName && (
          <div className={ui.field}>
            <label htmlFor="source" className={ui.label}>
              WHO IT&apos;S FROM · OPTIONAL
            </label>
            <input id="source" className={ui.input} type="text" autoComplete="off" value={source} placeholder="@mm_fave" onChange={(e) => setSource(e.target.value)} />
            <p className={ui.hint}>Instagram links don&apos;t say whose reel it is. Name it once and these sit under that name on the board.</p>
          </div>
        )}

        {!sought && project && project.shots.length > 0 && (
          <button type="button" className={styles.pinRow} onClick={() => setPinning(true)}>
            <span>PIN TO A SHOT · OPTIONAL</span>
            <span className={styles.pinRowValue}>{pinnedLabel ? `→ ${pinnedLabel}` : "›"}</span>
          </button>
        )}

        {/* L8b: the look is the search's project's, so TO is a line, not a choice. */}
        {sought && project && <p className={styles.toLine}>TO {project.name.toUpperCase()} · LOOK</p>}

        {problem && (
          <div className={ui.box} role="alert">
            <span className={ui.boxHeadingWarn}>! NOT ADDED</span>
            <p className={ui.boxText}>{problem}</p>
          </div>
        )}
      </div>
      <div className={ui.footer}>
        {ready ? (
          <button type="button" className={ui.primary} onClick={add}>
            {action}
          </button>
        ) : (
          <>
            <p className={ui.hint} id="share-why">
              {busy ? "Adding…" : !project ? "Make a project first." : badTime ? "Fix the time above first." : "Fix the link above, or clear it."}
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="share-why">
              {action}
            </button>
          </>
        )}
      </div>
      {pinning && project && (
        <PinSheet
          project={project}
          initial={pinTo}
          onClose={() => setPinning(false)}
          onPin={(ids) => {
            setPinTo(ids);
            setPinning(false);
          }}
        />
      )}
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareIn />
    </Suspense>
  );
}
