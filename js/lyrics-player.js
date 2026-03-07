// lyrics-player.js - Karaoke-style lyrics player with synced EN/VI display

const LyricsPlayer = (function() {
    let _audio = null;
    let _songData = null;
    let _currentLineIdx = -1;
    let _animFrame = null;
    let _isPlaying = false;

    // --- Song catalog ---
    const SONGS = [
        { id: 'heavenly-jumpstyle', file: 'audio/heavenly-jumpstyle.json' },
        { id: 'wellerman', file: 'audio/wellerman.json' }
    ];

    async function loadSong(songId) {
        const entry = SONGS.find(s => s.id === songId);
        if (!entry) return null;
        const resp = await fetch(entry.file);
        _songData = await resp.json();
        return _songData;
    }

    function openPlayer(songId) {
        const overlay = document.getElementById('lyricsPlayerOverlay');
        overlay.classList.add('active');
        document.getElementById('bottomNav').style.display = 'none';

        overlay.innerHTML = `
            <div class="lp-container">
                <div class="lp-header">
                    <button class="lp-back-btn" onclick="LyricsPlayer.close()">✕</button>
                    <div class="lp-song-info">
                        <div class="lp-song-title">Loading...</div>
                        <div class="lp-song-artist"></div>
                    </div>
                    <div style="width:36px"></div>
                </div>
                <div class="lp-lyrics-area" id="lpLyricsArea">
                    <div class="lp-loading">Loading song...</div>
                </div>
                <div class="lp-controls" id="lpControls"></div>
            </div>
        `;

        loadSong(songId).then(data => {
            if (!data) return;
            renderPlayer(data);
        });
    }

    function renderPlayer(data) {
        // Update header
        const overlay = document.getElementById('lyricsPlayerOverlay');
        overlay.querySelector('.lp-song-title').textContent = data.title;
        overlay.querySelector('.lp-song-artist').textContent = data.artist;

        // Render lyrics lines
        const area = document.getElementById('lpLyricsArea');
        area.innerHTML = data.lines.map((line, i) => `
            <div class="lp-line" id="lpLine${i}">
                <div class="lp-line-en">${escapeHtml(line.en)}</div>
                ${line.vi ? `<div class="lp-line-vi">${escapeHtml(line.vi)}</div>` : ''}
            </div>
        `).join('');

        // Create audio element
        _audio = new Audio(data.audio);
        _audio.preload = 'auto';
        _currentLineIdx = -1;
        _isPlaying = false;

        // Render controls
        renderControls(0, data.duration);

        // Sync loop
        _audio.addEventListener('timeupdate', onTimeUpdate);
        _audio.addEventListener('ended', onEnded);
    }

    function renderControls(currentTime, duration) {
        const controls = document.getElementById('lpControls');
        controls.innerHTML = `
            <div class="lp-progress-row">
                <span class="lp-time" id="lpTimeCurrent">${formatTime(currentTime)}</span>
                <div class="lp-progress-bar" id="lpProgressBar" onclick="LyricsPlayer.seek(event)">
                    <div class="lp-progress-fill" id="lpProgressFill" style="width:0%"></div>
                    <div class="lp-progress-knob" id="lpProgressKnob" style="left:0%"></div>
                </div>
                <span class="lp-time" id="lpTimeTotal">${formatTime(duration)}</span>
            </div>
            <div class="lp-buttons">
                <button class="lp-btn lp-btn-restart" onclick="LyricsPlayer.restart()">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                <button class="lp-btn lp-btn-play" id="lpPlayBtn" onclick="LyricsPlayer.togglePlay()">
                    <svg id="lpPlayIcon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                    <svg id="lpPauseIcon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </button>
                <button class="lp-btn lp-btn-lang" id="lpLangBtn" onclick="LyricsPlayer.toggleLang()">
                    VI
                </button>
            </div>
        `;
    }

    function onTimeUpdate() {
        if (!_audio || !_songData) return;
        const t = _audio.currentTime;
        const dur = _audio.duration || _songData.duration;

        // Update progress bar
        const pct = (t / dur) * 100;
        const fill = document.getElementById('lpProgressFill');
        const knob = document.getElementById('lpProgressKnob');
        const timeEl = document.getElementById('lpTimeCurrent');
        if (fill) fill.style.width = pct + '%';
        if (knob) knob.style.left = pct + '%';
        if (timeEl) timeEl.textContent = formatTime(t);

        // Find current line
        const lines = _songData.lines;
        let newIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (t >= lines[i].time) {
                newIdx = i;
                break;
            }
        }

        if (newIdx !== _currentLineIdx) {
            // Remove old highlight
            if (_currentLineIdx >= 0) {
                const oldEl = document.getElementById('lpLine' + _currentLineIdx);
                if (oldEl) oldEl.classList.remove('lp-line-active');
            }
            _currentLineIdx = newIdx;
            // Add new highlight and scroll
            if (_currentLineIdx >= 0) {
                const newEl = document.getElementById('lpLine' + _currentLineIdx);
                if (newEl) {
                    newEl.classList.add('lp-line-active');
                    newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    function onEnded() {
        _isPlaying = false;
        updatePlayButton();
    }

    function togglePlay() {
        if (!_audio) return;
        if (_audio.paused) {
            _audio.play();
            _isPlaying = true;
        } else {
            _audio.pause();
            _isPlaying = false;
        }
        updatePlayButton();
    }

    function updatePlayButton() {
        const playIcon = document.getElementById('lpPlayIcon');
        const pauseIcon = document.getElementById('lpPauseIcon');
        if (!playIcon || !pauseIcon) return;
        if (_isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    function seek(event) {
        if (!_audio) return;
        const bar = document.getElementById('lpProgressBar');
        const rect = bar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        _audio.currentTime = pct * (_audio.duration || _songData.duration);
    }

    function restart() {
        if (!_audio) return;
        _audio.currentTime = 0;
        if (!_isPlaying) {
            _audio.play();
            _isPlaying = true;
            updatePlayButton();
        }
    }

    let _showVi = true;
    function toggleLang() {
        _showVi = !_showVi;
        const btn = document.getElementById('lpLangBtn');
        if (btn) btn.textContent = _showVi ? 'VI' : 'EN';
        const viLines = document.querySelectorAll('.lp-line-vi');
        viLines.forEach(el => {
            el.style.display = _showVi ? '' : 'none';
        });
    }

    function close() {
        if (_audio) {
            _audio.pause();
            _audio.removeEventListener('timeupdate', onTimeUpdate);
            _audio.removeEventListener('ended', onEnded);
            _audio = null;
        }
        _songData = null;
        _currentLineIdx = -1;
        _isPlaying = false;
        _showVi = true;

        const overlay = document.getElementById('lyricsPlayerOverlay');
        overlay.classList.remove('active');
        overlay.innerHTML = '';
        document.getElementById('bottomNav').style.display = 'flex';
    }

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        openPlayer,
        close,
        togglePlay,
        seek,
        restart,
        toggleLang,
        SONGS
    };
})();
