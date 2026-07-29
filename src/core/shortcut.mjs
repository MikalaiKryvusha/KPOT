// src/core/shortcut.mjs — the desktop shortcut the first run offers to create (phase 6.5, plans/09).
// [TESTED: 2026-07-29 · tests/shortcut.test.mjs — the portable/dev distinction, the refusal when
// there is no launcher, and the command actually handed to Windows; each guard break-verified]
//
// The owner asked for a shortcut on the desktop (idea 02 / interview #003): «ярлык как раз таки и
// запускает Веб UI». It is offered, never created behind anyone's back — a program that puts things
// on your desktop uninvited is exactly the kind of program this one is trying not to be.
//
// TWO THINGS HERE ARE NOT ARBITRARY, and both come from `researches/09`:
//
//  1. THE TARGET IS `cmd.exe`, NOT OUR `KPOT.cmd`. On a default-configured Windows the launcher
//     extracted from a downloaded ZIP carries the Mark-of-the-Web, and the Attachment Manager
//     prompt fires when the SHELL executes a marked file. Pointing the shortcut at the system's own
//     unmarked `cmd.exe`, with our script as an argument, puts an unmarked binary at that boundary
//     — and the marked script is then read by non-shell means, which the primary source states does
//     not trigger the checks. This is not a bypass: the person has already agreed once, in the
//     dialog, to run this program. It is ALSO NOT YET VERIFIED (§4 of that document is an open
//     question), so nothing in the interface promises the prompt will stop appearing.
//
//  2. THE DESKTOP IS ASKED FOR, NOT ASSUMED. `~/Desktop` is wrong on any machine where OneDrive has
//     redirected the folder — which is the default on a lot of consumer Windows installs — and a
//     shortcut written to a path nobody looks at is worse than none, because the person is told it
//     worked. Windows is asked where the desktop actually is.
//
// RULE 1 is intact: this creates one `.lnk` on the desktop and touches nothing else, least of all a
// photograph. It lives in `src/core/` because `src/ui/` may not reach below `src/app/`, exactly as
// the inbox does.

import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/** The name a person sees under the icon. Their language is not known here, so it says both jobs. */
export const SHORTCUT_NAME = 'KPOT — разбор фотографий.lnk';

/** `src/core/` → the directory holding `bin/`, `src/` and (in a package) `node.exe`. */
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

/** Ask Windows where the desktop IS, rather than guessing `~/Desktop` (see the note above). */
async function desktopDir() {
  const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-Command',
    '[Environment]::GetFolderPath("Desktop")']);
  const dir = stdout.trim();
  if (dir === '') throw new Error('Windows did not report a desktop folder');
  return dir;
}

/**
 * Can a shortcut be offered here, and is one already there?
 *
 * `portable` is the honest test for "this is the packaged product": the running `node.exe` lives
 * inside the app directory, which is true of the ZIP layout and false of a development checkout
 * (where node comes from the system). Offering a desktop shortcut to a developer's working copy
 * would put a permanent link to a temporary thing on their desktop.
 *
 * @returns {Promise<{supported: boolean, portable: boolean, exists: boolean,
 *                    path: string|null, launcher: string|null}>}
 */
export async function shortcutState() {
  if (process.platform !== 'win32') {
    return { supported: false, portable: false, exists: false, path: null, launcher: null };
  }
  const launcher = resolve(APP_DIR, '..', 'KPOT.cmd');
  const hasLauncher = await exists(launcher);
  // `process.execPath` inside the app directory === we are running the bundled runtime.
  const portable = process.execPath.toLowerCase().startsWith(APP_DIR.toLowerCase() + '\\');

  let path = null, present = false;
  try {
    path = join(await desktopDir(), SHORTCUT_NAME);
    present = await exists(path);
  } catch { /* no desktop we can find — reported as unsupported below */ }

  return {
    supported: path !== null && hasLauncher && portable,
    portable,
    exists: present,
    path,
    launcher: hasLauncher ? launcher : null,
  };
}

/**
 * The command handed to Windows to build the `.lnk`.
 *
 * Exported apart from the doing so the SHAPE of the shortcut can be asserted by a spec without
 * creating anything on whoever is running the tests — their desktop is not a fixture.
 */
export function shortcutScript(lnkPath, launcher) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;   // PowerShell single-quote escaping
  return [
    '$s = (New-Object -ComObject WScript.Shell).CreateShortcut(' + q(lnkPath) + ')',
    '$s.TargetPath = $env:ComSpec',
    '$s.Arguments = ' + q(`/c "${launcher}"`),
    '$s.WorkingDirectory = ' + q(dirname(launcher)),
    '$s.Description = ' + q('Krinik Photo Organizer Tool — наведём порядок в фотографиях'),
    '$s.WindowStyle = 7',
    '$s.Save()',
  ].join('; ');
}

/**
 * Create the shortcut. Idempotent by nature — writing it again simply overwrites the same file.
 * @returns {Promise<{ok: true, path: string} | {ok: false, reason: string}>}
 */
export async function createShortcut() {
  const state = await shortcutState();
  if (!state.supported) {
    // Three different "no"s, and the face says something different for each: a development run, a
    // package missing its launcher, or a machine whose desktop we could not find.
    return { ok: false, reason: state.portable ? 'no-launcher' : 'not-portable' };
  }
  await execFileP('powershell.exe', ['-NoProfile', '-Command',
    shortcutScript(state.path, state.launcher)]);
  // Trust nothing: the shortcut is only created if it is now on disk.
  if (!(await exists(state.path))) return { ok: false, reason: 'not-created' };
  const size = (await stat(state.path)).size;
  return { ok: true, path: state.path, size };
}
