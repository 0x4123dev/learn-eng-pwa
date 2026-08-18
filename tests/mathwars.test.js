// mathwars.test.js — ⚔️ Math Wars: 10 sums, two minutes, numbers a Grade 4
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

// The ladder is the whole reason a Grade 4 child can start this mode at all:
// bậc 1 is "đáp án < 20", and it only widens after ten correct answers in a
// row. None of it is on screen — these tests are the only place it is visible.
suite('math wars: the hidden difficulty ladder', () => {
    function at(level, streak) {
        global.appState = { coins: 0, warsHistory: [], warsProgress: { level: level, streak: streak || 0 } };
    }

    test('a brand-new child starts at bậc 1 — nothing above 19, anywhere', () => {
        global.appState = { coins: 0, warsHistory: [] };   // no ladder recorded yet
        assert.equal(w.warsProgress().level, 0, 'a first-time child must start at the bottom');
        assert.equal(w.warsMax(), 19, 'bậc 1 is "đáp án < 20"');
        const rand = seeded(29);
        const bad = [];
        for (let i = 0; i < RUNS; i++) {
            const q = w.warsQuestion(rand);
            const nums = [q.a, q.b, q.answer].concat(q.options);
            if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 19)) bad.push(q);
        }
        assert.deepEqual(bad.slice(0, 3), [], `${bad.length}/${RUNS} questions broke out of bậc 1`);
    });

    test('every bậc widens by ten and the last one is the old 0–99', () => {
        assert.deepEqual(
            Array.from({ length: w.WARS_LEVELS }, (_, i) => w.warsLevelMax(i)),
            [19, 29, 39, 49, 59, 69, 79, 89, 99]);
        assert.equal(w.warsLevelMax(99), w.WARS_MAX, 'past the top bậc it just stays at 99');
        assert.equal(w.warsLevelMax(-3), 19, 'and a broken level falls back to the bottom');
    });

    test('each bậc holds its own ceiling, operands and options included', () => {
        for (let lv = 0; lv < w.WARS_LEVELS; lv++) {
            at(lv);
            const cap = w.warsLevelMax(lv);
            const rand = seeded(31 + lv);
            for (let i = 0; i < 2000; i++) {
                const q = w.warsQuestion(rand);
                [q.a, q.b, q.answer].concat(q.options).forEach(n => {
                    assert.truthy(Number.isInteger(n) && n >= 0 && n <= cap,
                        `bậc ${lv + 1} (≤${cap}) produced ${n} in "${q.q}"`);
                });
            }
        }
    });

    test('more than twenty correct in a row opens the next bậc — and only then', () => {
        // A round is ten questions, so the bar is two flawless rounds and one
        // more answer: a bậc is sustained accuracy, not a single lucky round.
        assert.truthy(w.WARS_LEVEL_UP_STREAK > 20, 'the ladder must ask for more than twenty');
        assert.truthy(w.WARS_LEVEL_UP_STREAK > 2 * w.WARS_QUESTIONS,
            'two perfect rounds alone must not be enough');
        at(0);
        for (let i = 0; i < w.WARS_LEVEL_UP_STREAK - 1; i++) {
            w.warsNoteAnswer(true);
            assert.equal(w.warsProgress().level, 0, `bậc moved after only ${i + 1} correct`);
        }
        w.warsNoteAnswer(true);
        assert.equal(w.warsProgress().level, 1, 'the full streak must open bậc 2');
        assert.equal(w.warsMax(), 29, 'bậc 2 is "đáp án < 30"');
        assert.equal(w.warsProgress().streak, 0, 'the count restarts for the next bậc');
    });

    test('one wrong answer costs the streak but never the bậc already earned', () => {
        at(2, w.WARS_LEVEL_UP_STREAK - 1);           // one answer from bậc 4
        w.warsNoteAnswer(false);
        assert.equal(w.warsProgress().streak, 0, 'a slip must reset the count');
        assert.equal(w.warsProgress().level, 2, 'but a child never loses ground they earned');
        assert.equal(w.warsMax(), 39);
    });

    test('the streak carries across rounds — a run is a run', () => {
        // The bar is longer than one round by design, so carrying the count
        // across rounds is the only way the ladder can ever move at all.
        const need = w.WARS_LEVEL_UP_STREAK;
        at(0);
        for (let i = 0; i < need - 1; i++) {
            w.warsNoteAnswer(true);
            if ((i + 1) % w.WARS_QUESTIONS === 0) {
                assert.equal(w.warsProgress().level, 0, 'a finished round must not reset the run');
            }
        }
        w.warsNoteAnswer(true);
        assert.equal(w.warsProgress().level, 1, 'a streak that spans rounds still counts');
    });

    test('the ladder stops at the top instead of running off the end', () => {
        at(w.WARS_LEVELS - 1, 0);
        for (let i = 0; i < 100; i++) w.warsNoteAnswer(true);
        assert.equal(w.warsProgress().level, w.WARS_LEVELS - 1, 'the top bậc is the top');
        assert.equal(w.warsMax(), w.WARS_MAX);
    });

    test('a round is pinned to the bậc it opened at, and records it', () => {
        at(1);
        w.startWarsRound();
        // Ten correct answers would open bậc 3 mid-round; the sums under the
        // child's fingers must not change while they are looking at them.
        for (let i = 0; i < w.WARS_QUESTIONS; i++) {
            if (!w.isWarsActive()) break;
            w.answerWars(0);
        }
        const run = global.appState.warsHistory[0];
        assert.equal(run.level, 2, 'the run must record the bậc it was played at');
        assert.equal(run.max, 29, 'and the ceiling that bậc used');
    });

    test('the bậc is never written on the screen', () => {
        at(3);
        const html = w.renderWarsPracticeHTML() + w.renderWarsHistoryHTML();
        assert.truthy(!/bậc|Bậc|cấp độ|level|Level/.test(html),
            'the ladder must stay invisible — the child just plays');
        assert.truthy(!/0–99|0-99/.test(html),
            'and the copy must not promise a range the bậc has not reached');
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

suite('math wars: the clock', () => {
    test('a round is five minutes — long enough for a Grade 4 head', () => {
        // At 60s the clock was the difficulty rather than the arithmetic, and
        // even two minutes ended rounds with questions unseen. Ten questions
        // in five minutes is thirty seconds each.
        assert.equal(w.WARS_SECONDS, 300);
        assert.equal(w.warsLengthLabel(), '5 phút');
        assert.truthy(w.WARS_SECONDS / w.WARS_QUESTIONS >= 30,
            'every question needs a workable share of the clock');
    });

    test('over a minute it reads as a clock; under, as urgent seconds', () => {
        assert.equal(w.warsClockText(300000), '5:00');
        assert.equal(w.warsClockText(120000), '2:00');
        assert.equal(w.warsClockText(95000), '1:35');
        assert.equal(w.warsClockText(60000), '1:00');
        assert.equal(w.warsClockText(59000), '59s');
        assert.equal(w.warsClockText(1200), '2s');
        assert.equal(w.warsClockText(0), '0s');
        assert.equal(w.warsClockText(-5000), '0s', 'a finished clock never goes negative');
    });

    test('the length is quoted from one place, never typed into the copy', () => {
        const fs2 = require('fs');
        ['js/mathwars.js', 'js/math.js'].forEach(f => {
            const src = fs2.readFileSync(path.join(root, f), 'utf8')
                .split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
            assert.truthy(!/60 giây|60s\b/.test(src),
                `${f} still says "60 giây" in its own words — change WARS_SECONDS instead`);
        });
    });

    test('a fresh round really starts with the full length', () => {
        // Derived from the constant, so moving the round length cannot leave
        // this test passing against a stale number.
        const full = w.WARS_SECONDS * 1000;
        global.appState = { coins: 0, warsHistory: [] };
        w.startWarsRound();
        const left = w.warsLeftMs();
        assert.truthy(left > full - 2000 && left <= full, `round opened with ${left}ms of ${full}ms`);
        w.abandonWars();
    });
});

suite('math wars: a mis-tap must not cost the round', () => {
    function armConfirm(answer) {
        const calls = [];
        global.confirm = (msg) => { calls.push(msg); return answer; };
        return calls;
    }

    test('the ✕ asks first, and "no" leaves the round running', () => {
        global.appState = { coins: 0, warsHistory: [] };
        w.startWarsRound();
        w.answerWars(0);
        const asked = armConfirm(false);
        try {
            w.warsQuit();
            assert.equal(asked.length, 1, 'it must ask before throwing the round away');
            assert.truthy(/Math Wars/.test(asked[0]) && /Vẫn ra chứ/.test(asked[0]), asked[0]);
            assert.truthy(w.isWarsActive(), 'saying no must keep the round alive');
            assert.deepEqual(global.appState.warsHistory, [], 'nothing may be scored');
        } finally { delete global.confirm; w.abandonWars(); }
    });

    test('saying yes ends the round, and it scores nothing', () => {
        global.appState = { coins: 0, warsHistory: [] };
        w.startWarsRound();
        w.answerWars(0);
        armConfirm(true);
        try {
            w.warsQuit();
            assert.truthy(!w.isWarsActive(), 'the round should be gone');
            assert.deepEqual(global.appState.warsHistory, [], 'a walked-away round is not a result');
            assert.equal(global.appState.coins, 0, 'and pays nothing');
        } finally { delete global.confirm; }
    });

    test('the countdown left is quoted in the question, so the cost is visible', () => {
        global.appState = { coins: 0, warsHistory: [] };
        w.startWarsRound();
        const asked = armConfirm(false);
        try {
            w.warsQuit();
            assert.truthy(/còn \d/.test(asked[0]), `no time left shown: ${asked[0]}`);
        } finally { delete global.confirm; w.abandonWars(); }
    });

    test('the ✕ on a finished round just goes back, no question asked', () => {
        w.abandonWars();
        const asked = armConfirm(true);
        try {
            w.warsQuit();
            assert.equal(asked.length, 0, 'nothing is at stake, so nothing to ask');
        } finally { delete global.confirm; }
    });

    test('the bottom nav guards the round too, and abandons it only on yes', () => {
        // switchScreen is the one route the ✕ cannot cover.
        const fs2 = require('fs');
        const src = fs2.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
        const i = src.indexOf('isWarsActive');
        assert.truthy(i > 0, 'switchScreen never checks for a running Math Wars round');
        const block = src.slice(i - 400, i + 700);
        assert.truthy(/screenId !== 'mathHubScreen'/.test(block), 'the guard must not fire on the Math tab itself');
        assert.truthy(/confirm\(/.test(block), 'it must ask before leaving');
        assert.truthy(/return;/.test(block), 'saying no must stay put');
        assert.truthy(/abandonWars\(\)/.test(block), 'saying yes must stop the clock');
    });

    test('a stray re-render redraws the round instead of painting over it', () => {
        // Tapping the Math tab while playing used to repaint the menu on top:
        // the DOM went, the interval kept ticking, and the round finished into
        // a screen the child had already left.
        const fs2 = require('fs');
        const src = fs2.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        const home = src.slice(src.indexOf('function renderMathHome()'), src.indexOf('function mathHeaderHTML'));
        assert.truthy(/isWarsActive\(\)/.test(home) && /renderWars\(\)/.test(home),
            'renderMathHome must hand back to the live round');
    });
});
