// Math Fight rules — deterministic and renderer-free.
//
// The same seed, the same rungs and the same answers always produce the same
// score and the same winner, so the Cloudflare Worker can import this file and
// re-decide any fight without trusting a word the client said. Keep DOM,
// canvas, network and wall-clock decisions out of it.
//
// The centrepiece is the handicap, and it is SILENT by design: a child who
// loses three times in a row stops playing, so the winner is quietly pushed up
// the difficulty ladder while the loser stays on the shared base rung. Neither
// child is ever told, which is why the arithmetic lives here under test rather
// than anywhere a screen could hint at it.
var MathFightRules = (() => {
  'use strict';

  const QUESTIONS = 20;
  const SECONDS = 300;                       // 5 phút — the Math Wars clock
  // Nobody picks a stake. Winning pays a flat prize and losing costs the same,
  // floored at what the loser actually owns — a child with an empty purse can
  // still play, and still cannot go negative.
  const PRIZE = 200;
  const INVITE_TTL_MS = 60 * 1000;           // 60s to accept a challenge
  const HEARTBEAT_MS = 5 * 1000;             // client pulse while fighting
  const FORFEIT_MS = 20 * 1000;              // silence this long = walked away
  const COOLDOWN_MS = 3 * 24 * 3600 * 1000;  // one fight per pair per 3 days
  const HANDICAP_STEP = 2;                   // rungs added per straight win
  const STREAK_MAX = 4;                      // so the handicap tops out at +8

  // The wars ladder tops out at 99 (level 8). A fight needs headroom above it,
  // or two children who both reached the top could never be handicapped.
  const WARS_LEVEL_BASE = 20, WARS_LEVEL_STEP = 10;
  const WARS_TOP_LEVEL = 8;
  const FIGHT_MAX = 199;
  const FIGHT_LEVELS = 19;                   // levels 0..18 → 19..199

  const int = (n, lo, hi) => {
    const v = Math.trunc(Number(n));
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
  };

  function fightLevelMax(level) {
    const L = int(level, 0, FIGHT_LEVELS - 1);
    return Math.min(FIGHT_MAX, WARS_LEVEL_BASE + WARS_LEVEL_STEP * L - 1);
  }

  // Every fight answer has at least two digits. The device draws the round to
  // show it and the server draws the same round to mark it, so this has to be
  // ONE function: two call sites with their own arguments drifted apart would
  // mark a child wrong for a right answer. The generator comes from Math Wars,
  // reached as a global on the device and injected on the server.
  const FIGHT_MIN_ANSWER = 10;
  function fightQuestions(seed, level, gen) {
    const build = gen || (typeof warsQuestions === 'function' ? warsQuestions : null);
    if (!build) return [];
    return build(QUESTIONS, makeRng(seed), fightLevelMax(level), { minAnswer: FIGHT_MIN_ANSWER });
  }

  // What this player's wallet actually moves by. The winner always collects
  // the full prize; the loser pays what they can and never goes below zero.
  function coinChange(isWinner, balance) {
    if (isWinner) return PRIZE;
    return -Math.min(PRIZE, Math.max(0, Math.trunc(Number(balance) || 0)));
  }

  // One pair, one row: the key is the sorted id pair, so a fight started from
  // either side reads and writes the same handicap state.
  function pairKey(a, b) {
    const x = Math.trunc(Number(a) || 0), y = Math.trunc(Number(b) || 0);
    return x < y ? { lo: x, hi: y } : { lo: y, hi: x };
  }

  // mulberry32 — the same generator battlecalc.js and night-raid-rules.js use.
  function makeRng(seed) {
    let a = (Math.trunc(Number(seed)) || 1) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The shared rung both children play from: the higher of the two wars
  // ladders, so a fight is always one table of sums, never two.
  function baseLevel(levelA, levelB) {
    return Math.max(int(levelA, 0, WARS_TOP_LEVEL), int(levelB, 0, WARS_TOP_LEVEL));
  }

  // Difficulty for one fight. The child on a winning streak climbs; the other
  // stays on the base rung and is never pushed below their own level — losing
  // must never mean being handed sums that teach them nothing.
  function levelsFor(state, base, aId, bId) {
    const b0 = int(base, 0, WARS_TOP_LEVEL);
    const leader = state && state.leaderId ? Math.trunc(state.leaderId) : null;
    const streak = int(state && state.streak, 0, STREAK_MAX);
    const bumped = Math.min(FIGHT_LEVELS - 1, b0 + HANDICAP_STEP * streak);
    return {
      a: leader === Math.trunc(aId) ? bumped : b0,
      b: leader === Math.trunc(bId) ? bumped : b0,
    };
  }

  // After a result: the winner climbs, an upset flattens the pair back to
  // equal ground, and a draw leaves the ladder exactly where it was.
  function nextPairState(state, winnerId) {
    const leader = state && state.leaderId ? Math.trunc(state.leaderId) : null;
    const streak = int(state && state.streak, 0, STREAK_MAX);
    if (!winnerId) return { leaderId: leader, streak };
    const w = Math.trunc(winnerId);
    if (leader === null) return { leaderId: w, streak: 1 };
    if (leader === w) return { leaderId: w, streak: Math.min(STREAK_MAX, streak + 1) };
    return { leaderId: null, streak: 0 };
  }

  // Order matters: walking away outranks the scoreboard, then correct answers,
  // then the clock. Anything left over is an honest draw.
  function adjudicate(a, b) {
    if (a.forfeit && b.forfeit) return { winnerId: null, outcome: 'draw' };
    if (a.forfeit) return { winnerId: Math.trunc(b.id), outcome: 'forfeit' };
    if (b.forfeit) return { winnerId: Math.trunc(a.id), outcome: 'forfeit' };
    const ca = int(a.correct, 0, QUESTIONS), cb = int(b.correct, 0, QUESTIONS);
    if (ca !== cb) return { winnerId: Math.trunc(ca > cb ? a.id : b.id), outcome: 'win' };
    const ma = int(a.ms, 0, SECONDS * 1000), mb = int(b.ms, 0, SECONDS * 1000);
    if (ma !== mb) return { winnerId: Math.trunc(ma < mb ? a.id : b.id), outcome: 'win' };
    return { winnerId: null, outcome: 'draw' };
  }

  function cooldownUntil(finishedAt) {
    return Math.trunc(Number(finishedAt) || 0) + COOLDOWN_MS;
  }
  // A player who has never pulsed has not walked away — they simply have not
  // started yet, and the invite/deadline clocks cover that case instead.
  function hasWalkedAway(lastBeatAt, now) {
    const beat = Math.trunc(Number(lastBeatAt) || 0);
    if (!beat) return false;
    return (Math.trunc(Number(now) || 0) - beat) > FORFEIT_MS;
  }

  return Object.freeze({
    QUESTIONS, SECONDS, PRIZE, INVITE_TTL_MS,
    HEARTBEAT_MS, FORFEIT_MS, COOLDOWN_MS, HANDICAP_STEP, STREAK_MAX,
    WARS_TOP_LEVEL, FIGHT_MAX, FIGHT_LEVELS,
    fightLevelMax, FIGHT_MIN_ANSWER, fightQuestions, coinChange, pairKey, makeRng,
    baseLevel, levelsFor, nextPairState, adjudicate, cooldownUntil, hasWalkedAway,
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MathFightRules;
