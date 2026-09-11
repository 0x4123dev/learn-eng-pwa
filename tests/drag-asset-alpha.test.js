// Dragged artwork sits over one shared meadow. A baked rectangular backdrop
// creates a visibly different patch of grass and must never ship.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const plots = ['stone', 'hedge', 'clover'];

suite('draggable artwork uses real transparency', () => {
    for (const style of plots) {
        test(`${style} farm plot contains a WebP alpha chunk`, () => {
            const bytes = fs.readFileSync(path.join(root, 'img', 'farm', `farm-plot-${style}.webp`));
            assert.truthy(bytes.includes(Buffer.from('ALPH')),
                `${style} plot has an opaque rectangular background instead of true alpha`);
        });
    }

    test('the project rule forbids baked ground behind every drag asset', () => {
        const instructions = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
        assert.truthy(instructions.includes('Drag/drop artwork must use true alpha'));
        assert.truthy(instructions.includes('Never bake a rectangular lawn'));
    });

    test('the plot container does not paint another rectangular lawn behind the alpha', () => {
        const css = require('./css-all').readAllCss();
        const rule = (css.match(/\.nr-farm-plot\{[^}]+\}/) || [''])[0];
        assert.truthy(rule.includes('background:transparent'));
        assert.truthy(rule.includes('border:0'));
        assert.truthy(rule.includes('box-shadow:none'));
    });
});
