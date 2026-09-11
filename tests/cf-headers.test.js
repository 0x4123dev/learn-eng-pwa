// _headers — Cloudflare Pages response headers. Versioned, never-changing
// assets are cached for a year; everything the service worker and CACHE_NAME
// govern keeps Pages' default, or a phone would be pinned to a release.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Parse the Pages _headers format: a path line, then indented "Name: value"
// lines. Comments and blank lines are ignored.
function parseHeaders(src) {
  const rules = [];
  let current = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\S/.test(line)) { current = { path: line.trim(), headers: {} }; rules.push(current); continue; }
    assert.truthy(current, 'a header line before any path: ' + line);
    const m = /^\s+([^:]+):\s*(.*)$/.exec(line);
    assert.truthy(m, 'not a header line: ' + JSON.stringify(line));
    current.headers[m[1].trim()] = m[2].trim();
  }
  return rules;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const EXPECTED = ['/img/*', '/audio/*', '/fonts/*', '/js/phaser.min.js'];

suite('Cloudflare _headers: immutable caching for versioned assets only', () => {
  test('_headers exists at the repo root and parses', () => {
    assert.truthy(fs.existsSync(path.join(ROOT, '_headers')), '_headers is missing');
    const rules = parseHeaders(read('_headers'));
    assert.truthy(rules.length > 0, 'no rules parsed');
  });

  test('exactly the four never-changing paths are immutable for a year', () => {
    const rules = parseHeaders(read('_headers'));
    assert.deepEqual(rules.map(r => r.path), EXPECTED, 'the set of paths must be exactly these, in this order');
    for (const r of rules) {
      assert.deepEqual(Object.keys(r.headers), ['Cache-Control'], r.path + ': only Cache-Control may be set');
      assert.equal(r.headers['Cache-Control'], IMMUTABLE, r.path);
    }
  });

  test('nothing the service worker governs gets a caching rule', () => {
    const paths = parseHeaders(read('_headers')).map(r => r.path);
    for (const banned of ['/js/*', '/css/*', '/*.html', '/index.html', '/sw.js', '/api/*', '/*', '/']) {
      assert.falsy(paths.includes(banned), banned + ' must keep Pages\' default max-age=0, must-revalidate');
    }
    // Only one js/ file is allowed through: the vendored engine, which only
    // ever changes by changing its name.
    for (const p of paths.filter(p => p.startsWith('/js/'))) assert.equal(p, '/js/phaser.min.js');
  });

  test('deploy.sh ships _headers into .cf-dist on the same line as _redirects', () => {
    const deploy = read('scripts/deploy.sh');
    const line = (deploy.match(/^cp [^\n]*\.cf-dist\/$/m) || [])[0] || '';
    assert.truthy(/\b_redirects\b/.test(line) && /\b_headers\b/.test(line),
      'the root-files cp line must copy both _redirects and _headers: ' + line);
  });
});

suite('images below the fold load lazily', () => {
  // Every lazy image also decodes off the main thread. Home's own hero art
  // (the sun, the yard scene) and anything absolutely positioned inside a
  // cropped scene (math source figures, board pieces) deliberately stay
  // eager — see js/math-figures.js for the Mobile Safari reason.
  const LAZY = [
    ['js/daily-task.js', 'dt-farm-art'],
    ['js/night-raid.js', 'nr-build-art'],
    ['js/petbattlegame.js', 'pb-squad-avatar'],
    ['js/petbattle.js', 'pb-hire-avatar'],
    ['js/petbattle.js', '${scene.poster}'],
  ];
  test('cards, shop tiles, avatars and arena posters carry loading="lazy" decoding="async"', () => {
    for (const [file, marker] of LAZY) {
      const src = read(file);
      const tags = src.match(/<img[^>]*>/g).filter(t => t.includes(marker));
      assert.truthy(tags.length > 0, file + ': no <img> with ' + marker);
      for (const t of tags) {
        assert.truthy(/loading="lazy"/.test(t), file + ': ' + t);
        assert.truthy(/decoding="async"/.test(t), file + ': ' + t);
      }
    }
  });
  test('the Home hero art stays eager', () => {
    const sun = read('index.html').match(/<img[^>]*sun\.svg[^>]*>/)[0];
    assert.falsy(/loading="lazy"/.test(sun), 'the Home sun is above the fold');
    const yard = read('js/night-raid.js').match(/<img class="nr-board-art"[^>]*>/g);
    assert.truthy(yard.length >= 1);
    for (const t of yard) assert.falsy(/loading="lazy"/.test(t), 'the yard board is the Home hero: ' + t);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
