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

  test('unfinished work checkpoints every practice family', () => {
    for (const kind of ['grammar','phrases','wordform','rewrite','collocation','units','math','mathwars','exam','verbs','lesson']) {
      assert.truthy(app.includes("kind:'" + kind + "'"), 'checkpoint missing ' + kind);
      assert.truthy(app.includes("checkpoint.kind === '" + kind + "'"), 'restore missing ' + kind);
    }
    assert.truthy(app.includes("setInterval(saveStudyCheckpoint, 1000)"));
    assert.truthy(app.includes("window.addEventListener('pagehide', saveStudyCheckpoint)"));
    assert.truthy(app.includes("document.addEventListener('visibilitychange'"));
  });

  test('typed but unsubmitted answers and matched pairs survive', () => {
    assert.truthy(app.includes("active.querySelectorAll('input[id],textarea[id]')"));
    assert.truthy(app.includes("restoreDraftInputs(checkpoint.drafts)"));
    assert.truthy(app.includes(".match-card:not(.matched)"));
  });

  test('a service-worker update never reloads the page on its own', () => {
    // The invariant is the same one, restated for the fix: an update must
    // never take the page out from under a child. What changed is that the
    // child is now ASKED — waiting silently was its own bug, because
    // `controllerchange` cannot fire while the page that registered the
    // listener is still open, so a PWA parked in the app switcher downloaded
    // every update and applied none of them.
    const start = app.indexOf('function registerServiceWorker()');
    const end = app.indexOf('function formatDate', start);
    const body = app.slice(start, end);
    assert.truthy(body.includes("addEventListener('controllerchange'"));
    // A reload only ever happens behind the `_updateReloading` flag, which is
    // set in one place: the click handler on the "Tải bản mới" button.
    for (const m of body.match(/[^\n]*location\.reload[^\n]*/g) || []) {
      assert.truthy(/_updateReloading/.test(m), 'a reload must be gated on the tap: ' + m.trim());
    }
    const offer = app.slice(app.indexOf('function offerUpdate('), start);
    assert.equal((offer.match(/_updateReloading = true/g) || []).length, 1,
      'exactly one place arms the reload');
    // indexOf returns -1 when a string is gone, and -1 is less than every
    // index — so an ordering assertion proves nothing until both sides exist.
    const clickAt = offer.indexOf("addEventListener('click'");
    const armAt = offer.indexOf('_updateReloading = true');
    assert.truthy(clickAt >= 0, 'the banner must wire a click handler');
    assert.truthy(armAt >= 0, 'and that handler is the only thing that arms the reload');
    assert.truthy(clickAt < armAt, 'and it is inside the click handler');
    // The worker still never takes over by itself.
    const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
    assert.falsy(/skipWaiting/.test(install));
    assert.truthy(/type === 'SKIP_WAITING'\) self\.skipWaiting\(\)/.test(sw),
      'the only skipWaiting is the one the page asks for');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
