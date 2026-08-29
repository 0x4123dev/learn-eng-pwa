// lazy-data.js — keep the heaviest question banks OUT of the first paint.
//
// The app used to hand the device 9.4 MB of JavaScript in 75 <script> tags
// before it could show anything, and 4.7 MB of that was the Grammar and Exam
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
// Each bank declares a top-level `const` (GRAMMAR_UNITS, EXAMS, …). Every tab
// already reads those through a `typeof X !== 'undefined'` guard, so a bank
// that has not arrived yet degrades to an empty list rather than an error —
// which is what makes deferring them safe.
var LazyData = (() => {
  'use strict';

  // screen id → the banks that screen cannot render without.
  const SCREEN_FILES = Object.freeze({
    grammarScreen: ['js/grammar-units.js', 'js/grammar-lessons.js'],
    examScreen: ['js/exam-data.js', 'js/exam-lessons.js'],
  });

  const loaded = Object.create(null);   // file → true once it has run
  const inFlight = Object.create(null); // file → Promise

  function filesFor(screenId) { return SCREEN_FILES[screenId] || []; }

  // A bank that fails to download must not leave the tab spinning forever:
  // resolve either way and let the tab render what it has. The service worker
  // keeps these files cached, so a repeat visit works offline.
  function loadFile(file) {
    if (loaded[file]) return Promise.resolve();
    if (inFlight[file]) return inFlight[file];
    inFlight[file] = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = file;
      script.async = false;            // banks must run in the order listed
      script.onload = () => { loaded[file] = true; resolve(); };
      script.onerror = () => { console.warn('lazy bank failed', file); resolve(); };
      document.head.appendChild(script);
    });
    return inFlight[file];
  }

  function ready(screenId) {
    return filesFor(screenId).every(f => loaded[f]);
  }

  function ensure(screenId) {
    const files = filesFor(screenId);
    if (!files.length) return Promise.resolve();
    return Promise.all(files.map(loadFile));
  }

  // Fetch every deferred bank once the app is interactive. Kept off the
  // critical path but NOT postponed indefinitely: a child who opens Grammar
  // ten seconds in should find it already there.
  let warmed = false;
  function warmAll() {
    if (warmed) return Promise.resolve();
    warmed = true;
    const all = [];
    for (const screenId of Object.keys(SCREEN_FILES)) all.push.apply(all, SCREEN_FILES[screenId]);
    return all.reduce((chain, file) => chain.then(() => loadFile(file)), Promise.resolve());
  }
  function warmSoon() {
    const go = () => warmAll();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 800);
  }

  return { SCREEN_FILES, ensure, ready, warmAll, warmSoon, filesFor };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LazyData;
