---
name: release
description: Build a release candidate and publish it to GitHub Releases — pre-check, refresh README (and bilingual copies), regenerate rendered docs, version bump + build + tag + push + GitHub Release. Use when the human says "make a release", "ship a release", "cut an RC", "publish a new version", "release", "ship it", "сделай релиз", "выпусти релиз". Trigger aliases (ru): «сделай релиз», «выпусти релиз», «опубликуй новую версию», «отгружай»
---

# /release — publish a release to GitHub

The human asks to ship a new version. This is an **irreversible external action** (a public tag +
GitHub Release). Run the routine **in order**; narrate each step in the chat. If a step fails — stop,
show the error, do NOT continue blindly.

> ⚠️ **CONFIRMATION REQUIRED.** Before the publish itself, show the human: which version it'll be
> (current → new), that the tree is clean, that it built. Publish only on their explicit "yes". A release
> = a public tag and Release, unpleasant to roll back. **In autonomous mode (`/autoloop`/loops) do NOT
> publish a release.**

## Step 0. Decide the bump type and the codename

Confirm with the human (or confirm the default): patch / minor / major. State the current → new version.

**Every release gets a short codename** (a memorable one- or two-word name for the theme, e.g. *Anonymous*,
*Slim*, *Savvied*). The codename drives the release **title** and headline — see Step 6.

> 🛑 **HARD STOP — THE CODENAME IS NEVER THE AGENT'S TO INVENT.** It is a BRAND decision, and
> `AGENT_GUIDE.md` §Decisions the agent must NOT make alone puts brand first on the list of what an
> agent may not decide alone. Exactly one of these may happen:
>
> 1. **The human names it** — quote his words, and record the source beside the name («owner, chat,
>    2026-07-29») the way a research claim carries its link.
> 2. **You propose 2–3 and he picks one.** A proposal is not a decision; shipping your proposal
>    because he did not answer *is*.
> 3. **It ships with NO codename** — a neutral factual title (`KPOT 0.2`) — which is always available,
>    never a brand claim, and the correct fallback when he is away or busy.
>
> **A blanket approval does NOT dissolve this gate.** «На всё даю добро», «не спрашивай», «делай что
> нужно» authorise the ACTION (publish, tag, push without re-confirmation); they do not transfer
> authorship of what the product is CALLED. Under a blanket yes: do every other step, and ask this
> one question — it is a single line and it is not what «не спрашивай» was aimed at.
>
> A placeholder name is **not** a fallback: it is still a name somebody must later un-choose.
>
> Why this is a hard stop and not advice: `bugs/07`. This step already said "ask the human for it",
> was read in-session, and was skipped anyway under a blanket «ДА, ДОБРО» — the release shipped
> publicly under a name the owner first saw as a fait accompli, and his answer was «Было принято
> бренд решение без владельца.» The instruction was present; what was missing was the refusal.

## Step 1. Pre-check the environment (don't release on a dirty/broken tree)

```bash
git status --short          # tree must be CLEAN (except gitignored artifacts)
git branch --show-current   # the release branch (e.g. main)
git pull --rebase           # so the push is fast-forward
gh auth status              # gh logged in (needed for the GitHub Release)
```
If the tree is dirty — commit/sort it out first (`/pause` or your commit tool).

## Step 2. Refresh README (all languages)

Bring `README.md` in line with reality: phase status, working features, instructions. If bilingual, keep
both languages in sync. Don't invent — reflect only what's actually done and verified (cross-check
`STATUS.md` and the closed `bugs/`/`ideas/` `*_DONE_*`).

## Step 3. Regenerate rendered docs

`<Regenerate any rendered artifacts, e.g. README.pdf (node tools/readme-pdf.mjs). For this framework's
own project, also regenerate the self-extracting core: node tools/build-framework.mjs.>`

## Step 4. Control build (before the release)

KPOT has no build step (pure Node ESM). The control gate is `npm test` — it must exit 0. Also smoke-run
the CLI once over a fixture tree (`node bin/kpot.mjs plan tests/fixtures/<case>`) so the shipped entry
point is known to start. Do this BEFORE the version bump, so you don't leave a half-released version.

## Step 4.5. Judge pass — MANDATORY adversarial verification before publishing

Run `/fable-judge` over the release candidate's own claims: every statement in the README/notes about
what works is re-run or re-opened (build, self-checks, artifact list, versions, links), and the change
set is diffed against the release's declared scope. The verdict must be **VERIFIED**, or **VERIFIED WITH
CAVEATS** with every caveat explicitly carried into the release notes. **REFUTED blocks the release** —
fix and re-judge before proceeding. (A release is the one artifact whose false claims the whole world
downloads.)

## Step 5. Commit the doc/build changes (before the release)

Commit the README/docs updates so the `release: X.Y` commit is a clean version bump:
```bash
git add -A && git commit -m "<msg>" && git push "docs: README for release X.Y"
```

## Step 6. Publish (after the human's confirmation)

`<Run your release flow. If you have a release tool (e.g. tools/release.mjs that bumps the version,
builds, renames the artifact, commits "release: X.Y", tags vX.Y, pushes, and runs gh release create),
run it. Otherwise, do it explicitly:>`
```bash
# bump version (in version.json or your manifest), then:
git commit -am "release: X.Y" && git tag vX.Y && git push && git push --tags
gh release create vX.Y --title "<PROJECT> X.Y — <Codename>" --notes-file <NOTES.md> <ARTIFACT(S) if any>
```

> 📛 **Release title — FIXED FORMAT (CANON):** `<PROJECT> X.Y — <Codename>` — the project name, the
> `major.minor` version, an em dash `—`, then the Step-0 codename. Examples: `KAIF 1.2 — Anonymous KAIF`,
> `KAIF 1.3 — Slim KAIF`, `KAIF 1.4 — Savvied KAIF`. **Not** `vX.Y`, no guillemets, no quotes. Keep it
> consistent with every prior release (check `gh release list`).
>
> 📝 **Release notes — BILINGUAL and about the DELTA (do NOT `--generate-notes`).** Write real notes and
> mirror **every language the README ships in**, with in-page language anchors/toggles, matching the house
> style of previous releases (check the last release's body with `gh release view <prev> --json body -q .body`
> and follow its shape). Structure per language: a header line (release date · place), a one-paragraph
> "what this release is", **a LINK to the README** for what the product is, the attached artifacts, a
> **✨ What's new** section, and a short **🚀 Get started**. Write the notes to a file and pass `--notes-file`.
>
> 🚫 **THE NOTES ARE NOT A COPY OF THE README.** They answer *«what changed, and should I update?»*;
> the README answers *«what is this and how do I use it?»*. When both need the same paragraph — the
> product description, the full install instructions, the platform warnings, the feature tour — the
> notes **link**, they do not repeat. Concretely, do not paste into the notes: the "what the product
> is" tour, the safety/feature bullets that already live in the README, or the full get-started
> section (one download line plus one command is enough).
>
> Why this is written here: release 0.2 shipped with notes that were **34 KB and nearly a copy of the
> README**, and the owner's verdict was «зачем в релиз ноутсы попала почти вся копия README - это
> НЕПРАВИЛЬНО!». Rewritten to 12 KB of pure delta. The old wording of this very step — "a short *what
> X is* paragraph … and a 🚀 Get started section" — is what invited the duplication, so it is fixed at
> the source rather than left as a matter of taste. **Sanity check before publishing: if a paragraph
> could be pasted into the README unchanged, it belongs in the README, not in the notes.**

## Step 6.5. The deploy checklist (when shipping replaces a RUNNING system)

If this release includes deploying over a live server/container/service, walk five gates — each exists
because skipping it took down a real prod:

1. **Deploy mirror first.** Capture the ACTUAL configuration of the running prod BEFORE replacing it
   (inspect/env/version) — prod often lives with settings no document remembers, and a blind redeploy
   "by the docs" silently changes behavior (or points prod at a dev emulator). Every difference between
   the old run and the new one must be a conscious, named decision.
2. **Live smoke.** Start the new instance and read its first working cycle in the log with your eyes
   (`TESTING_FRAMEWORK.md` → observation gates).
3. **Artifact self-sufficiency.** The image/bundle starts in isolation, all modules present — an image
   that lagged behind the code has downed prods with every test green.
4. **Domain invariants.** Before the switch, write down the numbers that must not change (counts, sums,
   sizes); after it, compare them.
5. **Prod-run document.** After the deploy, update the repo's "production run" document — the single
   source of truth for how prod is actually launched. A prod config living only inside a running
   process is a mine the next session steps on.

> **For KPOT** there is no server: the "running system" this release replaces is the tool the owner runs
> against a **real 551 GB archive**. Read the gates that way — (1) mirror = confirm what the previously
> shipped version actually did to a tree before changing it; (2) live smoke = run the new build against
> `tests/fixtures/` end-to-end and read the output with your eyes, never just the green suite;
> (3) self-sufficiency = `npm pack` / a clean `npm i -g` install starts with no dev tree present;
> (4) domain invariants = file counts, total bytes and hash-group counts before vs. after a dry run —
> they must be identical, and a real run must move exactly what the dry run planned; (5) the prod-run
> document is `README.md` + `AGENT_GUIDE.md`'s harness table.

## Step 7. Verify and report

```bash
gh release view vX.Y        # the release exists, artifacts attached
git log --oneline -3        # the release commit + tag are visible
```
Report to the human: the version, the release link, what was attached. Done.

## Notes
- Releases bump minor/major; ordinary in-progress commits bump the build/patch.
- If the push is rejected (non-fast-forward) — `git pull --rebase` and retry. On step 6 this is critical:
  a tag may already exist locally — check `git tag` and `git tag -d vX.Y` before retrying.
- NEVER force-push and never delete others' tags/releases. If something goes wrong during publish — stop
  and show the human, don't "fix" it blindly.
- Don't release in autonomous mode — only on the human's explicit request.
