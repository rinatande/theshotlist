"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Choice } from "@/components/Choice";
import { RequiredMark } from "@/components/Marks";
import { NotHere } from "@/components/NotHere";
import ui from "@/components/ui.module.css";
import { db } from "@/lib/db";
import {
  applyWrap,
  currentDay,
  defaultPlan,
  lastDayMissedSentence,
  undecided,
  wrapSentence,
  wrapView,
  type FlagChoice,
  type MissChoice,
  type WrapPlan,
  type WrapView,
} from "@/lib/shoot";
import type { Day, Id, Project, Shot } from "@/lib/types";
import { saveProject, useProject } from "@/lib/useProject";
import { useNightLock } from "@/lib/useShoot";
import { capitalise, inWords } from "@/lib/words";
import styles from "./Wrap.module.css";

/**
 * W1–W3: wrap closes a day, never a project (§5.12). It isn't a completion
 * screen — the count is stated plainly and tied to the cut. Nothing is
 * deleted, and nothing happens until WRAP.
 */
function WrapScreen() {
  const { project } = useProject();
  useNightLock();
  if (project === undefined) return <div className={ui.screen} aria-busy="true" />;
  if (project === null) return <NotHere href="/" label="← PROJECTS" />;
  const day = currentDay(project);
  const view = day && wrapView(project, day.id);
  if (!day || !view) return <NotHere href={`/project?id=${project.id}`} label="← SHOT LIST" />;
  return <Wrapping key={`${project.id}:${day.id}`} project={project} view={view} />;
}

function Wrapping({ project, view }: { project: Project; view: WrapView }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<WrapPlan>(() => defaultPlan(view));
  const [choosing, setChoosing] = useState<Shot | null>(null);

  // The list can change under the screen; anything new falls back to the default.
  const base = defaultPlan(view);
  const plan: WrapPlan = {
    flagged: Object.fromEntries(view.flagged.map((s) => [s.id, chosen.flagged[s.id]])),
    missed: Object.fromEntries(view.missed.map((s) => [s.id, chosen.missed[s.id] ?? base.missed[s.id]])),
  };
  const open = undecided(plan);
  const next = view.later[0];
  const blocked = view.outstanding.length > 0;
  const multi = view.dayCount > 1;
  const shoot = `/shoot?id=${project.id}`;

  const setFlag = (id: Id, c: FlagChoice) => setChosen((p) => ({ ...p, flagged: { ...p.flagged, [id]: c } }));
  const setMiss = (ids: Id[], c: MissChoice) => setChosen((p) => ({ ...p, missed: { ...p.missed, ...Object.fromEntries(ids.map((id) => [id, c])) } }));

  const wrap = async () => {
    const latest = (await db.projects.get(project.id)) ?? project;
    await saveProject(applyWrap(latest, view.day.id, plan));
    router.replace(`/project?id=${project.id}`);
  };

  const dayName = (id: MissChoice) => (id === "drop" ? "DROP" : `DAY ${view.later.find((d) => d.id === id)?.index}`);
  const bulk = (() => {
    const values = new Set(view.missed.map((s) => plan.missed[s.id]));
    if (values.size !== 1) return undefined;
    const [v] = values;
    return v === "drop" ? "drop" : v === next?.id ? "move" : undefined;
  })();

  const undecidedLine = open > 0 ? (open === 1 ? "Decide the flagged shot first." : `Decide the ${inWords(open)} flagged shots first.`) : undefined;

  return (
    <div className={`${ui.screen} ${styles.screen}`}>
      <header className={styles.top}>
        <Link href={shoot} className={styles.back}>
          ← SHOOT MODE
        </Link>
        <h1 className={styles.title}>{multi ? `WRAP · DAY ${view.day.index} OF ${view.dayCount}` : "WRAP"}</h1>
      </header>

      <div className={styles.head}>
        <p className={styles.count} aria-label={`${view.exposed} of ${view.total} exposed today`}>
          <span className={styles.got}>{String(view.exposed).padStart(2, "0")}</span>
          <span className={styles.of}>/{String(view.total).padStart(2, "0")}</span>
        </p>
        <span className={styles.countLabel}>EXPOSED TODAY</span>
        <p className={styles.sentence}>{wrapSentence(project, view)}</p>
      </div>

      {/* W2: the outstanding deliverable is pinned above everything else. */}
      {view.clients
        .filter((c) => c.outstanding.length > 0)
        .map((c) => (
          <section key={c.client} className={styles.outstanding} aria-label={`${c.client}: ${c.outstanding.length} outstanding`}>
            <h2 className={styles.clientWarn}>
              <span>{c.client.toUpperCase()}</span>
              <span>{c.outstanding.length} OUTSTANDING</span>
            </h2>
            <ul className={styles.rows}>
              {c.outstanding.map((s) => (
                <li key={s.id} className={styles.contracted}>
                  <span className={styles.warnMark}>
                    <RequiredMark label={`Required for ${c.client}`} />
                  </span>
                  <span className={styles.subject}>{s.subject}</span>
                  <span className={styles.tag}>CONTRACTED</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {view.clients
        .filter((c) => c.outstanding.length === 0)
        .map((c) => (
          <div key={c.client} className={styles.delivered}>
            <span className={styles.clientName}>{c.client.toUpperCase()}</span>
            <span className={styles.deliveredCount}>
              <RequiredMark label="Required shots" /> {c.delivered} / {c.total} DELIVERED
            </span>
          </div>
        ))}

      {view.flagged.length > 0 && (
        <section aria-labelledby="flagged">
          <h2 id="flagged" className={styles.band}>
            <span>FLAGGED</span>
            <span>{String(view.flagged.length).padStart(2, "0")}</span>
          </h2>
          <ul className={styles.rows}>
            {view.flagged.map((s) => (
              <li key={s.id} className={styles.flagRow}>
                <div className={styles.line}>
                  <span className={styles.size}>{s.size}</span>
                  <span className={styles.stack}>
                    <span className={styles.subject}>{s.subject}</span>
                    <span className={styles.flag}>! {(s.flagNote ?? "Flagged").toUpperCase()}</span>
                  </span>
                </div>
                <Choice
                  label={`What happens to ${s.subject}`}
                  hideLabel
                  options={
                    next
                      ? [
                          { value: "reshoot", label: "RESHOOT TOMORROW" },
                          { value: "accept", label: "ACCEPT AS IS" },
                        ]
                      : [
                          { value: "accept", label: "ACCEPT AS IS" },
                          { value: "drop", label: "DROP" },
                        ]
                  }
                  value={plan.flagged[s.id]}
                  onChange={(c) => setFlag(s.id, c as FlagChoice)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.missed.length > 0 && (
        <section aria-labelledby="missed">
          <h2 id="missed" className={styles.band}>
            <span>NOT SHOT</span>
            <span>{String(view.missed.length).padStart(2, "0")}</span>
          </h2>
          {view.last ? (
            <LastDayMissed project={project} view={view} shoot={shoot} />
          ) : (
            <>
              <div className={styles.bulk}>
                <div className={styles.bulkRow}>
                  <span className={styles.all}>ALL {view.missed.length}</span>
                  <Choice
                    label={`Every shot not shot today`}
                    hideLabel
                    options={[
                      { value: "move", label: `MOVE TO DAY ${next!.index}` },
                      { value: "drop", label: "DROP" },
                    ]}
                    value={bulk}
                    onChange={(v) =>
                      setMiss(
                        view.missed.map((s) => s.id),
                        v === "drop" ? "drop" : next!.id,
                      )
                    }
                  />
                </div>
                <p className={ui.hint}>Sets every shot below. Tap one to change just that shot.</p>
              </div>
              <ul className={styles.rows}>
                {view.missed.map((s) => (
                  <li key={s.id} className={styles.missRow}>
                    <span className={s.required ? styles.sizeWarn : styles.size}>{s.size}</span>
                    <span className={styles.subject}>{s.subject}</span>
                    <button type="button" className={s.required ? styles.whereWarn : styles.where} onClick={() => setChoosing(s)}>
                      {s.required && (
                        <>
                          <RequiredMark label={`Required for ${s.required.client}`} />{" "}
                        </>
                      )}
                      {dayName(plan.missed[s.id])} ›<span className={styles.sr}> — change where {s.subject} goes</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {!view.last && (
        <p className={styles.foot}>
          {view.flagged.length + view.missed.length > 0
            ? view.exposed > 0
              ? `The other ${inWords(view.exposed)} ${view.exposed === 1 ? "is" : "are"} marked and need${view.exposed === 1 ? "s" : ""} nothing. `
              : ""
            : `${capitalise(view.exposed === 1 ? "the one shot is" : `all ${inWords(view.exposed)} are`)} marked. `}
          Wrapping locks nothing — you can reopen the day.
        </p>
      )}

      <div className={`${ui.footer} ${styles.footer}`}>
        {undecidedLine && (
          <p className={ui.hint} id="wrap-why">
            {undecidedLine}
          </p>
        )}
        {blocked ? (
          <>
            <p className={styles.blockedLine}>
              {view.outstanding.length === 1
                ? "One contracted shot isn't in the can, so the day doesn't wrap clean."
                : `${capitalise(inWords(view.outstanding.length))} contracted shots aren't in the can, so the day doesn't wrap clean.`}
            </p>
            <Link href={`${shoot}&shot=${view.outstanding[0].id}`} className={styles.shootNow}>
              SHOOT IT NOW
            </Link>
            <WrapButton label="WRAP ANYWAY — I'LL TELL THEM" secondary disabled={open > 0} onWrap={wrap} />
            <p className={styles.small}>
              It stays <RequiredMark /> and the project keeps showing it outstanding.
            </p>
          </>
        ) : (
          <WrapButton
            label={view.last ? (multi ? `WRAP DAY ${view.day.index} · END SHOOT` : "WRAP") : `WRAP DAY ${view.day.index}`}
            disabled={open > 0}
            onWrap={wrap}
          />
        )}
      </div>

      {choosing && (
        <MissSheet
          shot={choosing}
          later={view.later}
          value={plan.missed[choosing.id]}
          onClose={() => setChoosing(null)}
          onChoose={(c) => {
            setMiss([choosing.id], c);
            setChoosing(null);
          }}
        />
      )}
    </div>
  );
}

function WrapButton({ label, disabled, secondary, onWrap }: { label: string; disabled: boolean; secondary?: boolean; onWrap: () => void }) {
  if (disabled)
    return (
      <button type="button" className={ui.disabled} aria-disabled="true" aria-describedby="wrap-why">
        {label}
      </button>
    );
  return (
    <button type="button" className={secondary ? ui.secondary : styles.wrapButton} onClick={onWrap}>
      {label}
    </button>
  );
}

/** W3: no chips — MOVE has nowhere to go, and one chip is a confirmation dressed as a choice (§5.12). */
function LastDayMissed({ project, view, shoot }: { project: Project; view: WrapView; shoot: string }) {
  const { text, short } = lastDayMissedSentence(project, view);
  return (
    <>
      <p className={styles.lastLine}>{text}</p>
      <ul className={styles.rows}>
        {view.missed.map((s) => (
          <li key={s.id} className={styles.lastRow}>
            <span className={styles.size}>{s.size}</span>
            <span className={styles.stack}>
              <span className={styles.subject}>{s.subject}</span>
              {(s.flagNote || s.note) && <span className={styles.note}>{s.flagNote || s.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      <dl className={styles.legend}>
        <div className={styles.legendRow}>
          <dt className={styles.legendKey}>DROP</dt>
          <dd className={styles.legendText}>Leaves the count, but stays struck through in today&apos;s record. Get one after all? Un-drop it from there.</dd>
        </div>
        <div className={styles.legendRow}>
          <dt className={styles.legendKeyAccent}>WANT ONE</dt>
          <dd className={styles.legendText}>
            {short ? (
              <Link href={shoot} className={ui.secondary}>
                GO BACK AND SHOOT ONE
              </Link>
            ) : (
              <>
                <Link href={shoot} className={styles.inline}>
                  Go back and shoot it ›
                </Link>{" "}
                before you wrap.
              </>
            )}
          </dd>
        </div>
      </dl>
    </>
  );
}

/** One shot at a time: any later day, or drop. The bulk chip always means the next day (Rina, 22 Sep). */
function MissSheet({ shot, later, value, onClose, onChoose }: { shot: Shot; later: Day[]; value: MissChoice; onClose: () => void; onChoose: (c: MissChoice) => void }) {
  const options: { value: MissChoice; label: string; line: string }[] = [
    ...later.map((d) => ({ value: d.id, label: `DAY ${d.index}`, line: "Onto that day's list, unplaced, still [ ]." })),
    { value: "drop", label: "DROP", line: "Out of the count, kept in today's record. Un-drop it from there." },
  ];
  return (
    <BottomSheet title={shot.subject.toUpperCase()} onClose={onClose}>
      <ul className={styles.sheetList}>
        {options.map((o) => (
          <li key={o.value}>
            <button type="button" className={styles.sheetRow} aria-current={o.value === value ? "true" : undefined} onClick={() => onChoose(o.value)}>
              <span className={styles.sheetLabel}>
                {o.label}
                {o.value === value && <span className={styles.sheetNow}> · NOW</span>}
              </span>
              <span className={ui.hint}>{o.line}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

export default function WrapPage() {
  return (
    <Suspense>
      <WrapScreen />
    </Suspense>
  );
}
