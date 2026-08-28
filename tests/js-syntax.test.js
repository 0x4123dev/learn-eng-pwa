// js-syntax.test.js — every browser script must actually parse.
//
// A duplicate `const` introduced by an edit is a SyntaxError at parse time,
// and a classic <script> that fails to parse takes its ENTIRE file with it:
// every function in it silently ceases to exist, with nothing but a console
// error the child will never see. Text-matching tests cannot catch this —
// only compiling can. (Caught exactly this in js/friends.js: a second
// `const pending` in renderFriendsSection.)
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

suite('every browser script parses', () => {
    test('the js/ directory is actually being scanned', () => {
        assert.truthy(files.length > 20, `expected the app's scripts, found ${files.length}`);
    });

    for (const f of files) {
        test(`js/${f} compiles as a classic script`, () => {
            const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
            try {
                new vm.Script(src, { filename: `js/${f}` });   // parse only, never run
            } catch (e) {
                assert.truthy(false, `js/${f} does not parse: ${e.message}`);
            }
        });
    }
});

suite('Pages Functions parse too', () => {
    const dir = path.join(__dirname, '..', 'functions', 'api');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
    const apiFiles = walk(dir).sort();

    test('the functions/api tree is being scanned', () => {
        assert.truthy(apiFiles.length >= 5, `found only ${apiFiles.length} endpoints`);
    });

    for (const full of apiFiles) {
        const rel = path.relative(path.join(__dirname, '..'), full);
        test(`${rel} compiles as a module`, () => {
            const src = fs.readFileSync(full, 'utf8');
            try {
                // import/export are only legal in a module, so compile the body
                // with those lines removed — enough to catch scope and brace errors.
                const body = src
                    .replace(/^\s*import[^;]+;\s*$/gm, '')
                    .replace(/^\s*export\s+(async\s+)?function/gm, '$1function')
                    .replace(/^\s*export\s+(const|let|var)/gm, '$1');
                new vm.Script(body, { filename: rel });
            } catch (e) {
                assert.truthy(false, `${rel} does not parse: ${e.message}`);
            }
        });
    }
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
