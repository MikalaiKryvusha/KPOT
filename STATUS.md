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

### Phase 1 — Research, decisions, harness & skeleton ✅ mostly (2026-07-24, one session)
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
- **Code (all [TESTED], suite 15/15 green):**
  - `tests/fixtures/make.mjs` — deterministic messy-tree generator, 22 planted cases + `expected.json`
    ground truth (5 specs).
  - `bin/kpot.mjs` — CLI skeleton: scan/plan/apply/rollback dispatch, `--help`/`--version`, exit-code
    contract 0/1/2/3 (7 specs).
  - `src/plan/season.mjs` — owner-decided month→season mapping (3 specs).

---

## Where we are now

Phase 1 is essentially closed in one session (2026-07-24): research done, every product fork decided
by the owner, the test harness foundation (fixture generator) exists, the CLI skeleton runs, and the
first `src/` module (season mapping) is in. Two Phase-1 backlog items remain — `src/core/` primitives
and the `src/meta/` date-evidence model — and they are exactly the bridge into Phase 2 (scan).

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | 🔶 ~80% | researches 01+02, interview #001 ✅, fixtures, CLI, seasons; left: `src/core/`, date-evidence model |
| Phase 2 — scan & metadata | 🔲 todo | `exifreader` decision made; fixture ground truth ready |
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
- [ ] `src/core/` primitives — path normalization (Windows drive letters / UNC / long paths / case),
      run journal, bounded-concurrency worker pool. Unit-testable in isolation.
- [ ] Date-evidence model in `src/meta/` — the confidence/evidence structure and filename-date patterns
      (`IMG_20130704_101112`, `2013-07-04 10.11.12`, WhatsApp/Telegram/screenshot conventions).
      Pure functions, trivially testable.
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

1. Verify the environment: `node -v` (≥20), `npm test` (**must be 15/15**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha).
2. Take the next autonomous backlog item: **`src/core/` primitives** — Windows path normalization
   (drive letters / UNC / `\\?\` long paths / case-insensitive compare), the run journal, a
   bounded-concurrency worker pool. Unit-test each in isolation (`tests/core_*.test.mjs`).
3. Then the **date-evidence model in `src/meta/`** — Evidence/DateVerdict structures + the filename
   pattern detectors. Port the ordered first-match-wins classifier prototyped in the survey (pattern
   list: `researches/02_real_archive_survey.md` §"Filename patterns"); precedence seed:
   `researches/01_prior_art.md` §5 (Elodie order). Test against the fixture tree's `expected.json`.
4. That completes Phase 1 → start Phase 2 (`src/scan/`): tree walk + media identification by content
   (magic bytes — fixtures already provide them) + streamed hashing. Wire into `kpot scan <dir>` and
   flip its exit code from 3 to 0.
5. Decisions are all in `MASTER_PLAN.md` §Decision log (2026-07-24 block) — re-read before designing;
   do not re-ask the owner what is already decided there.

---

## Open bugs

None — there is no code yet. File defects as one md per bug in `bugs/` via `/report-bug`, per
`BUG_FIXING_FRAMEWORK.md`.
