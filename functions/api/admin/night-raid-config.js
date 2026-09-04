import { requireAuth, json, err } from '../_lib.js';
import { RAID_CONFIG_DEFAULTS, RAID_CONFIG_RANGE, readRaidConfig } from '../_night-raid.js';

// The Cướp Đêm rulebook, editable from the admin dashboard.
//
//   GET  /api/admin/night-raid-config → { config, defaults }
//   POST /api/admin/night-raid-config { key, value } → { ok, config }
//
// Defaults, ranges and the read path all live in functions/api/_night-raid.js
// and are IMPORTED, never copied: the game reads its rules from exactly the
// object this screen writes to, so the two can never drift into a dashboard
// that shows a number the raid no longer plays by.
//
// Only names in RAID_CONFIG_DEFAULTS may be written (same discipline as
// admin/app-flags.js). A free-form key/value endpoint would let `win_pct_`
// sit in the table forever looking like it did something.

// A value the admin typed → an integer, or a sentence explaining the refusal.
// Deliberately NOT clamped: readRaidConfig() clamps on the way out so a bad
// row can never break the game, but silently storing 500 as 100 would leave
// the admin looking at a number the game is not playing by. Refuse instead.
function parseValue(key, raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return { error: 'Giá trị phải là số' };
  const text = String(raw).trim();
  if (!text) return { error: 'Giá trị phải là số' };
  const n = Number(text);
  if (!Number.isInteger(n)) return { error: 'Giá trị phải là số nguyên (không có phần thập phân)' };
  const [min, max] = RAID_CONFIG_RANGE[key];
  if (n < min || n > max) return { error: key + ' phải từ ' + min + ' đến ' + max };
  return { value: n };
}

// The table ships one deploy ahead of db/021 (see the migration's header), so
// a GET must answer with the defaults rather than a 500 while it is missing.
// readRaidConfig() already handles that; this catch is the second net, for the
// database that is broken in some way nobody predicted — the admin screen
// showing the defaults it cannot change beats a dashboard that will not load.
async function currentConfig(env) {
  try {
    return await readRaidConfig(env);
  } catch (e) {
    console.warn('night-raid-config: read failed (' + (e && e.message) + '), serving defaults');
    return Object.assign({}, RAID_CONFIG_DEFAULTS);
  }
}

async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth) return { fail: err('Unauthorized', 401) };
  if (auth.role !== 'admin') return { fail: err('Forbidden', 403) };
  return { auth };
}

export async function onRequestGet({ request, env }) {
  const { fail } = await requireAdmin(request, env);
  if (fail) return fail;
  return json({
    config: await currentConfig(env),
    defaults: RAID_CONFIG_DEFAULTS,
    ranges: RAID_CONFIG_RANGE,
  });
}

export async function onRequestPost({ request, env }) {
  const { auth, fail } = await requireAdmin(request, env);
  if (fail) return fail;

  let body;
  try { body = (await request.json()) || {}; } catch (e) { return err('Invalid JSON'); }

  const key = String(body.key || '');
  if (!Object.prototype.hasOwnProperty.call(RAID_CONFIG_DEFAULTS, key)) return err('Unknown key');

  const parsed = parseValue(key, body.value);
  if (parsed.error) return err(parsed.error);

  try {
    await env.DB.prepare(
      `INSERT INTO night_raid_config(key, value, updated_at, updated_by) VALUES(?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,
         updated_at=excluded.updated_at, updated_by=excluded.updated_by`
    ).bind(key, parsed.value, Date.now(), auth.uid).run();
  } catch (e) {
    // Almost always the one cause: the code is live, db/021 is not yet.
    console.warn('night-raid-config: write failed (' + (e && e.message) + ')');
    return err('Chưa lưu được — bảng night_raid_config chưa có. Chạy db/021-night-raid-rules.sql rồi thử lại.', 500);
  }

  return json({ ok: true, key, value: parsed.value, config: await currentConfig(env) });
}
