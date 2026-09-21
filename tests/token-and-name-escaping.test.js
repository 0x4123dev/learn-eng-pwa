// token-and-name-escaping.test.js — two defence-in-depth holes, closed.
//
// 1. The session token is the whole account and never expires. It used to be
//    accepted from `?token=` on every REST route, which is the one place a
//    secret gets written down by everybody: Cloudflare logs, analytics, any
//    proxy in between, a Referer header. Only the Authorization header counts
//    now.
//
// 2. A username used to be spliced into an inline onclick handler with an
//    escaper that did not escape quotes. Today USERNAME_RE forbids quotes, so
//    nothing was live — but that rule lives in other files, and a name edited
//    straight in the database never passes it at all. The admin dashboard is
//    where a raw database name is painted.
//
// Everything below RUNS the real code: the real bearer(), the real Pages
// handler, the real admin.html esc().
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// A tag reader that follows the HTML rule the old code broke: a quoted
// attribute value ends at its matching quote and NOWHERE else. That is the
// whole defect — a `"` inside the value ends the attribute early and whatever
// follows becomes new attributes. Describing the markup with a substring
// search would miss exactly that; parsing it the way a browser does does not.
// ---------------------------------------------------------------------------
function parseTags(html) {
  const tags = [];
  for (let i = 0; i < html.length; i++) {
    if (html[i] !== '<') continue;
    const m = /^<\/?([a-zA-Z][^\s/>]*)/.exec(html.slice(i));
    if (!m) continue;                       // a stray "<" in text, not a tag
    let j = i + m[0].length;
    const attrs = {};
    const order = [];
    while (j < html.length) {
      while (j < html.length && /\s/.test(html[j])) j++;
      if (html[j] === '>' ) { j++; break; }
      if (html[j] === '/' && html[j + 1] === '>') { j += 2; break; }
      let name = '';
      while (j < html.length && !/[\s=/>]/.test(html[j])) name += html[j++];
      if (!name) { j++; continue; }
      while (j < html.length && /\s/.test(html[j])) j++;
      let value = '';
      if (html[j] === '=') {
        j++;
        while (j < html.length && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          j++;
          while (j < html.length && html[j] !== q) value += html[j++];
          j++;                              // the closing quote
        } else {
          while (j < html.length && !/[\s>]/.test(html[j])) value += html[j++];
        }
      }
      attrs[name.toLowerCase()] = value;
      order.push(name.toLowerCase());
    }
    tags.push({ name: m[1].toLowerCase(), closing: m[0][1] === '/', attrs, order });
    i = j - 1;
  }
  return tags;
}
function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
  return String(s).replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => map[e]);
}

// A name that attacks every layer at once: a double quote to close an
// attribute, a single quote to close the JS string the old onclick built, a
// tag to inject, and an `&` to prove double-escaping is not happening.
const NASTY = `Bé "Na" <img src=x onerror="alert(1)"> O'Brien & co`;

// ===========================================================================
// DEFECT 1 — the token must never be accepted from a URL
// ===========================================================================
suite('auth: the session token is a header, never a query string', () => {
  const lib = loadModule('functions/api/_lib.js');

  test('a token in the query string is not read as credentials', () => {
        // The exact shape that used to work. It must now yield nothing, so
        // requireAuth() has nothing to verify and the route answers 401.
        const req = new Request('http://app.test/api/me/attempts?token=deadbeef.sig');
        assert.equal(lib.bearer(req), null,
            'a URL-borne token is written to logs by everything it passes through');
    });

    test('a token smuggled alongside other params is not read either', () => {
        const req = new Request('http://app.test/api/night-raid/home?since=3&token=deadbeef.sig');
        assert.equal(lib.bearer(req), null);
    });

    test('the Authorization header is what authenticates', () => {
        const req = new Request('http://app.test/api/me/attempts', {
            headers: { Authorization: 'Bearer deadbeef.sig' },
        });
        assert.equal(lib.bearer(req), 'deadbeef.sig');
    });

    test('the header wins even when a query token is also present', () => {
        const req = new Request('http://app.test/api/me/attempts?token=other.sig', {
            headers: { Authorization: 'Bearer header.sig' },
        });
        assert.equal(lib.bearer(req), 'header.sig');
    });

    test('a real endpoint answers 200 to the header and 401 to the URL', async () => {
        // End to end through the actual Pages handler and a real signed token,
        // so this cannot pass by describing bearer() while a route reads the
        // query string some other way.
        const world = createWorld();
        const u = await world.createUser({ username: 'kid_url_token' });
        const handler = loadModule('functions/api/me/attempts.js').onRequestGet;

        const withHeader = await handler({
            request: new Request('http://app.test/api/me/attempts', {
                headers: { Authorization: 'Bearer ' + u.token },
            }),
            env: world.env,
        });
        assert.equal(withHeader.status, 200, 'the header must still work');

        const withQuery = await handler({
            request: new Request('http://app.test/api/me/attempts?token=' + encodeURIComponent(u.token)),
            env: world.env,
        });
        assert.equal(withQuery.status, 401,
            'a token scraped out of a Worker log must not open the REST API');
    });
});

// ===========================================================================
// DEFECT 2 — a username is data; it must never become markup or code
// ===========================================================================

suite('admin dashboard: the same escaper, the same rule', () => {
    const esc = (() => {
        const script = read('admin.html').match(/<script>([\s\S]*)<\/script>/)[1];
        const start = script.indexOf('function esc(');
        if (start < 0) throw new Error('esc() not found in admin.html');
        const src = script.slice(start, script.indexOf('\n', start));
        const sandbox = { String };
        vm.createContext(sandbox);
        vm.runInContext(src + '\nthis.esc = esc;', sandbox);
        return sandbox.esc;
    })();

    test('esc escapes all five characters', () => {
        assert.equal(esc('&'), '&amp;');
        assert.equal(esc('<'), '&lt;');
        assert.equal(esc('>'), '&gt;');
        assert.equal(esc('"'), '&quot;');
        assert.equal(esc("'"), '&#39;');
        assert.equal(esc(null), '', 'null still renders as nothing');
    });

    test('a username survives the data-name attribute the row is built from', () => {
        // admin.html reads the user back out of data-uid/data-name to run the
        // Coins and Disable actions. A broken-out attribute would both inject
        // markup and hand the action the wrong name.
        const row = `<tr class="clickable" data-uid="9" data-name="${esc(NASTY)}"><td>${esc(NASTY)}</td></tr>`;
        const tags = parseTags(row);
        const tr = tags.find(t => t.name === 'tr');
        assert.equal(decodeEntities(tr.attrs['data-name']), NASTY);
        assert.equal(tr.attrs['data-uid'], '9', 'the row must not have lost its other attributes');
        for (const name of tr.order) assert.falsy(/^on/.test(name), 'row grew ' + name);
        assert.falsy(tags.some(t => t.name === 'img'), 'a tag from the name was parsed: ' + row);
    });

    test('a username survives a title/aria-label attribute', () => {
        const btn = `<button aria-label="Give coins to ${esc(NASTY)}" title="${esc(NASTY)}">x</button>`;
        const tags = parseTags(btn);
        const b = tags.find(t => t.name === 'button');
        assert.equal(decodeEntities(b.attrs['title']), NASTY);
        assert.equal(decodeEntities(b.attrs['aria-label']), 'Give coins to ' + NASTY);
        assert.equal(tags.filter(t => !t.closing).length, 1,
            'nothing else was parsed as a tag: ' + btn);
    });
});


suite('sessions do not expire, and the disable switch is what revokes them', () => {
  // A child must never be asked to sign in again: a forgotten passcode on a
  // device that worked yesterday is a support call a seven-year-old cannot
  // make. The 90-day clock this used to run meant every account hit that wall
  // eventually, months after anyone remembered setting it up.
  const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  test('a freshly signed token carries no expiry at all', async () => {
    const lib = loadModule('functions/api/_lib.js');
    const token = await lib.signToken({ uid: 7, username: 'Na' }, 'secret');
    const raw = Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(raw);
    assert.falsy('exp' in payload, 'no exp is stamped: ' + raw);
    assert.equal(payload.uid, 7);
  });

  test('a token issued under the old 90-day rule keeps working past its date', async () => {
    // Ignoring `exp` rather than merely not stamping it is what stops every
    // child who already has a token hitting the old wall once.
    const lib = loadModule('functions/api/_lib.js');
    const crypto = require('crypto');
    const body = b64url(Buffer.from(JSON.stringify({ uid: 7, username: 'Na', exp: Date.now() - 86400000 })));
    const sig = b64url(crypto.createHmac('sha256', 'secret').update(body).digest());
    const verified = await lib.verifyToken(body + '.' + sig, 'secret');
    assert.truthy(verified, 'a token expired under the old rule must still verify');
    assert.equal(verified.uid, 7);
  });

  test('a forged signature is still refused — nothing else was loosened', async () => {
    const lib = loadModule('functions/api/_lib.js');
    const token = await lib.signToken({ uid: 7 }, 'secret');
    assert.falsy(await lib.verifyToken(token, 'other-secret'), 'a different secret must not verify');
    assert.falsy(await lib.verifyToken(token.split('.')[0] + '.deadbeef', 'secret'), 'a bad signature must not verify');
    assert.falsy(await lib.verifyToken('nonsense', 'secret'));
  });

  test('disabling the account revokes it on the very next request', async () => {
    // With no expiry, this row read is the ONLY revocation path there is.
    const world = createWorld();
    const kid = await world.createUser({ username: 'NaRevoke' });
    const handler = loadModule('functions/api/me/attempts.js');
    const before = await world.call(handler.onRequestGet, { url: '/api/me/attempts', method: 'GET', token: kid.token });
    assert.equal(before.status, 200, 'the token works: ' + JSON.stringify(before.data));
    world.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(kid.uid);
    const after = await world.call(handler.onRequestGet, { url: '/api/me/attempts', method: 'GET', token: kid.token });
    assert.equal(after.status, 401, 'and stops working the moment the admin flips the switch');
  });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
