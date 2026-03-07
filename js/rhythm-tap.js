// rhythm-tap.js - Music menu overlay (Rhythm Tap & Word Chant removed)

// Music menu overlay
function showMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderMusicMenu();
}

function renderMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');

    overlay.innerHTML = `
        <div class="mm-container">
            <div class="mm-header">
                <button class="mm-exit-btn" onclick="closeMusicMenu()">✕</button>
                <div class="mm-title">🎵 Music</div>
                <div style="width:36px"></div>
            </div>

            <div class="mm-games">
                <div class="mm-game-card mm-lyrics-card">
                    <div class="mm-game-icon">🎧</div>
                    <div class="mm-game-name">Lyrics Player</div>
                    <div class="mm-game-desc">Listen to songs & learn with synced lyrics!</div>
                    <div class="mm-songs-list">
                        ${LyricsPlayer.SONGS.map(s => `
                            <button class="mm-song-item" onclick="closeMusicMenu(); LyricsPlayer.openPlayer('${s.id}');">
                                <span class="mm-song-icon">🎵</span>
                                <span class="mm-song-name">${s.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                <span class="mm-song-play">▶</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="mm-game-card">
                    <div class="mm-game-icon">⏱</div>
                    <div class="mm-game-name">Calibrate Timing</div>
                    <div class="mm-game-desc">Fix lyrics sync — tap along to set timestamps</div>
                    <div class="mm-songs-list">
                        ${LyricsPlayer.SONGS.map(s => {
                            var hasCal = false;
                            try { hasCal = !!localStorage.getItem('cal_' + s.id); } catch(e) {}
                            return '<button class="mm-song-item" onclick="closeMusicMenu(); LyricsPlayer.openCalibrate(\'' + s.id + '\');">' +
                                '<span class="mm-song-icon">' + (hasCal ? '✅' : '🎵') + '</span>' +
                                '<span class="mm-song-name">' + s.id.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) + '</span>' +
                                '<span class="mm-song-play">⏱</span>' +
                            '</button>';
                        }).join('')}
                    </div>
                    <button class="mm-play-btn" onclick="closeMusicMenu(); LyricsPlayer.openExport();" style="margin-top:8px;">
                        📋 Export Calibrated JSON
                    </button>
                </div>
            </div>
        </div>
    `;
}

function closeMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
}
