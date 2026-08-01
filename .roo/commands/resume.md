---
description: Resume work where the last session left off — read the key project documents, decide the single most important thing to do now, announce it, and start. Use when the human says "continue", "let's continue", "what's next", "where did we leave off", "resume", "pick up where we left off", "продолжи", "продолжим", "что дальше". Trigger aliases (ru): «продолжи», «продолжим», «возобнови», «на чём мы остановились», «что дальше по работе»
---

# /resume — pick up where we left off

A new session starts with empty context. This skill rebuilds the picture fast and gets to work.

## Step 1. Read ALL the canon documents of the KAIF framework (in parallel)

**Read every canon document — the full set, not a slice.** A session that skips one resumes with a
hole exactly there; owners kept having to re-order the full pass by hand (idea 17 §1):

- `STATUS.md` — current state, what's in progress, the "where to continue" checklist
- `AGENT_GUIDE.md` — the rules for working on this project (the canon)
- `PHILOSOPHY.md` — how the agent thinks: KISS + Occam and the wider principle set
- `BUG_FIXING_FRAMEWORK.md` — how defects are fixed here
- `TESTING_FRAMEWORK.md` — nothing raw is trusted: the `[NOT-TESTED]`/`[TESTED]` contract
- `GOAL.md` — the owner's vision
- `MASTER_PLAN.md` — the long-term plan and phases
- `PROJECT_STRUCTURE_EXTERNAL_MAP.md` — external map: modules, files, data flow
- `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` — internal map: abstractions and interactions
- `KAIF_FRAMEWORK.md` — the deployment record: which KAIF is deployed here and how
- `EXPERIENCE.md` — recall relevant lessons (grep by the task's tags) so you don't repeat a known dead end

If relevant to open questions:
- `bugs/` — `ls bugs/`, open the non-`DONE` bugs

**Then RUN the owner's-queue check — a command, not a glance:**

```bash
npm run review:guard      # both halves: new place-of-questions violations · who waits · STALE statuses
```

This is what makes the place-of-questions rule a gate instead of a paragraph. It exists because the
rule is broken by agents who KNOW it, and because a document whose status still shouts «ЖДЁТ» after
the owner answered makes the next session wait for what was given days ago — which is exactly what
it found on this project the day it was written (interviews #002 and #003, six and three days
stale). Anything waiting → open it as a PAGE (`node tools/review.mjs open <doc>`), never as a
retelling in chat.

> `PROJECT_HISTORY.md` (the chronicle) is deliberately NOT in this set — it is the project's past,
> not its now. Open it on demand when you need the archaeology of a decision or an old phase.

> **Boundary with the context router** (`AGENT_GUIDE.md`): the router's "read only the relevant
> slice" governs tasks INSIDE a session; `/resume` is the session's ENTRY point — the one full pass
> here is exactly what makes the lazy slices safe afterwards. Never "optimize" one with the other.

## Step 2. Synthesize — choose the one main thing

Pick a single direction for this session. Priority (descending):

1. **Open bugs with real symptoms** — if `STATUS.md` lists an open bug with reproducible symptoms, it's
   priority #1. Work by `BUG_FIXING_FRAMEWORK.md`.
2. **Next item from the `STATUS.md` "where to continue" checklist** — if bugs are clear.
3. **Next phase from `MASTER_PLAN.md`** — if the checklist is empty/done.

Before starting, **tell the human in one paragraph**: what you read and the current status; what you
picked as the main thing and why; what you're about to do right now.

Wait for confirmation only if the task is **destructive** or **large and non-obvious**. If the plan is
clear — start right after the short announcement.

## Step 3. Work

Do the chosen task. Along the way:
- Write short updates in the chat (what you're doing, what you found, where you're digging).
- Follow `AGENT_GUIDE.md` (code style, the bug framework, the test harness).
- If it's a bug — keep a log in the relevant `bugs/` file.

## Notes

- Verify the environment before relying on it (build toolchain, devices, services) — see `AGENT_GUIDE.md`.
- Don't re-derive what the docs already state; trust `STATUS.md` and the plans, then verify by doing.
