// sw-manifest.test.js — the PRECACHE block in sw.js and the script that fills
// its hashes, scripts/build-sw-manifest.js.
//
// sw.js in the repo carries placeholder hashes; scripts/deploy.sh runs the
// builder at release time so the shipped worker matches the shipped bytes.
// These tests therefore never build INTO sw.js: they build into a temp copy
// and compare. What they prove:
//   • every PRECACHE key names a file that exists (a stale key would make the
//     install fail that entry on every device, forever);
//   • ASSETS is derived from PRECACHE, not a second hand-maintained list;
//   • the builder fills a 16-hex hash for every key, --check then agrees;
//   • --check catches a one-byte change and names exactly that key;
//   • a key with no file exits 2 and writes nothing;
//   • the rewrite changes nothing outside the hash strings.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const SCRIPT = path.join(root, 'scripts', 'build-sw-manifest.js');
const SW = path.join(root, 'sw.js');
const swSrc = fs.readFileSync(SW, 'utf8');

const { hashFile, readManifest, build, fileForKey } = require(SCRIPT);
const manifest = readManifest(swSrc);
const keys = manifest.entries.map(e => e.key);

const HEX16 = /^[0-9a-f]{16}$/;
const PLACEHOLDER = '0000000000000000';

// sw.js with every hash reset to the placeholder. On a working branch that is
// sw.js itself; on a release commit deploy.sh has filled the hashes in, and
// the build tests below must still start from a known state.
function zeroed(src) {
    const m = readManifest(src);
    let out = src;
    for (let i = m.entries.length - 1; i >= 0; i--) {
        const e = m.entries[i];
        out = out.slice(0, e.hashStart) + PLACEHOLDER + out.slice(e.hashEnd);
    }
    return out;
}
const zeroSrc = zeroed(swSrc);

function tmpDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `sw-manifest-${label}-`));
}

// Run the CLI; returns { status, stdout, stderr } without throwing.
function run(args) {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// A tiny fake tree: a worker whose PRECACHE names three files, plus a comment
// inside the block and mixed quoting, so the byte-preservation test has
// something to protect.
function makeFakeTree() {
    const dir = tmpDir('tree');
    fs.mkdirSync(path.join(dir, 'js'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
    fs.writeFileSync(path.join(dir, 'js', 'app.js'), 'console.log("app")');
    fs.writeFileSync(path.join(dir, 'js', 'bank.js'), 'window.BANK = [1, 2, 3]');
    const sw = path.join(dir, 'sw.js');
    fs.writeFileSync(sw, [
        "const CACHE_NAME = 'flashlingo-v1';",
        '// GENERATED HASHES — see scripts/build-sw-manifest.js',
        'const PRECACHE = {',
        "  '/': '0000000000000000',",
        "  '/index.html': '0000000000000000', // the shell",
        "  '/js/app.js':   '0000000000000000',",
        '  // a lazy bank',
        '  "/js/bank.js": "0000000000000000"',
        '};',
        'const ASSETS = Object.keys(PRECACHE);',
        ''
    ].join('\n'));
    return { dir, sw };
}

suite('sw.js PRECACHE block', () => {
    test('has a PRECACHE block with a substantial number of entries', () => {
        assert.truthy(keys.length > 50, `only ${keys.length} PRECACHE entries — block looks truncated`);
    });

    test('every PRECACHE key maps to an existing file', () => {
        const missing = keys.filter(k => {
            const f = fileForKey(k, root);
            return !fs.existsSync(f) || !fs.statSync(f).isFile();
        });
        assert.deepEqual(missing, [], 'PRECACHE keys with no file: ' + missing.join(', '));
    });

    test('/ and /index.html both resolve to index.html', () => {
        assert.equal(fileForKey('/', root), path.join(root, 'index.html'));
        assert.equal(fileForKey('/index.html', root), path.join(root, 'index.html'));
        assert.equal(fileForKey('/js/app.js', root), path.join(root, 'js', 'app.js'));
    });

    test('keys are unique, root-relative URLs', () => {
        const seen = new Set();
        const dupes = keys.filter(k => seen.has(k) || (seen.add(k), false));
        assert.deepEqual(dupes, [], 'duplicate keys: ' + dupes.join(', '));
        const bad = keys.filter(k => !k.startsWith('/'));
        assert.deepEqual(bad, [], 'keys without a leading /: ' + bad.join(', '));
    });

    test('ASSETS is derived from PRECACHE, not a second array literal', () => {
        assert.truthy(/const ASSETS = Object\.keys\(PRECACHE\);/.test(swSrc),
            'sw.js must declare `const ASSETS = Object.keys(PRECACHE);`');
        assert.falsy(/const ASSETS\s*=\s*\[/.test(swSrc),
            'sw.js still has a hand-maintained `const ASSETS = [...]` array');
        assert.equal((swSrc.match(/const ASSETS\b/g) || []).length, 1, 'ASSETS declared more than once');
    });

    test('every hash is the placeholder or a built 16-hex value', () => {
        // A working branch carries '0000000000000000'; a release commit
        // carries what scripts/deploy.sh built. Anything else is a hand edit.
        const bad = manifest.entries.filter(e => e.hash !== PLACEHOLDER && !HEX16.test(e.hash));
        assert.deepEqual(bad.map(e => `${e.key}=${e.hash}`), [], 'malformed hashes');
    });
});

suite('build-sw-manifest.js against the real tree (temp copy of sw.js)', () => {
    const dir = tmpDir('real');
    const copy = path.join(dir, 'sw.js');
    fs.writeFileSync(copy, zeroSrc);

    test('hashFile returns the first 16 hex chars of SHA-256', () => {
        const f = path.join(dir, 'empty');
        fs.writeFileSync(f, '');
        // SHA-256 of the empty string starts e3b0c44298fc1c14.
        assert.equal(hashFile(f), 'e3b0c44298fc1c14');
        fs.writeFileSync(f, 'abc');
        assert.equal(hashFile(f), 'ba7816bf8f01cfea');
    });

    test('build fills a 16-hex hash for every key and reports every one changed', () => {
        const r = build({ root, sw: copy });
        assert.equal(r.written, true, 'expected the copy to be written');
        assert.equal(r.missing.length, 0, 'missing: ' + r.missing.join(', '));
        assert.equal(r.stale.length, keys.length, 'every placeholder should count as stale');
        const built = readManifest(fs.readFileSync(copy, 'utf8'));
        assert.deepEqual(built.entries.map(e => e.key), keys, 'key order changed');
        const bad = built.entries.filter(e => !HEX16.test(e.hash)).map(e => e.key);
        assert.deepEqual(bad, [], 'keys without a 16-hex hash: ' + bad.join(', '));
        for (const e of built.entries) {
            assert.equal(e.hash, hashFile(fileForKey(e.key, root)), `hash for ${e.key}`);
        }
        // '/' and '/index.html' hash the same file, so they must agree.
        const byKey = Object.fromEntries(built.entries.map(e => [e.key, e.hash]));
        assert.equal(byKey['/'], byKey['/index.html']);
    });

    test('--check on the freshly built copy passes and prints the summary', () => {
        const r = run(['--sw', copy, '--root', root, '--check']);
        assert.equal(r.status, 0, r.stderr);
        assert.truthy(new RegExp(`${keys.length} entries, 0 changed`).test(r.stdout), r.stdout);
    });

    test('a second build is a no-op (nothing to write)', () => {
        const before = fs.readFileSync(copy, 'utf8');
        const r = build({ root, sw: copy });
        assert.equal(r.written, false);
        assert.equal(r.stale.length, 0);
        assert.equal(fs.readFileSync(copy, 'utf8'), before);
    });

    test('the rewrite touches only lines inside the PRECACHE block, and only their hashes', () => {
        const a = zeroSrc.split('\n');
        const b = fs.readFileSync(copy, 'utf8').split('\n');
        assert.equal(b.length, a.length, 'line count changed');
        const changedLines = [];
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changedLines.push(i);
        assert.equal(changedLines.length, keys.length, `expected ${keys.length} changed lines, got ${changedLines.length}`);
        // Every changed line lies inside the block…
        const blockFirst = zeroSrc.slice(0, manifest.blockStart).split('\n').length - 1;
        const blockLast = zeroSrc.slice(0, manifest.blockEnd).split('\n').length - 1;
        const outside = changedLines.filter(i => i <= blockFirst || i >= blockLast);
        assert.deepEqual(outside, [], 'lines changed outside the PRECACHE block: ' + outside.map(i => i + 1).join(', '));
        // …and differs from the original only by the 16 hash characters.
        for (const i of changedLines) {
            const swapped = a[i].replace(`'${PLACEHOLDER}'`, () => `'${(b[i].match(/'([0-9a-f]{16})'\s*,?\s*$/) || [])[1]}'`);
            assert.equal(b[i], swapped, `line ${i + 1} changed beyond its hash`);
        }
        // The prose, the CACHE_NAME and everything after the block are intact.
        assert.equal(fs.readFileSync(copy, 'utf8').slice(manifest.blockEnd), zeroSrc.slice(manifest.blockEnd));
        assert.equal(fs.readFileSync(copy, 'utf8').slice(0, manifest.blockStart), zeroSrc.slice(0, manifest.blockStart));
    });

    test('the real sw.js was not modified by any of this', () => {
        assert.equal(fs.readFileSync(SW, 'utf8'), swSrc);
    });
});

suite('build-sw-manifest.js on a fake tree', () => {
    test('a one-byte change makes --check fail naming exactly that key', () => {
        const { dir, sw } = makeFakeTree();
        let r = run(['--root', dir, '--sw', sw]);
        assert.equal(r.status, 0, r.stderr);
        assert.truthy(/4 entries, 4 changed/.test(r.stdout), r.stdout);
        r = run(['--root', dir, '--sw', sw, '--check']);
        assert.equal(r.status, 0, r.stderr);

        const before = fs.readFileSync(sw, 'utf8');
        fs.appendFileSync(path.join(dir, 'js', 'bank.js'), ' ');
        r = run(['--root', dir, '--sw', sw, '--check']);
        assert.equal(r.status, 1, 'expected exit 1 for a stale hash');
        const named = r.stderr.split('\n').filter(l => /^\s+\//.test(l)).map(l => l.trim());
        assert.deepEqual(named, ['/js/bank.js'], r.stderr);
        assert.truthy(/1 of 4 hash\(es\)/.test(r.stderr), r.stderr);
        assert.equal(fs.readFileSync(sw, 'utf8'), before, '--check must not write');

        // Changing index.html flags BOTH keys that hash it.
        fs.appendFileSync(path.join(dir, 'index.html'), '!');
        r = run(['--root', dir, '--sw', sw, '--check']);
        assert.equal(r.status, 1);
        const named2 = r.stderr.split('\n').filter(l => /^\s+\//.test(l)).map(l => l.trim());
        assert.deepEqual(named2, ['/', '/index.html', '/js/bank.js'], r.stderr);
    });

    test('a key with no file exits 2, names it, and writes nothing', () => {
        const { dir, sw } = makeFakeTree();
        fs.unlinkSync(path.join(dir, 'js', 'app.js'));
        const before = fs.readFileSync(sw, 'utf8');
        let r = run(['--root', dir, '--sw', sw]);
        assert.equal(r.status, 2, `exit ${r.status}: ${r.stderr}`);
        assert.truthy(r.stderr.includes('/js/app.js'), r.stderr);
        assert.falsy(r.stderr.includes('/js/bank.js'), 'must list only the missing keys');
        assert.equal(fs.readFileSync(sw, 'utf8'), before, 'nothing may be written when a file is missing');
        // --check reports the same failure the same way.
        r = run(['--root', dir, '--sw', sw, '--check']);
        assert.equal(r.status, 2);
        assert.equal(fs.readFileSync(sw, 'utf8'), before);
    });

    test('rewrites preserve comments inside the block, mixed quoting and spacing', () => {
        const { dir, sw } = makeFakeTree();
        const before = fs.readFileSync(sw, 'utf8');
        execFileSync(process.execPath, [SCRIPT, '--root', dir, '--sw', sw]);
        const after = fs.readFileSync(sw, 'utf8');
        const h = k => hashFile(fileForKey(k, dir));
        const expected = before
            .replace("'/': '0000000000000000'", `'/': '${h('/')}'`)
            .replace("'/index.html': '0000000000000000'", `'/index.html': '${h('/index.html')}'`)
            .replace("'/js/app.js':   '0000000000000000'", `'/js/app.js':   '${h('/js/app.js')}'`)
            .replace('"/js/bank.js": "0000000000000000"', `"/js/bank.js": "${h('/js/bank.js')}"`);
        assert.equal(after, expected);
        assert.truthy(after.includes('  // a lazy bank\n'), 'comment inside the block was lost');
        assert.truthy(after.includes(", // the shell\n"), 'trailing comment was lost');
    });

    test('a worker without a PRECACHE block is an error, not a silent no-op', () => {
        const dir = tmpDir('noblock');
        const sw = path.join(dir, 'sw.js');
        fs.writeFileSync(sw, "const ASSETS = ['/'];\n");
        const r = run(['--root', dir, '--sw', sw, '--check']);
        assert.equal(r.status, 2);
        assert.truthy(/PRECACHE/.test(r.stderr), r.stderr);
        assert.throws(() => readManifest("const ASSETS = ['/'];"));
    });

    test('an unknown flag is refused', () => {
        const r = run(['--bogus']);
        assert.equal(r.status, 2);
        assert.truthy(/unknown argument/.test(r.stderr), r.stderr);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
