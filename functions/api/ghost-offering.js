import { requireAuth, json, err } from './_lib.js';
import GhostOfferingSchedule from '../../js/ghost-offering-schedule.js';

// The date, the window and the room names all come from the shared schedule so
// this API, the child's screen and the websocket Worker cannot disagree on the
// day. Do not reintroduce a local copy — see js/ghost-offering-schedule.js.
const ITEMS = Object.freeze({
  pig: 200,
  chicken1: 50, chicken2: 50, chicken3: 50, chicken4: 50, chicken5: 50,
  fruit1: 10, fruit2: 10, fruit3: 10, fruit4: 10,
  fruit5: 10, fruit6: 10, fruit7: 10, fruit8: 10,
});

function eventWindow(now = Date.now()) {
  return GhostOfferingSchedule.eventWindow(now);
}

// allow_bot accounts remain QA testers and can play at any hour. Everyone else
// may inspect the complete scene beforehand, but the server only accepts a
// public claim inside the window GhostOfferingSchedule defines.
function botPreviewWindow(now = Date.now()) {
  const window = eventWindow(now);
  return { ...window, realOpen: window.open, open: true, preview: true };
}

function newPreviewSession() {
  return crypto.randomUUID();
}

function previewClaimKey(eventDate, sessionId) {
  return `${eventDate}#${sessionId}`;
}

async function previewUser(env, uid) {
  const row = await env.DB.prepare('SELECT allow_bot FROM users WHERE id=?').bind(uid).first();
  return !!(row && row.allow_bot);
}
async function ensureClaimsTable(env) {
  // The checked-in migration is canonical. CREATE IF NOT EXISTS also lets a
  // Pages deploy become usable before the production migration command runs.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ghost_offering_claims (
    user_id INTEGER NOT NULL, event_date TEXT NOT NULL, item_id TEXT NOT NULL,
    reward INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id,event_date,item_id))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ghost_offering_world_claims (
    event_date TEXT NOT NULL, item_id TEXT NOT NULL, user_id INTEGER NOT NULL,
    reward INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
    PRIMARY KEY (event_date,item_id))`).run();
}
async function claimedIds(env, uid, eventDate, shared = false) {
  const out = shared
    ? await env.DB.prepare('SELECT item_id FROM ghost_offering_world_claims WHERE event_date=?').bind(eventDate).all()
    : await env.DB.prepare('SELECT item_id FROM ghost_offering_claims WHERE user_id=? AND event_date=?').bind(uid, eventDate).all();
  return (out.results || []).map(r => String(r.item_id));
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  const preview = await previewUser(env, auth.uid);
  const humanTest = preview && new URL(request.url).searchParams.get('mode') === 'human';
  await ensureClaimsTable(env);
  const window = preview ? botPreviewWindow() : eventWindow();
  // Every bot-preview entry is a fresh QA round. Public claims use only the
  // calendar event date, so reopening the screen cannot award the table twice.
  const sessionId = newPreviewSession();
  const claimKey = preview ? previewClaimKey(window.eventDate, sessionId) : window.eventDate;
  return json({ ok: true, serverNow: Date.now(), ...window, sessionId,
    humanTest, roomId: GhostOfferingSchedule.roomIdFor({ preview, humanTest }),
    claimedIds: await claimedIds(env, auth.uid, claimKey, !preview) });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  const preview = await previewUser(env, auth.uid);
  let body;
  try { body = await request.json(); } catch (_) { return err('Invalid JSON'); }
  const humanTest = preview && body.humanTest === true;
  const itemId = String(body.itemId || ''), reward = ITEMS[itemId];
  if (!reward) return err('Unknown offering', 400);
  const sessionId = String(body.sessionId || '');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)) return err('Invalid event session', 400);
  const window = preview ? botPreviewWindow() : eventWindow();
  if (!preview && !window.open) return err('Event is not open', 403);
  const claimKey = preview ? previewClaimKey(window.eventDate, sessionId) : window.eventDate;
  await ensureClaimsTable(env);
  const now = Date.now();
  const result = preview
    ? await env.DB.prepare(`INSERT OR IGNORE INTO ghost_offering_claims
        (user_id,event_date,item_id,reward,claimed_at) VALUES(?,?,?,?,?)`)
        .bind(auth.uid, claimKey, itemId, reward, now).run()
    : await env.DB.prepare(`INSERT OR IGNORE INTO ghost_offering_world_claims
        (event_date,item_id,user_id,reward,claimed_at) VALUES(?,?,?,?,?)`)
        .bind(claimKey, itemId, auth.uid, reward, now).run();
  const awarded = Number(result.meta && result.meta.changes || 0) > 0;
  if (awarded) {
    if (!preview) await env.DB.prepare(`INSERT OR IGNORE INTO ghost_offering_claims
      (user_id,event_date,item_id,reward,claimed_at) VALUES(?,?,?,?,?)`)
      .bind(auth.uid, claimKey, itemId, reward, now).run();
    // The reward is a coin_grants IOU (granted_by 0 = the event itself), paid
    // through the receipt-protected POST /api/coins pipeline like any admin
    // gift: claimed exactly once, crash-safe, and safe on every device. The
    // old direct write to night_raid_homes.lootable_coins was silently undone
    // by the next syncHome from any device that had not seen the reward.
    await env.DB.prepare(
      'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,0)'
    ).bind(auth.uid, reward, 'Ghost offering: ' + itemId + (preview ? ' (preview)' : ''))
      .run();
  }
  const wallet = await env.DB.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?')
    .bind(auth.uid).first();
  return json({ ok: true, awarded, reward: awarded ? reward : 0, itemId, sessionId,
    coins: wallet ? Math.max(0, Number(wallet.lootable_coins) || 0) : null,
    humanTest, roomId: GhostOfferingSchedule.roomIdFor({ preview, humanTest }),
    claimedIds: await claimedIds(env, auth.uid, claimKey, !preview), ...window });
}
