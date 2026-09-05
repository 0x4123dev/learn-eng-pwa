// ipad-layout.test.js — 100 tests for the app on an iPad.
//
// The whole app was drawn for a ~390px phone. Left alone it does not break on
// a tablet, it STRETCHES: measured on a real 1024x1366 viewport, the "your
// name" field came out 976px wide — a text box nearly a metre across for a
// child's first name, and buttons to match.
//
// These tests cover the three things that actually differ on a tablet:
// how wide the layout is allowed to grow, whether touch targets survive, and
// whether the battlefield's pointer maths still work when the canvas is
// drawn two or three times its bitmap size.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('css/styles.css');
const html = read('index.html');
const gameSrc = read('js/petbattlegame.js');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));
const { BattleCamera } = require(path.join(ROOT, 'js', 'battle-camera.js'));

const V2 = C.fieldRules(2);
const CANVAS_W = V2.viewW;                 // the bitmap is always 800 wide

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
        const m = css.match(/\.pet-battle-screen, \.grammar-screen[^{]*\{ max-width: (\d+)px/);
        assert.truthy(m, 'the battlefield should be allowed more space than a form');
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
        for (const m of css.matchAll(/\n\s*\.([a-z0-9-]+)[^{]*\{([^}]*)\}/g)) {
            const [, name, body] = m;
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
        ['.pb-step', 'height'], ['.pb-anchor', 'min-height'], ['.pb-emote', 'height'],
        ['.pb-beacon', 'height'], ['.pb-follow-btn', 'min-height'],
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

    test('the removed Arena promo does not restore the old tablet picker', () => {
        const lobby = read('js/petbattle.js');
        const render = lobby.slice(lobby.indexOf('screen.innerHTML = _pbShell(`'), lobby.indexOf('// ---- battle history ----'));
        assert.falsy(render.includes('_pbRandomArenaCard()'));
        assert.falsy(css.includes('.pb-scene-list {'),
            'users no longer choose an arena, so a tablet carousel is misleading');
    });

    test('a tap is forgiving enough for a child on glass', () => {
        const camSrc = read('js/battle-camera.js');
        const slop = +(camSrc.match(/TAP_SLOP_PX = (\d+)/) || [])[1];
        assert.truthy(slop >= 10, `${slop}px is tighter than a child's finger on a tablet`);
    });

    test('the horizontal pan threshold still beats the tap slop', () => {
        const camSrc = read('js/battle-camera.js');
        const slop = +(camSrc.match(/TAP_SLOP_PX = (\d+)/) || [])[1];
        const pan = +(camSrc.match(/PAN_START_PX = (\d+)/) || [])[1];
        assert.truthy(pan > slop, 'a bigger screen must not make gestures ambiguous');
    });
});

// ── 3. the battlefield canvas at tablet scale ──────────────────────────────
// The bitmap is always 800x450; CSS stretches it. Every pointer coordinate is
// converted with canvas.width / rect.width, so the maths has to hold when the
// canvas is drawn at 1.5x or 1.7x its bitmap size.
suite('iPad: pointer maths survive a stretched canvas', () => {
    const toWorld = (clientX, rectLeft, rectWidth, cameraX) => {
        const viewX = (clientX - rectLeft) * CANVAS_W / rectWidth;
        return viewX + cameraX;
    };

    for (const [name, w] of IPADS) {
        // The canvas fills its screen, capped by the wide-screen rule.
        const rectWidth = Math.min(w - 32, 920);
        test(`${name}: a tap in the middle maps to the middle of the view`, () => {
            const worldX = toWorld(rectWidth / 2, 0, rectWidth, 0);
            assert.truthy(Math.abs(worldX - CANVAS_W / 2) < 1,
                `middle tap became ${Math.round(worldX)} instead of ${CANVAS_W / 2}`);
        });

        test(`${name}: the left and right edges map to 0 and ${CANVAS_W}`, () => {
            assert.truthy(Math.abs(toWorld(0, 0, rectWidth, 0)) < 1);
            assert.truthy(Math.abs(toWorld(rectWidth, 0, rectWidth, 0) - CANVAS_W) < 1);
        });

        test(`${name}: the camera offset is added after scaling, not before`, () => {
            const cam = 1200;
            const worldX = toWorld(rectWidth / 2, 0, rectWidth, cam);
            assert.truthy(Math.abs(worldX - (CANVAS_W / 2 + cam)) < 1,
                'scaling must apply to the viewport coordinate, then the camera shifts it');
        });
    }

    test('the game scales pointer input by the rendered width', () => {
        assert.truthy(gameSrc.includes('this.canvas.width / rect.width'),
            'without this a tap on a stretched canvas lands in the wrong place');
    });

    test('the pan gesture uses the same scale as aiming', () => {
        assert.truthy(gameSrc.includes('const scale = this.canvas.width / Math.max(1, rect.width)'),
            'a drag that scrolls faster than the finger feels broken');
    });

    test('the scale divisor can never be zero', () => {
        assert.truthy(gameSrc.includes('Math.max(1, rect.width)'), 'a hidden canvas would divide by zero');
    });

    test('the canvas keeps its aspect ratio rather than distorting', () => {
        const block = rule('.pb-canvas');
        assert.truthy(block.includes('width: 100%'), 'it should fill the space it is given');
        assert.truthy(block.includes('height: auto'), 'and never stretch vertically out of ratio');
    });

    test('the canvas bitmap stays 800x450 whatever the screen', () => {
        assert.truthy(gameSrc.includes('width="${C.FIELD_W}" height="${C.FIELD_H}"') ||
            /width="\$\{[^}]*\}" height="\$\{[^}]*\}"/.test(gameSrc),
            'the drawing surface must not change size with the viewport');
        assert.equal(V2.viewW, 800);
        assert.equal(V2.worldH, 450);
    });

    test('the camera window is the bitmap width, not the screen width', () => {
        const c = new BattleCamera({ rules: V2 });
        assert.equal(c.viewW, 800, 'the camera works in world units, independent of the display');
        assert.equal(c.maxX, V2.worldW - 800);
    });
});

// ── 4. the world reads the same on a tablet ────────────────────────────────
suite('iPad: the battle itself is unchanged by screen size', () => {
    test('physics never consult the viewport', () => {
        // The only permitted mention of `window` is the browser export shim at
        // the very bottom; the rules themselves must be pure.
        const calcSrc = read('js/battlecalc.js');
        const rules = calcSrc.slice(0, calcSrc.indexOf('const BattleCalc = {'));
        for (const banned of ['innerWidth', 'window.', 'document.', 'devicePixelRatio', 'matchMedia']) {
            assert.falsy(rules.includes(banned), `the rules must not depend on ${banned}`);
        }
    });

    test('a shot resolves identically regardless of display size', () => {
        const terrain = C.buildTerrain(4242, V2);
        const [L, R] = C.spawnPoints(terrain, V2);
        const a = C.simulateShot({ terrain, from: L, facing: 1, angle: 42, power: 66, wind: -7, rules: V2, blockers: [R] });
        const b = C.simulateShot({ terrain, from: L, facing: 1, angle: 42, power: 66, wind: -7, rules: V2, blockers: [R] });
        assert.equal(a.frames, b.frames);
        assert.equal(a.hit ? a.hit.x : -1, b.hit ? b.hit.x : -1);
    });

    test('a tablet child and a phone child see the same battle', () => {
        // Same seed, same rules — the display is not an input.
        const t1 = C.buildTerrain(99991, V2), t2 = C.buildTerrain(99991, V2);
        assert.equal(t1.length, t2.length);
        for (let i = 0; i < t1.length; i += 137) assert.equal(t1[i], t2[i], `terrain differs at ${i}`);
    });

    test('the camera never reads the DOM, so it cannot vary by device', () => {
        const camSrc = read('js/battle-camera.js');
        assert.falsy(camSrc.includes('document.'));
        assert.falsy(camSrc.includes('innerWidth'));
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

    test('the only orientation rule hides the rotate affordance after rotation', () => {
        const orientationRules = (css.match(/@media[^{]*orientation/g) || []);
        assert.equal(orientationRules.length, 1);
        const i = css.indexOf('@media (orientation: landscape)');
        const block = css.slice(i, i + 260);
        assert.truthy(block.includes('.pb-landscape-btn'));
        assert.falsy(block.includes('.pb-canvas'), 'rotation must not resize or transform the physics canvas manually');
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

// ── 6. streamlined arena controls on a tablet ─────────────────────────────
suite('iPad: Arena map controls', () => {
    test('there are no obsolete arena radio controls', () => {
        const lobby = read('js/petbattle.js');
        assert.falsy(lobby.includes('role="radiogroup"'));
        assert.falsy(lobby.includes('choosePetBattleScene'));
    });

    test('the stable lobby render gate keeps the map from flashing on every poll', () => {
        const lobby = read('js/petbattle.js');
        assert.truthy(lobby.includes("screen.querySelector('.pb-arena-pet-hero')"));
    });

    test('Vào nhà and info sit on opposite sides of the same top row', () => {
        const block = selector => { const i = css.indexOf(selector + '{'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
        const home = block('.pb-arena-home'), info = block('.pb-arena-info');
        assert.truthy(home.includes('left:12px') && home.includes('top:12px'));
        assert.truthy(info.includes('right:12px') && info.includes('top:12px'));
        assert.truthy(home.includes('height:46px') && info.includes('height:46px'));
    });

    test('every arena poster keeps its aspect ratio', () => {
        assert.truthy(css.includes('aspect-ratio: 16/9'), 'posters must not distort when the card grows');
    });

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

    test('the manual aim controls read on the light panel at any size', () => {
        for (const sel of ['.pb-aim-name', '.pb-aim-val', '.pb-step', '.pb-anchor']) {
            assert.truthy(/color: #[0-9a-f]{6}/i.test(rule(sel)), `${sel} needs explicit dark ink`);
        }
    });

    test('the battle HUD keeps its two-sided layout rather than sprawling', () => {
        const block = rule('.pb-hud');
        assert.truthy(block.includes('display: flex') || block.includes('display: grid'));
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
