// tests/ui_page.test.mjs — the wizard's words and its page (6.2b, plans/06).
//
// The owner's requirement here is not decoration, it is a product requirement in his own capitals:
// «ОЧЕНЬ ЮЗЕР ФРЕНДЛИ, С ЗАЩИТАМИ ОТ ДУРАКА… БЕЗ ЖАРГОНИЗМОВ И СЛЕНГА», in Russian AND English with
// a switch. These specs guard the two things that would quietly break it: a string that exists in
// one language only (a blank space in somebody's window), and jargon leaking into the interface.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STRINGS, DEFAULT_LANG, missingKeys } from '../src/ui/i18n.mjs';
import { renderPage } from '../src/ui/page.mjs';

test('every string exists in BOTH languages — a missing one is a blank space in a window', () => {
  assert.deepEqual(missingKeys(), [],
    'the switch the owner asked for only works if both sides are complete');
});

test('Russian is the default, and both languages are actually present', () => {
  assert.equal(DEFAULT_LANG, 'ru');
  assert.deepEqual(Object.keys(STRINGS).sort(), ['en', 'ru']);
  assert.ok(Object.keys(STRINGS.ru).length > 30, 'the dictionary must be real, not a stub');
});

test('no jargon reaches the person — the words the owner banned are absent', () => {
  // Not a style check: these are the exact words that made the plan report unreadable to him before
  // 2026-07-29. A term may only appear if it is explained on the spot, and none of these are.
  // Two traps live in this one line, and both were hit while writing it.
  //
  // (1) An over-broad pattern convicts innocent words and then gets deleted rather than fixed: the
  //     first version used /\bSHA/ and matched «shall» in an ordinary English sentence.
  // (2) **`\b` does not work with Cyrillic.** JavaScript's word boundary is defined over
  //     [A-Za-z0-9_], so a Russian letter is not a word character and `/\bсканир/` can never match
  //     «Сканирование» — every Russian pattern here was decoration until this was found by breaking
  //     the code on purpose. The Russian stems are therefore plain substrings.
  const banned = [/\bEXIF\b/i, /\bhash\b/i, /dry[- ]run/i, /\bSHA-?\d/i,
    /хеш/i, /вердикт/i, /сканир/i, /парсинг/i, /бэкап/i, /коммит/i, /дедуплик/i];
  for (const lang of Object.keys(STRINGS)) {
    for (const [key, value] of Object.entries(STRINGS[lang])) {
      for (const re of banned) {
        assert.ok(!re.test(value), `${lang}.${key} contains jargon the owner banned: «${value}»`);
      }
    }
  }
});

test('the page is one self-contained document with no outside dependency', () => {
  const html = renderPage();
  assert.match(html, /^<!doctype html>/);
  // Near-zero dependencies is a project policy, and a local-only tool that fetches a script from the
  // internet would also stop working exactly when someone is offline with their photographs.
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external script may be pulled in');
  assert.ok(!/<link[^>]+stylesheet/i.test(html), 'no external stylesheet either');
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(html.replace(/<!--[\s\S]*?-->/g, '')),
    'the page must not reach out to the network at all');
});

test('the page carries BOTH dictionaries, so the switch works without asking the server', () => {
  const html = renderPage();
  assert.ok(html.includes(STRINGS.ru.chooseTitle), 'the Russian strings ship with the page');
  assert.ok(html.includes(STRINGS.en.chooseTitle), 'and so do the English ones');
});

test('the four GOAL.md guarantees are on the page — that is why the interface exists', () => {
  const html = renderPage();
  for (const key of ['guaranteeMap', 'guaranteeBackup', 'guaranteeDry', 'guaranteeUndo']) {
    assert.ok(html.includes(STRINGS.ru[key]), `the guarantee «${key}» must be visible, not implied`);
  }
});

test('no interface text is left hard-coded in the markup instead of the dictionary', () => {
  const html = renderPage();
  // The wizard's headings are filled in from the dictionary at runtime, so the markup itself must
  // contain EMPTY holders. A Cyrillic word baked into the HTML would never switch to English.
  const markup = html.slice(0, html.indexOf('<script type="module">'));
  assert.ok(!/[А-Яа-яЁё]/.test(markup),
    'a Russian word in the markup can never become English — every word belongs in i18n.mjs');
});
