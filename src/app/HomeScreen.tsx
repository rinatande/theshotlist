"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AppTop, Dock } from "@/components/AppFrame";
import { RequiredMark } from "@/components/Marks";
import { ProjectRow } from "@/components/ProjectRow";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import { gettingReady, greeting, homeCase, inDays, longDate, shortWeekdayDate, todayView, whenViewed, type ReadyItem } from "@/lib/home";
import { formatLine } from "@/lib/labels";
import { readLastViewed, type LastViewed } from "@/lib/lastViewed";
import { rememberInvite } from "@/lib/readClient";
import { todayIso } from "@/lib/status";
import { formatClock, readTimeFormat, type TimeFormat } from "@/lib/timeFormat";
import type { Day, IsoDate, Kit, Project } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { useNow } from "@/lib/useShoot";
import styles from "./Home.module.css";

/**
 * Home (H1–H4): a greeting, the date, and one card chosen by the situation —
 * today's shoot, a shoot coming up, or the project you were last in. With no
 * projects it's the three ways in. Everything is read off the phone, so it
 * all works with no signal.
 */
export function HomeScreen() {
  const data = useLive(async () => ({ projects: await db.projects.toArray(), kits: await db.kits.toArray() }), []);
  const now = useNow();
  const [tf, setTf] = useState<TimeFormat>("12h");
  const [last, setLast] = useState<LastViewed>();

  // An invite link (/?invite=acme) gives a job application's reviewer more full reads.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) {
      rememberInvite(code);
      window.history.replaceState(null, "", "/");
    }
    // Both live in localStorage, which the server render can't see.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTf(readTimeFormat());
    setLast(readLastViewed());
  }, []);

  if (!data) return <div className={ui.screen} aria-busy="true" />;

  const today = todayIso(now);
  const home = homeCase(data.projects, today, last?.id);
  // On a shoot day the clock matters, so it joins the date (H4).
  const clock = home.kind === "today" ? ` · ${formatClock(now.getHours() * 60 + now.getMinutes(), tf)}` : "";

  return (
    <div className={ui.screen}>
      <AppTop>
        <h1 className={styles.greeting}>{greeting(now)}</h1>
        <span className={styles.date}>
          {longDate(now)}
          {clock}
        </span>
      </AppTop>

      <div className={styles.body}>
        {home.kind === "first-run" && <FirstRun />}
        {home.kind === "last-viewed" && (
          <LastViewedCard project={home.project} recent={home.recent} today={today} viewed={last?.id === home.project.id ? last.on : undefined} />
        )}
        {home.kind === "coming-up" && <ComingUp project={home.project} day={home.day} date={home.date} later={home.later} today={today} tf={tf} />}
        {home.kind === "today" && <Today project={home.project} day={home.day} kits={data.kits} tf={tf} />}
      </div>

      <Dock current="home" />
    </div>
  );
}

/** H1: nothing yet. Sign-in (route 03 on the board) waits for sync (Rina, 25 Sep). */
function FirstRun() {
  return (
    <>
      <p className={styles.lede}>Nothing here yet. Two ways in — the first is where everything else starts.</p>
      <ol className={styles.routes}>
        <li>
          <Link href="/new" className={styles.route}>
            <span className={styles.routeNoAccent}>01</span>
            <span className={styles.routeText}>
              <span className={styles.routeTitle}>Start a project</span>
              <span className={styles.routeLine}>Name it, say what kind of video it is, and how long. The shot list, the light and the gear hang off it.</span>
            </span>
            <span className={styles.chevAccent} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/gear" className={styles.route}>
            <span className={styles.routeNo}>02</span>
            <span className={styles.routeText}>
              <span className={styles.routeTitle}>Add your gear</span>
              <span className={styles.routeLine}>Tell it what&apos;s in the bag once, and every list fits what you can actually shoot.</span>
            </span>
            <span className={styles.chev} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ol>
      <p className={styles.note}>Once a project has a date, this screen shows what&apos;s next — or what&apos;s today.</p>
    </>
  );
}

function Card({ label, right, children }: { label: string; right?: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-label={label}>
      <h2 className={styles.cardHead}>
        <span>{label}</span>
        {right && <span>{right}</span>}
      </h2>
      {children}
    </section>
  );
}

function ListBox({ label, projects, today }: { label: string; projects: Project[]; today: IsoDate }) {
  return (
    <section className={styles.listBox} aria-label={label}>
      <h2 className={styles.cardHead}>
        <span>{label}</span>
        <span>{projects.length}</span>
      </h2>
      <ul className={styles.plain}>
        {projects.map((p) => (
          <li key={p.id} className={styles.listItem}>
            <ProjectRow project={p} today={today} boxed />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "HIGASHIYAMA · TRAVEL / SILENT · REEL · 9:16" */
const metaLine = (p: Project) => [p.where?.toUpperCase(), formatLine(p.format)].filter(Boolean).join(" · ");

/** H2: nothing dated soon, so the project you were last in. */
function LastViewedCard({ project, recent, today, viewed }: { project: Project; recent: Project[]; today: IsoDate; viewed?: IsoDate }) {
  return (
    <>
      <Card label="PICK UP WHERE YOU LEFT OFF" right={viewed ? whenViewed(today, viewed) : undefined}>
        <ProjectRow project={project} today={today} boxed />
        {project.shots.length === 0 && (
          <div className={styles.nudge}>
            <span className={styles.nudgeText}>No list yet. Write the brief and generate one — that needs signal.</span>
            <Link href={`/brief?id=${project.id}`} className={styles.inlineLink}>
              WRITE THE BRIEF ›
            </Link>
          </div>
        )}
      </Card>
      <div className={styles.quiet}>
        <span className={styles.quietHead}>NOTHING SCHEDULED</span>
        <span className={styles.note}>No shoot has a date in the next two weeks. Give a project a start date and it shows up here.</span>
      </div>
      {recent.length > 0 && <ListBox label="RECENT" projects={recent} today={today} />}
      <Link href="/new" className={ui.secondary}>
        + NEW PROJECT
      </Link>
    </>
  );
}

/** Where each unticked GETTING READY line is done. */
function readyLink(p: Project, item: ReadyItem): { href: string; label: string } {
  switch (item.key) {
    case "brief":
      return { href: `/brief?id=${p.id}`, label: "WRITE ›" };
    case "list":
      return { href: `/brief?id=${p.id}`, label: "GENERATE ›" };
    case "light":
      return { href: `/project/edit?id=${p.id}`, label: "ADD WHERE ›" };
    case "gear":
      return p.gear.length ? { href: `/project?id=${p.id}&tab=gear`, label: "PACK ›" } : { href: `/gear/shoot?id=${p.id}`, label: "CHOOSE ›" };
  }
}

/** H3: the next dated shoot, and what's left to get ready for it. */
function ComingUp({ project, day, date, later, today, tf }: { project: Project; day: Day; date: IsoDate; later: Project[]; today: IsoDate; tf: TimeFormat }) {
  const items = gettingReady(project, day, tf);
  const done = items.filter((i) => i.done).length;
  const listDone = items.find((i) => i.key === "list")!.done;
  const multi = project.days.length > 1;
  return (
    <>
      <Card label={`NEXT SHOOT · ${inDays(today, date)}`} right={shortWeekdayDate(date)}>
        <div className={styles.titleBlock}>
          <span className={styles.projectName}>{project.name}</span>
          <span className={styles.meta}>{[multi ? `DAY ${day.index} OF ${project.days.length}` : undefined, metaLine(project)].filter(Boolean).join(" · ")}</span>
        </div>
        <h3 className={styles.subHead}>
          <span>GETTING READY</span>
          <span>
            {done} OF {items.length}
          </span>
        </h3>
        <ul className={styles.plain}>
          {items.map((item) => {
            const link = item.done ? undefined : readyLink(project, item);
            return (
              <li key={item.key} className={styles.check}>
                <span className={item.done ? styles.tickOk : styles.tick}>
                  {item.done ? "[✓]" : "[ ]"}
                  <span className={ui.visuallyHidden}>{item.done ? " done" : " not yet"}</span>
                </span>
                <span className={styles.checkText}>
                  <span className={styles.checkLabel}>{item.label}</span>
                  {item.detail && <span className={styles.checkDetail}>{item.detail}</span>}
                </span>
                {link && (
                  <Link href={link.href} className={styles.inlineLink}>
                    {link.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {!listDone && (
          <p className={styles.signal}>Generating needs signal. Do it before you go — once the list is on the phone, the shoot works offline.</p>
        )}
        <div className={styles.cardAction}>
          <Link href={`/project?id=${project.id}`} className={ui.primary}>
            OPEN {project.name.toUpperCase()}
          </Link>
        </div>
      </Card>
      {later.length > 0 && <ListBox label="LATER" projects={later} today={today} />}
    </>
  );
}

/** H4: shooting today. The card is the way into shoot mode. */
function Today({ project, day, kits, tf }: { project: Project; day: Day; kits: Kit[]; tf: TimeFormat }) {
  const v = todayView(project, day, tf);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fill = v.total ? Math.round((v.exposed / v.total) * 100) : 0;
  const packed = project.gear.filter((g) => project.packedIds.includes(g.id)).length;
  const kit = kits.find((k) => k.id === project.kitId)?.name ?? "This shoot's gear";
  const allPacked = packed === project.gear.length;
  return (
    <>
      <Card label="SHOOTING TODAY" right={project.days.length > 1 ? `DAY ${day.index} OF ${project.days.length}` : undefined}>
        <div className={styles.titleBlock}>
          <span className={styles.projectName}>{project.name}</span>
          <span className={styles.meta}>{metaLine(project)}</span>
        </div>
        <dl className={styles.facts}>
          {v.firstUp && <Fact label="FIRST UP">{v.firstUp}</Fact>}
          {v.light && <Fact label="LIGHT">{v.light}</Fact>}
          {v.clients.map((c) => (
            <Fact key={c.client} label={`FOR ${c.client.toUpperCase()}`}>
              <RequiredMark label={`Required for ${c.client}`} />{" "}
              {c.left === 0 ? `All ${c.of} got` : `${c.left} of ${c.of} still to get`}
            </Fact>
          ))}
          <div className={styles.factMeter}>
            <dt className={styles.factLabel}>TODAY</dt>
            <dd className={styles.meterValue}>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${fill}%` }} />
              </span>
              <span className={v.exposed > 0 ? styles.countOk : styles.count}>
                <span className={ui.visuallyHidden}>Exposed </span>
                {pad(v.exposed)}/{pad(v.total)}
              </span>
            </dd>
          </div>
        </dl>
        <div className={styles.shootActions}>
          <Link href={`/shoot?id=${project.id}`} className={styles.shoot}>
            START SHOOT MODE
          </Link>
          <Link href={`/project?id=${project.id}`} className={styles.todayList}>
            SEE TODAY&apos;S LIST ›
          </Link>
        </div>
      </Card>
      {project.gear.length > 0 && (
        <Link href={`/project?id=${project.id}&tab=gear`} className={styles.bag}>
          <span className={styles.factLabel}>IN THE BAG</span>
          <span className={styles.bagText}>
            {kit} · {packed} of {project.gear.length}
          </span>
          <span className={allPacked ? styles.tickOk : styles.tick}>
            {allPacked ? "[✓]" : "[ ]"}
            <span className={ui.visuallyHidden}>{allPacked ? " all packed" : " not all packed"}</span>
          </span>
        </Link>
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}
