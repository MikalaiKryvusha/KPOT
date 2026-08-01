#!/usr/bin/env node
/**
 * review-gate.mjs — THE SEND-SIDE APPROVAL GATE, fail-closed (contour invariants I3 + I4).
 *
 * The single question this tool answers: **may this artifact leave the machine?** It refuses unless
 * the owner approved THIS artifact of THIS document AND the body's bytes still hash to what he
 * approved. Any doubt is a refusal — a request never approves itself by timeout.
 *
 * 🔴 THE GATE STANDS ON THE SEND SIDE. A gate the sender may skip is decoration: the check has to
 * live in the tool that actually performs the irreversible act, which is why `checkApproval()` is
 * exported from the contour's core and this CLI is only its thin face. One implementation for the
 * page, the gate and the sender — the rules' most expensive rake was two hash implementations
 * drifting apart with both self-tests green.
 *
 * ⚠️ HONEST SCOPE — READ THIS BEFORE TRUSTING THE GATE. **KPOT has no outbound-send routine today.**
 * It sends nothing on the owner's behalf: no messages, no tickets, no posts. So this gate is ARMED
 * BUT UNUSED, and the field report is blunt that a gate with no real consumer is decoration. It is
 * shipped anyway because the machinery is already written and tested inside the core, and because
 * the one genuinely irreversible external act this project does have — publishing a GitHub release
 * — is a natural first consumer. Wiring it into `/release` is a BACKLOG item, not something this
 * tool may claim. Until that happens, treat a green gate as «the mechanism works», never as
 * «something was sent safely».
 *
 * Usage:
 *   node tools/review-gate.mjs <document.md> <artifact-id>     exit 0 = may send, 1 = refused
 *   node tools/review-gate.mjs --selftest                      proves the gate can REFUSE
 *
 * [NOT-TESTED] — flipped by `--selftest` and by `tests/review_contour.test.mjs`.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { ROOT, checkApproval, textHash } from './lib/review-core.mjs';

/**
 * Proves the gate can FIRE. The project's rule (`AGENT_GUIDE`, EXP-0008): a guard that has never
 * been seen to refuse is a guard that might be incapable of refusing. Each case below is a distinct
 * refusal reason, plus one case that must PASS — without it "always refuses" would score green.
 */
export function selftestGate() {
	const fails = [];
	const ok = (name, cond) => {
		if (!cond) fails.push(name);
	};

	// The gate reads paths through the core's ROOT, so the fixture must live under a temp ROOT.
	// It is set by the spec runner / the wrapper below before this module's core is imported.
	const root = process.env.KPOT_REVIEW_ROOT;
	if (!root) return ['самотест гейта требует KPOT_REVIEW_ROOT (запускай через `node tools/review-gate.mjs --selftest`)'];

	mkdirSync(join(root, 'interviews', 'decisions'), { recursive: true });
	mkdirSync(join(root, 'drafts'), { recursive: true });
	const doc = join(root, 'interviews', 'interview_901_send.md');
	const body = join(root, 'drafts', 'a1.md');
	writeFileSync(body, 'тело, которое уйдёт\n', 'utf8');
	writeFileSync(
		doc,
		[
			'```yaml',
			'title: Черновик отправки',
			'kind: outbound',
			'artifacts:',
			'  - {id: a1, target: "GitHub · release notes", format: markdown, body_file: drafts/a1.md}',
			'```',
			'',
			'# Черновик отправки',
			'',
		].join('\n'),
		'utf8',
	);
	const decision = join(root, 'interviews', 'decisions', 'interview_901_send.decision.json');
	const write = (obj) => writeFileSync(decision, JSON.stringify(obj, null, '\t') + '\n', 'utf8');

	// 1. No decision at all — refuse.
	ok('гейт: без решения — отказ', checkApproval(doc, 'a1').ok === false);

	// 2. A decision that REJECTS — refuse.
	write({ artifacts: { a1: { status: 'rejected', sha256: textHash('тело, которое уйдёт\n') } } });
	ok('гейт: статус rejected — отказ', checkApproval(doc, 'a1').ok === false);

	// 3. Approved, hash matches — PASS. Without this case "always refuses" would look green.
	write({ by: 'Mikalai Kryvusha', at: '2026-08-01T00:00:00.000Z', artifacts: { a1: { status: 'approved', sha256: textHash('тело, которое уйдёт\n') } } });
	const pass = checkApproval(doc, 'a1');
	ok('гейт: одобрено и хеш сходится — ПРОПУСК', pass.ok === true);

	// 4. CRLF + BOM must NOT break a valid approval — that is what the normalization contract is for.
	writeFileSync(body, '﻿тело, которое уйдёт\r\n\r\n', 'utf8');
	ok('гейт: CRLF+BOM не ломают одобрение', checkApproval(doc, 'a1').ok === true);

	// 5. The text DRIFTED after approval — refuse. This is the whole point of binding to bytes.
	writeFileSync(body, 'подменённое тело\n', 'utf8');
	const drift = checkApproval(doc, 'a1');
	ok('гейт: дрейф текста аннулирует одобрение', drift.ok === false && /ИЗМЕНИЛСЯ/.test(drift.reason));

	// 6. An artifact that was never declared — refuse.
	ok('гейт: необъявленный артефакт — отказ', checkApproval(doc, 'a2').ok === false);

	return fails;
}

function main() {
	if (process.argv.includes('--selftest')) {
		// Run the self-test in a throw-away root, in a CHILD process: ROOT is frozen at import time,
		// so it cannot be repointed inside this one.
		if (!process.env.KPOT_REVIEW_ROOT) {
			const root = mkdtempSync(join(tmpdir(), 'kpot-gate-'));
			try {
				const r = spawnSelf(root);
				return r;
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		}
		const fails = selftestGate();
		console.log(fails.length ? '🔴 ПРОВАЛЫ ГЕЙТА:\n  ' + fails.join('\n  ') : '✅ самотест гейта чист (отказывает и пропускает там, где должен)');
		return fails.length ? 1 : 0;
	}

	const [doc, artifact] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
	if (!doc || !artifact) {
		console.error('Использование: node tools/review-gate.mjs <документ.md> <id-артефакта>');
		return 1;
	}
	const verdict = checkApproval(resolve(ROOT, doc), artifact);
	if (verdict.ok) {
		console.log(`✅ МОЖНО ОТПРАВЛЯТЬ: «${artifact}» одобрен (${verdict.by}, ${verdict.at})`);
		console.log(`   sha256 тела: ${verdict.sha256}`);
		return 0;
	}
	console.error(`⛔ ОТКАЗ: ${verdict.reason}`);
	if (verdict.approved) console.error(`   одобрен был: ${verdict.approved}\n   сейчас:      ${verdict.current}`);
	return 1;
}

/** Re-runs this file with a temp ROOT so the self-test never touches the live repository. */
function spawnSelf(root) {
	const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--selftest'], {
		env: { ...process.env, KPOT_REVIEW_ROOT: root },
		stdio: 'inherit',
	});
	return r.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	process.exit(main());
}
