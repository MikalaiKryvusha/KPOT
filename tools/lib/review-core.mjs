// tools/lib/review-core.mjs — THE CORE OF THE OWNER-REVIEW CONTOUR.
// [NOT-TESTED] — flipped to [TESTED] by `node tools/review.mjs --selftest` plus a live run over
// every document in interviews/ (the contour's handover condition: fixtures do not catch live files).
//
// Everything that MUST be identical between the page and the sender lives here: text normalization,
// the body hash, document parsing, decision paths. The module is deliberately ONE file.
//
// 🔴 WHY ONE — THE MOST EXPENSIVE RAKE IN THE SKILL (`/owner-reviews`, rake 1):
//   «the page hashing file bytes while the sender hashed normalized text (trailing \n stripped);
//    both self-tests green, the gate would refuse every artifact always.»
// Two hash implementations drift apart silently, both self-tests stay green, and the gate refuses
// EVERYTHING forever. So normalization is declared here as the single contract and both sides call
// the same function.
//
// The skill's invariants this module holds:
//   I1 — md is the source, HTML is derived (the page is built here and NEVER hand-edited);
//   I2 — a decision is written in THREE places, and the decision filename is DERIVED from the document;
//   I3 — approval binds to the SHA-256 of the BODY under an agreed normalization;
//   I6 — quiet hours CROSS MIDNIGHT.
//
// Ported from the field-proven contour of the neighbouring NDim project (owner's instruction,
// 2026-08-01: «надо изучить то, как сделано в NDim проекте … и точно так же сделать»). Every
// comment marked 🔴 below records a defect that was paid for there — none of them are theoretical.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The project root. Overridable by `KPOT_REVIEW_ROOT` for ONE reason: the specs must be able to
 * exercise the whole contour — including the write into `interviews/decisions/` — WITHOUT touching
 * the live repository. Every destructive test runs in a temp dir (`AGENT_GUIDE` §Test harness), and
 * without this seam a spec that proves the decision write would leave real files behind.
 */
export const ROOT = process.env.KPOT_REVIEW_ROOT
	? resolve(process.env.KPOT_REVIEW_ROOT)
	: fileURLToPath(new URL('../..', import.meta.url));
export const DECISIONS_DIR = join(ROOT, 'interviews', 'decisions');
export const ARCHIVE_DIR = join(DECISIONS_DIR, 'archive');
export const QUEUE_FILE = join(DECISIONS_DIR, 'queue.json');

// ─────────────────────────────────────────────────────────────────────────────
// THE NORMALIZATION AND HASH CONTRACT (I3) — one for the whole contour
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text normalization before hashing. Exactly four steps, in this order:
 *   1) strip the BOM (Windows editors write one, git does not);
 *   2) CRLF and CR → LF (this project lives on Windows with core.autocrlf=true — EXP-0027's family);
 *   3) strip trailing whitespace at the end of the file;
 *   4) put exactly one terminating newline.
 * Changing this list VOIDS EVERY APPROVAL EVER GIVEN. It is a deliberate operation, never a tidy-up.
 */
export function normalizeText(input) {
	return String(input).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\s+$/, '') + '\n';
}

/** SHA-256 of the normalized text. One function for the page and for the gate. */
export function textHash(input) {
	return createHash('sha256').update(normalizeText(input), 'utf8').digest('hex');
}

/** SHA-256 of a body that lives in a file. Reads the BYTES and runs them through the same normalizer. */
export function bodyHash(path) {
	return textHash(readFileSync(path, 'utf8'));
}

/** Reads markdown with newlines normalized (for PARSING — not for hashing). */
export function readMd(path) {
	return readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE NAME CONTRACT — the document's metadata block
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mini-parser for the YAML metadata block in a document head. Exactly the slice the skill's name
 * contract describes is supported: scalars plus an `artifacts` list of inline mappings.
 *
 * ⚠️ THE BLOCK IS OPTIONAL. All three of KPOT's live interviews are written without it, and
 * demanding one would mean rewriting the owner's documents to suit the tool — directly against I1
 * («md is the source»). No block → `kind: interview`, and the title comes from the first `# `.
 */
export function parseMeta(text) {
	const m = /^```ya?ml\n([\s\S]*?)\n```/u.exec(text);
	const meta = { kind: 'interview', title: null, artifacts: [] };
	if (m) {
		let current = null;
		for (const line of m[1].split('\n')) {
			if (!line.trim() || line.trim().startsWith('#')) continue;
			const item = /^\s*-\s*(.*)$/u.exec(line);
			if (item && current === 'artifacts') {
				meta.artifacts.push(parseInline(item[1]));
				continue;
			}
			const kv = /^(\w+):\s*(.*)$/u.exec(line);
			if (!kv) continue;
			current = kv[1];
			if (kv[2].trim()) meta[kv[1]] = strip(kv[2]);
		}
	}
	if (!meta.title) {
		const h = /^#\s+(.+)$/mu.exec(text);
		meta.title = h ? h[1].trim() : 'Документ';
	}
	return meta;
}

const strip = (s) => s.trim().replace(/^["']|["']$/g, '');

/** Parses a line like `{id: a1, target: "GitHub · issue", body_file: drafts/a1.md}`. */
function parseInline(s) {
	const out = {};
	const inner = s.trim().replace(/^\{|\}$/g, '');
	for (const part of inner.split(/,(?![^"']*["'][^"']*$)/u)) {
		const kv = /^\s*(\w+)\s*:\s*(.*)$/u.exec(part);
		if (kv) out[kv[1]] = strip(kv[2]);
	}
	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING AN INTERVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A question heading: `### Q1.`, `### В1.`, `#### Р5.` — letter(s) + number + a dot.
 * Both alphabets on purpose: KPOT writes `Q1` in Latin, the neighbouring project writes `В1` in
 * Cyrillic, and one contour has to read documents of either shape.
 * `\p{Lu}` with the `u` flag, NOT `\w` — in Node `\w` is ASCII-only EVEN under `u` (skill rake 7),
 * so an ASCII class would silently skip every Cyrillic-labelled question.
 */
const Q_HEADING = /^#{2,4}\s*(?<label>[\p{Lu}]{1,2}\d+)\s*[.．)]/u;
const ANSWER_FIELD = /\*\*Ответ(?<note>[^*]*?):?\*\*:?/u;
/**
 * 🔴 A FIELD LABELLED AS A COUNTER-QUESTION IS NOT AN ANSWER.
 * Caught on a live document in the neighbouring project: a field was labelled
 * «**Ответ (вопрос владельца):**», held the owner's question back to the agent and the agent's
 * reply, and the fork itself was NOT chosen. Formally the field is non-empty, so the page reported
 * «ждут ответа: 0» on the only blocking question of the wave — i.e. it summoned the owner to a
 * place where everything looked closed.
 */
const COUNTER_QUESTION = /вопрос/iu;
/**
 * An answer option: `- **A) (рекомендую)** text` — the letter may be Latin or Cyrillic.
 *
 * 🔴 THE PARSE MUST BE MULTILINE. The first edition looked for the closing `**` on the SAME line,
 * and an option whose bold head wrapped onto a second line simply VANISHED from the page. Caught by
 * the owner on a live question: of four options, three were clickable, and the one that disappeared
 * was the recommended one.
 *
 * A silently dropped option is the worst defect this contour can have: the page looks healthy, the
 * owner chooses among what he SEES, and the decision is taken from a TRUNCATED list. Hence not only
 * this fix but the counting check in `selftest` and in the live pilot — the number of candidate
 * lines must equal the number of parsed options for EVERY question of EVERY live interview.
 */
const OPTION_START = /^\s*[-*]\s+\*\*(?<letter>[\p{Lu}])\)/u;
const OPTION_FULL = /\*\*(?<letter>[\p{Lu}])\)\s*(?<label>[\s\S]*?)\*\*(?<rest>[\s\S]*)/u;
/** Continuation of a list item: indented, not a new item, not empty. */
const LIST_CONT = /^\s{2,}\S/u;

/**
 * Parses an interview document into a structure usable by both the guard and the page.
 * Per question: label, title, options, answer text, the block's line span.
 */
export function parseInterview(relPath, text) {
	const lines = text.split('\n');
	const statusLine = lines.find((l) => /Статус[:\s*]/u.test(l) && /^[>|\s*#-]/u.test(l));
	const questions = [];

	let current = null;
	const close = (endLine) => {
		if (current) {
			current.endLine = endLine;
			questions.push(current);
		}
		current = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const h = Q_HEADING.exec(line);
		if (h) {
			close(i);
			current = {
				label: h.groups.label,
				title: line.replace(/^#+\s*/u, '').trim(),
				startLine: i,
				answerLine: -1,
				options: [],
				answer: '',
				body: [],
			};
			continue;
		}
		// A question block is closed by a level-1/2 heading OR by a horizontal rule.
		// 🔴 The rule was added by the LIVE PILOT, not by a fixture: without it a `---` standing after
		// an empty «**Ответ:**» field fell INTO the answer and made an unanswered question look
		// answered. The symptom was mild and therefore dangerous — the page still drew the input box,
		// but the header said «ждут ответа: 2» while three were empty, and the guard would have
		// called the interview closed.
		if (/^#{1,2}\s/u.test(line) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/u.test(line)) {
			close(i);
			continue;
		}
		if (!current) continue;

		if (OPTION_START.test(line) && current.answerLine < 0) {
			current.optionLines = (current.optionLines ?? 0) + 1;
			// Collect the item WHOLE: the marker line plus its indented continuations. An option's
			// bold head wraps onto a second line easily — this contour has already been burned by it.
			let text = line;
			for (let j = i + 1; j < lines.length; j++) {
				if (!LIST_CONT.test(lines[j]) || OPTION_START.test(lines[j])) break;
				if (/^\s*[-*]\s/u.test(lines[j])) break;
				text += ' ' + lines[j].trim();
			}
			const o = OPTION_FULL.exec(text);
			if (o) {
				current.options.push({
					letter: o.groups.letter,
					label: (o.groups.label + ' ' + o.groups.rest).trim().replace(/\s+/g, ' ').slice(0, 300),
				});
			}
		}
		const field = current.answerLine < 0 ? ANSWER_FIELD.exec(line) : null;
		if (field) {
			current.answerLine = i;
			// A counter-question field counts as EMPTY: the fork is unchosen, the question is alive.
			current.counterQuestion = COUNTER_QUESTION.test(field.groups.note ?? '');
			current.answer += line.replace(ANSWER_FIELD, '').trim() + '\n';
			continue;
		}
		if (current.answerLine >= 0) current.answer += line + '\n';
		else current.body.push(line);
	}
	close(lines.length);

	for (const q of questions) {
		q.answer = q.answer.trim();
		q.answered = q.answerLine >= 0 && q.answer.length > 0 && !q.counterQuestion;
	}

	// Two forms of one line: `statusRaw` keeps the markdown (the page renders it), `status` is plain
	// text for the console. A shared strip used to cut `>` together with `**`, and «Статус:** 🟡 …»
	// leaked onto the page — caught by eye on a screenshot, not by a check.
	const statusRaw = statusLine ? statusLine.replace(/^[>\s]+/u, '').trim() : null;
	const status = statusRaw ? statusRaw.replace(/\*\*/g, '').trim() : null;
	// 🔑 The truth about whether an interview is closed is the DOCUMENT'S STATUS, not how full its
	// fields are. Verified on live data in the neighbouring project: a field can be non-empty (the
	// owner asked back, the agent replied) while the fork stays unchosen and the interview open.
	// KPOT writes «❓ ОЖИДАЕТ ОТВЕТА ВЛАДЕЛЬЦА» and «🟡 ожидает ответов владельца» — both must read
	// as waiting, and «✅ ОТВЕТЫ ПОЛУЧЕНЫ» must not.
	const waiting = status ? /❓|🟡|🔴|ожида|жд[её]т/iu.test(status) : false;
	return { file: relPath, status, statusRaw, waiting, questions, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN → HTML (mini-renderer, zero dependencies)
// ─────────────────────────────────────────────────────────────────────────────

const esc = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline transforms: code, bold, italics, links, strikethrough. */
export function inline(s) {
	let t = esc(s);
	t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
	t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
	t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
	t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
	return t;
}

/**
 * Markdown → HTML. Covers what the project's documents are actually written in: headings, lists,
 * tables, quotes, fenced code, horizontal rules, paragraphs.
 * Deliberately NOT covered: nested lists deeper than one level, footnotes, raw HTML.
 */
export function mdToHtml(md) {
	const lines = md.split('\n');
	const out = [];
	let i = 0;
	let inCode = false;
	let listType = null;
	let para = [];

	const flushPara = () => {
		if (para.length) {
			out.push(`<p>${inline(para.join(' '))}</p>`);
			para = [];
		}
	};
	const flushList = () => {
		if (listType) {
			out.push(`</${listType}>`);
			listType = null;
		}
	};

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code — emitted verbatim
		if (/^```/.test(line)) {
			flushPara();
			flushList();
			if (!inCode) {
				out.push('<pre><code>');
				inCode = true;
			} else {
				out.push('</code></pre>');
				inCode = false;
			}
			i++;
			continue;
		}
		if (inCode) {
			out.push(esc(line));
			i++;
			continue;
		}

		// Table: a line with | followed by a separator row
		if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
			flushPara();
			flushList();
			const cells = (l) =>
				l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
			out.push('<div class="tw"><table><thead><tr>');
			for (const c of cells(line)) out.push(`<th>${c}</th>`);
			out.push('</tr></thead><tbody>');
			i += 2;
			while (i < lines.length && /^\s*\|/.test(lines[i])) {
				out.push('<tr>');
				for (const c of cells(lines[i])) out.push(`<td>${c}</td>`);
				out.push('</tr>');
				i++;
			}
			out.push('</tbody></table></div>');
			continue;
		}

		// Heading
		const h = /^(#{1,6})\s+(.*)$/.exec(line);
		if (h) {
			flushPara();
			flushList();
			const n = h[1].length;
			out.push(`<h${n}>${inline(h[2])}</h${n}>`);
			i++;
			continue;
		}

		// Horizontal rule
		if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			flushPara();
			flushList();
			out.push('<hr>');
			i++;
			continue;
		}

		// Quote (collected as a block and rendered recursively)
		if (/^\s*>/.test(line)) {
			flushPara();
			flushList();
			const buf = [];
			while (i < lines.length && /^\s*>/.test(lines[i])) {
				buf.push(lines[i].replace(/^\s*>\s?/, ''));
				i++;
			}
			out.push(`<blockquote>${mdToHtml(buf.join('\n'))}</blockquote>`);
			continue;
		}

		// List
		const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
		if (li) {
			flushPara();
			const want = /^\d/.test(li[1]) ? 'ol' : 'ul';
			if (listType !== want) {
				flushList();
				out.push(`<${want}>`);
				listType = want;
			}
			// Indented continuations glue onto the same item
			let item = li[2];
			while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*+]|\d+[.)])\s/.test(lines[i + 1])) {
				item += ' ' + lines[i + 1].trim();
				i++;
			}
			out.push(`<li>${inline(item)}</li>`);
			i++;
			continue;
		}

		// Blank line
		if (!line.trim()) {
			flushPara();
			flushList();
			i++;
			continue;
		}

		para.push(line.trim());
		i++;
	}
	flushPara();
	flushList();
	if (inCode) out.push('</code></pre>');
	return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS (I2) — three places
// ─────────────────────────────────────────────────────────────────────────────

/** The document's base name without extension — the decision filenames DERIVE from it. */
export const docBase = (docPath) => basename(docPath).replace(/\.md$/u, '');

/** Path of the decision file. Derived from the document name: a shared file would be overwritten. */
export const decisionPath = (docPath) => join(DECISIONS_DIR, `${docBase(docPath)}.decision.json`);

/** Reads a decision if one exists. A read error means «no decision» — the fail-closed gate decides. */
export function readDecision(docPath) {
	const p = decisionPath(docPath);
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf8'));
	} catch {
		return null;
	}
}

/**
 * Writes a decision in THREE places (I2):
 *   1) back into the source md — the next empty-context session reads the DOCUMENT;
 *   2) `<base>.decision.json` — the machine check before a send;
 *   3) a copy in the archive with `by` and `at` — this is what makes the archive readable months later.
 * Returns the list of paths touched.
 */
export function writeDecision({ docPath, kind, by, at, comment, answers = {}, artifacts = {} }) {
	mkdirSync(ARCHIVE_DIR, { recursive: true });
	const record = {
		kind,
		document: relative(ROOT, docPath).split('\\').join('/'),
		by,
		at,
		comment: comment || '',
		...(Object.keys(answers).length ? { answers } : {}),
		...(Object.keys(artifacts).length ? { artifacts } : {}),
	};

	// (1) — back into the md: per-question answers and the whole-document comment
	const touchedMd = applyAnswersToMd(docPath, answers, by, at) ?? (comment ? docPath : null);
	if (comment && comment.trim()) appendDocComment(docPath, comment.trim(), by, at);

	// (2) — the decision file beside it, named after the document
	const prev = readDecision(docPath);
	const merged = prev
		? {
				...record,
				answers: { ...(prev.answers ?? {}), ...answers },
				artifacts: { ...(prev.artifacts ?? {}), ...artifacts },
				history: [...(prev.history ?? []), { by: prev.by, at: prev.at }],
			}
		: record;
	writeFileSync(decisionPath(docPath), JSON.stringify(merged, null, '\t') + '\n', 'utf8');

	// (3) — an archive copy, never overwritten
	const stamp = at.replace(/[:.]/g, '-');
	writeFileSync(
		join(ARCHIVE_DIR, `${docBase(docPath)}--${stamp}.json`),
		JSON.stringify(record, null, '\t') + '\n',
		'utf8',
	);

	return {
		md: touchedMd,
		decision: decisionPath(docPath),
		archive: join(ARCHIVE_DIR, `${docBase(docPath)}--${stamp}.json`),
	};
}

/**
 * Appends the whole-document comment to the END of the md.
 *
 * Why the end and not the head: the document's head is written by the agent and answers «what is
 * this about». The owner's comment is his reaction TO WHAT HE READ, and its place is after the text.
 * Each arrival is its own dated block — comments accumulate rather than overwrite one another.
 */
export function appendDocComment(docPath, comment, by, at) {
	const raw = readFileSync(docPath, 'utf8');
	const eol = raw.includes('\r\n') ? '\r\n' : '\n';
	const lines = raw.replace(/^\uFEFF/, '').replace(/\s+$/, '').split(/\r?\n/);
	lines.push(
		'',
		'---',
		'',
		`## 💬 Комментарий владельца — ${at.slice(0, 10)}`,
		'',
		...comment.split(/\r?\n/),
		'',
		`<!-- owner-review: by="${by}" at="${at}" транспорт=страница вид=общий-комментарий -->`,
	);
	writeFileSync(docPath, lines.join(eol) + eol, 'utf8');
	return docPath;
}

/**
 * Writes answers back into the source md.
 *
 * 🔴 The inviolability rule for the owner's originals (`AGENT_GUIDE` → git hygiene): an answer the
 * owner has ALREADY written is never overwritten. New text arrives as a separate dated refinement
 * field; the old one stays verbatim.
 */
export function applyAnswersToMd(docPath, answers, by, at) {
	if (!Object.keys(answers).length) return null;
	const raw = readFileSync(docPath, 'utf8');
	const eol = raw.includes('\r\n') ? '\r\n' : '\n';
	const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
	const parsed = parseInterview(docPath, lines.join('\n'));

	// Walk BOTTOM-UP: insertions must not shift the line numbers not yet processed.
	const targets = parsed.questions
		.filter((q) => answers[q.label])
		.sort((a, b) => b.startLine - a.startLine);

	for (const q of targets) {
		const a = answers[q.label];
		const parts = [];
		if (a.choice) parts.push(`**${a.choice}**`);
		if (a.text && a.text.trim()) parts.push(a.text.trim());
		const body = parts.join(' — ') || '—';
		const mark = `<!-- owner-review: by="${by}" at="${at}" транспорт=страница -->`;

		if (!q.answered && q.answerLine >= 0) {
			// The field is empty — fill that same field.
			lines[q.answerLine] = `**Ответ:** ${body}`;
			lines.splice(q.answerLine + 1, 0, mark);
		} else {
			// An answer already exists (or there is no field at all) — append a refinement, erase nothing.
			const at1 = q.endLine;
			lines.splice(at1, 0, '', `**Ответ (уточнение ${at.slice(0, 10)}):** ${body}`, mark);
		}
		if (a.comment && a.comment.trim()) {
			const idx = lines.indexOf(mark);
			lines.splice(idx, 0, `> ${a.comment.trim()}`);
		}
	}
	writeFileSync(docPath, lines.join(eol), 'utf8');
	return docPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE APPROVAL GATE (I3, I4) — one implementation for page, gate and sender
// ─────────────────────────────────────────────────────────────────────────────

/** A document's artifacts with their body paths resolved. */
export function artifactsOf(docPath) {
	const meta = parseMeta(readMd(docPath));
	return meta.artifacts.map((a) => ({
		...a,
		absolute: a.body_file ? join(ROOT, a.body_file) : null,
	}));
}

/**
 * The single «may this be sent» check.
 *
 * 🔴 FAIL-CLOSED (I4): any doubt is a REFUSAL. No decision, `rejected`, artifact not declared, body
 * gone, hash drifted, decision file unreadable — every one of those is a refusal, never a
 * «probably fine». A request NEVER approves itself by timeout.
 *
 * Returns {ok:boolean, reason:string, ...} and never throws.
 */
export function checkApproval(docPath, artifactId) {
	try {
		if (!existsSync(docPath)) return { ok: false, reason: `документа нет: ${docPath}` };

		const art = artifactsOf(docPath).find((a) => a.id === artifactId);
		if (!art) return { ok: false, reason: `артефакт «${artifactId}» не объявлен в метаблоке документа` };
		if (!art.absolute || !existsSync(art.absolute))
			return { ok: false, reason: `файл тела не найден: ${art.body_file}` };

		const decision = readDecision(docPath);
		if (!decision) return { ok: false, reason: 'решения нет — владелец ничего не одобрял' };

		const rec = decision.artifacts?.[artifactId];
		if (!rec) return { ok: false, reason: `в решении нет записи про артефакт «${artifactId}»` };
		if (rec.status !== 'approved')
			return { ok: false, reason: `статус «${rec.status}», а не «approved»` };
		if (!rec.sha256) return { ok: false, reason: 'в решении нет хеша — одобрение не привязано к тексту' };

		const now = bodyHash(art.absolute);
		if (now !== rec.sha256)
			return {
				ok: false,
				reason: 'ТЕКСТ ИЗМЕНИЛСЯ ПОСЛЕ ОДОБРЕНИЯ — одобрение аннулировано',
				approved: rec.sha256,
				current: now,
			};

		return { ok: true, reason: 'одобрено', by: decision.by, at: decision.at, sha256: now, artifact: art };
	} catch (e) {
		// Even an unexpected error is a refusal. The gate has no right to let something through by accident.
		return { ok: false, reason: `сбой проверки (считаем отказом): ${e.message}` };
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// QUIET HOURS (I6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quiet hours. The window CROSSES MIDNIGHT (default 23:00–09:00), and the naive comparison
 * `from <= now <= to` on such a window is silent all day and loud all night — exactly backwards.
 * The skill (I6) demands a dedicated guard on this comparison; it lives in `selftest()`.
 */
export function isQuiet(date, from = '23:00', to = '09:00') {
	const min = (s) => {
		const [h, m] = s.split(':').map(Number);
		return h * 60 + m;
	};
	const now = date.getHours() * 60 + date.getMinutes();
	const a = min(from);
	const b = min(to);
	return a <= b ? now >= a && now < b : now >= a || now < b;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the one the field did not have
// ─────────────────────────────────────────────────────────────────────────────

export function selftest() {
	const fails = [];
	const ok = (name, cond) => {
		if (!cond) fails.push(name);
	};

	// I3 — the normalization agreement. All four «faces» of one text must give ONE hash.
	const base = 'привет\nмир\n';
	ok('хеш: CRLF = LF', textHash('привет\r\nмир\r\n') === textHash(base));
	ok('хеш: BOM не влияет', textHash('\uFEFFпривет\nмир\n') === textHash(base));
	ok('хеш: хвост из пустых строк не влияет', textHash('привет\nмир\n\n\n  \n') === textHash(base));
	ok('хеш: нет хвостового перевода строки', textHash('привет\nмир') === textHash(base));
	ok('хеш: разный текст — разный хеш', textHash('привет\nмиp\n') !== textHash(base));

	// I6 — quiet hours crossing midnight. Exactly the case that breaks the naive comparison.
	const at = (h, m = 0) => new Date(2026, 7, 1, h, m);
	ok('тихо в 23:30', isQuiet(at(23, 30)) === true);
	ok('тихо в 03:00', isQuiet(at(3)) === true);
	ok('тихо в 08:59', isQuiet(at(8, 59)) === true);
	ok('шумно в 09:00', isQuiet(at(9)) === false);
	ok('шумно в 14:00', isQuiet(at(14)) === false);
	ok('шумно в 22:59', isQuiet(at(22, 59)) === false);
	// A window that does NOT cross midnight must work too.
	ok('обычное окно 13–14: тихо в 13:30', isQuiet(at(13, 30), '13:00', '14:00') === true);
	ok('обычное окно 13–14: шумно в 12:00', isQuiet(at(12), '13:00', '14:00') === false);

	// Parsing questions and options — in KPOT's OWN shape: Latin `Q1`, options `A)`/`B)`.
	const doc = [
		'# Интервью №999 — проба',
		'**Статус:** ❓ ОЖИДАЕТ ОТВЕТА ВЛАДЕЛЬЦА',
		'',
		'### Q1. Первый вопрос?',
		'- **A) (рекомендую)** первый вариант',
		'- **B) второй** хвост',
		'',
		'**Ответ:**',
		'',
		'### Q2. Второй вопрос?',
		'',
		'**Ответ:** B',
		'',
	].join('\n');
	const p = parseInterview('проба.md', doc);
	ok('разбор: два вопроса', p.questions.length === 2);
	ok('разбор: метки Q1/Q2', p.questions.map((q) => q.label).join() === 'Q1,Q2');
	ok('разбор: два варианта у Q1', p.questions[0].options.length === 2);
	ok('разбор: буквы вариантов', p.questions[0].options.map((o) => o.letter).join() === 'A,B');
	ok('разбор: Q1 без ответа', p.questions[0].answered === false);
	ok('разбор: Q2 с ответом', p.questions[1].answered === true);
	ok('разбор: статус ❓ читается как «ждёт»', p.waiting === true);
	ok(
		'разбор: статус ✅ ОТВЕТЫ ПОЛУЧЕНЫ НЕ считается ожиданием',
		parseInterview('x.md', '> Статус: **✅ ОТВЕТЫ ПОЛУЧЕНЫ 2026-07-24**\n').waiting === false,
	);
	// Cyrillic labels must parse too — the contour reads documents of either shape.
	const cyr = parseInterview('x.md', '### В1. Вопрос?\n- **А) (рекомендуется)** вариант\n\n**Ответ:**\n');
	ok('разбор: кириллическая метка В1', cyr.questions[0]?.label === 'В1');
	ok('разбор: кириллическая буква варианта А', cyr.questions[0]?.options[0]?.letter === 'А');

	// A field labelled as a COUNTER-QUESTION is not an answer: the fork is unchosen.
	const counter = [
		'### Q9. Развилка?',
		'- **A) (рекомендую)** вариант',
		'',
		'**Ответ (вопрос владельца):** «а можно иначе?»',
		'',
		'> ### Ответ агента: можно, но…',
		'',
	].join('\n');
	const pc = parseInterview('проба.md', counter);
	ok('встречный вопрос НЕ считается ответом', pc.questions[0]?.answered === false);
	ok('встречный вопрос помечен признаком', pc.questions[0]?.counterQuestion === true);
	ok(
		'обычное поле ответом считается',
		parseInterview('x.md', '### Q9. Вопрос?\n\n**Ответ:** B\n').questions[0]?.answered === true,
	);
	// A horizontal rule after an EMPTY answer field must not make the question look answered.
	const ruled = ['### Q3. Вопрос?', '', '**Ответ:**', '', '---', '', '## Дальше', ''].join('\n');
	ok('линейка после пустого поля не делает вопрос отвеченным', parseInterview('x.md', ruled).questions[0]?.answered === false);
	// A wrapped option (bold head on the next line) must survive — this is what burned the contour.
	const wrapped = [
		'### Q8. Развилка?',
		'- **A) первый** хвост',
		'- **B) (ДОБАВЛЕН по вашему вопросу — и это лучший вариант) Ни один язык не сидит на',
		'  корне.** Оба живут своими адресами.',
		'- **C) свой ответ** —',
		'',
		'**Ответ:**',
		'',
	].join('\n');
	const pw = parseInterview('x.md', wrapped);
	ok('вариант с переносом строки не теряется', pw.questions[0]?.options.length === 3);
	ok('буквы вариантов с переносом верны', pw.questions[0]?.options.map((o) => o.letter).join() === 'A,B,C');
	// The COUNTING check the field asked for: candidate lines must equal parsed options.
	ok('счётная сверка: строк-кандидатов = разобранных вариантов', pw.questions[0]?.optionLines === pw.questions[0]?.options.length);

	// Renderer: connectivity, not merely «it did not throw»
	const html = mdToHtml(doc);
	ok('рендер: заголовок', html.includes('<h1>'));
	ok('рендер: список', html.includes('<li>'));
	ok('рендер: жирный', html.includes('<strong>'));
	ok('рендер: цитата', mdToHtml('> цитата').includes('<blockquote>'));
	ok('рендер: таблица', mdToHtml('| а | б |\n|---|---|\n| 1 | 2 |').includes('<table>'));
	ok('рендер: код дословно', mdToHtml('```\n<b>\n```').includes('&lt;b&gt;'));
	ok('рендер: экранирование', mdToHtml('<script>').includes('&lt;script&gt;'));
	ok('рендер: ссылка', mdToHtml('[а](/б)').includes('<a href="/б">'));

	// The metadata block
	const meta = parseMeta('```yaml\ntitle: Черновик\nkind: outbound\nartifacts:\n  - {id: a1, target: "GitHub · repo", body_file: drafts/a1.md}\n```\n\n# Заголовок\n');
	ok('мета: kind', meta.kind === 'outbound');
	ok('мета: title', meta.title === 'Черновик');
	ok('мета: артефакт разобран', meta.artifacts[0]?.id === 'a1');
	ok('мета: цель с пробелами', meta.artifacts[0]?.target === 'GitHub · repo');
	ok('мета: без блока — интервью', parseMeta('# Просто\n').kind === 'interview');
	ok('мета: заголовок из #', parseMeta('# Просто\n').title === 'Просто');

	// Decision names derive from the document (I2)
	ok(
		'решение: имя производно',
		decisionPath('/x/interviews/interview_003_interface.md').endsWith('interview_003_interface.decision.json'),
	);
	ok('решение: разные документы — разные файлы', decisionPath('/x/a.md') !== decisionPath('/x/b.md'));

	// The gate is fail-closed on a document that does not exist (I4)
	ok('гейт: нет документа — отказ', checkApproval('/nope/none.md', 'a1').ok === false);

	return fails;
}
