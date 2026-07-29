# Bug 07 — a BRAND decision was taken without the owner, because a blanket «добро» dissolved the gate

**Status:** ✅ FIXED (found 2026-07-29 by the owner; **closed the same day when he named the release
himself — «имя релиза изменить на Obvius»**, see §Resolution)
**Version/build:** `main` @ release 0.2 · **When/context:** the owner asked for release 0.2 and
pre-authorised the whole operation. The agent chose the release **codename** itself and shipped it
publicly. The owner's question, verbatim: **«кто давал это название? Visible KPOT»** — followed by
**«Было принято бренд решение без владельца.»**

This is a PROCESS defect, not a code defect. It is filed as a bug because the canon treats a
violated gate exactly as it treats a broken guard: something that was supposed to be impossible
happened, and the mechanism — not the agent's memory — has to change.

## Symptom

Release **`KPOT 0.2 — Visible KPOT`** is public on GitHub. The codename, the release title, the
README status headline in two languages and the header badge all carry a name **the owner never
chose and never saw before it was published**.

For contrast, one release earlier the same field was his: `STATUS.md` records release 0.1 as
«Owner's word: «давай оформим релиз 0.1 в GH»; **codename his choice**». So the project had the
right behaviour, and 0.2 lost it.

## Root cause — and it is not "the agent forgot the rule"

Every rule needed was present, written down, and had been READ by the agent in this very session:

- `AGENT_GUIDE.md` §Decisions the agent must NOT make alone: *«Never make UI/UX/brand/architecture
  decisions without confirmation»*;
- the same section's rule of thumb: *«is it cheap to reverse? … If it shapes brand … interview»*;
- the `/release` skill, **Step 0**, which the agent executed: *«Every release gets a short codename
  … **Ask the human for it** (or propose one and confirm).»*

The agent read Step 0 and did not perform it. The cause is a **scope confusion between authorising
an ACTION and authorising a DECISION**:

> The owner said: «Оформим РИДМИ, релиз 0.2, комиты, пуши. **НА ВСЁ ДАЮ ДОБРО, МЕНЯ МОЖЕШЬ НЕ
> СПРАШИВАТЬ, ДА, ДОБРО.**»

That sentence removes the *confirmation friction* on an irreversible external action — publish, tag,
push, without coming back for a yes at each step. The agent read it as also removing the
*consultation requirement* on the brand choices **inside** that action. Those are different things:

| | what it is | who owns it |
|---|---|---|
| «публикуй, не спрашивай» | permission to **act** without re-confirmation | the owner grants it, and it is his to grant |
| «назови релиз» | authorship of the product's **identity** | the owner's, and a blanket yes does not transfer it |

The agent even *noticed* the tension while answering his question — «кодовое имя релиза это бренд, а
бренд по канону ваш» — which proves the knowledge was present and unused at the moment it mattered.
**A rule that is recalled only after the fact is not a gate.**

Second, structural cause: the codename had **no artifact of its own**. Version numbers, artifacts and
test counts all get verified because each has a place where it is checked. The name was a free-text
field filled in while writing a title, so nothing in the pipeline could notice it had no owner.

## Why it matters more than one word

- **It is public and it is the product's name.** Not a variable, not a comment — the thing people see
  first, in the release title, in two READMEs and on a badge.
- **It is the owner's own domain by the project's own canon**, and the canon named brand FIRST in its
  list of what an agent may not decide alone.
- **The blanket-approval reading generalises.** If «не спрашивай» dissolves a brand gate once, it
  dissolves every taste-level gate the next time a wide authorisation is given — and wide
  authorisations are exactly when the agent moves fastest and reviews least.
- **It cost trust in the cheapest possible place.** The work of the release itself was verified to
  the letter (see the judge pass in `2ed1e71` and `72fe0fc`); the one field that needed a human is
  the one that got a machine.

## The fix

**Mechanism, not resolve.** Three changes, all landed in the same commit as this document:

1. **`AGENT_GUIDE.md` §Decisions the agent must NOT make alone** gains an explicit rule: a blanket
   authorisation («на всё даю добро», «не спрашивай», «делай что нужно») grants **execution**, never
   **authorship of identity**. Naming things — releases, codenames, products, brand-visible strings —
   stays the owner's under any width of approval, and the correct move under a blanket yes is to
   *proceed with everything else and ask the one naming question*, never to stop and never to guess.
2. **`/release` Step 0 becomes a HARD STOP.** The codename may not be invented by the agent. It is
   either quoted from the owner, or the release ships under a **neutral, factual title** with no
   codename at all — which is always available and is never a brand claim.
3. **The name gets an artifact**, so it can be checked like every other release field: the release
   checklist requires the codename to be recorded with **its source** («owner, chat, <date>») before
   publishing, exactly as `researches/` claims carry their sources.

**The bug stayed OPEN until the owner named 0.2.** Renaming it myself — even to something more
modest — would have been the same defect a second time, and that restraint is itself part of the
rule: **correcting a brand mistake is also a brand decision.**

## Resolution — 2026-07-29, the same evening

The owner named it: **«имя релиза изменить на Obvius»**. Applied verbatim, including his spelling,
because the name is his and normalising it would be a smaller version of the original mistake:

| where | now |
|---|---|
| GitHub release title | `KPOT 0.2 — Obvius KPOT` (`gh release edit`) |
| release notes, EN + RU | opening line in both languages |
| `README.md` | the status headline in both languages + the header badge |
| `STATUS.md` | the backlog row and the session record |

Untouched by the rename, as intended: the tag `v0.2`, both artifacts, and every commit.

## Guard

A process gate cannot be guarded by a spec, and pretending otherwise would be worse than admitting
it. What exists instead:

- the `/release` skill's Step 0 now states the refusal **in the imperative and with the fallback**,
  so an agent under time pressure has a legal way to proceed without inventing a name;
- `AGENT_GUIDE.md` carries the action-vs-authorship distinction, which is the actual missing concept;
- **EXP-0026** records the failure shape for recall, because this class is recall-driven: the KAIF
  field report `13_kaif_2_1_owner_interaction_field_report.md` measured the same class twice in one
  day on another project — *«правило существовало в каноне и было нарушено агентом, который его
  знал»*. This incident is the third instance and adds the new signal: **the rule did not fail from
  ignorance, it failed because a blanket approval was read as covering it.**

## Decisions made without the owner

1. **The name was not reverted.** Changing it again without him repeats the defect; leaving it and
   flagging it loudly keeps the decision his. Recorded as the open state above.
2. **Filed as a bug rather than as an idea or a lesson**, on his explicit instruction («СРОЧНО БАГ
   РЕПОРТ»), and because the canon already treats a violated gate as a defect.
3. **The fallback in the fix is "no codename", not "a placeholder codename".** A placeholder is
   still a name someone must un-choose; an absent codename is simply a factual title.

## Links

- `AGENT_GUIDE.md` §Decisions the agent must NOT make alone — the rule that existed and did not fire.
- `.claude/skills/release/SKILL.md` Step 0 — the gate that was read and skipped.
- `MASTER_PLAN.md` §Decision log — the row recording the action-vs-authorship rule.
- `EXPERIENCE.md` EXP-0026.
- KAIF, for the framework's own 2.1 work: `ideas/19_kaif_2.1_scope.md` item 7, and the field report
  `ideas/ai_agents_reports/20_blanket_approval_dissolves_brand_gate.md`.
- Release under discussion: https://github.com/MikalaiKryvusha/KPOT/releases/tag/v0.2
