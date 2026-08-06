// auth.js — thin client for the accounts API (Cloudflare Pages Functions + D1).
// Best-effort and offline-safe: if the API is unreachable (e.g. local static
// server, or offline), every call fails silently and the app keeps working
// from localStorage. Server sync only ADDS the ability for the admin to see
// each user's exam-attempt history.

const EngAuth = (function () {
  const STORE_KEY = 'flashlingo_accounts'; // { [username]: { token, role, id } }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function setAccount(username, data) {
    const s = loadStore();
    s[username] = Object.assign({}, s[username] || {}, data);
    saveStore(s);
  }
  function clearAccount(username) {
    const s = loadStore();
    delete s[username];
    saveStore(s);
  }
  function getAccount(username) { return loadStore()[username] || null; }
  function tokenFor(username) { const a = getAccount(username); return a && a.token; }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    const res = await fetch('/api/' + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // Establish/refresh a server account for a local profile using its passcode,
  // then sync any unsynced local history. Called on every login (fire-and-forget).
  async function syncAccount(username, passcode) {
    if (!username || !passcode) return;
    if (!tokenFor(username)) {
      try {
        let r = await api('register', { method: 'POST', body: { username, passcode } });
        if (r.status === 409) {
          r = await api('login', { method: 'POST', body: { username, passcode } });
        }
        if (r.ok && r.data && r.data.token) {
          setAccount(username, { token: r.data.token, role: r.data.user.role, id: r.data.user.id });
        }
      } catch (e) { return; /* offline — nothing to do */ }
    }
    syncNow();
  }

  // Build the active user's local learning history (last 30 days) as activity items.
  function _localHistoryItems() {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const items = [];
    const add = (o) => { if (o && Number.isFinite(+o.at) && +o.at >= cutoff) items.push(o); };
    if (typeof appState === 'undefined' || !appState) return items;

    (appState.lessonHistory || []).forEach(h => add({
      type: 'lesson', title: 'Vocabulary lesson #' + ((h.lessonNum || 0) + 1),
      score: Math.round((h.accuracy || 0) / 100 * 5), total: 5,
      at: h.date, detail: { accuracy: h.accuracy },
    }));
    (appState.grammarHistory || []).forEach(h => {
      let name = h.unitId;
      try { const u = getGrammarUnit(h.unitId); if (u && u.name) name = u.name; } catch (e) {}
      add({ type: 'grammar', title: 'Grammar: ' + name, score: h.score, total: h.total, at: h.date, detail: { unitId: h.unitId } });
    });
    (appState.phrasesHistory || []).forEach(h => add({
      type: 'phrases', title: 'Phrases practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
    }));
    (appState.wordformHistory || []).forEach(h => add({
      type: 'wordform', title: 'Word form practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
    }));
    (appState.rewriteHistory || []).forEach(h => add({
      type: 'rewrite', title: 'Rewrite practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
    }));
    (appState.collocHistory || []).forEach(h => add({
      type: 'collocation', title: 'Collocation practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
    }));
    (appState.unitsHistory || []).forEach(h => add({
      type: 'lesson',
      title: (h.unit === 'mix' ? 'Mix 12 units' : 'Unit ' + h.unit) + ' words practice',
      score: h.score, total: h.total, at: h.date,
    }));
    ((appState.speedChallenge && appState.speedChallenge.history) || []).forEach(h => add({
      type: 'verbs', title: 'Verbs challenge (' + (h.level || '') + ')',
      score: h.correct, total: h.total, at: h.date, detail: { score: h.score },
    }));
    return items;
  }

  // Upload any local history not yet synced for the active user. Idempotent:
  // client-side de-dup via stored keys + server-side OR IGNORE. Used by the
  // completion hooks, on login, and by the manual "Sync now" button.
  // Returns { ok, synced, total, reason? }.
  async function syncNow() {
    const u = (typeof currentUser !== 'undefined') ? currentUser : null;
    const acct = u ? getAccount(u) : null;
    if (!acct || !acct.token) return { ok: false, reason: 'no-account' };

    const all = _localHistoryItems();
    const synced = new Set(acct.syncedKeys || []);
    const keyOf = (o) => o.type + '|' + o.at;
    const items = all.filter(o => !synced.has(keyOf(o)));
    if (!items.length) return { ok: true, synced: 0, total: all.length };

    items.sort((a, b) => b.at - a.at);
    const batch = items.slice(0, 400);
    try {
      const r = await api('activity', { method: 'POST', token: acct.token, body: { items: batch } });
      if (r.status === 401) { clearAccount(u); return { ok: false, reason: 'auth' }; }
      if (r.ok) {
        batch.forEach(o => synced.add(keyOf(o)));
        setAccount(u, { syncedKeys: Array.from(synced).slice(-2000) });
        return { ok: true, synced: batch.length, total: all.length };
      }
      return { ok: false, reason: 'server' };
    } catch (e) { return { ok: false, reason: 'offline' }; }
  }

  // Send one finished exam attempt for the currently active local user.
  async function postAttempt(attempt) {
    const u = (typeof currentUser !== 'undefined') ? currentUser : null;
    const token = u ? tokenFor(u) : null;
    if (!token || !attempt) return;
    try {
      const r = await api('attempts', { method: 'POST', token, body: attempt });
      if (r.status === 401) clearAccount(u); // token expired → re-sync next login
    } catch (e) { /* offline — ignore, it's saved locally anyway */ }
  }

  // Used by the admin dashboard.
  async function login(username, passcode) {
    return api('login', { method: 'POST', body: { username, passcode } });
  }

  return { syncAccount, postAttempt, syncNow, tokenFor, getAccount, clearAccount, api, login };
})();

// Manual "Sync now" button handler (home screen). Spins the icon and toasts the result.
async function syncNowUI() {
  const btn = document.getElementById('syncBtn');
  if (typeof EngAuth === 'undefined') { if (typeof showToast === 'function') showToast('Sync unavailable'); return; }
  if (btn) { btn.classList.remove('ok'); btn.classList.add('syncing'); btn.disabled = true; }
  let res;
  try { res = await EngAuth.syncNow(); } catch (e) { res = { ok: false, reason: 'error' }; }
  if (btn) { btn.classList.remove('syncing'); btn.disabled = false; }
  const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
  if (res && res.ok) {
    if (btn) { btn.classList.add('ok'); setTimeout(() => btn && btn.classList.remove('ok'), 2000); }
    toast(res.synced > 0 ? ('✅ Synced ' + res.synced + ' activities') : '✅ Already up to date');
  } else {
    const r = res && res.reason;
    toast(r === 'no-account' ? 'Log in with a passcode first to sync'
      : r === 'offline' ? '⚠️ Offline — try again later'
      : r === 'auth' ? '⚠️ Session expired — log in again'
      : '⚠️ Sync failed');
  }
}
