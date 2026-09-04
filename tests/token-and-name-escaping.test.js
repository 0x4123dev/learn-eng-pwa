// token-and-name-escaping.test.js — two defence-in-depth holes, closed.
//
// 1. The session token is the whole account and lives 90 days. It used to be
//    accepted from `?token=` on every REST route, which is the one place a
//    secret gets written down by everybody: Cloudflare logs, analytics, any
//    proxy in between, a Referer header. Only the Authorization header counts
//    now. (The battle Worker's WebSocket handshake still carries it in the URL
//    — a browser cannot put a header on an upgrade — and that exception is
//    documented at both call sites; it does NOT reach this API.)
//
// 2. A username used to be spliced into `onclick="openFriendActivity(1,'…')"`
//    with an escaper that did not escape quotes. Today USERNAME_RE forbids
//    quotes, so nothing was live — but that rule lives in two other files, and
//    a name edited straight in the database never passes it at all.
//
// Everything below RUNS the real code: the real bearer(), the real Pages
// handler, the real renderFriendsSection(), the real admin.html esc().
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
        const req = new Request('http://app.test/api/friends?token=deadbeef.sig');
        assert.equal(lib.bearer(req), null,
            'a URL-borne token is written to logs by everything it passes through');
    });

    test('a token smuggled alongside other params is not read either', () => {
        const req = new Request('http://app.test/api/friends/activity?friendId=3&token=deadbeef.sig');
        assert.equal(lib.bearer(req), null);
    });

    test('the Authorization header is what authenticates', () => {
        const req = new Request('http://app.test/api/friends', {
            headers: { Authorization: 'Bearer deadbeef.sig' },
        });
        assert.equal(lib.bearer(req), 'deadbeef.sig');
    });

    test('the header wins even when a query token is also present', () => {
        const req = new Request('http://app.test/api/friends?token=other.sig', {
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
        const handler = loadModule('functions/api/friends/index.js').onRequestGet;

        const withHeader = await handler({
            request: new Request('http://app.test/api/friends', {
                headers: { Authorization: 'Bearer ' + u.token },
            }),
            env: world.env,
        });
        assert.equal(withHeader.status, 200, 'the header must still work');

        const withQuery = await handler({
            request: new Request('http://app.test/api/friends?token=' + encodeURIComponent(u.token)),
            env: world.env,
        });
        assert.equal(withQuery.status, 401,
            'a token scraped out of a Worker log must not open the REST API');
    });
});

// ===========================================================================
// DEFECT 2 — a username is data; it must never become markup or code
// ===========================================================================

// js/friends.js in a vm sandbox. The friendsSection element keeps the HTML it
// was given and answers querySelectorAll by PARSING it, so the rows the click
// handler binds to are the rows the browser would actually build.
function loadFriendsUI(opts) {
    opts = opts || {};
    const store = { html: '' };
    const calls = [];

    // A real DOM hands back the SAME element every time, which is what makes a
    // listener attached on one call observable on the next. Cache per rendered
    // HTML so this mock behaves that way too.
    let rowCache = { html: null, rows: [] };
    function makeRowsFrom(html) {
        if (rowCache.html === html) return rowCache.rows;
        const rows = parseTags(html)
            .filter(t => !t.closing && t.name === 'div'
                && (t.attrs['class'] || '').split(/\s+/).includes('friend-row')
                && t.attrs['data-friend-id'] !== undefined)
            .map(t => {
                const listeners = [];
                return {
                    __attrs: t.attrs,
                    getAttribute: (k) => (t.attrs[k.toLowerCase()] === undefined
                        ? null : decodeEntities(t.attrs[k.toLowerCase()])),
                    addEventListener: (type, fn) => { if (type === 'click') listeners.push(fn); },
                    click: () => listeners.forEach(fn => fn({})),
                    __listenerCount: () => listeners.length,
                };
            });
        rowCache = { html, rows };
        return rows;
    }

    const section = {
        id: 'friendsSection',
        set innerHTML(v) { store.html = String(v); },
        get innerHTML() { return store.html; },
        querySelectorAll: (sel) => (sel.indexOf('friend-row') >= 0 ? makeRowsFrom(store.html) : []),
    };

    const sandbox = {
        console, Date, Math, JSON, Object, Array, Number, String, Promise,
        setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent,
        URLSearchParams,
        document: {
            getElementById: (id) => (id === 'friendsSection' ? section : { value: '' }),
            querySelectorAll: () => [],
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        currentUser: 'me',
        EngAuth: {
            tokenFor: () => 'tok',
            api: async () => ({ ok: false, data: null }),
            linkStatus: () => ({ reason: 'unknown' }),
            validUsername: () => ({ ok: true }),
        },
        module: { exports: {} },
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(read('js/friends.js'), ctx);
    const api = sandbox.module.exports;
    // Watch the real navigation target: the row handler calls this global.
    ctx.openFriendActivity = (id, name) => { calls.push({ id, name }); };
    api._setFriendsData(opts.data || { friends: [], incoming: [], outgoing: [] });
    return { api, store, calls, section, sandbox };
}

suite('friends: a hostile username never becomes markup', () => {
    test('frEsc escapes all five HTML-significant characters', () => {
        const { api } = loadFriendsUI();
        assert.equal(api.frEsc('&'), '&amp;');
        assert.equal(api.frEsc('<'), '&lt;');
        assert.equal(api.frEsc('>'), '&gt;');
        assert.equal(api.frEsc('"'), '&quot;', 'a bare " closes any attribute it lands in');
        assert.equal(api.frEsc("'"), '&#39;', "a bare ' closes a single-quoted attribute");
    });

    test('escaping is not applied twice', () => {
        const { api } = loadFriendsUI();
        assert.equal(decodeEntities(api.frEsc(NASTY)), NASTY, 'the name must survive escape → decode');
    });

    test('the friend row carries the name as data, not as an inline handler', () => {
        const { api, store } = loadFriendsUI({
            data: {
                friends: [{ friendshipId: 1, userId: 7, username: NASTY, summary: { sessions: 2, correct: 3, daysThisWeek: 1 } }],
                incoming: [], outgoing: [],
            },
        });
        api.renderFriendsSection();

        const rows = parseTags(store.html).filter(t =>
            t.name === 'div' && (t.attrs['class'] || '').split(/\s+/).includes('friend-row'));
        assert.equal(rows.length, 1, 'exactly one friend row: ' + store.html);
        const row = rows[0];

        // The value the browser would actually read back, parsed as a browser
        // would parse it. If a quote had broken out, this is garbage.
        assert.equal(decodeEntities(row.attrs['data-friend-name']), NASTY,
            'the whole name must stay inside one attribute value');
        assert.equal(row.attrs['data-friend-id'], '7');

        // No handler is built from data any more — there is nothing to escape
        // INTO, which is the actual fix.
        for (const name of row.order) {
            assert.falsy(/^on/.test(name), `friend row grew an inline handler: ${name}`);
        }
    });

    test('nothing in the name is parsed as a tag or an event attribute', () => {
        const { api, store } = loadFriendsUI({
            data: {
                friends: [{ friendshipId: 1, userId: 7, username: NASTY, summary: {} }],
                incoming: [{ friendshipId: 2, username: NASTY }],
                outgoing: [{ username: NASTY }],
            },
        });
        api.renderFriendsSection();

        const tags = parseTags(store.html);
        assert.falsy(tags.some(t => t.name === 'img'),
            'an <img> from a username was parsed as a real tag: ' + store.html);
        assert.falsy(tags.some(t => t.name === 'script'), 'a script tag reached the page');
        for (const t of tags) {
            assert.falsy(t.order.includes('onerror'),
                `an onerror attribute came from the username on <${t.name}>`);
            assert.falsy(t.order.includes('onmouseover'),
                `an onmouseover attribute came from the username on <${t.name}>`);
        }
        assert.falsy(store.html.includes('<img'), 'the raw tag must have been escaped');
    });

    test('clicking a row still opens that friend, with the real name', async () => {
        // The escaping is only half the fix; the row must still work. The
        // listener is attached to a parsed element, so the name it passes on
        // is the name the browser would hand back — decoded, exact, and never
        // evaluated.
        const { api, calls, section } = loadFriendsUI({
            data: {
                friends: [{ friendshipId: 1, userId: 7, username: NASTY, summary: {} }],
                incoming: [], outgoing: [],
            },
        });
        api.renderFriendsSection();
        const rows = section.querySelectorAll('.friend-row[data-friend-id]');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].__listenerCount(), 1, 'the row must have a click listener');
        rows[0].click();
        assert.equal(calls.length, 1, 'the row did not open the friend');
        assert.equal(calls[0].id, 7);
        assert.equal(calls[0].name, NASTY, 'the handler must receive the name as data');
    });

    test('a hostile status message is escaped too', () => {
        // Same escaper, the other path a server string reaches the DOM by.
        const { api } = loadFriendsUI();
        assert.falsy(api.frEsc(NASTY).includes('<img'));
        assert.falsy(api.frEsc(NASTY).includes('"Na"'));
    });
});

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

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
