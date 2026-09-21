// tests/integration.test.js — Cross-module integration tests
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The app plus its one lazy bank (js/word-data.js, the three Books), loaded
// into the same sandbox the way js/lazy-data.js appends it in the browser.
function loadWithBank() {
    const env = loadAppCode();
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'word-data.js'), 'utf8'), env.global);
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
        assert.truthy(Array.isArray(data.achievements));
        assert.truthy(Array.isArray(data.unitsHistory), 'the Book practices\' history');
        assert.equal(data.streakShields, 0);
        assert.equal(data.bestStreak, 0);
        assert.equal(data.coins, 0);
        assert.equal(data.dogLevel, 1);
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

suite('Books: integration with the word bank', () => {
    test('every Book has 7 practice units and every unit has words', () => {
        const env = loadWithBank();
        for (const s of env.UNIT_SETS) {
            const units = env.unitsList(s.id);
            assert.deepEqual(units, [1, 2, 3, 4, 5, 6, 7], s.id);
            for (const u of units) {
                const n = env.unitsBank(s.id).filter(w => w.unit === u).length;
                assert.truthy(n >= 5, `${s.id} unit ${u} has only ${n} words`);
            }
        }
    });

    test('the bank is empty — not a throw — before js/word-data.js lands', () => {
        const env = loadAppCode();
        for (const s of env.UNIT_SETS) assert.deepEqual(env.unitsBank(s.id), []);
        assert.deepEqual(env.unitsList('pr1'), []);
    });
});

suite('Word bank: data integrity', () => {
    test('the three Books carry 527 words between them', () => {
        const env = loadWithBank();
        const all = env.UNIT_SETS.reduce((a, s) => a.concat(env.unitsBank(s.id)), []);
        assert.equal(all.length, 527);
    });

    test('duplicate-word count documented (a word taught in two Books)', () => {
        // A handful of words recur across Books (a Book 2 unit re-teaches a
        // Book 1 word in a new context). This documents the expected count so
        // any further duplication is caught early.
        const env = loadWithBank();
        const all = env.UNIT_SETS.reduce((a, s) => a.concat(env.unitsBank(s.id)), []);
        const ens = all.map(w => w.en);
        const dupeCount = ens.length - new Set(ens).size;
        assert.truthy(dupeCount <= 8, `${dupeCount} duplicates exceeds the documented baseline of 8`);
        for (const s of env.UNIT_SETS) {
            const inSet = env.unitsBank(s.id).map(w => w.en);
            assert.equal(inSet.length, new Set(inSet).size, `${s.id} repeats a word within the Book`);
        }
    });

    test('every word has en, vi, emoji, ex, exVi and is tagged with its set', () => {
        const env = loadWithBank();
        for (const s of env.UNIT_SETS) {
            for (const w of env.unitsBank(s.id)) {
                assert.truthy(w.en, `${s.id} word missing en`);
                assert.truthy(w.vi, `${s.id} (${w.en}) missing vi`);
                assert.truthy(w.emoji, `${s.id} (${w.en}) missing emoji`);
                assert.truthy(w.ex, `${s.id} (${w.en}) missing ex`);
                assert.truthy(w.exVi, `${s.id} (${w.en}) missing exVi`);
                assert.equal(w.set, s.id, `${s.id} (${w.en}) tagged with the wrong set`);
            }
        }
    });

    test('every example sentence contains the word it teaches', () => {
        const env = loadWithBank();
        for (const s of env.UNIT_SETS) {
            for (const w of env.unitsBank(s.id)) {
                const head = String(w.en).split(/[\s/(]/)[0].slice(0, 4).toLowerCase();
                assert.truthy(String(w.ex).toLowerCase().includes(head),
                    `${s.id} (${w.en}) example does not use the word: ${w.ex}`);
            }
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

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
