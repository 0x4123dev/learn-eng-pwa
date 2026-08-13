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

// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
const math = require(path.join(root, 'js', 'math.js'));

suite('math: the question bank', () => {
    test('five chapters, fifty formula questions each', () => {
        assert.equal(MATH_CHAPTERS.length, 5);
        assert.equal(MATH_QUESTIONS.length, 5 * PER_CHAPTER);
        for (const c of MATH_CHAPTERS) {
            assert.equal(MATH_QUESTIONS.filter(q => q.ch === c.num).length, PER_CHAPTER,
                `chapter ${c.num} does not have ${PER_CHAPTER} questions`);
            assert.truthy(c.title && c.icon, `chapter ${c.num} missing title/icon`);
        }
    });

    test('ids are unique and follow m<chapter>-<n>', () => {
        const ids = MATH_QUESTIONS.map(q => q.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate question ids');
        const bad = MATH_QUESTIONS.filter(q => !new RegExp(`^m${q.ch}-\\d+$`).test(q.id));
        assert.deepEqual(bad.map(q => q.id), []);
    });

    test('every question offers four distinct options', () => {
        const bad = MATH_QUESTIONS.filter(q =>
            !Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4);
        assert.deepEqual(bad.map(q => q.id), [], 'these need four distinct options');
    });

    test('the stated answer is the option it points at', () => {
        // The failure this catches is invisible on screen: the explanation
        // praises one formula while the marked-correct button is another.
        const bad = MATH_QUESTIONS.filter(q => q.options[q.correct] !== q.answer);
        assert.deepEqual(bad.map(q => q.id), [], 'answer does not equal options[correct]');
    });

    test('the correct letter is spread across A B C D', () => {
        for (const c of MATH_CHAPTERS) {
            const spread = [0, 0, 0, 0];
            MATH_QUESTIONS.filter(q => q.ch === c.num).forEach(q => spread[q.correct]++);
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
            /\\frac|\\sqrt|\\times|\$\$?[^$]/.test(q.q + q.options.join(' ') + q.explanation));
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
            const shown = /class="grammar-question-text">([^<]*)</.exec(screen.innerHTML);
            assert.truthy(shown, 'no question rendered');
            const text = shown[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
        assert.equal(math.mathChapterQuestions(0).length, 5 * PER_CHAPTER);
    });

    test('a round is ten questions, not the whole chapter', () => {
        assert.equal(math.MATH_QUIZ_SIZE, 10);
    });

    test('chapter labels read like the poster', () => {
        assert.equal(math.mathQuizLabel(0), 'Ôn tổng hợp');
        assert.truthy(/^Chương 1 · /.test(math.mathQuizLabel(1)));
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

    test('the Math tab has no listen gate — nothing here is pronounced', () => {
        const src = read('js/math.js');
        assert.falsy(/answerGateHTML|speakAnswer|speakWord/.test(src),
            'audio does not belong in a maths tab');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
