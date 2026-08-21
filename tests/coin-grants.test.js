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
    assert.truthy(src.includes('json({ granted })'), 'client needs the total to add locally');
  });

  test('the app claims on every login sync and celebrates the gift', () => {
    const src = read('js/auth.js');
    assert.truthy(src.includes('claimCoinGrants(username)'), 'syncAccount must trigger the claim');
    assert.truthy(src.includes("api('coins', { method: 'POST', token })"));
    assert.truthy(src.includes('appState.coins = Math.max(0, +appState.coins || 0) + granted'));
    assert.truthy(src.includes('🎁'), 'the child should see the gift arrive');
  });

  test('the admin screen has a per-user Coins button wired to the endpoint', () => {
    const src = read('admin.html');
    assert.truthy(src.includes('act-coins'));
    assert.truthy(src.includes("api('admin/grant-coins'"));
    assert.truthy(/amount <= 0 \|\| amount > 100000/.test(src), 'the dialog validates before sending');
  });
});
