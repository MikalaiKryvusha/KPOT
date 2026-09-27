# KPOT — Current Status

> This file is read by the AI agent before every task. Update it on every significant change of state.
> It is the PRIMARY handoff between sessions: a new agent session starts with empty context and must be
> able to get productive from this file alone. Write accordingly — concrete, with file paths and commands.
> 🧠 Prime thinking principle — `PHILOSOPHY.md` (SIMPLICITY: KISS + Occam). Read your working framework
> in `AGENT_GUIDE.md`.
>
> ⚠️ **STATUS is a SUMMARY of NOW, not a chronicle** (KAIF 2.1 convention, adopted here 2026-08-01 —
> this file was **1204 lines**, an abyss rather than a summary). The rules that keep it one:
>
> - **Every line passes two tests:** *"if I remove this line, will the next agent make a mistake?"*
>   and *"does a newcomer still read the whole file in one sitting?"* Soft target **~200 lines** —
>   a warning, not a wall, but crossing it means a trim is overdue.
> - **Closed work is MOVED OUT, not accumulated:** when a phase/session entry stops being "now", it
>   moves VERBATIM into `PROJECT_HISTORY.md`. `/end-chat-soft` carries the "bonsai trim" step for exactly
>   this; `/pause` stays ceremony-free by design.
> - **Leave the file the way you'd want to find it:** what works, what's in progress, what's next,
>   the pitfalls, and WHERE TO LOOK for detail — pointers, not retellings.

---
## What was done — the chronicle lives in `PROJECT_HISTORY.md`

Phases 0–6.6, every session from 2026-07-24 to 2026-07-30, releases 0.1 «First KPOT» and 0.2
«Obvius», and the closed-bug roll moved VERBATIM to `PROJECT_HISTORY.md` on 2026-08-01 (the
bonsai trim of KAIF 2.1 <!-- KAIF-VERSION-OK: historical — the trim was done under 2.1 -->: STATUS is the summary of NOW, ~200-line soft target; the chronicle is
not required reading and is opened only for archaeology).

**The state it left behind, in one paragraph:** every phase of the product is implemented and
green — scan · dating · dedupe · plan · backup/dry-run/apply/rollback · the local web interface
(wizard + control panel) · the portable Windows ZIP. Release 0.2 «Obvius» is public. The suite is
the gate (`npm test`), and it has never been red at a commit.

## Where we are now

**Phases 0–4 are CLOSED and Phase 5 is well under way.** `kpot scan` walks a tree and dates every
media file with evidence; `kpot plan` turns that into the pre-sort master plan the owner reads;
`kpot apply` executes it — but only ever after a backup it verified — and `kpot rollback` undoes it
completely. Sorting is idempotent, repeat runs are cheap (the scan cache), emptied folders are
cleaned up reversibly, and folders KPOT cannot judge by name are set aside for the owner instead of
being guessed at.

**KPOT may now write — and every guarantee `GOAL.md` demands before it does exists and is proven.**

**Phase 2 has no cuts left**: THM/XMP sidecar evidence landed 2026-07-28, so every evidence tier
`researches/02` predicted now exists in code. **plans/02 is complete through step 2** — an edited
photo's original is now found by its pixels when it exists.
**Phase 5's acceptance is met** (2026-07-28): a fresh sandbox copy of four real folders was sorted
under supervision — 813 files, 0 failures, the SHA-256 multiset unchanged, rollback rehearsed.
**README + the tagged release are DONE** (`v0.1`, 2026-07-28).

**Phase 6 — the interface — is COMPLETE** (6.0 … 6.6, 2026-07-29): `kpot ui` opens a guide on a
messy folder and a dashboard on a library, with three re-launchable runs, guarded folder links, a
run history with a working undo, the `НОВОЕ` inbox block, a portable package and the plain-language
pass over everything the program says. Suite **300/300** (294 product + 6 for the review contour).

**RELEASE 0.2 «Obvius KPOT» IS PUBLISHED** (2026-07-29, tag `v0.2`) with both artifacts —
`KPOT-0.2.0-win-x64.zip` (33.2 MB, portable) and `kpot-0.2.0.tgz` (165 KB).

**⭐ THE PRODUCT IS IN FIELD TEST WITH REAL PEOPLE.** On 2026-07-30 the owner sent 0.2 to friends:
«отправил на тесты друзьям». This is the first time KPOT has been used by anyone who did not build
it, on machines nobody here has seen, against archives nobody here has surveyed. **Their reports
outrank every item in the backlog below** — see §Where to continue next session.

**The README is a USER MANUAL** (2026-07-30), rewritten in the owner's academic register after his
verdict on the old one: «текущий README считаем устаревшим фродом». Ten numbered sections in both
languages, describing the program as it is rather than how it came to be, with every statement
checked against the code and against a real end-to-end run.

**The framework is KAIF 2.8 «Noble KAIF»** (updated from 2.1 on 2026-09-27 by the owner's direct order
«обнови версию KAIF до 2.8, принимай все новинки» — record in `KAIF_FRAMEWORK.md`, field report in
`reports/KAIF_UPDATES/`). Things a fresh session must know, because they change how you WORK rather
than what the product does:
- **Questions to the owner go through a page, not through chat — the SHIPPED contour since 2.8.**
  `npm run review:guard` (KPOT's own guard: questions outside `interviews/` + stale statuses) ·
  `node .kaif/tools/contour/review.mjs --queue --list` (who waits + the owner's debt) · the page:
  `node .kaif/tools/contour/review.mjs interviews/<doc>.md` plus the waiter `--wait <doc>`, both as
  background tasks (`/interview` Step 4 has the exact launch, his voice `eugene` included). Answers are
  saved ONE AT A TIME and the page lives until its last question — by the owner's own KAIF 2.8 word
  («answers are saved one at a time in every project»), which replaces the old page's «auto-close 2 s».
  Retelling a question in chat instead is the rake agents who know the rule still step on.
- **The home-grown page `tools/review.mjs` now serves only the release notes.** Its look is HIS,
  settled by his own instructions — do not redesign it: «Спрашивает ИИ-агент KPOT · дата, время», two
  pills `ждут вас` / `отвечено`, a second click clears an option, three beeps 880/660/990 and the
  `eugene` voice, the state-coloured stripe. `/release` Step 5.5 puts the notes up there and
  `gh release create` is blocked on `node tools/review-gate.mjs` exiting 0 (interview #004 Q1 = B).
- **New in 2.8 and binding:** the creed and the prayer open `AGENT_GUIDE.md` and are said in the chat
  before non-trivial work · project facts (stands, tools, recipes, the environment dossier, the owner's
  product rules R1–R7) live in `HOUSE_RULES.md` · the closure is `/end-chat-soft` (urgent:
  `/end-chat-force`), `/pause` stays a soft park, `/kaif-go` resumes work in flight · the refresh hooks
  are wired in `.claude/settings.json` · `STATUS.md` is under a size ratchet (`check --gate-budgets`):
  it must SHRINK at every closing until it is under ~200 lines.

| Phase | Status | What's there |
|-------|--------|--------------|
| Phase 0 — foundation | ✅ done | repo, license, KAIF, docs, `npm test` gate |
| Phase 1 — research + decisions + skeleton | ✅ done | researches 01+02, interview #001 ✅, fixtures, CLI, seasons, `src/core/`, `src/meta/` evidence model |
| Phase 2 — scan & metadata | ✅ done (fully closed 2026-07-28) | acceptance spec green; `kpot scan` = assets + evidence + verdicts; the last deferred cut — THM/XMP sidecar evidence — is implemented and proven on real data |
| Phase 3 — dedup & plan | ✅ done | `kpot plan` = SortPlan + owner-facing master plan; acceptance spec green (23 planted destinations + both ambiguities) |
| Phase 4 — safety (backup / dry run / rollback) | ✅ done | interview #002 answered; `src/apply/` = backup + the single writer + rollback; all three acceptance criteria green; guards proven by breaking them |
| Phase 5 — first real use & release | ✅ **done 2026-07-28** · released `v0.1` | ✅ scan cache · ✅ idempotent sorting (bug 01) · ✅ empty-folder cleanup · ✅ the `НА_РАЗБОР/` approval quarantine · ✅ progress output · ✅ resumability · ✅ plans/02 step 1 (editor exports dated honestly) · ✅ THM/XMP sidecar evidence (Phase 2's last cut, closed 2026-07-28) · ✅ plans/02 step 2 (the original found by its pixels) · ✅ the reset-camera-clock rule · ✅ supervised run on a fresh COPY of four real folders (`KPOT_SANDBOX`, 813 files, hashes identical, rollback rehearsed) · ✅ README + `/release` |

Full phase definitions with acceptance criteria: `MASTER_PLAN.md`.

---

## 🎯 The groomed backlog, ranked BY VALUE (2026-07-29)

> Owner's instruction that produced this section: «запланируй автономную работу по грумингу
> ценностей беклога». Ranked by what moves the product toward `GOAL.md`, not by what is easy. Every
> item below is autonomous unless marked otherwise.

| # | Item | Why it ranks here | Blocked by |
|---|------|-------------------|-----------|
| 3 | **A square app icon** | The shortcut currently shows its target's icon. Blocked on a BRAND decision, not on work: the logo is a 1734×907 banner and a square mark out of it is the owner's call (EXP-0023). One line once he supplies one | **the owner** |

**Explicitly NOT on this list, and why** — so a future session does not resurrect them:
- **`plans/02` step 3 (PRNU)** — unstarted and **unauthorised**. It identifies a camera, not a
  photograph. Not a candidate until the owner says so.
- **KAIF framework updates** — the owner runs those himself («я сам веду обновления КАИф»). A newer
  release existing is not a task.
- **Thumbnails** — cut by the owner on 2026-07-29. Wherever an eye is needed, the UI links to the
  folder.

## 🤖 Autonomous backlog pool (no human / no special hardware needed)

Every item the pool held through 2026-07-29 is done — the list moved verbatim to `PROJECT_HISTORY.md`
(entry 2026-09-27, bonsai trim). The pool is EMPTY: new autonomous work comes from the Google Photos
optimizer epic once the owner has answered its interview (see «Where to continue»).

---

## Where to continue next session

> A concrete checklist so the next session (empty context) can start immediately: which files, which
> commands, what to verify first.

0. **FIRST, before anything else — run the owner's-queue check.** It is one command and it is what
   makes the place-of-questions rule a gate rather than a paragraph:
   ```
   npm run review:guard     # new violations · who waits · STALE statuses · the debt number
   node .kaif/tools/contour/review.mjs --queue --list   # who waits · the owner's debt (answered, not applied)
   ```
   Anything waiting → open it as a PAGE (`/interview` Step 4: the shipped contour + the `--wait` waiter), never
   as a retelling in chat.
1. Verify the environment: `node -v` (≥20), `npm test` (**must be 301/301**), `git status` (clean),
   `gh auth status` (MikalaiKryvusha). Owner-provided paths from this file are PAST observations —
   re-check they still exist before planning around them (EXP-0011: a sample vanished once already).
2. **Run the whole product once, end to end, before designing on top of it.** It all works now:
   ```
   node tests/fixtures/make.mjs <tmp>          # fixture v6: 47 planted files + expected.json
   node bin/kpot.mjs plan <tmp>                # the owner-facing master plan
   node bin/kpot.mjs apply --dry-run <tmp>     # full simulation, zero writes
   node bin/kpot.mjs apply <tmp>               # the real sort (backup first, always)
   node bin/kpot.mjs rollback <run-id> <tmp>   # everything back where it was
   ```
   There is also a REAL sandbox, left sorted for the owner to look at:
   `D:\work\ai_sandbox\KPOT_SANDBOX` (813 files / 943 MB, four real folders; the owner authorised
   the copy on 2026-07-28). Undo it with
   `node bin/kpot.mjs rollback run-20260728-201538-437c4d D:\work\ai_sandbox\KPOT_SANDBOX`.
   Do not delete it without his word, and never copy more of his photographs without a fresh one.
3. ⭐ **THE ACTIVE EPIC — the Google Photos optimizer** (`plans/10_EPIC_google_photos_optimizer.md`,
   the owner's `ideas/03`, started by his order of 2026-09-27: «Берем в эпик планирование и проработку …
   Устаканиваем Требования к Гугл Оптимизатору внутри KPOT»). Rung 1 is done —
   `researches/10_google_photos_optimizer_prior_art.md` (industry sweep + local recon + requirements; the
   headline: the official API cannot list or delete, web automation conflicts with Google's terms and risks
   the whole account, the 30-day trash, what a re-upload loses, several of his video rules need rework).
   **Waiting: interview #005** (10 questions, the requirements) — shown on 2026-09-27 with its picture page
   `interviews/interview_005_explain.html`. **Next:** apply every answer into §3/§2 of the epic with
   «interview #005, QN», mark each with `--mark-implemented`, then write the operational plan of Phase 1
   (test-account recon + encoder calibration) as `plans/11_epic10_phase1_<name>.md` and start it. Nothing
   touches the owner's Google account before Phase 1's numbers are shown to him.
4. **THE PRODUCT IS OUT WITH FRIENDS FOR TESTING — THEIR REPORTS COME FIRST WHEN THEY ARRIVE.** On
   2026-07-30 the owner wrote «отправил на тесты друзьям»; nothing has come back as of 2026-09-27. His
   order of 2026-09-27 started the optimizer epic, which supersedes the old «do not start a new feature»;
   a friend's report still outranks the epic the day it lands. Ask him what came back.

   **Why this outranks everything below.** Every defect this project has ever found that mattered
   came from contact with reality, not from the suite: `bugs/01`–`04` from the first real run,
   `bugs/05` from measuring the inbox, `bugs/06` from finally RENDERING the page after six phases of
   green specs. A friend's machine adds three things no fixture here has: **a clean Windows** (this
   development machine has both relevant defences disabled by policy, which is why the first-launch
   warning is still unverified — §10.2 of the README says so out loud), **an archive nobody
   surveyed**, and **a person who has not read a single document of ours**. Expect the failures to
   be in the first sixty seconds — download, unpack, the security warning, the first screen — not in
   the date logic.

   **When a report arrives, do this:** reproduce it on a FIXTURE first, never on their photographs;
   file it with `/report-bug` (the backlog is `bugs/`, numbering continues from 08); if it is a
   first-launch or packaging problem, remember the package is built **only from PowerShell**
   (EXP-0027). If a friend's archive must be examined, that needs the owner's explicit word and
   their own — the standing rule about his photographs applies to theirs with more force, not less.

   **The next piece of work is genuinely open.** Nothing is ranked and unblocked. Candidates, none
   started: the clean-machine acceptance of the package (his, `plans/09` §9) · a square app icon
   (his, a brand decision) · `plans/02` step 3 (PRNU) which is **unstarted and unauthorised** ·
   whatever the owner finds when he actually uses 0.2 on his archive. **Ask him rather than
   inventing one** — and note that a first real run of the WINDOW on his 551 GB archive is the most
   valuable observation available, since every real-data session so far has found defects no
   fixture could.

   `researches/09` §6.2's requirement is already discharged in BOTH places it names — the package's
   own `ЧИТАТЬ.txt` (built by `tools/build_package.mjs`) and the README's download section: the
   Windows first-launch dialog is named in the words Windows itself uses, with why it appears and
   which button to press. We cannot promise silence on anybody's machine; the product warns instead
   of hoping. Keep that paragraph in any release notes too.

   **KEEP LOOKING AT THE PAGE** — the headless browser over CDP is a stand now: `HOUSE_RULES.md` §3 (EXP-0024).

   **Two items are open for the owner, not blocking:** the clean-machine acceptance of the package
   (he chose to do it at a friend's, «сильно позже» — exact steps in `plans/09` §9, and it MUST
   print the two attachment-policy values first or the result is unreadable), and a square app icon
   (a brand decision — EXP-0023).

5. **Writing to the owner's REAL archive still needs a fresh `AUTH:`** — the standing grant is
   READ-ONLY, and it is the archive, not a copy. Everything measured this session was read-only.
5b. **Do NOT propose or perform a KAIF update** — the owner runs framework updates himself
   («я сам веду обновления КАИф», 2026-07-28); the 2.8 update of 2026-09-27 was his direct order. A newer KAIF release existing is not a task, not a
   backlog item and not a `/what-next` candidate. Related: `plans/01_kaif_16_update_report.md` is a
   FINISHED report addressed to the KAIF framework's own agent, not open work — `/check-backlog`
   should stop counting it as an open item.
6. **One owner question set is open: interview #005** (the optimizer's requirements, item 3). Every
   earlier fork is answered. Also waiting for his *review*, not a decision: the sorted sandbox, and the
   plans/02 result (95 editor exports → 1 dated by pixels because the other originals are not in the
   archive; in the sandbox, where they are, 4 of 4).
7. Decisions are all in `MASTER_PLAN.md` §Decision log — re-read before designing; do not re-ask the
   owner what is already settled there.
8. Before writing any new guard, re-read `EXPERIENCE.md` EXP-0008 (a guard that passes for the wrong
   reason — it happened again this session and the spec had to be rewritten), EXP-0009 (invisible
   characters in generated source) and EXP-0015 (a corpus statistic set BY the anomaly it targets).

---

## Open bugs

- `bugs/09_owner_review_contour_silent_answer_loss.md` — 🔬 news from a sibling project: a review page can
  silently lose the owner's answers. **For interviews the risk is closed by switching to the shipped
  contour** (KAIF 2.8: answers saved one at a time, a browser draft, a server pulse, infinite patience —
  its selftest, 111 checks, covers exactly these). Still open for the home-grown `tools/review.mjs`, which
  now serves only the release-notes approval: run the bug's 5-minute probe on it before the next release.

The roll of everything closed so far lives in `PROJECT_HISTORY.md`.
