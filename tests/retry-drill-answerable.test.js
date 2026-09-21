// retry-drill-answerable.test.js — the owed drill must ask a question the
// child can actually answer, and show it in full.
//
// The gate is hard on purpose: no new practice opens until the debt is
// cleared. That is only fair while every owed item is (a) answerable at all
// and (b) put on screen complete. Both have failed before in tabs that no
// longer exist: a Phrases meaning check was owed back although its answer
// could not be typed into the drill's one text box, and the Collocation drill
// rendered the original sentence with no blank while grading the transformed
// one. The one practice left — the Book practice (js/units.js, drill key
// 'word') — is held to the same rule here, for EVERY word of every book.
//
// Everything below EXECUTES the shipped code — the real engine, the real tab
// config and the real bank in one sandbox, in the order index.html loads
// them, like tests/retry-drill.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const DATA_FILES = ['word-data.js'];
const ENGINE_FILES = ['answer-audio.js', 'retrydrill.js', 'wrong-priority.js'];
const TAB_FILES = ['units.js'];

function makeEnv() {
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
        setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
        module: { exports: {} },
        appState: { coins: 0, unitsHistory: [] },
        currentUser: 'tester',
        saveUserData: (u, st) => saves.push(st),
        document: {
            getElementById: el, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => el('scratch'), addEventListener() {}, body: el('body'),
        },
        window: { addEventListener() {} },
        localStorage: { getItem: () => null, setItem() {} },
        showToast(m) { ctx.lastToast = m; }, createConfetti() {}, recordStudy() {}, confirm: () => true,
    };
    vm.createContext(ctx);
    for (const f of DATA_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of ENGINE_FILES) vm.runInContext(read('js/' + f), ctx);
    for (const f of TAB_FILES) vm.runInContext(read('js/' + f), ctx);
    // `let`/`const` at the top level of a vm context are invisible from
    // outside it; hand out the getters (and the one setter) the tests need.
    vm.runInContext('this.CFG = RETRY_DRILLS; this.drill = () => _retryDrill;'
        + 'this.unitQuiz = () => _unitQuiz;'
        + 'this.setUnitQuiz = (v) => { _unitQuiz = v; };', ctx);
    return { ctx, el, saves };
}

const SETS = ['pr1', 'pr2', 'pr3'];
const allWords = (ctx) => SETS.reduce((all, s) => all.concat(ctx.unitsBank(s)), []);

// Play a whole Book practice, getting every single question wrong.
function answerEverythingWrong(ctx, el) {
    let guard = 0;
    while (ctx.isUnitPracticeActive() && guard++ < 200) {
        el('unitTextInput').value = 'zzzqqq';
        ctx.submitUnitAnswer();
        ctx.nextUnitQuestion();
    }
    assert.falsy(ctx.isUnitPracticeActive(), 'the practice never finished');
}

suite('owed drill: the Book practice owes only what can be typed back', () => {
    test('the sandbox holds the real bank and the one drill', () => {
        const { ctx } = makeEnv();
        for (const s of SETS) assert.truthy(ctx.unitsBank(s).length, s + ' bank');
        assert.deepEqual(Object.keys(ctx.CFG), ['word'], 'the Book drill, and only it');
    });

    test('a practice with every answer wrong owes back every word asked', () => {
        const { ctx, el } = makeEnv();
        ctx.startUnitPractice('pr2-4');
        const asked = ctx.unitQuiz().questions.map(q => q.w);
        assert.equal(asked.length, 10, 'a practice is ten words');

        answerEverythingWrong(ctx, el);

        const owed = ctx.appState.wordRetry || [];
        assert.deepEqual(owed.slice().sort(), asked.map(w => 'pr2|' + w.en).sort(),
            'one debt per word asked, each carrying its book');
    });

    test('every owed word accepts its own revealed answer', () => {
        // The 👁 button is the escape hatch that makes a persisted gate fair.
        // An item whose revealed answer the grader rejects is a locked door.
        const { ctx, el } = makeEnv();
        ctx.startUnitPractice('pr3-mix');
        answerEverythingWrong(ctx, el);

        const owed = ctx.retryList('word');
        assert.equal(owed.length, 10, 'nothing owed');
        owed.forEach(item => {
            assert.truthy(ctx.CFG.word.grade(String(ctx.CFG.word.answerText(item)), item),
                item.en + ': the drill refuses the very answer it reveals');
        });
    });

    test('every word of every book accepts its revealed answer — none can ever lock the tab', () => {
        const { ctx } = makeEnv();
        for (const w of allWords(ctx)) {
            const shown = String(ctx.CFG.word.answerText(w));
            assert.truthy(shown.length, w.en + ': nothing to reveal');
            assert.truthy(ctx.CFG.word.grade(shown, w), w.en + ': the revealed answer is graded wrong');
            assert.falsy(ctx.CFG.word.grade('zzzqqq', w), w.en + ': junk was graded right');
        }
    });

    test('the debt can be cleared by typing the answers, and then practice reopens', () => {
        const { ctx, el } = makeEnv();
        ctx.startUnitPractice('pr1-6');
        answerEverythingWrong(ctx, el);

        // The gate takes over the next attempt at a practice.
        ctx.startUnitPractice('pr1-7');
        assert.truthy(ctx.isRetryDrillActive(), 'the debt did not gate the next practice');
        assert.falsy(ctx.isUnitPracticeActive(), 'a practice started while a debt was owed');

        let guard = 0;
        while (ctx.isRetryDrillActive() && guard++ < 400) {
            const st = ctx.drill();
            if (!st.answered) {
                const item = st.queue[st.idx % st.queue.length];
                el('retryInput').value = String(ctx.CFG.word.answerText(item));
                ctx.submitRetryAnswer();
            }
            ctx.nextRetryQuestion();
        }
        assert.equal(ctx.retryCount('word'), 0,
            'typing every revealed answer did not clear the debt — the tab is locked');

        ctx.startUnitPractice('pr1-7');
        assert.truthy(ctx.isUnitPracticeActive(), 'practice never reopened after the debt was paid');
        assert.equal(ctx.unitQuiz().unit, 'pr1-7');
    });

    test('a debt persisted by an older build (a bare word, no book) still resolves, and a dropped word is ignored', () => {
        const { ctx } = makeEnv();
        const w = ctx.unitsBank('pr2')[0];
        ctx.appState.wordRetry = [w.en, 'pr1|no-such-word', 'no-such-word'];
        assert.equal(ctx.retryCount('word'), 1, 'the bare word is still owed; the unknown ones are not');
        assert.equal(ctx.retryList('word')[0].en, w.en);
    });
});

suite('owed drill: the Book drill shows the question it grades', () => {
    const drillPrompt = (ctx, w) => ctx.CFG.word.promptHTML(w);
    // Render one question through the LIVE practice, exactly as the child sees it.
    function livePrompt(ctx, el, w) {
        ctx.setUnitQuiz({ unit: w.set + '-' + w.unit, questions: [{ w, mode: 'full', gap: ctx.buildUnitGap(w.en, 'full') }], idx: 0, answers: [null] });
        ctx.renderUnitQuestion();
        const html = el('wordDetail').innerHTML;
        ctx.setUnitQuiz(null);
        return html;
    }

    test('every owed word is shown with its picture and its meaning', () => {
        const { ctx } = makeEnv();
        for (const w of allWords(ctx)) {
            const html = drillPrompt(ctx, w);
            assert.truthy(html.includes(w.emoji), w.en + ': the drill drops the picture');
            assert.truthy(html.includes(ctx.unitEsc(w.vi)), w.en + ': the drill drops the meaning');
            assert.falsy(html.includes(w.en), w.en + ': the drill gives the answer away in the prompt');
        }
    });

    test('the drill and the live practice put the same facts on screen', () => {
        const { ctx, el } = makeEnv();
        for (const set of SETS) {
            const w = ctx.unitsBank(set)[3];
            const live = livePrompt(ctx, el, w);
            const drill = drillPrompt(ctx, w);
            for (const fact of [w.emoji, ctx.unitEsc(w.vi)]) {
                assert.truthy(live.includes(fact) && drill.includes(fact), w.en + ': a fact is on only one screen');
            }
        }
    });

    test('the drill offers the word aloud, as the live practice does', () => {
        const { ctx } = makeEnv();
        const w = ctx.unitsBank('pr1')[0];
        assert.truthy(/unit-say-btn/.test(ctx.CFG.word.sayHTML(w)), 'a 🔊 button');
        ctx.retryAdd('word', [w]);
        ctx.startRetryDrill('word');
        const html = ctx.document.getElementById('wordDetail').innerHTML;
        assert.truthy(html.includes('unit-say-btn'), 'the 🔊 button is on the drill screen');
        assert.truthy(html.includes('id="retryInput"'), 'with the one text box');
    });

    test('every value the drill interpolates is still escaped', () => {
        const { ctx } = makeEnv();
        const html = drillPrompt(ctx, { set: 'pr1', unit: 1, en: 'x', emoji: '🧪', vi: 'A <b>bold</b> & "quoted" meaning' });
        assert.truthy(html.includes('&lt;b&gt;bold&lt;/b&gt;'), 'vi was not escaped');
        assert.falsy(html.includes('<b>bold</b>'), 'raw markup from the bank reached the page');
        assert.truthy(html.includes('&amp;'), 'an ampersand was not escaped');
        assert.truthy(/onclick="_unitSpeak\('it\\'s'\)"/.test(ctx.CFG.word.sayHTML({ en: "it's" })),
            'a quote in the word is escaped for the inline handler');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
