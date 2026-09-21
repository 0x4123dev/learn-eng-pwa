// wrong-priority-tabs.test.js — the Book practice plugs into the silent
// wrong-answer priority (js/wrong-priority.js): what a child missed is drawn
// into their next practice of the same pool, and what they answer in a real
// practice moves the streak. The retry drill never does.
//
// One sandbox holds the real engine, the real tab code and the real bank,
// in the order index.html loads them, like tests/retry-drill.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const DATA_FILES = ['word-data.js'];
const ENGINE_FILES = ['answer-audio.js', 'retrydrill.js', 'wrong-priority.js'];
const TAB_FILES = ['units.js'];

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
        setInterval: () => 1, clearInterval() {},
        module: { exports: {} },
        appState: Object.assign({ coins: 0, unitsHistory: [] }, state || {}),
        currentUser: 'tester',
        saveUserData: (u, st) => saves.push(st),
        document: {
            getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('scratch'), addEventListener() {}, body: el('body'),
        },
        window: { addEventListener() {} },
        localStorage: { getItem: () => null, setItem() {} },
        showToast() {}, createConfetti() {}, recordStudy() {}, confirm: () => true,
        shuffleArray: (a) => a.slice(),
    };
    vm.createContext(ctx);
    for (const f of DATA_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of ENGINE_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of TAB_FILES) vm.runInContext(read('js/' + f), ctx);
    // `let` state is invisible from outside the context; hand out getters.
    vm.runInContext(
        'this.unitQuiz = () => _unitQuiz;'
        + 'this.UNITS_RETRY_CONFIG = UNITS_RETRY_CONFIG;', ctx);
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
    test('the tab and its bank load with the engine', () => {
        const { ctx } = makeEnv();
        for (const s of ['pr1', 'pr2', 'pr3']) assert.truthy(ctx.unitsBank(s).length, s + ' bank');
        assert.equal(typeof ctx.prioPick, 'function');
        assert.equal(ctx.unitsRetryKey(), 'word', 'the Book practice draws through the word slot');
    });
});

suite('wrong priority tabs: the Book practice', () => {
    test('missed words are drawn into the next Mix, and the practice is still ten', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const targets = ctx._unitPool('pr1-mix').slice(-5);           // 5 = floor(10/2)
        seed(ctx, 'word', targets.map(idOf));
        ctx.startUnitPractice('pr1-mix');
        const st = ctx.unitQuiz();
        assert.truthy(st, 'the practice did not start');
        assert.equal(st.questions.length, 10);
        const drawn = new Set(st.questions.map(q => idOf(q.w)));
        targets.forEach(w => assert.truthy(drawn.has(idOf(w)), w.en + ' was missed before but not drawn'));
    });

    test('a miss in one unit never turns up while practising another', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const other = ctx._unitPool('pr1-2')[0];
        seed(ctx, 'word', [idOf(other)]);
        ctx.startUnitPractice('pr1-1');
        assert.falsy(ctx.unitQuiz().questions.some(q => idOf(q.w) === idOf(other)));
    });

    test('a miss in one book never turns up in another book', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const b2 = ctx._unitPool('pr2-mix')[0];
        seed(ctx, 'word', [idOf(b2)]);
        ctx.startUnitPractice('pr1-mix');
        assert.falsy(ctx.unitQuiz().questions.some(q => q.w.en === b2.en && q.w.set === 'pr2'));
    });

    test('finishing a practice moves the streak; unanswered is wrong; five in a row releases', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        ctx.startUnitPractice('pr1-mix');
        const st = ctx.unitQuiz();
        const [right, wrong, last, blank] = st.questions;
        const store = seed(ctx, 'word', []);
        store[idOf(right.w)] = { s: 2, w: 1, t: 0 };
        store[idOf(wrong.w)] = { s: 2, w: 1, t: 0 };
        store[idOf(last.w)] = { s: 4, w: 1, t: 0 };
        st.answers[0] = { value: right.w.en, isCorrect: true };
        st.answers[1] = { value: 'zzz', isCorrect: false };
        st.answers[2] = { value: last.w.en, isCorrect: true };
        ctx.finishUnitPractice();
        assert.equal(store[idOf(right.w)].s, 3, 'a right answer in a real practice counts');
        assert.equal(store[idOf(wrong.w)].s, 0, 'a wrong answer resets the streak');
        assert.equal(store[idOf(wrong.w)].w, 2);
        assert.falsy(store[idOf(last.w)], 'the fifth right answer in a row releases the word');
        assert.equal(store[idOf(blank.w)].s, 0, 'an unanswered word is a missed word, as it is for the owed drill');
        assert.equal(store[idOf(blank.w)].w, 1);
    });
});

suite('wrong priority tabs: the owed-back drill is separate', () => {
    test('a right retype clears the debt but never moves the streak', () => {
        const { ctx, el } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const w = ctx.unitsBank('pr1')[0];
        const store = seed(ctx, 'word', [idOf(w)], 2);
        ctx.retryAdd('word', [w]);
        ctx.startRetryDrill('word');
        assert.truthy(ctx.isRetryDrillActive());
        el('retryInput').value = String(ctx.retryCfg('word').answerText(w));
        ctx.submitRetryAnswer();
        assert.equal(ctx.retryCount('word'), 0, 'the debt is cleared by a right retype');
        assert.equal(store[idOf(w)].s, 2, 'but the priority streak is untouched: only real practices count');
    });

    test('a wrong retype does not count either', () => {
        const { ctx, el } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const w = ctx.unitsBank('pr1')[0];
        const store = seed(ctx, 'word', [idOf(w)], 2);
        ctx.retryAdd('word', [w]);
        ctx.startRetryDrill('word');
        el('retryInput').value = 'zzz';
        ctx.submitRetryAnswer();
        assert.equal(store[idOf(w)].s, 2);
        assert.equal(store[idOf(w)].w, 1);
    });

    test('the engine is never called from the drill', () => {
        assert.falsy(/prioRecord|prioPick|prioForced/.test(read('js/retrydrill.js')));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
