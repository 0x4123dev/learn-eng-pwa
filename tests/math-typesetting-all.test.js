// math-typesetting-all.test.js — every visible formula in the complete Math
// experience goes through the same readable fraction/root/mixed-number engine.
const { suite, test, assert } = require('./harness');
const path = require('path');

const root = path.join(__dirname, '..');
const { MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));
const { MATH_SOURCE_EXAMS } = require(path.join(root, 'js', 'math-source-exams.js'));
const math = require(path.join(root, 'js', 'math.js'));

const questions = MATH_QUESTIONS.concat(
    MATH_EXAMS.flatMap(e => e.questions),
    MATH_SOURCE_EXAMS.flatMap(e => e.questions)
);
const visible = questions.flatMap(q => [q.q, q.answer].concat(q.options || []))
    .filter(v => v != null).map(String);
const FRACTION = /(?:\([^)]*\)|\|[^|]+\||[−-]?[\dA-Za-zÀ-ỹ]+[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ᵃᵇᶜᵈᵉᵏᵐⁿᵖʳˢᵗᵘᵛʷˣʸᶻ]*)\/(?!\/)(?:\([^)]*\)|\|[^|]+\||[−-]?[\dA-Za-zÀ-ỹ]+)/;

suite('math typesetting: the complete Math bank', () => {
    test('all 662 practice and exam questions render balanced markup', () => {
        assert.equal(questions.length, 662);
        visible.forEach((source, i) => {
            const html = math.mathFormula(source);
            assert.equal((html.match(/<span\b/g) || []).length, (html.match(/<\/span>/g) || []).length,
                `unbalanced span in formula ${i}: ${source}`);
            assert.equal((html.match(/<sup>/g) || []).length, (html.match(/<\/sup>/g) || []).length,
                `unbalanced exponent in formula ${i}: ${source}`);
        });
    });

    test('every fraction-like expression is drawn with a real fraction bar', () => {
        const fractions = visible.filter(s => FRACTION.test(s));
        assert.truthy(fractions.length >= 500, `only ${fractions.length} fraction strings scanned`);
        const missed = fractions.filter(s => !math.mathFormula(s).includes('math-frac'));
        assert.deepEqual(missed.slice(0, 5), [], `${missed.length} fractions remained inline`);
    });

    test('every mixed number is grouped and every square root has a vinculum', () => {
        const mixed = visible.filter(s => /[−-]?\d+\s+\d+\/\d+/.test(s));
        const roots = visible.filter(s => /√(?=[(\dA-Za-zÀ-ỹ])/.test(s));
        assert.truthy(mixed.length >= 12, `only ${mixed.length} mixed-number strings scanned`);
        assert.truthy(roots.length >= 110, `only ${roots.length} radical strings scanned`);
        assert.deepEqual(mixed.filter(s => !math.mathFormula(s).includes('math-mixed')), []);
        assert.deepEqual(roots.filter(s => !math.mathFormula(s).includes('math-root')), []);
    });

    test('all explanations and lesson bodies keep trusted tags and balanced formula markup', () => {
        const rich = questions.map(q => q.explanation).concat(MATH_LESSONS.map(l => l.content)).filter(Boolean);
        rich.forEach((source, i) => {
            const html = math.mathRich(source);
            assert.equal((html.match(/<span\b/g) || []).length, (html.match(/<\/span>/g) || []).length,
                `unbalanced rich formula ${i}`);
            assert.falsy(/&lt;(?:b|br|strong|i|u)&gt;/i.test(html), `trusted tag escaped in rich formula ${i}`);
        });
    });

    test('legacy prose and caret powers render as real raised mathematical exponents', () => {
        const legacy = visible.concat(questions.map(q => q.explanation || ''))
            .filter(s => /(?:[\d)]\s+mũ|\^)\s*\([^()]+\)/i.test(s));
        assert.truthy(legacy.length >= 14, `only ${legacy.length} legacy powers scanned`);
        legacy.forEach(source => {
            const html = math.mathRich(source);
            assert.truthy(html.includes('<sup>'), `power not raised: ${source}`);
            assert.falsy(/[\d)]\s+mũ\s*\(/i.test(html), `prose power still visible: ${source}`);
            assert.falsy(/\^\s*\(/.test(html), `caret power still visible: ${source}`);
        });
    });

    test('all 662 explanations use a readable worked-solution layout', () => {
        questions.forEach(q => {
            const html = math.mathExplanationHTML(q.explanation, q);
            assert.truthy(html.includes('math-explanation-layout'), `missing layout: ${q.id}`);
            assert.truthy(html.includes('math-solution-steps'), `missing steps: ${q.id}`);
            const worked = (html.match(/<ol class="math-solution-steps">([\s\S]*?)<\/ol>/) || [])[1] || '';
            assert.truthy((worked.match(/<li>/g) || []).length >= 3, `not detailed enough: ${q.id || q.n}`);
            assert.truthy(html.includes('Quy tắc cần dùng:'), `missing rule: ${q.id || q.n}`);
            assert.truthy(html.includes('Kết luận:'), `missing conclusion: ${q.id || q.n}`);
            assert.falsy(html.includes('🔑'), `key emoji leaked: ${q.id}`);
            assert.falsy(html.includes('✗'), `cross emoji leaked: ${q.id}`);
        });
    });

    test('the detailed rule stays on the question topic, including HK1 geometry', () => {
        const cases = [
            ['Tam giác vuông bằng nhau', 'cạnh và góc tương ứng'],
            ['Đường trung trực', 'cách đều hai đầu mút'],
            ['Hai góc đối đỉnh', 'đối đỉnh thì bằng nhau'],
            ['Tiên đề Euclid', 'chỉ có một đường thẳng song song'],
            ['Số đối', 'hai số đối có tổng bằng 0'],
        ];
        cases.forEach(([topic, expected]) => {
            const q = questions.find(item => item.topic === topic);
            assert.truthy(q, `missing audit topic: ${topic}`);
            assert.truthy(math.mathExplanationHTML(q.explanation, q).includes(expected),
                `wrong rule for ${topic}`);
        });
    });
});
