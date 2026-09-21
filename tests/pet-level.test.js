// tests/pet-level.test.js — Dog level XP curve, stages, and titles
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('getPointsForLevel: XP curve', () => {
    test('level 1 needs 0 XP', () => {
        assert.equal(env.getPointsForLevel(1), 0);
    });

    test('XP requirements are monotonically increasing', () => {
        let prev = 0;
        for (let l = 2; l <= 200; l++) {
            const xp = env.getPointsForLevel(l);
            assert.truthy(xp > prev, `level ${l} needs ${xp} XP but level ${l-1} needed ${prev}`);
            prev = xp;
        }
    });

    test('level 200 (max) needs ~120k XP', () => {
        const xp = env.getPointsForLevel(200);
        assert.inRange(xp, 100000, 150000);
    });

    test('level 100 needs ~31k XP (mid-curve)', () => {
        const xp = env.getPointsForLevel(101);
        assert.inRange(xp, 25000, 40000);
    });
});

suite('getDogLevel: XP → level', () => {
    test('0 XP = level 1', () => {
        assert.equal(env.getDogLevel(0), 1);
    });

    test('returns level <= 200 for any XP', () => {
        assert.truthy(env.getDogLevel(0) <= 200);
        assert.equal(env.getDogLevel(99999999), 200);
    });

    test('round-trip: level → XP → level', () => {
        for (let l = 1; l <= 200; l += 10) {
            const xp = env.getPointsForLevel(l);
            const back = env.getDogLevel(xp);
            assert.equal(back, l, `round-trip failed at level ${l}`);
        }
    });

    test('XP just below threshold returns previous level', () => {
        const lvl5XP = env.getPointsForLevel(5);
        assert.equal(env.getDogLevel(lvl5XP - 1), 4);
        assert.equal(env.getDogLevel(lvl5XP), 5);
    });

    test('legacy max user (~25,492 XP) lands at ~level 90', () => {
        const lvl = env.getDogLevel(25492);
        assert.inRange(lvl, 80, 100);
    });
});

suite('getDogStage: level → breed', () => {
    test('returns Chihuahua for level 1', () => {
        const stage = env.getDogStage(1);
        assert.equal(stage.name, 'Chihuahua');
    });

    test('progression goes through all 10 stages', () => {
        const seen = new Set();
        for (let l = 1; l <= 200; l += 5) {
            const stage = env.getDogStage(l);
            seen.add(stage.name);
        }
        assert.equal(seen.size, 10, `expected 10 stages, got ${seen.size}: ${[...seen].join(', ')}`);
    });

    test('level 200 is Tibetan Mastiff (largest)', () => {
        const stage = env.getDogStage(200);
        assert.equal(stage.name, 'Tibetan Mastiff');
    });

    test('every stage has required fields', () => {
        const stages = env.DOG_STAGES;
        for (const s of stages) {
            assert.truthy(s.name);
            assert.truthy(s.fallback, `stage ${s.name} missing fallback emoji`);
            assert.truthy(typeof s.size === 'number');
            assert.truthy(s.stageCss);
            assert.truthy(typeof s.minLevel === 'number');
            assert.truthy(s.buildKg, `stage ${s.name} missing adult build`);
            assert.truthy(Array.isArray(s.habitat));
        }
    });

    test('stages are ordered by minLevel', () => {
        const stages = env.DOG_STAGES;
        for (let i = 1; i < stages.length; i++) {
            assert.truthy(stages[i].minLevel > stages[i-1].minLevel,
                `stage ${stages[i].name} not after ${stages[i-1].name}`);
        }
    });

    test('visible dog size increases at every breed evolution', () => {
        const sizes = env.DOG_STAGES.map(s => s.size);
        for (let i = 1; i < sizes.length; i++) {
            assert.truthy(sizes[i] > sizes[i - 1], `${env.DOG_STAGES[i].name} should be larger than ${env.DOG_STAGES[i - 1].name}`);
        }
    });
});

suite('getDogTitle: level → title string', () => {
    test('returns title for low/mid/high levels', () => {
        assert.equal(env.getDogTitle(1), 'Little Chihuahua');
        assert.equal(env.getDogTitle(200), 'Ultimate Champion');
    });

    test('title changes at every stage threshold', () => {
        const titles = new Set();
        for (let l = 1; l <= 200; l += 5) {
            titles.add(env.getDogTitle(l));
        }
        assert.truthy(titles.size >= 10, `expected ≥10 unique titles, got ${titles.size}`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
