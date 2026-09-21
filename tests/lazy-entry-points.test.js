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

const JS = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !/-data|dictionary|hot-words/.test(f));
const LOADING = /Đang tải|Sắp có|đang soạn|loading|Loading/;

suite('lazy entry points: static', () => {
  test('every lazy GROUP has at least one LazyData.ensure() call site — something can open it', () => {
    const src = JS.map(f => read('js/' + f)).join('\n');
    for (const key of Object.keys(lazy.GROUP_FILES)) {
      const direct = new RegExp("LazyData\\.ensure\\('" + key + "'\\)").test(src);
      // A screen-mapped group (farm) is opened through switchScreen /
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

  test('the bottom bar offers every lazy screen, enabled', async () => {
    const h = await boot();
    // Every deferred screen is a bottom-bar tab: the three Books share the
    // Word screen (openBook), the farm has its own opener (openNightRaid).
    const opener = { wordScreen: 'openBook(', nightRaidScreen: 'openNightRaid()' };
    for (const screenId of Object.keys(lazy.SCREEN_FILES)) {
      assert.truthy(h.el(screenId), screenId + ' is not in index.html');
      assert.truthy(opener[screenId], 'no known bottom-bar opener for ' + screenId + ' — add it here');
      assert.truthy(wired(h, 'bottomNav', opener[screenId]), 'no enabled bottom-bar button opens ' + screenId);
    }
  });

  test('the farm tab opens from the bottom bar before its code group has loaded', async () => {
    const h = await boot();
    const S = h.sandbox;
    assert.falsy(S.LazyData.ready('nightRaidScreen'), 'the farm stays lazy until tapped');
    await S.openNightRaid(); await S.LazyData.ensure('nightRaidScreen'); await settle(50);
    assert.truthy(S.LazyData.ready('nightRaidScreen'), 'the tap loaded the farm group');
    assert.truthy(h.el('nightRaidScreen').classList.contains('active'), 'and the farm is on screen');
  });

  test('every Book offers its unit cards, enabled, once its bank has loaded', async () => {
    const h = await boot();
    const S = h.sandbox;
    for (const set of ['pr1', 'pr2', 'pr3']) {
      S.openBook(set); await S.LazyData.ensure('wordScreen'); await settle();
      assert.truthy(wired(h, 'wordScreen', "startUnitPractice('" + set + "-1')"), set + ' has no enabled Unit 1 card');
      assert.truthy(wired(h, 'wordScreen', "startUnitPractice('" + set + "-mix')"), set + ' has no enabled Mix card');
      assert.falsy(LOADING.test(h.el('wordScreen').querySelectorAll('button.locked, button[disabled]').map(b => b.textContent).join(' ')), 'no card locked for loading');
    }
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
