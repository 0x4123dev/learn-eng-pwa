// math-hints.test.js — the "💡 Gợi ý" panel under Chương 3 and 4 questions.
//
// Those two chapters are the term-heavy ones: "Tia phân giác của một góc bẹt
// (180°)…" needs BOTH definitions before the child can do the 180 : 2. Forget
// one word and the question is lost, even though the arithmetic is trivial.
// The hint puts the definitions back on the same screen as the question.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_GLOSSARY } = require(path.join(root, 'js', 'math-glossary.js'));
const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));

global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_GLOSSARY = MATH_GLOSSARY;
global.MATH_EXAMS = MATH_EXAMS;
global.appState = { coins: 0, mathHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const math = require(path.join(root, 'js', 'math.js'));

const CH = q => MATH_QUESTIONS.filter(x => x.ch === q);

suite('math hints: the glossary', () => {
    test('covers chapters 3 and 4, and nothing else', () => {
        assert.truthy(MATH_GLOSSARY.length >= 25, `only ${MATH_GLOSSARY.length} entries`);
        const chapters = [...new Set(MATH_GLOSSARY.map(e => e.ch))].sort();
        assert.deepEqual(chapters, [3, 4]);
    });

    test('every entry has a name, match strings and a definition', () => {
        MATH_GLOSSARY.forEach((e, i) => {
            assert.truthy(e.t && e.t.length >= 3, `entry ${i}: no name`);
            assert.truthy(Array.isArray(e.m) && e.m.length, `${e.t}: no match strings`);
            assert.truthy(e.d && e.d.length >= 40, `${e.t}: definition too thin`);
            assert.truthy(!/<(?!\/?b>)/.test(e.d), `${e.t}: only <b> is allowed in a definition`);
        });
    });

    test('names are unique, so the panel never lists the same thing twice', () => {
        const names = MATH_GLOSSARY.map(e => e.t);
        assert.equal(new Set(names).size, names.length, 'duplicate glossary entry');
    });
});

suite('math hints: matching questions to definitions', () => {
    test('every Chương 3 and 4 question gets at least one definition', () => {
        [3, 4].forEach(ch => {
            const bare = CH(ch).filter(q => math.mathHintsFor(q).length === 0);
            assert.deepEqual(bare.map(q => q.id), [], `chương ${ch}: these questions have no hint`);
        });
    });

    test('the other chapters get none — the panel is scoped, not global', () => {
        [1, 2, 5].forEach(ch => {
            const withHints = CH(ch).filter(q => math.mathHintsFor(q).length > 0);
            assert.deepEqual(withHints.map(q => q.id), [], `chương ${ch} should have no hints`);
        });
    });

    test('a hint never comes from another chapter', () => {
        MATH_QUESTIONS.forEach(q => {
            math.mathHintsFor(q).forEach(e => {
                assert.equal(e.ch, q.ch, `${q.id}: hint "${e.t}" is from chương ${e.ch}`);
            });
        });
    });

    test('the panel stays short — a hint, not the whole lesson', () => {
        MATH_QUESTIONS.forEach(q => {
            assert.truthy(math.mathHintsFor(q).length <= 4,
                `${q.id}: ${math.mathHintsFor(q).length} hints is a wall of text`);
        });
    });

    test('the góc-bẹt question offers exactly the two terms it leans on', () => {
        // The question the user reported: it needs "tia phân giác" AND "góc bẹt".
        const q = MATH_QUESTIONS.find(x => /tia phân giác của một góc bẹt/i.test(x.q));
        assert.truthy(q, 'the fixture question is gone');
        const names = math.mathHintsFor(q).map(e => e.t);
        assert.contains(names, 'Tia phân giác');
        assert.contains(names, 'Góc bẹt');
    });

    test('the topic label outranks a word that merely appears in the sentence', () => {
        // Topic is the bank's own label for what the question is about, so it
        // leads; text matches fill the rest of the list.
        const q = CH(3).find(x => x.topic === 'Tiên đề Euclid');
        assert.truthy(q, 'no Tiên đề Euclid question');
        assert.equal(math.mathHintsFor(q)[0].t, 'Tiên đề Euclid');
    });

    test('all 119 geometry questions have the manually approved primary hint', () => {
        // This table is intentionally independent from the matcher. It turns
        // the complete human review into a regression test instead of merely
        // checking that a panel happens to exist.
        const byTopic = {
            'Hai góc kề bù': 'Hai góc kề bù',
            'Hai góc đối đỉnh': 'Hai góc đối đỉnh',
            'Góc tạo bởi hai đường thẳng cắt nhau': 'Hai đường thẳng cắt nhau',
            'Tia phân giác': 'Tia phân giác',
            'Tia phân giác và góc kề bù': 'Tia phân giác',
            'Dấu hiệu nhận biết hai đường thẳng song song': 'Dấu hiệu nhận biết hai đường thẳng song song',
            'Tính chất hai đường thẳng song song': 'Tính chất hai đường thẳng song song',
            'Góc trong cùng phía': 'Hai góc trong cùng phía',
            'Góc so le trong': 'Hai góc so le trong',
            'Góc đồng vị': 'Hai góc đồng vị',
            'Quan hệ vuông góc và song song': 'Quan hệ vuông góc — song song',
            'Ký hiệu ∥ và ⊥': 'Hai đường thẳng song song (a ∥ b)',
            'Tiên đề Euclid': 'Tiên đề Euclid',
            'Định lí': 'Định lí · giả thiết · kết luận',
            'Tổng ba góc': 'Tổng ba góc trong một tam giác',
            'Tam giác vuông': 'Tam giác vuông',
            'Góc ngoài': 'Góc ngoài của tam giác',
            'Trường hợp c-c-c': 'Trường hợp cạnh – cạnh – cạnh (c-c-c)',
            'Trường hợp c-g-c': 'Trường hợp cạnh – góc – cạnh (c-g-c)',
            'Trường hợp g-c-g': 'Trường hợp góc – cạnh – góc (g-c-g)',
            'Tam giác bằng nhau': 'Hai tam giác bằng nhau',
            'Kí hiệu tam giác bằng nhau': 'Hai tam giác bằng nhau',
            'Tam giác vuông bằng nhau': 'Tam giác vuông bằng nhau',
            'Tam giác cân': 'Tam giác cân',
            'Tam giác đều': 'Tam giác đều',
            'Đường trung trực': 'Đường trung trực của đoạn thẳng'
        };
        const byId = {
            'm3-25': 'Dấu hiệu nhận biết hai đường thẳng song song',
            'm3-26': 'Tính chất hai đường thẳng song song',
            'm4-14': 'Vì sao không có trường hợp g-g-g',
            'm4-15': 'Trường hợp cạnh – góc – cạnh (c-g-c)',
            'm4-21': 'Vì sao không có trường hợp g-g-g',
            'm4-24': 'Trường hợp cạnh – góc – cạnh (c-g-c)',
            'm4-28': 'Trường hợp góc – cạnh – góc (g-c-g)',
            'm4-29': 'Vì sao không có trường hợp g-g-g'
        };
        const reviewed = MATH_QUESTIONS.filter(q => q.ch === 3 || q.ch === 4);
        assert.equal(reviewed.length, 119, 'bank changed — review new geometry hints before shipping');
        reviewed.forEach(q => {
            const expected = byId[q.id] || byTopic[q.topic];
            assert.truthy(expected, `${q.id}: topic "${q.topic}" has not been reviewed`);
            const hints = math.mathHintsFor(q);
            assert.equal(hints[0] && hints[0].t, expected,
                `${q.id}: answer "${q.answer}" received the wrong primary hint`);
        });
    });

    test('the reported g-g-g card agrees with its stored answer', () => {
        const q = MATH_QUESTIONS.find(x => x.id === 'm4-14');
        assert.equal(q.options[q.correct], q.answer);
        assert.equal(q.answer, 'góc – góc – góc (g-g-g)');
        assert.equal(math.mathHintsFor(q)[0].t, 'Vì sao không có trường hợp g-g-g');
    });

    test('non-included-angle traps never receive the unrelated g-g-g hint', () => {
        for (const id of ['m4-15', 'm4-24']) {
            const q = MATH_QUESTIONS.find(x => x.id === id);
            const names = math.mathHintsFor(q).map(e => e.t);
            assert.equal(names[0], 'Trường hợp cạnh – góc – cạnh (c-g-c)', id);
            assert.falsy(names.includes('Vì sao không có trường hợp g-g-g'), id);
        }
    });

    test('ordinary wording such as “kết luận nào” does not summon theorem theory', () => {
        for (const id of ['m3-19', 'm3-20', 'm3-30', 'm3-33', 'm3-36', 'm3-44']) {
            const names = math.mathHintsFor(MATH_QUESTIONS.find(x => x.id === id)).map(e => e.t);
            assert.falsy(names.includes('Định lí · giả thiết · kết luận'), id);
        }
        for (const id of ['m3-63', 'm3-65']) {
            const names = math.mathHintsFor(MATH_QUESTIONS.find(x => x.id === id)).map(e => e.t);
            assert.contains(names, 'Định lí · giả thiết · kết luận', id);
        }
    });
});

suite('math hints: the panel', () => {
    test('it renders closed, and names how many definitions are inside', () => {
        const q = MATH_QUESTIONS.find(x => /tia phân giác của một góc bẹt/i.test(x.q));
        const html = math.mathHintHTML(q);
        assert.truthy(html.includes('💡 Gợi ý'), 'no hint button');
        assert.truthy(html.includes('2 khái niệm liên quan'), 'the count should be on the button');
        assert.truthy(!html.includes('math-hint-body'), 'it must start closed');
        assert.truthy(!html.includes('180°'), 'a closed panel gives nothing away');
    });

    test('opening it shows each term with its definition', () => {
        const q = MATH_QUESTIONS.find(x => /tia phân giác của một góc bẹt/i.test(x.q));
        math.toggleMathHint();
        try {
            const html = math.mathHintHTML(q);
            assert.truthy(html.includes('math-hint-body'), 'the body should be open');
            assert.truthy(html.includes('Tia phân giác'), 'term missing');
            assert.truthy(html.includes('hai góc bằng nhau'), 'definition missing');
            assert.truthy(html.includes('Góc bẹt'), 'second term missing');
        } finally { math.toggleMathHint(); }
    });

    test('a chapter without a glossary renders no panel at all', () => {
        assert.equal(math.mathHintHTML(CH(1)[0]), '');
        assert.equal(math.mathHintHTML(null), '');
    });

    test('the question card carries the panel, and it closes between questions', () => {
        const src = fs.readFileSync(path.join(root, 'js', 'math.js'), 'utf8');
        // Tham số thứ hai là cờ "đang thi" — xem tests/math-figures.test.js.
        assert.truthy(/\$\{mathHintHTML\(q, !!st\.examId\)\}/.test(src),
            'the question card must render the panel, and tell it whether this is an exam');
        const next = src.slice(src.indexOf('function nextMathQuestion('), src.indexOf('function nextMathQuestion(') + 200);
        assert.truthy(/_mathHintOpen = false/.test(next),
            'left open, the hint stops being a hint and becomes theory above every answer');
        const start = src.slice(src.indexOf('function startMathQuiz('), src.indexOf('function startMathQuiz(') + 200);
        assert.truthy(/_mathHintOpen = false/.test(start), 'a fresh practice should start with the hint closed');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
