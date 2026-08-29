import { requireAuth, json, err } from './_lib.js';

// Every type js/auth.js can emit. A type missing from this list is not
// rejected loudly — clean() returns null, the row is dropped, the response is
// still ok, and the client marks it synced and never sends it again. That is
// exactly what happened to Collocation and Math: both tabs recorded history,
// both uploaded it, and none of it ever reached the admin. Keep this in step
// with _localHistoryItems() — tests/feature-sync.test.js pins the two together.
const TYPES = ['lesson', 'review', 'grammar', 'phrases', 'collocation', 'wordform',
               'rewrite', 'verbs', 'math', 'battle'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const GMT7_MS = 7 * 60 * 60 * 1000;

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

function cleanBalance(value) {
  if (!Number.isFinite(+value)) return null;
  return Math.max(0, Math.min(100000, Math.trunc(+value)));
}
function gmt7Date(ms) {
  return new Date(ms + GMT7_MS).toISOString().slice(0, 10);
}
function coinSnapshot(env, uid, body, source) {
  const balance = cleanBalance(body.coinBalance);
  if (balance == null || !source) return null;
  const observedAt = Date.now();
  const activityAt = Number.isFinite(+source.at) ? Math.trunc(+source.at) : observedAt;
  // Two different questions, two columns (db/017):
  //   balance      — the LATEST observation, so the admin timeline shows the
  //                  wallet as it is now. MAX-ing this made the column report
  //                  the day's high-water mark: 18,440 xu beside a wallet that
  //                  really held ~10,000 after an honest afternoon of shopping.
  //   peak_balance — the day's MAX, which is what a wipe radar and a restore
  //                  grant need: a cleared device honestly reports 0, and that
  //                  0 must not erase the number required to put the coins back.
  return env.DB.prepare(`INSERT INTO user_coin_snapshots
    (user_id,snapshot_date,balance,peak_balance,observed_at,source_activity_at,source_type,source_title)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,snapshot_date) DO UPDATE SET
      balance=excluded.balance,
      peak_balance=MAX(COALESCE(user_coin_snapshots.peak_balance,user_coin_snapshots.balance),excluded.balance),
      observed_at=excluded.observed_at,
      source_activity_at=excluded.source_activity_at,source_type=excluded.source_type,
      source_title=excluded.source_title,updated_at=datetime('now')
    WHERE excluded.observed_at >= user_coin_snapshots.observed_at`)
    .bind(uid, gmt7Date(observedAt), balance, balance, observedAt, activityAt,
      source.type, source.title);
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
    const stmts = rows.map(r => {
      const at = Number.isFinite(+r.at) ? sqlTime(+r.at) : sqlTime(Date.now());
      // OR IGNORE + the unique (user_id, type, created_at) index makes re-syncs idempotent.
      return env.DB.prepare(
        `INSERT OR IGNORE INTO activities (user_id, type, title, score, total, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(auth.uid, r.type, r.title, r.score, r.total, r.detailJson, at);
    });
    // Coins earned in pet chores, Night Raid or the shop produce no activity
    // items, so a balance-only sync (items: []) must still leave its snapshot
    // — otherwise a day of pure economy play records nothing recoverable.
    const snapshot = coinSnapshot(env, auth.uid, body,
      rows[0] || { at: Date.now(), type: 'sync', title: 'Balance sync' });
    if (snapshot) stmts.push(snapshot);
    if (stmts.length) await env.DB.batch(stmts);
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
