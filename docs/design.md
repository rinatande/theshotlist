# TheShotList — Design

**Status:** Direction locked. Visual system defined, key screens specified in both themes. Gear, project format, day briefs, deliverables, cast, locations, empty states and account modelled.
**Direction:** *Paper Report* (day) and *Camera Report* (night) — one structure, two themes.
**Last updated:** 21 September 2026

---

## 1. What we're designing

TheShotList helps a videographer walk onto a shoot already knowing what they're going to capture — and walk off knowing they didn't miss anything.

Two jobs that pull in opposite directions:

| Job | Emotional state | Design demand |
|---|---|---|
| **Inspire me** — before the shoot: browsing, collecting, building a look | open, unhurried, visual | imagery leads, generous space, discovery |
| **Don't let me miss a shot** — on the day: one hand, bad light, no time | tense, task-focused | dense, glanceable, huge tap targets, high contrast |

### Design principles

1. **The frame is the hero.** Reference images sit on the page without chrome fighting them. Colour lives in the imagery; the UI is near-monochrome plus one signal colour.
2. **Retro through structure, not stickers.** Grid, type, rules and labelling conventions — not drop shadows or faux texture. Delete every decorative element and the design should still read as retro.
3. **Legible in sunlight, survivable in the dark.** This is what the two themes are for. Body text never below 15px, tap targets never below 44px, AA contrast everywhere, no colour-only status.
4. **Complete is a feeling.** "Nothing missed" needs a visible payoff — a mark, a strike-through, a counter that resolves.
5. **Quiet by default, loud when it matters.** One accent, spent on: unshot vs exposed, coverage gaps, the primary action.

---

## 2. The direction

**Paper Report by day, Camera Report by night.** The same structure — all-monospace, zero radius, hairline rules, table rows, bracketed status codes — rendered on two grounds.

| | Day | Night |
|---|---|---|
| Ground | Warm paper `#F2EBDD` | Near-black `#0C0E0D` |
| Reads as | A printed camera report | An instrument |
| Best for | Daylight, planning at a desk, client-facing | Low-light sets, night shoots, cinemas |

This isn't a light mode bolted onto a dark design. Both grounds were designed first and the structure was built to carry either, which is why the night screens are the day screens with one token set swapped and nothing else changed. That's the test of the system, and it holds.

**How we got here** — four directions were explored (see Appendix A). A (*Darkroom*: warm paper, condensed caps, serif notes, film stamps) and B (*Camera Report*: dark, all-mono, zero ornament) both landed; C (*Contact Sheet*) didn't. D put A's palette on B's structure, which revealed that the ground colour was carrying almost all the emotional difference between the two. Shipping both grounds as themes gets A's warmth and B's on-set performance in one build.

---

## 3. Foundations

### Platform

Mobile-first, responsive up to desktop, **built as an installable PWA** so it lives on the home screen without an app store.

- Everything works at 375px wide. Single-file-per-route, no heavy framework lock-in.
- `manifest.json` with maskable icon, `display: standalone`, `theme_color` matching the active theme (updated by the theme switch so the OS chrome follows).
- Service worker, offline-first. **Shoots happen where there's no signal.** A shot list already opened is fully readable and checkable offline; edits queue and sync later. The Settings screen shows how many projects are cached.
- Safe-area insets respected. Primary actions live in the bottom thumb zone, never the top corners.
- No hover-dependent affordances. Anything revealed on hover on desktop has a visible or long-press equivalent on touch.

### Spacing

4px base unit. Scale `4, 8, 12, 16, 20, 24, 32, 48, 64`. Screen gutter 20px on mobile, 24px tablet, 32px+ desktop. Row padding 13–16px vertical.

### Grid

Mobile: single column. Tablet: 2-col reference grids. Desktop: 12-col, max content width 1200px, reference grids 4–5 across. Where a grid is used it is `repeat(N, minmax(0, 1fr))` with a `gap` — never floats or fixed widths.

### Type scale

Ratio 1.25, base 16px: `11 / 12 / 13 / 15 / 16 / 20 / 25 / 28 / 31`. Body never below 15px. 11–12px is reserved for uppercase tracked labels, which stay legible small because they're short and spaced.

### Motion

Fast and mechanical — the reference is a camera mechanism, not a rubber ball.

- 120ms state change · 200ms enter/exit · 320ms sheet or page transition.
- Easing `cubic-bezier(0.2, 0, 0, 1)`.
- **Signature motion:** marking a shot exposed fills the `[ ]` left-to-right in a 120ms wipe, then the row settles to its muted state. It's the app's payoff moment and it's the only place motion is allowed to be noticeable.
- Theme change cross-fades ground and ink over 200ms. No transform, no slide.
- Full `prefers-reduced-motion` fallback: opacity only.

### Accessibility floor

- WCAG AA minimum on all text; AAA on body copy wherever the palette allows. Every pair in §4.1 is verified.
- **Status is never colour alone.** `[ ]` / `[✓]` / `[!]` carry the meaning; colour reinforces it.
- **De-emphasis is never opacity.** A captured row drops its text to `--ink-muted` and strikes the subject through. Lowering opacity on a whole row drags the metadata under AA — this was a real defect caught in the first pass.
- Focus rings 2px, offset 2px, in `--accent`, visible in both themes.
- Real `<button>`, `<a href>`, `<input>` + `<label>` throughout. `aria-label` on every icon-only or symbol-only control.

### Core object model

`Project` → `Location` (§5.10) → `Shot`, plus an `UNPLACED` bucket for shots with no location. A `Shot` carries reference, size code, subject, lens, support, movement, audio, note, status. A `Project` also carries a `Look` (the reference collection), a `Format` (§5) and a `Gear` set (§6). A multi-day `Project` gains a `Day` layer above `Location` (§5.9), and every day carries its own brief. A `Cast` (§5.8) sits on the `Project`, not the `Day`, and each member of it carries a presence level. Format, gear and the brief are the three inputs to the suggestion engine; the look board is where its output gets judged.

---

## 4. Visual system

### 4.1 Themes and tokens

Semantic names, two value sets. Nothing in a component references a raw hex.

| Token | Day | Night | Role |
|---|---|---|---|
| `--ground` | `#F2EBDD` | `#0C0E0D` | app background |
| `--band` | `#E9E0CC` | `#141816` | section header bands, grouped headers |
| `--field` | `#FBF6EA` | `#1A1F1C` | input and textarea fill |
| `--ink` | `#1C1714` | `#E8EDE9` | primary text |
| `--ink-muted` | `#6B5F52` | `#8A948E` | secondary text, metadata, captured rows |
| `--ink-faint` | `#4F463A` | `#A8B2AC` | text on `--band` |
| `--rule` | `#D8CDB8` | `#262C29` | hairlines, dividers, inactive borders |
| `--accent` | `#A83B2A` | `#FFB020` | primary action, active tab, selected state |
| `--accent-ink` | `#F2EBDD` | `#0C0E0D` | text on an `--accent` fill |
| `--ok` | `#3F5B46` | `#5BE39D` | exposed, complete, progress fill |
| `--warn` | `#8F4F0C` | `#FF7A45` | coverage gap, flagged shot |

**Verified contrast** (text on `--ground` / on `--band`):

| Token | Day | Night |
|---|---|---|
| `--ink` | 14.98 / 13.54 ✓ AAA | 16.34 / 15.12 ✓ AAA |
| `--ink-muted` | 5.23 / 4.73 ✓ AA | 6.19 / 5.72 ✓ AA |
| `--accent` | 5.33 / 4.81 ✓ AA | 10.59 / 9.80 ✓ AAA |
| `--ok` | 6.33 / 5.72 ✓ AA | 11.92 / 11.02 ✓ AAA |
| `--warn` | 5.38 / 4.86 ✓ AA | 7.49 / 6.93 ✓ AA |
| `--ink-faint` on `--band` | 7.05 ✓ AAA | 8.22 ✓ AAA |
| `--accent-ink` on `--accent` | 5.33 ✓ AA | 10.59 ✓ AAA |
| `--ink` on `--field` | 16.47 ✓ AAA | 14.10 ✓ AAA |

Two colours are deliberately *not* interchangeable across themes: day's accent is red and its warning amber; night inverts them (accent amber, warning orange-red). Red on near-black reads as an error state; amber doesn't. The semantic slot is stable even though the hue flips.

**Implementation.** Tokens on `:root`, redefined under `[data-theme="night"]` and under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="day"])`, so Auto works without JS and an explicit choice always wins.

### 4.2 Typography

**JetBrains Mono**, and only JetBrains Mono. Weights 400, 500, 700.

| Role | Size | Weight | Tracking | Case |
|---|---|---|---|---|
| Screen title | 20px | 700 | 0.08em | UPPER |
| Screen label (a step or mode heading in the header bar — *New project · 2/2*, *Wrap · Day 2 of 3*) | 13px | 700 | 0.12em | UPPER |
| Shot detail title | 20px | 700 | 0.02em | Sentence |
| Shoot-mode subject | 28px | 700 | 0.01em | Sentence |
| Body / notes | 15–16px | 400 | 0 | Sentence |
| Row subject | 15px | 400 | 0 | Sentence |
| Section label | 11px | 700 | 0.14em | UPPER |
| Control label | 12px | 500–700 | 0.10–0.12em | UPPER |
| Metadata | 11px | 400 | 0.06em | UPPER |
| Data / codes | 12–14px | 500–700 | 0 | UPPER |

Line-height 1.55–1.6 on body — mono needs more leading than it looks like it does. `font-variant-numeric: tabular-nums` on every counter and progress figure so digits don't jitter as they tick up.

One family is a real constraint and the point of the direction. It's also a PWA win: one woff2 subset, self-hosted in the service worker cache so type renders offline.

### 4.3 Surface rules

- **Radius 0.** Everywhere. No exceptions.
- **1px `--rule` hairlines do all the separating.** No shadows, no elevation, no card fills for grouping.
- **`--band` fill marks section headers only** — location groups, settings groups. Never a content background.
- **Paper grain** (day only): a radial-dot overlay at ~7% opacity, 3px pitch. It's what stops the ground reading as flat off-white. Night has no grain — `--grain` is `transparent` there, matching the night boards. (An earlier draft gave night the same overlay in light ink, as sensor noise; the boards never drew it, and the boards won.)
- **No texture beyond that.** No scanlines, no sprockets, no stamps — those belonged to the directions we didn't take.

### 4.4 Status language

The bracketed code is the system's signature and it is load-bearing, not decorative.

| Code | Meaning | Colour |
|---|---|---|
| `[ ]` | planned, not yet shot | `--ink-muted` |
| `[✓]` | exposed | `--ok` |
| `[!]` | flagged, or a coverage gap — used in wrap and shoot mode, **not in the shot row's status column** (below) | `--warn` |
| `[★]` | required — a contracted deliverable (§5.7) | `--accent` |

An exposed row additionally strikes its subject through and drops all its text to `--ink-muted`. That's two non-colour signals plus colour — it survives greyscale, glare, and colour-blindness.

**A flag is a line, not a status mark.** On a shot row the status column only ever shows `[ ]` or `[✓]`. A flagged shot keeps its `[ ]` and gains a warning line under the subject, in place of the meta line: `! NO COVERAGE YET` — the `!` plus the flag's note, 11px UPPER in `--warn`. The `!` and the words carry the meaning, so it's still never colour alone. The flag is set with `FLAG` in shoot mode (which asks for the note), cleared from edit shot, and decided at wrap (§5.12). Moving it out of the column keeps the column a single binary — shot or not — which is the thing you scan for.

---

## 5. Project type and format

Two projects can share a location, a camera bag and a genre and still need completely different lists. A silent travel reel and a talking-to-camera travel vlog have almost nothing in common as shoots. Project setup asks three things, and each one changes what the app does afterwards.

### 5.1 Genre × treatment

Two pickers, not one list of pre-named styles.

```
genre      travel | documentary | brand | event | tutorial | personal
treatment  talking to camera | silent / observational | interview-led
           | narrated (VO) | scripted
```

**Why two axes.** A combined list ("Casual travel vlog", "Silent aesthetic vlog") only ever contains the combinations somebody thought to name. Eleven chips on two axes give thirty combinations, and the ones nobody named still work.

**Treatment is the axis that actually reshapes a list** — more than genre does:

| Treatment | What it changes |
|---|---|
| Talking to camera | Pieces to camera get their own beat. Audio becomes a requirement, not a bonus. Fewer inserts — speech carries the cut. Overlaps with presence (§5.8); the two only conflict at the bottom two presence levels. |
| Silent / observational | More inserts, hands, ambience, light-dependent shots. No audio requirement at all. Needs roughly 1.5× the shot count of a talking edit. |
| Interview-led | A sit-down setup, cutaways for edit points, room tone. |
| Narrated (VO) | Visuals only, but coverage must be generous — VO can land anywhere. |
| Scripted | Shot-for-shot coverage, matched angles, continuity notes. |

Step 1 of setup states the consequence of the combination in plain language before you commit to it — *"TRAVEL × SILENT: no pieces to camera and no lav needed. Your list will lean on ambience, hands, movement and light."* Same device as the gear screen's `UNLOCKS` block: the app explains itself once, at the moment the choice is made, rather than leaving you to infer it from the results.

**The screen on arrival.** Step 1 is drawn twice, empty as well as filled, because the empty version is what everyone actually meets and it behaves differently:

- **Nothing is pre-selected.** Fourteen outline chips and a dead `NEXT`. Defaults would be faster, but a pre-picked `TRAVEL × SILENT` can be walked straight past, and you'd get an observational travel list for an interview shoot. The cost of a wrong answer here is a whole wrong list, so the form insists on a real one.
- **The name is optional.** Empty field, the date shown as placeholder — *"18 Sep shoot"* — and a line beneath saying that's the name unless you change it. You often don't know what a shoot is called until you've shot it, and nothing about naming should stand between you and a list.
- **The consequence box waits rather than vanishes.** Same border, same position, but muted and reading *"Pick a kind and a treatment, and this says what they mean for your list — before you commit to them."* It teaches the pattern before its first use, and the box doesn't pop into existence mid-form.
- **Two versions.** With projects behind you, a quiet `FROM A PAST PROJECT ›` link sits in the name row — it copies format, aspect, gear kit, cast and presence, not the shots or the brief. On a genuinely first run there's nothing to copy, and instead a note that no gear is on file yet, with a route to add it: the suggestion engine has three inputs (§5.5) and this is the moment one of them is missing.

### 5.2 Delivery length

`Reel 15–60s · Short 1–3 min · Mid 5–10 min · Long 10–20 min · Custom`

Length does two things, and both are visible immediately.

**It seeds a structure.** A new project isn't an empty list — it arrives pre-sectioned with the beats that format needs:

| Format | Beats |
|---|---|
| Reel | Hook (first 3s) · Build · Payoff (last 8s) |
| Short | Open · Middle · Close |
| Mid | Intro · Segments (×n) · Outro |
| Long | Cold open · Intro · Chapters · Outro |

An empty beat is a prompt rather than a hole: *"Nothing here yet — this is the one people remember."* A seeded structure is also the difference between opening the app to a blank page and opening it to a question you can answer.

**It sets a shot budget**, derived from length × treatment — roughly 2–3s per shot for a reel, longer holds for observational work, fewer shots per minute for interview-led. Always shown as a range, never a single number: a range reads as advice, a number reads as a target. It is a rough guide to how many shots cover a cut of that length; going over or under is the person's call.

**The budget table.** A first draft, reasoned rather than measured (open problem 6). Silent sits at about 1.5× talking, per §5.1. Planned shots grow more slowly than running time, because a long cut uses each planned shot several times.

| Treatment | Reel (~45s) | Short (1–3 min) | Mid (5–10 min) | Long (10–20 min) |
|---|---|---|---|---|
| Talking to camera | 12–16 | 20–26 | 32–42 | 44–58 |
| Silent / observational | 18–24 | 30–40 | 48–64 | 66–88 |
| Interview-led | 10–14 | 18–24 | 28–36 | 36–48 |
| Narrated (VO) | 16–22 | 28–36 | 44–56 | 60–76 |
| Scripted | 14–20 | 24–32 | 40–52 | 56–72 |

- **Custom** is the only delivery that asks for a length, in seconds. Its range is interpolated between the columns either side of it (reel = 45s, short = 120s, mid = 450s, long = 900s), shrinking in proportion below a reel (a 15-second silent clip is 6–8) and carrying the mid→long rate past a long cut.
- **Multi-day** projects split the range evenly across days, rounding so the days sum to the whole. Each day's share is editable later; a brief-driven suggestion ("day 2 is the sunrise day, give it more") is v1.
- **Editable.** The `WHAT THAT SETS UP` box says the budget is a guide you can change; changing it stores an override on the project, and the table is no longer consulted for that project.

**The budget exists to stop overshooting, not to drive it up.** Its job is to tell you when you have enough and can put the camera down and be somewhere. That is the opposite of how a progress meter usually behaves, and it's deliberate — the failure mode this app should prevent isn't only "missed a shot", it's "spent the whole morning behind a viewfinder".

| State | Treatment |
|---|---|
| Under | Neutral. No nagging — an unfinished list is the normal state of a list. |
| In range | Neutral. |
| Over | Counter turns `--warn` with `!`, and one advisory at the foot of the list: *"26 planned for a 45-second cut. Eighteen to twenty-four is plenty — trim now rather than at 6am in the cold."* |

One advisory, once, at the foot — never a warning per shot. Required `[★]` shots count toward the total (§5.7), and the advisory never suggests cutting one: its trim advice speaks only of the shots you could drop.

### 5.3 Aspect

Its own field — `9:16 / 16:9 / 4:5 / 1:1` — rather than bundled into the length preset, so a 4:5 feed cut is possible without inventing a preset for it.

Downstream: reference thumbnails and the shoot-mode frame render at the project's aspect, and vertical projects get a safe-area note on any shot with text or a subject near the frame edge.

### 5.4 Grouping: location or beat

The same shots under two lenses, toggled from the plan bar:

- **By location** — where you'll be, and when. The order you shoot in. The on-set view, and the default once a shoot day starts.
- **By beat** — hook, build, payoff. The order it cuts in. The planning and review view, and where holes in the story become visible.

Both are needed because they genuinely disagree. A reel's hook and its payoff are often the same location six hours apart; shooting order and edit order have almost nothing to do with each other. Shoot mode always uses the running order regardless of the toggle — on set, the edit doesn't exist yet.

**Every shot has a beat, even one added by hand.** Add shot has no beat field, so the app works one out the way it does for suggestions: first by matching the subject against template keywords and subjects, taking that template's beat; failing that, by size and position — a `WS` in the day's first location opens, anything in the last location closes, everything else is body. It's a guess, and it's only visible in the beat view. How it gets corrected is open (§10).

### 5.5 What format feeds

Format joins gear and the day's brief (§5.6) as the three inputs to the suggestion engine. A template shot declares a `beat` and its `shootTypes` alongside its gear `requires`, so two axes vary independently: the pocket-kit café list and the full-rig camp list differ by **gear**; a 45-second reel and an eight-minute travel piece in the same café differ by **format**. The long version gets sit-down coverage, establishing shots and room for a sequence that a reel has no time for.

### 5.6 The brief

Genre, treatment and format describe the *kind* of video. The brief describes *this day* — and it's the only input that can know about a brand deal, a person you're meeting, or the fact that the light is only good for twenty minutes.

**Free text, two scopes.** A brief for the whole project and a brief per day, toggled at the top of the screen. Loose or detailed both work — "wandering Higashiyama, quiet" is a valid brief, and so is three paragraphs with a client's shot requirements pasted in.

**v0: one brief, for the project.** The per-day scope and its toggle wait for v1. A multi-day shoot describes each day inside the one brief if it wants to; whether a separate brief per day earns its place is a v1 question. `! NO BRIEF` on a day row follows from the per-day brief and waits with it.

**The v0 screens, as built.** The prompt reads *"What are you shooting?"* (the board's *"…today?"* is per-day wording). B0's third route is *Copy a brief from a past project* (the board's *Copy day 1's brief* needs per-day briefs). Until the full read exists (M6), B1's ONLINE box is an **ON THIS PHONE** note saying matching is local and a fuller read comes later, and B9 shows only the quoted chips, each droppable. After B9 comes **B2**, the suggestions with their reason lines, a `+` on each and `ADD ALL N` — nothing lands on the list until it's added. Once written, the brief is reached from a one-line **brief strip** under the shot list's plan bar (after B4's brief strip). SKIP, and E5's *Suggest from your format*, go straight to B2 with no brief.

**How it becomes shots — hybrid, and the split matters.**

| | Offline | Online |
|---|---|---|
| Method | Keyword matching against the template library | The brief is read in full |
| Gets you | Time of day, weather, obvious subjects, named genres | Specifics: "say the name out loud" becomes its own shot, "interview the owner" pulls a sit-down |
| Guarantee | Always works | Better, never required |

This preserves the offline-first promise from §3: **a brief typed in a valley with no signal still produces a list.** The screen says plainly which mode it's in rather than silently degrading, and a brief written offline is re-read when signal returns, offering the extra shots it found rather than rewriting what you already have.

**When each one runs — and this is the whole cost question.** The two paths are not the same interaction and shouldn't be drawn as one.

| | Keyword matching | The full read |
|---|---|---|
| Runs | Continuously, debounced on a pause in typing | **Once, on `GENERATE`** |
| Costs | Nothing — local string matching, no network | A request: latency, battery, and real money per call |
| Shows up as | Outline chips on the brief screen, live | The confirm screen that follows the button |

Firing the read per keystroke would mean hundreds of requests to watch someone type three paragraphs. It never happens on input. The result is cached against the brief text, so reopening the screen and generating again with nothing changed costs nothing.

**Where the offline chips come from.** A keyword → chip dictionary, `src/data/chips.json`, edited by hand like the templates. Each chip has a label, a kind and the words that trigger it — `SUNRISE` from *sunrise, dawn, first light, early morning*. Kinds: time, weather, treatment, mood, subject, work. Place names can't be listed in advance, so one rule covers them: a capitalised word that isn't the first word of a sentence, and isn't in the dictionary, becomes a `place` chip. It will sometimes catch a brand name; quoted chips are tappable, so a wrong one costs a tap.

**Coverage from the brief's own actions.** Templates only know the shots someone wrote, so a brief about descaling a coffee machine got none of it (Rina, build-journal 22 Sep). Offline, the app now finds the actions a brief names — *descaling and flushing the coffee machine*, *then making a latte* — and covers each as a short sequence in the person's own words: the whole of it, the hands, the moment it visibly works; or, for moving through a place, wide, following, feet. A wide of the set-up opens it, and a task that makes something ends on the finished thing. These sit first on B2 under **FROM YOUR BRIEF**, with templates after under **ALSO WORTH GETTING**. It's rough on purpose — no dictionary, no network — and it can only phrase coverage generically; knowing what descaling actually looks like is the online read's job (M6).

**What generating builds.** Suggestions fill to the **top** of the budget range, not the bottom — easier to cut from a full list than to invent on set. Each lands in a location where one fits: a template's `light` matches it to a timed location (`sunrise` → the earliest start, `golden` / `blue` → the latest), and its keywords match location names. Anything that fits nowhere goes to `UNPLACED` — on a multi-day shoot, spread across the days in proportion to each day's budget rather than piled onto day 1. Time-of-day chips from the brief also rank templates with that `light` higher. Templates already on the list are never suggested again, and when fewer templates fit than the budget has room for, B2 says so plainly rather than padding.

**One press, two phases.** `GENERATE SHOTS` runs the read and lands on a confirm screen — **what it read** — before any shot exists. From the person's side it's one press; the checking is a beat inside it rather than an extra decision. One request returns both the structure and the shots, so a second is only spent if you actually correct something.

**Quoted and inferred are drawn differently**, because they carry different risk. `SUNRISE` is a word you typed — outline chip, low stakes. `3 DELIVERABLES` is a judgement the app made about what a client's sentence obliges you to shoot — filled chip, under a heading that says to check it. The deliverables are then listed individually rather than left as a count: a number you can't inspect is a number you can't verify, and these are the shots you're contractually on the hook for.

**Generating again asks first.** Once a list exists, a second read offers `ADD N NEW` or `REPLACE ALL N`, and states what replacing does to shots already marked exposed. Replacing is never the default and never silent — losing a morning's ticked-off work to a button press would be the worst failure in the app.

**Privacy.** Briefs contain client names and unreleased work. They stay on device by default; the online path sends the brief text for that one request and it isn't retained. That should be stated where the person can see it, not buried in a policy.

**The read, as built (M6).** One structured request to Claude Sonnet 5 returns quoted chips, inferred chips, deliverables grouped by client and the shots, each with its reason line, size, beat, light, movement, sound and — where it clearly fits — a location name or day. It sends the brief, the format and treatment, the budget and what's already planned, the days, the locations with start times, who's on camera and the subjects already on the list. It never sends the project's name. The wording on B1 and B9 is *"Sent once to be read. Not stored by this app."* — the server keeps counters, never the brief; the result is saved with the brief on the phone.

- **Cached against the brief text alone.** The screen promises it *"won't run again unless you change the brief"*, so nothing else goes into the hash. (It first hashed the plan too; adding the read's own shots changed the planned count and bought a second read.)
- **B2 after a read:** `REQUIRED — CLIENT` bands with the `[★]` shots (a required shot already on the list shows `ALREADY ON`), then **FROM YOUR BRIEF** with the read's shots, then the template library collapsed behind `+ N MORE FROM THE LIBRARY`. A deliverable dropped on B9 doesn't appear.
- **B10 keeps exposed shots.** The board's `REPLACE ALL N` would clear shots already marked exposed. As built it's `REPLACE — KEEP WHAT'S SHOT`: it clears unshot shots only, and the CAREFUL box says how many go and how many stay. Dropped shots stay too — wrap never deletes (§5.12).
- **Limits,** because the read costs real money (about 5¢) and the app is open to anyone: 5 full reads a day per phone, 15 per network address, and a $2 daily ceiling across everyone. An invite link (`/?invite=code`) gives 25 reads over 14 days instead of the daily 5; Settings shows it and can forget it. When a limit is hit, or there's no signal, generating falls back to matching on the phone and says so — B1 shows *"No full reads left today — it will match on this phone instead."* The limits are counted on the server and reset at midnight UTC.
- **Not yet built:** re-reading a brief written offline when signal returns. Today it's read on the next `GENERATE` with signal.

### 5.7 Required shots and deliverables

A brand deal's shots are not suggestions — they're obligations, and the failure mode is delivering without one. They get their own status.

| | Behaviour |
|---|---|
| Mark | `[★]` in `--accent`, in place of the row number. Required shots are **never numbered** — the mark is the identity. |
| Position | Pinned in a `REQUIRED — <client>` band above every location, in both grouping modes |
| Counting | Counted **toward** the shot budget — they're shots you'll take, and leaving them out understated the day. Also counted on their own: `★ 0/3` beside the budget. The over-budget advisory never suggests dropping one (§5.2): a contract is not discretionary. |
| Wrap | Shoot mode will not let you wrap the day with a deliverable outstanding. It's the one place the app is allowed to be obstinate. |
| Origin | Created from the brief when the read calls them out (M6). Setting one by hand is open (§10): the long-press drawn for it is unassigned in v0. |

A required shot that conflicts with another setting doesn't get silently dropped — see below.

### 5.8 Cast and presence

The first version of this asked "how much of the video is **you**", which quietly assumed you were the subject. That breaks the moment you're behind the camera filming someone else: shooting a chef who talks to camera, *you: not at all* is perfectly true and would have stripped the entire talking-head coverage out of the list.

So the question splits in two: **who is on camera**, and separately **how much they're in it**.

```
Project.cast
  lead         me | <named person> | no one
  supporting   [{ name, role, presence }]   — as many as the shoot has
  operator     presence for you, behind the camera
               defaults to "not at all" when the lead is someone else
```

Every cast member carries one `presence` level. "You" is simply one possible lead, not a special case.

**The lead** is a three-way choice at project setup:

| Lead | Covers |
|---|---|
| **Me** | Self-shooting creator. The original model, unchanged. |
| **Someone else** | Client work, doc subjects, a friend. You name them, and shots use the name — *"Priya to camera"*, *"Priya's hands on the dough"* — so the list reads like something you could hand to an assistant. |
| **No one** | No human subject at all: product, food, landscape, architecture. Distinct from *me → not at all*, which still wants hands and POV. |

**Supporting cast** is a flat list with a `+ ADD SOMEONE` — a sous chef, a wife, a dog. Each gets a name, an optional role, and its own presence level, which is what lets the engine say *"Buno asleep under the pass — background, don't wait for it"* rather than treating every person in frame as equally important.

**Presence**, now attached to whoever is on camera:

| Level | What it means | What the engine does |
|---|---|---|
| **Not at all** | Never identifiably on screen | Rewrites rather than removes: hands, POV, back of head, silhouette, reflections, feet. Pieces to camera become voice-over. |
| **In the background** | Turns up incidentally — a figure in a wide, a shadow, a hand entering frame | The place leads. A handful of shots include them, none are about them. |
| **Part of it** | In it properly and as often as it needs — walking through, reacting, talking | No constraint; the place still leads the cut. **The default.** |
| **The subject** | The video is built around them | Adds a presenter beat, raises their share of the shots, and inverts the B-roll relationship — coverage supports them rather than the reverse. |

Voice is a **separate switch** per person. Faceless-with-narration is a coherent combination, and *not at all* plus voice off is what makes a piece fully observational.

**Counted on the list.** The plan bar counter takes the lead's name — `PRIYA 11` on a client film, `YOU 4/16` on a self-shoot. Same reasoning as the shot budget: a visible number stops a list drifting into all-B-roll with nothing human in it, or into nothing but talking heads. When the lead is someone else, a muted `YOU 0` note at the foot says plainly that you're behind the camera and none of this coverage is yours.

**Scope: one choice per project**, per person. Not per day, not per shot. A shoot with a genuinely different balance is a different project — cleaner than a hierarchy of overrides, and it keeps the counter meaningful across the whole piece.

**Control: a radio, not a checkbox.** The four levels are mutually exclusive, so they use the system's radio form — `( )` and `(•)` in mono, selected mark in `--accent`. The `[ ]` / `[✓]` bracket form stays reserved for things that get *done*: shots, gear, deliverables.

**Overlap with treatment, and the conflict.** Treatment keeps its *talking to camera* option; the two axes describe different things. Presence defaults to *part of it*, so nothing is constrained until told to, and a contradiction only exists when the treatment needs someone talking to camera and **nobody in the cast** is at *part of it* or above:

> *talking to camera* × every cast member at *not at all* or *in the background*

Note what this now allows: *you: not at all* × *Priya: the subject* × *talking to camera* is not a conflict at all — it's an ordinary client film, and the earlier model would have flagged it wrongly. When a real contradiction does occur the app names it — **"Talking to camera assumes someone is on screen. Nobody in the cast is."** — and offers three explicit exits: change the treatment, raise someone's presence, or keep both and let pieces to camera become voice-over with the suggestions rewritten. Both inputs came from the person; the app's job is to show the contradiction, not to pick a side.

**Location privacy** is independent of all of it, and on by default: flags shots likely to reveal street signs, house numbers, station names or a recognisable home exterior. Relevant at every presence level — being *the subject* of a video doesn't mean broadcasting where you live.

### 5.9 Multi-day shoots

**Day is an outer container, not a third grouping option.** You pick a day and see that day's list, grouped by location or beat as usual. On set you only ever see today, which is the point.

```
Project → Day → Location → Shot
                 ↕ (beats cut across days)
```

- Each day carries **its own brief** and its own slice of the shot budget. A 44-shot budget across three days lands as 9 / 16 / 19 depending on what each day is doing — not an even split.
- The **Days screen** is the project home for a multi-day shoot: one row per day with its brief snippet, progress, deliverable count and status (`DONE` / `TODAY` / `! NO BRIEF`). An `ALL DAYS` row above them holds the whole-project view.
- **Beats span days.** A three-day travel piece has one payoff, and it might be shot on day one. This is the tension that makes Day a container rather than a grouping — grouping by beat within a single day would be nonsense, so the beat view is available at the `ALL DAYS` level and at day level it shows which beats today contributes to.
- Moving a shot between days moves its budget with it.
- A single-day project never shows any of this. The day container appears when a project has more than one day.

**Where the day count is asked.** Step 2 of project setup, under the start date: *"How many days are you shooting?"* — `1 / 2 / 3 / 4 / 5+`, defaulting to 1. It belongs here because it's a fact about the shoot's shape, and because everything downstream depends on it: whether the list splits into days, whether the budget is divided, whether a location can be placed on a particular day. It's editable afterwards — trips stretch — and lengthening a project adds empty days rather than redistributing what's already planned.


### 5.10 Locations and the running order

A `Location` is a place, or a stretch of the day you'll spend somewhere. It heads every group on the shot list, and until now nothing created one.

```
Location
  name       "Cliff path" — or "Breakfast at the ryokan", if the day
             divides by activity rather than by place
  where      "Headland, NSW"          optional
  startTime  6:10 AM                  optional
  day        which day, on a multi-day project
```

**The word.** This was called a `Setup` through most of the design, and that was borrowed vocabulary. On a crewed set a setup is one camera position, and here it collided with gear kits badly enough to be read as one. Nothing about the object needed a film term: a shot belongs somewhere, and that is all the word has to carry. **No letters, either.** `Setup C` made you learn a code for something you already know by sight.

**Both fields are optional.** A location can be a name alone. Not every day is planned to the hour, and a form that insists on a time for a walk around a town is a form you stop filling in.

**Start time, not call time.** A call time is when crew are required to arrive — it exists to coordinate people. Solo, there is nobody to call. What's useful is the clock position: it orders the day and it can be checked against the light.

**Light-aware start times.** The new-location screen knows the project's date and location, so it states the sunrise and how long golden hour holds, and says what the chosen time buys you: *"Sunrise is 6:02 at Headland on 19 Sep and golden hour holds to about 6:45. A 6:10 start gives you 35 minutes of it."* Quick chips (`SUNRISE / MIDDAY / GOLDEN`) fill a sensible time so the common case is one tap.

**Where the sun times come from.** Sunrise, sunset and golden hour are calculated on the device from a date and a latitude/longitude — no network, no library. The coordinates come one of two ways:

- **The place name, looked up once.** The first time a project's `where` (or a location's) is seen with signal, the name is sent to a free geocoding service (Open-Meteo, no account) and the coordinates are saved with it. From then on everything works offline. The place name is the only thing sent — never the brief — and the screen says so the first time.
- **The phone's location**, behind the browser's permission prompt, offered as `USE WHERE I AM`.

With neither — offline before a lookup, permission refused — the light lines are simply absent, not shown as an error. The same numbers drive shoot mode's `LIGHT GOES 6:10 PM · 46 MIN` and Auto's sunset switch (§9).

**Times sort themselves; the rest is drag order.** Anything with a start time sits in clock order. Locations without one keep the order you dragged them into, under a `NO TIME SET` heading. Shot numbers follow the running order, so moving one location above another renumbers — the reorder screen says so plainly, and anything already exposed keeps its mark, because the number is a position, not an identity.

**How numbering runs.** One sequence for the whole project, continuous across days — day 1 is 01–12 and day 2 carries on at 13 — so a number is never shared. Within a day: timed locations by clock, then untimed by drag order, then that day's `UNPLACED` shots last. Shots with no day at all come after the last day. `[★]` shots take no number (§5.7) and don't consume one.

**Deleting a location never deletes shots.** They fall to an `UNPLACED` group at the foot of the list. That's a bucket in the model and it earns its place: losing six planned shots because you renamed a location is a much worse failure than an extra group header. The delete row states this consequence in place rather than opening a confirm dialog.

**Day count belongs to the project, not the location.** The new-location screen used to ask *which day* on a project that only had one — a question about the shoot's shape, asked in the wrong place. It's now set at project creation (§5.9), and the day chips appear on a location only when the project has more than one day.

**Entry points:** tap a location band on the shot list to edit it; `ORDER` in the plan bar for the running order; `+ LOCATION` from the empty shot list, from the running-order screen, and at the foot of the shot list (the foot of each day on a multi-day shoot) — added in the build, because once a list had shots the only way in was two taps deep behind `ORDER` (build-journal, 22 Sep).

**Time format** is a settings row — `12-HOUR` / `24-HOUR` — and it replaces the old *default setup naming* row, which had nothing left to name. Times are written the way the user reads them: `6:10 AM` by default, `0610` for anyone who prefers it.

### 5.11 Account and sync

**Local first.** The app opens straight into work. No account, no wall, nothing to sign. Everything lives on the device and every feature works offline, which is the promise the whole design is built on — a wall at first launch would contradict it on screen one.

**The prompt comes after the first project exists**, when there's finally something worth losing. It's a dismissible screen, not a gate: what sync buys, stated in three lines, a `CONTINUE WITH GOOGLE` button and `NOT NOW`. Google only.

**What it says it does matters as much as what it does.** *"We store your lists, gear and references. We never touch your footage — that stays on your cards and your drives."* For anyone doing client work, the second half is the sentence that decides it.

**Account screen** lives as the first row of Settings: who's signed in, when it last synced, what's backed up, and a plain statement that offline changes queue on the phone rather than blocking. Sign out keeps projects on the device and stops syncing; delete removes the account and every project from both the servers and the phone, with no undo — and points at export first.

**Note for build:** the sign-in button on the board is plain text. A shipped build must use Google's own button asset and follow their branding rules.


### 5.12 Wrapping the day

The app had no ending. You could plan a shoot, work through it and tick everything off, and nothing closed.

**Wrap is not a completion screen.** This is the decision that matters, and it follows directly from §5.2: the budget exists to tell you when you have *enough*, not to push you to finish. A "12/12!" celebration would reward exactly the behaviour the product is designed against. So the headline is the count stated plainly, and the line under it ties back to the cut rather than to you — *"Nineteen of the twenty-four this cut needs, with a day still to go. There's nothing you have to chase tomorrow."*

**Two things need a decision before the day closes.**

| | What it asks |
|---|---|
| **Flagged** `[!]` | Reshoot tomorrow, or accept as is. A flag is an unresolved judgement and shouldn't survive the day unexamined. `RESHOOT TOMORROW` moves the shot to the next day and resets it to `[ ]`, keeping its note; on the last day it's absent (not greyed), the same rule as `MOVE` below, which leaves accept or drop. |
| **Not shot** `[ ]` | Move to a later day, or drop. A bulk choice sets every shot in the group; any single shot can then be changed on its own. |

**Every option names where the shot goes.**

| Option | Where the shot goes |
|---|---|
| `MOVE TO DAY N` | Onto a later day. Only offered when one exists. |
| `DROP` | Out of the count, but not deleted. It stays struck through in the day's record, so what you planned and what you got can still be compared — and a dropped shot you get after all can be un-dropped from there. |

Unshot shots never evaporate. A planning tool that silently discards what you didn't get to is a tool you stop trusting after one shoot.

**Why there's no third option.** An earlier version had `KEEP` between them, meaning *wrap the day but hold the shot on the project with no day attached*. It didn't survive being questioned. "Keep" reads as *leave it where it is* — which is today — so it read as "don't wrap", and not wrapping is simply the back button, not an option on this screen. The case it was meant to cover (a pickup on some later occasion, after the shoot is over) turned out to be rare for a solo shooter, and reversible `DROP` covers it anyway: un-drop the shot from the record if you get it. What's lost is a reminder on the Projects screen; what's gained is one fewer thing to explain at the end of a long day.

**The bulk row says it's a bulk row.** `ALL 2` sits in front of the chips and a line beneath reads *"Sets every shot below. Tap one to change just that shot."* The first version relied on position alone, and it wasn't clear.

**On the last day — or a single-day shoot — there are no chips at all.** `MOVE` has nowhere to go, which leaves `DROP` as the only outcome, and one chip is a confirmation dressed as a choice. So the not-shot rows are simply listed, with a sentence saying they drop when you wrap, and a route back to shoot mode if you want one of them. `MOVE` isn't greyed out — it's absent. A dead `MOVE TO DAY —` is decoration, and the only live alternative, *add a day*, would quietly nudge you to extend the shoot.

**The budget changes the sentence, not the options.** Within range: *"You have enough for the cut. These two drop when you wrap."* Under range: *"You're short of the cut — worth going back for one of these before you wrap?"*, with the route back to shoot mode given more weight. Same outcome either way; the app just tells you honestly whether it matters.

**The deliverable guard, and its escape.** A day with an outstanding `[★]` doesn't wrap clean: the deliverable is pinned at the top under the client's name, and the two routes offered are `SHOOT IT NOW` and `WRAP ANYWAY — I'LL TELL THEM`. The escape is deliberate. Blocking absolutely would be paternalistic, and the real reasons are ordinary — the location closed, the client cancelled, it rained. What the app owes you is that the consequence is stated rather than hidden: the shot stays `[★]` and the project keeps showing it outstanding. A guard you can't pass becomes a guard people route around.

*Not drawn as a dead button.* The earlier plan was a disabled `WRAP` with the reason above it, matching the disabled-primary component in §7. On the screen it read badly: a dead `WRAP DAY 2` sitting directly above a live `WRAP ANYWAY` is two controls for one action, and the disabled one is pure decoration once the escape exists. The reason line stayed; the dead button didn't.

**Reopening a wrapped day** (*"Wrapping locks nothing — you can reopen the day"*, W1) means opening it as a record: what was planned, what was exposed, what was dropped. From there a dropped shot can be un-dropped or moved to a later day. It doesn't un-wrap the day.

**Wrap is only ever chosen.** Exposing the last shot doesn't send you to wrap — you might want to go back over the list or add something. Shoot mode says everything's through and offers `+ ADD SHOT` and `WRAP`.

### 5.13 Editing a shot

Locations could be created, edited, reordered and deleted long before the shot — the app's central object — could be changed at all.

**Movement and sound are filled in by the app.** Add shot draws no field for either, but the detail table shows both, so the app works them out when the shot is created and shows them as chip rows, pre-selected and labelled *suggested*:

- **Movement** — STATIC, SLOW PAN, SLOW PUSH IN, PULL BACK, TRACKING, FOLLOW, HANDHELD, REVEAL. Words in the subject decide first (*walking* → tracking on a gimbal, follow handheld; *reveal*, *door* → reveal; *pull back*, *drone* → pull back), then support and size (tripod → static, or a slow pan on a wide view; gimbal → slow push in; handheld → still on inserts and close-ups).
- **Sound** — `SPEECH` (someone talks on camera: check the mic), `NATURAL SOUND` (no talking, but record the place), `NO SOUND` (music or voice-over goes over it). From the treatment and the shot: talking to camera and interview framings get speech, silent gets natural sound, narrated gets none except on wides. A line under the chips says what the selected one means. *(Labels chosen by Rina over "sync / ambient", which was set jargon — build-journal, 22 Sep.)*

Both keep following the size, support and subject until the person picks one, and then stay put. The rules live in `src/lib/suggest.ts`.

**Edit mirrors add**, field for field, so there is nothing new to learn. Two actions sit on **shot detail**, under the spec and the note — not in edit, so a shot can be duplicated or deleted without opening the form first (Rina, build-journal 22 Sep; the S6 board still shows them in edit):

- **Duplicate** — same spec, next number. The common real need: a second take of the same setup, or the same insert at another location.
- **Delete** — which states its consequence rather than letting you find it: *"Shots below move up — 04 becomes 03. Anything already exposed keeps its mark."* Consistent with §5.10, where a number is a position and not an identity.

**Reordering shots is the same screen as reordering locations**, on a `LOCATIONS | SHOTS` toggle, rather than a third way to drag things. Shots show their band, their number, their status mark and a drag handle; moving one renumbers the rest and exposed marks survive the renumber.

### 5.14 Project actions — edit and delete

Once a project existed there was no way to change it or get rid of it.

**A `⋯` at the right of the project's title** on every screen titled with the project's name — the shot list in both themes, the beat view, the Days screen, the gear and look tabs, and their empty states. Not on a day's list (`B4`), whose title is the day, not the project. The title wraps onto as many lines as it needs, with the `⋯` beside its first line; the `⋯` keeps a 44px target by overlapping the header's padding rather than growing it. (It truncated at first; wrapping won out because this is the one screen where the whole name should be readable — the Projects list is where names truncate to one line.)

**`⋯`, not a gear.** The app already has a Settings screen — theme, time format — reached from Projects. A gear that opened *Edit* and *Delete* would be the icon promising one thing and doing another, which is the same trap as "Setup" (§5.10). `⋯` is the conventional sign for *actions on this thing*. It's also the first icon in an otherwise all-text interface, so it's three plain dots in `--ink`, nothing more.

**The sheet.** Slides up from the bottom over a dimmed screen. The project's name at the top, so it's clear what you're acting on, and exactly two rows: `EDIT PROJECT` and `DELETE PROJECT`, delete in `--warn`. Tap outside, swipe down or `CLOSE` to dismiss.

**Delete confirms in the same sheet.** It doesn't open a new screen or a system dialog; the sheet's content changes to the question, and says what goes with the project: *"Are you sure you want to delete this project? 12 shots, 3 days and the brief go with it. This can't be undone."* Everywhere else the app states consequences in place instead of confirming (§5.10, §5.12) — project delete is the one exception, because it's the one action that genuinely can't be reversed: nothing is stored anywhere but the device. `YES, DELETE` is filled `--warn`; `CANCEL` beneath closes the sheet.

**Edit reuses the create flow**, prefilled, titled `Edit project · 1/2` and `2/2`, and ending in `SAVE` instead of `CREATE PROJECT`. Nothing new to learn.

**Changes that touch planned shots say so before saving.** When an edit changes something the existing list depends on — the number of days, the delivery length — a `CHANGES` box appears above `SAVE` saying exactly what will happen: *"Going from 3 days to 2: day 3's 4 shots move to day 2. Nothing is deleted — you can move them again from the list."* It appears only when such a change has been made. Nothing moves silently, and nothing is deleted by an edit.

---

## 6. Gear

The premise: a pocket camera at a café and a full rig at a campsite are not the same shoot, and a shot list that ignores which one you packed can only ever be generic. Gear is what lets the app suggest shots that are actually available to you.

**The decision taken:** gear *generates*, it doesn't *police*. Nothing is hidden, greyed out, or flagged as impossible. A shot you added yourself stays exactly as you wrote it whether or not you packed the lens for it — improvising is half the job, and an app that argues with you on set is worse than one that stays quiet. Gear's only job is to make the suggestions worth reading.

### 6.1 Model

```
GearItem
  id
  category    camera | lens | support | light | audio | power | grip
  name        "Sony 85 f/1.8"
  specs       category-dependent, and the reason the app can reason at all:
    camera    mount · stabilised? · batteries · card slots · lowLightISO
    lens      focalMin · focalMax · maxAperture · macro? · stabilised? · mount
    support   type (tripod|gimbal|slider|monopod) · maxLoad · maxHeight · fluidHead?
    light     output(W) · colour (daylight|bi|rgb) · battery? · modifier
    audio     type (shotgun|lav|recorder) · channels · windshield?
    power     capacity(mAh) · outputs
  notes

Kit           id · name · itemIds[] · isDefault
              "Pocket" (3) · "Doc day" (6) · "Full camp rig" (13)

Project
  kitId       the kit it started from — kept, so the app can show a diff
  gear[]      the edited-for-this-shoot set
  packed[]    subset ticked as actually in the bag
  format      genre · treatment · delivery · aspect (§5)
```

Two things matter in that shape. **Specs, not just names** — "Sony 85 f/1.8" tells the app nothing; `focal 85, f1.8` lets it know you can get a compressed CU and shoot past dusk. And **`kitId` is kept after editing**, so the project can say "Doc day +2" and offer to save the variant as a new kit rather than silently drifting.

### 6.2 The suggestion engine

Every suggestion is a template shot with declared requirements:

```
{ size: "WS", subject: "Star lapse over camp",
  requires: [support.tripod, power.capacity >= 10000],
  unlockedBy: support.tripod,
  shootTypes: [landscape, doc] }
```

The engine:

1. **Filters to what's possible** with the packed set. Templates whose `requires` aren't met never appear — that's the "suggest, don't police" decision applied at source.
2. **Ranks by what the kit unlocks.** A template whose `unlockedBy` item is present *and* unusual for you rises to the top. Packing the 85 should visibly change what you're offered; that's the moment the feature justifies itself.
3. **Diversifies against the existing list.** Four wides on the list and no tight shot pushes CU and INS up the ranking.
4. **Adapts to constraint, doesn't just drop it.** No tripod doesn't only remove the locked-off shots — it rewrites some of them: *"No tripod packed — set it on the table edge and hold twenty seconds."* This is the difference between a filter and a collaborator.
5. **States the reason, naming the item.** Every suggestion carries one line saying which piece of gear earned it. Without that line the list is just shots; with it, the connection between the bag and the day is visible.

**The reason line is the feature.** It's what makes gear feel wired into the shot list rather than a packing checklist sitting beside it, and it's worth holding a high bar on the copy: name the item, say what it buys you, stay under two lines.

A count of withheld suggestions is shown, without listing them: *"Four more that need a tripod or a longer lens. Add gear to this shoot and they appear."* That turns the constraint into a reason to open the gear screen rather than a dead end.

### 6.3 Screens

| Screen | Role |
|---|---|
| **My gear** | The library. Kits at the top, then every item grouped by category band with its key spec on the right. Reached from Projects, not Settings — gear is content, not a preference. |
| **Add gear** | Category as a chip row; the spec fields below change with it. An `UNLOCKS` block says what adding this item will do to your suggestions — the one place the app explains itself before you've felt the benefit. |
| **Kit for this shoot** | Start from a kit, then tick items in or out. Three bands: *Bringing* / *Added for this shoot* / *Leaving behind*, with added items marked `+ NOT IN DOC DAY`. `SAVE AS NEW KIT` sits beside `DONE`. |
| **Gear tab** | On the shot list, third tab. Kit summary with an `EDIT` route, then `IN THE BAG · 5 / 7` — the same `[ ]` / `[✓]` control as a shot row, striking items through as they go in. `SUGGEST SHOTS FROM THIS KIT` is the primary action. |

**Gear appears in two contexts, and the empty state has to exist in both.** Reached from Projects it's the standalone library, with its own `My gear · 0` header. Reached from inside a project it's the third tab, and then it keeps the project header and the `SHOTS / LOOK / GEAR` bar — you are still in Kyoto Morning, and losing that chrome would read as having navigated away. Same content either way; only the frame differs. Both are drawn.

The project-tab version is the more common route to an empty library, because most people meet gear for the first time while setting up a shoot rather than by going looking for a settings screen.

Two suggestion boards are on the canvas deliberately, because the contrast is the argument: the same screen with a pocket kit at a café and with the full rig at a campsite produces almost no overlapping shots.

### 6.4 Where gear shows up elsewhere

- **Add shot** — lens and support stop being free text and become chips drawn from this shoot's packed gear, with a route to edit the kit. Faster to fill, and it keeps the shot's spec honest.
- **Shot detail** — the spec table reads from the same set, so `85MM` on a shot is a reference to an item rather than a string.
- **Shoot mode** — unchanged. Gear is a planning-time concern; on set you want the shot, not its provenance.

---

## 7. Components

| Component | Spec |
|---|---|
| **Screen header** | 20px top padding, back link left (12px, `0.12em`, `--accent`), status right. Title 20px/700 UPPER below. Bottom `1px --rule`. |
| **Progress meter** | Label 11px UPPER `--ink-muted`, 4px track in `--rule` (day: `#E0D5BE`), fill `--ok`, count 13px/700 `--ok`, tabular. |
| **Tab bar** | Inline text tabs, 12px UPPER `0.12em`, `14px 0` vertical padding, `20px` gap on the container — never per-tab margins. Active: `--accent` + 2px bottom border. Inactive: `--ink-muted`. No pills, no background. The padding is what it is because 12px gave a 41px row: under the 44px floor in §3 and easy to miss, since a tab looks like text rather than a control. |
| **Project header + tabs** | One block, identical on every screen behind the tabs: back link and connection status, project name at 19px/700 UPPER, wrapping in full, with the `⋯` project-actions button beside its first line (§5.14), format line in `--ink-muted`, then the tab bar. It does not vary by tab, and it does not disappear when a tab is empty — an empty tab is a state of the project, not a different place. A screen that needs its own title (the gear library's item count, say) puts it in a strip *below* the tab bar rather than replacing the project name. |
| **Column header** | 11px/700 `0.14em` `--ink-muted`, fixed column widths `34 / 44 / 1fr / 34`, `1px --rule` above and below. |
| **Location band** | `--band` fill, 7px padding, 11px/700 `0.14em` `--ink-faint`, name left and start time right. |
| **Shot row** | 13px vertical padding, `1px --rule` bottom. No. (34px) · size (44px, 700) · subject stack (15px + 11px meta) · status (34px, right). Whole row is the link to detail; the status control is a 44×44 button with negative margin so it overlaps the row padding without growing it. |
| **Status control** | 44×44 minimum, transparent, renders the bracketed code. Tap toggles `[ ]` ↔ `[✓]`. Long-press does nothing in v0 (flags are a line, §4.4; setting `[★]` by hand is open, §10). |
| **Radio row** | Whole row is a `<button role="radio">`, 44px minimum. The mark is `( )` / `(•)` in a fixed 26px column, `flex-shrink: 0`, **with an explicit `line-height` matching the label's first line** — without it the two marks land on different baselines, because the bullet and the space have different vertical metrics. Selected mark in `--accent`, its label at 700. Label plus one line of description in `--ink-muted`. `1px --rule` between rows. For mutually exclusive settings that need explaining — never for binary toggles. |
| **Segmented control** | `1px --rule` box, equal `flex-grow` segments, `1px --rule` between. Selected: `--ink` fill + `--accent-ink` at 700 (or `--accent` fill in night, where an ink fill would be a white slab). |
| **Chip** | 11–12px UPPER, 10–11px side padding, **44px minimum height** — the boards draw 7–9px vertical padding, which gives a 35px chip, under the §3 floor, so the height comes from `min-height`, not padding. Selected = filled (`--ink` by day, `--accent` by night, `--accent-ink` label); unselected = `1px --rule` outline. A chip that can't be picked yet is `--ink-muted` with a dashed edge and a line nearby saying why — never dimmed. Used for filters, locations, gear. |
| **Text field** | 44–48px tall, `--field` fill, `1px --rule` border, `1px --ink` when focused or primary. 15–16px text — 16px on any field that can be focused, so iOS doesn't zoom. |
| **Primary button** | 48px tall (72px in shoot mode), `--accent` fill, `--accent-ink` label, 14px/700 `0.12em`. Full width or `flex-grow` beside a secondary. |
| **Secondary button** | Same height, transparent, `1px --ink` border, `--ink` label. |
| **Disabled primary** | Same height and type, but `1px --rule` border, no fill, `--ink-muted` label — never the enabled button at reduced opacity, per §3. It is always accompanied by a line above it naming what's missing (*"Pick a kind and a treatment."*), because a dead button with no explanation is the most common way a form loses someone. |
| **Reference tile** | Flat 16:9 or 4:3 block, no radius, no caption over the image — captions sit beneath, on ground or in a `--band` strip. Text over a photograph can't be contrast-guaranteed, so we don't put any there. |
| **Empty state** | Never a blank page and never a single button. Screen chrome stays intact (an empty shot list keeps its header, tabs and plan bar reading `0 / 18—24`), then a plain-language line about what's missing, then **exactly three** numbered ways forward, each with one line saying what it's good for. The first route is the recommended one and says why. Below them, one quieter alternative route. |
| **Icon button** | 44×44 target around a 20px glyph, overlapping surrounding padding with negative margin so it never grows the row. `aria-label` always. The app has one icon — `⋯` — and a new one needs a reason the words couldn't do the job. |
| **Bottom sheet** | Anchored to the bottom edge, full width, `--ground` with a `1px --ink` top border and a 36×4 grabber in `--rule`. Over a scrim (`--scrim`) — the one place a translucent overlay is right, because what's beneath is inert while the sheet is open. Day: `#1C1714` at 52%, so the sheet's ground reads 3.44:1 against the dimmed page and its `--ink` edge 4.36:1. Night: black at 70%, which mutes the page to about 2:1 so it reads as inert; darkening can't separate two near-black grounds, so on night the `--ink` top border carries the edge at 17:1. Both clear the 3:1 non-text floor. Destructive fills (`YES, DELETE`) use `--warn` with `--accent-ink` labels: 5.38:1 day, 7.49:1 night. Title at 11px UPPER `--ink-muted`, then rows at the list-row spec. Dismissed by tapping the scrim, swiping down, or `CLOSE`. A confirmation replaces the sheet's content rather than stacking a second sheet. |
| **Suggestion block** | `1px --accent` box (or a 3px left rule), 11px/700 `--warn` label, 13–15px body. The one place the app talks to you rather than listing. |

---

## 8. Key screens

Five screens, both themes. Artboards are on the canvas and linked so the flow can be walked in Play.

### Projects
Entry point. Grouped by status via `--band` bands: **In progress / Planning / Wrapped**. Each row: name, day-of-shoot marker, progress meter, date and location. Wrapped projects drop to `--ink-muted` with a `[✓]`. Filter chips across the top, `+ NEW PROJECT` in the thumb zone, Settings top-right — the only route to Settings in the whole app.

*States:* empty (no projects yet — the onboarding board, §7) · syncing · offline. Its `+ NEW PROJECT` goes to the first-run step 1; the populated list goes to the ordinary empty one.

### Shot list
The core screen. Tabs for **Shots / Look / Gear** (§6.3), and a plan bar carrying the delivery summary, the shot budget and the location/beat toggle (§5.4). Column header, then location bands with shot rows beneath, in running order. Progress meter in the header. Two actions in the thumb zone: `SHOOT MODE` (secondary) and `+ ADD SHOT` (primary).

*States:* all exposed (the payoff — meter full, header count in `--ok`) · empty list · a location with no shots · offline with queued edits.

### Shot detail
Reference image full-bleed at 176px, then the size chip and location, then the subject as a sentence-case title. A spec table — lens, support, movement, audio — as hairline-separated rows, because that's the information you check at the camera. Note beneath in body type. Linked refs as a three-up strip. `MARK EXPOSED` is the primary action; `EDIT` sits beside it.

*States:* no reference (the image block becomes a `--band` placeholder with `+ ADD REF`) · already exposed (primary becomes `UNMARK`, secondary) · flagged.

### Add shot
Size as a five-way segmented control (WS / MS / CU / OTS / INS) — the fastest possible input for the field you always fill. Subject as the only large text field. Lens and support as chips drawn from this shoot's packed gear, with a route through to edit the kit. Location as chips. Note as a textarea. A suggestion block calls out coverage gaps as you type.

*States:* editing an existing shot (same screen, `SAVE` instead of `ADD TO LIST`) · duplicate-shot warning.

*Rules:* a **coverage gap** is a size the chosen location has none of yet — never the size being added, since that shot fills its own gap, and only once the location already has shots (*"You have no INS at the headland yet."*). It appears once a subject is typed. A **duplicate** is a shot matching an existing one on size, subject (ignoring case and spacing), location, lens and support — the warning says which number it matches and still lets you add it, since a second take is legitimate.

### Settings
Grouped rows under `--band` headers: **Appearance / Shot lists / Data**. Appearance holds the theme control (§9). Data holds offline storage, call-sheet export, and the PWA install prompt. Version and offline status in the footer.

*v0:* Appearance → Theme; Shot lists → Time format; Data → how many projects are stored on this device, and the install prompt when the browser offers one. Account and call-sheet export wait for v1.

### Brief screens
Four boards: **empty** (nothing written — three ways in, `GENERATE` disabled), **written**, **what it read** (the confirm phase), and **read again** (add or replace). Specified in §5.6.

*States:* offline (keyword matching only, stated on screen) · no brief on a day in a multi-day project · a brief that produced nothing usable.

### New project screens
Two steps, and step 1 exists in three states on the canvas: **first ever project**, **empty**, and **filled**. Step 2 carries length, aspect, the start date, the day count (§5.9) and the `WHAT THAT SETS UP` summary of budget and structure. Specified in §5.1–5.3.

*States:* first run (no gear, no past projects) · nothing chosen, `NEXT` disabled · one of two chips chosen · fully chosen.

### Location screens
New location, edit location and the running order — specified in §5.10.

*States:* first location on an empty list · a location with no shots in it · `UNPLACED` present · single-day project (the day chips are hidden).

### Empty states
Projects, brief, shot list, gear (two contexts) and look — specified as a component pattern in §7. Every one behind the project tabs keeps the project header and tab bar; only the body changes.

### Account screens
The post-first-project prompt and the account row in Settings — §5.11.

### Gear screens
Four of them — My gear, Add gear, Kit for this shoot, and the Gear tab — specified in §6.3, plus the two suggestion boards.

*States:* no gear yet — drawn twice, once standalone and once as the project's Gear tab with the header and tabs intact (§6.3), because both routes reach it · a project with no gear selected (suggestions fall back to shoot-type templates that carry no gear requirements) · an item deleted from the library while a project still references it — the project keeps its own copy, because a project's gear set is a snapshot, not a live pointer. Otherwise selling a lens quietly rewrites last year's shot list.

### Brief, days and privacy screens
More, specified in §5.6–5.9: the brief in four states (empty, written, what it read, read again), shots generated from it with `[★]` deliverables above the suggestions, the Days container, a day's shot list carrying the brief strip plus the deliverable and `YOU` counters, On camera with the four-point presence radio, the conflict screen, the Cast screen, and a shot list for a project whose lead is someone else.

*States:* no brief written (`! NO BRIEF` on the day row; the list stays generic and says so) · brief written offline (banner offering to re-read it when signal returns) · extraction got it wrong (chips are tappable before anything is generated) · a deliverable conflicting with the presence level (stays listed, workaround proposed, never silently dropped) · treatment and presence contradicting each other (named plainly, three explicit exits).

### Project actions
The `⋯` sheet, the delete confirmation, and edit steps 1 and 2 — specified in §5.14.

*States:* sheet open · delete confirming · edit with no list-affecting change (no `CHANGES` box) · edit that moves shots (the box, above `SAVE`).

### Wrap
Three boards — a middle day, the blocked one, and the last day — specified in §5.12. Night theme, because wrap is the exit from shoot mode.

*States:* a middle day · the last day or a single-day shoot (no chips; the budget sets the sentence) · a `[★]` outstanding · nothing flagged (the group is absent, not empty) · nothing flagged and nothing missed (the screen is four lines).

### Shoot mode *(night only, by design)*
The on-set variant, and the reason the night theme exists. One shot at a time. Location and remaining daylight pinned at the top, big `04/12` counter. The current shot gets a 28px subject and its spec as chips. Two upcoming shots below, nothing more. The primary target is 72px tall — `[✓] GOT IT` — with `SKIP` and `FLAG` at 56px beneath it. No tabs, no navigation, no way to get lost.

- **The counter** is today's exposed count over today's shots — `04/12` means four got.
- **`SKIP`** sends the shot to the end of today's queue, still `[ ]`. If you never come back to it, wrap asks about it with the rest.
- **`FLAG`** asks for a short note, then moves on; the note becomes the shot's `!` line (§4.4).
- **After the last shot** it doesn't jump to wrap: it says everything's through and offers `+ ADD SHOT` and `WRAP` (§5.12).

It's night-only because it's a screen you'd only ever open on a set. If usage says otherwise, it themes like everything else.

---

## 9. The theme control

**Where it lives:** Settings → Appearance → Theme. First row of the first group. That's it — no header toggle, no icon in the nav, no gesture.

**What it is:** a three-way segmented control, `DAY / NIGHT / AUTO`, with a line of helper text beneath that changes with the selection:

- *Auto* — "Auto follows sunset where you are. Tonight it switches to Night at 5:52 PM."
- *Night* — "Night is pinned on. Switch to Auto to follow sunset where you are."

**Auto is the default**, and it should be. A videographer's day genuinely does change light partway through, and sunset is a better trigger than an OS-level dark-mode schedule because it matches the thing they're actually reacting to. Auto falls back to `prefers-color-scheme` when location isn't available.

**Where "where you are" comes from.** The phone's location if it's been allowed, else the coordinates of the project whose shoot date is today (§5.10), else `prefers-color-scheme`. Sunset is calculated on the device, so Auto keeps working offline.

**How the choice is kept.** The setting lives in `localStorage`, not with the projects in IndexedDB, because it has to be known before the first paint: a small inline script sets `data-theme` on `<html>` before anything renders, so a pinned Night never flashes Day on launch. `theme-color` follows the resolved theme so the OS chrome matches.

**Why it's buried.** The point of two themes here is that the app is already right when you open it. A visible toggle invites fiddling and takes up a corner of every screen for something you'd touch twice a year. The one concession worth building: a **long-press on the app icon** offering "Open in Night" as a shortcut, for the shoot that starts before the sun goes down.

---

## 10. Open problems

1. **The look board is still the weak screen.** Mono captions on paper are handsome but not evocative, and that's the half of the product that's supposed to make you want to shoot. The fix is to deliberately break format there: full-bleed tiles, chrome pulled almost entirely away, the reference images doing all the talking. Worth designing next.
2. **Reference images are placeholders throughout.** Every tile on the canvas is a flat tonal block. The directions should be re-judged with real frames from your own work before anything is built — imagery changes the read of a design more than any token does.
3. **Suggestion templates need writing — partly drafted.** On 22 Sep Claude Code drafted 41 more (flagged `"draft": true` in `templates.json`) to fill the thinnest areas: gear-free pieces to camera, interview room tone and cutaways, events, tutorials, scripted coverage. They're a starting point to rewrite from real lists, not a finished library. The engine in §6.2 is only as good as its template library, and that's a content problem more than a design one — a few dozen shots per shoot type, each with honest requirements and a reason line worth reading. Worth drafting by hand from your own past lists before anything generative goes near it.
4. **Shoot mode in day theme** — see above. Unresolved on purpose.
5. **Multi-day projects.** The model has `Project → Location → Shot` but a three-day shoot needs a day axis, and it isn't in the screens yet — it also collides with beats, since a beat can span days.
6. **Budget numbers are guesses.** The shots-per-minute ratios behind the budget ranges in §5.2 are reasoned, not measured. They should be calibrated against your own finished edits — count the shots in a reel you were happy with and work backwards.
7. **Brief extraction quality is unproven.** The confirm screen in §5.6 assumes extraction is usually right and occasionally wrong. If it's often wrong, the confirm becomes friction rather than safety and the whole interaction needs rethinking. Test with real briefs before committing — and watch whether people actually read that screen or press through it, because a confirm nobody reads is worse than none.
8. **`THE SUBJECT` needs a defined presenter beat.** It says it adds one, but where it sits in each format's structure isn't specified — probably after the hook for a reel, at the intro for longer pieces. Also unresolved: what share of the shot budget it should claim.
9. **Bystanders are still unhandled.** Named cast is in; strangers who wander into a wide are not. Travel and doc work both capture them routinely, and the app says nothing about it.
10. **Supporting cast has no ordering rule.** Two people at *part of it* is ambiguous — the engine needs to know whether to give them equal coverage or favour the one listed first.
11. **Moving shots into a full day.** The last-day case is resolved (§5.12), but `MOVE TO DAY 3` still doesn't check whether day 3 has room. Moving two shots into a day that's already at its ceiling should say so at the moment of choosing, not surface later as an over-budget warning on a day you haven't started.
12. **No welcome before first launch.** The empty Projects screen doubles as onboarding. That may be enough for a local-first app, or it may be too cold a start — worth watching with real first-timers.
13. **Google sign-in is drawn as plain text.** A shipped build must use Google's own button asset and follow their branding rules; the board is a placeholder for layout only.
14. **`UNPLACED` has no screen of its own.** It's specified as a group at the foot of the list, but a project where most shots are unplaced — the common state early on — hasn't been drawn, and that's the state a first-time user is most likely to be in.
15. **Changing format after shots exist — partly resolved.** The edit flow now states what a change does to planned shots before saving (§5.14), and fewer days is drawn. Still undesigned: changing the *delivery* re-seeds the beats (HOOK/BUILD/PAYOFF → OPEN/MIDDLE/CLOSE), and shots already assigned to a beat need a mapping rather than falling back to unassigned.
16. **Setting `[★]` by hand has no control.** The long-press drawn for it (§5.7) is unassigned in v0. Since M6 the online read creates required shots, but offline nothing can — so without signal, the deliverable guard in wrap (W2) can't be reached. Likely a `REQUIRED FOR` row with a client name in add / edit shot. Needs drawing.
17. **A guessed beat can't be corrected.** Hand-added shots get an inferred beat (§5.4), but there's no control to change it — no beat field in add / edit, no drag between beats. Wrong guesses will show up in the beat view.
18. **Per-day budget split is even.** §5.9 wants each day's share to follow what the day is doing (9 / 16 / 19, not 15 / 15 / 14). v0 splits evenly and lets you edit; a suggestion from the brief is v1.
19. **Redoing the list when gear arrives.** Gear is stubbed in v0, so suggestions are gear-free. When gear lands (v1), adding it to a project with a generated list should offer to redo the list for the new kit — same add-or-replace choice as reading the brief again (B10). Not drawn.
20. **Place chips from capital letters will misfire.** The offline rule in §5.6 turns any capitalised mid-sentence word into a place chip, so brand and people's names come through as places. Cheap to dismiss, but worth watching how often it happens.
21. **Place names leave the device for the sun-times lookup** (§5.10). It's one short request per name, with no brief text, but it is a network call the rest of the offline path doesn't make, and the privacy note should say so the first time.
22. **Four glyphs the boards use aren't in the font we can get — resolved.** See Appendix B: upstream JetBrains Mono self-hosted, ★ drawn. Original note: Google's build of JetBrains Mono has no `✓` (U+2713), `★` (U+2605) or `⋯` (U+22EF) at all, and serves `←` (U+2190) in no subset. All four are drawn by a system fallback font today — including the `[✓]` and `[★]` status marks, the most-seen glyphs in the app. Options: self-host upstream JetBrains Mono if it has them (needs a subsetting step), or draw these four as inline SVG sized to the mono cell. Found by the M0 proof page's glyph check.

---

## Appendix A — the four directions explored

| | **A — Darkroom** | **B — Camera Report** | **C — Contact Sheet** | **D — Paper Report** |
|---|---|---|---|---|
| Ground | Warm paper | Near-black | Bone white | Warm paper |
| Accent | Safelight red | Phosphor amber | Chinagraph red | Safelight red |
| Type | Condensed caps + serif + mono | Mono only | Grotesque + mono | Mono only |
| Radius | 4px | 0 | 2px | 0 |
| Signature | Sprocket rules, EXPOSED stamps | Bracketed status codes | Numbered frames, red circles | Bracketed codes on paper |
| Outcome | Warmth kept, as the day palette | **Shipped as the night theme** | Set aside | **Shipped as the day theme** |

A's palette and B's structure are what survived. A's serif, condensed display face, sprocket rules and rotated stamps did not — they're recorded here in case the look board ends up wanting the serif back for treatment text.

---

## Appendix B — font loading

```
JetBrains Mono (wght 400,500,700) — the only family the shipped design uses
```

Self-hosted from JetBrains' own release (OFL; `src/fonts/`), three weights, one woff2 per weight (about 93 KB each), precached by the service worker so type renders offline.

**Why not Google's build.** It was the plan (`next/font/google`), and the M0 proof page's glyph check showed it leaves out `✓` (U+2713) and `⋯` (U+22EF) entirely and serves `←` (U+2190) in no subset — the exposed mark, the project-actions button and every back link were being drawn by a fallback font. The upstream font has those, plus `⋮` (drag handles) and `✕` (chip remove). It isn't subset: that would need a font tool, and the whole file is small enough.

**★ is drawn.** Neither build has U+2605. The upstream font's only star, `✶`, reads as an asterisk at row size, and the phone's fallback star is heavier and larger than the brackets and different on every phone. So `[★]` is the brackets in the font around an inline SVG star one mono cell wide, at the brackets' weight, in `currentColor` (`<Star />`). Rina chose this over the other two (build-journal, 22 Sep).

---

## Appendix C — what's next

- Redesign the Look board against problem 1 above.
- Swap real reference frames into every tile and re-judge.
- Draft the suggestion template library per genre × treatment × format, and design the multi-day axis.
- Design wrap / end of day, including the blocked wrap when a deliverable is outstanding.
- Design shot-level edit, duplicate, delete and reorder.
- Write the token file as CSS custom properties and the component CSS to match §7 — at which point this document becomes the spec the code is checked against rather than the place the design happens.
