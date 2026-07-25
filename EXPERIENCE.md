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
