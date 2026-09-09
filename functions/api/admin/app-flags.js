import { requireAuth, json, err } from '../_lib.js';

// App-wide feature switches, thrown once for everybody from the admin
// dashboard. Not per-user: Đấu Toán needs two children to work at all, so a
// per-child switch would mostly produce friend lists where nobody can be
// challenged. One switch, one answer — off means nobody sees the tab.
//
// Only names on this list can be written. A free-form key/value endpoint would
// let a mistyped flag sit in the table forever looking like it did something.
const FLAGS = ['math_fight'];

// Numbers, not switches. Same table, same "one value for the whole app" rule,
// but a bool cannot say how long a round is. Each carries the range it is
// allowed to hold and the value it falls back to, because the endpoint is the
// only thing standing between a typo in an admin's text box and every child
// getting a one-second round.
const SETTINGS = {
  // Bảng cửu chương: one clock for all six drills. Ten questions, so 60s is
  // six seconds a question. The floor is a round that is still winnable and
  // the ceiling is one that is still a race.
  cuuchuong_seconds: { min: 15, max: 180, fallback: 60 },
};
const SETTING_KEYS = Object.keys(SETTINGS);

function clampSetting(key, raw) {
  const spec = SETTINGS[key];
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return spec.fallback;
  return Math.max(spec.min, Math.min(spec.max, n));
}

async function readFlags(env) {
  const keys = FLAGS.concat(SETTING_KEYS);
  const rows = await env.DB.prepare(
    `SELECT key, value FROM app_flags WHERE key IN (${keys.map(() => '?').join(',')})`
  ).bind(...keys).all();
  const found = new Map((rows.results || []).map(r => [r.key, r.value]));
  const flags = {};
  for (const key of FLAGS) flags[key] = !!found.get(key);
  const settings = {};
  // A row that is missing, or that predates a narrowed range, still has to
  // answer with something a round can be run on — never null, never 0.
  for (const key of SETTING_KEYS) {
    settings[key] = found.has(key) ? clampSetting(key, found.get(key)) : SETTINGS[key].fallback;
  }
  return { flags, settings };
}

// GET /api/admin/app-flags
//   → { flags: { math_fight: bool }, settings: { cuuchuong_seconds: int } }
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);
  return json(await readFlags(env));
}

// POST /api/admin/app-flags { key, value } → flips one switch for everyone.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const key = String(body.key || '');
  const isSetting = SETTING_KEYS.indexOf(key) !== -1;
  if (!isSetting && FLAGS.indexOf(key) === -1) return err('Unknown flag');
  // A switch stores 0/1; a setting stores its clamped number. Clamping here
  // rather than trusting the form means a hand-rolled POST cannot hand a child
  // a zero-second round either.
  const value = isSetting ? clampSetting(key, body.value) : (body.value ? 1 : 0);

  await env.DB.prepare(
    `INSERT INTO app_flags(key, value, updated_at, updated_by) VALUES(?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,
       updated_at=excluded.updated_at, updated_by=excluded.updated_by`
  ).bind(key, value, Date.now(), auth.uid).run();

  return json(Object.assign({ ok: true }, await readFlags(env)));
}
