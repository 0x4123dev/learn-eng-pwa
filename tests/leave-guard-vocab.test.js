// leave-guard-vocab.test.js — the matching-pairs lesson (js/lessons.js) in
// each of its flavours, and every way OUT of it, driven the way a child does.
//
// The rule, for every exercise in the app:
//   (A) in progress: every exit asks confirm(). Cancel keeps the child exactly
//       where they were, state intact. OK leaves cleanly — state emptied, the
//       bottom bar back, no checkpoint left behind.
//   (B) finished (result up): every exit is silent and nothing blocks it —
//       the bottom bar is visible, no overlay or stale flag survives.
//   (C) the next open is clean: no ghost round, no double coins, no
//       checkpoint offering the scored round back.
//
// Four flavours share lessonScreen and lessonState:
//   lesson           Home's streak CTA → goLearnToday() → startLesson(n)
//                    (also startNextLesson(); the difficulty-band Home card
//                    is legacy and no longer rendered)
//   srs-review       Learn hub "Review now" → startReviewSession() (js/srs.js)
//   mistakes-review  startReviewLesson(i) (js/home.js). Its card lived in a
//                    Profile history tab that index.html no longer carries, so
//                    a child cannot reach it today — verified as an entry all
//                    the same, because the function still exists and shares
//                    the screen.
//   daily-challenge  startDailyChallenge() (js/daily-challenge.js). Same story:
//                    #dailyChallengeCard is not in index.html.
//
// Exits: the header × (quitLesson), the four bottom-nav taps
// (switchScreen home / learnHub / mathHub, openPetBattle) and a Learn-hub card
// (switchScreen('topicsScreen'); renderTopicsHome()). The lesson hides the
// bar while it runs, so the nav routes are backstops for deep links — and the
// front line once the result is up, since the bar comes back with it.
//
// "In progress" means at least one pair attempted. A lesson with nothing
// answered closes without a question (tests/quiz-exit-guards.test.js pins
// that: nothing at stake, nothing to ask), and the same holds on every route.
const { suite, test, assert } = require('./harness');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { mountApp, loginTestUser } = require('./verify/client.js');

const settle = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';

// ---------------------------------------------------------------------------
// Driving the lesson the way a finger does.

function dueSrs(h, n) {
    const vocab = h.peek('ieltsVocabulary');
    const srs = {};
    for (let i = 0; i < n; i++) {
        srs[vocab[i].en] = { interval: 1, ease: 2.5, repetitions: 1, nextReview: Date.now() - 1000, lastReview: Date.now() - 86400000 };
    }
    return srs;
}

function mistakes(h, n) {
    const vocab = h.peek('ieltsVocabulary');
    return vocab.slice(0, n).map((w, i) => ({ word: w.en, count: 3 - (i % 3), firstMistake: Date.now(), lastMistake: Date.now() }));
}

const ACTIVITIES = {
    'lesson': {
        login: () => ({ coins: 100 }),
        start: (h) => {
            // The Home card, rendered: the streak CTA is the way a child starts
            // the next vocabulary lesson from Home.
            const panel = h.el('streakPanel').innerHTML;
            assert.truthy(panel.includes('onclick="goLearnToday()"'), 'Home renders the "Học ngay hôm nay" CTA for a child who has not studied today');
            h.sandbox.goLearnToday();
        },
        // 100 % on a regular lesson offers the sentence builder before the
        // completion card; skipping it is the child's usual tap.
        afterFinish: (h) => {
            assert.truthy(h.el('sentenceBuilderOverlay').classList.contains('active'), 'a perfect lesson offers the sentence builder first');
            h.sandbox.skipSentenceBuilder();
        },
        resultOverlay: 'lessonComplete',
        closeResult: 'closeLessonComplete',
        scored: (h) => (h.state().lessonHistory || []).length,
    },
    'lesson-next': {
        login: () => ({ coins: 100 }),
        start: (h) => { h.sandbox.startNextLesson(); },
        afterFinish: (h) => { h.sandbox.skipSentenceBuilder(); },
        resultOverlay: 'lessonComplete',
        closeResult: 'closeLessonComplete',
        scored: (h) => (h.state().lessonHistory || []).length,
    },
    'srs-review': {
        login: (h) => ({ coins: 100, srs: dueSrs(h, 6) }),
        start: (h) => {
            h.sandbox.switchScreen('learnHubScreen');
            const hub = h.el('learnHubScreen').innerHTML;
            assert.truthy(hub.includes('onclick="startReviewSession()"'), 'the Learn hub renders the Review now button');
            h.sandbox.startReviewSession();
            assert.truthy(h.peek('lessonState').isReviewSession, 'it is an SRS review');
        },
        afterFinish: null,
        resultOverlay: 'lessonComplete',
        closeResult: 'closeLessonComplete',
        scored: (h) => h.state().reviewsCompleted || 0,
        // A finished review schedules its words for later, so "open it again"
        // needs another batch due.
        reseed: (h) => { h.state().srs = dueSrs(h, 6); },
    },
    'mistakes-review': {
        login: (h) => ({ coins: 100, mistakes: mistakes(h, 5) }),
        start: (h) => {
            h.sandbox.startReviewLesson(0);
            assert.truthy(h.peek('lessonState').isPracticeSession, 'it is a mistakes review');
        },
        afterFinish: null,
        resultOverlay: 'lessonComplete',
        closeResult: 'closeLessonComplete',
        scored: (h) => h.state().points || 0,
    },
    'daily-challenge': {
        login: () => ({ coins: 100 }),
        start: (h) => {
            h.sandbox.startDailyChallenge();
            assert.truthy(h.peek('lessonState').isDailyChallenge, 'it is the daily challenge');
        },
        afterFinish: null,
        resultOverlay: 'treasureOverlay',
        closeResult: 'closeTreasureChest',
        scored: (h) => (h.state().dailyChallenge && h.state().dailyChallenge.lastDate) ? 1 : 0,
    },
};

function boot(name) {
    const act = ACTIVITIES[name];
    const h = mountApp();
    assert.deepEqual(h.loadErrors, [], 'the app boots');
    loginTestUser(h, act.login(h));
    return h;
}

function cards(h, col) { return Array.from(h.el(col).querySelectorAll('.match-card')); }
function matchedCount(h) { return cards(h, 'leftColumn').filter((c) => c.classList.contains('matched')).length; }

// Tap one unmatched left card and its partner on the right.
function matchOne(h) {
    const left = cards(h, 'leftColumn').find((c) => !c.classList.contains('matched'));
    assert.truthy(left, 'an unmatched pair remains');
    const right = cards(h, 'rightColumn').find((c) => c.dataset.word === left.dataset.word);
    left.onclick(); right.onclick();
}

// Match every remaining pair and fire the timers the last match armed
// (completeLesson runs 500 ms after the final pair).
function finish(h, act) {
    const before = h.timers.length;
    while (matchedCount(h) < h.peek('lessonState').roundWords.length) matchOne(h);
    h.timers.slice(before).filter((t) => t.kind === 'timeout').forEach((t) => t.fn());
    assert.truthy(h.peek('lessonState').finished, 'the lesson is scored');
    if (act.afterFinish) act.afterFinish(h);
    assert.truthy(h.el(act.resultOverlay).classList.contains('active'), 'the result (' + act.resultOverlay + ') is up');
}

function started(h) {
    assert.truthy(h.el('lessonScreen').classList.contains('active'), 'the lesson screen is showing');
    assert.equal(h.el('bottomNav').style.display, 'none', 'the lesson hides the bottom bar while it runs');
    assert.truthy(h.sandbox.isLessonActive(), 'isLessonActive() says so');
    const st = h.peek('lessonState');
    assert.truthy(st.roundWords.length >= 2, 'there are pairs to match');
    return st;
}

function assertLeft(h) {
    assert.falsy(h.el('lessonScreen').classList.contains('active'), 'the lesson screen is gone');
    assert.equal(h.el('bottomNav').style.display, 'flex', 'the bottom bar is back');
    assert.falsy(h.sandbox.isLessonOnScreen(), 'no lesson is on screen');
    assert.falsy(h.sandbox.isLessonActive(), 'no lesson is active');
    assert.equal(h.peek('lessonState').roundWords.length, 0, 'the state is emptied');
    for (const id of ['lessonComplete', 'sentenceBuilderOverlay', 'treasureOverlay']) {
        assert.falsy(h.el(id).classList.contains('active'), id + ' must not linger');
    }
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, 'nothing to checkpoint');
    h.sandbox.saveStudyCheckpoint();
    assert.falsy(h.store[CHECKPOINT_KEY], 'no checkpoint offers the round back');
}

// The nav routes as the buttons call them. Each returns what the child's tap
// returned (false from switchScreen means "stayed").
const NAV_ROUTES = {
    'nav Home': (h) => h.sandbox.switchScreen('homeScreen'),
    'nav Eng': (h) => h.sandbox.switchScreen('learnHubScreen'),
    'nav Toán': (h) => h.sandbox.switchScreen('mathHubScreen'),
    'nav Arena': (h) => { h.sandbox.openPetBattle(); return h.el('petBattleScreen').classList.contains('active') ? true : false; },
    'Learn hub card': (h) => {
        const hub = h.el('learnHubScreen').innerHTML;
        const m = /onclick="(switchScreen\('topicsScreen'\); renderTopicsHome\(\))"/.exec(hub);
        assert.truthy(m, 'the Topics card is rendered on the Learn hub');
        h.doc.__runInline(m[1]);
        return h.el('topicsScreen').classList.contains('active');
    },
};

// ---------------------------------------------------------------------------

for (const name of Object.keys(ACTIVITIES)) {
    const act = ACTIVITIES[name];

    suite('leave guard · ' + name + ' · (A) in progress, every exit asks', () => {
        test('the header × calls quitLesson(), which asks, and Cancel keeps the same round', () => {
            const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
            assert.truthy(/<button class="close-btn" onclick="quitLesson\(\)">×<\/button>/.test(html), 'the × goes through quitLesson()');
            const h = boot(name);
            act.start(h);
            const st = started(h);
            matchOne(h);
            assert.equal(st.matchedPairs, 1);
            h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
            h.sandbox.quitLesson();
            assert.equal(h.sandbox.__confirmLog.length, 1, 'it asked once');
            assert.truthy(/1 questions into this lesson/.test(h.sandbox.__confirmLog[0]), 'and said what is at stake');
            assert.truthy(h.el('lessonScreen').classList.contains('active'), 'Cancel: still in the lesson');
            assert.equal(h.el('bottomNav').style.display, 'none', 'Cancel: the bar stays away');
            assert.truthy(h.peek('lessonState') === st, 'Cancel: the very same state object');
            assert.equal(st.matchedPairs, 1, 'Cancel: the matched pair is still matched');
            assert.equal(matchedCount(h), 1, 'Cancel: and still marked on the board');
            assert.equal(h.sandbox.buildStudyCheckpoint().kind, 'lesson', 'Cancel: the round would still be checkpointed');
        });

        test('the header ×: OK leaves cleanly', () => {
            const h = boot(name);
            act.start(h);
            matchOne(h);
            const scoredBefore = act.scored(h);
            h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
            h.sandbox.quitLesson();
            assert.equal(h.sandbox.__confirmLog.length, 1, 'it asked');
            assertLeft(h);
            assert.equal(act.scored(h), scoredBefore, 'an abandoned round scores nothing');
        });

        for (const route of Object.keys(NAV_ROUTES)) {
            test(route + ': asks, and Cancel keeps the same round', () => {
                const h = boot(name);
                act.start(h);
                const st = started(h);
                matchOne(h);
                const board = h.el('leftColumn').innerHTML;
                h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
                const went = NAV_ROUTES[route](h);
                assert.equal(went, false, 'the child said no, so the switch must not happen');
                assert.equal(h.sandbox.__confirmLog.length, 1, 'it asked once (' + h.sandbox.__confirmLog.join(' | ') + ')');
                assert.truthy(h.el('lessonScreen').classList.contains('active'), 'Cancel: still in the lesson');
                assert.equal(h.el('bottomNav').style.display, 'none', 'Cancel: the bar stays away');
                assert.truthy(h.peek('lessonState') === st, 'Cancel: the very same state object');
                assert.equal(st.matchedPairs, 1, 'Cancel: progress intact');
                assert.equal(h.el('leftColumn').innerHTML, board, 'Cancel: the board is untouched');
                assert.truthy(h.sandbox.isLessonActive(), 'Cancel: still active');
                // And the round can go on from exactly here.
                matchOne(h);
                assert.equal(st.matchedPairs, 2, 'the next pair still matches');
            });

            test(route + ': OK leaves cleanly', async () => {
                const h = boot(name);
                act.start(h);
                matchOne(h);
                const scoredBefore = act.scored(h);
                h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
                const went = NAV_ROUTES[route](h);
                assert.equal(went, true, 'the child said yes, so the switch happens');
                assert.equal(h.sandbox.__confirmLog.length, 1, 'it asked once');
                await settle();
                assertLeft(h);
                assert.equal(act.scored(h), scoredBefore, 'an abandoned round scores nothing');
            });
        }

        test('nothing answered yet: no question on any route, and still a clean exit', () => {
            for (const route of Object.keys(NAV_ROUTES).concat(['×'])) {
                const h = boot(name);
                act.start(h);
                started(h);
                h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
                if (route === '×') h.sandbox.quitLesson(); else NAV_ROUTES[route](h);
                assert.equal(h.sandbox.__confirmLog.length, 0, route + ': nothing at stake, nothing to ask');
                assertLeft(h);
            }
        });
    });

    suite('leave guard · ' + name + ' · (B) finished, nothing blocks the way out', () => {
        test('the result comes with the bottom bar, and its own button closes silently', () => {
            const h = boot(name);
            act.start(h);
            finish(h, act);
            assert.equal(h.el('bottomNav').style.display, 'flex', 'the bar is visible on the result');
            assert.falsy(h.sandbox.isLessonActive(), 'no longer active');
            assert.truthy(h.sandbox.isLessonOnScreen(), 'but still on screen until the child leaves');
            assert.equal(h.sandbox.lessonLeaveQuestion(), null, 'nothing left to ask');
            const scored = act.scored(h);
            const coins = h.state().coins;
            h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
            h.sandbox[act.closeResult]();
            assert.equal(h.sandbox.__confirmLog.length, 0, 'no question on the way out');
            assertLeft(h);
            assert.equal(act.scored(h), scored, 'closing does not score again');
            assert.equal(h.state().coins, coins, 'closing does not pay again');
        });

        test('the header × on a finished lesson is silent', () => {
            const h = boot(name);
            act.start(h);
            finish(h, act);
            h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
            h.sandbox.quitLesson();
            assert.equal(h.sandbox.__confirmLog.length, 0, 'the coins are banked — do not question that');
            assertLeft(h);
        });

        for (const route of Object.keys(NAV_ROUTES)) {
            test(route + ' on the result: no question, overlay gone, bar back', async () => {
                const h = boot(name);
                act.start(h);
                finish(h, act);
                const scored = act.scored(h);
                const coins = h.state().coins;
                h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;   // a "no" must not even be asked for
                const went = NAV_ROUTES[route](h);
                assert.equal(went, true, 'the switch happens');
                assert.equal(h.sandbox.__confirmLog.length, 0, 'no question on the way out');
                await settle();
                assertLeft(h);
                assert.equal(act.scored(h), scored, 'leaving does not score again');
                assert.equal(h.state().coins, coins, 'leaving does not pay again');
            });
        }

        if (act.afterFinish) {
            test('leaving from the sentence builder is silent too', () => {
                const h = boot(name);
                act.start(h);
                const before = h.timers.length;
                while (matchedCount(h) < h.peek('lessonState').roundWords.length) matchOne(h);
                h.timers.slice(before).filter((t) => t.kind === 'timeout').forEach((t) => t.fn());
                assert.truthy(h.el('sentenceBuilderOverlay').classList.contains('active'));
                assert.equal(h.el('bottomNav').style.display, 'flex', 'the bar is back under the sentence builder');
                h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
                assert.equal(h.sandbox.switchScreen('homeScreen'), true);
                assert.equal(h.sandbox.__confirmLog.length, 0);
                assertLeft(h);
            });
        }
    });

    suite('leave guard · ' + name + ' · (C) the next open is clean', () => {
        test('after abandoning: a fresh round, no ghost, no checkpoint', () => {
            const h = boot(name);
            act.start(h);
            matchOne(h); matchOne(h);
            h.sandbox.__confirmAnswer = true;
            h.sandbox.switchScreen('homeScreen');
            assertLeft(h);
            // A reload now would find nothing to restore.
            h.run('_studyCheckpointRestored = false');
            assert.equal(h.sandbox.restoreStudyCheckpoint(), false, 'no checkpoint to restore');
            // Open it again.
            act.start(h);
            const st = started(h);
            assert.equal(st.matchedPairs, 0, 'a fresh round');
            assert.equal(st.correctInLesson + st.wrongInLesson, 0);
            assert.equal(matchedCount(h), 0, 'no card is pre-matched');
            assert.equal(cards(h, 'leftColumn').length, st.roundWords.length, 'a full board');
            assert.falsy(st.finished);
        });

        test('after finishing and leaving: no double score, no checkpoint, fresh round next time', async () => {
            const h = boot(name);
            act.start(h);
            finish(h, act);
            const scored = act.scored(h);
            const coins = h.state().coins;
            h.sandbox.__confirmAnswer = false;
            h.sandbox.switchScreen('learnHubScreen');
            await settle();
            assertLeft(h);
            h.run('_studyCheckpointRestored = false');
            assert.equal(h.sandbox.restoreStudyCheckpoint(), false, 'the scored round is never offered back');
            assert.equal(act.scored(h), scored);
            assert.equal(h.state().coins, coins);
            if (name === 'daily-challenge') {
                // Once a day: the card would now say "Completed today" and the
                // start refuses with a toast rather than a second round.
                h.sandbox.startDailyChallenge();
                assert.falsy(h.el('lessonScreen').classList.contains('active'), 'no second challenge today');
                return;
            }
            if (act.reseed) act.reseed(h);
            act.start(h);
            const st = started(h);
            assert.equal(st.matchedPairs, 0, 'a fresh round');
            assert.falsy(st.finished, 'not born finished');
            assert.equal(matchedCount(h), 0);
            for (const id of ['lessonComplete', 'sentenceBuilderOverlay', 'treasureOverlay']) {
                assert.falsy(h.el(id).classList.contains('active'), id + ' is not up over the new round');
            }
        });
    });
}

// The one guard in js/app.js the four flavours share.
suite('leave guard · vocab · switchScreen wiring', () => {
    test('js/app.js switchScreen asks through lessonLeaveQuestion() and clears through abandonLesson()', () => {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
        const body = src.slice(src.indexOf('function switchScreen('), src.indexOf('function navigateToProfile('));
        assert.truthy(/isLessonOnScreen\(\)/.test(body), 'the guard exists');
        assert.truthy(/lessonLeaveQuestion\(\)/.test(body), 'and shares the × wording');
        assert.truthy(/abandonLesson\(\)/.test(body), 'and tears the lesson down');
    });

    test('the update-reload guard still treats a lesson on screen as busy', () => {
        const h = boot('lesson');
        ACTIVITIES.lesson.start(h);
        assert.truthy(h.sandbox._busyWithTimedActivity(), 'an update must wait for the lesson');
        h.sandbox.__confirmAnswer = true;
        h.sandbox.switchScreen('homeScreen');
        assert.falsy(h.sandbox._busyWithTimedActivity(), 'and may proceed once it is gone');
    });
});

if (require.main === module) {
    require('./harness').runAll().then((code) => process.exit(code));
}
