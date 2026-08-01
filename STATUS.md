# KPOT — Current Status

> This file is read by the AI agent before every task. Update it on every significant change of state.
> It is the PRIMARY handoff between sessions: a new agent session starts with empty context and must be
> able to get productive from this file alone. Write accordingly — concrete, with file paths and commands.
> 🧠 Prime thinking principle — `PHILOSOPHY.md` (SIMPLICITY: KISS + Occam). Read your working framework
> in `AGENT_GUIDE.md`.
>
> ⚠️ **STATUS is a SUMMARY of NOW, not a chronicle** (KAIF 2.1 convention, adopted here 2026-08-01 —
> this file was **1204 lines**, an abyss rather than a summary). The rules that keep it one:
>
> - **Every line passes two tests:** *"if I remove this line, will the next agent make a mistake?"*
>   and *"does a newcomer still read the whole file in one sitting?"* Soft target **~200 lines** —
>   a warning, not a wall, but crossing it means a trim is overdue.
> - **Closed work is MOVED OUT, not accumulated:** when a phase/session entry stops being "now", it
>   moves VERBATIM into `PROJECT_HISTORY.md`. `/end-chat` carries the "bonsai trim" step for exactly
>   this; `/pause` stays ceremony-free by design.
> - **Leave the file the way you'd want to find it:** what works, what's in progress, what's next,
>   the pitfalls, and WHERE TO LOOK for detail — pointers, not retellings.

---
## What was done — the chronicle lives in `PROJECT_HISTORY.md`

Phases 0–6.6, every session from 2026-07-24 to 2026-07-30, releases 0.1 «First KPOT» and 0.2
«Obvius», and the closed-bug roll moved VERBATIM to `PROJECT_HISTORY.md` on 2026-08-01 (the
bonsai trim of KAIF 2.1: STATUS is the summary of NOW, ~200-line soft target; the chronicle is
not required reading and is opened only for archaeology).

**The state it left behind, in one paragraph:** every phase of the product is implemented and
green — scan · dating · dedupe · plan · backup/dry-run/apply/rollback · the local web interface
(wizard + control panel) · the portable Windows ZIP. Release 0.2 «Obvius» is public. The suite is
the gate (`npm test`), and it has never been red at a commit.

## Session of 2026-08-01 — KAIF 1.6 → 2.1, and the owner-review contour

Two things the owner ordered in one line: «тогда делай обновление KAIF до версии 2.1 из origin.
потом контур вычитки по опыту NDim проекта». Both done; suite 294 → **300**.

- **KAIF 2.1 «Strong KAIF» is deployed** (bootstrap route, predicted on a sandbox copy that matched
  the live pass exactly). Owner documents and product code: zero changes. Skills 26 → 34. STATUS
  1204 → ~470 lines — the chronicle moved verbatim into the new `PROJECT_HISTORY.md`. Full record:
  `KAIF_FRAMEWORK.md` §Обновление 1.6 → 2.1. **This was a one-time order, not a licence** — his
  standing «я сам веду обновления КАИф» still holds.
- **The owner-review contour is BUILT** — `/owner-reviews`, ported from the field-proven NDim
  implementation on his instruction («точно так же сделать») and to the executable contract in
  `d:\work\ai_sandbox\ndim\researches\28_owner_reviews_contour_field_report.md`:
  - `tools/lib/review-core.mjs` — one normalization/hash contract for page and gate, the document
    parser, decisions written to THREE places, quiet hours, a 45-check self-test;
  - `tools/review.mjs` — the page (both OS themes, state-coloured stripe, «ждёт вас»/«отвечено»
    tags, second click clears a choice, embedded audio/images/live mock-ups, auto-close 2 s in an
    app window), the localhost server, the signal (three beeps 880/660/990 + Silero voice borrowed
    from KLAS, SAPI fallback), `queue`/`batch` for autonomous loops;
  - `tools/questions-guard.mjs` — the place-of-questions guard with a **baseline ratchet** (debt 2,
    must go down) and the **stale-status** detector;
  - `tools/review-gate.mjs` — the fail-closed send gate. **Armed but unused: KPOT has no outbound
    routine.** Wiring it into `/release` is a backlog candidate, not a done thing.
  - **It paid for itself before its first page existed:** the guard found interviews **#002 and
    #003** still marked «❓ ОЖИДАЕТ ОТВЕТА ВЛАДЕЛЬЦА» six and three days after the owner had
    answered them in chat. Both statuses corrected.
  - **Honest gap:** no browser-driven QA run (that would need Playwright — a dependency this project
    does not have). Covered instead by 6 specs incl. an end-to-end over HTTP; NOT covered by machine:
    the click mechanics and the two themes as PIXELS. Those await the owner's eyes.

## Where we are now

**Phases 0–4 are CLOSED and Phase 5 is well under way.** `kpot scan` walks a tree and dates every
media file with evidence; `kpot plan` turns that into the pre-sort master plan the owner reads;
`kpot apply` executes it — but only ever after a backup it verified — and `kpot rollback` undoes it
completely. Sorting is idempotent, repeat runs are cheap (the scan cache), emptied folders are
cleaned up reversibly, and folders KPOT cannot judge by name are set aside for the owner instead of
being guessed at.

**KPOT may now write — and every guarantee `GOAL.md` demands before it does exists and is proven.**

**Phase 2 has no cuts left**: THM/XMP sidecar evidence landed 2026-07-28, so every evidence tier
`researches/02` predicted now exists in code. **plans/02 is complete through step 2** — an edited
photo's original is now found by its pixels when it exists.
**Phase 5's acceptance is met** (2026-07-28): a fresh sandbox copy of four real folders was sorted
under supervision — 813 files, 0 failures, the SHA-256 multiset unchanged, rollback rehearsed.
**README + the tagged release are DONE** (`v0.1`, 2026-07-28).

**Phase 6 — the interface — is COMPLETE** (6.0 … 6.6, 2026-07-29): `kpot ui` opens a guide on a
messy folder and a dashboard on a library, with three re-launchable runs, guarded folder links, a
run history with a working undo, the `НОВОЕ` inbox block, a portable package and the plain-language
pass over everything the program says. Suite **294/294**.

**RELEASE 0.2 «Obvius KPOT» IS PUBLISHED** (2026-07-29, tag `v0.2`) with both artifacts —
`KPOT-0.2.0-win-x64.zip` (33.2 MB, portable) and `kpot-0.2.0.tgz` (165 KB).

**⭐ THE PRODUCT IS IN FIELD TEST WITH REAL PEOPLE.** On 2026-07-30 the owner sent 0.2 to friends:
«отправил на тесты друзьям». This is the first time KPOT has been used by anyone who did not build
it, on machines nobody here has seen, against archives nobody here has surveyed. **Their reports
outrank every item in the backlog below** — see §Where to continue next session.

**The README is a USER MANUAL** (2026-07-30), rewritten in the owner's academic register after his
verdict on the old one: «текущий README считаем устаревшим фродом». Ten numbered sections in both
languages, describing the program as it is rather than how it came to be, with every statement
checked against the code and against a real end-to-end run.

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | ✅ done | researches 01+02, interview #001 ✅, fixtures, CLI, seasons, `src/core/`, `src/meta/` evidence model |
| Phase 2 — scan & metadata | ✅ done (fully closed 2026-07-28) | acceptance spec green; `kpot scan` = assets + evidence + verdicts; the last deferred cut — THM/XMP sidecar evidence — is implemented and proven on real data |
| Phase 3 — dedup & plan | ✅ done | `kpot plan` = SortPlan + owner-facing master plan; acceptance spec green (23 planted destinations + both ambiguities) |
| Phase 4 — safety (backup / dry run / rollback) | ✅ done | interview #002 answered; `src/apply/` = backup + the single writer + rollback; all three acceptance criteria green; guards proven by breaking them |
| Phase 5 — first real use & release | ✅ **done 2026-07-28** · released `v0.1` | ✅ scan cache · ✅ idempotent sorting (bug 01) · ✅ empty-folder cleanup · ✅ the `НА_РАЗБОР/` approval quarantine · ✅ progress output · ✅ resumability · ✅ plans/02 step 1 (editor exports dated honestly) · ✅ THM/XMP sidecar evidence (Phase 2's last cut, closed 2026-07-28) · ✅ plans/02 step 2 (the original found by its pixels) · ✅ the reset-camera-clock rule · ✅ supervised run on a fresh COPY of four real folders (`KPOT_SANDBOX`, 813 files, hashes identical, rollback rehearsed) · ✅ README + `/release` |

Full phase definitions with acceptance criteria: `MASTER_PLAN.md`.

---

## 🎯 The groomed backlog, ranked BY VALUE (2026-07-29)

> Owner's instruction that produced this section: «запланируй автономную работу по грумингу
> ценностей беклога». Ranked by what moves the product toward `GOAL.md`, not by what is easy. Every
> item below is autonomous unless marked otherwise.

| # | Item | Why it ranks here | Blocked by |
|---|------|-------------------|-----------|
| ✅ | ~~6.0 shared layer · 6.1 server · 6.2 wizard · the jargon debt~~ | **all four done 2026-07-29** — see the session record above | — |
| ✅ | ~~6.3 — the control panel, incl. the undo button~~ | **done 2026-07-29** (`plans/07_DONE`, commit `c3dac29`) — three re-launchable runs, guarded folder links, history with an undo on every row that can honour one | — |
| ✅ | ~~6.4 — the `НОВОЕ` top-up~~ | **done 2026-07-29** (`plans/08_DONE`, commit `abac68a`) — four misbehaviours removed rather than a pipeline added; it also caught `bugs/05_DONE`, a false deletion warning shipped in `v0.1` | — |
| ✅ | ~~6.5 — the portable package~~ | **done 2026-07-29** (`plans/09`, 33.2 MB, built + verified on its own runtime). Its recon refuted the epic; the clean-machine acceptance is deferred by the owner to a friend's PC | — |
| ✅ | ~~6.6 — the closing language pass~~ | **done 2026-07-29.** The interface epic is complete. Found by reading, not grepping: the reports had never had the pass at all | — |
| ✅ | ~~`bugs/06` — a messy folder mistaken for a finished library~~ | **fixed 2026-07-29** by the owner's rule: KPOT leaves a **receipt** and asks it, instead of guessing from a `2013/` folder | — |
| ✅ | ~~A user-facing README for the interface + download instructions~~ | **done 2026-07-29** (commit `769c627`), in both languages: what the two screens are and why one or the other appears, the receipt file explained to the person who will meet it in their own folder, and the `researches/09` §6.2 obligation discharged — the Windows first-launch dialog named in its own words, with the button to press. (This row appeared TWICE in the table; deduplicated) | — |
| ✅ | ~~**Release 0.2 «Obvius KPOT»**~~ | **published 2026-07-29** on the owner's explicit word («НА ВСЁ ДАЮ ДОБРО»). Tag `v0.2`, two artifacts: the 33.2 MB portable ZIP and the 165 KB npm tarball. It closes BOTH honest limits `0.1` declared about itself — «No GUI yet» and «No pixel-level matching yet» | — |
| 3 | **A square app icon** | The shortcut currently shows its target's icon. Blocked on a BRAND decision, not on work: the logo is a 1734×907 banner and a square mark out of it is the owner's call (EXP-0023). One line once he supplies one | **the owner** |

**Explicitly NOT on this list, and why** — so a future session does not resurrect them:
- **`plans/02` step 3 (PRNU)** — unstarted and **unauthorised**. It identifies a camera, not a
  photograph. Not a candidate until the owner says so.
- **KAIF framework updates** — the owner runs those himself («я сам веду обновления КАИф»). A newer
  release existing is not a task.
- **Thumbnails** — cut by the owner on 2026-07-29. Wherever an eye is needed, the UI links to the
  folder.

## 🤖 Autonomous backlog pool (no human / no special hardware needed)

> Tasks the agent can do FULLY autonomously: write code → build → test on the harness → fix → commit,
> without the human and without resources only the human can provide. The loop skills
> (`/autoloop`, `/dayloop`, `/nightloop`) grind this pool.

- [x] Prior-art research → `researches/01_prior_art.md` — ✅ done 2026-07-24, npm facts spot-verified.
      Recommendation: reuse `exifreader` (images) + `node:crypto` staged SHA-256 (exact dups); write our
      own MP4/MOV box parser, filename patterns, DateVerdict resolver and all product logic; defer
      perceptual hashing. ExifTool vendoring = owner fork (interview).
- [x] Fixture generator `tests/fixtures/make.mjs` — ✅ done 2026-07-24. 22 planted cases from the
      real-chaos catalog (EXIF dates, mvhd dates, epoch names, "+"-twins, Cyrillic extension, dup
      group, junk, audio, hand-sorted season subtree, broken clock, mtime spike) + `expected.json`
      ground truth. `npm test` = 5/5 green (`tests/fixtures.test.mjs`). Grow the catalog with every
      new feature.
- [x] CLI skeleton `bin/kpot.mjs` — ✅ done 2026-07-24. `parseArgs`, phase dispatch (scan/plan/apply/
      rollback), `--help`/`--version`, stable exit-code contract (0 ok · 1 error · 2 usage · 3 not
      implemented), dir-existence validation, `bin` entry in package.json. 7 specs in
      `tests/cli.test.mjs`; suite 12/12.
- [x] `src/core/` primitives — ✅ done 2026-07-24. `paths.mjs` (win32 normalization, long-path/UNC
      prefixes, `samePath`/`isInside`), `journal.mjs` (append-only JSONL, durable per-record append,
      torn-tail tolerated for crash rollback), `pool.mjs` (`mapLimit` settle-all). 14 specs.
- [x] Date-evidence model in `src/meta/` — ✅ done 2026-07-24. `evidence.mjs` (precedence from
      Elodie + survey, wall/instant claims, plausibility window) + `filename_date.mjs` (all survey
      conventions incl. epoch decode with range sanity, double-dated names yield both claims,
      scavengers demoted to medium). 11 specs, verified against fixture `expected.json` ground truth.
- [x] Scan phase `src/scan/` — ✅ done 2026-07-24. Identify-by-content + walk + streamed hashing,
      wired to `kpot scan` (exit 0, JSON out). 8 specs incl. read-only proof; suite 48/48.
- [x] Phase-2 date pipeline — ✅ done 2026-07-24. Extractors (exif/mp4/dirname) + mtime spike
      discounting + DateVerdict resolver + annotate, wired into `kpot scan`. Acceptance spec green;
      suite 55/55.
- [x] Phase-3 dedupe + SortPlan — ✅ done 2026-07-26. `src/dedupe/dedupe.mjs` (sha256 grouping +
      total-order keeper choice), `src/plan/bucket.mjs` (destination rules incl. technical-vs-custom
      dirs), `src/plan/plan.mjs` (SortPlan artifact + Russian owner report), `kpot plan` wired with
      `--json`. 17 specs; suite 73/73; guards verified by breaking the code first.
- [x] Phase-4 safety — ✅ done 2026-07-26. `src/apply/backup.mjs` (manifest + hardlink snapshot,
      probed capability, explicit refusal), `src/apply/apply.mjs` (the single writer; dry run = the
      same loop with inert effects), `src/apply/rollback.mjs` (journal replayed backwards,
      idempotent, prunes only what the run created). `kpot apply`/`rollback` wired. 13 specs;
      suite 88/88; every guard verified by breaking it first.
- [x] Sidecar evidence (THM/XMP) — ✅ done 2026-07-28 (commit `d26ebb5`). Recon FIRST
      (`researches/04_sidecars.md`, read-only over the real archive), and it changed the design:
      a `.thm` is a 160×120 JPEG with full EXIF (34/34 carry `DateTimeOriginal`), and 25 of them sit
      beside an **AVI** — RIFF, not ISO-BMFF, so `mp4.mjs` reads nothing from it. Those 25 videos had
      only a folder year. `src/meta/sidecar.mjs` pairs by stem or full name (case-insensitively,
      within one directory), donates capture properties ONLY, and refuses to pair an orphan or an
      ambiguous stem. Fixture v4 (+6 cases), 13 new specs + the acceptance case; all five guards
      break-verified (1/5/3/1/1 red), plus the THM-quarantine guard (2 red). Real-data proof:
      **25/25 now `dated`, winner `sidecar`** —
      19 → `2012/Весна/видео/`, 2 → `2012/Зима конец года/видео/`, 4 → `2013/Осень/видео/`.
      Honest limit recorded: the XMP *date* path is fixture-only — the single real `.xmp` is an
      ACDSee catalog sidecar with no date at all.
- [x] Scan-map cache keyed by (path, size, mtime) — ✅ done 2026-07-26. `src/core/scan_cache.mjs`
      (load/lookup/save/re-key), wired into every phase via the CLI, `--no-cache` opts out. A repeat
      run reports `cache 26/26 reused (no re-hash)`, and `apply` re-keys the cache from its own moves
      so the cache survives a sort. 10 specs incl. three invalidation angles (changed content,
      same-size edit, backdated mtime) and corruption tolerance; guards verified by breaking them.
- [x] Empty-folder removal — ✅ done 2026-07-26 (owner's decision). Backup manifest records every
      DIRECTORY; the plan lists the folders that will disappear before the run; apply removes them
      deepest-first (re-reading each one, and using `rmdir`, never a recursive delete); rollback
      recreates them. 6 specs; the safety chain verified by breaking both links.
- [x] Suspicious-folder approval + the `НА_РАЗБОР/` quarantine — ✅ done 2026-07-26 (owner's decision,
      revised by the owner the same day). `src/plan/suspicious.mjs` (criterion: an unclear NAME) +
      `src/core/decisions.mjs` (an editable Russian decisions file at
      `.kpot-runs/папки-на-согласование.txt`, answers preserved across runs). Such a folder is moved
      WHOLE into a top-level `НА_РАЗБОР/` keeping its original parent structure; «как есть» leaves it
      there. Stripping that one prefix recovers the original path, which is what makes the flow
      idempotent and keeps `НА_РАЗБОР` out of the library. 12 specs; every guard verified by breaking it.
- [x] Progress output for large trees — ✅ done 2026-07-26. `src/core/progress.mjs`, wired into scan
      (walk · read · dates), backup and apply. stderr only and inert unless stderr is a TTY, so
      pipes and the JSON artifacts are untouched; repaints throttled to 5/s (measured: 17 904 per
      hour of work instead of 71 606); the ETA comes from the rate actually observed and appears
      only once there is enough of it. 9 specs; the three that matter verified by breaking them.
- [x] Resumability of an interrupted `apply` — ✅ done 2026-07-26. `src/apply/resume.mjs` +
      `openRunJournal`. An unfinished run BLOCKS a new one and offers two ways out; `--resume`
      reuses the same run id, journal and BACKUP, so one rollback still restores the true original.
      9 specs; all three guards verified by breaking them.
- [x] plans/02 step 2 — ✅ done 2026-07-28 (commit `c6bfee6`). `src/meta/pixels.mjs`: an editor
      export's ACTUAL original found by comparing images — candidates from `family.mjs`, coarse 16×16
      ranking, fine 32×32 verification of the finalists, and a date inherited only on a decisive
      margin over the best candidate from another day. `jpeg-js` (BSD-3-Clause) is the second runtime
      dependency; `--no-pixels` opts out. Design `researches/05` §7, calibration `researches/06`
      (which corrected it three times, and caught a real defect in our own code before it shipped).
      Fixture v6, 15 new specs + 5 for the reset-clock rule, all guards break-verified; suite 191.
      **Measured: 62/80 accepted with the right day when the original exists, 2/80 fabricated when it
      does not; on the real archive 1 of 95 — because the other originals are not there.**
      Step 3 (PRNU) stays unstarted and unauthorised.
- [x] Reset camera clocks — ✅ done 2026-07-28 (owner's decision). A «1 января 00:25» date is refused
      only when the archive itself proves the clock wrong (its year is below the collection's earliest
      trustworthy capture year); a genuine New Year photograph of the same shape is untouched. Both
      cases planted in fixture v6; `tests/meta_reset_clock.test.mjs`; guards break-verified (10 and 4
      specs red).
- [x] Season mapping — ✅ done 2026-07-24. `src/plan/season.mjs` (`seasonForMonth`, canonical Russian
      dir names per interview #001 Q2), specs in `tests/season.test.mjs`. Suite 15/15.
- [x] plans/02 step 1 — ✅ done 2026-07-27 (commit `e55ae91`). Editor save dates demoted to ceilings
      (`editor-save`), exact original lookup by XMP identity (`derived-original`), camera-family
      signs (`src/meta/family.mjs`). Fixture v3 (+7 cases), suite 156/156, guards break-verified,
      real-data measurement: 201 broken-class files → 199 lose their false year.

---

## ❓ Awaiting human review (interviews / homework)

> Decisions the agent must not make alone (brand/UX/architecture), or actions only the human can do
> (test on real hardware, external accounts). Filed in `interviews/` and `plans/homework_*.md`.

- ✅ **Interview #001 ANSWERED 2026-07-24** — all five forks decided (pure-JS extraction · five
  seasons with month boundaries · audio → `<год>/<сезон>/аудио/` · junk → quarantine with provenance ·
  other files stay + report; custom parent dirs preserved as nesting). Decisions recorded in the
  `MASTER_PLAN.md` decision log. Season mapping is UNBLOCKED.
- ✅ Video subdir confirmed in chat 2026-07-24: photos at season root, video → `видео/`, audio →
  `аудио/` inside each season dir.
- 🧰 Homework (owner only): provide a *copy* of a small, real, messy sample directory for realism
  checks — never the original archive, and never committed to the repo.
- ✅ **Two layout forks ANSWERED 2026-07-26** (in chat): duplicates → `ПРОЧЕЕ/_дубликаты/` with
  provenance; custom parent dirs → preserve all except technical. Both recorded in the
  `MASTER_PLAN.md` decision log. Phase 3 is UNBLOCKED and closed.
- ✅ **Interview #002 ANSWERED 2026-07-26** (in chat) — the backup is a **manifest + hardlink
  snapshot** (answer Б). Recorded in the `MASTER_PLAN.md` decision log; Phase 4 is closed. The
  interview document keeps the measurements the decision rests on.
- ✅ **The interface — FULLY ANSWERED 2026-07-28** (`ideas/02_electron_gui.md`; question 1 was
  answered 2026-07-26 with «после Фазы 5»). It is a **local Web UI**, not Electron and not Tauri,
  **plus an installer that puts a desktop shortcut** which starts it and opens the browser. Full
  scope (scan → plan → apply → rollback), planned **epic → phases → operational plans**. Audience:
  the owner AND inexperienced PC users, so UI, installer and every printed string must be friendly,
  foolproof and free of jargon and slang. Needs a `/revision` for an interface phase and an epic
  document before any code.
- ✅ **Russian device-folder names — ANSWERED 2026-07-26** by the owner's choice of the "unclear
  name" criterion: they are neither silently dropped as technical nor silently preserved, but put on
  the owner's table via the decisions file.
- ✅ **Empty source folders — ANSWERED 2026-07-26** (in chat): KPOT may delete the folders its sort
  emptied, provided their paths are in the backup so a rollback recreates them. Implemented; see the
  decision log and `tests/empty_dirs.test.mjs`.
- ✅ **"1 January 00:25" EXIF dates — ANSWERED 2026-07-28** (in chat): «сброшенным часам камеры не
  доверять, если это факт, что они сброшены». Implemented the same session with the owner's condition
  AS the mechanism: such a date is refused only when the collection itself contradicts it (its year
  is below the archive's earliest trustworthy capture year); a real New Year photograph of the same
  shape is untouched. `src/meta/resolve.mjs` rule 5, `tests/meta_reset_clock.test.mjs`, fixture v6.
- 🔎 **plans/02 is now COMPLETE through step 2, and the result is worth the owner's glance**
  (2026-07-28): step 1 stripped 199 of 201 false years; step 2 then searched for those photos'
  originals by their pixels and found **one** — because the others are not in the archive (their best
  candidates are 182–376 apart of 1024, where a true pair is 4–89). So the 83 «фоты на альб» pictures
  will stay in `ПРОЧЕЕ` with a ceiling, and that is the honest answer, not a gap to close. Step 3
  (PRNU) remains unstarted and unauthorised — it names a camera, not a photograph.
- ✅ **Idea 01 ANSWERED 2026-07-28** — `ideas/01_inbox_topup_flow.md`: the inbox lives **inside the
  library root**, its default name is **`НОВОЕ`**, and a processed inbox folder is deleted once it is
  empty and done. The fourth fork (how far one click goes unattended) dissolved into the UI decision:
  the shortcut opens the Web UI, so the confirmation is a button. NOT yet implemented — it belongs
  with the interface epic, after Phase 5.
- ✅ **Logo source PNGs — SETTLED** (this entry was stale; corrected 2026-07-28). Both design
  sources and `KPOT.jpg` live in `assets/` and are tracked (commit `581ca6b`). Nothing is awaiting
  a decision here.
- ✅ **THM placement — ANSWERED 2026-07-28** (in chat): «В мусорный карантин». A `.thm` is camera
  litter like `Thumbs.db`, so it is kind `junk` → `ПРОЧЕЕ/_мусор` with provenance, never in the
  library, deleted never. Implemented the same session; it keeps dating its video twin. Verified on
  real data: 34 thumbnails now carry no verdict, and 25/25 videos stay `dated` by `sidecar`.
  Recorded in the `MASTER_PLAN.md` decision log.
- ✅ **plans/02 step 2 (pixels) — AUTHORISED by the owner 2026-07-28** (in chat, answering the
  resume question): «Да, ищи оригинал по пикселям». This REVERSES the standing «пиксели не надо»
  for step 2 only. It unblocks perceptual-hash search for the actual original (`plans/02` §Шаг 2),
  including the one small pure-JS decode dependency that step names (`jpeg-js`, MIT, no native
  build) — a decision-log row, not a new interview. Step 3 (PRNU) stays unstarted and unauthorised.

---

## Where to continue next session

> A concrete checklist so the next session (empty context) can start immediately: which files, which
> commands, what to verify first.

1. Verify the environment: `node -v` (≥20), `npm test` (**must be 294/294**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha). Owner-provided paths from this file are PAST observations —
   re-check they still exist before planning around them (EXP-0011: a sample vanished once already).
2. **Run the whole product once, end to end, before designing on top of it.** It all works now:
   ```
   node tests/fixtures/make.mjs <tmp>          # fixture v6: 47 planted files + expected.json
   node bin/kpot.mjs plan <tmp>                # the owner-facing master plan
   node bin/kpot.mjs apply --dry-run <tmp>     # full simulation, zero writes
   node bin/kpot.mjs apply <tmp>               # the real sort (backup first, always)
   node bin/kpot.mjs rollback <run-id> <tmp>   # everything back where it was
   ```
   There is also a REAL sandbox, left sorted for the owner to look at:
   `D:\work\ai_sandbox\KPOT_SANDBOX` (813 files / 943 MB, four real folders; the owner authorised
   the copy on 2026-07-28). Undo it with
   `node bin/kpot.mjs rollback run-20260728-201538-437c4d D:\work\ai_sandbox\KPOT_SANDBOX`.
   Do not delete it without his word, and never copy more of his photographs without a fresh one.
3. ⭐ **THE PRODUCT IS OUT WITH FRIENDS FOR TESTING — THEIR REPORTS COME FIRST.** On 2026-07-30 the
   owner wrote «отправил на тесты друзьям». Until his feedback arrives, **do not start a new
   feature.** Ask him what came back, and be ready to act on it.

   **Why this outranks everything below.** Every defect this project has ever found that mattered
   came from contact with reality, not from the suite: `bugs/01`–`04` from the first real run,
   `bugs/05` from measuring the inbox, `bugs/06` from finally RENDERING the page after six phases of
   green specs. A friend's machine adds three things no fixture here has: **a clean Windows** (this
   development machine has both relevant defences disabled by policy, which is why the first-launch
   warning is still unverified — §10.2 of the README says so out loud), **an archive nobody
   surveyed**, and **a person who has not read a single document of ours**. Expect the failures to
   be in the first sixty seconds — download, unpack, the security warning, the first screen — not in
   the date logic.

   **When a report arrives, do this:** reproduce it on a FIXTURE first, never on their photographs;
   file it with `/report-bug` (the backlog is `bugs/`, numbering continues from 08); if it is a
   first-launch or packaging problem, remember the package is built **only from PowerShell**
   (EXP-0027). If a friend's archive must be examined, that needs the owner's explicit word and
   their own — the standing rule about his photographs applies to theirs with more force, not less.

   **Release 0.2 as shipped:** published 2026-07-29 as **«Obvius KPOT»** (tag `v0.2`) on the owner's
   explicit authorisation («НА ВСЁ ДАЮ ДОБРО»), with both artifacts attached:
   `KPOT-0.2.0-win-x64.zip` (33.2 MB portable) and `kpot-0.2.0.tgz` (165 KB). The README's download
   links are real links, in both languages, and were verified to return 200.

   **What the judge pass corrected before publishing, so nobody repeats it:** the scope was NOT
   «the interface epic + six bugs». `git log v0.1..HEAD` says two bugs closed since the tag (05 and
   06) — the other four predate it — and the pixel search (`plans/02` step 2) and the
   reset-camera-clock rule are ALSO new in 0.2, because `v0.1` was tagged before them. The clean
   framing that came out of it, and the one the notes use: **0.2 closes both honest limits 0.1
   declared about itself** — «No GUI yet» and «No pixel-level matching yet».

   **The next piece of work is genuinely open.** Nothing is ranked and unblocked. Candidates, none
   started: the clean-machine acceptance of the package (his, `plans/09` §9) · a square app icon
   (his, a brand decision) · `plans/02` step 3 (PRNU) which is **unstarted and unauthorised** ·
   whatever the owner finds when he actually uses 0.2 on his archive. **Ask him rather than
   inventing one** — and note that a first real run of the WINDOW on his 551 GB archive is the most
   valuable observation available, since every real-data session so far has found defects no
   fixture could.

   `researches/09` §6.2's requirement is already discharged in BOTH places it names — the package's
   own `ЧИТАТЬ.txt` (built by `tools/build_package.mjs`) and the README's download section: the
   Windows first-launch dialog is named in the words Windows itself uses, with why it appears and
   which button to press. We cannot promise silence on anybody's machine; the product warns instead
   of hoping. Keep that paragraph in any release notes too.

   **KEEP LOOKING AT THE PAGE.** The single most valuable tool this project gained on 2026-07-29 is
   a browser you control: `--headless=new --remote-debugging-port=N --user-data-dir=<temp>`, then
   CDP over a WebSocket — navigate, click, read `innerText`, screenshot. Scripts `ui_shot.mjs`,
   `ui_drive.mjs`, `ui_wizard.mjs` in that session's scratchpad. It found, in one afternoon, defects
   that six phases and 280 green specs never could: the wizard's step strip drawn on the panel,
   every run card labelled «Дальше», and bug 06 itself (EXP-0024).

   **Two items are open for the owner, not blocking:** the clean-machine acceptance of the package
   (he chose to do it at a friend's, «сильно позже» — exact steps in `plans/09` §9, and it MUST
   print the two attachment-policy values first or the result is unreadable), and a square app icon
   (a brand decision — EXP-0023).

   **Phase 6.4 is CLOSED** (2026-07-29, commit `abac68a`, `plans/08_DONE_novoe_topup.md`). Two
   things from it a next session should not have to rediscover: the plan document's own refutation
   of the duplicate-keeper problem was **itself refuted by measurement** (it had used an undated
   file; with a dated one the date criteria tie and depth hands the library's place to the
   freshly-dropped copy — `plans/08` §3a, EXP-0021); and the same probe found `bugs/05_DONE`, a
   false deletion warning that had shipped in `v0.1` and made the **rehearsal disagree with the real
   run** (48 folders vs 1). Both are fixed and guarded.

   **The recon that gated it is DONE** — `researches/08_open_folder_and_path_safety.md`, measured on
   this machine 2026-07-29. Its three findings, so nobody re-derives them:
   - **`explorer.exe` exits 1 even when it succeeds** (3 of 3 tries on a folder that opened). The
     exit code carries no information: check the path BEFORE launching, then ignore the result.
   - **A junction defeats the textual `isInside`** — `mklink /J` inside the library, no admin rights
     needed, points anywhere on the machine and the textual check says "inside". `realpath` catches
     it. `src/core/paths.mjs` is correct for the plan and **insufficient as a security boundary**.
   - **8.3 short names break the same check the other way** (a legitimate path rejected), and
     `realpath` fixes that too. One rule covers both: **resolve first, then check containment, then
     launch.** A path that cannot be resolved is refused — `realpath` throws `ENOENT`, which is the
     answer we want anyway.

   **Most of 6.3 is ALREADY BUILT** (2026-07-29). What exists:
   - `src/ui/reveal.mjs` + `POST /api/reveal` — resolve the real path, refuse anything outside the
     library with a plain Russian sentence, then launch and ignore the exit code. Eight specs,
     including one that **builds a junction escape and proves it refused**, and that skips LOUDLY if
     `mklink` is unavailable rather than passing quietly;
   - `libraryShape()` + `GET /api/library` — the question that chooses the face. A folder is a
     library if it holds a `<год>` directory or `ПРОЧЕЕ`, shapes KPOT itself creates;
   - the panel screen: three re-launchable runs, the attention count, the years newest-first with
     «Открыть» on each, and a sort that still passes the one confirmation and returns to the panel.

   **6.3 is CLOSED** (2026-07-29, commit `c3dac29`, `plans/07_DONE_undo_button.md`). The undo button
   exists and is guarded on the SERVER, not on the page: the run must resolve by its **real path**
   into this library, `listRuns` must already call it `undoable`, the confirmation names the run and
   the numbers, and nothing else may be running. Its specs assert the **absence of an effect** (a
   sha256 census of the tree) on every refusal, and byte-for-byte restoration on the success.

   **What the panel must do** (owner's own words, interview #003): re-launch **any of the three runs**
   (scan · plan · sort) with a state on each card · show what needs a decision — folders awaiting an
   answer (answered in the UI, over the existing `src/core/decisions.mjs`) and disputed dates · the
   library by year with **links that open folders, никаких миниатюр** · the `НОВОЕ` top-up block ·
   a run history with a rollback on each row.

   Read first: `plans/03_interface_epic.md` (the cut and each acceptance criterion), the two closed
   plans `04_DONE`/`05_DONE` for how the layers fit, and `interviews/interview_003_designs.html`
   (the clickable mock-up — the «Пульт управления» tab is the target).

   **The golden harness from 6.0 is worth re-creating** for any later refactor: it lifts the previous
   code out of git (`git stash push -- <file>`), runs 13 CLI scenarios and diffs byte-for-byte. It
   lived in the session scratchpad (`golden.mjs`). **Self-test it first by capturing twice from
   unchanged code, then by planting a break** — its first version was blind to two of the four apply
   endings and said nothing (EXP-0016).

   **The design, settled:**
   - **Two screens.** A wizard for the first flight (four steps, one thing per screen, the four
     `GOAL.md` guarantees visible at the bottom). Once the library exists, it steps aside for a
     **control panel**: three run cards (scan · plan · sort) each re-launchable at any time, an
     attention section (folders awaiting a decision, disputed dates), the library by year with
     **links that open folders** (no thumbnails — the owner cut them), the `НОВОЕ` top-up block, and
     a run history with a rollback per row.
   - **Server + «морда» are separate.** Closing the browser does NOT stop the server. Three
     obligations follow: an explicit «Завершить работу» control; a second launch must FIND the
     running server and open the face on it (never start a second one — port conflict); and the
     server stays the only writer, so RULE 1 holds with the UI as one more caller above `src/apply/`.
   - **Security is not optional even on localhost** (`researches/07` §5.1): bind `127.0.0.1`, default
     port with a random fallback, a token minted at start-up and carried in the opened URL, a `Host`
     header whitelist, and the browser opened only after the `listening` event.
   - **Delivery: a portable ZIP** — «скачал - распаковал - готово». It carries Node's own signed
     binary (measured: Authenticode Valid, OpenJS Foundation, 87.4 MB → **32.7 MB zipped**) plus our
     `.mjs`, so no unsigned executable is ever introduced and SmartScreen has nothing to fire on.
     First run offers to create a desktop shortcut. **Verify on a real download** before promising it:
     files from a downloaded ZIP inherit the Mark-of-the-Web and the Attachment Manager may warn once
     on a `.cmd` launcher — a locally-created shortcut carries no such mark.
   - **Bilingual RU/EN with a switch** (Russian default) ⇒ every UI string lives in a dictionary from
     the first line of code. Window title: «Krinik Photo Organizer Tool (KPOT)». One deliberate
     confirmation with the numbers before the sort. No access from other devices.
   - Idea 01 (the inbox/top-up) is part of this epic: inbox **inside** the library, named `НОВОЕ`,
     emptied inbox folders deleted; the «ярлычок» he asked for IS this UI's shortcut.

   **A debt to clear while doing it:** the plan report still prints `dated 2012-06-15 (exif-original)`
   at the owner. He made plain language a hard requirement on 2026-07-28; the «даты, взятые у
   исходного снимка» section was already rewritten, the move lines were not. Scheduled in the epic
   as phase 6.6, but any earlier chance to fix it is a chance taken.

4. **Phase 5 is CLOSED** (2026-07-28): the supervised run on `KPOT_SANDBOX` sorted 813 real files
   with 0 failures, an identical SHA-256 multiset, and a rehearsed rollback. Nothing is left in it.
5. **Writing to the owner's REAL archive still needs a fresh `AUTH:`** — the standing grant is
   READ-ONLY, and it is the archive, not a copy. Everything measured this session was read-only.
5b. **Do NOT propose or perform a KAIF update** — the owner runs framework updates himself
   («я сам веду обновления КАИф», 2026-07-28). A newer KAIF release existing is not a task, not a
   backlog item and not a `/what-next` candidate. Related: `plans/01_kaif_16_update_report.md` is a
   FINISHED report addressed to the KAIF framework's own agent, not open work — `/check-backlog`
   should stop counting it as an open item.
6. **No owner question is open.** Every fork raised so far has been answered: ideas 01 and 02, the
   reset-clock policy, the pixel authorisation, the sandbox. What is waiting is his *review*, not a
   decision: the sorted sandbox, and the plans/02 result (95 editor exports → 1 dated by pixels
   because the other originals are not in the archive; in the sandbox, where they are, 4 of 4).
7. Decisions are all in `MASTER_PLAN.md` §Decision log — re-read before designing; do not re-ask the
   owner what is already settled there.
8. Before writing any new guard, re-read `EXPERIENCE.md` EXP-0008 (a guard that passes for the wrong
   reason — it happened again this session and the spec had to be rewritten), EXP-0009 (invisible
   characters in generated source) and EXP-0015 (a corpus statistic set BY the anomaly it targets).

---

## Open bugs

**None open.** Closed so far:

The roll of everything closed so far lives in `PROJECT_HISTORY.md`.
