// petbattle.js — ⚔️ Pet Battle vs a friend (artillery duel), opened from the
// ⚔️ button on the pet habitat. Separate from js/battle.js, which is the older
// local two-player word-matching mode; names here are pet*-prefixed and the
// history lives in appState.petBattleHistory so the two never collide.
//
// Transport: the game only calls sendTurn() and receives onServerState(), so
// today's adaptive-polling adapter can be swapped for WebSockets later
// without touching a line of game code (spec phase 4).

let _pbState = null;      // { ammo, stats, readyAt, battle }
let _pbPoll = null;
let _pbGame = null;
let _pbMsg = '';
let _pbLastTurn = 0;
let _pbLink = null;        // realtime transport for the running battle
let _pbShowingResult = false;   // keep the result card up until the child taps Xong

const PB_POLL_IDLE_MS = 5000;
const PB_POLL_LIVE_MS = 1000;    // during the opponent's turn: near-live

function pbEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _pbToken() {
  try {
    if (typeof EngAuth === 'undefined' || typeof currentUser === 'undefined') return null;
    return EngAuth.tokenFor(currentUser);
  } catch (e) { return null; }
}
async function _pbApi(path, opts) {
  const token = _pbToken();
  if (!token) return { ok: false, offline: true, data: null };
  try { return await EngAuth.api(path, Object.assign({ token }, opts || {})); }
  catch (e) { return { ok: false, offline: true, data: null }; }
}
function _pbMyPet() {
  const st = (typeof appState !== 'undefined' && appState) ? appState : {};
  const level = st.dogLevel || 1;
  let stage = 'chihuahua';
  try { stage = getDogStage(level).stageCss; } catch (e) {}
  return { level, stage, petName: st.petName || 'Pet' };
}

// ---- screen ----
function openPetBattle() {
  if (typeof switchScreen === 'function') switchScreen('petBattleScreen');
  renderPetBattle();
  refreshPetBattle();
  _pbStartPolling();
}
function closePetBattle() {
  _pbShowingResult = false;
  _pbStopPolling();
  _pbCloseLink();
  if (_pbGame && _pbGame.destroy) { try { _pbGame.destroy(); } catch (e) {} }
  _pbGame = null;
  if (typeof switchScreen === 'function') switchScreen('homeScreen');
  if (typeof renderHome === 'function') renderHome();
}

async function refreshPetBattle() {
  const r = await _pbApi('battle');
  if (r.ok && r.data) _pbState = r.data;
  else _pbState = { offline: true };
  renderPetBattle();                     // no-op while the result card is up
  return _pbState;
}

function pbFmtCountdown(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function _pbShell(inner) {
  return `
    <div class="pb-wrap">
      <div class="pb-header">
        <button class="grammar-back-btn" onclick="closePetBattle()">✕</button>
        <h1 class="pb-title">⚔️ Đấu trường</h1>
      </div>
      ${inner}
    </div>`;
}

// The arena showed ammo only, so a child had no idea their pet's LEVEL also
// decides how hard each shot lands. Show the pet, its level, and exactly what
// the level buys — numbers taken from the same functions the physics uses.
function _pbPowerPanel() {
  const pet = _pbMyPet();
  const p = (typeof powerProfile === 'function') ? powerProfile(pet.level) : null;
  if (!p) return '';

  let face = '<span style="font-size:40px">🐶</span>';
  try {
    if (typeof petDogSVG === 'function' && typeof getDogStage === 'function') {
      const stage = getDogStage(pet.level);
      face = petDogSVG({ stageCss: stage.stageCss, size: 62, level: pet.level, stageMinLevel: stage.minLevel });
    }
  } catch (e) {}

  const n1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const rows = p.stats.map(s => {
    const pct = Math.max(3, Math.round(s.ratio * 100));
    const maxed = s.per10 <= 0.001;
    const growth = maxed ? 'Đã đạt tối đa 🎉' : `+${n1(s.per10)} mỗi 10 cấp`;
    return `
      <div class="pb-pow-row">
        <div class="pb-pow-head">
          <span>${s.icon} ${pbEsc(s.label)}</span>
          <b>${n1(s.value)}${s.beyond ? '' : `<small>/${n1(s.max)}</small>`}</b>
        </div>
        <div class="pb-pow-bar"><i style="width:${pct}%"></i></div>
        <div class="pb-pow-hint">${s.beyond ? `Vượt mốc cấp ${p.refLevel} 🎉 · ` : ''}${growth}</div>
      </div>`;
  }).join('');

  return `
    <div class="pb-pow-card">
      <div class="pb-pow-top">
        <div class="pb-pow-face">${face}</div>
        <div class="pb-pow-id">
          <div class="pb-pow-name">${pbEsc(pet.petName)}</div>
          <div class="pb-pow-level">Cấp <b>${p.level}</b></div>
          <div class="pb-pow-note">Cấp càng cao, đạn càng to và nổ càng mạnh</div>
        </div>
      </div>
      <div class="pb-pow-rows">${rows}</div>
      <div class="pb-pow-foot">Tối đa ở cấp ${p.refLevel} · lên cấp bằng cách học bài 📚</div>
    </div>`;
}

// "Bé cấp 42 vs cấp 30" — a child sizing up an opponent should see whose pet
// is stronger before accepting.
function _pbVersusLine(b) {
  const mine = _pbMyPet().level;
  const theirs = (b && b.foe && b.foe.level) || 1;
  const verdict = mine > theirs ? 'Pet của bé mạnh hơn! 💪'
    : mine < theirs ? 'Pet bạn ấy mạnh hơn — ngắm thật chuẩn nhé! 🎯'
    : 'Ngang sức ngang tài! ⚖️';
  return `<div class="pb-versus">Pet của bé <b>cấp ${mine}</b> &nbsp;vs&nbsp; <b>cấp ${theirs}</b>
    <div class="pb-versus-note">${verdict}</div></div>`;
}

function _pbAmmoPanel(st) {
  const rows = (typeof ammoBreakdown === 'function' ? ammoBreakdown(st.stats || {}) : [])
    .map(r => {
      // Progress bar toward the NEXT shot, not the whole row — a child two
      // answers away should see a nearly-full bar, not a barely-moved one.
      const pct = r.max ? Math.round(r.shots / r.max * 100) : 0;
      return `
      <div class="pb-ammo-row">
        <div class="pb-ammo-head">
          <span class="pb-ammo-label">${pbEsc(r.label)}</span>
          <b>+${r.shots}<small>/${r.max}</small> 🚀</b>
        </div>
        <div class="pb-ammo-bar"><i style="width:${pct}%"></i></div>
        <div class="pb-ammo-hint"><span class="pb-ammo-rule">${pbEsc(r.rule || '')}</span>${r.hint ? ' · ' + pbEsc(r.hint) : ''}</div>
      </div>`;
    })
    .join('');
  return `
    <div class="pb-ammo-card">
      <div class="pb-ammo-total">${st.ammo} 🚀</div>
      <div class="pb-ammo-cap">đạn kiếm được từ 3 ngày học (tối đa 20)</div>
      <div class="pb-ammo-rows">${rows}</div>
    </div>`;
}

function renderPetBattle() {
  const screen = document.getElementById('petBattleScreen');
  if (!screen) return;
  if (_pbGame) return;                       // the running game owns the screen
  if (_pbShowingResult) return;              // …and so does the result card

  const st = _pbState;
  if (!st) { screen.innerHTML = _pbShell('<div class="pb-empty">Đang tải…</div>'); return; }
  if (st.offline) {
    screen.innerHTML = _pbShell('<div class="pb-empty">⚠️ Cần mạng (và đăng nhập) để thi đấu với bạn bè.</div>');
    return;
  }

  const b = st.battle;
  if (b && b.status === 'invited' && !b.iAmChallenger) {
    const left = Math.max(0, (b.expiresAt || 0) - Date.now());
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">⚔️ ${pbEsc(b.foe.name || 'Bạn')} thách đấu!</div>
        <div class="pb-invite-sub">Nhận lời trong <b>${Math.ceil(left / 1000)}</b> giây</div>
        ${_pbVersusLine(b)}
        <div class="pb-ammo-line">Đạn của bé: <b>${st.ammo}</b> 🚀</div>
        <div class="pb-invite-actions">
          <button class="pb-btn primary" onclick="acceptPetBattle(${b.id})" ${st.ammo <= 0 ? 'disabled' : ''}>Chiến! ⚔️</button>
          <button class="pb-btn" onclick="declinePetBattle(${b.id})">Để sau</button>
        </div>
        ${st.ammo <= 0 ? '<div class="pb-warn">Bé chưa có đạn — học bài để nạp đạn nhé! 🚀</div>' : ''}
      </div>`);
    return;
  }
  if (b && b.status === 'invited' && b.iAmChallenger) {
    const left = Math.max(0, (b.expiresAt || 0) - Date.now());
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">⏳ Đang chờ ${pbEsc(b.foe.name || 'bạn')}…</div>
        <div class="pb-invite-sub">Còn <b>${Math.ceil(left / 1000)}</b> giây</div>
        <div class="pb-hint">Nhớ bảo bạn ấy mở app để nhận lời mời nhé!</div>
      </div>`);
    return;
  }
  if (b && b.status === 'active') { startPetBattleGame(b); return; }

  const ready = !st.readyAt || st.readyAt <= Date.now();
  const friends = (typeof _getFriendsData === 'function' && _getFriendsData())
    ? _getFriendsData().friends : ((typeof _friendsData !== 'undefined' && _friendsData) ? _friendsData.friends : []);
  const list = (friends && friends.length)
    ? friends.map(f => `
        <button class="pb-friend" onclick="challengePetFriend(${f.userId})" ${ready && st.ammo > 0 ? '' : 'disabled'}>
          <span class="pb-friend-name">${pbEsc(f.username)}</span>
          <span class="pb-friend-go">⚔️</span>
        </button>`).join('')
    : `<div class="pb-empty">
         Chưa có bạn nào để thách đấu.
         <button class="pb-btn primary pb-go-friends" onclick="pbGoToFriends()">👥 Kết bạn ngay</button>
       </div>`;

  screen.innerHTML = _pbShell(`
    ${_pbPowerPanel()}
    ${_pbAmmoPanel(st)}
    ${ready
      ? (st.ammo > 0
          ? `<div class="pb-ready">⚔️ Sẵn sàng! Chọn một người bạn để thách đấu:</div>`
          : `<div class="pb-warn">🚀 Chưa có đạn. Học bài trong 3 ngày để nạp đạn rồi thách đấu nhé!</div>`)
      : `<div class="pb-cooldown">
           <div class="pb-cooldown-title">⏳ Trận sau sau <b>${pbFmtCountdown(st.readyAt - Date.now())}</b></div>
           <div class="pb-cooldown-sub">Học 3 ngày để nạp đạn! 🚀</div>
         </div>`}
    <div class="pb-friend-list">${list}</div>
    ${_pbMsg ? `<div class="pb-msg">${pbEsc(_pbMsg)}</div>` : ''}`);
}

// "Vào Hồ sơ → 👥 Bạn bè" was an instruction, not a route. Make it one tap,
// landing on the friends section itself rather than the top of the profile.
function pbGoToFriends() {
  closePetBattle();
  if (typeof navigateToProfile === 'function') navigateToProfile();
  setTimeout(() => {
    const el = document.getElementById('friendsSection');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
}

// ---- challenge flow ----
async function challengePetFriend(friendId) {
  const r = await _pbApi('battle/challenge', { method: 'POST', body: Object.assign({ friendId }, _pbMyPet()) });
  _pbMsg = r.ok ? '' : ((r.data && r.data.error) || 'Không gửi được lời thách đấu');
  await refreshPetBattle();
}
async function acceptPetBattle(battleId) {
  const r = await _pbApi('battle/respond', { method: 'POST', body: Object.assign({ battleId, accept: true }, _pbMyPet()) });
  _pbMsg = r.ok ? '' : ((r.data && r.data.error) || 'Không tham gia được');
  await refreshPetBattle();
}
async function declinePetBattle(battleId) {
  await _pbApi('battle/respond', { method: 'POST', body: { battleId, accept: false } });
  await refreshPetBattle();
}

// ---- lobby polling (only while NOT in a battle; the battle uses BattleLink) ----
function _pbStartPolling() {
  _pbStopPolling();
  const tick = async () => {
    try { if (!_pbGame) await refreshPetBattle(); } catch (e) {}
    _pbPoll = setTimeout(tick, _pbGame ? PB_POLL_IDLE_MS : PB_POLL_LIVE_MS);
  };
  _pbPoll = setTimeout(tick, PB_POLL_LIVE_MS);
}
function _pbStopPolling() {
  if (_pbPoll) { clearTimeout(_pbPoll); _pbPoll = null; }
}

// The realtime link for the running battle (WebSocket, polling fallback).
function _pbOpenLink(battleId) {
  _pbCloseLink();
  if (typeof BattleLink !== 'function') return null;
  _pbLink = new BattleLink({
    battleId,
    token: _pbToken(),
    // A turn relayed by the room: replay it the moment it is fired.
    onRemoteTurn: (m) => {
      if (!_pbGame) return;
      _pbGame.onLiveTurn({
        turn_no: m.turnNo, user_id: m.from,
        angle: m.angle, power: m.power, shots: m.shots, damage: m.damage,
      });
    },
    onAim: (m) => { if (_pbGame) _pbGame.onOpponentAim(m); },
    onEmote: (m) => { if (_pbGame) _pbGame.onEmote(m.e); },
    onPresence: (m) => { if (_pbGame) _pbGame.onPresence(m); },
    onModeChange: (mode) => { if (_pbGame) _pbGame.onLinkMode(mode); },
    // Safety net: reconcile with the authoritative state.
    pollFn: async () => {
      if (!_pbGame) return;
      const r = await _pbApi(`battle/state?battleId=${battleId}&since=${_pbLastTurn}`);
      if (r.ok && r.data && _pbGame.onServerState) _pbGame.onServerState(r.data);
    },
  });
  _pbLink.start();
  return _pbLink;
}
function _pbCloseLink() {
  if (_pbLink) { try { _pbLink.close(); } catch (e) {} _pbLink = null; }
}

async function _pbSendTurn(battleId, turn) {
  const r = await _pbApi('battle/turn', { method: 'POST', body: Object.assign({ battleId }, turn) });
  return (r.ok && r.data) ? r.data : null;
}

// ---- the game ----
function startPetBattleGame(view) {
  if (_pbGame) {
    if (!_pbGame.finished) return;                  // a live game keeps the screen
    try { _pbGame.destroy(); } catch (e) {}         // otherwise replace the stale one
    _pbGame = null;
  }
  const screen = document.getElementById('petBattleScreen');
  if (!screen || typeof PetBattleGame !== 'function') return;
  _pbLastTurn = 0;
  const link = _pbOpenLink(view.id);
  _pbGame = new PetBattleGame({
    view,
    mount: screen,
    link,
    // Relay first (instant for the opponent), then persist to D1.
    sendTurn: (turn) => {
      if (link) link.sendTurn(turn);
      return _pbSendTurn(view.id, turn);
    },
    onSeenTurn: (n) => { _pbLastTurn = Math.max(_pbLastTurn, n); },
    onFinish: (result) => finishPetBattle(result),
  });
  _pbGame.start();
}

// Battle over: BOTH players are paid (losing costs nothing).
function finishPetBattle(result) {
  const won = !!result.won;
  const coins = 20 + (won ? 30 : 0);
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coins;
    // NOTE: petBattleHistory — appState.battleHistory belongs to the older
    // local word-matching battle mode and has a different shape.
    if (!Array.isArray(appState.petBattleHistory)) appState.petBattleHistory = [];
    let date = 0; try { date = Date.now(); } catch (e) {}
    appState.petBattleHistory.unshift({ won, myHp: result.myHp, foeHp: result.foeHp, foe: result.foeName, date });
    if (appState.petBattleHistory.length > 100) appState.petBattleHistory.length = 100;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();
  if (won && typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  if (_pbGame && _pbGame.destroy) { try { _pbGame.destroy(); } catch (e) {} }  // stop the RAF loop
  _pbGame = null;
  _pbCloseLink();
  _pbState = null;
  _pbShowingResult = true;
  const screen = document.getElementById('petBattleScreen');
  if (screen) {
    screen.innerHTML = _pbShell(`
      <div class="pb-result-card ${won ? 'win' : 'lose'}">
        <div class="pb-result-emoji">${won ? '🏆' : '💪'}</div>
        <div class="pb-result-title">${won ? 'Chiến thắng!' : 'Thua rồi — lần sau cố lên!'}</div>
        <div class="pb-result-hp">${result.myHp} ❤️ &nbsp;vs&nbsp; ${result.foeHp} ❤️ ${pbEsc(result.foeName || '')}</div>
        <div class="pb-result-coins">+${coins} 🪙</div>
        <div class="pb-result-hint">Học tiếp 3 ngày để nạp đạn cho trận sau nhé! 🚀</div>
        <button class="pb-btn primary" onclick="closePetBattle()">Xong</button>
      </div>`);
  }
  refreshPetBattle();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openPetBattle, closePetBattle, refreshPetBattle, renderPetBattle,
    challengePetFriend, acceptPetBattle, declinePetBattle, finishPetBattle,
    pbEsc, pbFmtCountdown,
    _pbSetState: (s) => { _pbState = s; },
    _pbGetState: () => _pbState,
  };
}
