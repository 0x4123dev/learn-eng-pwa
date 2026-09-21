// Finishing a practice must happen EXACTLY ONCE, whatever goes wrong.
//
// The bug: every tab awarded coins and saved the session FIRST and cleared
// `_xxxQuiz` LAST. When anything in between threw — a full-disk saveUserData,
// a missing screen, a render slip — the quiz stayed "active". The child,
// looking at a frozen screen, tapped "see result" again... and again. Each tap
// re-awarded the coins and appended another identical session, one per second.
// That is exactly what the admin timeline showed: nine identical
// "Phrases practice (20 Qs) 17/20" rows at 10:04:00…10:04:08, and a reported
// balance thousands of xu above what the child really had.
const { suite, test, assert } = require('./harness');
const path = require('path');
const root = path.join(__dirname, '..');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require(path.join(root, 'js', 'answer-audio.js')));

function el() { return { innerHTML: '', value: '', style: {}, focus() {}, scrollTop: 0, classList: { add() {}, remove() {} } }; }

// Mount one practice tab with a real bank and a controllable saveUserData.
function setup(opts) {
  const saved = { appState: global.appState, currentUser: global.currentUser,
    saveUserData: global.saveUserData, document: global.document, showToast: global.showToast };
  global.appState = Object.assign({ coins: 1000 }, opts.appState || {});
  global.currentUser = 'Kid';
  global.saveUserData = opts.saveUserData || (() => {});
  global.showToast = () => {};
  const screens = {};
  for (const id of opts.screens) screens[id] = el();
  global.document = {
    getElementById: id => screens[id] || null,
    querySelectorAll: () => [], querySelector: () => null,
  };
  return { screens, restore() {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete global[k]; else global[k] = saved[k];
    }
  } };
}

// The one practice left in the app, the Book practice (js/units.js): its
// module, its screen, how to play one question, and where its history lands.
// The bug was structural, so the guarantee has to be too — a second practice
// goes into this table.
const TABS = [
  { name: 'book practice', screen: 'wordDetail', history: 'unitsHistory',
    load: () => { const d = require(path.join(root, 'js', 'word-data.js'));
      for (const k of ['UNIT_WORDS_PR1', 'UNIT_WORDS_PR2', 'UNIT_WORDS_PR3', 'UNIT_PR_TITLES']) global[k] = d[k];
      return require(path.join(root, 'js', 'units.js')); },
    start: m => m.startUnitPractice('pr1-1'), answer: m => m.submitUnitAnswer(), finish: m => m.finishUnitPractice() },
];

suite('practice finish: one tap, one payout, one record', () => {
  for (const tab of TABS) {
    test(tab.name + ': tapping "see result" twice pays and records only once', () => {
      const mod = tab.load();
      const env = setup({ screens: [tab.screen], appState: { coins: 1000, [tab.history]: [] } });
      try {
        tab.start(mod); tab.answer(mod);
        tab.finish(mod);
        const coinsAfter = global.appState.coins;
        const recordsAfter = (global.appState[tab.history] || []).length;
        assert.equal(recordsAfter, 1, 'one finished practice is one record');
        tab.finish(mod);   // the child taps again
        assert.equal(global.appState.coins, coinsAfter, 'a second tap must pay nothing');
        assert.equal((global.appState[tab.history] || []).length, recordsAfter,
          'a second tap must not append another identical session');
      } finally { env.restore(); }
    });

    test(tab.name + ': a finish that throws mid-way still pays only once', () => {
      // The production sequence: something between the payout and the result
      // screen throws (a full disk, a missing screen, a render slip), the
      // screen never updates, and the frustrated child taps again — five
      // times. Coins and history must not grow with the taps.
      const mod = tab.load();
      // No screen at all: the result render throws, exactly like the frozen
      // device did, so the clear-the-quiz line is never reached.
      const env = setup({ screens: [], appState: { coins: 1000, [tab.history]: [] } });
      try {
        tab.start(mod); tab.answer(mod);
        try { tab.finish(mod); } catch (e) { /* the failure may surface */ }
        const coins = global.appState.coins;
        const records = (global.appState[tab.history] || []).length;
        for (let tapAgain = 0; tapAgain < 5; tapAgain++) {
          try { tab.finish(mod); } catch (e) {}
        }
        assert.equal(global.appState.coins, coins, 'five frustrated taps must not mint coins');
        assert.equal((global.appState[tab.history] || []).length, records,
          'five frustrated taps must not append five sessions');
      } finally { env.restore(); }
    });
  }
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
