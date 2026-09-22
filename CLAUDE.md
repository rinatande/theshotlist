# TheShotList — build brief

A mobile-first, offline-first PWA that helps a solo videographer plan a shot list around the day, the format and the gear they've packed — and then tells them when they have enough and can put the camera down.

The design is finished. This repo turns it into a working app. **Don't redesign; build what's specified**, and when the spec is silent or wrong, say so and ask.

## Read these first

| File | What it is |
|---|---|
| `docs/design.md` | **The spec.** Tokens, components, every screen, every rule. Section numbers below refer to it. |
| `docs/case-study-log.md` | Why the big decisions went the way they did. Read before "improving" anything in it. |
| `docs/boards/` | The design boards as canvas source, one file per screen — read them for layout, copy and exact values, not for markup structure. See its README. Where a board and the spec disagree, the spec wins; ask. |
| `docs/build-journal.md` | Every time Rina corrected or redirected you, and what changed. Read it before starting a milestone — it's how she works. |
| `src/styles/tokens.css` | The eleven colour tokens (day + night), type, space, targets, motion. Ready to use. |
| `src/lib/types.ts` | The data model. Ready to use. |
| `src/data/templates.json` | Starter shot templates for the offline suggestion engine. Rina edits these. |

## Stack

- **Next.js (App Router) + React + TypeScript**, strict mode.
- **CSS Modules + `tokens.css`.** No Tailwind, no CSS-in-JS. Components reference tokens only — never a raw hex. That's what keeps night a pure token swap (§4.1).
- **IndexedDB via Dexie** for all data. Local-first: every screen is a client component reading from the device. There is no server data.
- **Serwist (`@serwist/next`)** for the service worker and offline caching. Web app manifest with `display: standalone` and a maskable icon.
- **JetBrains Mono**, self-hosted from JetBrains' release via `next/font/local` (`src/fonts/`) — the only typeface (§4.2). Google's build lacks `✓ ⋯ ← ⋮ ✕`; `★` isn't in either, so it's drawn (`<Star />`).
- **Vitest** for pure logic. **Playwright** for the core route once it exists.
- **Deploy on Vercel.** The one piece of server code — the brief read (M6) — becomes a Route Handler there.

Ask before adding any dependency not listed here.

Next 16 has breaking changes from older versions: read `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/` before writing Next code. Production builds run `next build --webpack`, because `@serwist/next` is a webpack plugin; dev runs on Turbopack with the service worker off.

## v0 scope: the core route

Projects → new project → empty list → brief → what it read → shot list → shoot mode → wrap.

Also in v0: project edit and delete (the `⋯` sheet, §5.14) and a minimal Settings (theme, time format, storage — §8).

Both themes. Installable. Fully usable offline. **Gear, look board, cast, per-day briefs and adding days are stubbed**: the tab or screen exists and loads, with a line saying it's coming, but the core route never depends on them.

## Milestones

Work in order. Each one ends with something that runs, a commit, and a short note to Rina about what's worth looking at. **Order changed 22 Sep (Rina):** M6, the online read, comes before M5 — the generated list is the point of the app, so it has to be good before shoot mode.

**M0 — Scaffold.** The folder isn't empty, so run `create-next-app` (TypeScript, App Router, `src/` dir, ESLint, no Tailwind) into a temporary directory and move the result in **without overwriting anything already here**. Wire up `tokens.css`, the font, the manifest and the service worker. A single page proving both themes: Auto follows `prefers-color-scheme`; `data-theme` on `<html>` overrides it. Deploy to Vercel. *Done when:* it installs to a phone home screen and opens with no signal.

**M1 — Data.** Dexie schema from `types.ts`. Pure functions, each with Vitest tests:
- `budget(format)` → `{min, max}` from the delivery × treatment table, custom interpolated by seconds; an override on the project wins (§5.2)
- `dayBudgets(project)` → the range split evenly across days, summing to the whole (§5.2)
- `runningOrder(project, dayId?)` → locations sorted: start time first by clock, then untimed by drag `order` (§5.10)
- `shotNumbers(project)` → numbers derived from the running order, continuous across days, `UNPLACED` last in each day, `[★]` unnumbered (§5.10). **Never stored.**
- `capabilities(packedGear)` → the `Capability` set from gear specs (thresholds in one place)

**M2 — Projects and new project.** `S1` Projects, `E4` empty Projects, `P0a` first-ever project, `P0b` empty new project, `P1` filled, `P2` format + days (no gear-kit line in v0). The name is optional (§5.1). `NEXT` is disabled until kind and treatment are picked, and says why. Cast defaults to lead = me, presence = part of it. Project actions: `A1` `⋯` sheet, `A2` delete, `PE1`/`PE2` edit (§5.14). `S5` Settings, v0 rows only (§8).

**M3 — The shot list.** `E5` empty, `S2` (location/beat toggle), `S4` add, `S3` detail, `S6` edit, `E3`/`S7` running order, `E1`/`E2` locations. Status column is `[ ]` / `[✓]` only; a flag is a `!` line under the subject (§4.4). `[★]` counts toward the budget but is never numbered (§5.7). Coverage gap and duplicate rules are in §8 Add shot. Sun times (§5.10): calculated on the device, coordinates from a one-time place-name lookup or the phone's location; Auto follows sunset from here (§9).

**M4 — Brief, offline.** `B0` empty, `B1` written, `B9` what it read, `B2` shots from your brief — offline this shows **quoted chips only**. Keyword matching runs on the device, debounced on a pause in typing, **never per keystroke and never over the network** (§5.6). Chips come from `src/data/chips.json` plus the capitalised-word place rule. `GENERATE SHOTS` builds a list from templates × format × packed gear × cast presence (§6.2), filled to the **top** of the budget and placed into locations by light and keywords. Every suggestion carries its reason line; with no gear packed (v0), suggestions are gear-free and the line says why the shot works rather than naming an item.

**M5 — Shoot mode and wrap.** `N4` shoot mode (night theme, one shot at a time, 72px `GOT IT`). `SKIP` sends a shot to the end of the queue; `FLAG` asks for a note; the counter is the exposed count; the last shot doesn't auto-wrap. `W1` middle day, `W2` blocked by a `[★]`, `W3` last day (§5.12). Wrap closes a **day**, never a project. `MOVE` and `RESHOOT TOMORROW` only exist when a later day does; `DROP` is reversible.

**M6 — The read (later, separate).** A Route Handler that sends the brief to the Anthropic API and returns quoted chips, inferred chips and deliverables. The API key stays server-side, in an environment variable — never in client code. Fired **once**, on `GENERATE`; cached against a hash of the brief text. Adds `B10` (read again: add or replace).
- **Model:** Claude Sonnet 5 (`claude-sonnet-5`) for everyone; Opus 5 is kept for a possible paid tier later (Rina, 22 Sep).
- **Limits (design.md §5.6):** a $2/day ceiling for the whole app, 5 reads/day per phone, 15 per network address, and invite links for 25 reads over 14 days. Rina also sets a spend limit in the Anthropic console. Counters live in Upstash Redis; production refuses reads if no store is configured.
- **Environment variables (Vercel):** `ANTHROPIC_API_KEY`; Upstash's `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `_TOKEN`); `INVITES` as a comma list of codes; optional overrides `READ_DAILY_BUDGET_USD`, `READ_PER_DEVICE_DAILY`, `READ_PER_ADDRESS_DAILY`, `INVITE_READS`, `INVITE_DAYS`.

## Rules that must not break

Each of these was a real defect or a deliberate decision. The spec section says why.

- **Never de-emphasise with opacity.** Use `--ink-muted` plus strike-through. Opacity dragged metadata under AA contrast. (§3)
- **44px minimum touch target, tabs included.** 12px tab padding gave a 41px row; it's 14px now. (§7)
- **AA contrast on every text pair.** If you introduce a colour pairing not in §4.1, check it before committing.
- **Status is never colour alone.** The brackets carry the meaning. (§3)
- **Real elements.** `<button>`, `<a href>`, `<input>` + `<label>`. `aria-label` on symbol-only controls. One `<h1>` per screen.
- **Shot numbers are derived, not stored.** A number is a position. (§5.10)
- **Wrap never deletes.** Dropped shots stay in the day's record and can be un-dropped. (§5.12)
- **The budget is a ceiling, not a target.** Under budget: silent. Over: one advisory at the foot, once. Never a per-shot warning, never praise for shooting more. (§5.2)
- **Offline first.** Nothing on the core route may need a network. The brief read is an enhancement; the keyword path must always work.
- **Words from the spec, not film-set jargon.** "Location", not "setup". "Start time", not "call time". The spec's copy is deliberate; use it verbatim where it exists.

## Working with Rina

- **Before building a screen, state what you'll put on it and wait for a go.** She'll often catch something before it's built.
- **Ask clarifying questions rather than guessing** when the spec is silent. Add genuine gaps to §10 of `docs/design.md`.
- **Commit messages say why.** First line: what changed, in plain words. Body: the reason, with the spec section or log entry. For example:

  ```
  Derive shot numbers from running order instead of storing them

  A number is a position, not an identity (design.md §5.10). Storing it
  meant a reorder left gaps and duplicates. Deleting shot 04 now
  renumbers 05 → 04, and exposed marks are unaffected.
  ```

- **Log every correction in `docs/build-journal.md`.** When Rina corrects, overrules or redirects you — rejects a plan, catches a bug, changes a decision, tells you to stop — add one entry in the same turn, before carrying on. Format is in the file. Record it in her words where you can, and don't soften it or make yourself look better: the entries that show you were wrong are the valuable ones. Small wording tweaks don't need an entry; anything that changed what got built does.
- **The case study is part of the work.** When a decision changes during the build — something in the spec didn't survive contact with code — add an entry to `docs/case-study-log.md` in its existing shape (what broke / options / decision / why it's evidence). Mark it **[R]** when Rina drove it.

## Records and privacy

- **Never ask for, print or commit a secret.** The Anthropic API key (M6) lives in `.env.local` and in Vercel's environment settings, nowhere else. `.env*` stays in `.gitignore`. If Rina pastes a key into the chat, tell her to rotate it.
- **`docs/sessions/` is private.** Rina exports session transcripts there at the end of each milestone. Make sure `docs/sessions/` is in `.gitignore` during M0, and never commit anything inside it. The public record is the build journal, the case study log and the commit history.
- **At the end of each milestone,** remind Rina to export the session (`/export`) into `docs/sessions/`, named by milestone — `M0-scaffold.md`, `M1-data.md` and so on.
