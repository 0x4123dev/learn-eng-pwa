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

    test('level 200 is Diamond Dog (highest)', () => {
        const stage = env.getDogStage(200);
        assert.equal(stage.name, 'Diamond Dog');
    });

    test('every stage has required fields', () => {
        const stages = env.DOG_STAGES;
        for (const s of stages) {
            assert.truthy(s.name);
            assert.truthy(s.fallback, `stage ${s.name} missing fallback emoji`);
            assert.truthy(typeof s.size === 'number');
            assert.truthy(s.stageCss);
            assert.truthy(typeof s.minLevel === 'number');
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

suite('Constants', () => {
    test('WORDS_PER_LESSON is 5', () => {
        assert.equal(env.WORDS_PER_LESSON, 5);
    });

    test('TOTAL_LESSONS matches vocabulary size / 5', () => {
        const expected = Math.ceil(env.ieltsVocabulary.length / env.WORDS_PER_LESSON);
        assert.equal(env.TOTAL_LESSONS, expected);
    });

    test('BEGINNING_LESSONS is 23 (112 words / 5)', () => {
        assert.equal(env.BEGINNING_LESSONS, 23);
    });
});

suite('getDifficultyLevel: lesson → difficulty band', () => {
    test('lesson 0 is Beginning', () => {
        const d = env.getDifficultyLevel(0);
        assert.equal(d.name, 'Beginning');
    });

    test('lesson 22 is still Beginning (23 lessons total)', () => {
        const d = env.getDifficultyLevel(22);
        assert.equal(d.name, 'Beginning');
    });

    test('lesson 23 is Basic', () => {
        const d = env.getDifficultyLevel(23);
        assert.equal(d.name, 'Basic');
    });

    test('returns 5 distinct difficulty levels', () => {
        const names = new Set();
        for (let i = 0; i < env.TOTAL_LESSONS; i += 10) {
            names.add(env.getDifficultyLevel(i).name);
        }
        assert.equal(names.size, 5);
    });

    test('every difficulty has icon, key, color', () => {
        for (let i = 0; i < env.TOTAL_LESSONS; i += 50) {
            const d = env.getDifficultyLevel(i);
            assert.truthy(d.icon);
            assert.truthy(d.key);
            assert.truthy(d.color);
        }
    });
});

suite('getLessonRangeForDifficulty', () => {
    test('beginning range starts at 0', () => {
        const r = env.getLessonRangeForDifficulty('beginning');
        assert.equal(r.start, 0);
        assert.equal(r.end, 23);
    });

    test('basic range follows beginning', () => {
        const r = env.getLessonRangeForDifficulty('basic');
        assert.equal(r.start, 23);
    });

    test('advanced range ends at TOTAL_LESSONS', () => {
        const r = env.getLessonRangeForDifficulty('advanced');
        assert.equal(r.end, env.TOTAL_LESSONS);
    });

    test('all 4 IELTS levels have equal-ish ranges', () => {
        const r1 = env.getLessonRangeForDifficulty('basic');
        const r2 = env.getLessonRangeForDifficulty('intermediate');
        const r3 = env.getLessonRangeForDifficulty('upper');
        const w1 = r1.end - r1.start, w2 = r2.end - r2.start, w3 = r3.end - r3.start;
        assert.equal(w1, w2);
        assert.equal(w2, w3);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
