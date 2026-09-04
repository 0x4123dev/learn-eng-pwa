import MathFightRules from '../../js/math-fight-rules.js';
import { MATH_FIGHT_BANK } from '../../js/math-fight-bank.js';

// Same shape as _night-raid.js: the shared browser rules re-exported so every
// endpoint reads one set of constants.
export const MF = MathFightRules;

// Score an answers array the ONLY way it is ever scored: rebuild the exact
// twenty questions from the seed and the rung, then compare. The client sends
// the values it chose and never a count, so the same code serves the 5-second
// heartbeat, the final submit and the reaper — one scoring path, no way in for
// a forged score.
export function scoreAnswers(seed, level, answers) {
  const qs = MF.fightQuestions(seed, level, MATH_FIGHT_BANK);
  const list = Array.isArray(answers) ? answers : [];
  let correct = 0, answered = 0;
  for (let i = 0; i < qs.length; i++) {
    const given = list[i];
    if (given === null || given === undefined || given === '') continue;
    answered++;
    if (Math.trunc(Number(given)) === qs[i].answer) correct++;
  }
  return { correct, answered };
}

// One switch for the whole app: off means nobody sees Đấu Toán, on means
// everybody does. The hidden menu card is only a courtesy — this is the
// enforcement, so a stale client cannot walk in before the switch is thrown.
export const MATH_FIGHT_FLAG = 'math_fight';
export async function mathFightEnabled(env) {
  const row = await env.DB.prepare('SELECT value FROM app_flags WHERE key = ?').bind(MATH_FIGHT_FLAG).first();
  return !!(row && row.value);
}

export function safeJson(value, fallback) {
  try { const p = JSON.parse(value); return p == null ? fallback : p; } catch (e) { return fallback; }
}

export function randomFightId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b).map(v => v.toString(16).padStart(2, '0')).join('');
}

// The one place a math_fight_pairs row (or the absence of one) is turned into
// the handicap state the rest of the server reads. Pulled out of pairState so
// the single-pair read and the list's set-based read cannot drift apart: a
// friend row that quietly lost its cooldown would let a pair fight twice in
// three days, which is the whole point of the table.
function pairStateOf(lo, hi, row) {
  return {
    lo, hi,
    leaderId: row && row.leader_id ? Math.trunc(row.leader_id) : null,
    streak: Math.max(0, Math.trunc(+(row && row.streak) || 0)),
    nextReadyAt: Math.max(0, Math.trunc(+(row && row.next_ready_at) || 0)),
  };
}

// A single id, the way both readers key their maps.
function uid(v) { return Math.trunc(Number(v) || 0); }

// The handicap state for one pair, or neutral ground when they have never met.
export async function pairState(env, aId, bId) {
  const { lo, hi } = MF.pairKey(aId, bId);
  const row = await env.DB.prepare(
    'SELECT leader_id, streak, next_ready_at FROM math_fight_pairs WHERE lo_id=? AND hi_id=?'
  ).bind(lo, hi).first();
  return pairStateOf(lo, hi, row);
}

// Every pair state between one child and a list of friends, in ONE query.
//
// The Đấu Toán list polls every 3 seconds for as long as the tab is open, and
// it used to call pairState once per friend: twenty friends meant forty D1
// round trips per poll per device. One child's row set is bounded by the
// friends they have ever fought, so a single read over their side of the
// table is both smaller and cheaper than the fan-out it replaces.
//
// Returns a Map keyed by friend id holding exactly what pairState would have
// returned for that friend — including the neutral, never-fought row.
export async function pairStatesFor(env, meId, friendIds) {
  const me = uid(meId);
  const out = new Map();
  for (const v of (friendIds || [])) {
    const id = uid(v);
    if (!id || out.has(id)) continue;
    const { lo, hi } = MF.pairKey(me, id);
    out.set(id, pairStateOf(lo, hi, null));
  }
  if (!out.size) return out;
  // Both halves are index lookups: lo_id leads the primary key and db/026
  // adds the hi_id index the other half needs.
  const rows = await env.DB.prepare(
    'SELECT lo_id, hi_id, leader_id, streak, next_ready_at FROM math_fight_pairs WHERE lo_id=? OR hi_id=?'
  ).bind(me, me).all();
  for (const row of (rows.results || [])) {
    const lo = uid(row.lo_id), hi = uid(row.hi_id);
    const other = lo === me ? hi : lo;
    // Rows left over from a friendship that has since been broken.
    if (!out.has(other)) continue;
    out.set(other, pairStateOf(lo, hi, row));
  }
  return out;
}

// Which of these children are already inside a fight — an unanswered invite or
// a live bout. The set-based twin of currentFight, for the list: same statuses,
// same meaning, one query instead of one per friend.
export async function busyIdsAmong(env, userIds) {
  const want = new Set();
  for (const v of (userIds || [])) { const id = uid(v); if (id) want.add(id); }
  const out = new Set();
  if (!want.size) return out;
  const ids = Array.from(want);
  const ph = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT challenger_id, opponent_id FROM math_fights
      WHERE status IN ('invited','active')
        AND (challenger_id IN (${ph}) OR opponent_id IN (${ph}))`
  ).bind(...ids, ...ids).all();
  for (const row of (rows.results || [])) {
    const c = uid(row.challenger_id), o = uid(row.opponent_id);
    if (want.has(c)) out.add(c);
    if (want.has(o)) out.add(o);
  }
  return out;
}

export async function savePairState(env, aId, bId, state, nextReadyAt) {
  const { lo, hi } = MF.pairKey(aId, bId);
  await env.DB.prepare(
    `INSERT INTO math_fight_pairs(lo_id,hi_id,leader_id,streak,next_ready_at,updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(lo_id,hi_id) DO UPDATE SET leader_id=excluded.leader_id,
       streak=excluded.streak, next_ready_at=excluded.next_ready_at,
       updated_at=excluded.updated_at`
  ).bind(lo, hi, state.leaderId, state.streak, nextReadyAt, Date.now()).run();
}

// Any fight this user is inside: an unanswered invite or a live bout.
export async function currentFight(env, userId) {
  return env.DB.prepare(
    `SELECT * FROM math_fights
      WHERE (challenger_id=? OR opponent_id=?) AND status IN ('invited','active')
      ORDER BY created_at DESC LIMIT 1`
  ).bind(userId, userId).first();
}

// Invites nobody answered expire; bouts whose five minutes ran out are settled
// on whatever each side had sent. Without this a closed tab would block both
// children out of the tab forever.
//
// This project has no cron and no scheduled worker, so the 3-second list poll
// is the ONLY clock Đấu Toán has — and the list it paints is wrong without it:
// an unreaped bout leaves its two players flagged `busy` for good, and the
// pair's 3-day cooldown does not start until the fight is settled. So it stays
// on the hot path, and db/026 is what makes it cheap: both statements below
// read a partial index covering only the handful of rows that are still
// invited or still active, instead of scanning a math_fights table that grows
// with every duel ever fought and is never pruned.
export async function reapStale(env) {
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE math_fights SET status='expired' WHERE status='invited' AND expires_at < ?"
  ).bind(now).run();
  const stale = await env.DB.prepare(
    "SELECT * FROM math_fights WHERE status='active' AND deadline_at < ?"
  ).bind(now).all();
  for (const row of (stale.results || [])) await settleFight(env, row, now);
}

// Decide a fight and write every consequence together: the result, the pair's
// next handicap and the 3-day cooldown. The status guard makes it idempotent —
// a second caller just re-reads the finished row.
export async function settleFight(env, row, now = Date.now()) {
  if (!row || row.status === 'done') return row;

  const cQuit = !row.c_submitted_at && MF.hasWalkedAway(row.c_beat_at, now);
  const oQuit = !row.o_submitted_at && MF.hasWalkedAway(row.o_beat_at, now);
  const started = row.started_at || now;
  const cMs = Math.min(MF.SECONDS * 1000, Math.max(0, (row.c_submitted_at || row.deadline_at || now) - started));
  const oMs = Math.min(MF.SECONDS * 1000, Math.max(0, (row.o_submitted_at || row.deadline_at || now) - started));

  const verdict = MF.adjudicate(
    { id: row.challenger_id, correct: row.c_correct || 0, ms: cMs, forfeit: cQuit },
    { id: row.opponent_id, correct: row.o_correct || 0, ms: oMs, forfeit: oQuit }
  );

  // CLAIM THE FIGHT FIRST. The status guard is what makes this idempotent, and
  // the pair's handicap used to be written BEFORE it — outside the guard. Two
  // settlers overlapping (both tickers hitting the deadline, the 5-second
  // pulse, or reapStale running on any other child's list poll) each read the
  // pair, each added one to the streak, and the second one's read landed after
  // the first one's write: one win advanced the ladder two rungs and handed
  // the loser a double handicap in the next fight.
  const claim = await env.DB.prepare(
    "UPDATE math_fights SET status='done', finished_at=?, winner_id=?, outcome=? WHERE id=? AND status='active'"
  ).bind(now, verdict.winnerId, verdict.outcome, row.id).run();

  if (Number(claim.meta && claim.meta.changes || 0) > 0) {
    const pair = await pairState(env, row.challenger_id, row.opponent_id);
    const next = MF.nextPairState(pair, verdict.winnerId);
    await savePairState(env, row.challenger_id, row.opponent_id, next, MF.cooldownUntil(now));
  }

  return env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(row.id).first();
}

// The coin move for one player, decided by the server and applied by that
// child's own device to its local wallet — the contract Night Raid already
// uses. A draw moves nothing, and a loser with an empty purse pays nothing:
// the balance the device reports is only ever used to make the loss smaller.
export function coinDelta(row, uid, balance) {
  if (!row || row.status !== 'done' || !row.winner_id) return 0;
  return MF.coinChange(row.winner_id === uid, balance);
}

// What one player is allowed to see. Deliberately thin: their own rung and
// nobody else's, no leader, no streak. The handicap is invisible by
// construction, not by remembering to hide it in each screen.
export function fightView(row, uid) {
  if (!row) return null;
  const mine = row.challenger_id === uid;
  return {
    fightId: row.id,
    status: row.status,
    prize: row.prize,
    seed: row.seed,
    level: mine ? row.challenger_level : row.opponent_level,
    // The round travels WITH the fight. It used to be derived on both sides
    // from the seed — correct only while the device and the server agree, and
    // a device running yesterday's app draws yesterday's round, answers it
    // perfectly and is marked against today's: every answer wrong, a final 0
    // beside a child who counted 17 right. A device cannot be marked against
    // questions it was never shown.
    questions: row.status === 'invited' ? null
      : MF.fightQuestions(row.seed, mine ? row.challenger_level : row.opponent_level, MATH_FIGHT_BANK),
    role: mine ? 'challenger' : 'opponent',
    foeId: mine ? row.opponent_id : row.challenger_id,
    startedAt: row.started_at || null,
    deadlineAt: row.deadline_at || null,
    expiresAt: row.expires_at || null,
    myCorrect: (mine ? row.c_correct : row.o_correct) || 0,
    myAnswered: (mine ? row.c_answered : row.o_answered) || 0,
    foeCorrect: (mine ? row.o_correct : row.c_correct) || 0,
    foeAnswered: (mine ? row.o_answered : row.c_answered) || 0,
    winnerId: row.winner_id || null,
    outcome: row.outcome || null,
  };
}
