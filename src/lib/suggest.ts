import type { Audio, Movement, ShotSize, Support, Treatment } from "./types";

/**
 * What the app fills in for a new shot (design.md §5.13): movement and audio,
 * worked out from what's already been chosen. The person can override either;
 * once they do, the form stops re-suggesting it.
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

export function suggestMovement(shot: { size: ShotSize; support?: Support; subject: string }): Movement {
  const { size, support, subject } = shot;
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
