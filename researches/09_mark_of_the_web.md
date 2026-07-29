# Recon 09 — the Mark-of-the-Web, and what a downloaded KPOT package actually meets

> **Type:** recon doc (AGENT_GUIDE checklist step 9b — an external truth, read from the live source).
> **Written:** 2026-07-29, before any code of phase 6.5.
> **Gate it discharges:** `plans/03_interface_epic.md` §9.1 — «метка интернета на распакованных
> файлах пока НЕ проверена на настоящей загрузке, и обещать её отсутствие нельзя».
> **Verdict in one line:** the gate is discharged, but **not** in the direction the epic expected —
> the first launch cannot be promised to be silent, on any machine, and the design must stop
> depending on it. One assumption the epic made is refuted here; one is downgraded to an open
> question.

---

## 1. The question, and our constraints

*When a non-technical person downloads the KPOT ZIP in a browser, unzips it, and double-clicks the
launcher — what does Windows show them, and can we make it show nothing?*

Constraints this must be answered against:
- the audience is **inexperienced PC users** (owner, 2026-07-28), so a scary dialog is a real cost;
- we ship **no unsigned executable** — the package carries Node's own Authenticode-signed `node.exe`
  plus our `.mjs` (epic §Фаза 6.5). That answers SmartScreen's *unknown publisher* prompt, which is
  a **different mechanism** from the one this document is about;
- KPOT may not teach anyone to disable a Windows security feature. Any answer of the shape "tell the
  user to turn X off" is out of scope by construction.

## 2. What was MEASURED on this machine (2026-07-29)

### 2.1 A real browser download — and it produced NO mark at all

A genuine Edge download over HTTPS from `nodejs.org` (throwaway `--user-data-dir`, so the owner's
profile was untouched), 34.8 MB:

```
downloaded: node-v24.15.0-win-x64.zip, 34.8 MB
--- ALTERNATE DATA STREAMS ---
Stream   Length
:$DATA   36465163
--- Zone.Identifier ---
NO Zone.Identifier stream. The browser did not mark it.
```

**This is not a fact about browsers. It is a fact about this machine**, and finding out which took one
registry read:

```
HKCU\...\Policies\Attachments     SaveZoneInformation : 1
HKLM\...\Policies\Attachments     ScanWithAntiVirus   : 3
HKCU\...\Policies\Associations    LowRiskFileTypes    : .zip;.rar;.nfo;.txt;.exe;.bat;.com;.cmd;
                                                        .reg;.msi;.htm;.html;… 
```

Both defences are switched off here, deliberately and non-default:

- `SaveZoneInformation = 1` is the ADMX policy **"Do not preserve zone information in file
  attachments"**, and Microsoft's own reference is unambiguous about the direction: *"If you enable
  this policy setting, Windows doesn't mark file attachments with their zone information… If you
  don't configure this policy setting, Windows marks file attachments with their zone information"*
  ([Microsoft Learn, AttachmentManager Policy CSP](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-attachmentmanager),
  opened 2026-07-29). Security baselines treat the value `1` as a finding to be remediated
  ([DISA STIG WN11-UC-000020](https://stigaview.com/products/win11/v2r4/WN11-UC-000020/)).
- `LowRiskFileTypes` lists `.exe`, `.cmd`, `.bat`, `.msi` as **low risk**, which is precisely the
  list that suppresses the Attachment Manager's confirmation dialog.

**Consequence, and it is the single most important line in this document: this machine cannot
validate the first-launch experience.** Every "it started silently" observation made here is void,
and phase 6.5's acceptance criterion («что именно показала Windows — записано как факт») can only be
met on a machine with default attachment policy. That is now explicit homework, not an oversight.

This is the EXP-0015 shape again, one level up: a measurement invalidated by the environment it was
taken in. The environment had to be interrogated before the measurement could be believed.

### 2.2 The propagation experiment — run, and correctly VOID

A ZIP of the package's real shape (`KPOT.cmd`, `README.txt`, `bin/node.exe`) was marked
`[ZoneTransfer] ZoneId=3` and extracted four ways. Every extractor produced **unmarked** files:
Explorer's own zip folder (`Shell.Application.CopyHere`, what «Extract All» uses), `Expand-Archive`,
bundled `tar.exe`, and `System.IO.Compression.ZipFile`.

**That result proves nothing and must not be quoted as if it did.** The policy that suppresses
marking is the same policy that would suppress propagation, so the experiment cannot separate
"Explorer does not propagate" from "this machine does not mark anything". Recorded here as a run
that failed to answer its question, rather than deleted — a void measurement that is quietly dropped
is how a wrong conclusion gets a second chance.

### 2.3 The supply chain, which IS answerable here

| Check | Result |
|---|---|
| SHA-256 of the download vs `nodejs.org/dist/v24.15.0/SHASUMS256.txt` | **identical** (`cc5149ea…bb0e62`) |
| `node.exe` inside the archive | 87.4 MB, `v24.15.0` |
| Authenticode signature | **Valid** |
| Signer | `CN=OpenJS Foundation, O=OpenJS Foundation, L=San Francisco, S=California, C=US` |

So the epic's delivery argument holds on a **freshly downloaded** binary, not merely on the one this
machine happened to have installed: shipping this file introduces no unsigned executable, and the
package's own bytes are verifiable against the publisher's list. The hash check is worth keeping as
a build step for exactly that reason.

## 3. What the LITERATURE settles (sourced, not recalled)

The reference here is Eric Lawrence's write-up on MotW — he worked on the browser side of this
mechanism ([textslashplain, *Downloads and the Mark-of-the-Web*](https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/),
opened 2026-07-29):

1. **`ZoneId=3` is the Internet zone** (4 = Restricted, 2 = Trusted, 1 = Intranet, 0 = Local Machine,
   for which no stream is written). This matters for a mistake we nearly made: serving the ZIP from
   our own `127.0.0.1` server to test the download would have produced a *local/intranet* zone, i.e.
   a different mark or none — and would have "verified" the wrong thing.
2. **Windows Explorer's own extractor DOES propagate the mark** to extracted files; the article
   classes Explorer as "not vulnerable", alongside WinRAR and WinZip, while 7-Zip 15.14 and IZArc are
   listed as failing to tag extracted files. (7-Zip
   [added MotW support later](https://www.bleepingcomputer.com/news/microsoft/7-zip-now-supports-windows-mark-of-the-web-security-feature/).)
   So on a default machine, the `KPOT.cmd` a person extracts **is marked**.
3. **The prompt comes from the SHELL path.** A marked file executed through the shell
   (`ShellExecuteEx`, i.e. a double-click) triggers SmartScreen reputation, registered antivirus,
   signature checks and the Attachment Execution Services confirmation. In the article's own terms,
   *"MotW files invoked by non-shell means (e.g. `cmd.exe` or PowerShell) do not trigger security
   checks or prompts."*
4. `.cmd` is a **high-risk** file type for the Attachment Manager; from the Internet zone Windows
   prompts before opening it (the risk-tier behaviour, as described in the Attachment Manager
   documentation — Microsoft's own KB article on it is
   [KB883260](https://mskb.pkisolutions.com/kb/883260); reached only via a mirror in this session, so
   the *tier list itself* is cited at search-result confidence, while the prompt-on-shell-launch
   behaviour above rests on the primary source in (3)).

## 4. The assumption of the epic that this REFUTES

`plans/03_interface_epic.md` §9.1 and `researches/07` §Delivery both carry this sentence: *«созданный
на месте ярлык метки не имеет, поэтому каждый следующий запуск чистый»* — a locally created shortcut
has no mark, therefore every later launch is clean.

**The premise is true and the conclusion does not follow.** A `.lnk` created on the desktop indeed
carries no `Zone.Identifier`. But the shortcut is not what gets executed: the shell resolves it and
executes its **target**, and the target is the file that still carries `ZoneId=3`. Nothing in the
sourced behaviour of (3) says the check is performed on the `.lnk` rather than on what it launches.

I could not measure this on this machine (§2.1), and I could not source it either way. So it is
recorded as an **open question**, not as a fact in either direction:

> **OPEN:** does launching a desktop `.lnk` whose target is a marked `.cmd` raise the Attachment
> Manager prompt? Must be answered on a default-configured machine before the first-run shortcut is
> described to users as "and then it stops asking".

What (3) *does* settle is the shape of a legitimate answer: the check fires on **shell** invocation.
A shortcut whose target is `cmd.exe` (or the vendored `node.exe`) **with the marked script as an
argument** puts an unmarked, system-trusted binary at the shell boundary, and the marked file is then
read by non-shell means. That is not a bypass of anything — the person has already consented once, in
the dialog, to run this program — but it is also unverified here, so it goes into the plan as a
design to be confirmed, not as a promise.

## 5. Failure modes other people documented, and our answer

| Documented failure | Our answer | Where |
|---|---|---|
| Unsigned executable → SmartScreen «unknown publisher», the worst possible first impression | ship **no** unsigned executable: Node's own signed binary + our `.mjs`. Verified on a fresh download (§2.3) | 6.5 |
| MotW propagates through Explorer's extractor, so the launcher a person double-clicks is marked | **stop promising silence.** Tell the person, before they download, exactly what Windows may show and which button to press | 6.5 |
| Third-party extractors that DON'T propagate the mark (7-Zip < 22, IZArc) | nothing to do — it can only make the experience quieter, never louder. Worth knowing so a tester's "no prompt appeared" is not read as proof | — |
| A test that "passes" because the tester's own machine has the protection disabled | this document, §2.1. The acceptance run must first print the two policy values, so the result is interpretable | 6.5 |
| Confirmation fatigue: extra dialogs teach people to click without reading | exactly one Windows dialog, on the first launch only, explained in advance and in the same words the dialog uses | 6.2, 6.5 |

## 6. Recommendation

1. **The package proceeds.** The gate said "do not promise the absence of the mark before measuring";
   the measurement says the promise cannot be made on any machine, so the design simply stops making
   it. The phase is not blocked — its *wording* is constrained.
2. **Say what Windows will say.** The download instructions and the package's own `README` carry one
   short, plain paragraph naming the dialog («Открыть файл — предупреждение системы безопасности»),
   why it appears (Windows knows the file came from the internet), and what to press. This is the
   same treatment `researches/07` §5.5 recommended for SmartScreen, and the owner already accepted
   that treatment.
3. **Keep the first-run desktop shortcut**, and point it at `node.exe` with our script as an
   argument rather than at the `.cmd` — the shape §4 argues for. Describe its effect on later
   prompts only after somebody has watched it on a default machine.
4. **Verify the ZIP's hash at build time** against `SHASUMS256.txt` (§2.3). One line, and it turns
   "we vendored the official binary" from a claim into a check.
5. **Acceptance is homework and must state the environment.** A clean machine with **no Node
   installed** *and* default attachment policy; the run records, as facts: whether the extracted
   `.cmd` carries `Zone.Identifier`, what dialog appeared, and whether the shortcut launch prompts
   again.

## 7. What remains unknown

- §4's open question — the shortcut-to-marked-target case.
- Whether Windows 11's newer built-in extraction path (the rewritten zip handling of 2023–2024)
  still propagates the mark as the 2016 article describes. Nothing found in this session either way;
  it must not be assumed to have changed *or* stayed the same.
- Whether SmartScreen's *reputation* check adds a prompt of its own for a signed-but-rarely-seen
  binary launched from a marked folder. Distinct from everything above, and not measurable here.

## Links

- `plans/03_interface_epic.md` §Фаза 6.5, §9 — the gate this discharges.
- `researches/07_local_ui_and_delivery.md` §Delivery — the prior-art review that raised it, and whose
  «ярлык метки не имеет» sentence §4 corrects.
- Probes (session scratchpad, 2026-07-29): `motw_download.ps1` (the real browser download),
  `motw_propagate.ps1` (the void propagation experiment, kept deliberately).
