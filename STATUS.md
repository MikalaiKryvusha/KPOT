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
- KAIF 1.5 deployed (lang `ru`, mode `standard`, sphere `programming`, 5 agent systems). Record and
  rationale: `KAIF_FRAMEWORK.md`.
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
  - `tests/fixtures/make.mjs` — deterministic messy-tree generator, 22 planted cases + `expected.json`
    ground truth (5 specs).
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

---

## Where we are now

**Phase 1 is CLOSED (2026-07-24).** Research done, every product fork decided by the owner, the
harness foundation exists, the CLI skeleton runs, and the bottom layers are real: `src/core/`
(paths/journal/pool) and the `src/meta/` date-evidence model (Evidence + filename detectors) are
implemented and verified against the fixture ground truth. Next up is Phase 2: the scan phase —
tree walk, media identification by content, streamed hashing — then the EXIF/MP4 extractors that
feed the evidence model.

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | ✅ done | researches 01+02, interview #001 ✅, fixtures, CLI, seasons, `src/core/`, `src/meta/` evidence model |
| Phase 2 — scan & metadata | 🔲 next | `exifreader` decision made; fixture ground truth + evidence model ready |
| Phase 3 — dedup & plan | 🔲 todo | unblocked (seasons + layout decided) |
| Phase 4 — safety (backup / dry run / rollback) | 🔲 todo | backup fork: manifest+hardlink favored (551 GB reality) |
| Phase 5 — apply & reports | 🔲 todo | nothing yet |

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

---

## Where to continue next session

> A concrete checklist so the next session (empty context) can start immediately: which files, which
> commands, what to verify first.

1. Verify the environment: `node -v` (≥20), `npm test` (**must be 40/40**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha).
2. **Phase 2 — `src/scan/`**: tree walk (using `src/core/pool.mjs` for bounded concurrency) + media
   identification by content magic bytes (fixtures already plant JPEG/PNG/MP4/OGG signatures) +
   streamed SHA-256 hashing (`node:crypto`). Wire into `kpot scan <dir>`, flip its exit code from 3
   to 0, emit machine-readable JSON. Assert against the fixture tree's `expected.json` (kind field).
3. Then **Phase 2 extractors feeding the evidence model**: `exifreader` for images (the decided
   dependency — record installation in the decision log when added), our own ~150-line MP4/MOV mvhd
   parser (fixture MP4s carry real mvhd dates), sidecar/dirname/mtime evidence, and the DateVerdict
   resolver on top of `src/meta/evidence.mjs` precedence (spike-aware mtime discounting).
4. Acceptance for the phase (MASTER_PLAN Phase 2): every planted date recovered, every planted
   undatable reported *unknown*, each verdict lists its evidence, zero writes to the input.
5. Decisions are all in `MASTER_PLAN.md` §Decision log (2026-07-24 block) — re-read before designing;
   do not re-ask the owner what is already decided there.

---

## Open bugs

None — there is no code yet. File defects as one md per bug in `bugs/` via `/report-bug`, per
`BUG_FIXING_FRAMEWORK.md`.
