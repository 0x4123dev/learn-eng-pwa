// Đấu Toán — the Fight tab inside the Math screen.
//
// Two friends stake coins and race through twenty sums in five minutes. This
// file is presentation and transport only: the server issues the seed, decides
// what each side is asked, marks every answer and names the winner. The client
// rebuilds its own questions from the seed so the sums appear instantly, but it
// never scores itself — it posts the values it chose and reads back the result.
var MathFight = (() => {
  'use strict';

  const R = () => (typeof MathFightRules !== 'undefined' ? MathFightRules : null);
  const esc = v => String(v == null ? '' : v).replace(/[&<>'"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

  let st = {
    view: 'list', data: null, fight: null, qs: [], answers: [], idx: 0,
    ticker: null, poll: null, pulse: null, busy: false, claimed: '',
  };

  function root() { return document.getElementById('mfRoot'); }
  function api(path, opts) {
    if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined')
      return Promise.resolve({ ok: false, data: { error: 'Chưa kết nối tài khoản' } });
    const token = EngAuth.tokenFor(currentUser);
    if (!token) return Promise.resolve({ ok: false, data: { error: 'Đăng nhập để chơi Đấu Toán' } });
    return EngAuth.api('math-fight' + (path ? '/' + path : ''), Object.assign({ token }, opts || {}))
      .catch(() => ({ ok: false, data: { error: 'Không thể kết nối máy chủ' } }));
  }
  function coins() { return Math.max(0, Math.floor(+(typeof appState !== 'undefined' && appState ? appState.coins : 0) || 0)); }
  function myRung() {
    // The child's own Math Wars progress. It is only ever half of what the
    // server uses, and it is sent as-is: nothing here decides anything.
    try { return typeof warsProgress === 'function' ? (warsProgress().level || 0) : 0; } catch (e) { return 0; }
  }
  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }

  // ---- clocks ----------------------------------------------------------
  const left = until => Math.max(0, (+until || 0) - Date.now());
  function clockText(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(total / 86400), rest = total % 86400;
    const hh = String(Math.floor(rest / 3600)).padStart(2, '0');
    const mm = String(Math.floor((rest % 3600) / 60)).padStart(2, '0');
    const ss = String(rest % 60).padStart(2, '0');
    return (d ? d + ' ngày ' : '') + hh + ':' + mm + ':' + ss;
  }
  function shortClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)) + ':' + String(total % 60).padStart(2, '0');
  }
  // One chip shape for every wait in this tab, ticked by the one-second timer
  // below. Same look as the Night Raid lock chip so the app reads as one app.
  function waitChip(until, label) {
    if (!left(until)) return '';
    return `<span class="mf-lock" data-mf-until="${+until}" role="status">⏳<span><small>${esc(label)}</small><b data-mf-time>${clockText(left(until))}</b></span></span>`;
  }
  function tickClocks() {
    document.querySelectorAll('[data-mf-until]').forEach(el => {
      const ms = left(el.dataset.mfUntil);
      const slot = el.querySelector('[data-mf-time]');
      if (ms > 0) { if (slot) slot.textContent = clockText(ms); return; }
      // The wait is over: drop the chip and let the row become tappable again.
      const row = el.closest('.mf-friend');
      el.remove();
      if (row) { row.classList.remove('waiting'); row.disabled = false; }
    });
    const clock = document.getElementById('mfClock');
    if (clock && st.fight && st.fight.deadlineAt) {
      const ms = left(st.fight.deadlineAt);
      clock.textContent = shortClock(ms);
      clock.classList.toggle('low', ms <= 30000);
      if (ms <= 0 && st.view === 'fight') submit(false);
    }
    const invite = document.getElementById('mfInviteClock');
    if (invite && st.fight && st.fight.expiresAt) invite.textContent = shortClock(left(st.fight.expiresAt));
  }

  // ---- lifecycle -------------------------------------------------------
  function open() {
    stopTimers();
    st.view = 'list';
    paintLoading();
    st.ticker = setInterval(tickClocks, 1000);
    st.poll = setInterval(refresh, 3000);
    refresh();
  }
  function leave() { stopTimers(); st.fight = null; st.view = 'list'; }
  function stopTimers() {
    for (const key of ['ticker', 'poll', 'pulse']) { if (st[key]) { clearInterval(st[key]); st[key] = null; } }
  }

  // The three-second poll exists to catch an invite arriving, NOT to redraw
  // whatever the child is looking at. It used to repaint the list on every
  // tick, which wiped the challenge card out from under a finger within three
  // seconds of opening it — so a screen being interacted with is left alone.
  async function refresh() {
    if (st.busy || st.view === 'fight' || st.view === 'result') return;
    const res = await api('');
    if (!res.ok || !res.data) { if (st.view === 'list') paintError(res.data && res.data.error); return; }
    st.data = res.data;
    const fight = res.data.fight;
    // A fight the server already started wins over every other screen: both
    // children must land in the bout at the same moment.
    if (fight && fight.status === 'active') { st.fight = fight; return startBout(); }
    if (fight && fight.status === 'invited') {
      const showing = st.view === 'invite' && st.fight && st.fight.fightId === fight.fightId;
      st.fight = fight;
      if (!showing) paintInvite();
      return;
    }
    // No live fight: an invite that expired or was turned down drops the child
    // back to the list, but a challenge card they are still reading stays put.
    st.fight = null;
    if (st.view === 'invite') st.view = 'list';
    if (st.view === 'list') paintList();
  }

  // ---- screens ---------------------------------------------------------
  function paintLoading() {
    const r = root(); if (!r) return;
    r.innerHTML = `<div class="mf-loading" role="status"><i></i><span>Đang mở sân đấu…</span></div>`;
  }
  function paintError(msg) {
    const r = root(); if (!r) return;
    r.innerHTML = `<div class="mf-empty"><h3>Chưa vào được sân đấu</h3><p>${esc(msg || 'Hãy đăng nhập để thách bạn bè.')}</p></div>`;
  }
  function paintList() {
    const r = root(); if (!r || !st.data) return;
    const friends = st.data.friends || [];
    const rows = friends.map(f => {
      const cool = left(f.readyAt), fresh = left(f.friendReadyAt);
      const blocked = cool > 0 || fresh > 0 || f.busy;
      const note = f.busy ? '<small class="mf-note">Đang bận một trận khác</small>'
        : fresh > 0 ? waitChip(f.friendReadyAt, 'BẠN MỚI · CHỜ')
        : cool > 0 ? waitChip(f.readyAt, 'ĐẤU LẠI SAU')
        : '<small class="mf-note ready">Sẵn sàng đấu</small>';
      return `<button class="mf-friend ${blocked ? 'waiting' : ''}" type="button" ${blocked ? 'disabled' : ''}
        onclick="mfPickFriend(${f.userId})">
        <span class="mf-avatar">🥊</span>
        <span class="mf-friend-copy"><strong>${esc(f.username)}</strong>${note}</span>
        <span class="mf-go">›</span></button>`;
    }).join('');
    r.innerHTML = `<div class="mf-wallet">💰 <strong>${coins()}</strong> xu · thắng +${st.data.prize} · thua −${st.data.prize}</div>
      <div class="mf-friends">${rows || '<div class="mf-empty"><h3>Chưa có bạn nào</h3><p>Kết bạn ở tab Bạn bè rồi quay lại thách đấu nhé.</p></div>'}</div>`;
  }

  function pickFriend(userId) {
    const f = (st.data && st.data.friends || []).find(x => x.userId === userId);
    if (!f) return;
    st.view = 'bet';
    const prize = (st.data && st.data.prize) || 200;
    const r = root(); if (!r) return;
    r.innerHTML = `<div class="mf-bet" role="dialog" aria-label="Xác nhận thách đấu">
      <span class="mf-kicker">THÁCH ĐẤU</span>
      <h3>${esc(f.username)}</h3>
      <p>20 câu tính nhẩm trong 5 phút. Ai đúng nhiều hơn thì thắng — hòa số câu thì ai nhanh hơn người đó thắng.</p>
      <div class="mf-stake">
        <span class="win">Thắng <b>+${prize}</b> xu</span>
        <span class="lose">Thua <b>−${prize}</b> xu</span>
      </div>
      <small class="mf-note">Ví của con đang có ${coins()} xu. Hết xu vẫn chơi được — thua thì không bị trừ thêm.</small>
      <div class="mf-actions">
        <button class="mf-secondary" type="button" onclick="mfBackToList()">Thôi</button>
        <button class="mf-primary" type="button" onclick="mfSend(${userId})">Gửi lời thách</button>
      </div></div>`;
  }

  async function send(userId) {
    if (st.busy) return;
    st.busy = true;
    const res = await api('challenge', { method: 'POST', body: { friendId: userId, level: myRung() } });
    st.busy = false;
    if (!res.ok || !res.data || !res.data.fight) return toast((res.data && res.data.error) || 'Không gửi được lời thách');
    st.fight = res.data.fight;
    paintInvite();
  }

  function paintInvite() {
    const r = root(); if (!r || !st.fight) return;
    const mine = st.fight.role === 'challenger';
    st.view = 'invite';
    const foe = (st.data && st.data.friends || []).find(x => x.userId === st.fight.foeId);
    const name = esc((foe && foe.username) || 'Bạn ấy');
    r.innerHTML = `<div class="mf-invite">
      <span class="mf-kicker">${mine ? 'ĐANG CHỜ TRẢ LỜI' : 'CÓ LỜI THÁCH ĐẤU'}</span>
      <h3>${name}</h3>
      <div class="mf-stake"><span class="win">Thắng <b>+${st.fight.prize}</b> xu</span><span class="lose">Thua <b>−${st.fight.prize}</b> xu</span></div>
      <p>${mine ? 'Lời thách sẽ hết hạn sau' : 'Nhận lời trong'} <b id="mfInviteClock">${shortClock(left(st.fight.expiresAt))}</b></p>
      <div class="mf-actions">${mine
        ? '<button class="mf-secondary" type="button" onclick="mfBackToList()">Về danh sách</button>'
        : `<button class="mf-secondary" type="button" onclick="mfRespond(false)">Từ chối</button>
           <button class="mf-primary" type="button" onclick="mfRespond(true)">Nhận lời — đấu!</button>`}</div></div>`;
  }

  async function respond(accept) {
    if (st.busy || !st.fight) return;
    st.busy = true;
    const res = await api('respond', { method: 'POST', body: { fightId: st.fight.fightId, accept } });
    st.busy = false;
    if (!res.ok) return toast((res.data && res.data.error) || 'Không trả lời được lời thách');
    if (!accept) { st.fight = null; st.view = 'list'; return refresh(); }
    st.fight = res.data.fight;
    startBout();
  }

  // ---- the bout --------------------------------------------------------
  function startBout() {
    if (st.view === 'fight' || !st.fight) return;
    const gen = typeof warsQuestions === 'function' ? warsQuestions : null;
    if (!gen || !R()) return toast('Không dựng được đề — hãy tải lại app');
    st.view = 'fight';
    // The sums are rebuilt locally from the server's seed so they appear with
    // no round trip. The server holds the same twenty and marks them itself.
    st.qs = gen(R().QUESTIONS, R().makeRng(st.fight.seed), R().fightLevelMax(st.fight.level));
    st.answers = new Array(R().QUESTIONS).fill(null);
    st.idx = 0;
    if (st.pulse) clearInterval(st.pulse);
    st.pulse = setInterval(beat, (st.data && st.data.heartbeatMs) || 5000);
    paintQuestion();
  }

  function paintQuestion() {
    const r = root(); if (!r || !st.fight) return;
    const q = st.qs[st.idx];
    if (!q) return submit(false);
    const done = st.answers.filter(v => v !== null).length;
    r.innerHTML = `<div class="mf-bout">
      <div class="mf-strip">
        <span class="mf-score me"><small>CON</small><b id="mfMine">${st.fight.myCorrect || 0}</b>✓</span>
        <span class="mf-clock" id="mfClock">${shortClock(left(st.fight.deadlineAt))}</span>
        <span class="mf-score foe"><small>BẠN ẤY</small><b id="mfFoe">${st.fight.foeCorrect || 0}</b>✓</span>
      </div>
      <div class="mf-progress"><i style="width:${(done / st.qs.length) * 100}%"></i></div>
      <div class="mf-count">Câu ${st.idx + 1} / ${st.qs.length}</div>
      <div class="mf-question">${esc(q.q)} = ?</div>
      <div class="mf-options">${q.options.map((o, i) =>
        `<button class="mf-option" type="button" onclick="mfAnswer(${i})">${o}</button>`).join('')}</div>
      <button class="mf-quit" type="button" onclick="mfQuit()">Bỏ cuộc</button>
    </div>`;
  }

  function answer(i) {
    const q = st.qs[st.idx];
    if (!q || st.view !== 'fight') return;
    st.answers[st.idx] = q.options[i];
    st.idx++;
    if (st.idx >= st.qs.length) { beat(); return submit(false); }
    paintQuestion();
  }

  // The pulse carries the ANSWERS, never a score: the running numbers on the
  // strip come back from the server, so they are the same numbers that decide
  // the fight, and a dropped connection at question 19 still keeps those 19.
  async function beat() {
    if (!st.fight || st.view !== 'fight') return;
    const res = await api('progress', { method: 'POST', body: { fightId: st.fight.fightId, answers: st.answers } });
    if (!res.ok || !res.data || !res.data.fight) return;
    st.fight = res.data.fight;
    const mine = document.getElementById('mfMine'), foe = document.getElementById('mfFoe');
    if (mine) mine.textContent = st.fight.myCorrect || 0;
    if (foe) foe.textContent = st.fight.foeCorrect || 0;
    if (st.fight.status === 'done') paintResult();
  }

  async function submit(forfeit) {
    if (!st.fight || st.busy) return;
    st.busy = true;
    if (st.pulse) { clearInterval(st.pulse); st.pulse = null; }
    const res = await api('submit', { method: 'POST', body: { fightId: st.fight.fightId, answers: st.answers, forfeit: !!forfeit, coins: coins() } });
    st.busy = false;
    if (!res.ok || !res.data || !res.data.fight) {
      st.view = 'result';
      const r = root();
      if (r) r.innerHTML = `<div class="mf-empty"><h3>Kết quả đang chờ đồng bộ</h3><p>Mạng chập chờn — xu sẽ được cộng khi kết nối lại.</p>
        <button class="mf-primary" type="button" onclick="mfBackToList()">Về danh sách</button></div>`;
      return;
    }
    st.fight = res.data.fight;
    st.moved = applyCoins(res.data.coins);
    paintResult();
  }

  // The server decides the coin move; this device applies it to its own wallet
  // exactly once, the way a Night Raid result is claimed.
  function applyCoins(delta) {
    const amount = Math.trunc(+delta || 0);
    if (!amount || !st.fight || typeof appState === 'undefined' || !appState) return 0;
    if (!appState.mathFightClaimed || typeof appState.mathFightClaimed !== 'object') appState.mathFightClaimed = {};
    if (appState.mathFightClaimed[st.fight.fightId]) return 0;
    appState.mathFightClaimed[st.fight.fightId] = true;
    appState.coins = Math.max(0, (+appState.coins || 0) + amount);
    try {
      if (typeof saveUserData === 'function' && typeof currentUser !== 'undefined' && currentUser)
        saveUserData(currentUser, appState);
    } catch (e) { /* a failed save must not eat the result screen */ }
    return amount;
  }

  function paintResult() {
    const r = root(); if (!r || !st.fight) return;
    st.view = 'result';
    if (st.pulse) { clearInterval(st.pulse); st.pulse = null; }
    const me = (typeof EngAuth !== 'undefined' && EngAuth.userIdFor) ? EngAuth.userIdFor(currentUser) : null;
    const won = st.fight.winnerId && me != null ? st.fight.winnerId === me : st.fight.myCorrect > st.fight.foeCorrect;
    const drew = !st.fight.winnerId;
    const quit = st.fight.outcome === 'forfeit';
    const moved = Math.trunc(+st.moved || 0);
    r.innerHTML = `<div class="mf-result ${drew ? 'draw' : won ? 'won' : 'lost'}">
      <div class="mf-result-crest">${drew ? '🤝' : won ? '🏆' : '💪'}</div>
      <h3>${drew ? 'HÒA!' : won ? 'THẮNG RỒI!' : 'THUA MẤT RỒI'}</h3>
      <div class="mf-result-score">
        <div><span>CON</span><strong>${st.fight.myCorrect || 0}</strong></div><b>—</b>
        <div><span>BẠN ẤY</span><strong>${st.fight.foeCorrect || 0}</strong></div>
      </div>
      <p>${quit ? (won ? 'Bạn ấy rời trận giữa chừng.' : 'Con rời trận nên xử thua.')
        : drew ? 'Hai bên bằng điểm và bằng cả thời gian — xu được trả lại.'
        : won ? 'Con làm đúng nhiều hơn và mang trọn tiền cược về!'
        : 'Lần sau cố lên — con sẽ có cửa thắng.'}</p>
      <div class="mf-result-coins ${drew || !moved ? 'flat' : won ? 'up' : 'down'}">${
        drew ? 'Hòa — không ai mất xu'
        : moved > 0 ? '+' + moved + ' xu vào ví'
        : moved < 0 ? '−' + Math.abs(moved) + ' xu khỏi ví'
        : 'Ví đang trống nên không bị trừ xu'}</div>
      <div class="mf-result-wallet">Ví còn <b>${coins()}</b> xu</div>
      <div class="mf-actions"><button class="mf-primary" type="button" onclick="mfBackToList()">Về danh sách</button></div>
    </div>`;
  }

  function quit() {
    if (typeof confirm === 'function' && !confirm('Bỏ cuộc là thua và mất tiền cược. Con chắc chưa?')) return;
    submit(true);
  }
  function backToList() { st.fight = null; st.view = 'list'; paintLoading(); refresh(); }

  return Object.freeze({ open, leave, pickFriend, send, respond, answer, submit, quit, backToList, refresh });
})();

function mfPickFriend(id) { MathFight.pickFriend(id); }
function mfSend(id) { MathFight.send(id); }
function mfRespond(ok) { MathFight.respond(ok); }
function mfAnswer(i) { MathFight.answer(i); }
function mfQuit() { MathFight.quit(); }
function mfBackToList() { MathFight.backToList(); }
