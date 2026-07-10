import { requireAuth, json, err } from './_lib.js';

const TYPES = ['lesson', 'review', 'grammar', 'phrases', 'verbs', 'battle'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Convert a JS ms timestamp to D1's 'YYYY-MM-DD HH:MM:SS' (UTC).
function sqlTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}
function clean(a) {
  const type = String(a.type || '').toLowerCase();
  if (!TYPES.includes(type)) return null;
  const title = String(a.title || '').slice(0, 120);
  const score = Number.isFinite(+a.score) ? Math.max(0, Math.trunc(+a.score)) : null;
  const total = Number.isFinite(+a.total) ? Math.max(0, Math.trunc(+a.total)) : null;
  let detailJson = null;
  try { if (a.detail) detailJson = JSON.stringify(a.detail).slice(0, 4000); } catch (e) {}
  return { type, title, score, total, detailJson, at: a.at };
}

// POST /api/activity
//   single: { type, title, score, total, detail }
//   batch (backfill): { items: [ { ...activity, at: <ms> }, ... ] }  (only items
//   within the last 30 days are kept; others would be purged anyway).
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const cutoff = Date.now() - THIRTY_DAYS_MS;

  if (Array.isArray(body.items)) {
    const rows = body.items.slice(0, 500).map(clean).filter(Boolean)
      .filter(r => !(Number.isFinite(+r.at) && +r.at < cutoff)); // drop >30d-old
    if (rows.length) {
      const stmts = rows.map(r => {
        const at = Number.isFinite(+r.at) ? sqlTime(+r.at) : sqlTime(Date.now());
        // OR IGNORE + the unique (user_id, type, created_at) index makes re-syncs idempotent.
        return env.DB.prepare(
          `INSERT OR IGNORE INTO activities (user_id, type, title, score, total, detail_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(auth.uid, r.type, r.title, r.score, r.total, r.detailJson, at);
      });
      await env.DB.batch(stmts);
    }
    await env.DB.prepare("DELETE FROM activities WHERE created_at < datetime('now','-30 days')").run();
    return json({ ok: true, count: rows.length });
  }

  const r = clean(body);
  if (!r) return err('Invalid activity type');
  const res = await env.DB.prepare(
    `INSERT INTO activities (user_id, type, title, score, total, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(auth.uid, r.type, r.title, r.score, r.total, r.detailJson).run();
  await env.DB.prepare("DELETE FROM activities WHERE created_at < datetime('now','-30 days')").run();
  return json({ ok: true, id: res.meta.last_row_id });
}
