// tests/gen-grammar-quiz-logic.test.js — Characterization tests for the
// grammar quiz + session logic layer (js/grammar-units.js helpers):
//   generateGrammarQuiz, scoreGrammarQuestion / isArrangementCorrect,
//   saveGrammarSession (history + 300-cap), getGrammarStats /
//   getGrammarAggregateStats, and the mistake-bank add/graduate lifecycle.
//
// These complement tests/grammar.test.js (basic happy paths) with angles not
// asserted elsewhere: pool membership + no-mutation of the source arrays, the
// negative-n slice quirk, newest-first ordering + the 300-session history cap,
// best-score tie behavior, bookmark-graduate-relapse flow, and arrangement
// questions in the mistake bank.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includeGrammarUI: true });

// ── Helpers ──────────────────────────────────────────────────────────────────
function freshState() {
    env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
}

function firstMC(unitId, skip) {
    const u = env.getGrammarUnit(unitId);
    const mcs = u.questions.filter(q => q.type !== 'arrangement');
    return mcs[skip || 0];
}

function firstArrangement(unitId) {
    return env.getGrammarUnit(unitId).questions.find(q => q.type === 'arrangement');
}

function wrongFor(mc) {
    return mc.correct === 0 ? 1 : 0;
}

function identityOrder(arrQ) {
    return arrQ.parts.map((_, i) => i);
}

// ============================================================================
// generateGrammarQuiz
// ============================================================================
suite('gen: generateGrammarQuiz — n unique questions from the unit pool', () => {
    const combos = [];
    for (const unitId of ['unit1', 'unit3', 'unit5', 'unit8', 'unit12', 'unit13']) {
        for (const n of [5, 20]) combos.push({ unitId, n });
    }

    for (const { unitId, n } of combos) {
        test(`${unitId} × n=${n}: exactly ${n} unique questions, all from that unit`, () => {
            const unit = env.getGrammarUnit(unitId);
            assert.truthy(unit, `unit ${unitId} should exist`);
            const poolIds = new Set(unit.questions.map(q => q.id));
            const qs = env.generateGrammarQuiz(unitId, n);
            assert.equal(qs.length, n, `expected ${n} questions`);
            const ids = qs.map(q => q.id);
            assert.equal(new Set(ids).size, n, 'question ids must be unique');
            for (const id of ids) {
                assert.truthy(poolIds.has(id), `${id} is not in ${unitId}'s pool`);
            }
        });
    }

    test('unknown unitId returns an empty array', () => {
        assert.deepEqual(env.generateGrammarQuiz('unit999', 10), []);
    });

    test('n=0 returns an empty array', () => {
        assert.deepEqual(env.generateGrammarQuiz('unit1', 0), []);
    });

    test('n=1 returns exactly one question from the unit', () => {
        const qs = env.generateGrammarQuiz('unit2', 1);
        assert.equal(qs.length, 1);
        const poolIds = new Set(env.getGrammarUnit('unit2').questions.map(q => q.id));
        assert.truthy(poolIds.has(qs[0].id), 'single question must come from unit2');
    });

    test('QUIRK: negative n slices from the END (pool.length + n questions)', () => {
        // Math.min(-5, len) = -5 → pool.slice(0, -5) → drops the LAST 5 of the
        // shuffled pool instead of returning []. Characterized, not endorsed.
        const unit = env.getGrammarUnit('unit13');
        const qs = env.generateGrammarQuiz('unit13', -5);
        assert.equal(qs.length, unit.questions.length - 5,
            'negative n returns pool.length + n questions (slice quirk)');
        const ids = qs.map(q => q.id);
        assert.equal(new Set(ids).size, qs.length, 'quirk path still yields unique questions');
        const poolIds = new Set(unit.questions.map(q => q.id));
        assert.truthy(ids.every(id => poolIds.has(id)), 'quirk path still draws from the unit pool');
    });

    test('does NOT mutate the unit\'s questions array (order preserved)', () => {
        const unit = env.getGrammarUnit('unit5');
        const before = unit.questions.map(q => q.id).join(',');
        env.generateGrammarQuiz('unit5', 30);
        const after = unit.questions.map(q => q.id).join(',');
        assert.equal(after, before, 'generateGrammarQuiz must shuffle a copy');
    });

    test('consecutive draws are shuffled (two 30-draws from unit12 differ)', () => {
        // unit12 has 2000 questions; two identical 30-question sequences are
        // astronomically unlikely from a working Fisher-Yates shuffle.
        const a = env.generateGrammarQuiz('unit12', 30).map(q => q.id).join(',');
        const b = env.generateGrammarQuiz('unit12', 30).map(q => q.id).join(',');
        assert.truthy(a !== b, 'two consecutive 30-question draws should differ');
    });
});

// ============================================================================
// scoreGrammarQuestion / isArrangementCorrect
// ============================================================================
suite('gen: scoreGrammarQuestion — mcq and arrangement scoring', () => {
    const mc = firstMC('unit1');
    const arrQ = firstArrangement('unit8');

    test('mcq: the correct option index scores 1', () => {
        assert.equal(env.scoreGrammarQuestion(mc, mc.correct), 1);
    });

    test('mcq: a wrong option index scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(mc, wrongFor(mc)), 0);
    });

    test('mcq: null (unanswered) scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(mc, null), 0);
    });

    test('mcq: undefined scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(mc, undefined), 0);
    });

    test('mcq: comparison is STRICT — stringified correct index scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(mc, String(mc.correct)), 0,
            'userAnswer === q.correct is strict; "0" !== 0');
    });

    test('arrangement: identity order [0,1,...,len-1] scores 1', () => {
        assert.equal(env.scoreGrammarQuestion(arrQ, identityOrder(arrQ)), 1);
    });

    test('arrangement: first two parts swapped scores 0', () => {
        const swapped = identityOrder(arrQ);
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        assert.equal(env.scoreGrammarQuestion(arrQ, swapped), 0);
    });

    test('arrangement: too-short answer array scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(arrQ, identityOrder(arrQ).slice(0, -1)), 0);
    });

    test('arrangement: null scores 0', () => {
        assert.equal(env.scoreGrammarQuestion(arrQ, null), 0);
    });

    test('arrangement: a non-array answer scores 0 (isArrangementCorrect guards)', () => {
        assert.equal(env.scoreGrammarQuestion(arrQ, 3), 0);
        assert.falsy(env.isArrangementCorrect(3, arrQ.parts.length));
        assert.falsy(env.isArrangementCorrect('012', arrQ.parts.length));
    });
});

// ============================================================================
// saveGrammarSession — history append + 300 cap
// ============================================================================
suite('gen: saveGrammarSession — history append and 300-session cap', () => {
    test('appends newest-first with a g- id; returns the stored session', () => {
        freshState();
        const mc = firstMC('unit3');
        env.saveGrammarSession('unit3', [mc], [mc.correct]);
        const mc2 = firstMC('unit3', 1);
        const returned = env.saveGrammarSession('unit3', [mc2], [wrongFor(mc2)]);
        const history = env.__getAppState().grammarHistory;
        assert.equal(history.length, 2);
        assert.equal(history[0], returned, 'newest session must be at index 0');
        assert.truthy(/^g-\d+$/.test(returned.id), `id should be g-<ts>, got ${returned.id}`);
        assert.equal(returned.unitId, 'unit3');
    });

    test('score/total computed from the answers (2 right + 1 wrong of 3)', () => {
        freshState();
        const qs = [firstMC('unit1'), firstMC('unit1', 1), firstMC('unit1', 2)];
        const answers = [qs[0].correct, qs[1].correct, wrongFor(qs[2])];
        const session = env.saveGrammarSession('unit1', qs, answers);
        assert.equal(session.score, 2);
        assert.equal(session.total, 3);
    });

    test('session snapshots each question with its userAnswer', () => {
        freshState();
        const mc = firstMC('unit5');
        const session = env.saveGrammarSession('unit5', [mc], [wrongFor(mc)]);
        assert.equal(session.questions.length, 1);
        assert.equal(session.questions[0].id, mc.id);
        assert.equal(session.questions[0].userAnswer, wrongFor(mc));
        assert.equal(session.questions[0].correct, mc.correct);
    });

    test('arrangement snapshot keeps parts and the array userAnswer', () => {
        freshState();
        const arrQ = firstArrangement('unit8');
        const order = identityOrder(arrQ);
        const session = env.saveGrammarSession('unit8', [arrQ], [order]);
        const snap = session.questions[0];
        assert.equal(snap.type, 'arrangement');
        assert.deepEqual(snap.parts, arrQ.parts, 'parts must be snapshotted for review');
        assert.deepEqual(snap.userAnswer, order, 'the ordered-index answer is stored as-is');
        assert.equal(session.score, 1, 'identity order counts as correct');
    });

    test('history grows to exactly 300 (prefilled 299 + 1 save)', () => {
        freshState();
        const state = env.__getAppState();
        state.grammarHistory = Array.from({ length: 299 }, (_, i) => ({
            id: 'dummy-' + i, unitId: 'unitX', date: 1000000 - i, score: 1, total: 2, questions: []
        }));
        const mc = firstMC('unit1');
        env.saveGrammarSession('unit1', [mc], [mc.correct]);
        const history = env.__getAppState().grammarHistory;
        assert.equal(history.length, 300);
        assert.truthy(history[0].id.startsWith('g-'), 'new session should be at the front');
        assert.equal(history.filter(s => s.id.startsWith('dummy-')).length, 299,
            'no prefilled session may be evicted while under the cap');
    });

    test('history caps at 300 — the OLDEST (last) entry is dropped', () => {
        freshState();
        const state = env.__getAppState();
        state.grammarHistory = Array.from({ length: 300 }, (_, i) => ({
            id: 'dummy-' + i, unitId: 'unitX', date: 1000000 - i, score: 1, total: 2, questions: []
        }));
        const mc = firstMC('unit1');
        env.saveGrammarSession('unit1', [mc], [mc.correct]);
        const history = env.__getAppState().grammarHistory;
        assert.equal(history.length, 300, 'cap must hold at 300');
        assert.truthy(history[0].id.startsWith('g-'), 'new session at front');
        assert.falsy(history.some(s => s.id === 'dummy-299'),
            'the last (oldest) prefilled session must be evicted');
        assert.truthy(history.some(s => s.id === 'dummy-0'),
            'the most recent prefilled session must survive');
    });

    test('null appState: returns undefined and records nothing (guard)', () => {
        env.__setAppState(null);
        const mc = firstMC('unit1');
        const out = env.saveGrammarSession('unit1', [mc], [mc.correct]);
        assert.equal(out, undefined, 'guard clause returns undefined');
        assert.equal(env.__getAppState(), null, 'appState must be left untouched');
        freshState(); // restore a sane state for later suites
    });

    test('bare appState {}: grammarHistory + grammarMistakes are initialized', () => {
        env.__setAppState({});
        const mc = firstMC('unit1');
        env.saveGrammarSession('unit1', [mc], [wrongFor(mc)]);
        const state = env.__getAppState();
        assert.truthy(Array.isArray(state.grammarHistory), 'grammarHistory array is created');
        assert.equal(state.grammarHistory.length, 1);
        assert.truthy(state.grammarMistakes[mc.id],
            'grammarMistakes object is created and the miss is banked');
    });
});

// ============================================================================
// getGrammarStats / getGrammarAggregateStats
// ============================================================================
suite('gen: getGrammarStats + aggregate totals', () => {
    test('attempts counts only sessions of the requested unit', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'a', unitId: 'unit4', date: 1000, score: 3, total: 10, questions: [] },
                { id: 'b', unitId: 'unit4', date: 2000, score: 5, total: 10, questions: [] },
                { id: 'c', unitId: 'unit7', date: 3000, score: 9, total: 10, questions: [] }
            ],
            grammarMistakes: {}
        });
        assert.equal(env.getGrammarStats('unit4').attempts, 2);
        assert.equal(env.getGrammarStats('unit7').attempts, 1);
    });

    test('best on a score TIE keeps the earlier session in array order', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'first', unitId: 'unit4', date: 1000, score: 8, total: 10, questions: [] },
                { id: 'second', unitId: 'unit4', date: 2000, score: 8, total: 10, questions: [] }
            ],
            grammarMistakes: {}
        });
        // reduce uses (s.score > acc.score) — strict — so the tie is NOT replaced.
        assert.equal(env.getGrammarStats('unit4').best.id, 'first');
    });

    test('last picks the most recent DATE regardless of array position', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'older', unitId: 'unit4', date: 1000, score: 2, total: 10, questions: [] },
                { id: 'newest', unitId: 'unit4', date: 9000, score: 4, total: 10, questions: [] },
                { id: 'middle', unitId: 'unit4', date: 5000, score: 6, total: 10, questions: [] }
            ],
            grammarMistakes: {}
        });
        const stats = env.getGrammarStats('unit4');
        assert.equal(stats.last.id, 'newest');
        assert.equal(stats.best.id, 'middle', 'best is highest score, not latest');
    });

    test('appState without a grammarHistory field returns zeroed stats', () => {
        env.__setAppState({});
        assert.deepEqual(env.getGrammarStats('unit1'), { attempts: 0, best: null, last: null });
    });

    test('getGrammarAggregateStats totals correct/questions across sessions', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'a', unitId: 'unit1', date: 1, score: 8, total: 10, questions: [] },
                { id: 'b', unitId: 'unit2', date: 2, score: 6, total: 10, questions: [] },
                { id: 'c', unitId: 'unit3', date: 3, score: 10, total: 20, questions: [] }
            ],
            grammarMistakes: {}
        });
        const agg = env.getGrammarAggregateStats();
        assert.equal(agg.totalSessions, 3);
        assert.equal(agg.totalQuestions, 40);
        assert.equal(agg.avgPct, 60, '24/40 → 60%');
        assert.equal(agg.bestPct, 80, 'best single-session pct is 8/10');
        assert.equal(agg.mistakesCount, 0);
    });

    test('aggregate with empty history still reports active mistakesCount', () => {
        env.__setAppState({
            grammarHistory: [],
            grammarMistakes: {
                'x-1': { qId: 'x-1', unitId: 'unit1', topic: 't', type: 'grammar', misses: 2, lastWrong: 1, bookmarked: false, corrected: false }
            }
        });
        const agg = env.getGrammarAggregateStats();
        assert.equal(agg.totalSessions, 0);
        assert.equal(agg.avgPct, 0);
        assert.equal(agg.bestPct, 0);
        assert.equal(agg.totalQuestions, 0);
        assert.equal(agg.mistakesCount, 1);
    });
});

// ============================================================================
// Mistake bank — add / graduate lifecycle
// ============================================================================
suite('gen: mistake bank add/graduate on wrong-then-right answers', () => {
    test('a wrong mcq answer creates a full-shape bank entry', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        const entry = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(entry, 'entry must exist after a wrong answer');
        assert.equal(entry.qId, mc.id);
        assert.equal(entry.unitId, 'unit8');
        assert.equal(entry.topic, mc.topic);
        assert.equal(entry.type, mc.type);
        assert.equal(entry.misses, 1);
        assert.equal(entry.bookmarked, false);
        assert.equal(entry.corrected, false);
        assert.truthy(entry.lastWrong > 0, 'lastWrong should be a timestamp');
    });

    test('a second wrong answer increments misses (no duplicate entry)', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        const firstWrongTs = env.__getAppState().grammarMistakes[mc.id].lastWrong;
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        const bank = env.__getAppState().grammarMistakes;
        assert.equal(Object.keys(bank).length, 1, 'still exactly one entry');
        assert.equal(bank[mc.id].misses, 2);
        assert.truthy(bank[mc.id].lastWrong >= firstWrongTs);
    });

    test('graduation: answering right DELETES the (unbookmarked) entry', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        assert.truthy(env.__getAppState().grammarMistakes[mc.id]);
        env.saveGrammarSession('unit8', [mc], [mc.correct]);
        assert.equal(env.__getAppState().grammarMistakes[mc.id], undefined,
            'entry must be removed from the bank on a correct answer');
    });

    test('relapse after graduation starts FRESH at misses=1 (history lost)', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        assert.equal(env.__getAppState().grammarMistakes[mc.id].misses, 2);
        env.saveGrammarSession('unit8', [mc], [mc.correct]);   // graduates (deleted)
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]); // relapse
        assert.equal(env.__getAppState().grammarMistakes[mc.id].misses, 1,
            'graduation deletes the entry, so a relapse re-starts at 1');
    });

    test('bookmarked entry survives graduation as corrected=true, then relapses', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        env.toggleMistakeBookmark(mc.id, 'unit8', mc.topic, mc.type);
        assert.truthy(env.__getAppState().grammarMistakes[mc.id].bookmarked);
        // Right answer: entry kept (bookmark), flipped to corrected.
        env.saveGrammarSession('unit8', [mc], [mc.correct]);
        const entry = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(entry, 'bookmarked entry must NOT be deleted on graduation');
        assert.equal(entry.corrected, true);
        assert.falsy(env.getActiveMistakes().some(m => m.qId === mc.id),
            'corrected entry is not an active mistake');
        assert.truthy(env.getBookmarkedMistakes().some(m => m.qId === mc.id),
            'still listed among bookmarks');
        // Wrong again: corrected flips back and misses increments (1 → 2).
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        const relapsed = env.__getAppState().grammarMistakes[mc.id];
        assert.equal(relapsed.corrected, false);
        assert.equal(relapsed.misses, 2);
        assert.truthy(env.getActiveMistakes().some(m => m.qId === mc.id),
            'relapsed bookmark is active again');
    });

    test('a wrong arrangement answer enters the bank with type=arrangement', () => {
        freshState();
        const arrQ = firstArrangement('unit8');
        const swapped = identityOrder(arrQ);
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        env.saveGrammarSession('unit8', [arrQ], [swapped]);
        const entry = env.__getAppState().grammarMistakes[arrQ.id];
        assert.truthy(entry, 'arrangement mistakes must be banked too');
        assert.equal(entry.type, 'arrangement');
        assert.equal(entry.misses, 1);
    });

    test('a correct arrangement order graduates the arrangement mistake', () => {
        freshState();
        const arrQ = firstArrangement('unit8');
        const swapped = identityOrder(arrQ);
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        env.saveGrammarSession('unit8', [arrQ], [swapped]);
        assert.truthy(env.__getAppState().grammarMistakes[arrQ.id]);
        env.saveGrammarSession('unit8', [arrQ], [identityOrder(arrQ)]);
        assert.equal(env.__getAppState().grammarMistakes[arrQ.id], undefined);
    });

    test('a null (skipped) answer does NOT graduate an existing mistake', () => {
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        env.saveGrammarSession('unit8', [mc], [null]);
        const entry = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(entry, 'skipping must not delete an existing mistake');
        assert.equal(entry.misses, 1, 'skipping must not increment misses either');
    });

    test('an undefined (unanswered) answer neither banks nor graduates', () => {
        // The bank guard is `answers[i] !== null && answers[i] !== undefined`;
        // this pins the undefined half specifically (null is tested above).
        freshState();
        const mc = firstMC('unit8');
        env.saveGrammarSession('unit8', [mc], [undefined]);
        assert.equal(env.__getAppState().grammarMistakes[mc.id], undefined,
            'an unanswered question must not enter the bank');
        env.saveGrammarSession('unit8', [mc], [wrongFor(mc)]);
        env.saveGrammarSession('unit8', [mc], [undefined]);
        const entry = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(entry, 'undefined must not graduate an existing mistake');
        assert.equal(entry.misses, 1, 'undefined must not increment misses');
    });

    test('toggleMistakeBookmark on an unseen question creates a flagged-only entry', () => {
        freshState();
        const mc = firstMC('unit8', 3);
        env.toggleMistakeBookmark(mc.id, 'unit8', mc.topic, mc.type);
        const entry = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(entry);
        assert.equal(entry.misses, 0, 'flagged-only entry has 0 misses');
        assert.equal(entry.corrected, true, 'flagged-only entry counts as corrected');
        assert.equal(env.isQuestionBookmarked(mc.id), true);
        assert.falsy(env.getActiveMistakes().some(m => m.qId === mc.id),
            'flagged-only entry is not an active mistake');
        // Toggle off again: the flag flips but the entry itself PERSISTS in the
        // bank (misses=0, corrected=true — invisible to both active + bookmark lists).
        env.toggleMistakeBookmark(mc.id, 'unit8', mc.topic, mc.type);
        assert.equal(env.isQuestionBookmarked(mc.id), false);
        const off = env.__getAppState().grammarMistakes[mc.id];
        assert.truthy(off, 'toggle-off does not delete the entry');
        assert.equal(off.bookmarked, false);
        assert.falsy(env.getBookmarkedMistakes().some(m => m.qId === mc.id));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
