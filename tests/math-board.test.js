// tests/math-board.test.js — bảng nháp: pure state first, painter contracts later.
// The harness is synchronous; every test here is a plain sync function.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const board = require(path.join(root, 'js', 'math-board.js'));

suite('math board: strokes', () => {
    test('a stroke begins with its first point and grows point by point', () => {
        const b = { strokes: [], scrollY: 0 };
        const s = board.mathBoardBegin(b, 10, 20);
        assert.equal(b.strokes.length, 1);
        assert.deepEqual(s.points, [{ x: 10, y: 20 }]);
        assert.equal(board.mathBoardExtend(s, 14, 24), true);
        assert.deepEqual(s.points[1], { x: 14, y: 24 });
    });

    test('jitter closer than 2px is filtered out, so ink stays smooth', () => {
        const b = { strokes: [], scrollY: 0 };
        const s = board.mathBoardBegin(b, 10, 10);
        assert.equal(board.mathBoardExtend(s, 11, 10), false, '1px is a tremor, not a move');
        assert.equal(s.points.length, 1);
        assert.equal(board.mathBoardExtend(s, 13, 10), true, '3px is a real move');
    });

    test('undo removes exactly the last stroke; clear empties the board', () => {
        const b = { strokes: [], scrollY: 0 };
        board.mathBoardBegin(b, 1, 1);
        const s2 = board.mathBoardBegin(b, 2, 2);
        assert.equal(board.mathBoardUndo(b), s2);
        assert.equal(b.strokes.length, 1);
        board.mathBoardClear(b);
        assert.equal(b.strokes.length, 0);
        assert.equal(board.mathBoardUndo(b), null, 'undo on empty board is a no-op');
    });
});
