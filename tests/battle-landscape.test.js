'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const game = read('js/petbattlegame.js');
const lobby = read('js/petbattle.js');
const css = read('css/styles.css');
const manifest = JSON.parse(read('manifest.json'));

suite('battle landscape button', () => {
    test('the installed app is no longer locked to portrait', () => {
        assert.equal(manifest.orientation, 'any');
    });

    test('the battle exposes a labelled real button with an SVG icon', () => {
        assert.truthy(game.includes('class="pb-landscape-btn"'));
        assert.truthy(game.includes('onclick="_pbGameLandscape()"'));
        assert.truthy(game.includes("gT('gLandscapeAria')"));
        const button = game.slice(game.indexOf('class="pb-landscape-btn"'), game.indexOf('</button>', game.indexOf('class="pb-landscape-btn"')));
        assert.truthy(button.includes('<svg'));
        assert.falsy(button.includes('📱'), 'the rotate action should not rely on an emoji glyph');
    });

    test('the button enters fullscreen before requesting a landscape lock', () => {
        const start = game.indexOf('PetBattleGame.prototype.enterLandscape');
        const fn = game.slice(start, game.indexOf('// ---- layout ----', start));
        assert.truthy(fn.includes('requestFullscreen'));
        assert.truthy(fn.includes("screen.orientation.lock('landscape')"));
        assert.truthy(fn.indexOf('requestFullscreen') < fn.indexOf("screen.orientation.lock('landscape')"),
            'Android commonly requires fullscreen before orientation.lock');
    });

    test('iOS gets a clear rotate-device fallback instead of broken fake rotation', () => {
        assert.truthy(game.includes('id="pbRotateTip"'));
        assert.truthy(game.includes('role="dialog"'));
        assert.truthy(lobby.includes('gRotateTitle') && lobby.includes('gRotateHint'));
        assert.falsy(/\.pb-(?:game|canvas)[^{]*\{[^}]*transform:\s*rotate\(/s.test(css),
            'CSS-rotating the canvas would break tap-to-world coordinates');
    });

    test('the landscape control is thumb-sized, focus-visible and disappears when no longer needed', () => {
        const start = css.indexOf('.pb-landscape-btn {');
        const block = css.slice(start, css.indexOf('}', start));
        assert.truthy(/min-width:\s*44px/.test(block));
        assert.truthy(/min-height:\s*44px/.test(block));
        assert.truthy(css.includes('.pb-landscape-btn:focus-visible'));
        const media = css.slice(css.indexOf('@media (orientation: landscape)'), css.indexOf('}', css.indexOf('@media (orientation: landscape)')) + 1);
        assert.truthy(media.includes('.pb-landscape-btn'));
    });

    test('orientation listeners are removed when the battle closes', () => {
        assert.truthy(game.includes("addEventListener('orientationchange', this._orientationHandler)"));
        assert.truthy(game.includes("removeEventListener('orientationchange', this._orientationHandler)"));
        assert.truthy(game.includes("removeEventListener('resize', this._orientationHandler)"));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
