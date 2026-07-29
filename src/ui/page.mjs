// src/ui/page.mjs — the first-flight wizard, as one self-contained page (6.2b, plans/06).
// [NOT-TESTED]
//
// The owner chose this shape himself (interview #003 Q1): «мне нравится мастер v1» — four steps, one
// thing on screen at a time, for a person who is afraid of breaking something. Once a library
// exists it gives way to the control panel (6.3); a wizard is right exactly once.
//
// Three things about the construction, each with a reason rather than a preference:
//
//  · ONE FILE, no build step, no framework. The project's policy is near-zero dependencies, and a
//    page that is plain HTML with a little JavaScript can be read end to end by whoever maintains
//    it next — including a model with no context.
//  · EVERY WORD comes from `i18n.mjs`, never from markup. The owner asked for Russian and English
//    with a switch; retrofitting that later means visiting every line again.
//  · The four `GOAL.md` guarantees sit at the bottom of every step. That is the whole argument for
//    this interface existing: in the terminal those promises are flags and files, and here they are
//    something a person can see before they press anything.

import { STRINGS, DEFAULT_LANG } from './i18n.mjs';

/**
 * Build the page. The dictionary is inlined rather than fetched: it is small, it never changes at
 * runtime, and a page that needs a second request before it can show a word would flash blank.
 */
export function renderPage() {
  return `<!doctype html>
<html lang="${DEFAULT_LANG}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Krinik Photo Organizer Tool (KPOT)</title>
<style>
:root { --ink:#1c2024; --dim:#5b6572; --line:#dfe3e8; --bg:#f7f8fa; --card:#fff;
        --ok:#1f7a4d; --warn:#8a5a00; --accent:#1d4ed8; }
* { box-sizing:border-box }
body { margin:0; background:var(--bg); color:var(--ink);
       font:16px/1.55 -apple-system,"Segoe UI",system-ui,sans-serif }
.wrap { max-width:44rem; margin:0 auto; padding:1.5rem 1rem 3rem }
header { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; margin-bottom:.25rem }
h1 { font-size:1.15rem; margin:0; font-weight:600 }
.sub { color:var(--dim); font-size:.9rem; margin:0 0 1.25rem }
.steps { display:flex; gap:.5rem; margin-bottom:1.25rem; font-size:.85rem; color:var(--dim) }
.steps div { flex:1; padding-top:.5rem; border-top:3px solid var(--line) }
.steps div.on { border-top-color:var(--accent); color:var(--ink); font-weight:600 }
.steps div.done { border-top-color:var(--ok) }
.card { background:var(--card); border:1px solid var(--line); border-radius:.6rem; padding:1.25rem }
h2 { font-size:1.35rem; margin:0 0 .4rem }
.help { color:var(--dim); margin:0 0 1rem }
button { font:inherit; padding:.55rem 1rem; border-radius:.4rem; border:1px solid var(--line);
         background:#fff; cursor:pointer }
button.primary { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600 }
button:disabled { opacity:.5; cursor:not-allowed }
.row { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; margin-top:1rem }
.spacer { flex:1 }
ul.folders { list-style:none; margin:.5rem 0; padding:0; max-height:16rem; overflow:auto;
             border:1px solid var(--line); border-radius:.4rem }
ul.folders li { border-bottom:1px solid var(--line) }
ul.folders li:last-child { border-bottom:0 }
ul.folders button { width:100%; text-align:left; border:0; border-radius:0; padding:.5rem .75rem }
ul.folders button:hover { background:var(--bg) }
.path { font-family:ui-monospace,Consolas,monospace; font-size:.85rem; color:var(--dim);
        word-break:break-all }
.bar { height:.5rem; background:var(--line); border-radius:.25rem; overflow:hidden; margin:.75rem 0 }
.bar i { display:block; height:100%; background:var(--accent); width:0; transition:width .2s }
.counts { display:grid; grid-template-columns:repeat(auto-fit,minmax(9rem,1fr)); gap:.75rem;
          margin:.5rem 0 1rem }
.counts div { border:1px solid var(--line); border-radius:.5rem; padding:.6rem .75rem }
.counts b { display:block; font-size:1.5rem; line-height:1.2 }
.counts span { color:var(--dim); font-size:.85rem }
pre.report { background:#fff; border:1px solid var(--line); border-radius:.4rem; padding:.75rem;
             max-height:22rem; overflow:auto; font-size:.8rem; white-space:pre-wrap }
.guarantees { margin-top:1.25rem; display:grid; gap:.35rem; font-size:.85rem; color:var(--dim) }
.guarantees div::before { content:"✓ "; color:var(--ok); font-weight:700 }
.err { color:#a11; margin-top:.75rem }
dialog { border:1px solid var(--line); border-radius:.6rem; padding:1.25rem; max-width:26rem }
dialog::backdrop { background:rgba(0,0,0,.35) }
.linkish { background:none; border:0; color:var(--accent); padding:0; text-decoration:underline }
</style>
</head><body>
<div class="wrap">
  <header>
    <h1 id="t-title"></h1>
    <div class="row" style="margin:0">
      <button class="linkish" id="lang"></button>
      <button id="shutdown"></button>
    </div>
  </header>
  <p class="sub" id="t-sub"></p>

  <div class="steps" id="steps">
    <div data-step="1"><span id="t-s1"></span></div>
    <div data-step="2"><span id="t-s2"></span></div>
    <div data-step="3"><span id="t-s3"></span></div>
    <div data-step="4"><span id="t-s4"></span></div>
  </div>

  <div class="card" id="card"></div>

  <div class="guarantees">
    <div id="t-g1"></div><div id="t-g2"></div><div id="t-g3"></div><div id="t-g4"></div>
  </div>
</div>

<dialog id="confirm">
  <h2 id="c-title"></h2>
  <p id="c-body"></p>
  <div class="row"><span class="spacer"></span>
    <button id="c-cancel"></button>
    <button class="primary" id="c-go"></button>
  </div>
</dialog>

<script type="module">
const STRINGS = ${JSON.stringify(STRINGS)};
const token = new URLSearchParams(location.search).get('token') ?? '';
let lang = localStorage.getItem('kpot-lang') ?? '${DEFAULT_LANG}';
// step 0 is the CONTROL PANEL — reached instead of the wizard when the chosen folder is already a
// library. The owner's rule: «Пока библиотека не собрана, человека ведут по шагам. Как только
// собрана, мастер уступает место пульту.»
let step = 1, folder = null, plan = null, applyResult = null, error = null, busyLabel = null,
    pct = 0, showFull = false, panel = null;

const t = (k, ...a) => (STRINGS[lang][k] ?? k).replace(/%(\\d)/g, (_, i) => a[i - 1] ?? '');
const el = (id) => document.getElementById(id);

/** Every call carries the token: the server refuses anything without it, and rightly so. */
async function api(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(path + sep + 'token=' + encodeURIComponent(token), {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!res.ok && res.status !== 409) throw new Error('HTTP ' + res.status);
  return res.json();
}

function chrome() {
  el('t-title').textContent = t('appTitle');
  el('t-sub').textContent = t('appSubtitle');
  for (const [i, k] of ['step1', 'step2', 'step3', 'step4'].entries()) {
    el('t-s' + (i + 1)).textContent = t(k);
  }
  for (const [i, k] of ['guaranteeMap', 'guaranteeBackup', 'guaranteeDry', 'guaranteeUndo'].entries()) {
    el('t-g' + (i + 1)).textContent = t(k);
  }
  el('lang').textContent = t('langName');
  el('shutdown').textContent = t('shutdown');
  for (const d of el('steps').children) {
    const n = Number(d.dataset.step);
    d.className = n === step ? 'on' : (n < step ? 'done' : '');
  }
  document.documentElement.lang = lang;
}

// ── step 1: choose a folder ──────────────────────────────────────────────────
let browsing = { path: null, parent: null, entries: [], unreadable: false };

async function browse(path) {
  browsing = await api('/api/folders' + (path ? '?path=' + encodeURIComponent(path) : ''));
  render();
}

function viewChoose() {
  const items = browsing.entries.map((e) =>
    \`<li><button data-go="\${escapeAttr(e.path)}">📁 \${escapeHtml(e.name)}</button></li>\`).join('');
  return \`
    <h2>\${t('chooseTitle')}</h2>
    <p class="help">\${t('chooseHelp')}</p>
    \${browsing.path ? \`<p class="path">\${escapeHtml(browsing.path)}</p>\` : ''}
    \${browsing.unreadable ? \`<p class="err">\${t('chooseUnreadable')}</p>\` : ''}
    <ul class="folders">\${items || \`<li><button disabled>\${t('chooseEmpty')}</button></li>\`}</ul>
    <div class="row">
      \${browsing.parent !== null || browsing.path
        ? \`<button data-up="1">\${t('chooseUp')}</button>\` : ''}
      <span class="spacer"></span>
      <button class="primary" data-choose="1" \${browsing.path ? '' : 'disabled'}>
        \${t('chooseThis')}</button>
    </div>\`;
}

// ── step 2: looking ──────────────────────────────────────────────────────────
function viewLook() {
  return \`
    <h2>\${t('lookTitle')}</h2>
    <p class="help">\${t('lookHelp')}</p>
    <div class="bar"><i style="width:\${pct}%"></i></div>
    <p class="path">\${escapeHtml(busyLabel ?? '')}</p>
    <p class="help">\${t('closeSafe')}</p>
    \${error ? \`<p class="err">\${t('failed')}: \${escapeHtml(error)}</p>
       <div class="row"><button data-retry="1">\${t('retry')}</button></div>\` : ''}\`;
}

// ── step 3: the plan ─────────────────────────────────────────────────────────
function viewPlan() {
  const c = plan?.plan?.counts ?? {};
  const box = (n, label) => \`<div><b>\${n ?? 0}</b><span>\${label}</span></div>\`;
  const nothing = (c.moves ?? 0) === 0;
  return \`
    <h2>\${t('planTitle')}</h2>
    <p class="help">\${t('planHelp')}</p>
    <div class="counts">
      \${box(c.moves, t('planMoves'))}
      \${box(c.stay, t('planStay'))}
      \${box(c.duplicateCopies, t('planDuplicates'))}
      \${box(c.disputed, t('planDisputed'))}
      \${(c.awaitingDecision ?? 0) > 0 ? box(c.awaitingDecision, t('planAwaiting')) : ''}
    </div>
    \${nothing ? \`<p class="help">\${t('planNothing')}</p>\` : ''}
    <div class="row">
      <button data-full="1">\${showFull ? t('planHideFull') : t('planShowFull')}</button>
      <span class="spacer"></span>
      <button class="primary" data-sort="1" \${nothing ? 'disabled' : ''}>\${t('confirmGo')}</button>
    </div>
    \${showFull ? \`<pre class="report">\${escapeHtml(plan?.report ?? '')}</pre>\` : ''}\`;
}

// ── step 4: done ─────────────────────────────────────────────────────────────
function viewDone() {
  const moved = applyResult?.result?.result?.moved ?? 0;
  return \`
    <h2>\${t('doneTitle')}</h2>
    <p class="help">\${t('doneHelp')}</p>
    <div class="counts"><div><b>\${moved}</b><span>\${t('doneMoved')}</span></div></div>
    <p class="path">\${escapeHtml(folder ?? '')}</p>\`;
}

// ── the control panel: what the wizard gives way to (interview #003 Q1) ──────
function viewPanel() {
  const years = panel?.years ?? [];
  const c = plan?.plan?.counts ?? {};
  const attention = (c.awaitingDecision ?? 0) + (c.disputed ?? 0);
  const card = (kind, title, help) =>
    '<div><b style="font-size:1rem">' + title + '</b><span>' + help + '</span>'
    + '<div class="row"><button data-panel-run="' + kind + '">' + t('next') + '</button></div></div>';
  const yearRows = years.map((y) =>
    '<li><button data-reveal="' + escapeAttr(y) + '">\\u{1F4C1} ' + escapeHtml(y)
    + ' \\u2014 ' + t('panelOpen') + '</button></li>').join('');
  return '<h2>' + t('panelTitle') + '</h2>'
    + '<p class="help">' + t('panelHelp') + '</p>'
    + '<p class="path">' + escapeHtml(folder ?? '') + '</p>'
    + '<div class="counts">'
    + card('scan', t('panelRunScan'), t('panelRunScanHelp'))
    + card('plan', t('panelRunPlan'), t('panelRunPlanHelp'))
    + card('apply', t('panelRunApply'), t('panelRunApplyHelp'))
    + '</div>'
    + '<h2 style="font-size:1.05rem">' + t('panelAttention') + '</h2>'
    + '<p class="help">' + (attention > 0 ? attention : t('panelAttentionNone')) + '</p>'
    + '<h2 style="font-size:1.05rem">' + t('panelYears') + '</h2>'
    + (years.length ? '<ul class="folders">' + yearRows + '</ul>'
                    : '<p class="help">' + t('panelNoYears') + '</p>')
    + '<div class="row"><button data-reveal=".">' + t('panelOpen') + '</button>'
    + '<span class="spacer"></span>'
    + '<button data-rechoose="1">' + t('panelBackToWizard') + '</button></div>'
    + (error ? '<p class="err">' + t('failed') + ': ' + escapeHtml(error) + '</p>' : '');
}

/**
 * After a folder is chosen: a library gets the PANEL, anything else gets the wizard.
 * Asking the server rather than guessing from the name — «is this already sorted?» is a question
 * about the filesystem, and the answer decides which face the person ever sees.
 */
async function enter() {
  panel = await api('/api/library?root=' + encodeURIComponent(folder));
  if (panel.isLibrary) { step = 0; return render(); }
  return startPlan();
}

async function panelRun(kind) {
  error = null;
  // A sort from the panel still goes through the one deliberate confirmation — the server would
  // refuse it otherwise, and that refusal is the point.
  if (kind === 'apply') { plan = await api('/api/plan-report'); return askToSort(); }
  step = 2; pct = 0; render();
  const r = await api('/api/run', { method: 'POST', body: JSON.stringify({ kind, root: folder }) });
  if (!r.ok) { error = r.message; render(); }
}

/** Send the person to look with their own eyes — the owner's replacement for thumbnails. */
async function reveal(year) {
  const path = year === '.' ? folder : folder + '/' + year;
  const r = await api('/api/reveal', { method: 'POST', body: JSON.stringify({ path, root: folder }) });
  if (!r.ok) { error = r.message; render(); }
}

function render() {
  chrome();
  el('card').innerHTML = step === 0 ? viewPanel()
    : step === 1 ? viewChoose() : step === 2 ? viewLook() : step === 3 ? viewPlan() : viewDone();
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g,
  (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const escapeAttr = escapeHtml;

// ── events ───────────────────────────────────────────────────────────────────
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.go) return browse(b.dataset.go);
  if (b.dataset.up) return browse(browsing.parent ?? null);
  if (b.dataset.choose) { folder = browsing.path; return enter(); }
  if (b.dataset.full) { showFull = !showFull; return render(); }
  if (b.dataset.retry) { error = null; return startPlan(); }
  if (b.dataset.sort) return askToSort();
  if (b.dataset.panelRun) return panelRun(b.dataset.panelRun);
  if (b.dataset.reveal) return reveal(b.dataset.reveal);
  if (b.dataset.rechoose) { panel = null; folder = null; step = 1; render(); return browse(null); }
  if (b.id === 'lang') { lang = lang === 'ru' ? 'en' : 'ru'; localStorage.setItem('kpot-lang', lang); return render(); }
  if (b.id === 'shutdown') {
    await api('/api/shutdown', { method: 'POST' });
    el('card').innerHTML = '<h2>' + t('shutdownDone') + '</h2>';
    return;
  }
});

async function startPlan() {
  step = 2; pct = 0; busyLabel = null; error = null; render();
  const r = await api('/api/run', { method: 'POST', body: JSON.stringify({ kind: 'plan', root: folder }) });
  if (!r.ok) { error = r.message; render(); }
}

function askToSort() {
  const moves = plan?.plan?.counts?.moves ?? 0;
  el('c-title').textContent = t('confirmTitle');
  el('c-body').textContent = t('confirmBody', moves);
  el('c-cancel').textContent = t('confirmCancel');
  el('c-go').textContent = t('confirmGo');
  el('confirm').showModal();
}
el('c-cancel').addEventListener('click', () => el('confirm').close());
el('c-go').addEventListener('click', async () => {
  el('confirm').close();
  step = 2; pct = 0; error = null; render();
  const r = await api('/api/run', { method: 'POST',
    body: JSON.stringify({ kind: 'apply', root: folder, confirmed: true }) });
  if (!r.ok) { error = r.message; render(); }
});

// Live news from the server. The connection may drop when the machine sleeps; the browser
// reconnects by itself, and /api/state is how we catch up on what happened meanwhile.
const events = new EventSource('/api/events?token=' + encodeURIComponent(token));
events.addEventListener('progress', (e) => {
  const d = JSON.parse(e.data);
  busyLabel = d.label;
  pct = d.total > 0 ? Math.min(100, Math.round((d.count / d.total) * 100)) : 0;
  if (step === 2) render();
});
events.addEventListener('job-finished', async (e) => {
  const job = JSON.parse(e.data);
  if (job.state === 'failed') { error = job.error; step = 2; return render(); }
  if (job.kind === 'plan') {
    plan = await api('/api/plan-report');
    step = 3;
  } else if (job.kind === 'apply') {
    applyResult = { result: job.result };
    // A sort started FROM the panel returns to the panel — the wizard's «Готово» screen is the end
    // of a first flight, not of every routine top-up. The year list is re-read because it changed.
    if (panel?.isLibrary) {
      panel = await api('/api/library?root=' + encodeURIComponent(folder));
      step = 0;
    } else {
      step = 4;
    }
  }
  render();
});

render();
browse(null);
</script>
</body></html>`;
}
