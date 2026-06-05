// Extract every vocabulary list from js/grammar-lessons.js into a markdown
// study sheet (print/grammar/vocabulary.md).
//
// Usage: node scripts/export-grammar-vocab.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'js', 'grammar-lessons.js');
const OUT = path.join(ROOT, 'print', 'grammar', 'vocabulary.md');

// Load GRAMMAR_LESSONS by running the file in a vm sandbox
const code = fs.readFileSync(SRC, 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '; this.GRAMMAR_LESSONS = GRAMMAR_LESSONS;', ctx);
const units = ctx.GRAMMAR_LESSONS;

// Strip emoji from titles
function stripEmoji(s) {
    if (!s) return s;
    return String(s)
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '')
        .trim();
}

let totalWords = 0;
let totalLessons = 0;

const lines = [];
lines.push('# FlashLingo — Grammar Vocabulary');
lines.push('');
lines.push('> Every word from the Grammar tab → lesson vocabulary blocks, exported as a single study sheet.');
lines.push('');

// Master table of contents
lines.push('## Contents');
lines.push('');
for (const u of units) {
    const cleanTitle = stripEmoji(u.title);
    const slug = u.unitId.toLowerCase();
    let wordCount = 0;
    for (const l of u.lessons) {
        if (!l.vocabulary) continue;
        const groups = Array.isArray(l.vocabulary) ? l.vocabulary : [l.vocabulary];
        for (const g of groups) {
            if (g && g.words) wordCount += g.words.length;
        }
    }
    if (wordCount === 0) {
        lines.push(`- ${cleanTitle} — *(no vocabulary in lessons)*`);
    } else {
        lines.push(`- [${cleanTitle}](#${slug}) — **${wordCount} words**`);
    }
}
lines.push('');

// Per-unit sections
for (const u of units) {
    const cleanTitle = stripEmoji(u.title);
    let unitWords = 0;
    let unitGroups = 0;
    const unitLines = [];

    for (const l of u.lessons) {
        if (!l.vocabulary) continue;
        const groups = Array.isArray(l.vocabulary) ? l.vocabulary : [l.vocabulary];
        const lessonTitle = stripEmoji(l.title);
        let lessonHasContent = false;
        const lessonLines = [];

        for (const g of groups) {
            if (!g || !g.words || g.words.length === 0) continue;
            unitGroups++;
            lessonHasContent = true;
            lessonLines.push('');
            lessonLines.push(`#### ${g.title || 'Vocabulary'}`);
            lessonLines.push('');
            // Table format: 4 columns
            const cols = 4;
            for (let i = 0; i < g.words.length; i += cols) {
                const row = g.words.slice(i, i + cols);
                while (row.length < cols) row.push('');
                lessonLines.push(`| ${row.map(w => w || ' ').join(' | ')} |`);
                if (i === 0) {
                    lessonLines.push(`|${' --- |'.repeat(cols)}`);
                }
            }
            lessonLines.push('');
            if (g.note) {
                lessonLines.push(`> ${g.note}`);
                lessonLines.push('');
            }
            unitWords += g.words.length;
        }

        if (lessonHasContent) {
            unitLines.push(`### Lesson ${l.id} — ${lessonTitle}` + (l.page ? ` (p. ${l.page})` : ''));
            unitLines.push(...lessonLines);
            totalLessons++;
        }
    }

    // Only add the unit section if it has at least one word
    if (unitWords > 0) {
        lines.push(`## <a id="${u.unitId.toLowerCase()}"></a>${cleanTitle}`);
        lines.push('');
        if (u.intro) {
            lines.push(`*${u.intro}*`);
            lines.push('');
        }
        lines.push(`**${unitWords} words** across ${unitGroups} vocabulary group${unitGroups === 1 ? '' : 's'}.`);
        lines.push('');
        lines.push(...unitLines);
        lines.push('');
        lines.push('---');
        lines.push('');
        totalWords += unitWords;
    }
}

// Footer
lines.push('');
lines.push(`_Generated from \`js/grammar-lessons.js\` — ${totalWords} words across ${totalLessons} lessons in 11 units. Unit 12 (Tenses) has no vocabulary lists (it focuses on tense forms only)._`);
lines.push('');

const md = lines.join('\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md);

console.log(`Wrote ${OUT}`);
console.log(`  ${totalWords} words across ${totalLessons} lessons`);
console.log(`  ${md.length} bytes`);
