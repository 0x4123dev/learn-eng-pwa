import { requireAuth, json, err } from '../_lib.js';
import { claimReward, armoryStatus } from '../_daily-task.js';

// POST /api/daily-task/claim { date: 'YYYY-MM-DD', kind: 'shield' | 'sword' }
// Turns one earned daily-task reward into the item the child chose. Safe to
// repeat — see claimReward() for the lock — and every reply carries the whole
// armory so the screen repaints from the response alone. Only needs a login:
// the inventory is the child's regardless of allow_bot.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  if (!body || typeof body !== 'object') return err('Invalid body');
  const now = Date.now();
  const r = await claimReward(env, auth.uid, body.date, body.kind, now);
  if (r.ok) return json({ ok: true, date: String(body.date), kind: r.kind, armory: await armoryStatus(env, auth.uid, now) });
  if (r.code === 'bad_kind') return err('Chọn khiên hoặc kiếm', 400, { code: r.code });
  if (r.code === 'bad_date') return err('Ngày không hợp lệ', 400, { code: r.code });
  const armory = await armoryStatus(env, auth.uid, now);
  if (r.code === 'not_ready') return err('Kho đang được nâng cấp, thử lại sau ít phút', 503, { code: r.code, armory });
  if (r.code === 'no_reward') return err('Ngày này chưa có phần thưởng', 404, { code: r.code, armory });
  return err('Phần thưởng ngày này đã nhận rồi', 409, { code: 'claimed', kind: r.kind, armory });
}
