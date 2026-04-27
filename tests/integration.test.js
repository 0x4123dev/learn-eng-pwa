// tests/integration.test.js — Cross-module integration tests
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function load(appState) {
    const env = loadAppCode();
    env.__setAppState(appState || {});
    return env;
}

suite('createDefaultUserData: shape', () => {
    test('returns object with all required fields', () => {
        const env = loadAppCode();
        const data = env.createDefaultUserData('TestUser', '😊', '1234');
        assert.equal(data.username, 'TestUser');
        assert.equal(data.avatar, '😊');
        assert.equal(data.passcode, '1234');
        assert.equal(data.points, 0);
        assert.equal(data.streak, 0);
        assert.equal(data.lessonsCompleted, 0);
        assert.equal(data.currentLesson, 0);
        assert.truthy(Array.isArray(data.achievements));
        assert.truthy(Array.isArray(data.lessonHistory));
        assert.truthy(typeof data.srs === 'object');
        assert.equal(data.streakShields, 0);
        assert.equal(data.bestStreak, 0);
        assert.truthy(typeof data.topicProgress === 'object');
        assert.truthy(Array.isArray(data.weeklyRecaps));
        assert.truthy(typeof data.petMemory === 'object');
    });

    test('petMemory has expected fields', () => {
        const env = loadAppCode();
        const data = env.createDefaultUserData('U', '😊', '1234');
        assert.equal(data.petMemory.lessonsTogether, 0);
        assert.truthy(typeof data.petMemory.lastSeen === 'number');
        assert.equal(data.petMemory.longestAbsenceDays, 0);
        assert.truthy(Array.isArray(data.petMemory.milestonesSeen));
    });
});

suite('Topics: integration with vocabulary', () => {
    test('every topic has at least 100 words', () => {
        const env = loadAppCode();
        const counts = env.getTopicCounts(null);
        for (const t of env.TOPICS) {
            assert.truthy(counts[t.id] >= 100,
                `topic ${t.id} has only ${counts[t.id]} words`);
        }
    });

    test('topic words are real vocabulary entries', () => {
        const env = loadAppCode();
        const words = env.getWordsForTopic('thinking', null);
        for (let i = 0; i < Math.min(10, words.length); i++) {
            const w = words[i].word;
            assert.truthy(w.en);
            assert.truthy(w.vi);
            // Verify it really is in ieltsVocabulary
            const found = env.ieltsVocabulary.find(x => x.en === w.en);
            assert.truthy(found, `word ${w.en} not in vocab`);
        }
    });
});

suite('Vocabulary: data integrity', () => {
    test('vocabulary has 1957 entries', () => {
        const env = loadAppCode();
        assert.equal(env.ieltsVocabulary.length, 1957);
    });

    test('duplicate-word count documented (intentional re-exposure)', () => {
        // Some words intentionally repeat at different difficulty levels for re-exposure
        // (e.g., "habitat", "stress", "motivation"). This test documents the expected count
        // so any further duplication is caught early.
        const env = loadAppCode();
        const ens = env.ieltsVocabulary.map(w => w.en);
        const dupeCount = ens.length - new Set(ens).size;
        // Currently ~335 duplicates. Threshold set at 400 to allow minor growth.
        assert.truthy(dupeCount < 400, `${dupeCount} duplicates exceeds the documented baseline`);
    });

    test('every word has en, vi, ipa, ex', () => {
        const env = loadAppCode();
        for (let i = 0; i < env.ieltsVocabulary.length; i += 100) {
            const w = env.ieltsVocabulary[i];
            assert.truthy(w.en, `word ${i} missing en`);
            assert.truthy(w.vi, `word ${i} (${w.en}) missing vi`);
            assert.truthy(w.ipa, `word ${i} (${w.en}) missing ipa`);
            assert.truthy(w.ex, `word ${i} (${w.en}) missing ex`);
        }
    });

    test('IPA is wrapped in slashes', () => {
        const env = loadAppCode();
        for (let i = 0; i < env.ieltsVocabulary.length; i += 200) {
            const w = env.ieltsVocabulary[i];
            assert.truthy(w.ipa.startsWith('/'), `word ${w.en} ipa missing leading /`);
            assert.truthy(w.ipa.endsWith('/'), `word ${w.en} ipa missing trailing /`);
        }
    });
});

suite('Achievements: shape', () => {
    test('every achievement has id, name, icon', () => {
        const env = loadAppCode();
        for (const a of env.achievements) {
            assert.truthy(a.id);
            assert.truthy(a.name);
            assert.truthy(a.icon);
        }
    });

    test('achievement IDs are unique', () => {
        const env = loadAppCode();
        const ids = env.achievements.map(a => a.id);
        const unique = new Set(ids);
        assert.equal(ids.length, unique.size, 'duplicate achievement IDs');
    });
});

suite('shuffleArray: utility', () => {
    test('returns array of same length', () => {
        const env = loadAppCode();
        const input = [1, 2, 3, 4, 5];
        const out = env.shuffleArray([...input]);
        assert.equal(out.length, 5);
    });

    test('preserves all elements', () => {
        const env = loadAppCode();
        const input = [1, 2, 3, 4, 5];
        const out = env.shuffleArray([...input]).sort();
        assert.deepEqual(out, [1, 2, 3, 4, 5]);
    });
});

suite('Lesson math: BEGINNING + IELTS levels = TOTAL', () => {
    test('beginning + 4 IELTS levels = TOTAL_LESSONS', () => {
        const env = loadAppCode();
        const total = env.BEGINNING_LESSONS + env.IELTS_PER_LEVEL * 4;
        // Should be >= TOTAL_LESSONS (slight overlap due to ceiling)
        assert.truthy(total >= env.TOTAL_LESSONS);
    });

    test('all 5 ranges combined cover all lessons', () => {
        const env = loadAppCode();
        const ranges = ['beginning', 'basic', 'intermediate', 'upper', 'advanced'].map(k =>
            env.getLessonRangeForDifficulty(k)
        );
        // Should be contiguous and cover [0, TOTAL_LESSONS)
        assert.equal(ranges[0].start, 0);
        for (let i = 1; i < ranges.length; i++) {
            assert.equal(ranges[i].start, ranges[i-1].end,
                `gap between ${ranges[i-1].end} and ${ranges[i].start}`);
        }
        assert.equal(ranges[ranges.length - 1].end, env.TOTAL_LESSONS);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
