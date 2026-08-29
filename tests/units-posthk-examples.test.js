// units-posthk-examples.test.js — the example sentence that teaches each Post term.
//
// The Post set is 197 maths/science glossary terms, and the child meets these
// CONCEPTS in the app before school teaches them. A two-word Vietnamese gloss
// ("hiệu", "thể") cannot carry a concept on its own, so every term gains an
// English sentence plus its Vietnamese translation — and the sentence has to
// DEFINE by showing, not merely use the word.
//
// Design: docs/superpowers/specs/2026-08-29-post-example-sentences-design.md
//
// These tests guard the properties a human reviewer cannot check 197 times:
// that the blank can actually be built, that the sentence stays short, and —
// the important one — that no sentence explains an unknown word with another
// unknown word.
const { suite, test, assert } = require('./harness');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { UNIT_WORDS_POSTHK: POST } = require(path.join(ROOT, 'js', 'units-posthk-data.js'));
const { UNIT_WORDS: PRE } = require(path.join(ROOT, 'js', 'units-data.js'));
const { UNIT_WORDS_HK1: HK1 } = require(path.join(ROOT, 'js', 'units-hk1-data.js'));
const { UNIT_WORDS_HK2: HK2 } = require(path.join(ROOT, 'js', 'units-hk2-data.js'));

const MAX_WORDS = 12;

// Terms deliberately without an example yet. Every entry needs a reason.
const NO_EXAMPLE = {
  // The glossary lemma carries "one's", which no natural sentence ever contains,
  // so no example could hold the term verbatim. The idea is taught instead by the
  // sentence for 'producer': a green plant makes its own food.
  "make one's own food": 'lemma contains one\'s; taught by the producer sentence',
};

// Brackets in a lemma mean two different things, so a sentence may spell the
// term either way and both forms are blankable:
//   `greater (than)`       — an attached part:  "9 is greater than 4"
//   `DIY (Do It Yourself)` — an expansion:      "DIY (Do It Yourself) means…"
function blankForms(en) {
  const literal = String(en).trim();
  const stripped = literal.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  return literal === stripped ? [literal] : [literal, stripped];
}
function wordsOf(text) {
  return String(text).toLowerCase()
    .replace(/[—–,.:;?!"()\[\]]/g, ' ')
    .split(/\s+/).filter(Boolean);
}
// Numbers, maths symbols and bare punctuation carry no reading load.
function isNumberish(w) {
  // numbers, maths symbols, and a bare letter label like the C in vitamin C
  return /^[0-9+\-=:×÷/.,¾½¼%]+$/.test(w) || /^[a-z]$/.test(w);
}

// Everything the child can already read: every term in all four sets, in any
// simple inflected form, plus the function and everyday words below.
// The four sets are TOPIC vocabulary — the Pre set is 169 picture nouns like
// 'doctor'. Everyday English (colours, position, time, common verbs) is not in
// any bank, so it lives here. Keep this list to words a Grade 4 learner plainly
// knows: the rule exists to stop one TECHNICAL term explaining another, and it
// stops working if technical words are quietly added below.
const EXTRA_WORDS = `a an and are as at be because book books but buy by can do does
  each every for from get gives go has have here how if in is it its like look
  make makes many me more much must no not of off on one or other others our out
  put same see so some take than that the their them then there these they this
  those to two up us use used we what when where which who why will with without
  yet you your all both into over under after before again another any around
  away back down first give if just keep know last left let long may new next
  now often only open place put right same say short small still such sure take
  tell things think three time times too very want way well what while would
  everything something anything nothing does did done goes going came come
  red blue green yellow black white brown colour colours my your his her
  year years day days minute minutes hour hours week month
  top bottom side sides middle corner corners part parts piece pieces
  meet meets show shows draw draws measure never always together flat wide
  big bigger small smaller tall short high low near far full empty
  kilogram kilograms gram grams metre metres centimetre centimetres cm
  eat eats eating drink drinks live lives lived move moves moving
  hot cold warm cool dry wet hard easy slow fast
  animal animals plant plants people person child children
  water air sun sky ground box boxes cake rice bread egg eggs
  hear hears wall glass run play cannot room turn read everyone music
  class end ice dark tree trees hit touch grey something things thing
  dog dogs cow cows leaf leaves become becomes sleep night field stone
  hide sea hold holds root roots fly flies green white someone door
  wet ground near only who them they its there then good sugar group
  wash hands hand milk stay lot better ones old bones bone called bin
  bad soup sweet teeth tooth carrot fruit means mean yourself body well
  people made keep put drink eating person child children each about
`
  .split(/\s+/).filter(Boolean);

const KNOWN = new Set();
for (const bank of [PRE, HK1, HK2, POST]) {
  for (const w of bank) for (const part of wordsOf(w.en)) KNOWN.add(part);
}
for (const w of EXTRA_WORDS) KNOWN.add(w);

// Accept the simple inflections a Grade 4 sentence needs: eats → eat,
// moves → move, boxes → box, carries → carry, hotter → hot.
function isKnown(w) {
  if (KNOWN.has(w) || isNumberish(w)) return true;
  const stems = [
    w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y'),
    w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ied$/, 'y'),
    w.replace(/ing$/, ''), w.replace(/ing$/, 'e'),
    w.replace(/er$/, ''), w.replace(/est$/, ''), w.replace(/ly$/, ''),
    // doubled consonant: bigger/biggest → big, hotter → hot
    w.replace(/([a-z])\1(er|est|ing|ed)$/, '$1'),
  ];
  return stems.some(s => s.length > 1 && KNOWN.has(s));
}

const withExample = POST.filter(w => w.ex);

suite('post examples: every term is taught by a sentence', () => {
  test('every term has an example sentence and a translation', () => {
    const missing = POST.filter(w => !w.ex && !NO_EXAMPLE[w.en]).map(w => `u${w.unit} ${w.en}`);
    assert.deepEqual(missing, [], missing.length + ' terms still need a sentence');
    const noVi = POST.filter(w => w.ex && !w.exVi).map(w => w.en);
    assert.deepEqual(noVi, [], 'an English sentence without its translation teaches nothing');
  });

  test('a term skipped on purpose says why', () => {
    for (const [en, reason] of Object.entries(NO_EXAMPLE)) {
      assert.truthy(POST.some(w => w.en === en), en + ' is not a Post term');
      assert.truthy(String(reason).length > 10, en + ' needs a real reason, not a shrug');
    }
  });
});

suite('post examples: the blank can always be built', () => {
  for (const w of withExample) {
    test(`u${w.unit} "${w.en}" appears exactly once, in its exact form`, () => {
      const counts = blankForms(w.en).map(target => {
        const re = new RegExp('(^|[^A-Za-z-])' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z-])', 'gi');
        return { target, hits: (w.ex.match(re) || []).length };
      });
      assert.truthy(counts.some(c => c.hits === 1),
        `"${w.ex}" must contain the term exactly once — tried ` +
        counts.map(c => `"${c.target}" (${c.hits})`).join(', '));
    });
  }
});

suite('post examples: short enough for a Grade 4 reader', () => {
  test(`no sentence is longer than ${MAX_WORDS} words`, () => {
    const long = withExample
      .map(w => ({ en: w.en, n: wordsOf(w.ex).length, ex: w.ex }))
      .filter(x => x.n > MAX_WORDS);
    assert.deepEqual(long.map(x => `${x.en} (${x.n}w)`), [],
      'too long: ' + long.map(x => x.ex).join(' | '));
  });
});

suite('post examples: never explain an unknown word with another unknown word', () => {
  // The rule the whole design rests on. A sentence may only use words the
  // child has already met in one of the four sets, or plain function words.
  test('every word in every sentence is one the child can already read', () => {
    const offenders = [];
    for (const w of withExample) {
      const unknown = wordsOf(w.ex).filter(x => !isKnown(x));
      if (unknown.length) offenders.push(`${w.en}: ${unknown.join(', ')}`);
    }
    assert.deepEqual(offenders, [],
      offenders.length + ' sentence(s) use words the child has not met:\n  ' + offenders.join('\n  '));
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}

suite('post examples: the card shows the sentence, then the translation', () => {
  // The sentence is context AND the retrieval cue while answering; the
  // Vietnamese is held back until after the answer so the card cannot give
  // itself away. Rendering is driven by the same term-matching as the data
  // checks above, so a sentence that passes those always produces a blank.
  const units = (() => {
    const prev = { appState: global.appState, currentUser: global.currentUser,
      saveUserData: global.saveUserData, document: global.document };
    global.appState = global.appState || {};
    global.currentUser = global.currentUser || 'tester';
    global.saveUserData = global.saveUserData || (() => {});
    global.document = global.document || { getElementById: () => null, querySelectorAll: () => [] };
    const mod = require(path.join(ROOT, 'js', 'units.js'));
    Object.assign(global, {}); // keep the stubs in place for the module's lifetime
    void prev;
    return mod;
  })();

  const term = en => POST.find(w => w.en === en);

  test('while answering, the term is a blank and never leaks into the card', () => {
    const w = term('difference');
    const html = units._unitExampleHTML(w, false);
    assert.truthy(html.includes('______'), 'the sentence must show a blank');
    assert.falsy(/\bdifference\b/i.test(html), 'the answer must not appear on the question card');
    assert.truthy(html.includes('between 9 and 4'), 'the rest of the sentence is the context');
    assert.falsy(html.includes(w.exVi), 'the translation is held back until after the answer');
  });

  test('after answering, the sentence completes and the translation appears', () => {
    const w = term('difference');
    const html = units._unitExampleHTML(w, true);
    assert.truthy(/\bdifference\b/i.test(html), 'the term fills in');
    assert.falsy(html.includes('______'), 'no blank is left');
    assert.truthy(html.includes(unitsEsc(w.exVi)), 'the Vietnamese meaning is what teaches the concept');
  });

  test('a multi-word term is blanked as one whole phrase', () => {
    const w = term('food chain');
    const html = units._unitExampleHTML(w, false);
    assert.truthy(html.includes('______'));
    assert.falsy(/\bfood chain\b/i.test(html), 'neither half of the phrase may show');
  });

  test('a bracketed term blanks the form the sentence actually uses', () => {
    const w = term('greater (than)');
    const html = units._unitExampleHTML(w, false);
    assert.truthy(html.includes('______'), '"9 is greater than 4" must blank "greater than"');
    assert.falsy(/\bgreater\b/i.test(html));
  });

  test('a term with no sentence renders nothing at all', () => {
    assert.equal(units._unitExampleHTML({ en: 'x', vi: 'y' }, false), '');
    assert.equal(units._unitExampleHTML(null, false), '');
  });

  test('the card is wired into the question renderer', () => {
    const src = require('fs').readFileSync(path.join(ROOT, 'js', 'units.js'), 'utf8');
    assert.truthy(src.includes('_unitExampleHTML(q.w, answered)'),
      'renderUnitQuestion must place the sentence on the card');
    assert.truthy(src.indexOf('_unitExampleHTML(q.w, answered)') < src.indexOf('_unitGapHTML(q.gap, answered)'),
      'the sentence reads above the letters the child fills in');
  });
});

// The module escapes with its own helper; mirror it for the assertions above.
function unitsEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
