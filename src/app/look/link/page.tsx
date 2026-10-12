"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ProjectTo, useShareProject } from "@/components/look/ProjectPicker";
import { sharesIn } from "@/components/look/LookTab";
import { NotHere } from "@/components/NotHere";
import { StepHeader } from "@/components/StepHeader";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { addRefs, formatTime, makeLink, parseTime, parseVideo, sourceLabel, updateRef } from "@/lib/look";
import { lookUpTitle } from "@/lib/lookTitles";
import type { LinkRef } from "@/lib/types";
import { saveProject } from "@/lib/useProject";
import { useSearchParams } from "next/navigation";
import styles from "../Look.module.css";

interface Moment {
  key: number;
  text: string;
  /** "From the link" for the time the URL carried, "Added" for the rest (L7). */
  fromLink: boolean;
}

/**
 * L7 Link: a video and the moments you want from it. Nothing is downloaded
 * or played here; each moment opens the video there. The first moment comes
 * from the link's own time. Reached from + ADD, or from sharing a link in
 * from another app — then it asks which look it goes to.
 */
function LinkScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { projects, project, choose } = useShareProject(params.get("id"));
  const editingId = params.get("ref");
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [source, setSource] = useState("");
  const [found, setFound] = useState<{ title?: string; channel?: string } | null>(null);
  const [online, setOnline] = useState(true);

  const editing = project?.refs?.find((r): r is LinkRef => r.id === editingId && r.kind === "link");
  const video = parseVideo(editing?.url ?? url);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // A YouTube link's title and channel, looked up once there's a link and signal.
  const lookup = video?.site === "youtube" && !editing ? video.url : undefined;
  useEffect(() => {
    if (!lookup || !online) return;
    let live = true;
    void lookUpTitle(lookup).then((r) => live && setFound(r ?? null));
    return () => {
      live = false;
    };
  }, [lookup, online]);

  if (!projects) return <div className={ui.screen} aria-busy="true" />;
  if (editingId && !editing) return <NotHere href={project ? `/project?id=${project.id}&tab=look` : "/projects"} label="← LOOK" />;

  // Until the person touches them, moments follow the link: its own time first.
  const list: Moment[] = moments ?? (editing ? editing.moments.map((m, i) => ({ key: i, text: formatTime(m), fromLink: false })) : video?.start !== undefined ? [{ key: 0, text: formatTime(video.start), fromLink: true }] : []);
  const times = list.map((m) => parseTime(m.text));
  const badTime = list.find((m, i) => m.text.trim() && times[i] === undefined);
  const back = project ? (editing ? `/look/ref?id=${project.id}&ref=${editing.id}` : `/project?id=${project.id}&tab=look`) : "/";
  const askSource = video?.site === "instagram" && !video.handle && !project?.sourceNames?.[video.key];
  const ready = !!project && !!video && !badTime;

  const save = async () => {
    if (!project || !video) return;
    const latest = (await db.projects.get(project.id)) ?? project;
    const secs = times.filter((t): t is number => t !== undefined);
    let next = latest;
    if (editing) next = updateRef(latest, editing.id, { moments: [...new Set(secs)].sort((a, b) => a - b) });
    else {
      const link = makeLink(video.url, secs, new Date(), crypto.randomUUID())!;
      next = addRefs(latest, [{ ...link, title: found?.title, channel: found?.channel }]);
    }
    if (source.trim()) next = { ...next, sourceNames: { ...next.sourceNames, [video.key]: source.trim() } };
    await saveProject(next);
    router.replace(back);
  };

  const what = editing
    ? [editing.title, editing.channel].filter(Boolean).join(" · ")
    : video?.site === "youtube"
      ? found?.title
        ? `${found.title}${found.channel ? ` · ${found.channel}` : ""} · YouTube`
        : online
          ? "YouTube"
          : "YouTube — the title fills in when you're back online."
      : video?.site === "instagram"
        ? `Instagram · ${video.url.replace(/^https?:\/\/(www\.)?/, "")}`
        : undefined;

  return (
    <div className={ui.screen}>
      <StepHeader label={editing ? "Moments" : "Link"} back={{ label: editing ? "← REF" : params.get("shared") ? "CANCEL" : "← LOOK", href: back }} />
      <div className={ui.body}>
        {params.get("shared") && projects && <ProjectTo projects={projects} project={project} onChoose={choose} />}

        {!editing && (
          <div className={ui.field}>
            <label htmlFor="url" className={ui.label}>
              LINK
            </label>
            <input
              id="url"
              className={ui.input}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              placeholder="youtu.be/… or instagram.com/reel/…"
              onChange={(e) => {
                setUrl(e.target.value);
                setMoments(null);
                setFound(null);
              }}
            />
            {url.trim() && !video && <p className={ui.hint}>That doesn&apos;t look like a link.</p>}
            {what && <p className={styles.found}>{what}</p>}
          </div>
        )}
        {editing && <p className={styles.found}>{what || sourceLabel(project!, editing.url)}</p>}

        {askSource && (
          <div className={ui.field}>
            <label htmlFor="source" className={ui.label}>
              WHO IT&apos;S FROM · OPTIONAL
            </label>
            <input id="source" className={ui.input} type="text" autoComplete="off" value={source} placeholder="@mm_fave" onChange={(e) => setSource(e.target.value)} />
            <p className={ui.hint}>Instagram links don&apos;t say whose reel it is. Name it once and its frames sit under that name on the board.</p>
          </div>
        )}

        {video && (
          <div className={ui.fieldset}>
            <span className={ui.label}>MOMENTS · EACH OPENS THE VIDEO THERE</span>
            <ul className={styles.moments}>
              {list.map((m, i) => (
                <li key={m.key} className={styles.moment}>
                  <span className={styles.momentField}>
                    <input
                      aria-label={`Moment ${i + 1}, minutes and seconds`}
                      className={`${ui.input} ${styles.time}`}
                      inputMode="numeric"
                      placeholder="m:ss"
                      value={m.text}
                      onChange={(e) => setMoments(list.map((x) => (x.key === m.key ? { ...x, text: e.target.value } : x)))}
                    />
                    <span className={styles.momentNote}>{m.fromLink ? "From the link" : "Added"}</span>
                  </span>
                  <button type="button" className={styles.remove} aria-label={`Remove moment ${m.text || i + 1}`} onClick={() => setMoments(list.filter((x) => x.key !== m.key))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.addMoment} onClick={() => setMoments([...list, { key: Date.now(), text: "", fromLink: false }])}>
              + ADD MOMENT
            </button>
            {badTime && <p className={ui.hint}>&quot;{badTime.text}&quot; isn&apos;t a time. Write it as m:ss, like 1:12.</p>}
          </div>
        )}

        {!editing && video && sharesIn() && (
          <div className={styles.aside}>
            <span className={ui.label}>WANT THE FRAMES TOO?</span>
            <p className={ui.hint}>Screenshot them while you watch, then share them here and pick this video. They&apos;ll sit with it on the board.</p>
          </div>
        )}
      </div>
      <div className={ui.footer}>
        {ready ? (
          <button type="button" className={ui.primary} onClick={save}>
            {editing ? "SAVE MOMENTS" : "ADD TO LOOK"}
          </button>
        ) : (
          <>
            <p className={ui.hint} id="link-why">
              {!project ? "Make a project first." : badTime ? "Fix the time above first." : "Paste a link to a video."}
            </p>
            <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="link-why">
              {editing ? "SAVE MOMENTS" : "ADD TO LOOK"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LinkPage() {
  return (
    <Suspense>
      <LinkScreen />
    </Suspense>
  );
}
