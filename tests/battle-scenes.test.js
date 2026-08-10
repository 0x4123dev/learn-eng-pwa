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

    test('server validates and returns the snapshotted arena', () => {
        assert.truthy(server.includes('normalizeBattleBackground'));
        assert.truthy(server.includes('backgroundId: normalizeBattleBackground(b.background_id)'));
        assert.truthy(challenge.includes('background_id'));
        assert.truthy(challenge.includes('normalizeBattleBackground(body.backgroundId)'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
