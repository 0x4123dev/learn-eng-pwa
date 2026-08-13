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
});

suite('word audio: deploy ships the recordings', () => {
    test('deploy.sh copies audio/ into .cf-dist', () => {
        const sh = read('scripts/deploy.sh');
        assert.truthy(/cp -R [^\n]*\baudio\b/.test(sh),
            'deploy.sh build must copy audio/ or the recordings never reach the live site');
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
