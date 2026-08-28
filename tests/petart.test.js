// petart.test.js — the rigged SVG dog: every breed renders a complete,
// animatable, self-contained figure (no external assets, no broken markup).
const { suite, test, assert } = require('./harness');
const path = require('path');
const fs = require('fs');

const art = require(path.join(__dirname, '..', 'js', 'petart.js'));
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

const BREEDS = Object.keys(art.PET_BREED_LOOKS);
// Parts the CSS animates — a missing one means a dead rig.
const RIG_PARTS = ['pd-shadow', 'pd-body-grp', 'pd-head-grp', 'pd-tail', 'pd-head',
    'pd-body', 'pd-eye', 'pd-lid', 'pd-nose', 'pd-mouth', 'pd-ear'];

suite('pet art: the rig', () => {
    test('covers all ten breed stages', () => {
        assert.equal(BREEDS.length, 10);
        for (const b of ['chihuahua', 'pomeranian', 'beagle', 'corgi', 'bulldog',
            'husky', 'retriever', 'shepherd', 'rottweiler', 'tibetan-mastiff']) {
            assert.truthy(art.PET_BREED_LOOKS[b], `missing breed ${b}`);
        }
    });

    test('every breed renders a complete rig with all animatable parts', () => {
        for (const b of BREEDS) {
            const svg = art.petDogSVG({ stageCss: b, size: 96 });
            assert.truthy(svg.trim().startsWith('<svg'), b);
            assert.truthy(svg.trim().endsWith('</svg>'), b);
            for (const part of RIG_PARTS) {
                assert.truthy(svg.includes(part), `${b} is missing "${part}"`);
            }
        }
    });

    test('breeds actually look different (colour or markings)', () => {
        const shapes = new Set(BREEDS.map(b => art.petDogSVG({ stageCss: b, size: 40 })));
        assert.equal(shapes.size, BREEDS.length, 'two breeds render identically');
    });

    test('signature breeds have recognisable anatomy, not fantasy variants', () => {
        const bulldog = art.petDogSVG({ stageCss: 'bulldog', size: 96 });
        const mastiff = art.petDogSVG({ stageCss: 'tibetan-mastiff', size: 96 });
        assert.truthy(bulldog.includes('rx="31"') && bulldog.includes('rx="19"'), 'bulldog needs a broad head and short wide muzzle');
        assert.truthy(bulldog.includes('pd-ear') && bulldog.includes('Q18 23 21 14'), 'bulldog needs rose-fold ears');
        assert.truthy(mastiff.includes('Q84 16 80 29') && mastiff.includes('rx="33"'), 'mastiff needs a lion-like mane and giant body');
        assert.falsy(BREEDS.includes('diamond') || BREEDS.includes('royal'), 'fantasy dog types must not replace real breeds');
    });

    test('Pomeranian fluff is a continuous ruff, not four swollen circles on its face', () => {
        const svg = art.petDogSVG({ stageCss: 'pomeranian', size: 100, level: 38, stageMinLevel: 21 });
        const fluff = svg.match(/<g class="pd-breed-detail pd-pomeranian-fluff"[\s\S]*?<\/g>/)?.[0] || '';
        assert.truthy(fluff.includes('pd-cheek-fluff'));
        assert.truthy(fluff.includes('pd-chest-ruff'));
        assert.equal((fluff.match(/<circle\b/g) || []).length, 0);
    });

    test('no external references — fully offline and CSP-safe', () => {
        for (const b of BREEDS) {
            const svg = art.petDogSVG({ stageCss: b });
            // The xmlns declaration is an identifier, never fetched — ignore it.
            const body = svg.replace(/xmlns="[^"]*"/g, '');
            assert.falsy(/https?:|<image|xlink:href|url\(/.test(body), `${b} pulls an external asset`);
            assert.falsy(/<script/i.test(svg), `${b} contains a script`);
        }
    });

    test('tags are balanced (no truncated markup)', () => {
        for (const b of BREEDS) {
            const svg = art.petDogSVG({ stageCss: b });
            const opens = (svg.match(/<g[ >]/g) || []).length;
            const closes = (svg.match(/<\/g>/g) || []).length;
            assert.equal(opens, closes, `${b} has unbalanced <g> tags`);
        }
    });

    test('size scales width and height together', () => {
        const svg = art.petDogSVG({ stageCss: 'husky', size: 120 });
        assert.truthy(svg.includes('width="120"'));
        assert.truthy(svg.includes('height="130"'));      // 120 * 1.08 rounded
        assert.truthy(art.petDogMiniSVG('husky').includes('width="34"'));
    });

    test('unknown breed falls back to the starter dog instead of breaking', () => {
        const svg = art.petDogSVG({ stageCss: 'not-a-dog' });
        assert.truthy(svg.includes('<svg'));
        assert.equal(art.petBreedLook('not-a-dog'), art.PET_BREED_LOOKS.chihuahua);
    });
});

suite('pet art: moods and reactions', () => {
    test('hungry/starving/sad moods add the droopy-ear class', () => {
        for (const mood of ['hungry', 'starving', 'sad']) {
            assert.truthy(art.petDogSVG({ stageCss: 'beagle', mood }).includes('pd-sad'), mood);
        }
    });

    test('happy mood has no sad class', () => {
        assert.falsy(art.petDogSVG({ stageCss: 'beagle', mood: 'happy' }).includes('pd-sad'));
    });

    test('petDogPlay is a safe no-op without a DOM', () => {
        art.petDogPlay('hop');
        assert.truthy(true);
    });

    test('every animation the rig relies on exists in the stylesheet', () => {
        for (const kf of ['pdBreathe', 'pdSway', 'pdWag', 'pdBlink', 'pdHop', 'pdChew', 'pdLevelUp']) {
            assert.truthy(cssSrc.includes('@keyframes ' + kf), `missing @keyframes ${kf}`);
        }
        assert.truthy(cssSrc.includes('prefers-reduced-motion'), 'must respect reduced motion');
    });
});

suite('pet art: colour helper', () => {
    test('shade darkens and lightens without leaving hex range', () => {
        assert.equal(art._petShade('#808080', 0), '#808080');
        const dark = art._petShade('#808080', -20);
        const light = art._petShade('#808080', 20);
        assert.truthy(/^#[0-9a-f]{6}$/.test(dark) && /^#[0-9a-f]{6}$/.test(light));
        assert.truthy(parseInt(dark.slice(1), 16) < parseInt(light.slice(1), 16));
        assert.equal(art._petShade('#000000', -50), '#000000', 'clamps at black');
        assert.equal(art._petShade('#ffffff', 50), '#ffffff', 'clamps at white');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
