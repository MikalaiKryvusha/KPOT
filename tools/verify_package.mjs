// tools/verify_package.mjs — does the built package actually work? (phase 6.5, plans/09 §5)
// [NOT-TESTED]
//
// The build script proves the package contains what we listed. This one proves the thing RUNS —
// unzipped into a folder that has never seen this project, driven only by the runtime inside it.
// Kept as a tool rather than a spec for one honest reason: it needs the 35 MB vendored Node
// archive, which is gitignored and must never enter the repository, so `npm test` cannot depend
// on it. It refuses loudly when the package is absent instead of passing vacuously.
//
// The check that matters most is (2): a packaged app that silently used the developer's INSTALLED
// Node would pass every other check here and fail on the first machine that has no Node — which is
// the only machine this package exists for.

import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

async function main() {
  const dist = join(ROOT, 'dist');
  let zip;
  try {
    zip = (await readdir(dist)).find((f) => f.endsWith('.zip'));
  } catch { /* no dist at all */ }
  if (!zip) {
    console.error('verify: no package found in dist/ — run `npm run package` first.');
    process.exit(1);
  }
  console.log(`package: ${zip}  (${((await stat(join(dist, zip))).size / 1024 / 1024).toFixed(1)} MB)\n`);

  // ── unzip somewhere that has never seen this project ─────────────────────────────────────────
  const clean = await mkdtemp(join(tmpdir(), 'kpot-pkg-'));
  await execFileP('tar.exe', ['-xf', join(dist, zip), '-C', clean]);
  const app = join(clean, zip.replace(/\.zip$/, ''));
  console.log('1. the package unzips into a clean folder');
  check((await stat(join(app, 'KPOT.cmd'))).size > 0, 'KPOT.cmd is there');
  check((await stat(join(app, 'ЧИТАТЬ.txt'))).size > 0, 'ЧИТАТЬ.txt survived the zip with its name intact');
  check((await stat(join(app, 'app', 'node.exe'))).size > 1e7, 'app/node.exe is there and is a real binary');

  // ── the whole point: it runs on ITS OWN runtime ──────────────────────────────────────────────
  console.log('\n2. it runs on the runtime inside the package, not the one installed on this machine');
  const node = join(app, 'app', 'node.exe');
  const { stdout: execPath } = await execFileP(node, ['-p', 'process.execPath']);
  check(execPath.trim().toLowerCase().startsWith(clean.toLowerCase()),
    `process.execPath is inside the unpacked package (${relative(clean, execPath.trim())})`);
  const { stdout: nodeVer } = await execFileP(node, ['-v']);
  check(nodeVer.trim() === 'v24.15.0', `bundled Node is ${nodeVer.trim()}`);

  const kpot = join(app, 'app', 'bin', 'kpot.mjs');
  const { stdout: ver } = await execFileP(node, [kpot, '--version']);
  check(/^\d+\.\d+\.\d+$/.test(ver.trim()), `kpot --version prints ${ver.trim()}`);

  // ── the real product, through the packaged runtime ───────────────────────────────────────────
  console.log('\n3. the packaged product does the actual job (fixture, not the owner\'s photographs)');
  const tree = await mkdtemp(join(tmpdir(), 'kpot-pkgrun-'));
  // The fixture generator is a dev file and is deliberately NOT in the package, so it is driven
  // from the repository — the thing under test is the packaged app, not how the tree was made.
  await execFileP(process.execPath, [join(ROOT, 'tests', 'fixtures', 'make.mjs'), tree]);

  const plan = await execFileP(node, [kpot, 'plan', tree], { maxBuffer: 64 * 1024 * 1024 });
  check(plan.stdout.includes('ПРЕД-СОРТИРОВОЧНЫЙ МАСТЕР-ПЛАН'), 'plan prints the owner-facing master plan');

  const applied = await execFileP(node, [kpot, 'apply', tree], { maxBuffer: 64 * 1024 * 1024 });
  const runId = (applied.stdout.match(/run-\d{8}-\d{6}-[0-9a-f]+/) ?? [])[0];
  check(Boolean(runId), `apply ran and named its run (${runId ?? 'NO RUN ID'})`);

  const again = await execFileP(node, [kpot, 'plan', tree, '--json'], { maxBuffer: 64 * 1024 * 1024 });
  const second = JSON.parse(again.stdout);
  check(second.operations.length === 0, 'a second plan has nothing to do — the sort is idempotent');
  check(second.emptied.length === 0, 'and announces no folder for deletion (bug 05 stays fixed)');

  if (runId) {
    const back = await execFileP(node, [kpot, 'rollback', runId, tree], { maxBuffer: 64 * 1024 * 1024 });
    check(/0 failed/.test(back.stderr), 'rollback put everything back with no failures');
  }

  // ── the launcher itself ──────────────────────────────────────────────────────────────────────
  console.log('\n4. KPOT.cmd starts the program (no browser is opened: see KPOT_NO_BROWSER below)');
  const launched = await runLauncher(join(app, 'KPOT.cmd'));
  check(launched.url !== null, `the launcher printed an address (${launched.url ?? 'none'})`);
  check(launched.hello === 'kpot', 'the server on that address identifies itself as KPOT');
  check(launched.shutdown, '«Завершить работу» stopped it — no server left running');

  // ── nothing came along for the ride ──────────────────────────────────────────────────────────
  console.log('\n5. the package carries nothing it should not, and everything it must');
  const all = await walk(app);
  // OUR development artifacts, hunted anywhere in the tree. The first version of this rule also
  // convicted `README.md` and `CONTRIBUTING.md` INSIDE the vendored dependencies — which are not
  // ours, are a few kilobytes, and are the normal contents of any node_modules. Narrowing the rule
  // to exclude that directory would weaken it on its own, so the exemption is paid for by the
  // requirement added below: every vendored dependency must still carry its LICENSE. exifreader is
  // MPL-2.0, which requires the notice to travel with the code — dropping it to make a tidy package
  // would be a licence violation dressed up as hygiene.
  const ours = (f) => !/(^|[\\/])node_modules[\\/]/.test(f);
  const strays = all.filter((f) => ours(f) && (
    /(^|[\\/])(tests?|\.kaif|\.claude|assets|researches|plans|bugs|ideas|interviews|\.git)[\\/]/i.test(f)
    || /\.(psd|png|jpg|jpeg|tgz|md)$/i.test(f)));
  check(strays.length === 0, `no development file of ours inside${strays.length ? ': ' + strays.slice(0, 8).join(', ') : ''}`);

  const mods = await readdir(join(app, 'app', 'node_modules'));
  check(mods.length === 2 && mods.includes('exifreader') && mods.includes('jpeg-js'),
    `exactly the two runtime dependencies (${mods.join(', ')})`);
  for (const m of mods) {
    const files = await readdir(join(app, 'app', 'node_modules', m));
    check(files.some((f) => /^licen[sc]e/i.test(f)), `${m} ships its licence notice`);
  }
  check(all.some((f) => /^LICENSE$/.test(f)), 'our own MIT licence is in the package root');

  await rm(clean, { recursive: true, force: true });
  await rm(tree, { recursive: true, force: true });

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

/**
 * Start the launcher, read the address it prints, ask the server who it is, then shut it down.
 *
 * `KPOT_NO_BROWSER` is passed through the environment rather than as a flag, so the LAUNCHER stays
 * byte-for-byte the file a person double-clicks — the thing under test must not be modified to make
 * itself testable. The first version of this check omitted it and opened a real browser window on
 * the owner's desktop, which then showed a connection error because the shutdown below had already
 * fired: an acceptance run that alarms the person it is run for is a defect in the acceptance run.
 */
async function runLauncher(cmdPath) {
  const child = spawn('cmd.exe', ['/c', cmdPath], {
    windowsHide: true,
    env: { ...process.env, KPOT_NO_BROWSER: '1' },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });

  const deadline = Date.now() + 30_000;
  let url = null;
  while (Date.now() < deadline && !url) {
    await new Promise((r) => setTimeout(r, 300));
    url = (out.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+/) ?? [])[0] ?? null;
  }
  if (!url) { try { child.kill(); } catch { /* already gone */ } return { url: null, hello: null, shutdown: false }; }

  const token = new URL(url).searchParams.get('token');
  const base = url.slice(0, url.indexOf('/?'));
  let hello = null;
  try {
    const r = await fetch(`${base}/api/hello?token=${token}`, { headers: { host: '127.0.0.1' } });
    hello = (await r.json())?.app ?? null;
  } catch { /* reported as a failed check */ }

  let shutdown = false;
  try {
    await fetch(`${base}/api/shutdown?token=${token}`, { method: 'POST', headers: { host: '127.0.0.1' } });
    await new Promise((r) => setTimeout(r, 1500));
    // A shut-down server refuses the socket; anything else means it is still listening.
    try { await fetch(`${base}/api/hello?token=${token}`, { headers: { host: '127.0.0.1' } }); }
    catch { shutdown = true; }
  } catch { /* reported as a failed check */ }

  try { child.kill(); } catch { /* already exited */ }
  return { url, hello, shutdown };
}

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(abs, base));
    else out.push(relative(base, abs));
  }
  return out;
}

main().catch((e) => { console.error(e.stack ?? String(e)); process.exit(1); });
