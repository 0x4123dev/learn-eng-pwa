// admin-daily-task-picker.test.js — the admin assigns a task by searching
// for it (accents ignored, over label and path) or by browsing the same
// Eng / Math tree a child walks.
//
// Two halves. The catalog's tree() is pure and is checked as data: every
// task sits at exactly one path, the top menus are in the app's own order,
// and nothing is deeper than three sub-menus above the task. The admin
// page's search is EXECUTED: searchTasks() and fold() are lifted out of
// admin.html into a vm and run against the real catalog.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));

suite('daily-task catalog: the tree', () => {
  const tree = Catalog.tree();
  const walk = (node, fn, depth = 0, trail = []) => {
    fn(node, depth, trail);
    node.children.forEach(c => walk(c, fn, depth + 1, trail.concat([c.label])));
  };

  test('the root splits into Eng and Math, in that order', () => {
    assert.deepEqual(tree.children.map(c => c.label), ['Eng', 'Math']);
  });

  test('every task sits at exactly one path, and the path is its own', () => {
    const seen = new Map();
    walk(tree, (node, depth, trail) => {
      for (const e of node.entries) {
        assert.falsy(seen.has(e.key), e.key + ' appears twice in the tree');
        seen.set(e.key, trail);
        assert.deepEqual(e.path, trail, e.key + ': path and tree position disagree');
      }
    });
    for (const e of Catalog.all()) assert.truthy(seen.has(e.key), e.key + ' is unreachable in the tree');
  });

  test('no task is deeper than three sub-menus below Eng / Math', () => {
    let deepest = 0;
    walk(tree, (node, depth) => { if (node.entries.length) deepest = Math.max(deepest, depth); });
    assert.truthy(deepest <= 4, 'a task sits ' + deepest + ' levels down — the picker was promised at most 3 sub-menus');
  });

  test('every node is worth stopping at: it has sub-menus or tasks', () => {
    walk(tree, (node, depth, trail) => {
      if (depth === 0) return;
      assert.truthy(node.children.length || node.entries.length, trail.join(' › ') + ' is an empty menu');
    });
  });

  test('Eng menus follow the Learn hub; Math follows the Math tab', () => {
    const eng = tree.children[0].children.map(c => c.label);
    assert.deepEqual(eng.slice(0, 5), ['Vocabulary', 'Grade 4', 'Word', 'Grammar', 'PTNK Exams']);
    assert.truthy(eng.indexOf('Reading') < eng.indexOf('Cloze') && eng.indexOf('Cloze') < eng.indexOf('Error Correction'));
    assert.deepEqual(tree.children[1].children.map(c => c.label), ['Toán 7', 'Toán 4', 'Math Wars']);
  });

  test('the paths a parent would expect', () => {
    assert.deepEqual(Catalog.get('math-chapter:6').path, ['Math', 'Toán 7', 'Học kì 2', 'Luyện chương']);
    assert.deepEqual(Catalog.get('math-exam:hk1-exam2').path, ['Math', 'Toán 7', 'Học kì 1', 'Đề thi']);
    assert.deepEqual(Catalog.get('math4:ccd89').path, ['Math', 'Toán 4', 'Bảng cửu chương']);
    assert.deepEqual(Catalog.get('grammar:unit3:25').path, ['Eng', 'Grammar', 'Unit 3: Places']);
    assert.deepEqual(Catalog.get('ptnk:ptnk-2024-kc').path, ['Eng', 'PTNK Exams', '2024']);
    assert.deepEqual(Catalog.get('ptnk:any').path, ['Eng', 'PTNK Exams']);
    assert.deepEqual(Catalog.get('reading:ch').path, ['Eng', 'Reading']);
    assert.deepEqual(Catalog.get('units:hk1-3').path, ['Eng', 'Grade 4', 'HK1']);
  });
});

suite('admin page: the task search, executed', () => {
  // The admin hands out a task by typing what she remembers of it — "hk2",
  // "cuu chuong", "tenses" — and the picker searches the whole catalog,
  // accents ignored, over the label AND the path a child would walk. The
  // functions are lifted out of admin.html by name and run for real.
  const html = read('admin.html');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const pick = (name) => {
    const start = script.indexOf('function ' + name + '(');
    if (start < 0) throw new Error(name + ' not found in admin.html');
    return script.slice(start, script.indexOf('\n}', start) + 2);
  };
  const ctx = vm.createContext({ String, Set, Map });
  vm.runInContext([pick('fold'), pick('searchTasks')].join('\n') + '\nthis.searchTasks = searchTasks;', ctx);
  const search = (q, assigned, limit) => ctx.searchTasks(q, Catalog.all(), assigned || [], limit);
  const keys = (r) => r.groups.flatMap(g => g.items.map(i => i.entry.key));

  test('"hk2" finds every Toán 7 HK2 paper, grouped under the path a child would walk', () => {
    const r = search('hk2');
    const g = r.groups.find(x => x.path === 'Math › Toán 7 › Học kì 2 › Đề thi');
    assert.truthy(g, 'the HK2 exam group is missing: ' + r.groups.map(x => x.path).join(' | '));
    assert.truthy(g.items.some(i => i.entry.key === 'math-exam:any-hk2'), 'the "bất kỳ" paper must be in the group');
    assert.truthy(g.items.length > 10, 'all the HK2 papers, not a handful');
  });

  test('accents are ignored on both sides: "cuu chuong" finds Bảng cửu chương', () => {
    const r = search('cuu chuong');
    assert.truthy(keys(r).includes('math4:cc'), 'the folded query must match the accented label');
    assert.truthy(keys(search('Bảng CỬU chương')).includes('math4:cc'), 'and an accented query matches too');
  });

  test('every word must match somewhere in path or label — "grammar 12" is Unit 12 only', () => {
    const r = search('grammar 12');
    assert.truthy(r.matched > 0);
    for (const k of keys(r)) assert.truthy(/^grammar:unit12/.test(k), k + ' is not Unit 12');
  });

  test('a path word alone works: "toán 7 luyện chương" lists the chapters', () => {
    const r = search('toan 7 luyen chuong');
    assert.truthy(keys(r).includes('math-chapter:6'));
    assert.truthy(keys(r).includes('math-chapter:1'));
  });

  test('an empty query matches the whole catalog, capped, and says how many were held back', () => {
    const r = search('', [], 20);
    assert.equal(r.shown, 20);
    assert.equal(r.matched, Catalog.all().length);
    assert.truthy(r.matched > r.shown);
  });

  test('a task the child already has is marked, not hidden', () => {
    const r = search('đề thi hk2', ['math-exam:any-hk2']);
    const it = r.groups.flatMap(g => g.items).find(i => i.entry.key === 'math-exam:any-hk2');
    assert.truthy(it, 'the assigned task must still be listed');
    assert.equal(it.assigned, true);
    assert.truthy(r.groups.flatMap(g => g.items).some(i => !i.assigned), 'others stay assignable');
  });

  test('nonsense matches nothing, cleanly', () => {
    const r = search('xyzzy plugh');
    assert.deepEqual(r.groups, []);
    assert.equal(r.matched, 0);
  });

  test('the page wires the search to the picker and has one target box the server agrees with', () => {
    assert.truthy(html.includes('id="taskSearch"'), 'no search box');
    assert.truthy(/getElementById\('taskSearch'\)\.addEventListener\('input'/.test(html), 'typing must re-render');
    assert.truthy(/DailyTaskCatalog\.tree\(\)/.test(html), 'the browse mode walks the catalog tree');
    const client = html.match(/id="dailyTarget"[^>]*max="(\d+)"/);
    const server = read('functions/api/_daily-task.js').match(/export const MAX_TARGET = (\d+);/);
    assert.truthy(client && server, 'both caps must exist');
    assert.equal(Number(client[1]), Number(server[1]));
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
