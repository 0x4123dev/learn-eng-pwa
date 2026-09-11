#!/usr/bin/env node
// build-sw-manifest.js — rewrite the hash values of the PRECACHE block in sw.js
// so each one is the first 16 hex chars of the SHA-256 of the file's bytes on
// disk. The URL list itself is maintained by hand; this script never adds,
// removes or reorders keys, and it touches nothing outside the hash strings
// (comments, quoting and key order all survive byte-for-byte).
//
//   node scripts/build-sw-manifest.js [--root <dir>] [--sw <file>] [--check]
//
//   --root   directory the URLs resolve against (default: the repo root)
//   --sw     the service worker to read/rewrite (default: <root>/sw.js)
//   --check  write nothing; exit 1 listing the stale keys if any hash differs
//            from the tree, exit 0 otherwise
//
// Exit 2 (without writing) when any key has no file under --root.
//
// URL → file: '/' and '/index.html' both hash index.html; any other '/a/b.c'
// is the file a/b.c. scripts/deploy.sh runs this after the version bump so
// the release commit carries the manifest that matches the shipped bytes, and
// uses --check on --no-bump. See
// docs/superpowers/specs/2026-09-11-sw-precache-manifest-design.md.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASH_LEN = 16;

// First 16 hex chars of SHA-256 over the file's bytes.
function hashFile(filePath) {
    const bytes = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, HASH_LEN);
}

// Which file under `root` a precache URL names.
function fileForKey(key, root) {
    const rel = (key === '/' || key === '/index.html') ? 'index.html' : key.replace(/^\//, '');
    return path.join(root, rel);
}

// Locate the PRECACHE block in the worker source and every 'key': 'hash'
// entry in it. Each entry records where its hash string's contents sit so
// the rewrite can splice exactly those characters and nothing else.
function readManifest(src) {
    const open = src.match(/const PRECACHE\s*=\s*\{/);
    if (!open) throw new Error('sw.js: no `const PRECACHE = {` block found');
    const bodyStart = open.index + open[0].length;
    const close = src.indexOf('};', bodyStart);
    if (close < 0) throw new Error('sw.js: PRECACHE block is not closed with `};`');
    const body = src.slice(bodyStart, close);

    const entries = [];
    const re = /(['"])(\/[^'"]*)\1\s*:\s*(['"])([^'"]*)\3/g;
    let m;
    while ((m = re.exec(body))) {
        const hashStart = bodyStart + m.index + m[0].length - m[4].length - 1;
        entries.push({
            key: m[2],
            hash: m[4],
            hashStart,
            hashEnd: hashStart + m[4].length
        });
    }
    if (!entries.length) throw new Error('sw.js: PRECACHE block has no entries');
    return { blockStart: open.index, blockEnd: close + 2, entries };
}

// Compute the tree's hashes for one worker file. Returns
//   { entries: [{ key, hash, fresh, file }], missing: [key], stale: [key], src, out }
// where `out` is the rewritten source (identical to `src` when nothing is
// stale). Writes `out` back to `sw` unless opts.check is set or a file is
// missing.
function build(opts = {}) {
    const root = path.resolve(opts.root || path.join(__dirname, '..'));
    const sw = path.resolve(opts.sw || path.join(root, 'sw.js'));
    const src = fs.readFileSync(sw, 'utf8');
    const manifest = readManifest(src);

    const missing = [];
    const stale = [];
    const entries = [];
    for (const e of manifest.entries) {
        const file = fileForKey(e.key, root);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            missing.push(e.key);
            entries.push({ key: e.key, hash: e.hash, fresh: null, file });
            continue;
        }
        const fresh = hashFile(file);
        if (fresh !== e.hash) stale.push(e.key);
        entries.push({ key: e.key, hash: e.hash, fresh, file, hashStart: e.hashStart, hashEnd: e.hashEnd });
    }

    // Splice the new hashes in from the end so earlier offsets stay valid.
    // Every hash is exactly HASH_LEN chars so offsets would not drift anyway,
    // but a hand-edited placeholder of another length must still be handled.
    let out = src;
    if (!missing.length) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const e = entries[i];
            if (e.fresh === e.hash) continue;
            out = out.slice(0, e.hashStart) + e.fresh + out.slice(e.hashEnd);
        }
    }

    const written = !opts.check && !missing.length && out !== src;
    if (written) fs.writeFileSync(sw, out);

    return { root, sw, entries, missing, stale, src, out, written };
}

function parseArgs(argv) {
    const opts = { check: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') opts.check = true;
        else if (a === '--root') opts.root = argv[++i];
        else if (a === '--sw') opts.sw = argv[++i];
        else if (a === '--help' || a === '-h') { opts.help = true; }
        else throw new Error(`unknown argument: ${a}`);
    }
    if ((opts.root !== undefined && !opts.root) || (opts.sw !== undefined && !opts.sw)) {
        throw new Error('--root and --sw each need a value');
    }
    return opts;
}

function main(argv) {
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (e) {
        console.error(`build-sw-manifest: ${e.message}`);
        return 2;
    }
    if (opts.help) {
        console.log('usage: node scripts/build-sw-manifest.js [--root <dir>] [--sw <file>] [--check]');
        return 0;
    }

    let result;
    try {
        result = build(opts);
    } catch (e) {
        console.error(`build-sw-manifest: ${e.message}`);
        return 2;
    }

    const rel = p => path.relative(process.cwd(), p) || p;
    if (result.missing.length) {
        console.error(`build-sw-manifest: ${result.missing.length} PRECACHE key(s) in ${rel(result.sw)} have no file under ${rel(result.root)}:`);
        for (const k of result.missing) console.error(`  ${k}`);
        console.error('Remove the entry from sw.js or restore the file; nothing was written.');
        return 2;
    }

    const n = result.entries.length;
    const m = result.stale.length;
    if (opts.check) {
        if (m) {
            console.error(`build-sw-manifest --check: ${m} of ${n} hash(es) in ${rel(result.sw)} are stale:`);
            for (const k of result.stale) console.error(`  ${k}`);
            console.error('Run `node scripts/build-sw-manifest.js` to rewrite them.');
            return 1;
        }
        console.log(`build-sw-manifest --check: ${n} entries, 0 changed — manifest matches the tree`);
        return 0;
    }

    console.log(`build-sw-manifest: ${n} entries, ${m} changed${m ? ` — wrote ${rel(result.sw)}` : ' — nothing to write'}`);
    return 0;
}

if (require.main === module) {
    process.exit(main(process.argv.slice(2)));
}

module.exports = { hashFile, readManifest, build, fileForKey, HASH_LEN };
