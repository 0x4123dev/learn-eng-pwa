import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, homeSnapshot, safeJson } from '../_night-raid.js';

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  const row=await env.DB.prepare('SELECT h.*, u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=?').bind(auth.uid).first();
  return json({home:row?homeSnapshot(row):null});
}
export async function onRequestPut({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const current=await env.DB.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  const oldLayout=NR.normalizeLayout(current?safeJson(current.layout_json,{cells:[],soldiers:0}):{cells:[],soldiers:0}),layout=NR.normalizeLayout(body.layout),teammates=NR.normalizeTeammates(body.teammates),now=Date.now(),oldProduction=new Map(oldLayout.cells.filter(c=>NR.defenseById(c.type)?.producer&&c.uid).map(c=>[c.uid,c]));
  layout.soldiers=current?Math.min(oldLayout.soldiers,layout.soldiers):layout.soldiers;
  for(const cell of layout.cells){const def=NR.defenseById(cell.type);if(!def?.producer)continue;const prior=oldProduction.get(cell.uid);if(prior&&prior.type===cell.type)cell.readyAt=prior.readyAt;else{if(!cell.uid)cell.uid='p-'+crypto.randomUUID().replace(/-/g,'').slice(0,20);cell.readyAt=now+NR.PRODUCTION_MS;}}
  const dogLevel=Math.max(1,Math.min(999,Math.trunc(+body.dogLevel||1)));
  const homeLevel=NR.homeLevel(layout,dogLevel,teammates);
  const skin=/^[a-z0-9-]{1,30}$/.test(String(body.castleSkin||''))?String(body.castleSkin):'stone-keep';
  const coins=Math.max(0,Math.min(100000,Math.trunc(+body.coins||0))),vault=Math.max(0,Math.min(5000,Math.trunc(+body.vaultCoins||0)));
  await env.DB.prepare(`INSERT INTO night_raid_homes(user_id,layout_json,teammates_json,dog_level,castle_skin,home_level,lootable_coins,vault_coins,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET layout_json=excluded.layout_json,teammates_json=excluded.teammates_json,dog_level=excluded.dog_level,castle_skin=excluded.castle_skin,home_level=excluded.home_level,lootable_coins=excluded.lootable_coins,vault_coins=excluded.vault_coins,updated_at=excluded.updated_at`)
    .bind(auth.uid,JSON.stringify(layout),JSON.stringify(teammates),dogLevel,skin,homeLevel,coins,vault,Date.now()).run();
  return json({ok:true,homeLevel,layout,coins});
}
