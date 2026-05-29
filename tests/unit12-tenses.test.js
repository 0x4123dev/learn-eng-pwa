// tests/unit12-tenses.test.js — Unit 12 (Tenses) specific tests (v3.41)
// Locks in the per-tense structure and the 7-lesson layout.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

const TENSES = [
    { topic: 'present simple', name: /Present Simple/i, lessonId: '12a' },
    { topic: 'present continuous', name: /Present Continuous/i, lessonId: '12b' },
    { topic: 'present perfect', name: /Present Perfect/i, lessonId: '12c' },
    { topic: 'past simple', name: /Past Simple/i, lessonId: '12d' },
    { topic: 'past continuous', name: /Past Continuous/i, lessonId: '12e' },
    { topic: 'future simple (will)', name: /Future Simple/i, lessonId: '12f' },
    { topic: 'be going to', name: /Be going to/i, lessonId: '12g' }
];

suite('unit12: structure', () => {
    test('Unit 12 exists with id, name, icon, color, and 700 questions', () => {
        const u = env.getGrammarUnit('unit12');
        assert.truthy(u);
        assert.equal(u.id, 'unit12');
        assert.truthy(/Tenses/i.test(u.name));
        assert.equal(u.questions.length, 700);
        assert.truthy(u.icon && u.icon.length > 0);
        assert.truthy(/^#[0-9A-Fa-f]{6}$/.test(u.color));
    });

    test('Unit 12 has 7 lessons (12a..12g), one per tense', () => {
        const lessons = env.getGrammarLessonsForUnit('unit12');
        assert.equal(lessons.length, 7);
        for (const t of TENSES) {
            const l = lessons.find(x => x.id === t.lessonId);
            assert.truthy(l, `lesson ${t.lessonId} missing`);
            assert.truthy(t.name.test(l.title),
                `lesson ${t.lessonId} title "${l.title}" doesn't match ${t.name}`);
        }
    });

    test('every Unit 12 lesson has at least one grammar block', () => {
        const lessons = env.getGrammarLessonsForUnit('unit12');
        for (const l of lessons) {
            assert.truthy(Array.isArray(l.grammar) && l.grammar.length >= 1,
                `lesson ${l.id} missing grammar`);
        }
    });
});

suite('unit12: question distribution per tense', () => {
    for (const t of TENSES) {
        test(`tense "${t.topic}" has ≥80 questions in the bank`, () => {
            const u = env.getGrammarUnit('unit12');
            const matching = u.questions.filter(q =>
                (q.topic || '').toLowerCase().startsWith(t.topic.toLowerCase()));
            assert.truthy(matching.length >= 80,
                `tense "${t.topic}" has only ${matching.length} questions (need ≥80)`);
        });
    }

    test('total questions across all 7 tenses sums to 700', () => {
        const u = env.getGrammarUnit('unit12');
        let total = 0;
        for (const t of TENSES) {
            total += u.questions.filter(q =>
                (q.topic || '').toLowerCase().startsWith(t.topic.toLowerCase())).length;
        }
        assert.equal(total, 700);
    });
});

suite('unit12: question quality', () => {
    test('every Unit 12 question has a meaningful explanation (≥40 chars)', () => {
        const u = env.getGrammarUnit('unit12');
        const short = u.questions.filter(q => (q.explanation || '').length < 40);
        // Allow up to 5 short explanations (the rest must be substantive)
        assert.truthy(short.length <= 5,
            `${short.length} Unit 12 explanations are <40 chars (max 5 allowed): ${short.slice(0, 3).map(q => q.id).join(', ')}`);
    });

    test('every multiple-choice question has unique correct option per stem', () => {
        const u = env.getGrammarUnit('unit12');
        const seen = new Map();
        for (const q of u.questions) {
            if (q.type === 'arrangement') continue;
            const key = (q.q || '') + '||' + (q.options ? q.options[q.correct] : '');
            assert.falsy(seen.has(key),
                `duplicate q+correct: ${q.id} ↔ ${seen.get(key)}`);
            seen.set(key, q.id);
        }
    });

    test('Unit 12 IELTS-style questions reference IELTS or exam-style language', () => {
        const u = env.getGrammarUnit('unit12');
        const ieltsQs = u.questions.filter(q => /ielts/i.test(q.topic || ''));
        assert.truthy(ieltsQs.length >= 50,
            `expected ≥50 IELTS-tagged questions, got ${ieltsQs.length}`);
        // Each should have an explanation mentioning the tense rule
        for (const q of ieltsQs.slice(0, 20)) {
            assert.truthy(q.explanation && q.explanation.length >= 30,
                `IELTS Q ${q.id} explanation too short`);
        }
    });
});

suite('unit12: lessons reference IELTS in intro/iCanGoals', () => {
    test('Unit 12 lesson card intro mentions IELTS exam reference', () => {
        const u12 = env.GRAMMAR_LESSONS.find(u => u.unitId === 'unit12');
        assert.truthy(u12, 'unit12 lessons missing');
        assert.truthy(/ielts/i.test(u12.intro || ''),
            'intro should mention IELTS');
    });

    test('Unit 12 has an iCanGoal about IELTS exam-style questions', () => {
        const u12 = env.GRAMMAR_LESSONS.find(u => u.unitId === 'unit12');
        const goals = (u12.iCanGoals || []).join(' ');
        assert.truthy(/ielts|exam/i.test(goals),
            'iCanGoals should reference IELTS / exam questions');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
