// version-sync.test.js — the four places a version lives must agree.
// They are bumped together by scripts/deploy.sh; this fails loudly if one is
// edited by hand and the others are forgotten, which would make the live
// check in deploy.sh either lie or hang.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const pkg = JSON.parse(read('package.json')).version;
const home = (read('js/home.js').match(/const APP_VERSION = 'v([0-9.]+)'/) || [])[1];
const api = (read('functions/api/version.js').match(/const VERSION = '([0-9.]+)'/) || [])[1];
const cache = (read('sw.js').match(/flashlingo-v(\d+)/) || [])[1];

suite('version markers stay in sync', () => {
    test('package.json has a semver version', () => {
        assert.truthy(/^\d+\.\d+\.\d+$/.test(pkg), `bad version: ${pkg}`);
    });

    test('js/home.js APP_VERSION matches package.json', () => {
        assert.equal(home, pkg);
    });

    // Assets and Functions propagate independently, so the deploy verifies
    // both. That only works if the API reports the same number.
    test('functions/api/version.js matches package.json', () => {
        assert.equal(api, pkg);
    });

    test('sw.js cache name is a bumped integer', () => {
        assert.truthy(cache && Number(cache) > 0, `bad cache name: flashlingo-v${cache}`);
    });
});

suite('the deploy script keeps them that way', () => {
    const sh = read('scripts/deploy.sh');

    test('bumps all four markers', () => {
        for (const f of ['js/home.js', 'sw.js', 'package.json', 'functions/api/version.js']) {
            assert.truthy(sh.includes(f), `deploy.sh must bump ${f}`);
        }
    });

    test('aborts the deploy when the suite is red', () => {
        assert.truthy(sh.includes('nothing deployed'), 'a red suite must never ship');
    });

    test('verifies the API version, not just the assets', () => {
        assert.truthy(sh.includes('/api/version'), 'assets alone are not proof the API updated');
    });

    test('the live check forces a revalidation with a header', () => {
        // It used to append `?cb=$RANDOM`, which cannot bust anything: Pages
        // keys its cache on the path alone. A check of a freshly deployed file
        // once read the previous build and called the change missing when the
        // deploy had worked — cause unproven between an edge cache and plain
        // propagation lag, but the header rules the first one out for free.
        assert.truthy(/Cache-Control: no-cache/.test(sh),
            'the live check must send a no-cache request header');
        // Comments are stripped first: this file explains the old `?cb=` trick,
        // and matching prose instead of code would fail on its own footnote.
        const code = sh.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
        assert.falsy(/\?cb=/.test(code),
            'a ?cb= query string is decoration on Pages — it never busts the edge cache');
    });

    test('the check reads both the assets and the API through that header', () => {
        // Either one fetched normally could be served stale and make the
        // "live" line a guess.
        const block = sh.slice(sh.indexOf('confirming $LIVE'));
        for (const url of ['/js/home.js', '/api/version']) {
            const i = block.indexOf(url);
            assert.truthy(i > 0, `${url} is not checked`);
            const line = block.slice(block.lastIndexOf('curl', i), i);
            assert.truthy(/NOCACHE/.test(line), `${url} is fetched without the no-cache header`);
        }
    });

    test('it proves the changed files by CONTENT, not by version number', () => {
        // js/home.js carries APP_VERSION, so it looks new the instant the
        // deploy lands — while the file you actually changed can still be the
        // previous copy. A version match says the deploy arrived, not that
        // every file in it did.
        assert.truthy(/md5/.test(sh), 'the check must compare file content');
        assert.truthy(/\.cf-dist\/\$f/.test(sh), 'compared against what was built, not the source tree');
        assert.truthy(/CHANGED=/.test(sh), 'the files this deploy touched must be probed');
        assert.truthy(/git diff --name-only HEAD~1 HEAD/.test(sh));
    });

    test('the changed-file probe only trusts a commit made by THIS run', () => {
        // With --no-bump there is no new commit, so HEAD~1 describes someone
        // else's work and would name the wrong deploy's files.
        assert.truthy(/COMMITTED=1/.test(sh), 'the script must record whether it committed');
        assert.truthy(/if \[ "\$COMMITTED" = "1" \]/.test(sh),
            'the changed-file list must be gated on that');
    });

    test('three files are proven on every deploy, changed or not', () => {
        // The shell, the service worker (a stale one serves the whole app from
        // an old cache) and the largest script, which is likeliest to lag.
        const probes = sh.slice(sh.indexOf('EXTRA_PROBES='), sh.indexOf('assets=""'));
        for (const f of ['index.html', 'sw.js', '$BIGGEST']) {
            assert.truthy(probes.includes(f), `${f} must be probed on every deploy`);
        }
        assert.truthy(/ls -S js\/\*\.js/.test(sh), 'the largest script must be found by size');
    });

    test('the probes follow redirects', () => {
        // Pages 308-redirects /index.html to /. Without -L curl returns an
        // empty body, which hashes to something else — and the very first run
        // of this check failed a perfectly good deploy for exactly that.
        const block = sh.slice(sh.indexOf('confirming $LIVE'));
        const fetches = [...block.matchAll(/curl -(s\w*)/g)].map(m => m[1]);
        assert.truthy(fetches.length >= 3, 'expected at least three probes');
        for (const f of fetches) {
            assert.truthy(f.includes('L'), `a probe uses curl -${f} — it must follow redirects`);
        }
    });

    test('a stale file fails the deploy instead of passing quietly', () => {
        assert.truthy(/still serving an older copy of/.test(sh), 'it must say which file');
        assert.truthy(/stale=""/.test(sh) && /stale="\$stale \$f"/.test(sh),
            'mismatches must be collected, not ignored');
        const tail = sh.slice(sh.indexOf('if [ -z "$stale" ]'));
        assert.truthy(/exit 1/.test(tail), 'a stale file must fail the run');
    });

    test('the byte check runs only once the versions already agree', () => {
        // Hashing every probe on each of 30 polls would hammer the edge for no
        // reason; the version markers are the cheap gate in front of it.
        const gate = sh.indexOf('if [ "$assets" = "$NEWVER" ] && [ "$apiv" = "$NEWVER" ]');
        const hash = sh.indexOf('want=$(md5');
        assert.truthy(gate > 0 && hash > gate, 'content hashing must sit inside the version gate');
    });

    test('never pushes to GitHub', () => {
        assert.falsy(/git\s+push/.test(sh), 'pushing to GitHub is permission-gated');
    });

    test('reads the token from outside the repo', () => {
        assert.truthy(sh.includes('.config/eng-pwa/cloudflare.env'));
        assert.falsy(/CLOUDFLARE_API_TOKEN=[A-Za-z0-9_-]{20,}/.test(sh), 'no token may be hard-coded');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
