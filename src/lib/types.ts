/**
 * TheShotList — data model.
 *
 * Source of truth: docs/design.md (section numbers in comments below).
 * Everything here is stored on the device (IndexedDB). There is no server
 * data model: the only server code, added later, is the brief read (§5.6).
 *
 * Two rules worth reading before changing anything:
 *
 * 1. A shot's NUMBER is never stored. It's derived from the running order
 *    (day → location → shot `order`), so moving or deleting a shot renumbers
 *    the rest. A number is a position, not an identity (§5.10, §5.13).
 *
 * 2. Nothing is deleted by wrap. An unshot shot is either moved to a later
 *    day or DROPPED, and a dropped shot keeps its record so it can be
 *    un-dropped (§5.12).
 */

// ─── Ids and time ────────────────────────────────────────────────────────────

export type Id = string;          // crypto.randomUUID()
export type IsoDate = string;     // "2026-09-24"
export type IsoDateTime = string; // "2026-09-24T06:10:00.000Z"

/** Minutes after local midnight. 6:10 AM → 370. Displayed per Settings → Time format. */
export type ClockMinutes = number;

// ─── Format (§5.1–5.3) ───────────────────────────────────────────────────────

export type Genre = 'travel' | 'documentary' | 'brand' | 'event' | 'tutorial' | 'personal';

export type Treatment =
  | 'talking-to-camera'
  | 'silent'          // "SILENT / OBSERVATIONAL"
  | 'interview'
  | 'narrated'        // "NARRATED (VO)"
  | 'scripted';

export type Delivery = 'reel' | 'short' | 'mid' | 'long' | 'custom';

export type Aspect = '9:16' | '16:9' | '4:5' | '1:1';

export interface Format {
  genre: Genre;
  treatment: Treatment;
  delivery: Delivery;
  /** Only for `custom`; otherwise derived from `delivery`. */
  lengthSeconds?: number;
  aspect: Aspect;
}

/** A range, never one number — a range reads as advice, a number as a target (§5.2). */
export interface Budget {
  min: number;
  max: number;
}

/**
 * Where a shot sits in the edit. Templates use these abstract roles; each
 * delivery maps them to its own beat names (§5.2):
 *   reel  → HOOK / BUILD / PAYOFF
 *   short → OPEN / MIDDLE / CLOSE
 *   mid   → INTRO / SEGMENTS / OUTRO
 *   long  → COLD OPEN + INTRO / CHAPTERS / OUTRO
 */
export type BeatRole = 'opener' | 'body' | 'closer' | 'any';

// ─── Cast and presence (§5.8) ────────────────────────────────────────────────

/** Radio, four levels, one per person per project. Default: 'part'. */
export type Presence = 'none' | 'background' | 'part' | 'subject';

export type LeadKind = 'me' | 'someone' | 'no-one';

export interface CastMember {
  id: Id;
  name: string;           // "Priya", "Buno"
  role?: string;          // "sous chef", "dog"
  presence: Presence;
  /** Voice is a separate switch: faceless-with-narration is coherent. */
  voice: boolean;
}

export interface Cast {
  lead: LeadKind;
  /** Present when lead is 'me' or 'someone'. For 'me', name is "You". */
  leadMember?: CastMember;
  supporting: CastMember[];
  /** You, behind the camera. Defaults to 'none' when the lead is someone else. */
  operatorPresence: Presence;
}

// ─── Gear (§6.1) ─────────────────────────────────────────────────────────────

export type GearCategory = 'camera' | 'lens' | 'support' | 'light' | 'audio' | 'power' | 'grip' | 'drone';

export type GearSpecs =
  | { category: 'camera'; mount?: string; stabilised?: boolean; batteries?: number; cardSlots?: number; lowLightIso?: number; maxFps?: number }
  | { category: 'lens'; focalMin: number; focalMax: number; maxAperture: number; macro?: boolean; stabilised?: boolean; mount?: string }
  | { category: 'support'; type: 'tripod' | 'gimbal' | 'slider' | 'monopod'; maxLoadKg?: number; maxHeightCm?: number; fluidHead?: boolean }
  | { category: 'light'; outputW?: number; colour?: 'daylight' | 'bi' | 'rgb'; battery?: boolean }
  | { category: 'audio'; type: 'shotgun' | 'lav' | 'recorder'; channels?: number; windshield?: boolean }
  | { category: 'power'; capacityMah: number }
  | { category: 'grip' }
  | { category: 'drone'; maxWindKmh?: number };

export interface GearItem {
  id: Id;
  name: string;       // "Sony 85 f/1.8" — for people
  specs: GearSpecs;   // for the engine: "85mm at f1.8" is what it reasons with
  notes?: string;
}

export interface Kit {
  id: Id;
  name: string;       // "Pocket", "Doc day", "Full camp rig"
  itemIds: Id[];
  isDefault?: boolean;
}

/**
 * What the suggestion engine asks of the packed gear. Derived from specs,
 * never stored: e.g. a lens with focalMin ≤ 24 grants 'wide'.
 * Thresholds live in one place (src/lib/capabilities.ts) so they can be tuned.
 */
export type Capability =
  | 'wide'      // focal ≤ 24mm (full-frame equivalent)
  | 'tele'      // focal ≥ 70mm
  | 'fast'      // max aperture ≤ f/2 — shallow focus, low light
  | 'macro'
  | 'tripod'
  | 'gimbal'
  | 'slider'
  | 'drone'
  | 'mic'       // any audio item
  | 'lav'
  | 'slowmo'    // camera maxFps ≥ 100
  | 'light'
  | 'power';    // a power bank — long lapses

// ─── Place (§5.10) ───────────────────────────────────────────────────────────

/**
 * Where something is on the globe, for sun times. Worked out once — from the
 * place name when there's signal, or the phone's location — then kept, so
 * everything downstream works offline.
 */
export interface Coords {
  lat: number;
  lng: number;
  /** IANA zone the place is in, so sun times read in local time there. */
  timeZone: string;
  source: "name" | "device";
  /** The `where` text this was looked up from; a changed name looks it up again. */
  from?: string;
}

// ─── Structure: days and locations (§5.9, §5.10) ─────────────────────────────

export interface Day {
  id: Id;
  index: number;          // 1-based: "DAY 2 OF 3"
  date?: IsoDate;
  label?: string;         // "Higashiyama"
  wrappedAt?: IsoDateTime;
  /** Set when the person edits this day's share; otherwise the even split applies (§5.2). */
  budget?: Budget;
}

/**
 * A place, or a stretch of the day: "Cliff path" or "Breakfast at the ryokan".
 * Never lettered. `where` and `startTime` are both optional (§5.10).
 */
export interface Location {
  id: Id;
  name: string;
  where?: string;
  startTime?: ClockMinutes;   // with a time: sorts by the clock
  dayId?: Id;                 // only on multi-day projects
  order: number;              // drag order — used for locations with no start time
  coords?: Coords;
}

// ─── Shots (§4.4, §5.12, §5.13) ─────────────────────────────────────────────

export type ShotSize = 'WS' | 'MS' | 'CU' | 'OTS' | 'INS';

/**
 * [ ] unshot · [✓] exposed · [!] flagged · dropped (struck through, reversible).
 * `required` (★) is NOT a status — a contracted shot can be any of these.
 */
export type ShotStatus = 'unshot' | 'exposed' | 'flagged' | 'dropped';

export type ShotSource = 'template' | 'brief' | 'manual';

/** v0 support, before gear exists (§8 Add shot). */
export type Support = 'handheld' | 'tripod' | 'gimbal';

/** What the shot needs from sound (§5.13). Filled in by the app; the person can change it. */
export type Audio = 'speech' | 'natural' | 'none';

export type Movement =
  | 'static' | 'slow-pan' | 'push-in' | 'pull-back' | 'tracking' | 'follow' | 'handheld' | 'reveal';

export interface Deliverable {
  client: string;         // "Sable Outdoor", "Nagi Coffee"
}

export interface Shot {
  id: Id;
  size: ShotSize;
  subject: string;        // "Hands on the rope"
  lensId?: Id;            // references a GearItem — a reference, not a string (§6.4)
  supportId?: Id;
  /** v0, before gear: the lens as typed, "35mm". Gear chips replace it later. */
  lens?: string;
  support?: Support;
  movement?: Movement;    // suggested by the app, changeable (§5.13)
  audio?: Audio;
  note?: string;
  refIds?: Id[];          // look-board references

  locationId?: Id;        // absent → the UNPLACED group
  dayId?: Id;
  beat?: BeatRole;
  order: number;          // position within its location; the number is derived

  status: ShotStatus;
  flagNote?: string;      // "NO COVERAGE YET"
  droppedAt?: IsoDateTime;
  required?: Deliverable; // ★ — outside the budget count (§5.7)

  source: ShotSource;
  templateId?: string;
  reason?: string;        // the "why" line, naming the gear item that earned it (§6.2)
}

// ─── The brief (§5.6) ────────────────────────────────────────────────────────

export interface Chip {
  label: string;          // "SUNRISE", "HIGASHIYAMA"
  /** time · weather · treatment · mood · subject · work come from src/data/chips.json;
   *  place from the capitalised-word rule; the rest only from the online read (§5.6). */
  kind: 'place' | 'time' | 'weather' | 'treatment' | 'mood' | 'subject' | 'work'
      | 'genre' | 'client' | 'deliverable' | 'other';
}

export interface Extraction {
  /** Words actually in the brief. Local keyword matching; free, offline, live. */
  quoted: Chip[];
  /** Judgements the full read made. Only ever from the online read. Drawn filled. */
  inferred: Chip[];
  deliverables: { client: string; shots: string[] }[];
}

export interface Brief {
  id: Id;
  scope: 'project' | 'day';
  dayId?: Id;
  text: string;
  /** Hash of `text` at the last full read. Unchanged text → no new request. */
  readHash?: string;
  readAt?: IsoDateTime;
  extraction?: Extraction;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: Id;
  /** Optional at creation: falls back to "<date> shoot" (§5.1). */
  name: string;
  format: Format;
  /** Set when the person edits the budget; the delivery × treatment table is then ignored (§5.2). */
  budgetOverride?: Budget;
  startDate?: IsoDate;
  dayCount: number;       // asked at creation (§5.9). 1 → no day layer in the UI.
  where?: string;
  coords?: Coords;
  cast: Cast;

  kitId?: Id;             // the kit it started from — kept, to show "Doc day +2"
  gearIds: Id[];          // the set edited for this shoot
  packedIds: Id[];        // subset ticked as in the bag

  days: Day[];            // length === dayCount
  locations: Location[];
  shots: Shot[];
  briefs: Brief[];

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ─── Templates (src/data/templates.json) ─────────────────────────────────────

/**
 * Who has to be visible for the shot to work. Mapped against presence:
 *   none → always allowed
 *   body → hands, feet, silhouette, back of head — allowed unless presence is 'none'…
 *          …and even then the engine may keep it as hands/POV (§5.8 "rewrites rather than removes")
 *   face → identifiable face — needs presence 'part' or 'subject'
 */
export type PersonNeed = 'none' | 'body' | 'face';

export type Light = 'any' | 'sunrise' | 'golden' | 'blue' | 'night' | 'day';

export interface TemplateShot {
  id: string;                 // stable, kebab-case: "steam-backlit"
  size: ShotSize;
  subject: string;
  beat: BeatRole;
  genres: Genre[];            // empty → any genre
  treatments: Treatment[];    // empty → any treatment
  requires: Capability[];     // ALL must be met by packed gear
  unlockedBy?: Capability;    // the one to name in the reason line; ranks it up
  light: Light;
  person: PersonNeed;
  /** Shown under the shot. `{item}` is replaced with the packed gear item that met `unlockedBy`. */
  reason: string;
  /** When a requirement is missing, a rewritten version is offered instead of dropping it (§6.2 step 4). */
  fallback?: { subject: string; reason: string };
  keywords?: string[];        // brief words that boost this template offline
}
