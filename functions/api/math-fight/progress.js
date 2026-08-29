import { requireAuth, json, err } from '../_lib.js';
import { MF, fightView, scoreAnswers, settleFight } from '../_math-fight.js';

// POST /api/math-fight/progress { fightId, answers: [values...] }
// The 5-second pulse. It carries the answers so far — never a score — so even
// the running scoreboard the opponent sees is one the server computed, and a
// child whose network dies at question 19 still keeps those 19.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  let body; try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const id = String(body.fightId || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return err('Invalid fight id');
  let row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
  if (!row) return err('Không tìm thấy trận', 404);
  const mine = row.challenger_id === auth.uid;
  if (!mine && row.opponent_id !== auth.uid) return err('Forbidden', 403);

  const now = Date.now();
  if (row.status === 'active') {
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, MF.QUESTIONS) : [];
    const level = mine ? row.challenger_level : row.opponent_level;
    const marked = scoreAnswers(row.seed, level, answers);
    const submitted = mine ? row.c_submitted_at : row.o_submitted_at;
    const wasAnswered = Number(mine ? row.c_answered : row.o_answered) || 0;
    // A finished side keeps the score it submitted. The child who finishes
    // FIRST goes on pulsing while waiting for the other one, and this endpoint
    // used to rewrite the score from whatever array that pulse carried — so a
    // re-opened screen, whose answer array starts empty again, turned 20/20
    // into 0 and handed away a won match (reported 2026-08-29).
    //
    // Answers also only ever accumulate, so a pulse that arrives late and
    // emptier than one already counted cannot undo it. Either way the beat
    // still lands: it is what tells a thinking child from a departed one.
    const keepScore = !!submitted || marked.answered < wasAnswered;
    const cols = keepScore
      ? (mine ? 'c_beat_at=?' : 'o_beat_at=?')
      : (mine ? 'c_answers_json=?, c_correct=?, c_answered=?, c_beat_at=?'
              : 'o_answers_json=?, o_correct=?, o_answered=?, o_beat_at=?');
    const args = keepScore
      ? [now, id]
      : [JSON.stringify(answers), marked.correct, marked.answered, now, id];
    await env.DB.prepare('UPDATE math_fights SET ' + cols + ' WHERE id=?').bind(...args).run();
    row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
    // Time is up, or the other side went quiet: settle now rather than leaving
    // this child staring at a clock that already ran out.
    if (row.deadline_at <= now || MF.hasWalkedAway(mine ? row.o_beat_at : row.c_beat_at, now)) {
      row = await settleFight(env, row, now);
    }
  }
  return json({ fight: fightView(row, auth.uid) });
}
