# Bug 08 — the release notes were nearly a copy of the README

**Status:** ✅ FIXED (found and fixed 2026-07-29) · **Version/build:** `main` @ release 0.2
**When/context:** found by the owner minutes after 0.2 was published, in the same wave as `bugs/07`.
His words: **«зачем в релиз ноутсы попала почти вся копия README - это НЕПРАВИЛЬНО!»**

## Symptom

The published notes for `v0.2` were **34 430 bytes / 383 lines**, and most of that was the README
said again: the whole "what KPOT is" tour, the full install section, the platform warning paragraph
about what Windows may show, and a feature list that repeated the README's bullets nearly verbatim
in both languages.

A person opening a release wants to know *what changed and whether to update*. They were handed the
product manual instead, and had to hunt for the delta inside it.

## Root cause — the template invited it

This is not "the agent padded the notes". The `/release` skill's Step 6 asked for exactly this
shape:

> «Structure per language: a header line (release date · place), a one-paragraph "what this release
> is", **a short "what X is" paragraph**, the attached artifacts, a ✨ What's new section, and a
> **🚀 Get started** section.»

The agent followed the template faithfully. «A short *what X is* paragraph» plus «a Get started
section» are, in a project whose README already contains both, an instruction to duplicate — and
"short" is not a boundary anyone can check. **The defect was in the instruction, and an instruction
can be followed into a bad result just as easily as it can be broken.** That class is worth naming:
a rule violated is loud, a rule *obeyed* into the wrong outcome is silent.

Secondary cause: no mechanical test of scope existed. Every other release field had a check —
versions, artifacts, hashes, test counts — so every other field was right.

## The fix

**The distinction, in the owner's own framing:**

| | answers | written from |
|---|---|---|
| **Release notes** | «what changed in THIS version, should I update?» | the delta of this version + a **brief** quick start |
| **README** | «what is this and how do I use it?» | the product in the present tense, not a version |

**And the sources of inspiration are different — the rule that was missing entirely:**

- updating the **README** → draw on the project's **current README and the neighbouring READMEs in
  the owner's other repositories**. It is the owner's shopfront and must keep his handwriting, not
  the agent's;
- updating the **release notes** → draw on **the existing notes of this project's previous
  releases** (`gh release view <prev> --json body -q .body`), and write about the version being
  shipped.

**The mechanical check**, now in the skill so it is not a matter of taste:

> **If a paragraph could be pasted into the README unchanged, it belongs in the README, not in the
> notes.**

Landed in `.claude/skills/release/SKILL.md` Step 6, which now carries the 🚫 rule, the two-document
table, the different sources, and this check — with the incident quoted so a future session sees why
the wording changed.

## Verification

The notes were rewritten to the delta and republished (`gh release edit v0.2 --notes-file`):

| | before | after |
|---|---|---|
| size | 34 430 bytes / 383 lines | **11 791 bytes / 170 lines** (−66 %) |
| product description | full tour, twice (EN + RU) | one line + **a link to the README** |
| install | the complete section | one download line + two commands |

Nothing about the release was lost — only the repetitions. Both artifacts stayed attached, the tag
was untouched, and the owner confirmed the result: **«сейчас стало хорошо, сильно меньше стали релиз
ноутсы - супер»**, and separately that the header image should stay («картинка в релиз ноутсах - это
хорошо, мне нравится»), which is now recorded as part of the house style rather than left to guess.

## Decisions made without the owner

1. **Which paragraphs to cut** — chosen by the paste-test above rather than by feel, so the rule and
   the edit agree with each other.
2. **The honest-limits section was KEPT** despite being long, because it is release-specific (what
   is unverified *as of 0.2*) and does not exist in the README in that form.
3. **The header image and the bilingual anchors were kept** as house style — confirmed by the owner
   afterwards.

## Links

- `.claude/skills/release/SKILL.md` Step 6 — the wording that invited it, and the rule that replaced it.
- `bugs/07_DONE_brand_decision_without_owner.md` — the other defect from the same wave.
- KAIF, for the framework's own 2.1 work: `ideas/19_kaif_2.1_scope.md` item 8, and the field report
  `ideas/ai_agents_reports/20_blanket_approval_and_notes_scope_field_report.md`.
- https://github.com/MikalaiKryvusha/KPOT/releases/tag/v0.2
