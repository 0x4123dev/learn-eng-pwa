// tests/audit-low-fixes.test.js — the low-severity defects from the
// 2026-09-04 codebase audit, locked in so they cannot come back.
//
//   1. css: `height: 100dvh` with no `100vh` line in front of it
//   2. css: three selectors declared twice, ~7,000 lines apart
//   3. js/home.js: renderWordPet() re-parsed the whole profile every render
//
// (The audit's other two — grammar history chips and Word Hunt double-count —
// went with those features in the 2026-09 cut.)
//
// 1 and 2 are asserted against the stylesheet source (the precedent is
// tests/ipad-layout.test.js and tests/extra-coverage.test.js — there is no
// layout engine here). 3 executes the real code.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');
const css = require('./css-all').readAllCss();

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

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
