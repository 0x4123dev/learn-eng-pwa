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
    const cols = mine
      ? 'c_answers_json=?, c_correct=?, c_answered=?, c_beat_at=?'
      : 'o_answers_json=?, o_correct=?, o_answered=?, o_beat_at=?';
    await env.DB.prepare('UPDATE math_fights SET ' + cols + ' WHERE id=?')
      .bind(JSON.stringify(answers), marked.correct, marked.answered, now, id).run();
    row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
    // Time is up, or the other side went quiet: settle now rather than leaving
    // this child staring at a clock that already ran out.
    if (row.deadline_at <= now || MF.hasWalkedAway(mine ? row.o_beat_at : row.c_beat_at, now)) {
      row = await settleFight(env, row, now);
    }
  }
  return json({ fight: fightView(row, auth.uid) });
}
