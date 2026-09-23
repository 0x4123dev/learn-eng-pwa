// The catalog is the single source of truth shared by admin.html (dropdowns),
// js/daily-task.js (Vào học deep links) and functions/api (match rules).
// Since the 2026-09 cut it holds exactly the 24 Book tasks: one per Career
// Paths unit and one Mix per Book.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));

suite('daily task catalog: shape', () => {
  test('every entry has key, group, label, activityType, match, go and path', () => {
    const all = Catalog.all();
    assert.equal(all.length, 25, 'the catalog is the 25 Book tasks and nothing else');
    for (const e of all) {
      assert.truthy(/^[a-z0-9:-]+$/.test(e.key), 'bad key ' + e.key);
      assert.truthy(Catalog.groups().some(g => g.id === e.group), e.key + ': unknown group ' + e.group);
      assert.truthy(e.label && e.label.length > 2, e.key + ': label');
      assert.truthy(e.activityType, e.key + ': activityType');
      assert.truthy(e.match && Object.keys(e.match).length, e.key + ': match');
      assert.truthy(e.go && e.go.screen && Array.isArray(e.go.calls), e.key + ': go');
      assert.truthy(Array.isArray(e.path) && e.path.length, e.key + ': path');
    }
  });

  test('keys are unique and get() round-trips', () => {
    const seen = new Set();
    for (const e of Catalog.all()) {
      assert.falsy(seen.has(e.key), 'duplicate key ' + e.key);
      seen.add(e.key);
      assert.equal(Catalog.get(e.key).key, e.key);
    }
    assert.equal(Catalog.get('nope'), null);
    assert.equal(Catalog.get(''), null);
    assert.equal(Catalog.get(null), null);
  });

  test('the three groups are the three Books: Book 1 nine tasks, Books 2-3 eight each', () => {
    assert.deepEqual(Catalog.groups().map(g => g.id), ['word-pr1', 'word-pr2', 'word-pr3']);
    const SIZE = { 'word-pr1': 9, 'word-pr2': 8, 'word-pr3': 8 };
    for (const g of Catalog.groups()) {
      const list = Catalog.entries(g.id);
      assert.equal(list.length, SIZE[g.id], g.id);
      assert.truthy(list.every(e => e.group === g.id));
      assert.truthy(/^Book [123] · /.test(g.label), g.label);
    }
    assert.deepEqual(Catalog.entries('nope'), []);
  });

  test('the pre-cut menus are gone: no grammar, maths, phrases, PTNK or Grade 4 task survives', () => {
    for (const key of ['phrases', 'collocation', 'wordform', 'rewrite', 'verbs', 'vocab', 'mathwars',
      'grammar:unit12', 'math-exam:any-hk1', 'math-chapter:2', 'math4:pre', 'ptnk:any', 'reading:any', 'cloze:any', 'errors:kc',
      'units:hk1-mix', 'units:4', 'units:mix']) {
      assert.equal(Catalog.get(key), null, key + ' should no longer be assignable');
    }
    assert.truthy(Catalog.all().every(e => e.key.startsWith('word:')), 'every key is a word: task');
    assert.truthy(Catalog.all().every(e => e.size === undefined && e.go.group === undefined), 'no sized buttons, no lazy sub-groups');
  });

  test('activityType values are all accepted by functions/api/activity.js', () => {
    const server = fs.readFileSync(path.join(ROOT, 'functions/api/activity.js'), 'utf8');
    const accepted = [...(/const TYPES = \[([^\]]*)\]/.exec(server)[1]).matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    for (const e of Catalog.all()) assert.contains(accepted, e.activityType, e.key);
  });

  test('catalog data is frozen: mutation attempts have no effect', () => {
    try { Catalog.all()[0].match = { nope: true }; } catch (e) { /* strict-mode TypeError, also fine */ }
    try { Catalog.get('word:pr1-1').go.calls[0][0] = 'nope'; } catch (e) { /* strict-mode TypeError, also fine */ }
    assert.equal(Catalog.get('word:pr1-1').match.titleExact, 'Unit pr1-1 words practice');
    assert.equal(Catalog.get('word:pr1-1').go.calls[0][0], 'switchUnitSet');
    assert.truthy(Object.isFrozen(Catalog.get('word:pr1-1').go.calls[0]), 'call tuple should be frozen');
  });

  test('tree(): Book 1, Book 2, Book 3 in that order, each holding its 16 tasks', () => {
    const t = Catalog.tree();
    assert.equal(t.label, '');
    assert.deepEqual(t.entries, []);
    assert.deepEqual(t.children.map(c => c.label), ['Book 1', 'Book 2', 'Book 3']);
    t.children.forEach((c, i) => {
      assert.deepEqual(c.children, [], c.label + ' has no sub-menu');
      assert.deepEqual(c.entries.map(e => e.key), Catalog.entries('word-pr' + (i + 1)).map(e => e.key));
    });
  });
});

suite('daily task catalog: the 25 Book tasks', () => {
  test('one per unit and one Mix per Book, deep-linked onto wordScreen', () => {
    // js/units.js serves the Word tab: the deep link switches the Book, then
    // starts the unit key. The set lives on wordScreen.
    // Book 1 is eight units (one per book unit, ~30 words); Books 2 and 3
    // are seven (the book's fifteen merged two-by-two).
    const UNITS = { pr1: 8, pr2: 7, pr3: 7 };
    const keys = [];
    for (const set of ['pr1', 'pr2', 'pr3']) {
      for (let u = 1; u <= UNITS[set]; u++) keys.push([set, set + '-' + u]);
      keys.push([set, set + '-mix']);
    }
    assert.equal(keys.length, 25);
    for (const [set, unitKey] of keys) {
      const e = Catalog.get('word:' + unitKey);
      assert.truthy(e, 'word:' + unitKey + ' is missing from the catalog');
      assert.equal(e.group, 'word-' + set, unitKey + ': group');
      assert.equal(e.activityType, 'lesson', unitKey + ': activityType');
      assert.deepEqual(e.go, { screen: 'wordScreen', calls: [['switchUnitSet', set], ['startUnitPractice', unitKey]] }, unitKey + ': go');
      assert.deepEqual(e.path, ['Book ' + set.slice(-1)], unitKey + ': path');
    }
    assert.deepEqual(Catalog.entries('word-pr1').map(e => e.key),
      [1, 2, 3, 4, 5, 6, 7, 8].map(u => 'word:pr1-' + u).concat(['word:pr1-mix']));
  });

  test('match rules are the exact title js/auth.js uploads for a unitsHistory row', () => {
    // js/auth.js _localHistoryItems: title = 'Unit ' + h.unit + ' words practice'.
    // The title is the whole identity of the row.
    const auth = fs.readFileSync(path.join(ROOT, 'js', 'auth.js'), 'utf8');
    const line = "title: 'Unit ' + h.unit + ' words practice'";
    assert.truthy(auth.includes(line), 'js/auth.js no longer builds the units title this way: ' + line);
    for (const e of Catalog.all()) {
      const unitKey = e.go.calls[1][1];
      assert.deepEqual(e.match, { titleExact: 'Unit ' + unitKey + ' words practice' }, e.key + ': match');
    }
    assert.deepEqual(Catalog.get('word:pr2-7').match, { titleExact: 'Unit pr2-7 words practice' });
    assert.deepEqual(Catalog.get('word:pr3-mix').match, { titleExact: 'Unit pr3-mix words practice' });
  });

  test('unit titles in the catalog are the ones js/word-data.js carries', () => {
    // The bank is lazy and the catalog is built at startup, so the titles are
    // repeated in js/daily-task-catalog.js SETS. They reach the admin only
    // through the entry label ('Book 1 · Unit 3 · Services'), so that is
    // where the two are held together.
    const { UNIT_PR_TITLES } = require(path.join(ROOT, 'js', 'word-data.js'));
    assert.deepEqual(Object.keys(UNIT_PR_TITLES), ['pr1', 'pr2', 'pr3']);
    for (const set of ['pr1', 'pr2', 'pr3']) {
      const book = set.slice(-1);
      const want = set === 'pr1' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];
      assert.deepEqual(Object.keys(UNIT_PR_TITLES[set]).map(Number).sort((a, b) => a - b),
        want, set + ': practice-unit titles in the bank');
      for (const u of want) {
        const title = UNIT_PR_TITLES[set][u];
        // Book 1 is one book unit per practice unit, so one title; Books 2
        // and 3 merge two (three in the last).
        const parts = set === 'pr1' ? 1 : (u === 7 ? 3 : 2);
        assert.truthy(title && title.trim() === title && title.split(' · ').length === parts, set + '-' + u + ': the merged book units\' titles, joined by · ');
        const e = Catalog.get('word:' + set + '-' + u);
        assert.equal(e.label, 'Book ' + book + ' · Unit ' + u + ' · ' + title,
          e.key + ': the catalog title drifted from js/word-data.js');
      }
      assert.equal(Catalog.get('word:' + set + '-mix').label, 'Book ' + book + ' · 🎲 Mix');
    }
  });

  test('every go.calls function name exists in the app sources', () => {
    const src = ['js/app.js', 'js/units.js', 'js/home.js']
      .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    for (const e of Catalog.all()) {
      for (const call of e.go.calls) {
        // Anchored at line start (m flag) so only top-level function
        // declarations count — matches what globalThis[fn] will find.
        assert.truthy(new RegExp('^function ' + call[0] + '\\s*\\(', 'm').test(src), e.key + ': ' + call[0] + ' is not a function in the app');
      }
    }
  });

  test('wordScreen is a real screen in index.html', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.truthy(/id="wordScreen"/.test(html), 'the deep-link target must exist');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
