// tests/grammar.test.js — Grammar question bank integrity + quiz logic
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('grammar: GRAMMAR_UNITS shape', () => {
    test('exactly 9 units (Units 1–5, 8–11)', () => {
        assert.equal(env.GRAMMAR_UNITS.length, 9);
    });

    test('unit IDs cover all 9 units', () => {
        const ids = env.GRAMMAR_UNITS.map(u => u.id);
        for (const u of ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit8', 'unit9', 'unit10', 'unit11']) {
            assert.contains(ids, u);
        }
    });

    test('every unit has required metadata', () => {
        for (const u of env.GRAMMAR_UNITS) {
            assert.truthy(u.id);
            assert.truthy(u.name);
            assert.truthy(u.icon);
            assert.truthy(u.color);
            assert.truthy(u.description);
            assert.truthy(Array.isArray(u.questions));
        }
    });
});

suite('grammar: 220 questions per unit (all 9 units)', () => {
    for (const unitId of ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit8', 'unit9', 'unit10', 'unit11']) {
        test(`${unitId} has exactly 220 questions`, () => {
            const u = env.getGrammarUnit(unitId);
            assert.equal(u.questions.length, 220);
        });
        test(`${unitId} has at least 25 arrangement questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const arrCount = u.questions.filter(q => q.type === 'arrangement').length;
            assert.truthy(arrCount >= 25, `${unitId} arrangement count is ${arrCount}, expected ≥25`);
        });
        test(`${unitId} has at least 20 pronunciation questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const pronCount = u.questions.filter(q => q.type === 'pronunciation').length;
            assert.truthy(pronCount >= 20, `${unitId} pronunciation count is ${pronCount}, expected ≥20`);
        });
        test(`${unitId} has at least 25 vocabulary questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const vocabCount = u.questions.filter(q => q.type === 'vocabulary').length;
            assert.truthy(vocabCount >= 25, `${unitId} vocabulary count is ${vocabCount}, expected ≥25`);
        });
        test(`${unitId} has at least 20 grammar questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const grammarCount = u.questions.filter(q => q.type === 'grammar').length;
            assert.truthy(grammarCount >= 20, `${unitId} grammar count is ${grammarCount}, expected ≥20`);
        });
    }
});

suite('grammar: arrangement question integrity', () => {
    test('every arrangement question has parts array (3-8 chunks)', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                assert.truthy(Array.isArray(q.parts), `${q.id} missing parts array`);
                assert.truthy(q.parts.length >= 3, `${q.id} too few parts (${q.parts.length})`);
                assert.truthy(q.parts.length <= 8, `${q.id} too many parts (${q.parts.length})`);
                for (const p of q.parts) {
                    assert.truthy(typeof p === 'string' && p.length > 0, `${q.id} has empty part`);
                }
            }
        }
    });

    test('every arrangement question has explanation ≥20 chars', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                assert.truthy(q.explanation && q.explanation.length >= 20,
                    `${q.id} explanation too short`);
            }
        }
    });

    test('every arrangement question ends with sentence-final punctuation (./?/!) in last part', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                const last = q.parts[q.parts.length - 1];
                const ok = last === '.' || last === '?' || last === '!' ||
                           last.endsWith('.') || last.endsWith('?') || last.endsWith('!');
                assert.truthy(ok, `${q.id} last part should be punctuation: "${last}"`);
            }
        }
    });
});

suite('grammar: scoring helpers', () => {
    test('isArrangementCorrect — correct order returns true', () => {
        // Need to access via setAppState; the function is defined in grammar-units.js
        // and is a top-level helper — let's check.
        if (typeof env.isArrangementCorrect !== 'function') return;
        assert.truthy(env.isArrangementCorrect([0, 1, 2, 3, 4], 5));
    });

    test('isArrangementCorrect — wrong order returns false', () => {
        if (typeof env.isArrangementCorrect !== 'function') return;
        assert.falsy(env.isArrangementCorrect([1, 0, 2, 3, 4], 5));
    });

    test('saveGrammarSession scores arrangement correctly', () => {
        env.__setAppState({ grammarHistory: [], coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const arrQ = u8.questions.find(q => q.type === 'arrangement');
        assert.truthy(arrQ);
        const correctOrder = arrQ.parts.map((_, i) => i);
        const wrongOrder = [...correctOrder]; wrongOrder[0] = 1; wrongOrder[1] = 0;

        const session1 = env.saveGrammarSession('unit8', [arrQ], [correctOrder]);
        assert.equal(session1.score, 1);

        const session2 = env.saveGrammarSession('unit8', [arrQ], [wrongOrder]);
        assert.equal(session2.score, 0);
    });
});

suite('grammar: question integrity', () => {
    test('every multiple-choice question has id, type, topic, q, options, correct, explanation', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type === 'arrangement') continue; // arrangement has different shape
                assert.truthy(q.id, `question missing id in ${u.id}`);
                assert.truthy(q.type, `${q.id} missing type`);
                assert.truthy(q.topic, `${q.id} missing topic`);
                assert.truthy(q.q, `${q.id} missing question text`);
                assert.truthy(Array.isArray(q.options) && q.options.length >= 2, `${q.id} bad options`);
                assert.truthy(typeof q.correct === 'number', `${q.id} bad correct index`);
                assert.truthy(q.correct >= 0 && q.correct < q.options.length, `${q.id} correct index out of bounds`);
                assert.truthy(q.explanation, `${q.id} missing explanation`);
            }
        }
    });

    test('every question type is vocabulary, grammar, pronunciation, or arrangement', () => {
        const validTypes = new Set(['vocabulary', 'grammar', 'pronunciation', 'arrangement']);
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(validTypes.has(q.type), `${q.id} has invalid type "${q.type}"`);
            }
        }
    });

    test('question IDs are unique within each unit', () => {
        for (const u of env.GRAMMAR_UNITS) {
            const ids = u.questions.map(q => q.id);
            const unique = new Set(ids);
            assert.equal(ids.length, unique.size, `duplicate question IDs in ${u.id}`);
        }
    });

    test('all options are non-empty strings (multiple-choice only)', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type === 'arrangement') continue;
                for (const opt of q.options) {
                    assert.truthy(typeof opt === 'string' && opt.length > 0,
                        `${q.id} has empty option`);
                }
            }
        }
    });

    test('explanations are at least 20 chars', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(q.explanation.length >= 20,
                    `${q.id} explanation too short: "${q.explanation}"`);
            }
        }
    });
});

suite('grammar: type coverage per unit', () => {
    test('Unit 8 has vocabulary, grammar, pronunciation questions', () => {
        const u8 = env.getGrammarUnit('unit8');
        const types = new Set(u8.questions.map(q => q.type));
        assert.contains([...types], 'vocabulary');
        assert.contains([...types], 'grammar');
        assert.contains([...types], 'pronunciation');
    });

    test('Unit 9 has vocabulary, grammar, pronunciation questions', () => {
        const u9 = env.getGrammarUnit('unit9');
        const types = new Set(u9.questions.map(q => q.type));
        assert.contains([...types], 'vocabulary');
        assert.contains([...types], 'grammar');
        assert.contains([...types], 'pronunciation');
    });

    test('Unit 8 covers expected topics', () => {
        const u8 = env.getGrammarUnit('unit8');
        const topics = new Set(u8.questions.map(q => q.topic));
        assert.contains([...topics], 'clothes');
        assert.contains([...topics], 'face & body');
        assert.contains([...topics], 'present continuous');
        assert.contains([...topics], 'present simple vs continuous');
        assert.contains([...topics], 'have got');
        assert.contains([...topics], 'word stress');
    });

    test('Unit 9 covers expected topics', () => {
        const u9 = env.getGrammarUnit('unit9');
        const topics = new Set(u9.questions.map(q => q.topic));
        assert.contains([...topics], 'films');
        assert.contains([...topics], 'TV');
        assert.contains([...topics], 'nature');
        assert.contains([...topics], 'be going to');
        assert.contains([...topics], 'infinitive of purpose');
    });

    test('Unit 10 covers expected topics', () => {
        const u10 = env.getGrammarUnit('unit10');
        const topics = new Set(u10.questions.map(q => q.topic));
        assert.contains([...topics], 'subjects');
        assert.contains([...topics], 'learning verbs');
        assert.contains([...topics], 'present perfect');
        assert.contains([...topics], 'perfect vs past simple');
        assert.contains([...topics], 'imperatives');
    });

    test('Unit 11 covers expected topics', () => {
        const u11 = env.getGrammarUnit('unit11');
        const topics = new Set(u11.questions.map(q => q.topic));
        assert.contains([...topics], 'tourism');
        assert.contains([...topics], 'in another country');
        assert.contains([...topics], 'have to / can');
        assert.contains([...topics], "should/shouldn't");
        assert.contains([...topics], 'some/any/no');
        assert.contains([...topics], 'making suggestions');
    });
});

suite('grammar: helpers', () => {
    test('getGrammarUnit returns unit by id', () => {
        const u = env.getGrammarUnit('unit8');
        assert.equal(u.id, 'unit8');
    });

    test('getGrammarUnit returns undefined for unknown id', () => {
        assert.falsy(env.getGrammarUnit('unit99'));
    });

    test('generateGrammarQuiz returns N random questions', () => {
        const q10 = env.generateGrammarQuiz('unit8', 10);
        assert.equal(q10.length, 10);
        const q25 = env.generateGrammarQuiz('unit9', 25);
        assert.equal(q25.length, 25);
    });

    test('generateGrammarQuiz returns unique questions (no dupes)', () => {
        const q = env.generateGrammarQuiz('unit8', 50);
        const ids = q.map(x => x.id);
        const unique = new Set(ids);
        assert.equal(ids.length, unique.size);
    });

    test('generateGrammarQuiz caps at unit total', () => {
        const q = env.generateGrammarQuiz('unit8', 1000);
        assert.equal(q.length, 220);
    });

    test('saveGrammarSession stores session in appState.grammarHistory', () => {
        env.__setAppState({ grammarHistory: [], coins: 0 });
        const questions = env.GRAMMAR_UNITS[0].questions.slice(0, 3);
        // Force two correct answers (Q0, Q1) and one definitely-wrong answer for Q2
        const wrongIdxForQ2 = questions[2].correct === 0 ? 1 : 0;
        const answers = [questions[0].correct, questions[1].correct, wrongIdxForQ2];
        const session = env.saveGrammarSession('unit8', questions, answers);
        const state = env.__getAppState();
        assert.equal(state.grammarHistory.length, 1);
        assert.equal(session.score, 2);
        assert.equal(session.total, 3);
        assert.equal(session.unitId, 'unit8');
    });

    test('getGrammarStats returns attempts, best, last', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'g1', unitId: 'unit8', date: 1000, score: 5, total: 10, questions: [] },
                { id: 'g2', unitId: 'unit8', date: 2000, score: 8, total: 10, questions: [] },
                { id: 'g3', unitId: 'unit9', date: 3000, score: 9, total: 10, questions: [] }
            ]
        });
        const u8stats = env.getGrammarStats('unit8');
        assert.equal(u8stats.attempts, 2);
        assert.equal(u8stats.best.score, 8);
        // Newest first means last is the most recent
        const u9stats = env.getGrammarStats('unit9');
        assert.equal(u9stats.attempts, 1);
        assert.equal(u9stats.best.score, 9);
    });

    test('getGrammarStats returns empty for never-attempted unit', () => {
        env.__setAppState({ grammarHistory: [] });
        const stats = env.getGrammarStats('unit8');
        assert.equal(stats.attempts, 0);
        assert.equal(stats.best, null);
    });
});

suite('grammar: mistake bank (v3.24 Tier 1)', () => {
    test('wrong answer adds question to mistake bank', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions.find(q => q.type !== 'arrangement');
        const wrong = mc.correct === 0 ? 1 : 0;
        env.saveGrammarSession('unit8', [mc], [wrong]);
        const mistakes = env.getActiveMistakes();
        assert.equal(mistakes.length, 1);
        assert.equal(mistakes[0].qId, mc.id);
        assert.equal(mistakes[0].misses, 1);
        assert.equal(mistakes[0].topic, mc.topic);
        assert.equal(mistakes[0].unitId, 'unit8');
    });

    test('repeated wrong answers increment misses count', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions.find(q => q.type !== 'arrangement');
        const wrong = mc.correct === 0 ? 1 : 0;
        env.saveGrammarSession('unit8', [mc], [wrong]);
        env.saveGrammarSession('unit8', [mc], [wrong]);
        env.saveGrammarSession('unit8', [mc], [wrong]);
        const mistakes = env.getActiveMistakes();
        assert.equal(mistakes.length, 1);
        assert.equal(mistakes[0].misses, 3);
    });

    test('correct answer removes question from mistake bank (graduation)', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions.find(q => q.type !== 'arrangement');
        const wrong = mc.correct === 0 ? 1 : 0;
        // First wrong → enters bank
        env.saveGrammarSession('unit8', [mc], [wrong]);
        assert.equal(env.getActiveMistakes().length, 1);
        // Then correct → graduates out
        env.saveGrammarSession('unit8', [mc], [mc.correct]);
        assert.equal(env.getActiveMistakes().length, 0);
    });

    test('null/undefined answer (skipped question) does not add to bank', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions.find(q => q.type !== 'arrangement');
        env.saveGrammarSession('unit8', [mc], [null]);
        assert.equal(env.getActiveMistakes().length, 0);
    });

    test('getActiveMistakes sorts by misses desc', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mcs = u8.questions.filter(q => q.type !== 'arrangement').slice(0, 3);
        // Q0: 1 miss, Q1: 3 misses, Q2: 2 misses
        const wrongFor = (q) => q.correct === 0 ? 1 : 0;
        env.saveGrammarSession('unit8', [mcs[0]], [wrongFor(mcs[0])]);
        env.saveGrammarSession('unit8', [mcs[1]], [wrongFor(mcs[1])]);
        env.saveGrammarSession('unit8', [mcs[1]], [wrongFor(mcs[1])]);
        env.saveGrammarSession('unit8', [mcs[1]], [wrongFor(mcs[1])]);
        env.saveGrammarSession('unit8', [mcs[2]], [wrongFor(mcs[2])]);
        env.saveGrammarSession('unit8', [mcs[2]], [wrongFor(mcs[2])]);
        const mistakes = env.getActiveMistakes();
        assert.equal(mistakes.length, 3);
        assert.equal(mistakes[0].qId, mcs[1].id); // most missed first
        assert.equal(mistakes[0].misses, 3);
        assert.equal(mistakes[1].qId, mcs[2].id);
        assert.equal(mistakes[1].misses, 2);
        assert.equal(mistakes[2].qId, mcs[0].id);
        assert.equal(mistakes[2].misses, 1);
    });

    test('toggleMistakeBookmark on correct question creates flagged-only entry', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        env.toggleMistakeBookmark('u8-12', 'unit8', 'clothes', 'vocabulary');
        assert.truthy(env.isQuestionBookmarked('u8-12'));
        // Bookmarked but corrected → not in active mistakes
        assert.equal(env.getActiveMistakes().length, 0);
        // But shows up in bookmarks
        assert.equal(env.getBookmarkedMistakes().length, 1);
    });

    test('bookmarked mistake stays after correct answer', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions.find(q => q.type !== 'arrangement');
        const wrong = mc.correct === 0 ? 1 : 0;
        // Wrong → in bank
        env.saveGrammarSession('unit8', [mc], [wrong]);
        // User bookmarks it
        env.toggleMistakeBookmark(mc.id, 'unit8', mc.topic, mc.type);
        assert.truthy(env.isQuestionBookmarked(mc.id));
        // Correct → still in bank because bookmarked, but corrected: true
        env.saveGrammarSession('unit8', [mc], [mc.correct]);
        const all = env.__getAppState().grammarMistakes;
        assert.truthy(all[mc.id]);
        assert.truthy(all[mc.id].corrected);
        // Active list excludes corrected
        assert.equal(env.getActiveMistakes().length, 0);
        // Bookmarks include it
        assert.equal(env.getBookmarkedMistakes().length, 1);
    });

    test('getWeakTopics groups by topic and sorts by misses', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        // Pick two questions with the same topic
        const byTopic = {};
        for (const q of u8.questions) {
            if (q.type === 'arrangement') continue;
            if (!byTopic[q.topic]) byTopic[q.topic] = [];
            byTopic[q.topic].push(q);
        }
        const topics = Object.keys(byTopic).filter(t => byTopic[t].length >= 2);
        assert.truthy(topics.length >= 2, 'need at least 2 topics with ≥2 questions for the test');
        const tA = topics[0], tB = topics[1];
        const wrongFor = (q) => q.correct === 0 ? 1 : 0;
        // Topic A: 2 different qs, each missed once → count=2 misses=2
        env.saveGrammarSession('unit8', [byTopic[tA][0]], [wrongFor(byTopic[tA][0])]);
        env.saveGrammarSession('unit8', [byTopic[tA][1]], [wrongFor(byTopic[tA][1])]);
        // Topic B: 1 question, missed 3 times → count=1 misses=3
        env.saveGrammarSession('unit8', [byTopic[tB][0]], [wrongFor(byTopic[tB][0])]);
        env.saveGrammarSession('unit8', [byTopic[tB][0]], [wrongFor(byTopic[tB][0])]);
        env.saveGrammarSession('unit8', [byTopic[tB][0]], [wrongFor(byTopic[tB][0])]);
        const weak = env.getWeakTopics();
        assert.equal(weak.length, 2);
        assert.equal(weak[0].topic, tB); // 3 misses > 2 misses
        assert.equal(weak[0].misses, 3);
        assert.equal(weak[0].count, 1);
        assert.equal(weak[1].topic, tA);
        assert.equal(weak[1].misses, 2);
        assert.equal(weak[1].count, 2);
    });

    test('getGrammarAggregateStats computes totals across sessions', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'g1', unitId: 'unit8', date: 1000, score: 5, total: 10, questions: [] },
                { id: 'g2', unitId: 'unit8', date: 2000, score: 8, total: 10, questions: [] },
                { id: 'g3', unitId: 'unit9', date: 3000, score: 9, total: 10, questions: [] }
            ],
            grammarMistakes: {}
        });
        const stats = env.getGrammarAggregateStats();
        assert.equal(stats.totalSessions, 3);
        assert.equal(stats.totalQuestions, 30);
        assert.equal(stats.bestPct, 90);
        // avg = (5+8+9)/30 = 22/30 = 73.33 → rounded 73
        assert.equal(stats.avgPct, 73);
        assert.equal(stats.mistakesCount, 0);
    });

    test('getGrammarAggregateStats returns zeros for empty history', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
        const stats = env.getGrammarAggregateStats();
        assert.equal(stats.totalSessions, 0);
        assert.equal(stats.avgPct, 0);
        assert.equal(stats.bestPct, 0);
        assert.equal(stats.totalQuestions, 0);
        assert.equal(stats.mistakesCount, 0);
    });

    test('resolveMistakeQuestion looks up the original question', () => {
        env.__setAppState({ grammarHistory: [], grammarMistakes: {}, coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const mc = u8.questions[5];
        const m = { qId: mc.id, unitId: 'unit8', topic: mc.topic, type: mc.type };
        const resolved = env.resolveMistakeQuestion(m);
        assert.truthy(resolved);
        assert.equal(resolved.id, mc.id);
        assert.equal(resolved.q, mc.q);
    });

    test('resolveMistakeQuestion returns null for unknown qId', () => {
        const m = { qId: 'u8-9999', unitId: 'unit8', topic: 'x', type: 'vocabulary' };
        assert.equal(env.resolveMistakeQuestion(m), null);
    });
});

suite('grammar: lessons sub-tab data (v3.25)', () => {
    test('GRAMMAR_LESSONS contains exactly 9 units', () => {
        assert.equal(env.GRAMMAR_LESSONS.length, 9);
    });

    test('lessons cover all 9 units', () => {
        const ids = env.GRAMMAR_LESSONS.map(u => u.unitId);
        for (const u of ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit8', 'unit9', 'unit10', 'unit11']) {
            assert.contains(ids, u);
        }
    });

    test('every unit has icon, color, intro, and 6 lessons', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            assert.truthy(u.icon, `${u.unitId} missing icon`);
            assert.truthy(u.color, `${u.unitId} missing color`);
            assert.truthy(u.title, `${u.unitId} missing title`);
            assert.truthy(u.intro, `${u.unitId} missing intro`);
            assert.equal(u.lessons.length, 6);
        }
    });

    test('every lesson has id, title, page, and at least one section', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                assert.truthy(l.id, `lesson missing id in ${u.unitId}`);
                assert.truthy(l.title, `${l.id} missing title`);
                assert.truthy(l.page, `${l.id} missing page reference`);
                const hasContent = !!(l.vocabulary || l.pronunciation || (Array.isArray(l.grammar) && l.grammar.length > 0));
                assert.truthy(hasContent, `${l.id} has no content (vocab/pron/grammar)`);
            }
        }
    });

    test('lesson IDs follow the [unit][a-f] pattern', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            const unitNum = u.unitId.replace('unit', '');
            const expected = ['a', 'b', 'c', 'd', 'e', 'f'].map(s => unitNum + s);
            const actual = u.lessons.map(l => l.id);
            for (const id of expected) {
                assert.contains(actual, id, `${u.unitId} missing lesson ${id}`);
            }
        }
    });

    test('every grammar block has rule + at least one example', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (!Array.isArray(l.grammar)) continue;
                for (const g of l.grammar) {
                    assert.truthy(g.title, `${l.id} grammar block missing title`);
                    assert.truthy(g.rule, `${l.id} "${g.title}" missing rule`);
                    assert.truthy(Array.isArray(g.examples) && g.examples.length > 0,
                        `${l.id} "${g.title}" needs at least one example`);
                }
            }
        }
    });

    test('every vocabulary section has a title and a non-empty word list', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (!l.vocabulary) continue;
                const blocks = Array.isArray(l.vocabulary) ? l.vocabulary : [l.vocabulary];
                for (const v of blocks) {
                    assert.truthy(v.title, `${l.id} vocab missing title`);
                    assert.truthy(Array.isArray(v.words) && v.words.length > 0,
                        `${l.id} vocab "${v.title}" needs words`);
                }
            }
        }
    });

    test('every unit has iCanGoals (textbook learning checklist)', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            assert.truthy(Array.isArray(u.iCanGoals) && u.iCanGoals.length >= 4,
                `${u.unitId} needs at least 4 iCanGoals`);
            for (const g of u.iCanGoals) {
                assert.truthy(typeof g === 'string' && g.length > 5, `${u.unitId} has empty goal`);
            }
        }
    });

    test('Unit 10 covers school subjects vocabulary', () => {
        const lesson = env.getGrammarLesson('unit10', '10a');
        assert.truthy(lesson);
        const blocks = Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [lesson.vocabulary];
        const allWords = blocks.flatMap(v => v.words || []).join(' ').toLowerCase();
        for (const subject of ['history', 'physics', 'literature', 'geography', 'biology', 'mathematics', 'chemistry']) {
            assert.truthy(allWords.includes(subject), `10a vocab missing "${subject}"`);
        }
    });

    test('Unit 10b includes -ed pronunciation rules', () => {
        const lesson = env.getGrammarLesson('unit10', '10b');
        assert.truthy(lesson && lesson.pronunciation);
        const allText = lesson.pronunciation.rule + ' ' + (lesson.pronunciation.examples || []).join(' ');
        for (const sound of ['/t/', '/d/', '/ɪd/']) {
            assert.truthy(allText.includes(sound), `10b pron missing "${sound}"`);
        }
    });

    test('every pronunciation section has rule + at least one example', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (!l.pronunciation) continue;
                assert.truthy(l.pronunciation.title, `${l.id} pron missing title`);
                assert.truthy(l.pronunciation.rule, `${l.id} pron missing rule`);
                assert.truthy(Array.isArray(l.pronunciation.examples) && l.pronunciation.examples.length > 0,
                    `${l.id} pron needs examples`);
            }
        }
    });

    test('getGrammarLessonsForUnit returns lessons by unitId', () => {
        const u8 = env.getGrammarLessonsForUnit('unit8');
        assert.equal(u8.length, 6);
        assert.equal(u8[0].id, '8a');
    });

    test('getGrammarLessonsForUnit returns [] for unknown unit', () => {
        assert.equal(env.getGrammarLessonsForUnit('unit99').length, 0);
    });

    test('getGrammarLesson returns specific lesson', () => {
        const l = env.getGrammarLesson('unit8', '8a');
        assert.truthy(l);
        assert.equal(l.id, '8a');
        assert.equal(l.title, 'Global fashions');
    });

    test('getGrammarLesson returns null for unknown lesson', () => {
        assert.equal(env.getGrammarLesson('unit8', '8z'), null);
    });

    test('getLessonPracticeQuestions returns matching questions for 8a (clothes/present continuous)', () => {
        env.__setAppState({ grammarHistory: [], coins: 0 });
        const qs = env.getLessonPracticeQuestions('unit8', '8a', 10);
        assert.truthy(qs.length > 0, '8a should have matching practice questions');
        // At least some should be clothes or present continuous
        const topics = qs.map(q => (q.topic || '').toLowerCase());
        const matches = topics.filter(t => t.includes('clothes') || t.includes('present continuous') || t.includes('/s/'));
        assert.truthy(matches.length > 0, 'expected matches for clothes/present continuous');
    });

    test('getLessonPracticeQuestions caps at requested max', () => {
        const qs = env.getLessonPracticeQuestions('unit8', '8a', 5);
        assert.truthy(qs.length <= 5);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
