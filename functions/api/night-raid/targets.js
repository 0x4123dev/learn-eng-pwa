import { requireAuth, json, err } from '../_lib.js';
import { nightDate, nightRaidEnabled, ticketStats, homeSnapshot, raidLockUntil } from '../_night-raid.js';

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid Phase 2 is not enabled',403);
  const mine=await env.DB.prepare('SELECT home_level FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  const level=Math.max(1,+mine?.home_level||1),date=nightDate(),now=Date.now(),fresh=now-7*86400000;
  // Sealed homes are no longer hidden — they are sorted LAST and carry their
  // countdown, so a child who walks up to one is told when to come back rather
  // than never seeing that castle at all. They only take a slot once there are
  // fewer than three raidable homes to offer.
  const rows=await env.DB.prepare(`SELECT h.*,u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id
    WHERE h.user_id<>? AND u.disabled=0 AND h.updated_at>=?
      AND h.user_id NOT IN (SELECT defender_id FROM night_raids WHERE attacker_id=? AND created_date=? )
    ORDER BY (CASE WHEN h.ruined_until>? THEN 1 ELSE 0 END), ABS(h.home_level-?), RANDOM() LIMIT 3`).bind(auth.uid,fresh,auth.uid,date,now,level).all();
  const stats=await ticketStats(env,auth.uid,date);
  const targets=(rows.results||[]).map(row=>{const full=homeSnapshot(row);const previewCells=full.layout.cells.filter(c=>c.type!=='spike-trap');return {targetId:row.user_id,name:row.username,homeLevel:full.homeLevel,level:full.level,difficulty:full.homeLevel>level+2?'Khó':full.homeLevel<level-2?'Dễ':'Cân bằng',lockedUntil:raidLockUntil(row,now),shieldClue:(+row.shield_until||0)>now||Number(row.user_id)%3===0,sceneId:full.sceneId,layout:{cells:previewCells,dogLane:full.layout.dogLane},dogLevel:full.dogLevel,teammates:full.teammates,castleSkin:full.castleSkin,castleHp:full.castleHp,budget:0,title:{vi:row.username,en:row.username}};});
  return json({targets,ticketsLeft:Math.max(0,stats.allowance-stats.used),learningBoost:stats.allowance>3});
}
