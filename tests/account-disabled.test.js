// A disabled account must vanish everywhere except the admin site: it cannot
// log in, and its token dies on the next request. Since the 2026-09 cut no
// child-facing endpoint lists, searches or targets OTHER accounts (friends,
// battles and raiding are gone), so requireAuth's check is the whole story.
// These tests pin those doors by reading the server source the way the sync
// harness pins other Functions contracts.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

suite('disabled accounts: gone everywhere but the admin site', () => {
  test('login refuses a disabled account with its own child-friendly message', () => {
    const src = read('functions/api/login.js');
    assert.truthy(src.includes('account_disabled'));
    assert.truthy(/user\.disabled/.test(src));
  });

  test('every API call dies with the switch: requireAuth checks disabled', () => {
    const src = read('functions/api/_lib.js');
    assert.truthy(/SELECT id, role, disabled FROM users/.test(src));
    assert.truthy(/row\.disabled/.test(src), 'a still-valid token must not outlive the switch');
  });

  test('no child-facing route reads another account any more, so nothing else can leak one', () => {
    // friends/*, battle/* and the raiding half of night-raid/* each had their
    // own `disabled = 0` filter because each listed other children. With them
    // gone, the only routes left act on the caller (requireAuth) or are
    // admin-only — a new route that lists users would need its own filter,
    // and this is where that would be pinned.
    for (const dir of ['friends', 'battle', 'math-fight']) {
      assert.falsy(fs.existsSync(path.join(__dirname, '..', 'functions', 'api', dir)), dir + '/ must be gone');
    }
    for (const f of ['night-raid/targets.js', 'night-raid/start.js', 'night-raid/reports.js', 'night-raid/friends.js']) {
      assert.falsy(fs.existsSync(path.join(__dirname, '..', 'functions', 'api', f)), f + ' must be gone');
    }
  });

  test('the admin site is the one place a disabled account still appears', () => {
    assert.truthy(read('functions/api/admin/users.js').includes('u.disabled'));
    assert.truthy(read('admin.html').includes('act-disable'));
    assert.truthy(read('functions/api/admin/user-flags.js').includes('self_disable'),
      'an admin cannot lock themselves out');
    // The list no longer reports the cut per-user switches, and the console
    // no longer draws a status from them.
    assert.falsy(/allow_bot|allow_chuyen|exam_count/.test(read('functions/api/admin/users.js')));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
