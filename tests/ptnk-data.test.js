// ptnk-data.test.js — the PTNK bank: eleven real papers, checked as data.
//
// The papers were transcribed page by page from scanned PDFs by agents, then
// verified by a second pass (official key where one exists; a blind second
// solve and a reconciler where none does). This file cannot re-read the PDFs.
// What it CAN do is hold the bank to the contract every screen relies on,
// and to a few facts about the papers that are known independently of any
// transcription — how many there are, which years, which have a published
// key, and how long each runs — so a regenerated bank that drifts on any of
// them fails here rather than in a child's hands.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate, PAPERS } = require(path.join(ROOT, 'scripts', 'validate-ptnk.js'));
// The built bank stores each passage once; js/ptnk.js puts it back on every
// question before a paper reaches the engine. Everything below that reads a
// question reads it the way the engine will — hydrated.
const BUILT = require(path.join(ROOT, 'js', 'ptnk-data.js')).PTNK_EXAMS;
const { ptnkHydrate } = require(path.join(ROOT, 'js', 'ptnk.js'));
const PTNK_EXAMS = BUILT.map(ptnkHydrate);

const EXPECTED_IDS = Object.keys(PAPERS).sort();

suite('PTNK bank: the fixed list of papers', () => {
  test('exactly the eleven papers in SCHEMA.md, no more, no fewer', () => {
    assert.deepEqual(PTNK_EXAMS.map(e => e.id).sort(), EXPECTED_IDS);
  });

  test('every source JSON passes the validator the transcribers ran', () => {
    for (const id of EXPECTED_IDS) {
      const file = path.join(ROOT, 'data', 'ptnk', id + '.json');
      assert.truthy(fs.existsSync(file), id + '.json is missing');
      const problems = validate(file);
      assert.deepEqual(problems, [], id + ': ' + problems.slice(0, 5).join(' | '));
    }
  });

  test('the built bank is the source JSON, not a stale copy', () => {
    for (const ex of PTNK_EXAMS) {
      const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ptnk', ex.id + '.json'), 'utf8'));
      assert.equal(ex.questions.length, src.questions.length, ex.id + ': rebuild js/ptnk-data.js');
      assert.equal(JSON.stringify(ex.questions[0]), JSON.stringify(src.questions[0]), ex.id + ': first question differs — rebuild');
    }
  });

  test('year, track, key source and duration match what is known about each paper', () => {
    for (const ex of PTNK_EXAMS) {
      const spec = PAPERS[ex.id];
      assert.equal(ex.year, spec.year, ex.id);
      assert.equal(ex.track, spec.track, ex.id);
      assert.equal(ex.keySource, spec.keySource, ex.id + ': a solved paper must say so, an official one must not');
      assert.equal(ex.durationMin, spec.durationMin, ex.id + ': KC papers are 60 minutes, chuyên 120');
    }
  });

  test('ordering is newest year first, Không chuyên before Chuyên', () => {
    for (let i = 1; i < PTNK_EXAMS.length; i++) {
      const a = PTNK_EXAMS[i - 1], b = PTNK_EXAMS[i];
      const ok = a.year > b.year || (a.year === b.year && a.track === 'kc' && b.track === 'chuyen');
      assert.truthy(ok, `${a.id} must come before ${b.id}`);
    }
  });
});

suite('PTNK bank: passages are stored once and come back whole', () => {
  // scripts/build-ptnk-data.js hoists the passage every question of a text
  // repeats (SCHEMA.md) into one `passages` list per paper; ptnkHydrate() in
  // js/ptnk.js reverses it. The round trip has to be exact — the same string
  // on the same question, in the same key position — because the engine, the
  // review screen and the study checkpoint all read `question.passage` and
  // the source JSON is the transcription a second reader checked.
  test('the paper the app opens is the source paper, question for question', () => {
    for (const ex of PTNK_EXAMS) {
      const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ptnk', ex.id + '.json'), 'utf8'));
      assert.equal(JSON.stringify(ex), JSON.stringify(src), ex.id + ': the hydrated paper differs from data/ptnk/' + ex.id + '.json');
      src.questions.forEach((q, i) => {
        assert.equal(ex.questions[i].passage, q.passage, `${ex.id} n=${q.n}: passage`);
        assert.equal('passageId' in ex.questions[i], false, `${ex.id} n=${q.n}: passageId leaked to the engine`);
      });
      assert.equal('passages' in ex, false, ex.id + ': passages list leaked to the engine');
    }
  });

  test('the built file carries no passage string twice', () => {
    for (const ex of BUILT) {
      const seen = new Set();
      for (const p of ex.passages || []) {
        assert.falsy(seen.has(p), ex.id + ': a passage is stored twice');
        seen.add(p);
      }
      for (const q of ex.questions) {
        assert.equal('passage' in q, false, `${ex.id} n=${q.n}: inline passage in the built bank — rebuild`);
        if ('passageId' in q) assert.truthy(Number.isInteger(q.passageId) && q.passageId >= 0 && q.passageId < ex.passages.length, `${ex.id} n=${q.n}: passageId out of range`);
      }
    }
    // Belt and braces: the source text of the built file, not just its
    // parsed shape. Any string of passage length that appears twice is a
    // passage that was not hoisted.
    const text = fs.readFileSync(path.join(ROOT, 'js', 'ptnk-data.js'), 'utf8');
    for (const ex of BUILT) for (const p of ex.passages || []) {
      const needle = JSON.stringify(p);
      const first = text.indexOf(needle);
      assert.truthy(first >= 0, ex.id + ': passage not found verbatim');
      assert.equal(text.indexOf(needle, first + 1), -1, ex.id + ': passage text repeated in js/ptnk-data.js');
    }
  });

  test('every passage in the built file is pointed at by at least one question', () => {
    for (const ex of BUILT) {
      const used = new Set(ex.questions.map(q => q.passageId).filter(n => typeof n === 'number'));
      (ex.passages || []).forEach((p, i) => assert.truthy(used.has(i), `${ex.id}: passages[${i}] is orphaned`));
    }
  });

  test('hydration hands the engine the same paper object every time', () => {
    // examLookup() runs per review row and the engine keeps `questions` for
    // the length of a paper: a fresh copy each call would break both.
    for (const ex of BUILT) assert.truthy(ptnkHydrate(ex) === ptnkHydrate(ex), ex.id);
  });

  test('a paper with inline passages passes through untouched', () => {
    const inline = { id: 'x', questions: [{ n: 1, passage: 'p', q: 'q' }] };
    assert.truthy(ptnkHydrate(inline) === inline);
    assert.equal(ptnkHydrate(null), null);
  });
});

suite('PTNK bank: every question can be shown and graded', () => {
  test('numbering is global and sequential in every paper', () => {
    for (const ex of PTNK_EXAMS) {
      ex.questions.forEach((q, i) => assert.equal(q.n, i + 1, ex.id + ' q' + (i + 1)));
    }
  });

  test('mcq: four distinct options, key in range, no letter prefixes', () => {
    for (const ex of PTNK_EXAMS) for (const q of ex.questions) {
      if (q.type !== 'mcq') continue;
      assert.equal(q.options.length, 4, `${ex.id} n=${q.n}`);
      assert.equal(new Set(q.options.map(o => o.trim().toLowerCase())).size, 4, `${ex.id} n=${q.n}: duplicate options`);
      assert.truthy(q.correct >= 0 && q.correct < 4, `${ex.id} n=${q.n}`);
      assert.falsy(q.options.some(o => /^[A-D][.)]\s/.test(o)), `${ex.id} n=${q.n}: letter prefix left in an option`);
    }
  });

  test('text: the primary answer is in accept, and nothing is essay-length', () => {
    for (const ex of PTNK_EXAMS) for (const q of ex.questions) {
      if (q.type !== 'text') continue;
      assert.truthy(q.accept.length > 0 && q.accept.includes(q.answer), `${ex.id} n=${q.n}`);
      assert.truthy(q.accept.every(a => a.split(/\s+/).length <= 20), `${ex.id} n=${q.n}: an essay slipped in`);
    }
  });

  test('every reading and cloze question carries its passage', () => {
    for (const ex of PTNK_EXAMS) for (const q of ex.questions) {
      if (!['Reading', 'Cloze', 'Open cloze'].includes(q.section)) continue;
      assert.truthy(typeof q.passage === 'string' && q.passage.length >= 80, `${ex.id} n=${q.n}: no passage`);
    }
  });

  test('every explanation is real prose, never empty, never "undefined"', () => {
    const junk = /\b(undefined|null|NaN)\b/;
    for (const ex of PTNK_EXAMS) for (const q of ex.questions) {
      assert.truthy(q.explanation && q.explanation.trim().length >= 15, `${ex.id} n=${q.n}`);
      assert.falsy(junk.test(q.explanation) || junk.test(q.q) || junk.test(q.passage || ''), `${ex.id} n=${q.n}: junk token`);
    }
  });

  test('the correct option is not always in the same slot', () => {
    // A transcriber that defaulted `correct` to 0 would pass every shape
    // check above and give away every answer.
    for (const ex of PTNK_EXAMS) {
      const mcq = ex.questions.filter(q => q.type === 'mcq');
      if (mcq.length < 12) continue;
      const slots = new Set(mcq.map(q => q.correct));
      assert.truthy(slots.size >= 3, `${ex.id}: correct answers sit in only ${slots.size} slot(s) — was the key applied?`);
    }
  });

  test('a paper is substantial — no part was skipped', () => {
    for (const ex of PTNK_EXAMS) {
      const min = ex.track === 'kc' ? 30 : 40;
      assert.truthy(ex.questions.length >= min, `${ex.id}: only ${ex.questions.length} questions`);
    }
  });
});

suite('PTNK bank: the papers a daily task can name are the papers in the bank', () => {
  test('every catalog ptnk:<id> entry points at a paper that exists, and vice versa', () => {
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const inCatalog = Catalog.entries('ptnk').map(e => e.key).filter(k => k !== 'ptnk:any').map(k => k.slice(5)).sort();
    assert.deepEqual(inCatalog, EXPECTED_IDS, 'an admin must be able to assign exactly the papers a child can open');
    for (const e of Catalog.entries('ptnk')) {
      if (e.key === 'ptnk:any') continue;
      assert.deepEqual(e.go, { screen: 'ptnkScreen', calls: [['startPtnkExam', e.key.slice(5)]] }, e.key);
      assert.deepEqual(e.match, { detail: { field: 'examId', value: e.key.slice(5) } }, e.key);
      assert.equal(e.activityType, 'exam', e.key);
    }
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
