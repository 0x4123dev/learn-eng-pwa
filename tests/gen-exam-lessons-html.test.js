// gen-exam-lessons-html.test.js — content-quality characterization of the
// Exam→Lessons data (js/exam-lessons.js): HTML hygiene (balanced tags for the
// full tag vocabulary actually used, no scripts, no leaked markdown, no inline
// event handlers), id/title/icon shape, and strict qRef discipline (exact
// partition of questions 1..40).
// Complements tests/exam-lessons.test.js which covers existence + coverage.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function load(file, name) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    return vm.runInNewContext(code + '\n;' + name + ';', {}, { filename: file });
}
const LESSONS = load('exam-lessons.js', 'EXAM1_LESSONS');

function count(str, re) {
    return (str.match(re) || []).length;
}

// Every paired tag actually used by the lesson content today. <br> is void.
const PAIRED_TAGS = ['b', 'i', 'p', 'h4', 'ul', 'li', 'table', 'tr', 'td', 'th'];

// ── per-lesson HTML hygiene ────────────────────────────────────────────────
suite('gen: exam-lessons HTML hygiene', () => {
    for (const l of LESSONS) {
        test(`${l.id} content is clean, fully balanced HTML mentioning Đề 1`, () => {
            const c = l.content;
            for (const tag of PAIRED_TAGS) {
                assert.equal(
                    count(c, new RegExp('<' + tag + '(?=[\\s>])', 'g')),
                    count(c, new RegExp('</' + tag + '>', 'g')),
                    `${l.id} has unbalanced <${tag}>`);
            }
            assert.inRange(count(c, /<h4>/g), 4, 6,
                `${l.id} <h4> section count outside the observed 4..6 band`);
            assert.falsy(/<script/i.test(c), `${l.id} content contains <script`);
            assert.falsy(c.includes('## '), `${l.id} content leaks a markdown header`);
            assert.falsy(c.includes('undefined') || c.includes('[object Object]'),
                `${l.id} content contains template-junk text`);
            assert.truthy(c.includes('Đề 1'), `${l.id} content never mentions Đề 1`);
            assert.truthy(c.length >= 4000,
                `${l.id} content suspiciously short (${c.length} chars, min observed 4483)`);
        });
    }
});

// ── per-lesson identity + qRef discipline ──────────────────────────────────
suite('gen: exam-lessons ids, titles, icons, qRefs', () => {
    LESSONS.forEach((l, i) => {
        test(`${l.id} has sequential id, emoji icon, title, ascending qRefs in 1..40`, () => {
            assert.truthy(/^l\d{2}$/.test(l.id), `id ${l.id} not in lNN format`);
            assert.equal(l.id, 'l' + String(i + 1).padStart(2, '0'),
                `id out of sequence at index ${i}`);
            assert.truthy(typeof l.icon === 'string' && /[^\x00-\x7F]/.test(l.icon),
                `${l.id} icon is not an emoji-like non-ASCII string`);
            assert.inRange(l.icon.length, 1, 3,
                `${l.id} icon code-unit length outside observed 1..3`);
            assert.truthy(typeof l.title === 'string' && l.title.trim().length >= 10,
                `${l.id} title missing or shorter than the observed minimum`);
            assert.truthy(Array.isArray(l.qRefs) && l.qRefs.length >= 1,
                `${l.id} has no qRefs`);
            for (const n of l.qRefs) {
                assert.truthy(Number.isInteger(n), `${l.id} qRef ${n} not an integer`);
                assert.inRange(n, 1, 40, `${l.id} qRef ${n} outside 1..40`);
            }
            for (let k = 1; k < l.qRefs.length; k++) {
                assert.truthy(l.qRefs[k] > l.qRefs[k - 1],
                    `${l.id} qRefs not strictly ascending at index ${k}`);
            }
        });
    });
});

// ── whole-set invariants ───────────────────────────────────────────────────
suite('gen: exam-lessons set invariants', () => {
    test('there are exactly 18 lessons (l01..l18)', () => {
        assert.equal(LESSONS.length, 18);
    });

    test('ids are exactly l01..l18 in order', () => {
        const expected = [];
        for (let n = 1; n <= 18; n++) expected.push('l' + String(n).padStart(2, '0'));
        assert.deepEqual(LESSONS.map(l => l.id), expected);
    });

    test('every question 1..40 is referenced by exactly one lesson', () => {
        const all = LESSONS.flatMap(l => l.qRefs);
        assert.equal(all.length, 40, 'expected 40 qRefs total (no overlaps)');
        assert.equal(new Set(all).size, 40, 'qRefs duplicated across lessons');
        const sorted = [...all].sort((a, b) => a - b);
        assert.deepEqual(sorted, Array.from({ length: 40 }, (_, i) => i + 1));
    });

    test('icons are unique across all lessons', () => {
        assert.equal(new Set(LESSONS.map(l => l.icon)).size, LESSONS.length);
    });

    test('titles are unique across all lessons', () => {
        assert.equal(new Set(LESSONS.map(l => l.title)).size, LESSONS.length);
    });

    test('no lesson content leaks markdown bold (**)', () => {
        const offenders = LESSONS.filter(l => l.content.includes('**')).map(l => l.id);
        assert.deepEqual(offenders, []);
    });

    test('tag vocabulary is exactly the observed whitelist (no h1-h3/div/span/ol/a/img)', () => {
        const WHITELIST = ['b', 'br', 'h4', 'i', 'li', 'p', 'table', 'td', 'th', 'tr', 'ul'];
        const seen = new Set();
        for (const l of LESSONS) {
            for (const m of l.content.matchAll(/<\/?([a-z0-9]+)/gi)) {
                seen.add(m[1].toLowerCase());
            }
        }
        assert.deepEqual([...seen].sort(), WHITELIST);
    });

    test('no tag carries inline event handlers, javascript: URIs, or style attrs', () => {
        for (const l of LESSONS) {
            assert.falsy(/<[^>]*\son\w+\s*=/i.test(l.content),
                `${l.id} has an inline on*= event handler`);
            assert.falsy(/javascript:/i.test(l.content),
                `${l.id} contains a javascript: URI`);
            assert.falsy(/<[^>]*\sstyle\s*=/i.test(l.content),
                `${l.id} carries an inline style attribute`);
        }
    });

    test('only <table> tags carry attributes, and only border/cellpadding/cellspacing', () => {
        for (const l of LESSONS) {
            for (const m of l.content.matchAll(/<([a-z0-9]+)([^>]*)>/gi)) {
                const attrs = m[2].trim();
                if (!attrs) continue;
                assert.equal(m[1].toLowerCase(), 'table',
                    `${l.id}: <${m[1]}> unexpectedly carries attributes: ${attrs}`);
                const names = [...attrs.matchAll(/([a-z]+)\s*=/gi)].map(a => a[1].toLowerCase());
                for (const n of names) {
                    assert.contains(['border', 'cellpadding', 'cellspacing'], n,
                        `${l.id}: unexpected <table> attribute ${n}`);
                }
            }
        }
    });

    test('total <h4> sections across the set is 75', () => {
        const total = LESSONS.reduce((s, l) => s + count(l.content, /<h4>/g), 0);
        assert.equal(total, 75);
    });

    test('l01 and l04 are the only lessons with more than 4 <h4> sections (5 and 6)', () => {
        const byId = Object.fromEntries(
            LESSONS.map(l => [l.id, count(l.content, /<h4>/g)]));
        assert.equal(byId.l01, 5);
        assert.equal(byId.l04, 6);
        const others = LESSONS.filter(l => l.id !== 'l01' && l.id !== 'l04')
            .filter(l => count(l.content, /<h4>/g) !== 4).map(l => l.id);
        assert.deepEqual(others, []);
    });

    test('multi-question lessons cover reading (l15: Câu 23-28) and writing (l18: Câu 37-40)', () => {
        const l15 = LESSONS.find(l => l.id === 'l15');
        const l18 = LESSONS.find(l => l.id === 'l18');
        assert.deepEqual(l15.qRefs, [23, 24, 25, 26, 27, 28]);
        assert.deepEqual(l18.qRefs, [37, 38, 39, 40]);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
