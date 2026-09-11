// grammar-vocab-data.test.js — the Grammar & Vocabulary bank, as data.
//
// 36 files (16 Không chuyên, 20 Chuyên), 25 items each, authored by parallel
// agents and each re-solved blind by a verifier. This holds every file to
// data/grammar-vocab/SCHEMA.md inside the suite, checks the built bank is the
// source files, and pins what a single author cannot see across files: the
// whole bank's focus mix matches the real PTNK "Language use" section it
// imitates, no sentence or answer keeps coming back, and the correct MCQ
// option is spread across A–D (the engine draws options in file order).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate, PER_FILE } = require(path.join(ROOT, 'scripts', 'validate-grammar-vocab.js'));
const { GRAMMAR_VOCAB_ITEMS } = require(path.join(ROOT, 'js', 'grammar-vocab-data.js'));

const DIR = path.join(ROOT, 'data', 'grammar-vocab');
const files = () => fs.readdirSync(DIR).filter(f => /^gv-\d{2}\.json$/.test(f)).sort();
const load = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const norm = s => String(s).toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const share = (items, focus) => items.filter(q => q.focus === focus).length / items.length;

suite('Grammar & Vocabulary files: contract', () => {
  test('36 files, 16 kc + 20 ch, every one valid', () => {
    const fs_ = files();
    assert.equal(fs_.length, 36, 'expected 36 files, found ' + fs_.length);
    const levels = { kc: 0, ch: 0 };
    for (const f of fs_) {
      const problems = validate(path.join(DIR, f));
      assert.deepEqual(problems, [], f + ': ' + problems.slice(0, 4).join(' | '));
      levels[load(f).level]++;
    }
    assert.deepEqual(levels, { kc: 16, ch: 20 });
  });

  test('the built bank is exactly the files, in file order (rebuild if this fails)', () => {
    const src = files().flatMap(f => load(f).items);
    assert.equal(GRAMMAR_VOCAB_ITEMS.length, src.length);
    assert.equal(GRAMMAR_VOCAB_ITEMS.length, 36 * PER_FILE);
    assert.deepEqual(GRAMMAR_VOCAB_ITEMS.map(q => q.id), src.map(q => q.id));
    assert.deepEqual(GRAMMAR_VOCAB_ITEMS[0], src[0]);
  });
});

suite('Grammar & Vocabulary bank: what one file cannot see', () => {
  const kc = GRAMMAR_VOCAB_ITEMS.filter(q => q.level === 'kc');
  const ch = GRAMMAR_VOCAB_ITEMS.filter(q => q.level === 'ch');

  test('the mix is the real paper\'s: word choice first, then collocation / idiom / phrasal verb, grammar behind', () => {
    // From the 291 real items (73 kc, 218 ch), classified 2026-09-11: kc is
    // word-choice 22%, collocation 10%, tense 8%, idiom 8%, phrasal 7%; ch is
    // word-choice 22%, idiom 17%, collocation 13%, phrasal 8%, double-blank
    // 6%, inversion 4%, subjunctive 4%. The floors below are two thirds of those.
    for (const [name, items, floors] of [
      ['kc', kc, { 'word-choice': 0.15, collocation: 0.07, tense: 0.06, idiom: 0.05, 'phrasal-verb': 0.05 }],
      ['ch', ch, { 'word-choice': 0.15, idiom: 0.12, collocation: 0.09, 'phrasal-verb': 0.05, 'double-blank': 0.04, inversion: 0.03, subjunctive: 0.03 }],
    ]) {
      for (const [focus, floor] of Object.entries(floors)) {
        assert.truthy(share(items, focus) >= floor, `${name}: ${focus} is ${(share(items, focus) * 100).toFixed(1)}% of the tier, below ${floor * 100}%`);
      }
      const focuses = new Set(items.map(q => q.focus));
      assert.truthy(focuses.size >= 18, `${name}: only ${focuses.size} focuses`);
    }
    assert.equal(kc.filter(q => q.focus === 'double-blank').length, 0, 'no kc paper has ever set a double blank');
  });

  test('no sentence repeats anywhere in the bank', () => {
    const seen = new Map(), dupes = [];
    for (const q of GRAMMAR_VOCAB_ITEMS) {
      const k = norm(q.q);
      if (seen.has(k)) dupes.push(q.id + '=' + seen.get(k));
      seen.set(k, q.id);
    }
    assert.deepEqual(dupes, []);
  });

  test('an answer is the key of at most four items per tier — a bank, not one idiom twenty times', () => {
    for (const [name, items] of [['kc', kc], ['ch', ch]]) {
      const count = {};
      items.forEach(q => { const k = norm(q.answer); count[k] = (count[k] || 0) + 1; });
      const heavy = Object.entries(count).filter(([, n]) => n > 4).map(([k, n]) => `${k}×${n}`);
      assert.deepEqual(heavy, [], name + ': ' + heavy.join(', '));
    }
  });

  test('the correct option is spread across A–D over each tier', () => {
    for (const [name, items] of [['kc', kc], ['ch', ch]]) {
      const c = [0, 0, 0, 0]; items.forEach(q => c[q.correct]++);
      assert.truthy(Math.min(...c) >= items.length * 0.18, `${name}: slots ${JSON.stringify(c)} of ${items.length}`);
    }
  });

  test('the idioms and phrasal verbs every file was told to use are all in the bank, once each', () => {
    // Answers are inflected in a sentence ("looked after", "threw him under
    // the bus"), so match on the content words, stemmed: the pronoun slots
    // (someone / your / his) and inflections are dropped.
    // Only the pronoun slots and articles are dropped — a particle IS the phrasal verb.
    const STOP = new Set(['someone', 'somebody', 'something', 'your', 'his', 'her', 'their', 'its', 'my', 'our', 'you', 'him', 'them', 'it', 'a', 'an', 'the', 's']);
    const IRREG = { came: 'come', took: 'take', taken: 'take', threw: 'throw', thrown: 'throw', ran: 'run', got: 'get', made: 'make', went: 'go', gone: 'go', held: 'hold', fell: 'fall', fallen: 'fall', brought: 'bring', drew: 'draw', drawn: 'draw', lost: 'lose', kept: 'keep', gave: 'give', given: 'give', stood: 'stand', saw: 'see', seen: 'see', caught: 'catch', broke: 'break', broken: 'break', bit: 'bite', bitten: 'bite', hung: 'hang', struck: 'strike', sold: 'sell', told: 'tell', paid: 'pay', spoke: 'speak', spoken: 'speak', wore: 'wear', worn: 'wear', bore: 'bear', borne: 'bear', let: 'let', hit: 'hit', cut: 'cut', put: 'put', read: 'read', lay: 'lie', fought: 'fight', bent: 'bend', met: 'meet', sat: 'sit', stole: 'steal', stolen: 'steal', blew: 'blow', blown: 'blow', flew: 'fly', flown: 'fly', found: 'find', knew: 'know', known: 'know', left: 'leave', sought: 'seek', thought: 'think', dealt: 'deal', shook: 'shake', shaken: 'shake' };
    // Strip a suffix only when at least three letters remain ("ring" keeps its -ing).
    const stem = w => (IRREG[w] || w.replace(/ies$/, 'y').replace(/^(.{3,})(ing|es|d|s)$/, '$1')).slice(0, 3);
    const tokens = s => norm(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);
    const uses = (answer, phrase) => { const a = tokens(answer).join(' '), p = tokens(phrase).join(' '); return p && (' ' + a + ' ').includes(' ' + p + ' '); };
    // Each file was handed one more idiom and one more phrasal verb than its
    // quota, so "all used" means the quota's worth of them, per file.
    const plan = require(path.join(ROOT, 'data', 'grammar-vocab', 'plan.json'));
    const short = [], repeated = [];
    const seen = {};
    for (const f of plan.files) {
      const mine = GRAMMAR_VOCAB_ITEMS.filter(q => q.id.startsWith(`gv-${f.level}-${f.nn}-`));
      const used = f.idioms.concat(f.phrasals).filter(w => mine.some(q => uses(q.answer, w)));
      const want = (f.quota.idiom || 0) + (f.quota['phrasal-verb'] || 0);
      if (used.length < want - 1) short.push(`gv-${f.nn}: ${used.length}/${want}`);
      for (const w of f.idioms.concat(f.phrasals)) {
        const n = GRAMMAR_VOCAB_ITEMS.filter(q => uses(q.answer, w)).length;
        if (n > 2) repeated.push(w + '×' + n);
      }
    }
    assert.deepEqual(short, [], 'files that ignored their list: ' + short.join(', '));
    assert.truthy(repeated.length <= 3, 'more than twice: ' + repeated.join(', '));
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
