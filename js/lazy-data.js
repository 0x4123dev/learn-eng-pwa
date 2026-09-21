// lazy-data.js — keep the heaviest question banks OUT of the first paint.
//
// The app used to hand the device 9.4 MB of JavaScript in 75 <script> tags
// before it could show anything, and 4.7 MB of that was two question banks
// banks — data for tabs the child had not opened. On an older iPad that is
// seconds of parsing on EVERY app open, plus the memory to hold it all
// resident. It is the single biggest reason the app felt heavier over time.
//
// Now those banks load in two ways, whichever comes first:
//   • on demand — switchScreen awaits the tab's data before rendering it, so
//     a child never meets an empty question list;
//   • warm-up — right after the first paint the same files are fetched in the
//     background, so by the time anyone taps a tab they are usually already in.
//
// Each bank declares a top-level `const` (UNIT_WORDS_PR1, …). Every tab
// already reads those through a `typeof X !== 'undefined'` guard, so a bank
// that has not arrived yet degrades to an empty list rather than an error —
// which is what makes deferring them safe.
var LazyData = (() => {
  'use strict';

  // screen id → the banks that screen cannot render without.
  //
  // A `.css` entry is a feature stylesheet (css/night-raid.css, css/arena.css,
  // css/night-raid.css). css/styles.css was one 664 kB render-blocking file, and
  // ~38% of it styled screens Home never shows; those rules now ride in here
  // and are appended as <link rel="stylesheet"> the same way a bank is
  // appended as <script>. switchScreen keeps the screen's content invisible
  // until a pending stylesheet has arrived (js/app.js, `.lazy-css-pending`),
  // so a child never sees it unstyled. The service worker precaches every
  // file listed here, so offline is unaffected — only WHEN it is parsed changed.
  const SCREEN_FILES = Object.freeze({
    // The three Book tabs share wordScreen: the Career Paths bank. Its rules
    // live in css/styles.css, so only the bank is deferred.
    wordScreen: ['js/word-data.js'],
    // Nông trại: the farm screen's stylesheet; its code is the `farm` group.
    nightRaidScreen: ['css/night-raid.css'],
  });

  // CODE, not data: the farm screen's own script does not load at startup.
  // Before 2026-09-11 index.html loaded 68 files (2.3 MB) before Home could
  // draw; the Arena and the Math tab were most of it, and they are gone now,
  // but the same loader keeps the farm (js/night-raid.js, ~60 kB) off the
  // first paint. Every startup-side reference to a name defined here is
  // guarded with `typeof X !== 'undefined'`; js/app.js `lazyEntry` makes
  // openNightRaid safe to tap before the group has landed.
  const GROUP_FILES = Object.freeze({
    farm: ['js/farm-art-manifest.js', 'js/night-raid.js'],
  });

  // screen id → the code group that screen cannot open without. filesFor()
  // puts the group's files IN FRONT of the screen's banks, so every road that
  // already waits for a screen — switchScreen, DailyTask.go, the study
  // checkpoint, the verify layer — waits for its code too, with no second
  // mechanism to remember. Code first, banks second.
  const SCREEN_GROUPS = Object.freeze({
    nightRaidScreen: 'farm',
  });

  // The offline dictionary belongs to no single screen — a child can tap any
  // word anywhere — so it is fetched the first time one is actually tapped.
  const DICTIONARY = ['js/dictionary-data.js'];

  const loaded = Object.create(null);   // file → true once it has run
  const inFlight = Object.create(null); // file → Promise

  function filesFor(key) {
    const code = SCREEN_GROUPS[key] ? GROUP_FILES[SCREEN_GROUPS[key]] : [];
    return code.concat(SCREEN_FILES[key] || GROUP_FILES[key] || []);
  }
  function groupFor(screenId) { return SCREEN_GROUPS[screenId] || null; }

  // A bank that fails to download must not leave the tab spinning forever:
  // resolve either way and let the tab render what it has. The service worker
  // keeps these files cached, so a repeat visit works offline.
  function loadFile(file) {
    if (loaded[file]) return Promise.resolve();
    if (inFlight[file]) return inFlight[file];
    inFlight[file] = new Promise(resolve => {
      let el;
      if (/\.css$/.test(file)) {
        // A feature stylesheet. Appended AFTER css/styles.css, so in the
        // cascade its rules come last — the split (tests/css-split.test.js)
        // only moved rules whose selectors no core rule shares.
        el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = file;
      } else {
        el = document.createElement('script');
        el.src = file;
        el.async = false;              // banks must run in the order listed
      }
      const script = el;
      script.onload = () => {
        loaded[file] = true;
        // A lazy code group brings its own start* functions (startMathExam,
        // startWarsRound…); the history clock wraps them the moment they exist.
        if (typeof ActivityClock !== 'undefined' && /\.js$/.test(file)) ActivityClock.hook();
        resolve();
      };
      script.onerror = () => {
        console.warn('lazy bank failed', file);
        // Forget the failed attempt. Leaving the resolved promise in
        // `inFlight` meant ONE Wi-Fi hiccup on the first visit to a tab left
        // that tab empty for the whole session: ensure() kept handing back the
        // same settled promise and never appended a second <script>.
        delete inFlight[file];
        resolve();
      };
      document.head.appendChild(script);
    });
    return inFlight[file];
  }

  function ready(screenId) {
    return filesFor(screenId).every(f => loaded[f]);
  }
  // The stylesheets a screen still waits for. switchScreen hides the screen's
  // content until this is empty, so a lazily styled tab never paints naked.
  function pendingCss(screenId) {
    return filesFor(screenId).filter(f => /\.css$/.test(f) && !loaded[f]);
  }

  function ensure(screenId) {
    const files = filesFor(screenId);
    if (!files.length) return Promise.resolve();
    rememberTab(screenId);
    return Promise.all(files.map(loadFile));
  }

  // Warm ONLY the tab this child came back to.
  //
  // Warming every bank in the background still made an old iPad parse and hold
  // ~7.6 MB it might never need — the weight simply moved a second later. The
  // service worker precaches all of these files at install, so OFFLINE never
  // depended on the warm-up; only speed did. So remember the last tab opened
  // and have that one ready, and let the rest be read from the cache the
  // moment they are actually asked for.
  const LAST_TAB_KEY = 'flashlingo-last-tab';
  function rememberTab(screenId) {
    if (!SCREEN_FILES[screenId] && !SCREEN_GROUPS[screenId]) return;
    try { localStorage.setItem(LAST_TAB_KEY, screenId); } catch (e) {}
  }
  function lastTab() {
    try { const v = localStorage.getItem(LAST_TAB_KEY); return (SCREEN_FILES[v] || SCREEN_GROUPS[v]) ? v : null; }
    catch (e) { return null; }
  }
  let warmed = false;
  function warmAll() {
    if (warmed) return Promise.resolve();
    warmed = true;
    const screenId = lastTab();
    if (!screenId) return Promise.resolve();
    return filesFor(screenId).reduce(
      (chain, file) => chain.then(() => loadFile(file)), Promise.resolve());
  }
  function warmSoon() {
    const go = () => warmAll();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 800);
  }

  function ensureDictionary() { return Promise.all(DICTIONARY.map(loadFile)); }
  function dictionaryReady() { return DICTIONARY.every(f => loaded[f]); }

  return { SCREEN_FILES, GROUP_FILES, SCREEN_GROUPS, DICTIONARY, ensure, ready, pendingCss, warmAll, warmSoon,
    filesFor, groupFor, ensureDictionary, dictionaryReady };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LazyData;
