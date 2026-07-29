// tests/ui_server.test.mjs — the local server (phase 6.1, plans/05).
//
// Every spec here corresponds to a failure mode somebody else already shipped and documented
// (`researches/07` §5). None of them is defensive programming for its own sake: this program's one
// dangerous button moves 71 606 of the owner's photographs, and it is reachable over HTTP the
// moment the server is up.
//
// The specs that matter most are the two that say NO — a request without the token, and a request
// claiming a foreign Host. "It only listens on localhost" is not a security model: any page the
// user has open can post to our port, and DNS rebinding defeats hostname checks that trust the
// name. Glances, a tool of exactly our shape, carries a filed advisory for missing Host validation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { startServer, findRunningInstance, hostAllowed, urlFor, STATE_FILE, DEFAULT_PORT }
  from '../src/ui/server.mjs';

/**
 * Ask the server for something, choosing the Host and the token deliberately rather than by luck.
 *
 * Deliberately `node:http` and not `fetch`: `Host` is a FORBIDDEN header for fetch, which silently
 * drops it. The first version of this file used fetch, and the rebinding spec passed for the worst
 * possible reason — the attack it claimed to simulate was never sent at all. A spec about a header
 * has to be able to set that header.
 */
function ask(port, path, { token = null, host = '127.0.0.1', method = 'GET' } = {}) {
  const full = `${path}${token ? `${path.includes('?') ? '&' : '?'}token=${token}` : ''}`;
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: full, method, headers: { Host: host } },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
    req.on('error', reject);
    req.end();
  });
}

/** Every test starts from "nothing is running" — a stale state file must never make a spec pass. */
async function clean() { await rm(STATE_FILE, { force: true }); }

test('a request WITHOUT the token is refused — the port being open is not permission', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const denied = await ask(s.port, '/api/hello');
    assert.equal(denied.status, 401);
    const allowed = await ask(s.port, '/api/hello', { token: s.token });
    assert.equal(allowed.status, 200);
    assert.equal(JSON.parse(allowed.body).app, 'kpot');
  } finally { await s.close(); }
});

test('a request with a WRONG token is refused, even though the address is right', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await ask(s.port, '/api/hello', { token: 'f'.repeat(48) });
    assert.equal(r.status, 401);
  } finally { await s.close(); }
});

test('a FOREIGN Host is refused even WITH a valid token — this is the DNS-rebinding defence', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await ask(s.port, '/api/hello', { token: s.token, host: 'evil.example.com' });
    assert.equal(r.status, 403, 'a page on another origin must not be able to drive this server');
    const ok = await ask(s.port, '/api/hello', { token: s.token, host: `localhost:${s.port}` });
    assert.equal(ok.status, 200, 'but our own hostnames must work, port included');
  } finally { await s.close(); }
});

test('hostAllowed accepts our names with and without a port, and nothing else', () => {
  for (const good of ['localhost', '127.0.0.1', 'localhost:5768', '127.0.0.1:5768', '[::1]', '[::1]:5768']) {
    assert.equal(hostAllowed(good), true, good);
  }
  for (const bad of ['evil.com', 'localhost.evil.com', '192.168.1.5', '', undefined, 'кпот.рф']) {
    assert.equal(hostAllowed(bad), false, String(bad));
  }
});

test('a TAKEN port does not kill the start — it falls back, and the address it reports really works', async () => {
  await clean();
  // Occupy a port the way another program would, then ask KPOT for exactly that one.
  const squatter = createServer((_, res) => res.end('not kpot'));
  await new Promise((r) => squatter.listen(0, '127.0.0.1', r));
  const taken = squatter.address().port;
  // startServer is INSIDE the try on purpose: without the fallback it rejects, and a squatter left
  // listening keeps the test process alive forever. The first version put it outside and the
  // break-the-code pass hung instead of going red — a guard that hangs is a guard you stop running.
  let s = null;
  try {
    s = await startServer({ port: taken });
    assert.notEqual(s.port, taken, 'it must not have stolen the occupied port');
    // The address it hands out is the one a person will open, so it has to be the working one.
    const r = await ask(s.port, '/api/hello', { token: s.token });
    assert.equal(r.status, 200);
    assert.ok(s.url.includes(`:${s.port}`), 'the URL it reports must name the port it actually got');
  } finally {
    if (s) await s.close();
    await new Promise((r) => squatter.close(r));
  }
});

test('a SECOND launch finds the running server instead of starting another one', async () => {
  await clean();
  assert.equal(await findRunningInstance(), null, 'with nothing running there is nothing to find');
  const first = await startServer({ port: 0 });
  try {
    const found = await findRunningInstance();
    assert.ok(found, 'the running instance must be discoverable — otherwise the shortcut fights for the port');
    assert.equal(found.port, first.port);
    assert.equal(found.url, first.url, 'and the second launch opens the face on the FIRST server');
  } finally { await first.close(); }
});

test('a recorded instance that is NOT actually there is reported as absent, not as running', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  const url = s.url;
  await s.close();
  // The state file is gone after a clean shutdown; recreate the CLAIM without the server behind it.
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify({ app: 'kpot', port: s.port, token: s.token }), 'utf8');
  assert.equal(await findRunningInstance(), null,
    'a state file is a claim; a dead port must never be reported as a live instance');
  assert.ok(url.startsWith('http://127.0.0.1:'));
  await clean();
});

test('the port being busy with something that is NOT kpot is not mistaken for us', async () => {
  await clean();
  const impostor = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ app: 'something-else' }));
  });
  await new Promise((r) => impostor.listen(0, '127.0.0.1', r));
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE,
    JSON.stringify({ app: 'kpot', port: impostor.address().port, token: 'x'.repeat(48) }), 'utf8');
  try {
    assert.equal(await findRunningInstance(), null, 'another program on our port is not our server');
  } finally {
    await new Promise((r) => impostor.close(r));
    await clean();
  }
});

test('«Завершить работу» stops the server and removes the record of it', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  await readFile(STATE_FILE, 'utf8');                       // it exists while running
  const r = await ask(s.port, '/api/shutdown', { token: s.token, method: 'POST' });
  assert.equal(r.status, 200);
  // Give the close a moment, then prove BOTH halves: the port is dead and the claim is gone.
  await new Promise((res) => setTimeout(res, 150));
  await assert.rejects(() => fetch(`http://127.0.0.1:${s.port}/api/hello?token=${s.token}`),
    'the server must actually be down, not merely say so');
  await assert.rejects(() => readFile(STATE_FILE, 'utf8'),
    'a leftover record would send the next launch to a dead port');
});

test('the shutdown control refuses an unauthenticated caller like everything else', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await ask(s.port, '/api/shutdown', { method: 'POST' });
    assert.equal(r.status, 401);
    const still = await ask(s.port, '/api/hello', { token: s.token });
    assert.equal(still.status, 200, 'and the server is still running, because the refusal worked');
  } finally { await s.close(); }
});

// ─── live progress, and the property the owner's decision turns into a requirement ───────────────

/** Open an SSE stream and collect the raw frames as they arrive. */
function subscribe(port, token) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: `/api/events?token=${token}`,
      headers: { Host: '127.0.0.1' } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      resolve({ res, req, read: () => text });
    });
    req.on('error', reject);
    req.end();
  });
}

const settle = () => new Promise((r) => setTimeout(r, 60));

test('the browser receives live progress as Server-Sent Events', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const sub = await subscribe(s.port, s.token);
    await settle();
    assert.match(sub.read(), /event: hello/, 'a subscriber is greeted, so the page knows it is connected');

    const p = s.browserProgress();
    p.start('Изучаю папку', 3);
    p.tick();
    p.done('готово');
    await settle();

    const text = sub.read();
    assert.match(text, /event: progress\n/);
    assert.match(text, /"label":"Изучаю папку"/, 'the label travels in the owner\'s own language');
    assert.match(text, /"total":3/);
    assert.match(text, /event: progress-done/);
    sub.req.destroy();
  } finally { await s.close(); }
});

test('A CLOSED TAB DOES NOT AFFECT THE SERVER — the owner\'s rule, as a test', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const sub = await subscribe(s.port, s.token);
    await settle();
    assert.equal(s.subscriberCount(), 1);

    // The person closes the window mid-run. This is the normal case, not a failure: the owner
    // decided «Закрытие Морды не влияет на сервер - он работает», and a sort of 71 606 files takes
    // minutes that must not die with a tab.
    sub.req.destroy();
    await settle();

    const p = s.browserProgress();
    p.start('Раскладываю файлы', 2);
    p.tick();
    p.done();                                  // must not throw with nobody listening
    assert.equal(s.subscriberCount(), 0, 'the departed window is simply forgotten');

    const alive = await ask(s.port, '/api/hello', { token: s.token });
    assert.equal(alive.status, 200, 'and the server is still serving');
  } finally { await s.close(); }
});

test('shutting down does not hang on a browser window someone left open', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  const sub = await subscribe(s.port, s.token);
  await settle();
  // An SSE response holds its socket open forever by design, and server.close() waits for open
  // connections — so without ending the streams first, one forgotten tab would keep the program
  // alive after «Завершить работу», which is the exact complaint this whole design avoids.
  const closed = await Promise.race([
    s.close().then(() => 'closed'),
    new Promise((r) => setTimeout(() => r('HUNG'), 3000)),
  ]);
  assert.equal(closed, 'closed', 'shutdown must not wait for a window nobody is looking at');
  sub.req.destroy();
});

// ─── running a phase over HTTP ───────────────────────────────────────────────────────────────────

/** POST a JSON body, the way the page does. */
function post(port, path, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: `${path}?token=${token}`, method: 'POST',
      headers: { Host: '127.0.0.1', 'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload) } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: text }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

test('the server refuses to sort without a confirmation — over HTTP, not just in the module', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await post(s.port, '/api/run', s.token, { kind: 'apply', root: process.cwd() });
    assert.equal(r.status, 409, 'a refusal is an answer, and it must not look like success');
    const parsed = JSON.parse(r.body);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.reason, 'needs-confirmation');
    assert.equal(s.jobs.state().busy, false, 'and nothing started');
  } finally { await s.close(); }
});

test('/api/state lets a browser that was closed mid-run catch up when it comes back', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await ask(s.port, '/api/state', { token: s.token });
    assert.equal(r.status, 200);
    const parsed = JSON.parse(r.body);
    // The owner's server/«морда» split makes reconnecting the NORMAL case, not an edge one, so the
    // page must be able to ask "what is happening?" instead of only hearing live events.
    assert.deepEqual(Object.keys(parsed).sort(), ['busy', 'current', 'last']);
    assert.equal(parsed.busy, false);
  } finally { await s.close(); }
});

test('starting a phase needs the token like everything else', async () => {
  await clean();
  const s = await startServer({ port: 0 });
  try {
    const r = await post(s.port, '/api/run', 'wrong'.repeat(9), { kind: 'scan', root: process.cwd() });
    assert.equal(r.status, 401);
    assert.equal(s.jobs.state().busy, false);
  } finally { await s.close(); }
});

test('NO file in src/ui/ may reach below src/app/ — the layering rule is checked, not promised', () => {
  // Scans the whole directory, not one file: the rule is about the LAYER, and a second module added
  // later is exactly where it would be broken without anyone noticing. Siblings inside src/ui/ are
  // fine — that is the same layer; what may never appear is a reach into apply/, plan/, meta/ or
  // scan/, because that is how a face quietly becomes a second implementation of the product.
  const dir = fileURLToPath(new URL('../src/ui/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length > 0, 'the guard must actually have files to check');
  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8');
    const imports = [...src.matchAll(/^import[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    for (const p of imports.filter((x) => x.startsWith('.'))) {
      assert.ok(p.startsWith('../app/') || p.startsWith('./'),
        `src/ui/${file} imports «${p}» — a face may only compose what src/app/ exposes (RULE 2).`);
    }
  }
});

test('the default port is a fixed, documented number rather than whatever was free', () => {
  // Not a triviality: the shortcut and the docs both name it, and a "clever" dynamic default would
  // make the address unpredictable for the one person who has to type it when the browser fails.
  assert.equal(typeof DEFAULT_PORT, 'number');
  assert.ok(DEFAULT_PORT > 1024 && DEFAULT_PORT < 65536);
  assert.equal(urlFor(DEFAULT_PORT, 'abc'), `http://127.0.0.1:${DEFAULT_PORT}/?token=abc`);
});
