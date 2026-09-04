// castle-collision.test.js — 100 tests: a poop must never fly through a castle.
//
// simulateShot() collided with TERRAIN only. The castle was drawn but had no
// substance, so a flat shot sailed straight through the walls and landed in
// the field behind — a child watched a poop pass through the building and
// nothing happen. Measured on one seed: 65 shots whose flight path crossed the
// opponent's castle, 3 of them dealing no damage at all, and all 65 looking
// like they went through a solid house.
//
// The castle is now a blocker. These tests pin that it stops shells, that it
// only ever stops the shell fired AT it (never the one leaving its own
// muzzle), and that adding a solid object did not disturb determinism, damage,
// or v1.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));
const gameSrc = fs.readFileSync(path.join(ROOT, 'js', 'petbattlegame.js'), 'utf8');

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);
const BOX = V2.castle;
const SEEDS = [1, 4242, 99991, 31337, 8675309, 777777];

const field = (seed) => {
    const terrain = C.buildTerrain(seed, V2);
    const [L, R] = C.spawnPoints(terrain, V2);
    return { terrain, L, R };
};
const shoot = (f, from, facing, angle, power, wind, blockers) => C.simulateShot({
    terrain: f.terrain, from, facing, angle, power, wind: wind || 0,
    rules: V2, blockers: blockers === undefined ? [from === f.L ? f.R : f.L] : blockers,
});
const inCastle = (p, c) =>
    !!p && Math.abs(p.x - c.x) <= BOX.halfW && p.y <= c.y && p.y >= c.y - BOX.height;
// Did the flight path cross the castle volume at any point?
const crossed = (shot, c) => shot.points.some(p => inCastle(p, c));

// ── 1. the castle is solid ─────────────────────────────────────────────────
suite('collision: nothing passes through a castle', () => {
    for (const seed of SEEDS) {
        test(`seed ${seed}: no shot from the left ever passes through the right castle`, () => {
            const f = field(seed);
            const offenders = [];
            for (let a = 12; a <= 84; a += 3) {
                for (let p = 30; p <= 100; p += 3) {
                    const s = shoot(f, f.L, 1, a, p);
                    if (crossed(s, f.R) && !inCastle(s.hit, f.R)) offenders.push(`${a}°/${p}`);
                }
            }
            assert.equal(offenders.slice(0, 4).join(' '), '', `${offenders.length} shots went through the wall`);
        });

        test(`seed ${seed}: no shot from the right ever passes through the left castle`, () => {
            const f = field(seed);
            const offenders = [];
            for (let a = 12; a <= 84; a += 3) {
                for (let p = 30; p <= 100; p += 3) {
                    const s = shoot(f, f.R, -1, a, p);
                    if (crossed(s, f.L) && !inCastle(s.hit, f.L)) offenders.push(`${a}°/${p}`);
                }
            }
            assert.equal(offenders.slice(0, 4).join(' '), '', `${offenders.length} shots went through the wall`);
        });

        test(`seed ${seed}: every shot that reaches the castle stops there`, () => {
            const f = field(seed);
            let reached = 0, stopped = 0;
            for (let a = 12; a <= 84; a += 4) {
                for (let p = 30; p <= 100; p += 4) {
                    const s = shoot(f, f.L, 1, a, p);
                    if (crossed(s, f.R)) { reached++; if (inCastle(s.hit, f.R)) stopped++; }
                }
            }
            assert.equal(stopped, reached, `${reached - stopped} of ${reached} did not stop`);
        });

        test(`seed ${seed}: a shot stopped by the castle always damages it`, () => {
            const f = field(seed);
            for (let a = 12; a <= 84; a += 6) {
                for (let p = 30; p <= 100; p += 6) {
                    const s = shoot(f, f.L, 1, a, p);
                    if (inCastle(s.hit, f.R)) {
                        assert.truthy(C.damageAt(s.hit, f.R, 17, V2) > 0,
                            `${a}°/${p} hit the wall for nothing`);
                    }
                }
            }
        });
    }

    test('a shell aimed flat into the wall stops at the wall, not behind it', () => {
        const f = field(4242);
        // Find a low, fast shot that reaches the far castle.
        let found = null;
        for (let a = 12; a <= 40 && !found; a += 1) {
            for (let p = 60; p <= 100; p += 1) {
                const s = shoot(f, f.L, 1, a, p);
                if (crossed(s, f.R)) { found = s; break; }
            }
        }
        assert.truthy(found, 'no flat shot reached the castle');
        assert.truthy(inCastle(found.hit, f.R), 'a flat shot must stop on the facade');
        assert.truthy(found.hit.x <= f.R.x + BOX.halfW, 'it must not land past the far wall');
    });

    test('a lobbed shell landing on the roof stops on the roof', () => {
        const f = field(99991);
        let roofHit = null;
        for (let a = 55; a <= 84 && !roofHit; a += 1) {
            for (let p = 40; p <= 100; p += 1) {
                const s = shoot(f, f.L, 1, a, p);
                if (inCastle(s.hit, f.R) && s.hit.y < f.R.y - 40) { roofHit = s; break; }
            }
        }
        assert.truthy(roofHit, 'nothing landed high on the castle');
        assert.truthy(roofHit.hit.y >= f.R.y - BOX.height, 'the stop point must be inside the castle');
    });
});

// ── 2. the shooter's own castle never blocks it ────────────────────────────
suite('collision: the muzzle is not blocked by its own walls', () => {
    // The cannon sits INSIDE the castle it fires from, so a naive "collide
    // with any castle" would stop every shot at frame one.
    for (const seed of SEEDS) {
        test(`seed ${seed}: shots from the left still leave the barrel`, () => {
            const f = field(seed);
            for (let a = 12; a <= 84; a += 6) {
                const s = shoot(f, f.L, 1, a, 100);
                assert.truthy(s.frames > V2.muzzleClearance, `${a}° stopped after ${s.frames} frames`);
                assert.truthy(!s.hit || s.hit.x > f.L.x + 20, `${a}° hit its own wall at ${s.hit && Math.round(s.hit.x)}`);
            }
        });

        test(`seed ${seed}: shots from the right still leave the barrel`, () => {
            const f = field(seed);
            for (let a = 12; a <= 84; a += 6) {
                const s = shoot(f, f.R, -1, a, 100);
                assert.truthy(s.frames > V2.muzzleClearance);
                assert.truthy(!s.hit || s.hit.x < f.R.x - 20);
            }
        });
    }

    test('the blocker list names the target, never the shooter', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_blockersFor = function'));
        assert.truthy(fn.slice(0, 300).includes('from === this.mePos ? this.foePos : this.mePos'),
            'a shell must be stopped by the castle it flies AT');
    });

    test('a shot fired with no blockers behaves as it always did', () => {
        const f = field(4242);
        const withNone = shoot(f, f.L, 1, 45, 70, 0, null);
        const terrainOnly = C.simulateShot({ terrain: f.terrain, from: f.L, facing: 1, angle: 45, power: 70, wind: 0, rules: V2 });
        assert.equal(withNone.frames, terrainOnly.frames);
    });
});

// ── 3. determinism survives the new solid ──────────────────────────────────
suite('collision: both phones still see the same shot', () => {
    for (const seed of SEEDS) {
        test(`seed ${seed}: the same shot replays identically`, () => {
            const f = field(seed);
            const a = shoot(f, f.L, 1, 42, 66, -7);
            const b = shoot(f, f.L, 1, 42, 66, -7);
            assert.equal(a.frames, b.frames);
            assert.equal(a.points.length, b.points.length);
            assert.equal(a.hit ? a.hit.x : -1, b.hit ? b.hit.x : -1);
            assert.equal(a.hit ? a.hit.y : -1, b.hit ? b.hit.y : -1);
        });
    }

    test('collision never uses randomness', () => {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'battlecalc.js'), 'utf8');
        const fn = src.slice(src.indexOf('function simulateShot'), src.indexOf('// ---- damage'));
        assert.falsy(fn.includes('Math.random'), 'a random collision would desync the two phones');
    });

    test('a WALL hit stops exactly where the shell was, not on a terrain column', () => {
        // A shell landing at the castle's feet is a terrain hit and snaps to
        // the ground height; only a hit on the structure itself keeps the
        // shell's own position.
        const f = field(4242);
        let wall = null;
        for (let a = 12; a <= 84 && !wall; a += 2) {
            for (let p = 40; p <= 100; p += 2) {
                const t = shoot(f, f.L, 1, a, p);
                if (t.hit && inCastle(t.hit, f.R) && t.hit.y < f.R.y - 4) { wall = t; break; }
            }
        }
        assert.truthy(wall, 'no hit on the structure itself was found');
        const last = wall.points[wall.points.length - 1];
        assert.equal(wall.hit.x, last.x, 'a wall hit must be the last simulated point');
        assert.equal(wall.hit.y, last.y);
    });

    test('a hit at the castle base is a terrain hit, and sits on the ground', () => {
        const f = field(4242);
        let ground = null;
        for (let a = 12; a <= 84 && !ground; a += 2) {
            for (let p = 40; p <= 100; p += 2) {
                const t = shoot(f, f.L, 1, a, p);
                if (t.hit && Math.abs(t.hit.x - f.R.x) <= BOX.halfW && t.hit.y >= f.R.y - 4) { ground = t; break; }
            }
        }
        if (ground) {
            assert.equal(Math.round(ground.hit.y), Math.round(f.terrain[Math.round(ground.hit.x)]),
                'a ground hit must sit on the terrain');
            assert.truthy(C.damageAt(ground.hit, f.R, 17, V2) > 0, 'and still damage the castle above it');
        }
    });

    test('a blocked shot still returns a full flight path to animate', () => {
        const f = field(4242);
        for (let a = 20; a <= 60; a += 10) {
            const s = shoot(f, f.L, 1, a, 100);
            assert.truthy(s.points.length > 5, `only ${s.points.length} points to draw`);
        }
    });
});

// ── 4. terrain still works, and wins where it should ───────────────────────
suite('collision: terrain is unaffected', () => {
    for (const seed of SEEDS) {
        test(`seed ${seed}: a short shot still lands on the ground`, () => {
            const f = field(seed);
            const s = shoot(f, f.L, 1, 45, 30);
            assert.truthy(s.hit, 'a weak shot must land somewhere');
            assert.falsy(inCastle(s.hit, f.R), 'it should not reach the far castle at all');
            assert.equal(Math.round(s.hit.y), Math.round(f.terrain[Math.round(s.hit.x)]),
                'a ground hit must sit on the terrain');
        });
    }

    test('a shot into a hill stops at the hill, not at a distant castle', () => {
        const f = field(31337);
        const s = shoot(f, f.L, 1, 14, 40);
        if (s.hit) assert.falsy(inCastle(s.hit, f.R), 'a low weak shot cannot reach the far castle');
    });

    test('a shot that leaves the world still returns no hit', () => {
        const f = field(4242);
        const s = C.simulateShot({ terrain: f.terrain, from: f.L, facing: -1, angle: 80, power: 100, wind: 0, rules: V2, blockers: [f.R] });
        assert.truthy(s.frames > 0);
    });

    test('the muzzle clearance still applies to castles as well as terrain', () => {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'battlecalc.js'), 'utf8');
        const fn = src.slice(src.indexOf('if (R.castle && blockers'), src.indexOf('const col = Math.round(x)'));
        assert.truthy(fn.includes('f >= R.muzzleClearance'), 'a castle must not catch a shell at frame zero');
    });
});

// ── 5. v1 is untouched ─────────────────────────────────────────────────────
suite('collision: v1 replays are byte-identical', () => {
    test('v1 has no castle, so blockers are ignored entirely', () => {
        const terrain = C.buildTerrain(4242);
        const [L, R] = C.spawnPoints(terrain);
        const plain = C.simulateShot({ terrain, from: L, facing: 1, angle: 45, power: 70, wind: 0 });
        const withBlockers = C.simulateShot({ terrain, from: L, facing: 1, angle: 45, power: 70, wind: 0, rules: V1, blockers: [R] });
        assert.equal(plain.frames, withBlockers.frames);
        assert.equal(plain.hit ? plain.hit.x : -1, withBlockers.hit ? withBlockers.hit.x : -1);
    });

    for (const seed of [1, 4242, 987654321]) {
        test(`v1 seed ${seed}: trajectories are unchanged by the castle feature`, () => {
            const terrain = C.buildTerrain(seed);
            const [L, R] = C.spawnPoints(terrain);
            for (const a of [20, 45, 70]) {
                const withB = C.simulateShot({ terrain, from: L, facing: 1, angle: a, power: 80, wind: 5, rules: V1, blockers: [R] });
                const without = C.simulateShot({ terrain, from: L, facing: 1, angle: a, power: 80, wind: 5, rules: V1 });
                assert.equal(withB.frames, without.frames, `angle ${a}`);
            }
        });
    }
});

// ── 6. the whole field is still winnable ───────────────────────────────────
suite('collision: a solid castle did not make the game unwinnable', () => {
    for (const seed of SEEDS) {
        for (const wind of [-20, 0, 20]) {
            test(`seed ${seed} wind ${wind}: a damaging shot exists from the left`, () => {
                const f = field(seed);
                let best = 0;
                for (let a = 12; a <= 84 && best === 0; a += 2) {
                    for (let p = 30; p <= 100; p += 2) {
                        const s = shoot(f, f.L, 1, a, p, wind);
                        best = Math.max(best, C.damageAt(s.hit, f.R, 17, V2));
                        if (best > 0) break;
                    }
                }
                assert.truthy(best > 0, 'no shot can hurt the opponent');
            });

            test(`seed ${seed} wind ${wind}: a damaging shot exists from the right`, () => {
                const f = field(seed);
                let best = 0;
                for (let a = 12; a <= 84 && best === 0; a += 2) {
                    for (let p = 30; p <= 100; p += 2) {
                        const s = shoot(f, f.R, -1, a, p, wind);
                        best = Math.max(best, C.damageAt(s.hit, f.L, 17, V2));
                        if (best > 0) break;
                    }
                }
                assert.truthy(best > 0);
            });
        }
    }

});

// ── 7. the drawing and the collision agree ─────────────────────────────────
suite('collision: the blocker is the castle that is drawn', () => {
    test('the collision box is the rules castle, not a second copy', () => {
        const src = fs.readFileSync(path.join(ROOT, 'js', 'battlecalc.js'), 'utf8');
        const fn = src.slice(src.indexOf('if (R.castle && blockers'), src.indexOf('const col = Math.round(x)'));
        assert.truthy(fn.includes('R.castle.halfW'), 'the width must come from the rules');
        assert.truthy(fn.includes('R.castle.height'), 'the height must come from the rules');
        assert.falsy(/\b(70|122)\b/.test(fn), 'a retyped size would drift from the drawing');
    });

    test('the renderer and the collision use the same numbers', () => {
        const hw = +(gameSrc.match(/PB_CASTLE_HALF_W = (\d+)/) || [])[1];
        const hh = +(gameSrc.match(/PB_CASTLE_HEIGHT = (\d+)/) || [])[1];
        assert.equal(hw, BOX.halfW);
        assert.equal(hh, BOX.height);
    });

    test('the aim preview shows the shell stopping where it really stops', () => {
        assert.truthy(gameSrc.includes('blockers: this._blockersFor(from)'),
            'the trajectory preview must use the same blockers or it lies');
    });

    test('the opponent aim ghost is blocked by MY castle', () => {
        assert.truthy(gameSrc.includes('blockers: [this.mePos]'),
            "their ghost shot must stop at my walls, not fly through");
    });

    test('the damage pass uses the same blockers as the flight', () => {
        // Now in js/battlecalc.js volleyShots, shared with the server.
        const calcSrc = fs.readFileSync(path.join(ROOT, 'js/battlecalc.js'), 'utf8');
        const volley = calcSrc.slice(calcSrc.indexOf('function volleyShots('));
        const body = volley.slice(0, 1800);
        assert.truthy(body.includes('blockers: [target]'),
            'the damage simulation must see the same solid castle');
        assert.equal((body.match(/blockers: \[target\]/g) || []).length, 2,
            'both the aimed shells and the rockets must be blocked by it');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
