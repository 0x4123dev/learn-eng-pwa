import { requireAuth, json, err } from '../_lib.js';
import { MF, coinDelta, fightView, scoreAnswers, settleFight } from '../_math-fight.js';

// POST /api/math-fight/submit { fightId, answers: [values...], forfeit? }
// The last word from one side. Scored by exactly the same path as the pulse.
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
    // Quitting is stored as a dead pulse rather than a special case, so the
    // shared walk-away rule inside settleFight decides it — one rule, one place.
    const beat = body.forfeit ? 1 : now;
    const submittedAt = body.forfeit ? null : now;
    const cols = mine
      ? 'c_answers_json=?, c_correct=?, c_answered=?, c_submitted_at=?, c_beat_at=?'
      : 'o_answers_json=?, o_correct=?, o_answered=?, o_submitted_at=?, o_beat_at=?';
    await env.DB.prepare('UPDATE math_fights SET ' + cols + ' WHERE id=?')
      .bind(JSON.stringify(answers), marked.correct, marked.answered, submittedAt, beat, id).run();
    row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();

    const bothIn = !!(row.c_submitted_at && row.o_submitted_at);
    if (bothIn || body.forfeit || row.deadline_at <= now) row = await settleFight(env, row, now);
  }
  return json({ fight: fightView(row, auth.uid), coins: coinDelta(row, auth.uid) });
}
