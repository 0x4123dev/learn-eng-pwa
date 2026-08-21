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

// Parse the ASSETS array literal out of sw.js (quoted string entries).
function parseAssets() {
    const block = swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\];/);
    if (!block) return null;
    const entries = [];
    const re = /['"]([^'"]+)['"]/g;
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
    test('ASSETS array literal parses with exactly 128 entries', () => {
        assert.equal(ASSETS.length, 128,
            'sw.js ASSETS entry count changed — update this characterization');
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
    test('ASSETS contains 70 JS, 1 CSS, 44 app images and 10 source-paper images', () => {
        assert.equal(JS_ASSETS.length, 70, 'js asset count changed');
        assert.equal(CSS_ASSETS.length, 1, 'css asset count changed');
        assert.equal(IMG_ASSETS.length, 44, 'img asset count changed');
        assert.equal(MATH_EXAM_ASSETS.length, 10, 'math source image count changed');
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
        const castles = IMG_ASSETS.filter(a => /^\/img\/castle-skins\/castles-atlas-[ab]\.png$/.test(a));
        const scenes = IMG_ASSETS.filter(a => /^\/img\/battle-scenes\/[^/]+\/.+\.webp$/.test(a));
        const nightRaid = IMG_ASSETS.filter(a => /^\/img\/night-raid\/.+\.(?:webp|png)$/.test(a));
        assert.equal(svgs.length, 3, `root svg count: ${svgs.join(', ')}`);
        assert.equal(pets.length, 0, `obsolete pet png count: ${pets.join(', ')}`);
        assert.equal(teammates.length, 3, `teammate portrait count: ${teammates.join(', ')}`);
        assert.equal(castles.length, 2, `castle atlas count: ${castles.join(', ')}`);
        assert.equal(scenes.length, 24, `battle scene cache count: ${scenes.join(', ')}`);
        assert.equal(nightRaid.length, 12, `night raid art count: ${nightRaid.join(', ')}`);
        assert.equal(svgs.length + pets.length + teammates.length + castles.length + scenes.length + nightRaid.length, IMG_ASSETS.length);
    });
});

// ============================================================================
// INDEX.HTML — script tags resolve and load in dependency order
// ============================================================================
suite('gen: index.html script tags', () => {
    test('index.html has exactly 69 <script src> tags, all under js/', () => {
        assert.equal(SCRIPT_SRCS.length, 69,
            'script tag count changed — update this characterization');
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

    test('ordering: phrases-data.js loads before phrases.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/phrases-data.js');
        const b = SCRIPT_SRCS.indexOf('js/phrases.js');
        assert.truthy(a !== -1 && b !== -1, 'phrases scripts not found in index.html');
        assert.truthy(a < b, `phrases-data.js (idx ${a}) must precede phrases.js (idx ${b})`);
    });

    test('ordering: wordform-data.js loads before wordform.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/wordform-data.js');
        const b = SCRIPT_SRCS.indexOf('js/wordform.js');
        assert.truthy(a !== -1 && b !== -1, 'wordform scripts not found in index.html');
        assert.truthy(a < b, `wordform-data.js (idx ${a}) must precede wordform.js (idx ${b})`);
    });

    test('ordering: exam-data.js loads before exam.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/exam-data.js');
        const b = SCRIPT_SRCS.indexOf('js/exam.js');
        assert.truthy(a !== -1 && b !== -1, 'exam scripts not found in index.html');
        assert.truthy(a < b, `exam-data.js (idx ${a}) must precede exam.js (idx ${b})`);
    });

    test('ordering: auth.js loads before app.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/auth.js');
        const b = SCRIPT_SRCS.indexOf('js/app.js');
        assert.truthy(a !== -1 && b !== -1, 'auth/app scripts not found in index.html');
        assert.truthy(a < b, `auth.js (idx ${a}) must precede app.js (idx ${b})`);
    });

    test('ordering: rewrite-data.js loads before rewrite.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/rewrite-data.js');
        const b = SCRIPT_SRCS.indexOf('js/rewrite.js');
        assert.truthy(a !== -1 && b !== -1, 'rewrite scripts not found in index.html');
        assert.truthy(a < b, `rewrite-data.js (idx ${a}) must precede rewrite.js (idx ${b})`);
    });

    test('ordering: phrases-meanings.js loads before phrases.js', () => {
        const a = SCRIPT_SRCS.indexOf('js/phrases-meanings.js');
        const b = SCRIPT_SRCS.indexOf('js/phrases.js');
        assert.truthy(a !== -1 && b !== -1, 'phrases-meanings/phrases not found in index.html');
        assert.truthy(a < b, `phrases-meanings.js (idx ${a}) must precede phrases.js (idx ${b})`);
    });

    test('ordering: grammar-units.js and grammar-lessons.js load before grammar-ui.js', () => {
        const units = SCRIPT_SRCS.indexOf('js/grammar-units.js');
        const lessons = SCRIPT_SRCS.indexOf('js/grammar-lessons.js');
        const ui = SCRIPT_SRCS.indexOf('js/grammar-ui.js');
        assert.truthy(units !== -1 && lessons !== -1 && ui !== -1,
            'grammar scripts not found in index.html');
        assert.truthy(units < ui, `grammar-units.js (idx ${units}) must precede grammar-ui.js (idx ${ui})`);
        assert.truthy(lessons < ui, `grammar-lessons.js (idx ${lessons}) must precede grammar-ui.js (idx ${ui})`);
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
    process.exit(harness.runAll());
}
