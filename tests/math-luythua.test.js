// math-luythua.test.js — gói "Ôn tập chương 1&2 · Lũy thừa & Căn bậc hai"
// (js/math-luythua.js): 20 câu trắc nghiệm công thức lũy thừa + 20 bài tính căn.
//
// Gói này được viết tay (không qua scripts/build-math-data.js), nên các bất
// biến mà build script vẫn kiểm cho ngân hàng chính phải được khóa lại ở đây:
// đáp án nằm trong 4 lựa chọn, chữ cái đúng rải đều A–D, giải thích có 🔑 và
// đủ ✗ cho từng lựa chọn sai, không có "<" trần lọt vào innerHTML, và mỗi đáp
// số căn phải đúng là căn bậc hai của số trong đề. Quan trọng nhất: đủ cả 8
// công thức trong bảng LŨY THỪA — thiếu một công thức là gói mất đúng cái lý
// do nó tồn tại.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { MATH_LT_CHAPTER, MATH_LT_LABEL, MATH_LT_QUESTIONS } =
    require(path.join(root, 'js', 'math-luythua.js'));
const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));

const MCQ = MATH_LT_QUESTIONS.filter(q => q.type !== 'calc');
const CALC = MATH_LT_QUESTIONS.filter(q => q.type === 'calc');

// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
global.MATH_LT_CHAPTER = MATH_LT_CHAPTER;
global.MATH_LT_LABEL = MATH_LT_LABEL;
global.MATH_LT_QUESTIONS = MATH_LT_QUESTIONS;
const math = require(path.join(root, 'js', 'math.js'));

suite('luy thua: pack shape', () => {
    test('40 questions: mlt-1..20 formula MCQs then mlt-c1..c20 typed roots', () => {
        assert.equal(MATH_LT_QUESTIONS.length, 40);
        assert.equal(MCQ.length, 20);
        assert.equal(CALC.length, 20);
        MCQ.forEach((q, i) => {
            assert.equal(q.id, `mlt-${i + 1}`, `MCQ ${i + 1} has id "${q.id}"`);
            assert.equal(q.topic, 'Lũy thừa', `${q.id} topic drifted`);
        });
        CALC.forEach((q, i) => {
            assert.equal(q.id, `mlt-c${i + 1}`, `calc ${i + 1} has id "${q.id}"`);
            assert.equal(q.topic, 'Căn bậc hai', `${q.id} topic drifted`);
        });
        MATH_LT_QUESTIONS.forEach(q =>
            assert.equal(q.ch, MATH_LT_CHAPTER, `${q.id} has ch=${q.ch}`));
        assert.equal(MATH_LT_LABEL, 'Ôn tập chương 1&2 · Lũy thừa & Căn bậc hai');
    });

    test('every MCQ has 4 unique options and the answer is the correct one', () => {
        for (const q of MCQ) {
            assert.truthy(Array.isArray(q.options) && q.options.length === 4,
                `${q.id}: needs exactly 4 options`);
            assert.equal(new Set(q.options).size, 4, `${q.id}: duplicate options`);
            assert.truthy(q.correct >= 0 && q.correct <= 3, `${q.id}: correct out of range`);
            assert.equal(q.answer, q.options[q.correct],
                `${q.id}: answer does not match options[correct]`);
        }
    });

    test('MCQ correct letters are spread evenly: five each of A, B, C, D', () => {
        // Hand-authored set, so the spread can be pinned exactly — a child who
        // notices "the answer is always C" stops reading the formulas.
        const counts = [0, 0, 0, 0];
        MCQ.forEach(q => counts[q.correct]++);
        counts.forEach((n, i) =>
            assert.equal(n, 5, `answer ${'ABCD'[i]} used ${n}/20 times`));
    });

    test('every explanation teaches: 🔑 rule, and one ✗ per wrong MCQ option', () => {
        for (const q of MATH_LT_QUESTIONS) {
            assert.truthy(/🔑/.test(q.explanation), `${q.id}: explanation has no 🔑 rule`);
        }
        for (const q of MCQ) {
            const crosses = (q.explanation.match(/✗/g) || []).length;
            assert.equal(crosses, 3, `${q.id}: ${crosses} ✗ marks, expected one per wrong option`);
        }
    });
});

suite('luy thua: the 8 formulas are all covered', () => {
    test('each formula from the LŨY THỪA table has a recall question', () => {
        const has = (fn, label) =>
            assert.truthy(MCQ.some(fn), `no question covers ${label}`);
        has(q => q.q.includes('x⁰') && q.answer === '1', 'x⁰ = 1');
        has(q => q.q.includes('x¹') && q.answer === 'x', 'x¹ = x');
        has(q => q.answer === 'xᵐ⁺ⁿ', 'xᵐ · xⁿ = xᵐ⁺ⁿ');
        has(q => q.answer === 'xᵐ⁻ⁿ', 'xᵐ : xⁿ = xᵐ⁻ⁿ');
        has(q => q.answer === 'xᵐⁿ', '(xᵐ)ⁿ = xᵐⁿ');
        has(q => q.answer === 'xⁿyⁿ', '(xy)ⁿ = xⁿyⁿ');
        has(q => q.answer === 'xⁿ/yⁿ', '(x/y)ⁿ = xⁿ/yⁿ');
        has(q => q.answer === '1/xⁿ', 'x⁻ⁿ = 1/xⁿ');
    });

    test('each formula family also has a numeric application question', () => {
        const answers = MCQ.map(q => q.answer);
        // nhân / chia / lũy thừa của lũy thừa / tích / thương / mũ 0 / mũ âm
        ['2⁵', '25', '3⁶', '2³ · 5³', '4/9', '1/8', 'x⁻⁴'].forEach(a =>
            assert.truthy(answers.includes(a), `no application question with answer "${a}"`));
        assert.truthy(MCQ.some(q => q.q.includes('(−7)⁰') && q.answer === '1'),
            'no numeric x⁰ question');
    });
});

suite('luy thua: the 20 typed square-root drills', () => {
    test('every root answer really is the square root of the number asked', () => {
        for (const q of CALC) {
            const m = /√(\d+)/.exec(q.q) || /x² = (\d+)/.exec(q.q);
            assert.truthy(m, `${q.id}: cannot find the radicand in "${q.q}"`);
            const n = Number(m[1]);
            const r = Number(q.answer);
            assert.equal(r * r, n, `${q.id}: ${q.answer}² ≠ ${n}`);
            assert.truthy(r > 0, `${q.id}: arithmetic square root must be positive`);
        }
    });

    test('20 distinct perfect squares, typed on the keypad (no options)', () => {
        const radicands = CALC.map(q =>
            Number((/√(\d+)/.exec(q.q) || /x² = (\d+)/.exec(q.q))[1]));
        assert.equal(new Set(radicands).size, 20, 'duplicate radicands');
        for (const q of CALC) {
            assert.equal(q.type, 'calc', `${q.id}: must be typed`);
            assert.truthy(!q.options, `${q.id}: typed questions must not carry options`);
            assert.truthy(Array.isArray(q.keys), `${q.id}: keypad keys[] missing`);
            assert.truthy(math.mathIsTyped(q), `${q.id}: mathIsTyped must treat it as typed`);
            assert.truthy(math.mathGrade(q, q.answer), `${q.id}: its own answer must grade correct`);
        }
        // Both phrasings are present so the child meets the skill from
        // each direction: "Tính √n" and "x² = n".
        assert.truthy(CALC.some(q => q.q.startsWith('Tính √')), 'no "Tính √n" phrasing');
        assert.truthy(CALC.some(q => q.q.includes('x² =')), 'no "x² = n" phrasing');
    });
});

suite('luy thua: safety and wiring', () => {
    test('no bare "<" survives into innerHTML fields', () => {
        for (const q of MATH_LT_QUESTIONS) {
            assert.truthy(!q.q.includes('<'), `${q.id}: "<" in question text`);
            (q.options || []).forEach(o => assert.truthy(!String(o).includes('<'), `${q.id}: "<" in option`));
            const stripped = q.explanation.replace(/<br\s*\/?>|<\/?b>/gi, '');
            assert.truthy(!stripped.includes('<'), `${q.id}: stray "<" in explanation`);
        }
    });

    test('mathById resolves pack questions, so retry drill and the wrong-answer panel work', () => {
        assert.equal(math.mathById('mlt-5').answer, 'xᵐⁿ');
        assert.equal(math.mathById('mlt-c16').answer, '17');
    });

    test('startMathLtQuiz runs ALL 40 questions in one round', () => {
        const prevDocument = global.document;
        const hadDocument = 'document' in global;
        global.document = { getElementById: () => null, querySelector: () => null };
        try {
            math.startMathLtQuiz();
            assert.truthy(math.isMathQuizActive(), 'quiz did not start');
            const qs = math.mathQuizQuestions();
            assert.equal(qs.length, 40, 'a pack round asks all 40 questions');
            assert.equal(new Set(qs.map(q => q.id)).size, 40, 'shuffle lost or duplicated a question');
        } finally {
            math.abandonMathQuiz();
            if (hadDocument) global.document = prevDocument;
            else delete global.document;
        }
    });

    test('the practice screen shows the pack card under Ôn tổng hợp', () => {
        const prevState = global.appState;
        const hadState = 'appState' in global;
        global.appState = { mathHistory: [] };
        try {
            const html = math.renderMathPracticeHTML();
            assert.truthy(html.includes('Ôn tập chương 1&2'), 'card title missing');
            assert.truthy(html.includes('startMathLtQuiz()'), 'card does not start the pack quiz');
            assert.truthy(html.includes('40 câu'), 'card does not say the pack size');
            assert.truthy(html.indexOf('Ôn tổng hợp') < html.indexOf('Ôn tập chương 1&2'),
                'pack card should sit under Ôn tổng hợp');
        } finally {
            if (hadState) global.appState = prevState;
            else delete global.appState;
        }
    });

    test('the pack script is registered: index.html tag order and sw.js cache', () => {
        const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
        const html = read('index.html');
        // The maths banks are deferred (js/lazy-data.js): they load when the
        // Toán tab opens instead of on every app start. See tests/lazy-data.test.js.
        assert.falsy(html.includes('<script src="js/math-luythua.js"></script>'),
            'the pack must not be an eager script any more');
        const lazy = read('js/lazy-data.js');
        const block = lazy.slice(lazy.indexOf('mathHubScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/math-luythua.js'),
            'the pack must be listed under mathHubScreen in the loader');
        assert.truthy(read('sw.js').includes("'/js/math-luythua.js'"),
            'sw.js ASSETS is missing /js/math-luythua.js');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
