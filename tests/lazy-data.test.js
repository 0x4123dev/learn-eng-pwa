// Startup weight: the app used to hand the device 9.4 MB of JavaScript across
// 75 files before it would paint anything — and 4.7 MB of that was question
// data for two tabs the child had not opened. On an older iPad that is seconds
// of parsing on EVERY app open, plus the memory to hold it all.
//
// The heaviest banks now load on demand (and warm in the background right
// after the first paint). These tests pin the contract so a future "just add
// one more script tag" cannot quietly put the weight back.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sizeKB = p => Math.round(fs.statSync(path.join(root, p)).size / 1024);

const html = read('index.html');
const eagerScripts = (html.match(/src="js\/[^"]+"/g) || []).map(s => s.slice(5, -1));

suite('startup weight: the biggest banks are not in the first paint', () => {
  test('the two giant question banks are no longer eager scripts', () => {
    for (const f of ['js/grammar-units.js', 'js/exam-data.js']) {
      assert.falsy(eagerScripts.includes(f),
        f + ' (' + sizeKB(f) + ' KB) must not block the first paint');
    }
  });

  test('startup JavaScript stays under 5 MB', () => {
    const total = eagerScripts.reduce((n, f) => {
      try { return n + fs.statSync(path.join(root, f)).size; } catch (e) { return n; }
    }, 0);
    const mb = total / 1048576;
    assert.truthy(mb < 5, 'eager JS is ' + mb.toFixed(1) + ' MB across ' + eagerScripts.length + ' files');
  });

  test('every deferred bank is still cached for offline use', () => {
    const sw = read('sw.js');
    const lazy = read('js/lazy-data.js');
    for (const f of (lazy.match(/'js\/[a-z0-9-]+\.js'/g) || []).map(s => s.slice(1, -1))) {
      assert.truthy(sw.includes("'/" + f + "'"), f + ' must stay in the service-worker cache');
    }
  });

  test('a deferred file is never ALSO an eager script (it would load twice)', () => {
    const lazy = read('js/lazy-data.js');
    for (const f of (lazy.match(/'js\/[a-z0-9-]+\.js'/g) || []).map(s => s.slice(1, -1))) {
      assert.falsy(eagerScripts.includes(f), f + ' is listed both eagerly and lazily');
    }
  });
});

suite('lazy data loader: loads once, on demand, and survives failure', () => {
  function mount() {
    const injected = [];
    const doc = {
      head: { appendChild(node) { injected.push(node); } },
      createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; }, async: true }),
      querySelector: () => null,
    };
    const ctx = { document: doc, console, Promise, Object, Array, JSON, String, Number,
      setTimeout: fn => fn(), requestIdleCallback: null };
    ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read('js/lazy-data.js') + '\n;globalThis.LazyData = LazyData;', ctx,
      { filename: 'js/lazy-data.js' });
    return { ctx, injected, finish: (ok) => injected.forEach(n => ok === false ? n.onerror && n.onerror() : n.onload && n.onload()) };
  }

  test('a screen with no lazy data is ready immediately', () => {
    const { ctx } = mount();
    assert.truthy(ctx.LazyData.ready('homeScreen'), 'Home must never wait on a download');
  });

  test('opening a lazy screen injects its scripts exactly once', () => {
    const m = mount();
    const p1 = m.ctx.LazyData.ensure('grammarScreen');
    const firstCount = m.injected.length;
    assert.truthy(firstCount >= 1, 'the bank is fetched on first open');
    m.finish(true);
    return p1.then(() => {
      assert.truthy(m.ctx.LazyData.ready('grammarScreen'), 'it is ready once loaded');
      return m.ctx.LazyData.ensure('grammarScreen').then(() => {
        assert.equal(m.injected.length, firstCount, 'a second visit must not re-download');
      });
    });
  });

  test('a failed download resolves rather than hanging the tab forever', () => {
    const m = mount();
    const p = m.ctx.LazyData.ensure('examScreen');
    m.finish(false);
    return p.then(() => assert.truthy(true, 'the promise settles even on error'));
  });

  test('every lazy screen names a screen the app actually has', () => {
    const app = read('js/app.js'), lazy = read('js/lazy-data.js');
    const screens = Object.keys(JSON.parse(JSON.stringify(
      (function () { const m = {}; for (const s of lazy.match(/([a-zA-Z]+Screen):\s*\[/g) || []) m[s.split(':')[0]] = 1; return m; })())));
    assert.truthy(screens.length >= 2, 'at least the two giants are deferred');
    for (const s of screens) {
      assert.truthy(html.includes('id="' + s + '"'), s + ' is not a real screen');
      assert.truthy(app.includes("'" + s + "'"), s + ' must be handled by switchScreen');
    }
  });
});

suite('startup weight: switchScreen waits for a tab\'s data', () => {
  test('switchScreen renders a lazy tab only after its bank has arrived', () => {
    const app = read('js/app.js');
    assert.truthy(app.includes('LazyData'), 'switchScreen must consult the loader');
    // The render for a deferred tab has to run in the loader's callback,
    // otherwise the child meets an empty question bank.
    assert.truthy(/LazyData\.ensure\([^)]*\)\s*\.then/.test(app),
      'the tab render must be deferred until the data lands');
  });
  test('grammar is entered through switchScreen, not a bare inline render', () => {
    // index.html used to call renderGrammarHome() inline right after
    // switchScreen, which would paint an empty bank before the data arrived.
    assert.falsy(/switchScreen\('grammarScreen'\);\s*renderGrammarHome\(\)/.test(html),
      'the inline render bypasses the loader');
    assert.truthy(read('js/app.js').includes('grammarScreen'), 'switchScreen owns the grammar render');
  });
});

suite('startup weight: a half-finished lesson still comes back', () => {
  // restoreStudyCheckpoint reopens the exact question the child was on when
  // the app was last closed. For a Grammar or Exam checkpoint that needs the
  // deferred bank — restoring before it lands would reopen an empty question.
  const { loadAppCode } = require('./setup');

  function withCheckpoint(kind, lazyReady) {
    const ensured = [];
    let resolveLoad;
    const app = loadAppCode({ extraGlobals: {
      LazyData: {
        filesFor: s => (s === 'grammarScreen' || s === 'examScreen') ? ['x.js'] : [],
        ready: () => lazyReady,
        ensure: s => { ensured.push(s); return new Promise(r => { resolveLoad = r; }); },
        warmSoon() {}, warmAll() { return Promise.resolve(); },
      },
      renderGrammarQuestion() { rendered.push('grammar'); },
      renderExamQuestion() { rendered.push('exam'); },
      activateCheckpointScreen() {},
    } });
    const rendered = [];
    app.__setCurrentUser('Kid');
    app.localStorage.setItem('flashlingo-study-checkpoint-v1', JSON.stringify({
      user: 'Kid', savedAt: Date.now(), kind, screen: kind + 'Screen', state: { idx: 0, answers: [] },
    }));
    return { app, ensured, rendered, finishLoad: () => resolveLoad && resolveLoad() };
  }

  test('a Grammar checkpoint waits for its bank instead of reopening an empty question', () => {
    const t = withCheckpoint('grammar', false);
    try { t.app.restoreStudyCheckpoint(); } catch (e) { /* render stubs may be partial */ }
    assert.contains(t.ensured, 'grammarScreen',
      'the restore must ask the loader for the grammar bank first');
  });

  test('with the bank already in, the restore happens immediately', () => {
    const t = withCheckpoint('grammar', true);
    try { t.app.restoreStudyCheckpoint(); } catch (e) {}
    assert.deepEqual(t.ensured, [], 'a warm bank needs no waiting');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
