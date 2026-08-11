// battle-hit-logic.test.js — 100 gameplay tests for what happens when a poop
// lands.
//
// The bug this file exists to prevent: damage used to be measured from the
// pet's GROUND ANCHOR with a ~21px blast radius while the house was drawn
// 104px wide, so a child could watch a direct hit on the wall do nothing. The
// castle has since been redrawn LARGER (±70, 122 tall), which is exactly the
// change that silently reopens that gap if the hitbox is not moved with it.
//
// So the first suite is the one that matters most: the drawing and the physics
// must describe the same castle. Everything after it covers the rules a child
// actually experiences — who takes damage, how much, when a battle ends, and
// what the server will accept.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));
const gameSrc = fs.readFileSync(path.join(ROOT, 'js', 'petbattlegame.js'), 'utf8');
const turnSrc = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'battle', 'turn.js'), 'utf8');

const V1 = C.fieldRules(1);
const V2 = C.fieldRules(2);
const BOX = V2.castle;
const T = { x: 1000, y: 400 };                    // a pet standing at ground level
const at = (dx, dy, level, rules) =>
    C.damageAt({ x: T.x + dx, y: T.y + (dy || 0) }, T, level === undefined ? 17 : level, rules === undefined ? V2 : rules);

// ── 1. the drawing and the physics describe the same castle ────────────────
suite('hit logic: the castle you see is the castle you hit', () => {
    const drawnHalfW = +(gameSrc.match(/PB_CASTLE_HALF_W = (\d+)/) || [])[1];
    const drawnHeight = +(gameSrc.match(/PB_CASTLE_HEIGHT = (\d+)/) || [])[1];

    test('the renderer names its castle size instead of scattering numbers', () => {
        assert.truthy(Number.isFinite(drawnHalfW), 'PB_CASTLE_HALF_W missing');
        assert.truthy(Number.isFinite(drawnHeight), 'PB_CASTLE_HEIGHT missing');
    });

    test('the drawn width equals the damage box width', () => {
        assert.equal(drawnHalfW, BOX.halfW, 'redrawing the castle without moving the hitbox reopens the old bug');
    });

    test('the drawn height equals the damage box height', () => {
        assert.equal(drawnHeight, BOX.height);
    });

    test('the castle is drawn from those constants, not from literals', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('_drawHouse = function'));
        assert.truthy(fn.includes('PB_CASTLE_HALF_W'), 'the walls must derive from the shared width');
        assert.truthy(fn.includes('PB_CASTLE_HEIGHT'), 'the height must derive from the shared height');
    });

    test('a bigger castle really is a bigger target', () => {
        // The redesign grew it; damage must have grown with it.
        assert.truthy(BOX.halfW >= 70, `hitbox half-width ${BOX.halfW} is smaller than the drawing`);
        assert.truthy(at(BOX.halfW - 1) > 0, 'the far edge of the wall must still take damage');
    });

    test('v1 has no castle box at all, so its replays are untouched', () => {
        assert.equal(V1.castle, null);
    });
});

// ── 2. anywhere on the castle counts ───────────────────────────────────────
suite('hit logic: every part of the castle takes damage', () => {
    for (const dx of [0, 10, 20, 30, 40, 50, 60, 69, 70]) {
        test(`a poop ${dx}px right of centre damages the castle`, () => {
            assert.truthy(at(dx) > 0, `${dx}px from centre dealt nothing — that is on the wall`);
        });
        test(`a poop ${dx}px left of centre damages the castle`, () => {
            assert.truthy(at(-dx) > 0);
        });
    }

    test('damage is identical on both sides — no favoured direction', () => {
        for (const dx of [5, 25, 45, 65]) assert.equal(at(dx), at(-dx), `asymmetry at ${dx}px`);
    });

    test('the whole footprint deals the same full damage', () => {
        const centre = at(0);
        for (const dx of [0, 20, 40, 60, 70]) {
            assert.equal(at(dx), centre, `${dx}px should be a solid hit like the centre`);
        }
    });

    test('a hit at roof height still counts', () => {
        assert.truthy(at(0, -BOX.height + 1) > 0, 'the top of the keep is part of the castle');
    });

    test('a hit above the roof falls off instead of counting as solid', () => {
        const above = at(0, -BOX.height - 10);
        assert.truthy(above < at(0), 'clear air above the castle should not be a direct hit');
    });

    test('a shell far above the castle misses entirely', () => {
        assert.equal(at(0, -BOX.height - 400), 0);
    });
});

// ── 3. misses stay misses ──────────────────────────────────────────────────
suite('hit logic: a miss is still a miss', () => {
    const r = C.blastRadius(17);

    test('just past the wall is a graze, not a full hit', () => {
        const graze = at(BOX.halfW + 5);
        assert.truthy(graze > 0, 'a near miss should still sting');
        assert.truthy(graze < at(0), 'but never as much as landing on the castle');
    });

    test('damage falls off with distance past the wall', () => {
        const a = at(BOX.halfW + 3), b = at(BOX.halfW + 10), c = at(BOX.halfW + 16);
        assert.truthy(a >= b && b >= c, `falloff is not monotonic: ${a}, ${b}, ${c}`);
    });

    test('beyond the blast radius nothing happens at all', () => {
        assert.equal(at(BOX.halfW + Math.ceil(r) + 2), 0);
    });

    test('a poop in the next field does nothing', () => {
        assert.equal(at(600), 0);
        assert.equal(at(-600), 0);
    });

    test('a shot that never landed deals nothing', () => {
        assert.equal(C.damageAt(null, T, 17, V2), 0);
        assert.equal(C.damageAt(undefined, T, 17, V2), 0);
    });

    test('the edge of the blast radius is the exact boundary', () => {
        const justIn = at(BOX.halfW + Math.floor(r) - 1);
        const justOut = at(BOX.halfW + Math.ceil(r) + 1);
        assert.truthy(justIn > 0, 'inside the radius must count');
        assert.equal(justOut, 0, 'outside it must not');
    });
});

// ── 4. damage scales with the pet you raised ───────────────────────────────
suite('hit logic: level changes what a hit is worth', () => {
    for (const [low, high] of [[1, 20], [20, 60], [60, 120], [120, 200]]) {
        test(`level ${high} hits harder than level ${low}`, () => {
            assert.truthy(at(0, 0, high) > at(0, 0, low));
        });
    }

    test('a level-1 pet still does real damage', () => {
        assert.truthy(at(0, 0, 1) > 0, 'a beginner must not be helpless');
    });

    test('a higher level also reaches further past the wall', () => {
        const far = BOX.halfW + 30;
        assert.truthy(C.blastRadius(200) > C.blastRadius(1));
        assert.truthy(at(far, 0, 200) > 0, 'a maxed pet should graze from further out');
    });

    test('level is clamped to at least 1 for damage', () => {
        for (const bad of [0, -50, null, undefined, NaN]) {
            assert.truthy(at(0, 0, bad) > 0, `level ${bad} produced no damage at point blank`);
        }
    });

    test('damage is always a whole number', () => {
        for (const lv of [1, 7, 17, 42, 99, 200]) {
            for (const dx of [0, 30, 70, 80]) {
                const d = at(dx, 0, lv);
                assert.equal(d, Math.round(d), `level ${lv} at ${dx}px gave ${d}`);
            }
        }
    });

    test('damage is never negative', () => {
        for (const lv of [1, 50, 200]) for (const dx of [0, 50, 100, 300]) {
            assert.truthy(at(dx, 0, lv) >= 0);
        }
    });

    test('a hit always costs at least one HP', () => {
        for (const lv of [1, 200]) {
            const d = at(BOX.halfW + Math.floor(C.blastRadius(lv)) - 1, 0, lv);
            if (d > 0) assert.truthy(d >= 1, 'a counted hit must be worth at least 1');
        }
    });
});

// ── 5. the server must accept what the client reports ──────────────────────
suite('hit logic: a legitimate volley is never rejected as cheating', () => {
    for (const level of [1, 17, 50, 120, 200]) {
        test(`level ${level}: four solid hits stay within the server clamp`, () => {
            const perShot = at(0, 0, level);
            for (const shots of [1, 2, 3, 4]) {
                assert.truthy(perShot * shots <= C.maxTurnDamage(shots, level),
                    `${shots} shots × ${perShot} exceeds clamp ${C.maxTurnDamage(shots, level)}`);
            }
        });
    }

    test('the clamp grows with the number of shots', () => {
        for (let n = 1; n < 4; n++) {
            assert.truthy(C.maxTurnDamage(n + 1, 17) > C.maxTurnDamage(n, 17));
        }
    });

    test('the clamp never allows more than four barrels', () => {
        assert.equal(C.maxTurnDamage(99, 17), C.maxTurnDamage(C.BARRELS, 17));
    });

    test('a skipped turn can claim nothing', () => {
        assert.equal(C.maxTurnDamage(0, 200), 0);
    });

    test('the server clamps the reported number rather than trusting it', () => {
        assert.truthy(/Math\.min\(maxTurnDamage/.test(turnSrc));
    });
});

// ── 6. ammo rules around firing ────────────────────────────────────────────
suite('hit logic: you cannot fire what you do not have', () => {
    for (const [ammo, expect] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 4], [20, 4]]) {
        test(`${ammo} poop in the clip allows ${expect} this turn`, () => {
            assert.equal(C.maxShotsThisTurn(ammo), expect);
        });
    }

    test('junk ammo never yields a shot', () => {
        for (const bad of [null, undefined, NaN, -5, 'three']) {
            assert.equal(C.maxShotsThisTurn(bad), 0, `maxShotsThisTurn(${bad})`);
        }
    });

    test('an empty clip passes the turn instead of firing', () => {
        assert.truthy(gameSrc.includes('if (maxShots <= 0) { this._passTurn(); return; }'));
    });

    test('a passed turn spends no ammo', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('prototype._passTurn'));
        assert.truthy(fn.slice(0, 500).includes('shots: 0'));
    });

    test('the bot also refuses to fire on empty', () => {
        const botSrc = fs.readFileSync(path.join(ROOT, 'js', 'petbattlebot.js'), 'utf8');
        assert.truthy(botSrc.includes('if (maxShots <= 0)'), 'the bot fired phantom poops from an empty clip');
    });
});

// ── 7. a volley of several poops ───────────────────────────────────────────
suite('hit logic: volleys spread instead of stacking', () => {
    test('one poop flies straight at the chosen angle', () => {
        assert.deepEqual(C.volleyAngles(45, 1, 123, 1), [45]);
    });

    for (const n of [2, 3, 4]) {
        test(`${n} poops produce ${n} distinct angles`, () => {
            const a = C.volleyAngles(45, n, 123, 1);
            assert.equal(a.length, n);
            assert.equal(new Set(a.map(x => x.toFixed(4))).size, n, 'a volley must fan out, not stack');
        });
    }

    test('a wider volley covers more ground', () => {
        const spread = (n) => { const a = C.volleyAngles(45, n, 7, 1); return Math.max(...a) - Math.min(...a); };
        assert.truthy(spread(4) > spread(2), 'four barrels should blanket a wider area');
    });

    test('the same volley is identical on both phones', () => {
        assert.deepEqual(C.volleyAngles(37, 4, 999, 3), C.volleyAngles(37, 4, 999, 3));
    });

    test('a different turn number gives a different spread', () => {
        assert.falsy(C.volleyAngles(45, 4, 5, 1).join() === C.volleyAngles(45, 4, 5, 2).join());
    });

    test('a volley never exceeds the barrel count', () => {
        assert.equal(C.volleyAngles(45, 99, 1, 1).length, C.BARRELS);
    });
});

// ── 8. the shot itself ─────────────────────────────────────────────────────
suite('hit logic: the flight that produces the hit', () => {
    const terrain = C.buildTerrain(4242, V2);
    const [L, R] = C.spawnPoints(terrain, V2);
    const shoot = (angle, power, wind) =>
        C.simulateShot({ terrain, from: L, facing: 1, angle, power, wind: wind || 0, rules: V2 });

    test('a fired poop always terminates', () => {
        for (let a = 10; a <= 80; a += 10) {
            const s = shoot(a, 100);
            assert.truthy(s.frames < V2.maxFrames, `angle ${a} never landed`);
        }
    });

    test('more power carries the poop further', () => {
        const weak = shoot(45, 30), strong = shoot(45, 90);
        const far = (s) => s.hit ? s.hit.x : Math.max(...s.points.map(p => p.x));
        assert.truthy(far(strong) > far(weak));
    });

    test('the poop rises before it falls', () => {
        const p = shoot(60, 80).points;
        const top = Math.min(...p.map(q => q.y));
        assert.truthy(top < p[0].y, 'a lobbed shot must go up first');
    });

    test('a tailwind carries it further than a headwind', () => {
        const flat = new Array(V2.worldW).fill(440);
        const from = { x: 140, y: 440 };
        const go = (w) => C.simulateShot({ terrain: flat, from, facing: 1, angle: 45, power: 50, wind: w, rules: V2 });
        assert.truthy(go(20).hit.x > go(0).hit.x);
        assert.truthy(go(-20).hit.x < go(0).hit.x);
    });

    test('the same shot replays identically — the multiplayer guarantee', () => {
        const a = shoot(42, 66, -7), b = shoot(42, 66, -7);
        assert.equal(a.frames, b.frames);
        assert.equal(a.hit.x, b.hit.x);
        assert.equal(a.hit.y, b.hit.y);
    });

    test('a shot cannot hit the ground inside the muzzle clearance', () => {
        for (let a = 10; a <= 80; a += 5) {
            const s = shoot(a, 10);
            if (s.hit) assert.truthy(s.frames >= V2.muzzleClearance, `landed after ${s.frames} frames`);
        }
    });

    test('both pets stand on level ground with a clear lane', () => {
        for (const sp of [L, R]) {
            for (let d = -V2.plateau; d <= V2.plateau; d += 10) {
                assert.equal(terrain[sp.x + d], terrain[sp.x], 'the plateau must be flat');
            }
        }
    });

    test('a shot from the right reaches the left castle', () => {
        let landed = false;
        for (let a = 12; a <= 84 && !landed; a += 2) {
            for (let p = 30; p <= 100; p += 2) {
                const s = C.simulateShot({ terrain, from: R, facing: -1, angle: a, power: p, wind: 0, rules: V2 });
                if (s.hit && Math.abs(s.hit.x - L.x) <= BOX.halfW) { landed = true; break; }
            }
        }
        assert.truthy(landed, 'the right castle cannot reach the left one');
    });
});

// ── 9. what a landed hit does to HP and the castle ─────────────────────────
suite('hit logic: HP and the castle react together', () => {
    const game = require(path.join(ROOT, 'js', 'petbattlegame.js'));

    test('100 HP is the only untouched castle', () => {
        assert.equal(game.pbHouseDamageStage(100), 0);
        assert.equal(game.pbHouseDamageStage(99), 1);
    });

    for (const [hp, stage] of [[100, 0], [99, 1], [80, 1], [75, 2], [60, 2], [50, 3], [30, 3], [25, 4], [1, 4], [0, 5]]) {
        test(`${hp} HP shows castle stage ${stage}`, () => {
            assert.equal(game.pbHouseDamageStage(hp), stage);
        });
    }

    test('the castle never improves as HP falls', () => {
        let prev = 0;
        for (let hp = 100; hp >= 0; hp--) {
            const s = game.pbHouseDamageStage(hp);
            assert.truthy(s >= prev, `stage went backwards at ${hp} HP`);
            prev = s;
        }
    });

    test('hearts drain in step with HP', () => {
        for (const hp of [100, 87, 50, 13, 0]) {
            assert.equal(game.pbHeartFills(hp).reduce((a, b) => a + b, 0), hp * 5, `hearts wrong at ${hp}`);
        }
    });

    test('hearts never exceed full or drop below empty', () => {
        for (let hp = -20; hp <= 120; hp += 5) {
            for (const f of game.pbHeartFills(hp)) assert.truthy(f >= 0 && f <= 100, `fill ${f} at ${hp} HP`);
        }
    });

    test('a wrecked castle and zero HP agree', () => {
        assert.equal(game.pbHouseDamageStage(0), 5);
        assert.equal(game.pbHeartFills(0).reduce((a, b) => a + b, 0), 0);
    });

    test('junk HP never breaks the castle or the hearts', () => {
        for (const bad of [null, undefined, NaN, -10, 999, 'x']) {
            const s = game.pbHouseDamageStage(bad);
            assert.truthy(s >= 0 && s <= 5, `stage ${s} from ${bad}`);
            assert.equal(game.pbHeartFills(bad).length, 5);
        }
    });
});

// ── 10. how a hit ends the battle ──────────────────────────────────────────
suite('hit logic: when a hit ends the fight', () => {
    test('HP is floored at zero, never negative', () => {
        assert.truthy(gameSrc.includes('Math.max(0, this.foeHp - damage)'));
        assert.truthy(gameSrc.includes('Math.max(0, this.myHp - dealt)'));
    });

    test('the server ends the battle when a castle falls', () => {
        assert.truthy(turnSrc.includes('foeHp <= 0'));
    });

    test('the battle also ends when both clips are empty', () => {
        assert.truthy(turnSrc.includes('myAmmoAfter <= 0 && foeAmmo <= 0'));
    });

    test('rounds are not capped — a full clip can last twenty', () => {
        assert.truthy(C.MAX_TURNS >= C.AMMO_CAP * 2, 'a one-poop-per-turn duel must not be cut short');
    });

    test('whoever still has ammo keeps shooting', () => {
        assert.truthy(turnSrc.includes('const foeCanFire = foeAmmo > 0'));
    });

    test('the winner is the one who dealt more damage when time runs out', () => {
        assert.truthy(turnSrc.includes('myHp > foeHp'));
    });

    test('a hit is recorded in the turn log for the history', () => {
        assert.truthy(gameSrc.includes('this._logTurn(true, aim, damage)'));
        assert.truthy(gameSrc.includes('this._logTurn(false,'));
    });

    test('an opponent turn arriving mid-animation is queued, never lost', () => {
        assert.truthy(gameSrc.includes('_queueTurn'));
        assert.truthy(gameSrc.includes('_drainTurns'));
    });
});

// ── 11. the hit cannot be faked or mis-attributed ──────────────────────────
suite('hit logic: hits belong to the right pet', () => {
    test('my volley is measured against the opponent, not me', () => {
        const fire = gameSrc.slice(gameSrc.indexOf('prototype.fire'), gameSrc.indexOf('prototype._replay'));
        assert.truthy(fire.includes('this.mePos, this.meFacing') && fire.includes('this.foePos'),
            'my shot must fly from me toward the opponent');
    });

    test('a replayed volley is measured against me', () => {
        const replay = gameSrc.slice(gameSrc.indexOf('prototype._replay'));
        assert.truthy(replay.slice(0, 800).includes('this.foePos, -this.meFacing'), 'their shot flies from them');
        assert.truthy(replay.slice(0, 800).includes('this.mePos'), 'and lands on me');
    });

    test('damage uses the shooter level, not the target level', () => {
        const fire = gameSrc.slice(gameSrc.indexOf('prototype.fire'), gameSrc.indexOf('prototype._replay'));
        assert.truthy(fire.includes('this.view.me.level'), 'my shot must use my own level');
        const replay = gameSrc.slice(gameSrc.indexOf('prototype._replay'));
        assert.truthy(replay.slice(0, 800).includes('this.view.foe.level'), 'their shot must use theirs');
    });

    test('the same rule set is used for the shot and the damage', () => {
        assert.truthy(gameSrc.includes('C.damageAt(sim.hit, target, level, this.rules)'),
            'damage must use the battle\'s snapshotted rules, not the default');
    });

    test('a miss never shakes the defender', () => {
        assert.truthy(gameSrc.includes('if (bulletDamage > 0) this._lastHitCount += 1'),
            'only damaging poops should count as hits');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
