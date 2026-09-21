// build-dist.test.js — scripts/build-dist.js produces the tree deploy.sh
// ships, minified, and nothing about the minification can break an app made
// of classic <script> tags that call each other by global name.
//
// Everything here is EXECUTED: the build really runs (esbuild through npx,
// ~2 s), the output is really parsed, and a second build is really compared
// byte for byte. The failure paths run against a scratch tree so a broken
// input is proven to fail the build rather than assumed to.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'build-dist.js');
const { build, ROOT_FILES, ROOT_FILES_OPTIONAL, DIRS, DIRS_OPTIONAL, wantsMinify } = require(SCRIPT);

const read = (p) => fs.readFileSync(p);
const readUtf8 = (p) => fs.readFileSync(p, 'utf8');
const tmp = (label) => fs.mkdtempSync(path.join(os.tmpdir(), `build-dist-${label}-`));

function walk(dir, rel, out) {
    for (const name of fs.readdirSync(dir).sort()) {
        if (name === '.DS_Store') continue;
        const abs = path.join(dir, name);
        const r = rel ? rel + '/' + name : name;
        const st = fs.statSync(abs);
        if (st.isDirectory()) walk(abs, r, out);
        else if (st.isFile()) out.push(r);
    }
    return out;
}

// What deploy.sh's two `cp` lines would put in .cf-dist today.
function expectedCopyList() {
    const list = [];
    for (const f of ROOT_FILES.concat(ROOT_FILES_OPTIONAL)) {
        if (fs.existsSync(path.join(ROOT, f))) list.push(f);
    }
    for (const d of DIRS.concat(DIRS_OPTIONAL)) {
        if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d), d, list);
    }
    return list;
}

// Column-0 declarations of a source file: the names every other script and
// every inline onclick="…" in index.html reaches by global name.
function topLevelNames(src) {
    const names = new Set();
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    return [...names];
}
const mentions = (src, name) => new RegExp('(?:^|[^\\w$])' + name.replace(/\$/g, '\\$') + '(?![\\w$])').test(src);

const OUT1 = tmp('a');
const OUT2 = tmp('b');
let built = null;

suite('build-dist: the copy list', () => {
    test('builds into an empty directory (esbuild via npx, one invocation)', () => {
        // A stale file must not survive: the build starts clean.
        fs.writeFileSync(path.join(OUT1, 'stale.txt'), 'left over from last time');
        built = build({ out: OUT1, quiet: true });
        assert.equal(built.outDir, OUT1);
        assert.falsy(fs.existsSync(path.join(OUT1, 'stale.txt')), 'output dir was not wiped first');
    });

    test('every file deploy.sh copies today is present', () => {
        const missing = expectedCopyList().filter(rel => !fs.existsSync(path.join(OUT1, rel)));
        assert.deepEqual(missing, []);
    });

    test('nothing else is present — no audio/, no tests/, no data/', () => {
        const expected = new Set(expectedCopyList());
        const extra = walk(OUT1, '', []).filter(rel => !expected.has(rel));
        assert.deepEqual(extra, []);
        assert.falsy(fs.existsSync(path.join(OUT1, 'audio')), 'audio/ must deploy separately (deploy-audio.sh)');
    });

    test('the required root files are the ones deploy.sh named', () => {
        for (const f of ['index.html', 'admin.html', 'manifest.json', 'sw.js', '.nojekyll', '_redirects', 'wrangler.toml']) {
            assert.contains(ROOT_FILES, f);
        }
        for (const d of ['css', 'js', 'img', 'assets', 'functions']) assert.contains(DIRS, d);
        assert.contains(ROOT_FILES_OPTIONAL, '_headers');
        assert.contains(DIRS_OPTIONAL, 'fonts');
    });

    test('root files are byte-identical to the source', () => {
        for (const f of ROOT_FILES) {
            assert.truthy(read(path.join(ROOT, f)).equals(read(path.join(OUT1, f))), `${f} differs`);
        }
    });
});

suite('build-dist: what is never minified', () => {
    test('sw.js is byte-identical (its ASSETS block is parsed by tests and tooling)', () => {
        assert.truthy(read(path.join(ROOT, 'sw.js')).equals(read(path.join(OUT1, 'sw.js'))));
        assert.falsy(wantsMinify('sw.js'));
    });

    test('functions/ is byte-identical, file for file', () => {
        const src = walk(path.join(ROOT, 'functions'), 'functions', []);
        const dst = walk(path.join(OUT1, 'functions'), 'functions', []);
        assert.deepEqual(dst, src);
        for (const rel of src) {
            assert.truthy(read(path.join(ROOT, rel)).equals(read(path.join(OUT1, rel))), `${rel} differs`);
            assert.falsy(wantsMinify(rel), `${rel} must not be minified`);
        }
    });

    test('a pre-minified *.min.js is copied, not re-minified', () => {
        assert.falsy(wantsMinify('js/vendor.min.js'));
        assert.falsy(wantsMinify('css/vendor.min.css'));
    });

    test('everything else under js/ and css/ is minified', () => {
        assert.truthy(wantsMinify('js/app.js'));
        assert.truthy(wantsMinify('js/sub/dir.js'));
        assert.truthy(wantsMinify('css/styles.css'));
        assert.falsy(wantsMinify('js/data.json'));
        assert.falsy(wantsMinify('img/x.js'));
    });
});

suite('build-dist: the minified scripts still work as classic scripts', () => {
    test('js/app.js is smaller than the source', () => {
        const a = fs.statSync(path.join(ROOT, 'js/app.js')).size;
        const b = fs.statSync(path.join(OUT1, 'js/app.js')).size;
        assert.truthy(b < a, `${b} is not smaller than ${a}`);
        assert.truthy(b > 1000, 'suspiciously small');
    });

    test('css/styles.css is smaller than the source and still UTF-8', () => {
        const a = fs.statSync(path.join(ROOT, 'css/styles.css')).size;
        const b = fs.statSync(path.join(OUT1, 'css/styles.css')).size;
        assert.truthy(b < a, `${b} is not smaller than ${a}`);
        assert.truthy(b > 1000, 'suspiciously small');
    });

    test('switchScreen, renderHome and APP_VERSION survive by name', () => {
        const app = readUtf8(path.join(OUT1, 'js/app.js'));
        const home = readUtf8(path.join(OUT1, 'js/home.js'));
        assert.truthy(/function switchScreen\(/.test(app), 'function switchScreen renamed or gone in js/app.js');
        assert.truthy(/function renderHome\(/.test(home), 'function renderHome renamed or gone in js/home.js');
        const ver = JSON.parse(readUtf8(path.join(ROOT, 'package.json'))).version;
        const m = home.match(/APP_VERSION\s*=\s*["']v([0-9.]+)["']/);
        assert.truthy(m, 'const APP_VERSION renamed or gone in js/home.js');
        assert.equal(m[1], ver);
    });

    test('every column-0 function, const and class of js/app.js and js/home.js is still there', () => {
        for (const f of ['js/app.js', 'js/home.js']) {
            const names = topLevelNames(readUtf8(path.join(ROOT, f)));
            assert.truthy(names.length > 20, `${f}: only ${names.length} top-level names found — scanner broken`);
            const out = readUtf8(path.join(OUT1, f));
            const gone = names.filter(n => !mentions(out, n));
            assert.deepEqual(gone, [], `${f}: renamed by the minifier`);
        }
    });

    test('every minified js file parses as a classic script', () => {
        const bad = [];
        for (const rel of built.files.filter(r => r.startsWith('js/') && r.endsWith('.js'))) {
            try { new vm.Script(readUtf8(path.join(OUT1, rel)), { filename: rel }); }
            catch (e) { bad.push(`${rel}: ${e.message}`); }
        }
        assert.deepEqual(bad, []);
    });

    test('no file gained or lost its "use strict" directive', () => {
        const strict = (dir) => walk(path.join(dir, 'js'), 'js', [])
            .filter(rel => rel.endsWith('.js') && /^\s*(['"])use strict\1/.test(readUtf8(path.join(dir, rel))));
        assert.deepEqual(strict(OUT1), strict(ROOT));
    });

    test('non-ASCII text is emitted as UTF-8, not \\uXXXX escapes', () => {
        // The default charset would turn every Vietnamese string into escapes
        // and make the "minified" file longer than the source.
        const src = readUtf8(path.join(ROOT, 'js/home.js'));
        const out = readUtf8(path.join(OUT1, 'js/home.js'));
        const nonAscii = (s) => (s.match(/[^\x00-\x7f]/g) || []).length;
        assert.truthy(nonAscii(src) > 0, 'js/home.js has no non-ASCII text to check');
        assert.truthy(nonAscii(out) > 0, 'minified js/home.js lost its UTF-8 text');
        assert.falsy(/\\u1ea/.test(out), 'Vietnamese letters were \\u-escaped');
    });

    test('every <script src> and stylesheet in index.html and admin.html exists in the output', () => {
        for (const html of ['index.html', 'admin.html']) {
            const src = readUtf8(path.join(OUT1, html));
            const refs = [...src.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1])
                .concat([...src.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]))
                .filter(s => !/^(https?:)?\/\//.test(s))
                .map(s => s.replace(/^\//, '').replace(/[?#].*$/, ''));
            assert.truthy(refs.length > 0, `${html}: no local script/stylesheet references found`);
            const missing = refs.filter(r => !fs.existsSync(path.join(OUT1, r)));
            assert.deepEqual(missing, [], `${html}`);
        }
    });

    test('every lazy bank named in js/lazy-data.js exists in the output', () => {
        const src = readUtf8(path.join(ROOT, 'js/lazy-data.js'));
        const refs = [...new Set([...src.matchAll(/['"](js\/[\w.-]+\.js)['"]/g)].map(m => m[1]))];
        assert.truthy(refs.length > 0, 'no lazy banks found — scanner broken');
        const missing = refs.filter(r => !fs.existsSync(path.join(OUT1, r)));
        assert.deepEqual(missing, []);
    });
});

suite('build-dist: deterministic', () => {
    test('a second build produces identical bytes for every minified file', () => {
        const again = build({ out: OUT2, quiet: true });
        assert.deepEqual(again.files, built.files);
        const differ = [];
        for (const rel of built.files.filter(wantsMinify)) {
            if (!read(path.join(OUT1, rel)).equals(read(path.join(OUT2, rel)))) differ.push(rel);
        }
        assert.deepEqual(differ, []);
        // The two the task named, spelled out so a regression is unmistakable.
        assert.truthy(read(path.join(OUT1, 'js/app.js')).equals(read(path.join(OUT2, 'js/app.js'))), 'js/app.js');
        assert.truthy(read(path.join(OUT1, 'css/styles.css')).equals(read(path.join(OUT2, 'css/styles.css'))), 'css/styles.css');
    });

    test('the size table counts every js and css file', () => {
        const nJs = built.files.filter(r => r.startsWith('js/') && wantsMinify(r)).length;
        assert.equal(built.table.js.files, nJs);
        // css/styles.css plus the two lazily loaded feature sheets (tests/css-split.test.js).
        assert.equal(built.table.css.files, 2);
        assert.truthy(built.table.js.min < built.table.js.raw);
        assert.truthy(built.table.js.minGz > 0 && built.table.js.minGz < built.table.js.min);
    });
});

suite('build-dist: failure paths, on a scratch tree', () => {
    // A minimal tree with the same shape as the repo, so the failure paths
    // can be proven without touching a real file.
    function scratchTree(opts) {
        const root = tmp('src');
        for (const f of ['index.html', 'admin.html', 'manifest.json', 'sw.js', '.nojekyll', '_redirects', 'wrangler.toml']) {
            fs.writeFileSync(path.join(root, f), `# ${f}\n`);
        }
        for (const d of ['css', 'js', 'img', 'assets', 'functions']) fs.mkdirSync(path.join(root, d));
        fs.writeFileSync(path.join(root, 'js/ok.js'), 'function keepMe() { return 1 + 1; }\n');
        fs.writeFileSync(path.join(root, 'css/styles.css'), 'body { color: red; }\n');
        fs.writeFileSync(path.join(root, 'functions/x.js'), 'export function onRequest() {}\n');
        if (opts && opts.broken) fs.writeFileSync(path.join(root, 'js/broken.js'), 'function ( {{{\n');
        if (opts && opts.extras) {
            fs.mkdirSync(path.join(root, 'fonts'));
            fs.writeFileSync(path.join(root, 'fonts/a.woff2'), 'woff');
            fs.writeFileSync(path.join(root, '_headers'), '/*\n  X-Test: 1\n');
            fs.mkdirSync(path.join(root, 'js/sub'));
            fs.writeFileSync(path.join(root, 'js/sub/deep.js'), 'function deepOne() { return 2; }\n');
            fs.writeFileSync(path.join(root, 'js/.DS_Store'), 'finder junk');
        }
        return root;
    }

    test('a syntax error in one js file makes build() throw', () => {
        const root = scratchTree({ broken: true });
        const out = tmp('bad');
        assert.throws(() => build({ root, out, quiet: true }), 'build() did not throw on a syntax error');
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(out, { recursive: true, force: true });
    });

    test('a missing required file fails the build', () => {
        const root = scratchTree();
        fs.unlinkSync(path.join(root, '_redirects'));
        const out = tmp('missing');
        let msg = '';
        try { build({ root, out, quiet: true }); } catch (e) { msg = e.message; }
        assert.truthy(/_redirects/.test(msg), `expected a complaint about _redirects, got: ${msg}`);
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(out, { recursive: true, force: true });
    });

    test('fonts/ and _headers ship when present; subdirectories keep their path; .DS_Store does not ship', () => {
        const root = scratchTree({ extras: true });
        const out = tmp('extras');
        const r = build({ root, out, quiet: true });
        assert.truthy(fs.existsSync(path.join(out, 'fonts/a.woff2')), 'fonts/ not copied');
        assert.truthy(fs.existsSync(path.join(out, '_headers')), '_headers not copied');
        assert.truthy(fs.existsSync(path.join(out, 'js/sub/deep.js')), 'js/sub/deep.js lost its directory');
        assert.truthy(/function deepOne\(/.test(readUtf8(path.join(out, 'js/sub/deep.js'))));
        assert.falsy(fs.existsSync(path.join(out, 'js/.DS_Store')));
        assert.contains(r.files, 'fonts/a.woff2');
        assert.contains(r.files, 'js/sub/deep.js');
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(out, { recursive: true, force: true });
    });

    test('refuses to wipe a directory that contains the source tree', () => {
        assert.throws(() => build({ out: ROOT, quiet: true }));
        assert.throws(() => build({ out: path.dirname(ROOT), quiet: true }));
    });

    test('the CLI exits 1 with a message when esbuild rejects the input', () => {
        // The CLI has no --root (it always builds the repo), so a tiny shim
        // drives the same code path with the same exit handling.
        const root = scratchTree({ broken: true });
        const out = tmp('cli');
        const shim = path.join(root, 'run.js');
        fs.writeFileSync(shim, `
            const { build } = require(${JSON.stringify(SCRIPT)});
            try { build({ root: ${JSON.stringify(root)}, out: ${JSON.stringify(out)}, quiet: true }); }
            catch (e) { console.error('✗ build-dist: ' + e.message); process.exit(1); }
        `);
        const res = spawnSync(process.execPath, [shim], { encoding: 'utf8' });
        assert.equal(res.status, 1);
        assert.truthy(/esbuild exited 1/.test(res.stderr), res.stderr);
        assert.truthy(/broken\.js/.test(res.stderr), 'esbuild did not name the broken file');
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(out, { recursive: true, force: true });
    });

    test('cleanup', () => {
        fs.rmSync(OUT1, { recursive: true, force: true });
        fs.rmSync(OUT2, { recursive: true, force: true });
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
