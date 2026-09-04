import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, homeSnapshot, safeJson } from '../_night-raid.js';
import { swordCount } from '../_daily-task.js';
import { farmClock } from '../_farm.js';

export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  const now=Date.now(),clock=await farmClock(env,auth.uid,now);
  const row=await env.DB.prepare('SELECT h.*, u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=?').bind(auth.uid).first();
  // The owner sees their own DAM the way start.js will score it: swords in.
  if(row)row.night_swords=await swordCount(env,auth.uid);
  const home=row?homeSnapshot(row):null;
  // Only the server knows dayCount, so only this read can convert a barracks
  // that still carries the old 24h clock (see normalizeLayout in the rules).
  // `now` goes with it: a legacy timer that had already elapsed keeps the
  // soldier it had earned instead of converting to "already collected today".
  if(home)home.layout=NR.normalizeLayout(home.layout,{dayCount:clock.dayCount,today:clock.ctx.today,now});
  // shieldUntil is for the OWNER only — targets.js never exposes it.
  return json({home:home?Object.assign(home,{shieldUntil:Math.max(0,Math.trunc(+row.shield_until||0))}):null,dayCount:clock.dayCount,ctx:clock.ctx});
}
export async function onRequestPut({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body;try{body=await request.json();}catch(e){return err('Invalid JSON');}
  const now=Date.now(),clock=await farmClock(env,auth.uid,now),dayCount=clock.dayCount,today=clock.ctx.today;
  const current=await env.DB.prepare('SELECT layout_json,dog_level,castle_skin,lootable_coins,vault_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  const oldLayout=NR.normalizeLayout(current?safeJson(current.layout_json,{cells:[],soldiers:0}):{cells:[],soldiers:0},{dayCount,today,now});
  // A field the client did not send — or sent as something that is not a
  // number — keeps its stored value. This request used to default every
  // missing field (coins→0, dogLevel→1, layout→empty), so one buggy or
  // half-hydrated client PUT erased the wallet, the dog and every building
  // in a single statement.
  const num=v=>typeof v==='number'&&Number.isFinite(v);
  const layout=body.layout===undefined?oldLayout:NR.normalizeLayout(body.layout,{dayCount,today,now});
  // Every cell the server already knows, by uid — main board and extra farms.
  const oldByUid=new Map(NR.farmRules.allCells(oldLayout).filter(c=>c.uid).map(c=>[c.uid,c]));
  const newUid=prefix=>prefix+crypto.randomUUID().replace(/-/g,'').slice(0,20);
  // The server stamps every clock. A client may move a plant or a barracks,
  // never rewind it: a cell whose uid the server knows keeps the server's
  // day/at/lastDay/readyAt; a cell it has never seen starts today.
  const stamp=cell=>{const def=NR.itemById(cell.type);if(!def)return;const prior=cell.uid?oldByUid.get(cell.uid):null,same=!!(prior&&prior.type===cell.type);
    if(def.producer==='coins'){if(same)cell.readyAt=prior.readyAt;else{if(!cell.uid)cell.uid=newUid('p-');cell.readyAt=now+NR.PRODUCTION_MS;}}
    else if(def.producer==='soldier'){if(same&&Number.isFinite(+prior.lastDay))cell.lastDay=prior.lastDay;else{if(!cell.uid)cell.uid=newUid('p-');cell.lastDay=dayCount;}delete cell.readyAt;}
    else if(def.kind==='crop'){if(same){cell.day=prior.day;cell.at=prior.at;}else{if(!cell.uid)cell.uid=newUid('c-');cell.day=dayCount;cell.at=today;}}
    else if(def.kind==='farm'){if(!cell.uid)cell.uid=newUid('f-');}};
  layout.cells.forEach(stamp);layout.farms.forEach(f=>f.cells.forEach(stamp));
  // buyMax: a NEW field of a type the child already owns is dropped. Fields the
  // child already has are never touched — the cap is on BUYING, not on OWNING.
  // The allowance for a type is therefore max(stored count, buyMax): a child
  // with four rice fields keeps all four and is only refused a fifth. Keep the
  // FIRST `allowance` cells of that type in the incoming layout, drop the rest.
  //
  // This must not key on uid. It used to keep a cell only when its uid was one
  // the server already knew, with room = max(0, max(had,buyMax) - had) = 0 for
  // anyone who owned one at all — but stamp() above mints a fresh uid for every
  // cell that arrived without one, so those cells matched nothing and were ALL
  // dropped: one PUT whose producer cells carried no uid turned four rice
  // fields and two tomato gardens into zero and zero.
  for(const def of NR.DEFENSES){if(!def.buyMax)continue;
    const allowance=Math.max(oldLayout.cells.filter(c=>c.type===def.id).length,def.buyMax);let kept=0;
    layout.cells=layout.cells.filter(c=>c.type!==def.id||++kept<=allowance);}
  // Kho lính CHỈ đổi ở night-raid/collect.js. Trước đây chỗ này lấy
  // min(kho cũ, số client gửi) để chặn gian lận — nhưng từ khi cướp không
  // còn tiêu lính, không có lý do hợp lệ nào để lính giảm, mà một client
  // cũ (mở app trên máy khác, hoặc appState chưa kịp đồng bộ) vẫn có thể
  // kéo kho lính tụt xuống và nuốt mất mẻ vừa thu hoạch. Giữ nguyên số
  // trên máy chủ và bỏ qua số client gửi lên.
  //
  // Lần PUT ĐẦU TIÊN cũng vậy: mở ngoặc cho số client gửi ở đây chính là lỗ
  // hổng mà cái cap 10 lính cũ đang bịt. Một tài khoản chưa từng mở Cướp Đêm
  // PUT {soldiers: 1000000} là được lưu vĩnh viễn (normalizeLayout chỉ chặn ở
  // SOLDIER_SANITY_CAP = 1e6), và combatPower biến nó thành damage kịch trần
  // → thắng 3 sao mọi nhà không khiên. Nhà mới bắt đầu với 0 lính; muốn có
  // lính thì phải xây doanh trại và thu hoạch như mọi người.
  layout.soldiers=current?oldLayout.soldiers:0;
  // Dog level is monotonic: dogGrowthXP is never deducted anywhere in the
  // app, so a lower level from a client can only be stale or wrong.
  const storedDog=current?Math.max(1,Math.trunc(+current.dog_level||1)):1;
  const dogLevel=Math.max(storedDog,num(body.dogLevel)?Math.max(1,Math.min(999,Math.trunc(body.dogLevel))):1);
  const homeLevel=NR.homeLevel(layout,dogLevel);
  const skin=/^[a-z0-9-]{1,30}$/.test(String(body.castleSkin||''))?String(body.castleSkin)
    :(current?String(current.castle_skin||'stone-keep'):'stone-keep');
  const coins=num(body.coins)?Math.max(0,Math.min(100000,Math.trunc(body.coins)))
    :(current?Math.max(0,Math.trunc(+current.lootable_coins||0)):0);
  const vault=num(body.vaultCoins)?Math.max(0,Math.min(5000,Math.trunc(body.vaultCoins)))
    :(current?Math.max(0,Math.trunc(+current.vault_coins||0)):0);
  await env.DB.prepare(`INSERT INTO night_raid_homes(user_id,layout_json,dog_level,castle_skin,home_level,lootable_coins,vault_coins,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET layout_json=excluded.layout_json,dog_level=excluded.dog_level,castle_skin=excluded.castle_skin,home_level=excluded.home_level,lootable_coins=excluded.lootable_coins,vault_coins=excluded.vault_coins,updated_at=excluded.updated_at`)
    .bind(auth.uid,JSON.stringify(layout),dogLevel,skin,homeLevel,coins,vault,Date.now()).run();
  return json({ok:true,homeLevel,layout,coins,dayCount,ctx:clock.ctx});
}
