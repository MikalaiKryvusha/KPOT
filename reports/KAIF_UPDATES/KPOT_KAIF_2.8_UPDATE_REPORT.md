# KPOT — KAIF 2.1 → 2.8 update — field report

**Delivered upstream:** https://github.com/MikalaiKryvusha/KAIF/issues/129

- **Project:** KPOT (Node ESM CLI + local web UI, Windows 11, `language: ru`, 5 agent systems, `tracking: origin`)
- **Date:** 2026-09-27 · **Agent:** Claude Opus 5.5 (1M context), Claude Code in VS Code
- **Owner's order (chat, verbatim):** «обнови версию KAIF до 2.8, принимай все новинки, которые приносит КАИФ»
- **Hop:** 2.1 → 2.8 in one step (seven versions)

## 1. Chronology with numbers

1. Pre-flight: tree clean at `0c54f64`; `npm test` 301/301.
2. Route chosen: **bootstrap with the thin KAIF.md v2.8 + loader**, because the 2.8 notes say that only the 2.8 core applies the "lose nothing silently" machinery; the deployed 2.1 core would have run the old logic.
3. **Sandbox rehearsal:** `git clone --no-hardlinks` of the repo, then the real loader run in the clone (`node KAIF-LOADER.mjs --lang ru`) → exit 0.
4. Live run → exit 0. The live changed-file set and the generated `KAIF_UPDATE_TASK.md` were **byte-identical** to the sandbox's (`diff` of `git status --short` and of the task file: 0 lines).
5. Machinery counters (`.kaif/last-update.json`): **31 replaced · 44 modules merged in place · 39 added · 28 kept · 6 adopted**; 1 deprecated artifact kept with local edits (`/end-chat`); task: 15 items, 20 modules awaiting a hand merge.
6. Mechanical pass committed alone (`e7711f8`, 119 files, +22 107 / −839); `npm test` 301/301.
7. Hand work (`ddac62e`, 138 files): 20 module merges (14 in `AGENT_GUIDE.md`); `HOUSE_RULES.md` created (harness commands, tools table, push recipe, environment dossier probed in PowerShell 5.1 and Git Bash separately, the owner's product rules); `/end-chat` retired in all five systems with its local adaptations moved into `/end-chat-soft` and `/end-chat-force`; the shipped contour adopted for interviews; refresh hooks wired; 6 stale-claim lines fixed or marked `KAIF-VERSION-OK`.
8. Gates at the end: `check` — manifest satisfied (103 files + 152 agent artifacts), 0 drifted mirrors after `sync`; `stale-claims` — 0 lines; `kaif-attribution-lint` — 0 new, 12 inherited recorded as baseline; `check --gate-budgets` — STATUS 425/200 recorded as debt, then trimmed to 226 lines (211 lines moved verbatim to the chronicle, 0 lost by a line-set check); `kaif-experience-lint` — OK after the first `class:` entry; `.kaif/tools/contour/review.mjs --selftest` — 111 checks green; `npm test` 301/301.
9. Judge: clean-context `/fable-judge` subagent → **VERIFIED WITH CAVEATS** (2 MEDIUM, 5 LOW); all 7 fixed before this report (§5).

## 2. Rakes

**R1 — `stale-claims` misses a version claim followed by a codename in guillemets (MEDIUM).**
Evidence: `STATUS.md:70` read `**The framework is KAIF 2.1 «Strong KAIF» and the OWNER-REVIEW CONTOUR is live**`; `node .kaif/kaif-core.mjs stale-claims` printed `0 line(s)` over it. The judge found it. Cost: the first file `/resume` reads would have told the next session the wrong framework version. Repro: put that line in a root `*.md` and run `stale-claims`.

**R2 — nothing scans for RETIRED COMMANDS / skill names in living docs (MEDIUM).**
Evidence: after `/end-chat` was retired and the interview route moved to the shipped contour, `STATUS.md` still said "the heavy closure is `/end-chat`" and routed questions through `node tools/review.mjs open`; `withdrawn-phrases` searched only `DELIVERY:` / `SYSTEMS_REGISTRY` / `delivery metric`. Cost: a stale route in the entry document; caught only by the judge. Wish W1.

**R3 — `check` prints "HOUSE_RULES.md (no file yet: cp …)" when the file exists (LOW).**
Evidence: after `HOUSE_RULES.md` was created, `node .kaif/kaif-core.mjs check --gate-budgets` still printed `HOUSE_RULES.md (no file yet: cp .kaif/_house-rules-template.md HOUSE_RULES.md)` in the STATUS overflow line; the judge located the string as hard-coded in `.kaif/kaif-core.mjs` (lines ~140/142). Cost: a confusing instruction. Repro: create the file, run `check --gate-budgets` with STATUS over budget.

**R4 — language-mix warning on an English-by-policy skill set (LOW).**
Evidence: `⚠ language mix: 3 of 37 skills are a MIX — … interview (100 % foreign), release (98 % foreign), resume (100 % foreign)`. All 37 skills are English by policy on a `ru` deployment; "100 % foreign" plus "MIX" reads as a contradiction. Cost: noise. Repro: a `ru` deployment whose three skills carry local edits.

**R5 — `settings-fragment.json` uses `command` + `args` (LOW, known elsewhere).**
Evidence: the fragment ships `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/…"]`; a sibling project on the same machine (ndim, `.claude/settings.json` `_kaif_hooks` note) records that the documented Claude Code hook schema has no `args` and wires one-line commands. Wired here the same way: `"command": "node \"$CLAUDE_PROJECT_DIR/.kaif/hooks/<script>.mjs\""`; all five scripts exit 0 on empty input and inject on realistic input. Cost: none here; a risk for projects that copy the fragment verbatim.

**R6 — `diff --source .kaif/install --render` refuses the install directory (LOW).**
Evidence: `✖ not found in source: .kaif\install\kaif-manifest.json` — the bundle sits in `.kaif/install/` but the manifest does not, so the reference render needed a hand-assembled directory (manifest + core + bundle). Cost: 2 minutes. Repro: run `diff --render` against `.kaif/install` right after an update.

**R7 — the creed placeholder vs the owner's own wording (INFO).**
The template creed renders "BELIEVE IN THE PRODUCT AND IN <AUTHOR>'S VISION…"; this owner already has his own Russian wording in other projects («ВЕРИТЬ В ПРОДУКТ И В ИДЕЮ НИКОЛАЯ…», ndim commit `902796c6`). Used verbatim here instead of a fresh translation. Nothing in the task pointed at an existing owner rendering.

## 3. Exercised vs NOT

**Exercised:** bootstrap route with sandbox rehearsal; module merges by hand over the task diffs; `sync`; `project-name`; `stale-claims`; `check`, `check --gate-budgets` (ratchet record); `kaif-attribution-lint --write-baseline`; `kaif-experience-lint`; the shipped contour's `--check`, `--queue --list`, `--search`, `--selftest`; the refresh hooks by hand (timer, resume word, owner word).
**NOT exercised:** `--rehearsal <receipt>` binding (the sandbox used its own clone, the live run was not bound to its receipt); `/team-deployment`; the voice linter (no portrait — `SKIPPED`); a live contour page shown to the owner (next in this session); the `PreToolUse` hook against a real mid-turn owner message; `kaif-guard-lint`, `kaif-scenario-lint`, `kaif-requirements-lint`, `kaif-ranking-lint`, `kaif-testrun-lint`.

**Policy changes 2.2–2.8 accepted by the owner's blanket word** (recorded `[AI] by mandate — «принимай все новинки»` where a separate owner decision was named): CLI safety; guard exit 3 = SKIPPED; `REQUIREMENTS_FRAMEWORK.md`; context refresh + hooks (wired); environment dossier (filled); language packs frozen (n/a, ru); `/end-chat` split; timed-run contract; KAIF-ticket carve-out; FORK lines; guard second half; guarded-loop boundary; sized incident response; `report` command; team defaults (not deployed); update behaviours; customer's-language questions; real-world done; `/what-next` form; DELIVERY (arrived and retired within the hop — nothing to remove); shipped contour (adopted for interviews; the home-grown page kept only for release-notes approval); confusion → research; authorship of decisions; provenance legal in drafts; test-run reports; voice contract (no portrait); handover wording; "test" definition; KAIF-ticket delivery; contour close command and profile; archaeology axis; `check` budget semantics; field-report delivery; budget ratchet; answers saved one at a time; the call; tester bug form; archive declaration (not used).

## 4. Wishes (by cost, descending)

- **W1.** Extend `withdrawn-phrases` (or add `retired-names`) to list the skills and commands a release RETIRES (`/end-chat` in 2.4) and grep the living docs for them, `STATUS.md` first — R2 would have been caught by the machinery instead of the judge.
- **W2.** Make the stale-claims pair matcher accept a trailing codename («Strong KAIF») — R1.
- **W3.** Ship the settings fragment in the one-line `command` form, or document which agent-system version accepts `args` — R5.
- **W4.** Let `diff --render` accept `.kaif/install` right after an update (copy `kaif-manifest.json` there) — R6.
- **W5.** Read `HOUSE_RULES.md` existence before printing "no file yet" — R3; and say "English skill on a ru deployment (by policy)" instead of "MIX 100 % foreign" — R4.
- **W6.** When the task seeds the creed, look for the owner's existing rendering in sibling deployments or ask once — R7.

## 5. Final state and the judge verdict

State after the fixes: `.kaif/kaif.json` version 2.8; `check` green, 0 drifted mirrors; `stale-claims` 0; attribution 0 new; experience lint OK; `npm test` 301/301; no product code changed (`git diff e7711f8~1 HEAD --stat -- src bin tests tools` empty).

Judge verdict, verbatim (clean-context `/fable-judge`, scratchpad `judge_kaif28_verdict.md`):

> **VERDICT: VERIFIED WITH CAVEATS**
>
> Every claim the update's judge item depends on reproduced: the version is recorded, nothing the owner wrote was lost, the merges are real, the gates pass and no product code changed. The verdict is not REFUTED for that reason. There are two MEDIUM findings. Both are stale pointers outside the merged modules, and both mislead the next session. Claim 4, read as written, FAILS at STATUS.md:88. Fix both findings before the field report quotes this verdict.

Fixes applied after the verdict: F1 (STATUS version line, interview route, `/end-chat` → `/end-chat-soft`), F2 (`sync` re-synced 175 mirror copies; `check` 0 drifted), L1 (this report lists the policies), L2 (hooks recorded as `[AI] by mandate`), L3 (R5 exception «по возможности» from `GOAL.md`; the agent's own hygiene rules split out as `[AI]` R7), L4 (the `review:list` row restored), L5 (first `class:` entry, EXP-0031).

## 6. Addendum (after delivery, 2026-09-27) — why `update-verify` lists 236 upstream lines as absent

All 236 are conscious divergences, none a lost rule (every NEW rule of the diffs is present on disk, reflowed):
1. **Reflowed paragraphs** — the hand merges re-wrapped the template's new paragraphs to the guide's line width, so a line-level match fails while the text is there (e.g. "Authorship of a decision", "Showing is an action", "The agent's confusion…", the scenario/vocabulary rule).
2. **The creed and the prayer in the owner's language** — the creed is the owner's OWN Russian wording (ndim commit 902796c6, byte-equal per the judge, claim 7); the prayer body is the ru pack's rendering, said to the owner in the chat. The English template lines are therefore absent by design; the section heading is kept in English so the machinery finds it.
3. **Template placeholders replaced by the project's own values** — `<BUILD_COMMAND>` (KPOT: no build step, `npm test`), `<State your branching policy…>` (main only, kept verbatim), `<Describe the tooling…>` (KPOT's harness principle kept), `<High-signal guidance…>` (the owner's notes, kept in rule form), `**RULE:** <state the key invariant>` (KPOT's RULES 1–3 kept), `Co-Authored-By: <YOUR AGENT/MODEL>` (filled).
4. **KPOT canon that supersedes the template's narrower text** — "Three artifact types" (KPOT keeps FOUR: the owner's prior-art review, checklist step 9a, 2026-07-28); the recon-doc and canon-map examples (KPOT's own examples kept); the "RPG" worked example of another project (not KPOT's domain); the `# kpot` H1 (the canonical name is KPOT, recorded with `project-name`).
5. **Loops (dayloop 5, nightloop 5)** — the template's `build (<BUILD_COMMAND>) → deploy` line and a reflow of the one-step rule; KPOT keeps "no build step — run `npm test`" and the same one-step rule text.
6. **/resume (2)** — the "This list is guarded" note was merged in a shortened form (the field-story clause moved out, per 2.8's "rules stay, stories go to KAIF_REFERENCE §17").

Also found after delivery: **R8 — `update-verify` fails on a section heading rendered in the owner's language** (`✖ a section of this release did not arrive: AGENT_GUIDE.md :: ## 🙏 THE PRAYER BEFORE WORK` while the section stood under «## 🙏 МОЛИТВА ПЕРЕД РАБОТОЙ»); fixed by keeping the English heading above the Russian body. Wish: match `sectionsNew` by the anchored block (`KAIF:PRAYER:BEGIN`) when one exists, not by heading text. Final: `update-verify passed`.
