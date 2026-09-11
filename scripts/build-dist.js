#!/usr/bin/env node
// scripts/build-dist.js — build the .cf-dist that deploy.sh ships, minified.
//
//   node scripts/build-dist.js              → ./.cf-dist
//   node scripts/build-dist.js --out DIR    → DIR (wiped first)
//
// It produces EXACTLY the tree deploy.sh used to assemble with `cp`:
//
//   index.html admin.html manifest.json sw.js .nojekyll _redirects   (root)
//   css/ js/ img/ assets/ functions/ wrangler.toml                   (dirs)
//   fonts/ _headers                                   (only if they exist)
//
// with every js/**/*.js and css/**/*.css run through esbuild --minify.
// audio/ is deliberately absent: the ~13,000 word MP3s deploy separately
// (scripts/deploy-audio.sh) so they can never push this deployment over
// Cloudflare's 20,000-file limit.
//
// What is NOT minified, and why:
//   sw.js          its ASSETS/PRECACHE block is parsed by tests and tooling
//   functions/     Cloudflare Pages Functions, deployed as written
//   *.min.js/css   js/phaser.min.js is already minified; copy it
//
// How the minifier is held on a leash — this is a vanilla-JS PWA whose
// scripts are classic <script> tags sharing ONE global scope, and index.html
// inlines `onclick="switchScreen(...)"` seventeen times:
//   no --bundle        each file stays a separate script; nothing is merged
//   top-level names    esbuild never renames top-level symbols when it is
//                      not bundling (they may be referenced from other
//                      files), so `function renderHome` survives by name —
//                      tests/build-dist.test.js checks every column-0
//                      function and const of js/app.js and js/home.js
//   --target=es2018    the level the app is written for; nothing newer is
//                      lowered in a way that changes behaviour, and esbuild
//                      refuses (exit 1) rather than silently mis-lowering
//   --charset=utf8     the default escapes every non-ASCII character as
//                      \uXXXX, which would make the Vietnamese strings in
//                      every screen LONGER than the source; both HTML shells
//                      declare <meta charset="UTF-8">
//   'use strict'       a directive prologue is kept where it was
//
// Deterministic: the same input bytes always produce the same output bytes
// (esbuild is deterministic for a fixed version and flag set, and the copy
// is a copy). The service-worker manifest hashes the dist files, so this is
// load-bearing — the test builds twice and compares.
//
// esbuild is run as a child process through npx, pinned to one version, so
// there is no node_modules and no package.json dependency to keep in step.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const ESBUILD_PKG = 'esbuild@0.28.2';
const ESBUILD_FLAGS = ['--minify', '--target=es2018', '--charset=utf8', '--log-level=warning'];

// The copy list. Mirrors what deploy.sh's two `cp` lines shipped; a required
// entry that is missing is a broken checkout and fails the build, an optional
// one is simply absent from the output.
const ROOT_FILES = ['index.html', 'admin.html', 'manifest.json', 'sw.js', '.nojekyll', '_redirects', 'wrangler.toml'];
const ROOT_FILES_OPTIONAL = ['_headers'];
const DIRS = ['css', 'js', 'img', 'assets', 'functions'];
const DIRS_OPTIONAL = ['fonts'];

// Which files inside the copied directories go through esbuild.
function wantsMinify(rel) {
    const top = rel.split('/')[0];
    if (top === 'js' && rel.endsWith('.js') && !rel.endsWith('.min.js')) return true;
    if (top === 'css' && rel.endsWith('.css') && !rel.endsWith('.min.css')) return true;
    return false;
}

// Finder-only junk. deploy.sh's `cp -R` shipped these too, but nothing ever
// asked for one and each is a wasted slot under the Pages file cap.
const SKIP_NAMES = new Set(['.DS_Store']);

function walk(dir, rel, out) {
    for (const name of fs.readdirSync(dir).sort()) {
        if (SKIP_NAMES.has(name)) continue;
        const abs = path.join(dir, name);
        const r = rel ? rel + '/' + name : name;
        const st = fs.statSync(abs);
        if (st.isDirectory()) walk(abs, r, out);
        else if (st.isFile()) out.push(r);
    }
    return out;
}

function copyFile(root, rel, outDir) {
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
}

function fmt(n) {
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    return (n / 1024).toFixed(1) + ' kB';
}

function gzipSize(buf) {
    return zlib.gzipSync(buf).length;
}

/**
 * Build the dist tree. Returns { outDir, files, table } and throws on any
 * failure (a missing required input, an esbuild error, a minified file that
 * did not appear). The CLI wrapper below turns a throw into exit 1.
 *
 *   opts.out    output directory (default <repo>/.cf-dist), wiped first
 *   opts.root   source tree (default the repo); the test points this at a
 *               scratch tree to prove the failure paths
 *   opts.quiet  no size table; esbuild's own output is folded into the
 *               thrown error instead of being printed
 */
function build(opts) {
    opts = opts || {};
    const ROOT = path.resolve(opts.root || REPO);
    const outDir = path.resolve(opts.out || path.join(ROOT, '.cf-dist'));
    const log = opts.quiet ? () => {} : (s) => process.stdout.write(s + '\n');

    // `rm -rf` on the wrong path is not a mistake you get to make twice.
    if (outDir === ROOT || ROOT.startsWith(outDir + path.sep) || outDir === path.parse(outDir).root) {
        throw new Error(`refusing to wipe ${outDir}: it contains the source tree`);
    }

    // 1. Start clean.
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    // 2. The copy list.
    const copied = [];
    for (const f of ROOT_FILES) {
        if (!fs.existsSync(path.join(ROOT, f))) throw new Error(`required file missing: ${f}`);
        copyFile(ROOT, f, outDir); copied.push(f);
    }
    for (const f of ROOT_FILES_OPTIONAL) {
        if (fs.existsSync(path.join(ROOT, f))) { copyFile(ROOT, f, outDir); copied.push(f); }
    }
    const toMinify = [];
    const dirs = DIRS.concat(DIRS_OPTIONAL.filter(d => fs.existsSync(path.join(ROOT, d))));
    for (const d of DIRS) {
        if (!fs.existsSync(path.join(ROOT, d))) throw new Error(`required directory missing: ${d}/`);
    }
    for (const d of dirs) {
        for (const rel of walk(path.join(ROOT, d), d, [])) {
            if (wantsMinify(rel)) toMinify.push(rel);
            else { copyFile(ROOT, rel, outDir); copied.push(rel); }
        }
    }

    // 3. One esbuild invocation for every js and css file. Relative paths
    //    with --outbase=. make esbuild mirror them under --outdir, so
    //    js/foo/bar.js lands at <out>/js/foo/bar.js. No --bundle.
    if (toMinify.length) {
        const args = ['--yes', ESBUILD_PKG].concat(ESBUILD_FLAGS, ['--outbase=.', '--outdir=' + outDir], toMinify);
        const res = spawnSync('npx', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        if (res.error) throw new Error(`could not run esbuild: ${res.error.message}`);
        const said = (res.stderr || '').trim();
        if (said && !opts.quiet) process.stderr.write(res.stderr);
        if (res.status !== 0) throw new Error(`esbuild exited ${res.status}` + (opts.quiet && said ? '\n' + said : ''));
        for (const rel of toMinify) {
            if (!fs.existsSync(path.join(outDir, rel))) throw new Error(`esbuild produced no output for ${rel}`);
        }
    }

    // 4. Size table: raw → minified, and what the wire sees.
    const table = {};
    for (const kind of ['js', 'css']) {
        const t = { files: 0, raw: 0, min: 0, rawGz: 0, minGz: 0 };
        for (const rel of toMinify) {
            if (rel.split('/')[0] !== kind) continue;
            const a = fs.readFileSync(path.join(ROOT, rel));
            const b = fs.readFileSync(path.join(outDir, rel));
            t.files++; t.raw += a.length; t.min += b.length;
            t.rawGz += gzipSize(a); t.minGz += gzipSize(b);
        }
        table[kind] = t;
    }
    const pct = (a, b) => a ? `-${Math.round((1 - b / a) * 100)}%` : '';
    const shown = path.relative(process.cwd(), outDir);
    log(`▸ ${shown && !shown.startsWith('..') ? shown : outDir}: ${copied.length} copied, ${toMinify.length} minified`);
    log('  kind  files        raw →  minified            gzip raw →  gzip min');
    for (const kind of ['js', 'css']) {
        const t = table[kind];
        log(`  ${kind.padEnd(5)} ${String(t.files).padStart(5)} ${fmt(t.raw).padStart(10)} → ${fmt(t.min).padStart(9)} (${pct(t.raw, t.min)})` +
            `   ${fmt(t.rawGz).padStart(10)} → ${fmt(t.minGz).padStart(9)} (${pct(t.rawGz, t.minGz)})`);
    }

    return { outDir, files: copied.concat(toMinify).sort(), table };
}

module.exports = { build, ROOT_FILES, ROOT_FILES_OPTIONAL, DIRS, DIRS_OPTIONAL, wantsMinify };

if (require.main === module) {
    const argv = process.argv.slice(2);
    let out = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--out' && argv[i + 1]) { out = argv[++i]; continue; }
        if (argv[i].startsWith('--out=')) { out = argv[i].slice(6); continue; }
        console.error(`unknown option: ${argv[i]}\nusage: node scripts/build-dist.js [--out DIR]`);
        process.exit(2);
    }
    try {
        build({ out });
    } catch (e) {
        console.error(`✗ build-dist: ${e.message}`);
        process.exit(1);
    }
}
