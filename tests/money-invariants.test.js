// The standing money-invariant net. EVERY spend path must obey the same three
// laws, and every new shop must earn its place in this file:
//   1. Insufficient funds -> nothing is charged, nothing is acquired.
//   2. A successful purchase deducts EXACTLY the advertised price, once.
//   3. No path may ever leave the wallet negative, non-numeric, or reset.
// These execute the real shop functions from js/home.js and js/night-raid.js,
// and the one earning path left, js/units.js finishUnitPractice —
// no source-substring assertions.
const { suite, test, assert } = require('./harness');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { loadAppCode } = require('./setup');
const { createDocument } = require('./domshim');

const root = path.join(__dirname, '..');

// One sandbox for the whole suite (loadAppCode is expensive); each test
// installs a fresh appState through the vm's own setter.
const app = loadAppCode({ extraGlobals: { setTimeout: () => 0, requestAnimationFrame: () => 0 } });
function freshState(coins, extra) {
  const st = Object.assign({
    coins, points: 0, dogGrowthXP: 0, dogLevel: 1,
    petAccessories: [], activeAccessories: [], streakShields: 0,
    petQuest: { lastDate: null, questId: null, completed: false },
    lastStudyDate: null, petLastFed: 0,
  }, extra || {});
  app.__setAppState(st);
  return st;
}
function walletIsSane(st) {
  assert.truthy(typeof st.coins === 'number' && Number.isFinite(st.coins),
    'the wallet must stay a real number');
  assert.truthy(st.coins >= 0, 'the wallet must never go negative');
}

suite('money invariants: a new profile starts with exactly nothing', () => {
  test('createDefaultUserData seeds coins 0, level-1 dog, no assets', () => {
    const d = app.createDefaultUserData('Kid', '1234');
    assert.equal(d.coins, 0);
    assert.equal(d.dogGrowthXP, 0);
    assert.equal(d.dogLevel, 1);
    assert.deepEqual(d.petAccessories, []);
    assert.deepEqual(d.activeAccessories, []);
  });
});

suite('money invariants: pet food', () => {
  const food = () => app.DOG_FOOD[0];
  test('one coin short buys nothing and grows nothing', () => {
    const st = freshState(food().price - 1);
    app.buyFood(food().id, null);
    assert.equal(st.coins, food().price - 1);
    assert.equal(st.dogGrowthXP, 0);
    walletIsSane(st);
  });
  test('an exact-price purchase deducts exactly the price and feeds the dog', () => {
    const st = freshState(food().price);
    app.buyFood(food().id, null);
    assert.equal(st.coins, 0);
    assert.equal(st.dogGrowthXP, food().growth);
    assert.truthy(st.petLastFed > 0, 'feeding must register');
    walletIsSane(st);
  });
  test('an unknown food id charges nothing', () => {
    const st = freshState(5000);
    app.buyFood('no-such-food', null);
    assert.equal(st.coins, 5000);
  });
});

suite('money invariants: accessories', () => {
  const acc = () => app.DOG_ACCESSORIES[0];
  test('insufficient funds: not charged, not owned', () => {
    const st = freshState(acc().price - 1);
    app.buyAccessory(acc().id);
    assert.equal(st.coins, acc().price - 1);
    assert.deepEqual(st.petAccessories, []);
  });
  test('a purchase deducts the price once and owning it blocks a second charge', () => {
    const st = freshState(acc().price * 2);
    app.buyAccessory(acc().id);
    assert.equal(st.coins, acc().price);
    assert.deepEqual(st.petAccessories, [acc().id]);
    app.buyAccessory(acc().id); // already owned — must be free and idempotent
    assert.equal(st.coins, acc().price, 'an owned accessory must never charge again');
    assert.deepEqual(st.petAccessories, [acc().id]);
    walletIsSane(st);
  });
});

suite('money invariants: streak shields', () => {
  test('199 coins buys no 200-coin shield', () => {
    const st = freshState(199);
    app.buyShield();
    assert.equal(st.coins, 199);
    assert.equal(st.streakShields, 0);
  });
  test('a shield costs exactly 200 and a full inventory charges nothing', () => {
    const st = freshState(1000, { streakShields: 2 });
    app.buyShield();
    assert.equal(st.coins, 800);
    assert.equal(st.streakShields, 3);
    app.buyShield(); // at max
    assert.equal(st.coins, 800, 'a full inventory must never charge');
    assert.equal(st.streakShields, 3);
    walletIsSane(st);
  });
});

suite('money invariants: the farm shop', () => {
  // The Arena's mercenary shop went with the Arena (September 2026). The one
  // coin-spending shop left outside Home is the farm builder: js/night-raid.js
  // buildCell() debits appState.coins locally and syncs the mirror afterwards.
  // Mounted in its own sandbox because the screen's code is lazy (not in
  // index.html, so loadAppCode never sees it) and the server is unreachable.
  const Rules = require(path.join(root, 'js', 'night-raid-rules.js'));
  function farm(coins) {
    const doc = createDocument('<div id="nightRaidScreen"></div>');
    const state = { coins, dogLevel: 1, nightRaidLayout: { cells: [], soldiers: 0 } };
    const ctx = {
      console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, RegExp, Set, Map, isNaN, Error,
      document: doc, window: { addEventListener() {} }, innerWidth: 900, navigator: {},
      NightRaidRules: Rules, appState: state, currentUser: 'Kid', saveUserData() {}, showToast() {}, switchScreen() {},
      setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
      requestAnimationFrame: () => 0, performance: { now: () => 0 },
      EngAuth: { tokenFor: () => 'tok', api: () => Promise.resolve({ ok: false, data: null }) },
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'js', 'night-raid.js'), 'utf8'), ctx, { filename: 'js/night-raid.js' });
    ctx.NightRaid.open();
    return { st: state, NR: ctx.NightRaid };
  }
  const fence = Rules.DEFENSES.find(d => d.id === 'wood-fence');

  test('one coin short buys no fence and charges nothing', () => {
    const { st, NR } = farm(fence.price - 1);
    NR.selectBuild('wood-fence');
    NR.buildCell(0, 0, true);
    assert.equal(st.coins, fence.price - 1, 'nothing charged');
    assert.deepEqual(st.nightRaidLayout.cells, [], 'nothing acquired');
    walletIsSane(st);
  });
  test('an exact-price purchase deducts exactly the price, once, and a second tap on the same cell is an upgrade quote, not a second charge', () => {
    const { st, NR } = farm(fence.price);
    NR.selectBuild('wood-fence');
    NR.buildCell(0, 0, true);
    assert.equal(st.coins, 0, 'exactly one price');
    assert.equal(st.nightRaidLayout.cells.filter(c => c.type === 'wood-fence').length, 1, 'one fence');
    NR.buildCell(0, 0, true);                       // tier-2 upgrade costs 2× price: unaffordable at 0
    assert.equal(st.coins, 0, 'an unaffordable upgrade charges nothing');
    assert.equal(st.nightRaidLayout.cells[0].tier, 1, 'and does not upgrade');
    walletIsSane(st);
  });
  test('a seed costs no coins at all, and planting offline charges nothing', () => {
    const { st, NR } = farm(0);
    st.dailyTask = { seeds: { inventory: [{ id: 'lettuce', quantity: 1 }] } };
    NR.selectBuild('lettuce');
    return Promise.resolve(NR.buildCell(0, 0, true)).then(() => {
      assert.equal(st.coins, 0);
      walletIsSane(st);
    });
  });
});

suite('money invariants: the Book practice pays exactly 5 xu per right answer, once', () => {
  // js/units.js finishUnitPractice is the ONE earning path left (the English
  // and Maths menus went with the September 2026 cut). It is executed here
  // with a hand-built round through the sandbox's own `_unitQuiz` setter.
  const W = (en) => ({ en, vi: en + '-vi', emoji: '' });
  function round(unit, verdicts) {
    app.__setUnitQuiz({
      unit,
      questions: verdicts.map((v, i) => ({ w: W('word' + i), mode: 'full' })),
      answers: verdicts.map(v => (v === null ? undefined : { isCorrect: v })),
    });
  }
  function run(coins, verdicts, extra) {
    const st = freshState(coins, Object.assign({ unitsHistory: [], wordRetry: {} }, extra || {}));
    app.__setCurrentUser('Kid');
    app.petComboBonus();            // no bonus left over from an earlier test
    round('pr1-1', verdicts);
    app.finishUnitPractice();
    return st;
  }

  test('7 right out of 10 pays 35, and the wallet is added to, never replaced', () => {
    const st = run(120, [true, true, true, true, true, true, true, false, false, null]);
    assert.equal(st.coins, 120 + 7 * 5, 'exactly 5 per right answer on top of the old balance');
    assert.equal(st.unitsHistory.length, 1, 'one history row per round');
    assert.equal(st.unitsHistory[0].score, 7);
    assert.equal(st.unitsHistory[0].total, 10);
    assert.deepEqual(st.unitsHistory[0].wrong, ['word7', 'word8', 'word9'], 'a skipped answer counts as missed');
    assert.falsy(app.__getUnitQuiz(), 'the round is closed once paid');
    walletIsSane(st);
  });

  test('an all-wrong round pays nothing and charges nothing', () => {
    const st = run(40, [false, false, false]);
    assert.equal(st.coins, 40);
    assert.equal(st.unitsHistory[0].score, 0);
    walletIsSane(st);
  });

  test('a never-set wallet becomes exactly the payout, not NaN', () => {
    const st = run(undefined, [true, true]);
    assert.equal(st.coins, 10);
    walletIsSane(st);
  });

  test('the 5-in-a-row combo treat is banked once and then cleared', () => {
    const st = freshState(0, { unitsHistory: [], wordRetry: {} });
    app.__setCurrentUser('Kid');
    app.petComboBonus();
    for (let i = 0; i < 5; i++) app.petCheerAnswer(true);   // one combo → +5
    assert.equal(app.petComboState().bonus, 5, 'sanity: five in a row earned one treat');
    round('pr1-1', [true, true, true, true, true]);
    app.finishUnitPractice();
    assert.equal(st.coins, 5 * 5 + 5, 'five right answers plus one combo treat');
    assert.equal(app.petComboState().bonus, 0, 'the treat is spent by being paid');
    round('pr1-1', [true]);
    app.finishUnitPractice();
    assert.equal(st.coins, 30 + 5, 'the next round pays no leftover treat');
    walletIsSane(st);
  });

  test('a second finish of the same closed round pays nothing (no double payout)', () => {
    const st = run(0, [true, true, true]);
    assert.equal(st.coins, 15);
    app.finishUnitPractice();       // _unitQuiz is null: nothing to pay
    assert.equal(st.coins, 15, 'a closed round cannot be finished twice');
    assert.equal(st.unitsHistory.length, 1);
  });

  test('a switched profile loses no accrued treat to the other child', () => {
    // petCheerForgetProfile (js/petcheer.js) is the profile teardown: a combo
    // accrued by one child must never be paid into the next child's wallet.
    freshState(0, { unitsHistory: [], wordRetry: {} });
    app.petComboBonus();
    for (let i = 0; i < 5; i++) app.petCheerAnswer(true);
    app.petCheerForgetProfile();
    const st = freshState(0, { unitsHistory: [], wordRetry: {} });
    app.__setCurrentUser('Sibling');
    round('pr1-1', [true]);
    app.finishUnitPractice();
    assert.equal(st.coins, 5, 'only the sibling\'s own right answer is paid');
  });
});

suite('money invariants: a full disk must not blow up a payout', () => {
  // Shedding lives inside app.js saveUserData (halving, bounded —
  // tests/appstate-quota.test.js). The Book practice's job is only: keep the
  // coins and the session in memory and never throw out of the payout.
  test('finishUnitPractice survives a QuotaExceeded save with the coins intact', () => {
    // The real saveUserData runs (shedding loop and all) against a disk that
    // refuses every write — the sandbox's localStorage is shared by reference.
    const ls = app.localStorage;
    const realSetItem = ls.setItem;
    let attempts = 0;
    ls.setItem = () => { attempts++; const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; };
    try {
      const st = freshState(100, { unitsHistory: [], wordRetry: {} });
      app.__setCurrentUser('Kid');
      app.petComboBonus();
      app.__setUnitQuiz({
        unit: 'pr1-1',
        questions: [{ w: { en: 'apple', vi: 'táo', emoji: '' }, mode: 'full' }, { w: { en: 'pear', vi: 'lê', emoji: '' }, mode: 'full' }],
        answers: [{ isCorrect: true }, { isCorrect: true }],
      });
      app.finishUnitPractice();   // must not throw
      assert.truthy(attempts >= 1, 'sanity: the save was attempted and refused');
      assert.equal(st.coins, 110, 'the payout stays in memory even when the disk refuses it');
      assert.equal(st.unitsHistory.length, 1, 'the session row is kept in memory');
      assert.equal(st.unitsHistory[0].score, 2);
      walletIsSane(st);
    } finally {
      ls.setItem = realSetItem;
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
