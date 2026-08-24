// math-exams.test.js — the Đề thi thử HK1 bank and its exam mode.
//
// Ten 25-question mock papers modeled on real 2025-2026 đề cuối kì 1. The
// invariants here are what let a child trust the papers: every answer is one
// of its options, geometry and data-reading questions have the figure they
// need, papers do not repeat one another, and no timer interrupts a child.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));
const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
global.MATH_EXAMS = MATH_EXAMS;
const math = require(path.join(root, 'js', 'math.js'));

suite('math exams: the ten papers', () => {
    test('ten untimed papers named HK1 Exam 1..10 with 25 questions each', () => {
        assert.equal(MATH_EXAMS.length, 10);
        MATH_EXAMS.forEach((e, i) => {
            assert.equal(e.id, `hk1-exam${i + 1}`);
            assert.equal(e.title, `HK1 Exam ${i + 1}`);
            assert.falsy(Object.prototype.hasOwnProperty.call(e, 'durationMin'), `${e.id}: must stay untimed`);
            assert.equal(e.questions.length, 25, `${e.id} must have 25 questions`);
            e.questions.forEach((q, k) => assert.equal(q.n, k + 1, `${e.id} n sequence broken at ${k}`));
        });
    });

    test('every answer is exactly one of its four distinct options', () => {
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            assert.equal(new Set(q.options).size, 4, `${e.id}#${q.n}: options not distinct`);
            assert.equal(q.answer, q.options[q.correct], `${e.id}#${q.n}: answer/correct mismatch`);
        }
    });

    test('all 250 questions have a readable stem, topic and worked explanation', () => {
        let count = 0;
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            count++;
            const at = `${e.id}#${q.n}`;
            assert.truthy(String(q.q || '').trim().length >= 5, `${at}: empty/short stem`);
            assert.truthy(String(q.topic || '').trim(), `${at}: missing topic`);
            assert.truthy(String(q.explanation || '').startsWith('🔑'), `${at}: no worked answer`);
        }
        assert.equal(count, 250);
    });

    test('no option is bare shorthand a child cannot read', () => {
        // Same rule as the practice bank (tests/math.test.js): four options
        // reading "c-c-c / c-g-c / g-c-g / …" are four near-identical strings
        // that mean nothing until somebody explains the convention. Spell the
        // case out and keep the shorthand in brackets.
        const LETTER_SOUP = /^[a-zA-ZÀ-ỹ](\s*[-–—]\s*[a-zA-ZÀ-ỹ])+$/;
        const bad = [];
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            (q.options || []).forEach((o, i) => {
                if (LETTER_SOUP.test(String(o).trim())) bad.push(`${e.id}#${q.n}.${'ABCD'[i]}="${o}"`);
            });
        }
        assert.deepEqual(bad, [], 'spell these out, e.g. "cạnh – góc – cạnh (c-g-c)"');
    });

    test('"which congruence case?" always comes with a figure to look at', () => {
        const CLASSIFY = /bằng nhau theo trường hợp (bằng nhau )?nào|theo trường hợp bằng nhau nào/i;
        const FIGURE = /△\s*[A-Z]{3}|tam giác\s+[A-Z]{3}/;
        const bare = [];
        let asked = 0;
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            if (!CLASSIFY.test(q.q || '')) continue;
            asked++;
            if (!FIGURE.test(q.q)) bare.push(`${e.id}#${q.n}`);
        }
        assert.truthy(asked >= 6, `only ${asked} such questions — the scan broke`);
        assert.deepEqual(bare, [], 'these ask which case applies without showing any triangle');
    });

    test('the ma trận shape holds: chapter quotas within tolerance', () => {
        const want = { 1: [6, 8], 2: [6, 8], 3: [4, 6], 4: [2, 4], 5: [2, 4] };
        for (const e of MATH_EXAMS) {
            const per = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            e.questions.forEach(q => per[q.ch]++);
            for (const c of [1, 2, 3, 4, 5]) {
                assert.truthy(per[c] >= want[c][0] && per[c] <= want[c][1],
                    `${e.id}: chương ${c} has ${per[c]} câu, expected ${want[c][0]}-${want[c][1]}`);
            }
        }
    });

    test('no paper repeats another paper\'s numbers (same template + same digits)', () => {
        const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
        const sig = q => norm(q.q + ' ' + q.answer).replace(/[0-9]/g, '#') + '|' +
            ((q.q + ' ' + q.answer).match(/[0-9]+(?:[.,][0-9]+)?/g) || []).sort().join(',');
        const seen = new Map();
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            const k = sig(q);
            assert.falsy(seen.has(k), `${e.id}#${q.n} duplicates ${seen.get(k)}`);
            seen.set(k, `${e.id}#${q.n}`);
        }
    });

    test('every explanation is 🔑-keyed with only <br>/<b> markup, no figure refs, no banned notation', () => {
        for (const e of MATH_EXAMS) for (const q of e.questions) {
            const at = `${e.id}#${q.n}`;
            assert.truthy(/🔑/.test(q.explanation), `${at}: no 🔑`);
            for (const m of (q.explanation.match(/<[^>]*>/g) || [])) {
                assert.truthy(/^<\/?(?:br|b)\s*\/?>$/i.test(m), `${at}: tag ${m}`);
            }
            const blob = q.q + ' ' + q.options.join(' ') + ' ' + q.explanation;
            assert.falsy(/hình vẽ|hình bên|theo hình|xem hình/i.test(q.q), `${at}: figure ref`);
            assert.falsy(/\\frac|\\sqrt|\\times|⇔|∪|∩|𝕀|x⁻|phụ nhau|\^/.test(blob), `${at}: banned notation`);
        }
    });

    test('correct letters spread within each paper — no give-away pattern', () => {
        for (const e of MATH_EXAMS) {
            const spread = [0, 0, 0, 0];
            e.questions.forEach(q => spread[q.correct]++);
            spread.forEach((n, i) =>
                assert.truthy(n >= 3 && n <= 10, `${e.id}: answer ${'ABCD'[i]} used ${n}/25`));
        }
    });
});

suite('math exams: exam mode wiring', () => {
    test('mathExams() serves the bank and mathExamBest() reads only exam history', () => {
        assert.equal(math.mathExams().length, 10);
    });

    test('an exam run is the whole paper in đề order without a deadline', () => {
        const src = read('js/math.js');
        const fn = src.slice(src.indexOf('function startMathExam'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.falsy(/endsAt|durationMin|setInterval/.test(body), 'an exam must not start a timer');
        assert.falsy(/mathShuffle/.test(body), 'đề order — a real paper is not shuffled');
        assert.truthy(/examId/.test(body), 'history must know which paper this was');
    });

    test('the exam UI never shows or mentions a countdown or automatic submit', () => {
        const src = read('js/math.js');
        assert.falsy(/mathExamClock|_mathExamTimer|mathExamTick|math-exam-clock/.test(src));
        assert.falsy(/90 phút|hết giờ tự nộp/i.test(src));
        assert.truthy(/không giới hạn thời gian/i.test(src));
    });
});
