// The standing money-invariant net. EVERY spend path must obey the same three
// laws, and every new shop must earn its place in this file:
//   1. Insufficient funds -> nothing is charged, nothing is acquired.
//   2. A successful purchase deducts EXACTLY the advertised price, once.
//   3. No path may ever leave the wallet negative, non-numeric, or reset.
// These execute the real shop functions from js/home.js and js/petbattle.js —
// no source-substring assertions.
const { suite, test, assert } = require('./harness');
const path = require('path');
const { loadAppCode } = require('./setup');

const root = path.join(__dirname, '..');
const pb = require(path.join(root, 'js', 'petbattle.js'));
const TEAM = require(path.join(root, 'js', 'battle-teammates.js'));

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

suite('money invariants: mercenary wages', () => {
  function withPurse(coins, fn) {
    const hadState = Object.prototype.hasOwnProperty.call(global, 'appState');
    const hadTeam = Object.prototype.hasOwnProperty.call(global, 'BattleTeam');
    const prevState = global.appState, prevTeam = global.BattleTeam;
    const hadDoc = Object.prototype.hasOwnProperty.call(global, 'document');
    const prevDoc = global.document;
    global.appState = { coins };
    global.BattleTeam = TEAM;
    global.document = { getElementById: () => null, querySelector: () => null };
    try { return fn(global.appState); }
    finally {
      if (hadState) global.appState = prevState; else delete global.appState;
      if (hadTeam) global.BattleTeam = prevTeam; else delete global.BattleTeam;
      if (hadDoc) global.document = prevDoc; else delete global.document;
    }
  }
  const gunnerCost = TEAM.hireCost(TEAM.normalizeHires(['gunner']));

  test('commit with a short purse hires nobody and charges nothing', () => {
    withPurse(gunnerCost - 1, st => {
      pb.pbHireReset();
      pb.pbHire('gunner');
      const squad = pb.pbHireCommit();
      assert.deepEqual(squad, [], 'no wage, no squad');
      assert.equal(st.coins, gunnerCost - 1);
    });
  });
  test('commit deducts exactly the wage, and a second commit is free (cart cleared)', () => {
    withPurse(gunnerCost + 5, st => {
      pb.pbHireReset();
      pb.pbHire('gunner');
      assert.deepEqual(pb.pbHireCommit(), ['gunner']);
      assert.equal(st.coins, 5);
      assert.deepEqual(pb.pbHireCommit(), [], 'an empty cart must charge nothing');
      assert.equal(st.coins, 5);
    });
  });
});

suite('money invariants: a truly full disk warns instead of silently dropping the session', () => {
  // rewrite/wordform/phrases shed their own oldest history entries when
  // localStorage throws — but when even a lone entry cannot be written they
  // used to give up in SILENCE, with the coins already awarded in memory.
  const MODULES = [
    { file: 'rewrite', fn: 'saveRewriteSession' },
    { file: 'wordform', fn: 'saveWordformSession' },
    { file: 'phrases', fn: 'savePhrasesSession' },
  ];
  for (const m of MODULES) {
    test(m.file + ': the give-up path surfaces a warning toast', () => {
      const mod = require(path.join(root, 'js', m.file + '.js'));
      assert.truthy(typeof mod[m.fn] === 'function', m.fn + ' must be exported for this test');
      const prev = { appState: global.appState, currentUser: global.currentUser,
        saveUserData: global.saveUserData, showToast: global.showToast };
      const toasts = [];
      global.appState = {};
      global.currentUser = 'Kid';
      global.saveUserData = () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; };
      global.showToast = msg => toasts.push(msg);
      try {
        mod[m.fn]({ score: 9, total: 10, date: Date.now() }); // must not throw
        assert.truthy(toasts.length >= 1, 'the child must be told the save failed');
        assert.truthy(/lưu|đầy/i.test(toasts.join(' ')), 'the warning says what happened');
      } finally {
        for (const k of Object.keys(prev)) {
          if (prev[k] === undefined) delete global[k]; else global[k] = prev[k];
        }
      }
    });
  }
});

suite('money invariants: a full disk must not blow up a payout', () => {
  const math = require(path.join(root, 'js', 'math.js'));

  test('saveMathSession survives a QuotaExceeded save and warns, never crashes', () => {
    // Shedding now lives inside app.js saveUserData (halving, bounded —
    // tests/appstate-quota.test.js). The menu's job is only: keep the session
    // in memory, swallow the failure, and TELL the child nothing was saved.
    const prev = { appState: global.appState, currentUser: global.currentUser,
      saveUserData: global.saveUserData, showToast: global.showToast };
    global.appState = { mathHistory: [{ old: 1 }] };
    global.currentUser = 'Kid';
    const toasts = [];
    global.showToast = msg => toasts.push(msg);
    global.saveUserData = () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; };
    try {
      math.saveMathSession({ score: 9, total: 10, date: Date.now() }); // must not throw
      assert.equal(global.appState.mathHistory[0].score, 9, 'the new session is kept in memory');
      assert.truthy(toasts.length >= 1, 'the child must be told the save failed');
      assert.truthy(/lưu|đầy/i.test(toasts.join(' ')), 'the warning says what happened');
    } finally {
      for (const k of Object.keys(prev)) {
        if (prev[k] === undefined) delete global[k]; else global[k] = prev[k];
      }
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
