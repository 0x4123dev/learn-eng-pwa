// topic-vocab.js - Topic-based vocabulary with visual cards

// ==================== SVG ILLUSTRATIONS ====================
const TOPIC_SVGS = {
    apartment: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="8" width="60" height="84" rx="3" fill="#5B8CCC"/>' +
        '<rect x="20" y="8" width="60" height="10" rx="3" fill="#4A7AB5"/>' +
        '<g fill="rgba(255,255,255,0.85)">' +
        '<rect x="28" y="24" width="9" height="8" rx="1"/><rect x="45" y="24" width="9" height="8" rx="1"/><rect x="62" y="24" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="38" width="9" height="8" rx="1"/><rect x="45" y="38" width="9" height="8" rx="1"/><rect x="62" y="38" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="52" width="9" height="8" rx="1"/><rect x="45" y="52" width="9" height="8" rx="1"/><rect x="62" y="52" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="66" width="9" height="8" rx="1"/><rect x="62" y="66" width="9" height="8" rx="1"/>' +
        '</g><rect x="43" y="66" width="14" height="18" rx="2" fill="#8B6914"/>' +
        '<rect x="45" y="52" width="9" height="8" rx="1" fill="#FFF3CD"/>' +
        '</svg>',

    dormitory: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="25" width="80" height="67" rx="3" fill="#B87333"/>' +
        '<rect x="10" y="25" width="80" height="12" rx="3" fill="#A0522D"/>' +
        '<g fill="rgba(255,255,255,0.8)">' +
        '<rect x="18" y="42" width="10" height="9" rx="1"/><rect x="34" y="42" width="10" height="9" rx="1"/><rect x="56" y="42" width="10" height="9" rx="1"/><rect x="72" y="42" width="10" height="9" rx="1"/>' +
        '<rect x="18" y="58" width="10" height="9" rx="1"/><rect x="34" y="58" width="10" height="9" rx="1"/><rect x="56" y="58" width="10" height="9" rx="1"/><rect x="72" y="58" width="10" height="9" rx="1"/>' +
        '</g><rect x="43" y="72" width="14" height="20" rx="2" fill="#654321"/>' +
        '<rect x="35" y="28" width="30" height="7" rx="2" fill="rgba(255,255,255,0.3)"/>' +
        '</svg>',

    villa: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="20" y="40" width="60" height="52" rx="2" fill="#FFF8DC"/>' +
        '<polygon points="15,42 50,15 85,42" fill="#CC4444"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="28" y="50" width="12" height="14" rx="1"/><rect x="60" y="50" width="12" height="14" rx="1"/>' +
        '</g><rect x="43" y="68" width="14" height="24" rx="2" fill="#8B6914"/>' +
        '<circle cx="54" cy="81" r="1.5" fill="#DAA520"/>' +
        '<circle cx="82" cy="70" r="8" fill="#228B22"/><circle cx="18" cy="72" r="6" fill="#228B22"/>' +
        '</svg>',

    mansion: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="35" width="80" height="57" rx="2" fill="#F5DEB3"/>' +
        '<polygon points="5,37 50,12 95,37" fill="#8B7355"/>' +
        '<rect x="25" y="37" width="4" height="40" fill="#D2B48C"/><rect x="40" y="37" width="4" height="40" fill="#D2B48C"/>' +
        '<rect x="56" y="37" width="4" height="40" fill="#D2B48C"/><rect x="71" y="37" width="4" height="40" fill="#D2B48C"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="30" y="45" width="9" height="11" rx="1"/><rect x="46" y="45" width="9" height="11" rx="1"/><rect x="61" y="45" width="9" height="11" rx="1"/>' +
        '</g><rect x="43" y="70" width="14" height="22" rx="2" fill="#654321"/>' +
        '<polygon points="43,23 50,16 57,23" fill="#DAA520"/>' +
        '</svg>',

    bungalow: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="15" y="50" width="70" height="42" rx="2" fill="#DEB887"/>' +
        '<polygon points="10,52 50,28 90,52" fill="#E67E22"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="22" y="58" width="14" height="12" rx="1"/><rect x="64" y="58" width="14" height="12" rx="1"/>' +
        '</g><rect x="43" y="62" width="14" height="28" rx="2" fill="#8B6914"/>' +
        '<circle cx="54" cy="77" r="1.5" fill="#DAA520"/>' +
        '</svg>',

    cottage: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="22" y="45" width="56" height="47" rx="2" fill="#D2B48C"/>' +
        '<polygon points="17,47 50,22 83,47" fill="#8B4513"/>' +
        '<rect x="66" y="22" width="8" height="20" rx="1" fill="#A0522D"/>' +
        '<ellipse cx="70" cy="18" rx="6" ry="4" fill="rgba(200,200,200,0.5)"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="30" y="54" width="12" height="12" rx="1"/><rect x="58" y="54" width="12" height="12" rx="1"/>' +
        '</g><rect x="43" y="68" width="14" height="24" rx="2" fill="#654321"/>' +
        '<rect x="28" y="80" width="6" height="4" fill="#FF6B6B"/><rect x="35" y="80" width="6" height="4" fill="#FFD93D"/>' +
        '</svg>',

    hut: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="25" y="50" width="50" height="42" rx="1" fill="#A0522D"/>' +
        '<polygon points="18,52 50,18 82,52" fill="#DAA520"/>' +
        '<line x1="50" y1="18" x2="30" y2="48" stroke="#C4A35A" stroke-width="2"/>' +
        '<line x1="50" y1="18" x2="70" y2="48" stroke="#C4A35A" stroke-width="2"/>' +
        '<rect x="40" y="65" width="14" height="27" rx="1" fill="#654321"/>' +
        '<rect x="58" y="60" width="8" height="8" rx="1" fill="rgba(255,255,255,0.4)"/>' +
        '</svg>',

    basement: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="40" width="100" height="4" fill="#8B7355"/>' +
        '<rect x="20" y="10" width="60" height="32" rx="2" fill="#DEB887"/>' +
        '<polygon points="15,12 50,0 85,12" fill="#CC4444"/>' +
        '<g fill="rgba(135,206,250,0.7)"><rect x="30" y="18" width="10" height="10" rx="1"/><rect x="60" y="18" width="10" height="10" rx="1"/></g>' +
        '<rect x="20" y="44" width="60" height="50" rx="2" fill="#708090"/>' +
        '<g fill="rgba(255,255,255,0.3)">' +
        '<rect x="28" y="52" width="9" height="7" rx="1"/><rect x="45" y="52" width="9" height="7" rx="1"/><rect x="62" y="52" width="9" height="7" rx="1"/>' +
        '</g>' +
        '<rect x="42" y="64" width="16" height="30" rx="1" fill="#556B7F"/>' +
        '<text x="50" y="80" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="10">B</text>' +
        '</svg>',

    castle: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="25" y="30" width="50" height="62" rx="1" fill="#A9A9A9"/>' +
        '<rect x="10" y="20" width="20" height="72" rx="1" fill="#808080"/>' +
        '<rect x="70" y="20" width="20" height="72" rx="1" fill="#808080"/>' +
        '<g fill="#696969"><rect x="10" y="14" width="5" height="8"/><rect x="18" y="14" width="5" height="8"/><rect x="25" y="14" width="5" height="8"/>' +
        '<rect x="70" y="14" width="5" height="8"/><rect x="78" y="14" width="5" height="8"/><rect x="85" y="14" width="5" height="8"/></g>' +
        '<polygon points="40,30 50,18 60,30" fill="#A9A9A9"/>' +
        '<rect x="43" y="60" width="14" height="32" rx="6 6 0 0" fill="#654321"/>' +
        '<g fill="rgba(255,255,255,0.3)"><rect x="32" y="40" width="8" height="10" rx="1"/><rect x="60" y="40" width="8" height="10" rx="1"/></g>' +
        '<line x1="20" y1="10" x2="20" y2="4" stroke="#666" stroke-width="1.5"/><polygon points="20,4 26,7 20,7" fill="#CC4444"/>' +
        '</svg>',

    temple: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="15" y="60" width="70" height="32" rx="2" fill="#DC143C"/>' +
        '<rect x="20" y="40" width="60" height="22" rx="2" fill="#B22222"/>' +
        '<rect x="28" y="25" width="44" height="17" rx="2" fill="#DC143C"/>' +
        '<polygon points="12,62 50,45 88,62" fill="#FFD700"/>' +
        '<polygon points="18,42 50,28 82,42" fill="#FFD700"/>' +
        '<polygon points="26,27 50,14 74,27" fill="#FFD700"/>' +
        '<rect x="43" y="70" width="14" height="22" rx="2" fill="#8B0000"/>' +
        '<g fill="rgba(255,255,255,0.3)"><rect x="22" y="68" width="8" height="8" rx="1"/><rect x="70" y="68" width="8" height="8" rx="1"/></g>' +
        '</svg>',

    church: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="40" width="60" height="52" rx="2" fill="#F5F5DC"/>' +
        '<polygon points="15,42 50,22 85,42" fill="#4169E1"/>' +
        '<rect x="45" y="8" width="10" height="35" rx="1" fill="#F5F5DC"/>' +
        '<rect x="42" y="4" width="16" height="4" rx="1" fill="#FFD700"/>' +
        '<line x1="50" y1="0" x2="50" y2="8" stroke="#FFD700" stroke-width="2"/>' +
        '<line x1="45" y1="5" x2="55" y2="5" stroke="#FFD700" stroke-width="2"/>' +
        '<rect x="43" y="70" width="14" height="22" rx="2" fill="#8B6914"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="28" y="50" width="10" height="14" rx="4"/><rect x="62" y="50" width="10" height="14" rx="4"/>' +
        '</g>' +
        '<circle cx="50" cy="34" r="3" fill="#FFD700"/>' +
        '</svg>',

    manor: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="30" y="35" width="40" height="55" rx="2" fill="#F5DEB3"/>' +
        '<rect x="5" y="45" width="28" height="45" rx="2" fill="#EED9B7"/>' +
        '<rect x="67" y="45" width="28" height="45" rx="2" fill="#EED9B7"/>' +
        '<polygon points="27,37 50,18 73,37" fill="#8B4513"/>' +
        '<polygon points="3,47 19,35 35,47" fill="#A0522D"/>' +
        '<polygon points="65,47 81,35 97,47" fill="#A0522D"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="37" y="44" width="8" height="10" rx="1"/><rect x="55" y="44" width="8" height="10" rx="1"/>' +
        '<rect x="11" y="54" width="7" height="9" rx="1"/><rect x="73" y="54" width="7" height="9" rx="1"/>' +
        '</g>' +
        '<rect x="44" y="65" width="12" height="23" rx="2" fill="#654321"/>' +
        '</svg>'
};

// ==================== HOUSE VOCABULARY DATA ====================
const TOPIC_HOUSE_VOCAB = [
    { en: 'apartment', ipa: '/əˈpɑːrtmənt/', vi: 'căn hộ', emoji: '🏢', color: '#E3F2FD',
      ex: 'She lives in a small apartment downtown.' },
    { en: 'dormitory', ipa: '/ˈdɔːrmɪtɔːri/', vi: 'ký túc xá', emoji: '🏫', color: '#FBE9E7',
      ex: 'The students share a dormitory room.' },
    { en: 'villa', ipa: '/ˈvɪlə/', vi: 'biệt thự', emoji: '🏡', color: '#E8F5E9',
      ex: 'They rented a villa by the beach.' },
    { en: 'mansion', ipa: '/ˈmænʃən/', vi: 'dinh thự', emoji: '🏛️', color: '#FFF8E1',
      ex: 'The mansion has twenty rooms.' },
    { en: 'bungalow', ipa: '/ˈbʌŋɡəloʊ/', vi: 'nhà một tầng', emoji: '🏠', color: '#FFF3E0',
      ex: 'They bought a cozy bungalow near the lake.' },
    { en: 'cottage', ipa: '/ˈkɑːtɪdʒ/', vi: 'nhà tranh nhỏ', emoji: '🏘️', color: '#EFEBE9',
      ex: 'The cottage is in the countryside.' },
    { en: 'hut', ipa: '/hʌt/', vi: 'túp lều', emoji: '🛖', color: '#F3E5F5',
      ex: 'The fisherman lived in a small hut.' },
    { en: 'basement', ipa: '/ˈbeɪsmənt/', vi: 'tầng hầm', emoji: '⬇️', color: '#ECEFF1',
      ex: 'The basement is used for storage.' },
    { en: 'castle', ipa: '/ˈkæsəl/', vi: 'lâu đài', emoji: '🏰', color: '#E8EAF6',
      ex: 'The old castle sits on a hill.' },
    { en: 'temple', ipa: '/ˈtempəl/', vi: 'đền', emoji: '⛩️', color: '#FCE4EC',
      ex: 'They visited an ancient temple.' },
    { en: 'church', ipa: '/tʃɜːrtʃ/', vi: 'nhà thờ', emoji: '⛪', color: '#E1F5FE',
      ex: 'The church bells ring every Sunday.' },
    { en: 'manor', ipa: '/ˈmænər/', vi: 'trang viên', emoji: '🏡', color: '#F1F8E9',
      ex: 'The lord lived in the manor house.' }
];

// ==================== TOPIC VIEW RENDERING ====================
function renderTopicView() {
    const lessonStartCard = document.getElementById('lessonStartCard');
    const historySection = document.querySelector('.section-title + .lesson-history')?.previousElementSibling;

    // Hide regular lesson sections
    document.querySelectorAll('.section-title').forEach(el => el.style.display = 'none');
    document.getElementById('lessonHistory').style.display = 'none';
    const mistakesContainer = document.getElementById('mistakesContainer');
    if (mistakesContainer) mistakesContainer.style.display = 'none';
    const historyTabs = document.querySelector('.history-tabs');
    if (historyTabs) historyTabs.style.display = 'none';
    const reviewCard = document.getElementById('reviewCard');
    if (reviewCard) reviewCard.style.display = 'none';

    // Build the topic cards grid
    let cardsHTML = '<div class="topic-cards-grid">';
    TOPIC_HOUSE_VOCAB.forEach((word, i) => {
        const svg = TOPIC_SVGS[word.en] || '';
        cardsHTML += `
            <div class="topic-card" style="background:${word.color}" onclick="speakWord('${word.en}')">
                <div class="topic-card-img">${svg}</div>
                <div class="topic-card-word">${word.en}</div>
                <div class="topic-card-ipa">${word.ipa}</div>
                <div class="topic-card-vi">${word.vi}</div>
            </div>
        `;
    });
    cardsHTML += '</div>';

    // Practice buttons (split into groups of 6)
    cardsHTML += `
        <div class="topic-practice-section">
            <button class="topic-practice-btn" onclick="startTopicPractice(0)">
                🎯 Practice 1-6
            </button>
            <button class="topic-practice-btn" onclick="startTopicPractice(1)">
                🎯 Practice 7-12
            </button>
            <button class="topic-practice-btn topic-practice-all" onclick="startTopicPractice(-1)">
                ⚡ Practice All (Random 5)
            </button>
        </div>
    `;

    lessonStartCard.style.background = 'transparent';
    lessonStartCard.style.boxShadow = 'none';
    lessonStartCard.style.padding = '0';
    lessonStartCard.innerHTML = cardsHTML;
}

// ==================== TOPIC PRACTICE (MATCHING GAME) ====================
function startTopicPractice(groupIndex) {
    let practiceWords;

    if (groupIndex === -1) {
        // Random 5 from all
        practiceWords = shuffleArray([...TOPIC_HOUSE_VOCAB]).slice(0, 5);
    } else if (groupIndex === 0) {
        practiceWords = TOPIC_HOUSE_VOCAB.slice(0, 6);
    } else {
        practiceWords = TOPIC_HOUSE_VOCAB.slice(6, 12);
    }

    // Ensure at least 2 words
    if (practiceWords.length < 2) return;

    lessonState = {
        lessonNumber: -2, // Special marker for topic practice
        words: practiceWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: practiceWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isPracticeSession: true,
        isTopicPractice: true,
        _startTime: Date.now(),
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    preloadLessonAudio(practiceWords);
    renderMatchingRound();
}

// ==================== RESTORE TOPIC VIEW STATE ====================
function restoreNormalView() {
    // Re-show sections hidden by topic view
    document.querySelectorAll('.section-title').forEach(el => el.style.display = '');
    document.getElementById('lessonHistory').style.display = '';
    const mistakesContainer = document.getElementById('mistakesContainer');
    if (mistakesContainer) mistakesContainer.style.display = '';
    const historyTabs = document.querySelector('.history-tabs');
    if (historyTabs) historyTabs.style.display = '';

    // Reset lesson start card styling
    const lessonStartCard = document.getElementById('lessonStartCard');
    lessonStartCard.style.boxShadow = '';
    lessonStartCard.style.padding = '';
}
