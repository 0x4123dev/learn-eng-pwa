// lazy-entry-points.test.js — a menu entry is never locked because the
// content behind it has not loaded yet.
//
// The bug this pins (2026-09-12): the Toán 7 menu drew its Học kì 2 card
// locked ("Sắp có — đang soạn nội dung") whenever the HK2 bank was not in
// memory. Once that bank became a lazy group fetched on entering HK2, the
// card that fetches HK2 was locked because HK2 was not fetched — for every
// child, on every first visit. Loading is a state that resolves; a lock is
// a state that does not. Menus must never express the first as the second.
//
// Two layers: (1) static — every lazy group has an ensure() call site, and no
// rendered template pairs `locked`/`disabled` with loading words; (2) executed
// — boot the app with NO lazy group loaded, open every menu, and assert every
// entry into lazily-loaded content is present and enabled.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));
const { mountApp, loginTestUser } = require('./verify/client.js');
const settle = (n) => new Promise(r => setTimeout(r, n || 30));

const JS = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !/-data|lessons|bank|phaser|dictionary|hot-words|vocabulary|grammar-units/.test(f));
const LOADING = /Đang tải|Sắp có|đang soạn|loading|Loading/;

suite('lazy entry points: static', () => {
  test('every lazy GROUP has at least one LazyData.ensure() call site — something can open it', () => {
    const src = JS.map(f => read('js/' + f)).join('\n');
    for (const key of Object.keys(lazy.GROUP_FILES)) {
      const direct = new RegExp("LazyData\\.ensure\\('" + key + "'\\)").test(src);
      // Screen-mapped groups (arena, math) are opened through switchScreen /
      // SCREEN_GROUPS rather than by name.
      const viaScreen = Object.values(lazy.SCREEN_GROUPS || {}).includes(key);
      assert.truthy(direct || viaScreen, 'no way in to lazy group ' + key);
    }
  });

  test('no rendered template draws a locked/disabled control whose text is about loading', () => {
    // A locked control may say WHY (owed questions, not unlocked yet); it may
    // not say "loading" — that is a placeholder's job, and placeholders redraw.
    const offenders = [];
    for (const f of JS) {
      const src = read('js/' + f);
      const re = /(locked|disabled aria-disabled)[^`]{0,400}?<\/button>/g;
      for (const m of src.matchAll(re)) {
        if (LOADING.test(m[0])) offenders.push(f + ': ' + m[0].replace(/\s+/g, ' ').slice(0, 120));
      }
    }
    assert.deepEqual(offenders, [], 'locked controls that talk about loading');
  });
});

suite('lazy entry points: executed with nothing lazy loaded', () => {
  async function boot() {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    return h;
  }
  const enabledButtons = (h, screenId) => h.el(screenId).querySelectorAll('button')
    .filter(b => !b.disabled && !b.classList.contains('locked'));
  const wired = (h, screenId, needle) => enabledButtons(h, screenId)
    .some(b => (b.getAttribute('onclick') || '').includes(needle));

  test('the Learn hub offers every lazy English screen, enabled', async () => {
    const h = await boot();
    h.sandbox.switchScreen('learnHubScreen'); await settle();
    for (const screenId of Object.keys(lazy.SCREEN_FILES)) {
      if (!/Screen$/.test(screenId)) continue;
      if (!h.el(screenId)) continue;
      if (/petBattle|nightRaid|armory/.test(screenId)) continue;          // arena tab, below
      if (screenId === 'mathHubScreen' || screenId === 'wordScreen') {   // bottom-bar tabs
        assert.truthy(wired(h, 'bottomNav', "switchScreen('" + screenId + "')"), 'no enabled bottom-bar button opens ' + screenId);
        continue;
      }
      assert.truthy(wired(h, 'learnHubScreen', "switchScreen('" + screenId + "')"), 'no enabled Learn card opens ' + screenId);
    }
  });

  test('the Math tab: every section card is enabled before HK2 (or anything) has loaded', async () => {
    const h = await boot();
    const S = h.sandbox;
    S.switchScreen('mathHubScreen'); await S.LazyData.ensure('mathHubScreen'); await settle();
    assert.falsy(S.LazyData.ready('mathHk2'), 'HK2 stays lazy');
    S.openMathSection('home');
    for (const sec of ['toan7', 'toan4', 'wars']) assert.truthy(wired(h, 'mathHubScreen', "openMathSection('" + sec + "')"), 'home → ' + sec);
    S.openMathSection('toan7');
    for (const sec of ['hk1', 'hk2', 'history']) assert.truthy(wired(h, 'mathHubScreen', "openMathSection('" + sec + "')"), 'toan7 → ' + sec);
    assert.falsy(LOADING.test(h.el('mathHubScreen').querySelectorAll('button.locked, button[disabled]').map(b => b.textContent).join(' ')), 'no card locked for loading');
    S.openMathSection('toan4');
    for (const fn of ['startMath4Mix()', 'startMath4Pre()', "openMathSection('cuuchuong')"]) assert.truthy(wired(h, 'mathHubScreen', fn), 'toan4 → ' + fn);
    // And the lazy one really opens from its card.
    h.run("openMathSection('hk2')"); await S.LazyData.ensure('mathHk2'); await settle();
    assert.truthy(S.LazyData.ready('mathHk2') && h.peek('MATH_QUESTIONS_HK2').length > 0, 'HK2 loaded from its card');
  });

  test('the Arena tab opens from the bottom bar before its code group has loaded', async () => {
    const h = await boot();
    const S = h.sandbox;
    assert.falsy(S.LazyData.ready('petBattleScreen'), 'arena stays lazy until tapped');
    await S.openPetBattle(); await S.LazyData.ensure('petBattleScreen'); await settle(50);
    assert.truthy(S.LazyData.ready('petBattleScreen'), 'the tap loaded the arena group');
    assert.truthy(h.el('petBattleScreen').classList.contains('active'), 'and the lobby is on screen');
  });

  test('every exam-engine practice home offers its Practice button before its bank is loaded', async () => {
    const h = await boot();
    const S = h.sandbox;
    for (const [screenId, start] of [['readingScreen', 'startReadingPractice'], ['clozeScreen', 'startClozePractice'], ['errorsScreen', 'startErrorsPractice'], ['grammarVocabScreen', 'startGrammarVocabPractice'], ['phoneticsScreen', 'switchPhoneticsSubTab']]) {
      S.switchScreen(screenId); await S.LazyData.ensure(screenId); await settle();
      assert.truthy(wired(h, screenId, start), screenId + ' has no enabled ' + start);
    }
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
