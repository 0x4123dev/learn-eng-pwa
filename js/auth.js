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
  // refuse. That failure used to surface much later, in the Friends tab, long
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
    const res = await fetch('/api/' + path, {
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
  // js/friends.js _frLinkHelpHTML() turns it into a sentence the child reads —
  // "Tên này đã có tài khoản trên máy chủ với mật mã khác", "Máy này đã tạo đủ
  // số tài khoản cho phép". Left standing, the NEXT child was shown the reason
  // the PREVIOUS child's link failed, about a name that is not theirs, for as
  // long as their own syncAccount took to answer. 'unknown' is the honest
  // state for a link that has not been attempted yet.
  function forgetProfile() { _lastLinkStatus = { reason: 'unknown' }; }

  // Establish/refresh a server account for a local profile using its passcode,
  // then sync any unsynced local history. Called on every login.
  // Returns { ok, reason } — failures used to be swallowed, which left the
  // Friends tab telling a signed-in child to sign in.
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
    if (typeof reconcileCupsFromServer === 'function') {
      try { reconcileCupsFromServer(); } catch (e) {}
    }
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

  // Admin coin adjustments are server-side IOUs (coin_grants): claim every
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
      const receipt = (r.ok && r.data && typeof r.data.receipt === 'string' && r.data.receipt) || null;
      if (typeof appState === 'undefined' || !appState) return;
      if (typeof currentUser === 'undefined' || currentUser !== username) return;
      // The same reply carries the per-user feature flags. Cache them BEFORE
      // the early return below: a child with no coins waiting still needs to
      // learn that an admin has opened a tab for them.
      if (r.ok && r.data && r.data.flags) {
        const before = !!appState.allowMathFight + '|' + !!appState.allowBot;
        appState.allowMathFight = !!r.data.flags.mathFight;
        appState.allowBot = !!r.data.flags.bot;
        const after = !!appState.allowMathFight + '|' + !!appState.allowBot;
        if (before !== after) {
          if (typeof saveUserData === 'function') saveUserData(currentUser, appState);
          // A tab that appeared while the child was already looking at the
          // screen that lists it must actually show up, not wait for the next
          // navigation.
          try {
            if (typeof _mathView !== 'undefined' && typeof renderMathHome === 'function'
                && document.getElementById('mathHubScreen')?.classList.contains('active')) renderMathHome();
            if (typeof renderHome === 'function'
                && document.getElementById('homeScreen')?.classList.contains('active')) renderHome();
          } catch (e) { /* a repaint failure must not lose the flag we just stored */ }
        }
      }
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
        if (granted > 0 && dailyTaskGranted > 0) {
          const other = granted - dailyTaskGranted;
          showToast('🎉 Hoàn thành Daily Task được tặng ' + dailyTaskGranted + ' xu!'
            + (other > 0 ? ' · Nhận thêm ' + other + ' xu' : ''));
        } else {
          showToast(granted > 0
            ? '🎁 Admin tặng bạn ' + granted + ' xu!'
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
        castleSkins: Array.isArray(appState.petBattleCastleSkins) ? appState.petBattleCastleSkins : [],
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
      addAll('petBattleCastleSkins', merged.castleSkins);
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

  // Explicit re-link with a passcode the user typed (used by the Friends tab
  // when the local passcode no longer matches the server account).
  async function relinkAccount(username, passcode) {
    clearAccount(username);
    return syncAccount(username, passcode);
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
      add({ type: 'grammar', title: 'Grammar: ' + name, score: h.score, total: h.total, at: h.date,
        // unitQs pairs the unit with the LENGTH the child chose, so a task
        // can name one button ('Unit 12 · 10 câu'). Grammar has no follow-up
        // screens, so its total IS the question count. unitId stays for the
        // size-agnostic tasks and for anything already assigned.
        detail: { unitId: h.unitId, unitQs: h.unitId + ':' + (h.total || 0) } });
    });
    (appState.phrasesHistory || []).forEach(h => add({
      type: 'phrases', title: 'Phrases practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
      ...(h.qs == null ? {} : { detail: { qs: h.qs } }),
    }));
    (appState.wordformHistory || []).forEach(h => add({
      type: 'wordform', title: 'Word form practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
      ...(h.qs == null ? {} : { detail: { qs: h.qs } }),
    }));
    (appState.rewriteHistory || []).forEach(h => add({
      type: 'rewrite', title: 'Rewrite practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
      ...(h.qs == null ? {} : { detail: { qs: h.qs } }),
    }));
    (appState.collocHistory || []).forEach(h => add({
      type: 'collocation', title: 'Collocation practice (' + (h.total || 0) + ' Qs)',
      score: h.score, total: h.total, at: h.date,
      ...(h.qs == null ? {} : { detail: { qs: h.qs } }),
    }));
    (appState.unitsHistory || []).forEach(h => add({
      type: 'lesson',
      title: (h.unit === 'mix' ? 'Mix 12 units' : 'Unit ' + h.unit) + ' words practice',
      score: h.score, total: h.total, at: h.date,
    }));
    (appState.mathHistory || []).forEach(h => add({
      // A mock exam and a chapter drill are different things to a parent
      // reading the timeline, and the session records which it was. So is a
      // Toán 4 paper: it rides the same 'math' type (the server drops types it
      // does not know) but carries `g4set`, which is what a daily task for it
      // matches on — `chapter` there is a string and can never collide with a
      // Toán 7 chapter number.
      type: 'math',
      title: h.grade === 4
        ? (h.label || 'Toán 4 · Đề ôn')
        : 'Toán 7 · ' + (h.examId ? 'Đề thi: ' : '') + (h.label || 'công thức'),
      score: h.score, total: h.total, at: h.date,
      detail: h.grade === 4 ? { grade: 4, g4set: h.g4set || 'pre', chapter: h.chapter }
        : h.examId ? { examId: h.examId, chapter: h.chapter } : { chapter: h.chapter },
    }));
    (appState.warsHistory || []).forEach(h => add({
      // Math Wars rides the 'math' type: it IS maths practice, and a type the
      // server does not know is dropped in silence (see functions/api/activity.js).
      type: 'math',
      title: 'Math Wars · ' + (h.correct || 0) + '/' + (h.total || 0) + ' câu',
      score: h.correct, total: h.total, at: h.date,
      // level = the hidden difficulty bậc the round was played at (1 = đáp án
      // dưới 20). The child never sees it; a parent reading the timeline can.
      detail: { meanMs: h.meanMs, answered: h.answered, timedOut: !!h.timedOut, level: h.level, max: h.max },
    }));
    (appState.nightRaidHistory || []).forEach(h => add({
      type: 'battle', title: 'Castle Night Raid · ' + (h.won ? 'thắng' : 'thua'),
      score: h.won ? (h.stars || 1) : 0, total: 3, at: h.at,
      detail: { targetId: h.targetId, reward: h.reward || 0, mode: h.kind || 'training' },
    }));
    ((appState.speedChallenge && appState.speedChallenge.history) || []).forEach(h => add({
      type: 'verbs', title: 'Verbs challenge (' + (h.level || '') + ')',
      score: h.correct, total: h.total, at: h.date, detail: { score: h.score },
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
    // Toán 4 rides the same history array as Toán 7 but is a different môn:
    // filed under 'math7' its sheets would be averaged into Toán 7's numbers
    // on the admin skill page, where nobody could tell them apart again.
    (appState.mathHistory || []).forEach(h => h && h.grade === 4
      ? addSession('math4', 'm4', h)
      : addSession('math7', 'm7', h));
    (appState.warsHistory || []).forEach(h => addSession('mathwars', 'mw', h));
    (appState.unitsHistory || []).forEach(h => addSession('grade4', 'g4', h));
    (appState.wordformHistory || []).forEach(h => addSession('wordform', 'wf', h));
    (appState.grammarHistory || []).forEach(h => addSession('grammar', 'gr', h));
    (appState.phrasesHistory || []).forEach(h => addSession('phrases', 'ph', h));
    (((appState.speedChallenge || {}).history) || []).forEach(h => addSession('verbs', 'vb', h));
    (appState.rewriteHistory || []).forEach(h => addSession('rewrite', 'rw', h));
    (appState.collocHistory || []).forEach(h => addSession('collocation', 'co', h));
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
