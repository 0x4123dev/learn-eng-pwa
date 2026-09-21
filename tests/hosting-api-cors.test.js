// hosting-api-cors.test.js — the app on GitHub Pages reaches its own API.
//
// Two halves that must agree. js/hosting.js decides, from the page's host,
// where /api/ is: same origin on Cloudflare Pages, the learn-eng-pwa-api
// project (own database) on GitHub Pages. functions/api/_middleware.js
// grants CORS to exactly that GitHub origin so the browser lets those calls
// through. Both are run here: the hosting rules with real hostnames, the
// middleware with real Requests through the same loader the API tests use.
// (The battle Worker and its /ws/ forwarder went with the 2026-09 cut.)
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const Hosting = require(path.join(ROOT, 'js', 'hosting.js'));
const R = Hosting._rules;

suite('hosting: where the API is, per host', () => {
    test('GitHub Pages → the learn-eng-pwa-api project', () => {
        assert.equal(R.apiBase('0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev');
        assert.equal(R.apiUrl('me/daily-tasks', '0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev/api/me/daily-tasks');
        assert.equal(R.apiUrl('/api/login', '0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev/api/login', 'a path that already says /api/ is not doubled');
    });
    test('Cloudflare Pages (and anywhere else) → same origin, untouched', () => {
        for (const h of ['eng-pwa.pages.dev', 'localhost', '']) {
            assert.equal(R.apiBase(h), '', h + ': same origin');
            assert.equal(R.apiUrl('me/daily-tasks', h), '/api/me/daily-tasks', h);
        }
        assert.equal(R.apiBase('github.io.example.com'), '', 'a lookalike host is not GitHub');
    });
    test('the GitHub app never shares the Cloudflare app\'s server halves', () => {
        assert.truthy(R.GITHUB_API !== 'https://eng-pwa.pages.dev');
        // And its database is a different one: the API project's wrangler config
        // names learn_eng_pwa_db, never eng_pwa_db.
        const cfg = read('api-project/wrangler.toml');
        assert.truthy(/database_name = "learn_eng_pwa_db"/.test(cfg), 'api-project binds learn_eng_pwa_db');
        assert.falsy(/eng_pwa_db"/.test(cfg.replace(/learn_eng_pwa_db/g, '')), 'and never eng_pwa_db');
        // The whole repo: no config names the Cloudflare app's project or database.
        for (const f of ['wrangler.toml', 'api-project/wrangler.toml']) {
            // Comments may explain what is NOT here; the settings themselves may not.
            const t = read(f).split('\n').filter(l => !/^\s*#/.test(l)).join('\n').replace(/learn[-_]eng[-_]pwa[-_a-z]*/g, '');
            assert.falsy(/eng-pwa|eng_pwa_db/.test(t), f + ' must not name eng-pwa / eng_pwa_db in a setting');
        }
        for (const f of ['scripts/deploy.sh', 'scripts/deploy-audio.sh']) {
            assert.truthy(read(f).includes("grep -q 'learn-eng-pwa'"), f + ' refuses to run in this checkout');
        }
        assert.truthy(/name = "learn-eng-pwa-api"/.test(cfg), 'and is the learn-eng-pwa-api project');
    });
    test('the battle Worker is gone: no service binding, no Worker deploy, no /ws/ forwarder', () => {
        // The Worker was reached only through a [[services]] binding on the
        // API project and a functions/ws/ forwarder. A binding left behind
        // would make every Pages deploy fail against a Worker that no longer
        // exists; a forwarder left behind would 500 on env.BATTLE.
        assert.falsy(/\[\[services\]\]|BATTLE/.test(read('api-project/wrangler.toml')), 'api-project still binds a Worker');
        assert.falsy(fs.existsSync(path.join(ROOT, 'functions', 'ws')), 'functions/ws/ must be gone');
        assert.falsy(fs.existsSync(path.join(ROOT, 'battle-worker', 'wrangler.toml')), 'battle-worker/wrangler.toml must be gone');
        const deploy = read('scripts/deploy-api.sh').split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
        assert.falsy(/wrangler@3 deploy|battle-worker|--no-worker/.test(deploy), 'deploy-api.sh still deploys the Worker');
        assert.truthy(/pages deploy dist --project-name "\$PROJECT"/.test(deploy), 'and still deploys the Pages Functions');
        assert.truthy(/preflight from https:\/\/0x4123dev\.github\.io/.test(deploy), 'and still confirms the CORS grant');
        assert.truthy(/grep -q '\^\\\[\\\[services\\\]\\\]' api-project\/wrangler\.toml \|\|/.test(deploy),
            'deploy-api.sh refuses a config that still binds a service');
    });
    test('every caller goes through Hosting: no bare /api/ fetch is left in the client', () => {
        for (const f of ['js/auth.js', 'admin.html']) {
            const src = read(f);
            assert.falsy(/fetch\(\s*['"`]\/api\//.test(src), f + ' still fetches a bare /api/ path');
            assert.truthy(src.includes('Hosting.apiUrl('), f + ' uses Hosting.apiUrl');
        }
        const html = read('index.html');
        assert.truthy(html.indexOf('js/hosting.js') < html.indexOf('js/auth.js'), 'hosting.js loads before auth.js');
        assert.truthy(read('admin.html').includes('js/hosting.js'), 'admin.html loads it too');
        assert.truthy(/'\/js\/hosting\.js':\s*'[0-9a-f]{16}'/.test(read('sw.js')), 'and it is precached');
    });
});

suite('API CORS middleware: the GitHub origin is let in, nothing else is', () => {
    const mw = loadModule('functions/api/_middleware.js');
    const GH = 'https://0x4123dev.github.io';
    const handler = () => new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    const run = (req) => mw.onRequest({ request: req, next: async () => handler() });

    test('a preflight from GitHub Pages is answered 204 with the grant the browser needs', async () => {
        const res = await run(new Request('https://learn-eng-pwa-api.pages.dev/api/login', {
            method: 'OPTIONS', headers: { Origin: GH, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } }));
        assert.equal(res.status, 204);
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), GH);
        assert.truthy(/POST/.test(res.headers.get('Access-Control-Allow-Methods')));
        assert.truthy(/Authorization/.test(res.headers.get('Access-Control-Allow-Headers')), 'the Bearer token header is allowed');
        assert.truthy(/Content-Type/.test(res.headers.get('Access-Control-Allow-Headers')));
        assert.equal(res.headers.get('Vary'), 'Origin');
    });
    test('a real request from GitHub Pages gets the handler\'s answer plus the grant, body intact', async () => {
        const res = await run(new Request('https://learn-eng-pwa-api.pages.dev/api/version', { headers: { Origin: GH } }));
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), GH);
        assert.equal(res.headers.get('Cache-Control'), 'no-store', 'the handler\'s own headers survive');
        assert.deepEqual(await res.json(), { ok: true });
    });
    test('an unlisted origin gets no grant — not "*", not an echo', async () => {
        for (const origin of ['https://evil.example.com', 'https://0x4123dev.github.io.example.com', 'http://0x4123dev.github.io']) {
            const pre = await run(new Request('https://learn-eng-pwa-api.pages.dev/api/login', { method: 'OPTIONS', headers: { Origin: origin } }));
            assert.equal(pre.status, 204, origin);
            assert.equal(pre.headers.get('Access-Control-Allow-Origin'), null, origin + ': preflight not granted');
            const res = await run(new Request('https://learn-eng-pwa-api.pages.dev/api/version', { headers: { Origin: origin } }));
            assert.equal(res.headers.get('Access-Control-Allow-Origin'), null, origin + ': response not granted');
        }
    });
    test('a same-origin request (no Origin header) passes through untouched', async () => {
        const res = await run(new Request('https://eng-pwa.pages.dev/api/version'));
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
        assert.deepEqual(await res.json(), { ok: true });
    });
    test('the grant list is exactly the GitHub app and local dev', () => {
        assert.deepEqual(mw.ALLOWED_ORIGINS.slice(), [GH, 'http://localhost:8000', 'http://127.0.0.1:8000']);
        assert.equal(mw.corsHeadersFor(undefined), null);
        assert.equal(mw.corsHeadersFor('*'), null);
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
