import { requireAuth, json, err } from './_lib.js';

const TYPES = ['lesson', 'review', 'grammar', 'phrases', 'verbs', 'battle'];

// POST /api/activity — log one non-exam learning activity for the authed user,
// then purge activities older than 30 days (rolling retention).
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let a;
  try { a = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const type = String(a.type || '').toLowerCase();
  if (!TYPES.includes(type)) return err('Invalid activity type');
  const title = String(a.title || '').slice(0, 120);
  const score = Number.isFinite(+a.score) ? Math.max(0, Math.trunc(+a.score)) : null;
  const total = Number.isFinite(+a.total) ? Math.max(0, Math.trunc(+a.total)) : null;
  let detailJson = null;
  try { if (a.detail) detailJson = JSON.stringify(a.detail).slice(0, 4000); } catch (e) {}

  const res = await env.DB.prepare(
    `INSERT INTO activities (user_id, type, title, score, total, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(auth.uid, type, title, score, total, detailJson).run();

  await env.DB.prepare(
    "DELETE FROM activities WHERE created_at < datetime('now','-30 days')"
  ).run();

  return json({ ok: true, id: res.meta.last_row_id });
}
