// home-yard-layout.test.js — the homepage garden is just the garden.
//
// The pet bar (avatar, name, level, coins, streak, profile) used to float over
// the top of the garden. It covered the grass the dog walks on, and because the
// page is served viewport-fit=cover it sat under the status bar on a notched
// phone: measured on the real page it occupied the top 20% of the garden while
// an iPhone status bar reaches 19.7% of it. Only a rubber-band pull revealed it.
//
// It is a card of its own now, between the food-wish card and the streak panel,
// and nothing a finger needs sits at the top edge any more. Which means the one
// thing that still has to stay out of that strip is the dog — so it keeps to
// the middle of the garden instead of roaming it corner to corner.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const css = read('css/styles.css');
const ui = read('js/night-raid.js');

const num = (src, name) => Number((src.match(new RegExp(name + '=([\\d.]+)')) || [])[1]);

suite('home: the pet bar sits below the garden, not on top of it', () => {
    test('the bar is no longer inside the garden', () => {
        const zone = html.slice(html.indexOf('id="petHeroZone"'), html.indexOf('id="evolutionOverlay"'));
        assert.falsy(zone.includes('petHeroTopbar'), 'the bar is back inside the garden');
        assert.truthy(zone.includes('petHeroStage'), 'the garden itself must stay');
    });

    test('it lands between the food-wish card and the streak panel', () => {
        const at = id => html.indexOf('id="' + id + '"');
        assert.truthy(at('petHeroTopbar') > at('petQuestCard'), 'the bar must follow the food-wish card');
        assert.truthy(at('petHeroTopbar') < at('streakPanel'), 'and come before the streak panel');
    });

    test('it is dressed as a card, not as chips on a photo', () => {
        const rule = (css.match(/\.pet-hero-topbar \{[^}]*\}/) || [''])[0];
        assert.truthy(rule, 'the bar has no rule');
        assert.falsy(/position:\s*sticky/.test(rule), 'nothing pins it to the top edge any more');
        assert.falsy(/linear-gradient\(to bottom, rgba\(0,0,0/.test(rule),
            'the dark scrim only made sense over artwork');
        assert.truthy(/border-radius/.test(rule) && /box-shadow/.test(rule), 'it should read as a card');
        // The streak panel is pulled up 20px and rides at z-index 15; a card
        // with a lower seat slides underneath it.
        const streak = (css.match(/\.streak-panel \{[^}]*\}/) || [''])[0];
        const z = r => Number((r.match(/z-index:\s*(\d+)/) || [])[1]);
        assert.truthy(z(rule) > z(streak),
            `the bar sits at z-index ${z(rule)} under a streak panel at ${z(streak)}`);
    });

    test('the chips are recoloured for a light card', () => {
        // Every one of these was white-on-translucent-black, which is invisible
        // on a white card.
        for (const chip of ['pet-hero-avatar', 'pet-hero-coins', 'pet-hero-streak', 'pet-hero-info', 'pet-hero-identity']) {
            assert.truthy(css.includes('.pet-hero-topbar .' + chip),
                `${chip} still wears its over-the-photo colours`);
        }
    });
});

suite('home: the dog keeps to the middle of the garden', () => {
    // Measured on the real page, as a share of the garden map: the status bar
    // of a notched phone reaches 19.7% down it, and the name, XP bar and Shop
    // buttons start at 71.2%.
    const STATUS_BAR = 19.7, BOTTOM_FURNITURE = 71.2;

    const YARD = (() => {
        const m = ui.match(/const PET_YARD=\{left:([\d.]+),top:([\d.]+),width:([\d.]+),height:([\d.]+)\}/);
        return m && { left: +m[1], top: +m[2], width: +m[3], height: +m[4] };
    })();

    const bounds = (() => {
        const top = num(ui, 'YARD_TOP_FURNITURE'), bottom = num(ui, 'YARD_BOTTOM_FURNITURE'), h = num(ui, 'PET_SPRITE_H');
        if (!YARD) return null;
        return {
            minX: YARD.left + YARD.width * .12,
            maxX: YARD.left + YARD.width - YARD.width * .12,
            minY: Math.max(YARD.top + 3, top + h),
            maxY: Math.min(YARD.top + YARD.height - 2, bottom - 2),
            spriteH: h,
        };
    })();

    test('the garden rectangle and the patrol band are both readable from source', () => {
        assert.truthy(YARD, 'PET_YARD could not be parsed — this suite is measuring nothing');
        assert.truthy(bounds && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxY),
            'the patrol band could not be parsed');
    });

    test('the dog never walks up behind the status bar', () => {
        // The dog is anchored at its paws, so its head is a sprite-height above.
        const head = bounds.minY - bounds.spriteH;
        assert.truthy(head >= STATUS_BAR,
            `its head reaches ${head.toFixed(1)}% while the status bar covers down to ${STATUS_BAR}%`);
    });

    test('the dog never walks down behind the name, the XP bar or the Shop button', () => {
        assert.truthy(bounds.maxY <= BOTTOM_FURNITURE,
            `its paws reach ${bounds.maxY}% while the furniture starts at ${BOTTOM_FURNITURE}%`);
    });

    test('the band is still big enough to be worth walking', () => {
        const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
        assert.truthy(w > 40 && h > 25, `a ${w.toFixed(0)}% x ${h.toFixed(0)}% pen is too cramped to look alive`);
        // and it must sit in the middle, not hug one side
        const mid = YARD.top + YARD.height / 2, bandMid = (bounds.minY + bounds.maxY) / 2;
        assert.truthy(Math.abs(bandMid - mid) < YARD.height * .2,
            `the band is centred at ${bandMid.toFixed(1)}% against a garden centred at ${mid}%`);
    });

    test('an errand may still take the dog outside the band', () => {
        // Rice fields and ponds can be anywhere on the grid; a dog that could
        // not reach them would stand at the fence and time out.
        assert.truthy(ui.includes('const activeBounds=state.errand?'),
            'the walk must widen its bounds toward whatever it was sent to do');
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
