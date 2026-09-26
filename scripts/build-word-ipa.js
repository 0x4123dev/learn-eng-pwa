#!/usr/bin/env node
// build-word-ipa.js — the IPA line under a revealed answer.
//
//   node scripts/build-word-ipa.js --cmudict /path/to/cmudict.dict
//
// Writes data/career-paths/ipa.json: every word of the three Books mapped to
// its General-American pronunciation, which scripts/build-word-data.js then
// carries into js/word-data.js as each word's `ipa`.
//
// The pronunciations are NOT invented here: they come from the CMU
// Pronouncing Dictionary (cmusphinx/cmudict, a hand-curated ARPABET lexicon),
// translated phoneme by phoneme. That is the whole point of a generated file
// — a model writing IPA from memory gets vowels and stress subtly wrong, and
// a learner cannot tell. The dictionary is not vendored (3.6 MB for 610
// words); pass its path, or the script says where to fetch it. The OUTPUT is
// committed, so nobody needs it to build the app.
//
// Words CMUdict does not carry (acronyms said as letters, compounds, one
// number) are in OVERRIDES below, written out by hand and kept short.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'career-paths', 'ipa.json');
const SOURCE = 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict';

// ARPABET → IPA, General American. Vowels carry a stress digit (0/1/2) which
// is stripped here and turned into ˈ/ˌ on the syllable, below.
const PHONES = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  EH: 'ɛ', ER: 'ɜr', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ',
  OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ',
  K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
// Unstressed AH is schwa and unstressed ER is the r-coloured schwa: the
// commonest sounds in English, and the ones a table of stressed values gets
// wrong ("advocate" is ˈædvəkət, never ˈædvʌkʌt).
const UNSTRESSED = { AH: 'ə', ER: 'ər' };
const VOWEL = /^([A-Z]+)([0-2])$/;

// Clusters a syllable INSIDE a word may start with, used to decide where a
// run of consonants splits. Deliberately only obstruent + liquid/glide: the
// s-clusters are left out although English words can begin with them,
// because between two vowels the s belongs to the syllable before it —
// "discussion" is dɪsˈkʌʃən (dis-cus-sion), not dɪˈskʌʃən. A consonant run
// that forms nothing on this list leaves one consonant to the next syllable,
// which is the maximal-onset rule for every ordinary V-C-V word.
// (A word's FIRST onset is built as the phonemes arrive, so "strategy" and
// "speech" keep their str-/sp- whatever is listed here.)
const ONSETS = new Set([
  // NB the IPA script ɡ (U+0261), which is what PHONES emits.
  'bl', 'br', 'dr', 'dw', 'fl', 'fr', 'ɡl', 'ɡr', 'ɡw', 'kl', 'kr', 'kw',
  'pl', 'pr', 'tr', 'θr', 'ʃr',
  // Yod clusters: "communication" is kəˌmjunəˈkeɪʃən, never kəmˌjunə…
  'bj', 'dj', 'fj', 'hj', 'kj', 'lj', 'mj', 'nj', 'pj', 'sj', 'tj', 'vj',
  // s + glide/nasal/fricative, but never s + stop: "persuade" is pərˈsweɪd
  // while "discussion" is dɪsˈkʌʃən.
  'sf', 'sl', 'sm', 'sn', 'sw',
]);

// CMUdict has no entry for these. Hand-written, in the same notation the
// converter emits (no length marks, ˈ primary / ˌ secondary stress).
const OVERRIDES = {
  // Compounds. CMUdict has no entry for these, and gluing the pieces
  // together would print two primary stresses ("ˈwʌnˈweɪ") or none at all,
  // so each is written the way a dictionary sets it: the head keeps ˈ and
  // the other element takes ˌ.
  'third-party': 'ˌθɜrdˈpɑrti',
  'one-way communication': 'ˌwʌnˈweɪ kəˌmjunəˈkeɪʃən',
  'two-way communication': 'ˌtuˈweɪ kəˌmjunəˈkeɪʃən',
  'multi-tasking': 'ˈmʌltiˌtæskɪŋ',
  'problem-solving': 'ˈprɑbləmˌsɑlvɪŋ',
  'cause-related marketing': 'ˌkɑzrɪˈleɪtɪd ˈmɑrkətɪŋ',
  'e-kit': 'ˈiˌkɪt',
  'e-release': 'ˈiriˌlis',
  'B-roll': 'ˈbiˌroʊl',
  'user-generated': 'ˌjuzərˈdʒɛnəreɪtɪd',
  'on-the-job': 'ˌɑnðəˈdʒɑb',
  '24-hour': 'ˌtwɛntifɔrˈaʊər',
  // Said as letters.
  'RFP': 'ˌɑrˌɛfˈpi',
  'MBO': 'ˌɛmˌbiˈoʊ',
  'ANR': 'ˌeɪˌɛnˈɑr',
  'PSA': 'ˌpiˌɛsˈeɪ',
  'VNR': 'ˌviˌɛnˈɑr',
  'RSS': 'ˌɑrˌɛsˈɛs',
  'vlog': 'vlɑɡ',
  'verbalized': 'ˈvɜrbəlaɪzd',
  'brochureware': 'broʊˈʃʊrwɛr',
  'speechwriting': 'ˈspitʃˌraɪtɪŋ',
  'defeasibility': 'dɪˌfizəˈbɪləti',
};

function loadCmudict(file) {
  const dict = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith(';;;')) continue;
    const [word, ...rest] = line.split(' ');
    // "record(2)" is the second pronunciation of "record"; the first entry
    // wins, as it does in the dictionary's own ordering.
    const base = word.replace(/\(\d\)$/, '');
    if (dict.has(base)) continue;
    dict.set(base, rest.join(' ').replace(/\s*#.*$/, '').trim().split(/\s+/));
  }
  return dict;
}

// ARPABET phonemes → one IPA string with stress marks at syllable starts.
function toIpa(phones) {
  const syllables = [];
  let cur = { onset: [], nucleus: null, coda: [], stress: 0 };
  for (const p of phones) {
    const m = p.match(VOWEL);
    if (m) {
      const [, sym, stress] = m;
      if (cur.nucleus) { syllables.push(cur); cur = { onset: [], nucleus: null, coda: [], stress: 0 }; }
      cur.nucleus = (stress === '0' && UNSTRESSED[sym]) ? UNSTRESSED[sym] : (PHONES[sym] || '');
      cur.stress = Number(stress);
    } else if (cur.nucleus) {
      cur.coda.push(PHONES[p] || '');
    } else {
      cur.onset.push(PHONES[p] || '');
    }
  }
  if (cur.nucleus) syllables.push(cur);
  if (!syllables.length) return '';

  // Maximal onset: hand consonants from one syllable's coda to the next
  // syllable's onset while what results is a cluster English can start with.
  for (let i = 0; i < syllables.length - 1; i++) {
    const coda = syllables[i].coda, next = syllables[i + 1];
    while (coda.length) {
      const candidate = [coda[coda.length - 1]].concat(next.onset);
      // Always give the last consonant away when the next syllable has none
      // (V-C-V is always V-CV). A CLUSTER only moves onto a stressed
      // syllable, which is what pulls it. `tw`/`dw` are left off the list
      // although English begins words with them: in this bank they only ever
      // occur across a compound seam — ˈnɛtwɜrk, ˈtuweɪ — where the split
      // belongs before the w.
      const ok = next.onset.length === 0
        || (next.stress > 0 && ONSETS.has(candidate.join('')));
      if (!ok) break;
      next.onset = candidate;
      coda.pop();
    }
  }

  const out = syllables
    .map(s => (s.stress === 1 ? 'ˈ' : s.stress === 2 ? 'ˌ' : '') + s.onset.join('') + s.nucleus + s.coda.join(''))
    .join('');
  // A stress mark on a word with one syllable says nothing.
  return syllables.length === 1 ? out.replace(/^[ˈˌ]/, '') : out;
}

function ipaFor(word, dict) {
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, word)) return OVERRIDES[word];
  // A multi-word entry ("word of mouth", "in-house") is each part in turn.
  const parts = String(word).toLowerCase().split(/[\s]+/).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const key = part.replace(/[^a-z'-]/g, '');
    if (dict.has(key)) { out.push(toIpa(dict.get(key))); continue; }
    // A hyphenated compound CMUdict does not carry goes to OVERRIDES: gluing
    // its pieces together would print two primary stresses, or none, and a
    // learner reading it aloud would stress the wrong half.
    return null;
  }
  return out.join(' ');
}

function build(cmudictPath) {
  const data = require(path.join(ROOT, 'js', 'word-data.js'));
  const words = [].concat(data.UNIT_WORDS_PR1, data.UNIT_WORDS_PR2, data.UNIT_WORDS_PR3).map(w => w.en);
  const dict = loadCmudict(cmudictPath);
  const out = {};
  const missing = [];
  for (const en of words) {
    if (out[en]) continue;
    const ipa = ipaFor(en, dict);
    if (!ipa) { missing.push(en); continue; }
    out[en] = ipa;
  }
  if (missing.length) {
    console.error('build-word-ipa: no pronunciation for ' + missing.length + ' word(s):');
    for (const m of missing) console.error('  - ' + m + '   (add it to OVERRIDES)');
    return 1;
  }
  const sorted = {};
  for (const k of Object.keys(out).sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)) sorted[k] = out[k];
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n');
  console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + Object.keys(sorted).length + ' pronunciations');
  return 0;
}

module.exports = { toIpa, ipaFor, loadCmudict, OVERRIDES, PHONES, OUT };

if (require.main === module) {
  const i = process.argv.indexOf('--cmudict');
  const file = i > 0 ? process.argv[i + 1] : '';
  if (!file || !fs.existsSync(file)) {
    console.error('usage: build-word-ipa.js --cmudict <cmudict.dict>');
    console.error('  get it with:  curl -O ' + SOURCE);
    process.exit(2);
  }
  process.exit(build(file));
}
