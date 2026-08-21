// home.js - Home screen rendering, history, mistakes, and difficulty filtering

const APP_VERSION = 'v4.14.17';

// ============================================================================
//  DAILY STREAK MODAL (v3.37)
// ============================================================================
// Shown once per day right after the user enters the app. Reinforces the
// "learn every day" loop by:
//   • celebrating the current streak number (big, bold)
//   • showing the next milestone target with a progress bar
//   • showing a "Today" tile that turns ✓ once the user studies
//   • CTA → jump straight to the next lesson

// Local-day key (UTC offset by user's local TZ). Resets at midnight LOCAL.
function _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

// Was the modal already shown today for this user?
function hasShownStreakToday(user) {
    if (!user) return true;
    try {
        return localStorage.getItem('flashlingo-streak-shown-' + user) === _todayKey();
    } catch (e) { return false; }
}

function markStreakShownToday(user) {
    if (!user) return;
    try {
        localStorage.setItem('flashlingo-streak-shown-' + user, _todayKey());
    } catch (e) {}
}

// Has the user studied TODAY? Used to decide whether the "Today" tile is ✓.
function _hasStudiedToday() {
    if (!appState) return false;
    const today = _todayKey();
    // Most reliable: check lessonHistory entries' dates
    if (Array.isArray(appState.lessonHistory)) {
        for (const h of appState.lessonHistory) {
            if (!h || !h.date) continue;
            const hd = new Date(h.date);
            const k = hd.getFullYear() + '-' + String(hd.getMonth() + 1).padStart(2, '0') + '-' + String(hd.getDate()).padStart(2, '0');
            if (k === today) return true;
        }
    }
    // Fallback: appState.lastStudyDate
    if (appState.lastStudyDate) {
        const ld = new Date(appState.lastStudyDate);
        const k = ld.getFullYear() + '-' + String(ld.getMonth() + 1).padStart(2, '0') + '-' + String(ld.getDate()).padStart(2, '0');
        if (k === today) return true;
    }
    return false;
}

// Last 7 days (today + 6 prior). Returns an array of { dateLabel, studied, isToday }.
function _last7DaysCalendar() {
    const out = [];
    if (!appState) return out;
    const studiedKeys = new Set();
    if (Array.isArray(appState.lessonHistory)) {
        for (const h of appState.lessonHistory) {
            if (!h || !h.date) continue;
            const d = new Date(h.date);
            studiedKeys.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        }
    }
    const today = _todayKey();
    const todayD = new Date();
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(todayD);
        d.setDate(d.getDate() - i);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        out.push({
            dateLabel: DAY_NAMES[d.getDay()],
            studied: studiedKeys.has(key),
            isToday: key === today
        });
    }
    return out;
}

// Build + show the modal. `opts.force = true` bypasses the once-per-day gate
// (used when the user manually re-opens it from the home screen).
function showDailyStreakModal(opts) {
    opts = opts || {};
    if (!appState) return;
    if (!opts.force && hasShownStreakToday(currentUser)) return;
    markStreakShownToday(currentUser);

    const streak = appState.streak || 0;
    const best = appState.bestStreak || streak;
    const tier = (typeof getStreakTier === 'function') ? getStreakTier(streak) : 0;
    const nextMs = (typeof getNextMilestone === 'function') ? getNextMilestone(streak) : null;
    const studiedToday = _hasStudiedToday();
    const days = _last7DaysCalendar();

    // Progress to the next milestone
    let progressHTML = '';
    if (nextMs) {
        const prev = streak === 0 ? 0 : (streak >= 30 ? 30 : streak >= 14 ? 14 : streak >= 7 ? 7 : streak >= 3 ? 3 : 0);
        const pct = Math.min(100, Math.round(((streak - prev) / (nextMs - prev)) * 100));
        progressHTML = `
            <div class="streak-modal-progress">
                <div class="streak-modal-progress-bar">
                    <div class="streak-modal-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="streak-modal-progress-label">
                    <strong>${nextMs - streak}</strong> day${nextMs - streak !== 1 ? 's' : ''} to <strong>${nextMs}-day</strong> milestone
                </div>
            </div>
        `;
    } else {
        progressHTML = `<div class="streak-modal-progress-label">🏆 You've passed every streak milestone!</div>`;
    }

    // Last-7-days calendar
    const calendarHTML = days.map(d => `
        <div class="streak-modal-day ${d.studied ? 'studied' : ''} ${d.isToday ? 'today' : ''}">
            <div class="streak-modal-day-label">${d.dateLabel}${d.isToday ? ' •' : ''}</div>
            <div class="streak-modal-day-dot">${d.studied ? '🔥' : (d.isToday ? '⭕' : '·')}</div>
        </div>
    `).join('');

    // Today\'s "study CTA"
    const ctaHTML = studiedToday
        ? `<div class="streak-modal-done">✓ Already studied today — keep it up!</div>`
        : `<button class="streak-modal-cta" onclick="dismissStreakModalAndStart()">📚 Learn today's words</button>`;

    // Greeting based on streak length
    let greeting;
    if (streak === 0) {
        greeting = 'Start your streak today!';
    } else if (streak === 1) {
        greeting = 'Day 1 — let\'s make it two!';
    } else if (streak < 7) {
        greeting = `Streak: ${streak} days strong 💪`;
    } else if (streak < 14) {
        greeting = `${streak}-day streak — you're on fire 🔥`;
    } else if (streak < 30) {
        greeting = `${streak} days — unstoppable!`;
    } else {
        greeting = `${streak} days — you're a legend 🏆`;
    }

    // Create overlay
    let overlay = document.getElementById('streakModalOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'streakModalOverlay';
        overlay.className = 'streak-modal-overlay';
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
    overlay.innerHTML = `
        <div class="streak-modal" role="dialog" aria-modal="true" aria-labelledby="streakModalTitle">
            <button class="streak-modal-close" onclick="dismissStreakModal()" aria-label="Close">×</button>
            <div class="streak-modal-flame">🔥</div>
            <div class="streak-modal-streak ${tier > 0 ? 'streak-tier-' + tier : ''}">${streak}</div>
            <div class="streak-modal-unit">DAY${streak !== 1 ? 'S' : ''}</div>
            <h2 class="streak-modal-greeting" id="streakModalTitle">${greeting}</h2>
            <div class="streak-modal-calendar">${calendarHTML}</div>
            ${progressHTML}
            <div class="streak-modal-best">Best ever: <strong>${best}</strong> day${best !== 1 ? 's' : ''}</div>
            ${ctaHTML}
        </div>
    `;

    // Click outside the modal to dismiss
    overlay.onclick = function (e) {
        if (e.target === overlay) dismissStreakModal();
    };
}

function dismissStreakModal() {
    const overlay = document.getElementById('streakModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (overlay && !overlay.classList.contains('active')) {
                overlay.innerHTML = '';
            }
        }, 250);
    }
}

function dismissStreakModalAndStart() {
    dismissStreakModal();
    // Jump to the next-lesson workflow if available
    if (typeof getNextPracticeLesson === 'function' && typeof startLesson === 'function') {
        try {
            const next = getNextPracticeLesson();
            if (next && typeof next.lessonNum === 'number') {
                startLesson(next.lessonNum);
                return;
            }
        } catch (e) { /* fall through */ }
    }
    // Fallback: scroll the user to the home screen's next-lesson card
    const homeScreen = document.getElementById('homeScreen');
    if (homeScreen && homeScreen.scrollTo) homeScreen.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
//  HOMEPAGE STREAK PANEL (v3.38)
// ============================================================================
// The homepage now has just two focused goals:
//   1. Grow the pet (rendered above in #petHeroZone — unchanged)
//   2. Keep the daily streak (this panel)
// No lesson list, difficulty chips, or history — those moved to other tabs.
function renderHomeStreakPanel() {
    const panel = document.getElementById('streakPanel');
    if (!panel || !appState) return;

    const streak = appState.streak || 0;
    const best = appState.bestStreak || streak;
    const tier = (typeof getStreakTier === 'function') ? getStreakTier(streak) : 0;
    const nextMs = (typeof getNextMilestone === 'function') ? getNextMilestone(streak) : null;
    const studiedToday = (typeof _hasStudiedToday === 'function') ? _hasStudiedToday() : false;
    const days = (typeof _last7DaysCalendar === 'function') ? _last7DaysCalendar() : [];

    // ── Streak tier label ──
    let tierName, tierColour;
    if (streak >= 30)      { tierName = 'Super Streak'; tierColour = '#ef4444'; }
    else if (streak >= 14) { tierName = 'Unstoppable'; tierColour = '#f97316'; }
    else if (streak >= 7)  { tierName = 'On Fire';     tierColour = '#fbbf24'; }
    else if (streak >= 3)  { tierName = 'Heating Up';  tierColour = '#fde68a'; }
    else                   { tierName = 'Getting Started'; tierColour = '#cbd5e1'; }

    // ── Progress to next milestone ──
    let progressHTML = '';
    if (nextMs) {
        const prev = streak >= 30 ? 30 : streak >= 14 ? 14 : streak >= 7 ? 7 : streak >= 3 ? 3 : 0;
        const pct = Math.min(100, Math.round(((streak - prev) / (nextMs - prev)) * 100));
        progressHTML = `
            <div class="home-streak-progress">
                <div class="home-streak-progress-bar">
                    <div class="home-streak-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="home-streak-progress-label">
                    <strong>${nextMs - streak}</strong> day${nextMs - streak !== 1 ? 's' : ''} to <strong>${nextMs}</strong>
                </div>
            </div>
        `;
    } else {
        progressHTML = `<div class="home-streak-progress-label">🏆 All milestones reached!</div>`;
    }

    // ── Last-7-days calendar ──
    const calendarHTML = days.map(d => `
        <div class="home-streak-day ${d.studied ? 'studied' : ''} ${d.isToday ? 'today' : ''}">
            <div class="home-streak-day-label">${d.dateLabel}</div>
            <div class="home-streak-day-dot">${d.studied ? '🔥' : (d.isToday ? '○' : '·')}</div>
        </div>
    `).join('');

    // ── Today CTA ──
    const ctaHTML = studiedToday
        ? `<div class="home-streak-done">✓ Studied today — streak safe</div>`
        : `<button class="home-streak-cta" onclick="goLearnToday()">📚 Learn today's words</button>`;

    panel.innerHTML = `
        <div class="home-streak-card">
            <div class="home-streak-head">
                <div class="home-streak-tier" style="color:${tierColour}">${tierName.toUpperCase()}</div>
                <div class="home-streak-number ${tier > 0 ? 'streak-tier-' + tier : ''}">
                    🔥 <span>${streak}</span>
                </div>
                <div class="home-streak-unit">day${streak !== 1 ? 's' : ''} in a row</div>
            </div>

            <div class="home-streak-week">${calendarHTML}</div>

            ${progressHTML}

            <div class="home-streak-best">Best ever: <strong>${best}</strong> day${best !== 1 ? 's' : ''}</div>

            ${ctaHTML}
        </div>
    `;
}

// CTA → jump to a learning activity. We pick the highest-value action:
// next vocabulary lesson if one exists, else the Topics tab.
function goLearnToday() {
    if (typeof getNextPracticeLesson === 'function' && typeof startLesson === 'function') {
        try {
            const next = getNextPracticeLesson();
            if (next && typeof next.lessonNum === 'number') {
                startLesson(next.lessonNum);
                return;
            }
        } catch (e) { /* fall through */ }
    }
    if (typeof startNextLesson === 'function') {
        try { startNextLesson(); return; } catch (e) { /* fall through */ }
    }
    // Last resort: open the Topics tab
    if (typeof switchScreen === 'function') {
        switchScreen('topicsScreen');
        if (typeof renderTopicsHome === 'function') renderTopicsHome();
    }
}

// ==================== SKILLS CHART (home bottom) ====================
// Aggregates correct/total across every practice type's history so the
// student can see which skills are strong and which need work.
function getHomeSkillStats() {
    if (!appState) return [];
    const sum = (hist) => {
        let c = 0, t = 0;
        (hist || []).forEach(s => { c += s.score || 0; t += s.total || 0; });
        return { c, t };
    };
    const skills = [];

    // Vocabulary — lessonHistory stores accuracy per 5-word lesson
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    let vc = 0, vt = 0;
    (appState.lessonHistory || []).forEach(h => {
        if (typeof h.accuracy === 'number') { vt += wpl; vc += Math.round(h.accuracy / 100 * wpl); }
    });
    skills.push({ key: 'vocab', label: 'Vocabulary', icon: '📚', color: '#22c55e', correct: vc, total: vt });

    // Grade 4 picture-dictionary practice (Topics tab → Grade 4 sub-tab)
    const u = sum(appState.unitsHistory);
    skills.push({ key: 'units', label: 'Grade 4', icon: '📗', color: '#16a34a', correct: u.c, total: u.t });

    const g = sum(appState.grammarHistory);
    skills.push({ key: 'grammar', label: 'Grammar', icon: '🎓', color: '#7c3aed', correct: g.c, total: g.t });
    const p = sum(appState.phrasesHistory);
    skills.push({ key: 'phrases', label: 'Phrases', icon: '🔗', color: '#1cb0f6', correct: p.c, total: p.t });
    const co = sum(appState.collocHistory);
    skills.push({ key: 'colloc', label: 'Collocation', icon: '🧩', color: '#0ea5e9', correct: co.c, total: co.t });
    const w = sum(appState.wordformHistory);
    skills.push({ key: 'wordform', label: 'Word form', icon: '🔤', color: '#c2560a', correct: w.c, total: w.t });
    const r = sum(appState.rewriteHistory);
    skills.push({ key: 'rewrite', label: 'Rewrite', icon: '✍️', color: '#d6407a', correct: r.c, total: r.t });

    // Verbs speed challenge
    let vbc = 0, vbt = 0;
    ((appState.speedChallenge && appState.speedChallenge.history) || []).forEach(h => {
        vbc += h.correct || 0; vbt += h.total || 0;
    });
    skills.push({ key: 'verbs', label: 'Verbs', icon: '📝', color: '#f59e0b', correct: vbc, total: vbt });

    // Exam attempts (stored app-wide by the Exam tab)
    let ec = 0, et = 0;
    try {
        const eh = (typeof loadExamHistory === 'function') ? loadExamHistory() : [];
        (eh || []).forEach(a => { ec += a.score || 0; et += a.total || 0; });
    } catch (e) { /* exam module absent — skip */ }
    skills.push({ key: 'exam', label: 'Exam', icon: '🎯', color: '#ef4444', correct: ec, total: et });

    return skills.map(s => Object.assign({}, s, { pct: s.total ? Math.round(s.correct / s.total * 100) : 0 }));
}

// Per-skill session lists (normalized {score,total,date}), newest first —
// used for recent-trend arrows and the 7-day activity chart.
function _homeSkillSessions() {
    if (!appState) return {};
    const wpl = (typeof WORDS_PER_LESSON !== 'undefined') ? WORDS_PER_LESSON : 5;
    const norm = (arr, map) => (arr || []).map(map).filter(s => s.total > 0)
        .sort((a, b) => (b.date || 0) - (a.date || 0));
    let exam = [];
    try {
        exam = (typeof loadExamHistory === 'function') ? (loadExamHistory() || []) : [];
    } catch (e) { exam = []; }
    return {
        vocab: norm(appState.lessonHistory, h => ({
            score: Math.round((h.accuracy || 0) / 100 * wpl), total: (typeof h.accuracy === 'number') ? wpl : 0, date: h.date || 0 })),
        units: norm(appState.unitsHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        grammar: norm(appState.grammarHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        phrases: norm(appState.phrasesHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        colloc: norm(appState.collocHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        wordform: norm(appState.wordformHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        rewrite: norm(appState.rewriteHistory, h => ({ score: h.score || 0, total: h.total || 0, date: h.date || 0 })),
        verbs: norm((appState.speedChallenge && appState.speedChallenge.history), h => ({ score: h.correct || 0, total: h.total || 0, date: h.date || 0 })),
        exam: norm(exam, a => ({ score: a.score || 0, total: a.total || 0, date: a.ts || 0 })),
    };
}

// Total completed sessions across EVERY practice type. The Profile tab's
// "Lessons" stat uses this so it counts everything the student has done
// (topic lessons, Grade 4 units, grammar, phrases, word form, rewrite,
// verbs and exams), not just topic lessons.
function _homeAllSessionsCount() {
    if (!appState) return 0;
    const sessions = _homeSkillSessions();
    let n = 0;
    Object.values(sessions).forEach(list => { n += list.length; });
    return n;
}

function _homeSkillLevel(pct) {
    if (pct >= 85) return { label: 'Excellent', cls: 'lv-excellent' };
    if (pct >= 70) return { label: 'Good', cls: 'lv-good' };
    if (pct >= 50) return { label: 'OK', cls: 'lv-ok' };
    return { label: 'Practice!', cls: 'lv-weak' };
}

// Questions answered per day over the last 7 days, across all skills.
function getHomeDailyActivity() {
    const sessions = _homeSkillSessions();
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push({ key: d.toDateString(), label: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()], count: 0, isToday: i === 0 });
    }
    const byKey = new Map(days.map(d => [d.key, d]));
    Object.values(sessions).forEach(list => list.forEach(s => {
        if (!s.date) return;
        const k = new Date(s.date).toDateString();
        const day = byKey.get(k);
        if (day) day.count += s.total;
    }));
    return days;
}

function renderHomeSkillsPanel() {
    const panel = document.getElementById('homeSkillsPanel');
    if (!panel || !appState) return;
    const skills = getHomeSkillStats();
    const sessions = _homeSkillSessions();
    const practiced = skills.filter(s => s.total > 0);

    // ── Overall summary ──
    const answered = skills.reduce((n, s) => n + s.total, 0);
    const correct = skills.reduce((n, s) => n + s.correct, 0);
    const overallPct = answered ? Math.round(correct / answered * 100) : 0;
    const best = practiced.slice().sort((a, b) => b.pct - a.pct)[0];
    const weakest = practiced.length > 1 ? practiced.slice().sort((a, b) => a.pct - b.pct)[0] : null;

    const summaryHTML = practiced.length ? `
        <div class="home-skills-summary">
            <div class="home-skills-ring" style="background: conic-gradient(#22c55e ${overallPct * 3.6}deg, rgba(0,0,0,0.08) 0deg);">
                <div class="home-skills-ring-inner"><strong>${overallPct}%</strong><span>overall</span></div>
            </div>
            <div class="home-skills-chips">
                <div class="home-skills-chip"><strong>${answered.toLocaleString()}</strong><span>answered</span></div>
                <div class="home-skills-chip"><strong>${correct.toLocaleString()}</strong><span>correct</span></div>
                ${best ? `<div class="home-skills-chip chip-best"><strong>${best.icon} ${best.pct}%</strong><span>best: ${best.label}</span></div>` : ''}
                ${weakest && weakest.key !== (best && best.key) ? `<div class="home-skills-chip chip-focus"><strong>${weakest.icon} ${weakest.pct}%</strong><span>focus: ${weakest.label}</span></div>` : ''}
            </div>
        </div>` : '';

    // ── Per-skill rows with recent trend (last 3 sessions vs all-time) ──
    const rows = skills.map(s => {
        const empty = s.total === 0;
        let trend = '';
        const recent = (sessions[s.key] || []).slice(0, 3);
        const rTot = recent.reduce((n, x) => n + x.total, 0);
        if (!empty && rTot >= 5 && (sessions[s.key] || []).length >= 2) {
            const rPct = Math.round(recent.reduce((n, x) => n + x.score, 0) / rTot * 100);
            if (rPct >= s.pct + 5) trend = `<span class="home-skill-trend up" title="Recent: ${rPct}%">▲</span>`;
            else if (rPct <= s.pct - 5) trend = `<span class="home-skill-trend down" title="Recent: ${rPct}%">▼</span>`;
        }
        const lv = _homeSkillLevel(s.pct);
        return `
        <div class="home-skill-row ${empty ? 'home-skill-empty' : ''}" onclick="goToSkillTab('${s.key}')">
            <div class="home-skill-label">${s.icon} ${s.label}</div>
            <div class="home-skill-bar">
                <div class="home-skill-fill" style="width:${s.pct}%; background:${s.color};"></div>
            </div>
            <div class="home-skill-value">${empty ? '—'
                : `<strong>${s.pct}%</strong>${trend} <span>${s.correct}/${s.total}</span><em class="home-skill-level ${lv.cls}">${lv.label}</em>`}</div>
        </div>`;
    }).join('');

    // ── 7-day activity mini chart ──
    const daily = getHomeDailyActivity();
    const maxDay = Math.max(1, ...daily.map(d => d.count));
    const weekTotal = daily.reduce((n, d) => n + d.count, 0);
    const dailyHTML = `
        <div class="home-skills-daily">
            <div class="home-skills-daily-title">Last 7 days · <strong>${weekTotal}</strong> questions</div>
            <div class="home-skills-daily-bars">
                ${daily.map(d => `
                <div class="home-skills-day ${d.isToday ? 'today' : ''}">
                    <div class="home-skills-day-bar"><div class="home-skills-day-fill" style="height:${Math.round(d.count / maxDay * 100)}%"></div></div>
                    <div class="home-skills-day-count">${d.count || ''}</div>
                    <div class="home-skills-day-label">${d.label}</div>
                </div>`).join('')}
            </div>
        </div>`;

    const subtitle = practiced.length
        ? `Accuracy by skill — tap a weak one to practice it!`
        : 'Answer questions in any tab to grow your chart!';

    panel.innerHTML = `
        <div class="home-skills-title">📊 My Skills</div>
        <div class="home-skills-sub">${subtitle}</div>
        ${summaryHTML}
        ${rows}
        ${practiced.length ? dailyHTML : ''}`;
}

// Tap a skill row → jump straight to that practice tab.
function goToSkillTab(key) {
    const map = {
        vocab: ['topicsScreen', 'renderTopicsHome'],
        units: ['topicsScreen', 'renderTopicsHome'],
        grammar: ['grammarScreen', 'renderGrammarHome'],
        phrases: ['phrasesScreen', 'renderPhrasesHome'],
        colloc: ['phrasesScreen', 'renderPhrasesHome'],
        wordform: ['wordformScreen', 'renderWordformHome'],
        rewrite: ['rewriteScreen', 'renderRewriteHome'],
        verbs: ['speedChallengeScreen', null],
        exam: ['examScreen', 'renderExamHome'],
    };
    const target = map[key];
    if (!target || typeof switchScreen !== 'function') return;
    switchScreen(target[0]);
    // Both Topics-screen skills land on their own sub-tab.
    if ((key === 'units' || key === 'vocab') && typeof switchTopicsSubTab === 'function') {
        try { switchTopicsSubTab(key === 'units' ? 'grade4' : 'topics'); } catch (e) {}
    }
    // Phrases-screen skills land on their own sub-tab too.
    if ((key === 'phrases' || key === 'colloc') && typeof switchPhrSubTab === 'function') {
        try { switchPhrSubTab(key === 'colloc' ? 'colloc' : 'practice'); } catch (e) {}
    }
    const fn = target[1];
    if (fn && typeof globalThis[fn] === 'function') { try { globalThis[fn](); } catch (e) {} }
    // Direct links from My Skills still belong to one of the five parent tabs.
    if (typeof setBottomNavActive === 'function') setBottomNavActive(target[0]);
}

function renderHome() {
    if (!appState) return;

    const avatarEl = document.getElementById('homeAvatar');
    if (avatarEl) avatarEl.textContent = appState.avatar || '😊';
    const usernameEl = document.getElementById('homeUsername');
    if (usernameEl) usernameEl.textContent = appState.username;
    const pointsEl = document.getElementById('homePoints');
    if (pointsEl) pointsEl.textContent = appState.points;
    const streakEl = document.getElementById('homeStreak');
    if (streakEl) streakEl.textContent = appState.streak;

    var verEl = document.getElementById('appVersion');
    if (verEl) verEl.textContent = APP_VERSION;

    // Render streak shields (guarded: a failure here must not blank the
    // panels rendered after it)
    try { renderShields(); } catch (e) { /* non-fatal */ }

    // Fire shield-saved celebration if a shield was auto-used
    if (appState.pendingShieldCelebration && typeof showShieldSavedCelebration === 'function') {
        const savedStreak = appState.pendingShieldCelebration;
        appState.pendingShieldCelebration = null;
        saveUserData(currentUser, appState);
        setTimeout(() => showShieldSavedCelebration(savedStreak), 600);
    }

    // Fire weekly recap if a new one is due
    if (typeof maybeShowWeeklyRecap === 'function') {
        setTimeout(() => maybeShowWeeklyRecap(), 1200);
    }

    // v3.38: Homepage now focuses on TWO goals — grow the pet (above) and
    // keep the streak (below). Render BOTH; everything else (lesson list,
    // difficulty chips, history) was removed.
    if (typeof renderWordPet === 'function') {
        try { renderWordPet(); } catch (e) { /* non-fatal */ }
    }
    try { renderHomeStreakPanel(); } catch (e) { /* non-fatal */ }
    try { renderHomeSkillsPanel(); } catch (e) { /* non-fatal */ }

    // The lesson-start card / difficulty chips / history are GONE from the
    // home page in v3.38 — exit before the legacy code touches them.
    const lessonStartCard = document.getElementById('lessonStartCard');
    if (!lessonStartCard) return;

    // ----- LEGACY (no longer rendered — kept for safety only) -----
    // Calculate lessons completed today
    const today = new Date().toDateString();
    const todayLessons = (appState.lessonHistory || []).filter(h => {
        return new Date(h.date).toDateString() === today;
    }).length;
    const todayEl = document.getElementById('homeToday');
    if (todayEl) todayEl.textContent = todayLessons;

    // Update difficulty tab counts
    if (typeof updateDifficultyCounts === 'function') updateDifficultyCounts();

    // Get lesson based on filter
    const displayLesson = getNextLessonForDifficulty(selectedDifficultyFilter);

    // Check if all lessons in selected difficulty are complete
    const range = getLessonRangeForDifficulty(selectedDifficultyFilter);
    const uniqueCompletedInRange = new Set(
        (appState.lessonHistory || [])
            .filter(h => h.lessonNum >= range.start && h.lessonNum < range.end)
            .map(h => h.lessonNum)
    ).size;
    const totalInRange = range.end - range.start;
    const allCompleteInRange = uniqueCompletedInRange >= totalInRange;

    if (allCompleteInRange) {
        // All lessons in this difficulty completed — show sequential practice
        const diff = getDifficultyLevel(range.start);
        const difficultyColors = {
            'Beginning': 'linear-gradient(135deg, #27ae60, #1e8449)',
            'Basic': 'linear-gradient(135deg, #2ecc71, #27ae60)',
            'Intermediate': 'linear-gradient(135deg, #1abc9c, #16a085)',
            'Upper-Intermediate': 'linear-gradient(135deg, #9b59b6, #8e44ad)',
            'Advanced': 'linear-gradient(135deg, #8e44ad, #6c3483)'
        };
        lessonStartCard.style.background = difficultyColors[diff.name];

        // Find the next lesson to practice: the one practiced longest ago
        const nextPractice = getNextPracticeLesson(range);
        const practiceInRange = nextPractice - range.start + 1;

        // Preview words for this lesson
        const practiceStartIdx = nextPractice * WORDS_PER_LESSON;
        const practiceWords = ieltsVocabulary.slice(practiceStartIdx, practiceStartIdx + WORDS_PER_LESSON);
        const practicePreview = practiceWords.map(w => w.en).slice(0, 3).join(', ');

        lessonStartCard.innerHTML = `
            <div class="lesson-difficulty">
                <span class="difficulty-badge">✅ ${diff.name} Complete!</span>
                <span class="difficulty-band">Review mode</span>
            </div>
            <div class="lesson-info">
                <div class="lesson-number">Lesson ${practiceInRange} of ${totalInRange}</div>
                <div class="lesson-words-preview">${practicePreview}...</div>
            </div>
            <button class="primary-btn start-lesson-btn" onclick="startLesson(${nextPractice})">
                🔄 PRACTICE AGAIN
            </button>
        `;
    } else {
        // Get difficulty level
        const difficulty = getDifficultyLevel(displayLesson);
        const difficultyColors = {
            'Beginning': 'linear-gradient(135deg, #27ae60, #1e8449)',
            'Basic': 'linear-gradient(135deg, #2ecc71, #27ae60)',
            'Intermediate': 'linear-gradient(135deg, #1abc9c, #16a085)',
            'Upper-Intermediate': 'linear-gradient(135deg, #9b59b6, #8e44ad)',
            'Advanced': 'linear-gradient(135deg, #8e44ad, #6c3483)'
        };

        lessonStartCard.style.background = difficultyColors[difficulty.name];

        // Show preview of words in this lesson
        const startIdx = displayLesson * WORDS_PER_LESSON;
        const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);
        const previewWords = lessonWords.map(w => w.en).slice(0, 3).join(', ');

        // Show progress within this difficulty level
        const rangeTotal = range.end - range.start;
        const lessonInRange = displayLesson - range.start + 1;

        lessonStartCard.innerHTML = `
            <div class="lesson-difficulty">
                <span class="difficulty-badge">${difficulty.icon} ${difficulty.name}</span>
                <span class="difficulty-band">${difficulty.band === 'House' ? 'Household' : 'IELTS Band ' + difficulty.band}</span>
            </div>
            <div class="lesson-info">
                <div class="lesson-number">Lesson ${lessonInRange} of ${rangeTotal}</div>
                <div class="lesson-words-preview">${previewWords}...</div>
            </div>
            <button class="primary-btn start-lesson-btn" onclick="startLesson(${displayLesson})">
                🚀 START LESSON
            </button>
        `;
    }

    // Render fun features
    renderWordPet();

    // Render lesson history
    renderLessonHistory();
}

function updateReviewCard() {
    const reviewCard = document.getElementById('reviewCard');
    if (!appState || !appState.srs || Object.keys(appState.srs).length === 0) {
        reviewCard.style.display = 'none';
        return;
    }
    reviewCard.style.display = 'block';

    const dueCount = getReviewCount();
    const mastery = getSRSMasteryPercent();

    document.getElementById('reviewProgressFill').style.width = `${mastery}%`;
    document.getElementById('reviewProgressLabel').textContent = `${mastery}% mastered`;

    if (dueCount === 0) {
        reviewCard.classList.add('all-caught-up');
        document.getElementById('reviewTitle').textContent = 'All caught up!';
        document.getElementById('reviewSubtitle').textContent = 'No words due for review right now';
        document.getElementById('reviewStartBtn').style.display = 'none';
    } else {
        reviewCard.classList.remove('all-caught-up');
        document.getElementById('reviewTitle').textContent = `${dueCount} word${dueCount !== 1 ? 's' : ''} due today`;
        document.getElementById('reviewSubtitle').textContent = 'Keep your memory strong!';
        const btn = document.getElementById('reviewStartBtn');
        btn.style.display = 'block';
        btn.textContent = 'REVIEW';
    }
}

// currentHistoryTab declared in app.js

function switchHistoryTab(tab) {
    currentHistoryTab = tab;
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    event.target.closest('.history-tab').classList.add('active');

    const historyContainer = document.getElementById('lessonHistory');
    const mistakesContainer = document.getElementById('mistakesContainer');

    if (tab === 'history') {
        historyContainer.style.display = 'flex';
        mistakesContainer.classList.remove('show');
    } else {
        historyContainer.style.display = 'none';
        mistakesContainer.classList.add('show');
        renderMistakes();
    }
}

const HISTORY_PAGE_SIZE = 10;

function renderLessonHistory() {
    const historyContainer = document.getElementById('lessonHistory');
    let history = appState.lessonHistory || [];

    // Show ALL history regardless of selected difficulty tab
    document.getElementById('historyCount').textContent = history.length;
    const mistakes = appState.mistakes || [];
    document.getElementById('mistakesCount').textContent = mistakes.length;

    if (history.length === 0) {
        historyPage = 0;
        historyContainer.innerHTML = `<div class="empty-history">No lessons completed yet</div>`;
        return;
    }

    // Most recent first
    const sorted = history.slice().reverse();
    const totalPages = Math.ceil(sorted.length / HISTORY_PAGE_SIZE);

    // Clamp page
    if (historyPage >= totalPages) historyPage = totalPages - 1;
    if (historyPage < 0) historyPage = 0;

    const start = historyPage * HISTORY_PAGE_SIZE;
    const pageItems = sorted.slice(start, start + HISTORY_PAGE_SIZE);

    let html = '<div class="history-table">';
    pageItems.forEach((item, index) => {
        const startIdx = item.lessonNum * WORDS_PER_LESSON;
        const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);
        const wordTags = lessonWords.map(w => `<span class="history-word-tag" onclick="event.stopPropagation(); speakWord('${w.en.replace(/'/g, "\\'")}')">${w.en} 🔊</span>`).join('');
        const isPerfect = item.accuracy === 100;

        html += `
        <div class="history-row" onclick="toggleHistoryDetail(${index})">
            <div class="history-lesson-num">${item.lessonNum + 1}</div>
            <div class="history-info">
                <div class="history-title">Lesson ${item.lessonNum + 1}</div>
                <div class="history-date">${formatDate(item.date)}</div>
            </div>
            <div class="history-stats">
                <div class="history-points">+${item.points}</div>
                <div class="history-accuracy${isPerfect ? ' perfect' : ''}">${item.accuracy}%</div>
            </div>
            <div class="history-expand-icon">▼</div>
        </div>
        <div class="history-detail" id="historyDetail${index}">
            <div class="history-words-label">Words in this lesson:</div>
            <div class="history-words-list">${wordTags}</div>
            <button class="relearn-btn" onclick="event.stopPropagation(); relearnLesson(${item.lessonNum})">
                📖 Learn Again
            </button>
        </div>
        `;
    });
    html += '</div>';

    // Pagination controls
    if (totalPages > 1) {
        html += `
        <div class="history-pagination">
            <button class="history-page-btn" onclick="changeHistoryPage(-1)" ${historyPage === 0 ? 'disabled' : ''}>← Prev</button>
            <span class="history-page-info">${historyPage + 1} / ${totalPages}</span>
            <button class="history-page-btn" onclick="changeHistoryPage(1)" ${historyPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }

    historyContainer.innerHTML = html;
}

function changeHistoryPage(delta) {
    historyPage += delta;
    renderLessonHistory();
}

function toggleHistoryDetail(index) {
    const detail = document.getElementById(`historyDetail${index}`);
    const row = detail.previousElementSibling;

    if (detail.classList.contains('show')) {
        detail.classList.remove('show');
        row.classList.remove('expanded');
    } else {
        // Close all other details
        document.querySelectorAll('.history-detail.show').forEach(d => {
            d.classList.remove('show');
            d.previousElementSibling.classList.remove('expanded');
        });
        detail.classList.add('show');
        row.classList.add('expanded');
    }
}

function getReviewLessonGroups() {
    const mistakes = appState.mistakes || [];
    if (mistakes.length === 0) return [];
    const sorted = [...mistakes].sort((a, b) => b.count - a.count);
    const groups = [];
    for (let i = 0; i < sorted.length; i += WORDS_PER_LESSON) {
        groups.push(sorted.slice(i, i + WORDS_PER_LESSON));
    }
    return groups;
}

function renderMistakes() {
    const container = document.getElementById('mistakesContainer');
    const mistakes = appState.mistakes || [];

    if (mistakes.length === 0) {
        container.innerHTML = '<div class="empty-history">Great job! No mistakes to review 🎉</div>';
        return;
    }

    const groups = getReviewLessonGroups();
    const totalLessons = groups.length;

    let html = `<div class="review-summary">📝 ${mistakes.length} word${mistakes.length > 1 ? 's' : ''} to review (${totalLessons} lesson${totalLessons > 1 ? 's' : ''})</div>`;

    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];
        const words = group.map(m => ieltsVocabulary.find(w => w.en === m.word)).filter(Boolean);
        const totalWrong = group.reduce((sum, m) => sum + m.count, 0);
        const wordPreview = words.map(w => w.en).join(', ');

        html += `
        <div class="review-lesson-card">
            <div class="review-lesson-header">
                <span class="review-lesson-title">📖 Review Lesson ${i + 1}</span>
                <span class="review-lesson-count">${group.length} word${group.length > 1 ? 's' : ''}</span>
            </div>
            <div class="review-lesson-words">${wordPreview}</div>
            <div class="review-lesson-stats">${totalWrong}x wrong total</div>
            <button class="review-lesson-btn" onclick="startReviewLesson(${i})">🔄 START REVIEW</button>
        </div>`;
    }

    html += `<button class="clear-mistakes-btn" onclick="clearMistakes()">Clear All Mistakes</button>`;
    container.innerHTML = html;
}

function startReviewLesson(groupIndex) {
    const groups = getReviewLessonGroups();
    if (groupIndex >= groups.length) { showToast('No review lesson found'); return; }

    const group = groups[groupIndex];
    let reviewWords = group.map(m => ieltsVocabulary.find(w => w.en === m.word)).filter(Boolean);

    // Pad to WORDS_PER_LESSON if group is smaller (matching game needs 5 pairs)
    if (reviewWords.length < WORDS_PER_LESSON) {
        const existingEn = new Set(reviewWords.map(w => w.en));
        const pool = ieltsVocabulary.filter(w => !existingEn.has(w.en));
        while (reviewWords.length < WORDS_PER_LESSON && pool.length > 0) {
            const rand = Math.floor(Math.random() * pool.length);
            reviewWords.push(pool.splice(rand, 1)[0]);
        }
    }

    lessonState = {
        lessonNumber: -1,
        words: reviewWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: reviewWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isPracticeSession: true,
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('lessonScreen').classList.add('active');

    preloadLessonAudio(reviewWords);
    renderMatchingRound();
}

function clearMistakes() {
    if (confirm('Clear all mistakes from review list?')) {
        appState.mistakes = [];
        saveUserData(currentUser, appState);
        renderMistakes();
        document.getElementById('mistakesCount').textContent = '0';
        showToast('Mistakes cleared!');
    }
}

function relearnLesson(lessonNum) {
    startLesson(lessonNum);
}

// Beginning level has a fixed number of lessons (112 house words)
const BEGINNING_LESSONS = Math.ceil(112 / WORDS_PER_LESSON); // 23 lessons
const IELTS_LESSONS = TOTAL_LESSONS - BEGINNING_LESSONS; // remaining IELTS lessons
const IELTS_PER_LEVEL = Math.ceil(IELTS_LESSONS / 4); // split IELTS into 4 levels

function getDifficultyLevel(lessonNum) {
    if (lessonNum < BEGINNING_LESSONS) {
        return { name: 'Beginning', key: 'beginning', icon: '🏠', band: 'House', color: '#FF7043' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL) {
        return { name: 'Basic', key: 'basic', icon: '🌱', band: '5-6', color: '#58cc02' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL * 2) {
        return { name: 'Intermediate', key: 'intermediate', icon: '🌿', band: '6-7', color: '#1cb0f6' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL * 3) {
        return { name: 'Upper-Intermediate', key: 'upper', icon: '🌳', band: '7-8', color: '#ff9600' };
    } else {
        return { name: 'Advanced', key: 'advanced', icon: '⭐', band: '8-9', color: '#ce82ff' };
    }
}

function getLessonRangeForDifficulty(difficultyKey) {
    switch (difficultyKey) {
        case 'beginning': return { start: 0, end: BEGINNING_LESSONS };
        case 'basic': return { start: BEGINNING_LESSONS, end: BEGINNING_LESSONS + IELTS_PER_LEVEL };
        case 'intermediate': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL, end: BEGINNING_LESSONS + IELTS_PER_LEVEL * 2 };
        case 'upper': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL * 2, end: BEGINNING_LESSONS + IELTS_PER_LEVEL * 3 };
        case 'advanced': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL * 3, end: TOTAL_LESSONS };
        default: return { start: 0, end: TOTAL_LESSONS };
    }
}

function getNextLessonForDifficulty(difficultyKey) {
    const range = getLessonRangeForDifficulty(difficultyKey);

    // Find the first incomplete lesson in this range
    for (let i = range.start; i < range.end; i++) {
        const completed = appState.lessonHistory?.some(h => h.lessonNum === i);
        if (!completed) {
            return i;
        }
    }

    // All lessons in this range completed, return first lesson of range
    return range.start;
}

function getNextPracticeLesson(range) {
    // Find the lesson practiced longest ago (least recently) in this range
    // This cycles through lessons sequentially: after completing lesson 1,
    // lesson 1 becomes the most recent → next time lesson 2 is offered, etc.
    const history = appState.lessonHistory || [];
    let oldestTime = Infinity;
    let oldestLesson = range.start;

    for (let i = range.start; i < range.end; i++) {
        // Find the most recent time this lesson was practiced
        let lastPracticed = 0;
        for (let j = history.length - 1; j >= 0; j--) {
            if (history[j].lessonNum === i) {
                lastPracticed = history[j].date || 0;
                break;
            }
        }
        if (lastPracticed < oldestTime) {
            oldestTime = lastPracticed;
            oldestLesson = i;
        }
    }

    return oldestLesson;
}

function filterByDifficulty(level) {
    selectedDifficultyFilter = level;
    historyPage = 0;

    // Update chip/tab active states
    document.querySelectorAll('.difficulty-chip, .difficulty-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeEl = document.querySelector(`.difficulty-chip[data-level="${level}"]`) || document.querySelector(`.difficulty-tab[data-level="${level}"]`);
    if (activeEl) activeEl.classList.add('active');

    // Re-render home with filtered content
    renderHome();
}

function updateDifficultyCounts() {
    const beginEl = document.getElementById('countBeginning');
    if (beginEl) beginEl.textContent = BEGINNING_LESSONS;
    document.getElementById('countBasic').textContent = IELTS_PER_LEVEL;
    document.getElementById('countIntermediate').textContent = IELTS_PER_LEVEL;
    document.getElementById('countUpper').textContent = IELTS_PER_LEVEL;
    document.getElementById('countAdvanced').textContent = TOTAL_LESSONS - BEGINNING_LESSONS - (IELTS_PER_LEVEL * 3);
}

function startNextLesson() {
    const lessonToStart = getNextLessonForDifficulty(selectedDifficultyFilter);
    startLesson(lessonToStart);
}

// ==================== STREAK SHIELDS ====================
function renderShields() {
    const container = document.getElementById('homeShields');
    if (!container) return;
    const count = appState.streakShields || 0;
    if (count > 0) {
        container.innerHTML = '🛡️'.repeat(count);
        container.classList.add('has-shields');
    } else {
        container.innerHTML = '';
        container.classList.remove('has-shields');
    }
}

// ==================== WORD PET ====================

const DOG_STAGES = [
    // Real breeds, ordered by typical adult build. The visible size also grows
    // at every evolution so the collection reads as a clear small-to-giant journey.
    { minLevel: 1,   fallback: '🐶', name: 'Chihuahua',        size: 72,  buildKg: '1–3 kg',   habitat: ['🌿','🌱','🌼','🌿','🍀','🌼'],  stageCss: 'chihuahua' },
    { minLevel: 21,  fallback: '🐕', name: 'Pomeranian',       size: 78,  buildKg: '2–4 kg',   habitat: ['🌸','🍃','🦋','🌸','🍃','🦋'],  stageCss: 'pomeranian' },
    { minLevel: 41,  fallback: '🐕', name: 'Beagle',           size: 88,  buildKg: '9–14 kg',  habitat: ['🌻','🌿','🦋','🌻','🌿','🦋'],  stageCss: 'beagle' },
    { minLevel: 61,  fallback: '🐕', name: 'Pembroke Corgi',   size: 96,  buildKg: '10–14 kg', habitat: ['🌾','🌼','🏡','🌾','🌼','🏡'],  stageCss: 'corgi' },
    { minLevel: 81,  fallback: '🐶', name: 'English Bulldog',  size: 108, buildKg: '18–25 kg', habitat: ['🏠','🧱','🌳','🏠','🧱','🌳'],  stageCss: 'bulldog' },
    { minLevel: 101, fallback: '🐺', name: 'Siberian Husky',   size: 118, buildKg: '16–27 kg', habitat: ['🏔️','❄️','🌲','❄️','🏔️','🌨️'], stageCss: 'husky' },
    { minLevel: 121, fallback: '🦮', name: 'Golden Retriever', size: 128, buildKg: '25–34 kg', habitat: ['🌲','🍂','🐿️','🌲','🍁','🍂'], stageCss: 'retriever' },
    { minLevel: 141, fallback: '🐕', name: 'German Shepherd',  size: 138, buildKg: '30–40 kg', habitat: ['⛰️','🌲','🛡️','⛰️','🌲','🛡️'], stageCss: 'shepherd' },
    { minLevel: 161, fallback: '🐕‍🦺', name: 'Rottweiler',       size: 148, buildKg: '35–60 kg', habitat: ['🏰','🪨','🌲','🏰','🪨','🌲'], stageCss: 'rottweiler' },
    { minLevel: 181, fallback: '🐕', name: 'Tibetan Mastiff',  size: 160, buildKg: '45–72 kg', habitat: ['🏔️','🏯','☁️','🏔️','🏯','☁️'], stageCss: 'tibetan-mastiff' }
];

// Priced for a child's honest daily rhythm: one 10-question session earns
// ~40-50 🪙, so a snack is one session and a big meal is a good day.
const DOG_FOOD = [
    { id: 'bone',    emoji: '🦴', name: 'Crunchy Bone', price: 30,  growth: 5,   note: 'A tiny happy snack',     color: '#60a5fa' },
    { id: 'steak',   emoji: '🍖', name: 'Juicy Steak',  price: 80,  growth: 15,  note: 'Strong puppy energy',    color: '#fb7185' },
    { id: 'chicken', emoji: '🍗', name: 'Golden Chicken',price: 150, growth: 30,  note: 'Warm and super tasty',    color: '#f59e0b' },
    { id: 'cake',    emoji: '🧁', name: 'Pupcake',      price: 240, growth: 50,  note: 'A celebration treat',    color: '#c084fc' },
    { id: 'feast',   emoji: '👑', name: 'Royal Feast',  price: 550, growth: 120, note: 'The ultimate level boost',color: '#fbbf24' }
];

const DOG_ACCESSORIES = [
    // Hats (10)
    { id: 'bow',        emoji: '🎀', name: 'Bow',            price: 3000,   slot: 'head' },
    { id: 'cap',        emoji: '🧢', name: 'Cap',            price: 4000,   slot: 'head' },
    { id: 'partyhat',   emoji: '🥳', name: 'Party Hat',      price: 5000,   slot: 'head' },
    { id: 'beret',      emoji: '🫐', name: 'Beret',          price: 7000,   slot: 'head' },
    { id: 'hat',        emoji: '🎩', name: 'Top Hat',        price: 8000,   slot: 'head' },
    { id: 'cowboy',     emoji: '🤠', name: 'Cowboy Hat',     price: 12000,  slot: 'head' },
    { id: 'crown',      emoji: '👑', name: 'Crown',          price: 15000,  slot: 'head' },
    { id: 'santa',      emoji: '🎅', name: 'Santa Hat',      price: 18000,  slot: 'head' },
    { id: 'wizard',     emoji: '🧙', name: 'Wizard Hat',     price: 20000,  slot: 'head' },
    { id: 'viking',     emoji: '⚔️', name: 'Viking Helmet',  price: 30000,  slot: 'head' },
    // Eyewear (7)
    { id: 'nerd',       emoji: '🤓', name: 'Nerd Glasses',   price: 4000,   slot: 'eyes' },
    { id: 'glasses',    emoji: '🕶️', name: 'Sunglasses',     price: 5000,   slot: 'eyes' },
    { id: 'monocle',    emoji: '🧐', name: 'Monocle',        price: 6000,   slot: 'eyes' },
    { id: 'heartglass', emoji: '😍', name: 'Heart Glasses',  price: 8000,   slot: 'eyes' },
    { id: 'goggles',    emoji: '🥽', name: 'Goggles',        price: 9000,   slot: 'eyes' },
    { id: 'starglass',  emoji: '🤩', name: 'Star Glasses',   price: 10000,  slot: 'eyes' },
    { id: 'pixel',      emoji: '😎', name: 'Pixel Shades',   price: 15000,  slot: 'eyes' },
    // Neckwear (8)
    { id: 'collar',     emoji: '⭕', name: 'Collar',         price: 3000,   slot: 'neck' },
    { id: 'bandana',    emoji: '🔴', name: 'Bandana',        price: 4000,   slot: 'neck' },
    { id: 'bowtie',     emoji: '🎀', name: 'Bow Tie',        price: 5000,   slot: 'neck' },
    { id: 'scarf',      emoji: '🧣', name: 'Scarf',          price: 6000,   slot: 'neck' },
    { id: 'bellcollar', emoji: '🔔', name: 'Bell Collar',    price: 7000,   slot: 'neck' },
    { id: 'tie',        emoji: '👔', name: 'Tie',            price: 8000,   slot: 'neck' },
    { id: 'necklace',   emoji: '📿', name: 'Necklace',       price: 10000,  slot: 'neck' },
    { id: 'goldchain',  emoji: '⛓️', name: 'Gold Chain',     price: 20000,  slot: 'neck' },
    // Back/Body (8)
    { id: 'lifejacket', emoji: '🦺', name: 'Life Jacket',    price: 6000,   slot: 'body' },
    { id: 'backpack',   emoji: '🎒', name: 'Backpack',       price: 8000,   slot: 'body' },
    { id: 'sweater',    emoji: '🧥', name: 'Sweater',        price: 10000,  slot: 'body' },
    { id: 'saddle',     emoji: '🐴', name: 'Saddle',         price: 12000,  slot: 'body' },
    { id: 'cape',       emoji: '🦸', name: 'Cape',           price: 15000,  slot: 'body' },
    { id: 'tuxedo',     emoji: '🤵', name: 'Tuxedo',         price: 25000,  slot: 'body' },
    { id: 'wings',      emoji: '🪽', name: 'Wings',          price: 30000,  slot: 'body' },
    { id: 'armor',      emoji: '🛡️', name: 'Armor',          price: 50000,  slot: 'body' },
    // Effects (9)
    { id: 'flowercrown',emoji: '🌺', name: 'Flower Crown',   price: 8000,   slot: 'effect' },
    { id: 'bubblering', emoji: '🫧', name: 'Bubble Ring',     price: 10000,  slot: 'effect' },
    { id: 'musicnotes', emoji: '🎵', name: 'Music Notes',     price: 12000,  slot: 'effect' },
    { id: 'sparkles',   emoji: '✨', name: 'Sparkles',        price: 15000,  slot: 'effect' },
    { id: 'rainbow',    emoji: '🌈', name: 'Rainbow Aura',    price: 20000,  slot: 'effect' },
    { id: 'snowflurry', emoji: '❄️', name: 'Snow Flurry',     price: 20000,  slot: 'effect' },
    { id: 'lightning',  emoji: '⚡', name: 'Lightning',       price: 25000,  slot: 'effect' },
    { id: 'flame',      emoji: '🔥', name: 'Flame Collar',    price: 30000,  slot: 'effect' },
    { id: 'diamond',    emoji: '💎', name: 'Diamond Collar',  price: 50000,  slot: 'effect' },
    // Toys (8)
    { id: 'stick',      emoji: '🪵', name: 'Stick',           price: 1000,   slot: 'toy' },
    { id: 'ball',       emoji: '🎾', name: 'Ball',            price: 2000,   slot: 'toy' },
    { id: 'bonetoy',    emoji: '🦴', name: 'Bone Toy',        price: 3000,   slot: 'toy' },
    { id: 'kong',       emoji: '🟠', name: 'Kong',            price: 3500,   slot: 'toy' },
    { id: 'ropetoy',    emoji: '🪢', name: 'Rope Toy',        price: 4000,   slot: 'toy' },
    { id: 'frisbee',    emoji: '🥏', name: 'Frisbee',         price: 5000,   slot: 'toy' },
    { id: 'squeakduck', emoji: '🦆', name: 'Squeaky Duck',    price: 6000,   slot: 'toy' },
    { id: 'teddybear',  emoji: '🧸', name: 'Teddy Bear',      price: 7000,   slot: 'toy' },
    // Streak-exclusive (earned at 30-day streak, not purchasable)
    { id: 'streak-flame', emoji: '🔥', name: 'Streak Flame', price: 0, slot: 'effect', streakOnly: true }
];

// Per-breed anchor points for anatomical accessory slots (head, eyes, neck).
// Values are CSS percentages relative to the pet-wrapper bounding box.
// sizeMul: multiplier applied to stage.size to get the accessory font-size.
const BREED_ANCHORS = {
    chihuahua: {
        head: { top: '-20%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '22%', left: '50%', sizeMul: 0.28 },
        neck: { top:  '65%', left: '50%', sizeMul: 0.26 }
    },
    pomeranian: {
        head: { top: '-22%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '21%', left: '50%', sizeMul: 0.27 },
        neck: { top:  '65%', left: '50%', sizeMul: 0.25 }
    },
    beagle: {
        head: { top: '-16%', left: '50%', sizeMul: 0.42 },
        eyes: { top:  '24%', left: '50%', sizeMul: 0.27 },
        neck: { top:  '66%', left: '50%', sizeMul: 0.25 }
    },
    corgi: {
        head: { top: '-18%', left: '50%', sizeMul: 0.43 },
        eyes: { top:  '23%', left: '50%', sizeMul: 0.27 },
        neck: { top:  '64%', left: '50%', sizeMul: 0.25 }
    },
    bulldog: {
        head: { top: '-16%', left: '50%', sizeMul: 0.46 },
        eyes: { top:  '23%', left: '50%', sizeMul: 0.29 },
        neck: { top:  '64%', left: '50%', sizeMul: 0.29 }
    },
    husky: {
        head: { top: '-18%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '24%', left: '50%', sizeMul: 0.28 },
        neck: { top:  '66%', left: '50%', sizeMul: 0.26 }
    },
    retriever: {
        head: { top: '-17%', left: '50%', sizeMul: 0.43 },
        eyes: { top:  '24%', left: '50%', sizeMul: 0.27 },
        neck: { top:  '66%', left: '50%', sizeMul: 0.26 }
    },
    shepherd: {
        head: { top: '-19%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '22%', left: '50%', sizeMul: 0.27 },
        neck: { top:  '65%', left: '50%', sizeMul: 0.27 }
    },
    rottweiler: {
        head: { top: '-16%', left: '50%', sizeMul: 0.46 },
        eyes: { top:  '23%', left: '50%', sizeMul: 0.29 },
        neck: { top:  '64%', left: '50%', sizeMul: 0.29 }
    },
    'tibetan-mastiff': {
        head: { top: '-24%', left: '50%', sizeMul: 0.50 },
        eyes: { top:  '19%', left: '50%', sizeMul: 0.30 },
        neck: { top:  '62%', left: '50%', sizeMul: 0.31 }
    }
};

// Slot size multipliers for ambient (non-anatomical) slots — same for all breeds
const AMBIENT_SLOT_SIZES = {
    body:   0.52,
    effect: 0.38,
    toy:    0.32
};

const // Tuned so the dog asks for food about once a day (gentle urgency): he is
// visibly hungry by the next morning and very hungry after two days — but
// never loses XP or levels, and one session always fills him up again.
HUNGER_DECAY_SCHEDULE = [
    { hoursWithout: 48, level: 0  },
    { hoursWithout: 36, level: 25 },
    { hoursWithout: 20, level: 50 },
    { hoursWithout: 10, level: 75 },
    { hoursWithout:  0, level: 100 }
];

const PET_PHRASES = {
    happy: [
        "I feel so smart today! 🌟",
        "You're amazing! Teach me more!",
        "Let's learn another word! 🎉",
        "I love studying with you! ❤️",
        "We're unstoppable! 💪"
    ],
    neutral: [
        "I missed you… will you study today? 🥺",
        "My tummy is rumbling…",
        "One lesson? Please? 🥺",
        "Come on, just one round! 🌱",
        "I'm waiting for you! ⏳"
    ],
    sleepy: [
        "Zzz… I'm so hungry… 💤",
        "Where have you been? I've been waiting…",
        "Please come back! I need you! 💤",
        "I'm fading away… study with me? 😢",
        "I miss learning new words… 😴"
    ],
    starving: [
        "I'm so weak… please feed me! 😢",
        "I can barely keep my eyes open… 💀",
        "A lesson would save me right now…",
        "Don't let me fade away! 😭",
        "I need words to survive! 🆘"
    ],
    hungry: [
        "My stomach is growling… 🥺",
        "Just one little lesson? Please?",
        "I could really use some brain food…",
        "Feed me knowledge! 📚",
        "A quick review would be delicious! 🍽️"
    ]
};

const PET_QUESTS = [
    { id: 'lesson',    text: 'Complete 1 lesson today',          coins: 5, hunger: 30,
      eligible: () => true },
    { id: 'perfect',   text: 'Get 100% accuracy in a lesson',   coins: 10, hunger: 40,
      eligible: () => true },
    { id: 'srs',       text: 'Complete an SRS review session',   coins: 5, hunger: 30,
      eligible: s => s.srs && Object.keys(s.srs).length >= 3 },
    { id: 'wotd',      text: 'Open the Word of the Day',        coins: 3, hunger: 20,
      eligible: () => true },
    { id: 'streak3',   text: 'Study 3 days in a row',           coins: 15, hunger: 50,
      eligible: () => true }
];

function getPointsForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(3 * Math.pow(level - 1, 2) + 15 * (level - 1));
}

function getDogLevel(growthXP) {
    let level = 1;
    for (let l = 200; l >= 1; l--) {
        if (growthXP >= getPointsForLevel(l)) { level = l; break; }
    }
    return level;
}

function getDogStage(level) {
    for (let i = DOG_STAGES.length - 1; i >= 0; i--) {
        if (level >= DOG_STAGES[i].minLevel) return DOG_STAGES[i];
    }
    return DOG_STAGES[0];
}

function getDogTitle(level) {
    if (level >= 200) return 'Ultimate Champion';
    if (level >= 181) return 'Mighty Tibetan Mastiff';
    if (level >= 161) return 'Powerful Rottweiler';
    if (level >= 141) return 'Brave German Shepherd';
    if (level >= 121) return 'Gentle Golden Retriever';
    if (level >= 101) return 'Arctic Husky';
    if (level >= 81)  return 'Strong Bulldog';
    if (level >= 61)  return 'Cheerful Corgi';
    if (level >= 41)  return 'Happy Beagle';
    if (level >= 21)  return 'Fluffy Pomeranian';
    return 'Little Chihuahua';
}

function computeCurrentHunger(state) {
    if (!state.petLastFed) return 50;
    const hoursSince = (Date.now() - state.petLastFed) / 3600000;
    for (const step of HUNGER_DECAY_SCHEDULE) {
        if (hoursSince >= step.hoursWithout) return step.level;
    }
    return 100;
}

function feedPet(amount) {
    if (!appState) return;
    appState.petHunger = Math.min(100, (appState.petHunger || 0) + amount);
    appState.petLastFed = Date.now();
    appState.cleanedPoopIds = []; // Reset — new feed cycle, new poop windows
    saveUserData(currentUser, appState);
}

function getPetMood() {
    const hunger = computeCurrentHunger(appState);
    if (hunger === 0)  return 'starving';
    if (hunger <= 25)  return 'hungry';

    const poopCount = (appState.petPoops || []).length;
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // 3+ poops drops mood one tier
    if (poopCount >= POOP_MOOD_THRESHOLD) {
        if (appState.lastStudyDate === today)      return 'neutral';
        if (appState.lastStudyDate === yesterday)  return 'sleepy';
        return 'hungry';
    }

    if (appState.lastStudyDate === today)      return 'happy';
    if (appState.lastStudyDate === yesterday)  return 'neutral';
    return 'sleepy';
}

function getTimeOfDayClass() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'time-morning';
    if (h >= 12 && h < 18) return 'time-afternoon';
    if (h >= 18 && h < 22) return 'time-evening';
    return 'time-night';
}

function applyGrowthDecay() {
    if (!appState || !appState.lastStudyDate) return;
    const today = new Date().toDateString();
    if (appState.lastDecayDate === today) return; // Already applied today
    if (appState.lastStudyDate === today) { appState.lastDecayDate = today; return; } // Studied today, no decay

    const lastStudy = new Date(appState.lastStudyDate);
    const now = new Date();
    const daysMissed = Math.floor((now - lastStudy) / 86400000) - 1; // -1 because day after study is OK
    if (daysMissed <= 0) { appState.lastDecayDate = today; return; }

    const daysToApply = Math.min(daysMissed, 7); // Max 7 days of decay
    const decayPercent = daysToApply * 0.02; // 2% per day
    const oldLevel = appState.dogLevel || 1;
    const decayAmount = Math.floor((appState.dogGrowthXP || 0) * decayPercent);

    if (decayAmount > 0) {
        appState.dogGrowthXP = Math.max(0, (appState.dogGrowthXP || 0) - decayAmount);
        appState.dogLevel = getDogLevel(appState.dogGrowthXP);

        if (appState.dogLevel < oldLevel) {
            const stage = getDogStage(appState.dogLevel);
            setTimeout(() => showPetSpeechBubble(`Oh no! I shrunk to ${stage.name}… Buy me food! 😢`), 800);
        } else {
            setTimeout(() => showPetSpeechBubble("I'm getting hungry… please feed me! 🥺"), 800);
        }
        saveUserData(currentUser, appState);
    }
    appState.lastDecayDate = today;
}

function renderWordPet() {
    const heroZone  = document.getElementById('petHeroZone');
    const habEmojis = document.getElementById('habitatEmojis');
    const topbar    = document.getElementById('petHeroTopbar');
    const stage_el  = document.getElementById('petHeroStage');
    const xpbar_el  = document.getElementById('petHeroXpbar');
    if (!heroZone || !stage_el) return;

    var level, stage, mood, coins;
    try {
        try { applyGrowthDecay(); } catch(e) {}
        level = appState.dogLevel || 1;
        stage = getDogStage(level) || DOG_STAGES[0];
        mood  = getPetMood() || 'happy';
        coins = appState.coins || 0;
    } catch(e) {
        level = 1; stage = DOG_STAGES[0]; mood = 'happy'; coins = 0;
    }

    // Hero zone stage gradient + time of day
    try {
        heroZone.className = 'pet-hero-zone ' + (typeof getTimeOfDayClass === 'function' ? getTimeOfDayClass() : '');
        heroZone.dataset.stage = stage.stageCss;
    } catch(e) {}

    // Floating habitat emojis
    try {
        if (habEmojis && stage.habitat) {
            const positions = [
                { left: '8%',  bottom: '15%' },
                { left: '22%', bottom: '45%' },
                { left: '42%', bottom: '8%' },
                { left: '62%', bottom: '55%' },
                { left: '80%', bottom: '25%' },
                { left: '92%', bottom: '60%' }
            ];
            habEmojis.innerHTML = stage.habitat.map((e, i) => {
                const p = positions[i] || positions[0];
                const dur = 7 + (i * 1.7) % 5;
                const delay = (i * 1.3) % 4;
                return `<span style="left:${p.left};bottom:${p.bottom};--drift-duration:${dur}s;--drift-delay:-${delay}s">${e}</span>`;
            }).join('');
        }
    } catch(e) {}

    // ALWAYS render pet creature first — even if later code crashes, the dog is visible
    // Milo is a rigged SVG (petart.js) so he can breathe, wag and react;
    // the emoji stays as the fallback if that module ever fails to load.
    const petBodyHTML = (typeof petDogSVG === 'function')
        ? petDogSVG({ stageCss: stage.stageCss, size: Math.round(stage.size * 1.55), mood, level, stageMinLevel: stage.minLevel })
        : `<span style="font-size:${stage.size}px;line-height:1">${stage.fallback}</span>`;
    stage_el.innerHTML = `
        <button type="button" class="pet-creature ${mood}" onclick="onPetTap()"
                data-stage="${stage.stageCss}" aria-label="Play with your level ${level} ${stage.name}">
            ${petBodyHTML}
        </button>
    `;

    // Naming prompt (first time)
    if (!appState.petName) {
        if (topbar) topbar.innerHTML = '';
        if (xpbar_el) xpbar_el.innerHTML = '';
        stage_el.innerHTML += `
            <div class="pet-name-form" style="margin-top:12px">
                <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);text-shadow:0 1px 4px rgba(0,0,0,0.3)">Name your dog!</div>
                <input class="pet-name-input" id="petNameInput" type="text"
                       maxlength="12" placeholder="Enter a name…"
                       onkeydown="if(event.key==='Enter')savePetName()">
                <button class="pet-name-btn" onclick="savePetName()">Name it! 🐾</button>
            </div>
        `;
        return;
    }

    // Everything below is wrapped in try-catch — pet is already visible above
    try {

    // XP progress bar
    const currentXP = appState.dogGrowthXP || 0;
    const currentLevelXP = getPointsForLevel(level);
    const nextLevelXP = level < 200 ? getPointsForLevel(level + 1) : currentLevelXP;
    const xpInLevel = currentXP - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const xpPercent = level >= 200 ? 100 : (xpNeeded > 0 ? Math.min(100, Math.floor(xpInLevel / xpNeeded * 100)) : 0);
    const petTier = (typeof petTierForLevel === 'function') ? petTierForLevel(level, stage.minLevel) : 0;
    const petPolish = (typeof petPolishForLevel === 'function') ? petPolishForLevel(level, stage.minLevel) : 0;
    const petStyleNames = ['Natural', 'Gem', 'Styled', 'Brilliant'];
    const petStyleName = petStyleNames[petTier] || petStyleNames[0];
    const safePetName = String(appState.petName || 'Milo').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
    const polishPips = Array.from({ length: 4 }, (_, i) =>
        `<span class="pet-polish-pip ${i < petPolish ? 'active' : ''}"></span>`
    ).join('');

    // Active accessories — per-breed anchor points for anatomical slots
    const active = appState.activeAccessories || [];
    const anchors = BREED_ANCHORS[stage.stageCss] || BREED_ANCHORS.chihuahua;

    const accPositions = appState.accPositions || {};

    const accSpans = active.map(id => {
        const acc = DOG_ACCESSORIES.find(a => a.id === id);
        if (!acc) return '';

        let styleStr;
        const customPos = accPositions[id];

        if (customPos) {
            const sz = anchors[acc.slot]
                ? Math.max(18, Math.round(stage.size * anchors[acc.slot].sizeMul))
                : Math.max(18, Math.round(stage.size * (AMBIENT_SLOT_SIZES[acc.slot] || 0.35)));
            styleStr = `font-size:${sz}px;top:${customPos.top};left:${customPos.left};transform:translate(-50%,-50%)`;
        } else if (anchors[acc.slot]) {
            const a = anchors[acc.slot];
            const sz = Math.max(18, Math.round(stage.size * a.sizeMul));
            styleStr = `font-size:${sz}px;top:${a.top};left:${a.left};transform:translateX(-50%)`;
        } else {
            const sz = Math.max(18, Math.round(stage.size * (AMBIENT_SLOT_SIZES[acc.slot] || 0.35)));
            styleStr = `font-size:${sz}px`;
        }
        return `<span class="pet-accessory acc-${acc.slot} draggable-pet-acc pet-accessory-${id}" data-acc-id="${id}" aria-hidden="true" style="${styleStr}"><span class="pet-accessory-glyph">${acc.emoji}</span></span>`;
    }).join('');

    // Daily quest tracking
    const today = new Date().toDateString();
    if (!appState.petQuest || appState.petQuest.lastDate !== today) {
        try {
            const quest = getDailyQuest(appState);
            if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
            appState.petQuest.lastDate = today;
            appState.petQuest.questId  = quest.id;
            appState.petQuest.completed = false;
        } catch(e) {}
    }

    // Poop lifecycle — evaluate spawn
    try { evaluatePoopSpawn(); } catch(e) {}

    // Build poop HTML for stage
    const poopsHTML = (appState.petPoops || []).map(p => {
        const age = (Date.now() - p.born) / 3600000;
        const isStinky = age >= POOP_STINK_HOURS;
        return `<div class="pet-poop ${isStinky ? 'stinky' : ''}" data-poop-id="${p.id}" style="left:${p.x}%;top:${p.y}%">💩${isStinky ? '<span class="poop-stink">💨</span>' : ''}</div>`;
    }).join('');

    // Hero topbar — avatar, level, coins, streak, info
    if (topbar) {
        const ud = getUserData(currentUser) || appState || {};
        const avatar = ud.avatar || appState.avatar || '😊';
        const streak = ud.streak || appState.streak || 0;
        topbar.innerHTML = `
            <div class="pet-hero-left">
                <button type="button" class="pet-hero-avatar" onclick="navigateToProfile()" aria-label="Open profile">${avatar}</button>
                <div class="pet-hero-identity">
                    <div class="pet-identity-name"><strong>${safePetName}</strong><span class="pet-level-chip"><small>LV</small>${level}</span></div>
                    <div class="pet-identity-style">
                        <span>${stage.name} · ${petStyleName}</span>
                        <span class="pet-polish-meter" title="Level shine ${petPolish} of 4" aria-label="Level shine ${petPolish} of 4">${polishPips}</span>
                    </div>
                </div>
            </div>
            <div class="pet-hero-right">
                <button type="button" class="pet-hero-coins" onclick="showPetShop()" aria-label="${coins} coins; open shop">🪙 ${coins}</button>
                <div class="pet-hero-streak ${getStreakTier(streak) > 0 ? 'streak-tier-' + getStreakTier(streak) : ''}" aria-label="${streak} day streak">🔥 ${streak}</div>
                <button type="button" class="pet-hero-info" onclick="showPetInfo()" aria-label="Pet info">ℹ️</button>
            </div>
        `;
    }

    // Pet creature + accessories + poops. The dog itself is the rigged SVG
    // from petart.js (breathing, wagging, blinking, reacting) — the emoji
    // remains the fallback if that module is ever unavailable.
    const _slotsUsed = (appState.activeAccessories || []).map(id => {
        const a = DOG_ACCESSORIES.find(x => x.id === id);
        return a ? a.slot : null;
    });
    const petArtHTML = (typeof petDogSVG === 'function')
        ? petDogSVG({
            stageCss: stage.stageCss, size: Math.round(stage.size * 1.55), mood,
            level, stageMinLevel: stage.minLevel,
            // a bought hat/necklace always wins — he never wears two
            hasHeadAccessory: _slotsUsed.indexOf('head') !== -1,
            hasNeckAccessory: _slotsUsed.indexOf('neck') !== -1,
          })
        : `<span style="font-size:${stage.size}px;line-height:1">${stage.fallback}</span>`;
    stage_el.innerHTML = `
        <div class="pet-wrapper">
            <button type="button" class="pet-creature ${mood}" onclick="onPetTap()"
                    data-stage="${stage.stageCss}" aria-label="Play with ${safePetName}, level ${level} ${stage.name}, ${petStyleName} style, shine ${petPolish} of 4">
                ${petArtHTML}
            </button>
            ${accSpans}
        </div>
        ${poopsHTML}
    `;

    // Make equipped accessories draggable on the pet
    setTimeout(() => { try { initAccDrag(); } catch(e) {} }, 50);

    // Make poops draggable to trash
    setTimeout(() => { try { initPoopDrag(); } catch(e) {} }, 60);

    // XP bar + hunger hearts at bottom of habitat
    const hunger = computeCurrentHunger(appState);
    const fullHearts = Math.round(hunger / 20);
    const heartsHTML = Array.from({length: 5}, (_, i) =>
        `<span class="hunger-heart ${i < fullHearts ? 'full' : 'empty'}">${i < fullHearts ? '❤️' : '🖤'}</span>`
    ).join('');
    const hungerLabel = hunger === 0 ? 'Starving!' : hunger <= 25 ? 'Hungry' : hunger >= 75 ? 'Full' : 'Ok';

    const hasPoops = (appState.petPoops || []).length > 0;
    const trashBtnHTML = hasPoops ? '<button type="button" class="pet-trash-btn" id="petTrashBtn" aria-label="Clean up pet habitat">🗑️</button>' : '';

    if (xpbar_el) {
        xpbar_el.innerHTML = `
            <div class="pet-bottom-strip">
                <div class="pet-bottom-left">
                    <div class="hunger-hearts-row" role="img" aria-label="Hunger ${hunger} percent, ${hungerLabel}">
                        ${heartsHTML}
                        <span class="hunger-label ${hunger <= 25 ? 'hunger-warning' : ''}">${hungerLabel}</span>
                    </div>
                </div>
                ${trashBtnHTML}
                <button type="button" class="pet-shop-btn-hero" onclick="showPetShop()">🛒 Shop</button>
            </div>
            <div class="pet-hero-xp-track" role="progressbar" aria-label="Level ${level} experience"
                 aria-valuemin="0" aria-valuemax="${level >= 200 ? 100 : xpNeeded}" aria-valuenow="${level >= 200 ? 100 : Math.max(0, xpInLevel)}">
                <div class="pet-hero-xp-fill" style="width:${xpPercent}%"></div>
            </div>
            <span class="pet-hero-xp-label">${level >= 200 ? 'MAX LEVEL · Full brilliance' : `${xpInLevel}/${xpNeeded} XP · Shine ${petPolish}/4`}</span>
        `;
    }

    // Food wish + evolution countdown live below the habitat.
    const questCard = document.getElementById('petQuestCard');
    if (questCard) {
        questCard.innerHTML =
            (typeof petQuestLineHTML === 'function' ? petQuestLineHTML() : '') +
            (typeof petEvolutionLineHTML === 'function' ? petEvolutionLineHTML() : '');
    }

    // ==================== PET EMOTIONAL MEMORY GREETING ====================
    // Higher priority than hunger/poop messages — fire once per day max
    const _today = new Date().toDateString();
    const _mem = appState.petMemory || {};
    const _alreadyGreetedToday = _mem.lastSeenGreeted === _today;
    let _emoMessage = null;

    if (!_alreadyGreetedToday) {
        const gap = _mem.pendingAbsenceGreet || 0;
        const lessonsTogether = _mem.lessonsTogether || 0;
        const streakBroken = _mem.lastStreakBroken || 0;
        const broke = streakBroken >= 3 && _mem.lastStreakBrokenDate &&
                      (Date.now() - _mem.lastStreakBrokenDate) < 86400000 * 2;

        if (gap >= 7) {
            _emoMessage = `A whole week!? I missed you SO much! 🥺💖`;
        } else if (gap >= 3) {
            _emoMessage = `${gap} days?! I thought you forgot me… 😢 Welcome back!`;
        } else if (broke) {
            _emoMessage = `Our ${streakBroken}-day streak ended… but we'll build it back! 💪`;
        } else if (gap === 2) {
            _emoMessage = `Two whole days! Are you okay? Let's learn! 🐾`;
        } else if (lessonsTogether >= 100 && Math.random() < 0.25) {
            _emoMessage = `${lessonsTogether} lessons together! You're my hero! 🏆`;
        } else if (lessonsTogether >= 50 && Math.random() < 0.2) {
            _emoMessage = `Best buddies for ${lessonsTogether} lessons! 🌟`;
        } else if ((appState.bestStreak || 0) >= 14 && (appState.streak || 0) >= (appState.bestStreak || 0) - 1 && Math.random() < 0.3) {
            _emoMessage = `Almost a new record! ${appState.bestStreak}+ days incoming! 🔥`;
        }

        if (_emoMessage) {
            _mem.lastSeenGreeted = _today;
            // Clear the pending absence after greeting
            _mem.pendingAbsenceGreet = 0;
            // Fade out the streak-broken memory after greeting
            if (broke) { _mem.lastStreakBroken = 0; }
            saveUserData(currentUser, appState);
        }
    }

    // Auto-show speech bubble (priority: emo > hunger > stink)
    if (_emoMessage) {
        setTimeout(() => showPetSpeechBubble(_emoMessage), 700);
    } else if (hunger === 0) {
        setTimeout(() => showPetSpeechBubble("I'm so hungry… buy me food! 😢"), 500);
    } else if ((appState.petPoops || []).some(p => (Date.now() - p.born) / 3600000 >= POOP_STINK_HOURS)) {
        setTimeout(() => showPetSpeechBubble("It's so stinky! Please clean up! 🤢"), 600);
    }

    } catch(petErr) {
        console.error('renderWordPet error:', petErr);
        // Pet creature is already rendered above — just show basic topbar
        if (topbar) topbar.innerHTML = `<div class="pet-hero-right"><div class="pet-hero-coins" onclick="showPetShop()">🪙 ${coins}</div></div>`;
    }
}

function showPetInfo() {
    const existing = document.getElementById('petInfoModal');
    if (existing) existing.remove();

    const level = appState.dogLevel || 1;
    const currentXP = appState.dogGrowthXP || 0;

    // Build stages list (10 stages, 2 columns)
    const stagesHTML = DOG_STAGES.map(s => {
        const unlocked = level >= s.minLevel;
        const isCurrent = getDogStage(level) === s;
        const dog = typeof petDogSVG === 'function'
            ? petDogSVG({ stageCss: s.stageCss, size: Math.round(52 + (s.size - 72) * 0.28), level: s.minLevel, stageMinLevel: s.minLevel })
            : `<span class="pet-info-emoji">${s.fallback}</span>`;
        return `<div class="pet-info-stage pet-evolution-card ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}"
                     aria-label="${s.name}, unlocks at level ${s.minLevel}${isCurrent ? ', current dog' : ''}">
            <span class="pet-evolution-art">${dog}</span>
            <span class="pet-info-label">${s.name}</span>
            <span class="pet-info-pts">Level ${s.minLevel} · ${s.buildKg}</span>
            <span class="pet-evolution-state">${isCurrent ? 'My dog' : unlocked ? 'Unlocked' : 'Locked'}</span>
        </div>`;
    }).join('');

    // Food catalog
    const foodHTML = DOG_FOOD.map(f =>
        `<div class="pet-info-stage pet-food-mini" style="--food-color:${f.color}"><span class="pet-food-mini-art">${petFoodArt(f)}</span><span class="pet-info-label">${f.name}</span><span class="pet-info-pts">${f.price} coins · +${f.growth} XP</span></div>`
    ).join('');

    const currentStage = getDogStage(level);
    const currentDog = typeof petDogSVG === 'function'
        ? petDogSVG({ stageCss: currentStage.stageCss, size: 110, level, stageMinLevel: currentStage.minLevel })
        : currentStage.fallback;

    const overlay = document.createElement('div');
    overlay.id = 'petInfoModal';
    overlay.className = 'pet-info-modal-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="pet-info-modal" style="max-height:80vh;overflow-y:auto">
            <button class="pet-info-close" aria-label="Close dog collection" onclick="document.getElementById('petInfoModal').remove()">✕</button>
            <div class="pet-collection-hero">
                <div class="pet-collection-dog">${currentDog}</div>
                <div><span class="pet-collection-kicker">MY PET COLLECTION</span><h3>${currentStage.name}</h3><p>Level ${level} · Keep learning to discover the next cute dog.</p></div>
            </div>

            <div class="pet-collection-section-title"><span>Dog evolution</span><small>10 real breeds · small → giant</small></div>
            <div class="pet-info-stages">${stagesHTML}</div>

            <div class="pet-collection-section-title"><span>Favorite food</span><small>Food adds growth XP</small></div>
            <div class="pet-info-stages">${foodHTML}</div>

            <div class="pet-info-tips" style="margin-top:12px">
                <div class="pet-info-tip">🪙 <strong>Coins</strong> = earned from completing lessons</div>
                <div class="pet-info-tip">🛒 <strong>Shop</strong> = buy food to grow, accessories to dress up</div>
                <div class="pet-info-tip">📉 <strong>Warning</strong> = dog loses 2% growth per missed day!</div>
                <div class="pet-info-tip">👆 <strong>Tap</strong> your dog for encouragement!</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

let _shopTab = 'food';
let _accCategory = 'all';

const ACC_CATEGORIES = [
    { id: 'all',    label: 'All',     emoji: '🛍️' },
    { id: 'head',   label: 'Hats',    emoji: '🎩' },
    { id: 'eyes',   label: 'Eyes',    emoji: '🕶️' },
    { id: 'neck',   label: 'Neck',    emoji: '🧣' },
    { id: 'body',   label: 'Body',    emoji: '🧥' },
    { id: 'effect', label: 'Effects', emoji: '✨' },
    { id: 'toy',    label: 'Toys',    emoji: '🎾' }
];

function petFoodArt(food) {
    const id = food && food.id;
    const common = 'viewBox="0 0 80 80" aria-hidden="true" focusable="false"';
    if (id === 'bone') return `<svg ${common}><g transform="rotate(-18 40 40)"><path d="M23 34h34a9 9 0 1 1 8 12 9 9 0 1 1-12 8H27a9 9 0 1 1-12-8 9 9 0 1 1 8-12Z" fill="#fff8e7" stroke="#c08457" stroke-width="3"/><path d="M30 39h24" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></g></svg>`;
    if (id === 'steak') return `<svg ${common}><path d="M18 50q-5-20 15-31 24-13 34 7 8 17-9 29-19 13-40-5Z" fill="#f87171" stroke="#9f1239" stroke-width="3"/><path d="M28 44q2-13 14-18 12-4 17 5 5 10-6 16-13 7-25-3Z" fill="#fecaca"/><circle cx="46" cy="35" r="7" fill="#fff7ed" stroke="#d97706" stroke-width="2"/><path d="M22 51q18 8 35 0" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/></svg>`;
    if (id === 'chicken') return `<svg ${common}><path d="M32 20q17-7 27 8 9 14-2 27-13 15-30 3-16-12-6-27 4-7 11-11Z" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M24 55 14 65m8-3-7-7m4 12-7-7" stroke="#fff7ed" stroke-width="7" stroke-linecap="round"/><path d="M33 27q12-5 19 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/></svg>`;
    if (id === 'cake') return `<svg ${common}><path d="M22 39h36l-4 27H26Z" fill="#f9a8d4" stroke="#9d174d" stroke-width="3"/><path d="m26 45 4 15m7-15 2 17m11-17-2 15" stroke="#fff" stroke-width="3" opacity=".7"/><path d="M19 39q2-16 16-13 8-14 16-1 12-1 12 14Z" fill="#fff7ed" stroke="#c084fc" stroke-width="3"/><circle cx="42" cy="19" r="5" fill="#ef4444"/><path d="M42 14q1-7 7-8" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/></svg>`;
    return `<svg ${common}><path d="M14 31 25 42l15-24 15 24 11-11-5 35H19Z" fill="#fbbf24" stroke="#92400e" stroke-width="3"/><circle cx="25" cy="43" r="4" fill="#fb7185"/><circle cx="40" cy="31" r="5" fill="#60a5fa"/><circle cx="55" cy="43" r="4" fill="#c084fc"/><path d="M25 57h30" stroke="#fff7ed" stroke-width="5" stroke-linecap="round"/></svg>`;
}

function petAccessoryRarity(acc) {
    const price = Number(acc && acc.price) || 0;
    if (acc && acc.streakOnly) return { key: 'special', label: 'Streak gift' };
    if (price >= 30000) return { key: 'legendary', label: 'Legendary' };
    if (price >= 15000) return { key: 'epic', label: 'Epic' };
    if (price >= 7000) return { key: 'rare', label: 'Rare' };
    return { key: 'playful', label: 'Playful' };
}

function petAccessoryArt(acc) {
    const rarity = petAccessoryRarity(acc);
    return `<span class="shop-sticker rarity-${rarity.key}" aria-hidden="true">
        <span class="shop-sticker-spark one">✦</span><span class="shop-sticker-spark two">●</span>
        <span class="shop-sticker-glyph">${acc.emoji}</span>
    </span>`;
}

function showPetShop() {
    const existing = document.getElementById('petShopModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'petShopModal';

    if (_shopTab === 'food') {
        // Bottom drawer — dog stays visible at top for drag-to-feed
        overlay.className = 'pet-shop-drawer-overlay';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = renderShopContent();
        document.body.appendChild(overlay);
        // Slide-up animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('open'));
        });
        // Initialize drag-to-feed after rendering
        setTimeout(() => initDragToFeed(), 50);
    } else {
        // Full modal for accessories (no dragging needed)
        overlay.className = 'pet-info-modal-overlay';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = renderShopContent();
        document.body.appendChild(overlay);
    }
}

function renderShopContent() {
    const coins = appState.coins || 0;

    const studiedToday = appState.lastStudyDate === new Date().toDateString();
    const foodItems = DOG_FOOD.map(f => {
        const canAfford = coins >= f.price;
        const feastBonus = f.id === 'feast' && studiedToday;
        return `<article class="shop-item shop-card food-shop-card ${canAfford ? 'draggable-food' : 'disabled'}"
                     data-food-id="${f.id}" data-food-emoji="${f.emoji}" style="--food-color:${f.color}">
            <div class="shop-food-art">${petFoodArt(f)}<span class="shop-xp-burst">+${f.growth} XP</span></div>
            <div class="shop-item-info">
                <div class="shop-item-name">${f.name}</div>
                <div class="shop-item-desc">${f.note}</div>
                ${feastBonus ? '<span class="feast-bonus-hint">Today: +30 bonus XP</span>' : ''}
            </div>
            <button type="button" class="shop-buy-btn ${canAfford ? '' : 'disabled'}"
                    ${canAfford ? `onclick="buyFood('${f.id}', this)"` : 'disabled'}
                    aria-label="Feed dog ${f.name} for ${f.price} coins">${canAfford ? 'Feed' : 'Need more'} <strong>${f.price}</strong><span aria-hidden="true">●</span></button>
        </article>`;
    }).join('');

    // Filter accessories by category (hide streakOnly items unless earned)
    const filteredAcc = DOG_ACCESSORIES.filter(a => {
        if (a.streakOnly && !(appState.petAccessories || []).includes(a.id)) return false;
        return _accCategory === 'all' || a.slot === _accCategory;
    });

    const accItems = filteredAcc.map(a => {
        const owned = (appState.petAccessories || []).includes(a.id);
        const equipped = (appState.activeAccessories || []).includes(a.id);
        const canAfford = coins >= a.price;
        const rarity = petAccessoryRarity(a);
        let btnHTML;
        if (owned) {
            btnHTML = `<button type="button" class="shop-buy-btn ${equipped ? 'equipped' : 'owned'}" onclick="toggleAccessory('${a.id}')">${equipped ? 'Take off' : 'Wear it'}</button>`;
        } else {
            btnHTML = `<button type="button" class="shop-buy-btn ${canAfford ? '' : 'disabled'}" ${canAfford ? `onclick="buyAccessory('${a.id}')"` : 'disabled'}>${canAfford ? 'Get it' : 'Need more'} <strong>${a.price}</strong><span aria-hidden="true">●</span></button>`;
        }
        return `<article class="shop-item shop-card accessory-shop-card rarity-${rarity.key} ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''} ${!owned && !canAfford ? 'disabled' : ''}">
            <div class="shop-accessory-art">${petAccessoryArt(a)}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${a.name}</div>
                <div class="shop-item-meta"><span class="shop-rarity rarity-${rarity.key}">${rarity.label}</span><span>${ACC_CATEGORIES.find(c => c.id === a.slot)?.label || a.slot}</span></div>
                <div class="shop-item-desc">${equipped ? 'Your dog is wearing this' : owned ? 'Ready in your wardrobe' : 'A new look for your best friend'}</div>
            </div>
            ${btnHTML}
        </article>`;
    }).join('');

    // Category filter pills for accessories tab
    const catPills = ACC_CATEGORIES.map(c =>
        `<button type="button" class="shop-cat-pill ${_accCategory === c.id ? 'active' : ''}" aria-pressed="${_accCategory === c.id}" onclick="_accCategory='${c.id}';refreshShop()"><span aria-hidden="true">${c.emoji}</span>${c.label}</button>`
    ).join('');

    const isDrawer = _shopTab === 'food';
    const stage = getDogStage(appState.dogLevel || 1);
    const miniDog = typeof petDogSVG === 'function'
        ? petDogSVG({ stageCss: stage.stageCss, size: 74, level: appState.dogLevel || 1, stageMinLevel: stage.minLevel })
        : stage.fallback;
    return `
        <div class="pet-shop-modal">
            <button type="button" class="pet-info-close" aria-label="Close pet shop" onclick="document.getElementById('petShopModal').remove()">✕</button>
            <div class="shop-hero">
                <div class="shop-hero-dog">${miniDog}</div>
                <div class="shop-hero-copy"><span>PAWS & TREATS</span><h3>${isDrawer ? 'What should we eat?' : 'Make your dog shine!'}</h3><p>${isDrawer ? 'Every snack helps your dog grow.' : 'Collect cute styles. Looks only—no battle advantage.'}</p></div>
                <div class="shop-wallet" aria-label="${coins} coins"><span aria-hidden="true">●</span><strong>${coins}</strong></div>
            </div>
            <div class="shop-tabs" role="tablist" aria-label="Pet shop sections">
                <button type="button" role="tab" aria-selected="${_shopTab === 'food'}" class="shop-tab ${_shopTab === 'food' ? 'active' : ''}" onclick="_shopTab='food';refreshShop()">Treats</button>
                <button type="button" role="tab" aria-selected="${_shopTab === 'acc'}" class="shop-tab ${_shopTab === 'acc' ? 'active' : ''}" onclick="_shopTab='acc';refreshShop()">Dress up</button>
                <button type="button" role="tab" aria-selected="${_shopTab === 'shield'}" class="shop-tab ${_shopTab === 'shield' ? 'active' : ''}" onclick="_shopTab='shield';refreshShop()">Shields</button>
            </div>
            ${_shopTab === 'acc' ? `<div class="shop-categories">${catPills}</div>` : ''}
            <div class="shop-items ${_shopTab === 'food' ? 'food-grid' : _shopTab === 'acc' ? 'accessory-grid' : ''}">
                ${_shopTab === 'food' ? foodItems : (_shopTab === 'shield' ? renderShieldShop() : accItems)}
            </div>
        </div>
    `;
}

function refreshShop() {
    const modal = document.getElementById('petShopModal');
    if (!modal) return;

    // If switching tabs, we need to recreate with proper overlay type
    const isDrawer = modal.classList.contains('pet-shop-drawer-overlay');
    const needsDrawer = _shopTab === 'food';

    if (isDrawer !== needsDrawer) {
        // Tab changed — rebuild entire shop with correct overlay
        modal.remove();
        showPetShop();
        return;
    }

    modal.innerHTML = renderShopContent();
    if (_shopTab === 'food') {
        setTimeout(() => initDragToFeed(), 50);
    }
}

function buyFood(foodId, sourceEl) {
    const food = DOG_FOOD.find(f => f.id === foodId);
    if (!food || (appState.coins || 0) < food.price) return;

    const oldLevel = appState.dogLevel || 1;
    appState.coins -= food.price;

    let totalGrowth = food.growth;
    let bonusMsg = '';

    // Option B: Royal Feast study bonus (+30 XP if studied today)
    if (foodId === 'feast' && appState.lastStudyDate === new Date().toDateString()) {
        totalGrowth += 30;
        bonusMsg = ' (+30 study bonus!)';
    }

    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + totalGrowth;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    appState.petLastFed = Date.now(); // Feeding resets hunger
    // Today's "the dog wants X" quest is satisfied by buying that food.
    if (typeof petFoodQuestOnFeed === 'function') { try { petFoodQuestOnFeed(foodId); } catch (e) {} }

    saveUserData(currentUser, appState);

    // Animate feeding arc + chomp
    animateFeeding(food.emoji, sourceEl);

    // Show result after animation completes
    setTimeout(() => {
        if (appState.dogLevel > oldLevel) {
            showLevelUpCelebration(appState.dogLevel, oldLevel);
        } else {
            showToast(`${food.emoji} +${totalGrowth} growth XP!${bonusMsg}`);
        }
        refreshShop();
        renderWordPet();
    }, 700);
}

function buyAccessory(accId) {
    const acc = DOG_ACCESSORIES.find(a => a.id === accId);
    if (!acc || (appState.coins || 0) < acc.price) return;
    if ((appState.petAccessories || []).includes(accId)) return; // Already owned

    appState.coins -= acc.price;
    if (!appState.petAccessories) appState.petAccessories = [];
    appState.petAccessories.push(accId);

    // Auto-equip if less than 3 active
    if (!appState.activeAccessories) appState.activeAccessories = [];
    if (appState.activeAccessories.length < 3) {
        appState.activeAccessories.push(accId);
    }

    saveUserData(currentUser, appState);
    showToast(`${acc.emoji} ${acc.name} acquired!`);
    refreshShop();
    renderWordPet();
}

// ==================== STREAK SHIELDS ====================
const SHIELD_PRICE = 200;
const SHIELD_MAX = 3;

function renderShieldShop() {
    const coins = appState.coins || 0;
    const owned = appState.streakShields || 0;
    const canAfford = coins >= SHIELD_PRICE;
    const atMax = owned >= SHIELD_MAX;

    let btnHTML;
    if (atMax) {
        btnHTML = `<button class="shop-buy-btn disabled">MAX</button>`;
    } else if (canAfford) {
        btnHTML = `<button class="shop-buy-btn" onclick="buyShield()">${SHIELD_PRICE} 🪙</button>`;
    } else {
        btnHTML = `<button class="shop-buy-btn disabled">${SHIELD_PRICE} 🪙</button>`;
    }

    return `
        <div class="shield-shop-intro">
            Shields auto-save your streak if you miss a day.<br>
            <strong>You have: ${'🛡️'.repeat(owned) || '–'} (${owned}/${SHIELD_MAX})</strong>
        </div>
        <div class="shop-item ${!canAfford && !atMax ? 'disabled' : ''}">
            <span class="shop-item-emoji">🛡️</span>
            <div class="shop-item-info">
                <div class="shop-item-name">Streak Shield</div>
                <div class="shop-item-desc">${atMax ? 'Inventory full' : 'Saves your streak on a missed day'}</div>
            </div>
            ${btnHTML}
        </div>
        <div class="shield-tip">💡 Earn 1 free shield per day after 3+ lessons (max 3)</div>
    `;
}

function buyShield() {
    if ((appState.streakShields || 0) >= SHIELD_MAX) {
        showToast('Shield inventory full!');
        return;
    }
    if ((appState.coins || 0) < SHIELD_PRICE) {
        showToast('Not enough coins!');
        return;
    }
    appState.coins -= SHIELD_PRICE;
    appState.streakShields = (appState.streakShields || 0) + 1;
    saveUserData(currentUser, appState);
    showToast(`🛡️ Shield purchased! (${appState.streakShields}/${SHIELD_MAX})`);
    refreshShop();
    if (typeof renderWordPet === 'function') renderWordPet();
    if (typeof renderShields === 'function') renderShields();
}

// ==================== SHIELD-SAVED CELEBRATION ====================
// Shows a special overlay when user opens app and a shield was auto-used
function showShieldSavedCelebration(savedStreak) {
    const existing = document.getElementById('shieldSavedOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shieldSavedOverlay';
    overlay.className = 'shield-saved-overlay';
    overlay.innerHTML = `
        <div class="shield-saved-card">
            <div class="shield-saved-icon">🛡️</div>
            <h2 class="shield-saved-title">Streak Saved!</h2>
            <p class="shield-saved-msg">A Streak Shield protected your <strong>${savedStreak}-day streak</strong> while you were away. Phew! 🎉</p>
            <p class="shield-saved-remaining">Shields remaining: ${'🛡️'.repeat(appState.streakShields || 0) || 'none'}</p>
            <button class="shield-saved-btn" onclick="document.getElementById('shieldSavedOverlay').remove()">Keep going! 💪</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
}

function showLevelUpCelebration(newLevel, oldLevel) {
    const existing = document.getElementById('levelUpOverlay');
    if (existing) existing.remove();

    const stage = getDogStage(newLevel);
    const oldStage = getDogStage(oldLevel);
    const stageChanged = stage.minLevel !== oldStage.minLevel;
    const isMilestone = newLevel % 10 === 0;

    const overlay = document.createElement('div');
    overlay.id = 'levelUpOverlay';
    overlay.className = 'level-up-overlay';
    overlay.onclick = function() { overlay.remove(); renderWordPet(); };

    let content = `
        <div class="level-up-confetti">${'🎉'.repeat(6)}${'✨'.repeat(4)}${'⭐'.repeat(3)}</div>
        <div class="level-up-text">${isMilestone ? '🏆 MILESTONE!' : '🎉 LEVEL UP!'}</div>
        <div class="level-up-level">Level ${newLevel}</div>
    `;

    // Every 5 levels inside a stage unlocks a visible upgrade (collar → hat
    // → jewellery); every 20 a whole new breed. Show whichever just happened,
    // drawn with the live rig so the child sees exactly what changed.
    const drawDog = (lv, st, px) => (typeof petDogSVG === 'function')
        ? petDogSVG({ stageCss: st.stageCss, size: px, level: lv, stageMinLevel: st.minLevel })
        : `<span style="font-size:${px}px">${st.fallback}</span>`;
    const newTier = (typeof petTierForLevel === 'function') ? petTierForLevel(newLevel, stage.minLevel) : 0;
    const oldTier = (typeof petTierForLevel === 'function') ? petTierForLevel(oldLevel, oldStage.minLevel) : 0;

    if (stageChanged) {
        content += `
            <div class="level-up-evolution">
                ${drawDog(oldLevel, oldStage, 64)}
                <span style="font-size:24px">→</span>
                ${drawDog(newLevel, stage, 84)}
            </div>
            <div class="level-up-stage-name">Milo tiến hóa thành ${stage.name}! 🐕</div>
        `;
    } else if (newTier > oldTier) {
        const what = (typeof petTierLabel === 'function') ? petTierLabel(newTier) : 'món đồ mới';
        content += `
            <div class="level-up-evolution">${drawDog(newLevel, stage, 88)}</div>
            <div class="level-up-stage-name">Milo có ${what} mới! ✨</div>
        `;
    }

    content += `<div class="level-up-title">${getDogTitle(newLevel)}</div>`;
    content += `<div style="margin-top:20px;font-size:13px;opacity:0.7">Tap to continue</div>`;

    overlay.innerHTML = content;
    document.body.appendChild(overlay);
}

function savePetName() {
    const input = document.getElementById('petNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    appState.petName = name;
    saveUserData(currentUser, appState);
    renderWordPet();
}

function toggleAccessory(id) {
    const active = appState.activeAccessories || [];
    if (active.includes(id)) {
        appState.activeAccessories = active.filter(a => a !== id);
        // Clear custom drag position
        if (appState.accPositions) delete appState.accPositions[id];
    } else if (active.length < 3) {
        if (!appState.activeAccessories) appState.activeAccessories = [];
        appState.activeAccessories.push(id);
    } else {
        showToast('Only 3 accessories at once!');
        return;
    }
    saveUserData(currentUser, appState);
    refreshShop();
    renderWordPet();
}

function checkAccessoryUnlocks() { /* Now handled via shop */ }

function getDailyQuest(state) {
    const dateStr = new Date().toDateString();
    const eligible = PET_QUESTS.filter(q => q.eligible(state));
    if (eligible.length === 0) return PET_QUESTS[0];
    const rng   = seededRandom('pet-quest-' + dateStr);
    const index = Math.floor(rng() * eligible.length);
    return eligible[index] || PET_QUESTS[0];
}

function checkQuestCompletion(triggerQuestId, extraContext) {
    if (!appState || !appState.petName) return;
    const today = new Date().toDateString();
    if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
    const q = appState.petQuest;

    if (q.lastDate !== today) {
        const quest = getDailyQuest(appState);
        q.lastDate  = today;
        q.questId   = quest.id;
        q.completed = false;
    }
    if (q.completed) return;

    const quest = PET_QUESTS.find(p => p.id === q.questId);
    if (!quest) return;

    if (quest.id === 'streak3' && triggerQuestId === 'lesson' && (appState.streak || 0) >= 3) {
        _completeQuest(quest);
        return;
    }
    if (quest.id === 'perfect' && triggerQuestId === 'lesson' && extraContext && extraContext.accuracy === 100) {
        _completeQuest(quest);
        return;
    }
    if (quest.id === triggerQuestId) {
        _completeQuest(quest);
    }
}

function _completeQuest(quest) {
    appState.petQuest.completed = true;
    appState.coins = (appState.coins || 0) + (quest.coins || 0);
    feedPet(quest.hunger);
    saveUserData(currentUser, appState);
    showToast(`🐾 Quest complete! +${quest.coins} 🪙`);
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        creature.classList.add('wiggle');
        setTimeout(() => creature.classList.remove('wiggle'), 600);
    }
    renderWordPet();
}

// Backward compatibility shim — now uses showLevelUpCelebration
function showEvolutionCelebration(stage) {
    const level = appState.dogLevel || 1;
    showLevelUpCelebration(level, Math.max(1, level - 1));
}

const PET_PHRASES_EXTENDED = PET_PHRASES;

function fireHeartBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.heart-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'heart-burst';
    const particles = ['❤️','💛','💚','💙','💜','🩷'];
    const offsets = [
        { x: '-30px', y: '-50px', delay: '0s',    dur: '0.7s' },
        { x: '30px',  y: '-55px', delay: '0.05s', dur: '0.75s' },
        { x: '-50px', y: '-30px', delay: '0.1s',  dur: '0.8s' },
        { x: '50px',  y: '-25px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-65px', delay: '0.15s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

// ==================== ANIMATED FEEDING ====================

function animateFeeding(foodEmoji, sourceEl) {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;

    const creatureRect = creature.getBoundingClientRect();
    const sourceRect = sourceEl ? sourceEl.getBoundingClientRect()
        : { left: window.innerWidth / 2, top: window.innerHeight - 100, width: 0, height: 0 };

    // Create flying food element
    const flyFood = document.createElement('div');
    flyFood.className = 'flying-food';
    flyFood.textContent = foodEmoji;
    flyFood.style.position = 'fixed';
    flyFood.style.left = (sourceRect.left + sourceRect.width / 2) + 'px';
    flyFood.style.top = (sourceRect.top + sourceRect.height / 2) + 'px';
    document.body.appendChild(flyFood);

    // Target: dog mouth area (60% down from top of creature)
    const targetX = creatureRect.left + creatureRect.width / 2;
    const targetY = creatureRect.top + creatureRect.height * 0.6;
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const midX = (startX + targetX) / 2;
    const midY = Math.min(startY, targetY) - 80; // Arc peak

    flyFood.animate([
        { left: startX + 'px', top: startY + 'px', transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { left: midX + 'px',   top: midY + 'px',   transform: 'scale(1.4) rotate(-15deg)', opacity: 1, offset: 0.45 },
        { left: targetX + 'px', top: targetY + 'px', transform: 'scale(0.3) rotate(25deg)', opacity: 0 }
    ], { duration: 600, easing: 'ease-in', fill: 'forwards' });

    // Dog chomp on arrival
    setTimeout(() => {
        flyFood.remove();
        creature.classList.remove('pet-chomp');
        void creature.offsetWidth;
        creature.classList.add('pet-chomp');
        fireFeedBurst();
        setTimeout(() => creature.classList.remove('pet-chomp'), 500);
    }, 560);
}

function fireFeedBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.feed-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'feed-burst';
    const particles = ['🍖','✨','⭐','🌟','💫','😋'];
    const offsets = [
        { x: '-35px', y: '-45px', delay: '0s',    dur: '0.7s' },
        { x: '35px',  y: '-50px', delay: '0.05s', dur: '0.75s' },
        { x: '-55px', y: '-25px', delay: '0.1s',  dur: '0.8s' },
        { x: '55px',  y: '-20px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-60px', delay: '0.12s', dur: '0.85s' },
        { x: '-20px', y: '-55px', delay: '0.08s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

// ==================== PET POOP SYSTEM ====================

const POOP_DELAY_HOURS = 2;
const POOP_MAX = 3;
const POOP_STINK_HOURS = 12;
const POOP_CLEAN_COINS = 3;
const POOP_CLEAN_XP = 10;
const POOP_MOOD_THRESHOLD = 3;

const POOP_CLEAN_PHRASES = [
    "Thanks for cleaning up! You're the best! 🧹",
    "Ahhh, much better! Sparkling clean! ✨",
    "My hero! No more stinky! 🦸",
    "Woohoo! That feels so good! 🎉"
];

// ==================== STREAK MILESTONE SYSTEM ====================

const STREAK_MILESTONE_DATA = {
    3:   { name: 'Hatching!',     icon: '🥚', coins: 20,   petXP: 30,  msg: "3 days in a row! You're on your way!" },
    7:   { name: 'On Fire!',      icon: '🔥', coins: 50,   petXP: 60,  msg: "7 days! You're ON FIRE! Keep going!" },
    14:  { name: 'Unstoppable!',  icon: '🚀', coins: 100,  petXP: 100, msg: 'Nothing can stop you now!' },
    30:  { name: 'Super Streak!', icon: '⚡', coins: 200,  petXP: 200, msg: 'You unlocked a special accessory!', acc: 'streak-flame' },
    60:  { name: 'Legend!',       icon: '👑', coins: 400,  petXP: 300, msg: 'You are a true LEGEND!' },
    100: { name: 'Champion!',     icon: '🏆', coins: 1000, petXP: 500, msg: 'ULTIMATE CHAMPION!' }
};

function getStreakTier(streak) {
    if (streak >= 30) return 4;
    if (streak >= 14) return 3;
    if (streak >= 7)  return 2;
    if (streak >= 3)  return 1;
    return 0;
}

function getNextMilestone(streak) {
    return STREAK_MILESTONES.find(m => m > streak) || null;
}

function showStreakMilestone(streak) {
    const data = STREAK_MILESTONE_DATA[streak];
    if (!data) return;

    // Award coins and pet XP
    appState.coins = (appState.coins || 0) + data.coins;
    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + data.petXP;
    const oldLevel = appState.dogLevel || 1;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);

    // Grant exclusive accessory if applicable
    if (data.acc) {
        if (!appState.petAccessories) appState.petAccessories = [];
        if (!appState.petAccessories.includes(data.acc)) {
            appState.petAccessories.push(data.acc);
            if (!appState.activeAccessories) appState.activeAccessories = [];
            if (appState.activeAccessories.length < 3) appState.activeAccessories.push(data.acc);
        }
    }

    // Mark milestone as celebrated
    appState.lastStreakMilestone = streak;
    saveUserData(currentUser, appState);

    // Build overlay
    const existing = document.getElementById('streakMilestoneOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'streakMilestoneOverlay';
    overlay.className = 'level-up-overlay streak-milestone-overlay';
    overlay.onclick = function() {
        overlay.remove();
        renderWordPet();
        if (appState.dogLevel > oldLevel) {
            setTimeout(() => { try { showLevelUpCelebration(appState.dogLevel, oldLevel); } catch(e) {} }, 400);
        }
    };

    const nextM = getNextMilestone(streak);
    const nextHint = nextM
        ? `<div class="streak-next-hint">Next milestone: ${nextM} days 🎯</div>`
        : `<div class="streak-next-hint">You've reached the ultimate streak! 👑</div>`;

    overlay.innerHTML = `
        <div class="level-up-confetti">${data.icon.repeat(4)} ${'✨'.repeat(3)}</div>
        <div class="level-up-text">${data.name}</div>
        <div class="level-up-level">🔥 ${streak} Day Streak!</div>
        <div class="streak-milestone-msg">${data.msg}</div>
        <div class="streak-milestone-rewards">
            <span class="streak-reward-item">+${data.coins} 🪙</span>
            <span class="streak-reward-item">+${data.petXP} pet XP</span>
            ${data.acc ? '<span class="streak-reward-item streak-acc-unlock">🔥 Streak Flame unlocked!</span>' : ''}
        </div>
        ${nextHint}
        <div style="margin-top:16px;font-size:13px;opacity:0.7">Tap to continue</div>
    `;

    document.body.appendChild(overlay);

    // Pet speech bubble
    setTimeout(() => showPetSpeechBubble(`${streak} days! ${data.icon} I'm so proud of you!`), 600);
}

// ==================== POOP SYSTEM ====================

function evaluatePoopSpawn() {
    if (!appState || !appState.petName || !appState.petLastFed) return;
    if (!appState.petPoops) appState.petPoops = [];

    const now = Date.now();
    const hoursSinceFed = (now - appState.petLastFed) / 3600000;
    if (hoursSinceFed < POOP_DELAY_HOURS) return;
    if (appState.petPoops.length >= POOP_MAX) return;

    const windowSize = 2; // hours
    const firstWindow = Math.floor(POOP_DELAY_HOURS / windowSize);
    const currentWindow = Math.floor(hoursSinceFed / windowSize);

    let changed = false;
    for (let w = firstWindow; w <= currentWindow && appState.petPoops.length < POOP_MAX; w++) {
        const windowId = 'poop-' + appState.petLastFed + '-' + w;
        if (appState.petPoops.some(p => p.id === windowId)) continue;
        if ((appState.cleanedPoopIds || []).includes(windowId)) continue;

        const rng = seededRandom(windowId);
        if (rng() < 0.6) {
            appState.petPoops.push({
                id: windowId,
                x: 15 + rng() * 70,
                y: 70 + rng() * 25,
                born: appState.petLastFed + (w * windowSize * 3600000)
            });
            changed = true;
        }
    }

    if (changed) {
        saveUserData(currentUser, appState);
        setTimeout(() => showPetSpeechBubble("Oops… I had an accident! 💩"), 400);
    }
}

// ==================== DRAG-TO-FEED SYSTEM ====================

let _dragState = null;

function initDragToFeed() {
    const foodItems = document.querySelectorAll('.draggable-food');
    foodItems.forEach(item => {
        item.addEventListener('touchstart', onFoodTouchStart, { passive: false });
        item.addEventListener('touchmove', onFoodTouchMove, { passive: false });
        item.addEventListener('touchend', onFoodTouchEnd);
        // Mouse fallback for desktop testing
        item.addEventListener('mousedown', onFoodMouseDown);
    });
}

function onFoodTouchStart(e) {
    const touch = e.touches[0];
    const item = e.currentTarget;
    startFoodDrag(item, touch.clientX, touch.clientY);
    e.preventDefault();
}

function onFoodTouchMove(e) {
    if (!_dragState) return;
    const touch = e.touches[0];
    moveFoodDrag(touch.clientX, touch.clientY);
    e.preventDefault();
}

function onFoodTouchEnd(e) {
    if (!_dragState) return;
    endFoodDrag();
}

function onFoodMouseDown(e) {
    const item = e.currentTarget;
    startFoodDrag(item, e.clientX, e.clientY);
    e.preventDefault();

    const onMove = (ev) => { if (_dragState) moveFoodDrag(ev.clientX, ev.clientY); };
    const onUp = () => { endFoodDrag(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startFoodDrag(item, x, y) {
    const emoji = item.dataset.foodEmoji;
    const foodId = item.dataset.foodId;

    // Create floating drag ghost
    const ghost = document.createElement('div');
    ghost.className = 'drag-food-ghost';
    ghost.textContent = emoji;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);

    _dragState = { ghost, foodId, emoji, startX: x, startY: y, item };

    // Show drop target hint on pet
    const creature = document.querySelector('.pet-creature');
    if (creature) creature.classList.add('drop-target-hint');

    // Haptic feedback (if available)
    if (navigator.vibrate) navigator.vibrate(30);
}

function moveFoodDrag(x, y) {
    if (!_dragState) return;
    _dragState.ghost.style.left = x + 'px';
    _dragState.ghost.style.top = y + 'px';

    // Check proximity to dog — highlight if close
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        const rect = creature.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const isNear = dist < Math.max(80, rect.width * 0.8);
        creature.classList.toggle('drop-target-near', isNear);
    }
}

function endFoodDrag() {
    if (!_dragState) return;
    const { ghost, foodId, item } = _dragState;

    // Check if dropped on dog
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        const rect = creature.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        const gx = ghostRect.left + ghostRect.width / 2;
        const gy = ghostRect.top + ghostRect.height / 2;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(gx - cx, gy - cy);

        creature.classList.remove('drop-target-hint', 'drop-target-near');

        if (dist < Math.max(80, rect.width * 0.8)) {
            // SUCCESS — feed the dog!
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            ghost.remove();
            buyFood(foodId, item);
        } else {
            // MISS — snap back
            ghost.classList.add('snap-back');
            setTimeout(() => ghost.remove(), 300);
        }
    } else {
        ghost.remove();
    }

    _dragState = null;
}

// ─── Drag-to-Reposition Accessories on Pet ───
let _accDragState = null;

function initAccDrag() {
    const accEls = document.querySelectorAll('.draggable-pet-acc');
    accEls.forEach(el => {
        el.addEventListener('touchstart', onAccPetTouchStart, { passive: false });
        el.addEventListener('mousedown', onAccPetMouseDown);
    });
}

function onAccPetTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startAccPetDrag(e.currentTarget, touch.clientX, touch.clientY);

    const onMove = (ev) => {
        ev.preventDefault();
        moveAccPetDrag(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    const onEnd = () => {
        endAccPetDrag();
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function onAccPetMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    startAccPetDrag(e.currentTarget, e.clientX, e.clientY);

    const onMove = (ev) => moveAccPetDrag(ev.clientX, ev.clientY);
    const onUp = () => {
        endAccPetDrag();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startAccPetDrag(el, x, y) {
    const wrapper = el.closest('.pet-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    // The accessory may be moved anywhere inside the dog's screen box
    // (.pet-hero-zone), not just within the small pet wrapper.
    const zone = el.closest('.pet-hero-zone');
    const zoneRect = zone ? zone.getBoundingClientRect() : wrapperRect;

    _accDragState = {
        el,
        accId: el.dataset.accId,
        wrapperRect,
        zoneRect
    };

    el.classList.add('acc-dragging');
    if (navigator.vibrate) navigator.vibrate(20);
}

function moveAccPetDrag(x, y) {
    if (!_accDragState) return;
    const { el, wrapperRect, zoneRect } = _accDragState;

    // Clamp the cursor to the pet-hero-zone box (small inset keeps the emoji
    // visible), then convert to wrapper-relative percentages. Positions stay
    // wrapper-relative so saved accPositions and per-breed anchors keep
    // working unchanged.
    const PAD = 12;
    const cx = Math.max(zoneRect.left + PAD, Math.min(zoneRect.right - PAD, x));
    const cy = Math.max(zoneRect.top + PAD, Math.min(zoneRect.bottom - PAD, y));

    const pctLeft = (cx - wrapperRect.left) / wrapperRect.width * 100;
    const pctTop = (cy - wrapperRect.top) / wrapperRect.height * 100;

    el.style.left = pctLeft + '%';
    el.style.top = pctTop + '%';
    el.style.transform = 'translate(-50%, -50%)';
}

function endAccPetDrag() {
    if (!_accDragState) return;
    const { el, accId } = _accDragState;

    el.classList.remove('acc-dragging');

    // Save position as percentages
    const finalLeft = parseFloat(el.style.left);
    const finalTop = parseFloat(el.style.top);

    if (!appState.accPositions) appState.accPositions = {};
    appState.accPositions[accId] = {
        top: finalTop + '%',
        left: finalLeft + '%'
    };
    saveUserData(currentUser, appState);

    _accDragState = null;
}

// ==================== DRAG-TO-TRASH POOP SYSTEM ====================

let _poopDragState = null;

function initPoopDrag() {
    const poopEls = document.querySelectorAll('.pet-poop');
    poopEls.forEach(el => {
        el.addEventListener('touchstart', onPoopTouchStart, { passive: false });
        el.addEventListener('mousedown', onPoopMouseDown);
    });

    // Double-click / double-tap trash to clean all poops
    const trashBtn = document.getElementById('petTrashBtn');
    if (trashBtn) {
        trashBtn.addEventListener('dblclick', (e) => { e.preventDefault(); cleanAllPoops(); });
        let _lastTap = 0;
        trashBtn.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - _lastTap < 400) { e.preventDefault(); cleanAllPoops(); _lastTap = 0; }
            else { _lastTap = now; }
        });
    }
}

function onPoopTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startPoopDrag(e.currentTarget, touch.clientX, touch.clientY);

    const onMove = (ev) => { ev.preventDefault(); movePoopDrag(ev.touches[0].clientX, ev.touches[0].clientY); };
    const onEnd = () => { endPoopDrag(); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function onPoopMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    startPoopDrag(e.currentTarget, e.clientX, e.clientY);

    const onMove = (ev) => movePoopDrag(ev.clientX, ev.clientY);
    const onUp = () => { endPoopDrag(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startPoopDrag(el, x, y) {
    const poopId = el.dataset.poopId;
    const ghost = document.createElement('div');
    ghost.className = 'drag-poop-ghost';
    ghost.textContent = '💩';
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);

    _poopDragState = { ghost, poopId, el, startX: x, startY: y };
    el.style.opacity = '0.3';

    const trash = document.getElementById('petTrashBtn');
    if (trash) trash.classList.add('trash-drop-hint');

    if (navigator.vibrate) navigator.vibrate(30);
}

function movePoopDrag(x, y) {
    if (!_poopDragState) return;
    _poopDragState.ghost.style.left = x + 'px';
    _poopDragState.ghost.style.top = y + 'px';

    const trash = document.getElementById('petTrashBtn');
    if (trash) {
        const rect = trash.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        trash.classList.toggle('trash-drop-near', dist < 60);
    }
}

function endPoopDrag() {
    if (!_poopDragState) return;
    const { ghost, poopId, el } = _poopDragState;

    const trash = document.getElementById('petTrashBtn');
    if (trash) {
        const rect = trash.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        const gx = ghostRect.left + ghostRect.width / 2;
        const gy = ghostRect.top + ghostRect.height / 2;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(gx - cx, gy - cy);

        trash.classList.remove('trash-drop-hint', 'trash-drop-near');

        if (dist < 60) {
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            ghost.remove();
            cleanPoop(poopId, el);
        } else {
            el.style.opacity = '1';
            ghost.classList.add('snap-back');
            setTimeout(() => ghost.remove(), 300);
        }
    } else {
        el.style.opacity = '1';
        ghost.remove();
    }

    _poopDragState = null;
}

function cleanAllPoops() {
    const poops = appState.petPoops || [];
    if (poops.length === 0) return;

    const count = poops.length;
    const totalCoins = POOP_CLEAN_COINS * count;
    const totalXP = POOP_CLEAN_XP * count;

    // Remember cleaned IDs so evaluatePoopSpawn won't re-create them
    if (!appState.cleanedPoopIds) appState.cleanedPoopIds = [];
    poops.forEach(p => { if (!appState.cleanedPoopIds.includes(p.id)) appState.cleanedPoopIds.push(p.id); });
    appState.petPoops = [];
    appState.coins = (appState.coins || 0) + totalCoins;
    const oldLevel = appState.dogLevel || 1;
    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + totalXP;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    saveUserData(currentUser, appState);

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

    // Animate all poops out
    document.querySelectorAll('.pet-poop').forEach(el => {
        el.classList.add('poop-cleaning');
        setTimeout(() => el.remove(), 400);
    });
    fireCleanBurst();

    setTimeout(() => showPetSpeechBubble(`All clean! ${count} poops gone! ✨🧹`), 300);
    showToast(`✨ ${count}x clean! +${totalCoins} 🪙 +${totalXP} XP!`);

    if (appState.dogLevel > oldLevel) {
        setTimeout(() => { try { showLevelUpCelebration(appState.dogLevel, oldLevel); } catch(e) {} }, 800);
    }

    setTimeout(() => renderWordPet(), 500);
}

function cleanPoop(poopId, poopEl) {
    // Remember cleaned ID so evaluatePoopSpawn won't re-create it
    if (!appState.cleanedPoopIds) appState.cleanedPoopIds = [];
    if (!appState.cleanedPoopIds.includes(poopId)) appState.cleanedPoopIds.push(poopId);
    appState.petPoops = (appState.petPoops || []).filter(p => p.id !== poopId);

    appState.coins = (appState.coins || 0) + POOP_CLEAN_COINS;
    const oldLevel = appState.dogLevel || 1;
    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + POOP_CLEAN_XP;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    saveUserData(currentUser, appState);

    if (navigator.vibrate) navigator.vibrate(30);

    if (poopEl) {
        poopEl.classList.add('poop-cleaning');
        setTimeout(() => poopEl.remove(), 400);
    }
    fireCleanBurst();

    const phrase = POOP_CLEAN_PHRASES[Math.floor(Math.random() * POOP_CLEAN_PHRASES.length)];
    setTimeout(() => showPetSpeechBubble(phrase), 300);
    showToast('✨ +' + POOP_CLEAN_COINS + ' 🪙 +' + POOP_CLEAN_XP + ' XP!');

    if (appState.dogLevel > oldLevel) {
        setTimeout(() => { try { showLevelUpCelebration(appState.dogLevel, oldLevel); } catch(e) {} }, 800);
    }

    setTimeout(() => renderWordPet(), 500);
}

function fireCleanBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.clean-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'clean-burst';
    const particles = ['✨','🌟','⭐','💫','🧹','🫧'];
    const offsets = [
        { x: '-35px', y: '-45px', delay: '0s',    dur: '0.7s' },
        { x: '35px',  y: '-50px', delay: '0.05s', dur: '0.75s' },
        { x: '-55px', y: '-25px', delay: '0.1s',  dur: '0.8s' },
        { x: '55px',  y: '-20px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-60px', delay: '0.12s', dur: '0.85s' },
        { x: '-20px', y: '-55px', delay: '0.08s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

function onPetTap() {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;
    // Squish animation
    creature.classList.remove('pet-tapped');
    void creature.offsetWidth;
    creature.classList.add('pet-tapped');
    setTimeout(() => creature.classList.remove('pet-tapped'), 500);
    // Heart burst particles
    fireHeartBurst();

    const mood = getPetMood();
    const srsWords = appState.srs ? Object.keys(appState.srs) : [];

    // Poop cleanup nudge (40% chance when poops exist)
    const poopCount = (appState.petPoops || []).length;
    if (poopCount > 0 && Math.random() < 0.4) {
        const nudges = [
            "It's a bit messy… drag the 💩 to the 🗑️!",
            "Eww, stinky! Help me clean! 😅",
            "My home needs cleaning! 🧹",
            poopCount >= 3 ? "So much poop! I can barely breathe! 😫" : "Drag the 💩 to the 🗑️!"
        ];
        showPetSpeechBubble(nudges[Math.floor(Math.random() * nudges.length)]);
        return;
    }

    // Near level-up check
    const level = appState.dogLevel || 1;
    if (level < 200) {
        const currentXP = appState.dogGrowthXP || 0;
        const nextLevelXP = getPointsForLevel(level + 1);
        const currentLevelXP = getPointsForLevel(level);
        const progress = (currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP);
        if (progress >= 0.8) {
            showPetSpeechBubble("I can feel myself growing! Almost there! 🌟");
            return;
        }
    }

    // Streak celebration (3+ days)
    const _streakTierTap = getStreakTier(appState.streak || 0);
    if (_streakTierTap >= 1 && mood === 'happy' && Math.random() < 0.3) {
        const streakPhrases = [
            `${appState.streak} days together! Keep it up! 🎉`,
            `${appState.streak} days ON FIRE! You're amazing! 🔥`,
            `${appState.streak} days of gold! My hero! 🏆`,
            `${appState.streak} days RAINBOW POWER! Luckiest dog! 🌈`
        ];
        showPetSpeechBubble(streakPhrases[Math.min(_streakTierTap - 1, 3)]);
        return;
    }

    // Word recall — 20% of taps
    if (srsWords.length > 0 && Math.random() < 0.2) {
        const word = srsWords[Math.floor(Math.random() * srsWords.length)];
        const wordData = ieltsVocabulary.find(w => w.en === word);
        if (wordData) {
            showPetSpeechBubble(`${wordData.emoji} Remember "${wordData.en}"?`);
            speakWord(wordData.en);
            return;
        }
    }

    // Mood-based phrase
    const phrases = PET_PHRASES[mood] || PET_PHRASES.neutral;
    showPetSpeechBubble(phrases[Math.floor(Math.random() * phrases.length)]);
}

function showPetSpeechBubble(text) {
    const existing = document.querySelector('.pet-bubble');
    if (existing) existing.remove();
    const bubble = document.createElement('div');
    bubble.className = 'pet-bubble';
    bubble.textContent = text;
    const target = document.getElementById('petHeroStage') || document.getElementById('petContainer');
    if (target) target.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2500);
}

// ==================== WORD OF THE DAY ====================
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

function getDailyWord() {
    const dateStr = new Date().toDateString();
    const rng = seededRandom(dateStr);
    const index = Math.floor(rng() * ieltsVocabulary.length);
    return ieltsVocabulary[index];
}

function renderWordOfDay() {
    const card = document.getElementById('wotdCard');
    if (!card) return;
    const word = getDailyWord();
    // Warm the recording now so the story panel's 🔊 Listen is instant.
    if (typeof prefetchAudio === 'function') prefetchAudio(word.en);
    const today = new Date().toDateString();
    const viewed = appState.wordOfDayViewed === today;
    card.innerHTML = `
        <div class="wotd-label">Word of the Day ${viewed ? '✅' : ''}</div>
        <div class="wotd-emoji">${word.emoji}</div>
        <div class="wotd-word">${word.en}</div>
    `;
    card.onclick = () => openWordOfDayStory(word);
}

function openWordOfDayStory(word) {
    const overlay = document.getElementById('wotdOverlay');
    if (!overlay) return;
    let panelIndex = 0;
    const panels = [
        `<div class="wotd-panel-emoji">${word.emoji}</div>
         <div class="wotd-panel-word">${word.en}</div>
         <div class="wotd-panel-ipa">${word.ipa}</div>
         <button class="wotd-speak-btn" onclick="event.stopPropagation(); speakWord('${word.en.replace(/'/g, "\\'")}')">🔊 Listen</button>`,
        `<div class="wotd-panel-vi">${word.vi}</div>
         <div class="wotd-panel-example">"${word.ex || ''}"</div>`,
        `<div class="wotd-panel-prompt">Use it today!</div>
         <div class="wotd-panel-challenge">Try saying:<br><strong>"${word.ex || word.en}"</strong></div>`
    ];

    function renderPanel() {
        overlay.innerHTML = `
            <div class="wotd-panel">${panels[panelIndex]}</div>
            <div class="wotd-dots">${panels.map((_, i) =>
                `<span class="wotd-dot${i === panelIndex ? ' active' : ''}"></span>`
            ).join('')}</div>
            <div class="wotd-tap-hint">Tap to continue</div>
        `;
    }

    overlay.onclick = (e) => {
        // Don't advance panel when tapping the Listen button
        if (e.target.closest('.wotd-speak-btn')) return;
        panelIndex++;
        if (panelIndex >= panels.length) {
            overlay.classList.remove('active');
            appState.wordOfDayViewed = new Date().toDateString();
            saveUserData(currentUser, appState);
            if (typeof checkQuestCompletion === 'function') checkQuestCompletion('wotd');
            renderWordOfDay();
        } else {
            renderPanel();
        }
    };

    renderPanel();
    overlay.classList.add('active');
    speakWord(word.en);
}

// ==================== WEEKLY RECAP ====================
// Returns the Sunday (week start) for a given date, formatted as YYYY-MM-DD
// Format a Date as local YYYY-MM-DD (timezone-safe, unlike toISOString)
function _localISODate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Parse a YYYY-MM-DD string as local midnight (not UTC midnight)
function _parseLocalISODate(s) {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]); // local midnight
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday (local)
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return _localISODate(d);
}

function formatWeekRange(weekStartIso) {
    const start = _parseLocalISODate(weekStartIso);
    const end = new Date(start.getTime() + 6 * 86400000);
    const opts = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

// Generates a snapshot for the previous (just-finished) week
function generateWeeklyRecap(weekStartIso) {
    const start = _parseLocalISODate(weekStartIso).getTime();
    const end = start + 7 * 86400000;
    const history = (appState.lessonHistory || []).filter(h => h.date >= start && h.date < end);

    // Days active (1 per unique day)
    const dayMap = [false, false, false, false, false, false, false]; // Sun..Sat (local)
    history.forEach(h => {
        const dow = new Date(h.date).getDay();
        dayMap[dow] = true;
    });

    const xpEarned = history.reduce((sum, h) => sum + (h.points || 0), 0);
    const lessonsCompleted = history.length;
    const perfectLessons = history.filter(h => h.accuracy === 100).length;

    // Words learned: unique lesson numbers × WORDS_PER_LESSON (approximation — capped to lesson count)
    const uniqueLessons = new Set(history.map(h => h.lessonNum)).size;
    const wordsLearned = uniqueLessons * WORDS_PER_LESSON;

    const daysActive = dayMap.filter(Boolean).length;

    return {
        weekStart: weekStartIso,
        weekEnd: _localISODate(new Date(end - 86400000)), // last day of week (local)
        xpEarned, lessonsCompleted, perfectLessons,
        wordsLearned, daysActive, dayMap,
        streakAtEnd: appState.streak || 0
    };
}

// Generates and stores the previous week if not already stored
function ensurePreviousWeekStored() {
    const today = new Date();
    const lastWeekDate = new Date(today.getTime() - 7 * 86400000);
    const lastWeekStart = getWeekStart(lastWeekDate);

    if (!appState.weeklyRecaps) appState.weeklyRecaps = [];
    const exists = appState.weeklyRecaps.some(r => r.weekStart === lastWeekStart);
    if (exists) return null;

    const recap = generateWeeklyRecap(lastWeekStart);
    if (recap.lessonsCompleted === 0) return null; // Skip empty weeks

    appState.weeklyRecaps.unshift(recap); // Newest first
    // Keep last 12 weeks max
    if (appState.weeklyRecaps.length > 12) appState.weeklyRecaps = appState.weeklyRecaps.slice(0, 12);
    saveUserData(currentUser, appState);
    return recap;
}

// Called on home render — fires modal at most once per week
function maybeShowWeeklyRecap() {
    if (!appState) return;
    const recap = ensurePreviousWeekStored();
    if (!recap) return;
    if (appState.lastWeeklyRecapShown === recap.weekStart) return;

    appState.lastWeeklyRecapShown = recap.weekStart;
    saveUserData(currentUser, appState);
    showWeeklyRecapModal(recap);
}

function getRecapMessage(recap) {
    if (recap.daysActive === 7) {
        return `🏆 PERFECT WEEK! You showed up every single day. Legendary!`;
    } else if (recap.daysActive >= 5) {
        return `🔥 Strong week! ${recap.daysActive}/7 days — you're building a real habit.`;
    } else if (recap.daysActive >= 3) {
        return `💪 Solid effort! ${recap.daysActive}/7 days — let's aim for 5+ next week.`;
    } else {
        return `🌱 Every step counts. Let's make next week even better!`;
    }
}

function showWeeklyRecapModal(recap, isHistory) {
    const existing = document.getElementById('weeklyRecapOverlay');
    if (existing) existing.remove();

    const dayLabels = ['S','M','T','W','T','F','S'];
    const daysHTML = recap.dayMap.map((active, i) =>
        `<div class="recap-day-pill ${active ? 'active' : ''}">
            <span class="recap-day-dot">${active ? '✅' : '·'}</span>
            ${dayLabels[i]}
        </div>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'weeklyRecapOverlay';
    overlay.className = 'weekly-recap-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="weekly-recap-card">
            <button class="recap-close" onclick="document.getElementById('weeklyRecapOverlay').remove()">✕</button>
            <div class="recap-header">
                <div class="recap-emoji">📊</div>
                <h2 class="recap-title">${isHistory ? 'Week Recap' : 'Your Week'}</h2>
                <div class="recap-week-range">${formatWeekRange(recap.weekStart)}</div>
            </div>
            <div class="recap-days-row">${daysHTML}</div>
            <div class="recap-stats-grid">
                <div class="recap-stat">
                    <div class="recap-stat-value">${recap.xpEarned}</div>
                    <div class="recap-stat-label">XP EARNED</div>
                </div>
                <div class="recap-stat">
                    <div class="recap-stat-value">${recap.lessonsCompleted}</div>
                    <div class="recap-stat-label">LESSONS</div>
                </div>
                <div class="recap-stat">
                    <div class="recap-stat-value">${recap.wordsLearned}</div>
                    <div class="recap-stat-label">WORDS</div>
                </div>
                <div class="recap-stat">
                    <div class="recap-stat-value">${recap.perfectLessons}</div>
                    <div class="recap-stat-label">PERFECT</div>
                </div>
            </div>
            <div class="recap-message">${getRecapMessage(recap)}</div>
            <div class="recap-actions">
                ${isHistory
                    ? `<button class="recap-btn recap-btn-primary" onclick="document.getElementById('weeklyRecapOverlay').remove()">Close</button>`
                    : `<button class="recap-btn recap-btn-secondary" onclick="showWeeklyRecapHistory()">📚 Past Weeks</button>
                       <button class="recap-btn recap-btn-primary" onclick="document.getElementById('weeklyRecapOverlay').remove()">Let's Go! 💪</button>`}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function showWeeklyRecapHistory() {
    const existing = document.getElementById('weeklyRecapOverlay');
    if (existing) existing.remove();

    const recaps = appState.weeklyRecaps || [];
    const overlay = document.createElement('div');
    overlay.id = 'weeklyRecapOverlay';
    overlay.className = 'weekly-recap-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    const listHTML = recaps.length === 0
        ? '<div class="empty-history">No past weeks yet. Keep learning! 📚</div>'
        : recaps.map((r, i) => `
            <div class="recap-history-item" onclick="showWeeklyRecapModal(appState.weeklyRecaps[${i}], true)">
                <div>
                    <div class="recap-history-week">${formatWeekRange(r.weekStart)}</div>
                    <div class="recap-history-stats">${r.lessonsCompleted} lessons • ${r.xpEarned} XP • ${r.daysActive}/7 days</div>
                </div>
                <span class="recap-history-arrow">›</span>
            </div>
        `).join('');

    overlay.innerHTML = `
        <div class="weekly-recap-card">
            <button class="recap-close" onclick="document.getElementById('weeklyRecapOverlay').remove()">✕</button>
            <div class="recap-header">
                <div class="recap-emoji">📚</div>
                <h2 class="recap-title">Past Weeks</h2>
                <div class="recap-week-range">${recaps.length} ${recaps.length === 1 ? 'week' : 'weeks'} stored</div>
            </div>
            <div class="recap-history-list">${listHTML}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
}
