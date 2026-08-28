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
        assert.equal(fee('engineer'), 600);
        assert.equal(fee('shield'), 600);
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
        assert.equal(T.hireCost(['gunner', 'engineer', 'shield']), 1800);
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

    test('an odd volley rounds in favour of the child who hired the guard', () => {
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

    test('active teammates have high-contrast guard posts inside the castle', () => {
        const src = read('js/petbattlegame.js');
        const squad = src.slice(src.indexOf('function pbDrawSquad'), src.indexOf('PetBattleGame.prototype._drawHouse'));
        assert.truthy(squad.includes("rgba(10,18,33,.88)"), 'each teammate needs a dark interior alcove');
        assert.truthy(squad.includes("ctx.fillStyle='#22c55e'"), 'active status must remain visible');
        assert.truthy(squad.includes('ctx.drawImage(portrait'), 'the castle must use the same premium portrait as Hire');
        assert.truthy(squad.includes('PB_MATE_IMAGE_CACHE'), 'castle portraits should be cached, not reloaded every frame');
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
        // 600 + 600 = 1,200; with 1,100 xu the Vệ sĩ must not go in.
        assert.deepEqual(T.hireAdd(['gunner'], 'shield', 1100), ['gunner'],
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
        assert.equal(T.hireCost(cart), 1200);
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
    test('each side gets one always-active teammate per hire', () => {
        const g = new game.PetBattleGame({
            view: fakeView({ me: { hires: ['gunner', 'gunner', 'shield'] } }), mount: null,
        });
        assert.equal(g.myCharges.length, 3);
        assert.deepEqual(g.myCharges.map(c => c.id), ['gunner', 'gunner', 'shield']);
        assert.truthy(g.myCharges.every(c => c.active === true), 'every hired teammate starts active');
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

suite('teammates: passive for the whole battle', () => {
    const mk = (over) => new game.PetBattleGame({ view: fakeView(over), mount: null });

    test('the engineer repairs automatically on every owner turn', () => {
        const g = mk({ me: { hires: ['engineer'], level: 0 } });
        g.myHp = 60; g._applyMyTurnPassives(); assert.equal(g.myHp, 75);
        g.myHp = 50; g._applyMyTurnPassives(); assert.equal(g.myHp, 65, 'still works next round');
        assert.truthy(g.myCharges[0].active, 'the mechanic remains active');
    });

    test('automatic repair never overfills the castle the pet earned', () => {
        const g = mk({ me: { hires: ['engineer'], level: 120 } });   // max 112
        g.myHp = 105;
        g._applyMyTurnPassives();
        assert.equal(g.myHp, 112, 'capped at this castle, not a flat 100');
    });

    test('the shield halves every volley that lands on me', () => {
        const g = mk({ me: { hires: ['shield'] } });
        assert.equal(g._incomingDamage(40), 20, 'halved');
        assert.equal(g._incomingDamage(40), 20, 'still halved next round');
    });

    test('the opponent’s shield remains active too', () => {
        const g = mk({ foe: { hires: ['shield'] } });
        assert.equal(g._outgoingDamage(31), 15, 'rounded in the defender’s favour');
        assert.equal(g._outgoingDamage(31), 15);
    });

    test('the gunner is active without a click', () => {
        const g = mk({ me: { hires: ['gunner'] } });
        assert.equal(g._mateCount(g.myCharges, 'gunner'), 1);
        assert.truthy(g.myCharges[0].active);
    });

    test('the opponent mechanic also repairs every turn automatically', () => {
        const g = mk({ foe: { hires: ['engineer', 'shield'], level: 0 } });
        g.foeHp = 50;
        g._applyFoeTurnPassives();
        assert.equal(g.foeHp, 65, 'their engineer repaired their castle');
        assert.equal(g._incomingDamage(40), 40, 'their guard protects them, not me');
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

    test('the active bench stays visible to both sides', () => {
        const g = mk({ me: { hires: ['engineer'] }, foe: { hires: ['engineer'] } });
        g.myHp = 50; g.foeHp = 50;
        g._applyMyTurnPassives();
        g._applyFoeTurnPassives();
        assert.truthy(g.myCharges[0].active, 'my bench shows it active');
        assert.truthy(g.foeCharges[0].active, 'and so does theirs');
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
    test('every hired teammate reads as permanently active', () => {
        const src = read('js/petbattlegame.js');
        const block = src.slice(src.indexOf('const squadChips ='), src.indexOf('const barrels ='));
        assert.truthy(/pb-squad-chip active/.test(block), 'the active state must be visible');
        assert.truthy(/pb-squad-active/.test(block), 'an always-on badge must be present');
        assert.falsy(/onclick=/.test(block), 'teammates must not require a click');
    });
});

suite('teammates: practice against the bot', () => {
    const src = () => read('js/petbattle.js');

    test('a practice battle takes the squad the child picked', () => {
        const fn = src().slice(src().indexOf('function startBotBattle'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(/hires:\s*pbHireCart\(\)/.test(body),
            'the bot view must carry the hired squad, or the panel does nothing here');
    });

    test('practice is a FREE trial — it must not spend coins', () => {
        const fn = src().slice(src().indexOf('function startBotBattle'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.falsy(/pbHireCommit\(\)/.test(body),
            'practice pays no coins and no cups, so it must not charge for teammates either');
    });

    test('practice uses v6 for classic maps and v7 for high-arc maps', () => {
        const fn = src().slice(src().indexOf('function startBotBattle'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(body.includes('scene && scene.highArc ? 7 : 6'),
            'practice must pair each random scene with its snapshotted geometry');
    });
});

suite('teammates: you hire a person, not a weapon', () => {
    test('every teammate can be drawn as a portrait', () => {
        // The chips and the shop must show the CHARACTER — a child is hiring
        // somebody who has a skill, not buying a rocket tube.
        for (const mate of T.TEAM_ROSTER) {
            assert.truthy(typeof game.PB_MATE_ART[mate.id] === 'function',
                `${mate.id} has no character art to put on its chip`);
        }
    });

    test('a portrait is safe to ask for with no DOM at all', () => {
        assert.equal(game.pbMateAvatarURL('gunner', 40), '',
            'no canvas available must mean no portrait, not a crash');
    });

    test('every teammate has a premium portrait asset', () => {
        for (const mate of T.TEAM_ROSTER) {
            const portrait = game.PB_MATE_PORTRAITS[mate.id];
            assert.truthy(portrait, `${mate.id} has no portrait path`);
            assert.truthy(fs.existsSync(path.join(root, portrait)), `${portrait} is missing`);
        }
    });

    test('the trigger chip renders the character, not the tool emoji', () => {
        const src = read('js/petbattlegame.js');
        const build = src.slice(src.indexOf('const squadChips ='), src.indexOf('const barrels ='));
        assert.truthy(/pbMateAvatarURL/.test(build), 'the chip must draw the teammate');
        assert.falsy(/mate\.emoji/.test(build), 'the tool emoji is not the teammate');
    });

    test('the hire card renders the character too', () => {
        const src = read('js/petbattle.js');
        const panel = src.slice(src.indexOf('function _pbHirePanel'));
        const body = panel.slice(0, panel.indexOf('\n}'));
        assert.truthy(/pbMateAvatar/.test(body), 'the shop must show who is being hired');
        assert.falsy(/\$\{mate\.emoji\}/.test(body), 'not the tool they carry');
    });
});

suite('teammates: a friend battle really carries the squad', () => {
    test('challenging commits the squad and charges once', () => {
        const src = read('js/petbattle.js');
        const fn = src.slice(src.indexOf('async function challengePetFriend'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(/hires: pbHireCommit\(\)/.test(body),
            'the squad must travel with the challenge, and be paid for exactly once');
    });

    test('accepting commits the squad too', () => {
        const src = read('js/petbattle.js');
        const fn = src.slice(src.indexOf('async function acceptPetBattle'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(/hires: pbHireCommit\(\)/.test(body),
            'the accepting side hires from the same lobby');
    });

    test('practice still never charges', () => {
        const src = read('js/petbattle.js');
        const fn = src.slice(src.indexOf('function startBotBattle'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(/hires: pbHireCart\(\)/.test(body));
        assert.falsy(/pbHireCommit\(\)/.test(body), 'practice pays nothing, so it charges nothing');
    });
});

suite('teammates: the server and the client agree', () => {
    const server = () => read('functions/api/_battle.js');
    const num = (name) => {
        const m = new RegExp('export const ' + name + '\\s*=\\s*(\\d+)').exec(server());
        return m ? Number(m[1]) : null;
    };

    test('new battles are stamped with the fortress the client draws', () => {
        assert.equal(num('FIELD_VERSION_NEW'), 7);
        assert.equal(num('FIELD_VERSION_MAX'), 7);
        assert.equal(calc.fieldRules(7).version, 7, 'the client must be able to draw it');
    });

    test('the fees the server charges are the fees the shop showed', () => {
        // The server cannot import the client module (classic script vs ESM),
        // so the roster is re-typed there. If the two drift, a child is billed
        // a different price than the one on the card they tapped.
        const src = server();
        for (const mate of T.TEAM_ROSTER) {
            const re = new RegExp("'?" + mate.id + "'?\\s*:\\s*" + mate.fee + "\\b");
            assert.truthy(re.test(src),
                `server fee for ${mate.id} is missing or not ${mate.fee}`);
        }
    });

    test('the bench cap matches on both sides', () => {
        const m = /export const TEAM_MAX_HIRES\s*=\s*(\d+)/.exec(server());
        assert.truthy(m, 'the server must cap the squad too — the list arrives from a device');
        assert.equal(Number(m[1]), T.TEAM_MAX_HIRES);
    });

    test('starting HP is computed the same way on both sides', () => {
        const src = server();
        const base = /const HP_BASE\s*=\s*(\d+)/.exec(src);
        const per = /const HP_LEVELS_PER_POINT\s*=\s*(\d+)/.exec(src);
        const cap = /const HP_BONUS_MAX\s*=\s*(\d+)/.exec(src);
        assert.truthy(base && per && cap, 'the server must know the HP rule');
        assert.equal(Number(base[1]), T.HP_BASE);
        assert.equal(Number(per[1]), T.HP_LEVELS_PER_POINT);
        assert.equal(Number(cap[1]), T.HP_BONUS_MAX);
    });

    test('the battle view hands each side its own squad', () => {
        const src = server();
        assert.truthy(/hires:\s*meIsChallenger \? cHires : oHires/.test(src),
            'me.hires must be the viewer’s own bench');
        assert.truthy(/hires:\s*meIsChallenger \? oHires : cHires/.test(src),
            'foe.hires must be the other bench');
    });

    test('the server derives permanent passives from the paid squad', () => {
        const turn = read('functions/api/battle/turn.js');
        assert.truthy(/parseHires/.test(turn), 'the paid squad must be read on every turn');
        assert.truthy(/teammateCount\(myHires, 'engineer'\)/.test(turn), 'mechanics repair every turn');
        assert.truthy(/teammateCount\(foeHires, 'shield'\)/.test(turn), 'guards protect every turn');
        assert.truthy(/const rocket = gunners/.test(turn), 'every gunner launches every volley');
        assert.truthy(/rawDamage/.test(turn), 'the server must apply defence, not trust the device');
        const state = read('functions/api/battle/state.js');
        assert.truthy(/rocket/.test(state), 'the opponent must replay the automatic rockets');
    });

    test('the migration adds every column the endpoints write', () => {
        const sql = read('db/006-battle-teammates.sql');
        for (const col of ['challenger_hires', 'opponent_hires', 'abilities', 'rocket']) {
            assert.truthy(sql.includes(col), `migration is missing ${col}`);
        }
    });
});

suite('teammates: the shop tells the truth about money', () => {
    const pb = require(path.join(root, 'js', 'petbattle.js'));

    function withCoins(coins, fn) {
        const hadState = Object.prototype.hasOwnProperty.call(global, 'appState');
        const hadDoc = Object.prototype.hasOwnProperty.call(global, 'document');
        const prev = global.appState;
        const prevDoc = global.document;
        global.appState = { coins };
        global.BattleTeam = T;
        // pbHire re-renders the lobby; a null-returning stub makes that a
        // no-op. Restored afterwards — petart.test.js asserts the app survives
        // with no DOM at all, and a leaked stub would hide that.
        global.document = { getElementById: () => null, querySelector: () => null };
        try { return fn(); }
        finally {
            if (hadState) global.appState = prev; else delete global.appState;
            if (hadDoc) global.document = prevDoc; else delete global.document;
        }
    }

    test('683 xu really does buy a 600 xu Pháo thủ', () => {
        withCoins(683, () => {
            pb.pbHireReset();
            pb.pbHire('gunner');
            assert.deepEqual(pb.pbHireCart(), ['gunner'], 'the hire must go through');
        });
    });

    test('after hiring, the card does NOT cry "not enough coins"', () => {
        // The warning is about a SECOND gunner (1,200 > 683), but printed under
        // the card just bought it reads as "your purchase failed".
        withCoins(683, () => {
            pb.pbHireReset();
            pb.pbHire('gunner');
            const html = pb._pbHirePanel();
            // Just the gunner's card: the cards after it legitimately say
            // "not enough coins" (83 xu left cannot buy a 1,000 xu Kỹ sư).
            const after = html.slice(html.indexOf('data-mate="gunner"'));
            const next = after.indexOf('data-mate=', 1);
            const card = next === -1 ? after : after.slice(0, next);
            assert.falsy(card.includes(pb.pbT('hirePoor')),
                'a hired teammate must not be captioned "not enough coins"');
            assert.truthy(card.includes('>1<'), 'and it should show the one that was hired');
        });
    });

    test('a teammate you genuinely cannot afford still says so', () => {
        withCoins(300, () => {
            pb.pbHireReset();
            const html = pb._pbHirePanel();
            assert.truthy(html.includes(pb.pbT('hirePoor')),
                'with 300 xu nothing is affordable and the child should be told');
        });
    });

    test('the purse shows what is left to spend, so the money is visible going out', () => {
        withCoins(683, () => {
            pb.pbHireReset();
            const before = pb._pbHirePanel();
            assert.truthy(before.includes('683'), 'starts at the full purse');
            pb.pbHire('gunner');
            const after = pb._pbHirePanel();
            assert.truthy(after.includes('83'), 'after a 600 hire, 83 xu remain');
        });
    });
});

suite('teammates: the rocket must LOOK like a rocket', () => {
    test('a rocket in flight is not drawn as another poop', () => {
        // The Pháo thủ's rocket flew and dealt its damage from the first
        // build, but the flight loop drew 💩 for every projectile — so on
        // screen it was just a second poop and the child could not tell the
        // teammate had done anything at all.
        const src = read('js/petbattlegame.js');
        const loop = src.slice(src.indexOf('  for (const f of this.flying) {\n    const p = f.points[f.i];'));
        const body = loop.slice(0, 900);
        assert.truthy(/f\.rocket/.test(body),
            'the flight loop must distinguish a rocket from a shell');
    });

    test('the rocket projectile is still flagged when it launches', () => {
        const src = read('js/petbattlegame.js');
        const launch = src.slice(src.indexOf('PetBattleGame.prototype._launch ='));
        const body = launch.slice(0, 2000);
        assert.truthy(/rocket: true/.test(body), 'the flying object must carry the flag');
    });

    test('the rocket is purpose-drawn rather than delegated to an emoji font', () => {
        const src = read('js/petbattlegame.js');
        assert.truthy(/function _pbDrawRocketProjectile/.test(src), 'the missile needs stable canvas art');
        const flight = src.slice(src.indexOf('for (const f of this.flying)'), src.indexOf('// the opponent\'s live aim'));
        assert.truthy(/_pbDrawRocketProjectile/.test(flight), 'the flight loop must draw the missile art');
        assert.falsy(/fillText\(['"]🚀/.test(flight), 'platform emoji makes the missile inconsistent');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
