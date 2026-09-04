import { requireAuth, json, err } from '../_lib.js';
import { safeJson } from '../_night-raid.js';

// GET /api/night-raid/reports — the child's night, from BOTH sides.
//
//   reports[]  raids somebody ran against MY house (the replayable ones), so
//              I can see which lane gave way. Unchanged.
//   attacks[]  what I did to other houses. This half is new: since the
//              friends list stopped announcing which houses were already
//              robbed, "did I already try this one, and what happened?" is a
//              question the child can no longer answer by looking at the list.
//              A 'ruined' row is an attack that found rubble — it cost no
//              ticket and no xu, but it did start my 12 h cooldown there, and
//              a child who cannot see that has no way to learn from the guess.
const LIMIT = 20;

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  const rows=await env.DB.prepare(`SELECT r.id,r.attacker_id,r.seed,r.rules_version,r.snapshot_json,r.deploy_log_json,r.result_json,r.finished_at,r.seen_by_defender,u.username attacker_name
    FROM night_raids r JOIN users u ON u.id=r.attacker_id WHERE r.defender_id=? AND r.status='done' AND u.disabled=0 ORDER BY r.finished_at DESC, r.rowid DESC LIMIT ?`).bind(auth.uid,LIMIT).all();
  // A ruins attempt is finished the moment it is written (status='ruined',
  // finished_at set), so both kinds sort on the same column.
  const mine=await env.DB.prepare(`SELECT r.id,r.status,r.result_json,r.finished_at,u.username defender_name
    FROM night_raids r JOIN users u ON u.id=r.defender_id WHERE r.attacker_id=? AND r.status IN ('done','ruined') AND u.disabled=0 ORDER BY r.finished_at DESC, r.rowid DESC LIMIT ?`).bind(auth.uid,LIMIT).all();
  return json({
    reports:(rows.results||[]).map(row=>({id:row.id,attackerId:row.attacker_id,attackerName:row.attacker_name,seed:row.seed,rulesVersion:row.rules_version,snapshot:safeJson(row.snapshot_json,{}),commands:safeJson(row.deploy_log_json,[]),result:safeJson(row.result_json,{}),finishedAt:row.finished_at,seen:!!row.seen_by_defender})),
    attacks:(mine.results||[]).map(row=>{const result=safeJson(row.result_json,{});
      return {id:row.id,defenderName:row.defender_name,finishedAt:row.finished_at,
        kind:row.status==='ruined'?'ruined':(result.won?'won':'lost'),
        reward:Math.max(0,Math.trunc(+result.reward||0)),loss:Math.max(0,Math.trunc(+result.loss||0)),
        stars:Math.max(0,Math.trunc(+result.stars||0)),result};}),
  });
}
export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const ids=Array.isArray(body.ids)?body.ids.filter(id=>/^[a-f0-9]{32}$/.test(String(id))).slice(0,30):[];
  for(const id of ids)await env.DB.prepare('UPDATE night_raids SET seen_by_defender=1 WHERE id=? AND defender_id=?').bind(id,auth.uid).run();
  return json({ok:true});
}
