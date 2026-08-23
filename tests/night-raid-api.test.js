const { suite, test, assert }=require('./harness');
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

suite('night raid Phase 2: schema and endpoints',()=>{
  test('migration stores homes, immutable raid snapshots and daily caps',()=>{
    const sql=read('db/009-night-raid.sql');
    for(const table of ['night_raid_homes','night_raids','night_raid_daily'])assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS '+table));
    assert.truthy(sql.includes('snapshot_json'));
    assert.truthy(sql.includes('UNIQUE INDEX IF NOT EXISTS idx_night_raids_pair_date'));
  });
  test('all authenticated endpoints exist',()=>{
    for(const name of ['home','targets','start','finish','reports','collect']){
      const file=`functions/api/night-raid/${name}.js`;
      assert.truthy(fs.existsSync(path.join(root,file)),file);
      assert.truthy(read(file).includes('requireAuth'));
    }
  });
  test('daily collection is server timed and cannot exceed the soldier cap',()=>{
    const src=read('functions/api/night-raid/collect.js');
    assert.truthy(src.includes('cell.readyAt>now'));
    assert.truthy(src.includes('soldiers<NR.MAX_SOLDIERS'));
    assert.truthy(src.includes("UPDATE night_raid_homes SET layout_json=?,lootable_coins=?"));
  });
  test('finish resolves the snapshotted DAM and DEF with shared deterministic rules',()=>{
    const src=read('functions/api/night-raid/finish.js');
    assert.truthy(src.includes('NR.resolveAutoBattle(snapshot)'));
    assert.falsy(src.includes('body.damage'));
    assert.falsy(src.includes('body.reward'));
  });
  test('start snapshots attacker power so the client cannot forge a win',()=>{
    const src=read('functions/api/night-raid/start.js');
    assert.truthy(src.includes('target.attackerDamage=attacker.damage'));
    assert.truthy(src.includes('attackerLootableCoins'));
  });
  test('ticket and reward caps are server-side',()=>{
    const start=read('functions/api/night-raid/start.js'),finish=read('functions/api/night-raid/finish.js'),helper=read('functions/api/_night-raid.js');
    assert.truthy(start.includes('stats.used>=stats.allowance'));
    assert.truthy(finish.includes('night_raid_daily'));
    assert.truthy(helper.includes('Math.min(200-'));
  });
  test('a breached home is sealed for a flat 20 hours',()=>{
    const helper=read('functions/api/_night-raid.js'),finish=read('functions/api/night-raid/finish.js');
    assert.truthy(helper.includes('export const RAID_LOCK_MS = 20 * 3600 * 1000'),'the lock is one named constant');
    assert.truthy(finish.includes('lockedUntil=sim.won?now+RAID_LOCK_MS:0'),'a win seals the home from the moment of the breach');
    // The old rule expired at ICT midnight: breached at 23:00 bought one hour
    // of peace, breached at 00:30 bought nearly a day.
    assert.falsy(finish.includes('setUTCHours(24,0,0,0)'),'end-of-day protection must not come back');
  });
  test('the seal survives a raid that steals nothing',()=>{
    // It used to ride along with the coin theft, so a breached home with no
    // lootable coins — or one hit by a raider already at the daily reward cap —
    // stayed wide open, because that UPDATE was skipped entirely.
    const finish=read('functions/api/night-raid/finish.js');
    assert.truthy(finish.includes("if(sim.won)statements.push(env.DB.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?')"),
      'the seal is its own statement, keyed on the win alone');
    assert.falsy(/lootable_coins=MAX\(0,lootable_coins-\?\),ruined_until/.test(finish),'seal and theft must not share a statement');
  });
  test('a sealed home refuses the raid before any ticket is spent',()=>{
    const start=read('functions/api/night-raid/start.js');
    assert.truthy(start.includes('raidLockUntil(row,now)'));
    assert.truthy(start.indexOf('locked:true')<start.indexOf('INSERT INTO night_raids'),'bounce must precede the raid row');
    assert.truthy(start.includes('lockedUntil:locked'),'the client needs the deadline to show a countdown');
  });
  test('sealed homes stay visible with their countdown instead of vanishing',()=>{
    const targets=read('functions/api/night-raid/targets.js');
    assert.falsy(targets.includes('h.ruined_until IS NULL OR h.ruined_until<?'),'sealed homes are no longer filtered out');
    assert.truthy(targets.includes('ORDER BY (CASE WHEN h.ruined_until>? THEN 1 ELSE 0 END)'),'they sort last, so raidable homes fill the slots first');
    assert.truthy(targets.includes('lockedUntil:raidLockUntil(row,now)'),'each card carries its own clock');
    assert.truthy(read('functions/api/_night-raid.js').includes('lockedUntil:raidLockUntil(row)'),'my own home reports its seal too');
  });
  test('shield bounce happens before a raid row consumes a ticket',()=>{
    const src=read('functions/api/night-raid/start.js');
    assert.truthy(src.indexOf('shielded:true')<src.indexOf('INSERT INTO night_raids'));
  });
});
