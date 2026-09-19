// practice-sets.test.js — the four PTNK-format practice menus on the exam
// engine: 📖 Đọc hiểu, ✏️ Điền từ, 🔍 Tìm lỗi sai, 🧩 Grammar & Vocabulary, 🔊 Phonetics & Stress.
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
];
const GRAMMAR_VOCAB_ITEMS = [
  { id: 'gv-kc-01-1', level: 'kc', focus: 'tense', q: 'By the time we arrived, the film ______.', options: ['started','has started','had started','was starting'], correct: 2, answer: 'had started', vi: 'Lúc bọn tớ tới thì phim đã bắt đầu rồi.', explanation: 'earlier past action: past perfect' },
  { id: 'gv-kc-01-2', level: 'kc', focus: 'tense', q: 'She ______ tennis every Sunday.', options: ['plays','is playing','played','has played'], correct: 0, answer: 'plays', vi: 'Cô ấy chơi tennis mỗi chủ nhật.', explanation: 'habit: present simple' },
  { id: 'gv-kc-01-3', level: 'kc', focus: 'preposition', q: 'He is good ______ maths.', options: ['in','at','on','for'], correct: 1, answer: 'at', vi: 'Cậu ấy giỏi toán.', explanation: 'good at' },
  { id: 'gv-kc-01-4', level: 'kc', focus: 'modal', q: 'You ______ wear a helmet on a motorbike.', options: ['must','might','would','may'], correct: 0, answer: 'must', vi: 'Bạn phải đội mũ bảo hiểm khi đi xe máy.', explanation: 'obligation: must' },
  { id: 'gv-ch-06-1', level: 'ch', focus: 'idiom', q: 'After the third loss he decided to ______.', options: ['cut his losses','bide his time','raise the stakes','burn his boats'], correct: 0, answer: 'cut his losses', vi: 'Sau lần thua thứ ba anh ấy quyết định dừng lại để tránh mất thêm.', explanation: 'cut your losses = stop before losing more' },
];
const PHONETICS_ITEMS = [
  { id: 'ph-kc-01-1', level: 'kc', kind: 'sound', rule: 'ed', options: ['look<u>ed</u>','laugh<u>ed</u>','declin<u>ed</u>','hop<u>ed</u>'], words: ['looked','laughed','declined','hoped'], ipa: ['/lʊkt/','/lɑːft/','/dɪˈklaɪnd/','/həʊpt/'], correct: 2, explanation: 'declined /dɪˈklaɪnd/ — đuôi -ed đọc /d/ sau âm hữu thanh.' },
  { id: 'ph-kc-01-2', level: 'kc', kind: 'sound', rule: 'oo-ou-ow', options: ['p<u>oo</u>l','sch<u>oo</u>l','w<u>oo</u>l','t<u>oo</u>l'], words: ['pool','school','wool','tool'], ipa: ['/puːl/','/skuːl/','/wʊl/','/tuːl/'], correct: 2, explanation: 'wool /wʊl/ — oo ngắn.' },
  { id: 'ph-kc-01-11', level: 'kc', kind: 'stress', rule: '2syl', options: ['helpful','global','distract','monkey'], words: ['helpful','global','distract','monkey'], ipa: ['/ˈhelpfʊl/','/ˈɡləʊbəl/','/dɪˈstrækt/','/ˈmʌŋki/'], syllables: [2,2,2,2], stress: [1,1,2,1], correct: 2, explanation: 'distract — động từ 2 âm tiết nhấn âm 2.' },
  { id: 'ph-ch-16-1', level: 'ch', kind: 'sound', rule: 'c-g', options: ['fa<u>c</u>ade','lo<u>c</u>ale','<u>ch</u>oir','me<u>ch</u>anic'], words: ['facade','locale','choir','mechanic'], ipa: ['/fəˈsɑːd/','/ləʊˈkɑːl/','/ˈkwaɪə/','/məˈkænɪk/'], correct: 0, explanation: 'façade /s/.' },
  { id: 'ph-ch-16-11', level: 'ch', kind: 'stress', rule: '4syl', options: ['conditioner','advantageous','apprenticeship','unpleasantness'], words: ['conditioner','advantageous','apprenticeship','unpleasantness'], ipa: ['/kənˈdɪʃənə/','/ˌædvənˈteɪdʒəs/','/əˈprentɪsʃɪp/','/ʌnˈplezəntnəs/'], syllables: [4,4,4,4], stress: [2,3,2,2], correct: 1, explanation: 'advantageous nhấn âm 3.' },
];
const PHONETICS_LESSONS = [
  { key: 'ed', title: 'Đuôi -ed đọc /t/, /d/ hay /ɪd/?', icon: '🔚', content: '<p>Intro.</p><h4>📌 Quy tắc</h4><ul><li>/t/ sau âm vô thanh</li></ul><h4>⚠️ Bẫy thường gặp</h4><p>naked /ˈneɪkɪd/</p><h4>🎯 Cách làm bài</h4><p>…</p>' },
  { key: '2syl', title: 'Trọng âm từ 2 âm tiết', icon: '🎵', content: '<p>Intro.</p><h4>A</h4><p>a</p><h4>B</h4><p>b</p><h4>C</h4><p>c</p>' },
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
  for (const f of ['js/exam.js', 'js/practice-sets.js']) vm.runInContext(read(f), ctx, { filename: f });
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
  test('reading, cloze, errors, grammarvocab and phonetics are registered with their own screens and history', () => {
    const { ctx } = world();
    for (const [set, screen] of [['reading', 'readingScreen'], ['cloze', 'clozeScreen'], ['errors', 'errorsScreen'], ['grammarvocab', 'grammarVocabScreen'], ['phonetics', 'phoneticsScreen']]) {
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

suite('practice sets: grammar & vocabulary rounds', () => {
  test('a round draws one item per focus before a second of any focus', () => {
    const { ctx } = world();
    // Three focuses in the kc stub (tense ×2, preposition, modal): whatever the
    // shuffle, the first three ids must cover all three focuses.
    for (const seed of [0.1, 0.5, 0.9]) {
      const ids = ctx.grammarVocabDraw('kc', () => seed);
      assert.equal(ids.length, 4);
      const focus = id => ctx.grammarVocabBank().find(it => it.id === id).focus;
      assert.equal(new Set(ids.slice(0, 3).map(focus)).size, 3, 'first three cover every focus: ' + ids);
    }
    assert.deepEqual(ctx.grammarVocabDraw('ch'), ['gv-ch-06-1']);
  });

  test('startGrammarVocabRound opens a paper: focus label as the tag, Vietnamese under the explanation', () => {
    const { ctx } = world();
    ctx.startGrammarVocabRound('kc');
    assert.truthy(ctx.isExamActive());
    assert.equal(ctx.examCurrentSet(), 'grammarvocab');
    const s = ctx.__state();
    assert.truthy(/^gv-round-kc:gv-kc-01-\d(,gv-kc-01-\d)*$/.test(s.examId), s.examId);
    assert.equal(s.questions.length, 4);
    const q = s.questions.find(x => x.q.startsWith('He is good'));
    assert.equal(q.section, 'Prepositions');
    assert.truthy(q.explanation.includes('good at') && q.explanation.includes('<i>Cậu ấy giỏi toán.</i>'), q.explanation);
    ctx.abandonExam();
  });

  test('the same id rebuilds the same round; an unknown id is null', () => {
    const { ctx } = world();
    ctx.examSelectSet('grammarvocab');
    const paper = ctx.examLookup(ctx.grammarVocabRoundId('kc', ['gv-kc-01-3', 'gv-kc-01-1']));
    assert.truthy(paper);
    assert.deepEqual(paper.questions.map(q => q.correct), [1, 2]);
    assert.equal(paper.durationMin, 10);
    assert.equal(ctx.examLookup('gv-round-kc:gv-kc-99-9'), null);
  });

  test('a round records under grammarVocabHistory only, and a clean round unlocks Chuyên', () => {
    const { ctx } = world();
    assert.equal(ctx.practiceLevelFor('grammarVocabHistory'), 'kc');
    ctx.startGrammarVocabRound('kc');
    sit(ctx, true);
    assert.equal(ctx.appState.grammarVocabHistory.length, 1);
    assert.truthy(ctx.appState.grammarVocabHistory[0].examId.startsWith('gv-round-kc:'));
    assert.equal(ctx.appState.coins, 4 * 5);
    assert.falsy(ctx.appState.errorsHistory && ctx.appState.errorsHistory.length, 'errors history untouched');
    assert.equal(ctx.practiceLevelFor('grammarVocabHistory'), 'ch');
    ctx.startGrammarVocabPractice();
    assert.truthy(ctx.__state().examId.startsWith('gv-round-ch:'), 'the next round must be Chuyên');
    ctx.abandonExam();
    assert.truthy(ctx.renderGrammarVocabHomeHTML().includes('startGrammarVocabPractice()'));
  });
});

suite('practice sets: phonetics & stress rounds', () => {
  test('a round is five sound items then five stress items of one level (or all there are)', () => {
    const { ctx } = world();
    const ids = ctx.phoneticsDraw('kc', () => 0.3);
    assert.deepEqual(ids.slice().sort(), ['ph-kc-01-1', 'ph-kc-01-11', 'ph-kc-01-2'], 'the stub has 2 sound + 1 stress kc items');
    assert.truthy(ids.indexOf('ph-kc-01-11') === 2, 'stress comes after sound: ' + ids);
    assert.deepEqual(ctx.phoneticsDraw('ch').sort(), ['ph-ch-16-1', 'ph-ch-16-11']);
  });

  test('a round opens with the paper\'s own instruction as the stem, the four words to hear, and the tag', () => {
    const { ctx } = world();
    ctx.startPhoneticsRound('kc');
    assert.truthy(ctx.isExamActive());
    assert.equal(ctx.examCurrentSet(), 'phonetics');
    const s = ctx.__state();
    assert.truthy(/^ph-round-kc:/.test(s.examId), s.examId);
    const q0 = s.questions[0], last = s.questions[s.questions.length - 1];
    assert.truthy(/underlined part is pronounced differently/.test(q0.q), q0.q);
    assert.equal(q0.section, 'Phonetics');
    assert.equal(last.section, 'Stress');
    assert.truthy(/primary stress is placed differently/.test(last.q), last.q);
    assert.equal(q0.hear.length, 4);
    assert.truthy(q0.hear.every(h => h.word && /^\/.+\/$/.test(h.ipa)), 'each hear entry has word + IPA');
    assert.truthy(q0.options[0].includes('<u>'), 'the underlined part reaches the option');
    ctx.abandonExam();
  });

  test('the 🔊 buttons appear only once the item is answered', () => {
    const { ctx, els } = world();
    ctx.startPhoneticsRound('kc');
    const html = () => els.phoneticsScreen.innerHTML;
    assert.falsy(html().includes('exam-hear-btn'), 'no 🔊 before answering');
    ctx.answerExamChoice(1);
    assert.equal((html().match(/exam-hear-btn/g) || []).length, 4, 'four 🔊 after answering');
    assert.truthy(html().includes("_unitSpeak('looked')") || html().includes("_unitSpeak('pool')"), 'each button speaks its word');
    assert.truthy(html().includes('exam-hear-ipa'), 'IPA shown beside the word');
    ctx.abandonExam();
  });

  test('the same id rebuilds the round; an unknown id is null', () => {
    const { ctx } = world();
    ctx.examSelectSet('phonetics');
    const paper = ctx.examLookup(ctx.phoneticsRoundId('ch', ['ph-ch-16-11', 'ph-ch-16-1']));
    assert.truthy(paper);
    assert.deepEqual(paper.questions.map(q => q.correct), [1, 0]);
    assert.equal(paper.durationMin, 6);
    assert.equal(ctx.examLookup('ph-round-kc:ph-kc-99-9'), null);
  });

  test('history stays on phoneticsHistory and a clean round unlocks Chuyên', () => {
    const { ctx } = world();
    assert.equal(ctx.practiceLevelFor('phoneticsHistory'), 'kc');
    ctx.startPhoneticsRound('kc');
    sit(ctx, true);
    assert.equal(ctx.appState.phoneticsHistory.length, 1);
    assert.truthy(ctx.appState.phoneticsHistory[0].examId.startsWith('ph-round-kc:'));
    assert.equal(ctx.appState.coins, 3 * 5);
    assert.falsy(ctx.appState.grammarVocabHistory && ctx.appState.grammarVocabHistory.length, 'other histories untouched');
    assert.equal(ctx.practiceLevelFor('phoneticsHistory'), 'ch');
    ctx.startPhoneticsPractice();
    assert.truthy(ctx.__state().examId.startsWith('ph-round-ch:'));
    ctx.abandonExam();
  });

  test('the home opens on Lessons, one card per lesson with its question count; Practice is the other tab', () => {
    const { ctx, els } = world();
    ctx.renderPhoneticsHome();
    const html = els.phoneticsScreen.innerHTML;
    assert.equal((html.match(/exam-lesson-card/g) || []).length, 2);
    assert.truthy(html.includes('1 câu luyện tập'), 'the -ed lesson counts its one item');
    assert.truthy(html.includes("switchPhoneticsSubTab('practice')"));
    assert.falsy(html.includes('startPhoneticsPractice()'), 'Practice button lives on the other tab');
    ctx.openPhoneticsLesson('ed');
    assert.truthy(els.phoneticsScreen.innerHTML.includes('naked /ˈneɪkɪd/'), 'the lesson content renders');
    assert.truthy(els.phoneticsScreen.innerHTML.includes('renderPhoneticsHome()'), 'a way back');
    ctx.switchPhoneticsSubTab('practice');
    assert.truthy(els.phoneticsScreen.innerHTML.includes('startPhoneticsPractice()'));
    ctx.switchPhoneticsSubTab('lessons');
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
    assert.deepEqual(Object.keys(store), [], 'no localStorage key of its own is written');
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
    assert.truthy(ctx.renderReadingHomeHTML().includes('1 aced'));
  });

  test('a finished round asks the app to sync', () => {
    let synced = 0;
    const { ctx } = world({ EngAuth: { syncNow: () => { synced++; }, postAttempt: () => {} } });
    ctx.startErrorsRound('kc');
    sit(ctx, true);
    assert.equal(synced, 1);
  });
});

suite('practice sets: Practice picks the item — Không chuyên first, Chuyên once one is aced', () => {
  test('a fresh child is served Không chuyên', () => {
    const { ctx } = world();
    assert.equal(ctx.practiceLevelFor('readingHistory'), 'kc');
    const picks = new Set();
    for (let i = 0; i < 40; i++) picks.add(ctx.practicePick(ctx.readingBank(), 'readingHistory').level);
    assert.deepEqual([...picks], ['kc'], 'every draw must be Không chuyên before anything is aced');
  });

  test('a Không chuyên item scored below 100% does NOT unlock Chuyên', () => {
    const { ctx } = world();
    ctx.startReadingPassage('rd-kc-01-1');
    sit(ctx, false);
    assert.equal(ctx.practiceLevelFor('readingHistory'), 'kc');
  });

  test('one Không chuyên item at 100% unlocks Chuyên — and it is then preferred', () => {
    const { ctx } = world();
    ctx.startReadingPassage('rd-kc-01-1');
    sit(ctx, true);
    assert.equal(ctx.practiceLevelFor('readingHistory'), 'ch');
    const pick = ctx.practicePick(ctx.readingBank(), 'readingHistory', () => 0.3);
    assert.equal(pick.level, 'ch');
  });

  test('an aced item is not served again while unaced ones remain', () => {
    // Stub bank: one kc passage, one ch passage. Ace the kc one → level ch,
    // the ch passage is the only unaced item → it must be picked every time.
    const { ctx } = world();
    ctx.startReadingPassage('rd-kc-01-1');
    sit(ctx, true);
    for (let i = 0; i < 20; i++) assert.equal(ctx.practicePick(ctx.readingBank(), 'readingHistory').id, 'rd-ch-06-2');
  });

  test('when every item is aced, Practice still serves something', () => {
    const { ctx } = world();
    for (const id of ['rd-kc-01-1', 'rd-ch-06-2']) { ctx.startReadingPassage(id); sit(ctx, true); }
    assert.truthy(ctx.practicePick(ctx.readingBank(), 'readingHistory'), 'must never return null with a non-empty bank');
  });

  test('error rounds follow the same rule on the round level', () => {
    const { ctx } = world();
    assert.equal(ctx.practiceLevelFor('errorsHistory'), 'kc');
    ctx.startErrorsRound('kc');
    sit(ctx, true);                          // 3/3 on the stub = a clean round
    assert.equal(ctx.practiceLevelFor('errorsHistory'), 'ch');
    ctx.startErrorsPractice();
    assert.truthy(ctx.__state().examId.startsWith('er-round-ch:'), 'the next round must be Chuyên');
    ctx.abandonExam();
  });

  test('Practice goes straight in — it never shows a confirm dialog', () => {
    // "Practice" was the tap. A world whose confirm() throws must still open.
    const { ctx } = world({ confirm: () => { throw new Error('confirm() must not be called by Practice'); } });
    for (const fn of ['startReadingPractice', 'startClozePractice', 'startErrorsPractice']) {
      ctx[fn]();
      assert.truthy(ctx.isExamActive(), fn + ' did not open without a confirm');
      ctx.abandonExam();
    }
  });

  test('startReadingPractice / startClozePractice open a paper of the chosen level', () => {
    const { ctx } = world();
    ctx.startReadingPractice();
    assert.truthy(ctx.isExamActive() && ctx.__state().examId.startsWith('rd-kc-'));
    ctx.abandonExam();
    ctx.startClozePractice();
    assert.truthy(ctx.isExamActive() && ctx.__state().examId.startsWith('cl-kc-'));
    ctx.abandonExam();
  });
});

suite('practice sets: homes', () => {
  test('each home is one Practice button plus History — no list of passages', () => {
    const { ctx } = world();
    for (const [fn, start] of [['renderReadingHomeHTML', 'startReadingPractice'], ['renderClozeHomeHTML', 'startClozePractice'], ['renderErrorsHomeHTML', 'startErrorsPractice']]) {
      const h = ctx[fn]();
      assert.equal((h.match(/phrases-cta"/g) || []).length, 1, fn + ': exactly one Practice button');
      assert.truthy(h.includes(`onclick="${start}()"`), fn + ': wired to ' + start);
      assert.truthy(h.includes('renderExamHistory()'), fn + ': History below');
      assert.falsy(/startReadingPassage\('|startClozePassage\('/.test(h), fn + ': no per-passage buttons');
    }
  });

  test('the button says which level it will draw, and how to unlock the next', () => {
    const { ctx } = world();
    let h = ctx.renderReadingHomeHTML();
    assert.truthy(h.includes('Không chuyên') && h.includes('Score 100% on one Không chuyên item to unlock Chuyên'));
    ctx.startReadingPassage('rd-kc-01-1'); sit(ctx, true);
    h = ctx.renderReadingHomeHTML();
    assert.truthy(h.includes('Chuyên unlocked') && h.includes('1 aced'));
  });

  test('with no bank each home shows a retry, never an empty list', () => {
    const { ctx } = world();
    vm.runInContext('READING_PASSAGES.length = 0; CLOZE_PASSAGES.length = 0; ERROR_ITEMS.length = 0;', ctx);
    for (const fn of ['renderReadingHomeHTML', 'renderClozeHomeHTML', 'renderErrorsHomeHTML']) assert.truthy(ctx[fn]().includes('Try again'), fn);
  });
});

suite('practice sets: wiring', () => {
  test('four Learn cards, four screens, script after the engine', () => {
    const html = read('index.html');
    for (const s of ['readingScreen', 'clozeScreen', 'errorsScreen', 'grammarVocabScreen', 'phoneticsScreen']) {
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
    assert.deepEqual(lazy.SCREEN_FILES.grammarVocabScreen, ['js/grammar-vocab-data.js']);
    assert.deepEqual(lazy.SCREEN_FILES.phoneticsScreen, ['js/phonetics-data.js', 'js/phonetics-lessons.js']);
    const sw = read('sw.js');
    for (const f of ['reading-data', 'cloze-data', 'errors-data', 'grammar-vocab-data', 'phonetics-data', 'phonetics-lessons']) assert.truthy(sw.includes(`'/js/${f}.js'`), f);
    assert.truthy(sw.includes("'/js/practice-sets.js'"));
    const app = read('js/app.js');
    for (const [s, fn] of [['readingScreen', 'renderReadingHome'], ['clozeScreen', 'renderClozeHome'], ['errorsScreen', 'renderErrorsHome'], ['grammarVocabScreen', 'renderGrammarVocabHome'], ['phoneticsScreen', 'renderPhoneticsHome']]) {
      assert.truthy(app.includes(`screenId === '${s}' && typeof ${fn} === 'function') ${fn}()`), s);
      assert.truthy(app.includes(`${s}: 'learn'`), s + ' nav group');
    }
  });

  test('attempts upload as exam activities; the catalog offers every menu at both levels', () => {
    const auth = read('js/auth.js');
    // Literal `appState.<name>History`, the shape the drift guard greps for.
    for (const k of ['readingHistory', 'clozeHistory', 'errorsHistory', 'grammarVocabHistory', 'phoneticsHistory']) assert.truthy(auth.includes(`appState.${k}`), k + ' not uploaded');
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const keys = Catalog.entries('ptnk-practice').map(e => e.key).sort();
    assert.deepEqual(keys, ['cloze:any', 'cloze:ch', 'cloze:kc', 'errors:ch', 'errors:kc', 'grammarvocab:ch', 'grammarvocab:kc', 'phonetics:ch', 'phonetics:kc', 'reading:any', 'reading:ch', 'reading:kc']);
    assert.deepEqual(Catalog.get('phonetics:kc').go, { screen: 'phoneticsScreen', calls: [['startPhoneticsRound', 'kc']] });
    assert.deepEqual(Catalog.get('phonetics:ch').path, ['Eng', 'Phonetics & Stress']);
    assert.deepEqual(Catalog.get('grammarvocab:ch').go, { screen: 'grammarVocabScreen', calls: [['startGrammarVocabRound', 'ch']] });
    assert.deepEqual(Catalog.get('grammarvocab:kc').path, ['Eng', 'Grammar & Vocabulary']);
    assert.deepEqual(Catalog.get('reading:ch').match, { detail: { field: 'examId', prefix: 'rd-ch-' } });
    assert.deepEqual(Catalog.get('errors:kc').go, { screen: 'errorsScreen', calls: [['startErrorsRound', 'kc']] });
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
