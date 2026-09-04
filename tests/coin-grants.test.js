// Admin gives coins → the child's device claims them exactly once.
// The wallet lives in appState.coins (device profile), so the grant is a
// server-side IOU row (db/010) paid out by POST /api/coins on the next sync.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

suite('coin grants: admin gives, the device claims once', () => {
  test('the migration and schema both carry the IOU table', () => {
    for (const f of ['db/010-coin-grants.sql', 'db/schema.sql']) {
      const src = read(f);
      assert.truthy(src.includes('coin_grants'), f);
      assert.truthy(src.includes('claimed_at'), f + ' needs the paid stamp');
      assert.truthy(src.includes('idx_coin_grants_unclaimed'), f + ' needs the unclaimed index');
    }
  });

  test('granting is admin-only and bounded', () => {
    const src = read('functions/api/admin/grant-coins.js');
    assert.truthy(src.includes("auth.role !== 'admin'"), 'a child must not gift themselves');
    assert.truthy(src.includes('MAX_GRANT'), 'amount must have a ceiling');
    assert.truthy(/amount <= 0/.test(src), 'zero or negative grants must be refused');
    assert.truthy(src.includes('SELECT id FROM users WHERE id = ?'), 'grants only to real users');
  });

  test('claiming pays every unclaimed row and stamps them in one sweep', () => {
    const src = read('functions/api/coins.js');
    assert.truthy(src.includes('claimed_at IS NULL'), 'only unpaid rows count');
    assert.truthy(/UPDATE coin_grants SET claimed_at/.test(src), 'rows must be stamped so a re-sync cannot double-pay');
    assert.truthy(src.includes('RETURNING amount'), 'claiming and reading must be one atomic statement');
    assert.truthy(/json\(\{ granted[,}]/.test(src), 'client needs the total to add locally');
  });

  test('the same reply carries the per-user feature flags home', () => {
    // A flag that gates a MENU CARD cannot be delivered by the tab it gates:
    // the child could never open the tab to learn it was opened for them. This
    // call already runs on every sync, so it is the one that carries them.
    const src = read('functions/api/coins.js');
    assert.truthy(src.includes("key = 'math_fight'"), 'the Dau Toan switch rides home here');
    assert.truthy(src.includes('flags'), 'flags travel in the same reply');
    const client = read('js/auth.js');
    assert.truthy(client.includes('r.data.flags'), 'the client caches what it was told');
    assert.truthy(client.includes('appState.allowMathFight'));
    assert.truthy(client.indexOf('r.data.flags') < client.indexOf('if (!granted) return;'),
      'flags must be cached BEFORE the no-coins early return');
  });

  test('the app claims on every login sync and celebrates the gift', () => {
    const src = read('js/auth.js');
    assert.truthy(src.includes('claimCoinGrants(username)'), 'syncAccount must trigger the claim');
    // proto 2 = the receipt protocol (db/015): claim carries any unacked
    // receipts, and a paid claim is acked only after the wallet is saved.
    // Behavioural coverage lives in tests/money-client.test.js /
    // tests/money-server.test.js.
    // `device` scopes the server's re-offer window to this install (db/025):
    // without it a second phone on the same account was handed a grant this
    // one had already banked but not yet acked.
    assert.truthy(src.includes("api('coins', { method: 'POST', token, body: { proto: 2, ackReceipts: pending, device: deviceId() } })"));
    assert.truthy(src.includes('pendingCoinReceipts'), 'unacked receipts must be stored durably');
    assert.truthy(src.includes('Math.trunc(+r.data.granted || 0)'), 'signed corrections must not be clamped away');
    // The wallet write moved into applySignedGrant, which carries the part of
    // a negative grant the purse cannot cover instead of clamping it away —
    // `Math.max(0, wallet + delta)` was silently printing money whenever a
    // raid debited a child for more than they actually had.
    assert.truthy(src.includes('applySignedGrant(granted)'), 'the signed total goes through the ledger');
    assert.truthy(src.includes('function applySignedGrant'), 'and that ledger lives here');
    assert.truthy(src.includes('appState.coinDebt = coinDebt() + (-after)'), 'an unpayable debit is carried');
    assert.truthy(src.includes('🎁'), 'the child should see the gift arrive');
  });

  test('the admin screen has a per-user Coins button wired to the endpoint', () => {
    const src = read('admin.html');
    assert.truthy(src.includes('act-coins'));
    assert.truthy(src.includes("api('admin/grant-coins'"));
    assert.truthy(/amount <= 0 \|\| amount > 100000/.test(src), 'the dialog validates before sending');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
