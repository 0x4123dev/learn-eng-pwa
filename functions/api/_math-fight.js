import MathFightRules from '../../js/math-fight-rules.js';
import wars from '../../js/mathwars.js';

// Same shape as _night-raid.js: the shared browser rules re-exported so every
// endpoint reads one set of constants.
export const MF = MathFightRules;

// Score an answers array the ONLY way it is ever scored: rebuild the exact
// twenty questions from the seed and the rung, then compare. The client sends
// the values it chose and never a count, so the same code serves the 5-second
// heartbeat, the final submit and the reaper — one scoring path, no way in for
// a forged score.
export function scoreAnswers(seed, level, answers) {
  const qs = wars.warsQuestions(MF.QUESTIONS, MF.makeRng(seed), MF.fightLevelMax(level));
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

// The handicap state for one pair, or neutral ground when they have never met.
export async function pairState(env, aId, bId) {
  const { lo, hi } = MF.pairKey(aId, bId);
  const row = await env.DB.prepare(
    'SELECT leader_id, streak, next_ready_at FROM math_fight_pairs WHERE lo_id=? AND hi_id=?'
  ).bind(lo, hi).first();
  return {
    lo, hi,
    leaderId: row && row.leader_id ? Math.trunc(row.leader_id) : null,
    streak: Math.max(0, Math.trunc(+(row && row.streak) || 0)),
    nextReadyAt: Math.max(0, Math.trunc(+(row && row.next_ready_at) || 0)),
  };
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

  const pair = await pairState(env, row.challenger_id, row.opponent_id);
  const next = MF.nextPairState(pair, verdict.winnerId);
  await savePairState(env, row.challenger_id, row.opponent_id, next, MF.cooldownUntil(now));

  await env.DB.prepare(
    "UPDATE math_fights SET status='done', finished_at=?, winner_id=?, outcome=? WHERE id=? AND status='active'"
  ).bind(now, verdict.winnerId, verdict.outcome, row.id).run();

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
