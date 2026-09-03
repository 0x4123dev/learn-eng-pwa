import { requireAuth, json, err } from '../_lib.js';
import { NR, RAID_LOCK_MS, nightDate, ticketStats, safeJson, resultReward } from '../_night-raid.js';
import { SHIELD_RAID_LOSS } from '../_daily-task.js';

export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const raidId=String(body.raidId||'');if(!/^[a-f0-9]{32}$/.test(raidId))return err('Invalid raid id');
  const raid=await env.DB.prepare('SELECT * FROM night_raids WHERE id=?').bind(raidId).first();if(!raid)return err('Raid not found',404);if(raid.attacker_id!==auth.uid)return err('Forbidden',403);
  if(raid.status==='done')return json({ok:true,result:safeJson(raid.result_json,{})});
  if(raid.status!=='active'||raid.expires_at<Date.now())return err('Raid expired',409);
  const snapshot=safeJson(raid.snapshot_json,null);if(!snapshot)return err('Broken raid snapshot',500);
  const sim=NR.resolveAutoBattle(snapshot),date=nightDate(),stats=await ticketStats(env,auth.uid,date);
  // A shield decides the raid outright, independent of the rules' 100000-DEF
  // ceiling: even if the ceiling ever changed, a shielded snapshot can never win.
  const won=sim.won&&!snapshot.shielded;
  const reward=resultReward(won?sim:Object.assign({},sim,{won:false}),snapshot,stats.reward),victimLoss=won?Math.min(Math.floor(Math.max(0,+snapshot.lootableCoins||0)*.10),reward):0;
  // Hitting a shield costs a flat 200 (the client floors the wallet at 0);
  // an ordinary defeat costs the 10–30 xu marching fee.
  const attackerLoss=won?0:(snapshot.shielded?SHIELD_RAID_LOSS:Math.min(30,Math.max(10,Math.floor(Math.max(0,+snapshot.attackerLootableCoins||0)*.05))));
  const soldiersUsed=Math.max(0,Math.min(NR.MAX_SOLDIERS,Math.trunc(+snapshot.attackerSoldiers||0))),result={won,shielded:!!snapshot.shielded,castleHp:sim.castleHp,damage:sim.damage,defense:sim.defense,margin:sim.margin,durationMs:sim.durationMs,reward,loot:victimLoss,loss:attackerLoss,soldiersUsed,stars:won?1+(sim.margin>=25?1:0)+(sim.margin>=60?1:0):0};
  // A breach seals the home for a flat 24 hours, so the defender always gets
  // the same protection whatever time of night they were hit.
  const now=Date.now(),lockedUntil=won?now+RAID_LOCK_MS:0;
  result.lockedUntil=lockedUntil;
  let soldierLayout=null;if(soldiersUsed>0){const home=await env.DB.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').bind(raid.attacker_id).first();soldierLayout=NR.normalizeLayout(safeJson(home&&home.layout_json,{cells:[],soldiers:0}));soldierLayout.soldiers=Math.max(0,soldierLayout.soldiers-soldiersUsed);result.soldiers=soldierLayout.soldiers;}
  const statements=[
    env.DB.prepare("UPDATE night_raids SET status='done',deploy_log_json=?,result_json=?,finished_at=? WHERE id=? AND status='active'").bind('[]',JSON.stringify(result),now,raidId),
    env.DB.prepare(`INSERT INTO night_raid_daily(user_id,raid_date,tickets_used,reward_earned) VALUES(?,?,1,?)
      ON CONFLICT(user_id,raid_date) DO UPDATE SET tickets_used=tickets_used+1,reward_earned=MIN(200,reward_earned+excluded.reward_earned)`).bind(auth.uid,date,reward),
  ];
  // The lock is its OWN statement. It used to ride along with the coin theft,
  // which meant a breached home with nothing worth stealing — or one raided by
  // someone already at the daily reward cap — was left wide open for the next
  // attacker, because `victimLoss > 0` was false and the whole UPDATE was skipped.
  if(won)statements.push(env.DB.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?').bind(lockedUntil,raid.defender_id));
  if(victimLoss>0)statements.push(env.DB.prepare('UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=?').bind(victimLoss,raid.defender_id));
  if(attackerLoss>0)statements.push(env.DB.prepare('UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=?').bind(attackerLoss,raid.attacker_id));
  if(soldierLayout)statements.push(env.DB.prepare('UPDATE night_raid_homes SET layout_json=?,updated_at=? WHERE user_id=?').bind(JSON.stringify(soldierLayout),now,raid.attacker_id));
  await env.DB.batch(statements);
  return json({ok:true,result});
}
