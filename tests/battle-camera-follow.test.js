// battle-camera-follow.test.js — 100 tests for what the screen does when a
// shot is fired.
//
// The rules a child experiences on a 2000px field seen through an 800px window:
//
//   1. On THEIR turn they may scroll anywhere they like to scout.
//   2. When they press FIRE the world travels back to their own castle FIRST,
//      and only then does the poop leave the barrel and the camera follow it.
//   3. On the OPPONENT's turn the world travels to the opponent's castle
//      first, so the incoming poop is seen leaving its barrel rather than
//      arriving from off-screen.
//
// Before this, firing after scouting launched the shell while the screen was
// still looking somewhere else entirely.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));
const { BattleCamera, classifyGesture } = require(path.join(ROOT, 'js', 'battle-camera.js'));
const gameSrc = fs.readFileSync(path.join(ROOT, 'js', 'petbattlegame.js'), 'utf8');

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);
const ME = V2.spawnX[0];          // 140
const FOE = V2.spawnX[1];         // 1860
const cam = (opts) => new BattleCamera(Object.assign({ rules: V2 }, opts || {}));
const settle = (c, max) => { let n = 0; while (!c.settled() && n < (max || 400)) { c.update(1); n++; } return n; };

// ── 1. the launch waits for the camera ─────────────────────────────────────
suite('follow: firing travels home first, then shoots', () => {
    test('the game defers a launch until the camera arrives', () => {
        assert.truthy(gameSrc.includes('_afterCameraReaches'), 'no deferral exists');
        const fn = gameSrc.slice(gameSrc.indexOf('_afterCameraReaches = function'));
        assert.truthy(fn.slice(0, 600).includes('this._pendingLaunch = run'), 'the launch must be held');
    });

    test('fire() aims the camera at MY castle before launching', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype.fire = function'), gameSrc.indexOf('_launchMyVolley = function'));
        assert.truthy(fn.includes('_afterCameraReaches(this.mePos.x'), 'firing must return to my own castle first');
        assert.truthy(fn.includes('_launchMyVolley'), 'and only then launch');
    });

    test("a replayed turn aims the camera at the OPPONENT's castle first", () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype._replay = function'), gameSrc.indexOf('_launchFoeVolley = function'));
        assert.truthy(fn.includes('_afterCameraReaches(this.foePos.x'), 'their shot must be watched from their castle');
        assert.truthy(fn.includes('_launchFoeVolley'));
    });

    test('the turn is locked before the camera moves, so a second tap cannot double-fire', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype.fire = function'), gameSrc.indexOf('_launchMyVolley = function'));
        assert.truthy(fn.indexOf('this.busy = true') < fn.indexOf('_afterCameraReaches'),
            'busy must be set before the pan begins');
    });

    test('the frame loop releases the launch only once the camera has settled', () => {
        assert.truthy(gameSrc.includes('if (this._pendingLaunch && (!this.camera || this.camera.settled()))'));
        assert.truthy(gameSrc.includes('this._pendingLaunch = null'), 'it must fire exactly once');
    });

    test('the animation loop keeps ticking while a launch is pending', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_hasActiveAnimation = function'));
        assert.truthy(fn.slice(0, 300).includes('if (this._pendingLaunch) return true'),
            'otherwise the deferred shot would never fire');
    });

    test('an empty clip passes the turn without moving the camera', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype.fire = function'), gameSrc.indexOf('_launchMyVolley = function'));
        assert.truthy(fn.indexOf('_passTurn') < fn.indexOf('_afterCameraReaches'),
            'a pass should not stage a camera trip');
    });

    test('a finished battle abandons a pending launch instead of firing into the result card', () => {
        for (const fn of ['_launchMyVolley', '_launchFoeVolley']) {
            const body = gameSrc.slice(gameSrc.indexOf(fn + ' = function'));
            assert.truthy(body.slice(0, 200).includes('if (this.finished)'), `${fn} must bail when the battle ended`);
            assert.truthy(body.slice(0, 200).includes('this.busy = false'), `${fn} must release the lock`);
        }
    });
});

// ── 2. the camera actually reaches the shooter ─────────────────────────────
suite('follow: the trip home is correct and bounded', () => {
    for (const start of [0, 200, 600, 900, 1200]) {
        test(`from camera ${start}, focusing my castle frames it on screen`, () => {
            const c = cam();
            c.panBy(start);
            c.focusOn(ME);
            settle(c);
            assert.equal(c.offscreenSide(ME), 0, 'my castle must be visible before firing');
        });

        test(`from camera ${start}, focusing the opponent frames them on screen`, () => {
            const c = cam();
            c.panBy(start);
            c.focusOn(FOE);
            settle(c);
            assert.equal(c.offscreenSide(FOE), 0);
        });
    }

    test('my castle sits at the left edge of the world, so the camera pins to 0', () => {
        const c = cam();
        c.panBy(1200);
        c.focusOn(ME);
        settle(c);
        assert.equal(c.x, 0, 'centring on x=140 would need a negative camera; it must clamp');
    });

    test('the opponent sits at the right edge, so the camera pins to the maximum', () => {
        const c = cam();
        c.focusOn(FOE);
        settle(c);
        assert.equal(c.x, c.maxX);
    });

    test('the trip is quick enough not to feel like a pause', () => {
        const c = cam();
        c.panBy(1200);
        c.focusOn(ME);
        const ticks = settle(c);
        assert.truthy(ticks <= 120, `${ticks} ticks (~${(ticks / 60).toFixed(1)}s) is too long a wait before firing`);
    });

    test('the trip never overshoots the world', () => {
        const c = cam();
        c.panBy(1200);
        c.focusOn(ME);
        for (let i = 0; i < 300; i++) { c.update(1); assert.truthy(c.x >= 0 && c.x <= c.maxX, `left the world at ${c.x}`); }
    });

    test('travel is refresh-rate independent, so 120Hz does not arrive sooner', () => {
        const a = cam(); a.panBy(1200); a.focusOn(ME);
        const b = cam(); b.panBy(1200); b.focusOn(ME);
        for (let i = 0; i < 40; i++) a.update(1);
        for (let i = 0; i < 80; i++) b.update(0.5);
        assert.truthy(Math.abs(a.x - b.x) < 12, `60Hz ${Math.round(a.x)} vs 120Hz ${Math.round(b.x)}`);
    });

    test('already being at the destination fires immediately', () => {
        const c = cam();
        c.focusOn(ME, { instant: true });
        c.focusOn(ME);
        assert.truthy(c.settled(), 'no trip is needed, so no wait should be imposed');
    });

    test('reduced motion cuts straight there rather than gliding', () => {
        const c = cam({ reducedMotion: true });
        c.panBy(1200);
        c.focusOn(ME);
        assert.truthy(c.settled(), 'a reduced-motion player must not wait for a pan');
        assert.equal(c.x, c.targetX);
    });

    test('on a single-screen v1 field the launch is never deferred', () => {
        const c = new BattleCamera({ rules: V1 });
        assert.falsy(c.isPannable());
        const fn = gameSrc.slice(gameSrc.indexOf('_afterCameraReaches = function'));
        assert.truthy(fn.slice(0, 400).includes('!cam.isPannable()'), 'v1 must fire straight away');
    });
});

// ── 3. following the shell ─────────────────────────────────────────────────
suite('follow: the camera tracks the poop', () => {
    test('a shell inside the dead zone does not move the camera', () => {
        const c = cam();
        c.focusOn(700, { instant: true });
        const before = c.targetX;
        c.follow(c.x + c.viewW * 0.5, 1);
        assert.equal(c.targetX, before, 'a twitchy camera is worse than a still one');
    });

    for (const frac of [0.30, 0.20, 0.10, 0.0]) {
        test(`a shell at ${Math.round(frac * 100)}% across the view pulls the camera left`, () => {
            const c = cam();
            c.focusOn(1000, { instant: true });
            const before = c.targetX;
            c.follow(c.x + c.viewW * frac, -1);
            assert.truthy(c.targetX <= before, 'the camera must chase a shell heading left');
        });
    }

    for (const frac of [0.70, 0.85, 1.0]) {
        test(`a shell at ${Math.round(frac * 100)}% across the view pulls the camera right`, () => {
            const c = cam();
            c.focusOn(700, { instant: true });
            const before = c.targetX;
            c.follow(c.x + c.viewW * frac, 1);
            assert.truthy(c.targetX >= before);
        });
    }

    test('following a shell the whole way keeps it on screen', () => {
        const c = cam();
        c.focusOn(ME, { instant: true });
        let visible = 0, total = 0;
        for (let x = ME; x <= FOE; x += 20) {
            c.follow(x, 1);
            c.update(3);                      // the camera is allowed to lag a little
            total++;
            if (c.offscreenSide(x) === 0) visible++;
        }
        assert.truthy(visible / total >= 0.8, `the shell was visible for only ${Math.round(visible / total * 100)}% of its flight`);
    });

    test('the camera leads the shell rather than trailing it', () => {
        const c1 = cam(); c1.focusOn(700, { instant: true });
        const right = c1.follow(c1.x + c1.viewW * 0.9, 1);
        const c2 = cam(); c2.focusOn(700, { instant: true });
        const left = c2.follow(c2.x + c2.viewW * 0.9, -1);
        assert.truthy(right > left, 'look-ahead must depend on the direction of travel');
    });

    test('following clamps at the world edges', () => {
        const c = cam();
        c.focusOn(FOE, { instant: true });
        c.follow(3000, 1);
        settle(c);
        assert.truthy(c.x <= c.maxX);
        c.follow(-3000, -1);
        settle(c);
        assert.truthy(c.x >= 0);
    });

    test('the game follows the centroid of a volley, not one shell of it', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_updateCamera = function'));
        assert.truthy(fn.slice(0, 900).includes('sx / n'), 'four poops must not yank the camera between them');
    });

    test('follow is skipped once the child takes manual control', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_updateCamera = function'));
        assert.truthy(fn.slice(0, 900).includes('!this._followCancelled'));
    });
});

// ── 4. scouting on your own turn ───────────────────────────────────────────
suite('follow: the child may scout freely until they fire', () => {
    for (const dx of [-1500, -600, -100, 100, 600, 1500]) {
        test(`a pan of ${dx}px is allowed and stays in the world`, () => {
            const c = cam();
            c.focusOn(700, { instant: true });
            c.panBy(dx);
            assert.truthy(c.x >= 0 && c.x <= c.maxX);
            assert.equal(c.mode, 'manual');
        });
    }

    test('a manual pan cancels an active follow', () => {
        const c = cam();
        c.focusOn(700, { instant: true });
        c.follow(1400, 1);
        c.panBy(-300);
        const held = c.targetX;
        c.follow(1800, 1);
        assert.equal(c.targetX, held, 'follow must not steal the camera back');
        assert.equal(c.mode, 'manual');
    });

    test('scrolling the field never changes the aim', () => {
        // A pan is a camera action; aim lives in angle/power.
        for (let dx = 12; dx <= 400; dx += 40) {
            assert.equal(classifyGesture({ dx, dy: 4, dt: 300 }), 'pan', `dx ${dx} should scout, not aim`);
        }
    });

    test('a tap still aims rather than scrolling', () => {
        for (const dx of [0, 3, 6, 8]) {
            assert.equal(classifyGesture({ dx, dy: 2, dt: 180, released: true }), 'aim');
        }
    });

    test('firing re-enables follow even after scouting', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_afterCameraReaches = function'));
        assert.truthy(fn.slice(0, 400).includes('this._followCancelled = false'),
            'a new volley must be worth watching again');
    });

    test('the anchors let a child jump without swiping', () => {
        assert.truthy(gameSrc.includes("cameraAnchor('me')") || gameSrc.includes("_pbGameAnchor('me')"));
        assert.truthy(gameSrc.includes("_pbGameAnchor('foe')"));
        assert.truthy(gameSrc.includes("_pbGameAnchor('centre')"));
    });

    test('an anchor jump counts as taking manual control', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('cameraAnchor = function'));
        assert.truthy(fn.slice(0, 400).includes('this._followCancelled = true'),
            'an explicit jump must beat an automatic follow');
    });
});

// ── 5. the opponent's turn ─────────────────────────────────────────────────
suite('follow: watching the opponent shoot', () => {
    for (const start of [0, 300, 700, 1200]) {
        test(`from camera ${start}, the opponent's castle is framed before their shot`, () => {
            const c = cam();
            c.panBy(start);
            c.focusOn(FOE);                 // what _replay does
            settle(c);
            assert.equal(c.offscreenSide(FOE), 0);
        });
    }

    test("the incoming shell is followed from the opponent's side", () => {
        const c = cam();
        c.focusOn(FOE, { instant: true });
        let visible = 0, total = 0;
        for (let x = FOE; x >= ME; x -= 20) {
            c.follow(x, -1);
            c.update(3);
            total++;
            if (c.offscreenSide(x) === 0) visible++;
        }
        assert.truthy(visible / total >= 0.8, `only ${Math.round(visible / total * 100)}% of the incoming shot was visible`);
    });

    test('a skipped opponent turn does not stage a camera trip', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype._replay = function'), gameSrc.indexOf('_launchFoeVolley = function'));
        assert.truthy(fn.indexOf("gT('gSkip'") < fn.indexOf('_afterCameraReaches'),
            'an empty turn should announce and return, not pan');
    });

    test('the aim ghost of an opponent still draws while they line up', () => {
        assert.truthy(gameSrc.includes('this.foeAiming'), 'the ghost must survive the camera work');
    });

    test('a queued turn still gets its camera trip when it finally plays', () => {
        const drain = gameSrc.slice(gameSrc.indexOf('_drainTurns = function'));
        assert.truthy(drain.slice(0, 300).includes('this._replay(next)'),
            'a queued turn must go through _replay, which stages the camera');
    });
});

// ── 6. the camera can never change the game ────────────────────────────────
suite('follow: the camera stays presentation-only', () => {
    const camSrc = fs.readFileSync(path.join(ROOT, 'js', 'battle-camera.js'), 'utf8');

    for (const banned of ['simulateShot', 'damageAt', 'buildTerrain', 'computeAmmo', 'blastRadius', 'fetch(', 'sendTurn', 'localStorage', 'WebSocket']) {
        test(`the camera never touches ${banned}`, () => {
            assert.falsy(camSrc.includes(banned));
        });
    }

    test('camera position is not part of a turn payload', () => {
        const fire = gameSrc.slice(gameSrc.indexOf('_launchMyVolley = function'), gameSrc.indexOf('prototype._replay = function'));
        const send = fire.slice(fire.indexOf('this.sendTurn('), fire.indexOf('this.sendTurn(') + 200);
        assert.falsy(/camera|cameraX/.test(send), 'the opponent must not inherit my scroll position');
    });

    test('two players looking at different places compute the same shot', () => {
        const terrain = C.buildTerrain(4242, V2);
        const [L, R] = C.spawnPoints(terrain, V2);
        const shot = () => C.simulateShot({ terrain, from: L, facing: 1, angle: 42, power: 66, wind: -7, rules: V2, blockers: [R] });
        const a = shot(), b = shot();
        assert.equal(a.frames, b.frames, 'the simulation cannot depend on where anyone is looking');
        assert.equal(a.hit ? a.hit.x : -1, b.hit ? b.hit.x : -1);
    });

    test('the deferral changes when a shot fires, never what it does', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_afterCameraReaches = function'));
        const body = fn.slice(0, 600);
        for (const banned of ['angle', 'power', 'damage', 'myAmmo']) {
            assert.falsy(body.includes(banned), `staging the camera must not touch ${banned}`);
        }
    });
});

// ── 7. edges and awkward moments ───────────────────────────────────────────
suite('follow: awkward moments', () => {
    test('junk camera input is ignored rather than snapping to the edge', () => {
        const c = cam();
        c.focusOn(700, { instant: true });
        const before = c.x;
        for (const bad of [NaN, Infinity, null, undefined, 'x']) {
            assert.equal(c.clamp(bad), before, `clamp(${bad}) moved the camera`);
        }
    });

    test('a focus on a nonsense position keeps the camera in the world', () => {
        const c = cam();
        for (const bad of [-9999, 99999]) {
            c.focusOn(bad, { instant: true });
            assert.truthy(c.x >= 0 && c.x <= c.maxX, `focus(${bad}) left the world`);
        }
    });

    test('an impact hold frames the struck castle for its full duration', () => {
        const c = cam();
        c.holdOn(FOE, 800, 1000);
        assert.truthy(c.isHolding(1500));
        assert.falsy(c.isHolding(1900));
    });

    test('after the shots land the camera rests at the impact, not the next shooter', () => {
        // This deliberately replaced "settle on whoever shoots next": that
        // dragged the child away from their own castle the moment an incoming
        // poop hit it.
        const fn = gameSrc.slice(gameSrc.indexOf('_updateCamera = function'));
        const body = fn.slice(0, 1400);
        assert.truthy(body.includes('const restAt = (typeof this._lastImpactX'), 'the impact must win');
        assert.truthy(body.includes('this.myTurn ? this.mePos.x : this.foePos.x'),
            'with the next shooter kept only as a first-turn fallback');
    });

    test('destroying the game abandons any pending launch', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype.destroy = function'));
        assert.truthy(fn.slice(0, 300).includes('_destroyed = true'));
        assert.truthy(gameSrc.includes('if (this._destroyed) return'), 'the frame loop must stop dead');
    });

    test('the minimap shows where the viewport is during all of this', () => {
        const c = cam();
        c.focusOn(ME, { instant: true });
        const left = c.minimap(200).left;
        c.focusOn(FOE, { instant: true });
        assert.truthy(c.minimap(200).left > left, 'the ribbon must track the camera');
    });

    test('an offscreen opponent is signposted, not simply missing', () => {
        const c = cam();
        c.focusOn(ME, { instant: true });
        assert.equal(c.offscreenSide(FOE), 1, 'a beacon should point right');
        assert.truthy(gameSrc.includes('pbBeaconR'), 'and the UI must render it');
    });
});

// ── 8. the whole sequence, end to end ─────────────────────────────────────
// A small model of the real order of events: scout → FIRE → travel home →
// launch → follow → land. It exists to catch an ordering mistake, which is
// what the bug actually was.
suite('follow: the full fire sequence in order', () => {
    const run = (startPan, opts) => {
        const c = cam(opts);
        const log = [];
        c.focusOn(ME, { instant: true });
        if (startPan) { c.panBy(startPan); log.push('scout'); }
        const scoutedAt = c.x;

        // FIRE: lock, travel home, hold the launch.
        let launched = false, launchedAt = null;
        c.focusOn(ME, { mode: 'turn-focus' });
        log.push('travel');
        let ticks = 0;
        while (!c.settled() && ticks < 400) { c.update(1); ticks++; }
        launched = true; launchedAt = c.x; log.push('launch');
        const myCastleOnScreenAtLaunch = c.offscreenSide(ME) === 0;

        // FOLLOW the shell across the field.
        let offscreenFrames = 0, frames = 0;
        for (let x = ME; x <= FOE; x += 25) {
            c.follow(x, 1); c.update(3); frames++;
            if (c.offscreenSide(x) !== 0) offscreenFrames++;
        }
        log.push('follow');
        return { log, scoutedAt, launchedAt, ticks, frames, offscreenFrames, myCastleOnScreenAtLaunch, cam: c };
    };

    for (const pan of [0, 300, 700, 1200]) {
        test(`scouted ${pan}px: the order is scout → travel → launch → follow`, () => {
            const r = run(pan);
            assert.equal(r.log.join(' → '), pan ? 'scout → travel → launch → follow' : 'travel → launch → follow');
        });

        test(`scouted ${pan}px: the shot launches from my castle, not from where I scouted`, () => {
            const r = run(pan);
            assert.equal(r.launchedAt, 0, 'my castle is at the world edge, so the camera must be pinned left');
            if (pan) assert.truthy(r.scoutedAt !== r.launchedAt, 'the camera should have travelled');
        });

        test(`scouted ${pan}px: my castle is on screen at the moment of launch`, () => {
            // Measured AT LAUNCH — by the end of the follow the camera has
            // legitimately travelled to the far side with the shell.
            const r = run(pan);
            assert.truthy(r.myCastleOnScreenAtLaunch, 'the shot left the barrel off-screen');
        });

        test(`scouted ${pan}px: the shell stays visible for most of its flight`, () => {
            const r = run(pan);
            const seen = 1 - r.offscreenFrames / r.frames;
            assert.truthy(seen >= 0.8, `only ${Math.round(seen * 100)}% visible`);
        });

        test(`scouted ${pan}px: the camera ends near the opponent, where the shell landed`, () => {
            const r = run(pan);
            assert.truthy(r.cam.x > 600, `ended at ${Math.round(r.cam.x)} — it did not follow the shot across`);
        });
    }

    test('reduced motion skips the travel entirely but keeps the order', () => {
        const r = run(1200, { reducedMotion: true });
        assert.equal(r.ticks, 0, 'a reduced-motion player must not wait');
        assert.equal(r.launchedAt, 0, 'and must still fire from their own castle');
    });

    test('firing twice in a row does not accumulate camera trips', () => {
        const a = run(1200), b = run(1200);
        assert.equal(a.ticks, b.ticks, 'the trip length must be deterministic');
    });
});

// ── 9. the opponent sequence, end to end ──────────────────────────────────
suite('follow: the opponent sequence in order', () => {
    const incoming = (startPan) => {
        const c = cam();
        c.focusOn(ME, { instant: true });
        if (startPan) c.panBy(startPan);
        c.focusOn(FOE, { mode: 'turn-focus' });      // _replay stages this
        let ticks = 0;
        while (!c.settled() && ticks < 400) { c.update(1); ticks++; }
        const launchedAt = c.x;
        let off = 0, frames = 0;
        for (let x = FOE; x >= ME; x -= 25) {
            c.follow(x, -1); c.update(3); frames++;
            if (c.offscreenSide(x) !== 0) off++;
        }
        return { launchedAt, ticks, seen: 1 - off / frames, cam: c };
    };

    for (const pan of [0, 400, 900, 1200]) {
        test(`scouted ${pan}px: the opponent's castle is framed before their shot`, () => {
            const r = incoming(pan);
            assert.equal(r.launchedAt, 1200, 'their castle is at the right edge, so the camera pins there');
        });

        test(`scouted ${pan}px: the incoming shell stays visible`, () => {
            const r = incoming(pan);
            assert.truthy(r.seen >= 0.8, `only ${Math.round(r.seen * 100)}% visible`);
        });

        test(`scouted ${pan}px: the camera ends back near my castle`, () => {
            const r = incoming(pan);
            assert.truthy(r.cam.x < 600, `ended at ${Math.round(r.cam.x)} — it did not follow the shot back`);
        });
    }

    test('a child who scouted mid-field still sees the opponent fire', () => {
        const r = incoming(600);
        assert.equal(r.cam.viewW, 800);
        assert.truthy(r.ticks > 0, 'a trip was needed and taken');
    });
});

// ── 10. the tap slop suits a child's finger ───────────────────────────────
suite('follow: taps and swipes at a child\'s precision', () => {
    for (const [dx, dy, want] of [
        [0, 0, 'aim'], [3, 3, 'aim'], [6, 2, 'aim'], [8, 2, 'aim'], [9, 3, 'aim'], [10, 0, 'aim'],
        [12, 2, 'pan'], [20, 4, 'pan'], [60, 10, 'pan'], [200, 30, 'pan'],
        [14, 60, 'none'], [5, 40, 'none'],
    ]) {
        test(`a gesture ${dx}x${dy} means "${want}"`, () => {
            assert.equal(classifyGesture({ dx, dy, dt: 200, released: true }), want);
        });
    }

    test('a wobbly tap no longer falls through to nothing', () => {
        // 8 across and 2 down measures 8.25px — under the old 8px slop it
        // returned "none" and the poop simply did not aim.
        assert.equal(classifyGesture({ dx: 8, dy: 2, dt: 180, released: true }), 'aim');
    });

    test('the slop is still comfortably below the pan threshold', () => {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'battle-camera.js'), 'utf8');
        const slop = +(src.match(/TAP_SLOP_PX = (\d+)/) || [])[1];
        const pan = +(src.match(/PAN_START_PX = (\d+)/) || [])[1];
        assert.truthy(pan > slop, `pan ${pan} must exceed slop ${slop} or gestures become ambiguous`);
    });
});

// ── 11. the camera rests where the shot landed ────────────────────────────
// Settling back on "whoever shoots next" dragged the world away from the
// child's own castle the instant an incoming poop hit it — they were pulled
// back to the opponent before they could see their own damage.
suite('follow: the camera stays where the poop landed', () => {
    test('an incoming hit leaves the camera on MY side', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_updateCamera = function'));
        assert.truthy(fn.slice(0, 1400).includes('this._lastImpactX'),
            'the resting place must be the impact, not the next shooter');
    });

    test("my own volley records the opponent's castle as the impact", () => {
        const fire = gameSrc.slice(gameSrc.indexOf('_launchMyVolley = function'), gameSrc.indexOf('prototype._replay = function'));
        assert.truthy(fire.includes('this._lastImpactX = this.foePos.x'));
    });

    test('their volley records MY castle as the impact', () => {
        const replay = gameSrc.slice(gameSrc.indexOf('_launchFoeVolley = function'));
        assert.truthy(replay.slice(0, 1600).includes('this._lastImpactX = this.mePos.x'));
    });

    test('with no impact yet, it still falls back to the next shooter', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_updateCamera = function'));
        assert.truthy(fn.slice(0, 1400).includes('this.myTurn ? this.mePos.x : this.foePos.x'),
            'the very first turn has no previous impact');
    });

    test('resting on my castle keeps it on screen', () => {
        const c = cam();
        c.focusOn(ME, { mode: 'turn-settle' });
        settle(c);
        assert.equal(c.offscreenSide(ME), 0);
    });

    test('firing afterwards still brings the camera home by itself', () => {
        const c = cam();
        c.focusOn(FOE, { instant: true });      // resting after my own shot landed
        c.focusOn(ME, { mode: 'turn-focus' });  // what fire() stages
        settle(c);
        assert.equal(c.x, 0, 'so nothing is lost by resting at the far end');
    });
});

// ── 12. the battlefield is twice as tall ──────────────────────────────────
suite('follow: extra sky above the world', () => {
    const SKY = +(gameSrc.match(/PB_SKY_EXTRA = (\d+)/) || [])[1];

    test('the extra sky is declared once and equals a full world depth', () => {
        assert.equal(SKY, V2.worldH, 'twice as tall means one more world of sky');
    });

    test('both canvases are drawn at the taller size', () => {
        const matches = (gameSrc.match(/height="\$\{C\.FIELD_H \+ PB_SKY_EXTRA\}"/g) || []).length;
        assert.equal(matches, 2, 'the scene layer and the gameplay layer must match exactly');
    });

    test('the world is drawn shifted down by exactly the extra sky', () => {
        assert.truthy(gameSrc.includes('this.ctx.translate(-camX, PB_SKY_EXTRA)'));
    });

    test('a pointer y is brought back into world space', () => {
        assert.truthy(gameSrc.includes('/ rect.height - PB_SKY_EXTRA'),
            'without this every tap would aim 450px too low');
    });

    test('the physics world is unchanged — only the view grew', () => {
        assert.equal(V2.worldH, 450, 'the simulation must not know about the sky');
        assert.equal(C.fieldRules(1).worldH, 450);
    });

    test('a tap at the bottom of the canvas maps to the world floor', () => {
        const canvasH = V2.worldH + SKY;
        const worldY = canvasH * canvasH / canvasH - SKY;
        assert.equal(worldY, V2.worldH);
    });

    test('a tap at the sky line maps to the top of the world', () => {
        const canvasH = V2.worldH + SKY;
        assert.equal(SKY * canvasH / canvasH - SKY, 0);
    });

    test('the arena art keeps its shape instead of stretching to fill', () => {
        const scenes = fs.readFileSync(path.join(ROOT, 'js', 'battle-scenes.js'), 'utf8');
        assert.truthy(scenes.includes('const artH = Math.min(height, Math.round(width * this.viewH / this.viewW))'),
            'stretching a 16:9 arena to 8:9 would squash every landmark');
        assert.truthy(scenes.includes('const skyH = Math.max(0, height - artH)'));
        assert.truthy(scenes.includes("this.scene.palette.sky"), 'the sky above must use the arena\'s own colour');
    });
});

// ── 13. wind and health on the battlefield ────────────────────────────────
suite('follow: wind and health are readable without looking away', () => {
    test('the battlefield carries its own wind and health strip', () => {
        assert.truthy(gameSrc.includes('pb-field-status'), 'no on-field status');
        for (const id of ['pbFieldWind', 'pbFieldHpMe', 'pbFieldHpFoe']) {
            assert.truthy(gameSrc.includes(`id="${id}"`), `${id} missing`);
        }
    });

    test('all three track the model on every frame', () => {
        const ui = gameSrc.slice(gameSrc.indexOf('prototype._updateUi'));
        for (const id of ['pbFieldWind', 'pbFieldHpMe', 'pbFieldHpFoe']) {
            assert.truthy(ui.includes(`text('${id}'`), `${id} is rendered once and never updated`);
        }
    });

    test('wind shows direction as well as strength', () => {
        const ui = gameSrc.slice(gameSrc.indexOf("text('pbFieldWind'"));
        assert.truthy(ui.slice(0, 200).includes("'→'") && ui.slice(0, 200).includes("'←'"),
            'a number without a direction cannot be aimed with');
    });

    test('health can never render as a negative number', () => {
        const ui = gameSrc.slice(gameSrc.indexOf("text('pbFieldHpMe'"));
        assert.truthy(ui.slice(0, 200).includes('Math.max(0'));
    });

    test('the strip floats over the field without blocking taps', () => {
        const css = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');
        const block = css.slice(css.indexOf('.pb-field-status {'), css.indexOf('}', css.indexOf('.pb-field-status {')));
        assert.truthy(block.includes('position: absolute'));
        assert.truthy(block.includes('pointer-events: none'), 'it must never swallow an aim tap');
    });

    test('the two sides are told apart by colour', () => {
        const css = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');
        assert.truthy(css.includes('.pb-fs-side.me i'), 'my bar needs its own colour');
        assert.truthy(css.includes('.pb-fs-side.foe i'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
