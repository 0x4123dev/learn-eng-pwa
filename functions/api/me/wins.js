import { requireAuth, json, err } from '../_lib.js';

// GET /api/me/wins → { wins }
//
// The trophy cabinet lives in localStorage, but the battles that earned it
// live here. Without this a reinstall, a cleared site data, or a new phone
// wiped 25 victories' worth of cups while the server still knew about every
// one of them. This is the authoritative lifetime win count the client
// reconciles against.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS wins FROM battles WHERE winner_id = ? AND status = 'done'"
  ).bind(auth.uid).first();

  return json({ wins: (row && row.wins) || 0 });
}
