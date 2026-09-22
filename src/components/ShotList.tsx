"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { beatLabel, ROLES, shotsByBeat } from "@/lib/beats";
import { projectBudget } from "@/lib/budget";
import { budgetLabel, shortDate } from "@/lib/labels";
import { runningOrder } from "@/lib/runningOrder";
import { formatShotNumber, shotNumbers } from "@/lib/shotNumbers";
import { dayOfShot, toggleExposed } from "@/lib/shots";
import { supportLabel } from "@/lib/suggest";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import type { Id, Location, Project, Shot } from "@/lib/types";
import { saveProject } from "@/lib/useProject";
import { capitalise, cutPhrase, inWords } from "@/lib/words";
import { Choice } from "./Choice";
import { RequiredMark, StatusMark } from "./Marks";
import styles from "./ShotList.module.css";
import ui from "./ui.module.css";

type View = "location" | "beat";

/** The SHOTS tab: S2 by location, P3 by beat, E5 when empty (§8 Shot list). */
export function ShotList({ project }: { project: Project }) {
  const [view, setView] = useState<View>("location");
  const [fresh, setFresh] = useState<Id | null>(null);
  const [tf, setTf] = useState<TimeFormat>("12h");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTf(readTimeFormat());
    try {
      if (sessionStorage.getItem(`tsl-view-${project.id}`) === "beat") setView("beat");
    } catch {}
  }, [project.id]);

  const chooseView = (v: View) => {
    setView(v);
    try {
      sessionStorage.setItem(`tsl-view-${project.id}`, v);
    } catch {}
  };

  const numbers = shotNumbers(project);
  const b = projectBudget(project);
  const planned = project.shots.filter((s) => s.status !== "dropped").length;
  const over = planned > b.max;

  const toggle = async (id: Id) => {
    const exposing = project.shots.find((s) => s.id === id)?.status !== "exposed";
    setFresh(exposing ? id : null);
    await saveProject(toggleExposed(project, id));
  };

  if (project.shots.length === 0 && project.locations.length === 0) {
    return (
      <>
        <PlanBar project={project} view={view} onView={chooseView} planned={0} over={false} />
        <EmptyList project={project} />
      </>
    );
  }

  const rowProps = { project, numbers, fresh, onToggle: toggle, tf };

  return (
    <>
      <PlanBar project={project} view={view} onView={chooseView} planned={planned} over={over} />
      <div className={styles.columns} aria-hidden="true">
        <span>NO.</span>
        <span>SIZE</span>
        <span>SUBJECT</span>
        <span className={styles.right}>ST</span>
      </div>

      {view === "location" ? <ByLocation {...rowProps} /> : <ByBeat {...rowProps} />}

      {over && (
        // One advisory, once, at the foot — never a warning per shot (§5.2).
        <div className={styles.advisory} role="note">
          <span className={ui.boxHeadingWarn}>OVER</span>
          <p className={ui.boxText}>
            {planned} planned for {cutPhrase(project.format)}. {capitalise(inWords(b.min))} to {inWords(b.max)} is plenty — trim now rather
            than at 6am in the cold.
          </p>
        </div>
      )}
    </>
  );
}

// ─── Plan bar ─────────────────────────────────────────────────────────────────

function PlanBar({ project, view, onView, planned, over }: { project: Project; view: View; onView: (v: View) => void; planned: number; over: boolean }) {
  const b = projectBudget(project);
  return (
    <div className={styles.planBar}>
      <div className={styles.toggle}>
        <Choice
          label="Group shots by"
          hideLabel
          small
          options={[
            { value: "location", label: "LOCATION" },
            { value: "beat", label: "BEAT" },
          ]}
          value={view}
          onChange={onView}
        />
      </div>
      <Link href={`/order?id=${project.id}`} className={styles.order}>
        ORDER
      </Link>
      <span className={over ? styles.countOver : styles.count}>
        {over && "! "}
        {planned} / {budgetLabel(b).replace(" — ", "—")}
        <span className={styles.sr}> shots planned, budget {budgetLabel(b)}</span>
      </span>
    </div>
  );
}

// ─── By location (S2) ─────────────────────────────────────────────────────────

interface RowProps {
  project: Project;
  numbers: Map<Id, number>;
  fresh: Id | null;
  onToggle: (id: Id) => void;
  tf: TimeFormat;
}

function ByLocation(props: RowProps) {
  const { project, tf } = props;
  const multi = project.days.length > 1;
  const days = multi ? [...project.days].sort((a, b) => a.index - b.index) : [undefined];
  const byOrder = (a: Shot, b: Shot) => a.order - b.order;
  const required = project.shots.filter((s) => s.required);
  const clients = [...new Set(required.map((s) => s.required!.client))];
  const notRequired = project.shots.filter((s) => !s.required);
  const locationIds = new Set(project.locations.map((l) => l.id));

  return (
    <div className={styles.list}>
      {/* Pinned above every location, in both views (§5.7). */}
      {clients.map((client) => (
        <section key={client} aria-label={`Required — ${client}`}>
          <h2 className={styles.requiredBand}>REQUIRED — {client.toUpperCase()}</h2>
          {required.filter((s) => s.required!.client === client).map((s) => (
            <ShotRow key={s.id} shot={s} {...props} />
          ))}
        </section>
      ))}

      {days.map((d) => {
        const dayId = d?.id;
        const locations = multi ? runningOrder(project, dayId) : runningOrder(project);
        const inDay = notRequired.filter((s) => (multi ? dayOfShot(project, s) === dayId : true));
        const unplaced = inDay.filter((s) => !s.locationId || !locationIds.has(s.locationId)).sort(byOrder);
        return (
          <section key={dayId ?? "all"} aria-label={d ? `Day ${d.index}` : undefined}>
            {d && (
              <h2 className={styles.dayBand}>
                DAY {d.index}
                {d.date ? ` · ${shortDate(d.date)}` : ""}
              </h2>
            )}
            {locations.map((l) => (
              <LocationGroup key={l.id} location={l} shots={inDay.filter((s) => s.locationId === l.id).sort(byOrder)} {...props} tf={tf} />
            ))}
            {unplaced.length > 0 && (
              <>
                <h3 className={styles.band}>
                  <span>UNPLACED</span>
                </h3>
                {unplaced.map((s) => (
                  <ShotRow key={s.id} shot={s} {...props} />
                ))}
              </>
            )}
            {d && locations.length === 0 && unplaced.length === 0 && (
              <p className={styles.emptyDay}>
                Nothing planned for this day yet.{" "}
                <Link href={`/location/new?id=${project.id}&day=${dayId}`} className={styles.inlineLink}>
                  + LOCATION
                </Link>
              </p>
            )}
          </section>
        );
      })}

      {/* Shots whose day no longer exists, on a multi-day project. */}
      {multi &&
        (() => {
          const dayIds = new Set(project.days.map((x) => x.id));
          const loose = notRequired.filter((s) => {
            const d = dayOfShot(project, s);
            return d === undefined || !dayIds.has(d);
          });
          if (loose.length === 0) return null;
          return (
            <section aria-label="No day">
              <h3 className={styles.band}>
                <span>NO DAY</span>
              </h3>
              {loose.sort(byOrder).map((s) => (
                <ShotRow key={s.id} shot={s} {...props} />
              ))}
            </section>
          );
        })()}
    </div>
  );
}

function LocationGroup({ location, shots, ...props }: RowProps & { location: Location; shots: Shot[] }) {
  return (
    <>
      <h3 className={styles.bandWrap}>
        <Link href={`/location/edit?id=${props.project.id}&loc=${location.id}`} className={styles.bandLink}>
          <span className={styles.bandName}>{location.name.toUpperCase()}</span>
          <span className={styles.bandTime}>
            {location.startTime !== undefined ? formatClock(location.startTime, props.tf) : ""}
            <span aria-hidden="true"> ›</span>
            <span className={styles.sr}> — edit location</span>
          </span>
        </Link>
      </h3>
      {shots.length === 0 ? (
        <p className={styles.emptyLocation}>
          No shots here yet.{" "}
          <Link href={`/shot/new?id=${props.project.id}&loc=${location.id}`} className={styles.inlineLink}>
            + ADD SHOT
          </Link>
        </p>
      ) : (
        shots.map((s) => <ShotRow key={s.id} shot={s} {...props} />)
      )}
    </>
  );
}

// ─── By beat (P3) ─────────────────────────────────────────────────────────────

function ByBeat(props: RowProps) {
  const { project } = props;
  const groups = shotsByBeat(project);
  const byId = new Map(project.shots.map((s) => [s.id, s]));
  const byNumber = (a: Id, b: Id) => (props.numbers.get(a) ?? 0) - (props.numbers.get(b) ?? 0);
  const required = project.shots.filter((s) => s.required);

  return (
    <div className={styles.list}>
      {required.length > 0 && (
        <section aria-label="Required">
          <h2 className={styles.requiredBand}>REQUIRED</h2>
          {required.map((s) => (
            <ShotRow key={s.id} shot={s} {...props} />
          ))}
        </section>
      )}
      {ROLES.map((role) => {
        const ids = groups[role].sort(byNumber);
        return (
          <section key={role} aria-label={beatLabel(project.format, role)}>
            <h2 className={styles.band}>
              <span>{beatLabel(project.format, role)}</span>
              <span className={styles.bandTime}>{String(ids.length).padStart(2, "0")}</span>
            </h2>
            {ids.length === 0 ? (
              <p className={styles.emptyLocation}>
                Nothing here yet — this is the one people remember.{" "}
                <Link href={`/shot/new?id=${project.id}&beat=${role}`} className={styles.inlineLink}>
                  + ADD
                </Link>
              </p>
            ) : (
              ids.map((id) => <ShotRow key={id} shot={byId.get(id)!} {...props} />)
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── A row (§7 Shot row) ──────────────────────────────────────────────────────

function ShotRow({ shot, project, numbers, fresh, onToggle }: RowProps & { shot: Shot }) {
  const exposed = shot.status === "exposed";
  const dropped = shot.status === "dropped";
  const n = numbers.get(shot.id);
  const meta = [shot.lens?.toUpperCase(), shot.support ? supportLabel(shot.support) : undefined].filter(Boolean).join(" · ");
  const muted = exposed || dropped;

  return (
    <div className={muted ? `${styles.row} ${styles.done}` : styles.row}>
      <Link href={`/shot?id=${project.id}&shot=${shot.id}`} className={styles.rowLink}>
        <span className={styles.no}>{shot.required ? <RequiredMark /> : n !== undefined ? formatShotNumber(n) : ""}</span>
        <span className={styles.size}>{shot.size}</span>
        <span className={styles.stack}>
          <span className={muted ? styles.subjectDone : styles.subject}>{shot.subject}</span>
          {shot.flagNote && !exposed ? (
            // A flag is a line, not a status (§4.4).
            <span className={styles.flag}>! {shot.flagNote.toUpperCase()}</span>
          ) : (
            meta && <span className={styles.meta}>{meta}</span>
          )}
        </span>
      </Link>
      <button
        type="button"
        className={styles.status}
        aria-pressed={exposed}
        aria-label={`${shot.subject}: ${exposed ? "exposed" : "not shot yet"}. Tap to mark ${exposed ? "not shot" : "exposed"}.`}
        onClick={() => onToggle(shot.id)}
        disabled={dropped}
      >
        <StatusMark exposed={exposed} fresh={fresh === shot.id} />
      </button>
    </div>
  );
}

// ─── Empty list (E5) ──────────────────────────────────────────────────────────

function EmptyList({ project }: { project: Project }) {
  const b = projectBudget(project);
  const routes: { href?: string; title: string; line: string; soon: boolean }[] = [
    {
      title: "Suggest from your brief",
      line: "Write a line or three about the day. Best results — it picks up brand deliverables, the light, the mood.",
      soon: true,
    },
    {
      title: "Suggest from your format",
      line: "Shots that suit this kind of video and its length, with no brief needed.",
      soon: true,
    },
    {
      href: `/shot/new?id=${project.id}`,
      title: "Add one by hand",
      line: "You already know the shot. Type it and move on.",
      soon: false,
    },
  ];

  return (
    <div className={styles.empty}>
      <p className={styles.emptyLead}>
        Nothing on the list yet. Three ways in. The first one gives the best results, because it knows what today actually is.
      </p>
      <ol className={styles.routes}>
        {routes.map((r, i) => (
          <li key={r.title}>
            {r.soon ? (
              // Suggestions arrive with the brief (M4); the route is shown so the page reads as designed.
              <div className={styles.route}>
                <span className={styles.routeNo}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.routeText}>
                  <span className={styles.routeTitleMuted}>{r.title}</span>
                  <span className={styles.routeLine}>{r.line}</span>
                  <span className={styles.routeSoon}>COMING IN THE NEXT BUILD</span>
                </span>
              </div>
            ) : (
              <Link href={r.href!} className={styles.route}>
                <span className={styles.routeNo}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.routeText}>
                  <span className={styles.routeTitle}>{r.title}</span>
                  <span className={styles.routeLine}>{r.line}</span>
                </span>
                <span aria-hidden="true" className={styles.chevron}>
                  ›
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
      <div className={styles.alt}>
        <p className={styles.altText}>Planning by place instead? Start with a location and hang shots off it.</p>
        <Link href={`/location/new?id=${project.id}`} className={ui.secondary}>
          + LOCATION
        </Link>
      </div>
      <p className={styles.emptyFoot}>
        {capitalise(cutPhrase(project.format))} wants roughly {b.min} to {b.max} shots. The counter above fills as you add them.
      </p>
    </div>
  );
}

