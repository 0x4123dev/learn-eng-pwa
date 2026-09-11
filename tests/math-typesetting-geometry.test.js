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
// The square-root half of this file guards a stylesheet that is now TWO
// layers deep, and the two say different things on purpose:
//
//   1. a GLYPH FALLBACK at top level — the √ character itself, sized so its
//      ink tops out on the overbar;
//   2. a DRAWN HOOK inside `@supports (mask-image: …)`, which re-declares
//      `.math-root`, `.math-root-symbol` and `.math-radicand`.
//
// Layer 2 exists because layer 1 cannot ever be exactly right. Sizing a √
// CHARACTER against the bar is a per-font constant — Georgia's √ ink ascent is
// 0.832em, Times New Roman's 0.913em, the generic serif Android falls back to
// 0.930em — and no glyph grows to enclose a tall radicand, so `√(4/25)` left
// the "25" dangling 0.78em below the hook's tip. A mask stretched to the
// radicand's own box is identical on every device and grows with its content.
// Measured after the rewrite, across all 200 real roots in 7 contexts with
// Nunito actually loaded: radicand baseline 0.000em off the text baseline,
// hook top exactly on the bar (0.000em), nothing poking above the bar
// (0 of 200).
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
// @media AND @supports block, then match selectors exactly.
//
// @supports has to go for the same reason @media does, and now it matters
// more: the drawn-hook layer RE-DECLARES `.math-root`, `.math-root-symbol` and
// `.math-radicand`. Left in, its copies count as extra top-level rules and
// `baseRule()`'s "exactly one" assertion trips on every one of them — while
// the assertion itself is worth keeping, because a genuine second top-level
// copy really would silently win. So `stripAtBlocks` takes both at-rules out
// of the top-level view, and `supportsRule()` reads the drawn-hook layer on
// its own terms.
// ---------------------------------------------------------------------------

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// The at-rules that wrap a CONDITIONAL copy of a rule: whatever is inside them
// is a different layer, never the base one.
const AT_BLOCKS = ['@media', '@supports'];

// Remove `@media … { … }` and `@supports … { … }` wholesale, brace-counting so
// nested rules go with them.
function stripAtBlocks(css) {
    let out = '';
    for (let i = 0; i < css.length;) {
        if (AT_BLOCKS.some(at => css.startsWith(at, i))) {
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

const CSS = stripComments(require('./css-all').readAllCss());
const TOP_LEVEL_CSS = stripAtBlocks(CSS);

// The mirror image of `stripAtBlocks`: hand back the BODY of the `@supports`
// block instead of throwing it away, so the drawn-hook layer can be asserted
// on in its own right. Same brace counting.
//
// The layer is ONE block by condition, not by file: the stylesheet split
// (tests/css-split.test.js) left `.math-root-symbol` in css/styles.css and
// moved `.math-root` / `.math-radicand` to css/math.css, each under its own
// `@supports (…same condition…) { }` wrapper. Two wrappers with one condition
// are one layer to the browser, so blocks are merged by condition here.
function supportsBodies() {
    const byCondition = new Map();
    for (let i = 0; i < CSS.length;) {
        if (CSS.startsWith('@supports', i)) {
            const open = CSS.indexOf('{', i);
            if (open === -1) break;
            let depth = 1, j = open + 1;
            for (; j < CSS.length && depth > 0; j++) {
                if (CSS[j] === '{') depth++;
                else if (CSS[j] === '}') depth--;
            }
            const condition = CSS.slice(i + '@supports'.length, open).replace(/\s+/g, ' ').trim();
            byCondition.set(condition, (byCondition.get(condition) || '') + '\n' + CSS.slice(open + 1, j - 1));
            i = j;
        } else {
            i++;
        }
    }
    return [...byCondition.values()];
}

const SUPPORTS_BLOCKS = supportsBodies();

// Every declaration body in `css` whose selector list contains `selector`
// verbatim. `css` is the top-level view by default; pass a `@supports` body to
// read the conditional layer.
function ruleBodies(selector, css = TOP_LEVEL_CSS) {
    const bodies = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
        const selectors = m[1].split(',').map(s => s.trim()).filter(Boolean);
        if (selectors.includes(selector)) bodies.push(m[2]);
    }
    return bodies;
}

// The one base rule for a selector — asserts there IS exactly one, because a
// second copy further down the file would silently win and this test would be
// reading the loser.
function baseRule(selector, css = TOP_LEVEL_CSS, where = 'at top level, outside @media/@supports') {
    const bodies = ruleBodies(selector, css);
    assert.equal(bodies.length, 1,
        `css/styles.css: expected exactly one \`${selector} { … }\` rule ` +
        `(${where}), found ${bodies.length} — this test cannot tell which one wins`);
    return bodies[0];
}

// The same thing one layer down: the rule for `selector` inside the single
// `@supports` block — the layer that DRAWS the hook as a mask.
//
// `mustDeclare` disambiguates when a selector deliberately appears in more than
// one rule there. The hook is split in two on purpose: the mask itself is
// keyed on a bare `.math-root-symbol`, and the font-size neutraliser lists the
// `:has()` variants separately. A CSS selector LIST is dropped whole when any
// selector in it is invalid, so putting `:has()` in the mask rule would leave a
// browser without `:has()` holding the .58em gutter with no hook drawn in it.
function supportsRule(selector, mustDeclare) {
    assert.equal(SUPPORTS_BLOCKS.length, 1,
        'css/styles.css: expected exactly one `@supports` block (the drawn √ ' +
        `hook), found ${SUPPORTS_BLOCKS.length} — this test cannot tell which ` +
        'layer it is reading');
    if (!mustDeclare) {
        return baseRule(selector, SUPPORTS_BLOCKS[0], 'inside the @supports (mask-image) block');
    }
    const bodies = ruleBodies(selector, SUPPORTS_BLOCKS[0])
        .filter(body => decl(body, mustDeclare) !== null);
    assert.equal(bodies.length, 1,
        `css/styles.css: expected exactly one \`${selector} { … }\` rule declaring ` +
        `\`${mustDeclare}\` inside the @supports (mask-image) block, found ${bodies.length}`);
    return bodies[0];
}

const decl = (body, prop) => {
    const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
    return m ? m[1].trim() : null;
};

// The mirror image of `baseRule`: find a rule by what its body DOES and hand
// back its selector LIST. Looking a shared rule up by one of its own selectors
// would beg the question — the thing under test is which selectors are in the
// list, so the rule has to be identified by its declarations instead.
function selectorsOfRuleWith(decls) {
    const matches = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(TOP_LEVEL_CSS))) {
        const body = m[2];
        if (Object.keys(decls).every(prop => decl(body, prop) === decls[prop])) {
            matches.push(m[1].split(',').map(s => s.trim()).filter(Boolean));
        }
    }
    const wanted = Object.keys(decls).map(p => `${p}: ${decls[p]}`).join('; ');
    assert.equal(matches.length, 1,
        `css/styles.css: expected exactly one top-level rule declaring \`${wanted}\` ` +
        `(outside @media/@supports), found ${matches.length} — this test cannot tell ` +
        'which selector list it is checking');
    return matches[0];
}

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

    test('.math-root sits ON the line: `vertical-align: baseline` + `display: inline-block`', () => {
        // The FALLBACK layer — what a browser without masks renders. A căn bậc
        // hai is read as ONE letter on the line of text, so the root is
        // anchored the way a letter is — baseline to baseline — instead of
        // being pushed down by a hand-tuned offset. It used to be an
        // inline-flex on `vertical-align: -.24em`, which sank √9 below the
        // line of text it belonged to. Measured after the fix: the radicand's
        // own text baseline sits at 0.000em, exactly on the surrounding
        // baseline.
        //
        // `position: relative` is the other half: it is what the drawn hook in
        // the @supports layer is absolutely positioned AGAINST, so it belongs
        // on the base rule where both layers get it.
        const rootRule = baseRule('.math-root');
        assert.equal(decl(rootRule, 'vertical-align'), 'baseline',
            'css/styles.css: the base `.math-root` rule must declare ' +
            '`vertical-align: baseline` — the root sits on the line of text ' +
            'like a letter, and any other anchoring drops √9 below the line ' +
            'it belongs to');
        assert.equal(decl(rootRule, 'display'), 'inline-block',
            'css/styles.css: the base `.math-root` rule must declare ' +
            '`display: inline-block` — as an inline-flex the box, not the ' +
            'radicand text, defines the baseline, which is how the radicand ' +
            'came off the line in the first place');
        assert.equal(decl(rootRule, 'position'), 'relative',
            'css/styles.css: the base `.math-root` rule must declare ' +
            '`position: relative` — it is the containing block the drawn hook ' +
            'in the @supports layer is positioned against; without it the mask ' +
            'escapes to the nearest positioned ancestor and lands somewhere ' +
            'else on the screen entirely');
    });

    test('.math-root carries NO hardcoded vertical-align length — the regression guard', () => {
        // Same guard as the `.math-frac` one above, and for the same reason:
        // the original defect here was a hand-tuned `-.24em`. That constant IS
        // how the radicand ended up off the baseline, and it cannot be right
        // at more than one font-size — `.math-root` renders in the question
        // text, the options, the explanations and the lesson body.
        const rootRule = baseRule('.math-root');
        const offsets = (rootRule.match(/vertical-align\s*:\s*[^;]+/g) || [])
            .filter(d => /-?\d*\.?\d+\s*(em|rem|px)\b/.test(d));
        assert.deepEqual(offsets, [],
            'css/styles.css: the base `.math-root` rule must not pin ' +
            '`vertical-align` to an em/rem/px constant. `-.24em` is exactly ' +
            'how the radicand ended up sunk below the line of text, with a ' +
            '~0.4em hole between it and the overbar');
    });

    test('.math-radicand is a baseline inline-block, NOT a flex container', () => {
        // The three declarations that sank the digits: `align-items: center`
        // centred them inside a box `min-height: 1.15em` tall — nearly twice
        // their own height — so √9 printed the 9 low and left a ~0.4em gap
        // under the bar, and the hook read as a tick mark beside a floating
        // number. Baseline-aligning the radicand instead puts its own text
        // baseline on the line's baseline (measured 0.000em) with the overbar
        // 0.833em above it, right where Georgia's √ ink tops out (0.832em).
        //
        // Being a flex container broke a second thing, quietly and worse: a
        // `sup` inside a flex container is a FLEX ITEM, and a flex item ignores
        // `vertical-align` OUTRIGHT. So the shared exponent rule
        // (`vertical-align: super`) did nothing at all inside a radicand and
        // the exponent dropped 0.111em BELOW its own baseline — √(21,5²)
        // printed as √(21,52), a different and perfectly plausible number, in
        // 38 superscripts across 20 strings of Chapter 2, the chapter about
        // squares and roots. `inline-block` is the fix: the exponent stops
        // being a flex item, `vertical-align` applies again, and the standard
        // `.75em`/`super` ink clears the overbar by 0.1em. Hence: this must be
        // inline-block, and above all it must not be flex of any flavour.
        const radicand = baseRule('.math-radicand');
        assert.equal(decl(radicand, 'display'), 'inline-block',
            'css/styles.css: `.math-radicand` must declare ' +
            '`display: inline-block` — an inline-flex takes its baseline from ' +
            'the box, not from the digits under the bar');
        assert.notContains(['flex', 'inline-flex'], decl(radicand, 'display'),
            'css/styles.css: `.math-radicand` must NOT be a flex container. A ' +
            '`sup` inside one is a flex item, and a flex item silently ignores ' +
            '`vertical-align` — which is how √(21,5²) came to print as ' +
            '√(21,52)');
        assert.equal(decl(radicand, 'vertical-align'), 'baseline',
            'css/styles.css: `.math-radicand` must declare ' +
            '`vertical-align: baseline` — the radicand text is what has to ' +
            'land on the surrounding text baseline');
        assert.equal(decl(radicand, 'align-items'), null,
            'css/styles.css: `.math-radicand` must NOT declare `align-items` — ' +
            '`center` is what floated the digits inside an oversized box, ' +
            'sinking √9 below the line');
        assert.equal(decl(radicand, 'min-height'), null,
            'css/styles.css: `.math-radicand` must NOT declare `min-height` — ' +
            '`1.15em` made the box nearly twice the height of its digits, ' +
            'which is the ~0.4em hole that opened up under the overbar');
    });

    test('every screen that prints an exponent shares ONE `sup` rule', () => {
        // An exponent has to look the same wherever the child meets it, so
        // there is exactly one rule that sets it — `font-size: .75em;
        // vertical-align: super; line-height: 0` — and every screen that can
        // print a `sup` has to be named in its selector list.
        //
        // A screen left out of the list does not go unstyled, it goes to the
        // browser default: 0.83em at weight 400 instead of 0.75em at 800.
        // Three screens were missing, so the same x² printed at one size in
        // the question, another in the answer options, and another again on
        // the results screen the child saw straight after. The UA default also
        // brings `line-height: normal` in place of `0`, which grows every line
        // holding an exponent by 0.17em.
        //
        // Note this looks the rule up by its declarations, not by a selector:
        // the selector list is the thing being tested.
        const selectors = selectorsOfRuleWith({
            'font-size': '0.75em',
            'vertical-align': 'super',
            'line-height': '0',
        });
        const screens = [
            '.math-formula sup',
            '.grammar-question-text sup',
            '.grammar-option-text sup',
            '.grammar-review-q sup',
            '.grammar-review-explain sup',
            '.grammar-explanation sup',
            '.math-lesson-body sup',
        ];
        for (const screen of screens) {
            assert.contains(selectors, screen,
                `css/styles.css: \`${screen}\` is missing from the shared ` +
                '`sup` selector list. That screen falls back to the browser ' +
                'default (0.83em, weight 400), so the same exponent prints ' +
                'smaller and lighter there than on the screen beside it, and ' +
                '`line-height: normal` grows the line by 0.17em');
        }
    });

    test('a root WRAPPING a fraction re-SIZES the hook instead of stretching it', () => {
        // The latent case, in the FALLBACK layer: a fraction radicand is the
        // one thing tall enough to outgrow a one-line hook. The old rule tried
        // `align-items: stretch`, which cannot work — stretching a flex ITEM
        // resizes its box, not the glyph inside it, so the box grew and the √
        // stayed 1.32em. Where there is no mask the hook can only be asked for
        // in font-size (1.741em bar ÷ 0.832em ink ascent ≈ 2.09em); where there
        // is one the @supports layer overrides this back to 1em and stretches
        // the drawing instead.
        const rootedSymbol = baseRule('.math-root:has(.math-frac) .math-root-symbol');
        assert.truthy(decl(rootedSymbol, 'font-size') !== null,
            'css/styles.css: `.math-root:has(.math-frac) .math-root-symbol` must ' +
            'declare a `font-size` — the hook over a stacked fraction can only ' +
            'be grown by scaling the glyph; a flex `stretch` grows the box and ' +
            'leaves the √ detached from the bar');
    });

    test('.math-root:has(sup) .math-radicand lifts the bar clear of the exponent', () => {
        // An exponent is the one thing that reaches higher than the bar: at the
        // standard raise its ink sat 0.103em ABOVE the vinculum, so the bar
        // sliced the 2 of √(a²) in half — in the very questions that ask what
        // √(a²) is. A radical grows to clear what it covers, so the headroom
        // goes on the radicand and the exponent keeps exactly the size and
        // height it has everywhere else in the app.
        const supRadicand = baseRule('.math-root:has(sup) .math-radicand');
        assert.truthy(decl(supRadicand, 'padding-top') !== null,
            'css/styles.css: `.math-root:has(sup) .math-radicand` must declare a ' +
            '`padding-top` — without that headroom the overbar cuts through the ' +
            'exponent (measured 0.103em of ink above the bar), and √(a²) prints ' +
            'with a half-eaten 2 on the screens that teach squares and roots');
    });
});

suite('math typesetting: where masks work, the √ hook is DRAWN, not typed', () => {
    test('the @supports condition gates on `:has()` as well as on masks', () => {
        // This layer only works as a whole. A browser with masks but WITHOUT
        // `:has()` kept `padding-left: .58em` and `line-height: 0` from the
        // block while dropping every rule whose selector list mentions
        // `:has()` — including the two that lift the bar clear of an exponent
        // and a fraction. Measured in that state: the .58em gutter with no hook
        // drawn in it, and the vinculum slicing the 2 of √(a²) in half. Firefox
        // before 121 (ESR 115 included), Chrome ≤104, Safari ≤15.3 and Samsung
        // Internet ≤20 land there; testing the selector too sends them to the
        // typed fallback whole, which degrades but does not break.
        // One condition, however many files carry a wrapper for it (see supportsBodies).
        const conditions = [...new Set([...CSS.matchAll(/@supports\s*([^{]+)\{/g)].map(m => m[1].replace(/\s+/g, ' ').trim()))];
        assert.equal(conditions.length, 1,
            `css/styles.css: expected exactly one @supports condition, found ${conditions.length}`);
        assert.truthy(/mask-image/.test(conditions[0]),
            'css/styles.css: the @supports condition must test mask-image');
        assert.truthy(/selector\(\s*:has\(/.test(conditions[0]),
            'css/styles.css: the @supports condition must ALSO test ' +
            '`selector(:has(*))`. Without it a browser that has masks but not ' +
            '`:has()` keeps the .58em hook gutter and the zero line-height while ' +
            'dropping the mask rule and both bar-lifting rules — a radical with ' +
            'no hook and a sliced exponent');
    });

    test('@supports `.math-root` hugs the radicand with `line-height: 0` + a `padding-left` gutter', () => {
        // The drawn hook is absolutely positioned against `.math-root`'s OWN
        // box, so that box has to hug the radicand instead of carrying the
        // surrounding line's leading. With the inherited 1.7 line-height the
        // box was taller than its content, and the hook — stretched top-to-
        // bottom of it — started 0.32em ABOVE the bar and poked out of the top
        // of the radical. `line-height: 0` collapses the box onto the radicand,
        // and `padding-left` reserves the gutter the hook is drawn into (it is
        // out of flow, so it takes no width of its own).
        const rootRule = supportsRule('.math-root');
        assert.equal(decl(rootRule, 'line-height'), '0',
            'css/styles.css: `.math-root` inside @supports must declare ' +
            '`line-height: 0` — otherwise its box carries the line\'s leading, ' +
            'the stretched hook starts 0.32em above the bar and pokes out of ' +
            'the top of the radical');
        assert.truthy(decl(rootRule, 'padding-left') !== null,
            'css/styles.css: `.math-root` inside @supports must declare a ' +
            '`padding-left` — the drawn hook is out of flow and takes no width, ' +
            'so without that gutter it is painted on top of the first digit of ' +
            'the radicand');
    });

    test('@supports the hook is an absolute mask pinned top-to-bottom, so it GROWS with its content', () => {
        // This is the whole point of layer 2. A √ glyph is a fixed shape at a
        // fixed size: over √(4/25) it left the "25" dangling 0.78em below the
        // hook's tip, and no font-size fixes that in general because the hook
        // has to match whatever the radicand happens to be. `top: 0; bottom: 0`
        // on an absolutely positioned box makes the mask exactly as tall as
        // `.math-root`, which is exactly as tall as the radicand — so it grows
        // with its content on every device, whatever serif the phone has.
        //
        // Both `mask-image` and `-webkit-mask-image` have to be there: Safari
        // still needs the prefixed property, and it is the browser most of
        // these children are reading on.
        const symbol = supportsRule('.math-root-symbol', 'mask-image');
        assert.equal(decl(symbol, 'position'), 'absolute',
            'css/styles.css: the @supports `.math-root-symbol` rule must declare ' +
            '`position: absolute` — in flow it cannot be stretched to the ' +
            'radicand\'s height, which is the only reason the drawn hook exists');
        assert.equal(decl(symbol, 'top'), '0',
            'css/styles.css: the @supports `.math-root-symbol` rule must declare ' +
            '`top: 0` — with only one edge pinned the hook has an intrinsic ' +
            'height again and stops growing with the radicand');
        assert.equal(decl(symbol, 'bottom'), '0',
            'css/styles.css: the @supports `.math-root-symbol` rule must declare ' +
            '`bottom: 0` — `top: 0` alone leaves the hook a fixed height, and ' +
            '√(4/25) goes back to dangling its "25" 0.78em below the tip');
        assert.truthy(decl(symbol, 'mask-image') !== null,
            'css/styles.css: the @supports `.math-root-symbol` rule must declare ' +
            '`mask-image` — that is the drawing; without it the rule paints a ' +
            'solid currentColor rectangle over the gutter');
        assert.truthy(decl(symbol, '-webkit-mask-image') !== null,
            'css/styles.css: the @supports `.math-root-symbol` rule must declare ' +
            '`-webkit-mask-image` as well — Safari still needs the prefix, and ' +
            'unprefixed-only leaves it painting a solid bar beside every root');
    });

    test('@supports the √ CHARACTER is pushed out of sight, never removed from the DOM', () => {
        // The drawn hook replaces the glyph visually only. The `√` stays in the
        // document so the formula still copies as "√9" and still reads aloud —
        // a screen reader announces the character, and there is nothing in a
        // background-image mask for it to announce. `display: none` or
        // `visibility: hidden` would take it out of the accessibility tree and
        // out of the clipboard both, and the loss would be invisible to anyone
        // who is not using a screen reader. `text-indent` moves it off-screen
        // and leaves it there.
        const symbol = supportsRule('.math-root-symbol', 'mask-image');
        assert.truthy(decl(symbol, 'text-indent') !== null,
            'css/styles.css: the @supports `.math-root-symbol` rule must hide the ' +
            '√ character with `text-indent` — it has to leave the DOM intact so ' +
            'the formula still copies and still reads aloud');
        assert.falsy(/display\s*:\s*none/.test(symbol),
            'css/styles.css: the @supports `.math-root-symbol` rule must NOT use ' +
            '`display: none` — that drops the √ from the accessibility tree and ' +
            'the clipboard, so the root stops being readable to a screen reader ' +
            'and pastes as a bare "9"');
        assert.falsy(/visibility\s*:\s*hidden/.test(symbol),
            'css/styles.css: the @supports `.math-root-symbol` rule must NOT use ' +
            '`visibility: hidden` — same loss as `display: none`: the drawn hook ' +
            'is a mask with no text of its own, so hiding the character leaves ' +
            'the root unreadable to a screen reader');
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
