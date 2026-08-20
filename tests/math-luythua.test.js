// math-luythua.test.js — gói "Ôn tập chương 2&3 · Lũy thừa" (js/math-luythua.js).
//
// Gói này được viết tay (không qua scripts/build-math-data.js), nên các bất
// biến mà build script vẫn kiểm cho ngân hàng chính phải được khóa lại ở đây:
// đáp án nằm trong 4 lựa chọn, chữ cái đúng rải đều A–D, giải thích có 🔑 và
// đủ ✗ cho từng lựa chọn sai, và không có "<" trần lọt vào innerHTML.
// Quan trọng nhất: đủ cả 8 công thức trong bảng LŨY THỪA — thiếu một công
// thức là gói mất đúng cái lý do nó tồn tại.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { MATH_LT_CHAPTER, MATH_LT_LABEL, MATH_LT_QUESTIONS } =
    require(path.join(root, 'js', 'math-luythua.js'));
const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));

// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
global.MATH_LT_CHAPTER = MATH_LT_CHAPTER;
global.MATH_LT_LABEL = MATH_LT_LABEL;
global.MATH_LT_QUESTIONS = MATH_LT_QUESTIONS;
const math = require(path.join(root, 'js', 'math.js'));

suite('luy thua: the 20-question pack', () => {
    test('exactly 20 questions, ids mlt-1..mlt-20 in order', () => {
        assert.equal(MATH_LT_QUESTIONS.length, 20);
        MATH_LT_QUESTIONS.forEach((q, i) => {
            assert.equal(q.id, `mlt-${i + 1}`, `question ${i + 1} has id "${q.id}"`);
            assert.equal(q.ch, MATH_LT_CHAPTER, `${q.id} has ch=${q.ch}`);
            assert.equal(q.topic, 'Lũy thừa', `${q.id} topic drifted`);
        });
    });

    test('every question has 4 unique options and the answer is the correct one', () => {
        for (const q of MATH_LT_QUESTIONS) {
            assert.truthy(Array.isArray(q.options) && q.options.length === 4,
                `${q.id}: needs exactly 4 options`);
            assert.equal(new Set(q.options).size, 4, `${q.id}: duplicate options`);
            assert.truthy(q.correct >= 0 && q.correct <= 3, `${q.id}: correct out of range`);
            assert.equal(q.answer, q.options[q.correct],
                `${q.id}: answer does not match options[correct]`);
        }
    });

    test('correct letters are spread evenly: five each of A, B, C, D', () => {
        // Hand-authored set, so the spread can be pinned exactly — a child who
        // notices "the answer is always C" stops reading the formulas.
        const counts = [0, 0, 0, 0];
        MATH_LT_QUESTIONS.forEach(q => counts[q.correct]++);
        counts.forEach((n, i) =>
            assert.equal(n, 5, `answer ${'ABCD'[i]} used ${n}/20 times`));
    });

    test('every explanation teaches: 🔑 rule plus one ✗ per wrong option', () => {
        for (const q of MATH_LT_QUESTIONS) {
            assert.truthy(/🔑/.test(q.explanation), `${q.id}: explanation has no 🔑 rule`);
            const crosses = (q.explanation.match(/✗/g) || []).length;
            assert.equal(crosses, 3, `${q.id}: ${crosses} ✗ marks, expected one per wrong option`);
        }
    });

    test('all 8 formulas from the LŨY THỪA table are covered', () => {
        // One check per formula in the printed table the pack revises.
        const has = (fn, label) =>
            assert.truthy(MATH_LT_QUESTIONS.some(fn), `no question covers ${label}`);
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
        const answers = MATH_LT_QUESTIONS.map(q => q.answer);
        // nhân / chia / lũy thừa của lũy thừa / tích / thương / mũ 0 / mũ âm
        ['2⁵', '25', '3⁶', '2³ · 5³', '4/9', '1/8', 'x⁻⁴'].forEach(a =>
            assert.truthy(answers.includes(a), `no application question with answer "${a}"`));
        assert.truthy(MATH_LT_QUESTIONS.some(q => q.q.includes('(−7)⁰') && q.answer === '1'),
            'no numeric x⁰ question');
    });

    test('no bare "<" survives into innerHTML fields', () => {
        // q/options are rendered through mathFormula, explanations through
        // innerHTML where only <br> and <b> are legitimate tags.
        for (const q of MATH_LT_QUESTIONS) {
            assert.truthy(!q.q.includes('<'), `${q.id}: "<" in question text`);
            q.options.forEach(o => assert.truthy(!String(o).includes('<'), `${q.id}: "<" in option`));
            const stripped = q.explanation.replace(/<br\s*\/?>|<\/?b>/gi, '');
            assert.truthy(!stripped.includes('<'), `${q.id}: stray "<" in explanation`);
        }
    });
});

suite('luy thua: wiring into the math tab', () => {
    test('mathById resolves pack questions, so retry drill and the wrong-answer panel work', () => {
        assert.equal(math.mathById('mlt-5').answer, 'xᵐⁿ');
        assert.equal(math.mathById('mlt-20').answer, 'x⁻⁴');
    });

    test('startMathLtQuiz runs ALL 20 questions in one round', () => {
        const prevDocument = global.document;
        const hadDocument = 'document' in global;
        global.document = { getElementById: () => null, querySelector: () => null };
        try {
            math.startMathLtQuiz();
            assert.truthy(math.isMathQuizActive(), 'quiz did not start');
            const qs = math.mathQuizQuestions();
            assert.equal(qs.length, 20, 'a pack round asks all 20 questions');
            assert.equal(new Set(qs.map(q => q.id)).size, 20, 'shuffle lost or duplicated a question');
            assert.equal(math.mathCurrentQuestion().topic, 'Lũy thừa');
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
            assert.truthy(html.includes('Ôn tập chương 2&3'), 'card title missing');
            assert.truthy(html.includes('startMathLtQuiz()'), 'card does not start the pack quiz');
            assert.truthy(html.includes('20 câu'), 'card does not say the pack size');
            assert.truthy(html.indexOf('Ôn tổng hợp') < html.indexOf('Ôn tập chương 2&3'),
                'pack card should sit under Ôn tổng hợp');
        } finally {
            if (hadState) global.appState = prevState;
            else delete global.appState;
        }
    });

    test('the pack script is registered: index.html tag order and sw.js cache', () => {
        const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
        const html = read('index.html');
        assert.truthy(html.includes('<script src="js/math-luythua.js"></script>'),
            'index.html does not load js/math-luythua.js');
        assert.truthy(html.indexOf('js/math-luythua.js') < html.indexOf('js/math.js"'),
            'data script must load before js/math.js');
        assert.truthy(read('sw.js').includes("'/js/math-luythua.js'"),
            'sw.js ASSETS is missing /js/math-luythua.js');
    });
});
