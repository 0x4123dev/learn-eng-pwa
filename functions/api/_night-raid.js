import NightRaidRules from '../../js/night-raid-rules.js';

// Shared helpers for the home + farm routes (functions/api/night-raid/
// home.js, plant.js, collect.js). The raiding routes — start, finish,
// targets, friends, reports, shield — and their config, lock, ticket and
// reward helpers were cut with the Arena in September 2026; the table names
// and API paths keep the old "night-raid" name so nothing stored moves.
export const NR = NightRaidRules;

export function nightDate(now=Date.now()) {
  return new Date(now + 7 * 3600000).toISOString().slice(0,10);
}
export function safeJson(value, fallback) {
  try { const parsed=JSON.parse(value); return parsed==null?fallback:parsed; } catch(e) { return fallback; }
}
// Every barracks on one account shares one training clock. It lives privately
// inside layout_json: normalizeLayout deliberately drops this key, so a client
// cannot rewind it. The old per-barracks ledger is read once as a rollout
// bridge; its first entry is the original barracks and becomes the shared clock.
const BARRACKS_TRAINING_KEY='__barracksTraining',OLD_BARRACKS_LEDGER_KEY='__barracksLedger';
export function barracksTraining(raw,layout) {
  const saved=raw&&raw[BARRACKS_TRAINING_KEY],oldLedger=Array.isArray(raw&&raw[OLD_BARRACKS_LEDGER_KEY])?raw[OLD_BARRACKS_LEDGER_KEY]:[];
  const cells=NR.farmRules.allCells(layout||{}).filter(cell=>NR.itemById(cell.type)?.producer==='soldier');
  const source=saved&&Number.isFinite(+saved.lastDay)&&Number.isFinite(+saved.soldierCycles)?saved:(oldLedger[0]||cells[0]);
  if(!source)return null;
  return {lastDay:Math.max(0,Math.trunc(+source.lastDay||0)),soldierCycles:Math.max(0,Math.trunc(+source.soldierCycles||0))};
}
export function applyBarracksTraining(layout,training) {
  if(!training)return layout;
  for(const cell of NR.farmRules.allCells(layout||{}))if(NR.itemById(cell.type)?.producer==='soldier'){
    cell.lastDay=training.lastDay;cell.soldierCycles=training.soldierCycles;delete cell.readyAt;
  }
  return layout;
}
export function withBarracksTraining(layout,training) {
  const stored=Object.assign({},layout);
  if(training)stored[BARRACKS_TRAINING_KEY]={lastDay:Math.max(0,Math.trunc(+training.lastDay||0)),soldierCycles:Math.max(0,Math.trunc(+training.soldierCycles||0))};
  return stored;
}
export async function nightRaidEnabled(env,userId) {
  // The farm is a normal part of the game for every authenticated child.
  // Keep this helper so every route asks the same question, but never tie
  // access to users.allow_bot again: that field is reserved for QA-only event
  // behaviour and must not hide the castle or the farm.
  void env; void userId;
  return true;
}
// Every child owns at least a level-1 castle. Older accounts may never have
// opened the builder, so the home row is created on demand.
export async function ensureNightRaidHome(env,userId,now=Date.now()) {
  await env.DB.prepare(`INSERT OR IGNORE INTO night_raid_homes
    (user_id,layout_json,dog_level,castle_skin,home_level,lootable_coins,vault_coins,updated_at)
    SELECT id,'{"cells":[],"dogLane":2}',1,'stone-keep',1,0,0,?
      FROM users WHERE id=? AND disabled=0`).bind(now,userId).run();
}
// The owner's own home, as GET /api/night-raid/home returns it.
// `lootableCoins` is the wallet MIRROR (see home.js PUT): the client adopts
// it exactly once, on a device that has never pushed this profile's wallet.
export function homeSnapshot(row) {
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],dogLane:2}));
  const dogLevel=Math.max(1,Math.min(999,Math.trunc(+row.dog_level||1)));
  return {targetId:row.user_id,name:row.username||'Castle',level:Math.max(1,+row.home_level||1),homeLevel:Math.max(1,+row.home_level||1),layout,dogLevel,soldiers:layout.soldiers,castleSkin:String(row.castle_skin||'stone-keep'),lootableCoins:Math.max(0,+row.lootable_coins||0)};
}
