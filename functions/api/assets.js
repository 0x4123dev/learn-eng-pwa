import { requireAuth, json, err } from './_lib.js';

// GET/PUT /api/assets — the server backup for everything a child OWNS:
// pet accessories, stickers, streak shields, dogGrowthXP. (castleSkins rode
// here too until the 2026-09 cut took the castle with it; a stored blob that
// still carries the key is simply ignored.)
// These used to live only in the device's localStorage; a cleared iPad lost
// every purchase with no recovery path.
//
// The merge follows the cups rule ("the server may only add"): sets UNION,
// numbers take the MAX. Nothing here can shrink — there is no sell/remove
// path for any of these in the app, XP is never deducted by design, and
// shields cap at 3 so the worst a resurrected shield can be is a small kind-
// ness. The PUT's reply is the merged result, so the same call that backs up
// one device restores the next: a fresh install gets everything back on its
// first sync.
//
// Two devices syncing at the same instant is a read-modify-write race on the
// JSON blob, and add-only makes it self-healing: whichever union lost simply
// re-adds its members on its next sync.

const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const MAX_SET = 200;
const MAX_XP = 99999999; // matches getDogLevel's clamp in js/home.js
const MAX_SHIELDS = 3;   // SHIELD_MAX in js/home.js

function cleanSet(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    const id = String(x);
    if (ID_RE.test(id) && !out.includes(id)) {
      out.push(id);
      if (out.length >= MAX_SET) break;
    }
  }
  return out;
}
function cleanNum(v, max) {
  return Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.trunc(+v))) : 0;
}
function union(a, b) {
  const out = a.slice();
  for (const x of b) if (!out.includes(x)) { out.push(x); if (out.length >= MAX_SET) break; }
  return out;
}
function normalize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    accessories: cleanSet(s.accessories),
    stickers: cleanSet(s.stickers),
    dogGrowthXP: cleanNum(s.dogGrowthXP, MAX_XP),
    streakShields: cleanNum(s.streakShields, MAX_SHIELDS),
  };
}

async function readStored(env, uid) {
  const row = await env.DB.prepare('SELECT assets_json FROM user_assets WHERE user_id=?')
    .bind(uid).first();
  let parsed = null;
  try { parsed = row ? JSON.parse(row.assets_json) : null; } catch (e) {}
  return normalize(parsed);
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  return json({ ok: true, assets: await readStored(env, auth.uid) });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const stored = await readStored(env, auth.uid);
  const sent = normalize(body);
  const merged = {
    accessories: union(stored.accessories, sent.accessories),
    stickers: union(stored.stickers, sent.stickers),
    dogGrowthXP: Math.max(stored.dogGrowthXP, sent.dogGrowthXP),
    streakShields: Math.max(stored.streakShields, sent.streakShields),
  };
  await env.DB.prepare(`INSERT INTO user_assets(user_id,assets_json,updated_at)
    VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET
    assets_json=excluded.assets_json,updated_at=excluded.updated_at`)
    .bind(auth.uid, JSON.stringify(merged), Date.now()).run();
  return json({ ok: true, assets: merged });
}
