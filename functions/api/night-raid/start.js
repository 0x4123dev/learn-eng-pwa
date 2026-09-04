import { requireAuth, json, err } from '../_lib.js';
import { NR, RAID_TTL_MS, nightDate, nightRaidEnabled, ticketStats, homeSnapshot, randomRaidId, raidLockUntil, readRaidConfig, retryAvailableAt } from '../_night-raid.js';
import { swordCount } from '../_daily-task.js';

export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid Phase 2 is not enabled',403);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const targetId=Math.trunc(+body.targetId);if(!targetId||targetId===auth.uid)return err('Invalid target');
  const cfg=await readRaidConfig(env);
  const date=nightDate(),stats=await ticketStats(env,auth.uid,date);if(stats.used>=stats.allowance)return err('Hết lượt Cướp Đêm hôm nay',429);
  const row=await env.DB.prepare('SELECT h.*,u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=? AND u.disabled=0').bind(targetId).first();if(!row)return err('Nhà này không còn khả dụng',404);
  // A shielded castle is still raided — and lost. The snapshot pins DEF to the
  // rules' ceiling; finish.js also forces the loss outright, so the shield
  // guarantee never rests on the ceiling alone. The child is NOT warned in
  // advance any more: the list says nothing about shields, so finding one is
  // part of the gamble.
  const now=Date.now();const shielded=(+row.shield_until||0)>now;
  // MY OWN cooldown on this house comes first, because it is the one thing the
  // child already knows (they were there) and the one refusal that must not
  // write a second row. It counts from my last attempt of ANY kind — win, loss
  // or ruins — which is why the ruins branch below still records one.
  const last=await env.DB.prepare('SELECT MAX(created_at) AS last_at FROM night_raids WHERE attacker_id=? AND defender_id=?').bind(auth.uid,targetId).first();
  const retryAt=retryAvailableAt(last&&last.last_at,cfg.retry_hours,now);
  if(retryAt)return err('Con vừa đánh nhà này rồi',409,{retryAt});
  // Nhà tan hoang. The house was robbed by somebody and is sealed — but the
  // child could not know that, so they do NOT get bounced for free the way
  // they used to. The attempt is recorded (status='ruined'), the client marches
  // the troops in and finds rubble. It costs no ticket and no xu, but it DOES
  // start this child's own retry_hours clock on this house, which is the whole
  // price of the gamble: one of your houses is now on cooldown for nothing.
  if(raidLockUntil(row,now)){
    const ruinedId=randomRaidId();
    await env.DB.prepare(`INSERT INTO night_raids(id,attacker_id,defender_id,seed,rules_version,snapshot_json,result_json,status,created_date,created_at,expires_at,finished_at)
      VALUES(?,?,?,0,?,?,?,'ruined',?,?,?,?)`)
      .bind(ruinedId,auth.uid,targetId,NR.RULES_VERSION,JSON.stringify({ruined:true,targetId,homeLevel:Math.max(1,+row.home_level||1)}),JSON.stringify({ruined:true,won:false,reward:0,loss:0,stars:0}),date,now,now,now).run();
    return json({ruined:true,retryAt:now+cfg.retry_hours*3600000,castleSkin:String(row.castle_skin||'stone-keep'),name:row.username,homeLevel:Math.max(1,+row.home_level||1)});
  }
  const attackerRow=await env.DB.prepare('SELECT h.*,u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=?').bind(auth.uid).first();
  if(!attackerRow)return err('Hãy mở Nhà Cướp Đêm và chuẩn bị đội hình trước',409);
  // The attacker's swords come from users.night_swords (db/019), read
  // tolerantly so a pre-migration database counts zero. homeSnapshot folds
  // them into attacker.damage through the shared combatPower — the very call
  // the client's ownPower() makes — so the two numbers agree by construction,
  // and the snapshot records the count the fight was scored with.
  attackerRow.night_swords=await swordCount(env,auth.uid);
  const attacker=homeSnapshot(attackerRow),target=homeSnapshot(row),raidId=randomRaidId(),seed=(Math.floor(Math.random()*0x7fffffff)^now)>>>0;
  target.seed=seed;target.lootableCoins=Math.max(0,+row.lootable_coins||0);target.attackerLootableCoins=Math.max(0,+attackerRow.lootable_coins||0);target.attackerDamage=attacker.damage;target.attackerDefense=attacker.defense;target.attackerSoldiers=attacker.soldiers||0;target.attackerSwords=attacker.swords||0;
  if(shielded){target.shielded=true;target.defense=100000;}
  await env.DB.prepare(`INSERT INTO night_raids(id,attacker_id,defender_id,seed,rules_version,snapshot_json,status,created_date,created_at,expires_at)
    VALUES(?,?,?,?,?,?,'active',?,?,?)`).bind(raidId,auth.uid,targetId,seed,NR.RULES_VERSION,JSON.stringify(target),date,now,now+RAID_TTL_MS).run();
  return json({raid:Object.assign({},target,{raidId,title:{vi:row.username,en:row.username}})});
}
