# Build journal

Every time Rina corrected, overruled or redirected Claude Code during the build — and what changed because of it.

This is the build half of the case study: the design half is `case-study-log.md`. It exists because the useful evidence isn't how the AI reasoned, it's where a person's judgement changed what got built. Transcripts are too long to find those moments in afterwards, so they're written down as they happen.

## How to add an entry

Claude Code adds one in the same turn, before carrying on. One entry per correction, newest at the bottom.

```
### YYYY-MM-DD · M<n> · <a few words on what it was about>

**Proposed:** what Claude Code planned or built.
**Rina:** what she said, in her words where possible.
**Changed:** what was built differently as a result — files, behaviour, or a spec update.
**Kind:** plan rejected · bug caught · spec gap · design call · stopped · other
```

Rules: record it honestly, including when the AI was plainly wrong. Small wording tweaks don't need an entry; anything that changed what got built does. When an entry also changes a design decision, add a matching entry to `case-study-log.md` and link them.

## Entries

*Entries for 21 Sep were backfilled from the session the same day, after this file was added. Rina's words are quoted from her messages.*

### 2026-09-21 · M0 · The budget is a guide, and deliverables count in it

**Proposed:** Build §5.2/§5.7 as written: `[★]` required shots sit outside the shot budget, so an over-budget warning can never read as "drop one of these". Claude Code asked for a budget table and how to number required shots.
**Rina:** "the budget is just a rough guide… Users are free to go over or under as they like." And on required shots: "they don't need their own number to be displayed but should be counted towards the budget."
**Changed:** `[★]` shots count toward the total, keep their own `★ 0/3` counter, and take no number. The over-budget advisory is worded so it never suggests cutting one. design.md §5.2, §5.7; `shotNumbers()` skips required shots. Claude Code drafted the budget table at her request. See case-study-log 2.15.
**Kind:** design call

### 2026-09-21 · M0 · A flag is a line, and long-press does nothing yet

**Proposed:** The status control as specced: tap toggles `[ ]`/`[✓]`, long-press sets `[!]`. Claude Code pointed out that §5.7 also gave long-press to `[★]`.
**Rina:** "for now the ! will just appear as warning text under a caption like in some of the boards instead of where tick goes. For now let's leave it so long press doesn't do anything yet."
**Changed:** The status column shows only `[ ]`/`[✓]`; a flag is a `! NOTE` line under the subject. Long-press is unassigned in v0. design.md §4.4, §7. This left no way to set `[★]` by hand, which is logged as §10 (16). See case-study-log 2.16.
**Kind:** design call

### 2026-09-21 · M0 · One brief for the project in v0

**Proposed:** Briefs in two scopes, per project and per day, with a toggle (§5.6).
**Rina:** "for v0 we can just have a project brief where they can specify what they want to do wide for the whole project or put in a detailed description about each day. Will look into if we need a separate brief for each day in v1."
**Changed:** v0 has a single project brief. Per-day briefs and `! NO BRIEF` on day rows move to v1. design.md §5.6; CLAUDE.md v0 scope. See case-study-log 2.18.
**Kind:** plan rejected

### 2026-09-21 · M0 · Sun times from the place name, not hidden

**Proposed:** Claude Code offered to hide the light lines (E1, N4) and sunset Auto in v0, since `where` is free text and can't become coordinates offline.
**Rina:** "is it possible to get rough sunrise / set times via location name? phone's location should be good with prompt." She then chose name lookup plus phone location.
**Changed:** The place name is looked up once online (Open-Meteo), the coordinates are stored, and sun times are calculated on the phone. Auto follows sunset in v0 (M3). design.md §5.10, §9, §10 (21). See case-study-log 2.17.
**Kind:** design call

### 2026-09-21 · M0 · Project edit and delete move into v0

**Proposed:** Keep project edit and delete for v1, as Rina had said earlier, and draw only the `⋯` in M2.
**Rina:** "lets move it to v0 since we have the designs now."
**Changed:** The `⋯` sheet, delete confirmation and both edit steps (A1, A2, PE1, PE2) were built in M2. CLAUDE.md v0 scope and M2.
**Kind:** plan rejected

### 2026-09-21 · M2 · Show all three "who is on camera" choices

**Proposed:** Cast is stubbed in v0, so Claude Code recommended leaving "Who is on camera?" off step 1 entirely.
**Rina:** "show it all with only me working."
**Changed:** Step 1 shows ME / SOMEONE ELSE / NO ONE. The last two can't be picked: muted, dashed, with a line saying they come with the cast screen. `ProjectForm.tsx`. The disabled-chip style went into §7.
**Kind:** plan rejected

### 2026-09-21 · M1 · "Can I not test the functionality?"

**Proposed:** Build in milestone order. M0 shipped a theme proof page, and M1 was to be data and tests only, with nothing to look at.
**Rina:** "how do i test my app? the link is just for the themes. can i not test the functionality?" Offered M1 alone or M1 with M2, she answered "m1 and m2 together".
**Changed:** M1 and M2 were built in one pass, so the next deploy was usable: create, edit and delete projects, and Settings. Each milestone note now says what to try on the phone.
**Kind:** other

### 2026-09-22 · M2 · Truncate names on the list, wrap them on the project screen

**Proposed:** As built in M2, following §5.14 and §7: the Projects list let long names wrap, and the project header truncated the name to one line so the `⋯` always had room.
**Rina:** "On the projects listing page can we please truncate the name of a project if more than 1 line?" and "I would also like to reverse what I said before on the project detail page. I think we should wrap the project name on this page instead of truncating it."
**Changed:** Project names truncate to one line on the Projects list and wrap in full in the project header, with the `⋯` beside the first line. `Projects.module.css`, `ProjectHeader.module.css`; design.md §5.14 and the §7 project-header row updated.
**Kind:** design call

### 2026-09-22 · M3 · Build M3 in one piece

**Proposed:** Split M3: M3a (list, beats, add/detail/edit, locations, running order), then M3b (sun times, place-name lookup, LIGHT boxes, sunset Auto), so the core could be tested sooner.
**Rina:** "I think I would prefer to do a sweeping test of the whole m3 so do it together if possible."
**Changed:** M3 is built and handed over as one milestone, sun times included.
**Kind:** plan rejected

### 2026-09-22 · M3 · Movement is suggested by the app

**Proposed:** Claude Code pointed out that the shot detail (S3) shows MOVEMENT and AUDIO but add/edit (S4, S6) have no fields for them, and asked whether to add two optional text fields or leave both out.
**Rina:** "I think movement should be auto suggested when the shot is created, depending on what the app thinks is best." On audio she asked for a recommendation, and whether it's needed at all.
**Changed:** Movement is suggested when a shot is created (rules proposed in the M3 plan, awaiting her go). Audio is still open.
**Kind:** design call

### 2026-09-22 · M3 · "What does sync for audio mean?"

**Proposed:** An audio choice on every shot, labelled `SYNC` / `AMBIENT` / `NONE`, filled in by the app from the treatment and the shot.
**Rina:** "what does sync for audio mean?"
**Changed:** Her question showed the label was film-set jargon (synchronised sound), the kind CLAUDE.md rules out. It's now `SPEECH` / `NATURAL SOUND` / `NO SOUND`, with a line under it saying what the choice means ("Someone talks on camera — check the mic is on before you roll."). She picked this option out of three plainer label sets.
**Kind:** bug caught
