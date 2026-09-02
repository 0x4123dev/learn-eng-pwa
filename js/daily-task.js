// Daily Task — the child's side. Tasks are assigned by an admin and counted
// on the server (GET /api/me/daily-tasks); this file only shows them, sends
// the child to the right screen, and lets them spend a Night Raid shield.
// The card on the home screen is EMPTY for a child with no tasks.
// UMD like js/daily-task-catalog.js — `var` so the inline onclick handlers and
// the test sandbox both find it on the global object.
var DailyTask = (function () {
  const THROTTLE_MS = 30000;
  let inflight = null;
  let shieldBusy = false;

  function st() { return (typeof appState !== 'undefined' && appState && appState.dailyTask) || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  // The server counts a task day in GMT+7 (see dayWindowUtc). A cached reply
  // from an earlier day still lists the right tasks but its counts are lies.
  function todayGmt7() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
  function staleDay(s) { return !!(s && s.date) && s.date !== todayGmt7(); }
  // Everything worth a localStorage write. fetchedAt is deliberately absent:
  // it moves on every poll and must not by itself dirty the profile.
  function sig(s) {
    if (!s) return '';
    const sh = s.shields || {};
    return (s.date || '') + '|' + ((s.tasks || []).map(t => t.id + ':' + t.count + ':' + t.done).join(','))
      + '|' + (sh.count || 0) + ':' + (sh.activeUntil || 0)
      + '|' + !!s.rewardedToday + '|' + (s.celebratedDate || '');
  }
  function token() {
    try {
      if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return null;
      return EngAuth.tokenFor(currentUser) || null;
    } catch (e) { return null; }
  }
  function toast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) {} } }
  function persist() {
    if (typeof saveUserData === 'function' && typeof currentUser !== 'undefined' && typeof appState !== 'undefined' && appState) {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  function fmtUntil(ms) {
    const d = new Date(ms);
    const two = n => String(n).padStart(2, '0');
    return two(d.getHours()) + ':' + two(d.getMinutes()) + ' ' + two(d.getDate()) + '/' + two(d.getMonth() + 1);
  }

  // reason: 'home' (throttled), 'sync' / 'shield' (always fetch).
  async function refresh(reason) {
    const t = token();
    if (!t) return null;
    const prev = st();
    if (reason !== 'sync' && reason !== 'shield' && prev && Date.now() - (prev.fetchedAt || 0) < THROTTLE_MS) return prev;
    if (inflight) return inflight;
    // Which child asked. Switching profile mid-flight must not drop one
    // child's tasks into the other one's appState.
    const asked = (typeof currentUser !== 'undefined') ? currentUser : null;
    inflight = (async () => {
      try {
        const r = await EngAuth.api('me/daily-tasks', { token: t });
        if (typeof currentUser === 'undefined' || currentUser !== asked) return st();
        if (!r.ok || !r.data || typeof appState === 'undefined' || !appState) return st();
        const date = r.data.date || '';
        // The reward is usually paid inside the POST /api/activity that
        // finished the last task, so by the time this GET runs justRewarded is
        // already false and only rewardedToday is true. Celebrate the FIRST
        // time this profile sees today's reward (either flag), at most once per
        // date — the service worker can replay a cached reply when offline.
        const alreadyCelebrated = prev && prev.celebratedDate === date;
        const celebrateNow = !!(r.data.justRewarded || r.data.rewardedToday) && !!date && !alreadyCelebrated;
        const next = {
          fetchedAt: Date.now(), date,
          tasks: Array.isArray(r.data.tasks) ? r.data.tasks : [],
          allDone: !!r.data.allDone, rewardedToday: !!r.data.rewardedToday,
          shields: r.data.shields || { count: 0, activeUntil: 0 },
          celebratedDate: celebrateNow ? date : ((prev && prev.celebratedDate) || ''),
        };
        const changed = sig(prev) !== sig(next);
        appState.dailyTask = next;
        // fetchedAt always moves in memory (it drives the throttle), but a poll
        // that found nothing new is not worth a profile write.
        if (changed) persist();
        if (celebrateNow) {
          // The 200 xu are a coin_grants IOU — claim them now rather than at
          // the next background sync, so the wallet moves while the child is
          // looking at the toast.
          try { EngAuth.refreshFlags(currentUser); } catch (e) {}
          celebrate();
        }
        renderHomeCard();
        // Only repaint the task screen when the child is actually on it —
        // a background sync must not rebuild HTML nobody is looking at.
        const screenEl = document.getElementById('dailyTaskScreen');
        if (screenEl && screenEl.classList && screenEl.classList.contains('active')) renderScreen();
        return next;
      } catch (e) { return st(); } finally { inflight = null; }
    })();
    return inflight;
  }

  function celebrate() {
    toast('🎉 Xong nhiệm vụ hôm nay! +200 xu, +1 khiên');
    // #confettiContainer sits outside every screen, so this lands wherever
    // the child happens to be when the last task ticks over.
    if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  }

  function renderHomeCard() {
    const host = document.getElementById('dailyTaskCard');
    if (!host) return;
    const s = st();
    if (!s || !s.tasks || !s.tasks.length) { host.innerHTML = ''; return; }
    const stale = staleDay(s);
    const done = s.tasks.filter(t => t.done).length;
    const subtitle = stale
      ? 'Đang cập nhật…'
      : `${done}/${s.tasks.length} nhiệm vụ · ${s.allDone ? 'Xong rồi! 🎉' : 'Bấm để xem'}`;
    host.innerHTML = `<button type="button" class="dt-card ${!stale && s.allDone ? 'done' : ''}" onclick="DailyTask.open()" aria-label="Mở nhiệm vụ hôm nay">
      <span class="dt-card-icon" aria-hidden="true">📋</span>
      <span class="dt-card-body"><strong>Nhiệm vụ hôm nay</strong><small>${subtitle}</small></span>
      <span class="dt-card-shield" title="Khiên Đêm con đang có">🛡️ ${Math.max(0, +(s.shields && s.shields.count) || 0)}</span>
    </button>`;
  }

  function renderScreen() {
    const host = document.getElementById('dailyTaskScreen');
    if (!host) return;
    const s = st();
    const now = Date.now();
    const tasks = (s && s.tasks) || [];
    const shields = (s && s.shields) || { count: 0, activeUntil: 0 };
    const count = Math.max(0, +shields.count || 0);
    const active = +shields.activeUntil > now ? +shields.activeUntil : 0;
    // A cached day that is not today still names the right tasks, but its
    // counts belong to yesterday — show them as unknown until the poll lands.
    const stale = staleDay(s);
    const list = tasks.length ? tasks.map(t => {
      // Yesterday's tick is as stale as yesterday's count: on a stale day no
      // task claims to be finished, so every one keeps its Vào học button.
      const done = !!t.done && !stale;
      const pct = stale ? 0 : Math.max(0, Math.min(100, Math.round((t.count / Math.max(1, t.target)) * 100)));
      return `<div class="dt-task ${done ? 'done' : ''}">
        <div class="dt-task-top"><strong>${esc(t.label)}</strong><span>${done ? '✓ Xong' : (stale ? '…' : t.count + '/' + t.target)}</span></div>
        <div class="dt-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <small>Cần ${t.target} bài đạt</small>
        ${done ? '' : `<button type="button" class="dt-go" onclick="DailyTask.go('${esc(t.kind)}')">Vào học</button>`}
      </div>`;
    }).join('') : '<p class="dt-empty">Hôm nay chưa có nhiệm vụ nào.</p>';
    const shieldAction = active
      ? `<span class="dt-shield-on">🛡️ Đang bảo vệ đến ${fmtUntil(active)}</span>`
      : (count > 0 ? `<button type="button" class="dt-shield-btn" onclick="DailyTask.activateShield()">Bật khiên 24h</button>` : '');
    // Nothing assigned means nothing to earn — no reward line to dangle.
    const reward = !tasks.length ? ''
      : (s && s.allDone && s.rewardedToday)
        ? '<div class="dt-reward">🎉 Đã nhận 200 xu + 1 khiên hôm nay</div>'
        : '<div class="dt-reward muted">Xong hết nhiệm vụ: +200 xu, +1 khiên</div>';
    host.innerHTML = `<div class="dt-head">
        <button type="button" class="close-btn" onclick="DailyTask.close()" aria-label="Đóng">×</button>
        <h2>📋 Nhiệm vụ hôm nay</h2><p>${esc((s && s.date) || '')}</p>
      </div>
      <div class="dt-list">${list}</div>
      <section class="dt-shield">
        <div><strong>🛡️ Khiên Đêm: x${count}</strong><small>Bật khiên thì 24 giờ không ai cướp được nhà con</small></div>
        ${shieldAction}
      </section>
      ${reward}`;
  }

  function open() {
    // switchScreen already highlights the bottom bar (dailyTaskScreen → home).
    if (typeof switchScreen === 'function' && switchScreen('dailyTaskScreen') === false) return;
    renderScreen();
    refresh('home');
  }
  function close() {
    if (typeof switchScreen === 'function') switchScreen('homeScreen');
  }

  // Deep link from the catalog: switch screen, wait for that screen's lazy
  // question bank (maths, grammar, phrases… download on first visit and their
  // start functions return silently without it), then call each [fn, ...args].
  async function go(kind) {
    const entry = (typeof DailyTaskCatalog !== 'undefined') ? DailyTaskCatalog.get(kind) : null;
    if (!entry || !entry.go) return false;
    if (typeof switchScreen === 'function' && switchScreen(entry.go.screen) === false) return false;
    if (typeof LazyData !== 'undefined' && typeof LazyData.filesFor === 'function'
        && LazyData.filesFor(entry.go.screen).length) {
      try { await LazyData.ensure(entry.go.screen); } catch (e) { /* offline: the start fn will no-op */ }
    }
    for (const call of entry.go.calls || []) {
      const fn = globalThis[call[0]];
      if (typeof fn !== 'function') continue;
      try { fn.apply(null, call.slice(1)); } catch (e) {}
    }
    if (typeof setBottomNavActive === 'function') setBottomNavActive(entry.go.screen);
    return true;
  }

  async function activateShield() {
    // A child taps a big purple button more than once. One POST per tap-storm:
    // the server spends a shield on each, so a double tap must not burn two.
    if (shieldBusy) return;
    const t = token();
    if (!t) { toast('Đăng nhập để dùng khiên'); return; }
    shieldBusy = true;
    try {
      let r;
      try {
        r = await EngAuth.api('night-raid/shield', { method: 'POST', token: t, body: {} });
      } catch (e) {
        // EngAuth.api throws on a dead network — say so instead of leaving the
        // button looking pressed and nothing happening.
        toast('⚠️ Không có mạng — thử lại sau');
        return;
      }
      if (r && r.ok) toast('🛡️ Khiên đã bật! Nhà con được bảo vệ 24 giờ');
      else {
        const code = r && r.data && r.data.code;
        toast(code === 'no_home' ? 'Hãy mở Cướp Đêm và xây nhà trước'
          : code === 'active' ? 'Khiên đang bật rồi'
          : code === 'empty' ? 'Con chưa có khiên nào'
          : 'Chưa bật được khiên, thử lại sau');
      }
      await refresh('shield');
    } finally { shieldBusy = false; }
  }

  return { refresh, renderHomeCard, renderScreen, open, close, go, activateShield };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyTask;
