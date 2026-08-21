// A disabled account must vanish everywhere except the admin site: it cannot
// log in, its token dies on the next request, and no child-facing endpoint may
// list it, find it by name, fight it, or show its raids. These tests pin every
// one of those doors by reading the server source the way the sync harness
// pins other Functions contracts.
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

  test('the friends list hides a disabled account on both sides of a friendship', () => {
    const src = read('functions/api/friends/index.js');
    assert.truthy(src.includes('ru.disabled = 0'), 'requester side must be filtered');
    assert.truthy(src.includes('au.disabled = 0'), 'addressee side must be filtered');
  });

  test('a disabled account cannot be found by name to befriend', () => {
    // Same 404 as a name that never existed — login is already careful not to
    // reveal which usernames exist, and search must not become that oracle.
    const src = read('functions/api/friends/index.js');
    assert.truthy(/username = \? AND disabled = 0/.test(src));
  });

  test('peeking at a disabled account\'s study activity 404s', () => {
    assert.truthy(read('functions/api/friends/activity.js').includes('AND disabled = 0'));
  });

  test('a pending invite from a freshly disabled account cannot be accepted', () => {
    const src = read('functions/api/friends/respond.js');
    assert.truthy(/disabled/.test(src), 'respond must re-check the requester');
  });

  test('a disabled friend cannot be challenged to battle by a stale client', () => {
    assert.truthy(/disabled/.test(read('functions/api/battle/challenge.js')));
  });

  test('night raid never offers, raids, or reports a disabled account', () => {
    assert.truthy(read('functions/api/night-raid/targets.js').includes('u.disabled=0'));
    assert.truthy(read('functions/api/night-raid/start.js').includes('u.disabled=0'));
    assert.truthy(read('functions/api/night-raid/reports.js').includes('u.disabled=0'));
  });

  test('the admin site is the one place a disabled account still appears', () => {
    assert.truthy(read('functions/api/admin/users.js').includes('u.disabled'));
    assert.truthy(read('admin.html').includes('act-disable'));
    assert.truthy(read('functions/api/admin/user-flags.js').includes('self_disable'),
      'an admin cannot lock themselves out');
  });
});
