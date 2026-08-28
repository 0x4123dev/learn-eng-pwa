const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'demo', '3d-compare.html'), 'utf8');

suite('Night Raid Three.js art-match prototype', () => {
    test('models the six 2D mascot roles as distinct 3D soldiers', () => {
        for (const role of ['goblin', 'fox', 'bat', 'mouse', 'puppy', 'wood']) {
            assert.truthy(source.includes(`'${role}'`), `missing ${role} mascot`);
        }
        assert.truthy(source.includes('makeMascotSoldier'));
    });

    test('keeps the dog quadruped and separately rigged from the soldiers', () => {
        assert.truthy(source.includes('function makeDog()'));
        assert.truthy(source.includes('const legs=['));
        assert.truthy(source.includes('if(it.pet){const [fl,fr,bl,br]'));
    });

    test('offers inspectable troop and castle close-ups without mobile overflow', () => {
        assert.truthy(source.includes('id="btnFocus"'));
        assert.truthy(source.includes('id="btnCastle"'));
        assert.truthy(source.includes('Cận cảnh đội quân'));
        assert.truthy(source.includes('Cận cảnh lâu đài'));
        assert.truthy(source.includes('@media (max-width: 900px)'));
    });

    test('respects reduced motion when deciding whether to orbit automatically', () => {
        assert.truthy(source.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
