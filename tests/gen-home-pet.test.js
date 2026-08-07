// tests/gen-home-pet.test.js — Pet hunger decay, mood tiers, poop lifecycle,
// and feeding constants (js/home.js). Characterization tests.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includeHome: true });

const H = 3600000; // ms per hour
const hoursAgo = (h) => Date.now() - h * H;

// Fresh, healthy baseline pet state. Override per test.
function makeState(overrides) {
    return Object.assign({
        petName: 'Rex',
        petHunger: 100,
        petLastFed: Date.now(),
        petPoops: [],
        cleanedPoopIds: [],
        lastStudyDate: new Date().toDateString()
    }, overrides || {});
}

const TODAY = new Date().toDateString();
const YESTERDAY = new Date(Date.now() - 86400000).toDateString();
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86400000).toDateString();

function fakePoops(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push({ id: 'poop-test-' + i, x: 30, y: 80, born: Date.now() - H });
    }
    return arr;
}

// Find a petLastFed timestamp roughly `targetHours` ago whose window-1 poop
// rng decision equals `wantSpawn` (deterministic given the timestamp: the
// windowId seeds seededRandom, same helper the app uses).
function findFedForWindow1(targetHours, wantSpawn) {
    let fed = Date.now() - Math.round(targetHours * H);
    for (let i = 0; i < 10000; i++) {
        const spawns = env.seededRandom('poop-' + fed + '-1')() < 0.6;
        if (spawns === wantSpawn) return fed;
        fed -= 1; // 1 ms earlier keeps hoursSinceFed ≈ targetHours
    }
    throw new Error('no matching petLastFed found');
}

suite('gen: computeCurrentHunger decay', () => {
    test('missing petLastFed defaults to 50 (never-fed pet)', () => {
        assert.equal(env.computeCurrentHunger({}), 50);
    });

    test('petLastFed=0 is falsy and also yields the never-fed default 50', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: 0 }), 50);
    });

    test('fed just now → 100 (full)', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: Date.now() }), 100);
    });

    test('just under 10h since fed → still 100', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: hoursAgo(10) + 60000 }), 100);
    });

    test('10h boundary drops to 75', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: hoursAgo(10) }), 75);
    });

    test('20h boundary drops to 50 — hungry by the next morning', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: hoursAgo(20) }), 50);
    });

    test('36h boundary drops to 25', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: hoursAgo(36) }), 25);
    });

    test('48h boundary hits 0 (very hungry — sad eyes only, never punished)', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: hoursAgo(48) }), 0);
    });

    test('extreme elapsed time (decades) clamps to 0, not negative', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: 1 }), 0);
    });

    test('petLastFed in the future clamps to 100, not above', () => {
        assert.equal(env.computeCurrentHunger({ petLastFed: Date.now() + 1e12 }), 100);
    });

    test('sweep 0–240h: exact schedule level at every 6h step', () => {
        for (let h = 0; h <= 240; h += 6) {
            const v = env.computeCurrentHunger({ petLastFed: hoursAgo(h) });
            const expected = h >= 48 ? 0 : h >= 36 ? 25 : h >= 20 ? 50 : h >= 10 ? 75 : 100;
            assert.equal(v, expected, `hunger at ${h}h since fed`);
        }
    });

    test('hunger never increases as elapsed time grows', () => {
        let prev = Infinity;
        for (let h = 0; h <= 200; h += 4) {
            const v = env.computeCurrentHunger({ petLastFed: hoursAgo(h) });
            assert.truthy(v <= prev, `hunger rose from ${prev} to ${v} at ${h}h`);
            prev = v;
        }
    });

    test('ignores the stored petHunger field — only petLastFed matters', () => {
        const v = env.computeCurrentHunger({ petHunger: 5, petLastFed: Date.now() });
        assert.equal(v, 100);
    });
});

suite('gen: getPetMood tiers', () => {
    test('starving at 96h+ even if studied today', () => {
        env.__setAppState(makeState({ petLastFed: hoursAgo(97), lastStudyDate: TODAY }));
        assert.equal(env.getPetMood(), 'starving');
    });

    test('starving takes precedence over a poop-covered stage', () => {
        env.__setAppState(makeState({
            petLastFed: hoursAgo(100), petPoops: fakePoops(3), lastStudyDate: TODAY
        }));
        assert.equal(env.getPetMood(), 'starving');
    });

    test('hungry at exactly the 36h boundary (hunger 25)', () => {
        env.__setAppState(makeState({ petLastFed: hoursAgo(36), lastStudyDate: TODAY }));
        assert.equal(env.getPetMood(), 'hungry');
    });

    test('hunger ≤25 beats studying today (40h → hungry, not happy)', () => {
        env.__setAppState(makeState({ petLastFed: hoursAgo(40), lastStudyDate: TODAY }));
        assert.equal(env.getPetMood(), 'hungry');
    });

    test('happy: well fed + studied today + clean stage', () => {
        env.__setAppState(makeState());
        assert.equal(env.getPetMood(), 'happy');
    });

    test('neutral: well fed but last studied yesterday', () => {
        env.__setAppState(makeState({ lastStudyDate: YESTERDAY }));
        assert.equal(env.getPetMood(), 'neutral');
    });

    test('sleepy: well fed but last studied 3 days ago', () => {
        env.__setAppState(makeState({ lastStudyDate: THREE_DAYS_AGO }));
        assert.equal(env.getPetMood(), 'sleepy');
    });

    test('sleepy: never studied at all (no lastStudyDate)', () => {
        env.__setAppState(makeState({ lastStudyDate: null }));
        assert.equal(env.getPetMood(), 'sleepy');
    });

    test('3 poops drop happy → neutral (studied today)', () => {
        env.__setAppState(makeState({ petPoops: fakePoops(3) }));
        assert.equal(env.getPetMood(), 'neutral');
    });

    test('3 poops drop neutral → sleepy (studied yesterday)', () => {
        env.__setAppState(makeState({ petPoops: fakePoops(3), lastStudyDate: YESTERDAY }));
        assert.equal(env.getPetMood(), 'sleepy');
    });

    test('3 poops drop sleepy → hungry (stale study date)', () => {
        env.__setAppState(makeState({ petPoops: fakePoops(3), lastStudyDate: THREE_DAYS_AGO }));
        assert.equal(env.getPetMood(), 'hungry');
    });

    test('2 poops are below the mood threshold — still happy', () => {
        env.__setAppState(makeState({ petPoops: fakePoops(2) }));
        assert.equal(env.getPetMood(), 'happy');
    });

    test('mid hunger (20h → 50) does not change mood — still happy', () => {
        env.__setAppState(makeState({ petLastFed: hoursAgo(20) }));
        assert.equal(env.getPetMood(), 'happy');
    });
});

suite('gen: evaluatePoopSpawn lifecycle', () => {
    test('returns undefined and does not throw when appState is null', () => {
        env.__setAppState(null);
        assert.equal(env.evaluatePoopSpawn(), undefined);
        assert.equal(env.__getAppState(), null, 'null appState must stay null');
    });

    test('no petName → early return, petPoops left untouched', () => {
        const st = makeState({ petName: null });
        delete st.petPoops;
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops, undefined);
    });

    test('no petLastFed → early return, petPoops left untouched', () => {
        const st = makeState({ petLastFed: null });
        delete st.petPoops;
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops, undefined);
    });

    test('fed 1h ago: petPoops initialized to [] but nothing spawns', () => {
        const st = makeState({ petLastFed: hoursAgo(1) });
        delete st.petPoops;
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.deepEqual(st.petPoops, []);
    });

    test('just under the 2h delay: still no spawn', () => {
        const st = makeState({ petLastFed: hoursAgo(2) + 60000, petPoops: [] });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 0);
    });

    test('spawn is time-gated, not hunger-gated: poop appears at ~2h while hunger is 100', () => {
        const fed = findFedForWindow1(2.02, true);
        const st = makeState({ petLastFed: fed, petPoops: [] });
        env.__setAppState(st);
        assert.equal(env.computeCurrentHunger(st), 100, 'precondition: pet is full');
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 1);
        assert.equal(st.petPoops[0].id, 'poop-' + fed + '-1');
    });

    test('rng gate: a window whose seeded roll is ≥0.6 spawns nothing', () => {
        const fed = findFedForWindow1(2.02, false);
        const st = makeState({ petLastFed: fed, petPoops: [] });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 0);
    });

    test('spawned poop shape: exact deterministic x/y/born from the window seed', () => {
        const fed = findFedForWindow1(2.02, true);
        const st = makeState({ petLastFed: fed, petPoops: [] });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        const p = st.petPoops[0];
        assert.equal(p.id, 'poop-' + fed + '-1');
        // The same seeded rng stream the app uses: roll #1 = spawn gate,
        // roll #2 = x, roll #3 = y. Values are exactly reproducible.
        const r = env.seededRandom('poop-' + fed + '-1');
        r(); // spawn-gate roll (already known < 0.6)
        assert.equal(p.x, 15 + r() * 70);
        assert.equal(p.y, 70 + r() * 25);
        assert.inRange(p.x, 15, 85);
        assert.inRange(p.y, 70, 95);
        assert.equal(p.born, fed + 2 * H, 'born = feed time + window-1 offset (2h)');
    });

    test('ancient feed time caps at exactly POOP_MAX (3) poops', () => {
        const st = makeState({ petLastFed: 1600000000000, petPoops: [] });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 3);
    });

    test('idempotent: re-evaluation adds no duplicates (below and at POOP_MAX)', () => {
        // Below max: exercises the per-window dedup (petPoops.some(id match)),
        // not just the POOP_MAX early return.
        const fed = findFedForWindow1(2.02, true);
        const st = makeState({ petLastFed: fed, petPoops: [] });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 1);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 1, 'window-1 poop was duplicated');

        // At max: ancient feed caps at 3; a second pass changes nothing.
        const st2 = makeState({ petLastFed: 1600000000000, petPoops: [] });
        env.__setAppState(st2);
        env.evaluatePoopSpawn();
        const ids = st2.petPoops.map(p => p.id).join(',');
        env.evaluatePoopSpawn();
        assert.equal(st2.petPoops.length, 3);
        assert.equal(st2.petPoops.map(p => p.id).join(','), ids);
    });

    test('cleanedPoopIds blocks a window from respawning', () => {
        const fed = findFedForWindow1(2.02, true);
        const st = makeState({
            petLastFed: fed, petPoops: [],
            cleanedPoopIds: ['poop-' + fed + '-1']
        });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 0);
    });

    test('stage already at 3 poops → early return, nothing added', () => {
        const existing = fakePoops(3);
        const st = makeState({ petLastFed: 1600000000000, petPoops: existing });
        env.__setAppState(st);
        env.evaluatePoopSpawn();
        assert.equal(st.petPoops.length, 3);
        assert.equal(st.petPoops[0].id, 'poop-test-0', 'pre-existing poops untouched');
    });
});

suite('gen: feedPet + DOG_FOOD constants', () => {
    test('feedPet adds the amount to petHunger', () => {
        const st = makeState({ petHunger: 10 });
        env.__setAppState(st);
        env.feedPet(30);
        assert.equal(st.petHunger, 40);
    });

    test('feedPet caps petHunger at 100', () => {
        const st = makeState({ petHunger: 90 });
        env.__setAppState(st);
        env.feedPet(40);
        assert.equal(st.petHunger, 100);
    });

    test('feedPet treats undefined petHunger as 0', () => {
        const st = makeState();
        delete st.petHunger;
        env.__setAppState(st);
        env.feedPet(25);
        assert.equal(st.petHunger, 25);
    });

    test('feedPet stamps petLastFed with the current time', () => {
        const st = makeState({ petLastFed: hoursAgo(50) });
        env.__setAppState(st);
        const before = Date.now();
        env.feedPet(10);
        const after = Date.now();
        assert.inRange(st.petLastFed, before, after);
    });

    test('feedPet resets cleanedPoopIds (new feed cycle, new windows)', () => {
        const st = makeState({ cleanedPoopIds: ['poop-1-1', 'poop-1-2'] });
        env.__setAppState(st);
        env.feedPet(5);
        assert.deepEqual(st.cleanedPoopIds, []);
    });

    test('feedPet is a safe no-op when appState is null', () => {
        env.__setAppState(null);
        assert.equal(env.feedPet(10), undefined);
        assert.equal(env.__getAppState(), null, 'null appState must stay null');
    });

    test('DOG_FOOD has 5 items with unique ids', () => {
        assert.equal(env.DOG_FOOD.length, 5);
        const ids = new Set(env.DOG_FOOD.map(f => f.id));
        assert.equal(ids.size, 5);
    });

    test('every food has emoji, name, positive integer price and growth', () => {
        for (const f of env.DOG_FOOD) {
            assert.truthy(f.emoji, `${f.id} missing emoji`);
            assert.truthy(f.name, `${f.id} missing name`);
            assert.truthy(Number.isInteger(f.price) && f.price > 0, `${f.id} bad price`);
            assert.truthy(Number.isInteger(f.growth) && f.growth > 0, `${f.id} bad growth`);
        }
    });

    test('food prices are strictly ascending (bone → feast)', () => {
        for (let i = 1; i < env.DOG_FOOD.length; i++) {
            assert.truthy(env.DOG_FOOD[i].price > env.DOG_FOOD[i - 1].price,
                `${env.DOG_FOOD[i].id} not pricier than ${env.DOG_FOOD[i - 1].id}`);
        }
    });

    test('growth effects are strictly ascending with price', () => {
        for (let i = 1; i < env.DOG_FOOD.length; i++) {
            assert.truthy(env.DOG_FOOD[i].growth > env.DOG_FOOD[i - 1].growth,
                `${env.DOG_FOOD[i].id} growth not above ${env.DOG_FOOD[i - 1].id}`);
        }
    });

    test('cheapest food is the 30-coin bone worth +5 growth', () => {
        const bone = env.DOG_FOOD[0];
        assert.equal(bone.id, 'bone');
        assert.equal(bone.price, 30);
        assert.equal(bone.growth, 5);
    });

    test('coins-per-growth never worsens at higher tiers (bulk value)', () => {
        let prevRatio = Infinity;
        for (const f of env.DOG_FOOD) {
            const ratio = f.price / f.growth;
            assert.truthy(ratio <= prevRatio,
                `${f.id} is worse value (${ratio.toFixed(2)}) than the tier below (${prevRatio.toFixed(2)})`);
            prevRatio = ratio;
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
