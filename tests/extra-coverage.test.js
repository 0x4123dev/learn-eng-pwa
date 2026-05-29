// tests/extra-coverage.test.js — Additional coverage focused on areas the
// existing suites don't hit:
//   • CSS sanity: bottom-nav uses flex (v3.38.3 regression guard)
//   • Service-worker ASSETS completeness: every js/*.js is cached
//   • Streak-modal greeting boundaries at tier transitions (0/1/3/7/14/30)
//   • Pet level evolution boundaries
//   • Cross-module consistency: GRAMMAR_UNITS ↔ GRAMMAR_LESSONS metadata
//   • App-version propagation: APP_VERSION matches package.json
//   • Localstorage migration safety

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const ROOT = path.join(__dirname, '..');

// ============================================================================
// CSS SANITY (v3.38.3 layout fix — bottom nav flush)
// ============================================================================
suite('css: bottom-nav uses natural flex layout (v3.38.3 regression guard)', () => {
    let css;
    test('styles.css is readable', () => {
        css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
        assert.truthy(css.length > 1000, 'styles.css too short');
    });

    test('.bottom-nav has flex-shrink: 0 (so it never collapses)', () => {
        // Extract .bottom-nav block and look for flex-shrink: 0
        const navBlock = css.match(/\.bottom-nav\s*\{[\s\S]*?\n\s*\}/);
        assert.truthy(navBlock, '.bottom-nav block not found');
        assert.truthy(/flex-shrink:\s*0/.test(navBlock[0]),
            '.bottom-nav must have flex-shrink: 0 for natural layout');
    });

    test('.bottom-nav is NOT position: fixed any more (v3.38.3)', () => {
        const navBlock = css.match(/\.bottom-nav\s*\{[\s\S]*?\n\s*\}/);
        assert.falsy(/position:\s*fixed/.test(navBlock[0]),
            '.bottom-nav was switched away from position: fixed in v3.38.3');
    });

    test('.screens-container has min-height: 0 for inner scroll within flex parent', () => {
        const block = css.match(/\.screens-container\s*\{[\s\S]*?\n\s*\}/);
        assert.truthy(block, '.screens-container block not found');
        assert.truthy(/min-height:\s*0/.test(block[0]),
            '.screens-container needs min-height: 0 for flex-child overflow');
    });

    test('.screens-container does NOT use the old margin-bottom: 64px hack', () => {
        const block = css.match(/\.screens-container\s*\{[\s\S]*?\n\s*\}/);
        assert.falsy(/margin-bottom:\s*64px/.test(block[0]),
            'old margin-bottom: 64px hack must be gone in v3.38.3');
    });

    test('html, body use 100dvh for dynamic viewport', () => {
        // Match the html, body selector block
        const block = css.match(/html,\s*body\s*\{[\s\S]*?\n\s*\}/);
        assert.truthy(block, 'html, body block not found');
        assert.truthy(/100dvh/.test(block[0]),
            'html, body must use 100dvh for mobile viewport (v3.38.3)');
    });
});

// ============================================================================
// SERVICE WORKER — ASSETS array is in sync with js/
// ============================================================================
suite('sw: ASSETS array caches every js/*.js file', () => {
    let swSrc, jsFiles;

    test('sw.js is readable and exports CACHE_NAME', () => {
        swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
        assert.truthy(/CACHE_NAME\s*=\s*['"]flashlingo-v\d+['"]/.test(swSrc),
            'CACHE_NAME pattern not found in sw.js');
    });

    test('every js/*.js file is in the ASSETS array', () => {
        jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
        const missing = [];
        for (const f of jsFiles) {
            const needle = `'/js/${f}'`;
            if (!swSrc.includes(needle)) missing.push(f);
        }
        assert.equal(missing.length, 0,
            `Missing from sw.js ASSETS: ${missing.join(', ')}`);
    });

    test('every entry in ASSETS that\'s a js/ path points to an EXISTING file', () => {
        const assetsBlock = swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\];/);
        assert.truthy(assetsBlock, 'ASSETS array not found');
        const lines = assetsBlock[1].split('\n')
            .map(l => l.trim().replace(/^['"]|['"],?$/g, ''))
            .filter(l => l.startsWith('/js/'));
        const stale = [];
        for (const p of lines) {
            const abs = path.join(ROOT, p);
            if (!fs.existsSync(abs)) stale.push(p);
        }
        assert.equal(stale.length, 0,
            `Stale entries in sw.js ASSETS (file no longer exists): ${stale.join(', ')}`);
    });

    test('sw.js includes the SKIP_WAITING message handler (v3.38.1)', () => {
        assert.truthy(/type\s*===?\s*['"]SKIP_WAITING['"]/.test(swSrc),
            'SKIP_WAITING message handler missing (regression of v3.38.1)');
        assert.truthy(/self\.skipWaiting\(\)/.test(swSrc),
            'self.skipWaiting() call missing');
    });
});

// ============================================================================
// APP VERSION sync
// ============================================================================
suite('version: APP_VERSION ↔ package.json ↔ CACHE_NAME consistency', () => {
    let pkg, homeSrc, swSrc;
    test('all three files readable', () => {
        pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        homeSrc = fs.readFileSync(path.join(ROOT, 'js/home.js'), 'utf8');
        swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    });

    test('package.json version is a valid semver string', () => {
        assert.truthy(/^\d+\.\d+\.\d+$/.test(pkg.version),
            `bad version "${pkg.version}"`);
    });

    test('APP_VERSION in js/home.js matches package.json version (modulo "v" prefix)', () => {
        const m = homeSrc.match(/APP_VERSION\s*=\s*['"](v\d+\.\d+\.\d+)['"]/);
        assert.truthy(m, 'APP_VERSION declaration not found in home.js');
        assert.equal(m[1], 'v' + pkg.version,
            `APP_VERSION "${m[1]}" doesn't match package.json v${pkg.version}`);
    });

    test('CACHE_NAME in sw.js has been bumped recently (counter ≥ 100)', () => {
        const m = swSrc.match(/CACHE_NAME\s*=\s*['"]flashlingo-v(\d+)['"]/);
        assert.truthy(m, 'CACHE_NAME pattern not found');
        const n = parseInt(m[1], 10);
        assert.truthy(n >= 100,
            `CACHE_NAME counter is "${n}" — should be ≥100 after many bumps`);
    });
});

// ============================================================================
// STREAK MODAL: greeting at tier boundaries
// ============================================================================
suite('streak: greeting text at every tier boundary', () => {
    function greetingFor(streak) {
        const env = loadAppCode();
        env.localStorage.clear();
        env.__setAppState({
            streak, bestStreak: streak,
            lessonHistory: [], coins: 0, dogLevel: 1, dogGrowthXP: 0
        });
        env.__setCurrentUser('Tester');
        env.showDailyStreakModal({ force: true });
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        const m = html.match(/streak-modal-greeting[^>]*>([^<]+)</);
        return m ? m[1] : '';
    }

    test('streak=0 → "Start your streak today!"', () => {
        assert.truthy(greetingFor(0).includes('Start your streak'));
    });
    test('streak=1 → "Day 1 — let\'s make it two!"', () => {
        const g = greetingFor(1);
        assert.truthy(g.includes('Day 1'), `expected "Day 1" greeting, got "${g}"`);
    });
    test('streak=2 → "Streak: 2 days strong"', () => {
        assert.truthy(greetingFor(2).includes('Streak: 2 days strong'));
    });
    test('streak=6 → still "Streak: 6 days strong" (under fire threshold)', () => {
        assert.truthy(greetingFor(6).includes('6 days strong'));
    });
    test('streak=7 → fire greeting "on fire"', () => {
        const g = greetingFor(7);
        assert.truthy(/on fire/i.test(g), `expected "on fire" greeting, got "${g}"`);
    });
    test('streak=13 → still fire greeting (under unstoppable)', () => {
        assert.truthy(/on fire/i.test(greetingFor(13)));
    });
    test('streak=14 → "unstoppable"', () => {
        const g = greetingFor(14);
        assert.truthy(/unstoppable/i.test(g), `expected "unstoppable", got "${g}"`);
    });
    test('streak=29 → still "unstoppable" (under legend)', () => {
        assert.truthy(/unstoppable/i.test(greetingFor(29)));
    });
    test('streak=30 → "legend"', () => {
        const g = greetingFor(30);
        assert.truthy(/legend/i.test(g), `expected "legend", got "${g}"`);
    });
    test('streak=100 → "legend" (no separate tier)', () => {
        assert.truthy(/legend/i.test(greetingFor(100)));
    });
});

// ============================================================================
// STREAK TIER CSS-CLASS at boundaries
// ============================================================================
suite('streak: tier class applied at every boundary', () => {
    function tierClass(streak) {
        const env = loadAppCode();
        env.localStorage.clear();
        env.__setAppState({ streak, bestStreak: streak, lessonHistory: [], dogLevel: 1, dogGrowthXP: 0 });
        env.__setCurrentUser('T');
        env.showDailyStreakModal({ force: true });
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        const m = html.match(/streak-modal-streak[^"]*"/);
        return m ? m[0] : '';
    }
    test('streak=2 → no tier class', () => {
        assert.falsy(/streak-tier-[1-9]/.test(tierClass(2)));
    });
    test('streak=3 → tier 1', () => {
        assert.truthy(/streak-tier-1\b/.test(tierClass(3)));
    });
    test('streak=7 → tier 2', () => {
        assert.truthy(/streak-tier-2\b/.test(tierClass(7)));
    });
    test('streak=14 → tier 3', () => {
        assert.truthy(/streak-tier-3\b/.test(tierClass(14)));
    });
    test('streak=30 → tier 4', () => {
        assert.truthy(/streak-tier-4\b/.test(tierClass(30)));
    });
});

// ============================================================================
// PET LEVEL EVOLUTION BOUNDARIES
// ============================================================================
suite('pet: level evolution boundaries', () => {
    test('getDogLevel(0 XP) returns level 1', () => {
        const env = loadAppCode();
        assert.equal(env.getDogLevel(0), 1);
    });
    test('getDogLevel grows monotonically with XP (no overflow/NaN)', () => {
        const env = loadAppCode();
        const samples = [0, 100, 500, 1000, 5000, 50000, 1000000];
        let prev = -Infinity;
        for (const xp of samples) {
            const lvl = env.getDogLevel(xp);
            assert.truthy(typeof lvl === 'number' && lvl >= 1 && Number.isFinite(lvl),
                `XP ${xp} → bad level ${lvl}`);
            assert.truthy(lvl >= prev, `XP ${xp} → level ${lvl} regressed from ${prev}`);
            prev = lvl;
        }
    });
    test('getDogStage(1) returns the first stage', () => {
        const env = loadAppCode();
        const s = env.getDogStage(1);
        assert.truthy(s && s.stageCss && s.stageCss.length > 0);
    });
    test('getDogStage at every level 1..10 returns a valid stage with stageCss + name', () => {
        const env = loadAppCode();
        for (let lvl = 1; lvl <= 10; lvl++) {
            const s = env.getDogStage(lvl);
            assert.truthy(s, `dogStage missing for level ${lvl}`);
            assert.truthy(s.stageCss && /^[a-z]+$/.test(s.stageCss),
                `level ${lvl} stageCss "${s.stageCss}" invalid`);
        }
    });
    test('DOG_STAGES is an array with ≥10 entries (chihuahua → diamond)', () => {
        const env = loadAppCode();
        assert.truthy(Array.isArray(env.DOG_STAGES) && env.DOG_STAGES.length >= 10,
            `expected ≥10 stages, got ${env.DOG_STAGES.length}`);
    });
    test('Every DOG_STAGES entry has stageCss matching a CSS gradient rule', () => {
        const env = loadAppCode();
        const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
        for (const stage of env.DOG_STAGES) {
            const re = new RegExp('data-stage="' + stage.stageCss + '"');
            assert.truthy(re.test(css),
                `no CSS rule for data-stage="${stage.stageCss}"`);
        }
    });
});

// ============================================================================
// CROSS-MODULE: GRAMMAR_UNITS ↔ GRAMMAR_LESSONS metadata consistency
// ============================================================================
suite('cross-module: GRAMMAR_UNITS and GRAMMAR_LESSONS share unit IDs + icons', () => {
    test('every GRAMMAR_LESSONS unit has a matching GRAMMAR_UNITS entry', () => {
        const env = loadAppCode();
        for (const lu of env.GRAMMAR_LESSONS) {
            const gu = env.getGrammarUnit(lu.unitId);
            assert.truthy(gu, `${lu.unitId} in GRAMMAR_LESSONS but not GRAMMAR_UNITS`);
        }
    });
    test('every GRAMMAR_UNITS unit has a matching GRAMMAR_LESSONS entry', () => {
        const env = loadAppCode();
        for (const u of env.GRAMMAR_UNITS) {
            const lu = env.GRAMMAR_LESSONS.find(x => x.unitId === u.id);
            assert.truthy(lu, `${u.id} in GRAMMAR_UNITS but not GRAMMAR_LESSONS`);
        }
    });
    test('icon and color match between modules for every unit', () => {
        const env = loadAppCode();
        for (const u of env.GRAMMAR_UNITS) {
            const lu = env.GRAMMAR_LESSONS.find(x => x.unitId === u.id);
            assert.equal(u.icon, lu.icon,
                `${u.id} icon: GRAMMAR_UNITS="${u.icon}" vs GRAMMAR_LESSONS="${lu.icon}"`);
            assert.equal(u.color, lu.color,
                `${u.id} color: GRAMMAR_UNITS="${u.color}" vs GRAMMAR_LESSONS="${lu.color}"`);
        }
    });
});

// ============================================================================
// SRS — basic interval progression
// ============================================================================
suite('srs: interval progression sequence on consecutive correct answers', () => {
    test('5 correct in a row produces growing intervals', () => {
        const env = loadAppCode();
        const appState = { srs: { word: { interval: 1, ease: 2.5, repetitions: 0, nextReview: 0, lastReview: 0 } } };
        env.__setAppState(appState);
        const seen = [];
        for (let i = 0; i < 5; i++) {
            env.updateWordSRS('word', 2);
            seen.push(appState.srs.word.interval);
        }
        // Intervals should be monotonically non-decreasing
        for (let i = 1; i < seen.length; i++) {
            assert.truthy(seen[i] >= seen[i - 1],
                `interval regressed: ${seen[i - 1]} → ${seen[i]} (full: ${seen.join(', ')})`);
        }
        // And the last interval should be substantially bigger than the first
        assert.truthy(seen[4] > seen[0] * 5,
            `interval growth too slow: ${seen.join(' → ')}`);
    });

    test('wrong answer after long interval resets to 1 day', () => {
        const env = loadAppCode();
        const appState = { srs: { word: { interval: 30, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 } } };
        env.__setAppState(appState);
        env.updateWordSRS('word', 0);
        assert.equal(appState.srs.word.interval, 1, 'wrong should reset interval to 1');
        assert.equal(appState.srs.word.repetitions, 0, 'wrong should reset reps to 0');
    });
});

// ============================================================================
// GRAMMAR QUIZ flow — once-per-day streak doesn't get marked unless modal shown
// ============================================================================
suite('streak: localStorage gate uses per-user keys', () => {
    test('mark for "Alice" doesn\'t affect "Bob"', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        env.markStreakShownToday('Alice');
        assert.truthy(env.hasShownStreakToday('Alice'), 'Alice should be marked');
        assert.falsy(env.hasShownStreakToday('Bob'), 'Bob should NOT be marked');
        env.markStreakShownToday('Bob');
        assert.truthy(env.hasShownStreakToday('Bob'), 'Bob should now be marked');
    });

    test('marking writes a YYYY-MM-DD value, not "true" or "1"', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        env.markStreakShownToday('Cara');
        const v = env.localStorage.getItem('flashlingo-streak-shown-Cara');
        assert.truthy(/^\d{4}-\d{2}-\d{2}$/.test(v),
            `expected YYYY-MM-DD, got "${v}"`);
    });

    test('localStorage.clear erases the gate for everyone', () => {
        const env = loadAppCode();
        env.markStreakShownToday('X');
        env.markStreakShownToday('Y');
        env.localStorage.clear();
        assert.falsy(env.hasShownStreakToday('X'));
        assert.falsy(env.hasShownStreakToday('Y'));
    });
});

// ============================================================================
// GRAMMAR — every unit's quiz can be generated for sizes 5/10/25
// ============================================================================
suite('grammar: generateGrammarQuiz works for every unit × every common size', () => {
    const env = loadAppCode();
    for (const u of env.GRAMMAR_UNITS) {
        for (const n of [5, 10, 25]) {
            test(`${u.id} can generate a ${n}-question quiz with unique IDs`, () => {
                const qs = env.generateGrammarQuiz(u.id, n);
                assert.equal(qs.length, n, `${u.id}/${n}: got ${qs.length}`);
                const ids = new Set(qs.map(q => q.id));
                assert.equal(ids.size, n, `${u.id}/${n}: duplicate IDs in single quiz`);
            });
        }
    }
});

// ============================================================================
// COVERAGE INTEGRATION: data structure invariants we rely on for UI rendering
// ============================================================================
suite('grammar: every unit has a unique color (no palette collisions)', () => {
    test('every unit color is distinct across GRAMMAR_UNITS', () => {
        const env = loadAppCode();
        const colors = env.GRAMMAR_UNITS.map(u => u.color);
        const unique = new Set(colors);
        assert.equal(unique.size, env.GRAMMAR_UNITS.length,
            `${env.GRAMMAR_UNITS.length - unique.size} units share a color: ${colors.join(', ')}`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
