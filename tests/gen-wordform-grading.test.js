// gen-wordform-grading.test.js — characterization tests for the Word form tab's
// typed-answer grading (_wfTextCorrect / _wfNormalize) and the seeded wfShuffle.
//
// _wfTextCorrect is exported via module.exports from js/wordform.js, but
// wfShuffle and _wfNormalize are module-private, so those are pulled out with a
// trailing vm epilogue — same technique as tests/gen-exam-helpers.test.js.
const { suite, test, assert } = require('./harness');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require('../js/answer-audio.js'));
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const { WORDFORM_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'wordform-data.js'));
global.WORDFORM_QUESTIONS = WORDFORM_QUESTIONS;
const wf = require(path.join(__dirname, '..', 'js', 'wordform.js'));

function loadPrivateHelpers() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'wordform.js'), 'utf8');
    const sandbox = {
        document: { getElementById: () => null },
        window: {},
        console: console,
        setTimeout: () => 0,
        clearTimeout: () => {},
        Date: Date,
        Math: Math,
        JSON: JSON
    };
    sandbox.globalThis = sandbox;
    const epilogue = '\n;({ wfShuffle: wfShuffle, _wfNormalize: _wfNormalize });';
    return vm.runInNewContext(code + epilogue, sandbox, { filename: 'js/wordform.js' });
}
const { wfShuffle, _wfNormalize } = loadPrivateHelpers();

// Mirror of _wfNormalize for building test fixtures (kept in sync with source).
const norm = s => String(s || '').toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"'’`]/g, '').replace(/\s+/g, ' ').trim();
const acceptOf = q => ((q.accept && q.accept.length) ? q.accept : [q.answer]).map(norm);

const TEXT = WORDFORM_QUESTIONS.filter(q => q.type === 'text');
const MCQ = WORDFORM_QUESTIONS.filter(q => q.type === 'mcq');

// ── 30 sampled typed questions, spread across the whole text bank ──
// A fixed stride of 3 covered the first 90 of 100; once the bank grew to 300 it
// would have sampled the same opening third and never touched the rest.
const SAMPLES = Array.from({ length: 30 }, (_, k) => TEXT[Math.floor(k * TEXT.length / 30)]);

suite('gen: wordform typed grading — 30 sampled questions', () => {
    SAMPLES.forEach(q => {
        test(`${q.id} (${q.cat}, ${q.base}): grades "${q.answer}" strictly but forgives case/space/punctuation`, () => {
            // Exact model answer is accepted.
            assert.truthy(wf._wfTextCorrect(q.answer, q), 'exact answer must grade correct');
            // A prefixed or suffixed non-word is rejected (no substring matching).
            assert.falsy(wf._wfTextCorrect('X' + q.answer, q), 'prefixed junk must grade wrong');
            assert.falsy(wf._wfTextCorrect(q.answer + 'zz', q), 'suffixed junk must grade wrong');
            // Uppercase with surrounding whitespace still passes.
            assert.truthy(wf._wfTextCorrect('  ' + q.answer.toUpperCase() + '  ', q),
                'UPPERCASE + spaces must grade correct');
            // Punctuation wrapped around the answer is stripped before comparing.
            assert.truthy(wf._wfTextCorrect('"' + q.answer + '!."', q),
                'punctuation-wrapped answer must grade correct');
        });
    });
});

// ── Wrong-category forms: correct derivations of the SAME base word, taken
// from another question with a different grammatical category, must be
// rejected — the grader demands the form that fits THIS sentence slot. ──
const CROSS_PAIRS = [];
for (const t of TEXT) {
    if (CROSS_PAIRS.length >= 10) break;
    const m = MCQ.find(m => m.base === t.base && m.cat !== t.cat
        && norm(m.answer) !== norm(t.answer)
        && !acceptOf(t).includes(norm(m.answer)));
    if (m) CROSS_PAIRS.push({ t, m });
}

suite('gen: wordform typed grading rejects wrong-category forms', () => {
    CROSS_PAIRS.forEach(({ t, m }) => {
        test(`${t.id} (${t.cat} of ${t.base}) rejects the ${m.cat} form "${m.answer}" from ${m.id}`, () => {
            assert.falsy(wf._wfTextCorrect(m.answer, t),
                'a real word of the wrong category must grade wrong');
            // The case/space/punctuation forgiveness never rescues a wrong-category form.
            assert.falsy(wf._wfTextCorrect('  "' + m.answer.toUpperCase() + '!"  ', t),
                'normalization must not rescue a wrong-category form');
            // Sanity: the borrowed form really is a valid answer for ITS question.
            assert.truthy(wf._wfTextCorrect(m.answer, m));
        });
    });
});

suite('gen: wordform grading fixtures stay valid', () => {
    test('bank shape: 600 questions in two formats; all 30 samples and all 10 cross-pairs resolved', () => {
        // The SAMPLES stride (every 3rd of TEXT) and the CROSS_PAIRS builder both
        // emit data-driven tests; if the bank shrank they would silently emit
        // fewer/undefined cases. Pin the shapes so that failure is loud.
        assert.equal(TEXT.length + MCQ.length, 600);
        assert.truthy(TEXT.length >= 100 && MCQ.length >= 100, 'both formats stay well populated');
        assert.equal(SAMPLES.length, 30);
        assert.equal(new Set(SAMPLES.map(q => q.id)).size, 30, 'the stride samples 30 different questions');
        assert.falsy(SAMPLES.some(q => !q || q.type !== 'text'), 'every sample is a real text question');
        assert.equal(CROSS_PAIRS.length, 10, 'bank still yields 10 same-base/different-cat pairs');
    });

    test('fixture norm mirror matches the real _wfNormalize on every answer and accept', () => {
        // acceptOf/CROSS_PAIRS are built with the local `norm` mirror; if
        // _wfNormalize ever changes, this catches the drift.
        for (const q of WORDFORM_QUESTIONS) {
            assert.equal(norm(q.answer), _wfNormalize(q.answer), `${q.id}: answer norm in sync`);
            for (const a of (q.accept || [])) {
                assert.equal(norm(a), _wfNormalize(a), `${q.id}: accept "${a}" norm in sync`);
            }
        }
    });
});

suite('gen: wordform typed grading edge cases', () => {
    test('blank, whitespace-only, and punctuation-only input never grade correct', () => {
        const q = wf.wordformById('wft-1'); // answer: education
        assert.truthy(q && q.type === 'text');
        assert.falsy(wf._wfTextCorrect('', q));
        assert.falsy(wf._wfTextCorrect('   ', q));
        // '...!?' normalizes to '' → early-return false, not a match.
        assert.falsy(wf._wfTextCorrect('...!?', q));
        assert.falsy(wf._wfTextCorrect(null, q));
    });

    test('empty accept[] falls back to comparing against q.answer', () => {
        const synth = { answer: 'education', accept: [] };
        assert.truthy(wf._wfTextCorrect('Education ', synth));
        assert.falsy(wf._wfTextCorrect('educate', synth));
    });

    test('British -ise spellings are accepted wherever a second spelling is offered', () => {
        const multi = TEXT.filter(q => q.accept && q.accept.length > 1);
        assert.truthy(multi.length > 0, 'the -ise allowance still exists somewhere');
        for (const q of multi) {
            const brit = q.accept.find(a => norm(a) !== norm(q.answer));
            assert.truthy(brit, `${q.id}: has an alternate spelling`);
            assert.truthy(wf._wfTextCorrect(brit.toUpperCase(), q),
                `${q.id}: "${brit}" must grade correct`);
        }
    });

    test('normalization strips only .,!?;:quotes — hyphens and diacritics still mismatch', () => {
        const q = wf.wordformById('wft-1'); // answer: education
        assert.falsy(wf._wfTextCorrect('edu-cation', q), 'hyphen is NOT stripped');
        assert.falsy(wf._wfTextCorrect('éducation', q), 'diacritics are NOT folded');
        assert.equal(_wfNormalize('  "Hello,   WORLD!?"  '), 'hello world');
        assert.equal(_wfNormalize("it’s"), 'its', 'curly apostrophe is stripped');
        assert.equal(_wfNormalize('edu-cation'), 'edu-cation');
    });
});

suite('gen: wfShuffle seeded shuffle', () => {
    const BASE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    test('same seed → identical order every time (pinned for seed 42)', () => {
        assert.equal(typeof wfShuffle, 'function');
        const a = wfShuffle(BASE, 42);
        const b = wfShuffle(BASE, 42);
        assert.deepEqual(a, b);
        // Sequence changed deliberately in the LCG high-bit fix: `s % (i + 1)`
        // took the generator's low bits, which barely vary — one item was drawn
        // into 12.5% of samples against a fair 1.67%. Determinism (the property
        // this suite guards) is unchanged; only the order is new.
        assert.deepEqual(a, [1, 9, 0, 2, 3, 6, 8, 7, 4, 5]);
    });

    test('output is a permutation of the input (same items, same length)', () => {
        const out = wfShuffle(BASE, 7);
        assert.equal(out.length, BASE.length);
        assert.deepEqual(out.slice().sort((x, y) => x - y), BASE);
        for (const v of BASE) assert.contains(out, v);
    });

    test('does not mutate the input array', () => {
        const arr = ['a', 'b', 'c', 'd', 'e'];
        wfShuffle(arr, 99);
        assert.deepEqual(arr, ['a', 'b', 'c', 'd', 'e']);
    });

    test('different seeds usually differ: seeds 1..20 give 20 distinct orders', () => {
        const seen = new Set();
        for (let s = 1; s <= 20; s++) seen.add(JSON.stringify(wfShuffle(BASE, s)));
        assert.equal(seen.size, 20);
        // And an explicit pair: seed 7 !== seed 42.
        assert.truthy(JSON.stringify(wfShuffle(BASE, 7)) !== JSON.stringify(wfShuffle(BASE, 42)));
    });

    test('seed 0 and omitted seed both fall back to seed 1 (s = seed || 1)', () => {
        const one = wfShuffle(BASE, 1);
        assert.deepEqual(wfShuffle(BASE, 0), one);
        assert.deepEqual(wfShuffle(BASE), one);
    });

    test('degenerate inputs: empty stays empty, single element stays put', () => {
        assert.deepEqual(wfShuffle([], 5), []);
        assert.deepEqual(wfShuffle(['only'], 5), ['only']);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
