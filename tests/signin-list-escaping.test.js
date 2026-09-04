// The sign-in screen is the ONE screen every child sees on every open, and it
// was the last place in the app still writing a stored value into HTML raw:
// js/app.js renderUserList interpolated `userData.username` into a
// `.user-name` span AND into two `aria-label="…"` attributes with no escaper
// at all, while every other tab escapes an echoed value.
//
// It is only reachable through a locally created profile, and USERNAME_RE
// keeps markup out of a name today — so this is defence in depth. It stops
// being that the moment the regex is relaxed or a profile is hand-edited, and
// then it executes on every app open, before anyone has signed in.
'use strict';

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const NASTY = 'Bé "Na" <img src=x onerror="alert(1)"> O\'Brien & co';

suite('sign-in list: a stored name is data, never markup', () => {
  test('appEsc covers all five characters, not just the angle brackets', () => {
    const app = loadAppCode();
    assert.truthy(typeof app.appEsc === 'function', 'the escaper must be reachable');
    assert.equal(app.appEsc('&'), '&amp;');
    assert.equal(app.appEsc('<'), '&lt;');
    assert.equal(app.appEsc('>'), '&gt;');
    assert.equal(app.appEsc('"'), '&quot;');
    assert.equal(app.appEsc("'"), '&#39;');
    // An escaper that stops at & < > still lets a value close an attribute —
    // which is exactly where this screen puts a name.
    assert.falsy(app.appEsc(NASTY).includes('"'), 'no bare double quote survives');
    assert.falsy(app.appEsc(NASTY).includes("'"), 'no bare single quote survives');
    assert.falsy(/<img/.test(app.appEsc(NASTY)), 'and no tag survives');
  });

  test('a null or numeric value is rendered, not crashed on', () => {
    const app = loadAppCode();
    assert.equal(app.appEsc(null), '');
    assert.equal(app.appEsc(undefined), '');
    assert.equal(app.appEsc(0), '0');
    assert.equal(app.appEsc(42), '42');
  });

  test('a hostile profile name reaches the card as text and nothing else', () => {
    const app = loadAppCode();
    // A DOM just rich enough for renderUserList: it builds one div per user,
    // sets innerHTML, then querySelector's the two buttons to wire clicks.
    const built = [];
    const stub = () => {
      const el = {
        className: '', _html: '', style: {}, children: [],
        set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
        querySelector: () => ({ set onclick(_) {} , onclick: null }),
        appendChild(child) { this.children.push(child); },
      };
      return el;
    };
    const list = stub();
    app.document.getElementById = id => (id === 'userList' ? list : stub());
    app.document.createElement = () => { const el = stub(); built.push(el); return el; };
    app.localStorage.setItem('flashlingo-user-' + NASTY, JSON.stringify(
      Object.assign(app.createDefaultUserData(NASTY), { username: NASTY, avatar: '😊' })));

    app.renderUserList([NASTY]);
    assert.equal(built.length, 1, 'one card for one profile');
    const html = built[0].innerHTML;

    assert.falsy(/<img/i.test(html), 'the name must not become a tag');
    // `onerror=` still appears — as inert TEXT, with its quotes escaped. What
    // must not exist is a real handler: an unescaped quoted attribute value.
    assert.falsy(/on[a-z]+\s*=\s*["'][^"']*["']/i.test(html), 'nor an event handler');
    assert.truthy(html.includes('onerror=&quot;'), 'it is there, but only as text');
    // The aria-labels are attribute context: a raw " would end the attribute
    // and everything after it would be parsed as more attributes.
    const labels = html.match(/aria-label="[^"]*"/g) || [];
    assert.equal(labels.length, 2, 'both aria-labels stay whole: ' + labels.length);
    // The two labels being WHOLE (matched up to their own closing quote) is
    // already the proof that no quote escaped. What is left to check is that
    // no raw `<` slipped in to start a tag inside them, and that the child's
    // real name is what a browser would decode back out.
    const decode = t => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    for (const l of labels) {
      assert.falsy(l.includes('<'), 'no raw angle bracket in a label: ' + l);
      assert.truthy(decode(l).includes(NASTY), 'and the real name is preserved: ' + l);
    }
    // …and the child still sees their own name, entities and all.
    assert.truthy(html.includes('&lt;img'), 'the name is shown, escaped');
    assert.truthy(html.includes('Bé &quot;Na&quot;'), 'quotes are shown as quotes');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
