// teammates.test.js — hired đồng đội: the roster, the coin maths, and the
// three abilities.
//
// Everything here is PURE: no DOM, no network. Both phones run these same
// functions over the same action stream, so if any constant drifts the two
// devices would silently diverge mid-battle. That is why the numbers are
// pinned here rather than trusted to the UI.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const T = require(path.join(root, 'js', 'battle-teammates.js'));
const calc = require(path.join(root, 'js', 'battlecalc.js'));

suite('teammates: the roster', () => {
    test('three specialists at the agreed fees', () => {
        assert.equal(T.TEAM_ROSTER.length, 3);
        const fee = (id) => T.teammateById(id).fee;
        assert.equal(fee('gunner'), 600);
        assert.equal(fee('engineer'), 1000);
        assert.equal(fee('shield'), 1400);
    });

    test('every teammate carries what the UI needs to draw it', () => {
        for (const t of T.TEAM_ROSTER) {
            assert.truthy(t.id, 'missing id');
            assert.truthy(t.emoji, `${t.id} has no emoji`);
            assert.truthy(t.fee > 0, `${t.id} must cost something`);
        }
    });

    test('an unknown id resolves to nothing rather than a broken object', () => {
        assert.equal(T.teammateById('dragon'), null);
        assert.equal(T.teammateById(''), null);
        assert.equal(T.teammateById(null), null);
    });
});

suite('teammates: hiring and coins', () => {
    test('duplicates are kept — two Vệ sĩ is a real squad', () => {
        assert.deepEqual(T.normalizeHires(['shield', 'shield']), ['shield', 'shield']);
    });

    test('unknown ids are dropped, not priced', () => {
        assert.deepEqual(T.normalizeHires(['gunner', 'dragon', 'engineer']), ['gunner', 'engineer']);
    });

    test('a squad is capped at five so the castle and chips still fit a phone', () => {
        const ten = Array.from({ length: 10 }, () => 'gunner');
        assert.equal(T.normalizeHires(ten).length, T.TEAM_MAX_HIRES);
        assert.equal(T.TEAM_MAX_HIRES, 5);
    });

    test('junk in means an empty squad, never a crash', () => {
        assert.deepEqual(T.normalizeHires(null), []);
        assert.deepEqual(T.normalizeHires('gunner'), []);
        assert.deepEqual(T.normalizeHires([1, {}, null]), []);
    });

    test('the fee is the sum of what was actually hired', () => {
        assert.equal(T.hireCost(['gunner', 'gunner']), 1200);
        assert.equal(T.hireCost(['gunner', 'engineer', 'shield']), 3000);
        assert.equal(T.hireCost([]), 0);
        assert.equal(T.hireCost(null), 0);
    });

    test('an over-long or junk squad is priced on what survives normalization', () => {
        const ten = Array.from({ length: 10 }, () => 'gunner');
        assert.equal(T.hireCost(ten), 5 * 600, 'never charge for hires that were dropped');
        assert.equal(T.hireCost(['gunner', 'dragon']), 600);
    });
});

suite('teammates: food finally matters in battle', () => {
    test('a fresh pet still starts on the standard 100 HP', () => {
        assert.equal(T.startingHp(1), 100);
        assert.equal(T.startingHp(9), 100);
    });

    test('every ten pet levels is one more point of castle', () => {
        assert.equal(T.startingHp(10), 101);
        assert.equal(T.startingHp(50), 105);
        assert.equal(T.startingHp(100), 110);
    });

    test('the bonus stops at +15 so aim always beats a fat pet', () => {
        assert.equal(T.startingHp(150), 115);
        assert.equal(T.startingHp(200), 115);
        assert.equal(T.startingHp(9999), 115);
    });

    test('a missing or junk level is treated as a new pet', () => {
        assert.equal(T.startingHp(0), 100);
        assert.equal(T.startingHp(-5), 100);
        assert.equal(T.startingHp('abc'), 100);
        assert.equal(T.startingHp(null), 100);
    });
});

suite('teammates: the three abilities', () => {
    test('the rocket carries 60% of a shell', () => {
        assert.equal(T.rocketDamage(20), 12);
        assert.equal(T.rocketDamage(10), 6);
    });

    test('a rocket that rides a miss does nothing', () => {
        assert.equal(T.rocketDamage(0), 0);
        assert.equal(T.rocketDamage(null), 0);
    });

    test('a rocket riding a graze still scratches', () => {
        // Rounding 0.6 of a 1-damage graze to zero would make the Gunner feel
        // broken on the very shots a child is most anxious about.
        assert.equal(T.rocketDamage(1), 1);
    });

    test('the engineer repairs fifteen', () => {
        assert.equal(T.applyRepair(50, 100), 65);
    });

    test('a repair can never overfill the castle', () => {
        assert.equal(T.applyRepair(95, 100), 100);
        assert.equal(T.applyRepair(100, 100), 100);
        // A level-boosted castle repairs up to ITS max, not a flat 100.
        assert.equal(T.applyRepair(108, 115), 115);
        assert.equal(T.applyRepair(90, 115), 105);
    });

    test('the shield halves an incoming volley', () => {
        assert.equal(T.shieldedDamage(40), 20);
    });

    test('an odd volley rounds in favour of the child who paid 1,400', () => {
        assert.equal(T.shieldedDamage(21), 10);
        assert.equal(T.shieldedDamage(1), 0, 'a shield fully absorbs a graze');
    });

    test('a shield over nothing is still nothing', () => {
        assert.equal(T.shieldedDamage(0), 0);
        assert.equal(T.shieldedDamage(null), 0);
    });
});

suite('teammates: the v4 battlefield', () => {
    test('v4 exists and its castle is the bigger fortress', () => {
        const v3 = calc.FIELD_RULES[3];
        const v4 = calc.FIELD_RULES[4];
        assert.truthy(v4, 'no v4 rules');
        assert.equal(v4.version, 4);
        assert.truthy(v4.castle.halfW > v3.castle.halfW, 'v4 castle must be wider');
        assert.truthy(v4.castle.height > v3.castle.height, 'v4 castle must be taller');
    });

    test('v4 keeps the proven v3 ballistics — only the building changed', () => {
        const v3 = calc.FIELD_RULES[3];
        const v4 = calc.FIELD_RULES[4];
        for (const k of ['worldW', 'viewW', 'worldH', 'gravity', 'windAccel',
                          'v0Base', 'v0Gain', 'plateau', 'lane', 'waveScale',
                          'groundMin', 'groundMax', 'muzzleY', 'muzzleClearance', 'maxFrames']) {
            assert.deepEqual(v4[k], v3[k], `v4 changed ${k} — physics must be untouched`);
        }
        assert.deepEqual(v4.spawnX, v3.spawnX);
    });

    test('fieldRules resolves 4, and still refuses anything unknown', () => {
        assert.equal(calc.fieldRules(4).version, 4);
        assert.equal(calc.fieldRules(99).version, 1, 'unknown must fall back to v1');
        assert.equal(calc.fieldRules(undefined).version, 1);
    });

    test('the shipped versions are frozen — a stored battle must replay forever', () => {
        // Every one of these is load-bearing for a battle row already in D1.
        assert.equal(calc.FIELD_RULES[1].castle, null);
        assert.deepEqual(calc.FIELD_RULES[2].castle, { halfW: 70, height: 122 });
        assert.deepEqual(calc.FIELD_RULES[3].castle, { halfW: 70, height: 122 });
        assert.equal(calc.FIELD_RULES[3].windAccel, 0.004);
        assert.equal(calc.FIELD_RULES[3].worldW, 2000);
    });

    test('the enlarged castle is a real target — a shell on the wall counts', () => {
        const v4 = calc.FIELD_RULES[4];
        const target = { x: 1000, y: 300 };
        // Dead centre of the wall, at a spot that is OUTSIDE the old v3 box.
        const onWall = { x: 1000 + v4.castle.halfW - 4, y: 300 - 10 };
        assert.truthy(calc.damageAt(onWall, target, 20, v4) > 0,
            'a shell striking the v4 wall must damage the castle');
    });
});

const game = require(path.join(root, 'js', 'petbattlegame.js'));

suite('teammates: the castle they live in', () => {
    test('the art is drawn at exactly the size the physics hits', () => {
        // v2 shipped with damage measured 40px from where the wall was drawn,
        // so a poop could land on the house for nothing. The drawing is scaled
        // FROM the rules now, so the two cannot drift apart again.
        const v3 = calc.FIELD_RULES[3];
        const v4 = calc.FIELD_RULES[4];
        const s3 = game.pbCastleScale(v3);
        assert.equal(s3.sx, 1, 'v3 is the native size the art was drawn at');
        assert.equal(s3.sy, 1);
        const s4 = game.pbCastleScale(v4);
        assert.equal(s4.sx, v4.castle.halfW / v3.castle.halfW);
        assert.equal(s4.sy, v4.castle.height / v3.castle.height);
        assert.truthy(s4.sx > 1 && s4.sy > 1, 'v4 must actually be bigger');
    });

    test('a castle-less or missing ruleset still draws at native size', () => {
        assert.deepEqual(game.pbCastleScale(null), { sx: 1, sy: 1 });
        assert.deepEqual(game.pbCastleScale(calc.FIELD_RULES[1]), { sx: 1, sy: 1 });
    });

    test('there is one ledge for every teammate a child may hire', () => {
        assert.equal(game.PB_LEDGE_SLOTS.length, T.TEAM_MAX_HIRES);
    });

    test('every ledge sits inside the drawn castle, not in open sky', () => {
        // The squad is drawn INSIDE the already-scaled castle context, so the
        // slots live in the art's native 70x122 space. Measuring them against
        // the larger v4 box scaled them twice and hung the planks outside the
        // silhouette — bounds are checked against the drawn result here.
        const v4 = calc.FIELD_RULES[4];
        const cs = game.pbCastleScale(v4);
        const PLANK_HALF_W = 16;
        for (const slot of game.PB_LEDGE_SLOTS) {
            const worldX = Math.abs(slot.x) + PLANK_HALF_W;
            assert.truthy(worldX * cs.sx <= v4.castle.halfW,
                `a ledge at x=${slot.x} juts out past the wall`);
            assert.truthy(slot.y < 0 && Math.abs(slot.y) * cs.sy < v4.castle.height,
                `a ledge at y=${slot.y} escaped the storeys`);
        }
    });

    test('nobody stands in front of the dog', () => {
        // The arched kennel window is x ±30, y -63..-13 in native space.
        for (const slot of game.PB_LEDGE_SLOTS) {
            const overWindow = Math.abs(slot.x) < 30 && slot.y > -63 && slot.y < -13;
            assert.falsy(overWindow, `a teammate at (${slot.x},${slot.y}) covers the pet`);
        }
    });

    test('ledges are staggered, never stacked on one spot', () => {
        const seen = new Set(game.PB_LEDGE_SLOTS.map(s => s.x + ':' + s.y));
        assert.equal(seen.size, game.PB_LEDGE_SLOTS.length, 'two teammates would overlap');
    });

    test('the squad is placed one spot per hire', () => {
        assert.equal(game.pbLedgeSpots(3).length, 3);
        assert.deepEqual(game.pbLedgeSpots(1), [game.PB_LEDGE_SLOTS[0]]);
    });

    test('asking for more spots than ledges never invents one', () => {
        assert.equal(game.pbLedgeSpots(99).length, T.TEAM_MAX_HIRES);
        assert.equal(game.pbLedgeSpots(0).length, 0);
        assert.equal(game.pbLedgeSpots(-3).length, 0);
    });
});

suite('teammates: the hire cart', () => {
    test('hiring adds one charge and charges for it', () => {
        assert.deepEqual(T.hireAdd([], 'gunner', 5000), ['gunner']);
        assert.deepEqual(T.hireAdd(['gunner'], 'gunner', 5000), ['gunner', 'gunner']);
    });

    test('a squad you cannot afford is refused, not silently trimmed', () => {
        // 600 + 1400 = 2000; with 1,500 xu the Vệ sĩ must not go in.
        assert.deepEqual(T.hireAdd(['gunner'], 'shield', 1500), ['gunner'],
            'the cart must not exceed the purse');
        assert.deepEqual(T.hireAdd([], 'gunner', 599), [], 'not even one');
        assert.deepEqual(T.hireAdd([], 'gunner', 600), ['gunner'], 'exactly enough is enough');
    });

    test('the sixth hire is refused however rich the child is', () => {
        const five = ['gunner', 'gunner', 'gunner', 'gunner', 'gunner'];
        assert.deepEqual(T.hireAdd(five, 'gunner', 999999), five);
    });

    test('an unknown teammate cannot be hired', () => {
        assert.deepEqual(T.hireAdd([], 'dragon', 999999), []);
    });

    test('dismissing removes exactly one, not every copy', () => {
        assert.deepEqual(T.hireRemove(['gunner', 'gunner', 'shield'], 'gunner'), ['gunner', 'shield']);
    });

    test('dismissing someone not hired changes nothing', () => {
        assert.deepEqual(T.hireRemove(['gunner'], 'shield'), ['gunner']);
        assert.deepEqual(T.hireRemove([], 'gunner'), []);
    });

    test('a full cart reports what it costs', () => {
        const cart = T.hireAdd(T.hireAdd([], 'gunner', 9999), 'engineer', 9999);
        assert.equal(T.hireCost(cart), 1600);
    });
});

// A battle view as the server hands it over, trimmed to what the engine reads.
function fakeView(over) {
    const v = {
        seed: 12345, fieldVersion: 4, backgroundId: 'cloudstep-meadow',
        iAmChallenger: true, turnNo: 1, myTurn: true,
        me:  { id: 'me',  name: 'Me',  hp: 100, ammo: 8, level: 30, hires: [] },
        foe: { id: 'foe', name: 'Foe', hp: 100, ammo: 8, level: 30, hires: [] },
    };
    if (over && over.me) Object.assign(v.me, over.me);
    if (over && over.foe) Object.assign(v.foe, over.foe);
    return v;
}

suite('teammates: the squad inside a live battle', () => {
    test('each side gets one charge per hire, unused', () => {
        const g = new game.PetBattleGame({
            view: fakeView({ me: { hires: ['gunner', 'gunner', 'shield'] } }), mount: null,
        });
        assert.equal(g.myCharges.length, 3);
        assert.deepEqual(g.myCharges.map(c => c.id), ['gunner', 'gunner', 'shield']);
        assert.truthy(g.myCharges.every(c => c.used === false), 'nobody starts spent');
    });

    test('a squad relayed from the other phone is not trusted blindly', () => {
        const g = new game.PetBattleGame({
            view: fakeView({ foe: { hires: ['dragon', 'engineer', 'gunner', 'gunner', 'gunner', 'gunner', 'gunner'] } }),
            mount: null,
        });
        assert.equal(g.foeCharges.length, T.TEAM_MAX_HIRES, 'an over-long squad must be clamped');
        assert.falsy(g.foeCharges.some(c => c.id === 'dragon'), 'an invented teammate must be dropped');
    });

    test('a battle with no hires has empty benches, not undefined', () => {
        const g = new game.PetBattleGame({ view: fakeView(), mount: null });
        assert.deepEqual(g.myCharges, []);
        assert.deepEqual(g.foeCharges, []);
    });

    test('each castle shows its OWN squad', () => {
        const g = new game.PetBattleGame({
            view: fakeView({ me: { hires: ['gunner'] }, foe: { hires: ['shield', 'shield'] } }),
            mount: null,
        });
        assert.deepEqual(g.myCharges.map(c => c.id), ['gunner']);
        assert.deepEqual(g.foeCharges.map(c => c.id), ['shield', 'shield']);
    });

    test('a castle renders from a bare context, squad or not', () => {
        // The drawing routine takes what it draws; it must not require a fully
        // built game to run (tests/battlelink.test.js renders every stage from
        // a stub context).
        const gradient = { addColorStop() {} };
        const ctx = new Proxy({ createLinearGradient: () => gradient }, {
            get(t, k) { return (k in t) ? t[k] : () => {}; },
            set(t, k, v) { t[k] = v; return true; },
        });
        const charges = T.buildCharges(['gunner', 'engineer']);
        game.PetBattleGame.prototype._drawHouse.call(
            { ctx, rules: calc.FIELD_RULES[4] },
            { x: 140, y: 360 }, null, 1, 88, 45, '#38bdf8', 17, charges
        );
    });

    test('castle HP starts from the pet the child actually fed', () => {
        const g = new game.PetBattleGame({
            view: fakeView({ me: { level: 120 }, foe: { level: 5 } }), mount: null,
        });
        assert.equal(g.myMaxHp, 112, 'level 120 is +12 castle');
        assert.equal(g.foeMaxHp, 100, 'a young pet gets the plain castle');
    });
});

suite('teammates: triggering a charge', () => {
    const mk = (over) => new game.PetBattleGame({ view: fakeView(over), mount: null });

    test('the engineer repairs, and only once', () => {
        const g = mk({ me: { hires: ['engineer'], level: 0 } });
        g.myHp = 60;
        const key = g.myCharges[0].key;
        assert.truthy(g.useCharge(key), 'the first tap must work');
        assert.equal(g.myHp, 75);
        assert.truthy(g.myCharges[0].used, 'the charge is spent');
        assert.falsy(g.useCharge(key), 'a spent charge cannot fire again');
        assert.equal(g.myHp, 75, 'and cannot heal again');
    });

    test('a repair never overfills the castle the pet earned', () => {
        const g = mk({ me: { hires: ['engineer'], level: 120 } });   // max 112
        g.myHp = 105;
        g.useCharge(g.myCharges[0].key);
        assert.equal(g.myHp, 112, 'capped at this castle, not a flat 100');
    });

    test('a charge cannot be spent on the opponent’s turn', () => {
        const g = mk({ me: { hires: ['engineer'] } });
        g.myTurn = false;
        g.myHp = 50;
        assert.falsy(g.useCharge(g.myCharges[0].key));
        assert.equal(g.myHp, 50);
        assert.falsy(g.myCharges[0].used, 'and it stays in hand');
    });

    test('a charge cannot be spent after the battle ends', () => {
        const g = mk({ me: { hires: ['engineer'] } });
        g.finished = true;
        g.myHp = 50;
        assert.falsy(g.useCharge(g.myCharges[0].key));
        assert.equal(g.myHp, 50);
    });

    test('an unknown charge key does nothing', () => {
        const g = mk({ me: { hires: ['engineer'] } });
        assert.falsy(g.useCharge('nope-9'));
        assert.falsy(g.myCharges[0].used);
    });

    test('the shield halves the next volley that lands on me, then falls', () => {
        const g = mk({ me: { hires: ['shield'] } });
        assert.equal(g._incomingDamage(40), 40, 'no shield, no reduction');
        g.useCharge(g.myCharges[0].key);
        assert.truthy(g.myShieldUp);
        assert.equal(g._incomingDamage(40), 20, 'halved');
        assert.falsy(g.myShieldUp, 'a shield absorbs one volley only');
        assert.equal(g._incomingDamage(40), 40, 'the next one lands in full');
    });

    test('the opponent’s shield halves what I deal them', () => {
        const g = mk({ foe: { hires: ['shield'] } });
        g.foeShieldUp = true;
        assert.equal(g._outgoingDamage(31), 15, 'rounded in the defender’s favour');
        assert.falsy(g.foeShieldUp);
        assert.equal(g._outgoingDamage(31), 31);
    });

    test('the gunner arms the next volley rather than firing alone', () => {
        const g = mk({ me: { hires: ['gunner'] } });
        assert.falsy(g.myRocket);
        g.useCharge(g.myCharges[0].key);
        assert.truthy(g.myRocket, 'armed, waiting for the shot the child aims');
        assert.truthy(g.myCharges[0].used);
    });

    test('abilities used on my turn are carried on that turn’s payload', () => {
        const g = mk({ me: { hires: ['engineer', 'shield'] } });
        g.useCharge(g.myCharges[0].key);
        g.useCharge(g.myCharges[1].key);
        assert.deepEqual(g.myPending, ['engineer', 'shield'],
            'the opponent has to be told, or the two phones disagree on HP');
    });

    test('a relayed turn applies the opponent’s abilities too', () => {
        const g = mk({ foe: { hires: ['engineer', 'shield'], level: 0 } });
        g.foeHp = 50;
        g._applyFoeAbilities(['engineer', 'shield']);
        assert.equal(g.foeHp, 65, 'their engineer repaired their castle');
        assert.truthy(g.foeShieldUp, 'and their guard raised a shield');
        assert.truthy(g.foeCharges[0].used && g.foeCharges[1].used,
            'their bench must show the charges as spent');
    });

    test('a relayed turn cannot invent abilities they never hired', () => {
        const g = mk({ foe: { hires: [] } });
        g.foeHp = 50;
        g._applyFoeAbilities(['engineer', 'engineer', 'dragon']);
        assert.equal(g.foeHp, 50, 'a tampered turn must not heal a castle for free');
    });
});

suite('teammates: a charge changes the fight', () => {
    const mk = (over) => new game.PetBattleGame({ view: fakeView(over), mount: null });

    // Find an aim that actually lands, so the rocket has a hit to ride.
    function landingAim(g) {
        for (let angle = 20; angle <= 75; angle += 1) {
            for (let power = 40; power <= 100; power += 5) {
                const d = g._launch(g.mePos, g.meFacing, angle, power, 1, 40, g.foePos, false);
                if (d > 0) return { angle, power, base: d };
            }
        }
        return null;
    }

    test('the rocket adds real damage on top of the volley it rides', () => {
        const g = mk({ me: { hires: ['gunner'] } });
        const aim = landingAim(g);
        assert.truthy(aim, 'no landing shot found — the harness, not the feature, is broken');
        const withRocket = g._launch(g.mePos, g.meFacing, aim.angle, aim.power, 1, 40, g.foePos, true);
        assert.truthy(withRocket > aim.base,
            `rocket added nothing (${aim.base} -> ${withRocket})`);
        assert.equal(withRocket, aim.base + T.rocketDamage(aim.base),
            'the rocket must be worth exactly 60% of the shell it followed');
    });

    test('a rocket riding a miss still misses', () => {
        const g = mk({ me: { hires: ['gunner'] } });
        // Straight down into the dirt: nothing reaches the far castle.
        const base = g._launch(g.mePos, g.meFacing, 89, 10, 1, 40, g.foePos, false);
        const withRocket = g._launch(g.mePos, g.meFacing, 89, 10, 1, 40, g.foePos, true);
        assert.equal(base, 0);
        assert.equal(withRocket, 0, 'a wasted aim wastes the rocket too');
    });

    test('the whole exchange: their shield really saves them HP', () => {
        const bare = mk({ me: { hires: [] }, foe: { hires: [] } });
        const aim = landingAim(bare);
        assert.truthy(aim);

        const guarded = mk({ me: { hires: [] }, foe: { hires: ['shield'] } });
        guarded.foeShieldUp = true;
        const raw = guarded._launch(guarded.mePos, guarded.meFacing, aim.angle, aim.power, 1, 40, guarded.foePos, false);
        const dealt = guarded._outgoingDamage(raw);
        assert.truthy(dealt < raw, `shield did not reduce damage (${raw} -> ${dealt})`);
        assert.equal(dealt, T.shieldedDamage(raw));
    });

    test('a spent bench is visible to both sides', () => {
        const g = mk({ me: { hires: ['engineer'] }, foe: { hires: ['engineer'] } });
        g.myHp = 50; g.foeHp = 50;
        g.useCharge(g.myCharges[0].key);
        g._applyFoeAbilities(['engineer']);
        assert.truthy(g.myCharges[0].used, 'my bench shows it spent');
        assert.truthy(g.foeCharges[0].used, 'and so does theirs');
        assert.equal(g.myHp, 65);
        assert.equal(g.foeHp, 65);
    });
});

suite('teammates: every rendered class is styled', () => {
    test('the hire panel and the trigger chips both have rules', () => {
        const css = read('css/styles.css');
        // Classes the two new UIs emit. A chip with no rule is a 46px hole in
        // the controls that still takes taps.
        const classes = [
            'pb-hire-panel', 'pb-hire-head', 'pb-hire-title', 'pb-hire-purse',
            'pb-hire-sub', 'pb-hire-list', 'pb-hire-card', 'pb-hire-emoji',
            'pb-hire-info', 'pb-hire-name', 'pb-hire-ability', 'pb-hire-fee',
            'pb-hire-steps', 'pb-hire-step', 'pb-hire-count', 'pb-hire-total',
            'pb-squad', 'pb-squad-chip', 'pb-squad-emoji',
        ];
        const missing = classes.filter(c => !new RegExp('\\.' + c + '[\\s,{:.]').test(css));
        assert.deepEqual(missing, [], 'these are rendered but never styled');
    });
});

suite('teammates: the chip tells the truth', () => {
    test('an armed Pháo thủ reads as armed, not as spent', () => {
        // The charge is marked used on tap, but the rocket has not flown yet.
        // Showing it greyed would tell the child their money is gone when the
        // boosted shot is still ahead of them.
        const src = read('js/petbattlegame.js');
        const pass = src.slice(src.indexOf("querySelectorAll('[data-pb-charge]')"));
        const block = pass.slice(0, 700);
        assert.truthy(/const armed = charge\.id === 'gunner'/.test(block),
            'the armed state must be computed');
        assert.truthy(/toggle\('spent', !!charge\.used && !armed\)/.test(block),
            'an armed gunner must not also be painted spent');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
