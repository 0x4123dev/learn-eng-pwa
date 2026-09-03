import { requireAuth, json, err } from '../_lib.js';
import { nightDate, nightRaidEnabled, ticketStats, homeSnapshot, raidLockUntil } from '../_night-raid.js';

// GET /api/night-raid/friends — "Bạn bè · khi nào cướp được".
//
// The child's ACCEPTED friends who own a Night Raid home, each answering one
// question: when would start.js let a raid on that home through? That is
// `availableAt` (0 = right now), the larger of
//   - the 24 h seal after the home was actually robbed (ruined_until), and
//   - the next ICT midnight when this child already visited it today
//     (start.js refuses a second visit per pair per day with a 409).
// `canRaidNow` is just `availableAt === 0`, so the client never re-derives it.
//
// Timing + name + level ONLY. targets.js already strips spike traps and hides
// DEF from the target cards; this list goes further and sends no layout, no
// power numbers and — because a shield clock is owner-only (home.js) — only a
// boolean `shielded` for other people, never their shield_until.

const SEVEN_HOURS = 7 * 3600000;

// Same rule as targets.js, so a friend's chip and a random target's card agree.
export function difficultyLabel(theirLevel, myLevel) {
  return theirLevel > myLevel + 2 ? 'Khó' : theirLevel < myLevel - 2 ? 'Dễ' : 'Cân bằng';
}

// The first millisecond of tomorrow's Night Raid day (ICT midnight), which is
// when nightDate() rolls and a fresh visit to the same home is allowed again.
export function nextNightStart(now = Date.now()) {
  const d = new Date(now + SEVEN_HOURS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - SEVEN_HOURS;
}

// When start.js would accept a raid on this home row; 0 = right now.
export function raidAvailableAt(row, visitedToday, now = Date.now()) {
  const sealed = raidLockUntil(row, now);
  const nextVisit = visitedToday ? nextNightStart(now) : 0;
  return Math.max(sealed, nextVisit);
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (!(await nightRaidEnabled(env, auth.uid))) return err('Night Raid Phase 2 is not enabled', 403);

  const now = Date.now(), date = nightDate(now);
  const mine = await env.DB.prepare('SELECT home_level, ruined_until, shield_until FROM night_raid_homes WHERE user_id=?')
    .bind(auth.uid).first();
  const myLevel = Math.max(1, +(mine && mine.home_level) || 1);

  // One row per accepted friend WITH a home. The friendship may point either
  // way, so the "other" side is picked per row; disabled accounts vanish the
  // same way they do from GET /api/friends.
  const rows = await env.DB.prepare(
    `SELECT h.*, u.username,
            EXISTS(SELECT 1 FROM night_raids r
                    WHERE r.attacker_id = ? AND r.defender_id = h.user_id AND r.created_date = ?) AS visited_today
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       JOIN night_raid_homes h ON h.user_id = u.id
      WHERE f.status = 'accepted'
        AND (f.requester_id = ? OR f.addressee_id = ?)
        AND u.disabled = 0`
  ).bind(auth.uid, date, auth.uid, auth.uid, auth.uid).all();

  const friends = (rows.results || []).map(row => {
    // homeSnapshot is the one place a home row becomes numbers (level, seal);
    // only the harmless ones are copied out of it.
    const snap = homeSnapshot(row);
    const visitedToday = !!Number(row.visited_today);
    const availableAt = raidAvailableAt(row, visitedToday, now);
    return {
      targetId: row.user_id,
      name: row.username,
      homeLevel: snap.homeLevel,
      level: snap.level,
      difficulty: difficultyLabel(snap.homeLevel, myLevel),
      lockedUntil: raidLockUntil(row, now),
      visitedToday,
      availableAt,
      canRaidNow: availableAt === 0,
      shielded: (+row.shield_until || 0) > now,
    };
  });
  // Raidable first, then whoever opens up soonest, then by name so the order
  // is stable between refreshes.
  friends.sort((a, b) => (a.availableAt - b.availableAt) || String(a.name).localeCompare(String(b.name), 'vi'));

  const stats = await ticketStats(env, auth.uid, date);
  return json({
    friends,
    me: {
      hasHome: !!mine,
      homeLevel: myLevel,
      lockedUntil: mine ? raidLockUntil(mine, now) : 0,
      shieldUntil: Math.max(0, Math.trunc(+(mine && mine.shield_until) || 0)),
    },
    ticketsLeft: Math.max(0, stats.allowance - stats.used),
    learningBoost: stats.allowance > 3,
  });
}
