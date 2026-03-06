// music.js - Shared Web Audio API music engine for rhythm games

const MusicEngine = (function() {
    let _audioCtx = null;
    let _beatTimer = null;
    let _beatRunning = false;
    let _nextBeatTime = 0;
    let _currentBeat = 0;
    let _bpm = 80;
    let _pattern = [];
    let _onVisualTick = null;

    function getContext() {
        if (!_audioCtx) {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (_audioCtx.state === 'suspended') {
            _audioCtx.resume();
        }
        return _audioCtx;
    }

    function suspend() {
        if (_audioCtx && _audioCtx.state === 'running') {
            _audioCtx.suspend();
        }
    }

    // --- Drum Primitives ---

    function playKick(ctx, time) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
    }

    function playHihat(ctx, time) {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < 64; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, time);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(time);
        source.stop(time + 0.06);
    }

    function playSnare(ctx, time) {
        // Sine component
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, time);
        oscGain.gain.setValueAtTime(0.3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.1);

        // Noise component
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < 256; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, time);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(time);
        noise.stop(time + 0.1);
    }

    // --- Beat Scheduler (drift-free using AudioContext clock) ---

    function startBeat(bpm, pattern, onVisualTick) {
        const ctx = getContext();
        _bpm = bpm;
        _pattern = pattern;
        _onVisualTick = onVisualTick;
        _currentBeat = 0;
        _nextBeatTime = ctx.currentTime + 0.05;
        _beatRunning = true;
        _scheduleBeat();
    }

    function _scheduleBeat() {
        if (!_beatRunning || !_audioCtx) return;
        const ctx = _audioCtx;
        const secondsPerBeat = 60.0 / _bpm;

        while (_nextBeatTime < ctx.currentTime + 0.2) {
            const beatIdx = _currentBeat % _pattern.length;
            const sound = _pattern[beatIdx];

            if (sound === 'kick') playKick(ctx, _nextBeatTime);
            else if (sound === 'hihat') playHihat(ctx, _nextBeatTime);
            else if (sound === 'snare') playSnare(ctx, _nextBeatTime);

            // Schedule visual tick callback on the main thread
            const tickTime = (_nextBeatTime - ctx.currentTime) * 1000;
            if (_onVisualTick) {
                const idx = beatIdx;
                setTimeout(() => { if (_beatRunning && _onVisualTick) _onVisualTick(idx); }, Math.max(0, tickTime));
            }

            _nextBeatTime += secondsPerBeat;
            _currentBeat++;
        }

        _beatTimer = setTimeout(_scheduleBeat, 100);
    }

    function stopBeat() {
        _beatRunning = false;
        if (_beatTimer) {
            clearTimeout(_beatTimer);
            _beatTimer = null;
        }
    }

    function setBpm(bpm) {
        _bpm = bpm;
    }

    // --- Note & Feedback Sounds ---

    function playNote(ctx, freq, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    }

    function playSuccess(ctx) {
        playNote(ctx, 523, 0.08); // C5
        setTimeout(() => playNote(ctx, 659, 0.08), 80); // E5
    }

    function playFail(ctx) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, ctx.currentTime);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(330, ctx.currentTime); // E4
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.4, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc1.connect(g1);
        g1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.1);

        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(262, ctx.currentTime); // C4
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.4, ctx.currentTime);
            g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc2.connect(g2);
            g2.connect(ctx.destination);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.1);
        }, 100);
    }

    function playCountIn(ctx, beats, bpm, onBeat) {
        const interval = 60000 / bpm;
        let i = 0;
        function tick() {
            if (i >= beats) return;
            playKick(ctx, ctx.currentTime);
            if (onBeat) onBeat(i);
            i++;
            if (i < beats) setTimeout(tick, interval);
        }
        tick();
    }

    // --- IPA Syllable Counter ---

    function countSyllables(ipaString) {
        if (!ipaString) return 1;
        // Strip delimiters
        let cleaned = ipaString.replace(/[\/\[\]ˈˌ]/g, '');
        // Match vowel clusters (IPA vowels)
        const vowelPattern = /[aeiouæɑɒʌəɜɪʊɛɔ]+/gi;
        const matches = cleaned.match(vowelPattern);
        return matches ? Math.max(1, matches.length) : 1;
    }

    function countSyllablesFallback(englishWord) {
        if (!englishWord) return 1;
        const matches = englishWord.toLowerCase().match(/[aeiouy]+/gi);
        let count = matches ? matches.length : 1;
        // Adjust for silent 'e' at end
        if (englishWord.toLowerCase().endsWith('e') && count > 1) count--;
        return Math.max(1, count);
    }

    function getSyllableCount(word) {
        if (word.ipa) return countSyllables(word.ipa);
        return countSyllablesFallback(word.en);
    }

    return {
        getContext,
        suspend,
        playKick,
        playHihat,
        playSnare,
        startBeat,
        stopBeat,
        setBpm,
        playNote,
        playSuccess,
        playFail,
        playCountIn,
        countSyllables,
        countSyllablesFallback,
        getSyllableCount
    };
})();
