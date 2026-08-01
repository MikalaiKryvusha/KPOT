#!/usr/bin/env node
/**
 * review.mjs — THE OWNER-REVIEW CONTOUR: the question page, the decision record, the signal, the queue.
 *
 * Rules: `.claude/skills/owner-reviews/SKILL.md`. Built to the executable contract in the
 * neighbouring NDim project's field report (`D:\work\ai_sandbox\ndim\researches\28_owner_reviews_contour_field_report.md`,
 * Part II — written expressly «для агента на другом проекте»), on the owner's instruction of
 * 2026-08-01: «надо изучить то, как сделано в NDim проекте … и точно так же сделать».
 *
 * The thought of the rules that is easiest to lose: **HTML is not the goal but the transport; the
 * goal is the GUARD.** The hard rule («the place of questions is interviews/ only») lives in
 * `AGENT_GUIDE.md` and is watched by `tools/questions-guard.mjs`. This tool is the optional layer on
 * top that makes answering a one-click act. An answer's force does not depend on the transport:
 * **HTML = md = chat**.
 *
 * Commands:
 *   node tools/review.mjs open  <document.md>   raise the page, open the browser, call the owner
 *   node tools/review.mjs render <document.md>  snapshot the page to a file (self-contained, offline)
 *   node tools/review.mjs list                  every interview waiting for the owner
 *   node tools/review.mjs queue <document.md>   park it in the queue (for autonomous loops)
 *   node tools/review.mjs batch                 one «накопилось N» page for the whole queue
 *   node tools/review.mjs --selftest            self-test of the core and the contour's guards
 *
 * Flags: --by "Name" · --voice "VoiceName" · --no-signal · --no-open · --no-serve · --timeout MIN · --port N
 *
 * [NOT-TESTED] — flipped to [TESTED] by `--selftest`, by `tests/review_contour.test.mjs`, and by a
 * live pilot over every document in interviews/ (the contour's handover condition: fixtures do not
 * catch live files — three of the field's defects surfaced only on real documents).
 */

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, basename, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
	ROOT,
	DECISIONS_DIR,
	QUEUE_FILE,
	readMd,
	parseMeta,
	parseInterview,
	mdToHtml,
	inline,
	bodyHash,
	artifactsOf,
	writeDecision,
	isQuiet,
	selftest,
} from './lib/review-core.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt = null) => {
	const i = argv.indexOf(name);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

/**
 * Who is answering. A PARAMETER, not a question on the page: `by` is what makes the archive
 * readable months later, but on a one-owner project ASKING for it every time is friction with no
 * payoff (the owner's ruling in the neighbouring project: «убрать это поле вообще полностью, я
 * всегда отвечаю»). The QUESTION was removed; the RECORD was not.
 * Spelling is KPOT's canonical one from `AGENT_GUIDE.md` §Project identity.
 */
const BY = opt('--by', process.env.KPOT_OWNER || 'Mikalai Kryvusha');
/** How the voice addresses him — his Russian first name, the form the sibling contour already uses. */
const ADDRESS = process.env.KPOT_OWNER_ADDRESS || 'Николай';
/**
 * The voice is a PARAMETER, not a menu (the rules: one field machine had exactly one usable voice
 * out of 185).
 *
 * 🎙 Two tracts, the first BORROWED from the neighbouring KLAS project on this same machine:
 *
 *   1. **Silero v5 ru** — `F:\KLAS\tools\voice-say.mjs` (local, offline, CPU; voices `aidar`,
 *      `baya`, `kseniya`, `xenia`, `eugene`). Sounds human rather than robotic. The default
 *      `eugene` is the OWNER'S OWN choice, made by blind listening to five samples on one material
 *      in the sibling project — not ours to re-decide.
 *   2. **SAPI** (Windows) — the fallback when the KLAS tract is not on the machine. Probed
 *      2026-08-01: `Microsoft Irina Desktop` (ru), Zira, David are installed here.
 *
 * 🔴 BORROWED, NOT COPIED. The 145 MB model, the torch venv and the whole tract stay in KLAS: a copy
 * would mean two truths and two places to fix. KPOT calls the COMMAND and falls back honestly when
 * that disk is absent. Override the path with `KPOT_VOICE_TOOL`.
 *
 * ⚠️ Lessons ALREADY PAID FOR by KLAS — do not re-open them (`F:\KLAS\bugs\`): `06` text with no
 * letters or digits has nothing to pronounce (exit 2 is not a failure) · `08` cp1251 mojibake ·
 * `13` the tract silently swallowed digits until «56 → пятьдесят шесть» normalization appeared ·
 * `14` markup leaked into speech, which is why CLEAN text goes to the voice, with no markdown.
 * Reading a neighbour's bugs/ before writing a subsystem is the field report's own recommendation.
 */
const VOICE = opt('--voice', process.env.KPOT_VOICE || 'eugene');
const SAPI_VOICE = process.env.KPOT_SAPI_VOICE || 'Microsoft Irina Desktop';
const VOICE_TOOL = opt('--voice-tool', process.env.KPOT_VOICE_TOOL || 'F:\\KLAS\\tools\\voice-say.mjs');
const TIMEOUT_MIN = Number(opt('--timeout', '30'));

/**
 * Which project is asking. The owner runs several projects at once, and each of them can call him
 * with a page that looks the same by design — so the page must say WHOSE question this is before he
 * reads a word of it (his instruction, 2026-08-02, from a sibling project's contour: «я понимаю, по
 * какому проекту меня спрашивают, и сколько вопросов в этом интервью в каком статусе»).
 *
 * The name is KPOT's canonical spelling from `AGENT_GUIDE.md` §Project identity — not a new brand
 * decision, just the existing one used. A fork overrides it with `KPOT_PROJECT` instead of editing code.
 */
const PROJECT = process.env.KPOT_PROJECT || 'KPOT';

/** «02.08.2026, 00:20:15» — the moment this page was built, in the owner's locale. */
const stamp = () => new Date().toLocaleString('ru-RU');

// ─────────────────────────────────────────────────────────────────────────────
// THE PAGE
// ─────────────────────────────────────────────────────────────────────────────

const esc = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The page's style. BOTH OS themes are mandatory: field rake 6 — «dark-on-dark was caught by the
 * owner, not by the self-checks». Hence colours are variables overridden by a media query, never
 * eyeballed in one theme.
 */
const STYLE = `
:root{
	--bg:#f7f7f5; --card:#fff; --ink:#1a1a1a; --dim:#5b5b57; --line:#e2e2dd;
	--accent:#1a6fd4; --accent-ink:#fff; --ok:#1f7a3d; --warn:#b06000; --bad:#b3261e;
	--code-bg:#f0f0ec;
}
@media (prefers-color-scheme: dark){
	:root{
		--bg:#14161a; --card:#1b1e24; --ink:#e8e8e6; --dim:#a0a4ad; --line:#2c313a;
		--accent:#4d9bff; --accent-ink:#0b1220; --ok:#5fd08a; --warn:#e0a34a; --bad:#ff6b60;
		--code-bg:#232830;
	}
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
	font:16px/1.6 -apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:24px 18px 120px}
header.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);
	padding:14px 0;margin-bottom:18px}
h1{font-size:1.45rem;line-height:1.3;margin:0 0 6px}
h2{font-size:1.2rem;margin:1.6em 0 .5em}
h3{font-size:1.05rem;margin:1.4em 0 .4em}
h4{font-size:1rem;margin:1.2em 0 .4em}
p{margin:.6em 0}
a{color:var(--accent)}
code{background:var(--code-bg);padding:.1em .35em;border-radius:4px;font-size:.9em}
pre{background:var(--code-bg);padding:12px;border-radius:8px;overflow:auto}
pre code{background:none;padding:0}
blockquote{margin:.8em 0;padding:.1em 0 .1em 14px;border-left:3px solid var(--line);color:var(--dim)}
hr{border:0;border-top:1px solid var(--line);margin:1.6em 0}
.tw{overflow-x:auto}
table{border-collapse:collapse;width:100%;margin:.8em 0;font-size:.92em}
th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}
th{background:var(--code-bg)}
.meta{color:var(--dim);font-size:.86rem}
/* The question widget. The stripe on the left is the owner's own pick out of four mock-ups in the
   sibling project (V1 «Полоса слева», and it is coloured BY STATE). It does two jobs at once:
   separates one question from the next, and says whether it still waits — on a long interview that
   is the main thing the eye needs. */
.q{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--line);
	border-radius:4px 12px 12px 4px;padding:16px 18px;margin:20px 0}
.q.open{border-left-color:var(--warn)}
.q.done{opacity:.72;border-left-color:var(--ok)}
.qhead{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.tag{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:99px;
	border:1px solid var(--line);color:var(--dim)}
.tag.open{color:var(--warn);border-color:var(--warn)}
.tag.ok{color:var(--ok);border-color:var(--ok)}
/* The header block: WHO is asking, WHEN, and the state of the interview in two glanceable pills.
   The owner runs several projects that all call him with a page of this same design, so the page
   has to identify itself before he reads anything. The pills are FILLED, not outlined, because
   their job is to be read from across the room; a count of ZERO goes quiet instead — the eye then
   lands on the number that actually matters. Both themes carry them: the fill is a theme variable
   and the text is the card colour, so contrast holds when the OS flips. */
.asks{color:var(--dim);font-size:.85rem;margin-bottom:6px}
.asks b{color:var(--ink)}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 2px}
.pill{font-size:.8rem;font-weight:600;padding:3px 11px;border-radius:99px;border:1px solid transparent;
	white-space:nowrap}
.pill.wait{background:var(--warn);color:var(--card)}
.pill.done{background:var(--ok);color:var(--card)}
.pill.art{background:var(--accent);color:var(--accent-ink)}
.pill.zero{background:transparent;color:var(--dim);border-color:var(--line);font-weight:400}
.opts{display:flex;flex-direction:column;gap:8px;margin:12px 0}
.opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);
	border-radius:10px;cursor:pointer;background:transparent}
.opt:hover{border-color:var(--accent)}
.opt input{margin-top:4px}
.opt b{white-space:nowrap}
.opt.sel{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
textarea{width:100%;min-height:70px;padding:10px;border:1px solid var(--line);border-radius:10px;
	background:var(--bg);color:var(--ink);font:inherit;font-size:.95rem;resize:vertical}
label.f{display:block;margin:10px 0 4px;font-size:.85rem;color:var(--dim)}
.prev{background:var(--code-bg);border-radius:8px;padding:10px 12px;margin:.5em 0;font-size:.95em}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);
	padding:12px 18px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
button{font:inherit;padding:10px 18px;border-radius:10px;border:1px solid var(--line);
	background:var(--card);color:var(--ink);cursor:pointer}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
button.bad{color:var(--bad);border-color:var(--bad)}
button:disabled{opacity:.5;cursor:default}
.note{padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);
	margin:14px 0;font-size:.92rem}
.note.ok{border-color:var(--ok);color:var(--ok)}
.note.bad{border-color:var(--bad);color:var(--bad)}
.audio{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:.3em 0}
.audio audio{height:34px;max-width:100%}
.embed{margin:.8em 0;display:block}
.embed figcaption{color:var(--dim);font-size:.85rem;margin-bottom:6px;
	display:flex;gap:10px;align-items:center;flex-wrap:wrap}
/* The inline frame is compact ON PURPOSE: inside a question it is for a quick look, while a real
   choice among four mock-ups opens as its own screen (the owner's rule). */
.embed .frame{width:100%;height:440px;border:1px solid var(--line);
	border-radius:10px;background:var(--card);display:block}
.embed button.full{font-size:.8rem;padding:4px 10px}
.shot{margin:.6em 0;display:block}
.shot img{width:100%;height:auto;border:1px solid var(--line);border-radius:10px;display:block}
.shot figcaption{color:var(--dim);font-size:.82rem;margin-top:4px}
.q.whole{border-style:dashed}
.art{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:20px 0}
.art pre{max-height:420px}
.hash{font-family:ui-monospace,Consolas,monospace;font-size:.78rem;color:var(--dim);word-break:break-all}
@media (max-width:560px){ .wrap{padding:16px 12px 140px} h1{font-size:1.2rem} }
`;

/**
 * A link to a sound file becomes a player, and the file itself is EMBEDDED into the page.
 *
 * Why embed rather than link: the page must be self-contained and open offline (the rules), and a
 * `file://` link from a page served over http is blocked by the browser — the owner would see a
 * dead player and conclude the contour is broken.
 *
 * Why sound at all: there is a class of criteria the agent cannot measure — «красиво», «приятно»
 * (`AGENT_GUIDE` → the taste class). Whoever judges a sound needs the SOUND, not a description of it.
 */
/**
 * Resolves a link from a document to a real file.
 *
 * 🔴 BOTH HALVES OF THIS WERE FOUND BY THE LIVE PILOT, not by a fixture — the field report's rake 4
 * («fixtures do not catch live documents») reproduced exactly:
 *   · a path in a document is relative to THE DOCUMENT'S FOLDER, not to the project root. KPOT's
 *     interview #003 links its mock-up as `interview_003_designs.html`, which sits beside it in
 *     `interviews/` — resolving from the root found nothing and the embed silently degraded to
 *     «нет файла», i.e. the owner would have lost the mock-up with no error anywhere;
 *   · so the document's folder is tried FIRST, the project root second.
 */
const resolveAsset = (src, baseDir) => {
	const rel = decodeURIComponent(src);
	const beside = resolve(baseDir, rel);
	if (existsSync(beside)) return beside;
	const fromRoot = resolve(ROOT, rel);
	return existsSync(fromRoot) ? fromRoot : null;
};

/**
 * A link's visible label, with inline markup stripped.
 *
 * 🔴 THE SECOND HALF OF THE SAME LIVE DEFECT: the label of a real link is rarely plain text. KPOT
 * writes ``[`interview_003_designs.html`](interview_003_designs.html)``, which the renderer turns
 * into `<a …><code>…</code></a>` — and a pattern demanding a markup-free label matched nothing, so
 * the mock-up was never embedded and the page just quietly lacked it.
 */
const LINK = (extPattern) => new RegExp(`<a href="([^"]+\\.(${extPattern}))">((?:(?!</a>).)*)</a>`, 'g');
const plainLabel = (label) => label.replace(/<[^>]+>/g, '').trim();

function inlineAudio(html, baseDir) {
	return html.replace(LINK('wav|mp3|ogg'), (_, src, ext, rawLabel) => {
		const label = plainLabel(rawLabel);
		const p = resolveAsset(src, baseDir);
		if (!p) return `<span class="meta">нет файла: ${esc(src)}</span>`;
		const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : 'audio/wav';
		const b64 = readFileSync(p).toString('base64');
		return `<span class="audio">${esc(label)}<audio controls preload="metadata" src="data:${mime};base64,${b64}"></audio></span>`;
	});
}

/**
 * A link to an HTML file becomes a LIVE page inside the question — so a mock-up can be clicked
 * right there. KPOT already has one such artifact: `interviews/interview_003_designs.html`.
 *
 * Why `srcdoc` and not `src`: the review page must stay SELF-CONTAINED and open offline as one
 * file. A `src="interviews/…"` reference would need a file-serving server and would die in a
 * snapshot; `srcdoc` embeds the document whole, and the mock-up lives inside the question even with
 * no network.
 *
 * ⚠️ Exactly what is in the file gets embedded. A mock-up with external dependencies would fall
 * apart inside the frame — but by this project's canon mock-ups are self-contained.
 */
function inlineHtmlFrames(html, baseDir) {
	return html.replace(LINK('html'), (_, src, _ext, rawLabel) => {
		const label = plainLabel(rawLabel);
		const p = resolveAsset(src, baseDir);
		if (!p) return `<span class="meta">нет файла: ${esc(src)}</span>`;
		return `<figure class="embed">
			<figcaption><b>${esc(label)}</b>
				<button type="button" class="apart primary">Открыть отдельным экраном</button>
				<button type="button" class="full">Во весь экран</button>
				<span class="meta">ниже — быстрый просмотр</span></figcaption>
			<iframe class="frame" srcdoc="${esc(readFileSync(p, 'utf8'))}"></iframe>
		</figure>`;
	});
}

/**
 * A link to an image becomes the image itself, embedded in the page. Same argument as sound:
 * whoever judges a LOOK needs the look, not a description of it, and the page must open offline as
 * one file.
 */
function inlineImages(html, baseDir) {
	return html.replace(LINK('png|jpe?g|webp|svg'), (_, src, ext, rawLabel) => {
		const label = plainLabel(rawLabel);
		const p = resolveAsset(src, baseDir);
		if (!p) return `<span class="meta">нет файла: ${esc(src)}</span>`;
		const mime =
			ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';
		const b64 = readFileSync(p).toString('base64');
		return `<figure class="shot"><img src="data:${mime};base64,${b64}" alt="${esc(label)}" loading="lazy"><figcaption>${esc(label)}</figcaption></figure>`;
	});
}

/** One interview question's card: body + options + input fields. */
function questionCard(q, bodyMd) {
	const opts = q.options
		.map(
			(o) => `
			<label class="opt" data-l="${esc(o.letter)}">
				<input type="radio" name="ch-${esc(q.label)}" value="${esc(o.letter)}">
				<span><b>${esc(o.letter)})</b> ${inline(o.label)}</span>
			</label>`,
		)
		.join('');

	const existing = q.answered
		? `<div class="prev"><b>Уже отвечено:</b><br>${mdToHtml(q.answer)}</div>`
		: '';

	return `
	<section class="q ${q.answered ? 'done' : 'open'}" data-q="${esc(q.label)}">
		<div class="qhead">
			<span class="tag ${q.answered ? 'ok' : 'open'}">${q.answered ? 'отвечено' : 'ждёт вас'}</span>
			<h3 style="margin:0">${esc(q.title)}</h3>
		</div>
		${mdToHtml(bodyMd)}
		${existing}
		${opts ? `<div class="opts">${opts}</div>` : ''}
		<label class="f">${q.answered ? 'Уточнение (старый ответ останется дословно)' : 'Ответ своими словами'}</label>
		<textarea data-text="${esc(q.label)}" placeholder="можно только букву выше, можно только текст, можно оба"></textarea>
		<label class="f">Пометка для агента (необязательно)</label>
		<textarea data-comment="${esc(q.label)}" style="min-height:44px"></textarea>
	</section>`;
}

/** An outbound artifact's card: the full payload + the industrial four actions. */
function artifactCard(a, bodyText, hash) {
	return `
	<section class="art" data-art="${esc(a.id)}" data-hash="${esc(hash)}">
		<div class="qhead">
			<span class="tag open">на одобрение</span>
			<h3 style="margin:0">${esc(a.id)} → ${esc(a.target || 'адресат не указан')}</h3>
		</div>
		<p class="meta">Файл тела: <code>${esc(a.body_file)}</code> · формат: ${esc(a.format || 'text')}</p>
		<p class="meta">Уйдёт ровно это, байт в байт:</p>
		<pre><code>${esc(bodyText)}</code></pre>
		<p class="hash">SHA-256 тела: ${esc(hash)}</p>
		<div class="opts">
			<label class="opt"><input type="radio" name="st-${esc(a.id)}" value="approved"><span><b>Одобрить</b> — отправлять как есть</span></label>
			<label class="opt"><input type="radio" name="st-${esc(a.id)}" value="rejected"><span><b>Отклонить</b> — с причиной ниже</span></label>
			<label class="opt"><input type="radio" name="st-${esc(a.id)}" value="edit"><span><b>Поправить</b> — что именно, ниже</span></label>
			<label class="opt"><input type="radio" name="st-${esc(a.id)}" value="reply"><span><b>Ответить</b> — вопрос агенту, решения пока нет</span></label>
		</div>
		<label class="f">Причина / правка / вопрос</label>
		<textarea data-text="${esc(a.id)}"></textarea>
	</section>`;
}

/**
 * Assembles a document's page.
 * @param live — a live page (answerable) or a snapshot to a file (read-only).
 */
export function buildPage({ docPath, live }) {
	const relPath = relative(ROOT, docPath).split('\\').join('/');
	const text = readMd(docPath);
	const meta = parseMeta(text);
	const parsed = parseInterview(docPath, text);
	const lines = parsed.lines;

	// Segments in source order: question cards and everything between them — nothing is lost.
	const chunks = [];
	let cursor = 0;
	for (const q of parsed.questions) {
		if (q.startLine > cursor) chunks.push(mdToHtml(lines.slice(cursor, q.startLine).join('\n')));
		const bodyEnd = q.answerLine >= 0 ? q.answerLine : q.endLine;
		chunks.push(questionCard(q, lines.slice(q.startLine + 1, bodyEnd).join('\n')));
		cursor = q.endLine;
	}
	if (cursor < lines.length) chunks.push(mdToHtml(lines.slice(cursor).join('\n')));

	// Outbound artifacts (send drafts): the body is taken BY REFERENCE to a file, never pasted —
	// the page shows exactly the bytes that will leave, and the hash is computed over them (I3).
	const arts = [];
	for (const a of meta.artifacts) {
		const p = resolve(ROOT, a.body_file || '');
		if (!a.body_file || !existsSync(p)) {
			arts.push(
				`<section class="art"><div class="note bad">Артефакт <b>${esc(a.id)}</b>: файл тела
				<code>${esc(a.body_file || '—')}</code> не найден. Одобрять нечего.</div></section>`,
			);
			continue;
		}
		arts.push(artifactCard(a, readFileSync(p, 'utf8'), bodyHash(p)));
	}

	const open = parsed.questions.filter((q) => !q.answered).length;
	const answered = parsed.questions.length - open;

	const page = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<style>${STYLE}</style></head>
<body data-doc="${esc(relPath)}" data-kind="${esc(meta.kind)}">
<div class="wrap">
	<header class="top">
		<div class="asks">Спрашивает ИИ-агент <b>${esc(PROJECT)}</b> · ${esc(stamp())}</div>
		<h1>${esc(meta.title)}</h1>
		<div class="pills">
			<span class="pill ${open ? 'wait' : 'zero'}">ждут вас: ${open}</span>
			<span class="pill ${answered ? 'done' : 'zero'}">отвечено: ${answered}</span>
			${meta.artifacts.length ? `<span class="pill art">на одобрение: ${meta.artifacts.length}</span>` : ''}
		</div>
		<div class="meta">${esc(relPath)}</div>
		${parsed.statusRaw ? `<div class="meta">${mdToHtml(parsed.statusRaw)}</div>` : ''}
	</header>

	${live ? '' : '<div class="note">Это СНИМОК страницы в файл. Отвечать можно на живой: <code>node tools/review.mjs open ' + esc(relPath) + '</code></div>'}

	${arts.join('\n')}
	${chunks.join('\n')}

	${
		live
			? `<section class="q whole">
		<div class="qhead"><span class="tag">по документу целиком</span></div>
		<label class="f">Общий комментарий — то, что относится ко всему документу, а не к одному вопросу</label>
		<textarea id="docComment" placeholder="необязательно"></textarea>
	</section>`
			: ''
	}
</div>

${
	live
		? `<div class="bar">
	<button class="primary" id="save">Сохранить ответы</button>
	<span class="meta" id="status"></span>
</div>`
		: ''
}

<script>
// Choosing an option. The page's only real logic — everything else is assembled by the server.
//
// 🔑 A SECOND CLICK ON THE SELECTED ITEM CLEARS IT (the owner's ruling). A native radio cannot do
// this: once chosen, «none of them» can never be returned to — and in an interview that is needed
// constantly, because a question gets half-answered and put aside. Partial answers are legitimate.
// Mechanics: the state is remembered on mousedown (BEFORE the browser applies activation) and
// cleared on the click of the FIELD ITSELF — by then the browser has already done its activation,
// so our clearing is not overwritten. Events whose target is the label are skipped: a click on the
// text spawns a SECOND, synthetic event on the field, and handling both would clear the choice
// twice, i.e. never.
// WARNING: this whole script lives inside a TEMPLATE STRING. A backtick here would terminate the
// page and take the module down with a syntax error. In these comments quotes are guillemets only.
let wasChecked = false;
const paint = (box) => {
	for (const l of box.querySelectorAll('.opt'))
		l.classList.toggle('sel', !!l.querySelector('input[type=radio]')?.checked);
};
document.addEventListener('mousedown', (e) => {
	wasChecked = !!e.target.closest?.('.opt')?.querySelector('input[type=radio]')?.checked;
});
document.addEventListener('keydown', () => { wasChecked = false; });
document.addEventListener('click', (e) => {
	const radio = e.target.closest?.('.opt')?.querySelector('input[type=radio]');
	if (!radio || e.target !== radio) return;
	if (wasChecked) radio.checked = false;
	wasChecked = false;
	paint(radio.closest('.opts'));
});
document.addEventListener('change', (e) => {
	if (e.target.type === 'radio') paint(e.target.closest('.opts'));
});

// A live mock-up inside a question. The owner's rule: a choice among four mock-ups is viewed as its
// OWN SCREEN, while the inline frame is for a quick look at smaller decisions. Hence a compact
// frame with two doors out of it — a separate window and full screen.
document.addEventListener('click', (e) => {
	const frame = e.target.closest?.('.embed')?.querySelector('.frame');
	if (!frame) return;
	if (e.target.classList.contains('full') && frame.requestFullscreen) frame.requestFullscreen();
	if (e.target.classList.contains('apart')) {
		// The window is opened by a SCRIPT — so the mock-up gets a full screen and closes like a
		// normal window. The content comes from the frame itself: no second copy of the document.
		const blob = new Blob([frame.getAttribute('srcdoc')], { type: 'text/html;charset=utf-8' });
		window.open(URL.createObjectURL(blob), '_blank', 'noopener');
	}
});

const saveBtn = document.getElementById('save');
if (saveBtn) saveBtn.addEventListener('click', async () => {
	const answers = {};
	for (const sec of document.querySelectorAll('[data-q]')) {
		const label = sec.dataset.q;
		const choice = sec.querySelector('input[type=radio]:checked')?.value || '';
		const text = sec.querySelector('[data-text]')?.value.trim() || '';
		const comment = sec.querySelector('[data-comment]')?.value.trim() || '';
		if (choice || text) answers[label] = { choice, text, comment };
	}
	const artifacts = {};
	for (const sec of document.querySelectorAll('[data-art]')) {
		const id = sec.dataset.art;
		const status = sec.querySelector('input[type=radio]:checked')?.value || '';
		const text = sec.querySelector('[data-text]')?.value.trim() || '';
		// The hash that travels is THE ONE THE PAGE SHOWED. The server re-checks it against the file:
		// if the text changed while the owner was reading, there is nothing to approve — he saw
		// something else (I3).
		if (status) artifacts[id] = { status, comment: text, sha256: sec.dataset.hash };
	}
	// The whole-document comment. It is SUFFICIENT ON ITS OWN to save: «no answers, but I have
	// something to say» is a legitimate outcome of a review.
	const comment = document.getElementById('docComment')?.value.trim() || '';
	if (!Object.keys(answers).length && !Object.keys(artifacts).length && !comment) {
		document.getElementById('status').textContent = 'Ничего не отмечено — нечего сохранять.';
		return;
	}
	saveBtn.disabled = true;
	document.getElementById('status').textContent = 'Записываю…';
	// There is no «who is answering» field on this page: on a one-owner project asking his name
	// every time is friction with no payoff. The «by» field itself did not go anywhere — the server
	// stamps it (--by, defaulting to the owner), because a decision archive without a «who» is
	// unreadable months later (I2). The QUESTION was removed, not the RECORD.
	const res = await fetch('/decision', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		// Which document is being answered is stated by the page itself: one server serves the batch.
		body: JSON.stringify({ doc: document.body.dataset.doc, answers, artifacts, comment }),
	});
	const out = await res.json();
	if (out.ok) {
		document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
			'<div class="note ok"><b>Записано.</b> Ответ лёг в три места: сам документ, файл решения и архив. ' +
			'Вкладка закроется сама.</div>');
		document.getElementById('status').textContent = 'готово, закрываю…';
		window.scrollTo({ top: 0, behavior: 'smooth' });
		// Auto-close after 2 seconds (the owner's ruling: the page is no longer needed open).
		// ⚠️ A browser permits window.close() only for a window a SCRIPT opened, and ours was opened
		// by the operating system. So closing is an ATTEMPT, not a promise: if the browser refuses,
		// the page honestly turns into a short «done» instead of pretending to have closed.
		setTimeout(() => {
			window.close();
			setTimeout(() => {
				document.body.innerHTML =
					'<div class="wrap"><div class="note ok"><b>Записано.</b> ' +
					'Браузер не дал закрыть вкладку сам — закройте её, пожалуйста.</div></div>';
			}, 400);
		}, 2000);
	} else {
		document.getElementById('status').textContent = 'ОШИБКА: ' + (out.error || 'неизвестно');
		saveBtn.disabled = false;
	}
});
</script>
</body></html>`;

	// Order matters: HTML frames first — otherwise a link to a mock-up would already have become an
	// image. `baseDir` is the DOCUMENT'S folder: that is what its relative links are relative to.
	const baseDir = dirname(docPath);
	return inlineImages(inlineAudio(inlineHtmlFrames(page, baseDir), baseDir), baseDir);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SIGNAL (I5, I6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the owner. Invoked ONLY after the page is successfully up (I5) — otherwise you get the
 * class «summoned, nothing to show».
 *
 * 🔴 Rake 3 of the rules: `exit 0` ≠ the human heard it. Windows system notifications are muted by
 * focus settings SILENTLY and with a successful return code. So the signal goes through the sound
 * card (`[console]::beep`) and the voice, and delivery is confirmed BY THE HUMAN, not by an exit
 * code — the tool prints exactly that.
 *
 * The three beeps 880 / 660 / 990 Hz are the FIXED signal of this contour, carried over from the
 * sibling project unchanged. Fixing them is the point: the same tool in different projects must
 * sound the same, so the owner recognizes it without looking.
 *
 * ⚠️ The text travels as a FILE, not as a command-line argument: Cyrillic in a PowerShell 5.1
 * argument arrives as garbage (EXP-0027, `AGENT_GUIDE` §Document & text hygiene). The command
 * itself is ASCII only.
 */
export async function signal(say, { voice = VOICE, quiet = null } = {}) {
	const now = new Date();
	if (quiet ?? isQuiet(now)) {
		console.log('🔇 Тихие часы (23:00–09:00) — сигнал подавлен. Страница ждёт владельца молча.');
		return { signalled: false, reason: 'тихие часы' };
	}
	if (process.platform !== 'win32') {
		console.log('🔔 (сигнал звуком реализован для Windows; здесь — только текстом)');
		return { signalled: false, reason: 'не Windows' };
	}

	// Markup never reaches the voice (KLAS bugs/14): clean text is what gets pronounced.
	const clean = String(say).replace(/[*_`#>\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();

	// The short sound comes first and always: it does not depend on the OS notification settings
	// that mute system toasts SILENTLY and with a successful return code (rake 3).
	spawnSync(
		'powershell',
		['-NoProfile', '-NonInteractive', '-Command', '[console]::beep(880,160); [console]::beep(660,160); [console]::beep(990,260);'],
		{ stdio: 'ignore', timeout: 8000 },
	);

	const engine = await speak(clean, voice);

	console.log(`🔔 Сигнал подан (звук + голос: ${engine}).`);
	console.log(
		'   ⚠️ Код возврата этого НЕ доказывает: уведомления и звук глушатся настройками ОС молча.\n' +
			'   Доставка считается подтверждённой только словом человека.',
	);
	return { signalled: true, engine };
}

/** Speaks the text: Silero from KLAS first, SAPI on failure. Returns the tract's name. */
async function speak(text, voice) {
	if (existsSync(VOICE_TOOL)) {
		const ok = await new Promise((done) => {
			const p = spawn(process.execPath, [VOICE_TOOL, text, '--play', '--voice', voice], {
				stdio: 'ignore',
				windowsHide: true,
			});
			// Exit code 2 from the KLAS tract means «nothing to pronounce» — not a failure (their bugs/06).
			p.on('exit', (code) => done(code === 0));
			p.on('error', () => done(false));
			setTimeout(() => done(false), 120_000).unref?.();
		});
		if (ok) return `Silero/${voice}`;
		console.log('   (тракт KLAS не ответил — говорю системным голосом)');
	}

	// The fallback. The text travels as a FILE, the command is ASCII only: Cyrillic in a
	// PowerShell 5.1 argument is corrupted by the console codepage before the program ever sees it
	// (EXP-0027; the same class as KLAS bugs/08).
	const sayFile = join(tmpdir(), `kpot-review-say-${process.pid}.txt`);
	writeFileSync(sayFile, text, 'utf8');
	const ps = [
		'try {',
		'  Add-Type -AssemblyName System.Speech;',
		'  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
		`  try { $s.SelectVoice("${SAPI_VOICE.replace(/"/g, '')}") } catch {};`,
		`  $t = [IO.File]::ReadAllText("${sayFile.replace(/\\/g, '\\\\')}", [Text.Encoding]::UTF8);`,
		'  $s.Speak($t);',
		'} catch { }',
	].join(' ');
	spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
		stdio: 'ignore',
		timeout: 60_000,
	});
	return `SAPI/${SAPI_VOICE}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the page in a browser — as an APP WINDOW (`--app=`) when possible.
 *
 * Why exactly this (the owner's ruling: the page must close itself 2 seconds after an answer): a
 * browser permits `window.close()` only for a window IT opened. An ordinary tab launched via
 * `start` cannot be closed by a script, and promising auto-close would be a lie. `--app` gives a
 * separate window with no tabs and no address bar, and closing works there.
 *
 * Search order: Edge (the owner checks layout in it) → Chrome → the default browser as a plain tab.
 * The fallback is honest: with no browser found the page still opens, the tab just has to be closed
 * by hand — and the page says so itself. Both Edge and Chrome were probed present on this machine
 * on 2026-08-01.
 */
function openBrowser(url) {
	const candidates = [
		'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
		'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
	];
	const exe = candidates.find((p) => existsSync(p));
	if (exe) {
		spawn(exe, [`--app=${url}`, '--window-size=1100,900'], { detached: true, stdio: 'ignore' }).unref();
		return 'окно-приложение';
	}
	spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
	return 'вкладка браузера по умолчанию';
}

/**
 * Raises the contour's server.
 *
 * ONE server serves both a SINGLE document (`open`) and a BATCH (`batch`): the owner must not have
 * to type commands to get from the list of accumulated work to the question itself — a batch card
 * has to be a LINK, not an instruction. A separate server per document would reintroduce exactly
 * the vice the contour was built to remove.
 *
 * @param index — the function drawing the root page (for a batch), or null (then the root is the
 *                document itself)
 */
function startServer({ docPath = null, index = null, onDecision = null }) {
	const server = createServer((req, res) => {
		const url = new URL(req.url, 'http://127.0.0.1');

		if (req.method === 'GET' && url.pathname === '/') {
			res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			// The page is always rebuilt: the document may have changed while the owner was reading.
			return res.end(index ? index() : buildPage({ docPath, live: true }));
		}
		if (req.method === 'GET' && url.pathname === '/doc') {
			const p = resolve(ROOT, url.searchParams.get('p') ?? '');
			if (!p.startsWith(ROOT) || !existsSync(p)) {
				res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
				return res.end('нет такого документа');
			}
			res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			return res.end(buildPage({ docPath: p, live: true }));
		}
		if (req.method === 'POST' && url.pathname === '/decision') {
			let body = '';
			req.on('data', (c) => (body += c));
			req.on('end', () => {
				try {
					const got = JSON.parse(body);
					const at = new Date().toISOString();
					// Which document is being answered is stated by THE PAGE ITSELF (`<body data-doc>`):
					// one server serves both a single document and a whole batch.
					const target = got.doc ? resolve(ROOT, got.doc) : docPath;
					if (!target || !target.startsWith(ROOT) || !existsSync(target))
						throw new Error('документ не найден');

					// I3 — approval is bound to the body's bytes. Re-check the hash the page showed
					// against the file RIGHT NOW: if the text changed meanwhile, the owner approved
					// something other than what would be sent.
					for (const [id, rec] of Object.entries(got.artifacts || {})) {
						const art = artifactsOf(target).find((a) => a.id === id);
						if (!art?.absolute || !existsSync(art.absolute))
							throw new Error(`тело артефакта «${id}» пропало`);
						const now = bodyHash(art.absolute);
						if (rec.sha256 !== now)
							throw new Error(
								`текст артефакта «${id}» изменился, пока страница была открыта — ` +
									'перезагрузите её и посмотрите новую редакцию',
							);
					}
					const paths = writeDecision({
						docPath: target,
						kind: parseMeta(readMd(target)).kind,
						by: (got.by || BY).trim() || BY,
						at,
						comment: got.comment,
						answers: got.answers || {},
						artifacts: got.artifacts || {},
					});
					res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
					res.end(JSON.stringify({ ok: true, paths }));
					console.log('\n✅ РЕШЕНИЕ ЗАПИСАНО В ТРИ МЕСТА:');
					console.log('   документ: ' + relative(ROOT, paths.md ?? target));
					console.log('   решение:  ' + relative(ROOT, paths.decision));
					console.log('   архив:    ' + relative(ROOT, paths.archive));
					if (onDecision) onDecision(target, server);
				} catch (e) {
					res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
					res.end(JSON.stringify({ ok: false, error: String(e.message) }));
				}
			});
			return;
		}
		res.writeHead(404).end('нет');
	});
	return server;
}

/** Raises the server on a free port and returns the address. */
async function listen(server) {
	const port = Number(opt('--port', '0'));
	await new Promise((r) => server.listen(port, '127.0.0.1', r));
	return `http://127.0.0.1:${server.address().port}/`;
}

/** Opens ONE document: the page, the browser, the signal, then waits for the answer. */
async function cmdOpen(docPath) {
	const server = startServer({
		docPath,
		// I8 — SAVING WAKES THE WAITING AGENT. A single document's server lives exactly until the
		// decision is recorded: up → recorded → dead. See cmdBatch for why this is an invariant and
		// not a convenience.
		onDecision: (_, srv) => setTimeout(() => srv.close(() => process.exit(0)), 2500),
	});
	const url = await listen(server);

	const parsed = parseInterview(docPath, readMd(docPath));
	const open = parsed.questions.filter((q) => !q.answered).length;
	console.log(`\nСтраница поднята: ${url}`);
	console.log(`Документ: ${relative(ROOT, docPath)} · ждут ответа: ${open}`);

	if (!flag('--no-open')) openBrowser(url);

	// I5 — the signal comes AFTER the page is up and opened. Not earlier.
	// Deliberately WITHOUT await: speech synthesis takes seconds while the server is already
	// listening, and waiting for it would hold the browser's first request in a queue and show the
	// owner a blank window.
	if (!flag('--no-signal')) {
		const { kind, title } = scopeOf(docPath, parseMeta(readMd(docPath)));
		void signal(
			`${ADDRESS}, вас зовёт ${kind}${title ? `: ${title}` : ''}. ` +
				`${open} ${plural(open, 'вопрос', 'вопроса', 'вопросов')} без ответа.`,
		);
	}

	console.log(`\nЖду ответа (до ${TIMEOUT_MIN} мин). Ctrl+C — прекратить, документ не изменится.`);
	setTimeout(
		() => {
			console.log('\n⏳ Время вышло — страница закрыта, ответов не записано.');
			server.close(() => process.exit(2));
		},
		TIMEOUT_MIN * 60_000,
	).unref?.();
	return url;
}

/**
 * What the voice actually says: the KIND of document and its title — «вас зовёт интервью: …».
 * The kind comes from the metadata block when there is one, otherwise from the document's
 * DIRECTORY, which on this project IS the scope (`bugs/` — a bug, `plans/` — a plan,
 * `researches/` — research). The service prefix «Интервью №003 — » is stripped from the title: the
 * kind has already been said as a word, and repeating it only lengthens the speech.
 */
export function scopeOf(docPath, meta) {
	const rel = relative(ROOT, docPath).split('\\').join('/');
	const byDir = rel.startsWith('interviews/')
		? 'интервью'
		: rel.startsWith('bugs/')
			? 'баг'
			: rel.startsWith('plans/')
				? 'план'
				: rel.startsWith('ideas/')
					? 'идея'
					: rel.startsWith('researches/')
						? 'исследование'
						: rel.startsWith('homeworks/')
							? 'домашка'
							: 'документ';
	const kind = meta?.kind === 'outbound' ? 'черновик отправки' : byDir;
	let title = String(meta?.title ?? '').replace(/^[^—:]{0,40}[—:]\s*/u, '').trim();
	if (title.length > 90) title = title.split(/[.:—]/u)[0].trim();
	return { kind, title };
}

/** Path comparison ignoring case and slashes — Windows hands them over inconsistently. */
const samePath = (a, b) => resolve(a).toLowerCase() === resolve(b ?? '').toLowerCase();

const plural = (n, a, b, c) => {
	const m10 = n % 10;
	const m100 = n % 100;
	if (m10 === 1 && m100 !== 11) return a;
	if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
	return c;
};

/** Snapshots the page to a file — self-contained and openable offline. */
function cmdRender(docPath) {
	const outDir = join(ROOT, 'test-results', 'owner-reviews');
	mkdirSync(outDir, { recursive: true });
	const out = opt('--out', join(outDir, basename(docPath).replace(/\.md$/, '.html')));
	writeFileSync(out, buildPage({ docPath, live: false }), 'utf8');
	console.log(relative(ROOT, out));
	return out;
}

/** Every interview waiting for the owner. This is the ritual's EXECUTABLE command, not decoration. */
function cmdList() {
	const dir = join(ROOT, 'interviews');
	const files = readdirSyncSafe(dir)
		.filter((f) => f.startsWith('interview_') && f.endsWith('.md'))
		.sort();
	let waiting = 0;
	console.log('ИНТЕРВЬЮ, ЖДУЩИЕ ВЛАДЕЛЬЦА\n');
	for (const f of files) {
		const p = join(dir, f);
		const iv = parseInterview(p, readMd(p));
		if (!iv.waiting) continue;
		waiting++;
		const open = iv.questions.filter((q) => !q.answered);
		console.log(`  🟡 interviews/${f}`);
		console.log(`     ${iv.status}`);
		for (const q of open) console.log(`     ⛔ ${q.title}`);
		console.log(`     открыть: node tools/review.mjs open interviews/${f}\n`);
	}
	if (!waiting) console.log('  ✅ ни одного — очередь владельца пуста.');
	return waiting;
}

function readdirSyncSafe(d) {
	try {
		return readdirSync(d);
	} catch {
		return [];
	}
}

/**
 * Parks a document in the queue (I7). An autonomous loop NEVER stands at an open page: it parks the
 * document and moves to the next unblocked work, and the owner is called once per batch.
 *
 * The queue is a STATE FILE. Live documents are deliberately NOT moved into a `pending/` folder —
 * that would break every reference to them from STATUS and the plans, and the invariant «loops
 * accumulate rather than block» is satisfied without it (field report §12).
 */
function cmdQueue(docPath) {
	mkdirSync(DECISIONS_DIR, { recursive: true });
	const rel = relative(ROOT, docPath).split('\\').join('/');
	const q = existsSync(QUEUE_FILE) ? JSON.parse(readFileSync(QUEUE_FILE, 'utf8')) : { items: [] };
	if (!q.items.some((i) => i.doc === rel)) {
		q.items.push({ doc: rel, queuedAt: new Date().toISOString() });
		writeFileSync(QUEUE_FILE, JSON.stringify(q, null, '\t') + '\n', 'utf8');
		console.log(`В очередь: ${rel} (всего накоплено: ${q.items.length})`);
	} else {
		console.log(`Уже в очереди: ${rel} (всего накоплено: ${q.items.length})`);
	}
	return q.items.length;
}

/** One «накопилось N» page — a card per document, the signal ONCE per batch (I7). */
async function cmdBatch() {
	const q = existsSync(QUEUE_FILE) ? JSON.parse(readFileSync(QUEUE_FILE, 'utf8')) : { items: [] };
	// Anything the owner has already answered drops out of the queue — otherwise the batch grows forever.
	const live = q.items.filter((i) => {
		const p = join(ROOT, i.doc);
		if (!existsSync(p)) return false;
		return parseInterview(p, readMd(p)).waiting;
	});
	if (!live.length) {
		console.log('Очередь пуста — звать владельца незачем.');
		return 0;
	}

	/**
	 * The batch page. 🔑 A card is a LINK, not an instruction: the owner must not type a command to
	 * get from the list to the question. The first edition of the sibling contour printed
	 * `node tools/review.mjs open …` on the card — the very «I will tell you instead of doing it»
	 * vice the contour exists to remove.
	 */
	const batchPage = () => {
		const cards = live
			.map((i) => {
				const p = join(ROOT, i.doc);
				const iv = parseInterview(p, readMd(p));
				const open = iv.questions.filter((x) => !x.answered);
				const { kind } = scopeOf(p, parseMeta(readMd(p)));
				return `<a class="q card-link" href="/doc?p=${encodeURIComponent(i.doc)}">
				<div class="qhead"><span class="tag ${open.length ? 'open' : 'ok'}">${open.length ? 'ждёт вас' : 'отвечено'}</span>
				<h3 style="margin:0">${esc(parseMeta(readMd(p)).title)}</h3></div>
				<p class="meta">${esc(kind)} · ${esc(i.doc)} · без ответа: ${open.length} из ${iv.questions.length}
					· в очереди с ${esc(String(i.queuedAt ?? '').slice(0, 10))}</p>
				${open.length ? '<ul>' + open.map((x) => `<li>${esc(x.title)}</li>`).join('') + '</ul>' : ''}
			</a>`;
			})
			.join('\n');

		// Batch-wide counts, so the pills mean the same thing here as on a single document.
		let openAll = 0;
		let answeredAll = 0;
		for (const i of live) {
			const iv = parseInterview(join(ROOT, i.doc), readMd(join(ROOT, i.doc)));
			const o = iv.questions.filter((x) => !x.answered).length;
			openAll += o;
			answeredAll += iv.questions.length - o;
		}

		return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Накопилось: ${live.length}</title><style>${STYLE}
a.card-link{display:block;text-decoration:none;color:inherit}
a.card-link:hover{border-color:var(--accent)}
</style></head><body><div class="wrap">
<header class="top">
<div class="asks">Спрашивает ИИ-агент <b>${esc(PROJECT)}</b> · ${esc(stamp())}</div>
<h1>Накопилось ${live.length} ${plural(live.length, 'документ', 'документа', 'документов')}</h1>
<div class="pills">
	<span class="pill ${openAll ? 'wait' : 'zero'}">ждут вас: ${openAll}</span>
	<span class="pill ${answeredAll ? 'done' : 'zero'}">отвечено: ${answeredAll}</span>
</div>
<div class="meta">Пока вы были заняты, агент работал и складывал сюда всё, что решать не вправе.
Нажмите карточку — откроется сам документ.</div>
</header>${cards}</div></body></html>`;
	};

	// `--no-serve` — snapshot the batch to a file and exit. Not decoration: without it the command
	// NEVER terminates (the server lives out its timeout), and anyone calling it synchronously —
	// first of all this project's own checks — hangs forever. That is exactly what happened to the
	// sibling contour's QA run: four orphaned processes holding ports.
	if (flag('--no-serve')) {
		const outDir = join(ROOT, 'test-results', 'owner-reviews');
		mkdirSync(outDir, { recursive: true });
		const out = join(outDir, 'batch.html');
		writeFileSync(out, batchPage(), 'utf8');
		console.log(`Пачка собрана в файл: ${relative(ROOT, out)} (${live.length})`);
		return 0;
	}

	/**
	 * 🔑 I8 — «SAVING WAKES THE WAITING AGENT». The owner's words in the sibling project, verbatim:
	 * «если я дал ответы, нажал сохранить — оно должно дёргать тебя».
	 *
	 * How this works technically: an agent learns of an event when a process IT STARTED terminates.
	 * So the contour MUST terminate immediately after recording a decision — otherwise the answer
	 * lies recorded and nobody comes for it (exactly what happened there: the batch held its server
	 * for three hours).
	 *
	 * Hence the rule, identical for a single document and for a batch: ANY save closes the contour.
	 * If something is left unanswered in the queue, raising the page again is the AGENT'S duty, not
	 * the owner's to keep a tab open. This is the invariant the rules do not yet carry — the field
	 * report proposes it as I8, and it is implemented here from the start.
	 */
	const server = startServer({
		index: batchPage,
		onDecision: (target, srv) => {
			const rest = live.filter((i) => {
				const p = join(ROOT, i.doc);
				return existsSync(p) && !samePath(p, target) && parseInterview(p, readMd(p)).waiting;
			});
			console.log(
				rest.length
					? `\n📌 Осталось ждать владельца: ${rest.length} — подними пачку заново.`
					: '\n✅ Очередь пуста.',
			);
			setTimeout(() => srv.close(() => process.exit(0)), 2500);
		},
	});
	const url = await listen(server);
	console.log(`Пачка поднята: ${url} (${live.length})`);
	setTimeout(
		() => {
			console.log('\n⏳ Время вышло — страница пачки закрыта.');
			server.close(() => process.exit(0));
		},
		TIMEOUT_MIN * 60_000,
	).unref?.();

	if (!flag('--no-open')) openBrowser(url);
	// await is mandatory here: `batch` finishes immediately, and without waiting the process would
	// die before the synthesizer opened its mouth.
	if (!flag('--no-signal')) {
		// The batch also names WHAT it is made of: «два интервью и баг» is more useful than «три
		// документа» — the owner decides by that whether to come now or after what he is doing.
		const kinds = live.map((i) => scopeOf(join(ROOT, i.doc), parseMeta(readMd(join(ROOT, i.doc)))).kind);
		const uniq = [...new Set(kinds)].join(', ');
		await signal(
			`${ADDRESS}, накопилось ${live.length} ${plural(live.length, 'документ', 'документа', 'документов')} ` +
				`на вашу вычитку: ${uniq}.`,
		);
	}
	console.log(`\nЖду ответов (до ${TIMEOUT_MIN} мин). Ctrl+C — прекратить, документы не изменятся.`);
	// null means «the server is alive»: the process must not terminate, or the page dies with it.
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────

function usage() {
	console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?|^ \* ?/gm, ''));
}

async function main() {
	if (flag('--selftest')) {
		const fails = selftest();
		console.log(fails.length ? '🔴 ПРОВАЛЫ:\n  ' + fails.join('\n  ') : '✅ самотест ядра чист');
		return fails.length ? 1 : 0;
	}
	const [cmd, arg] = positional;
	const docPath = arg ? resolve(ROOT, arg) : null;
	if (docPath && !existsSync(docPath)) {
		console.error(`Нет такого документа: ${arg}`);
		return 1;
	}

	switch (cmd) {
		case 'open':
			if (!docPath) return usage(), 1;
			await cmdOpen(docPath);
			return null; // the server is alive; exit happens after the decision is recorded
		case 'render':
			if (!docPath) return usage(), 1;
			cmdRender(docPath);
			return 0;
		case 'list':
			cmdList();
			return 0;
		case 'queue':
			if (!docPath) return usage(), 1;
			cmdQueue(docPath);
			return 0;
		case 'batch':
			return await cmdBatch();
		default:
			usage();
			return 1;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	const code = await main();
	if (code !== null) process.exit(code);
}
