// The whole profile lives in ONE localStorage blob, re-stringified on every
// save. This suite pins the two properties that keep an old iPad usable:
//   1. The blob is BOUNDED — histories are halved (newest kept) before the
//      profile can grow past the soft limit, so per-answer saves stay cheap.
//   2. A full disk sheds by HALVING — a handful of re-stringifies, never the
//      old one-line-at-a-time loop that froze the app for half a minute the
//      moment a child tapped "see result".
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const app = loadAppCode({ extraGlobals: { setTimeout: () => 0, requestAnimationFrame: () => 0 } });

// Newest-first history (unshift-style: phrases, math, grammar, …).
function newestFirst(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: 'phr-' + (n - i), date: 1755000000000 + (n - i) * 86400000,
    score: 7, total: 10,
    wrong: [{ qid: 'q' + i, ua: 2 }],
    skills: Array.from({ length: 6 }, (_, k) => ({
      skillKey: 'sk' + k, skillLabel: 'Kỹ năng số ' + k + ' của bài học',
      attempts: 10, correct: 7, wrong: 3, skipped: 0, durationMs: 52340,
      wrongRefs: ['a' + k, 'b' + k, 'c' + k],
    })),
  }));
}
// Oldest-first history (push-style: lessonHistory).
function oldestFirst(n) {
  return Array.from({ length: n }, (_, i) => ({ lessonNum: i, date: 1755000000000 + i, points: 100, accuracy: 80 }));
}
function bigState() {
  return {
    coins: 5000, points: 90000,
    phrasesHistory: newestFirst(300), wordformHistory: newestFirst(300),
    rewriteHistory: newestFirst(300), collocHistory: newestFirst(300),
    unitsHistory: newestFirst(300), grammarHistory: newestFirst(300),
    mathHistory: newestFirst(300), warsHistory: newestFirst(300),
    nightRaidHistory: newestFirst(100),
    lessonHistory: oldestFirst(200),
    speedChallenge: { history: oldestFirst(50) },
  };
}
function withSetItem(fn, run) {
  const original = app.localStorage.setItem;
  app.localStorage.setItem = fn;
  try { return run(); } finally { app.localStorage.setItem = original; }
}

suite('appState quota: a full disk sheds by halving, never line-by-line', () => {
  test('quota errors halve the books (newest kept) in a handful of attempts', () => {
    const st = bigState();
    let attempts = 0;
    withSetItem((k, v) => {
      attempts++;
      if (String(v).length > 900000) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    }, () => app.saveUserData('Kid', st));
    assert.truthy(attempts <= 8, 'halving converges fast, got ' + attempts + ' attempts');
    assert.truthy(st.phrasesHistory.length < 300, 'old sessions were shed');
    assert.truthy(st.phrasesHistory.length >= 40, 'a floor of recent sessions survives');
    assert.equal(st.phrasesHistory[0].id, 'phr-300', 'newest-first books keep the NEWEST entries');
    const lessons = st.lessonHistory;
    assert.equal(lessons[lessons.length - 1].lessonNum, 199, 'append-style books keep their newest tail');
  });

  test('a hopeless disk fails loudly after bounded attempts — no minute-long freeze', () => {
    const st = bigState();
    let attempts = 0;
    let threw = false;
    try {
      withSetItem(() => { attempts++; const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; },
        () => app.saveUserData('Kid', st));
    } catch (e) { threw = true; }
    assert.truthy(threw, 'the caller still learns the save failed');
    assert.truthy(attempts <= 12, 'bounded, got ' + attempts + ' attempts (the old loop made hundreds)');
  });

  test('the blob is bounded BEFORE the disk fills: oversized profiles shrink on save', () => {
    const st = bigState();
    let stored = '';
    withSetItem((k, v) => { stored = String(v); }, () => app.saveUserData('Kid', st));
    assert.truthy(stored.length > 0, 'the save happened');
    assert.truthy(stored.length < 2400000,
      'an oversized profile must be trimmed under the soft limit, stored ' + stored.length + ' bytes');
    assert.equal(st.phrasesHistory[0].id, 'phr-300', 'trimming still keeps the newest sessions');
  });

  test('a normal-sized profile is stored untouched in one attempt', () => {
    const st = { coins: 120, phrasesHistory: newestFirst(20), lessonHistory: oldestFirst(10) };
    let attempts = 0; let stored = '';
    withSetItem((k, v) => { attempts++; stored = String(v); }, () => app.saveUserData('Kid', st));
    assert.equal(attempts, 1);
    assert.equal(st.phrasesHistory.length, 20, 'nothing is shed below the limit');
    assert.equal(JSON.parse(stored).phrasesHistory.length, 20);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
