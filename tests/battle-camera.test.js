// battle-camera.test.js — the window onto the long battlefield.
//
// The camera is the one part of the long world that can quietly ruin a
// deterministic game, so the properties asserted here are mostly about what it
// must NOT do: never leave the world, never fight the finger dragging it, and
// never touch anything the physics reads.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { BattleCamera, classifyGesture, PAN_START_PX, TAP_SLOP_PX } =
    require(path.join(__dirname, '..', 'js', 'battle-camera.js'));
const C = require(path.join(__dirname, '..', 'js', 'battlecalc.js'));

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);
const cam = (rules, opts) => new BattleCamera(Object.assign({ rules: rules || V2 }, opts || {}));

suite('camera: it never leaves the world', () => {
    test('a long world can pan exactly the overhang', () => {
        const c = cam(V2);
        assert.equal(c.maxX, 1200, '2000 world minus an 800 window');
        assert.truthy(c.isPannable());
    });

    test('a single-screen world cannot pan at all', () => {
        const c = cam(V1);
        assert.equal(c.maxX, 0);
        assert.falsy(c.isPannable(), 'v1 must stay exactly as it was');
        c.panBy(500);
        assert.equal(c.x, 0, 'there is nowhere to go on one screen');
    });

    test('panning clamps at both ends instead of running off', () => {
        const c = cam(V2);
        c.panBy(-9999); assert.equal(c.x, 0);
        c.panBy(9999); assert.equal(c.x, 1200);
    });

    test('focusing on either castle stays inside the world', () => {
        const c = cam(V2);
        for (const worldX of [140, 1860, 0, 2000, -500, 99999]) {
            c.focusOn(worldX, { instant: true });
            assert.truthy(c.x >= 0 && c.x <= c.maxX, `focus on ${worldX} left the world at ${c.x}`);
        }
    });

    test('junk input never corrupts the position', () => {
        const c = cam(V2);
        c.focusOn(600, { instant: true });
        const before = c.x;
        for (const bad of [NaN, Infinity, -Infinity, undefined, null]) {
            assert.equal(c.clamp(bad), before, `clamp(${bad}) must keep the last good value`);
        }
    });
});

suite('camera: following a shot', () => {
    test('a point inside the dead zone does not move the camera', () => {
        const c = cam(V2);
        c.focusOn(540, { instant: true });                 // camera at 140
        const before = c.targetX;
        c.follow(c.x + 400, 1);                            // dead centre of the view
        assert.equal(c.targetX, before, 'a twitchy camera is worse than a still one');
    });

    test('a point leaving the dead zone pulls the camera along', () => {
        const c = cam(V2);
        c.focusOn(540, { instant: true });
        c.follow(c.x + 700, 1);                            // well past the right edge
        assert.truthy(c.targetX > c.x, 'the camera must chase the shot');
    });

    test('the camera leads the shot rather than trailing it', () => {
        const c = cam(V2);
        c.focusOn(540, { instant: true });
        const rightward = c.follow(c.x + 700, 1);
        c.focusOn(540, { instant: true });
        const leftward = c.follow(c.x + 700, -1);
        assert.truthy(rightward > leftward, 'look-ahead must depend on travel direction');
    });

    // The rule that keeps the camera from feeling possessed.
    test('a manual pan cancels follow, and follow cannot steal it back', () => {
        const c = cam(V2);
        c.focusOn(540, { instant: true });
        c.panBy(300);
        const held = c.targetX;
        c.follow(1900, 1);
        assert.equal(c.mode, 'manual', 'the child is in charge until they say otherwise');
        assert.equal(c.targetX, held, 'follow must not drag the view back');
    });

    test('an impact hold frames the struck castle for its full duration', () => {
        const c = cam(V2);
        c.holdOn(1860, 800, 1000);
        assert.equal(c.mode, 'impact-hold');
        assert.truthy(c.isHolding(1500), 'still reading the damage');
        assert.falsy(c.isHolding(1900), 'hold must expire');
    });
});

suite('camera: motion is smooth, bounded and refresh-rate independent', () => {
    test('easing converges on the target and then stops', () => {
        const c = cam(V2);
        c.focusOn(1860);
        let ticks = 0;
        while (!c.settled() && ticks < 600) { c.update(1); ticks++; }
        assert.truthy(c.settled(), `never settled after ${ticks} ticks`);
        assert.equal(c.x, c.targetX);
        assert.truthy(ticks < 120, `took ${ticks} ticks — too sluggish to follow a shot`);
    });

    test('elapsed time drives travel, so 120Hz matches 60Hz', () => {
        const a = cam(V2); a.focusOn(1860);
        const b = cam(V2); b.focusOn(1860);
        for (let i = 0; i < 30; i++) a.update(1);          // 30 ticks at 60Hz
        for (let i = 0; i < 60; i++) b.update(0.5);        // 60 frames at 120Hz
        assert.truthy(Math.abs(a.x - b.x) < 12,
            `60Hz reached ${Math.round(a.x)}, 120Hz reached ${Math.round(b.x)}`);
    });

    test('reduced motion cuts instead of gliding', () => {
        const c = cam(V2, { reducedMotion: true });
        c.focusOn(1860);
        assert.equal(c.x, c.targetX, 'no travel animation at all');
        c.follow(400, -1);
        assert.equal(c.x, c.targetX);
        // …but navigation still works.
        c.panBy(-200);
        assert.truthy(c.x < c.targetX + 1);
    });
});

suite('camera: coordinates and offscreen cues', () => {
    test('screen and world coordinates round-trip', () => {
        const c = cam(V2);
        c.focusOn(1000, { instant: true });
        for (const worldX of [0, 140, 1000, 1860, 1999]) {
            assert.equal(Math.round(c.toWorldX(c.toScreenX(worldX))), worldX);
        }
    });

    test('the beacon points the right way to an offscreen castle', () => {
        const c = cam(V2);
        c.focusOn(140, { instant: true });                 // watching my own castle
        assert.equal(c.offscreenSide(1860), 1, 'the opponent is off to the right');
        assert.equal(c.offscreenSide(140), 0, 'my castle is on screen');
        c.focusOn(1860, { instant: true });
        assert.equal(c.offscreenSide(140), -1, 'now my castle is off to the left');
    });

    test('culling covers the screen plus a margin, never past the world edge', () => {
        const c = cam(V2);
        c.focusOn(140, { instant: true });
        let r = c.visibleRange();
        assert.equal(r.from, 0, 'cannot read terrain before the world starts');
        assert.truthy(r.to >= 800);
        c.panBy(9999);
        r = c.visibleRange();
        assert.equal(r.to, V2.worldW - 1, 'cannot read terrain past the world end');
    });

    test('the minimap places the viewport and both castles proportionally', () => {
        const c = cam(V2);
        c.focusOn(140, { instant: true });
        const m = c.minimap(200);
        assert.equal(Math.round(m.width), 80, '800 of 2000 is 40% of the ribbon');
        assert.equal(Math.round(m.left), 0);
        assert.equal(Math.round(m.markerAt(1860)), 186);
        c.panBy(1200);
        assert.equal(Math.round(c.minimap(200).left), 120);
    });
});

suite('camera: a swipe is never an aim, and a tap is never a swipe', () => {
    test('a quick tap aims', () => {
        assert.equal(classifyGesture({ dx: 2, dy: 1, dt: 120, released: true }), 'aim');
    });

    test('a decisive horizontal drag pans', () => {
        assert.equal(classifyGesture({ dx: 40, dy: 5, dt: 300 }), 'pan');
        assert.equal(classifyGesture({ dx: -40, dy: 5, dt: 300 }), 'pan');
    });

    test('a mostly vertical drag is neither — the page keeps scrolling', () => {
        assert.equal(classifyGesture({ dx: 14, dy: 60, dt: 300 }), 'none');
    });

    test('grabbing the aim handle always aims, however far it is dragged', () => {
        assert.equal(classifyGesture({ dx: 300, dy: 2, dt: 900, onHandle: true }), 'aim');
    });

    test('a slow tap still aims — a child is not fast', () => {
        assert.equal(classifyGesture({ dx: 3, dy: 3, dt: 1500, released: true }), 'aim');
    });

    test('the thresholds do not overlap, so no gesture is ambiguous', () => {
        assert.truthy(PAN_START_PX > TAP_SLOP_PX,
            'a movement cannot be both a tap and a pan');
        for (let dx = 0; dx <= 60; dx += 1) {
            for (const dy of [0, 5, 30, 90]) {
                const g = classifyGesture({ dx, dy, dt: 300 });
                assert.truthy(['aim', 'pan', 'none'].includes(g), `dx ${dx} dy ${dy} → ${g}`);
            }
        }
    });
});

// The camera is presentation. If any of this leaks into the model, two players
// looking at different parts of the field would resolve the battle differently.
suite('camera: it cannot touch the simulation', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'battle-camera.js'), 'utf8');

    test('it never calls physics or damage functions', () => {
        for (const banned of ['simulateShot', 'damageAt', 'buildTerrain', 'computeAmmo', 'blastRadius']) {
            assert.falsy(src.includes(banned), `the camera must not reach into ${banned}`);
        }
    });

    test('it never talks to the network, storage or the relay', () => {
        for (const banned of ['fetch(', 'localStorage', 'sessionStorage', 'sendTurn', 'WebSocket', 'link.']) {
            assert.falsy(src.includes(banned), `the camera must not use ${banned}`);
        }
    });

    test('it holds no DOM, so it stays testable and cheap', () => {
        for (const banned of ['document.', 'innerHTML', 'querySelector']) {
            assert.falsy(src.includes(banned), `the camera must not touch ${banned}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
