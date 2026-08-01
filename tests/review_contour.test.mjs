// tests/review_contour.test.mjs — the owner-review contour (`tools/review.mjs`), guarded.
//
// Three layers, because the field report for this contour is explicit that only the third one
// catches the expensive defects:
//   1. the core self-test (normalization/hash, quiet hours, parsing, renderer, metadata);
//   2. THE LIVE PILOT — every real document in interviews/. «Fixtures do not catch live documents»:
//      three of the sibling project's seven defects surfaced only on real files, and one of them
//      (an option silently vanishing when its bold head wrapped) was caught by the owner's eyes.
//      Hence the COUNTING check: candidate option lines must EQUAL parsed options, per question,
//      across every live interview. Counting, not looking.
//   3. END-TO-END over HTTP, in a temp root — proves the answer reaches all three places, that the
//      owner's original is never overwritten, and that the contour TERMINATES after a save
//      (invariant I8, «saving wakes the waiting agent» — the half the sibling project shipped
//      broken because every check only ever verified the path TOWARDS the human).
//
// Every destructive part runs in a temp dir (`AGENT_GUIDE` §Test harness) via KPOT_REVIEW_ROOT —
// the live repository is only ever READ.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REVIEW = join(ROOT, 'tools', 'review.mjs');

// ─────────────────────────────────────────────────────────────────────────────
// 1. The core self-test
// ─────────────────────────────────────────────────────────────────────────────

test('contour: the core self-test is clean', async () => {
	const { selftest } = await import('../tools/lib/review-core.mjs');
	const fails = selftest();
	assert.deepEqual(fails, [], `самотест ядра провалился: ${fails.join(' · ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The live pilot — every real interview in the repository
// ─────────────────────────────────────────────────────────────────────────────

const liveInterviews = () => {
	const dir = join(ROOT, 'interviews');
	return readdirSyncSafe(dir)
		.filter((f) => f.startsWith('interview_') && f.endsWith('.md'))
		.map((f) => join(dir, f));
};
function readdirSyncSafe(d) {
	try {
		return readdirSync(d);
	} catch {
		return [];
	}
}

test('contour: every live interview parses, and NO option is silently lost', async () => {
	const { parseInterview, readMd } = await import('../tools/lib/review-core.mjs');
	const files = liveInterviews();
	assert.ok(files.length >= 1, 'в interviews/ не найдено ни одного документа — пилот бессмысленен');

	let questions = 0;
	let optionLines = 0;
	let optionsParsed = 0;
	for (const f of files) {
		const iv = parseInterview(f, readMd(f));
		for (const q of iv.questions) {
			questions++;
			// THE COUNTING CHECK. A silently dropped option is this contour's worst defect: the page
			// looks healthy, the owner chooses among what he SEES, and the decision is taken from a
			// TRUNCATED list. «Options were rendered» does not catch it — only HOW MANY does.
			assert.equal(
				q.options.length,
				q.optionLines ?? 0,
				`${f} :: ${q.label}: строк-кандидатов ${q.optionLines ?? 0}, разобрано вариантов ${q.options.length}`,
			);
			optionLines += q.optionLines ?? 0;
			optionsParsed += q.options.length;
		}
	}
	assert.equal(optionLines, optionsParsed);
	console.log(`   пилот: ${files.length} интервью · ${questions} вопросов · ${optionsParsed} вариантов, потерь 0`);
});

test('contour: a rendered live page is SELF-CONTAINED — no external loads', async () => {
	const { buildPage } = await import('../tools/review.mjs');
	for (const f of liveInterviews()) {
		const html = buildPage({ docPath: f, live: false });
		// The page must open offline as one file (the contour's invariant). Anything that would
		// fetch over the network breaks that — and a `file://` reference from an http-served page is
		// blocked by the browser anyway, which is why media is embedded rather than linked.
		const external = html.match(/(?:src|href)\s*=\s*"(https?:|file:|\/\/)[^"]*"/gi) ?? [];
		assert.deepEqual(external, [], `${f}: страница тянет внешнее — ${external.join(', ')}`);
		assert.ok(html.startsWith('<!doctype html>'), `${f}: не похоже на страницу`);
		assert.ok(html.includes('prefers-color-scheme'), `${f}: нет тёмной темы (полевые грабли №6)`);
	}
});

test('contour: every local asset a live interview links is EMBEDDED, never silently dropped', async () => {
	const { buildPage } = await import('../tools/review.mjs');
	const { readMd } = await import('../tools/lib/review-core.mjs');
	// 🔴 The class this guards was found by the live pilot on THIS project and would have cost the
	// owner a mock-up: interview #003 links `interview_003_designs.html` beside itself, and both the
	// path resolution (relative to the DOCUMENT, not the root) and the label pattern (the label is
	// `<code>…</code>`, not plain text) were wrong. The page degraded to «нет файла» with no error
	// anywhere — the exact silent shape this contour must never have.
	// Counting, not looking: assert the embed EXISTS, not that the page rendered.
	let embedded = 0;
	for (const f of liveInterviews()) {
		const md = readMd(f);
		const html = buildPage({ docPath: f, live: false });
		assert.equal(
			(html.match(/нет файла:/g) ?? []).length,
			0,
			`${f}: страница сообщает «нет файла» — ссылка на локальный ресурс не разрешилась`,
		);
		// A markdown link to a local .html must become a live frame.
		const linksHtml = /\]\((?!https?:)[^)\s]+\.html\)/.test(md);
		if (linksHtml) {
			assert.match(html, /class="frame" srcdoc=/, `${f}: макет не вшит рамкой`);
			embedded++;
		}
	}
	console.log(`   встроено живых макетов: ${embedded}`);
});

test('contour: the header says WHO is asking and shows the state as two pills', async (t) => {
	const { buildPage } = await import('../tools/review.mjs');
	const { root, doc } = makeTempProject();
	t.after(() => rmSync(root, { recursive: true, force: true }));

	// The fixture is deliberately mixed: Q1 unanswered, Q2 answered.
	const html = buildPage({ docPath: doc, live: false });

	// WHO and WHEN. The owner runs several projects whose pages look the same by design, so the page
	// must identify itself before he reads a word (his instruction, 2026-08-02).
	assert.match(html, /Спрашивает ИИ-агент <b>KPOT<\/b> · \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/,
		'нет строки «кто спрашивает и когда»');

	// The pills carry the counts AND their loudness: a real count is filled, a zero goes quiet, so
	// the eye lands on the number that matters. Assert the CLASS, not just the text — the colour is
	// half the message.
	assert.match(html, /<span class="pill wait">ждут вас: 1<\/span>/, 'пилюля ожидания не горит при 1 без ответа');
	assert.match(html, /<span class="pill done">отвечено: 1<\/span>/, 'пилюля отвеченного не горит при 1 отвеченном');

	// And the other way round: with nothing waiting, the wait pill must go QUIET rather than shout 0.
	writeFileSync(doc, readFileSync(doc, 'utf8').replace('**Ответ:**\n', '**Ответ:** A\n'), 'utf8');
	const closed = buildPage({ docPath: doc, live: false });
	assert.match(closed, /<span class="pill zero">ждут вас: 0<\/span>/, 'нулевая пилюля не гаснет');
	assert.match(closed, /<span class="pill done">отвечено: 2<\/span>/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. End-to-end over HTTP in a temp root
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a throw-away project root holding one interview, and returns its paths. */
function makeTempProject() {
	const root = mkdtempSync(join(tmpdir(), 'kpot-review-'));
	mkdirSync(join(root, 'interviews'), { recursive: true });
	const doc = join(root, 'interviews', 'interview_900_probe.md');
	writeFileSync(
		doc,
		[
			'# Интервью №900 — проба контура',
			'',
			'**Статус:** ❓ ОЖИДАЕТ ОТВЕТА ВЛАДЕЛЬЦА',
			'',
			'### Q1. Первый вопрос — без ответа?',
			'',
			'- **A) (рекомендую)** первый вариант',
			'- **B)** второй вариант',
			'',
			'**Ответ:**',
			'',
			'### Q2. Второй вопрос — владелец уже ответил?',
			'',
			'- **A)** вариант',
			'',
			'**Ответ:** это СЛОВО ВЛАДЕЛЬЦА, его нельзя затирать',
			'',
		].join('\n'),
		'utf8',
	);
	return { root, doc };
}

/** Starts `review.mjs open` against a temp root and resolves with {url, child, exited}. */
function startContour(root, docRel) {
	const child = spawn(process.execPath, [REVIEW, 'open', docRel, '--no-open', '--no-signal', '--timeout', '2'], {
		env: { ...process.env, KPOT_REVIEW_ROOT: root },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let out = '';
	const exited = new Promise((res) => child.on('exit', (code) => res(code)));
	const url = new Promise((res, rej) => {
		child.stdout.on('data', (b) => {
			out += b.toString();
			const m = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out);
			if (m) res(m[0]);
		});
		child.on('exit', () => rej(new Error(`контур умер, не подняв страницу:\n${out}`)));
		setTimeout(() => rej(new Error(`страница не поднялась за 15 с:\n${out}`)), 15_000).unref?.();
	});
	return { child, url, exited, log: () => out };
}

test('contour: an answer reaches THREE places, the original survives, and saving KILLS the contour (I8)', async (t) => {
	const { root, doc } = makeTempProject();
	t.after(() => rmSync(root, { recursive: true, force: true }));

	const c = startContour(root, 'interviews/interview_900_probe.md');
	const url = await c.url;

	// The page serves before any click, and reports the open question honestly.
	const pageBefore = await (await fetch(url)).text();
	assert.ok(pageBefore.includes('ждёт вас'), 'на странице нет плашки ожидания');
	assert.ok(pageBefore.includes('отвечено'), 'на странице нет плашки отвеченного вопроса');

	// 🔴 THE «BEFORE» HALF. Without it, «the answer was found» would go green on any pre-existing
	// state — the field report names this pairing explicitly.
	assert.ok(!existsSync(join(root, 'interviews', 'decisions')), 'решения существуют ДО ответа');
	assert.ok(!readFileSync(doc, 'utf8').includes('owner-review:'), 'провенанс есть ДО ответа');

	const res = await fetch(new URL('/decision', url), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			doc: 'interviews/interview_900_probe.md',
			answers: {
				Q1: { choice: 'A', text: 'беру первый', comment: 'пометка агенту' },
				Q2: { choice: 'A', text: 'уточняю задним числом', comment: '' },
			},
			comment: 'общий комментарий по документу',
		}),
	});
	const body = await res.json();
	assert.equal(body.ok, true, `сервер отказал: ${body.error}`);

	// PLACE 1 — the source md.
	const md = readFileSync(doc, 'utf8');
	assert.match(md, /\*\*Ответ:\*\* \*\*A\*\* — беру первый/, 'ответ не вписан в пустое поле Q1');
	assert.match(md, /owner-review: by="[^"]+" at="[^"]+"/, 'нет провенанса by/at');
	assert.match(md, /> пометка агенту/, 'пометка для агента потеряна');
	assert.match(md, /## 💬 Комментарий владельца/, 'общий комментарий по документу не дописан');
	// 🔴 THE OWNER'S ORIGINAL IS INVIOLABLE: an answer he already wrote is never overwritten —
	// a refinement arrives as its own dated field and the old text stays verbatim.
	assert.ok(
		md.includes('это СЛОВО ВЛАДЕЛЬЦА, его нельзя затирать'),
		'ЗАТЁРТ уже написанный владельцем ответ — нарушена неприкосновенность первоисточника',
	);
	assert.match(md, /\*\*Ответ \(уточнение \d{4}-\d{2}-\d{2}\):\*\*/, 'уточнение не пришло отдельным полем');

	// PLACE 2 — the decision file, named AFTER the document.
	const decision = join(root, 'interviews', 'decisions', 'interview_900_probe.decision.json');
	assert.ok(existsSync(decision), 'файл решения не создан или назван не по документу');
	const rec = JSON.parse(readFileSync(decision, 'utf8'));
	assert.equal(rec.answers.Q1.choice, 'A');
	assert.ok(rec.by && rec.at, 'в решении нет by/at — архив будет нечитаем');

	// PLACE 3 — the archive copy.
	const archive = readdirSync(join(root, 'interviews', 'decisions', 'archive'));
	assert.equal(archive.length, 1, 'архивная копия решения не создана');
	assert.match(archive[0], /^interview_900_probe--/, 'имя архивной копии не производно от документа');

	// I8 — the contour must DIE after the save, because that termination is the only thing that
	// wakes the waiting agent. A contour that records the answer and keeps running is done by half.
	const code = await Promise.race([
		c.exited,
		new Promise((_, rej) => setTimeout(() => rej(new Error('контур НЕ завершился после записи — I8 нарушен')), 12_000)),
	]);
	assert.equal(code, 0, 'контур завершился с ошибкой');
});

test('contour: the page refuses a document outside the project root', async (t) => {
	const { root } = makeTempProject();
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const c = startContour(root, 'interviews/interview_900_probe.md');
	const url = await c.url;
	// Path containment, the same rule `src/ui/reveal.mjs` already holds for the product: a document
	// outside the root is refused rather than served.
	const res = await fetch(new URL('/doc?p=' + encodeURIComponent('../../../../etc/passwd'), url));
	assert.equal(res.status, 404);
	c.child.kill();
});
