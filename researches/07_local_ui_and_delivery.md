# Research 07 — Prior art: a local Web UI for a desktop tool, and getting it onto a normal PC

> **Type:** prior-art review (`AGENT_GUIDE.md` checklist step 9a) — required before the interface
> epic, which is epic by every threshold: a new subsystem under `src/`, a new promise to the owner
> («обычные ПК юзеры»), an installer, and its own multi-step plan.
> **Status:** ✅ done 2026-07-28. **Feeds:** `interviews/interview_003_interface.md` (the five design
> variants and the forks the owner must close) and the epic plan that follows it.
>
> **Sourcing rule:** every claim carries a link opened in this session, or is marked as unverified.
> Sources I could not open are listed in §8 rather than quoted from memory.

---

## 1. The question, and the constraints it must be answered against

**Question.** KPOT is a CLI for a person who does not open terminals. The owner decided the interface
on 2026-07-28: a **local Web UI** plus an **installer that puts a desktop shortcut**, covering the
full cycle, for **inexperienced PC users**. What has the field already settled about (a) shipping a
browser UI for a local tool, (b) getting a Node program onto a normal Windows PC, and (c) presenting
an irreversible operation so a non-technical person understands it before pressing the button?

| Constraint | Source |
|---|---|
| Near-zero dependencies; no native build | `AGENT_GUIDE.md` §Code style |
| Node ESM, no build step, Node ≥ 20; the core already emits `--json` artifacts | `MASTER_PLAN.md` decision log |
| Windows-first, Cyrillic and long paths | `researches/02` |
| The audience cannot be assumed to have Node, a terminal, or admin rights | owner, 2026-07-28 |
| Every word must be plain Russian without jargon | owner, 2026-07-28 (capitalised) |
| Safety outranks tidiness — the UI must make the four guarantees VISIBLE, not hide them | `GOAL.md` |

## 2. The established approach: a local HTTP server the browser opens

This is a mature, boring pattern with well-known reference implementations — Syncthing, Jupyter,
Glances and the whole class of "webui" tools. Two facts read from the primary docs:

- **Syncthing** binds its GUI to `127.0.0.1:8384` by default; the docs state the port was chosen
  because it is "an unusual enough port that it's usually free", and that Syncthing **picks a random
  unprivileged port if it is unavailable at installation**
  ([docs.syncthing.net/users/guilisten](https://docs.syncthing.net/users/guilisten.html), opened
  2026-07-28). The same page warns that binding to a LAN address does **not** restrict who can reach
  it, and that exposing the GUI needs a username, a strong password and HTTPS.
- **Jupyter Server** uses **token authentication on by default**, and issues a session cookie after
  the token is accepted ([jupyter-server security docs](https://jupyter-server.readthedocs.io/en/latest/operators/security.html),
  opened 2026-07-28). Its own guidance frames the token as protection against *other local users and
  web pages*, not only against the network.

The lesson for us is that both of these projects treat "it only listens on localhost" as **not
sufficient by itself** — which §5 explains.

## 3. The reference basis for the parts that are not folklore

- **Localhost is reachable from the open web.** The 2024 "0.0.0.0 Day" work by Oligo Security
  documents browsers letting public pages talk to services on the local machine
  ([oligo.security](https://www.oligo.security/blog/0-0-0-0-day-exploiting-localhost-apis-from-the-browser)
  — search result, abstract level, see §8).
- **DNS rebinding against a local UI is a real, filed vulnerability class, not a thought experiment.**
  Glances — a tool of exactly our shape — carries a published advisory for its web UI lacking Host
  validation ([GHSA-hhcg-r27j-fhv9](https://github.com/nicolargo/glances/security/advisories/GHSA-hhcg-r27j-fhv9)).
  NCC Group's Singularity project documents the defence: **validate the `Host` header against a
  whitelist** ([Preventing DNS Rebinding Attacks](https://github.com/nccgroup/singularity/wiki/Preventing-DNS-Rebinding-Attacks)).
- **CSRF applies to localhost like any other origin** — a local server that trusts a cookie can be
  driven by any page the user has open ([instatunnel write-up](https://medium.com/@instatunnel/your-dev-server-is-not-safe-the-hidden-danger-of-csrf-on-localhost-36fed5cf0e38),
  search-result level).
- **Node Single Executable Applications are no longer experimental folklore.** Node's own SEA
  documentation exists ([nodejs.org/api/single-executable-applications](https://nodejs.org/api/single-executable-applications.html)),
  and Node **25.5.0 added `--build-sea`**, collapsing the old copy-binary + `postject` dance into one
  step ([nodejs.org release notes](https://nodejs.org/en/blog/release/v25.5.0)). `vercel/pkg` is
  deprecated in favour of SEA (community-maintained since).
- **UX of dangerous actions** has a well-developed practitioner literature; the most concrete
  catalogue I opened is Smashing Magazine's *How To Manage Dangerous Actions In User Interfaces*
  ([smashingmagazine.com, 2024-09](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/),
  opened 2026-07-28), and NN/g's *Dangerous UX: Consequential Options Close to Benign Options*
  ([nngroup.com](https://www.nngroup.com/articles/proximity-consequential-options/), search-result
  level).

## 4. The alternatives, judged against §1

**(A) How the window is drawn**

| Option | Weight | Verdict against our constraints |
|---|---|---|
| **Local Web UI** (`node:http` + a static page, browser opens it) | 0 new deps | ✅ **the owner's choice**, and the cheapest by a wide margin. The core already emits the SortPlan as JSON, so the UI is a second renderer |
| Electron | ~150 MB, first heavy dependency | ❌ rejected by the owner: «локальный Web UI - это сильно проще» |
| Tauri / WebView2 | ~10 MB, but a Rust toolchain in a Node project | ❌ same rejection; also an architecture fork |

**(B) How it gets onto a normal PC — this is the part the owner made a first-class requirement**

| Option | What the user does | Cost / risk |
|---|---|---|
| `npm i -g kpot` | installs Node, opens a terminal | ❌ fails the audience test outright |
| **Portable ZIP + `.cmd`** | unzip, double-click | ✅ no admin rights, no installer, no signing — but requires Node present, and "unzip somewhere sensible" is already a decision a non-technical user can get wrong |
| **Single `.exe` (Node SEA)** | double-click | ✅ no Node needed, no admin rights. ⚠️ SmartScreen (§5), and a ~50–80 MB binary because it carries Node |
| **Installer (Inno Setup / NSIS)** bundling the runtime | Next → Next → Finish, shortcut appears | ✅ the most familiar path, and the only one that puts the shortcut there by itself. ⚠️ Inno's default install mode expects admin rights (the community write-up is explicit that it "won't work without admin privileges by default" — [coolaj86](https://coolaj86.com/articles/how-to-create-an-innosetup-installer.html), search-result level); ⚠️ SmartScreen again |

## 5. The failure modes other people documented — the section that changes the design

1. **"It only listens on 127.0.0.1" is not a security model.** Any web page the user has open can
   send requests to our port, and DNS rebinding defeats origin checks that rely on hostnames. The
   documented defences are cheap and must be in v1: **validate the `Host` header** against a
   whitelist (`localhost`, `127.0.0.1[:port]`), reject anything else; require a **token** minted at
   start-up and carried in the URL the tool opens (Jupyter's model); and treat any state-changing
   request without that token as hostile (CSRF). For a tool whose one dangerous button MOVES 71 606
   of the owner's photographs, this is not optional.
2. **The port will be taken one day.** Syncthing's own answer — try the default, fall back to a
   random unprivileged port — is the field-proven behaviour. The corollary is that the tool must
   *tell the user the URL it actually used* rather than assume the default, and that the shortcut
   cannot hard-code a port.
3. **The browser can open before the server is listening**, which shows the user a connection error
   on their very first run. The fix is trivial and easily forgotten: open the browser only after the
   `listening` event.
4. **A server left running** after the window is closed is the classic complaint about this class of
   tool: the user "closed the app" and it is still there. Closing a browser tab tells the server
   nothing. Needs an explicit answer in the design (a Stop button, an idle timeout, or a tray-free
   "this window IS the app, closing it stops the run" contract).
5. **SmartScreen will warn on an unsigned installer or exe.** The warning does not mean malware —
   it means Windows has not built reputation for the file yet — but a non-technical user reads
   "Windows protected your PC" as "this is a virus". In managed environments unsigned binaries can
   be blocked outright by App Control/EDR ([komurasoft guide](https://comcomponent.com/en/blog/2026/05/11/000-windows-smartscreen-code-signing-guide/),
   search-result level; [electron-builder #628](https://github.com/electron-userland/electron-builder/issues/628)
   is the canonical thread of users hitting it). Certificates cost real money per year — this is an
   owner-level decision, not an implementation detail.
6. **Confirmation fatigue.** Smashing's catalogue is blunt: modals used for routine actions train
   users to click through them, which destroys the protection exactly when it matters. Friction must
   be **proportional to reversibility** — and KPOT is unusual here in a good way: its sort IS
   reversible (backup + journal + rollback), so the honest design gives the *plan* the friction and
   the *execution* a visible undo, rather than stacking scary dialogs.
7. **Dangerous options next to benign ones** (NN/g) — "Выполнить" must not sit where "Показать план"
   was a moment ago.
8. **Too many installer choices.** The Inno Setup practitioner guidance is "don't make users make so
   many choices; fewer dialog steps is better" — which for us means: no component pickers, no path
   pickers if we can avoid them.

## 6. What this means for KPOT specifically

- The UI is a **second renderer over the SortPlan**, so the safe architecture is: `src/ui/` serves
  static files and a tiny JSON API that calls the SAME functions `bin/kpot.mjs` calls. RULE 1 stays
  intact — only `src/apply/` writes, and the UI is just another caller above it.
- The four `GOAL.md` guarantees (карта → бэкап → сухой прогон → откат) become **four visible states**
  instead of four flags. That is the strongest argument for the UI existing at all, and it should
  drive the layout rather than be a footnote in it.
- **Long-running work needs progress in the browser.** The core already has `src/core/progress.mjs`
  emitting to stderr; the UI needs the same events over HTTP. Server-Sent Events (`text/event-stream`)
  are one line of Node and need no dependency — WebSockets would need one.
- **Thumbnails are the open question.** A photo tool that shows no photographs will feel wrong, but
  we decode nothing today except in the pixel search, and decoding 71 606 files to draw a grid is a
  different product. This is a fork for the owner (interview §Q5), not a decision to slip in.

## 7. Recommendation

1. **Local Web UI on `127.0.0.1`, default port with random fallback, token in the opened URL, `Host`
   header whitelist, and the browser opened only after `listening`.** All four are cheap, all four
   are documented failure modes, none of them is a dependency.
2. **Delivery: ship BOTH a portable ZIP and an installer, but design for the installer** — it is the
   only variant that satisfies «обычные ПК юзеры» without a terminal. Bundle the runtime via Node SEA
   (`--build-sea`, Node ≥ 25.5) so the user needs no Node; accept a ~50–80 MB download.
3. **Do NOT buy a code-signing certificate yet.** Ship unsigned with an honest, plain-Russian page in
   the README and in the installer telling the user exactly what SmartScreen will say and why. Revisit
   when there are users who are not the owner. *(This is an owner decision — interview §Q3.)*
4. **Friction where it belongs:** the plan gets the attention (it is long, readable, printable), the
   execution gets one deliberate confirmation naming the numbers («перемещу 71 606 файлов»), and the
   undo stays visible on screen after the run instead of living in a report footer.
5. **What we are deliberately NOT doing:** no accounts, no cloud, no LAN access in v1 (the owner has
   not asked for it and it turns every §5.1 risk from theoretical into real), no auto-update, no
   telemetry, no thumbnails until the owner says so.

## 7a. What the owner decided, and the measurement that supports it (2026-07-29)

The recommendation above said "design for the installer". **The owner chose the portable package
instead** — «проще портабл. Скачал - распаковал - готово» — and «портабл - нет этой проблемы» about
signing. Two measurements taken on this machine settle whether that is as clean as it sounds:

| Measured 2026-07-29 | Value |
|---|---|
| `node.exe` (v24.15.0) Authenticode signature | **Valid**, `CN=OpenJS Foundation` |
| `node.exe` size on disk | 87.4 MB |
| …compressed into a ZIP | **32.7 MB** (63% reduction, 4 s) |

**He is right, and for a better reason than "installers are scary".** A portable package that ships
**Node's own signed binary** plus our `.mjs` sources never introduces an unsigned executable at all —
so the SmartScreen *unknown publisher* prompt, which §5.5 flagged as the worst first-run experience,
has nothing to fire on. The single-exe (SEA) route would have re-created exactly that problem, because
injecting our code into the binary invalidates its signature. Choosing portable therefore **deletes**
the code-signing question rather than deferring it — and the whole download is 33 MB, not 50–80.

**The residual, stated honestly and NOT yet verified locally:** files extracted from a ZIP downloaded
by a browser inherit the Mark-of-the-Web, and Windows' Attachment Manager can still show an
"Open File — Security Warning" on a `.cmd` launcher (this is a different mechanism from SmartScreen
reputation). The design answer is to make that a one-time event: the first run offers to create a
desktop shortcut, and a shortcut created locally carries no Mark-of-the-Web, so every later launch is
silent. **This must be verified on a real download before the epic plan promises it.**

## 8. Sources I could not open — listed, not quoted

- The Oligo "0.0.0.0 Day" post, the NN/g proximity article, the SmartScreen/code-signing guides and
  the Inno-Setup-for-Node write-up were read at **search-result summary level only**; every claim
  taken from them is attributed as such above and none of them load-bears alone.
- Node's SEA documentation page and the 25.5.0 release notes were surfaced by search; the
  `--build-sea` claim should be re-verified against `node --help` on the machine before the epic
  plan commits to it (it is the kind of fact that changes between releases).
- No Russian-language UX sources were consulted; the plain-language requirement is the owner's own
  wording and needs no citation.

## Links

- `interviews/interview_003_interface.md` — the five designs and the forks this feeds.
- `ideas/02_electron_gui.md` — the owner's answers that set the direction.
- `ideas/01_inbox_topup_flow.md` — folds into this epic (the shortcut IS the UI's shortcut).
- `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` — RULE 1/2, which the UI must not bend.
