// tests/core_paths.test.mjs — specs for Windows-aware path normalization.
// [TESTED: 2026-07-24 · runs green via npm test — suite 40/40]
// Semantics under test are win32 by design (see the module header) — these specs are
// deterministic on any host platform.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  samePath, normalizeForCompare, isInside,
  stripLongPrefix, toExtendedLengthIfNeeded, LONG_PATH_PREFIX, LONG_UNC_PREFIX,
} from '../src/core/paths.mjs';

test('samePath: drive-letter case, separator style and name case are equivalent', () => {
  assert.equal(samePath('C:\\Foo\\bar.JPG', 'c:/foo/BAR.jpg'), true);
  assert.equal(samePath('C:\\Foo\\bar.JPG', 'c:/foo/BAR.jpg', { caseInsensitive: false }), false);
  assert.equal(samePath('C:\\a\\..\\b\\.\\c.jpg', 'C:\\b\\c.jpg'), true);   // . / .. collapse
  assert.equal(samePath('C:\\album\\', 'C:\\album'), true);                 // trailing separator
  assert.equal(samePath('C:\\a\\x.jpg', 'C:\\b\\x.jpg'), false);
});

test('extended-length (long-path) prefixes are transparent to comparison', () => {
  assert.equal(samePath('\\\\?\\C:\\dir\\file.jpg', 'C:\\dir\\file.jpg'), true);
  assert.equal(samePath('\\\\?\\UNC\\srv\\share\\a.jpg', '\\\\srv\\share\\a.jpg'), true);
  assert.equal(stripLongPrefix('\\\\?\\C:\\x'), 'C:\\x');
  assert.equal(stripLongPrefix('\\\\?\\UNC\\srv\\share\\x'), '\\\\srv\\share\\x');
  assert.equal(stripLongPrefix('C:\\x'), 'C:\\x'); // no prefix → unchanged
});

test('toExtendedLengthIfNeeded prefixes only long absolute paths, idempotently', () => {
  // limit override lets the spec use short strings instead of 260-char monsters
  assert.equal(toExtendedLengthIfNeeded('C:\\ab\\c.jpg', 5), LONG_PATH_PREFIX + 'C:\\ab\\c.jpg');
  assert.equal(toExtendedLengthIfNeeded('\\\\srv\\share\\c.jpg', 5), LONG_UNC_PREFIX + 'srv\\share\\c.jpg');
  const already = LONG_PATH_PREFIX + 'C:\\ab\\c.jpg';
  assert.equal(toExtendedLengthIfNeeded(already, 5), already);              // idempotent
  assert.equal(toExtendedLengthIfNeeded('C:\\short.jpg'), 'C:\\short.jpg'); // under MAX_PATH → untouched
});

test('normalizeForCompare produces a stable comparison key', () => {
  assert.equal(normalizeForCompare('\\\\?\\C:\\Фото\\Лето\\'), 'c:\\фото\\лето');
  assert.equal(normalizeForCompare('C:\\'), 'c:\\'); // bare root keeps its separator
});

test('isInside: strict containment, no sibling-prefix false positives', () => {
  assert.equal(isInside('C:\\archive\\2013\\a.jpg', 'C:\\archive'), true);
  assert.equal(isInside('C:\\ARCHIVE\\x.jpg', 'c:/archive/'), true);   // case + separators + trailing
  assert.equal(isInside('C:\\archive', 'C:\\archive'), false);         // a path is not inside itself
  assert.equal(isInside('C:\\archive2\\x.jpg', 'C:\\archive'), false); // sibling with common prefix
});
