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

---

## Where we are now

**Phases 0–4 are CLOSED. The product works end to end.** `kpot scan` walks a tree and dates every
media file with evidence; `kpot plan` turns that into the pre-sort master plan the owner reads;
`kpot apply` executes it — but only ever after a backup it verified — and `kpot rollback` undoes it
completely. Verified live on a generated tree, not only by tests: the library built itself
(`2015/Осень/аудио/голосовые/`, `ПРОЧЕЕ/_дубликаты/`), rollback restored all 26 files and removed
all 32 created directories, and rolling back a *dry* run was refused with a plain-language reason.

**KPOT may now write — and every guarantee `GOAL.md` demands before it does exists and is proven.**

Deliberate cuts, small and recorded: THM/XMP sidecar evidence (needs a fixture case first) and the
scan-map cache. **Next: Phase 5 — first real use**: progress output for large trees, resumability
on a partially-completed run, and a first supervised run on a *copy* of a real directory (owner's
homework — the tool must never be pointed at the original).

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | ✅ done | researches 01+02, interview #001 ✅, fixtures, CLI, seasons, `src/core/`, `src/meta/` evidence model |
| Phase 2 — scan & metadata | ✅ done | acceptance spec green; `kpot scan` = assets + evidence + verdicts; deferred: sidecar evidence (needs a fixture case first) |
| Phase 3 — dedup & plan | ✅ done | `kpot plan` = SortPlan + owner-facing master plan; acceptance spec green (23 planted destinations + both ambiguities) |
| Phase 4 — safety (backup / dry run / rollback) | ✅ done | interview #002 answered; `src/apply/` = backup + the single writer + rollback; all three acceptance criteria green; guards proven by breaking them |
| Phase 5 — first real use & release | 🔲 next | progress output · resumability · supervised run on a COPY of a real dir · README + `/release` |

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
- [ ] Sidecar evidence (THM/XMP) — plant a fixture case first (THM next to its video twin, per the
      survey), then a collector feeding 'sidecar' evidence into the resolver. Small, self-contained.
- [ ] Scan-map cache keyed by (path, size, mtime) — hashing 551 GB is hours; a persistent cache in
      `.kpot-runs/` makes re-scans and the future top-up flow (idea 01) cheap. Design it read-safe.
      **Now the highest-value autonomous item**: Phase 5's first real run is otherwise an hours-long
      re-hash every time it is repeated.
- [ ] Progress output for large trees — a scan of 71 606 files currently prints nothing until it
      finishes. For a non-technical owner watching a 551 GB run, silence is indistinguishable from a
      hang. Self-contained and testable (assert the reporter is called, not the pixels).
- [ ] Resumability of a partially-completed `apply` — the journal already records enough (internal
      map, invariant 8); what is missing is the code path that reads a journal and continues rather
      than starting a new run. Rollback already handles the crash window; resume is its twin.
- [x] Season mapping — ✅ done 2026-07-24. `src/plan/season.mjs` (`seasonForMonth`, canonical Russian
      dir names per interview #001 Q2), specs in `tests/season.test.mjs`. Suite 15/15.

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
- ❓ **Empty source folders after a sort** — noticed during the Phase-4 live run: once a directory's
  contents move into the library, the now-empty original (`Мобилка/`, `копии/`, …) stays. That is
  correct by the current canon (KPOT deletes nothing, internal-map invariant 5), but the owner may
  well expect emptied source folders to disappear. Overlaps idea 01 question 3. **Not decided
  alone** — behaviour left as-is until the owner says.
- ❓ **Idea 01 awaiting owner review** — `ideas/01_inbox_topup_flow.md`: inbox dir for raw dumps +
  a desktop shortcut running an incremental **top-up flow** into the structured library (owner's
  own request in chat 2026-07-24; forks to close: auto-apply vs stop-at-plan, inbox location,
  emptied-folder policy, inbox default name). Touches Phases 3–5; does not block Phase 2 work.
- ❓ **Logo source PNGs untracked** — owner dropped `KPOT_orinigal.png` (2.7 MB) and
  `KPOT_upscale.png` (9.5 MB) into the repo root; the committed logo is `KPOT.jpg` (400 KB, used
  by README). The two PNGs look like design sources — awaiting the owner's word: commit (maybe
  under `assets/`), keep locally untracked, or delete. Do not commit silently (public repo, 12 MB).

---

## Where to continue next session

> A concrete checklist so the next session (empty context) can start immediately: which files, which
> commands, what to verify first.

1. Verify the environment: `node -v` (≥20), `npm test` (**must be 88/88**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha).
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
3. **Phase 5 — first real use.** The three self-contained pieces, in value order:
   - **scan-map cache** keyed by (path, size, mtime) in `.kpot-runs/` — without it every repeat run
     on the real archive re-hashes 551 GB (hours). This is what makes a supervised real run
     practical at all, and idea 01's top-up flow depends on it too.
   - **progress output** — a 71 606-file run currently prints nothing until it ends; for the owner,
     silence looks like a hang.
   - **resumability** of a partially-completed `apply` (the journal already records enough —
     internal map invariant 8; rollback's crash-window handling is the pattern to mirror).
4. **The first run on real data is the owner's call and needs a fresh `AUTH:`** — the archive grant
   in agent memory is READ-ONLY. Phase 5's acceptance says a *copy* of a real messy directory
   (owner's homework), never the original.
5. Two owner questions are waiting, neither blocking: empty source folders after a sort (see the
   review section above) and idea 01's open forks.
6. Decisions are all in `MASTER_PLAN.md` §Decision log (2026-07-24 and 2026-07-26 blocks) — re-read
   before designing; do not re-ask the owner what is already decided there.
7. Two lessons from Phase 4 worth re-reading before writing any new guard: `EXPERIENCE.md` EXP-0008
   (a guard that passes for the wrong reason) and EXP-0009 (invisible characters in generated
   source). Both cost real time here.

---

## Open bugs

None — there is no code yet. File defects as one md per bug in `bugs/` via `/report-bug`, per
`BUG_FIXING_FRAMEWORK.md`.
