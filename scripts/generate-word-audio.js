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
//   --dry-run       list what would be generated, no API calls
//   --limit N       only process the first N missing words
//   --budget N      stop before exceeding N input characters (quota guard)
//   --force         regenerate even if the mp3 already exists
//   --voice ID      ElevenLabs voice id   (default: Rachel)
//   --model ID      ElevenLabs model id   (default: eleven_multilingual_v2)
//
// Idempotent: existing files are skipped, so re-running only fills gaps
// (e.g. words added to the data files since the last run).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audio', 'words');

// Every data file whose `en:` entries feed a speakWord()/_unitSpeak() tap.
// Order = generation priority under --budget: unit practice speaks on every
// answer and topic cards on every tap, so they outrank the long lesson tail.
const DATA_FILES = [
    'js/units-data.js',    // Topics tab unit practice
    'js/topic-vocab.js',   // topic picture cards
    'js/vocabulary.js'     // lessons, home, word-of-the-day, word-hunt, topics
];

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';   // "Rachel" — clear US female
const DEFAULT_MODEL = 'eleven_multilingual_v2'; // highest quality tier
const OUTPUT_FORMAT = 'mp3_44100_128';
const CONCURRENCY = 3;
const MAX_RETRIES = 5;

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
function collectWords() {
    const seen = new Set();
    const words = [];
    for (const rel of DATA_FILES) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        for (const m of src.matchAll(/\ben:\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
            const word = m[2].replace(/\\(['"\\])/g, '$1').trim();
            const key = word.toLowerCase();
            if (!word || seen.has(key) || !wordAudioSlug(word)) continue;
            seen.add(key);
            words.push(key);
        }
    }
    return words;
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

async function synthesize(word, opts) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${opts.voice}?output_format=${OUTPUT_FORMAT}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'xi-api-key': opts.apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: word,
            model_id: opts.model,
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

async function generateOne(word, opts) {
    const file = path.join(OUT_DIR, wordAudioSlug(word) + '.mp3');
    for (let attempt = 1; ; attempt++) {
        try {
            const buf = await synthesize(word, opts);
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

    const words = collectWords();
    for (const c of findSlugCollisions(words)) {
        console.warn(`⚠ slug collision: "${c.dropped}" reuses ${c.slug}.mp3 (recorded from "${c.kept}")`);
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
    if (limit) missing = missing.slice(0, limit);
    const budget = parseInt(value('--budget', '0'), 10) || 0;
    if (budget) {
        const before = missing.length;
        missing = cutToBudget(missing, budget);
        if (missing.length < before) {
            console.log(`budget ${budget} chars: ${missing.length}/${before} words fit — re-run later for the rest`);
        }
    }

    console.log(`${words.length} words total, ${missing.length} to generate → ${OUT_DIR}`);
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
            if (done % 50 === 0 || done === missing.length) {
                console.log(`  …${done}/${missing.length} (${failures.length} failed)`);
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    console.log(failures.length
        ? `Done with ${failures.length} failure(s) — re-run to retry them.`
        : 'Done — every word has a recording.');
    process.exit(failures.length ? 1 : 0);
}

module.exports = { wordAudioSlug, collectWords, findSlugCollisions, cutToBudget, loadEnvFile, DATA_FILES, OUT_DIR };

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}
