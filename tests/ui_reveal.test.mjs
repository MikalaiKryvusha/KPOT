// tests/ui_reveal.test.mjs — showing a folder, safely (phase 6.3, researches/08).
//
// The specs that matter are the refusals. This is the one place where the interface hands a path
// that arrived over HTTP to an external program, and the measured finding behind the whole module is
// that the check the rest of the product uses is NOT enough here: a junction created inside the
// library — no admin rights needed — points anywhere on the machine, and `isInside` says «inside».
//
// The junction spec below builds that exact escape and proves it is refused. If `mklink` is
// unavailable it SKIPS LOUDLY rather than passing quietly: a security spec that silently degrades
// into a no-op is worse than no spec at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { checkRevealable, revealFolder, REVEAL_REFUSED } from '../src/ui/reveal.mjs';

const execFileP = promisify(execFile);

/** A library with a year inside it, and a folder OUTSIDE it holding something private. */
async function scene() {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'kpot-rev-')));
  const library = join(base, 'Библиотека');
  const outside = join(base, 'Чужое');
  await mkdir(join(library, '2013'), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, 'личное.txt'), 'private');
  return { base, library, outside };
}

test('a folder inside the library is allowed, and the library itself counts as inside', async () => {
  const { base, library } = await scene();
  try {
    const year = await checkRevealable(join(library, '2013'), library);
    assert.equal(year.ok, true);

    // `isInside` is strict — a path is not inside itself — but «open the library» is a request the
    // control panel legitimately makes, so equality has to be allowed explicitly.
    const root = await checkRevealable(library, library);
    assert.equal(root.ok, true, 'the panel must be able to open the library root');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a folder OUTSIDE the library is refused', async () => {
  const { base, library, outside } = await scene();
  try {
    const r = await checkRevealable(outside, library);
    assert.equal(r.ok, false);
    assert.equal(r.reason, REVEAL_REFUSED.OUTSIDE);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a path that does not exist is refused rather than launched hopefully', async () => {
  const { base, library } = await scene();
  try {
    const r = await checkRevealable(join(library, 'нет такой папки'), library);
    assert.equal(r.ok, false);
    assert.equal(r.reason, REVEAL_REFUSED.NOT_FOUND);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('A JUNCTION INSIDE THE LIBRARY DOES NOT ESCAPE IT — the finding this module exists for', async (t) => {
  const { base, library, outside } = await scene();
  const link = join(library, 'ссылка');
  try {
    try {
      await execFileP('cmd', ['/c', 'mklink', '/J', link, outside]);
    } catch (e) {
      // Loudly, not quietly: a security spec that turns into a no-op on some machine is worse than
      // none, because the suite then reports coverage that does not exist.
      t.skip(`mklink unavailable on this platform (${e.code ?? e.message}) — junction escape UNVERIFIED here`);
      return;
    }
    const r = await checkRevealable(link, library);
    assert.equal(r.ok, false,
      'textually the junction is inside the library; only resolving the REAL path catches it');
    assert.equal(r.reason, REVEAL_REFUSED.OUTSIDE);
  } finally {
    try { await execFileP('cmd', ['/c', 'rmdir', link]); } catch { /* never created */ }
    await rm(base, { recursive: true, force: true });
  }
});

test('what gets launched is the RESOLVED path, passed as an argument and never through a shell', async () => {
  const { base, library } = await scene();
  const calls = [];
  const fakeSpawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { unref() {} }; };
  try {
    const r = await revealFolder(join(library, '2013'), library, { spawnImpl: fakeSpawn });
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    // An argument ARRAY: a path is data. This repo has Cyrillic names, spaces and long-path
    // prefixes, and a command string would eventually meet one it cannot survive.
    assert.ok(Array.isArray(calls[0].args));
    assert.equal(calls[0].args.length, 1);
    assert.equal(calls[0].args[0], await realpath(join(library, '2013')));
    assert.equal(calls[0].opts.detached, true, 'the window outlives us');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a refused path is never handed to the launcher at all', async () => {
  const { base, library, outside } = await scene();
  const calls = [];
  const fakeSpawn = (...a) => { calls.push(a); return { unref() {} }; };
  try {
    const r = await revealFolder(outside, library, { spawnImpl: fakeSpawn });
    assert.equal(r.ok, false);
    assert.equal(calls.length, 0, 'the check must happen BEFORE the launch, not after');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a launcher that fails does not fail the request — the path is the useful part', async () => {
  const { base, library } = await scene();
  const boom = () => { throw new Error('no file manager here'); };
  try {
    const r = await revealFolder(library, library, { spawnImpl: boom });
    assert.equal(r.ok, true);
    assert.equal(r.launched, false, 'and it says plainly that no window was opened');
  } finally { await rm(base, { recursive: true, force: true }); }
});
