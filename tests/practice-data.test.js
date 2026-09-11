// practice-data.test.js — the three PTNK-format practice banks, as data.
//
// Two promises are pinned here, and the second is the reason the menus exist:
//
//   1. Every file holds to the contract (data/reading/SCHEMA.md), and the
//      built banks are the source files, not stale copies.
//   2. FORMAT PARITY WITH THE REAL PAPERS. A child who has done these menus
//      must meet nothing new in format when they open a PTNK paper. So every
//      question shape the eleven real papers use in these sections — 4-option
//      reading MCQ, True/False/Not Given, section-matching by letter, gapped
//      paragraphs by letter, 10-blank cloze (MCQ and typed), and the four-
//      segment error item — must exist in the practice banks, at both levels.
//      The check reads the real bank (js/ptnk-data.js) so it cannot drift.
//
// And one guard the other way: the practice passages are ORIGINAL. No run of
// twelve consecutive words from any practice passage may appear in any real
// PTNK passage — the transcribing agents were refused for reproducing
// published text, and an authoring agent copying a paper would be worse.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(ROOT, 'scripts', 'validate-practice.js'));
const { READING_PASSAGES } = require(path.join(ROOT, 'js', 'reading-data.js'));
const { CLOZE_PASSAGES } = require(path.join(ROOT, 'js', 'cloze-data.js'));
const { ERROR_ITEMS } = require(path.join(ROOT, 'js', 'errors-data.js'));
const { PTNK_EXAMS } = require(path.join(ROOT, 'js', 'ptnk-data.js'));

const files = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter(f => re.test(f)).sort();

suite('practice banks: every source file holds to the contract', () => {
  for (const [kind, dir, re] of [['reading', 'data/reading', /^reading-\d{2}\.json$/], ['cloze', 'data/cloze', /^cloze-\d{2}\.json$/], ['errors', 'data/errors', /^errors-\d{2}\.json$/]]) {
    test(`${kind}: all files valid, twenty-five authors delivered`, () => {
      // 01–10 were the first batch; 11–25 tripled the bank.
      const fs_ = files(dir, re);
      assert.equal(fs_.length, 25, `${kind}: expected 25 files, found ${fs_.length}`);
      for (const f of fs_) {
        const problems = validate(kind, path.join(ROOT, dir, f));
        assert.deepEqual(problems, [], `${dir}/${f}: ${problems.slice(0, 4).join(' | ')}`);
      }
    });
  }

  test('the built banks are the source files (rebuild if this fails)', () => {
    const count = (dir, re, list) => files(dir, re).reduce((s, f) => s + JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'))[list].length, 0);
    assert.equal(READING_PASSAGES.length, count('data/reading', /^reading-\d{2}\.json$/, 'passages'));
    assert.equal(CLOZE_PASSAGES.length, count('data/cloze', /^cloze-\d{2}\.json$/, 'passages'));
    assert.equal(ERROR_ITEMS.length, count('data/errors', /^errors-\d{2}\.json$/, 'items'));
  });

  test('ids are unique across the whole bank', () => {
    for (const [name, bank] of [['reading', READING_PASSAGES], ['cloze', CLOZE_PASSAGES], ['errors', ERROR_ITEMS]]) {
      assert.equal(new Set(bank.map(x => x.id)).size, bank.length, name + ': duplicate ids');
    }
  });

  test('both levels are well stocked', () => {
    const lv = (bank, l) => bank.filter(x => x.level === l).length;
    // Tripled on 2026-09-11: 90 passages, 120 texts, 900 items. The floors sit
    // a little under the counts so a single dropped file is caught, not one
    // trimmed item.
    assert.truthy(lv(READING_PASSAGES, 'kc') >= 40 && lv(READING_PASSAGES, 'ch') >= 40, `reading kc=${lv(READING_PASSAGES, 'kc')} ch=${lv(READING_PASSAGES, 'ch')}`);
    assert.truthy(lv(CLOZE_PASSAGES, 'kc') >= 55 && lv(CLOZE_PASSAGES, 'ch') >= 55, `cloze kc=${lv(CLOZE_PASSAGES, 'kc')} ch=${lv(CLOZE_PASSAGES, 'ch')}`);
    assert.truthy(lv(ERROR_ITEMS, 'kc') >= 420 && lv(ERROR_ITEMS, 'ch') >= 420, `errors kc=${lv(ERROR_ITEMS, 'kc')} ch=${lv(ERROR_ITEMS, 'ch')}`);
    assert.truthy(READING_PASSAGES.length >= 90 && CLOZE_PASSAGES.length >= 120 && ERROR_ITEMS.length >= 900,
      `totals reading=${READING_PASSAGES.length} cloze=${CLOZE_PASSAGES.length} errors=${ERROR_ITEMS.length}`);
  });
});

suite('practice banks: format parity with the real PTNK papers', () => {
  // What the real papers actually use, read from the real bank.
  const real = PTNK_EXAMS.flatMap(e => e.questions.map(q => Object.assign({ level: e.track === 'kc' ? 'kc' : 'ch' }, q)));
  const realReading = real.filter(q => q.section === 'Reading');
  const realHasMcq4 = realReading.some(q => q.type === 'mcq' && q.options.length === 4);
  const realHasLetter = realReading.some(q => q.type === 'text' && q.accept.every(a => /^[A-K]$/.test(a)));
  const realHasTfng = realReading.some(q => /not given/i.test(q.q) || (q.type === 'text' && q.accept.some(a => /^(true|false|not given|ng|t|f)$/i.test(a))));
  const realCloze = real.filter(q => q.section === 'Cloze' || q.section === 'Open cloze');
  const realErrors = real.filter(q => q.section === 'Error correction');

  test('the real papers do use each shape this test demands (so the demand is grounded)', () => {
    assert.truthy(realHasMcq4, 'real reading has 4-option MCQ');
    assert.truthy(realHasLetter, 'real reading has letter-matching (section / gap)');
    assert.truthy(realHasTfng, 'real reading has True/False/Not Given');
    assert.truthy(realCloze.some(q => q.type === 'mcq') && realCloze.some(q => q.type === 'text'), 'real cloze has both MCQ and typed blanks');
    assert.truthy(realErrors.length > 0, 'real papers have error identification');
  });

  test('reading: every real question shape exists in practice, at both levels', () => {
    for (const lv of ['kc', 'ch']) {
      const qs = READING_PASSAGES.filter(p => p.level === lv).flatMap(p => p.questions);
      assert.truthy(qs.some(q => q.type === 'mcq' && q.options.length === 4 && q.kind !== 'tfng'), lv + ': 4-option MCQ');
      assert.truthy(qs.some(q => q.kind === 'tfng'), lv + ': True/False/Not Given');
      assert.truthy(qs.some(q => q.kind === 'inference'), lv + ': inference');
      assert.truthy(qs.some(q => q.kind === 'main-idea'), lv + ': main idea');
      assert.truthy(qs.some(q => q.kind === 'vocab'), lv + ': vocabulary in context');
    }
    const ch = READING_PASSAGES.filter(p => p.level === 'ch').flatMap(p => p.questions);
    assert.truthy(ch.some(q => q.kind === 'section'), 'ch: section-matching by letter');
    assert.truthy(ch.some(q => q.kind === 'gap'), 'ch: gapped paragraphs by letter');
  });

  test('cloze: ten-blank texts in both MCQ and typed form, at both levels', () => {
    for (const lv of ['kc', 'ch']) {
      const ps = CLOZE_PASSAGES.filter(p => p.level === lv);
      assert.truthy(ps.some(p => p.mode === 'mcq'), lv + ': MCQ cloze');
      assert.truthy(ps.some(p => p.mode === 'open'), lv + ': open cloze');
      assert.truthy(ps.every(p => p.questions.length === 10 && p.passage.includes('(10)____')), lv + ': every text has exactly ten blanks');
    }
  });

  test('errors: the same four-segment shape the real papers use', () => {
    // A real item stores its four underlined segments as the options; so
    // does practice. The stem carries (A)…(D) inline in both.
    const realSample = realErrors.find(q => q.type === 'mcq' && q.options.length === 4);
    if (realSample) assert.truthy(/\(A\)[\s\S]*\(D\)/.test(realSample.q), 'grounding: a real item carries (A)…(D) inline');
    for (const lv of ['kc', 'ch']) {
      const its = ERROR_ITEMS.filter(i => i.level === lv);
      assert.truthy(its.every(i => i.options.length === 4 && /\(A\)[\s\S]*\(B\)[\s\S]*\(C\)[\s\S]*\(D\)/.test(i.q)), lv + ': four inline segments');
      assert.truthy(new Set(its.map(i => i.focus)).size >= 8, lv + ': error types are varied');
    }
  });
});

suite('practice banks: the key does not give itself away', () => {
  // The engine draws options in file order — no shuffle. A verifier found
  // whole cloze texts with every key at A: a child who always tapped A scored
  // 100% and learned nothing. Per item set the keys must be spread.
  function slots(qs) { const c = [0, 0, 0, 0]; qs.forEach(q => { c[q.correct]++; }); return c; }

  test('no cloze text puts more than 6 of its 10 keys in one slot', () => {
    const bad = [];
    for (const p of CLOZE_PASSAGES) {
      if (p.mode !== 'mcq') continue;
      const c = slots(p.questions);
      if (Math.max(...c) > 6) bad.push(p.id + ' ' + JSON.stringify(c));
    }
    assert.deepEqual(bad, [], 'a text whose answer is nearly always the same letter');
  });

  test('no reading passage puts all its MCQ keys in one slot', () => {
    const bad = [];
    for (const p of READING_PASSAGES) {
      const mcq = p.questions.filter(q => q.type === 'mcq' && q.options.length === 4);
      if (mcq.length < 4) continue;
      const c = slots(mcq);
      if (Math.max(...c) >= mcq.length - 0) bad.push(p.id + ' ' + JSON.stringify(c));
    }
    assert.deepEqual(bad, []);
  });

  test('across each bank and level, every slot carries at least 15% of the keys', () => {
    for (const [name, qs] of [
      ['cloze', CLOZE_PASSAGES.filter(p => p.mode === 'mcq').flatMap(p => p.questions)],
      ['reading', READING_PASSAGES.flatMap(p => p.questions).filter(q => q.type === 'mcq' && q.options.length === 4)],
      ['errors', ERROR_ITEMS],
    ]) {
      const c = slots(qs);
      const min = Math.min(...c);
      assert.truthy(min >= qs.length * 0.15, `${name}: slots ${JSON.stringify(c)} of ${qs.length} — a slot under 15% is a tell`);
    }
  });
});

suite('practice banks: original material', () => {
  // Task instructions are boilerplate the contract prescribes ("choose the
  // sentence which fits each gap; there are two extra sentences you do not
  // need") and two authors writing the same instruction is not two authors
  // writing the same passage. Strip instruction sentences before shingling.
  const INSTRUCTION = /[^.!?]*\b(fits? (each|the) gap|extra (sentences?|paragraphs?)|do not need|which section|choose the (sentence|paragraph))\b[^.!?]*[.!?]?/gi;
  function shingles(text, n) {
    const w = String(text).replace(/<[^>]+>/g, ' ').replace(INSTRUCTION, ' ').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
    const out = new Set();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  }
  test('no twelve-word run from a practice passage appears in any real PTNK passage', () => {
    const realText = new Set();
    for (const e of PTNK_EXAMS) for (const q of e.questions) if (q.passage) for (const s of shingles(q.passage, 12)) realText.add(s);
    // The built bank stores each passage once, on the paper, not the question.
    for (const e of PTNK_EXAMS) for (const p of e.passages || []) for (const s of shingles(p, 12)) realText.add(s);
    const offenders = [];
    for (const p of READING_PASSAGES.concat(CLOZE_PASSAGES)) {
      for (const s of shingles(p.passage, 12)) if (realText.has(s)) { offenders.push(p.id + ': "' + s + '"'); break; }
    }
    assert.deepEqual(offenders, [], 'practice text copied from a real paper');
  });

  test('no two practice passages share a twelve-word run either', () => {
    const seen = new Map();
    const dupes = [];
    for (const p of READING_PASSAGES.concat(CLOZE_PASSAGES)) {
      for (const s of shingles(p.passage, 12)) {
        if (seen.has(s) && seen.get(s) !== p.id) { dupes.push(p.id + ' ~ ' + seen.get(s)); break; }
        seen.set(s, p.id);
      }
    }
    assert.deepEqual(dupes, [], 'two authors produced overlapping text');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
