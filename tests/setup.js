// tests/setup.js — Loads source JS files in a single sandbox; exposes top-level
// `const`/`let` bindings via a trailing export script that runs in the same scope.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function buildSandbox(opts) {
    opts = opts || {};

    // ── Enhanced DOM stub ──
    // Each call to getElementById('foo') returns a stable element so that
    // innerHTML writes can be observed across calls. This lets render
    // functions like `document.getElementById('grammarScreen').innerHTML = …`
    // be captured and asserted against, without needing a full JSDOM.
    const elementsById = {};
    const innerHTMLLog = {}; // id → last innerHTML string written

    function makeStubElement(idForTracking) {
        let _innerHTML = '';
        const el = {
            id: idForTracking || '',
            get innerHTML() { return _innerHTML; },
            set innerHTML(v) {
                _innerHTML = String(v);
                if (idForTracking) innerHTMLLog[idForTracking] = _innerHTML;
            },
            textContent: '',
            value: '',
            className: '',
            style: new Proxy({}, { get: () => '', set: () => true }),
            classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
            children: [],
            dataset: {},
            addEventListener: () => {},
            removeEventListener: () => {},
            appendChild: () => {},
            removeChild: () => {},
            insertBefore: () => {},
            remove: () => {},
            click: () => {},
            focus: () => {},
            getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
            setAttribute: () => {},
            getAttribute: () => null,
            cloneNode: () => makeStubElement(),
            querySelector: () => null,
            querySelectorAll: () => [],
            scrollTo: () => {},
            scrollIntoView: () => {}
        };
        el.parentNode = null;
        return el;
    }
    const documentMock = {
        getElementById: (id) => {
            if (!elementsById[id]) elementsById[id] = makeStubElement(id);
            return elementsById[id];
        },
        querySelector: () => makeStubElement(),
        querySelectorAll: () => [],
        createElement: () => makeStubElement(),
        body: makeStubElement('body'),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
    // Expose introspection helpers so tests can read what was rendered.
    documentMock.__getInnerHTMLLog = () => innerHTMLLog;
    documentMock.__getLastInnerHTML = (id) => innerHTMLLog[id] || null;
    documentMock.__clearInnerHTMLLog = () => {
        for (const k of Object.keys(innerHTMLLog)) delete innerHTMLLog[k];
    };
    const localStorageMock = (() => {
        const store = {};
        return {
            getItem: (k) => store[k] !== undefined ? store[k] : null,
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; },
            clear: () => { for (const k of Object.keys(store)) delete store[k]; }
        };
    })();
    const sandbox = {
        document: documentMock,
        localStorage: localStorageMock,
        navigator: { vibrate: () => {}, serviceWorker: { register: () => Promise.resolve(), getRegistrations: () => Promise.resolve([]) } },
        window: {},
        location: { reload: () => {} },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Date: Date,
        Math: Math,
        JSON: JSON,
        Object: Object,
        Array: Array,
        Set: Set,
        Map: Map,
        Promise: Promise,
        encodeURIComponent: encodeURIComponent,
        // App-level globals that are referenced but not core to the test
        showToast: () => {},
        unlockAchievement: () => {},
        saveUserData: () => {},
        renderWordPet: () => {},
        renderHome: () => {},
        renderShields: () => {},
        showStreakMilestone: () => {},
        showShieldSavedCelebration: () => {},
        feedPet: () => {},
        showPetSpeechBubble: () => {},
        renderMatchingRound: () => {},
        preloadLessonAudio: () => {},
        speakWord: () => {},
        createConfetti: () => {},
        showLevelUpCelebration: () => {},
        applyTheme: () => {},
        checkAccessoryUnlocks: () => {},
        offerSentenceBuilder: undefined,
        checkQuestCompletion: () => {},
        checkStickerUnlocks: () => {},
        showLessonCompleteUI: () => {},
        showComboIndicator: () => {},
        showComboBreak: () => {},
        currentUser: 'TestUser',
        appState: null
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    Object.assign(sandbox, opts.extraGlobals || {});
    return sandbox;
}

// Names we want to expose to tests. Populated lazily by inspecting source.
const EXPORT_NAMES = [
    // vocabulary.js
    'ieltsVocabulary', 'irregularVerbs',
    // topics.js
    'TOPICS', 'INDEX_RANGE_TOPICS', 'WORD_TOPIC_OVERRIDES', 'WORD_TOPIC_ADDITIONS',
    'getTopicsForWord', 'getTopicsForWordIndex', 'getWordsForTopic', 'getTopicCounts',
    'getTopicById', 'getDifficultyLabelForWordIdx', 'buildWordTopicsIndex',
    // srs.js
    'initWordSRS', 'updateWordSRS', 'getWordsDueForReview', 'getReviewCount',
    'getSRSMasteryPercent', 'startReviewSession',
    // srs.js — topic-aware SR (v3.26)
    'getDueWordsForTopic', 'getDueCountForTopic', 'getTrackedWordsForTopic',
    'getTopicSRSStats', 'getStrugglingWordsForTopic', 'getTopicOfTheDay',
    'isWordStruggling', 'startTopicReviewSession',
    'SRS_LEARNING_MAX', 'SRS_REVIEWING_MAX', 'SRS_MASTERED_INTERVAL', 'SRS_GRADUATED_INTERVAL',
    // app.js
    'WORDS_PER_LESSON', 'TOTAL_LESSONS', 'STREAK_MILESTONES', 'achievements',
    'createDefaultUserData', 'updateStreak', 'recordStudy', 'shuffleArray',
    // grammar
    'GRAMMAR_UNITS', 'getGrammarUnit', 'generateGrammarQuiz', 'getGrammarStats', 'saveGrammarSession',
    'isArrangementCorrect', 'scoreGrammarQuestion',
    'PDF_PAGE_REFS', 'getPdfPageRef', 'formatPdfPageRef',
    // grammar mistake bank (v3.24)
    'resolveMistakeQuestion', 'getActiveMistakes', 'getBookmarkedMistakes',
    'getWeakTopics', 'getGrammarAggregateStats',
    'toggleMistakeBookmark', 'isQuestionBookmarked',
    // grammar lessons (v3.25)
    'GRAMMAR_LESSONS', 'getGrammarLessonsForUnit', 'getGrammarLesson',
    'getLessonPracticeQuestions',
    // grammar UI render layer (loaded only when includeGrammarUI is true)
    'quizHeaderHTML', 'renderMCQuestion', 'renderArrangementQuestion',
    'renderGrammarQuestion', 'finishGrammarQuiz',
    'startMistakesQuiz', 'startCustomQuiz', 'startGrammarQuiz',
    'startTopicReviewSession',
    'nextGrammarQuestion', 'answerGrammarQuestion',
    'renderGrammarHome', 'renderGrammarLessons', 'openGrammarLesson',
    'practiceGrammarLesson', 'closeGrammarLesson',
    'switchGrammarSubTab', 'reviewLastGrammarSession',
    '_buildQuizStateFromQuestions', 'scoreSoFar_',
    // grammar UI — units collapse/expand (v3.32.2)
    'toggleGrammarUnitExpanded', 'expandAllGrammarUnits', 'collapseAllGrammarUnits',
    // grammar UI — lessons collapse/expand (v3.34)
    'toggleGrammarLessonUnitExpanded', 'expandAllGrammarLessonUnits', 'collapseAllGrammarLessonUnits',
    // (v3.38: word-bubbles game removed.)
    // daily streak modal (v3.37)
    'showDailyStreakModal', 'dismissStreakModal', 'dismissStreakModalAndStart',
    'hasShownStreakToday', 'markStreakShownToday',
    // homepage streak panel (v3.38)
    'renderHomeStreakPanel', 'goLearnToday',
    // home.js
    'BEGINNING_LESSONS', 'IELTS_PER_LEVEL',
    'getDifficultyLevel', 'getLessonRangeForDifficulty', 'getNextLessonForDifficulty',
    'getNextPracticeLesson', 'getReviewLessonGroups', 'getStreakTier', 'getNextMilestone',
    'getDogLevel', 'getPointsForLevel', 'getDogStage', 'getDogTitle',
    'STREAK_MILESTONE_DATA', 'DOG_STAGES', 'DOG_ACCESSORIES', 'DOG_FOOD',
    'getWeekStart', 'formatWeekRange', 'generateWeeklyRecap', 'getRecapMessage',
    'computeCurrentHunger', 'getPetMood', 'evaluatePoopSpawn',
    // daily-challenge
    'getDailyWords', 'seededRandom',
    // videos
    'VIDEO_LIBRARY', 'VIDEO_LEVELS', 'VIDEO_CATEGORIES',
    'IELTS_SPEAKING_VIDEO_SOURCES', 'IELTS_SPEAKING_VERIFIED_SOURCE_BY_LESSON',
    'IELTS_SPEAKING_CURRICULUM', 'IELTS_SPEAKING_LESSON_CONTENT',
    'IELTS_PART_FILTERS', 'IELTS_SPEAKING_CRITERIA', 'buildIELTSSpeakingLessons',
    'videoState', 'getVideoEmbedId', 'getVideoProgressId', 'getCourseVideos',
    'getIELTSPartKey', 'getFilteredVideos', 'filterIELTSPart',
    'getIELTSSpeakingPrompts', 'getIELTSSpeakingCheckpoints',
    'getIELTSSpeakingModelLines', 'getIELTSSpeakingFrames',
    'getIELTSSpeakingTimerConfig', 'getIELTSSpeakingVocabulary', 'getIELTSSpeakingQuiz',
    'getSpeakingCriteriaAverage', 'getSpeakingRatingOverall', 'getIELTSSpeakingProgressStats',
    'formatSpeakingTimer', 'getSpeakingRecorderHTML',
    'rateSpeakingCriterion', 'completeSpeakingPractice',
    'normalizeVideoStats', 'getVideoStats', 'saveVideoStats'
];

function loadAppCode(opts) {
    opts = opts || {};
    const sandbox = buildSandbox(opts);
    const ctx = vm.createContext(sandbox);

    const fileList = [
        'js/vocabulary.js',
        'js/topics.js',
        'js/srs.js',
        'js/grammar-units.js',
        'js/grammar-lessons.js',
        'js/app.js'
    ];
    if (opts.includeHome !== false) {
        fileList.push('js/home.js');
    }
    if (opts.includeDailyChallenge) {
        fileList.push('js/daily-challenge.js');
    }
    if (opts.includeVideos) {
        fileList.push('js/videos.js');
    }
    // Load the grammar UI render layer too. Required for any test that
    // exercises quizHeaderHTML / renderMCQuestion / finishGrammarQuiz / etc.
    if (opts.includeGrammarUI) {
        fileList.push('js/grammar-ui.js');
    }
    // (v3.38: Word Bubbles game removed — no includeBubbles option.)

    let combined = '';
    for (const f of fileList) {
        const abs = path.join(__dirname, '..', f);
        combined += '\n//===== ' + f + ' =====\n';
        combined += fs.readFileSync(abs, 'utf8');
    }
    // Trailing epilogue:
    // 1. Copy known names into a single export object on the sandbox.
    // 2. Expose setters for `let`-declared globals (appState, currentUser, lessonState, etc.)
    //    so tests can inject state into the script's lexical scope.
    const checks = EXPORT_NAMES.map(n =>
        `try { if (typeof ${n} !== 'undefined') globalThis.__exports.${n} = ${n}; } catch(e) {}`
    ).join('\n');
    combined += `
globalThis.__exports = {};
${checks}
globalThis.__setAppState = function(s) { try { appState = s; } catch(e) {} };
globalThis.__getAppState = function() { try { return appState; } catch(e) { return undefined; } };
globalThis.__setCurrentUser = function(u) { try { currentUser = u; } catch(e) {} };
globalThis.__setLessonState = function(s) { try { lessonState = s; } catch(e) {} };
globalThis.__getLessonState = function() { try { return lessonState; } catch(e) { return undefined; } };
globalThis.__setGrammarQuizState = function(s) { try { _grammarQuizState = s; } catch(e) {} };
globalThis.__getGrammarQuizState = function() { try { return _grammarQuizState; } catch(e) { return undefined; } };
`;

    try {
        vm.runInContext(combined, ctx, { filename: 'combined-app-code.js' });
    } catch (e) {
        console.error('Error loading app code:', e.message);
        if (e.stack) console.error(e.stack.split('\n').slice(0, 6).join('\n'));
        throw e;
    }
    // Sandbox now has __exports set
    return Object.assign({}, sandbox, sandbox.__exports);
}

module.exports = { buildSandbox, loadAppCode };
