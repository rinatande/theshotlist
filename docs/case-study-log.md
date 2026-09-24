# TheShotList — case study log

A running record of decisions, why they were made, and what evidence exists for each. Kept alongside `design.md`, which is the *spec*; this is the *reasoning*. Started 21 Sep 2026, backfilled from the work so far.

**Target:** portfolio piece for mid-level design engineer roles. That target shapes what's worth keeping — see §4.

---

## 1. How to use this

Each entry has the same shape, because that's the shape a case study needs:

> **What broke** — the problem, stated as something that was actually wrong, not a feature that was missing.
> **Options** — what was considered, including the one that was rejected.
> **Decision** — what was chosen.
> **Why it's evidence** — what this demonstrates about how you work.

An entry only earns its place if something *changed*. Decisions that went the obvious way aren't case study material. The ones where you reversed course are the valuable ones, and they're the ones that get forgotten first.

Where a decision was yours rather than proposed, it's marked **[R]**. This matters: in an interview you'll be asked to defend every choice on the page, and you need to know which ones you drove.

---

## 2. Decision log

### 2.1 Colour carries the emotion, not the structure — 18 Sep

**What broke.** Four visual directions were explored (darkroom, camera report, contact sheet, paper report). Two were liked for opposite reasons: A for its warmth, B for its structure.

**Options.** Pick one and lose half of what worked. Or find out what was actually doing the work.

**Decision. [R]** Combine A's palette with B's structure and typography — which then revealed that the emotional difference between the directions was almost entirely the *ground colour*, not the layout. That finding is what made a two-theme system viable: one structure, two grounds, day and night.

**Why it's evidence.** A designer isolating the variable rather than choosing between bundles. It also sets up the theme system as a *consequence* of a finding rather than a feature someone asked for.

*Artifacts:* eight direction-study boards, still on the canvas as history (rows 1–3). Do not delete these — a case study needs the rejected work.

---

### 2.2 The shot budget is a ceiling, not a target — 18 Sep

**What broke.** Every planning tool's progress meter pushes you to do more. For a videographer the actual failure mode isn't "missed a shot" — it's "spent the whole morning behind a viewfinder and didn't see the place".

**Options.** A target with a progress bar, which is what every app does. Or a range with an upper bound, which behaves differently: silent when you're under, advisory when you're over.

**Decision. [R]** A budget expressed as a range (`18—24`), never a single number, because a range reads as advice and a number reads as a goal. Under budget is silent — an unfinished list is the normal state of a list. Over budget gets one advisory at the foot, once: *"trim now rather than at 6am in the cold."*

**Why it's evidence.** This is the product's point of view, and the strongest single line in the case study. It's a values decision expressed as an interaction rule, and it's defensible in an interview: you can explain what failure mode you designed against and why the conventional pattern makes it worse.

*Artifacts:* `P2-NewProjectFormat`, `P3-ShotListBeats` (deliberately drawn over budget), §5.2 of the spec.

---

### 2.3 The presence model was wrong, and you caught it — 18 Sep

**What broke.** The model asked *"how much of the video is YOU"* — which quietly assumed the videographer is the subject. Shooting a chef who talks to camera, "you: not at all" is true, and would have stripped every talking-head shot out of the list. A correct answer producing a wrong list.

**Options.** Special-case the exception. Or split the concept.

**Decision. [R]** Split `cast` (who the video is about: me / someone else / no one, plus supporting people) from `presence` (how much each of them is in it, four-point scale). You-behind-the-camera becomes its own row defaulting to *not at all*. A side effect worth noting: the conflict rule got *more* accurate — *you: not at all* × *Priya: the subject* × *talking to camera* is no longer flagged, because it's an ordinary client film.

**Why it's evidence.** **This is the best story in the project.** It has the full arc: a plausible model, a concrete case that breaks it, a structural fix rather than a patch, and a measurable improvement in behaviour. It's also the one that shows domain knowledge no one could fake — you knew the case because you shoot.

*Artifacts:* `B5-OnCamera`, `B6-PresenceConflict`, `B7-Cast`, `B8-CastShotList`, canvas note `cnote` (which states the bug in full), §5.8.

---

### 2.4 Never dim with opacity — 18 Sep

**What broke.** Completed shot rows were de-emphasised with reduced opacity. Checked against WCAG: the row's metadata dropped to 2.42:1. The design looked correct and was unreadable.

**Options.** Accept it as decoration. Or find a de-emphasis that survives a contrast check.

**Decision.** De-emphasis is `--ink-muted` plus strike-through, never opacity — recorded as a standing rule in §3 rather than a one-off fix, then applied across three boards. Two other failures found in the same pass: an amber at 2.91 on paper (split into fill-only and text-safe variants), and white frame numbers on light thumbnails at 1.91.

**Why it's evidence.** Verified, not asserted. Every token pair in the system was run through a contrast script and the numbers are in the spec — a table of computed ratios, not a claim that it's "accessible". For a design engineer role this is the right kind of rigour: you wrote the check, ran it, and turned the result into a rule.

*Artifacts:* the contrast table in §4.1, the rule in §3, `scratchpad/check2.py`. **Keep the script — it's proof.**

---

### 2.5 The night theme as a test of the system — 18 Sep

**What broke.** Nothing. This was a deliberate experiment.

**Decision.** The night boards were generated from the day boards by a single-pass regex substitution of eleven semantic tokens — no hand-tuning. If the system were incoherent, that would have produced garbage.

**Why it's evidence.** This is a design *engineer* artifact specifically. It's the difference between "I made a dark mode" and "I built a token system and proved it holds under substitution". Worth stating in the case study with the exact method.

*Artifacts:* `N1`–`N5`, canvas note `nightnote`, the eleven-token table in §4.1.

---

### 2.6 "Setup" was borrowed jargon, and it collided — 18 Sep

**What broke.** The object heading every shot-list group was called a `Setup`. On a crewed set that means one camera position; here it sat next to gear kits and read as one. You asked, in effect, *what is Setup C — is that gear?* Also flagged: "call time" is when crew are required to arrive, which is meaningless working solo.

**Options.** Explain the term better. Or admit the term was imported without being earned.

**Decision. [R]** Rename to `Location`, drop the letters entirely (`Setup C` made you learn a code for something you already know by sight), change "call time" to an optional **start time**, and move the day-count question out of the location screen and into project creation where it belongs. Roughly a dozen boards were updated.

**Why it's evidence.** Two things: domain expertise used as a critique tool, and a willingness to rip up finished work over a word. The cost was stated up front (ten boards) and paid anyway. Interviewers respond to this — most portfolios only show forward motion.

*Artifacts:* canvas note `enote` (records the reasoning permanently), §5.10, `E1`/`E2`/`E3`.

---

### 2.7 Empty states as a pattern, not a screen — 18 Sep

**What broke.** Empty screens were unspecified, which is where most apps quietly fail their first-time users.

**Decision.** A component-level rule: never a blank page, never a single button. Screen chrome stays intact (an empty shot list keeps its header, tabs and `0 / 18—24` counter), then a plain line about what's missing, then **exactly three** routes with the best one named and its reason given, plus one quieter alternative. Nine boards drawn against the rule.

**Why it's evidence.** Systems thinking: one rule, applied consistently, verifiable by looking at the boards. Better than nine one-off screens.

*Artifacts:* `E4`–`E9`, `B0-BriefEmpty`, `P0a`/`P0b`, the pattern in §7.

---

### 2.8 The arrival state of a form is not the form — 18 Sep

**What broke.** `P1-NewProject` existed only in its filled state. Nobody ever sees that. What everyone meets is fourteen unselected chips and a button that can't be pressed.

**Options.** Pre-select sensible defaults so the form is fast. Or leave it blank and make the button dead.

**Decision. [R]** Blank, with the button disabled — because a pre-picked `TRAVEL × SILENT` can be walked straight past, and you'd get an observational travel list for an interview shoot. The cost of a wrong answer here is a whole wrong list, so the form insists on a real one. Two boards drawn: first-ever project (no gear, nothing to copy) and ordinary new project (a quiet *from a past project* route).

Supporting decisions: the name is optional, with the date as placeholder; the consequence box *waits* rather than appearing later; the disabled button always carries a line naming what's missing.

**Why it's evidence.** A clear trade-off decided against the easy option, with a stated reason. Also the origin of the `Disabled primary` component — de-emphasis without opacity again, applied consistently.

*Artifacts:* `P0a-FirstProject`, `P0b-NewProjectEmpty`, §5.1, the component in §7.

---

### 2.9 When does the AI actually run? — 21 Sep

**What broke.** The brief screen showed extracted tags — `BRAND DEAL`, `3 DELIVERABLES` — sitting there while the brief was half-written. You asked how those get created, and pointed out that per-keystroke extraction would burn energy and data. The board was implying live inference and the spec had never said when extraction fires.

**Options.** Confirm on the results screen (cheapest, weakest). A separate `READ MY BRIEF` step (honest, two taps). One button, two phases.

**Decision. [R]** Separate the two paths by cost, because they are not the same interaction:

| | Keyword matching | The full read |
|---|---|---|
| Runs | Continuously, debounced on a typing pause | **Once, on `GENERATE`** |
| Costs | Nothing — local string matching | A request: latency, battery, money |

One press of `GENERATE SHOTS` runs the read and lands on a confirm screen before any shot exists. One request returns structure *and* shots, so a second is only spent if something is corrected. The result is cached against the brief text. Quoted chips and inferred chips are drawn differently, because `SUNRISE` is a word you typed and `3 DELIVERABLES` is a judgement about what a client's sentence obliges you to shoot. Regenerating over an existing list asks before replacing.

**Why it's evidence.** **This is the single most on-target artifact for a design engineer role.** It is not a question about pixels — it's a question about how the system runs, what it costs, and where the human check belongs. Most design portfolios that claim "AI" show a chat bubble. This shows someone reasoning about inference cost, caching, offline fallback, and the placement of a confirmation step relative to an irreversible action. Lead the case study with this if you're aiming at design engineer.

*Artifacts:* `B0-BriefEmpty`, `B1-Brief`, `B9-WhatItRead`, `B10-Regenerate`, §5.6 (which now carries the cost table), canvas note `bnote`.

---

### 2.10 The same content, two frames — 21 Sep

**What broke.** The empty gear state existed only as a standalone library screen, but gear is also the third tab inside a project. Reached that way, dropping the project header and tabs reads as having navigated away.

**Decision. [R]** *(Yours, built directly in the canvas.)* A second version keeping the project header and `SHOTS / LOOK / GEAR` bar, with the screen's own title in a strip below the tabs rather than replacing the project name. The header block was made identical across all tabs.

**Why it's evidence.** You worked in the artifact rather than describing a change — worth saying explicitly in the case study, because it's the design-engineer distinction. The general rule it produced ("an empty tab is a state of the project, not a different place") is now a component in §7.

*Open:* two `<h1>`s on the board; tab spacing specced two ways across boards; the empty-state family isn't wired to its own siblings. All logged, none fixed yet.

---

### 2.11 A consistency pass that turned up an accessibility bug — 21 Sep

**What broke.** Three separate things, all found by looking at one component across every board that used it. The tab bar was specced two different ways (per-tab `margin-right` on seven boards, container `gap` on three) with vertical padding drifting between 10, 11 and 12px. The empty-state screens weren't wired to each other — tabbing from an empty shot list landed you on a *populated* look board. And one board had two `<h1>`s.

**Decision.** One spec for the tab bar, applied to all ten boards that carry it: `gap` on the container, never per-tab margins. Padding raised to `14px` — which is the part that matters, because 12px produced a 41px row, under the 44px touch floor the spec itself sets in §3. A tab looks like text rather than a control, so it's a target people miss *and* don't realise they're missing.

**Why it's evidence.** Two things worth saying in the case study. First, the bug was found by auditing a component across its instances rather than by reviewing screens — that's a design *systems* habit and it's what caught a violation of the project's own stated floor. Second, it's an honest example of drift: the spec said 44px from day one and ten boards quietly didn't meet it. Showing that you found your own violation is more convincing than claiming you never had one.

---

### 2.12 Wrap is not a completion screen — 21 Sep

**What broke.** The app had no ending. Shoot mode went shot to shot, and `[✓] GOT IT` on the last one led nowhere.

**Options.** The conventional ending is a completion screen — `12/12`, a tick, a sense of achievement. Or an ending that follows from the budget argument in 2.2.

**Decision.** Not a celebration. The headline is the count and one line tying it back to the *cut* rather than to effort: *"There's nothing you have to chase tomorrow."* Exposed shots collapse to a number; the screen's attention goes to the two groups that need a decision — flagged, and not shot — and unshot shots never silently disappear.

The blocked version, for an outstanding `[★]`, has an escape: `WRAP ANYWAY — I'LL TELL THEM`, with its consequence stated. **One change from the agreed plan:** it called for a disabled `WRAP` button above the escape. Drawn, it read as two controls for one action, with the dead one purely decorative. The reason line stayed, the dead button went.

**Why it's evidence.** Two things. The product's thesis carried consistently from the first screen (budget as ceiling) to the last (wrap as "enough") — that coherence is what makes a case study read as a point of view rather than a feature list. And the plan-versus-drawn deviation is a small, honest example of the design changing once it existed on screen. Worth a sentence in the write-up: it shows you judge the artifact, not just the spec.

*Artifacts:* `W1-Wrap`, `W2-WrapBlocked`, canvas note `wnote`, §5.12.

---

### 2.13 "Where do kept shots go?" — 21 Sep

**What broke.** Two things, found by one question. First, the last-day case: `MOVE TO DAY 3` has nowhere to go on a single-day shoot or the final day. Second, and more important, you asked what `KEEP` actually does — can you still wrap, and where do the shots go? There was no good answer. `MOVE` and `DROP` each named a destination; `KEEP` didn't, and on day 2 it would have left a shot stranded on a closed day.

**Options.** For the last day: grey out `MOVE`, offer *add a day*, or remove it. For `KEEP`: redefine it as open on the project, as a saved-for-another-shoot list outside the project, or both.

**Decision. [R]** A rule — *every option at wrap names where the shot goes* — resting on one distinction: **wrap closes a day, not a project.** `KEEP OPEN` moves a shot off the day and onto the project with no day; the Projects list shows `N OPEN` until it's resolved. On the last day `MOVE` is removed, not greyed out, because the only live alternative (*add a day*) would nudge you to extend the shoot. And the default follows the budget: in range it's `DROP` with *"You have enough for the cut"*; under range it's `KEEP OPEN`.

**Why it's evidence.** A good interview story because the question was simple and the answer changed the model. It's the same shape as the presence bug (2.3): a control that looked complete until someone asked what it *did*. And the budget-driven default is the product thesis reaching the last decision in the flow — worth pointing at explicitly, because consistency of a point of view across fifty screens is hard to fake.

**Then reversed. [R]** You came back to it: *if I keep a shot, can I still wrap — and if I can, what's the point?* The honest answer was that "keep" reads as *leave it where it is*, which is today, which means don't wrap — the same word-says-the-wrong-thing trap as "Setup". The underlying case (a pickup long after the shoot) was worth asking about directly, so the question became a behavioural one: how often do you actually go back for a missed shot? *Rarely.* So `KEEP` went. Two options on a middle day, `MOVE` and `DROP`; on the last day no chips at all, because one option is a confirmation. `DROP` became reversible — struck through in the record, un-droppable — which covers the rare pickup without a third button. The budget-driven behaviour survived, moved from the default to the sentence.

**Why the reversal is the better story.** The first decision was defensible and got shipped to the canvas. It then failed a plain-language test from you — the person the product is for — and the resolution came from asking about your *behaviour* rather than your preference. That's a research move made inside a design review — worth telling in exactly that order, including the version that was wrong.

*Artifacts:* `W1-Wrap`, `W2-WrapBlocked`, `W3-WrapLastDay` (all now `MOVE` / `DROP`), §5.12 including *Why there's no third option*, canvas note `wnote`.

---

### 2.14 A gear that doesn't open settings — 21 Sep

**What broke.** Projects could be created but never edited or deleted. The ask was a settings icon beside the project title opening a sheet with *Edit* and *Delete*.

**Options.** A gear, as first described. A `⋯` (more). Or a text label, to match the all-text interface.

**Decision. [R]** `⋯`. The app already has a Settings screen for theme and time format; a gear here would have meant two different kinds of "settings", and the icon would promise one thing while doing another — the same failure as "Setup" (2.6), this time in an icon rather than a word. Two further calls, both yours: the delete confirmation says what's lost (*"12 shots, 3 days and the brief go with it. This can't be undone."*), matching how every other destructive action in the app explains itself; and editing a project that already has shots shows a `CHANGES` box before saving, so nothing moves silently. That last one turns open problem 15 from theoretical into drawn.

**Why it's evidence.** A small one, and useful precisely because it's small: it shows a lesson from earlier in the project (words that promise the wrong thing) being applied unprompted to a new medium (an icon). Consistency of judgement across a project is harder to show than any single good decision.

*Artifacts:* `A1-ProjectMenu`, `A2-ProjectDelete`, `PE1-EditProject`, `PE2-EditProjectFormat`, the `⋯` on ten project screens, §5.14, canvas note `mnote`. (Boards renamed from `M1`/`M2` on 21 Sep so they don't collide with the build's milestone names.)

---

### 2.15 Required shots count toward the budget — 21 Sep

**What broke.** Nothing on screen — it came up in the pre-build review. §5.7 kept `[★]` deliverables outside the shot budget so an over-budget warning could never read as "drop one of these". Asked directly, you saw the budget differently: it's a rough guide to how many shots cover the cut, and a contracted shot is still a shot you'll take. Leaving three of them out made a busy day look lighter than it was.

**Options.** Keep them outside (the spec). Count them and drop their separate counter. Count them and keep the protection.

**Decision. [R]** Count them in the total, keep `★ 0/3` alongside, and make the over-budget advisory never suggest cutting one. Required shots also take no number: the ★ is the identity. The original worry is answered by the advisory's wording rather than by the arithmetic.

**Why it's evidence.** The first rule solved a copy problem with a data rule. The better fix put the protection where the risk actually was — in what the warning says — and let the count be honest. A small example of separating what a number *is* from how it's *presented*.

---

### 2.16 A flag is a line, not a status — 21 Sep

**What broke.** The status control carried three marks — `[ ]`, `[✓]`, `[!]` — with long-press for the flag, while §5.7 also gave long-press to `[★]`. One gesture, two meanings. Meanwhile several boards already showed the flag as a `! NO COVERAGE YET` line under the subject.

**Decision. [R]** The status column only ever shows `[ ]` or `[✓]`. A flag becomes a `!` line with its note under the subject, set by `FLAG` in shoot mode (which asks for the note), cleared from edit shot, decided at wrap. Long-press does nothing in v0, to be revisited in v1.

**Why it's evidence.** The boards had quietly drifted to a better answer than the spec. Taking the drawn version, and removing a gesture rather than resolving its conflict, is the kind of simplification that only shows up when the design is read as a system.

---

### 2.17 Sun times from a place name — 21 Sep

**What broke.** Three screens depend on the sun — light-aware start times (E1), `LIGHT GOES` in shoot mode (N4), and Auto's sunset switch (§9) — and none of them said where the coordinates came from. `where` is free text, and a place name can't be turned into a latitude offline.

**Options.** Hide the light lines in v0. Phone location only. Look the name up once online, then work offline, with phone location as the other way in.

**Decision. [R]** The last. The place name is geocoded once (Open-Meteo, free, no account) and the coordinates are stored; sun times are calculated on the device with no library. With neither source the lines are absent rather than broken. The trade — a place name leaves the device — is written into the spec (§10, 21) so the privacy note says it.

**Why it's evidence.** An offline-first promise tested against a feature that needs the world. The answer was to find the one piece of data that needs the network, fetch it once, and keep everything downstream local.

---

### 2.18 Settling the rest before code — 21 Sep

**What happened.** A pre-build review of the spec against the boards turned up 23 questions. Most were gaps rather than defects: no budget table, no numbering rule across days, no definition of a coverage gap or a duplicate, no behaviour for `SKIP`, no place for the theme setting to live before first paint. They were answered in one pass. **[R]** on each, except where you left it to judgement.

**Decisions worth naming.** One project brief in v0 (per-day briefs wait until they prove they're needed). Generate to the top of the budget, since cutting is easier than inventing on set. Numbers run continuously across days. A guessed beat for hand-added shots. Gear-free suggestions until gear ships. Project edit and delete moved into v0 because the designs existed.

**Why it's evidence.** The review is the artifact: a spec checked line by line against its own boards before a line of code, with each gap either closed or written into §10 by number. It's the handover between the design half and the engineering half of the project.

---

### 2.19 The chips were the tab bug again — 21 Sep

**What broke.** Building step 1 of new project from the boards, every chip came out 35px tall: 9px padding around 12px type. The §3 floor is 44px, and it's the same failure as the tab bar (2.11) — a control that reads as text, so nobody notices it's small. Kind, treatment, length, aspect, days and the Projects filters all use chips, so this was most of the tappable surface on the first screens a new user meets.

**Decision.** Chips take their height from `min-height: 44px`, not padding, so they look as drawn and meet the floor. §7's chip row now says so. A second rule came with it: a chip that can't be picked yet (SOMEONE ELSE, NO ONE in v0) is muted with a dashed edge and a line saying why — never dimmed.

**Why it's evidence.** The first bug was found by auditing a component across boards; this one was found by building it. Same defect, two different ways of catching it — which is an argument for doing both.

---

### 2.20 The font didn't have the status marks — 22 Sep

**What broke.** Appendix B specified JetBrains Mono subset to "Latin + the glyphs used in status codes". The build's first page carried a check that measured every non-ASCII glyph the boards use, and it showed the premise was false: Google's build of the font has no `✓` and no `⋯`, serves `←` in no subset, and no build has `★`. The app's signature marks — the thing §4.4 calls load-bearing — were being drawn by whatever font each phone fell back to.

**Options.** Accept the fallback. Self-host the upstream font (it has `✓ ⋯ ← ⋮ ✕`). For `★`: the fallback, the font's own `✶`, or a drawn star. All three stars were rendered side by side in the real font.

**Decision. [R]** Upstream JetBrains Mono, self-hosted, three weights. `★` drawn as an inline SVG one mono cell wide at the brackets' weight — `✶` read as an asterisk at row size, and the fallback looked borrowed. Rina picked the drawn star from the comparison.

**Why it's evidence.** A spec assumption tested by the first line of code rather than trusted. The check was cheap — a canvas measurement on a throwaway page — and it caught a defect that would have shipped invisibly on the designer's own machine, where a system font happened to have the glyphs. It's also a case of the design's own rule ("one family") being defended in code when the easy path was to let the browser quietly break it.

### 2.21 Paying for the read, and what "read once" has to mean — 22 Sep

**What broke.** Three things, once the read was a real request. First, cost: the spec treated the read as an enhancement, and was silent on who pays for it in an app anyone can open. Second, the promise on B9, *"It won't run again unless you change the brief"*, was false as first built: the cache key included the plan, so adding the read's own 24 shots changed the planned count, and opening the screen again bought a second read. The browser test caught it, not a unit test. Third, B10's `REPLACE ALL N` board clears shots already marked exposed.

**Options.** For cost: Opus 5 for everyone, a per-brief cap on regenerating, a cap on the number of briefs, or sign-in for more. The alternative was Sonnet 5 plus layered limits. For the cache: hash the plan and change the copy, or hash only the brief text and keep the copy. For B10: build the board, or keep exposed shots.

**Decision. [R]** Rina compared Opus 5 and Sonnet 5 on her own coffee-machine brief and judged Sonnet "more than enough for all users", keeping Opus for a possible paid tier. The limits are layered so no single one has to be harsh:
- a $2 daily ceiling across the app;
- a spend limit in the Anthropic console;
- 5 reads a day per phone, with 15 per network address as a backstop;
- invite links worth 25 reads over 14 days, for the people she sends it to with job applications.

There's no sign-in, which keeps §3's "no account needed". The hash covers the brief text alone, so the copy stays true. B10 replaces only what isn't shot, and the button says so: `REPLACE — KEEP WHAT'S SHOT`.

**Why it's evidence.** The design's cost argument — *once on `GENERATE`, never per keystroke* — became a real budget. The limits fall back to the offline path the design already guaranteed, so running out of reads degrades the list rather than breaking the app. And a line of interface copy was treated as a contract the code has to keep, rather than rewritten to match what the code happened to do.

### 2.22 A list that arrives in one place and has to be moved one shot at a time — 22 Sep

**What broke.** The designed route is brief first, then generate; locations are optional (§5.10). So the normal first list had no locations, and every generated shot landed in `UNPLACED`. Rina made a location and then edited forty shots one by one to put them in it. No board showed moving more than one shot, because every board started from a list that was already placed.

**Options.**
- A select mode on the list, with a bulk move.
- Asking for locations before generating, which puts a form in front of the part of the app that works.
- Letting the online read name the places, since it already knows where the brief happens.

**Decision. [R]** Both of the first and last, before shoot mode, because shoot mode walks the running order and a list stuck in `UNPLACED` makes it worse too. The select mode reuses wrap's bulk row (`ALL N` plus tick one to change one) rather than inventing a pattern. The move sheet can create a location by name, so the forty-shot case is four taps: `SELECT`, `ALL 24`, a name, `MOVE`. The read suggests locations only when there are none, marks them `NEW` on B2, and creates each once, when the first shot needing it is added. On a real brief it proposed Harbourside, Fish market and Flat, and all 24 shots arrived placed.

**Why it's evidence.** A gap only a real run could show: every screen was right on its own, and the fault was in the path between them. Rina found it by using the build rather than reviewing it. The fix came from the existing system, the wrap bulk row and the read's own schema, rather than a new idea.

### 2.23 The canvas follows the code — 23 Sep

**What broke.** Five milestones in, the boards and the build had drifted apart. Each gap was recorded in design.md as "not drawn" or "as built", so nothing was lost. But the canvas still showed the earlier design:
- B10 replacing exposed shots;
- N4 with a flagged shot in its queue;
- no drawing of select mode, the move sheet, a wrapped day's record, shoot mode with everything through, the one-shot wrap sheet, or the brief with no reads left.

A case study that shows the canvas shows a design that didn't ship.

**Options.**
- Leave the canvas as the original intent and let design.md carry the differences, so the gap is visible but you have to read a spec to find it.
- Treat the canvas as the source and change the code back to match.
- Redraw the canvas from the build.

**Decision. [R]** Redraw from the build: 24 boards updated, and six added:
- `SL1` select mode;
- `SL2` move sheet;
- `WD1` day record;
- `N4b` shoot mode, everything through;
- `W4` the not-shot sheet;
- `B1b` the brief with no full reads left.

Rina's rule: "Code is what's real; the canvas records where the design ended up." The original direction is still in the log and the build journal, which say why each board changed.

**Why it's evidence.** It settles which artifact is the source of truth, and says so. The design didn't stop at handoff. Five milestones of decisions made in code went back into the design artifact, rather than leaving the canvas as a record of intent and the spec as a list of exceptions. It also makes the portfolio honest: every board shown is a screen that exists, and the changes between versions are written down (2.14–2.22, and the build journal) rather than silently overwritten.

*Artifacts:* `docs/boards/`, 24 updated and 6 new (`SL1`, `SL2`, `WD1`, `N4b`, `W4`, `B1b`); build-journal, 23 Sep.

### 2.24 Packed means what's coming, not what's in the bag — 23 Sep

**What broke.** §6.1 made `packed[]` both the engine's input and, on G4, the packing checklist: `IN THE BAG · 5 / 7`, ticked as items go in. The two jobs happen at different times. You plan a shot list days before a shoot and pack the morning of it. With one list doing both, every suggestion made while planning would be gear-free, because nothing is packed yet. And ticking the bag would quietly change the suggestions.

**Options.**
- Keep one list and accept gear-free planning.
- Suggest from the packed items once anything is ticked, and from everything before that.
- Split the jobs: suggestions from what the shoot is *bringing* (G3's bands), and IN THE BAG as a checklist only.

**Decision. [R]** Split them. `Project.gear` is what's coming, as copies of library items: a snapshot, so selling a lens never rewrites an old list. `packedIds` is only the checklist.

**Why it's evidence.** The model read cleanly on paper, and the clash only showed when the build had to decide what the engine reads *at the moment you plan*. The fix keeps both boards exactly as drawn and changes only what each one is for. It also keeps the §6 principle that gear generates and never polices: a checklist that changed your suggestions would have been gear policing through the back door.

### 2.25 Gear has to go through the brief — and frame rate is a choice, not a spec — 23 Sep

**What broke.** The gear stage shipped as G5 and G6 were drawn: suggestions from the kit and the format. Rina tried it and said it was "not cutting it". Without the brief, a kit can only suggest what's *possible*, so a coffee vlog was offered a drone top-down and hair in the wind in slow motion. Two more gaps came from the same test:
- **Gear arrived too late.** It could only be picked once the project existed, so the first GENERATE never knew the kit.
- **The camera's spec made the choice.** A camera that shoots 120fps got slow-motion suggestions, but Rina shoots a slow-life vlog "everything in 24 fps … real time is what I'm after".

**Options.**
- Tune the gear ranking.
- Make gear feed the brief's path instead of having its own.
- For frame rate: an advanced setting on the camera, or a plain choice on the project.
- For where it goes: two rows on the format step, or a third step.

**Decision. [R]** Gear feeds the brief, and doesn't replace it:
- **Kit suggestions go through the brief:** the read with signal, the brief's words offline. A gear-earned shot has to be backed by the brief to appear.
- **New project gets a third step (frame rate and gear).** Rina's call over my two extra rows on P2, "to make each step clearer". She also added 120 "so we can get slow motion".
- **Frame rate lives on the project.** At 24, 25 or 30 nothing slow is suggested, whatever the camera can do.
- **Filters are gear.** Only the ones that change what's possible touch the suggestions.

**Why it's evidence.** The boards were followed exactly, and the result was still wrong. That's the useful kind of failure: G5/G6 showed gear working *in isolation*, and the moment it met a real brief the isolation was the bug. The fix came from how Rina actually shoots, not from the spec. Frame rate is the clearest case: the camera could shoot slow motion, but the person had decided not to, and a tool that suggests what the camera can do instead of what you've chosen gets in the way.

### 2.26 A ceiling for the person, a target for the machine — 23 Sep

**What broke.** §5.2 says the budget is a ceiling, not a target: under budget is silent, and the app never pushes you to shoot more. §5.6 says generating fills to the *top* of the budget. Both are right, for different readers. The read's instructions carried the person's version to the machine: "up to the number… fewer if the brief doesn't honestly support more". With gear added, a 5–10 minute cut that needs 48–64 shots came back with 26. Rina: "roughly half of what I need and would be considered a failure."

**Options.**
- Pad with library shots after every read.
- Ask the model for more and hope.
- Give the model a number, and say how a longer cut earns its shots.

**Decision. [R]**
- **The read is given a count and a floor.** It's told that length is filled with coverage — each moment a wide, a medium, hands, the detail that shows it worked, a way in and out — not with more topics. Gear changes how you shoot a moment, not how many you cover.
- **A floor that can't be missed.** A read that still comes back short is filled from the brief-matched library.
- **Offline, the same idea:** the brief's actions are covered more ways as the budget grows.

On Rina's brief and settings, the read went from 26 (48 on a re-run of the old prompt) to 64 with no padding, and offline from 34 to 52.

**Why it's evidence.** The same principle needed opposite phrasing depending on who it was addressed to. That's a design-engineering problem specifically: the spec was right, and the prompt translated it wrongly. It was caught by the designer testing her own real use case against a number she knew — the budget she had set.

### 2.27 Giving up the offline list — 23 Sep

**What broke.** §3 and §5.6 promised that "a brief typed in a valley with no signal still produces a list", with keyword chips, templates and the brief's actions covered generically on the phone. It was built, tested and tuned: coverage that grew with the budget, gear shots that needed the brief's backing, and the library filling a short read. Rina then used it on her own briefs next to the online read and called the phone's lists "so out of context and pretty much unusable". A library fill of twelve shots under a short read was "too generic with no context". The offline promise was producing lists nobody would shoot from.

**Options.**
- Keep improving the offline engine: more templates, smarter matching.
- Keep it as a labelled fallback.
- Drop offline generation, and keep everything else offline.

**Decision. [R]** Drop it. Rina's reasoning was about how the app is actually used: "Users can set up everything the day before and then on shoot day go offline mode if they need."
- **Generating is the read only.** Offline or out of reads, the app says why and offers to add shots by hand.
- **A short read** is backstopped by asking the read for the missing shots, never by the library.
- **The engine code is deleted.** The template and chip data are kept, unused, for the read's examples later.

**Why it's evidence.** It's the design's founding promise, dropped on evidence rather than defended out of loyalty to the spec. The promise was sound as an idea — shoots happen where there's no signal — but it bundled two things: *using* the list offline, which matters on the day, and *making* it offline, which happens the day before at a desk. Splitting them kept what mattered and removed what didn't work. It also shows the other side of 2.21 to 2.26: several rounds of making the offline engine better were worth less than one honest look at whether anyone would use its output.

### 2.28 The canvas follows the code, a second time — 24 Sep

**What broke.** A day after the first sync (2.23), the canvas was behind again, and in a sharper way. The changes since weren't refinements; they reversed boards:
- **Generating went online-only** (2.27), so B0, B1, B9 and E5 still promised an offline list that no longer exists.
- **G5 and G6** — the pocket-versus-rig comparison §6.3 calls the argument for gear — showed a kit-only suggestion screen the build had removed (2.25).
- **Three screens had no board at all:** the new project's third step, the read's live progress, and the read's failure screen.

**Options.**
- Leave the reversed boards as the record of the original intent.
- Delete them.
- Redraw from the build, keep the reversed boards, and mark them removed.

**Decision. [R]** Redraw and mark.
- **New boards:** `R1` (reading, live progress), `R2` (read failed) and `P4` (new project 3/3, frame rate and gear).
- **Updated to match the build:** `B0`, `B1`, `B1b`, `B9`, `E5`, `P1`, `P2`, `PE1`, `PE2`, `G2`, `G4` and `NG4`.
- **Kept but marked removed:** `G5` and `G6`, not deleted.

The rule from 2.23 held: code is what's real, and the canvas records where the design ended up.

**Why it's evidence.** A second sync a day later shows the practice is a habit, not a one-off tidy-up. Keeping G5 and G6 on the canvas, marked removed, is the interesting choice. They were the boards that made the case for gear, and the build proved that case wrong in practice. A portfolio that deletes its reversed work hides the part of the process worth showing; this one keeps it, labelled, next to what replaced it.

*Artifacts:* `docs/boards/` — `R1`, `R2`, `P4` new; 12 boards updated; `G5` and `G6` marked removed. Build journal, 24 Sep.

---

## 3. Artifact inventory

| Artifact | Where | Case study use |
|---|---|---|
| Design canvas, ~50 boards | Design artifact, 11 labelled rows | The main visual. Rows read as a narrative already. |
| `design.md`, ~650 lines | This folder | Proof of systems thinking. Excerpt the token table and §5.6, don't reproduce whole. |
| Direction study, 8 boards | Canvas rows 1–3 | Rejected work. **Do not delete.** |
| Canvas notes (`enote`, `cnote`, `bnote`, `f1`–`f12`) | On the canvas | Reasoning captured at the time. The `f1`–`f12` flow audit is unusually good portfolio material — it's a designer auditing their own coverage and naming the gaps. |
| Contrast script + output | `scratchpad/check2.py` | Evidence over assertion. |
| Version history | Artifact, 30+ versions | Shows iteration. Worth exporting a few before/after pairs. |
| This log | This folder | Your interview prep. |

---

## 4. What's missing — honestly

Four gaps between where this is and a case study that lands a mid-level design engineer role.

**It isn't built.** This is the whole ballgame for the role you're aiming at. Screens are table stakes; a working PWA someone can open on their phone is the differentiator. Everything above is evidence of *design* rigour — the code is what makes the title claim true.

**The AI is specified, not running.** When a job ad says "built something with AI", hiring managers mean shipped, not designed. §5.6 describes a hybrid extraction system with an offline fallback and a caching rule. Building it — even small, even rough — converts the strongest section of this case study from a proposal into a thing that works. The offline keyword path is a weekend; the read is an API call and a confirm screen.

**n = 1.** Every insight so far is yours, which is legitimate — you're the user — but a mid-senior case study with no other voices gets read as an exercise. Three conversations with other videographers would transform it, and would very likely break something, which is the point. The presence-model bug is exactly the kind of thing a fourth person finds.

**No evidence of outcome.** Hard on a personal project. The substitutes available: the contrast numbers, the coverage audit (`f12` tracks gaps closed against gaps remaining), and — once it's built — one real shoot planned with it, with the list before and after.

---

## 5. Capture checklist

Things that are cheap now and unrecoverable later.

- [ ] Export the four direction-study boards as images before the canvas gets tidied
- [ ] Export before/after pairs: the `Setup`→`Location` rename, the presence model, the brief screen
- [ ] Keep `check2.py` and a saved run of its output
- [ ] Screenshot the `f1`–`f12` flow audit at a couple of points in time — the gap count moving is the story
- [ ] When the build starts: commit messages that say *why*, not *what*. They become the engineering half of the case study for free.
- [ ] One paragraph, written the day it happens, whenever something gets thrown away

---

## 6. When we get to code

Worth deciding deliberately, because each is a case study beat:

- **Framework and why** — a reasoned choice beats a fashionable one, especially if the reason is "offline-first PWA with no server requirement".
- **How the tokens become code** — CSS custom properties mapping 1:1 to the eleven semantic tokens keeps the day/night substitution argument alive in the build.
- **Where the model call lives** — the §5.6 architecture is already specified. Building it as specified, and saying so, is the strongest possible link between the design and the engineering halves.
- **What you measure** — first-paint offline, time from opening the app to a usable list. Two numbers beat a page of adjectives.
