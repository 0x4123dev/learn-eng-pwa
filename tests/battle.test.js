// battle.test.js — the pet-battle rules: ammo earned by learning, the
// 4-barrel gun, deterministic physics (both phones must draw the same
// battle from one seed), damage, and the server/client constant pins.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const C = require(path.join(__dirname, '..', 'js', 'battlecalc.js'));
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'api', '_battle.js'), 'utf8');
const turnSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'api', 'battle', 'turn.js'), 'utf8');

suite('battle: ammo is earned only by learning', () => {
    test('no study, no ammo — base is zero', () => {
        assert.equal(C.computeAmmo({ correct: 0, perfects: 0, days: 0 }), 0);
        assert.equal(C.computeAmmo({}), 0);
    });

    test('volume: +1 per 20 correct answers, capped at 8', () => {
        assert.equal(C.computeAmmo({ correct: 19 }), 0);
        assert.equal(C.computeAmmo({ correct: 20 }), 1);
        assert.equal(C.computeAmmo({ correct: 100 }), 5);
        assert.equal(C.computeAmmo({ correct: 160 }), 8);
        assert.equal(C.computeAmmo({ correct: 5000 }), 8, 'volume must cap at 8');
    });

    test('quality: +1 per perfect session, capped at 10', () => {
        assert.equal(C.computeAmmo({ perfects: 3 }), 3);
        assert.equal(C.computeAmmo({ perfects: 10 }), 10);
        assert.equal(C.computeAmmo({ perfects: 99 }), 10, 'perfects must cap at 10');
    });

    test('consistency: +2 only when all three days were studied', () => {
        assert.equal(C.computeAmmo({ days: 2 }), 0);
        assert.equal(C.computeAmmo({ days: 3 }), 2);
        assert.equal(C.computeAmmo({ days: 7 }), 2);
    });

    test('everything together caps at 20 = exactly what 5 rounds can fire', () => {
        assert.equal(C.computeAmmo({ correct: 1000, perfects: 50, days: 3 }), 20);
        assert.equal(C.AMMO_CAP, C.BATTLE_ROUNDS * C.BARRELS, 'cap must equal rounds × barrels');
    });

    test('a realistic three days of study earns a fair amount', () => {
        // ~60 correct, 2 perfect sessions, studied every day
        assert.equal(C.computeAmmo({ correct: 60, perfects: 2, days: 3 }), 3 + 2 + 2);
    });

    test('negative or junk input never produces ammo', () => {
        assert.equal(C.computeAmmo({ correct: -100, perfects: -5, days: -1 }), 0);
        assert.equal(C.computeAmmo(null), 0);
    });

    test('the breakdown shown to the child matches the total', () => {
        const stats = { correct: 85, perfects: 4, days: 3 };
        const rows = C.ammoBreakdown(stats);
        const sum = rows.reduce((n, r) => n + r.shots, 0);
        assert.equal(sum, C.computeAmmo(stats));
        assert.equal(rows.length, 3);
    });

    // The breakdown carries NUMBERS ONLY — the arena is bilingual, so the
    // wording lives in PB_STR (see tests/battle-i18n.test.js).
    test('every row carries the numbers a sentence would need', () => {
        for (const stats of [{ correct: 8 }, { correct: 0 }, { correct: 999, perfects: 99, days: 9 }]) {
            for (const r of C.ammoBreakdown(stats)) {
                for (const k of ['have', 'goal', 'toNext', 'per', 'shots', 'max']) {
                    assert.truthy(Number.isFinite(r[k]), `${r.key}.${k} must be a number, got ${r[k]}`);
                }
                assert.truthy(typeof r.maxed === 'boolean', `${r.key}.maxed must be a flag`);
            }
        }
    });

    test('no language leaks into the rules layer', () => {
        for (const r of C.ammoBreakdown({ correct: 8, perfects: 1, days: 1 })) {
            for (const [k, v] of Object.entries(r)) {
                assert.falsy(typeof v === 'string' && /[À-ỹ]|câu|cấp/.test(v),
                    `${r.key}.${k} contains display text: ${v}`);
            }
        }
    });

    test('the volume row counts toward all 8 shots, not a bare tally', () => {
        const goal = C.AMMO_VOLUME_MAX * C.AMMO_PER_CORRECT;   // 160
        assert.equal(goal, 160);
        const row = C.ammoBreakdown({ correct: 8 }).find(r => r.key === 'volume');
        assert.equal(row.shots, 0, '8 correct answers is not yet one shot');
        assert.equal(row.have, 8);
        assert.equal(row.goal, 160);
        assert.equal(row.toNext, 12, '12 more answers to the next shot');
        assert.equal(row.per, C.AMMO_PER_CORRECT);
    });

    test('a maxed row is flagged so the UI can celebrate instead of nagging', () => {
        for (const r of C.ammoBreakdown({ correct: 500, perfects: 50, days: 3 })) {
            assert.equal(r.shots, r.max, `${r.key} should be maxed`);
            assert.truthy(r.maxed, `${r.key}.maxed should be true`);
        }
    });

    test('progress never overstates past the goal', () => {
        const row = C.ammoBreakdown({ correct: 5000 }).find(r => r.key === 'volume');
        assert.equal(row.have, 160, 'have must cap at the goal');
    });

    // The arena showed ammo only, so a child could not tell that their pet's
    // level also decides how hard each shot lands.
    test('the power card reports what the level is actually worth', () => {
        const p = C.powerProfile(42);
        assert.equal(p.level, 42);
        assert.equal(p.stats.length, 3);
        for (const s of p.stats) {
            assert.truthy(s.icon, `${s.key} needs an icon`);
            assert.falsy(s.label, `${s.key} must not carry display text — the arena is bilingual`);
            assert.truthy(s.value > 0 && s.max > 0, `${s.key} needs real numbers`);
        }
    });

    // Damage is uncapped while blast and shell stop at level 200, so a level
    // 400 pet showed "60.0/36.0" and a bar running off its own track.
    test('the bar never overflows, at any level', () => {
        for (const lv of [1, 42, 199, 200, 201, 400, 5000]) {
            for (const s of C.powerProfile(lv).stats) {
                assert.truthy(s.ratio >= 0 && s.ratio <= 1,
                    `level ${lv}, ${s.key}: ratio ${s.ratio} must stay within 0..1`);
            }
        }
    });

    test('a stat past the level-200 reference is flagged, not shown as a fraction', () => {
        const dmg = (lv) => C.powerProfile(lv).stats.find(s => s.key === 'damage');
        assert.falsy(dmg(150).beyond, 'below the reference is a normal fraction');
        assert.truthy(dmg(400).beyond, 'above the reference must be flagged');
        assert.truthy(dmg(400).value > dmg(400).max, 'this is exactly the case that read 60.0/36.0');
        assert.equal(dmg(400).ratio, 1, 'and its bar sits full');
    });

    // Re-typed constants are how a display starts lying about the physics.
    test('power numbers come from the physics functions themselves', () => {
        for (const lv of [1, 25, 100, 200, 500]) {
            const p = C.powerProfile(lv);
            const by = (k) => p.stats.find(s => s.key === k).value;
            assert.equal(by('blast'), C.blastRadius(lv));
            assert.equal(by('damage'), C.shotDamage(lv));
            assert.equal(by('shell'), C.shellSize(lv));
        }
    });

    test('a higher level really does mean a stronger card', () => {
        const low = C.powerProfile(5), high = C.powerProfile(150);
        for (const k of ['blast', 'damage', 'shell']) {
            const v = (p) => p.stats.find(s => s.key === k).value;
            assert.truthy(v(high) > v(low), `${k} must grow with level`);
        }
    });

    test('a capped stat promises no further growth', () => {
        // Blast radius and shell size cap at level 200; the card must not keep
        // dangling "+x mỗi 10 cấp" once more levels buy nothing.
        const p = C.powerProfile(400);
        for (const k of ['blast', 'shell']) {
            assert.equal(p.stats.find(s => s.key === k).per10, 0, `${k} is capped, per10 must be 0`);
        }
        assert.truthy(p.stats.find(s => s.key === 'damage').per10 > 0, 'damage keeps growing');
    });

    test('junk levels never break the card', () => {
        for (const bad of [0, -50, null, undefined, NaN, 1.7]) {
            const p = C.powerProfile(bad);
            assert.truthy(p.level >= 1, `level ${bad} → ${p.level}`);
            for (const s of p.stats) assert.truthy(Number.isFinite(s.value), `${s.key} must be finite`);
        }
    });

    // A poop that visibly lands on the house has to hurt it. Damage used to be
    // measured from the pet's GROUND ANCHOR with a ~21px blast radius at level
    // 17, while the drawn house once spanned 104px — so most of the building was
    // decoration and a child watched direct hits do nothing.
    test('anywhere on the castle counts as a hit', () => {
        const V2 = C.fieldRules(2);
        const target = { x: 1000, y: 400 };
        const half = V2.castle.halfW;
        for (const dx of [0, 20, 30, half - 1, half]) {
            for (const sign of [1, -1]) {
                const dmg = C.damageAt({ x: target.x + sign * dx, y: target.y }, target, 17, V2);
                assert.truthy(dmg > 0, `a poop ${dx}px from centre dealt nothing — it landed on the house`);
            }
        }
    });

    test('the collision target matches the larger castle silhouette', () => {
        const V2 = C.fieldRules(2);
        assert.equal(V2.castle.halfW, 70);
        assert.equal(V2.castle.height, 122);
    });

    test('a shot beyond the castle still falls off, and a far miss is nothing', () => {
        const V2 = C.fieldRules(2);
        const target = { x: 1000, y: 400 };
        const near = C.damageAt({ x: 1000 + V2.castle.halfW + 8, y: 400 }, target, 17, V2);
        const far = C.damageAt({ x: 1000 + V2.castle.halfW + 200, y: 400 }, target, 17, V2);
        assert.truthy(near > 0, 'a graze just past the wall should still count');
        assert.equal(far, 0, 'a shot in the next field must do nothing');
    });

    test('a hit on the castle cannot exceed what the server would allow', () => {
        // The server clamps a volley to maxTurnDamage; widening the target
        // must not let a legitimate volley be rejected as impossible.
        const V2 = C.fieldRules(2);
        for (const level of [1, 17, 50, 200]) {
            const perShot = C.damageAt({ x: 1000, y: 400 }, { x: 1000, y: 400 }, level, V2);
            for (const shots of [1, 2, 3, 4]) {
                assert.truthy(perShot * shots <= C.maxTurnDamage(shots, level),
                    `level ${level}, ${shots} shots: ${perShot * shots} exceeds the server clamp ${C.maxTurnDamage(shots, level)}`);
            }
        }
    });

    test('v1 damage is untouched — it still measures from the pet', () => {
        const target = { x: 400, y: 400 };
        assert.equal(C.damageAt({ x: 440, y: 400 }, target, 17), 0, 'v1 must keep its point target');
        assert.equal(C.damageAt({ x: 440, y: 400 }, target, 17, C.fieldRules(1)), 0);
        assert.truthy(C.damageAt({ x: 400, y: 400 }, target, 17) > 0);
    });

    // The server is authoritative; a drifted copy would let a client claim
    // ammo the server would never grant.
    test('server and client ammo constants are identical', () => {
        for (const [name, val] of [
            ['AMMO_PER_CORRECT', C.AMMO_PER_CORRECT], ['AMMO_VOLUME_MAX', C.AMMO_VOLUME_MAX],
            ['AMMO_PERFECT_MAX', C.AMMO_PERFECT_MAX], ['AMMO_STREAK_BONUS', C.AMMO_STREAK_BONUS],
            ['AMMO_CAP', C.AMMO_CAP], ['BARRELS', C.BARRELS], ['BATTLE_ROUNDS', C.BATTLE_ROUNDS],
        ]) {
            const m = serverSrc.match(new RegExp('export const ' + name + ' = (\\d+)'));
            assert.truthy(m, `server missing ${name}`);
            assert.equal(+m[1], val, `${name} differs between server and client`);
        }
    });
});

suite('battle: the 4-barrel gun', () => {
    test('you may load at most 4 tia, and never more than you own', () => {
        assert.equal(C.maxShotsThisTurn(20), 4);
        assert.equal(C.maxShotsThisTurn(4), 4);
        assert.equal(C.maxShotsThisTurn(2), 2);
        assert.equal(C.maxShotsThisTurn(0), 0);
        assert.equal(C.maxShotsThisTurn(-3), 0);
    });

    test('a volley fans out — more tia means a wider spread, not a stack', () => {
        const one = C.volleyAngles(45, 1, 123, 1);
        assert.deepEqual(one, [45]);
        const four = C.volleyAngles(45, 4, 123, 1);
        assert.equal(four.length, 4);
        const spread4 = Math.max(...four) - Math.min(...four);
        const two = C.volleyAngles(45, 2, 123, 1);
        const spread2 = Math.max(...two) - Math.min(...two);
        assert.truthy(spread4 > spread2, '4 tia must spread wider than 2');
        assert.truthy(spread4 < 20, 'the fan stays aimed at the target');
    });

    test('a volley is deterministic: same seed and turn → same angles', () => {
        assert.deepEqual(C.volleyAngles(50, 3, 999, 4), C.volleyAngles(50, 3, 999, 4));
        assert.falsy(
            JSON.stringify(C.volleyAngles(50, 3, 999, 4)) === JSON.stringify(C.volleyAngles(50, 3, 999, 5)),
            'different turns should jitter differently');
    });

    test('loading more than 4 is clamped by the rules, not trusted', () => {
        assert.equal(C.volleyAngles(45, 99, 1, 1).length, C.BARRELS);
    });
});

suite('battle: deterministic world (both phones draw the same battle)', () => {
    test('the same seed always builds the same terrain', () => {
        const a = C.buildTerrain(4242), b = C.buildTerrain(4242);
        assert.deepEqual(a, b);
        assert.equal(a.length, C.FIELD_W);
    });

    test('different seeds build different terrain', () => {
        assert.falsy(JSON.stringify(C.buildTerrain(1)) === JSON.stringify(C.buildTerrain(2)));
    });

    test('terrain stays inside the playable band', () => {
        const t = C.buildTerrain(77);
        for (const y of t) assert.inRange(y, 240, 410);
    });

    test('both pets spawn on the ground, near opposite edges', () => {
        const t = C.buildTerrain(31);
        const [l, r] = C.spawnPoints(t);
        assert.equal(l.y, t[l.x]);
        assert.equal(r.y, t[r.x]);
        assert.truthy(r.x - l.x > 400, 'they must not start on top of each other');
    });

    // Fairness: a child must never lose a turn to their own hillside.
    test('no seed traps a pet behind its own hill (300 seeds, both sides)', () => {
        let blocked = 0;
        for (let seed = 1; seed <= 300; seed++) {
            const t = C.buildTerrain(seed);
            const [l, r] = C.spawnPoints(t);
            for (const [from, facing] of [[l, 1], [r, -1]]) {
                const shot = C.simulateShot({ terrain: t, from, facing, angle: 45, power: 75, wind: 0 });
                if (shot.hit && Math.abs(shot.hit.x - from.x) < 120) blocked++;
            }
        }
        assert.equal(blocked, 0, `${blocked} shots slammed into the shooter's own hill`);
    });

    test('each pet stands on levelled ground (no half-buried pets)', () => {
        for (const seed of [3, 17, 91, 250]) {
            const t = C.buildTerrain(seed);
            for (const p of C.spawnPoints(t)) {
                for (let x = p.x - 30; x <= p.x + 30; x++) {
                    assert.equal(t[x], p.y, `terrain under the pet is not flat (seed ${seed})`);
                }
            }
        }
    });

    test('wind is per-round, repeatable, and within ±20', () => {
        for (let round = 1; round <= 5; round++) {
            const w = C.windForRound(555, round);
            assert.equal(w, C.windForRound(555, round));
            assert.inRange(w, -20, 20);
        }
    });

    test('the same shot replays identically — the core sync guarantee', () => {
        const t = C.buildTerrain(8080);
        const from = C.spawnPoints(t)[0];
        const shot = () => C.simulateShot({ terrain: t, from, facing: 1, angle: 42, power: 70, wind: 7 });
        const a = shot(), b = shot();
        assert.equal(a.points.length, b.points.length);
        assert.deepEqual(a.hit, b.hit);
        assert.deepEqual(a.points[a.points.length - 1], b.points[b.points.length - 1]);
    });

    test('shots arc: they rise, then fall, and always terminate', () => {
        const t = C.buildTerrain(11);
        const from = C.spawnPoints(t)[0];
        const r = C.simulateShot({ terrain: t, from, facing: 1, angle: 55, power: 80, wind: 0 });
        assert.truthy(r.points.length > 5);
        assert.truthy(r.frames < 900, 'must not run forever');
        const ys = r.points.map(p => p.y);
        assert.truthy(Math.min(...ys) < from.y, 'the shell should go up');
    });

    test('wind bends the trajectory', () => {
        const t = C.buildTerrain(12);
        const from = C.spawnPoints(t)[0];
        const calm = C.simulateShot({ terrain: t, from, facing: 1, angle: 45, power: 70, wind: 0 });
        const windy = C.simulateShot({ terrain: t, from, facing: 1, angle: 45, power: 70, wind: 20 });
        const lastCalm = calm.points[calm.points.length - 1];
        const lastWindy = windy.points[windy.points.length - 1];
        assert.truthy(lastWindy.x !== lastCalm.x, 'wind must change where it lands');
    });

    test('more power carries the shell further', () => {
        const t = new Array(C.FIELD_W).fill(380);
        const from = { x: 90, y: 380 };
        const near = C.simulateShot({ terrain: t, from, facing: 1, angle: 45, power: 30, wind: 0 });
        const far = C.simulateShot({ terrain: t, from, facing: 1, angle: 45, power: 90, wind: 0 });
        assert.truthy((far.hit ? far.hit.x : 9999) > (near.hit ? near.hit.x : 0));
    });
});

suite('battle: damage scales with the pet you raised', () => {
    test('a higher level means a bigger blast, bigger shell and more damage', () => {
        assert.truthy(C.blastRadius(100) > C.blastRadius(1));
        assert.truthy(C.shotDamage(100) > C.shotDamage(1));
        assert.truthy(C.shellSize(100) > C.shellSize(1));
    });

    test('blast radius and shell size stay within sane caps', () => {
        assert.equal(C.blastRadius(100000), 48);
        assert.equal(C.shellSize(100000), 11);
    });

    test('a direct hit hurts more than a near miss, a far miss does nothing', () => {
        const target = { x: 400, y: 300 };
        const direct = C.damageAt({ x: 400, y: 300 }, target, 20);
        const near = C.damageAt({ x: 400 + C.blastRadius(20) * 0.8, y: 300 }, target, 20);
        const miss = C.damageAt({ x: 400 + C.blastRadius(20) + 5, y: 300 }, target, 20);
        assert.truthy(direct > near, 'centre must hurt most');
        assert.truthy(near > 0);
        assert.equal(miss, 0);
    });

    test('a missed shot (no hit) deals nothing', () => {
        assert.equal(C.damageAt(null, { x: 0, y: 0 }, 50), 0);
    });

    test('maxTurnDamage bounds what a client may claim', () => {
        assert.equal(C.maxTurnDamage(0, 50), 0);
        assert.truthy(C.maxTurnDamage(4, 50) > C.maxTurnDamage(1, 50));
        assert.equal(C.maxTurnDamage(99, 50), C.maxTurnDamage(4, 50), 'clamped to the barrel count');
        // a full volley must not one-shot a 100 HP pet at low levels
        assert.truthy(C.maxTurnDamage(4, 1) < 100, 'level 1 cannot one-shot');
    });

    test('the server clamps reported damage with the same rule', () => {
        assert.truthy(turnSrc.includes('maxTurnDamage'), 'turn.js must clamp damage');
        assert.truthy(/Math\.min\(maxTurnDamage/.test(turnSrc), 'clamp must be applied to the reported value');
    });
});

suite('battle: server rules are enforced, not trusted', () => {
    test('ammo is computed on the server from synced activity', () => {
        assert.truthy(serverSrc.includes('FROM activities'), 'ammo must come from the DB');
        assert.truthy(serverSrc.includes('-3 days'), 'ammo window is the last 3 days');
    });

    test('the 3-day cooldown and 60s invite window are server-side', () => {
        assert.truthy(/COOLDOWN_MS = 72 \* 60 \* 60 \* 1000/.test(serverSrc));
        assert.truthy(/INVITE_TTL_MS = 60 \* 1000/.test(serverSrc));
    });

    test('only friends can be challenged, and only on your own turn', () => {
        const challengeSrc = fs.readFileSync(
            path.join(__dirname, '..', 'functions', 'api', 'battle', 'challenge.js'), 'utf8');
        assert.truthy(challengeSrc.includes('areFriends'), 'challenge must check friendship');
        assert.truthy(challengeSrc.includes('ammo <= 0'), 'no ammo ⇒ no challenge');
        assert.truthy(turnSrc.includes('turn_user_id !== auth.uid'), 'turns must check whose turn it is');
    });

    test('a friend activity feed never exposes raw answers', () => {
        const actSrc = fs.readFileSync(
            path.join(__dirname, '..', 'functions', 'api', 'friends', 'activity.js'), 'utf8');
        assert.truthy(actSrc.includes('areFriends'), 'must verify friendship');
        assert.falsy(/detail_json|answers_json/.test(actSrc), 'must not select raw answer data');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
