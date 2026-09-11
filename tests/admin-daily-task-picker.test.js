// admin-daily-task-picker.test.js — the admin assigns a task the way a child
// finds it: Eng or Math, then the menu, then the sub-menu, as deep as the
// app goes, until a task is picked.
//
// Two halves. The catalog's tree() is pure and is checked as data: every
// task sits at exactly one path, the top menus are in the app's own order,
// and nothing is deeper than three sub-menus above the task. The admin
// page's cascade is EXECUTED: its functions are lifted out of admin.html
// into a vm with a stub DOM that understands just enough of the markup it
// writes, and a walk Math › Toán 7 › Học kì 2 › Luyện chương › Chương 6 must
// end with #dailyKind = 'math-chapter:6'.
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
    assert.deepEqual(eng.slice(0, 4), ['Vocabulary', 'Grade 4', 'Grammar', 'PTNK Exams']);
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

suite('admin page: the cascade picker, executed', () => {
  // Lift the picker's functions out of admin.html. They are plain top-level
  // functions between the "Daily task tab" banner and saveDailyTask.
  const html = read('admin.html');
  const start = html.indexOf('// ── Daily task tab');
  const end = html.indexOf('async function saveDailyTask');
  assert.truthy(start > 0 && end > start, 'picker functions not found in admin.html');
  const code = html.slice(start, end);

  function page() {
    const els = {};
    const mk = (id) => ({ id, innerHTML: '', value: '', textContent: '', dataset: {}, focus() {}, querySelectorAll() { return []; } });
    for (const id of ['dailyPath', 'dailyKind', 'dailyPathHint', 'dailyTarget']) els[id] = mk(id);
    // The host parses the <select>s it was handed, so a change can be fired
    // on one of them the way a real DOM would.
    els.dailyPath.querySelectorAll = () => [...els.dailyPath.innerHTML.matchAll(/<select class="daily-level" data-depth="(\d+)"/g)]
      .map(m => { const s = { dataset: { depth: m[1] }, value: '', onchange: null }; (els.dailyPath._selects = els.dailyPath._selects || []).push(s); return s; });
    const ctx = vm.createContext({
      document: { getElementById: (id) => els[id] || null, querySelector: () => els.dailyPath },
      DailyTaskCatalog: Catalog,
      esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
      console,
    });
    vm.runInContext(code + '\nglobalThis.__render = renderDailyPath; globalThis.__reset = resetDailyForm;', ctx);
    const selects = () => {
      els.dailyPath._selects = [];
      els.dailyPath.querySelectorAll();
      return els.dailyPath._selects;
    };
    const pick = (depth, value) => {
      // re-render happens inside onchange; find the live select for this depth
      const live = ctx.__lastSelects || [];
      const s = live.find(x => Number(x.dataset.depth) === depth);
      assert.truthy(s, 'no select at depth ' + depth);
      s.value = value; s.onchange();
    };
    // Capture the selects the page wired on each render.
    const origQSA = els.dailyPath.querySelectorAll;
    els.dailyPath.querySelectorAll = (...a) => { const r = origQSA(...a); ctx.__lastSelects = r; return r; };
    return { els, ctx, pick, selects };
  }

  test('a fresh form shows one select — Eng or Math — and no task', () => {
    const { els, ctx } = page();
    ctx.__reset();
    const depths = [...els.dailyPath.innerHTML.matchAll(/data-depth="(\d+)"/g)].map(m => m[1]);
    assert.deepEqual(depths, ['0']);
    assert.truthy(els.dailyPath.innerHTML.includes('› Eng') && els.dailyPath.innerHTML.includes('› Math'));
    assert.equal(els.dailyKind.value, '');
    assert.equal(els.dailyTarget.value, '5');
  });

  test('Math › Toán 7 › Học kì 2 › Luyện chương › Chương 6 ends with the task key', () => {
    const { els, ctx, pick } = page();
    ctx.__reset();
    pick(0, 'sub:Math');
    assert.truthy(els.dailyPath.innerHTML.includes('› Toán 7'));
    pick(1, 'sub:Toán 7');
    pick(2, 'sub:Học kì 2');
    assert.truthy(els.dailyPath.innerHTML.includes('› Luyện chương') && els.dailyPath.innerHTML.includes('› Đề thi'));
    pick(3, 'sub:Luyện chương');
    assert.truthy(els.dailyPath.innerHTML.includes('task:math-chapter:6'), 'the chapter tasks are listed');
    pick(4, 'task:math-chapter:6');
    assert.equal(els.dailyKind.value, 'math-chapter:6');
    assert.truthy(els.dailyPathHint.textContent.startsWith('✓ Math › Toán 7 › Học kì 2 › Luyện chương ›'));
  });

  test('a node with both sub-menus and tasks offers both (PTNK Exams)', () => {
    const { els, ctx, pick } = page();
    ctx.__reset();
    pick(0, 'sub:Eng'); pick(1, 'sub:PTNK Exams');
    const h = els.dailyPath.innerHTML;
    assert.truthy(h.includes('› 2024') && h.includes('task:ptnk:any'), 'years AND the any-paper task');
    pick(2, 'task:ptnk:any');
    assert.equal(els.dailyKind.value, 'ptnk:any');
  });

  test('changing an upper level throws away everything below it', () => {
    const { els, ctx, pick } = page();
    ctx.__reset();
    pick(0, 'sub:Math'); pick(1, 'sub:Toán 4'); pick(2, 'task:math4:pre');
    assert.equal(els.dailyKind.value, 'math4:pre');
    pick(0, 'sub:Eng');
    assert.equal(els.dailyKind.value, '', 'a task picked under Math must not survive a switch to Eng');
    const depths = [...els.dailyPath.innerHTML.matchAll(/data-depth="(\d+)"/g)].map(m => m[1]);
    assert.deepEqual(depths, ['0', '1']);
  });

  test('the form refuses to save without a task, and the old two-dropdown ids are gone', () => {
    assert.truthy(html.includes("if (!kind){ alert('Chọn bài bé sẽ làm"), 'saveDailyTask must refuse an empty kind');
    assert.falsy(html.includes('id="dailyGroup"'), 'the old group dropdown must be gone');
    assert.truthy(html.includes('<input type="hidden" id="dailyKind"'), 'the chosen key travels in the hidden input saveDailyTask reads');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
