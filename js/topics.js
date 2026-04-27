// topics.js - Word topic classification (Taxonomy B: Word-Class + Theme)
// 25 topics, multi-topic supported. Words tagged via index-range mapping
// with manual overrides for misfits and high-value multi-topic words.

const TOPICS = [
    { id: 'people',        name: 'People & Roles',         icon: '👤', color: '#FFB199' },
    { id: 'emotions',      name: 'Emotions & Feelings',    icon: '😊', color: '#FFD93D' },
    { id: 'personality',   name: 'Personality & Character',icon: '🎭', color: '#FF9F1C' },
    { id: 'communication', name: 'Communication',          icon: '🗣️', color: '#7AC74F' },
    { id: 'actions',       name: 'Actions & Movement',     icon: '🏃', color: '#06D6A0' },
    { id: 'thinking',      name: 'Thinking & Mind',        icon: '🤔', color: '#9B59B6' },
    { id: 'senses',        name: 'Perception & Senses',    icon: '👀', color: '#48CAE4' },
    { id: 'business',      name: 'Work & Business',        icon: '💼', color: '#118AB2' },
    { id: 'goals',         name: 'Goals & Achievement',    icon: '🎯', color: '#EF476F' },
    { id: 'society',       name: 'Society & Law',          icon: '⚖️', color: '#8D99AE' },
    { id: 'science',       name: 'Science & Research',     icon: '🧪', color: '#00B4D8' },
    { id: 'health',        name: 'Health & Body',          icon: '🏥', color: '#FF6B6B' },
    { id: 'environment',   name: 'Environment & Nature',   icon: '🌍', color: '#52B788' },
    { id: 'tech',          name: 'Technology & Digital',   icon: '💻', color: '#3A86FF' },
    { id: 'politics',      name: 'Politics & Government',  icon: '🏛️', color: '#6A4C93' },
    { id: 'education',     name: 'Education & Learning',   icon: '📚', color: '#F77F00' },
    { id: 'arts',          name: 'Arts & Culture',         icon: '🎨', color: '#E76F51' },
    { id: 'food',          name: 'Food & Cooking',         icon: '🍴', color: '#F4A261' },
    { id: 'home',          name: 'Home & Daily Life',      icon: '🏠', color: '#C77DFF' },
    { id: 'travel',        name: 'Travel & Transport',     icon: '🚗', color: '#2A9D8F' },
    { id: 'animals',       name: 'Animals & Plants',       icon: '🐾', color: '#80B918' },
    { id: 'time',          name: 'Time & Change',          icon: '⏰', color: '#A0572D' },
    { id: 'quantity',      name: 'Quantity & Measurement', icon: '🔢', color: '#577590' },
    { id: 'quality',       name: 'Quality & Description',  icon: '🌟', color: '#FFD60A' },
    { id: 'abstract',      name: 'Abstract Concepts',      icon: '💭', color: '#7B2CBF' }
];

// Word-index ranges → topic IDs. Inclusive `from`, exclusive `to`.
// Built from the section comments in vocabulary.js. Each range can map to 1+ topics.
const INDEX_RANGE_TOPICS = [
    // ===== BEGINNING (idx 0-111) =====
    { from: 0,    to: 12,   topics: ['home'] },                       // Buildings
    { from: 12,   to: 37,   topics: ['home', 'food'] },               // Kitchen & Dining
    { from: 37,   to: 52,   topics: ['home'] },                       // Bedroom
    { from: 52,   to: 67,   topics: ['home', 'health'] },             // Bathroom
    { from: 67,   to: 82,   topics: ['home'] },                       // Living Room
    { from: 82,   to: 97,   topics: ['home'] },                       // Household & Cleaning
    { from: 97,   to: 112,  topics: ['home'] },                       // House Parts

    // ===== BASIC (idx 112-361) =====
    { from: 112,  to: 162,  topics: ['quality', 'abstract'] },        // Everyday Essential (mostly adjectives)
    { from: 162,  to: 212,  topics: ['thinking', 'abstract'] },       // Basic Academic
    { from: 212,  to: 262,  topics: ['actions', 'communication'] },   // Verbs & Actions
    { from: 262,  to: 312,  topics: ['quality', 'personality'] },     // Adjectives & Qualities
    { from: 312,  to: 362,  topics: ['society', 'people'] },          // Society & Life

    // ===== INTERMEDIATE (idx 362-611) =====
    { from: 362,  to: 412,  topics: ['abstract', 'thinking'] },       // Intermediate Academic
    { from: 412,  to: 462,  topics: ['environment', 'science'] },     // Environment & Science
    { from: 462,  to: 512,  topics: ['health'] },                     // Health & Medicine
    { from: 512,  to: 562,  topics: ['business'] },                   // Business & Economics
    { from: 562,  to: 612,  topics: ['education'] },                  // Education & Learning

    // ===== UPPER-INTERMEDIATE (idx 612-811) =====
    { from: 612,  to: 662,  topics: ['tech'] },                       // Technology & Digital
    { from: 662,  to: 712,  topics: ['politics', 'society'] },        // Law & Politics
    { from: 712,  to: 762,  topics: ['arts'] },                       // Arts & Culture
    { from: 762,  to: 812,  topics: ['thinking', 'emotions', 'personality'] }, // Psychology & Behavior

    // ===== ADVANCED (idx 812-1111) =====
    { from: 812,  to: 862,  topics: ['abstract', 'thinking'] },       // Academic Writing
    { from: 862,  to: 912,  topics: ['abstract', 'science'] },        // Advanced Academic
    { from: 912,  to: 962,  topics: ['quality', 'abstract'] },        // Sophisticated Vocabulary
    { from: 962,  to: 1012, topics: ['abstract'] },                   // High-Level IELTS
    { from: 1012, to: 1062, topics: ['abstract'] },                   // Expert Level
    { from: 1062, to: 1112, topics: ['abstract'] },                   // Mastery Level

    // ===== IELTS 1001+ (idx 1112-1956) =====
    { from: 1112, to: 1187, topics: ['abstract', 'science'] },        // Academic IELTS x2
    { from: 1187, to: 1235, topics: ['business', 'abstract'] },       // Academic & Business
    { from: 1235, to: 1262, topics: ['science', 'thinking'] },        // Research & Analysis
    { from: 1262, to: 1275, topics: ['abstract'] },                   // Advanced Academic
    { from: 1275, to: 1323, topics: ['politics', 'society'] },        // Law & Governance
    { from: 1323, to: 1369, topics: ['thinking', 'abstract'] },       // Philosophy & Psychology
    { from: 1369, to: 1413, topics: ['education'] },                  // Education & Learning
    { from: 1413, to: 1457, topics: ['business'] },                   // Business & Economics
    { from: 1457, to: 1504, topics: ['environment'] },                // Environment & Nature
    { from: 1504, to: 1550, topics: ['health'] },                     // Health & Medicine
    { from: 1550, to: 1594, topics: ['tech'] },                       // Technology & Innovation
    { from: 1594, to: 1639, topics: ['arts', 'communication'] },      // Arts & Communication
    { from: 1639, to: 1676, topics: ['politics'] },                   // Politics & Diplomacy
    { from: 1676, to: 1720, topics: ['science', 'quantity'] },        // Research & Statistics
    { from: 1720, to: 1770, topics: ['society', 'science'] },         // Social Sciences & Anthropology
    { from: 1770, to: 1819, topics: ['society', 'home'] },            // Urban Planning & Architecture
    { from: 1819, to: 1864, topics: ['time', 'society'] },            // History & Heritage
    { from: 1864, to: 1909, topics: ['communication'] },              // Communication & Rhetoric
    { from: 1909, to: 1957, topics: ['abstract'] }                    // Advanced Academic
];

// Manual overrides for specific words that should belong to additional/different topics
// than their section default. Words not listed here use INDEX_RANGE_TOPICS only.
// Format: { wordEn: ['topic1', 'topic2', ...] } — REPLACES default topics
const WORD_TOPIC_OVERRIDES = {
    // Body parts in Bathroom section
    'mirror': ['home'],
    // Common multi-domain words
    'doctor': ['people', 'health'],
    'patient': ['people', 'health', 'personality'],
    'nurse': ['people', 'health'],
    'teacher': ['people', 'education'],
    'student': ['people', 'education'],
    'manager': ['people', 'business'],
    'leader': ['people', 'politics'],
    'lawyer': ['people', 'society'],
    'judge': ['people', 'society'],
    'engineer': ['people', 'tech'],
    'scientist': ['people', 'science'],
    'artist': ['people', 'arts'],
    'musician': ['people', 'arts'],
    'farmer': ['people', 'environment'],
    'soldier': ['people', 'society'],
    'president': ['people', 'politics'],
    'minister': ['people', 'politics'],
    'citizen': ['people', 'society'],
    'employee': ['people', 'business'],
    'employer': ['people', 'business'],
    'customer': ['people', 'business'],
    'neighbor': ['people'],
    'stranger': ['people'],
    'friend': ['people'],
    'family': ['people'],
    'parent': ['people'],
    'child': ['people'],
    'adult': ['people'],

    // Personality/character words (override Adjectives section)
    'humorous': ['personality'],
    'considerate': ['personality'],
    'talkative': ['personality', 'communication'],
    'generous': ['personality'],
    'shy': ['personality', 'emotions'],
    'confident': ['personality', 'emotions'],
    'honest': ['personality'],
    'reliable': ['personality'],
    'creative': ['personality', 'thinking'],
    'ambitious': ['personality', 'goals'],
    'curious': ['personality', 'thinking'],
    'cheerful': ['personality', 'emotions'],
    'optimistic': ['personality', 'emotions'],
    'pessimistic': ['personality', 'emotions'],
    'stubborn': ['personality'],
    'gentle': ['personality'],
    'rude': ['personality'],
    'polite': ['personality'],
    'aggressive': ['personality', 'emotions'],
    'kind': ['personality'],
    'friendly': ['personality'],
    'hardworking': ['personality', 'goals'],
    'lazy': ['personality'],
    'brave': ['personality'],

    // Emotion words
    'happy': ['emotions'],
    'sad': ['emotions'],
    'angry': ['emotions'],
    'scared': ['emotions'],
    'surprised': ['emotions'],
    'excited': ['emotions'],
    'nervous': ['emotions'],
    'jealous': ['emotions'],
    'proud': ['emotions'],
    'guilty': ['emotions'],
    'lonely': ['emotions'],
    'love': ['emotions'],
    'fear': ['emotions'],
    'hate': ['emotions'],
    'joy': ['emotions'],
    'sorrow': ['emotions'],
    'anger': ['emotions'],
    'anxiety': ['emotions'],
    'depression': ['emotions', 'health'],
    'happiness': ['emotions'],

    // Senses
    'see': ['senses', 'actions'],
    'hear': ['senses', 'actions'],
    'taste': ['senses', 'actions', 'food'],
    'smell': ['senses', 'actions'],
    'touch': ['senses', 'actions'],
    'feel': ['senses', 'emotions'],
    'observe': ['senses', 'thinking'],
    'watch': ['senses', 'actions'],
    'listen': ['senses', 'actions'],
    'notice': ['senses', 'thinking'],
    'perceive': ['senses', 'thinking'],

    // Communication words
    'speak': ['communication', 'actions'],
    'talk': ['communication', 'actions'],
    'discuss': ['communication'],
    'argue': ['communication'],
    'persuade': ['communication'],
    'debate': ['communication', 'politics'],
    'announce': ['communication'],
    'explain': ['communication'],
    'translate': ['communication'],
    'whisper': ['communication'],
    'shout': ['communication'],
    'praise': ['communication'],
    'criticize': ['communication'],
    'insult': ['communication'],
    'compliment': ['communication'],

    // Time words
    'year': ['time'],
    'month': ['time'],
    'week': ['time'],
    'day': ['time'],
    'hour': ['time'],
    'minute': ['time'],
    'second': ['time'],
    'morning': ['time'],
    'evening': ['time'],
    'night': ['time'],
    'change': ['time', 'actions'],
    'develop': ['time', 'actions'],
    'gradual': ['time', 'quality'],
    'sudden': ['time', 'quality'],
    'rapid': ['time', 'quality'],
    'slow': ['time', 'quality'],
    'eternal': ['time'],
    'temporary': ['time'],
    'permanent': ['time'],

    // Quantity words
    'number': ['quantity'],
    'amount': ['quantity'],
    'count': ['quantity', 'actions'],
    'increase': ['quantity', 'actions'],
    'decrease': ['quantity', 'actions'],
    'percentage': ['quantity'],
    'majority': ['quantity'],
    'minority': ['quantity'],
    'measure': ['quantity', 'actions'],
    'few': ['quantity'],
    'many': ['quantity'],
    'several': ['quantity'],
    'multiple': ['quantity'],
    'single': ['quantity'],
    'double': ['quantity'],
    'half': ['quantity'],
    'whole': ['quantity'],

    // Animals & Plants
    'dog': ['animals'],
    'cat': ['animals'],
    'bird': ['animals'],
    'fish': ['animals', 'food'],
    'tree': ['animals', 'environment'],
    'flower': ['animals', 'environment'],
    'plant': ['animals', 'environment'],
    'horse': ['animals'],
    'cow': ['animals'],
    'pig': ['animals'],
    'chicken': ['animals', 'food'],
    'sheep': ['animals'],

    // Travel & Transport
    'car': ['travel'],
    'bus': ['travel'],
    'train': ['travel'],
    'plane': ['travel'],
    'ship': ['travel'],
    'bike': ['travel'],
    'taxi': ['travel'],
    'airport': ['travel'],
    'station': ['travel'],
    'travel': ['travel', 'actions'],
    'journey': ['travel'],
    'tourist': ['travel', 'people'],
    'tourism': ['travel', 'business'],
    'abroad': ['travel'],
    'destination': ['travel'],

    // Goals
    'succeed': ['goals', 'actions'],
    'success': ['goals'],
    'fail': ['goals', 'actions'],
    'failure': ['goals'],
    'achieve': ['goals', 'actions'],
    'achievement': ['goals'],
    'plan': ['goals', 'thinking'],
    'goal': ['goals'],
    'target': ['goals'],
    'ambition': ['goals'],
    'effort': ['goals'],
    'attempt': ['goals', 'actions'],
    'reward': ['goals'],

    // Foods
    'apple': ['food'],
    'bread': ['food'],
    'rice': ['food'],
    'milk': ['food'],
    'water': ['food', 'environment'],
    'meat': ['food'],
    'vegetable': ['food'],
    'fruit': ['food'],
    'cook': ['food', 'actions'],
    'eat': ['food', 'actions'],
    'drink': ['food', 'actions'],
    'recipe': ['food'],
    'restaurant': ['food', 'business'],
    'meal': ['food'],
    'breakfast': ['food'],
    'lunch': ['food'],
    'dinner': ['food']
};

// Build word→topics index at startup. Returns array of topic IDs for each word index.
let _wordTopicsCache = null;
function buildWordTopicsIndex() {
    if (_wordTopicsCache) return _wordTopicsCache;
    if (typeof ieltsVocabulary === 'undefined') return null;

    _wordTopicsCache = ieltsVocabulary.map((w, idx) => {
        // 1. Manual override wins
        if (WORD_TOPIC_OVERRIDES[w.en]) return WORD_TOPIC_OVERRIDES[w.en];
        // 2. Fall back to index range
        const range = INDEX_RANGE_TOPICS.find(r => idx >= r.from && idx < r.to);
        return range ? [...range.topics] : ['abstract'];
    });
    return _wordTopicsCache;
}

// Returns topic IDs for the word at this vocab index
function getTopicsForWordIndex(idx) {
    const cache = buildWordTopicsIndex();
    return cache && cache[idx] ? cache[idx] : ['abstract'];
}

// Returns topic IDs for a specific word object (lookup by en)
function getTopicsForWord(wordEn) {
    if (WORD_TOPIC_OVERRIDES[wordEn]) return WORD_TOPIC_OVERRIDES[wordEn];
    if (typeof ieltsVocabulary === 'undefined') return ['abstract'];
    const idx = ieltsVocabulary.findIndex(w => w.en === wordEn);
    if (idx === -1) return ['abstract'];
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
    // Hide the difficulty tab container (kept for backwards compat with HTML)
    const diffTabs = document.getElementById('topicsDifficultyTabs');
    if (diffTabs) diffTabs.style.display = 'none';

    renderTopicsGrid();
}

function renderTopicsGrid() {
    const grid = document.getElementById('topicsGrid');
    if (!grid) return;
    // No filter — count all words across all levels
    const counts = getTopicCounts(null);

    grid.innerHTML = TOPICS.map(t => {
        const count = counts[t.id] || 0;
        const dimmed = count === 0 ? 'topic-card-empty' : '';
        return `
            <button class="topic-card ${dimmed}" style="--topic-color:${t.color}"
                    onclick="${count > 0 ? `openTopicDetail('${t.id}')` : ''}"
                    ${count === 0 ? 'disabled' : ''}>
                <div class="topic-card-icon">${t.icon}</div>
                <div class="topic-card-name">${t.name}</div>
                <div class="topic-card-count">${count} word${count !== 1 ? 's' : ''}</div>
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
    const diffTabs = document.getElementById('topicsDifficultyTabs');
    if (diffTabs) diffTabs.style.display = 'none';

    const detail = document.getElementById('topicsDetail');
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;

    // Chunk words into 5-word lessons, easy → hard
    const lessonChunks = [];
    for (let i = 0; i < words.length; i += wpl) {
        lessonChunks.push(words.slice(i, i + wpl));
    }

    // Build lesson cards
    const lessonsHTML = lessonChunks.map((chunk, idx) => {
        const previewWords = chunk.map(c => c.word.en).join(', ');
        const firstDiff = getDifficultyLabelForWordIdx(chunk[0].idx);
        const lastDiff = getDifficultyLabelForWordIdx(chunk[chunk.length - 1].idx);
        const diffBadge = firstDiff.label === lastDiff.label
            ? `${firstDiff.icon} ${firstDiff.label}`
            : `${firstDiff.icon} ${firstDiff.label} → ${lastDiff.icon} ${lastDiff.label}`;
        return `
            <div class="topic-lesson-card">
                <div class="topic-lesson-card-header">
                    <span class="topic-lesson-card-num">Lesson ${idx + 1}</span>
                    <span class="topic-lesson-card-diff">${diffBadge}</span>
                </div>
                <div class="topic-lesson-card-preview">${previewWords}</div>
                <button class="topic-lesson-start-btn" onclick="startTopicLessonChunk('${topicId}', ${idx})">
                    🚀 Start
                </button>
            </div>
        `;
    }).join('');

    detail.innerHTML = `
        <button class="topic-detail-back" onclick="renderTopicsHome()">‹ Back</button>
        <div class="topic-detail-header" style="--topic-color:${topic.color}">
            <div class="topic-detail-icon">${topic.icon}</div>
            <h2 class="topic-detail-name">${topic.name}</h2>
            <p class="topic-detail-meta">${words.length} words • ${lessonChunks.length} lesson${lessonChunks.length !== 1 ? 's' : ''} • Easy → Hard</p>
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

    _startTopicLessonWithWords(lessonWords, topicId);
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

    _startTopicLessonWithWords(lessonWords, topicId);
}

function _startTopicLessonWithWords(lessonWords, topicId) {

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
