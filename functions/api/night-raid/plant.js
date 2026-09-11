import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, safeJson, barracksTraining, applyBarracksTraining, withBarracksTraining } from '../_night-raid.js';
import { farmClock } from '../_farm.js';
import { seedStatus } from '../_daily-task.js';

// POST /api/night-raid/plant { cropId, zone, gx, gy }
// One request consumes one seed and saves one crop in the same D1 batch.
export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const crop=NR.farmRules.cropById(String(body.cropId||''));
  if(!crop)return err('Hạt giống không hợp lệ',400);
  const row=await env.DB.prepare('SELECT * FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  if(!row)return err('Hãy mở khu vườn trước',409);
  const now=Date.now(),clock=await farmClock(env,auth.uid,now);
  const rawLayout=safeJson(row.layout_json,{cells:[],soldiers:0});
  const layout=NR.normalizeLayout(rawLayout,{dayCount:clock.dayCount,today:clock.ctx.today,now}),training=barracksTraining(rawLayout,layout);
  const zone=Math.max(0,Math.trunc(+body.zone||0));
  const target=zone===0?layout.cells:(layout.farms[zone-1]&&layout.farms[zone-1].cells);
  const grid=zone===0?NR.BUILD_GRID:NR.farmRules.FARM_PLOT.size;
  if(!target||zone>(layout.farms||[]).length)return err('Khu đất không tồn tại',400);
  const gx=Math.trunc(+body.gx),gy=Math.trunc(+body.gy);
  if(!Number.isFinite(gx)||!Number.isFinite(gy)||gx<0||gy<0||gx>=grid||gy>=grid)return err('Ô đất không hợp lệ',400);
  const spot={gx,gy,size:1};
  if(zone===0){const castle=layout.castleCell||{gx:4,gy:1};if(NR.rectsOverlap(spot,{gx:castle.gx,gy:castle.gy,size:NR.CASTLE_SIZE}))return err('Ô này là nhà chính',409);}
  const occupied=target.some(cell=>{const def=NR.itemById(cell.type);return def&&!def.trap&&NR.rectsOverlap(spot,{gx:cell.gx,gy:cell.gy,size:NR.footprintFor(def)});});
  if(occupied)return err('Ô này đã có công trình',409);
  const uid='c-'+crypto.randomUUID().replace(/-/g,'').slice(0,20);
  target.push({type:crop.id,gx,gy,uid,day:clock.dayCount,at:clock.ctx.today});
  const clean=NR.normalizeLayout(layout,{dayCount:clock.dayCount,today:clock.ctx.today,now});
  applyBarracksTraining(clean,training);
  const homeLevel=NR.homeLevel(clean,Math.max(1,Math.trunc(+row.dog_level||1)));
  const results=await env.DB.batch([
    env.DB.prepare('UPDATE farm_seed_inventory SET quantity=quantity-1,updated_at=datetime(\'now\') WHERE user_id=? AND crop_id=? AND quantity>0').bind(auth.uid,crop.id),
    env.DB.prepare(`UPDATE night_raid_homes SET layout_json=?,home_level=?,updated_at=? WHERE user_id=? AND changes()>0`)
      .bind(JSON.stringify(withBarracksTraining(clean,training)),homeLevel,now,auth.uid),
  ]);
  if(!(results&&results[0]&&results[0].meta&&results[0].meta.changes>0))return err('Con chưa có hạt '+crop.name.vi,409);
  const seeds=await seedStatus(env,auth.uid,clock.ctx.today,clock.ctx.doneToday);
  return json({ok:true,layout:clean,dayCount:clock.dayCount,ctx:clock.ctx,seeds,planted:{id:crop.id,name:crop.name.vi}});
}
