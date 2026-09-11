// practice-sets.test.js — the three PTNK-format practice menus on the exam
// engine: 📖 Đọc hiểu, ✏️ Điền từ, 🔍 Tìm lỗi sai.
//
// Runs the real engine (js/exam.js) with STUB banks, so it does not depend on
// the authored data having landed; tests/practice-data.test.js covers that.
// What is pinned here is the plumbing a child would hit first: a passage
// opens as a paper on its own screen, an error round can be rebuilt from its
// id, each menu's history stays its own, coins are paid at the practice rate,
// and every menu is reachable and uploaded.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const STUB = `
const READING_PASSAGES = [
  { id: 'rd-kc-01-1', level: 'kc', title: 'The School Garden', topic: 'school life', words: 260,
    passage: 'Para one about a garden.<br><br>Para two about carrots.',
    questions: [
      { kind: 'main-idea', type: 'mcq', q: 'Main idea?', options: ['a','b','c','d'], correct: 2, explanation: 'because the passage says so' },
      { kind: 'tfng', type: 'mcq', q: 'The garden grows carrots.', options: ['True','False','Not Given'], correct: 0, explanation: 'para two says carrots' },
      { kind: 'detail', type: 'mcq', q: 'Which?', options: ['a','b','c','d'], correct: 1, explanation: 'stated in para one' },
    ] },
  { id: 'rd-ch-06-2', level: 'ch', title: 'Cities and Trees', topic: 'urban planning', words: 450,
    passage: '<b>A.</b> Section a.<br><br><b>B.</b> Section b.',
    questions: [
      { kind: 'section', type: 'text', q: 'Which section mentions shade?', accept: ['B'], answer: 'B', explanation: 'section B mentions shade' },
      { kind: 'inference', type: 'mcq', q: 'Infer?', options: ['a','b','c','d'], correct: 3, explanation: 'implied by section A' },
    ] },
];
const CLOZE_PASSAGES = [
  { id: 'cl-kc-02-1', level: 'kc', mode: 'mcq', title: 'A Rainy Holiday', topic: 'holiday',
    passage: 'It (1)____ raining. We (2)____ inside.',
    questions: [
      { n: 1, type: 'mcq', q: 'Blank (1): …', options: ['was','were','is','be'], correct: 0, explanation: 'singular past' },
      { n: 2, type: 'mcq', q: 'Blank (2): …', options: ['stayed','stay','staying','stays'], correct: 0, explanation: 'past simple' },
    ] },
  { id: 'cl-ch-07-1', level: 'ch', mode: 'open', title: 'Tea', topic: 'history',
    passage: 'Tea, (1)____ was first drunk in China, …',
    questions: [
      { n: 1, type: 'text', q: 'Blank (1): …', accept: ['which'], answer: 'which', explanation: 'non-defining relative' },
    ] },
];
const ERROR_ITEMS = [
  { id: 'er-kc-01-1', level: 'kc', focus: 'tense', q: 'She (A) has lived here (B) since ten years (C) and still (D) loves it.', options: ['has lived','since ten years','and still','loves it'], correct: 1, correction: 'for ten years', explanation: 'duration takes for' },
  { id: 'er-kc-01-2', level: 'kc', focus: 'agreement', q: 'The (A) news (B) are (C) always (D) surprising.', options: ['news','are','always','surprising'], correct: 1, correction: 'is', explanation: 'news is uncountable' },
  { id: 'er-kc-01-3', level: 'kc', focus: 'article', q: 'He is (A) a (B) honest (C) man (D) indeed.', options: ['a','honest','man','indeed'], correct: 0, correction: 'an', explanation: 'vowel sound' },
  { id: 'er-ch-06-1', level: 'ch', focus: 'word-order', q: '(A) No sooner (B) he had left (C) than it (D) began to rain.', options: ['No sooner','he had left','than it','began to rain'], correct: 1, correction: 'had he left', explanation: 'inversion after No sooner' },
];`;

function world(extra) {
  const nav = { style: { display: 'flex' } };
  const els = {};
  const el = (id) => els[id] || (els[id] = {
    id, innerHTML: '', scrollTop: 0, textContent: '', style: {}, value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    focus() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  });
  const store = {};
  const ctx = vm.createContext(Object.assign({
    console,
    document: { getElementById: (id) => id === 'bottomNav' ? nav : el(id), querySelector: () => el('_q'), querySelectorAll: () => [], createElement: () => el('_c'), body: el('body'), addEventListener() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    window: { scrollTo() {} }, navigator: {},
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
    appState: { coins: 0 }, currentUser: 'tester', saveUserData: () => {}, confirm: () => true, recordStudy: () => {},
  }, extra || {}));
  for (const f of ['js/exam-data.js', 'js/exam.js', 'js/practice-sets.js']) vm.runInContext(read(f), ctx, { filename: f });
  vm.runInContext(STUB + '\nglobalThis.__sets = EXAM_SETS;\nglobalThis.__state = () => _examState;', ctx, { filename: 'stub.js' });
  return { ctx, els, store };
}
function sit(ctx, perfect) {
  const s = ctx.__state();
  s.questions.forEach((q, i) => {
    ctx.__state().idx = i;
    if (q.type === 'text') { ctx.document.getElementById('examTextInput').value = perfect ? q.answer : 'zzz'; ctx.submitExamText(); }
    else ctx.answerExamChoice(perfect ? q.correct : (q.correct + 1) % q.options.length);
  });
  ctx.finishExam(false);
}

suite('practice sets: three sets, three screens', () => {
  test('reading, cloze and errors are registered with their own screens and history', () => {
    const { ctx } = world();
    for (const [set, screen] of [['reading', 'readingScreen'], ['cloze', 'clozeScreen'], ['errors', 'errorsScreen']]) {
      assert.truthy(ctx.__sets[set], set + ' not registered');
      assert.equal(ctx.__sets[set].screen, screen);
      assert.equal(ctx.__sets[set].coinsPerCorrect, 5, 'the English practice rate');
      assert.equal(ctx.__sets[set].perfectBonus, 0, 'practice tabs pay per answer only');
      assert.equal(ctx.__sets[set].syncActivity, true, 'a daily task depends on the upload');
    }
  });

  test('a reading passage opens as a paper: passage on every question, kind as the tag', () => {
    const { ctx } = world();
    ctx.startReadingPassage('rd-kc-01-1');
    assert.truthy(ctx.isExamActive(), 'did not start');
    assert.equal(ctx.examCurrentSet(), 'reading');
    const s = ctx.__state();
    assert.equal(s.questions.length, 3);
    assert.truthy(s.questions.every(q => q.passage && q.passage.includes('garden')), 'every question must carry the passage');
    assert.equal(s.questions[1].section, 'True / False / Not Given');
    assert.equal(s.questions[0].section, 'Main idea');
    assert.equal(s.durationMin, 10, 'a kc reading passage is 10 minutes');
    ctx.abandonExam();
  });

  test('a section question grades a single letter; tfng is a 3-option mcq', () => {
    const { ctx } = world();
    ctx.startReadingPassage('rd-ch-06-2');
    const s = ctx.__state();
    assert.equal(s.durationMin, 15, 'a ch passage gets 15 minutes');
    assert.equal(s.questions[0].type, 'text');
    ctx.__state().idx = 0;
    ctx.document.getElementById('examTextInput').value = 'b';   // lowercase must still pass
    ctx.submitExamText();
    assert.truthy(ctx.__state().answers[0].isCorrect, 'B typed as b must be accepted');
    ctx.abandonExam();
  });

  test('a cloze text opens as a 10-blank paper with the text on every blank', () => {
    const { ctx } = world();
    ctx.startClozePassage('cl-kc-02-1');
    const s = ctx.__state();
    assert.equal(ctx.examCurrentSet(), 'cloze');
    assert.truthy(s.questions.every(q => q.passage.includes('(1)____')));
    assert.equal(s.questions[0].section, 'Cloze');
    ctx.abandonExam();
    ctx.startClozePassage('cl-ch-07-1');
    assert.equal(ctx.__state().questions[0].section, 'Open cloze');
    ctx.abandonExam();
  });
});

suite('practice sets: error rounds are drawn, and rebuilt from their id', () => {
  test('a round draws ROUND_SIZE items of one level, or all of them when fewer exist', () => {
    const { ctx } = world();
    const ids = ctx.errorsDraw('kc', () => 0.5);
    assert.deepEqual(ids.slice().sort(), ['er-kc-01-1', 'er-kc-01-2', 'er-kc-01-3']);
    assert.deepEqual(ctx.errorsDraw('ch'), ['er-ch-06-1']);
  });

  test('startErrorsRound opens a paper whose id carries the item ids', () => {
    const { ctx } = world();
    ctx.startErrorsRound('kc');
    assert.truthy(ctx.isExamActive());
    assert.equal(ctx.examCurrentSet(), 'errors');
    const s = ctx.__state();
    assert.truthy(/^er-round-kc:er-kc-01-\d(,er-kc-01-\d)*$/.test(s.examId), s.examId);
    assert.equal(s.questions.length, 3);
    assert.truthy(s.questions[0].explanation.includes('<b>Correction:</b>'), 'the explanation leads with the correction');
    ctx.abandonExam();
  });

  test('the same id rebuilds the same round later — review after a reload works', () => {
    const { ctx } = world();
    const id = ctx.errorsRoundId('kc', ['er-kc-01-3', 'er-kc-01-1']);
    ctx.examSelectSet('errors');
    const paper = ctx.examLookup(id);
    assert.truthy(paper, 'lookup must rebuild the round from its id');
    assert.deepEqual(paper.questions.map(q => q.q.slice(0, 12)), ['He is (A) a ', 'She (A) has ']);
    assert.equal(paper.questions[0].correct, 0);
  });

  test('an unknown id is null, not a crash', () => {
    const { ctx } = world();
    ctx.examSelectSet('errors');
    assert.equal(ctx.examLookup('er-round-kc:er-kc-99-9'), null);
    assert.equal(ctx.examLookup('nonsense'), null);
  });
});

suite('practice sets: history and coins stay per menu', () => {
  test('a reading attempt lands on readingHistory only', () => {
    const { ctx, store } = world();
    ctx.appState.coins = 0;
    ctx.startReadingPassage('rd-kc-01-1');
    sit(ctx, true);
    assert.equal(ctx.appState.readingHistory.length, 1);
    assert.equal(ctx.appState.readingHistory[0].examId, 'rd-kc-01-1');
    assert.equal(ctx.appState.coins, 3 * 5, '5 a question, no bonus');
    assert.falsy(ctx.appState.clozeHistory && ctx.appState.clozeHistory.length, 'cloze history untouched');
    assert.falsy(ctx.appState.ptnkHistory && ctx.appState.ptnkHistory.length, 'PTNK history untouched');
    assert.falsy(store.flashlingo_examHistory, 'the HCMC key untouched');
  });

  test('an error round records under errorsHistory with its rebuildable id', () => {
    const { ctx } = world();
    ctx.startErrorsRound('ch');
    sit(ctx, false);
    const h = ctx.appState.errorsHistory[0];
    assert.truthy(h.examId.startsWith('er-round-ch:'));
    assert.equal(h.score, 0);
    assert.equal(ctx.appState.coins, 0);
  });

  test('best score on the home is per passage and per menu', () => {
    const { ctx } = world();
    ctx.startReadingPassage('rd-kc-01-1');
    sit(ctx, true);
    assert.equal(ctx.practiceBest('readingHistory', 'rd-kc-01-1'), 100);
    assert.equal(ctx.practiceBest('readingHistory', 'rd-ch-06-2'), null);
    assert.equal(ctx.practiceBest('clozeHistory', 'rd-kc-01-1'), null);
    assert.truthy(ctx.renderReadingHomeHTML().includes('Best: 100%'));
  });

  test('a finished round asks the app to sync', () => {
    let synced = 0;
    const { ctx } = world({ EngAuth: { syncNow: () => { synced++; }, postAttempt: () => {} } });
    ctx.startErrorsRound('kc');
    sit(ctx, true);
    assert.equal(synced, 1);
  });
});

suite('practice sets: homes', () => {
  test('reading and cloze homes group by level and wire every passage', () => {
    const { ctx } = world();
    const r = ctx.renderReadingHomeHTML();
    assert.truthy(r.indexOf('Không chuyên') < r.indexOf('Chuyên'));
    assert.truthy(r.includes("startReadingPassage('rd-kc-01-1')") && r.includes("startReadingPassage('rd-ch-06-2')"));
    const c = ctx.renderClozeHomeHTML();
    assert.truthy(c.includes("startClozePassage('cl-kc-02-1')") && c.includes('typed') && c.includes('multiple choice'));
  });

  test('the errors home offers one round per level with the pool size', () => {
    const { ctx } = world();
    const h = ctx.renderErrorsHomeHTML();
    assert.truthy(h.includes("startErrorsRound('kc')") && h.includes("startErrorsRound('ch')"));
    assert.truthy(h.includes('from 3 ·') && h.includes('from 1 ·'));
  });

  test('with no bank each home shows a retry, never an empty list', () => {
    const { ctx } = world();
    vm.runInContext('READING_PASSAGES.length = 0; CLOZE_PASSAGES.length = 0; ERROR_ITEMS.length = 0;', ctx);
    for (const fn of ['renderReadingHomeHTML', 'renderClozeHomeHTML', 'renderErrorsHomeHTML']) assert.truthy(ctx[fn]().includes('Try again'), fn);
  });
});

suite('practice sets: wiring', () => {
  test('three Learn cards, three screens, script after the engine', () => {
    const html = read('index.html');
    for (const s of ['readingScreen', 'clozeScreen', 'errorsScreen']) {
      assert.truthy(html.includes(`id="${s}"`), s + ' missing');
      assert.truthy(html.includes(`switchScreen('${s}')`), 'no Learn card for ' + s);
    }
    assert.truthy(html.indexOf('js/exam.js') < html.indexOf('js/practice-sets.js'));
  });

  test('banks are lazy, precached and painted on entry', () => {
    const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));
    assert.deepEqual(lazy.SCREEN_FILES.readingScreen, ['js/reading-data.js']);
    assert.deepEqual(lazy.SCREEN_FILES.clozeScreen, ['js/cloze-data.js']);
    assert.deepEqual(lazy.SCREEN_FILES.errorsScreen, ['js/errors-data.js']);
    const sw = read('sw.js');
    for (const f of ['reading-data', 'cloze-data', 'errors-data']) assert.truthy(sw.includes(`'/js/${f}.js'`), f);
    assert.truthy(sw.includes("'/js/practice-sets.js'"));
    const app = read('js/app.js');
    for (const [s, fn] of [['readingScreen', 'renderReadingHome'], ['clozeScreen', 'renderClozeHome'], ['errorsScreen', 'renderErrorsHome']]) {
      assert.truthy(app.includes(`screenId === '${s}' && typeof ${fn} === 'function') ${fn}()`), s);
      assert.truthy(app.includes(`${s}: 'learn'`), s + ' nav group');
    }
  });

  test('attempts upload as exam activities; the catalog offers every menu at both levels', () => {
    const auth = read('js/auth.js');
    // Literal `appState.<name>History`, the shape the drift guard greps for.
    for (const k of ['readingHistory', 'clozeHistory', 'errorsHistory']) assert.truthy(auth.includes(`appState.${k}`), k + ' not uploaded');
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const keys = Catalog.entries('ptnk-practice').map(e => e.key).sort();
    assert.deepEqual(keys, ['cloze:any', 'cloze:ch', 'cloze:kc', 'errors:ch', 'errors:kc', 'reading:any', 'reading:ch', 'reading:kc']);
    assert.deepEqual(Catalog.get('reading:ch').match, { detail: { field: 'examId', prefix: 'rd-ch-' } });
    assert.deepEqual(Catalog.get('errors:kc').go, { screen: 'errorsScreen', calls: [['startErrorsRound', 'kc']] });
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
