import { requireAuth, json, err } from '../_lib.js';

// GET /api/admin/users — every user with their activity count and
// last-activity timestamp (admin only). Since the 2026-09 cut the only
// activity table is `activities`; exam_attempts is no longer written.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.created_at, u.disabled,
            (u.device_id IS NOT NULL) AS has_device,
            (SELECT s.balance FROM user_coin_snapshots s WHERE s.user_id = u.id
              ORDER BY s.snapshot_date DESC LIMIT 1) AS coin_latest,
            (SELECT MAX(COALESCE(s.peak_balance,s.balance)) FROM user_coin_snapshots s
              WHERE s.user_id = u.id
              AND s.snapshot_date >= date('now','+7 hours','-6 days')) AS coin_peak7,
            (SELECT COUNT(*) FROM activities  c WHERE c.user_id = u.id) AS activity_count,
            COALESCE((SELECT MAX(c.created_at) FROM activities c WHERE c.user_id = u.id), '') AS last_activity
       FROM users u
      ORDER BY (last_activity = '' OR last_activity IS NULL), last_activity DESC, u.created_at DESC`
  ).all();

  const users = (results || []).map(u => ({
    id: u.id, username: u.username, role: u.role, created_at: u.created_at,
    disabled: !!u.disabled,
    // Whether this account is holding a slot on some device's 2-account quota
    // — the admin needs to see that before deciding whether clearing helps.
    has_device: !!u.has_device,
    // The wallet as the recovery net saw it: the newest daily snapshot and
    // the highest of the last 7 days. A latest far below the peak is the
    // signature of a wiped device — the UI flags it and pre-fills the
    // restore grant with the difference.
    coin_latest: u.coin_latest == null ? null : Number(u.coin_latest),
    coin_peak7: u.coin_peak7 == null ? null : Number(u.coin_peak7),
    activity_count: u.activity_count || 0,
    total_count: u.activity_count || 0,
    last_activity: u.last_activity || null,
  }));
  return json({ users });
}

// Every table that names a user, and the column(s) that do. A permanent
// delete has to empty all of them BEFORE the users row goes, or the row is
// merely orphaned: the FKs are declared without ON DELETE, and D1 does not
// enforce them, so the wallet, tasks and farm would live on under a dead id
// and the admin's next "who is this?" would have no answer.
// Kept as data (not a scan of sqlite_master) so tests/admin-delete-user
// can prove the list against the real schema — a new table that names a
// user goes red there until it is added here.
export const USER_TABLES = [
  ['exam_attempts', ['user_id']],
  ['activities', ['user_id']],
  ['user_coin_snapshots', ['user_id']],
  ['learning_skill_results', ['user_id']],
  ['night_raid_homes', ['user_id']],
  ['night_raids', ['attacker_id', 'defender_id']],
  ['night_raid_daily', ['user_id']],
  ['user_assets', ['user_id']],
  ['coin_grants', ['user_id']],
  ['ghost_offering_payouts', ['user_id']],
  ['ghost_offering_claims', ['user_id']],
  ['ghost_offering_world_claims', ['user_id']],
  ['daily_tasks', ['user_id']],
  ['daily_task_rewards', ['user_id']],
  ['farm_seed_days', ['user_id']],
  ['farm_seed_inventory', ['user_id']],
  // Left over from the ancestor's arena; the tables still exist in the
  // database (they are in the init list) and may hold pre-cut rows.
  ['friendships', ['requester_id', 'addressee_id']],
  ['battle_turns', ['user_id']],
  ['battles', ['challenger_id', 'opponent_id']],
  ['math_fights', ['challenger_id', 'opponent_id']],
  ['math_fight_pairs', ['lo_id', 'hi_id']],
];

// DELETE /api/admin/users  { userId } — the account and everything it owns,
// for good. Admin only, never an admin account, never yourself (the same two
// locks as disabling, for the same reason: one careless tap must not be
// able to lock the dashboard forever). Rows another user keeps ABOUT this
// one (coin_grants.granted_by, daily_tasks.created_by — always an admin) are
// not touched: they are that admin's audit trail, not this user's data.
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const userId = Math.trunc(Number(body && body.userId));
  if (!Number.isFinite(userId) || userId <= 0) return err('Bad userId');

  const user = await env.DB.prepare('SELECT id, username, role FROM users WHERE id = ?')
    .bind(userId).first();
  if (!user) return err('User not found', 404);
  if (userId === auth.uid) return err('Không thể tự xoá tài khoản của mình', 400, { code: 'self_delete' });
  if (user.role === 'admin') return err('Không thể xoá tài khoản admin', 400, { code: 'admin_delete' });

  // One transaction: either the account is gone with everything it owned,
  // or nothing changed. The users row goes last.
  const statements = [];
  for (const [table, cols] of USER_TABLES) {
    for (const col of cols) {
      statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(userId));
    }
  }
  statements.push(env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId));
  await env.DB.batch(statements);

  return json({ ok: true, userId, username: user.username, deleted: true });
}
