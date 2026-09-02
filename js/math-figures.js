// math-figures.js — hình vẽ cho từng khái niệm trong bảng gợi ý (Chương 3, 4).
//
// "Cặp góc nằm trong hai đường thẳng đó và ở hai phía của đường cắt" là một
// câu mà bé phải DỰNG LẠI CÁI HÌNH trong đầu mới hiểu được — mà dựng được
// hình thì bé đã không cần gợi ý. Với hình học, câu chữ đến sau cái hình,
// không phải thay cho nó. Mỗi khái niệm ở đây có một hình, và hình mới là
// phần bé đọc trước.
//
// Hình vẽ bằng SVG dựng sẵn (không ảnh, không font ngoài): nó phóng to theo
// bề rộng máy, đọc được ở mọi theme vì màu lấy từ biến CSS, và nằm gọn trong
// cache offline như mọi file .js khác.
//
// MATH_FIGURES[id] = chuỗi SVG. Mỗi mục từ điển trỏ tới một id qua khoá `f`.

// ---- bút vẽ ------------------------------------------------------------
// Góc đo theo quy ước toán học: 0° sang phải, tăng dần NGƯỢC chiều kim đồng
// hồ trên màn hình (trục y đã lật). Mọi hàm dưới đây dùng chung quy ước đó,
// nên một góc 60° trong code cũng là góc 60° trên hình.
function _mfN(v) { return Math.round(v * 10) / 10; }

function _mfP(cx, cy, r, deg) {
  const t = deg * Math.PI / 180;
  return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
}

function _mfLine(x1, y1, x2, y2, cls) {
  return `<line class="${cls || 'mf-l'}" x1="${_mfN(x1)}" y1="${_mfN(y1)}" x2="${_mfN(x2)}" y2="${_mfN(y2)}"/>`;
}

// Đoạn thẳng vẽ từ tâm theo góc — để mô tả tia bằng đúng số đo góc của nó.
function _mfRay(cx, cy, r, deg, cls) {
  const p = _mfP(cx, cy, r, deg);
  return _mfLine(cx, cy, p[0], p[1], cls);
}

function _mfPoly(pts, cls) {
  return `<polygon class="${cls || 'mf-l'}" points="${pts.map(p => _mfN(p[0]) + ',' + _mfN(p[1])).join(' ')}"/>`;
}

// Quạt góc: phần được tô chính là góc đang nói tới, nên bé nhìn ra ngay
// "góc nào" trước khi đọc chữ.
function _mfWedge(cx, cy, r, a0, a1, k) {
  const p0 = _mfP(cx, cy, r, a0), p1 = _mfP(cx, cy, r, a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `<path class="mf-w mf-${k || 'a'}" d="M${_mfN(cx)} ${_mfN(cy)} L${_mfN(p0[0])} ${_mfN(p0[1])} `
    + `A${r} ${r} 0 ${large} 0 ${_mfN(p1[0])} ${_mfN(p1[1])} Z"/>`;
}

// Vạch nhỏ cắt ngang cung: dấu "hai góc này bằng nhau".
function _mfAtick(cx, cy, r, deg, k) {
  const a = _mfP(cx, cy, r - 4, deg), b = _mfP(cx, cy, r + 4, deg);
  return _mfLine(a[0], a[1], b[0], b[1], 'mf-tick mf-' + (k || 'a'));
}

// Ô vuông góc — dấu 90° mà sách giáo khoa dùng.
function _mfRight(cx, cy, r, a0, k) {
  const p1 = _mfP(cx, cy, r, a0), p3 = _mfP(cx, cy, r, a0 + 90);
  const p2 = [p1[0] + p3[0] - cx, p1[1] + p3[1] - cy];
  return `<polyline class="mf-sq${k ? ' mf-' + k : ''}" points="${_mfN(p1[0])},${_mfN(p1[1])} ${_mfN(p2[0])},${_mfN(p2[1])} ${_mfN(p3[0])},${_mfN(p3[1])}"/>`;
}

// n vạch ngang giữa đoạn thẳng: dấu "các cạnh này bằng nhau".
function _mfTicks(x1, y1, x2, y2, n, k) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  let out = '';
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 5;
    const cx = mx + ux * off, cy = my + uy * off;
    out += _mfLine(cx - px * 5, cy - py * 5, cx + px * 5, cy + py * 5, 'mf-tick mf-' + (k || 'a'));
  }
  return out;
}

// Mũi tên "»" trên đường thẳng: dấu song song.
function _mfPar(x1, y1, x2, y2, at) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const t = (at == null ? 0.5 : at);
  const mx = x1 + dx * t, my = y1 + dy * t;
  const tip = [mx + ux * 4, my + uy * 4];
  return `<polyline class="mf-par" points="${_mfN(mx - ux * 4 + px * 5)},${_mfN(my - uy * 4 + py * 5)} `
    + `${_mfN(tip[0])},${_mfN(tip[1])} ${_mfN(mx - ux * 4 - px * 5)},${_mfN(my - uy * 4 - py * 5)}"/>`;
}

function _mfDot(x, y, label, lx, ly) {
  let s = `<circle class="mf-p" cx="${_mfN(x)}" cy="${_mfN(y)}" r="3"/>`;
  if (label) s += _mfT(x + (lx || 0), y + (ly || 0), label);
  return s;
}

function _mfT(x, y, s, anchor, cls) {
  return `<text class="mf-t${cls ? ' ' + cls : ''}" x="${_mfN(x)}" y="${_mfN(y)}" text-anchor="${anchor || 'middle'}">${s}</text>`;
}

function _mfSvg(body) {
  return `<svg class="math-fig" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;
}

// ---- nền dùng chung: hai đường thẳng và một đường cắt -------------------
// Bảy khái niệm của Chương 3 nói về CÙNG một hình này; vẽ lại y hệt mỗi lần
// để bé nhận ra "vẫn cái hình lúc nãy, chỉ khác cặp góc được tô".
//
//   a cắt tại A(70,35), b cắt tại B(110,90); đường cắt c đi từ trên xuống
//   dưới bên phải, hướng xuống là 306°, hướng lên là 126°.
const _MF_A = [70, 35], _MF_B = [110, 90], _MF_UP = 126, _MF_DOWN = 306;

function _mfCutBase(parallel, names) {
  const n = names || ['a', 'b', 'c'];
  return _mfLine(12, 35, 188, 35)
    + _mfLine(12, 90, 188, 90)
    + _mfLine(55.5, 15, 124.5, 110)
    + (parallel ? _mfPar(12, 35, 188, 35, 0.85) + _mfPar(12, 90, 188, 90, 0.85) : '')
    + _mfT(194, 31, n[0], 'end') + _mfT(194, 86, n[1], 'end') + _mfT(50, 14, n[2], 'end');
}

// ---- Chương 3 ----------------------------------------------------------
const MATH_FIGURES = {

  'goc-bet': _mfSvg(
    _mfWedge(100, 78, 30, 0, 180, 'a')
    + _mfLine(22, 78, 178, 78)
    + _mfDot(100, 78) + _mfT(100, 95, 'O')
    + _mfT(16, 83, 'x', 'end') + _mfT(184, 83, 'y', 'start')
    + _mfT(100, 40, '180°')),

  'tia-phan-giac': _mfSvg(
    // Hai nửa cùng một màu, cùng một dấu: hai màu khác nhau là đang nói hai
    // góc này KHÁC nhau, đúng ngược điều tia phân giác nghĩa là gì.
    _mfWedge(35, 100, 34, 0, 32, 'b') + _mfWedge(35, 100, 34, 32, 64, 'b')
    + _mfRay(35, 100, 120, 0) + _mfRay(35, 100, 100, 64) + _mfRay(35, 100, 110, 32, 'mf-l mf-hi')
    + _mfAtick(35, 100, 34, 16, 'b') + _mfAtick(35, 100, 34, 48, 'b')
    + _mfDot(35, 100) + _mfT(30, 113, 'O', 'end')
    + _mfT(160, 105, 'x', 'start') + _mfT(84, 14, 'y', 'start') + _mfT(134, 38, 'z', 'start')),

  'goc-nhon-vuong-tu': _mfSvg(
    _mfWedge(24, 82, 16, 0, 45, 'a') + _mfRay(24, 82, 44, 0) + _mfRay(24, 82, 44, 45)
    + _mfT(40, 106, '&lt; 90°', 'middle', 'mf-cap')
    + _mfWedge(98, 82, 16, 0, 90, 'b') + _mfRight(98, 82, 11, 0, 'b')
    + _mfRay(98, 82, 36, 0) + _mfRay(98, 82, 40, 90)
    + _mfT(110, 106, '= 90°', 'middle', 'mf-cap')
    + _mfWedge(166, 82, 16, 0, 135, 'c') + _mfRay(166, 82, 28, 0) + _mfRay(166, 82, 40, 135)
    + _mfT(170, 106, '&gt; 90°', 'middle', 'mf-cap')),

  'ke-bu': _mfSvg(
    _mfWedge(100, 88, 30, 0, 60, 'a') + _mfWedge(100, 88, 30, 60, 180, 'b')
    + _mfLine(20, 88, 180, 88) + _mfRay(100, 88, 62, 60)
    + _mfDot(100, 88) + _mfT(100, 103, 'O')
    + _mfT(14, 93, 'x', 'end') + _mfT(186, 93, 'y', 'start') + _mfT(137, 30, 'z', 'start')
    + _mfT(100, 116, 'hai góc kề bù: cộng lại 180°', 'middle', 'mf-cap')),

  'doi-dinh': _mfSvg(
    _mfWedge(100, 56, 22, 25, 145, 'a') + _mfWedge(100, 56, 22, 205, 325, 'a')
    + _mfWedge(100, 56, 22, 145, 205, 'b') + _mfWedge(100, 56, 22, 325, 385, 'b')
    + _mfRay(100, 56, 70, 25) + _mfRay(100, 56, 70, 205)
    + _mfRay(100, 56, 70, 145) + _mfRay(100, 56, 70, 325)
    + _mfDot(100, 56)
    + _mfT(100, 116, 'hai góc đối đỉnh thì bằng nhau', 'middle', 'mf-cap')),

  'cat-nhau': _mfSvg(
    _mfRay(100, 56, 70, 25) + _mfRay(100, 56, 70, 205)
    + _mfRay(100, 56, 70, 145) + _mfRay(100, 56, 70, 325)
    + _mfDot(100, 56) + _mfT(112, 50, 'O', 'start')
    + _mfT(178, 22, 'a', 'start') + _mfT(34, 14, 'b', 'end')
    + _mfT(100, 116, 'đúng một điểm chung', 'middle', 'mf-cap')),

  // Trong (giữa a và b) và ở HAI phía của đường cắt.
  'so-le-trong': _mfSvg(
    _mfWedge(_MF_A[0], _MF_A[1], 20, 180, _MF_DOWN, 'a')
    + _mfWedge(_MF_B[0], _MF_B[1], 20, 0, _MF_UP, 'a')
    + _mfCutBase(false)
    + _mfAtick(_MF_A[0], _MF_A[1], 20, 243, 'a') + _mfAtick(_MF_B[0], _MF_B[1], 20, 63, 'a')
    + _mfT(100, 116, 'trong · hai phía → so le trong', 'middle', 'mf-cap')),

  // Cùng phía của đường cắt, cùng vị trí trên/dưới với mỗi đường thẳng.
  'dong-vi': _mfSvg(
    _mfWedge(_MF_A[0], _MF_A[1], 20, 0, _MF_UP, 'b')
    + _mfWedge(_MF_B[0], _MF_B[1], 20, 0, _MF_UP, 'b')
    + _mfCutBase(false)
    + _mfT(100, 116, 'cùng phía · cùng vị trí → đồng vị', 'middle', 'mf-cap')),

  'trong-cung-phia': _mfSvg(
    _mfWedge(_MF_A[0], _MF_A[1], 20, _MF_DOWN, 360, 'a')
    + _mfWedge(_MF_B[0], _MF_B[1], 20, 0, _MF_UP, 'b')
    + _mfCutBase(true)
    + _mfT(100, 116, 'a ∥ b ⇒ hai góc này bù nhau', 'middle', 'mf-cap')),

  'song-song': _mfSvg(
    _mfLine(16, 42, 184, 42) + _mfLine(16, 82, 184, 82)
    + _mfPar(16, 42, 184, 42, 0.5) + _mfPar(16, 82, 184, 82, 0.5)
    + _mfT(190, 38, 'a', 'end') + _mfT(190, 78, 'b', 'end')
    + _mfT(100, 108, 'kéo dài mãi vẫn không gặp nhau', 'middle', 'mf-cap')),

  'vuong-goc': _mfSvg(
    _mfLine(20, 62, 180, 62) + _mfLine(100, 10, 100, 114)
    + _mfRight(100, 62, 14, 0, 'a') + _mfRight(100, 62, 14, 90, 'a')
    + _mfRight(100, 62, 14, 180, 'a') + _mfRight(100, 62, 14, 270, 'a')
    + _mfDot(100, 62)
    + _mfT(108, 18, 'a', 'start') + _mfT(186, 58, 'b', 'start')
    + _mfT(60, 100, 'bốn góc vuông', 'middle', 'mf-cap')),

  // Đi từ góc SUY RA song song — nên cặp góc bằng nhau vẽ trước, ∥ là kết luận.
  'dau-hieu-song-song': _mfSvg(
    _mfWedge(_MF_A[0], _MF_A[1], 20, 180, _MF_DOWN, 'a')
    + _mfWedge(_MF_B[0], _MF_B[1], 20, 0, _MF_UP, 'a')
    + _mfCutBase(true)
    + _mfAtick(_MF_A[0], _MF_A[1], 20, 243, 'a') + _mfAtick(_MF_B[0], _MF_B[1], 20, 63, 'a')
    + _mfT(100, 116, 'so le trong bằng nhau ⇒ a ∥ b', 'middle', 'mf-cap')),

  // Chiều ngược lại: ∥ là điều đã cho, các góc là điều suy ra.
  'tinh-chat-song-song': _mfSvg(
    _mfWedge(_MF_A[0], _MF_A[1], 20, 180, _MF_DOWN, 'a')
    + _mfWedge(_MF_B[0], _MF_B[1], 20, 0, _MF_UP, 'a')
    + _mfWedge(_MF_A[0], _MF_A[1], 26, _MF_DOWN, 360, 'b')
    + _mfWedge(_MF_B[0], _MF_B[1], 26, _MF_UP, 180, 'b')
    + _mfCutBase(true)
    + _mfT(100, 116, 'a ∥ b ⇒ các cặp góc bằng / bù nhau', 'middle', 'mf-cap')),

  'tien-de-euclid': _mfSvg(
    _mfLine(16, 92, 184, 92)
    + _mfLine(16, 40, 184, 40)
    + _mfPar(16, 92, 184, 92, 0.8) + _mfPar(16, 40, 184, 40, 0.8)
    + _mfLine(73, 10, 163, 110, 'mf-d') + _mfLine(127, 10, 37, 110, 'mf-d')
    + _mfDot(100, 40) + _mfT(92, 32, 'M', 'end')
    + _mfT(190, 88, 'a', 'end') + _mfT(190, 36, 'b', 'end')
    + _mfT(100, 114, 'qua M chỉ có ĐÚNG MỘT đường ∥ a', 'middle', 'mf-cap')),

  'vuong-goc-song-song': _mfSvg(
    _mfLine(60, 8, 60, 112)
    + _mfLine(16, 36, 184, 36) + _mfLine(16, 88, 184, 88)
    + _mfRight(60, 36, 12, 0, 'a') + _mfRight(60, 88, 12, 0, 'a')
    + _mfPar(16, 36, 184, 36, 0.8) + _mfPar(16, 88, 184, 88, 0.8)
    + _mfT(52, 16, 'c', 'end') + _mfT(190, 32, 'a', 'end') + _mfT(190, 84, 'b', 'end')
    + _mfT(110, 112, 'a ⊥ c và b ⊥ c ⇒ a ∥ b', 'middle', 'mf-cap')),

  'dinh-li': _mfSvg(
    `<rect class="mf-box mf-a" x="8" y="34" width="80" height="42" rx="10"/>`
    + `<rect class="mf-box mf-b" x="112" y="34" width="80" height="42" rx="10"/>`
    + _mfLine(90, 55, 108, 55) + _mfPoly([[110, 55], [102, 51], [102, 59]], 'mf-fill')
    + _mfT(48, 52, 'Nếu …') + _mfT(48, 68, 'giả thiết', 'middle', 'mf-cap')
    + _mfT(152, 52, 'thì …') + _mfT(152, 68, 'kết luận', 'middle', 'mf-cap')
    + _mfT(100, 100, 'điều đã cho → điều phải suy ra', 'middle', 'mf-cap')),

  // ---- Chương 4 --------------------------------------------------------
  'tong-ba-goc': _mfSvg(
    _mfWedge(35, 100, 22, 0, 51.3, 'a')
    + _mfWedge(165, 100, 22, 133, 180, 'b')
    + _mfWedge(95, 25, 20, 231.3, 313, 'c')
    + _mfPoly([[35, 100], [165, 100], [95, 25]], 'mf-l mf-tri')
    + _mfT(26, 111, 'A', 'end') + _mfT(174, 111, 'B', 'start') + _mfT(95, 16, 'C')
    + _mfT(100, 118, 'Â + B̂ + Ĉ = 180°', 'middle', 'mf-cap')),

  'goc-ngoai': _mfSvg(
    _mfWedge(150, 96, 24, 0, 133, 'c')
    + _mfWedge(30, 96, 20, 0, 51.8, 'a')
    + _mfWedge(85, 26, 18, 231.8, 312.9, 'b')
    + _mfPoly([[30, 96], [150, 96], [85, 26]], 'mf-l mf-tri')
    + _mfLine(150, 96, 192, 96, 'mf-d')
    + _mfT(22, 107, 'A', 'end') + _mfT(150, 110, 'B') + _mfT(85, 17, 'C')
    + _mfT(100, 118, 'góc ngoài tại B = Â + Ĉ', 'middle', 'mf-cap')),

  'tam-giac-vuong': _mfSvg(
    _mfWedge(150, 98, 24, 148.3, 180, 'b') + _mfWedge(40, 30, 22, 270, 328.3, 'c')
    + _mfPoly([[40, 98], [150, 98], [40, 30]], 'mf-l mf-tri')
    + _mfRight(40, 98, 14, 0, 'a')
    + _mfT(32, 109, 'A', 'end') + _mfT(158, 109, 'B', 'start') + _mfT(36, 22, 'C', 'end')
    + _mfT(104, 118, 'B̂ + Ĉ = 90°', 'middle', 'mf-cap')),

  'canh-huyen': _mfSvg(
    _mfPoly([[45, 96], [155, 96], [45, 30]], 'mf-l mf-tri')
    + _mfRight(45, 96, 14, 0, 'a')
    + _mfLine(104, 65, 124, 46, 'mf-d')
    + _mfT(128, 43, 'cạnh huyền', 'start', 'mf-cap')
    + _mfT(105, 111, 'cạnh góc vuông', 'middle', 'mf-cap')
    + `<text class="mf-t mf-cap" x="30" y="66" text-anchor="middle" transform="rotate(-90 30 66)">cạnh góc vuông</text>`
    + _mfT(44, 110, 'A', 'end') + _mfT(162, 103, 'B', 'start') + _mfT(50, 24, 'C', 'start')),

  'tam-giac-can': _mfSvg(
    _mfWedge(45, 100, 20, 0, 53.7, 'a') + _mfWedge(155, 100, 20, 126.3, 180, 'a')
    + _mfPoly([[100, 25], [45, 100], [155, 100]], 'mf-l mf-tri')
    + _mfTicks(100, 25, 45, 100, 1, 'b') + _mfTicks(100, 25, 155, 100, 1, 'b')
    + _mfAtick(45, 100, 20, 27, 'a') + _mfAtick(155, 100, 20, 153, 'a')
    + _mfT(100, 16, 'A') + _mfT(34, 104, 'B', 'end') + _mfT(166, 104, 'C', 'start')
    + _mfT(100, 118, 'cạnh bên bằng ⇔ góc đáy bằng', 'middle', 'mf-cap')),

  'tam-giac-deu': _mfSvg(
    _mfWedge(45, 102, 18, 0, 58, 'a') + _mfWedge(155, 102, 18, 122, 180, 'a')
    + _mfWedge(100, 14, 16, 238, 302, 'a')
    + _mfPoly([[100, 14], [45, 102], [155, 102]], 'mf-l mf-tri')
    + _mfTicks(100, 14, 45, 102, 1, 'b') + _mfTicks(100, 14, 155, 102, 1, 'b')
    + _mfTicks(45, 102, 155, 102, 1, 'b')
    + _mfT(70, 92, '60°', 'middle', 'mf-cap') + _mfT(130, 92, '60°', 'middle', 'mf-cap')
    + _mfT(100, 46, '60°', 'middle', 'mf-cap')
    + _mfT(100, 118, 'ba cạnh bằng nhau ⇒ ba góc 60°', 'middle', 'mf-cap')),

  'hai-tam-giac-bang-nhau': _mfSvg(
    _mfPoly([[12, 88], [82, 88], [45, 26]], 'mf-l mf-tri')
    + _mfPoly([[118, 88], [188, 88], [151, 26]], 'mf-l mf-tri')
    + _mfTicks(12, 88, 82, 88, 1, 'b') + _mfTicks(118, 88, 188, 88, 1, 'b')
    + _mfTicks(82, 88, 45, 26, 2, 'b') + _mfTicks(188, 88, 151, 26, 2, 'b')
    + _mfTicks(45, 26, 12, 88, 3, 'b') + _mfTicks(151, 26, 118, 88, 3, 'b')
    + _mfWedge(12, 88, 16, 0, 62, 'a') + _mfWedge(118, 88, 16, 0, 62, 'a')
    + _mfT(12, 101, 'A') + _mfT(82, 101, 'B') + _mfT(45, 18, 'C')
    + _mfT(118, 101, 'D') + _mfT(188, 101, 'E') + _mfT(151, 18, 'F')
    + _mfT(100, 62, '=')
    + _mfT(100, 114, '△ABC = △DEF · A↔D, B↔E, C↔F', 'middle', 'mf-cap')),

  'ccc': _mfSvg(
    _mfPoly([[12, 88], [82, 88], [45, 26]], 'mf-l mf-tri')
    + _mfPoly([[118, 88], [188, 88], [151, 26]], 'mf-l mf-tri')
    + _mfTicks(12, 88, 82, 88, 1, 'b') + _mfTicks(118, 88, 188, 88, 1, 'b')
    + _mfTicks(82, 88, 45, 26, 2, 'b') + _mfTicks(188, 88, 151, 26, 2, 'b')
    + _mfTicks(45, 26, 12, 88, 3, 'b') + _mfTicks(151, 26, 118, 88, 3, 'b')
    + _mfT(100, 62, '=')
    + _mfT(100, 114, 'ba cạnh bằng ba cạnh', 'middle', 'mf-cap')),

  'cgc': _mfSvg(
    _mfWedge(12, 88, 18, 0, 62, 'a') + _mfWedge(118, 88, 18, 0, 62, 'a')
    + _mfPoly([[12, 88], [82, 88], [45, 26]], 'mf-l mf-tri')
    + _mfPoly([[118, 88], [188, 88], [151, 26]], 'mf-l mf-tri')
    + _mfTicks(12, 88, 82, 88, 1, 'b') + _mfTicks(118, 88, 188, 88, 1, 'b')
    + _mfTicks(12, 88, 45, 26, 2, 'b') + _mfTicks(118, 88, 151, 26, 2, 'b')
    + _mfT(100, 62, '=')
    + _mfT(100, 114, 'góc phải nằm XEN GIỮA hai cạnh', 'middle', 'mf-cap')),

  'gcg': _mfSvg(
    _mfWedge(12, 88, 18, 0, 62, 'a') + _mfWedge(82, 88, 18, 121, 180, 'c')
    + _mfWedge(118, 88, 18, 0, 62, 'a') + _mfWedge(188, 88, 18, 121, 180, 'c')
    + _mfPoly([[12, 88], [82, 88], [45, 26]], 'mf-l mf-tri')
    + _mfPoly([[118, 88], [188, 88], [151, 26]], 'mf-l mf-tri')
    + _mfTicks(12, 88, 82, 88, 1, 'b') + _mfTicks(118, 88, 188, 88, 1, 'b')
    + _mfT(100, 62, '=')
    + _mfT(100, 114, 'cạnh phải nằm GIỮA hai góc', 'middle', 'mf-cap')),

  'khong-co-ggg': _mfSvg(
    _mfPoly([[14, 76], [64, 76], [38, 32]], 'mf-l mf-tri')
    + _mfPoly([[110, 96], [190, 96], [148, 26]], 'mf-l mf-tri')
    + _mfWedge(14, 76, 12, 0, 61.4, 'a') + _mfWedge(110, 96, 16, 0, 61.5, 'a')
    + _mfWedge(64, 76, 12, 120.6, 180, 'c') + _mfWedge(190, 96, 16, 121, 180, 'c')
    + _mfT(88, 62, '≠', 'middle', 'mf-no')
    + _mfT(100, 114, 'cùng góc, khác kích thước', 'middle', 'mf-cap')),

  'tam-giac-vuong-bang-nhau': _mfSvg(
    _mfPoly([[14, 88], [84, 88], [14, 34]], 'mf-l mf-tri')
    + _mfPoly([[120, 88], [190, 88], [120, 34]], 'mf-l mf-tri')
    + _mfRight(14, 88, 12, 0, 'a') + _mfRight(120, 88, 12, 0, 'a')
    + _mfTicks(84, 88, 14, 34, 1, 'b') + _mfTicks(190, 88, 120, 34, 1, 'b')
    + _mfWedge(84, 88, 18, 142, 180, 'c') + _mfWedge(190, 88, 18, 142, 180, 'c')
    + _mfT(100, 62, '=')
    + _mfT(100, 112, 'đã có 90°, chỉ cần thêm 2 yếu tố', 'middle', 'mf-cap')),

  'trung-diem': _mfSvg(
    _mfLine(30, 58, 170, 58)
    + _mfTicks(30, 58, 100, 58, 1, 'b') + _mfTicks(100, 58, 170, 58, 1, 'b')
    + _mfDot(30, 58) + _mfDot(100, 58) + _mfDot(170, 58)
    + _mfT(30, 82, 'A') + _mfT(100, 82, 'M') + _mfT(170, 82, 'B')
    + _mfT(100, 106, 'M nằm giữa và MA = MB', 'middle', 'mf-cap')),

  'trung-truc': _mfSvg(
    _mfLine(40, 84, 160, 84) + _mfLine(100, 14, 100, 108)
    + _mfLine(100, 30, 40, 84, 'mf-d') + _mfLine(100, 30, 160, 84, 'mf-d')
    + _mfRight(100, 84, 12, 0, 'a')
    + _mfTicks(40, 84, 100, 84, 1, 'b') + _mfTicks(100, 84, 160, 84, 1, 'b')
    + _mfTicks(100, 30, 40, 84, 2, 'c') + _mfTicks(100, 30, 160, 84, 2, 'c')
    + _mfDot(40, 84) + _mfDot(100, 84) + _mfDot(160, 84) + _mfDot(100, 30)
    + _mfT(34, 89, 'A', 'end') + _mfT(93, 99, 'M', 'end') + _mfT(166, 89, 'B', 'start')
    + _mfT(109, 34, 'P', 'start') + _mfT(108, 16, 'd', 'start')
    + _mfT(100, 118, 'P trên d ⇒ PA = PB', 'middle', 'mf-cap')),
};

// ---- hình của ĐỀ BÀI ---------------------------------------------------
// Khác với hình của từ điển (một khái niệm, một hình cố định), hình ở đây vẽ
// đúng bài toán đang hỏi: góc đã cho ghi bằng số thật của nó, góc phải tìm
// ghi dấu "?". Bé nhìn hình là nắm được đề trước khi đọc hết câu chữ — mà
// với hình học thì đó mới là lúc bài toán bắt đầu.
//
// Câu hỏi khai báo hình trong data/math/math-ch*.json:
//     "fig": { "t": "ke-bu", "a": 130, "l": ["130°", "?"] }
// `t` là tên khuôn dưới đây; các khoá còn lại là tham số của khuôn đó.
//
// LUẬT: hình chỉ được vẽ ĐỀ, không bao giờ vẽ ĐÁP ÁN. Ghi sẵn con số phải
// tìm lên hình là biến bài toán thành bài chép. tests/math-figures.test.js
// canh đúng chuyện này.

// Số đã cho vẽ màu xanh, chỗ phải tìm vẽ màu cam — hai vai trò khác nhau
// trong cùng một hình thì không nên cùng một màu.
function _mfIsAsk(txt) { return /\?/.test(String(txt == null ? '' : txt)); }
function _mfK(txt) { return _mfIsAsk(txt) ? 'a' : 'b'; }

// Nhãn đặt trên tia phân giác của chính góc nó đang gọi tên, nên nhãn luôn
// nằm trong lòng góc đó dù góc to hay nhỏ.
function _mfAng(cx, cy, r, a0, a1, txt, rl) {
  if (txt == null || txt === '') return '';
  const k = _mfK(txt);
  const p = _mfP(cx, cy, (rl || r + 13), (a0 + a1) / 2);
  return _mfWedge(cx, cy, r, a0, a1, k)
    + _mfT(p[0], p[1] + 4, txt, 'middle', 'mf-val mf-' + k);
}

// ---- Chương 3: góc và đường thẳng --------------------------------------

// Hai góc kề bù: x—O—y thẳng hàng, tia Oz dựng đúng số đo đã cho.
function _mfqKeBu(f) {
  const a = Math.min(160, Math.max(20, +f.a || 120));
  const l = f.l || ['', ''];
  const n = f.names || ['x', 'y', 'z'];
  const r2 = f.r2;
  return _mfAng(100, 88, 30, 0, a, l[0])
    + _mfAng(100, 88, 30, a, 180, l[1])
    + _mfLine(18, 88, 182, 88) + _mfRay(100, 88, 58, a)
    + (r2 ? _mfRay(100, 88, 58, +r2.deg) : '')
    + _mfDot(100, 88) + _mfT(100, 104, 'O')
    + _mfT(188, 93, n[0], 'end') + _mfT(12, 93, n[1], 'start')
    + _mfT(..._mfP(100, 88, 68, a), n[2], a > 100 ? 'end' : 'start')
    + (r2 ? _mfT(..._mfP(100, 88, 68, +r2.deg), r2.name || 't', +r2.deg > 100 ? 'end' : 'start') : '');
}

// Kề bù CỘNG phân giác: bài "∠xOz và ∠zOy kề bù, Ot là phân giác của ∠xOz".
function _mfqKeBuPhanGiac(f) {
  const a = Math.min(160, Math.max(30, +f.a || 100));
  const l = f.l || ['', ''];
  const pl = _mfP(100, 88, 52, a * 0.25);
  return _mfWedge(100, 88, 34, 0, a, _mfK(l[0]))
    + (l[0] ? _mfT(pl[0], pl[1] + 4, l[0], 'middle', 'mf-val mf-' + _mfK(l[0])) : '')
    + _mfAng(100, 88, 22, a / 2, a, l[1], 32)
    + _mfLine(18, 88, 182, 88) + _mfRay(100, 88, 58, a)
    + _mfRay(100, 88, 52, a / 2, 'mf-l mf-hi')
    + _mfDot(100, 88) + _mfT(100, 104, 'O')
    + _mfT(188, 93, 'x', 'end') + _mfT(12, 93, 'y', 'start')
    + _mfT(..._mfP(100, 88, 68, a), 'z', a > 100 ? 'end' : 'start')
    + _mfT(..._mfP(100, 88, 62, a / 2), 't', 'start');
}

// Hai đường thẳng cắt nhau: góc đã cho, góc hỏi là đối đỉnh hoặc kề bù.
function _mfqDoiDinh(f) {
  const a = Math.min(150, Math.max(25, +f.a || 40));
  const l = f.l || [];
  const w = [[0, a], [a, 180], [180, 180 + a], [180 + a, 360]];
  let out = '';
  w.forEach((g, i) => { out += _mfAng(100, 64, 22, g[0], g[1], l[i], 34); });
  return out + _mfLine(20, 64, 180, 64)
    + _mfRay(100, 64, 54, a) + _mfRay(100, 64, 54, a + 180)
    + _mfDot(100, 64) + _mfT(94, 78, 'O', 'end');
}

// Tia phân giác: góc vẽ đúng số đo, tia phân giác chia đôi thật.
function _mfqPhanGiac(f) {
  const w = Math.min(180, Math.max(30, +f.w || 80));
  const lh = f.lh || ['', ''];
  const nm = f.names || ['x', 'y', 'z', 'O'];
  // Đỉnh góc dịch ngang theo độ mở: một góc 50° vẽ từ giữa khung thì nửa
  // trái bỏ trống, hình dồn hết sang phải và bé phải nheo mắt vào một góc.
  const R = 88;
  const cx = _mfN(100 - (Math.min(0, R * Math.cos(w * Math.PI / 180)) + R) / 2);
  const pw = _mfP(cx, 100, 64, w * 0.62);
  // Không có số nào để ghi thì vẫn phải thấy "hai nửa bằng nhau" — đó là cả
  // nội dung của khái niệm tia phân giác.
  const bare = !lh[0] && !lh[1];
  return (bare ? _mfWedge(cx, 100, 30, 0, w / 2, 'b') + _mfWedge(cx, 100, 30, w / 2, w, 'b')
        + _mfAtick(cx, 100, 30, w / 4, 'b') + _mfAtick(cx, 100, 30, w * 3 / 4, 'b') : '')
    // Nhãn số đặt xa tâm: hai nửa của một góc 50° mà ghi sát đỉnh thì hai con
    // số chồng lên nhau, và bé đọc thành một số thứ ba.
    + _mfAng(cx, 100, 30, 0, w / 2, lh[0], 44)
    + _mfAng(cx, 100, 30, w / 2, w, lh[1], 66)
    + _mfRay(cx, 100, 78, 0) + _mfRay(cx, 100, 78, w)
    + _mfRay(cx, 100, 70, w / 2, 'mf-l mf-hi')
    + _mfDot(cx, 100) + _mfT(cx, 114, nm[3])
    + _mfT(..._mfP(cx, 100, 88, 0), nm[0], 'start')
    + _mfT(..._mfP(cx, 100, 88, w), nm[1], w > 100 ? 'end' : 'start')
    + _mfT(..._mfP(cx, 100, 80, w / 2), nm[2], w > 150 ? 'middle' : 'start')
    + (f.lw ? _mfT(pw[0], pw[1], f.lw, 'middle', 'mf-val mf-' + _mfK(f.lw)) : '');
}

function _mfqCut2(f) {
  const angles = f.angles || {};
  // Nghiêng đường cắt theo số đo đã cho. Một nhãn "63°" không được nằm
  // trong một cung nhìn rõ là góc tù — hình toán phải đúng cả quan hệ lẫn tỉ lệ.
  let a = 126;
  Object.keys(angles).some(p => {
    const m = /([0-9]+(?:[.,][0-9]+)?)°/.exec(String(angles[p]));
    if (!m) return false;
    const shown = +m[1].replace(',', '.');
    a = /[13]$/.test(p) ? shown : 180 - shown;
    return true;
  });
  a = Math.min(150, Math.max(30, a));
  const A = [100, 35];
  const dx = -55 / Math.tan(a * Math.PI / 180);
  const B = [100 + dx, 90];
  const pos = {
    A1: [A[0], A[1], 0, a], A2: [A[0], A[1], a, 180],
    A3: [A[0], A[1], 180, a + 180], A4: [A[0], A[1], a + 180, 360],
    B1: [B[0], B[1], 0, a], B2: [B[0], B[1], a, 180],
    B3: [B[0], B[1], 180, a + 180], B4: [B[0], B[1], a + 180, 360],
  };
  let out = '';
  Object.keys(angles).forEach(p => {
    const g = pos[p];
    if (g) out += _mfAng(g[0], g[1], 20, g[2], g[3], angles[p], 32);
  });
  const n = f.names || ['a', 'b', 'c'];
  const xAt = y => A[0] + (y - A[1]) * dx / 55;
  return out + _mfLine(12, 35, 188, 35) + _mfLine(12, 90, 188, 90)
    + _mfLine(xAt(15), 15, xAt(110), 110)
    + (f.par ? _mfPar(12, 35, 188, 35, 0.85) + _mfPar(12, 90, 188, 90, 0.85) : '')
    + _mfT(194, 31, n[0], 'end') + _mfT(194, 86, n[1], 'end')
    + _mfT(xAt(13) - 3, 13, n[2], 'end');
}

// Quan hệ vuông góc — song song, bốn thế thường gặp.
function _mfqVuongSong(f) {
  const m = f.m || 'perp2';
  const lbl = (x, y, t, an) => _mfT(x, y, t, an || 'end');
  if (m === 'par-perp') {                       // a ∥ b, c ⊥ a ⇒ c với b?
    return _mfLine(16, 36, 184, 36) + _mfLine(16, 88, 184, 88) + _mfLine(64, 8, 64, 112)
      + _mfPar(16, 36, 184, 36, 0.82) + _mfPar(16, 88, 184, 88, 0.82)
      + _mfRight(64, 36, 12, 0, 'b')
      + _mfAng(64, 88, 16, 0, 90, f.ask || '?', 30)
      + lbl(56, 16, 'c') + lbl(190, 32, 'a') + lbl(190, 84, 'b');
  }
  if (m === 'par3') {                            // a ∥ b, b ∥ c
    return _mfLine(16, 26, 184, 26) + _mfLine(16, 62, 184, 62) + _mfLine(16, 98, 184, 98)
      + _mfPar(16, 26, 184, 26, 0.8) + _mfPar(16, 62, 184, 62, 0.8) + _mfPar(16, 98, 184, 98, 0.8)
      + lbl(190, 22, 'a') + lbl(190, 58, 'b') + lbl(190, 94, 'c')
      + _mfT(100, 116, 'a ∥ b và b ∥ c', 'middle', 'mf-cap');
  }
  if (m === 'par3-perp') {                       // a ∥ b ∥ c và d ⊥ a
    return _mfLine(16, 26, 184, 26) + _mfLine(16, 62, 184, 62) + _mfLine(16, 98, 184, 98)
      + _mfLine(62, 10, 62, 114)
      + _mfPar(16, 26, 184, 26, 0.82) + _mfPar(16, 62, 184, 62, 0.82) + _mfPar(16, 98, 184, 98, 0.82)
      + _mfRight(62, 26, 11, 0, 'b')
      + _mfAng(62, 98, 15, 0, 90, f.ask || '?', 28)
      + lbl(54, 18, 'd') + lbl(190, 22, 'a') + lbl(190, 58, 'b') + lbl(190, 94, 'c');
  }
  if (m === 'perp2d') {                          // a ⊥ c, b ⊥ c rồi d ⊥ a
    return _mfLine(50, 8, 50, 112) + _mfLine(140, 8, 140, 112)
      + _mfLine(16, 36, 184, 36) + _mfLine(16, 88, 184, 88)
      + _mfRight(50, 36, 12, 0, 'b') + _mfRight(50, 88, 12, 0, 'b')
      + _mfRight(140, 36, 12, 0, 'b')
      + _mfAng(140, 88, 15, 0, 90, f.ask || '?', 28)
      + lbl(42, 16, 'c') + lbl(132, 16, 'd') + lbl(190, 32, 'a') + lbl(190, 84, 'b');
  }
  if (m === 'two-lines') {                       // hai đường phân biệt, không cắt nhau
    return _mfLine(16, 42, 184, 42) + _mfLine(16, 82, 184, 82)
      + lbl(190, 38, 'a') + lbl(190, 78, 'b');
  }
  if (m === 'kihieu') {                          // ∥ và ⊥ cạnh nhau cho dễ so
    return _mfLine(8, 40, 88, 40) + _mfLine(8, 76, 88, 76)
      + _mfPar(8, 40, 88, 40, 0.5) + _mfPar(8, 76, 88, 76, 0.5)
      + _mfT(48, 108, 'a ∥ b', 'middle', 'mf-cap')
      + _mfLine(112, 58, 192, 58) + _mfLine(152, 18, 152, 98)
      + _mfRight(152, 58, 12, 0, 'b')
      + _mfT(152, 108, 'a ⊥ b', 'middle', 'mf-cap');
  }
  return _mfLine(60, 8, 60, 112)                 // perp2: a ⊥ c và b ⊥ c
    + _mfLine(16, 36, 184, 36) + _mfLine(16, 88, 184, 88)
    + _mfRight(60, 36, 12, 0, 'b') + _mfRight(60, 88, 12, 0, 'b')
    + lbl(52, 16, 'c') + lbl(190, 32, 'a') + lbl(190, 84, 'b');
}

// Tiên đề Euclid: điểm ngoài đường thẳng, hoặc điểm nằm ngay trên nó.
function _mfqEuclid(f) {
  if (f.m === 'point') {                         // mới chỉ có d và M, chưa kẻ gì
    return _mfLine(16, 84, 184, 84)
      + _mfDot(100, 40) + _mfT(100, 30, 'M')
      + _mfT(190, 80, 'd', 'end')
      + _mfT(100, 112, 'M không thuộc d', 'middle', 'mf-cap');
  }
  if (f.m === 'on-line') {
    return _mfLine(16, 70, 184, 70)
      + _mfLine(40, 20, 160, 120, 'mf-d') + _mfLine(160, 20, 40, 120, 'mf-d')
      + _mfDot(100, 70) + _mfT(100, 60, 'A')
      + _mfT(190, 66, 'd', 'end')
      + _mfT(100, 112, 'A nằm TRÊN d', 'middle', 'mf-cap');
  }
  return _mfLine(16, 92, 184, 92) + _mfLine(16, 40, 184, 40)
    + _mfPar(16, 92, 184, 92, 0.8) + _mfPar(16, 40, 184, 40, 0.8)
    + _mfLine(73, 10, 163, 110, 'mf-d') + _mfLine(127, 10, 37, 110, 'mf-d')
    + _mfDot(100, 40) + _mfT(92, 32, 'M', 'end')
    + _mfT(190, 88, 'd', 'end') + _mfT(190, 36, 'a', 'end');
}

// ---- Chương 4: tam giác ------------------------------------------------
// Ba đỉnh cố định trên hình, tên đỉnh do đề đặt: một tam giác vẽ ra thì đỉnh
// nào là A hoàn toàn tuỳ bài, nhưng số đo góc thì không.
const _MF_TRI = {
  P: [[35, 100], [165, 100], [95, 25]],
  ang: [[0, 51.3], [133, 180], [231.3, 313]],   // góc trong tại từng đỉnh
  lbl: [[26, 111, 'end'], [174, 111, 'start'], [95, 16, 'middle']],
};

function _mfqTamGiac(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  let out = '';
  v.forEach((name, i) => {
    const a = _MF_TRI.ang[i], p = _MF_TRI.P[i];
    out += _mfAng(p[0], p[1], i === 2 ? 20 : 22, a[0], a[1], angles[name], i === 2 ? 34 : 36);
  });
  out += _mfPoly(_MF_TRI.P, 'mf-l mf-tri');
  v.forEach((name, i) => {
    const L = _MF_TRI.lbl[i];
    out += _mfT(L[0], L[1], name, L[2]);
  });
  return out;
}

// Tam giác vuông: v = [đỉnh vuông, đỉnh dưới-phải, đỉnh trên].
function _mfqTamGiacVuong(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  return _mfAng(150, 98, 24, 148.3, 180, angles[v[1]], 36)
    + _mfAng(40, 30, 22, 270, 328.3, angles[v[2]], 34)
    + _mfPoly([[40, 98], [150, 98], [40, 30]], 'mf-l mf-tri')
    + (f.eq ? _mfTicks(40, 98, 150, 98, 1, 'c') + _mfTicks(40, 98, 40, 30, 1, 'c') : '')
    + (f.sides && f.sides[0] ? _mfT(95, 112, f.sides[0], 'middle', 'mf-val mf-' + _mfK(f.sides[0])) : '')
    + (f.sides && f.sides[1] ? _mfT(30, 68, f.sides[1], 'end', 'mf-val mf-' + _mfK(f.sides[1])) : '')
    + (f.area ? _mfT(112, 62, f.area, 'middle', 'mf-cap') : '')
    + _mfRight(40, 98, 14, 0, 'b')
    + _mfT(32, 109, v[0], 'end') + _mfT(158, 109, v[1], 'start') + _mfT(36, 22, v[2], 'end');
}

// Góc ngoài: v = [dưới-trái, dưới-phải (nơi có góc ngoài), đỉnh trên].
function _mfqGocNgoai(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  return _mfAng(150, 96, 24, 0, 133, f.ext || '?', 38)
    + _mfAng(150, 96, 15, 133, 180, angles[v[1]], 30)
    + _mfAng(30, 96, 20, 0, 51.8, angles[v[0]], 32)
    + _mfAng(85, 26, 18, 231.8, 312.9, angles[v[2]], 30)
    + _mfPoly([[30, 96], [150, 96], [85, 26]], 'mf-l mf-tri')
    + _mfLine(150, 96, 192, 96, 'mf-d')
    + _mfT(22, 107, v[0], 'end') + _mfT(150, 110, v[1]) + _mfT(85, 17, v[2]);
}

// Hai tam giác: dấu bằng nhau đặt đúng theo trường hợp đang hỏi.
const _MF_T1 = [[12, 88], [82, 88], [45, 26]], _MF_T2 = [[118, 88], [188, 88], [151, 26]];

function _mfqHaiTamGiac(f) {
  const v = f.v || [['A', 'B', 'C'], ['D', 'E', 'F']];
  const m = f.m || 'ccc';
  const T = [_MF_T1, _MF_T2];
  let out = '';
  if (m === 'ggg') {                              // cùng góc, khác kích thước
    out += _mfPoly([[14, 76], [64, 76], [38, 32]], 'mf-l mf-tri')
      + _mfPoly([[110, 96], [190, 96], [148, 26]], 'mf-l mf-tri')
      + _mfWedge(14, 76, 12, 0, 61.4, 'b') + _mfWedge(110, 96, 16, 0, 61.5, 'b')
      + _mfWedge(64, 76, 12, 120.6, 180, 'c') + _mfWedge(190, 96, 16, 121, 180, 'c')
      + _mfT(88, 62, '≠', 'middle', 'mf-no');
    return out;
  }
  T.forEach(P => {
    if (m === 'ccc') {
      out += _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
        + _mfTicks(P[1][0], P[1][1], P[2][0], P[2][1], 2, 'b')
        + _mfTicks(P[2][0], P[2][1], P[0][0], P[0][1], 3, 'b');
    } else if (m === 'cgc') {
      out += _mfWedge(P[0][0], P[0][1], 18, 0, 62, 'c')
        + _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
        + _mfTicks(P[0][0], P[0][1], P[2][0], P[2][1], 2, 'b');
    } else if (m === 'gcg') {
      out += _mfWedge(P[0][0], P[0][1], 18, 0, 62, 'c')
        + _mfWedge(P[1][0], P[1][1], 18, 121, 180, 'c')
        + _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b');
    } else if (m === 'ccg') {                     // hai cạnh + góc KHÔNG xen giữa
      out += _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
        + _mfTicks(P[1][0], P[1][1], P[2][0], P[2][1], 2, 'b')
        + _mfWedge(P[0][0], P[0][1], 18, 0, 62, 'c');
    }
  });
  if (f.l1) out += _mfAng(_MF_T1[0][0], _MF_T1[0][1], 18, 0, 62, f.l1, 30);
  if (f.l2) out += _mfAng(_MF_T2[0][0], _MF_T2[0][1], 18, 0, 62, f.l2, 30);
  T.forEach((P, t) => {
    out = _mfPoly(P, 'mf-l mf-tri') + out;
    out += _mfT(P[0][0], 101, v[t][0]) + _mfT(P[1][0], 101, v[t][1]) + _mfT(P[2][0], 18, v[t][2]);
  });
  return out + _mfT(100, 62, '=');
}

// Hai tam giác vuông: góc vuông vẽ sẵn, chỉ đánh dấu yếu tố đề cho thêm.
const _MF_R1 = [[14, 88], [84, 88], [14, 34]], _MF_R2 = [[120, 88], [190, 88], [120, 34]];

function _mfqHaiTamGiacVuong(f) {
  const v = f.v || [['A', 'B', 'C'], ['D', 'E', 'F']];
  const m = f.m || 'ch-gn';
  let out = '';
  [_MF_R1, _MF_R2].forEach(P => {
    out += _mfPoly(P, 'mf-l mf-tri') + _mfRight(P[0][0], P[0][1], 12, 0, 'a');
    if (m === '2cgv') {
      out += _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
        + _mfTicks(P[0][0], P[0][1], P[2][0], P[2][1], 2, 'b');
    } else if (m === 'ch-gn') {
      out += _mfTicks(P[1][0], P[1][1], P[2][0], P[2][1], 1, 'b')
        + _mfWedge(P[1][0], P[1][1], 18, 142, 180, 'c');
    } else if (m === 'ch-cgv') {
      out += _mfTicks(P[1][0], P[1][1], P[2][0], P[2][1], 1, 'b')
        + _mfTicks(P[0][0], P[0][1], P[2][0], P[2][1], 2, 'b');
    } else if (m === 'cgv-gn') {
      out += _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
        + _mfWedge(P[1][0], P[1][1], 18, 142, 180, 'c');
    } else if (m === 'ch') {
      out += _mfTicks(P[1][0], P[1][1], P[2][0], P[2][1], 1, 'b');
    }
  });
  [_MF_R1, _MF_R2].forEach((P, t) => {
    out += _mfT(P[0][0], 101, v[t][0]) + _mfT(P[1][0], 101, v[t][1]) + _mfT(P[2][0], 26, v[t][2]);
  });
  return out + _mfT(100, 62, '=');
}

// Tam giác cân: v = [đỉnh, đáy trái, đáy phải].
// The shape is DERIVED from the angle the question gives, not fixed. It used
// to be a single hard-coded triangle with a 72.6° apex, so a question stating
// a 36° apex was drawn with that apex as the WIDEST corner — the picture said
// the opposite of the answer. Six of the eight exam items were inverted that
// way. Reading one number off the labels costs nothing and makes the drawing
// agree with the text.
function _mfqTamGiacCan(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  const num = (x) => {
    const m = /(\d+(?:[.,]\d+)?)/.exec(String(x == null ? '' : x));
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  };
  // Either the apex or a base angle pins the whole triangle.
  const apexGiven = num(angles[v[0]]);
  const baseGiven = num(angles[v[1]]) != null ? num(angles[v[1]]) : num(angles[v[2]]);
  let apex = apexGiven != null ? apexGiven
    : (baseGiven != null ? 180 - 2 * baseGiven : 72.6);
  if (!(apex > 10 && apex < 160)) apex = 72.6;      // junk label: keep the old shape
  const beta = (180 - apex) / 2;                    // the two base angles
  const rad = Math.PI / 180;
  // Fit inside the 200x120 canvas: cap the half-base at 58 and the height at 78.
  const t = Math.tan(apex / 2 * rad);
  const w = Math.min(58, 78 * t);
  const h = w / t;
  const ax = 100, ay = 100 - h, lx = 100 - w, rx = 100 + w;
  const r = Math.max(12, Math.min(20, w * 0.36));
  // A sharp apex makes a tall, narrow triangle, and the two base labels — each
  // sitting on its wedge bisector — close in on each other until they overlap.
  // Pull them in far enough to keep a readable gap at the centre.
  const halfGap = Math.cos(beta / 2 * rad);
  const baseLabelR = Math.max(11, Math.min(r + 12, halfGap > 0.05 ? (w - 13) / halfGap : r + 12));
  return _mfAng(lx, 100, r, 0, beta, angles[v[1]], baseLabelR)
    + _mfAng(rx, 100, r, 180 - beta, 180, angles[v[2]], baseLabelR)
    + _mfAng(ax, ay, Math.max(10, r - 2), 180 + beta, 360 - beta, angles[v[0]], r + 14)
    + _mfPoly([[ax, ay], [lx, 100], [rx, 100]], 'mf-l mf-tri')
    + (f.ticks === false ? ''
       : _mfTicks(ax, ay, lx, 100, 1, 'b') + _mfTicks(ax, ay, rx, 100, 1, 'b'))
    + _mfT(ax, ay - 9, v[0]) + _mfT(lx - 11, 104, v[1], 'end') + _mfT(rx + 11, 104, v[2], 'start');
}

function _mfqTamGiacDeu(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  return _mfAng(45, 102, 18, 0, 58, angles[v[1]], 30)
    + _mfAng(155, 102, 18, 122, 180, angles[v[2]], 30)
    + _mfAng(100, 14, 16, 238, 302, angles[v[0]], 30)
    + _mfPoly([[100, 14], [45, 102], [155, 102]], 'mf-l mf-tri')
    + _mfTicks(100, 14, 45, 102, 1, 'b') + _mfTicks(100, 14, 155, 102, 1, 'b')
    + _mfTicks(45, 102, 155, 102, 1, 'b')
    + _mfT(100, 10, v[0]) + _mfT(34, 106, v[1], 'end') + _mfT(166, 106, v[2], 'start');
}

// Đường trung trực: d ⊥ AB tại trung điểm I, kèm điểm M nếu đề nhắc tới.
function _mfqTrungTruc(f) {
  const l = f.l || {};
  const A = [40, 84], B = [160, 84], I = [100, 84];
  let out = _mfLine(A[0], A[1], B[0], B[1]) + _mfLine(100, 14, 100, 110)
    + _mfRight(100, 84, 12, 0, 'b')
    + _mfTicks(A[0], A[1], I[0], I[1], 1, 'b') + _mfTicks(I[0], I[1], B[0], B[1], 1, 'b')
    + _mfDot(A[0], A[1]) + _mfDot(I[0], I[1]) + _mfDot(B[0], B[1])
    + _mfT(34, 89, 'A', 'end') + _mfT(93, 99, 'I', 'end') + _mfT(166, 89, 'B', 'start')
    + _mfT(108, 20, 'd', 'start');
  if (f.point) {
    out += _mfLine(100, 30, A[0], A[1], 'mf-d') + _mfLine(100, 30, B[0], B[1], 'mf-d')
      + _mfDot(100, 30) + _mfT(109, 34, 'M', 'start');
  }
  if (l.AB) out += _mfT(100, 116, l.AB, 'middle', 'mf-val mf-' + _mfK(l.AB));
  if (l.IA) out += _mfT(66, 78, l.IA, 'middle', 'mf-val mf-' + _mfK(l.IA));
  return out;
}

// Tam giác cân + trung tuyến xuống đáy: hình của "AM có tính chất gì?".
function _mfqTrungTuyen(f) {
  const v = f.v || ['A', 'B', 'C'];
  return _mfPoly([[100, 25], [45, 100], [155, 100]], 'mf-l mf-tri')
    + _mfLine(100, 25, 100, 100, 'mf-l mf-hi')
    + _mfTicks(100, 25, 45, 100, 1, 'b') + _mfTicks(100, 25, 155, 100, 1, 'b')
    // The two base ticks say "BD = DC is GIVEN". For a genuine median that is
    // the definition, but both questions using this template ask the child to
    // PROVE the two triangles equal, and each offers a c-c-c distractor whose
    // premise is exactly BD = DC. Drawing it handed the child the wrong answer
    // and contradicted the explanation, which says BD = DC is not a given.
    // midTicks:false leaves the base unmarked; omitting it keeps the median.
    + (f.midTicks === false ? ''
        : _mfTicks(45, 100, 100, 100, 2, 'c') + _mfTicks(100, 100, 155, 100, 2, 'c'))
    + _mfDot(100, 100)
    + _mfT(100, 16, v[0]) + _mfT(34, 104, v[1], 'end') + _mfT(166, 104, v[2], 'start')
    + _mfT(100, 114, f.mid || 'M', 'middle');
}

// Hai đoạn cắt nhau tại trung điểm của mỗi đoạn (bài △OAC = △OBD).
function _mfqHaiDoanCat(f) {
  const v = f.v || ['A', 'B', 'C', 'D'];
  const O = [100, 60];
  const A = _mfP(100, 60, 62, 160), B = _mfP(100, 60, 62, 340);
  const C = _mfP(100, 60, 50, 55), D = _mfP(100, 60, 50, 235);
  return _mfLine(A[0], A[1], B[0], B[1]) + _mfLine(C[0], C[1], D[0], D[1])
    + _mfTicks(A[0], A[1], O[0], O[1], 1, 'b') + _mfTicks(O[0], O[1], B[0], B[1], 1, 'b')
    + _mfTicks(C[0], C[1], O[0], O[1], 2, 'c') + _mfTicks(O[0], O[1], D[0], D[1], 2, 'c')
    + _mfDot(A[0], A[1]) + _mfDot(B[0], B[1]) + _mfDot(C[0], C[1]) + _mfDot(D[0], D[1]) + _mfDot(100, 60)
    + _mfT(A[0] - 8, A[1], v[0], 'end') + _mfT(B[0] + 8, B[1], v[1], 'start')
    + _mfT(C[0] + 4, C[1] - 4, v[2], 'start') + _mfT(D[0] - 4, D[1] + 12, v[3], 'end')
    + _mfT(108, 56, 'O', 'start');
}

// M là trung điểm AB, D nằm trên tia đối của tia MC sao cho MD = MC.
function _mfqDoiTia(f) {
  const v = f.v || ['A', 'B', 'C', 'D', 'M'];
  const A = [30, 30], B = [150, 96], C = [40, 100], M = [90, 63];
  const D = [2 * M[0] - C[0], 2 * M[1] - C[1]];
  return _mfLine(A[0], A[1], B[0], B[1]) + _mfLine(C[0], C[1], D[0], D[1])
    + _mfLine(A[0], A[1], C[0], C[1]) + _mfLine(B[0], B[1], C[0], C[1])
    + _mfLine(A[0], A[1], D[0], D[1], 'mf-d') + _mfLine(B[0], B[1], D[0], D[1], 'mf-d')
    + _mfTicks(A[0], A[1], M[0], M[1], 1, 'b') + _mfTicks(M[0], M[1], B[0], B[1], 1, 'b')
    + _mfTicks(C[0], C[1], M[0], M[1], 2, 'c') + _mfTicks(M[0], M[1], D[0], D[1], 2, 'c')
    + _mfDot(M[0], M[1])
    + _mfT(24, 26, v[0], 'end') + _mfT(158, 101, v[1], 'start')
    + _mfT(34, 111, v[2], 'end') + _mfT(D[0] + 6, D[1] - 4, v[3], 'start')
    + _mfT(88, 55, v[4], 'end');
}

// ---- Chương 5: biểu đồ -------------------------------------------------
// Đề thi nói "biểu đồ" thì phải cho trẻ ĐỌC một biểu đồ thật, không bắt trẻ
// dựng lại nó từ một câu văn dài. Số liệu vẫn được nhắc trong đề để SVG chỉ
// là phần trình bày trực quan, không trở thành nguồn thông tin duy nhất.
function _mfqLineChart(f) {
  const labels = f.labels || [];
  const values = (f.values || []).map(Number);
  if (labels.length < 2 || labels.length !== values.length || values.some(v => !Number.isFinite(v))) return '';
  const left = 30, right = 184, top = 14, bottom = 91;
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const pad = Math.max(5, (max - min) * 0.18);
  const lo = Math.max(0, min - pad), hi = max + pad;
  const xAt = i => left + (right - left) * i / (values.length - 1);
  const yAt = v => bottom - (v - lo) * (bottom - top) / (hi - lo || 1);
  const points = values.map((v, i) => [xAt(i), yAt(v)]);
  let out = _mfLine(left, top, left, bottom) + _mfLine(left, bottom, right, bottom)
    + `<polyline class="mf-chart-line" points="${points.map(p => _mfN(p[0]) + ',' + _mfN(p[1])).join(' ')}"/>`;
  points.forEach((p, i) => {
    out += `<circle class="mf-chart-dot" cx="${_mfN(p[0])}" cy="${_mfN(p[1])}" r="3.5"/>`
      + _mfT(p[0], Math.max(10, p[1] - 7), String(values[i]), 'middle', 'mf-cap mf-chart-value')
      + _mfT(p[0], 108, labels[i], 'middle', 'mf-cap');
  });
  return out;
}

function _mfqPieChart(f) {
  const segments = f.segments || [];
  const total = segments.reduce((s, x) => s + (+x.value || 0), 0);
  if (segments.length < 2 || total <= 0) return '';
  const cx = 57, cy = 59, r = 43;
  let start = 90, out = '';
  segments.forEach((seg, i) => {
    const sweep = (+seg.value || 0) / total * 360;
    const p0 = _mfP(cx, cy, r, start), p1 = _mfP(cx, cy, r, start - sweep);
    const large = sweep > 180 ? 1 : 0;
    const cls = 'mf-chart-' + ((i % 4) + 1);
    out += `<path class="mf-chart-slice ${cls}" d="M ${cx} ${cy} L ${_mfN(p0[0])} ${_mfN(p0[1])} A ${r} ${r} 0 ${large} 1 ${_mfN(p1[0])} ${_mfN(p1[1])} Z"/>`;
    const ly = 22 + i * 24;
    out += `<rect class="mf-chart-key ${cls}" x="108" y="${ly - 8}" width="9" height="9" rx="2"/>`
      + _mfT(122, ly, `${seg.label}: ${seg.text == null ? seg.value + '%' : seg.text}`, 'start', 'mf-cap');
    start -= sweep;
  });
  return out;
}

const MATH_Q_FIGURES = {
  'ke-bu': _mfqKeBu,
  'ke-bu-phan-giac': _mfqKeBuPhanGiac,
  'doi-dinh': _mfqDoiDinh,
  'phan-giac': _mfqPhanGiac,
  'cut2': _mfqCut2,
  'vuong-song': _mfqVuongSong,
  'euclid': _mfqEuclid,
  'tam-giac': _mfqTamGiac,
  'tam-giac-vuong': _mfqTamGiacVuong,
  'goc-ngoai': _mfqGocNgoai,
  'hai-tam-giac': _mfqHaiTamGiac,
  'hai-tam-giac-vuong': _mfqHaiTamGiacVuong,
  'tam-giac-can': _mfqTamGiacCan,
  'tam-giac-deu': _mfqTamGiacDeu,
  'trung-truc': _mfqTrungTruc,
  'trung-tuyen': _mfqTrungTuyen,
  'hai-doan-cat': _mfqHaiDoanCat,
  'doi-tia': _mfqDoiTia,
  'line-chart': _mfqLineChart,
  'pie-chart': _mfqPieChart,
};

// Khuôn lạ thì không vẽ gì — một câu hỏi vẫn làm được khi thiếu hình, nhưng
// không làm được nếu cả màn hình vỡ.
function mathQuestionFigureHTML(fig) {
  if (!fig || !fig.t) return '';
  if (fig.t === 'source-crop') {
    const src = String(fig.src || '');
    const c = Array.isArray(fig.crop) ? fig.crop.map(Number) : [];
    const size = Array.isArray(fig.size) ? fig.size.map(Number) : [];
    if (!/^\/assets\/math-exams\/[a-z0-9-]+\.jpg$/.test(src)
        || c.length !== 4 || size.length !== 2
        || c.concat(size).some(v => !Number.isFinite(v) || v <= 0)) return '';
    const [x, y, w, h] = c, [sw, sh] = size;
    if (x + w > sw || y + h > sh) return '';
    const alt = String(fig.alt || 'Hình vẽ từ đề thi gốc')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="math-q-figwrap math-source-crop" style="--crop-ratio:${w}/${h}">`
      // Do not lazy-load these source pages. Mobile Safari can leave an
      // absolutely positioned image inside an overflow crop unloaded even
      // after its question is visible, producing a large blank white box.
      // Intrinsic dimensions also let WebKit lay the crop out before decode.
      + `<img src="${src}" alt="${alt}" width="${sw}" height="${sh}" loading="eager" decoding="async" `
      + `style="width:${sw / w * 100}%;left:${-x / w * 100}%;top:${-y / h * 100}%">`
      + `</div>`;
  }
  const draw = MATH_Q_FIGURES[fig.t];
  if (!draw) return '';
  let body = '';
  try { body = draw(fig); } catch (e) { return ''; }
  return body ? `<div class="math-q-figwrap">${_mfSvg(body)}</div>` : '';
}

// Trả về '' cho id lạ: một mục từ điển chưa có hình vẫn hiện được định nghĩa
// chứ không làm vỡ cả bảng gợi ý.
function mathFigureHTML(id) {
  if (!id) return '';
  const svg = MATH_FIGURES[id];
  return svg ? `<div class="math-hint-figwrap">${svg}</div>` : '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_FIGURES, mathFigureHTML, MATH_Q_FIGURES, mathQuestionFigureHTML };
}
