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
        + 'this.colIsTyped = colIsTyped;'      // const, so invisible on ctx unless exposed like this
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

suite('wrong priority tabs: Grade 4 units', () => {
    test('missed words are drawn into the next Mix, and the practice is still ten', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const targets = ctx._unitPool('mix').slice(-5);           // 5 = floor(10/2)
        seed(ctx, 'units', targets.map(idOf));
        ctx.startUnitPractice('mix');
        const st = ctx.unitQuiz();
        assert.truthy(st, 'the practice did not start');
        assert.equal(st.questions.length, 10);
        const drawn = new Set(st.questions.map(q => idOf(q.w)));
        targets.forEach(w => assert.truthy(drawn.has(idOf(w)), w.en + ' was missed before but not drawn'));
    });

    test('a miss in one unit never turns up while practising another', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const units = ctx.unitsList('pre');
        const other = ctx._unitPool(units[1])[0];
        seed(ctx, 'units', [idOf(other)]);
        ctx.startUnitPractice(units[0]);
        assert.falsy(ctx.unitQuiz().questions.some(q => idOf(q.w) === idOf(other)));
    });

    test('a miss in one set never turns up in another set', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        const hk1 = ctx._unitPool('hk1-mix')[0];
        seed(ctx, 'units', [idOf(hk1)]);
        ctx.startUnitPractice('mix');                              // the 'pre' set
        assert.falsy(ctx.unitQuiz().questions.some(q => q.w.en === hk1.en && q.w.set === 'hk1'));
    });

    test('finishing a practice moves the streak; unanswered is wrong; five in a row releases', () => {
        const { ctx } = makeEnv();
        const idOf = ctx.UNITS_RETRY_CONFIG.idOf;
        ctx.startUnitPractice('mix');
        const st = ctx.unitQuiz();
        const [right, wrong, last, blank] = st.questions;
        const store = seed(ctx, 'units', []);
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

suite('wrong priority tabs: Word form', () => {
    test('missed questions are drawn first; the count and the typing share hold', () => {
        const { ctx } = makeEnv();
        const targets = ctx.wordformBank().filter(q => q.type !== 'text').slice(-5);
        seed(ctx, 'wf', targets.map(q => q.id));
        ctx.startWordformQuiz(10);
        const base = ctx.wfQuiz().questions.filter(q => !q.followup);
        assert.equal(base.length, 10, 'the practice still has the number of questions the button promised');
        const drawn = new Set(base.map(q => q.id));
        targets.forEach(q => assert.truthy(drawn.has(q.id), q.id + ' was missed before but not drawn'));
        assert.truthy(base.some(q => q.type === 'text'), 'five forced MCQs must not squeeze out every typed question');
        assert.truthy(base.every(q => !q.followup), 'no follow-up sneaks into the base list');
    });

    test('follow-ups are not tracked; base answers move the streak; unanswered is wrong', () => {
        const { ctx } = makeEnv();
        ctx.startWordformQuiz(10);
        const st = ctx.wfQuiz();
        const base = st.questions.map((q, i) => ({ q, i })).filter(x => !x.q.followup);
        const [right, wrong, last, blank] = base;
        const store = seed(ctx, 'wf', []);
        store[right.q.id] = { s: 2, w: 1, t: 0 };
        store[wrong.q.id] = { s: 2, w: 1, t: 0 };
        store[last.q.id] = { s: 4, w: 1, t: 0 };
        st.answers[right.i] = { value: 0, isCorrect: true };
        st.answers[wrong.i] = { value: 0, isCorrect: false };
        st.answers[last.i] = { value: 0, isCorrect: true };
        ctx.finishWordformQuiz();
        assert.equal(store[right.q.id].s, 3);
        assert.equal(store[wrong.q.id].s, 0);
        assert.equal(store[wrong.q.id].w, 2);
        assert.falsy(store[last.q.id], 'released after five in a row');
        assert.equal(store[blank.q.id].s, 0, 'unanswered counts as wrong');
        assert.equal(Object.keys(store).length, base.length - 1, 'only base questions are tracked (one was released)');
    });
});

suite('wrong priority tabs: Phrases', () => {
    const baseId = q => q.baseId || q.id;

    test('missed phrases are drawn first; meaning pairs and typed variants still follow', () => {
        const { ctx } = makeEnv();
        const targets = ctx.phrasesBank().slice(-5);
        seed(ctx, 'phr', targets.map(q => q.id));
        ctx.startPhrasesQuiz(10);
        const base = ctx.phrQuiz().questions.filter(q => !q.meaning);
        assert.equal(base.length, 10, 'ten phrase questions, as the button promised');
        const drawn = new Set(base.map(baseId));
        targets.forEach(q => assert.truthy(drawn.has(q.id), q.id + ' was missed before but not drawn'));
    });

    test('a typed variant records against its base; meaning questions are not tracked', () => {
        const { ctx } = makeEnv();
        ctx.startPhrasesQuiz(10);
        const st = ctx.phrQuiz();
        const base = st.questions.map((q, i) => ({ q, i })).filter(x => !x.q.meaning);
        const [right, wrong] = base;
        const store = seed(ctx, 'phr', [baseId(right.q), baseId(wrong.q)], 1);
        st.answers[right.i] = right.q.typed ? right.q.answer : right.q.correct;
        st.answers[wrong.i] = wrong.q.typed ? 'zzz' : (wrong.q.correct === 0 ? 1 : 0);
        ctx.finishPhrasesQuiz();
        assert.equal(store[baseId(right.q)].s, 2);
        assert.equal(store[baseId(wrong.q)].s, 0);
        assert.truthy(Object.keys(store).every(k => !/^p[mt]-/.test(k)),
            'no pm-/pt- ids in the store: ' + Object.keys(store).join(','));
        assert.equal(Object.keys(store).length, base.length, 'one entry per phrase question, none per meaning check');
    });
});

suite('wrong priority tabs: Collocation', () => {
    test('missed collocations are drawn first; the count holds; checks still follow', () => {
        const { ctx } = makeEnv();
        const targets = ctx.collocBank().filter(q => !ctx.colIsTyped(q)).slice(-5);
        seed(ctx, 'col', targets.map(q => q.id));
        ctx.startCollocPractice(10);
        const base = ctx.colQuiz().questions.filter(q => !q.followup);
        assert.equal(base.length, 10);
        const drawn = new Set(base.map(q => q.id));
        targets.forEach(q => assert.truthy(drawn.has(q.id), q.id + ' was missed before but not drawn'));
        assert.truthy(base.some(ctx.colIsTyped), 'five forced choice questions must not squeeze out every typed one');
    });

    test('base answers move the streak; checks are not tracked', () => {
        const { ctx } = makeEnv();
        ctx.startCollocPractice(10);
        const st = ctx.colQuiz();
        const base = st.questions.map((q, i) => ({ q, i })).filter(x => !x.q.followup);
        const [right, wrong] = base;
        const store = seed(ctx, 'col', [right.q.id, wrong.q.id], 1);
        st.answers[right.i] = { value: 0, isCorrect: true };
        st.answers[wrong.i] = { value: 0, isCorrect: false };
        ctx.finishCollocPractice();
        assert.equal(store[right.q.id].s, 2);
        assert.equal(store[wrong.q.id].s, 0);
        assert.equal(Object.keys(store).length, base.length, 'one entry per collocation, none per check');
    });
});

suite('wrong priority tabs: Rewrite', () => {
    test('missed sentences are drawn first and the practice is still ten', () => {
        const { ctx } = makeEnv();
        const targets = ctx.rewriteBank().slice(-5);
        seed(ctx, 'rw', targets.map(q => q.id));
        ctx.startRewriteQuiz(10);
        const qs = ctx.rwQuiz().questions;
        assert.equal(qs.length, 10);
        const drawn = new Set(qs.map(q => q.id));
        targets.forEach(q => assert.truthy(drawn.has(q.id), q.id + ' was missed before but not drawn'));
    });

    test("'all' still takes the whole bank", () => {
        const { ctx } = makeEnv();
        seed(ctx, 'rw', [ctx.rewriteBank()[0].id]);
        ctx.startRewriteQuiz('all');
        assert.equal(ctx.rwQuiz().questions.length, ctx.rewriteBank().length);
    });

    test('answers move the streak; unanswered is wrong', () => {
        const { ctx } = makeEnv();
        ctx.startRewriteQuiz(10);
        const st = ctx.rwQuiz();
        const [right, wrong, blank] = st.questions;
        const store = seed(ctx, 'rw', [right.id, wrong.id], 1);
        st.answers[0] = { value: 'x', isCorrect: true };
        st.answers[1] = { value: 'x', isCorrect: false };
        ctx.finishRewriteQuiz();
        assert.equal(store[right.id].s, 2);
        assert.equal(store[wrong.id].s, 0);
        assert.equal(store[blank.id].s, 0);
        assert.equal(store[blank.id].w, 1);
    });
});

suite('wrong priority tabs: Verbs', () => {
    test('missed verbs are drawn into the next game and the game is still ten', () => {
        const { ctx } = makeEnv();
        const targets = ctx.VERBS.slice(-5);
        seed(ctx, 'verbs', targets.map(v => v.v1));
        ctx.startSpeedChallenge(0);
        const drawn = ctx.speedState.currentVerbs;
        assert.equal(drawn.length, 10);
        const v1s = new Set(drawn.map(v => v.v1));
        targets.forEach(v => assert.truthy(v1s.has(v.v1), v.v1 + ' was missed before but not drawn'));
    });

    test('the level filter still applies: a level-2 miss never enters a level-1 game', () => {
        const { ctx } = makeEnv();
        const l2 = ctx.VERBS.find(v => v.level === 2);
        assert.truthy(l2, 'the bank has a level-2 verb');
        seed(ctx, 'verbs', [l2.v1]);
        ctx.startSpeedChallenge(1);
        assert.truthy(ctx.speedState.currentVerbs.length > 0);
        assert.falsy(ctx.speedState.currentVerbs.some(v => v.v1 === l2.v1));
    });

    test('a finished game moves the streak by v1', () => {
        const { ctx } = makeEnv();
        const [a, b] = ctx.VERBS;
        const store = seed(ctx, 'verbs', [a.v1, b.v1], 1);
        ctx.speedState.currentVerbs = [a, b];
        ctx.speedState.verbResults = [
            { v1: a.v1, v2: a.v2, v3: a.v3, userV2: a.v2, userV3: a.v3, correct: true, timeUsed: 1000 },
            { v1: b.v1, v2: b.v2, v3: b.v3, userV2: 'zzz', userV3: 'zzz', correct: false, timeUsed: null },
        ];
        ctx.completeSpeedChallenge();
        assert.equal(store[a.v1].s, 2);
        assert.equal(store[b.v1].s, 0);
        assert.equal(store[b.v1].w, 2);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
