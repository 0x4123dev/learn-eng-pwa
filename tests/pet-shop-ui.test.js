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
    test('homepage quest card leaves breathing room and omits duplicate coin totals', () => {
        assert.truthy(/\.pet-quest-card\s*\{[\s\S]*?margin:\s*12px 16px 26px/.test(css));
        assert.truthy(css.includes('.pet-quest-card .pet-quest-meta { display: none; }'));
    });

    test('bot-on yard shop stays a low tray above the complete garden drop zone', () => {
        assert.truthy(home.includes("document.querySelector('#petHeroStage.yard-mode')"));
        assert.truthy(home.includes("document.getElementById('petHeroZone')"));
        assert.truthy(css.includes('.pet-shop-drawer-overlay.yard-shop-overlay'));
        assert.truthy(css.includes('-webkit-backdrop-filter:none'));
        assert.truthy(home.includes("const useFoodDrawer = _shopTab === 'food'"));
        assert.truthy(home.includes("const needsDrawer = _shopTab === 'food'"));
        assert.truthy(css.includes('.pet-shop-modal.food-drag-shop'));
        assert.truthy(css.includes('linear-gradient(180deg,rgba(36,20,64,.04)'));
        assert.truthy(css.includes('.pet-info-modal-overlay.yard-shop-overlay .pet-shop-modal'));
    });

    test('shop controls are real labelled buttons with accessible state', () => {
        assert.truthy(home.includes('role="tablist"'));
        assert.truthy(home.includes('aria-selected="${_shopTab'));
        assert.truthy(home.includes('aria-pressed="${_accCategory'));
        assert.truthy(home.includes('aria-label="Close pet shop"'));
        assert.truthy(/\.shop-buy-btn\s*\{[\s\S]*?min-height:\s*44px/.test(css));
        assert.truthy(/\.shop-tab\s*\{[\s\S]*?min-height:\s*44px/.test(css));
    });

    test('food spends coins only after drag-and-drop into the home garden', () => {
        assert.falsy(home.includes('onclick="buyFood(\'${f.id}\', this)"'),
            'food cards must not expose a direct purchase button');
        assert.truthy(home.includes("document.querySelectorAll('.draggable-food .food-drag-handle')"));
        assert.truthy(home.includes("document.getElementById('petHeroZone')"));
        assert.falsy(home.includes('shop-floating-feed-target'), 'no floating drop box should cover the garden');
        assert.truthy(home.includes('buyFood(foodId, item)'), 'successful drop should be the purchase boundary');
        assert.truthy(home.includes('gx >= rect.left && gx <= rect.right && gy >= rect.top && gy <= rect.bottom'),
            'the complete garden rectangle should accept the drop');
        assert.truthy(home.includes("if (_shopTab === 'food') setTimeout(() => initDragToFeed(), 50)"),
            'yard modal must initialize dragging');
        assert.truthy(css.includes('.shop-food-drag-meta'));
        assert.truthy(css.includes('.pet-hero-zone.drop-target-near'),
            'the whole valid garden must visibly react to a dragged food item');
        assert.truthy(css.includes('.pet-shop-drawer-overlay {'));
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
    harness.runAll().then(code => process.exit(code));
}
