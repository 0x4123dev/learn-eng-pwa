// tests/harness.js — Tiny assertion + test harness with no dependencies.
// Each test file calls `register(name, fn)` and `runAll()` at the end.

const _suites = [];
let _currentSuite = null;
let _passed = 0, _failed = 0, _failures = [];

function suite(name, fn) {
    _currentSuite = { name, tests: [] };
    _suites.push(_currentSuite);
    fn();
    _currentSuite = null;
}

function test(name, fn) {
    if (!_currentSuite) throw new Error('test() must be inside suite()');
    _currentSuite.tests.push({ name, fn });
}

const assert = {
    equal(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}${msg ? ' — ' + msg : ''}`);
        }
    },
    deepEqual(actual, expected, msg) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error(`Expected ${b} but got ${a}${msg ? ' — ' + msg : ''}`);
        }
    },
    truthy(value, msg) {
        if (!value) throw new Error(`Expected truthy but got ${JSON.stringify(value)}${msg ? ' — ' + msg : ''}`);
    },
    falsy(value, msg) {
        if (value) throw new Error(`Expected falsy but got ${JSON.stringify(value)}${msg ? ' — ' + msg : ''}`);
    },
    contains(arr, item, msg) {
        if (!Array.isArray(arr)) throw new Error(`Not an array: ${JSON.stringify(arr)}`);
        if (!arr.includes(item)) throw new Error(`Expected array to contain ${JSON.stringify(item)} but got ${JSON.stringify(arr)}${msg ? ' — ' + msg : ''}`);
    },
    notContains(arr, item, msg) {
        if (Array.isArray(arr) && arr.includes(item)) {
            throw new Error(`Expected array NOT to contain ${JSON.stringify(item)}${msg ? ' — ' + msg : ''}`);
        }
    },
    inRange(actual, min, max, msg) {
        if (actual < min || actual > max) {
            throw new Error(`Expected ${actual} to be in [${min}, ${max}]${msg ? ' — ' + msg : ''}`);
        }
    },
    throws(fn, msg) {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) throw new Error(`Expected fn to throw${msg ? ' — ' + msg : ''}`);
    }
};

// Async tests are AWAITED. They used to be called and dropped: `t.fn()`
// returned a promise, the harness counted a pass, and any assertion inside
// resolved into the void. A whole file of screen tests "passed" for an hour
// while verifying nothing — so if you write `async () => {}` here, it runs.
// No test may hang the suite. `await t.fn()` on a promise that never settles
// stopped run-all.js dead, and scripts/deploy.sh captures the runner in `$(…)`
// — so the operator saw "▸ running the suite…" and nothing else, forever, with
// no way to tell which test was stuck.
const TEST_TIMEOUT_MS = Number(process.env.FLASHLINGO_TEST_TIMEOUT_MS) || 20000;

function withTimeout(promise, label) {
    // A synchronous test never touches the timer at all.
    if (!promise || typeof promise.then !== 'function') return promise;
    let timer = null;
    const bell = new Promise((_, reject) => {
        // Deliberately NOT unref'd: a test whose promise holds nothing open
        // would otherwise let node exit quietly with status 0 — the silent
        // pass this timer exists to prevent. `finally` clears it the moment
        // the test settles, so a green suite is never delayed by it.
        timer = setTimeout(
            () => reject(new Error(`timed out after ${TEST_TIMEOUT_MS} ms — ${label}`)),
            TEST_TIMEOUT_MS);
    });
    return Promise.race([promise, bell]).finally(() => { if (timer) clearTimeout(timer); });
}

async function runAll() {
    const ESC_RED = '\x1b[31m';
    const ESC_GREEN = '\x1b[32m';
    const ESC_YELLOW = '\x1b[33m';
    const ESC_BOLD = '\x1b[1m';
    const ESC_RESET = '\x1b[0m';

    for (const s of _suites) {
        console.log(`\n${ESC_BOLD}━━━ ${s.name} ━━━${ESC_RESET}`);
        for (const t of s.tests) {
            try {
                await withTimeout(t.fn(), `${s.name} › ${t.name}`);
                _passed++;
                console.log(`  ${ESC_GREEN}✓${ESC_RESET} ${t.name}`);
            } catch (e) {
                _failed++;
                _failures.push({ suite: s.name, test: t.name, error: e });
                console.log(`  ${ESC_RED}✗${ESC_RESET} ${t.name}`);
                console.log(`    ${ESC_RED}${e.message}${ESC_RESET}`);
                if (e.stack) {
                    const trimmed = e.stack.split('\n').slice(1, 4).join('\n');
                    console.log(`    ${ESC_YELLOW}${trimmed}${ESC_RESET}`);
                }
            }
        }
    }

    console.log('\n' + '═'.repeat(50));
    if (_failed === 0) {
        console.log(`${ESC_GREEN}${ESC_BOLD}✓ All ${_passed} tests passed${ESC_RESET}`);
    } else {
        console.log(`${ESC_RED}${ESC_BOLD}✗ ${_failed} failed, ${_passed} passed${ESC_RESET}`);
    }
    console.log('═'.repeat(50));

    return _failed === 0 ? 0 : 1;
}

module.exports = { suite, test, assert, runAll };
