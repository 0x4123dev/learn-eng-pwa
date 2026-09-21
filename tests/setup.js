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
            scrollIntoView: () => {},
            animate: () => ({ finished: Promise.resolve(), onfinish: null, cancel: () => {} })
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
    // wrong-priority.js
    'prioStore', 'prioStreak', 'prioRecord', 'prioForced', 'prioPick',
    // retrydrill.js
    'RETRY_DRILLS', 'retryList', 'retryCount', 'retryAdd', 'retryGate', 'startRetryDrill',
    'isRetryDrillActive', 'retryDrillKey', 'abandonRetryDrill',
    // units.js (the three Books)
    'UNIT_SETS', 'UNIT_HOSTS', 'unitsBank', 'unitsList', 'currentUnitSet', 'switchUnitSet',
    'startUnitPractice', 'submitUnitAnswer', 'nextUnitQuestion', 'finishUnitPractice',
    'isUnitPracticeActive', 'abandonUnitPractice', 'renderWordHome', 'renderUnitsBar',
    'unitPracticeScreen', 'unitsRetryCount', 'unitsHostHistory', '_unitParse',
    // app.js
    'STREAK_MILESTONES', 'achievements',
    'createDefaultUserData', 'updateStreak', 'recordStudy', 'shuffleArray',
    'appEsc', 'getUsers', 'getUserData', 'renderUserList',
    'switchScreen', 'openBook', 'navKeyForScreen', 'setBottomNavActive',
    // app.js — word audio (pre-generated recordings + TTS fallback)
    'WORD_AUDIO_PATH', 'wordAudioBase', 'wordAudioSlug', 'speakWord', 'speakWordFallback',
    'speakSequence', 'warmWord', 'warmHotWords',
    'audioMissing', 'audioCache',
    'prefetchAudio', 'preloadLessonAudio',
    // hosting.js
    'Hosting',
    // daily streak modal (v3.37)
    'showDailyStreakModal', 'dismissStreakModal', 'dismissStreakModalAndStart',
    'hasShownStreakToday', 'markStreakShownToday',
    // homepage streak panel (v3.38)
    'renderHomeStreakPanel', 'goLearnToday', 'renderHomeSkillsPanel', 'toggleHomeSkillsDetails',
    'goToSkillTab', 'HOME_BOOKS',
    // home.js
    'getStreakTier', 'getNextMilestone',
    'getDogLevel', 'getPointsForLevel', 'getDogStage', 'getDogTitle',
    'STREAK_MILESTONE_DATA', 'DOG_STAGES', 'DOG_ACCESSORIES', 'DOG_FOOD', 'PET_QUESTS',
    'getWeekStart', 'formatWeekRange', 'generateWeeklyRecap', 'getRecapMessage',
    'computeCurrentHunger', 'getPetMood', 'evaluatePoopSpawn', 'checkQuestCompletion',
    'getHomeSkillStats', '_homeSkillSessions', '_homeAllSessionsCount',
    // login + profile migration (money-client tests)
    'loginUser', 'getUserData', 'createDefaultUserData', 'saveUserData',
    'restoreStudyCheckpoint', 'forgetProfileState',
    // shop spend paths (money-invariants tests)
    'buyFood', 'buyAccessory', 'buyShield',
    // profile.js
    'renderProfile', 'unlockAchievement', 'checkStickerUnlocks', 'knownWordCount',
    'seededRandom',
];

function loadAppCode(opts) {
    opts = opts || {};
    const sandbox = buildSandbox(opts);
    const ctx = vm.createContext(sandbox);

    // Every eager script the app itself loads before js/home.js (index.html),
    // in that order, plus the profile screen. Tests that need a lazy bank
    // (js/word-data.js) load it themselves.
    const fileList = [
        'js/retrydrill.js',
        'js/wrong-priority.js',
        'js/answer-audio.js',
        'js/units.js',
        'js/tapwords.js',
        'js/petart.js',
        'js/petcheer.js',
        'js/farm-rules.js',
        'js/night-raid-rules.js',
        'js/hosting.js',
        'js/app.js'
    ];
    if (opts.includeHome !== false) {
        fileList.push('js/home.js');
        fileList.push('js/profile.js');
    }

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
globalThis.__setUnitQuiz = function(s) { try { _unitQuiz = s; } catch(e) {} };
globalThis.__getUnitQuiz = function() { try { return _unitQuiz; } catch(e) { return undefined; } };
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
