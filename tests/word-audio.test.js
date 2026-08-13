// word-audio.test.js — tap-to-hear pronunciation: every word plays a
// pre-generated studio recording (audio/words/<slug>.mp3, one ElevenLabs
// voice for the whole app), with the Web Speech API only as fallback for
// missing files / offline. Replaces the old dictionaryapi.dev lookup that
// mixed accents and always played robot TTS on the first tap.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { loadAppCode } = require('./setup');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── Mocks ────────────────────────────────────────────────────────────────
// The harness is synchronous, so play() returns a thenable whose catch()
// runs inline — the fallback path becomes observable without awaiting.
function makeAudioMock() {
    const created = [];   // every constructed Audio
    const played = [];    // srcs whose play() was called
    let failPlay = false;
    class FakeAudio {
        constructor(src) {
            this.src = src || '';
            this.preload = '';
            this.currentTime = 0;
            created.push(this);
        }
        cloneNode() { return new FakeAudio(this.src); }
        pause() {}
        play() {
            played.push(this.src);
            return { catch(fn) { if (failPlay) fn(new Error('404')); } };
        }
    }
    return { FakeAudio, created, played, setFailPlay(v) { failPlay = v; } };
}

function makeSynthMock() {
    const calls = { cancel: 0, speak: [] };
    return {
        calls,
        cancel() { calls.cancel++; },
        speak(u) { calls.speak.push(u && u.text); },
        resume() {},
        getVoices() { return []; },
        speaking: false,
        pending: false
    };
}

function loadWithAudio() {
    const audio = makeAudioMock();
    const synth = makeSynthMock();
    class FakeUtterance { constructor(text) { this.text = String(text); } }
    const app = loadAppCode({
        includeHome: false,
        extraGlobals: {
            Audio: audio.FakeAudio,
            SpeechSynthesisUtterance: FakeUtterance,
            window: { speechSynthesis: synth }
        }
    });
    return { app, audio, synth };
}

// ── Client behavior ──────────────────────────────────────────────────────
suite('word audio: filename slugs', () => {
    test('lowercases, trims, and joins non-alphanumerics with single dashes', () => {
        const { app } = loadWithAudio();
        assert.equal(app.wordAudioSlug(' Apple '), 'apple');
        assert.equal(app.wordAudioSlug('ice cream'), 'ice-cream');
        assert.equal(app.wordAudioSlug("it's"), 'it-s');
        assert.equal(app.wordAudioSlug('T-shirt'), 't-shirt');
        assert.equal(app.wordAudioSlug('fire station'), 'fire-station');
    });
});

suite('word audio: speakWord', () => {
    test('plays the pre-generated recording, no TTS involved', () => {
        const { app, audio, synth } = loadWithAudio();
        app.speakWord('apple');
        assert.contains(audio.played, 'audio/words/apple.mp3');
        assert.equal(synth.calls.cancel, 0, 'recording played — TTS must stay silent');
        assert.equal(audio.created.length, 1, 'one element, played directly — no clone');
    });

    test('repeat taps reuse the downloaded element instead of re-fetching', () => {
        const { app, audio } = loadWithAudio();
        app.speakWord('apple');
        audio.created[0].currentTime = 0.9;   // pretend playback advanced
        app.speakWord('apple');
        assert.equal(audio.created.length, 1, 'a second element means a second download per tap');
        assert.equal(audio.played.length, 2);
        assert.equal(audio.created[0].currentTime, 0, 'replay must rewind to the start');
    });

    test('a prefetched word plays through the very element that preloaded it', () => {
        const { app, audio } = loadWithAudio();
        app.prefetchAudio('apple');
        app.speakWord('apple');
        assert.equal(audio.created.length, 1, 'tap must reuse the preloading element, not fetch again');
        assert.deepEqual(audio.played, ['audio/words/apple.mp3']);
    });

    test('falls back to speech synthesis when the recording is missing, and remembers the miss', () => {
        const { app, audio, synth } = loadWithAudio();
        audio.setFailPlay(true);
        app.speakWord('zzznotaword');
        assert.equal(synth.calls.cancel, 1, 'fallback TTS engaged');
        const createdBefore = audio.created.length;
        app.speakWord('zzznotaword');   // negative-cached → straight to TTS
        assert.equal(audio.created.length, createdBefore, 'no new Audio for a known-missing word');
        assert.equal(synth.calls.cancel, 2);
    });

    test('preloadLessonAudio prefetches each word without playing it', () => {
        const { app, audio } = loadWithAudio();
        app.preloadLessonAudio([{ en: 'apple' }, 'ice cream']);
        const srcs = audio.created.map(a => a.src);
        assert.contains(srcs, 'audio/words/apple.mp3');
        assert.contains(srcs, 'audio/words/ice-cream.mp3');
        assert.deepEqual(audio.played, [], 'prefetch must not play anything');
    });

    test('the dictionaryapi.dev dependency is gone', () => {
        assert.falsy(/dictionaryapi\.dev/.test(read('js/app.js')),
            'speakWord should play our own pre-generated audio, not dictionaryapi.dev lookups');
    });
});

suite('word audio: unit practice uses the shared voice', () => {
    test('_unitSpeak delegates to speakWord when the app provides it', () => {
        if (!global.UNIT_WORDS) {
            global.UNIT_WORDS = require(path.join(root, 'js', 'units-data.js')).UNIT_WORDS;
        }
        const units = require(path.join(root, 'js', 'units.js'));
        const spoken = [];
        global.speakWord = (w) => spoken.push(w);
        try {
            units._unitSpeak('doctor');
        } finally {
            delete global.speakWord;
        }
        assert.deepEqual(spoken, ['doctor']);
    });
});

// ── Service worker ───────────────────────────────────────────────────────
// Recordings are immutable, so they live in their own cache that (a) serves
// cache-first and (b) survives the CACHE_NAME bump on every release —
// otherwise each version bump would re-download the whole audio set.
suite('word audio: service worker caching', () => {
    const sw = () => read('sw.js');

    test('re-voicing the set invalidates the cached recordings', () => {
        // The audio cache deliberately outlives CACHE_NAME bumps, so a phone
        // that already cached the old voice would keep playing it forever.
        // Re-voicing is the one event that MUST bump AUDIO_CACHE — v1 held
        // the two-voice set, so shipping one voice means v2 or later.
        const m = /AUDIO_CACHE\s*=\s*'flashlingo-audio-v(\d+)'/.exec(sw());
        assert.truthy(m, 'AUDIO_CACHE must be versioned');
        assert.truthy(Number(m[1]) >= 2,
            'still on audio-v1 — devices would keep serving the old mixed-voice recordings');
    });

    test('a re-voice also re-warms the hot words', () => {
        // Same trap one level up: the "already warmed" flag would suppress
        // re-fetching the new recordings, so it is keyed to the audio version.
        const app = read('js/app.js');
        const m = /HOT_WORDS_FLAG\s*=\s*'([^']+)'/.exec(app);
        assert.truthy(m, 'HOT_WORDS_FLAG must exist');
        assert.truthy(/v\d+/.test(m[1]),
            `flag "${m[1]}" carries no audio version — a re-voice would never re-warm`);
    });

    test('a dedicated audio cache exists and survives version-bump cleanup', () => {
        assert.truthy(/AUDIO_CACHE\s*=\s*['"]flashlingo-audio-v\d+['"]/.test(sw()),
            'sw.js must declare AUDIO_CACHE');
        assert.truthy(/key !== AUDIO_CACHE/.test(sw()),
            'activate cleanup must spare the audio cache');
    });

    test('word recordings are served cache-first', () => {
        assert.truthy(/audio\/words\//.test(sw()),
            'fetch handler must special-case audio/words/');
    });

    test('Range requests are answered with real 206 slices (iOS media)', () => {
        const s = sw();
        assert.truthy(/range/i.test(s) && /206/.test(s) && /Content-Range/.test(s),
            'iOS Safari probes media with Range headers and stalls on a plain 200 from cache');
    });
});

// The screens where taps actually happen must warm the recording at render
// time — otherwise the first tap per word pays the full network round trip
// (the 1–2s delay users feel on a phone).
suite('word audio: screens prefetch what they show', () => {
    test('unit practice prefetches its question words', () => {
        assert.truthy(/prefetchAudio\(/.test(read('js/units.js')),
            'renderUnitQuestion must warm the current word');
    });

    test('topic vocab card grid preloads its words', () => {
        const n = (read('js/topic-vocab.js').match(/preloadLessonAudio\(/g) || []).length;
        assert.truthy(n >= 2, `expected the card grid AND practice to preload (found ${n} call sites)`);
    });

    test('topic detail + mistakes word lists preload their words', () => {
        const n = (read('js/topics.js').match(/preloadLessonAudio\(/g) || []).length;
        assert.truthy(n >= 4, `expected detail + mistakes lists to preload too (found ${n} call sites)`);
    });

    test('word-of-the-day prefetches before its Listen button is shown', () => {
        assert.truthy(/prefetchAudio\(/.test(read('js/home.js')),
            'the WOTD story panel must warm its word');
    });
});

suite('word audio: deploy ships the recordings', () => {
    test('deploy.sh copies audio/ into .cf-dist', () => {
        const sh = read('scripts/deploy.sh');
        assert.truthy(/cp -R [^\n]*\baudio\b/.test(sh),
            'deploy.sh build must copy audio/ or the recordings never reach the live site');
    });
});

// One app, one speaker. The whole word set was once generated in two voices —
// the flashcard words with an explicit --voice, the 6,932 dictionary words
// without it, which silently fell back to a different default. Students heard
// two different people depending on which word they tapped.
suite('word audio: one voice for the whole app', () => {
    const gen = () => require(path.join(root, 'scripts', 'generate-word-audio.js'));

    test('the default voice is the one the shipped audio actually uses', () => {
        const g = gen();
        assert.truthy(g.SHIPPED_VOICE, 'the script must name the voice the audio was built with');
        assert.equal(g.DEFAULT_VOICE, g.SHIPPED_VOICE,
            'omitting --voice must reproduce the shipped voice, not a different one');
    });

    test('the voice used is recorded next to the audio', () => {
        const g = gen();
        const manifest = g.readVoiceManifest();
        assert.truthy(manifest, 'audio/words/.voice.json must exist — it is what makes drift detectable');
        assert.equal(manifest.voice, g.SHIPPED_VOICE);
    });

    test('a run in a different voice is refused unless forced', () => {
        const g = gen();
        const current = { voice: g.SHIPPED_VOICE, model: 'eleven_multilingual_v2' };
        assert.truthy(g.voiceConflict(current, 'some-other-voice-id', false),
            'switching voice mid-set must be refused — that is exactly how two voices shipped');
        assert.falsy(g.voiceConflict(current, g.SHIPPED_VOICE, false), 'same voice is fine');
        assert.falsy(g.voiceConflict(current, 'some-other-voice-id', true), '--force is the deliberate escape hatch');
        assert.falsy(g.voiceConflict(null, 'anything', false), 'a fresh set has nothing to conflict with');
    });
});

// ── Generation script ────────────────────────────────────────────────────
suite('word audio: generation script', () => {
    const requireGen = () => require(path.join(root, 'scripts', 'generate-word-audio.js'));

    test('collects every speakable word from the data files, deduped', () => {
        const gen = requireGen();
        const words = gen.collectWords();
        // 1,957 vocabulary entries hold ~1,620 unique words (repeats across
        // lessons), plus units + topic cards minus cross-file overlap ≈ 1,780.
        assert.truthy(words.length >= 1700, `only ${words.length} words collected`);
        assert.contains(words, 'apartment');   // js/vocabulary.js
        assert.contains(words, 'doctor');      // js/units-data.js
        assert.equal(new Set(words).size, words.length, 'duplicates survived dedup');
        assert.falsy(words.some(w => gen.wordAudioSlug(w) === ''), 'a word produced an empty slug');
    });

    test('includeDictionary adds every tap-word, keeping the priority prefix', () => {
        // tapwords.js lets students tap ANY English word in a question and
        // hear it — that vocabulary lives in dictionary-data.js (8,638 words,
        // inflections included) and dwarfs the flashcard word list.
        const gen = requireGen();
        const base = gen.collectWords();
        const all = gen.collectWords({ includeDictionary: true });
        assert.truthy(all.length >= 8000, `only ${all.length} words collected`);
        assert.truthy(all.length > base.length, 'dictionary added nothing');
        assert.contains(all, 'abilities');   // inflection: dictionary-only
        assert.equal(new Set(all).size, all.length, 'duplicates survived dedup');
        assert.equal(all[0], 'doctor', 'unit-practice words must still lead');
        assert.deepEqual(all.slice(0, base.length), base, 'flashcard words keep their order');
    });

    test('includeAnswers covers quiz answers, splitting pair answers on "/"', () => {
        // Word form, Phrases, Collocation and Verbs speak the correct answer
        // aloud after every question, so every answer needs a recording —
        // including phrasal answers ("break up") and the two halves of a
        // collocation pair ("conclusive/ resign"), which are two separate
        // words to pronounce, not one.
        const gen = requireGen();
        const all = gen.collectWords({ includeDictionary: true, includeAnswers: true });
        assert.contains(all, 'conclusive');
        assert.contains(all, 'resign');
        assert.falsy(all.some(w => w.includes('/')), 'a pair answer survived unsplit');
        assert.contains(all, 'break up');       // phrasal verb answer
        assert.equal(new Set(all).size, all.length, 'duplicates survived dedup');
    });

    test('every spoken answer in the gated tabs has a recording', () => {
        const gen = requireGen();
        const missing = gen.collectAnswerWords().filter(w =>
            !fs.existsSync(path.join(root, 'audio', 'words', gen.wordAudioSlug(w) + '.mp3')));
        assert.deepEqual(missing, [],
            `answers with no audio would fall back to the robot voice: ${missing.slice(0, 8).join(', ')}`);
    });

    test('shardOf splits work across processes with no gaps and no overlap', () => {
        const gen = requireGen();
        const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const shards = [0, 1, 2].map(i => gen.shardOf(words, i, 3));
        const flat = shards.flat();
        assert.deepEqual(flat.slice().sort(), words.slice().sort(), 'every word runs exactly once');
        assert.equal(new Set(flat).size, words.length, 'a word landed in two shards');
        const sizes = shards.map(s => s.length);
        assert.truthy(Math.max(...sizes) - Math.min(...sizes) <= 1, `unbalanced: ${sizes}`);
        assert.deepEqual(gen.shardOf(words, 0, 1), words, 'a single shard is the whole list');
    });

    test('collects in priority order: unit-practice words come first', () => {
        // Unit practice speaks on every answer, so under a character budget
        // (free-tier quota) those words must win. units-data.js starts with
        // "doctor" (unit 1) — it must lead the collection.
        const gen = requireGen();
        assert.equal(gen.collectWords()[0], 'doctor');
    });

    test('cutToBudget keeps the priority prefix within the character budget', () => {
        const gen = requireGen();
        assert.deepEqual(gen.cutToBudget(['ab', 'cde', 'fg'], 7), ['ab', 'cde', 'fg']);
        assert.deepEqual(gen.cutToBudget(['ab', 'cde', 'fg'], 5), ['ab', 'cde']);
        assert.deepEqual(gen.cutToBudget(['ab', 'cde', 'fg'], 4), ['ab'], 'hard stop at the first word that busts the budget');
    });

    test('loadEnvFile reads KEY=VALUE lines without overriding existing env', () => {
        const gen = requireGen();
        const tmp = path.join(require('os').tmpdir(), 'wa-env-test-' + process.pid);
        fs.writeFileSync(tmp,
            '# comment line\n' +
            'WA_TEST_A=hello\n' +
            'WA_TEST_B="quoted value"\n' +
            '\n' +
            'export WA_TEST_C=world\n');
        process.env.WA_TEST_C = 'already-set';
        try {
            gen.loadEnvFile(tmp);
            assert.equal(process.env.WA_TEST_A, 'hello');
            assert.equal(process.env.WA_TEST_B, 'quoted value', 'quotes are stripped');
            assert.equal(process.env.WA_TEST_C, 'already-set', 'real env always wins over the file');
        } finally {
            fs.unlinkSync(tmp);
            delete process.env.WA_TEST_A;
            delete process.env.WA_TEST_B;
            delete process.env.WA_TEST_C;
        }
    });

    test('script and app agree on filenames', () => {
        const gen = requireGen();
        const { app } = loadWithAudio();
        for (const w of [' Apple ', 'ice cream', "it's", 'T-shirt', 'fire station']) {
            assert.equal(gen.wordAudioSlug(w), app.wordAudioSlug(w));
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
