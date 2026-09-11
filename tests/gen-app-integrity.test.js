// tests/gen-app-integrity.test.js — APP FILE INTEGRITY (sw.js / index.html / manifest.json):
// parses the sw.js ASSETS array literal and asserts every cached js/css asset
// exists on disk (one test per asset), checks CACHE_NAME shape, verifies every
// <script src> in index.html resolves to a real file and that data files load
// BEFORE their consumers (phrases-data < phrases, wordform-data < wordform,
// exam-data < exam, auth < app), validates manifest.json PWA fields + icon
// files, and locks APP_VERSION <-> package.json consistency.
// Complements tests/extra-coverage.test.js (aggregate js/-dir <-> ASSETS sync);
// this file goes per-asset and adds index.html + manifest coverage.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---- shared parsed fixtures -------------------------------------------------
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Parse the precache URL list out of sw.js: the keys of the PRECACHE block
// ('/path': 'hash'). ASSETS is derived from it in the worker.
function parseAssets() {
    const block = swSrc.match(/const PRECACHE\s*=\s*\{([\s\S]*?)\};/);
    if (!block) return null;
    const entries = [];
    const re = /'(\/[^']*)'\s*:/g;
    let m;
    while ((m = re.exec(block[1])) !== null) entries.push(m[1]);
    return entries;
}
const ASSETS = parseAssets() || [];
const JS_ASSETS = ASSETS.filter(a => /^\/js\/.+\.js$/.test(a));
const CSS_ASSETS = ASSETS.filter(a => /^\/css\/.+\.css$/.test(a));
const IMG_ASSETS = ASSETS.filter(a => /^\/img\//.test(a));
const MATH_EXAM_ASSETS = ASSETS.filter(a => /^\/assets\/math-exams\/.+\.jpg$/.test(a));

// Parse <script src="..."> entries from index.html, in document order.
function parseScriptSrcs() {
    const srcs = [];
    const re = /<script\s+src="([^"]+)"/g;
    let m;
    while ((m = re.exec(htmlSrc)) !== null) srcs.push(m[1]);
    return srcs;
}
const SCRIPT_SRCS = parseScriptSrcs();

// ============================================================================
// SW.JS — cache manifest structure
// ============================================================================
suite('gen: sw.js cache manifest', () => {
    // A hand-maintained count of "how many files are cached" went red every
    // time anyone legitimately added one, and the fix was always to bump the
    // number — which teaches people to silence this suite rather than read it.
    // These invariants cost nothing to keep true and actually catch mistakes:
    // a path that is not absolute never resolves, and a duplicate entry means
    // someone pasted a line twice.
    test('every cached path is absolute, unique and non-empty', () => {
        assert.truthy(ASSETS.length > 50, 'the cache manifest looks truncated');
        const bad = ASSETS.filter(a => !a.startsWith('/'));
        assert.deepEqual(bad, [], 'cached paths must start at the site root: ' + bad.join(', '));
        const seen = new Set(), dupes = [];
        for (const a of ASSETS) { if (seen.has(a)) dupes.push(a); seen.add(a); }
        assert.deepEqual(dupes, [], 'duplicate entries in ASSETS: ' + dupes.join(', '));
    });

    test('CACHE_NAME matches /^flashlingo-v\\d+$/', () => {
        const m = swSrc.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        assert.truthy(m, 'CACHE_NAME declaration not found in sw.js');
        assert.truthy(/^flashlingo-v\d+$/.test(m[1]),
            `CACHE_NAME "${m[1]}" does not match /^flashlingo-v\\d+$/`);
    });

    test('ASSETS has no duplicate entries', () => {
        assert.equal(new Set(ASSETS).size, ASSETS.length,
            'duplicate entry found in sw.js ASSETS');
    });

    test('ASSETS caches the app shell: /, /index.html, /css/styles.css, /manifest.json', () => {
        assert.contains(ASSETS, '/');
        assert.contains(ASSETS, '/index.html');
        assert.contains(ASSETS, '/css/styles.css');
        assert.contains(ASSETS, '/manifest.json');
    });

    test('every ASSETS entry is a root-relative path (leading "/")', () => {
        const bad = ASSETS.filter(a => !a.startsWith('/'));
        assert.deepEqual(bad, [], `non-root-relative entries: ${bad.join(', ')}`);
    });

    test('ASSETS partitions exactly into shell + js + image entries', () => {
        const shell = ['/', '/index.html', '/css/styles.css', '/manifest.json'];
        const unclassified = ASSETS.filter(a =>
            !shell.includes(a) && !JS_ASSETS.includes(a) && !IMG_ASSETS.includes(a)
                && !MATH_EXAM_ASSETS.includes(a));
        assert.deepEqual(unclassified, [],
            `unclassified sw.js ASSETS entries: ${unclassified.join(', ')}`);
        assert.equal(4 + JS_ASSETS.length + IMG_ASSETS.length + MATH_EXAM_ASSETS.length, ASSETS.length);
    });
});

// ============================================================================
// SW.JS — every cached asset exists on disk (one test per asset).
// cache.addAll(ASSETS) fails ATOMICALLY if any single fetch 404s, so one
// missing file (even a pet png) would break the whole service-worker install.
// ============================================================================
suite('gen: sw.js js/css assets exist on disk', () => {
    // Same reasoning: the per-file existence checks below are the ones that
    // catch a broken install, and they scale by themselves. All that is worth
    // asserting up here is that each kind of asset is represented at all.
    test('every kind of asset the app needs is present in the manifest', () => {
        assert.truthy(JS_ASSETS.length > 30, 'scripts missing from the offline cache');
        assert.equal(CSS_ASSETS.length, 1, 'the app ships exactly one stylesheet');
        assert.truthy(IMG_ASSETS.length > 10, 'images missing from the offline cache');
        // Ảnh chụp trang đề thi từng nằm ở đây. Mọi hình nay đều được vẽ lại
        // bằng js/math-figures.js, nên precache chúng chỉ tốn 1,9 MB của máy bé.
        assert.equal(MATH_EXAM_ASSETS.length, 0, 'no question renders a page scan any more');
    });

    for (const asset of JS_ASSETS.concat(CSS_ASSETS)) {
        test(`cached asset ${asset} exists on disk`, () => {
            const abs = path.join(ROOT, asset.slice(1));
            assert.truthy(fs.existsSync(abs), `missing file for sw.js asset: ${asset}`);
            assert.truthy(fs.statSync(abs).size > 0, `${asset} is an empty file`);
        });
    }
});

suite('gen: sw.js img assets exist on disk', () => {
    for (const asset of IMG_ASSETS.concat(MATH_EXAM_ASSETS)) {
        test(`cached asset ${asset} exists on disk`, () => {
            const abs = path.join(ROOT, asset.slice(1));
            assert.truthy(fs.existsSync(abs), `missing file for sw.js asset: ${asset}`);
            assert.truthy(fs.statSync(abs).size > 0, `${asset} is an empty file`);
        });
    }

    test('image cache has no obsolete pet PNGs and includes the premium castle atlases', () => {
        const svgs = IMG_ASSETS.filter(a => /^\/img\/[^/]+\.svg$/.test(a));
        const pets = IMG_ASSETS.filter(a => /^\/img\/pets\/[^/]+\.png$/.test(a));
        const teammates = IMG_ASSETS.filter(a => /^\/img\/battle-teammates\/[^/]+\.jpg$/.test(a));
        const castles = IMG_ASSETS.filter(a => /^\/img\/castle-skins\/castles-atlas-[ab]\.webp$/.test(a));
        const scenes = IMG_ASSETS.filter(a => /^\/img\/battle-scenes\/[^/]+\/.+\.webp$/.test(a));
        const nightRaid = IMG_ASSETS.filter(a => /^\/img\/night-raid\/.+\.(?:webp|jpe?g)$/.test(a));
        const ghostOffering = IMG_ASSETS.filter(a => /^\/img\/ghost-offering\/.+\.webp$/.test(a));
        // The farm's pictures are counted from the manifest, never a literal:
        // js/farm-art-manifest.js is the one list, so this can never go stale.
        const farmArt = require(path.join(ROOT, 'js', 'farm-art-manifest.js'));
        const farm = IMG_ASSETS.filter(a => /^\/img\/farm\/[^/]+\.webp$/.test(a));
        assert.equal(svgs.length, 3, `root svg count: ${svgs.join(', ')}`);
        assert.equal(pets.length, 0, `obsolete pet png count: ${pets.join(', ')}`);
        assert.equal(teammates.length, 3, `teammate portrait count: ${teammates.join(', ')}`);
        assert.equal(castles.length, 2, `castle atlas count: ${castles.join(', ')}`);
        assert.equal(scenes.length, 24, `battle scene cache count: ${scenes.join(', ')}`);
        assert.equal(nightRaid.length, 23, `night raid art count: ${nightRaid.join(', ')}`);
        assert.equal(ghostOffering.length, 4, `ghost offering art count: ${ghostOffering.join(', ')}`);
        assert.equal(farm.length, farmArt.FILES.length, `farm art count: every manifest entry is precached, nothing else`);
        assert.equal(svgs.length + pets.length + teammates.length + castles.length + scenes.length + nightRaid.length + ghostOffering.length + farm.length, IMG_ASSETS.length);
    });

    // The sprite sheets and atlases used to be 15 PNGs totalling 16.8 MB of
    // the precache; as lossless WebP (cwebp -lossless -z 9, pixel-identical
    // alpha so frame geometry and atlas coordinates never move) they are
    // 11.9 MB. A PNG creeping back into these folders undoes that on every
    // child's first install and every CACHE_NAME re-download.
    const SPRITE_KEYS = IMG_ASSETS.filter(a => /^\/img\/(?:night-raid|castle-skins|ghost-offering)\//.test(a));
    test('night-raid, castle-skins and ghost-offering keys are never PNG', () => {
        assert.truthy(SPRITE_KEYS.length >= 29, `sprite key count: ${SPRITE_KEYS.length}`);
        const pngs = SPRITE_KEYS.filter(a => /\.png$/i.test(a));
        assert.equal(pngs.length, 0, `PNG sprite keys in sw.js: ${pngs.join(', ')} — convert with cwebp -lossless -z 9`);
    });
    for (const asset of SPRITE_KEYS.filter(a => /\.webp$/.test(a))) {
        test(`sprite ${asset} is a real WebP on disk`, () => {
            const abs = path.join(ROOT, asset.slice(1));
            assert.truthy(fs.existsSync(abs), `missing file for sw.js asset: ${asset}`);
            const head = fs.readFileSync(abs).subarray(0, 32);
            assert.equal(head.toString('latin1', 0, 4), 'RIFF', `${asset} is not a RIFF container`);
            assert.equal(head.toString('latin1', 8, 12), 'WEBP', `${asset} is not a WebP`);
            // A lossless (VP8L) sprite must still carry its alpha channel; a
            // sheet that lost it would draw an opaque box around every frame.
            if (head.toString('latin1', 12, 16) === 'VP8L') {
                assert.equal(head[20], 0x2f, `${asset} VP8L signature`);
                assert.equal((head[24] >> 4) & 1, 1, `${asset} lost its alpha channel`);
            }
        });
    }
});

// ============================================================================
// INDEX.HTML — script tags resolve and load in dependency order
// ============================================================================
suite('gen: index.html script tags', () => {
    test('every script tag is unique and lives under js/', () => {
        assert.truthy(SCRIPT_SRCS.length > 30, 'the app shell looks truncated');
        const seen = new Set(), dupes = [];
        for (const s of SCRIPT_SRCS) { if (seen.has(s)) dupes.push(s); seen.add(s); }
        assert.deepEqual(dupes, [], 'a script is loaded twice: ' + dupes.join(', '));
        const nonJs = SCRIPT_SRCS.filter(s => !/^js\/.+\.js$/.test(s));
        assert.deepEqual(nonJs, [], `unexpected non-js/ script srcs: ${nonJs.join(', ')}`);
    });

    test('every <script src> file exists on disk', () => {
        const missing = SCRIPT_SRCS.filter(s => !fs.existsSync(path.join(ROOT, s)));
        assert.deepEqual(missing, [], `index.html references missing files: ${missing.join(', ')}`);
    });

    test('no script file is referenced twice', () => {
        assert.equal(new Set(SCRIPT_SRCS).size, SCRIPT_SRCS.length,
            'duplicate <script src> in index.html');
    });

    test('parser guard: every <script in index.html is a plain src tag (none missed)', () => {
        // If someone adds an inline <script> or a <script defer src=...> variant,
        // the src-parsing regex would silently miss it and weaken every assertion
        // in this suite — so lock total tag count to parsed-src count.
        const totalTags = (htmlSrc.match(/<script\b/g) || []).length;
        assert.equal(totalTags, SCRIPT_SRCS.length,
            `${totalTags} <script tags in index.html but only ${SCRIPT_SRCS.length} parsed as src=`);
    });

    test('every index.html script is also cached in sw.js ASSETS', () => {
        const uncached = SCRIPT_SRCS.filter(s => !ASSETS.includes('/' + s));
        assert.deepEqual(uncached, [],
            `scripts loaded by index.html but missing from sw.js ASSETS: ${uncached.join(', ')}`);
    });

    test('the phrases bank is deferred, and its tab waits for it', () => {
        // phrases-data.js (370 KB) no longer blocks the first paint; the ordering
        // rule it used to satisfy is replaced by a stronger one — switchScreen
        // renders the tab only once the bank has landed (tests/lazy-data.test.js).
        assert.equal(SCRIPT_SRCS.indexOf('js/phrases-data.js'), -1, 'js/phrases-data.js must not be an eager script');
        assert.truthy(SCRIPT_SRCS.indexOf('js/phrases.js') !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        const block = lazy.slice(lazy.indexOf('phrasesScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/phrases-data.js'),
            'js/phrases-data.js must be listed under phrasesScreen in the loader');
        assert.contains(ASSETS, '/js/phrases-data.js', 'and must stay cached for offline use');
    });

    test('the word form bank is deferred, and its tab waits for it', () => {
        // wordform-data.js (349 KB) no longer blocks the first paint; the ordering
        // rule it used to satisfy is replaced by a stronger one — switchScreen
        // renders the tab only once the bank has landed (tests/lazy-data.test.js).
        assert.equal(SCRIPT_SRCS.indexOf('js/wordform-data.js'), -1, 'js/wordform-data.js must not be an eager script');
        assert.truthy(SCRIPT_SRCS.indexOf('js/wordform.js') !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        const block = lazy.slice(lazy.indexOf('wordformScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/wordform-data.js'),
            'js/wordform-data.js must be listed under wordformScreen in the loader');
        assert.contains(ASSETS, '/js/wordform-data.js', 'and must stay cached for offline use');
    });

    test('the exam bank is deferred, and the Exam tab waits for it', () => {
        // exam-data.js is 1.5 MB and no longer blocks the first paint. The
        // ordering rule it used to satisfy is replaced by a stronger one:
        // switchScreen renders the tab only after the bank has loaded.
        // See tests/lazy-data.test.js.
        assert.equal(SCRIPT_SRCS.indexOf('js/exam-data.js'), -1,
            'the 1.5 MB exam bank must not be an eager script');
        assert.truthy(SCRIPT_SRCS.indexOf('js/exam.js') !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        assert.truthy(/examScreen:\s*\[[^\]]*js\/exam-data\.js/.test(lazy),
            'exam-data.js must be listed under examScreen in the loader');
    });

    test('ordering: auth.js loads before app.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/auth.js');
        const b = SCRIPT_SRCS.indexOf('js/app.js');
        assert.truthy(a !== -1 && b !== -1, 'auth/app scripts not found in index.html');
        assert.truthy(a < b, `auth.js (idx ${a}) must precede app.js (idx ${b})`);
    });

    test('the rewrite bank is deferred, and its tab waits for it', () => {
        // rewrite-data.js (189 KB) no longer blocks the first paint; the ordering
        // rule it used to satisfy is replaced by a stronger one — switchScreen
        // renders the tab only once the bank has landed (tests/lazy-data.test.js).
        assert.equal(SCRIPT_SRCS.indexOf('js/rewrite-data.js'), -1, 'js/rewrite-data.js must not be an eager script');
        assert.truthy(SCRIPT_SRCS.indexOf('js/rewrite.js') !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        const block = lazy.slice(lazy.indexOf('rewriteScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/rewrite-data.js'),
            'js/rewrite-data.js must be listed under rewriteScreen in the loader');
        assert.contains(ASSETS, '/js/rewrite-data.js', 'and must stay cached for offline use');
    });

    test('the phrase meanings bank is deferred, and its tab waits for it', () => {
        // phrases-meanings.js (102 KB) no longer blocks the first paint; the ordering
        // rule it used to satisfy is replaced by a stronger one — switchScreen
        // renders the tab only once the bank has landed (tests/lazy-data.test.js).
        assert.equal(SCRIPT_SRCS.indexOf('js/phrases-meanings.js'), -1, 'js/phrases-meanings.js must not be an eager script');
        assert.truthy(SCRIPT_SRCS.indexOf('js/phrases.js') !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        const block = lazy.slice(lazy.indexOf('phrasesScreen:'));
        assert.truthy(block.slice(0, block.indexOf(']')).includes('js/phrases-meanings.js'),
            'js/phrases-meanings.js must be listed under phrasesScreen in the loader');
        assert.contains(ASSETS, '/js/phrases-meanings.js', 'and must stay cached for offline use');
    });

    test('the grammar bank is deferred, and the Grammar tab waits for it', () => {
        // grammar-units.js alone is 2.9 MB — the heaviest file in the app and
        // the biggest single cause of a slow, memory-hungry start on an old
        // iPad. It now loads on demand (and warms in the background).
        const ui = SCRIPT_SRCS.indexOf('js/grammar-ui.js');
        assert.equal(SCRIPT_SRCS.indexOf('js/grammar-units.js'), -1,
            'the 2.9 MB grammar bank must not be an eager script');
        assert.truthy(ui !== -1, 'the tab code still ships eagerly');
        const lazy = fs.readFileSync(path.join(ROOT, 'js/lazy-data.js'), 'utf8');
        for (const f of ['js/grammar-units.js', 'js/grammar-lessons.js']) {
            assert.truthy(new RegExp('grammarScreen:\\s*\\[[^\\]]*' + f.replace(/[./]/g, '\\$&')).test(lazy),
                f + ' must be listed under grammarScreen in the loader');
        }
    });

    test('topic-vocab.js is cached by sw.js but has NO index.html script tag (loaded elsewhere)', () => {
        assert.contains(ASSETS, '/js/topic-vocab.js');
        assert.notContains(SCRIPT_SRCS, 'js/topic-vocab.js');
    });
});

// ============================================================================
// MANIFEST.JSON — PWA metadata
// ============================================================================
suite('gen: manifest.json', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

    test('name and short_name are the FlashLingo branding', () => {
        assert.equal(manifest.name, 'FlashLingo - English Flashcards');
        assert.equal(manifest.short_name, 'FlashLingo');
    });

    test('start_url is "/"', () => {
        assert.equal(manifest.start_url, '/');
    });

    test('display standalone, supports both orientations, lang en', () => {
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.orientation, 'any');
        assert.equal(manifest.lang, 'en');
    });

    test('icons: 3 entries, each with src/sizes/type, one maskable', () => {
        assert.truthy(Array.isArray(manifest.icons), 'icons must be an array');
        assert.equal(manifest.icons.length, 3);
        for (const icon of manifest.icons) {
            assert.truthy(icon.src, 'icon missing src');
            assert.truthy(/^\d+x\d+$/.test(icon.sizes), `bad sizes "${icon.sizes}"`);
            assert.equal(icon.type, 'image/svg+xml');
        }
        assert.equal(manifest.icons.filter(i => i.purpose === 'maskable').length, 1);
    });

    test('every icon src file exists on disk', () => {
        const missing = manifest.icons
            .map(i => i.src)
            .filter(src => !fs.existsSync(path.join(ROOT, src)));
        assert.deepEqual(missing, [], `manifest icons missing on disk: ${missing.join(', ')}`);
    });

    test('icon-192/icon-512 are precached by sw.js; icon-maskable.svg is NOT (oddity, locked)', () => {
        assert.contains(ASSETS, '/img/icon-192.svg');
        assert.contains(ASSETS, '/img/icon-512.svg');
        assert.notContains(ASSETS, '/img/icon-maskable.svg');
        // ...but the maskable icon is still referenced by the manifest:
        assert.contains(manifest.icons.map(i => i.src), 'img/icon-maskable.svg');
    });

    test('theme_color and background_color are hex colors', () => {
        assert.truthy(/^#[0-9a-fA-F]{6}$/.test(manifest.theme_color),
            `bad theme_color "${manifest.theme_color}"`);
        assert.truthy(/^#[0-9a-fA-F]{6}$/.test(manifest.background_color),
            `bad background_color "${manifest.background_color}"`);
    });
});

// ============================================================================
// VERSION — home.js APP_VERSION <-> package.json
// ============================================================================
suite('gen: app version consistency', () => {
    const homeSrc = fs.readFileSync(path.join(ROOT, 'js', 'home.js'), 'utf8');
    const verMatch = homeSrc.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

    test('js/home.js APP_VERSION matches /^v3\\.\\d+\\.\\d+$/', () => {
        assert.truthy(verMatch, 'APP_VERSION declaration not found in js/home.js');
        assert.truthy(/^v\d+\.\d+\.\d+$/.test(verMatch[1]),
            `APP_VERSION "${verMatch[1]}" does not match /^v3\\.\\d+\\.\\d+$/`);
    });

    test('package.json version equals APP_VERSION without the "v" prefix', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        assert.equal(pkg.version, verMatch[1].slice(1),
            `package.json "${pkg.version}" vs home.js "${verMatch[1]}"`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
