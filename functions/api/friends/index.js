import { requireAuth, json, err } from '../_lib.js';
import { friendReadyFrom } from '../_battle.js';

// Summary of a user's learning, safe to show a friend: no raw history,
// no answers — just what a scoreboard would show.
async function summaryFor(env, userId) {
  const week = await env.DB.prepare(
    `SELECT COUNT(*) AS sessions,
            COALESCE(SUM(score), 0) AS correct,
            COUNT(DISTINCT date(created_at)) AS days
       FROM activities
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
  ).bind(userId).first();
  return {
    sessions: week?.sessions || 0,
    correct: week?.correct || 0,
    daysThisWeek: week?.days || 0,
  };
}

// GET /api/friends → { friends, incoming, outgoing }
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const rows = await env.DB.prepare(
    `SELECT f.id, f.status, f.requester_id, f.addressee_id,
            ru.username AS requester_name, au.username AS addressee_name,
            strftime('%s', COALESCE(f.responded_at, f.created_at)) AS since
       FROM friendships f
       JOIN users ru ON ru.id = f.requester_id
       JOIN users au ON au.id = f.addressee_id
      WHERE (f.requester_id = ? OR f.addressee_id = ?)
        AND f.status IN ('pending', 'accepted')
        AND ru.disabled = 0 AND au.disabled = 0
      ORDER BY f.id DESC`
  ).bind(auth.uid, auth.uid).all();

  const friends = [], incoming = [], outgoing = [];
  for (const r of (rows.results || [])) {
    const isRequester = r.requester_id === auth.uid;
    const otherId = isRequester ? r.addressee_id : r.requester_id;
    const otherName = isRequester ? r.addressee_name : r.requester_name;
    const entry = { friendshipId: r.id, userId: otherId, username: otherName };
    // How long until this pair may battle (null = now). Sent as an absolute
    // timestamp so the client renders a countdown without ever holding its own
    // copy of the 3-day rule — one number, one source, nothing to drift.
    if (r.status === 'accepted') entry.battleReadyAt = friendReadyFrom(r.since);
    if (r.status === 'accepted') friends.push(entry);
    else if (isRequester) outgoing.push(entry);
    else incoming.push(entry);
  }

  // Attach each accepted friend's public learning summary.
  for (const f of friends) {
    try { f.summary = await summaryFor(env, f.userId); } catch (e) { f.summary = null; }
  }

  return json({ friends, incoming, outgoing });
}

// POST /api/friends { username } → invite by EXACT username (no search, no chat)
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const username = String(body.username || '').trim();
  if (!username) return err('Cần tên bạn bè');

  // Same 404 as a name that never existed: login already refuses to reveal
  // which usernames are real, and friend search must not become that oracle.
  const other = await env.DB.prepare('SELECT id, username FROM users WHERE username = ? AND disabled = 0')
    .bind(username).first();
  if (!other) return err('Không tìm thấy bạn này', 404);
  if (other.id === auth.uid) return err('Không thể kết bạn với chính mình');

  const existing = await env.DB.prepare(
    `SELECT id, status, requester_id FROM friendships
      WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  ).bind(auth.uid, other.id, other.id, auth.uid).first();

  if (existing) {
    if (existing.status === 'accepted') return err('Đã là bạn bè rồi', 409);
    if (existing.status === 'pending') {
      // They already invited us → accepting is the friendly interpretation.
      if (existing.requester_id === other.id) {
        await env.DB.prepare(
          `UPDATE friendships SET status = 'accepted', responded_at = datetime('now') WHERE id = ?`
        ).bind(existing.id).run();
        return json({ ok: true, status: 'accepted' });
      }
      return err('Đã gửi lời mời rồi', 409);
    }
    // Previously declined → allow a fresh invite on the same row.
    await env.DB.prepare(
      `UPDATE friendships SET status = 'pending', requester_id = ?, addressee_id = ?,
              created_at = datetime('now'), responded_at = NULL WHERE id = ?`
    ).bind(auth.uid, other.id, existing.id).run();
    return json({ ok: true, status: 'pending' });
  }

  await env.DB.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`
  ).bind(auth.uid, other.id).run();
  return json({ ok: true, status: 'pending' });
}
