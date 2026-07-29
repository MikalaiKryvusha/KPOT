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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

test('src/ui/ may not reach below src/app/ — the layering rule is checked, not promised', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/ui/server.mjs', import.meta.url)), 'utf8');
  const imports = [...src.matchAll(/^import[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  const internal = imports.filter((p) => p.startsWith('.'));
  for (const p of internal) {
    assert.ok(p.startsWith('../app/'),
      `src/ui/ imports «${p}» — a face may only compose what src/app/ exposes (RULE 2). `
      + 'Reaching into apply/ or plan/ directly is how a second implementation of the product starts.');
  }
});

test('the default port is a fixed, documented number rather than whatever was free', () => {
  // Not a triviality: the shortcut and the docs both name it, and a "clever" dynamic default would
  // make the address unpredictable for the one person who has to type it when the browser fails.
  assert.equal(typeof DEFAULT_PORT, 'number');
  assert.ok(DEFAULT_PORT > 1024 && DEFAULT_PORT < 65536);
  assert.equal(urlFor(DEFAULT_PORT, 'abc'), `http://127.0.0.1:${DEFAULT_PORT}/?token=abc`);
});
