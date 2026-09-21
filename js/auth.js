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
    // The token goes; the un-acked coin receipts STAY. They are the only proof
    // this device already banked a grant, and a 401 (which is what usually
    // brings us here) used to throw them away while appState.coins kept the
    // coins — so the next login re-claimed the same grant with an empty
    // ackReceipts list and was paid twice. Since Cướp Đêm now settles the
    // sleeping side through coin_grants, the same slip would DEBIT twice.
    const pending = s[username] && Array.isArray(s[username].pendingCoinReceipts)
      ? s[username].pendingCoinReceipts.slice(0, 20) : [];
    delete s[username];
    if (pending.length) s[username] = { pendingCoinReceipts: pending };
    saveStore(s);
  }
  function getAccount(username) { return loadStore()[username] || null; }
  function tokenFor(username) { const a = getAccount(username); return a && a.token; }

  // ---- device identity ----
  // One opaque random id per install, created on first use and kept forever.
  // The server counts accounts per device from it (max 2), so a throwaway
  // opponent is not one "new profile" away.
  //
  // It is deliberately NOT a fingerprint and NOT tied to the IP: neither
  // belongs in a children's app, and an IP cap would lock out siblings and
  // classmates on one home or school network. Clearing site data resets it —
  // a known limit, covered by the 3-day wait before a new friend can battle.
  // How many profiles this device may hold. MUST equal
  // MAX_ACCOUNTS_PER_DEVICE in functions/api/_lib.js — the server is the
  // enforcement, this only stops the app from offering a form that would be
  // refused. The two live in different runtimes and cannot share a module, so
  // tests/device-account-limit.test.js reads both files and fails if they
  // ever disagree.
  const MAX_DEVICE_PROFILES = 2;

  const DEVICE_KEY = 'flashlingo_device_id';
  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      // Must satisfy the server's shape check, or every signup would be
      // refused with "missing device id" and the child could never register.
      if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
      id = 'd' + _randomIdHex(24);
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) {
      // Private mode with storage disabled: no stable id is possible. Send a
      // fresh one rather than nothing, so registration still works — the cap
      // simply cannot bind on a device that forgets everything anyway.
      return 'd' + _randomIdHex(24);
    }
  }
  function _randomIdHex(nBytes) {
    try {
      const a = new Uint8Array(nBytes);
      crypto.getRandomValues(a);
      return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let out = '';
      while (out.length < nBytes * 2) out += Math.random().toString(16).slice(2);
      return out.slice(0, nBytes * 2);
    }
  }

  // THE username rule, mirrored from functions/api/register.js. Checked when
  // the profile is CREATED, so the app can never make a name the server will
  // refuse. That failure used to surface much later, on another screen, long
  // after the name was baked into a profile full of progress.
  const USERNAME_RE = /^[\p{L}\p{M}\p{N} ._\-]+$/u;
  function validUsername(name) {
    const n = String(name || '').trim();
    if (n.length < 1 || n.length > 30) return { ok: false, error: 'Tên phải từ 1 đến 30 ký tự' };
    if (!USERNAME_RE.test(n)) return { ok: false, error: 'Tên chỉ dùng chữ, số, dấu cách, dấu chấm hoặc gạch ngang' };
    return { ok: true };
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    // js/hosting.js: same-origin on Cloudflare, the learn-eng-pwa-api
    // project when the page is served from GitHub Pages.
    const url = (typeof Hosting !== 'undefined') ? Hosting.apiUrl(path) : '/api/' + path;
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // Why a profile has no server token. Kept so the UI can say something
  // useful instead of a blank "please sign in".
  //   ok | no-passcode | bad-passcode | offline | server
  let _lastLinkStatus = { reason: 'unknown' };
  function linkStatus() { return _lastLinkStatus; }
  // SILENT teardown for a profile change. This is not a private diagnostic:
  // it used to be turned into a sentence the learner reads —
  // "Tên này đã có tài khoản trên máy chủ với mật mã khác", "Máy này đã tạo đủ
  // số tài khoản cho phép". Left standing, the NEXT child was shown the reason
  // the PREVIOUS child's link failed, about a name that is not theirs, for as
  // long as their own syncAccount took to answer. 'unknown' is the honest
  // state for a link that has not been attempted yet.
  function forgetProfile() { _lastLinkStatus = { reason: 'unknown' }; }

  // Establish/refresh a server account for a local profile using its passcode,
  // then sync any unsynced local history. Called on every login.
  // Returns { ok, reason } — failures used to be swallowed, which left the
  // a screen telling a signed-in learner to sign in.
  async function syncAccount(username, passcode) {
    if (!username) return (_lastLinkStatus = { ok: false, reason: 'no-user' });
    if (!passcode) return (_lastLinkStatus = { ok: false, reason: 'no-passcode' });
    if (!tokenFor(username)) {
      try {
        let r = await api('register', { method: 'POST', body: { username, passcode, deviceId: deviceId() } });
        if (r.status === 409) {
          // The name is taken on the server — only the right passcode links it.
          r = await api('login', { method: 'POST', body: { username, passcode } });
          if (r.status === 401) return (_lastLinkStatus = { ok: false, reason: 'bad-passcode' });
        }
        if (r.ok && r.data && r.data.token) {
          setAccount(username, { token: r.data.token, role: r.data.user.role, id: r.data.user.id });
        } else {
          // Keep the server's own words (e.g. an invalid-name rejection) —
          // a generic "server busy" sent us hunting in the wrong place.
          const detail = (r.data && r.data.error) ? String(r.data.error) : '';
          const code = (r.data && r.data.code) ? String(r.data.code) : '';
          // "Try again after updating the app" is the wrong advice for a
          // device that has simply used up its two accounts — nothing the
          // child can do fixes it, so it gets its own reason and its own text.
          const reason = code === 'device_limit' ? 'device-limit'
            : (r.status >= 400 && r.status < 500) ? 'rejected' : 'server';
          return (_lastLinkStatus = { ok: false, reason, status: r.status, detail });
        }
      } catch (e) {
        return (_lastLinkStatus = { ok: false, reason: 'offline' });
      }
    }
    syncNow();
    // Rebuild the trophy cabinet from the server's battle record. Fire and
    // forget: a fresh install should already show its cups by the time the
    // child opens Profile.
    claimCoinGrants(username);
    syncAssets(username);
    return (_lastLinkStatus = { ok: true, reason: 'ok' });
  }

  // ---- a debit that could not be paid is not a debit that is forgiven ----
  //
  // `Math.max(0, wallet + delta)` looks harmless and silently prints money.
  // Cướp Đêm settles the sleeping defender through coin_grants, and the amount
  // is computed from night_raid_homes.lootable_coins — a MIRROR that only
  // moves on a syncHome PUT, while the shop, the armoury, the cups, lessons
  // and exams all move the real wallet without telling any server. So the
  // mirror sits stale HIGH, the attacker is credited from it, and the clamp
  // destroys the part of the debt the victim's real purse could not cover:
  //
  //     mirror 5000, real wallet 30, reward 100
  //     attacker +100, victim -30       →  70 xu created from nothing
  //
  // So the remainder is CARRIED. The wallet still never shows a negative
  // number to a child; the shortfall waits in appState.coinDebt and is taken
  // out of what they earn next. Bounded by the raid config's win_cap, and
  // settled on every account sync.
  function coinDebt() {
    const d = Math.trunc(+(appState && appState.coinDebt) || 0);
    return d > 0 ? d : 0;
  }
  function applySignedGrant(delta) {
    const wallet = Math.max(0, Math.trunc(+appState.coins || 0));
    const after = wallet + Math.trunc(delta || 0);
    if (after < 0) {
      appState.coins = 0;
      appState.coinDebt = coinDebt() + (-after);
      return;
    }
    appState.coins = after;
    settleCoinDebt();
  }
  // Pay down what is owed, as far as the purse goes. Returns true when
  // anything moved, so the caller knows to save.
  function settleCoinDebt() {
    const owed = coinDebt();
    if (!owed) return false;
    const wallet = Math.max(0, Math.trunc(+appState.coins || 0));
    const pay = Math.min(owed, wallet);
    if (!pay) return false;
    appState.coins = wallet - pay;
    appState.coinDebt = owed - pay;
    return true;
  }

  // Coin adjustments are server-side IOUs (coin_grants): claim every
  // unclaimed row once, apply the signed total to this device's wallet, and
  // ACK with the claim's receipt once the coins are durably saved — the
  // receipt protocol (db/015). If anything dies between the server stamping
  // the rows and this device saving the wallet, the claim is simply never
  // acked and the server offers the same coins again after its window.
  // Fire-and-forget from syncAccount — offline just leaves the IOU waiting.
  function _pendingReceipts(username) {
    const a = getAccount(username);
    return (a && Array.isArray(a.pendingCoinReceipts)) ? a.pendingCoinReceipts : [];
  }
  function coinGrantMessage(adjustment) {
    const amount = Math.trunc(Number(adjustment && adjustment.amount) || 0);
    const note = String(adjustment && adjustment.note || '').trim();
    const signed = (amount > 0 ? '+' : '') + amount + ' xu';
    if (/^Daily task \d{4}-\d{2}-\d{2}$/.test(note)) {
      return '🎉 Hoàn thành Daily Task được tặng ' + amount + ' xu!';
    }
    // Both spellings: grants written before the copy moved from "con" to
    // "bạn" are still claimable.
    if (/^Cướp Đêm: (con|bạn) giữ được nhà$/.test(note)) {
      return '🏰 Giữ thành ' + signed + ' · nhà bạn đã đẩy lui kẻ cướp';
    }
    if (/^Cướp Đêm: nhà (con|bạn) bị cướp$/.test(note)) {
      return '🌙 Nhà bạn đã bị cướp · ' + signed;
    }
    if (/^Ghost offering:/.test(note)) {
      return '👻 Thưởng sự kiện Cúng Cô Hồn · ' + signed;
    }
    // A manual adjustment may carry a useful reason entered by the parent.
    // Remove legacy wording that attributes it to “Admin”; child-facing copy
    // should explain the event, not expose an implementation role.
    const reason = note
      .replace(/^admin\s*(?:tặng|tang|grant(?:ed)?)?\s*(?:bạn|ban|con)?\s*[:\-–—]?\s*/i, '')
      .trim();
    if (amount > 0) return '🎁 ' + (reason || 'Bạn nhận được phần thưởng') + ' · ' + signed;
    return '🧾 ' + (reason || 'Điều chỉnh số dư') + ' · ' + signed;
  }
  async function claimCoinGrants(username) {
    const token = tokenFor(username);
    if (!token) return;
    try {
      // Receipts from earlier claims whose ack never got through ride along
      // with this claim, so a lost ack is repaired on the very next sync.
      const pending = _pendingReceipts(username);
      // `device` scopes the server's re-offer window to THIS install, so a
      // second phone on the same account can never be handed a grant this one
      // has already claimed but not yet acked (functions/api/coins.js).
      const r = await api('coins', { method: 'POST', token, body: { proto: 2, ackReceipts: pending, device: deviceId() } });
      if (r.ok && pending.length) setAccount(username, { pendingCoinReceipts: [] });
      const granted = r.ok && r.data ? Math.trunc(+r.data.granted || 0) : 0;
      const dailyTaskGranted = r.ok && r.data ? Math.trunc(+r.data.dailyTaskGranted || 0) : 0;
      const adjustments = r.ok && r.data && Array.isArray(r.data.adjustments)
        ? r.data.adjustments : [];
      const receipt = (r.ok && r.data && typeof r.data.receipt === 'string' && r.data.receipt) || null;
      if (typeof appState === 'undefined' || !appState) return;
      if (typeof currentUser === 'undefined' || currentUser !== username) return;
      // A receipt means ROWS were claimed, which is not the same as a non-zero
      // total: a batch of +100 and -100 nets to zero and still has to be
      // acked, or the server keeps re-offering it forever. So the receipt is
      // handled whatever `granted` says, and only the wallet write is skipped.
      //
      // It is stored DURABLY before the wallet write: if anything below dies,
      // the next sync still acks it. (And if we die before even this line, the
      // un-acked claim is re-offered by the server instead.)
      if (receipt) setAccount(username, { pendingCoinReceipts: _pendingReceipts(username).concat(receipt) });
      if (granted) {
        applySignedGrant(granted);
        if (typeof saveUserData === 'function') saveUserData(currentUser, appState);
      }
      // Whatever a past debit could not take is collected here, on every sync.
      else if (settleCoinDebt()) {
        if (typeof saveUserData === 'function') saveUserData(currentUser, appState);
      }
      if (receipt) {
        try {
          const a = await api('coins', { method: 'POST', token, body: { ackOnly: true, ackReceipts: [receipt] } });
          if (a.ok) setAccount(username, { pendingCoinReceipts: _pendingReceipts(username).filter(x => x !== receipt) });
        } catch (e) { /* the stored receipt is acked on the next sync */ }
      }
      if (!granted) return;
      if (typeof showToast === 'function') {
        if (adjustments.length) {
          showToast(adjustments.map(coinGrantMessage).join(' · '));
        } else if (granted > 0 && dailyTaskGranted > 0) {
          const other = granted - dailyTaskGranted;
          showToast('🎉 Hoàn thành Daily Task được tặng ' + dailyTaskGranted + ' xu!'
            + (other > 0 ? ' · Nhận thêm ' + other + ' xu' : ''));
        } else {
          showToast(granted > 0
            ? '🎁 Bạn nhận được phần thưởng · +' + granted + ' xu'
            : '🧾 Đã điều chỉnh số dư ' + granted + ' xu');
        }
      }
      const home = document.getElementById('homeScreen');
      if (home && home.classList.contains('active') && typeof renderHome === 'function') {
        try { renderHome(); } catch (e) {}
      }
    } catch (e) { /* offline — the grant stays unclaimed on the server */ }
  }

  // ---- owned-asset backup (db/016) ----
  // One PUT both backs up this device and restores it: the server merges
  // add-only (sets union, numbers max) and replies with the result, which is
  // applied back the same way — so neither a wiped device nor a stale server
  // copy can ever SHRINK what the child owns. Fire-and-forget on every
  // account sync; offline just means the next sync carries it.
  async function syncAssets(username) {
    const token = tokenFor(username);
    if (!token) return;
    try {
      if (typeof appState === 'undefined' || !appState) return;
      if (typeof currentUser === 'undefined' || currentUser !== username) return;
      const num = v => typeof v === 'number' && Number.isFinite(v);
      const body = {
        accessories: Array.isArray(appState.petAccessories) ? appState.petAccessories : [],
        stickers: Array.isArray(appState.stickers) ? appState.stickers : [],
      };
      if (num(appState.dogGrowthXP)) body.dogGrowthXP = appState.dogGrowthXP;
      if (num(appState.streakShields)) body.streakShields = appState.streakShields;
      const r = await api('assets', { method: 'PUT', token, body });
      if (!r.ok || !r.data || !r.data.assets) return;
      if (typeof currentUser === 'undefined' || currentUser !== username) return;
      const merged = r.data.assets;
      let changed = false;
      const addAll = (key, ids) => {
        if (!Array.isArray(ids)) return;
        if (!Array.isArray(appState[key])) appState[key] = [];
        for (const id of ids) {
          if (!appState[key].includes(id)) { appState[key].push(id); changed = true; }
        }
      };
      addAll('petAccessories', merged.accessories);
      addAll('stickers', merged.stickers);
      if (num(merged.dogGrowthXP) && merged.dogGrowthXP > (+appState.dogGrowthXP || 0)) {
        appState.dogGrowthXP = merged.dogGrowthXP;
        changed = true;
      }
      // The dog's level is derived state — re-derive it from the restored XP,
      // monotonically (a level never goes down; see the login migration).
      if (typeof getDogLevel === 'function') {
        const lvl = getDogLevel(appState.dogGrowthXP);
        if (num(lvl) && lvl > (+appState.dogLevel || 1)) { appState.dogLevel = lvl; changed = true; }
      }
      if (num(merged.streakShields) && merged.streakShields > (+appState.streakShields || 0)) {
        appState.streakShields = Math.min(3, merged.streakShields);
        changed = true;
      }
      if (changed && typeof saveUserData === 'function') saveUserData(currentUser, appState);
    } catch (e) { /* offline — the next sync carries the backup */ }
  }

  // Explicit re-link with a passcode the user typed (when the local passcode
  // no longer matches the server account).
  async function relinkAccount(username, passcode) {
    clearAccount(username);
    return syncAccount(username, passcode);
  }

  // Build the active user's local learning history (last 30 days) as activity items.
  function _localHistoryItems() {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const items = [];
    const add = (o) => { if (o && Number.isFinite(+o.at) && +o.at >= cutoff) items.push(o); };
    // How long it took, in seconds — the exam engine's own timer where there
    // is one (timeSpentSec), the ActivityClock everywhere else (sec). Absent
    // on rows written before either existed; the admin shows those as "—".
    const secDetail = (h) => {
      const v = h && (Number.isFinite(+h.sec) ? +h.sec : Number.isFinite(+h.timeSpentSec) ? +h.timeSpentSec : NaN);
      return Number.isFinite(v) && v >= 0 ? { sec: Math.round(v) } : {};
    };
    const withDetail = (d) => Object.keys(d).length ? { detail: d } : {};
    if (typeof appState === 'undefined' || !appState) return items;

    (appState.unitsHistory || []).forEach(h => add({
      type: 'lesson',
      // The title IS the identity the daily-task catalog matches on
      // (js/daily-task-catalog.js titleExact): 'Unit pr2-7 words practice'.
      title: 'Unit ' + h.unit + ' words practice',
      score: h.score, total: h.total, at: h.date, ...withDetail(secDetail(h)),
    }));
    return items;
  }

  // Skill analytics is intentionally separate from the activity timeline.
  // Each history entry may carry a handful of per-skill summaries; no answer
  // is posted while the child is working and nothing here changes their UI.
  function _localSkillItems() {
    if (typeof appState === 'undefined' || !appState) return [];
    const items = [];
    const addSession = (menu, prefix, h) => {
      if (!h || !Number.isFinite(+h.date) || !Array.isArray(h.skills)) return;
      const sid = prefix + '-' + String(h.id || h.date).replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 80);
      h.skills.forEach(s => {
        if (!s || !s.skillKey || !s.skillLabel || !(+s.attempts > 0)) return;
        items.push({
          sessionId: sid, menu, skillKey: s.skillKey, skillLabel: s.skillLabel,
          attempts: s.attempts, correct: s.correct, wrong: s.wrong,
          skipped: s.skipped, durationMs: s.durationMs || 0,
          wrongRefs: s.wrongRefs || [], at: h.date,
        });
      });
    };
    // The Book practices file under the menu the server's skill page has
    // always known this engine by ('grade4'); the skill keys inside say
    // 'word.unit.pr2.7…'.
    (appState.unitsHistory || []).forEach(h => addSession('grade4', 'g4', h));
    return items;
  }

  // Raise this to make every device re-upload its whole 30-day window once —
  // used when a bug meant activities were accepted by the client but never
  // stored. v2: the server rejected 'collocation' and 'math' (v4.11.6).
  const SYNC_EPOCH = 2;
  // v2 adds the five English practice menus. Replaying the local window is
  // safe because the server key is session + skill and INSERT OR IGNORE.
  const SKILL_SYNC_EPOCH = 2;

  // The wallet as a clamped integer, or null when it is not a real number
  // yet (fresh install, half-hydrated profile). Null means "say nothing":
  // reporting 0 for an unhydrated wallet would poison the recovery snapshot
  // with exactly the value a wipe leaves behind.
  function _walletBalance() {
    if (typeof appState === 'undefined' || !appState) return null;
    const c = appState.coins;
    if (typeof c !== 'number' || !Number.isFinite(c)) return null;
    return Math.max(0, Math.min(100000, Math.trunc(c)));
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
    const allSkills = _localSkillItems();
    // A key marked synced is never sent again — which is why the server
    // silently dropping 'collocation' and 'math' lost them for good rather
    // than retrying. Bumping SYNC_EPOCH forgets those marks once, so the last
    // 30 days go up again. Re-sending is free: the server inserts OR IGNORE
    // against a unique (user, type, second) index.
    if (acct.syncEpoch !== SYNC_EPOCH) {
      setAccount(u, { syncEpoch: SYNC_EPOCH, syncedKeys: [] });
      acct.syncedKeys = [];
    }
    const synced = new Set(acct.syncedKeys || []);
    const keyOf = (o) => o.type + '|' + o.at;
    const items = all.filter(o => !synced.has(keyOf(o)));
    if (allSkills.length && acct.skillSyncEpoch !== SKILL_SYNC_EPOCH) {
      setAccount(u, { skillSyncEpoch: SKILL_SYNC_EPOCH, syncedSkillKeys: [] });
      acct.syncedSkillKeys = [];
    }
    const syncedSkills = new Set(acct.syncedSkillKeys || []);
    const skillKeyOf = (o) => o.sessionId + '|' + o.skillKey;
    const skillItems = allSkills.filter(o => !syncedSkills.has(skillKeyOf(o)));
    if (!items.length && !skillItems.length) {
      // Coins earned in pet chores, Night Raid, cup sales or the shop leave
      // no history item — so a day of pure economy play used to record no
      // recovery snapshot at all. A quiet sync still reports the wallet,
      // once per changed balance.
      const balance = _walletBalance();
      if (balance != null && acct.lastCoinReport !== balance) {
        try {
          const r = await api('activity', { method: 'POST', token: acct.token,
            body: { items: [], coinBalance: balance, coinObservedAt: Date.now() } });
          if (r.status === 401) { clearAccount(u); return { ok: false, reason: 'auth' }; }
          if (r.ok) setAccount(u, { lastCoinReport: balance });
        } catch (e) { /* offline — report again on the next sync */ }
      }
      return { ok: true, synced: 0, total: all.length };
    }

    items.sort((a, b) => b.at - a.at);
    const batch = items.slice(0, 400);
    skillItems.sort((a, b) => b.at - a.at);
    const skillBatch = skillItems.slice(0, 400);
    try {
      let activityOk = !batch.length;
      let skillsOk = !skillBatch.length;
      if (batch.length) {
        // An unhydrated wallet is OMITTED, never sent as 0 — the server
        // snapshot keeps its stored value when the field is absent.
        const balance = _walletBalance();
        const body = { items: batch, coinObservedAt: Date.now() };
        if (balance != null) body.coinBalance = balance;
        const r = await api('activity', { method: 'POST', token: acct.token, body });
        if (r.status === 401) { clearAccount(u); return { ok: false, reason: 'auth' }; }
        if (r.ok && balance != null) setAccount(u, { lastCoinReport: balance });
        activityOk = r.ok;
      }
      if (skillBatch.length) {
        const r = await api('skills', { method: 'POST', token: acct.token, body: { items: skillBatch } });
        if (r.status === 401) { clearAccount(u); return { ok: false, reason: 'auth' }; }
        skillsOk = r.ok;
      }
      if (activityOk) {
        batch.forEach(o => synced.add(keyOf(o)));
        setAccount(u, { syncedKeys: Array.from(synced).slice(-2000) });
      }
      // A finished session may have completed a daily task — repaint the
      // card now instead of at the next throttled home render.
      if (activityOk && typeof DailyTask !== 'undefined') {
        try { DailyTask.refresh('sync'); } catch (e) { /* non-fatal */ }
      }
      if (skillsOk) {
        skillBatch.forEach(o => syncedSkills.add(skillKeyOf(o)));
        setAccount(u, { syncedSkillKeys: Array.from(syncedSkills).slice(-4000) });
      }
      if (activityOk && skillsOk) {
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

  return { refreshFlags: claimCoinGrants, syncAssets, syncAccount, relinkAccount, linkStatus, forgetProfile, validUsername, deviceId, MAX_DEVICE_PROFILES, postAttempt, syncNow, tokenFor, getAccount, clearAccount, api, login, applySignedGrant, settleCoinDebt, coinDebt };
})();

// Manual "Sync now" button handler (home screen). Spins the icon and toasts the result.
async function syncNowUI() {
  const btn = document.getElementById('syncBtn');
  if (typeof EngAuth === 'undefined') { if (typeof showToast === 'function') showToast('Sync unavailable'); return; }
  if (btn) { btn.classList.remove('ok'); btn.classList.add('syncing'); btn.disabled = true; }
  let res;
  try { res = await EngAuth.syncNow(); } catch (e) { res = { ok: false, reason: 'error' }; }
  // The manual button also refreshes the owned-asset backup (fire-and-forget).
  try { if (typeof currentUser !== 'undefined' && currentUser) EngAuth.syncAssets(currentUser); } catch (e) {}
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

// ActivityClock — how long the child spent on the exercise just finished,
// for the parent's history ("16:20 → 16:32 · 12 phút"). Most exercises never
// recorded a start time, so rather than teach fifteen modules to, the clock
// is marked centrally: on every screen switch (js/app.js switchScreen) and
// whenever an exercise's entry function runs (startGrammarQuiz, startMathExam
// … — ENTRY below, wrapped in place by hook(), again after a lazy code group
// lands). Each history write then take()s the seconds since the last mark,
// and taking re-marks, so three quizzes in a row on one screen each get their
// own time. Capped at three hours: a tab left open overnight is not a lesson.
const ActivityClock = {
  CAP_SEC: 3 * 3600,
  _mark: Date.now(),
  mark() { this._mark = Date.now(); },
  take() {
    const s = Math.round((Date.now() - this._mark) / 1000);
    this._mark = Date.now();
    return Math.max(0, Math.min(this.CAP_SEC, s));
  },
  ENTRY: Object.freeze([
    'startUnitPractice', 'startUnitRetry', 'startRetryDrill',
  ]),
  // Wrap every entry function that exists right now. Top-level function
  // declarations are properties of the global object, so reassigning the
  // property is what every caller — inline onclick included — then reaches.
  hook(root) {
    const g = root || (typeof window !== 'undefined' ? window : globalThis);
    const clock = this;
    let n = 0;
    this.ENTRY.forEach(name => {
      const fn = g[name];
      if (typeof fn !== 'function' || fn.__clocked) return;
      const wrapped = function () { clock.mark(); return fn.apply(this, arguments); };
      wrapped.__clocked = true;
      try { g[name] = wrapped; n++; } catch (e) {}
    });
    return n;
  },
};
