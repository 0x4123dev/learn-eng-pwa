import { requireAuth, json, err } from '../_lib.js';
import { claimAllRewards, armoryStatus } from '../_daily-task.js';

// POST /api/daily-task/claim-all { kind: 'shield' | 'sword' }
// Every pending daily-task reward becomes `kind` in one transaction — see
// claimAllRewards() for why a concurrent single claim can neither be
// re-claimed nor double-credited. `claimed` is how many days this call
// actually turned; 0 on a replay is still ok:true.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  if (!body || typeof body !== 'object') return err('Invalid body');
  const now = Date.now();
  const r = await claimAllRewards(env, auth.uid, body.kind, now);
  if (r.ok) return json({ ok: true, kind: r.kind, claimed: r.claimed, armory: await armoryStatus(env, auth.uid, now) });
  if (r.code === 'bad_kind') return err('Chọn khiên hoặc kiếm', 400, { code: r.code });
  return err('Kho đang được nâng cấp, thử lại sau ít phút', 503, { code: r.code, armory: await armoryStatus(env, auth.uid, now) });
}
