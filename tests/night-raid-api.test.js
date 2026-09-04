const { suite, test, assert }=require('./harness');
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

suite('night raid Phase 2: schema and endpoints',()=>{
  test('migration stores homes, immutable raid snapshots and daily caps',()=>{
    const sql=read('db/009-night-raid.sql');
    for(const table of ['night_raid_homes','night_raids','night_raid_daily'])assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS '+table));
    assert.truthy(sql.includes('snapshot_json'));
    // 009 created a UNIQUE (attacker, defender, ICT day) index — one attempt
    // per pair per day. db/021 replaced that rule with a 12 h per-pair clock,
    // so the index must be dropped: it would refuse a legal retry made later
    // the same night. A fresh build never creates it at all.
    const rules=read('db/021-night-raid-rules.sql'),schema=read('db/schema.sql');
    assert.truthy(rules.includes('DROP INDEX IF EXISTS idx_night_raids_pair_date;'));
    assert.truthy(rules.includes('CREATE INDEX IF NOT EXISTS idx_night_raids_pair_recent'));
    assert.truthy(rules.includes('CREATE TABLE IF NOT EXISTS night_raid_config'));
    assert.falsy(schema.includes('idx_night_raids_pair_date'));
    assert.truthy(schema.includes('CREATE TABLE IF NOT EXISTS night_raid_config'));
  });
  test('all authenticated endpoints exist',()=>{
    for(const name of ['home','targets','start','finish','reports','collect','plant']){
      const file=`functions/api/night-raid/${name}.js`;
      assert.truthy(fs.existsSync(path.join(root,file)),file);
      assert.truthy(read(file).includes('requireAuth'));
    }
  });
  test('daily collection is server timed and the soldier stock has no ceiling',()=>{
    const src=read('functions/api/night-raid/collect.js');
    // The three FIELDS still run on the server's 24 h clock. The Trại Huấn
    // Luyện no longer does: it pays one soldier per finished task-day
    // (FarmRules.barracksReady), so its guard is a day count, not a timestamp.
    assert.truthy(src.includes('cell.readyAt<=now'));
    assert.truthy(src.includes('Farm.barracksReady(cell,dayCount)'));
    // Kho lính bỏ trần: bé nuôi bao nhiêu cũng được (bãi cỏ mới là chỗ giới hạn
    // hiển thị). Không được để một trần nào lẻn lại vào đây.
    assert.falsy(/soldiers\s*<\s*NR\./.test(src),'collect.js đặt lại trần cho kho lính');
    // The harvest is applied as a capped DELTA, never an absolute overwrite —
    // the absolute form raced with concurrent collects/raids and lost money.
    // Executed behavioural coverage lives in tests/money-server.test.js.
    assert.truthy(src.includes("lootable_coins=MIN(100000,MAX(0,lootable_coins)+?)"));
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
    // A ticket is only booked at /finish, so counting tickets_used alone let a
    // child open one raid per friend in the same minute and finish them all.
    // An in-flight raid counts against the allowance now; db/023's partial
    // unique index is the half a race cannot get past. Executed coverage lives
    // in tests/night-raid-gamble.test.js.
    assert.truthy(start.includes('stats.used+inFlight>=stats.allowance'));
    assert.truthy(start.includes("status='active'"), 'in-flight raids must be counted');
    assert.truthy(finish.includes('night_raid_daily'));
    // The 200/day cap became the tunable daily_reward_cap (db/021); what a win
    // pays is still decided here, never by the client. Executed coverage lives
    // in tests/night-raid-gamble.test.js.
    assert.truthy(helper.includes('cfg.daily_reward_cap - Math.max(0'),'the day cap still trims the reward');
    assert.falsy(finish.includes('body.reward'));
  });
  test('a breached home is sealed for a flat seal_hours, and 24 h is the default',()=>{
    const helper=read('functions/api/_night-raid.js'),finish=read('functions/api/night-raid/finish.js');
    // The executed proof (a won raid writes ruined_until = finished_at + 24 h,
    // a lost one writes nothing) lives in tests/night-raid-friends.test.js.
    assert.truthy(helper.includes('seal_hours: 24'),'24 h is the default the game ships with');
    assert.truthy(finish.includes('lockedUntil=won?now+cfg.seal_hours*3600000:0'),'a win seals the home from the moment of the breach');
    // The old rule expired at ICT midnight: breached at 23:00 bought one hour
    // of peace, breached at 00:30 bought nearly a day.
    assert.falsy(finish.includes('setUTCHours(24,0,0,0)'),'end-of-day protection must not come back');
  });
  test('the seal survives a raid that steals nothing',()=>{
    // It used to ride along with the coin theft, so a breached home with no
    // lootable coins — or one hit by a raider already at the daily reward cap —
    // stayed wide open, because that UPDATE was skipped entirely.
    const finish=read('functions/api/night-raid/finish.js');
    assert.truthy(finish.includes("if(won)statements.push(env.DB.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?')"),
      'the seal is its own statement, keyed on the win alone');
    assert.falsy(/lootable_coins=MAX\(0,lootable_coins-\?\),ruined_until/.test(finish),'seal and theft must not share a statement');
  });
  test('a sealed home is marched on and recorded, never bounced for free',()=>{
    const start=read('functions/api/night-raid/start.js');
    assert.truthy(start.includes('raidLockUntil(row,now)'));
    // The old free bounce (`locked:true, ticketReturned:true`) told the child
    // the house had already been robbed and cost them nothing. Now the attempt
    // is written down — that row IS the 12 h cooldown they paid.
    assert.falsy(start.includes('locked:true'),'the free bounce must not come back');
    assert.truthy(start.includes("'ruined',?,?,?,?)"),'the attempt is recorded as its own raid row');
    assert.truthy(start.includes('ruined:true'),'and the client is told to march in and find rubble');
    assert.truthy(start.indexOf('ruined:true')<start.indexOf("VALUES(?,?,?,?,?,?,'active'"),'no active raid is created for a ruin');
    // Executed coverage: tests/night-raid-gamble.test.js.
  });
  test('neither list may hint at a seal or a shield',()=>{
    const targets=read('functions/api/night-raid/targets.js'),friends=read('functions/api/night-raid/friends.js');
    // The removed fields are named in the header comments of both files, so
    // these look for the CODE shape, not the word.
    assert.falsy(targets.includes('lockedUntil:'),'a card must not carry the seal deadline');
    assert.falsy(targets.includes('shieldClue:'),'nor the old shield hint');
    assert.falsy(targets.includes('h.ruined_until'),'and it must not sort or filter on the seal either');
    assert.truthy(targets.includes('retryAt:retryAvailableAt(row.last_attack'),'only MY OWN clock on that house');
    assert.falsy(friends.includes('h.shield_until'),'the friends query does not even read another child\'s shield');
    assert.falsy(friends.includes('canRaidNow:'),'nor the old "is it open" flag');
    assert.truthy(friends.includes('retryAt: retryAvailableAt(row.last_attack'));
    assert.truthy(read('functions/api/_night-raid.js').includes('lockedUntil:raidLockUntil(row)'),'my OWN home still reports its seal');
  });
  test('a shielded target is still raided, with DEF pinned to the rules ceiling before the raid row is written',()=>{
    const src=read('functions/api/night-raid/start.js');
    // Neither bounce is left: a shield and a seal are both discovered by the
    // troops, never announced before the child commits.
    assert.falsy(src.includes('shielded:true,ticketReturned:true'), 'the shield bounce is gone — the raider spends the ticket and loses');
    assert.truthy(src.includes('target.shielded=true;target.defense=100000'));
    assert.truthy(src.indexOf('target.shielded=true')<src.indexOf("VALUES(?,?,?,?,?,?,'active'"));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
