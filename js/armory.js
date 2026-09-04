// Kho Khiên & Kiếm — where a finished day of tasks becomes something.
//
// Finishing every daily task pays 200 xu on the spot and leaves ONE reward
// waiting on the server (daily_task_rewards.claimed_kind IS NULL). This
// screen shows those waiting days as an unopened gift and lets the child
// turn each into
//   🛡️ a shield — spend one and the castle cannot be raided for 24 h, or
//   ⚔️ a sword  — never spent, +SWORD_DAMAGE attack on every raid, counted
//                 with no cap (js/night-raid-rules.js),
// and shows both as a COLLECTION: two big cards, lit when owned, a dashed
// silhouette when not, with the live DAM bonus and the shield's timer.
//
// The screen has no <div> in index.html: ensureScreen() builds one next to
// #dailyTaskScreen on first open, so switchScreen('armoryScreen') works the
// same way as every other screen. State comes from appState.dailyTask, which
// js/daily-task.js fills from GET /api/me/daily-tasks and from every claim
// reply (DailyTask.applyArmory) — this file never keeps its own copy.
// UMD like js/daily-task.js — `var` so inline onclick handlers and the test
// sandbox both find it on the global object.
var Armory = (function () {
  const SCREEN_ID = 'armoryScreen';
  let returnTo = 'homeScreen';
  let busy = false;
  // The claim that just landed: which card pops, and what its badge counts
  // up from/to. Consumed by the very next render, then forgotten.
  let flash = null;

  function st() {
    if (typeof DailyTask !== 'undefined' && DailyTask && typeof DailyTask.state === 'function') return DailyTask.state();
    return (typeof appState !== 'undefined' && appState && appState.dailyTask) || null;
  }
  function rules() { return (typeof NightRaidRules !== 'undefined' && NightRaidRules) || null; }
  function swordDamage() { const R = rules(); return (R && R.SWORD_DAMAGE) || 10; }
  // Số ô vẽ trên thanh đo. Kiếm KHÔNG còn trần: mỗi thanh đều cộng DAM,
  // thanh đo chỉ là cách nhìn cho nhanh, đầy rồi thì hiện thêm "+n".
  function meterPips() { const R = rules(); return (R && R.SWORD_METER_PIPS) || 10; }
  function bonusFor(n) {
    const R = rules();
    if (R && typeof R.swordBonus === 'function') return R.swordBonus(n);
    return swordDamage() * Math.max(0, Math.trunc(+n || 0));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function toast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) {} } }
  function token() {
    try {
      if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return null;
      return EngAuth.tokenFor(currentUser) || null;
    } catch (e) { return null; }
  }
  function todayGmt7(offsetDays) { return new Date(Date.now() + (7 + 24 * (offsetDays || 0)) * 3600000).toISOString().slice(0, 10); }
  // '2026-09-02' → 'Hôm nay' / 'Hôm qua' / '02/09' — a child reads a day, not
  // an ISO string. Anything that is not YYYY-MM-DD is shown as-is (escaped).
  function fmtDay(iso) {
    const s = String(iso || '');
    if (s === todayGmt7(0)) return 'Hôm nay';
    if (s === todayGmt7(-1)) return 'Hôm qua';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? m[3] + '/' + m[2] : esc(s);
  }
  function fmtUntil(ms) {
    const d = new Date(ms);
    const two = n => String(n).padStart(2, '0');
    return two(d.getHours()) + ':' + two(d.getMinutes()) + ' ' + two(d.getDate()) + '/' + two(d.getMonth() + 1);
  }
  function fmtLeft(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + ' giờ' + (m ? ' ' + m + ' phút' : '') : m + ' phút';
  }
  function pendingOf(s) { return (s && Array.isArray(s.pending)) ? s.pending : []; }
  function shieldsOf(s) { return Math.max(0, Math.trunc(+((s && s.shields && s.shields.count) || 0))); }
  function swordsOf(s) { return Math.max(0, Math.trunc(+((s && s.swords && s.swords.count) || 0))); }

  // The screen element. index.html carries no #armoryScreen (the module is
  // wired in after the markup), so build it beside #dailyTaskScreen: same
  // parent, same .screen layout, same daily-task padding.
  function ensureScreen() {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById(SCREEN_ID);
    if (el) return el;
    if (typeof document.createElement !== 'function') return null;
    el = document.createElement('div');
    el.id = SCREEN_ID;
    el.className = 'screen daily-task-screen armory-screen';
    const sibling = document.getElementById('dailyTaskScreen');
    const parent = sibling && (sibling.parentNode || sibling.parentElement);
    if (parent && typeof parent.insertBefore === 'function') parent.insertBefore(el, sibling.nextSibling || null);
    else if (parent && typeof parent.appendChild === 'function') parent.appendChild(el);
    else if (document.body && typeof document.body.appendChild === 'function') document.body.appendChild(el);
    return el;
  }
  function armoryOnScreen() {
    const el = (typeof document !== 'undefined') ? document.getElementById(SCREEN_ID) : null;
    return !!(el && el.classList && el.classList.contains('active'));
  }

  // Eight sparks flying out of a card. Pure CSS motion (see .am-burst).
  function burstHtml() {
    return '<span class="am-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  }

  // One collection card. `has` lights it up; `empty` is the silhouette of
  // what the child could earn. The badge is what counts up after a claim.
  function cardHtml(kind, count, celebrate) {
    const shield = kind === 'shield';
    const has = count > 0;
    const blurb = shield
      ? (has ? 'Bật 1 khiên → 24 giờ không ai cướp được nhà con' : 'Chưa có — mở quà để lấy khiên')
      : (has ? `+${bonusFor(count)} DAM mỗi lần đi cướp đêm` : 'Chưa có — mở quà để lấy kiếm');
    // `celebrate` is the consumed flash record for this card (or false).
    const from = celebrate && Number.isFinite(+celebrate.from) ? Math.max(0, Math.trunc(+celebrate.from)) : count;
    return `<article class="am-card ${kind} ${has ? 'has' : 'empty'} ${celebrate ? 'am-celebrate' : ''}">
        <b class="am-count" data-kind="${kind}" data-from="${from}" data-to="${count}">x${celebrate ? from : count}</b>
        <span class="am-card-icon" aria-hidden="true">${shield ? '🛡️' : '⚔️'}</span>
        <strong>${shield ? 'Khiên Đêm' : 'Kiếm'}</strong>
        <small>${blurb}</small>
        ${celebrate ? burstHtml() : ''}
      </article>`;
  }

  // The number in a badge ticks from the old count to the new one over
  // ~0.6 s, so a claim is seen to ADD something rather than just repaint.
  function countUp(host) {
    if (!host || typeof host.querySelectorAll !== 'function' || typeof setTimeout !== 'function') return;
    const badges = host.querySelectorAll('.am-count');
    const list = Array.isArray(badges) ? badges : Array.from(badges || []);
    for (const el of list) {
      if (!el || typeof el.getAttribute !== 'function' || el.getAttribute('data-from') == null) continue;
      const from = +el.getAttribute('data-from'), to = +el.getAttribute('data-to');
      if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) continue;
      const start = Date.now(), dur = 600;
      const tick = () => {
        const p = Math.min(1, (Date.now() - start) / dur);
        el.textContent = 'x' + Math.round(from + (to - from) * p);
        if (p < 1) setTimeout(tick, 40);
      };
      setTimeout(tick, 120);
    }
  }

  function render() {
    const host = ensureScreen();
    if (!host) return;
    const s = st();
    const now = Date.now();
    const pending = pendingOf(s);
    const shields = shieldsOf(s), swords = swordsOf(s);
    const pips = meterPips(), each = swordDamage(), bonus = bonusFor(swords);
    const activeUntil = s && s.shields && +s.shields.activeUntil > now ? +s.shields.activeUntil : 0;
    const dis = busy ? ' disabled' : '';
    const n = pending.length;
    const first = n ? pending[0] : '';

    // The gift. The two big choices always open the OLDEST waiting day; when
    // it is opened the next one takes its place, so every day is claimable on
    // its own — and "mở hết" turns all of them at once.
    const giftHtml = n
      ? `<div class="am-gift-top">
          <span class="am-gift-icon" aria-hidden="true">🎁</span>
          <div><strong>${n === 1 ? '1 món quà' : n + ' món quà'} chờ con mở!</strong><small>Quà ${fmtDay(first)}${n > 1 ? ' · còn ' + (n - 1) + ' quà nữa' : ''} · không hết hạn, mở lúc nào cũng được</small></div>
        </div>
        <div class="am-choices">
          <button type="button" class="am-choice shield" onclick="Armory.claim('${esc(first)}','shield')"${dis}><span class="am-choice-icon" aria-hidden="true">🛡️</span><strong>Lấy khiên</strong><small>24 giờ không ai cướp được nhà</small></button>
          <button type="button" class="am-choice sword" onclick="Armory.claim('${esc(first)}','sword')"${dis}><span class="am-choice-icon" aria-hidden="true">⚔️</span><strong>Lấy kiếm</strong><small>+${each} DAM mỗi lần đi cướp, mãi mãi</small></button>
        </div>
        ${n > 1 ? `<div class="am-claim-all"><span>Mở hết ${n} quà một lần:</span>
          <button type="button" class="am-all shield" onclick="Armory.claimAll('shield')"${dis}>🛡️ Tất cả làm khiên</button>
          <button type="button" class="am-all sword" onclick="Armory.claimAll('sword')"${dis}>⚔️ Tất cả làm kiếm</button>
        </div>` : ''}`
      : `<div class="am-gift-top">
          <span class="am-gift-icon" aria-hidden="true">🎁</span>
          <div><strong>Chưa có quà chờ mở</strong><small>${(s && s.allDone && s.rewardedToday)
            ? 'Hôm nay con mở rồi. Mai xong nhiệm vụ lại có quà mới!'
            : 'Xong hết nhiệm vụ hôm nay là có 1 món quà để mở.'}</small></div>
        </div>`;

    const shieldRow = activeUntil
      ? `<span class="dt-pill on am-pill">🛡️ Đang bảo vệ · đến ${fmtUntil(activeUntil)} · còn ${fmtLeft(activeUntil - now)}</span>`
      : shields > 0
        ? `<button type="button" class="dt-shield-btn am-activate" onclick="Armory.activateShield()"${dis}>🛡️ Bật khiên 24h</button>`
        : '<span class="dt-pill am-pill">Khiên: bật là 24 giờ không ai cướp được nhà con</span>';

    const lit = Math.min(swords, pips), extra = Math.max(0, swords - pips);
    const swordNote = swords > 0
      ? `Mỗi kiếm +${each} DAM, không có giới hạn và không mất sau trận. ${swords} kiếm đang cho +${bonus} DAM.`
      : `Mỗi kiếm +${each} DAM khi con đi cướp đêm. Không mất sau trận, gom bao nhiêu cũng được.`;
    const meter = Array.from({ length: pips }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')
      + (extra ? `<b class="am-meter-more">+${extra}</b>` : '');

    const claimed = ((s && s.recent) || []).filter(r => r && r.kind).slice(0, 5);
    const recentHtml = claimed.length
      ? `<section class="am-recent"><strong>Đã mở gần đây</strong><ul>${claimed.map(r => `<li>${fmtDay(r.date)} · ${r.kind === 'sword' ? '⚔️ Kiếm' : '🛡️ Khiên'}</li>`).join('')}</ul></section>`
      : '';

    const f = flash; flash = null;
    host.innerHTML = `<div class="dt-head">
        <button type="button" class="close-btn" onclick="Armory.close()" aria-label="Đóng">×</button>
        <h2>🛡️⚔️ Kho Khiên &amp; Kiếm</h2><p>Bộ sưu tập từ nhiệm vụ mỗi ngày</p>
      </div>
      <section class="am-gift ${n ? 'has' : ''}" aria-live="polite">${giftHtml}</section>
      <h3 class="am-h3">Bộ sưu tập của con</h3>
      <div class="am-collection">
        ${cardHtml('shield', shields, f && f.kind === 'shield' ? f : false)}
        ${cardHtml('sword', swords, f && f.kind === 'sword' ? f : false)}
      </div>
      <section class="am-row shield">${shieldRow}</section>
      <section class="am-row sword">
        <div class="am-bonus"><strong>+${bonus} DAM</strong><span>· ${swords} kiếm</span></div>
        <div class="am-meter" aria-hidden="true">${meter}</div>
        <small class="am-muted">${swordNote}</small>
      </section>
      ${recentHtml}`;
    if (f) countUp(host);
  }

  // Remember where the child came from so ✕ takes them back there, then
  // paint from the cache and refresh — a claim made on another device shows
  // up as soon as the poll lands.
  function open() {
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const active = document.querySelector('.screen.active');
      if (active && active.id && active.id !== SCREEN_ID) returnTo = active.id;
    }
    ensureScreen();
    if (typeof switchScreen === 'function' && switchScreen(SCREEN_ID) === false) return false;
    render();
    if (typeof DailyTask !== 'undefined' && DailyTask && typeof DailyTask.refresh === 'function') {
      try {
        const p = DailyTask.refresh('armory');
        if (p && typeof p.then === 'function') p.then(() => { if (armoryOnScreen()) render(); }).catch(() => {});
      } catch (e) {}
    }
    return true;
  }
  function close() {
    const to = returnTo || 'homeScreen';
    if (typeof switchScreen === 'function' && switchScreen(to) === false) return;
    // Repaint the screen we return to with the new stock: the Night Raid builder
    // shows DAM (swords count there), the task screen its collection strip.
    // switchScreen('homeScreen') already calls renderHome(), which repaints the card.
    if (to === 'nightRaidScreen' && typeof NightRaid !== 'undefined' && NightRaid && typeof NightRaid.renderBuilder === 'function') {
      try { NightRaid.renderBuilder(); } catch (e) {}
    } else if (to === 'dailyTaskScreen' && typeof DailyTask !== 'undefined' && DailyTask && typeof DailyTask.renderScreen === 'function') {
      try { DailyTask.renderScreen(); } catch (e) {}
    }
  }

  // After a claim POST: fold the server's armory into appState, tell the
  // child what happened, repaint with the celebration. `n` is how many the
  // child asked for; the server says how many it actually turned.
  function settle(r, kind, n, before) {
    const armory = r && r.data && r.data.armory;
    if (armory && typeof DailyTask !== 'undefined' && DailyTask && typeof DailyTask.applyArmory === 'function') DailyTask.applyArmory(armory);
    if (r && r.ok) {
      const got = (r.data && Number.isFinite(+r.data.claimed)) ? Math.max(0, Math.trunc(+r.data.claimed)) : n;
      if (got > 0) {
        const now = st();
        flash = { kind, from: kind === 'sword' ? before.swords : before.shields, to: kind === 'sword' ? swordsOf(now) : shieldsOf(now) };
        toast(kind === 'sword'
          ? `⚔️ +${got} kiếm! Đi cướp đêm con đánh mạnh hơn: +${bonusFor(swordsOf(now))} DAM`
          : `🛡️ +${got} khiên! Bật khiên là 24 giờ không ai cướp được nhà con`);
        if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
      } else {
        toast('Không còn quà nào để mở');
      }
    } else {
      const code = r && r.data && r.data.code;
      toast(code === 'claimed' ? 'Quà ngày này con mở rồi'
        : code === 'no_reward' ? 'Ngày này chưa có quà'
        : code === 'not_ready' ? 'Kho đang được nâng cấp, thử lại sau ít phút'
        : 'Chưa mở được, thử lại sau');
    }
    render();
    return !!(r && r.ok);
  }

  // One POST per tap-storm: the server refuses a second claim of the same day
  // anyway, but a child should not see two spinners for one tap.
  async function post(path, body, kind, n) {
    if (busy) return false;
    const t = token();
    if (!t) { toast('Đăng nhập để mở quà'); return false; }
    const before = { shields: shieldsOf(st()), swords: swordsOf(st()) };
    busy = true;
    render();
    try {
      let r;
      try {
        r = await EngAuth.api(path, { method: 'POST', token: t, body });
      } catch (e) {
        toast('⚠️ Không có mạng — thử lại sau');
        return false;
      }
      busy = false;
      return settle(r, kind, n, before);
    } finally {
      if (busy) { busy = false; render(); }
    }
  }
  function claim(date, kind) { return post('daily-task/claim', { date: String(date || ''), kind: String(kind || '') }, kind, 1); }
  function claimAll(kind) { return post('daily-task/claim-all', { kind: String(kind || '') }, kind, pendingOf(st()).length); }

  async function activateShield() {
    if (typeof DailyTask === 'undefined' || !DailyTask || typeof DailyTask.activateShield !== 'function') return;
    await DailyTask.activateShield();
    render();
  }

  return { SCREEN_ID, open, close, render, claim, claimAll, activateShield, ensureScreen, fmtDay };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Armory;
