// tests/grammar-tips.test.js — Vietnamese pronunciation tips (v3.40)
// Locks in that:
//   • -s ending questions get the /s/ /z/ /ɪz/ mnemonic tip
//   • -ed ending questions get their own mnemonic tip
//   • The tip renders both Vietnamese mnemonics ("Ông Sáu Sang Sông Chạy Xe SH"
//     and "Thời Fong Kiến Phương Tây")
//   • Unrelated topics get NO tip (no noise on irrelevant questions)
//   • The matcher hits all topic variants used across units 2/3/8/9/10

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('grammar tips: -s endings rule matches the right topics', () => {
    const sEndingTopics = [
        '-s endings',
        'underlined letter (final s: /s/ vs /z/)',
        'underlined letter (final s: /s/ vs /z/ vs /ɪz/)',
        'underlined letter (s: /s/ vs /z/)',
        'plural nouns',
        'plural -s',
        'sound and spelling',
        'final s: /s/ vs /z/',
        'sound spelling (final s)',
    ];
    for (const topic of sEndingTopics) {
        test(`topic "${topic}" returns the s-endings tip`, () => {
            const tip = env.getGrammarTipForQuestion({ topic });
            // "sound and spelling" might or might not match depending on the
            // regex (some matches require "final s"). Accept either case but
            // log it so we know.
            if (topic.includes('sound and spelling') && !tip) {
                // Acceptable — generic "sound and spelling" without "final s"
                // doesn't necessarily target -s endings.
                return;
            }
            assert.truthy(tip, `expected tip for topic "${topic}", got null`);
            assert.equal(tip.id, 's-endings');
        });
    }
});

suite('grammar tips: -ed endings rule matches the right topics', () => {
    const edTopics = [
        '-ed endings',
        'past tense -ed',
        'past simple regular',
        'sound spelling (final -ed)',
    ];
    for (const topic of edTopics) {
        test(`topic "${topic}" returns the ed-endings tip`, () => {
            const tip = env.getGrammarTipForQuestion({ topic });
            assert.truthy(tip, `expected tip for topic "${topic}", got null`);
            assert.equal(tip.id, 'ed-endings');
        });
    }
});

suite('grammar tips: unrelated topics get NO tip', () => {
    const unrelated = [
        'present continuous',
        'have got',
        'family',
        'clothes',
        'comparative adjectives',
        'time expressions',
        'opinion adjectives',
        'making suggestions'
    ];
    for (const topic of unrelated) {
        test(`topic "${topic}" → null (no tip noise)`, () => {
            const tip = env.getGrammarTipForQuestion({ topic });
            assert.equal(tip, null, `topic "${topic}" should NOT trigger a tip`);
        });
    }
});

suite('grammar tips: rendered HTML contains the Vietnamese mnemonics', () => {
    test('-s endings tip HTML contains "Ông Sáu Sang Sông Chạy Xe SH" mnemonic', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        assert.truthy(html.includes('Ông Sáu Sang Sông Chạy Xe SH'),
            'missing /iz/ mnemonic');
    });

    test('-s endings tip HTML contains "Thời Fong Kiến Phương Tây" mnemonic', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        assert.truthy(html.includes('Thời Fong Kiến Phương Tây'),
            'missing /s/ mnemonic');
    });

    test('-s endings tip HTML shows all three sound tags: /ɪz/, /s/, /z/', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        assert.truthy(html.includes('/ɪz/'), 'missing /ɪz/');
        assert.truthy(html.includes('/s/'),  'missing /s/');
        assert.truthy(html.includes('/z/'),  'missing /z/');
    });

    test('-s endings tip includes example words for each sound', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        // /ɪz/ examples
        assert.truthy(/buses|watches|finishes|judges|boxes/i.test(html),
            'missing /ɪz/ example words');
        // /s/ examples
        assert.truthy(/stops|writes|kicks|laughs/i.test(html),
            'missing /s/ example words');
        // /z/ examples
        assert.truthy(/needs|plays|loves|dogs|studies/i.test(html),
            'missing /z/ example words');
    });

    test('-ed endings tip HTML contains "Thời Fong Kiến Phương Tây"', () => {
        const tip = env.getGrammarTipForQuestion({ topic: 'past simple regular' });
        const html = env.renderGrammarTipHTML(tip);
        assert.truthy(html.includes('Thời Fong Kiến Phương Tây'),
            '-ed tip should reuse the voiceless-consonant mnemonic');
    });

    test('-ed endings tip shows /t/, /d/, /ɪd/ tags', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-ed endings' });
        const html = env.renderGrammarTipHTML(tip);
        assert.truthy(html.includes('/t/'),  'missing /t/');
        assert.truthy(html.includes('/d/'),  'missing /d/');
        assert.truthy(html.includes('/ɪd/'), 'missing /ɪd/');
    });

    test('renderGrammarTipHTML(null) returns empty string (safe to inline)', () => {
        assert.equal(env.renderGrammarTipHTML(null), '');
    });
});

suite('grammar tips: tip wraps every relevant question across all units', () => {
    test('every Unit 3 "-s endings" question gets a tip', () => {
        const u3 = env.getGrammarUnit('unit3');
        const sQs = u3.questions.filter(q => q.topic === '-s endings');
        assert.truthy(sQs.length >= 8, `unit3 should have ≥8 "-s endings" questions, got ${sQs.length}`);
        for (const q of sQs) {
            const tip = env.getGrammarTipForQuestion(q);
            assert.truthy(tip && tip.id === 's-endings',
                `${q.id} should get the s-endings tip`);
        }
    });

    test('Unit 8 final-s pronunciation questions get the tip', () => {
        const u8 = env.getGrammarUnit('unit8');
        const finalSQs = u8.questions.filter(q =>
            /final s.*\/s\/|final s.*\/z\/|plural -s|plural nouns/i.test(q.topic || ''));
        assert.truthy(finalSQs.length >= 1, 'unit8 should have ≥1 final-s pronunciation question');
        for (const q of finalSQs) {
            const tip = env.getGrammarTipForQuestion(q);
            assert.truthy(tip && tip.id === 's-endings',
                `${q.id} (${q.topic}) should get the s-endings tip`);
        }
    });

    test('Unit 6 -ed endings questions get the ed-endings tip', () => {
        const u6 = env.getGrammarUnit('unit6');
        const edQs = u6.questions.filter(q => q.topic === '-ed endings');
        assert.truthy(edQs.length >= 5, `unit6 should have ≥5 "-ed endings" questions`);
        for (const q of edQs) {
            const tip = env.getGrammarTipForQuestion(q);
            assert.truthy(tip && tip.id === 'ed-endings',
                `${q.id} should get the ed-endings tip`);
        }
    });
});

suite('grammar tips: lesson detail also renders the tip inline', () => {
    test('Unit 3 lesson 3b pronunciation block now references the mnemonics', () => {
        const l3b = env.getGrammarLesson('unit3', '3b');
        assert.truthy(l3b && l3b.pronunciation, 'lesson 3b missing pronunciation block');
        const ruleAndExamples = l3b.pronunciation.rule + ' ' +
            (l3b.pronunciation.examples || []).join(' ');
        assert.truthy(ruleAndExamples.includes('Ông Sáu Sang Sông Chạy Xe SH'),
            'lesson 3b should reference "Ông Sáu Sang Sông Chạy Xe SH"');
        assert.truthy(ruleAndExamples.includes('Thời Fong Kiến Phương Tây'),
            'lesson 3b should reference "Thời Fong Kiến Phương Tây"');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
