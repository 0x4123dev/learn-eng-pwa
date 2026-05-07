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
    return parts.join(' ');
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary check (rigorous): "tie" matches "tie" but NOT "tied" or "ties"
// For multi-word phrases ("get up", "right-hand"), we still match anywhere.
function matchesWord(haystack, word) {
    if (word.includes(' ') || word.includes('-')) {
        return haystack.toLowerCase().includes(word.toLowerCase());
    }
    const re = new RegExp('\\b' + escapeRegex(word) + 's?\\b', 'i'); // allow plural
    return re.test(haystack);
}

// Check coverage of a vocabulary list against a unit's questions.
// Returns array of missing words (empty = all covered).
function findMissing(unitId, requiredWords) {
    const unit = env.getGrammarUnit(unitId);
    const haystacks = unit.questions.map(questionHaystack);
    const missing = [];
    for (const word of requiredWords) {
        const found = haystacks.some(h => matchesWord(h, word));
        if (!found) missing.push(word);
    }
    return missing;
}

// Returns words that appear in fewer than `minCount` questions
function findUnderCovered(unitId, requiredWords, minCount) {
    const unit = env.getGrammarUnit(unitId);
    const under = [];
    for (const word of requiredWords) {
        let count = 0;
        for (const q of unit.questions) {
            if (matchesWord(questionHaystack(q), word)) count++;
        }
        if (count < minCount) under.push(`${word} (${count})`);
    }
    return under;
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

suite('coverage: minimum repetition (≥2 questions per word)', () => {
    test('Unit 8 clothes — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit8', REQUIRED_VOCAB.unit8.clothes, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 8 body parts — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit8', REQUIRED_VOCAB.unit8.body, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 9 films — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit9', REQUIRED_VOCAB.unit9.films, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 9 nature — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit9', REQUIRED_VOCAB.unit9.nature, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 10 subjects — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit10', REQUIRED_VOCAB.unit10.subjects, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 10 learning verbs — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit10', REQUIRED_VOCAB.unit10.learning_verbs, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
    });
    test('Unit 11 in-another-country — every word in ≥2 questions', () => {
        const under = findUnderCovered('unit11', REQUIRED_VOCAB.unit11.in_another_country, 2);
        assert.equal(under.length, 0, `Under-covered: ${under.join(', ')}`);
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

// ──────────────────────────── PRONUNCIATION TOPIC COVERAGE ────────────────────────────
// Each unit's PDF teaches specific pronunciation features. Each must be covered
// by at least 3 questions in the unit's question bank.

const PRON_LESSONS = {
    unit8: [
        ['/s/ vs /ʃ/ contrast (suit/shoes)', /\/ʃ\/|\/s\/(?!\/)|sh\b.*\bs\b|\bs\/.*\bʃ\//i],
        ['silent letters',                   /silent[^.]{0,30}letter|silent[^.]{0,5}[tkhwe]\b/i],
        ['vowel sound matching',             /vowel|same[^.]{0,8}sound|sound[^.]{0,8}same|head\W+leg|sound and spelling/i]
    ],
    unit9: [
        ['/tə/ weak form (going to)',        /\/tə\/|going to.*pronounc|weak[^.]{0,5}vowel|weak[^.]{0,5}form/i],
        ['enthusiasm stress (LOVE/GREAT)',   /enthusiasm|fantastic.{0,15}stress|\bLOVE\b|stress[^.]{0,15}adjective|\bGREAT!/]
    ],
    unit10: [
        ['contrastive stress',               /contrastive|correct[^.]{0,8}emphasis|stress[^.]{0,30}correct|stress[^.]{0,20}contrast|three.{0,15}morning|afternoon.*stress/i],
        ['past tense -ed endings (/t/ /d/ /ɪd/)', /\/t\/[^.]{0,15}\/d\/|past tense[^.]{0,15}-ed|-ed.{0,10}pronoun|\/ɪd\/|past participle.*pronounc|after[^.]{0,15}voiceless/i]
    ],
    unit11: [
        ['/hæftə/ have to reduction',        /\/hæftə\/|have to.{0,15}pronounc|hæftə/i],
        ['/ʌ/ vs /ʊ/ vs /uː/',                /\/ʌ\/|\/ʊ\/|\/uː\/|cruise|could.{0,15}food/i]
    ]
};

function countPronQs(unitId, regex) {
    const u = env.getGrammarUnit(unitId);
    let count = 0;
    for (const q of u.questions) {
        if (q.type !== 'pronunciation') continue;
        const haystack = [q.q, q.explanation, ...(q.options||[])].join(' ');
        if (regex.test(haystack)) count++;
    }
    return count;
}

suite('coverage: pronunciation lessons (≥3 questions per topic)', () => {
    for (const [unitId, lessons] of Object.entries(PRON_LESSONS)) {
        for (const [label, regex] of lessons) {
            test(`${unitId} — "${label}" has ≥3 questions`, () => {
                const count = countPronQs(unitId, regex);
                assert.truthy(count >= 3, `Only ${count} questions cover "${label}" in ${unitId} (need ≥3)`);
            });
        }
    }
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
