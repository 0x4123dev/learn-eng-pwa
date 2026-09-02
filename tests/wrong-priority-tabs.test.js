// wrong-priority-tabs.test.js — every quiz tab plugs into the silent
// wrong-answer priority (js/wrong-priority.js): what a child missed is drawn
// into their next practice of the same pool, and what they answer in a real
// practice moves the streak. The retry drill never does.
//
// One sandbox holds the real engine, the real tab code and the real banks,
// in the order index.html loads them, like tests/retry-drill.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadAppCode } = require('./setup');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const DATA_FILES = ['vocabulary.js', 'topic-vocab.js', 'units-data.js', 'units-hk1-data.js',
    'units-hk2-data.js', 'units-posthk-data.js', 'phrases-data.js', 'phrases-meanings.js',
    'collocation-data.js', 'collocation-followups.js', 'rewrite-data.js', 'wordform-data.js',
    'wordform-followups.js'];
const ENGINE_FILES = ['answer-audio.js', 'retrydrill.js', 'wrong-priority.js'];
const TAB_FILES = ['units.js', 'wordform.js', 'phrases.js', 'collocation.js', 'rewrite.js', 'verbs.js'];

function makeEnv(state) {
    const els = {};
    const el = (id) => (els[id] || (els[id] = {
        id, style: {}, innerHTML: '', value: '', className: '', textContent: '', disabled: false, attrs: {},
        focus() {}, addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
        querySelector: () => null, querySelectorAll: () => [],
    }));
    const saves = [];
    const ctx = {
        console, Math, Date, String, Array, Object, JSON, Number, RegExp, Set, Map,
        setTimeout, clearTimeout,
        setInterval: () => 1, clearInterval() {},      // the verbs timer must not outlive a test
        module: { exports: {} },
        appState: Object.assign({ coins: 0 }, state || {}),
        currentUser: 'tester',
        saveUserData: (u, st) => saves.push(st),
        document: {
            getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('scratch'), addEventListener() {}, body: el('body'),
        },
        window: { addEventListener() {} },
        localStorage: { getItem: () => null, setItem() {} },
        showToast() {}, createConfetti() {}, recordStudy() {}, confirm: () => true,
        // verbs.js reads these from app.js, which is not loaded here.
        SPEED_TIME_LIMIT: 45000, SPEED_PENALTY_TIME: 3000, SPEED_QUESTIONS_PER_GAME: 10,
        speedState: { currentVerbs: [], currentIndex: 0, score: 0, streak: 0, bestStreakInGame: 0,
            correctCount: 0, timer: null, timeLeft: 45000, isAnswering: false, level: 0, verbResults: [] },
        shuffleArray: (a) => a.slice(),
    };
    vm.createContext(ctx);
    for (const f of DATA_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of ENGINE_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of TAB_FILES) vm.runInContext(read('js/' + f), ctx);
    // `let` state is invisible from outside the context; hand out getters.
    vm.runInContext(
        'this.unitQuiz = () => _unitQuiz; this.wfQuiz = () => _wfQuiz; this.phrQuiz = () => _phrQuiz;'
        + 'this.colQuiz = () => _colQuiz; this.rwQuiz = () => _rwQuiz;'
        + 'this.VERBS = irregularVerbs; this.UNITS_RETRY_CONFIG = UNITS_RETRY_CONFIG;', ctx);
    return { ctx, el, saves };
}

// Seed `ids` as missed-once in `key`'s slot.
function seed(ctx, key, ids, s) {
    ctx.appState.wrongPrio = ctx.appState.wrongPrio || {};
    ctx.appState.wrongPrio[key] = {};
    ids.forEach(id => { ctx.appState.wrongPrio[key][id] = { s: s || 0, w: 1, t: 0 }; });
    return ctx.appState.wrongPrio[key];
}

suite('wrong priority tabs: the sandbox', () => {
    test('every tab and every bank loads with the engine', () => {
        const { ctx } = makeEnv();
        assert.truthy(ctx.unitsBank().length, 'Grade 4 bank');
        assert.truthy(ctx.wordformBank().length, 'Word form bank');
        assert.truthy(ctx.phrasesBank().length, 'Phrases bank');
        assert.truthy(ctx.collocBank().length, 'Collocation bank');
        assert.truthy(ctx.rewriteBank().length, 'Rewrite bank');
        assert.truthy(ctx.VERBS.length, 'Verbs bank');
        assert.equal(typeof ctx.prioPick, 'function');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
