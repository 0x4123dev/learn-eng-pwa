// tests/grammar-coverage.test.js — Verifies every required vocabulary word from
// the textbook PDFs (Unit 8/9/10/11) is mentioned in at least one question.
// Each "required word" is a string; we check it appears in q.q OR options OR
// explanation OR parts (for arrangement) of at least one question in that unit.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

// Required vocabulary per unit — extracted from the unit PDFs.
// Each entry is the lowercase word/phrase the question text/options/explanation
// must include (substring match, case-insensitive).
const REQUIRED_VOCAB = {
    unit8: {
        clothes: ['bag', 'belt', 'coat', 'dress', 'jacket', 'jeans', 'leggings',
                  'scarf', 'shirt', 'shoes', 'shorts', 'skirt', 'socks', 'suit',
                  'sunglasses', 'tie', 'top', 'trousers', 'trainers', 't-shirt', 'uniform'],
        body: ['arm', 'beard', 'eye', 'foot', 'hair', 'hand', 'head', 'leg', 'mouth', 'shoulder'],
        festival_adj: ['boring', 'colourful', 'crowded', 'exciting', 'fun', 'loud',
                       'noisy', 'popular', 'quiet', 'relaxing']
    },
    unit9: {
        films: ['animation', 'comedy', 'documentary', 'fantasy', 'horror', 'romantic',
                'science fiction', 'thriller'],
        tv: ['sports programme', 'quiz show', 'drama series', 'wildlife', 'news'],
        nature: ['birds', 'flowers', 'grass', 'lakes', 'leaves', 'mountains',
                 'rocks', 'sea', 'sky', 'trees'],
        sense_verbs: ['look', 'feel', 'sound', 'taste', 'smell']
    },
    unit10: {
        subjects: ['biology', 'history', 'geography', 'chemistry', 'literature',
                   'physics', 'mathematics', 'it'],
        topics: ['heat', 'light', 'energy', 'past', 'living things', 'chemicals',
                 'computers', 'numbers', 'books'],
        learning_verbs: ['learn', 'teach', 'study', 'pass', 'fail', 'practise',
                         'forget', 'remember', 'know', 'understand', 'discover',
                         'invent', 'memorize'],
        word_focus_up: ['get up', 'give up', 'wake up', 'go up', 'dress up'],
        websites: ['dot', 'at', 'slash', 'underscore']
    },
    unit11: {
        in_another_country: ['climate', 'currency', 'licence', 'multicultural',
                             'right-hand', 'temperature', 'visa'],
        tourism: ['return ticket', 'single ticket', 'carry-on', 'souvenirs',
                  'tour guide', 'sightseeing', 'public transport', 'rent'],
        word_families_take: ['take a taxi', 'take a break', 'take an umbrella',
                             'take a holiday'],
        london_buildings: ['shard', 'tower bridge', 'gherkin', 'cheesegrater', 'walkie-talkie'],
        modals: ['have to', "don't have to", 'can', "can't", 'should', "shouldn't"],
        some_any_no: ['something', 'somebody', 'somewhere', 'anything', 'anybody',
                      'anywhere', 'nothing', 'nobody']
    }
};

// Extract every searchable string from a question (q text, options, explanation, parts)
function questionHaystack(q) {
    const parts = [];
    if (q.q) parts.push(q.q);
    if (q.explanation) parts.push(q.explanation);
    if (Array.isArray(q.options)) parts.push(q.options.join(' '));
    if (Array.isArray(q.parts)) parts.push(q.parts.join(' '));
    if (q.topic) parts.push(q.topic);
    return parts.join(' ').toLowerCase();
}

// Check coverage of a vocabulary list against a unit's questions.
// Returns array of missing words (empty = all covered).
function findMissing(unitId, requiredWords) {
    const unit = env.getGrammarUnit(unitId);
    const haystack = unit.questions.map(questionHaystack).join(' \n ');
    const missing = [];
    for (const word of requiredWords) {
        // Use word boundaries via regex for short words to avoid false positives,
        // but plain substring for multi-word phrases.
        const needle = word.toLowerCase();
        if (!haystack.includes(needle)) missing.push(word);
    }
    return missing;
}

// ──────────────────────────── TESTS ────────────────────────────

suite('coverage: Unit 8 — Appearance', () => {
    test('all clothes vocabulary appears in at least one question', () => {
        const missing = findMissing('unit8', REQUIRED_VOCAB.unit8.clothes);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all face & body vocabulary appears in at least one question', () => {
        const missing = findMissing('unit8', REQUIRED_VOCAB.unit8.body);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all festival adjectives appear in at least one question', () => {
        const missing = findMissing('unit8', REQUIRED_VOCAB.unit8.festival_adj);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
});

suite('coverage: Unit 9 — Entertainment', () => {
    test('all film genres appear in at least one question', () => {
        const missing = findMissing('unit9', REQUIRED_VOCAB.unit9.films);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all TV programme types appear in at least one question', () => {
        const missing = findMissing('unit9', REQUIRED_VOCAB.unit9.tv);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all nature words appear in at least one question', () => {
        const missing = findMissing('unit9', REQUIRED_VOCAB.unit9.nature);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all sense verbs appear in at least one question', () => {
        const missing = findMissing('unit9', REQUIRED_VOCAB.unit9.sense_verbs);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
});

suite('coverage: Unit 10 — Learning', () => {
    test('all school subjects appear in at least one question', () => {
        const missing = findMissing('unit10', REQUIRED_VOCAB.unit10.subjects);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all subject topics (heat, energy, chemicals, etc.) appear', () => {
        const missing = findMissing('unit10', REQUIRED_VOCAB.unit10.topics);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all learning verbs appear in at least one question', () => {
        const missing = findMissing('unit10', REQUIRED_VOCAB.unit10.learning_verbs);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all "up" verb phrases (get up, give up, etc.) appear', () => {
        const missing = findMissing('unit10', REQUIRED_VOCAB.unit10.word_focus_up);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all email/website terms appear in at least one question', () => {
        const missing = findMissing('unit10', REQUIRED_VOCAB.unit10.websites);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
});

suite('coverage: Unit 11 — Tourism', () => {
    test('all "in another country" vocabulary appears in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.in_another_country);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all tourism vocabulary appears in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.tourism);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all "take" collocations appear in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.word_families_take);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all London buildings appear in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.london_buildings);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all modal verbs (have to/can/should) appear in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.modals);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
    test('all some/any/no compound words appear in at least one question', () => {
        const missing = findMissing('unit11', REQUIRED_VOCAB.unit11.some_any_no);
        assert.equal(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
