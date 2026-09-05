// home-skills.test.js — the home-page skills chart aggregates correct/total
// across every practice type's history.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function envWith(state) {
    const env = loadAppCode({ includeHome: true });
    env.__setAppState(state);
    return env;
}

suite('home skills chart', () => {
    test('exposes all 9 skills in fixed order', () => {
        const env = envWith({});
        const keys = env.getHomeSkillStats().map(s => s.key);
        assert.deepEqual(keys, ['vocab', 'units', 'grammar', 'phrases', 'colloc', 'wordform', 'rewrite', 'verbs', 'exam']);
    });

    test('empty state: every skill has total 0 and pct 0', () => {
        const env = envWith({});
        for (const s of env.getHomeSkillStats()) {
            assert.equal(s.total, 0, s.key);
            assert.equal(s.pct, 0, s.key);
        }
    });

    test('grammar/phrases/wordform/rewrite sum score/total across sessions', () => {
        const env = envWith({
            grammarHistory: [{ score: 8, total: 10 }, { score: 5, total: 10 }],
            phrasesHistory: [{ score: 9, total: 10 }],
            wordformHistory: [{ score: 3, total: 5 }, { score: 4, total: 5 }],
            rewriteHistory: [{ score: 1, total: 5 }],
        });
        const by = Object.fromEntries(env.getHomeSkillStats().map(s => [s.key, s]));
        assert.equal(by.grammar.correct, 13); assert.equal(by.grammar.total, 20); assert.equal(by.grammar.pct, 65);
        assert.equal(by.phrases.pct, 90);
        assert.equal(by.wordform.correct, 7); assert.equal(by.wordform.total, 10);
        assert.equal(by.rewrite.pct, 20);
    });

    test('vocabulary converts lesson accuracy into ~correct words (5 per lesson)', () => {
        const env = envWith({ lessonHistory: [{ lessonNum: 0, accuracy: 100 }, { lessonNum: 1, accuracy: 80 }] });
        const v = env.getHomeSkillStats().find(s => s.key === 'vocab');
        assert.equal(v.total, 10);
        assert.equal(v.correct, 9);   // 5 + 4
        assert.equal(v.pct, 90);
    });

    test('verbs uses speedChallenge history correct/total', () => {
        const env = envWith({ speedChallenge: { history: [{ correct: 8, total: 10 }, { correct: 10, total: 10 }] } });
        const v = env.getHomeSkillStats().find(s => s.key === 'verbs');
        assert.equal(v.correct, 18); assert.equal(v.total, 20); assert.equal(v.pct, 90);
    });

    test('Grade 4 units practice counts toward home stats', () => {
        const env = envWith({ unitsHistory: [{ unit: 3, score: 8, total: 10 }, { unit: 'mix', score: 7, total: 10 }] });
        const u = env.getHomeSkillStats().find(s => s.key === 'units');
        assert.equal(u.correct, 15); assert.equal(u.total, 20); assert.equal(u.pct, 75);
    });

    // Wiring invariant: every practice type that stores history MUST show up
    // in the home statistics — a new tab whose history is forgotten here
    // renders "today: 0 questions" even after the student practiced (the
    // Grade 4 bug this test was written for).
    test('every history array is wired into skills, sessions and total count', () => {
        const one = (extra) => [Object.assign({ score: 4, total: 5, date: Date.now() }, extra)];
        const env = envWith({
            lessonHistory: [{ lessonNum: 0, accuracy: 80, date: Date.now() }],
            unitsHistory: one({ unit: 1 }),
            grammarHistory: one({}),
            phrasesHistory: one({}),
            collocHistory: one({}),
            wordformHistory: one({}),
            rewriteHistory: one({}),
            speedChallenge: { history: [{ correct: 4, total: 5, date: Date.now() }] },
        });
        // exam lives in localStorage (absent in the sandbox) — every appState-backed skill must be non-zero
        for (const s of env.getHomeSkillStats()) {
            if (s.key === 'exam') continue;
            assert.truthy(s.total > 0, `skill "${s.key}" ignores its history`);
        }
        const sessions = env._homeSkillSessions();
        for (const k of ['vocab', 'units', 'grammar', 'phrases', 'colloc', 'wordform', 'rewrite', 'verbs']) {
            assert.equal((sessions[k] || []).length, 1, `sessions "${k}" not wired`);
        }
        assert.equal(env._homeAllSessionsCount(), 8);
    });

    test('malformed history entries are tolerated (missing fields count as 0)', () => {
        const env = envWith({ grammarHistory: [{}, { score: 2 }, { total: 4 }] });
        const g = env.getHomeSkillStats().find(s => s.key === 'grammar');
        assert.equal(g.correct, 2);
        assert.equal(g.total, 4);
    });

    test('skills card is compact by default and expands only on request', () => {
        const env = envWith({ grammarHistory: [{ score: 4, total: 5 }] });
        const panel = env.document.getElementById('homeSkillsPanel');

        env.renderHomeSkillsPanel();
        assert.truthy(panel.innerHTML.includes('Kỹ năng của con'));
        assert.truthy(panel.innerHTML.includes('Xem chi tiết'));
        assert.falsy(panel.innerHTML.includes('home-skills-details'));

        env.toggleHomeSkillsDetails();
        assert.truthy(panel.innerHTML.includes('Thu gọn'));
        assert.truthy(panel.innerHTML.includes('home-skills-details'));
        assert.truthy(panel.innerHTML.includes('Grammar'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
