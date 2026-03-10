// rhythm-tap.js - Music menu overlay (Rhythm Tap & Word Chant removed)

// Music menu overlay
function showMusicMenu() {
    // Close bubbles if open
    const bo = document.getElementById('bubblesOverlay');
    if (bo) { bo.classList.remove('active'); bo.innerHTML = ''; }

    const overlay = document.getElementById('musicMenuOverlay');
    overlay.classList.add('active');
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
                <div class="mm-game-card" style="text-align:center;padding:40px 20px;">
                    <div class="mm-game-icon">🎵</div>
                    <div class="mm-game-name">Coming Soon</div>
                    <div class="mm-game-desc">New music features are on the way!</div>
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
