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
        { id: 'wellerman', file: 'audio/wellerman.json' },
        { id: 'lust', file: 'audio/lust.json' },
        { id: 'bad-with-us', file: 'audio/bad-with-us.json' },
        { id: 'hazbin-guarantee', file: 'audio/hazbin-guarantee.json' },
        { id: 'poison', file: 'audio/poison.json' }
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

    function seekTo(seconds) {
        if (_audio) _audio.currentTime = seconds;
    }

    function getDebugInfo() {
        return { time: _audio ? _audio.currentTime : 0, line: _currentLineIdx };
    }

    // --- Calibration Mode ---
    // Play song + tap to mark when each line starts singing
    let _calLineIdx = 0;
    let _calTimestamps = [];
    let _calActive = false;

    function openCalibrate(songId) {
        const overlay = document.getElementById('lyricsPlayerOverlay');
        overlay.classList.add('active');
        document.getElementById('bottomNav').style.display = 'none';

        overlay.innerHTML = `
            <div class="lp-container">
                <div class="lp-header">
                    <button class="lp-back-btn" onclick="LyricsPlayer.closeCalibrate()">✕</button>
                    <div class="lp-song-info">
                        <div class="lp-song-title">⏱ Calibrate Mode</div>
                        <div class="lp-song-artist">Loading...</div>
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
            renderCalibrate(data);
        });
    }

    function renderCalibrate(data) {
        const overlay = document.getElementById('lyricsPlayerOverlay');
        overlay.querySelector('.lp-song-artist').textContent = data.title;

        _audio = new Audio(data.audio);
        _audio.preload = 'auto';
        _calLineIdx = 0;
        _calTimestamps = [];
        _calActive = true;
        _isPlaying = false;

        // Show ALL lyrics in scrollable area (like normal player)
        const area = document.getElementById('lpLyricsArea');
        area.innerHTML = data.lines.map((line, i) => `
            <div class="lp-line cal-line" id="calLine${i}" style="opacity:0.35;transition:opacity 0.3s,transform 0.3s;">
                <div class="lp-line-en">${escapeHtml(line.en)}</div>
            </div>
        `).join('');

        // Highlight first line
        updateCalHighlight(data);

        // Controls: timer + play + tap + undo
        const controls = document.getElementById('lpControls');
        controls.innerHTML = `
            <div style="text-align:center;padding:4px 0;">
                <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px;">
                    <span id="calProgress" style="font-size:12px;color:#aaa;">Line 1 / ${data.lines.length}</span>
                    <span id="calTimeDisplay" style="font-size:16px;font-weight:bold;color:#7c4dff;font-family:monospace;">0:00.0</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <button class="lp-btn lp-btn-play" id="lpPlayBtn" onclick="LyricsPlayer.togglePlay()" style="width:48px;height:48px;flex-shrink:0;">
                        <svg id="lpPlayIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                        <svg id="lpPauseIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    </button>
                    <button id="calTapBtn" onclick="LyricsPlayer.calTap()" style="
                        flex:1;height:56px;border-radius:14px;border:none;
                        background:linear-gradient(135deg,#667eea,#764ba2);
                        color:#fff;font-size:16px;font-weight:bold;cursor:pointer;
                        box-shadow:0 4px 15px rgba(118,75,162,0.4);
                        transition:transform 0.1s;
                    ">
                        👆 TAP when line starts
                    </button>
                    <button onclick="LyricsPlayer.calUndo()" style="
                        background:none;border:1px solid #555;color:#aaa;
                        padding:8px 10px;border-radius:8px;font-size:12px;cursor:pointer;flex-shrink:0;
                    ">↩</button>
                </div>
            </div>
        `;

        // Update time display continuously
        _audio.addEventListener('timeupdate', function() {
            var td = document.getElementById('calTimeDisplay');
            if (td && _audio) {
                var t = _audio.currentTime;
                var m = Math.floor(t / 60);
                var s = (t % 60).toFixed(1);
                td.textContent = m + ':' + (s < 10 ? '0' : '') + s;
            }
        });
        _audio.addEventListener('ended', onEnded);
    }

    function updateCalHighlight(data) {
        if (!data) data = _songData;
        var prog = document.getElementById('calProgress');

        if (_calLineIdx >= data.lines.length) {
            if (prog) prog.textContent = 'All ' + data.lines.length + ' lines done!';
            finishCalibrate(data);
            return;
        }

        if (prog) prog.textContent = 'Line ' + (_calLineIdx + 1) + ' / ' + data.lines.length;

        // Update all line styles
        data.lines.forEach(function(_, i) {
            var el = document.getElementById('calLine' + i);
            if (!el) return;
            if (i < _calLineIdx) {
                // Already tapped — dim with checkmark color
                el.style.opacity = '0.3';
                el.style.transform = '';
            } else if (i === _calLineIdx) {
                // Current line — bright + scaled
                el.style.opacity = '1';
                el.style.transform = 'scale(1.02)';
                el.classList.add('lp-line-active');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Upcoming — slightly visible
                el.style.opacity = '0.4';
                el.style.transform = '';
                el.classList.remove('lp-line-active');
            }
        });
    }

    function calTap() {
        if (!_audio || !_calActive || !_songData) return;
        if (_calLineIdx >= _songData.lines.length) return;

        var t = parseFloat(_audio.currentTime.toFixed(1));
        _calTimestamps.push(t);
        _calLineIdx++;

        // Flash feedback
        var btn = document.getElementById('calTapBtn');
        if (btn) {
            btn.style.transform = 'scale(0.95)';
            setTimeout(function() { btn.style.transform = ''; }, 100);
        }

        updateCalHighlight(_songData);
    }

    function calUndo() {
        if (_calTimestamps.length === 0) return;
        _calTimestamps.pop();
        _calLineIdx = _calTimestamps.length;
        updateCalHighlight(_songData);
    }

    function finishCalibrate(data) {
        // Apply timestamps to song data
        var newLines = data.lines.map(function(line, i) {
            return {
                time: _calTimestamps[i] || line.time,
                en: line.en,
                vi: line.vi
            };
        });

        // Show result + auto-save button
        var area = document.getElementById('lpLyricsArea');
        var jsonStr = JSON.stringify({ id: data.id, title: data.title, artist: data.artist, audio: data.audio, duration: Math.ceil(_audio.duration || data.duration), lines: newLines }, null, 2);

        area.innerHTML = `
            <div style="padding:16px;">
                <div style="font-size:16px;font-weight:bold;color:#4caf50;margin-bottom:12px;">✅ Calibration Complete!</div>
                <div style="font-size:13px;color:#aaa;margin-bottom:12px;">Timestamps recorded for all ${data.lines.length} lines.</div>
                <button onclick="LyricsPlayer.applyCal()" style="
                    width:100%;padding:14px;border-radius:12px;border:none;
                    background:linear-gradient(135deg,#4caf50,#2e7d32);
                    color:#fff;font-size:16px;font-weight:bold;cursor:pointer;
                    margin-bottom:12px;
                ">💾 Apply & Save</button>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">JSON output (for manual copy):</div>
                <textarea id="calJsonOutput" readonly style="
                    width:100%;height:200px;background:#1a1a2e;color:#aaa;
                    border:1px solid #333;border-radius:8px;padding:8px;
                    font-size:11px;font-family:monospace;resize:vertical;
                ">${escapeHtml(jsonStr)}</textarea>
            </div>
        `;

        // Store for apply
        window._calNewData = { id: data.id, lines: newLines, duration: Math.ceil(_audio.duration || data.duration) };

        if (_audio) { _audio.pause(); _isPlaying = false; }
    }

    function applyCal() {
        if (!window._calNewData) return;
        var d = window._calNewData;
        // Save via fetch to local file (won't work for static hosting, so copy JSON instead)
        var ta = document.getElementById('calJsonOutput');
        if (ta) {
            ta.select();
            try { document.execCommand('copy'); } catch(e) {}
        }
        alert('JSON copied to clipboard!\\nPaste it into audio/' + d.id + '.json to save.\\n\\nOr share the JSON output with Claude to update the file.');
    }

    function closeCalibrate() {
        _calActive = false;
        _calTimestamps = [];
        _calLineIdx = 0;
        close();
    }

    return {
        openPlayer,
        close,
        togglePlay,
        seek,
        seekTo,
        restart,
        toggleLang,
        getDebugInfo,
        openCalibrate,
        closeCalibrate,
        calTap,
        calUndo,
        applyCal,
        SONGS
    };
})();
