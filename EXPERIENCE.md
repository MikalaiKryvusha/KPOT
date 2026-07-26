# EXPERIENCE — the agent's accumulated experience

> The agent's growing log of lessons. **Externalized memory of *what works and what doesn't*** — so a
> fresh, context-less session (or an autonomous loop) never repeats a dead end. Consult it BEFORE a task;
> append to it AFTER a meaningful attempt (success **or** failure). Grep, don't scroll.
>
> **Tags live inline on every entry** (not in a central list) — so one grep finds the experiences directly:
> `grep '#loop' EXPERIENCE.md` · `grep -i '#context\|#build' EXPERIENCE.md` · `grep '❌' -A4 EXPERIENCE.md`
> · `grep 'EXP-0007' EXPERIENCE.md`. Reuse an existing tag where one fits (grep to see what's in use).
>
> **Entry format (keep it short and grep-friendly).** Newest on top. Every entry starts with a stable id,
> an ISO date, an outcome marker (`✅` / `❌` / `❌→✅`), and inline `#tags`:
>
> ```
> ### EXP-0001 · 2026-01-01 · ✅ · #tag #area
> **Context:** one line — what was being done.
> **Tried / did:** the approach, briefly.
> **Result:** ✅/❌ — what happened.
> **Lesson:** the reusable takeaway (the reason this entry exists).   → link: bugs/NN · ideas/NN · plans/NN
> **Repro:** the ready-to-run command/check that verifies or applies the lesson — a weak session
>   executes a pasted command reliably, an essay it won't act on. (omit only if truly none exists)
> **Not for:** the lesson's validity range — where it does NOT apply. A documented lesson is still a
>   hypothesis; applied outside its range it kills good ideas.
> ```
>
> The `#tags` are **trigger-tags**: before a task, grep by the task's tags and QUOTE the relevant
> lessons in your report (id + one line) — or state "no relevant lessons". An unquoted recall is
> unverifiable; `/fable-judge` checks for this line.
>
> **Entries EXP-0001…EXP-0005 predate the `Repro`/`Not for` fields (added with KAIF 1.6, 2026-07-26)** —
> they were left as written rather than back-filled, because inventing a validity range after the fact
> is exactly the kind of plausible-but-sourceless text 1.6 hunts. New entries carry both fields.
>
> Skill: `/experience` (capture a lesson · recall relevant lessons).

## Entries

### EXP-0009 · 2026-07-26 · ❌→✅ · #encoding #git #tooling #generated-code
**Context:** writing `src/apply/rollback.mjs`. Suite green, code reviewed, about to commit — and `git diff --cached --stat` showed `src/apply/rollback.mjs | Bin 0 -> 9425 bytes`. Git had classified a hand-written `.mjs` source as BINARY.
**Tried / did:** did not commit. `tr -d '\0' | wc -c` vs `wc -c` found exactly 2 NUL bytes; `awk 'index($0,"\0")'` located them inside two template literals where I had intended a separator character. Wrote the constant twice more — both times the intended character arrived as a raw NUL again, and a `sed` attempt to write the `\0` escape silently ate the backslash. Settled on `String.fromCharCode(0)`: no escape to mangle, no literal to smuggle. Then swept every file touched in the change for the same defect (none).
**Result:** ✅ file is `JavaScript source, Unicode text, UTF-8`, diffs as text, and the separator is now both correct and intentional — a space would have been WRONG here anyway, since paths containing spaces (`Лето 2013/a`) make a space-joined key ambiguous.
**Lesson:** `git diff --stat` before committing is not a formality — it is the only cheap detector of characters that are invisible in every editor and every test. A green suite cannot see them: the code *worked*. And when a special character must appear in generated source, construct it (`String.fromCharCode`) rather than typing it or escaping it — both of those survive one transport and die in the next.   → link: src/apply/rollback.mjs
**Repro:** for any new source file: `for f in <files>; do [ "$(tr -d '\0' < $f | wc -c)" = "$(wc -c < $f)" ] || echo "NUL in $f"; done` — and treat `Bin` in `git diff --stat` for a text file as a stop-the-line signal.
**Not for:** genuinely binary fixtures (`tests/fixtures/` builds real JPEG/MP4 bytes — those are *supposed* to be binary and are written as Buffers, not source literals).

### EXP-0008 · 2026-07-26 · ❌→✅ · #testing #guards #verification #fraud
**Context:** Phase 4 landed with 84/84 green, including a spec named "apply refuses to write when a hardlink snapshot is impossible". Ran the mandatory break-the-code pass (`TESTING_FRAMEWORK` §"a check that has never failed proves nothing").
**Tried / did:** deleted the refusal guard entirely — **the spec stayed green**. Cause: it simulated "this filesystem cannot hardlink" by planting a FILE at `.kpot-runs`, which makes the run die of `ENOTDIR` during journal creation, and the assertion's regex accepted `ENOTDIR`. So it proved "something failed", which is still true with the guard gone. Fixed by making the capability probe injectable and asserting the guard's own wording. A second break then showed the reverse-order rollback rule was equally unproven — the fixture contains no chained move, so inverting the order changed nothing; wrote a purpose-built chain tree for it.
**Result:** ✅ both guards now go red when broken; suite 84 → 88. Two "tested" claims that were false became true.
**Lesson:** the break-the-code pass finds a *class* of defect no amount of review does — a spec that passes for the wrong reason. Two smells predict it: (a) an assertion that accepts a broad error pattern (`/hardlink|ENOTDIR|EEXIST/`) rather than the guard's own message — breadth is where the false pass hides; (b) a guard whose scenario the shared fixture does not actually contain, so the rule is a comment, not a check. Corollary for the harness: when a guard exists for a platform you cannot reproduce (exFAT on an NTFS machine), an injectable seam is not test pollution — it is the only way the guard is ever verified.
**Repro:** `perl -0pi -e '<delete the guard>' <file>` → run the one spec by name → expect ✖ → `git checkout -- <file>`. Do it on COMMITTED files only (EXP-0007), and check the edit actually applied (`md5sum` before/after) — a `sed` that silently fails to match produces a green run that looks like a verified guard and is nothing of the sort.
**Not for:** defence-in-depth checks that are unreachable by construction (here: re-verifying the backup after `createBackup` already throws). Those cannot be made red without contorting the code — document them as such and unit-test the checked function directly instead of faking coverage.

### EXP-0007 · 2026-07-26 · ❌→✅ · #windows #powershell #encoding #tooling #cyrillic
**Context:** verifying that new Phase-3 guards actually fail on broken code (TESTING_FRAMEWORK: "a check that has never failed proves nothing"). Needed to temporarily break `src/plan/plan.mjs`, run the suite, then restore it.
**Tried / did:** did the break-and-restore in PowerShell with `Get-Content -Raw` → string replace → `Set-Content -Encoding utf8`.
**Result:** ❌ the guards proved real (3 and 2 failures as intended) — but the restore silently corrupted the file: PowerShell 5.1's `Get-Content` read the UTF-8 bytes as ANSI, so every Cyrillic string in the module became mojibake (`ПРЕД-` → `РџР Р•Р”-`) and one spec stayed red. ✅ after rewriting the file with the Write tool.
**Lesson:** never round-trip a non-ASCII file through PowerShell 5.1 `Get-Content`/`Set-Content` — `-Encoding utf8` only controls the WRITE side, the read already lost the bytes. This project is full of Cyrillic literals (they are the product's output), so the rule is: mutate files with the editor tools, and if a shell must do it, use `git stash`/`git checkout` for the restore — which also means doing break-and-restore experiments on COMMITTED files only, so `git checkout -- <file>` is always available as the undo.
**Repro:** `node --test tests/plan_phase3.test.mjs` after breaking a guard; check encoding damage with `grep -P '\xd0\xb2\xd0\x82|\xd0\xa0[\xb0-\xbf]' <file>` (matches the classic UTF-8-read-as-ANSI signature) — clean files produce no output.
**Not for:** pure-ASCII files, and the Bash tool (Git Bash handles UTF-8 correctly here) — the trap is specific to PowerShell 5.1's default read encoding.

### EXP-0006 · 2026-07-26 · ✅ · #kaif #update #framework #merge #verification
**Context:** updating the deployed framework KAIF 1.5 → 1.6. The machinery replaces untouched files itself and hands back a list of *diverged* files to merge by hand — but it hands over no diff, and its "What's new" block turned out to describe the PREVIOUS release.
**Tried / did:** refused to merge from the new template alone (against a project-adapted file that dilutes into noise). Fetched the PREVIOUS release's bundle from GitHub Releases, sha256-verified it against its own manifest, extracted both bundles with a 20-line re-implementation of the bundle parser, and diffed template-vs-template per file. That isolates the true upstream delta from local adaptation. Then verified completeness with a line-level parity inventory: every line upstream added → traced in the deployed file.
**Result:** ✅ — 16 of 134 templates actually changed; only 6 of the 7 "diverged" files needed anything; the inventory caught 1 silently dropped cross-reference that all 18 keyword spot-checks had passed. Suite 56/56 before and after, no owner content touched.
**Lesson:** to merge an upstream change into a locally-adapted file you need THREE versions, not two — old template, new template, local file. Diffing local-vs-new answers the wrong question. And a keyword spot-check ("is the new section there?") proves presence, never completeness: only a countable row-per-added-line inventory catches what you silently dropped while rewording. Corollary: a generated "what's new" section is a claim like any other — check it names the version you actually installed.   → link: plans/01_kaif_16_update_report.md · KAIF_FRAMEWORK.md
**Repro:** `node .kaif/kaif-core.mjs version` then fetch the previous release's bundle and diff:
  `gh release download v<prev> --repo <origin> -p KAIF-CORE-BUNDLE.md` → extract both → `git diff --no-index old/<file> new/<file>`. Parity check: for each added line, assert a distinctive fragment of it appears in the deployed file.
**Not for:** files the machinery replaced mechanically (their sha matched the install snapshot — by construction they carry no local edits, so the three-way work is wasted), and owner-content documents where the *content* is the owner's and only the surrounding convention comes from upstream — there, merge the convention and leave the entries alone.

### EXP-0005 · 2026-07-24 · ✅ · #precedence #fixtures #design #dates
**Context:** wiring the DateVerdict resolver: the seeded precedence (Elodie order) put container/mvhd above filename timestamps — but the fixture's VID_ case (mvhd and filename agreeing) expected `filename` to win.
**Tried / did:** instead of "fixing" the fixture, treated the ground truth as the spec and re-examined the order: mvhd is a UTC instant with unknown timezone, the filename is the device's LOCAL wall clock — and the product buckets by LOCAL season. Amended precedence (wall > instant at equal tier), recorded it in the decision log, updated the model spec with the rationale.
**Result:** ✅ — acceptance spec green across all 18 media cases; the amendment also cleanly justified "fs-mtime never determines".
**Lesson:** when code disagrees with a fixture's planted expectation, the fixture is a spec surface — resolve the conflict by REASONING about the domain, then record the decision in the decision log; silently editing either side loses the design insight. Fixture-first caught a real precedence flaw before any real data.   → link: MASTER_PLAN.md decision log · src/meta/evidence.mjs

### EXP-0004 · 2026-07-24 · ✅ · #meta #dates #timezone #testing #fixtures
**Context:** building the date-evidence model — filename detectors had to be tested against fixture ground truth whose epoch case (`1374250121884` → "2013-07-19 18:08:41") is written in the OWNER'S local time.
**Tried / did:** modeled two distinct claim shapes instead of one Date: `wall` (naive local components, what `IMG_20140121_183801` and EXIF encode) vs `instant` (absolute UTC, what epoch names and mvhd encode). Tests assert wall claims against ground-truth strings (TZ-free) and instant claims against exact epoch ms — never a locally-formatted epoch string.
**Result:** ✅ — 25 new specs green on first run, portable across machines/timezones; the wall-vs-instant split also cleanly defers "which local time converts an instant to a season" to the plan phase instead of burying it in a parser.
**Lesson:** never collapse wall-clock and UTC date claims into one type — the distinction is exactly where photo tools silently mis-shelve files by a few hours around midnight/New Year. Keep TZ conversion a single explicit plan-phase decision; test each claim shape in its own domain.   → link: src/meta/evidence.mjs · tests/meta_filename_date.test.mjs

### EXP-0003 · 2026-07-24 · ✅ · #fixtures #binary #exif #testing
**Context:** first product code — the fixture generator needed JPEGs with real EXIF dates and MP4s with real mvhd dates, without any dependency.
**Tried / did:** hand-built minimal binaries: JPEG = SOI + APP1(TIFF IFD0→ExifIFD→DateTimeOriginal) + COM-uniqueness + EOI (64-byte TIFF, offsets computed by hand); MP4 = ftyp + moov/mvhd (creation_time = unix + 2082844800) + free-box uniqueness. Tests assert the planted date strings/values are literally in the bytes.
**Result:** ✅ — 5/5 specs green on the first `npm test` run; generator is deterministic byte-for-byte.
**Lesson:** for *metadata* fixtures, magic-correct minimal files beat real sample media: zero deps, bytes reviewable, and "the date is really in the file" is itself assertable. Decodable pixels are only needed when perceptual hashing arrives.   → link: tests/fixtures/make.mjs

### EXP-0002 · 2026-07-24 · ✅ · #research #survey #privacy
**Context:** studying the owner's real archive (read-only grant) to ground fixtures and the date-evidence model.
**Tried / did:** one recursive inventory into a scratchpad CSV, then a single Node analysis script (extension histogram, ordered regex pattern classifier, dup proxy by size+name, mtime histogram). Committed only aggregates — no real paths/names (public repo).
**Result:** ✅ — survey found decisive facts imagination would have missed: 44% dates-in-filenames, epoch-ms names, Cyrillic *extension*, "+"-twins, an mtime bulk-copy spike, owner's own hand-made season dirs incl. autumn.
**Lesson:** before designing parsers, measure the real corpus once, cheaply, read-only — and keep raw data in scratchpad, aggregates in the repo. The ordered first-match-wins pattern classifier prototype is directly reusable in `src/meta/`.   → link: researches/02_real_archive_survey.md

### EXP-0001 · 2026-01-01 · ✅ · #example #meta
**Context:** first task after KAIF was deployed into this project (example entry — replace with real ones).
**Tried / did:** wrote the first real lesson here in the canonical format.
**Result:** ✅ — the experience log is live and greppable.
**Lesson:** capture lessons at the level of *approach* (what worked / what to avoid), not defect detail
(that lives in `bugs/`); one short entry beats a long story.   → link: (none)
