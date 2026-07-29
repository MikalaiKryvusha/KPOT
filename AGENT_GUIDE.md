# KPOT — AI Agent Guide

This file is read by the AI agent before every task. It is the **canon** of the project: the rules,
the map, the commands, the conventions. Keep it accurate — a fresh agent session with empty context
relies entirely on this document to get to work.

> 🧠 **PRIME PRINCIPLE — SIMPLICITY (read `PHILOSOPHY.md`).** If something is taking a long time, it is
> NOT a hard task and NOT a library bug — the agent is DOING IT TOO COMPLEX because it did NOT UNDERSTAND
> THE TASK. Everything should be simple (KISS + Occam). Stuck → re-understand the task, find the
> built-in simple path, do NOT escalate complexity. A stall = "simplify your understanding," not "dig harder."

> 🤖 **AUTONOMOUS MODE.** When the human has stepped away / granted autonomy and there is no active
> interactive task, and `STATUS.md` has an open autonomous backlog — the agent SHOULD, on its own
> initiative, enter the appropriate loop skill (`/autoloop`, `/dayloop`, or `/nightloop`) and grind the
> backlog, committing progress and self-restarting after each task. Stop only on the skill's stop
> conditions. Do not enter a loop if the human just gave a specific interactive task.

---

## Before every task — checklist

```
1. Read STATUS.md                 # current state: what's done, where we are, what's next
2. Recall experience              # grep EXPERIENCE.md by the task's tags — don't repeat known dead ends (skill: /experience)
3. git status                     # what changed, what's uncommitted
4. git log --oneline -5           # where we are in history
5. Read MEMORY.md (if present)    # user profile, key decisions
6. Load ONLY the relevant slice   # use the Context router below — read the required minimum + task-type docs, not everything
7. Execute by the fable loop      # /fable-method: gates + forced artifacts (INTENT/AUTH/TWINS/PENDING); /fable-loop to orchestrate; /fable-judge before claiming done
8. Read the relevant plan         # plans/<feature>.md, if the task touches a specific feature. Code by citing the plan: before implementing a step, QUOTE the anchor line you are doing right now — if you can't name the line, that's scope drift caught BEFORE the diff
9. Recon before code — TWO gates, in this order. Both write into researches/, both replace invention with reading, and both are reused by every future session (researches/01…04):
   (a) EPIC feature? → FIRST a PRIOR-ART REVIEW, web-searched, never recalled: what the industry and the literature already settled about this problem. "Almost everything in the industry has golden standards and scientific papers" (owner, 2026-07-28). DESIGN is forbidden until it exists — deciding the approach IS the thing this gate protects
   (b) Rests on an external truth (a file-format spec, a third-party lib's real behavior, the owner's real archive, another tool's semantics)? → a RECON DOC describing how that truth ACTUALLY works, read from the live source. CODE is forbidden until it exists; then code by the document, not from recall
10. Check the map & blast radius   # before editing code: PROJECT_ARCHITECTURE_INTERNAL_MAP.md — who is affected; update the map if relations change
11. Run the build (if touching code)   # NO build step — pure Node ESM. The gate is `npm test`. Do NOT run `npm run build` (no such script).
12. Use the test harness          # `npm test` (node --test) + CLI runs against tests/fixtures/ — drive/observe the software without a human
13. Comment the code              # comment blocks, classes, modules, important lines — with a test-status marker: fresh raw content gets [NOT-TESTED]; verified-by-observation flips to [TESTED: date · how] (TESTING_FRAMEWORK.md)
14. Reflect on bugs in bugs/      # one md per bug; follow BUG_FIXING_FRAMEWORK.md
15. Capture experience            # after a meaningful success/failure, append a lesson to EXPERIENCE.md (skill: /experience)
16. Periodically re-read the key guidance docs:
    - PHILOSOPHY.md   ← the simplicity principle; if stuck, go here first
    - AGENT_GUIDE.md
    - STATUS.md
    - BUG_FIXING_FRAMEWORK.md
    Edit them when it would make future autonomous work more effective. The agent operates across
    sessions that lose context — these docs must let a fresh session get productive from empty context.
17. Narrate in the chat, at least a little, in natural language — what you're doing right now — so the
    human can glance over and follow along.
18. Documents from the human (ideas, bugs, features): FIRST commit the original verbatim (git add +
    commit) — only then, in a following commit, fix typos and minimally restructure into a clean
    structured format for AI consumption (the human's voice and every thought preserved; their original
    wording stays reachable in git history). After implementing from such a document, write the status
    and the implementation date back into it.
```

→ **`STATUS.md`** is the master state file. Update it after every significant task.

### Context router (progressive loading) — read only the slice you need

Don't read every document "just in case" — that fills the context you're trying to protect. Read the
**required minimum** always, then only the documents for the task type; fetch more on demand.

| Task type          | Read (minimum on top of the required minimum)                         |
|--------------------|-----------------------------------------------------------------------|
| **Required minimum (always)** | `STATUS.md` · `PHILOSOPHY.md` (the principle set) · this router · `EXPERIENCE.md` (grep by tag) |
| Bug                | `BUG_FIXING_FRAMEWORK.md` · `bugs/<this>` · the map (blast radius)     |
| Testing / verifying anything | `TESTING_FRAMEWORK.md` (the 7 principles · `[NOT-TESTED]`/`[TESTED]` markers) · the sphere's verification sections |
| Feature / idea     | `ideas/<this>` · `MASTER_PLAN.md` · the relevant `plans/<this>`        |
| Refactor / edit    | `AGENT_GUIDE.md` · the two maps (blast radius)                         |
| Planning           | `MASTER_PLAN.md` · `GOAL.md` · open backlog                            |
| **Epic feature** (named algorithm · new dependency or `src/` subsystem · a new promise to the owner · its own `plans/NN` · you can't explain it in one sentence) | the **prior-art review** in `researches/` — **web-search and write it FIRST**; designing before it exists is the violation (checklist step 9a) |
| External truth involved (file-format spec / third-party lib / the real archive / another tool) | the recon doc in `researches/` — **create it first** if it doesn't exist (checklist step 9b) |

Sections in these documents are anchored — address a slice (`DOC.md#anchor`) rather than re-reading the
whole file. The required minimum is **not** subject to laziness: `PHILOSOPHY.md` always applies.

### Recon artifacts — when the task has an external truth

Four artifact types live in `researches/`, each replacing a specific kind of invention with
observation (a session that "remembers" a domain invents it):

- **Prior-art review** (checklist step 9a) — *what the world already knows* about this problem,
  **web-searched in this session, never recalled**. The owner's standing instruction (2026-07-28):
  «почти на всё в индустрии есть золотые стандарты и научные работы» — so before an epic feature the
  first move is to go and read them. This is `PHILOSOPHY.md`'s *Best practices* principle mechanized:
  the principle alone never fires, a gate does.

  **When it is REQUIRED — any one of these makes a feature "epic":**
  - it rests on an algorithm that has a NAME in the literature (perceptual hashing, PRNU, CRDT, HNSW…);
  - it adds a runtime dependency, or a new subsystem under `src/`;
  - it changes a promise the product makes to the owner;
  - it is big enough to need its own multi-step `plans/NN` document;
  - **you cannot state in one plain sentence how it works, from your own knowledge** — the honest
    detector, and the one that catches the cases the other four miss.

  **Minimum content** (a stub does not discharge the gate):
  1. the question in one sentence, and OUR constraints it must be answered against;
  2. the established/canonical approach, each claim carrying a **link opened in this session** + a date;
  3. the academic or reference basis where one exists (paper, RFC, spec, reference implementation);
  4. 2–3 real alternatives compared **against our constraints**, not in the abstract;
  5. **the failure modes other people documented** — the highest-value section, and the first one a
     hurried session drops. Someone has already stepped on this rake; find out where;
  6. a recommendation, plus what we are deliberately NOT doing and why;
  7. what remains unknown and must be measured locally — which is what hands off to (b).

  **Anti-fraud clause.** This is the document a model is most tempted to fill with plausible
  recollection. A claim you could not source is written as an **open question**, never as a fact;
  an invented citation is worse than a missing one (`PHILOSOPHY.md`, the three doors). `/fable-judge`
  treats unsourced claims here as findings.

  Precedent: `researches/01_prior_art.md` is exactly this artifact — it is what kept KPOT from writing
  its own EXIF parser, and what deferred perceptual hashing on measured grounds rather than taste.
- **Recon doc** (checklist step 9b) — *describes* how the external truth actually works, read from the
  live source (the format spec, the library's real output, the running tool) — never from recall. The
  first artifact of any task that rests on one; reused by every future session. KPOT already has
  five: `researches/01_prior_art.md` (npm/prior-art facts, spot-verified),
  `researches/02_real_archive_survey.md` (the owner's real archive, observed read-only),
  `researches/03_first_real_run.md` (what the tool actually did on a real sample),
  `researches/04_sidecars.md` (what a THM/XMP file really contains — which overturned the guess that
  a sidecar merely corroborates: for 25 real videos it is the ONLY date that exists) and
  `researches/05_perceptual_hashing.md` (the first artifact written under the 9a rule — it killed the
  planned dHash design on measured grounds and corrected a licence the plan had asserted unchecked).
- **Canon map** — for any domain with facts: a table of entities → their roles → mappings, **approved by
  the owner**. The map precedes the canon: every edit is checked against it, ONLY the owner may change
  it, and a conflict between text and map = stop and ask. Key facts of the map deserve guards
  (`BUG_FIXING_FRAMEWORK.md` → Guards). For KPOT the owner-decided mappings live in `MASTER_PLAN.md`
  §Decision log (month→season, layout, junk policy) — treat that block as the canon map and never
  re-decide what it settles; `src/plan/season.mjs` + `tests/season.test.mjs` are exactly such a guard
  over the month→season row.
- **Parity inventory** — where a reference exists (a prior-art tool, a format spec, the survey's
  catalog of real filename conventions): a **countable** checklist, one row per element — `element →
  reference behavior → present in ours? → OK/bug`. The rule: **no inventory row — no code**; delivery is
  judged BY THE ROWS, not by impression. A recon doc *describes*; the inventory *counts* — a session can
  read a description and still invent, but it cannot argue with a row. `tests/fixtures/expected.json` is
  this project's executable parity inventory: every planted case is a row.

### Task execution discipline — the fable loop

Any non-trivial task is executed by the **fable-method** loop (`.claude/skills/fable-method/`): classify
the ask → define done → gather evidence → decide → act surgically → verify by observation → report
outcome-first, with its gates and **forced artifacts** (`INTENT:` / `AUTH:` / `TWINS:` / `PENDING:`
lines at decision points — rules at decision points, not rules in lists, are what weak sessions actually
follow). Orchestrated work (parallel evidence fan-out, adversarial verifiers) uses `/fable-loop` — inside
the autonomous cycles, per backlog item. Whenever work is claimed complete (yours or another agent's),
run a **`/fable-judge`** pass before presenting it as done — mandatory in the loops and in `/release`.
These three skills are vendored verbatim from [fable-method](https://github.com/Sahir619/fable-method)
(Sahir619, MIT) — see their headers for the sync ritual; the project's sphere library plays the role of
their domain adapters.

### Languages — two audiences, two languages

Agent-internal documents (this guide, `PHILOSOPHY.md`, `BUG_FIXING_FRAMEWORK.md`, `STATUS.md`,
`EXPERIENCE.md`, the maps, working notes in `plans/`/`bugs/`/`researches/`, the skills) are written and
maintained in **English** — the language models read most reliably. Owner-facing documents (`GOAL.md`,
`KAIF_FRAMEWORK.md`, the directory READMEs) and every chat report to the owner are in
**ru**. Keep this split as you create new documents.

### Experience log — `EXPERIENCE.md`

`EXPERIENCE.md` is the agent's growing, grep-friendly log of lessons (externalized memory of what works and
what doesn't). **Recall** relevant entries before a task (grep by tag); **capture** a short lesson after any
meaningful success or failure — in loops, do both without waiting for the human. Skill: `/experience`.
Boundary: `bugs/` = one doc per defect; `EXPERIENCE.md` = short cross-task, approach-level lessons (incl.
successes). Living reference — never DONE-tagged.

---

## Project identity (CANON — use these, don't invent)

| Field | Value |
|-------|-------|
| **Name / brand** | `KPOT` — **Krinik Photo Organizer Tool** (owner's naming, 2026-07-24) |
| **Short name** | `KPOT` |
| **GitHub repository** | `https://github.com/MikalaiKryvusha/KPOT` (public) |
| **Local project folder** | `D:\work\ai_sandbox\KPOT` |
| **Author / owner** | `Mikalai Kryvusha` |
| **License** | `MIT` — see `LICENSE` (© 2026 Mikalai Kryvusha / KOT KRINIK) |

> Keep one canonical spelling for names/paths/URLs and use it everywhere. If you find an old/renamed
> identifier in historical docs, normalize it to the canonical value above.

---

## Goal of the project

KPOT is an open-source CLI tool that turns a person's chaotic home photo/video collection into an
orderly chronological library. It scans a directory (or a whole drive), finds media files, establishes
each file's capture date from whatever evidence exists (EXIF, filename, sidecars, filesystem times),
detects duplicates and copies scattered across directories, and lays everything out as
`<year>/<season>/`. It is built for a non-technical owner of a messy archive, so **safety outranks
tidiness**: nothing moves until the owner has seen a plan, a dry-run report and a backup they can roll
back to. Full statement of intent: `GOAL.md` (in Russian, the owner's words — treat it as the contract).

---

## Architecture — the map

> ⚠️ **Status: planned, not yet built.** No source code exists yet (see `STATUS.md`). The layout below is
> the agreed target shape — create directories as the phases land, and keep this section honest.

```
bin/kpot.mjs    ← a FACE: parses argv, calls src/app/, prints. No pipeline logic since phase 6.0
src/ui/         ← the local web server: token + Host whitelist + one instance (a FACE, prints nothing to disk)
src/app/        ← the four phases as callable functions: take a dir, return artifacts, PRINT NOTHING
                  (one executor, many faces — the web UI of Phase 6 calls exactly this)
src/scan/       ← walks the tree, identifies media files, hashes them          (reads user files)
src/meta/       ← date & metadata extraction; every verdict carries a confidence + evidence
src/dedupe/     ← groups identical/near-identical files across directories
src/plan/       ← builds the target year/season tree; emits the pre-sort master plan + disputed cases
src/apply/      ← the ONLY writer: backup commit, dry run, real move, post-report, rollback
src/report/     ← renders human-readable reports (scan map, dry-run, post-sort)
src/core/       ← shared primitives: run journal, config, paths, logging
tests/          ← node --test specs + tests/fixtures/ (synthetic messy trees)
```

**RULE 1 (the safety invariant):** only `src/apply/` may modify, move or delete a user's file, and only
after a backup commit exists and the run journal records the intended operation. Every other module is
strictly read-only over the user's data. Violating this is a bug even if the run "worked".

**RULE 2 (dependency direction):** dependencies point one way only —
`{bin, ui} → app → apply → plan → {dedupe, meta, scan} → core`. A lower layer never imports a higher
one, and sibling feature modules do not import each other; shared code moves down into `src/core/`.
*Amended 2026-07-29 (phase 6.0):* `src/app/` was inserted so a second face cannot become a second
implementation — a face may only compose what `src/app/` exposes, and it is the only layer allowed to
print.

**RULE 3 (evidence, not guesses):** a date is never silently invented. Every file carries the evidence
and the confidence behind its date; anything unresolved goes to the global "прочее" bucket and is listed
in the disputed-cases section of the plan, per `GOAL.md`.

Full file map and data flows live in `PROJECT_STRUCTURE_EXTERNAL_MAP.md`.

---

## Build

**There is no build step.** KPOT is plain Node ESM (`"type": "module"`) — sources run as written, nothing
is compiled or bundled. `npm run build` does not exist; do not invent it. The equivalent gate is:

```bash
npm test              # node --test — the correctness gate; exits 0 on a clean tree
node --check <file>   # syntax-only check of a single .mjs file
```

**`npm run package` runs ONLY from PowerShell** (EXP-0027). From Git Bash it dies with
`tar: Cannot connect to D: resolve failed` — GNU tar reads `D:\…` as a remote host, while PowerShell's
`tar.exe` is Windows' bsdtar and handles it. Same family, same day: **pass text to tools through
FILES, never through command-line arguments** — `python -c` with Cyrillic arrives already mangled by
the console codepage, a backtick inside a double-quoted shell string is eaten as command substitution
**without any error** (it corrupted a canon document and the script still printed `ok`), and `D:\…`
inside a string literal is a `\u` escape. Write a UTF-8 file with a quoted heredoc, pass the path, and
**read the result back** — the silent variant is invisible otherwise.

Environment: Node ≥20 (`engines` in `package.json`); developed on Node 24 / Windows 11 with PowerShell
as the primary shell. No native dependencies so far — if a metadata library needs one, treat that as an
architecture fork and run `/interview` first. Keep the dependency count near zero: `GOAL.md` says reuse
an existing solution where one genuinely fits, otherwise write it ourselves in `.mjs`.

---

## Test harness (how the agent observes & drives the software)

KPOT is a CLI over a filesystem, which is the easiest possible thing to verify autonomously: **generate a
synthetic messy tree, run the tool on it, compare the result to a golden expectation.** No human, no real
photos, no guessing. This is the project's single most important investment — build it early (Phase 0)
and grow it with every feature.

The rules that keep it objective:
- **Never test against the owner's real archive.** Fixtures only. A generator script builds trees with
  known-correct answers (known EXIF dates, known duplicates, known undatable files), so the expected
  output is computed, not eyeballed.
- **Assert on the plan, not on the eyeball.** Phases emit machine-readable JSON alongside the human
  report; tests assert on the JSON. A dry run must produce byte-identical operations to the real run —
  that equivalence is itself a test.
- **Every destructive test runs in a temp dir** created per test and removed after, never in the repo.

| Command | What it does |
|---------|--------------|
| `npm test` | Runs every `*.test.mjs` via `node --test`. The gate before any commit. Real specs exist since 2026-07-24 (fixture generator, 5 specs). |
| `node tests/fixtures/make.mjs <dir>` | Generates the deterministic messy fixture tree + `expected.json` ground truth into `<dir>` (temp dirs only, never the repo). |
| `node --test --test-name-pattern "<re>"` | Runs a single spec while iterating. |
| `node --test --experimental-test-coverage` | Coverage report — use it to find untested branches in date resolution. |
| `node bin/kpot.mjs scan <dir>` | ✅ builds the scan map: JSON on stdout — assets (path/size/mtime/kind/format/sha256) + per-media `evidence` and `verdict` (DateVerdict: dated/partial/unknown, disputed kept) + errors; human one-liner on stderr. Read-only. |
| `node bin/kpot.mjs plan <dir>` | ✅ builds the pre-sort master plan: Russian owner-facing report on stdout (folders awaiting the owner's decision · what moves where and why · duplicates · disputed cases · name collisions · folders that will be emptied and deleted · what stays), one-line summary on stderr. Writes only inside `<dir>/.kpot-runs/` (scan cache + the decisions file). |
| `<dir>/.kpot-runs/папки-на-согласование.txt` | The owner's decisions file. Folders with an unclear NAME are never taken apart: they are moved WHOLE into `<dir>/НА_РАЗБОР/`, keeping their original parent structure, until the owner writes `сортировать` or `как есть` against each. Keys are ORIGINAL paths, so answers survive the move. Regenerated every plan; existing answers preserved. `--no-cache` does not affect it. |
| `node bin/kpot.mjs plan <dir> --json` | ✅ the same run as the machine-readable **SortPlan** artifact (`operations`/`duplicates`/`disputed`/`collisions`/`stay`/`counts`) — what Phase 4/5 dry-run, apply and rollback consume. Deterministic apart from `meta.plannedAt`. |
| `node bin/kpot.mjs apply --dry-run <dir>` | ✅ full simulation through the SAME code path as the real run — inert filesystem effects only. Emits the dry-run report; writes a journal (in `.kpot-runs/`) that differs from a real run's by exactly one header flag. |
| `node bin/kpot.mjs apply <dir>` | ✅ the ONLY writing command. Re-plans the tree, creates the backup (manifest + hardlink snapshot), refuses to move anything if that backup is not verifiable, journals each intent before acting, then renames. Prints the post-sort report ending in the rollback command. `--allow-no-snapshot` is the explicit override for filesystems without hardlinks (exFAT/FAT32). |
| `node bin/kpot.mjs rollback <run-id> [dir]` | ✅ replays a run's journal backwards and puts every file back; prunes only the directories that run created. Idempotent. Refuses to "roll back" a dry run. `[dir]` is the archive root (defaults to the current directory) — the post-sort report prints the exact command. |

> Full harness guide: `TESTING_FRAMEWORK.md` (the 7 principles and the `[NOT-TESTED]` / `[TESTED]`
> markers). Fixture generator and specs live in `tests/` once Phase 0 lands.

---

## Git workflow

Work **only in `main`** — no feature branches. Commit incrementally and often; small commits are the
undo mechanism. To undo, use history (`git revert <hash>`, `git checkout <hash> -- <file>`), never a
branch dance and never `git reset --hard` on shared history. Push to `origin` (GitHub, public) after a
green `npm test`.

Never commit a user's media, a real archive path dump, or a run journal from a real run — `.gitignore`
already excludes `/.kpot-runs/` and `*.log`. Test fixtures must be synthetic and small.

> Reconciliation with the fable-method **authorization gate**: this deployed guide IS the owner's
> standing authorization for routine commits/pushes per the policy above. Everything beyond it —
> releases, deploys, external sends/publishes, force-pushes, deletions of shared data — still requires
> the owner's quoted words (an `AUTH:` line).

**Non-negotiable git hygiene (each rule exists because its violation burned a real project):**

- **`git diff --stat` before every commit.** Anything in the diff you did not intend to change — STOP
  and explain it first. This includes diffs *your tools* generated (lock files, manifests, formatters):
  an agent trusts its tools even more blindly than itself — read those diffs line by line.
- **Ignore first, then the tool.** Any new tool, export, dump, key, or binary enters the project ONLY
  after its `.gitignore` line exists. A secret caught by a gate is a success of procedure; a secret
  caught by the owner is a failure of the framework. For KPOT this is sharper than usual: the owner's
  media, real archive paths and run journals must never reach a public repo — `/.kpot-runs/` and `*.log`
  are already ignored; anything new that touches real data gets its ignore line BEFORE it is created.
- **The owner's originals are inviolable.** A document from the owner is committed verbatim BEFORE any
  edit (checklist step 18) — never "improve" an original that isn't safely in history yet.

## Commits

Style: `feat:`, `fix:`, `docs:`, `refactor:`, `ci:` + one line of what was done.

**A commit that touches test files carries a justification block:** *why this test changed and what it
now guards*. A test edit without it is fraud by default (`/fable-judge` hunts exactly this — the quiet
fitting of tests to new behavior is the most documented agent failure). After changing behavior, also
answer: could the old tests now pass for the WRONG reason? If yes — rebuild the fixtures so each test
guards what it claims to guard, and say so in the commit.

End every commit message with the co-author trailer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

Replace the trailer with whatever agent/model is actually doing the work (`Codex GPT-5`, `Grok`, …) —
it records who wrote the change, so it must be truthful rather than copied.

No commit/version tool yet: commit with plain `git`. If a release tool appears (version bump + tag +
`gh release`), document it here and in the Tools table — and note that `/release` is the skill that
drives it.

## Push / GitHub authentication

Authentication is the **`gh` CLI** (v2.95+), logged in as `MikalaiKryvusha` with the token in the OS
keyring; git operations use HTTPS with `gh` acting as the credential helper. Verify with `gh auth status`.
If git asks for a password, re-wire the helper: `gh auth setup-git`. Use `gh` for all GitHub work
(issues, releases, PRs) — never hand-roll API calls with a token.

Push recovery: on a non-fast-forward rejection → `git pull --rebase origin main` → resolve → `npm test`
→ push again. Never `--force` a shared branch; if history really must change, ask the owner first.

---

## Tools

The project has **no custom tooling yet** — only the KAIF handles the installer wired into
`package.json`. Add a row here the moment you add or extend a tool.

| Command | What it does |
|---------|--------------|
| `npm test` | The correctness gate (`node --test`). See the harness section above. |
| `npm run package` | Builds the portable Windows ZIP (phase 6.5): verifies the vendored Node archive against the SHA-256 nodejs.org published, reads the Authenticode signature **on the file that is actually shipping**, stages the tree, audits it against an allow-list, and zips it. Needs `vendor/node-<ver>-win-x64.zip` — gitignored, 35 MB, download it from nodejs.org. |
| `npm run package:verify` | The acceptance run for that ZIP: unzips into a clean folder and proves the product works there **on its own bundled runtime** (plan → apply → idempotent re-plan → rollback), that `KPOT.cmd` really starts the server, and that nothing of ours came along for the ride. Refuses loudly if no package is built. Sets `KPOT_NO_BROWSER=1`, so it never opens a window on anyone's desktop. |
| `npm run kaif:version` | Prints the deployed KAIF version / sphere / language (skill: `/kaif-version`). |
| `npm run kaif:check` | Checks the origin for a newer KAIF release. |
| `npm run kaif:update` | Updates the KAIF framework files in place (skill: `/kaif-update`). |
| `gh` | All GitHub operations — issues, releases, repo settings. |

---

## Backlog & the DONE tag

So that the file listing alone tells you what's open vs. closed — **insert the word `DONE` into the
filename after the number when a file's task is completed and verified:**

```
bugs/04_modal.md                →  bugs/04_DONE_modal.md
ideas/07_dev_menu.md      →  ideas/07_DONE_dev_menu.md
```

**Rule (do this every time you work with bug/idea files):**
- Finished a bug/idea and it is CONFIRMED closed (status ✅, verified) — rename immediately, inserting
  `DONE` after the number: `git mv <NN>_<name>.md <NN>_DONE_<name>.md`.
- A file in progress / partial / research-only — do NOT mark `DONE` (🔧/🟡/🔬 = not done yet).
- Use `git mv` (preserves history). Don't change the number.
- Reference docs in `plans/` (master_plan, project_map, etc.) are NOT tasks — never tag them DONE.
- **Closing any idea/bug/plan requires a "Decisions made without the owner" section** — every
  micro-decision the agent made solo while executing, and how it chose (or an explicit "none"). An agent
  silently makes dozens of such calls; this section puts them on the owner's table, where a divergence
  from the vision costs one line to fix instead of a rework — and it is the best generator of the
  owner's next questions. Unsettled assumptions (fable `PENDING:` lines) are settled here too: each one
  *confirmed / refuted / asked*, never silently dropped.

**A batch of bugs from the owner is one process incident.** When the owner's manual test pass brings a
WAVE of bugs at once, the wave itself is a symptom that the process leaked — worth more than any bug in
it. Fix the bugs; and on the owner's explicit ask ("figure out why so many") open a **process document**
in `plans/` — `owner's verdict (verbatim) → honest diagnosis of the process → remedies as process
changes → steps with checkboxes` — and execute it alongside the fixes. Health metric: the owner's next
wave is SMALLER. If the waves don't shrink, the remedies aren't working — revise them. The goal is not
"zero bugs"; it is "the owner stops finding them in batches."

**Backlog revision skill — `/check-backlog`:** walks `bugs/` and `plans/`, collects everything without a
`DONE` tag as the open backlog, and tags genuinely-closed files DONE (with a status section appended).

**Bug reporting skill — `/report-bug`:** hit a defect during dev/test — file a dedicated md in `bugs/`
by the canon, per `BUG_FIXING_FRAMEWORK.md`. The agent keeps its own bug backlog — one doc per defect,
nothing lost.

**Idea proposal skill — `/propose-idea`:** had a worthwhile idea that fits the master plan and the
human's vision — file it as an md in `ideas/` with status "❓ awaiting human approval." An
agent's idea is a contribution to the product VISION → implement ONLY after the human approves.

---

## Decisions the agent must NOT make alone — interviews

Before a significant new feature, and whenever a brand/UX/architecture fork appears, conduct an
**interview** with the human using the `/interview` skill: closed A/B/C questions, recommendation first,
answered by the human directly in `interviews/interview_NNN_<topic>.md`. Never make UI/UX/brand/
architecture decisions without confirmation. Everything else — decide yourself with sensible defaults
and report in the chat.

Rule of thumb: *is it cheap to reverse?* If yes — decide yourself. If it shapes brand/architecture/UX
for the long term — interview.

**A BLANKET AUTHORISATION GRANTS EXECUTION, NEVER AUTHORSHIP OF IDENTITY** (added 2026-07-29 after
`bugs/07`, which is exactly this mistake). When the owner says «на всё даю добро», «не спрашивай»,
«делай что нужно», he is removing the *confirmation friction* on an action — publish, push, tag,
proceed without coming back for a yes at every step. He is **not** transferring the decisions about
what things are CALLED and how the product PRESENTS itself. These are different objects and a wide
yes to the first is silent about the second:

| | what it is | who owns it |
|---|---|---|
| «публикуй, не спрашивай» | permission to **act** without re-confirmation | his to grant, and he granted it |
| «назови релиз / продукт / фичу» | authorship of the product's **identity** | his, and no width of approval transfers it |

So: **naming is never the agent's** — release codenames, product and feature names, taglines, any
brand-visible string a person reads before they read anything else. Under a blanket yes the correct
move is neither to stop nor to guess: **do all the rest, and ask the one naming question.** A single
pointed question inside work already authorised costs nothing and is not what «не спрашивай» was
aimed at. Where even that is impossible, ship **without** a name — a neutral factual title is always
available and is never a brand claim; a placeholder name is not a fallback, because it is still a
name somebody must later un-choose.

The failure mode this prevents is specific and was observed: the rule above («never make brand
decisions without confirmation») was present, read in-session, and *recalled correctly one message
too late*. It did not fail from ignorance — it failed because a blanket approval was read as
covering it. A rule that fires only after the fact is not a gate, which is why this paragraph exists
next to it rather than as a lesson somewhere else.

**Write-gate on the owner's canon artifacts** (`GOAL.md`, the interview answers, the `MASTER_PLAN.md`
decision log, the READMEs the owner reads — anything where the owner's word IS the content): **new
entities** (mechanics, facts, decisions) enter only through a draft to the owner (interview/chat) and
their "yes" — never straight into the canon; **mechanical edits** under already-accepted decisions
(renames, arithmetic, references, notation) go ahead immediately but stay visible until the owner has
reviewed them. Two-stage control: first the *intent* (before writing), then the *text* (the owner's
read-through). Nothing dissolves into the canon silently, and the corridor for mechanical work stays
wide (see the three-doors rule in `PHILOSOPHY.md`).

**Provenance marks — `[AI]…[/AI]` / `[AI-ed]…[/AI-ed]`** (canonical English strings, grep-friendly,
like `[NOT-TESTED]`). Everything the AI writes into the owner's canon artifacts carries a visible
paired mark: `[AI]…[/AI]` — written by the AI; `[AI-ed]…[/AI-ed]` — the owner's text, edited by the AI.
**A mark IS the acceptance queue:** only the owner's word removes it ("the chapter is accepted") — the
agent NEVER unmarks its own text. One mechanism buys three things: *trust* (the owner sees exactly what
is theirs vs. generated — proofreading becomes scanning marks, not rereading everything), *rollback*
(an unaccepted block is safe to remove), and *safety for future agents* (never take unaccepted `[AI]`
text for the owner's canon). The check is grep-cheap: AI text in a canon artifact without a mark — or a
mark removed without the owner's word — is a fraud `/fable-judge` hunts. Mark at write time; tooling
may mechanize the check later, the convention does not depend on it.

Task-level ambiguity (which of two deliverables did the human mean *right now*) is NOT an interview:
per fable-method Step 0, ask exactly **one pointed question** in the chat that states your recommended
interpretation. Interviews are for vision-level forks that outlive the task.

---

## Code style

The universal baseline:
- Comment all non-trivial blocks and modules — what the code does and why, and what it connects to.
  This is for transparency, traceability, and future maintainability across context-losing sessions.
- No magic numbers — named constants with clear names.
- Prefer the platform/library's idiomatic, built-in way over a hand-rolled mechanism.
- **Canonical order for everything compared or cached:** any output that is diffed, deduplicated, or
  cached must be deterministic — sorts with a full tie-break, serialization with sorted keys, no
  `Date.now()`/random in compared output. Nondeterminism never shows in tests and quietly voids diffs
  and caches on live data — this checklist line notices it so you don't have to. **KPOT lives or dies on
  this:** the dry run must emit byte-identical operations to the real run, the SortPlan is diffed by the
  owner, dedupe groups and the planned scan-map cache are keyed on it — so directory walks are sorted,
  duplicate-group keepers are chosen by a total order (never "whichever the filesystem yielded first"),
  and no timestamp of the run itself leaks into compared output.

JavaScript / Node specifics for KPOT:
- **ESM only**, `.mjs` extension, `node:`-prefixed built-in imports (`import { readdir } from 'node:fs/promises'`).
- **Near-zero dependencies.** Node's own APIs first (`node:fs`, `node:crypto`, `node:path`, `node:test`,
  `parseArgs` from `node:util`). A new runtime dependency is an architecture decision — justify it in the
  `MASTER_PLAN.md` decision log; a native-build dependency needs an `/interview`.
- **Paths are data, not strings to concatenate.** Always `node:path`; never assume `/`. The owner runs
  Windows: handle drive letters, UNC paths, `\\?\` long paths, case-insensitive-but-case-preserving
  filesystems, and reserved names. Compare paths with a normalizing helper in `src/core/`, not `===`.
- **Filenames are not ASCII and not safe.** Cyrillic, emoji, trailing dots/spaces, and 260-char limits
  all occur in real archives. Never destroy a user's original filename — `GOAL.md` requires preserving it.
- **Async and streaming.** Hash and read big media with streams; never load a video into memory. Bound
  concurrency explicitly (a small worker pool) — an unbounded `Promise.all` over a whole drive will
  exhaust file handles.
- **Errors carry the path.** A failure on one file must never abort a whole scan: collect it into the run
  report and continue. A partially-completed apply must be resumable/rollbackable from the journal.
- **Test-status markers** in comments per `TESTING_FRAMEWORK.md`: new code is `[NOT-TESTED]` until an
  observation flips it to `[TESTED: date · how]`.

---

## Notes from the human

Standing guidance from the owner, extracted from `GOAL.md` (2026-07-24) — these are requirements, not
preferences:
- **Never move a user's file before all four safety artifacts exist**: (a) a detailed map of what goes
  where and why, (b) a backup commit the source directory can be restored from, (c) a dry run whose
  report is all-but-identical to the real run, (d) a post-sort report with a rollback path. This is the
  core of the product, not a feature — see `GOAL.md` §"перед тем как инструмент выполнит реальную сортировку".
- **Document every disputed case.** Where the date or the destination is ambiguous, record the conflict
  and surface it in the pre-sort master plan instead of quietly picking a winner.
- **Preserve what the user named.** Custom filenames and meaningful directory names survive the sort.
- **Reuse before writing.** If a GitHub project already solves part of this well, use it for that part;
  write our own `.mjs` only where nothing suitable exists. Record the comparison in `researches/`.
- **KAIF updates are the OWNER's own domain — do not propose them and do not perform them**
  (2026-07-28, verbatim: «мигрировать пока не нужно», «я сам веду обновления КАИф»). A newer KAIF
  release existing is not a task, not a backlog item and not a `/what-next` candidate. Report the
  deployed version if asked; otherwise leave the framework alone and spend the session on the product.
- **The owner is asked through an INTERVIEW, never through a plan or an epic** (2026-07-29, verbatim:
  «и общение со мной - через ИНТЕРВЬЮ, не через эпики. Нужна будет моя точка зрения, развилка
  продуктовая - интервью»). A fork that needs his view goes into `interviews/interview_NNN_<topic>.md`
  via `/interview` — closed questions, recommendation first, answered in the document. Working
  documents in `plans/` (epics, operational plans, research) are the AGENT's; they record what was
  decided and cite the interview that decided it, but they must never carry an unanswered question
  addressed to him. Reason it is a rule and not a preference: a question buried in a 250-line plan is
  a question that does not get asked — the owner reads interviews *as* questions, and plans as work.
- **Research the field before building an epic feature** (2026-07-28, verbatim): «вообще, почти на всё
  в индустрии есть золотые стандарты и научные работы. давай зафиксируем в канон ИИ агента, что перед
  крупными эпик-фичами, нучно проводить гуглёж разветку и написание research документа». Mechanized as
  checklist step 9a and the **prior-art review** artifact above — an epic feature is designed *after*
  reading what the industry and the papers already settled, not from the model's own recollection.

General working rules:
- Always check the current time and the log file's time before reading logs — read fresh logs, not stale ones.
- Work autonomously without interactive questions. If you need information from the human, write an
  interview document and pause the session (so the human is signaled to come answer), rather than blocking.
- If you find bugs in third-party libraries, file tickets for them via `gh` on the human's behalf.
- Actively test what you build, using whatever tooling lets you drive the software effectively.
- Periodically re-read and, where useful, improve your own guidance docs so a fresh session can be
  effective despite context loss. Steer and tune yourself toward maximum effectiveness and autonomy
  toward the stated goal.
