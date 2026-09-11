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
// …and the backstop, for ANY device. Scoping the re-offer to the claiming
// device closed a double-pay, but on its own it also made a loss permanent:
// once a row carries a device id, a child who reinstalls, wipes site data (the
// device id is regenerated — js/auth.js) or simply moves to a new phone can
// never be handed that grant again. A day is long enough that the original
// device has plainly not come back, and short enough that a gift or a defence
// reward is not gone for good.
const STRANDED_AFTER = '-24 hours';
const RECEIPT_RE = /^[a-f0-9]{32}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

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

  // Both app-wide settings in ONE round trip. They were two separate SELECTs
  // against the same two-row table, on an endpoint every finished practice
  // calls — a wasted query per sync for nothing.
  const appRows = await env.DB.prepare(
    "SELECT key, value FROM app_flags WHERE key IN ('math_fight', 'cuuchuong_seconds')").all();
  const app = new Map(((appRows && appRows.results) || []).map(r => [r.key, r.value]));
  const me = await env.DB.prepare('SELECT allow_bot, allow_chuyen FROM users WHERE id = ?').bind(auth.uid).first();
  // Bảng cửu chương's round length rides home with the switches: it is one
  // number for the whole app, an adult changes it while watching a child use
  // it, and this call already runs often enough that the change lands within
  // a session. Clamped and defaulted HERE as well as in the admin endpoint,
  // because a row written before the range existed must still hand a device a
  // length it can actually run a round on.
  const rawSeconds = Math.trunc(Number(app.get('cuuchuong_seconds')));
  const cuuchuongSeconds = Number.isFinite(rawSeconds) && rawSeconds > 0
    ? Math.max(15, Math.min(180, rawSeconds))
    : 60;
  const flags = {
    mathFight: !!app.get('math_fight'),
    bot: !!(me && me.allow_bot),
    // Chuyên tier in Word Form / Rewrite (db/031): its own switch.
    chuyen: !!(me && me.allow_chuyen),
    cuuchuongSeconds: cuuchuongSeconds,
  };

  if (body.ackOnly === true) return json({ granted: 0, receipt: null, flags });

  // Claim and read in ONE statement. The old SELECT-then-UPDATE sequence let
  // two devices read the same pending rows before either stamped them, paying
  // one adjustment twice. RETURNING gives each row to exactly one caller.
  //
  // The re-offer after RECLAIM_AFTER is scoped to the device that made the
  // claim (db/025), whenever both sides know a device id — a client too old to
  // send one, or a row claimed before db/025, keeps the previous behaviour
  // rather than having its gift stranded. Un-scoped, it repaid a grant to ANY device of the same
  // account ten minutes later — the second phone has no `pendingCoinReceipts`
  // of its own, so it never acked, and its re-claim overwrote `receipt`, which
  // in turn made the first phone's ack match nothing. That is now a
  // double-DEBIT risk as well as a double-credit one: since Cướp Đêm settles
  // the sleeping side through this table, a grant can be negative.
  const device = DEVICE_RE.test(String(body.device || '')) ? String(body.device) : null;
  let claimed, receipt = null;
  if (body.proto === 2) {
    receipt = randomHex(16);
    try {
      claimed = await env.DB.prepare(
        `UPDATE coin_grants SET claimed_at = datetime('now'), receipt = ?, confirmed_at = NULL, claimed_device = ?
         WHERE user_id = ? AND (claimed_at IS NULL
           OR (confirmed_at IS NULL AND claimed_at < datetime('now', ?)
               AND (? IS NULL OR claimed_device IS NULL OR claimed_device = ?))
           OR (confirmed_at IS NULL AND claimed_at < datetime('now', ?)))
         RETURNING amount, note, granted_by`
      ).bind(receipt, device, auth.uid, RECLAIM_AFTER, device, device, STRANDED_AFTER).all();
    } catch (e) {
      // db/025 has not been applied to this database yet. A child's coins must
      // not depend on the order a deploy and a migration happened to land in,
      // so fall back to the pre-025 statement — the same behaviour this
      // endpoint had yesterday — instead of failing the whole sync.
      if (!/claimed_device/.test(String(e && e.message || ''))) throw e;
      claimed = await env.DB.prepare(
        `UPDATE coin_grants SET claimed_at = datetime('now'), receipt = ?, confirmed_at = NULL
         WHERE user_id = ? AND (claimed_at IS NULL
           OR (confirmed_at IS NULL AND claimed_at < datetime('now', ?)))
         RETURNING amount, note, granted_by`
      ).bind(receipt, auth.uid, RECLAIM_AFTER).all();
    }
  } else {
    claimed = await env.DB.prepare(
      "UPDATE coin_grants SET claimed_at = datetime('now'), confirmed_at = datetime('now') WHERE user_id = ? AND claimed_at IS NULL RETURNING amount, note, granted_by"
    ).bind(auth.uid).all();
  }
  const rows = claimed.results || [];
  const granted = rows.reduce(
    (total, row) => total + Math.trunc(Number(row.amount) || 0), 0
  );
  // Daily Task rewards travel through the same durable IOU pipeline as manual
  // admin adjustments. Tell the client which part came from completed tasks so
  // it never calls an earned reward an admin gift.
  const dailyTaskGranted = rows.reduce((total, row) =>
    /^Daily task \d{4}-\d{2}-\d{2}$/.test(String(row.note || ''))
      ? total + Math.trunc(Number(row.amount) || 0)
      : total, 0);
  // Keep each adjustment's reason. The client used to receive only the net
  // total, so every non-Daily-Task reward was incorrectly announced as an
  // admin gift — including the 100 xu earned by defending a home. `note` is
  // already bounded when manual grants are created, and the client renders it
  // as text (never HTML).
  const adjustments = rows.map(row => ({
    amount: Math.trunc(Number(row.amount) || 0),
    note: String(row.note || '').slice(0, 120),
    manual: Number(row.granted_by || 0) > 0,
  }));
  // The receipt goes back whenever ROWS were claimed, not when the total is
  // positive. A batch that nets to zero — or to a negative, now that a raid
  // debits the sleeping defender through this table — used to come back with
  // `receipt: null`, so the device could never ack it, and the server offered
  // the very same debit again on every sync after the reclaim window.
  return json({ granted, dailyTaskGranted, adjustments,
    receipt: rows.length > 0 ? receipt : null, flags });
}
