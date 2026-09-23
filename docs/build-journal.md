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

### 2026-09-22 · M3 · Duplicate and delete move to shot detail

**Proposed:** As specced (§5.13, board S6): DUPLICATE and DELETE sit at the foot of edit shot, so edit mirrors add plus two additions.
**Rina:** "Can we move duplicate and delete function for shots one level up? so it sits on a shot detail page under the shot details instead of user having to edit shot first to delete or duplicate."
**Changed:** DUPLICATE and DELETE are on shot detail (S3), under the spec table and note, each still stating its consequence. Edit shot is now exactly add shot (plus clearing a flag). design.md §5.13 and §8 Shot detail updated.
**Kind:** design call

### 2026-09-22 · M4 · Suggestions ignore what the brief is about

**Proposed:** The offline engine as built for M4: brief words only re-rank a fixed template library (§5.6, §6.2), so the list can only ever contain shots someone wrote a template for.
**Rina:** "I tested a brief to generate shots 'Aesthetic vlog of me descaling and flushing coffee machine at home then making a latte.'. The shot list is too generic and has nothing about descaling or flushing the coffee machine, or even making the coffee. not very usable. is there a way to make it better?"
**Changed:** Nothing yet — options put to Rina (offline coverage built from the brief's own actions; bringing the online read, M6, forward; or both).
**Kind:** bug caught

### 2026-09-22 · M3 · No way to add a location once the list has shots

**Proposed:** Entry points as specced in §5.10: `+ LOCATION` on the empty shot list and on the running-order screen. Once a shot existed, the empty list was gone, and the running order was two taps away behind `ORDER`, with nothing on the list pointing there.
**Rina:** "once you add any type of shot to a project, you aren't able to add a new location. Can you please fix this."
**Changed:** `+ LOCATION` now sits at the foot of the shot list (at the foot of each day, on a multi-day shoot), so a location can always be added from where the list is. design.md §5.10 entry points updated.
**Kind:** bug caught

### 2026-09-22 · M4 · Coverage from the brief's own actions, and the read before shoot mode

**Proposed:** Three options for generic suggestions — (A) offline coverage built from the actions named in the brief, (B) bring the online read (M6) forward, (C) both, A first. Milestones still in order: M5 shoot mode, then M6.
**Rina:** "C and maybe we can do m6 before m5 as I feel like the whole purpose of this app is based around the generated shot list from the brief being amazing or atleast usable."
**Changed:** Offline action coverage is built now; M6 (the online read) moves ahead of M5 (shoot mode and wrap). CLAUDE.md milestone order updated.
**Kind:** plan rejected

### 2026-09-22 · M6 · Sonnet 5 for everyone, Opus 5 as a tier

**Proposed:** After a side-by-side on her coffee-machine brief (Opus 5: 39 shots, $0.156, 79 s; Sonnet 5: 33 shots, $0.051, 51 s), Claude Code recommended Opus 5 for the read, because its reason lines were the practical ones.
**Rina:** "I think both are good, just opus is more detailed, and gives more direction in the reason line. I think in general it would be more than enough for all users to use sonnet 5. Then maybe we can introduce a tiered user / subscription option than enables opus 5." She also wants people — especially reviewers of her job applications — to be able to try it without burning her credit.
**Changed:** The read defaults to Sonnet 5; Opus 5 is reserved for a future tier. Usage limits are being designed before M6 is built.
**Kind:** plan rejected

### 2026-09-22 · M6 · No way to move many shots into a location

**Proposed:** M6 shipped with generated shots landing in `UNPLACED` when the project had no locations yet, and placing a shot meant editing it one at a time. M5 (shoot mode and wrap) was next.
**Rina:** "When I was testing the new version, I was nicely able to generate the shot list which landed in unplaced. I then created a location. Then had to manually add all the 40 shots one by one to a location."
**Changed:** Both built before M5, at her go ("Let's fix both before m5"):
- **Select and move:** `SELECT` on a band, tick boxes with `ALL N`, and `MOVE N TO…` a location, a day's UNPLACED, or a new location named in the sheet.
- **Suggested locations:** the online read suggests locations when a project has none, so generated shots arrive placed.

design.md §10 item 23 and §5.6.
**Kind:** bug caught

### 2026-09-23 · M5 · The canvas synced to the build

**Proposed:** Through M2–M6 the build went past the boards in places. Some screens were never drawn:
- select mode and the move sheet;
- a wrapped day's record;
- shoot mode once everything's through;
- the sheet for changing one not-shot shot;
- the brief with no full reads left.

Others shipped differently from their board: B10 keeps exposed shots, flagged shots leave shoot mode's queue, and the brief screens carry the read's privacy line. design.md recorded each gap as "not drawn" or "as built". The canvas still showed the earlier design.
**Rina:** Synced the design canvas to the build on 23 Sep. "Code is what's real; the canvas records where the design ended up."
**Changed:** 24 boards in `docs/boards/` updated to match what shipped. Six new boards added:
- `SL1` select mode;
- `SL2` move sheet;
- `WD1` day record;
- `N4b` shoot mode, everything through;
- `W4` the not-shot sheet;
- `B1b` the brief with no full reads left.

The "not drawn" notes in design.md (§5.12 as built; §10 item 23) now point at those boards. See case-study-log 2.23.
**Kind:** other

### 2026-09-23 · v1 gear · Gear suggestions ignored the brief

**Proposed:** Stage 2 built G5/G6 as drawn. SUGGEST SHOTS FROM THIS KIT ran the offline engine on the format and the gear alone. On an existing list it offered up to eight "gear-earned" templates whether or not the shoot had any use for them: a drone top-down, hair in the wind in slow motion. Gear could only be chosen after the project existed, so a first read or GENERATE never knew the kit.
**Rina:** "suggest shots from gear is not cutting it. It needs to at the very least be able to pull in the brief to suggest shots that actually work for the shoot not generic random shots." She also asked for a way to add gear when creating a project, filters (close-up, ND) in the gear list, and a frame rate: "when I shoot a aesthetic silent slow life vlog, i shoot everything in 24 fps, so it won't suggest slowing down clips as real time is what im after."
**Changed:** Proposed before building: gear suggestions that go through the brief (and the read when there's signal), a kit and a frame rate added to P2, and FILTER as a gear category. Rina overruled the placement: "lets add a third step to make each step clearer". She also added 120fps: "so we can get slow motion". So new project gets a third step, gear and frame rate (24 · 25 · 30 · 50 · 60 · 120 · MIXED), and all four fixes go ahead.
**Kind:** plan rejected

### 2026-09-23 · v1 gear · Half the shots the cut needs

**Proposed:** The read's instructions told the model to add shots "up to the number you're told there's room for — fewer if the brief doesn't honestly support more". The gear update then added "plan only shots that gear can make". Nothing checked the result against the budget. Offline, each action in the brief was covered three ways whatever the length.
**Rina:** "Before the update the brief generated 46 shots for a 5-10 min video with a shot budget of 48-64 shots… On the new update, with the exact same prompt, just with gear selected and 24 fps chosen, it only created 26 shots. that's roughly half of what I need and would be considered a failure… The shot list generated should take into account the type of video being shot as well as the length / shot budget and generate enough shots for that!"
**Changed:**
- **The read's budget is a count to hit.** It's told exactly how many shots to return and the minimum, and that a longer cut needs each moment covered more ways, not more topics. Gear changes how a moment is shot, not how many are covered.
- **Tested on her setup.** The old prompt gave 48 on the run tested (26 on hers); the new one gave 64, the top of the budget.
- **A short read is filled** from the brief-matched library up to the minimum, under TO REACH THE BUDGET.
- **Offline coverage deepens with the budget:** reel 3 ways per action, short 6, mid and longer 9. Her brief now gives 52 offline, up from 34.

design.md §5.6 and §6.2; case-study-log 2.26.
**Kind:** bug caught

### 2026-09-23 · v1 gear · Drop offline generation

**Proposed:** Keep the offline path from §3 and §5.6: when there's no signal, no reads left or a short read, generate from templates and the brief's words, and fill a short read from the library under TO REACH THE BUDGET.
**Rina:** "I feel like we could almost remove the offline mode, where offline now should just be able to read and use the app as is without being able to generate the shot list. You can manually add them but the generation of the offline ones are just so out of context and pretty much unusable / not useful. Users can set up everything the day before and then on shoot day go offline mode if they need." On the gear screen: SUGGEST SHOTS FROM THIS KIT should only show when there's a brief, "and there should be a warning that it may take a full read". On the library fill: "the 12 shots … from a library, were pretty useless and too generic with no context so we don't need them."
**Changed:** Her go on all of it ("go with your recommendations"). Generating is the read, and only the read:
- **Offline, or out of reads:** GENERATE is disabled with the reason, the brief is kept, and shots are added by hand. A failed read offers TRY AGAIN and + ADD A SHOT BY HAND.
- **Removed:** the brief screen's MATCHED AS YOU TYPE, E5's "Suggest from your format", the template list, the library fill and the kit-only screen. The engine, action coverage and chip matching are deleted; `templates.json` stays for guessing beats and `chips.json` stays unused.
- **A read that comes back short** is asked once more for the missing shots, still one read against the limit.
- **SUGGEST SHOTS FROM THIS KIT** needs a brief and warns it may use a read.

CLAUDE.md's offline rule, design.md §3 and §5.6; case-study-log 2.27.
**Kind:** design call

### 2026-09-23 · v1 gear · Generating failed twice

**Proposed:** The budget fix asked a 5–10 minute read for up to 64 shots, each with a one-or-two-sentence reason, at the default thinking effort. The route allowed 120 seconds, and gave the reader 100 seconds with one retry.
**Rina:** "tried to generate shots 2 times and both times failed, is there something wrong with it?"
**Changed:** Reproduced on the live site: the function was stopped at 120s (FUNCTION_INVOCATION_TIMEOUT), so nothing came back.
- **Faster read:** effort "medium" (READ_EFFORT), and reason lines of one sentence under 25 words.
- **More time:** maxDuration 300s, one attempt with a 280s timeout, and the top-up only if the first read is back within 150s.
- **Timed with her settings:** 61s for 63 shots, about 7¢.

design.md §5.6.
**Kind:** bug caught
