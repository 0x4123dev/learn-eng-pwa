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
  //
  // A `.css` entry is a feature stylesheet (css/night-raid.css, css/arena.css,
  // css/math.css). css/styles.css was one 664 kB render-blocking file, and
  // ~38% of it styled screens Home never shows; those rules now ride in here
  // and are appended as <link rel="stylesheet"> the same way a bank is
  // appended as <script>. switchScreen keeps the screen's content invisible
  // until a pending stylesheet has arrived (js/app.js, `.lazy-css-pending`),
  // so a child never sees it unstyled. The service worker precaches every
  // file listed here, so offline is unaffected — only WHEN it is parsed changed.
  const SCREEN_FILES = Object.freeze({
    grammarScreen: ['js/grammar-units.js', 'js/grammar-lessons.js'],
    // The real PTNK entrance papers, on the timed-paper engine (js/exam.js).
    ptnkScreen: ['js/ptnk-data.js'],
    // The three PTNK-format practice menus (js/practice-sets.js), one bank each.
    readingScreen: ['js/reading-data.js'],
    clozeScreen: ['js/cloze-data.js'],
    errorsScreen: ['js/errors-data.js'],
    grammarVocabScreen: ['js/grammar-vocab-data.js'],
    phoneticsScreen: ['js/phonetics-data.js', 'js/phonetics-lessons.js'],
    // Collocation is a sub-tab of Phrases, so it shares that screen's banks.
    phrasesScreen: ['js/phrases-data.js', 'js/phrases-meanings.js',
                    'js/collocation-data.js', 'js/collocation-followups.js'],
    wordformScreen: ['js/wordform-data.js', 'js/wordform-followups.js', 'js/wordform-lessons.js'],
    rewriteScreen: ['js/rewrite-data.js', 'js/rewrite-lessons.js'],
    mathHubScreen: ['css/math.css',
                    'js/math-data.js', 'js/math-exams.js', 'js/math-lessons.js',
                    'js/math-luythua.js', 'js/math-source-exams.js',
                    'js/math-fight-bank.js', 'js/mathwars-bank.js',
                    'js/math4-data.js'],
    gradeFourScreen: ['css/math.css'],
    // The Word tab: Grade 4's engine on the Career Paths word bank.
    wordScreen: ['css/math.css', 'js/word-data.js'],
    // The Arena lobby mounts the Night Raid yard (NightRaid.mountYardScene),
    // so it needs both feature sheets; Kho Khiên & Kiếm (js/armory.js) is
    // styled with the Arena.
    petBattleScreen: ['css/arena.css', 'css/night-raid.css'],
    armoryScreen: ['css/arena.css'],
    nightRaidScreen: ['css/night-raid.css'],
  });

  // Banks that belong to a SECTION of a screen rather than the screen itself.
  // Học kì 2 of Toán 7 is ~3 MB — the 900-question bank, 10 mock exams and 30
  // real school papers — and it used to ride in the Math tab's group, so a
  // child opening Math for Toán 4 or Math Wars paid to parse all of it. Now
  // it lands when Học kì 2 (or an HK2 daily task, or an HK2 checkpoint) is
  // actually opened. Same loader, same "resolve even on failure" contract;
  // ensure()/ready()/filesFor() accept these keys exactly like a screen id.
  // The service worker still precaches every file here, so offline is
  // unaffected — only WHEN they are parsed changed.
  const GROUP_FILES = Object.freeze({
    mathHk2: ['js/math-data-hk2.js', 'js/math-exams-hk2.js',
              'js/math-lessons-hk2.js', 'js/math-source-exams-hk2.js'],
    // CODE, not data: the two tabs whose scripts are the bulk of what used to
    // block the first paint. Before 2026-09-11 index.html loaded 68 files
    // (2.3 MB) before Home could draw, and a full megabyte of that was the
    // Arena (pet battles, Cướp Đêm, Cúng Cô Hồn) and the Math tab — code a
    // child on Learn never runs. Each list is in the ORDER index.html loaded
    // them, because a later file may call an earlier one while it loads.
    // Every startup-side reference to a name defined here is guarded with
    // `typeof X !== 'undefined'`; js/app.js `lazyEntry` makes openPetBattle
    // and openNightRaid safe to tap before the group has landed.
    arena: ['js/battlecalc.js', 'js/battle-teammates.js', 'js/battle-camera.js',
            'js/battle-scenes.js', 'js/castle-skins.js', 'js/farm-art-manifest.js',
            'js/night-raid-choreo.js', 'js/night-raid-art.js', 'js/night-raid-game.js',
            'js/night-raid-ruins.js', 'js/night-raid-phaser.js', 'js/night-raid.js',
            'js/ghost-offering-schedule.js', 'js/ghost-offering-link.js',
            'js/ghost-offering-event.js', 'js/battlelink.js', 'js/petbattle.js',
            'js/petbattlegame.js'],
    math: ['js/math-glossary.js', 'js/math-figures.js', 'js/mathwars.js',
           'js/math-tables.js', 'js/math-fight-rules.js', 'js/math-fight.js',
           'js/math.js', 'js/math-copy.js', 'js/math-board.js'],
  });

  // screen id → the code group that screen cannot open without. filesFor()
  // puts the group's files IN FRONT of the screen's banks, so every road that
  // already waits for a screen — switchScreen, DailyTask.go, the study
  // checkpoint, the verify layer — waits for its code too, with no second
  // mechanism to remember. Code first, banks second — the order index.html
  // had when the code was eager and only the banks were deferred.
  const SCREEN_GROUPS = Object.freeze({
    petBattleScreen: 'arena',
    nightRaidScreen: 'arena',
    mathHubScreen: 'math',
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
