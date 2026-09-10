// ptnk-tab.test.js — 🏫 PTNK: a second set of papers on the Exam tab's engine.
//
// The engine in js/exam.js draws for whichever SET is current, and this file
// exists to prove the two sets never touch: a PTNK paper must not appear in
// the HCMC history, a PTNK bonus must not be paid on an HCMC paper, and a
// PTNK id must never be looked up in the HCMC bank. Every test here runs the
// real engine in a vm context with a small stub bank, so it does not depend on
// the transcribed papers having landed yet — tests/ptnk-data.test.js covers
// those.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Two tiny papers — enough to score, bonus, and tell apart.
const STUB_BANK = `
const PTNK_EXAMS = [
  { id: 'ptnk-2022-chuyen', year: 2022, track: 'chuyen', title: 'PTNK 2022 · Tiếng Anh Chuyên',
    subtitle: 'stub', durationMin: 120, keySource: 'official', source: 'x.pdf',
    questions: [
      { n: 1, part: 'P1', section: 'Language use', type: 'mcq', q: 'Q1', options: ['a','b','c','d'], correct: 1, explanation: 'because b is right' },
      { n: 2, part: 'P1', section: 'Word form', type: 'text', q: 'Q2 (ROOT)', accept: ['rooted'], answer: 'rooted', explanation: 'adjective slot' },
    ] },
  { id: 'ptnk-2024-kc', year: 2024, track: 'kc', title: 'PTNK 2024 · Tiếng Anh Không chuyên',
    subtitle: 'stub', durationMin: 60, keySource: 'solved', source: 'y.pdf',
    questions: [
      { n: 1, part: 'P1', section: 'Phonetics', type: 'mcq', q: 'Q1', options: ['a','b','c','d'], correct: 0, explanation: 'the -ed rule' },
    ] },
];`;

function world(extra) {
  const nav = { style: { display: 'flex' } };
  const els = {};
  const el = (id) => els[id] || (els[id] = {
    id, innerHTML: '', scrollTop: 0, textContent: '', style: {}, value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    focus() {}, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  });
  const store = {};
  const ctx = vm.createContext(Object.assign({
    console,
    document: {
      getElementById: (id) => id === 'bottomNav' ? nav : el(id),
      querySelector: () => el('_q'), querySelectorAll: () => [], createElement: () => el('_c'),
      body: el('body'), addEventListener() {},
    },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    window: { scrollTo() {} }, navigator: {},
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
    appState: { coins: 0 },
    currentUser: 'tester',
    saveUserData: () => {},
    confirm: () => true,
    recordStudy: () => {},
  }, extra || {}));
  for (const f of ['js/exam-data.js', 'js/exam.js', 'js/ptnk.js']) vm.runInContext(read(f), ctx, { filename: f });
  // Top-level const/let in a classic script is lexically scoped to that
  // script — visible to the OTHER scripts in the context (which is how
  // js/ptnk.js registers onto EXAM_SETS) but not to us through `ctx.X`.
  // Hand over the two the tests need to read.
  vm.runInContext(STUB_BANK + '\nglobalThis.__EXAMS = EXAMS;'
    + '\nglobalThis.__sets = EXAM_SETS;'
    + '\nglobalThis.__state = () => _examState;', ctx, { filename: 'stub.js' });
  return { ctx, nav, els, store };
}

// Answer every question of the live paper correctly (or not), then finish.
function sit(ctx, perfect) {
  const s = ctx.__state();
  s.questions.forEach((q, i) => {
    ctx.__state().idx = i;
    if (q.type === 'text') {
      // Wrong on purpose when not perfect.
      const el = ctx.document.getElementById('examTextInput');
      el.value = perfect ? q.answer : 'zzz';
      ctx.submitExamText();
    } else {
      ctx.answerExamChoice(perfect ? q.correct : (q.correct + 1) % q.options.length);
    }
  });
  ctx.finishExam(false);
}

suite('PTNK: the set is registered and separate', () => {
  test('js/ptnk.js registers a ptnk set on the engine with its own screen', () => {
    const { ctx } = world();
    assert.truthy(ctx.__sets.ptnk, 'no ptnk set');
    assert.equal(ctx.__sets.ptnk.screen, 'ptnkScreen');
    assert.equal(ctx.__sets.hcmc.screen, 'examScreen');
    assert.equal(ctx.__sets.ptnk.perfectBonus, 50);
    assert.equal(ctx.__sets.hcmc.perfectBonus, 0, 'the HCMC papers must not gain a bonus by accident');
    assert.equal(ctx.__sets.ptnk.coinsPerCorrect, ctx.__sets.hcmc.coinsPerCorrect, 'one engine, one rate');
  });

  test('a PTNK id is found in the PTNK bank and NOT in the HCMC bank', () => {
    const { ctx } = world();
    ctx.examSelectSet('ptnk');
    assert.truthy(ctx.examLookup('ptnk-2022-chuyen'), 'the paper must open from its own set');
    ctx.examSelectSet('hcmc');
    assert.equal(ctx.examLookup('ptnk-2022-chuyen'), null, 'the HCMC set must not answer for a PTNK id');
    assert.truthy(ctx.examLookup(ctx.__EXAMS[0].id), 'and still finds its own papers');
  });

  test('startPtnkExam pins the set even when nothing chose it first', () => {
    // The daily-task deep link lands here cold.
    const { ctx } = world();
    ctx.examSelectSet('hcmc');
    ctx.startPtnkExam('ptnk-2024-kc');
    assert.truthy(ctx.isExamActive(), 'the paper did not start');
    assert.equal(ctx.examCurrentSet(), 'ptnk');
    assert.equal(ctx.__state().set, 'ptnk');
    ctx.abandonExam();
  });
});

suite('PTNK: coins', () => {
  test('a clean sheet pays 5 a question plus the 50-xu bonus', () => {
    const { ctx } = world();
    ctx.appState.coins = 100;
    ctx.startExam('ptnk-2022-chuyen', 'ptnk');
    sit(ctx, true);
    assert.equal(ctx.appState.coins, 100 + 2 * 5 + 50);
    const run = ctx.appState.ptnkHistory[0];
    assert.equal(run.perfectBonus, 50);
    assert.equal(run.score, 2); assert.equal(run.total, 2);
  });

  test('one wrong answer: coins for the right ones, no bonus', () => {
    const { ctx } = world();
    ctx.appState.coins = 0;
    ctx.startExam('ptnk-2022-chuyen', 'ptnk');
    sit(ctx, false);
    assert.equal(ctx.appState.coins, 0, 'both answers were deliberately wrong');
    assert.equal(ctx.appState.ptnkHistory[0].perfectBonus, 0);
  });

  test('a perfect HCMC paper still earns NO bonus', () => {
    const { ctx } = world();
    const hcmc = ctx.__EXAMS.find(e => e.questions.length <= 45);
    ctx.appState.coins = 0;
    ctx.startExam(hcmc.id, 'hcmc');
    sit(ctx, true);
    assert.equal(ctx.appState.coins, hcmc.questions.length * 5, 'the HCMC rate is 5 a question and nothing more');
  });
});

suite('PTNK: history never crosses into the HCMC history', () => {
  test('a PTNK attempt lands on appState.ptnkHistory, not in the Exam tab key', () => {
    const { ctx, store } = world();
    ctx.startExam('ptnk-2022-chuyen', 'ptnk');
    sit(ctx, true);
    assert.equal(ctx.appState.ptnkHistory.length, 1);
    assert.equal(ctx.appState.ptnkHistory[0].examId, 'ptnk-2022-chuyen');
    assert.equal(ctx.appState.ptnkHistory[0].set, 'ptnk');
    assert.falsy(store.flashlingo_examHistory, 'the HCMC localStorage key must stay empty');
  });

  test('an HCMC attempt stays in the Exam tab key and never touches ptnkHistory', () => {
    const { ctx, store } = world();
    const hcmc = ctx.__EXAMS[0];
    ctx.startExam(hcmc.id, 'hcmc');
    sit(ctx, false);
    assert.truthy(store.flashlingo_examHistory, 'the HCMC attempt must be written where it always was');
    assert.equal((ctx.appState.ptnkHistory || []).length, 0);
  });

  test('best score on the PTNK home comes from PTNK attempts only', () => {
    const { ctx } = world();
    ctx.startExam('ptnk-2022-chuyen', 'ptnk');
    sit(ctx, true);
    assert.equal(ctx.ptnkBest('ptnk-2022-chuyen'), 2);
    assert.equal(ctx.ptnkBest('ptnk-2024-kc'), null);
  });

  test('a finished PTNK paper asks the app to sync — a daily task depends on it', () => {
    let synced = 0;
    const { ctx } = world({ EngAuth: { syncNow: () => { synced++; }, postAttempt: () => {} } });
    ctx.startExam('ptnk-2022-chuyen', 'ptnk');
    sit(ctx, true);
    assert.equal(synced, 1, 'without syncNow the paper waits for some OTHER tab to flush it');
  });
});

suite('PTNK: the home screen', () => {
  test('papers are grouped by year, newest first, KC before Chuyên', () => {
    const { ctx } = world();
    const html = ctx.renderPtnkHomeHTML();
    const y2024 = html.indexOf('Năm 2024'), y2022 = html.indexOf('Năm 2022');
    assert.truthy(y2024 !== -1 && y2022 !== -1 && y2024 < y2022, 'newest year first');
    assert.truthy(html.indexOf("startPtnkExam('ptnk-2022-chuyen')") !== -1);
    assert.truthy(html.indexOf("startPtnkExam('ptnk-2024-kc')") !== -1);
  });

  test('a solved paper says so; an official one does not', () => {
    const { ctx } = world();
    const html = ctx.renderPtnkHomeHTML();
    const kc = html.slice(html.indexOf('ptnk-2024-kc'), html.indexOf('ptnk-2024-kc') + 900);
    const ch = html.slice(html.indexOf('ptnk-2022-chuyen'), html.indexOf('ptnk-2022-chuyen') + 900);
    assert.truthy(kc.includes('Đáp án tham khảo'), 'a solved key must be labelled');
    assert.falsy(ch.includes('Đáp án tham khảo'), 'an official key must not be');
  });

  test('the rate and the bonus are stated on the home, not discovered', () => {
    const { ctx } = world();
    const html = ctx.renderPtnkHomeHTML();
    assert.truthy(html.includes('5 xu mỗi câu đúng') && html.includes('50 xu'));
  });

  test('with no bank, the home shows a retry rather than an empty list', () => {
    const { ctx } = world();
    vm.runInContext('PTNK_EXAMS.length = 0;', ctx);
    assert.truthy(ctx.renderPtnkHomeHTML().includes('Thử lại'));
  });
});

suite('PTNK: wiring', () => {
  test('the Learn hub offers PTNK and the screen exists', () => {
    const html = read('index.html');
    assert.truthy(html.includes('id="ptnkScreen"'), 'no ptnkScreen');
    assert.truthy(/nav-hub-card ptnk[\s\S]{0,200}switchScreen\('ptnkScreen'\)/.test(html), 'no Learn card');
    assert.truthy(html.indexOf('js/exam.js') < html.indexOf('js/ptnk.js'), 'ptnk.js must load after the engine it registers onto');
  });

  test('the bank is lazy and precached, like the Exam bank', () => {
    const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));
    assert.deepEqual(lazy.SCREEN_FILES.ptnkScreen, ['js/ptnk-data.js']);
    const sw = read('sw.js');
    assert.truthy(sw.includes("'/js/ptnk-data.js'") && sw.includes("'/js/ptnk.js'"));
  });

  test('the app paints the PTNK home on entry and remembers it under Learn', () => {
    const app = read('js/app.js');
    assert.truthy(/screenId === 'ptnkScreen' && typeof renderPtnkHome === 'function'\) renderPtnkHome\(\)/.test(app));
    assert.truthy(/ptnkScreen: 'learn'/.test(app));
  });

  test('the study checkpoint saves and restores the SET, not just the state', () => {
    // A paper saved mid-way must come back on the PTNK screen in the PTNK
    // set, or it is drawn on the HCMC tab and scored into the HCMC history.
    const app = read('js/app.js');
    assert.truthy(app.includes('EXAM_SETS[_examState.set].screen'), 'checkpoint must save the set\'s own screen');
    assert.truthy(app.includes('examSelectSet(s.set)'), 'restore must re-select the set before drawing');
  });

  test('the exit guard covers the PTNK screen too', () => {
    const app = read('js/app.js');
    assert.truthy(app.includes("_examSetCfg().screen : 'examScreen'"),
      'switchScreen must compare against the live set\'s screen, not a hard-coded examScreen');
  });

  test('an attempt is uploaded as an exam activity carrying examId', () => {
    const auth = read('js/auth.js');
    assert.truthy(/appState\.ptnkHistory \|\| \[\]\)\.forEach/.test(auth));
    assert.truthy(auth.includes("type: 'exam'") && auth.includes("detail: { examId: h.examId, set: 'ptnk' }"));
    const api = read('functions/api/activity.js');
    assert.truthy(/'exam'\]/.test(api), 'the server must accept the exam type or it drops the row in silence');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
