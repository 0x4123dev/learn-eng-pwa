'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');
const scenes = require('../js/battle-scenes.js');

const ROOT = path.join(__dirname, '..');

suite('battle scene registry', () => {
    test('defines exactly ten unique arenas', () => {
        assert.equal(scenes.scenes.length, 10);
        assert.equal(new Set(scenes.scenes.map(s => s.id)).size, 10);
    });

    test('invalid server or local values fall back safely', () => {
        assert.equal(scenes.normalizeBattleSceneId('../secret'), 'cloudstep-meadow');
        assert.equal(scenes.normalizeBattleSceneId('aurora-glacier'), 'aurora-glacier');
    });

    test('registry resolves exactly 50 WebP assets', () => {
        const paths = scenes.battleSceneAssetPaths();
        assert.equal(paths.length, 50);
        assert.equal(new Set(paths).size, 50);
        paths.forEach(asset => {
            assert.truthy(asset.startsWith('/img/battle-scenes/'));
            assert.truthy(asset.endsWith('.webp'));
            const file = path.join(ROOT, asset.slice(1));
            assert.truthy(fs.existsSync(file), `missing ${asset}`);
            assert.truthy(fs.statSync(file).size > 100, `empty ${asset}`);
            assert.equal(fs.readFileSync(file, null).subarray(0, 4).toString(), 'RIFF');
        });
    });

    test('every arena exposes bilingual labels and layered paths', () => {
        scenes.scenes.forEach(scene => {
            assert.truthy(scene.name.en && scene.name.vi);
            assert.truthy(scene.description.en && scene.description.vi);
            assert.equal(scene.zones.length, 3);
            assert.truthy(scene.far.endsWith('/far-strip.webp'));
            assert.truthy(scene.poster.endsWith('/poster.webp'));
        });
    });
});

suite('battle scene integration', () => {
    const game = fs.readFileSync(path.join(ROOT, 'js/petbattlegame.js'), 'utf8');
    const lobby = fs.readFileSync(path.join(ROOT, 'js/petbattle.js'), 'utf8');
    const server = fs.readFileSync(path.join(ROOT, 'functions/api/_battle.js'), 'utf8');
    const challenge = fs.readFileSync(path.join(ROOT, 'functions/api/battle/challenge.js'), 'utf8');

    test('renderer is isolated below the gameplay canvas', () => {
        assert.truthy(game.includes('pbSceneCanvas'));
        assert.truthy(game.includes('new BattleSceneRenderer'));
        assert.truthy(game.includes('sceneRenderer.setCamera(camX)'));
    });

    test('practice and friend challenges use the selected arena', () => {
        assert.truthy(lobby.includes('backgroundId: pbSelectedSceneId()'));
        assert.truthy(lobby.includes('choosePetBattleScene'));
    });

    // THE guard for this feature. The arena list is declared twice — once in
    // functions/api/_battle.js (ESM, runs on Cloudflare) and once in
    // js/battle-scenes.js (a classic browser script). They cannot import each
    // other without a build step, so nothing but this test stops them drifting.
    //
    // Drift here fails SILENTLY and in the worst possible way: the client
    // offers an arena the server does not know, the server quietly rewrites it
    // to the default when the challenge is snapshotted, and the two players
    // can end up rendering different worlds for the same battle. Same class of
    // bug as the ammo-constant pin above.
    test('the server allowlist and the client registry hold identical ids', () => {
        const block = server.match(/BATTLE_BACKGROUND_IDS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
        assert.truthy(block, 'server allowlist not found — has it been renamed?');
        const serverIds = (block[1].match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
        const clientIds = scenes.scenes.map(s => s.id);

        const missingOnServer = clientIds.filter(id => !serverIds.includes(id));
        const missingOnClient = serverIds.filter(id => !clientIds.includes(id));
        assert.equal(missingOnServer.join(', '), '',
            'the client offers arenas the server would reject and silently replace');
        assert.equal(missingOnClient.join(', '), '',
            'the server accepts arenas the client cannot draw');
        assert.equal(serverIds.length, clientIds.length);
        assert.equal(new Set(serverIds).size, serverIds.length, 'duplicate id in the server allowlist');
    });

    test('both sides fall back to the same arena', () => {
        const m = server.match(/BATTLE_BACKGROUND_DEFAULT\s*=\s*'([^']+)'/);
        assert.truthy(m, 'server default not found');
        // A different default on each side means an unknown id renders as two
        // different worlds instead of one agreed fallback.
        assert.equal(m[1], scenes.normalizeBattleSceneId('definitely-not-an-arena'),
            'server and client disagree on the fallback arena');
        assert.truthy(scenes.scenes.some(s => s.id === m[1]), 'the fallback must be a real arena');
    });

    test('every allowed arena actually has its art on disk', () => {
        // An id both sides accept but with no files is the same silent failure
        // wearing a different hat: the battle loads, the arena does not.
        const missing = [];
        for (const scene of scenes.scenes) {
            for (const rel of [scene.poster, scene.far].concat(scene.zones)) {
                const file = path.join(ROOT, rel.replace(/^\//, ''));
                if (!fs.existsSync(file)) missing.push(rel);
            }
        }
        assert.equal(missing.join(', '), '', 'arena art referenced but not shipped');
    });

    test('server validates and returns the snapshotted arena', () => {
        assert.truthy(server.includes('normalizeBattleBackground'));
        assert.truthy(server.includes('backgroundId: normalizeBattleBackground(b.background_id)'));
        assert.truthy(challenge.includes('background_id'));
        assert.truthy(challenge.includes('normalizeBattleBackground(body.backgroundId)'));
    });
});

// The arena picker is a horizontal scroller inside a screen the lobby poll
// rebuilt from innerHTML once a SECOND. Scrolling to look at arena 7 snapped
// back to arena 1 before a child could tap it.
suite('battle scene picker: the poll must not fight the finger', () => {
    const lobby = fs.readFileSync(path.join(ROOT, 'js/petbattle.js'), 'utf8');

    test('the lobby only redraws when something actually changed', () => {
        assert.truthy(lobby.includes('screen.dataset.pbLobbySig === sig'),
            'without a change gate the picker is destroyed on every poll tick');
        const sig = lobby.slice(lobby.indexOf('const sig = JSON.stringify(['), lobby.indexOf('if (screen.dataset.pbLobbySig'));
        // Everything the lobby draws must be in the signature, or a real
        // change would be swallowed and the screen would go stale.
        for (const part of ['st.ammo', 'st.readyAt', 'st.allowBot', 'ready', '_pbMsg', '_pbLang', '_pbHistoryOpen', 'pbSelectedSceneId']) {
            assert.truthy(sig.includes(part), `${part} is not in the render signature — its change would not repaint`);
        }
    });

    test('a genuine redraw carries the scroll position across', () => {
        assert.truthy(lobby.includes('const keepScroll = prevList ? prevList.scrollLeft : 0'));
        assert.truthy(lobby.includes('nextList.scrollLeft = keepScroll'),
            'a redraw must not snap the child back to the first arena');
    });

    test('every other screen clears the signature, so the lobby is never stale', () => {
        const clears = (lobby.match(/screen\.dataset\.pbLobbySig = ''/g) || []).length;
        assert.truthy(clears >= 3, `only ${clears} branches invalidate the cache`);
    });

    test('the poll constants say what they actually do', () => {
        // The old names claimed the opposite of the expression: the LOBBY is
        // what polls every second, not a running battle.
        assert.truthy(lobby.includes('PB_POLL_LOBBY_MS'), 'name the lobby interval for what it is');
        assert.falsy(lobby.includes('PB_POLL_LIVE_MS'), 'the misleading name should be gone');
        assert.truthy(/_pbGame \? PB_POLL_INGAME_MS : PB_POLL_LOBBY_MS/.test(lobby));
    });

    test('the picker is a scroller, so its scroll position is worth keeping', () => {
        const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
        const block = css.slice(css.indexOf('.pb-scene-list {'), css.indexOf('}', css.indexOf('.pb-scene-list {')));
        assert.truthy(block.includes('overflow-x: auto'), 'the list must actually scroll');
        assert.truthy(block.includes('grid-auto-flow: column'), 'ten arenas in a row');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
