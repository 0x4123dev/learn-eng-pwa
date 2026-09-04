// tests/audit-low-fixes.test.js — the five low-severity defects from the
// 2026-09-04 codebase audit, locked in so they cannot come back.
//
//   1. css: `height: 100dvh` with no `100vh` line in front of it
//   2. css: three selectors declared twice, ~7,000 lines apart
//   3. js/home.js: renderWordPet() re-parsed the whole profile every render
//   4. js/grammar-ui.js: history unit chips hard-coded to unit8..unit11
//   5. js/word-hunt.js: completeWordHunt() could fire twice for one game
//
// 1 and 2 are asserted against the stylesheet source (the precedent is
// tests/ipad-layout.test.js and tests/extra-coverage.test.js — there is no
// layout engine here). 3, 4 and 5 execute the real code.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

// ============================================================================
// 1. dvh needs a vh line in FRONT of it, not a min-height behind it
// ============================================================================
// iOS Safari before 15.4 — iPad Air 1, iPad mini 2/3, the hand-me-down tablets
// this app actually runs on — does not know `dvh`. It throws the whole
// declaration away. If that is the ONLY `height` on html/body, the height
// falls back to auto, `.app { height: 100% }` resolves to auto, and
// `.screens-container` (whose children are all position:absolute) collapses to
// 0px: bottom nav floating on a blank gradient, no app.
suite('css: every 100dvh has a 100vh fallback declared BEFORE it', () => {
    // Comments carry braces and example declarations of their own, so they go
    // first — everything below reads real CSS only.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Property declarations inside one rule block, in source order.
    function declarations(block, prop) {
        const out = [];
        const re = new RegExp('(?:^|[;{])\\s*' + prop + '\\s*:\\s*([^;}]+)', 'g');
        let m;
        while ((m = re.exec(block)) !== null) out.push(m[1].trim());
        return out;
    }
    function ruleBlock(selector) {
        const i = bare.indexOf(selector + ' {');
        const j = i < 0 ? bare.indexOf(selector + '{') : i;
        assert.truthy(j >= 0, `rule not found: ${selector}`);
        return bare.slice(j, bare.indexOf('}', j) + 1);
    }

    test('html, body declares height: 100vh and only then height: 100dvh', () => {
        const block = ruleBlock('html, body');
        const heights = declarations(block, 'height');
        assert.deepEqual(heights, ['100vh', '100dvh'],
            'order matters: a browser without dvh keeps the FIRST height it understands');
    });

    test('html, body keeps its min-height: 100vh safety net too', () => {
        const block = ruleBlock('html, body');
        assert.deepEqual(declarations(block, 'min-height'), ['100vh']);
    });

    test('.nr-builder.rotated falls back on both axes, vh/vw first', () => {
        const block = ruleBlock('.nr-builder.rotated');
        assert.deepEqual(declarations(block, 'width'), ['100vh', '100dvh'],
            'the rotated builder is 90deg-turned: its width is a viewport HEIGHT');
        assert.deepEqual(declarations(block, 'height'), ['100vw', '100dvw']);
    });

    test('.yard-shop-overlay falls back too', () => {
        const block = ruleBlock('.pet-info-modal-overlay.yard-shop-overlay');
        assert.deepEqual(declarations(block, 'height'), ['100vh', '100dvh']);
    });

    test('no rule sets a bare `height: 100dvh` with nothing in front of it', () => {
        // Scan every block that sets the `height` property to 100dvh (min-height
        // and max-height degrade to auto, which is harmless) and prove a plain
        // 100vh height is declared earlier in the SAME block.
        const re = /(?:^|[;{\s])height\s*:\s*100dvh/g;
        let m, checked = 0;
        while ((m = re.exec(bare)) !== null) {
            const open = bare.lastIndexOf('{', m.index);
            const block = bare.slice(open, m.index);
            assert.truthy(/(?:^|[;{\s])height\s*:\s*100vh/.test(block),
                `a height:100dvh at index ${m.index} has no height:100vh before it`);
            checked++;
        }
        assert.truthy(checked >= 2, `expected to find several height:100dvh sites, saw ${checked}`);
    });
});

// ============================================================================
// 2. one selector, one home
// ============================================================================
// These three were each declared twice, ~7,000 lines apart, with conflicting
// layouts (absolute→sticky, flex→grid, flex→grid). The later block won purely
// by source order, so the earlier one was dead code that would silently come
// back to life if anyone moved a section or wrapped the later block in a
// media query.
suite('css: the pet-info / shop selectors are declared exactly once', () => {
    // Count top-level occurrences of `selector {` — a rule that OPENS with
    // exactly this selector. Compound/descendant uses and media-query
    // overrides (`.pet-info-stages { grid-template-columns: … }` inside an
    // @media) are legitimate, so only count declarations that set `display`.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    function layoutBlocks(selector) {
        const re = new RegExp('(?:^|[}\\s])' + selector.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'g');
        const hits = [];
        let m;
        while ((m = re.exec(bare)) !== null) {
            if (/(?:^|[;{])\s*display\s*:/.test(m[1])) hits.push(m[1]);
        }
        return hits;
    }

    for (const sel of ['.pet-info-close', '.pet-info-stages', '.shop-tabs']) {
        test(`${sel} has one block that sets display`, () => {
            const hits = layoutBlocks(sel);
            assert.equal(hits.length, 1,
                `${sel} is laid out in ${hits.length} places — the earlier one is dead until someone reorders the file`);
        });
    }

    test('the surviving .pet-info-stages keeps the margin-bottom it inherited', () => {
        // home.js renders two .pet-info-stages grids back to back (evolution
        // stages, then foods). The 16px gap between them came from the deleted
        // duplicate; dropping it would have closed the gap.
        const hits = layoutBlocks('.pet-info-stages');
        assert.truthy(/margin-bottom:\s*16px/.test(hits[0]),
            'margin-bottom: 16px had to move down with the block, not vanish');
        assert.truthy(/display:\s*grid/.test(hits[0]), 'the grid layout is the one that applies');
    });

    test('the surviving .pet-info-close keeps `right` and is the sticky one', () => {
        const hits = layoutBlocks('.pet-info-close');
        assert.truthy(/position:\s*sticky/.test(hits[0]), 'sticky is the block that wins today');
        assert.truthy(/right:\s*12px/.test(hits[0]),
            '`right` was set only by the deleted block, so it had to be carried over');
    });

    test('.shop-tabs is the 3-column grid, and no flex twin survives', () => {
        const hits = layoutBlocks('.shop-tabs');
        assert.truthy(/display:\s*grid/.test(hits[0]));
        assert.falsy(/display:\s*flex/.test(hits[0]));
    });
});

// ============================================================================
// 3. Home must not re-parse the whole profile to read two fields
// ============================================================================
// getUserData() is a JSON.parse of the entire profile blob, bounded only by
// APPSTATE_SOFT_LIMIT (2.4MB). renderWordPet() called it on EVERY render —
// every return to Home, every claimCoinGrants / buyFood / cleanPoop /
// toggleAccessory — just to read `avatar` and `streak`, both of which are
// already on appState (js/app.js does `appState = userData` at login).
suite('home: renderWordPet reads avatar and streak from appState, not from disk', () => {
    function mountHome(state) {
        const env = loadAppCode();
        env.localStorage.clear();
        for (const id of ['petHeroZone', 'petHeroStage', 'petHeroTopbar', 'petHeroXpbar',
                          'habitatEmojis', 'streakPanel']) {
            env.document.getElementById(id);
        }
        const app = Object.assign({
            username: 'Tester', avatar: '🐶', streak: 0, bestStreak: 0,
            points: 0, coins: 0, dogLevel: 1, dogGrowthXP: 0,
            // An unnamed dog paints the naming form and blanks the topbar.
            petName: 'Rex',
            lessonHistory: [], srs: {}, mistakes: [], currentLesson: 0
        }, state || {});
        env.__setAppState(app);
        env.__setCurrentUser('Tester');
        // Put a DIFFERENT, stale copy on disk. If renderWordPet still reads the
        // profile, the stale values are what it paints.
        env.localStorage.setItem('flashlingo-user-Tester', JSON.stringify(
            Object.assign({}, app, { avatar: '👻', streak: 999 })));
        // Count profile reads. localStorage is the same object the vm sees.
        const reads = [];
        const realGet = env.localStorage.getItem;
        env.localStorage.getItem = function (k) {
            if (k === 'flashlingo-user-Tester') reads.push(k);
            return realGet.call(this, k);
        };
        return { env, reads, app };
    }

    test('renderWordPet() does not read the stored profile at all', () => {
        const { env, reads } = mountHome({ avatar: '🐶', streak: 7 });
        env.renderWordPet();
        assert.equal(reads.length, 0,
            'the profile blob was parsed again for two fields already in appState');
    });

    test('it paints the LIVE appState values, not the stale stored ones', () => {
        const { env } = mountHome({ avatar: '🐶', streak: 7 });
        env.renderWordPet();
        const html = env.document.__getLastInnerHTML('petHeroTopbar') || '';
        assert.truthy(html.includes('🐶'), `live avatar missing from: ${html.slice(0, 200)}`);
        assert.truthy(html.includes('🔥 7'), 'live streak missing');
        assert.falsy(html.includes('👻'), 'the stale on-disk avatar must not win');
        assert.falsy(html.includes('999'), 'the stale on-disk streak must not win');
    });

    test('a profile with no avatar still falls back to the default face', () => {
        const { env } = mountHome({ avatar: undefined, streak: 0 });
        env.renderWordPet();
        const html = env.document.__getLastInnerHTML('petHeroTopbar') || '';
        assert.truthy(html.includes('😊'), 'default avatar lost');
        assert.truthy(html.includes('🔥 0'), 'a zero streak still renders');
    });

    test('a full renderHome() never touches the stored profile either', () => {
        const { env, reads } = mountHome({ streak: 3 });
        env.renderHome();
        assert.equal(reads.length, 0, `renderHome re-read the profile ${reads.length}x`);
    });
});

// ============================================================================
// 4. History unit chips come from the child's own history
// ============================================================================
// The row was hard-coded to unit8..unit11 while GRAMMAR_UNITS grew to 13.
// A child who had only done Unit 12 (2,000 questions) saw four chips for units
// she had never touched, every one of them showing "No matches", and no chip
// for the unit she had actually practised.
suite('grammar history: unit chips are built from the sessions that exist', () => {
    function mountGrammar(history) {
        const env = loadAppCode({ includeGrammarUI: true });
        env.localStorage.clear();
        env.document.getElementById('grammarScreen');
        env.__setAppState({
            username: 'Tester', avatar: '🐶', streak: 0, points: 0, coins: 0,
            lessonHistory: [], srs: {}, grammarHistory: history, grammarMistakes: {}
        });
        env.__setCurrentUser('Tester');
        env.setGrammarHistoryFilter('unit', 'all');   // known start state
        env.switchGrammarSubTab('history');
        return env;
    }
    const session = (unitId, i) => ({
        id: 'g-' + unitId + '-' + i, unitId, date: Date.now() - i * 1000,
        score: 8, total: 10, questions: []
    });
    const chipUnits = (html) => {
        const out = [];
        const re = /setGrammarHistoryFilter\('unit', '([^']+)'\)/g;
        let m;
        while ((m = re.exec(html)) !== null) out.push(m[1]);
        return out;
    };
    const screenHTML = (env) => env.document.__getLastInnerHTML('grammarScreen') || '';

    test('a Unit-12-only child gets no phantom unit8..unit11 chips', () => {
        const env = mountGrammar([session('unit12', 0), session('unit12', 1)]);
        const html = screenHTML(env);
        assert.truthy(html.includes('History'), 'the history sub-tab did not render');
        for (const ghost of ['unit8', 'unit9', 'unit10', 'unit11']) {
            assert.falsy(chipUnits(html).includes(ghost),
                `${ghost} chip offered to a child who never opened it`);
        }
    });

    test('one unit in history means no unit row at all — nothing to filter', () => {
        const env = mountGrammar([session('unit12', 0)]);
        assert.deepEqual(chipUnits(screenHTML(env)), [],
            'a lone "All units" chip beside one unit chip is pure noise');
    });

    test('every unit the child HAS practised gets a chip, in bank order', () => {
        const env = mountGrammar([session('unit12', 0), session('unit3', 1), session('unit13', 2)]);
        assert.deepEqual(chipUnits(screenHTML(env)), ['all', 'unit3', 'unit12', 'unit13'],
            'chips must follow GRAMMAR_UNITS order, not the order sessions happened');
    });

    test('unit12 is reachable — the defect was that it never appeared', () => {
        const env = mountGrammar([session('unit12', 0), session('unit3', 1)]);
        const html = screenHTML(env);
        assert.truthy(chipUnits(html).includes('unit12'));
        const unit12 = (typeof env.GRAMMAR_UNITS !== 'undefined')
            ? env.GRAMMAR_UNITS.find(u => u.id === 'unit12') : null;
        assert.truthy(unit12, 'GRAMMAR_UNITS should carry unit12');
        assert.truthy(html.includes(unit12.icon + ' Unit 12'), 'the chip carries the real unit label');
    });

    // Each listed session shows its unit's real name, so the names are how we
    // tell which sessions survived a filter.
    const unitName = (env, id) => env.GRAMMAR_UNITS.find(u => u.id === id).name;

    test('tapping a unit chip actually narrows the list', () => {
        const env = mountGrammar([session('unit12', 0), session('unit3', 1)]);
        env.setGrammarHistoryFilter('unit', 'unit12');
        const html = screenHTML(env);
        assert.falsy(html.includes('No matches'), 'a chip built from history can never be empty');
        assert.truthy(html.includes(unitName(env, 'unit12')), 'the unit-12 session should still be listed');
        assert.falsy(html.includes(unitName(env, 'unit3')), 'the unit-3 session should be filtered out');
    });

    test('a filter left on a unit that dropped out of history resets to All', () => {
        const env = mountGrammar([session('unit12', 0), session('unit3', 1)]);
        env.setGrammarHistoryFilter('unit', 'unit3');
        // The unit-3 session ages out of the capped history.
        env.__getAppState().grammarHistory = [session('unit12', 0), session('unit12', 2)];
        env.switchGrammarSubTab('history');
        const html = screenHTML(env);
        assert.falsy(html.includes('No matches'),
            'a stale filter used to strand the child on an empty list with no chip to undo it');
        assert.truthy(html.includes(unitName(env, 'unit12')), 'the remaining sessions must show');
    });

    test('an unknown session label still renders instead of throwing', () => {
        // startCustomQuiz passes its own label through as the unitId.
        const env = mountGrammar([session('unit12', 0), session('mistakes', 1)]);
        const chips = chipUnits(screenHTML(env));
        assert.deepEqual(chips, ['all', 'unit12', 'mistakes'],
            'ids the bank does not know sort last and keep their raw label');
    });

    test('history still renders when the grammar bank never downloaded', () => {
        const env = loadAppCode({ includeGrammarUI: true });
        env.document.getElementById('grammarScreen');
        env.__setAppState({
            username: 'Tester', lessonHistory: [], srs: {},
            grammarHistory: [session('unit12', 0), session('unit3', 1)], grammarMistakes: {}
        });
        env.__setCurrentUser('Tester');
        // Simulate the bank global being absent the way a failed lazy-load
        // leaves it (js/grammar-ui.js guards with `typeof GRAMMAR_UNITS`).
        env.globalThis.GRAMMAR_UNITS = undefined;
        let threw = null;
        try { env.switchGrammarSubTab('history'); } catch (e) { threw = e; }
        assert.falsy(threw, `history threw without the bank: ${threw && threw.message}`);
    });
});

// ============================================================================
// 5. One Word Hunt game ends exactly once
// ============================================================================
// Find the last word inside the final 0.8s and BOTH the 800ms victory delay
// and the 200ms timer tick called completeWordHunt(): _huntWins went up twice
// for one game, so `hunter-10` unlocked after five.
suite('word hunt: completeWordHunt runs once per game', () => {
    function mountHunt() {
        const timeouts = [];
        const intervals = [];
        const cleared = [];
        const stub = () => ({
            innerHTML: '', textContent: '',
            classList: { add() {}, remove() {}, contains: () => false },
            addEventListener() {}, removeEventListener() {},
            querySelector: () => null, querySelectorAll: () => [],
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
            dataset: {},
        });
        const ctx = {
            console, Date, Math, JSON, Object, Array, Set, Map, Promise,
            setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
            clearTimeout: () => {},
            setInterval: (fn, ms) => { intervals.push({ fn, ms }); return 'iv' + intervals.length; },
            clearInterval: (id) => { cleared.push(id); },
            document: { getElementById: () => stub(), querySelector: () => null, querySelectorAll: () => [] },
            appState: { points: 0, srs: {}, lessonsCompleted: 10 },
            currentUser: 'Kid',
            unlocked: [],
            saveUserData: () => {},
            speakWord: () => {},
            showToast: () => {},
            createConfetti: () => {},
            renderHome: () => {},
            shuffleArray: (a) => a.slice(),
            ieltsVocabulary: [],
        };
        ctx.unlockAchievement = (id) => { ctx.unlocked.push(id); };
        ctx.global = ctx; ctx.globalThis = ctx;
        vm.createContext(ctx);
        // `let huntState` and `const HUNT_WORDS` are lexical inside the script,
        // so surface handles for them the way tests/setup.js does for appState.
        vm.runInContext(
            fs.readFileSync(path.join(ROOT, 'js/word-hunt.js'), 'utf8')
            + '\n;globalThis.__setHunt = s => { huntState = s; };'
            + '\n;globalThis.__getHunt = () => huntState;'
            + '\n;globalThis.__HUNT_WORDS = HUNT_WORDS;'
            + '\n;globalThis.__HUNT_TIME = HUNT_TIME;',
            ctx, { filename: 'js/word-hunt.js' });
        // checkHuntSelection() also queues a 1.5s meaning-popup timer, so the
        // completion delay is picked by its 800ms delay, not by position.
        const victoryDelay = () => {
            const hits = timeouts.filter(t => t.ms === 800);
            return hits[hits.length - 1];
        };
        return { ctx, timeouts, intervals, cleared, victoryDelay };
    }

    // A game one word away from a clean sweep, with 'CAT' laid out on row 0.
    function nearWin(ctx, opts) {
        opts = opts || {};
        const words = [
            { en: 'sun', vi: 'mặt trời', emoji: '☀️' },
            { en: 'dog', vi: 'chó', emoji: '🐶' },
            { en: 'cat', vi: 'mèo', emoji: '🐱' },
        ].slice(0, ctx.__HUNT_WORDS);
        const grid = Array.from({ length: 10 }, () => Array(10).fill('X'));
        grid[0][0] = 'C'; grid[0][1] = 'A'; grid[0][2] = 'T';
        ctx.__setHunt({
            grid,
            words,
            foundWords: words.slice(0, words.length - 1).map(w => w.en),
            selecting: false,
            selectedCells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }],
            timer: null,
            timeLeft: opts.timeLeft === undefined ? 700 : opts.timeLeft,
            // 59.3s in: the clock runs out before the 800ms victory delay fires.
            startTime: Date.now() - (ctx.__HUNT_TIME - 700),
            finished: false,
        });
        return words;
    }

    // The fake clock: the timer tick reads Date.now() - startTime, so moving
    // startTime back is how wall time passes in this test.
    function advance(ctx, ms) { ctx.__getHunt().startTime -= ms; }

    test('the last word found just before time-up counts ONE win', () => {
        const { ctx, intervals, victoryDelay } = mountHunt();
        nearWin(ctx);
        ctx.startHuntTimer();                 // the 200ms tick is now live
        ctx.checkHuntSelection();             // last word found → 800ms delay queued
        assert.truthy(victoryDelay(), 'the victory delay should be scheduled');
        assert.equal(ctx.__getHunt().foundWords.length, ctx.__HUNT_WORDS);

        advance(ctx, 700);                    // 0.7s later, still inside the 0.8s delay
        intervals[0].fn();                    // clock hits 0 first → completes the game
        assert.equal(ctx.appState._huntWins, 1);
        victoryDelay().fn();                  // the delayed win lands afterwards
        assert.equal(ctx.appState._huntWins, 1,
            'the same game was counted twice — hunter-10 unlocked on five games');
    });

    test('the other order — victory first, stray tick after — also counts once', () => {
        const { ctx, intervals, victoryDelay } = mountHunt();
        nearWin(ctx);
        ctx.startHuntTimer();
        ctx.checkHuntSelection();
        victoryDelay().fn();                  // the win lands first
        assert.equal(ctx.appState._huntWins, 1);
        intervals[0].fn();                    // a tick that was already in flight
        assert.equal(ctx.appState._huntWins, 1);
    });

    test('closing the overlay after a win does not re-count it', () => {
        const { ctx, victoryDelay } = mountHunt();
        nearWin(ctx);
        ctx.checkHuntSelection();
        victoryDelay().fn();
        assert.equal(ctx.appState._huntWins, 1);
        ctx.endWordHunt();                    // "Done"/back out of a finished game
        assert.equal(ctx.appState._huntWins, 1);
    });

    test('hunter-10 is not unlocked early by double counting', () => {
        const { ctx, intervals, victoryDelay } = mountHunt();
        for (let game = 0; game < 5; game++) {
            nearWin(ctx);
            ctx.startHuntTimer();
            ctx.checkHuntSelection();
            advance(ctx, 700);
            intervals[intervals.length - 1].fn();
            victoryDelay().fn();
        }
        assert.equal(ctx.appState._huntWins, 5, 'five games are five wins');
        assert.falsy(ctx.unlocked.includes('hunter-10'),
            'hunter-10 needs ten games, not five played twice');
    });

    test('ten real games do unlock hunter-10 — the guard is per game, not global', () => {
        const { ctx, intervals } = mountHunt();
        for (let game = 0; game < 10; game++) {
            nearWin(ctx);
            ctx.startHuntTimer();
            ctx.checkHuntSelection();
            advance(ctx, 700);
            intervals[intervals.length - 1].fn();
        }
        assert.equal(ctx.appState._huntWins, 10);
        assert.truthy(ctx.unlocked.includes('hunter-10'));
    });

    test('a timed-out game with nothing found is still only finished once', () => {
        const { ctx, intervals, cleared } = mountHunt();
        nearWin(ctx, { timeLeft: 0 });
        ctx.__getHunt().foundWords = [];
        ctx.__getHunt().startTime = Date.now() - ctx.__HUNT_TIME - 1;
        ctx.startHuntTimer();
        intervals[0].fn();
        intervals[0].fn();                    // a second tick before clearInterval bites
        assert.falsy(ctx.appState._huntWins, 'nothing found is not a win');
        assert.truthy(cleared.length >= 1, 'the timer must be stopped');
    });

    test('a fresh game after a finished one can be won again', () => {
        const { ctx, intervals } = mountHunt();
        nearWin(ctx);
        ctx.startHuntTimer();
        ctx.checkHuntSelection();
        advance(ctx, 700);
        intervals[0].fn();
        assert.equal(ctx.appState._huntWins, 1);
        // openWordHunt() rebuilds huntState with finished: false.
        nearWin(ctx);
        ctx.startHuntTimer();
        ctx.checkHuntSelection();
        advance(ctx, 700);
        intervals[1].fn();
        assert.equal(ctx.appState._huntWins, 2, 'the guard must not outlive its game');
    });

    test('openWordHunt starts every game unfinished', () => {
        const { ctx } = mountHunt();
        ctx.appState.srs = { cat: {}, dog: {}, sun: {}, hat: {} };
        ctx.ieltsVocabulary = [
            { en: 'cat', vi: 'mèo', emoji: '🐱' }, { en: 'dog', vi: 'chó', emoji: '🐶' },
            { en: 'sun', vi: 'mặt trời', emoji: '☀️' }, { en: 'hat', vi: 'mũ', emoji: '🎩' },
        ];
        ctx.openWordHunt();
        assert.equal(ctx.__getHunt().finished, false,
            'a new game must not inherit the previous game\'s finished flag');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
