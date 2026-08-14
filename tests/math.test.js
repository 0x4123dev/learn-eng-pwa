// math.test.js — the Toán 7 formula tab.
//
// The whole tab is "which of these four formulas is the real one?", so the
// data has to be right in ways a reader would not notice by skimming: the
// answer must actually BE one of the options, the correct letter must not
// settle on B, and the maths must survive being put through innerHTML — the
// Vietnamese says "khi a < 0", and one stray "<" eats the rest of a sentence.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
const PER_CHAPTER = 50;
// Two kinds of question now share the bank. A "calc" question has no options —
// the child computes and types the answer on the in-app keypad — so every
// assertion about options has to be scoped to the multiple-choice half.
const MCQ = MATH_QUESTIONS.filter(q => q.type !== 'calc');
const TYPED = MATH_QUESTIONS.filter(q => q.type === 'calc');

// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
const math = require(path.join(root, 'js', 'math.js'));

suite('math: the question bank', () => {
    test('five chapters, fifty formula questions each', () => {
        assert.equal(MATH_CHAPTERS.length, 5);
        assert.equal(MCQ.length, 5 * PER_CHAPTER);
        for (const c of MATH_CHAPTERS) {
            assert.equal(MCQ.filter(q => q.ch === c.num).length, PER_CHAPTER,
                `chapter ${c.num} does not have ${PER_CHAPTER} questions`);
            assert.truthy(c.title && c.icon, `chapter ${c.num} missing title/icon`);
        }
    });

    test('ids are unique and follow m<chapter>-<n>', () => {
        const ids = MATH_QUESTIONS.map(q => q.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate question ids');
        const bad = MATH_QUESTIONS.filter(q => !new RegExp(`^m${q.ch}-c?\\d+$`).test(q.id));
        assert.deepEqual(bad.map(q => q.id), []);
    });

    test('every question offers four distinct options', () => {
        const bad = MCQ.filter(q =>
            !Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4);
        assert.deepEqual(bad.map(q => q.id), [], 'these need four distinct options');
    });

    test('the stated answer is the option it points at', () => {
        // The failure this catches is invisible on screen: the explanation
        // praises one formula while the marked-correct button is another.
        const bad = MCQ.filter(q => q.options[q.correct] !== q.answer);
        assert.deepEqual(bad.map(q => q.id), [], 'answer does not equal options[correct]');
    });

    test('the correct letter is spread across A B C D', () => {
        for (const c of MATH_CHAPTERS) {
            const spread = [0, 0, 0, 0];
            MCQ.filter(q => q.ch === c.num).forEach(q => spread[q.correct]++);
            spread.forEach((n, i) => {
                assert.truthy(n >= 8 && n <= 17,
                    `chapter ${c.num}: answer ${'ABCD'[i]} used ${n}/50 times — a child spots a pattern`);
            });
        }
    });

    test('every question explains itself, keyed by 🔑', () => {
        const bad = MATH_QUESTIONS.filter(q => !q.q || !q.explanation || !/🔑/.test(q.explanation));
        assert.deepEqual(bad.map(q => q.id), []);
    });

    test('explanations carry only <br> and <b> markup', () => {
        // They are rendered with innerHTML. Anything else here is either a
        // broken sentence or an injection risk.
        const bad = [];
        for (const q of MATH_QUESTIONS) {
            for (const m of q.explanation.match(/<[^>]*>/g) || []) {
                if (!/^<\/?(?:br|b)\s*\/?>$/i.test(m)) bad.push(`${q.id}: ${m}`);
            }
        }
        assert.deepEqual(bad.slice(0, 8), []);
    });

    test('no maths is written as LaTeX — the app has no renderer for it', () => {
        const bad = MATH_QUESTIONS.filter(q =>
            /\\frac|\\sqrt|\\times|\$\$?[^$]/.test(q.q + (q.options || []).join(' ') + q.explanation));
        assert.deepEqual(bad.map(q => q.id), []);
    });

    test('no question sends the reader to a diagram that does not exist', () => {
        // The source is a poster with figures; the app shows none of them.
        const bad = MATH_QUESTIONS.filter(q => /hình vẽ|hình bên|theo hình|xem hình/i.test(q.q));
        assert.deepEqual(bad.map(q => q.id), []);
    });
});

suite('math: the lessons', () => {
    test('one lesson per chapter, each pointing back at its chapter', () => {
        assert.equal(MATH_LESSONS.length, 5);
        for (const c of MATH_CHAPTERS) {
            const l = MATH_LESSONS.find(x => x.chapter === c.num);
            assert.truthy(l, `chapter ${c.num} has no lesson`);
            assert.truthy(l.content.length > 300, `lesson ${l.key} is too thin to revise from`);
            assert.truthy(/📌/.test(l.content), `lesson ${l.key} has no formula section`);
        }
    });

    test('lesson markup is real HTML, not escaped into visible text', () => {
        // The Lý thuyết tab shipped showing literal "<p>Chương I mở ra…" on
        // screen: the build step escaped every "<" that was not <br> or <b>,
        // which is right for explanations and wrong for lessons, where <p>,
        // <h4>, <ul> and <table> ARE the structure. The tag-allowlist test
        // below passed vacuously, because escaping leaves no tags to check.
        for (const l of MATH_LESSONS) {
            assert.truthy(/<p>/.test(l.content), `${l.key}: no real <p> — the HTML was escaped`);
            assert.truthy(/<h4>/.test(l.content), `${l.key}: no real <h4>`);
            assert.falsy(/&lt;(?:p|h4|ul|li|table|tr|td)&gt;/.test(l.content),
                `${l.key}: structural tags are escaped and will render as text`);
        }
    });

    test('lesson markup stays within the tags the card can render', () => {
        const allowed = /^<\/?(?:p|h4|ul|ol|li|b|i|br|table|tr|td|th|tbody|thead|strong|em)\s*\/?>$/i;
        const bad = [];
        for (const l of MATH_LESSONS) {
            for (const m of l.content.match(/<[^>]*>/g) || []) {
                if (!allowed.test(m)) bad.push(`${l.key}: ${m}`);
            }
        }
        assert.deepEqual(bad.slice(0, 8), []);
    });
});

// Turn "<sup>-5</sup>" content back into the Unicode the data holds, so a
// rendered question can be compared against the bank it came from.
const SUP_BACK = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
    '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻', '=': '⁼',
    '(': '⁽', ')': '⁾', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
    'k': 'ᵏ', 'm': 'ᵐ', 'n': 'ⁿ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
    'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ' };
function supToUnicode(s) {
    return Array.from(s).map(ch => SUP_BACK[ch] || ch).join('');
}

suite('math: the practice flow', () => {
    // Enough DOM for the screen to render into, so the quiz can be driven for
    // real rather than merely constructed.
    const screen = { innerHTML: '', scrollTop: 0 };

    test('a chapter round draws ten questions, all from that chapter', () => {
        // Installed here, not at suite level: other test files replace
        // global.document when they load, which happens after this runs.
        // Restored afterwards — tests elsewhere assert their code survives
        // having NO document, and a leaked stub makes those pass falsely.
        const hadDocument = Object.prototype.hasOwnProperty.call(global, 'document');
        const prevDocument = global.document;
        global.document = { getElementById: (id) => (id === 'mathHubScreen' ? screen : null) };
        try {
        math.startMathQuiz(2);
        assert.truthy(math.isMathQuizActive(), 'quiz did not start');
        assert.truthy(/1\/10/.test(screen.innerHTML), `progress should read 1/10 — got ${screen.innerHTML.slice(0, 80)}`);

        // Walk the whole round: every question shown must belong to chapter 2.
        const ch2 = new Set(math.mathChapterQuestions(2).map(q => q.q));
        let seen = 0;
        for (let i = 0; i < 10; i++) {
            // The question now contains <sup> tags, so read to the closing
            // </div> and strip markup rather than stopping at the first "<".
            const shown = /class="grammar-question-text">([\s\S]*?)<\/div>/.exec(screen.innerHTML);
            assert.truthy(shown, 'no question rendered');
            const text = shown[1]
                .replace(/<sup>(.*?)<\/sup>/g, (_, inner) => supToUnicode(inner))
                .replace(/<[^>]*>/g, '')
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            assert.truthy(ch2.has(text), `question ${i + 1} is not from chapter 2: ${text.slice(0, 60)}`);
            seen++;
            math.answerMathQuestion(0);
            if (i < 9) math.nextMathQuestion();
        }
        assert.equal(seen, 10, 'a round must be exactly ten questions');
        math.abandonMathQuiz();
        } finally {
            if (hadDocument) global.document = prevDocument;
            else delete global.document;
        }
    });

    test('the mixed round can draw from all five chapters', () => {
        assert.equal(math.mathChapterQuestions(0).length, 5 * PER_CHAPTER + TYPED.length);
    });

    test('a round is ten questions, not the whole chapter', () => {
        assert.equal(math.MATH_QUIZ_SIZE, 10);
    });

    test('chapter labels read like the poster', () => {
        assert.equal(math.mathQuizLabel(0), 'Ôn tổng hợp');
        assert.truthy(/^Chương 1 · /.test(math.mathQuizLabel(1)));
    });

    test('superscripts become <sup>, which can be sized to be readable', () => {
        // Unicode superscript glyphs (x⁵) are drawn tiny by the font and there
        // is no way to enlarge them without enlarging the whole line — on a
        // phone the exponent was unreadable. Real <sup> scales with CSS.
        assert.equal(math.mathFormula('x⁵'), 'x<sup>5</sup>');
        assert.equal(math.mathFormula('x⁻⁵'), 'x<sup>−5</sup>');
        assert.equal(math.mathFormula('xᵐ · xⁿ = xᵐ⁺ⁿ'), 'x<sup>m</sup> · x<sup>n</sup> = x<sup>m+n</sup>');
        assert.equal(math.mathFormula('(1/x)⁻⁵'), '(1/x)<sup>−5</sup>');
        // The radicand now carries its overline span too — see the radical test.
        assert.equal(math.mathFormula('√(a²) = |a|'),
            '√<span class="math-radicand">(a<sup>2</sup>)</span> = |a|');
    });

    test('formatting a formula still escapes the HTML around it', () => {
        // Same string may hold "a < 0"; turning ⁵ into a tag must not open the
        // door to the rest being treated as markup.
        assert.equal(math.mathFormula('khi a < 0'), 'khi a &lt; 0');
        assert.equal(math.mathFormula('<b>x²</b>'), '&lt;b&gt;x<sup>2</sup>&lt;/b&gt;');
    });

    test('a radical gets its overline, so √36 is not a tick beside a number', () => {
        // "√" alone is only the hook; the căn bậc hai is the hook PLUS the
        // vinculum over what is under it. Without the bar, √36 reads as a
        // tick mark next to 36, and √(a²) gives no clue where the radicand
        // ends. The bar is drawn with a border over a span.
        assert.equal(math.mathFormula('√36'), '√<span class="math-radicand">36</span>');
        assert.equal(math.mathFormula('√a'), '√<span class="math-radicand">a</span>');
        // Balanced parentheses, including nested ones.
        assert.equal(math.mathFormula('√((−10)²)'),
            '√<span class="math-radicand">((−10)<sup>2</sup>)</span>');
        assert.equal(math.mathFormula('√(a²) = |a|'),
            '√<span class="math-radicand">(a<sup>2</sup>)</span> = |a|');
        // A bare √ with nothing after it must not swallow the rest.
        assert.equal(math.mathFormula('dấu √ là căn'), 'dấu √ là căn');
    });

    test('radicals in explanations keep the surrounding markup intact', () => {
        assert.equal(math.mathRich('<b>√16</b> = 4'),
            '<b>√<span class="math-radicand">16</span></b> = 4');
        // The scan must not run across a tag boundary and eat the markup.
        assert.equal(math.mathRich('√<b>x</b>'), '√<b>x</b>');
    });

    test('explanations get readable exponents without losing their markup', () => {
        // Explanations arrive as trusted HTML (<br>, <b>) so they cannot be
        // escaped — but they are full of maths too, and the exponents were
        // just as unreadable there as in the options.
        assert.equal(math.mathRich('🔑 x⁻ⁿ = 1/xⁿ<br>✗ x⁵: sai.'),
            '🔑 x<sup>−n</sup> = 1/x<sup>n</sup><br>✗ x<sup>5</sup>: sai.');
        assert.equal(math.mathRich('<b>√(a²)</b> = |a|'),
            '<b>√<span class="math-radicand">(a<sup>2</sup>)</span></b> = |a|');
        // Already-escaped text must be left alone, not double-escaped.
        assert.equal(math.mathRich('khi a &lt; 0'), 'khi a &lt; 0');
    });

    test('the rendered options use the formula formatter', () => {
        assert.truthy(/mathFormula\(opt\)/.test(read('js/math.js')),
            'options must render through mathFormula or the exponents stay tiny');
    });

    test('escaping protects the "a < 0" text the maths is full of', () => {
        assert.equal(math.mathEsc('khi a < 0'), 'khi a &lt; 0');
        assert.equal(math.mathEsc('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
    });
});

suite('math: wiring', () => {
    test('index.html loads the data before math.js', () => {
        const html = read('index.html');
        for (const f of ['js/math-data.js', 'js/math-lessons.js', 'js/math.js']) {
            assert.truthy(html.includes(f), `index.html does not load ${f}`);
        }
        assert.truthy(html.indexOf('js/math-data.js') < html.indexOf('js/math.js'),
            'math.js must load after its data');
        assert.truthy(html.includes('id="mathHubScreen"'), 'the Math screen is missing');
    });

    test('every class math.js renders actually has styles', () => {
        // The Lý thuyết view shipped unreadable because it used
        // "grammar-lesson-card" and "grammar-lesson-body" — plausible names
        // that exist nowhere in the stylesheet, so the lesson rendered with no
        // card, no padding and no width. Nothing failed; it just looked broken.
        const css = read('css/styles.css');
        const src = read('js/math.js');
        const used = new Set();
        for (const m of src.matchAll(/class="([^"$]*)"/g)) {
            for (const cls of m[1].split(/\s+/)) if (cls) used.add(cls);
        }
        const missing = [...used].filter(c => !new RegExp('\\.' + c + '\\b').test(css)).sort();
        assert.deepEqual(missing, [], `these classes have no styles: ${missing.join(', ')}`);
    });

    test('the service worker precaches the math files', () => {
        const sw = read('sw.js');
        for (const f of ['/js/math-data.js', '/js/math-lessons.js', '/js/math.js']) {
            assert.truthy(sw.includes(f), `sw.js does not precache ${f}`);
        }
    });

    test('opening the Math tab renders it', () => {
        assert.truthy(/mathHubScreen'\s*&&\s*typeof renderMathHome/.test(read('js/app.js')),
            'switchScreen must render the math hub');
    });

    test('the tab owes back what it gets wrong, like the English tabs', () => {
        const src = read('js/math.js');
        assert.truthy(/defineRetryDrill\(/.test(src), 'math must register with the retry drill');
        assert.truthy(/retryAdd\('math'/.test(src), 'missed questions must be filed as debt');
        assert.truthy(/retryGate\('math'\)/.test(src), 'a new practice must be gated on the debt');
    });

    test('the retry drill re-asks a formula as multiple choice, not typing', () => {
        // The drill defaults to a text box, and for Word form that is the
        // point — a guessed word comes back as typing. A formula is different:
        // nobody types "xᵐ · xⁿ = xᵐ⁺ⁿ", and the skill being practised is
        // RECOGNISING the right one. The tab supplies its own MCQ input.
        const src = read('js/math.js');
        assert.truthy(/inputHTML:/.test(src), 'math must override the drill input');
        assert.truthy(/readAnswer:/.test(src), 'and read the choice back');
        const cfg = src.slice(src.indexOf('defineRetryDrill({'), src.indexOf('function mathRetryCount'));
        assert.truthy(/grammar-option/.test(cfg) || /mathRetryInputHTML/.test(cfg),
            'the drill input must render option buttons');
        assert.falsy(/retryInput|Gõ /.test(cfg), 'no text box in the maths drill');
    });

    test('leaving a question mid-quiz asks first', () => {
        // A mis-tap on the bottom bar should not silently bin the round.
        const app = read('js/app.js');
        assert.truthy(/isMathQuizActive/.test(app),
            'switchScreen must notice an in-progress maths round');
        const guard = app.slice(app.indexOf("screenId !== 'mathHubScreen'"),
                                app.indexOf("screenId !== 'mathHubScreen'") + 600);
        assert.truthy(/confirm\(/.test(guard), 'it must ask before leaving');
        assert.truthy(/abandonMathQuiz/.test(guard), 'and only then discard the round');
        assert.truthy(/retryDrillKey/.test(guard), 'the retry drill counts as in-progress too');
    });

    test('the Math tab has no listen gate — nothing here is pronounced', () => {
        const src = read('js/math.js');
        assert.falsy(/answerGateHTML|speakAnswer|speakWord/.test(src),
            'audio does not belong in a maths tab');
    });
});

// The typed half of the tab. A formula the child can only RECOGNISE is a
// formula they cannot use, so some questions ask them to compute and type the
// answer. The iOS keyboard cannot type √, exponents or a fraction bar, and it
// covers the question while it tries — so the tab draws its own keypad and
// never focuses an input at all.
suite('math: typed answers', () => {
    const POWER = {
        id: 'm1-51', ch: 1, topic: 'Lũy thừa của số hữu tỉ', type: 'calc',
        q: 'Viết gọn thành một lũy thừa: 2³ · 2⁴ = ?',
        answer: '2⁷', accept: [], keys: ['^'],
        explanation: '🔑 Nhân hai lũy thừa cùng cơ số thì CỘNG số mũ: 3 + 4 = 7.'
    };

    test('the keypad never renders anything the iOS keyboard can focus', () => {
        // This is the whole point of drawing our own pad. One <input> and the
        // system keyboard slides up over the question again.
        const html = math.mathKeypadHTML(POWER);
        assert.falsy(/<input|<textarea|contenteditable/i.test(html),
            'a focusable field would summon the very keyboard we are avoiding');
    });

    test('a question only offers the symbol keys it declares', () => {
        // A fractions question showing ∠ and ° is clutter a child has to read
        // past. The context row comes from the data, not from a fixed list.
        const html = math.mathKeypadHTML(POWER);
        assert.truthy(html.includes('^'), 'the power question needs its ^ key');
        assert.falsy(/√|°|%/.test(html), 'it declared none of these');
    });

    test('pressing ^ then a digit stores a real superscript', () => {
        // Stored as ⁷, not "^7": the same renderer draws the answer box and the
        // question above it, so what the child types looks like what is asked.
        math.mathTypedReset();
        ['2', '^', '7'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '2⁷');
    });

    test('pressing ^ again leaves superscript mode', () => {
        math.mathTypedReset();
        ['2', '^', '7', '^', '5'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '2⁷5');
    });

    test('backspace removes one visible glyph at a time', () => {
        math.mathTypedReset();
        ['2', '^', '7'].forEach(math.mathKeyPress);
        math.mathKeyPress('⌫');
        assert.equal(math.mathTypedRaw(), '2', 'the exponent goes first, whole');
        math.mathKeyPress('⌫');
        assert.equal(math.mathTypedRaw(), '');
    });

    test('backspace leaves superscript mode when it deletes the last exponent', () => {
        // Otherwise the next digit silently becomes an exponent of nothing.
        math.mathTypedReset();
        ['2', '^', '7'].forEach(math.mathKeyPress);
        math.mathKeyPress('⌫');
        math.mathKeyPress('5');
        assert.equal(math.mathTypedRaw(), '25');
    });

    test('grading accepts the answer typed as a superscript', () => {
        assert.truthy(math.mathGrade(POWER, '2⁷'));
    });

    test('grading rejects a plausible wrong answer', () => {
        assert.falsy(math.mathGrade(POWER, '2¹²'), '2³·2⁴ multiplies the exponents for nobody');
        assert.falsy(math.mathGrade(POWER, ''), 'an empty box is not an answer');
    });

    test('grading reads the Vietnamese decimal comma as a decimal point', () => {
        const q = { answer: '0.75', accept: [] };
        assert.truthy(math.mathGrade(q, '0,75'), 'the keypad types a comma, as school does');
    });

    test('grading treats equal numbers as equal however they are written', () => {
        const q = { answer: '0.75', accept: [] };
        assert.truthy(math.mathGrade(q, '.75'));
        assert.truthy(math.mathGrade(q, ' 0.750 '));
    });

    test('grading accepts the unicode minus the keypad prints', () => {
        const q = { answer: '-3/4', accept: [] };
        assert.truthy(math.mathGrade(q, '−3/4'), 'U+2212 is what a maths key should print');
    });

    test('grading does NOT quietly accept an unreduced fraction', () => {
        // Rút gọn is the Toán 7 skill being tested. Anything genuinely
        // acceptable is listed by the author in accept[], not guessed here.
        const q = { answer: '-3/4', accept: [] };
        assert.falsy(math.mathGrade(q, '-6/8'));
    });

    test('an author can widen what counts via accept[]', () => {
        const q = { answer: '-3/4', accept: ['-0.75'] };
        assert.truthy(math.mathGrade(q, '-0,75'));
    });

    test('mathIsCorrect marks MCQ by index and typed by string', () => {
        const mcq = { correct: 2, options: ['a', 'b', 'c', 'd'], answer: 'c' };
        assert.truthy(math.mathIsCorrect(mcq, 2));
        assert.falsy(math.mathIsCorrect(mcq, 0));
        assert.truthy(math.mathIsCorrect(POWER, '2⁷'));
        assert.falsy(math.mathIsCorrect(POWER, '2⁵'));
    });

    test('a typed question carries an answer but no options', () => {
        for (const q of TYPED) {
            assert.truthy(q.answer, `${q.id} has nothing to grade against`);
            assert.falsy(q.options, `${q.id} is typed — options would never be shown`);
            assert.truthy(Array.isArray(q.keys), `${q.id} must declare its keypad row`);
            assert.truthy(/🔑/.test(q.explanation || ''), `${q.id} must explain itself`);
        }
    });

    test('at least one typed question exists to try the keypad on', () => {
        assert.truthy(TYPED.length >= 1);
    });

    test('every round pulls in the typed questions', () => {
        // With a handful of typed questions in the bank, a random 10-of-51 draw
        // would show one about a fifth of the time. They are drawn on purpose.
        const ch1Typed = TYPED.filter(q => q.ch === 1);
        assert.truthy(ch1Typed.length, 'chapter 1 needs a typed question for this to mean anything');
        // startMathQuiz paints as it goes; a null-returning stub makes the
        // renderer bail early. Restored afterwards — petart.test.js asserts the
        // app survives with no DOM at all, and a leaked stub would hide that.
        const hadDocument = Object.prototype.hasOwnProperty.call(global, 'document');
        const prevDocument = global.document;
        global.document = { getElementById: () => null, querySelector: () => null };
        try {
            for (let i = 0; i < 20; i++) {
                math.startMathQuiz(1);
                const picked = math.mathQuizQuestions();
                assert.equal(picked.length, math.MATH_QUIZ_SIZE, 'a round is still ten questions');
                assert.equal(picked.filter(q => q.type === 'calc').length,
                    Math.min(ch1Typed.length, math.MATH_TYPED_PER_ROUND),
                    'the typed questions must be drawn deliberately, not by luck');
                math.abandonMathQuiz();
            }
        } finally {
            if (hadDocument) global.document = prevDocument;
            else delete global.document;
        }
    });

    test('the retry drill re-asks a typed question with the keypad, not the options', () => {
        const src = read('js/math.js');
        const fn = src.slice(src.indexOf('function mathRetryInputHTML'));
        assert.truthy(/mathKeypadHTML/.test(fn.slice(0, 700)),
            'a missed typed question must come back as typing');
    });

    test('every class the keypad renders has a rule in the stylesheet', () => {
        const css = read('css/styles.css');
        const html = math.mathKeypadHTML(POWER) + math.mathTypedBoxHTML();
        const classes = new Set();
        for (const m of html.match(/class="([^"]+)"/g) || []) {
            m.slice(7, -1).split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
        }
        const missing = [...classes].filter(c => !new RegExp('\\.' + c + '[\\s,{:.]').test(css));
        assert.deepEqual(missing, [], 'these classes are rendered but never styled');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
