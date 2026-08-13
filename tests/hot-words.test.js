// hot-words.test.js — the small pre-warmed word list.
//
// Tapping any word in a question plays a recording, but the first tap of a
// word costs a network round trip. twPrefetch() already warms each question's
// own words at render — ~20 words in about half a second, against the ten to
// twenty the student spends answering — so this list is only a safety net for
// the very first taps and for a slow or absent network. 100 words, 1.3 MB.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { loadAppCode } = require('./setup');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const requireBuilder = () => require(path.join(root, 'scripts', 'build-hot-words.js'));

suite('hot words: the generated list', () => {
    test('js/hot-words.js exists and exports exactly 100 ranked words', () => {
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        assert.truthy(Array.isArray(HOT_WORDS), 'HOT_WORDS must be an array');
        assert.equal(HOT_WORDS.length, 100);
        assert.equal(new Set(HOT_WORDS).size, 100, 'duplicates in the list');
        assert.truthy(HOT_WORDS.every(w => typeof w === 'string' && w === w.toLowerCase().trim()),
            'entries must be clean lowercase words');
    });

    test('every hot word has a recording on disk', () => {
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        const gen = require(path.join(root, 'scripts', 'generate-word-audio.js'));
        const missing = HOT_WORDS.filter(w =>
            !fs.existsSync(path.join(root, 'audio', 'words', gen.wordAudioSlug(w) + '.mp3')));
        assert.deepEqual(missing, [], 'hot words without audio would warm 404s');
    });

    test('the list is genuinely frequency-ranked, commonest first', () => {
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        // "the" is the most common English word by a wide margin; it and other
        // function words must sit far above topic nouns.
        assert.truthy(HOT_WORDS.indexOf('the') >= 0 && HOT_WORDS.indexOf('the') < 10,
            `"the" ranked ${HOT_WORDS.indexOf('the')} — the list is not frequency-ordered`);
        // A word that did not make the list ranks worse than any that did —
        // otherwise indexOf's -1 reads as "first" and the check inverts.
        const rank = (w) => { const i = HOT_WORDS.indexOf(w); return i === -1 ? Infinity : i; };
        assert.truthy(rank('to') < rank('yesterday'), 'function words must outrank topic words');
    });

    test('every hot word is one a student can actually tap', () => {
        // The list exists to make taps instant. Warming words that are never
        // tappable — Vietnamese from the explanations, `type` metadata, stray
        // letters — spends the student's data on files nobody can reach.
        const gen = require(path.join(root, 'scripts', 'generate-word-audio.js'));
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        const tappable = new Set(gen.collectTappableWords());
        const strays = HOT_WORDS.filter(w => !tappable.has(w));
        assert.deepEqual(strays.slice(0, 12), [],
            `${strays.length} hot words are not tappable anywhere`);
    });

    test('regenerating from the banks reproduces the shipped list', () => {
        // Guards against the list silently going stale as questions are added.
        const builder = requireBuilder();
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        assert.deepEqual(builder.topWords(100), HOT_WORDS,
            'js/hot-words.js is stale — re-run: node scripts/build-hot-words.js');
    });

    test('HTML markup in explanations is not mistaken for words', () => {
        // Explanations carry <br> and <b> markup. Those render as formatting,
        // never as tappable text, so counting them would waste hot slots on
        // "br"/"b" — and warm recordings nobody can ever tap.
        const builder = requireBuilder();
        const words = builder.tappableWords('<b>Signal</b>: yesterday<br>🔑 use the past<br/>');
        assert.notContains(words, 'br');
        assert.notContains(words, 'b');
        assert.contains(words, 'signal');
        assert.contains(words, 'yesterday');
    });

    test('the shipped list contains no markup fragments', () => {
        const { HOT_WORDS } = require(path.join(root, 'js', 'hot-words.js'));
        // Only tokens that can never be English words. "i", "b" and "strong"
        // are excluded from this list on purpose: <i>/<b> are stripped as
        // tags, but "I" is the pronoun (2,560 uses) and "strong" an adjective,
        // so seeing them here is correct.
        for (const junk of ['br', 'nbsp', 'amp', 'quot']) {
            assert.notContains(HOT_WORDS, junk, `"${junk}" is markup, not a word students tap`);
        }
    });

    test('frequencies are drawn from every quiz bank, not just grammar', () => {
        const builder = requireBuilder();
        assert.truthy(builder.BANKS.length >= 6, `only ${builder.BANKS.length} banks scanned`);
        const names = builder.BANKS.map(b => b.file).join(' ');
        for (const f of ['grammar-units', 'exam-data', 'wordform-data', 'rewrite-data',
                         'phrases-data', 'collocation-data']) {
            assert.truthy(names.includes(f), `${f} is not scanned`);
        }
    });
});

suite('hot words: background warming', () => {
    function loadWithNet(extra) {
        const fetched = [];
        const store = {};
        const sandbox = {
            fetch: (url) => { fetched.push(url); return Promise.resolve({ ok: true }); },
            // Run idle work immediately so the batching completes synchronously.
            requestIdleCallback: (fn) => { fn({ timeRemaining: () => 50 }); return 1; },
            HOT_WORDS: ['the', 'ice cream', 'zoo'],
            localStorage: {
                getItem: (k) => (k in store ? store[k] : null),
                setItem: (k, v) => { store[k] = String(v); },
                removeItem: (k) => { delete store[k]; },
                clear: () => {}
            }
        };
        Object.assign(sandbox, extra || {});
        const app = loadAppCode({ includeHome: false, extraGlobals: sandbox });
        return { app, fetched, store };
    }

    test('warms every hot word through fetch, not Audio elements', () => {
        let audioCreated = 0;
        class CountingAudio { constructor() { audioCreated++; } play() { return { catch() {} }; } }
        const { app, fetched } = loadWithNet({ Audio: CountingAudio });
        const n = app.warmHotWords();
        assert.equal(n, 3, 'should schedule all three words');
        assert.deepEqual(fetched.slice().sort(), [
            'audio/words/ice-cream.mp3', 'audio/words/the.mp3', 'audio/words/zoo.mp3'
        ]);
        assert.equal(audioCreated, 0, '1000 Audio elements would be a memory problem — use fetch');
    });

    test('skips entirely when the user asked to save data', () => {
        const { app, fetched } = loadWithNet({
            navigator: { connection: { saveData: true }, serviceWorker: { register: () => Promise.resolve() } }
        });
        assert.equal(app.warmHotWords(), 0);
        assert.deepEqual(fetched, [], 'Save-Data means download nothing speculative');
    });

    test('skips on a 2g connection', () => {
        const { app, fetched } = loadWithNet({
            navigator: { connection: { effectiveType: '2g' }, serviceWorker: { register: () => Promise.resolve() } }
        });
        assert.equal(app.warmHotWords(), 0);
        assert.deepEqual(fetched, []);
    });

    test('runs once, then never again for the same list', () => {
        const { app, fetched, store } = loadWithNet();
        app.warmHotWords();
        const after = fetched.length;
        // The key carries the audio version (so a re-voice re-warms), so match
        // the prefix rather than pinning a name that is meant to change.
        const flagKey = Object.keys(store).find(k => k.startsWith('hotWordsWarmed'));
        assert.truthy(flagKey, `completion must be recorded — store held ${JSON.stringify(Object.keys(store))}`);
        assert.equal(app.warmHotWords(), 0, 'second call must be a no-op');
        assert.equal(fetched.length, after, 'nothing re-fetched on a later visit');
    });

    test('a fetch failure never rejects or blocks the rest', () => {
        const { app } = loadWithNet({
            fetch: () => Promise.reject(new Error('offline'))
        });
        app.warmHotWords();   // must not throw
        assert.truthy(true);
    });
});

// Tap-to-hear only switches on AFTER the question is answered — so the whole
// time the student is reading and choosing, the network is idle and the words
// they are about to be able to tap can be fetched for free. Combined with the
// hot list, that closes the remaining ~24% tail.
suite('hot words: the rest of a question warms while you answer', () => {
    function loadTapwords(extraGlobals) {
        const vm = require('vm');
        const warmed = [];
        const sandbox = {
            console,
            module: { exports: {} },
            WORD_VI: {},
            warmWord: (w) => { warmed.push(w); return true; },
            document: { getElementById: () => null, querySelector: () => null }
        };
        Object.assign(sandbox, extraGlobals || {});
        sandbox.globalThis = sandbox; sandbox.global = sandbox; sandbox.window = sandbox;
        const ctx = vm.createContext(sandbox);
        vm.runInContext(read('js/tapwords.js'), ctx, { filename: 'tapwords.js' });
        return { tw: sandbox.module.exports, warmed };
    }

    test('twPrefetch warms every tappable word in the question text', () => {
        // Case is irrelevant — warmWord slugs each word, and dedups on the
        // slug (proven separately below), so "She" and "she" are one file.
        const { tw, warmed } = loadTapwords();
        tw.twPrefetch('She <b>bought</b> a ticket yesterday.');
        assert.deepEqual(warmed.map(w => w.toLowerCase()).sort(),
            ['a', 'bought', 'she', 'ticket', 'yesterday']);
    });

    test('twPrefetch ignores Vietnamese glosses and markup, like tapwordsWrap does', () => {
        const { tw, warmed } = loadTapwords();
        tw.twPrefetch('quá khứ đơn <br> past simple');
        assert.deepEqual(warmed.slice().sort(), ['past', 'simple']);
    });

    test('twPrefetch accepts several strings (question + options)', () => {
        const { tw, warmed } = loadTapwords();
        tw.twPrefetch('He ___ home.', ['went', 'goes']);
        assert.deepEqual(warmed.map(w => w.toLowerCase()).sort(), ['goes', 'he', 'home', 'went']);
    });

    test('it is a safe no-op when the audio layer is absent', () => {
        const { tw } = loadTapwords({ warmWord: undefined });
        tw.twPrefetch('anything at all');   // must not throw
        assert.truthy(true);
    });

    test('warmWord fetches once per word and never twice', () => {
        const fetched = [];
        const app = loadAppCode({
            includeHome: false,
            extraGlobals: { fetch: (u) => { fetched.push(u); return Promise.resolve({ ok: true }); } }
        });
        assert.equal(app.warmWord('Ticket'), true);
        assert.equal(app.warmWord('ticket'), false, 'same word, already warmed');
        assert.deepEqual(fetched, ['audio/words/ticket.mp3']);
    });

    test('every quiz renderer warms its question before the answer', () => {
        const banks = ['js/grammar-ui.js', 'js/exam.js', 'js/wordform.js',
                       'js/rewrite.js', 'js/phrases.js', 'js/collocation.js'];
        const missing = banks.filter(f => !/twPrefetch\(/.test(read(f)));
        assert.deepEqual(missing, [],
            `these quiz screens never warm their words: ${missing.join(', ')}`);
    });
});

suite('hot words: wiring', () => {
    test('index.html loads hot-words.js before app.js', () => {
        const html = read('index.html');
        const hot = html.indexOf('js/hot-words.js');
        const app = html.indexOf('js/app.js');
        assert.truthy(hot !== -1, 'index.html must load js/hot-words.js');
        assert.truthy(hot < app, 'hot-words.js must load before app.js reads HOT_WORDS');
    });

    test('the service worker precaches the list itself', () => {
        assert.truthy(/hot-words\.js/.test(read('sw.js')),
            'sw.js ASSETS must include js/hot-words.js');
    });

    test('warming is kicked off at startup', () => {
        assert.truthy(/warmHotWords\(/.test(read('js/app.js').replace(/function warmHotWords[\s\S]*?\n}/, '')),
            'app.js must actually call warmHotWords()');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
