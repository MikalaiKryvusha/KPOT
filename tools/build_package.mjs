// tools/build_package.mjs — assemble the portable Windows package (phase 6.5, plans/09).
// [NOT-TESTED]
//
// «Скачал — распаковал — готово»: the owner's chosen delivery (decision log, 2026-07-29). This
// script does not compile anything, because there is nothing to compile — the package is our own
// `.mjs` sources plus somebody else's signed binary. What it actually does is CHECK, and every
// check exists because its absence would let the package lie about itself:
//
//   · the vendored Node archive is verified against the SHA-256 nodejs.org published, so
//     "we ship the official binary" stops being a claim and becomes a test;
//   · the `node.exe` that actually goes INTO the package has its Authenticode signature read —
//     on that file, not on the one this machine happens to have installed. The whole delivery
//     argument (`researches/07` §5.5, `researches/09` §2.3) is that we introduce no unsigned
//     executable, and a claim of that shape must be re-proved on every build;
//   · the staged tree is compared against an explicit allow-list. Release 0.1 shipped a 17 MB npm
//     tarball carrying the .psd logo source, the whole KAIF framework and every internal working
//     document, because nobody enumerated what SHOULD be in it (STATUS, 2026-07-28).
//
// Run: `npm run package`. Output: dist/KPOT-<version>-win-x64.zip, plus its size and hash for the
// release page. Everything it writes is gitignored — the ignore lines were added before this file.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The Node runtime we ship, pinned by content rather than by name.
 *
 * The hash is not decoration: a vendored 35 MB binary is exactly the kind of artifact nobody
 * re-checks by eye, and it is the one file in this package we did not write. Source of the value:
 * https://nodejs.org/dist/v24.15.0/SHASUMS256.txt , fetched and compared 2026-07-29 against a
 * download made in a real browser (`researches/09` §2.3 — it matched).
 */
const NODE = Object.freeze({
  version: 'v24.15.0',
  archive: 'node-v24.15.0-win-x64.zip',
  sha256: 'cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62',
  sumsUrl: 'https://nodejs.org/dist/v24.15.0/SHASUMS256.txt',
  expectSigner: 'CN=OpenJS Foundation',
});

/** Exactly what belongs in the package. Anything staged and not matching this is a bug. */
const ALLOWED = [
  /^KPOT\.cmd$/,
  /^ЧИТАТЬ\.txt$/,
  /^LICENSE$/,
  /^app[/\\]node\.exe$/,
  /^app[/\\]package\.json$/,
  /^app[/\\]bin[/\\]/,
  /^app[/\\]src[/\\]/,
  /^app[/\\]node_modules[/\\](exifreader|jpeg-js)[/\\]/,
];

/** The two runtime dependencies, both with no dependencies of their own (verified 2026-07-29). */
const RUNTIME_DEPS = ['exifreader', 'jpeg-js'];

const die = (msg) => { console.error(`build: ${msg}`); process.exit(1); };

/** Streamed SHA-256 — the archive is 35 MB and there is no reason to hold it in memory. */
function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('error', reject).on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** Every file under `dir`, as paths relative to it. Used to audit the staged tree. */
async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(abs, base));
    else out.push(relative(base, abs));
  }
  return out;
}

/**
 * The launcher. Deliberately four lines of `cmd`, and deliberately NOT hiding its own window: the
 * console IS the program while the browser is open, and «Завершить работу» in the window is what
 * stops it. A launcher that vanished would leave a non-technical person with a server they cannot
 * see and cannot stop — the classic complaint `researches/07` §5.4 names about this class of tool.
 *
 * `%~dp0` is the folder this file sits in, with a trailing backslash, so the package works from any
 * path the person unzipped it to — including one with spaces or Cyrillic in it.
 */
const LAUNCHER = [
  '@echo off',
  'chcp 65001 >nul',
  'title Krinik Photo Organizer Tool (KPOT)',
  'echo.',
  'echo   Запускаю KPOT. Сейчас откроется окно в браузере.',
  'echo   Это окно закрывать не надо - пока оно открыто, программа работает.',
  'echo.',
  '"%~dp0app\\node.exe" "%~dp0app\\bin\\kpot.mjs" ui',
  'if errorlevel 1 (',
  '  echo.',
  '  echo   Не удалось запустить. Напишите нам, что здесь написано выше.',
  '  pause',
  ')',
].join('\r\n') + '\r\n';

/**
 * What the person reads before pressing anything.
 *
 * The paragraph about the Windows warning is the whole point of `researches/09`: we cannot promise
 * a silent first launch on anyone's machine, so we say in advance exactly what may appear and which
 * button to press. Naming the dialog in the words Windows itself uses is what makes it reassuring
 * instead of alarming — a person who was told what would happen is not being ambushed.
 */
const READ_ME = [
  'KPOT — Krinik Photo Organizer Tool',
  '==================================',
  '',
  'Программа наводит порядок в ваших фотографиях: раскладывает их по годам и порам года.',
  '',
  'КАК ЗАПУСТИТЬ',
  '-------------',
  '1. Распакуйте эту папку целиком в любое удобное место.',
  '2. Дважды щёлкните по файлу KPOT.cmd',
  '3. Откроется окно браузера — дальше программа проведёт вас по шагам.',
  '',
  'ЧТО МОЖЕТ ПОКАЗАТЬ WINDOWS ПРИ ПЕРВОМ ЗАПУСКЕ',
  '---------------------------------------------',
  'Windows видит, что файл пришёл из интернета, и может показать окно',
  '«Открыть файл — предупреждение системы безопасности».',
  'Это нормально и означает ровно одно: файл скачан, а не создан на вашем компьютере.',
  'Нажмите «Запустить» (Run).',
  '',
  'Внутри программы нет ни одной чужой или неизвестной программы: она состоит из наших',
  'текстовых файлов и официального node.exe, подписанного OpenJS Foundation.',
  '',
  'ЧТО ПРОГРАММА ДЕЛАЕТ С ВАШИМИ ФАЙЛАМИ',
  '-------------------------------------',
  '· Сначала только смотрит и показывает план — ни один файл не двигается.',
  '· Перед сортировкой делает запасную копию и проверяет её.',
  '· Ничего не удаляет: лишние копии и мусор откладывает в сторону.',
  '· Любую сортировку можно вернуть назад одной кнопкой.',
  '',
  'Программе не нужен интернет. Она не отправляет никуда ни одной вашей фотографии.',
  '',
  'Лицензия MIT, исходный код открыт: https://github.com/MikalaiKryvusha/KPOT',
].join('\r\n') + '\r\n';

async function main() {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const name = `KPOT-${pkg.version}-win-x64`;
  const dist = join(ROOT, 'dist');
  const stage = join(dist, name);

  // ── 1. the vendored runtime, verified by content ───────────────────────────────────────────────
  const archive = join(ROOT, 'vendor', NODE.archive);
  try { await stat(archive); } catch {
    die(`missing ${relative(ROOT, archive)}\n`
      + `       download it from https://nodejs.org/dist/${NODE.version}/${NODE.archive}\n`
      + `       (it is gitignored on purpose — 35 MB has no business in a public repository)`);
  }
  const actual = await sha256File(archive);
  if (actual !== NODE.sha256) {
    die(`the vendored Node archive is NOT the one we pinned.\n`
      + `       expected ${NODE.sha256}\n`
      + `       actual   ${actual}\n`
      + `       published list: ${NODE.sumsUrl}`);
  }
  console.log(`✓ vendored ${NODE.archive} matches the published SHA-256`);

  // ── 2. stage the tree ──────────────────────────────────────────────────────────────────────────
  await rm(dist, { recursive: true, force: true });
  await mkdir(join(stage, 'app'), { recursive: true });

  // Only node.exe is taken out of the archive: the rest of a Node distribution (npm, headers,
  // docs) is 40 MB of things a packaged app never calls.
  const unpack = join(dist, '_node');
  await mkdir(unpack, { recursive: true });
  await execFileP('tar.exe', ['-xf', archive, '-C', unpack]);
  const nodeExe = join(unpack, `node-${NODE.version}-win-x64`, 'node.exe');
  try { await stat(nodeExe); } catch { die('node.exe not found inside the archive — layout changed?'); }
  await cp(nodeExe, join(stage, 'app', 'node.exe'));

  await cp(join(ROOT, 'bin'), join(stage, 'app', 'bin'), { recursive: true });
  await cp(join(ROOT, 'src'), join(stage, 'app', 'src'), { recursive: true });
  await cp(join(ROOT, 'package.json'), join(stage, 'app', 'package.json'));
  await cp(join(ROOT, 'LICENSE'), join(stage, 'LICENSE'));
  for (const dep of RUNTIME_DEPS) {
    await cp(join(ROOT, 'node_modules', dep), join(stage, 'app', 'node_modules', dep), { recursive: true });
  }
  await writeFile(join(stage, 'KPOT.cmd'), LAUNCHER, 'utf8');
  await writeFile(join(stage, 'ЧИТАТЬ.txt'), READ_ME, 'utf8');
  await rm(unpack, { recursive: true, force: true });

  // ── 3. the signature, read on the file that is actually shipping ───────────────────────────────
  const staged = join(stage, 'app', 'node.exe');
  const { stdout: sig } = await execFileP('powershell.exe', ['-NoProfile', '-Command',
    `$s = Get-AuthenticodeSignature -LiteralPath '${staged}'; `
    + `Write-Output ($s.Status.ToString() + '|' + $s.SignerCertificate.Subject)`]);
  const [status, signer] = sig.trim().split('|');
  if (status !== 'Valid') die(`the node.exe we are about to ship is not signed: status=${status}`);
  if (!signer?.startsWith(NODE.expectSigner)) die(`unexpected signer: ${signer}`);
  console.log(`✓ node.exe signature ${status} — ${signer.split(',')[0]}`);

  // ── 4. audit the staged tree against the allow-list ────────────────────────────────────────────
  const files = await walk(stage);
  const strays = files.filter((f) => !ALLOWED.some((re) => re.test(f.replace(/\\/g, '/'))));
  if (strays.length > 0) {
    die(`${strays.length} file(s) staged that no rule allows — the package must carry exactly what `
      + `we listed, not whatever happened to be nearby:\n       ` + strays.slice(0, 20).join('\n       '));
  }
  const bytes = (await Promise.all(files.map(async (f) => (await stat(join(stage, f))).size)))
    .reduce((a, b) => a + b, 0);
  console.log(`✓ staged ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, nothing unexpected`);

  // ── 5. zip it, and print the numbers the release page needs ────────────────────────────────────
  const zip = join(dist, `${name}.zip`);
  await execFileP('tar.exe', ['-a', '-c', '-f', zip, '-C', dist, name]);
  const zipped = (await stat(zip)).size;
  console.log(`✓ ${relative(ROOT, zip)}`);
  console.log(`  ${(zipped / 1024 / 1024).toFixed(1)} MB  sha256 ${await sha256File(zip)}`);
}

main().catch((e) => die(e.stack ?? String(e)));
