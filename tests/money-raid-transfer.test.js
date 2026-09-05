// Cướp Đêm moves money; it must never PRINT it.
//
// The wallet a child spends lives on their device (appState.coins). The server
// keeps a MIRROR in night_raid_homes.lootable_coins, which the device
// overwrites on its next syncHome PUT. So a raid that only wrote the victim's
// loss into that mirror was not a transfer at all: the victim's phone never
// heard about it, kept its old balance, and the very next PUT put the stolen
// coins straight back. Every won raid minted its reward out of nothing.
//
// The side standing in front of the screen applies its own half locally, once
// per raidId (claimVerified). The side that is ASLEEP is settled through
// coin_grants — the receipt-protected IOU pipeline admin gifts already use —
// so the adjustment waits for their device and can only ever land once.
//
// Everything here executes the real handlers against a real SQLite database
// through tests/pages-harness.js. Nothing is substring-checked.
'use strict';

const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const startHandler = () => loadModule('functions/api/night-raid/start.js');
const finishHandler = () => loadModule('functions/api/night-raid/finish.js');
const coinsHandler = () => loadModule('functions/api/coins.js');
const ghostHandler = () => loadModule('functions/api/ghost-offering.js');
const helper = () => loadModule('functions/api/_night-raid.js');

async function seedHome(world, user, o) {
  o = o || {};
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: 0, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: 'stone-keep', coins: o.coins == null ? 800 : o.coins },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
  // Soldiers only ever come from night-raid/collect.js, so a fixture that
  // wants an army writes it the way collect.js would.
  if (o.soldiers) {
    const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid);
    const layout = JSON.parse(row.layout_json);
    layout.soldiers = o.soldiers;
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?')
      .run(JSON.stringify(layout), user.uid);
  }
}
const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

const start = (world, attacker, defender) =>
  world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
const finish = (world, attacker, raidId) =>
  world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId } });

const grantsFor = (world, uid) =>
  world.db.prepare('SELECT amount, note FROM coin_grants WHERE user_id=? ORDER BY id').all(uid)
    .map(r => ({ amount: Number(r.amount), note: String(r.note || '') }));
const owedTo = (world, uid) => grantsFor(world, uid).reduce((sum, g) => sum + g.amount, 0);
const ticketsUsed = (world, uid) => {
  const row = world.db.prepare('SELECT tickets_used FROM night_raid_daily WHERE user_id=?').get(uid);
  return row ? Number(row.tickets_used) : 0;
};
const raidRows = (world, uid) =>
  world.db.prepare('SELECT status FROM night_raids WHERE attacker_id=?').all(uid).map(r => String(r.status));

suite('cướp đêm: the sleeping side is really settled', () => {
  test('a won raid owes the victim exactly what the attacker carried home', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));

    const s = await start(world, attacker, victim);
    assert.truthy(s.ok && s.data.raid, JSON.stringify(s.data));
    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.truthy(f.ok && f.data.result.won, 'fixture must be a win: ' + JSON.stringify(f.data));

    const reward = f.data.result.reward;
    assert.truthy(reward > 0, 'a won raid against a 1000 xu pile must pay something');
    // The debit reaches the victim's DEVICE, not just the server mirror.
    assert.equal(owedTo(world, victim.uid), -reward,
      'the victim is owed exactly minus what the attacker took');
    // …and the attacker is NOT double-credited here: their half is applied on
    // their own device by claimVerified, once per raidId.
    assert.equal(owedTo(world, attacker.uid), 0, 'the attacker is paid client-side, not twice');
  });

  test('a lost raid owes the defender exactly what the attacker paid', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 900 }, WEAK));
    await seedHome(world, defender, Object.assign({ coins: 900 }, STRONG));

    const s = await start(world, attacker, defender);
    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.truthy(f.ok && !f.data.result.won, 'fixture must be a defeat: ' + JSON.stringify(f.data));

    const loss = f.data.result.loss;
    assert.truthy(loss > 0, 'a defeat must cost the attacker something');
    assert.equal(f.data.result.defenderGain, loss, 'the two halves are equal and opposite');
    assert.equal(owedTo(world, defender.uid), loss, 'holding the wall really pays the defender');
    assert.equal(owedTo(world, attacker.uid), 0, 'the attacker pays on their own device');
  });

  test('the IOU says which raid it came from, so a child can read their ledger', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await start(world, attacker, victim);
    await finish(world, attacker, s.data.raid.raidId);
    const notes = grantsFor(world, victim.uid).map(g => g.note);
    assert.equal(notes.length, 1);
    assert.truthy(/Cướp Đêm/.test(notes[0]), 'the note names the feature: ' + notes[0]);
  });

  test('a raid that steals nothing owes nothing — no empty IOU rows', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 0 }, WEAK));
    const s = await start(world, attacker, victim);
    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.truthy(f.ok && f.data.result.won);
    assert.equal(f.data.result.reward, 0, 'an empty house pays nothing');
    assert.equal(f.data.result.rewardReason, 'empty_vault', 'the UI is told why a won raid paid zero');
    assert.equal(grantsFor(world, victim.uid).length, 0, 'and owes nothing');
  });
});

suite('cướp đêm: one raid is settled once', () => {
  test('a failed settlement batch rolls everything back and a retry restores the whole result', async () => {
    const world=createWorld();
    const attacker=await world.createUser({allowBot:true}),victim=await world.createUser({allowBot:true});
    await seedHome(world,attacker,Object.assign({coins:500},STRONG));
    await seedHome(world,victim,Object.assign({coins:1000},WEAK));
    const s=await start(world,attacker,victim),raidId=s.data.raid.raidId;
    const real=world.env.DB;
    world.env.DB={prepare:sql=>real.prepare(sql),exec:sql=>real.exec(sql),batch:stmts=>real.batch([...stmts,real.prepare('INSERT INTO missing_settlement_table(x) VALUES(1)')])};
    let failed=false;try{await finish(world,attacker,raidId);}catch(e){failed=true;}
    assert.truthy(failed,'the injected failure must escape the handler');
    assert.equal(world.db.prepare('SELECT status FROM night_raids WHERE id=?').get(raidId).status,'active','claim rolled back');
    assert.equal(ticketsUsed(world,attacker.uid),0,'ticket rolled back');
    assert.equal(grantsFor(world,victim.uid).length,0,'grant rolled back');
    assert.equal(world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(victim.uid).lootable_coins,1000,'wallet mirror rolled back');
    assert.equal(world.db.prepare('SELECT ruined_until FROM night_raid_homes WHERE user_id=?').get(victim.uid).ruined_until,null,'home lock rolled back');
    world.env.DB=real;
    const retried=await finish(world,attacker,raidId);
    assert.truthy(retried.ok&&retried.data.result.won,JSON.stringify(retried.data));
    assert.equal(ticketsUsed(world,attacker.uid),1);
    assert.equal(grantsFor(world,victim.uid).length,1);
    assert.truthy(world.db.prepare('SELECT ruined_until FROM night_raid_homes WHERE user_id=?').get(victim.uid).ruined_until>Date.now());
  });
  test('two overlapping /finish calls move the money and the ticket exactly once', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await start(world, attacker, victim);
    const raidId = s.data.raid.raidId;

    // finishOnline and retryPendingFinish both POST for the same raidId with
    // no in-flight flag between them.
    const [a, b] = await Promise.all([finish(world, attacker, raidId), finish(world, attacker, raidId)]);
    assert.truthy(a.ok && b.ok, JSON.stringify([a.data, b.data]));
    const reward = a.data.result.reward || b.data.result.reward;
    assert.truthy(reward > 0);

    assert.equal(ticketsUsed(world, attacker.uid), 1, 'one raid spends one ticket');
    assert.equal(owedTo(world, victim.uid), -reward, 'the victim is debited once, not twice');
    assert.equal(grantsFor(world, victim.uid).length, 1, 'one raid writes one IOU');
    assert.equal(a.data.result.reward, b.data.result.reward, 'both callers see the same result');
  });

  test('a later replay of a finished raid pays nothing more', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await start(world, attacker, victim);
    const first = await finish(world, attacker, s.data.raid.raidId);
    const again = await finish(world, attacker, s.data.raid.raidId);
    assert.truthy(again.ok, JSON.stringify(again.data));
    assert.equal(again.data.result.reward, first.data.result.reward, 'the stored result is replayed');
    assert.equal(ticketsUsed(world, attacker.uid), 1);
    assert.equal(grantsFor(world, victim.uid).length, 1);
  });
});

suite('cướp đêm: a ticket is taken off the shelf at /start', () => {
  test('a child cannot open a second raid while one is still in flight', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const one = await world.createUser({ allowBot: true });
    const two = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, one, Object.assign({ coins: 1000 }, WEAK));
    await seedHome(world, two, Object.assign({ coins: 1000 }, WEAK));

    const a = await start(world, attacker, one);
    assert.truthy(a.ok && a.data.raid, JSON.stringify(a.data));
    const b = await start(world, attacker, two);
    assert.falsy(b.ok, 'the second house must be refused while the first raid is open');
    assert.equal(b.status, 409);
    assert.equal(raidRows(world, attacker.uid).filter(s => s === 'active').length, 1);
  });

  test('the daily allowance cannot be beaten by opening every house at once', async () => {
    // The reported exploit: tickets_used is only incremented at /finish, so
    // eight /start calls in the same minute all read used=0.
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 5000 }, STRONG));
    const victims = [];
    for (let i = 0; i < 6; i++) {
      const v = await world.createUser({ allowBot: true });
      await seedHome(world, v, Object.assign({ coins: 1000 }, WEAK));
      victims.push(v);
    }
    let scored = 0;
    for (const v of victims) {
      const s = await start(world, attacker, v);
      if (!s.ok) continue;
      const f = await finish(world, attacker, s.data.raid.raidId);
      if (f.ok && f.data.result) scored++;
    }
    const allowance = (await helper().ticketStats(world.env, attacker.uid)).allowance;
    assert.equal(allowance, 3, 'the fixture child has the base allowance');
    assert.equal(scored, allowance, 'no more raids than tickets, ever');
    assert.equal(ticketsUsed(world, attacker.uid), allowance);
  });
});

suite('cướp đêm: a raid that ran out of time leaves no trace', () => {
  test('an expired raid is refused as expired, and the house opens again at once', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));

    const s = await start(world, attacker, victim);
    const raidId = s.data.raid.raidId;
    // The child switched apps: Phaser sleeps its loop while the tab is hidden,
    // so /finish arrives past the deadline.
    world.db.prepare('UPDATE night_raids SET expires_at=? WHERE id=?').run(Date.now() - 1000, raidId);

    const f = await finish(world, attacker, raidId);
    assert.falsy(f.ok, 'an expired raid must not be scored');
    assert.equal(f.status, 409);
    assert.truthy(f.data.expired, 'the client is told WHY, so it can say "hết giờ"');
    assert.equal(ticketsUsed(world, attacker.uid), 0, 'no ticket was spent');
    assert.equal(owedTo(world, victim.uid), 0, 'and nobody was charged');
    assert.equal(raidRows(world, attacker.uid).length, 0, 'the row is gone, not parked as active');

    // The whole point: the 12 h door is NOT locked by a raid that never happened.
    const again = await start(world, attacker, victim);
    assert.truthy(again.ok && again.data.raid, 'the same house must open again: ' + JSON.stringify(again.data));
  });

  test('/start clears the child\'s own stale raid instead of wedging on it', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const one = await world.createUser({ allowBot: true });
    const two = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, one, Object.assign({ coins: 1000 }, WEAK));
    await seedHome(world, two, Object.assign({ coins: 1000 }, WEAK));

    const a = await start(world, attacker, one);
    world.db.prepare('UPDATE night_raids SET expires_at=? WHERE id=?').run(Date.now() - 1000, a.data.raid.raidId);
    const b = await start(world, attacker, two);
    assert.truthy(b.ok && b.data.raid, 'a dead raid must not block the next one: ' + JSON.stringify(b.data));
    assert.equal(raidRows(world, attacker.uid).filter(s => s === 'active').length, 1);
  });
});

suite('cướp đêm: soldiers are earned, never declared', () => {
  test('a brand-new home cannot be opened with an army', async () => {
    const world = createWorld();
    const cheat = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    const r = await world.call(homeHandler().onRequestPut, {
      url: '/api/night-raid/home', method: 'PUT', token: cheat.token,
      body: { layout: { cells: [], soldiers: 1000000, dogLane: 2 }, dogLevel: 1, coins: 0 },
    });
    assert.truthy(r.ok, JSON.stringify(r.data));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, STRONG));
    const s = await start(world, cheat, victim);
    assert.truthy(s.ok && s.data.raid, JSON.stringify(s.data));
    assert.equal(s.data.raid.attackerSoldiers, 0, 'a declared army is not an army');
    const f = await finish(world, cheat, s.data.raid.raidId);
    assert.falsy(f.data.result.won, 'a fresh account cannot beat a strong house for free');
  });
});

suite('ghost offering: the scene replays, the coins do not', () => {
  const uuid = () => 'aaaaaaaa-bbbb-cccc-dddd-' + String(Date.now() % 1e12).padStart(12, '0');
  const claim = (world, user, sessionId, itemId) =>
    world.call(ghostHandler().onRequestPost, {
      url: '/api/ghost-offering', method: 'POST', token: user.token,
      body: { itemId, sessionId },
    });

  test('reopening the screen starts a fresh round but pays only the first time', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });

    const first = await world.call(ghostHandler().onRequestGet, { url: '/api/ghost-offering', method: 'GET', token: kid.token });
    assert.truthy(first.ok, JSON.stringify(first.data));
    const a = await claim(world, kid, first.data.sessionId, 'pig');
    assert.truthy(a.data.awarded, 'the offering is taken off the table');
    assert.equal(a.data.reward, 200, 'and paid, once');
    assert.equal(owedTo(world, kid.uid), 200);

    // Close the screen and open it again — a brand-new sessionId, an empty
    // claimedIds list, and the same pig sitting there.
    const second = await world.call(ghostHandler().onRequestGet, { url: '/api/ghost-offering', method: 'GET', token: kid.token });
    assert.truthy(second.data.sessionId !== first.data.sessionId, 'the round really is fresh');
    assert.equal((second.data.claimedIds || []).length, 0, 'the table is set again');
    const b = await claim(world, kid, second.data.sessionId, 'pig');
    assert.truthy(b.data.awarded, 'the replayed round still lets QA collect it');
    assert.equal(b.data.reward, 0, 'but it is not paid a second time');
    assert.truthy(b.data.replay, 'and the screen is told why');
    assert.equal(owedTo(world, kid.uid), 200, 'the wallet moved once');
  });

  test('a client-invented session id cannot mint coins either', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await world.call(ghostHandler().onRequestGet, { url: '/api/ghost-offering', method: 'GET', token: kid.token });
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const r = await claim(world, kid, 'deadbeef-1111-2222-3333-44444444' + String(i).padStart(4, '0'), 'chicken1');
      total += Number(r.data.reward || 0);
    }
    assert.equal(total, 50, 'five sessions, one chicken, one payout');
    assert.equal(owedTo(world, kid.uid), 50);
  });
});

suite('coin grants: an IOU can now be negative, so the protocol has to hold', () => {
  const claim = (world, user, body) =>
    world.call(coinsHandler().onRequestPost, { url: '/api/coins', method: 'POST', token: user.token, body });
  const grant = (world, uid, amount) =>
    world.db.prepare("INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,0)").run(uid, amount, 'test');
  const ageClaims = (world, uid) =>
    world.db.prepare("UPDATE coin_grants SET claimed_at = datetime('now','-2 hours') WHERE user_id=? AND claimed_at IS NOT NULL").run(uid);

  test('a batch that nets to zero still gets a receipt to ack', async () => {
    // Without this the device could never confirm the claim, so the server
    // re-offered the same rows forever — and a re-offered NEGATIVE row means
    // the child is robbed again on every sync.
    const world = createWorld();
    const kid = await world.createUser({});
    grant(world, kid.uid, 100);
    grant(world, kid.uid, -100);
    const r = await claim(world, kid, { proto: 2, device: 'dtestdevice0001' });
    assert.equal(r.data.granted, 0, 'the two cancel out');
    assert.truthy(r.data.receipt, 'but rows WERE claimed, so there must be a receipt');
    await claim(world, kid, { ackOnly: true, ackReceipts: [r.data.receipt] });
    ageClaims(world, kid.uid);
    const later = await claim(world, kid, { proto: 2, device: 'dtestdevice0001' });
    assert.equal(later.data.granted, 0);
    assert.falsy(later.data.receipt, 'once acked there is nothing left to offer');
  });

  test('a negative IOU is paid to one device only, never re-offered to the other', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    grant(world, kid.uid, -120);
    const phone = await claim(world, kid, { proto: 2, device: 'dphone0000000001' });
    assert.equal(phone.data.granted, -120, 'the debit lands');
    ageClaims(world, kid.uid);
    const tablet = await claim(world, kid, { proto: 2, device: 'dtablet000000001' });
    assert.equal(tablet.data.granted, 0, 'the other device must not be robbed a second time');
    const again = await claim(world, kid, { proto: 2, device: 'dphone0000000001' });
    assert.equal(again.data.granted, -120, 'the device that lost its ack still gets it back');
  });
});

suite('cướp đêm: the bonus ticket counts an ICT day', () => {
  test('practice at 2 a.m. counts for that morning, not for nobody', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const { ticketStats, nightDate } = helper();
    // 2026-09-04 02:00 ICT is 2026-09-03 19:00 UTC. SQLite reads a bare
    // 'YYYY-MM-DD' as UTC midnight, so the old window started at 07:00 ICT and
    // this session counted for no day at all.
    const date = nightDate(Date.UTC(2026, 8, 3, 19, 0, 0));
    assert.equal(date, '2026-09-04', 'the fixture really is the small hours of the 4th');
    for (let i = 0; i < 12; i++) {
      world.db.prepare(
        "INSERT INTO learning_skill_results (user_id, client_session_id, menu, skill_key, skill_label, attempts, correct, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(kid.uid, 's' + i, 'grammar', 'sk' + i, 'Skill ' + i, 1, 1, '2026-09-03 19:00:00');
    }
    const stats = await ticketStats(world.env, kid.uid, date);
    assert.equal(stats.allowance, 4, 'ten answers before dawn still earn the extra ticket');
  });

  test('practice from the previous ICT day does not leak into today', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const { ticketStats } = helper();
    for (let i = 0; i < 12; i++) {
      world.db.prepare(
        "INSERT INTO learning_skill_results (user_id, client_session_id, menu, skill_key, skill_label, attempts, correct, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(kid.uid, 's' + i, 'grammar', 'sk' + i, 'Skill ' + i, 1, 1, '2026-09-03 09:00:00'); // 16:00 ICT on the 3rd
    }
    assert.equal((await ticketStats(world.env, kid.uid, '2026-09-04')).allowance, 3, 'yesterday stays yesterday');
    assert.equal((await ticketStats(world.env, kid.uid, '2026-09-03')).allowance, 4, 'and counts for its own day');
  });
});

suite('cướp đêm: a shield is a shield, whenever it went up', () => {
  test('a Khiên Đêm raised mid-raid still protects the house', async () => {
    // The snapshot pins the shield as it was at /start. That was a narrow miss
    // while a raid had to finish within five minutes; the window is fifteen
    // now, so a defender could spend a shield — earned from a daily task, and
    // scarce — on a house already being marched on, and get nothing for it.
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 900 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));

    const s = await start(world, attacker, victim);
    assert.truthy(s.ok && s.data.raid, JSON.stringify(s.data));
    assert.falsy(s.data.raid.shielded, 'the house really was unshielded when the troops set out');

    // The defender opens the app mid-raid and burns a shield.
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?')
      .run(Date.now() + 3600000, victim.uid);

    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.truthy(f.ok, JSON.stringify(f.data));
    assert.truthy(f.data.result.shielded, 'the result must say a shield was met');
    assert.falsy(f.data.result.won, 'and a shielded raid always loses');
    assert.equal(owedTo(world, victim.uid), f.data.result.defenderGain,
      'the defender is paid for holding, not robbed');
    assert.truthy(f.data.result.defenderGain > 0);
  });

  test('a shield that was up at the start still counts if it lapses mid-raid', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 900 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?')
      .run(Date.now() + 60000, victim.uid);

    const s = await start(world, attacker, victim);
    assert.truthy(s.data.raid.shielded, 'the troops set out against a shielded house');
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(1, victim.uid);
    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.falsy(f.data.result.won, 'the shield they marched into still decides it');
  });

  test('no shield anywhere is still an ordinary raid', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await start(world, attacker, victim);
    const f = await finish(world, attacker, s.data.raid.raidId);
    assert.falsy(f.data.result.shielded);
    assert.truthy(f.data.result.won, 'a strong army still beats an undefended house');
  });
});

suite('cướp đêm: a refusal never costs a door', () => {
  test('a child with no home of their own is turned away without burning a cooldown', async () => {
    // The ruins branch used to write its row BEFORE the "you have no home"
    // check, so a child who had never opened Nhà Cướp Đêm and tapped a sealed
    // house got a 12 h cooldown on it — and then a 409 saying they could not
    // raid at all.
    const world = createWorld();
    const homeless = await world.createUser({ allowBot: true });
    const sealed = await world.createUser({ allowBot: true });
    await seedHome(world, sealed, Object.assign({ coins: 1000 }, WEAK));
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?')
      .run(Date.now() + 3600000, sealed.uid);

    const r = await start(world, homeless, sealed);
    assert.falsy(r.ok, 'a child with no home cannot raid');
    assert.equal(r.status, 409);
    assert.equal(raidRows(world, homeless.uid).length, 0, 'and nothing is written down against them');

    // Once they build a home, that door is still open to them.
    await seedHome(world, homeless, Object.assign({ coins: 500 }, STRONG));
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=0 WHERE user_id=?').run(sealed.uid);
    const again = await start(world, homeless, sealed);
    assert.truthy(again.ok && again.data.raid, 'the house was never spent: ' + JSON.stringify(again.data));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
