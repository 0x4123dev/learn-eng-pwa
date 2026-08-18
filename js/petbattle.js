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
let _pbSceneId = null;           // committed locally; snapshotted on a friend challenge

// The lobby polls fast so a 60-second invite shows up promptly; a running
// battle is driven by the relay, so its tick is just a cheap keepalive. The
// old names said the opposite of what the expression does.
const PB_POLL_INGAME_MS = 5000;
const PB_POLL_LOBBY_MS = 1000;

function pbEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pbSelectedSceneId() {
  if (_pbSceneId) return _pbSceneId;
  let saved = '';
  try { saved = localStorage.getItem('petBattleScene') || ''; } catch (e) {}
  if (!saved && typeof appState !== 'undefined' && appState) saved = appState.petBattleScene || '';
  _pbSceneId = (typeof BattleScenes !== 'undefined')
    ? BattleScenes.normalizeBattleSceneId(saved) : (saved || 'cloudstep-meadow');
  return _pbSceneId;
}

function choosePetBattleScene(id) {
  _pbSceneId = (typeof BattleScenes !== 'undefined')
    ? BattleScenes.normalizeBattleSceneId(id) : String(id || 'cloudstep-meadow');
  try { localStorage.setItem('petBattleScene', _pbSceneId); } catch (e) {}
  if (typeof appState !== 'undefined' && appState) {
    appState.petBattleScene = _pbSceneId;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  renderPetBattle();
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

    hireTitle: '⚔️ Hire teammates',
    hireSub: 'They fight from inside your castle. One use each, this battle only.',
    hireCoins: '🪙 {n}',
    hireTotal: 'Squad cost: {n} 🪙',
    hireFull: 'Bench full ({n} max)',
    hireNone: 'No teammates — save your coins for pet food 🍖',
    hirePoor: 'Not enough coins',
    hireGunner: 'Gunner', hireGunnerAb: 'Fires a rocket along your next shot',
    hireEngineer: 'Engineer', hireEngineerAb: 'Repairs your castle +15 HP',
    hireShield: 'Guard', hireShieldAb: 'Halves the next volley that hits you',

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
    // A new friendship has to age 3 days before it can be fought — the same
    // 3 days shots are earned over. The server decides; this only shows it.
    friendNewDays: '⏳ {n} days to go', friendNewDay1: '⏳ 1 day to go', friendNewSoon: '⏳ Ready soon',
    friendAllNew: '⏳ Your friends are still new — battles open 3 days after you connect. Keep studying! 🚀',
    friendNewWhy: '⏳ New friends can battle after 3 days — study to load up! 🚀',

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
    cupWonBig: '🏆 A CUP IS YOURS!',
    cupNextRuby: 'Only {n} more and these become a RUBY CUP',
    cupNextDiamond: '{n} more ruby cups and the DIAMOND CUP is yours',
    cupTopReached: 'You hold a Diamond Cup 👑',
    cupDiamondName: 'DIAMOND CUP',
    cupDiamondGoal: 'The rarest of all — {n} wins to forge one',
    cupLadder: '{n} cups = 1 ruby · {n} rubies = 1 diamond',
    cupPracticeTease: 'A real friend battle would have won you this 👇',
    cupLoseTease: 'So close! Win the next one and this cup is yours 👇',
    cupCabinetCta: 'Your cabinet is in Profile → 🏆 Cup shelf',
    practiceBtn: '🤖 Practice vs bot', practiceSub: 'Full 20 shots · no waiting · no reward',
    practiceTitle: '🤖 Practice', practiceOver: 'Practice over',
    practiceWin: 'You beat the bot! 🎉', practiceLose: 'The bot won this one 💪',
    practiceNote: 'Practice earns no coins or cups — beat a friend for those! 🏆',
    practiceAgain: '🤖 Play again',
    sceneTitle: 'Choose your arena', sceneHint: 'Swipe to explore 10 worlds', sceneAria: 'Battle arena',
    sceneInvite: 'Arena selected by the challenger',

    // ---- the battle itself (js/petbattlegame.js) ----
    gMe: 'You', gFoe: 'Friend',
    gLive: '⚡ Live', gWaitPeer: '⚡ Waiting', gConnecting: '… Connecting', gSlow: '🐢 Slow',
    gRound: 'Round {n}',
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
    gCanvasHelp: 'Each pet guards a castle. Hits break away castle walls and drain its hearts. Drag from the cannon on the battlefield to set angle and power. Arrow keys work when the battlefield is focused, and space fires.',
    gHit: '💩 {n} hit the castle! -{d} HP', gHitMe: '💩 {n} hit your castle! -{d} HP',
    gHouseWorse: ' · 💔 A large wall section collapsed!',
    gMiss: '💨 Missed!', gMissFoe: '💨 They missed!',
    gSkip: '⏭️ {name} skipped their turn',
    gGoMe: 'My dog', gGoCentre: 'Centre', gGoFoe: 'Opponent',
    gFollowShot: '🎯 Follow shot',
    gMinimapAria: 'Battlefield map: your castle, the opponent, and where you are looking',
    gAnchorsAria: 'Jump the view',
    gFieldStatusAria: 'Health, poop left, level and wind',
    gManualAria: 'Set angle and power by hand',
    gAngleLess: 'Lower the angle by one degree', gAngleMore: 'Raise the angle by one degree',
    gPowerLess: 'Reduce the power by one', gPowerMore: 'Increase the power by one',
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

    hireTitle: '⚔️ Thuê đồng đội',
    hireSub: 'Đồng đội đứng trong lâu đài. Mỗi người dùng được 1 lần, chỉ trận này.',
    hireCoins: '🪙 {n}',
    hireTotal: 'Tiền thuê: {n} 🪙',
    hireFull: 'Đã đủ quân ({n} người)',
    hireNone: 'Chưa thuê ai — để dành xu mua đồ ăn cho pet 🍖',
    hirePoor: 'Không đủ xu',
    hireGunner: 'Pháo thủ', hireGunnerAb: 'Bắn tên lửa theo đúng đường đạn của bé',
    hireEngineer: 'Kỹ sư', hireEngineerAb: 'Sửa lâu đài +15 HP',
    hireShield: 'Vệ sĩ', hireShieldAb: 'Giảm một nửa loạt đạn sắp trúng bé',

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
    friendNewDays: '⏳ còn {n} ngày', friendNewDay1: '⏳ còn 1 ngày', friendNewSoon: '⏳ sắp được rồi',
    friendAllNew: '⏳ Bạn bè còn mới — sau 3 ngày kết bạn mới đấu được. Học tiếp nhé! 🚀',
    friendNewWhy: '⏳ Bạn mới phải chờ 3 ngày mới đấu được — học bài để nạp đạn nhé! 🚀',

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
    cupWonBig: '🏆 BÉ ĐƯỢC MỘT CHIẾC CÚP!',
    cupNextRuby: 'Chỉ còn {n} cúp nữa là thành CÚP RUBY',
    cupNextDiamond: 'Còn {n} cúp ruby nữa là có CÚP KIM CƯƠNG',
    cupTopReached: 'Bé đang giữ Cúp Kim Cương 👑',
    cupDiamondName: 'CÚP KIM CƯƠNG',
    cupDiamondGoal: 'Hiếm nhất — cần {n} trận thắng mới có',
    cupLadder: '{n} cúp = 1 ruby · {n} ruby = 1 kim cương',
    cupPracticeTease: 'Thắng bạn bè thật thì bé đã có cúp này 👇',
    cupLoseTease: 'Suýt nữa rồi! Thắng trận sau là cúp này của bé 👇',
    cupCabinetCta: 'Tủ cúp của bé ở Hồ sơ → 🏆 Tủ cúp',
    practiceBtn: '🤖 Luyện tập với máy', practiceSub: 'Đủ 20 đạn · không phải chờ · không có thưởng',
    practiceTitle: '🤖 Luyện tập', practiceOver: 'Hết trận luyện tập',
    practiceWin: 'Bé thắng máy rồi! 🎉', practiceLose: 'Máy thắng trận này 💪',
    practiceNote: 'Luyện tập không có xu và cúp — thắng bạn bè mới có nhé! 🏆',
    practiceAgain: '🤖 Chơi lại',
    sceneTitle: 'Chọn đấu trường', sceneHint: 'Vuốt để khám phá 10 thế giới', sceneAria: 'Đấu trường',
    sceneInvite: 'Đấu trường do người thách đấu chọn',

    // ---- the battle itself (js/petbattlegame.js) ----
    gMe: 'Bé', gFoe: 'Bạn',
    gLive: '⚡ Trực tiếp', gWaitPeer: '⚡ Chờ bạn', gConnecting: '… Đang nối', gSlow: '🐢 Chậm',
    gRound: 'Vòng {n}',
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
    gCanvasHelp: 'Mỗi thú cưng bảo vệ một lâu đài. Đạn trúng sẽ phá vỡ từng mảng tường và giảm tim. Kéo từ khẩu pháo trên chiến trường để chỉnh góc và lực. Có thể dùng phím mũi tên khi chiến trường được chọn, và nhấn phím cách để bắn.',
    gHit: '💩 {n} viên trúng lâu đài! -{d} HP', gHitMe: '💩 {n} viên trúng lâu đài của bé! -{d} HP',
    gHouseWorse: ' · 💔 Một mảng tường lớn đã sập!',
    gMiss: '💨 Trượt rồi!', gMissFoe: '💨 Bạn ấy bắn trượt!',
    gSkip: '⏭️ {name} bỏ lượt',
    gGoMe: 'Chó của bé', gGoCentre: 'Giữa sân', gGoFoe: 'Đối thủ',
    gFollowShot: '🎯 Bám theo đạn',
    gMinimapAria: 'Bản đồ chiến trường: nhà bé, đối thủ, và chỗ bé đang nhìn',
    gAnchorsAria: 'Nhảy tới vị trí',
    gFieldStatusAria: 'Máu, số phân còn lại, cấp và gió',
    gManualAria: 'Chỉnh góc và lực bằng tay',
    gAngleLess: 'Giảm góc một độ', gAngleMore: 'Tăng góc một độ',
    gPowerLess: 'Giảm lực một đơn vị', gPowerMore: 'Tăng lực một đơn vị',
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
// ---- hiring đồng đội ----
// OFF until the abilities actually fire. The lobby panel, the coin debit and
// the castle bench are all in place, but a triggered charge does nothing yet —
// shipping this half-built would let a child pay 1,400 xu for a Vệ sĩ that
// never raises a shield. Flip to true in the same change that lands the
// trigger chips and the server's field_version 4.
const PB_TEAMMATES_ENABLED = false;

// The cart lives here, not in appState: a squad is hired FOR ONE BATTLE, so
// abandoning the lobby must not leave a phantom bench (or a phantom bill)
// behind. Coins are only debited when a battle actually starts.
let _pbHires = [];

function pbHireCart() { return _pbHires.slice(); }
function pbHireReset() { _pbHires = []; }

function _pbTeam() {
  return (typeof BattleTeam !== 'undefined' && BattleTeam.TEAM_ROSTER) ? BattleTeam : null;
}

function _pbCoins() {
  return (typeof appState !== 'undefined' && appState) ? (appState.coins || 0) : 0;
}

function pbHire(id) {
  const TEAM = _pbTeam();
  if (!TEAM) return;
  _pbHires = TEAM.hireAdd(_pbHires, id, _pbCoins());
  renderPetBattle();
}

function pbUnhire(id) {
  const TEAM = _pbTeam();
  if (!TEAM) return;
  _pbHires = TEAM.hireRemove(_pbHires, id);
  renderPetBattle();
}

// Spend the squad's wages. Called once, when a battle actually begins — win or
// lose the coins are gone, which is what makes the choice cost something.
function pbHireCommit() {
  if (!PB_TEAMMATES_ENABLED) return [];
  const TEAM = _pbTeam();
  if (!TEAM) return [];
  const squad = TEAM.normalizeHires(_pbHires);
  const cost = TEAM.hireCost(squad);
  if (typeof appState !== 'undefined' && appState && cost > 0) {
    if ((appState.coins || 0) < cost) return [];      // purse changed under us
    appState.coins -= cost;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      saveUserData(currentUser, appState);
    }
  }
  _pbHires = [];
  return squad;
}

const PB_HIRE_LABEL = { gunner: 'hireGunner', engineer: 'hireEngineer', shield: 'hireShield' };
const PB_HIRE_ABILITY = { gunner: 'hireGunnerAb', engineer: 'hireEngineerAb', shield: 'hireShieldAb' };

function _pbHirePanel() {
  if (!PB_TEAMMATES_ENABLED) return '';
  const TEAM = _pbTeam();
  if (!TEAM) return '';
  const coins = _pbCoins();
  const cart = TEAM.normalizeHires(_pbHires);
  const total = TEAM.hireCost(cart);
  const full = cart.length >= TEAM.TEAM_MAX_HIRES;

  const cards = TEAM.TEAM_ROSTER.map(mate => {
    const owned = cart.filter(id => id === mate.id).length;
    // Ask the cart itself whether this hire would go through, so a button can
    // never promise something the purchase would then refuse.
    const canAdd = TEAM.hireAdd(cart, mate.id, coins).length > cart.length;
    const why = full ? pbT('hireFull', { n: TEAM.TEAM_MAX_HIRES })
              : !canAdd ? pbT('hirePoor') : '';
    return `
      <div class="pb-hire-card${owned ? ' has' : ''}">
        <span class="pb-hire-emoji">${mate.emoji}</span>
        <div class="pb-hire-info">
          <div class="pb-hire-name">${pbT(PB_HIRE_LABEL[mate.id])}</div>
          <div class="pb-hire-ability">${pbT(PB_HIRE_ABILITY[mate.id])}</div>
          <div class="pb-hire-fee">${pbT('hireCoins', { n: mate.fee })}${why ? ' · ' + why : ''}</div>
        </div>
        <div class="pb-hire-steps">
          <button class="pb-hire-step" onclick="pbUnhire('${mate.id}')" ${owned ? '' : 'disabled'}>−</button>
          <span class="pb-hire-count">${owned}</span>
          <button class="pb-hire-step" onclick="pbHire('${mate.id}')" ${canAdd ? '' : 'disabled'}>+</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="pb-hire-panel">
      <div class="pb-hire-head">
        <span class="pb-hire-title">${pbT('hireTitle')}</span>
        <span class="pb-hire-purse">${pbT('hireCoins', { n: coins })}</span>
      </div>
      <div class="pb-hire-sub">${pbT('hireSub')}</div>
      <div class="pb-hire-list">${cards}</div>
      <div class="pb-hire-total">${cart.length ? pbT('hireTotal', { n: total }) : pbT('hireNone')}</div>
    </div>`;
}

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

function _pbScenePicker() {
  if (typeof BattleScenes === 'undefined') return '';
  const selected = pbSelectedSceneId();
  const lang = _pbLang === 'vi' ? 'vi' : 'en';
  return `<section class="pb-scene-picker" aria-labelledby="pbScenePickerTitle">
    <div class="pb-scene-picker-head">
      <strong id="pbScenePickerTitle">${pbT('sceneTitle')}</strong><span>${pbT('sceneHint')}</span>
    </div>
    <div class="pb-scene-list" role="radiogroup" aria-label="${pbEsc(pbT('sceneAria'))}">
      ${BattleScenes.scenes.map(scene => {
        const on = scene.id === selected;
        return `<button type="button" class="pb-scene-option" role="radio" aria-checked="${on}"
                  onclick="choosePetBattleScene('${scene.id}')">
          <img src="${scene.poster}" width="320" height="180" loading="lazy" alt="">
          <span class="pb-scene-check" aria-hidden="true">✓</span>
          <span class="pb-scene-copy"><b>${pbEsc(scene.name[lang])}</b><small>${pbEsc(scene.description[lang])}</small></span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

function _pbSceneInvite(id) {
  if (typeof BattleScenes === 'undefined') return '';
  const scene = BattleScenes.getBattleScene(id);
  const lang = _pbLang === 'vi' ? 'vi' : 'en';
  return `<div class="pb-scene-invite">
    <img src="${scene.poster}" width="320" height="180" alt="">
    <span>${pbT('sceneInvite')}<b>${pbEsc(scene.name[lang])}</b></span>
  </div>`;
}

function renderPetBattle() {
  const screen = document.getElementById('petBattleScreen');
  if (!screen) return;
  if (_pbGame) return;                       // the running game owns the screen
  if (_pbShowingResult) return;              // …and so does the result card

  const st = _pbState;
  if (!st) { screen.dataset.pbLobbySig = ''; screen.innerHTML = _pbShell(`<div class="pb-empty">${pbT('loading')}</div>`); return; }
  if (st.offline) {
    screen.dataset.pbLobbySig = '';
    screen.innerHTML = _pbShell(`<div class="pb-empty">${pbT('offline')}</div>`);
    return;
  }

  const b = st.battle;
  if (b && b.status === 'invited' && !b.iAmChallenger) {
    const left = Math.max(0, (b.expiresAt || 0) - Date.now());
    screen.dataset.pbLobbySig = '';
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">${pbT('inviteTitle', { name: pbEsc(b.foe.name || '?') })}</div>
        <div class="pb-invite-sub">${pbT('inviteSub', { n: Math.ceil(left / 1000) })}</div>
        ${_pbSceneInvite(b.backgroundId)}
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
    screen.dataset.pbLobbySig = '';
    screen.innerHTML = _pbShell(`
      <div class="pb-invite-card">
        <div class="pb-invite-title">${pbT('waitingTitle', { name: pbEsc(b.foe.name || '?') })}</div>
        <div class="pb-invite-sub">${pbT('waitingSub', { n: Math.ceil(left / 1000) })}</div>
        ${_pbSceneInvite(b.backgroundId)}
        <div class="pb-hint">${pbT('waitingHint')}</div>
      </div>`);
    return;
  }
  if (b && b.status === 'active') { startPetBattleGame(b); return; }

  const ready = !st.readyAt || st.readyAt <= Date.now();
  const friends = (typeof _getFriendsData === 'function' && _getFriendsData())
    ? _getFriendsData().friends : ((typeof _friendsData !== 'undefined' && _friendsData) ? _friendsData.friends : []);
  // battleReadyAt comes from the server — an absolute time, so the client
  // never has to know that the rule is "3 days". A friend still ageing is
  // greyed out with the wait shown, instead of a dead button that just fails.
  const waiting = (f) => _pbFriendWait(f);
  const anyWaiting = (friends || []).some(waiting);
  const allWaiting = !!(friends && friends.length) && friends.every(waiting);
  const list = (friends && friends.length)
    ? friends.map(f => {
        const wait = waiting(f);
        const label = wait
          ? `<span class="pb-friend-wait">${wait}</span>`
          : '<span class="pb-friend-go">⚔️</span>';
        const off = wait || !ready || st.ammo <= 0;
        return `
        <button class="pb-friend${wait ? ' waiting' : ''}" onclick="challengePetFriend(${f.userId})" ${off ? 'disabled' : ''}>
          <span class="pb-friend-name">${pbEsc(f.username)}</span>
          ${label}
        </button>`;
      }).join('') + (anyWaiting ? `<div class="pb-hint pb-friend-why">${pbT('friendNewWhy')}</div>` : '')
    : `<div class="pb-empty">
         ${pbT('noFriends')}
         <button class="pb-btn primary pb-go-friends" onclick="pbGoToFriends()">${pbT('goFriends')}</button>
       </div>`;

  // Nothing below changes between polls unless one of these does. Rebuilding
  // anyway threw away the arena picker's scroll position — and any half-made
  // tap — once every second, which is what made choosing a background feel
  // broken.
  const sig = JSON.stringify([
    st.ammo, st.readyAt || 0, !!st.allowBot, ready,
    (friends || []).map(f => [f.userId, _pbFriendWait(f)]), allWaiting, _pbMsg, _pbLang, _pbHistoryOpen,
    (typeof pbSelectedSceneId === 'function' ? pbSelectedSceneId() : ''),
    _pbHistory().length,
    _pbHires.join(","), _pbCoins(),
  ]);
  if (screen.dataset.pbLobbySig === sig && screen.querySelector('.pb-scene-list')) return;

  // When it genuinely must redraw, carry the scroll across rather than
  // snapping the child back to the first arena.
  const prevList = screen.querySelector('.pb-scene-list');
  const keepScroll = prevList ? prevList.scrollLeft : 0;

  screen.innerHTML = _pbShell(`
    ${_pbPowerPanel()}
    ${_pbScenePicker()}
    ${_pbAmmoPanel(st)}
    ${ready
      ? (st.ammo > 0
          // "Ready! Pick a friend" reads as a lie when every friend on the
          // list is still ageing and none of them can be tapped.
          ? (allWaiting
              ? `<div class="pb-warn">${pbT('friendAllNew')}</div>`
              : `<div class="pb-ready">${pbT('readyPick')}</div>`)
          : `<div class="pb-warn">${pbT('noAmmoPick')}</div>`)
      : `<div class="pb-cooldown">
           <div class="pb-cooldown-title">${pbT('cooldownTitle', { t: pbFmtCountdown(st.readyAt - Date.now()) })}</div>
           <div class="pb-cooldown-sub">${pbT('cooldownSub')}</div>
         </div>`}
    ${_pbHirePanel()}
    <div class="pb-friend-list">${list}</div>
    ${_pbMsg ? `<div class="pb-msg">${pbEsc(_pbMsg)}</div>` : ''}
    ${st.allowBot ? `
      <div class="pb-practice-card">
        <button class="pb-btn primary pb-practice-btn" onclick="startBotBattle()">${pbT('practiceBtn')}</button>
        <div class="pb-practice-sub">${pbT('practiceSub')}</div>
      </div>` : ''}
    ${_pbHistoryPanel()}`);
  screen.dataset.pbLobbySig = sig;
  if (keepScroll) {
    const nextList = screen.querySelector('.pb-scene-list');
    if (nextList) nextList.scrollLeft = keepScroll;
  }
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

// How much longer before this friend can be fought, as a label — or '' if now.
//
// The value is a server timestamp, never a locally computed deadline: the
// device clock on a child's iPad is not trustworthy, and the server would
// refuse the challenge anyway. A missing/!finite value means "no wait", so an
// older client or a failed field never locks a friend out by accident.
function _pbFriendWait(f) {
  const at = f && Number(f.battleReadyAt);
  if (!Number.isFinite(at) || at <= Date.now()) return '';
  const left = at - Date.now();
  const days = Math.ceil(left / 86400000);
  if (days < 1) return pbT('friendNewSoon');
  return days === 1 ? pbT('friendNewDay1') : pbT('friendNewDays', { n: days });
}

// ---- challenge flow ----
async function challengePetFriend(friendId) {
  const r = await _pbApi('battle/challenge', {
    method: 'POST', body: Object.assign({ friendId, backgroundId: pbSelectedSceneId(), hires: pbHireCommit() }, _pbMyPet()),
  });
  _pbMsg = r.ok ? '' : ((r.data && r.data.error) || pbT('errChallenge'));
  await refreshPetBattle();
}
async function acceptPetBattle(battleId) {
  const r = await _pbApi('battle/respond', { method: 'POST', body: Object.assign({ battleId, accept: true, hires: pbHireCommit() }, _pbMyPet()) });
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
    _pbPoll = setTimeout(tick, _pbGame ? PB_POLL_INGAME_MS : PB_POLL_LOBBY_MS);
  };
  _pbPoll = setTimeout(tick, PB_POLL_LOBBY_MS);
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

// The reward ladder, drawn on every result card. A number in a cabinet the
// child has to go and find is not motivating; the moment they have just won is
// when "two more and this becomes a Ruby Cup" actually lands. `earned` shows
// the cup that was just won; practice passes false and gets the same ladder as
// a promise of what a real win would give.
function _pbCupLadderHTML(earned) {
  if (typeof cupState !== 'function') return '';
  let c;
  try { c = cupState(); } catch (e) { return ''; }
  const merge = (typeof CUP_MERGE === 'number') ? CUP_MERGE : 5;

  // Where are they on the ladder, and what is the very next milestone?
  const toRuby = Math.max(0, merge - (c.basic % merge || 0)) || merge;
  const needRuby = c.basic >= merge ? 0 : merge - c.basic;
  const needDiamond = c.ruby >= merge ? 0 : merge - c.ruby;
  const hasDiamond = c.diamond > 0;

  const next = hasDiamond && c.ruby === 0 && c.basic === 0
    ? pbT('cupTopReached')
    : needRuby > 0 ? pbT('cupNextRuby', { n: needRuby })
    : pbT('cupNextDiamond', { n: Math.max(1, needDiamond) });

  // A row of five slots: filled ones are cups they hold, empty ones are the
  // gap they can see closing.
  const filled = Math.min(merge, needRuby > 0 ? c.basic : merge);
  const slots = Array.from({ length: merge }, (_, i) =>
    `<span class="pb-cup-slot ${i < filled ? 'on' : ''}">${i < filled ? '🏆' : '·'}</span>`).join('');

  return `
    <div class="pb-cup-ladder ${earned ? 'earned' : 'teaser'}">
      ${earned ? `<div class="pb-cup-prize"><span class="pb-cup-prize-icon">🏆</span><b>+1</b></div>` : ''}
      <div class="pb-cup-row">${slots}<span class="pb-cup-arrow">→</span><span class="pb-cup-goal ruby">🏆</span></div>
      <div class="pb-cup-next">${next}</div>
      <div class="pb-cup-dream">
        <span class="pb-cup-dream-art ${hasDiamond ? 'unlocked' : ''}" aria-hidden="true">🏆</span>
        <span class="pb-cup-dream-copy">
          <b>${pbT('cupDiamondName')}</b>
          <small>${hasDiamond ? pbT('cupTopReached') : pbT('cupDiamondGoal', { n: merge * merge })}</small>
        </span>
      </div>
      <div class="pb-cup-rule">${pbT('cupLadder', { n: merge })}</div>
    </div>`;
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
    fieldVersion: (typeof BattleCalc !== 'undefined' && BattleCalc.FIELD_RULES) ? 3 : 1,
    backgroundId: pbSelectedSceneId(),
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
        <div class="pb-cup-tease">${pbT('cupPracticeTease')}</div>
        ${_pbCupLadderHTML(false)}
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
        ${won ? `<div class="pb-result-cup">${pbT('cupWonBig')}</div>`
              : `<div class="pb-cup-tease">${pbT('cupLoseTease')}</div>`}
        ${_pbCupLadderHTML(!!won)}
        <div class="pb-result-hint">${won ? pbT('cupCabinetCta') : pbT('resultHint')}</div>
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
    pbSelectedSceneId, choosePetBattleScene, _pbScenePicker, _pbSceneInvite,
    startBotBattle, finishBotBattle,
    _pbHistoryPanel, _pbHistoryDetail, _pbPowerPanel, _pbVersusLine, pbGoToFriends,
    _pbSetState: (s) => { _pbState = s; },
    _pbGetState: () => _pbState,
  };
}
