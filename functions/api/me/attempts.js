import { requireAuth, json, err } from '../_lib.js';

// GET /api/me/attempts — the authenticated user's own exam attempts (newest first).
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const { results } = await env.DB.prepare(
    `SELECT id, exam_id, exam_title, score, total, time_spent_sec, auto_submitted, created_at
       FROM exam_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`
  ).bind(auth.uid).all();

  return json({ attempts: results || [] });
}
