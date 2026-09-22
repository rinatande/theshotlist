import type { ShotSize, TemplateShot } from "./types";

/**
 * Coverage built from the brief's own words, offline (build-journal, 22 Sep).
 * Templates only know the shots someone wrote; this finds the actions a brief
 * names — "descaling and flushing coffee machine", "then making a latte" —
 * and covers each as a short sequence in the person's wording. Rough English
 * parsing, on purpose: no dictionary, no network. The online read (M6) is
 * where real understanding comes from.
 */

export interface Action {
  /** "descaling", "making" */
  verb: string;
  /** "the coffee machine", "a latte" — may be empty for "someone pouring" */
  object: string;
  /** "Descaling the coffee machine" */
  phrase: string;
  kind: "task" | "movement";
  /** "at home" → "home" */
  place?: string;
}

export interface CoverageShot {
  id: string;
  size: ShotSize;
  subject: string;
  reason: string;
  beat: TemplateShot["beat"];
  person: TemplateShot["person"];
  /** Words to match against location names when placing it. */
  keywords: string[];
}

/** -ing words that aren't actions. */
const NOT_VERBS = new Set([
  "morning", "evening", "nothing", "something", "anything", "everything", "thing", "things", "king", "ring", "sing", "wing", "spring",
  "string", "sling", "swing", "sting", "bring", "ceiling", "during", "wedding", "building", "clothing", "pudding", "ceiling", "lighting",
  "ending", "opening", "setting", "feeling", "painting", "offering", "evening", "meeting", "packaging", "seasoning", "icing", "frosting",
]);

/** Actions about making the video, or talking — templates already cover these. */
const META = new Set(["shooting", "filming", "vlogging", "recording", "editing", "talking", "saying", "chatting", "interviewing", "explaining", "speaking", "going", "getting", "trying", "looking", "doing", "having", "being"]);

const MOVEMENT = new Set([
  "walking", "wandering", "hiking", "exploring", "strolling", "riding", "cycling", "driving", "running", "swimming", "climbing",
  "travelling", "traveling", "skating", "surfing", "paddling", "roaming",
]);

const STOP = new Set(["at", "in", "on", "with", "for", "from", "to", "before", "after", "while", "by", "near", "into", "over", "under", "around", "through", "until", "during", "as"]);
const SUBJECTS = new Set(["someone", "me", "him", "her", "them", "us", "you", "i", "we", "they", "people", "he", "she"]);
const DETERMINERS = new Set(["a", "an", "the", "my", "our", "their", "his", "her", "your", "some", "this", "that", "these", "those"]);
/** Words that end an object: joiners, the next clause. */
const ENDS = new Set(["and", "or", "but", "then", "so", "because"]);
/** After these, the next word is a plain verb: "then make a latte", "I'll descale it". */
const VERB_LEADS = new Set(["then", "i'll", "we'll", "i’ll", "we’ll", "to", "will", "gonna"]);
/** Plain verbs that aren't things to film. */
const NOT_ACTIONS = new Set(["be", "go", "get", "have", "need", "want", "see", "try", "do", "show", "say", "talk", "film", "shoot", "record", "come", "leave", "head", "start", "finish", "end", "use", "keep", "let", "take"]);

const lower = (w: string) => w.toLowerCase().replace(/[^a-z'’-]/g, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** make → making, descale → descaling, flush → flushing, tie → tying. */
function gerund(verb: string): string {
  if (verb.endsWith("ing")) return verb;
  if (verb.endsWith("ie")) return verb.slice(0, -2) + "ying";
  if (verb.endsWith("e") && !verb.endsWith("ee")) return verb.slice(0, -1) + "ing";
  if (/^(run|sit|cut|put|set|stop|shop|plan|chop|swim|get|drop|wrap|prep|stir|trim|mop|scrub)$/.test(verb)) return verb + verb.slice(-1) + "ing";
  return verb + "ing";
}

const isGerund = (w: string) => w.length >= 5 && w.endsWith("ing") && !NOT_VERBS.has(w);

export function findActions(text: string): Action[] {
  const actions: Action[] = [];
  const seen = new Set<string>();
  // Clauses: sentences, commas, dashes. "then" stays in, so it can mark the next verb.
  const clauses = text
    .replace(/[—–]/g, ",")
    .split(/[.!?;\n,]/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const raw = clause.split(/\s+/);
    const words = raw.map(lower);
    let pending: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      // A plain verb counts only straight after "then", "to", "I'll"…: "then make a latte".
      const plain =
        i > 0 &&
        VERB_LEADS.has(words[i - 1]) &&
        /^[a-z]{3,}$/.test(w) &&
        !w.endsWith("ing") &&
        ![NOT_ACTIONS, DETERMINERS, SUBJECTS, STOP, ENDS].some((set) => set.has(w));
      if (!isGerund(w) && !plain) continue;
      if (words[i - 1] === "no" || words[i - 1] === "not") continue; // "no talking"
      const verb = gerund(w);
      if (META.has(verb) || NOT_VERBS.has(verb)) continue;

      // Coordinated verbs share the object after the last one: "descaling and flushing coffee machine".
      pending.push(verb);
      if (words[i + 1] === "and" || words[i + 1] === "or") {
        if (words[i + 2] && isGerund(words[i + 2])) continue;
      }

      // Object: up to the next preposition, joiner or the clause end, four words at most.
      const obj: string[] = [];
      let j = i + 1;
      for (; j < words.length && obj.length < 4; j++) {
        if (STOP.has(words[j]) || ENDS.has(words[j]) || VERB_LEADS.has(words[j]) || isGerund(words[j])) break;
        obj.push(raw[j].replace(/[^\p{L}\p{N}'’-]/gu, ""));
      }
      let place: string | undefined;
      if (STOP.has(words[j] ?? "") && ["at", "in", "on"].includes(words[j])) {
        const p = raw.slice(j + 1, j + 4).map((x) => x.replace(/[^\p{L}\p{N}'’-]/gu, "")).filter(Boolean);
        // The place ends where the next clause starts: "at home then making…".
        const end = p.findIndex((x) => {
          const l = x.toLowerCase();
          return STOP.has(l) || ENDS.has(l) || VERB_LEADS.has(l) || isGerund(l);
        });
        place = (end >= 0 ? p.slice(0, end) : p).filter((x) => !DETERMINERS.has(x.toLowerCase())).join(" ") || undefined;
      }

      let object = obj.join(" ");
      const PRONOUNS = ["it", "them", "this", "that", "everything", "something", "up", "out", "down"];
      if (object && !DETERMINERS.has(obj[0].toLowerCase()) && !PRONOUNS.includes(obj[0].toLowerCase()) && !/^\p{Lu}/u.test(obj[0])) object = `the ${object}`;
      const who = SUBJECTS.has(words[i - 1] ?? "") && words[i - 1] !== "me" && words[i - 1] !== "i" ? cap(words[i - 1]) : undefined;

      for (const v of pending) {
        if (!object && !who) continue; // "…pouring," with nothing to hang it on
        const phrase = object ? `${cap(v)} ${object}` : `${who} ${v}`;
        const key = phrase.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        actions.push({ verb: v, object, phrase, kind: MOVEMENT.has(v) ? "movement" : "task", place });
      }
      pending = [];
    }
  }
  return actions.slice(0, 4);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * A short sequence per action: the whole of it, the hands, the moment it
 * works — or, for moving through a place, wide, following, feet. The last
 * task that makes something ends on the finished thing.
 */
export function coverageFor(actions: Action[]): CoverageShot[] {
  if (actions.length === 0) return [];
  const shots: CoverageShot[] = [];
  const place = actions.find((a) => a.place)?.place;
  const words = (a: Action) => [a.object.replace(/^(the|a|an) /, ""), a.place ?? ""].filter(Boolean);

  const firstTask = actions.find((a) => a.kind === "task");
  if (firstTask) {
    shots.push({
      id: `brief:setup-${slug(place ?? firstTask.phrase)}`,
      size: "WS",
      subject: place ? `${cap(place)} — the whole set-up, wide` : "The set-up, wide — before you start",
      reason: "Where it happens, before anything starts. Every close-up in the sequence cuts back to this.",
      beat: "opener",
      person: "none",
      keywords: place ? [place] : [],
    });
  }

  actions.forEach((a, n) => {
    const quoted = `You said “${a.phrase.toLowerCase()}”.`;
    const base = `brief:${slug(a.phrase)}`;
    if (a.kind === "movement") {
      shots.push(
        { id: `${base}-wide`, size: "WS", subject: `${a.phrase} — wide, small in the frame`, reason: `${quoted} Start wide so the place leads.`, beat: n === 0 ? "opener" : "body", person: "body", keywords: words(a) },
        { id: `${base}-follow`, size: "MS", subject: `${a.phrase} — following from behind`, reason: "Movement without a face. Walk with them and let the place open up ahead.", beat: "body", person: "body", keywords: words(a) },
        { id: `${base}-feet`, size: "INS", subject: `${a.phrase} — feet on the ground`, reason: "A face-free cutaway that carries you between anything.", beat: "body", person: "body", keywords: words(a) },
      );
      return;
    }
    shots.push(
      { id: `${base}-whole`, size: "MS", subject: a.phrase, reason: `${quoted} Get the whole of it first — it's what the close-ups cut around.`, beat: "body", person: "body", keywords: words(a) },
      { id: `${base}-hands`, size: "INS", subject: `${a.phrase} — hands, close`, reason: "Hands carry a process without needing a face, and cut between anything.", beat: "body", person: "body", keywords: words(a) },
      { id: `${base}-moment`, size: "CU", subject: `${a.phrase} — the moment you can see it working`, reason: "Wait for the change you can see, and hold on it for a few seconds.", beat: "body", person: "none", keywords: words(a) },
    );
  });

  // End on what got made, if the last task made something.
  const last = [...actions].reverse().find((a) => a.kind === "task" && a.object);
  if (last && /^(making|cooking|baking|brewing|building|preparing|plating|mixing|pouring|crafting|knitting|sewing|painting|assembling)$/.test(last.verb)) {
    const thing = last.object.replace(/^(a|an|the) /, "");
    shots.push({
      id: `brief:finished-${slug(thing)}`,
      size: "CU",
      subject: `The finished ${thing}`,
      reason: "The payoff: the thing you made, finished. Give it five still seconds.",
      beat: "closer",
      person: "none",
      keywords: [thing],
    });
  }
  return shots;
}
