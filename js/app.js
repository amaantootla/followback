import { compareRelationshipSets } from './comparator.js';
import { importFiles, filesFromDataTransfer, filesFromInput } from './importer.js';
import { buildDemoData } from './sampleData.js';

const PAGE_SIZE = 300;
const OPENED_KEY = 'followback:opened';
const KINDS = ['followers', 'following', 'pending'];

const TABS = {
  notFollowingBack: {
    desc: 'People you follow who don’t follow you back',
    empty: 'Everyone you follow follows you back.',
    dateFrom: 'following', datePrefix: 'You followed',
  },
  notFollowedBack: {
    desc: 'People who follow you that you don’t follow back',
    empty: 'You follow back everyone who follows you.',
    dateFrom: 'followers', datePrefix: 'Followed you',
  },
  mutuals: {
    desc: 'You follow each other',
    empty: 'No mutual follows yet.',
    dateFrom: 'following', datePrefix: 'You followed',
  },
  pending: {
    desc: 'Follow requests you sent that haven’t been accepted yet',
    empty: 'No pending requests.',
    dateFrom: 'pending', datePrefix: 'Requested',
  },
};

// ---------- state ----------
const state = {
  followers: null,
  following: null,
  pending: null,
  sources: { followers: [], following: [], pending: [] },
  isDemo: false,
  comparison: null,
  tab: 'notFollowingBack',
  query: '',
  sort: 'az',
  limit: PAGE_SIZE,
  busy: false,
};

const opened = loadOpened();

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const el = {
  intake: $('intake'), results: $('results'), resetBtn: $('reset-btn'),
  dropzone: $('dropzone'), fileInput: $('file-input'), folderInput: $('folder-input'), folderBtn: $('folder-btn'),
  progress: $('dz-progress'), intakeError: $('intake-error'), checklist: $('checklist'), demoBtn: $('demo-btn'),
  summary: $('summary'), sourceLine: $('source-line'), notice: $('notice'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  search: $('search-input'), sort: $('sort-select'), copyBtn: $('copy-btn'), downloadBtn: $('download-btn'),
  listMeta: $('list-meta'), list: $('list'), listEmpty: $('list-empty'), moreBtn: $('more-btn'),
  overlay: $('drop-overlay'), toast: $('toast'),
};

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const num = (n) => n.toLocaleString();

// ---------- persistence (per-browser convenience only) ----------
function loadOpened() {
  try { return new Set(JSON.parse(localStorage.getItem(OPENED_KEY) || '[]')); } catch { return new Set(); }
}
function saveOpened() {
  try { localStorage.setItem(OPENED_KEY, JSON.stringify([...opened])); } catch { /* storage unavailable */ }
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

// ---------- import ----------
async function handleItems(itemsPromise) {
  if (state.busy) return;
  setBusy(true, 'Reading…');
  el.intakeError.hidden = true;
  try {
    const items = await itemsPromise;
    if (!items.length) throw new Error('Nothing to read there.');
    const res = await importFiles(items, (msg) => { el.progress.textContent = msg; });

    const foundAny = KINDS.some((k) => res[k]);
    if (!foundAny) {
      throw new Error(res.errors[0] ||
        'Couldn’t find followers or following in that. Make sure your export includes “Followers and following”.');
    }

    if (state.isDemo) clearData();
    for (const kind of KINDS) {
      if (!res[kind]) continue;
      state[kind] = res[kind];
      state.sources[kind] = res.sources.filter((s) => s.kind === kind).map((s) => s.path);
    }
    state.isDemo = false;
    if (res.errors.length) toast(res.errors[0]);
    onDataChanged();
  } catch (err) {
    console.error(err);
    showIntakeError(err.message || 'Something went wrong reading that file.');
  } finally {
    setBusy(false);
  }
}

function setBusy(busy, msg) {
  state.busy = busy;
  el.dropzone.classList.toggle('is-busy', busy);
  el.dropzone.setAttribute('aria-busy', String(busy));
  if (msg) el.progress.textContent = msg;
}

function showIntakeError(msg) {
  if (document.body.dataset.view !== 'intake') { toast(msg); return; }
  el.intakeError.textContent = msg;
  el.intakeError.hidden = false;
}

function clearData() {
  for (const k of KINDS) { state[k] = null; state.sources[k] = []; }
  state.comparison = null;
  state.isDemo = false;
}

function loadDemo() {
  const demo = buildDemoData();
  clearData();
  Object.assign(state, demo, { isDemo: true });
  state.sources = { followers: ['sample'], following: ['sample'], pending: ['sample'] };
  onDataChanged();
}

function startOver() {
  clearData();
  el.fileInput.value = '';
  el.folderInput.value = '';
  el.intakeError.hidden = true;
  el.search.value = '';
  state.query = '';
  onDataChanged();
  window.scrollTo({ top: 0 });
}

function onDataChanged() {
  const ready = Boolean(state.followers && state.following);
  if (ready) {
    state.comparison = compareRelationshipSets(state.followers, state.following);
    state.comparison.lists.pending = [...(state.pending?.keys() || [])].sort((a, b) => a.localeCompare(b));
    if (state.tab === 'pending' && !state.comparison.lists.pending.length) state.tab = 'notFollowingBack';
    state.limit = PAGE_SIZE;
    showView('results');
    renderResults();
  } else {
    state.comparison = null;
    showView('intake');
    renderChecklist();
  }
}

function showView(view) {
  document.body.dataset.view = view;
  el.intake.hidden = view !== 'intake';
  el.results.hidden = view !== 'results';
  el.resetBtn.hidden = view !== 'results';
}

// ---------- intake rendering ----------
function renderChecklist() {
  const anything = KINDS.some((k) => state[k]);
  el.checklist.hidden = !anything;
  if (!anything) return;
  for (const li of el.checklist.children) {
    const kind = li.dataset.kind;
    const map = state[kind];
    const detail = li.querySelector('.check-detail');
    li.classList.toggle('is-done', Boolean(map));
    if (map) {
      detail.textContent = `${num(map.size)} accounts · ${shortSource(state.sources[kind])}`;
    } else {
      detail.textContent = kind === 'followers'
        ? 'Missing. Drop followers_1.json or the whole zip.'
        : 'Missing. Drop following.json or the whole zip.';
    }
  }
}

function shortSource(paths) {
  if (!paths.length) return '';
  const names = paths.map((p) => p.split(/[/›]/).pop().trim());
  return names.length === 1 ? names[0] : `${names.length} files`;
}

// ---------- results rendering ----------
function renderResults() {
  const { stats, lists } = state.comparison;

  el.summary.innerHTML = '';
  el.summary.append(
    'You follow ', strong(num(stats.followingCount)), ' accounts and ',
    strong(num(stats.followersCount)), ` ${stats.followersCount === 1 ? 'follows' : 'follow'} you.`,
  );
  el.sourceLine.textContent = state.isDemo ? 'Showing sample data.' : `From ${describeSources()}`;

  renderNotice();

  for (const tab of el.tabs) {
    const key = tab.dataset.tab;
    tab.querySelector('.tab-count').textContent = num(lists[key].length);
    if (key === 'pending') tab.hidden = lists.pending.length === 0;
    const selected = key === state.tab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  el.list.setAttribute('aria-labelledby', `tab-${state.tab}`);

  renderList();
}

function strong(text) {
  const s = document.createElement('strong');
  s.textContent = text;
  return s;
}

function describeSources() {
  const zips = new Set();
  const files = new Set();
  for (const k of KINDS) {
    for (const p of state.sources[k]) {
      if (p.includes(' › ')) zips.add(p.split(' › ')[0]);
      else files.add(p.split('/').pop());
    }
  }
  return [...zips, ...files].join(', ');
}

/** Warn when the export looks date-limited (Instagram defaults to "last year"). */
function renderNotice() {
  const stamps = [];
  for (const k of ['followers', 'following']) {
    for (const ts of state[k].values()) if (ts) stamps.push(ts);
  }
  const yearAgo = Date.now() / 1000 - 380 * 24 * 3600;
  const looksLimited = !state.isDemo && stamps.length >= 30 && stamps.every((ts) => ts > yearAgo);
  el.notice.hidden = !looksLimited;
  if (looksLimited) {
    el.notice.innerHTML = '<strong>These results may be incomplete.</strong> Everything in this export is from the past year. If your account is older, re-export with <b>Date range: All time</b>.';
  }
}

function currentRows() {
  const cfg = TABS[state.tab];
  const dates = state[cfg.dateFrom] || new Map();
  const q = state.query.trim().toLowerCase().replace(/^@/, '');
  let rows = state.comparison.lists[state.tab];
  if (q) rows = rows.filter((u) => u.includes(q));
  rows = rows.map((u) => ({ username: u, ts: dates.get(u) ?? null }));
  if (state.sort !== 'az') {
    const dir = state.sort === 'newest' ? -1 : 1;
    rows = rows.slice().sort((a, b) => {
      if (a.ts === b.ts) return a.username.localeCompare(b.username);
      if (a.ts === null) return 1;
      if (b.ts === null) return -1;
      return (a.ts - b.ts) * dir;
    });
  }
  return rows;
}

function renderList() {
  const cfg = TABS[state.tab];
  const all = state.comparison.lists[state.tab];
  const rows = currentRows();
  const q = state.query.trim().toLowerCase().replace(/^@/, '');

  // Hide date sorting when this list has no dates (e.g. HTML exports).
  const dates = state[cfg.dateFrom];
  const hasDates = Boolean(dates) && all.some((u) => dates.get(u));
  el.sort.hidden = !hasDates;
  if (!hasDates && state.sort !== 'az') { state.sort = 'az'; el.sort.value = 'az'; }

  const openedCount = all.reduce((n, u) => n + (opened.has(u) ? 1 : 0), 0);
  el.listMeta.textContent = q
    ? `${num(rows.length)} of ${num(all.length)} match “${q}”`
    : `${cfg.desc}${openedCount ? ` · ${num(openedCount)} of ${num(all.length)} opened` : ''}`;

  el.copyBtn.disabled = el.downloadBtn.disabled = rows.length === 0;

  el.list.textContent = '';
  if (!rows.length) {
    el.listEmpty.hidden = false;
    el.listEmpty.textContent = q ? `No usernames match “${q}”.` : cfg.empty;
    el.moreBtn.hidden = true;
    return;
  }
  el.listEmpty.hidden = true;

  const frag = document.createDocumentFragment();
  for (const row of rows.slice(0, state.limit)) frag.append(renderRow(row, cfg, q));
  el.list.append(frag);

  const remaining = rows.length - state.limit;
  el.moreBtn.hidden = remaining <= 0;
  if (remaining > 0) el.moreBtn.textContent = `Show ${num(Math.min(remaining, PAGE_SIZE * 3))} more`;
}

function renderRow({ username, ts }, cfg, q) {
  const li = document.createElement('li');
  li.className = 'row' + (opened.has(username) ? ' is-opened' : '');

  const a = document.createElement('a');
  a.className = 'row-link';
  a.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.username = username;

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = (username.match(/[a-z0-9]/) || ['?'])[0].toUpperCase();

  const main = document.createElement('span');
  main.className = 'row-main';
  const name = document.createElement('span');
  name.className = 'row-name';
  appendHighlighted(name, username, q);
  main.append(name);
  if (ts) {
    const sub = document.createElement('span');
    sub.className = 'row-sub';
    sub.textContent = `${cfg.datePrefix} ${dateFmt.format(ts * 1000)}`;
    main.append(sub);
  }

  const action = document.createElement('span');
  action.className = 'row-action';
  action.innerHTML = '<span class="when-opened">Opened</span><span class="when-new">Open</span>'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h9v9"/><path d="M18 6L6 18"/></svg>';

  a.append(avatar, main, action);
  li.append(a);
  return li;
}

function appendHighlighted(parent, text, q) {
  const i = q ? text.indexOf(q) : -1;
  if (i < 0) { parent.textContent = text; return; }
  const mark = document.createElement('mark');
  mark.textContent = text.slice(i, i + q.length);
  parent.append(text.slice(0, i), mark, text.slice(i + q.length));
}

// ---------- actions ----------
function selectTab(key, focus = false) {
  state.tab = key;
  state.limit = PAGE_SIZE;
  renderResults();
  if (focus) document.getElementById(`tab-${key}`).focus();
}

function copyList() {
  const rows = currentRows();
  if (!rows.length) return;
  navigator.clipboard.writeText(rows.map((r) => r.username).join('\n'))
    .then(() => toast(`Copied ${num(rows.length)} username${rows.length === 1 ? '' : 's'}`))
    .catch(() => toast('Couldn’t access the clipboard.'));
}

function downloadCsv() {
  const rows = currentRows();
  if (!rows.length) return;
  const cfg = TABS[state.tab];
  const header = `username,profile_url,${cfg.datePrefix.toLowerCase().replace(/ /g, '_')}`;
  const lines = rows.map((r) => [
    r.username,
    `https://www.instagram.com/${r.username}/`,
    r.ts ? new Date(r.ts * 1000).toISOString().slice(0, 10) : '',
  ].join(','));
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = { notFollowingBack: 'dont-follow-back', notFollowedBack: 'you-dont-follow-back', mutuals: 'mutuals', pending: 'pending-requests' }[state.tab];
  a.href = url;
  a.download = `instagram-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- drag & drop (whole window) ----------
function setupDragAndDrop() {
  let depth = 0;
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (depth++ === 0) document.body.classList.add('is-dragging');
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    if (--depth <= 0) { depth = 0; document.body.classList.remove('is-dragging'); }
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('is-dragging');
    handleItems(filesFromDataTransfer(e.dataTransfer));
  });
}

// ---------- init ----------
function init() {
  setupDragAndDrop();

  el.dropzone.addEventListener('click', () => { if (!state.busy) el.fileInput.click(); });
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
  });
  el.folderBtn.addEventListener('click', (e) => { e.stopPropagation(); el.folderInput.click(); });
  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files.length) handleItems(Promise.resolve(filesFromInput(el.fileInput.files)));
    el.fileInput.value = '';
  });
  el.folderInput.addEventListener('change', () => {
    if (el.folderInput.files.length) handleItems(Promise.resolve(filesFromInput(el.folderInput.files)));
    el.folderInput.value = '';
  });

  el.demoBtn.addEventListener('click', loadDemo);
  el.resetBtn.addEventListener('click', startOver);

  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const visible = el.tabs.filter((t) => !t.hidden);
      const i = visible.indexOf(tab);
      const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
      selectTab(next.dataset.tab, true);
    });
  });

  el.search.addEventListener('input', () => {
    state.query = el.search.value;
    state.limit = PAGE_SIZE;
    renderList();
  });
  el.sort.addEventListener('change', () => {
    state.sort = el.sort.value;
    renderList();
  });
  el.copyBtn.addEventListener('click', copyList);
  el.downloadBtn.addEventListener('click', downloadCsv);
  el.moreBtn.addEventListener('click', () => {
    state.limit += PAGE_SIZE * 3;
    renderList();
  });

  // Mark profiles as opened so you can work through a long list.
  el.list.addEventListener('click', (e) => {
    const link = e.target.closest('.row-link');
    if (!link) return;
    const u = link.dataset.username;
    if (!opened.has(u)) {
      opened.add(u);
      saveOpened();
      link.parentElement.classList.add('is-opened');
      // Update the counter without re-rendering the list.
      const cfg = TABS[state.tab];
      const all = state.comparison.lists[state.tab];
      if (!state.query.trim()) {
        const n = all.reduce((c, x) => c + (opened.has(x) ? 1 : 0), 0);
        el.listMeta.textContent = `${cfg.desc} · ${num(n)} of ${num(all.length)} opened`;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || document.body.dataset.view !== 'results') return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    e.preventDefault();
    el.search.focus();
  });

  onDataChanged();
}

init();
