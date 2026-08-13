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
    let rejection = null;   // the Error play() should reject with, or null
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
            const self = this;
            return {
                catch(fn) {
                    if (rejection) fn(rejection);
                    else if (self.onended) self.onended();   // played through
                    return this;
                }
            };
        }
    }
    return {
        FakeAudio, created, played,
        // Old boolean helper kept for existing tests; a generic 404-ish failure.
        setFailPlay(v) { rejection = v ? Object.assign(new Error('404'), { name: 'NotSupportedError' }) : null; },
        setPlayRejection(err) { rejection = err; }
    };
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
    app.__setPlayRejection = (err) => audio.setPlayRejection(err);
    app.__isMissing = (w) => !!(app.audioMissing || {})[app.wordAudioSlug(w)];
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
        assert.contains(audio.played, app.WORD_AUDIO_PATH + 'apple.mp3');
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
        assert.deepEqual(audio.played, [app.WORD_AUDIO_PATH + 'apple.mp3']);
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

    // iOS Safari throws InvalidStateError when currentTime is set on a media
    // element that has no source loaded yet. Chrome silently allows it, so
    // this only ever breaks on a phone — and it breaks HARD: speakWord() is
    // called inside the matching-card onclick handler BEFORE selectCard(), so
    // a throw there means the card never selects and the whole screen stops
    // responding to taps.
    function iosStrictAudio() {
        const created = [];
        class StrictAudio {
            constructor(src) {
                this._src = src || ''; this._t = 0; this.preload = '';
                created.push(this);
            }
            get src() { return this._src; }
            set src(v) { this._src = v; this._loaded = false; }
            get currentTime() { return this._t; }
            set currentTime(v) {
                if (!this._src || !this._loaded) {
                    const e = new Error('The object is in an invalid state.');
                    e.name = 'InvalidStateError';
                    throw e;                      // what iOS does
                }
                this._t = v;
            }
            cloneNode() { return new StrictAudio(this._src); }
            pause() {}
            play() { this._loaded = true; return { catch() { return this; } }; }
        }
        return { StrictAudio, created };
    }

    test('a media element with no source loaded never breaks the tap handler', () => {
        const { StrictAudio } = iosStrictAudio();
        const synth = { calls: { cancel: 0, speak: [] }, cancel() { this.calls.cancel++; },
                        speak(u) { this.calls.speak.push(u && u.text); }, resume() {},
                        getVoices() { return []; }, speaking: false, pending: false };
        const app = loadAppCode({
            includeHome: false,
            extraGlobals: { Audio: StrictAudio,
                SpeechSynthesisUtterance: function (t) { this.text = String(t); },
                window: { speechSynthesis: synth } }
        });
        // Leave a sequence player parked with no source — exactly what happens
        // when the first word of an answer has no recording.
        app.speakSequence(['zzznotaword', 'apple']);
        // Now a matching card is tapped. This must not throw.
        app.speakWord('apple');
        assert.truthy(true, 'speakWord threw — every card tap on the lesson screen would die with it');
    });

    test('a blocked autoplay is not treated as a missing recording', () => {
        // Browsers refuse play() with NotAllowedError when no user gesture is
        // in play — the auto-pronounce after answering hits this. That is a
        // policy refusal, not a broken file. Marking the word "missing" would
        // permanently downgrade it to the robot voice for the rest of the
        // session, so every later TAP of that word would be robotic too.
        const { app, synth } = loadWithAudio();
        const err = new Error('play() failed because the user did not interact');
        err.name = 'NotAllowedError';
        app.__setPlayRejection(err);
        app.speakWord('drink');
        assert.falsy(app.__isMissing('drink'), 'an autoplay refusal must not blacklist the recording');
        // And with the block lifted, the real recording plays — not the fallback.
        app.__setPlayRejection(null);
        const before = synth.calls.cancel;
        app.speakWord('drink');
        assert.equal(synth.calls.cancel, before, 'the recording should play, not speech synthesis');
    });

    test('a genuinely broken recording is still blacklisted', () => {
        const { app } = loadWithAudio();
        const err = new Error('no decoder');
        err.name = 'NotSupportedError';
        app.__setPlayRejection(err);
        app.speakWord('zzznotaword');
        assert.truthy(app.__isMissing('zzznotaword'), 'a real failure must fall back and be remembered');
    });

    test('auto-pronounce stays silent when blocked instead of using the robot voice', () => {
        // The student must tap 🔊 anyway (the gate requires it) and that tap
        // plays the real voice — so a blocked auto-play should say nothing
        // rather than substitute a different speaker.
        const { app, synth } = loadWithAudio();
        const err = new Error('blocked');
        err.name = 'NotAllowedError';
        app.__setPlayRejection(err);
        // Assert on cancel(), which speakWordFallback calls synchronously —
        // its speak() is deferred by a timer and invisible to this harness.
        const before = synth.calls.cancel;
        app.speakSequence(['drink', 'drank', 'drunk'], { fallback: false });
        assert.equal(synth.calls.cancel, before,
            'silence is correct here — the robot voice mid-answer is what users hear as "two voices"');
        assert.falsy(app.__isMissing('drink'), 'and the recording must not be blacklisted either');
    });

    // Opening a topic detail screen preloads every word in the topic — up to
    // 851 of them. Building an HTMLAudioElement per word meant 851 media
    // elements, each with preload="auto", all at once: phones cap how many
    // media elements can exist, and the tab locks up. Warm through fetch()
    // instead — the service worker caches the response either way, and
    // playback still creates exactly one element, on demand.
    test('preloading a big topic creates no media elements at all', () => {
        const { app, audio } = loadWithAudio();
        const many = Array.from({ length: 400 }, (_, i) => ({ en: 'word' + i }));
        const before = audio.created.length;
        app.preloadLessonAudio(many);
        assert.equal(audio.created.length, before,
            `${audio.created.length - before} Audio elements for one screen — this is what froze the phone`);
    });

    test('preloading is batched, not 400 requests in one go', () => {
        const fetched = [];
        const idleQueue = [];
        const app = loadAppCode({
            includeHome: false,
            extraGlobals: {
                fetch: (u) => { fetched.push(u); return Promise.resolve({ ok: true }); },
                // Capture idle work instead of running it, so we can see how
                // much the first tick actually dispatches.
                requestIdleCallback: (fn) => { idleQueue.push(fn); return idleQueue.length; }
            }
        });
        app.preloadLessonAudio(Array.from({ length: 400 }, (_, i) => ({ en: 'w' + i })));
        assert.truthy(fetched.length <= 12,
            `${fetched.length} requests fired at once — preloading must not flood the network`);
        assert.truthy(idleQueue.length > 0 || fetched.length > 0, 'nothing was scheduled at all');
    });

    test('preloadLessonAudio warms each word through fetch, without playing it', () => {
        const fetched = [];
        const audio = makeAudioMock();
        const app = loadAppCode({
            includeHome: false,
            extraGlobals: {
                Audio: audio.FakeAudio,
                fetch: (u) => { fetched.push(u); return Promise.resolve({ ok: true }); }
            }
        });
        app.preloadLessonAudio([{ en: 'apple' }, 'ice cream']);
        assert.contains(fetched, app.WORD_AUDIO_PATH + 'apple.mp3');
        assert.contains(fetched, app.WORD_AUDIO_PATH + 'ice-cream.mp3');
        assert.deepEqual(audio.played, [], 'prefetch must not play anything');
        assert.equal(audio.created.length, 0, 'and must not build media elements');
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
    test('the recordings ship — from their own deploy, not the app one', () => {
        // They used to ride along in .cf-dist. At ~13,000 MP3s that crowds a
        // single Cloudflare Pages deployment against its 20,000-file cap, so
        // the audio now has its own project and its own script. The property
        // that matters is unchanged: something must actually publish them.
        const audioSh = read('scripts/deploy-audio.sh');
        assert.truthy(/eng-pwa-audio/.test(audioSh), 'deploy-audio.sh must target the audio project');
        assert.truthy(/audio/.test(audioSh), 'deploy-audio.sh must ship audio/');

        const appSh = read('scripts/deploy.sh');
        assert.falsy(/cp -R [^\n]*\baudio\b/.test(appSh),
            'the app deploy must NOT carry audio/ — that is what the separate project is for');
    });

    test('the app the audio serves from is the one it is deployed to', () => {
        // A mismatch here is silent: every recording 404s and the whole app
        // quietly falls back to the robot voice.
        const host = /const WORD_AUDIO_PATH = '([^']+)'/.exec(read('js/app.js'));
        assert.truthy(host, 'js/app.js must define WORD_AUDIO_PATH');
        const deployed = /LIVE="([^"]+)"/.exec(read('scripts/deploy-audio.sh'));
        assert.truthy(deployed, 'deploy-audio.sh must name where it publishes');
        assert.truthy(host[1].startsWith(deployed[1] + '/'),
            `app fetches from ${host[1]} but the audio deploys to ${deployed[1]}`);
    });

    test('old clients asking the app origin for a recording are redirected, not fed HTML', () => {
        // Pages' SPA fallback answers 200 text/html for any missing path.
        // Pre-v4.9.2 clients still request /audio/words/ from the app origin;
        // without the redirect they would "play" index.html.
        const redirects = read('_redirects');
        assert.truthy(/^\/audio\/words\/\* https:\/\/eng-pwa-audio\.pages\.dev\/audio\/words\/:splat 301$/m
            .test(redirects), '_redirects must forward /audio/words/* to the audio project');
        assert.truthy(/cp [^\n]*\b_redirects\b/.test(read('scripts/deploy.sh')),
            'and deploy.sh must actually ship _redirects');
    });

    test('the audio cache never stores an SPA-fallback page as a recording', () => {
        // The audio cache survives CACHE_NAME bumps by design, so one cached
        // text/html body would mute that word on that device forever.
        const sw = read('sw.js');
        assert.truthy(/function isRecording\(/.test(sw) && /text\/html/.test(sw),
            'sw.js must refuse to cache non-audio bodies');
        assert.truthy(/full && !isRecording\(full\)/.test(sw),
            'and must heal entries poisoned before the guard existed');
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

    test('includeTappable covers the words a student can tap in a question', () => {
        const gen = requireGen();
        const words = gen.collectTappableWords();
        assert.truthy(words.length >= 8000, `only ${words.length} tappable words found`);
        assert.contains(words, 'underlined');   // appears in question stems
        assert.contains(words, "don't");        // contraction, tapped as one token
        // Vietnamese lives in the explanations, which are never made tappable —
        // so it must not turn up here either (see the guard in answer-gate tests).
        for (const vn of ['danh', 'trong', 'sai', 'gian']) {
            assert.notContains(words, vn, `"${vn}" is Vietnamese from an explanation`);
        }
    });

    test('every tappable word has a recording', () => {
        const gen = requireGen();
        const missing = gen.collectTappableWords().filter(w =>
            !fs.existsSync(path.join(root, 'audio', 'words', gen.wordAudioSlug(w) + '.mp3')));
        assert.deepEqual(missing.slice(0, 10), [],
            `${missing.length} tappable words fall back to the robot voice`);
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
