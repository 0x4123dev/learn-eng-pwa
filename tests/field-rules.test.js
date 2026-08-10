// field-rules.test.js — the versioned battlefield.
//
// v1 is the original single-screen field and must NEVER move: active battles
// and every replay depend on both phones deriving the same terrain and the
// same trajectory from one seed. v2 is the long world, and its constants were
// chosen by a 1800-scenario sweep rather than by eye — this file re-proves the
// property that made them acceptable, so a later "small tune" cannot quietly
// make the enemy castle unreachable.
const { suite, test, assert } = require('./harness');
const path = require('path');
const C = require(path.join(__dirname, '..', 'js', 'battlecalc.js'));

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);

// A cheap stable fingerprint of an array of numbers.
function hash(nums) {
    let h = 2166136261 >>> 0;
    for (const n of nums) {
        const v = Math.round(n * 1000) | 0;
        h ^= v & 0xff; h = Math.imul(h, 16777619) >>> 0;
        h ^= (v >>> 8) & 0xff; h = Math.imul(h, 16777619) >>> 0;
        h ^= (v >>> 16) & 0xff; h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

suite('field rules: v1 is frozen', () => {
    test('v1 keeps its exact geometry and constants', () => {
        assert.equal(V1.worldW, 800);
        assert.equal(V1.worldH, 450);
        assert.deepEqual(V1.spawnX, [90, 710]);
        assert.equal(V1.gravity, 0.18);
        assert.equal(V1.windAccel, 0.004);
        assert.equal(V1.v0Base, 4);
        assert.equal(V1.v0Gain, 0.09);
        assert.equal(V1.waveScale, 1, 'v1 terrain wavelengths must not be rescaled');
    });

    test('the default (no rules argument) is still v1', () => {
        const t = C.buildTerrain(4242);
        assert.equal(t.length, 800);
        assert.deepEqual(C.spawnPoints(t).map(p => p.x), [90, 710]);
    });

    // If this hash moves, an in-progress battle would desync between phones.
    test('v1 terrain is byte-stable for pinned seeds', () => {
        assert.equal(hash(C.buildTerrain(1)), hash(C.buildTerrain(1, V1)), 'default must equal explicit v1');
        for (const seed of [1, 4242, 987654321]) {
            const a = C.buildTerrain(seed);
            const b = C.buildTerrain(seed, V1);
            assert.equal(hash(a), hash(b), `seed ${seed} drifted between default and v1`);
        }
    });

    test('a v1 trajectory is reproducible from the same inputs', () => {
        const t = C.buildTerrain(777);
        const sp = C.spawnPoints(t);
        const shot = () => C.simulateShot({ terrain: t, from: sp[0], facing: 1, angle: 42, power: 66, wind: -7 });
        const a = shot(), b = shot();
        assert.equal(a.frames, b.frames);
        assert.equal(hash(a.points.map(p => p.x)), hash(b.points.map(p => p.x)));
        assert.equal(a.hit ? Math.round(a.hit.x) : -1, b.hit ? Math.round(b.hit.x) : -1);
    });

    test('an unknown or missing field version falls back to v1', () => {
        for (const bad of [undefined, null, 0, 3, 99, 'two', NaN]) {
            assert.equal(C.fieldRules(bad).version, 1, `version ${bad} must not reinterpret a battle`);
        }
    });
});

suite('field rules: v2 is the long world', () => {
    test('v2 is 2000 wide, seen through the same 800 window', () => {
        assert.equal(V2.worldW, 2000);
        assert.equal(V2.viewW, 800, 'the camera window stays one screen');
        assert.deepEqual(V2.spawnX, [140, 1860]);
        assert.equal(V2.spawnX[1] - V2.spawnX[0], 1720, 'the castle gap the sweep was run against');
    });

    test('v2 terrain and spawns span the whole world', () => {
        const t = C.buildTerrain(4242, V2);
        assert.equal(t.length, 2000);
        assert.deepEqual(C.spawnPoints(t, V2).map(p => p.x), [140, 1860]);
    });

    // The reason v2 needed new constants at all: v1 physics simply cannot
    // cross 1720px — measured maximum still-air range is 871px.
    test('v1 physics could never have reached across the long world', () => {
        const t = C.buildTerrain(4242, V2);
        const sp = C.spawnPoints(t, V2);
        let best = 0;
        for (let a = 10; a <= 85; a += 5) {
            const s = C.simulateShot({ terrain: t, from: sp[0], facing: 1, angle: a, power: 100, wind: 0, rules: V1 });
            const far = s.hit ? s.hit.x : Math.max(...s.points.map(p => p.x));
            best = Math.max(best, far - sp[0].x);
        }
        assert.truthy(best < 1200, `v1 reached ${Math.round(best)}px — the sweep's premise would be wrong`);
    });

    test('v2 physics reach the enemy castle from both sides, in every wind', () => {
        const seeds = [1, 4242, 99991, 123456, 2654435761 >>> 0, 777777, 31337, 8675309];
        let scenarios = 0, solved = 0, worstSolutions = Infinity;
        for (const seed of seeds) {
            const t = C.buildTerrain(seed, V2);
            const [L, R] = C.spawnPoints(t, V2);
            for (const wind of [-20, 0, 20]) {
                for (const dir of [1, -1]) {
                    const from = dir === 1 ? L : R;
                    const target = dir === 1 ? R : L;
                    scenarios++;
                    let hits = 0;
                    for (let a = 12; a <= 84 && hits < 3; a += 3) {
                        for (let p = 30; p <= 100; p += 3) {
                            const s = C.simulateShot({ terrain: t, from, facing: dir, angle: a, power: p, wind, rules: V2 });
                            if (s.hit && Math.abs(s.hit.x - target.x) <= 45) { hits++; break; }
                        }
                    }
                    if (hits > 0) solved++;
                    worstSolutions = Math.min(worstSolutions, hits);
                }
            }
        }
        assert.equal(solved, scenarios, `${scenarios - solved} of ${scenarios} scenarios had no solution`);
        assert.truthy(worstSolutions >= 1, 'every scenario needs at least one legal shot');
    });

    test('the practice bot can solve v2 without privileged physics', () => {
        // The bot's own coarse grid from js/petbattlebot.js — 5° and 5 power.
        for (const seed of [1, 4242, 99991, 31337]) {
            const t = C.buildTerrain(seed, V2);
            const [L, R] = C.spawnPoints(t, V2);
            for (const wind of [-20, 0, 20]) {
                let closest = Infinity;
                for (let a = 25; a <= 70; a += 5) {
                    for (let p = 40; p <= 95; p += 5) {
                        const s = C.simulateShot({ terrain: t, from: R, facing: -1, angle: a, power: p, wind, rules: V2 });
                        if (s.hit) closest = Math.min(closest, Math.abs(s.hit.x - L.x));
                    }
                }
                assert.truthy(closest <= 60,
                    `seed ${seed} wind ${wind}: bot's best shot missed by ${Math.round(closest)}px`);
            }
        }
    });

    test('a v2 shot stays watchable — not a bullet, not a lob', () => {
        const t = C.buildTerrain(4242, V2);
        const [L, R] = C.spawnPoints(t, V2);
        let found = null;
        for (let a = 12; a <= 84 && !found; a += 2) {
            for (let p = 30; p <= 100; p += 2) {
                const s = C.simulateShot({ terrain: t, from: L, facing: 1, angle: a, power: p, wind: 0, rules: V2 });
                if (s.hit && Math.abs(s.hit.x - R.x) <= 45) { found = s; break; }
            }
        }
        assert.truthy(found, 'no crossing shot found at all');
        // Rendered at one path point per two 60Hz ticks.
        const seconds = found.frames * 2 / 60;
        assert.truthy(seconds >= 1.8 && seconds <= 6,
            `flight renders in ${seconds.toFixed(1)}s — outside the watchable window`);
    });

    // Measured on flat ground so every wind actually LANDS. On real terrain a
    // full-power 45° shot leaves the world entirely, and comparing two
    // off-field shots compares the exit clamp, not the wind.
    test('wind still matters in v2, without dominating it', () => {
        const flat = new Array(V2.worldW).fill(440);
        const from = { x: V2.spawnX[0], y: 440 };
        // power 50: lands in-field under all three winds in BOTH rule sets
        const at = (wind) => C.simulateShot({ terrain: flat, from, facing: 1, angle: 45, power: 50, wind, rules: V2 });
        const calm = at(0), tail = at(20), head = at(-20);
        for (const [name, s] of [['calm', calm], ['tailwind', tail], ['headwind', head]]) {
            assert.truthy(s.hit, `${name} shot left the field — this test must measure landings`);
        }
        assert.truthy(tail.hit.x > calm.hit.x, 'a tailwind must carry the shot further');
        assert.truthy(head.hit.x < calm.hit.x, 'a headwind must shorten it');
        const drift = tail.hit.x - calm.hit.x;
        assert.truthy(drift > 20, `wind moved the shot only ${Math.round(drift)}px — it may as well not exist`);
        assert.truthy(drift < 700, `wind moved the shot ${Math.round(drift)}px — aim would be pointless`);
    });

    test('v2 halves the wind coefficient because flights are longer', () => {
        assert.equal(V1.windAccel, 0.004);
        assert.equal(V2.windAccel, 0.002);
        // Same nominal wind, comparable absolute drift — so the longer world
        // makes wind relatively gentler rather than overwhelming.
        const drift = (rules) => {
            const flat = new Array(rules.worldW).fill(440);
            const from = { x: rules.spawnX[0], y: 440 };
            const shot = (wind) => C.simulateShot({ terrain: flat, from, facing: 1, angle: 45, power: 50, wind, rules });
            const a = shot(0), b = shot(20);
            return (a.hit && b.hit) ? b.hit.x - a.hit.x : null;
        };
        const d1 = drift(V1), d2 = drift(V2);
        assert.truthy(d1 !== null && d2 !== null, 'both reference shots must land');
        assert.truthy(d2 < d1 * 3, `v2 drift ${Math.round(d2)}px vs v1 ${Math.round(d1)}px — wind would dominate`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
