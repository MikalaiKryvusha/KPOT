# KPOT — Current Status

> This file is read by the AI agent before every task. Update it on every significant change of state.
> It is the PRIMARY handoff between sessions: a new agent session starts with empty context and must be
> able to get productive from this file alone. Write accordingly — concrete, with file paths and commands.
> 🧠 Prime thinking principle — `PHILOSOPHY.md` (SIMPLICITY: KISS + Occam). Read your working framework
> in `AGENT_GUIDE.md`.

---

## What's done

### Phase 0 — Project foundation ✅ (2026-07-24)
- `GOAL.md` written by the owner (in Russian) — the product contract. Read it before planning anything.
- KAIF deployed (lang `ru`, mode `standard`, sphere `programming`, 5 agent systems). Record and
  rationale: `KAIF_FRAMEWORK.md`. **Updated 1.5 → 1.6 "Homeostatic KAIF" on 2026-07-26** — see the
  update record in `KAIF_FRAMEWORK.md` and `plans/01_kaif_16_update_report.md` (findings handed to the
  KAIF framework agent — owner to forward; no issue filed without the owner's word).
- Repository created and published: **https://github.com/MikalaiKryvusha/KPOT** (public, MIT).
  `git init` on `main`, `origin` wired via `gh`.
- `LICENSE` (MIT), `.gitignore`, `package.json` (`"type": "module"`, Node ≥20, `npm test` → `node --test`).
- Docs adapted to the project: `AGENT_GUIDE.md` (canon, target architecture, build/harness/git policy,
  Node code style), the two maps, `MASTER_PLAN.md`.

**Nothing else exists.** There is no `bin/`, no `src/`, no `tests/` — not one line of product code.

### Phase 1 — Research, decisions, harness & skeleton ✅ done (2026-07-24, two sessions)
- **Real-archive survey** → `researches/02_real_archive_survey.md`. Owner granted **READ-ONLY** access
  to his real archive (path in agent memory, never in this public repo; no writes until Phase 4 safety
  exists AND the owner re-authorizes). 71 606 files / 551 GB; extension + filename-pattern catalog
  (44% carry a decodable date in the name), name hazards, ~11% exact-dup proxy, mtime bulk-copy spike,
  owner's own hand-made `<year>/<season>` dirs incl. "осень".
- **Prior-art research** → `researches/01_prior_art.md` (npm facts spot-verified). Reuse: `exifreader`
  + `node:crypto`. Write ourselves: MP4/MOV date parser, filename patterns, DateVerdict resolver, all
  product logic. Perceptual hashing deferred. The niche is open.
- **Interview #001 answered** — all forks closed: pure-JS extraction · five seasons with month
  boundaries · layout inside a season = photos at root + `видео/` + `аудио/` · junk → quarantine with
  provenance · other files stay + report · custom parent dirs preserved as nesting. Also fixed into
  `GOAL.md`: moves are **renames, not copy+delete**.
- **Bilingual README** (KAIF style) + GitHub description; name spelled out: **Krinik Photo Organizer
  Tool**.
- **Code (all [TESTED], suite 40/40 green):**
  - `tests/fixtures/make.mjs` — deterministic messy-tree generator, 22 planted cases (v2 of
    2026-07-24: 25 — dir-cohort scenario added) + `expected.json` ground truth (5 specs).
  - `bin/kpot.mjs` — CLI skeleton: scan/plan/apply/rollback dispatch, `--help`/`--version`, exit-code
    contract 0/1/2/3 (7 specs).
  - `src/plan/season.mjs` — owner-decided month→season mapping (3 specs).
  - `src/core/` — `paths.mjs` (win32 normalization/comparison, `\\?\` long paths, UNC), `journal.mjs`
    (append-only JSONL run journal, exclusive-create, torn-tail tolerant), `pool.mjs`
    (bounded-concurrency settle-all mapper). 14 specs in `tests/core_*.test.mjs`.
  - `src/meta/` — `evidence.mjs` (Evidence model: precedence order seeded from Elodie + survey tiers,
    wall-clock vs UTC-instant claim shapes, plausibility window rejecting broken-clock years) and
    `filename_date.mjs` (ordered first-match detectors for every survey convention: Android, WhatsApp,
    screenshots, WP, iOS-dotted, epoch ms/s, telegram, scavengers, bare year — verified against the
    fixture catalog's planted ground truth). 11 specs in `tests/meta_*.test.mjs`.

### Phase 2 — Scan & metadata 🔶 started (2026-07-24)
- **The scan phase is live**: `src/scan/identify.mjs` (kind by magic bytes for every survey format
  class — JPEG/PNG/GIF/PSD/TIFF-RAW/BMP, ftyp-brand split HEIC vs MP4/MOV/3GP, RIFF split
  WEBP/AVI/WAV, MKV/ASF/MPEG-PS, OGG/MP3/AMR; junk-by-name policy) and `src/scan/scan.mjs`
  (link-free walk, bounded-concurrency sniff, streamed SHA-256, per-file errors collected).
- `kpot scan <dir>` wired: **exit 3 → 0**, machine-readable JSON on stdout, human summary on
  stderr. Verified against fixture ground truth (all 22 planted kinds correct, dup group collides,
  "+"-twins don't, read-only proven by stat comparison) + a real CLI smoke run. 8 new specs, suite
  **48/48**.
- **The date pipeline is live (2026-07-24, same day):** extractors — `src/meta/exif.mjs`
  (`exifreader ^4.41.3`, the single runtime dependency, install noted in the decision log),
  `src/meta/mp4.mjs` (our own ISO-BMFF walk to mvhd, positioned reads, UTC instant),
  `src/meta/dirname_date.mjs` (owner's own year/season dirs, innermost wins) — plus
  `src/meta/resolve.mjs` (the DateVerdict resolver: implausible years → disputed, fs-mtime NEVER
  determines, corpus-level copy-spike discounting, year-only sources → honest *partial* verdicts,
  losers kept visible) and `src/meta/annotate.mjs` (composition; wired into `kpot scan` JSON).
  Precedence amendment recorded in the decision log: wall-clock sources outrank UTC instants at
  the same tier. **Phase-2 acceptance spec passes**: every planted date recovered, every planted
  undatable *unknown*, evidence attached; CLI smoke matches the ground truth exactly.
- **README branding pass (owner request, 2026-07-24):** centered `KPOT.jpg` logo on top, flag
  emojis removed, per-section language switchers (EN section links to RU and vice versa), status
  sections/badges synced to reality (scan works, Phase 3 next, suite 56/56).
- **Dir-cohort evidence (owner-approved 2026-07-24; file-size dating rejected):**
  `src/meta/cohort.mjs` — an undatable file among ≥3 confidently-dated same-year neighbors (≥80%
  consensus) gets that year as a flagged low-confidence ASSUMPTION (`verdict.assumed`, partial,
  `<год>/прочее` at plan time, always surfaced). Weak/cohort-derived neighbors never feed a
  cohort; single-file and mixed-year dirs stay honestly unknown. Fixture v2 plants the scenario
  (25 cases now); decision-log row added. Suite **56/56**.

### Phase 3 — Duplicates & the sort plan ✅ (2026-07-26)
- **Two last layout forks closed by the owner** (chat, 2026-07-26 — recorded in the decision log):
  duplicates → `ПРОЧЕЕ/_дубликаты/` with provenance in the name; custom parent dirs → preserve all
  **except technical** ones (device dumps, `DCIM`/`Camera`/`Screenshots`/messenger dirs, pure
  year/season dirs, generic content words colliding with our own `видео/`+`аудио/`).
- **`src/dedupe/dedupe.mjs`** — grouping by sha256 (media only) + keeper selection as an explainable
  **total order**: strongest date evidence → established-not-assumed → name not marked as a copy →
  shallowest path → path order. The plan prints WHY this copy was kept. Permutation-tested.
- **`src/plan/bucket.mjs`** — one file → its destination. Target layout:
  `<год>/<сезон>/[видео|аудио]/<кастомные папки>/<исходное имя>`. Handles per-year `прочее`, global
  `ПРОЧЕЕ`, junk quarantine, assumed cohort years, and the ambiguous bare-«зима» dir (never guesses a
  winter bucket — goes to `<год>/прочее` + disputed).
- **`src/plan/plan.mjs`** — the **SortPlan artifact** (operations · duplicates · disputed ·
  collisions · stay · counts · errors) + `renderPlan()`, the Russian owner-facing master plan.
  Collisions are resolved by suffixing, never overwriting. Deterministic: only `meta.plannedAt`
  varies, so Phase 4 can compare the actionable parts byte-for-byte.
- **`kpot plan <dir>` is live** (exit 3 → 0), `--json` emits the SortPlan. Read-only proven by
  before/after hash comparison of the whole tree.
- **17 new specs** (`tests/plan_phase3.test.mjs` + 2 CLI): suite **73/73**. The guards were verified
  by breaking the code first (disabling collision handling → 3 failures; dropping verdict-level
  disputes → 2) rather than assumed.

### Phase 4 — Safety: backup, dry run, rollback ✅ (2026-07-26)
- **The last OPEN decision was closed by the owner** (interview #002, answered in chat): the backup
  is a **manifest + hardlink snapshot**. Grounded in measurements, not estimates — the archive is
  551 GB on a volume with **197.8 GB free**, so a git backup does not physically fit; a probe
  measured hardlinks at **0.401 ms/link → ~29 s and ~0 bytes for all 71 606 files**, and proved a
  hardlink survives a rename of the original (same inode, `nlink=2`).
- **`src/apply/backup.mjs`** — the manifest (path/size/mtime/sha256 per file, deterministic) plus a
  hardlink snapshot of the whole tree, each link verified by inode equality. Hardlink support is
  **probed, never inferred** from the filesystem's name; where it is impossible the run refuses
  unless the owner passes `--allow-no-snapshot`. A backup that silently degrades would be worse
  than none, because the owner would trust it.
- **`src/apply/apply.mjs`** — the ONLY writer (RULE 1). Refuses to move anything until it has
  verified a backup on disk, journals intent BEFORE each act, never overwrites. The dry run is not
  a second code path: it is the same loop with inert effects, which is what makes drift impossible.
  The effects keep a model of what the run itself has filled/emptied, so the dry run answers "is
  this target free?" exactly as the real run does.
- **`src/apply/rollback.mjs`** — replays the journal backwards, resolves the crash window (intent
  recorded, outcome not) by looking at the filesystem instead of guessing, is idempotent, and prunes
  only the directories that run created.
- **`kpot apply [--dry-run] <dir>`** and **`kpot rollback <run-id> [dir]`** are live. Every phase is
  now implemented; nothing returns exit 3.
- **All three MASTER_PLAN acceptance criteria are green specs** (`tests/apply_phase4.test.mjs`,
  13 specs). Suite **88/88**. Every guard was verified by breaking the code first — and that pass
  found two things a green suite had hidden:
  - the no-hardlink refusal spec **passed with the guard deleted** (it had been simulating a bad
    filesystem by planting a file at `.kpot-runs`, so the run died of `ENOTDIR` instead). Fixed by
    making the capability probe injectable, so the spec can only pass when the guard fires;
  - the reverse-order rollback rule was **unverified**: the fixture contains no chained move, so
    inverting the order left every spec green. A purpose-built chain spec now guards it.

### Phase 5 — started (2026-07-26): scale, idempotence, and the owner's two new rules
- **Scan cache** (`src/core/scan_cache.mjs`) — keyed by (path, size, mtime), as `researches/02` §4
  prescribes. A repeat run reports `cache N/N reused (no re-hash)`; `apply` re-keys the cache from
  its own moves so it survives a sort. Without it every repeat run on the real archive re-hashes
  551 GB. 10 specs, three invalidation angles, corruption-tolerant.
- **Bug 01 — the sort was not idempotent** (`bugs/01_DONE_sort_not_idempotent.md`). Found by reading
  a smoke run, not by a test: KPOT did not recognize its OWN output layout, so every run nested one
  level deeper, grew quarantine names by their whole path, and demoted correctly-shelved files to
  `<год>/прочее`. Three causes, one root. Guarded by `tests/idempotence.test.mjs`.
- **Empty-folder removal** (owner's decision) — KPOT now deletes the folders its sort emptied, and
  only because the backup manifest records every DIRECTORY so rollback recreates them. The plan
  lists them before the run; apply re-reads each one and uses `rmdir`, never a recursive delete.
- **The `НА_РАЗБОР/` quarantine** (owner's decision, revised by the owner the same day) — a folder
  whose NAME is unclear is never taken apart: it is moved WHOLE into `НА_РАЗБОР/`, keeping its
  original parent structure, and waits there for an answer in
  `.kpot-runs/папки-на-согласование.txt`. Stripping that one prefix recovers the original path,
  which is what keeps the flow idempotent and `НА_РАЗБОР` out of the library.
- Suite **140/140**. Every new guard verified by breaking it first; two guards that turned out NOT
  to be independently falsifiable are documented as such rather than left implying coverage.

### Session of 2026-07-26 (late) — first contact with the owner's real archive
The tool met real data and the owner read the output. That combination found more in one evening
than every synthetic fixture had.

- **The real-data sample exists** (owner-authorised): `D:\work\ai_sandbox\KPOT_SAMPLE`, 3397 files /
  13 GB / 567 dirs, stratified over every class in `researches/02`. Outside the repo, gitignored by
  name anyway. mtime preserved 3397/3397; the SOURCE archive verified untouched (0 of 71 606
  changed). Full record: `researches/03_first_real_run.md`.
- **A supervised `apply` ran on it** — 7 s, 3154 moves, 495 emptied folders removed, 0 failures, and
  the multiset of sha256 hashes is IDENTICAL before and after (nothing lost, nothing invented). The
  rollback rehearsal reports 3154 files + 495 folders restorable; the undo is verified, not spent.
  **The sample is currently left SORTED** so the owner can look at it.
  Undo: `node bin/kpot.mjs rollback run-20260726-145004-a39593 D:\work\ai_sandbox\KPOT_SAMPLE`
- **Four bugs, all found by real data or by the owner's eye, all closed:**
  - `02` — a Samsung gallery ID read as a unix epoch, moving a 2024 photo to 2001.
  - `03` — found by the DRY RUN: paths compared with `!==` instead of `samePath`, so 15 files
    already home under a differently-CASED folder were planned to move onto themselves.
  - `04` — three formats unrecognised, so 38 real files were never sorted at all: 18 `.jp2` scans,
    19 `.aac` voice notes, one 2.1 GB `.mts`. MPEG-TS has no magic string — it needs two sync bytes
    one packet apart, which is why `SNIFF_LENGTH` went 16 → 208.
  - (`01` earlier the same day — the sort was not idempotent.)
- **The approval rule was sharpened twice by the owner** and now asks about **5 folders instead of
  25** on his real data: only when sorting would actually SCATTER a folder AND its name is a
  meaningful word or phrase. A careless name (`11`) is sorted silently; `Ukraine_Fall_2020` and
  `Summer_2024_Belarus_Part_1` are phrases, not identifiers. See the decision log.
- **Live progress** and **resume of an interrupted run** landed earlier the same day.

### Session of 2026-07-27 — plan 02 step 1: dating the photos that have no capture date
The 113-file broken class (editor exports shelved by their SAVE date) is fixed at the root, the
owner's value order followed exactly (metadata only — no pixels). Commit `e55ae91`.

- **Three new evidence kinds** (`src/meta/`): `editor-save` — an editor's save date never
  determines, it is a «снято не позже» ceiling always shown in disputed (§1.1); `derived-original`
  — exact XMP `DocumentID` ↔ `DerivedFrom` match inherits the original's REAL capture date, report
  names the original (§1.2); `family` (`src/meta/family.mjs`) — camera census + sensor-geometry
  match + same-camera year fork + the ceiling; narrates always, dates only a one-year
  uncontradicted fork, flagged assumed → `<год>/прочее` (§1.3). Decision-log row added.
- **Suite 143 → 156**, fixture v3 (+7 planted cases via a new full-featured JPEG builder:
  multi-tag IFD0, ExifIFD, XMP packet, SOF0 dims). All three guards verified by breaking the code
  (5/2/2 specs go red). The plan report carries a Russian family line per broken-class file.
- **Real-data proof, read-only within the grant:** `KPOT_SAMPLE` was deleted by the owner between
  sessions (EXP-0011) — verification ran as a library composition over two real PC-dump dirs:
  8331 JPEGs, 0 errors, **201 broken-class files → 199 lose their false year** (193 honest
  `ПРОЧЕЕ` with ceilings, 5 family years, 1 cohort year, 2 had real dates anyway). Family models
  found in the wild: HTC Touch2, Digimax S830, DSC-S780. XMP identity exists (35/19) but no
  original matched in that slice — §1.2 waits for a full-tree run.

### Session of 2026-07-28 — Phase 2's last cut closed: sidecar evidence
The item the backlog called "optional filler" turned out to be the only date a whole class of the
owner's videos has. Commit `d26ebb5`; suite 156 → **170**.

- **Recon before code, and it changed the design** (`researches/04_sidecars.md`, read-only over the
  real archive): a `.thm` is a **160×120 JPEG with a full 44-tag EXIF block**, and **34/34 carry
  `DateTimeOriginal`**. 25 of them sit beside an **`.avi`** — and AVI is RIFF, not ISO-BMFF, so
  `src/meta/mp4.mjs` extracts *nothing* from those videos. Measured with the real pipeline before
  writing a line: all 25 were `partial` — a year from the folder name, no season, no time.
- **`src/meta/sidecar.mjs`** — pairs by stem (`VID.THM`↔`VID.AVI`) or by full name
  (`photo.jpg.xmp`↔`photo.jpg`), case-insensitively, inside one directory. Donates **capture
  properties only**: a THM's `DateTimeOriginal` (never its `DateTime` — that is when the camera
  wrote the thumbnail), an XMP's `exif:DateTimeOriginal`/`photoshop:DateCreated` (never
  `xmp:CreateDate`/`ModifyDate`/`MetadataDate`, which editors write on save). An orphan sidecar
  dates nobody; a stem matching two media files dates nobody.
- **Real-data proof, read-only within the grant: 25/25 videos went `partial` → `dated`,** winner
  `sidecar`, 0 errors — 19 to `2012/Весна/видео/`, 2 to `2012/Зима конец года/видео/`, 4 to
  `2013/Осень/видео/`. The years match what the folder names already said, so it contradicts
  nothing: it adds the season and the timestamp.
- **Honest limit, recorded not glossed:** the archive holds exactly **one** `.xmp`, an ACDSee
  catalog sidecar with **no date properties at all**. The XMP *date* path is therefore guarded by
  fixture only, and says so in its `[TESTED]` marker.
- Fixture v3 → **v4** (+6 planted files, new `makeAvi`/`makeXmp` builders); 13 new specs plus the
  acceptance case. **All five guards verified by breaking the code first** (1/5/3/1/1 specs go red).
- **Found, surfaced, and then decided BY THE OWNER the same session:** a THM is a JPEG, so KPOT was
  filing all 34 thumbnails into the library as photographs. Asked rather than guessed (invariant
  10); the owner chose «в мусорный карантин», so `.thm` is now junk-by-extension →
  `ПРОЧЕЕ/_мусор` with provenance. Both halves verified together on real data: the 34 thumbnails
  carry no verdict, and the 25 videos they describe are still dated to the second. Suite **171**.

### Release 0.1 «First KPOT» — published 2026-07-28
Owner's word: «давай оформим релиз 0.1 в GH»; codename his choice. Tag `v0.1`, commit `5d77dbc`.
https://github.com/MikalaiKryvusha/KPOT/releases/tag/v0.1

- **Bilingual release notes** in the house style of the owner's other repos (logo, date+place header,
  `English · Русский` anchors, ✨/🔬/⚠️/🚀 sections), including an explicit **honest-limits** section
  (no GUI · no pixel matching yet · the real-data proof is a 13 GB sample, not the 551 GB archive ·
  Windows-first · the XMP-date path is fixture-only).
- **The judge pass caught a real defect before publishing:** `npm pack` was shipping the WHOLE
  repository — **17 176 090 bytes** carrying `KPOT.psd`, the 12 MB PNG logo sources, the entire KAIF
  framework and every internal working document. A `files` field now limits the package to `bin/` +
  `src/` (+ README/LICENSE/package.json npm adds itself): **90 417 bytes**. `*.tgz` was gitignored
  BEFORE the rehearsal artifact existed.
- **Release gates, all run rather than asserted:** 171/171 · a full end-to-end smoke on a fresh
  fixture, read by eye · domain invariants compared as numbers (dry run leaves the tree
  byte-identical · a real apply keeps the SHA-256 multiset identical while paths change · a re-plan
  yields 0 operations · rollback restores byte-for-byte) · the trimmed package installed into a clean
  directory with no dev tree, then **installed again straight from the release URL**, running
  `--version`/`plan` at exit 0 — so the install command printed in the notes is verified, not hoped.
- **`HANDOFF.md` added** (owner's request, same session): a dated snapshot for handing the work to a
  DIFFERENT agent/tool without this framework loaded.

---

## Where we are now

**Phases 0–4 are CLOSED and Phase 5 is well under way.** `kpot scan` walks a tree and dates every
media file with evidence; `kpot plan` turns that into the pre-sort master plan the owner reads;
`kpot apply` executes it — but only ever after a backup it verified — and `kpot rollback` undoes it
completely. Sorting is idempotent, repeat runs are cheap (the scan cache), emptied folders are
cleaned up reversibly, and folders KPOT cannot judge by name are set aside for the owner instead of
being guessed at.

**KPOT may now write — and every guarantee `GOAL.md` demands before it does exists and is proven.**

**Phase 2 has no cuts left**: THM/XMP sidecar evidence landed 2026-07-28, so every evidence tier
`researches/02` predicted now exists in code.
**What remains in Phase 5:** a supervised run on a fresh *copy* of a real directory (the previous
sample is gone — the owner deleted `KPOT_SAMPLE` between sessions; a new one is the owner's
homework). **README + the tagged release are DONE** (`v0.1`, 2026-07-28). Suite **171/171**.

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | ✅ done | researches 01+02, interview #001 ✅, fixtures, CLI, seasons, `src/core/`, `src/meta/` evidence model |
| Phase 2 — scan & metadata | ✅ done (fully closed 2026-07-28) | acceptance spec green; `kpot scan` = assets + evidence + verdicts; the last deferred cut — THM/XMP sidecar evidence — is implemented and proven on real data |
| Phase 3 — dedup & plan | ✅ done | `kpot plan` = SortPlan + owner-facing master plan; acceptance spec green (23 planted destinations + both ambiguities) |
| Phase 4 — safety (backup / dry run / rollback) | ✅ done | interview #002 answered; `src/apply/` = backup + the single writer + rollback; all three acceptance criteria green; guards proven by breaking them |
| Phase 5 — first real use & release | 🔶 in progress · ✅ released `v0.1` | ✅ scan cache · ✅ idempotent sorting (bug 01) · ✅ empty-folder cleanup · ✅ the `НА_РАЗБОР/` approval quarantine · ✅ progress output · ✅ resumability · ✅ plans/02 step 1 (editor exports dated honestly) · ✅ THM/XMP sidecar evidence (Phase 2's last cut, closed 2026-07-28) · 🔲 supervised run on a COPY of a real dir (the sample is gone — owner deleted it; needs a fresh one) · 🔲 README + `/release` |

Full phase definitions with acceptance criteria: `MASTER_PLAN.md`.

---

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
- [x] Season mapping — ✅ done 2026-07-24. `src/plan/season.mjs` (`seasonForMonth`, canonical Russian
      dir names per interview #001 Q2), specs in `tests/season.test.mjs`. Suite 15/15.
- [x] plans/02 step 1 — ✅ done 2026-07-27 (commit `e55ae91`). Editor save dates demoted to ceilings
      (`editor-save`), exact original lookup by XMP identity (`derived-original`), camera-family
      signs (`src/meta/family.mjs`). Fixture v3 (+7 cases), suite 156/156, guards break-verified,
      real-data measurement: 201 broken-class files → 199 lose their false year. Steps 2–3 of the
      plan are NOT autonomous: step 2 (pixels) waits for the owner's word.

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
- ✅ **Electron GUI ANSWERED 2026-07-26** (owner's own idea, in chat) — accepted as product
  direction, scheduled **after Phase 5**. `ideas/02_electron_gui.md`; questions 2–4 (Electron vs a
  local web UI, first-version scope, public vs personal) stay open until its turn comes.
- ✅ **Russian device-folder names — ANSWERED 2026-07-26** by the owner's choice of the "unclear
  name" criterion: they are neither silently dropped as technical nor silently preserved, but put on
  the owner's table via the decisions file.
- ✅ **Empty source folders — ANSWERED 2026-07-26** (in chat): KPOT may delete the folders its sort
  emptied, provided their paths are in the backup so a rollback recreates them. Implemented; see the
  decision log and `tests/empty_dirs.test.mjs`.
- ❓ **Should a "1 January 00:00"-ish EXIF date be trusted?** The first real run put one file in
  `2000/` on an EXIF `DateTimeOriginal` of `2000-01-01 00:25:13`. That is the classic reset-camera-
  clock default, and the archive otherwise starts in 2007. Distrusting it is a policy decision about
  the owner's photos, so it was surfaced rather than decided (`researches/03_first_real_run.md`).
- ❓ **plans/02 step 1 results await the owner's glance** (2026-07-27): 199 of 201 real editor
  exports lose their false years — most become honest `ПРОЧЕЕ` with a «снято не позже» ceiling.
  If that ratio feels too blunt, step 2 (perceptual-hash search for the original — his «пиксели
  не надо» stands until he says otherwise) is the designed next lever. Also: `KPOT_SAMPLE` was
  deleted — a fresh sample copy is the owner's homework when he wants the supervised-run rehearsal.
- ❓ **Idea 01 awaiting owner review** — `ideas/01_inbox_topup_flow.md`: inbox dir for raw dumps +
  a desktop shortcut running an incremental **top-up flow** into the structured library (owner's
  own request in chat 2026-07-24; forks to close: auto-apply vs stop-at-plan, inbox location,
  emptied-folder policy, inbox default name). Touches Phases 3–5; does not block Phase 2 work.
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

1. Verify the environment: `node -v` (≥20), `npm test` (**must be 171/171**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha). Owner-provided paths from this file are PAST observations —
   re-check they still exist before planning around them (EXP-0011: `KPOT_SAMPLE` vanished).
2. **Run the whole product once, end to end, before designing on top of it.** It all works now:
   ```
   node tests/fixtures/make.mjs <tmp>          # 25 planted cases + expected.json ground truth
   node bin/kpot.mjs plan <tmp>                # the owner-facing master plan
   node bin/kpot.mjs apply --dry-run <tmp>     # full simulation, zero writes
   node bin/kpot.mjs apply <tmp>               # the real sort (backup first, always)
   node bin/kpot.mjs rollback <run-id> <tmp>   # everything back where it was
   ```
   (Fresh temp dir each time — `%TEMP%` is cleaned between sessions. The run id is printed by
   `apply`; run data lives in `<tmp>/.kpot-runs/`, which scans deliberately skip.)
3. **`plans/02` — step 1 is ✅ DONE (2026-07-27, commit `e55ae91`; measurement in the plan's status
   section).** **Step 2 is now AUTHORISED** — the owner said «Да, ищи оригинал по пикселям» in chat
   on 2026-07-28, reversing his earlier «пиксели не надо» for this step. So the next substantial
   piece of product work is `plans/02` §Шаг 2: a perceptual hash (dHash/aHash over a downscaled
   copy) that finds the ACTUAL original of an editor export — crops and re-compressions included —
   and inherits its real `DateTimeOriginal`. The plan already names the dependency (`jpeg-js`, MIT,
   pure JS) and the hard part (a crop shifts the frame, so compare over an overlapping region or
   via downscaled previews). Side benefit `researches/01` predicted: renamed and re-encoded copies
   that sha256 dedupe cannot see.
   **⛔ It is an EPIC feature, so it starts with a PRIOR-ART REVIEW, not with code** (owner's canon
   rule of 2026-07-28, `AGENT_GUIDE.md` step 9a): perceptual hashing is a named, well-studied
   family — aHash/dHash/pHash/wHash, blockhash, and the pHash literature — with documented failure
   modes (crop and rotation sensitivity, threshold choice, false-positive rates on near-uniform
   images) that this project must read rather than rediscover. Write `researches/05_*.md` FIRST,
   web-searched with sources; the plan's step-2 design is then written by that document. **Step 3 (PRNU) stays unstarted and unauthorised** — it answers
   "which camera", not "which shot", and only wins when the original is gone for good.
4. **Phase 5, what is left.**
   - ✅ **README refresh + a tagged release** — DONE 2026-07-28: `v0.1` «First KPOT», bilingual
     notes, `kpot-0.1.0.tgz` attached (88 KB after the packaging fix). The install command in the
     notes was verified by installing from the release URL, not assumed.
   - 🔲 **A fresh supervised run needs a fresh sample:** `KPOT_SAMPLE` no longer exists — the owner
     deleted it between sessions (his data, his call; do NOT recreate 13 GB of his photos without a
     fresh word). Phase 5's acceptance still wants a supervised run on a *copy* of a real dir.
   - ✅ THM/XMP sidecar evidence — DONE 2026-07-28 (`researches/04_sidecars.md`, commit `d26ebb5`).
     It was listed here as "optional filler" and turned out to be the only date 25 real videos have.
5. **The first run on real data is the owner's call and needs a fresh `AUTH:`** — the archive grant
   in agent memory is READ-ONLY. Phase 5's acceptance says a *copy* of a real messy directory
   (owner's homework), never the original.
6. One owner question is waiting and does not block: idea 01's open forks (the inbox/top-up flow).
   The logo PNGs in the repo root are still undecided too.
7. Decisions are all in `MASTER_PLAN.md` §Decision log (2026-07-24 and 2026-07-26 blocks) — re-read
   before designing; do not re-ask the owner what is already decided there.
8. Two lessons from Phase 4 worth re-reading before writing any new guard: `EXPERIENCE.md` EXP-0008
   (a guard that passes for the wrong reason) and EXP-0009 (invisible characters in generated
   source). Both cost real time here.

---

## Open bugs

**None open.** Closed so far:

- ✅ `bugs/03_DONE_case_insensitive_noop.md` (2026-07-26) — found by the **dry run** during the first
  supervised sort. The owner capitalises his season folders (`Зима Конец Года`); on Windows that is
  the SAME directory as KPOT's canonical `Зима конец года`, so 15 files already home were planned to
  move onto themselves and `apply` refused them. Cause: `buildPlan` compared paths with `!==`
  instead of the `samePath` helper `AGENT_GUIDE` mandates for exactly this. 15 failed → 0 failed.
- ✅ `bugs/02_DONE_epoch_false_positive.md` (2026-07-26) — found on the FIRST real-data run. A
  Samsung gallery *sequence number* has exactly the shape of a unix epoch, decoded to 2001-09-09,
  and moved a photo the owner keeps in his `2024/` folder into a year his archive has nothing in.
  Fixed by bounding filename-epoch decodes at 2008, the year the convention itself began — a claim
  decoding to before Android existed contradicts itself. Guard verified by reverting the fix.

- ✅ `bugs/01_DONE_sort_not_idempotent.md` (2026-07-26) — sorting twice kept moving files: KPOT did
  not recognize its OWN output layout. Three causes, one root: the season directories it creates
  (`Зима начало года`), its buckets (`прочее`, `ПРОЧЕЕ`, `_мусор`, `_дубликаты`) and its two-segment
  `<год>/<сезон>/` form were all invisible to the modules that read a path. Consequences were real —
  unbounded nesting, quarantine names growing by their whole path each run, and correctly shelved
  files being demoted to `<год>/прочее`. Guarded by `tests/idempotence.test.mjs`; each fix verified
  by reverting it.

File defects as one md per bug in `bugs/` via `/report-bug`, per `BUG_FIXING_FRAMEWORK.md`.
