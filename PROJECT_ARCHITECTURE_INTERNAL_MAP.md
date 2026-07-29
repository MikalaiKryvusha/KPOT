# KPOT — Internal architecture map

> **The INTERNAL map: the project's logical architecture** — the abstraction objects the project's sphere
> works in, their essence, and how they interact. Where `PROJECT_STRUCTURE_EXTERNAL_MAP.md` says *where
> things live*, this says *how the system thinks*. A fresh session reads this to understand the model, not
> just the file layout.
>
> **Adapt the abstractions to the sphere:**
> - *Programming* — modules, interfaces, objects, data structures, data flows, state, protocols.
> - *Science* — hypotheses, variables, models, datasets, methods, inference chains.
> - *Sociology* — subjects, objects, institutions, roles, the relations between them.
> - *Business* — actors, processes, value flows, resources, constraints.
> - …and so on for any sphere. If unsure, describe the domain's nouns and the verbs that connect them.
>
> **Living reference — never DONE-tagged.**

---

## The core abstractions

> ✅ **Model first, code following — as of 2026-07-26 every abstraction below exists in code and is
> covered by specs.** Evidence (`src/meta/evidence.mjs` + `filename_date.mjs`) · DateVerdict
> (`src/meta/resolve.mjs`) · Asset (`src/scan/`) · DuplicateGroup (`src/dedupe/dedupe.mjs`) · Bucket
> (`src/plan/season.mjs` + `bucket.mjs`) · SortPlan and Operation (`src/plan/plan.mjs`) · RunJournal
> (`src/core/journal.mjs`) · **Backup** (`src/apply/backup.mjs` — manifest + hardlink snapshot,
> Phase 4). Sphere: programming.
>
> One deviation from the originally planned file layout, decided by the agent while building Phase 4
> and cheap to reverse: there is no separate `src/report/`. Each phase renders its own owner-facing
> report from its own artifact, in the module that owns that artifact (`renderPlan` in `plan.mjs`,
> `renderApplyReport` in `apply.mjs`, `renderRollbackReport` in `rollback.mjs`). The rule the layout
> was protecting — "reports are rendered FROM the artifact, never assembled independently" — is
> preserved; a separate directory would only have added a hop (KISS, `PHILOSOPHY.md`).

| Abstraction | What it *is* (essence) | Responsibility |
|-------------|------------------------|----------------|
| **Asset** | One media file found in the user's chaos — a photo or video, identified by its absolute path | Carries its identity: path, size, kind, content hash. Never mutated; it *describes* a file, it is not the file |
| **Evidence** | A single *claim about when an Asset was captured*, together with where the claim came from and how much it is worth (EXIF `DateTimeOriginal`, a date in the filename, a sidecar, the filesystem mtime, the enclosing directory's name) | Makes date-guessing auditable: every claim is attributable and rankable |
| **DateVerdict** | The resolved answer for one Asset: a date (or an explicit *unknown*), the confidence, and the full list of Evidence that produced it — including the Evidence it overruled | The heart of the product. `GOAL.md` demands disputed cases be documented, so a verdict must keep its losers, not just its winner |
| **DuplicateGroup** | A set of Assets judged to be the same content under different names/locations | Decides which copy is the *keeper* and which are copies, and why |
| **Bucket** | A destination in the target library — `<year>/<season>/`, or one of the "прочее" fallbacks (per-year, and the global one for undatable Assets) | Turns a DateVerdict into a place, and is the only thing that knows the season boundaries |
| **Operation** | One intended filesystem change: *move this Asset to this Bucket under this name* (or: skip, or: keep as duplicate) | The atomic unit of the whole tool. Produced by planning, consumed by execution, replayed by rollback |
| **SortPlan** | The complete ordered set of Operations for a run, plus the disputed cases and the collisions found | The artifact the owner reviews **before** anything moves. The dry run and the real run execute the *same* SortPlan |
| **RunJournal** | The append-only record of a run: the SortPlan, the backup reference, and what actually happened to each Operation | Makes a run resumable, auditable, and — critically — reversible |
| **Backup** | The restorable snapshot of the source tree taken before the first write — a manifest of every file AND every directory, plus a hardlink shadow tree | The owner's undo button. Without it, `apply` must refuse to run. It records directories because a folder holds no bytes: nothing else remembers one existed |
| **Decision** | The owner's answer about one directory whose NAME does not say whether it is theirs or a program's: *sort it* or *leave it as it is* | Keeps a judgement call the tool cannot make out of the tool's hands. Until it exists, the folder is set aside WHOLE in `НА_РАЗБОР/` rather than taken apart on a guess |
| **ScanCache** | What a file's content was last time it was seen, keyed by (path, size, mtime) | Makes repetition affordable. Hashing 551 GB is hours, and the normal way the product is used — read the plan, re-run; dry run, real run — repeats it |

## How they interact

One pipeline, four user-visible phases, and a hard wall between *deciding* and *doing*. Everything left
of the wall is pure and read-only; only `apply` crosses it.

```
  user's chaotic tree
          │
  [scan]  ├─▶ Asset ──────────────┬──▶ DuplicateGroup ─┐
          │      │                │   (by content hash)│
          │      └──▶ Evidence ───┴──▶ DateVerdict ────┤
          │           (many per Asset)  (one per Asset)│
          │                                            ▼
  [plan]  │                              Bucket ◀── SortPlan ──▶ disputed cases + collisions
          │                                            │              (shown to the owner)
════════════ the wall: nothing above ever writes ══════│═══════════════════════════════════
          │                                            ▼
  [apply] │            Backup ──guards──▶  Operation × N ──▶ RunJournal
          │                                            │
          ▼                                            ▼
   organised library                          post-sort report ──▶ [rollback]
```

Reading the flow:
- **scan** produces Assets and their Evidence; it decides nothing and writes nothing.
- **plan** resolves each Asset's Evidence into one DateVerdict, groups duplicates, maps verdicts onto
  Buckets, and emits a SortPlan — a complete list of Operations plus everything ambiguous about them.
- **apply** takes a SortPlan and executes it — but only after a Backup exists. In `--dry-run` it walks
  exactly the same Operations and writes exactly the same RunJournal, minus the filesystem calls.
- **rollback** replays the RunJournal backwards against the Backup.
- Reports are always rendered *from* the SortPlan and the RunJournal, never assembled independently —
  so what the owner reads is provably what the tool did.

## Invariants & rules of the model

These hold at all times. Breaking one is a bug even if the run completes and the output looks right.

1. **No write without a Backup.** `apply` refuses to start if a Backup for this run does not exist.
2. **Dry run ≡ real run.** Both execute the same SortPlan through the same code path; the only
   difference is whether filesystem calls fire. If a dry run and a real run can diverge, that is a bug —
   `GOAL.md` requires the dry run to be "почти 1 в 1" the real one.
3. **Every DateVerdict is explainable.** A date is never invented. A verdict names its Evidence and the
   rule that picked the winner; an Asset with no usable Evidence gets *unknown* and goes to global
   "прочее" — it is never quietly assigned to a plausible year.
   *Sharpened 2026-07-28 by the pixel search (`src/meta/pixels.mjs`):* where a claim rests on a
   COMPARISON rather than on a record, the comparison must be decided **by the margin between the best
   and the second-best candidate, never by a threshold**. Measured on the owner's archive
   (`researches/06` §3), the best candidate can score better than a true original even when the true
   original does not exist — so a threshold would have fabricated dates while looking rigorous. No
   decisive margin means *unknown*, exactly as no evidence does.
4. **Conflicts surface, they do not resolve themselves.** Contradicting Evidence, ambiguous seasons and
   destination collisions are recorded in the SortPlan's disputed section and shown to the owner.
5. **Nothing the owner put there is destroyed.** Operations move; they never delete a file. Duplicates
   are set aside, not erased — removing a user's file is the owner's decision, not the tool's.
   *Amended 2026-07-26 (decision log):* the one exception is a **directory the sort itself emptied**,
   which KPOT may remove — and only because the Backup records every directory that existed, so
   rollback recreates it. The invariant that actually holds is therefore: nothing disappears that the
   RunJournal and the Backup cannot bring back. A folder that was already empty before the run, or
   that still holds anything at the moment of deletion, is never touched.
6. **The user's names survive.** An Asset's original filename is preserved; meaningful source directory
   names are preserved as far as the target layout allows. Renaming is a fallback for collisions only,
   and every rename is recorded.
7. **Every Operation is reversible.** If it cannot be expressed as an entry in the RunJournal that
   rollback can undo, it must not be performed.
8. **A run is resumable.** An interrupted `apply` leaves a journal that describes exactly which
   Operations completed, so the run can be continued or rolled back — never a half-state nobody can read.
9. **Identity is content, not name.** Two Assets are the same iff their content hashes match; filenames
   and timestamps are evidence, never identity.
10. **A judgement the tool cannot make is not made.** Where a directory's name does not say whether it
    is the owner's or a program's, the folder is set aside whole and the owner is asked — never taken
    apart on the more likely reading. *(2026-07-26; the same principle as invariant 3, applied to
    structure instead of dates.)*
11. **Sorting is idempotent.** Sorting an already-sorted tree moves nothing: KPOT recognizes its own
    output as structure. Violating this does not merely waste work — it nests folders one level deeper
    per run and demotes correctly-shelved files (`bugs/01_DONE_sort_not_idempotent.md`).

## Key decisions embedded in the architecture

- **Evidence is a first-class object, not an implementation detail.** The naive design resolves a date
  inline and returns a `Date`. That design cannot satisfy `GOAL.md`'s requirement to document disputed
  cases, and it makes every wrong verdict unexplainable. Keeping the losing claims costs memory and
  buys auditability — the trade the product is actually about.
- **The plan is an artifact, not a step.** Making SortPlan a serialisable object (rather than "the code
  moves files as it walks") is what makes the pre-sort map, the dry run, the post-sort report and
  rollback all fall out of one mechanism instead of four.
- **A single writer.** Concentrating every mutation in `src/apply/` means the safety invariants can be
  enforced in one place and tested in one place. The cost is an extra hop for the caller; the benefit is
  that "did we write something we shouldn't have?" is answerable by reading one module.
- **A single executor, several faces** *(added 2026-07-29, phase 6.0)*. `src/app/phases.mjs` composes
  the pipeline and returns artifacts; a face (the terminal, and the web interface of Phase 6) decides
  only wording and exit codes. The alternative — each face composing the pipeline itself — would give
  the dry run and the real run two code paths, which is invariant 2 broken by construction rather than
  by accident. Two consequences worth stating: the apply phase's four endings became **named values**
  rather than printed sentences, because a printed sentence is not something a second caller can branch
  on; and the archive-root check moved DOWN out of the CLI, since it turned out that asking the pipeline
  about a mistyped path used to *create* that directory — a guard living in a face protects only that
  face.
- **Unknown is a real answer.** Modelling *undatable* explicitly (rather than defaulting to mtime)
  keeps the global "прочее" bucket honest — the alternative silently fabricates chronology, which is the
  exact chaos the tool exists to remove.

See `MASTER_PLAN.md` → Decision log for the dated record of these choices. As of 2026-07-26 **nothing
in that log is open**: season boundaries, reuse-vs-write and the backup mechanism are all settled, and
the later owner decisions (duplicate layout, technical vs custom dirs, emptied-folder deletion, the
`НА_РАЗБОР/` approval quarantine, the GUI's timing) are recorded there too.

---

> Keep this in sync with the real logic as it evolves. When you introduce or retire an abstraction, or
> change how they interact, update this map in the same change. File/directory placement belongs in
> `PROJECT_STRUCTURE_EXTERNAL_MAP.md`.
