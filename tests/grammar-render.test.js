// tests/grammar-render.test.js — Tests that EXECUTE the grammar UI render
// layer. These would have caught the v3.31.2 "Practice My Mistakes Quick"
// crash, which lived in quizHeaderHTML's unguarded `unit.icon`.
//
// Why this file exists: the other 4,022 tests are pure-data tests. They never
// load js/grammar-ui.js, so bugs in render functions (TypeErrors when a state
// shape is unusual) slip past. This file fills that gap with includeGrammarUI:true.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includeGrammarUI: true });

// ── Helpers to set up a render-able quiz state ───────────────────────────────
function makeMCQuizState(unitId, mode) {
    const u = env.getGrammarUnit(unitId === 'mixed' ? 'unit1' : unitId);
    const mcQs = u.questions.filter(q => q.type !== 'arrangement').slice(0, 3);
    return env._buildQuizStateFromQuestions(mcQs, unitId, mode || 'standard');
}

function makeArrangementQuizState(unitId, mode) {
    const u = env.getGrammarUnit(unitId === 'mixed' ? 'unit1' : unitId);
    const arrQs = u.questions.filter(q => q.type === 'arrangement').slice(0, 2);
    return env._buildQuizStateFromQuestions(arrQs, unitId, mode || 'standard');
}

// Wrap a function and assert it doesn't throw. Returns whatever the fn returns.
function shouldNotThrow(fn, label) {
    try {
        return fn();
    } catch (e) {
        throw new Error(`${label} threw: ${e.message}`);
    }
}

// ============================================================================
// THE BUG THAT MOTIVATED THIS FILE
// ============================================================================
suite('render: quizHeaderHTML never crashes (v3.31.2 regression)', () => {
    test('quizHeaderHTML with unitId="mixed" + mode="mistakes" does NOT throw', () => {
        // This is the EXACT state shape produced by startMistakesQuiz.
        // Before v3.31.2 this threw TypeError: Cannot read properties of undefined (reading 'icon').
        const state = makeMCQuizState('mixed', 'mistakes');
        env.__setGrammarQuizState(state);
        const html = shouldNotThrow(() => env.quizHeaderHTML(), 'quizHeaderHTML(mixed/mistakes)');
        assert.truthy(typeof html === 'string' && html.length > 0, 'header HTML empty');
        // The header should advertise mistakes mode somehow
        assert.truthy(/practice|mistake/i.test(html),
            `mixed/mistakes header should mention practice/mistakes. Got: ${html.slice(0, 200)}`);
    });

    test('quizHeaderHTML with unitId="mixed" + mode="wrong-only" does NOT throw', () => {
        const state = makeMCQuizState('mixed', 'wrong-only');
        env.__setGrammarQuizState(state);
        const html = shouldNotThrow(() => env.quizHeaderHTML(), 'quizHeaderHTML(mixed/wrong-only)');
        assert.truthy(typeof html === 'string' && html.length > 0);
        assert.truthy(/replay|wrong/i.test(html),
            `wrong-only header should mention replay/wrong. Got: ${html.slice(0, 200)}`);
    });

    test('quizHeaderHTML with unitId="mixed" + mode="lesson:8a" does NOT throw', () => {
        const state = makeMCQuizState('mixed', 'lesson:8a');
        env.__setGrammarQuizState(state);
        const html = shouldNotThrow(() => env.quizHeaderHTML(), 'quizHeaderHTML(mixed/lesson:8a)');
        assert.truthy(typeof html === 'string' && html.length > 0);
        assert.truthy(/lesson/i.test(html),
            `lesson header should say "lesson". Got: ${html.slice(0, 200)}`);
    });

    test('quizHeaderHTML for every real unit + standard mode does NOT throw', () => {
        const unitIds = env.GRAMMAR_UNITS.map(u => u.id);
        for (const unitId of unitIds) {
            const state = makeMCQuizState(unitId, 'standard');
            env.__setGrammarQuizState(state);
            const html = shouldNotThrow(() => env.quizHeaderHTML(),
                `quizHeaderHTML(${unitId}/standard)`);
            assert.truthy(html.includes(env.getGrammarUnit(unitId).name),
                `${unitId} header should include unit name`);
        }
    });
});

// ============================================================================
// renderMCQuestion EXECUTION
// ============================================================================
suite('render: renderMCQuestion never crashes', () => {
    test('renderMCQuestion with unitId="mixed" + mistakes mode does NOT throw', () => {
        const state = makeMCQuizState('mixed', 'mistakes');
        env.__setGrammarQuizState(state);
        shouldNotThrow(() => env.renderMCQuestion(), 'renderMCQuestion(mixed/mistakes)');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        assert.truthy(html && html.length > 0, 'no HTML written to #grammarScreen');
        // Should render the question text
        assert.truthy(html.includes(state.questions[0].q),
            'rendered HTML missing question text');
    });

    test('renderMCQuestion with answered state shows result + Next button', () => {
        const state = makeMCQuizState('unit1', 'standard');
        // Pretend the user answered correctly
        state.answers[0] = state.questions[0].correct;
        env.__setGrammarQuizState(state);
        shouldNotThrow(() => env.renderMCQuestion(), 'renderMCQuestion(answered)');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        assert.truthy(/correct/i.test(html), 'answered state should show "Correct"');
        assert.truthy(/next/i.test(html), 'answered state should show Next button');
    });

    test('renderMCQuestion across all 11 units (first MC question) — no crashes', () => {
        for (const u of env.GRAMMAR_UNITS) {
            const state = makeMCQuizState(u.id, 'standard');
            env.__setGrammarQuizState(state);
            shouldNotThrow(() => env.renderMCQuestion(), `renderMCQuestion(${u.id})`);
            const html = env.document.__getLastInnerHTML('grammarScreen');
            assert.truthy(html && html.length > 0, `${u.id} produced empty HTML`);
        }
    });
});

// ============================================================================
// renderArrangementQuestion EXECUTION
// ============================================================================
suite('render: renderArrangementQuestion never crashes', () => {
    test('arrangement render with unitId="mixed" + lesson mode does NOT throw', () => {
        const state = makeArrangementQuizState('mixed', 'lesson:8a');
        env.__setGrammarQuizState(state);
        shouldNotThrow(() => env.renderArrangementQuestion(),
            'renderArrangementQuestion(mixed/lesson)');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        assert.truthy(html && html.length > 0);
    });

    test('arrangement render across all 11 units — no crashes', () => {
        for (const u of env.GRAMMAR_UNITS) {
            const state = makeArrangementQuizState(u.id, 'standard');
            env.__setGrammarQuizState(state);
            shouldNotThrow(() => env.renderArrangementQuestion(),
                `renderArrangementQuestion(${u.id})`);
        }
    });
});

// ============================================================================
// finishGrammarQuiz EXECUTION (this also crashed pre-v3.31.2)
// ============================================================================
suite('render: finishGrammarQuiz never crashes', () => {
    test('finishGrammarQuiz with unitId="mixed" + mistakes mode does NOT throw', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const state = makeMCQuizState('mixed', 'mistakes');
        // Pretend all answered correctly
        state.questions.forEach((q, i) => { state.answers[i] = q.correct; });
        env.__setGrammarQuizState(state);
        shouldNotThrow(() => env.finishGrammarQuiz(), 'finishGrammarQuiz(mixed/mistakes)');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        assert.truthy(html && html.length > 0, 'no result HTML written');
        // Should show the score + a friendly label for mistakes mode
        assert.truthy(/practice|mistake/i.test(html),
            `mistakes result should mention practice/mistakes. Got: ${html.slice(0, 300)}`);
    });

    test('finishGrammarQuiz with unitId="mixed" does NOT call startGrammarQuiz("mixed", ...)', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const state = makeMCQuizState('mixed', 'mistakes');
        state.questions.forEach((q, i) => { state.answers[i] = q.correct; });
        env.__setGrammarQuizState(state);
        env.finishGrammarQuiz();
        const html = env.document.__getLastInnerHTML('grammarScreen');
        // The "Try Again" button must NOT call startGrammarQuiz('mixed', …)
        // (that would crash since 'mixed' is not a real unit). It should call
        // startMistakesQuiz instead.
        assert.falsy(/startGrammarQuiz\('mixed'/.test(html),
            'Try Again should not call startGrammarQuiz with "mixed"');
        assert.truthy(/startMistakesQuiz/.test(html),
            'mistakes result should offer startMistakesQuiz');
    });

    test('finishGrammarQuiz for each real unit — no crashes', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        for (const u of env.GRAMMAR_UNITS) {
            const state = makeMCQuizState(u.id, 'standard');
            state.questions.forEach((q, i) => { state.answers[i] = q.correct; });
            env.__setGrammarQuizState(state);
            shouldNotThrow(() => env.finishGrammarQuiz(), `finishGrammarQuiz(${u.id})`);
        }
    });
});

// ============================================================================
// startMistakesQuiz END-TO-END (the actual entry point that crashed)
// ============================================================================
suite('render: startMistakesQuiz end-to-end', () => {
    test('startMistakesQuiz(10) does NOT throw when bank has multi-unit mistakes', () => {
        // Reproduce the exact scenario from the bug report.
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        // Build a mistake bank with wrong answers in 3 different units.
        for (const unitId of ['unit1', 'unit6', 'unit11']) {
            const u = env.getGrammarUnit(unitId);
            const mc = u.questions.find(q => q.type !== 'arrangement');
            const wrong = mc.correct === 0 ? 1 : 0;
            env.saveGrammarSession(unitId, [mc], [wrong]);
        }
        // Call the exact handler that the "Quick (10)" button invokes.
        shouldNotThrow(() => env.startMistakesQuiz(10), 'startMistakesQuiz(10)');
        const state = env.__getGrammarQuizState();
        assert.truthy(state, 'no quiz state created');
        assert.equal(state.unitId, 'mixed', 'mistakes quiz should use unitId=mixed');
        assert.equal(state.mode, 'mistakes', 'mistakes quiz should use mode=mistakes');
        assert.truthy(state.questions.length >= 2, 'expected ≥2 questions');
        // And the header MUST render without crashing for that state.
        const html = env.document.__getLastInnerHTML('grammarScreen');
        assert.truthy(html && html.length > 0, 'no HTML written after startMistakesQuiz');
        assert.truthy(/practice|mistake/i.test(html),
            `mistakes quiz header should mention practice/mistakes. Got: ${html.slice(0, 200)}`);
    });

    test('startMistakesQuiz(10) on empty bank shows a toast and does NOT throw', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        shouldNotThrow(() => env.startMistakesQuiz(10), 'startMistakesQuiz with empty bank');
    });
});

// ============================================================================
// answerGrammarQuestion → nextGrammarQuestion FLOW
// ============================================================================
suite('render: answer + next flow', () => {
    test('answerGrammarQuestion then nextGrammarQuestion advances correctly', () => {
        const state = makeMCQuizState('unit1', 'standard');
        env.__setGrammarQuizState(state);
        env.renderMCQuestion();
        assert.equal(state.currentIdx, 0);
        env.answerGrammarQuestion(state.questions[0].correct);
        // After answering, state.answers[0] should be set
        assert.truthy(state.answers[0] !== null);
        env.nextGrammarQuestion();
        assert.equal(state.currentIdx, 1, 'should advance to next question');
    });

    test('nextGrammarQuestion on final question triggers finish', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const state = makeMCQuizState('unit1', 'standard');
        // Answer all questions
        state.questions.forEach((q, i) => { state.answers[i] = q.correct; });
        state.currentIdx = state.questions.length - 1;
        env.__setGrammarQuizState(state);
        shouldNotThrow(() => env.nextGrammarQuestion(), 'nextGrammarQuestion on final');
        // History should have a new session
        const history = env.__getAppState().grammarHistory;
        assert.truthy(history.length > 0, 'session should be saved');
    });
});

// ============================================================================
// LESSON DETAIL — SIBLING NAVIGATION CHIPS (v3.32.1)
// ============================================================================
// When viewing lesson 1a, the detail page should show jump-chips for 1b/1c/
// 1d/1e/1f next to the back button so the user can quickly navigate between
// sub-lessons of the same unit without going back to the lesson list.
suite('render: lesson detail shows sibling navigation chips', () => {
    // Helper: open lesson detail (requires sub-tab switched to 'lessons')
    function openLessonDetail(unitId, lessonId) {
        env.switchGrammarSubTab('lessons');
        env.openGrammarLesson(unitId, lessonId);
        return env.document.__getLastInnerHTML('grammarScreen');
    }

    test('lesson detail shows all 6 sibling chips for unit1/1a', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
        const html = openLessonDetail('unit1', '1a');
        assert.truthy(html && html.length > 0, 'no HTML written');
        for (const sib of ['1a', '1b', '1c', '1d', '1e', '1f']) {
            assert.truthy(html.includes(`>${sib}<`),
                `sibling chip for "${sib}" missing in lesson 1a detail`);
        }
    });

    test('current lesson chip has the "active" class (1a → 1a is active)', () => {
        const html = openLessonDetail('unit1', '1a');
        // 1a should appear with "active" class
        const activeRe = /lesson-sibling-chip\s+active[^>]*>1a</;
        assert.truthy(activeRe.test(html), `expected 1a chip with .active class`);
    });

    test('non-current chips have an onclick that navigates to the sibling', () => {
        const html = openLessonDetail('unit1', '1a');
        for (const sib of ['1b', '1c', '1d', '1e', '1f']) {
            const re = new RegExp(`openGrammarLesson\\('unit1', '${sib}'\\)`);
            assert.truthy(re.test(html), `chip "${sib}" missing openGrammarLesson('unit1','${sib}') handler`);
        }
    });

    test('opening a sibling lesson updates the active chip and the title', () => {
        openLessonDetail('unit1', '1a');
        const html = openLessonDetail('unit1', '1d');
        // 1d should now be the active chip
        const activeRe = /lesson-sibling-chip\s+active[^>]*>1d</;
        assert.truthy(activeRe.test(html), 'after navigating to 1d, the 1d chip should be active');
        // And the detail title should be lesson 1d's title
        const lesson1d = env.getGrammarLesson('unit1', '1d');
        assert.truthy(html.includes(lesson1d.title),
            `expected lesson 1d title "${lesson1d.title}" in HTML`);
    });

    test('every unit shows its 6 sibling chips on every sub-lesson', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            for (const lesson of u.lessons) {
                const html = openLessonDetail(u.unitId, lesson.id);
                for (const sib of u.lessons) {
                    assert.truthy(html.includes(`>${sib.id}<`),
                        `${u.unitId}/${lesson.id} detail is missing sibling chip ${sib.id}`);
                }
            }
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
