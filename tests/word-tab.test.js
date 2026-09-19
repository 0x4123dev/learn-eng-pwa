// word-tab.test.js — the Word tab: Career Paths · Public Relations on the
// Grade 4 picture-dictionary engine, on its own bottom-bar screen.
//
// Three promises. (1) The bank IS the book: three books, fifteen units each,
// every unit file valid, and js/word-data.js exactly what the build script
// makes of them — a hand edit to the generated file, or a unit file that never
// made it into the build, shows up here. (2) The engine keeps its two hosts
// apart: a Word practice draws on the Word screen, owes its words on the Word
// queue, and lands in the Word history — never on Grade 4's, and vice versa.
// (3) The tab is wired: nav button, screen pieces, lazy loader, precache.
const { suite, test, assert, runAll } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./setup');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const { validateFile } = require(path.join(ROOT, 'scripts', 'validate-word-data.js'));
const wordData = require(path.join(ROOT, 'js', 'word-data.js'));
const { UNIT_PR_TITLES, UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3 } = wordData;
const DATA_DIR = path.join(ROOT, 'data', 'career-paths');
const unitFiles = fs.readdirSync(DATA_DIR).filter(f => /^pr[123]-u\d\d\.json$/.test(f)).sort();

// ---- an engine sandbox with both hosts' DOM pieces and a real retry engine ----
function loadEngine() {
    const sandbox = buildSandbox();
    sandbox.appState = { coins: 0, unitsHistory: [] };
    sandbox.currentUser = 'kid';
    sandbox.saveUserData = () => {};
    sandbox.showToast = () => {};
    const ctx = vm.createContext(sandbox);
    const files = ['js/units-data.js', 'js/units-hk1-data.js', 'js/units-hk2-data.js', 'js/units-posthk-data.js',
        'js/word-data.js', 'js/wrong-priority.js', 'js/retrydrill.js', 'js/answer-audio.js', 'js/units.js'];
    let src = files.map(f => `\n//===== ${f} =====\n` + read(f)).join('');
    src += `
globalThis.__x = { UNIT_SETS, UNIT_HOSTS, unitHostSets, unitHostOfSet, unitCurrentHost, unitPracticeScreen,
  currentUnitSet, switchUnitSet, renderGrade4Home, renderWordHome, renderUnitsBar, renderUnitSetTabsHTML,
  startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice, quitUnitPractice, isUnitPracticeActive,
  unitsRetryCount, unitsRetryKey, unitsHostHistory, unitsList, unitsBank, _unitPool, _unitParse, _unitLabel,
  unitTitle, RETRY_DRILLS, retryList, unitsForgetProfile,
  quiz: () => _unitQuiz, setQuiz: (q) => { _unitQuiz = q; } };`;
    vm.runInContext(src, ctx, { filename: 'word-tab-engine.js' });
    return { sb: sandbox, x: sandbox.__x, html: id => sandbox.document.__getLastInnerHTML(id) || '' };
}

suite('word tab: the bank is the book', () => {
    test('45 unit files: three books × fifteen units, each valid', () => {
        assert.equal(unitFiles.length, 45, 'unit files: ' + unitFiles.join(', '));
        for (const b of [1, 2, 3]) {
            for (let u = 1; u <= 15; u++) {
                const f = `pr${b}-u${String(u).padStart(2, '0')}.json`;
                assert.truthy(unitFiles.includes(f), 'missing ' + f);
                const problems = validateFile(path.join(DATA_DIR, f));
                assert.deepEqual(problems, [], f + ': ' + problems.join('; '));
            }
        }
    });

    test('js/word-data.js is exactly what scripts/build-word-data.js writes from data/career-paths', () => {
        // Build into a scratch file and compare, so a stale generated file or a
        // hand edit is caught without touching the tree.
        const { build } = require(path.join(ROOT, 'scripts', 'build-word-data.js'));
        const tmp = path.join(require('os').tmpdir(), 'word-data.' + process.pid + '.js');
        const log = console.log; console.log = () => {};
        let code;
        try { code = build(tmp); } finally { console.log = log; }
        assert.equal(code, 0, 'the build must succeed');
        const fresh = fs.readFileSync(tmp, 'utf8');
        fs.unlinkSync(tmp);
        assert.truthy(fresh === read('js/word-data.js'),
            'js/word-data.js is stale or hand-edited — run node scripts/build-word-data.js');
    });

    test('each book carries every unit and only the words its files list', () => {
        const banks = { 1: UNIT_WORDS_PR1, 2: UNIT_WORDS_PR2, 3: UNIT_WORDS_PR3 };
        for (const b of [1, 2, 3]) {
            const units = new Set(banks[b].map(w => w.unit));
            assert.equal(units.size, 15, 'book ' + b + ' has 15 units in the bank');
            assert.equal(Object.keys(UNIT_PR_TITLES['pr' + b]).length, 15, 'book ' + b + ' has 15 titles');
            let expected = 0;
            for (let u = 1; u <= 15; u++) {
                const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `pr${b}-u${String(u).padStart(2, '0')}.json`), 'utf8'));
                expected += doc.words.length;
                assert.equal(UNIT_PR_TITLES['pr' + b][u], doc.title, `book ${b} unit ${u} title`);
                const inBank = banks[b].filter(w => w.unit === u).map(w => w.en);
                assert.deepEqual(inBank, doc.words.map(w => w.en), `book ${b} unit ${u} words, in order`);
            }
            assert.equal(banks[b].length, expected, 'book ' + b + ' word count');
            assert.truthy(banks[b].every(w => w.book === b), 'every word of book ' + b + ' says so');
            const seen = new Set();
            for (const w of banks[b]) {
                assert.truthy(!seen.has(w.en.toLowerCase()), `book ${b}: "${w.en}" listed twice`);
                seen.add(w.en.toLowerCase());
            }
        }
        assert.truthy(UNIT_WORDS_PR1.length + UNIT_WORDS_PR2.length + UNIT_WORDS_PR3.length >= 500,
            'the three books are a real bank, not a stub');
    });

    test('every word can be drawn as a question: a picture, a Vietnamese meaning, letters to blank', () => {
        for (const w of [].concat(UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3)) {
            assert.truthy(/[A-Za-z]/.test(w.en), w.en + ': has letters to blank');
            assert.truthy(!/^[0-9:]+$/.test(w.emoji), w.en + ': emoji is a picture, not a number card');
            assert.truthy(w.vi && w.vi.length >= 3, w.en + ': has a meaning');
        }
    });
});

suite('word tab: two hosts, one engine', () => {
    test('the seven sets split by host: four for Grade 4, three books for Word', () => {
        const { x } = loadEngine();
        assert.deepEqual(x.unitHostSets('grade4').map(s => s.id), ['pre', 'posthk', 'hk1', 'hk2']);
        assert.deepEqual(x.unitHostSets('word').map(s => s.id), ['pr1', 'pr2', 'pr3']);
        assert.equal(x.unitHostOfSet('pr2'), 'word');
        assert.equal(x.unitHostOfSet('hk2'), 'grade4');
        for (const s of ['pr1', 'pr2', 'pr3']) {
            assert.equal(x.unitsList(s).length, 15, s + ' lists 15 units');
            assert.truthy(x.unitsBank(s).length > 100, s + ' bank loaded');
            assert.truthy(x.unitsBank(s).every(w => w.set === s), s + ' words are tagged with their set');
        }
    });

    test('unit keys: pr2-7 and pr3-mix parse to their set; labels name the book', () => {
        const { x } = loadEngine();
        assert.deepEqual(x._unitParse('pr2-7'), { set: 'pr2', unit: 7 });
        assert.deepEqual(x._unitParse('pr3-mix'), { set: 'pr3', unit: 'mix' });
        assert.deepEqual(x._unitParse('hk1-3'), { set: 'hk1', unit: 3 });
        assert.equal(x._unitPool('pr2-7').length, UNIT_WORDS_PR2.filter(w => w.unit === 7).length);
        assert.equal(x._unitPool('pr3-mix').length, UNIT_WORDS_PR3.length);
        assert.equal(x._unitLabel('pr2-7'), 'Book 2 · Unit 7');
        assert.equal(x._unitLabel('pr1-mix'), 'Book 1 · 🎲 Mix');
        assert.equal(x.unitTitle('pr1', 1), UNIT_PR_TITLES.pr1[1]);
    });

    test('each host remembers its own set: Word defaults to Book 1, Grade 4 to HK1', () => {
        const { x, sb } = loadEngine();
        assert.equal(x.currentUnitSet('grade4'), 'hk1');
        assert.equal(x.currentUnitSet('word'), 'pr1');
        x.switchUnitSet('pr3');
        assert.equal(sb.appState.wordSet, 'pr3', 'the Word choice is stored under its own key');
        assert.equal(sb.appState.unitsSet, undefined, 'and does not touch Grade 4\'s');
        assert.equal(x.currentUnitSet('word'), 'pr3');
        assert.equal(x.currentUnitSet('grade4'), 'hk1');
        // A Grade 4 key stored under the Word slot (or vice versa) is ignored.
        sb.appState.wordSet = 'hk2';
        assert.equal(x.currentUnitSet('word'), 'pr1', 'a foreign set id falls back to the host default');
    });

    test('the Word home draws on the Word pieces, with only the three Book tabs', () => {
        const { x, html } = loadEngine();
        x.renderWordHome();
        assert.equal(x.unitCurrentHost(), 'word');
        const bar = html('wordUnitsBar');
        assert.truthy(bar.includes('g4-grid'), 'unit cards drawn on #wordUnitsBar');
        assert.equal((bar.match(/startUnitPractice\('pr1-\d+'\)/g) || []).length, 15, 'fifteen unit cards for Book 1');
        assert.truthy(bar.includes("startUnitPractice('pr1-mix')"), 'and a Mix card');
        assert.truthy(bar.includes("switchUnitSet('pr1')") && bar.includes("switchUnitSet('pr3')"), 'Book tabs');
        assert.truthy(!bar.includes("switchUnitSet('hk1')"), 'no Grade 4 tab on the Word screen');
        assert.truthy(bar.includes(UNIT_PR_TITLES.pr1[1]), 'unit titles come from the bank');
        assert.truthy(html('wordSubTabs').includes("renderWordHome('history')"), 'the history sub-tab goes to the Word home');
        assert.equal(html('unitsBar'), '', 'nothing drawn on the Grade 4 bar');
        // And the other way round.
        x.renderGrade4Home();
        assert.equal(x.unitCurrentHost(), 'grade4');
        assert.truthy(!html('unitsBar').includes("switchUnitSet('pr1')"), 'no Book tab on the Grade 4 screen');
    });

    test('a Word practice belongs to the Word screen and lands in the Word history', () => {
        const { x, sb, html } = loadEngine();
        x.startUnitPractice('pr1-1');
        const st = x.quiz();
        assert.truthy(st, 'practice started');
        assert.equal(x.unitCurrentHost(), 'word');
        assert.equal(x.unitPracticeScreen(), 'wordScreen', 'the leave guard is told the Word screen');
        assert.truthy(html('wordDetail').includes('unitTextInput'), 'the question is drawn in #wordDetail');
        assert.equal(html('grade4Detail'), '', 'not in #grade4Detail');
        assert.truthy(st.questions.every(q => q.w.set === 'pr1' && q.w.unit === 1), 'only Book 1 Unit 1 words');
        // Answer the first right, the rest wrong.
        sb.document.getElementById('unitTextInput').value = st.questions[0].w.en;
        x.submitUnitAnswer();
        assert.equal(st.answers[0].isCorrect, true);
        for (let i = 1; i < st.questions.length; i++) {
            x.nextUnitQuestion();
            sb.document.getElementById('unitTextInput').value = 'zzzz';
            x.submitUnitAnswer();
        }
        x.finishUnitPractice();
        assert.equal(sb.appState.unitsHistory.length, 1, 'one history row');
        const row = sb.appState.unitsHistory[0];
        assert.equal(row.unit, 'pr1-1');
        assert.equal(row.score, 1);
        assert.equal(row.total, st.questions.length);
        assert.equal(sb.appState.coins, 5, 'five coins for the one right answer');
        assert.truthy(row.skills.every(s => s.skillKey.startsWith('word.unit.pr1.1.')), 'skill keys are the Word tab\'s: ' + row.skills.map(s => s.skillKey));
        assert.equal(x.unitsHostHistory('word').length, 1, 'the row is the Word host\'s');
        assert.equal(x.unitsHostHistory('grade4').length, 0, 'and not Grade 4\'s');
        assert.truthy(html('wordDetail').includes('renderWordHome()'), 'the results screen goes back to the Word home');
    });

    test('missed Word words are owed on the Word queue and gate only the Word tab', () => {
        const { x, sb, html } = loadEngine();
        assert.truthy(x.RETRY_DRILLS.units && x.RETRY_DRILLS.word, 'both hosts register a drill');
        assert.equal(x.RETRY_DRILLS.word.screenId, 'wordDetail');
        assert.equal(x.RETRY_DRILLS.units.screenId, 'grade4Detail');
        x.startUnitPractice('pr2-3');
        const st = x.quiz();
        for (let i = 0; i < st.questions.length; i++) {
            if (i) x.nextUnitQuestion();
            sb.document.getElementById('unitTextInput').value = 'zzzz';
            x.submitUnitAnswer();
        }
        x.finishUnitPractice();
        assert.equal(x.unitsRetryCount('word'), st.questions.length, 'every miss owed on the Word queue');
        assert.equal(x.unitsRetryCount('units'), 0, 'nothing owed on the Grade 4 queue');
        assert.truthy(sb.appState.wordRetry.every(id => /^pr2\|/.test(id)), 'owed ids carry their set: ' + sb.appState.wordRetry[0]);
        // The Word cards lock; Grade 4's do not.
        x.renderWordHome();
        assert.truthy(html('wordUnitsBar').includes('locked'), 'Word cards are locked while words are owed');
        x.renderGrade4Home();
        assert.truthy(!html('unitsBar').includes('g4-card locked') && !html('unitsBar').includes('g4-card mastered locked'),
            'Grade 4 cards stay open');
        // Starting a new Word practice is refused and the drill opens instead.
        x.startUnitPractice('pr2-4');
        assert.equal(x.quiz(), null, 'no new practice while words are owed');
        assert.truthy(x.retryList('word').length > 0, 'the owed words resolve back to real words');
        assert.equal(x.retryList('word')[0].set, 'pr2', 'to the Book 2 word that was missed');
    });

    test('a Grade 4 practice still draws on Grade 4 and owes on the Grade 4 queue', () => {
        const { x, sb, html } = loadEngine();
        x.startUnitPractice('hk1-1');
        assert.equal(x.unitPracticeScreen(), 'gradeFourScreen');
        assert.truthy(html('grade4Detail').includes('unitTextInput'));
        assert.equal(html('wordDetail'), '');
        const st = x.quiz();
        sb.document.getElementById('unitTextInput').value = 'zzzz';
        x.submitUnitAnswer();
        st.idx = st.questions.length - 1; st.answers.fill({ value: 'zzzz', isCorrect: false });
        x.finishUnitPractice();
        assert.truthy(x.unitsRetryCount('units') > 0, 'owed on the Grade 4 queue');
        assert.equal(x.unitsRetryCount('word'), 0, 'not on the Word queue');
        assert.truthy(sb.appState.unitsHistory[0].skills[0].skillKey.startsWith('grade4.unit.'), 'Grade 4 skill keys unchanged');
    });

    test('a profile change forgets both hosts\' set choices', () => {
        const { x, sb } = loadEngine();
        x.switchUnitSet('pr2');
        sb.appState = null;   // no state: the fallback is what a fresh profile would see
        assert.equal(x.currentUnitSet('word'), 'pr2', 'the fallback remembers the choice…');
        x.unitsForgetProfile();
        assert.equal(x.currentUnitSet('word'), 'pr1', '…until the profile changes');
    });
});

suite('word tab: a practice interrupted and brought back', () => {
    // The study checkpoint (js/app.js) used to write every units practice as
    // gradeFourScreen. A Word practice restored that way came back on the
    // Grade 4 screen and, on finish, was scored under Grade 4's skill keys and
    // owed to Grade 4's queue. Run it for real: interrupt, "reload", restore.
    const { mountApp, loginTestUser } = require('./verify/client.js');
    const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
    const tick = () => new Promise((r) => setImmediate(r));
    const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

    test('a Word practice restored from the checkpoint lands on the Word screen and scores as Word', async () => {
        const h = mountApp();
        assert.deepEqual(h.loadErrors, [], 'the app must boot cleanly');
        loginTestUser(h, { coins: 100 });
        h.sandbox.startStudyCheckpointing();
        h.sandbox.switchScreen('wordScreen');
        await settle();
        h.sandbox.startUnitPractice('pr1-2');
        const st = h.peek('_unitQuiz');
        assert.truthy(st, 'practice started');
        h.el('unitTextInput').value = st.questions[0].w.en;
        h.sandbox.submitUnitAnswer();
        h.sandbox.nextUnitQuestion();
        const saved = JSON.parse(h.store[CHECKPOINT_KEY]);
        assert.equal(saved.kind, 'units');
        assert.equal(saved.screen, 'wordScreen', 'the checkpoint names the Word screen');
        // "reload"
        const h2 = mountApp({ storage: Object.assign({}, h.store) });
        h2.sandbox.startStudyCheckpointing();
        h2.sandbox.loginUser('BeNa');
        assert.equal(h2.sandbox.restoreStudyCheckpoint(), false, 'waits for the lazy Word bank first');
        await settle(12);
        assert.truthy(h2.sandbox.isUnitPracticeActive(), 'the round came back');
        assert.truthy(h2.el('wordScreen').classList.contains('active'), 'on the Word screen');
        assert.truthy(!h2.el('gradeFourScreen').classList.contains('active'), 'not on Grade 4');
        assert.equal(h2.sandbox.unitPracticeScreen(), 'wordScreen');
        assert.equal(h2.sandbox.unitCurrentHost(), 'word');
        assert.truthy(h2.el('wordDetail').querySelector('#unitTextInput'), 'the question is drawn in #wordDetail');
        assert.equal(h2.peek('_unitQuiz').idx, 1, 'on the second question, as left');
        // Leaving asks — and the Word drill/practice guard sends the child back to wordScreen on Cancel.
        h2.sandbox.__confirmAnswer = false;
        assert.equal(h2.sandbox.switchScreen('homeScreen'), false, 'the bottom bar asks before leaving');
        assert.truthy(h2.sandbox.isUnitPracticeActive(), 'Cancel keeps the round');
        // Finish the rest wrong: scored as Word, owed to Word.
        const q = h2.peek('_unitQuiz');
        for (let i = q.idx; i < q.questions.length; i++) {
            if (i > q.idx) h2.sandbox.nextUnitQuestion();
            h2.el('unitTextInput').value = 'zzzz';
            h2.sandbox.submitUnitAnswer();
        }
        h2.sandbox.finishUnitPractice();
        const app = h2.peek('appState');
        assert.equal(String(app.unitsHistory[0].unit), 'pr1-2');
        assert.truthy(app.unitsHistory[0].skills.every(k => k.skillKey.startsWith('word.unit.')), 'scored under the Word skill keys');
        assert.truthy(h2.sandbox.unitsRetryCount('word') > 0, 'owed on the Word queue');
        assert.equal(h2.sandbox.unitsRetryCount('units'), 0, 'not on the Grade 4 queue');
        assert.equal(h2.store[CHECKPOINT_KEY], undefined, 'finished → the checkpoint is gone');
    });
});

suite('word tab: wired into the app', () => {
    const html = read('index.html');
    const lazy = read('js/lazy-data.js');
    const sw = read('sw.js');

    test('the bottom bar has a Word button where Exam used to be, and no Exam', () => {
        const keys = [...html.matchAll(/data-nav-key="([a-z]+)"/g)].map(m => m[1]);
        assert.deepEqual(keys, ['home', 'learn', 'arena', 'math', 'word']);
        assert.truthy(/data-nav-key="word"[^>]*onclick="switchScreen\('wordScreen'\)"/.test(html), 'the button opens wordScreen');
        assert.truthy(!html.includes('id="examScreen"'), 'the Exam screen is gone');
        assert.truthy(!fs.existsSync(path.join(ROOT, 'js', 'exam-data.js')), 'the HCMC bank is gone');
    });

    test('the Word screen carries the four pieces the engine draws into', () => {
        assert.truthy(html.includes('id="wordScreen"'));
        for (const id of ['wordSubTabs', 'wordUnitsBar', 'wordHistory', 'wordDetail']) {
            assert.truthy(html.includes(`id="${id}"`), 'missing #' + id);
        }
        assert.truthy(/id="wordScreen"[^>]*/.test(html) && /class="screen[^"]*grade4-screen[^"]*"\s+id="wordScreen"/.test(html),
            'it is styled like the Grade 4 screen (css/math.css)');
    });

    test('the bank is lazy, styled, precached, and never on the startup path', () => {
        assert.truthy(/wordScreen:\s*\[[^\]]*'css\/math\.css'[^\]]*'js\/word-data\.js'/.test(lazy), 'SCREEN_FILES.wordScreen lists the sheet and the bank');
        assert.truthy(!/<script src="js\/word-data\.js">/.test(html), 'js/word-data.js must not be a startup <script>');
        assert.truthy(/'\/js\/word-data\.js':\s*'[0-9a-f]{16}'/.test(sw), 'sw.js PRECACHE lists /js/word-data.js');
        assert.truthy(!sw.includes('/js/exam-data.js') && !sw.includes('/js/exam-lessons.js'), 'the old bank left the precache');
        assert.truthy(!lazy.includes('examScreen'), 'the loader no longer knows examScreen');
    });

    test('js/app.js paints the Word home after the lazy bank lands and guards its practice', () => {
        const app = read('js/app.js');
        assert.truthy(/screenId === 'wordScreen' && typeof renderWordHome === 'function'\) renderWordHome\(\)/.test(app));
        assert.truthy(/wordScreen:\s*'word'/.test(app), 'wordScreen maps to the word nav key');
        assert.truthy(app.includes('unitPracticeScreen()'), 'the leave guard asks the engine which screen the practice is on');
        assert.truthy(!app.includes("'examScreen'"), 'no examScreen left in app.js');
    });

    test('the home screen counts Word rows as their own skill, apart from Grade 4', () => {
        const home = read('js/home.js');
        assert.truthy(/key: 'word', label: 'Word'/.test(home));
        assert.truthy(/word: \['wordScreen', 'renderWordHome'\]/.test(home), 'the skill row deep-links to the Word tab');
        assert.truthy(!/key: 'exam'/.test(home), 'the Exam skill is gone');
    });

    test('generated-file discipline: CLAUDE.md names the build and validate commands', () => {
        const md = read('CLAUDE.md');
        assert.truthy(md.includes('scripts/build-word-data.js'), 'CLAUDE.md lists node scripts/build-word-data.js');
        assert.truthy(md.includes('scripts/validate-word-data.js'), 'CLAUDE.md lists the validator');
    });
});

if (require.main === module) {
    runAll().then(code => process.exit(code));
}
