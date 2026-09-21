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

// A page with a Book practice on it (js/units.js on the Word screen) and a
// localStorage that remembers what was written and when. Timers are real
// (the debounce is the thing under test) but short.
function page() {
  const doc = createDocument('<div id="wordScreen" class="screen active"><div id="wordUnitsBar"></div><div id="wordSubTabs"></div><div id="wordHistory"></div><div id="wordDetail"></div></div><div id="homeScreen" class="screen"></div>');
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
    prioRecord() {}, retryAdd() {}, petComboBonus: () => 0,
    answerGateHTML: () => '', tapwordsWrap: s => s,
    EngAuth: { syncNow() {} },
    addEventListener() {}, removeEventListener() {},
    module: { exports: {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(checkpointSource(), sandbox, { filename: 'app.js#checkpoint' });
  vm.runInContext(read('js/units.js'), sandbox, { filename: 'js/units.js' });
  vm.runInContext('startStudyCheckpointing();', sandbox);
  const saved = () => {
    const raw = store['flashlingo-study-checkpoint-v1'];
    return raw ? JSON.parse(raw) : null;
  };
  return { sandbox, doc, store, writes, saved, run: code => vm.runInContext(code, sandbox) };
}

// Two Book 1 words, the shape startUnitPractice builds.
const QUIZ = `_unitQuiz = { unit: 'pr1-1', questions: [
  { w: { set: 'pr1', unit: 1, en: 'advocate', vi: 'người ủng hộ', emoji: '📣' }, mode: 4, gap: buildUnitGap('advocate', 4) },
  { w: { set: 'pr1', unit: 1, en: 'client', vi: 'khách hàng', emoji: '🤝' }, mode: 4, gap: buildUnitGap('client', 4) },
], idx: 0, answers: [null, null] };
renderUnitQuestion();`;
// Type an answer into the box the practice drew, and check it.
const ANSWER = (text) => `document.getElementById('unitTextInput').value = ${JSON.stringify(text)}; submitUnitAnswer();`;

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

  test('the engine the checkpoint covers saves from its render and clears at its end', () => {
    // [file, render function, end-of-round function, the line in it after which it must save]
    const ENGINES = [
      ['js/units.js', 'renderUnitQuestion', 'finishUnitPractice', 'fireRewardCelebration(coinsEarned, pct);'],
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
    // The only kind js/app.js builds is the Book practice, on the Word screen.
    const build = APP.slice(APP.indexOf('function buildStudyCheckpoint()'), APP.indexOf('function saveStudyCheckpoint()'));
    assert.deepEqual([...build.matchAll(/kind:\s*'(\w+)'/g)].map(m => m[1]), ['units']);
    assert.truthy(build.includes("unitPracticeScreen() : 'wordScreen'"), 'it names the screen the engine says the round is on');
  });

  test('an answer is in localStorage before any clock could have ticked', () => {
    const p = page();
    p.run(QUIZ);
    assert.equal(p.saved().kind, 'units', 'starting the practice checkpointed it');
    assert.equal(p.saved().screen, 'wordScreen', 'on the Word screen');
    assert.deepEqual(p.saved().state.answers, [null, null]);
    const before = p.writes.length;
    p.run(ANSWER('advocate'));
    // No await, no tick: the write already happened.
    assert.deepEqual(p.saved().state.answers, [{ value: 'advocate', isCorrect: true }, null], 'the answer was saved synchronously');
    assert.truthy(p.writes.length > before, 'a write happened');
    p.run('nextUnitQuestion()');
    assert.equal(p.saved().state.idx, 1, 'moving on was saved synchronously');
    assert.equal(p.saved().user, 'kid');
  });

  test('finishing the round clears the checkpoint, so it is never offered back', () => {
    const p = page();
    p.run(QUIZ);
    p.run(ANSWER('advocate') + ' nextUnitQuestion(); ' + ANSWER('zzz'));
    assert.deepEqual(p.saved().state.answers.map(a => a.isCorrect), [true, false]);
    p.run('nextUnitQuestion()');   // past the last question → finishUnitPractice
    assert.equal(p.run('_unitQuiz'), null);
    assert.equal(p.run('appState.coins'), 5, 'the round was scored');
    assert.equal(p.saved(), null, 'a finished round must not survive as a checkpoint');
  });

  test('typing is saved ~500 ms after the last keystroke, not on every one', async () => {
    const p = page();
    p.run(QUIZ);
    // The practice draws its own text box on the active screen.
    const inp = p.doc.getElementById('unitTextInput');
    assert.truthy(inp, 'the answer box is on the Word screen');
    const before = p.writes.length;
    inp.value = 'a'; p.doc.dispatch('input');
    inp.value = 'ad'; p.doc.dispatch('input');
    assert.equal(p.writes.length, before, 'no write per keystroke');
    await wait(650);
    assert.equal(p.writes.length, before + 1, 'exactly one write after the debounce');
    assert.equal(p.saved().drafts.unitTextInput, 'ad', 'the draft is what was typed last');
  });

  test('a tap saves once, after its handlers ran; going hidden saves at once', async () => {
    const p = page();
    p.run(QUIZ);
    const before = p.writes.length;
    p.run("_unitQuiz.idx = 1;");           // a handler changed state…
    p.doc.dispatch('click');               // …during a tap
    p.doc.dispatch('click');               // two taps, one save
    assert.equal(p.writes.length, before, 'the tap save is deferred past the handlers');
    await wait(20);
    assert.equal(p.writes.length, before + 1, 'one coalesced write');
    assert.equal(p.saved().state.idx, 1);
    p.run("_unitQuiz.answers[1] = { value: 'zzz', isCorrect: false };");
    p.doc.visibilityState = 'hidden';
    p.doc.dispatch('visibilitychange');
    assert.deepEqual(p.saved().state.answers, [null, { value: 'zzz', isCorrect: false }], 'hidden saved synchronously');
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
