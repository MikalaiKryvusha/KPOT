// tests/ui_folders.test.mjs — choosing a folder without typing a path (6.2b, plans/06).
//
// The requirement behind this module is the owner's, in capitals: «С ЗАЩИТАМИ ОТ ДУРАКА». A browser
// cannot open a folder dialog that returns a real path, so the only alternatives were "let the
// person click through folders" and "make them type D:\Фото\с телефона correctly". These specs
// guard the first, and — more importantly — guard what it must REFUSE to do while offering it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listFolders, isUsableFolder } from '../src/ui/folders.mjs';

async function tree() {
  const root = await mkdtemp(join(tmpdir(), 'kpot-fold-'));
  await mkdir(join(root, 'Отпуск 2013'));
  await mkdir(join(root, 'Аврора'));
  await mkdir(join(root, '.kpot-runs'));
  await mkdir(join(root, 'Ялта'));
  await writeFile(join(root, 'фото.jpg'), 'not a folder');
  return root;
}

test('it lists FOLDERS only — a photograph is never offered as a place to go', async () => {
  const root = await tree();
  try {
    const { entries } = await listFolders(root);
    const names = entries.map((e) => e.name);
    assert.ok(!names.includes('фото.jpg'), 'a file must never appear in a folder chooser');
    assert.ok(names.includes('Ялта'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('our own bookkeeping folder is hidden — nobody should be invited to sort .kpot-runs', async () => {
  const root = await tree();
  try {
    const names = (await listFolders(root)).entries.map((e) => e.name);
    assert.ok(!names.includes('.kpot-runs'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the order is canonical and Russian-aware, so the same folder always looks the same', async () => {
  const root = await tree();
  try {
    const names = (await listFolders(root)).entries.map((e) => e.name);
    assert.deepEqual(names, ['Аврора', 'Отпуск 2013', 'Ялта'],
      'Cyrillic names must sort where a Russian speaker expects them');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('there is a way back up, and it stops at the top instead of looping', async () => {
  const root = await tree();
  try {
    const here = await listFolders(join(root, 'Ялта'));
    assert.equal(here.parent, root, 'the way back is offered');
    const top = await listFolders(here.parent === null ? root : '/');
    assert.ok(top.parent === null || typeof top.parent === 'string');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('with no path yet, it offers a starting point rather than an empty box', async () => {
  const start = await listFolders(null);
  assert.equal(start.path, null);
  assert.ok(start.entries.length > 0, 'a person who has typed nothing must still see somewhere to click');
});

test('a folder that cannot be opened is REPORTED, not thrown at the person', async () => {
  const missing = join(tmpdir(), 'kpot-fold-nope-8c2a');
  const r = await listFolders(missing);
  assert.equal(r.unreadable, true, 'the page needs to say "cannot open this", not show a crash');
  assert.deepEqual(r.entries, []);
  assert.ok(r.parent, 'and it must still offer the way back');
});

test('isUsableFolder tells a file apart from a folder', async () => {
  const root = await tree();
  try {
    assert.equal(await isUsableFolder(root), true);
    assert.equal(await isUsableFolder(join(root, 'фото.jpg')), false, 'a file is not a place to sort');
    assert.equal(await isUsableFolder(join(root, 'нет такой')), false);
    assert.equal(await isUsableFolder(null), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── is this already a library? the question that chooses the face ───────────────────────────────

test('a fresh messy folder is NOT a library — a first-timer must get the wizard', async () => {
  const { libraryShape } = await import('../src/ui/folders.mjs');
  const root = await tree();
  try {
    const shape = await libraryShape(root);
    assert.equal(shape.isLibrary, false,
      'dropping someone into a control panel for a library that does not exist is the worse error');
    assert.deepEqual(shape.years, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a sorted tree IS a library, and its years come back newest first', async () => {
  const { libraryShape } = await import('../src/ui/folders.mjs');
  const root = await mkdtemp(join(tmpdir(), 'kpot-lib-'));
  try {
    for (const y of ['2011', '2014', '2013']) await mkdir(join(root, y, 'Лето'), { recursive: true });
    await mkdir(join(root, 'ПРОЧЕЕ'));
    const shape = await libraryShape(root);
    assert.equal(shape.isLibrary, true);
    // Newest first: that is the order a person looks for their own photographs in.
    assert.deepEqual(shape.years, ['2014', '2013', '2011']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the global ПРОЧЕЕ bucket alone is enough — a sort happened even if no year survived', async () => {
  const { libraryShape } = await import('../src/ui/folders.mjs');
  const root = await mkdtemp(join(tmpdir(), 'kpot-lib2-'));
  try {
    await mkdir(join(root, 'ПРОЧЕЕ'));
    const shape = await libraryShape(root);
    assert.equal(shape.isLibrary, true, 'these are shapes KPOT itself creates, so their presence is evidence');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a folder that cannot be read is not a library, and does not throw', async () => {
  const { libraryShape } = await import('../src/ui/folders.mjs');
  const shape = await libraryShape(join(tmpdir(), 'kpot-lib-nope-4d1'));
  assert.equal(shape.isLibrary, false);
  assert.deepEqual(shape.years, []);
});
