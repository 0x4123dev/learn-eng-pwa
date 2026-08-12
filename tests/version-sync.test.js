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
    process.exit(harness.runAll());
}
