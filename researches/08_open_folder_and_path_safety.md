# Research 08 — Opening a folder from the local server, and what "inside the library" really means

> **Type:** recon doc (`AGENT_GUIDE.md` checklist step 9b) — required before phase 6.3, the control
> panel. Everything below was **measured on this machine on 2026-07-29**, not recalled: the probe
> scripts are `scratchpad/probe_paths.mjs` and `scratchpad/probe2.mjs` of that session, and every
> number in §2 is their output.
> **Status:** ✅ done. **Feeds:** `plans/03_interface_epic.md` phase 6.3.

---

## 1. The question, and why it is not a formality

The owner cut thumbnails out of the interface and replaced them with links: «если нужно отправить
человека на просмотр - ссылки на папки» (interview #003 Q5). So the control panel will put «Открыть»
next to every year, and pressing it must show that folder in Windows Explorer.

That is a bigger deal than it looks. A browser page cannot open Explorer, so the request goes to our
local server, which **launches an external program with a path that arrived over HTTP**. Two
questions have to be answered from observation before any of it is written:

1. how does `explorer.exe` actually behave — what does it return, and what may we conclude from it?
2. what does "this path is inside the library" mean **as a security boundary**, given that
   `src/core/paths.mjs` already has an `isInside` that the whole product uses?

The token and the `Host` whitelist (phase 6.1) already keep other web pages out. This document is
about the layer beneath that: even a legitimate request must not be able to point the program
somewhere it has no business being.

## 2. What was measured

### 2.1 `explorer.exe` returns 1 even when it succeeds

| Call | Result |
|---|---|
| `explorer.exe <a real folder>` | **exit code 1** (3 tries out of 3) |
| `explorer.exe <a missing folder>` | exit code 1 |
| `explorer.exe <a file>` | exit code 1 |

**Consequence, and it is the practical one:** *the exit code carries no information*. A server that
treats a non-zero exit as failure will report "could not open the folder" every single time,
including when the window opened perfectly. So the design must **check the path itself beforehand**
and then launch without interpreting the result — the opposite of the usual instinct.

### 2.2 A junction defeats the textual containment check

This is the finding that shapes the design.

```
library : …\pq\Библиотека
secret  : …\pq\Секреты          (outside the library)
mklink /J  …\pq\Библиотека\ссылка  →  …\pq\Секреты     ← succeeded WITHOUT admin rights
```

| Check | Result |
|---|---|
| `isInside('…\Библиотека\ссылка', library)` | **`true`** — textually it is inside |
| `realpath('…\Библиотека\ссылка')` | `…\pq\Секреты` |
| `isInside(realpath(...), library)` | **`false`** — the escape is caught |

So `src/core/paths.mjs`'s `isInside` is **correct for what it was built for** — deciding where a file
belongs in the plan, where paths come from our own walk — and **insufficient as a security boundary**,
where the path comes from outside. A junction inside the library points anywhere on the machine, any
user can create one, and the textual check says "inside".

### 2.3 Short (8.3) names break the same check the other way

| Check | Result |
|---|---|
| short form of `…\Моя Библиотека Фото` | `…\D-1FBD~1\75FE1C~1\SCRATC~1\pq\D51E~1` |
| `isInside(shortForm, library)` | **`false`** — a legitimate path REJECTED |
| `realpath(shortForm)` | `…\Моя Библиотека Фото` (the long form) |
| containment after `realpath` | **`true`** — correct |

Two opposite failures, one fix: `realpath` first. It resolves junctions, symlinks and 8.3 aliases to
one canonical form, after which the existing textual check is exactly right.

### 2.4 `realpath` on a path that does not exist throws `ENOENT`

Useful rather than annoying: **a path we cannot resolve is a path we refuse.** There is no case where
the panel should open a folder that is not there, so the failure mode and the security rule agree.

## 3. What this means for phase 6.3

The rule, in one sentence: **resolve the real path first, then check containment, then launch and
ignore the result.**

```
   path from the request
        │
        ├─ realpath()  ──── throws ⇒ refuse («такой папки нет»)
        │
        ├─ isInside(real, realpath(libraryRoot)) or equal ⇒ otherwise refuse
        │
        └─ spawn explorer.exe, detached; DO NOT read the exit code
```

Three notes that belong in the operational plan rather than in someone's memory:

- **The library root must be realpath'd too**, once, at the same time. Comparing a resolved child
  against an unresolved root re-introduces exactly the mismatch §2.3 shows.
- **Equality counts as inside.** `isInside` is strict (a path is not inside itself), but "open the
  library root" is a legitimate request the panel will make.
- **Nothing is passed through a shell.** `spawn('explorer.exe', [path])` with an argument array, never
  a command string — a path is data, and this project already has Cyrillic names, spaces and
  `\\?\` prefixes everywhere.

## 4. What we are deliberately NOT doing

- **Not reusing `isInside` alone** for this. It stays what it is; the panel gets a dedicated check
  that resolves first. Widening `isInside` to call `realpath` would make a pure, synchronous,
  heavily-used helper asynchronous and filesystem-dependent, for the benefit of one caller.
- **Not opening files, only folders.** «Открыть» means "show me this place", and a file path is a
  different, larger question (which program opens it, and what that program then does).
- **Not shipping a general "open this path" endpoint.** The panel opens the library, a year inside it,
  or `НОВОЕ` — all derived from state the server already holds. The path being *checkable* is the
  backstop, not the design.

## 5. What remains unknown

- **Whether Explorer reuses an existing window** for the same folder, or opens a second one, was not
  measured — it depends on the user's Folder Options. Harmless either way, and not worth a design
  decision.
- **Behaviour on a disconnected network drive** (a UNC path in the library) was not probed: `realpath`
  would presumably block until the share times out. If the owner's library ever lives on a network
  share, that becomes a real question — recorded here rather than assumed away.
- The probes launched Explorer six times on the development machine; the windows are harmless, and
  the folders they pointed at were removed afterwards.

## Links

- `plans/03_interface_epic.md` — phase 6.3, which this unblocks.
- `src/core/paths.mjs` — `isInside` / `samePath` / `normalizeForCompare`, correct for the plan and
  insufficient here, for the reason measured in §2.2.
- `interviews/interview_003_interface.md` — Q5, the decision that replaced thumbnails with links.
- `researches/07_local_ui_and_delivery.md` §5 — the security model this sits underneath.
