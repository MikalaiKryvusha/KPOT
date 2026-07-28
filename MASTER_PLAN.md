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
| 2026-07-28 | [AI] **A sidecar (THM/XMP) dates its twin, but only from an unambiguous CAPTURE property.** A `.thm` donates its `DateTimeOriginal` and nothing else — a thumbnail's `DateTime` is when the camera wrote the thumbnail, i.e. a save time. An `.xmp` donates `exif:DateTimeOriginal` or `photoshop:DateCreated` only; `xmp:CreateDate`/`ModifyDate`/`MetadataDate` are **not read at all**. Pairing is by stem (`VID.THM`↔`VID.AVI`) or by full name (`photo.jpg.xmp`↔`photo.jpg`), case-insensitively, within one directory; an orphan sidecar dates nobody and a stem matching two media files dates nobody [/AI] | This is plans/02 §1.1 applied one layer out: a sidecar gives no way to tell a capture date someone copied into it from the moment an editor pressed save, and the 2026-07-27 row already settled that a save date is a ceiling, never a verdict. The rank was left where Phase 2 put it (below every real capture source) and `researches/04` §4 confirms that is right: the sidecar's job is to fill a gap, not to compete — measured on the real archive, it dates 25 videos that had only a folder year and contradicts nothing that was already known |
| 2026-07-27 | **An editor's save date never determines a capture date** (plans/02 step 1, owner's value order from chat 2026-07-26). Three precedence changes: (1) new kind `editor-save` — a photo-editor export with no `DateTimeOriginal` gets its save date as an upper bound only («снято не позже»), always shown in disputed, never a verdict; (2) new kind `derived-original`, ranked just under `exif-original` — an exact XMP `DerivedFrom` ↔ `DocumentID` match inherits the ORIGINAL's real capture date, and the report names the original; (3) new kind `family`, ranked just above `dir-cohort` — camera census + sensor-geometry match + same-camera year fork; it narrates always and dates only when the fork closes to ONE uncontradicted year, flagged `assumed` → `<год>/прочее`. Editor whitelist is the OBSERVED list (researches/03), never "Software tag present" | The first real run shelved a summer photo into `2014/Зима начало года` on Photoshop's save date — formally correct by the old hierarchy, false about the photograph; 113 files of the owner's sample were in this class. Honest ignorance beats a fabricated date (invariant 3), and the owner set the value order himself: metadata first, pixels later, PRNU last. A guessed camera between two matching families names nothing — invented precision is exactly what this fix removes |

---

> **Maintenance:** keep this in sync with reality. When `GOAL.md` or the project's state shifts materially,
> run `/revision` to re-derive the phases. The per-step detail plans that implement each phase live in
> `plans/`.
