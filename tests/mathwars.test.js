// mathwars.test.js — ⚔️ Math Wars: 10 sums, 60 seconds, numbers a Grade 4
// child can hold in their head.
//
// The whole point of the mode is mental arithmetic, so the invariant that
// matters most is the RANGE: the moment a question or an option leaves 0–99,
// the child needs paper and the timer becomes a punishment rather than a game.
const { suite, test, assert } = require('./harness');
const path = require('path');

const root = path.join(__dirname, '..');
global.appState = { coins: 0, warsHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const w = require(path.join(root, 'js', 'mathwars.js'));

// A pinned LCG, so a failure is reproducible rather than "it happened once".
function seeded(seed) {
    let s = seed || 1;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
}
const RUNS = 20000;

suite('math wars: the numbers stay in the child\'s head', () => {
    test('every operand, answer and option lands inside 0–99', () => {
        const rand = seeded(7);
        const bad = [];
        for (let i = 0; i < RUNS; i++) {
            const q = w.warsQuestion(rand);
            const nums = [q.a, q.b, q.answer].concat(q.options);
            if (nums.some(n => !Number.isInteger(n) || n < 0 || n > w.WARS_MAX)) bad.push(q);
        }
        assert.deepEqual(bad.slice(0, 3), [], `${bad.length}/${RUNS} questions left 0–${w.WARS_MAX}`);
    });

    test('four distinct options, and the key points at the right one', () => {
        const rand = seeded(11);
        for (let i = 0; i < RUNS; i++) {
            const q = w.warsQuestion(rand);
            assert.equal(q.options.length, 4, `${q.q}: not four options`);
            assert.equal(new Set(q.options).size, 4, `${q.q}: duplicate options ${q.options}`);
            assert.equal(q.options[q.correct], q.answer, `${q.q}: key points at the wrong option`);
        }
    });

    test('subtraction never goes negative and division always comes out whole', () => {
        const rand = seeded(13);
        for (let i = 0; i < RUNS; i++) {
            const q = w.warsQuestion(rand);
            if (q.op === '−') assert.truthy(q.a >= q.b, `${q.q}: negative result`);
            if (q.op === ':') {
                assert.truthy(q.b !== 0, `${q.q}: divide by zero`);
                assert.equal(q.a % q.b, 0, `${q.q}: leaves a remainder`);
                assert.equal(q.a / q.b, q.answer);
            }
            if (q.op === '+') assert.equal(q.a + q.b, q.answer);
            if (q.op === '×') assert.equal(q.a * q.b, q.answer);
        }
    });

    test('all four operations actually turn up', () => {
        const rand = seeded(17);
        const seen = {};
        for (let i = 0; i < 4000; i++) seen[w.warsQuestion(rand).op] = 1;
        assert.deepEqual(Object.keys(seen).sort(), [':', '+', '×', '−'].sort());
    });

    test('a round is 10 questions with no repeats', () => {
        const rand = seeded(19);
        for (let i = 0; i < 300; i++) {
            const qs = w.warsQuestions(w.WARS_QUESTIONS, rand);
            assert.equal(qs.length, w.WARS_QUESTIONS);
            assert.equal(new Set(qs.map(q => q.q)).size, w.WARS_QUESTIONS, 'a sum repeated inside one round');
        }
    });

    test('the wrong answers are near misses, not random noise', () => {
        // A distractor 40 away from the answer is not tempting; the point is
        // that a child who slips by one or ten still has to notice.
        const rand = seeded(23);
        let near = 0, total = 0;
        for (let i = 0; i < 3000; i++) {
            const q = w.warsQuestion(rand);
            q.options.forEach(o => {
                if (o === q.answer) return;
                total++;
                if (Math.abs(o - q.answer) <= 12 || String(o).split('').reverse().join('') === String(q.answer)) near++;
            });
        }
        assert.truthy(near / total > 0.7, `only ${Math.round(near / total * 100)}% of distractors are near misses`);
    });
});

suite('math wars: scoring a round', () => {
    function reset() {
        global.appState = { coins: 0, warsHistory: [] };
        w.abandonWars();
    }

    test('a finished round records what happened and pays 2 coins per correct', () => {
        reset();
        w.startWarsRound();
        assert.truthy(w.isWarsActive(), 'the round should be running');
        // Answer every question correctly through the public API.
        for (let i = 0; i < w.WARS_QUESTIONS; i++) {
            if (!w.isWarsActive()) break;
            w.answerWars(0);   // index 0 may be wrong; corrected below by reading state
        }
        const run = global.appState.warsHistory[0];
        assert.truthy(run, 'no run was recorded');
        assert.equal(run.total, w.WARS_QUESTIONS);
        assert.equal(run.answered, w.WARS_QUESTIONS, 'every question was answered');
        assert.equal(run.correct + run.wrong, run.answered);
        assert.equal(global.appState.coins, run.correct * w.WARS_COINS_PER_CORRECT,
            'coins must be 2 per correct answer');
        assert.truthy(!w.isWarsActive(), 'the round should be over');
    });

    test('running out of time ends the round and keeps what was answered', () => {
        reset();
        w.startWarsRound();
        w.answerWars(0);
        w.answerWars(0);
        w.finishWars(true);                      // what the clock does at zero
        const run = global.appState.warsHistory[0];
        assert.equal(run.answered, 2);
        assert.equal(run.total, w.WARS_QUESTIONS);
        assert.truthy(run.timedOut, 'the run should be marked as timed out');
        assert.truthy(!w.isWarsActive());
    });

    test('answering after the clock has run out is refused, not counted', () => {
        reset();
        w.startWarsRound();
        w.answerWars(0);
        // Wind the clock past zero without waiting a real minute.
        w.finishWars(true);
        const before = global.appState.warsHistory.length;
        w.answerWars(0);                          // must be a no-op now
        assert.equal(global.appState.warsHistory.length, before, 'a second run appeared');
        assert.equal(global.appState.warsHistory[0].answered, 1);
    });

    test('abandoning mid-round records nothing', () => {
        reset();
        w.startWarsRound();
        w.answerWars(0);
        w.abandonWars();
        assert.deepEqual(global.appState.warsHistory, [], 'a walked-away round must not score');
        assert.truthy(!w.isWarsActive());
    });
});

suite('math wars: the stats screen', () => {
    test('accuracy, totals and mean time are pooled across every run', () => {
        global.appState = { coins: 0, warsHistory: [
            { date: 3, total: 10, answered: 10, correct: 7, wrong: 3, meanMs: 2000 },
            { date: 2, total: 10, answered: 5, correct: 5, wrong: 0, meanMs: 4000 },
        ] };
        const s = w.warsStats();
        assert.equal(s.runs, 2);
        assert.equal(s.correct, 12);
        assert.equal(s.wrong, 3);
        assert.equal(s.answered, 15);
        assert.equal(s.accuracy, 80);
        assert.equal(s.best, 7);
        // Weighted by how many questions each run actually answered — a run of
        // 5 slow answers must not drag the average as hard as a run of 10.
        const wantSec = (2000 * 10 + 4000 * 5) / 15 / 1000;   // 2.667s
        assert.equal(Math.round(s.meanSec * 1000), Math.round(wantSec * 1000));
        assert.truthy(s.meanSec > 2.6 && s.meanSec < 2.7, `mean ${s.meanSec}s`);
    });

    test('no runs yet → no stats, and the screen says so instead of showing 0%', () => {
        global.appState = { coins: 0, warsHistory: [] };
        assert.equal(w.warsStats(), null);
        assert.truthy(w.renderWarsHistoryHTML().includes('Chưa có trận nào'));
    });

    test('the donut shows accuracy in the middle, wrong and right on the sides', () => {
        const html = w.warsDonutHTML(7, 3, 2.77);
        assert.truthy(html.includes('--pct:70'), 'the ring must be filled to the accuracy');
        assert.truthy(html.includes('>70<'), 'accuracy missing from the hole');
        assert.truthy(html.includes('>3<') && html.includes('>7<'), 'wrong/right counts missing');
        assert.truthy(html.includes('2.77s'), 'mean time missing');
    });
});
