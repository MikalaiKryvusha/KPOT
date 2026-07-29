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
- **Status:** ✅ done 2026-07-24 (two sessions). `researches/01_prior_art.md` (→ reuse `exifreader` +
  `node:crypto`, write our own MP4 parser and all product logic) and `researches/02_real_archive_survey.md`
  (71 606 files / 551 GB, observed read-only) · **interview #001 answered** — all five forks closed ·
  `tests/fixtures/make.mjs` with `expected.json` ground truth · `bin/kpot.mjs` skeleton with the
  exit-code contract · `src/core/` primitives · the `src/meta/` Evidence model. All three acceptance
  criteria met.

### Phase 2 — Scan & date resolution
- **Goal of the phase:** for any tree, KPOT can say what each file is and when it was captured — with
  its reasoning attached.
- **Steps:** media identification by content, not extension · content hashing (streamed) ·
  Evidence extraction (EXIF, filename patterns, sidecars, directory names, filesystem times) ·
  the DateVerdict resolver with an explicit precedence rule and confidence · the `scan` phase +
  its machine-readable output and human map.
- **Acceptance:** on the fixture tree every planted date is recovered, every planted-undatable file is
  reported as *unknown* (not guessed), and each verdict lists its evidence. Zero writes to the input.
- **Status:** ✅ done 2026-07-24 (acceptance spec green: `tests/meta_phase2.test.mjs`).
  **Fully closed 2026-07-28:** the one deferred cut — THM/XMP **sidecar** evidence — is implemented
  (`src/meta/sidecar.mjs`, fixture v4, `tests/meta_sidecar.test.mjs`). It was worth waiting for a
  fixture: `researches/04_sidecars.md` read the real files first and found that 25 of the archive's
  34 THMs sit beside an **AVI**, which carries no container date at all — so those 25 videos had
  only a folder year. They are now dated to the second (measured: 25/25, winner `sidecar`).

### Phase 3 — Duplicates & the sort plan
- **Goal of the phase:** the owner can read, before anything happens, exactly what would move where.
- **Steps:** duplicate grouping across directories + keeper selection · season mapping (five buckets,
  boundaries decided in interview #001) · per-year and global "прочее" buckets · `аудио/` (and possibly
  `видео/`) subdirs inside seasons · custom-parent-dir nesting preservation · junk quarantine with
  provenance · collision handling that preserves original names · the `plan` phase emitting the
  SortPlan, the disputed cases and the collisions.
- **Acceptance:** the pre-sort master plan on the fixture tree is complete, human-readable, and every
  planted ambiguity appears in the disputed section.
- **Status:** ✅ done 2026-07-26 — acceptance is a green spec (`tests/plan_phase3.test.mjs`): all 23
  planted destinations assert row-by-row against the fixture ground truth, and both planted
  ambiguities (broken-clock EXIF, assumed cohort year) appear in the disputed section. `kpot plan`
  runs (exit 3 → 0) with a Russian owner-facing report and `--json` for the SortPlan artifact.
  Modules: `src/dedupe/dedupe.mjs`, `src/plan/bucket.mjs`, `src/plan/plan.mjs`. Read-only proven by
  hash comparison before/after. The last two layout forks were closed by the owner on 2026-07-26
  (duplicates, custom dirs — see the decision log).

### Phase 4 — Safety: backup, dry run, rollback
- **Goal of the phase:** the four guarantees `GOAL.md` demands exist and are proven.
- **Steps:** the Backup mechanism (**decided 2026-07-26 — manifest + hardlink snapshot**, interview
  #002; see the decision log) · the RunJournal · `apply --dry-run` executing the same SortPlan through
  the same code path · `rollback <run-id>` · the refusal to write without a backup.
- **Acceptance:** dry-run and real-run journals are identical apart from execution flags; a full
  apply→rollback cycle on a fixture returns the tree byte-for-byte to its original state, verified by
  hashes; `apply` without a backup exits non-zero and touches nothing.
- **Status:** ✅ done 2026-07-26 — all three criteria are green specs in `tests/apply_phase4.test.mjs`
  (the journals are compared record for record and differ in exactly one header flag; the cycle is
  checked by a sha256 census of every file before and after; a run that cannot back up throws having
  touched nothing). Modules: `src/apply/backup.mjs` (manifest + hardlink snapshot),
  `src/apply/apply.mjs` (the single writer), `src/apply/rollback.mjs`. `kpot apply [--dry-run]` and
  `kpot rollback <run-id> [dir]` are live. Every guard was verified by breaking it first.
  **The tool may now write — but only ever after a backup it verified.**

### Phase 5 — Apply, reports, and first real use
- **Goal of the phase:** the owner's chaos becomes a library he can browse by year.
- **Steps:** the `apply` executor (resumable, error-tolerant, one file's failure never aborts a run) ·
  the post-sort report with the rollback path · progress output for large trees · a first supervised
  run on a *copy* of a real directory · README + a tagged release via `/release`.
- **Acceptance:** a real messy directory (copy) is sorted, the report is understandable to a
  non-technical reader, and rollback demonstrably restores it.
- **Status:** ✅ done 2026-07-28, released `v0.1` «First KPOT». The acceptance was met by a supervised
  run on `KPOT_SANDBOX` — a fresh copy of four real folders the owner authorised, **813 files moved,
  0 failures, the SHA-256 multiset identical before and after**, and a rehearsed rollback (813 files
  + 5 folders restorable). Also landed in this phase: the scan cache · idempotent sorting (bug 01) ·
  reversible empty-folder cleanup · the `НА_РАЗБОР/` approval quarantine · live progress ·
  resumability · `plans/02` steps 1 and 2 (editor exports dated honestly; the original found by its
  pixels) · THM/XMP sidecar evidence · the reset-camera-clock rule · the bilingual README and the
  tagged release.

### Phase 6 — The interface: KPOT for a person who does not open a terminal
- **Goal of the phase:** the product stops requiring a command line. A local web interface, a
  portable package, and plain human language everywhere the tool speaks.
- **Why it is a phase and not a polish pass:** today KPOT is the right product with the wrong door —
  built for a non-technical owner of a chaotic archive, usable only by typing
  `node bin/kpot.mjs plan <dir>`. The owner made the audience explicit («и я и обычные не опытные
  пользователи ПК»), which turns the interface, the delivery and the wording into product
  requirements rather than decoration.
- **Design, fully settled by the owner** (interview #003, all ten answers, 2026-07-29): a **wizard**
  for the first flight that gives way to a **control panel** afterwards · **no thumbnails**, folder
  links instead · **server and «морда» separated**, closing the browser does not stop a run ·
  **portable ZIP**, no installer and no certificate · one deliberate confirmation with the numbers ·
  folder decisions answered in the UI · **bilingual RU/EN** · this computer only.
- **The cut into sub-phases** (full document with per-phase acceptance criteria:
  **`plans/03_interface_epic.md`**):
  1. **6.0 — the shared layer.** The phase composition currently lives as private functions inside
     `bin/kpot.mjs`, entangled with printing and exit codes; a server cannot call them. Extract it so
     the product has ONE executor and two callers, guarded by byte-exact goldens of today's reports.
  2. **6.1 — the server.** `node:http` on `127.0.0.1`: start-up token, `Host` whitelist, default port
     with a random fallback, the browser opened only after `listening`, a single instance, an explicit
     «Завершить работу», and progress over `text/event-stream`.
  3. **6.2 — the first-flight wizard.** Four steps, the four `GOAL.md` guarantees visible, one
     confirmation with the numbers, and the RU/EN string dictionary starting at the first string.
  4. **6.3 — the control panel.** Three re-launchable runs, folder decisions answered in the UI over
     the existing `src/core/decisions.mjs`, «Открыть» links into Explorer, run history with a rollback
     per row.
  5. **6.4 — the `НОВОЕ` top-up** (idea 01): an inbox inside the library root, deduplicated against
     what is already there, with emptied inbox folders removed by the mechanism already approved for
     emptied folders.
  6. **6.5 — the portable package:** Node's own signed binary (measured: 87.4 MB → **32.7 MB zipped**)
     plus our `.mjs`, so no unsigned executable is ever introduced; the first run offers a desktop
     shortcut.
  7. **6.6 — the closing language pass**, which also clears the standing debt: the plan report still
     prints `dated 2012-06-15 (exif-original)` at the owner.
- **Acceptance:** a person who has never opened a terminal downloads the archive, unzips it,
  double-clicks, and reaches a sorted library — without a command line and without meeting a word they
  do not understand; the run survives a closed browser tab; `npm test` green; RULE 1 intact (only
  `src/apply/` writes, with the server as one more caller above it).
- **Two recon gates that must NOT be skipped** (canon step 9b): the Mark-of-the-Web on a REAL browser
  download, before 6.5 may be promised; and opening a folder in Explorer from the local server, whose
  path must be proven to lie inside the library root, before 6.3.
- **Status:** 🔧 **under way — 6.0, 6.1 and 6.2 are DONE** (2026-07-29, one session, owner's «Делаем!»).
  - ✅ **6.0** — `src/app/phases.mjs`: the pipeline is callable, prints nothing, and the CLI output is
    byte-identical to before (proven by a golden capture of 13 scenarios against the old code).
  - ✅ **6.1** — `src/ui/server.mjs`: token · `Host` whitelist · port fallback · browser only after
    `listening` · one instance · «Завершить работу» · progress over SSE. Live-smoked: `kpot ui`
    started on 5768, a second launch reused it, the shutdown left the port closed.
  - ✅ **6.2** — the first-flight wizard: four steps, the four `GOAL.md` guarantees always visible,
    a folder chooser (a browser cannot open a real folder dialog, so the server lists folders), one
    deliberate confirmation enforced ON THE SERVER, and every word from an RU/EN dictionary.
  - ✅ **6.3 — DONE 2026-07-29:** the recon (`researches/08`), the guarded folder reveal, the
    wizard-vs-panel decision, the panel screen, the read-only history — and, last, the **undo
    button** (`plans/07_DONE`): it may only name a run this library owns (checked by its REAL path),
    only one the history already called undoable, only with a deliberate confirmation naming the run
    and the numbers, and only when nothing else is running. Every refusal is asserted by a sha256
    census showing **nothing moved**, and the success by the census before the sort equalling the
    census after the undo.
  - ✅ **6.4 — DONE 2026-07-29** (`plans/08_DONE`): the `НОВОЕ` top-up, built by removing four
    misbehaviours rather than by adding a pipeline — the inbox became STRUCTURE (so files land in
    `<год>/<сезон>/` and the mailbox is not rebuilt inside every season), it is never listed for
    deletion though its emptied subfolders still are, a shelved copy now outranks an inbox copy as
    keeper, and it can no longer be proposed for `НА_РАЗБОР/`. The panel gained the inbox block
    (what is waiting · «Открыть» · the same sort behind the same confirmation · an offer to create
    the folder). Measuring first also caught `bugs/05_DONE` — the plan announced FULL folders as
    about to be deleted, which made the rehearsal disagree with the real run (48 vs 1), i.e.
    `GOAL.md` §в. Both fixed; six guards break-verified.
  - ✅ **6.5 — DONE 2026-07-29** (`plans/09`): the portable package. `npm run package` builds a
    **33.2 MB** ZIP carrying Node's own signed binary plus our `.mjs`, verifying the vendored
    archive's SHA-256 against nodejs.org and reading the Authenticode signature on the file that is
    actually shipping; `npm run package:verify` unzips it into a clean folder and proves the product
    runs **on its own bundled runtime**. Plus the offered desktop shortcut. Its recon
    (`researches/09`) discharged the gate by **refuting** the epic: the mark cannot be promised
    absent on any machine, and this development machine — with both defences disabled by policy —
    cannot validate the first launch at all. The clean-machine acceptance is the owner's, deferred
    by him to a friend's PC.
  - ✅ **6.6 — DONE 2026-07-29:** the closing language pass, done by READING every owner-facing
    surface rather than by grepping. The reports turned out never to have had one: «ОТЧЁТ О СУХОМ
    ПРОГОНЕ», a «БЭКАП» heading, «Манифест», «жёстких ссылок», a printed `sha256`, `XMP DocumentID`
    in a Russian sentence, and «1 групп»/«1 папок» in the first ten lines of the master plan. Fixed
    at the root (`src/core/words.mjs` — the three-form plural rule and the date-in-words helper),
    and guarded structurally: `tests/reports_language.test.mjs` scans the RENDERED reports, which
    the existing jargon spec never did — it only ever read `src/ui/i18n.mjs`.
  **The interface epic is complete.** Suite 192 → **286**. Plans: `04_DONE`, `05_DONE`, `06`,
  `07_DONE`, `08_DONE`, `09`. One defect found while looking and deliberately left for its own
  fix: `bugs/06` — a folder containing any `2013/` is taken for a finished library, which skips the
  wizard on precisely the archives it was built for.

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
| 2026-07-24 | **Metadata extraction: pure JS** — `exifreader` (npm, MPL-2.0) for images + our own ~150-line MP4/MOV box parser; ExifTool only as a possible future opt-in "deep mode" behind the same extractor interface, never a hard dependency. *Installed 2026-07-24: `exifreader ^4.41.3` — the project's single runtime dependency (`src/meta/exif.mjs`); the box parser is `src/meta/mp4.mjs`* | Interview #001 Q1 = A, based on `researches/01_prior_art.md`. Keeps Node ≥ 20, zero binaries, near-zero deps |
| 2026-07-24 | **Audio is media**, sorted like photos/videos but into its own `аудио/` subdir inside the season dir | Interview #001 Q3 = A + owner's clarification |
| 2026-07-24 | **Junk files → quarantine** `ПРОЧЕЕ/_мусор`, each with recorded provenance meta (original path, what it belonged to). KPOT still deletes nothing | Interview #001 Q4 = C |
| 2026-07-24 | **Other non-media files stay in place** + "left unsorted" report section; `.psd` counts as media | Interview #001 Q5 = A |
| 2026-07-24 | **Custom parent directories are preserved as nesting** inside the season dir (e.g. `2013/Лето/<владельческая папка>/…`) | Owner in chat, 2026-07-24; extends the `GOAL.md` name-preservation requirement |
| 2026-07-24 | **Video gets its own `видео/` subdir inside the season dir** (symmetric with `аудио/`; photos stay at the season root) | Owner confirmed in chat: «лучше ролики тоже в отдельную видео/» |
| 2026-07-24 | **Wall-clock sources outrank UTC instants at the same trust tier** (filename timestamp > mvhd; EXIF stays on top) — and **fs-mtime never determines a date**, it only corroborates | The library buckets by LOCAL season; a UTC instant with unknown timezone can mis-shelve midnight/New-Year shots. mtime: the survey's 18 656-file bulk-copy spike proves it lies; defaulting to it would fabricate chronology |
| 2026-07-24 | **Dir-cohort evidence approved; file-size dating rejected** — an undatable file among ≥3 confidently-dated same-year neighbors (≥80% consensus) gets that year as a flagged, low-confidence ASSUMPTION → `<год>/прочее`, always surfaced to the owner in the plan; file size is never used for dating | Owner in chat 2026-07-24: «вес не нужно, давай по соседям сделаем признак». Device-dump dirs make the inference realistic; size is too noisy and would fabricate precision |
| 2026-07-26 | **Duplicates: the keeper goes to the library, every other copy → `ПРОЧЕЕ/_дубликаты/`** with its original directory flattened into the name (`копии__DSC02000.JPG`) as provenance | Owner's answer, 2026-07-26. `GOAL.md` only requires *finding* duplicates; the layout was undecided. One shot = one file in the chronological tree; nothing deleted, everything traceable and rollbackable. Keeper choice is a documented total order (`src/dedupe/dedupe.mjs`), so the same archive always yields the same keeper |
| 2026-07-26 | **Custom parent dirs: preserve ALL of them as nesting, EXCEPT technical ones** — device dumps (`100MEDIA`-style, DCF `\d{3}[A-Z]+`), `DCIM`/`Camera`/`Screenshots`/messenger dirs, pure year/season dirs, and generic content words that would collide with our own `видео/`+`аудио/` subdirs | Owner's answer, 2026-07-26 («всё, кроме технических»). The technical list is sourced from `researches/02` §Directory structure, not invented. Layout: `<год>/<сезон>/[видео\|аудио]/<кастомные папки>/<имя>` — which makes the owner's own example `2013/Лето/<папка>/…` literally true for photos |
| 2026-07-26 | **A bare «зима» directory never picks a winter bucket** — such a file goes to `<год>/прочее` and is reported as a disputed case | A year has two winter buckets (Jan–Feb and Dec) and the owner's dir name cannot say which. Guessing would silently misplace files; `GOAL.md` requires documenting the ambiguity instead |
| 2026-07-26 | **A UTC-instant date (mvhd) is bucketed by its UTC components, not the machine's local zone** — and a file within 12 h of a season boundary is flagged disputed | Determinism outranks a guess: local-zone conversion would sort the same archive differently on two computers. The residual boundary risk is surfaced rather than hidden |
| 2026-07-26 | KAIF updated 1.5 → 1.6 «Homeostatic KAIF» | Framework guardrails (recon artifacts, one-step commits, judge before push, provenance marks). Migration record: `KAIF_FRAMEWORK.md`; findings for the framework's author: `plans/01_kaif_16_update_report.md` |
| 2026-07-26 | **Backup = manifest + hardlink snapshot** (interview #002, owner's answer Б). Two layers, both mandatory before `apply` writes: (1) a **manifest** in `.kpot-runs/<run-id>/` — original path, size, mtime, sha256 and planned destination per file (~18 MB for the real archive); rollback renames back by it and verifies sha256. (2) a **hardlink snapshot** — a shadow tree where every file is a hardlink to the same data, so content survives even if the original directory entry is deleted by anything. Where the filesystem cannot hardlink (exFAT/FAT32, cross-volume), `apply` STOPS and demands the owner's explicit flag rather than silently running on the manifest alone | The decision was taken with measured numbers, not estimates: the archive is 551 GB on a volume with **197.8 GB free**, so a git backup (`.git` ≈ 551 GB — JPEG/MP4 do not compress) **does not physically fit**; git on Windows would also choke on the long/Cyrillic/reserved names the survey found. The hardlink layer is near-free — a probe measured **0.401 ms/link → ~29 s and ~0 bytes for all 71 606 files** — and hardlinks provably survive a rename of the original (same inode, `nlink=2`). Because moves are renames (2026-07-24 row), a backup never needs to copy data at all: the manifest restores the structure, the snapshot protects the content. Honest limit, recorded rather than hidden: a snapshot on the same physical disk does not survive disk failure — a full copy to another drive stays the owner's own call, not a precondition of the tool |
| 2026-07-26 | **KPOT may DELETE the folders its own sort emptied** — the first and only deletion it performs. Owner's words: «пустые папки после сортировки можно удалять, главное, чтобы пути, и названия были записаны в коммит-бекап план, чтобы бекапер мог откатить всё, как было, и создать папки». Implemented with the condition as the mechanism: the backup manifest now records every DIRECTORY as well as every file, the plan lists the folders that will disappear *before* the run, the journal records each removal, and rollback recreates them shallowest-first before restoring files | A folder holds no bytes, so nothing but the manifest line remembers it existed — without that record the deletion would be irreversible, which is the one thing this product may not be. Two safeguards beyond the owner's condition, added by the agent: emptiness is re-checked against the filesystem at the moment of deletion (a stale plan is not permission), and only folders THIS run emptied are eligible — one that was already empty was never ours to remove. **This amends internal-map invariant 5** ("Nothing is destroyed"), which now reads: nothing the owner *put* there is destroyed |
| 2026-07-26 | **Ambiguously-named directories are flagged and held for the owner's approval, not sorted** (owner: «нужно подозрительные папки помечать, и выносить в инструменте на согласование владельца — сортировать их, или вносить в том виде, в каком они есть»). Criterion chosen by the owner: **an unclear NAME** — neither plainly technical nor plainly meaningful (`скриншоты`, `Разное`, `New folder`). "Leave as-is" means the folder **stays exactly where it is**, untouched. The decision is expressed in a plain editable **decisions file** written next to the plan, and until a folder is decided its files are not moved | The owner rejected the wider criteria (multi-year folders, mostly-undatable folders, every human-named folder): on a ~60-top-level-directory archive those would turn the approval list into noise. The name-based criterion also settles the open question about Russian device-folder names (`скриншоты`, `камера`) — they are neither silently dropped as technical nor silently preserved, but put on the owner's table. Default is "do not touch": an approval that proceeds without the answer is not an approval |
| 2026-07-26 | **REVISION of the row above (same day, owner's second thought): a folder under question is not left in place — it is moved WHOLE into a top-level `НА_РАЗБОР/`, keeping its ORIGINAL parent structure inside** (`Фото/архив/Разное/` → `НА_РАЗБОР/Фото/архив/Разное/`). «Как есть» then means it simply stays there, permanently. Owner's words: «давай в отдельной папке сделаем [склад] папок под вопросом, требующих решения владельца, и чтобы они в этом своём отдельном "карантине" лежали с сохранением своей исходной родительской структуры папок»; folder name and placement are the owner's too | Everything needing a decision ends up in one browsable place instead of scattered across a 60-directory archive — the owner reviews a pile, not a treasure hunt. The preserved parent structure is what makes it safe rather than merely tidy: stripping that one prefix recovers the original path exactly, so (a) an approved folder is sorted as if it had never moved and `НА_РАЗБОР` never leaks into the library, (b) the decisions file keys on the original path and answers survive the move, and (c) a folder already in quarantine plans a move onto itself, which the `from !== to` filter drops — the flow is idempotent by construction. Undecided and «как есть» share one destination, which is why there is no second code path to drift |
| 2026-07-26 | **REFINEMENT after the first real run — the owner is asked about a folder only when BOTH hold: (a) sorting would actually SCATTER it across more than one `<год>/<сезон>`, and (b) its name is a meaningful word or phrase.** A careless name is sorted silently. Owner's words: «11 — это неосмысленное название, название на отъебись, можно было бы и сортировать без разбора владельца. Осознанные названия — обычно это слова, фразы»; and, on the first condition, «только если разорвёт». Also removed: the "looks like a technical identifier" rule, which had flagged `Ukraine_Fall_2020` and `Summer_2024_Belarus_Part_1` — «это конечно же осмысленные папки» | The first real run asked about 25 folders. Two things were wrong with that. **(a)** Custom folders are preserved as nesting, so a folder whose files all land in one bucket *arrives intact* — its name and grouping survive sorting untouched. Measured: **15 of the 25 would have arrived intact**, i.e. 15 questions protecting nothing. **(b)** A folder named `11` has no grouping to protect at all, and asking about it made the tool look as though it could not read a date it had in fact read perfectly (`IMG_20140204_145504`, high confidence). Result on the owner's real sample: **25 folders → 5**, every one a genuine question (three placeholder-named folders and two `скриншоты`), and the file that prompted this now sorts normally into `2014/Зима начало года/…/11/` with its folder preserved |
| 2026-07-26 | **A desktop GUI is accepted as product direction but scheduled AFTER Phase 5** (owner's idea + answer, `ideas/02_electron_gui.md`) | The GUI is a second renderer over the SortPlan the core already emits, so it costs little — but it is a shell over `apply`, and `apply` does not exist yet. Building the face first would have to be rebuilt once the executor lands. Cheap discipline meanwhile: every phase keeps a `--json` artifact, so the core stays GUI-ready by construction |
| 2026-07-28 | **Before an EPIC feature the agent must web-search the field and write a prior-art review into `researches/` — designing before it exists is a violation.** Owner's instruction, verbatim: «вообще, почти на всё в индустрии есть золотые стандарты и научные работы. давай зафиксируем в канон ИИ агента, что перед крупными эпик-фичами, нучно проводить гуглёж разветку и написание research документа». Mechanized as checklist step 9a in `AGENT_GUIDE.md` + the prior-art artifact spec (threshold for "epic", minimum content incl. **the failure modes others documented**, and an anti-fraud clause: an unsourceable claim is written as an open question, never as a fact). [AI] The "epic" threshold and the document template are the agent's proposal under the owner's instruction — the honest detector among them being "you cannot state in one plain sentence how it works" [/AI] | The canon already carried the *thinking* principle (`PHILOSOPHY.md` → Best practices) and the *observation* gate for a specific external truth (the recon doc), but nothing forced the step of asking what the industry and the literature already settled — and a principle in a list never fires, only a gate does. The project has done it well exactly once, ad hoc (`researches/01_prior_art.md`, which is what stopped KPOT writing its own EXIF parser and deferred perceptual hashing on measured grounds); this promotes that one-off to canon. Deliberately merged INTO step 9 rather than renumbered in: six documents including five generated skill copies cite "step 9" for the recon rule, and churning them would have been change for nothing |
| 2026-07-28 | **A `.thm` thumbnail is camera litter: quarantined, not filed in the library.** Owner's answer, 2026-07-28 — «В мусорный карантин», chosen over "follow its video" and "leave as today". So `.thm` joins `Thumbs.db` and friends in `src/scan/identify.mjs`: kind `junk` → `ПРОЧЕЕ/_мусор` with provenance, deleted never. It keeps donating its capture date to its video twin, because `src/meta/sidecar.mjs` pairs over the whole asset list regardless of kind | A THM is a valid JPEG, so identification-by-content called all 34 of them photographs and filed 160×120 thumbnails among real pictures — three byte-identical ones even formed a duplicate group. The two halves of the decision were verified together on real data: the 34 thumbnails now carry no verdict at all, and the 25 videos they describe are still dated to the second by them (winner `sidecar`, 0 errors). Guard: a spec asserts both halves, and goes red when the quarantine is removed |
| 2026-07-28 | [AI] **A sidecar (THM/XMP) dates its twin, but only from an unambiguous CAPTURE property.** A `.thm` donates its `DateTimeOriginal` and nothing else — a thumbnail's `DateTime` is when the camera wrote the thumbnail, i.e. a save time. An `.xmp` donates `exif:DateTimeOriginal` or `photoshop:DateCreated` only; `xmp:CreateDate`/`ModifyDate`/`MetadataDate` are **not read at all**. Pairing is by stem (`VID.THM`↔`VID.AVI`) or by full name (`photo.jpg.xmp`↔`photo.jpg`), case-insensitively, within one directory; an orphan sidecar dates nobody and a stem matching two media files dates nobody [/AI] | This is plans/02 §1.1 applied one layer out: a sidecar gives no way to tell a capture date someone copied into it from the moment an editor pressed save, and the 2026-07-27 row already settled that a save date is a ceiling, never a verdict. The rank was left where Phase 2 put it (below every real capture source) and `researches/04` §4 confirms that is right: the sidecar's job is to fill a gap, not to compete — measured on the real archive, it dates 25 videos that had only a folder year and contradicts nothing that was already known |
| 2026-07-29 | **The program is a SERVER plus a «морда» (the web UI), and closing the face does not stop the server** (owner's Q6, in his own framing: «у приложения есть бекенд-сервер, и WEB UI "Морда". Закрытие Морды не влияет на сервер - он работает»). Interview #003 also closed: folders awaiting a decision are answered **in the UI** (the text file stays as a fallback) · the interface is **bilingual RU/EN with a switch**, Russian by default · the window is named **«Krinik Photo Organizer Tool (KPOT)»** · **no access from other devices** — this computer only | The agent had recommended the opposite on Q6, and the owner is right on the merits: sorting 71 606 files takes minutes and must not die because someone closed a tab. Three obligations follow and belong in the epic plan, not in someone's memory: (1) an explicit, plainly-worded **«Завершить работу»** control, because the window no longer switches the program off and «I closed it and it is still running» is the documented complaint about this class of tool (`researches/07` §5.4); (2) launching the shortcut again must **find the running server and open the face on it**, never start a second one, or the first double-click produces a port conflict (§5.2); (3) the server stays the only writer — the face writes nothing, so internal-map RULE 1 holds with the UI as one more caller above `src/apply/`. On the bilingual answer: every UI string goes into a dictionary from the first line of code — cheap as discipline now, expensive as a retrofit later |
| 2026-07-29 | **Delivery is a PORTABLE package, not an installer — and that removes the code-signing question instead of deferring it.** Owner: «проще портабл. Скачал - распаковал - готово», «портабл - нет этой проблемы». The package carries Node's own binary plus our `.mjs` sources; the first run offers to put a shortcut on the desktop. No installer, no admin rights, no certificate. Also decided: **one deliberate confirmation with the numbers** before the sort (his Q4 = A) — never a type-the-word gate | Measured on the machine, 2026-07-29, rather than assumed: the official `node.exe` is **Authenticode-signed by OpenJS Foundation (Valid)**, 87.4 MB on disk, **32.7 MB zipped**. So a portable package that ships that signed binary introduces **no unsigned executable at all**, and SmartScreen's unknown-publisher prompt — the worst first-run experience `researches/07` §5.5 documents — has nothing to fire on. The single-exe (SEA) route would have re-created exactly that problem, since injecting our code invalidates the binary's signature. Download size drops from the installer's 50–80 MB to 33 MB. Residual, recorded and NOT yet verified: files extracted from a downloaded ZIP inherit the Mark-of-the-Web and Windows' Attachment Manager may warn once on a `.cmd` launcher — a locally-created shortcut carries no such mark, which is why the first run offers to make one. On Q4: KPOT's sort is reversible (backup + journal + rollback), and the practitioner literature is explicit that friction should scale with irreversibility — a type-the-word gate would train the owner to click through the one dialog that matters |
| 2026-07-29 | **The interface is TWO screens, not one: a WIZARD for the first flight, then a CONTROL PANEL.** Owner, 2026-07-29: «мне нравится мастер v1, и чтобы потом оно переходило в приборную панель, типа v2 и v5… Она - как дашборд, пульт управления, контрольный центр». The wizard leads a person step by step while the library does not exist yet; once it is built, the wizard steps aside for a dashboard that can **re-launch any of the three runs** (scan · plan · sort), shows what needs a decision, offers the top-up of new files from `НОВОЕ`, and lists past runs with a rollback on each. **And no thumbnails** (his Q5 answer): «миниатюры не нужны - это сложно. Если нужно отправить человека на просмотр - ссылки на папки» — wherever an eye is needed, the UI links to the folder and Windows shows the pictures | A wizard is right exactly once. After that it becomes an interrogation: the same four questions before every routine top-up, which is precisely the flow idea 01 exists to make cheap. Splitting the two lets each be honest — maximum hand-holding on the one run that matters most, and a control surface afterwards. The thumbnail refusal is the single biggest cost cut in this epic: decoding tens of thousands of photographs was the most expensive and most performance-risky part of the design (`researches/07` §6), and delegating it to the file manager removes it entirely while giving the user a tool they already know. Mock-ups of both screens, clickable: `interviews/interview_003_designs.html` |
| 2026-07-29 | **`НОВОЕ` is STRUCTURE, not a folder the owner named — and it is the one folder the sort may empty but never delete.** Phase 6.4 (`plans/08_DONE`). The inbox joins KPOT's own layout directories, so a file filed out of it lands in `<год>/<сезон>/<имя>` and the mailbox is not rebuilt inside every season it ever fed; the owner's OWN subfolders inside it (`НОВОЕ/с телефона/`) still survive as nesting, because those are names he chose. Two consequences ride along: the inbox can no longer be proposed for the `НА_РАЗБОР/` quarantine (`findSuspiciousDirs` skips structural segments), and a copy still sitting in the inbox now loses the keeper contest to the copy already shelved in the library. The constant lives in `src/core/paths.mjs` beside `RUNS_DIR_NAME`, because `src/plan/` and `src/dedupe/` are siblings and RULE 2 forbids one reaching into the other. **The inbox is deliberately NOT excluded from the scan** — `ideas/01`'s implementation column had guessed it would be, but files there are exactly the ones that must reach the plan | Measured before the rule existed, not reasoned: three files dropped into `НОВОЕ/` were planned into `2014/Зима начало года/НОВОЕ/…`, `2018/Весна/НОВОЕ/…` and `2020/Лето/НОВОЕ/…`, and the plan listed **`НОВОЕ` itself** among the folders to delete — so the owner's mailbox would have vanished after the very first top-up. A transit folder names a MOMENT («this arrived recently»), which stops being true the second the file is shelved; a season folder that says «недавнее» about a 2014 photograph is simply false. The keeper change is a FIX rather than a tie-break, and `plans/08` §3a records why the plan itself first concluded otherwise: it measured an undated duplicate, where a shelved file wins on the date criterion because its folder names carry evidence an inbox file has none of. With a dated duplicate the date criteria tie and DEPTH decides — `НОВОЕ/x.jpg` is shallower than `2008/Зима конец года/семейный архив/x.jpg` — so the freshly-dropped copy was taking the library's place and evicting the settled photograph into `ПРОЧЕЕ/_дубликаты/` |
| 2026-07-28 | **A reset camera clock is not a date — but only when the collection PROVES the clock was reset.** Owner's answer, verbatim: «сброшенным часам камеры не доверять, если это факт, что они сброшены». Mechanised exactly as he phrased it: a claim of 1 January in the first hour after midnight is refused only when its year is below the archive's own floor — the earliest year that actually holds photographs. Refused claims go to `disputed` with the reason `reset-camera-clock`, and the file falls back to whatever other evidence it has | The shape alone proves nothing: a New Year photograph taken at 00:25 on 1 January looks identical, and the owner's archive contains **13** of them (2014-01-01 00:01, 2015-01-01 00:21…) — refusing by shape would have thrown away real dates. Two details are measured, not assumed. **(a)** The floor counts POPULATION, not the minimum: over the whole archive (61 723 images, 47 247 dated) the earliest claim is the year 2000 held by four files — two of which ARE the broken-clock file this rule exists to catch, so a minimum-based floor would have been set by the defect and would then have cleared it. Counting years that hold real photography gives 2005 (1 526 files), and the false `2000-01-01 00:25` is refused. **(b)** The rule reads only claims that are an actual DEVICE CLOCK reading. A year-only source (a folder named `2009`, a bare year, a cohort) is stored internally as 1 January 00:00 — the reset shape exactly — and the first version of this rule refused those too, which threw away good verdicts and broke idempotence (the file moved on every run). The idempotence spec caught it, not review |
| 2026-07-28 | **plans/02 §Шаг 2 shipped — an edited photo's original is found BY ITS PIXELS, and a date is inherited only on a decisive MARGIN, never on a threshold.** Authorised by the owner («Да, ищи оригинал по пикселям», reversing his earlier «пиксели не надо» for this step only). Consequences worth recording: (1) the project's **second runtime dependency** — `jpeg-js` (**BSD-3-Clause**, pure JS, zero deps, no native build); (2) a new evidence kind `pixel-original`, ranked just under `derived-original` — it is a real shutter moment, only read from another file; (3) the plan gains an owner-facing section «ДАТЫ, ВЗЯТЫЕ У ИСХОДНОГО СНИМКА» naming the source file and how it was found, in plain words rather than evidence jargon; (4) `--no-pixels` turns the whole stage off — it is the only step that decodes images | The design is `researches/05` §7 (candidate-set first, decide by margin), corrected twice by our own measurement in `researches/06`: **an absolute threshold cannot work** — with the true original deliberately removed, a stranger scored better than the median true pair — and **a coarse hash cannot tell a crop from a look-alike**, which is why the shipped algorithm ranks coarsely and then verifies the finalists at 4× the resolution. Measured end to end on four real folders, 160 trials: with the original present, **62 of 80 accepted and all 62 with the right day**; with the original absent, **2 of 80 fabricated**, both of them the same pair of photographs of one scene taken six months apart — a limit no pixel method can remove, recorded rather than hidden. The census behind one more correction: 166 of the owner's 201 broken-class files sit in a folder with **no dated photograph at all**, so the search walks outward to the parent and grandparent instead of trusting the same-folder assumption `researches/05` inherited from a single example |
| 2026-07-28 | **Idea 01 (inbox + top-up) — three forks closed by the owner:** the inbox lives **inside the library root** and its default name is **`НОВОЕ`**; a processed inbox folder **is deleted once it is empty and done**. The fourth fork ("how far does one click go without a confirmation") **dissolved**: by the same day's UI decision the desktop shortcut launches the Web UI, so the confirmation is a button in the window, not a property of the shortcut | Owner in chat, 2026-07-28, verbatim: «2) внутри корня библиотеки · 3) удалять, если пусты и разобраны · 4) НОВОЕ», and «не понимаю вопрос про ярлычёк» — which is itself the answer: with a UI there is no invisible automatic run to bound. Deleting an emptied inbox folder needs no new mechanism and no new risk: it is the same rule the owner already approved on 2026-07-26 for folders the sort emptied — every directory is in the backup manifest, only folders THIS run emptied are eligible, and emptiness is re-checked against the filesystem at the moment of deletion |
| 2026-07-28 | **The interface is a LOCAL WEB UI, not Electron and not Tauri — and it ships with an installer that puts a desktop shortcut on the user's machine.** Scope: the full cycle (scan → plan → apply → rollback), planned **epic → phases → operational plans**, in that order. Audience: **the owner AND ordinary, inexperienced PC users** — so the UI, the installer and every word of product text must be very friendly, foolproof, and written in plain popular but academic language, **without jargon or slang** | Owner in chat, 2026-07-28 (idea 02 questions 2–4), verbatim: «давай локальный Web UI - это сильно проще… нужно обеспечить удобную установку… ярлык как раз таки и запускает Веб UI», «Полный объём стараемся сделать. Для начала планируем эпиками», and the capitalised requirement «ОЧЕНЬ ЮЗЕР ФРЕНДЛИ, С ЗАЩИТАМИ ОТ ДУРАКА… БЕЗ ЖАРГОНИЗМОВ И СЛЕНГА». The technical half is nearly free — the core already emits `--json` artifacts and renders reports FROM them, so a browser page is a second renderer over the same SortPlan, and `node:http` keeps the near-zero-dependency policy intact. The consequence that is NOT free, and is why this is a decision rather than a task: for a user who does not open a terminal, **installation is half the product**, and the language requirement applies to every string the tool prints. `MASTER_PLAN.md` needs a `/revision` for an interface phase after Phase 5, with an epic document before it |
| 2026-07-27 | **An editor's save date never determines a capture date** (plans/02 step 1, owner's value order from chat 2026-07-26). Three precedence changes: (1) new kind `editor-save` — a photo-editor export with no `DateTimeOriginal` gets its save date as an upper bound only («снято не позже»), always shown in disputed, never a verdict; (2) new kind `derived-original`, ranked just under `exif-original` — an exact XMP `DerivedFrom` ↔ `DocumentID` match inherits the ORIGINAL's real capture date, and the report names the original; (3) new kind `family`, ranked just above `dir-cohort` — camera census + sensor-geometry match + same-camera year fork; it narrates always and dates only when the fork closes to ONE uncontradicted year, flagged `assumed` → `<год>/прочее`. Editor whitelist is the OBSERVED list (researches/03), never "Software tag present" | The first real run shelved a summer photo into `2014/Зима начало года` on Photoshop's save date — formally correct by the old hierarchy, false about the photograph; 113 files of the owner's sample were in this class. Honest ignorance beats a fabricated date (invariant 3), and the owner set the value order himself: metadata first, pixels later, PRNU last. A guessed camera between two matching families names nothing — invented precision is exactly what this fix removes |

---

> **Maintenance:** keep this in sync with reality. When `GOAL.md` or the project's state shifts materially,
> run `/revision` to re-derive the phases. The per-step detail plans that implement each phase live in
> `plans/`.
