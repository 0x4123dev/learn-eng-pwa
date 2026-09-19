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
    for (const f of ['js/grammar-units.js', 'js/ptnk-data.js', 'js/word-data.js', 'js/collocation-data.js',
      'js/phrases-data.js', 'js/wordform-data.js', 'js/wordform-followups.js',
      'js/collocation-followups.js', 'js/math-exams.js', 'js/math-data.js',
      'js/rewrite-data.js', 'js/dictionary-data.js']) {
      assert.falsy(eagerScripts.includes(f),
        f + ' (' + sizeKB(f) + ' KB) must not block the first paint');
    }
  });

  test('startup JavaScript stays under 2.5 MB', () => {
    const total = eagerScripts.reduce((n, f) => {
      try { return n + fs.statSync(path.join(root, f)).size; } catch (e) { return n; }
    }, 0);
    const mb = total / 1048576;
    assert.truthy(mb < 2.5, 'eager JS is ' + mb.toFixed(1) + ' MB across ' + eagerScripts.length + ' files');
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
    const store = {};
    const ctx = { document: doc, console, Promise, Object, Array, JSON, String, Number,
      setTimeout: fn => fn(), requestIdleCallback: null,
      localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
    ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read('js/lazy-data.js') + '\n;globalThis.LazyData = LazyData;', ctx,
      { filename: 'js/lazy-data.js' });
    return { ctx, injected, store, finish: (ok) => injected.forEach(n => ok === false ? n.onerror && n.onerror() : n.onload && n.onload()) };
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
    const p = m.ctx.LazyData.ensure('wordScreen');
    m.finish(false);
    return p.then(() => assert.truthy(true, 'the promise settles even on error'));
  });

  test('every lazy screen names a screen the app actually has', () => {
    const app = read('js/app.js'), lazy = read('js/lazy-data.js');
    const screens = Object.keys(JSON.parse(JSON.stringify(
      (function () { const m = {}; for (const s of lazy.match(/([a-zA-Z]+Screen):\s*\[/g) || []) m[s.split(':')[0]] = 1; return m; })())));
    assert.truthy(screens.length >= 2, 'at least the two giants are deferred');
    // Kho Khiên & Kiếm builds its own #armoryScreen at runtime (js/armory.js)
    // rather than shipping an empty <div> in index.html.
    const runtimeScreens = { armoryScreen: read('js/armory.js') };
    for (const s of screens) {
      const made = html.includes('id="' + s + '"') || (runtimeScreens[s] || '').includes("'" + s + "'");
      assert.truthy(made, s + ' is not a real screen');
      assert.truthy(app.includes(s), s + ' must be known to switchScreen / the bottom nav');
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
  // the app was last closed. For a Grammar or PTNK exam checkpoint that needs the
  // deferred bank — restoring before it lands would reopen an empty question.
  const { loadAppCode } = require('./setup');

  function withCheckpoint(kind, lazyReady) {
    const ensured = [];
    let resolveLoad;
    const app = loadAppCode({ extraGlobals: {
      LazyData: {
        filesFor: s => (s === 'grammarScreen' || s === 'ptnkScreen') ? ['x.js'] : [],
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

suite('startup weight: phase two — every tab bank is deferred', () => {
  const lazy = read('js/lazy-data.js');
  const SCREENS = {
    phrasesScreen: ['js/phrases-data.js', 'js/phrases-meanings.js',
                    'js/collocation-data.js', 'js/collocation-followups.js'],
    wordformScreen: ['js/wordform-data.js', 'js/wordform-followups.js', 'js/wordform-lessons.js'],
    rewriteScreen: ['js/rewrite-data.js', 'js/rewrite-lessons.js'],
    mathHubScreen: ['js/math-data.js', 'js/math-exams.js', 'js/math-lessons.js'],
  };
  for (const [screen, files] of Object.entries(SCREENS)) {
    test(screen + ' owns its banks in the loader', () => {
      const block = lazy.slice(lazy.indexOf(screen + ':'));
      const list = block.slice(0, block.indexOf(']'));
      for (const f of files) {
        assert.truthy(list.includes(f), screen + ' must defer ' + f);
        assert.falsy(eagerScripts.includes(f), f + ' must not also be an eager script');
      }
    });
  }

  test('no tab is entered by an inline render that skips the loader', () => {
    // index.html used to call renderPhrasesHome() / renderWordformHome() /
    // renderRewriteHome() inline right after switchScreen — which would paint
    // an empty bank before the data arrived.
    for (const fn of ['renderPhrasesHome', 'renderWordformHome', 'renderRewriteHome', 'renderGrammarHome']) {
      assert.falsy(new RegExp('switchScreen\\([^)]*\\);\\s*' + fn + '\\(\\)').test(html),
        fn + '() inline bypasses the lazy loader');
    }
  });

  test('switchScreen can paint every deferred tab once its bank lands', () => {
    const app = read('js/app.js');
    for (const r of ['renderPhrasesHome', 'renderWordformHome', 'renderRewriteHome',
                     'renderMathHome', 'renderGrammarHome', 'renderPtnkHome', 'renderWordHome']) {
      assert.truthy(app.includes(r), 'switchScreen must be able to render ' + r);
    }
  });

  test('a half-finished practice in ANY deferred tab waits for its bank', () => {
    const app = read('js/app.js');
    const map = app.slice(app.indexOf('const needsBank'), app.indexOf('const needsBank') + 400);
    for (const kind of ['grammar', 'exam', 'phrases', 'collocation', 'wordform', 'rewrite', 'math']) {
      assert.truthy(map.includes(kind + ':'), 'checkpoint kind "' + kind + '" must name its screen');
    }
  });

  test('the offline dictionary loads on the first tapped word, not at startup', () => {
    assert.falsy(eagerScripts.includes('js/dictionary-data.js'),
      'the 352 KB dictionary must not block the first paint');
    const tw = read('js/tapwords.js');
    assert.truthy(tw.includes('LazyData'), 'tapWord must fetch the dictionary on demand');
    assert.truthy(/dictionary-data\.js/.test(lazy) || /dictionary-data\.js/.test(tw),
      'the dictionary file must be named somewhere in the lazy path');
  });
});

suite('startup weight: the device only carries the tabs it actually uses', () => {
  // Warming EVERY bank in the background still made an old iPad parse and hold
  // ~7.6 MB it might never need. The service worker already precaches all of
  // them, so offline never depended on that warm-up — only speed did. Warm the
  // one tab the child came back to; fetch the rest from the cache on demand.
  function mountLoader(lastTab) {
    const injected = [];
    const store = lastTab ? { 'flashlingo-last-tab': lastTab } : {};
    const doc = {
      head: { appendChild(n) { injected.push(n); setTimeout(() => n.onload && n.onload(), 0); } },
      createElement: () => ({ src: '', async: true }),
    };
    const ctx = { document: doc, console, Promise, Object, Array, JSON, String, Number,
      setTimeout: fn => fn(), requestIdleCallback: null,
      localStorage: { getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
    ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read('js/lazy-data.js') + '\n;globalThis.LazyData = LazyData;', ctx,
      { filename: 'js/lazy-data.js' });
    return { ctx, injected, store };
  }

  test('warm-up loads ONLY the tab the child used last', () => {
    const m = mountLoader('mathHubScreen');
    return m.ctx.LazyData.warmAll().then(() => {
      // A bank is a <script src>, the tab's stylesheet a <link href>.
      const files = m.injected.map(n => n.src || n.href);
      assert.truthy(files.length > 0, 'the remembered tab is warmed');
      assert.truthy(files.every(f => f.indexOf('math') !== -1),
        'only the maths banks may be warmed, got: ' + files.join(', '));
      assert.falsy(files.some(f => f.indexOf('grammar-units') !== -1),
        'a tab the child never opens must not be parsed at all');
    });
  });

  test('a child with no history warms nothing — every bank waits to be asked', () => {
    const m = mountLoader(null);
    return m.ctx.LazyData.warmAll().then(() => {
      assert.equal(m.injected.length, 0, 'nothing is loaded speculatively');
    });
  });

  test('opening a tab remembers it for next time', () => {
    const m = mountLoader(null);
    return m.ctx.LazyData.ensure('rewriteScreen').then(() => {
      assert.equal(m.store['flashlingo-last-tab'], 'rewriteScreen');
    });
  });

  test('offline never depended on the warm-up: the SW precaches every bank', () => {
    const sw = read('sw.js');
    const lazy = read('js/lazy-data.js');
    for (const f of (lazy.match(/'js\/[a-z0-9-]+\.js'/g) || []).map(s => s.slice(1, -1))) {
      assert.truthy(sw.includes("'/" + f + "'"), f + ' must be precached');
    }
    // install no longer uses cache.addAll: one failing entry out of 153 used to
    // reject the WHOLE install, and registerServiceWorker swallowed it, so a
    // single renamed sprite left every device on the previous worker for good.
    // It is best-effort now — but it must still attempt every ASSETS entry.
    assert.truthy(/ASSETS\.map\(async url =>/.test(sw), 'install must precache them all');
    assert.truthy(/event\.waitUntil\(precache\(\)/.test(sw), 'and install must wait for it');
  });
});
