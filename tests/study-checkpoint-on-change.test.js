// The study checkpoint (js/app.js) used to be written by a
// setInterval(saveStudyCheckpoint, 1000) that ran for the whole of every
// activity: a JSON.stringify and a localStorage write every second while a
// child sat thinking. It is now written when something changes. These tests
// EXECUTE that: an answer must land in localStorage before any clock could
// have ticked, typing must land after the debounce, and the end of a round
// must clear the checkpoint so a scored paper is never offered back.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createDocument } = require('./domshim');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const APP = read('js/app.js');

// The checkpoint machinery, lifted out of js/app.js: the constants, then the
// block from the listener flags through startStudyCheckpointing().
function checkpointSource() {
  const consts = APP.slice(APP.indexOf('const STUDY_CHECKPOINT_KEY ='), APP.indexOf('const STUDY_CHECKPOINT_MAX_AGE ='));
  const from = APP.indexOf('let _studyCheckpointListening');
  const to = APP.indexOf('let appState = null');
  assert.truthy(from > 0 && to > from, 'the checkpoint block moved; update this test');
  return consts + "const STUDY_CHECKPOINT_MAX_AGE = 86400000;\n" + APP.slice(from, to);
}

// A page with a phrases quiz on it and a localStorage that remembers what
// was written and when. Timers are real (the debounce is the thing under
// test) but short.
function page() {
  const doc = createDocument('<div id="phrasesScreen" class="screen active"></div><div id="examScreen" class="screen"></div>');
  const store = {};
  const writes = [];
  const sandbox = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, Set, Map, RegExp, Error,
    isNaN, parseInt, parseFloat, setTimeout, clearTimeout, setInterval, clearInterval,
    document: doc, navigator: { language: 'vi' }, location: { origin: 'http://test', search: '' },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem(k, v) { store[k] = String(v); writes.push(k); },
      removeItem(k) { delete store[k]; writes.push('-' + k); },
    },
    appState: { coins: 0 }, currentUser: 'kid',
    getUsers: () => ['kid'], getUserData: () => ({}),
    saveUserData() {}, showToast() {}, switchScreen() {}, renderHome() {}, createConfetti() {},
    setBottomNavActive() {}, speakAnswer() {}, petCheerAnswer() {}, recordStudy() {},
    savePhrasesSession() {}, phrasesSkillSummaries: () => [], prioRecord() {}, retryAdd() {},
    phrasesById: () => null, petComboBonus: () => 0, fireRewardCelebration() {},
    answerGateHTML: () => '', tapwordsWrap: s => s,
    EngAuth: { syncNow() {} },
    speedState: { currentVerbs: [] }, lessonState: null,
    addEventListener() {}, removeEventListener() {},
    module: { exports: {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(checkpointSource(), sandbox, { filename: 'app.js#checkpoint' });
  vm.runInContext(read('js/phrases.js'), sandbox, { filename: 'js/phrases.js' });
  vm.runInContext(read('js/exam.js'), sandbox, { filename: 'js/exam.js' });
  vm.runInContext('startStudyCheckpointing();', sandbox);
  const saved = () => {
    const raw = store['flashlingo-study-checkpoint-v1'];
    return raw ? JSON.parse(raw) : null;
  };
  return { sandbox, doc, store, writes, saved, run: code => vm.runInContext(code, sandbox) };
}

const QUIZ = `_phrQuiz = { questions: [
  { id: 'p1', q: 'He is good ___ maths.', options: ['at', 'in', 'on', 'of'], correct: 0, explanation: 'good at' },
  { id: 'p2', q: 'She is keen ___ art.', options: ['at', 'in', 'on', 'of'], correct: 2, explanation: 'keen on' },
], idx: 0, answers: [null, null], startedAt: Date.now() };
renderPhrQuestion();`;

const wait = ms => new Promise(r => setTimeout(r, ms));

suite('study checkpoint: saved on change, not every second', () => {
  test('the one-second saver is gone, and the change-driven saves are wired', () => {
    assert.falsy(/setInterval\(\s*saveStudyCheckpoint/.test(APP), 'the 1 s interval is back');
    const start = APP.slice(APP.indexOf('function startStudyCheckpointing()'), APP.indexOf('let appState = null'));
    assert.truthy(start.includes("document.addEventListener('click', scheduleStudyCheckpoint, true)"));
    assert.truthy(start.includes("document.addEventListener('input', scheduleDraftCheckpoint, true)"));
    assert.truthy(start.includes("window.addEventListener('pagehide', saveStudyCheckpoint)"));
    assert.truthy(start.includes("window.addEventListener('beforeunload', saveStudyCheckpoint)"));
    assert.truthy(start.includes("document.addEventListener('visibilitychange'"));
    assert.truthy(APP.includes('const STUDY_CHECKPOINT_DRAFT_MS = 500'));
  });

  test('every engine the checkpoint covers saves from its render and clears at its end', () => {
    // [file, render function, end-of-round function, the line in it after which it must save]
    const ENGINES = [
      ['js/grammar-ui.js', 'renderGrammarQuestion', 'finishGrammarQuiz', '_grammarQuizState = null;'],
      ['js/phrases.js', 'renderPhrQuestion', 'finishPhrasesQuiz', '_phrQuiz = null;'],
      ['js/wordform.js', 'renderWfQuestion', 'finishWordformQuiz', '_wfQuiz = null;'],
      ['js/rewrite.js', 'renderRwQuestion', 'finishRewriteQuiz', '_rwQuiz = null;'],
      ['js/collocation.js', 'renderCollocQuestion', 'finishCollocPractice', '_colQuiz = null;'],
      ['js/units.js', 'renderUnitQuestion', 'finishUnitPractice', '_unitQuiz = null;'],
      ['js/math.js', 'renderMathQuestion', 'finishMathQuiz', '_mathQuiz = null;'],
      ['js/mathwars.js', 'renderWars', 'finishWars', '_warsQuiz = null;'],
      ['js/exam.js', 'renderExamQuestion', 'finishExam', 's.finished = true;'],
      ['js/verbs.js', 'showSpeedQuestion', 'completeSpeedChallenge', "getElementById('speedCompleteOverlay').classList.add('active');"],
      ['js/lessons.js', 'renderMatchingRound', null, null],
    ];
    const CALL = "if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();";
    const fnBody = (src, name) => {
      const start = src.indexOf('function ' + name + '(');
      assert.truthy(start >= 0, name + ' not found');
      return src.slice(start, src.indexOf('\n}\n', start) + 3);
    };
    for (const [file, render, finish, endMarker] of ENGINES) {
      const src = read(file);
      assert.truthy(fnBody(src, render).includes(CALL), file + ': ' + render + ' does not save the checkpoint');
      if (finish) {
        const body = fnBody(src, finish);
        const at = body.indexOf(endMarker);
        assert.truthy(at >= 0, file + ': ' + finish + ' has no ' + endMarker);
        assert.truthy(body.slice(at, at + 400).includes(CALL), file + ': ' + finish + ' does not clear the checkpoint');
      }
    }
    // The clocks keep the remaining time honest without a page-wide timer.
    for (const [file, tick] of [['js/exam.js', '_examTick'], ['js/mathwars.js', 'warsClockTick'], ['js/verbs.js', 'showSpeedQuestion']]) {
      const src = read(file);
      const body = src.slice(src.indexOf('function ' + tick + '('));
      assert.truthy(body.slice(0, 2500).includes('saveStudyCheckpointOnClock()'), file + ': ' + tick + ' does not tick the clock save');
    }
  });

  test('an answer is in localStorage before any clock could have ticked', () => {
    const p = page();
    p.run(QUIZ);
    assert.equal(p.saved().kind, 'phrases', 'starting the quiz checkpointed it');
    assert.deepEqual(p.saved().state.answers, [null, null]);
    const before = p.writes.length;
    p.run('answerPhrQuestion(2)');
    // No await, no tick: the write already happened.
    assert.deepEqual(p.saved().state.answers, [2, null], 'the answer was saved synchronously');
    assert.truthy(p.writes.length > before, 'a write happened');
    p.run('nextPhrQuestion()');
    assert.equal(p.saved().state.idx, 1, 'moving on was saved synchronously');
    assert.equal(p.saved().user, 'kid');
  });

  test('finishing the round clears the checkpoint, so it is never offered back', () => {
    const p = page();
    p.run(QUIZ);
    p.run('answerPhrQuestion(0); nextPhrQuestion(); answerPhrQuestion(2);');
    assert.deepEqual(p.saved().state.answers, [0, 2]);
    p.run('nextPhrQuestion()');   // past the last question → finishPhrasesQuiz
    assert.equal(p.run('_phrQuiz'), null);
    assert.equal(p.saved(), null, 'a finished round must not survive as a checkpoint');
  });

  test('a scored exam paper clears its checkpoint the moment it is finished', () => {
    const p = page();
    p.run(`_examState = { set: 'kc', questions: [{ type: 'mcq', q: 'x', options: ['a','b'], correct: 0 }],
      answers: [null], idx: 0, deadlineTs: Date.now() + 60000, finished: false, timerId: null, startedAt: Date.now() };
      saveStudyCheckpoint();`);
    assert.equal(p.saved().kind, 'exam');
    p.run("_examState.answers[0] = { value: 0, isCorrect: true }; try { finishExam(false); } catch (e) {}");
    assert.equal(p.run('_examState && _examState.finished'), true);
    assert.equal(p.saved(), null, 'the finished paper is not a checkpoint any more');
  });

  test('typing is saved ~500 ms after the last keystroke, not on every one', async () => {
    const p = page();
    p.run(QUIZ);
    // Give the active screen a text box the way a typed question would.
    p.run("document.getElementById('phrasesScreen').innerHTML += '<input id=\"phrTextInput\" type=\"text\">'");
    const inp = p.doc.getElementById('phrTextInput');
    const before = p.writes.length;
    inp.value = 'a'; p.doc.dispatch('input');
    inp.value = 'at'; p.doc.dispatch('input');
    assert.equal(p.writes.length, before, 'no write per keystroke');
    await wait(650);
    assert.equal(p.writes.length, before + 1, 'exactly one write after the debounce');
    assert.equal(p.saved().drafts.phrTextInput, 'at', 'the draft is what was typed last');
  });

  test('a tap saves once, after its handlers ran; going hidden saves at once', async () => {
    const p = page();
    p.run(QUIZ);
    const before = p.writes.length;
    p.run("_phrQuiz.idx = 1;");           // a handler changed state…
    p.doc.dispatch('click');              // …during a tap
    p.doc.dispatch('click');              // two taps, one save
    assert.equal(p.writes.length, before, 'the tap save is deferred past the handlers');
    await wait(20);
    assert.equal(p.writes.length, before + 1, 'one coalesced write');
    assert.equal(p.saved().state.idx, 1);
    p.run("_phrQuiz.answers[1] = 2;");
    p.doc.visibilityState = 'hidden';
    p.doc.dispatch('visibilitychange');
    assert.deepEqual(p.saved().state.answers, [null, 2], 'hidden saved synchronously');
  });

  test('the clock save writes at most once per STUDY_CHECKPOINT_CLOCK_MS', () => {
    const p = page();
    p.run(QUIZ);
    const before = p.writes.length;
    p.run('saveStudyCheckpointOnClock(); saveStudyCheckpointOnClock(); saveStudyCheckpointOnClock();');
    assert.equal(p.writes.length, before, 'a fresh save is not repeated by the clock');
    p.run('_studyCheckpointClockAt = 0; saveStudyCheckpointOnClock(); saveStudyCheckpointOnClock();');
    assert.equal(p.writes.length, before + 1, 'one write once the interval has passed');
  });

  test('the update path still saves immediately before applying an update', () => {
    const apply = APP.slice(APP.indexOf('function applyUpdateWhenSafe('), APP.indexOf('function registerServiceWorker('));
    assert.truthy(apply.indexOf('saveStudyCheckpoint()') >= 0 && apply.indexOf('saveStudyCheckpoint()') < apply.indexOf('SKIP_WAITING'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
