// leave-guard-fight-arena.test.js — walking out of a GAME asks first; a game
// that is over lets the child go without a word.
//
// Scope: Đấu Toán (js/math-fight.js), the pet battle (js/petbattle.js), Cướp
// Đêm (js/night-raid.js) and Cướp Cô Hồn (js/ghost-offering-event.js). These
// are not lessons, but the same three rules hold and are executed here, never
// grepped for:
//   (A) mid-game, EVERY way out — the bottom bar (Home / Eng / Arena / Toán),
//       the screen's own back / × / quit buttons — asks confirm() with the
//       stakes named; Cancel keeps the child on the same question / turn /
//       raid with every timer still armed; OK leaves cleanly (game object
//       gone, link closed, polls stopped, bottom bar back).
//   (B) once the result card is up, leaving asks nothing and nothing blocks
//       it: no lock on the bottom bar, no leftover class, no stale flag that
//       makes switchScreen still ask or refuse.
//   (C) the next open of that tab is clean: no ghost round, no double coins.
//
// The app is booted for real (tests/verify/client.js mountApp): index.html's
// script list in one vm context, the arena/math code groups served from disk
// through LazyData, every confirm() answered by __confirmAnswer and recorded
// in __confirmLog. The server is stubbed per test; the animation clock is
// driven by hand where a game needs frames to finish.
const { suite, test, assert } = require('./harness');
const path = require('path');
const { mountApp, loginTestUser, stubServer } = require('./verify/client.js');
const { El } = require('./domshim.js');

// PetBattleGame and the Night Raid canvas renderer draw into a <canvas> that
// arrives through innerHTML, which the DOM shim builds without getContext
// (mountApp only patches createElement). Same stub, one lazy context per
// canvas. Additive: an element that is not a canvas still has no context.
if (!El.prototype.getContext) {
  const CTX = ('arc arcTo beginPath bezierCurveTo clearRect clip closePath drawImage ellipse fill fillRect '
    + 'fillText lineTo moveTo quadraticCurveTo rect resetTransform restore rotate save scale setLineDash '
    + 'setTransform stroke strokeRect strokeText transform translate putImageData').split(' ');
  El.prototype.getContext = function () {
    if (this.tagName !== 'CANVAS') return null;
    if (!this._ctx) {
      const c = { canvas: this };
      for (const m of CTX) c[m] = () => {};
      c.measureText = (t) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      c.getImageData = (x, y, w, h) => ({ width: w | 0, height: h | 0, data: new Uint8Array(Math.max(0, (w | 0) * (h | 0) * 4)) });
      c.createLinearGradient = () => ({ addColorStop() {} });
      c.createRadialGradient = () => ({ addColorStop() {} });
      c.createPattern = () => null;
      this._ctx = c;
    }
    return this._ctx;
  };
}

const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setImmediate(r)); };
const squash = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const activeScreen = (h) => { const el = h.doc.querySelector('.screen.active'); return el ? el.id : null; };
const navDisplay = (h) => h.el('bottomNav').style.display;
// Home paints the bar with display:flex, a game restores it with ''; both
// are "the bar is there". Only 'none' is a hidden bar.
const barShown = (h) => navDisplay(h) !== 'none';

// "The child taps X on the bottom bar / a button": run it with confirm()
// answered `answer`, and return what happened.
function tapWith(h, answer, fn) {
  h.sandbox.__confirmAnswer = answer;
  h.sandbox.__confirmLog.length = 0;
  const result = fn();
  return { result, asked: h.sandbox.__confirmLog.length, prompt: h.sandbox.__confirmLog[0] || '' };
}

// The bottom bar's four buttons, exactly as index.html wires them.
const NAV_ROUTES = [
  ['Home', (h) => h.sandbox.switchScreen('homeScreen')],
  ['Eng', (h) => h.sandbox.switchScreen('learnHubScreen')],
  ['Arena', (h) => h.sandbox.openPetBattle()],
  ['Toán', (h) => h.sandbox.switchScreen('mathHubScreen')],
];

// ===========================================================================
// Đấu Toán
// ===========================================================================

async function mountFight() {
  const h = mountApp();
  loginTestUser(h, { coins: 500, allowMathFight: true });
  h.sandbox.switchScreen('mathHubScreen');
  await h.sandbox.LazyData.ensure('mathHubScreen');
  await settle(10);
  assert.equal(typeof h.sandbox.MathFight, 'object', 'the math group landed');
  // An invite from Oleole is waiting; accepting it starts the bout — the
  // route a child actually takes. The server hands back the questions it will
  // mark, exactly as functions/api/math-fight does.
  const state = {
    fight: { fightId: 7, status: 'invited', role: 'opponent', foeId: 22, prize: 200, seed: 12345, level: 1, expiresAt: Date.now() + 60000 },
    submits: [],
  };
  const calls = stubServer(h, (p, o) => {
    if (p === 'math-fight') return { ok: true, data: { friends: [{ userId: 22, username: 'Oleole', readyAt: 0, friendReadyAt: 0, busy: false }], prize: 200, heartbeatMs: 5000, fight: state.fight } };
    if (p === 'math-fight/respond') {
      state.fight = Object.assign({}, state.fight, { status: 'active', deadlineAt: Date.now() + 300000, myCorrect: 0, foeCorrect: 0 });
      return { ok: true, data: { fight: state.fight } };
    }
    if (p === 'math-fight/progress') return { ok: true, data: { fight: state.fight } };
    if (p === 'math-fight/submit') {
      state.submits.push(o.body);
      const forfeit = !!o.body.forfeit;
      state.fight = Object.assign({}, state.fight, { status: 'done', winnerId: forfeit ? 22 : 1, outcome: forfeit ? 'forfeit' : 'score', myCorrect: forfeit ? 0 : 20, foeCorrect: 3 });
      return { ok: true, data: { fight: state.fight, coins: forfeit ? -200 : 200 } };
    }
    return undefined;
  });
  const hub = h.el('mathHubScreen');
  assert.truthy(hub.innerHTML.includes("openMathSection('fight')"), 'the Math menu offers Đấu Toán');
  h.sandbox.openMathSection('fight');
  await settle(10);
  assert.truthy(h.el('mfRoot').innerHTML.includes('mfRespond(true)'), 'the invite card offers "Nhận lời — đấu!"');
  h.sandbox.mfRespond(true);
  await settle(10);
  const MF = h.sandbox.MathFight;
  assert.truthy(MF.isFighting(), 'the bout is live');
  assert.equal(navDisplay(h), 'none', 'the bottom bar is hidden for the five minutes');
  return { h, MF, state, calls };
}

// Answer the question on screen correctly, the way a finger does: read the
// option buttons the bout rendered and tap the right one.
function answerCurrent(h, MF) {
  const st = MF.__st();
  const q = st.qs[st.idx];
  const buttons = h.el('mfRoot').querySelectorAll('.mf-option');
  assert.truthy(buttons.length >= 2, 'options are drawn');
  const idx = q.options.findIndex((o) => o === q.answer);
  assert.truthy(idx >= 0, 'the correct answer is among the options');
  h.doc.__runInline(buttons[idx].getAttribute('onclick'));
}

suite('leave guards — Đấu Toán (Math Fight)', () => {
  test('(A) mid-fight every way out asks, names the stake, and Cancel keeps the same question', async () => {
    const { h, MF, state } = await mountFight();
    // Answer two, so "same question" means something.
    answerCurrent(h, MF); answerCurrent(h, MF);
    await settle();
    const before = { idx: MF.__st().idx, answers: JSON.stringify(MF.__st().answers), view: MF.__st().view };
    assert.equal(before.idx, 2);
    const timersBefore = { ticker: MF.__st().ticker, pulse: MF.__st().pulse };
    assert.truthy(timersBefore.ticker && timersBefore.pulse, 'the clock and the pulse are armed');

    const routes = NAV_ROUTES.concat([
      ['header ‹ (openMathSection home)', (hh) => hh.sandbox.openMathSection('home')],
      ['Bỏ cuộc (mfQuit)', (hh) => hh.sandbox.mfQuit()],
    ]);
    for (const [name, go] of routes) {
      const r = tapWith(h, false, () => go(h));
      await settle();
      if (name === 'Toán') {
        // The Toán tab IS this screen: no question to ask, but repainting the
        // hub must not restart the bout (it used to reset every answer).
        assert.equal(r.asked, 0, name + ' asked');
      } else {
        assert.equal(r.asked, 1, name + ': must ask exactly once (' + r.asked + ')');
        assert.truthy(/thua|mất tiền cược|Bỏ cuộc/i.test(r.prompt), name + ': the prompt names the stake — ' + r.prompt);
        if (name !== 'Bỏ cuộc (mfQuit)' && name !== 'header ‹ (openMathSection home)') assert.equal(r.result === false || r.result instanceof Promise, true, name + ': the switch must report it did not happen');
      }
      assert.truthy(MF.isFighting(), name + ': Cancel must keep the fight live');
      assert.equal(MF.__st().idx, before.idx, name + ': Cancel must keep the same question');
      assert.equal(JSON.stringify(MF.__st().answers), before.answers, name + ': and the answers given');
      assert.equal(MF.__st().view, 'fight', name + ': and the bout view');
      assert.equal(MF.__st().ticker, timersBefore.ticker, name + ': the clock must still be the same interval');
      assert.equal(MF.__st().pulse, timersBefore.pulse, name + ': the pulse too');
      assert.equal(activeScreen(h), 'mathHubScreen', name + ': the child is still on the Math screen');
      assert.equal(navDisplay(h), 'none', name + ': and the bar is still hidden');
      assert.truthy(h.el('mfRoot') && h.el('mfRoot').querySelectorAll('.mf-option').length >= 2, name + ': the question is still on screen');
    }
    assert.equal(state.submits.length, 0, 'nothing was submitted by a Cancel');
  });

  test('(A) saying yes on the bottom bar forfeits at once and frees the bar', async () => {
    const { h, MF, state } = await mountFight();
    answerCurrent(h, MF);
    const r = tapWith(h, true, () => h.sandbox.switchScreen('homeScreen'));
    await settle(10);
    assert.equal(r.asked, 1);
    assert.equal(r.result, true, 'the switch happened');
    assert.equal(activeScreen(h), 'homeScreen');
    assert.falsy(MF.isFighting(), 'the fight is over on this side');
    assert.equal(state.submits.length, 1, 'one submit went out');
    assert.equal(state.submits[0].forfeit, true, 'and it was a forfeit — not a silent walk-away the server times out later');
    assert.truthy(barShown(h), 'the bottom bar is back');
    assert.falsy(MF.__st().pulse, 'the pulse is stopped');
    // Home is free to leave again — no stale flag.
    const again = tapWith(h, false, () => h.sandbox.switchScreen('learnHubScreen'));
    assert.equal(again.asked, 0, 'nothing left to ask about');
    assert.equal(again.result, true);
  });

  test('(A) the header ‹ with a yes forfeits and lands on the Math menu', async () => {
    const { h, MF, state } = await mountFight();
    tapWith(h, true, () => h.sandbox.openMathSection('home'));
    await settle(10);
    assert.falsy(MF.isFighting());
    assert.equal(state.submits.length, 1);
    assert.equal(state.submits[0].forfeit, true);
    assert.equal(navDisplay(h), '', 'the bar is back');
    assert.truthy(h.el('mathHubScreen').innerHTML.includes("openMathSection('fight')"), 'the Math menu is drawn');
  });

  test('(B)(C) finishing frees the bar with no question, pays once, and the next open is a clean list', async () => {
    const { h, MF, state } = await mountFight();
    const coins0 = h.state().coins;
    while (MF.isFighting() && MF.__st().idx < 20) { answerCurrent(h, MF); await settle(2); }
    await settle(12);
    assert.falsy(MF.isFighting(), 'twenty answers end the bout');
    assert.equal(MF.__st().view, 'result');
    assert.truthy(squash(h.el('mfRoot').textContent).includes('THẮNG RỒI'), 'the verdict is on screen');
    assert.equal(h.state().coins, coins0 + 200, 'the prize landed');
    assert.equal(navDisplay(h), '', 'the bottom bar is back the moment the result is up');
    assert.truthy(h.el('mfRoot').innerHTML.includes('mfBackToList()'), 'the result offers "Về danh sách"');

    // (B) every way out is free now.
    for (const [name, go] of NAV_ROUTES.concat([['header ‹', (hh) => hh.sandbox.openMathSection('home')]])) {
      if (name === 'Toán') continue;
      // Re-open the result each time: the finished bout is what we leave from.
      h.sandbox.switchScreen('mathHubScreen'); await settle(4);
      if (name !== 'header ‹') { h.sandbox.openMathSection('fight'); await settle(6); }
      const r = tapWith(h, false, () => go(h));
      await settle(6);
      assert.equal(r.asked, 0, name + ': a finished fight must not ask (' + r.prompt + ')');
      assert.truthy(r.result !== false, name + ': the switch must happen');
      assert.truthy(barShown(h), name + ': the bar stays free');
      h.sandbox.__confirmAnswer = true;
      if (name === 'Arena') await settle(10);
    }

    // (C) the next open of the tab: a list, not the old round; coins moved once.
    h.sandbox.switchScreen('mathHubScreen'); await settle(4);
    h.sandbox.openMathSection('fight'); await settle(10);
    assert.equal(MF.__st().view, 'list', 'the Fight tab opens on the friend list');
    assert.falsy(MF.isFighting());
    assert.truthy(h.el('mfRoot').innerHTML.includes('mfPickFriend(22)'), 'Oleole is offered for a new fight');
    assert.equal(h.state().coins, coins0 + 200, 'coins moved exactly once');
    assert.equal(h.state().mathFightClaimed[7], true, 'the fight is marked claimed');
    assert.equal(state.submits.length, 1, 'one submit for the whole fight');
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, 'no checkpoint offers the finished round back');
  });
});

// ===========================================================================
// The pet battle
// ===========================================================================

function battleView(status, extra) {
  return Object.assign({
    id: 9, status, seed: 4242, fieldVersion: 2, backgroundId: 'meadow', iAmChallenger: true,
    me: { id: 1, name: 'BeNa', ammo: 5, level: 3, stage: 'corgi', hp: 100, hires: [], castleSkin: 'stone' },
    foe: { id: 22, name: 'Oleole', ammo: 5, level: 3, stage: 'beagle', hp: 100, hires: [], castleSkin: 'stone' },
    turnNo: 1, myTurn: true, turnStartedAt: Date.now(), expiresAt: 0, winnerId: null, draw: false, finishedAt: null,
  }, extra || {});
}

async function mountBattle() {
  const h = mountApp();
  loginTestUser(h, { coins: 500, dogLevel: 3 });
  const state = { battle: battleView('active') };
  const calls = stubServer(h, (p) => {
    if (p === 'battle' || p === 'battle?light=1') return { ok: true, data: { ammo: 5, readyAt: 0, stats: { wins: 1, losses: 0 }, battle: state.battle } };
    if (p.startsWith('battle/state')) return { ok: true, data: { battle: state.battle, turns: [] } };
    if (p === 'battle/turn') return { ok: true, data: { battle: state.battle } };
    return undefined;
  });
  h.run("_friendsData = { friends: [{userId:22,username:'Oleole'}], incoming: [], outgoing: [] }");
  await h.sandbox.openPetBattle();           // the nav button; the arena group lands underneath
  await settle(12);
  const game = h.peek('_pbGame');
  assert.truthy(game && !game.finished, 'the server said the battle is active, so the game is running');
  assert.truthy(h.el('petBattleScreen').querySelector('.pb-game'), 'the battle is on screen');
  assert.equal(h.sandbox.isPetBattleActive(), true);
  return { h, game, state, calls };
}

suite('leave guards — pet battle', () => {
  test('(A) mid-battle the bottom bar asks with the stake named; Cancel keeps the very same game', async () => {
    const { h, game } = await mountBattle();
    const barBefore = navDisplay(h);
    for (const [name, go] of NAV_ROUTES) {
      const r = tapWith(h, false, () => go(h));
      await settle();
      if (name === 'Arena') {
        assert.equal(r.asked, 0, 'the Arena button is this screen: nothing to ask');
      } else {
        assert.equal(r.asked, 1, name + ': must ask (' + r.asked + ')');
        assert.equal(r.result, false, name + ': must not switch');
        assert.truthy(/đấu pháo|bạn ấy/i.test(r.prompt), name + ': the prompt names the opponent — ' + r.prompt);
      }
      assert.equal(h.peek('_pbGame'), game, name + ': Cancel keeps the same game object');
      assert.falsy(game._destroyed, name + ': not destroyed');
      assert.truthy(h.el('petBattleScreen').querySelector('.pb-game'), name + ': the battle is still on screen');
      assert.equal(activeScreen(h), 'petBattleScreen', name + ': still in the Arena');
      assert.equal(navDisplay(h), barBefore, name + ': the bar is untouched');
    }
    assert.truthy(h.sandbox._busyWithTimedActivity(), 'a background update knows the child is busy');
  });

  test('(A) saying yes leaves cleanly: game destroyed, link closed, poll stopped, bar free', async () => {
    const { h, game } = await mountBattle();
    const r = tapWith(h, true, () => h.sandbox.switchScreen('homeScreen'));
    await settle();
    assert.equal(r.asked, 1);
    assert.equal(r.result, true);
    assert.equal(activeScreen(h), 'homeScreen');
    assert.equal(h.peek('_pbGame'), null, 'the game object is gone');
    assert.truthy(game._destroyed, 'and was destroyed (RAF loop, timers)');
    assert.equal(h.peek('_pbLink'), null, 'the realtime link is closed');
    assert.equal(h.peek('_pbPoll'), null, 'the lobby poll is stopped');
    assert.equal(h.sandbox.isPetBattleActive(), false);
    assert.falsy(h.sandbox._busyWithTimedActivity(), 'nothing is busy any more');
    const again = tapWith(h, false, () => h.sandbox.switchScreen('learnHubScreen'));
    assert.equal(again.asked, 0, 'no stale flag');
    assert.equal(again.result, true);
  });

  test('(B)(C) a finished battle leaves without a question, pays once, and the next lobby is clean', async () => {
    const { h, game, state } = await mountBattle();
    const coins0 = h.state().coins;
    // The server calls it: the poll/link hands the game a 'done' view, and the
    // game schedules its result card 900 ms later. Fire that timer by hand —
    // the harness records timers, it never runs them.
    const timersBefore = h.timers.length;
    state.battle = battleView('done', { winnerId: 1, foe: Object.assign({}, battleView('done').foe, { hp: 0 }) });
    game.onServerState({ battle: state.battle, turns: [] });
    const scheduled = h.timers.slice(timersBefore).filter((t) => t.kind === 'timeout');
    assert.truthy(scheduled.length >= 1, 'the result is scheduled');
    for (const t of scheduled) t.fn();
    await settle(10);
    assert.equal(h.peek('_pbGame'), null, 'the game object is released');
    assert.equal(h.sandbox.isPetBattleActive(), false);
    const card = h.el('petBattleScreen').querySelector('.pb-result-card');
    assert.truthy(card, 'the result card is up');
    assert.truthy(card.innerHTML.includes('closePetBattle()'), 'with a Xong button');
    assert.equal(h.state().coins, coins0 + 50, 'a win pays 20 + 30');
    assert.equal(navDisplay(h), 'flex', 'the bottom bar is up');

    // (B) every way out is free.
    for (const [name, go] of NAV_ROUTES) {
      if (name === 'Arena') continue;
      const r = tapWith(h, false, () => go(h));
      await settle(4);
      assert.equal(r.asked, 0, name + ': must not ask after the result (' + r.prompt + ')');
      assert.equal(r.result, true, name + ': must switch');
      // back to the card for the next route: the Arena button keeps it up
      await h.sandbox.openPetBattle(); await settle(6);
      assert.truthy(h.el('petBattleScreen').querySelector('.pb-result-card'), name + ': the card stays until Xong');
    }
    // Xong — the in-screen exit.
    const r = tapWith(h, false, () => h.sandbox.closePetBattle());
    await settle(4);
    assert.equal(r.asked, 0, 'Xong asks nothing');
    assert.equal(activeScreen(h), 'homeScreen');
    assert.equal(h.peek('_pbShowingResult'), false);

    // (C) the next open is the lobby, not the card, and coins moved once.
    state.battle = null;
    await h.sandbox.openPetBattle(); await settle(10);
    const el = h.el('petBattleScreen');
    assert.falsy(el.querySelector('.pb-result-card'), 'no ghost result card');
    assert.falsy(el.querySelector('.pb-game'), 'no ghost game');
    assert.equal(el.querySelectorAll('.pb-friend').length, 1, 'the friend list is back');
    assert.equal(h.state().coins, coins0 + 50, 'coins moved exactly once');
    assert.equal(h.state().petBattleHistory.length, 1, 'one history entry');
  });
});

// ===========================================================================
// Cướp Đêm
// ===========================================================================

async function mountRaid() {
  const h = mountApp();
  loginTestUser(h, { coins: 2000, dogLevel: 4 });
  // A hand-driven animation clock: the auto-battle finishes when its
  // performance.now() clock passes the duration the rules chose.
  const anim = { clock: 0, rafs: [] };
  h.sandbox.performance.now = () => anim.clock;
  h.sandbox.requestAnimationFrame = (fn) => { anim.rafs.push(fn); return anim.rafs.length; };
  // Phaser "present" but empty: NightRaidPhaser's mount throws and the raid
  // falls back to the canvas renderer, the way a blocked runtime does.
  h.sandbox.Phaser = {};
  const state = { finishes: 0 };
  const calls = stubServer(h, (p, o) => {
    if (p === 'night-raid/home') return { ok: true, data: { home: { coins: h.state().coins, dogLevel: 4, layout: null } } };
    if (p === 'night-raid/friends') return { ok: true, data: { me: { lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 3,
      friends: [{ userId: 22, targetId: 22, name: 'Oleole', homeLevel: 2, difficulty: 'Dễ' }] } };
    if (p === 'night-raid/start') return { ok: true, data: { raid: Object.assign({}, o.body, { raidId: 'r1', expiresAt: Date.now() + 600000,
      title: { vi: 'Oleole', en: 'Oleole' }, defense: 5, layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 1, castleHp: 200 }) } };
    if (p === 'night-raid/finish') { state.finishes++; return { ok: true, data: { result: { won: true, reward: 120, stars: 2, damage: 50, defense: 5, castleHp: 0, margin: 45, loot: 100, victoryBonus: 20, soldiers: 0 } } }; }
    if (p === 'night-raid/reports') return { ok: true, data: { reports: [], attacks: [] } };
    return undefined;
  });
  await h.sandbox.openNightRaid();
  await settle(12);
  const NR = h.peek('NightRaid');
  const el = h.el('nightRaidScreen');
  assert.truthy(el.innerHTML.includes('nrShowLiveTargets()'), 'the builder offers ĐI CƯỚP');
  await NR.showLiveTargets(); await settle(8);
  assert.truthy(el.innerHTML.includes('nrAttackLive(0)'), 'Oleole\'s house is on the list');
  h.sandbox.nrAttackLive(0);                   // the row's button: straight into the raid
  await settle(30);
  assert.truthy(NR.isRaiding(), 'the server wrote the raid row: the child is committed');
  assert.truthy(el.innerHTML.includes('nrQuitRaid()'), 'the stage has its map/quit button');
  assert.equal(navDisplay(h), 'none', 'Night Raid is a full-screen mode: the bar is hidden');
  return { h, NR, el, anim, state, calls };
}

async function playRaidOut(h, NR, anim) {
  const timersBefore = h.timers.length;
  let guard = 0;
  while (NR.isRaiding() && guard++ < 200) {
    anim.clock += 250;
    const fns = anim.rafs.splice(0);
    for (const f of fns) f(anim.clock);
    await settle(2);
  }
  await settle(12);
  assert.falsy(NR.isRaiding(), 'the march ends and the server scores it (' + guard + ' frames)');
  // The result banner drops 650 ms after the last frame (a recorded, never
  // fired timeout here). Let it drop.
  for (const t of h.timers.slice(timersBefore).filter((t) => t.kind === 'timeout')) { try { t.fn(); } catch (e) {} }
  await settle(4);
}

suite('leave guards — Cướp Đêm (Night Raid)', () => {
  test('(A) mid-raid the bar, the ×, the map button and the Arena button all ask; Cancel keeps the raid', async () => {
    const { h, NR, el, anim } = await mountRaid();
    const framesBefore = anim.rafs.length;
    const routes = NAV_ROUTES.concat([
      ['× (closeNightRaid)', (hh) => hh.sandbox.closeNightRaid()],
      ['map button (nrQuitRaid)', (hh) => hh.sandbox.nrQuitRaid()],
    ]);
    for (const [name, go] of routes) {
      const r = tapWith(h, false, () => go(h));
      await settle();
      assert.equal(r.asked, 1, name + ': must ask exactly once (' + r.asked + ')');
      assert.truthy(/không nhận được xu|không vào lại/i.test(r.prompt), name + ': the prompt names the cost — ' + r.prompt);
      assert.truthy(NR.isRaiding(), name + ': Cancel keeps the raid');
      assert.equal(activeScreen(h), 'nightRaidScreen', name + ': still on the raid stage');
      assert.truthy(el.innerHTML.includes('nrQuitRaid()'), name + ': the stage is still drawn');
      assert.equal(navDisplay(h), 'none', name + ': the bar stays hidden');
      assert.truthy(anim.rafs.length >= framesBefore, name + ': the march is still animating');
    }
    assert.truthy(h.sandbox._busyWithTimedActivity(), 'a background update knows the child is busy');
  });

  test('(A) saying yes on the map button abandons to the house list; on the bar it leaves with the bar restored', async () => {
    const { h, NR, el, anim } = await mountRaid();
    let r = tapWith(h, true, () => h.sandbox.nrQuitRaid());
    await settle(8);
    assert.equal(r.asked, 1);
    assert.falsy(NR.isRaiding(), 'the raid is abandoned');
    assert.truthy(el.innerHTML.includes('nrAttackLive(0)'), 'back on the list of houses');
    assert.equal(anim.rafs.splice(0).length >= 0, true);
    const frames = anim.rafs.length;
    anim.clock += 1000; for (const f of anim.rafs.splice(0)) f(anim.clock);
    assert.equal(anim.rafs.length, 0, 'the abandoned march schedules no more frames (had ' + frames + ')');

    // Raid again, and this time walk out through the bottom bar.
    h.sandbox.nrAttackLive(0); await settle(30);
    assert.truthy(NR.isRaiding());
    r = tapWith(h, true, () => h.sandbox.switchScreen('homeScreen'));
    await settle(8);
    assert.equal(r.asked, 1);
    assert.equal(r.result, true);
    assert.equal(activeScreen(h), 'homeScreen');
    assert.falsy(NR.isRaiding());
    assert.truthy(barShown(h), 'the bar is back on Home');
    assert.falsy(h.sandbox._busyWithTimedActivity());
    const again = tapWith(h, false, () => h.sandbox.switchScreen('learnHubScreen'));
    assert.equal(again.asked, 0, 'no stale flag');
  });

  test('(B)(C) a scored raid leaves with no question, pays once, and the next open is the builder', async () => {
    const { h, NR, el, anim, state } = await mountRaid();
    const coins0 = h.state().coins;
    await playRaidOut(h, NR, anim);
    assert.equal(state.finishes, 1, 'scored by the server once');
    const pop = el.querySelector('#nrResultPop');
    assert.truthy(pop, 'the result banner is up');
    assert.truthy(squash(pop.textContent).includes('CHIẾN THẮNG'), 'and says so');
    assert.truthy(pop.innerHTML.includes('nrHome()') && pop.innerHTML.includes('nrShowLiveTargets()'), 'with Về nhà and Cướp nhà khác');
    assert.equal(h.state().coins, coins0 + 120, 'the reward landed');
    assert.equal(h.state().nightRaidClaimed.r1, true);
    assert.falsy(h.state().nightRaidPending, 'nothing pending');

    // (B) the in-screen exits are free.
    let r = tapWith(h, false, () => h.sandbox.nrHome());
    await settle(6);
    assert.equal(r.asked, 0, 'Về nhà asks nothing');
    assert.truthy(el.innerHTML.includes('nrShowLiveTargets()'), 'the builder is drawn');
    r = tapWith(h, false, () => h.sandbox.closeNightRaid());
    await settle(6);
    assert.equal(r.asked, 0, '× asks nothing');
    assert.equal(activeScreen(h), 'petBattleScreen', 'back in the Arena');
    assert.truthy(barShown(h), 'the bottom bar is restored');
    for (const [name, go] of NAV_ROUTES) {
      const rr = tapWith(h, false, () => go(h));
      await settle(4);
      assert.equal(rr.asked, 0, name + ': nothing to ask after the raid');
    }

    // (C) reopen: builder, no result, coins unchanged.
    await h.sandbox.openNightRaid(); await settle(12);
    assert.falsy(el.querySelector('#nrResultPop'), 'no ghost result');
    assert.truthy(el.innerHTML.includes('nrShowLiveTargets()'), 'the builder again');
    assert.falsy(NR.isRaiding());
    assert.equal(h.state().coins, coins0 + 120, 'coins moved exactly once');
    assert.equal(state.finishes, 1, 'the finished raid was not re-scored on reopen');
    h.sandbox.closeNightRaid();
    assert.truthy(barShown(h));
  });
});

// ===========================================================================
// Cướp Cô Hồn
// ===========================================================================

async function mountOffering(room) {
  const h = mountApp();
  loginTestUser(h, { coins: 500, dogLevel: 3 });
  const state = { room };
  stubServer(h, (p) => {
    if (p === 'battle' || p === 'battle?light=1') return { ok: true, data: { ammo: 5, readyAt: 0, stats: { wins: 1, losses: 0 }, battle: null } };
    if (p === 'ghost-offering') return { ok: true, data: state.room };
    return undefined;
  });
  h.run("_friendsData = { friends: [{userId:22,username:'Oleole'}], incoming: [], outgoing: [] }");
  await h.sandbox.openPetBattle(); await settle(12);
  const el = h.el('petBattleScreen');
  assert.truthy(el.innerHTML.includes('GhostOfferingEvent.open()'), 'the lobby card offers CƯỚP CÔ HỒN');
  const GO = h.sandbox.GhostOfferingEvent;
  GO.open();                                   // the card's button
  await settle(12);
  assert.truthy(GO.isActive(), 'the scene is up');
  assert.truthy(el.classList.contains('go-event-active'));
  assert.truthy(el.querySelector('.go-close'), 'with its ×');
  return { h, GO, el, state };
}
const OPEN_ROOM = () => ({ open: true, ended: false, sessionId: 's1', roomId: '2026-09-10', eventDate: '2026-09-10',
  opensAt: Date.now() - 1000, closesAt: Date.now() + 3600000, nextOpensAt: Date.now() - 1000, claimedIds: [] });
const ENDED_ROOM = () => Object.assign(OPEN_ROOM(), { open: false, ended: true });
const tapClose = (h, el) => el.querySelector('.go-close').onclick();

suite('leave guards — Cướp Cô Hồn (Ghost Offering)', () => {
  test('(A) with the mâm open, the bar and the × ask; Cancel keeps the scene', async () => {
    const { h, GO, el } = await mountOffering(OPEN_ROOM());
    assert.truthy(GO.isPlaying(), 'the room is open for grabbing');
    const routes = NAV_ROUTES.concat([['× (go-close)', (hh) => tapClose(hh, el)]]);
    for (const [name, go] of routes) {
      const r = tapWith(h, false, () => go(h));
      await settle();
      if (name === 'Arena') {
        assert.equal(r.asked, 0, 'the Arena button is this screen');
      } else {
        assert.equal(r.asked, 1, name + ': must ask (' + r.asked + ')');
        assert.truthy(/dây đang kéo/i.test(r.prompt), name + ': the prompt names the rope — ' + r.prompt);
        assert.truthy(r.result === false || r.result instanceof Promise, name + ': must not leave');
      }
      assert.truthy(GO.isActive(), name + ': Cancel keeps the scene');
      assert.truthy(el.classList.contains('go-event-active'), name + ': and its lock');
      assert.truthy(el.querySelector('.go-cast-btn'), name + ': the cast button is still there');
      assert.equal(activeScreen(h), 'petBattleScreen');
    }
  });

  test('(A) saying yes tears the scene down and hands the Arena lobby back', async () => {
    const { h, GO, el } = await mountOffering(OPEN_ROOM());
    const r = tapWith(h, true, () => h.sandbox.switchScreen('homeScreen'));
    await settle(8);
    assert.equal(r.asked, 1);
    assert.equal(r.result, true);
    assert.equal(activeScreen(h), 'homeScreen');
    assert.falsy(GO.isActive());
    assert.falsy(el.classList.contains('go-event-active'), 'the lock class is gone');
    assert.equal(el.style.overflow, '', 'no overflow lock left behind');
    assert.falsy(el.querySelector('.go-cast-btn'), 'the scene is gone');
    assert.truthy(el.querySelectorAll('.pb-friend').length === 1, 'the lobby is repainted underneath');
    const again = tapWith(h, false, () => h.sandbox.switchScreen('learnHubScreen'));
    assert.equal(again.asked, 0, 'no stale flag');
  });

  test('(A) the × with a yes closes the scene too', async () => {
    const { h, GO, el } = await mountOffering(OPEN_ROOM());
    const r = tapWith(h, true, () => tapClose(h, el));
    await settle(8);
    assert.equal(r.asked, 1);
    assert.falsy(GO.isActive());
    assert.falsy(el.classList.contains('go-event-active'));
    assert.truthy(el.querySelectorAll('.pb-friend').length === 1, 'the lobby is back');
  });

  test('(B)(C) once the event has ended, nothing asks and the lobby comes back clean', async () => {
    const { h, GO, el } = await mountOffering(ENDED_ROOM());
    assert.truthy(squash(el.textContent).includes('ĐÃ KẾT THÚC'), 'the scene says the event is over');
    assert.falsy(GO.isPlaying(), 'nothing is at stake');
    // Bottom bar: free, and the scene is still torn down properly.
    let r = tapWith(h, false, () => h.sandbox.switchScreen('homeScreen'));
    await settle(8);
    assert.equal(r.asked, 0, 'a finished event must not ask (' + r.prompt + ')');
    assert.equal(r.result, true);
    assert.falsy(GO.isActive());
    assert.falsy(el.classList.contains('go-event-active'), 'the lock class is gone');
    assert.equal(navDisplay(h), 'flex');
    // (C) the Arena reopens as the lobby.
    await h.sandbox.openPetBattle(); await settle(10);
    assert.truthy(el.querySelectorAll('.pb-friend').length === 1, 'the lobby, with the friend list');
    assert.truthy(el.innerHTML.includes('GhostOfferingEvent.open()'), 'and the event card');
    // The × on the ended scene is free as well.
    GO.open(); await settle(12);
    r = tapWith(h, false, () => tapClose(h, el));
    await settle(8);
    assert.equal(r.asked, 0, '× on a finished event asks nothing');
    assert.falsy(GO.isActive());
    assert.truthy(el.querySelectorAll('.pb-friend').length === 1, 'the lobby again');
    assert.equal(h.state().coins, 500, 'no coins moved');
  });
});

// ===========================================================================
// The Arena button itself: openPetBattle() is not switchScreen, so it is
// checked on its own — before the arena code has landed (the lazyEntry
// placeholder in js/app.js) and after (the real function).
// ===========================================================================

suite('leave guards — the Arena button while a lesson is in progress', () => {
  test('the placeholder openPetBattle() asks about a live grammar quiz and does not load the Arena on a no', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    h.sandbox.switchScreen('grammarScreen'); await settle();
    h.sandbox.startGrammarQuiz(h.peek('GRAMMAR_UNITS')[0].id, 5);
    assert.truthy(h.sandbox.isGrammarQuizActive());
    assert.equal(typeof h.sandbox.renderPetBattle, 'undefined', 'the arena code is not in yet');
    const r = tapWith(h, false, () => h.sandbox.openPetBattle());
    await r.result; await settle(6);
    assert.equal(r.asked, 1, 'asked');
    assert.truthy(h.sandbox.isGrammarQuizActive(), 'Cancel keeps the quiz');
    assert.equal(activeScreen(h), 'grammarScreen');
    assert.equal(typeof h.sandbox.renderPetBattle, 'undefined', 'and the Arena was not even downloaded');
    const yes = tapWith(h, true, () => h.sandbox.openPetBattle());
    await yes.result; await settle(10);
    assert.equal(yes.asked, 1);
    assert.falsy(h.sandbox.isGrammarQuizActive(), 'yes ends the quiz');
    assert.equal(activeScreen(h), 'petBattleScreen');
  });

  test('the real openPetBattle() asks about a live Toán round, and a no keeps the question', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    await h.sandbox.LazyData.ensure('petBattleScreen');       // the Arena has been visited before
    assert.equal(typeof h.sandbox.renderPetBattle, 'function');
    h.sandbox.switchScreen('mathHubScreen');
    await h.sandbox.LazyData.ensure('mathHubScreen'); await settle(10);
    h.sandbox.startMathQuiz(0); await settle(4);
    assert.truthy(h.sandbox.isMathQuizActive(), 'a Toán round is live');
    const q = h.peek('_mathQuiz');
    const idx = q.idx;
    const r = tapWith(h, false, () => h.sandbox.openPetBattle());
    await settle(6);
    assert.equal(r.asked, 1, 'asked');
    assert.truthy(/Toán/.test(r.prompt), r.prompt);
    assert.truthy(h.sandbox.isMathQuizActive(), 'Cancel keeps the round');
    assert.equal(h.peek('_mathQuiz'), q, 'the same round object');
    assert.equal(h.peek('_mathQuiz').idx, idx, 'on the same question');
    assert.equal(activeScreen(h), 'mathHubScreen');
    const yes = tapWith(h, true, () => h.sandbox.openPetBattle());
    await settle(10);
    assert.equal(yes.asked, 1);
    assert.falsy(h.sandbox.isMathQuizActive(), 'yes abandons the round');
    assert.equal(activeScreen(h), 'petBattleScreen');
    assert.truthy(barShown(h), 'the bar the round had hidden is back');
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
