// topic-bonus-lesson.test.js — the hidden gem.
//
// Lesson 40 of Daily Life pays 1000 coins + 1000 growth XP. It is a SECRET:
// nothing in the UI marks it and the card looks like the other 42, so a child
// finds it by working through the topic and getting lucky. An advertised
// jackpot gets farmed and the rest of the topic gets skipped.
//
// It still pays every replay — the child is simply never told that, so there
// is deliberately no "already claimed" flag.
//
// The two things most likely to go wrong here are both silent:
//
//   1. Off by one. Lesson cards are labelled `idx + 1`, so the card reading
//      "Lesson 40" is chunk index 39. Paying out on 40 would reward Lesson 41
//      and nobody would notice for weeks.
//   2. The reward text being overwritten. Both accuracy branches write
//      completeSubtitle, so a reward announced before them is gone a line
//      later and the child sees "2 mistakes this round" instead of the coins.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { loadAppCode } = require('./setup');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const env = loadAppCode();
const { TOPIC_BONUS_LESSON, isBonusTopicLesson, getWordsForTopic, WORDS_PER_LESSON,
        getDogLevel, getPointsForLevel, getTopicById } = env;

const lessonsSrc = read('js/lessons.js');
const topicsSrc = read('js/topics.js');
const stylesSrc = read('css/styles.css');

suite('hidden gem: it is the right lesson', () => {
    test('it is Daily Life, and that topic exists', () => {
        assert.equal(TOPIC_BONUS_LESSON.topicId, 'daily');
        const topic = getTopicById('daily');
        assert.truthy(topic, 'the daily topic must exist');
        assert.equal(topic.name, 'Daily Life');
    });

    test('the card that reads "Lesson 40" is the one that pays', () => {
        // Cards render `Lesson ${idx + 1}`, so Lesson 40 is chunk index 39.
        assert.truthy(/topic-lesson-card-num">Lesson \$\{idx \+ 1\}/.test(topicsSrc),
            'if the card numbering changes, this constant must change with it');
        assert.equal(TOPIC_BONUS_LESSON.chunkIdx, 39);
        assert.truthy(isBonusTopicLesson('daily', 39), 'Lesson 40 must pay');
        assert.falsy(isBonusTopicLesson('daily', 40), 'Lesson 41 must not');
        assert.falsy(isBonusTopicLesson('daily', 38), 'Lesson 39 must not');
    });

    test('Lesson 40 actually exists in Daily Life', () => {
        // A bonus on a lesson past the end of the topic is unreachable.
        const words = getWordsForTopic('daily', null);
        const lessons = Math.ceil(words.length / WORDS_PER_LESSON);
        assert.truthy(lessons >= 40,
            `Daily Life has only ${lessons} lessons (${words.length} words) — Lesson 40 is unreachable`);
        const chunk = words.slice(39 * WORDS_PER_LESSON, 40 * WORDS_PER_LESSON);
        assert.truthy(chunk.length >= 2, 'the lesson must have enough words to play');
    });

    test('no other topic pays, at any lesson', () => {
        for (const t of env.TOPICS) {
            for (const idx of [0, 1, 38, 39, 40, 99]) {
                const expected = (t.id === 'daily' && idx === 39);
                assert.equal(isBonusTopicLesson(t.id, idx), expected,
                    `${t.id} lesson ${idx + 1} paid ${!expected ? 'but should not' : 'nothing but should'}`);
            }
        }
    });

    test('junk topic ids and indexes never pay', () => {
        for (const [t, i] of [[null, 39], [undefined, 39], ['', 39], ['DAILY', 39],
            ['daily', null], ['daily', undefined], ['daily', '39x'], ['daily', NaN]]) {
            assert.falsy(isBonusTopicLesson(t, i), `paid out for ${JSON.stringify([t, i])}`);
        }
        // A numeric string is still the right lesson — chunk indexes arrive
        // from HTML attributes in some paths.
        assert.truthy(isBonusTopicLesson('daily', '39'));
    });
});

suite('hidden gem: what it pays', () => {
    test('1000 coins and 1000 XP', () => {
        assert.equal(TOPIC_BONUS_LESSON.coins, 1000);
        assert.equal(TOPIC_BONUS_LESSON.xp, 1000);
    });

    test('one run is a real jump, and the cap is still a long grind', () => {
        // Guards against the reward silently becoming meaningless (a curve
        // change) or trivialising the game (a zero-effort level 200).
        const lvl = (xp) => getDogLevel(xp);
        assert.truthy(lvl(TOPIC_BONUS_LESSON.xp) >= 10,
            `one run only reaches level ${lvl(TOPIC_BONUS_LESSON.xp)} — not worth grinding`);
        assert.truthy(lvl(TOPIC_BONUS_LESSON.xp) < 40,
            `one run reaches level ${lvl(TOPIC_BONUS_LESSON.xp)} — too much for a single lesson`);
        const runsToCap = Math.ceil(getPointsForLevel(200) / TOPIC_BONUS_LESSON.xp);
        assert.truthy(runsToCap >= 50,
            `level 200 is only ${runsToCap} runs away — the cap should stay a real goal`);
    });

    test('it pays EVERY time — no claimed-once flag anywhere', () => {
        // The whole point. A guard here would quietly turn the grind off.
        const block = lessonsSrc.slice(lessonsSrc.indexOf('── The hidden gem ──'),
            lessonsSrc.indexOf('saveUserData(currentUser, appState);',
                lessonsSrc.indexOf('── The hidden gem ──')));
        assert.falsy(/bonusClaimed|alreadyClaimed|hasClaimed|claimedBonus/.test(lessonsSrc),
            'a claimed flag would make the treasure lesson a one-off');
        assert.falsy(/alreadyCompleted/.test(block),
            'the payout must not depend on whether the lesson was done before');
    });
});

suite('hidden gem: the payout is wired correctly', () => {
    test('coins and XP both go up, and the level is recomputed', () => {
        const from = lessonsSrc.indexOf('── The hidden gem ──');
        const block = lessonsSrc.slice(from, lessonsSrc.indexOf('// Pet hooks', from));
        assert.truthy(/appState\.coins = \(appState\.coins \|\| 0\) \+ _bonus\.coins/.test(block));
        assert.truthy(/appState\.dogGrowthXP = \(appState\.dogGrowthXP \|\| 0\) \+ _bonus\.xp/.test(block));
        assert.truthy(/appState\.dogLevel = getDogLevel\(appState\.dogGrowthXP\)/.test(block),
            'XP without recomputing the level leaves the dog stuck at its old level');
    });

    test('it is saved before the screen is drawn', () => {
        // A child who closes the app the instant the card appears must keep it.
        const award = lessonsSrc.indexOf('appState.coins = (appState.coins || 0) + _bonus.coins');
        const save = lessonsSrc.indexOf('saveUserData(currentUser, appState);', award);
        const draw = lessonsSrc.indexOf("getElementById('lessonComplete').classList.add('active')", award);
        assert.truthy(award > 0 && save > award && draw > save,
            'the award must be persisted before the completion screen appears');
    });

    test('the reward text is written AFTER the accuracy subtitle', () => {
        // Both accuracy branches assign completeSubtitle. Announcing the
        // reward first means it is overwritten one line later.
        const branch = lessonsSrc.indexOf("'Topic lesson complete! 🎉'");
        const reward = lessonsSrc.indexOf('if (_bonus) _showTopicBonusReward');
        assert.truthy(branch > 0 && reward > branch,
            'the reward would be overwritten by the accuracy subtitle');
    });

    test('only topic lessons can trigger it', () => {
        assert.truthy(/lessonState\.isTopicLesson\s*\n?\s*&& isBonusTopicLesson/.test(lessonsSrc),
            'a numbered lesson 40 must not pay the topic bonus');
    });

    test('it degrades safely if topics.js has not loaded', () => {
        assert.truthy(/typeof isBonusTopicLesson === 'function'/.test(lessonsSrc),
            'a missing helper must skip the bonus, not throw mid-completion');
    });
});

suite('hidden gem: nothing gives it away', () => {
    test('the lesson card carries no bonus marker at all', () => {
        // The card for Lesson 40 must be byte-identical in shape to every
        // other card. Any chip, class or conditional here is a tell.
        assert.falsy(/topic-lesson-bonus-chip/.test(topicsSrc), 'a bonus chip would advertise the gem');
        assert.falsy(/bonusChip/.test(topicsSrc), 'no bonus branch may exist in the card template');
        assert.falsy(/topic-lesson-bonus-chip|bonusPulse/.test(stylesSrc),
            'the highlight styling must be gone, not merely unused');
    });

    test('the card renderer never even asks whether a lesson is the gem', () => {
        // A call to isBonusTopicLesson inside the card render is the shape a
        // future "just a little hint" regression would take.
        const cardFn = topicsSrc.slice(topicsSrc.indexOf('const dueChip = lessonDue > 0'),
            topicsSrc.indexOf('// Progress summary'));
        assert.falsy(/isBonusTopicLesson/.test(cardFn),
            'the lesson card must not know which lesson is the gem');
    });

    test('no other screen leaks it either', () => {
        // Only two files may mention the rule: the one that defines it and the
        // one that pays it out.
        const fs2 = require('fs');
        const leaked = fs2.readdirSync(path.join(ROOT, 'js'))
            .filter(f => f.endsWith('.js') && !['topics.js', 'lessons.js'].includes(f))
            .filter(f => /TOPIC_BONUS_LESSON|isBonusTopicLesson/.test(read('js/' + f)));
        assert.equal(leaked.length, 0, `the gem is referenced in ${leaked.join(', ')}`);
        assert.falsy(/TOPIC_BONUS_LESSON|isBonusTopicLesson|hidden gem/i.test(read('index.html')),
            'index.html must not mention it');
    });
});

suite('hidden gem: finding it is the whole reward', () => {
    test('the payout moment names the coins, the XP and any level gained', () => {
        const fn = lessonsSrc.slice(lessonsSrc.indexOf('function _showTopicBonusReward'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(body.includes('bonus.coins') && body.includes('bonus.xp'));
        assert.truthy(/HIDDEN GEM/i.test(body), 'the child should know they found something rare');
        assert.truthy(body.includes('level ${after}'), 'a level gain is the payoff');
        assert.truthy(body.includes('showLevelUpCelebration'), 'and it should get the full celebration');
        assert.truthy(/setTimeout\(/.test(body),
            'the celebration owns the screen — it must not race the completion card');
    });

    test('it does not tell the child to farm the lesson', () => {
        // Telling them it repeats undoes the hiding: they grind one lesson and
        // skip the other 42.
        const fn = lessonsSrc.slice(lessonsSrc.indexOf('function _showTopicBonusReward'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.falsy(/every single time|replay it any time|pays every/i.test(body),
            'the reward text must not advertise that it repeats');
    });

    test('the celebration is only claimed when the dog really grew', () => {
        const fn = lessonsSrc.slice(lessonsSrc.indexOf('function _showTopicBonusReward'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(/const grew = after > \(levelBefore \|\| 1\)/.test(body));
        assert.truthy(/if \(grew && typeof showLevelUpCelebration/.test(body),
            'celebrating a level-up that did not happen teaches a child the message is noise');
    });

    test('it still pays on every replay, even though nobody is told', () => {
        assert.falsy(/bonusClaimed|alreadyClaimed|hasClaimed|claimedBonus/.test(lessonsSrc),
            'hiding the gem must not have quietly turned it into a one-off');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
