// A background app update or an iOS memory reload must never look like logout.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

suite('session continuity: a reload is not a logout', () => {
  test('the active profile survives a reload and a recent unfinished exercise survives an iOS process restart', () => {
    assert.truthy(app.includes("const ACTIVE_USER_KEY = 'flashlingo-active-user'"));
    assert.truthy(app.includes('localStorage.setItem(ACTIVE_USER_KEY, username)'),
      'the signed-in profile must survive an app restart, not just a reload');
    assert.falsy(app.includes('sessionStorage.setItem(ACTIVE_USER'),
      'sessionStorage would log the child out at every app restart');
    assert.truthy(app.includes('localStorage.getItem(STUDY_CHECKPOINT_KEY)'));
    assert.truthy(app.includes('localStorage.setItem(STUDY_CHECKPOINT_KEY, JSON.stringify(checkpoint))'));
    assert.truthy(app.includes('STUDY_CHECKPOINT_MAX_AGE'));
    assert.truthy(app.includes('const resumeUser = rememberedActiveUser()'));
    assert.truthy(app.includes('if (resumeUser) loginUser(resumeUser)'));
  });

  test('explicit Switch user still ends the remembered session', () => {
    const start = app.indexOf('function switchUser()');
    const end = app.indexOf('function showDeleteModal', start);
    const body = app.slice(start, end);
    assert.truthy(body.includes('rememberActiveUser(null)'));
  });

  test('unfinished work checkpoints the one practice family left, and drops any other kind', () => {
    // The Book practice (js/units.js) on the Word screen is the only exercise
    // the app has; a checkpoint of anything else (an older build's grammar
    // quiz, a maths round) is dropped rather than restored onto a screen that
    // no longer exists.
    const build = app.slice(app.indexOf('function buildStudyCheckpoint()'), app.indexOf('function saveStudyCheckpoint()'));
    assert.deepEqual([...build.matchAll(/kind:\s*'(\w+)'/g)].map(m => m[1]), ['units'], 'the kinds the checkpoint builds');
    const restore = app.slice(app.indexOf('function restoreStudyCheckpoint()'), app.indexOf('function startStudyCheckpointing()'));
    assert.truthy(restore.includes("if (checkpoint.kind !== 'units' || checkpoint.screen !== 'wordScreen') {"), 'restore accepts only the Book practice');
    const dropAt = restore.indexOf("checkpoint.kind !== 'units'");
    assert.truthy(restore.slice(dropAt, dropAt + 400).includes('clearStudyCheckpoint();'), 'any other kind is cleared, not kept');
    assert.truthy(restore.includes("LazyData.ready('wordScreen')"), 'it waits for the lazy word bank before redrawing');
    assert.truthy(restore.includes('renderUnitQuestion();'), 'and redraws the question');
    // Saved on change, not on a clock: tests/study-checkpoint-on-change.test.js
    // executes the answer, typing, hidden and end-of-round paths.
    assert.falsy(/setInterval\(\s*saveStudyCheckpoint/.test(app), 'the once-a-second saver must not come back');
    assert.truthy(app.includes("document.addEventListener('click', scheduleStudyCheckpoint, true)"));
    assert.truthy(app.includes("document.addEventListener('input', scheduleDraftCheckpoint, true)"));
    assert.truthy(app.includes("window.addEventListener('pagehide', saveStudyCheckpoint)"));
    assert.truthy(app.includes("window.addEventListener('beforeunload', saveStudyCheckpoint)"));
    assert.truthy(app.includes("document.addEventListener('visibilitychange'"));
  });

  test('typed but unsubmitted answers survive', () => {
    assert.truthy(app.includes("active.querySelectorAll('input[id],textarea[id]')"));
    assert.truthy(app.includes("restoreDraftInputs(checkpoint.drafts)"));
  });

  test('a service-worker update reloads automatically only from the safe idle path', () => {
    const start = app.indexOf('function registerServiceWorker()');
    const end = app.indexOf('function formatDate', start);
    const body = app.slice(start, end);
    assert.truthy(body.includes("addEventListener('controllerchange'"));
    // A reload only happens after applyUpdateWhenSafe checked every activity
    // and asked the waiting worker to take over.
    for (const m of body.match(/[^\n]*location\.reload[^\n]*/g) || []) {
      assert.truthy(/_updateReloading/.test(m), 'a reload must be gated on safe activation: ' + m.trim());
    }
    const apply = app.slice(app.indexOf('function applyUpdateWhenSafe('), start);
    assert.equal((apply.match(/_updateReloading = true/g) || []).length, 1,
      'exactly one place arms the reload');
    const busyAt = apply.indexOf('_busyWithTimedActivity()');
    const armAt = apply.indexOf('_updateReloading = true');
    assert.truthy(busyAt >= 0 && armAt >= 0 && busyAt < armAt,
      'the activity guard must run before the reload is armed');
    assert.falsy(/setTimeout\([^)]*location\.reload/.test(apply),
      'a timeout must never reload back into the same waiting worker');
    // The worker still never takes over by itself.
    const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
    assert.falsy(/skipWaiting/.test(install));
    assert.truthy(/type === 'SKIP_WAITING'\) self\.skipWaiting\(\)/.test(sw),
      'the only skipWaiting is the one the page asks for');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
