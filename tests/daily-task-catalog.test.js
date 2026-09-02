// The catalog is the single source of truth shared by admin.html (dropdowns),
// js/daily-task.js (Vào học deep links) and functions/api (match rules).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));

suite('daily task catalog: shape', () => {
  test('every entry has key, group, label, activityType, match and go', () => {
    const all = Catalog.all();
    assert.truthy(all.length >= 60, 'expected a full catalog, got ' + all.length);
    for (const e of all) {
      assert.truthy(/^[a-z0-9:-]+$/.test(e.key), 'bad key ' + e.key);
      assert.truthy(Catalog.groups().some(g => g.id === e.group), e.key + ': unknown group ' + e.group);
      assert.truthy(e.label && e.label.length > 2, e.key + ': label');
      assert.truthy(e.activityType, e.key + ': activityType');
      assert.truthy(e.match && Object.keys(e.match).length, e.key + ': match');
      assert.truthy(e.go && e.go.screen && Array.isArray(e.go.calls), e.key + ': go');
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

  test('entries(group) lists exactly that group', () => {
    for (const g of Catalog.groups()) {
      const list = Catalog.entries(g.id);
      assert.truthy(list.length > 0, g.id + ' is empty');
      assert.truthy(list.every(e => e.group === g.id));
    }
    assert.deepEqual(Catalog.entries('nope'), []);
  });

  test('activityType values are all accepted by functions/api/activity.js', () => {
    const server = fs.readFileSync(path.join(ROOT, 'functions/api/activity.js'), 'utf8');
    const accepted = [...(/const TYPES = \[([^\]]*)\]/.exec(server)[1]).matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    for (const e of Catalog.all()) assert.contains(accepted, e.activityType, e.key);
  });

  test('catalog data is frozen: mutation attempts have no effect', () => {
    try { Catalog.all()[0].match = { nope: true }; } catch (e) { /* strict-mode TypeError, also fine */ }
    try { Catalog.get('phrases').go.calls[0][0] = 'nope'; } catch (e) { /* strict-mode TypeError, also fine */ }
    assert.equal(Catalog.get('phrases').match.titlePrefix, 'Phrases practice');
    assert.truthy(Object.isFrozen(Catalog.get('phrases').go.calls[0]), 'call tuple should be frozen');
  });
});

suite('daily task catalog: match rules mirror what js/auth.js actually uploads', () => {
  test('units keys produce the exact titles _localHistoryItems builds', () => {
    assert.deepEqual(Catalog.get('units:hk1-mix').match, { titleExact: 'Unit hk1-mix words practice' });
    assert.deepEqual(Catalog.get('units:hk1-3').match, { titleExact: 'Unit hk1-3 words practice' });
    assert.deepEqual(Catalog.get('units:4').match, { titleExact: 'Unit 4 words practice' });
    assert.deepEqual(Catalog.get('units:mix').match, { titleExact: 'Mix 12 units words practice' });
    assert.equal(Catalog.get('units:hk1-mix').activityType, 'lesson');
  });

  test('practice tabs match by title prefix', () => {
    assert.deepEqual(Catalog.get('phrases').match, { titlePrefix: 'Phrases practice' });
    assert.deepEqual(Catalog.get('collocation').match, { titlePrefix: 'Collocation practice' });
    assert.deepEqual(Catalog.get('wordform').match, { titlePrefix: 'Word form practice' });
    assert.deepEqual(Catalog.get('rewrite').match, { titlePrefix: 'Rewrite practice' });
    assert.deepEqual(Catalog.get('verbs').match, { titlePrefix: 'Verbs challenge' });
    assert.deepEqual(Catalog.get('vocab').match, { titlePrefix: 'Vocabulary lesson' });
  });

  test('grammar and maths match on detail fields', () => {
    assert.deepEqual(Catalog.get('grammar:unit12').match, { detail: { field: 'unitId', value: 'unit12' } });
    assert.equal(Catalog.entries('grammar').length, 13);
    assert.deepEqual(Catalog.get('math-exam:hk1-source-3').match, { detail: { field: 'examId', value: 'hk1-source-3' } });
    assert.deepEqual(Catalog.get('math-exam:any-hk1').match, { detail: { field: 'examId', prefix: 'hk1-' } });
    assert.deepEqual(Catalog.get('math-chapter:2').match, { detail: { field: 'chapter', value: 2 }, noField: 'examId' });
    assert.equal(Catalog.entries('math-exam').length, 16);
    assert.equal(Catalog.entries('math-chapter').length, 5);
  });

  test('deep links: units switch set before starting; maths exam passes its id', () => {
    assert.deepEqual(Catalog.get('units:hk1-mix').go,
      { screen: 'topicsScreen', calls: [['switchTopicsSubTab', 'grade4'], ['switchUnitSet', 'hk1'], ['startUnitPractice', 'hk1-mix']] });
    assert.deepEqual(Catalog.get('units:4').go,
      { screen: 'topicsScreen', calls: [['switchTopicsSubTab', 'grade4'], ['switchUnitSet', 'pre'], ['startUnitPractice', 4]] });
    assert.deepEqual(Catalog.get('math-exam:hk1-source-3').go,
      { screen: 'mathHubScreen', calls: [['startMathExam', 'hk1-source-3']] });
    assert.deepEqual(Catalog.get('collocation').go,
      { screen: 'phrasesScreen', calls: [['switchPhrSubTab', 'colloc'], ['startCollocPractice', 20]] });
  });

  test('every go.calls function name exists in the app sources', () => {
    const src = ['js/app.js', 'js/topics.js', 'js/units.js', 'js/phrases.js', 'js/collocation.js', 'js/wordform.js',
      'js/rewrite.js', 'js/verbs.js', 'js/home.js', 'js/grammar-ui.js', 'js/math.js']
      .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    for (const e of Catalog.all()) {
      for (const call of e.go.calls) {
        // Anchored at line start (m flag) so only top-level function
        // declarations count — matches what globalThis[fn] will find.
        assert.truthy(new RegExp('^function ' + call[0] + '\\s*\\(', 'm').test(src), e.key + ': ' + call[0] + ' is not a function in the app');
      }
    }
  });

  test('titlePrefix/titleExact match rules are real strings in js/auth.js', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'js', 'auth.js'), 'utf8');
    // Literal fragments _localHistoryItems() actually builds titles from.
    [
      "'Vocabulary lesson #'", "'Phrases practice ('", "'Word form practice ('",
      "'Rewrite practice ('", "'Collocation practice ('", "'Verbs challenge ('",
      "' words practice'", "'Mix 12 units'", 'detail: { unitId',
      'examId: h.examId, chapter: h.chapter',
    ].forEach(needle => assert.truthy(auth.includes(needle), 'js/auth.js is missing: ' + needle));

    // Derive: every titlePrefix in the catalog must be a real prefix in
    // auth.js — either '<prefix> (' (Qs-count tabs) or '<prefix> #' (vocab).
    for (const e of Catalog.all()) {
      if (!e.match || !e.match.titlePrefix) continue;
      const prefix = e.match.titlePrefix;
      const found = auth.includes("'" + prefix + " (") || auth.includes("'" + prefix + " #");
      assert.truthy(found, e.key + ': titlePrefix "' + prefix + '" not found verbatim in js/auth.js');
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
