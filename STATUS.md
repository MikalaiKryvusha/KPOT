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

### Phase 1 (partial) — Real-archive survey ✅ (2026-07-24)
- Owner granted **READ-ONLY** access to his real archive (path in agent memory, never in this public
  repo). Strictly no writes there until Phase 4 safety exists and the owner re-authorizes.
- Survey done → `researches/02_real_archive_survey.md`: 71 606 files / 551 GB, full catalog of
  extensions, filename patterns (44% carry a decodable date in the name), name hazards, ~11% exact-dup
  proxy, unreliable mtimes, and the owner's own hand-made `<year>/<season>` dirs (incl. "осень").
  This is the ground truth the fixture generator must reproduce.

---

## Where we are now

Greenfield. The framework and the repo are in place; the product is at zero. The next move is **not**
to start writing a scanner — it is Phase 1, the prior-art research `GOAL.md` explicitly asks for
("если такие решения уже есть на Github — используем их"): find out whether ExifTool, exiftool-vendored,
Elodie, PhotoPrism, `sharp`/`exifr` and friends already solve the date-extraction and dedup parts, and
decide what we reuse vs. write. Writing our own EXIF parser before that research would be the single
most expensive mistake available here.

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — prior-art research + CLI skeleton | 🔲 todo | nothing yet |
| Phase 2 — scan & metadata | 🔲 todo | nothing yet |
| Phase 3 — dedup & plan | 🔲 todo | nothing yet |
| Phase 4 — safety (backup / dry run / rollback) | 🔲 todo | nothing yet |
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

1. Read `GOAL.md` (the contract, in Russian) and `MASTER_PLAN.md` (the phases). They outrank this file
   on *what to build*; this file is *where we are*.
2. Verify the environment is intact: `node -v` (≥20), `npm test` (must exit 0), `git status` (clean),
   `gh auth status` (logged in as MikalaiKryvusha).
3. Start Phase 1 with the research task: write `researches/01_prior_art.md`. Do NOT write product code
   before it exists — `GOAL.md` requires reusing existing solutions where they fit.
4. Then the fixture generator (`tests/fixtures/make.mjs`) before any scanner code, so every later phase
   has an objective harness. See the harness section of `AGENT_GUIDE.md`.
5. File the two open interviews (season boundaries, reuse-vs-write) with `/interview` so the owner can
   answer them while autonomous work continues elsewhere.

---

## Open bugs

None — there is no code yet. File defects as one md per bug in `bugs/` via `/report-bug`, per
`BUG_FIXING_FRAMEWORK.md`.
