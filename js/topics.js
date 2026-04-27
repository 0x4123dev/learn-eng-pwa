// topics.js - Word topic classification (Taxonomy B: Word-Class + Theme)
// 15 topics merged for guaranteed 100+ words each via aggressive multi-tagging.
// Multi-topic supported. Words tagged via index-range mapping + WORD_TOPIC_ADDITIONS.

const TOPICS = [
    { id: 'people',        name: 'People & Roles',          icon: '👤', color: '#FFB199' },
    { id: 'character',     name: 'Personality & Emotions',  icon: '🎭', color: '#FF9F1C' },
    { id: 'communication', name: 'Communication',           icon: '🗣️', color: '#7AC74F' },
    { id: 'actions',       name: 'Actions & Movement',      icon: '🏃', color: '#06D6A0' },
    { id: 'thinking',      name: 'Thinking & Mind',         icon: '🤔', color: '#9B59B6' },
    { id: 'business',      name: 'Work & Business',         icon: '💼', color: '#118AB2' },
    { id: 'society',       name: 'Society & Politics',      icon: '⚖️', color: '#8D99AE' },
    { id: 'science',       name: 'Science & Research',      icon: '🧪', color: '#00B4D8' },
    { id: 'health',        name: 'Health & Body',           icon: '🏥', color: '#FF6B6B' },
    { id: 'environment',   name: 'Environment & Nature',    icon: '🌍', color: '#52B788' },
    { id: 'tech',          name: 'Technology & Digital',    icon: '💻', color: '#3A86FF' },
    { id: 'education',     name: 'Education & Learning',    icon: '📚', color: '#F77F00' },
    { id: 'arts',          name: 'Arts & Culture',          icon: '🎨', color: '#E76F51' },
    { id: 'daily',         name: 'Daily Life',              icon: '🏠', color: '#C77DFF' },
    { id: 'quality',       name: 'Quality & Description',   icon: '🌟', color: '#FFD60A' }
];

// Word-index ranges → topic IDs. Inclusive `from`, exclusive `to`.
// Aggressive multi-tagging: most ranges map to 2-4 topics so every topic
// gets ≥100 words across the 1957-word vocabulary.
const INDEX_RANGE_TOPICS = [
    // ===== BEGINNING (idx 0-111) — Home & Household =====
    { from: 0,    to: 12,   topics: ['daily'] },                                       // Buildings
    { from: 12,   to: 37,   topics: ['daily'] },                                       // Kitchen & Dining
    { from: 37,   to: 52,   topics: ['daily'] },                                       // Bedroom
    { from: 52,   to: 67,   topics: ['daily', 'health'] },                             // Bathroom
    { from: 67,   to: 82,   topics: ['daily'] },                                       // Living Room
    { from: 82,   to: 97,   topics: ['daily', 'actions'] },                            // Household & Cleaning
    { from: 97,   to: 112,  topics: ['daily'] },                                       // House Parts

    // ===== BASIC (idx 112-361) =====
    { from: 112,  to: 162,  topics: ['quality', 'thinking', 'daily', 'actions'] },     // Everyday Essential
    { from: 162,  to: 212,  topics: ['thinking', 'education', 'communication', 'actions'] }, // Basic Academic
    { from: 212,  to: 262,  topics: ['actions', 'communication', 'thinking'] },        // Verbs & Actions
    { from: 262,  to: 312,  topics: ['quality', 'character'] },                        // Adjectives & Qualities
    { from: 312,  to: 362,  topics: ['society', 'people', 'character'] },              // Society & Life

    // ===== INTERMEDIATE (idx 362-611) =====
    { from: 362,  to: 412,  topics: ['thinking', 'education'] },                       // Intermediate Academic
    { from: 412,  to: 462,  topics: ['environment', 'science'] },                      // Environment & Science
    { from: 462,  to: 512,  topics: ['health', 'science'] },                           // Health & Medicine
    { from: 512,  to: 562,  topics: ['business', 'society'] },                         // Business & Economics
    { from: 562,  to: 612,  topics: ['education', 'thinking'] },                       // Education & Learning

    // ===== UPPER-INTERMEDIATE (idx 612-811) =====
    { from: 612,  to: 662,  topics: ['tech', 'science', 'communication'] },             // Technology & Digital
    { from: 662,  to: 712,  topics: ['society', 'people'] },                           // Law & Politics
    { from: 712,  to: 762,  topics: ['arts', 'communication'] },                       // Arts & Culture
    { from: 762,  to: 812,  topics: ['thinking', 'character', 'people'] },             // Psychology & Behavior

    // ===== ADVANCED (idx 812-1111) =====
    { from: 812,  to: 862,  topics: ['thinking', 'communication', 'education'] },      // Academic Writing
    { from: 862,  to: 912,  topics: ['thinking', 'science'] },                         // Advanced Academic
    { from: 912,  to: 962,  topics: ['quality', 'character'] },                        // Sophisticated Vocabulary
    { from: 962,  to: 1012, topics: ['thinking', 'communication'] },                   // High-Level IELTS
    { from: 1012, to: 1062, topics: ['thinking', 'quality'] },                         // Expert Level
    { from: 1062, to: 1112, topics: ['thinking', 'character'] },                       // Mastery Level

    // ===== IELTS 1001+ (idx 1112-1956) =====
    { from: 1112, to: 1187, topics: ['thinking', 'science', 'education'] },            // Academic IELTS x2
    { from: 1187, to: 1235, topics: ['business', 'society'] },                         // Academic & Business
    { from: 1235, to: 1262, topics: ['science', 'thinking', 'tech'] },                  // Research & Analysis
    { from: 1262, to: 1275, topics: ['thinking', 'education'] },                       // Advanced Academic
    { from: 1275, to: 1323, topics: ['society', 'people'] },                           // Law & Governance
    { from: 1323, to: 1369, topics: ['thinking', 'character', 'people'] },             // Philosophy & Psychology
    { from: 1369, to: 1413, topics: ['education', 'thinking'] },                       // Education & Learning
    { from: 1413, to: 1457, topics: ['business', 'society'] },                         // Business & Economics
    { from: 1457, to: 1504, topics: ['environment', 'science'] },                      // Environment & Nature
    { from: 1504, to: 1550, topics: ['health', 'science'] },                           // Health & Medicine
    { from: 1550, to: 1594, topics: ['tech', 'science'] },                             // Technology & Innovation
    { from: 1594, to: 1639, topics: ['arts', 'communication'] },                       // Arts & Communication
    { from: 1639, to: 1676, topics: ['society', 'people'] },                           // Politics & Diplomacy
    { from: 1676, to: 1720, topics: ['science', 'thinking'] },                         // Research & Statistics
    { from: 1720, to: 1770, topics: ['society', 'science', 'people'] },                // Social Sciences & Anthropology
    { from: 1770, to: 1819, topics: ['society', 'daily', 'environment'] },             // Urban Planning & Architecture
    { from: 1819, to: 1864, topics: ['society', 'arts'] },                             // History & Heritage
    { from: 1864, to: 1909, topics: ['communication', 'arts'] },                       // Communication & Rhetoric
    { from: 1909, to: 1957, topics: ['thinking', 'communication'] }                    // Advanced Academic
];

// Manual overrides — REPLACE the index-range topics for specific words.
// Used for words that don't fit their section's default topics (e.g., a verb
// in a noun section, or a word that's strongly multi-domain).
const WORD_TOPIC_OVERRIDES = {};

// Manual additions — UNION with the index-range topics. Use this to add
// extra topic tags to words that broadly fit multiple themes.
// Most words don't need this; the index ranges already cover ~95% of cases.
const WORD_TOPIC_ADDITIONS = {
    // Multi-domain academic words that span many topics
    'analysis':       ['thinking'],
    'research':       ['science', 'thinking'],
    'experiment':     ['science'],
    'hypothesis':     ['science', 'thinking'],
    'evidence':       ['science', 'thinking', 'society'],
    'theory':         ['science', 'thinking'],
    'data':           ['science', 'tech'],
    'method':         ['science', 'thinking'],
    'process':        ['science', 'thinking'],
    'concept':        ['thinking'],
    'principle':      ['thinking'],
    'philosophy':     ['thinking'],
    'logic':          ['thinking'],
    'reason':         ['thinking', 'communication'],
    'argument':       ['thinking', 'communication'],
    'opinion':        ['thinking', 'communication'],
    'belief':         ['thinking', 'character'],
    'attitude':       ['character', 'thinking'],
    'behavior':       ['character', 'people'],
    'culture':        ['society', 'arts', 'people'],
    'tradition':      ['society', 'arts'],
    'custom':         ['society'],
    'community':      ['society', 'people'],
    'population':     ['society', 'people'],
    'individual':     ['people', 'society'],
    'identity':       ['people', 'character'],
    'role':           ['people', 'society'],
    'relationship':   ['people', 'character'],
    'network':        ['people', 'tech', 'society'],
    'motivation':     ['character', 'thinking'],
    'emotion':        ['character'],
    'feeling':        ['character'],
    'mood':           ['character'],
    'stress':         ['character', 'health'],
    'happiness':      ['character'],
    'satisfaction':   ['character', 'business'],
    'confidence':     ['character'],
    'patience':       ['character'],
    'kindness':       ['character'],
    'courage':        ['character'],
    'wisdom':         ['character', 'thinking'],
    'health':         ['health'],
    'medicine':       ['health', 'science'],
    'disease':        ['health'],
    'illness':        ['health'],
    'symptom':        ['health'],
    'treatment':      ['health'],
    'therapy':        ['health'],
    'hospital':       ['health', 'daily'],
    'clinic':         ['health'],
    'surgery':        ['health'],
    'patient':        ['health', 'people'],
    'doctor':         ['health', 'people'],
    'nurse':          ['health', 'people'],
    'food':           ['daily', 'health'],
    'meal':           ['daily'],
    'cuisine':        ['daily', 'arts'],
    'nutrition':      ['health', 'daily'],
    'diet':           ['health', 'daily'],
    'environment':    ['environment'],
    'climate':        ['environment'],
    'pollution':      ['environment'],
    'ecosystem':      ['environment', 'science'],
    'sustainability': ['environment', 'society'],
    'biodiversity':   ['environment', 'science'],
    'species':        ['environment', 'science'],
    'habitat':        ['environment'],
    'wildlife':       ['environment'],
    'forest':         ['environment'],
    'ocean':          ['environment'],
    'computer':       ['tech'],
    'software':       ['tech'],
    'hardware':       ['tech'],
    'internet':       ['tech', 'communication'],
    'website':        ['tech', 'communication'],
    'application':    ['tech'],
    'algorithm':      ['tech', 'thinking'],
    'database':       ['tech'],
    'security':       ['tech', 'society'],
    'innovation':     ['tech', 'science'],
    'invention':      ['tech', 'science'],
    'school':         ['education', 'daily'],
    'student':        ['education', 'people'],
    'teacher':        ['education', 'people'],
    'university':     ['education'],
    'lecture':        ['education', 'communication'],
    'curriculum':     ['education'],
    'knowledge':      ['education', 'thinking'],
    'learning':       ['education', 'thinking'],
    'literature':     ['arts', 'communication'],
    'poetry':         ['arts', 'communication'],
    'novel':          ['arts'],
    'painting':       ['arts'],
    'music':          ['arts'],
    'theater':        ['arts'],
    'sculpture':      ['arts'],
    'dance':          ['arts'],
    'film':           ['arts', 'communication'],
    'museum':         ['arts'],
    'gallery':        ['arts'],
    'industry':       ['business', 'society'],
    'company':        ['business'],
    'corporation':    ['business'],
    'enterprise':     ['business'],
    'profit':         ['business'],
    'revenue':        ['business'],
    'investment':     ['business'],
    'market':         ['business', 'society'],
    'economy':        ['business', 'society'],
    'finance':        ['business'],
    'employee':       ['business', 'people'],
    'employer':       ['business', 'people'],
    'manager':        ['business', 'people'],
    'leader':         ['business', 'society', 'people'],
    'government':     ['society'],
    'policy':         ['society'],
    'law':            ['society'],
    'justice':        ['society'],
    'right':          ['society'],
    'freedom':        ['society'],
    'democracy':      ['society'],
    'election':       ['society'],
    'citizen':        ['society', 'people'],
    'history':        ['society', 'arts', 'thinking'],
    'heritage':       ['society', 'arts'],
    'civilization':   ['society', 'arts'],
    'tradition':      ['society', 'arts'],
    'language':       ['communication', 'arts'],
    'speech':         ['communication'],
    'conversation':   ['communication'],
    'discussion':     ['communication'],
    'debate':         ['communication', 'society'],
    'persuasion':     ['communication'],
    'rhetoric':       ['communication'],
    'metaphor':       ['communication', 'arts'],
    'narrative':      ['communication', 'arts']
};

// Build word→topics index at startup. Returns array of topic IDs for each word index.
let _wordTopicsCache = null;
function buildWordTopicsIndex() {
    if (_wordTopicsCache) return _wordTopicsCache;
    if (typeof ieltsVocabulary === 'undefined') return null;

    _wordTopicsCache = ieltsVocabulary.map((w, idx) => {
        let topics;
        // 1. Manual override REPLACES whatever the range says
        if (WORD_TOPIC_OVERRIDES[w.en]) {
            topics = [...WORD_TOPIC_OVERRIDES[w.en]];
        } else {
            // 2. Otherwise use index range
            const range = INDEX_RANGE_TOPICS.find(r => idx >= r.from && idx < r.to);
            topics = range ? [...range.topics] : ['thinking'];
        }
        // 3. ADDITIONS union with current topics (no duplicates)
        if (WORD_TOPIC_ADDITIONS[w.en]) {
            WORD_TOPIC_ADDITIONS[w.en].forEach(t => {
                if (!topics.includes(t)) topics.push(t);
            });
        }
        return topics;
    });
    return _wordTopicsCache;
}

// Returns topic IDs for the word at this vocab index
function getTopicsForWordIndex(idx) {
    const cache = buildWordTopicsIndex();
    return cache && cache[idx] ? cache[idx] : ['thinking'];
}

// Returns topic IDs for a specific word object (lookup by en)
function getTopicsForWord(wordEn) {
    if (WORD_TOPIC_OVERRIDES[wordEn]) return WORD_TOPIC_OVERRIDES[wordEn];
    if (typeof ieltsVocabulary === 'undefined') return ['thinking'];
    const idx = ieltsVocabulary.findIndex(w => w.en === wordEn);
    if (idx === -1) return ['thinking'];
    return getTopicsForWordIndex(idx);
}

// Get topic metadata by id
function getTopicById(topicId) {
    return TOPICS.find(t => t.id === topicId);
}

// Get all words for a topic, optionally filtered by difficulty key (lesson range)
// difficultyKey: 'beginning' | 'basic' | 'intermediate' | 'upper' | 'advanced' | null (all)
function getWordsForTopic(topicId, difficultyKey) {
    const cache = buildWordTopicsIndex();
    if (!cache) return [];

    let wordIdxRange = null;
    if (difficultyKey && typeof getLessonRangeForDifficulty === 'function') {
        const lessonRange = getLessonRangeForDifficulty(difficultyKey);
        const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
        wordIdxRange = {
            start: lessonRange.start * wpl,
            end: Math.min(lessonRange.end * wpl, ieltsVocabulary.length)
        };
    }

    const result = [];
    for (let i = 0; i < cache.length; i++) {
        if (!cache[i].includes(topicId)) continue;
        if (wordIdxRange && (i < wordIdxRange.start || i >= wordIdxRange.end)) continue;
        result.push({ word: ieltsVocabulary[i], idx: i });
    }
    return result;
}

// Get count of words per topic at a difficulty level (for badge display)
function getTopicCounts(difficultyKey) {
    const counts = {};
    TOPICS.forEach(t => {
        counts[t.id] = getWordsForTopic(t.id, difficultyKey).length;
    });
    return counts;
}

// ==================== TOPICS UI ====================
// Map word vocab index → rough difficulty label for display
function getDifficultyLabelForWordIdx(idx) {
    if (idx < 112) return { label: 'Beginning', icon: '🏠' };
    if (idx < 362) return { label: 'Basic', icon: '🌱' };
    if (idx < 612) return { label: 'Intermediate', icon: '🌿' };
    if (idx < 812) return { label: 'Upper-Int', icon: '🌳' };
    return { label: 'Advanced', icon: '⭐' };
}

function renderTopicsHome() {
    // Hide detail view if open
    const detail = document.getElementById('topicsDetail');
    if (detail) detail.innerHTML = '';
    const grid = document.getElementById('topicsGrid');
    if (grid) grid.style.display = 'grid';
    const reviewCard = document.getElementById('topicsReviewCard');
    if (reviewCard) reviewCard.style.display = 'block';

    renderReviewCard();
    renderTopicsGrid();
}

// Render the "Review Mistakes" card above the topics grid
function renderReviewCard() {
    const card = document.getElementById('topicsReviewCard');
    if (!card) return;
    const mistakes = (typeof appState !== 'undefined' && appState && appState.mistakes) ? appState.mistakes : [];
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;

    if (mistakes.length === 0) {
        card.innerHTML = `
            <div class="topics-review-empty">
                <span class="review-empty-icon">✨</span>
                <div class="review-empty-text">
                    <div class="review-empty-title">No mistakes yet!</div>
                    <div class="review-empty-sub">Keep learning — your mistakes will appear here</div>
                </div>
            </div>
        `;
        return;
    }
    const lessonCount = Math.ceil(mistakes.length / wpl);
    card.innerHTML = `
        <button class="topics-review-btn" onclick="openReviewDetail()">
            <span class="review-btn-icon">🔄</span>
            <div class="review-btn-text">
                <div class="review-btn-title">Review Mistakes</div>
                <div class="review-btn-sub">${mistakes.length} word${mistakes.length !== 1 ? 's' : ''} • ${lessonCount} lesson${lessonCount !== 1 ? 's' : ''}</div>
            </div>
            <span class="review-btn-arrow">›</span>
        </button>
    `;
}

function renderTopicsGrid() {
    const grid = document.getElementById('topicsGrid');
    if (!grid) return;
    // No filter — count all words across all levels
    const counts = getTopicCounts(null);
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    const progress = (typeof appState !== 'undefined' && appState && appState.topicProgress) ? appState.topicProgress : {};

    grid.innerHTML = TOPICS.map(t => {
        const count = counts[t.id] || 0;
        const dimmed = count === 0 ? 'topic-card-empty' : '';
        const totalLessons = Math.ceil(count / wpl);
        const tProgress = progress[t.id] || {};
        const doneLessons = Object.keys(tProgress).length;
        const allPerfect = doneLessons > 0 && Object.values(tProgress).every(p => p.mistakes === 0);
        const progressBadge = doneLessons > 0
            ? `<div class="topic-card-progress">${allPerfect ? '⭐' : '✓'} ${doneLessons}/${totalLessons}</div>`
            : '';
        return `
            <button class="topic-card ${dimmed}" style="--topic-color:${t.color}"
                    onclick="${count > 0 ? `openTopicDetail('${t.id}')` : ''}"
                    ${count === 0 ? 'disabled' : ''}>
                <div class="topic-card-icon">${t.icon}</div>
                <div class="topic-card-name">${t.name}</div>
                <div class="topic-card-count">${count} word${count !== 1 ? 's' : ''}</div>
                ${progressBadge}
            </button>
        `;
    }).join('');
}

function openTopicDetail(topicId) {
    const topic = getTopicById(topicId);
    if (!topic) return;
    // Always fetch ALL words across all levels — sorted easy→hard by vocab index
    const words = getWordsForTopic(topicId, null);
    if (words.length === 0) return;

    const grid = document.getElementById('topicsGrid');
    if (grid) grid.style.display = 'none';
    const reviewCard = document.getElementById('topicsReviewCard');
    if (reviewCard) reviewCard.style.display = 'none';

    const detail = document.getElementById('topicsDetail');
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;

    // Chunk words into 5-word lessons, easy → hard
    const lessonChunks = [];
    for (let i = 0; i < words.length; i += wpl) {
        lessonChunks.push(words.slice(i, i + wpl));
    }

    // Per-topic progress for lesson card status
    const topicProgress = (appState && appState.topicProgress && appState.topicProgress[topicId]) || {};

    // Build lesson cards
    const lessonsHTML = lessonChunks.map((chunk, idx) => {
        const previewWords = chunk.map(c => c.word.en).join(', ');
        const firstDiff = getDifficultyLabelForWordIdx(chunk[0].idx);
        const lastDiff = getDifficultyLabelForWordIdx(chunk[chunk.length - 1].idx);
        const diffBadge = firstDiff.label === lastDiff.label
            ? `${firstDiff.icon} ${firstDiff.label}`
            : `${firstDiff.icon} ${firstDiff.label} → ${lastDiff.icon} ${lastDiff.label}`;
        const status = topicProgress[idx];
        let statusBadge = '';
        let cardClass = '';
        let btnLabel = '🚀 Start';
        if (status) {
            if (status.mistakes === 0) {
                statusBadge = '<span class="topic-lesson-status status-perfect">⭐ Perfect</span>';
                cardClass = 'topic-lesson-perfect';
                btnLabel = '🔄 Replay';
            } else {
                statusBadge = `<span class="topic-lesson-status status-done">✓ Done · ${status.mistakes} mistake${status.mistakes !== 1 ? 's' : ''}</span>`;
                cardClass = 'topic-lesson-done';
                btnLabel = '🔄 Try Again';
            }
        }
        return `
            <div class="topic-lesson-card ${cardClass}">
                <div class="topic-lesson-card-header">
                    <span class="topic-lesson-card-num">Lesson ${idx + 1}</span>
                    <span class="topic-lesson-card-diff">${diffBadge}</span>
                </div>
                ${statusBadge}
                <div class="topic-lesson-card-preview">${previewWords}</div>
                <button class="topic-lesson-start-btn" onclick="startTopicLessonChunk('${topicId}', ${idx})">
                    ${btnLabel}
                </button>
            </div>
        `;
    }).join('');

    // Progress summary
    const doneCount = Object.keys(topicProgress).length;
    const perfectCount = Object.values(topicProgress).filter(p => p.mistakes === 0).length;
    const progressLine = doneCount > 0
        ? `<p class="topic-detail-progress">✓ ${doneCount}/${lessonChunks.length} done${perfectCount > 0 ? ` • ⭐ ${perfectCount} perfect` : ''}</p>`
        : '';

    detail.innerHTML = `
        <button class="topic-detail-back" onclick="renderTopicsHome()">‹ Back</button>
        <div class="topic-detail-header" style="--topic-color:${topic.color}">
            <div class="topic-detail-icon">${topic.icon}</div>
            <h2 class="topic-detail-name">${topic.name}</h2>
            <p class="topic-detail-meta">${words.length} words • ${lessonChunks.length} lesson${lessonChunks.length !== 1 ? 's' : ''} • Easy → Hard</p>
            ${progressLine}
        </div>
        <h3 class="topic-detail-list-title">📖 Lessons (sorted easy → harder)</h3>
        <div class="topic-lessons-list">
            ${lessonsHTML}
        </div>
        <h3 class="topic-detail-list-title">📚 All ${words.length} words</h3>
        <div class="topic-words-list">
            ${words.map(({ word, idx }) => {
                const d = getDifficultyLabelForWordIdx(idx);
                return `
                <div class="topic-word-item">
                    <span class="topic-word-emoji">${word.emoji || '📝'}</span>
                    <div class="topic-word-text">
                        <div class="topic-word-en">${word.en} <span class="topic-word-level">${d.icon}</span></div>
                        <div class="topic-word-vi">${word.vi}</div>
                    </div>
                    <button class="topic-word-speak" onclick="event.stopPropagation(); speakWord('${word.en.replace(/'/g, "\\'")}')">🔊</button>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==================== REVIEW MISTAKES VIEW ====================
// Returns mistake words sorted by count desc (most-wrong first)
function getMistakeWordObjects() {
    const mistakes = (appState && appState.mistakes) ? appState.mistakes : [];
    const sorted = [...mistakes].sort((a, b) => b.count - a.count);
    return sorted.map(m => {
        const word = ieltsVocabulary.find(w => w.en === m.word);
        return word ? { word, count: m.count, idx: ieltsVocabulary.indexOf(word) } : null;
    }).filter(Boolean);
}

function openReviewDetail() {
    const mistakes = getMistakeWordObjects();
    if (mistakes.length === 0) {
        showToast('No mistakes to review!');
        return;
    }

    const grid = document.getElementById('topicsGrid');
    if (grid) grid.style.display = 'none';
    const reviewCard = document.getElementById('topicsReviewCard');
    if (reviewCard) reviewCard.style.display = 'none';

    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    const chunks = [];
    for (let i = 0; i < mistakes.length; i += wpl) {
        chunks.push(mistakes.slice(i, i + wpl));
    }

    const lessonsHTML = chunks.map((chunk, idx) => {
        const previewWords = chunk.map(c => c.word.en).join(', ');
        const totalWrong = chunk.reduce((sum, c) => sum + c.count, 0);
        return `
            <div class="topic-lesson-card review-lesson-chunk">
                <div class="topic-lesson-card-header">
                    <span class="topic-lesson-card-num">Review ${idx + 1}</span>
                    <span class="topic-lesson-card-diff review-mistakes-badge">${totalWrong}× wrong</span>
                </div>
                <div class="topic-lesson-card-preview">${previewWords}</div>
                <button class="topic-lesson-start-btn" onclick="startReviewLessonChunk(${idx})">
                    🔄 Start Review
                </button>
            </div>
        `;
    }).join('');

    const detail = document.getElementById('topicsDetail');
    detail.innerHTML = `
        <button class="topic-detail-back" onclick="renderTopicsHome()">‹ Back</button>
        <div class="topic-detail-header" style="--topic-color:#9b59b6">
            <div class="topic-detail-icon">🔄</div>
            <h2 class="topic-detail-name">Review Mistakes</h2>
            <p class="topic-detail-meta">${mistakes.length} words • ${chunks.length} review lesson${chunks.length !== 1 ? 's' : ''}</p>
        </div>
        <h3 class="topic-detail-list-title">📖 Review Lessons (most missed first)</h3>
        <div class="topic-lessons-list">
            ${lessonsHTML}
        </div>
        <h3 class="topic-detail-list-title">📚 All ${mistakes.length} mistake words</h3>
        <div class="topic-words-list">
            ${mistakes.map(({ word, count, idx }) => {
                const d = getDifficultyLabelForWordIdx(idx);
                return `
                <div class="topic-word-item">
                    <span class="topic-word-emoji">${word.emoji || '📝'}</span>
                    <div class="topic-word-text">
                        <div class="topic-word-en">${word.en} <span class="topic-word-level">${d.icon}</span></div>
                        <div class="topic-word-vi">${word.vi} • <span class="review-wrong-count">${count}× wrong</span></div>
                    </div>
                    <button class="topic-word-speak" onclick="event.stopPropagation(); speakWord('${word.en.replace(/'/g, "\\'")}')">🔊</button>
                </div>
                `;
            }).join('')}
        </div>
        <button class="review-clear-all-btn" onclick="clearAllMistakesFromTopics()">Clear All Mistakes</button>
    `;
}

function startReviewLessonChunk(chunkIdx) {
    const mistakes = getMistakeWordObjects();
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    const start = chunkIdx * wpl;
    let lessonWords = mistakes.slice(start, start + wpl).map(m => m.word);
    if (lessonWords.length < 2) {
        showToast('Not enough words');
        return;
    }
    // Pad to wpl if needed
    if (lessonWords.length < wpl) {
        const existing = new Set(lessonWords.map(w => w.en));
        const fillers = ieltsVocabulary.filter(w => !existing.has(w.en));
        while (lessonWords.length < wpl && fillers.length) {
            const i = Math.floor(Math.random() * fillers.length);
            lessonWords.push(fillers.splice(i, 1)[0]);
        }
    }
    _startTopicLessonWithWords(lessonWords, '__review__');
}

function clearAllMistakesFromTopics() {
    if (!confirm('Clear all mistakes from review list?')) return;
    appState.mistakes = [];
    saveUserData(currentUser, appState);
    showToast('Mistakes cleared!');
    renderTopicsHome();
}

// Start a specific 5-word lesson chunk from a topic (chunkIdx is 0-based)
function startTopicLessonChunk(topicId, chunkIdx) {
    const topic = getTopicById(topicId);
    if (!topic) return;
    const allWords = getWordsForTopic(topicId, null);
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    const start = chunkIdx * wpl;
    let lessonWords = allWords.slice(start, start + wpl).map(x => x.word);

    if (lessonWords.length < 2) {
        showToast('Not enough words');
        return;
    }

    // Pad to wpl with random fillers if last lesson is short (matching needs exact pair count)
    if (lessonWords.length < wpl) {
        const existing = new Set(lessonWords.map(w => w.en));
        const fillers = ieltsVocabulary.filter(w => !existing.has(w.en));
        while (lessonWords.length < wpl && fillers.length) {
            const i = Math.floor(Math.random() * fillers.length);
            lessonWords.push(fillers.splice(i, 1)[0]);
        }
    }

    _startTopicLessonWithWords(lessonWords, topicId, chunkIdx);
}

// Old API kept for backwards compat — delegates to chunk-based starter
function startTopicLesson(topicId, shuffle) {
    const topic = getTopicById(topicId);
    if (!topic) return;
    const allWords = getWordsForTopic(topicId, null);
    if (allWords.length < 2) {
        showToast('Need at least 2 words for a lesson');
        return;
    }

    let pool = allWords.map(x => x.word);
    if (shuffle && typeof shuffleArray === 'function') {
        pool = shuffleArray([...pool]);
    }
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    let lessonWords = pool.slice(0, wpl);

    if (lessonWords.length < wpl) {
        const existing = new Set(lessonWords.map(w => w.en));
        const fillers = ieltsVocabulary.filter(w => !existing.has(w.en));
        while (lessonWords.length < wpl && fillers.length) {
            const i = Math.floor(Math.random() * fillers.length);
            lessonWords.push(fillers.splice(i, 1)[0]);
        }
    }

    _startTopicLessonWithWords(lessonWords, topicId, undefined);
}

function _startTopicLessonWithWords(lessonWords, topicId, chunkIdx) {

    lessonState = {
        lessonNumber: -10,             // Special marker for topic lesson
        words: lessonWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: lessonWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isPracticeSession: true,        // Reuse practice flow (no progression bookkeeping)
        isTopicLesson: true,
        topicId,
        topicChunkIdx: chunkIdx,
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('topicsScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.remove('active');

    if (typeof preloadLessonAudio === 'function') preloadLessonAudio(lessonWords);
    if (typeof renderMatchingRound === 'function') renderMatchingRound();
}
