// gen-exam-helpers.test.js — characterization tests for the pure helpers in
// js/exam.js: _fmtClock, _normalizeAnswer, _textIsCorrect, escExam.
// The main harness (setup.js) doesn't load exam.js, so we evaluate it directly
// in an isolated vm context with stub globals and pull the helpers out with a
// trailing epilogue (same technique as tests/exam.test.js).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExamHelpers() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam.js'), 'utf8');
    const localStorageStub = (() => {
        const store = {};
        return {
            getItem: (k) => store[k] !== undefined ? store[k] : null,
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; },
            clear: () => { for (const k of Object.keys(store)) delete store[k]; }
        };
    })();
    const sandbox = {
        localStorage: localStorageStub,
        document: {
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        window: {},
        console: console,
        setInterval: () => 0,
        clearInterval: () => {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        Date: Date,
        Math: Math,
        JSON: JSON,
        // exam-data.js / exam-lessons.js globals referenced by exam.js
        EXAMS: [],
        getExam: () => null,
        EXAM1_LESSONS: [],
        // app-level globals referenced from exam.js flows (not exercised here)
        showToast: () => {},
        awardCoins: () => {},
        appState: null
    };
    sandbox.globalThis = sandbox;
    const epilogue = '\n;({ _fmtClock: _fmtClock, _normalizeAnswer: _normalizeAnswer, ' +
        '_textIsCorrect: _textIsCorrect, escExam: escExam });';
    return vm.runInNewContext(code + epilogue, sandbox, { filename: 'js/exam.js' });
}

const H = loadExamHelpers();
const { _fmtClock, _normalizeAnswer, _textIsCorrect, escExam } = H;

suite('gen: exam helpers load', () => {
    test('all four pure helpers are extracted as functions', () => {
        assert.equal(typeof _fmtClock, 'function');
        assert.equal(typeof _normalizeAnswer, 'function');
        assert.equal(typeof _textIsCorrect, 'function');
        assert.equal(typeof escExam, 'function');
    });
});

suite('gen: exam _fmtClock', () => {
    test('0 seconds formats as 0:00', () => {
        assert.equal(_fmtClock(0), '0:00');
    });

    test('59 seconds stays under a minute: 0:59', () => {
        assert.equal(_fmtClock(59), '0:59');
    });

    test('60 seconds rolls over to 1:00', () => {
        assert.equal(_fmtClock(60), '1:00');
    });

    test('61 seconds is 1:01', () => {
        assert.equal(_fmtClock(61), '1:01');
    });

    test('3599 seconds is 59:59', () => {
        assert.equal(_fmtClock(3599), '59:59');
    });

    test('minutes run past 59 with no hour unit (3600 → 60:00, 5400 → 90:00)', () => {
        assert.equal(_fmtClock(3600), '60:00');
        assert.equal(_fmtClock(5400), '90:00');
    });

    test('negative input is clamped to 0:00', () => {
        assert.equal(_fmtClock(-5), '0:00');
        assert.equal(_fmtClock(-3600), '0:00');
    });

    test('fractional seconds are rounded, not truncated (59.6 → 1:00, 59.4 → 0:59)', () => {
        assert.equal(_fmtClock(59.6), '1:00');
        assert.equal(_fmtClock(59.4), '0:59');
    });

    test('seconds field is always zero-padded to two digits', () => {
        assert.equal(_fmtClock(65), '1:05');
        assert.equal(_fmtClock(9), '0:09');
        assert.equal(_fmtClock(600), '10:00');
    });

    test('input is not type-guarded: NaN/undefined give "NaN:NaN", numeric strings coerce', () => {
        // Math.max(0, Math.round(NaN)) is NaN, so both fields degrade to NaN.
        assert.equal(_fmtClock(NaN), 'NaN:NaN');
        assert.equal(_fmtClock(undefined), 'NaN:NaN');
        // Math.round coerces a numeric string, so '90' behaves like 90 seconds.
        assert.equal(_fmtClock('90'), '1:30');
    });
});

suite('gen: exam _normalizeAnswer', () => {
    test('lowercases the input', () => {
        assert.equal(_normalizeAnswer('HELLO World'), 'hello world');
    });

    test('strips a leading arrow marker, with or without a following space', () => {
        assert.equal(_normalizeAnswer('→ he is tall'), 'he is tall');
        assert.equal(_normalizeAnswer('→he is tall'), 'he is tall');
    });

    test('arrow after leading whitespace is NOT stripped (regex is ^-anchored)', () => {
        assert.equal(_normalizeAnswer(' → he is tall'), '→ he is tall');
    });

    test('a mid-string arrow is preserved, and ASCII "->" is never stripped', () => {
        assert.equal(_normalizeAnswer('go → went'), 'go → went');
        // Only the unicode arrow U+2192 is in the strip regex; '-' and '>' are
        // not punctuation either, so an ASCII arrow survives entirely.
        assert.equal(_normalizeAnswer('-> he is tall'), '-> he is tall');
    });

    test('removes sentence punctuation . , ! ? ; :', () => {
        assert.equal(_normalizeAnswer('Yes, he does.'), 'yes he does');
        assert.equal(_normalizeAnswer('really?! well; then:'), 'really well then');
    });

    test('removes straight double quotes, apostrophes and backticks', () => {
        assert.equal(_normalizeAnswer('she said "hi"'), 'she said hi');
        assert.equal(_normalizeAnswer("don't `go`"), 'dont go');
    });

    test('removes the curly right single quote ’', () => {
        assert.equal(_normalizeAnswer('don’t'), 'dont');
    });

    test('curly double quotes “ ” are NOT in the strip list and survive', () => {
        assert.equal(_normalizeAnswer('“hi”'), '“hi”');
    });

    test('collapses runs of spaces to a single space', () => {
        assert.equal(_normalizeAnswer('he   is    tall'), 'he is tall');
    });

    test('collapses tabs and newlines like spaces (\\s+)', () => {
        assert.equal(_normalizeAnswer('he\tis\ntall'), 'he is tall');
    });

    test('trims surrounding whitespace', () => {
        assert.equal(_normalizeAnswer('   he is tall   '), 'he is tall');
    });

    test('null, undefined, false and "" all normalize to the empty string', () => {
        assert.equal(_normalizeAnswer(null), '');
        assert.equal(_normalizeAnswer(undefined), '');
        assert.equal(_normalizeAnswer(false), '');
        assert.equal(_normalizeAnswer(''), '');
    });

    test('the number 0 normalizes to "" (falsy short-circuit) but other numbers stringify', () => {
        assert.equal(_normalizeAnswer(0), '');
        assert.equal(_normalizeAnswer(5), '5');
        assert.equal(_normalizeAnswer(42), '42');
    });

    test('hyphens are preserved (not treated as punctuation)', () => {
        assert.equal(_normalizeAnswer('well-known'), 'well-known');
    });

    test('Vietnamese diacritics survive (lowercased, not stripped)', () => {
        assert.equal(_normalizeAnswer('Tiếng VIỆT!'), 'tiếng việt');
    });

    test('kitchen sink: arrow + case + punctuation + curly quote + spacing', () => {
        assert.equal(_normalizeAnswer('→  He said, "Don’t   GO!"  '), 'he said dont go');
    });
});

suite('gen: exam _textIsCorrect', () => {
    const q = {
        n: 1, type: 'text', section: 'Writing',
        q: 'He ___ tall.', answer: 'He is tall',
        accept: ['He is tall', "he's tall", '→ he is tall.']
    };

    test('exact accepted answer returns strict boolean true', () => {
        assert.equal(_textIsCorrect('He is tall', q), true);
    });

    test('matching is case-insensitive', () => {
        assert.truthy(_textIsCorrect('HE IS TALL', q));
    });

    test('trailing punctuation is ignored', () => {
        assert.truthy(_textIsCorrect('he is tall.', q));
    });

    test('extra internal/surrounding whitespace is ignored', () => {
        assert.truthy(_textIsCorrect('  he   is  tall ', q));
    });

    test('apostrophe variants match ("hes tall" hits accept "he\'s tall")', () => {
        assert.truthy(_textIsCorrect('hes tall', q));
        assert.truthy(_textIsCorrect("He's tall", q));
    });

    test('accept entries are normalized too (arrow+period entry matches plain input)', () => {
        // accept[2] is '→ he is tall.' which normalizes to 'he is tall'
        assert.truthy(_textIsCorrect('he is tall', { accept: ['→ he is tall.'] }));
    });

    test('a leading arrow in the user input is stripped before matching', () => {
        assert.truthy(_textIsCorrect('→ he is tall', q));
    });

    test('blank, whitespace-only, null and undefined input are never correct', () => {
        assert.falsy(_textIsCorrect('', q));
        assert.falsy(_textIsCorrect('   ', q));
        assert.falsy(_textIsCorrect(null, q));
        assert.falsy(_textIsCorrect(undefined, q));
    });

    test('blank input stays false even when accept[] contains ""', () => {
        assert.falsy(_textIsCorrect('', { accept: [''] }));
        assert.falsy(_textIsCorrect('   ', { accept: [''] }));
    });

    test('punctuation-only input normalizes to "" and is rejected even vs an identical accept entry', () => {
        assert.equal(_normalizeAnswer('?!.,'), '');
        // Both sides normalize to '', but the blank-input guard fires first.
        assert.equal(_textIsCorrect('?!.', { accept: ['?!.'] }), false);
    });

    test('a wrong answer returns strict boolean false', () => {
        assert.equal(_textIsCorrect('she is tall', q), false);
    });

    test('a partial answer is rejected (no substring matching)', () => {
        assert.falsy(_textIsCorrect('he is', q));
    });

    test('matching runs against accept[] only — q.answer alone never matches', () => {
        // Same question but with an accept list that omits the canonical answer.
        const qNoSelf = { answer: 'He is tall', accept: ["he's tall"] };
        assert.falsy(_textIsCorrect('he is tall', qNoSelf));
    });

    test('a question with a missing or empty accept[] is always incorrect', () => {
        assert.falsy(_textIsCorrect('anything', { answer: 'anything' }));
        assert.falsy(_textIsCorrect('anything', { answer: 'anything', accept: [] }));
    });

    test('numeric user input is stringified and can match', () => {
        assert.truthy(_textIsCorrect(5, { accept: ['5'] }));
    });
});

suite('gen: exam escExam', () => {
    test('escapes each of the four handled chars: & < > "', () => {
        assert.equal(escExam('fish & chips'), 'fish &amp; chips');
        assert.equal(escExam('a < b'), 'a &lt; b');
        assert.equal(escExam('a > b'), 'a &gt; b');
        assert.equal(escExam('say "hi"'), 'say &quot;hi&quot;');
    });

    test('single quote is NOT escaped (only 4 chars handled, no &#39;)', () => {
        assert.equal(escExam("it's"), "it's");
    });

    test('all handled specials together, in HTML-attack order', () => {
        assert.equal(
            escExam('<a href="x">&</a>'),
            '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
        );
    });

    test('replaces every occurrence, not just the first', () => {
        assert.equal(escExam('a && b << c'), 'a &amp;&amp; b &lt;&lt; c');
    });

    test('already-escaped text is double-escaped (& first in the chain)', () => {
        assert.equal(escExam('&amp;'), '&amp;amp;');
        assert.equal(escExam('&lt;'), '&amp;lt;');
    });

    test('null and undefined render as the empty string', () => {
        assert.equal(escExam(null), '');
        assert.equal(escExam(undefined), '');
    });

    test('non-null falsy values stringify (== null guard, not || \'\'): 0 → "0", false → "false"', () => {
        assert.equal(escExam(42), '42');
        assert.equal(escExam(0), '0');
        assert.equal(escExam(false), 'false');
        assert.equal(escExam(true), 'true');
    });

    test('a plain safe string passes through unchanged (incl. Vietnamese + em dash)', () => {
        assert.equal(escExam('Exam 2026 — Practice'), 'Exam 2026 — Practice');
        assert.equal(escExam('Tiếng Việt — lớp 6'), 'Tiếng Việt — lớp 6');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
