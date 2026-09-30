import { PRESET_SECONDS } from "./budget";
import type { Angle, Audio, Budget, Format, Movement, Roll, ShotSize, ShotView, Support, Treatment } from "./types";

/**
 * What the app fills in for a new shot (design.md §5.13, §5.15): movement,
 * audio, angle and roll, worked out from what's already been chosen. The
 * person can override any of them; once they do, the form stops re-suggesting it.
 */

export const MOVEMENTS: { value: Movement; label: string }[] = [
  { value: "static", label: "STATIC" },
  { value: "slow-pan", label: "SLOW PAN" },
  { value: "push-in", label: "SLOW PUSH IN" },
  { value: "pull-back", label: "PULL BACK" },
  { value: "tracking", label: "TRACKING" },
  { value: "follow", label: "FOLLOW" },
  { value: "handheld", label: "HANDHELD" },
  { value: "reveal", label: "REVEAL" },
];

export const AUDIO: { value: Audio; label: string; hint: string }[] = [
  { value: "speech", label: "SPEECH", hint: "Someone talks on camera — check the mic is on before you roll." },
  { value: "natural", label: "NATURAL SOUND", hint: "No talking, but record what's there. It's what makes the cut feel like the place." },
  { value: "none", label: "NO SOUND", hint: "Music or voice-over goes over this one. No need to record." },
];

export const SUPPORTS: { value: Support; label: string }[] = [
  { value: "handheld", label: "HANDHELD" },
  { value: "tripod", label: "TRIPOD" },
  { value: "gimbal", label: "GIMBAL" },
];

export const ANGLES: { value: Angle; label: string; hint: string }[] = [
  { value: "top-down", label: "TOP-DOWN", hint: "Straight down, flat — pattern and layout, tidy and graphic." },
  { value: "high", label: "HIGH", hint: "Above, looking down — how you see things standing over them. Where most POV sits." },
  { value: "eye-level", label: "EYE LEVEL", hint: "At the person's eye height — neutral and human." },
  { value: "surface", label: "SURFACE", hint: "Just above the counter or table — objects loom, the background falls away." },
  { value: "low", label: "LOW", hint: "Below the subject, looking up — scale, presence, sky." },
];

export const VIEWS: { value: ShotView; label: string }[] = [
  { value: "pov", label: "POV" },
  { value: "ots", label: "OTS" },
];

export const ROLLS: { value: Roll; label: string; hint: string }[] = [
  { value: "6s", label: "6S+", hint: "Hold still. You'll use 2–3 seconds; the rest is room to cut." },
  { value: "10s", label: "10S+", hint: "Hold still. Wides are held longer in the cut." },
  { value: "15s", label: "15S+", hint: "Hold still and let it happen. Observational cuts use long takes." },
  { value: "move", label: "THE WHOLE MOVE + 2S", hint: "A clean start and a clean stop, with two seconds either side." },
  { value: "action", label: "START TO FINISH + 2S", hint: "Catch all of it and trim later." },
];

export const angleLabel = (a: Angle) => ANGLES.find((x) => x.value === a)!.label;
export const viewLabel = (v: ShotView) => VIEWS.find((x) => x.value === v)!.label;
export const rollLabel = (r: Roll) => ROLLS.find((x) => x.value === r)!.label;
export const movementLabel = (m: Movement) => MOVEMENTS.find((x) => x.value === m)!.label;
export const audioLabel = (a: Audio) => AUDIO.find((x) => x.value === a)!.label;
export const supportLabel = (s: Support) => SUPPORTS.find((x) => x.value === s)!.label;

const has = (subject: string, words: string[]) => {
  const s = subject.toLowerCase();
  return words.some((w) => new RegExp(`\\b${w}`).test(s));
};

const MOVING = ["walk", "follow", "through", "running", "run", "cycling", "riding", "tracking"];
const REVEAL = ["reveal", "door", "enter", "emerg", "unveil"];
const PULL = ["pull back", "pull-back", "pulls back", "drone"];
const VIEW = ["view", "skyline", "landscape", "vista", "horizon", "panorama", "across"];

export function suggestMovement(shot: { size: ShotSize; support?: Support; subject: string }, unattended = false): Movement {
  const { size, support, subject } = shot;
  // Nobody behind the camera: it can't move (Rina, 30 Sep).
  if (unattended) return "static";
  // Words in the subject say the most about what the shot is doing.
  if (has(subject, PULL)) return "pull-back";
  if (has(subject, REVEAL)) return "reveal";
  if (has(subject, MOVING)) return support === "tripod" ? "slow-pan" : support === "gimbal" ? "tracking" : "follow";

  if (support === "tripod") return size === "WS" && has(subject, VIEW) ? "slow-pan" : "static";
  if (support === "gimbal") return size === "INS" ? "static" : "push-in";
  // Handheld, or not chosen yet: hold still on the small stuff.
  return size === "INS" || size === "CU" ? "static" : "handheld";
}

const TALKING = ["to camera", "talk", "talking", "say", "says", "speak", "explain", "interview", "answer", "ask", "piece to camera", "intro"];

export function suggestAudio(shot: { size: ShotSize; subject: string }, treatment: Treatment): Audio {
  const talking = has(shot.subject, TALKING);
  switch (treatment) {
    case "talking-to-camera":
    case "interview":
      // Speech where a person is framed to talk; the cutaways still want the place.
      return talking || shot.size === "MS" || shot.size === "CU" ? "speech" : "natural";
    case "scripted":
      return talking ? "speech" : "natural";
    case "narrated":
      // The voice-over is recorded later; wides are worth the room sound under it.
      return talking ? "speech" : shot.size === "WS" ? "natural" : "none";
    case "silent":
      return "natural";
  }
}

const OVERHEAD = ["overhead", "top-down", "top down", "from above", "flat lay", "flat-lay", "bird's-eye", "birds-eye"];
/** Things laid flat — top-down only when the frame is close on them, not a wide with people. */
const LAID_OUT = ["latte art", "tray", "map", "spread", "layout", "plate"];
const BELOW = ["from below", "looking up", "low angle", "sky", "tower", "shopfront", "facade", "façade", "building", "tree", "spire", "towering"];
const FACE = ["face", "eyes", "smile", "expression", "portrait", "laugh", "looks at", "glance"];
const AERIAL = ["drone", "aerial"];

/**
 * ANGLE (§5.15): height only, measured against the subject. A POV is where
 * you stand, so HIGH. Words in the subject decide next, then size and
 * treatment — silent, observational work leans on SURFACE and TOP-DOWN for
 * the small stuff.
 */
export function suggestAngle(shot: { size: ShotSize; subject: string; view?: ShotView }, treatment: Treatment): Angle {
  const { size, subject, view } = shot;
  if (view === "pov") return "high";
  if (has(subject, OVERHEAD)) return "top-down";
  if ((size === "INS" || size === "CU") && has(subject, LAID_OUT)) return "top-down";
  if (has(subject, AERIAL)) return "high";
  if (has(subject, BELOW)) return "low";
  if (view === "ots" || has(subject, FACE)) return "eye-level";
  const observational = treatment === "silent";
  if (size === "INS") return observational ? "surface" : "high";
  if (size === "CU") return observational ? "surface" : "eye-level";
  return "eye-level";
}

const MOVES: Movement[] = ["slow-pan", "push-in", "pull-back", "tracking", "follow", "reveal"];
const ACTION = ["pour", "tamp", "whisk", "stir", "chop", "slice", "opens", "strike", "lift", "drop", "splash", "steam", "press", "knead", "fold", "wrap", "tie", "pack", "unpack", "throw", "catch", "jump", "dive", "climb", "arrive", "leave"];

/**
 * ROLL (§5.15): how long to record. A camera move needs all of itself; an
 * action — or someone talking — needs start to finish; anything else is a
 * hold, longer for wides and longer again for observational work. Handheld
 * isn't a move: the camera is held, not travelling.
 */
export function suggestRoll(shot: { size: ShotSize; subject: string; movement?: Movement; audio?: Audio }, treatment: Treatment, unattended = false): Roll {
  if (shot.movement && MOVES.includes(shot.movement)) return "move";
  if (shot.audio === "speech" || has(shot.subject, ACTION)) return "action";
  // On its own, the camera rolls while you walk in and settle, so holds run long.
  const observational = treatment === "silent" || unattended;
  if (shot.size === "WS") return observational ? "15s" : "10s";
  return observational ? "10s" : "6s";
}

/** Where the camera faces, which a read's note opens with (§5.15). */
export const DIRECTIONS = ["front-on", "side-on", "three-quarter", "from behind", "along"];

/** A note's opening direction phrase, if it has one: "Side-on, cup in front." */
export function splitDirection(note: string): { direction?: string; rest: string } {
  const m = note.match(/^([^.]+\.)\s*([\s\S]*)$/);
  if (!m || !DIRECTIONS.some((d) => m[1].toLowerCase().startsWith(d))) return { rest: note };
  return { direction: m[1], rest: m[2] };
}

/**
 * The line that ties the budget to roll (§5.15): "18—24 shots at about 2—3s
 * each makes a 45s reel — roll longer than you'll use." A range, like the
 * budget (§5.2). Only where shots are the cut: up to a short, and not when
 * talking carries the length (talking to camera, interview).
 */
export function rollLine(format: Format, budget: Budget): string | undefined {
  if (format.treatment === "talking-to-camera" || format.treatment === "interview") return undefined;
  const seconds =
    format.delivery === "custom" ? (format.lengthSeconds ?? 0) : format.delivery === "reel" || format.delivery === "short" ? PRESET_SECONDS[format.delivery] : 0;
  if (seconds <= 0 || seconds > 180) return undefined;
  const lo = Math.max(1, Math.round(seconds / budget.max));
  const hi = Math.max(1, Math.round(seconds / budget.min));
  const each = lo === hi ? `${lo}s` : `${lo}—${hi}s`;
  const shots = budget.min === budget.max ? `${budget.min}` : `${budget.min}—${budget.max}`;
  const cut = format.delivery === "reel" ? `a ${seconds}s reel` : seconds < 120 ? `a ${seconds}s cut` : `a ${Math.round(seconds / 60)}-minute cut`;
  return `${shots} shots at about ${each} each makes ${cut} — roll longer than you'll use.`;
}
