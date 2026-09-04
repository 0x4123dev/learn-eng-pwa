import { requireAuth, json, err } from './_lib.js';

const MENUS = [
  'math7', 'math4', 'mathwars', 'grade4', 'wordform',
  'grammar', 'phrases', 'verbs', 'rewrite', 'collocation',
];
const MAX_BATCH = 400;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function sqlTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function boundedInt(value, max = 1000) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.trunc(n))) : 0;
}

function clean(item) {
  const menu = String(item && item.menu || '').toLowerCase();
  const sessionId = String(item && item.sessionId || '').slice(0, 100);
  const skillKey = String(item && item.skillKey || '').toLowerCase().slice(0, 120);
  const skillLabel = String(item && item.skillLabel || '').trim().slice(0, 120);
  if (!MENUS.includes(menu)) return null;
  if (!/^[a-z0-9._:-]{3,120}$/.test(skillKey)) return null;
  if (!/^[A-Za-z0-9._:-]{3,100}$/.test(sessionId) || !skillLabel) return null;

  const attempts = boundedInt(item.attempts);
  const correct = Math.min(attempts, boundedInt(item.correct));
  const wrong = Math.min(attempts - correct, boundedInt(item.wrong));
  const skipped = Math.min(attempts - correct - wrong, boundedInt(item.skipped));
  if (!attempts) return null;

  const refs = Array.isArray(item.wrongRefs)
    ? item.wrongRefs.slice(0, 20).map(v => String(v).slice(0, 120))
    : [];
  let at = Number(item.at);
  if (!Number.isFinite(at) || at < Date.now() - MAX_AGE_MS || at > Date.now() + 60000) at = Date.now();

  return {
    menu, sessionId, skillKey, skillLabel, attempts, correct, wrong, skipped,
    durationMs: boundedInt(item.durationMs, 24 * 60 * 60 * 1000),
    wrongRefsJson: refs.length ? JSON.stringify(refs) : null,
    createdAt: sqlTime(at),
  };
}

// POST /api/skills { items: [...] }
// Best-effort background sync from the learning screens. No user-facing flow
// depends on this endpoint, and repeated offline uploads are harmless.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const source = Array.isArray(body.items) ? body.items : [body];
  const rows = source.slice(0, MAX_BATCH).map(clean).filter(Boolean);
  if (!rows.length) return json({ ok: true, count: 0 });

  const statements = rows.map(r => env.DB.prepare(
    `INSERT OR IGNORE INTO learning_skill_results
       (user_id, client_session_id, menu, skill_key, skill_label,
        attempts, correct, wrong, skipped, duration_ms, wrong_refs_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    auth.uid, r.sessionId, r.menu, r.skillKey, r.skillLabel,
    r.attempts, r.correct, r.wrong, r.skipped, r.durationMs,
    r.wrongRefsJson, r.createdAt
  ));
  await env.DB.batch(statements);
  return json({ ok: true, count: rows.length });
}
