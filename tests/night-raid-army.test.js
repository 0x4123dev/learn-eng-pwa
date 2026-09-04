// The parade on the home lawn is how a child checks their army: they harvest a
// barracks and go count the soldiers standing on the grass.
//
// It stopped being countable. The slots were 4.25% apart horizontally and 4.2%
// vertically while a soldier sprite covers 7.8% of the width and 6.93% of the
// height, so each rank sat a third of a body inside the one in front. Four
// soldiers read as two — reported from a real account.
//
// These tests are geometric, not textual: they lay the slots out with the same
// sprite box the CSS uses and assert that no two soldiers overlap.
'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const NR = require('../js/night-raid-rules.js');
const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

// A soldier is positioned by its bottom centre: CSS translate(-50%, -100%).
// x is a percentage of the yard's width, y of its height.
function boxes(count) {
    return NR.armySlots(count).map(s => ({
        left: s.x - NR.ARMY_SPRITE_W / 2,
        right: s.x + NR.ARMY_SPRITE_W / 2,
        top: s.y - NR.ARMY_SPRITE_H,
        bottom: s.y,
    }));
}
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

suite('night raid: the army can be counted', () => {
    test('one slot per soldier, for every squad size', () => {
        for (let n = 0; n <= NR.ARMY_DISPLAY_CAP; n++) {
            assert.equal(NR.armySlots(n).length, n, `${n} soldiers must produce ${n} slots`);
        }
    });

    test('no two soldiers overlap at any squad size', () => {
        for (let n = 2; n <= NR.ARMY_DISPLAY_CAP; n++) {
            const b = boxes(n);
            for (let i = 0; i < b.length; i++) {
                for (let j = i + 1; j < b.length; j++) {
                    assert.falsy(overlaps(b[i], b[j]),
                        `${n} soldiers: #${i + 1} and #${j + 1} overlap — the child would count fewer than ${n}`);
                }
            }
        }
    });

    // The specific case that was reported.
    test('four soldiers stand four abreast, none hidden behind another', () => {
        const slots = NR.armySlots(4);
        assert.equal(slots.length, 4);
        assert.equal(new Set(slots.map(s => s.y)).size, 1, 'four soldiers fit in one rank');
        const xs = slots.map(s => s.x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
            assert.truthy(xs[i] - xs[i - 1] >= NR.ARMY_SPRITE_W,
                `gap ${(xs[i] - xs[i - 1]).toFixed(2)}% is narrower than the ${NR.ARMY_SPRITE_W}% sprite`);
        }
    });

    test('the steps stay wider than the sprite the CSS actually draws', () => {
        // .nr-home-soldier is 6.4% wide, .nr-mini-map .nr-home-soldier 7.8%;
        // aspect-ratio 1.5 on a 4:3 map. If the CSS grows the sprite, the
        // spacing has to grow with it or the ranks merge again.
        const widths = [...css.matchAll(/\.nr-home-soldier\{[^}]*?width:([\d.]+)%/g)]
            .concat([...css.matchAll(/\.nr-mini-map \.nr-home-soldier\{[^}]*?width:([\d.]+)%/g)])
            .map(m => parseFloat(m[1]));
        assert.truthy(widths.length >= 2, 'could not read the soldier width out of the CSS');
        const widest = Math.max(...widths);
        assert.equal(NR.ARMY_SPRITE_W, widest,
            'ARMY_SPRITE_W must match the widest .nr-home-soldier rule in css/styles.css');
        assert.truthy(css.includes('aspect-ratio:1.5'), 'the sprite is no longer 1.5× wider than tall');
        assert.truthy(NR.ARMY_GAP >= NR.ARMY_SPRITE_W, 'the rank step is narrower than a soldier');
        assert.truthy(NR.ARMY_ROW_STEP >= NR.ARMY_SPRITE_H, 'the second rank sits inside the first');
    });

    test('the whole squad stays on the lawn', () => {
        // The anchor is --nr-army-x:28% / --nr-army-y:82%, and .nr-yard-army
        // clips to the map, so a wide parade must not run off the edge.
        const anchor = css.match(/--nr-army-x:([\d.]+)%/), anchorY = css.match(/--nr-army-y:([\d.]+)%/);
        assert.truthy(anchor && anchorY, 'the squad anchor is missing from the CSS');
        const ax = parseFloat(anchor[1]), ay = parseFloat(anchorY[1]);
        for (const b of boxes(NR.ARMY_DISPLAY_CAP)) {
            assert.truthy(ax + b.left >= 0, 'the left flank marches off the map');
            assert.truthy(ax + b.right <= 100, 'the right flank marches off the map');
            assert.truthy(ay + b.top >= 0 && ay + b.bottom <= 100, 'the squad leaves the lawn vertically');
        }
    });
});
