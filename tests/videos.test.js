// tests/videos.test.js — Video tab and IELTS Speaking curriculum tests
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function load(appState) {
    const env = loadAppCode({ includeHome: false, includeVideos: true });
    env.__setCurrentUser('VideoTester');
    env.__setAppState(appState || { points: 0 });
    return env;
}

function getIELTS(env) {
    return env.VIDEO_LIBRARY.filter(v => v.category === 'ielts-speaking');
}

suite('videos: IELTS Speaking curriculum', () => {
    test('adds exactly 50 IELTS Speaking lessons', () => {
        const env = load();
        assert.equal(getIELTS(env).length, 50);
    });

    test('lesson IDs and lesson numbers are unique and sequential', () => {
        const env = load();
        const lessons = getIELTS(env);
        const ids = new Set(lessons.map(v => v.id));
        assert.equal(ids.size, 50);
        lessons.forEach((v, idx) => {
            assert.equal(v.lessonNo, idx + 1);
            assert.equal(v.id, `ielts-speaking-${String(idx + 1).padStart(2, '0')}`);
        });
    });

    test('difficulty path moves from Part 1 to Part 2 to Part 3 to full tests', () => {
        const env = load();
        const lessons = getIELTS(env);
        assert.truthy(lessons.slice(0, 15).every(v => v.level === 'beginner' && v.speakingPart === 'Part 1'));
        assert.truthy(lessons.slice(15, 35).every(v => ['elementary', 'intermediate'].includes(v.level) && v.speakingPart.includes('Part 2')));
        assert.truthy(lessons.slice(35, 45).every(v => v.level === 'upper' && v.speakingPart === 'Part 3'));
        assert.truthy(lessons.slice(45, 50).every(v => v.level === 'advanced' && v.speakingPart === 'Full Test'));
    });

    test('every lesson has speaking prompts, model lines, answer frames, vocabulary, timers, and fallback quiz data', () => {
        const env = load();
        getIELTS(env).forEach(v => {
            assert.equal(v.speakingPrompts.length, 3, `${v.id} prompts`);
            assert.truthy(v.checkpoints.length >= 3, `${v.id} checkpoints`);
            assert.truthy(v.modelLines.length >= 3, `${v.id} model lines`);
            assert.truthy(v.answerFrames.length >= 4, `${v.id} answer frames`);
            assert.truthy(v.vocabulary.length >= 5, `${v.id} vocabulary`);
            assert.truthy(v.timerConfig && typeof v.timerConfig.speak === 'number', `${v.id} timer`);
            assert.equal(v.quiz.length, 3, `${v.id} quiz`);
        });
    });

    test('uses handcrafted model content for all 50 IELTS Speaking lessons', () => {
        const env = load();
        const lessons = getIELTS(env);
        assert.equal(Object.keys(env.IELTS_SPEAKING_LESSON_CONTENT).length, 50);
        lessons.forEach(v => {
            const content = env.IELTS_SPEAKING_LESSON_CONTENT[v.lessonNo];
            assert.truthy(content, `${v.id} lesson content`);
            assert.deepEqual(v.modelLines, content.modelLines, `${v.id} model lines`);
            assert.deepEqual(v.answerFrames, content.frames, `${v.id} frames`);
        });
        assert.truthy(lessons[0].modelLines[0].includes('My name is'));
        assert.truthy(lessons[49].modelLines[0].includes('mock test'));
    });

    test('speaking timers progress from short Part 1 answers to full tests', () => {
        const env = load();
        assert.deepEqual(env.getIELTSSpeakingTimerConfig(1), { prep: 0, speak: 20, label: 'Part 1 answer' });
        assert.deepEqual(env.getIELTSSpeakingTimerConfig(16), { prep: 60, speak: 120, label: 'Part 2 long turn' });
        assert.deepEqual(env.getIELTSSpeakingTimerConfig(36), { prep: 10, speak: 45, label: 'Part 3 opinion' });
        assert.deepEqual(env.getIELTSSpeakingTimerConfig(46), { prep: 60, speak: 300, label: 'Full test round' });
        assert.equal(env.formatSpeakingTimer(125), '2:05');
    });

    test('IELTS filters map lessons by exam part', () => {
        const env = load();
        assert.deepEqual(Object.keys(env.IELTS_PART_FILTERS), ['all', 'part1', 'part2', 'part3', 'mock', 'weak']);
        env.videoState.selectedCourse = 'ielts';
        env.videoState.selectedIELTSPart = 'part2';
        const part2Lessons = env.getFilteredVideos();
        assert.equal(part2Lessons.length, 20);
        assert.truthy(part2Lessons.every(v => env.getIELTSPartKey(v) === 'part2'));
    });

    test('only curated matched lessons get a YouTube embed', () => {
        const env = load();
        const lessons = getIELTS(env);
        const withVideo = lessons.filter(v => v.youtubeId);
        const practiceOnly = lessons.filter(v => !v.youtubeId);

        assert.truthy(withVideo.length > 0);
        assert.truthy(practiceOnly.length > 0);

        withVideo.forEach(v => {
            assert.truthy(v.sourceUrl.includes(v.youtubeId), `${v.id} sourceUrl`);
            assert.equal(env.getVideoEmbedId(v), v.youtubeId);
        });
        practiceOnly.forEach(v => {
            assert.equal(v.duration, 'Practice', `${v.id} duration`);
            assert.equal(v.sourceUrl, '', `${v.id} sourceUrl`);
            assert.equal(env.getVideoEmbedId(v), null);
            assert.truthy(v.searchUrl.includes('youtube.com/results'), `${v.id} searchUrl`);
        });
    });

    test('verified lesson source map references real source keys', () => {
        const env = load();
        Object.entries(env.IELTS_SPEAKING_VERIFIED_SOURCE_BY_LESSON).forEach(([lessonNo, sourceKey]) => {
            const n = Number(lessonNo);
            assert.truthy(n >= 1 && n <= 50, `lesson ${lessonNo}`);
            assert.truthy(env.IELTS_SPEAKING_VIDEO_SOURCES[sourceKey], `missing source ${sourceKey}`);
        });
    });

    test('lesson 2 has a verified Work or Study video source', () => {
        const env = load();
        const lesson = env.VIDEO_LIBRARY.find(v => v.id === 'ielts-speaking-02');
        assert.equal(lesson.youtubeId, 'Y3X8pnD6sVk');
        assert.equal(env.getVideoEmbedId(lesson), 'Y3X8pnD6sVk');
        assert.truthy(lesson.sourceUrl.includes('Y3X8pnD6sVk'));
    });

    test('every beginner Part 1 lesson has a direct playable video source', () => {
        const env = load();
        for (let lessonNo = 1; lessonNo <= 15; lessonNo++) {
            const lesson = env.VIDEO_LIBRARY.find(v => v.id === `ielts-speaking-${String(lessonNo).padStart(2, '0')}`);
            assert.truthy(env.IELTS_SPEAKING_VERIFIED_SOURCE_BY_LESSON[lessonNo], `lesson ${lessonNo} source map`);
            assert.truthy(lesson.youtubeId, `lesson ${lessonNo} youtubeId`);
            assert.equal(env.getVideoEmbedId(lesson), lesson.youtubeId, `lesson ${lessonNo} embed`);
        }
    });

    test('does not include known unavailable YouTube video IDs', () => {
        const env = load();
        const directIds = env.VIDEO_LIBRARY.map(v => env.getVideoEmbedId(v)).filter(Boolean);
        assert.notContains(directIds, 'OS9ac9i55NE');
    });
});

suite('videos: stats helpers', () => {
    test('normalizeVideoStats fills missing fields', () => {
        const env = load();
        const stats = env.normalizeVideoStats({ stars: null });
        assert.truthy(Array.isArray(stats.watched));
        assert.truthy(typeof stats.stars === 'object');
        assert.truthy(Array.isArray(stats.wordsLearned));
        assert.truthy(typeof stats.speakingRatings === 'object');
        assert.equal(stats.totalQuizzes, 0);
    });

    test('getVideoProgressId uses lesson id, not shared YouTube id', () => {
        const env = load();
        const lessons = getIELTS(env);
        const lesson = lessons.find(v => v.youtubeId);
        assert.equal(env.getVideoProgressId(lesson), lesson.id);
        assert.equal(env.getVideoEmbedId(lesson), lesson.youtubeId);
    });

    test('IELTS Speaking stats track completed lessons, recordings, ratings, average, streak, and weak lessons', () => {
        const env = load({
            points: 0,
            videoStats: {
                watched: ['ielts-speaking-01'],
                stars: {},
                wordsLearned: [],
                totalQuizzes: 0,
                speakingRatings: {
                    'ielts-speaking-01': {
                        criteria: { fluency: 3, vocabulary: 3, grammar: 3, pronunciation: 3 },
                        bestOverall: 3,
                        completedAt: 100,
                        recordingMade: true
                    },
                    'ielts-speaking-02': {
                        criteria: { fluency: 2, vocabulary: 2, grammar: 2, pronunciation: 2 },
                        bestOverall: 2,
                        completedAt: 200,
                        recordingMade: false
                    },
                    'ielts-speaking-05': {
                        criteria: { fluency: 5, vocabulary: 5, grammar: 5, pronunciation: 5 },
                        bestOverall: 5,
                        recordingMade: true
                    }
                }
            }
        });
        const stats = env.getIELTSSpeakingProgressStats(env.getVideoStats());
        assert.equal(stats.completed, 2);
        assert.equal(stats.recordings, 2);
        assert.equal(stats.ratings, 3);
        assert.inRange(stats.averageRating, 3.33, 3.34);
        assert.equal(stats.streak, 2);
        assert.deepEqual(stats.weakLessonIds, ['ielts-speaking-02', 'ielts-speaking-01']);

        env.videoState.selectedCourse = 'ielts';
        env.videoState.selectedIELTSPart = 'weak';
        assert.deepEqual(env.getFilteredVideos().map(v => v.id), ['ielts-speaking-02', 'ielts-speaking-01']);
    });

    test('IELTS self-rating saves the best score and completes practice without quiz stars', () => {
        const env = load({ points: 0, videoStats: envlessVideoStats() });
        const lesson = getIELTS(env)[0];
        env.videoState.currentVideo = lesson;
        env.videoState.recordingMade = true;

        env.IELTS_SPEAKING_CRITERIA.forEach(c => env.rateSpeakingCriterion(c.id, c.id === 'pronunciation' ? 5 : 4));
        env.completeSpeakingPractice();

        let appState = env.__getAppState();
        let rating = appState.videoStats.speakingRatings[lesson.id];
        assert.equal(rating.bestOverall, 4.25);
        assert.equal(rating.recordingMade, true);
        assert.contains(appState.videoStats.watched, lesson.id);
        assert.equal(appState.videoStats.stars[lesson.id], undefined);
        assert.equal(appState.points, 13);

        env.IELTS_SPEAKING_CRITERIA.forEach(c => env.rateSpeakingCriterion(c.id, 2));
        env.completeSpeakingPractice();

        appState = env.__getAppState();
        rating = appState.videoStats.speakingRatings[lesson.id];
        assert.equal(rating.attemptOverall, 2);
        assert.equal(rating.bestOverall, 4.25);
        assert.equal(appState.points, 13);
    });
});

function envlessVideoStats() {
    return {
        watched: [],
        stars: {},
        wordsLearned: [],
        totalQuizzes: 0,
        speakingRatings: {}
    };
}

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
