import { requireAuth, json, err } from '../_lib.js';
import { safeJson } from '../_night-raid.js';

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  const rows=await env.DB.prepare(`SELECT r.id,r.attacker_id,r.seed,r.rules_version,r.snapshot_json,r.deploy_log_json,r.result_json,r.finished_at,r.seen_by_defender,u.username attacker_name
    FROM night_raids r JOIN users u ON u.id=r.attacker_id WHERE r.defender_id=? AND r.status='done' AND u.disabled=0 ORDER BY r.finished_at DESC LIMIT 30`).bind(auth.uid).all();
  return json({reports:(rows.results||[]).map(row=>({id:row.id,attackerId:row.attacker_id,attackerName:row.attacker_name,seed:row.seed,rulesVersion:row.rules_version,snapshot:safeJson(row.snapshot_json,{}),commands:safeJson(row.deploy_log_json,[]),result:safeJson(row.result_json,{}),finishedAt:row.finished_at,seen:!!row.seen_by_defender}))});
}
export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const ids=Array.isArray(body.ids)?body.ids.filter(id=>/^[a-f0-9]{32}$/.test(String(id))).slice(0,30):[];
  for(const id of ids)await env.DB.prepare('UPDATE night_raids SET seen_by_defender=1 WHERE id=? AND defender_id=?').bind(id,auth.uid).run();
  return json({ok:true});
}
