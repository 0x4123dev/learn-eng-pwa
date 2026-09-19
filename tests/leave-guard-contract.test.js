// leave-guard-contract.test.js — THE contract behind the ten
// tests/leave-guard-*.test.js files: every exercise and game in the app is
// CLAIMED here, and every claim is EXECUTED against the leave rule.
//
// The rule (the parent's words): while an exercise is in progress, any way
// out — the bottom bar (Home / Eng / Arena via openPetBattle() / Toán), a
// Learn-hub card, a Daily Task deep link — must confirm(). Cancel keeps the
// child exactly where they were. OK leaves cleanly: state cleared, the bottom
// bar back, _busyWithTimedActivity() false, no study checkpoint left behind.
//
// Two halves, same idea as tests/verify/manifest.js ("claim it or the run
// goes RED"):
//
//   PART 1 — the inventory must be claimed. Signals are scraped from the
//   code — every is*Active() helper, every name in js/app.js _BUSY_CHECKS,
//   every EXAM_SETS registration, every retry-drill key, every <div
//   class="screen"> in index.html, every start*/open* function that ends up
//   drawing an answer control — and each one must be owned by an ACTIVITIES
//   entry below or sit in an allowlist with a one-line reason. A new
//   isFooActive, a new exam set, a new drill key, a new screen or a new
//   startFooQuiz() turns this file red until someone registers a recipe.
//
//   PART 2 — the protocol, executed. For every ACTIVITIES entry the app is
//   booted for real (tests/verify/client.js), the recipe brings the activity
//   to a state with work on the table, and every exit route is tried with
//   confirm() answered "no" (exactly one prompt, refused, nothing moved) and
//   then "yes" (gone, clean). One booted app per entry, shared by its routes.
//
// What this file found on the day it was written (2026-09-11): the Verbs
// owed-drill (js/retrydrill.js key 'verbs') had no switchScreen branch — the
// bottom bar left it RUNNING under the next tab, isRetryDrillActive() stayed
// true and app updates were held back. Every other drill key had a branch.
// The registry entry `verbs-drill` is what keeps that from coming back.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { mountApp, loginTestUser, stubServer } = require('./verify/client.js');
const { El } = require('./domshim.js');

const ROOT = path.join(__dirname, '..');
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setImmediate(r)); };
const activeScreen = (h) => { const s = h.doc.querySelector('.screen.active'); return s ? s.id : null; };
const navShown = (h) => h.el('bottomNav').style.display !== 'none';

// PetBattleGame and the Night Raid renderer draw into a <canvas> that arrives
// through innerHTML, which the DOM shim builds without getContext (mountApp
// patches createElement only). Same additive stub as leave-guard-fight-arena.
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

// ---------------------------------------------------------------------------
// Driving helpers shared by the recipes. Each recipe is the start path the
// matching per-feature file uses (tests/leave-guard-*.test.js), trimmed to
// "get in, put one answer on the table".
// ---------------------------------------------------------------------------

function login(h, overrides) {
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
}

// Every onclick a screen renders, and "tap the first control matching re".
const onclicksOf = (h, screenId) => h.el(screenId).querySelectorAll('[onclick]').map((n) => n.getAttribute('onclick') || '');
function tap(h, screenId, re) {
  const code = onclicksOf(h, screenId).find((c) => re.test(c));
  assert.truthy(code, screenId + ' renders no control matching ' + re + ' — has: ' + Array.from(new Set(onclicksOf(h, screenId))).join(' | '));
  return h.doc.__runInline(code);
}

// --- the matching lesson (lessonScreen) ---
function dueSrs(h, n, topicId) {
  const vocab = h.peek('ieltsVocabulary');
  let pool = topicId ? vocab.filter((w) => /^[a-z]{3,8}$/i.test(w.en)) : vocab;
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
const matchCards = (h, col) => Array.from(h.el(col).querySelectorAll('.match-card'));
function matchOne(h) {
  const left = matchCards(h, 'leftColumn').find((c) => !c.classList.contains('matched'));
  assert.truthy(left, 'an unmatched pair remains');
  const right = matchCards(h, 'rightColumn').find((c) => c.dataset.word === left.dataset.word);
  left.onclick(); right.onclick();
  assert.truthy(left.classList.contains('matched'), 'the pair matched');
}
function lessonSnap(h) {
  const st = h.peek('lessonState');
  return JSON.stringify({ matched: st.matchedPairs, correct: st.correctInLesson, wrong: st.wrongInLesson,
    words: (st.roundWords || []).map((w) => w.en), board: h.el('leftColumn').innerHTML });
}
function openTopics(h) {
  h.sandbox.switchScreen('learnHubScreen');
  tap(h, 'learnHubScreen', /^switchScreen\('topicsScreen'\); renderTopicsHome\(\)$/);
  assert.equal(activeScreen(h), 'topicsScreen');
}

// --- Word Hunt (an overlay over Home) ---
function findHuntWord(h) {
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
    if (ok) { hs.selectedCells = cs; h.sandbox.checkHuntSelection(); return; }
  }
  throw new Error('"' + T + '" is not in the grid');
}

// --- Grade 4 units (gradeFourScreen) ---
async function openGrade4(h) {
  h.sandbox.switchScreen('learnHubScreen'); await settle();
  tap(h, 'learnHubScreen', /^switchScreen\('gradeFourScreen'\)/);
  await h.sandbox.LazyData.ensure('gradeFourScreen'); await settle();
  assert.equal(activeScreen(h), 'gradeFourScreen');
}

// --- the Word tab (wordScreen): the same engine as Grade 4, its own screen,
// its own bank (js/word-data.js, lazy) and its own owed-words queue ('word').
async function openWordTab(h) {
  assert.equal(h.sandbox.switchScreen('wordScreen'), true);               // the bottom-bar button
  await h.sandbox.LazyData.ensure('wordScreen'); await settle();
  assert.equal(activeScreen(h), 'wordScreen');
  assert.truthy(h.el('wordUnitsBar').innerHTML.includes("startUnitPractice('pr1-1')"), 'Book 1 · Unit 1 is on the bar');
}

// --- the shared retry drill (js/retrydrill.js) ---
function drillSnap(h, screenId) {
  const d = h.peek('_retryDrill');
  return JSON.stringify({ key: d.key, idx: d.idx, fixed: d.fixed, missed: d.missed, answered: !!d.answered,
    queue: d.queue.map((q) => h.sandbox.retryCfg(d.key).idOf(q)), screen: h.el(screenId).innerHTML });
}
// Type the current item back right, through the drill's own controls.
function drillAnswerRight(h) {
  const st = h.peek('_retryDrill');
  const item = st.queue[st.idx % st.queue.length];
  h.el('retryInput').value = h.sandbox.retryCfg(st.key).answerText(item);
  h.sandbox.submitRetryAnswer();
  assert.truthy(st.answered, 'the drill answer registered');
}

// --- Grammar (grammarScreen) ---
const gq = (h) => h.peek('_grammarQuizState');
function grammarAnswer(h, correct) {
  const st = gq(h);
  const q = st.questions[st.currentIdx];
  if (q.type === 'arrangement') {
    const order = q.parts.map((_, i) => i);
    if (!correct && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    order.forEach((i) => h.sandbox.placeArrangementTile(i));
    h.sandbox.submitArrangement();
  } else {
    h.sandbox.answerGrammarQuestion(correct ? q.correct : (q.correct + 1) % q.options.length);
  }
}
function grammarFinish(h, wrong) {
  while (gq(h)) { grammarAnswer(h, !wrong); h.sandbox.nextGrammarQuestion(); }
  assert.truthy(/grammar-result-card/.test(h.el('grammarScreen').innerHTML), 'the result card is up');
}

// --- the exam engine (js/exam.js: PTNK and the five practice menus) ---
function examAnswer(h) {
  const s = h.peek('_examState');
  const q = s.questions[s.idx];
  if (q.type === 'text') { h.el('examTextInput').value = q.answer; h.sandbox.submitExamText(); }
  else h.sandbox.answerExamChoice(q.correct);
  assert.truthy(s.answers[s.idx], 'the exam answer registered');
}
function examEntry(id, screen, set, startFn, afterOpen) {
  return {
    id, screen, busy: 'isExamActive',
    claims: { examSets: [set], starts: examEntry.STARTS[set] },
    start: async (h) => {
      login(h);
      assert.equal(h.sandbox.switchScreen(screen), true); await settle(8);
      if (afterOpen) afterOpen(h);
      h.sandbox.__confirmAnswer = true;                       // the paper's own "Start?"
      tap(h, screen, new RegExp('^' + startFn + '\\('));
      assert.equal(h.sandbox.examCurrentSet(), set, 'started in the ' + set + ' set');
      examAnswer(h);
      h.sandbox.nextExamQuestion();
      assert.equal(h.peek('_examState').idx, 1, 'on question 2');
    },
    snap: (h) => { const s = h.peek('_examState'); return JSON.stringify({ idx: s.idx, answers: s.answers, timer: s.timerId, screen: h.el(screen).innerHTML }); },
  };
}
examEntry.STARTS = {
  // startExam is the engine's own entry (js/exam.js): owned here once, by the
  // PTNK set, on behalf of every set that registers on the engine.
  ptnk: ['startPtnkExam', 'startExam'],
  reading: ['startReadingPractice', 'startReadingPassage'], cloze: ['startClozePractice', 'startClozePassage'],
  errors: ['startErrorsPractice', 'startErrorsRound'], grammarvocab: ['startGrammarVocabPractice', 'startGrammarVocabRound'],
  phonetics: ['startPhoneticsPractice', 'startPhoneticsRound'],
};

// --- Phrases / Collocation (phrasesScreen) ---
async function openPhrases(h) {
  login(h);
  assert.equal(h.sandbox.switchScreen('phrasesScreen'), true); await settle();
  assert.truthy(h.sandbox.LazyData.ready('phrasesScreen'), 'the Phrases banks arrived');
}
function hearThenNext(h, nextRe) {
  const gate = h.el('phrasesScreen').querySelector('.answer-gate-btn');
  if (gate) h.sandbox.hearAnswer(gate);
  tap(h, 'phrasesScreen', nextRe);
}
function collocAnswer(h, wrong) {
  const st = h.peek('_colQuiz');
  const q = st.questions[st.idx];
  if (q.followup) {
    tap(h, 'phrasesScreen', new RegExp("^answerCollocFollowup\\('m'," + q.m.correct + '\\)$'));
    tap(h, 'phrasesScreen', new RegExp("^answerCollocFollowup\\('r'," + q.r.correct + '\\)$'));
    return;
  }
  if (Array.isArray(q.options) && q.options.length) {
    tap(h, 'phrasesScreen', new RegExp('^answerCollocChoice\\(' + (wrong ? (q.correct + 1) % q.options.length : q.correct) + '\\)$'));
  } else {
    h.el('colTextInput').value = wrong ? 'zzz' : q.answer;
    tap(h, 'phrasesScreen', /^submitCollocText\(\)$/);
  }
}
function collocPlay(h, wrongEvery) {
  let n = 0, guard = 0;
  while (h.sandbox.isCollocActive() && guard++ < 400) {
    const st = h.peek('_colQuiz');
    const isBase = !st.questions[st.idx].followup;
    if (isBase) n++;
    collocAnswer(h, isBase && wrongEvery && n % wrongEvery === 0);
    hearThenNext(h, /^nextCollocQuestion\(\)$/);
  }
  assert.falsy(h.sandbox.isCollocActive(), 'the practice ended');
}
function phrasesAnswer(h, wrong) {
  const st = h.peek('_phrQuiz');
  const q = st.questions[st.idx];
  if (q.typed) { h.el('phrTextInput').value = wrong ? 'zzz' : q.answer; tap(h, 'phrasesScreen', /^submitPhrTextAnswer\(\)$/); }
  else tap(h, 'phrasesScreen', new RegExp('^answerPhrQuestion\\(' + (wrong ? (q.correct + 1) % q.options.length : q.correct) + '\\)$'));
}
function phrasesPlay(h, wrongEvery) {
  let n = 0, guard = 0;
  while (h.sandbox.isPhrasesQuizActive() && guard++ < 400) {
    const st = h.peek('_phrQuiz');
    const isBase = !st.questions[st.idx].meaning;
    if (isBase) n++;
    phrasesAnswer(h, isBase && wrongEvery && n % wrongEvery === 0);
    hearThenNext(h, /^nextPhrQuestion\(\)$/);
  }
  assert.falsy(h.sandbox.isPhrasesQuizActive(), 'the practice ended');
}
const quizSnap = (stateName, screenId) => (h) => {
  const s = h.peek(stateName);
  return JSON.stringify({ idx: s.idx, answers: s.answers, n: s.questions.length, screen: h.el(screenId).innerHTML });
};

// --- Word form / Rewrite ---
function wfAnswer(h, right) {
  const st = h.peek('_wfQuiz');
  const q = st.questions[st.idx];
  if (q.followup) {
    for (const part of h.sandbox.wfFollowParts(q)) {
      tap(h, 'wordformScreen', new RegExp("^answerWfFollowup\\('" + part + "'," + (right ? q[part].correct : (q[part].correct + 1) % q[part].options.length) + '\\)$'));
    }
    return;
  }
  if (q.type === 'text') { h.el('wfTextInput').value = right ? q.answer : 'zzz-not-a-word'; tap(h, 'wordformScreen', /^submitWfText\(\)$/); }
  else tap(h, 'wordformScreen', new RegExp('^answerWfQuestion\\(' + (right ? q.correct : (q.correct + 1) % q.options.length) + '\\)$'));
  assert.truthy(st.answers[st.idx], 'the answer registered');
}
function wfNext(h) {
  const gate = onclicksOf(h, 'wordformScreen').find((c) => /^hearAnswer\(this\)$/.test(c));
  if (gate) { const btn = h.el('wordformScreen').querySelectorAll('[onclick]').find((n) => n.getAttribute('onclick') === gate); btn.click(); }
  tap(h, 'wordformScreen', /^nextWfQuestion\(\)$/);
}
function wfPlayToEnd(h, wrongEvery) {
  let baseSeen = 0;
  const total = h.peek('_wfQuiz').questions.length;
  for (let guard = 0; guard < total + 2 && h.peek('_wfQuiz'); guard++) {
    const cur = h.peek('_wfQuiz');
    const q = cur.questions[cur.idx], a = cur.answers[cur.idx];
    const done = q.followup ? h.sandbox.wfFollowDone(q, a || {}) : a !== null;
    if (!done) {
      let right = true;
      if (!q.followup) { baseSeen++; right = !(wrongEvery && baseSeen % wrongEvery === 0); }
      wfAnswer(h, right);
    }
    wfNext(h);
  }
  assert.falsy(h.peek('_wfQuiz'), 'the round finished');
}
function rwAnswer(h, right) {
  const st = h.peek('_rwQuiz');
  h.el('rwTextInput').value = right ? st.questions[st.idx].answer : 'qqqq wrong sentence qqqq';
  tap(h, 'rewriteScreen', /^submitRwText\(\)$/);
  assert.truthy(st.answers[st.idx], 'the answer registered');
}
function rwPlayToEnd(h, wrongEvery) {
  let n = 0;
  for (let guard = 0; guard < 30 && h.peek('_rwQuiz'); guard++) {
    n++;
    rwAnswer(h, !(wrongEvery && n % wrongEvery === 0));
    tap(h, 'rewriteScreen', /^nextRwQuestion\(\)$/);
  }
  assert.falsy(h.peek('_rwQuiz'), 'the round finished');
}

// --- the Math tab (a lazy code group) ---
async function openMath(h, overrides) {
  login(h, overrides);
  assert.truthy(h.sandbox.switchScreen('mathHubScreen'), 'the Math tab opens');
  await h.sandbox.LazyData.ensure('mathHubScreen'); await settle();
  assert.equal(typeof h.sandbox.renderMathHome, 'function', 'the math group landed');
}
function mathAnswer(h, right) {
  const S = h.sandbox;
  const st = h.peek('_mathQuiz');
  const q = st.questions[st.idx];
  if (S.mathIsWritten(q)) { S.revealMathWritten(); S.gradeMathWritten(!!right); }
  else if (S.mathHasAnswerParts(q)) {
    for (let p = 0; p < q.answerParts.length; p++) {
      const want = right ? String(q.answerParts[p].answer || q.answerParts[p]) : '7';
      for (const ch of (right && /^[0-9]+$/.test(want) ? want : '7')) S.mathKey(ch);
      S.submitMathTyped();
    }
  } else if (S.mathIsTyped(q)) { S.mathKey('7'); S.submitMathTyped(); }
  else S.answerMathQuestion(right ? q.correct : (q.correct + 1) % q.options.length);
  assert.truthy(st.answers[st.idx] !== null, 'the answer landed');
}
const mathSnap = (stateName) => (h) => {
  const s = h.peek(stateName);
  return JSON.stringify({ idx: s.idx, answers: s.answers, timer: s.timer || null, endsAt: s.endsAt || null, screen: h.el('mathHubScreen').innerHTML });
};

// ---------------------------------------------------------------------------
// THE REGISTRY. One entry per exercise/game:
//   id       a name for the failure message
//   screen   the screen the activity lives on (its own tab is not a way out)
//   busy     the is*Active global (a string — must be in _BUSY_CHECKS) or a
//            () => bool over the booted app for the object-style games
//   claims   what else this entry owns from the scraped inventory: extra
//            helper names, drill keys, exam sets, start*/open* functions
//   start    async (h): log in, reach the activity the way a child does and
//            put one answer/move on the table
//   snap     (h) => string: what "exactly where they were" means
//   answersOne  false only where the child has no move to make (documented)
//   deepLink    the Daily Task kind that lands ELSEWHERE (default 'wordform')
// ---------------------------------------------------------------------------
const ACTIVITIES = [
  // --- the matching lesson, in its Home / SRS / Topics flavours (js/lessons.js) ---
  { id: 'vocabulary lesson', screen: 'lessonScreen', busy: 'isLessonActive',
    claims: { starts: ['startLesson', 'startNextLesson', 'startReviewLesson', 'startDailyChallenge'] },
    start: async (h) => {
      login(h);
      assert.truthy(h.el('streakPanel').innerHTML.includes('onclick="goLearnToday()"'), 'Home renders the "Học ngay hôm nay" CTA');
      h.sandbox.goLearnToday();
      matchOne(h);
    },
    snap: lessonSnap },
  { id: 'SRS review', screen: 'lessonScreen', busy: 'isLessonActive',
    claims: { starts: ['startReviewSession'] },
    start: async (h) => {
      login(h, { srs: dueSrs(h, 6) });
      h.sandbox.switchScreen('learnHubScreen');
      tap(h, 'learnHubScreen', /^startReviewSession\(\)$/);
      assert.truthy(h.peek('lessonState').isReviewSession, 'an SRS review is running');
      matchOne(h);
    },
    snap: lessonSnap },
  { id: 'topic lesson', screen: 'lessonScreen', busy: 'isLessonActive',
    claims: { starts: ['startTopicLessonChunk', 'startTopicLesson', 'startReviewLessonChunk', 'startTopicLessonReplayDue', 'startTopicPractice'] },
    start: async (h) => {
      login(h);
      openTopics(h);
      const card = h.el('topicsGrid').querySelectorAll('.topic-card').find((c) => !c.hasAttribute('disabled'));
      h.doc.__runInline(card.getAttribute('onclick'));                        // openTopicDetail('<id>')
      tap(h, 'topicsDetail', /^startTopicLessonChunk\('[a-z]+', \d+\)$/);
      assert.truthy(h.peek('lessonState').isTopicLesson, 'a topic lesson is running');
      matchOne(h);
    },
    snap: lessonSnap },
  { id: 'topic review', screen: 'lessonScreen', busy: 'isLessonActive',
    claims: { starts: ['startTopicReviewSession'] },
    start: async (h) => {
      login(h);
      h.state().srs = dueSrs(h, 8, 'daily');
      h.sandbox.saveUserData(h.peek('currentUser'), h.state());
      openTopics(h); h.sandbox.openTopicDetail('daily');
      tap(h, 'topicsDetail', /^startTopicReviewSession\('daily', 'due'\)$/);
      assert.truthy(h.peek('lessonState').isReviewSession && h.peek('lessonState').topicReviewMeta, 'a topic review is running');
      matchOne(h);
    },
    snap: lessonSnap },

  // --- Word Hunt: a 60-second overlay over Home (js/word-hunt.js) ---
  { id: 'word hunt', screen: 'homeScreen', busy: 'isWordHuntActive',
    claims: { starts: ['openWordHunt', 'startHuntTimer'] },
    start: async (h) => {
      login(h, { lessonsCompleted: 5, points: 500 });
      h.state().srs = dueSrs(h, 12);
      h.sandbox.switchScreen('homeScreen');
      h.sandbox.openWordHunt();
      assert.truthy(h.el('wordHuntOverlay').classList.contains('active') && h.peek('huntState').timer, 'a hunt is running with a clock');
      findHuntWord(h);
    },
    snap: (h) => { const s = h.peek('huntState'); return JSON.stringify({ grid: s.grid, found: s.foundWords, timer: s.timer, finished: s.finished }); } },

  // --- Grade 4 units and their owed-words drill (js/units.js) ---
  { id: 'grade-4 units', screen: 'gradeFourScreen', busy: 'isUnitPracticeActive',
    claims: { starts: ['startUnitPractice'] },
    start: async (h) => {
      login(h);
      await openGrade4(h);
      const card = h.el('unitsBar').querySelectorAll('.g4-card').find((c) => !c.classList.contains('g4-mix-card') && !c.disabled);
      h.doc.__runInline(card.getAttribute('onclick'));                        // startUnitPractice(...)
      const st = h.peek('_unitQuiz');
      h.el('unitTextInput').value = st.questions[st.idx].w.en;
      h.sandbox.submitUnitAnswer();
      tap(h, 'grade4Detail', /^nextUnitQuestion\(/);
      assert.equal(h.peek('_unitQuiz').idx, 1, 'question 2 is open');
    },
    snap: (h) => { const s = h.peek('_unitQuiz'); return JSON.stringify({ idx: s.idx, answers: s.answers, screen: h.el('grade4Detail').innerHTML }); } },
  { id: 'units drill', screen: 'gradeFourScreen', busy: (h) => h.sandbox.retryDrillKey() === 'units',
    // startRetryDrill is the shared engine's entry (js/retrydrill.js): owned
    // here once, on behalf of every drill key below.
    claims: { fns: ['isRetryDrillActive'], drills: ['units'], starts: ['startUnitRetry', 'startRetryDrill'] },
    start: async (h) => {
      const bank = h.peek('UNIT_WORDS');
      login(h, { unitsRetry: ['pre|' + bank[0].en, 'pre|' + bank[1].en] });
      await openGrade4(h);
      tap(h, 'unitsBar', /^startRetryDrill\('units'\)$/);
      assert.truthy(h.el('retryInput'), 'the first owed word is on screen');
      const st = h.peek('_retryDrill');
      h.el('retryInput').value = st.queue[0].en;
      h.sandbox.submitRetryAnswer();
      tap(h, 'grade4Detail', /^nextRetryQuestion\(\)$/);
      assert.truthy(h.sandbox.isRetryDrillActive(), 'one word fixed, one still owed');
    },
    snap: (h) => drillSnap(h, 'gradeFourScreen') },

  // --- the Word tab and its owed-words drill: js/units.js again, on wordScreen (UNIT_HOSTS.word) ---
  { id: 'word practice', screen: 'wordScreen', busy: 'isUnitPracticeActive',
    // startUnitPractice is shared with Grade 4 above; the key's set picks the host.
    claims: { starts: ['startUnitPractice'] },
    start: async (h) => {
      login(h);
      await openWordTab(h);
      tap(h, 'wordUnitsBar', /^startUnitPractice\('pr1-1'\)$/);           // Book 1 · Unit 1
      const st = h.peek('_unitQuiz');
      assert.equal(st.unit, 'pr1-1', 'the Word practice is running');
      assert.equal(h.sandbox.unitPracticeScreen(), 'wordScreen', 'and it belongs to the Word screen');
      assert.truthy(h.el('wordDetail').innerHTML.includes('unitTextInput'), 'its answer box is on the Word screen');
      h.el('unitTextInput').value = st.questions[st.idx].w.en;
      h.sandbox.submitUnitAnswer();
      tap(h, 'wordDetail', /^nextUnitQuestion\(/);
      assert.equal(h.peek('_unitQuiz').idx, 1, 'question 2 is open');
    },
    snap: (h) => { const s = h.peek('_unitQuiz'); return JSON.stringify({ idx: s.idx, answers: s.answers, screen: h.el('wordDetail').innerHTML }); } },
  { id: 'word drill', screen: 'wordScreen', busy: (h) => h.sandbox.retryDrillKey() === 'word',
    claims: { drills: ['word'] },
    start: async (h) => {
      login(h);
      await openWordTab(h);                                                // the bank is lazy: ids need its words
      const bank = h.peek('UNIT_WORDS_PR1');
      h.state().wordRetry = ['pr1|' + bank[0].en, 'pr1|' + bank[1].en];
      h.sandbox.saveUserData(h.peek('currentUser'), h.state());
      h.sandbox.renderWordHome();
      assert.equal(h.sandbox.retryCount('word'), 2, 'two words are owed on the Word tab');
      assert.equal(h.sandbox.retryCount('units'), 0, 'and none on Grade 4');
      tap(h, 'wordUnitsBar', /^startRetryDrill\('word'\)$/);
      assert.truthy(h.el('retryInput'), 'the first owed word is on screen');
      const st = h.peek('_retryDrill');
      h.el('retryInput').value = st.queue[0].en;
      h.sandbox.submitRetryAnswer();
      tap(h, 'wordDetail', /^nextRetryQuestion\(\)$/);
      assert.truthy(h.sandbox.isRetryDrillActive(), 'one word fixed, one still owed');
    },
    snap: (h) => drillSnap(h, 'wordScreen') },

  // --- Irregular Verbs speed run and its owed-verbs drill (js/verbs.js) ---
  { id: 'verbs speed run', screen: 'speedChallengeScreen', busy: 'isSpeedGameActive',
    claims: { starts: ['startSpeedChallenge'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('learnHubScreen'); await settle();
      tap(h, 'learnHubScreen', /^switchScreen\('speedChallengeScreen'\)$/); await settle();
      tap(h, 'speedChallengeScreen', /^startSpeedChallenge\(/);
      const s = h.peek('speedState');
      const v = s.currentVerbs[s.currentIndex];
      h.el('inputV2').value = v.v2.split('/')[0].trim();
      h.el('inputV3').value = v.v3.split('/')[0].trim();
      h.el('speedSubmitBtn').click();
      tap(h, 'speedFeedback', /^nextSpeedQuestion\(/);
      assert.equal(s.currentIndex, 1, 'on verb 2');
    },
    snap: (h) => { const s = h.peek('speedState'); return JSON.stringify({ idx: s.currentIndex, score: s.score, timer: s.timer, answering: s.isAnswering, v1: h.el('verbV1').textContent }); } },
  { id: 'verbs drill', screen: 'speedChallengeScreen', busy: (h) => h.sandbox.retryDrillKey() === 'verbs',
    claims: { drills: ['verbs'] },
    start: async (h) => {
      const verbs = h.peek('irregularVerbs');
      login(h, { verbsRetry: [verbs[0].v1, verbs[1].v1] });
      h.sandbox.switchScreen('learnHubScreen'); await settle();
      tap(h, 'learnHubScreen', /^switchScreen\('speedChallengeScreen'\)$/); await settle();
      tap(h, 'speedChallengeScreen', /^startSpeedChallenge\(/);      // the gate opens the drill instead
      assert.truthy(h.el('retryInput') && h.el('retryInputV3'), 'the V2/V3 boxes of the owed drill are on screen');
      const st = h.peek('_retryDrill');
      const item = st.queue[0];
      h.el('retryInput').value = item.v2.split('/')[0].trim();
      h.el('retryInputV3').value = item.v3.split('/')[0].trim();
      h.sandbox.submitRetryAnswer();
      assert.equal(st.fixed, 1, 'one verb typed back right');
      h.sandbox.nextRetryQuestion();
      assert.truthy(h.sandbox.isRetryDrillActive(), 'one verb still owed');
    },
    snap: (h) => drillSnap(h, 'speedChallengeScreen') },

  // --- Grammar (js/grammar-ui.js) ---
  { id: 'grammar quiz', screen: 'grammarScreen', busy: 'isGrammarQuizActive',
    claims: { starts: ['startGrammarQuiz', 'startCustomQuiz'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('grammarScreen'); await settle();
      h.sandbox.switchGrammarSubTab('units');
      const unit = h.peek('GRAMMAR_UNITS')[0];
      tap(h, 'grammarScreen', new RegExp("^toggleGrammarUnitExpanded\\('" + unit.id + "'\\)$"));
      tap(h, 'grammarScreen', new RegExp("^startGrammarQuiz\\('" + unit.id + "', 10\\)$"));
      grammarAnswer(h, true);
    },
    snap: (h) => { const s = gq(h); return JSON.stringify({ idx: s.currentIdx, answers: s.answers, screen: h.el('grammarScreen').innerHTML }); } },
  { id: 'grammar mistakes', screen: 'grammarScreen', busy: 'isGrammarQuizActive',
    claims: { starts: ['startMistakesQuiz'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('grammarScreen'); await settle();
      h.sandbox.startGrammarQuiz(h.peek('GRAMMAR_UNITS')[0].id, 25);     // a bank of mistakes to draw on
      grammarFinish(h, true);
      h.sandbox.renderGrammarHome();
      h.sandbox.switchGrammarSubTab('units');
      tap(h, 'grammarScreen', /^startMistakesQuiz\(10\)$/);
      grammarAnswer(h, true);
    },
    snap: (h) => { const s = gq(h); return JSON.stringify({ idx: s.currentIdx, answers: s.answers, screen: h.el('grammarScreen').innerHTML }); } },

  // --- the exam engine: PTNK and the five practice menus (js/exam.js) ---
  examEntry('ptnk', 'ptnkScreen', 'ptnk', 'startPtnkExam'),
  examEntry('reading', 'readingScreen', 'reading', 'startReadingPractice'),
  examEntry('cloze', 'clozeScreen', 'cloze', 'startClozePractice'),
  examEntry('errors', 'errorsScreen', 'errors', 'startErrorsPractice'),
  examEntry('grammar-vocab', 'grammarVocabScreen', 'grammarvocab', 'startGrammarVocabPractice'),
  examEntry('phonetics', 'phoneticsScreen', 'phonetics', 'startPhoneticsPractice', (h) => h.sandbox.switchPhoneticsSubTab('practice')),

  // --- Phrases and Collocation, and the owed drill they share (js/phrases.js, js/collocation.js) ---
  { id: 'phrases quiz', screen: 'phrasesScreen', busy: 'isPhrasesQuizActive',
    claims: { starts: ['startPhrasesQuiz', 'startPhrasesReviewQuiz'] },
    start: async (h) => {
      await openPhrases(h);
      tap(h, 'phrasesScreen', /^switchPhrSubTab\('practice'\)$/);
      tap(h, 'phrasesScreen', /^startPhrasesQuiz\(10\)$/);
      phrasesAnswer(h, false);
    },
    snap: quizSnap('_phrQuiz', 'phrasesScreen') },
  { id: 'collocation practice', screen: 'phrasesScreen', busy: 'isCollocActive',
    claims: { starts: ['startCollocPractice'] },
    start: async (h) => {
      await openPhrases(h);
      tap(h, 'phrasesScreen', /^switchPhrSubTab\('colloc'\)$/);
      tap(h, 'phrasesScreen', /^startCollocPractice\(10\)$/);
      collocAnswer(h, false);
    },
    snap: quizSnap('_colQuiz', 'phrasesScreen') },
  { id: 'collocation drill', screen: 'phrasesScreen', busy: (h) => h.sandbox.retryDrillKey() === 'col',
    claims: { drills: ['col'] },
    start: async (h) => {
      await openPhrases(h);
      tap(h, 'phrasesScreen', /^switchPhrSubTab\('colloc'\)$/);
      tap(h, 'phrasesScreen', /^startCollocPractice\(10\)$/);
      collocPlay(h, 2);
      assert.truthy(h.sandbox.retryCount('col') > 0, 'mistakes are owed');
      tap(h, 'phrasesScreen', /^startCollocPractice\(10\)$/);             // "Practice again" → the gate opens the drill
      assert.truthy(h.sandbox.retryDrillKey() === 'col', 'the owed drill opened instead');
      drillAnswerRight(h);
    },
    snap: (h) => drillSnap(h, 'phrasesScreen') },
  { id: 'phrases drill', screen: 'phrasesScreen', busy: (h) => h.sandbox.retryDrillKey() === 'phr',
    claims: { drills: ['phr'] },
    start: async (h) => {
      await openPhrases(h);
      tap(h, 'phrasesScreen', /^switchPhrSubTab\('practice'\)$/);
      tap(h, 'phrasesScreen', /^startPhrasesQuiz\(10\)$/);
      phrasesPlay(h, 2);
      assert.truthy(h.sandbox.retryCount('phr') > 0, 'mistakes are owed');
      tap(h, 'phrasesScreen', /renderPhrasesHome\(\)$/);                    // Done, off the result screen
      tap(h, 'phrasesScreen', /^switchPhrSubTab\('practice'\)$/);
      tap(h, 'phrasesScreen', /^startPhrasesQuiz\(10\)$/);                // the gate opens the drill
      assert.truthy(h.sandbox.retryDrillKey() === 'phr', 'the owed drill opened instead');
      drillAnswerRight(h);
    },
    snap: (h) => drillSnap(h, 'phrasesScreen') },

  // --- Word form and Rewrite, each with its owed drill (js/wordform.js, js/rewrite.js) ---
  { id: 'word form quiz', screen: 'wordformScreen', busy: 'isWordformQuizActive', deepLink: 'rewrite',
    claims: { starts: ['startWordformQuiz', 'startWordformReviewQuiz'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('wordformScreen'); await settle();
      tap(h, 'wordformScreen', /^startWordformQuiz\(10\)$/);
      wfAnswer(h, true);
    },
    snap: quizSnap('_wfQuiz', 'wordformScreen') },
  { id: 'word form drill', screen: 'wordformScreen', busy: (h) => h.sandbox.retryDrillKey() === 'wf', deepLink: 'rewrite',
    claims: { drills: ['wf'], starts: ['startWfRetry'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('wordformScreen'); await settle();
      h.sandbox.startWordformQuiz(10);
      wfPlayToEnd(h, 2);
      assert.truthy(h.sandbox.retryCount('wf') > 0, 'questions are owed');
      tap(h, 'wordformScreen', /^startRetryDrill\('wf'\)$/);
      const st = h.peek('_retryDrill');
      h.el('retryInput').value = st.queue[0].answer;
      tap(h, 'wordformScreen', /^submitRetryAnswer\(\)$/);
      tap(h, 'wordformScreen', /^nextRetryQuestion\(\)$/);
      assert.truthy(h.sandbox.retryDrillKey() === 'wf', 'still owed after one');
    },
    snap: (h) => drillSnap(h, 'wordformScreen') },
  { id: 'rewrite quiz', screen: 'rewriteScreen', busy: 'isRewriteQuizActive',
    claims: { starts: ['startRewriteQuiz', 'startRewriteReviewQuiz'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('rewriteScreen'); await settle();
      tap(h, 'rewriteScreen', /^startRewriteQuiz\(10\)$/);
      rwAnswer(h, true);
    },
    snap: quizSnap('_rwQuiz', 'rewriteScreen') },
  { id: 'rewrite drill', screen: 'rewriteScreen', busy: (h) => h.sandbox.retryDrillKey() === 'rw',
    claims: { drills: ['rw'] },
    start: async (h) => {
      login(h);
      h.sandbox.switchScreen('rewriteScreen'); await settle();
      h.sandbox.startRewriteQuiz(10);
      rwPlayToEnd(h, 2);
      assert.truthy(h.sandbox.retryCount('rw') > 0, 'questions are owed');
      tap(h, 'rewriteScreen', /^startRewriteReviewQuiz\(/);               // "Re-practice these": the gate opens the drill
      assert.truthy(h.sandbox.retryDrillKey() === 'rw', 'the owed drill opened instead');
      const st = h.peek('_retryDrill');
      h.el('retryInput').value = st.queue[0].answer;
      tap(h, 'rewriteScreen', /^submitRetryAnswer\(\)$/);
      tap(h, 'rewriteScreen', /^nextRetryQuestion\(\)$/);
      assert.truthy(h.sandbox.retryDrillKey() === 'rw', 'still owed after one');
    },
    snap: (h) => drillSnap(h, 'rewriteScreen') },

  // --- Toán 7 (js/math.js) ---
  { id: 'Toán 7 chapter quiz', screen: 'mathHubScreen', busy: 'isMathQuizActive',
    claims: { starts: ['startMathQuiz', 'startMathLtQuiz', 'startMathQuizForLesson', 'startMathWrongPractice'] },
    start: async (h) => {
      await openMath(h);
      h.sandbox.openMathSection('hk1');
      tap(h, 'mathHubScreen', /^startMathQuiz\(1\)$/);
      mathAnswer(h, true); h.sandbox.nextMathQuestion();
      assert.equal(h.peek('_mathQuiz').idx, 1, 'on question 2');
    },
    snap: mathSnap('_mathQuiz') },
  { id: 'Toán 7 đề thi', screen: 'mathHubScreen', busy: 'isMathQuizActive',
    claims: { starts: ['startMathExam'] },
    start: async (h) => {
      await openMath(h);
      h.sandbox.openMathSection('hk1'); h.sandbox.switchMathSubTab('exams');
      tap(h, 'mathHubScreen', /^startMathExam\('hk1-/);
      assert.falsy(navShown(h), 'a đề thi hides the bar');
      mathAnswer(h, true); h.sandbox.nextMathQuestion();
    },
    snap: mathSnap('_mathQuiz') },
  { id: 'Toán 7 retry drill', screen: 'mathHubScreen', busy: (h) => h.sandbox.retryDrillKey() === 'math',
    claims: { drills: ['math'], starts: ['startMathRetry'] },
    start: async (h) => {
      await openMath(h);
      h.state().mathRetry = h.peek('MATH_QUESTIONS').filter((q) => q.options && q.correct !== undefined && q.id).slice(0, 3).map((q) => String(q.id));
      h.sandbox.openMathSection('toan7');
      tap(h, 'mathHubScreen', /^startRetryDrill\('math'\)$/);
      const pick = onclicksOf(h, 'mathHubScreen').find((c) => /^mathRetryPick\(/.test(c));
      h.doc.__runInline(pick.replace(/\d+/, (n) => String((Number(n) + 1) % 4)));   // miss one: the queue moves
      h.sandbox.nextRetryQuestion();
      assert.truthy(h.sandbox.retryDrillKey() === 'math', 'the drill goes on');
    },
    snap: (h) => drillSnap(h, 'mathHubScreen') },

  // --- Toán 4, bảng cửu chương, Math Wars (js/math.js, js/math-tables.js, js/mathwars.js) ---
  { id: 'Toán 4', screen: 'mathHubScreen', busy: 'isMathQuizActive',
    claims: { starts: ['startMath4Pre', 'startMath4Mix'] },
    start: async (h) => {
      await openMath(h);
      tap(h, 'mathHubScreen', /^openMathSection\('toan4'\)$/);
      tap(h, 'mathHubScreen', /^startMath4Pre\(\)$/);
      const st = h.peek('_mathQuiz');
      tap(h, 'mathHubScreen', new RegExp('^answerMathQuestion\\(' + st.questions[st.idx].correct + '\\)$'));
    },
    snap: mathSnap('_mathQuiz') },
  { id: 'bảng cửu chương', screen: 'mathHubScreen', busy: 'isMathTablesActive',
    claims: { starts: ['startMathTables'] },
    start: async (h) => {
      await openMath(h);
      tap(h, 'mathHubScreen', /^openMathSection\('toan4'\)$/);
      tap(h, 'mathHubScreen', /^openMathSection\('cuuchuong'\)$/);
      tap(h, 'mathHubScreen', /^startMathTables\('x','2345'\)$/);
      const st = h.peek('_tablesQuiz');
      tap(h, 'mathHubScreen', new RegExp('^answerMathTables\\(' + st.questions[st.idx].correct + '\\)$'));
    },
    snap: mathSnap('_tablesQuiz') },
  { id: 'Math Wars', screen: 'mathHubScreen', busy: 'isWarsActive',
    claims: { starts: ['startWarsRound'] },
    start: async (h) => {
      await openMath(h);
      tap(h, 'mathHubScreen', /^openMathSection\('wars'\)$/);
      tap(h, 'mathHubScreen', /^startWarsRound\(\)$/);
      const st = h.peek('_warsQuiz');
      tap(h, 'mathHubScreen', new RegExp('^answerWars\\(' + st.questions[st.idx].correct + '\\)$'));
    },
    snap: mathSnap('_warsQuiz') },

  // --- Đấu Toán (js/math-fight.js): a bout against another child, with a stake ---
  { id: 'Math Fight', screen: 'mathHubScreen', busy: (h) => h.sandbox.MathFight.isFighting(),
    claims: {},
    start: async (h) => {
      await openMath(h, { coins: 500, allowMathFight: true });
      const state = { fight: { fightId: 7, status: 'invited', role: 'opponent', foeId: 22, prize: 200, seed: 12345, level: 1, expiresAt: Date.now() + 60000 } };
      stubServer(h, (p, o) => {
        if (p === 'math-fight') return { ok: true, data: { friends: [{ userId: 22, username: 'Oleole', readyAt: 0, friendReadyAt: 0, busy: false }], prize: 200, heartbeatMs: 5000, fight: state.fight } };
        if (p === 'math-fight/respond') { state.fight = Object.assign({}, state.fight, { status: 'active', deadlineAt: Date.now() + 300000, myCorrect: 0, foeCorrect: 0 }); return { ok: true, data: { fight: state.fight } }; }
        if (p === 'math-fight/progress') return { ok: true, data: { fight: state.fight } };
        if (p === 'math-fight/submit') { state.fight = Object.assign({}, state.fight, { status: 'done', winnerId: 22, outcome: o.body.forfeit ? 'forfeit' : 'score' }); return { ok: true, data: { fight: state.fight, coins: -200 } }; }
        return undefined;
      });
      tap(h, 'mathHubScreen', /^openMathSection\('fight'\)$/); await settle(10);
      assert.truthy(h.el('mfRoot').innerHTML.includes('mfRespond(true)'), 'the invite card offers "Nhận lời — đấu!"');
      h.sandbox.mfRespond(true); await settle(10);
      const MF = h.sandbox.MathFight;
      assert.truthy(MF.isFighting(), 'the bout is live');
      const st = MF.__st();
      const q = st.qs[st.idx];
      const buttons = h.el('mfRoot').querySelectorAll('.mf-option');
      h.doc.__runInline(buttons[q.options.findIndex((o) => o === q.answer)].getAttribute('onclick'));
      await settle();
      assert.equal(MF.__st().idx, 1, 'one answered');
    },
    snap: (h) => { const s = h.sandbox.MathFight.__st(); return JSON.stringify({ idx: s.idx, answers: s.answers, view: s.view, ticker: s.ticker, pulse: s.pulse, root: h.el('mfRoot').innerHTML }); } },

  // --- the Arena (js/petbattle.js, js/night-raid.js, js/ghost-offering-event.js) ---
  { id: 'pet battle', screen: 'petBattleScreen', busy: 'isPetBattleActive',
    // The other child fires the next volley; there is no answer of ours to
    // put on the table, and the guard asks from the first second.
    answersOne: false,
    claims: { starts: ['openPetBattle', 'startPetBattleGame'] },
    start: async (h) => {
      login(h, { coins: 500, dogLevel: 3 });
      const battle = {
        id: 9, status: 'active', seed: 4242, fieldVersion: 2, backgroundId: 'meadow', iAmChallenger: true,
        me: { id: 1, name: 'BeNa', ammo: 5, level: 3, stage: 'corgi', hp: 100, hires: [], castleSkin: 'stone' },
        foe: { id: 22, name: 'Oleole', ammo: 5, level: 3, stage: 'beagle', hp: 100, hires: [], castleSkin: 'stone' },
        turnNo: 1, myTurn: true, turnStartedAt: Date.now(), expiresAt: 0, winnerId: null, draw: false, finishedAt: null,
      };
      stubServer(h, (p) => {
        if (p === 'battle' || p === 'battle?light=1') return { ok: true, data: { ammo: 5, readyAt: 0, stats: { wins: 1, losses: 0 }, battle } };
        if (p.startsWith('battle/state')) return { ok: true, data: { battle, turns: [] } };
        if (p === 'battle/turn') return { ok: true, data: { battle } };
        return undefined;
      });
      h.run("_friendsData = { friends: [{userId:22,username:'Oleole'}], incoming: [], outgoing: [] }");
      await h.sandbox.openPetBattle(); await settle(12);
      h.__game = h.peek('_pbGame');
      assert.truthy(h.__game && !h.__game.finished && h.el('petBattleScreen').querySelector('.pb-game'), 'the battle is running on screen');
    },
    snap: (h) => JSON.stringify({ same: h.peek('_pbGame') === h.__game, destroyed: !!h.__game._destroyed, onScreen: !!h.el('petBattleScreen').querySelector('.pb-game') }) },
  { id: 'night raid', screen: 'nightRaidScreen', busy: (h) => h.peek('NightRaid').isRaiding(),
    // The army marches by itself once the server has written the raid row;
    // the child has nothing further to tap, and the house is already spent.
    answersOne: false,
    claims: {},
    start: async (h) => {
      login(h, { coins: 2000, dogLevel: 4 });
      const anim = { clock: 0, rafs: [] };
      h.sandbox.performance.now = () => anim.clock;
      h.sandbox.requestAnimationFrame = (fn) => { anim.rafs.push(fn); return anim.rafs.length; };
      h.sandbox.Phaser = {};                                   // present but empty: the canvas renderer takes over
      stubServer(h, (p, o) => {
        if (p === 'night-raid/home') return { ok: true, data: { home: { coins: h.state().coins, dogLevel: 4, layout: null } } };
        if (p === 'night-raid/friends') return { ok: true, data: { me: { lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 3, friends: [{ userId: 22, targetId: 22, name: 'Oleole', homeLevel: 2, difficulty: 'Dễ' }] } };
        if (p === 'night-raid/start') return { ok: true, data: { raid: Object.assign({}, o.body, { raidId: 'r1', expiresAt: Date.now() + 600000, title: { vi: 'Oleole', en: 'Oleole' }, defense: 5, layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 1, castleHp: 200 }) } };
        if (p === 'night-raid/finish') return { ok: true, data: { result: { won: true, reward: 120, stars: 2, damage: 50, defense: 5, castleHp: 0, margin: 45, loot: 100, victoryBonus: 20, soldiers: 0 } } };
        if (p === 'night-raid/reports') return { ok: true, data: { reports: [], attacks: [] } };
        return undefined;
      });
      await h.sandbox.openNightRaid(); await settle(12);
      const NR = h.peek('NightRaid');
      await NR.showLiveTargets(); await settle(8);
      assert.truthy(h.el('nightRaidScreen').innerHTML.includes('nrAttackLive(0)'), "Oleole's house is on the list");
      h.sandbox.nrAttackLive(0); await settle(30);
      assert.truthy(NR.isRaiding(), 'the raid is on');
    },
    snap: (h) => JSON.stringify({ raiding: h.peek('NightRaid').isRaiding(), screen: h.el('nightRaidScreen').innerHTML }) },
  { id: 'ghost offering', screen: 'petBattleScreen', busy: (h) => h.sandbox.GhostOfferingEvent.isPlaying(),
    // The rope is a server-timed pull; while the mâm is open the scene is
    // "in play" the moment it is up.
    answersOne: false,
    claims: {},
    start: async (h) => {
      login(h, { coins: 500, dogLevel: 3 });
      const room = { open: true, ended: false, sessionId: 's1', roomId: '2026-09-10', eventDate: '2026-09-10',
        opensAt: Date.now() - 1000, closesAt: Date.now() + 3600000, nextOpensAt: Date.now() - 1000, claimedIds: [] };
      stubServer(h, (p) => {
        if (p === 'battle' || p === 'battle?light=1') return { ok: true, data: { ammo: 5, readyAt: 0, stats: { wins: 1, losses: 0 }, battle: null } };
        if (p === 'ghost-offering') return { ok: true, data: room };
        return undefined;
      });
      h.run("_friendsData = { friends: [{userId:22,username:'Oleole'}], incoming: [], outgoing: [] }");
      await h.sandbox.openPetBattle(); await settle(12);
      assert.truthy(h.el('petBattleScreen').innerHTML.includes('GhostOfferingEvent.open()'), 'the lobby card offers CƯỚP CÔ HỒN');
      h.sandbox.GhostOfferingEvent.open(); await settle(12);
      assert.truthy(h.sandbox.GhostOfferingEvent.isPlaying(), 'the room is open for grabbing');
    },
    snap: (h) => { const el = h.el('petBattleScreen'); return JSON.stringify({ active: h.sandbox.GhostOfferingEvent.isActive(), locked: el.classList.contains('go-event-active'), cast: !!el.querySelector('.go-cast-btn'), screen: el.innerHTML }); } },
];

// Names in js/app.js _BUSY_CHECKS that are not an exercise's own is*Active.
const BUSY_CHECKS_NOT_EXERCISES = {
  isLessonOnScreen: 'the result card up over a FINISHED lesson: an update must still wait for it, but nothing is at stake, so every exit is silent (leave-guard-vocab (B))',
};

// Screens in index.html on which no exercise runs.
const SCREENS_WITHOUT_EXERCISE = {
  onboardingScreen: 'profile picker — nothing to lose',
  dailyTaskScreen: 'the Daily Task list; its "Vào học" buttons deep-link INTO an exercise elsewhere (the DailyTask.go route below)',
  profileScreen: 'settings and history — reading',
  learnHubScreen: 'the Eng hub — cards only',
  topicsScreen: 'the Topics hub and its detail pages; every round it starts runs on lessonScreen (topic lesson / topic review above)',
};

// start*/open* functions that end up drawing an answer control but are not
// an exercise. Each reason names what the function is; where the reason is
// checkable ("unreachable"), `still` proves it on every run.
const START_NOT_EXERCISES = {
  openBattleSetup: { why: 'js/battle.js two-player battle: unreachable — index.html has no #battleCard and renderBattleCard() has no caller',
    still: () => !/id="battleCard"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')) && !/[^\w]renderBattleCard\(\)/.test(fs.readFileSync(path.join(ROOT, 'js', 'battle.js'), 'utf8').replace(/function renderBattleCard\(\)/, '')) },
  startBattle: { why: 'js/battle.js — see openBattleSetup' },
  startPlayerRound: { why: 'js/battle.js — see openBattleSetup' },
  openGrammarLesson: { why: 'a lesson page (reading), leave-guard-grammar "the lesson view"' },
  openPhoneticsLesson: { why: 'a lesson page (reading), leave-guard-exam-engine "Lessons sub-tab"' },
  openMathLesson: { why: 'a lesson page (reading), leave-guard-math7 "the lesson page is reading"' },
  openWordformLesson: { why: 'a lesson page (reading), leave-guard-wordform-rewrite "what is NOT a round"' },
  openRewriteLesson: { why: 'a lesson page (reading), leave-guard-wordform-rewrite "Lessons sub-tab"' },
  openGrammarSession: { why: 'read-only review of a past session (its "replay wrong answers" starts a grammar quiz, claimed above)' },
  openPhrSession: { why: 'read-only review of a past session, leave-guard-phrases' },
  openWfSession: { why: 'read-only review of a past session, leave-guard-wordform-rewrite' },
  openRwSession: { why: 'read-only review of a past session, leave-guard-wordform-rewrite' },
  openFriendActivity: { why: 'the friends sheet on Home (a name box), not an exercise' },
  openWordOfDayStory: { why: 'the Word of the Day story overlay on Home — reading' },
  startPetRename: { why: "the pet's name box on Home" },
  openMathSection: { why: 'Math hub navigation; while a round is live it repaints the round, and it asks before dropping one (leave-guard-math7 / math4-wars hub back buttons)' },
  openGrade4: { why: 'the Grade 4 hub (unit cards)' },
  openWord: { why: 'the Word hub (unit cards) — js/units.js UNIT_HOSTS.word; its practice is "word practice" above' },
  openTopicDetail: { why: 'a Topics detail page (lesson cards)' },
  openReviewDetail: { why: 'the Topics "Review Mistakes" detail page (lesson cards)' },
};

// ---------------------------------------------------------------------------
// PART 1 — scraping the inventory
// ---------------------------------------------------------------------------

const JS_FILES = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: 'js/' + f, src: fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') }));
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The text between the `{` at `from` and its matching `}`.
function braced(src, from) {
  const i = src.indexOf('{', from);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

// The text from `from` to the `;` that ends the statement, brackets balanced.
function statement(src, from) {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) return src.slice(from, j + 1);
  }
  return src.slice(from);
}

// (a) every top-level is*Active() → { name: file }
function scrapeIsActive() {
  const out = {};
  for (const f of JS_FILES) {
    const re = /^\s*(?:async\s+)?function\s+(is[A-Z]\w*Active)\s*\(/gm;
    let m; while ((m = re.exec(f.src))) out[m[1]] = f.name;
  }
  return out;
}
// (b) js/app.js _BUSY_CHECKS
function scrapeBusyChecks() {
  const src = JS_FILES.find((f) => f.name === 'js/app.js').src;
  const i = src.indexOf('const _BUSY_CHECKS = [');
  assert.truthy(i >= 0, 'js/app.js declares _BUSY_CHECKS');
  const body = src.slice(i, src.indexOf('];', i));
  return body.match(/'(\w+)'/g).map((s) => s.slice(1, -1));
}
// (c) every EXAM_SETS registration → { key: file }
function scrapeExamSets() {
  const out = {};
  for (const f of JS_FILES) {
    const re = /EXAM_SETS\.(\w+)\s*=/g;
    let m; while ((m = re.exec(f.src))) out[m[1]] = f.name;
    const lit = f.src.indexOf('const EXAM_SETS = {');
    if (lit >= 0) {
      const body = braced(f.src, lit);
      const re2 = /^\s{4}(\w+):\s*\{/gm;
      while ((m = re2.exec(body))) out[m[1]] = f.name;
    }
  }
  return out;
}
// (d) every retry-drill key → { key: file }
function scrapeDrillKeys() {
  const out = {};
  for (const f of JS_FILES) {
    const re = /defineRetryDrill\(\s*([{\w]+)/g;
    let m;
    while ((m = re.exec(f.src))) {
      if (m[1] === 'cfg') continue;                       // the engine's own declaration
      let body;
      if (m[1] === '{') body = braced(f.src, m.index);
      else {
        // A literal (`const X = {…}`) or one derived from another config
        // (`const X = Object.assign({}, BASE, { key: … })`, js/units.js
        // WORD_RETRY_CONFIG): the whole declaration, either way.
        const d = f.src.indexOf('const ' + m[1] + ' = ');
        assert.truthy(d >= 0, f.name + ': ' + m[1] + ' is declared');
        body = statement(f.src, d);
      }
      const k = /key:\s*'(\w+)'/.exec(body);
      assert.truthy(k, f.name + ': defineRetryDrill without a key');
      out[k[1]] = f.name;
    }
  }
  return out;
}
// (e) every screen in index.html
function scrapeScreens() {
  return (INDEX_HTML.match(/<div class="screen[^"]*" id="(\w+)"/g) || []).map((s) => /id="(\w+)"/.exec(s)[1]);
}
// (f) every top-level start*/open* function whose call graph (any depth,
// top-level functions across js/) reaches a body that draws a `.grammar-option`
// or an `<input` → { name: file }. A heuristic: it names the shape every quiz
// in this app has (option buttons or a typed box), not a guarantee.
function scrapeStarters() {
  const fns = new Map();
  for (const f of JS_FILES) {
    const re = /^(?:async\s+)?function\s+([A-Za-z_]\w*)\s*\(/gm;
    let m; while ((m = re.exec(f.src))) fns.set(m[1], { file: f.name, body: braced(f.src, m.index) });
  }
  const memo = new Map();
  const renders = (name, seen) => {
    if (memo.has(name)) return memo.get(name);
    const fn = fns.get(name);
    if (!fn || seen.has(name)) return false;
    seen.add(name);
    let hit = /grammar-option|<input/.test(fn.body);
    if (!hit) for (const c of fn.body.match(/\b[A-Za-z_]\w*(?=\s*\()/g) || []) { if (fns.has(c) && renders(c, seen)) { hit = true; break; } }
    memo.set(name, hit);
    return hit;
  };
  const out = {};
  for (const [name, fn] of fns) if (/^(start|open)[A-Z]/.test(name) && renders(name, new Set())) out[name] = fn.file;
  return out;
}

// What the registry claims.
const claimed = { busy: new Set(), fns: new Set(), drills: new Set(), examSets: new Set(), starts: new Set(), screens: new Set() };
for (const a of ACTIVITIES) {
  if (typeof a.busy === 'string') claimed.busy.add(a.busy);
  claimed.screens.add(a.screen);
  for (const n of (a.claims && a.claims.fns) || []) claimed.fns.add(n);
  for (const n of (a.claims && a.claims.drills) || []) claimed.drills.add(n);
  for (const n of (a.claims && a.claims.examSets) || []) claimed.examSets.add(n);
  for (const n of (a.claims && a.claims.starts) || []) claimed.starts.add(n);
}

function unclaimed(found, sets, label) {
  return Object.keys(found).filter((n) => !sets.some((s) => s.has(n)))
    .map((n) => n + ' (' + found[n] + ')');
}
const HOW = ' — register it in ACTIVITIES with a start recipe, or allowlist it with a reason';

// One booted app with every lazy group landed, for the runtime checks.
async function bootEverything() {
  const h = mountApp();
  assert.deepEqual(h.loadErrors, [], 'the app boots');
  login(h);
  for (const id of scrapeScreens()) {
    if (h.sandbox.LazyData.filesFor(id).length) await h.sandbox.LazyData.ensure(id);
  }
  await settle();
  assert.deepEqual(h.loadErrors, [], 'every lazy group loads');
  return h;
}

suite('leave-guard contract · PART 1 · the inventory is claimed', () => {
  test('the registry itself: unique ids, every screen real, every string busy a runtime function', async () => {
    const ids = ACTIVITIES.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids: ' + ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
    const screens = new Set(scrapeScreens());
    for (const a of ACTIVITIES) {
      assert.truthy(screens.has(a.screen), a.id + ': screen ' + a.screen + ' is not in index.html');
      assert.truthy(typeof a.start === 'function' && typeof a.snap === 'function', a.id + ': needs start() and snap()');
    }
    const h = await bootEverything();
    for (const a of ACTIVITIES) {
      if (typeof a.busy === 'string') assert.equal(typeof h.sandbox[a.busy], 'function', a.id + ': busy "' + a.busy + '" is not a global function');
    }
  });

  test('(a) every is*Active() in js/ belongs to an activity', () => {
    const found = scrapeIsActive();
    assert.truthy(Object.keys(found).length >= 15, 'the scrape works (' + Object.keys(found).length + ')');
    assert.deepEqual(unclaimed(found, [claimed.busy, claimed.fns]), [], 'unclaimed is*Active helpers' + HOW);
    for (const n of [...claimed.busy, ...claimed.fns]) assert.truthy(found[n], 'stale claim: ' + n + ' is no longer declared in js/');
  });

  test('(b) _BUSY_CHECKS: every registry busy global is listed, every listed name is claimed and exists at runtime', async () => {
    const list = scrapeBusyChecks();
    for (const n of claimed.busy) assert.contains(list, n, n + ' guards a leave but is missing from js/app.js _BUSY_CHECKS — an update would reload over it');
    const owned = new Set([...claimed.busy, ...claimed.fns, ...Object.keys(BUSY_CHECKS_NOT_EXERCISES)]);
    const stray = list.filter((n) => !owned.has(n));
    assert.deepEqual(stray, [], 'names in _BUSY_CHECKS nobody claims' + HOW);
    for (const n of Object.keys(BUSY_CHECKS_NOT_EXERCISES)) assert.contains(list, n, 'stale allowlist entry: ' + n);
    const h = await bootEverything();
    for (const n of list) assert.equal(typeof h.sandbox[n], 'function', '_BUSY_CHECKS names ' + n + ', which is not a function once every group has loaded');
  });

  test('(c) every EXAM_SETS registration is an activity', async () => {
    const found = scrapeExamSets();
    assert.deepEqual(unclaimed(found, [claimed.examSets]), [], 'unclaimed exam sets' + HOW);
    for (const n of claimed.examSets) assert.truthy(found[n], 'stale claim: EXAM_SETS.' + n + ' is no longer registered');
    const h = await bootEverything();
    assert.deepEqual(Object.keys(h.peek('EXAM_SETS')).sort(), Object.keys(found).sort(), 'the runtime EXAM_SETS differ from what the scrape found');
  });

  test('(d) every retry-drill key is an activity', async () => {
    const found = scrapeDrillKeys();
    assert.deepEqual(unclaimed(found, [claimed.drills]), [], 'unclaimed drill keys' + HOW);
    for (const n of claimed.drills) assert.truthy(found[n], 'stale claim: drill key ' + n + ' is no longer defined');
    const h = await bootEverything();
    assert.deepEqual(Object.keys(h.peek('RETRY_DRILLS')).sort(), Object.keys(found).sort(), 'the runtime RETRY_DRILLS differ from what the scrape found');
  });

  test('(e) every <div class="screen"> in index.html is an activity\'s screen or allowlisted', () => {
    const found = {};
    for (const id of scrapeScreens()) found[id] = 'index.html';
    assert.deepEqual(unclaimed(found, [claimed.screens, new Set(Object.keys(SCREENS_WITHOUT_EXERCISE))]), [], 'unclaimed screens' + HOW);
    for (const n of Object.keys(SCREENS_WITHOUT_EXERCISE)) assert.truthy(found[n], 'stale allowlist entry: ' + n + ' is not in index.html');
  });

  test('(f) every start*/open* that draws an answer control is an activity\'s start or allowlisted', () => {
    const found = scrapeStarters();
    assert.truthy(Object.keys(found).length >= 40, 'the scrape works (' + Object.keys(found).length + ')');
    assert.deepEqual(unclaimed(found, [claimed.starts, new Set(Object.keys(START_NOT_EXERCISES))]), [], 'unclaimed start*/open* functions' + HOW);
    for (const n of claimed.starts) assert.truthy(found[n], 'stale claim: ' + n + ' no longer exists or no longer draws an answer control');
    for (const [n, entry] of Object.entries(START_NOT_EXERCISES)) {
      assert.truthy(found[n], 'stale allowlist entry: ' + n);
      assert.truthy(entry.why, n + ': an allowlist entry needs a reason');
      if (entry.still) assert.truthy(entry.still(), n + ': its allowlist reason no longer holds — "' + entry.why + '"');
    }
  });
});

// ---------------------------------------------------------------------------
// PART 2 — the protocol, executed for every entry
// ---------------------------------------------------------------------------

// Every way out. `lands` is the screen a "yes" would reach; a route whose
// destination is the activity's own screen is not a way out and is skipped.
const ROUTES = [
  { name: "switchScreen('homeScreen')", lands: () => 'homeScreen', reports: true, go: (h) => h.sandbox.switchScreen('homeScreen') },
  { name: "switchScreen('learnHubScreen')", lands: () => 'learnHubScreen', reports: true, go: (h) => h.sandbox.switchScreen('learnHubScreen') },
  { name: "switchScreen('mathHubScreen')", lands: () => 'mathHubScreen', reports: true, go: (h) => h.sandbox.switchScreen('mathHubScreen') },
  { name: 'openPetBattle()', lands: () => 'petBattleScreen', reports: false, go: async (h) => { await h.sandbox.openPetBattle(); } },
  { name: 'DailyTask.go(<deep link>)', reports: true,
    lands: (h, a) => h.peek('DailyTaskCatalog').get(a.deepLink || 'wordform').go.screen,
    go: (h, a) => h.peek('DailyTask').go(a.deepLink || 'wordform') },
];

const isBusy = (h, a) => (typeof a.busy === 'string' ? !!h.sandbox[a.busy]() : !!a.busy(h));

for (const a of ACTIVITIES) {
  suite('leave-guard contract · ' + a.id, () => {
    let h = null;
    const app = () => { assert.truthy(h, a.id + ': the app did not boot (see the first test of this suite)'); return h; };

    test('boots, starts the activity and is busy', async () => {
      const booted = mountApp();
      assert.deepEqual(booted.loadErrors, [], 'the app boots');
      await a.start(booted);
      await settle();
      h = booted;
      assert.equal(activeScreen(h), a.screen, 'the activity is on its own screen');
      assert.truthy(isBusy(h, a), a.id + ': busy after start');
      assert.truthy(h.sandbox._busyWithTimedActivity(), a.id + ': _busyWithTimedActivity() knows (an update must wait)');
      assert.deepEqual(h.loadErrors, [], 'nothing threw while loading');
    });

    for (const r of ROUTES) {
      test(r.name + ' → Cancel: asks once, refuses, nothing moves', async () => {
        const H = app();
        if (r.lands(H, a) === a.screen) return;                       // the activity's own tab: not a way out
        assert.truthy(isBusy(H, a), 'still busy going in');
        const before = a.snap(H);
        const screen = activeScreen(H);
        H.sandbox.__confirmAnswer = false;
        H.sandbox.__confirmLog.length = 0;
        const res = await r.go(H, a);
        await settle();
        assert.equal(H.sandbox.__confirmLog.length, 1, r.name + ': must ask exactly once (asked ' + H.sandbox.__confirmLog.length + ': ' + H.sandbox.__confirmLog.join(' | ') + ')');
        if (r.reports) assert.equal(res, false, r.name + ': must report the refusal');
        assert.truthy(isBusy(H, a), r.name + ': Cancel must keep the activity running');
        assert.equal(activeScreen(H), screen, r.name + ': Cancel must not change the screen');
        assert.equal(a.snap(H), before, r.name + ': Cancel must leave the state and the screen exactly as they were');
      });
    }

    test("OK on the first way out: leaves cleanly", async () => {
      const H = app();
      const r = ROUTES.find((x) => x.lands(H, a) !== a.screen);
      const lands = r.lands(H, a);
      H.sandbox.__confirmAnswer = true;
      H.sandbox.__confirmLog.length = 0;
      const res = await r.go(H, a);
      await settle(10);
      assert.equal(H.sandbox.__confirmLog.length, 1, r.name + ': asks once on the way out');
      if (r.reports) assert.equal(res, true, r.name + ': OK must let the leave happen');
      assert.equal(activeScreen(H), lands, 'landed on ' + lands);
      assert.falsy(isBusy(H, a), 'the activity is over');
      assert.falsy(H.sandbox._busyWithTimedActivity(), '_busyWithTimedActivity() is false — an update may proceed');
      assert.truthy(navShown(H), 'the bottom bar is back');
      assert.falsy(H.el('bottomNav').hasAttribute('aria-hidden'), 'and not aria-hidden');
      assert.equal(H.sandbox.buildStudyCheckpoint(), null, 'nothing left to checkpoint');
      H.sandbox.saveStudyCheckpoint();
      assert.equal(H.store[CHECKPOINT_KEY], undefined, 'no stored checkpoint offers the round back');
      assert.falsy(H.el(lands).classList.contains('lazy-css-pending'), 'the destination is not hidden behind a pending stylesheet');
      assert.falsy(H.doc.documentElement.classList.contains('math-board-open'), 'no board lock on <html>');
      assert.equal(H.doc.body.className, '', 'no body class left behind');
      // No stale flag: the next switch asks nothing.
      H.sandbox.__confirmAnswer = false;
      H.sandbox.__confirmLog.length = 0;
      assert.equal(H.sandbox.switchScreen(lands === 'homeScreen' ? 'learnHubScreen' : 'homeScreen'), true, 'the next switch goes through');
      assert.equal(H.sandbox.__confirmLog.length, 0, 'and asks nothing');
      assert.deepEqual(H.consoleLog.error, [], 'console.error stayed quiet');
    });
  });
}

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
