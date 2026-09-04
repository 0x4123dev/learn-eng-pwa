import { requireAuth, json, err } from '../_lib.js';
import { nightDate, nightRaidEnabled, ticketStats, homeSnapshot, readRaidConfig, retryAvailableAt } from '../_night-raid.js';

// GET /api/night-raid/targets — three random castles to gamble on.
//
// Same rule as friends.js: a card says what the castle LOOKS like (name,
// level, the scouting preview) and when I may attack it, and nothing about
// its state. Two fields were removed for that reason:
//   - `lockedUntil`, which announced that the house had already been robbed;
//   - `shieldClue`, which existed only to hint at a Khiên Đêm.
// Sealed homes are no longer sorted last either — a position in the list is
// a hint too. They sit in the pool looking exactly like every other house,
// and a child who picks one finds the rubble when the troops arrive.
export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid Phase 2 is not enabled',403);
  const cfg=await readRaidConfig(env);
  const mine=await env.DB.prepare('SELECT home_level FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  const level=Math.max(1,+mine?.home_level||1),date=nightDate(),now=Date.now(),fresh=now-7*86400000;
  // Houses I am still on cooldown for are left out, so every card offered can
  // actually be attacked. That window used to be "anyone I visited today";
  // since db/021 it is my own retry_hours, the same clock start.js enforces.
  const retryFrom=now-cfg.retry_hours*3600000;
  const rows=await env.DB.prepare(`SELECT h.*,u.username,
      (SELECT MAX(r.created_at) FROM night_raids r WHERE r.attacker_id=? AND r.defender_id=h.user_id) AS last_attack
    FROM night_raid_homes h JOIN users u ON u.id=h.user_id
    WHERE h.user_id<>? AND u.disabled=0 AND h.updated_at>=?
      AND NOT EXISTS (SELECT 1 FROM night_raids r WHERE r.attacker_id=? AND r.defender_id=h.user_id AND r.created_at>?)
    ORDER BY ABS(h.home_level-?), RANDOM() LIMIT 3`).bind(auth.uid,auth.uid,fresh,auth.uid,retryFrom,level).all();
  const stats=await ticketStats(env,auth.uid,date);
  const targets=(rows.results||[]).map(row=>{const full=homeSnapshot(row);const previewCells=full.layout.cells.filter(c=>c.type!=='spike-trap');return {targetId:row.user_id,name:row.username,homeLevel:full.homeLevel,level:full.level,difficulty:full.homeLevel>level+2?'Khó':full.homeLevel<level-2?'Dễ':'Cân bằng',retryAt:retryAvailableAt(row.last_attack,cfg.retry_hours,now),sceneId:full.sceneId,layout:{cells:previewCells,dogLane:full.layout.dogLane},dogLevel:full.dogLevel,castleSkin:full.castleSkin,castleHp:full.castleHp,budget:0,title:{vi:row.username,en:row.username}};});
  return json({targets,ticketsLeft:Math.max(0,stats.allowance-stats.used),learningBoost:stats.allowance>3});
}
