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

  // Establish/refresh a server account for a local profile using its passcode.
  // Called on every login (fire-and-forget). No-op if we already hold a token.
  async function syncAccount(username, passcode) {
    if (!username || !passcode) return;
    if (tokenFor(username)) return; // already linked on this device
    try {
      let r = await api('register', { method: 'POST', body: { username, passcode } });
      if (r.status === 409) {
        r = await api('login', { method: 'POST', body: { username, passcode } });
      }
      if (r.ok && r.data && r.data.token) {
        setAccount(username, { token: r.data.token, role: r.data.user.role, id: r.data.user.id });
      }
    } catch (e) { /* offline / no API — ignore */ }
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

  // Log one non-exam learning activity (lesson, grammar, phrases, verbs, review…)
  // for the currently active local user. Best-effort / offline-safe.
  async function logActivity(activity) {
    const u = (typeof currentUser !== 'undefined') ? currentUser : null;
    const token = u ? tokenFor(u) : null;
    if (!token || !activity || !activity.type) return;
    try {
      const r = await api('activity', { method: 'POST', token, body: activity });
      if (r.status === 401) clearAccount(u);
    } catch (e) { /* offline — ignore */ }
  }

  // Used by the admin dashboard.
  async function login(username, passcode) {
    return api('login', { method: 'POST', body: { username, passcode } });
  }

  return { syncAccount, postAttempt, logActivity, tokenFor, getAccount, clearAccount, api, login };
})();
