import { requireAuth, json, err } from '../_lib.js';
import { NR, RAID_TTL_MS, nightDate, nightRaidEnabled, ticketStats, homeSnapshot, randomRaidId, raidLockUntil } from '../_night-raid.js';

export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid Phase 2 is not enabled',403);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const targetId=Math.trunc(+body.targetId);if(!targetId||targetId===auth.uid)return err('Invalid target');
  const date=nightDate(),stats=await ticketStats(env,auth.uid,date);if(stats.used>=stats.allowance)return err('Hết lượt Cướp Đêm hôm nay',429);
  const row=await env.DB.prepare('SELECT h.*,u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=? AND u.disabled=0').bind(targetId).first();if(!row)return err('Nhà này không còn khả dụng',404);
  // A shielded castle is still raided — and lost. The snapshot pins DEF to the
  // rules' ceiling; finish.js also forces the loss outright, so the shield
  // guarantee never rests on the ceiling alone.
  const now=Date.now();const shielded=(+row.shield_until||0)>now;
  // Sealed by an earlier breach: bounce BEFORE a raid row exists, so the visit
  // costs nothing and the client can show how long is left on the clock.
  const locked=raidLockUntil(row,now);if(locked)return json({locked:true,lockedUntil:locked,ticketReturned:true});
  const prior=await env.DB.prepare('SELECT id FROM night_raids WHERE attacker_id=? AND defender_id=? AND created_date=?').bind(auth.uid,targetId,date).first();if(prior)return err('Hôm nay con đã thăm nhà này rồi',409);
  const attackerRow=await env.DB.prepare('SELECT h.*,u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=?').bind(auth.uid).first();
  if(!attackerRow)return err('Hãy mở Nhà Cướp Đêm và chuẩn bị đội hình trước',409);
  const attacker=homeSnapshot(attackerRow),target=homeSnapshot(row),raidId=randomRaidId(),seed=(Math.floor(Math.random()*0x7fffffff)^now)>>>0;
  target.seed=seed;target.lootableCoins=Math.max(0,+row.lootable_coins||0);target.attackerLootableCoins=Math.max(0,+attackerRow.lootable_coins||0);target.attackerDamage=attacker.damage;target.attackerDefense=attacker.defense;target.attackerSoldiers=attacker.soldiers||0;
  if(shielded){target.shielded=true;target.defense=100000;}
  await env.DB.prepare(`INSERT INTO night_raids(id,attacker_id,defender_id,seed,rules_version,snapshot_json,status,created_date,created_at,expires_at)
    VALUES(?,?,?,?,?,?,'active',?,?,?)`).bind(raidId,auth.uid,targetId,seed,NR.RULES_VERSION,JSON.stringify(target),date,now,now+RAID_TTL_MS).run();
  return json({raid:Object.assign({},target,{raidId,title:{vi:row.username,en:row.username}})});
}
