#!/usr/bin/env node
// scripts/generate-word-audio.js — pre-generate one studio-quality recording
// per vocabulary word with ElevenLabs, saved to audio/words/<slug>.mp3.
// The app plays these files directly (js/app.js speakWord); the Web Speech
// API is only a fallback. Slugs here MUST match wordAudioSlug in js/app.js.
//
// Usage:
//   node scripts/generate-word-audio.js [options]
// The key is read from ELEVENLABS_API_KEY — either exported in the shell or
// set in the gitignored .env file at the repo root (see .env.example).
//
// Options:
//   --answers       also cover every spoken quiz answer (pair answers split)
//   --tappable      also cover every word a student can tap inside a question
//   --dictionary    also cover js/dictionary-data.js (every tap-to-hear word
//                   in a question, 8,638 entries) — not just the flashcards
//   --dry-run       list what would be generated, no API calls
//   --limit N       only process the first N missing words
//   --budget N      stop before exceeding N input characters (quota guard)
//   --concurrency N in-flight requests for THIS process (default 3)
//   --shard i/n     take every n-th word starting at i (0-based), so several
//                   processes can run at once without colliding, e.g.
//                     for i in 0 1 2 3; do
//                       node scripts/generate-word-audio.js --dictionary \
//                         --shard $i/4 --concurrency 3 &
//                     done; wait
//   --only a,b      work on just these words (comma-separated), whatever data
//                   file they come from — pair with --force to replace a bad
//                   recording, e.g. --only japan,thailand --force
//   --force         regenerate even if the mp3 already exists
//   --voice ID      ElevenLabs voice id   (default: the shipped voice, Sarah)
//   --model ID      ElevenLabs model id   (default: eleven_multilingual_v2)
//
// Idempotent: existing files are skipped, so re-running only fills gaps
// (e.g. words added to the data files since the last run).
//
// Going live: the recordings deploy to their own Cloudflare Pages project
// (eng-pwa-audio — Pages caps a deployment at 20,000 files, and the app must
// not share its budget with 13,000 MP3s). After generating, run:
//   scripts/deploy-audio.sh

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audio', 'words');

// Every data file whose `en:` entries feed a speakWord()/_unitSpeak() tap.
// Order = generation priority under --budget: unit practice speaks on every
// answer and topic cards on every tap, so they outrank the long lesson tail.
const DATA_FILES = [
    'js/units-data.js',      // Topics tab unit practice (Pre set)
    'js/units-hk1-data.js',  // Topics tab unit practice (HK1 set)
    'js/units-hk2-data.js',  // Topics tab unit practice (HK2 set)
    'js/topic-vocab.js',     // topic picture cards
    'js/vocabulary.js'       // lessons, home, word-of-the-day, word-hunt, topics
];

// Tap-any-word-in-a-question vocabulary (js/tapwords.js). Opt-in: --dictionary.
const DICTIONARY_FILE = 'js/dictionary-data.js';

// Correct answers spoken aloud after every question in the gated tabs
// (Word form, Phrases, Collocation, Verbs). Opt-in: --answers.
const ANSWER_BANKS = [
    { file: 'js/wordform-data.js', global: 'WORDFORM_QUESTIONS', pick: q => [q.answer] },
    // q.phrase is the collocation actually being learned ("rise in"); the bare
    // answer is only its preposition, which teaches nothing spoken alone.
    { file: 'js/phrases-data.js', global: 'PREPOSITION_QUESTIONS',
      pick: q => [q.answer || (q.options && q.options[q.correct]), q.phrase] },
    // Same idea as phrases: the lesson is "make an effort", not the "make"
    // that filled the gap. Collocation has no phrase field — the English
    // collocation is the head of the vi gloss, before the dash. Glosses that
    // are pure Vietnamese have no head and contribute only their answer.
    { file: 'js/collocation-data.js', global: 'COLLOCATION_QUESTIONS',
      pick: q => {
          const head = String(q.vi || '').split(/\s[—–-]\s/)[0].trim();
          const usable = head && !/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(head);
          return usable ? [q.answer, head] : [q.answer];
      } },
    { file: 'js/vocabulary.js', global: 'irregularVerbs', pick: v => [v.v2, v.v3] }
];

// Question banks, and the fields whose text the tabs actually pass through
// tapwordsWrap(). `explanation` and `vi` are deliberately absent: they are
// Vietnamese teaching notes rendered escaped, never tappable — including them
// would generate English recordings for Vietnamese words. Opt-in: --tappable.
const TAPPABLE_BANKS = [
    { file: 'js/grammar-units.js', global: 'GRAMMAR_UNITS' },
    { file: 'js/exam-data.js', global: 'EXAMS' },
    { file: 'js/wordform-data.js', global: 'WORDFORM_QUESTIONS' },
    { file: 'js/rewrite-data.js', global: 'REWRITE_QUESTIONS' },
    { file: 'js/phrases-data.js', global: 'PREPOSITION_QUESTIONS' },
    { file: 'js/collocation-data.js', global: 'COLLOCATION_QUESTIONS' }
];
const TAPPABLE_FIELDS = ['q', 'orig', 'stem', 'answer', 'passage', 'frame'];
const TAPPABLE_ARRAYS = ['options', 'parts'];

// The rule from js/tapwords.js: pure-ASCII letter runs with an optional
// 's/'t tail, after markup is stripped.
function tappableWords(text) {
    const plain = String(text == null ? '' : text)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(?:[a-z]+|#\d+);/gi, ' ');
    const out = [];
    for (const m of plain.match(/[A-Za-zÀ-ɏḀ-ỿ']+/g) || []) {
        if (/^[A-Za-z]+(?:'[a-z]+)?$/.test(m)) out.push(m.toLowerCase());
    }
    return out;
}

function collectTappableWords() {
    const vm = require('vm');
    const seen = new Set();
    const out = [];
    const add = (w) => {
        if (seen.has(w) || !wordAudioSlug(w)) return;
        seen.add(w); out.push(w);
    };
    for (const bank of TAPPABLE_BANKS) {
        const sandbox = { module: { exports: {} }, console };
        sandbox.globalThis = sandbox; sandbox.global = sandbox; sandbox.window = sandbox;
        const ctx = vm.createContext(sandbox);
        const abs = path.join(ROOT, bank.file);
        vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: bank.file });
        vm.runInContext(`globalThis.__bank = typeof ${bank.global} !== 'undefined' ? ${bank.global} : null;`, ctx);
        const walk = (node, depth) => {
            if (depth > 8 || !node) return;
            if (Array.isArray(node)) return node.forEach(n => walk(n, depth + 1));
            if (typeof node !== 'object') return;
            for (const f of TAPPABLE_FIELDS) {
                if (typeof node[f] === 'string') tappableWords(node[f]).forEach(add);
            }
            for (const a of TAPPABLE_ARRAYS) {
                if (Array.isArray(node[a])) {
                    node[a].filter(x => typeof x === 'string').forEach(s => tappableWords(s).forEach(add));
                }
            }
            Object.values(node).forEach(v => { if (v && typeof v === 'object') walk(v, depth + 1); });
        };
        walk(sandbox.__bank, 0);
    }
    return out;
}

// "conclusive/ resign" is two words to pronounce, not one; so is "was/were".
function answerParts(answer) {
    return String(answer == null ? '' : answer)
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);
}

function collectAnswerWords() {
    const seen = new Set();
    const out = [];
    for (const bank of ANSWER_BANKS) {
        const mod = require(path.join(ROOT, bank.file));
        for (const item of (mod[bank.global] || [])) {
            for (const raw of bank.pick(item)) {
                for (const part of answerParts(raw)) {
                    const key = part.toLowerCase();
                    if (seen.has(key) || !wordAudioSlug(key)) continue;
                    seen.add(key);
                    out.push(key);
                }
            }
        }
    }
    return out;
}

// The voice every shipped recording was generated with. One app, one speaker:
// audio/words/ was once built in two voices, because a run that omitted
// --voice fell back to a different default and nobody noticed until a student
// heard two different people. DEFAULT_VOICE must therefore always equal
// SHIPPED_VOICE (tests/word-audio.test.js enforces it), and .voice.json
// records what the folder actually holds.
const SHIPPED_VOICE = 'EXAVITQu4vr4xnSDxMaL';   // "Sarah" — clear US female
const DEFAULT_VOICE = SHIPPED_VOICE;
const DEFAULT_MODEL = 'eleven_multilingual_v2'; // highest quality tier
const VOICE_MANIFEST = '.voice.json';
const OUTPUT_FORMAT = 'mp3_44100_128';
const CONCURRENCY = 3;
const MAX_RETRIES = 5;

// ── Pronunciation overrides ──────────────────────────────────────────────
// A word sent to the API on its own has no sentence around it to hint at the
// language, and eleven_multilingual_v2 sometimes reads an isolated proper
// noun as a foreign word: "Japan" and "Thailand" both came out wrong.
//
// The cure is to state the pronunciation instead of hoping for it — SSML
// <phoneme>. That tag is only honoured by the English models;
// eleven_multilingual_v2 does not implement it and renders the markup as
// noise (a garbled half-second), so a word listed here is recorded with
// PRONUNCIATION_MODEL. Same voice, so the speaker never changes — only the
// engine reading her lines.
//
// CMU arpabet, not IPA. Both alphabets are documented, but IPA came back
// unreliable when measured: four takes of /dʒəˈpæn/ gave "zipon", "epa",
// one good "Japan", and one where the voice read the markup out loud.
// The same four takes in arpabet were four clean "Japan"s, and the digits
// carry the stress explicitly (1 = primary, 0 = unstressed).
//
// Keep this list short: it exists for words the default model gets wrong,
// verified by listening, not as a general dictionary.
//
// Each entry is the word broken into the pieces the voice must say, every
// piece pinned to its own arpabet spelling. One piece for an ordinary word.
// "P.E." needs two, because it is not a word at all — it is two letter
// names, and one piece cannot express that (see PIECE_SEPARATOR).
const PRONUNCIATION_MODEL = 'eleven_turbo_v2';   // English-only; supports <phoneme>
const PRONUNCIATION = {
    japan:    [['Japan', 'JH AH0 P AE1 N']],     // juh-PAN, stress on the second syllable
    thailand: [['Thailand', 'T AY1 L AE2 N D']], // TIE-land — a plain T, never a "th"
    // The school subject, said as letters: "pee-EE". It reached students as
    // "pair" under one spelling and as Japanese ("はい") under the other.
    // Both spellings in the data land here — units-data.js writes "P.E.",
    // units-hk1-data.js writes "PE" — and they are separate recordings.
    pe:    [['P', 'P IY1'], ['E', 'IY1']],
    'p-e': [['P', 'P IY1'], ['E', 'IY1']],
    // Both reported mispronounced by ear on the live app (2026-08-21).
    birthday: [['birthday', 'B ER1 TH D EY2']], // BIRTH-day, not "birt-hay"
    jam:      [['jam', 'JH AE1 M']]             // one clean "jam", not "yam"/"jahm"
};

// How the pieces are joined, measured over ten takes each rather than
// guessed — the first separator that looked perfect over five takes turned
// out to be the worst of the lot:
//
//   full stop    9/10      space        (slurs the two into one "P")
//   comma        6/10      hyphen       6/10
//
// Run together, two <phoneme> tags collapse back into a single syllable and
// the voice just says "P". The full stop is what holds them apart.
const PIECE_SEPARATOR = '. ';

// What to send the API for one word, and which model must read it.
// Words without an override keep the default model and their bare text.
function synthesisRequest(word, opts) {
    const pieces = PRONUNCIATION[wordAudioSlug(word)];
    if (!pieces) return { text: String(word), model: opts.model };
    const tags = pieces.map(([say, ph]) => `<phoneme alphabet="cmu-arpabet" ph="${ph}">${say}</phoneme>`);
    // The closing stop keeps the last letter from being clipped. A word made
    // of one piece never needed it, and adding one now would only invalidate
    // recordings that are already correct.
    return {
        text: tags.length > 1 ? tags.join(PIECE_SEPARATOR) + '.' : tags[0],
        model: PRONUNCIATION_MODEL
    };
}

// Minimal .env loader (no dependencies): KEY=VALUE lines, # comments,
// optional `export ` prefix and single/double quotes. Values already in the
// real environment always win over the file.
function loadEnvFile(file) {
    file = file || path.join(ROOT, '.env');
    if (!fs.existsSync(file)) return false;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (line.trim().startsWith('#')) continue;
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
    return true;
}

// Must stay byte-for-byte in sync with wordAudioSlug in js/app.js.
function wordAudioSlug(word) {
    return String(word).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Pull every `en: '...'` / `en: "..."` string out of the data files.
// Deduped case-insensitively; empty slugs (pure-symbol entries) dropped.
// With { includeDictionary: true }, the tap-word dictionary is appended —
// js/tapwords.js makes every English word in a question tappable-to-hear,
// so its 8,638 entries (inflections included) also need recordings. Appended
// last so the flashcard words keep their head-of-queue priority.
function collectWords(opts) {
    opts = opts || {};
    const seen = new Set();
    const words = [];
    const add = (raw) => {
        const word = String(raw).trim();
        const key = word.toLowerCase();
        if (!word || seen.has(key) || !wordAudioSlug(word)) return;
        seen.add(key);
        words.push(key);
    };
    for (const rel of DATA_FILES) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        for (const m of src.matchAll(/\ben:\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
            add(m[2].replace(/\\(['"\\])/g, '$1'));
        }
    }
    // Answers are spoken on every question, so they rank above the tap-word tail.
    if (opts.includeAnswers) collectAnswerWords().forEach(add);
    if (opts.includeTappable) collectTappableWords().forEach(add);
    if (opts.includeDictionary) {
        // The file ends with module.exports, so require() beats parsing it.
        const { WORD_VI } = require(path.join(ROOT, DICTIONARY_FILE));
        Object.keys(WORD_VI || {}).forEach(add);
    }
    return words;
}

// Slice for one of `total` cooperating processes. Round-robin (not blocks)
// so each shard gets the same mix of short and long words, and therefore
// finishes at roughly the same time.
function shardOf(items, index, total) {
    if (!total || total <= 1) return items.slice();
    return items.filter((_, i) => i % total === index);
}

// Different words can normalize to the same filename ("check-in"/"check in").
// First one wins — same pronunciation — but say so out loud.
function findSlugCollisions(words) {
    const bySlug = {};
    const collisions = [];
    for (const w of words) {
        const s = wordAudioSlug(w);
        if (bySlug[s]) collisions.push({ slug: s, kept: bySlug[s], dropped: w });
        else bySlug[s] = w;
    }
    return collisions;
}

// Longest prefix of `words` whose total character count fits `budget`
// (ElevenLabs bills per input character). Hard stop at the first word that
// busts it, so priority order is never skipped over.
function cutToBudget(words, budget) {
    const kept = [];
    let spent = 0;
    for (const w of words) {
        if (spent + w.length > budget) break;
        spent += w.length;
        kept.push(w);
    }
    return kept;
}

// What voice the existing recordings were made with (null if none yet).
function readVoiceManifest() {
    try {
        return JSON.parse(fs.readFileSync(path.join(OUT_DIR, VOICE_MANIFEST), 'utf8'));
    } catch (e) {
        return null;
    }
}

function writeVoiceManifest(voice, model) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, VOICE_MANIFEST),
        JSON.stringify({ voice, model }, null, 2) + '\n');
}

// True when this run would add recordings in a different voice than the ones
// already on disk — the mistake that shipped two speakers. --force is the
// deliberate way to re-voice the whole set.
function voiceConflict(manifest, voice, force) {
    return !!(manifest && manifest.voice && manifest.voice !== voice && !force);
}

async function synthesize(word, opts) {
    const req = synthesisRequest(word, opts);
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${opts.voice}?output_format=${OUTPUT_FORMAT}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'xi-api-key': opts.apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: req.text,
            model_id: req.model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} for "${word}": ${body.slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`suspiciously small audio for "${word}" (${buf.length} bytes)`);
    return buf;
}

// ── Reading the take back ────────────────────────────────────────────────
// An overridden word is on the list precisely because the model gets it
// wrong, and it does not get it right every time either: the request that
// produced a clean "PE" produced a bare "P" on the very next take. So those
// words — and only those, to keep 13,000 ordinary ones cheap — are
// transcribed and re-cut until what came out is what was asked for.
// Even the best spelling measured 9/10, so one take is not enough on its own.
const STT_MODEL = 'scribe_v1';
const VERIFY_ATTEMPTS = 6;

// "P.E.", "PE" and a transcript of "P.E." all reduce to "pe".
function spokenKey(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// What the recording actually says, or null if the check could not be run.
// Best-effort by design: a transcription outage must not block a rebuild.
async function transcribe(buf, opts) {
    try {
        const form = new FormData();
        form.append('model_id', STT_MODEL);
        form.append('file', new Blob([buf]), 'word.mp3');
        const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: { 'xi-api-key': opts.apiKey },
            body: form
        });
        if (!res.ok) return null;
        return String((await res.json()).text || '');
    } catch (e) {
        return null;
    }
}

// True when this take says the word it is filed under. Unverifiable takes
// pass: refusing them would turn a transcription outage into a failed run.
async function takeIsGood(word, buf, opts) {
    if (!PRONUNCIATION[wordAudioSlug(word)]) return true;
    const heard = await transcribe(buf, opts);
    return heard === null || spokenKey(heard) === spokenKey(wordAudioSlug(word));
}

async function generateOne(word, opts) {
    const file = path.join(OUT_DIR, wordAudioSlug(word) + '.mp3');
    for (let attempt = 1; ; attempt++) {
        try {
            // Re-cut a bad take rather than shipping it. The last one is kept
            // either way — a wrong recording still beats a missing one, and
            // the warning names the words to go and listen to.
            let buf = await synthesize(word, opts);
            let takes = 1;
            while (takes < VERIFY_ATTEMPTS && !(await takeIsGood(word, buf, opts))) {
                buf = await synthesize(word, opts);
                takes++;
            }
            if (takes === VERIFY_ATTEMPTS && !(await takeIsGood(word, buf, opts))) {
                console.warn(`  ⚠ "${word}" still misread after ${takes} takes — listen to it`);
            }
            fs.writeFileSync(file, buf);
            return { word, ok: true };
        } catch (e) {
            const retryable = e.status === 429 || e.status >= 500 || e.status === undefined;
            if (attempt >= MAX_RETRIES || !retryable) return { word, ok: false, error: e.message };
            const backoff = Math.min(30000, 1000 * 2 ** attempt);
            await new Promise(r => setTimeout(r, backoff));
        }
    }
}

async function main() {
    loadEnvFile();   // pick up ELEVENLABS_API_KEY from .env if present
    const args = process.argv.slice(2);
    const flag = (name) => args.includes(name);
    const value = (name, dflt) => {
        const i = args.indexOf(name);
        return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : dflt;
    };
    const opts = {
        apiKey: process.env.ELEVENLABS_API_KEY,
        voice: value('--voice', DEFAULT_VOICE),
        model: value('--model', DEFAULT_MODEL)
    };
    const dryRun = flag('--dry-run');
    const force = flag('--force');
    const limit = parseInt(value('--limit', '0'), 10) || 0;
    const concurrency = Math.max(1, parseInt(value('--concurrency', String(CONCURRENCY)), 10) || CONCURRENCY);
    // --shard i/n: this process takes every n-th word starting at i (0-based).
    const shardArg = value('--shard', '');
    let shardIndex = 0, shardTotal = 1;
    if (shardArg) {
        const parts = shardArg.split('/').map(Number);
        if (parts.length !== 2 || !(parts[1] > 0) || !(parts[0] >= 0) || parts[0] >= parts[1]) {
            console.error(`bad --shard "${shardArg}" — expected i/n with 0 <= i < n`);
            process.exit(2);
        }
        [shardIndex, shardTotal] = parts;
    }
    const tag = shardTotal > 1 ? `[shard ${shardIndex + 1}/${shardTotal}] ` : '';

    // Refuse to mix voices into a set that already has one.
    const manifest = readVoiceManifest();
    if (voiceConflict(manifest, opts.voice, force)) {
        console.error(
            `✗ audio/words/ was generated with voice ${manifest.voice}, but this run asks for ${opts.voice}.\n` +
            `  Mixing voices means students hear two different people.\n` +
            `  Re-voice the whole set with --force, or drop --voice to use the shipped one.`);
        process.exit(2);
    }

    // --only a,b — work on just these words, whatever data file they live in.
    // How a single bad recording gets replaced, without walking 13,000 files.
    const only = value('--only', '').split(',').map(s => s.trim()).filter(Boolean);
    const words = only.length
        ? only
        : collectWords({ includeDictionary: flag('--dictionary'), includeAnswers: flag('--answers'), includeTappable: flag('--tappable') });
    for (const c of findSlugCollisions(words)) {
        console.warn(`⚠ slug collision: "${c.dropped}" reuses ${c.slug}.mp3 (recorded from "${c.kept}")`);
    }
    if (only.length && !force) {
        console.warn('⚠ --only without --force: words that already have an mp3 are skipped.');
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    let missing = words.filter(w =>
        force || !fs.existsSync(path.join(OUT_DIR, wordAudioSlug(w) + '.mp3')));
    // Collisions resolve to the same file — only generate it once.
    const claimed = new Set();
    missing = missing.filter(w => {
        const s = wordAudioSlug(w);
        if (claimed.has(s)) return false;
        claimed.add(s);
        return true;
    });
    // Shard BEFORE limit/budget so every process sees the same global list
    // and they never generate the same file twice.
    missing = shardOf(missing, shardIndex, shardTotal);
    if (limit) missing = missing.slice(0, limit);
    const budget = parseInt(value('--budget', '0'), 10) || 0;
    if (budget) {
        const before = missing.length;
        missing = cutToBudget(missing, budget);
        if (missing.length < before) {
            console.log(`budget ${budget} chars: ${missing.length}/${before} words fit — re-run later for the rest`);
        }
    }

    console.log(`${tag}${words.length} words total, ${missing.length} to generate → ${OUT_DIR}`);
    if (dryRun) {
        missing.forEach(w => console.log(`  ${wordAudioSlug(w)}.mp3  ← "${w}"`));
        return;
    }
    if (!opts.apiKey) {
        console.error('ELEVENLABS_API_KEY is not set.');
        process.exit(1);
    }

    const failures = [];
    let done = 0;
    const queue = missing.slice();
    async function worker() {
        while (queue.length) {
            const word = queue.shift();
            const r = await generateOne(word, opts);
            done++;
            if (!r.ok) {
                failures.push(r);
                console.error(`  ✗ ${word}: ${r.error}`);
            }
            if (done % 100 === 0 || done === missing.length) {
                console.log(`  ${tag}…${done}/${missing.length} (${failures.length} failed)`);
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));

    // Record what this folder now holds, so a later run can refuse to mix.
    if (done > failures.length) writeVoiceManifest(opts.voice, opts.model);

    console.log(failures.length
        ? `${tag}Done with ${failures.length} failure(s) — re-run to retry them.`
        : `${tag}Done — every word in this shard has a recording.`);
    process.exit(failures.length ? 1 : 0);
}

module.exports = {
    wordAudioSlug, collectWords, findSlugCollisions, cutToBudget, shardOf,
    collectAnswerWords, answerParts, ANSWER_BANKS,
    collectTappableWords, tappableWords, TAPPABLE_BANKS,
    loadEnvFile, readVoiceManifest, writeVoiceManifest, voiceConflict,
    synthesisRequest, PRONUNCIATION, PRONUNCIATION_MODEL, PIECE_SEPARATOR,
    spokenKey, takeIsGood, VERIFY_ATTEMPTS,
    SHIPPED_VOICE, DEFAULT_VOICE, DEFAULT_MODEL,
    DATA_FILES, DICTIONARY_FILE, OUT_DIR
};

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}
