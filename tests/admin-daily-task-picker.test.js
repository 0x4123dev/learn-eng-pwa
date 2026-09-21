// admin-daily-task-picker.test.js — the admin assigns a task by searching
// for it (accents ignored, over label and path) or by browsing the same
// Book 1 / 2 / 3 tree a child walks.
//
// Two halves. The catalog's tree() is pure and is checked as data: every
// task sits at exactly one path, the top menus are the three Books in the
// app's own order, and each Book holds its units directly — there is no
// deeper level for the cascade to draw. The admin page's search is
// EXECUTED: searchTasks() and fold() are lifted out of admin.html into a
// vm and run against the real catalog.
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

  test('the root splits into Book 1, Book 2, Book 3, in that order', () => {
    assert.deepEqual(tree.children.map(c => c.label), ['Book 1', 'Book 2', 'Book 3']);
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

  test('each Book holds its 15 units and Mix directly — no sub-menus', () => {
    // The admin page draws one <details> per Book with the tasks inside it.
    // A deeper level would render, but it would be a menu with one entry.
    for (const book of tree.children) {
      assert.deepEqual(book.children, [], book.label + ' has sub-menus');
      assert.equal(book.entries.length, 16, book.label + ' should list 15 units + Mix');
      assert.truthy(/🎲 Mix$/.test(book.entries[15].label), book.label + ': Mix comes last');
      for (let i = 0; i < 15; i++) {
        assert.truthy(book.entries[i].label.includes('Unit ' + (i + 1) + ' ·'),
          book.label + ': entry ' + i + ' is ' + book.entries[i].label);
      }
    }
  });

  test('every node is worth stopping at: it has sub-menus or tasks', () => {
    walk(tree, (node, depth, trail) => {
      if (depth === 0) return;
      assert.truthy(node.children.length || node.entries.length, trail.join(' › ') + ' is an empty menu');
    });
  });

  test('the paths a parent would expect', () => {
    assert.deepEqual(Catalog.get('word:pr1-1').path, ['Book 1']);
    assert.deepEqual(Catalog.get('word:pr2-7').path, ['Book 2']);
    assert.deepEqual(Catalog.get('word:pr3-mix').path, ['Book 3']);
    assert.equal(Catalog.get('math4:cc'), null, 'the Math tasks are gone');
    assert.equal(Catalog.get('grammar:unit3:25'), null, 'so are the Grammar ones');
  });
});

suite('admin page: the task search, executed', () => {
  // The admin hands out a task by typing what she remembers of it — "book
  // 2", "unit 7", "marketing" — and the picker searches the whole catalog,
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

  test('"book 2" finds every Book 2 task, grouped under the Book a child would open', () => {
    const r = search('book 2');
    const g = r.groups.find(x => x.path === 'Book 2');
    assert.truthy(g, 'the Book 2 group is missing: ' + r.groups.map(x => x.path).join(' | '));
    assert.equal(g.items.length, 16, 'all 15 units and Mix, not a handful');
    assert.truthy(keys(r).includes('word:pr2-mix'), 'the Mix must be in the group');
    // Each word is a substring match, so "2" also reaches Unit 2 and Unit 12
    // of the other Books. That is the search's contract (a parent who types
    // "unit 2" wants exactly that); what must hold is that nothing without
    // a 2 in it sneaks in.
    for (const g2 of r.groups) for (const it of g2.items) {
      assert.truthy(/2/.test(g2.path + ' ' + it.entry.label), it.entry.key + ' matched "2" without one');
    }
  });

  test('accents are ignored on both sides: "markéting" still finds Marketing and PR', () => {
    assert.deepEqual(keys(search('markéting')), ['word:pr1-4']);
    assert.deepEqual(keys(search('MARKETING')), ['word:pr1-4'], 'and case does not matter');
  });

  test('every word must match somewhere in path or label — "unit 7" is Unit 7 of each Book', () => {
    const r = search('unit 7');
    assert.deepEqual(keys(r), ['word:pr1-7', 'word:pr2-7', 'word:pr3-7']);
    assert.deepEqual(keys(search('book 3 mix')), ['word:pr3-mix']);
  });

  test('a path word alone works: "book" reaches every task through its path', () => {
    // The label says "Book 2 · …" too, so the path is not the only route —
    // but the Mix rows are where it matters: "🎲 Mix" carries no unit title,
    // and a query for the Book must still find them.
    const r = search('book');
    assert.equal(r.matched, Catalog.all().length);
    const r3 = search('book 3');
    assert.equal(keys(r3).filter(k => /^word:pr3-/.test(k)).length, 16, 'all of Book 3');
    assert.truthy(keys(r3).includes('word:pr3-mix'));
  });

  test('an empty query matches the whole catalog, capped, and says how many were held back', () => {
    const r = search('', [], 20);
    assert.equal(r.shown, 20);
    assert.equal(r.matched, Catalog.all().length);
    assert.truthy(r.matched > r.shown);
  });

  test('a task the child already has is marked, not hidden', () => {
    const r = search('mix', ['word:pr1-mix']);
    const it = r.groups.flatMap(g => g.items).find(i => i.entry.key === 'word:pr1-mix');
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
    // The cascade renderer is recursive over node.children, and opens the
    // top level: with the Books holding their tasks directly, every task is
    // visible as soon as the tree view opens.
    assert.truthy(/const node = \(n, depth\) => `<details\$\{depth === 0 \? ' open' : ''\}>/.test(html),
      'the tree renderer must draw a node from its entries and recurse into children');
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
