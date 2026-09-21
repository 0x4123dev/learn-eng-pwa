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
    // A third outcome the browsers really produce: play() resolves, nothing is
    // heard, and the element fires `error` afterwards — what happens when the
    // response was 200 text/html rather than an mp3.
    let stall = false;
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
                    else if (stall) { /* resolves, but nothing ever plays */ }
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
        setPlayRejection(err) { rejection = err; },
        setPlayStall(on) { stall = !!on; }
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
    app.__setPlayStall = (on) => audio.setPlayStall(on);
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

    test('a word said as letters gets a file of its own, not the ordinary word\'s', () => {
        // Grade 4 unit 4 teaches "IT", the school subject — "eye-TEE". Lower-
        // casing put it in the same file as "it" the pronoun, the 22nd
        // commonest word in the app, so children heard the pronoun.
        const { app } = loadWithAudio();
        assert.equal(app.wordAudioSlug('IT'), 'i-t', 'the subject needs its own recording');
        assert.equal(app.wordAudioSlug('it'), 'it', 'the pronoun must keep its own');
        assert.truthy(app.wordAudioSlug('IT') !== app.wordAudioSlug('it'),
            'they cannot share a recording — they are not the same word');
        // Nothing else may drift: an alias only ever covers a spelling no
        // ordinary sentence writes.
        for (const [w, slug] of [['Apple', 'apple'], ['PE', 'pe'], ['P.E.', 'p-e'], ['It', 'it'], ['iT', 'it']]) {
            assert.equal(app.wordAudioSlug(w), slug, `${w} must not be aliased`);
        }
    });

    test('the app and the generator agree on every slug, aliases included', () => {
        // Two copies of the same function, in two files, and the app comment
        // says they must match. An alias added to one and not the other means
        // the recording is written under a name the player never asks for.
        const { app } = loadWithAudio();
        const gen = require(path.join(root, 'scripts', 'generate-word-audio.js'));
        const words = ['IT', 'it', 'Apple', 'ice cream', "it's", 'T-shirt', 'PE', 'P.E.',
                       'fire station', 'Japan', ' spaced ', 'birthday'];
        for (const w of words) {
            assert.equal(gen.wordAudioSlug(w), app.wordAudioSlug(w), `slug for ${JSON.stringify(w)}`);
        }
    });

    test('a recording that fails to decode still reaches the fallback voice', () => {
        // A missing recording does not 404. The recordings live in their own
        // Pages project, which answers an unknown path with its index page:
        // HTTP 200, text/html, 127 bytes. Browsers differ on whether play()
        // rejects for that or resolves and then fires `error` on the element.
        // Only onended was wired, so on the second kind the child heard
        // silence and a chained word never got its turn.
        const { app, audio, synth } = loadWithAudio();
        app.__setPlayStall(true);              // play() resolves, nothing is heard
        const before = synth.calls.speak.length;
        let released = false;
        app.speakWord('IT', () => { released = true; });
        const el = audio.created[audio.created.length - 1];
        assert.truthy(typeof el.onerror === 'function', 'nothing listens for a decode failure');
        el.onerror(new Error('decode'));                    // the browser gives up on the file
        assert.truthy(app.__isMissing('IT'), 'the broken recording must be remembered as missing');
        return new Promise((resolve, reject) => setTimeout(() => {
            try {
                assert.truthy(synth.calls.speak.length > before,
                    'the fallback voice never spoke — the child hears nothing');
                assert.truthy(released, 'onDone never fired, so a chained word would stall forever');
                resolve();
            } catch (e) { reject(e); }
        }, 800));   // the fallback releases onDone 700ms after it starts speaking
    });

    test('the letters are spoken even before the recording reaches the device', () => {
        // The recording is a separate deploy, and a device that has not fetched
        // it falls back to the browser voice. Handed the raw "IT" that voice
        // reads the pronoun — the bug, back again, through the side door.
        const { app, synth } = loadWithAudio();
        app.speakWordFallback('IT');
        app.speakWordFallback('it');
        // speakWordFallback waits a tick before speaking — iOS Safari needs the
        // gap after cancel() — so the assertion has to wait with it.
        // An assertion that throws inside a timer callback never reaches the
        // promise: it becomes an uncaught exception and the test passes anyway.
        // Verified by breaking the code on purpose — without this try/catch the
        // suite stayed green.
        return new Promise((resolve, reject) => setTimeout(() => {
            try {
                assert.deepEqual(synth.calls.speak, ['I.T.', 'it'],
                    `the voice was given ${JSON.stringify(synth.calls.speak)}`);
                resolve();
            } catch (e) { reject(e); }
        }, 60));
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
        if (!global.UNIT_WORDS_PR1) {
            global.UNIT_WORDS_PR1 = require(path.join(root, 'js', 'word-data.js')).UNIT_WORDS_PR1;
        }
        const units = require(path.join(root, 'js', 'units.js'));
        const spoken = [];
        global.speakWord = (w) => spoken.push(w);
        try {
            units._unitSpeak('advocate');
        } finally {
            delete global.speakWord;
        }
        assert.deepEqual(spoken, ['advocate']);
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

    test('a re-recorded word is refetched past the browser cache too', () => {
        // Bumping AUDIO_CACHE only drops OUR copy. The CDN serves recordings
        // as `immutable, max-age=1 year`, so the refetch that follows can be
        // answered from the browser's own disk cache with the stale bytes —
        // the child would still hear the wrong word.
        const s = sw();
        const m = /RE_RECORDED\s*=\s*\[([^\]]*)\]/.exec(s);
        assert.truthy(m, 'sw.js must list the words whose bytes changed under a reused filename');
        for (const w of ['japan', 'thailand', 'pe', 'p-e']) {
            assert.truthy(m[1].includes(`'${w}'`), `${w} was re-recorded and must bypass the disk cache`);
        }
        assert.truthy(/RE_RECORDED\.includes\(slugOf\(key\)\)\s*\?\s*\{\s*cache:\s*'reload'\s*\}/.test(s),
            'listed words must refetch with cache: reload; everything else stays on the cheap path');
    });

    test('re-recorded words are evicted from our own cache on activate', () => {
        // The disk-cache bypass above only runs on a cache MISS. Without an
        // eviction the service worker keeps answering from its own copy and
        // never refetches at all — the whole point of listing the word.
        const s = sw();
        assert.truthy(/function evictReRecorded/.test(s), 'sw.js must evict re-recorded words by name');
        assert.truthy(/RE_RECORDED\.map\(\s*[\s\S]{0,120}cache\.delete\(/.test(s),
            'eviction must delete each listed word from the audio cache');
        assert.truthy(/\.then\(evictReRecorded\)/.test(s),
            'activate must run the eviction, or a cached bad word survives the release');
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
        // The CDN base is what every non-GitHub host resolves to (wordAudioBase).
        const host = loadAppCode().wordAudioBase('eng-pwa.pages.dev');
        const deployed = /LIVE="([^"]+)"/.exec(read('scripts/deploy-audio.sh'));
        assert.truthy(deployed, 'deploy-audio.sh must name where it publishes');
        assert.truthy(host.startsWith(deployed[1] + '/'),
            `app fetches from ${host} but the audio deploys to ${deployed[1]}`);
    });

    test('old clients asking the app origin for a recording are redirected, not fed HTML', () => {
        // Pages' SPA fallback answers 200 text/html for any missing path.
        // Pre-v4.9.2 clients still request /audio/words/ from the app origin;
        // without the redirect they would "play" index.html.
        const redirects = read('_redirects');
        assert.truthy(/^\/audio\/words\/\* https:\/\/eng-pwa-audio\.pages\.dev\/audio\/words\/:splat 301$/m
            .test(redirects), '_redirects must forward /audio/words/* to the audio project');
        // The bundle is built by scripts/build-dist.js (deploy.sh runs it);
        // _redirects is one of its required root files.
        assert.truthy(/'_redirects'/.test(read('scripts/build-dist.js')) && /node scripts\/build-dist\.js/.test(read('scripts/deploy.sh')),
            'and the dist build deploy.sh runs must actually ship _redirects');
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

// ── Pronunciation overrides ──────────────────────────────────────────────
// Sent on its own, with no sentence to place the language, the multilingual
// model read "Japan" and "Thailand" as foreign words. Both are now pinned to
// an explicit phoneme spelling.
suite('word audio: pronunciation overrides', () => {
    const gen = () => require(path.join(root, 'scripts', 'generate-word-audio.js'));

    test('an ordinary word is sent as bare text on the default model', () => {
        const g = gen();
        const r = g.synthesisRequest('apple', { model: g.DEFAULT_MODEL });
        assert.equal(r.text, 'apple', 'no markup for words the model already says correctly');
        assert.equal(r.model, g.DEFAULT_MODEL);
    });

    test('an overridden word is sent as a phoneme tag on the English model', () => {
        const g = gen();
        const r = g.synthesisRequest('Japan', { model: g.DEFAULT_MODEL });
        assert.equal(r.text, '<phoneme alphabet="cmu-arpabet" ph="JH AH0 P AE1 N">Japan</phoneme>');
        assert.equal(r.model, g.PRONUNCIATION_MODEL);
        assert.truthy(r.model !== g.DEFAULT_MODEL,
            'eleven_multilingual_v2 ignores <phoneme> and speaks the markup — the tag needs an English model');
    });

    test('the override is found by slug, so any capitalisation hits it', () => {
        const g = gen();
        for (const w of ['thailand', 'Thailand', ' Thailand ']) {
            assert.equal(g.synthesisRequest(w, { model: g.DEFAULT_MODEL }).model, g.PRONUNCIATION_MODEL,
                `"${w}" must reach the override — it is the same recording either way`);
        }
    });

    test('every override is keyed by a real slug and spelled in arpabet', () => {
        const g = gen();
        for (const [slug, pieces] of Object.entries(g.PRONUNCIATION)) {
            assert.equal(g.wordAudioSlug(slug), slug,
                `"${slug}" is not a slug, so it would never match a word`);
            assert.truthy(Array.isArray(pieces) && pieces.length,
                `"${slug}" must list at least one piece to say`);
            for (const [say, ph] of pieces) {
                assert.truthy(say, `"${slug}" has a piece with nothing to say`);
                assert.truthy(/^[A-Z]{1,2}[0-2]?( [A-Z]{1,2}[0-2]?)*$/.test(ph),
                    `"${ph}" is not arpabet — IPA measured unreliable here and must not creep back in`);
            }
        }
    });

    test('a letter-name abbreviation is sent as one tag per letter', () => {
        // "P.E." is two letter names, not a word. As a single tag its two
        // vowels slurred into one syllable and the voice just said "P".
        const g = gen();
        const r = g.synthesisRequest('P.E.', { model: g.DEFAULT_MODEL });
        assert.equal(r.text,
            '<phoneme alphabet="cmu-arpabet" ph="P IY1">P</phoneme>. ' +
            '<phoneme alphabet="cmu-arpabet" ph="IY1">E</phoneme>.');
        assert.equal(r.model, g.PRONUNCIATION_MODEL);
    });

    test('a one-piece word keeps the exact text its recording was cut from', () => {
        // japan and thailand are already correct on disk. A change to how
        // pieces are joined must not silently invalidate them.
        const g = gen();
        assert.equal(g.synthesisRequest('Japan', { model: g.DEFAULT_MODEL }).text,
            '<phoneme alphabet="cmu-arpabet" ph="JH AH0 P AE1 N">Japan</phoneme>');
    });

    test('a misread take is re-cut instead of shipped', () => {
        // The best spelling measured 9/10 — one take is not enough.
        const g = gen();
        assert.truthy(g.VERIFY_ATTEMPTS >= 4, 'too few takes to beat a 1-in-10 misread');
        assert.equal(g.spokenKey('P.E.'), 'pe', 'transcript and slug must compare on letters alone');
        assert.equal(g.spokenKey('p-e'), g.spokenKey('PE'), 'both spellings judge against the same target');
    });

    test('both spellings of the P.E. subject are covered', () => {
        // units-data.js writes "P.E.", units-hk1-data.js writes "PE" — two
        // different slugs, so two recordings, and both were wrong.
        const g = gen();
        for (const w of ['P.E.', 'PE']) {
            const r = g.synthesisRequest(w, { model: g.DEFAULT_MODEL });
            assert.truthy(r.text.includes('ph="P IY1"') && r.text.includes('ph="IY1"'),
                `"${w}" (${g.wordAudioSlug(w)}.mp3) must be spoken as letters`);
        }
    });

    test('the words this was built for stay covered', () => {
        const g = gen();
        for (const w of ['japan', 'thailand', 'pe', 'p-e']) {
            assert.truthy(g.PRONUNCIATION[w], `${w} was mispronounced — dropping its override brings the bug back`);
        }
    });
});

// ── Generation script ────────────────────────────────────────────────────
suite('word audio: generation script', () => {
    const requireGen = () => require(path.join(root, 'scripts', 'generate-word-audio.js'));

    test('collects every speakable word from the data files, deduped', () => {
        const gen = requireGen();
        const words = gen.collectWords();
        // The three Books (js/word-data.js) hold ~520 unique `en` entries.
        assert.deepEqual(gen.DATA_FILES, ['js/word-data.js'], 'the Books are the only flashcard bank');
        assert.truthy(words.length >= 500, `only ${words.length} words collected`);
        assert.contains(words, 'advocate');    // js/word-data.js, Book 1 Unit 1
        assert.contains(words, 'public relations');
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
        assert.equal(all[0], 'advocate', 'unit-practice words must still lead');
        assert.deepEqual(all.slice(0, base.length), base, 'flashcard words keep their order');
    });

    test('includeAnswers adds nothing: the Books speak their `en`, which DATA_FILES already covers', () => {
        // The tabs that spoke a separate correct answer (Word form, Phrases,
        // Collocation, Verbs) are gone; the Book practice says the word
        // itself. answerParts() still splits a "a/ b" pair, for when a bank
        // with pair answers comes back.
        const gen = requireGen();
        assert.deepEqual(gen.ANSWER_BANKS, []);
        assert.deepEqual(gen.collectAnswerWords(), []);
        const base = gen.collectWords({ includeDictionary: true });
        const all = gen.collectWords({ includeDictionary: true, includeAnswers: true });
        assert.deepEqual(all, base, 'no answer bank, so nothing is added');
        assert.deepEqual(gen.answerParts('conclusive/ resign'), ['conclusive', 'resign']);
        assert.falsy(all.some(w => w.includes('/')), 'a pair answer survived unsplit');
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
        assert.deepEqual(gen.TAPPABLE_BANKS.map(b => b.global), ['UNIT_WORDS_PR1', 'UNIT_WORDS_PR2', 'UNIT_WORDS_PR3']);
        for (const b of gen.TAPPABLE_BANKS) assert.deepEqual(b.fields, ['en', 'ex'], 'the answer card wraps the word and its example');
        const words = gen.collectTappableWords();
        assert.truthy(words.length >= 1800, `only ${words.length} tappable words found`);
        assert.contains(words, 'advocate');     // a Book word
        assert.contains(words, 'publicist');    // from an example sentence
        // Vietnamese lives in `vi` / `exVi`, which are never made tappable —
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
        // (free-tier quota) those words must win. word-data.js starts with
        // "advocate" (Book 1, unit 1) — it must lead the collection.
        const gen = requireGen();
        assert.equal(gen.collectWords()[0], 'advocate');
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

suite('word audio: where the recordings are served from follows the host', () => {
    // The repo carries audio/words/ and GitHub Pages serves it next to the
    // app; on Cloudflare the app deploy excludes it (20,000-file cap) and the
    // MP3s come from the eng-pwa-audio project. Both paths hold /audio/words/
    // so sw.js routes them to the audio cache either way.
    const app = loadAppCode();
    test('on GitHub Pages the recordings are the app\'s own, by relative path', () => {
        assert.equal(app.wordAudioBase('0x4123dev.github.io'), 'audio/words/');
        assert.equal(app.wordAudioBase('github.io'), 'audio/words/');
    });
    test('anywhere else (Cloudflare, localhost) they come from the audio CDN', () => {
        assert.equal(app.wordAudioBase('eng-pwa.pages.dev'), 'https://eng-pwa-audio.pages.dev/audio/words/');
        assert.equal(app.wordAudioBase('localhost'), 'https://eng-pwa-audio.pages.dev/audio/words/');
        assert.equal(app.wordAudioBase(''), 'https://eng-pwa-audio.pages.dev/audio/words/');
        assert.equal(app.wordAudioBase('evil-github.io.example.com'), 'https://eng-pwa-audio.pages.dev/audio/words/', 'a lookalike host is not GitHub');
    });
    test('both bases contain the segment the service worker routes to the audio cache', () => {
        const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
        assert.truthy(sw.includes("includes('/audio/words/')"), 'sw.js routes by /audio/words/');
        for (const h of ['0x4123dev.github.io', 'eng-pwa.pages.dev']) {
            assert.truthy((app.wordAudioBase(h)).includes('audio/words/'), h);
        }
        assert.truthy(app.WORD_AUDIO_PATH.includes('audio/words/'), 'the resolved constant too');
    });
    test('the app\'s own copy is complete: every Word-tab word has its MP3 in audio/words/', () => {
        const d = require(path.join(__dirname, '..', 'js', 'word-data.js'));
        const missing = [].concat(d.UNIT_WORDS_PR1, d.UNIT_WORDS_PR2, d.UNIT_WORDS_PR3)
            .map(w => w.en).filter(en => !fs.existsSync(path.join(__dirname, '..', 'audio', 'words', app.wordAudioSlug(en) + '.mp3')));
        assert.deepEqual(missing, [], 'run scripts/generate-word-audio.js for: ' + missing.slice(0, 10).join(', '));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
