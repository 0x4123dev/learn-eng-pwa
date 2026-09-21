// Daily Task — the learner's side. Tasks are assigned by an admin and counted
// on the server (GET /api/me/daily-tasks); this file only shows them, sends
// the learner to the right Book, and says when today's 200 xu have landed.
// The seed streak (a seed every two consecutive rewarded days) and the farm
// strip ride the same reply; both open the farm (openNightRaid).
// The card on the home screen is EMPTY for a learner with no tasks.
// UMD like js/daily-task-catalog.js — `var` so the inline onclick handlers and
// the test sandbox both find it on the global object.
var DailyTask = (function () {
  const THROTTLE_MS = 30000;
  let inflight = null;

  function st() { return (typeof appState !== 'undefined' && appState && appState.dailyTask) || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  // The server counts a task day in GMT+7 (see dayWindowUtc). A cached reply
  // from an earlier day still lists the right tasks but its counts are lies.
  function todayGmt7() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
  function staleDay(s) { return !!(s && s.date) && s.date !== todayGmt7(); }
  function seedsOf(s) {
    const raw = s && s.seeds && typeof s.seeds === 'object' ? s.seeds : {};
    return {
      ready: raw.ready !== false,
      progress: Math.max(0, Math.min(1, Math.trunc(+raw.progress || 0))),
      goal: 2,
      next: raw.next || { id: 'lettuce', name: 'Rau cải', days: 1, yield: 40 },
      inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
      recent: Array.isArray(raw.recent) ? raw.recent : [],
      justRewarded: raw.justRewarded || null,
    };
  }
  function seedTotal(s) { return seedsOf(s).inventory.reduce((n, item) => n + Math.max(0, Math.trunc(+item.quantity || 0)), 0); }
  // The garden is part of Daily Task for every learner. `allowBot` remains a
  // QA event flag and must never hide the farm.
  function farmOf(s) { return (s && s.farm && typeof s.farm === 'object') ? s.farm : null; }
  function farmSprite(f) {
    if (!f || !f.preview || typeof FarmRules === 'undefined') return '';
    const p = f.preview, ctx = f.ctx || null;
    const cell = { type: p.id, day: 0, at: p.wilted ? '2000-01-01' : ((ctx && ctx.today) || '') };
    const wiltCtx = p.wilted ? { today: (ctx && ctx.today) || '2000-01-02', doneYesterday: false, doneToday: false } : null;
    const src = FarmRules.spriteFor(cell, p.g, wiltCtx);
    return src ? `<img class="dt-farm-art" src="${src}" alt="" loading="lazy" decoding="async">` : '';
  }
  // Everything worth a localStorage write. fetchedAt is deliberately absent:
  // it moves on every poll and must not by itself dirty the profile.
  function sig(s) {
    if (!s) return '';
    return (s.date || '') + '|' + ((s.tasks || []).map(t => t.id + ':' + t.count + ':' + t.done).join(','))
      + '|seed:' + seedsOf(s).progress + ':' + seedsOf(s).next.id + ':' + seedsOf(s).inventory.map(i => i.id + '=' + i.quantity).join(',')
      + ':' + seedsOf(s).recent.map(r => r.date + '=' + r.id).join(',')
      + '|' + !!s.rewardedToday + '|' + (s.celebratedDate || '')
      + '|' + (s.farm ? [s.farm.crops, s.farm.ripe, s.farm.growing, s.farm.wilted ? 1 : 0].join(':') : '');
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

  // reason: 'home' (throttled); anything else ('sync', 'open') always fetches.
  async function refresh(reason) {
    const t = token();
    if (!t) return null;
    const prev = st();
    if ((!reason || reason === 'home') && prev && Date.now() - (prev.fetchedAt || 0) < THROTTLE_MS) return prev;
    if (inflight) return inflight;
    // Which learner asked. Switching profile mid-flight must not drop one
    // learner's tasks into the other one's appState.
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
          seeds: (r.data.seeds && typeof r.data.seeds === 'object') ? r.data.seeds : seedsOf(prev),
          farm: (r.data.farm && typeof r.data.farm === 'object') ? r.data.farm : null,
          celebratedDate: celebrateNow ? date : ((prev && prev.celebratedDate) || ''),
        };
        const changed = sig(prev) !== sig(next);
        appState.dailyTask = next;
        // fetchedAt always moves in memory (it drives the throttle), but a poll
        // that found nothing new is not worth a profile write.
        if (changed) persist();
        if (celebrateNow) {
          // The 200 xu are a coin_grants IOU — claim them now rather than at
          // the next background sync, so the wallet moves while the learner
          // is looking at the toast.
          try { EngAuth.refreshFlags(currentUser); } catch (e) {}
          celebrate(next);
        }
        renderHomeCard();
        // Only repaint the task screen when the learner is actually on it —
        // a background sync must not rebuild HTML nobody is looking at.
        const screenEl = document.getElementById('dailyTaskScreen');
        if (screenEl && screenEl.classList && screenEl.classList.contains('active')) renderScreen();
        return next;
      } catch (e) { return st(); } finally { inflight = null; }
    })();
    return inflight;
  }

  function celebrate(s) {
    const f = farmOf(s);
    const seed = seedsOf(s).justRewarded || seedsOf(s).recent.find(r => r.date === s.date);
    const garden = !f ? '' : (f.ctx && !f.ctx.doneYesterday ? ' · Cây tươi lại rồi 🌱' : ' · Cây lớn thêm 1 ngày 🌱') + (f.ripe ? ` · ${f.ripe} cây chín, đi hái nào` : '');
    toast('🎉 Xong nhiệm vụ hôm nay! +200 xu' + (seed ? ' · Nhận 1 hạt ' + seed.name + '!' : '') + garden);
    // #confettiContainer sits outside every screen, so this lands wherever
    // the learner happens to be when the last task ticks over.
    if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  }

  function renderHomeCard() {
    const host = document.getElementById('dailyTaskCard');
    if (!host) return;
    const s = st();
    // Empty for a learner with nothing assigned.
    if (!s || !s.tasks || !s.tasks.length) { host.innerHTML = ''; return; }
    const tasks = s.tasks;
    const stale = staleDay(s);
    const done = stale ? 0 : tasks.filter(t => t.done).length;
    const complete = !stale && !!s.allDone;
    const farm = farmOf(s);
    const headline = stale
      ? 'Đang cập nhật nhiệm vụ hôm nay…'
      : complete
        ? 'Bạn đã hoàn thành hôm nay!'
        : `Bạn còn ${tasks.length - done} nhiệm vụ hôm nay`;
    const subtitle = complete
      ? '+200 xu đã vào túi'
      : farm && farm.wilted
        ? 'Cây đang héo 🥀. Hoàn thành để cây tươi lại'
        : 'Hoàn thành để nhận 200 xu';
    const primaryLabel = complete ? 'Xem nhiệm vụ đã hoàn thành' : 'Xem nhiệm vụ hôm nay';
    host.innerHTML = `<section class="dt-card ${complete ? 'done' : ''}" aria-label="Nhiệm vụ hôm nay">
      <div class="dt-card-head">
        <button type="button" class="dt-card-open" onclick="DailyTask.open()" aria-label="Mở nhiệm vụ hôm nay">
          <span class="dt-card-icon" aria-hidden="true">📋</span>
          <strong>Nhiệm vụ hôm nay</strong>
        </button>
        <span class="dt-card-progress">${stale ? '…' : `${done}/${tasks.length}`}</span>
      </div>
      <div class="dt-card-body"><strong>${headline}</strong><small>${subtitle}</small></div>
      <button type="button" class="dt-card-primary" onclick="DailyTask.open()">${primaryLabel}</button>
    </section>`;
  }

  // Progress ring geometry: r=26 in a 64-box → circumference 2π·26.
  const RING_C = 163.4;
  function ringHtml(pct) {
    const p = Math.max(0, Math.min(1, +pct || 0));
    return `<svg class="dt-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="track" cx="32" cy="32" r="26"/><circle class="fill" cx="32" cy="32" r="26" style="stroke-dasharray:${RING_C};stroke-dashoffset:${(RING_C * (1 - p)).toFixed(1)}"/></svg>`;
  }

  function renderScreen() {
    const host = document.getElementById('dailyTaskScreen');
    if (!host) return;
    const s = st();
    const tasks = (s && s.tasks) || [];
    // A cached day that is not today still names the right tasks, but its
    // counts belong to yesterday — show them as unknown until the poll lands.
    const stale = staleDay(s);
    const doneCount = stale ? 0 : tasks.filter(t => !!t.done).length;
    const allDone = !stale && tasks.length > 0 && !!(s && s.allDone);
    const f = farmOf(s), wilted = !!(f && f.wilted && !allDone);

    // Hero: one ring, one sentence. It is the first thing the learner sees,
    // so it says how close they are — and turns green the moment they are
    // done.
    const heroTitle = !tasks.length ? 'Hôm nay chưa có nhiệm vụ nào'
      : stale ? 'Đang cập nhật…'
      : allDone ? 'Hôm nay xong rồi 🎉'
      : doneCount ? `Còn ${tasks.length - doneCount} nhiệm vụ nữa thôi!`
      : 'Bắt đầu thôi!';
    const heroSub = !tasks.length ? 'Đợi thầy cô giao bài nhé.'
      : stale ? 'Đang lấy kết quả hôm nay…'
      : allDone ? (f ? '+200 xu đã vào túi. Cây đã lớn hôm nay 🌼' : '+200 xu đã vào túi. Mai lại có tiếp!')
      : wilted ? 'Cây đang héo 🥀. Xong hết nhiệm vụ là cây tươi lại'
      : f ? 'Xong hết là +200 xu và cây lớn thêm 1 ngày 🌱'
      : 'Xong hết là được +200 xu 🪙';
    const hero = `<div class="dt-hero ${allDone ? 'done' : ''}">
        <div class="dt-ring-wrap">${ringHtml(tasks.length ? doneCount / tasks.length : 0)}<b>${stale ? '…' : tasks.length ? doneCount + '/' + tasks.length : '0'}</b></div>
        <div class="dt-hero-text"><strong>${heroTitle}</strong><small>${heroSub}</small></div>
      </div>`;
    const seedReward = seedRewardHtml(s, stale);
    const farmStrip = farmStripHtml(f);

    const list = tasks.length ? tasks.map(t => {
      // Yesterday's tick is as stale as yesterday's count: on a stale day no
      // task claims to be finished, so every one keeps its Vào học button.
      const done = !!t.done && !stale;
      const pct = stale ? 0 : Math.max(0, Math.min(100, Math.round((t.count / Math.max(1, t.target)) * 100)));
      return `<div class="dt-task ${done ? 'done' : ''}">
        <span class="dt-check" aria-hidden="true">${done ? '✓' : ''}</span>
        <div class="dt-task-main">
          <div class="dt-task-top"><strong>${esc(t.label)}</strong><span>${done ? '✓ Xong' : (stale ? '…' : t.count + '/' + t.target)}</span></div>
          <div class="dt-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
          <small>Cần ${t.target} bài đạt 100% · làm bài mới từ menu</small>
          ${done ? '' : `<button type="button" class="dt-go" onclick="DailyTask.go('${esc(t.kind)}')">Vào học</button>`}
        </div>
      </div>`;
    }).join('') : '<p class="dt-empty">Hôm nay chưa có nhiệm vụ nào.</p>';

    // Nothing assigned means nothing to earn — no reward line to dangle.
    const reward = !tasks.length ? ''
      : (s && s.allDone && s.rewardedToday && !stale)
        ? '<div class="dt-reward">🎉 Đã nhận 200 xu hôm nay</div>'
        : '<div class="dt-reward muted">Xong hết nhiệm vụ: +200 xu 🪙</div>';
    host.innerHTML = `<div class="dt-head">
        <button type="button" class="close-btn" onclick="DailyTask.close()" aria-label="Đóng">×</button>
        <h2>📋 Nhiệm vụ hôm nay</h2><p>${esc((s && s.date) || '')}</p>
      </div>
      ${hero}
      ${seedReward}
      ${farmStrip}
      <div class="dt-list">${list}</div>
      ${reward}`;
  }

  // The garden in one line: the crop closest to ripe, what the whole plot is
  // doing, and the door into the farm.
  function farmStripHtml(f) {
    if (!f) return '';
    const line = !f.crops ? 'Vườn đang trống. Mở Kho Hạt giống để gieo cây nhé'
      : f.wilted ? `${f.wiltedCount} cây đang héo`
      : `${f.growing} cây đang lớn, ${f.ripe} cây chín`;
    return `<section class="dt-farm ${f.wilted ? 'wilted' : ''}" aria-label="Vườn của bạn">
        ${farmSprite(f) || '<span class="dt-farm-art dt-farm-empty" aria-hidden="true">🌱</span>'}
        <div class="dt-farm-text"><strong>Vườn của bạn</strong><small>${line}</small></div>
        <button type="button" class="dt-farm-go" onclick="DailyTask.viewFarm()">Xem vườn</button>
      </section>`;
  }
  function seedRewardHtml(s, stale) {
    const seeds = seedsOf(s), next = seeds.next, total = seedTotal(s);
    if (!seeds.ready) return '';
    const progress = stale ? 0 : seeds.progress;
    const todayReward = seeds.recent.find(r => r.date === (s && s.date));
    const shownProgress = todayReward ? 2 : progress;
    const art = (typeof FarmRules !== 'undefined' && next && next.id) ? FarmRules.art(next.id + '-day' + next.days) : '';
    const message = todayReward
      ? `Bạn vừa nhận 1 hạt ${todayReward.name}! Chuỗi mới bắt đầu từ ngày tiếp theo.`
      : progress === 1
        ? `Thêm 1 ngày hoàn thành liên tiếp để nhận hạt ${next.name}.`
        : `Hoàn thành Daily Task 2 ngày liên tiếp để nhận hạt ${next.name}.`;
    return `<section class="dt-seed-reward ${todayReward ? 'earned' : ''}" aria-label="Tiến độ nhận hạt giống ${shownProgress} trên 2 ngày">
      ${art ? `<img src="${art}" alt="Hạt tiếp theo: ${esc(next.name)}" loading="lazy" decoding="async">` : '<span class="dt-seed-placeholder" aria-hidden="true">🌱</span>'}
      <div class="dt-seed-copy"><span>THƯỞNG HẠT GIỐNG</span><strong>${todayReward ? '2/2' : progress + '/2'} ngày liên tiếp</strong><small>${esc(message)}</small><div class="dt-seed-steps" aria-hidden="true"><i class="${progress||todayReward?'done':''}"></i><i class="${todayReward?'done':''}"></i></div></div>
      <button type="button" onclick="DailyTask.viewSeeds()">Kho hạt · ${total}</button>
    </section>`;
  }
  function viewFarm() {
    if (typeof openNightRaid === 'function') openNightRaid();
  }
  // openNightRaid is a placeholder until the farm's code has landed
  // (js/app.js lazyEntry, js/lazy-data.js GROUP_FILES): it then returns a
  // promise that settles once the real screen is open. Waiting on it is what
  // lets the seed tray open on the FIRST tap of the day rather than silently
  // landing the learner on the farm home instead.
  function viewSeeds() {
    if (typeof openNightRaid !== 'function') return;
    Promise.resolve(openNightRaid()).then(() => {
      if (typeof NightRaid !== 'undefined' && NightRaid && typeof NightRaid.openSeeds === 'function') NightRaid.openSeeds();
    });
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
  // word bank (it downloads on first visit and the start functions return
  // silently without it), then call each [fn, ...args].
  async function go(kind) {
    const entry = (typeof DailyTaskCatalog !== 'undefined') ? DailyTaskCatalog.get(kind) : null;
    if (!entry || !entry.go) return false;
    // The deep link starts a NEW round; one already live on that very screen
    // must be asked about first (switchScreen only asks when leaving it).
    if (typeof leaveWordRound === 'function' && !leaveWordRound()) return false;
    if (typeof switchScreen === 'function' && switchScreen(entry.go.screen) === false) return false;
    if (typeof LazyData !== 'undefined' && typeof LazyData.filesFor === 'function'
        && LazyData.filesFor(entry.go.screen).length) {
      try { await LazyData.ensure(entry.go.screen); } catch (e) { /* offline: the start fn will no-op */ }
    }
    // A destination may sit behind a lazy group of its own inside the
    // screen (js/lazy-data.js GROUP_FILES). The calls below run
    // synchronously, so the group must be here before they look the bank up.
    if (entry.go.group && typeof LazyData !== 'undefined' && typeof LazyData.ensure === 'function') {
      try { await LazyData.ensure(entry.go.group); } catch (e) {}
    }
    for (const call of entry.go.calls || []) {
      const fn = globalThis[call[0]];
      if (typeof fn !== 'function') continue;
      try { fn.apply(null, call.slice(1)); } catch (e) {}
    }
    if (typeof setBottomNavActive === 'function') setBottomNavActive(entry.go.screen);
    return true;
  }

  // Read-only view of the cached state for the HUD.
  function state() { return st(); }

  return { refresh, renderHomeCard, renderScreen, open, close, go, viewFarm, viewSeeds, state };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyTask;
