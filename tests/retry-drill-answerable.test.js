// retry-drill-answerable.test.js — the owed drill must ask a question the
// child can actually answer, and show it in full.
//
// The gate is hard on purpose: no new practice opens until the debt is
// cleared. That is only fair while every owed item is (a) answerable at all
// and (b) put on screen complete. Two ways it stopped being fair, both of
// which shipped:
//
//   Phrases — every miss was owed back, meaning checks included. A meaning
//   check ("What is the meaning of …?") is answered by picking one of four
//   VIETNAMESE glosses, but the drill is a single text box, and its grader
//   stripped everything outside [a-z0-9 ] after an NFC compose: "tăng lên"
//   became the stub "tng ln", which only a keyboard that can type every
//   accent could reproduce — "tang len" never matched. One missed meaning
//   check locked the entire Phrases tab behind it.
//
//   Collocation — the drill rendered `q.q` and nothing else. All 50 transform
//   items keep their gap in `q.frame`, so the drill showed the ORIGINAL
//   sentence with no blank, no key word and no target while still grading the
//   transformed answer; every letter item lost its first-letter hint; and all
//   150 pair items had one of their two blanks marked while both had to be
//   typed into the one box.
//
// Everything below EXECUTES the shipped code — the real engine, the real tab
// configs and the real banks in one sandbox, in the order index.html loads
// them, like tests/retry-drill.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const DATA_FILES = ['phrases-data.js', 'phrases-meanings.js',
    'collocation-data.js', 'collocation-followups.js'];
const ENGINE_FILES = ['answer-audio.js', 'retrydrill.js', 'wrong-priority.js'];
const TAB_FILES = ['phrases.js', 'collocation.js'];

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
        appState: { coins: 0 },
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
        + 'this.phrQuiz = () => _phrQuiz;'
        + 'this.setColQuiz = (v) => { _colQuiz = v; };', ctx);
    return { ctx, el, saves };
}

// Play a whole Phrases practice, getting every single question wrong.
function answerEverythingWrong(ctx, el) {
    let guard = 0;
    while (ctx.isPhrasesQuizActive() && guard++ < 200) {
        const st = ctx.phrQuiz();
        const q = st.questions[st.idx];
        if (q.typed) { el('phrTextInput').value = 'zzzqqq'; ctx.submitPhrTextAnswer(); }
        else { ctx.answerPhrQuestion((q.correct + 1) % q.options.length); }
        ctx.nextPhrQuestion();
    }
    assert.falsy(ctx.isPhrasesQuizActive(), 'the practice never finished');
}

// Vietnamese typed on a keyboard with no accents.
function stripAccents(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
const HAS_ACCENT = (s) => stripAccents(s) !== String(s);

suite('owed drill: Phrases owes only what can be typed back', () => {
    test('the sandbox holds the real banks, meanings and drills', () => {
        const { ctx } = makeEnv();
        assert.truthy(ctx.phrasesBank().length, 'Phrases bank');
        assert.truthy(ctx.collocBank().length, 'Collocation bank');
        assert.truthy(ctx.CFG.phr && ctx.CFG.col, 'both drills registered');
        assert.truthy(ctx.phrMeaningQuestion(ctx.phrasesBank()[0]), 'meanings did not load');
    });

    test('a practice with every answer wrong owes back the phrase questions and NO meaning checks', () => {
        const { ctx, el } = makeEnv();
        ctx.startPhrasesQuiz(10);
        const asked = ctx.phrQuiz().questions.slice();
        assert.truthy(asked.some(q => q.meaning),
            'this practice asked no meaning check — the test proves nothing');

        answerEverythingWrong(ctx, el);

        const owed = ctx.appState.phrRetry || [];
        assert.truthy(owed.length, 'a practice answered entirely wrong owed nothing back');
        assert.falsy(owed.some(id => String(id).indexOf('pm-') === 0),
            'a meaning check was owed back: ' + owed.join(', '));
        assert.equal(owed.length, asked.filter(q => !q.meaning).length,
            'one debt per phrase question, none per meaning check');
    });

    test('every owed phrases item accepts its own revealed answer', () => {
        // The 👁 button is the escape hatch that makes a persisted gate fair.
        // An item whose revealed answer the grader rejects is a locked door.
        const { ctx, el } = makeEnv();
        ctx.startPhrasesQuiz(10);
        answerEverythingWrong(ctx, el);

        const owed = ctx.retryList('phr');
        assert.truthy(owed.length, 'nothing owed');
        owed.forEach(item => {
            assert.falsy(item.meaning, item.id + ' is a meaning check and cannot be typed');
            assert.truthy(ctx.CFG.phr.grade(String(ctx.CFG.phr.answerText(item)), item),
                item.id + ': the drill refuses the very answer it reveals');
        });
    });

    test('the debt can be cleared by typing the answers, and then practice reopens', () => {
        const { ctx, el } = makeEnv();
        ctx.startPhrasesQuiz(10);
        answerEverythingWrong(ctx, el);

        // The gate takes over the next attempt at a practice.
        ctx.startPhrasesQuiz(10);
        assert.truthy(ctx.isRetryDrillActive(), 'the debt did not gate the next practice');
        assert.falsy(ctx.isPhrasesQuizActive(), 'a practice started while a debt was owed');

        let guard = 0;
        while (ctx.isRetryDrillActive() && guard++ < 400) {
            const st = ctx.drill();
            if (!st.answered) {
                const item = st.queue[st.idx % st.queue.length];
                el('retryInput').value = String(ctx.CFG.phr.answerText(item));
                ctx.submitRetryAnswer();
            }
            ctx.nextRetryQuestion();
        }
        assert.equal(ctx.retryCount('phr'), 0,
            'typing every revealed answer did not clear the debt — the tab is locked');

        ctx.startPhrasesQuiz(10);
        assert.truthy(ctx.isPhrasesQuizActive(), 'practice never reopened after the debt was paid');
    });

    test('a meaning check persisted by an older build is dropped, not left wedging the gate', () => {
        const { ctx } = makeEnv();
        const base = ctx.phrasesBank()[0];
        ctx.appState.phrRetry = ['pm-' + base.id, base.id];
        assert.equal(ctx.retryCount('phr'), 1, 'the stale meaning check is still owed');
        assert.deepEqual(ctx.retryList('phr').map(q => q.id), [base.id]);
    });
});

suite('owed drill: the Phrases grader ignores accents on both sides', () => {
    // A safety net, not the fix: meaning checks are no longer owed. But the
    // grader must never again be the reason an owed item cannot be answered.
    function meaningWithAccents(ctx) {
        for (const base of ctx.phrasesBank()) {
            const mq = ctx.phrMeaningQuestion(base);
            if (mq && HAS_ACCENT(mq.options[mq.correct])) return mq;
        }
        return null;
    }

    test('a Vietnamese answer typed without accents is accepted', () => {
        const { ctx } = makeEnv();
        const mq = meaningWithAccents(ctx);
        assert.truthy(mq, 'no accented meaning option in the whole bank');
        const want = mq.options[mq.correct];
        assert.truthy(ctx.CFG.phr.grade(stripAccents(want), mq),
            `"${stripAccents(want)}" was rejected for "${want}"`);
    });

    test('the same answer typed WITH its accents still passes', () => {
        const { ctx } = makeEnv();
        const mq = meaningWithAccents(ctx);
        const want = mq.options[mq.correct];
        assert.truthy(ctx.CFG.phr.grade(want, mq), 'the exact answer was rejected');
        assert.truthy(ctx.CFG.phr.grade('  ' + want.toUpperCase() + ' ! ', mq),
            'case, spacing and punctuation must still be forgiven');
    });

    test('accent-stripping never collapses an answer to nothing, and junk is still wrong', () => {
        const { ctx } = makeEnv();
        const mq = meaningWithAccents(ctx);
        assert.falsy(ctx.CFG.phr.grade('zzzqqq', mq), 'junk was graded right');
        assert.falsy(ctx.CFG.phr.grade('', mq), 'an empty answer was graded right');
        // Stripping accents must not blur two different glosses into one.
        mq.options.forEach((opt, i) => {
            if (i === mq.correct) return;
            assert.falsy(ctx.CFG.phr.grade(opt, mq), `"${opt}" was accepted for "${mq.options[mq.correct]}"`);
            assert.falsy(ctx.CFG.phr.grade(stripAccents(opt), mq),
                `"${stripAccents(opt)}" was accepted for "${mq.options[mq.correct]}"`);
        });
        // The old normaliser reduced accented Vietnamese to a stub; a grader
        // that compares two stubs would accept any accented string at all.
        let stubs = 0;
        for (const base of ctx.phrasesBank().slice(0, 200)) {
            const q = ctx.phrMeaningQuestion(base);
            if (!q) continue;
            const want = q.options[q.correct];
            if (!ctx.CFG.phr.grade(want, q)) stubs++;
        }
        assert.equal(stubs, 0, 'some meaning answers still cannot match themselves');
    });

    test('an English preposition still grades exactly as before', () => {
        const { ctx } = makeEnv();
        const q = ctx.phrasesBank()[0];
        assert.truthy(ctx.CFG.phr.grade(q.options[q.correct], q));
        assert.truthy(ctx.CFG.phr.grade(' ' + q.options[q.correct].toUpperCase() + '.', q));
        assert.falsy(ctx.CFG.phr.grade('zzzqqq', q));
    });
});

suite('owed drill: Collocation shows the question it grades', () => {
    const GAP_RE = /phrases-blank|wf-retry-gap/g;
    const gaps = (html) => (String(html).match(GAP_RE) || []).length;
    const drillPrompt = (ctx, q) => ctx.CFG.col.promptHTML(q);
    // Render one question through the LIVE quiz, exactly as the child sees it.
    function livePrompt(ctx, el, q) {
        ctx.setColQuiz({ questions: [q], idx: 0, answers: [null] });
        ctx.renderCollocQuestion();
        const html = el('phrasesScreen').innerHTML;
        ctx.setColQuiz(null);
        return html;
    }
    const byType = (ctx, t) => ctx.collocBank().filter(q => q.type === t);

    test('every transform item shows its key word and its framed blank', () => {
        // q.q is the ORIGINAL sentence and has no gap at all: 0 of 50 transform
        // items carry `___` in q.q, all 50 carry it in q.frame.
        const { ctx } = makeEnv();
        const items = byType(ctx, 'transform');
        assert.equal(items.length, 50, 'transform count moved — update this test');
        for (const q of items) {
            const html = drillPrompt(ctx, q);
            assert.truthy(html.includes('<b>' + ctx.colEsc(q.keyword) + '</b>'),
                q.id + ': the drill hides the key word it grades against');
            const framed = ctx.colEsc(q.frame).replace(/___/g, '<b class="wf-retry-gap">___</b>');
            assert.truthy(html.includes(framed),
                q.id + ': the drill does not show the frame with its blank');
            assert.equal(gaps(html), 1, q.id + ': the transform blank is missing or doubled');
        }
    });

    test('every letter item keeps its first-letter hint', () => {
        const { ctx } = makeEnv();
        const items = byType(ctx, 'letter');
        assert.equal(items.length, 100, 'letter count moved — update this test');
        for (const q of items) {
            const html = drillPrompt(ctx, q);
            assert.truthy(html.includes(ctx.colEsc(ctx._colLetterHint(q.answer))),
                q.id + ': the drill drops the hint the live quiz gives');
        }
    });

    test('every pair item marks BOTH of its blanks', () => {
        // _colAnswerCorrect wants both halves ("conclusive/ resign") in the one
        // box, so a prompt with one blank asks for half of what it grades.
        const { ctx } = makeEnv();
        const items = byType(ctx, 'pair');
        assert.equal(items.length, 150, 'pair count moved — update this test');
        for (const q of items) {
            assert.equal(gaps(drillPrompt(ctx, q)), 2,
                q.id + ': the drill marks only one of two blanks');
        }
    });

    test('no owed collocation item is ever shown without a blank', () => {
        const { ctx } = makeEnv();
        for (const q of ctx.collocBank()) {
            assert.truthy(gaps(drillPrompt(ctx, q)) >= 1,
                q.id + ': the drill shows a sentence with nothing to fill in');
        }
    });

    test('the drill and the live quiz put the same facts on screen', () => {
        // One renderer, two screens: collocQuestionHTML. If they ever split
        // again, one of them will start asking a different question.
        const { ctx, el } = makeEnv();
        for (const type of ['pair', 'mcq', 'letter', 'open', 'transform']) {
            const q = ctx.collocBank().find(x => x.type === type);
            assert.truthy(q, 'no ' + type + ' item in the bank');
            const live = livePrompt(ctx, el, q);
            const drill = drillPrompt(ctx, q);
            assert.equal(gaps(drill), gaps(live), type + ': the two screens show a different number of blanks');
            if (type === 'transform') {
                assert.truthy(live.includes('<b>' + ctx.colEsc(q.keyword) + '</b>'), 'live quiz lost the key word');
                assert.truthy(drill.includes('<b>' + ctx.colEsc(q.keyword) + '</b>'), 'drill lost the key word');
                assert.truthy(drill.includes('colloc-frame'), 'drill lost the frame');
            }
            if (type === 'letter') {
                const hint = ctx.colEsc(ctx._colLetterHint(q.answer));
                assert.truthy(live.includes(hint) && drill.includes(hint), 'the hint is on only one screen');
            }
        }
    });

    test('every value the drill interpolates is still escaped', () => {
        const { ctx } = makeEnv();
        const html = drillPrompt(ctx, {
            id: 'col-x', type: 'transform', answer: 'x',
            q: 'A <b>bold</b> & original sentence',
            keyword: 'CH<OICE',
            frame: 'Before <i>___ after "quoted"',
        });
        assert.truthy(html.includes('&lt;b&gt;bold&lt;/b&gt;'), 'q was not escaped');
        assert.falsy(html.includes('<b>bold</b>'), 'raw markup from the bank reached the page');
        assert.truthy(html.includes('CH&lt;OICE'), 'the key word was not escaped');
        assert.truthy(html.includes('&lt;i&gt;'), 'the frame was not escaped');
        assert.truthy(html.includes('&amp;'), 'an ampersand was not escaped');
    });

    test('the owed collocation drill still accepts its own revealed answer', () => {
        const { ctx } = makeEnv();
        for (const q of ctx.collocBank()) {
            assert.truthy(ctx.CFG.col.grade(String(ctx.CFG.col.answerText(q)), q),
                q.id + ': the drill refuses the answer its 👁 button reveals');
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
