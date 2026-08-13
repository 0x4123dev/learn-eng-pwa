// battle-balance.test.js — wind has to matter.
//
// The bug this file exists to prevent, reported from real play:
//   "sao voi moi huong gio, toi luon dung luc 100 va goc 20 deu trung doi thu"
//   (whatever the wind, I always use power 100 / angle 20 and I hit)
//
// Why it happened is worth writing down, because the obvious diagnosis was
// wrong. It was NOT that wind was too weak in absolute terms — it was the
// shape of the target. The castle is a 122px-tall WALL, so a flat shot
// arriving almost horizontally only has to REACH it, not land in a window:
//
//     angle  power   flight   wind drift   tolerance
//       20°    100    84 fr        11px       +/-91px   <- wind loses
//       45°     90   142 fr         2px       +/-91px   <- wind loses
//       60°     80   190 fr       264px       +/-91px
//
// A lob has to land inside a window and drifts hundreds of pixels; a flat
// shot does not. So one aim covered every wind. A sweep of v0Gain x windAccel
// over 10 arenas x 3 seeds found 162 such aims at windAccel 0.002 and ZERO at
// 0.004, with every scenario still winnable (0.006 was measured too and broke
// reachability, at 80%). Doubling the wind coefficient was therefore the fix,
// and cutting the shell's range was not needed.
//
// These tests re-prove the property rather than asserting the number, so a
// later "small tune" to gravity, v0Gain, spawn distance or the castle box
// cannot quietly hand the exploit back.
const { suite, test, assert } = require('./harness');
const path = require('path');
const C = require(path.join(__dirname, '..', 'js', 'battlecalc.js'));

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);
const V3 = C.fieldRules(3);

const WINDS = [-20, -10, 0, 10, 20];
const ARENAS = Object.keys(C.BATTLE_TERRAIN_PROFILES);
const SEEDS = [4242, 99991, 31337];
const LEVEL = 17;

// Every (from -> target) pairing a real battle can produce on one arena+seed.
function matchups(arenaId, seed, rules) {
    const terrain = C.buildTerrain(seed, rules, arenaId);
    const [left, right] = C.spawnPoints(terrain, rules);
    return [
        { terrain, from: left, facing: 1, target: right, side: 'left' },
        { terrain, from: right, facing: -1, target: left, side: 'right' },
    ];
}

function hits(m, angle, power, wind, rules) {
    const shot = C.simulateShot({
        terrain: m.terrain, from: m.from, facing: m.facing,
        angle, power, wind, rules, blockers: [m.target],
    });
    return C.damageAt(shot.hit, m.target, LEVEL, rules) > 0;
}

// How many of the five winds does this one aim beat? 5 means the exploit.
function windsCovered(m, angle, power, rules) {
    let covered = 0;
    for (const wind of WINDS) {
        if (!hits(m, angle, power, wind, rules)) break;
        covered++;
    }
    return covered;
}

suite('battle balance: the reported exploit is gone', () => {
    test('power 100 / angle 20 does not beat every wind on any arena', () => {
        let worst = null;
        for (const arenaId of ARENAS) {
            for (const seed of SEEDS) {
                for (const m of matchups(arenaId, seed, V3)) {
                    const covered = windsCovered(m, 20, 100, V3);
                    assert.truthy(covered < WINDS.length,
                        `20 deg / power 100 hit under all ${WINDS.length} winds on ${arenaId} ` +
                        `(seed ${seed}, ${m.side} side) — the reported exploit is back`);
                    if (worst === null || covered > worst) worst = covered;
                }
            }
        }
        // Not zero either: the aim should still be usable in *some* wind, or
        // we have merely swapped "always works" for "never works".
        assert.truthy(worst > 0, 'the flat shot now fails in every wind — wind has become overwhelming');
    });

    test('no single aim beats every wind, searched across the whole aim grid', () => {
        // Coarser than the offline 1-degree sweep so the suite stays fast; the
        // offline run covered angles 10-86 x powers 30-100 at step 1 over
        // 10 arenas x 8 seeds x both sides (800 scenarios) and also found zero.
        const found = [];
        for (const arenaId of ARENAS) {
            for (const m of matchups(arenaId, SEEDS[0], V3)) {
                for (let angle = 12; angle <= 84; angle += 4) {
                    for (let power = 40; power <= 100; power += 5) {
                        if (windsCovered(m, angle, power, V3) === WINDS.length) {
                            found.push(`${arenaId} ${m.side} ${angle}deg/${power}`);
                        }
                    }
                }
            }
        }
        assert.equal(found.length, 0,
            `these aims hit under every wind, so wind is decorative: ${found.slice(0, 6).join(', ')}`);
    });

    test('every round of a real battle is winnable from both sides', () => {
        // The counterweight to the test above: it is trivial to kill the
        // exploit by making the enemy unhittable. This walks REAL battles —
        // real seeds, real per-round winds from windForRound, both sides —
        // because that, and not a grid of extremes, is what a child meets.
        // Measured over 600 player-rounds when the wind was doubled: zero
        // unwinnable rounds, and a median of 123 winning aims out of 1404
        // sampled. Wind is symmetric too (about 105 winning aims at -20 and
        // at +20), so neither side is handed the advantage.
        for (let seed = 1000; seed < 1012; seed++) {
            const arenaId = ARENAS[seed % ARENAS.length];
            for (const m of matchups(arenaId, seed, V3)) {
                for (let round = 1; round <= 10; round++) {
                    const wind = C.windForRound(seed, round);
                    let solved = false;
                    for (let angle = 12; angle <= 84 && !solved; angle += 2) {
                        for (let power = 34; power <= 100; power += 2) {
                            if (hits(m, angle, power, wind, V3)) { solved = true; break; }
                        }
                    }
                    assert.truthy(solved,
                        `no aim can hit on ${arenaId} from the ${m.side} in round ${round} ` +
                        `(seed ${seed}, wind ${wind}) — that round is unwinnable`);
                }
            }
        }
    });

    test('a winning aim is a window a child can find, not a needle', () => {
        // Zero unwinnable rounds is not enough: if only one aim in thousands
        // works, the game is unplayable in a different way. Half the sampled
        // grid would be too easy; a handful would be a needle.
        const GRID = [];
        for (let angle = 12; angle <= 84; angle += 2) {
            for (let power = 34; power <= 100; power += 2) GRID.push([angle, power]);
        }
        const widths = [];
        for (let seed = 1000; seed < 1008; seed++) {
            const arenaId = ARENAS[seed % ARENAS.length];
            for (const m of matchups(arenaId, seed, V3)) {
                for (let round = 1; round <= 6; round++) {
                    const wind = C.windForRound(seed, round);
                    let n = 0;
                    for (const [angle, power] of GRID) if (hits(m, angle, power, wind, V3)) n++;
                    widths.push(n);
                }
            }
        }
        widths.sort((a, b) => a - b);
        const median = widths[Math.floor(widths.length / 2)];
        const share = median / GRID.length;
        assert.truthy(share > 0.02,
            `the median round offers only ${median}/${GRID.length} winning aims (${(share * 100).toFixed(1)}%) — a needle`);
        assert.truthy(share < 0.40,
            `the median round offers ${median}/${GRID.length} winning aims (${(share * 100).toFixed(1)}%) — too easy again`);
    });
});

suite('battle balance: wind is felt, not overwhelming', () => {
    test('v3 uses double v2 wind, and every shipped version stays frozen', () => {
        assert.equal(V1.windAccel, 0.004, 'v1 is frozen — battles replay from it');
        assert.equal(V2.windAccel, 0.002, 'v2 is frozen — battles replay from it');
        assert.equal(V3.windAccel, 0.004);
        assert.equal(V3.windAccel, V2.windAccel * 2,
            'v3 wind must stay double v2 — at v2 strength one aim beat every wind');
        // v3 was edited in place ONCE, and only because production D1 held no
        // v3 battle row to desync. It is frozen now: a battle stores its
        // field_version and both phones replay from it, so moving any of these
        // numbers under a live battle desyncs the two devices. The next
        // physics change adds a v4 and bumps FIELD_VERSION_NEW.
        assert.equal(V3.gravity, 0.15, 'v3 is frozen — add a v4 instead');
        assert.equal(V3.v0Gain, 0.165, 'v3 is frozen — add a v4 instead');
        assert.equal(V3.v0Base, 4, 'v3 is frozen — add a v4 instead');
        assert.deepEqual(V3.spawnX, [140, 1860], 'v3 is frozen — add a v4 instead');
        assert.equal(V3.worldW, 2000, 'v3 is frozen — add a v4 instead');
        assert.equal(V3.castle.halfW, 70, 'v3 is frozen — add a v4 instead');
        assert.equal(V3.castle.height, 122, 'v3 is frozen — add a v4 instead');
    });

    test('changing the wind moves a lob far enough to force a re-aim', () => {
        // A player who found the right aim in calm air must not be able to
        // reuse it after the wind flips.
        // 55 deg / 55 is chosen because all three reference winds LAND on
        // this arena; a stronger lob sails off the 2000px world in a tailwind
        // and would give this test a null to measure.
        const m = matchups(ARENAS[0], SEEDS[0], V3)[0];
        const land = (wind) => C.simulateShot({
            terrain: m.terrain, from: m.from, facing: m.facing,
            angle: 55, power: 55, wind, rules: V3,
        }).hit;
        const calm = land(0), tail = land(20), head = land(-20);
        for (const [name, h] of [['calm', calm], ['tailwind', tail], ['headwind', head]]) {
            assert.truthy(h, `the ${name} reference shot left the field — this test must measure landings`);
        }
        assert.truthy(tail.x > calm.x, 'a tailwind must carry the shot further');
        assert.truthy(head.x < calm.x, 'a headwind must shorten it');
        const spread = tail.x - head.x;
        const castleWidth = V3.castle.halfW * 2;
        assert.truthy(spread > castleWidth,
            `full wind swing moves a lob ${Math.round(spread)}px, less than the ${castleWidth}px castle — ` +
            'the same aim would keep working');
        assert.truthy(spread < V3.worldW,
            `full wind swing moves a lob ${Math.round(spread)}px across a ${V3.worldW}px world — aiming would be pointless`);
    });

    test('a flat shot is still the least wind-sensitive, which is why it needed the nerf', () => {
        // Documents the mechanism so the next person tuning this does not
        // repeat the wrong diagnosis. Flat shots spend less time in the air,
        // so they always drift less; the fix was making that drift big enough
        // to matter against the castle, not removing the difference.
        const m = matchups(ARENAS[0], SEEDS[0], V3)[0];
        const drift = (angle, power) => {
            const at = (wind) => C.simulateShot({
                terrain: m.terrain, from: m.from, facing: m.facing,
                angle, power, wind, rules: V3,
            }).hit;
            const a = at(0), b = at(20);
            return (a && b) ? Math.abs(b.x - a.x) : null;
        };
        const flat = drift(16, 95), lob = drift(55, 55);
        assert.truthy(flat !== null && lob !== null, 'both reference shots must land');
        assert.truthy(lob > flat, 'a lob must drift further than a flat shot — otherwise physics is wrong');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
