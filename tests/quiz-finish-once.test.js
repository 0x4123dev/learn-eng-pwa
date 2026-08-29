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

function el() { return { innerHTML: '', value: '', focus() {}, scrollTop: 0, classList: { add() {}, remove() {} } }; }

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

// Each tab: its module, screen id, how to play one question, and where its
// history lands. Every practice tab in the app is represented — the bug was
// structural, so the guarantee has to be too.
const TABS = [
  { name: 'phrases', screen: 'phrasesScreen', history: 'phrasesHistory',
    load: () => { const d = require(path.join(root, 'js', 'phrases-data.js'));
      global.PREPOSITION_QUESTIONS = d.PREPOSITION_QUESTIONS || d;
      try { const m = require(path.join(root, 'js', 'phrases-meanings.js')); global.PHRASE_MEANINGS = m.PHRASE_MEANINGS || m; } catch (e) {}
      return require(path.join(root, 'js', 'phrases.js')); },
    start: m => m.startPhrasesQuiz(5), answer: m => m.answerPhrQuestion(0), finish: m => m.finishPhrasesQuiz() },
  { name: 'wordform', screen: 'wordformScreen', history: 'wordformHistory',
    load: () => { const d = require(path.join(root, 'js', 'wordform-data.js'));
      global.WORDFORM_QUESTIONS = d.WORDFORM_QUESTIONS || d;
      try { const f = require(path.join(root, 'js', 'wordform-followups.js')); global.WORDFORM_FOLLOWUPS = f.WORDFORM_FOLLOWUPS || f; } catch (e) {}
      return require(path.join(root, 'js', 'wordform.js')); },
    start: m => m.startWordformQuiz(5), answer: m => m.answerWfQuestion(0), finish: m => m.finishWordformQuiz() },
  { name: 'rewrite', screen: 'rewriteScreen', history: 'rewriteHistory',
    load: () => { const d = require(path.join(root, 'js', 'rewrite-data.js'));
      global.REWRITE_QUESTIONS = d.REWRITE_QUESTIONS || d;
      return require(path.join(root, 'js', 'rewrite.js')); },
    start: m => m.startRewriteQuiz(5), answer: () => {}, finish: m => m.finishRewriteQuiz() },
];

suite('practice finish: the result screen survives every question kind', () => {
  test('phrases: a wrong TYPED answer still renders the result', () => {
    // ~1 in 10 Phrases questions is typed, and a typed question has `answer`,
    // not `options`. The review list read `q.options[q.correct]` for every
    // wrong answer, so ONE missed typed question threw a TypeError, the result
    // screen never appeared, and the practice could never finish — the freeze
    // the child hit right after tapping "see result".
    const d = require(path.join(root, 'js', 'phrases-data.js'));
    global.PREPOSITION_QUESTIONS = d.PREPOSITION_QUESTIONS || d;
    const mod = require(path.join(root, 'js', 'phrases.js'));
    const env = setup({ screens: ['phrasesScreen'], appState: { coins: 0, phrasesHistory: [] } });
    try {
      const base = (global.PREPOSITION_QUESTIONS || [])[0];
      const typed = mod.phrasesById('pt-' + base.id);   // the typed variant of a real question
      assert.truthy(typed && !typed.options && typed.answer,
        'a typed question has an answer and no options');
      mod.startPhrasesReviewQuiz([typed.id]);   // a practice of exactly that typed question
      mod.finishPhrasesQuiz();                  // must not throw
      const html = env.screens.phrasesScreen.innerHTML;
      assert.truthy(html.includes('grammar-result-card'), 'the result screen must render');
      assert.truthy(html.includes(typed.answer), 'and must show the correct typed answer');
    } finally { env.restore(); }
  });
});

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
