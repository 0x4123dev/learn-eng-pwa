#!/usr/bin/env node
// generate-sentence-audio.js — the Book 1 example sentences, read aloud.
//
//   node scripts/generate-sentence-audio.js              # everything missing
//   node scripts/generate-sentence-audio.js --only advocate,strategy
//   node scripts/generate-sentence-audio.js --force      # re-cut existing takes
//   node scripts/generate-sentence-audio.js --shard 1/4  # split over processes
//
// Answering a Word question reveals the example sentence with the word filled
// in; a 🔊 button beside it plays the WHOLE sentence (js/units.js
// _unitExampleHTML → speakSentence in js/app.js). That button only exists for
// **Book 1**, so only Book 1's sentences are recorded here — Books 2 and 3
// carry the printed Vocabulary list alone and have no sentence audio.
//
// One file per WORD, named by the same slug its recording uses
// (audio/words/<slug>.mp3 ↔ audio/sentences/<slug>.mp3), because a word owns
// exactly one example sentence. Same voice and model as the words, from the
// shared .voice.json manifest — the student must never hear two speakers.
//
// The word generator does the heavy lifting (key loading, voice manifest,
// retries); this script only decides WHAT to say and WHERE to put it.
'use strict';
const fs = require('fs');
const path = require('path');
const gen = require('./generate-word-audio.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audio', 'sentences');
const CONCURRENCY = 3;
const MAX_RETRIES = 5;
// A sentence is read as written — no pronunciation overrides, no
// transcribe-and-re-cut loop: those exist for bare words, where "PE" comes out
// as "P". Sentences carry their own context and the model reads them cleanly.
const OUTPUT_FORMAT = 'mp3_44100_128';

// Book 1 only. { word, text } in bank order.
function collectSentences() {
    const data = require(path.join(ROOT, 'js', 'word-data.js'));
    const out = [];
    const seen = new Set();
    for (const w of data.UNIT_WORDS_PR1) {
        const slug = gen.wordAudioSlug(w.en);
        if (!slug || !w.ex || seen.has(slug)) continue;
        seen.add(slug);
        out.push({ word: w.en, slug, text: String(w.ex).trim() });
    }
    return out;
}

function sentenceFile(slug) { return path.join(OUT_DIR, slug + '.mp3'); }

async function synthesize(item, opts) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${opts.voice}?output_format=${OUTPUT_FORMAT}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': opts.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: item.text,
            model_id: opts.model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status} for "${item.word}": ${body.slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // A sentence is seconds long; anything this small is an error page.
    if (buf.length < 4096) throw new Error(`suspiciously small audio for "${item.word}" (${buf.length} bytes)`);
    return buf;
}

async function generateOne(item, opts) {
    for (let attempt = 1; ; attempt++) {
        try {
            fs.writeFileSync(sentenceFile(item.slug), await synthesize(item, opts));
            return { word: item.word, ok: true };
        } catch (e) {
            const retryable = e.status === 429 || e.status >= 500 || e.status === undefined;
            if (attempt >= MAX_RETRIES || !retryable) return { word: item.word, ok: false, error: e.message };
            await new Promise(r => setTimeout(r, Math.min(30000, 1000 * 2 ** attempt)));
        }
    }
}

async function main() {
    gen.loadEnvFile();
    const args = process.argv.slice(2);
    const flag = n => args.includes(n);
    const value = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
    const force = flag('--force');

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) { console.error('✗ ELEVENLABS_API_KEY is not set (put it in .env)'); return 2; }

    // The voice is whatever audio/words/ was recorded with: one speaker for
    // the word and the sentence around it.
    const manifest = gen.readVoiceManifest() || {};
    const opts = {
        apiKey,
        voice: value('--voice', manifest.voice || gen.SHIPPED_VOICE),
        model: value('--model', manifest.model || gen.DEFAULT_MODEL),
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const only = value('--only', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    let items = collectSentences();
    if (only.length) items = items.filter(i => only.includes(i.word.toLowerCase()) || only.includes(i.slug));
    const shard = value('--shard', '');
    if (shard) {
        const [i, n] = shard.split('/').map(Number);
        items = gen.shardOf(items, i - 1, n);
    }
    const todo = force ? items : items.filter(i => !fs.existsSync(sentenceFile(i.slug)));
    console.log(`${items.length} Book 1 sentences, ${todo.length} to record → ${OUT_DIR}`);
    if (!todo.length) { console.log('Done — every Book 1 sentence has a recording.'); return 0; }

    let done = 0, failed = 0;
    const queue = todo.slice();
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        for (;;) {
            const item = queue.shift();
            if (!item) return;
            const r = await generateOne(item, opts);
            done++;
            if (!r.ok) { failed++; console.warn(`  ✗ ${r.word}: ${r.error}`); }
            if (done % 10 === 0 || done === todo.length) process.stdout.write(`  …${done}/${todo.length} (${failed} failed)\n`);
        }
    }));
    console.log(failed ? `Finished with ${failed} failure(s).` : 'Done — every Book 1 sentence has a recording.');
    return failed ? 1 : 0;
}

module.exports = { collectSentences, sentenceFile, OUT_DIR };

if (require.main === module) {
    main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
}
