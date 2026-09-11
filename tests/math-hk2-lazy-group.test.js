// math-hk2-lazy-group.test.js — Học kì 2 is its own lazy group, and every
// road into it waits for it.
//
// Before 2026-09-11 the four HK2 files (~3 MB: the 900-question bank, ten
// mock exams, thirty school papers, the lessons) rode in the Math tab's lazy
// group, so a child opening Math for Toán 4 or Math Wars parsed all of it.
// Now they load when Học kì 2 is actually opened. That is only safe if every
// path that reaches HK2 content waits for the group first — this file walks
// each one.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));

const HK2 = ['js/math-data-hk2.js', 'js/math-exams-hk2.js', 'js/math-lessons-hk2.js', 'js/math-source-exams-hk2.js'];

suite('HK2 lazy group: the split itself', () => {
  test('the four HK2 files are a group of their own, and NOT in the Math tab group', () => {
    assert.deepEqual(lazy.GROUP_FILES.mathHk2, HK2);
    for (const f of HK2) assert.falsy(lazy.SCREEN_FILES.mathHubScreen.includes(f), f + ' must no longer load on every Math open');
    assert.deepEqual(lazy.filesFor('mathHk2'), HK2, 'filesFor must answer for a group key');
  });

  test('the Math tab group is now under 1.5 MB — the point of the exercise', () => {
    const bytes = lazy.SCREEN_FILES.mathHubScreen.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);
    assert.truthy(bytes < 1.5 * 1024 * 1024, `mathHubScreen group is ${(bytes / 1048576).toFixed(2)} MB`);
    const hk2 = HK2.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);
    assert.truthy(hk2 > 2.5 * 1024 * 1024, 'the split would be pointless if HK2 were small');
  });

  test('every HK2 file is still precached by the service worker, so offline is unchanged', () => {
    const sw = read('sw.js');
    for (const f of HK2) assert.truthy(sw.includes("'/" + f + "'"), f + ' dropped from the precache');
  });

  test('and still claimed in the verify manifest', () => {
    const m = read('tests/verify/manifest.js');
    for (const f of HK2) assert.truthy(m.includes(f), f + ' no longer claimed');
  });
});

suite('HK2 lazy group: every road in waits for it', () => {
  test('opening Học kì 2 draws a placeholder and redraws when the group lands', () => {
    const src = read('js/math.js');
    assert.truthy(src.includes("_mathView === 'hk2' && typeof LazyData !== 'undefined' && !LazyData.ready('mathHk2')"));
    assert.truthy(src.includes("LazyData.ensure('mathHk2').then(() => { if (_mathView === 'hk2') renderMathHome(); })"),
      'the redraw must be conditional on the child still being on HK2');
    assert.falsy(/\$\{MATH_QUESTIONS_HK2\.length\}/.test(src), 'the menu must not read the HK2 global bare — it may not be loaded');
  });

  test('a daily-task deep link into HK2 ensures the group before its calls run', () => {
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    for (const key of ['math-exam:any-hk2', 'math-exam:hk2-exam3', 'math-exam:hk2-src-07', 'math-chapter:6', 'math-chapter:10']) {
      assert.equal(Catalog.get(key).go.group, 'mathHk2', key + ' must name the HK2 group');
    }
    for (const key of ['math-exam:any-hk1', 'math-exam:hk1-exam2', 'math-chapter:3', 'mathwars', 'math4:pre']) {
      assert.equal(Catalog.get(key).go.group, undefined, key + ' must NOT drag the HK2 group in');
    }
    const dt = read('js/daily-task.js');
    assert.truthy(dt.includes('entry.go.group') && dt.includes('await LazyData.ensure(entry.go.group)'),
      'DailyTask.go must ensure the group after the screen and before the calls');
  });

  test('a study checkpoint of an HK2 quiz waits for the group before restoring', () => {
    const app = read('js/app.js');
    assert.truthy(app.includes("Number(s0.chapter) >= 6 || /^hk2-/.test(String(s0.examId || ''))"),
      'an HK2 chapter or exam id must add the group');
    assert.truthy(app.includes("Promise.all(notReady.map(g => LazyData.ensure(g)))"),
      'all missing groups must be awaited together');
  });

  test('the history view fetches HK2 in the background so a review has its question text', () => {
    const src = read('js/math.js');
    assert.truthy(src.includes("if (v === 'history' && typeof LazyData !== 'undefined' && !LazyData.ready('mathHk2'))"));
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
