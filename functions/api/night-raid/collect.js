import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, safeJson } from '../_night-raid.js';

export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body={};try{body=await request.json();}catch(e){}
  const uid=String(body.uid||''),row=await env.DB.prepare('SELECT layout_json,lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  if(!row)return err('Hãy mở Nhà Cướp Đêm trước',409);
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],soldiers:0})),now=Date.now();let coins=Math.max(0,+row.lootable_coins||0),soldiers=layout.soldiers,collectedCoins=0,collectedSoldiers=0;
  for(const cell of layout.cells){const def=NR.defenseById(cell.type);if(!def?.producer||(uid&&cell.uid!==uid)||cell.readyAt>now)continue;
    if(def.producer==='coins'&&coins<100000){const gain=Math.min(def.yield,100000-coins);coins+=gain;collectedCoins+=gain;cell.readyAt=now+def.productionMs;}
    else if(def.producer==='soldier'&&soldiers<NR.MAX_SOLDIERS){soldiers++;collectedSoldiers++;cell.readyAt=now+def.productionMs;}
  }
  layout.soldiers=soldiers;
  if(!collectedCoins&&!collectedSoldiers)return json({ok:true,nothingReady:true,layout,coins,soldiers});
  // Add the harvest as a DELTA instead of writing back the absolute number:
  // the old read-modify-write raced with a concurrent collect or a raid
  // deduction, and whichever wrote last silently undid the other's money.
  await env.DB.prepare('UPDATE night_raid_homes SET layout_json=?,lootable_coins=MIN(100000,MAX(0,lootable_coins)+?),updated_at=? WHERE user_id=?').bind(JSON.stringify(layout),collectedCoins,now,auth.uid).run();
  const fresh=await env.DB.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  return json({ok:true,layout,coins:Math.max(0,Math.trunc(+((fresh&&fresh.lootable_coins))||0)),soldiers,collectedCoins,collectedSoldiers});
}
