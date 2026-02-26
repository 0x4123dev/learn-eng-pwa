// essays-reader.js - Essays rendering and reader functionality

let currentEssayWordEl = null;
let activeSentenceEl = null;
let floatingBubble = null;

function renderEssays() {
    const container = document.getElementById('essaysCategoriesList');
    const readEssays = appState.readEssays || [];
    let html = '';

    essayLevels.forEach(lvl => {
        const levelEssays = essays.filter(e => e.level === lvl.id);
        const readCount = levelEssays.filter(e => readEssays.includes(e.id)).length;
        const progressPct = levelEssays.length > 0 ? Math.round(readCount / levelEssays.length * 100) : 0;

        html += `
        <div class="essays-category">
            <div class="essays-category-header">
                <div class="essays-category-icon" style="background: ${lvl.color}20;">${lvl.icon}</div>
                <div style="flex:1;">
                    <div class="essays-category-title">${lvl.title}</div>
                    <div class="essays-category-count">${lvl.subtitle}</div>
                    <div class="essay-level-progress">
                        <div class="essay-level-progress-bar" style="width: ${progressPct}%; background: ${lvl.color};"></div>
                    </div>
                    <div class="essay-level-progress-text" style="color: ${lvl.color};">${readCount}/${levelEssays.length} read</div>
                </div>
            </div>
            ${levelEssays.map(essay => {
                const wordCount = essay.content.split(/\s+/).length;
                const isRead = readEssays.includes(essay.id);
                return `
                <div class="essay-card ${isRead ? 'essay-card-read' : ''}" onclick="openEssayReader(${essay.id})">
                    <div class="essay-card-top">
                        <div class="essay-card-title">${isRead ? '<span class="essay-read-check">&#10003;</span> ' : ''}${essay.title}</div>
                        <div class="essay-card-meta">
                            <span class="essay-card-school">${essay.school}</span>
                            <span class="essay-word-count">${wordCount} words</span>
                        </div>
                    </div>
                    <div class="essay-card-author">by ${essay.author}</div>
                    <div class="essay-card-tags">
                        ${essay.tags.map(t => `<span class="essay-tag" style="background: ${lvl.color}15; color: ${lvl.color};">${t}</span>`).join('')}
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    });

    container.innerHTML = html;
}

function openEssayReader(essayId) {
    const essay = essays.find(e => e.id === essayId);
    if (!essay) return;

    // Mark as read
    if (!appState.readEssays) appState.readEssays = [];
    if (!appState.readEssays.includes(essayId)) {
        appState.readEssays.push(essayId);
        saveUserData(currentUser, appState);
    }

    document.getElementById('essayReaderTitle').textContent = essay.title;
    document.getElementById('essayReaderAuthor').textContent = `${essay.author} — ${essay.school}`;

    // Split content into paragraphs and words
    const paragraphs = essay.content.split('\n\n').filter(p => p.trim());
    const savedWords = appState.essayWords || {};

    let bodyHtml = '';
    let sentenceIdx = 0;
    paragraphs.forEach(para => {
        bodyHtml += '<div class="essay-paragraph">';
        // Split paragraph into sentences (keep delimiters)
        const sentences = para.split(/(?<=[.!?])\s+/);
        sentences.forEach(sentence => {
            const sid = sentenceIdx++;
            const dataText = sentence.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            bodyHtml += `<span class="essay-sentence" data-sid="${sid}" data-text="${dataText}">`;
            const tokens = sentence.split(/(\s+)/);
            tokens.forEach(token => {
                if (/^\s+$/.test(token)) {
                    bodyHtml += ' ';
                } else {
                    const coreWord = token.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
                    let cls = 'essay-word';
                    if (coreWord && savedWords[coreWord] === 'learn') cls += ' highlighted';
                    else if (coreWord && savedWords[coreWord] === 'known') cls += ' known-word';
                    bodyHtml += `<span class="${cls}" data-word="${coreWord}">${token}</span>`;
                }
            });
            bodyHtml += `</span> `;
        });
        bodyHtml += '</div>';
    });

    document.getElementById('essayReaderBody').innerHTML = bodyHtml;
    document.getElementById('essayReaderOverlay').classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';

    const readerBody = document.getElementById('essayReaderBody');

    // Event delegation for word and sentence taps
    readerBody.onclick = function(e) {
        const wordEl = e.target.closest('.essay-word');
        const sentEl = e.target.closest('.essay-sentence');

        // If sentence is already active and user taps a word → word popup
        if (sentEl && sentEl === activeSentenceEl && wordEl) {
            const word = wordEl.dataset.word;
            if (word && word.length >= 2) {
                onEssayWordTap(wordEl, word);
                return;
            }
        }

        // Otherwise, tap anywhere in a sentence → translate it
        if (sentEl) {
            onSentenceTap(sentEl);
        }
    };

    // Dismiss bubble on scroll
    readerBody.addEventListener('scroll', function() {
        if (activeSentenceEl) {
            activeSentenceEl.classList.remove('sentence-active');
            activeSentenceEl = null;
        }
        removeFloatingBubble();
    });
}

function closeEssayReader() {
    document.getElementById('essayReaderOverlay').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'flex';
    removeFloatingBubble();
    activeSentenceEl = null;
}

function onEssayWordTap(el, word) {
    if (!word || word.length < 2) return;
    currentEssayWordEl = el;

    document.getElementById('wordPopupWord').textContent = word;
    document.getElementById('wordPopupPhonetic').textContent = '';
    document.getElementById('wordPopupVi').textContent = '';
    document.getElementById('wordPopupEn').textContent = '';

    document.getElementById('wordPopupOverlay').classList.add('active');

    // Try to find in our vocabulary first
    const found = ieltsVocabulary.find(v => v.en.toLowerCase() === word);
    if (found) {
        document.getElementById('wordPopupVi').textContent = found.vi;
        document.getElementById('wordPopupPhonetic').textContent = found.ipa || '';
        // Also fetch English definition
        lookupEnglishDef(word);
    } else {
        document.getElementById('wordPopupVi').textContent = '...';
        // Fetch both English def and Vietnamese translation
        lookupWord(word);
    }

    speakWord(word);
}

function removeFloatingBubble() {
    if (floatingBubble) {
        floatingBubble.remove();
        floatingBubble = null;
    }
}

function onSentenceTap(el) {
    const sentence = el.dataset.text;
    if (!sentence) return;

    // Close previous
    if (activeSentenceEl && activeSentenceEl !== el) {
        activeSentenceEl.classList.remove('sentence-active');
    }

    // Toggle same sentence
    if (activeSentenceEl === el && el.classList.contains('sentence-active')) {
        el.classList.remove('sentence-active');
        removeFloatingBubble();
        activeSentenceEl = null;
        return;
    }

    removeFloatingBubble();
    activeSentenceEl = el;
    el.classList.add('sentence-active');

    // Create floating bubble
    floatingBubble = document.createElement('div');
    floatingBubble.className = 'sentence-bubble-floating';
    floatingBubble.textContent = '...';
    document.body.appendChild(floatingBubble);
    positionBubble(el);

    translateSentence(sentence);
}

function positionBubble(el) {
    if (!floatingBubble || !el) return;
    const rect = el.getBoundingClientRect();
    const bubbleH = floatingBubble.offsetHeight;
    const gap = 8;

    // Try above first
    if (rect.top - bubbleH - gap > 8) {
        floatingBubble.style.top = (rect.top - bubbleH - gap) + 'px';
        floatingBubble.classList.remove('bubble-below');
    } else {
        // Place below
        floatingBubble.style.top = (rect.bottom + gap) + 'px';
        floatingBubble.classList.add('bubble-below');
    }
}

async function translateSentence(sentence) {
    try {
        const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=en|vi`);
        if (resp.ok) {
            const data = await resp.json();
            const translated = data.responseData?.translatedText || '';
            if (translated && floatingBubble) {
                floatingBubble.textContent = translated;
                positionBubble(activeSentenceEl);
            }
        } else if (floatingBubble) {
            floatingBubble.textContent = 'Translation failed';
        }
    } catch (e) {
        if (floatingBubble) floatingBubble.textContent = 'Translation failed';
    }
}

async function lookupEnglishDef(word) {
    try {
        const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (resp.ok) {
            const data = await resp.json();
            const entry = data[0];
            const meanings = entry.meanings || [];
            if (meanings.length > 0) {
                const firstDef = meanings[0].definitions?.[0]?.definition || '';
                const pos = meanings[0].partOfSpeech || '';
                document.getElementById('wordPopupEn').textContent = pos ? `(${pos}) ${firstDef}` : firstDef;
            }
        }
    } catch (e) { /* silent */ }
}

async function lookupWord(word) {
    // Fetch English definition and Vietnamese translation in parallel
    const enPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const viPromise = fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`);

    try {
        const [enResp, viResp] = await Promise.allSettled([enPromise, viPromise]);

        // English definition
        if (enResp.status === 'fulfilled' && enResp.value.ok) {
            const data = await enResp.value.json();
            const entry = data[0];
            const phonetic = entry.phonetics?.find(p => p.text)?.text || '';
            const meanings = entry.meanings || [];
            if (phonetic) document.getElementById('wordPopupPhonetic').textContent = phonetic;
            if (meanings.length > 0) {
                const firstDef = meanings[0].definitions?.[0]?.definition || '';
                const pos = meanings[0].partOfSpeech || '';
                document.getElementById('wordPopupEn').textContent = pos ? `(${pos}) ${firstDef}` : firstDef;
            }
        }

        // Vietnamese translation
        if (viResp.status === 'fulfilled' && viResp.value.ok) {
            const viData = await viResp.value.json();
            const viText = viData.responseData?.translatedText || '';
            if (viText && viText.toLowerCase() !== word.toLowerCase()) {
                document.getElementById('wordPopupVi').textContent = viText.toLowerCase();
            } else {
                document.getElementById('wordPopupVi').textContent = '';
            }
        } else {
            document.getElementById('wordPopupVi').textContent = '';
        }
    } catch (e) {
        document.getElementById('wordPopupVi').textContent = '';
        document.getElementById('wordPopupEn').textContent = 'No definition found';
    }
}

function closeWordPopup() {
    document.getElementById('wordPopupOverlay').classList.remove('active');
    currentEssayWordEl = null;
}

function markWordKnown() {
    const word = document.getElementById('wordPopupWord').textContent.toLowerCase();
    if (!appState.essayWords) appState.essayWords = {};
    appState.essayWords[word] = 'known';
    saveUserData(currentUser, appState);

    if (currentEssayWordEl) {
        currentEssayWordEl.classList.remove('highlighted');
        currentEssayWordEl.classList.add('known-word');
    }
    // Update all instances of this word in the reader
    document.querySelectorAll('.essay-word').forEach(el => {
        const w = el.textContent.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
        if (w === word) {
            el.classList.remove('highlighted');
            el.classList.add('known-word');
        }
    });
    closeWordPopup();
}

function markWordLearn() {
    const word = document.getElementById('wordPopupWord').textContent.toLowerCase();
    if (!appState.essayWords) appState.essayWords = {};
    appState.essayWords[word] = 'learn';
    saveUserData(currentUser, appState);

    if (currentEssayWordEl) {
        currentEssayWordEl.classList.remove('known-word');
        currentEssayWordEl.classList.add('highlighted');
    }
    // Update all instances of this word in the reader
    document.querySelectorAll('.essay-word').forEach(el => {
        const w = el.textContent.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
        if (w === word) {
            el.classList.remove('known-word');
            el.classList.add('highlighted');
        }
    });
    closeWordPopup();
}
