// tapwords.test.js — tap-a-word: tokenizer, morphology fallback, and the
// dictionary coverage invariant (every student-visible bank word resolves).
const { suite, test, assert } = require('./harness');
const path = require('path');

const { WORD_VI } = require(path.join(__dirname, '..', 'js', 'dictionary-data.js'));
global.WORD_VI = WORD_VI;
const tw = require(path.join(__dirname, '..', 'js', 'tapwords.js'));

suite('tapwords: tokenizer', () => {
    test('wraps each English word in a tappable span', () => {
        const html = tw.tapwordsWrap('I like green tea.');
        assert.equal((html.match(/class="tw"/g) || []).length, 4);
        assert.truthy(html.includes('>green</span>'));
    });

    test('blanks, digits and punctuation stay untouched', () => {
        const html = tw.tapwordsWrap('She ___ to school at 7:30.');
        assert.truthy(html.includes('___'));
        assert.falsy(html.includes('<span class="tw">___'));
        assert.truthy(html.includes('7:30'));
    });

    test('Vietnamese words are never wrapped or split', () => {
        const html = tw.tapwordsWrap('chicken — thịt gà');
        assert.equal((html.match(/class="tw"/g) || []).length, 1);
        assert.truthy(html.includes('thịt gà'));
    });

    test('contractions wrap as one word; escaped entities stay intact', () => {
        const html = tw.tapwordsWrap("don't <b>cheat</b>");
        assert.truthy(html.includes(">don't</span>"));
        assert.truthy(html.includes('&lt;') && html.includes('&gt;'), 'entities preserved');
        assert.falsy(/&<span/.test(html), 'entity letters must never be wrapped');
    });

    test('stripping the spans reconstructs the original text', () => {
        const src = "The committee has been at odds over this matter.";
        const html = tw.tapwordsWrap(src);
        assert.equal(html.replace(/<[^>]+>/g, ''), src);
    });
});

suite('tapwords: lookup + morphology', () => {
    test('common words resolve with pos and vi', () => {
        const hit = tw.twLookup('school');
        assert.truthy(hit && hit.vi.length > 0, JSON.stringify(hit));
        assert.truthy(hit.pos.length >= 1);
    });

    test('inflection candidates include the base form', () => {
        assert.truthy(tw.twCandidates('campaigns').includes('campaign'));
        assert.truthy(tw.twCandidates('cancelled').includes('cancel'));
        assert.truthy(tw.twCandidates('running').includes('run'));
        assert.truthy(tw.twCandidates('studies').includes('study'));
        assert.truthy(tw.twCandidates('taught').includes('teach'));
    });

    test('lookup is case-insensitive and strips punctuation', () => {
        assert.truthy(tw.twLookup('School'));
        assert.truthy(tw.twLookup('school,'));
        assert.falsy(tw.twLookup(''));
        assert.falsy(tw.twLookup('xyzzyq'));
    });
});

suite('tapwords: dictionary integrity + coverage invariant', () => {
    test('every entry is [pos, vi] with a known pos and non-empty vi', () => {
        // Mirrors TW_POS_VI in js/tapwords.js — 'x' is a word-form distractor that is not an English word.
        const POS = new Set(['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'name', 'abbr', 'x']);
        let n = 0;
        for (const [w, e] of Object.entries(WORD_VI)) {
            n++;
            assert.truthy(Array.isArray(e) && e.length === 2, w);
            assert.truthy(POS.has(e[0]), `${w}: pos "${e[0]}"`);
            assert.truthy(typeof e[1] === 'string' && e[1].trim().length > 0 && e[1].length <= 120, `${w}: vi`);
        }
        assert.truthy(n >= 8000, `only ${n} entries`);
    });

    // The hard invariant: every student-visible English word in EVERY question
    // bank must resolve via twLookup. Adding questions with new vocabulary
    // fails this test until the dictionary is regenerated.
    test('every bank word resolves through the dictionary', () => {
        // `ipa` is a pronunciation, not text on screen to tap: its ASCII
        // letters ("mjun", "fild") are phonemes, and no dictionary has them.
        const SKIP = new Set(['explanation', 'vi', 'exVi', 'ipa', 'id', 'type', 'cat', 'topic', 'icon', 'emoji', 'n', 'correct', 'date', 'level', 'keyword', 'pos', 'section', 'book', 'unit']);
        const texts = [];
        function walk(v, key) {
            if (v == null) return;
            if (typeof v === 'string') { if (!SKIP.has(key)) texts.push(v); return; }
            if (Array.isArray(v)) { v.forEach(x => walk(x, key)); return; }
            if (typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, k); }
        }
        const root = f => { const m = require(path.join(__dirname, '..', 'js', f)); Object.values(m).forEach(v => walk(v, 'root')); };
        ['word-data.js'].forEach(root);

        const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
        const words = new Set(['a', 'i']);
        for (const t of texts) {
            if (VN.test(t)) continue;
            for (const m of (t.match(/[a-zA-Z]+(?:'[a-z]+)?/g) || [])) {
                const w = m.toLowerCase().replace(/'.*$/, '');
                if (w.length >= 2 && w.length <= 18) words.add(w);
            }
        }
        const missing = [];
        for (const w of words) if (!tw.twLookup(w)) missing.push(w);
        assert.equal(missing.length, 0,
            `${missing.length} bank words missing from dictionary: ${missing.slice(0, 15).join(', ')}…`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
