# KPOT — External structure map

> **The EXTERNAL map: what the project looks like from the outside** — its directories, files, and the
> cross-references and dependencies between them. This is the "where things live" map a fresh session
> reads to navigate. Its companion is `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` (the *internal* logical
> architecture — the abstractions and how they interact).
>
> Adapt the vocabulary to the project's **sphere**: for software — directories, files, modules; for a
> research/writing/business project — sections, documents, datasets, artifacts. Keep it in sync with the
> real tree. **Living reference — never DONE-tagged.**

---

## The tree

Two layers live side by side: the **KAIF operating layer** (exists now) and the **product layer**
(🔲 = planned, not yet created — create it as the phases in `MASTER_PLAN.md` land).

```
KPOT/
├── GOAL.md                              # the owner's contract, in Russian — outranks every other doc
├── MASTER_PLAN.md                       # phased path from here to GOAL
├── STATUS.md                            # current state — the session handoff, read first
├── AGENT_GUIDE.md                       # how to work here: canon, build/harness/git, code style
├── PHILOSOPHY.md · BUG_FIXING_FRAMEWORK.md · TESTING_FRAMEWORK.md
├── EXPERIENCE.md                        # cross-task lessons, grep by tag
├── KAIF_FRAMEWORK.md                    # what KAIF is + this project's deployment record
├── PROJECT_STRUCTURE_EXTERNAL_MAP.md    # ← you are here (where things live)
├── PROJECT_ARCHITECTURE_INTERNAL_MAP.md # how the system thinks (abstractions)
├── AGENTS.md · CLAUDE.md                # context pointers into the above, per agent system
├── LICENSE (MIT) · .gitignore · package.json
│
├── plans/ ideas/ bugs/ researches/ interviews/ homeworks/   # backlog dirs, each with a README
│
├── .kaif/          # framework marker (kaif.json), kaif-core.mjs, spheres/
├── .claude/skills/ # the CANONICAL skill set — edit here only
├── .agents/ .grok/ .cline/ .roo/   # derived copies for the other 4 agent systems (auto-resynced)
│
├── bin/kpot.mjs    # ✅ CLI entry: parseArgs → phase dispatch (scan/plan/apply/rollback), exit-code
│                   #    contract 0/1/2/3; phases themselves land in Phases 2–5
├── src/            # 🔶 in progress: core/ ✅ (paths · journal · pool) · meta/ ✅ evidence model +
│                   #    filename-date detectors · plan/season.mjs ✅; scan/ dedupe/ rest of plan/
│                   #    apply/ report/ are 🔲 planned
└── tests/          # ✅ fixtures/make.mjs (deterministic messy-tree generator, 22 cases,
                    #    expected.json ground truth) + specs for CLI/fixtures/core/meta/seasons —
                    #    npm test 40/40
```

## What each part is

| Path | What it is | Depends on / references |
|------|-----------|-------------------------|
| `GOAL.md` | The owner's statement of the product, in his own words (Russian). The contract. | nothing — everything else derives from it |
| `MASTER_PLAN.md` | Phases from the current state to `GOAL.md`, with acceptance criteria + decision log | `GOAL.md` |
| `STATUS.md` | Where we actually are; autonomous backlog; what the next session does first | `MASTER_PLAN.md`, `bugs/`, `interviews/` |
| `AGENT_GUIDE.md` | Working canon: identity, target architecture, build/harness/git policy, Node code style | both maps, `TESTING_FRAMEWORK.md` |
| `.claude/skills/` | The canonical skill definitions (`/resume`, `/autoloop`, `/fable-*`, `/kaif-*`, …) | `.kaif/spheres/`, the root docs |
| `.agents/`, `.grok/`, `.cline/`, `.roo/` | Derived copies of the same skills for Codex / Grok / Cline / Zoo Code | `.claude/skills/` (one-way) |
| `.kaif/kaif.json` | Deployment marker: version, sphere, language, agents, tracking | written by `kaif-core.mjs` only |
| `.kaif/kaif-core.mjs` | The framework's own machinery, backing `npm run kaif:*` | `.kaif/kaif.json` |
| `researches/` | Desk research write-ups — first up: prior-art comparison required by `GOAL.md` | `GOAL.md` |
| `interviews/` | Questions only the owner may answer (season boundaries, reuse-vs-write) | `STATUS.md` |
| `bin/kpot.mjs` | ✅ CLI entry: `parseArgs`, phase dispatch, `--help`/`--version`, stable exit codes (0 ok · 1 error · 2 usage · 3 not-implemented) | `src/apply/`, `src/plan/`, `src/report/` (once they exist) |
| 🔲 `src/scan/` | Tree walk, media identification, content hashing. Read-only over user data. | `src/core/` |
| 🔶 `src/meta/` | ✅ the date-evidence model (`evidence.mjs`: precedence order, wall/instant claims, plausibility window) + filename-date detectors (`filename_date.mjs`, survey-derived, fixture-verified); the EXIF/MP4 extractors land in Phase 2 | `src/core/` |
| 🔲 `src/dedupe/` | Groups identical/near-identical files across directories | `src/scan/` output, `src/core/` |
| 🔶 `src/plan/` | ✅ `season.mjs` (owner-decided month→season buckets); the target-tree builder and SortPlan emitter are 🔲 Phase 3 | `src/meta/`, `src/dedupe/` |
| 🔲 `src/apply/` | The only writer: backup commit, dry run, real move, post-report, rollback | `src/plan/`, `src/core/` |
| 🔲 `src/report/` | Renders human-readable reports from the machine-readable run data | `src/core/` |
| ✅ `src/core/` | Shared primitives: `paths.mjs` (win32-semantics normalization/comparison, `\\?\` long-path handling), `journal.mjs` (append-only JSONL run journal, crash-torn-tail tolerant), `pool.mjs` (bounded-concurrency settle-all mapper) | nothing (the bottom layer) |
| `tests/` | ✅ `node --test` specs; `tests/fixtures/make.mjs` generates synthetic messy trees with `expected.json` ground truth (catalog mirrors `researches/02_real_archive_survey.md`) | all of `src/` (once it exists) |

## Cross-references & dependency rules

1. **Code depends one way only:** `bin → apply → plan → {dedupe, meta, scan} → core`. A lower layer never
   imports a higher one; sibling feature modules never import each other — shared code moves down into
   `src/core/`. (Same rule as `AGENT_GUIDE.md` RULE 2 — if they ever disagree, the guide wins.)
2. **Only `src/apply/` writes to user files.** Every other module is read-only over the user's archive.
3. **Skills have one source:** `.claude/skills/` is canonical; `.agents/`, `.grok/`, `.cline/`,
   `.roo/commands/` are generated copies. Edit the canon, never a copy — `verify-final` and
   `/kaif-update` re-sync copies from it and will silently overwrite hand edits.
4. **Docs derive downward:** `GOAL.md` → `MASTER_PLAN.md` → `plans/NN_*.md`. `STATUS.md` describes the
   present and links sideways to backlog dirs; it never redefines the goal.
5. **Nothing in the repo may reference the owner's real archive** — no absolute media paths, no run
   journals, no user files. Fixtures are synthetic (`.gitignore` backs this up).

## Entry points

For a fresh session (human or agent), in this order:

1. `STATUS.md` — where we are, what's next, what's blocked.
2. `GOAL.md` — what the product must be (Russian; the owner's contract).
3. `AGENT_GUIDE.md` — how to work here (checklist, canon, harness, code style).
4. `MASTER_PLAN.md` — the phase you're about to work in, and its acceptance criteria.
5. This map + `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` — before touching code, to size the blast radius.
6. `EXPERIENCE.md` — grep by the task's tags before repeating a known dead end.

---

> Keep this map honest: when you add, move, or rename a file/directory, update the tree and the table in
> the same change. The *internal* logic (abstractions, data/interaction flows) belongs in
> `PROJECT_ARCHITECTURE_INTERNAL_MAP.md`.
