import { requireAuth, json, err } from '../_lib.js';
import { NR, nightDate, ticketStats, safeJson, readRaidConfig, winReward } from '../_night-raid.js';

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
    return err('Hết giờ trận này rồi — con vào lại nhà đó được ngay',409,{expired:true});
  }
  const snapshot=safeJson(raid.snapshot_json,null);if(!snapshot)return err('Broken raid snapshot',500);
  const cfg=await readRaidConfig(env);
  const sim=NR.resolveAutoBattle(snapshot),date=nightDate(),stats=await ticketStats(env,auth.uid,date);
  // A shield decides the raid outright, independent of the rules' 100000-DEF
  // ceiling: even if the ceiling ever changed, a shielded snapshot can never win.
  const won=sim.won&&!snapshot.shielded;
  // Both piles are read FRESH, not taken from the snapshot, because every coin
  // this handler moves has to come out of somewhere: the raid transfers money
  // between two children, it never prints or burns it. Reading the real piles
  // is what lets the two UPDATEs below be exactly equal and opposite.
  const wallets=await env.DB.prepare('SELECT user_id, lootable_coins FROM night_raid_homes WHERE user_id IN (?,?)').bind(raid.attacker_id,raid.defender_id).all();
  const pile=id=>{const r=((wallets&&wallets.results)||[]).find(w=>Number(w.user_id)===Number(id));return Math.max(0,Math.trunc(+((r&&r.lootable_coins)||0)));};
  // A robbery carries home win_pct of the victim's pile, capped by win_cap and
  // by what is left of today's daily_reward_cap — and the victim loses exactly
  // that, no more. The old formula had a 50 xu floor, which paid best for
  // robbing the poorest house in the game.
  const reward=won?winReward(pile(raid.defender_id),cfg,stats.reward):0;
  const victimLoss=reward;
  // A failed raid costs the attacker `loss` (or `shield_loss` when it broke on
  // a Khiên Đêm) and hands that same amount to the DEFENDER, who until now got
  // nothing for holding the wall. Clamped to what the attacker actually has,
  // so a broke raider cannot conjure coins into the defender's pile.
  const attackerLoss=won?0:Math.min(pile(raid.attacker_id),snapshot.shielded?cfg.shield_loss:cfg.loss);
  const defenderGain=attackerLoss;
  // soldiersUsed nay chỉ là SỐ LÍNH ĐÃ RA TRẬN để ghi vào nhật ký — không
  // còn trừ vào kho nữa. Lính là quân thường trực: bé nuôi được bao nhiêu thì
  // giữ bấy nhiêu, thắng hay thua cũng không mất.
  const soldiersUsed=Math.max(0,Math.min(NR.SOLDIER_SANITY_CAP,Math.trunc(+snapshot.attackerSoldiers||0))),result={won,shielded:!!snapshot.shielded,castleHp:sim.castleHp,damage:sim.damage,defense:sim.defense,margin:sim.margin,durationMs:sim.durationMs,reward,loot:victimLoss,loss:attackerLoss,defenderGain,soldiersUsed,stars:won?1+(sim.margin>=25?1:0)+(sim.margin>=60?1:0):0};
  // A breach seals the home for a flat seal_hours, so the defender always gets
  // the same protection whatever time of night they were hit.
  const now=Date.now(),lockedUntil=won?now+cfg.seal_hours*3600000:0;
  result.lockedUntil=lockedUntil;
  // (Không còn trừ lính khỏi nhà của bên tấn công.)
  //
  // CLAIM FIRST, then move the money. This UPDATE is the whole idempotency
  // guard: exactly one caller can flip active→done, and only that caller runs
  // the batch below. It used to sit INSIDE the batch alongside unguarded coin
  // UPDATEs, so two overlapping /finish calls (finishOnline racing
  // retryPendingFinish, a double tap, a retry inside D1 latency) both passed
  // the status read at the top and both moved the money — the defender was
  // debited twice for one raid and tickets_used jumped by 2.
  const claim=await env.DB.prepare("UPDATE night_raids SET status='done',deploy_log_json=?,result_json=?,finished_at=? WHERE id=? AND status='active'")
    .bind('[]',JSON.stringify(result),now,raidId).run();
  if(!Number(claim.meta&&claim.meta.changes||0)){
    // Somebody else scored it between our read and our write. Their result is
    // the real one; replay it rather than paying a second time.
    const settled=await env.DB.prepare('SELECT result_json FROM night_raids WHERE id=?').bind(raidId).first();
    return json({ok:true,result:safeJson(settled&&settled.result_json,result)});
  }
  const statements=[
    env.DB.prepare(`INSERT INTO night_raid_daily(user_id,raid_date,tickets_used,reward_earned) VALUES(?,?,1,?)
      ON CONFLICT(user_id,raid_date) DO UPDATE SET tickets_used=tickets_used+1,reward_earned=MIN(?,reward_earned+excluded.reward_earned)`).bind(auth.uid,date,reward,cfg.daily_reward_cap),
  ];
  // The lock is its OWN statement. It used to ride along with the coin theft,
  // which meant a breached home with nothing worth stealing — or one raided by
  // someone already at the daily reward cap — was left wide open for the next
  // attacker, because `victimLoss > 0` was false and the whole UPDATE was skipped.
  if(won)statements.push(env.DB.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?').bind(lockedUntil,raid.defender_id));
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
  if(victimLoss>0)grants.push([raid.defender_id,-victimLoss,'Cướp Đêm: nhà con bị cướp']);
  if(defenderGain>0)grants.push([raid.defender_id,defenderGain,'Cướp Đêm: con giữ được nhà']);
  if(victimLoss>0)statements.push(env.DB.prepare('UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=?').bind(victimLoss,raid.defender_id));
  if(attackerLoss>0){
    statements.push(env.DB.prepare('UPDATE night_raid_homes SET lootable_coins=MAX(0,lootable_coins-?) WHERE user_id=?').bind(attackerLoss,raid.attacker_id));
    // The other half of the transfer. MIN(100000,…) is the same wallet ceiling
    // home.js enforces on a PUT, so a defeat can never push a pile past a size
    // the rest of the app refuses to store.
    statements.push(env.DB.prepare('UPDATE night_raid_homes SET lootable_coins=MIN(100000,MAX(0,lootable_coins)+?) WHERE user_id=?').bind(defenderGain,raid.defender_id));
  }
  for(const [uid,amount,note] of grants){
    statements.push(env.DB.prepare('INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,0)').bind(uid,amount,note));
  }
    await env.DB.batch(statements);
  return json({ok:true,result});
}
