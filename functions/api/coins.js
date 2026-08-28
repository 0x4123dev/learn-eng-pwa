import { requireAuth, json, err, randomHex } from './_lib.js';

// POST /api/coins — claim every admin coin adjustment that has not been paid
// yet. The wallet lives in the child's device profile (appState.coins), so a
// grant is an IOU row (db/010): pay it out, then mark it claimed.
//
// Since db/015 a claim is TWO-PHASE, so a crash between "server stamped it"
// and "device saved it" no longer loses the gift:
//   1. claim  — rows get claimed_at + a fresh receipt (PENDING).
//   2. ack    — after localStorage durably holds the coins, the client sends
//               the receipt back ({ ackReceipts }) and the rows are CONFIRMED.
// A pending row with no ack after RECLAIM_AFTER is offered again on the next
// sync. Only clients that declare { proto: 2 } get receipts; a legacy client
// (deployed before this protocol, sends no body) keeps claim-equals-confirm —
// its rows are confirmed on the spot, so it can never be re-offered/double-paid.
//
// It also carries the app's feature flags home. This call already runs on
// every account sync, and a flag that gates a MENU CARD has to arrive through
// a call the app makes anyway: a child cannot open the tab to learn that the
// tab is now open to them.
const RECLAIM_AFTER = '-10 minutes';
const RECEIPT_RE = /^[a-f0-9]{32}$/;

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body = {};
  try { body = await request.json(); } catch (e) { /* legacy clients send no body */ }
  if (!body || typeof body !== 'object') body = {};

  // Acks first: the device says these receipts are durably saved. Scoped to
  // the authenticated user — one child's ack can never confirm another's rows.
  const acks = (Array.isArray(body.ackReceipts) ? body.ackReceipts : [])
    .map(r => String(r)).filter(r => RECEIPT_RE.test(r)).slice(0, 20);
  for (const rcpt of acks) {
    await env.DB.prepare(
      "UPDATE coin_grants SET confirmed_at = datetime('now') WHERE user_id = ? AND receipt = ? AND confirmed_at IS NULL"
    ).bind(auth.uid, rcpt).run();
  }

  const flag = await env.DB.prepare("SELECT value FROM app_flags WHERE key = 'math_fight'").first();
  const me = await env.DB.prepare('SELECT allow_bot FROM users WHERE id = ?').bind(auth.uid).first();
  const flags = { mathFight: !!(flag && flag.value), bot: !!(me && me.allow_bot) };

  if (body.ackOnly === true) return json({ granted: 0, receipt: null, flags });

  // Claim and read in ONE statement. The old SELECT-then-UPDATE sequence let
  // two devices read the same pending rows before either stamped them, paying
  // one adjustment twice. RETURNING gives each row to exactly one caller.
  let claimed, receipt = null;
  if (body.proto === 2) {
    receipt = randomHex(16);
    claimed = await env.DB.prepare(
      `UPDATE coin_grants SET claimed_at = datetime('now'), receipt = ?, confirmed_at = NULL
       WHERE user_id = ? AND (claimed_at IS NULL
         OR (confirmed_at IS NULL AND claimed_at < datetime('now', ?)))
       RETURNING amount`
    ).bind(receipt, auth.uid, RECLAIM_AFTER).all();
  } else {
    claimed = await env.DB.prepare(
      "UPDATE coin_grants SET claimed_at = datetime('now'), confirmed_at = datetime('now') WHERE user_id = ? AND claimed_at IS NULL RETURNING amount"
    ).bind(auth.uid).all();
  }
  const granted = (claimed.results || []).reduce(
    (total, row) => total + Math.trunc(Number(row.amount) || 0), 0
  );
  return json({ granted, receipt: granted > 0 ? receipt : null, flags });
}
