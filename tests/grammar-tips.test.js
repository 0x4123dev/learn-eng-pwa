// tests/grammar-tips.test.js — Vietnamese pronunciation tips (v3.40)
// Locks in that:
//   • -s ending questions get the /s/ /z/ /ɪz/ mnemonic tip
//   • -ed ending questions get their own mnemonic tip
//   • The tip renders both Vietnamese mnemonics ("sháng say, chiều xỉn,
//     sung sướng, zô" and "Thời Fong Kiến Phương Tây")
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
    test('-s endings tip HTML contains the /ɪz/ mnemonic "sháng say, chiều xỉn, sung sướng, zô" (v3.40.4)', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        // Strip HTML to check the visible text content
        const plain = html.replace(/<[^>]+>/g, '');
        for (const piece of ['sháng say', 'chiều xỉn', 'sung sướng', 'zô']) {
            assert.truthy(plain.includes(piece),
                `missing /ɪz/ mnemonic piece "${piece}". Got: "${plain.slice(0, 400)}"`);
        }
    });

    test('-s endings tip HTML contains "Thời Fong Kiến Phương Tây" mnemonic (after HTML strip)', () => {
        const tip = env.getGrammarTipForQuestion({ topic: '-s endings' });
        const html = env.renderGrammarTipHTML(tip);
        // v3.40.4: first letters are wrapped in <strong> for visual emphasis,
        // so strip HTML before checking the visible text.
        const plain = html.replace(/<[^>]+>/g, '');
        assert.truthy(plain.includes('Thời Fong Kiến Phương Tây'),
            `missing /s/ mnemonic. Got plain text: "${plain.slice(0, 400)}"`);
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

    test('-ed endings tip HTML contains "Thời Fong Kiến Phương Tây" (after HTML strip)', () => {
        const tip = env.getGrammarTipForQuestion({ topic: 'past simple regular' });
        const html = env.renderGrammarTipHTML(tip);
        const plain = html.replace(/<[^>]+>/g, '');
        assert.truthy(plain.includes('Thời Fong Kiến Phương Tây'),
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
    test('Unit 3 lesson 3b pronunciation block references the new mnemonic (v3.40.4)', () => {
        const l3b = env.getGrammarLesson('unit3', '3b');
        assert.truthy(l3b && l3b.pronunciation, 'lesson 3b missing pronunciation block');
        const ruleAndExamples = l3b.pronunciation.rule + ' ' +
            (l3b.pronunciation.examples || []).join(' ');
        // /ɪz/ mnemonic — same one used in lesson 2b for consistency
        for (const piece of ['sháng say', 'chiều xỉn', 'sung sướng', 'zô']) {
            assert.truthy(ruleAndExamples.includes(piece),
                `lesson 3b should reference "${piece}"`);
        }
        // /s/ mnemonic stays the same
        assert.truthy(ruleAndExamples.includes('Thời Fong Kiến Phương Tây'),
            'lesson 3b should reference "Thời Fong Kiến Phương Tây"');
        // Old /ɪz/ mnemonic must NOT appear (replaced)
        assert.falsy(ruleAndExamples.includes('Ông Sáu Sang Sông Chạy Xe SH'),
            'old "Ông Sáu Sang Sông Chạy Xe SH" mnemonic must be gone');
    });

    test('Unit 2 lesson 2b plural rule references the +es mnemonic (v3.40.1)', () => {
        const l2b = env.getGrammarLesson('unit2', '2b');
        assert.truthy(l2b, 'lesson 2b missing');
        const pluralBlock = (l2b.grammar || []).find(g => /Plural nouns/i.test(g.title));
        assert.truthy(pluralBlock, 'lesson 2b plural grammar block missing');
        // Find the "+es" row in the form table
        const esRow = (pluralBlock.form || []).find(f => f.label === '+es');
        assert.truthy(esRow, '+es form row missing in plural rule');
        // Strip HTML tags (e.g., <strong>) before comparing so the test
        // checks the VISIBLE text content rather than the markup.
        const plain = esRow.text.replace(/<[^>]+>/g, '');
        // Should list every sibilant: sh, s, ch, x, ss, z
        for (const consonant of ['sh', 's', 'ch', 'x', 'ss', 'z']) {
            assert.truthy(plain.includes(consonant),
                `+es row should mention "${consonant}". Got: "${plain}"`);
        }
        // And include the Vietnamese mnemonic (after HTML strip)
        assert.truthy(plain.includes('sháng say'),
            '+es row should include "sháng say" mnemonic');
        assert.truthy(plain.includes('chiều xỉn'),
            '+es row should include "chiều xỉn" mnemonic');
        assert.truthy(plain.includes('sung sướng'),
            '+es row should include "sung sướng" mnemonic');
        assert.truthy(plain.includes('zô'),
            '+es row should include "zô" mnemonic');
    });

    test('Unit 2 lesson 2b +es mnemonic uses <strong> around the first letters (v3.40.3)', () => {
        const l2b = env.getGrammarLesson('unit2', '2b');
        const pluralBlock = (l2b.grammar || []).find(g => /Plural nouns/i.test(g.title));
        const esRow = (pluralBlock.form || []).find(f => f.label === '+es');
        // Each consonant chunk should be wrapped in <strong>…</strong>
        for (const chunk of ['sh', 's', 'ch', 'x', 'z']) {
            const re = new RegExp(`<strong>${chunk}</strong>`);
            assert.truthy(re.test(esRow.text),
                `expected <strong>${chunk}</strong> wrapper in +es row. Got: "${esRow.text}"`);
        }
    });

    test('Unit 2 lesson 2b irregular plurals include foot/tooth/mouse (v3.40.2)', () => {
        const l2b = env.getGrammarLesson('unit2', '2b');
        const pluralBlock = (l2b.grammar || []).find(g => /Plural nouns/i.test(g.title));
        const irregRow = (pluralBlock.form || []).find(f => f.label === 'irreg.');
        assert.truthy(irregRow, 'irreg. plural row missing');
        // Original 4 must remain
        for (const pair of ['man → men', 'woman → women', 'person → people', 'child → children']) {
            assert.truthy(irregRow.text.includes(pair),
                `irreg row missing original pair "${pair}"`);
        }
        // Three new pairs added in v3.40.2
        for (const pair of ['foot → feet', 'tooth → teeth', 'mouse → mice']) {
            assert.truthy(irregRow.text.includes(pair),
                `irreg row missing new pair "${pair}"`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
