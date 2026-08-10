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

// ---- language ----
// The arena is where a child spends time voluntarily, so it defaults to
// ENGLISH — that is the point of the app. Vietnamese is one tap away when a
// word blocks them, and the choice deliberately does NOT persist: every visit
// starts in English again, so the easy language never becomes the habit.
let _pbLang = 'en';

const PB_STR = {
  en: {
    title: '⚔️ Arena',
    loading: 'Loading…',
    offline: '⚠️ You need internet (and to be signed in) to battle friends.',

    powLevel: 'Level', powNote: 'Higher level = bigger shells, stronger blasts',
    powBlast: 'Blast radius', powDamage: 'Damage per shot', powShell: 'Shell size',
    powPer10: '+{v} every 10 levels', powMaxed: 'Fully maxed 🎉',
    powBeyond: 'Past the level {n} mark 🎉 · ',
    powFoot: 'Maxes out at level {n} · level up by studying 📚',

    vsMine: 'Your pet', vsLevel: 'level {n}',
    vsStronger: 'Your pet is stronger! 💪',
    vsWeaker: 'Their pet is stronger — aim carefully! 🎯',
    vsEven: 'Evenly matched! ⚖️',

    ammoCap: 'shots earned from 3 days of study (max 20)',
    ammoVolume: 'Correct answers: {have}/{goal}',
    ammoVolumeRule: '{per} correct answers = 1 🚀',
    ammoVolumeHint: '{n} more answers for another 🚀',
    ammoPerfect: 'Perfect 10/10: {have}/{goal}',
    ammoPerfectRule: 'Each perfect 10/10 = 1 🚀',
    ammoPerfectHint: 'One more perfect session = 1 more 🚀',
    ammoStreak: 'Study days: {have}/{goal}',
    ammoStreakRule: 'All 3 days = +{per} 🚀',
    ammoStreakHint: '{n} more day(s) for +{per} 🚀',
    ammoStreakMaxed: 'All 3 days done 🎉',
    ammoMaxed: 'Maxed at {max} 🚀 🎉',

    inviteTitle: '⚔️ {name} challenges you!',
    inviteSub: 'Accept within <b>{n}</b> seconds',
    myAmmo: 'Your shots: <b>{n}</b> 🚀',
    fight: 'Fight! ⚔️', later: 'Later',
    noAmmoWarn: 'No shots yet — study to load up! 🚀',
    waitingTitle: '⏳ Waiting for {name}…',
    waitingSub: '<b>{n}</b> seconds left',
    waitingHint: 'Tell them to open the app to accept!',
    readyPick: '⚔️ Ready! Pick a friend to challenge:',
    noAmmoPick: '🚀 No shots yet. Study for 3 days to load up, then challenge!',
    cooldownTitle: '⏳ Next battle in <b>{t}</b>',
    cooldownSub: 'Study 3 days to load up! 🚀',
    noFriends: 'No friends to battle yet.', goFriends: '👥 Add a friend',

    histTitle: '📜 Battle history',
    histEmpty: 'No battles yet. Challenge a friend! ⚔️',
    histBattles: 'battles', histWins: 'wins', histLosses: 'losses', histWinRate: 'win rate',
    histDealt: 'damage dealt', histTaken: 'damage taken', histAccuracy: 'volleys on target',
    histShots: 'shots fired', histHitRate: 'volleys hit', histDamage: 'damage', histTakenShort: 'taken',
    histNoDetail: 'This battle has no round-by-round detail.',
    histLevel: 'lv {n}',
    turnYou: 'You', turnRound: 'R{n}',
    turnAim: '{shots} shots · {angle}° · power {power} · {wind}',
    windRight: 'wind →{n}', windLeft: 'wind ←{n}', windCalm: 'no wind',
    turnMiss: 'miss',

    errChallenge: "Couldn't send the challenge", errAccept: "Couldn't join the battle",
    cupWon: '+1 cup for the cabinet!',
    practiceBtn: '🤖 Practice vs bot', practiceSub: 'Full 20 shots · no waiting · no reward',
    practiceTitle: '🤖 Practice', practiceOver: 'Practice over',
    practiceWin: 'You beat the bot! 🎉', practiceLose: 'The bot won this one 💪',
    practiceNote: 'Practice earns no coins or cups — beat a friend for those! 🏆',
    practiceAgain: '🤖 Play again',

    // ---- the battle itself (js/petbattlegame.js) ----
    gMe: 'You', gFoe: 'Friend',
    gLive: '⚡ Live', gWaitPeer: '⚡ Waiting', gConnecting: '… Connecting', gSlow: '🐢 Slow',
    gRound: 'Round {n}/{total}',
    gYourTurn: 'YOUR TURN · AIM AND FIRE!', gFoeTurn: 'OPPONENT IS AIMING…',
    gAngle: 'ANGLE', gPower: 'POWER',
    gDragHint: 'DRAG TO AIM',
    gAimTitle: 'TAP OR DRAG ON THE BATTLEFIELD', gAimSub: 'The aim line sets both angle and power',
    gShots: '{n} POOP', gLoadAria: 'Load {n} poop',
    gFire: 'FIRE!', gFireHint: 'PRESS SPACE TO FIRE', gFireAria: 'Fire',
    gWaiting: 'WAITING', gWaitHint: 'OPPONENT IS PLAYING', gWaitAria: 'Waiting for the opponent',
    gControlsAria: 'Firing controls', gShotsAria: 'Number of poops', gEmotesAria: 'Quick reactions',
    gEmoteAria: 'Send reaction {e}',
    gCanvasAria: 'Artillery battlefield between two pets',
    gCanvasFallback: 'Artillery battlefield between two pets. Drag the aim line or use the controls below.',
    gCanvasHelp: 'Each pet sits inside a house. Hits damage the house and drain its hearts. Drag from the cannon on the battlefield to set angle and power. Arrow keys work when the battlefield is focused, and space fires.',
    gHit: '💩 {n} hit the house! -{d} HP', gHitMe: '💩 {n} hit your house! -{d} HP',
    gHouseWorse: ' · 💔 The house is falling apart!',
    gMiss: '💨 Missed!', gMissFoe: '💨 They missed!',
    gSkip: '⏭️ {name} skipped their turn',
    resultWin: 'Victory!', resultLose: 'Lost — get them next time!',
    resultHint: 'Keep studying for 3 days to load up for the next battle! 🚀',
    done: 'Done',
  },
  vi: {
    title: '⚔️ Đấu trường',
    loading: 'Đang tải…',
    offline: '⚠️ Cần mạng (và đăng nhập) để thi đấu với bạn bè.',

    powLevel: 'Cấp', powNote: 'Cấp càng cao, đạn càng to và nổ càng mạnh',
    powBlast: 'Bán kính nổ', powDamage: 'Sát thương mỗi phát', powShell: 'Cỡ đạn',
    powPer10: '+{v} mỗi 10 cấp', powMaxed: 'Đã đạt tối đa 🎉',
    powBeyond: 'Vượt mốc cấp {n} 🎉 · ',
    powFoot: 'Tối đa ở cấp {n} · lên cấp bằng cách học bài 📚',

    vsMine: 'Pet của bé', vsLevel: 'cấp {n}',
    vsStronger: 'Pet của bé mạnh hơn! 💪',
    vsWeaker: 'Pet bạn ấy mạnh hơn — ngắm thật chuẩn nhé! 🎯',
    vsEven: 'Ngang sức ngang tài! ⚖️',

    ammoCap: 'đạn kiếm được từ 3 ngày học (tối đa 20)',
    ammoVolume: 'Câu đúng: {have}/{goal}',
    ammoVolumeRule: '{per} câu đúng = 1 🚀',
    ammoVolumeHint: 'Còn {n} câu nữa là được thêm 1 🚀',
    ammoPerfect: 'Bài 10/10: {have}/{goal}',
    ammoPerfectRule: 'Mỗi bài đúng 10/10 = 1 🚀',
    ammoPerfectHint: 'Thêm 1 bài 10/10 là được thêm 1 🚀',
    ammoStreak: 'Ngày học: {have}/{goal}',
    ammoStreakRule: 'Học đủ 3 ngày = +{per} 🚀',
    ammoStreakHint: 'Còn {n} ngày nữa là được +{per} 🚀',
    ammoStreakMaxed: 'Đã đủ 3 ngày 🎉',
    ammoMaxed: 'Đã đạt tối đa {max} 🚀 🎉',

    inviteTitle: '⚔️ {name} thách đấu!',
    inviteSub: 'Nhận lời trong <b>{n}</b> giây',
    myAmmo: 'Đạn của bé: <b>{n}</b> 🚀',
    fight: 'Chiến! ⚔️', later: 'Để sau',
    noAmmoWarn: 'Bé chưa có đạn — học bài để nạp đạn nhé! 🚀',
    waitingTitle: '⏳ Đang chờ {name}…',
    waitingSub: 'Còn <b>{n}</b> giây',
    waitingHint: 'Nhớ bảo bạn ấy mở app để nhận lời mời nhé!',
    readyPick: '⚔️ Sẵn sàng! Chọn một người bạn để thách đấu:',
    noAmmoPick: '🚀 Chưa có đạn. Học bài trong 3 ngày để nạp đạn rồi thách đấu nhé!',
    cooldownTitle: '⏳ Trận sau sau <b>{t}</b>',
    cooldownSub: 'Học 3 ngày để nạp đạn! 🚀',
    noFriends: 'Chưa có bạn nào để thách đấu.', goFriends: '👥 Kết bạn ngay',

    histTitle: '📜 Lịch sử đấu',
    histEmpty: 'Chưa có trận nào. Thách đấu một người bạn nhé! ⚔️',
    histBattles: 'trận', histWins: 'thắng', histLosses: 'thua', histWinRate: 'tỉ lệ thắng',
    histDealt: 'sát thương gây ra', histTaken: 'sát thương nhận', histAccuracy: 'lượt bắn trúng',
    histShots: 'tia đã bắn', histHitRate: 'lượt trúng', histDamage: 'sát thương', histTakenShort: 'bị trúng',
    histNoDetail: 'Trận này chưa lưu chi tiết từng vòng.',
    histLevel: 'cấp {n}',
    turnYou: 'Bé', turnRound: 'V{n}',
    turnAim: '{shots} tia · {angle}° · lực {power} · {wind}',
    windRight: 'gió →{n}', windLeft: 'gió ←{n}', windCalm: 'lặng gió',
    turnMiss: 'trượt',

    errChallenge: 'Không gửi được lời thách đấu', errAccept: 'Không tham gia được',
    cupWon: '+1 cúp vào tủ cúp!',
    practiceBtn: '🤖 Luyện tập với máy', practiceSub: 'Đủ 20 đạn · không phải chờ · không có thưởng',
    practiceTitle: '🤖 Luyện tập', practiceOver: 'Hết trận luyện tập',
    practiceWin: 'Bé thắng máy rồi! 🎉', practiceLose: 'Máy thắng trận này 💪',
    practiceNote: 'Luyện tập không có xu và cúp — thắng bạn bè mới có nhé! 🏆',
    practiceAgain: '🤖 Chơi lại',

    // ---- the battle itself (js/petbattlegame.js) ----
    gMe: 'Bé', gFoe: 'Bạn',
    gLive: '⚡ Trực tiếp', gWaitPeer: '⚡ Chờ bạn', gConnecting: '… Đang nối', gSlow: '🐢 Chậm',
    gRound: 'Vòng {n}/{total}',
    gYourTurn: 'LƯỢT CỦA BẠN · NGẮM VÀ BẮN!', gFoeTurn: 'ĐỐI THỦ ĐANG NGẮM…',
    gAngle: 'GÓC', gPower: 'LỰC',
    gDragHint: 'KÉO ĐƯỜNG NGẮM',
    gAimTitle: 'CHẠM HOẶC KÉO TRÊN CHIẾN TRƯỜNG', gAimSub: 'Đường ngắm điều khiển cả góc và lực',
    gShots: '{n} VIÊN', gLoadAria: 'Nạp {n} viên phân',
    gFire: 'KHAI HỎA!', gFireHint: 'NHẤN SPACE ĐỂ BẮN', gFireAria: 'Bắn đạn',
    gWaiting: 'ĐANG CHỜ', gWaitHint: 'ĐỐI THỦ ĐANG CHƠI', gWaitAria: 'Đang chờ đối thủ',
    gControlsAria: 'Điều khiển bắn', gShotsAria: 'Số viên phân', gEmotesAria: 'Cảm xúc nhanh',
    gEmoteAria: 'Gửi cảm xúc {e}',
    gCanvasAria: 'Chiến trường pháo binh giữa hai thú cưng',
    gCanvasFallback: 'Chiến trường pháo binh giữa hai thú cưng. Kéo đường ngắm hoặc dùng điều khiển bên dưới.',
    gCanvasHelp: 'Mỗi thú cưng ở trong một ngôi nhà. Đạn trúng sẽ làm hỏng nhà và giảm tim. Kéo từ khẩu pháo trên chiến trường để chỉnh góc và lực. Có thể dùng phím mũi tên khi chiến trường được chọn, và nhấn phím cách để bắn.',
    gHit: '💩 {n} viên trúng nhà! -{d} HP', gHitMe: '💩 {n} viên trúng nhà bé! -{d} HP',
    gHouseWorse: ' · 💔 Nhà sắp sập!',
    gMiss: '💨 Trượt rồi!', gMissFoe: '💨 Bạn ấy bắn trượt!',
    gSkip: '⏭️ {name} bỏ lượt',
    resultWin: 'Chiến thắng!', resultLose: 'Thua rồi — lần sau cố lên!',
    resultHint: 'Học tiếp 3 ngày để nạp đạn cho trận sau nhé! 🚀',
    done: 'Xong',
  },
};

function pbT(key, vars) {
  const table = PB_STR[_pbLang] || PB_STR.en;
  let s = (key in table) ? table[key] : PB_STR.en[key];
  if (s === undefined) return key;                  // a missing key shows itself
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

function pbSetLang(lang) {
  _pbLang = (lang === 'vi') ? 'vi' : 'en';
  renderPetBattle();
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
  _pbLang = 'en';                 // every visit starts in English, by design
  _pbHistoryOpen = -1;
  if (typeof switchScreen === 'function') switchScreen('petBattleScreen');
  renderPetBattle();
  refreshPetBattle();
  _pbStartPolling();
}
function closePetBattle() {
  _pbShowingResult = false;
  if (typeof botClearGame === 'function') botClearGame();
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
        <h1 class="pb-title">${pbT('title')}</h1>
        <div class="pb-lang" role="group" aria-label="Language">
          <button class="pb-flag ${_pbLang === 'en' ? 'on' : ''}" onclick="pbSetLang('en')"
                  aria-pressed="${_pbLang === 'en'}">🇬🇧<span>EN</span></button>
          <button class="pb-flag ${_pbLang === 'vi' ? 'on' : ''}" onclick="pbSetLang('vi')"
                  aria-pressed="${_pbLang === 'vi'}">🇻🇳<span>VI</span></button>
        </div>
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
    const growth = maxed ? pbT('powMaxed') : pbT('powPer10', { v: n1(s.per10) });
    return `
      <div class="pb-pow-row">
        <div class="pb-pow-head">
          <span>${s.icon} ${pbT('pow' + s.key.charAt(0).toUpperCase() + s.key.slice(1))}</span>
          <b>${n1(s.value)}${s.beyond ? '' : `<small>/${n1(s.max)}</small>`}</b>
        </div>
        <div class="pb-pow-bar"><i style="width:${pct}%"></i></div>
        <div class="pb-pow-hint">${s.beyond ? pbT('powBeyond', { n: p.refLevel }) : ''}${growth}</div>
      </div>`;
  }).join('');

  return `
    <div class="pb-pow-card">
      <div class="pb-pow-top">
        <div class="pb-pow-face">${face}</div>
        <div class="pb-pow-id">
          <div class="pb-pow-name">${pbEsc(pet.petName)}</div>
          <div class="pb-pow-level">${pbT('powLevel')} <b>${p.level}</b></div>
          <div class="pb-pow-note">${pbT('powNote')}</div>
        </div>
      </div>
      <div class="pb-pow-rows">${rows}</div>
      <div class="pb-pow-foot">${pbT('powFoot', { n: p.refLevel })}</div>
    </div>`;
}

// "Bé cấp 42 vs cấp 30" — a child sizing up an opponent should see whose pet
// is stronger before accepting.
function _pbVersusLine(b) {
  const mine = _pbMyPet().level;
  const theirs = (b && b.foe && b.foe.level) || 1;
  const verdict = mine > theirs ? pbT('vsStronger')
    : mine < theirs ? pbT('vsWeaker')
    : pbT('vsEven');
  return `<div class="pb-versus">${pbT('vsMine')} <b>${pbT('vsLevel', { n: mine })}</b>
    &nbsp;vs&nbsp; <b>${pbT('vsLevel', { n: theirs })}</b>
    <div class="pb-versus-note">${verdict}</div></div>`;
}

function _pbAmmoPanel(st) {
  const rows = (typeof ammoBreakdown === 'function' ? ammoBreakdown(st.stats || {}) : [])
    .map(r => {
      // Progress bar toward the NEXT shot, not the whole row — a child two
      // answers away should see a nearly-full bar, not a barely-moved one.
      const pct = r.max ? Math.round(r.shots / r.max * 100) : 0;
      const K = r.key.charAt(0).toUpperCase() + r.key.slice(1);
      const label = pbT('ammo' + K, { have: r.have, goal: r.goal });
      const rule = pbT('ammo' + K + 'Rule', { per: r.per });
      const hint = r.maxed
        ? (r.key === 'streak' ? pbT('ammoStreakMaxed') : pbT('ammoMaxed', { max: r.max }))
        : pbT('ammo' + K + 'Hint', { n: r.toNext, per: r.per });
      return `
      <div class="pb-ammo-row">
        <div class="pb-ammo-head">
          <span class="pb-ammo-label">${label}</span>
          <b>+${r.shots}<small>/${r.max}</small> 🚀</b>
        </div>
        <div class="pb-ammo-bar"><i style="width:${pct}%"></i></div>
        <div class="pb-ammo-hint"><span class="pb-ammo-rule">${rule}</span>${hint ? ' · ' + hint : ''}</div>
      </div>`;
    })
    .join('');
  return `
    <div class="pb-ammo-card">
      <div class="pb-ammo-total">${st.ammo} 🚀</div>
      <div class="pb-ammo-cap">${pbT('ammoCap')}</div>
      <div class="pb-ammo-rows">${rows}</div>
    </div>`;
}

function renderPetBattle() {
  const screen = document.getElementById('petBattleScreen');
  if (!screen) return;
  if (_pbGame) return;                       // the running game owns the screen
  if (_pbShowingResult) return;              // …and so does the result card

  const st = _pbState;
  if (!st) { screen.innerHTML = _pbShell(`<div class="pb-empty">${pbT('loading')}</div>`); return; }
  if (st.offline) {
    screen.innerHTML = _pbShell(`<div class="pb-empty">${pbT('offline')}</div>`);
    return;
  }

  const b = st.battle;
  if (b && b.status === 'invited' && !b.iAmChallenger) {
    const left = Math.max(0, (b.expiresAt || 0) - Date.now());
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">${pbT('inviteTitle', { name: pbEsc(b.foe.name || '?') })}</div>
        <div class="pb-invite-sub">${pbT('inviteSub', { n: Math.ceil(left / 1000) })}</div>
        ${_pbVersusLine(b)}
        <div class="pb-ammo-line">${pbT('myAmmo', { n: st.ammo })}</div>
        <div class="pb-invite-actions">
          <button class="pb-btn primary" onclick="acceptPetBattle(${b.id})" ${st.ammo <= 0 ? 'disabled' : ''}>${pbT('fight')}</button>
          <button class="pb-btn" onclick="declinePetBattle(${b.id})">${pbT('later')}</button>
        </div>
        ${st.ammo <= 0 ? `<div class="pb-warn">${pbT('noAmmoWarn')}</div>` : ''}
      </div>`);
    return;
  }
  if (b && b.status === 'invited' && b.iAmChallenger) {
    const left = Math.max(0, (b.expiresAt || 0) - Date.now());
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">${pbT('waitingTitle', { name: pbEsc(b.foe.name || '?') })}</div>
        <div class="pb-invite-sub">${pbT('waitingSub', { n: Math.ceil(left / 1000) })}</div>
        <div class="pb-hint">${pbT('waitingHint')}</div>
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
         ${pbT('noFriends')}
         <button class="pb-btn primary pb-go-friends" onclick="pbGoToFriends()">${pbT('goFriends')}</button>
       </div>`;

  screen.innerHTML = _pbShell(`
    ${_pbPowerPanel()}
    ${_pbAmmoPanel(st)}
    ${ready
      ? (st.ammo > 0
          ? `<div class="pb-ready">${pbT('readyPick')}</div>`
          : `<div class="pb-warn">${pbT('noAmmoPick')}</div>`)
      : `<div class="pb-cooldown">
           <div class="pb-cooldown-title">${pbT('cooldownTitle', { t: pbFmtCountdown(st.readyAt - Date.now()) })}</div>
           <div class="pb-cooldown-sub">${pbT('cooldownSub')}</div>
         </div>`}
    <div class="pb-friend-list">${list}</div>
    ${_pbMsg ? `<div class="pb-msg">${pbEsc(_pbMsg)}</div>` : ''}
    ${st.allowBot ? `
      <div class="pb-practice-card">
        <button class="pb-btn primary pb-practice-btn" onclick="startBotBattle()">${pbT('practiceBtn')}</button>
        <div class="pb-practice-sub">${pbT('practiceSub')}</div>
      </div>` : ''}
    ${_pbHistoryPanel()}`);
}

// ---- battle history ----
// Every battle was already being recorded and then never shown. Summary +
// per-battle detail, read straight from appState (works offline).
let _pbHistoryOpen = -1;      // index of the battle whose detail is expanded

function _pbHistory() {
  try { return (typeof appState !== 'undefined' && Array.isArray(appState.petBattleHistory)) ? appState.petBattleHistory : []; }
  catch (e) { return []; }
}

function pbHistorySummary(list) {
  const h = Array.isArray(list) ? list : _pbHistory();
  const wins = h.filter(b => b.won).length;
  const sum = (k) => h.reduce((n, b) => n + (b[k] || 0), 0);
  const volleys = sum('volleys');
  return {
    total: h.length,
    wins,
    losses: h.length - wins,
    winRate: h.length ? Math.round(wins / h.length * 100) : 0,
    damageDealt: sum('damageDealt'),
    damageTaken: sum('damageTaken'),
    accuracy: volleys ? Math.round(sum('hits') / volleys * 100) : 0,
    bestWin: h.filter(b => b.won).reduce((best, b) => (b.myHp > (best ? best.myHp : -1) ? b : best), null),
  };
}

function pbFmtDate(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) { return ''; }
}

function togglePbHistory(i) {
  _pbHistoryOpen = (_pbHistoryOpen === i) ? -1 : i;
  renderPetBattle();
}

function _pbHistoryDetail(b) {
  // Battles fought before this screen existed have no round log. Say so
  // plainly rather than rendering an empty box.
  if (!Array.isArray(b.rounds) || !b.rounds.length) {
    return `<div class="pb-hist-empty">${pbT('histNoDetail')}</div>`;
  }
  const rows = b.rounds.map(r => {
    const who = r.mine ? pbT('turnYou') : pbEsc(b.foe || '?');
    const windTxt = r.wind > 0 ? pbT('windRight', { n: r.wind })
      : r.wind < 0 ? pbT('windLeft', { n: Math.abs(r.wind) }) : pbT('windCalm');
    const res = r.damage > 0 ? `<b class="hit">-${r.damage} HP</b>` : `<span class="miss">${pbT('turnMiss')}</span>`;
    return `
      <div class="pb-hist-turn ${r.mine ? 'mine' : 'theirs'}">
        <span class="pb-hist-round">${pbT('turnRound', { n: r.round })}</span>
        <span class="pb-hist-who">${who}</span>
        <span class="pb-hist-aim">${pbT('turnAim', { shots: r.shots, angle: r.angle, power: r.power, wind: windTxt })}</span>
        ${res}
      </div>`;
  }).join('');

  return `
    <div class="pb-hist-detail">
      <div class="pb-hist-stats">
        <div><b>${b.shotsFired || 0}</b><span>${pbT('histShots')}</span></div>
        <div><b>${b.volleys ? Math.round((b.hits || 0) / b.volleys * 100) : 0}%</b><span>${pbT('histHitRate')}</span></div>
        <div><b>${b.damageDealt || 0}</b><span>${pbT('histDamage')}</span></div>
        <div><b>${b.damageTaken || 0}</b><span>${pbT('histTakenShort')}</span></div>
      </div>
      <div class="pb-hist-turns">${rows}</div>
    </div>`;
}

function _pbHistoryPanel() {
  const h = _pbHistory();
  if (!h.length) {
    return `<div class="pb-hist-card"><div class="pb-hist-title">${pbT('histTitle')}</div>
      <div class="pb-hist-empty">${pbT('histEmpty')}</div></div>`;
  }
  const s = pbHistorySummary(h);
  const rows = h.slice(0, 20).map((b, i) => {
    const open = _pbHistoryOpen === i;
    return `
      <div class="pb-hist-item ${b.won ? 'win' : 'lose'}">
        <button class="pb-hist-row" onclick="togglePbHistory(${i})">
          <span class="pb-hist-badge">${b.won ? '🏆' : '💪'}</span>
          <span class="pb-hist-main">
            <span class="pb-hist-foe">${pbEsc(b.foe || '?')}${b.foeLevel ? ` <small>${pbT('histLevel', { n: b.foeLevel })}</small>` : ''}</span>
            <span class="pb-hist-date">${pbFmtDate(b.date)}</span>
          </span>
          <span class="pb-hist-score">${b.myHp} ❤️ – ${b.foeHp} ❤️</span>
          <span class="pb-hist-caret">${open ? '▾' : '›'}</span>
        </button>
        ${open ? _pbHistoryDetail(b) : ''}
      </div>`;
  }).join('');

  return `
    <div class="pb-hist-card">
      <div class="pb-hist-title">${pbT('histTitle')}</div>
      <div class="pb-hist-summary">
        <div><b>${s.total}</b><span>${pbT('histBattles')}</span></div>
        <div class="win"><b>${s.wins}</b><span>${pbT('histWins')}</span></div>
        <div class="lose"><b>${s.losses}</b><span>${pbT('histLosses')}</span></div>
        <div><b>${s.winRate}%</b><span>${pbT('histWinRate')}</span></div>
      </div>
      <div class="pb-hist-summary sub">
        <div><b>${s.damageDealt}</b><span>${pbT('histDealt')}</span></div>
        <div><b>${s.damageTaken}</b><span>${pbT('histTaken')}</span></div>
        <div><b>${s.accuracy}%</b><span>${pbT('histAccuracy')}</span></div>
      </div>
      <div class="pb-hist-list">${rows}</div>
    </div>`;
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
  _pbMsg = r.ok ? '' : ((r.data && r.data.error) || pbT('errChallenge'));
  await refreshPetBattle();
}
async function acceptPetBattle(battleId) {
  const r = await _pbApi('battle/respond', { method: 'POST', body: Object.assign({ battleId, accept: true }, _pbMyPet()) });
  _pbMsg = r.ok ? '' : ((r.data && r.data.error) || pbT('errAccept'));
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

// ---- 🤖 practice vs bot (admin-unlocked, entirely local) ----
function startBotBattle() {
  if (_pbGame && !_pbGame.finished) return;
  const screen = document.getElementById('petBattleScreen');
  if (!screen || typeof PetBattleGame !== 'function' || typeof botSetGame !== 'function') return;
  if (_pbGame) { try { _pbGame.destroy(); } catch (e) {} _pbGame = null; }
  _pbShowingResult = false;

  const pet = _pbMyPet();
  let seed = 1;
  try { seed = (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1; } catch (e) {}

  // The bot mirrors the child's own pet level, so practice measures aim
  // rather than who has been studying longer.
  const view = {
    id: 0, status: 'active', seed, iAmChallenger: true, turnNo: 1, myTurn: true,
    me: { id: -1, name: pet.petName, ammo: BOT_AMMO, level: pet.level, stage: pet.stage, hp: BOT_HP },
    foe: { id: -2, name: '🤖 Bot', ammo: BOT_AMMO, level: pet.level, stage: 'husky', hp: BOT_HP },
  };

  _pbStopPolling();                 // practice talks to nobody
  _pbGame = new PetBattleGame({
    view,
    mount: screen,
    link: null,
    // A remote opponent replies through the network; the bot replies here.
    // Same entry point, so the game code cannot tell them apart.
    sendTurn: (turn) => { botOnPlayerTurnDone(); return Promise.resolve(null); },
    onFinish: (result) => finishPetBattle(result),
  });
  botSetGame(_pbGame);
  _pbGame.start();
}

// Practice pays NOTHING: no coins, no cup, no history row. Only the aim
// practice is real, and that is the point of it.
function finishBotBattle(result) {
  const won = !!result.won;
  if (_pbGame && _pbGame.destroy) { try { _pbGame.destroy(); } catch (e) {} }
  _pbGame = null;
  if (typeof botClearGame === 'function') botClearGame();
  _pbShowingResult = true;
  const screen = document.getElementById('petBattleScreen');
  if (screen) {
    screen.innerHTML = _pbShell(`
      <div class="pb-result-card ${won ? 'win' : 'lose'}">
        <div class="pb-result-emoji">${won ? '🎯' : '🤖'}</div>
        <div class="pb-result-title">${won ? pbT('practiceWin') : pbT('practiceLose')}</div>
        <div class="pb-result-hp">${result.myHp} ❤️ &nbsp;vs&nbsp; ${result.foeHp} ❤️ 🤖</div>
        <div class="pb-practice-note">${pbT('practiceNote')}</div>
        <div class="pb-invite-actions">
          <button class="pb-btn primary" onclick="_pbShowingResult=false;startBotBattle()">${pbT('practiceAgain')}</button>
          <button class="pb-btn" onclick="_pbShowingResult=false;closePetBattle()">${pbT('done')}</button>
        </div>
      </div>`);
  }
}

// Battle over: BOTH players are paid (losing costs nothing).
function finishPetBattle(result) {
  if (result && result.practice) return finishBotBattle(result);   // practice pays nothing
  const won = !!result.won;
  const coins = 20 + (won ? 30 : 0);
  // A trophy has to mean a real friend was beaten, so it is awarded here and
  // nowhere else — never on the practice path above.
  if (won && typeof awardCup === 'function') { try { awardCup(1); } catch (e) {} }
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coins;
    // NOTE: petBattleHistory — appState.battleHistory belongs to the older
    // local word-matching battle mode and has a different shape.
    if (!Array.isArray(appState.petBattleHistory)) appState.petBattleHistory = [];
    let date = 0; try { date = Date.now(); } catch (e) {}
    // Enough detail to replay the story of the battle later — the old entry
    // kept only the final score, so a "history" was four numbers and a name.
    const rounds = Array.isArray(result.rounds) ? result.rounds : [];
    const mine = rounds.filter(r => r.mine);
    const theirs = rounds.filter(r => !r.mine);
    const sum = (list, k) => list.reduce((n, r) => n + (r[k] || 0), 0);
    appState.petBattleHistory.unshift({
      won, myHp: result.myHp, foeHp: result.foeHp, foe: result.foeName, date, coins,
      myLevel: result.myLevel || 1, foeLevel: result.foeLevel || 1,
      shotsFired: sum(mine, 'shots'),
      hits: mine.filter(r => r.damage > 0).length,
      volleys: mine.length,
      damageDealt: sum(mine, 'damage'),
      damageTaken: sum(theirs, 'damage'),
      rounds,
    });
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
        <div class="pb-result-title">${won ? pbT('resultWin') : pbT('resultLose')}</div>
        <div class="pb-result-hp">${result.myHp} ❤️ &nbsp;vs&nbsp; ${result.foeHp} ❤️ ${pbEsc(result.foeName || '')}</div>
        <div class="pb-result-coins">+${coins} 🪙</div>
        ${won ? `<div class="pb-result-cup">🏆 ${pbT('cupWon')}</div>` : ''}
        <div class="pb-result-hint">${pbT('resultHint')}</div>
        <button class="pb-btn primary" onclick="closePetBattle()">${pbT('done')}</button>
      </div>`);
  }
  refreshPetBattle();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openPetBattle, closePetBattle, refreshPetBattle, renderPetBattle,
    challengePetFriend, acceptPetBattle, declinePetBattle, finishPetBattle,
    pbEsc, pbFmtCountdown, pbFmtDate, pbHistorySummary, togglePbHistory,
    pbT, pbSetLang, PB_STR, _pbGetLang: () => _pbLang,
    startBotBattle, finishBotBattle,
    _pbHistoryPanel, _pbHistoryDetail, _pbPowerPanel, _pbVersusLine, pbGoToFriends,
    _pbSetState: (s) => { _pbState = s; },
    _pbGetState: () => _pbState,
  };
}
