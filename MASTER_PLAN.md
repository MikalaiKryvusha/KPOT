# KPOT — MASTER PLAN

> The roadmap: how we get from the project's **current state** to the vision in `GOAL.md`. A high-level,
> stepwise decomposition — phases and milestones, not day-to-day tasks (those live in `plans/`). Derived
> from `GOAL.md` by the agent at deploy and refreshed with `/revision` as the goal or the state changes.
>
> This is a **living reference**, not a task — never DONE-tagged.

---

## Vision (one line)

Point KPOT at a chaotic pile of photos and videos and get back a chronological library — `<year>/<season>/` —
without ever risking a file the owner cannot get back.

## Guiding principles

Application of `PHILOSOPHY.md` to this project:

- **Safety outranks tidiness.** A wrong sort is annoying; a lost photo is unforgivable. Every phase that
  can write must be preceded by a plan, a dry run and a backup. If in doubt, do less and report more.
- **Explain, don't guess.** Every date and every destination carries the evidence behind it. Ambiguity
  is documented and shown to the owner — never resolved silently (`GOAL.md`, "спорные моменты").
- **Read-only by default.** One module writes; everything else observes. See the internal map.
- **Reuse before writing.** `GOAL.md` is explicit: if GitHub already solves a part well, use it; write
  our own `.mjs` only where nothing fits. This is why Phase 1 is research, not code.
- **Testable before featureful.** Fixtures with known-correct answers come before the code that consumes
  them. Nothing here needs a human to verify — so nothing here should require one.
- **Simplicity (KISS + Occam).** A pile of plain functions over a plain data model beats a framework.
  Near-zero dependencies; Node's own APIs first.

## From here to there — the phased path

### Phase 0 — Foundation ✅
- **Goal of the phase:** a repo an autonomous agent can work in.
- **Steps:** `GOAL.md` from the owner · KAIF 1.5 deployed · public MIT repo on GitHub · docs adapted
  (canon, maps, this plan) · `npm test` gate wired.
- **Status:** ✅ done 2026-07-24.

### Phase 1 — Prior art & the skeleton
- **Goal of the phase:** we know what we are *not* writing ourselves, and `kpot --help` runs.
- **Steps:**
  1. `researches/01_prior_art.md` — evaluate ExifTool / `exiftool-vendored`, `exifr`, `sharp`,
     Elodie, PhotoPrism, `photo-organizer`-class tools against our needs: date extraction breadth
     (JPEG/HEIC/RAW/MP4/MOV), duplicate detection, licence, install weight, Windows behaviour.
     Produce a recommendation, not a survey.
  2. `/interview` the owner on the outcome — vendoring a binary changes distribution and licensing.
  3. `tests/fixtures/make.mjs` — the fixture generator: synthetic trees with planted EXIF dates,
     planted duplicates, undatable files, unicode/long/reserved names, nested junk directories.
  4. `bin/kpot.mjs` skeleton — `parseArgs`, phase dispatch, `--help`, exit codes; `src/core/` path
     normalization + bounded-concurrency pool.
- **Acceptance:** `npm test` green with real specs; `node bin/kpot.mjs --help` prints the phases;
  a fixture tree can be generated reproducibly.
- **Status:** 🔲 todo — this is what the next session starts.

### Phase 2 — Scan & date resolution
- **Goal of the phase:** for any tree, KPOT can say what each file is and when it was captured — with
  its reasoning attached.
- **Steps:** media identification by content, not extension · content hashing (streamed) ·
  Evidence extraction (EXIF, filename patterns, sidecars, directory names, filesystem times) ·
  the DateVerdict resolver with an explicit precedence rule and confidence · the `scan` phase +
  its machine-readable output and human map.
- **Acceptance:** on the fixture tree every planted date is recovered, every planted-undatable file is
  reported as *unknown* (not guessed), and each verdict lists its evidence. Zero writes to the input.
- **Status:** 🔲 todo.

### Phase 3 — Duplicates & the sort plan
- **Goal of the phase:** the owner can read, before anything happens, exactly what would move where.
- **Steps:** duplicate grouping across directories + keeper selection · season mapping (five buckets,
  boundaries decided in interview #001) · per-year and global "прочее" buckets · `аудио/` (and possibly
  `видео/`) subdirs inside seasons · custom-parent-dir nesting preservation · junk quarantine with
  provenance · collision handling that preserves original names · the `plan` phase emitting the
  SortPlan, the disputed cases and the collisions.
- **Acceptance:** the pre-sort master plan on the fixture tree is complete, human-readable, and every
  planted ambiguity appears in the disputed section.
- **Status:** 🔲 todo. ~~Blocked~~ unblocked 2026-07-24 by interview #001.

### Phase 4 — Safety: backup, dry run, rollback
- **Goal of the phase:** the four guarantees `GOAL.md` demands exist and are proven.
- **Steps:** the Backup mechanism (decide: git-based commit vs. manifest+hardlink snapshot — a
  decision-log entry, taken with sizes in mind) · the RunJournal · `apply --dry-run` executing the same
  SortPlan through the same code path · `rollback <run-id>` · the refusal to write without a backup.
- **Acceptance:** dry-run and real-run journals are identical apart from execution flags; a full
  apply→rollback cycle on a fixture returns the tree byte-for-byte to its original state, verified by
  hashes; `apply` without a backup exits non-zero and touches nothing.
- **Status:** 🔲 todo. **This phase gates every real-data use of the tool.**

### Phase 5 — Apply, reports, and first real use
- **Goal of the phase:** the owner's chaos becomes a library he can browse by year.
- **Steps:** the `apply` executor (resumable, error-tolerant, one file's failure never aborts a run) ·
  the post-sort report with the rollback path · progress output for large trees · a first supervised
  run on a *copy* of a real directory · README + a tagged release via `/release`.
- **Acceptance:** a real messy directory (copy) is sorted, the report is understandable to a
  non-technical reader, and rollback demonstrably restores it.
- **Status:** 🔲 todo.

### Phase N — The goal is reached
Files are no longer scattered "как попало": the owner opens the library and walks his life by year and
season. The measure is his, not ours — `GOAL.md`, closing paragraph.

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-24 | KAIF 1.5 as the operating framework; sphere `programming`, working language `ru` for owner docs, English for agent docs | Owner works in Russian; models read English docs most reliably. Split declared in `AGENT_GUIDE.md` |
| 2026-07-24 | MIT licence, public repo `MikalaiKryvusha/KPOT` | Owner's call; `GOAL.md` states this is an open-source project |
| 2026-07-24 | Node ESM `.mjs`, no build step, near-zero dependencies, `node --test` as the harness | `GOAL.md` specifies `.mjs`; a build step buys nothing for a CLI and costs an agent step every loop |
| 2026-07-24 | Evidence/DateVerdict as first-class objects rather than resolving dates inline | The requirement to document disputed cases is unimplementable otherwise — see the internal map |
| 2026-07-24 | Single-writer architecture: only `src/apply/` may touch user files | Makes the safety invariants enforceable and testable in one place |
| 2026-07-24 | Research before code (Phase 1 is a study, not a feature) | `GOAL.md` requires reusing existing solutions where they fit; writing an EXIF parser first would be the most expensive possible mistake |
| 2026-07-24 | **Moves are filesystem renames, never copy+delete** (owner requirement, GOAL.md addendum of 2026-07-24) | Speed — the real archive is 551 GB and would not fit twice anyway. Same-volume: `fs.rename`. Cross-volume target: explicit copy→verify-hash→delete fallback, surfaced in the plan/report, never silent |
| 2026-07-24 | **Seasons: five buckets** — Зима начало года = Jan–Feb · Весна = Mar–May · Лето = Jun–Aug · Осень = Sep–Nov · Зима конец года = Dec · + `прочее` per year | Interview #001 Q2 = A. Autumn omission in `GOAL.md` was accidental — the owner's own archive has "осень" dirs. **Unblocks Phase 3 season mapping** |
| 2026-07-24 | **Metadata extraction: pure JS** — `exifreader` (npm, MPL-2.0) for images + our own ~150-line MP4/MOV box parser; ExifTool only as a possible future opt-in "deep mode" behind the same extractor interface, never a hard dependency | Interview #001 Q1 = A, based on `researches/01_prior_art.md`. Keeps Node ≥ 20, zero binaries, near-zero deps |
| 2026-07-24 | **Audio is media**, sorted like photos/videos but into its own `аудио/` subdir inside the season dir | Interview #001 Q3 = A + owner's clarification |
| 2026-07-24 | **Junk files → quarantine** `ПРОЧЕЕ/_мусор`, each with recorded provenance meta (original path, what it belonged to). KPOT still deletes nothing | Interview #001 Q4 = C |
| 2026-07-24 | **Other non-media files stay in place** + "left unsorted" report section; `.psd` counts as media | Interview #001 Q5 = A |
| 2026-07-24 | **Custom parent directories are preserved as nesting** inside the season dir (e.g. `2013/Лето/<владельческая папка>/…`) | Owner in chat, 2026-07-24; extends the `GOAL.md` name-preservation requirement |
| — | **OPEN:** separate `видео/` subdir inside the season dir (like аудио/)? | Owner leaned yes in chat ("возможно есть смысл"), явного подтверждения нет — pending one chat question |
| — | **OPEN:** backup mechanism — git commit vs. manifest + hardlink snapshot | Git is simple and truly restorable but poor with tens of GB of binaries; decide with real sizes in Phase 4 |

---

> **Maintenance:** keep this in sync with reality. When `GOAL.md` or the project's state shifts materially,
> run `/revision` to re-derive the phases. The per-step detail plans that implement each phase live in
> `plans/`.
