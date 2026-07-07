import { requireAuth, json, err } from './_lib.js';

// POST /api/attempts — save one exam attempt for the authenticated user,
// then purge attempts older than 30 days (rolling retention).
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let a;
  try { a = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const examId = String(a.examId || a.exam_id || '').slice(0, 40);
  if (!examId) return err('Missing examId');
  const examTitle = String(a.examTitle || a.title || '').slice(0, 120);
  const score = Number.isFinite(+a.score) ? Math.max(0, Math.trunc(+a.score)) : 0;
  const total = Number.isFinite(+a.total) ? Math.max(0, Math.trunc(+a.total)) : 0;
  const timeSpent = Number.isFinite(+a.timeSpentSec) ? Math.max(0, Math.trunc(+a.timeSpentSec)) : null;
  const autoSubmitted = (a.autoSubmitted || a.auto_submitted) ? 1 : 0;
  let answersJson = null;
  try { if (a.answers) answersJson = JSON.stringify(a.answers).slice(0, 20000); } catch (e) {}

  const res = await env.DB.prepare(
    `INSERT INTO exam_attempts
       (user_id, exam_id, exam_title, score, total, time_spent_sec, auto_submitted, answers_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(auth.uid, examId, examTitle, score, total, timeSpent, autoSubmitted, answersJson).run();

  // Retention: keep only the last 30 days across all users.
  await env.DB.prepare(
    "DELETE FROM exam_attempts WHERE created_at < datetime('now','-30 days')"
  ).run();

  return json({ ok: true, id: res.meta.last_row_id });
}
