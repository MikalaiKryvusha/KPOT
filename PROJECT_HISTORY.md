# kpot — Project History (the chronicle)

> The APPEND-ONLY chronicle of how this project lived and grew: closed sessions, shipped phases,
> releases, big decisions in the order they happened. This is where `STATUS.md` sheds its past —
> STATUS stays a short live summary of NOW; everything finished moves HERE (the "bonsai trim" step
> of `/end-chat`).
>
> **Not required reading.** This file is NOT part of `/resume`'s canon set and not in the
> before-every-task minimum — open it only when you actually need the archaeology: how a decision
> came to be, what an old phase contained, when something shipped.
>
> **Chronicle rules (ADR discipline):**
> - **Append-only, newest on top.** A recorded entry is never edited to say something else —
>   history that can be rewritten is not history. Corrections come as NEW entries that reference
>   and supersede the old one.
> - An entry moves here VERBATIM from `STATUS.md` when its work closes — move, don't rewrite;
>   the entry already carries its dates, counters and file pointers.
> - Entries mention versions and dates freely — a chronicle legitimately speaks of old versions,
>   and the update machinery's stale-claims scan knows to leave this file alone.
> - When the file grows unwieldy, split by era: keep the newest era here, move older ones to
>   `PROJECT_HISTORY_<era>.md` files, and leave a one-line index at the top of this file
>   (the pattern large changelogs use).
>
> Living document — never DONE-tagged.

---

## Entries (newest first)

### Session of 2026-08-01 — KAIF 1.6 → 2.1, and the owner-review contour

Two things the owner ordered in one line: «тогда делай обновление KAIF до версии 2.1 из origin.
потом контур вычитки по опыту NDim проекта». Both done; suite 294 → **300**.

- **KAIF 2.1 «Strong KAIF» is deployed** (bootstrap route, predicted on a sandbox copy that matched
  the live pass exactly). Owner documents and product code: zero changes. Skills 26 → 34. STATUS
  1204 → ~470 lines — the chronicle moved verbatim into the new `PROJECT_HISTORY.md`. Full record:
  `KAIF_FRAMEWORK.md` §Обновление 1.6 → 2.1. **This was a one-time order, not a licence** — his
  standing «я сам веду обновления КАИф» still holds.
- **The owner-review contour is BUILT** — `/owner-reviews`, ported from the field-proven NDim
  implementation on his instruction («точно так же сделать») and to the executable contract in
  `d:\work\ai_sandbox\ndim\researches\28_owner_reviews_contour_field_report.md`:
  - `tools/lib/review-core.mjs` — one normalization/hash contract for page and gate, the document
    parser, decisions written to THREE places, quiet hours, a 45-check self-test;
  - `tools/review.mjs` — the page (both OS themes, state-coloured stripe, «ждёт вас»/«отвечено»
    tags, second click clears a choice, embedded audio/images/live mock-ups, auto-close 2 s in an
    app window), the localhost server, the signal (three beeps 880/660/990 + Silero voice borrowed
    from KLAS, SAPI fallback), `queue`/`batch` for autonomous loops;
  - `tools/questions-guard.mjs` — the place-of-questions guard with a **baseline ratchet** (debt 2,
    must go down) and the **stale-status** detector;
  - `tools/review-gate.mjs` — the fail-closed send gate, **wired into `/release`**: the notes body
    is an artifact the owner approves on the page, and `gh release create` is blocked on the gate's
    exit 0. An edit to the notes after his click voids the approval automatically.
  - **It paid for itself before its first page existed:** the guard found interviews **#002 and
    #003** still marked «❓ ОЖИДАЕТ ОТВЕТА ВЛАДЕЛЬЦА» six and three days after the owner had
    answered them in chat. Both statuses corrected.
  - **The first full cycle passed with ZERO clarifying questions in chat** — the acceptance
    criterion of `/owner-reviews`. Interview **#004** was opened by the contour, answered by one
    click per question, recorded in three places with `by`/`at`, and the contour TERMINATED, which
    is what woke the agent (invariant I8, working in the field on the first try). His answers:
    Q1 = B (wire the gate into `/release` — done) · Q2 = A (close the place-of-questions debt in
    place — done, 2 → 0) · Q3 = A (keep the three beeps and the `eugene` voice — unchanged).
  - **Honest gap:** no browser-driven QA run (that would need Playwright — a dependency this project
    does not have). Covered instead by 6 specs incl. an end-to-end over HTTP; NOT covered by machine:
    the click mechanics and the two themes as PIXELS. The owner has now used the page for real, so
    the click mechanics are field-confirmed; the themes as pixels remain unverified.

### The owner's forks, as they were answered (moved out of STATUS 2026-08-02 — every one is ✅)

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
- ✅ **The interface — FULLY ANSWERED 2026-07-28** (`ideas/02_electron_gui.md`; question 1 was
  answered 2026-07-26 with «после Фазы 5»). It is a **local Web UI**, not Electron and not Tauri,
  **plus an installer that puts a desktop shortcut** which starts it and opens the browser. Full
  scope (scan → plan → apply → rollback), planned **epic → phases → operational plans**. Audience:
  the owner AND inexperienced PC users, so UI, installer and every printed string must be friendly,
  foolproof and free of jargon and slang. Needs a `/revision` for an interface phase and an epic
  document before any code.
- ✅ **Russian device-folder names — ANSWERED 2026-07-26** by the owner's choice of the "unclear
  name" criterion: they are neither silently dropped as technical nor silently preserved, but put on
  the owner's table via the decisions file.
- ✅ **Empty source folders — ANSWERED 2026-07-26** (in chat): KPOT may delete the folders its sort
  emptied, provided their paths are in the backup so a rollback recreates them. Implemented; see the
  decision log and `tests/empty_dirs.test.mjs`.
- ✅ **"1 January 00:25" EXIF dates — ANSWERED 2026-07-28** (in chat): «сброшенным часам камеры не
  доверять, если это факт, что они сброшены». Implemented the same session with the owner's condition
  AS the mechanism: such a date is refused only when the collection itself contradicts it (its year
  is below the archive's earliest trustworthy capture year); a real New Year photograph of the same
  shape is untouched. `src/meta/resolve.mjs` rule 5, `tests/meta_reset_clock.test.mjs`, fixture v6.
- 🔎 **plans/02 is now COMPLETE through step 2, and the result is worth the owner's glance**
  (2026-07-28): step 1 stripped 199 of 201 false years; step 2 then searched for those photos'
  originals by their pixels and found **one** — because the others are not in the archive (their best
  candidates are 182–376 apart of 1024, where a true pair is 4–89). So the 83 «фоты на альб» pictures
  will stay in `ПРОЧЕЕ` with a ceiling, and that is the honest answer, not a gap to close. Step 3
  (PRNU) remains unstarted and unauthorised — it names a camera, not a photograph.
- ✅ **Idea 01 ANSWERED 2026-07-28** — `ideas/01_inbox_topup_flow.md`: the inbox lives **inside the
  library root**, its default name is **`НОВОЕ`**, and a processed inbox folder is deleted once it is
  empty and done. The fourth fork (how far one click goes unattended) dissolved into the UI decision:
  the shortcut opens the Web UI, so the confirmation is a button. NOT yet implemented — it belongs
  with the interface epic, after Phase 5.
- ✅ **Logo source PNGs — SETTLED** (this entry was stale; corrected 2026-07-28). Both design
  sources and `KPOT.jpg` live in `assets/` and are tracked (commit `581ca6b`). Nothing is awaiting
  a decision here.
- ✅ **THM placement — ANSWERED 2026-07-28** (in chat): «В мусорный карантин». A `.thm` is camera
  litter like `Thumbs.db`, so it is kind `junk` → `ПРОЧЕЕ/_мусор` with provenance, never in the
  library, deleted never. Implemented the same session; it keeps dating its video twin. Verified on
  real data: 34 thumbnails now carry no verdict, and 25/25 videos stay `dated` by `sidecar`.
  Recorded in the `MASTER_PLAN.md` decision log.
- ✅ **plans/02 step 2 (pixels) — AUTHORISED by the owner 2026-07-28** (in chat, answering the
  resume question): «Да, ищи оригинал по пикселям». This REVERSES the standing «пиксели не надо»
  for step 2 only. It unblocks perceptual-hash search for the actual original (`plans/02` §Шаг 2),
  including the one small pure-JS decode dependency that step names (`jpeg-js`, MIT, no native
  build) — a decision-log row, not a new interview. Step 3 (PRNU) stays unstarted and unauthorised.

---

### Session of 2026-07-30 — release 0.2 shipped, two PROCESS bugs the owner caught, and the README rebuilt as a manual

The session that took the product out of the workshop. It also produced the two most useful defects
of the project so far, and neither of them is in the code.

- **Release 0.2 «Obvius KPOT» published** (tag `v0.2`) with both artifacts. Verified before
  publishing, not after: 294/294 · `npm run package` with the vendored runtime matched against the
  SHA-256 on nodejs.org and the Authenticode signature read on the shipping file · ALL CHECKS PASSED
  from `package:verify`, which drives plan → sort → idempotent re-plan → rollback **on the package's
  own bundled runtime** · `npm pack` installed into an empty prefix and run from outside the
  development tree · both download URLs fetched and confirmed 200.
- **The mandatory judge pass corrected the release scope before a word of the notes was written.**
  «Six closed bugs» was wrong: `git log v0.1..HEAD` says TWO since the tag (05, 06); the other four
  predate it. It also found that `v0.1` was tagged BEFORE the pixel search and the reset-clock rule,
  so both are new in 0.2 as well. That produced the framing the notes actually use, and it is true:
  **0.2 closes both honest limits 0.1 declared about itself** — «No GUI yet» and «No pixel-level
  matching yet».
- **`bugs/07` — a BRAND decision was taken without the owner.** He pre-authorised the operation
  («НА ВСЁ ДАЮ ДОБРО, МЕНЯ МОЖЕШЬ НЕ СПРАШИВАТЬ»); the agent read that as covering the release
  CODENAME and invented one. The rule existed, was read in-session (canon puts brand FIRST on the
  do-not-decide list; `/release` Step 0 said «ask the human for it») and was recalled correctly ONE
  MESSAGE TOO LATE. **A rule remembered after the fact is not a gate.** Fixed as mechanism: the
  act-vs-authorship distinction is now in `AGENT_GUIDE.md`, Step 0 is a hard stop with three legal
  outcomes (he names it · he picks from 2–3 · ship with NO codename), and a name must carry its
  source. The bug was held OPEN until he named it — renaming it unilaterally, even more modestly,
  would have been the same defect twice. He named it **«Obvius»**.
- **`bugs/08` — the release notes were nearly a copy of the README** (34 KB). The cause was the
  SKILL TEMPLATE, which asked for a «what X is» paragraph and a full Get-started section — in a
  project whose README has both, that is an instruction to duplicate. Rewritten to 12 KB of delta;
  Step 6 now carries the two-document rule, the different sources of inspiration, and one mechanical
  check: *if a paragraph could be pasted into the README unchanged, it belongs in the README*.
- **The README was rebuilt as a USER MANUAL** on his verdict «текущий README считаем устаревшим
  фродом» — it still opened by calling KPOT a CLI tool and hid the non-technical path in a
  blockquote under a command-line heading. Ten numbered sections per language, academic register
  from his stylometric portrait, no history of the project. **Every statement re-derived from the
  code**, which caught a fresh falsehood mid-writing: the `НА_РАЗБОР` decision file is
  `.kpot-runs/папки-на-согласование.txt`, not a file in that directory. Confirmed afterwards by a
  real end-to-end run.
- **The repository description** now says what the product is: a friendly tool with a graphical
  window interface and a CLI, for ordinary PC users. His wording, his instruction.
- **Reported upstream to KAIF** at his instruction: `ideas/19_kaif_2.1_scope.md` items **7)**
  (blanket approval vs identity), **8)** (notes vs README, with the different sources of
  inspiration) and **9)** (Windows + non-ASCII through command-line arguments), plus the field
  report `ideas/ai_agents_reports/20_…`, plus two Unliminium reports copied in as 21 and 22 and
  item 3 repointed at the local copies. **Not committed — that repository is the owner's.**
- **EXP-0026** (the two process defects) and **EXP-0027** (four Windows tooling failures in one
  session, of which the expensive one was SILENT: a backtick inside a double-quoted shell string was
  eaten as command substitution and corrupted a canon document while the script printed `ok`).
  `AGENT_GUIDE.md` §Build now records both the rule — text travels through FILES, not through
  command-line arguments — and that **`npm run package` runs only from PowerShell**.


### Session of 2026-07-29 (late 9) — the judge pass on that handoff, and what it found
The previous session had appeared to hang mid-command; it had actually recovered, committed and
pushed. Rather than trust the handoff, it was judged — and the fix was right while two of its
CLAIMS were wrong. Suite **286 → 294**.

- **The wiring is genuinely guarded, proven by breaking it:** delete the receipt write from
  `apply.mjs` → `ui_undo.test.mjs:238` red («after a sort the panel sees a library»); delete the
  removal from `rollback.mjs` → `ui_undo.test.mjs:250` red, the orphaned document showing up as an
  extra census row.
- **`tests/receipt.test.mjs` did not exist, and two `[TESTED]` markers named it** — the exact fraud
  the canon hunts. Written now: 8 specs over the claims nothing covered (a rehearsal leaves
  nothing · a no-op run adds no line · the parser survives a total rewrite of the prose · a damaged
  document fails safe · the scan never lists it), **six breaks planted one at a time, each red only
  in its own spec.** The marker also now says out loud which claim is NOT independently
  falsifiable (`moved > 0`) instead of implying coverage.
- **A false claim that would have COST coverage if believed.** The commit message says six census
  helpers now skip `RECEIPT_NAME`; only two do. And `ui_undo`'s census must never join them — not
  skipping the receipt is exactly what guards the rollback half, so "finishing the job" would have
  deleted that guard while every test stayed green. Corrected in `bugs/06_DONE` with the reason,
  and captured as **EXP-0025**: an exclusion in a census is guard-shaped.
- **Verified by LOOKING** (EXP-0024), because that is how the bug was found: headless Edge over
  CDP, clicking the real folder chooser on the owner's archive shape (a hand-made `2013/Лето/`
  among loose photographs). Heap → **МАСТЕР**; after a real sort → **ПУЛЬТ** «Всё уже разложено»;
  after the undo → **МАСТЕР** again. The third state is the one that matters: the bug does not
  return by its other door. Script: scratchpad `bug06_look.mjs`.
- **Then the next ranked item, and it is done** (`769c627`): **the user-facing README**. The only
  «Install» was `npm i -g <tgz>` — a terminal instruction in a product whose audience the owner
  defined as «и я и обычные не опытные пользователи ПК». Both languages now open with the window
  version: the two screens and WHY one or the other appears, the receipt file explained to the
  person who will meet it among their own folders (safe to delete, and an undo takes it away), and
  the `researches/09` §6.2 obligation — the Windows first-launch dialog named in its own words with
  the button to press. `kpot ui` is in the command-line block for the first time since 6.1 shipped.
- **The download link was deliberately NOT written**, because it would have been false: `v0.1`
  predates the portable package and carries the CLI tarball only. The note says the ZIP is built
  from source today and that a ready-made one ships with the next release — which is the owner's
  call and is now the single top item in the backlog.

---


### Session of 2026-07-29 (late 8) — `bugs/06` closed by the owner's own rule: KPOT leaves a receipt
The last thing this session did, and the owner decided it himself after I had explained the bug
twice. His words: «KPOT должен оставлять документ-расписку. Его нет — считаем, что беспорядок. Он
есть — видим в нём историю сортировок.» Commit `d7ef914`; suite stays **286/286**.

- **`src/core/receipt.mjs`** — a plain readable document in the archive root, «KPOT — что здесь
  сделано.txt», listing the sorts that are **still in effect**: when, how many files, and the
  command to undo each. A real run that moved something records itself; an undone run is removed;
  when the last entry goes the document goes too. Parsed by **run id**, never by prose — phase 6.6
  had just spent a day rewriting the prose around it.
- **It replaces an inference with a memory,** and that is why it beats all four fixes I had drafted:
  every one of them tried to deduce the past from the present and differed only in cleverness. It
  also fails safe by construction (no document, no claim), it is something the person can open and
  delete — with its own text saying so — and it makes an undone sort stop counting, which closes
  the same bug by its other door.
- **The two specs that asserted the old rule now assert its opposite on the same fixtures**, which
  IS the fix; break-verified by restoring `isLibrary: years.length > 0` (both go red).


### Session of 2026-07-29 (late 7) — phase 6.6: the language pass, done by READING
The last phase of the interface epic. Its acceptance criterion is «проверка — чтением, а не грепом»,
and that is the whole story of it: every defect below was invisible to a word list. Suite 283 →
**286**.

- **The reports had never had the pass at all.** Reading all five surfaces found, in shipped code:
  «ОТЧЁТ О СУХОМ ПРОГОНЕ» (a literal rendering of "dry run", while the interface has said
  «репетиция» since 6.2 — one product, two names for one act) · a «БЭКАП» heading · «Манифест» ·
  «жёстких ссылок» · a printed **`sha256`** in the duplicates section · **`XMP DocumentID`** inside
  a Russian sentence about a photograph · `различие 26 из 1024, отрыв от следующего 360` · and an
  ISO `2012-06-15 12:30:00` two screens below the same date written as «15 июня 2012, 12:30».
- **And Russian that was simply wrong:** «Дубликаты: **1 групп**», «Ждут вашего решения: **1 папок**»
  — in the first ten lines of the document `GOAL.md` is built around. Fixed at the root:
  `src/core/words.mjs` holds the three-form plural rule and the date-in-words helper, which moved
  down out of `bucket.mjs` because the plan needed the same function and was printing raw ISO instead.
- **The structural half, and it is worth more than any wording:** `tests/reports_language.test.mjs`.
  The jargon guard has existed since 6.2 but scanned `src/ui/i18n.mjs` **only** — the reports were
  never covered. The new spec checks the RENDERED text of all five, because a banned word can arrive
  from a constant, from a detail string built three modules away, or from an evidence label.
- **Two of my own guards were defective and the break pass caught both.** The jargon list convicted
  the owner's own file name `скан_без_даты.jpg.xmp` (a negative guard must be narrow enough to fire
  AND precise enough not to convict the innocent — the file names are now excised before matching,
  and the trade is stated in the spec). And the plural guard **stayed green with «1 папок» planted
  back in**: I had written `\b` next to Cyrillic, which is EXP-0017 exactly — in the guard that
  cites EXP-0017. Both re-verified red before being trusted.
- **`bugs/06` filed, not fixed** (behaviour, not language, so it does not ride into this phase):
  **a messy folder containing any `2013/` is taken for a finished library**, so the interface shows
  the panel — «Всё уже разложено» — with «Пока ничего не запускалось» two blocks below it. This
  matters on the owner's real archive specifically: `researches/02` recorded that it already holds
  hand-made `<year>/<season>` folders, so **his first run would skip the wizard entirely**. Nothing
  is at risk; the first impression is a false statement about his files. Four candidate fixes are
  in the document, with a recommendation.


### Session of 2026-07-29 (late 6) — phase 6.5: the portable package, and the first time anyone LOOKED
The owner said «делаем». The gate came first and paid for itself immediately; the package was built
and verified; and then his own suggestion about the browser found two UI defects six phases of specs
had never been able to see. Commits `80d6a3a` · `7f7f52a` + this one; suite 279 → **283**.

- **The recon gate is discharged, and it REFUTED the epic** (`researches/09_mark_of_the_web.md`).
  A genuine Edge download produced **no mark at all** — because this machine has both defences
  switched off (`SaveZoneInformation=1`; `.cmd`/`.exe` in `LowRiskFileTypes`). So **this machine
  cannot validate the first launch**, and every «всё тихо» observation on it is void. Sourced from
  the literature instead: Explorer's own extractor DOES propagate the mark, and the prompt fires on
  SHELL invocation. Conclusion: **silence cannot be promised on any machine**, so the product stops
  promising it and tells the person in advance what Windows may show. The epic's «ярлык метки не
  имеет, значит дальше чисто» is recorded as an **open question** — the shell executes the target,
  not the shortcut.
- **The package exists**: `npm run package` → **33.2 MB**, and `npm run package:verify` unzips it
  into a clean folder and proves it runs **on its own bundled runtime** (`process.execPath` inside
  the unpacked tree), then drives the real product through it: plan → apply → a second plan with 0
  operations → rollback with 0 failures, plus `KPOT.cmd` starting the server and shutting down.
  Every build step is a check: the vendored archive's SHA-256 against nodejs.org's published list,
  the Authenticode signature read **on the file that is shipping** (Valid, CN=OpenJS Foundation),
  and an allow-list audit of the staged tree.
- **The desktop shortcut** (`src/core/shortcut.mjs` + `GET/POST /api/shortcut`): offered, never
  created unasked; shown ONLY in a packaged run, never in a checkout; targets `cmd.exe` with our
  launcher as an argument (`researches/09` §4); and asks Windows where the desktop actually is,
  because OneDrive redirects it on a great many machines. Verified in both directions on real runs.
- **The owner's own suggestion closed a six-phase blind spot** (EXP-0024): «может тебе нужно было
  Chrome с dev портом открывать?» — yes. Driving our own headless Edge over the DevTools Protocol
  rendered the page for the first time in this project's history and immediately showed two defects
  no spec of ours could fail on: the wizard's four-step strip was still drawn **on the control
  panel**, and all three run cards said «Дальше». Both fixed; scripts kept in the session scratchpad.
- **An icon was attempted three times and deliberately NOT shipped** (EXP-0023): PNG entries render
  as noise in some readers, hand-written DIB entries do not load at all, and the platform's own
  `GetHicon` yields a 16-colour file. Stopped by the three-attempt rule — and underneath it sat a
  decision that is not the agent's: a square app mark out of a 1734×907 banner is a **brand** choice.
  **Open for the owner:** supply a square logo and the icon is one line (`$s.IconLocation`).
- **Owner's answer recorded:** the clean-machine acceptance happens at a friend's, «сильно позже».
  Deferred with a known owner, not forgotten (`plans/09` §9 carries the exact steps, including
  printing the two policy values first so the result is readable).


### Session of 2026-07-29 (late 5) — phase 6.4 closed: the `НОВОЕ` top-up, and a defect it uncovered
The top-up is built exactly as `plans/08` argued it should be — by removing four misbehaviours, not
by adding a pipeline. Measuring it first (EXP-0012) paid twice: it corrected the plan's own
conclusion, and it found a bug that had shipped in `v0.1`. Commit `abac68a`; suite 266 → **278**.

- **The four places, all closed** (`plans/08_DONE_novoe_topup.md`): `НОВОЕ` is now STRUCTURE like
  KPOT's own shelves, so files land in `<год>/<сезон>/<имя>` instead of growing a `НОВОЕ/` inside
  every season — while the owner's own subfolders inside it (`НОВОЕ/с телефона/`) still survive as
  nesting; the inbox is never listed for deletion, though its emptied SUBfolders still are; a
  shelved copy now outranks an inbox copy when the keeper is chosen; and the inbox can no longer be
  proposed for `НА_РАЗБОР/` — now by structure rather than only by vocabulary.
- **The plan's own refutation was refuted, by measurement** (`plans/08` §3a). It had tested the
  duplicate case with an UNDATED file, where the library copy wins on the date criterion, and
  concluded the new keeper criterion was mere tie-breaking. With a file carrying its own EXIF date
  the date criteria TIE and **depth decides** — so the freshly-dropped copy became the keeper and
  the settled `2008/Зима конец года/семейный архив/…` was planned OUT of the library into
  `ПРОЧЕЕ/_дубликаты/`. The criterion is a fix, not a defence, and its spec is built on a dated
  pair so that it can actually fail (EXP-0021).
- **`bugs/05_DONE` — the plan announced FULL folders as about to be deleted**, and it had shipped in
  `v0.1`. On an already-sorted library the plan listed **48 folders** «ОПУСТЕЮТ И БУДУТ УДАЛЕНЫ» at
  **0 operations**, and — the sharper half — the **rehearsal reported 48 folders removed where the
  real run removed 1**, i.e. `GOAL.md` §в broken. Cause: `emptiedDirs` knew two populations that
  keep a folder alive and not the third, media ALREADY at its destination, which does not exist on
  a first sort and is most of the library on every run after it. **No file was ever at risk** — the
  `readdir` + `rmdir` chain in `apply` held. After the fix: 0 folders, and 1 vs 1 (EXP-0022).
- **The panel gained the inbox block** between «Требует внимания» and «По годам»: how much is
  waiting, «Открыть», the same sort behind the same server-side confirmation, and — when the folder
  does not exist — an offer to create it. `src/core/inbox.mjs` + `GET/POST /api/inbox`; creation
  refuses to invent a missing root, the trap phase 6.0 measured. The panel's three copies of
  "re-read everything" became one `loadPanel()`.
- **Every guard verified by breaking the code first** — 3 / 1 / 2 / 4 / 1 / 1 specs red across the
  six breaks — and the two that are NOT independently falsifiable say so out loud instead of
  implying coverage (the `НА_РАЗБОР` criterion, which now holds for two independent reasons, and the
  path-normalisation hardening). Plus a live smoke against a REAL server walking the same calls the
  page walks, because an endpoint spec proves the server answered, not that anyone saw it (EXP-0019).


### Session of 2026-07-29 (late 4) — phase 6.3 closed: the undo button
The owner asked for a pool of autonomous work until 14:00; the honest pool for 35 minutes was one
item, and it landed. Commit `c3dac29`; suite 256 → **266**.

- **`src/ui/undo.mjs` + `POST /api/undo`** — the undo mechanism is untouched (`src/apply/rollback.mjs`
  is old and tested). What is new is that a **run id now arrives from outside**, so three checks
  stand in front of it, each refusing before anything is read or moved: the run must resolve **by its
  REAL path** into THIS library (a run id is a path segment, and `..` in it names another archive —
  the same rule `researches/08` measured for «Открыть»); `listRuns` must already call it `undoable`;
  and `jobs.mjs` refuses it without an explicit confirmation exactly as it refuses a sort, and
  refuses it with no run named — «вернуть всё подряд» is deliberately not on offer.
- **The page** gets the button only on rows the server called undoable, its **own** confirmation
  dialog (one dialog with two meanings is one wiring mistake away from sorting when someone asked to
  undo), and re-reads the years and the history afterwards instead of showing yesterday's picture.
- **Every refusal spec asserts the ABSENCE of an effect** — a sha256 census of the whole tree before
  and after — rather than the presence of an error message; the success spec compares the census
  before the sort with the census after the undo. Ten new specs; three guards verified by breaking
  the code first (**2 / 1 / 1** red), and the confirmation one goes red because the files really did
  move.
- **A real defect found while wiring it, in code that had shipped:** the page's fetch helper treated
  every status but 409 as a transport failure, so the 403 refusal from `/api/reveal` never reached
  the screen — the «Открыть» refusal has been silent since it shipped. 403 is an answer now.


### Session of 2026-07-29 (late 3) — the interface exists: 6.0, 6.1 and 6.2 shipped
The owner said «Делаем!» and set the session's frame: work autonomously on the value-ranked backlog,
wrap up at his hour. Suite 192 → **239**; commits `5aba4ce` · `a1ff719` · `ab71b22` · `7af1986` ·
`d54a071` · `bf94587`.

- **6.0 — one executor, several faces** (`src/app/phases.mjs`). Verified by an EMPTY DIFF: a golden
  harness captured 13 CLI scenarios from the OLD code lifted out of git and from the new one.
- **6.1 — the server** (`src/ui/server.mjs`, `kpot ui`). Every guard is somebody else's documented
  failure: token · `Host` whitelist · port fallback with the real address reported · browser opened
  only after `listening` · one instance (a second launch finds the running server) · «Завершить
  работу» · progress over SSE. **Live-smoked on this machine**, not just green.
- **6.2 — the wizard** (`src/ui/page.mjs`, `i18n.mjs`, `folders.mjs`, `jobs.mjs`). Four steps, the
  four `GOAL.md` guarantees on every screen, RU/EN from the first string, and **one job at a time
  with the sort confirmation enforced on the SERVER** — a mis-wired button cannot move a file.
  A browser cannot open a real folder dialog, so the server lists folders and the page walks them.
- **The plain-language debt is PAID** (`a1ff719`): the plan report no longer says
  `dated 2012-06-15 (exif-original)` at the owner but «снято 15 июня 2012, 10:11 — дату записала сама
  камера в момент съёмки», and the disputed section is Russian too. Machine keys were left untouched,
  so every spec that branches on them is exactly as strong as before.
- **Four defects found in my own verification, none in the product** — all by the break-the-code pass:
  a golden harness blind to two of four `apply` endings · a rebinding spec that used `fetch`, for
  which `Host` is a forbidden header, so it never sent the attack it claimed to · a port spec that
  HUNG instead of going red · and **`\b` not working with Cyrillic**, which made every Russian
  pattern in the jargon guard unable to fire (EXP-0017).
- **The whole product re-verified end to end after the refactor** — the domain-invariant gate, run
  on a fresh fixture at the end of the session (a green suite is one observation, not the verdict):
  the dry run leaves the tree **byte-identical** · a real sort keeps the **SHA-256 multiset
  unchanged** while the layout changes (48 files, 19 → 50 folders) · a second plan yields **0
  operations** (idempotent) · rollback restores **byte-for-byte**. Script: scratchpad `e2e.mjs`.
- **One real latent defect in the product**, surfaced by 6.0 giving the engine a second caller:
  planning a mistyped path used to CREATE that directory. The guard lived in a face; it now lives in
  the engine, and the spec asserts the absence of the side effect rather than an error message.


### Session of 2026-07-29 (late 2) — phase 6.0 shipped: one executor, several faces
The owner said «Делаем!», and the epic's first phase is done and measured. Commit `5aba4ce`;
suite 192 → **200**. He also set two standing rules this session (see below).

- **`src/app/phases.mjs`** — the four phases as callable functions: take a directory and settings,
  return artifacts, **print nothing, swallow no error, write no user file**. `bin/kpot.mjs` is now a
  face: parsing, wording, exit codes. RULE 2 amended in both maps:
  `{bin, ui} → app → apply → plan → {dedupe, meta, scan} → core`. The apply phase's four endings
  became **named values** (`APPLY_OUTCOME`) instead of printed sentences — a printed sentence is not
  something a second caller can branch on.
- **Proof is an empty diff, not an impression:** a golden harness captured 13 CLI scenarios (stdout,
  stderr and exit code each) from the OLD code lifted out of git, then from the new one. **Byte-identical.**
- **Three findings the verification produced and reading the code would not have:**
  - the golden harness was **blind** — its first version never ran `apply` over an already-sorted
    tree, so two of the four endings went unexercised and a deliberately planted break passed
    unnoticed. Extended to 13 scenarios and re-checked by planting the break again;
  - **a mistyped path used to be CREATED**: planning a non-existent directory did not fail, it made
    the directory, because `.kpot-runs/` is written with `mkdir -p` and that silently makes the
    parent. Unreachable through the terminal — which is the point: the guard lived in a FACE, and
    this phase gives the engine a second caller. Moved down into `src/app/`, and the spec asserts the
    **absence of the side effect** rather than an error message;
  - **a spec passed for the wrong reason** — the "missing path" assertion was green because an
    earlier, unguarded run had created that path (EXP-0008 again). It now clears the path first.
- **The fixture generator's own claim was false by one row:** `expected.json` carried a wall-clock
  mtime, which is why two captures of unchanged code differed. Fixed — found only because the golden
  harness was self-tested before being trusted.
- **Two standing rules from the owner, both recorded in canon:**
  - «общение со мной - через ИНТЕРВЬЮ, не через эпики» — a fork that needs his view goes into
    `interviews/` via `/interview`; working documents in `plans/` are the agent's and must never
    carry an unanswered question addressed to him (`AGENT_GUIDE.md` §Notes from the human);
  - autonomous work is time-boxed by his clock: groom the backlog by value, and wrap up cleanly at
    the stated hour with a pause, a push and a handoff.


### Session of 2026-07-29 (late) — the epic document: the interface cut into six phases
The owner's order is эпик → фазы → операционные планы, and every input the epic needed was closed
the same day. Commit `93f538a`; no product code by design.

- **`plans/03_interface_epic.md`** — the epic: what "done" means for the whole thing (a person who
  has never opened a terminal downloads, unzips, double-clicks and gets a sorted library), the
  owner's decisions quoted verbatim, what we deliberately do NOT build, the architecture, the
  six-phase cut with an acceptance criterion each, the documented failure modes from `researches/07`
  mapped to the phase that answers them, and — separately — what is NOT verified yet.
- **Reading the code changed the first phase.** The phase composition lives as PRIVATE functions
  inside `bin/kpot.mjs` (`scanAndAnnotate` line 251, `planWithDecisions` line 267), entangled with
  console printing and exit codes. A server cannot call them. Left as is, the UI becomes a **second
  implementation** of the product — which is precisely how a dry run and a real run start to
  diverge. So the epic opens with **6.0, a boring extraction into `src/app/`** guarded by
  byte-exact golden snapshots of today's CLI reports, not with a screen.
- **The cut:** 6.0 shared layer · 6.1 server (127.0.0.1 · token · `Host` whitelist · port fallback ·
  browser after `listening` · single instance · «Завершить работу» · SSE progress) · 6.2 the
  first-flight wizard (the RU/EN dictionary starts here, at the first string) · 6.3 the control
  panel (three run cards · folder decisions answered in the UI over the existing
  `src/core/decisions.mjs` · «Открыть» links · run history with rollback) · 6.4 the `НОВОЕ` top-up
  (idea 01) · 6.5 the portable package · 6.6 the closing language pass, which also clears the
  standing jargon debt in the plan report.
- **Two recon gates recorded rather than assumed:** the Mark-of-the-Web on a REAL browser download
  is unverified, so 6.5 may not be promised before it is measured; and opening a folder in Explorer
  from the local server is an external-program launch whose path must be proven to be inside the
  library root — its own recon before 6.3.


### Session of 2026-07-29 — the interface epic: researched, designed, and fully agreed
No product code this session by design: the owner's own order of work is **эпик → фазы →
операционные планы**, and his canon forbids designing an epic before reading what the field settled.
Both were done, and all ten forks are now closed.

- **`researches/07_local_ui_and_delivery.md`** — prior-art review for a local browser UI and for
  getting a Node program onto a normal Windows PC. The section that shaped the design is the
  documented failure modes: "it only listens on 127.0.0.1" is not a security model (DNS rebinding has
  a filed advisory against Glances, a tool of our exact shape — the defence is a `Host` whitelist plus
  a start-up token, Jupyter's model), the default port will be taken one day (Syncthing falls back to
  a random one), the browser must not open before the server listens, a server left running is the
  classic complaint, SmartScreen warns on anything unsigned, and confirmation fatigue destroys the
  protection it pretends to add.
- **`interviews/interview_003_interface.md` + `interview_003_designs.html`** — five genuinely
  different designs, drawn as a working web page rather than described (the owner's words: «а ну-ка
  мне HTML сверстай, а не этот ужас в чат»). The mock-up is self-contained, clickable, themed, and
  lives in the repo; it was published as an artifact for review.
- **All ten questions answered by the owner the same day.** The two that reshape the epic:
  - **The interface is TWO screens.** A wizard leads the first flight; once the library exists it
    steps aside for a **control panel** that can re-launch any of the three runs (scan · plan · sort),
    shows what needs a decision, offers the top-up from `НОВОЕ`, links out to folders, and keeps a run
    history with a rollback on each row. **No thumbnails** — «если нужно отправить человека на
    просмотр - ссылки на папки». That single answer deletes the most expensive and most
    performance-risky subsystem in the epic.
  - **Delivery is a portable package**, and that **removes** the code-signing question rather than
    deferring it. Measured on the machine, not assumed: the official `node.exe` is Authenticode-signed
    by OpenJS Foundation (Valid), 87.4 MB on disk, **32.7 MB zipped**. Shipping that signed binary plus
    our `.mjs` means we introduce **no unsigned executable at all**, so SmartScreen's unknown-publisher
    prompt has nothing to fire on. The single-exe (SEA) route would have re-created exactly that
    problem, since injecting code invalidates the signature.
- Also settled: one deliberate confirmation with the numbers before the sort (never type-a-word) ·
  **server and «морда» are separate — closing the browser does NOT stop the server** (the agent had
  recommended the opposite; the owner is right, a multi-minute sort must not die with a tab) ·
  folders awaiting a decision are answered in the UI · **bilingual RU/EN with a switch** · the window
  is «Krinik Photo Organizer Tool (KPOT)» · no access from other devices.
- **Three obligations the server/face split creates**, recorded so they cannot be forgotten: an
  explicit plainly-worded «Завершить работу»; a second launch of the shortcut must find the running
  server and open the face on it rather than start a second one (port conflict); and the server stays
  the only writer, so internal-map RULE 1 holds with the UI as one more caller above `src/apply/`.
- README refreshed in both languages: 192 tests, two supervised real runs, the pixel search and the
  reset-clock rule described for users, and "still ahead" now points at the interface.


### Session of 2026-07-28 (late 3) — a fresh sandbox and the supervised run Phase 5 was waiting for
The owner authorised the agent to make its own sample: «создай себе новую копию-песочницу для тестов.
Разрешаю. в `D:\work\ai_sandbox\`». Done, and the supervised run on it closes Phase 5's acceptance.

- **`D:\work\ai_sandbox\KPOT_SANDBOX`** — **813 files / 943 MB**, four real folders copied out of the
  archive (a phrase-named trip folder, a date-named folder, an `Instagram` dump of screenshots, and a
  walk folder that happens to hold four editor exports). Outside the repo; `.gitignore` line added
  BEFORE the folder existed. **Verified: the SOURCE is untouched** — 813/813 files identical in path,
  size and mtime after the copy — and the copy matches file-for-file including mtimes.
- **The whole product ran on it end to end:** `plan` (35 s) → `apply --dry-run` → `apply` → hash
  census → rollback rehearsal. **813 moved, 0 failed, backup 813/813 hardlinks**, and the **SHA-256
  multiset is identical before and after** — nothing lost, invented or altered. The rollback rehearsal
  restores 813 files and recreates 5 folders. The sandbox is left SORTED so the owner can look at it:
  `2010/Весна` · `2010/прочее` · `2014/Зима начало года` · `2020/Лето` · `2020/Осень` · `2020/прочее`
  · `ПРОЧЕЕ/Instagram` · `ПРОЧЕЕ/_мусор`.
  Undo: `node bin/kpot.mjs rollback run-20260728-201538-437c4d D:\work\ai_sandbox\KPOT_SANDBOX`
- **The new pixel search proved itself on real data here: 4 of 4** editor exports found their true
  originals — differences of **2 · 10 · 18 · 24** of 1024 with margins of 318–366 — and the plan names
  each source file in plain Russian so the owner can check them by eye. (Contrast with the archive's
  album folder, where 94 of 95 exports are refused because their originals do not exist — both
  behaviours are correct, and that is the point of deciding by margin.)


### Session of 2026-07-28 (late 2) — plans/02 §Шаг 2: the original found BY ITS PIXELS
The epic feature the previous session had researched is implemented, measured on real photographs,
and the measurement changed the design three times before a line of it shipped. Commit `c6bfee6`;
suite 171 → **191**.

- **`src/meta/pixels.mjs`** — the only module in KPOT that decodes an image. It does NOT search the
  archive: `family.mjs` nominates candidates (camera, geometry, ceiling), a 16×16 block-mean hash
  ranks them, the finalists are verified at 32×32, and a date is inherited **only when the winner is
  decisively ahead of the best candidate from another day**. New evidence kind `pixel-original`,
  ranked just under `derived-original`. Second-ever runtime dependency: `jpeg-js` (BSD-3-Clause).
- **Three corrections the measurement forced** (`researches/06`, read-only over the real archive):
  an absolute threshold is unusable (with the original removed, a stranger beat the median true
  pair); a coarse hash cannot tell a crop from a **look-alike** — the same scene shot on another day
  — but resolution can (true pairs 4–89 of 1024, look-alikes 212+); and the original is **not** in
  the same folder: 166 of the owner's 201 broken-class files sit in a folder with no dated photo at
  all, so nomination now walks two levels outward.
- **Calibration found a defect in our own code before it shipped:** with all five finalists from one
  day there was no runner-up, "no rival" was read as "infinite margin", and a stranger was accepted.
  Fixed, and the spec that guards it was itself rewritten after the first version proved unfalsifiable.
- **Measured:** 160 controlled trials on four real folders — **62/80 accepted, all 62 with the right
  day**; **2/80 fabricated** when the original is absent, both on one pair of photographs of the same
  scene six months apart (a limit no pixel method removes — recorded, and the report always names the
  source file so the owner can contradict it).
- **The honest product number:** on the real subtree holding the broken class, **1 of 95** files got
  a date — a perfect find (`S8305319 +.jpg` → `S8305319.jpg`, distance 30/1024, margin 284). The other
  94 refusals are correct, not shy: their best candidates score 182–376 with margins 0–32, i.e. those
  originals are not in the archive at all (the same conclusion the XMP chain reached in `researches/03`).
- **Verified end to end on the owner's own file** (read-only, library composition over the folder
  that holds it): the floor for that folder alone comes out as **2005**, `ВИТЯ/Imag0151.jpg` with its
  EXIF `2000-01-01 00:25:13` is now `unknown` with BOTH its claims in disputed as `reset-camera-clock`
  — and it is the **only** one of the folder's 216 media files affected. No collateral damage.
- **Reset camera clocks — the owner's decision of 2026-07-28** («сброшенным часам камеры не доверять,
  если это факт, что они сброшены»): a «1 января 00:25» date is refused **only when the collection
  itself proves it wrong** — its year is below the earliest trustworthy capture year in the whole
  archive. A real New Year photo of the same shape keeps its date; both cases are planted in the
  fixture (v6) and guarded.
- **Owner-facing language:** the plan gained a section «ДАТЫ, ВЗЯТЫЕ У ИСХОДНОГО СНИМКА» that names
  the source file in plain words — the owner's «без жаргонизмов» requirement, applied where the tool
  had been printing `pixel-original` at him.
- **Owner's answers recorded** (chat, same session): idea 01 — inbox **inside** the library, default
  name **`НОВОЕ`**, emptied inbox folders are deleted; idea 02 — a **local Web UI** plus an installer
  that puts a desktop shortcut, full scope, planned epic → phases → operational plans, and the
  audience is **inexperienced PC users**, so UI, installer and every string must be friendly,
  foolproof and free of jargon. Both in the `MASTER_PLAN.md` decision log.


### Session of 2026-07-28 (late) — the 9a rule's first run: `researches/05`
The canon rule the owner had just added was applied to the very next task, and it paid for itself on
the first use — it killed a design the plan had already committed to.

- **`researches/05_perceptual_hashing.md`** — prior-art review for `plans/02` step 2 (find a photo's
  original by pixels). Web-searched with sources; every unopenable source is **listed as unopenable**
  rather than quoted from memory (§8 of that document).
- **The risk that could have killed the feature is dead:** the broken class is saved as PROGRESSIVE
  JPEG (`SOF2`) and `jpeg-js`'s README never claims to support that. Measured on the real archive:
  **25/25 progressive files decoded, 0 failures** (plus 25/25 baseline). Cost measured too: ≈76 ms/MP
  progressive, ≈49 ms/MP baseline.
- **A wrong fact in the plan, caught:** `plans/02` asserted the dependency was "`jpeg-js`, MIT". It is
  **BSD-3-Clause**. Permissive and fine — but it had been asserted without checking.
- **The planned algorithm was refuted by measurement.** Controlled experiment, 40 of the owner's own
  photos, crops of the same shape the real Photoshop export has: **dHash cannot survive a crop** — a
  10% crop already scores 19 bits, which is also the *minimum* distance between two UNRELATED photos.
  `blockhash` degrades gracefully (16 vs a chance median of 32 at the real 70%-of-width crop) but the
  distributions still overlap, so a global threshold would invent wrong dates — invariant 3 forbids it.
- **The design that replaces it** (`researches/05` §7): do NOT search the archive. Step 1 already
  knows the camera, the geometry and the ceiling, which collapses the candidate set from ~61 689 to
  ~100–200; over a set that small we can afford expensive comparison and decide **by the margin
  between the best and second-best candidate**, never by a threshold. No margin → the file stays in
  `ПРОЧЕЕ` with its ceiling, exactly as today.


### Release 0.1 «First KPOT» — published 2026-07-28
Owner's word: «давай оформим релиз 0.1 в GH»; codename his choice. Tag `v0.1`, commit `5d77dbc`.
https://github.com/MikalaiKryvusha/KPOT/releases/tag/v0.1

- **Bilingual release notes** in the house style of the owner's other repos (logo, date+place header,
  `English · Русский` anchors, ✨/🔬/⚠️/🚀 sections), including an explicit **honest-limits** section
  (no GUI · no pixel matching yet · the real-data proof is a 13 GB sample, not the 551 GB archive ·
  Windows-first · the XMP-date path is fixture-only).
- **The judge pass caught a real defect before publishing:** `npm pack` was shipping the WHOLE
  repository — **17 176 090 bytes** carrying `KPOT.psd`, the 12 MB PNG logo sources, the entire KAIF
  framework and every internal working document. A `files` field now limits the package to `bin/` +
  `src/` (+ README/LICENSE/package.json npm adds itself): **90 417 bytes**. `*.tgz` was gitignored
  BEFORE the rehearsal artifact existed.
- **Release gates, all run rather than asserted:** 171/171 · a full end-to-end smoke on a fresh
  fixture, read by eye · domain invariants compared as numbers (dry run leaves the tree
  byte-identical · a real apply keeps the SHA-256 multiset identical while paths change · a re-plan
  yields 0 operations · rollback restores byte-for-byte) · the trimmed package installed into a clean
  directory with no dev tree, then **installed again straight from the release URL**, running
  `--version`/`plan` at exit 0 — so the install command printed in the notes is verified, not hoped.
- **`HANDOFF.md` added** (owner's request, same session): a dated snapshot for handing the work to a
  DIFFERENT agent/tool without this framework loaded.


### Session of 2026-07-28 — Phase 2's last cut closed: sidecar evidence
The item the backlog called "optional filler" turned out to be the only date a whole class of the
owner's videos has. Commit `d26ebb5`; suite 156 → **170**.

- **Recon before code, and it changed the design** (`researches/04_sidecars.md`, read-only over the
  real archive): a `.thm` is a **160×120 JPEG with a full 44-tag EXIF block**, and **34/34 carry
  `DateTimeOriginal`**. 25 of them sit beside an **`.avi`** — and AVI is RIFF, not ISO-BMFF, so
  `src/meta/mp4.mjs` extracts *nothing* from those videos. Measured with the real pipeline before
  writing a line: all 25 were `partial` — a year from the folder name, no season, no time.
- **`src/meta/sidecar.mjs`** — pairs by stem (`VID.THM`↔`VID.AVI`) or by full name
  (`photo.jpg.xmp`↔`photo.jpg`), case-insensitively, inside one directory. Donates **capture
  properties only**: a THM's `DateTimeOriginal` (never its `DateTime` — that is when the camera
  wrote the thumbnail), an XMP's `exif:DateTimeOriginal`/`photoshop:DateCreated` (never
  `xmp:CreateDate`/`ModifyDate`/`MetadataDate`, which editors write on save). An orphan sidecar
  dates nobody; a stem matching two media files dates nobody.
- **Real-data proof, read-only within the grant: 25/25 videos went `partial` → `dated`,** winner
  `sidecar`, 0 errors — 19 to `2012/Весна/видео/`, 2 to `2012/Зима конец года/видео/`, 4 to
  `2013/Осень/видео/`. The years match what the folder names already said, so it contradicts
  nothing: it adds the season and the timestamp.
- **Honest limit, recorded not glossed:** the archive holds exactly **one** `.xmp`, an ACDSee
  catalog sidecar with **no date properties at all**. The XMP *date* path is therefore guarded by
  fixture only, and says so in its `[TESTED]` marker.
- Fixture v3 → **v4** (+6 planted files, new `makeAvi`/`makeXmp` builders); 13 new specs plus the
  acceptance case. **All five guards verified by breaking the code first** (1/5/3/1/1 specs go red).
- **Found, surfaced, and then decided BY THE OWNER the same session:** a THM is a JPEG, so KPOT was
  filing all 34 thumbnails into the library as photographs. Asked rather than guessed (invariant
  10); the owner chose «в мусорный карантин», so `.thm` is now junk-by-extension →
  `ПРОЧЕЕ/_мусор` with provenance. Both halves verified together on real data: the 34 thumbnails
  carry no verdict, and the 25 videos they describe are still dated to the second. Suite **171**.


### Session of 2026-07-27 — plan 02 step 1: dating the photos that have no capture date
The 113-file broken class (editor exports shelved by their SAVE date) is fixed at the root, the
owner's value order followed exactly (metadata only — no pixels). Commit `e55ae91`.

- **Three new evidence kinds** (`src/meta/`): `editor-save` — an editor's save date never
  determines, it is a «снято не позже» ceiling always shown in disputed (§1.1); `derived-original`
  — exact XMP `DocumentID` ↔ `DerivedFrom` match inherits the original's REAL capture date, report
  names the original (§1.2); `family` (`src/meta/family.mjs`) — camera census + sensor-geometry
  match + same-camera year fork + the ceiling; narrates always, dates only a one-year
  uncontradicted fork, flagged assumed → `<год>/прочее` (§1.3). Decision-log row added.
- **Suite 143 → 156**, fixture v3 (+7 planted cases via a new full-featured JPEG builder:
  multi-tag IFD0, ExifIFD, XMP packet, SOF0 dims). All three guards verified by breaking the code
  (5/2/2 specs go red). The plan report carries a Russian family line per broken-class file.
- **Real-data proof, read-only within the grant:** `KPOT_SAMPLE` was deleted by the owner between
  sessions (EXP-0011) — verification ran as a library composition over two real PC-dump dirs:
  8331 JPEGs, 0 errors, **201 broken-class files → 199 lose their false year** (193 honest
  `ПРОЧЕЕ` with ceilings, 5 family years, 1 cohort year, 2 had real dates anyway). Family models
  found in the wild: HTC Touch2, Digimax S830, DSC-S780. XMP identity exists (35/19) but no
  original matched in that slice — §1.2 waits for a full-tree run.


### Session of 2026-07-26 (late) — first contact with the owner's real archive
The tool met real data and the owner read the output. That combination found more in one evening
than every synthetic fixture had.

- **The real-data sample exists** (owner-authorised): `D:\work\ai_sandbox\KPOT_SAMPLE`, 3397 files /
  13 GB / 567 dirs, stratified over every class in `researches/02`. Outside the repo, gitignored by
  name anyway. mtime preserved 3397/3397; the SOURCE archive verified untouched (0 of 71 606
  changed). Full record: `researches/03_first_real_run.md`.
- **A supervised `apply` ran on it** — 7 s, 3154 moves, 495 emptied folders removed, 0 failures, and
  the multiset of sha256 hashes is IDENTICAL before and after (nothing lost, nothing invented). The
  rollback rehearsal reports 3154 files + 495 folders restorable; the undo is verified, not spent.
  **The sample is currently left SORTED** so the owner can look at it.
  Undo: `node bin/kpot.mjs rollback run-20260726-145004-a39593 D:\work\ai_sandbox\KPOT_SAMPLE`
- **Four bugs, all found by real data or by the owner's eye, all closed:**
  - `02` — a Samsung gallery ID read as a unix epoch, moving a 2024 photo to 2001.
  - `03` — found by the DRY RUN: paths compared with `!==` instead of `samePath`, so 15 files
    already home under a differently-CASED folder were planned to move onto themselves.
  - `04` — three formats unrecognised, so 38 real files were never sorted at all: 18 `.jp2` scans,
    19 `.aac` voice notes, one 2.1 GB `.mts`. MPEG-TS has no magic string — it needs two sync bytes
    one packet apart, which is why `SNIFF_LENGTH` went 16 → 208.
  - (`01` earlier the same day — the sort was not idempotent.)
- **The approval rule was sharpened twice by the owner** and now asks about **5 folders instead of
  25** on his real data: only when sorting would actually SCATTER a folder AND its name is a
  meaningful word or phrase. A careless name (`11`) is sorted silently; `Ukraine_Fall_2020` and
  `Summer_2024_Belarus_Part_1` are phrases, not identifiers. See the decision log.
- **Live progress** and **resume of an interrupted run** landed earlier the same day.


### Phase 5 — started (2026-07-26): scale, idempotence, and the owner's two new rules
- **Scan cache** (`src/core/scan_cache.mjs`) — keyed by (path, size, mtime), as `researches/02` §4
  prescribes. A repeat run reports `cache N/N reused (no re-hash)`; `apply` re-keys the cache from
  its own moves so it survives a sort. Without it every repeat run on the real archive re-hashes
  551 GB. 10 specs, three invalidation angles, corruption-tolerant.
- **Bug 01 — the sort was not idempotent** (`bugs/01_DONE_sort_not_idempotent.md`). Found by reading
  a smoke run, not by a test: KPOT did not recognize its OWN output layout, so every run nested one
  level deeper, grew quarantine names by their whole path, and demoted correctly-shelved files to
  `<год>/прочее`. Three causes, one root. Guarded by `tests/idempotence.test.mjs`.
- **Empty-folder removal** (owner's decision) — KPOT now deletes the folders its sort emptied, and
  only because the backup manifest records every DIRECTORY so rollback recreates them. The plan
  lists them before the run; apply re-reads each one and uses `rmdir`, never a recursive delete.
- **The `НА_РАЗБОР/` quarantine** (owner's decision, revised by the owner the same day) — a folder
  whose NAME is unclear is never taken apart: it is moved WHOLE into `НА_РАЗБОР/`, keeping its
  original parent structure, and waits there for an answer in
  `.kpot-runs/папки-на-согласование.txt`. Stripping that one prefix recovers the original path,
  which is what keeps the flow idempotent and `НА_РАЗБОР` out of the library.
- Suite **140/140**. Every new guard verified by breaking it first; two guards that turned out NOT
  to be independently falsifiable are documented as such rather than left implying coverage.


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

### Closed bugs of the 0.1–0.2 era — the roll, verbatim from STATUS

- ✅ `bugs/07_DONE_brand_decision_without_owner.md` (2026-07-29) — **a PROCESS defect, found by the
  owner minutes after release 0.2 went public.** He had pre-authorised the whole operation («НА ВСЁ
  ДАЮ ДОБРО, МЕНЯ МОЖЕШЬ НЕ СПРАШИВАТЬ»), and the agent read that as covering the release CODENAME,
  publishing a name the owner first saw as a fait accompli: «Было принято бренд решение без
  владельца». The rule existed, was read in-session (canon: brand first on the do-not-decide list;
  `/release` Step 0: «ask the human for it») and was recalled correctly one message too late — so
  the missing thing was the DISTINCTION between authorising an ACT and authorising a DECISION.
  Fixed as mechanism: the concept is in `AGENT_GUIDE.md`, Step 0 is a hard stop with three legal
  outcomes (owner names it · he picks from 2–3 · ship with NO codename), and a name must now carry
  its source. The owner named 0.2 himself: **«Obvius»**. EXP-0026.
- ✅ `bugs/08_DONE_release_notes_duplicated_readme.md` (2026-07-29) — the 0.2 notes were **34 KB and
  nearly a copy of the README** («зачем в релиз ноутсы попала почти вся копия README - это
  НЕПРАВИЛЬНО!»). Cause was the SKILL TEMPLATE, which asked for a «what X is» paragraph and a full
  Get-started section — an instruction to duplicate in a project whose README has both. Rewritten to
  **12 KB** of pure delta and republished. Step 6 now carries the two-document rule, the different
  sources of inspiration (README ← the owner's other repos · notes ← this project's previous
  releases) and a mechanical check: *if a paragraph could be pasted into the README unchanged, it
  belongs in the README*.

- ✅ `bugs/06_DONE_messy_tree_looks_like_a_library.md` (found and fixed 2026-07-29) — any top-level
  `20xx/` folder made `libraryShape()` answer "library", so the interface opened the control panel
  over an untouched heap and said «Всё уже разложено», with «Пока ничего не запускалось» two blocks
  below on the same screen. It landed on the owner's own archive (`researches/02`: it already holds
  hand-made `<year>/<season>` folders), so his first run would never have seen the wizard.
  **Fixed by the owner's own rule** — KPOT now leaves a **receipt** and asks it, instead of deducing
  its past from the scenery. Both guards break-verified.

- ✅ `bugs/05_DONE_emptied_dirs_false_positive.md` (2026-07-29) — the plan announced folders that
  are FULL as about to be deleted: on a sorted library, **48 folders** at **0 operations**, and the
  rehearsal reported 48 removed where the real run removed 1 (`GOAL.md` §в broken). Shipped in
  `v0.1`; found while measuring the inbox for phase 6.4, by following a number that did not match
  the mental model. `emptiedDirs` knew two populations that keep a folder alive and not the third —
  media ALREADY at its destination, which does not exist on a first sort and is most of the library
  afterwards. No file was ever at risk: the `readdir` + `rmdir` chain in `apply` held. Two guards,
  break-verified; after the fix 0 folders and 1 vs 1.
- ✅ `bugs/03_DONE_case_insensitive_noop.md` (2026-07-26) — found by the **dry run** during the first
  supervised sort. The owner capitalises his season folders (`Зима Конец Года`); on Windows that is
  the SAME directory as KPOT's canonical `Зима конец года`, so 15 files already home were planned to
  move onto themselves and `apply` refused them. Cause: `buildPlan` compared paths with `!==`
  instead of the `samePath` helper `AGENT_GUIDE` mandates for exactly this. 15 failed → 0 failed.
- ✅ `bugs/02_DONE_epoch_false_positive.md` (2026-07-26) — found on the FIRST real-data run. A
  Samsung gallery *sequence number* has exactly the shape of a unix epoch, decoded to 2001-09-09,
  and moved a photo the owner keeps in his `2024/` folder into a year his archive has nothing in.
  Fixed by bounding filename-epoch decodes at 2008, the year the convention itself began — a claim
  decoding to before Android existed contradicts itself. Guard verified by reverting the fix.

- ✅ `bugs/01_DONE_sort_not_idempotent.md` (2026-07-26) — sorting twice kept moving files: KPOT did
  not recognize its OWN output layout. Three causes, one root: the season directories it creates
  (`Зима начало года`), its buckets (`прочее`, `ПРОЧЕЕ`, `_мусор`, `_дубликаты`) and its two-segment
  `<год>/<сезон>/` form were all invisible to the modules that read a path. Consequences were real —
  unbounded nesting, quarantine names growing by their whole path each run, and correctly shelved
  files being demoted to `<год>/прочее`. Guarded by `tests/idempotence.test.mjs`; each fix verified
  by reverting it.

File defects as one md per bug in `bugs/` via `/report-bug`, per `BUG_FIXING_FRAMEWORK.md`.

---

<!-- Template row for the next entry — keep it last. -->
### <date> — <session/phase/release title> <✅/🎉>
`<The entry as it lived in STATUS.md — verbatim: what was done, key numbers, file pointers.>`
