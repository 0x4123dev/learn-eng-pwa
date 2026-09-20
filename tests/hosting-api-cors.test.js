// hosting-api-cors.test.js — the app on GitHub Pages reaches its own API.
//
// Two halves that must agree. js/hosting.js decides, from the page's host,
// where /api/ and the battle rooms are: same origin on Cloudflare Pages, the
// learn-eng-pwa-api project (own database) and the learn-eng-pwa-battle
// Worker on GitHub Pages. functions/api/_middleware.js grants CORS to exactly
// that GitHub origin so the browser lets those calls through. Both are run
// here: the hosting rules with real hostnames, the middleware with real
// Requests through the same loader the API tests use.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const Hosting = require(path.join(ROOT, 'js', 'hosting.js'));
const R = Hosting._rules;

suite('hosting: where the API and the battle rooms are, per host', () => {
    test('GitHub Pages → the learn-eng-pwa-api project and the learn-eng-pwa-battle Worker', () => {
        assert.equal(R.apiBase('0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev');
        assert.equal(R.apiUrl('me/wins', '0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev/api/me/wins');
        assert.equal(R.apiUrl('/api/login', '0x4123dev.github.io'), 'https://learn-eng-pwa-api.pages.dev/api/login', 'a path that already says /api/ is not doubled');
        assert.equal(R.battleWsBase('0x4123dev.github.io'), 'wss://learn-eng-pwa-api.pages.dev/ws');
        // The account's workers.dev subdomain is the owner's name: the GitHub
        // app must never carry it.
        assert.falsy(/workers\.dev/.test(R.GITHUB_BATTLE_WS), 'no workers.dev address in the GitHub app');
        assert.truthy(/\[\[services\]\][\s\S]*binding = "BATTLE"[\s\S]*service = "learn-eng-pwa-battle"/.test(read('api-project/wrangler.toml')), 'the API project binds the Worker');
        assert.truthy(read('functions/ws/[[path]].js').includes('env.BATTLE.fetch('), 'and /ws/ forwards to it');
    });
    test('Cloudflare Pages (and anywhere else) → same origin and the eng-pwa-battle Worker, untouched', () => {
        for (const h of ['eng-pwa.pages.dev', 'localhost', '']) {
            assert.equal(R.apiBase(h), '', h + ': same origin');
            assert.equal(R.apiUrl('me/wins', h), '/api/me/wins', h);
            assert.equal(R.battleWsBase(h), 'wss://eng-pwa-battle.minhdoanh.workers.dev', h);
        }
        assert.equal(R.apiBase('github.io.example.com'), '', 'a lookalike host is not GitHub');
    });
    test('the GitHub app never shares the Cloudflare app\'s server halves', () => {
        assert.truthy(R.GITHUB_API !== 'https://eng-pwa.pages.dev');
        assert.truthy(R.GITHUB_BATTLE_WS !== R.CLOUDFLARE_BATTLE_WS);
        // And its database is a different one: the API project's wrangler config
        // names learn_eng_pwa_db, never eng_pwa_db.
        const cfg = read('api-project/wrangler.toml');
        assert.truthy(/database_name = "learn_eng_pwa_db"/.test(cfg), 'api-project binds learn_eng_pwa_db');
        assert.falsy(/eng_pwa_db"/.test(cfg.replace(/learn_eng_pwa_db/g, '')), 'and never eng_pwa_db');
        // The whole repo: no config names the Cloudflare app's project, database or Worker.
        for (const f of ['wrangler.toml', 'battle-worker/wrangler.toml', 'api-project/wrangler.toml']) {
            // Comments may explain what is NOT here; the settings themselves may not.
            const t = read(f).split('\n').filter(l => !/^\s*#/.test(l)).join('\n').replace(/learn[-_]eng[-_]pwa[-_a-z]*/g, '');
            assert.falsy(/eng-pwa|eng_pwa_db/.test(t), f + ' must not name eng-pwa / eng_pwa_db / eng-pwa-battle in a setting');
        }
        for (const f of ['scripts/deploy.sh', 'scripts/deploy-audio.sh']) {
            assert.truthy(read(f).includes("grep -q 'learn-eng-pwa'"), f + ' refuses to run in this checkout');
        }
        assert.truthy(/name = "learn-eng-pwa-api"/.test(cfg), 'and is the learn-eng-pwa-api project');
        const bw = read('battle-worker/wrangler.toml');
        assert.truthy(/name = "learn-eng-pwa-battle"/.test(bw) && /database_name = "learn_eng_pwa_db"/.test(bw), 'the battle Worker likewise');
    });
    test('every caller goes through Hosting: no bare /api/ fetch is left in the client', () => {
        for (const f of ['js/auth.js', 'admin.html']) {
            const src = read(f);
            assert.falsy(/fetch\(\s*['"`]\/api\//.test(src), f + ' still fetches a bare /api/ path');
            assert.truthy(src.includes('Hosting.apiUrl('), f + ' uses Hosting.apiUrl');
        }
        for (const f of ['js/battlelink.js', 'js/ghost-offering-link.js']) {
            assert.truthy(read(f).includes('Hosting.battleWsBase()'), f + ' asks Hosting for the Worker');
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

suite('the battle rooms behind the API domain: /ws/* forwards over the service binding', () => {
    const route = loadModule('functions/ws/[[path]].js');
    test('an upgrade to /ws/room/<id>?token=… reaches the Worker as /room/<id>?token=…, headers intact', async () => {
        const seen = [];
        const env = { BATTLE: { fetch: async (req) => { seen.push(req); return new Response(null, { status: 200 }); } } };
        const request = new Request('https://learn-eng-pwa-api.pages.dev/ws/room/42?token=abc', { headers: { Upgrade: 'websocket', Origin: 'https://0x4123dev.github.io' } });
        const res = await route.onRequest({ request, env, params: { path: ['room', '42'] } });
        assert.equal(res.status, 200, 'the Worker\'s answer is returned as-is (a real 101 in production)');
        assert.equal(seen.length, 1, 'forwarded exactly once');
        const u = new URL(seen[0].url);
        assert.equal(u.pathname, '/room/42', 'the /ws prefix is stripped — the Worker routes on /room/');
        assert.equal(u.search, '?token=abc', 'the token reaches the Worker, which verifies and strips it');
        assert.equal(seen[0].headers.get('Upgrade'), 'websocket', 'the upgrade header travels');
        assert.falsy(/workers\.dev/.test(seen[0].url), 'no public workers.dev address is involved');
    });
    test('the offering room forwards the same way', async () => {
        const seen = [];
        const env = { BATTLE: { fetch: async (req) => { seen.push(req); return new Response(null, { status: 200 }); } } };
        await route.onRequest({ request: new Request('https://learn-eng-pwa-api.pages.dev/ws/offering/daily?token=t&bot=1', { headers: { Upgrade: 'websocket' } }), env, params: { path: ['offering', 'daily'] } });
        assert.equal(new URL(seen[0].url).pathname + new URL(seen[0].url).search, '/offering/daily?token=t&bot=1');
    });
    test('without the binding (a deployment that is not the API project) the route is a plain 404', async () => {
        const res = await route.onRequest({ request: new Request('https://eng-pwa.pages.dev/ws/room/1'), env: {}, params: { path: ['room', '1'] } });
        assert.equal(res.status, 404);
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
