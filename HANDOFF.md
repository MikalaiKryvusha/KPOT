# KPOT — handoff snapshot

> **Purpose.** This document hands the work to a DIFFERENT agent — possibly another model, another
> tool, without this repository's framework loaded. Read it top to bottom once and you can start
> working. It is a *snapshot*, not a second source of truth: where it summarises another document it
> names it, and that document wins on any disagreement.
>
> **Written:** 2026-07-28, at release `v0.1` (commit `5d77dbc`). **Suite: 171/171 green.**
> If today is much later than that, re-read `STATUS.md` first — it is maintained continuously,
> this file is not.

---

## 1. What this project is, in one minute

KPOT (**K**rinik **P**hoto **O**rganizer **T**ool) is an open-source CLI that turns a person's
chaotic home photo/video collection into a chronological library laid out as `<year>/<season>/`.

It scans a tree, works out **when** each file was captured from whatever evidence exists, groups
duplicates by content, and produces a plan the owner reads *before* anything moves. Then it executes
that plan — but only after a backup it has verified — and can undo the whole thing.

The owner is **non-technical about the internals and very clear about the intent**: this is his
family archive, 71 606 files / 551 GB. His contract is `GOAL.md` (in Russian, his own words). The
single most important sentence in this whole repository is the one it implies:

> **A wrong sort is annoying. A lost photo is unforgivable.** Safety outranks tidiness, always.

- **Language split (a real rule, not a preference):** documents for agents (this one, `STATUS.md`,
  `AGENT_GUIDE.md`, code comments, `bugs/`, `plans/`, `researches/`) are **English**. Documents the
  owner reads (`GOAL.md`, `README.md`, the directory READMEs) and **every chat message to him** are
  **Russian**. The tool's own output to users is Russian.
- **Repo:** https://github.com/MikalaiKryvusha/KPOT (public, MIT). Local: `D:\work\ai_sandbox\KPOT`.
- Built by AI agents under the KAIF framework, with the owner steering the vision.

## 2. Current state

**Release `v0.1` "First KPOT" is published** (2026-07-28). All four phases work end to end and the
tool has sorted a real archive sample. Everything below is verified, not claimed:

| | |
|---|---|
| Test suite | **171/171** green (`npm test`, `node --test`) |
| Phases 0–4 | ✅ closed (foundation · research+skeleton · scan/dates · dedupe/plan · safety) |
| Phase 5 | 🔶 in progress — release done; the full-archive supervised run is the owner's step |
| Open bugs | **none** (four closed, all found by real data — see `bugs/`) |
| Runtime deps | exactly one: `exifreader` |
| Node | ≥ 20 (developed on 24, Windows 11) |

The five commands, all live:

```bash
node bin/kpot.mjs scan <dir>               # what each file is + when it was taken + the evidence
node bin/kpot.mjs plan <dir>               # the owner-facing master plan (+ --json for the SortPlan)
node bin/kpot.mjs apply --dry-run <dir>    # full rehearsal, zero writes
node bin/kpot.mjs apply <dir>              # the ONLY writer; refuses to start without a backup
node bin/kpot.mjs rollback <run-id> <dir>  # everything back where it was
```

## 3. Get productive in ten minutes

```bash
node -v                                    # must be >= 20
npm test                                   # must be 171/171
git status                                 # must be clean; work on main, no feature branches

# then run the whole product once, end to end, on a throwaway tree:
node tests/fixtures/make.mjs %TEMP%\kpot-try     # 39 planted files + expected.json ground truth
node bin/kpot.mjs plan %TEMP%\kpot-try           # read this report with your eyes
node bin/kpot.mjs apply --dry-run %TEMP%\kpot-try
node bin/kpot.mjs apply %TEMP%\kpot-try          # prints the run id
node bin/kpot.mjs rollback <run-id> %TEMP%\kpot-try
```

There is **no build step** — plain Node ESM, sources run as written. `npm run build` does not exist;
do not invent it. The correctness gate is `npm test`.

## 4. The architecture in one page

```
bin/kpot.mjs   parses argv, dispatches a phase, composes the modules below
src/scan/      identify.mjs (kind by MAGIC BYTES, not extension) · scan.mjs (walk + streamed sha256)
src/meta/      the date pipeline — see below
src/dedupe/    groups identical files by sha256; picks the keeper by an explainable total order
src/plan/      season.mjs · bucket.mjs (one file -> its destination) · suspicious.mjs · plan.mjs (SortPlan + the Russian report)
src/apply/     backup.mjs · apply.mjs (THE ONLY WRITER) · rollback.mjs · resume.mjs
src/core/      paths · journal · pool · progress · scan_cache · decisions   (the bottom layer)
tests/         node --test specs + fixtures/make.mjs (deterministic messy tree + ground truth)
```

**Three rules that are not style preferences — breaking one is a bug even if the run "worked":**

1. **Only `src/apply/` may modify, move or delete a user's file**, and only after a verified backup
   exists and the journal records the intent. Everything else is strictly read-only over user data.
2. **Dependencies point one way:** `bin → apply → plan → {dedupe, meta, scan} → core`. A lower layer
   never imports a higher one; siblings never import each other (shared code moves down to `core`).
3. **A date is never invented.** Every verdict names its winning evidence *and keeps the claims it
   overruled*; anything unresolved goes to the global `ПРОЧЕЕ` bucket and is listed in the plan's
   disputed section.

**The date pipeline** (`src/meta/`) is the heart. Evidence kinds in precedence order live in
`evidence.mjs` — strongest first: `exif-original`, `derived-original`, `filename-timestamp`,
`container-created`, `filename-epoch`, `exif-modify`, `sidecar`, `dirname`, `filename-year`,
`family`, `dir-cohort`, `editor-save`, `fs-mtime`. `resolve.mjs` turns a list of claims into one
`DateVerdict`. Three honesty rules are baked in and must survive any refactor:

- implausible years (broken camera clocks) never win — they go to `disputed`;
- **`fs-mtime` never determines a date** (18 656 real files share one bulk-copy day);
- **`editor-save` never determines a date** — a photo editor's save date is a "taken no later than"
  ceiling, surfaced to the owner, never a verdict.

Full maps: `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` (how the system thinks — read the **11 invariants**)
and `PROJECT_STRUCTURE_EXTERNAL_MAP.md` (where things live).

## 5. Decisions already made — do NOT re-open these

`MASTER_PLAN.md` §Decision log is the canon, dated and reasoned. The ones a fresh agent is most
likely to accidentally re-litigate:

| Decision | Short form |
|---|---|
| Seasons | five buckets: `Зима начало года` (Jan–Feb) · `Весна` (Mar–May) · `Лето` (Jun–Aug) · `Осень` (Sep–Nov) · `Зима конец года` (Dec) · plus `прочее` per year |
| Layout | `<год>/<сезон>/[видео\|аудио]/<custom folders>/<original name>`; photos at the season root |
| Moves | filesystem **renames**, never copy+delete (the archive would not fit twice) |
| Backup | manifest + hardlink snapshot; capability **probed**, never assumed; refuses to degrade silently |
| Duplicates | keeper goes to the library, other copies to `ПРОЧЕЕ/_дубликаты/` with provenance in the name |
| Junk | `ПРОЧЕЕ/_мусор/` with provenance. **Nothing is ever deleted** except folders the sort itself emptied (and those are in the backup manifest, so rollback recreates them) |
| Unclear folder names | moved WHOLE into `НА_РАЗБОР/` keeping their original parent structure, and only when sorting would actually scatter them; the owner answers in a plain text file |
| Metadata extraction | pure JS (`exifreader` + our own MP4 box parser). ExifTool vendoring would be an owner-level fork |
| `.thm` thumbnails | camera litter → quarantine; they still donate their date to their video twin |
| Sidecars | donate only unambiguous CAPTURE properties, never save dates |

## 6. The next piece of work, fully specified

**`plans/02_lost_photo_family.md` §Шаг 2 — find a photo's actual original by pixels.**

Step 1 of that plan is done (editor save dates demoted to ceilings; XMP identity chain; camera-family
signs). Step 2 was blocked by the owner's «пиксели не надо» and **he reversed that on 2026-07-28**:
«Да, ищи оригинал по пикселям». It is authorised; step 3 (PRNU) is not.

What it is: a perceptual hash (dHash/aHash over a downscaled copy) that finds the **actual original**
of an edited export in the archive — even cropped, re-compressed and renamed — so the export can
inherit the original's *real* `DateTimeOriginal` instead of an assumption. The plan already names the
dependency (`jpeg-js`, MIT, pure JS, no native build) and the hard part (a crop shifts the frame, so
compare over an overlapping region or via downscaled previews). Side benefit predicted by
`researches/01`: it finds renamed and re-encoded copies that sha256 dedupe cannot see.

**Before writing any code for it, produce a recon document** (`researches/05_*.md`) — that is a hard
rule here, see §8.

Other open, smaller items: `ideas/01_inbox_topup_flow.md` (an inbox + incremental top-up flow — forks
still open) and `ideas/02_electron_gui.md` (accepted as direction, scheduled after Phase 5).

## 7. What is waiting on the owner — never decide these alone

- **A fresh sample copy of a real messy directory** for the Phase-5 supervised run. The previous one
  (`KPOT_SAMPLE`) *he deleted between sessions* — do not recreate 13 GB of his personal photos
  without a fresh word.
- **The full-archive run** is his call and needs a fresh authorisation: the standing grant on his real
  archive is **READ-ONLY** (path in agent memory, never in this public repo).
- **Should a "1 January 00:00"-ish EXIF date be trusted?** One real file has `2000-01-01 00:25:13` —
  the classic reset-camera-clock default, in an archive that otherwise starts in 2007. Policy about
  *his* photos, so it was surfaced, not decided.
- Idea 01's open forks; idea 02's scope questions.

Rule of thumb the project runs on: *is it cheap to reverse?* If yes, decide it yourself and report.
If it shapes brand / architecture / UX / the layout of his files for the long term — ask.

## 8. Traps that already cost real time here

These are distilled from `EXPERIENCE.md` (grep it by tag before a task — it is the project's memory).

1. **A guard that has never gone red proves nothing.** Every new check must be verified by breaking
   the code first and watching it fail. This pass has already caught two specs that passed for the
   wrong reason (EXP-0008). Do break-and-restore on **committed** files so `git checkout -- <file>`
   is always the undo.
2. **Never round-trip a non-ASCII file through PowerShell 5.1** `Get-Content`/`Set-Content` — it
   reads UTF-8 as ANSI and silently turns every Cyrillic string into mojibake (EXP-0007). This repo is
   full of Cyrillic literals *because they are the product's output*. Use editor tools, or Git Bash.
3. **`git diff --stat` before every commit**, including diffs your tools generated. It is the only
   cheap detector of invisible characters — a hand-written `.mjs` once landed with two NUL bytes and
   git classified it as binary (EXP-0009).
4. **Test the pipeline on its own output.** KPOT once did not recognise the layout it had itself
   created, so every run nested one level deeper (EXP-0010, `bugs/01`). Ask `f(f(x)) == f(x)?` of any
   transform.
5. **An owner-provided path recorded in `STATUS.md` is a PAST observation.** Check it still exists
   before planning around it (EXP-0011 — a 13 GB sample had vanished).
6. **Recon before code when the task rests on an external truth** (a file format, a library's real
   behaviour, the real archive). The first artifact is a document in `researches/`, read from the live
   source, never from memory — and this is not ceremony: the most recent one turned a backlog item
   labelled "optional filler" into the only date 25 real videos have (EXP-0012).
7. **A backlog item's own description is a hypothesis about value**, written by a session that had not
   looked. Measure what the product currently does to the affected files *before* writing the fix —
   that before-number sets the priority and later proves the result.

## 9. Working rules (the short version)

- **Git:** work only on `main`, no feature branches. Commit small and often; undo via history
  (`git revert`), never `git reset --hard` on shared history. Push after a green `npm test`.
  Routine commits and pushes are pre-authorised; **releases, publishes and anything outward-facing
  need the owner's explicit words.**
- **A commit touching test files carries a justification block** — why the test changed and what it
  now guards. A test edit without one is treated as fraud by default. Also answer: could the old
  tests now pass for the *wrong* reason?
- **Never commit** the owner's media, real archive paths, or run journals. `/.kpot-runs/`, `*.log`,
  `*.tgz` and the sample directory are gitignored. Add the ignore line *before* creating any new
  artifact class.
- **Comment non-trivial code** and carry a test-status marker: `[NOT-TESTED]` at birth, flipped to
  `[TESTED: date · how it was observed]` only after an actual observation. A false `[TESTED]` is a
  documented fraud, not a formality.
- **Determinism is load-bearing**, not aesthetic: the dry run must emit byte-identical operations to
  the real run, the plan is diffed by the owner, the cache and dedupe groups are keyed on it. Sort
  every walk, give every tie a total-order break, keep clocks out of compared output.
- **Windows realities are first-class:** drive letters, UNC, `\\?\` long paths, case-insensitive but
  case-preserving filesystems, Cyrillic names, even a Cyrillic *extension*. Compare paths with the
  helper in `src/core/paths.mjs`, never `===`.

## 10. Where everything lives

| Read this | When |
|---|---|
| `STATUS.md` | **first, always** — the live state, the backlog, "where to continue next session" |
| `GOAL.md` | the owner's contract, in his words (Russian). Outranks every other document |
| `AGENT_GUIDE.md` | the working canon: checklist, architecture rules, harness, git policy, code style |
| `MASTER_PLAN.md` | the phases + the **decision log** (§5 above is only a summary of it) |
| `PHILOSOPHY.md` | how to think here. If you are stuck, read this before digging deeper |
| `BUG_FIXING_FRAMEWORK.md` | how defects are fixed (3 failed attempts → stop and research) |
| `TESTING_FRAMEWORK.md` | the 7 testing principles and the `[TESTED]` marker contract |
| `EXPERIENCE.md` | lessons, grep by tag before a task |
| `researches/01…04` | prior art · the real archive survey · the first real run · sidecars |
| `plans/` `bugs/` `ideas/` `interviews/` | the backlog. A `DONE` in the filename means closed |

**Framework note for whoever picks this up:** the repo is wrapped in KAIF 1.6 (skills under
`.claude/skills/`, mirrored to four other agent systems). **KAIF 2.0 was released on 2026-07-28** and
this project has not migrated — that is an owner decision, not a background chore. If your tooling
does not understand those skills, ignore them: everything you actually need is in the documents
above, and this file is the map to them.
