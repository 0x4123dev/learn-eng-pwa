const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const auth = read('js/auth.js');
const activity = read('functions/api/activity.js');
const adminApi = read('functions/api/admin/activity.js');
const admin = read('admin.html');
const migration = read('db/013-daily-coin-snapshots.sql');
const schema = read('db/schema.sql');

suite('daily coin balance recovery snapshots', () => {
  test('activity sync carries the current device wallet without exceeding the app cap', () => {
    // Behavioural coverage (what is sent, when, and that an unhydrated wallet
    // is omitted rather than reported as 0) lives in tests/money-client.test.js.
    assert.truthy(auth.includes('function _walletBalance()'));
    assert.truthy(auth.includes('Math.min(100000'));
    assert.truthy(auth.includes('lastCoinReport'), 'balance-only syncs report once per change');
  });
  test('one GMT+7 snapshot per user per day keeps the day\'s highest balance', () => {
    for (const src of [migration, schema]) {
      assert.truthy(src.includes('PRIMARY KEY (user_id, snapshot_date)'));
      assert.truthy(src.includes('observed_at'));
      assert.truthy(src.includes('source_activity_at'));
    }
    assert.truthy(activity.includes('ON CONFLICT(user_id,snapshot_date) DO UPDATE SET'));
    assert.truthy(activity.includes('excluded.observed_at >= user_coin_snapshots.observed_at'));
    assert.truthy(activity.includes('gmt7Date(observedAt)'));
    // MAX, not last-write: a wiped device syncing 0 must not erase the very
    // number the admin needs for recovery (see tests/money-server.test.js).
    assert.truthy(activity.includes('MAX(user_coin_snapshots.balance,excluded.balance)'));
  });
  test('invalid balances are rejected and valid balances are clamped', () => {
    assert.truthy(activity.includes("if (!Number.isFinite(+value)) return null"));
    assert.truthy(activity.includes('Math.max(0, Math.min(100000'));
  });
  test('admin activity exposes the recoverable balance beside its source activity', () => {
    assert.equal((adminApi.match(/AS coin_balance/g) || []).length, 2);
    assert.truthy(admin.includes('<th>Balance</th>'));
    assert.truthy(admin.includes('a.coin_balance!=null'));
  });
});

if (require.main === module) require('./harness').runAll();
