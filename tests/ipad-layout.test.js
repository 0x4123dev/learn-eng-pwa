// ipad-layout.test.js — the app on an iPad.
//
// The whole app was drawn for a ~390px phone. Left alone it does not break on
// a tablet, it STRETCHES: measured on a real 1024x1366 viewport, the "your
// name" field came out 976px wide — a text box nearly a metre across for a
// child's first name, and buttons to match.
//
// These tests cover the two things that actually differ on a tablet: how
// wide the layout is allowed to grow, and whether touch targets survive.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = require('./css-all').readAllCss();
const html = read('index.html');

// Every iPad the app is likely to meet, both ways round.
const IPADS = [
    ['iPad mini portrait', 744, 1133], ['iPad mini landscape', 1133, 744],
    ['iPad 10.2 portrait', 810, 1080], ['iPad 10.2 landscape', 1080, 810],
    ['iPad Air portrait', 820, 1180], ['iPad Air landscape', 1180, 820],
    ['iPad Pro 11 portrait', 834, 1194], ['iPad Pro 11 landscape', 1194, 834],
    ['iPad Pro 12.9 portrait', 1024, 1366], ['iPad Pro 12.9 landscape', 1366, 1024],
];
// Split-view and Slide Over widths a child can land in by accident.
const SPLITS = [['Slide Over', 320], ['half split', 507], ['two-thirds split', 678]];

const rule = (selector) => {
    const i = css.indexOf(selector + ' {');
    return i < 0 ? null : css.slice(i, css.indexOf('}', i));
};
const WIDE_BREAKPOINT = 700;

// ── 1. the layout stops growing ────────────────────────────────────────────
suite('iPad: the layout is capped, not stretched', () => {
    test('a wide-screen breakpoint exists', () => {
        assert.truthy(css.includes('@media (min-width: 700px)'), 'nothing distinguishes a tablet from a phone');
    });

    test('screens are capped and centred above the breakpoint', () => {
        const i = css.indexOf('@media (min-width: 700px) {');
        const block = css.slice(i, i + 600);
        assert.truthy(/\.screen\s*\{[^}]*max-width:\s*(\d+)px/.test(block), 'screens must stop growing');
        assert.truthy(block.includes('margin-inline: auto'), 'and sit in the middle, not against the left edge');
    });

    test('the cap is comfortable rather than phone-sized', () => {
        const m = css.match(/@media \(min-width: 700px\) \{[\s\S]*?\.screen \{ max-width: (\d+)px/);
        assert.truthy(m, 'screen cap not found');
        const capPx = +m[1];
        assert.truthy(capPx >= 560, `${capPx}px would waste an iPad`);
        assert.truthy(capPx <= 820, `${capPx}px is wide enough to look stretched again`);
    });

    test('screens that need room get a wider cap', () => {
        // The Word screen (class topics-screen in index.html) draws a card
        // grid, so it is allowed more space than a form.
        assert.truthy(/class="screen topics-screen[^"]*" id="wordScreen"/.test(html), 'the Word screen carries the wide class');
        const m = css.match(/\.topics-screen[^{]*\{ max-width: (\d+)px/);
        assert.truthy(m, 'the card grid should be allowed more space than a form');
        assert.truthy(+m[1] > 680, 'a wider cap must actually be wider');
    });

    for (const [name, w] of IPADS.map(x => [x[0], x[1]])) {
        test(`${name} (${w}px wide) is above the breakpoint, so the cap applies`, () => {
            assert.truthy(w >= WIDE_BREAKPOINT, `${w}px would still stretch`);
        });
    }

    for (const [name, w] of SPLITS) {
        test(`${name} (${w}px) falls back to the phone layout, not a broken hybrid`, () => {
            assert.truthy(w < WIDE_BREAKPOINT || w >= WIDE_BREAKPOINT,
                'either side of the breakpoint is fine; what matters is that one applies');
            // A split view narrower than the breakpoint must still be usable.
            if (w < WIDE_BREAKPOINT) assert.truthy(w >= 320, 'the app supports 320px');
        });
    }

    // A fixed width is only dangerous when nothing caps it: `width: 340px`
    // beside `max-width: 90%` is fine on a 320px split view.
    test('no fixed width is left uncapped', () => {
        const offenders = [];
        // The Night Raid estate map is a pannable, pinch-zoomed 1180px surface
        // inside an overflow:hidden stage (js/night-raid.js applyViewZoom
        // scales it to fit) — a fixed size by design, not a layout that
        // overflows a split view. It only became visible to this scan when the
        // stylesheet split (css/night-raid.css) put the rule on its own line.
        const PANNED = new Set(['nr-builder-map']);
        for (const m of css.matchAll(/\n\s*\.([a-z0-9-]+)[^{]*\{([^}]*)\}/g)) {
            const [, name, body] = m;
            if (PANNED.has(name)) continue;
            const w = body.match(/(?:^|[;\s])width:\s*(\d{3,})px/);
            if (!w || +w[1] <= 320) continue;
            if (/max-width/.test(body)) continue;           // capped, so it can shrink
            offenders.push(`${name}:${w[1]}`);
        }
        assert.equal(offenders.join(', '), '', 'these cannot shrink on a 320px split view');
    });

    test('the viewport meta covers the notch and the safe area', () => {
        assert.truthy(html.includes('viewport-fit=cover'), 'an iPad Pro needs safe-area insets honoured');
        assert.truthy(html.includes('width=device-width'));
        assert.truthy(html.includes('initial-scale=1.0'));
    });

    test('safe-area insets are actually used, not just requested', () => {
        assert.truthy(css.includes('--safe-area-top') || css.includes('env(safe-area-inset'),
            'viewport-fit=cover without insets leaves content under the status bar');
    });

    test('the app owns the top safe area exactly once', () => {
        // "The stylesheet mentions env(safe-area-inset) somewhere" was the only
        // check here, and it stayed green while the homepage header sat at
        // 8-52px on a phone whose status bar is 47-59px tall — the whole header
        // was swallowed and only a rubber-band pull revealed it. Each bar that
        // a finger has to reach at the top of a screen is named here instead.
        // The homepage is deliberately absent: its garden runs full-bleed to
        // the top edge and carries nothing a finger needs — the pet bar moved
        // out to a card of its own, and the dog is kept to the middle of the
        // garden (see tests/home-yard-layout.test.js).
        const TOP_BARS = [
            ['.nr-topbar', 'the Night Raid title bar'],
            ['.nr-builder-hud', 'the build screen DAM/DEF/coins strip'],
        ];
        // The Night Raid stylesheet is minified (`.nr-topbar{`), the older rules
        // are not (`.pet-hero-topbar {`) — match either. A bar usually has
        // several rules (a landscape tweak, a narrow-screen tweak); the one that
        // decides where it sits is the one that positions it.
        const blockFor = sel => {
            const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}', 'g');
            const blocks = css.match(re) || [];
            return blocks.find(b => /position:/.test(b)) || blocks[0] || null;
        };
        const appBlock = blockFor('.app');
        assert.truthy(appBlock && /padding-top:\s*var\(--safe-area-top\)/.test(appBlock),
            'the app shell must clear the status bar for every child screen');
        for (const [sel, what] of TOP_BARS) {
            const block = blockFor(sel);
            assert.truthy(block, `${sel} has no rule at all`);
            assert.falsy(/safe-area-inset-top/.test(block),
                `${what} (${sel}) double-counts the notch and falls into the middle of the screen`);
        }
    });
});

// ── 2. touch targets on a big screen ───────────────────────────────────────
suite('iPad: everything stays comfortably tappable', () => {
    const TAPPABLE = [
        ['.nav-item', 'min-height'],
    ];
    for (const [sel, prop] of TAPPABLE) {
        test(`${sel} keeps a 44px target`, () => {
            const block = rule(sel);
            assert.truthy(block, `${sel} has no styles`);
            const m = block.match(new RegExp(prop + ':\\s*(\\d+)px'));
            assert.truthy(m, `${sel} has no ${prop}`);
            assert.truthy(+m[1] >= 44, `${sel} is only ${m[1]}px`);
        });
    }

    test('the wide breakpoint never shrinks a touch target', () => {
        const i = css.indexOf('@media (min-width: 700px) {');
        const block = css.slice(i, i + 900);
        const shrinks = [...block.matchAll(/(min-)?height:\s*(\d+)px/g)].filter(m => +m[2] < 44 && +m[2] > 0);
        assert.equal(shrinks.map(m => m[0]).join(', '), '', 'a tablet must not get smaller buttons than a phone');
    });
});

// ── 5. orientation and split view ──────────────────────────────────────────
suite('iPad: rotating and splitting the screen', () => {
    for (const [name, w, h] of IPADS) {
        test(`${name}: no dimension is below the supported minimum`, () => {
            assert.truthy(Math.min(w, h) >= 320, `${Math.min(w, h)}px is narrower than the app supports`);
        });
    }

    for (const [name, w] of SPLITS) {
        test(`${name} at ${w}px is still a supported width`, () => {
            assert.truthy(w >= 320, 'Slide Over is 320px — the narrowest case the app must handle');
        });
    }

    test('a 320px layout is explicitly catered for', () => {
        assert.truthy(css.includes('@media (max-width: 360px)') || css.includes('@media (max-width: 380px)'),
            'the narrowest split view needs the small-screen rules');
    });

    test('the small-screen rules shrink padding, never touch targets', () => {
        const i = css.indexOf('@media (max-width: 380px)');
        const block = css.slice(i, css.indexOf('}\n        }', i) + 3);
        assert.falsy(/height:\s*(3\d|2\d|1\d)px/.test(block), 'a cramped screen must not get unusable buttons');
    });

    test('the bottom nav is a flex child, not a hardcoded reservation', () => {
        // A nav pinned with a hardcoded height forces every screen to reserve
        // exactly that many pixels — which breaks the moment the viewport
        // changes, which on an iPad it does constantly.
        const nav = rule('.bottom-nav');
        assert.truthy(nav.includes('flex-shrink: 0'), 'the nav must hold its size as a flex child');
        assert.falsy(/position:\s*fixed/.test(nav), 'a fixed nav needs a matching hardcoded reservation');
    });
});

// ── 6. the farm builder on a tablet ────────────────────────────────────────
suite('iPad: farm builder controls', () => {
    test('entering home cannot strand the shop menu in phone rotation mode', () => {
        const raid = read('js/night-raid.js');
        assert.truthy(raid.includes("builderMenuOpen=false;builderRotated=false;if(typeof switchScreen"),
            'Vào nhà must reset the synthetic phone rotation before rendering');
        assert.truthy(css.includes('@media(min-width:701px){\n    .nr-builder-rotate{display:none!important}'),
            'the phone-only rotate button must not appear on iPad');
        assert.truthy(css.includes('.nr-builder.menu-closed .nr-builder-menu-toggle{top:calc(114px'),
            'the closed ellipsis remains in the first safe rail slot');
    });
});

// ── 7. text stays readable, not gigantic ───────────────────────────────────
suite('iPad: type and spacing hold up', () => {
    test('the wide breakpoint does not blow up font sizes', () => {
        const i = css.indexOf('@media (min-width: 700px) {');
        const block = css.slice(i, i + 900);
        const huge = [...block.matchAll(/font-size:\s*(\d+)px/g)].filter(m => +m[1] > 28);
        assert.equal(huge.map(m => m[0]).join(', '), '', 'a tablet should not get billboard type');
    });

    test('no body text is below 10px anywhere', () => {
        const tiny = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].filter(m => +m[1] < 9);
        assert.equal(tiny.map(m => m[0]).join(', '), '', 'unreadable type is unreadable on any device');
    });

});

// ── 8. the PWA itself on iPad ──────────────────────────────────────────────
suite('iPad: installing and running as an app', () => {
    test('the manifest exists and is linked', () => {
        assert.truthy(html.includes('rel="manifest"'));
        assert.truthy(fs.existsSync(path.join(ROOT, 'manifest.json')));
    });

    test('an apple touch icon is provided for the home screen', () => {
        assert.truthy(html.includes('apple-touch-icon'), 'iPadOS uses this when a child adds the app');
    });

    test('standalone mode is requested', () => {
        assert.truthy(html.includes('apple-mobile-web-app-capable'));
    });

    test('the status bar style is set for a full-bleed layout', () => {
        assert.truthy(html.includes('apple-mobile-web-app-status-bar-style'));
    });

    test('the manifest icons exist on disk', () => {
        const mf = JSON.parse(read('manifest.json'));
        for (const icon of (mf.icons || [])) {
            const file = icon.src.replace(/^\//, '');
            assert.truthy(fs.existsSync(path.join(ROOT, file)), `manifest icon missing: ${icon.src}`);
        }
    });

    test('the service worker caches the stylesheet the tablet layout depends on', () => {
        assert.truthy(read('sw.js').includes("'/css/styles.css'"), 'an uncached stylesheet means no layout offline');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
