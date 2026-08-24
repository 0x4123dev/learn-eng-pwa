import { requireAuth, json, err } from './_lib.js';

// POST /api/coins — claim every admin coin grant that has not been paid yet.
// The wallet lives in the child's device profile (appState.coins), so a grant
// is an IOU row (db/010): pay it exactly once, then mark it claimed. Returns
// { granted } — 0 when there was nothing to pay, so the client stays quiet.
//
// It also carries the app's feature flags home. This call already runs on
// every account sync, and a flag that gates a MENU CARD has to arrive through
// a call the app makes anyway: a child cannot open the tab to learn that the
// tab is now open to them.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const flag = await env.DB.prepare("SELECT value FROM app_flags WHERE key = 'math_fight'").first();
  const flags = { mathFight: !!(flag && flag.value) };

  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM coin_grants WHERE user_id = ? AND claimed_at IS NULL'
  ).bind(auth.uid).first();
  const granted = Math.max(0, Math.trunc(Number((row && row.total) || 0)));
  if (granted) {
    await env.DB.prepare(
      "UPDATE coin_grants SET claimed_at = datetime('now') WHERE user_id = ? AND claimed_at IS NULL"
    ).bind(auth.uid).run();
  }
  return json({ granted, flags });
}
