// tests/farm-art.test.js — every picture the farm can ask for exists on disk,
// is precached, and nothing extra hides in img/farm/. Two castle boards once
// shipped as untracked files that a clean checkout did not have; this makes
// that impossible for the farm.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const F = require(path.join(ROOT, 'js', 'farm-rules.js'));
const M = require(path.join(ROOT, 'js', 'farm-art-manifest.js'));

suite('farm art: the manifest is the rules plus the plot choices and overlays', () => {
  test('51 entries: every sprite name, three selectable plots and legacy overlays', () => {
    const names = M.FILES.map(f => f.name);
    assert.equal(names.length, 51);
    assert.equal(new Set(names).size, 51, 'no duplicate names');
    for (const n of F.spriteNames()) assert.contains(names, n, 'missing sprite ' + n);
    assert.contains(names, 'farm-plot');
    for (const n of ['farm-plot-stone', 'farm-plot-hedge', 'farm-plot-clover']) assert.contains(names, n);
    assert.contains(names, 'dry-ground');
  });
  test('every entry has a size and a prompt', () => {
    for (const f of M.FILES) {
      assert.truthy([256, 512].includes(f.px), f.name + ': px');
      assert.truthy(f.prompt && f.prompt.length > 20, f.name + ': prompt');
      assert.equal(M.pathFor(f.name), 'img/farm/' + f.name + '.webp');
    }
    assert.equal(M.FILES.find(f => f.name === 'barn').px, 512, '2x2 buildings are 512');
    assert.equal(M.FILES.find(f => f.name === 'tomato-day2').px, 256, 'crops are 256');
  });
});

suite('farm art: files on disk and in the service worker', () => {
  const dir = path.join(ROOT, 'img', 'farm');
  test('every manifest file exists', () => {
    const missing = M.FILES.filter(f => !fs.existsSync(path.join(ROOT, M.pathFor(f.name)))).map(f => f.name);
    assert.deepEqual(missing, [], 'run: python3 scripts/build-farm-art.py --placeholder');
  });
  test('img/farm/ holds nothing the manifest does not name', () => {
    const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.webp')) : [];
    const wanted = new Set(M.FILES.map(f => f.name + '.webp'));
    assert.deepEqual(onDisk.filter(f => !wanted.has(f)), []);
  });
  test('sw.js precaches every farm file and the two farm scripts', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    for (const f of M.FILES) assert.truthy(sw.includes(`'/${M.pathFor(f.name)}'`), 'sw.js lacks ' + f.name);
    assert.truthy(sw.includes("'/js/farm-rules.js'"));
    assert.truthy(sw.includes("'/js/farm-art-manifest.js'"));
  });
  test('index.html loads farm-rules before night-raid-rules; the manifest rides the farm lazy group', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.truthy(html.indexOf('js/farm-rules.js') > 0 && html.indexOf('js/farm-rules.js') < html.indexOf('js/night-raid-rules.js'));
    // Nothing on Home reads FarmArtManifest (it is the build/test contract for
    // img/farm), so it loads with the farm tab — after farm-rules, which it needs.
    assert.falsy(html.includes('src="js/farm-art-manifest.js"'), 'the manifest must not block the first paint');
    assert.truthy(require('../js/lazy-data.js').GROUP_FILES.farm.includes('js/farm-art-manifest.js'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
