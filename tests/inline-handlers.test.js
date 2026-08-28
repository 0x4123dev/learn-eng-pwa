// inline-handlers.test.js — every onclick in the HTML must call something real.
//
// This exists because a whole word-popup — an overlay, a phonetic line, and
// three buttons ("Đã biết", "Học", close) — sat in index.html calling
// closeWordPopup(), markWordKnown() and markWordLearn(), none of which were
// ever written. The design had moved on to a tap-to-hear chip and the markup
// was left behind. It was harmless only by luck: nothing ever showed the
// overlay, so the dead buttons could not be reached.
//
// Had anything displayed it, three buttons would have done nothing at all,
// silently, and no test would have noticed. A handler naming a function that
// does not exist is always a bug — either dead markup or a broken button — so
// this catches both.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Names that are methods on a value, not globals — `x.focus()`, `e.preventDefault()`.
function callsIn(source) {
    const out = new Set();
    for (const m of source.matchAll(/\son\w+="([^"]*)"/g)) {
        // Only bare calls: `foo(` not preceded by a dot.
        for (const c of m[1].matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) out.add(c[1]);
    }
    return out;
}

function globalsDefinedIn(files) {
    const out = new Set();
    for (const f of files) {
        const src = read(f);
        for (const m of src.matchAll(/(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)) out.add(m[1]);
        for (const m of src.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)) out.add(m[1]);
        for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) out.add(m[1]);
    }
    return out;
}

// Language constructs and host objects that look like calls but are not ours.
const NOT_FUNCTIONS = new Set([
    'if', 'for', 'while', 'switch', 'return', 'typeof', 'catch', 'function',
    'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat', 'Number', 'String',
    'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'setTimeout',
    'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
    'fetch', 'console', 'event', 'this', 'document', 'window', 'navigator',
]);

for (const page of ['index.html', 'admin.html']) {
    suite(`inline handlers: ${page}`, () => {
        test('every handler calls a function that exists', () => {
            const html = read(page);
            // admin.html carries its own script; index.html loads js/*.js.
            const scripts = page === 'index.html'
                ? [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1])
                : [];
            const defined = globalsDefinedIn(scripts);
            // Functions declared inline in the page itself count too.
            for (const m of html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);

            const missing = [...callsIn(html)]
                .filter(n => !defined.has(n) && !NOT_FUNCTIONS.has(n))
                .sort();
            assert.deepEqual(missing, [],
                `${page} has handlers calling undefined functions: ${missing.join(', ')}`);
        });

        test('no element id is referenced by an id that nothing renders', () => {
            // The weaker half of the same problem: markup kept for a screen
            // that no longer exists. Only asserted for the popup that was
            // removed, so it cannot creep back in.
            const html = read(page);
            assert.falsy(/wordPopup|word-popup/.test(html),
                'the dead word popup is back — nothing in js/ ever showed it');
        });
    });
}

suite('inline handlers: the removed popup left nothing behind', () => {
    test('its styles are gone too', () => {
        assert.falsy(/\.word-popup/.test(read('css/styles.css')),
            'dead CSS for markup that no longer exists');
    });

    test('speakWord survived — it was never the popup\'s alone', () => {
        // The popup called speakWord(); several live features still do, so it
        // must not have been removed with it.
        const app = read('js/app.js');
        assert.truthy(/function speakWord\(/.test(app), 'speakWord must still exist');
        const callers = ['js/home.js', 'js/lessons.js', 'js/word-hunt.js']
            .filter(f => /speakWord\(/.test(read(f)));
        assert.truthy(callers.length >= 2, `only ${callers.length} caller(s) left — check the removal`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
