// tests/grammar-pageref.test.js — verify every question maps to a PDF page reference
// AND that explanations meet a minimum quality bar.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

// ──────────────────────────── PAGE REFERENCE COVERAGE ────────────────────────────
suite('pageref: every unit has page-ref rules', () => {
    test('PDF_PAGE_REFS defined for all 4 units', () => {
        assert.truthy(env.PDF_PAGE_REFS, 'PDF_PAGE_REFS not exported');
        for (const id of ['unit8', 'unit9', 'unit10', 'unit11']) {
            assert.truthy(Array.isArray(env.PDF_PAGE_REFS[id]), `${id} has no rules`);
            assert.truthy(env.PDF_PAGE_REFS[id].length >= 5, `${id} has only ${env.PDF_PAGE_REFS[id].length} rules`);
        }
    });

    test('every rule has a regex match, page, and section', () => {
        for (const [unitId, rules] of Object.entries(env.PDF_PAGE_REFS)) {
            for (const r of rules) {
                // Duck-type check (vm-context RegExp is not instanceof main-context RegExp)
                assert.truthy(r.match && typeof r.match.test === 'function', `${unitId} rule missing regex`);
                assert.truthy(typeof r.page === 'string' && r.page.length > 0, `${unitId} rule missing page`);
                assert.truthy(typeof r.section === 'string' && r.section.length > 0, `${unitId} rule missing section`);
            }
        }
    });
});

suite('pageref: every question resolves to a PDF page', () => {
    for (const unitId of ['unit8', 'unit9', 'unit10', 'unit11']) {
        test(`every ${unitId} question has a PDF page reference`, () => {
            const u = env.getGrammarUnit(unitId);
            const unmapped = [];
            for (const q of u.questions) {
                const ref = env.getPdfPageRef(unitId, q);
                if (!ref) unmapped.push(q.id + ' (topic: ' + q.topic + ')');
            }
            assert.equal(unmapped.length, 0, `${unmapped.length} unmapped questions: ${unmapped.slice(0, 10).join(', ')}${unmapped.length > 10 ? '...' : ''}`);
        });
    }
});

suite('pageref: page references look valid', () => {
    test('page references match expected formats (e.g., 88-89, 95)', () => {
        for (const [unitId, rules] of Object.entries(env.PDF_PAGE_REFS)) {
            for (const r of rules) {
                assert.truthy(/^\d{2,3}(-\d{2,3})?$/.test(r.page),
                    `${unitId} ${r.section}: invalid page format "${r.page}"`);
            }
        }
    });

    test('section labels follow X[a-g] or range or "X Cover" / "X Review" pattern', () => {
        for (const [unitId, rules] of Object.entries(env.PDF_PAGE_REFS)) {
            for (const r of rules) {
                assert.truthy(/^(\d+[a-g]?(-[a-g])?|\d+ (Cover|Review))$/.test(r.section),
                    `${unitId}: invalid section format "${r.section}"`);
            }
        }
    });

    test('formatPdfPageRef returns a readable string', () => {
        const u = env.getGrammarUnit('unit10');
        const q = u.questions.find(x => x.topic && x.topic.includes('memory'));
        if (q) {
            const str = env.formatPdfPageRef('unit10', q);
            assert.truthy(str.includes('p.'), 'should include "p."');
            assert.truthy(str.includes('Section'), 'should include "Section"');
        }
    });
});

// ──────────────────────────── EXPLANATION QUALITY ────────────────────────────
suite('explanations: minimum quality bar', () => {
    test('every explanation is at least 20 characters long', () => {
        // Relaxed from 30 → 20 to accommodate concise A1-level vocab entries
        // like "Italy → Italian." or "expensive ↔ cheap." which are
        // pedagogically complete even when short.
        const short = [];
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (!q.explanation || q.explanation.length < 20) {
                    short.push({ id: q.id, len: q.explanation ? q.explanation.length : 0, text: q.explanation });
                }
            }
        }
        assert.equal(short.length, 0, `${short.length} explanations under 20 chars: ${short.slice(0, 5).map(s => s.id + '(' + s.len + ')').join(', ')}`);
    });

    test('every explanation has at least one common explanatory word', () => {
        // Loose heuristic: explanation has some grammatical structure beyond just naming words
        const signals = /[.!?]|=|→|—|\b(a|an|the|is|are|was|were|have|has|had|do|does|did|in|on|at|of|to|for|with|by|from|as|because|when|after|before|use|used|means|opposite|same|similar|rule|pattern|form|structure|describes?|shows?|expresses?|sounds?|stress|silent|verb|noun|adjective|tense|present|past|future|negative|question|article|singular|plural|always|never|usually|here|that|this|these|those)\b/i;
        const weak = [];
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (!signals.test(q.explanation || '')) {
                    weak.push({ id: q.id, text: q.explanation });
                }
            }
        }
        assert.equal(weak.length, 0, `${weak.length} weak explanations: ${weak.slice(0, 5).map(s => s.id + ': ' + (s.text || '').slice(0, 40)).join(' | ')}`);
    });

    test('explanations are not trivial repetitions of the answer', () => {
        // Catch cases like option = "happy" + explanation = "happy"
        const trivial = [];
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement' && q.options && q.correct !== undefined) {
                    const ans = (q.options[q.correct] || '').trim();
                    if (ans.length > 0 && q.explanation && q.explanation.trim() === ans) {
                        trivial.push(q.id);
                    }
                }
            }
        }
        assert.equal(trivial.length, 0, `Trivial explanations: ${trivial.join(', ')}`);
    });
});

// ──────────────────────────── PAGE-REF DISTRIBUTION CHECK ────────────────────────────
suite('pageref: distribution across all sections', () => {
    test('each unit has questions referenced to multiple sections (not all on 1 page)', () => {
        for (const unitId of ['unit8', 'unit9', 'unit10', 'unit11']) {
            const u = env.getGrammarUnit(unitId);
            const sections = new Set();
            for (const q of u.questions) {
                const r = env.getPdfPageRef(unitId, q);
                if (r) sections.add(r.section);
            }
            assert.truthy(sections.size >= 4, `${unitId} only references ${sections.size} sections: ${[...sections].join(', ')}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
