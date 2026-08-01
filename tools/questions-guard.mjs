#!/usr/bin/env node
/**
 * questions-guard.mjs — THE PLACE-OF-QUESTIONS GUARD.
 *
 * The hard rule (`AGENT_GUIDE.md` §Decisions the agent must NOT make alone): everything the agent
 * wants FROM the owner — a fork, a review, an approval, an answer — lives ONLY in `interviews/`.
 * A question buried in a 250-line plan is a question that does not get asked.
 *
 * 🔑 WHY A GUARD AND NOT A PARAGRAPH: the rule is broken by agents that KNOW it — chat and the
 * nearest open document are cheaper in the moment. The `/owner-reviews` rules say this outright,
 * and the sibling project's field report records its own agent breaking it TEN MINUTES after
 * finishing the contour. A rule that fires only after the fact is not a gate.
 *
 * TWO HALVES, answering opposite questions — both are needed:
 *   1. OUTSIDE `interviews/` — is there a question queue where the canon forbids one?
 *   2. INSIDE `interviews/`  — which interviews wait for the owner (a REPORT, not a violation),
 *      and which carry a STALE STATUS: the document still shouts «ЖДЁТ ОТВЕТОВ» while the answers
 *      are already in it. The symptom is mild and therefore dangerous — the next session waits for
 *      what was given days ago.
 *
 * 🔑 THE RATCHET: a guard that is RED FROM BIRTH is not a gate — worse, it trains everyone to
 * ignore it, and this one guards a rule that is already hard to keep. So inherited debt is
 * snapshotted into `tools/questions-baseline.json`; the guard fails ONLY on NEW violations, and it
 * prints the debt count on every run — that number must go down. The key is `file + sha1(text)`,
 * not a line number: editing a question means someone reached it, and it faces the rule again.
 *
 * Commands:
 *   node tools/questions-guard.mjs            check (exit 1 on a NEW violation)
 *   node tools/questions-guard.mjs --baseline rewrite the baseline from what exists now
 *   node tools/questions-guard.mjs --selftest prove each guard can fire (mutations)
 *
 * [NOT-TESTED] — flipped by `--selftest` (three mutations) and `tests/review_contour.test.mjs`.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { parseInterview, readMd } from './lib/review-core.mjs';

const ROOT = process.env.KPOT_REVIEW_ROOT
	? resolve(process.env.KPOT_REVIEW_ROOT)
	: fileURLToPath(new URL('..', import.meta.url));
const BASELINE = join(ROOT, 'tools', 'questions-baseline.json');

/** Working directories the rule applies to. `interviews/` is where questions BELONG — it is half 2. */
const SCANNED = ['bugs', 'plans', 'ideas', 'researches', 'homeworks'];

// ─────────────────────────────────────────────────────────────────────────────
// HALF 1 — a question queue outside interviews/
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TWO STRONG SIGNS instead of ten weak ones — the field report's explicit instruction, because a
 * text-rule guard runs ~10 false hits per real one and a false alarm is worse than a miss.
 *
 * ⚠️ `\p{L}` with the `u` flag, never `\w`: in Node `\w` is ASCII-only EVEN under `u`, so an ASCII
 * class would silently miss this project's own language (rake 7).
 */

/** Sign 1 — a QUEUE HEADING: a section of questions inside a bug/plan/idea is literally what the canon forbids. */
const QUEUE_HEADING =
	/^#{2,3}\s+.*(?:⛔|❓|открытые\s+вопрос|вопрос(?:ы)?\s+(?:к\s+)?владель|что\s+должен\s+решить\s+владел|ждт\s+владел|ж[дд][её]т\s+владел|ожида[а-я]*\s+(?:ответ|решени)|awaiting\s+(?:the\s+)?owner|open\s+questions)/iu;

/**
 * Sign 2 — an ADDRESS AT THE START OF A LINE. Heuristic from the field: a hanging question announces
 * itself immediately, while a REFERENCE to a question lies deep in prose. So the marker must sit
 * within the first ~40 characters of the line's CONTENT (after list/quote/heading marks).
 */
const LINE_ADDRESS = /^(?:[-*+>#\s]|\d+[.)])*(?<head>.{0,40})/u;
const ADDRESS_MARKER = /(?:⛔|❓|🟡)\s*(?:ждт|ж[дд][её]т|ожида|вопрос|владел|решени|owner|awaiting)/iu;

/**
 * NOT a violation: a line that already points AT the place of questions — the question reached where
 * it belongs, and the line merely refers to it.
 */
const POINTS_AT_INTERVIEWS = /interviews\//iu;
const MENTIONS_INTERVIEW = /интервью\s*(?:№|#|\d)/iu;

/**
 * An explicit exception, with the reason ON THE LINE: `<!-- ВОПРОС-ОК: причина -->`.
 * 🔴 A MARKER WITH NO REASON IS ITSELF A VIOLATION — otherwise the marker becomes the way to gag
 * the guard, and the guard becomes decoration.
 */
const EXCEPTION = /<!--\s*ВОПРОС-ОК\s*:\s*(?<reason>[^>]*?)\s*-->/u;

const sha1 = (s) => createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 12);
/** A finding's identity: file + the text's hash. NOT the line number — text moves, meaning does not. */
const keyOf = (file, text) => `${file}#${sha1(text.trim())}`;

function walk(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const e of entries) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (e.endsWith('.md')) out.push(p);
	}
	return out;
}

/** Scans the working directories and returns every place-of-questions finding. */
export function scanQuestionPlaces(root = ROOT) {
	const findings = [];
	for (const d of SCANNED) {
		for (const file of walk(join(root, d))) {
			const rel = relative(root, file).split('\\').join('/');
			const lines = readMd(file).split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!line.trim()) continue;

				const ex = EXCEPTION.exec(line);
				if (ex) {
					// A marker with an EMPTY reason is a violation in its own right.
					if (!ex.groups.reason || !ex.groups.reason.trim()) {
						findings.push({ file: rel, line: i + 1, kind: 'пустая причина у маркера-исключения', text: line.trim() });
					}
					continue; // a marker with a reason legitimately silences this line
				}
				if (POINTS_AT_INTERVIEWS.test(line) || MENTIONS_INTERVIEW.test(line)) continue;

				if (QUEUE_HEADING.test(line)) {
					findings.push({ file: rel, line: i + 1, kind: 'заголовок-очередь вопросов', text: line.trim() });
					continue;
				}
				const head = LINE_ADDRESS.exec(line)?.groups.head ?? '';
				if (ADDRESS_MARKER.test(head)) {
					findings.push({ file: rel, line: i + 1, kind: 'обращение к владельцу в начале строки', text: line.trim() });
				}
			}
		}
	}
	return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// HALF 2 — inside interviews/: who waits, and whose status went stale
// ─────────────────────────────────────────────────────────────────────────────

/** The prose shape: documents that carry an «Ответ владельца» section instead of per-question fields. */
const OWNER_ANSWER_SECTION = /^#{2,3}\s+Ответ\s+владельца\s*$/imu;

/**
 * Inspects `interviews/`. Waiting interviews are a REPORT (not a violation — that is the whole point
 * of the directory). A STALE STATUS is a finding.
 *
 * The stale rule, adapted to BOTH document shapes this project actually uses:
 *   · question shape (`### Q1.` + `**Ответ:**`) — status says waiting AND no question is unanswered;
 *   · prose shape (`## Ответ владельца`)        — status says waiting AND that section has content.
 * Without the second branch the detector would miss exactly the two documents KPOT has, since a
 * prose interview parses to zero questions and «no unanswered questions» is trivially true.
 */
export function inspectInterviews(root = ROOT) {
	const dir = join(root, 'interviews');
	const waiting = [];
	const stale = [];
	for (const f of readdirSyncSafe(dir).filter((f) => f.startsWith('interview_') && f.endsWith('.md')).sort()) {
		const p = join(dir, f);
		const text = readMd(p);
		const iv = parseInterview(p, text);
		if (!iv.waiting) continue;

		const unanswered = iv.questions.filter((q) => !q.answered);
		let answeredAnyway = false;
		let why = '';
		if (iv.questions.length) {
			answeredAnyway = unanswered.length === 0;
			why = `все ${iv.questions.length} вопрос(ов) заполнены`;
		} else {
			const m = OWNER_ANSWER_SECTION.exec(text);
			if (m) {
				const after = text.slice(m.index + m[0].length);
				const body = after.split(/^#{2,3}\s/mu)[0].trim();
				answeredAnyway = body.length > 40;
				why = 'раздел «Ответ владельца» заполнен';
			}
		}
		if (answeredAnyway) stale.push({ file: `interviews/${f}`, status: iv.status, why });
		else waiting.push({ file: `interviews/${f}`, status: iv.status, open: unanswered.map((q) => q.title) });
	}
	return { waiting, stale };
}

function readdirSyncSafe(d) {
	try {
		return readdirSync(d);
	} catch {
		return [];
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// The baseline (the ratchet)
// ─────────────────────────────────────────────────────────────────────────────

const loadBaseline = () => {
	if (!existsSync(BASELINE)) return { keys: [] };
	try {
		return JSON.parse(readFileSync(BASELINE, 'utf8'));
	} catch {
		return { keys: [] };
	}
};

function writeBaseline(findings) {
	const payload = {
		note:
			'Унаследованный долг по правилу «место вопросов». Страж краснеет ТОЛЬКО на новых строках; ' +
			'это число обязано убывать. Ключ — файл + sha1(текст), а не номер строки: правка вопроса ' +
			'означает, что до него дошли руки, и он снова проходит правило.',
		takenAt: new Date().toISOString().slice(0, 10),
		keys: findings.map((f) => keyOf(f.file, f.text)).sort(),
	};
	writeFileSync(BASELINE, JSON.stringify(payload, null, '\t') + '\n', 'utf8');
	return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selftest — every guard must be able to FIRE (mutations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The project's rule (`AGENT_GUIDE`, EXP-0008): a guard is verified by BREAKING it first. Here the
 * mutations are inputs rather than code edits — each asserts one guard fires, and one asserts it
 * stays silent where it must.
 */
export function selftestGuard() {
	const fails = [];
	const ok = (name, cond) => {
		if (!cond) fails.push(name);
	};
	const hit = (line) => {
		// A one-line, in-memory run of the same predicates the scanner uses.
		if (EXCEPTION.test(line)) {
			const ex = EXCEPTION.exec(line);
			return !ex.groups.reason || !ex.groups.reason.trim() ? 'пустая причина' : null;
		}
		if (POINTS_AT_INTERVIEWS.test(line) || MENTIONS_INTERVIEW.test(line)) return null;
		if (QUEUE_HEADING.test(line)) return 'заголовок-очередь';
		const head = LINE_ADDRESS.exec(line)?.groups.head ?? '';
		return ADDRESS_MARKER.test(head) ? 'обращение' : null;
	};

	// MUT-1 — a NEW violation must go red.
	ok('мутация 1: заголовок-очередь ловится', hit('## Открытые вопросы / что должен решить владелец') === 'заголовок-очередь');
	ok('мутация 1b: английский вариант ловится', hit('## Open questions for the owner') === 'заголовок-очередь');
	ok('мутация 1c: обращение в начале строки ловится', hit('- ⛔ ждёт владельца: какой формат имени?') === 'обращение');
	// MUT-2 — a marker WITH a reason must go green.
	ok(
		'мутация 2: маркер с причиной глушит строку',
		hit('## Открытые вопросы <!-- ВОПРОС-ОК: закрыты в интервью 001, раздел исторический -->') === null,
	);
	// MUT-3 — a marker with an EMPTY reason is itself a violation.
	ok('мутация 3: маркер без причины — сам нарушение', hit('## Открытые вопросы <!-- ВОПРОС-ОК:  -->') === 'пустая причина');
	// Must stay SILENT: a line that already points at the place of questions.
	ok('тишина: строка ссылается на interviews/', hit('- ⛔ вопрос вынесен в interviews/interview_004_x.md') === null);
	ok('тишина: упоминание «интервью №»', hit('## Открытые вопросы — закрыты в интервью №001') === null);
	// Must stay SILENT: prose in the middle of a paragraph (the marker sits far from the start).
	ok(
		'тишина: проза в середине абзаца',
		hit('Здесь довольно длинное предложение, и только глубоко внутри него встречается слово вопрос владельцу.') === null,
	);
	// Non-ASCII sanity: the guard must not miss its own language (rake 7).
	ok('не-ASCII: кириллица не теряется', hit('### ❓ Вопросы к владельцу') === 'заголовок-очередь');

	return fails;
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
	if (process.argv.includes('--selftest')) {
		const fails = selftestGuard();
		console.log(fails.length ? '🔴 ПРОВАЛЫ СТРАЖА:\n  ' + fails.join('\n  ') : '✅ самотест стража чист (все охранники умеют срабатывать)');
		return fails.length ? 1 : 0;
	}

	const findings = scanQuestionPlaces();

	if (process.argv.includes('--baseline')) {
		const p = writeBaseline(findings);
		console.log(`Базовая линия переписана: ${p.keys.length} унаследованных нарушений (${BASELINE.replace(ROOT, '')}).`);
		return 0;
	}

	const base = new Set(loadBaseline().keys);
	const fresh = findings.filter((f) => !base.has(keyOf(f.file, f.text)));
	const inherited = findings.length - fresh.length;

	console.log('МЕСТО ВОПРОСОВ — правило: всё, что агент хочет ОТ владельца, живёт только в interviews/\n');

	if (fresh.length) {
		console.log(`🔴 НОВЫХ НАРУШЕНИЙ: ${fresh.length}`);
		for (const f of fresh) console.log(`   ${f.file}:${f.line} — ${f.kind}\n      ${f.text.slice(0, 110)}`);
		console.log('\n   Перенеси вопрос в interviews/ (скилл /interview). Если строка законна —');
		console.log('   поставь на неё <!-- ВОПРОС-ОК: причина --> С ПРИЧИНОЙ (маркер без причины не считается).\n');
	} else {
		console.log('✅ Новых нарушений нет.\n');
	}

	// The debt is printed EVERY run, as a number that must go down.
	console.log(`📉 Унаследованный долг: ${inherited} (снят в базовую линию; это число обязано убывать)`);

	const { waiting, stale } = inspectInterviews();
	console.log(`\nИНТЕРВЬЮ, ЖДУЩИЕ ВЛАДЕЛЬЦА: ${waiting.length}`);
	for (const w of waiting) {
		console.log(`   🟡 ${w.file} — ${w.status}`);
		for (const t of w.open) console.log(`      ⛔ ${t}`);
		console.log(`      открыть: node tools/review.mjs open ${w.file}`);
	}
	if (!waiting.length) console.log('   ✅ ни одного.');

	if (stale.length) {
		console.log(`\n🟠 СТАТУС ПРОТУХ: ${stale.length} — документ кричит «ждёт», а ответы в нём уже есть`);
		for (const s of stale) console.log(`   ${s.file} — «${s.status}», но ${s.why}`);
		console.log('   Следующая сессия будет ждать того, что давно дано. Обнови строку статуса.');
	}

	// Only NEW violations fail the run. Stale statuses are reported loudly but do not block: they are
	// a documentation defect, not a canon breach, and a guard that blocks on them would be ignored.
	return fresh.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	process.exit(main());
}
