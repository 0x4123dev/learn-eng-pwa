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
    // Two columns, two questions (db/017): `balance` is the LATEST reading, so
    // the admin timeline shows the wallet as it is now; `peak_balance` keeps
    // the day's high-water mark for the wipe radar and restore grants.
    // Behavioural coverage: tests/money-server.test.js.
    assert.truthy(activity.includes('balance=excluded.balance'));
    assert.truthy(/peak_balance=MAX\(/.test(activity));
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
  test('the users list flags a suspected wipe and pre-fills the restore grant', () => {
    // Behavioural coverage of the endpoint fields (coin_latest, coin_peak7)
    // lives in tests/money-server.test.js; these pin the UI wiring.
    const usersApi = read('functions/api/admin/users.js');
    assert.truthy(usersApi.includes('coin_latest'));
    assert.truthy(usersApi.includes('coin_peak7'));
    assert.truthy(admin.includes('coinDrop'), 'a drop is computed per user row');
    assert.truthy(admin.includes('▼'), 'a wiped wallet shows a visible drop badge');
    assert.truthy(admin.includes('data-refill'), 'the Coins button carries the suggested restore');
    assert.truthy(admin.includes("b.dataset.refill"), 'the prompt pre-fills the recovery amount');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
