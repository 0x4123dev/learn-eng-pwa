// tests/gen-wordform-quiz.test.js — Word form quiz STATE MACHINE (js/wordform.js):
// start/answer/next/finish lifecycle, coin + score math, history sessions, and
// review-quiz construction from qids. Complements tests/wordform.test.js, which
// locks the bank data shape (this file asserts behaviour, not data integrity).
const { suite, test, assert } = require('./harness');
const path = require('path');

const { WORDFORM_QUESTIONS: BANK } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));
global.WORDFORM_QUESTIONS = BANK;
global.appState = { coins: 0, wordformHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
// Prescribed DOM stub: getElementById -> null so renderWfQuestion early-returns.
global.document = { getElementById: () => null, querySelectorAll: () => [] };

const wf = require(path.join(__dirname, '..', 'js', 'wordform.js'));

// Known fixtures (locked by tests/wordform.test.js): wf-1 mcq correct=3,
// wf-2 mcq correct=0 (so index 1 is wrong for BOTH), wft-1 text answer "education".
const WF1 = 'wf-1', WF2 = 'wf-2', WFT1 = 'wft-1';

// ---- helpers ---------------------------------------------------------------
function makeEl() { return { innerHTML: '', value: '', focus() {} }; }

function useDoc(map) {
    global.document = {
        getElementById: id => (map && Object.prototype.hasOwnProperty.call(map, id)) ? map[id] : null,
        querySelectorAll: () => [],
    };
}

// Reset globals + module quiz state before each test. doc:null → every
// getElementById returns null (the prescribed stub).
function reset(opts = {}) {
    wf.abandonWordformQuiz();
    global.WORDFORM_QUESTIONS = BANK;
    global.appState = ('appState' in opts) ? opts.appState : { coins: 0, wordformHistory: [] };
    global.currentUser = 'tester';
    global.saveUserData = opts.saveUserData || (() => {});
    useDoc(opts.doc || null);
    return global.appState;
}

// Answer every remaining question with index `idx` and advance; the last
// nextWfQuestion() triggers finishWordformQuiz (needs a wordformScreen in doc).
function playAll(idx) {
    let guard = 0;
    while (wf.isWordformQuizActive() && guard++ < 700) {
        wf.answerWfQuestion(idx);
        wf.nextWfQuestion();
    }
    if (guard >= 700) throw new Error('quiz never finished');
}

function lastSession() { return global.appState.wordformHistory[0]; }

// ---- lifecycle & quiz length ------------------------------------------------
suite('gen: wordform quiz lifecycle', () => {
    test('no quiz active initially; abandon while idle is a safe no-op', () => {
        reset();
        assert.falsy(wf.isWordformQuizActive());
        wf.abandonWordformQuiz();
        assert.falsy(wf.isWordformQuizActive());
    });

    test('startWordformQuiz(5) with missing screen does not throw (renderWfQuestion early-returns) and activates the quiz', () => {
        reset(); // doc.getElementById -> null everywhere
        wf.startWordformQuiz(5);
        assert.truthy(wf.isWordformQuizActive(), 'quiz should be active even though nothing rendered');
    });

    test('renderWordformHome: early-returns on a missing screen, renders CTAs + bank size on a real one', () => {
        reset();
        wf.renderWordformHome(); // null screen — must not throw
        const screen = makeEl();
        useDoc({ wordformScreen: screen });
        wf.renderWordformHome();
        assert.truthy(screen.innerHTML.includes('600 câu'), 'hero shows the bank size');
        assert.truthy(screen.innerHTML.includes('startWordformQuiz(20)'), 'quick-practice CTA wired');
        assert.truthy(screen.innerHTML.includes('startWordformQuiz(10)'), 'short-practice CTA wired');
        assert.truthy(screen.innerHTML.includes('No practice yet'), 'empty history note shown');
        assert.falsy(wf.isWordformQuizActive(), 'home render must not start a quiz');
    });

    test('startWordformQuiz(5) builds a 5-question quiz (session total = 5)', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformQuiz(5);
        assert.truthy(screen.innerHTML.includes('>1/5<'), 'first question renders progress 1/5');
        playAll(0);
        assert.equal(lastSession().total, 5);
    });

    test('startWordformQuiz(10) builds a 10-question quiz (session total = 10)', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz(10);
        playAll(0);
        assert.equal(lastSession().total, 10);
    });

    test("startWordformQuiz('all') uses the whole 600-question bank in bank order", () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz('all');
        wf.finishWordformQuiz(); // finish with nothing answered → every q lands in wrong[]
        const s = lastSession();
        assert.equal(s.total, 600);
        assert.deepEqual(s.wrong.map(w => w.qid), BANK.map(q => q.id), "'all' must not shuffle");
    });

    test('startWordformQuiz(9999) is capped at the bank size (600)', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz(9999);
        wf.finishWordformQuiz();
        assert.equal(lastSession().total, 600);
    });

    test('startWordformQuiz on an empty bank does not start a quiz', () => {
        reset();
        global.WORDFORM_QUESTIONS = [];
        wf.startWordformQuiz(5);
        assert.falsy(wf.isWordformQuizActive());
        global.WORDFORM_QUESTIONS = BANK;
    });

    test('abandonWordformQuiz deactivates an active quiz', () => {
        reset();
        wf.startWordformQuiz(5);
        assert.truthy(wf.isWordformQuizActive());
        wf.abandonWordformQuiz();
        assert.falsy(wf.isWordformQuizActive());
    });

    test('starting a new quiz replaces the previous one', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz(5);
        wf.answerWfQuestion(0);
        wf.startWordformReviewQuiz([WF1]); // replaces the 5-question quiz
        wf.finishWordformQuiz();
        assert.equal(lastSession().total, 1, 'finish must reflect the newest quiz');
    });

    test('a random quiz picks distinct questions that all resolve in the bank', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz(10);
        wf.finishWordformQuiz();
        const qids = lastSession().wrong.map(w => w.qid);
        assert.equal(qids.length, 10);
        assert.equal(new Set(qids).size, 10, 'no duplicate questions in a quiz');
        qids.forEach(id => assert.truthy(wf.wordformById(id), `unknown qid ${id}`));
    });
});

// ---- answering: mcq ---------------------------------------------------------
suite('gen: wordform answering (mcq)', () => {
    test('correct answer is recorded and scores 1', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3); // wf-1 correct = 3
        assert.truthy(screen.innerHTML.includes('See results'), 'last answered question offers See results');
        assert.truthy(screen.innerHTML.includes('✅'), 'correct feedback rendered');
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 1);
        assert.deepEqual(lastSession().wrong, []);
    });

    test('wrong answer is recorded as {qid, ua:<option index>}', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(1);
        assert.truthy(screen.innerHTML.includes('❌ Đáp án đúng: <b>education</b>'), 'wrong feedback names the answer');
        wf.finishWordformQuiz();
        assert.deepEqual(lastSession().wrong, [{ qid: WF1, ua: 1 }]);
    });

    test('double-answer is ignored: wrong then correct stays wrong', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(1); // wrong — locks the answer
        wf.answerWfQuestion(3); // correct, but must be ignored
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 0);
        assert.equal(lastSession().wrong[0].ua, 1, 'first answer must be the one kept');
    });

    test('double-answer is ignored: correct then wrong stays correct', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.answerWfQuestion(1);
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 1);
        assert.deepEqual(lastSession().wrong, []);
    });

    test('out-of-range option index is still recorded (as a wrong answer)', () => {
        // characterization: answerWfQuestion does no bounds check
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(7);
        wf.finishWordformQuiz();
        assert.deepEqual(lastSession().wrong, [{ qid: WF1, ua: 7 }]);
    });

    test('answerWfQuestion with no active quiz is a no-op', () => {
        reset();
        wf.answerWfQuestion(0); // must not throw
        assert.falsy(wf.isWordformQuizActive());
    });

    test('nextWfQuestion with no active quiz is a no-op', () => {
        reset();
        wf.nextWfQuestion(); // must not throw
        assert.falsy(wf.isWordformQuizActive());
    });

    test('nextWfQuestion advances so every question can be answered exactly once', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1, WF2]); // index 1 is wrong for both
        wf.answerWfQuestion(1);
        wf.nextWfQuestion();
        assert.truthy(screen.innerHTML.includes('>2/2<'), 'progress advances to 2/2');
        wf.answerWfQuestion(1);
        wf.nextWfQuestion(); // past the last question → finish
        const s = lastSession();
        assert.equal(s.score, 0);
        assert.deepEqual(s.wrong.map(w => w.ua), [1, 1], 'both answers recorded');
        assert.deepEqual(s.wrong.map(w => w.qid).sort(), [WF1, WF2]);
    });

    test('without nextWfQuestion the second answer targets the same (locked) question', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1, WF2]);
        wf.answerWfQuestion(1);
        wf.answerWfQuestion(2); // same idx — ignored, question 2 stays unanswered
        wf.finishWordformQuiz();
        const uas = lastSession().wrong.map(w => w.ua).sort();
        assert.deepEqual(uas, [1, null], 'one locked answer + one unanswered null');
    });
});

// ---- answering: typed (text) questions --------------------------------------
suite('gen: wordform answering (text)', () => {
    function textQuiz(inputValue) {
        const input = makeEl();
        input.value = inputValue;
        reset({ doc: { wordformScreen: makeEl(), wfTextInput: input } });
        wf.startWordformReviewQuiz([WFT1]); // answer: "education"
        return input;
    }

    test('submitWfText grades an accepted answer correct (case/space-insensitive)', () => {
        textQuiz('  Education ');
        wf.submitWfText();
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 1);
        assert.deepEqual(lastSession().wrong, []);
    });

    test('submitWfText strips trailing punctuation when grading', () => {
        textQuiz('education.');
        wf.submitWfText();
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 1);
    });

    test('wrong typed answer is recorded with its trimmed text as ua', () => {
        textQuiz('  educate  ');
        wf.submitWfText();
        wf.finishWordformQuiz();
        assert.deepEqual(lastSession().wrong, [{ qid: WFT1, ua: 'educate' }]);
    });

    test('submitWfText with a missing input element records a blank wrong answer', () => {
        reset({ doc: { wordformScreen: makeEl() } }); // no wfTextInput in the doc
        wf.startWordformReviewQuiz([WFT1]);
        wf.submitWfText();
        wf.finishWordformQuiz();
        assert.deepEqual(lastSession().wrong, [{ qid: WFT1, ua: '' }]);
    });

    test('double submit is ignored — first typed answer is kept', () => {
        const input = textQuiz('educate');
        wf.submitWfText();
        input.value = 'education'; // now correct, but the answer is locked
        wf.submitWfText();
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 0);
        assert.equal(lastSession().wrong[0].ua, 'educate');
    });

    test('submitWfText with no active quiz is a no-op', () => {
        reset();
        wf.submitWfText(); // must not throw
        assert.falsy(wf.isWordformQuizActive());
    });

    test('answerWfQuestion on a text question always grades wrong (q.correct is undefined)', () => {
        // characterization: the mcq handler does not special-case text questions
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WFT1]);
        wf.answerWfQuestion(0);
        wf.finishWordformQuiz();
        assert.equal(lastSession().score, 0);
        assert.deepEqual(lastSession().wrong, [{ qid: WFT1, ua: 0 }]);
    });
});

// ---- finish: score, coins, history -------------------------------------------
suite('gen: wordform finish — coins & history', () => {
    test('finishWordformQuiz with no active quiz is a no-op (even without a screen)', () => {
        reset();
        wf.finishWordformQuiz(); // must not throw
        assert.equal(global.appState.wordformHistory.length, 0);
    });

    test('coins increase by 5 per correct answer', () => {
        const st = reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.equal(st.coins, 5);
    });

    test('coins accumulate onto the existing balance', () => {
        const st = reset({ doc: { wordformScreen: makeEl() }, appState: { coins: 100, wordformHistory: [] } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.equal(st.coins, 105);
    });

    test('zero score earns zero coins and initializes coins from undefined to 0', () => {
        const st = reset({ doc: { wordformScreen: makeEl() }, appState: {} }); // no coins key yet
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(1);
        wf.finishWordformQuiz();
        assert.equal(st.coins, 0, 'coins property is created even when nothing was earned');
    });

    test('coins delta is always exactly 5 × session score (random 10-question quiz)', () => {
        const st = reset({ doc: { wordformScreen: makeEl() }, appState: { coins: 40, wordformHistory: [] } });
        wf.startWordformQuiz(10);
        playAll(0);
        const s = lastSession();
        assert.equal(st.coins - 40, 5 * s.score);
        assert.equal(s.score, s.total - s.wrong.length, 'score + wrong must cover all questions');
    });

    test("session shape: id 'wf-<timestamp>', numeric date, score/total/wrong", () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        const before = Date.now();
        wf.finishWordformQuiz();
        const s = lastSession();
        assert.inRange(s.date, before, Date.now(), 'date must be the Date.now() at finish time');
        assert.equal(s.id, 'wf-' + s.date);
        assert.equal(s.total, 1);
        assert.truthy(Array.isArray(s.wrong));
    });

    test('history is unshifted — newest session first, older sessions kept behind it', () => {
        const old = { id: 'wf-old', date: 1, score: 1, total: 1, wrong: [] };
        const st = reset({ doc: { wordformScreen: makeEl() }, appState: { coins: 0, wordformHistory: [old] } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.equal(st.wordformHistory.length, 2);
        assert.equal(st.wordformHistory[1].id, 'wf-old', 'previous session pushed to index 1');
        assert.truthy(st.wordformHistory[0].id !== 'wf-old');
    });

    test('history is capped at 300 entries — the oldest is dropped', () => {
        const filler = [];
        for (let i = 0; i < 300; i++) filler.push({ id: 'old-' + i, date: i, score: 1, total: 1, wrong: [] });
        const st = reset({ doc: { wordformScreen: makeEl() }, appState: { coins: 0, wordformHistory: filler } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.equal(st.wordformHistory.length, 300);
        assert.truthy(st.wordformHistory[0].id.startsWith('wf-'), 'newest session at the front');
        assert.equal(st.wordformHistory[299].id, 'old-298', 'old-299 fell off the end');
    });

    test('quiz is deactivated after a completed finish', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.falsy(wf.isWordformQuizActive());
    });

    test('finish saves coins+history BEFORE rendering: missing screen throws but state is already persisted', () => {
        // characterization: finishWordformQuiz has no null check on the screen
        // element, so with the null-document stub it crashes at screen.innerHTML —
        // after the coin award and history save, but before clearing _wfQuiz.
        const st = reset(); // every getElementById → null
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        assert.throws(() => wf.finishWordformQuiz(), 'null screen crashes the result render');
        assert.equal(st.coins, 5, 'coins were awarded before the crash');
        assert.equal(st.wordformHistory.length, 1, 'session was saved before the crash');
        assert.truthy(wf.isWordformQuizActive(), 'quiz never got cleared');
        wf.abandonWordformQuiz();
    });

    test('saveUserData throwing trims history down to just the newest session', () => {
        const filler = [
            { id: 'old-a', date: 1, score: 1, total: 1, wrong: [] },
            { id: 'old-b', date: 2, score: 1, total: 1, wrong: [] },
            { id: 'old-c', date: 3, score: 1, total: 1, wrong: [] },
        ];
        const st = reset({
            doc: { wordformScreen: makeEl() },
            appState: { coins: 0, wordformHistory: filler },
            saveUserData: () => { throw new Error('quota exceeded'); },
        });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz(); // retry loop pops old sessions until save "fits"
        assert.equal(st.wordformHistory.length, 1);
        assert.truthy(st.wordformHistory[0].id.startsWith('wf-'), 'only the new session survives');
    });

    test('finish survives a missing appState (coins/history silently skipped)', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        delete global.appState;
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz(); // must not throw
        assert.falsy(wf.isWordformQuizActive());
        global.appState = { coins: 0, wordformHistory: [] };
    });

    test('unanswered questions count as wrong with ua:null', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformQuiz(5);
        wf.finishWordformQuiz(); // nothing answered
        const s = lastSession();
        assert.equal(s.score, 0);
        assert.equal(s.wrong.length, 5);
        s.wrong.forEach(w => assert.equal(w.ua, null));
    });

    test('result screen shows the score line and the coin reward', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        assert.truthy(screen.innerHTML.includes('1/1 (100%)'), 'score line rendered');
        assert.truthy(screen.innerHTML.includes('+5 🪙 earned'), 'coin reward rendered');
    });

    test('result screen offers a re-practice button carrying the missed qids', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(1);
        wf.finishWordformQuiz();
        assert.truthy(screen.innerHTML.includes('startWordformReviewQuiz(["wf-1"])'), 're-practice wiring');
    });
});

// ---- review quiz from qids + past-session view --------------------------------
suite('gen: wordform review quiz & sessions', () => {
    test('startWordformReviewQuiz builds a quiz from the given qids', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1, WF2]);
        assert.truthy(wf.isWordformQuizActive());
        wf.finishWordformQuiz();
        const s = lastSession();
        assert.equal(s.total, 2);
        assert.deepEqual(s.wrong.map(w => w.qid).sort(), [WF1, WF2]);
    });

    test('unknown qids are filtered out', () => {
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1, 'nope', 'wf-999999']);
        wf.finishWordformQuiz();
        assert.equal(lastSession().total, 1);
        assert.equal(lastSession().wrong[0].qid, WF1);
    });

    test('all-unknown qids start no quiz', () => {
        reset();
        wf.startWordformReviewQuiz(['nope', 'zzz']);
        assert.falsy(wf.isWordformQuizActive());
    });

    test('empty qid list starts no quiz', () => {
        reset();
        wf.startWordformReviewQuiz([]);
        assert.falsy(wf.isWordformQuizActive());
    });

    test('non-array input starts no quiz', () => {
        reset();
        wf.startWordformReviewQuiz('wf-1');
        assert.falsy(wf.isWordformQuizActive());
    });

    test('duplicate qids are kept (not deduped)', () => {
        // characterization: a question missed twice appears twice in the drill
        reset({ doc: { wordformScreen: makeEl() } });
        wf.startWordformReviewQuiz([WF1, WF1]);
        wf.finishWordformQuiz();
        assert.equal(lastSession().total, 2);
        assert.deepEqual(lastSession().wrong.map(w => w.qid), [WF1, WF1]);
    });

    test('openWfSession renders a saved session read-only', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(3);
        wf.finishWordformQuiz();
        screen.innerHTML = '';
        wf.openWfSession(0);
        assert.truthy(screen.innerHTML.includes('1/1 (100%)'), 'session score rendered');
        assert.truthy(screen.innerHTML.includes('Perfect session'), 'perfect sessions show the empty-review note');
    });

    test('home after a missed session: review panel chips + history filter chips', () => {
        const screen = makeEl();
        reset({ doc: { wordformScreen: screen } });
        wf.startWordformReviewQuiz([WF1]);
        wf.answerWfQuestion(1); // miss it → a 0/1 "weak" session
        wf.finishWordformQuiz();
        wf.renderWordformHome();
        assert.truthy(screen.innerHTML.includes('📉 Words to review'), 'review panel appears after a miss');
        assert.truthy(screen.innerHTML.includes('Practice wrong answers (1)'), 'panel CTA carries the miss count');
        assert.truthy(screen.innerHTML.includes('education<i>1×</i>'), 'missed word chip shows answer + miss count');
        wf.setWfHistoryFilter('perfect'); // the 0% session is weak, not perfect
        assert.truthy(screen.innerHTML.includes('No sessions match this filter.'), 'non-matching tier shows empty note');
        wf.setWfHistoryFilter('weak');
        assert.truthy(screen.innerHTML.includes('openWfSession(0)'), 'weak filter lists the 0% session');
        wf.setWfHistoryFilter('all'); // restore module-level filter state for other tests
    });

    test('openWfSession with an out-of-range index is a no-op', () => {
        reset(); // empty history, null screen — must not throw
        wf.openWfSession(0);
        wf.openWfSession(42);
        assert.equal(global.appState.wordformHistory.length, 0);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
