// math-copy.test.js — copying typeset maths must paste as the same maths.
//
// js/math.js draws x² as x<sup>2</sup> and 2/5 as a two-row grid; the
// browser's own text/plain serialiser flattens that to "x2" and "2\n/\n5",
// and √(21,5²) pastes as √(21,52) — a different number, in a child's
// homework. js/math-copy.js rewrites the clipboard text from the selected
// markup. Its DOM half is a dozen lines verified in a real browser; everything
// that can be wrong about the TEXT lives in MathCopy.plainText(html), which
// is what this file tests — construct by construct, and then as a round trip
// of every formula in both question banks.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_QUESTIONS_HK2 } = require(path.join(root, 'js', 'math-data-hk2.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
const { MATH_LESSONS_HK2 } = require(path.join(root, 'js', 'math-lessons-hk2.js'));
// math.js reads these as globals, the way the browser gives them to it.
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
const { mathFormula, mathRich, mathExplanationHTML } = require(path.join(root, 'js', 'math.js'));
const MathCopy = require(path.join(root, 'js', 'math-copy.js'));
const plain = MathCopy.plainText;

// The renderer's own tables, read out of js/math.js source (they are
// module-local there), so the mirror in math-copy.js cannot drift unnoticed.
function tableFromSource(name) {
    const m = new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\});').exec(read('js/math.js'));
    if (!m) throw new Error(name + ' not found in js/math.js');
    return vm.runInNewContext('(' + m[1] + ')');
}
const SUP = tableFromSource('MATH_SUPERSCRIPTS');
const SUB = tableFromSource('MATH_SUBSCRIPTS');
const entries = (o) => Object.entries(o).sort();
const SUP_RUN = new RegExp('[' + Object.keys(SUP).join('') + ']+', 'g');

suite('math-copy: superscript/subscript tables mirror js/math.js', () => {
    test('TO_SUP is the inverse of MATH_SUPERSCRIPTS plus an ASCII-hyphen alias', () => {
        const want = {};
        for (const glyph in SUP) want[SUP[glyph]] = glyph;
        want['-'] = want['−'];
        assert.deepEqual(entries(MathCopy.TO_SUP), entries(want));
        assert.equal(MathCopy.TO_SUP['-'], '⁻');
    });
    test('TO_SUB is the inverse of MATH_SUBSCRIPTS plus an ASCII-hyphen alias', () => {
        const want = {};
        for (const glyph in SUB) want[SUB[glyph]] = glyph;
        want['-'] = want['−'];
        assert.deepEqual(entries(MathCopy.TO_SUB), entries(want));
        assert.equal(MathCopy.TO_SUB['-'], '₋');
    });
});

suite('math-copy: each construct copies as the maths it shows', () => {
    // Every case is what a child sees on screen → what her paste must say.
    const same = (s) => test(`${s} copies unchanged`, () => assert.equal(plain(mathFormula(s)), s));
    same('x²');
    same('x⁻⁵');
    same('√(21,5²)');
    same('y₁ + y₂');
    same('aᵐ · aⁿ = aᵐ⁺ⁿ');
    same('2/5');
    same('(a+b)/(x+y)');
    same('(a + b)/(x + y)');
    same('−3/4');
    same('−(a+b)/2');
    same('|x − 1|/2');
    same('2 2/5');
    same('−2 1/3');
    same('√36');
    same('√x²');
    same('√(4/25)');
    same('√(a²) = |a|');
    same('x^(1/2)');
    same('Định lí Pythagore (SGK tr. 5)');
    same('Tính √(16/25) + 2 1/3 − x⁻²');
    same('(−1/2)⁴ · (−1/2)');
    same('Công thức x⁻ⁿ = 1/xⁿ (với n là số tự nhiên dương)');
    same('khi a < 0 & b > 0');

    test('caret and prose exponents copy in the app\'s normal form: Unicode where a glyph exists', () => {
        assert.equal(plain(mathFormula('x^2 + 3x')), 'x² + 3x');
        assert.equal(plain(mathFormula('5^(x+4)')), '5ˣ⁺⁴');
        assert.equal(plain(mathFormula('10^(-3)')), '10⁻³', 'an ASCII hyphen raises like U+2212');
    });
    test('an exponent the font cannot raise falls back to ^(…)', () => {
        assert.equal(plain(mathFormula('5 mũ (x + 4)')), '5^(x + 4)', 'a space has no superscript glyph');
        assert.equal(plain('<span class="math-formula">b<sup>f</sup></span>'), 'b^(f)', 'no ᶠ in the table');
        assert.equal(plain(mathFormula('2^(2^3)')), '2^(2³)', 'a raised run inside an exponent');
        assert.equal(plain('<span class="math-formula">x<sup>(a + b)</sup></span>'), 'x^(a + b)', 'never bracketed twice');
    });
    test('a subscript the font cannot lower falls back to _(…)', () => {
        assert.equal(plain('<span class="math-formula">a<sub>ij</sub></span>'), 'aᵢⱼ');
        assert.equal(plain('<span class="math-formula">a<sub>i + 1</sub></span>'), 'a_(i + 1)');
    });

    test('a stacked fraction is one line, and the hidden slash is written exactly once', () => {
        const html = mathFormula('2/5');
        assert.truthy(/math-frac-slash/.test(html), 'the renderer still emits the hidden slash');
        const text = plain(html);
        assert.equal(text, '2/5');
        assert.falsy(/\n/.test(text));
        assert.equal((text.match(/\//g) || []).length, 1);
    });
    test('a fraction side with an operator or a space between atoms is bracketed', () => {
        const frac = (num, den) => `<span class="math-frac"><span class="math-num">${num}</span>`
            + `<span class="math-frac-slash">/</span><span class="math-den">${den}</span></span>`;
        assert.equal(plain(frac('a + b', 'x + y')), '(a + b)/(x + y)');
        assert.equal(plain(frac('a−b', 'c')), '(a−b)/c');
        assert.equal(plain(frac('2', '5')), '2/5');
        assert.equal(plain(frac('−3', '4')), '−3/4', 'a leading sign is not an operator');
        assert.equal(plain(frac('(a + b)', '2')), '(a + b)/2', 'already bracketed');
        assert.equal(plain(frac('(a)(b)', '2')), '(a)(b)/2', 'juxtaposition is not an operator — no brackets needed');
        assert.equal(plain(frac('(a)+(b)', '2')), '((a)+(b))/2', '…but "(a)+(b)" is two groups joined by one');
        assert.equal(plain(frac('x<sup>2</sup>', 'y<sub>1</sub>')), 'x²/y₁', 'scripts inside a fraction');
    });
    test('a root writes √ once and brackets a compound radicand', () => {
        const rootOf = (rad) => `<span class="math-root"><span class="math-root-symbol">√</span>`
            + `<span class="math-radicand">${rad}</span></span>`;
        assert.equal(plain(rootOf('36')), '√36');
        assert.equal(plain(rootOf('a + b')), '√(a + b)');
        assert.equal(plain(rootOf('(a + b)')), '√(a + b)');
        assert.equal(plain(rootOf('|a|')), '√|a|');
        const html = mathFormula('√(4/25)');
        assert.equal((plain(html).match(/√/g) || []).length, 1);
    });
    test('a mixed number keeps whole and fraction together with one space', () => {
        assert.equal(plain(mathFormula('Cộng 2 2/5 với 1 1/3')), 'Cộng 2 2/5 với 1 1/3');
    });
    test('a citation and every other span copy as visible text', () => {
        const html = mathFormula('Xem (SGK tr. 28) và tr. 5');
        assert.truthy(/math-cite/.test(html));
        assert.equal(plain(html), 'Xem (SGK tr. 28) và tr. 5');
        assert.equal(plain('<span class="math-power">5<sup>2</sup></span> và <i>x</i><b>y</b>'), '5² và xy');
    });
});

suite('math-copy: line breaks only where the source has them', () => {
    test('a real <br> in a lesson body breaks the line; formulas never do', () => {
        const text = plain(mathRich('Căn bậc hai: √(a²) = |a|.<br>Phân số 3/4 và 1/2.'));
        assert.equal(text, 'Căn bậc hai: √(a²) = |a|.\nPhân số 3/4 và 1/2.');
    });
    test('two <br>s keep the blank line', () => {
        assert.equal(plain('a<br><br>b'), 'a\n\nb');
    });
    test('an explanation breaks at its blocks, keeps every formula whole, and drops template indentation', () => {
        const html = mathExplanationHTML(
            '<b>Lý thuyết:</b> aᵐ · aⁿ = aᵐ⁺ⁿ<br><b>Áp dụng:</b> 2³ · 2⁴ = 2⁷ = 128 và 3/4<br>✗ 2¹² cộng nhầm số mũ thành nhân', {});
        assert.truthy(/\n\s+</.test(html), 'the template really is indented');
        const text = plain(html);
        assert.equal(text,
            'Cách giải\nLý thuyết\naᵐ · aⁿ = aᵐ⁺ⁿ\nÁp dụng\n2³ · 2⁴ = 2⁷ = 128 và 3/4\nVì sao các đáp án khác sai?\n2¹² cộng nhầm số mũ thành nhân');
        assert.falsy(/\n\n/.test(text), 'nested blocks make one newline, not a blank line');
        assert.falsy(/^\/$/m.test(text), 'no line is a lone slash');
    });
    test('whitespace collapses the way the browser renders it', () => {
        assert.equal(plain('<div>  a\n   b  </div>\n  <div>c</div>'), 'a b\nc');
        assert.equal(plain('a &nbsp;b'), 'a  b', 'a no-break space is content, not indentation');
    });
    test('table cells are tab-separated, rows are lines', () => {
        assert.equal(plain('<table><tr><th>x</th><th>y</th></tr><tr><td>1</td><td>x<sup>2</sup></td></tr></table>'),
            'x\ty\n1\tx²');
    });
    test('entities decode, comments and never-rendered elements vanish', () => {
        assert.equal(plain('a &lt; b &amp; c &#x221A;2 &#8722;1 <!-- note --> <style>.x{}</style><script>1</script>'),
            'a < b & c √2 −1');
        assert.equal(plain('<span hidden>gone</span>kept<span style="display:none">gone</span>'), 'kept');
        assert.equal(plain('<img alt="hình" src="x.png"> tam giác'), 'hình tam giác');
    });
    test('an attribute holding ">" does not break the reader', () => {
        assert.equal(plain('<button onclick="if (a > b) go()"><span class="grammar-option-text">x<sup>2</sup></span></button>'), 'x²');
    });
    test('never throws on odd input', () => {
        assert.equal(plain(''), '');
        assert.equal(plain(null), '');
        assert.equal(plain(undefined), '');
        assert.equal(plain('<span class="math-frac"><span class="math-num">2'), '2');
        assert.equal(plain('</div></span>text<b>'), 'text');
        assert.equal(plain('<<>>&&;'), '<<>>&&;');
    });
});

suite('math-copy: half a construct copies as only what was selected', () => {
    test('just the exponent of x² is still a superscript', () => {
        assert.equal(plain('<div class="grammar-question-text"><sup>2</sup></div>'), '²');
    });
    test('a numerator on its own is just the numerator', () => {
        assert.equal(plain('<span class="math-frac"><span class="math-num">2</span></span>'), '2');
        assert.equal(plain('<span class="math-frac"><span class="math-den">5</span></span>'), '5');
    });
    test('a radicand without its hook is just the radicand', () => {
        assert.equal(plain('<span class="math-root"><span class="math-radicand">21,5<sup>2</sup></span></span>'), '21,5²');
    });
    test('a hook with a cut-off radicand is √ and what was selected', () => {
        assert.equal(plain('<span class="math-root"><span class="math-root-symbol">√</span><span class="math-radicand">(21,</span></span>'), '√(21,');
    });
    test('a mixed number\'s whole part on its own', () => {
        assert.equal(plain('<span class="math-mixed"><span class="math-whole">2</span></span>'), '2');
    });
});

suite('math-copy: only a selection with maths in it is touched', () => {
    test('ordinary text is not ours — payload() is null so the browser copies it', () => {
        assert.equal(MathCopy.payload('Tính giá trị của biểu thức sau'), null);
        assert.equal(MathCopy.payload('<div class="grammar-question-text">Hello <b>world</b></div>'), null);
        assert.equal(MathCopy.payload(mathFormula('Số đối của 3 là số nào?')), null);
    });
    test('a <sup> outside every maths surface is not ours (an English 1st)', () => {
        assert.equal(MathCopy.payload('<p>1<sup>st</sup> of May</p>'), null);
        assert.equal(MathCopy.payload('<ul><li>x<sup>2</sup></li></ul>'), null);
    });
    test('a <sup>/<sub> under any maths surface is ours', () => {
        for (const surface of MathCopy.SURFACES) {
            const m = /^\.([\w-]+)(?:\s+([a-z]+))?$/.exec(surface);
            const html = m[2]
                ? `<ul class="${m[1]}"><${m[2]}>x<sup>2</sup></${m[2]}></ul>`
                : `<div class="${m[1]}">y<sub>1</sub></div>`;
            const p = MathCopy.payload(html);
            assert.truthy(p, surface + ' should be recognised');
            assert.equal(p.text, m[2] ? 'x²' : 'y₁');
            assert.equal(p.html, html, 'text/html is the selected markup, unchanged');
        }
    });
    test('the surfaces list is exactly the one the renderer paints on', () => {
        assert.deepEqual(MathCopy.SURFACES, ['.math-lesson-body', '.grammar-question-text', '.grammar-option-text',
            '.grammar-explanation', '.grammar-review-q', '.grammar-review-explain', '.math-formula',
            '.math-solution-steps li', '.math-mistakes li', '.math-hint-def']);
        const css = require('./css-all').readAllCss();
        for (const s of MathCopy.SURFACES) {
            const cls = s.split(' ')[0];
            assert.truthy(new RegExp(cls.replace('.', '\\.') + '[\\s,{:.]').test(css), cls + ' has no rule in the stylesheet');
        }
    });
    test('a fraction, root, mixed number or power is ours wherever it sits', () => {
        assert.truthy(MathCopy.involvesMath(mathFormula('2/5')));
        assert.truthy(MathCopy.involvesMath(mathFormula('√36')));
        assert.truthy(MathCopy.involvesMath(mathFormula('2 2/5')));
        assert.truthy(MathCopy.involvesMath(mathFormula('x^2')));
        assert.falsy(MathCopy.involvesMath(mathFormula('x²')), 'a bare <sup> needs its surface — the DOM layer supplies it');
    });
});

// A stand-in for the few DOM calls the handler makes, so the event contract
// can be pinned in node: what it sets, when it calls preventDefault, and that
// it puts the ancestors of a partial selection back before deciding.
function fakeEvent() {
    const data = {};
    return {
        data,
        prevented: false,
        clipboardData: { setData(type, value) { data[type] = value; } },
        preventDefault() { this.prevented = true; }
    };
}
function el(tag, cls, parent) {
    const node = {
        nodeType: 1, tag, cls, parentNode: parent || null, children: [],
        appendChild(c) { this.children.push(c); },
        cloneNode() { return el(tag, cls, null); },
        matches(selector) {
            return selector.split(',').map(s => s.trim()).some(s => {
                const m = /^\.([\w-]+)(?:\s+([a-z]+))?$/.exec(s);
                if (m[2]) return this.tag === m[2] && ancestorsOf(this).some(a => a.cls === m[1]);
                return this.cls === m[1];
            });
        },
        get innerHTML() { return this.children.map(serialize).join(''); }
    };
    return node;
}
function ancestorsOf(node) { const out = []; for (let p = node.parentNode; p; p = p.parentNode) out.push(p); return out; }
function serialize(n) {
    if (typeof n === 'string') return n;
    if (n.fragment != null) return n.fragment;
    return `<${n.tag}${n.cls ? ` class="${n.cls}"` : ''}>${n.children.map(serialize).join('')}</${n.tag}>`;
}
// A document whose one selection clones to `fragmentHTML`, with its common
// ancestor `anchor` somewhere in a tree hanging off body.
function fakeDoc(fragmentHTML, anchor, opts) {
    opts = opts || {};
    const body = el('body', '', null);
    const range = { cloneContents: () => ({ fragment: fragmentHTML }), commonAncestorContainer: anchor || body };
    const doc = {
        body, documentElement: el('html', '', null),
        getSelection() {
            if (opts.throws) throw new Error('boom');
            return { isCollapsed: !!opts.collapsed, rangeCount: opts.rangeCount == null ? 1 : opts.rangeCount, getRangeAt: () => range };
        },
        createElement: (tag) => el(tag, '', null)
    };
    return doc;
}

suite('math-copy: the copy handler', () => {
    test('rewrites text/plain, carries the markup as text/html, and cancels the default', () => {
        const e = fakeEvent();
        MathCopy.onCopy(e, fakeDoc(`<div class="grammar-question-text">Tính ${mathFormula('√(21,5²)')}.</div>`));
        assert.equal(e.data['text/plain'], 'Tính √(21,5²).');
        assert.equal(e.data['text/html'], `<meta charset="utf-8"><div class="grammar-question-text">Tính ${mathFormula('√(21,5²)')}.</div>`);
        assert.equal(e.prevented, true);
    });
    test('leaves an ordinary text selection completely alone', () => {
        const e = fakeEvent();
        MathCopy.onCopy(e, fakeDoc('<div class="grammar-question-text">Số đối của 3 là số nào?</div>'));
        assert.deepEqual(e.data, {});
        assert.equal(e.prevented, false);
    });
    test('puts back the ancestors a partial selection cut off: the "2" of x² pastes as ²', () => {
        const doc = fakeDoc('2');
        const surface = el('div', 'grammar-question-text', doc.body);
        const power = el('span', 'math-power', surface);
        const sup = el('sup', '', power);
        const textNode = { nodeType: 3, parentNode: sup };
        doc.getSelection().getRangeAt(0).commonAncestorContainer = textNode;
        const e = fakeEvent();
        MathCopy.onCopy(e, doc);
        assert.equal(e.data['text/plain'], '²');
        assert.equal(e.data['text/html'], '<meta charset="utf-8"><div class="grammar-question-text"><span class="math-power"><sup>2</sup></span></div>');
    });
    test('stops rebuilding at the surface, so an option button never wraps the copy', () => {
        const doc = fakeDoc('<span class="math-frac"><span class="math-num">2</span><span class="math-frac-slash">/</span><span class="math-den">5</span></span>');
        const button = el('button', 'grammar-option', doc.body);
        const surface = el('span', 'grammar-option-text', button);
        doc.getSelection().getRangeAt(0).commonAncestorContainer = surface;
        const e = fakeEvent();
        MathCopy.onCopy(e, doc);
        assert.equal(e.data['text/plain'], '2/5');
        assert.falsy(/<button/.test(e.data['text/html']));
    });
    test('a partial selection inside a plain paragraph is still not ours', () => {
        const doc = fakeDoc('hello');
        const p = el('p', '', doc.body);
        doc.getSelection().getRangeAt(0).commonAncestorContainer = { nodeType: 3, parentNode: p };
        const e = fakeEvent();
        MathCopy.onCopy(e, doc);
        assert.deepEqual(e.data, {});
        assert.equal(e.prevented, false);
    });
    test('does nothing for a collapsed selection, no ranges, no clipboardData, or a broken DOM', () => {
        for (const doc of [fakeDoc('x<sup>2</sup>', null, { collapsed: true }),
                           fakeDoc('x<sup>2</sup>', null, { rangeCount: 0 }),
                           fakeDoc('x<sup>2</sup>', null, { throws: true }), null]) {
            const e = fakeEvent();
            MathCopy.onCopy(e, doc || undefined);
            assert.deepEqual(e.data, {});
            assert.equal(e.prevented, false);
        }
        const e = fakeEvent();
        delete e.clipboardData;
        MathCopy.onCopy(e, fakeDoc(mathFormula('2/5')));
        assert.equal(e.prevented, false);
    });
    test('if setData throws, the default copy is left to run', () => {
        const e = fakeEvent();
        e.clipboardData.setData = () => { throw new Error('denied'); };
        MathCopy.onCopy(e, fakeDoc(mathFormula('2/5')));
        assert.equal(e.prevented, false);
    });
});

// ---- the round trip over the banks ----
// Every stem, option, answer and explanation that the renderer turns into a
// <sup>, <sub>, fraction or root must copy back to what the author wrote.
// The one documented exception: caret and prose exponents ("x^2", "5 mũ
// (x + 4)") copy in the app's normal form — Unicode where the font has the
// glyph, ^(…) where it has not — so those are compared after lowering every
// raised run to ^(…) on both sides.
function canon(t) {
    return t
        .replace(/\s*(?:mũ|\^)\s*\(([^()]*)\)/g, (m, e) => '^(' + e.replace(/-/g, '−') + ')')
        .replace(/\^(\d+|[A-Za-z])/g, (m, e) => '^(' + e + ')')
        .replace(SUP_RUN, run => '^(' + Array.from(run).map(c => SUP[c]).join('') + ')');
}
// What an explanation's HTML shows: <br> is a line, <b> is not, entities are
// characters. Each line trimmed, as the browser renders it.
function visible(html) {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(?:b|i|strong|u)\s*\/?>/gi, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
        .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}
const TYPESET = /<sup>|<sub>|math-frac|math-root/;
const banks = MATH_QUESTIONS.concat(MATH_QUESTIONS_HK2);
const formulas = [];      // rendered through mathFormula (escaping)
const explanations = [];  // rendered through mathRich (trusted tags)
for (const q of banks) {
    const push = (field, s) => { if (typeof s === 'string' && TYPESET.test(mathFormula(s))) formulas.push({ id: q.id, field, s }); };
    push('q', q.q);
    push('answer', q.answer);
    (q.options || []).forEach((o, i) => push('option' + i, o));
    if (typeof q.explanation === 'string' && TYPESET.test(mathRich(q.explanation))) explanations.push({ id: q.id, s: q.explanation });
}
const stats = { exact: 0, normal: 0, bad: [], caretOnly: [], xExact: 0, xNormal: 0, xBad: [] };
for (const f of formulas) {
    const got = plain(mathFormula(f.s));
    if (got === f.s) stats.exact++;
    else if (canon(got) === canon(f.s)) {
        stats.normal++;
        if (!/\^|mũ\s*\(/.test(f.s)) stats.caretOnly.push(Object.assign({ got }, f));
    } else stats.bad.push(Object.assign({ got }, f));
}
for (const x of explanations) {
    const got = plain(mathRich(x.s));
    const want = visible(x.s);
    if (got === want) stats.xExact++;
    else if (canon(got) === canon(want)) stats.xNormal++;
    else stats.xBad.push({ id: x.id, got, want });
}

suite('math-copy: round trip of every formula in js/math-data.js + js/math-data-hk2.js', () => {
    test(`the banks hold ${banks.length} questions; ${formulas.length} stems/options/answers and ${explanations.length} explanations are typeset`, () => {
        assert.equal(banks.length, MATH_QUESTIONS.length + MATH_QUESTIONS_HK2.length);
        assert.truthy(formulas.length > 1000, 'the typeset filter found almost nothing — is the renderer emitting the classes this test expects?');
        assert.truthy(explanations.length > 300);
    });
    test(`stems/options/answers: ${stats.exact} copy back byte for byte, ${stats.normal} in caret→Unicode normal form, ${stats.bad.length} wrong`, () => {
        assert.deepEqual(stats.bad.slice(0, 10), [], `${stats.bad.length} formulas do not survive copy`);
        assert.equal(stats.exact + stats.normal, formulas.length);
    });
    test('the only strings that change on copy are the ones written with ^ or mũ', () => {
        assert.deepEqual(stats.caretOnly.slice(0, 10), []);
    });
    test(`explanations (mathRich): ${stats.xExact} copy as their visible text, ${stats.xNormal} in normal form, ${stats.xBad.length} wrong`, () => {
        assert.deepEqual(stats.xBad.slice(0, 5), [], `${stats.xBad.length} explanations do not survive copy`);
        assert.equal(stats.xExact + stats.xNormal, explanations.length);
    });
    test('no copied formula anywhere in the banks contains a line break or a lone slash', () => {
        const offenders = [];
        for (const f of formulas) {
            const got = plain(mathFormula(f.s));
            if (/\n/.test(got)) offenders.push(f.id + '/' + f.field);
        }
        for (const x of explanations) {
            if (/^\/$/m.test(plain(mathRich(x.s)))) offenders.push(x.id + '/explanation');
        }
        assert.deepEqual(offenders.slice(0, 10), []);
    });
    test('every explanation card the app builds copies with its formulas whole', () => {
        // mathExplanationHTML restructures (titles, numbered steps), so this is
        // a structural check rather than a byte round trip.
        const offenders = [];
        for (const q of banks) {
            if (typeof q.explanation !== 'string') continue;
            const html = mathExplanationHTML(q.explanation, q);
            if (!TYPESET.test(html)) continue;
            const text = plain(html);
            if (/^\/$/m.test(text) || /\n\n/.test(text)) offenders.push(q.id);
            if (/<\/?[a-z]/i.test(text)) offenders.push(q.id + ' (tag leaked)');
        }
        assert.deepEqual(offenders.slice(0, 10), []);
    });
    test('lesson bodies copy with formulas whole and lines only at real breaks', () => {
        const offenders = [];
        for (const l of MATH_LESSONS.concat(MATH_LESSONS_HK2)) {
            const text = plain(mathRich(l.content));
            if (/^\/$/m.test(text)) offenders.push(l.key + ' (lone slash)');
            if (/<\/?[a-z]/i.test(text)) offenders.push(l.key + ' (tag leaked)');
            if (/\n{3}/.test(text)) offenders.push(l.key + ' (blank lines piled up)');
        }
        assert.deepEqual(offenders, []);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
