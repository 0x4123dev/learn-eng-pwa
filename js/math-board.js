// js/math-board.js — Bảng nháp: a finger-drawn scratch sheet over the Math quiz.
//
// Layer 1 (this half of the file) is pure state — no DOM — so the synchronous
// test harness can require() it. Layer 2 (painter + overlay, later tasks) only
// runs in the browser and is guarded by `typeof document`.
//
// A stroke is {points: [{x, y}, …]} in WORLD coordinates: x in CSS px of the
// sheet, y unbounded downward (scrolling never moves the points, only the
// viewport).

const MATH_BOARD_MAX = 3;          // bảng 1/2/3 — enough for one solution
const MATH_BOARD_MIN_DIST = 2;     // CSS px between recorded points
const MATH_BOARD_INK = '#1e293b';
const MATH_BOARD_INK_WIDTH = 3;

function mathBoardBegin(b, x, y) {
    const stroke = { points: [{ x, y }] };
    b.strokes.push(stroke);
    return stroke;
}

// Append a point unless it is within MIN_DIST of the previous one — finger
// tremor produces clouds of sub-pixel samples that make ink look furry.
function mathBoardExtend(stroke, x, y) {
    const last = stroke.points[stroke.points.length - 1];
    const dx = x - last.x, dy = y - last.y;
    if (dx * dx + dy * dy < MATH_BOARD_MIN_DIST * MATH_BOARD_MIN_DIST) return false;
    stroke.points.push({ x, y });
    return true;
}

function mathBoardUndo(b) { return b.strokes.pop() || null; }
function mathBoardClear(b) { b.strokes.length = 0; }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MATH_BOARD_MAX, MATH_BOARD_MIN_DIST, MATH_BOARD_INK, MATH_BOARD_INK_WIDTH,
        mathBoardBegin, mathBoardExtend, mathBoardUndo, mathBoardClear,
    };
}
