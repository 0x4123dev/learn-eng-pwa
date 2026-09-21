// home-skills.test.js — the home-page skills chart aggregates correct/total
// per Book (pr1/pr2/pr3) out of the one shared appState.unitsHistory.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function envWith(state) {
    const env = loadAppCode({ includeHome: true });
    env.__setAppState(state);
    return env;
}

suite('home skills chart', () => {
    test('exposes exactly the 3 Books in fixed order', () => {
        const env = envWith({});
        const keys = env.getHomeSkillStats().map(s => s.key);
        assert.deepEqual(keys, ['book1', 'book2', 'book3']);
        assert.deepEqual(env.HOME_BOOKS.map(b => b.set), ['pr1', 'pr2', 'pr3']);
    });

    test('empty state: every Book has total 0 and pct 0', () => {
        const env = envWith({});
        for (const s of env.getHomeSkillStats()) {
            assert.equal(s.total, 0, s.key);
            assert.equal(s.pct, 0, s.key);
        }
    });

    test('each Book sums score/total across its own sessions', () => {
        const env = envWith({
            unitsHistory: [
                { unit: 'pr1-1', score: 8, total: 10 }, { unit: 'pr1-mix', score: 5, total: 10 },
                { unit: 'pr2-7', score: 9, total: 10 },
                { unit: 'pr3-2', score: 3, total: 5 }, { unit: 'pr3-3', score: 4, total: 5 },
            ],
        });
        const by = Object.fromEntries(env.getHomeSkillStats().map(s => [s.key, s]));
        assert.equal(by.book1.correct, 13); assert.equal(by.book1.total, 20); assert.equal(by.book1.pct, 65);
        assert.equal(by.book2.pct, 90);
        assert.equal(by.book3.correct, 7); assert.equal(by.book3.total, 10);
    });

    // The three sets share appState.unitsHistory (js/units.js); rows are told
    // apart by the set prefix on the unit key. A pr2 row must count for
    // Book 2 and NOT for Book 1; a row from no Book counts nowhere.
    test('Books are split out of the shared units history by set prefix', () => {
        const env = envWith({ unitsHistory: [
            { unit: 'pr1-3', score: 8, total: 10 }, { unit: 'pr1-mix', score: 7, total: 10 },
            { unit: 'pr2-3', score: 3, total: 10 }, { unit: 'pr2-mix', score: 6, total: 10 },
            { unit: 'hk1-3', score: 10, total: 10 }, { unit: 3, score: 10, total: 10 },
        ] });
        const by = Object.fromEntries(env.getHomeSkillStats().map(s => [s.key, s]));
        assert.equal(by.book1.correct, 15); assert.equal(by.book1.total, 20); assert.equal(by.book1.pct, 75);
        assert.equal(by.book2.correct, 9); assert.equal(by.book2.total, 20); assert.equal(by.book2.pct, 45);
        assert.equal(by.book3.total, 0);
    });

    // Wiring invariant: every Book's history MUST show up in the home
    // statistics — a Book whose history is forgotten here renders
    // "today: 0 questions" even after the student practiced.
    test('every Book is wired into skills, sessions and total count', () => {
        const one = (extra) => [Object.assign({ score: 4, total: 5, date: Date.now() }, extra)];
        const env = envWith({
            unitsHistory: one({ unit: 'pr1-1' }).concat(one({ unit: 'pr2-1' }), one({ unit: 'pr3-mix' })),
        });
        for (const s of env.getHomeSkillStats()) {
            assert.truthy(s.total > 0, `skill "${s.key}" ignores its history`);
        }
        const sessions = env._homeSkillSessions();
        assert.deepEqual(Object.keys(sessions).sort(), ['book1', 'book2', 'book3']);
        for (const k of ['book1', 'book2', 'book3']) {
            assert.equal((sessions[k] || []).length, 1, `sessions "${k}" not wired`);
        }
        assert.equal(env._homeAllSessionsCount(), 3);
    });

    test('malformed history entries are tolerated (missing fields count as 0)', () => {
        const env = envWith({ unitsHistory: [{ unit: 'pr1-1' }, { unit: 'pr1-2', score: 2 }, { unit: 'pr1-3', total: 4 }, null] });
        const g = env.getHomeSkillStats().find(s => s.key === 'book1');
        assert.equal(g.correct, 2);
        assert.equal(g.total, 4);
    });

    test('a non-array unitsHistory does not throw', () => {
        const env = envWith({ unitsHistory: { oops: true } });
        assert.equal(env.getHomeSkillStats().length, 3);
        assert.equal(env._homeAllSessionsCount(), 0);
    });

    test('skills card is compact by default and expands only on request', () => {
        const env = envWith({ unitsHistory: [{ unit: 'pr2-1', score: 4, total: 5 }] });
        const panel = env.document.getElementById('homeSkillsPanel');

        env.renderHomeSkillsPanel();
        assert.truthy(panel.innerHTML.includes('Kỹ năng của bạn'));
        assert.truthy(panel.innerHTML.includes('Xem chi tiết'));
        assert.falsy(panel.innerHTML.includes('home-skills-details'));

        env.toggleHomeSkillsDetails();
        assert.truthy(panel.innerHTML.includes('Thu gọn'));
        assert.truthy(panel.innerHTML.includes('home-skills-details'));
        assert.truthy(panel.innerHTML.includes('Book 2'));
        assert.truthy(panel.innerHTML.includes("goToSkillTab('book2')"));
    });

    test('tapping a Book row opens that Book', () => {
        const env = envWith({});
        const opened = [];
        env.global.openBook = (set) => opened.push(set);
        env.goToSkillTab('book2');
        env.goToSkillTab('nope');
        assert.deepEqual(opened, ['pr2']);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
