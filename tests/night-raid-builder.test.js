// night-raid-builder.test.js — the build screen: how big the board opens, and
// whether the castle can actually be picked up.
//
// Three faults this pins, all of them things a child hit and no test saw:
//
//   • The keep could not be dragged at all. The code to drag it was there and
//     looked right; the land grid is simply painted OVER the castle, so every
//     finger that reached for the castle landed on an empty land cell instead.
//   • The board opened at 100%, which on a phone is about a ninth of the land
//     at a time, and it opened on the middle of the map rather than on the
//     child's own castle — so the first thing you saw was empty grass.
//   • The build screen and the homepage yard shared one zoom and one scroll
//     position, so tuning one moved the other.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('js/night-raid.js');
const css = require('./css-all').readAllCss();
const R = require(path.join(root, 'js', 'night-raid-rules.js'));

const ruleFor = re => (css.match(re) || [''])[0];
const zOf = rule => Number((rule.match(/z-index:(\d+)/) || [])[1]);

suite('night raid builder: the castle can be picked up', () => {
    test('the grab handle sits above the land grid, or no tap ever reaches it', () => {
        const pad = ruleFor(/\.nr-castle-pad\{[^}]*\}/);
        const grid = ruleFor(/\.nr-free-grid\{[^}]*\}/);
        assert.truthy(pad, 'there must be a grab handle for the castle');
        assert.truthy(zOf(pad) > zOf(grid),
            `the handle sits at z-index ${zOf(pad)} under a grid at ${zOf(grid)} — this is the original bug`);
    });

    test('the handle is what listens for the drag, not the artwork', () => {
        // The artwork leans over cells the castle does not own; if it took the
        // pointer, taps meant for those cells would vanish into the castle.
        assert.truthy(ui.includes("pad.addEventListener('pointerdown',beginCastleDrag)"),
            'the handle must be the drag surface');
        assert.falsy(/castle\.addEventListener\('pointerdown',beginCastleDrag\)/.test(ui),
            'the artwork must not carry the drag any more');
        const editingArt = ruleFor(/\.nr-builder\.editing \.nr-builder-map>\.nr-equipped-castle\{[^}]*\}/);
        assert.truthy(editingArt.includes('pointer-events:none'), 'the artwork must never take a tap');
    });

    test('the handle covers the ground the castle owns and nothing more', () => {
        // Sized from the footprint, not the picture: the towers overhang.
        assert.truthy(ui.includes('castlePadStyle(castleFootprint('), 'the pad is placed from the footprint');
        assert.truthy(/width:\$\{box\.width/.test(ui) && /height:\$\{box\.height/.test(ui),
            'the pad takes its size from the footprint box');
    });

    test('the pan gesture lets go of a pointer that started on the handle', () => {
        // Otherwise the map scrolls under the finger while the castle is being
        // dragged, and the two fight over the same pointer.
        const skip = (ui.match(/e\.target\.closest\('([^']*\.nr-build-shop[^']*)'\)/) || [])[1] || '';
        assert.truthy(skip.includes('.nr-castle-pad'), `pan skip list is "${skip}"`);
    });

    test('a drag keeps the grip it started with instead of snapping to a corner', () => {
        assert.truthy(ui.includes('grabX=first.cx-start.gx'), 'the horizontal grip is remembered');
        assert.truthy(ui.includes('grabY=first.cy-start.gy'), 'the vertical grip is remembered');
        assert.truthy(/MAX=G-CASTLE_SIZE/.test(ui), 'the keep must not be draggable off the land');
    });
});

suite('night raid builder: the castle is the biggest thing on the board', () => {
    test('three cells square, and every other building is smaller', () => {
        assert.equal(R.CASTLE_SIZE, 3);
        const biggest = Math.max(...R.DEFENSES.map(d => R.footprintFor(d)));
        assert.truthy(R.CASTLE_SIZE > biggest,
            `a ${biggest}-cell building matches the keep — it should tower over them`);
    });

    test('the drawn keep matches the ground it reserves, on the build screen and on Home', () => {
        // The art used to be 18% of the map against a footprint of 12.67%: it
        // looked oversized and sat on ground it did not own.
        const rule = ruleFor(/\.nr-builder-map>\.nr-equipped-castle,\.nr-mini-map>\.nr-equipped-castle\{[^}]*\}/);
        assert.truthy(rule, 'the build screen and the homepage yard must share one castle size');
        const width = Number((rule.match(/width:([\d.]+)%/) || [])[1]);
        const footprint = R.CASTLE_SIZE * 76 / R.BUILD_GRID;   // .nr-free-grid spans 76% of the map
        assert.truthy(Math.abs(width - footprint) < 0.5,
            `the art is ${width}% wide over a ${footprint.toFixed(2)}% footprint`);
    });

    test('the artwork is drawn over the grid lines, not under them', () => {
        const rule = ruleFor(/\.nr-builder-map>\.nr-equipped-castle\{[^}]*--nr-castle-x[^}]*\}/);
        assert.truthy(zOf(rule) > zOf(ruleFor(/\.nr-free-grid\{[^}]*\}/)),
            'white cell borders were being painted straight across the stonework');
    });

    test('the dog walks around the whole keep, not around two cells of it', () => {
        assert.truthy(ui.includes('cw*(CASTLE_SIZE+.25)') && ui.includes('ch*(CASTLE_SIZE+.25)'),
            'the no-walk rectangle must follow the real footprint');
    });

    test('farms and barracks read much larger than tactical defenses', () => {
        const small = ruleFor(/\.nr-build-grid-cell \.nr-placed\.footprint-1\{[^}]*\}/);
        const large = ruleFor(/\.nr-build-grid-cell \.nr-placed\.footprint-2\.producer\{[^}]*\}/);
        const smallWidth = Number((small.match(/width:([\d.]+)%/) || [])[1]);
        const largeWidth = Number((large.match(/width:([\d.]+)%/) || [])[1]);
        assert.truthy(smallWidth <= 100, `one-cell defenses render at ${smallWidth}% instead of fitting their tile`);
        assert.truthy(largeWidth >= smallWidth * 2.2,
            `a ${largeWidth}% facility is not clearly larger than a ${smallWidth}% defense`);
    });
});

suite('night raid builder: the board opens small enough to see', () => {
    test('it opens at 60%, and land cells stay big enough for a fingertip', () => {
        const start = Number((ui.match(/BUILDER_START_ZOOM=([\d.]+)/) || [])[1]);
        assert.equal(start, .6, 'the build screen opens zoomed out');
        // A phone board is 1600 x 1200 css px before zoom; the grid covers 76%
        // across and 80% down, twelve cells each way.
        const base = 1600, w = .76 * base * start / 12, h = .80 * base * .75 * start / 12;
        assert.truthy(w >= 44 && h >= 44, `a land cell would be ${w.toFixed(0)} x ${h.toFixed(0)} css px`);
    });

    test('Home and Builder share one zooming estate and endless meadow camera', () => {
        assert.truthy(ui.includes('ESTATE_MIN_ZOOM=.03,ESTATE_MAX_ZOOM=4'), 'the camera must support very wide free zoom');
        assert.truthy(ui.includes('return {min:ESTATE_MIN_ZOOM,max:ESTATE_MAX_ZOOM}'),
            'Home and Builder must share the same meadow camera range');
        assert.truthy(css.includes('place-content:safe center'),
            'the tiny estate must remain centred and recoverable');
        assert.truthy(css.includes('endless-meadow-tile-v2.jpg') && css.includes('background-repeat:repeat'),
            'the world around the fence must be an effectively endless meadow in either orientation');
        assert.truthy(css.includes('background-size:var(--nr-ground-size,2048px)') && ui.includes('Math.round(MEADOW_TILE_SIZE*builderZoom)'),
            'the meadow texture must scale with the same camera zoom as the estate');
        assert.truthy(ui.includes("plane.className='nr-world-plane'") && ui.includes('plane.appendChild(map)'),
            'the meadow and estate must be children of one real scroll plane');
        assert.truthy(ui.includes('WORLD_PLANE_SIZE=32768') && ui.includes("plane.style.width=WORLD_PLANE_SIZE+'px'"),
            'the lightweight meadow plane must be effectively unreachable without allocating a giant bitmap');
        assert.truthy(ui.includes('viewport.scrollLeft+cx-plane.offsetWidth/2') && ui.includes('worldX*newZoom'),
            'zoom anchoring must preserve the logical point around the shared world centre');
        assert.truthy(ui.includes('isometric-home-board-frame-v4.webp'),
            'the full estate must use a true-alpha frame instead of a second opaque lawn');
        assert.truthy(css.includes('.nr-estate-map{isolation:auto') && css.includes('-webkit-clip-path:none') && css.includes('clip-path:none'),
            'the transparent frame must not be cut into another visible rectangle on Safari');
        assert.truthy(css.includes('mix-blend-mode:normal'),
            'the one meadow texture must show through the transparent frame without colour blending');
    });

    test('zoom and scroll are remembered per screen', () => {
        // Two buckets now that the raid stage is gone: the home yard and the
        // builder. Neither may borrow the other's camera.
        assert.truthy(ui.includes('builderZoomByView={home:1,builder:BUILDER_START_ZOOM}'));
        assert.truthy(ui.includes('builderScrollByView={home:null,builder:null}'));
        assert.truthy(/viewKey=v=>\(v==='builder'\?'builder':'home'\)/.test(ui), 'only home and builder buckets remain');
        assert.falsy(/nr-scout-map|'scout'|'battle'/.test(ui), 'no raid camera bucket survives in the builder');
        assert.truthy(ui.includes('applyViewZoom(view)'), 'each render must pick up its own screen\'s zoom');
    });

    test('it opens on the castle, and does not decide that before the screen has a size', () => {
        assert.truthy(ui.includes('castleFootprint(appState.nightRaidLayout)'), 'the opening view centres on the keep');
        assert.truthy(ui.includes('viewport.clientWidth<40'),
            'a zero-width viewport would compute a scroll of zero and then remember it');
        // rAF does not fire on a backgrounded tab, so the first attempt has to
        // be synchronous or nothing is ever placed there.
        assert.truthy(/place\(\);\s*if\(!placed\)requestAnimationFrame\(place\)/.test(ui),
            'placement must be tried straight away, with the frame as a fallback');
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
