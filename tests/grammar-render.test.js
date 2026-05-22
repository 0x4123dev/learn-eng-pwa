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

    test('lesson detail shows all sibling chips for unit1/1a', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
        const html = openLessonDetail('unit1', '1a');
        assert.truthy(html && html.length > 0, 'no HTML written');
        const siblings = env.getGrammarLessonsForUnit('unit1').map(l => l.id);
        for (const sib of siblings) {
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
        const siblings = env.getGrammarLessonsForUnit('unit1')
            .map(l => l.id).filter(id => id !== '1a');
        for (const sib of siblings) {
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

// ============================================================================
// UNITS SUB-TAB — COLLAPSED-BY-DEFAULT BEHAVIOR (v3.32.2)
// ============================================================================
// All 11 unit cards on the Units sub-tab should be collapsed by default,
// showing only the header + best stat. Tapping the header expands the card
// to show quick-quiz buttons + meta. A bulk Expand-all / Collapse-all button
// sits above the list.
suite('render: Units sub-tab collapse / expand behavior', () => {
    function renderUnits() {
        env.collapseAllGrammarUnits();        // reset to default state
        env.switchGrammarSubTab('units');
        return env.document.__getLastInnerHTML('grammarScreen');
    }

    test('Units list renders the bulk toggle bar with "Expand all" by default', () => {
        const html = renderUnits();
        assert.truthy(/grammar-units-bulk-bar/.test(html),
            'bulk toggle bar missing');
        assert.truthy(/Expand all/.test(html),
            'when all collapsed, button should say "Expand all"');
        assert.falsy(/Collapse all/.test(html),
            'should NOT show "Collapse all" when nothing is expanded');
    });

    test('Every unit card is collapsed by default', () => {
        const html = renderUnits();
        // Every grammar-unit-card should have the "collapsed" class, and none
        // should be "expanded".
        const collapsedCount = (html.match(/grammar-unit-card collapsed/g) || []).length;
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(collapsedCount, env.GRAMMAR_UNITS.length, 'every unit should be collapsed');
        assert.equal(expandedCount, 0, 'no unit should be expanded by default');
    });

    test('Collapsed cards do NOT show the Quick Quiz / Long buttons', () => {
        const html = renderUnits();
        // The body (with the quiz buttons) is only rendered when expanded.
        // Should be ZERO `Quick Quiz (10)` strings on a fully-collapsed list.
        assert.falsy(/Quick Quiz \(10\)/.test(html),
            'collapsed cards should not show Quick Quiz buttons');
    });

    test('Collapsed cards still show the best-score line (one-line summary)', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
        const html = renderUnits();
        // Without any history, every card shows "Not attempted yet"
        const notAttemptedCount = (html.match(/Not attempted yet/g) || []).length;
        assert.equal(notAttemptedCount, env.GRAMMAR_UNITS.length,
            'every collapsed card should show "Not attempted yet"');
    });

    test('Tapping the header toggle expands ONE unit (others stay collapsed)', () => {
        renderUnits();
        env.toggleGrammarUnitExpanded('unit1');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        // Exactly one card should be expanded
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(expandedCount, 1, 'exactly one card should be expanded');
        // The expanded one is unit1
        assert.truthy(/grammar-unit-card expanded[^"]*"[^>]*People/.test(html) || /unit1.*\bexpanded\b/.test(html),
            'unit1 should be the expanded card');
        // It should show the Quick Quiz button now
        assert.truthy(/startGrammarQuiz\('unit1', 10\)/.test(html),
            'expanded unit1 should show Quick Quiz button');
        // Other 10 stay collapsed
        const collapsedCount = (html.match(/grammar-unit-card collapsed/g) || []).length;
        assert.equal(collapsedCount, env.GRAMMAR_UNITS.length - 1, 'other 10 stay collapsed');
    });

    test('Tapping the same header toggle again collapses the unit', () => {
        renderUnits();
        env.toggleGrammarUnitExpanded('unit1');
        env.toggleGrammarUnitExpanded('unit1');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(expandedCount, 0, 'unit1 should be re-collapsed');
    });

    test('expandAllGrammarUnits() expands every card', () => {
        renderUnits();
        env.expandAllGrammarUnits();
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(expandedCount, env.GRAMMAR_UNITS.length, 'every card should be expanded');
        // Button now says "Collapse all"
        assert.truthy(/Collapse all/.test(html), 'bulk button should now say "Collapse all"');
        // All Quick Quiz buttons should be present
        for (const u of env.GRAMMAR_UNITS) {
            const re = new RegExp(`startGrammarQuiz\\('${u.id}', 10\\)`);
            assert.truthy(re.test(html), `${u.id} should show its Quick Quiz button when expanded`);
        }
    });

    test('collapseAllGrammarUnits() collapses every card', () => {
        env.expandAllGrammarUnits();
        env.collapseAllGrammarUnits();
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(expandedCount, 0, 'every card should be re-collapsed');
    });

    test('toggleGrammarUnitExpanded carries state across re-renders', () => {
        renderUnits();
        env.toggleGrammarUnitExpanded('unit3');
        env.toggleGrammarUnitExpanded('unit7');
        // Re-render via the home function (don't reset state)
        env.switchGrammarSubTab('units');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/grammar-unit-card expanded/g) || []).length;
        assert.equal(expandedCount, 2, 'unit3 and unit7 should remain expanded after re-render');
    });
});

// ============================================================================
// LESSONS SUB-TAB — COLLAPSED-BY-DEFAULT BEHAVIOR (v3.34.0)
// ============================================================================
// Same pattern as the Units sub-tab: every lesson-unit-group is collapsed
// by default so the user can quickly scroll all 11 units; tapping the
// header expands a single unit to reveal its 6 sub-lessons + iCan goals.
suite('render: Lessons sub-tab collapse / expand behavior', () => {
    function renderLessons() {
        env.collapseAllGrammarLessonUnits();
        // Reset any open lesson detail
        env.closeGrammarLesson();
        env.switchGrammarSubTab('lessons');
        return env.document.__getLastInnerHTML('grammarScreen');
    }

    test('Lessons list renders the bulk toggle bar with "Expand all" by default', () => {
        const html = renderLessons();
        assert.truthy(/grammar-units-bulk-bar/.test(html),
            'bulk toggle bar missing');
        assert.truthy(/Expand all/.test(html),
            'when all collapsed, button should say "Expand all"');
        assert.falsy(/Collapse all/.test(html),
            'should NOT show "Collapse all" when nothing is expanded');
    });

    test('Every lesson-unit-group is collapsed by default', () => {
        const html = renderLessons();
        const collapsedCount = (html.match(/lesson-unit-group collapsed/g) || []).length;
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(collapsedCount, env.GRAMMAR_LESSONS.length,
            `every unit should be collapsed (got ${collapsedCount}/${env.GRAMMAR_LESSONS.length})`);
        assert.equal(expandedCount, 0, 'no unit should be expanded by default');
    });

    test('Collapsed lesson units do NOT show their 6 sub-lesson cards', () => {
        const html = renderLessons();
        // Sub-lesson cards have onclick="openGrammarLesson('unitX', 'X[a-f]')"
        // — when everything is collapsed, there should be zero such handlers.
        assert.falsy(/openGrammarLesson\(/.test(html),
            'collapsed list should not render sub-lesson buttons');
    });

    test('Collapsed cards still show the lesson count chip', () => {
        const html = renderLessons();
        // Every unit has 6 sub-lessons → the per-unit ".lesson-unit-count"
        // chip should appear once per unit. Match the chip class, not the
        // text (avoids false matches inside "66 lessons" in the bulk bar).
        const matches = html.match(/class="lesson-unit-count"/g) || [];
        assert.equal(matches.length, env.GRAMMAR_LESSONS.length,
            `expected ${env.GRAMMAR_LESSONS.length} count chips, got ${matches.length}`);
    });

    test('Tapping a header expands ONE unit (others stay collapsed)', () => {
        renderLessons();
        env.toggleGrammarLessonUnitExpanded('unit1');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(expandedCount, 1, 'exactly one unit should be expanded');
        // Every sub-lesson for unit1 should now be rendered as openGrammarLesson buttons
        for (const l of env.getGrammarLessonsForUnit('unit1')) {
            const re = new RegExp(`openGrammarLesson\\('unit1', '${l.id}'\\)`);
            assert.truthy(re.test(html),
                `expanded unit1 should render its sub-lesson ${l.id}`);
        }
    });

    test('Tapping the same header again collapses the unit', () => {
        renderLessons();
        env.toggleGrammarLessonUnitExpanded('unit1');
        env.toggleGrammarLessonUnitExpanded('unit1');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(expandedCount, 0, 'unit1 should be re-collapsed');
    });

    test('expandAllGrammarLessonUnits() expands every unit', () => {
        renderLessons();
        env.expandAllGrammarLessonUnits();
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(expandedCount, env.GRAMMAR_LESSONS.length,
            'every unit should be expanded');
        // Bulk button should now say "Collapse all"
        assert.truthy(/Collapse all/.test(html),
            'bulk button should now say "Collapse all"');
        // Every sub-lesson button across every unit should be present.
        // After v3.35 merges, total is dynamic (e.g., 64 instead of 66).
        const expectedTotal = env.GRAMMAR_LESSONS.reduce((sum, u) => sum + u.lessons.length, 0);
        let count = 0;
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                const re = new RegExp(`openGrammarLesson\\('${u.unitId}', '${l.id}'\\)`);
                if (re.test(html)) count++;
            }
        }
        assert.equal(count, expectedTotal, `expected all ${expectedTotal} sub-lesson buttons, got ${count}`);
    });

    test('collapseAllGrammarLessonUnits() collapses every unit', () => {
        env.expandAllGrammarLessonUnits();
        env.collapseAllGrammarLessonUnits();
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(expandedCount, 0, 'every unit should be re-collapsed');
    });

    test('Units and Lessons collapse states are independent', () => {
        // Expand a unit on the Units sub-tab
        env.expandAllGrammarUnits();
        // Switch to Lessons and verify NOTHING is expanded there yet
        env.collapseAllGrammarLessonUnits();
        env.closeGrammarLesson();
        env.switchGrammarSubTab('lessons');
        const html = env.document.__getLastInnerHTML('grammarScreen');
        const expandedCount = (html.match(/lesson-unit-group expanded/g) || []).length;
        assert.equal(expandedCount, 0,
            'Lessons-tab state should NOT be affected by Units-tab expansion');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
