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
    // 13 units × (bất kỳ + 10 câu + 25 câu)
    assert.equal(Catalog.entries('grammar').length, 39);
    assert.deepEqual(Catalog.get('grammar:unit12:10').match, { detail: { field: 'unitQs', value: 'unit12:10' } });
    assert.deepEqual(Catalog.get('math-exam:hk1-source-3').match, { detail: { field: 'examId', value: 'hk1-source-3' } });
    assert.deepEqual(Catalog.get('math-exam:any-hk1').match, { detail: { field: 'examId', prefix: 'hk1-' } });
    assert.deepEqual(Catalog.get('math-chapter:2').match, { detail: { field: 'chapter', value: 2 }, noField: 'examId' });
    // HK1: 10 mock exams + 5 school papers + "bất kỳ"; HK2: 10 mock exams +
    // 30 school papers + "bất kỳ". The admin dropdown is built from this list
    // and nothing else — for a whole semester it offered nothing to hand out
    // until HK2 was added (2026-09-04).
    assert.equal(Catalog.entries('math-exam').length, 57);
    assert.equal(Catalog.entries('math-chapter').length, 10);
    assert.deepEqual(Catalog.get('math-exam:any-hk2').match, { detail: { field: 'examId', prefix: 'hk2-' } });
    assert.deepEqual(Catalog.get('math-chapter:6').match, { detail: { field: 'chapter', value: 6 }, noField: 'examId' });
    assert.truthy(Catalog.get('math-exam:hk2-exam1'), 'HK2 mock exams must be assignable');
    assert.truthy(Catalog.get('math-exam:hk2-src-30'), 'all 30 HK2 school papers must be assignable');
    // startMathExam/startMathQuiz resolve in the semester the child is standing
    // in, so every maths deep link opens its semester FIRST.
    assert.deepEqual(Catalog.get('math-chapter:6').go.calls, [['openMathSection', 'hk2'], ['startMathQuiz', 6]]);
    assert.deepEqual(Catalog.get('math-chapter:2').go.calls, [['openMathSection', 'hk1'], ['startMathQuiz', 2]]);
    assert.deepEqual(Catalog.get('math-exam:hk2-src-01').go.calls, [['openMathSection', 'hk2'], ['startMathExam', 'hk2-src-01']]);
    for (const e of Catalog.entries('math-exam').concat(Catalog.entries('math-chapter'))) {
      assert.equal(e.go.calls[0][0], 'openMathSection', e.key + ' must open its semester before starting');
      const sem = e.go.calls[0][1];
      const wantsHk2 = /(^|:)(hk2-|any-hk2)|math-chapter:(6|7|8|9|10)$/.test(e.key);
      assert.equal(sem, wantsHk2 ? 'hk2' : 'hk1', e.key + ' opens the wrong semester');
    }
  });

  test('a task can name one BUTTON, and its deep link opens that same button', () => {
    // The count already in the activity title is the screen count, not the
    // button: a 10-question Phrases practice records "(20 Qs)" and Word form
    // records 30, 31 or 32 for the same button. So the size travels as
    // detail.qs, written by js/auth.js from what the tab recorded.
    for (const [key, n, fn] of [
      ['phrases:10', 10, 'startPhrasesQuiz'], ['phrases:20', 20, 'startPhrasesQuiz'],
      ['collocation:10', 10, 'startCollocPractice'], ['collocation:20', 20, 'startCollocPractice'],
      ['wordform:10', 10, 'startWordformQuiz'], ['wordform:20', 20, 'startWordformQuiz'],
    ]) {
      const e = Catalog.get(key);
      assert.truthy(e, key + ' is missing');
      assert.equal(e.size, n, key + ': size');
      assert.deepEqual(e.match.detail, { field: 'qs', value: n }, key + ': match');
      const last = e.go.calls[e.go.calls.length - 1];
      assert.deepEqual(last, [fn, n], key + ': the deep link must start that same length');
    }
    // Grammar's two buttons are 10 and 25, not 10 and 20.
    assert.deepEqual(Catalog.get('grammar:unit3:25').go.calls, [['startGrammarQuiz', 'unit3', 25]]);
    assert.equal(Catalog.get('grammar:unit3:10').size, 10);
    // Rewrite has only a 10-question button and Verbs picks a level, so
    // neither takes a size — offering one would promise a button that is not
    // on the screen.
    assert.equal(Catalog.get('rewrite').size, undefined);
    assert.equal(Catalog.get('verbs').size, undefined);
    assert.equal(Catalog.get('rewrite:20'), null);
  });

  test('Math Wars is its own task and cannot be crossed with the other maths tasks', () => {
    // All three ride activityType 'math', so the match rules are what keep a
    // Math Wars round from ticking off a chapter drill and vice versa.
    const wars = Catalog.get('mathwars');
    assert.deepEqual(wars.match, { titlePrefix: 'Math Wars' });
    assert.equal(wars.activityType, 'math');
    assert.equal(Catalog.entries('math-wars').length, 1);
    // js/auth.js writes 'Math Wars · 8/10 câu'; Toán 7 writes 'Toán 7 · …'.
    // Neither prefix is a prefix of the other, and Math Wars carries no
    // examId or chapter for the detail-based rules to catch.
    const auth = fs.readFileSync(path.join(ROOT, 'js/auth.js'), 'utf8');
    assert.truthy(auth.includes("title: 'Math Wars · '"), 'the uploaded title changed');
    assert.falsy(String(Catalog.get('math-exam:any-hk1').match.titlePrefix || '').startsWith('Math Wars'));
    assert.deepEqual(wars.go,
      { screen: 'mathHubScreen', calls: [['openMathSection', 'wars'], ['startWarsRound']] });
  });

  test('deep links: units switch set before starting; maths exam passes its id', () => {
    assert.deepEqual(Catalog.get('units:hk1-mix').go,
      { screen: 'gradeFourScreen', calls: [['switchUnitSet', 'hk1'], ['startUnitPractice', 'hk1-mix']] });
    assert.deepEqual(Catalog.get('units:4').go,
      { screen: 'gradeFourScreen', calls: [['switchUnitSet', 'pre'], ['startUnitPractice', 4]] });
    assert.deepEqual(Catalog.get('math-exam:hk1-source-3').go,
      { screen: 'mathHubScreen', calls: [['openMathSection', 'hk1'], ['startMathExam', 'hk1-source-3']] });
    assert.deepEqual(Catalog.get('collocation').go,
      { screen: 'phrasesScreen', calls: [['switchPhrSubTab', 'colloc'], ['startCollocPractice', 20]] });
  });

  test('every go.calls function name exists in the app sources', () => {
    const src = ['js/app.js', 'js/topics.js', 'js/units.js', 'js/phrases.js', 'js/collocation.js', 'js/wordform.js',
      'js/rewrite.js', 'js/verbs.js', 'js/home.js', 'js/grammar-ui.js', 'js/math.js', 'js/mathwars.js',
      'js/math-tables.js', 'js/ptnk.js', 'js/practice-sets.js']
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
      "' words practice'", "'Mix 12 units'", '{ unitId: h.unitId, unitQs',
      'examId: h.examId, chapter: h.chapter',
      "'Math Wars · '",
    ].forEach(needle => assert.truthy(auth.includes(needle), 'js/auth.js is missing: ' + needle));

    // Derive: every titlePrefix in the catalog must be a real prefix in
    // auth.js — either '<prefix> (' (Qs-count tabs) or '<prefix> #' (vocab).
    for (const e of Catalog.all()) {
      if (!e.match || !e.match.titlePrefix) continue;
      const prefix = e.match.titlePrefix;
      // Three shapes are in use: '<prefix> (' for the Qs-count tabs,
      // '<prefix> #' for the vocab lesson, and '<prefix> · ' for Math Wars,
      // whose title carries its score ('Math Wars · 8/10 câu').
      const found = auth.includes("'" + prefix + " (") || auth.includes("'" + prefix + " #")
        || auth.includes("'" + prefix + " · ");
      assert.truthy(found, e.key + ': titlePrefix "' + prefix + '" not found verbatim in js/auth.js');
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
