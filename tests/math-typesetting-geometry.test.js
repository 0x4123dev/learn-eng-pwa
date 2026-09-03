// tests/math-typesetting-geometry.test.js — where a stacked fraction SITS on the line.
//
// `.math-frac` is an `inline-grid`, and an inline-grid's baseline is the
// baseline of its FIRST ROW — the numerator. The rule used to say
// `vertical-align: -.55em`, a magic constant, so what got anchored to the
// surrounding text was the numerator, never the fraction bar.
//
// Measured in a real browser against this stylesheet: the bar landed 0.913em
// BELOW the text baseline when it should sit ~0.25em ABOVE it — the maths
// axis, the ink centre of the "=" glyph. That is ~1.17em too low, so every
// one of the 3,148 stacked fractions in the maths data visibly hung below its
// own line. Wrong in all 8 rendering contexts measured, and worse the taller
// the content got: a nested fraction was 2.77em out.
//
// The fix in css/styles.css is `vertical-align: middle` plus
// `grid-template-rows: 1fr 1fr`. `middle` aligns the box midpoint with
// baseline + half the parent's x-height, so it re-derives itself at whatever
// font-size the context uses instead of being tuned per screen; `1fr 1fr`
// forces the two halves to equal height so that midpoint always IS the bar,
// whatever the numerator holds. A hardcoded `em` offset cannot be correct in
// more than one context — that is exactly how this regressed once, and that
// is what this file guards.
//
// The harness is synchronous; every test here is a plain sync function.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = require(path.join(root, 'js', 'math-data.js')).MATH_CHAPTERS;
global.MATH_QUESTIONS = require(path.join(root, 'js', 'math-data.js')).MATH_QUESTIONS;
global.MATH_LESSONS = require(path.join(root, 'js', 'math-lessons.js')).MATH_LESSONS;
const math = require(path.join(root, 'js', 'math.js'));

// ---------------------------------------------------------------------------
// Reading a rule out of css/styles.css.
//
// Substring searching is not good enough here: the whole point of the test is
// to pin the BASE `.math-frac` rule and not be fooled by `.math-mixed
// .math-frac`, `.math-radicand .math-frac`, `.grammar-question-text
// .math-frac` or the `@media (max-width: 420px)` override — each of which
// contains the literal text ".math-frac {". So: drop comments, drop every
// @media block, then match selectors exactly.
// ---------------------------------------------------------------------------

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Remove `@media … { … }` wholesale, brace-counting so nested rules go with it.
function stripAtMedia(css) {
    let out = '';
    for (let i = 0; i < css.length;) {
        if (css.startsWith('@media', i)) {
            const open = css.indexOf('{', i);
            if (open === -1) { out += css.slice(i); break; }
            let depth = 1, j = open + 1;
            for (; j < css.length && depth > 0; j++) {
                if (css[j] === '{') depth++;
                else if (css[j] === '}') depth--;
            }
            i = j;
        } else {
            out += css[i];
            i++;
        }
    }
    return out;
}

const TOP_LEVEL_CSS = stripAtMedia(stripComments(read('css/styles.css')));

// Every declaration body whose selector list contains `selector` verbatim.
function ruleBodies(selector) {
    const bodies = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(TOP_LEVEL_CSS))) {
        const selectors = m[1].split(',').map(s => s.trim()).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]);
    }
    return bodies;
}

// The one base rule for a selector — asserts there IS exactly one, because a
// second copy further down the file would silently win and this test would be
// reading the loser.
function baseRule(selector) {
    const bodies = ruleBodies(selector);
    assert.equal(bodies.length, 1,
        `css/styles.css: expected exactly one top-level \`${selector} { … }\` rule ` +
        `(outside @media), found ${bodies.length} — this test cannot tell which one wins`);
    return bodies[0];
}

const decl = (body, prop) => {
    const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
    return m ? m[1].trim() : null;
};

suite('math typesetting: the fraction bar sits on the maths axis', () => {
    test('.math-frac anchors with `vertical-align: middle`, not a magic em offset', () => {
        // An inline-grid takes its baseline from its FIRST ROW, so any `-Xem`
        // offset anchors the NUMERATOR. Measured: the bar came out 0.913em
        // below the text baseline instead of ~0.25em above it — ~1.17em low,
        // in all 8 contexts. `middle` derives the offset from the parent's
        // own x-height, so it is right at every font-size.
        const frac = baseRule('.math-frac');
        assert.equal(decl(frac, 'vertical-align'), 'middle',
            'css/styles.css: the base `.math-frac` rule must declare ' +
            '`vertical-align: middle` — anything else anchors the numerator, ' +
            'and the bar drops ~1.17em below the line it belongs to');
    });

    test('.math-frac splits its two halves evenly with `grid-template-rows: 1fr 1fr`', () => {
        // `middle` puts the BOX midpoint on the maths axis. That only places
        // the BAR there if numerator and denominator are the same height —
        // otherwise a tall numerator (parentheses, an exponent, a nested
        // fraction) pushes the bar back off the axis. `auto auto` was how the
        // nested case ended up 2.77em out.
        const frac = baseRule('.math-frac');
        assert.equal(decl(frac, 'grid-template-rows'), '1fr 1fr',
            'css/styles.css: the base `.math-frac` rule must declare ' +
            '`grid-template-rows: 1fr 1fr` — with `auto auto` the box midpoint ' +
            'is not the bar, so taller numerators drift (measured 2.77em on a ' +
            'nested fraction)');
    });

    test('.math-frac carries NO hardcoded vertical-align length — the regression guard', () => {
        // This is the assertion that actually stops the bug coming back.
        // The original defect was a hand-tuned `-.55em`; anyone "nudging" the
        // alignment back to a constant re-breaks all the other contexts,
        // because one em value cannot be correct at two font-sizes.
        const frac = baseRule('.math-frac');
        const offsets = (frac.match(/vertical-align\s*:\s*[^;]+/g) || [])
            .filter(d => /-?\d*\.?\d+\s*(em|rem|px)\b/.test(d));
        assert.deepEqual(offsets, [],
            'css/styles.css: the base `.math-frac` rule must not pin ' +
            '`vertical-align` to an em/rem/px constant. A magic offset is what ' +
            'put the bar ~1.17em below the text baseline in the first place — ' +
            'it can only ever be tuned for one context, and `.math-frac` renders ' +
            'in at least 8');
    });

    test('a root WRAPPING a fraction switches to `vertical-align: middle` too', () => {
        // √(a/b) inherits the same problem one level up: `.math-root` is an
        // inline-flex whose radicand now contains a two-row grid, so the fixed
        // -.24em drags the whole radical below the line — measured 0.656em low
        // against the same maths axis. Only the wrapping case needs `middle`.
        // No content in the maths data builds one today; this is the latent
        // case the typesetter WILL build from e.g. "√(1/4)", pinned before it
        // ships rather than after.
        const rooted = baseRule('.math-root:has(.math-frac)');
        assert.equal(decl(rooted, 'vertical-align'), 'middle',
            'css/styles.css: `.math-root:has(.math-frac)` must declare ' +
            '`vertical-align: middle` — a root around a stacked fraction ' +
            'otherwise hangs 0.656em below the maths axis, the same way the ' +
            'fraction itself did');
    });

    test('a PLAIN root keeps `vertical-align: -.24em` — it is already correct', () => {
        // Deliberate asymmetry, and the reason assertion 4 uses :has(). A bare
        // √36 has a single-line radicand and sits right on the text baseline
        // today. Switching it to `middle` visibly LIFTS the radicand off that
        // baseline, so the fix must not be applied wholesale to `.math-root`.
        const rootRule = baseRule('.math-root');
        assert.equal(decl(rootRule, 'vertical-align'), '-.24em',
            'css/styles.css: the base `.math-root` rule must keep ' +
            '`vertical-align: -.24em`. A plain √36 is correctly placed today; ' +
            '`middle` here lifts the radicand off the text baseline. Only ' +
            '`.math-root:has(.math-frac)` needs the middle alignment');
    });
});

suite('math typesetting: mathFormula still builds the markup the CSS styles', () => {
    test('a/x renders as the three-span stacked fraction, not a slash', () => {
        // The geometry rules above only matter if the renderer keeps emitting
        // the elements they target.
        const html = math.mathFormula('a/x');
        assert.truthy(/class="math-frac"/.test(html),
            'js/math.js: mathFormula("a/x") must produce a .math-frac wrapper — ' +
            'the CSS geometry pinned above has nothing to align without it');
        assert.truthy(/class="math-num">a</.test(html),
            'js/math.js: mathFormula("a/x") must put "a" in a .math-num (grid row 1)');
        assert.truthy(/class="math-den">x</.test(html),
            'js/math.js: mathFormula("a/x") must put "x" in a .math-den (grid row 2)');
    });

    test('a parenthesised numerator stays one fraction and keeps its brackets', () => {
        // The tall-numerator case that `1fr 1fr` exists for. If this ever
        // split into two fractions, or dropped the parentheses, the alignment
        // test above would be guarding markup nobody renders.
        const html = math.mathFormula('(a + b + c)/(x + y + z)');
        assert.equal((html.match(/class="math-frac"/g) || []).length, 1,
            'js/math.js: mathFormula("(a + b + c)/(x + y + z)") must build exactly ' +
            'one .math-frac, not one per term');
        assert.truthy(/class="math-num">\(a \+ b \+ c\)</.test(html),
            'js/math.js: the numerator must keep its parentheses — dropping them ' +
            'changes the maths, and the taller bracket glyphs are exactly the ' +
            'content `grid-template-rows: 1fr 1fr` keeps centred on the bar');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
