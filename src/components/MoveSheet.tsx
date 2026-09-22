"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { runningOrder } from "@/lib/runningOrder";
import { addLocation, dayOfShot, moveShots } from "@/lib/shots";
import { formatClock, type TimeFormat } from "@/lib/timeFormat";
import type { Id, Project, Shot } from "@/lib/types";
import { saveProject } from "@/lib/useProject";
import { BottomSheet } from "./BottomSheet";
import { Choice } from "./Choice";
import styles from "./MoveSheet.module.css";
import ui from "./ui.module.css";

interface Props {
  project: Project;
  ids: Id[];
  tf: TimeFormat;
  onClose: () => void;
  onMoved: () => void;
}

/**
 * Where the selected shots go: a location, a day's UNPLACED, or a new
 * location named right here — so shots generated before any location
 * existed can be placed in one go (design.md §10, 23).
 */
export function MoveSheet({ project, ids, tf, onClose, onMoved }: Props) {
  const multi = project.days.length > 1;
  const days = multi
    ? [...project.days].sort((a, b) => a.index - b.index)
    : [undefined];
  const [name, setName] = useState("");
  const [newDay, setNewDay] = useState<Id | undefined>(days[0]?.id);
  const n = ids.length;

  const known = new Set(project.locations.map((l) => l.id));
  const isIn = (s: Shot, locationId?: Id, dayId?: Id) =>
    locationId
      ? s.locationId === locationId
      : (!s.locationId || !known.has(s.locationId)) &&
        (!multi || dayOfShot(project, s) === dayId);
  const count = (locationId?: Id, dayId?: Id) =>
    project.shots.filter((s) => isIn(s, locationId, dayId)).length;
  // A place every picked shot is already in isn't somewhere to move to.
  const picked = project.shots.filter((s) => ids.includes(s.id));
  const already = (locationId?: Id, dayId?: Id) =>
    picked.length > 0 && picked.every((s) => isIn(s, locationId, dayId));
  const shots = (k: number) =>
    k === 0 ? "Empty" : k === 1 ? "1 shot" : `${k} shots`;

  const move = async (
    target: { locationId?: Id; dayId?: Id } | { name: string; dayId?: Id },
  ) => {
    // Re-read first, so nothing saved since the list was drawn is lost.
    let p = (await db.projects.get(project.id)) ?? project;
    let place: { locationId?: Id; dayId?: Id };
    if ("name" in target) {
      const [q, id] = addLocation(p, {
        name: target.name,
        dayId: target.dayId,
      });
      p = q;
      place = { locationId: id };
    } else place = target;
    await saveProject(moveShots(p, ids, place));
    onMoved();
  };

  return (
    <BottomSheet
      title={`MOVE ${n} ${n === 1 ? "SHOT" : "SHOTS"} TO`}
      onClose={onClose}
    >
      <div className={styles.scroll}>
        {days.map((d) => (
          <section
            key={d?.id ?? "all"}
            aria-label={d ? `Day ${d.index}` : undefined}
          >
            {d && <h3 className={styles.day}>DAY {d.index}</h3>}
            <ul className={styles.list}>
              {runningOrder(project, d?.id)
                .filter((l) => !already(l.id))
                .map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => move({ locationId: l.id })}
                    >
                      <span className={styles.name}>{l.name}</span>
                      <span className={ui.hint}>
                        {l.startTime !== undefined
                          ? `${formatClock(l.startTime, tf)} · `
                          : ""}
                        {shots(count(l.id))}
                      </span>
                    </button>
                  </li>
                ))}
              {!already(undefined, d?.id) && (
                <li>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => move({ dayId: d?.id })}
                  >
                    <span className={styles.name}>Unplaced</span>
                    <span className={ui.hint}>
                      No location · {shots(count(undefined, d?.id))}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}

        <form
          className={styles.new}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim())
              move({ name: name.trim(), dayId: multi ? newDay : undefined });
          }}
        >
          <div className={ui.field}>
            <label htmlFor="move-new" className={ui.label}>
              OR A NEW LOCATION
            </label>
            <input
              id="move-new"
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kitchen counter"
              autoComplete="off"
            />
            <p className={ui.hint}>
              Just a name for now. Add a start time or a place from the list
              later.
            </p>
          </div>
          {multi && (
            <Choice
              label="ON WHICH DAY"
              options={days.map((d) => ({
                value: d!.id,
                label: `DAY ${d!.index}`,
              }))}
              value={newDay}
              onChange={setNewDay}
            />
          )}
          {name.trim() ? (
            <button type="submit" className={ui.primary}>
              MOVE TO {name.trim().toUpperCase()}
            </button>
          ) : (
            <button
              type="button"
              className={ui.disabled}
              aria-disabled="true"
              aria-describedby="move-new-why"
            >
              MOVE TO NEW LOCATION
            </button>
          )}
          {!name.trim() && (
            <p id="move-new-why" className={ui.hint}>
              Give it a name.
            </p>
          )}
        </form>
      </div>
    </BottomSheet>
  );
}
