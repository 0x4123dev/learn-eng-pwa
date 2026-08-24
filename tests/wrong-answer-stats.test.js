// wrong-answer-stats.test.js — "which ones do I keep getting wrong, and how
// often?" for the two tabs that could not answer it: Grade 4 words (js/units.js)
// and Toán 7 (js/math.js). Both used to record only score/total, so the history
// could say 6/10 forever without ever saying WHICH six.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { UNIT_WORDS } = require(path.join(__dirname, '..', 'js', 'units-data.js'));
const { MATH_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'math-data.js'));

global.UNIT_WORDS = UNIT_WORDS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };

// The owed-questions engine, because the panels step aside while a debt is
// open — without it loaded, retryCount() is absent and that rule cannot be
// exercised at all.
Object.assign(global, require(path.join(__dirname, '..', 'js', 'retrydrill.js')));

const units = require(path.join(__dirname, '..', 'js', 'units.js'));
const math = require(path.join(__dirname, '..', 'js', 'math.js'));

const W = UNIT_WORDS.slice(0, 3);                     // three real words
const Q = MATH_QUESTIONS.slice(0, 3);                 // three real questions

suite('Grade 4: words to review', () => {
    test('a finished practice records WHICH words were missed, not just how many', () => {
        // The aggregate can only exist if the session carries the list.
        const fs = require('fs');
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'units.js'), 'utf8');
        assert.truthy(/unitsHistory\.unshift\(\{[^}]*wrong:/.test(src),
            'the session must store the missed words');
    });

    test('misses are counted across every past session, hardest first', () => {
        global.appState = { unitsHistory: [
            { unit: 1, score: 8, total: 10, date: 3, wrong: [W[0].en, W[1].en] },
            { unit: 1, score: 9, total: 10, date: 2, wrong: [W[0].en] },
            { unit: 2, score: 7, total: 10, date: 1, wrong: [W[0].en, W[2].en] },
        ] };
        const agg = units.unitsWrongAggregate();
        assert.equal(agg.length, 3);
        assert.equal(agg[0].w.en, W[0].en, 'the most-missed word comes first');
        assert.equal(agg[0].misses, 3);
        assert.equal(agg.find(x => x.w.en === W[1].en).misses, 1);
        assert.equal(agg.find(x => x.w.en === W[2].en).misses, 1);
    });

    test('a word that is no longer in the bank is dropped, not rendered blank', () => {
        global.appState = { unitsHistory: [{ unit: 1, score: 9, total: 10, date: 1, wrong: ['zznotaword'] }] };
        assert.deepEqual(units.unitsWrongAggregate(), []);
    });

    test('sessions saved before this feature simply contribute nothing', () => {
        global.appState = { unitsHistory: [{ unit: 1, score: 6, total: 10, date: 1 }] };
        assert.deepEqual(units.unitsWrongAggregate(), []);
        assert.equal(units.renderUnitsWrongPanelHTML(), '', 'no panel rather than an empty one');
    });

    test('the panel names each word, its meaning and its miss count', () => {
        global.appState = { unitsHistory: [
            { unit: 1, score: 8, total: 10, date: 2, wrong: [W[0].en] },
            { unit: 1, score: 8, total: 10, date: 1, wrong: [W[0].en] },
        ] };
        const html = units.renderUnitsWrongPanelHTML();
        assert.truthy(html.includes('Từ hay sai'), 'panel title missing');
        assert.truthy(html.includes(W[0].en), 'the word itself must be shown');
        assert.truthy(html.includes(W[0].vi), 'the Vietnamese meaning must be shown');
        assert.truthy(html.includes('2×'), 'the miss count must be shown');
    });

    test('the panel steps aside while words are owed', () => {
        // The drill is the way to clear them; a second "practise your mistakes"
        // route next to it just sends a child round in circles.
        global.appState = { unitsHistory: [{ unit: 1, score: 9, total: 10, date: 1, wrong: [W[0].en] }] };
        assert.truthy(units.renderUnitsWrongPanelHTML().includes('Từ hay sai'), 'shown with no debt');
        const real = global.retryCount;
        global.retryCount = (k) => (k === 'units' ? 1 : 0);
        try {
            assert.equal(units.renderUnitsWrongPanelHTML(), '', 'hidden while a word is owed');
        } finally { global.retryCount = real; }
    });
});

suite('Toán 7: questions to review', () => {
    test('a finished quiz records WHICH questions were missed', () => {
        const fs = require('fs');
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'math.js'), 'utf8');
        assert.truthy(/wrong: wrong\.map\(x => x\.q\.id\)/.test(src),
            'the session must store the missed question ids');
    });

    test('misses are counted across every past run, hardest first', () => {
        global.appState = { mathHistory: [
            { chapter: 1, score: 7, total: 10, date: 3, wrong: [Q[0].id, Q[1].id] },
            { chapter: 1, score: 8, total: 10, date: 2, wrong: [Q[0].id] },
            { chapter: 2, score: 6, total: 10, date: 1, wrong: [Q[0].id, Q[2].id] },
        ] };
        const agg = math.mathWrongAggregate();
        assert.equal(agg.length, 3);
        assert.equal(agg[0].q.id, Q[0].id);
        assert.equal(agg[0].misses, 3);
    });

    test('questions are grouped into useful maths skills, with miss totals', () => {
        const grouped = math.mathWrongSkillAggregate([
            { q: Q[0], misses: 3 },
            { q: Q[1], misses: 1 },
            { q: Q[2], misses: 2 },
        ]);
        assert.equal(grouped[0].label, 'Số hữu tỉ');
        assert.equal(grouped[0].misses, 4);
        assert.equal(grouped[0].questions, 2);
        assert.equal(grouped[1].label, 'Số đối');
        assert.equal(grouped[1].misses, 2);
    });

    test('exam runs count the same as practice runs', () => {
        global.appState = { mathHistory: [
            { chapter: 0, examId: 'm1', score: 20, total: 25, date: 2, wrong: [Q[1].id] },
            { chapter: 1, score: 9, total: 10, date: 1, wrong: [Q[1].id] },
        ] };
        assert.equal(math.mathWrongAggregate()[0].misses, 2);
    });

    test('an unknown id is dropped, and pre-feature sessions contribute nothing', () => {
        global.appState = { mathHistory: [{ chapter: 1, score: 5, total: 10, date: 2, wrong: ['zz-nope'] },
                                          { chapter: 1, score: 5, total: 10, date: 1 }] };
        assert.deepEqual(math.mathWrongAggregate(), []);
        assert.equal(math.renderMathWrongPanelHTML(), '');
    });

    test('the panel shows the question, its answer and the miss count', () => {
        global.appState = { mathHistory: [
            { chapter: 1, score: 8, total: 10, date: 2, wrong: [Q[0].id] },
            { chapter: 1, score: 8, total: 10, date: 1, wrong: [Q[0].id] },
        ] };
        const html = math.renderMathWrongPanelHTML();
        assert.truthy(html.includes('Dạng toán cần ôn'), 'panel title missing');
        assert.truthy(html.includes('Câu hay sai'), 'question-stat subtitle missing');
        assert.truthy(html.includes('2×'), 'the miss count must be shown');
        assert.truthy(html.includes(math.mathEsc(Q[0].q).slice(0, 24)), 'the question text must be shown');
        assert.truthy(html.includes('Luyện lại câu hay sai'), 'focused-practice button missing');
        assert.truthy(html.includes('startMathWrongPractice()'), 'button is not wired');
        assert.truthy(html.includes('<details'), 'long question list must stay collapsible');
    });

    test('an open debt is named on the panel rather than hiding it', () => {
        // Unlike Grade 4, the maths list is on the History screen — a page a
        // child reads rather than starts a practice from — so it stays, and
        // says why the practice buttons are locked.
        global.appState = { mathHistory: [{ chapter: 1, score: 8, total: 10, date: 1, wrong: [Q[0].id] }] };
        const real = global.retryCount;
        global.retryCount = (k) => (k === 'math' ? 3 : 0);
        try {
            const html = math.renderMathWrongPanelHTML();
            assert.truthy(html.includes('Câu hay sai'), 'the list stays');
            assert.truthy(html.includes('<b>3</b>'), 'and says how many are owed');
        } finally { global.retryCount = real; }
    });

    test('the history screen carries the panel', () => {
        global.appState = { mathHistory: [
            { chapter: 1, label: 'Chương 1', score: 8, total: 10, date: 2, wrong: [Q[0].id] },
        ] };
        const html = math.renderMathHistoryHTML();
        assert.truthy(html.includes('Câu hay sai'), 'the stats screen should list the hard questions');
        assert.truthy(html.includes('Lịch sử làm bài'), 'and still be the history screen');
    });

    test('the practice screen also surfaces the review card', () => {
        global.appState = { mathHistory: [
            { chapter: 1, label: 'Chương 1', score: 8, total: 10, date: 2, wrong: [Q[0].id] },
        ] };
        const html = math.renderMathPracticeHTML();
        assert.truthy(html.includes('Dạng toán cần ôn'));
        assert.truthy(html.includes('Luyện lại câu hay sai'));
    });

    test('focused review builds a top-ten quiz, while active debt uses the retry drill', () => {
        const src = require('fs').readFileSync(path.join(__dirname, '..', 'js', 'math.js'), 'utf8');
        const start = src.indexOf('function startMathWrongPractice');
        const end = src.indexOf('\n}', start);
        const body = src.slice(start, end);
        assert.truthy(/wrong\.slice\(0, MATH_QUIZ_SIZE\)/.test(body));
        assert.truthy(/startMathRetry/.test(body), 'active owed questions must use the existing retry flow');
        assert.truthy(/label: 'Luyện câu hay sai'/.test(body));
    });
});
