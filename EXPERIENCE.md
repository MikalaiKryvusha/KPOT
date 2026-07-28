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

### EXP-0013 · 2026-07-28 · ✅ · #research #design #measurement #prior-art #risk
**Context:** first task under the owner's new canon rule (AGENT_GUIDE step 9a — before an epic feature, web-search the field and write a prior-art review). The feature: find an edited photo's original by its pixels. `plans/02` already contained a design for it — dHash/aHash over downscaled copies, dependency `jpeg-js` "MIT".
**Tried / did:** did the literature pass, then did NOT stop there. Two cheap probes on the owner's real archive, read-only: (1) the single risk that could kill the whole feature — the broken class is saved as PROGRESSIVE JPEG (`SOF2`) and the decoder's README never claims to support it; (2) a CONTROLLED experiment with known ground truth — take 40 real photos, crop them myself in the same shape the real Photoshop export has, and measure whether a global hash still recognises them, **reported against the distance between unrelated photos** (the framing borrowed from the DFRWS Hamming-distributions paper: a distance means nothing without knowing what chance looks like).
**Result:** ✅ risk dead (25/25 progressive decoded, 0 failures, ≈76 ms/MP). ✅ the planned algorithm REFUTED: a 10% crop moves dHash by 19 bits — the same as the *minimum* between two unrelated photos, so no threshold can separate them; blockhash degrades far better (16 vs chance 32 at the real crop ratio) but still overlaps. ✅ a wrong fact in the plan caught: `jpeg-js` is BSD-3-Clause, not MIT. The replacement design — collapse the candidate set using what step 1 already knows, then decide by the MARGIN between best and second-best rather than a threshold — is strictly better and cheaper.
**Lesson:** a prior-art review is not a literature summary, it is a **decision document**, and two moves make it one. First, **hunt the one unknown that could kill the feature and settle it with a probe before anything else** — here a decoder's silence about progressive JPEG, which no amount of reading would have resolved. Second, **run a controlled experiment with ground truth you construct yourself** (crop the photos rather than hunting for a known crop+original pair), and always report the signal against the noise baseline — an absolute distance is uninterpretable. The payoff is asymmetric: this review cost one session and deleted a design that would have shipped invented dates.
**Repro:** for any similarity/matching feature: build ground-truth pairs by transforming real files yourself, then report `stats(distance | same, transformed)` next to `stats(distance | different)`; if the distributions touch, a fixed threshold is unsafe and you need either a smaller candidate set or a margin-based decision. Scripts: scratchpad `probe/probe.mjs` (decoder feasibility + cost) and `probe/crop_experiment.mjs` (the controlled crop measurement), session 2026-07-28.   → link: researches/05_perceptual_hashing.md · plans/02_lost_photo_family.md
**Not for:** features with no external body of knowledge and no measurable risk — there the gate costs a session and buys nothing. And the margin-over-threshold trick only applies when you can bound the candidate set; over an open corpus you are back to thresholds and their false positives.

### EXP-0012 · 2026-07-28 · ✅ · #recon #backlog #estimation #real-data #observation
**Context:** taking the last open Phase-2 item, which `STATUS.md` had described for four days as "small, self-contained… optional filler": THM/XMP sidecar evidence. The framing implied a nice-to-have that merely corroborates dates KPOT already has.
**Tried / did:** followed the canon anyway (AGENT_GUIDE step 9 — external truth ⇒ recon doc BEFORE code) and read the real files first, read-only: 34 `.thm`, 1 `.xmp`. Then, before writing a line, ran the EXISTING pipeline over the directories holding them to measure what KPOT says about those files today.
**Result:** ✅ the "filler" was load-bearing. 25 of the 34 THMs sit beside an **AVI** — RIFF, not ISO-BMFF, so our `mp4.mjs` extracts nothing — and those 25 videos were ALL `partial`, i.e. a folder year with no season. The sidecar is their only date; after implementing, 25/25 are `dated` to the second. The same recon also killed a feature I would otherwise have built confidently: the single real `.xmp` is an ACDSee catalog file with **zero** date properties, so the XMP date path is fixture-only and must not claim real-data coverage.
**Lesson:** a backlog item's own description is a *hypothesis about value*, written by a past session that had not looked. Two cheap moves invert it: (a) read the real artifacts, and (b) **measure what the product says about them TODAY, before writing the fix** — the before-number is what turns "nice to have" into "this is the only date these files have", and it is the same number that proves the fix afterwards. The recon also right-sizes the OTHER direction: it stopped me claiming coverage for an XMP path nothing in the archive exercises. Corollary for priority: "small and self-contained" describes the diff, never the value — do not let it order the backlog.
**Repro:** before implementing any evidence source, run the current pipeline over the files it would affect and record the status distribution: compose `annotateAssets(root, assets)` as a library (EXP-0011 pattern, no CLI ⇒ no writes under a read-only grant), then group by `verdict.status`/`verdict.winner`. Re-run it after the change; the two tables ARE the acceptance evidence. Scripts: scratchpad `recon_sidecars.mjs` + `recon_twins.mjs` (session 2026-07-28).   → link: researches/04_sidecars.md · src/meta/sidecar.mjs
**Not for:** work with no external artifact to read (pure refactors, internal invariants) — there the recon has nothing to observe and the cost buys nothing. And it does not license scope creep: the recon here also surfaced a placement question about the THM files themselves, which was written down for the owner rather than absorbed into the task.

### EXP-0011 · 2026-07-27 · ❌→✅ · #environment #verification #real-data #acceptance #privacy
**Context:** plans/02 step 1 needed its acceptance checked "на выборке владельца" — but `KPOT_SAMPLE`, which `STATUS.md` (written the previous day) said was left sorted on disk, no longer existed. The owner had deleted it between sessions.
**Tried / did:** did NOT recreate it — 13 GB of the owner's personal photos, and a deletion by the owner may itself be a decision (space, privacy); recreating without a fresh word would overstep. Instead verified within the standing read-only grant: composed the REAL pipeline functions (`annotateAssets` over synthesized asset records) as a library from a scratchpad script — no CLI, so no `.kpot-runs` writes under the archive, no hashing, aggregates only leaving the scratchpad.
**Result:** ✅ the measurement ran on 8331 real JPEGs from two PC-dump dirs and answered the acceptance question without violating the grant or re-materializing personal data.
**Lesson:** an acceptance criterion that depends on a resource the OWNER controls (a sample dir, a device, an account) must be re-verified as existing at the start of the session that needs it — `STATUS.md` records the past, not the present. And when the resource is gone, look for a verification path inside the standing grants before asking: a read-only library composition often proves what the CLI run would have, without the writes the CLI brings (`plan` writes `.kpot-runs/` into the target — pointing it at a read-only grant is a violation even though "plan is read-only" over user FILES).
**Repro:** before relying on any owner-provided path from STATUS: `Test-Path <path>` (or `ls`) FIRST; for grant-safe measurement see the pattern in the scratchpad script `measure_plan02.mjs` (session 2026-07-27) — synthesize `{path, kind, size, mtimeMs}` records, call `annotateAssets(root, assets)`, write aggregates to scratchpad.
**Not for:** anything that needs `apply`-side behavior (backup, journal, rollback) — those can only be verified on a tree you may write to (fixtures or a fresh owner-authorized copy), never via a library detour around the grant.

### EXP-0010 · 2026-07-26 · ❌→✅ · #idempotence #testing #smoke #fixtures #design
**Context:** finishing the scan cache (Phase 5). Suite was 98/98 green, Phases 2–4 all had acceptance specs. The cache smoke run printed one extra line I had not asked for: after `apply`, a second `plan` still reported **13 moves**.
**Tried / did:** followed the line instead of dismissing it. Root cause: KPOT did not recognize its OWN output layout — `isDateStructureDir` strips the token «зима» from «Зима начало года» and sees «начало года» left over, so its own season folder looked like one of the owner's; the quarantine provenance prefix was re-applied to files already carrying one; and dirname evidence read a season only from the segment holding the YEAR, so its own `2013/Осень/` form lost the season. Every module had been built and tested against the OWNER's spelling (`осень 2013` — both facts in one segment) and never against the tool's own output.
**Result:** ✅ three fixes, 6 new specs, second plan = 0 moves. Consequences avoided: unbounded nesting per run, quarantine names growing by their whole path toward the 260-char limit, and correctly shelved files being demoted to `<год>/прочее` — the library degrading the more it was used, on an owner archive that is ALREADY hand-sorted into year/season dirs.
**Lesson:** a pipeline that transforms a tree must be tested on **its own output**, not only on the input it was designed for. Every phase spec here fed the tool a fixture and checked the result — none fed the RESULT back in, and that single missing edge hid a defect class no amount of green suite could reach. Generalized: for any transform, ask "is `f(f(x)) == f(x)`?" and make it a spec. Second lesson, about method: the finding came from *reading the output of a smoke run I did for another reason*. A number that does not match the mental model is the cheapest bug detector there is — the failure mode is skimming past it because the tests are green.
**Repro:** `node tests/fixtures/make.mjs <tmp> && node bin/kpot.mjs apply <tmp> && node bin/kpot.mjs plan <tmp> --json` → `operations` must be `[]`. Guarded permanently by `tests/idempotence.test.mjs`.   → link: bugs/01_DONE_sort_not_idempotent.md · researches/02 §Directory structure
**Not for:** transforms that are deliberately NOT idempotent (a run journal appends by design; a backup snapshot is per-run). Apply the question, not the answer — ask whether repetition should be a no-op before demanding that it is.

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
