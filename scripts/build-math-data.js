#!/usr/bin/env node
// scripts/build-math-data.js — assemble js/math-data.js and js/math-lessons.js
// from the five per-chapter author files.
//
// Usage:
//   node scripts/build-math-data.js <dir-with-math-ch1..5.json>
//
// Validates every question before writing. A bad chapter fails the build
// rather than shipping a quiz where the "correct" answer is not among the
// options, or where every answer happens to be B.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHAPTERS = [1, 2, 3, 4, 5];
const PER_CHAPTER = 50;

// Both fields are rendered with innerHTML, and both contain bare "<" from the
// maths ("khi a < 0") — HTML5 only treats that as text by luck of the space
// after it, and one "a <b" would swallow the rest of the sentence. So every
// "<" that does not open a permitted tag is escaped.
//
// The permitted set DIFFERS by field, and getting that wrong is what shipped
// the Lý thuyết tab showing literal "<p>Chương I mở ra…" on screen:
//   - an explanation is one short paragraph: only <br> and <b>
//   - a lesson is a document: <p>, <h4>, lists and tables ARE its structure
const EXPLANATION_TAG = /^<\/?(?:br|b)\s*\/?>/i;
const LESSON_TAG = /^<\/?(?:p|h4|h5|ul|ol|li|b|i|br|table|tr|td|th|tbody|thead|strong|em)\s*\/?>/i;

function escapeStrayAngles(html, allowed) {
    const tag = allowed || EXPLANATION_TAG;
    let out = '';
    for (let i = 0; i < html.length; i++) {
        if (html[i] !== '<') { out += html[i]; continue; }
        const rest = html.slice(i);
        const m = tag.exec(rest);
        if (m) { out += m[0]; i += m[0].length - 1; }
        else out += '&lt;';
    }
    return out;
}

function fail(msg) {
    console.error('✗ ' + msg);
    process.exitCode = 1;
}

// Symbols a "calc" question may put on the keypad's context row, on top of the
// digits/comma/minus/slash/brackets that are always there. Anything outside
// this list is a typo the child would meet as a dead key.
const CALC_KEYS = ['^', '√', '°', '%', '×', ':', '|', 'π', '∠', '∥', '⊥'];
const CALC_KEYS_MAX = 4;

// Typed questions live in data.calc, NOT data.questions — the multiple-choice
// invariants (four options, answer spread across A-D) are meaningless here and
// the count check must keep seeing exactly 50 real MCQs per chapter.
function validateCalc(data, num) {
    const where = `chapter ${num} (calc)`;
    let ok = true;
    const seen = new Set();
    (data.calc || []).forEach((q, i) => {
        const id = `m${num}-c${i + 1}`;
        if (q.id !== id) { fail(`${where}: calc ${i + 1} has id "${q.id}", expected "${id}"`); ok = false; }
        if (seen.has(q.id)) { fail(`${where}: duplicate id ${q.id}`); ok = false; }
        seen.add(q.id);
        if (q.ch !== num) { fail(`${where}: ${q.id} has ch=${q.ch}`); ok = false; }
        if (q.options) { fail(`${where}: ${q.id} is typed — options would never be shown`); ok = false; }
        if (!q.q || !String(q.answer || '').trim()) {
            fail(`${where}: ${q.id} missing q or answer`); ok = false;
        }
        if (!/🔑/.test(q.explanation || '')) { fail(`${where}: ${q.id} explanation has no 🔑 rule`); ok = false; }
        if (!Array.isArray(q.keys)) { fail(`${where}: ${q.id} must declare keys[]`); ok = false; return; }
        if (q.keys.length > CALC_KEYS_MAX) {
            fail(`${where}: ${q.id} declares ${q.keys.length} extra keys (max ${CALC_KEYS_MAX})`); ok = false;
        }
        for (const k of q.keys) {
            if (CALC_KEYS.indexOf(k) === -1) { fail(`${where}: ${q.id} unknown key "${k}"`); ok = false; }
        }
        if (q.accept && !Array.isArray(q.accept)) { fail(`${where}: ${q.id} accept must be an array`); ok = false; }
    });
    return ok;
}

function validateChapter(data, num) {
    const where = `chapter ${num}`;
    let ok = true;
    const qs = data.questions || [];

    if (qs.length !== PER_CHAPTER) { fail(`${where}: ${qs.length} questions, expected ${PER_CHAPTER}`); ok = false; }
    if (!data.title || !data.icon) { fail(`${where}: missing title/icon`); ok = false; }
    if (!data.lesson || data.lesson.length < 300) { fail(`${where}: lesson missing or too short`); ok = false; }

    const seen = new Set();
    const spread = [0, 0, 0, 0];
    qs.forEach((q, i) => {
        const id = `m${num}-${i + 1}`;
        if (q.id !== id) { fail(`${where}: question ${i + 1} has id "${q.id}", expected "${id}"`); ok = false; }
        if (seen.has(q.id)) { fail(`${where}: duplicate id ${q.id}`); ok = false; }
        seen.add(q.id);
        if (q.ch !== num) { fail(`${where}: ${q.id} has ch=${q.ch}`); ok = false; }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
            fail(`${where}: ${q.id} needs exactly 4 options`); ok = false; return;
        }
        if (new Set(q.options).size !== 4) { fail(`${where}: ${q.id} has duplicate options`); ok = false; }
        if (!(q.correct >= 0 && q.correct <= 3)) { fail(`${where}: ${q.id} correct=${q.correct}`); ok = false; return; }
        if (q.options[q.correct] !== q.answer) {
            fail(`${where}: ${q.id} answer does not match options[${q.correct}]`); ok = false;
        }
        if (!q.q || !q.explanation) { fail(`${where}: ${q.id} missing q or explanation`); ok = false; }
        if (!/🔑/.test(q.explanation || '')) { fail(`${where}: ${q.id} explanation has no 🔑 rule`); ok = false; }
        spread[q.correct]++;
    });

    // A child notices when the answer is always B. Nothing subtle is required
    // here — just that no position is starved or dominant.
    spread.forEach((n, i) => {
        if (n < 8 || n > 17) { fail(`${where}: answer ${'ABCD'[i]} used ${n} times (want 8-17)`); ok = false; }
    });
    return ok;
}

function main() {
    const dir = process.argv[2];
    if (!dir) { console.error('usage: build-math-data.js <dir>'); process.exit(2); }

    const chapters = [];
    const questions = [];
    const lessons = [];
    let allOk = true;

    for (const num of CHAPTERS) {
        const file = path.join(dir, `math-ch${num}.json`);
        if (!fs.existsSync(file)) { fail(`missing ${file}`); allOk = false; continue; }
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!validateChapter(data, num)) allOk = false;
        if (!validateCalc(data, num)) allOk = false;

        chapters.push({ num: num, title: data.title, icon: data.icon });
        lessons.push({
            key: `ch${num}`, chapter: num, title: `Chương ${num} · ${data.title}`,
            icon: data.icon, content: escapeStrayAngles(data.lesson, LESSON_TAG)
        });
        for (const q of (data.questions || [])) {
            questions.push({
                id: q.id, ch: q.ch, topic: q.topic, q: q.q,
                options: q.options, correct: q.correct, answer: q.answer,
                explanation: escapeStrayAngles(q.explanation)
            });
        }
        for (const q of (data.calc || [])) {
            questions.push({
                id: q.id, ch: q.ch, topic: q.topic, type: 'calc', q: q.q,
                answer: q.answer, accept: q.accept || [], keys: q.keys,
                explanation: escapeStrayAngles(q.explanation)
            });
        }
    }

    if (!allOk) { console.error('\nbuild aborted — fix the chapters above'); process.exit(1); }

    fs.writeFileSync(path.join(ROOT, 'js', 'math-data.js'),
        '// math-data.js — GENERATED by scripts/build-math-data.js. Do not edit.\n' +
        `// Toán 7 – Tập 1: ${chapters.length} chương, ${questions.length} câu trắc nghiệm công thức.\n` +
        'const MATH_CHAPTERS = ' + JSON.stringify(chapters, null, 0) + ';\n' +
        'const MATH_QUESTIONS = ' + JSON.stringify(questions, null, 0) + ';\n\n' +
        "if (typeof module !== 'undefined' && module.exports) { module.exports = { MATH_CHAPTERS, MATH_QUESTIONS }; }\n");

    fs.writeFileSync(path.join(ROOT, 'js', 'math-lessons.js'),
        '// math-lessons.js — GENERATED by scripts/build-math-data.js. Do not edit.\n' +
        `// One revision lesson per chapter (${lessons.length}).\n` +
        'const MATH_LESSONS = ' + JSON.stringify(lessons, null, 0) + ';\n\n' +
        "if (typeof module !== 'undefined' && module.exports) { module.exports = { MATH_LESSONS }; }\n");

    console.log(`✓ ${chapters.length} chapters, ${questions.length} questions, ${lessons.length} lessons`);
    chapters.forEach(c => {
        const n = questions.filter(q => q.ch === c.num).length;
        console.log(`   ${c.icon} Chương ${c.num} · ${c.title} — ${n} câu`);
    });
}

module.exports = { escapeStrayAngles, validateChapter, PER_CHAPTER, EXPLANATION_TAG, LESSON_TAG };

if (require.main === module) main();
