// tests/shortcut.test.mjs — the desktop shortcut the packaged first run offers (phase 6.5, plans/09).
//
// Two things are guarded here, and the first is the one that matters:
//
//  · THE SHORTCUT POINTS AT `cmd.exe`, NOT AT OUR `KPOT.cmd`. That is the whole design, and it comes
//    from `researches/09` §4: on a default-configured Windows the launcher extracted from a
//    downloaded ZIP carries the Mark-of-the-Web, and the Attachment Manager prompt fires when the
//    SHELL executes a marked file. An unmarked system binary at the shell boundary, with the marked
//    script as an argument, is the shape the primary source says avoids it. If someone ever
//    "simplifies" this to target the launcher directly, that reasoning is lost silently — the
//    shortcut would still work, and would still prompt, on every machine except the ones we test on.
//
//  · THE OFFER IS NOT MADE IN A DEVELOPMENT CHECKOUT. A permanent desktop link to a working copy is
//    litter, and the check that prevents it (`portable`) is also what keeps this very spec from
//    creating anything on the desktop of whoever runs the suite.
//
// Nothing here writes a `.lnk`. That is not caution about the test — it is the assertion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { shortcutState, createShortcut, shortcutScript, SHORTCUT_NAME }
  from '../src/core/shortcut.mjs';

const execFileP = promisify(execFile);
const onWindows = process.platform === 'win32';

test('THE SHORTCUT LAUNCHES cmd.exe WITH OUR SCRIPT, never the marked script directly', () => {
  const script = shortcutScript('C:\\Users\\x\\Desktop\\KPOT.lnk', 'D:\\KPOT\\KPOT.cmd');

  assert.match(script, /\$s\.TargetPath = \$env:ComSpec/,
    'the target must be the system command processor — researches/09 §4');
  assert.match(script, /\$s\.Arguments = '\/c "D:\\KPOT\\KPOT\.cmd"'/,
    'our launcher travels as an ARGUMENT, so the shell never executes the marked file itself');
  // The inverse, stated as its own assertion so the intent cannot be read as accidental.
  assert.equal(/TargetPath = 'D:\\KPOT\\KPOT\.cmd'/.test(script), false,
    'targeting the launcher directly is exactly what this design avoids');
  assert.match(script, /\$s\.Save\(\)/);
});

test('a path with an apostrophe in it cannot break out of the PowerShell command', () => {
  // Real desktops are named after real people, and `C:\Users\O'Brien\Desktop` is an ordinary path.
  const script = shortcutScript("C:\\Users\\O'Brien\\Desktop\\KPOT.lnk", "D:\\Пап'ка\\KPOT.cmd");
  assert.match(script, /CreateShortcut\('C:\\Users\\O''Brien\\Desktop\\KPOT\.lnk'\)/,
    'a single quote must be doubled, or the rest of the path becomes code');
  assert.match(script, /Пап''ка/);
});

test('IN A DEVELOPMENT CHECKOUT THE OFFER IS NOT MADE, and nothing is created', async (t) => {
  if (!onWindows) return t.skip('the shortcut is a Windows feature');
  const state = await shortcutState();

  // The suite runs on the system Node, from the repository — never the packaged layout.
  assert.equal(state.portable, false,
    'a checkout must not be mistaken for the packaged product');
  assert.equal(state.supported, false, 'so the interface must not offer anything');

  const result = await createShortcut();
  assert.equal(result.ok, false, 'and asking anyway must be refused');
  assert.equal(result.reason, 'not-portable');

  // The assertion that matters is the ABSENCE of an effect on a real desktop, not the error text.
  if (state.path) {
    const dir = state.path.slice(0, state.path.lastIndexOf('\\'));
    const entries = await readdir(dir).catch(() => []);
    assert.equal(entries.includes(SHORTCUT_NAME), false,
      'running the tests must never put anything on anybody\'s desktop');
  }
});

test('the desktop is ASKED FOR rather than assumed to be ~/Desktop', async (t) => {
  if (!onWindows) return t.skip('the shortcut is a Windows feature');
  const state = await shortcutState();
  if (state.path === null) return t.skip('no desktop reported on this machine');

  const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-Command',
    '[Environment]::GetFolderPath("Desktop")']);
  assert.ok(state.path.startsWith(stdout.trim()),
    'OneDrive redirects the desktop on a great many consumer machines; guessing ~/Desktop writes '
    + 'the shortcut where nobody will look, and then tells the person it worked');
});
