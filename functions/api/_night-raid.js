import NightRaidRules from '../../js/night-raid-rules.js';

export const NR = NightRaidRules;
export const RAID_TTL_MS = 5 * 60 * 1000;
// A breached home is sealed for 20 hours: nobody — not even the winner —
// can raid it again until the timer runs out. This used to expire at ICT
// midnight instead, so a home breached at 23:00 got one hour of peace while
// one breached at 00:30 got nearly a full day.
export const RAID_LOCK_MS = 20 * 3600 * 1000;

// When this home stops being sealed, or 0 when it is raidable right now.
export function raidLockUntil(row, now = Date.now()) {
  const until = Math.max(0, Math.trunc(+((row && row.ruined_until) || 0)));
  return until > now ? until : 0;
}

export function nightDate(now=Date.now()) {
  return new Date(now + 7 * 3600000).toISOString().slice(0,10);
}
export function safeJson(value, fallback) {
  try { const parsed=JSON.parse(value); return parsed==null?fallback:parsed; } catch(e) { return fallback; }
}
export function randomRaidId() {
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function nightRaidEnabled(env,userId) {
  const row=await env.DB.prepare('SELECT allow_bot FROM users WHERE id = ?').bind(userId).first();
  return !!(row&&row.allow_bot);
}
export async function ticketStats(env,userId,date=nightDate()) {
  const daily=await env.DB.prepare('SELECT tickets_used, reward_earned FROM night_raid_daily WHERE user_id = ? AND raid_date = ?').bind(userId,date).first();
  const learned=await env.DB.prepare("SELECT COALESCE(SUM(attempts),0) AS n FROM learning_skill_results WHERE user_id = ? AND created_at >= datetime(?, 'start of day')")
    .bind(userId,date).first();
  const allowance=3+(Number(learned&&learned.n||0)>=10?1:0);
  return {date,allowance,used:Number(daily&&daily.tickets_used||0),reward:Number(daily&&daily.reward_earned||0)};
}
export function homeSnapshot(row) {
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],dogLane:2}));
  const teammates=NR.normalizeTeammates(safeJson(row.teammates_json,[]));
  const dogLevel=Math.max(1,Math.min(999,Math.trunc(+row.dog_level||1)));
  const castleHp=180+Math.min(50,Math.max(1,+row.home_level||1))*8+teammates.filter(id=>id==='shield').length*25;
  const power=NR.combatPower(layout,dogLevel,teammates,layout.soldiers);
  return {targetId:row.user_id,name:row.username||'Castle',level:Math.max(1,+row.home_level||1),homeLevel:Math.max(1,+row.home_level||1),sceneId:['moonlit-village','haunted-forest','storm-kingdom'][Math.abs(Number(row.user_id)||0)%3],seed:1,layout,dogLevel,teammates,soldiers:layout.soldiers,castleSkin:String(row.castle_skin||'stone-keep'),castleHp,damage:power.damage,defense:power.defense,lootableCoins:Math.max(0,+row.lootable_coins||0),lockedUntil:raidLockUntil(row),budget:0};
}
export function resultReward(sim,snapshot,dailyReward) {
  if(!sim.won)return 0;
  const loot=Math.floor(Math.max(0,+snapshot.lootableCoins||0)*.10);
  const performance=10+(sim.margin>=25?10:0);
  const desired=Math.max(50,loot+performance);
  return Math.max(0,Math.min(200-Math.max(0,dailyReward||0),desired));
}
