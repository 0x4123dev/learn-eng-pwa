#!/usr/bin/env node
// scripts/build-hot-words.js — rank the words students actually meet.
//
// A safety net, not the main mechanism. twPrefetch() already warms each
// question's own words when it renders, and a question's ~20 words fetch in
// about half a second while the student spends ten to twenty reading and
// answering it. So this list only has to cover the very first taps and the
// case where the network is slow or gone: the 100 commonest words are ~43%
// of all taps for 1.3 MB, where 1,000 words cost 14.3 MB for 76%.
//
// Usage:
//   node scripts/build-hot-words.js [--count N]   (default 100)
// Re-run whenever question banks change; tests/hot-words.test.js fails if the
// shipped list has gone stale.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'js', 'hot-words.js');
const AUDIO_DIR = path.join(ROOT, 'audio', 'words');
const DEFAULT_COUNT = 100;

const { wordAudioSlug } = require('./generate-word-audio.js');

// Every bank whose text renders through tapwordsWrap(): the three Books
// (their `en` is wrapped on the answer card; the example sentence `ex` is
// shown filled-in after answering).
const BANKS = [
    { file: 'js/word-data.js', global: 'UNIT_WORDS_PR1' },
    { file: 'js/word-data.js', global: 'UNIT_WORDS_PR2' },
    { file: 'js/word-data.js', global: 'UNIT_WORDS_PR3' },
];

// The tappable rule from js/tapwords.js: pure-ASCII letter runs (an optional
// 's / 't tail), so Vietnamese glosses never count as words.
//
// Tags and entities are stripped FIRST. Explanations are inserted as HTML, so
// `<br>` is a line break on screen, never a tappable word — counting it would
// rank "br" among the commonest "words" in the app.
function tappableWords(text) {
    const plain = String(text)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(?:[a-z]+|#\d+);/gi, ' ');
    const out = [];
    for (const m of plain.match(/[A-Za-zÀ-ɏḀ-ỿ']+/g) || []) {
        if (/^[A-Za-z]+(?:'[a-z]+)?$/.test(m)) out.push(m.toLowerCase());
    }
    return out;
}

// Data files declare `const NAME = …` at top level, which is lexical and
// therefore invisible on globalThis — copy it out explicitly.
function loadBank(bank) {
    const sandbox = { module: { exports: {} }, console };
    sandbox.globalThis = sandbox;
    sandbox.global = sandbox;
    sandbox.window = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, bank.file), 'utf8'), ctx, { filename: bank.file });
    vm.runInContext(
        `globalThis.__bank = typeof ${bank.global} !== 'undefined' ? ${bank.global} : null;`, ctx);
    return sandbox.__bank;
}

// Count words ONLY in the fields the tabs actually make tappable.
//
// Walking every string instead swept in `explanation` (Vietnamese teaching
// notes, which are rendered escaped and never tappable) and metadata like
// `type: 'mcq'` — so the list warmed megabytes of audio for words no student
// can reach. These field names mirror TAPPABLE_FIELDS in generate-word-audio.js.
const COUNTED_FIELDS = ['q', 'orig', 'stem', 'answer', 'passage', 'frame', 'en', 'ex'];
const COUNTED_ARRAYS = ['options', 'parts'];

function countWords(node, freq, depth) {
    if (depth > 12 || node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const v of node) countWords(v, freq, depth + 1);
        return;
    }
    for (const f of COUNTED_FIELDS) {
        if (typeof node[f] === 'string') {
            for (const w of tappableWords(node[f])) freq[w] = (freq[w] || 0) + 1;
        }
    }
    for (const a of COUNTED_ARRAYS) {
        if (Array.isArray(node[a])) {
            for (const s of node[a]) {
                if (typeof s === 'string') for (const w of tappableWords(s)) freq[w] = (freq[w] || 0) + 1;
            }
        }
    }
    for (const v of Object.values(node)) {
        if (v && typeof v === 'object') countWords(v, freq, depth + 1);
    }
}

function collectFrequencies() {
    const freq = {};
    for (const bank of BANKS) {
        const data = loadBank(bank);
        if (!data) throw new Error(`${bank.file} did not expose ${bank.global}`);
        countWords(data, freq, 0);
    }
    return freq;
}

// Ranked commonest-first, keeping only words we actually have audio for
// (warming a 404 would be pure waste). Ties break alphabetically so the
// output is deterministic and the staleness test is meaningful.
function topWords(count) {
    const freq = collectFrequencies();
    return Object.keys(freq)
        .filter(w => fs.existsSync(path.join(AUDIO_DIR, wordAudioSlug(w) + '.mp3')))
        .sort((a, b) => freq[b] - freq[a] || (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, count || DEFAULT_COUNT);
}

function main() {
    const args = process.argv.slice(2);
    const i = args.indexOf('--count');
    const count = i !== -1 ? parseInt(args[i + 1], 10) : DEFAULT_COUNT;

    const freq = collectFrequencies();
    const words = topWords(count);
    const totalTaps = Object.values(freq).reduce((a, b) => a + b, 0);
    const covered = words.reduce((s, w) => s + (freq[w] || 0), 0);
    const bytes = words.reduce((s, w) => {
        const f = path.join(AUDIO_DIR, wordAudioSlug(w) + '.mp3');
        return s + (fs.existsSync(f) ? fs.statSync(f).size : 0);
    }, 0);

    fs.writeFileSync(OUT_FILE,
        `// hot-words.js — GENERATED by scripts/build-hot-words.js. Do not edit.\n` +
        `// The ${words.length} commonest words across every quiz bank: ${(covered / totalTaps * 100).toFixed(0)}% of all\n` +
        `// tappable text, ${(bytes / 1048576).toFixed(1)} MB of audio. js/app.js warms these in the\n` +
        `// background so most tap-to-hear taps never wait on the network.\n` +
        `const HOT_WORDS = ${JSON.stringify(words)};\n\n` +
        `if (typeof module !== 'undefined' && module.exports) { module.exports = { HOT_WORDS }; }\n`);

    console.log(`${words.length} words → js/hot-words.js`);
    console.log(`  covers ${(covered / totalTaps * 100).toFixed(1)}% of all tappable text`);
    console.log(`  warms ${(bytes / 1048576).toFixed(1)} MB`);
}

module.exports = { BANKS, tappableWords, collectFrequencies, topWords, OUT_FILE };

if (require.main === module) main();
