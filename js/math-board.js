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

// One session of scratch paper per quiz. Lives in memory only — the spec says
// boards die with the session, so nothing here ever touches localStorage.
let _mathBoardSession = null;

function mathBoardSession() {
    if (!_mathBoardSession) {
        _mathBoardSession = { boards: [{ strokes: [], scrollY: 0 }], active: 0, open: false };
    }
    return _mathBoardSession;
}

function mathBoardReset() { _mathBoardSession = null; }
function mathBoardActive() { const s = mathBoardSession(); return s.boards[s.active]; }

function mathBoardAdd() {
    const s = mathBoardSession();
    if (s.boards.length >= MATH_BOARD_MAX) return -1;
    s.boards.push({ strokes: [], scrollY: 0 });
    s.active = s.boards.length - 1;
    return s.active;
}

function mathBoardSwitch(i) {
    const s = mathBoardSession();
    if (i >= 0 && i < s.boards.length) s.active = i;
    return s.active;
}

// Actions returned to the painter, and what each obliges it to do:
//   'ink-start' / 'ink'  draw the fresh tail of g.stroke
//   'pan-start'          FULL repaint — the half-drawn stroke was just deleted
//   'pan'                full repaint — b.scrollY moved
//   'ink-end' / 'pan-end'  full repaint at final quality; the gesture is over
//   'none'               nothing changed on screen; do not repaint
//
// ── Gesture machine ──────────────────────────────────────────────────────
// One finger is a pen; a second finger means "I wanted to scroll" — the stroke
// that first finger started is removed, and the whole gesture stays a pan until
// every finger lifts. That single rule is what makes writing feel safe: a
// scroll can never leave a stray ink mark behind.
//
// Each pointer's last y is remembered so a pan continues from where the finger
// already was. Anchoring on the newly-arrived second finger instead would make
// the sheet jump the moment the student rests a thumb down.
function mathBoardGesture() {
    return { down: {}, count: 0, mode: 'idle', // idle | ink | pan
        stroke: null, lead: null, panY: 0 };
}

function mathBoardPointerDown(g, b, id, x, y) {
    const key = String(id);
    if (g.down[key]) return 'none';
    g.down[key] = { y: y };
    g.count++;
    if (g.mode === 'idle') {
        g.mode = 'ink';
        g.lead = key;
        g.stroke = mathBoardBegin(b, x, y + b.scrollY);
        return 'ink-start';
    }
    if (g.mode === 'ink') {
        b.strokes.pop();
        g.stroke = null;
        g.mode = 'pan';        // lead stays the first finger — it is the anchor
        g.panY = b.scrollY;    // unclamped accumulator — see mathBoardPointerMove
        return 'pan-start';
    }
    return 'none';             // a third finger during a pan changes nothing
}

function mathBoardPointerMove(g, b, id, x, y) {
    const key = String(id);
    const p = g.down[key];
    if (!p) return 'none';
    const prevY = p.y;
    p.y = y;
    if (g.mode === 'ink' && key === g.lead && g.stroke) {
        return mathBoardExtend(g.stroke, x, y + b.scrollY) ? 'ink' : 'none';
    }
    if (g.mode === 'pan' && key === g.lead) {
        g.panY -= (y - prevY);              // the finger's true travel, unclamped
        b.scrollY = Math.max(0, g.panY);    // clamp only what we show, or overscroll
        return 'pan';                       // at the top would steal the way back
    }
    return 'none';
}

function mathBoardPointerUp(g, b, id) {
    const key = String(id);
    if (!g.down[key]) return 'none';
    delete g.down[key];
    g.count--;
    const wasLead = key === g.lead;
    if (g.mode === 'ink' && wasLead) {
        g.stroke = null;
        g.mode = 'idle';
        g.lead = null;
        return 'ink-end';
    }
    if (g.mode === 'pan') {
        if (g.count === 0) { g.mode = 'idle'; g.lead = null; return 'pan-end'; }
        // The steering finger left but others remain: hand the pan to a
        // survivor, which carries its own last y, so the sheet does not jump.
        if (wasLead) g.lead = Object.keys(g.down)[0];
        return 'none';
    }
    if (g.count === 0) { g.mode = 'idle'; g.lead = null; }
    return 'none';
}

// A cancelled pointer (incoming call, notification shade) must end the gesture
// exactly like a lift — anything else wedges the board in ink mode forever.
function mathBoardPointerCancel(g, b, id) { return mathBoardPointerUp(g, b, id); }

// The board array is shared with the toolbar (undo / xoá / switch board). Any
// of those can pull the in-progress stroke out from under a finger that is
// still down, so they must abort the gesture instead of leaving g.stroke
// pointing at a detached object that silently swallows ink.
function mathBoardAbort(g) { g.mode = 'idle'; g.stroke = null; g.lead = null; g.down = {}; g.count = 0; }

// ── Painter ──────────────────────────────────────────────────────────────
// The canvas is only ever viewport-sized; scrolling changes which slice of
// the world we draw, never the canvas. That is what makes the sheet endless
// without ever meeting iOS's canvas-size ceiling.

function mathBoardVisibleStrokes(strokes, scrollY, viewH) {
    const top = scrollY, bottom = scrollY + viewH;
    return strokes.filter(s => {
        let min = Infinity, max = -Infinity;
        for (const p of s.points) { if (p.y < min) min = p.y; if (p.y > max) max = p.y; }
        return max >= top && min <= bottom;
    });
}

// Midpoint-quadratic smoothing: each recorded point becomes the control point
// of a curve between neighbouring midpoints — cheap, stable, and it reads as
// ink instead of connect-the-dots.
function mathBoardDrawStroke(ctx, pts, scrollY) {
    if (!pts.length) return;
    ctx.strokeStyle = MATH_BOARD_INK;
    ctx.fillStyle = MATH_BOARD_INK;
    ctx.lineWidth = MATH_BOARD_INK_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {              // a tap is a dot, not nothing
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y - scrollY, MATH_BOARD_INK_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y - scrollY);
    for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y - scrollY, mx, my - scrollY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y - scrollY);
    ctx.stroke();
}

function mathBoardRedraw(ctx, b, viewW, viewH) {
    ctx.clearRect(0, 0, viewW, viewH);
    for (const s of mathBoardVisibleStrokes(b.strokes, b.scrollY, viewH)) {
        mathBoardDrawStroke(ctx, s.points, b.scrollY);
    }
}

// Size the backing store to devicePixelRatio so 3px ink is 3 crisp pixels,
// not a blurry smear on retina.
function mathBoardSizeCanvas(canvas, viewW, viewH, dpr) {
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MATH_BOARD_MAX, MATH_BOARD_MIN_DIST, MATH_BOARD_INK, MATH_BOARD_INK_WIDTH,
        mathBoardBegin, mathBoardExtend, mathBoardUndo, mathBoardClear,
        mathBoardSession, mathBoardReset, mathBoardActive, mathBoardAdd, mathBoardSwitch,
        mathBoardGesture, mathBoardPointerDown, mathBoardPointerMove, mathBoardPointerUp, mathBoardPointerCancel,
        mathBoardAbort,
        mathBoardVisibleStrokes, mathBoardDrawStroke, mathBoardRedraw, mathBoardSizeCanvas,
    };
}
