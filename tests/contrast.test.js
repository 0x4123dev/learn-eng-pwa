// contrast.test.js — text must stay readable on the dark screens.
//
// The app has no dark theme; it has dark SURFACES (the speed-challenge
// overlay, the black battle overlay, word hunt). Components styled for the
// light screens get rendered inside them, and when that happens the text can
// vanish — that is how the Verbs listen-hint shipped unreadable, how the
// coins line on the completion screen ended up at 1.17:1, and how the IPA
// line in battle mode ended up at 1.77:1.
//
// These tests compute real WCAG ratios from the stylesheet, so a colour
// change that quietly breaks one of them fails here instead of on a phone.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

// ── colour maths ────────────────────────────────────────────────────────
function parseColor(str) {
    const s = String(str).trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [0, 1, 2].map(i => parseInt(m[1][i] + m[1][i], 16)).concat(1);
    m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m) {
        const p = m[1].split(',').map(v => parseFloat(v.trim()));
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    throw new Error(`cannot parse colour: ${str}`);
}
const composite = (fg, bg) => {
    const a = fg[3];
    return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1);
};
function luminance(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function contrast(fg, bg) {
    const [L1, L2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (L1 + 0.05) / (L2 + 0.05);
}
// Text over a stack of backdrops, painted furthest-first.
function ratioOn(colorStr, layerStrs) {
    let bg = parseColor(layerStrs[0]);
    for (const l of layerStrs.slice(1)) bg = composite(parseColor(l), bg);
    return contrast(composite(parseColor(colorStr), bg), bg);
}

// ── stylesheet lookup ───────────────────────────────────────────────────
function ruleBody(selector) {
    const i = css.indexOf(selector + ' {');
    const j = i === -1 ? -1 : css.indexOf('}', i);
    if (i === -1 || j === -1) throw new Error(`rule not found: ${selector}`);
    return css.slice(i, j);
}
function decl(selector, prop) {
    const m = new RegExp(`(?:^|;|\\{)\\s*${prop}\\s*:\\s*([^;}]+)`, 'm').exec(ruleBody(selector));
    return m ? m[1].trim() : null;
}
const AA = 4.5;
const PAGE = '#f0faf4';   // --bg-primary, what full-screen overlays sit on

suite('contrast: the Verbs completion screen', () => {
    // .speed-complete-overlay is linear-gradient(180deg,#ff6f00,#ff8f00);
    // both stops must work, so each is checked.
    const STOPS = ['#ff6f00', '#ff8f00'];

    test('the coins line is readable on the orange overlay', () => {
        const color = decl('.speed-complete-coins', 'color');
        const chip = decl('.speed-complete-coins', 'background');
        assert.truthy(color, '.speed-complete-coins must declare a colour');
        for (const stop of STOPS) {
            const layers = chip ? [stop, chip] : [stop];
            const r = ratioOn(color, layers);
            assert.truthy(r >= AA,
                `coins line is ${r.toFixed(2)}:1 on ${stop} — dark ink on saturated orange disappears`);
        }
    });
});

suite('contrast: the battle overlay', () => {
    // .battle-game-overlay is rgba(0,0,0,0.85) over the page. .match-card is
    // shared with the light lesson screen, where its translucent white reads
    // as near-white; over black it resolves to grey and the IPA vanishes.
    const OVERLAY = ['#f0faf4', 'rgba(0,0,0,0.85)'];

    test('the word card gives its text an opaque floor in battle mode', () => {
        const cardBg = decl('.battle-matching-grid .match-card', 'background');
        assert.truthy(cardBg, 'battle mode must restate the card background — the shared one is translucent');
        const ipa = decl('.match-card .card-ipa', 'color') === 'var(--text-secondary)'
            ? '#5a7a5e' : decl('.match-card .card-ipa', 'color');
        const r = ratioOn(ipa, OVERLAY.concat([cardBg]));
        assert.truthy(r >= AA, `.card-ipa is ${r.toFixed(2)}:1 inside the battle overlay`);
    });

    test('and the card stays translucent on the light lesson screen', () => {
        // The shared rule must not be hard-coded opaque — the frosted look on
        // the lesson screen is deliberate.
        assert.equal(decl('.match-card', 'background'), 'var(--glass-bg)',
            'fix the battle overlay by scoping it, not by changing the shared card');
    });
});

suite('contrast: the speed challenge inputs', () => {
    const TOP = '#1a237e';   // .speed-game-overlay gradient start

    test('the input placeholder is legible', () => {
        const color = decl('.speed-input-group input::placeholder', 'color');
        assert.truthy(color, 'placeholder colour must be declared');
        const field = decl('.speed-input-group input', 'background') || 'rgba(0,0,0,0)';
        const r = ratioOn(color, [TOP, field]);
        assert.truthy(r >= AA, `placeholder is ${r.toFixed(2)}:1 — below AA on the dark overlay`);
    });
});

suite('contrast: the answer gate stays fixed', () => {
    test('the listen hint keeps its opaque chip', () => {
        // Regression guard for the bug that started this: the hint was a dark
        // blue on a translucent tint, invisible inside the Verbs overlay.
        const bg = decl('.answer-gate', 'background');
        assert.truthy(bg && !/rgba/.test(bg), `.answer-gate background must stay opaque, got ${bg}`);
        const r = ratioOn(decl('.answer-gate-hint', 'color'), ['#3b1f6b', bg]);
        assert.truthy(r >= AA, `hint is ${r.toFixed(2)}:1 on the dark overlay`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
