import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, safeJson } from '../_night-raid.js';
import { farmClock } from '../_farm.js';

// Harvest everything that is ready: fields by their 24h clock, barracks and
// crops by finished task-days. A ripe crop that is WILTED (yesterday skipped,
// today not done) is skipped and reported — finishing today's tasks revives
// it. Coins land as a delta on lootable_coins exactly like the fields always
// did; there is one harvest path for everything on the estate.
export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body={};try{body=await request.json();}catch(e){}
  const uid=String(body.uid||''),row=await env.DB.prepare('SELECT layout_json,lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  if(!row)return err('Hãy mở Nhà Cướp Đêm trước',409);
  const now=Date.now(),{dayCount,ctx}=await farmClock(env,auth.uid,now),Farm=NR.farmRules;
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],soldiers:0}),{dayCount,today:ctx.today,now});
  let coins=Math.max(0,+row.lootable_coins||0),soldiers=layout.soldiers,collectedCoins=0,collectedSoldiers=0,wilted=false;const harvested=[];
  const pay=amount=>{if(coins>=100000)return 0;const gain=Math.min(amount,100000-coins);coins+=gain;collectedCoins+=gain;return gain;};
  // Returns the cells that STAY on the board (harvested crops leave it).
  const sweep=(cells,zone)=>cells.filter(cell=>{
    const def=NR.itemById(cell.type);if(!def||(uid&&cell.uid!==uid))return true;
    if(def.producer==='coins'){if(cell.readyAt<=now&&pay(def.yield))cell.readyAt=now+def.productionMs;return true;}
    if(def.producer==='soldier'){if(Farm.barracksReady(cell,dayCount)){soldiers++;collectedSoldiers++;cell.lastDay=dayCount;}return true;}
    if(def.kind==='crop'){
      if(!Farm.progress(cell,dayCount).ripe)return true;
      if(Farm.isWilted(cell,ctx)){wilted=true;return true;}
      // A crop pays all or nothing. `pay` clamps to the wallet ceiling, so a purse
      // with 1 xu of room used to hand over 1 xu and delete a 45-xu plant. The
      // fields keep the old partial behaviour — they re-arm rather than vanish.
      if(coins+def.yield>100000)return true;
      if(!pay(def.yield))return true;
      harvested.push({type:cell.type,gx:cell.gx,gy:cell.gy,zone});return false;
    }
    return true;
  });
  layout.cells=sweep(layout.cells,0);
  layout.farms=layout.farms.map((f,i)=>({cells:sweep(f.cells,i+1),x:f.x,y:f.y}));
  layout.soldiers=soldiers;
  if(!collectedCoins&&!collectedSoldiers){
    // Nothing was harvested — but normalizeLayout above may still have
    // CONVERTED a legacy barracks (the old 24h `readyAt` → `lastDay`, paid per
    // finished task-day), and a conversion only counts if it is written down.
    // This reply used to throw it away, so the cell went back to storage still
    // carrying readyAt and no lastDay, and was converted again to the CURRENT
    // dayCount on the next read — never one day behind it, so
    // FarmRules.barracksReady stayed false and the child's soldiers stood at 0
    // for ever. It escaped only when some OTHER write (a builder PUT, or a
    // collect that harvested something else) happened to save the conversion.
    //
    // Layout ONLY: lootable_coins is never touched here. A raid may be
    // deducting from that column right now, which is exactly why the harvest
    // below adds its coins as a delta instead of an absolute number.
    const fixed=JSON.stringify(layout);
    if(fixed!==String(row.layout_json||''))await env.DB.prepare('UPDATE night_raid_homes SET layout_json=?,updated_at=? WHERE user_id=?').bind(fixed,now,auth.uid).run();
    return json({ok:true,nothingReady:true,wilted,layout,coins,soldiers,dayCount,ctx});
  }
  // Add the harvest as a DELTA instead of writing back the absolute number:
  // the old read-modify-write raced with a concurrent collect or a raid
  // deduction, and whichever wrote last silently undid the other's money.
  await env.DB.prepare('UPDATE night_raid_homes SET layout_json=?,lootable_coins=MIN(100000,MAX(0,lootable_coins)+?),updated_at=? WHERE user_id=?').bind(JSON.stringify(layout),collectedCoins,now,auth.uid).run();
  const fresh=await env.DB.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  return json({ok:true,layout,coins:Math.max(0,Math.trunc(+((fresh&&fresh.lootable_coins))||0)),soldiers,collectedCoins,collectedSoldiers,harvested,wilted,dayCount,ctx});
}
