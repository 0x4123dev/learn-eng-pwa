// pet-shop-ui.test.js — visual and accessibility contracts for the children's
// pet collection. These protect the illustrated treats, clear progression and
// touch-friendly dress-up shop from silently falling back to the old tiny UI.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'js', 'home.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

suite('pet shop: illustrated child-friendly catalog', () => {
    test('all five treats have names, descriptions, colours and SVG artwork', () => {
        for (const id of ['bone', 'steak', 'chicken', 'cake', 'feast']) {
            assert.truthy(home.includes(`id: '${id}'`), `missing ${id}`);
        }
        assert.truthy(/function petFoodArt\(food\)/.test(home));
        assert.truthy((home.match(/<svg \$\{common\}>/g) || []).length >= 5,
            'every food tier should render as code-native SVG');
        assert.truthy(home.includes('shop-xp-burst'), 'growth reward must be visible on each treat');
    });

    test('accessories communicate rarity, ownership and equipped state', () => {
        assert.truthy(/function petAccessoryRarity\(acc\)/.test(home));
        for (const rarity of ['playful', 'rare', 'epic', 'legendary', 'special']) {
            assert.truthy(home.includes(`key: '${rarity}'`), `missing ${rarity} tier`);
        }
        assert.truthy(home.includes('Your dog is wearing this'));
        assert.truthy(home.includes('Ready in your wardrobe'));
    });
});

suite('pet shop: touch and responsive UX', () => {
    test('shop controls are real labelled buttons with accessible state', () => {
        assert.truthy(home.includes('role="tablist"'));
        assert.truthy(home.includes('aria-selected="${_shopTab'));
        assert.truthy(home.includes('aria-pressed="${_accCategory'));
        assert.truthy(home.includes('aria-label="Close pet shop"'));
        assert.truthy(/\.shop-buy-btn\s*\{[\s\S]*?min-height:\s*44px/.test(css));
        assert.truthy(/\.shop-tab\s*\{[\s\S]*?min-height:\s*44px/.test(css));
    });

    test('phone and iPad layouts have explicit collection breakpoints', () => {
        assert.truthy(css.includes('@media (max-width: 520px)'));
        assert.truthy(css.includes('@media (min-width: 700px)'));
        assert.truthy(/grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/.test(css));
        assert.truthy(css.includes('env(safe-area-inset-bottom)'));
    });

    test('the pet collection uses the live dog renderer for all evolution cards', () => {
        assert.truthy(home.includes("petDogSVG({ stageCss: s.stageCss"));
        assert.truthy(home.includes('pet-evolution-state'));
        assert.truthy(home.includes('10 real breeds · small → giant'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
