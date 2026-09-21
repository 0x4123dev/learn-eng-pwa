// Renaming the dog from the home hero. The new name replaces the old one
// everywhere appState.petName is read — including the Night Raid battle badge
// that used to say "Dog".
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const home = read('js/home.js');

suite('pet rename: the child can change the dog\'s name from home', () => {
  test('the displayed name carries a ✎ edit button', () => {
    assert.truthy(home.includes('pet-name-edit'));
    assert.truthy(home.includes('startPetRename(event)'));
    assert.truthy(read('css/styles.css').includes('.pet-name-edit'));
  });

  test('renaming reuses the naming form, prefilled and cancellable', () => {
    assert.truthy(home.includes('if (!appState.petName || _petRenaming)'));
    assert.truthy(home.includes('value="${currentName}"'), 'the current name must be prefilled');
    assert.truthy(home.includes('cancelPetRename'), 'the child can back out and keep the old name');
    assert.truthy(home.includes('Đổi tên cún của bạn'));
  });

  test('saving trims, caps at 12 chars, clears the rename state and celebrates', () => {
    const save = home.slice(home.indexOf('function savePetName()'), home.indexOf('function toggleAccessory'));
    assert.truthy(save.includes(".trim().slice(0, 12)"));
    assert.truthy(save.includes('_petRenaming = false'));
    assert.truthy(save.includes('saveUserData(currentUser, appState)'));
    assert.truthy(save.includes('Từ nay cún tên là'));
  });

  test('the name sits right above the five hunger hearts', () => {
    assert.truthy(home.includes('pet-hearts-name'));
    assert.truthy(home.includes('<div class="pet-hearts-name">${safePetName}</div>'));
    assert.truthy(read('css/styles.css').includes('.pet-hearts-name'));
  });

  test('the name flows into every battle surface that shows the pet', () => {
    assert.truthy(read('js/night-raid.js').includes('appState.petName||stage.name'), 'Night Raid badge');
    assert.truthy(read('js/petbattle.js').includes('st.petName'), 'Arena');
    assert.truthy(read('js/petcheer.js').includes('st.petName'), 'cheers');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
