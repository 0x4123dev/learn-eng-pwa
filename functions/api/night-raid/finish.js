import { requireAuth, json, err } from '../_lib.js';
import { NR, nightDate, ticketStats, safeJson, readRaidConfig, winReward, winLoot, defenseAmounts, randomRaidId } from '../_night-raid.js';
import { hasColumn } from '../_daily-task.js';

// db/032 adds night_raid_daily.defense_earned. The code may be live before the
// column is (see the migration's header): while it is missing, no defence
// reward is paid and the result says so ('unmigrated') — a 200 with one
// reward short, never a 500 on every lost raid.
const defenseLedgerReady = env => hasColumn(env, 'night_raid_daily', 'defense_earned');

export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const raidId=String(body.raidId||'');if(!/^[a-f0-9]{32}$/.test(raidId))return err('Invalid raid id');
  const raid=await env.DB.prepare('SELECT * FROM night_raids WHERE id=?').bind(raidId).first();if(!raid)return err('Raid not found',404);if(raid.attacker_id!==auth.uid)return err('Forbidden',403);
  if(raid.status==='done')return json({ok:true,result:safeJson(raid.result_json,{})});
  // status='ruined' lands here too: the troops found rubble, there is nothing
  // to resolve, and it must never be turned into a ticket or a payout.
  if(raid.status!=='active')return err('Raid expired',409);
  // Out of time. The client is told plainly (409 + expired:true) so it can say
  // "hết giờ" instead of painting its own simulated win with 0 xu, which is
  // what a child saw whenever they switched apps mid-battle: Phaser sleeps its
  // loop while the tab is hidden, so any background longer than the raid
  // window landed here.
  if(raid.expires_at<Date.now()){
    // DELETED, not parked in some 'expired' state: a raid that never scored
    // must leave no trace at all. The row used to stay 'active' forever, and
    // start.js's MAX(created_at) then read it as "con vừa đánh nhà này rồi"
    // for the whole retry window — a 12 h lock bought with no ticket and no
    // xu. It also held db/009's one-row-per-pair-per-day unique index, so the
    // child could not simply try that house again.
    await env.DB.prepare("DELETE FROM night_raids WHERE id=? AND status='active'").bind(raidId).run();
    return err('Hết giờ trận này rồi — bạn vào lại nhà đó được ngay',409,{expired:true});
  }
  const snapshot=safeJson(raid.snapshot_json,null);if(!snapshot)return err('Broken raid snapshot',500);
  const cfg=await readRaidConfig(env);
  const sim=NR.resolveAutoBattle(snapshot),date=nightDate(),stats=await ticketStats(env,auth.uid,date);
  // Both piles are read FRESH, not taken from the snapshot: the loot a win
  // takes has to come out of the victim's real pile, and the fee a loss burns
  // out of the attacker's. (The two system-funded parts — the victory bonus
  // and the defence reward — are the only coins this handler creates, and
  // both are capped per ICT day.)
  const wallets=await env.DB.prepare('SELECT user_id, lootable_coins, shield_until FROM night_raid_homes WHERE user_id IN (?,?)').bind(raid.attacker_id,raid.defender_id).all();
  const homeRow=id=>((wallets&&wallets.results)||[]).find(w=>Number(w.user_id)===Number(id));
  const pile=id=>{const r=homeRow(id);return Math.max(0,Math.trunc(+((r&&r.lootable_coins)||0)));};
  // A Khiên Đêm raised WHILE the raid is in flight counts. The snapshot pins
  // the shield as it was at /start, which was a narrow miss while a raid had
  // to be finished within five minutes — but the window is fifteen now, so a
  // defender could spend a shield (earned from a daily task, and scarce) on a
  // house that was already being marched on and get nothing at all for it.
  // Either shield protects: the one that was up when the troops set out, or
  // the one that is up when they arrive.
  const liveShield=Math.max(0,Math.trunc(+((homeRow(raid.defender_id)||{}).shield_until||0)))>Date.now();
  const shielded=!!snapshot.shielded||liveShield;
  // A shield decides the raid outright, independent of the rules' 100000-DEF
  // ceiling: even if the ceiling ever changed, a shielded raid can never win.
  const won=sim.won&&!shielded;
  // A win carries home at least win_floor (100 by default), capped by win_cap
  // and today's remaining allowance. Only the loot portion comes out of the
  // defender's pile; any shortfall is the system-funded march/victory bonus.
  const defenderPile=pile(raid.defender_id);
  const reward=won?winReward(defenderPile,cfg,stats.reward):0;
  const victimLoss=won?winLoot(defenderPile,cfg,stats.reward):0;
  const victoryBonus=Math.max(0,reward-victimLoss);
  // A failed raid costs the attacker `loss` (or `shield_loss` when it broke on
  // a Khiên Đêm), clamped to what the attacker actually has — and that fee is
  // BURNED. It is no longer handed to the defender: that rule made the reward
  // for holding the wall depend on the raider's purse, so a broke raider paid
  // the child who repelled them nothing at all. The defender is paid by the
  // SYSTEM instead (defense_reward, capped per ICT day by defense_daily_cap —
  // see below), which is why the clamp here is only about the attacker.
  // What the attacker CAN pay, not what the mirror thinks they have.
  //
  // The mirror only moves on a syncHome PUT, and syncHome is called from
  // nowhere outside js/night-raid.js — the shop, the armoury, the cups,
  // lessons and exams all move appState.coins silently. So the mirror is
  // routinely stale HIGH, and the defender was credited out of a pile the
  // attacker no longer had: start a raid, back out, spend the purse, come back
  // inside the (now fifteen-minute) window and settle. The device paid
  // max(0, 0 - 100) = 0 and the friend was still handed 100. With two profiles
  // allowed per device a child could lose to themselves and mint it.
  //
  // The attacker is standing right here, so they report their real balance and
  // it can only make the loss SMALLER. A client that under-reports denies its
  // own opponent the reward and still loses the raid; it cannot create a coin,
  // which is the invariant that actually matters.
  const reported=Number.isFinite(+body.coins)?Math.max(0,Math.trunc(+body.coins)):null;
  const attackerCan=reported===null?pile(raid.attacker_id):Math.min(pile(raid.attacker_id),reported);
  const attackerLoss=won?0:Math.min(attackerCan,shielded?cfg.shield_loss:cfg.loss);
  // ---- what holding the wall pays ------------------------------------------
  // Shielded or not, a repelled raid earns the defender defense_reward from
  // the system, until they have earned defense_daily_cap that ICT day. The
  // day's total lives on the defender's night_raid_daily row (db/032) and is
  // bumped inside the settlement batch below, so ten losses against the same
  // house in one day pay exactly the cap and not a coin more.
  const ledgerReady=won?false:await defenseLedgerReady(env);
  const defenseRow=ledgerReady?await env.DB.prepare('SELECT defense_earned FROM night_raid_daily WHERE user_id=? AND raid_date=?').bind(raid.defender_id,date).first():null;
  const defense=won?{gain:0,reason:'won'}:ledgerReady?defenseAmounts(cfg,defenseRow&&defenseRow.defense_earned):{gain:0,reason:'unmigrated'};
  const defenderGain=defense.gain,defenseReason=defense.reason;
  // soldiersUsed nay chỉ là SỐ LÍNH ĐÃ RA TRẬN để ghi vào nhật ký — không
  // còn trừ vào kho nữa. Lính là quân thường trực: bé nuôi được bao nhiêu thì
  // giữ bấy nhiêu, thắng hay thua cũng không mất.
  const rewardReason=!won?'lost':reward<=0?'daily_cap':victoryBonus>0?'victory_bonus':'loot';
  const soldiersUsed=Math.max(0,Math.min(NR.SOLDIER_SANITY_CAP,Math.trunc(+snapshot.attackerSoldiers||0))),result={won,shielded,castleHp:sim.castleHp,damage:sim.damage,defense:sim.defense,margin:sim.margin,durationMs:sim.durationMs,reward,rewardReason,loot:victimLoss,victoryBonus,loss:attackerLoss,defenderGain,defenseReason,soldiersUsed,stars:won?1+(sim.margin>=25?1:0)+(sim.margin>=60?1:0):0,settlementId:randomRaidId()};
  // A breach seals the home for a flat seal_hours, so the defender always gets
  // the same protection whatever time of night they were hit.
  const now=Date.now(),lockedUntil=won?now+cfg.seal_hours*3600000:0;
  result.lockedUntil=lockedUntil;
  // (Không còn trừ lính khỏi nhà của bên tấn công.)
  //
  // Claim, ticket, transfer, grant and lock are ONE transaction. `resultJson`
  // contains a request-unique settlementId; every side effect checks that the
  // raid now contains this exact result. Thus a concurrent stale request whose
  // claim changed zero rows also changes zero money rows inside its batch.
  const resultJson=JSON.stringify(result);
  const ownsSettlement=`EXISTS (SELECT 1 FROM night_raids WHERE id=? AND status='done' AND result_json=?)`;
  const statements=[
    env.DB.prepare("UPDATE night_raids SET status='done',deploy_log_json=?,result_json=?,finished_at=? WHERE id=? AND status='active'")
      .bind('[]',resultJson,now,raidId),
    env.DB.prepare(`INSERT INTO night_raid_daily(user_id,raid_date,tickets_used,reward_earned)
      SELECT ?,?,1,? WHERE ${ownsSettlement}
      ON CONFLICT(user_id,raid_date) DO UPDATE SET tickets_used=tickets_used+1,reward_earned=MIN(?,reward_earned+excluded.reward_earned)`)
      .bind(auth.uid,date,reward,raidId,resultJson,cfg.daily_reward_cap),
  ];
  // The defender's side of the daily ledger: same upsert shape as the
  // attacker's row above, same settlement guard, same MIN() against the cap
  // so two raids settling in the same instant cannot push the day past it.
  if(defenderGain>0)statements.push(env.DB.prepare(`INSERT INTO night_raid_daily(user_id,raid_date,tickets_used,reward_earned,defense_earned)
      SELECT ?,?,0,0,? WHERE ${ownsSettlement}
      ON CONFLICT(user_id,raid_date) DO UPDATE SET defense_earned=MIN(?,defense_earned+excluded.defense_earned)`)
    .bind(raid.defender_id,date,defenderGain,raidId,resultJson,cfg.defense_daily_cap));
  // The lock is its OWN statement. It used to ride along with the coin theft,
  // which meant a breached home with nothing worth stealing — or one raided by
  // someone already at the daily reward cap — was left wide open for the next
  // attacker, because `victimLoss > 0` was false and the whole UPDATE was skipped.
  if(won)statements.push(env.DB.prepare(`UPDATE night_raid_homes SET ruined_until=? WHERE user_id=? AND ${ownsSettlement}`).bind(lockedUntil,raid.defender_id,raidId,resultJson));
  // ---- moving the money ---------------------------------------------------
  // night_raid_homes.lootable_coins is a MIRROR of the child's device wallet,
  // not the wallet itself (functions/api/coins.js): the device overwrites it
  // on the next syncHome PUT. So writing the other child's loss here and
  // stopping was not a transfer at all — the victim's phone knew nothing about
  // it, kept its old balance, and the very next PUT put the stolen coins back.
  // Every raid therefore PRINTED its reward.
  //
  // The side that is standing in front of the screen (the attacker) applies
  // its own half locally, once per raidId (claimVerified). The side that is
  // ASLEEP gets a coin_grants IOU — the same receipt-protected pipeline the
  // admin gifts and the ghost offering use — so the adjustment survives until
  // their device is next online, and can only ever be applied once.
  const grants=[];
  if(victimLoss>0)grants.push([raid.defender_id,-victimLoss,'Cướp Đêm: nhà bạn bị cướp']);
  if(defenderGain>0)grants.push([raid.defender_id,defenderGain,'Cướp Đêm: bạn giữ được nhà']);
  if(victimLoss>0)statements.push(env.DB.prepare(`UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=? AND ${ownsSettlement}`).bind(victimLoss,raid.defender_id,raidId,resultJson));
  // The marching fee leaves the attacker's mirror and goes nowhere: burned.
  if(attackerLoss>0)statements.push(env.DB.prepare(`UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=? AND ${ownsSettlement}`).bind(attackerLoss,raid.attacker_id,raidId,resultJson));
  // The defence reward lands on the defender's mirror — independent of what
  // the attacker paid, which is the whole point. MIN(100000,…) is the same
  // wallet ceiling home.js enforces on a PUT, so a defeat can never push a
  // pile past a size the rest of the app refuses to store.
  if(defenderGain>0)statements.push(env.DB.prepare(`UPDATE night_raid_homes SET lootable_coins=MIN(100000,MAX(0,lootable_coins)+?) WHERE user_id=? AND ${ownsSettlement}`).bind(defenderGain,raid.defender_id,raidId,resultJson));
  for(const [uid,amount,note] of grants){
    statements.push(env.DB.prepare(`INSERT INTO coin_grants (user_id, amount, note, granted_by) SELECT ?,?,?,0 WHERE ${ownsSettlement}`).bind(uid,amount,note,raidId,resultJson));
  }
  const batch=await env.DB.batch(statements);
  const claim=batch&&batch[0];
  if(!Number(claim&&claim.meta&&claim.meta.changes||0)){
    const settled=await env.DB.prepare('SELECT result_json FROM night_raids WHERE id=?').bind(raidId).first();
    return json({ok:true,result:safeJson(settled&&settled.result_json,result)});
  }
  return json({ok:true,result});
}
