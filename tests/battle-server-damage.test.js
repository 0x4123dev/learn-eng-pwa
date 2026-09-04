// The arena stops taking the device's word for the damage.
//
// POST /api/battle/turn used to store whatever `rawDamage` a client reported,
// clamped only to a THEORETICAL ceiling (maxTurnDamage). Everything a shot
// really depends on is already on the battle row and deterministic — seed,
// field version, background, turn number, which side is firing, level — so a
// modified client could simply claim the ceiling every turn and never aim: a
// 115 HP castle fell in two volleys while its owner watched shells miss.
//
// The volley now lives in ONE place, js/battlecalc.js volleyShots, which the
// child's phone animates and the server re-runs. These tests pin the two to
// each other: if the client's ballistics ever change without the server's,
// they go red rather than silently making every honest shot score zero.
'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'battlecalc.js'));
const TEAM = require(path.join(ROOT, 'js', 'battle-teammates.js'));
const battleLib = () => loadModule('functions/api/_battle.js');
const turnHandler = () => loadModule('functions/api/battle/turn.js');

// Exactly what js/petbattlegame.js does: rules from the SNAPSHOTTED field
// version, terrain from the seed and background, the challenger on the left,
// wind from the round, then volleyShots.
function clientVolleyDamage(row, o) {
  const rules = C.fieldRules(row.field_version);
  const terrain = C.buildTerrain(row.seed >>> 0, rules, row.background_id);
  const spawns = C.spawnPoints(terrain, rules);
  const from = o.meIsChallenger ? spawns[0] : spawns[1];
  const target = o.meIsChallenger ? spawns[1] : spawns[0];
  const facing = o.meIsChallenger ? 1 : -1;
  const wind = C.windForRound(row.seed >>> 0, Math.max(1, Math.ceil(o.turnNo / 2)));
  return C.volleyDamage({
    terrain, from, target, facing, wind, rules, seed: row.seed >>> 0, turnNo: o.turnNo,
    angle: o.angle, power: o.power, shots: o.shots, level: o.level,
    rocket: o.gunners, rocketDamage: TEAM.rocketDamage,
  });
}

const BACKGROUNDS = ['cloudstep-meadow', 'moonlit-village', 'storm-kingdom'];

suite('battle: the server fires the same shot the phone did', () => {
  test('client and server agree on every volley across seeds, arenas and aims', () => {
    const { serverVolleyDamage } = battleLib();
    let checked = 0, hits = 0;
    for (const seed of [1, 7, 12345, 987654321, 0xdeadbeef]) {
      for (const fieldVersion of [1, 6, 7]) {
        for (const backgroundId of BACKGROUNDS) {
          const row = { seed, field_version: fieldVersion, background_id: backgroundId };
          for (const meIsChallenger of [true, false]) {
            for (const turnNo of [1, 2, 5]) {
              for (const angle of [35, 45, 60, 75]) {
                for (const power of [40, 70, 100]) {
                  for (const shots of [1, 3]) {
                    for (const level of [1, 25, 200]) {
                      for (const gunners of [0, 2]) {
                        const opts = { meIsChallenger, turnNo, angle, power, shots, level, gunners };
                        const mine = clientVolleyDamage(row, opts);
                        const theirs = serverVolleyDamage(row, opts);
                        assert.equal(theirs, mine,
                          `seed ${seed} v${fieldVersion} ${backgroundId} ${meIsChallenger ? 'L' : 'R'} t${turnNo} ${angle}°/${power} ×${shots} lv${level} g${gunners}`);
                        checked++;
                        if (mine > 0) hits++;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    assert.truthy(checked > 2000, 'the sweep must actually be wide: ' + checked);
    // If nothing ever connected the equality above would be a tautology.
    assert.truthy(hits > checked * 0.05, 'the fixture must contain real hits, not just misses: ' + hits + '/' + checked);
  });

  test('the number tracks the shot: some aims connect, some miss', () => {
    const { serverVolleyDamage } = battleLib();
    const row = { seed: 12345, field_version: 6, background_id: 'cloudstep-meadow' };
    const base = { meIsChallenger: true, turnNo: 1, shots: 1, level: 50, gunners: 0 };
    const scores = [];
    for (const angle of [20, 30, 40, 45, 50, 60, 70, 80]) {
      for (const power of [30, 50, 70, 85, 100]) {
        scores.push(serverVolleyDamage(row, Object.assign({}, base, { angle, power })));
      }
    }
    assert.truthy(Math.max(...scores) > 0, 'some aim on this field must connect');
    assert.truthy(scores.some(s => s === 0), 'and some must miss entirely');
  });
});

// ---- through the real handler ---------------------------------------------

const BATTLE_COLS = `challenger_id,opponent_id,status,seed,field_version,background_id,
  challenger_ammo,opponent_ammo,challenger_level,opponent_level,
  challenger_hp,opponent_hp,challenger_hires,opponent_hires,
  turn_no,turn_user_id,turn_started_at,created_at,expires_at`;

function makeBattle(world, challenger, opponent, o) {
  o = o || {};
  const now = Date.now();
  const info = world.db.prepare(
    `INSERT INTO battles (${BATTLE_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    challenger.uid, opponent.uid, 'active', o.seed == null ? 12345 : o.seed,
    o.fieldVersion || 6, o.backgroundId || 'cloudstep-meadow',
    o.ammo == null ? 10 : o.ammo, o.ammo == null ? 10 : o.ammo,
    o.level || 50, o.level || 50,
    o.hp == null ? 115 : o.hp, o.hp == null ? 115 : o.hp,
    '[]', '[]',
    o.turnNo || 1, (o.turnUser || challenger).uid, now, now, now + 3600000
  );
  return Number(info.lastInsertRowid);
}
const battleRow = (world, id) => world.db.prepare('SELECT * FROM battles WHERE id=?').get(id);
const storedTurns = (world, id) =>
  world.db.prepare('SELECT turn_no, damage FROM battle_turns WHERE battle_id=? ORDER BY id').all(id)
    .map(r => ({ turnNo: Number(r.turn_no), damage: Number(r.damage) }));

suite('battle: POST /turn refuses to be told the damage', () => {
  test('an inflated rawDamage is cut down to what the shot really did', async () => {
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);
    const row = battleRow(world, id);
    const honest = battleLib().serverVolleyDamage(row, {
      meIsChallenger: true, turnNo: 1, angle: 45, power: 70, shots: 2, level: 50, gunners: 0,
    });

    const r = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, angle: 45, power: 70, shots: 2, rawDamage: 999 },
    });
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(storedTurns(world, id)[0].damage, honest,
      'the stored damage is the server\'s own simulation, not the claim');
    assert.equal(Number(battleRow(world, id).opponent_hp), 115 - honest);
  });

  test('an honest report is stored untouched', async () => {
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);
    const row = battleRow(world, id);
    const honest = battleLib().serverVolleyDamage(row, {
      meIsChallenger: true, turnNo: 1, angle: 45, power: 70, shots: 2, level: 50, gunners: 0,
    });
    const r = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, angle: 45, power: 70, shots: 2, rawDamage: honest },
    });
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(storedTurns(world, id)[0].damage, honest, 'an honest player must lose nothing');
  });

  test('a castle cannot be flattened in two claimed volleys', async () => {
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    // A deliberately hopeless aim: straight up, no power.
    const id = makeBattle(world, me, foe, { level: 200 });
    for (let turn = 0; turn < 2; turn++) {
      await world.call(turnHandler().onRequestPost, {
        url: '/api/battle/turn', method: 'POST', token: me.token,
        body: { battleId: id, angle: 89, power: 1, shots: 4, rawDamage: 999, level: 200 },
      });
      // hand the turn back to us for the second volley
      world.db.prepare('UPDATE battles SET turn_user_id=? WHERE id=?').run(me.uid, id);
    }
    const after = battleRow(world, id);
    assert.truthy(Number(after.opponent_hp) > 0,
      'a straight-up shot cannot take a castle down however much it claims');
  });
});

suite('battle: one turn is applied once', () => {
  test('a retry of a turn that has already been played spends nothing', async () => {
    // The scenario: our turn-1 submit times out on the phone and is retried.
    // The first copy landed, the opponent answered, and it is our turn again —
    // so the late copy arrives at a moment when it IS our turn. The server
    // ignored body.turnNo entirely, so it accepted the replay as a brand-new
    // turn and burned the shot the child had not taken yet.
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);

    const first = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 1, angle: 45, power: 70, shots: 2, rawDamage: 40 },
    });
    assert.truthy(first.ok, JSON.stringify(first.data));
    assert.equal(Number(battleRow(world, id).turn_user_id), foe.uid, 'the turn passed to the opponent');

    const reply = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: foe.token,
      body: { battleId: id, turnNo: 2, angle: 45, power: 70, shots: 2, rawDamage: 40 },
    });
    assert.truthy(reply.ok, JSON.stringify(reply.data));
    const before = battleRow(world, id);
    assert.equal(Number(before.turn_user_id), me.uid, 'and back to us');

    const late = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 1, angle: 45, power: 70, shots: 2, rawDamage: 40 },
    });
    assert.falsy(late.ok, 'a submit for a turn that is over must be refused');
    assert.equal(late.status, 409);

    const after = battleRow(world, id);
    assert.equal(Number(after.turn_no), Number(before.turn_no), 'the turn number stands');
    assert.equal(Number(after.challenger_hp), Number(before.challenger_hp), 'our HP stands');
    assert.equal(Number(after.opponent_hp), Number(before.opponent_hp), 'their HP stands');
    assert.equal(Number(after.challenger_ammo), Number(before.challenger_ammo), 'and our poop is still ours');
    assert.equal(storedTurns(world, id).length, 2, 'two turns were played, two were recorded');
  });

  test('a client that sends no turn number still plays normally', async () => {
    // Older builds do not send it; they must not be locked out.
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);
    const r = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, angle: 45, power: 70, shots: 1, rawDamage: 10 },
    });
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(Number(battleRow(world, id).turn_no), 2);
  });
});

suite('battle: a draw is a draw', () => {
  test('two castles left standing on equal HP tell BOTH children it was a tie', async () => {
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    // One poop each side, and an aim that cannot connect: both end whole.
    const id = makeBattle(world, me, foe, { ammo: 1, hp: 100 });
    await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, angle: 89, power: 1, shots: 1, rawDamage: 0 },
    });
    const r = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: foe.token,
      body: { battleId: id, angle: 89, power: 1, shots: 1, rawDamage: 0 },
    });
    assert.truthy(r.ok, JSON.stringify(r.data));
    const row = battleRow(world, id);
    assert.equal(String(row.status), 'done');
    assert.equal(row.winner_id, null, 'nobody won');
    assert.equal(Number(row.challenger_hp), Number(row.opponent_hp), 'the fixture really is a tie');
    // Both viewers must be told the same thing, and it must not be "you lost".
    assert.truthy(r.data.battle.draw, 'the loser-by-default gets a draw flag');
    const { battleView } = battleLib();
    assert.truthy(battleView(row, me.uid).draw, 'and so does the other side');
    assert.truthy(battleView(row, foe.uid).draw);
  });
});

suite('battle: a stale turn number is not proof of a replay', () => {
  test('a shot the child really took is accepted even when the client miscounts', async () => {
    // Reopening a battle resets the poll cursor, so the client replays the
    // whole history and _replay walked its own turnNo backwards. It then sent
    // an old number for a brand-new shot, and refusing that discarded a turn
    // the child had actually taken — they watched the castle HP drop and
    // jump back.
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);

    await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 1, angle: 45, power: 70, shots: 1, rawDamage: 20 },
    });
    await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: foe.token,
      body: { battleId: id, turnNo: 2, angle: 45, power: 70, shots: 1, rawDamage: 20 },
    });
    const before = battleRow(world, id);
    assert.equal(Number(before.turn_no), 3);
    assert.equal(Number(before.turn_user_id), me.uid, 'it is our turn again');

    // The miscounting client reports the opponent's turn number (2) — a turn
    // WE never played — for a genuinely new shot.
    const r = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 2, angle: 50, power: 80, shots: 1, rawDamage: 20 },
    });
    assert.truthy(r.ok, 'a real shot must not be thrown away: ' + JSON.stringify(r.data));
    assert.equal(Number(battleRow(world, id).turn_no), 4, 'and the battle moves on');
    assert.equal(storedTurns(world, id).length, 3);
  });

  test('but a genuine replay of our OWN turn is still refused', async () => {
    const world = createWorld();
    const me = await world.createUser({});
    const foe = await world.createUser({});
    const id = makeBattle(world, me, foe);
    await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 1, angle: 45, power: 70, shots: 1, rawDamage: 20 },
    });
    await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: foe.token,
      body: { battleId: id, turnNo: 2, angle: 45, power: 70, shots: 1, rawDamage: 20 },
    });
    const before = battleRow(world, id);
    // Turn 1 was OURS, and it is our turn again — this is the late duplicate.
    const late = await world.call(turnHandler().onRequestPost, {
      url: '/api/battle/turn', method: 'POST', token: me.token,
      body: { battleId: id, turnNo: 1, angle: 45, power: 70, shots: 1, rawDamage: 20 },
    });
    assert.falsy(late.ok, 'our own turn must not be replayed into a new one');
    assert.equal(late.status, 409);
    assert.equal(Number(battleRow(world, id).turn_no), Number(before.turn_no), 'nothing moved');
    assert.equal(Number(battleRow(world, id).challenger_ammo), Number(before.challenger_ammo),
      'and no poop was spent');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
