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

// Exact per-chapter sizes, pinned so a question can never vanish silently.
// The base 50 grew when real đề cuối kì 1 papers (2025-2026) were folded in —
// exams weight ch1/ch2 heavily, so the chapters are deliberately uneven.
// MCQ only — typed 'calc' questions live outside these pins.
const CHAPTER_COUNTS = { 1: 76, 2: 75, 3: 65, 4: 54, 5: 56 };
const TOTAL_MCQ = Object.values(CHAPTER_COUNTS).reduce((a, b) => a + b, 0);

suite('math: the question bank', () => {
    test('five chapters with their pinned question counts', () => {
        assert.equal(MATH_CHAPTERS.length, 5);
        assert.equal(MCQ.length, TOTAL_MCQ);
        for (const c of MATH_CHAPTERS) {
            assert.equal(MCQ.filter(q => q.ch === c.num).length, CHAPTER_COUNTS[c.num],
                `chapter ${c.num} does not have ${CHAPTER_COUNTS[c.num]} questions`);
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

    test('no option is bare shorthand a child cannot read', () => {
        // "c-c-c / c-g-c / g-c-g / g-g-g" put four near-identical strings on
        // screen that mean nothing until somebody explains the convention —
        // the child is left matching letter patterns instead of reading a
        // triangle. Spell the name out and keep the shorthand in brackets.
        // scripts/build-math-data.js refuses these at build time too.
        const LETTER_SOUP = /^[a-zA-ZÀ-ỹ](\s*[-–—]\s*[a-zA-ZÀ-ỹ])+$/;
        const bad = [];
        MCQ.forEach(q => (q.options || []).forEach((o, i) => {
            if (LETTER_SOUP.test(String(o).trim())) bad.push(`${q.id}.${'ABCD'[i]}="${o}"`);
        }));
        assert.deepEqual(bad, [], 'spell these out, e.g. "cạnh – góc – cạnh (c-g-c)"');
    });

    test('the congruence-case questions name the case in words', () => {
        // The four that used to be letter soup. Pinned by content rather than
        // by id so a rewrite that quietly drops the words fails here.
        ['m4-14', 'm4-16', 'm4-17', 'm4-28'].forEach(id => {
            const q = MATH_QUESTIONS.find(x => x.id === id);
            assert.truthy(q, `${id} is gone`);
            const spelled = q.options.filter(o => /cạnh|góc/.test(o) && /\(/.test(o));
            assert.truthy(spelled.length >= 3,
                `${id}: expected the cases written out, got ${JSON.stringify(q.options)}`);
        });
    });

    test('"which congruence case?" always comes with a figure to look at', () => {
        // Asked without one, the question stops being about triangles and
        // becomes "which label maps onto which other label" — answerable only
        // from memorised convention. scripts/build-math-data.js refuses these.
        const CLASSIFY = /bằng nhau theo trường hợp (bằng nhau )?nào|theo trường hợp bằng nhau nào/i;
        const FIGURE = /△\s*[A-Z]{3}|tam giác\s+[A-Z]{3}/;
        const asked = MATH_QUESTIONS.filter(q => CLASSIFY.test(q.q || ''));
        assert.truthy(asked.length >= 4, `only ${asked.length} such questions — the scan broke`);
        const bare = asked.filter(q => !FIGURE.test(q.q)).map(q => q.id);
        assert.deepEqual(bare, [], 'these ask which case applies without showing any triangle');
    });

    test('m4-28 asks about a triangle, not about naming conventions', () => {
        // It used to ask which general-triangle case the right-triangle case
        // "cạnh góc vuông – góc nhọn kề" corresponds to: a mapping between two
        // vocabularies, with no triangle to look at and nothing to work out.
        const q = MATH_QUESTIONS.find(x => x.id === 'm4-28');
        assert.truthy(/△[A-Z]{3}/.test(q.q), 'the question must put a real triangle in front of the child');
        assert.truthy(!/tương ứng với trường hợp nào/.test(q.q), 'the naming-mapping phrasing is back');
        assert.truthy(/🔑/.test(q.explanation) && /∠/.test(q.explanation),
            'the explanation should reason about the angles, not restate the convention');
    });

    test('the stated answer is the option it points at', () => {
        // The failure this catches is invisible on screen: the explanation
        // praises one formula while the marked-correct button is another.
        const bad = MCQ.filter(q => q.options[q.correct] !== q.answer);
        assert.deepEqual(bad.map(q => q.id), [], 'answer does not equal options[correct]');
    });

    test('the correct letter is spread across A B C D', () => {
        for (const c of MATH_CHAPTERS) {
            const qs = MCQ.filter(q => q.ch === c.num);
            const spread = [0, 0, 0, 0];
            qs.forEach(q => spread[q.correct]++);
            // Proportional, not absolute: chapters are no longer all the same
            // size. 16%..34% keeps the old 8..17-of-50 discipline.
            spread.forEach((n, i) => {
                assert.truthy(n >= Math.floor(qs.length * 0.16) && n <= Math.ceil(qs.length * 0.34),
                    `chapter ${c.num}: answer ${'ABCD'[i]} used ${n}/${qs.length} times — a child spots a pattern`);
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
        assert.equal(math.mathChapterQuestions(0).length, TOTAL_MCQ + TYPED.length);
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

    // The four things Toán 7 answers are actually made of. Each has to survive
    // the whole trip: a key exists → pressing it stores the right character →
    // mathFormula draws it the way the textbook does → grading accepts it.
    test('số mũ: x then ^ then n renders as a real exponent', () => {
        math.mathTypedReset();
        ['x', '^', 'n'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), 'xⁿ', 'letters must lift into the exponent too');
        assert.truthy(/<sup>n<\/sup>/.test(math.mathFormula(math.mathTypedRaw())));
    });

    test('căn: √ draws a bar over the radicand, not a lone tick', () => {
        math.mathTypedReset();
        ['√', '4', '9'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '√49');
        assert.truthy(/math-radicand">49</.test(math.mathFormula('√49')),
            'without the vinculum "√49" is a tick standing next to a number');
    });

    test('căn: the bar stops where the radicand stops', () => {
        // √49 + 2 must not draw the bar across the "+ 2".
        assert.truthy(/math-radicand">49<\/span>\s*\+/.test(math.mathFormula('√49 + 2')));
    });

    test('giá trị tuyệt đối: |a| can be typed and reads back whole', () => {
        math.mathTypedReset();
        ['|', 'a', '|'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '|a|');
        assert.truthy(math.mathGrade({ answer: '|a|', accept: [] }, '|a|'));
    });

    test('phân số: a fraction is typed with the / key', () => {
        math.mathTypedReset();
        ['3', '/', '4'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '3/4');
        assert.truthy(math.mathGrade({ answer: '3/4', accept: [] }, '3/4'));
    });

    test('phân số: a negative fraction survives the keypad minus', () => {
        math.mathTypedReset();
        ['−', '3', '/', '4'].forEach(math.mathKeyPress);
        assert.equal(math.mathTypedRaw(), '−3/4');
        assert.truthy(math.mathGrade({ answer: '-3/4', accept: [] }, math.mathTypedRaw()));
    });

    test('a question can put letters and symbols on the context row', () => {
        const q = { keys: ['√', '|', 'a'] };
        const html = math.mathKeypadHTML(q);
        for (const k of q.keys) {
            assert.truthy(html.indexOf(`mathKey('${k}')`) !== -1, `no key for ${k}`);
        }
    });

    test('a question can declare the variable letters its answer needs', () => {
        // √(a²) = |a| is unanswerable if the pad cannot type an "a".
        const build = read('scripts/build-math-data.js');
        const listed = /const CALC_KEYS = \[([^\]]+)\]/.exec(build)[1]
            .split(',').map(s => s.trim().replace(/^'|'$/g, ''));
        for (const k of ['a', 'x', 'n']) {
            assert.truthy(listed.indexOf(k) !== -1, `no "${k}" key — answers using it cannot be typed`);
        }
    });

    test('every symbol a question may declare is one the pad can actually store', () => {
        // The build script validates keys[] against its own list; if the two
        // drift, a question ships with a key that types nothing.
        const build = read('scripts/build-math-data.js');
        const listed = /const CALC_KEYS = \[([^\]]+)\]/.exec(build)[1]
            .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
        for (const k of listed) {
            math.mathTypedReset();
            math.mathKeyPress(k);
            if (k === '^') { assert.truthy(math.mathTypedSup(), '^ must switch to exponents'); continue; }
            assert.equal(math.mathTypedRaw(), k, `pressing ${k} stored something else`);
        }
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

suite('math: the Lịch sử tab', () => {
    // History moved out of the practice page into its own sub-tab. These run
    // against the real functions with a seeded appState; the global is
    // deleted again after each test so the rest of the process stays clean.
    const run = (label, score, total, extra) =>
        Object.assign({ date: '2026-08-14T03:00:00Z', chapter: 1, label, score, total }, extra || {});

    function withHistory(list, fn) {
        global.appState = { mathHistory: list };
        try { fn(); } finally { delete global.appState; }
    }

    test('history is its own sub-tab, no longer embedded in the practice page', () => {
        const src = read('js/math.js');
        assert.truthy(src.includes(`switchMathSubTab('history')`), 'no button routes to the history tab');
        assert.truthy(/_mathSubTab === 'history' \? renderMathHistoryHTML\(\)/.test(src),
            'the body chooser never shows the history page');
        assert.truthy(/'lessons' \|\| tab === 'exams' \|\| tab === 'history'/.test(src),
            'switchMathSubTab would bounce history back to practice');
        const practice = src.slice(src.indexOf('function renderMathPracticeHTML'),
            src.indexOf('function mathBestFor'));
        assert.falsy(practice.includes('renderMathHistoryHTML'),
            'practice page still embeds the old history block');
    });

    test('empty history gets an invitation, not a blank page', () => {
        withHistory([], () => {
            const html = math.renderMathHistoryHTML();
            assert.truthy(html.includes('Chưa có kết quả nào'), 'no friendly empty state');
            assert.truthy(html.includes(`switchMathSubTab('practice')`),
                'empty state must link back to practice');
        });
    });

    test('stats header answers how much, how well, best ever', () => {
        const stats = math.mathHistoryStats([run('A', 10, 10), run('B', 5, 10), run('C', 8, 10)]);
        assert.equal(stats.runs, 3);
        assert.equal(stats.avg, Math.round((100 + 50 + 80) / 3));
        assert.equal(stats.best, 100);
        assert.equal(math.mathHistoryStats([]), null, 'no runs → no stats block');
    });

    test('exam runs wear a badge; practice runs do not', () => {
        withHistory([run('HK1 Exam 1', 20, 25, { examId: 'hk1-exam1' }), run('Chương 1', 9, 10)], () => {
            const html = math.renderMathHistoryHTML();
            assert.equal((html.match(/math-hist-badge/g) || []).length, 1,
                'exactly the exam row carries the Đề thi badge');
            assert.truthy(html.includes('HK1 Exam 1'));
            assert.truthy(html.includes('Chương 1'));
        });
    });

    test('the type filter separates Luyện tập from Đề thi', () => {
        withHistory([run('exam', 20, 25, { examId: 'hk1-exam1' }), run('practice', 9, 10)], () => {
            global.document = { getElementById: () => null };
            try {
                math.setMathHistoryType('exam');
                assert.deepEqual(math.mathHistoryFiltered().map(h => h.label), ['exam']);
                math.setMathHistoryType('practice');
                assert.deepEqual(math.mathHistoryFiltered().map(h => h.label), ['practice']);
                math.setMathHistoryType('all');
                assert.equal(math.mathHistoryFiltered().length, 2);
            } finally {
                math.setMathHistoryType('all');
                delete global.document;
            }
        });
    });

    test('the tier filter still works and composes with the type filter', () => {
        withHistory([
            run('perfect exam', 25, 25, { examId: 'hk1-exam1' }),
            run('weak exam', 5, 25, { examId: 'hk1-exam2' }),
            run('perfect practice', 10, 10),
        ], () => {
            global.document = { getElementById: () => null };
            try {
                math.setMathHistoryFilter('perfect');
                assert.deepEqual(math.mathHistoryFiltered().map(h => h.label),
                    ['perfect exam', 'perfect practice']);
                math.setMathHistoryType('exam');
                assert.deepEqual(math.mathHistoryFiltered().map(h => h.label), ['perfect exam']);
            } finally {
                math.setMathHistoryFilter('all');
                math.setMathHistoryType('all');
                delete global.document;
            }
        });
    });

    test('every run row shows a tier-coloured progress bar sized to its score', () => {
        withHistory([run('Chương 2', 8, 10)], () => {
            const html = math.renderMathHistoryHTML();
            assert.truthy(html.includes('math-hist-fill tier-great'), '80% is the great tier');
            assert.truthy(html.includes('width:80%'), 'bar width must be the percentage');
        });
    });

    test('the list is capped at 40 rows, not the full 300-run store', () => {
        const many = Array.from({ length: 60 }, (_, i) => run('Run ' + i, 9, 10));
        withHistory(many, () => {
            const html = math.renderMathHistoryHTML();
            assert.equal((html.match(/math-hist-row/g) || []).length, 40);
        });
    });

    test('a label with markup in it is escaped, not rendered', () => {
        withHistory([run('<img src=x onerror=alert(1)>', 9, 10)], () => {
            assert.falsy(math.renderMathHistoryHTML().includes('<img'),
                'history labels reach innerHTML — they must be escaped');
        });
    });

    test('every class the history page renders has a rule in the stylesheet', () => {
        const css = read('css/styles.css');
        withHistory([run('exam', 20, 25, { examId: 'hk1-exam1' }), run('practice', 9, 10)], () => {
            const html = math.renderMathHistoryHTML();
            const classes = new Set();
            for (const m of html.match(/class="([^"]+)"/g) || []) {
                m.slice(7, -1).split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
            }
            const missing = [...classes].filter(c => !new RegExp('\\.' + c + '[\\s,{:.]').test(css));
            assert.deepEqual(missing, [], 'these classes are rendered but never styled');
        });
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
