// leave-guard-topics.test.js — the Topics tab, Word Hunt and the Sentence
// Builder, each walked out of the way a child would, and the rule every
// exercise in the app has to keep:
//
//   (A) mid-exercise, EVERY way out asks first. Cancel keeps the child on the
//       same round with the same state (and, for Word Hunt, the clock still
//       running); OK leaves and abandons cleanly — state nulled, timer
//       cleared, bottom bar back.
//   (B) once the result is on screen, leaving asks NOTHING and nothing is
//       left behind to block it: no overlay, no hidden bottom bar, no stale
//       "active" flag that makes switchScreen ask or refuse.
//   (C) the next open of the tab is clean: no ghost round, no checkpoint
//       offering the finished round back, no second payout.
//
// Executed, not grepped: the app boots in tests/verify/client.js's harness
// with a DOM shim, every start is the onclick the screen actually renders,
// and every exit is the exact call the button or the bottom bar makes.
//
// What was broken before this file (2026-09-11):
//   • every round the Topics tab starts (a topic chunk, Replay-due, Review
//     Mistakes, a focused or mixed SR review) runs on the shared lessonScreen
//     with the bottom bar hidden, so its only visible exit was the × — but
//     switchScreen() had no lesson clause, so a Daily Task deep link or any
//     other programmatic switch dropped the round with no question and left
//     the bar display:none on the next screen, and the result card / Sentence
//     Builder overlay outlived the switch. The shared lesson guard in
//     js/lessons.js (isLessonOnScreen / lessonLeaveQuestion / abandonLesson,
//     from the vocab branch) fixed that for every flavour; this file proves
//     it for each of the Topics-tab flavours, which set their own state and
//     reach lessonScreen by their own roads;
//   • Word Hunt's × ended the 60-second game on the spot (no question), and
//     the bottom bar — visible under the overlay — switched tabs beneath a
//     hunt whose clock kept ticking on top of the new screen. Fixed in
//     js/word-hunt.js (endWordHunt asks; isWordHuntActive / abandonWordHunt)
//     and js/app.js switchScreen.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { mountApp, loginTestUser } = require('./verify/client.js');

const settle = async (n) => { for (let i = 0; i < (n || 4); i++) await new Promise((r) => setImmediate(r)); };
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';

// Words a hunt can use (3–8 plain letters), tracked in SRS and due now — the
// same seed the Topics SR hub, the Replay-due button and Word Hunt all read.
function dueSrsFor(h, n, topicId) {
  const vocab = h.peek('ieltsVocabulary');
  let pool = vocab.filter((w) => /^[a-z]{3,8}$/i.test(w.en));
  if (topicId) {
    const inTopic = new Set(h.sandbox.getWordsForTopic(topicId, null).map((x) => x.word.en));
    pool = pool.filter((w) => inTopic.has(w.en));
  }
  const srs = {};
  pool.slice(0, n).forEach((w) => {
    srs[w.en] = { interval: 1, ease: 2.5, repetitions: 1, nextReview: Date.now() - 1000, lastReview: Date.now() - 86400000 };
  });
  return srs;
}

function boot(overrides) {
  const h = mountApp();
  assert.deepEqual(h.loadErrors, [], 'startup scripts threw');
  // clearInterval/clearTimeout are no-ops in the harness; record them so a
  // test can say "the clock was stopped" or "the clock is still running".
  h.cleared = [];
  h.sandbox.clearInterval = (id) => { h.cleared.push(id); };
  loginTestUser(h, Object.assign({ coins: 100, points: 0 }, overrides || {}));
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
  return h;
}

// Run the onclick a rendered button carries, exactly as the tap would.
function tap(h, el) {
  const code = el.getAttribute('onclick');
  assert.truthy(code, 'the button has no onclick to tap');
  return h.run(code);
}

function openTopics(h) {
  // The Learn hub's Topics card: onclick="switchScreen('topicsScreen'); renderTopicsHome()"
  const card = h.el('learnHubScreen').querySelector('.nav-hub-card.topics');
  assert.truthy(card, 'the Learn hub has a Topics card');
  h.sandbox.switchScreen('learnHubScreen');
  tap(h, card);
  assert.truthy(h.el('topicsScreen').classList.contains('active'), 'Topics is on screen');
}

function openFirstTopic(h) {
  openTopics(h);
  const first = h.el('topicsGrid').querySelectorAll('.topic-card').find((c) => !c.hasAttribute('disabled'));
  assert.truthy(first, 'a topic card with words');
  tap(h, first);                                   // openTopicDetail('<id>')
  const m = first.getAttribute('onclick').match(/openTopicDetail\('([^']+)'\)/);
  return m[1];
}

function lessonOn(h) { return h.el('lessonScreen').classList.contains('active'); }
function navShown(h) { return h.el('bottomNav').style.display !== 'none'; }
function cards(h, col) { return h.el(col).querySelectorAll('.match-card'); }

// One correct pair, tapped left then right, the way the child does it.
function matchOnePair(h) {
  const l = cards(h, 'leftColumn').find((c) => !c.classList.contains('matched'));
  const w = l.getAttribute('data-word');
  const r = cards(h, 'rightColumn').find((c) => c.getAttribute('data-word') === w);
  l.click(); r.click();
  assert.truthy(l.classList.contains('matched') && r.classList.contains('matched'), 'the pair matched');
  return w;
}

// Match everything, then fire the 500 ms "lesson done" timeout the last pair
// arms — timers are recorded, never fired, in this harness.
function finishLesson(h) {
  const before = h.timers.length;
  while (cards(h, 'leftColumn').some((c) => !c.classList.contains('matched'))) matchOnePair(h);
  const done = h.timers.slice(before).filter((t) => t.kind === 'timeout' && t.ms === 500).pop();
  assert.truthy(done, 'matching the last pair arms the completion timer');
  done.fn();
  assert.truthy(h.el('lessonComplete').classList.contains('active'), 'the result card is up');
  assert.truthy(h.peek('lessonState') && h.peek('lessonState').finished, 'the lesson is marked finished');
}

function snapshotRound(h) {
  const st = h.peek('lessonState');
  return {
    state: st, matched: st.matchedPairs, correct: st.correctInLesson, wrong: st.wrongInLesson,
    matchedWords: cards(h, 'leftColumn').filter((c) => c.classList.contains('matched')).map((c) => c.getAttribute('data-word')).sort().join(','),
    order: cards(h, 'leftColumn').map((c) => c.getAttribute('data-word')).join(','),
  };
}

// Every route out of a lesson-screen exercise. The bottom bar is hidden while
// one runs, so the nav routes are the programmatic ones a deep link, a
// checkpoint or a hub card would take; the × is the visible one.
const LESSON_EXITS = [
  ['the × (quitLesson)', (h) => { tap(h, h.el('lessonScreen').querySelector('.close-btn')); return null; }],
  ['bottom bar → Home', (h) => h.sandbox.switchScreen('homeScreen')],
  ['bottom bar → Learn hub', (h) => h.sandbox.switchScreen('learnHubScreen')],
  ['bottom bar → Toán', (h) => h.sandbox.switchScreen('mathHubScreen')],
  ['Learn hub → Topics card', (h) => { const r = h.sandbox.switchScreen('topicsScreen'); if (r !== false) h.sandbox.renderTopicsHome(); return r; }],
  ['bottom bar → Arena (openPetBattle)', (h) => { h.sandbox.openPetBattle(); return h.el('petBattleScreen').classList.contains('active'); }],
  // Every catalog entry starts something on arrival (a Word form practice
  // here); put THAT away once it has started so the assertions that follow
  // look at the round that was left, not the one the link opened.
  ['a Daily Task deep link', async (h) => { const r = await h.peek('DailyTask').go('wordform'); if (r) h.sandbox.abandonWordformQuiz(); return r; }],
];

// (A) for a lesson-screen round that `start(h)` puts on screen.
async function assertLessonGuarded(h, start, label) {
  for (const [name, exit] of LESSON_EXITS) {
    start(h);
    assert.truthy(lessonOn(h), label + ': the lesson is on screen');
    assert.falsy(navShown(h), label + ': the bottom bar is hidden during the lesson');
    matchOnePair(h);                               // there is now work to lose
    const before = snapshotRound(h);

    // Cancel: stay, untouched.
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    const stayed = await exit(h);
    await settle();
    assert.equal(h.sandbox.__confirmLog.length, 1, label + ' / ' + name + ': must ask exactly once (asked ' + h.sandbox.__confirmLog.length + ')');
    assert.truthy(stayed === false || stayed === null || stayed === undefined, label + ' / ' + name + ': saying no must not leave (returned ' + stayed + ')');
    assert.truthy(lessonOn(h), label + ' / ' + name + ': Cancel keeps the lesson on screen');
    const after = snapshotRound(h);
    assert.truthy(after.state === before.state, label + ' / ' + name + ': Cancel must keep the same lessonState object');
    assert.equal(after.matched, before.matched, label + ' / ' + name + ': pairs matched unchanged');
    assert.equal(after.correct, before.correct, label + ' / ' + name + ': correct count unchanged');
    assert.equal(after.wrong, before.wrong, label + ' / ' + name + ': wrong count unchanged');
    assert.equal(after.matchedWords, before.matchedWords, label + ' / ' + name + ': the matched cards stay matched');
    assert.equal(after.order, before.order, label + ' / ' + name + ': the cards were not re-dealt');
    assert.falsy(h.el('homeScreen').classList.contains('active'), label + ' / ' + name + ': no other screen came up underneath');
    assert.falsy(navShown(h), label + ' / ' + name + ': the bottom bar stays hidden');

    // OK: leave, cleanly.
    h.sandbox.__confirmAnswer = true;
    h.sandbox.__confirmLog.length = 0;
    const left = await exit(h);
    await settle();
    assert.equal(h.sandbox.__confirmLog.length, 1, label + ' / ' + name + ': asks once on the way out');
    assert.truthy(left !== false, label + ' / ' + name + ': saying yes must leave');
    assert.falsy(lessonOn(h), label + ' / ' + name + ': the lesson screen is gone');
    assert.truthy(navShown(h), label + ' / ' + name + ': the bottom bar is back');
    assert.falsy(h.el('lessonComplete').classList.contains('active'), label + ' / ' + name + ': no result card for an abandoned round');
    const st = h.peek('lessonState');
    assert.truthy(!st || st.finished || !(st.roundWords || []).length, label + ' / ' + name + ': no live lessonState left behind');
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, label + ' / ' + name + ': no checkpoint offers the abandoned round back');
    const shown = h.doc.querySelectorAll('.screen.active').map((s) => s.id);
    assert.equal(shown.length, 1, label + ' / ' + name + ': exactly one screen is on after leaving (' + shown.join(',') + ')');
    assert.truthy(shown[0] !== 'lessonScreen', label + ' / ' + name + ': and it is the destination, not the lesson');
    const stale = h.sandbox.__confirmLog.length;
    // The next tab switch must not ask about the round that was just left.
    h.sandbox.switchScreen('homeScreen'); await settle();
    assert.equal(h.sandbox.__confirmLog.length, stale, label + ' / ' + name + ': no stale flag makes the next switch ask again');
  }
}

// (B) + (C) for the same round: play it through, then walk out every way.
// The result card (#lessonComplete) is a fixed full-screen overlay, so the ×
// under it is not a route a finger can take; Continue is, and so is every
// programmatic switch (a deep link, a hub card, a checkpoint).
const DONE_EXITS = LESSON_EXITS.slice(1).concat([
  ['Continue', (h) => { tap(h, h.el('lessonComplete').querySelector('.complete-btn')); return null; }],
]);

async function assertLessonFreeWhenDone(h, start, label) {
  for (const [name, exit] of DONE_EXITS) {
    start(h);
    const pointsBefore = h.state().points;
    const coinsBefore = h.state().coins;
    finishLesson(h);
    const paid = h.state().points - pointsBefore;
    assert.truthy(paid > 0, label + ': finishing pays points (' + paid + ')');
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, label + ': a finished round is never checkpointed');
    assert.equal(h.sandbox.isLessonActive(), false, label + ': the finished lesson no longer counts as active');

    h.sandbox.__confirmAnswer = false;           // would refuse, if asked
    h.sandbox.__confirmLog.length = 0;
    const left = await exit(h);
    await settle();
    assert.equal(h.sandbox.__confirmLog.length, 0, label + ' / ' + name + ': leaving a FINISHED round must not ask');
    assert.truthy(left !== false, label + ' / ' + name + ': and must not refuse');
    assert.falsy(h.el('lessonComplete').classList.contains('active'), label + ' / ' + name + ': the result card is taken down');
    assert.equal(h.state().points - pointsBefore, paid, label + ' / ' + name + ': leaving pays nothing twice');
    assert.equal(h.state().coins, coinsBefore, label + ' / ' + name + ': coins unchanged by leaving');
    const chained = name === 'Continue' && lessonOn(h);
    if (chained) {
      // A topic chunk's Continue goes straight to the next unfinished chunk
      // (js/lessons.js closeLessonComplete): a NEW round, not the old one.
      const st = h.peek('lessonState');
      assert.truthy(st && !st.finished && st.matchedPairs === 0, label + ' / Continue: the next chunk is a fresh round');
      assert.falsy(navShown(h), label + ' / Continue: still full-screen for the next round');
      h.sandbox.__confirmAnswer = true;
      h.sandbox.switchScreen('homeScreen'); await settle();
      assert.falsy(lessonOn(h));
    } else {
      assert.falsy(lessonOn(h), label + ' / ' + name + ': the lesson screen closes');
      assert.truthy(navShown(h), label + ' / ' + name + ': the bottom bar is visible again');
    }
    // (C) the tab opens clean.
    h.sandbox.saveStudyCheckpoint();
    assert.equal(h.store[CHECKPOINT_KEY], undefined, label + ' / ' + name + ': nothing in the checkpoint slot');
    openTopics(h);
    assert.truthy(h.el('topicsGrid').querySelectorAll('.topic-card').length >= 10, label + ' / ' + name + ': Topics renders its grid again');
    assert.falsy(lessonOn(h), label + ' / ' + name + ': no ghost lesson screen');
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, label + ' / ' + name + ': still nothing to restore');
    // A fresh start deals a fresh round.
    start(h);
    const st = h.peek('lessonState');
    assert.equal(st.matchedPairs, 0, label + ' / ' + name + ': the next round starts at zero');
    assert.falsy(st.finished, label + ' / ' + name + ': and is not born finished');
    assert.equal(cards(h, 'leftColumn').filter((c) => c.classList.contains('matched')).length, 0, label + ' / ' + name + ': no card is pre-matched');
    // …and put it away for the next exit route.
    h.sandbox.__confirmAnswer = true;
    h.sandbox.switchScreen('homeScreen'); await settle();
    assert.falsy(lessonOn(h));
  }
}

// ---------------------------------------------------------------------------
// the Topics tab
// ---------------------------------------------------------------------------

suite('leave guards: Topics — a topic lesson (startTopicLessonChunk)', () => {
  let topicId = null;
  const start = (h) => {
    if (!topicId) topicId = openFirstTopic(h); else { openTopics(h); h.sandbox.openTopicDetail(topicId); }
    const btn = h.el('topicsDetail').querySelectorAll('.topic-lesson-start-btn')[0];
    assert.truthy(/startTopicLessonChunk\('[a-z]+', \d+\)/.test(btn.getAttribute('onclick')), 'the card starts a chunk: ' + btn.getAttribute('onclick'));
    tap(h, btn);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isTopicLesson && st.topicId === topicId, 'a topic lesson is running');
  };

  test('(A) every way out asks; Cancel keeps the same round; OK abandons cleanly', async () => {
    const h = boot();
    await assertLessonGuarded(h, start, 'topic lesson');
  });

  test('(B)+(C) finished: every way out is free, nothing left behind, next open clean', async () => {
    const h = boot();
    await assertLessonFreeWhenDone(h, start, 'topic lesson');
  });

  test('(B) Continue chains to the next unfinished chunk, and its × leaves with no question before any work', async () => {
    const h = boot();
    start(h);
    const first = h.peek('lessonState').topicChunkIdx;
    finishLesson(h);
    tap(h, h.el('lessonComplete').querySelector('.complete-btn'));    // closeLessonComplete()
    assert.falsy(h.el('lessonComplete').classList.contains('active'));
    const st = h.peek('lessonState');
    assert.truthy(st && st.isTopicLesson && !st.finished, 'a new chunk started');
    assert.truthy(st.topicChunkIdx !== first, 'and it is not the one just finished (' + st.topicChunkIdx + ')');
    assert.equal(st.matchedPairs, 0);
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('lessonScreen').querySelector('.close-btn'));           // quitLesson()
    assert.equal(h.sandbox.__confirmLog.length, 0, 'nothing answered yet → nothing to lose → no question');
    assert.falsy(lessonOn(h));
    assert.truthy(h.el('topicsScreen').classList.contains('active'), 'back on the topic detail');
    assert.truthy(navShown(h));
    assert.truthy(h.el('topicsDetail').innerHTML.includes('startTopicLessonChunk'), 'the detail with its lesson cards');
  });

  test('(C) the finished chunk is recorded once, and replaying it later starts a fresh round', async () => {
    const h = boot();
    start(h);
    const idx = h.peek('lessonState').topicChunkIdx;
    finishLesson(h);
    const prog = h.state().topicProgress[topicId];
    assert.truthy(prog && prog[idx], 'progress recorded for chunk ' + idx);
    h.sandbox.switchScreen('homeScreen'); await settle();
    openTopics(h); h.sandbox.openTopicDetail(topicId);
    const replay = h.el('topicsDetail').querySelectorAll('.topic-lesson-start-btn')
      .find((b) => b.getAttribute('onclick') === "startTopicLessonChunk('" + topicId + "', " + idx + ')');
    assert.truthy(replay, 'the finished chunk still offers a replay');
    assert.truthy(/Replay|Try again|refresh/i.test(replay.textContent), 'labelled as a replay: ' + replay.textContent.trim());
    tap(h, replay);
    assert.equal(h.peek('lessonState').matchedPairs, 0, 'a fresh round');
    assert.falsy(h.peek('lessonState').finished);
  });
});

suite('leave guards: Topics — the old startTopicLesson(topicId) entry', () => {
  const start = (h) => {
    openTopics(h);
    h.sandbox.startTopicLesson('daily', true);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isTopicLesson && st.topicChunkIdx === undefined, 'a shuffled topic lesson is running');
  };
  test('(A) guarded like a chunk', async () => { await assertLessonGuarded(boot(), start, 'shuffled topic lesson'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'shuffled topic lesson'); });
});

suite('leave guards: Topics — Replay N due (startTopicLessonReplayDue)', () => {
  const topicId = 'daily';
  let chunkIdx = null;
  const seed = (h) => {
    // Chunk 0 of Daily Life finished once, and every word in it due now.
    const wpl = h.peek('WORDS_PER_LESSON');
    const chunk = h.sandbox.getWordsForTopic(topicId, null).slice(0, wpl).map((x) => x.word.en);
    const srs = {};
    chunk.forEach((en) => { srs[en] = { interval: 1, ease: 2.5, repetitions: 1, nextReview: Date.now() - 1000, lastReview: Date.now() - 86400000 }; });
    h.state().srs = srs;
    h.state().topicProgress = { [topicId]: { 0: { mistakes: 1, accuracy: 80, date: Date.now() - 3600000 } } };
    h.sandbox.saveUserData(h.peek('currentUser'), h.state());
  };
  const start = (h) => {
    seed(h);
    openTopics(h); h.sandbox.openTopicDetail(topicId);
    const btn = h.el('topicsDetail').querySelector('.topic-lesson-replay-due-btn');
    assert.truthy(btn, 'the finished chunk with due words offers "Replay N due"');
    assert.truthy(/startTopicLessonReplayDue\('daily', 0\)/.test(btn.getAttribute('onclick')), btn.getAttribute('onclick'));
    tap(h, btn);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isReviewSession && st.topicReviewMeta && st.topicReviewMeta.mode === 'lesson-due', 'a due-only replay is running');
    chunkIdx = st.topicReviewMeta.lessonIdx;
  };
  test('(A) guarded', async () => { await assertLessonGuarded(boot(), start, 'replay due'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'replay due'); });
});

suite('leave guards: Topics — Review Mistakes (startReviewLessonChunk)', () => {
  const start = (h) => {
    const vocab = h.peek('ieltsVocabulary');
    h.state().mistakes = vocab.slice(0, 6).map((w, i) => ({ word: w.en, count: 6 - i, firstMistake: Date.now(), lastMistake: Date.now() }));
    openTopics(h);
    const card = h.el('topicsReviewCard').querySelector('.topics-review-btn');
    assert.truthy(card, 'the Review Mistakes card is offered');
    tap(h, card);                                                       // openReviewDetail()
    const btn = h.el('topicsDetail').querySelectorAll('.topic-lesson-start-btn')[0];
    assert.equal(btn.getAttribute('onclick'), 'startReviewLessonChunk(0)');
    tap(h, btn);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isTopicLesson && st.topicId === '__review__', 'a mistakes review is running');
  };
  test('(A) guarded', async () => { await assertLessonGuarded(boot(), start, 'review mistakes'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'review mistakes'); });
  test('the × on a finished review returns to the Review Mistakes detail with the bar back', async () => {
    const h = boot();
    start(h);
    finishLesson(h);
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('lessonScreen').querySelector('.close-btn'));
    assert.equal(h.sandbox.__confirmLog.length, 0);
    assert.truthy(h.el('topicsScreen').classList.contains('active'));
    assert.truthy(navShown(h));
  });
});

suite('leave guards: Topics — a focused SR review (startTopicReviewSession)', () => {
  const topicId = 'daily';
  const start = (h) => {
    h.state().srs = dueSrsFor(h, 8, topicId);
    h.sandbox.saveUserData(h.peek('currentUser'), h.state());
    openTopics(h); h.sandbox.openTopicDetail(topicId);
    const btn = h.el('topicsDetail').querySelector('.topic-sr-review-btn');
    assert.truthy(btn, 'the SR hub offers "Review N due"');
    assert.truthy(/startTopicReviewSession\('daily', 'due'\)/.test(btn.getAttribute('onclick')), btn.getAttribute('onclick'));
    tap(h, btn);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isReviewSession && st.topicReviewMeta && st.topicReviewMeta.topicId === topicId, 'a topic review is running');
  };
  test('(A) guarded', async () => { await assertLessonGuarded(boot(), start, 'topic SR review'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'topic SR review'); });
});

suite('leave guards: Topics — the mixed daily review banner (startReviewSession)', () => {
  const start = (h) => {
    h.state().srs = dueSrsFor(h, 8);
    h.sandbox.saveUserData(h.peek('currentUser'), h.state());
    openTopics(h);
    const banner = h.el('topicsSrBanner').querySelector('.topics-sr-banner-due');
    assert.truthy(banner, 'the "Today: N words to review" banner is up');
    assert.equal(banner.getAttribute('onclick'), 'startReviewSession()');
    tap(h, banner);
    const st = h.peek('lessonState');
    assert.truthy(st && st.isReviewSession, 'a mixed review is running');
  };
  test('(A) guarded', async () => { await assertLessonGuarded(boot(), start, 'mixed review'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'mixed review'); });
});

suite('leave guards: Topics — the picture-card practice (js/topic-vocab.js startTopicPractice)', () => {
  // js/topic-vocab.js is precached but has NO <script> tag in index.html
  // (tests/gen-app-integrity.test.js pins that), so no child can reach it
  // today. It still runs on lessonScreen, so it is loaded here by hand and
  // held to the same rule in case it is ever wired back in.
  const load = (h) => {
    if (typeof h.sandbox.startTopicPractice === 'function') return;
    require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'js', 'topic-vocab.js'), 'utf8'), h.sandbox, { filename: 'js/topic-vocab.js' });
  };
  const start = (h) => {
    load(h);
    openTopics(h);
    h.sandbox.startTopicPractice('Kitchen');
    const st = h.peek('lessonState');
    assert.truthy(st && st.isTopicPractice, 'a picture-card practice is running');
  };
  test('(A) guarded', async () => { await assertLessonGuarded(boot(), start, 'topic practice'); });
  test('(B)+(C) free once finished', async () => { await assertLessonFreeWhenDone(boot(), start, 'topic practice'); });
});

// ---------------------------------------------------------------------------
// Word Hunt — a timed overlay over Home; the bottom bar stays visible under it
// ---------------------------------------------------------------------------

function huntOverlayUp(h) { return h.el('wordHuntOverlay').classList.contains('active'); }

// Nothing in the shipped markup calls openWordHunt() today: renderWordHuntCard()
// draws its Play button into #wordHuntCard, and index.html has no such
// element. The verify layer (tests/verify/client.js) drives the game the same
// way this does — through the function the card WOULD call.
function startHunt(h) {
  h.sandbox.switchScreen('homeScreen');
  assert.equal(h.el('wordHuntCard'), null, 'index.html still has no Word Hunt card — if it grows one, tap it here instead');
  h.sandbox.openWordHunt();
  const hs = h.peek('huntState');
  assert.truthy(huntOverlayUp(h) && hs.words.length === 3 && !hs.finished, 'a hunt is running');
  assert.truthy(hs.timer, 'with a clock');
  assert.truthy(navShown(h), 'the bottom bar is not hidden by the hunt (it sits under the overlay)');
  return hs;
}

// Trace one target word across the real grid cells.
function findOne(h) {
  const hs = h.peek('huntState');
  const grid = hs.grid, N = grid.length;
  const target = hs.words.find((w) => !hs.foundWords.includes(w.en));
  const T = target.en.toUpperCase();
  const dirs = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of dirs) {
    const cs = []; let ok = true;
    for (let k = 0; k < T.length; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || grid[rr][cc] !== T[k]) { ok = false; break; }
      cs.push({ r: rr, c: cc });
    }
    if (ok) {
      hs.selectedCells = cs;
      h.sandbox.checkHuntSelection();
      assert.truthy(h.peek('huntState').foundWords.includes(target.en), 'traced "' + target.en + '"');
      return target.en;
    }
  }
  throw new Error('"' + T + '" is not in the grid');
}

const HUNT_EXITS = [
  ['the × (endWordHunt)', (h) => { const x = h.el('wordHuntOverlay').querySelector('.close-btn'); assert.truthy(x, 'the hunt has an × while it runs'); tap(h, x); return null; }],
  ['bottom bar → Learn hub', (h) => h.sandbox.switchScreen('learnHubScreen')],
  ['bottom bar → Toán', (h) => h.sandbox.switchScreen('mathHubScreen')],
  ['bottom bar → Home (already there)', (h) => h.sandbox.switchScreen('homeScreen')],
  ['bottom bar → Arena (openPetBattle)', (h) => { h.sandbox.openPetBattle(); return h.el('petBattleScreen').classList.contains('active'); }],
  ['a Daily Task deep link', async (h) => { const r = await h.peek('DailyTask').go('wordform'); if (r) h.sandbox.abandonWordformQuiz(); return r; }],
];

suite('leave guards: Word Hunt (openWordHunt, a 60-second clock)', () => {
  const seed = () => ({ lessonsCompleted: 5, points: 500 });

  test('(A) every way out asks; Cancel leaves the clock running on the same grid; OK stops the clock and drops the overlay', async () => {
    const h = boot(seed());
    h.state().srs = dueSrsFor(h, 12);
    for (const [name, exit] of HUNT_EXITS) {
      const hs = startHunt(h);
      const found = findOne(h);                                    // there is now work to lose
      const grid = JSON.stringify(hs.grid);
      const timer = hs.timer;
      h.cleared.length = 0;

      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      const stayed = await exit(h);
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 1, name + ': must ask exactly once');
      assert.truthy(stayed === false || stayed == null, name + ': saying no must not leave (returned ' + stayed + ')');
      assert.truthy(huntOverlayUp(h), name + ': Cancel keeps the hunt up');
      const now = h.peek('huntState');
      assert.truthy(now === hs, name + ': same huntState object');
      assert.equal(JSON.stringify(now.grid), grid, name + ': same grid');
      assert.deepEqual(now.foundWords, [found], name + ': the word already found stays found');
      assert.falsy(now.finished, name + ': not finished');
      assert.equal(now.timer, timer, name + ': the same clock');
      assert.deepEqual(h.cleared, [], name + ': the clock was not stopped');
      assert.truthy(h.el('wordHuntOverlay').querySelector('#whGrid'), name + ': the grid is still on screen, not a score card');
      // …and it still ticks: run one recorded tick and see the label move.
      const tickFn = h.timers[timer - 1].fn;
      now.startTime = Date.now() - 30000;
      tickFn();
      assert.truthy(/^30s|^31s|^29s/.test(h.el('whTimer').textContent), name + ': the clock keeps counting (' + h.el('whTimer').textContent + ')');
      assert.truthy(h.el('homeScreen').classList.contains('active'), name + ': Home stays underneath');

      h.sandbox.__confirmAnswer = true;
      h.sandbox.__confirmLog.length = 0;
      const left = await exit(h);
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 1, name + ': asks once on the way out');
      assert.truthy(left !== false, name + ': saying yes must leave');
      assert.truthy(h.cleared.includes(timer), name + ': the clock is stopped');
      assert.truthy(h.peek('huntState').finished, name + ': the game is over');
      if (name.startsWith('the ×')) {
        // The × ends the game where it stands: the score card, then Done.
        assert.truthy(huntOverlayUp(h) && h.el('wordHuntOverlay').querySelector('.wh-complete'), '×: the score card shows what was found');
        assert.truthy(h.el('wordHuntOverlay').textContent.includes('1/3'), '×: one word found');
        h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
        tap(h, h.el('wordHuntOverlay').querySelector('.primary-btn'));   // closeWordHunt()
        assert.equal(h.sandbox.__confirmLog.length, 0, '×: Done asks nothing');
      }
      assert.falsy(huntOverlayUp(h), name + ': the overlay is down');
      assert.truthy(navShown(h), name + ': the bottom bar is visible');
      assert.equal(h.sandbox.buildStudyCheckpoint(), null, name + ': nothing to restore');
      // No stale flag: the next switch asks nothing.
      h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true, name + ': the next tab switch goes through');
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': and asks nothing');
      h.sandbox.__confirmAnswer = true;
    }
  });

  test('(B)+(C) finished by finding all three: Done and every tab are free, the next hunt is fresh', async () => {
    const h = boot(seed());
    h.state().srs = dueSrsFor(h, 12);
    for (const [name, exit] of HUNT_EXITS.slice(1).concat([['Done', (h) => { tap(h, h.el('wordHuntOverlay').querySelector('.wh-complete .primary-btn')); return null; }]])) {
      const hs = startHunt(h);
      const pointsBefore = h.state().points;
      const winsBefore = h.state()._huntWins || 0;
      findOne(h); findOne(h);
      const before = h.timers.length;
      findOne(h);
      const victory = h.timers.slice(before).filter((t) => t.kind === 'timeout' && t.ms === 800).pop();
      assert.truthy(victory, 'the last word arms the 800 ms victory timer');
      victory.fn();                                                 // completeWordHunt()
      assert.truthy(hs.finished && h.el('wordHuntOverlay').querySelector('.wh-complete'), name + ': the score card is up');
      assert.truthy(h.cleared.includes(hs.timer), name + ': the clock stopped with the win');
      const paid = h.state().points - pointsBefore;
      assert.equal(paid, 90, name + ': three words paid once (' + paid + ')');
      assert.equal(h.state()._huntWins, winsBefore + 1, name + ': one win counted');
      assert.equal(h.sandbox.isWordHuntActive(), false, name + ': a finished hunt is not "active"');

      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      const left = await exit(h);
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': leaving a finished hunt asks nothing');
      assert.truthy(left !== false, name + ': and is not refused');
      assert.falsy(huntOverlayUp(h), name + ': the score card is taken down');
      assert.truthy(navShown(h), name + ': the bottom bar is visible');
      assert.equal(h.state().points - pointsBefore, 90, name + ': nothing paid twice');
      assert.equal(h.state()._huntWins, winsBefore + 1, name + ': the win is not counted twice');
      // (C) a new hunt is a new hunt.
      const again = startHunt(h);
      assert.truthy(again !== hs, name + ': fresh state');
      assert.deepEqual(again.foundWords, [], name + ': nothing pre-found');
      assert.falsy(again.finished);
      assert.truthy(again.timer !== hs.timer, name + ': a new clock');
      h.sandbox.__confirmAnswer = true;
      h.sandbox.switchScreen('homeScreen'); await settle();
      assert.falsy(huntOverlayUp(h));
    }
  });

  test('(B) finished by the clock running out: same freedom', async () => {
    const h = boot(seed());
    h.state().srs = dueSrsFor(h, 12);
    const hs = startHunt(h);
    findOne(h);
    const pointsBefore = h.state().points;
    hs.startTime = Date.now() - 61000;
    h.timers[hs.timer - 1].fn();                                    // the tick that hits 0:00
    assert.truthy(hs.finished, 'time is up');
    assert.truthy(h.el('wordHuntOverlay').textContent.includes("Time's Up"), 'and says so');
    assert.truthy(h.cleared.includes(hs.timer), 'the clock stopped');
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('learnHubScreen'), true, 'a tab switch goes straight through');
    assert.equal(h.sandbox.__confirmLog.length, 0, 'no question');
    assert.falsy(huntOverlayUp(h), 'the overlay is gone');
    assert.equal(h.state().points, pointsBefore, 'nothing paid on the way out');
    // The late victory timer (if any) and the tick must not resurrect it.
    h.timers.slice(hs.timer - 1).forEach((t) => { try { t.fn(); } catch (e) { throw new Error('a stale timer threw: ' + e.message); } });
    assert.falsy(huntOverlayUp(h), 'no stale timer brings the overlay back');
  });
});

// ---------------------------------------------------------------------------
// the Sentence Builder — offered after a regular lesson is scored and paid
// ---------------------------------------------------------------------------

function sbUp(h) { return h.el('sentenceBuilderOverlay').classList.contains('active'); }

// A regular lesson played to 100 % puts the builder up (js/lessons.js
// completeLesson → offerSentenceBuilder). Practice and review rounds never do.
function startBuilder(h) {
  h.sandbox.switchScreen('homeScreen');
  h.sandbox.startLesson(0);
  assert.truthy(lessonOn(h));
  const coinsBefore = h.state().coins;
  finishLessonQuiet(h);
  assert.truthy(sbUp(h), 'a perfect regular lesson offers the Sentence Builder');
  assert.falsy(h.el('lessonComplete').classList.contains('active'), 'the result card waits behind it');
  assert.truthy(h.state().coins > coinsBefore, 'the lesson is already paid before the builder shows');
  return h.state().coins;
}
function finishLessonQuiet(h) {
  const before = h.timers.length;
  while (cards(h, 'leftColumn').some((c) => !c.classList.contains('matched'))) matchOnePair(h);
  h.timers.slice(before).filter((t) => t.kind === 'timeout' && t.ms === 500).pop().fn();
}

suite('leave guards: the Sentence Builder (js/sentence-builder.js)', () => {
  test('it is a post-result step: Save and Skip leave with no question and land on the result card', async () => {
    for (const [name, sel] of [['Save', '.sb-save-btn'], ['Skip', '.sb-skip-btn']]) {
      const h = boot();
      const coins = startBuilder(h);
      const points = h.state().points;
      const sentences = (h.state().sentences || []).length;
      tap(h, h.el('sentenceBuilderOverlay').querySelector('.sb-emoji-btn'));   // decorate a little
      assert.equal(h.peek('sentenceBuilderState').emojis.length, 1);
      h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
      tap(h, h.el('sentenceBuilderOverlay').querySelector(sel));
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': asks nothing');
      assert.falsy(sbUp(h), name + ': the builder closes');
      assert.truthy(h.el('lessonComplete').classList.contains('active'), name + ': the result card shows');
      assert.equal(h.state().coins, coins, name + ': no second payout');
      assert.equal(h.state().points, points, name + ': no second payout');
      assert.equal((h.state().sentences || []).length, sentences + (name === 'Save' ? 1 : 0), name + ': saved sentences');
      // Continue → out, bar back, nothing to restore.
      tap(h, h.el('lessonComplete').querySelector('.complete-btn'));
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': Continue asks nothing');
      assert.falsy(lessonOn(h)); assert.truthy(navShown(h));
      assert.truthy(h.el('homeScreen').classList.contains('active'));
      assert.equal(h.sandbox.buildStudyCheckpoint(), null);
      h.sandbox.saveStudyCheckpoint();
      assert.equal(h.store[CHECKPOINT_KEY], undefined, name + ': nothing in the checkpoint slot');
    }
  });

  test('a tab switch while the builder is up asks nothing and takes the overlay and the hidden bar with it', async () => {
    for (const [name, exit] of LESSON_EXITS.slice(1)) {
      const h = boot();
      const coins = startBuilder(h);
      h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
      const left = await exit(h);
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': the lesson is already scored — nothing to ask about');
      assert.truthy(left !== false, name + ': not refused');
      assert.falsy(sbUp(h), name + ': the builder overlay is gone');
      assert.falsy(lessonOn(h), name + ': the lesson screen is gone');
      assert.falsy(h.el('lessonComplete').classList.contains('active'), name + ': no result card left over');
      assert.truthy(navShown(h), name + ': the bottom bar is back');
      assert.equal(h.state().coins, coins, name + ': nothing paid twice');
      assert.equal(h.sandbox.buildStudyCheckpoint(), null, name + ': nothing to restore');
      // (C) Home opens clean and a new lesson is fresh.
      h.sandbox.__confirmAnswer = true;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true);
      assert.equal(h.sandbox.__confirmLog.length, 0, name + ': no stale flag');
      h.sandbox.startLesson(0);
      assert.equal(h.peek('lessonState').matchedPairs, 0, name + ': a fresh round');
      assert.falsy(sbUp(h), name + ': no ghost builder');
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
