// pettiers.test.js — the 5-level reward ladder: something visibly new every
// 5 levels (collar → hat → jewellery), a fresh outfit each evolution, and
// shop purchases always winning over the drawn versions.
const { suite, test, assert } = require('./harness');
const path = require('path');
const fs = require('fs');

const art = require(path.join(__dirname, '..', 'js', 'petart.js'));
const homeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'home.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

// The real stage boundaries, mirrored from DOG_STAGES in home.js.
const STAGE_MINS = [1, 21, 41, 61, 81, 101, 121, 141, 161, 181];

suite('pet tiers: the 5-level ladder', () => {
    test('mirrors the real DOG_STAGES boundaries', () => {
        const mins = [...homeSrc.matchAll(/minLevel:\s*(\d+)/g)].map(m => +m[1]);
        assert.deepEqual(mins, STAGE_MINS, 'stage table changed — update the ladder');
        assert.deepEqual(art.PET_STAGE_ORDER.length, STAGE_MINS.length);
    });

    test('tier steps up exactly every 5 levels inside a stage', () => {
        for (const base of STAGE_MINS) {
            for (let i = 0; i < 20; i++) {
                assert.equal(art.petTierForLevel(base + i, base), Math.floor(i / 5),
                    `level ${base + i} (stage base ${base})`);
            }
        }
    });

    test('boundaries flip on the exact level, not before or after', () => {
        assert.equal(art.petTierForLevel(24, 21), 0);
        assert.equal(art.petTierForLevel(25, 21), 0);
        assert.equal(art.petTierForLevel(26, 21), 1);
        assert.equal(art.petTierForLevel(30, 21), 1);
        assert.equal(art.petTierForLevel(31, 21), 2);
        assert.equal(art.petTierForLevel(36, 21), 3);
    });

    test('the ladder resets when a new breed arrives', () => {
        assert.equal(art.petTierForLevel(40, 21), 3, 'fully dressed at the end of a stage');
        assert.equal(art.petTierForLevel(41, 41), 0, 'new breed starts bare');
    });

    test('tier never exceeds the top rung, even late in a stage', () => {
        for (let lv = 36; lv <= 40; lv++) assert.equal(art.petTierForLevel(lv, 21), 3);
        assert.equal(art.petTierForLevel(200, 181), 3);
    });

    test('petNextTierLevel points at the next unlock, null when fully dressed', () => {
        assert.equal(art.petNextTierLevel(21, 21), 26);
        assert.equal(art.petNextTierLevel(25, 21), 26);
        assert.equal(art.petNextTierLevel(26, 21), 31);
        assert.equal(art.petNextTierLevel(31, 21), 36);
        assert.equal(art.petNextTierLevel(36, 21), null, 'nothing left to unlock this stage');
    });

    test('works without a stage hint by falling back to the 20-level grid', () => {
        assert.equal(art.petTierForLevel(1), 0);
        assert.equal(art.petTierForLevel(6), 1);
        assert.equal(art.petTierForLevel(26), 1);
        assert.equal(art.petTierForLevel(41), 0);
    });
});

suite('pet tiers: what each rung actually draws', () => {
    const at = (tier) => art.petDogSVG({ stageCss: 'beagle', level: 21 + tier * 5, stageMinLevel: 21 });

    test('tier 0 is a bare dog — no collar, hat or jewellery', () => {
        const svg = at(0);
        for (const part of ['pd-collar', 'pd-hat', 'pd-jewel', 'pd-earring']) {
            assert.falsy(svg.includes(part), `tier 0 should not have ${part}`);
        }
    });

    test('tier 1 adds the gem collar only', () => {
        const svg = at(1);
        assert.truthy(svg.includes('pd-collar'));
        assert.falsy(svg.includes('pd-hat'));
        assert.falsy(svg.includes('pd-jewel'));
    });

    test('tier 2 adds the hat and keeps the collar', () => {
        const svg = at(2);
        assert.truthy(svg.includes('pd-collar') && svg.includes('pd-hat'));
        assert.falsy(svg.includes('pd-jewel'));
    });

    test('tier 3 is the full set: collar, hat, necklace, pendant, earring, sparkles', () => {
        const svg = at(3);
        for (const part of ['pd-collar', 'pd-hat', 'pd-jewel', 'pd-chain', 'pd-pendant', 'pd-earring', 'pd-sparks']) {
            assert.truthy(svg.includes(part), `tier 3 missing ${part}`);
        }
    });

    test('he grows a little at every rung', () => {
        const w = t => +art.petDogSVG({ stageCss: 'beagle', size: 100, tier: t }).match(/width="(\d+)"/)[1];
        assert.truthy(w(1) > w(0) && w(2) > w(1) && w(3) > w(2), 'size must increase each tier');
        assert.truthy(w(3) <= 125, 'growth stays gentle within a stage');
    });

    test('the outfit uses this breed era\'s own accent colour', () => {
        for (const stageCss of art.PET_STAGE_ORDER) {
            const accent = art.petStageAccent(stageCss);
            const svg = art.petDogSVG({ stageCss, tier: 3 });
            assert.truthy(svg.includes(accent.gem), `${stageCss} outfit missing its gem colour`);
        }
    });

    test('every one of the 40 milestones looks different', () => {
        const seen = new Set();
        art.PET_STAGE_ORDER.forEach((stageCss, i) => {
            for (let t = 0; t < art.PET_TIERS; t++) {
                seen.add(art.petDogSVG({ stageCss, tier: t, size: 100 }));
            }
        });
        assert.equal(seen.size, art.PET_STAGE_ORDER.length * art.PET_TIERS, 'two milestones render identically');
    });

    test('crowned breeds upgrade their crown instead of stacking a cap', () => {
        for (const s of ['royal', 'diamond']) {
            assert.equal(art.PET_STAGE_HAT[s], 'crown', s);
            assert.truthy(art.petDogSVG({ stageCss: s, tier: 2 }).includes('pd-crown-jewel'), s);
        }
    });

    test('hat silhouettes vary across eras so no two look the same', () => {
        const shapes = new Set(art.PET_STAGE_ORDER.map(s => art.PET_STAGE_HAT[s]));
        assert.truthy(shapes.size >= 3, 'need at least three hat silhouettes');
    });
});

suite('pet polish: every level has a visible upgrade', () => {
    test('polish advances from 0 to 4 between each outfit reward', () => {
        for (const base of STAGE_MINS) {
            for (let i = 0; i < 20; i++) {
                assert.equal(art.petPolishForLevel(base + i, base), i % 5,
                    `level ${base + i} polish`);
            }
        }
    });

    test('the four polish levels add details cumulatively', () => {
        const at = polish => art.petDogSVG({ stageCss: 'retriever', tier: 1, polish });
        assert.falsy(at(0).includes('pd-level-polish'));
        assert.truthy(at(1).includes('pd-coat-shine'));
        assert.truthy(at(2).includes('pd-paw-detail'));
        assert.truthy(at(3).includes('pd-face-shine'));
        assert.truthy(at(4).includes('pd-level-aura') && at(4).includes('pd-aura-sparks'));
    });

    test('the dog gently grows at every level within an outfit tier', () => {
        const width = polish => +art.petDogSVG({ stageCss: 'poodle', size: 100, tier: 1, polish })
            .match(/width="(\d+)"/)[1];
        for (let polish = 1; polish < 5; polish++) {
            assert.truthy(width(polish) > width(polish - 1), `polish ${polish} must grow`);
        }
    });

    test('all 200 level looks are unique', () => {
        const seen = new Set();
        art.PET_STAGE_ORDER.forEach((stageCss, stageIndex) => {
            const base = STAGE_MINS[stageIndex];
            for (let level = base; level < base + 20; level++) {
                seen.add(art.petDogSVG({ stageCss, level, stageMinLevel: base, size: 100 }));
            }
        });
        assert.equal(seen.size, 200, 'each level should render a distinct pet');
    });

    test('home explains shine progress and keeps pet controls accessible', () => {
        for (const marker of ['pet-polish-meter', 'Shine ${petPolish}/4', 'role="progressbar"',
            'aria-label="Play with ${safePetName}']) {
            assert.truthy(homeSrc.includes(marker), `home missing ${marker}`);
        }
        assert.truthy(cssSrc.includes('.pet-creature:focus-visible'));
        assert.truthy(cssSrc.includes('prefers-reduced-motion: reduce'));
    });
});

suite('pet tiers: shop items win over drawn ones', () => {
    test('an equipped head accessory hides the drawn hat (never two hats)', () => {
        const withHat = art.petDogSVG({ stageCss: 'husky', tier: 3 });
        const bought = art.petDogSVG({ stageCss: 'husky', tier: 3, hasHeadAccessory: true });
        assert.truthy(withHat.includes('pd-hat'));
        assert.falsy(bought.includes('pd-hat'), 'drawn hat must yield to the purchased one');
        assert.truthy(bought.includes('pd-collar'), 'the rest of the outfit stays');
    });

    test('an equipped neck accessory hides the chain but keeps the sparkles', () => {
        const bought = art.petDogSVG({ stageCss: 'husky', tier: 3, hasNeckAccessory: true });
        assert.falsy(bought.includes('pd-chain'));
        assert.falsy(bought.includes('pd-pendant'));
        assert.truthy(bought.includes('pd-sparks'));
    });

    test('the renderer is told which slots are occupied', () => {
        assert.truthy(homeSrc.includes('hasHeadAccessory'), 'home.js must pass slot usage');
        assert.truthy(homeSrc.includes('hasNeckAccessory'));
    });
});

suite('pet tiers: the child is told what is coming', () => {
    test('each rung has a Vietnamese name for the celebration', () => {
        const seen = new Set();
        for (let t = 0; t < art.PET_TIERS; t++) {
            const label = art.petTierLabel(t);
            assert.truthy(label && label.length > 3, `tier ${t} label`);
            seen.add(label);
        }
        assert.equal(seen.size, art.PET_TIERS, 'labels must be distinct');
    });

    test('level-up celebration announces the unlock and draws the new look', () => {
        assert.truthy(homeSrc.includes('petTierForLevel'), 'celebration must compare tiers');
        assert.truthy(homeSrc.includes('Milo có ${what} mới'), 'must announce the new item');
        assert.truthy(homeSrc.includes('drawDog'), 'must draw the live rig, not a stale PNG');
    });

    test('the new outfit parts are animated in the stylesheet', () => {
        for (const kf of ['pdGemShine', 'pdPendant']) {
            assert.truthy(cssSrc.includes('@keyframes ' + kf), `missing @keyframes ${kf}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
