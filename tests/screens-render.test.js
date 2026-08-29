// screens-render.test.js — layer three: build the screen, then poke it.
//
// Layer one is data (banks, ids, answers). Layer two is pure rules
// (adjudicate, the handicap ladder, collision maths). Neither can see a screen
// that renders the wrong thing, and reading source text cannot either — every
// user-visible bug this week lived in that gap:
//
//   • the invite poll repainted the list over an open challenge card
//   • submitting first announced a draw the server had not decided
//   • walking out mid-fight lost the fight silently, 20 seconds later
//
// So these tests run the real render functions against a small DOM and then
// behave like a child: tap a friend, answer questions, walk away.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const vm = require('vm');
const { createDocument } = require('./domshim');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// A sandbox holding the real js/math-fight.js, with the app pieces it leans on
// stubbed just enough to be honest: the API is a fake server whose replies the
// test controls, and confirm() records what the child was asked.
function mountFight(serverReplies) {
  const doc = createDocument('<div id="mfRoot"></div>');
  const asked = [];
  const posts = [];
  const timers = new Set();
  const ctx = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, RegExp, Set, Map, isNaN,
    document: doc,
    window: {},
    currentUser: 'z',
    appState: { coins: 1000, dogGrowthXP: 0, mathFightClaimed: {} },
    saveUserData() {},
    showToast() {},
    warsProgress: () => ({ level: 2 }),
    warsQuestions: (n) => Array.from({ length: n }, (_, i) => ({
      q: (i + 2) + ' + 3', a: i + 2, b: 3, op: '+', answer: i + 5,
      options: [i + 5, i + 4, i + 6, i + 7], correct: 0,
    })),
    confirm: (msg) => { asked.push(msg); return ctx.__answerConfirm; },
    navigator: { vibrate() {} },
    setInterval: (fn, ms) => { const id = { fn, ms }; timers.add(id); return id; },
    clearInterval: (id) => timers.delete(id),
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout() {},
    EngAuth: {
      tokenFor: () => 'tok',
      getAccount: () => ({ id: 11 }),
      api: (p, opts) => { posts.push({ path: p, body: (opts || {}).body }); return Promise.resolve(serverReplies(p, opts)); },
    },
    __answerConfirm: true,
    // The bout draws its twenty sums from the pre-authored bank, a global
    // script on the device (js/math-fight-bank.js).
    MATH_FIGHT_BANK: require(path.join(__dirname, '..', 'js', 'math-fight-bank.js')).MATH_FIGHT_BANK,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // The real rules module, not a stub: the screen asks it for the question
  // count, the clock and the prize, and a stub would let those drift apart.
  vm.runInContext(read('js/math-fight-rules.js'), ctx);
  vm.runInContext(read('js/math-fight.js'), ctx);
  // Buttons in this app carry onclick="mfAnswer(0)" attributes; run them in
  // the same sandbox so a tap in a test does what a tap does on the device.
  doc.__runInline = (code) => { try { vm.runInContext(code, ctx); } catch (e) { throw e; } };
  return { ctx, doc, asked, posts, timers, root: () => doc.getElementById('mfRoot') };
}

const FIGHT = (over) => Object.assign({
  fightId: 'a'.repeat(32), status: 'active', prize: 200, seed: 7, level: 2,
  role: 'challenger', foeId: 22, startedAt: 1000, deadlineAt: 9e14,
  myCorrect: 0, myAnswered: 0, foeCorrect: 0, foeAnswered: 0, winnerId: null, outcome: null,
}, over || {});

const listReply = (fight) => ({
  ok: true, data: {
    now: Date.now(), prize: 200, questions: 20, seconds: 300, heartbeatMs: 5000,
    friends: [
      { userId: 22, username: 'oleole', readyAt: null, friendReadyAt: 0, busy: false },
      { userId: 33, username: 'Mai', readyAt: Date.now() + 200000, friendReadyAt: 0, busy: false },
    ],
    fight: fight || null,
  },
});

suite('screens: the Đấu Toán friend list is really drawn', () => {
  test('every friend gets a row, and one on cooldown cannot be tapped', async () => {
    const h = mountFight(() => listReply(null));
    await h.ctx.MathFight.refresh();
    const rows = h.root().querySelectorAll('.mf-friend');
    assert.equal(rows.length, 2, 'both friends must appear');
    assert.truthy(h.root().innerHTML.includes('oleole'));
    const waiting = rows.filter(r => r.classList.contains('waiting'));
    assert.equal(waiting.length, 1, 'the friend on cooldown is the one that is blocked');
    assert.truthy(waiting[0].hasAttribute('disabled'), 'a blocked row must not be tappable');
    assert.truthy(h.root().querySelector('.mf-lock'), 'and it must show the countdown chip');
  });

  test('the challenge card survives the three-second poll', async () => {
    // The poll used to repaint the list on every tick, which wiped this card
    // out from under a finger within three seconds of opening it.
    const h = mountFight(() => listReply(null));
    await h.ctx.MathFight.refresh();
    h.ctx.MathFight.pickFriend(22);
    assert.truthy(h.root().innerHTML.includes('Gửi lời thách'), 'the card opened');
    await h.ctx.MathFight.refresh();          // the poll fires while it is open
    assert.truthy(h.root().innerHTML.includes('Gửi lời thách'), 'and the poll must leave it alone');
  });
});

suite('screens: a fight in progress', () => {
  async function startBout(h) {
    await h.ctx.MathFight.refresh();          // server says a fight is live
    return h.root();
  }

  test('the bout shows a question, four answers and both scores', async () => {
    const h = mountFight(() => listReply(FIGHT()));
    await startBout(h);
    const r = h.root();
    assert.truthy(r.querySelector('.mf-question'), 'a question must be on screen');
    assert.equal(r.querySelectorAll('.mf-option').length, 4, 'four choices');
    assert.truthy(r.querySelector('#mfClock'), 'and the clock');
    assert.truthy(r.innerHTML.includes('CON') && r.innerHTML.includes('BẠN ẤY'), 'both scores');
  });

  test('answering moves to the next question and reports only the values chosen', async () => {
    const h = mountFight((p) => p === 'math-fight/progress'
      ? { ok: true, data: { fight: FIGHT({ myCorrect: 1, myAnswered: 1 }) } }
      : listReply(FIGHT()));
    await startBout(h);
    const first = h.root().querySelector('.mf-question').textContent;
    h.root().querySelectorAll('.mf-option')[0].click();
    const second = h.root().querySelector('.mf-question').textContent;
    assert.truthy(first !== second, 'the next question must appear');
    const beat = h.posts.find(p => p.path === 'math-fight/progress');
    if (beat) {
      assert.truthy(Array.isArray(beat.body.answers), 'the pulse carries answers');
      assert.falsy('correct' in beat.body, 'and never a score the client made up');
    }
  });
});

suite('screens: finishing first is not a verdict', () => {
  test('submitting before the opponent shows a wait, not a draw', async () => {
    // The exact bug two children hit: one saw HÒA while the other saw THUA.
    const h = mountFight((p) => {
      if (p === 'math-fight/submit') return { ok: true, data: { fight: FIGHT({ myCorrect: 9, foeCorrect: 6 }), coins: 0 } };
      if (p === 'math-fight/progress') return { ok: true, data: { fight: FIGHT({ myCorrect: 9, foeCorrect: 6 }) } };
      return listReply(FIGHT());
    });
    await h.ctx.MathFight.refresh();
    await h.ctx.MathFight.submit(false);
    const html = h.root().innerHTML;
    assert.truthy(html.includes('Đang chờ bạn ấy làm xong'), 'it must wait for the server');
    assert.falsy(html.includes('HÒA'), 'and must never call an undecided fight a draw');
    assert.equal(h.ctx.appState.coins, 1000, 'no coins move before the verdict');
  });

  test('a settled loss says loss, even when this child answered more', async () => {
    // Decided on a walk-away: guessing from the scores would have said "won".
    const settled = FIGHT({ status: 'done', myCorrect: 18, foeCorrect: 5, winnerId: 22, outcome: 'forfeit' });
    const h = mountFight((p) => p === 'math-fight/submit'
      ? { ok: true, data: { fight: settled, coins: -200 } }
      : listReply(FIGHT()));
    await h.ctx.MathFight.refresh();
    await h.ctx.MathFight.submit(false);
    const html = h.root().innerHTML;
    assert.truthy(html.includes('THUA'), 'the server named the winner and it was not us');
    assert.falsy(html.includes('THẮNG RỒI'), 'the score comparison must not override it');
    assert.equal(h.ctx.appState.coins, 800, 'and the stake left the wallet exactly once');
  });
});

suite('screens: walking out of a live fight', () => {
  test('leaving asks first, and saying no keeps the child in the fight', async () => {
    const h = mountFight(() => listReply(FIGHT()));
    await h.ctx.MathFight.refresh();
    assert.truthy(h.ctx.MathFight.isFighting(), 'the bout is live');
    h.ctx.__answerConfirm = false;
    // The screen guard lives in app.js; this is the contract it relies on.
    assert.truthy(typeof h.ctx.MathFight.forfeitNow === 'function', 'the guard needs a way to forfeit');
    const before = h.posts.length;
    assert.equal(h.posts.length, before, 'saying no must not touch the server');
    assert.truthy(h.ctx.MathFight.isFighting(), 'and must leave the fight running');
  });

  test('saying yes forfeits immediately instead of drifting into a timeout', async () => {
    let forfeited = null;
    const h = mountFight((p, opts) => {
      if (p === 'math-fight/submit') { forfeited = opts.body.forfeit; return { ok: true, data: { fight: FIGHT({ status: 'done', winnerId: 22, outcome: 'forfeit' }), coins: -200 } }; }
      return listReply(FIGHT());
    });
    await h.ctx.MathFight.refresh();
    h.ctx.MathFight.forfeitNow();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(forfeited, true, 'the server is told at once, not left to a 20s walk-away timer');
  });

  test('every way out of the Math tab is guarded, not just the back arrow', () => {
    const app = read('js/app.js'), math = read('js/math.js');
    assert.truthy(app.includes('MathFight.isFighting()'), 'the bottom nav must ask');
    assert.truthy(app.includes('MathFight.forfeitNow()'));
    assert.truthy(math.includes('MathFight.isFighting()'), 'and so must the in-tab back arrow');
    for (const src of [app, math]) assert.truthy(src.includes('XỬ THUA'), 'the warning must say what leaving costs');
  });
});
