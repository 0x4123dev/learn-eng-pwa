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

    test('every lesson has speaking prompts, model lines, answer frames, vocabulary, and reflection quiz', () => {
        const env = load();
        getIELTS(env).forEach(v => {
            assert.equal(v.speakingPrompts.length, 3, `${v.id} prompts`);
            assert.truthy(v.checkpoints.length >= 3, `${v.id} checkpoints`);
            assert.truthy(v.modelLines.length >= 3, `${v.id} model lines`);
            assert.truthy(v.answerFrames.length >= 4, `${v.id} answer frames`);
            assert.truthy(v.vocabulary.length >= 5, `${v.id} vocabulary`);
            assert.equal(v.quiz.length, 3, `${v.id} quiz`);
        });
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
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
