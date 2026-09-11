// phonetics-data.test.js — the Phonetics & Stress bank and lessons, as data.
//
// 25 bank files (15 Không chuyên, 10 Chuyên) of 10 pronunciation + 10 stress
// items, each authored by one agent and re-solved blind by a verifier; 16
// lessons, each reviewed for phonetic accuracy. This holds every file to
// data/phonetics/SCHEMA.md inside the suite, checks the built files are the
// sources, and pins what one author cannot see: the rule mix over the bank,
// no key word or option set coming back across files, the correct slot
// spread over each tier, and every rule with a lesson behind it.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validateBank, validateLesson, PER_FILE, SOUND_RULES, STRESS_RULES } = require(path.join(ROOT, 'scripts', 'validate-phonetics.js'));
const { PHONETICS_ITEMS } = require(path.join(ROOT, 'js', 'phonetics-data.js'));
const { PHONETICS_LESSONS } = require(path.join(ROOT, 'js', 'phonetics-lessons.js'));

const DIR = path.join(ROOT, 'data', 'phonetics');
const files = () => fs.readdirSync(DIR).filter(f => /^ph-\d{2}\.json$/.test(f)).sort();
const lfiles = () => fs.readdirSync(path.join(DIR, 'lessons')).filter(f => /^lesson-\d{2}\.json$/.test(f)).sort();
const load = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

suite('Phonetics & Stress files: contract', () => {
  test('25 bank files, 15 kc + 10 ch, every one valid', () => {
    const fs_ = files();
    assert.equal(fs_.length, 25, 'expected 25 files, found ' + fs_.length);
    const levels = { kc: 0, ch: 0 };
    for (const f of fs_) {
      const problems = validateBank(path.join(DIR, f));
      assert.deepEqual(problems, [], f + ': ' + problems.slice(0, 4).join(' | '));
      levels[load(f).level]++;
    }
    assert.deepEqual(levels, { kc: 15, ch: 10 });
  });

  test('16 lessons, every one valid, keys unique', () => {
    const fs_ = lfiles();
    assert.equal(fs_.length, 16, 'expected 16 lessons, found ' + fs_.length);
    for (const f of fs_) {
      const problems = validateLesson(path.join(DIR, 'lessons', f));
      assert.deepEqual(problems, [], f + ': ' + problems.slice(0, 4).join(' | '));
    }
    assert.equal(new Set(PHONETICS_LESSONS.map(l => l.key)).size, 16);
  });

  test('the built bank and lessons are exactly the files (rebuild if this fails)', () => {
    const src = files().flatMap(f => load(f).items);
    assert.equal(PHONETICS_ITEMS.length, 25 * PER_FILE);
    assert.deepEqual(PHONETICS_ITEMS.map(q => q.id), src.map(q => q.id));
    assert.deepEqual(PHONETICS_ITEMS[0], src[0]);
    assert.deepEqual(PHONETICS_LESSONS.map(l => l.key), lfiles().map(f => load(path.join('lessons', f)).key));
  });
});

suite('Phonetics & Stress bank: what one file cannot see', () => {
  const kc = PHONETICS_ITEMS.filter(q => q.level === 'kc'), ch = PHONETICS_ITEMS.filter(q => q.level === 'ch');
  const sound = PHONETICS_ITEMS.filter(q => q.kind === 'sound'), stress = PHONETICS_ITEMS.filter(q => q.kind === 'stress');
  const key = q => String(q.words[q.correct]).toLowerCase();

  test('half sound, half stress; the paper\'s favourite rules are all well represented', () => {
    assert.equal(sound.length, stress.length);
    // From the 22 real items (2021–2026): -ed and -s endings, vowel letters,
    // silent letters and the s/ʃ contrast on the sound side; two-syllable
    // noun/verb and suffix-driven stress on the other.
    const count = (items, rule) => items.filter(q => q.rule === rule).length;
    for (const r of ['ed', 'es', 'silent', 'oo-ou-ow', 'c-g', 'ch-sh-th-gh', 's-z-sh', 'a', 'e', 'i', 'o']) assert.truthy(count(sound, r) >= 10, `sound rule ${r}: ${count(sound, r)}`);
    for (const r of ['2syl', 'suffix-shift', '3syl', 'suffix-final', '4syl']) assert.truthy(count(stress, r) >= 10, `stress rule ${r}: ${count(stress, r)}`);
    assert.truthy(new Set(sound.map(q => q.rule)).size >= 13 && new Set(stress.map(q => q.rule)).size >= 8, 'rules covered');
  });

  test('no key word is the odd one out more than three times a tier, and no option set repeats', () => {
    for (const [name, items] of [['kc', kc], ['ch', ch]]) {
      const c = {}; items.forEach(q => { c[key(q)] = (c[key(q)] || 0) + 1; });
      const heavy = Object.entries(c).filter(([, n]) => n > 3).map(([w, n]) => `${w}×${n}`);
      assert.deepEqual(heavy, [], name + ': ' + heavy.join(', '));
    }
    const sets = new Map(), dupes = [];
    for (const q of PHONETICS_ITEMS) {
      const k = q.words.map(w => w.toLowerCase()).sort().join('|');
      if (sets.has(k)) dupes.push(q.id + '=' + sets.get(k));
      sets.set(k, q.id);
    }
    assert.deepEqual(dupes, []);
  });

  test('the correct option is spread across A–D over each tier', () => {
    for (const [name, items] of [['kc', kc], ['ch', ch]]) {
      const c = [0, 0, 0, 0]; items.forEach(q => c[q.correct]++);
      assert.truthy(Math.min(...c) >= items.length * 0.18, `${name}: slots ${JSON.stringify(c)} of ${items.length}`);
    }
  });

  test('stress items: all four words share a syllable count, three share the stress, the key differs — over the whole bank', () => {
    for (const q of stress) {
      assert.equal(new Set(q.syllables).size, 1, q.id);
      const others = q.stress.filter((_, k) => k !== q.correct);
      assert.equal(new Set(others).size, 1, q.id);
      assert.truthy(others[0] !== q.stress[q.correct], q.id);
      // The IPA stress mark must sit in the syllable the data claims — at
      // least: a word stressed on syllable 1 starts with ˈ, later ones do not.
      q.ipa.forEach((ipa, k) => {
        const first = /^\/ˈ/.test(ipa);
        assert.equal(first, q.stress[k] === 1, `${q.id}: ${q.words[k]} ${ipa} vs stress ${q.stress[k]}`);
      });
    }
  });

  test('every bank rule has a lesson behind it, and the lessons cover the exam strategy', () => {
    const keys = new Set(PHONETICS_LESSONS.map(l => l.key));
    const LESSON_FOR = { 'ea-ee-ie': 'e', prefix: '3syl', compound: '3syl', 'suffix-neutral': 'suffix-shift', 'suffix-final': 'suffix-shift', '4syl': '3syl', h: 'silent', 'prefix-ex': 'silent', other: 'strategy' };
    const missing = [...new Set(PHONETICS_ITEMS.map(q => q.rule))].filter(r => !keys.has(r) && !keys.has(LESSON_FOR[r]));
    assert.deepEqual(missing, [], 'rules without a lesson: ' + missing.join(', '));
    assert.truthy(keys.has('strategy'), 'the exam-strategy lesson');
    for (const l of PHONETICS_LESSONS) assert.truthy(/Bẫy/.test(l.content) && /Cách làm bài/.test(l.content), l.key);
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
