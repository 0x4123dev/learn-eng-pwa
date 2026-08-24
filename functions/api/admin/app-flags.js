import { requireAuth, json, err } from '../_lib.js';

// App-wide feature switches, thrown once for everybody from the admin
// dashboard. Not per-user: Đấu Toán needs two children to work at all, so a
// per-child switch would mostly produce friend lists where nobody can be
// challenged. One switch, one answer — off means nobody sees the tab.
//
// Only names on this list can be written. A free-form key/value endpoint would
// let a mistyped flag sit in the table forever looking like it did something.
const FLAGS = ['math_fight'];

async function readFlags(env) {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM app_flags WHERE key IN (${FLAGS.map(() => '?').join(',')})`
  ).bind(...FLAGS).all();
  const found = new Map((rows.results || []).map(r => [r.key, !!r.value]));
  const out = {};
  for (const key of FLAGS) out[key] = found.get(key) || false;
  return out;
}

// GET /api/admin/app-flags → { flags: { math_fight: bool } }
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);
  return json({ flags: await readFlags(env) });
}

// POST /api/admin/app-flags { key, value } → flips one switch for everyone.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const key = String(body.key || '');
  if (FLAGS.indexOf(key) === -1) return err('Unknown flag');
  const value = body.value ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO app_flags(key, value, updated_at, updated_by) VALUES(?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,
       updated_at=excluded.updated_at, updated_by=excluded.updated_by`
  ).bind(key, value, Date.now(), auth.uid).run();

  return json({ ok: true, flags: await readFlags(env) });
}
