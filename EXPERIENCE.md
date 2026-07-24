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
> ```
>
> Skill: `/experience` (capture a lesson · recall relevant lessons).

## Entries

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
