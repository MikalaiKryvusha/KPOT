// src/ui/server.mjs — the local server behind KPOT's web interface (phase 6.1, plans/05).
// [TESTED: 2026-07-29 · tests/ui_server.test.mjs — 15 specs (token · Host whitelist · port fallback ·
// single instance · shutdown · SSE · a closed tab · layering), each guard verified by breaking the
// code first · plus a live smoke: `kpot ui` really started on 5768, a SECOND launch returned the
// SAME address instead of a second server, the browser opened, and «Завершить работу» left the port
// closed and the state file gone]
//
// The owner split the program into a SERVER and a «морда» (the browser page): «Закрытие Морды не
// влияет на сервер - он работает». That single decision is why this file exists as its own layer
// rather than as a flag on the CLI, and it creates three obligations this module owns — an explicit
// shutdown control, a second launch that FINDS the running server instead of starting another, and
// the rule that the server stays the only writer.
//
// Everything here that looks like paranoia is somebody else's documented failure
// (`researches/07_local_ui_and_delivery.md` §5), not our caution:
//
//   · "it only listens on 127.0.0.1" is NOT a security model — any page the user has open can post
//     to our port, and DNS rebinding defeats hostname checks. Glances, a tool of exactly our shape,
//     carries a filed advisory for missing Host validation. So: a start-up TOKEN (Jupyter's model)
//     plus a HOST whitelist, and no request is served without both;
//   · the default port will be taken one day (Syncthing falls back to a random one);
//   · opening the browser before the server is listening greets a first-time user with an error;
//   · a second launch of the shortcut must not fight the first one for the port.
//
// LAYERING (RULE 2): src/ui/ sits ABOVE src/app/ and may call NOTHING below it. It writes no user
// file — every effect goes through `src/app/phases.mjs` into `src/apply/`, which stays the single
// writer (RULE 1). A spec enforces both, because a layering rule nobody checks is a comment.

import { createServer as createHttpServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJobRunner } from './jobs.mjs';
import { listFolders } from './folders.mjs';
import { renderPage } from './page.mjs';
import { renderPlan } from '../app/phases.mjs';

/**
 * The port we ask for first. Arbitrary on purpose, and chosen the way Syncthing chose 8384: high
 * enough to need no privileges, odd enough to be free on a normal machine. 5768 spells KPOT on a
 * phone keypad, which is the only reason to prefer it over any other free number — it makes the
 * number memorable in a bug report rather than meaningful.
 */
export const DEFAULT_PORT = 5768;

/** Hostnames a request may claim. Anything else is a rebinding attempt or a misconfiguration. */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Where the running instance records itself, so a second launch can find it instead of fighting it. */
export const STATE_DIR = join(tmpdir(), 'kpot-ui');
export const STATE_FILE = join(STATE_DIR, 'instance.json');

/** Constant-time token comparison — a length-safe wrapper, since timingSafeEqual throws on a mismatch. */
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Is the `Host` header one of ours? Compared without the port, because the port is ours to choose
 * and a whitelist that hard-codes it breaks the moment the fallback fires.
 */
export function hostAllowed(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false;
  // '[::1]:5768' → '[::1]' ; '127.0.0.1:5768' → '127.0.0.1'
  const name = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  return ALLOWED_HOSTS.has(name);
}

/** The token as the request carries it: `?token=…` for the opened URL, a header for later calls. */
function tokenOf(req, url) {
  return url.searchParams.get('token') ?? req.headers['x-kpot-token'] ?? null;
}

/**
 * Listen on 127.0.0.1, trying `port` first and falling back to a random free port if it is taken.
 * Resolves only after the `listening` event — the caller must never open a browser before that.
 */
function listenWithFallback(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (e) => {
      if (e.code !== 'EADDRINUSE') { reject(e); return; }
      // Port taken. Ask the OS for any free one (port 0) rather than guessing a second number.
      server.removeListener('error', onError);
      server.once('error', reject);
      server.listen(0, '127.0.0.1');
    };
    server.once('error', onError);
    server.once('listening', () => {
      server.removeListener('error', onError);
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Read a JSON request body, refusing anything implausibly large.
 * The cap is not about attackers — the token already keeps strangers out — it is about a bug in our
 * own page never being able to make the server eat memory.
 */
function readJsonBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > limitBytes) { reject(new Error('request too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw === '' ? {} : JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/** Record this instance so a second launch finds it. Best-effort: a failure here must not kill the run. */
async function writeState(state) {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch { /* the server still works; only single-instance detection degrades */ }
}

async function clearState() {
  try { await rm(STATE_FILE, { force: true }); } catch { /* nothing to clean up */ }
}

/**
 * Is a KPOT server already running on this machine? Returns its address and token, or null.
 *
 * A recorded state file is a CLAIM, not a fact — the process may have been killed, or the port may
 * have been reused by something else entirely. So the claim is verified by asking the thing on that
 * port to identify itself, and only an answer that is recognisably ours counts.
 */
export async function findRunningInstance({ fetchImpl = fetch } = {}) {
  let state;
  try {
    state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return null;                                    // no file, or unreadable — nothing is running
  }
  if (!state?.port || !state?.token) return null;
  try {
    const res = await fetchImpl(`http://127.0.0.1:${state.port}/api/hello?token=${state.token}`, {
      headers: { Host: '127.0.0.1' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (body?.app !== 'kpot') return null;          // someone else took the port
    return { url: urlFor(state.port, state.token), port: state.port, token: state.token };
  } catch {
    return null;                                    // recorded but dead — a stale file, not a server
  }
}

/** The address a person (or the shortcut) opens: the token travels in the URL, Jupyter-style. */
export const urlFor = (port, token) => `http://127.0.0.1:${port}/?token=${token}`;

/**
 * Show `url` in the person's normal browser.
 * [TESTED: 2026-07-29 · live smoke on Windows 11 — `kpot ui` opened the default browser at the
 * address it printed; not covered by a spec, because a passing spec would only prove that a child
 * process was spawned, not that a window appeared]
 *
 * Never fatal: if this fails the program has still started, and the address is printed anyway. A
 * tool that refuses to run because it could not open a window would be worse than one that says
 * «откройте эту ссылку». The caller must only ever invoke this AFTER the server is listening —
 * opening it earlier greets a first-time user with a connection error (`researches/07` §5.3).
 */
export async function openInBrowser(url, { spawnImpl = null } = {}) {
  const { spawn } = spawnImpl ? { spawn: spawnImpl } : await import('node:child_process');
  const [cmd, args] = process.platform === 'win32'
    // `start` is a shell builtin, not a program, and its first quoted argument is the window title —
    // omitting that empty title is the classic bug that makes a quoted URL become the title instead.
    ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref?.();
    return true;
  } catch {
    return false;
  }
}

/**
 * Start the server.
 *
 * @param {{port?: number, token?: string, onShutdown?: () => void}} [opts]
 * @returns {Promise<{url, port, token, server, close: () => Promise<void>}>} resolved only once the
 *          socket is actually listening, so a caller cannot open a browser too early.
 */
export async function startServer({ port = DEFAULT_PORT, token = randomBytes(24).toString('hex'),
  onShutdown = null } = {}) {
  let closing = false;
  /** Open browser windows listening for progress. A tab may leave at any moment; that is normal. */
  const subscribers = new Set();

  /**
   * Push one progress event to every open window.
   *
   * Deliberately fire-and-forget and deliberately unaware of who is listening: the owner ruled that
   * closing the «морда» must not affect the server, so a run may have zero subscribers for minutes
   * and must not notice. A write to a socket the browser has already dropped throws — it is caught
   * and the subscriber forgotten, because a closed tab is not an error condition.
   */
  function broadcast(event, data) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
    for (const res of subscribers) {
      try { res.write(frame); } catch { subscribers.delete(res); }
    }
    return subscribers.size;
  }

  /**
   * A `progress`-shaped object (same three calls as `src/core/progress.mjs`) that reports into the
   * browser instead of into a terminal. It is the SAME interface on purpose: the phases in
   * `src/app/` already take one, so the web interface needs no special path through the pipeline —
   * which is the whole reason phase 6.0 exists.
   */
  function browserProgress() {
    let label = '', total = 0, count = 0;
    return {
      enabled: true,
      start(newLabel, newTotal = 0) {
        label = newLabel; total = newTotal; count = 0;
        broadcast('progress', { label, total, count });
      },
      tick(n = 1) {
        count += n;
        broadcast('progress', { label, total, count });
      },
      done(summary = null) { broadcast('progress-done', { label, count, summary }); },
    };
  }

  // The job runner reports into the same SSE stream the progress uses, so a page needs one
  // connection for everything that happens.
  const jobs = createJobRunner({
    onEvent: (event, data) => broadcast(event, data),
    progressFor: () => browserProgress(),
  });

  const server = createHttpServer((req, res) => handle(req, res));
  const actualPort = await listenWithFallback(server, port);
  await writeState({ app: 'kpot', port: actualPort, token, pid: process.pid });

  function deny(res, code, message) {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message }));
  }

  function handle(req, res) {
    // The Host check comes FIRST and is not negotiable: a rebinding attack arrives with a hostname
    // we never issued, and everything after this line assumes the caller is on this machine.
    if (!hostAllowed(req.headers.host)) {
      deny(res, 403, 'этот адрес не обслуживается');
      return;
    }
    const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
    if (!tokensMatch(tokenOf(req, url), token)) {
      deny(res, 401, 'нет ключа доступа — откройте программу по ссылке, которую она вам дала');
      return;
    }

    // `/api/hello` exists so a SECOND launch can prove the thing on this port is really KPOT
    // before opening a browser at it. A port being busy says nothing about who is holding it.
    if (url.pathname === '/api/hello') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ app: 'kpot', port: actualPort, pid: process.pid }));
      return;
    }

    // The owner's explicit «Завершить работу». The window no longer switches the program off, so
    // the program must carry a visible switch — otherwise we produce exactly the complaint
    // researches/07 §5.4 names as the classic one about this class of tool.
    if (url.pathname === '/api/shutdown' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      close().then(() => onShutdown?.());
      return;
    }

    // Choosing the folder. A browser page CANNOT open a file dialog that returns a real path — the
    // web platform deliberately forbids it — and telling an inexperienced person to type
    // `D:\Фото\архив` by hand is the opposite of the «защита от дурака» the owner asked for. So the
    // server lists folders and the page walks them. Read-only: it returns names, never contents.
    if (url.pathname === '/api/folders') {
      listFolders(url.searchParams.get('path')).then((data) => {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
      }).catch((e) => deny(res, 400, e.message));
      return;
    }

    // The plan the person reads. Rendered by the SAME function the terminal uses — the owner has
    // corrected that text's wording twice, and there must be exactly one of it.
    if (url.pathname === '/api/plan-report') {
      const last = jobs.state().last;
      const planned = last?.kind === 'plan' && last.state === 'done' ? last.result : null;
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(planned
        ? { plan: planned.plan, report: renderPlan(planned.plan) }
        : { plan: null, report: '' }));
      return;
    }

    // What is happening right now, and what happened last. A browser that was closed during a run
    // and reopened afterwards must be able to catch up — the owner's server/«морда» split makes
    // that the normal case, not an edge one.
    if (url.pathname === '/api/state') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(jobs.state()));
      return;
    }

    // Start a phase. The server, not the page, decides whether it may: one job at a time, and no
    // real sort without an explicit confirmation (src/ui/jobs.mjs).
    if (url.pathname === '/api/run' && req.method === 'POST') {
      readJsonBody(req).then((body) => {
        const started = jobs.start(body?.kind, body?.root,
          { confirmed: body?.confirmed === true, dryRun: body?.dryRun === true,
            startedAtMs: Date.now() });
        res.writeHead(started.ok ? 202 : 409, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(started));
      }).catch(() => deny(res, 400, 'не удалось прочитать запрос'));
      return;
    }

    // Live progress to the browser. Server-Sent Events, not WebSockets: this direction is the only
    // one we need, and SSE is a content-type rather than a dependency (`researches/07` §6).
    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('event: hello\ndata: {}\n\n');
      subscribers.add(res);
      // A tab that goes away is the normal case, not a failure: the owner decided the server keeps
      // working when the «морда» closes, so its departure is simply forgotten.
      req.on('close', () => { subscribers.delete(res); });
      return;
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderPage());
      return;
    }

    deny(res, 404, 'такой страницы нет');
  }

  async function close() {
    if (closing) return;
    closing = true;
    await clearState();
    // End every open stream first: an SSE response holds the socket open, and server.close() waits
    // for connections to finish — so a single forgotten browser tab would hang the shutdown for as
    // long as it stayed open. «Завершить работу» has to mean it.
    for (const res of subscribers) { try { res.end(); } catch { /* already gone */ } }
    subscribers.clear();
    await new Promise((resolve) => server.close(resolve));
  }

  return { url: urlFor(actualPort, token), port: actualPort, token, server, close,
    broadcast, browserProgress, jobs, subscriberCount: () => subscribers.size };
}

// The wizard itself lives in ./page.mjs — one self-contained page, every word from ./i18n.mjs.
