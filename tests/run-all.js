// tests/run-all.js — Master runner for all test suites
// Run with: node tests/run-all.js

const path = require('path');
const fs = require('fs');

const harness = require('./harness');

// Load each test file in this same process so all suites are registered
// before runAll() is called.
const TEST_FILES = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.test.js'))
    .sort();

console.log(`\n🧪 Running ${TEST_FILES.length} test files…\n`);

for (const f of TEST_FILES) {
    // Each test file calls suite()/test() which registers globally; just `require` to load them.
    // The `require.main === module` blocks at the bottom of each file won't fire because we require, not run.
    require(path.join(__dirname, f));
}

const exitCode = harness.runAll();
process.exit(exitCode);
