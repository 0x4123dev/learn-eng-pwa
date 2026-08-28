// petcheer.test.js — the pet motivation loop: daily food quest, practice
// combo treats, and the gentle-urgency guarantees (no punishment, ever).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const homeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'home.js'), 'utf8');

// petcheer.js only touches globals at call time, so a light sandbox is enough.
function loadPet(state, opts) {
    opts = opts || {};
    delete require.cache[require.resolve(path.join(__dirname, '..', 'js', 'petcheer.js'))];
    global.appState = state;
    global.document = undefined;
    global.DOG_FOOD = opts.foods || [
        { id: 'bone', emoji: '🦴', name: 'Bone', price: 30, growth: 5 },
        { id: 'steak', emoji: '🍖', name: 'Steak', price: 80, growth: 15 },
        { id: 'chicken', emoji: '🍗', name: 'Chicken', price: 150, growth: 30 },
        { id: 'cake', emoji: '🧁', name: 'Cake', price: 240, growth: 50 },
        { id: 'feast', emoji: '👑', name: 'Royal Feast', price: 550, growth: 120 },
    ];
    global.DOG_STAGES = [
        { minLevel: 1, fallback: '🐶', name: 'Chihuahua' },
        { minLevel: 21, fallback: '🐕', name: 'Beagle' },
        { minLevel: 41, fallback: '🐩', name: 'Poodle' },
    ];
    global.getDogStage = (lv) => {
        for (let i = global.DOG_STAGES.length - 1; i >= 0; i--) if (lv >= global.DOG_STAGES[i].minLevel) return global.DOG_STAGES[i];
        return global.DOG_STAGES[0];
    };
    global.getHomeDailyActivity = opts.activity ? () => opts.activity : undefined;
    global.seededRandom = () => () => 0.99;      // deterministic: last of the pool
    global.currentUser = 'T';
    global.saveUserData = () => {};
    return require(path.join(__dirname, '..', 'js', 'petcheer.js'));
}

suite('pet: economy is priced for a child\'s daily rhythm', () => {
    test('food prices sit at one-session to one-good-day reach', () => {
        const m = homeSrc.match(/const DOG_FOOD = \[([\s\S]*?)\];/);
        assert.truthy(m, 'DOG_FOOD not found');
        const prices = [...m[1].matchAll(/price:\s*(\d+)/g)].map(x => +x[1]);
        assert.deepEqual(prices, [30, 80, 150, 240, 550]);
        // A 10-question session at 80% earns 40 coins: the snack must be reachable.
        assert.truthy(prices[0] <= 40, 'cheapest food must be one session or less');
    });

    test('hunger reaches "hungry" within a day so the pet asks daily', () => {
        const m = homeSrc.match(/HUNGER_DECAY_SCHEDULE = \[([\s\S]*?)\];/);
        assert.truthy(m, 'schedule not found');
        const rows = [...m[1].matchAll(/hoursWithout:\s*(\d+),\s*level:\s*(\d+)/g)]
            .map(x => ({ h: +x[1], lv: +x[2] }));
        const hungryRow = rows.find(r => r.lv === 50);
        assert.truthy(hungryRow && hungryRow.h <= 24, 'should be hungry within a day');
        const emptyRow = rows.find(r => r.lv === 0);
        assert.truthy(emptyRow && emptyRow.h <= 48, 'very hungry by two days');
    });

    // Gentle urgency: hunger drives empathy, never punishment.
    test('feeding never subtracts XP and hunger never lowers the dog level', () => {
        assert.falsy(/dogGrowthXP\s*=\s*[^;]*-\s*[1-9]/.test(homeSrc), 'XP must never be deducted');
        assert.falsy(/dogLevel\s*=\s*[^;]*-\s*[1-9]/.test(homeSrc), 'level must never be reduced');
    });
});

suite('pet: daily food quest', () => {
    test('asks for a food the child can actually afford in a day', () => {
        // ~20 questions/day → ~80 coins/day → steak (80) is the top reachable
        const pet = loadPet({ coins: 0 }, { activity: [{ count: 20 }, { count: 20 }, { count: 20 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }] });
        const food = pet.petFoodQuestToday();
        assert.truthy(food.price <= 80, `asked for ${food.name} (${food.price})`);
    });

    test('a brand-new learner is never asked for something unreachable', () => {
        const pet = loadPet({ coins: 0 });
        const food = pet.petFoodQuestToday();
        assert.truthy(food.price <= 50, `new learner asked for ${food.price}`);
    });

    test('quest state initialises for today and completes when that food is bought', () => {
        const st = { coins: 500 };
        const pet = loadPet(st);
        const { food, done } = pet.petFoodQuestState();
        assert.falsy(done);
        assert.equal(st.petFoodQuest.foodId, food.id);
        assert.falsy(pet.petFoodQuestOnFeed('nope-not-today'), 'other food must not complete it');
        assert.truthy(pet.petFoodQuestOnFeed(food.id));
        assert.truthy(pet.petFoodQuestState().done);
    });

    test('quest resets on a new day (stale date is replaced)', () => {
        const st = { coins: 0, petFoodQuest: { date: 'Mon Jan 01 2020', foodId: 'feast', done: true } };
        const pet = loadPet(st);
        const q = pet.petFoodQuestState();
        assert.falsy(q.done, 'yesterday\'s completion must not carry over');
        assert.equal(st.petFoodQuest.date, new Date().toDateString());
    });
});

suite('pet: practice combo treats', () => {
    test('every 5-in-a-row earns a bonus, wrong answers reset the streak', () => {
        const pet = loadPet({ coins: 0 });
        pet.petCheerReset();
        for (let i = 0; i < 4; i++) pet.petCheerAnswer(true);
        assert.equal(pet.petComboState().bonus, 0, 'no bonus before 5');
        pet.petCheerAnswer(true);
        assert.equal(pet.petComboState().bonus, pet.PET_COMBO_BONUS);
        pet.petCheerAnswer(false);
        assert.equal(pet.petComboState().streak, 0, 'wrong answer breaks the streak');
        for (let i = 0; i < 5; i++) pet.petCheerAnswer(true);
        assert.equal(pet.petComboState().bonus, pet.PET_COMBO_BONUS * 2);
        assert.equal(pet.petComboState().best, 5);
    });

    test('petComboBonus pays out once and resets for the next session', () => {
        const pet = loadPet({ coins: 0 });
        pet.petCheerReset();
        for (let i = 0; i < 10; i++) pet.petCheerAnswer(true);
        assert.equal(pet.petComboBonus(), pet.PET_COMBO_BONUS * 2);
        assert.equal(pet.petComboBonus(), 0, 'must not pay twice');
    });

    test('cheering is safe with no DOM and no appState', () => {
        const pet = loadPet(null);
        pet.petCheerAnswer(true);
        pet.petCheerAnswer(false);
        assert.equal(pet.petFaceEmoji(), '🐶');
    });
});

suite('pet: reward card + evolution', () => {
    test('reward card shows the coins, the dog, its hunger and every food', () => {
        const pet = loadPet({ coins: 200, dogLevel: 10, petName: 'Milo', petLastFed: Date.now() });
        const html = pet.petRewardCardHTML(8, 10, 40);
        assert.truthy(html.includes('+40 🪙'));
        assert.truthy(html.includes('Milo'));
        assert.truthy(html.includes('pet-hunger-fill'));
        for (const f of global.DOG_FOOD) assert.truthy(html.includes(f.emoji), `missing ${f.name}`);
        // affordable foods enabled, expensive ones locked (not hidden)
        assert.truthy(html.includes('pet-feed-btn locked'), 'expensive food should be shown as locked');
    });

    test('evolution line names the next breed and levels remaining', () => {
        const pet = loadPet({ coins: 0, dogLevel: 18 });
        const html = pet.petEvolutionLineHTML();
        assert.truthy(html.includes('Chihuahua'));
        assert.truthy(html.includes('Beagle'));
        assert.truthy(html.includes('<b>3</b>'), 'should say 3 levels to go');
    });

    test('max-stage pet gets a crown line instead of a broken next-stage', () => {
        const pet = loadPet({ coins: 0, dogLevel: 50 });
        assert.truthy(pet.petEvolutionLineHTML().includes('👑'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
