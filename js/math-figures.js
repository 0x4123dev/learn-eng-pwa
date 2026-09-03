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

// Build the triangle from the three angles the question states, so the corner
// labelled 97° is actually drawn obtuse. _MF_TRI stays as the fallback for
// questions that give no numbers. v[0] is the bottom-left corner, v[1] the
// bottom-right, v[2] the apex — the caller orders them, this only sizes them.
function _mfTriFromAngles(A, B) {
  const rad = Math.PI / 180, C = 180 - A - B;
  // Side AB along the x-axis; C's position follows from the two base angles.
  // Law of sines with AB = 1: the apex sits at distance sin(B)/sin(C) from A.
  const d = Math.sin(B * rad) / Math.sin(C * rad);
  const raw = [[0, 0], [1, 0], [d * Math.cos(A * rad), -d * Math.sin(A * rad)]];
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const k = Math.min(132 / w, 76 / h);
  const ox = 100 - (Math.min(...xs) + w / 2) * k, oy = 100 - (Math.max(...ys)) * k;
  return raw.map(p => [ox + p[0] * k, oy + p[1] * k]);
}

function _mfqTamGiac(f) {
  const v = f.v || ['A', 'B', 'C'];
  const angles = f.angles || {};
  const num = (x) => {
    const m = /(\d+(?:[.,]\d+)?)/.exec(String(x == null ? '' : x));
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  };
  let vals = v.map(name => num(angles[name]));
  const gap = vals.findIndex(x => x === null);
  if (gap >= 0 && vals.filter(x => x !== null).length === 2) {
    vals[gap] = 180 - vals.filter(x => x !== null).reduce((a, b) => a + b, 0);
  }
  const usable = vals.every(x => x !== null && x > 8 && x < 164)
    && Math.abs(vals[0] + vals[1] + vals[2] - 180) < 0.5;

  const P = usable ? _mfTriFromAngles(vals[0], vals[1]) : _MF_TRI.P;
  // Interior wedge at each corner, measured from that corner toward the other two.
  const dirTo = (i, j) => {
    const a = Math.atan2(-(P[j][1] - P[i][1]), P[j][0] - P[i][0]) * 180 / Math.PI;
    return (a + 360) % 360;
  };
  const span = (i, j, k) => {
    let a0 = dirTo(i, j), a1 = dirTo(i, k);
    if (((a1 - a0) % 360 + 360) % 360 > 180) { const t = a0; a0 = a1; a1 = t; }
    return [a0, a0 + (((a1 - a0) % 360 + 360) % 360)];
  };
  let out = '';
  v.forEach((name, i) => {
    const [j, k] = [[1, 2], [2, 0], [0, 1]][i];
    const arc = usable ? span(i, j, k) : _MF_TRI.ang[i];
    let r = i === 2 ? 20 : 22;
    let labelR = r + 14;
    if (usable) {
      // A short side puts two corner labels within reach of each other. Keep
      // both the arc and its label inside a fraction of the nearest side so a
      // flat or small triangle never stacks two numbers in the same place.
      const near = Math.min(Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]),
                            Math.hypot(P[k][0] - P[i][0], P[k][1] - P[i][1]));
      r = Math.max(10, Math.min(r, near * 0.26));
      labelR = Math.max(13, Math.min(r + 14, near * 0.38));
    }
    out += _mfAng(P[i][0], P[i][1], r, arc[0], arc[1], angles[name], labelR);
  });
  out += _mfPoly(P, 'mf-l mf-tri');
  v.forEach((name, i) => {
    if (usable) {
      // Push the vertex letter outward, away from the triangle's centre.
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      const dx = P[i][0] - cx, dy = P[i][1] - cy, m = Math.hypot(dx, dy) || 1;
      const anchor = dx < -6 ? 'end' : (dx > 6 ? 'start' : 'middle');
      out += _mfT(P[i][0] + dx / m * 13, P[i][1] + dy / m * 13 + (dy > 0 ? 8 : 0), name, anchor);
    } else {
      const L = _MF_TRI.lbl[i];
      out += _mfT(L[0], L[1], name, L[2]);
    }
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
  // Tên hai trục. Không có nó thì "5, 7, 9, 11" chỉ là bốn con số: bé không
  // biết đó là phút hay là số bạn, mà cả bài toán nằm ở chỗ phân biệt hai
  // thứ đó. Đề nào đã nói rõ trong câu chữ thì bỏ trống cũng được.
  if (f.truc) {
    if (f.truc[0]) out += _mfT(100, 118, String(f.truc[0]), 'middle', 'mf-cap');
    if (f.truc[1]) out += _mfT(6, 8, String(f.truc[1]), 'start', 'mf-cap');
  }
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

// ---- bút vẽ thêm cho Chương IX và Chương X -----------------------------

// Ô vuông góc vẽ theo HAI hướng cho trước thay vì theo trục màn hình. Trong
// một hình khối, góc vuông của mặt đáy đã bị chiếu xiên đi rồi; dấu vuông
// cũng phải xiên theo đúng hai cạnh nó đang nói tới, nếu không thì nó đang
// nói về một góc khác với góc thật.
function _mfCorner(v, p1, p2, r) {
  const u = (p) => {
    const dx = p[0] - v[0], dy = p[1] - v[1], L = Math.hypot(dx, dy) || 1;
    return [dx / L * r, dy / L * r];
  };
  const a = u(p1), b = u(p2);
  return `<polyline class="mf-sq" points="${_mfN(v[0] + a[0])},${_mfN(v[1] + a[1])} `
    + `${_mfN(v[0] + a[0] + b[0])},${_mfN(v[1] + a[1] + b[1])} `
    + `${_mfN(v[0] + b[0])},${_mfN(v[1] + b[1])}"/>`;
}

// Góc của tia từ `from` tới `to`, theo đúng quy ước của file (0° sang phải,
// tăng ngược chiều kim đồng hồ trên màn hình).
function _mfDir(from, to) {
  return (Math.atan2(-(to[1] - from[1]), to[0] - from[0]) * 180 / Math.PI + 360) % 360;
}

// Cắt / đệm một danh sách tên đỉnh về đúng n ô, để tên nào cũng ở đúng ô của
// nó dù đề viết thiếu.
function _mfNames(a, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(a[i] == null ? '' : String(a[i]));
  return out;
}

// Khoảng cách từ một điểm tới ĐOẠN thẳng AB — dùng để tìm chỗ đặt chữ sao cho
// không đè lên nét vẽ nào.
function _mfSegD(x, y, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.min(1, Math.max(0, ((x - A[0]) * dx + (y - A[1]) * dy) / L2)) : 0;
  return Math.hypot(x - (A[0] + dx * t), y - (A[1] + dy * t));
}

// ---- Chương IX: đường xiên và các đường đồng quy ------------------------

// §32 — đường vuông góc và đường xiên kẻ từ một điểm đến một đường thẳng.
// Cả bốn phương án của loại câu này chỉ là hai chữ cái ("AH", "AB", "AC"…),
// nên KHÔNG có hình thì câu hỏi không còn nội dung nào để trả lời. Hình dựng
// từ đúng danh sách chân điểm đề cho, xếp trái → phải theo thứ tự đề đọc, và
// A đặt THẲNG TRÊN chân đường vuông góc: nét vuông góc phải vuông thật chứ
// không phải vẽ cho giống, vì cả bài toán nằm ở chỗ đoạn nào vuông góc.
//   { "t":"duong-xien", "A":"A", "d":"d", "feet":["D","H","B","C"], "perp":"H" }
function _mfqDuongXien(f) {
  const feet = (Array.isArray(f.feet) && f.feet.length ? f.feet : ['H', 'B', 'C'])
    .slice(0, 6).map(String);
  const n = feet.length;
  const y = 88, top = 26, x0 = 38, x1 = 162;
  const xs = feet.map((_, i) => (n === 1 ? 100 : x0 + (x1 - x0) * i / (n - 1)));
  const iH = f.perp == null ? -1 : feet.indexOf(String(f.perp));
  // Không có chân vuông góc thì A phải lệch khỏi mọi chân điểm: đứng thẳng
  // trên một chân là đang khẳng định một điều đề không cho.
  const ax = iH >= 0 ? xs[iH] : (x0 + x1) / 2 + 13;
  let out = _mfLine(12, y, 188, y) + _mfT(193, y - 4, f.d || 'd', 'end');
  xs.forEach(x => { out += _mfLine(ax, top, x, y); });
  if (iH >= 0) {
    // Ô vuông mở về phía còn chỗ: nếu H là chân ngoài cùng bên phải thì mở
    // sang trái, không thì mở sang phải — chỗ nào cũng có một đường xiên đi
    // qua, chọn bên xa đường xiên gần nhất.
    out += _mfRight(ax, y, 11, iH === n - 1 ? 90 : 0, 'b');
  }
  if (f.mid) {                       // điểm nằm giữa A và chân đường vuông góc
    const my = top + (y - top) * 0.55;
    out += _mfDot(ax, my) + _mfT(ax - 7, my + 4, String(f.mid), 'end');
  }
  out += _mfDot(ax, top) + _mfT(ax, top - 9, f.A || 'A');
  xs.forEach((x, i) => { out += _mfDot(x, y) + _mfT(x, y + 15, feet[i]); });
  return out;
}

// §34 · §35 — ba đường trung tuyến / phân giác / đường cao và điểm đồng quy.
// Một khuôn cho cả bốn loại đường, vì đề thi vẽ CÙNG một cái hình cho cả bốn
// và chỉ đổi dấu hiệu: "đường nào là trung tuyến của ΔABC?" và "đường nào là
// đường cao?" dùng chung một tam giác có ba đoạn kẻ từ ba đỉnh.
//
// Chân đường tính THẬT từ loại đường: trung tuyến hạ đúng trung điểm, đường
// cao hạ đúng chân vuông góc, phân giác chia cạnh đối theo tỉ số hai cạnh kề.
// Nếu đặt chân ở đâu cũng được thì hình lại nói ngược với đáp án.
//
// `dau` (vẽ dấu hiệu: vạch trung điểm, ô vuông góc, cung góc bằng nhau) mặc
// định TẮT. Câu "đoạn nào là đường trung tuyến?" mà vẽ sẵn hai vạch trung
// điểm là đã khoanh hộ đáp án; ngược lại câu "biết AM là trung tuyến, tính
// AG" thì dấu ấy là dữ kiện đề cho, phải vẽ. Người soạn câu quyết định.
//   { "t":"dong-quy", "v":["A","B","C"], "can":true, "giao":"I",
//     "ke":[{"tu":"A","chan":"H","loai":"duong-cao","dau":true},
//           {"tu":"B","chan":"E","loai":"duong-cao"}] }
// Tam giác chọn góc A ≈ 60°–66° chứ không nhọn hơn: chân đường cao hạ từ B
// xuống AC nằm ở khoảng 0,4 cạnh, đủ xa đỉnh A để nhãn chân đường và nhãn
// đỉnh không dồn vào nhau. Tam giác cao vổng lên thì hai chân đường cao trèo
// gần hết lên đỉnh và ba chữ chồng thành một vệt.
const _MF_DQ = [[82, 28], [54, 104], [146, 104]];       // lệch hẳn, không cân
const _MF_DQ_CAN = [[100, 28], [51, 104], [149, 104]];  // cân tại đỉnh v[0]

// Nhãn của khuôn này tính từ tâm tam giác nên có thể trôi ra ngoài khung;
// kẹp lại để chữ không bị mép SVG cắt mất nửa trên.
function _mfDqT(x, y, s, an) {
  return _mfT(Math.min(190, Math.max(10, x)), Math.min(114, Math.max(11, y)), s, an);
}

function _mfqDongQuy(f) {
  const v = (f.v || ['A', 'B', 'C']).slice(0, 3).map(String);
  const P = f.can ? _MF_DQ_CAN : _MF_DQ;
  const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
  const OPP = [[1, 2], [2, 0], [0, 1]];
  const segs = [];
  (Array.isArray(f.ke) ? f.ke : []).slice(0, 3).forEach(k => {
    if (!k || typeof k !== 'object') return;
    const i = v.indexOf(String(k.tu));
    if (i < 0) return;
    const Q = P[OPP[i][0]], R = P[OPP[i][1]], V = P[i];
    const dx = R[0] - Q[0], dy = R[1] - Q[1], L2 = dx * dx + dy * dy || 1;
    const loai = k.loai || 'thuong';
    // Ba đoạn "thường" phải trải đều trên ba cạnh (ba chân dồn về một góc thì
    // ba cái nhãn dính vào nhau) và phải KHÔNG đồng quy — vẽ ba đoạn cắt nhau
    // tại một điểm là đang cho không cái điều mà câu hỏi bắt nhận ra. Bộ số
    // này cố ý phá định lí Ceva: 0,45/0,55 × 0,45/0,55 × 0,35/0,65 ≈ 0,36,
    // xa 1 đủ để ba đoạn hở ra một tam giác nhỏ nhìn thấy được.
    let t = [0.45, 0.45, 0.35][i];
    if (loai === 'trung-tuyen' || loai === 'trung-truc') t = 0.5;
    else if (loai === 'duong-cao') t = ((V[0] - Q[0]) * dx + (V[1] - Q[1]) * dy) / L2;
    else if (loai === 'phan-giac') {
      const a = Math.hypot(V[0] - Q[0], V[1] - Q[1]), b = Math.hypot(V[0] - R[0], V[1] - R[1]);
      t = a / (a + b || 1);
    }
    if (k.t != null && Number.isFinite(+k.t)) t = +k.t;   // đề chỉ đích chỗ nào thì theo đề
    t = Math.min(0.9, Math.max(0.1, t));
    segs.push({ k, V, Q, R, loai, F: [Q[0] + dx * t, Q[1] + dy * t] });
  });

  let out = '';
  segs.forEach(s => {
    const dau = !!s.k.dau;
    if (dau && (s.loai === 'trung-tuyen' || s.loai === 'trung-truc')) {
      out += _mfTicks(s.Q[0], s.Q[1], s.F[0], s.F[1], 2, 'c')
        + _mfTicks(s.F[0], s.F[1], s.R[0], s.R[1], 2, 'c');
    }
    if (dau && (s.loai === 'duong-cao' || s.loai === 'trung-truc')) {
      // Chỉ đóng dấu vuông khi nó vuông THẬT: trong tam giác thường, trung
      // tuyến không vuông góc với đáy, đóng dấu vào là vẽ ra một điều sai.
      const aS = _mfDir(s.F, s.R), aC = _mfDir(s.F, s.V);
      const d = ((aC - aS) % 360 + 360) % 360;
      if (Math.abs(d - 90) < 4) out += _mfRight(s.F[0], s.F[1], 10, aS, 'b');
      else if (Math.abs(d - 270) < 4) out += _mfRight(s.F[0], s.F[1], 10, aC, 'b');
    }
    if (dau && s.loai === 'phan-giac') {
      // Cung phải nằm TRONG góc: lấy min/max của hai số đo là sai khi góc vắt
      // qua mốc 0° — khi đó máy tô đúng phần góc ngoài. Chọn chiều quay nào
      // cho ra cung nhỏ hơn 180° mới là góc trong của tam giác.
      let lo = _mfDir(s.V, s.Q), hi = _mfDir(s.V, s.R);
      if (((hi - lo) % 360 + 360) % 360 > 180) { const w = lo; lo = hi; hi = w; }
      hi = lo + ((hi - lo) % 360 + 360) % 360;
      const mid = (lo + hi) / 2;
      out += _mfWedge(s.V[0], s.V[1], 15, lo, mid, 'c') + _mfWedge(s.V[0], s.V[1], 15, mid, hi, 'c')
        + _mfAtick(s.V[0], s.V[1], 15, (lo + mid) / 2, 'c')
        + _mfAtick(s.V[0], s.V[1], 15, (mid + hi) / 2, 'c');
    }
  });
  if (f.can) {                        // "cân tại A" là dữ kiện, không phải đáp án
    out += _mfTicks(P[0][0], P[0][1], P[1][0], P[1][1], 1, 'b')
      + _mfTicks(P[0][0], P[0][1], P[2][0], P[2][1], 1, 'b');
  }
  out += _mfPoly(P, 'mf-l mf-tri');
  segs.forEach(s => { out += _mfLine(s.V[0], s.V[1], s.F[0], s.F[1], 'mf-l mf-hi'); });

  // Nhãn chân đường và nhãn đỉnh đẩy ra XA TÂM tam giác — hướng đó là hướng
  // duy nhất chắc chắn không đâm vào cạnh nào của tam giác.
  const cho = [];                     // những chỗ trên hình đã có chữ
  const dat = (p, s, r) => {
    const dx = p[0] - cx, dy = p[1] - cy, m = Math.hypot(dx, dy) || 1;
    const x = p[0] + dx / m * r, y = p[1] + dy / m * r + 4;
    cho.push([x, y]);
    return _mfDqT(x, y, s, dx < -6 ? 'end' : (dx > 6 ? 'start' : 'middle'));
  };
  segs.forEach(s => { if (s.k.chan) out += dat(s.F, String(s.k.chan), 13); });
  v.forEach((name, i) => { out += dat(P[i], name, 13); });

  // Điểm đồng quy: giao của hai đoạn đầu tiên, vẽ đúng chỗ chúng cắt nhau —
  // trọng tâm nằm ở 2/3 đường trung tuyến là điều bé phải đọc ra TỪ hình.
  //
  // Nhãn của nó thì phải TÌM chỗ: điểm này nằm giữa lòng hình, quanh nó hướng
  // nào cũng có thể đã có một đoạn thẳng hoặc một chữ nằm sẵn. Thử tám hướng,
  // lấy hướng xa mọi nét và mọi chữ nhất. (Đặt cứng sang trái từng che mất ô
  // vuông góc ở chân đường cao.)
  if (f.giao && segs.length >= 2) {
    const [p, q] = segs;
    const r1 = [p.F[0] - p.V[0], p.F[1] - p.V[1]], r2 = [q.F[0] - q.V[0], q.F[1] - q.V[1]];
    const den = r1[0] * r2[1] - r1[1] * r2[0];
    const u = Math.abs(den) > 1e-6
      ? ((q.V[0] - p.V[0]) * r2[1] - (q.V[1] - p.V[1]) * r2[0]) / den : -1;
    if (u > 0.05 && u < 0.95) {
      const G = [p.V[0] + r1[0] * u, p.V[1] + r1[1] * u];
      const xa = (x, y) => {
        let d = 1e9;
        segs.forEach(s => { d = Math.min(d, _mfSegD(x, y, s.V, s.F)); });
        cho.forEach(c => { d = Math.min(d, Math.hypot(x - c[0], y - c[1]) / 1.6); });
        return d;
      };
      let best = null;
      for (let a = 0; a < 360; a += 45) {
        const c = _mfP(G[0], G[1], 14, a);
        const an = c[0] < G[0] - 4 ? 'end' : (c[0] > G[0] + 4 ? 'start' : 'middle');
        // Chấm điểm ở GIỮA chữ chứ không ở điểm neo: chữ neo 'start' nằm hẳn
        // về bên phải điểm neo, đo ở điểm neo là đo hụt mất cả con chữ.
        const s = xa(c[0] + (an === 'end' ? -5 : an === 'start' ? 5 : 0), c[1]);
        if (!best || s > best[3]) best = [c[0], c[1] + 4, an, s];
      }
      out += _mfDot(G[0], G[1]) + _mfDqT(best[0], best[1], String(f.giao), best[2]);
    }
  }
  return out;
}

// ---- Chương X: một số hình khối trong thực tiễn -------------------------
// Một khối vẽ trên mặt giấy phẳng chỉ đọc được nhờ ba quy ước, và ba quy ước
// đó CHÍNH LÀ nội dung của chương: mặt trước vẽ đúng hình chữ nhật, chiều sâu
// đẩy chéo lên phải một đoạn cố định, cạnh nào bị khối che thì vẽ nét đứt.
// Bỏ nét đứt đi là bé đếm được 9 cạnh thay vì 12 — mà "mấy mặt, mấy đỉnh,
// mấy cạnh" đúng là câu §36 hỏi nhiều nhất.
//
// Chiều sâu đẩy lên PHẢI nghĩa là người nhìn đứng chếch bên phải và cao hơn
// khối: thấy mặt trước, mặt phải và mặt trên; ba mặt kia khuất. Đỉnh sau –
// trái – dưới là đỉnh duy nhất không nhìn thấy, và ba cạnh chụm vào nó là ba
// nét đứt.
const _MF_HOP = {
  // Mỗi mặt đọc theo vòng: trước-trái, trước-phải, sau-phải, sau-trái.
  duoi: [[48, 92], [130, 92], [160, 70], [78, 70]],
  tren: [[48, 48], [130, 48], [160, 26], [78, 26]],
  // Nhãn đỉnh đặt tay chứ không tính theo tâm khối. Với đỉnh sau-trái, mọi
  // hướng "ra ngoài" đều rơi vào lòng một mặt bên; chọn chỗ trống hẳn giữa
  // hai nét đứt thì chữ mới không bị một cạnh cắt ngang.
  lbl: [[41, 102, 'end'], [137, 102, 'start'], [167, 75, 'start'], [71, 66, 'end'],
        [41, 45, 'end'], [124, 42, 'end'], [167, 24, 'start'], [74, 20, 'end']],
};

//   { "t":"hop-chu-nhat", "dai":"7 cm", "rong":"5 cm", "cao":"15 cm" }
//   { "t":"lap-phuong", "canh":"4 m" }
//   { "t":"hop-chu-nhat", "v":[["M","N","P","Q"],["A","B","C","D"]] }
// `v` = [tên bốn đỉnh mặt ĐÁY, tên bốn đỉnh mặt TRÊN] theo cùng vòng đó, nên
// v[0][k] và v[1][k] luôn là hai đầu của một cạnh bên. `v:false` bỏ hết chữ —
// câu "cái thùng tôn hình lập phương cạnh 4 m" không cần đỉnh nào có tên.
function _mfqHinhHop(f) {
  const D = _MF_HOP.duoi, T = _MF_HOP.tren;
  const dash = 'mf-d';
  let out = '';
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // Cạnh đáy 2–3 và 3–0 chụm vào đỉnh sau-trái (số 3) nên bị khối che.
    const hid = (i === 2 || i === 3) ? dash : null;
    out += _mfLine(D[i][0], D[i][1], D[j][0], D[j][1], hid)
      + _mfLine(T[i][0], T[i][1], T[j][0], T[j][1])
      + _mfLine(D[i][0], D[i][1], T[i][0], T[i][1], i === 3 ? dash : null);
  }
  const v = f.v;
  if (v !== false && v !== null) {
    // Đủ 4 tên mỗi mặt hay không cũng phải giữ nguyên vị trí: một mảng thiếu
    // tên mà để trôi thì tên mặt trên tụt xuống ô của mặt đáy, và cái hình
    // sai đó nhìn vẫn y như một cái hình đúng.
    const nm = Array.isArray(v) && v.length === 2 && Array.isArray(v[0]) && Array.isArray(v[1])
      ? [_mfNames(v[0], 4), _mfNames(v[1], 4)]
      : [['A', 'B', 'C', 'D'], ["A'", "B'", "C'", "D'"]];
    nm[0].concat(nm[1]).forEach((s, i) => {
      const L = _MF_HOP.lbl[i];
      if (L && s) out += _mfT(L[0], L[1], s, L[2]);
    });
  }
  // Ba kích thước, mỗi cái nằm cạnh đúng cạnh nó đo. Hình lập phương chỉ có
  // một số đo nên ghi lên cạnh đáy trước — cạnh dễ nhìn nhất.
  const put = (x, y, txt, an) => (txt ? _mfT(x, y, String(txt), an, 'mf-val mf-' + _mfK(txt)) : '');
  return out
    + put(89, 110, f.dai != null ? f.dai : f.canh, 'middle')
    + put(156, 95, f.rong, 'start')
    + put(42, 74, f.cao, 'end');
}

// Hình lăng trụ đứng: một mặt đáy quay thẳng vào người nhìn nên vẽ ĐÚNG HÌNH
// THẬT, mặt đáy kia đẩy chéo lên phải, ba (bốn) mặt bên là các hình bình hành
// nối hai đáy. Đã thử vẽ kiểu "đứng thẳng" — hai đáy nằm ngang, cạnh bên dựng
// đứng — nhưng khi đó mặt đáy bị chiếu bẹp thành một dải mỏng, và câu hỏi
// nhiều nhất của §37 ("đáy là hình gì?", "cạnh đáy là những cạnh nào?") lại
// đúng là câu KHÔNG đọc được từ một cái đáy bẹp. Quay đáy ra trước thì đáy
// hiện nguyên hình tam giác / hình thang, ba mặt bên hiện rõ là ba hình bình
// hành, và ba cạnh bên hiện rõ là ba đoạn bằng nhau — cũng chính là chiều cao
// của lăng trụ. Kèm theo: góc vuông của đáy nay nằm trong mặt vẽ thật, nên
// đóng dấu vuông vào là đóng đúng chỗ vuông thật.
//
// `mat` là đa giác đáy trước, đọc theo vòng; `r` là vector chiều sâu. Nhãn
// đặt tay: quanh một khối, chỗ trống không suy ra được bằng công thức đẩy
// theo tâm — nó nằm ở những khe giữa các nét, phải ngắm từng hình một.
const _MF_LTRU = {
  'lang-tru-tam-giac': {
    mat: [[44, 102], [114, 102], [64, 44]],
    r: [38, -26],
    lbl: [[38, 113, 'end'], [114, 114, 'middle'], [58, 36, 'end'],
          [90, 89, 'start'], [158, 80, 'start'], [102, 12, 'middle']],
    canh: [[79, 114, 'middle'], [110, 70, 'middle'], [42, 73, 'end']],
    cao: [140, 105, 'start'],
  },
  // Dùng khi đề cho đáy là tam giác vuông: đáy vẽ thật nên ô vuông là thật.
  'lang-tru-tam-giac-vuong': {
    mat: [[52, 102], [122, 102], [52, 44]],
    r: [38, -26],
    lbl: [[46, 113, 'end'], [122, 114, 'middle'], [46, 36, 'end'],
          [98, 89, 'start'], [166, 80, 'start'], [90, 12, 'middle']],
    canh: [[87, 114, 'middle'], [118, 70, 'middle'], [46, 77, 'end']],
    cao: [148, 105, 'start'],
    vuong: true,
  },
  // Đáy hình thang: đúng hình mà SGK và đề thi dùng cho lăng trụ đứng tứ giác.
  'lang-tru-tu-giac': {
    mat: [[40, 102], [120, 102], [100, 50], [58, 50]],
    r: [38, -26],
    lbl: [[34, 113, 'end'], [120, 114, 'middle'], [100, 42, 'middle'], [52, 44, 'end'],
          [86, 89, 'start'], [164, 80, 'start'], [145, 20, 'start'], [96, 16, 'middle']],
    canh: [[80, 114, 'middle'], [131, 72, 'middle'], [79, 62, 'middle'], [37, 76, 'end']],
    cao: [146, 105, 'start'],
  },
};

//   { "t":"lang-tru-tam-giac", "v":[["A","B","C"],["A'","B'","C'"]] }
//   { "t":"lang-tru-tam-giac", "day":["3 cm","5 cm","4 cm"], "cao":"10 cm", "vuong":"A" }
//   { "t":"lang-tru-tu-giac", "cao":"12 cm" }
// `v` = [tên các đỉnh mặt đáy TRƯỚC, tên các đỉnh mặt đáy SAU] theo cùng một
// vòng, nên v[0][k] và v[1][k] luôn là hai đầu của một cạnh bên. `v:false` bỏ
// hết chữ. `day` ghi số đo từng cạnh đáy theo đúng vòng đó, `cao` là độ dài
// cạnh bên. `vuong` nêu tên đỉnh có góc vuông ở đáy (chỉ với đáy tam giác).
function _mfqLangTru(f) {
  const quad = f.t === 'lang-tru-tu-giac';
  const S = _MF_LTRU[quad ? 'lang-tru-tu-giac'
    : (f.vuong ? 'lang-tru-tam-giac-vuong' : 'lang-tru-tam-giac')];
  const F = S.mat, n = F.length, r = S.r;
  const B = F.map(p => [p[0] + r[0], p[1] + r[1]]);
  const cx = F.reduce((s, p) => s + p[0], 0) / n, cy = F.reduce((s, p) => s + p[1], 0) / n;

  // Mặt bên nào quay về phía người nhìn thì thấy: pháp tuyến NGOÀI của cạnh
  // đáy chấm với vector chiều sâu phải dương. Suy ra chứ không chép tay một
  // danh sách "cạnh nào nét đứt" — đổi hình đáy là danh sách chép tay sai
  // ngay, mà sai kiểu đó thì nhìn vẫn thấy giống một cái khối.
  const hien = F.map((p, i) => {
    const q = F[(i + 1) % n];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0];
    if (nx * ((p[0] + q[0]) / 2 - cx) + ny * ((p[1] + q[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    return nx * r[0] + ny * r[1] > 0;
  });

  let out = '';
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out += _mfLine(F[i][0], F[i][1], F[j][0], F[j][1])   // đáy trước: luôn nhìn thấy
      + _mfLine(B[i][0], B[i][1], B[j][0], B[j][1], hien[i] ? null : 'mf-d')
      // Cạnh bên khuất khi CẢ HAI mặt bên kề nó đều khuất.
      + _mfLine(F[i][0], F[i][1], B[i][0], B[i][1],
        (hien[i] || hien[(i + n - 1) % n]) ? null : 'mf-d');
  }

  let nm = Array.isArray(f.v) && f.v.length === 2 && Array.isArray(f.v[0]) && Array.isArray(f.v[1])
    ? [_mfNames(f.v[0], n), _mfNames(f.v[1], n)]
    : (n === 3 ? [['A', 'B', 'C'], ["A'", "B'", "C'"]]
               : [['A', 'B', 'C', 'D'], ["A'", "B'", "C'", "D'"]]);
  let day = Array.isArray(f.day) ? f.day.slice(0, n) : (f.day ? [f.day] : []);
  // Đề gọi tên đỉnh vuông là gì thì XOAY danh sách tên cho đỉnh ấy về đúng
  // góc vuông của hình — hình cố định, tên là của đề. Số đo cạnh đáy xoay
  // theo cùng một nhịp, nếu không thì "AB = 3 cm" rơi xuống cạnh BC.
  if (S.vuong && f.vuong != null) {
    const k = nm[0].indexOf(String(f.vuong));
    if (k > 0) {
      const xoay = a => a.slice(k).concat(a.slice(0, k));
      nm = nm.map(xoay);
      if (day.length === n) day = xoay(day);
    }
  }
  if (f.v !== false && f.v !== null) {
    nm[0].concat(nm[1]).forEach((s, i) => {
      const L = S.lbl[i];
      if (L && s) out += _mfT(L[0], L[1], s, L[2]);
    });
  }
  if (S.vuong) out += _mfCorner(F[0], F[1], F[n - 1], 11);

  // Một mặt bên ĐỂ HỞ (thùng không nắp): tô mặt ấy và gọi tên nó. Bài "tính
  // diện tích thép" không giải được nếu không biết mặt nào thiếu — con số
  // ấy chỉ có trên hình, đề bài không nói.
  if (Number.isFinite(+f.ho)) {
    const i = ((+f.ho % n) + n) % n, j = (i + 1) % n;
    const M = [F[i], F[j], B[j], B[i]];
    const g = [M.reduce((s, p) => s + p[0], 0) / 4, M.reduce((s, p) => s + p[1], 0) / 4];
    out += _mfPoly(M, 'mf-box mf-a')
      + _mfT(g[0] - 2, g[1] - 8, String(f.hoChu || 'mặt hở'), 'middle', 'mf-cap');
  }

  const put = (L, txt) => (txt ? _mfT(L[0], L[1], String(txt), L[2], 'mf-val mf-' + _mfK(txt)) : '');
  S.canh.forEach((L, i) => { out += put(L, day[i]); });
  return out + put(S.cao, f.cao);
}

// ---- Hình VẼ LẠI cho năm đề HK1 thật -----------------------------------
// Năm đề HK1 chép từ PDF trước đây dán thẳng một mẩu ảnh cắt của trang đề vào
// câu hỏi. Ảnh scan thì mờ, không đổi màu theo theme, phóng to là vỡ, và nặng
// hơn cả phần còn lại của ứng dụng — nên mọi hình ấy nay được vẽ lại bằng
// những khuôn dưới đây. Luật không đổi: hình dựng từ chính số đo đề cho (góc
// 80° phải vẽ ra 80°, cạnh 100 cm phải dài hơn cạnh 60 cm), và không bao giờ
// ghi sẵn con số phải tìm.

// Một Ô GÓC quanh một đỉnh. Nhãn của nó có ba vai khác hẳn nhau:
//   '55°'                  số đo đề cho        → tô quạt, chữ xanh
//   '?' / 'x'              chỗ phải tìm        → tô quạt, chữ cam
//   '1'                    TÊN của góc (∠D₁)   → chỉ ghi số, KHÔNG tô quạt
//   {n:'1', so:'80°'}      tên góc kèm số đo   → tô quạt, ghi cả hai
//   {n:'1', bang:2}        dấu "hai góc này bằng nhau" (vạch trên cung)
// Tô cả bốn ô quanh một đỉnh thì hình thành một cái đĩa màu và không còn đọc
// ra góc nào với góc nào — nên nhãn chỉ là TÊN góc thì để trần.
function _mfOng(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    return {
      n: v.n == null ? '' : String(v.n), so: v.so == null ? '' : String(v.so),
      quat: v.quat === true || !!v.so || (+v.bang || 0) > 0,
      bang: +v.bang || 0, r: +v.r || 0,
    };
  }
  const s = String(v);
  return { n: s, so: '', quat: !/^\d+$/.test(s), bang: 0, r: 0 };
}

function _mfOMau(o) {
  if (o.bang > 0) return 'c';
  return (/\?/.test(o.n + o.so) || /^[a-z]$/.test(o.n)) ? 'a' : 'b';
}

function _mfVeO(cx, cy, a0, a1, val) {
  const o = _mfOng(val);
  if (!o) return '';
  const k = _mfOMau(o), mid = (a0 + a1) / 2;
  let out = '';
  if (o.quat) out += _mfWedge(cx, cy, 13, a0, a1, k);
  for (let i = 0; i < o.bang; i++) {
    out += _mfAtick(cx, cy, 13, mid + (i - (o.bang - 1) / 2) * 11, 'c');
  }
  const r1 = o.r || (o.quat ? (o.so ? 17 : 26) : 15);
  if (o.n) {
    const p = _mfP(cx, cy, r1, mid);
    out += _mfT(p[0], p[1] + 4, o.n, 'middle', (o.quat && !o.so) ? 'mf-val mf-' + k : '');
  }
  if (o.so) {
    const p = _mfP(cx, cy, r1 + 16, mid);
    out += _mfT(p[0], p[1] + 4, o.so, 'middle', 'mf-val mf-' + k);
  }
  return out;
}

// Bốn ô góc quanh một giao điểm. `phi` là hướng của đường bị cắt (tia bên
// phải), `th` là hướng tia đi LÊN của cát tuyến. Tên ô đọc theo mắt bé:
// trên-phải, trên-trái, dưới-trái, dưới-phải.
function _mfBienO(phi, th) {
  return { tp: [phi, th], tt: [th, phi + 180], dt: [phi + 180, th + 180], dp: [th + 180, phi + 360] };
}

// Chỗ đặt TÊN của một giao điểm: hoặc tên một ô góc còn trống ('tp','tt',
// 'dt','dp'), hoặc {deg, r} chỉ thẳng hướng và khoảng cách. Đặt bừa thì chữ
// rơi trúng một nhãn góc — mà "1" chồng lên "D" thì đọc ra một thứ thứ ba.
function _mfChoTen(P, bien, noi, macDinh) {
  const q = noi == null ? macDinh : noi;
  if (q && typeof q === 'object') return _mfP(P[0], P[1], +q.r || 26, +q.deg);
  const b = bien[q] || bien.tt;
  return _mfP(P[0], P[1], 26, (b[0] + b[1]) / 2);
}

function _mfRad(d) { return d * Math.PI / 180; }

// Hai đường thẳng bị MỘT hoặc HAI cát tuyến cắt — cái hình của gần hết
// Chương 3 trong năm đề: so le trong, đồng vị, kề bù, hai đường song song.
//   { "t":"cat-tuyen", "par":true, "ten":["a","b"],
//     "cat":[{ "diem":["A","B"], "goc":{ "A":{"dt":"?"}, "B":{"tp":"55°"} } }] }
// Hướng cát tuyến suy THẲNG từ nhãn số đo nếu hình có nhãn ấy, nên một góc
// ghi 55° không bao giờ bị vẽ thành góc tù; chỉ khi hình không có số đo nào
// (chỉ đánh số ∠A₁, ∠A₂…) thì mới lấy `a` của đề bài.
function _mfqCatTuyen(f) {
  const Y = (Array.isArray(f.y) && f.y.length === 2) ? f.y.map(Number) : [34, 92];
  const ng = (Array.isArray(f.nghieng) && f.nghieng.length === 2) ? f.nghieng.map(Number) : [0, 0];
  const X0 = 16, X1 = 184, PV = 100;
  const yL = (i, x) => Y[i] - (x - PV) * Math.tan(_mfRad(ng[i]));
  const cats = (Array.isArray(f.cat) && f.cat.length ? f.cat : [{}]).slice(0, 2);

  let net = '', chu = '';
  for (let i = 0; i < 2; i++) net += _mfLine(X0, yL(i, X0), X1, yL(i, X1));
  if (f.par) for (let i = 0; i < 2; i++) net += _mfPar(X0, yL(i, X0), X1, yL(i, X1), 0.9);

  // `ten` chỉ đặt tên đầu bên phải; `dau` đặt cả hai đầu, cho những đề gọi
  // đường thẳng là xx′ chứ không gọi là a.
  const dau = Array.isArray(f.dau) ? f.dau : [[null, (f.ten || [])[0]], [null, (f.ten || [])[1]]];
  for (let i = 0; i < 2; i++) {
    const d = dau[i] || [];
    if (d[0]) chu += _mfT(8, yL(i, 8) - 6, String(d[0]), 'start');
    if (d[1]) chu += _mfT(192, yL(i, 192) - 6, String(d[1]), 'end');
  }

  const P = {};
  cats.forEach((c, k) => {
    const ten = c.diem || (k === 0 ? ['A', 'B'] : ['C', 'D']);
    const goc = c.goc || {};
    let th = Number.isFinite(+c.a) ? +c.a : 115;
    Object.keys(goc).some(nm => {
      const li = ten.indexOf(nm);
      if (li < 0) return false;
      return Object.keys(goc[nm]).some(o => {
        const g = _mfOng(goc[nm][o]);
        const m = g && /(\d+(?:[.,]\d+)?)\s*°/.exec(g.n + ' ' + g.so);
        if (!m) return false;
        const s = parseFloat(m[1].replace(',', '.'));
        th = ng[li] + ((o === 'tp' || o === 'dt') ? s : 180 - s);
        return true;
      });
    });
    th = Math.min(Math.max(ng[0], ng[1]) + 168, Math.max(Math.min(ng[0], ng[1]) + 12, th));

    const midX = Number.isFinite(+c.x) ? +c.x * 200 : (cats.length === 1 ? 100 : (k === 0 ? 68 : 142));
    const A = [midX + (Y[1] - Y[0]) / Math.tan(_mfRad(th)) / 2, 0];
    A[1] = yL(0, A[0]);
    // Giao với đường dưới giải THẲNG từ phương trình hai đường, để cát tuyến
    // vẫn là một đoạn thẳng dù hai đường nghiêng khác nhau.
    const cs = Math.cos(_mfRad(th)), sn = Math.sin(_mfRad(th)), t1 = Math.tan(_mfRad(ng[1]));
    const den = cs * t1 - sn;
    const t = Math.abs(den) < 1e-6 ? 0 : (Y[1] - (A[0] - PV) * t1 - A[1]) / den;
    const B = [A[0] + t * cs, A[1] - t * sn];
    const pts = [A, B];
    P[ten[0]] = A; P[ten[1]] = B;

    // Cát tuyến kéo dài qua hai giao điểm một quãng, để nó là một ĐƯỜNG
    // THẲNG chứ không phải cái thang bắc giữa hai đường.
    const bx = y => A[0] + (A[1] - y) / Math.tan(_mfRad(th));
    const yTop = Math.min(Y[0], Y[1]) - 22, yBot = Math.max(Y[0], Y[1]) + 20;
    net += _mfLine(bx(yTop), yTop, bx(yBot), yBot);
    if (c.ten) chu += _mfT(bx(yTop) + (th > 90 ? -7 : 7), yTop - 1, String(c.ten));
    if (c.duoi) chu += _mfT(bx(yBot) + (th > 90 ? 7 : -7), yBot + 7, String(c.duoi));

    ten.slice(0, 2).forEach((nm, i) => {
      const b = _mfBienO(ng[i], th), g = goc[nm] || {};
      Object.keys(b).forEach(o => { chu += _mfVeO(pts[i][0], pts[i][1], b[o][0], b[o][1], g[o]); });
      if (c.vuong) chu += _mfRight(pts[i][0], pts[i][1], 11, b[i === 0 ? 'dp' : 'tp'][0], 'b');
      net += _mfDot(pts[i][0], pts[i][1]);
      if (nm) {
        const q = _mfChoTen(pts[i], b, (c.noi || [])[i], i === 0 ? 'tt' : 'dt');
        chu += _mfT(q[0], q[1] + 4, nm);
      }
    });
  });

  // Tia phụ (tia phân giác, tia bắc sang đường kia) và điểm đánh dấu thêm.
  (Array.isArray(f.tia) ? f.tia : []).forEach(r => {
    const V = P[r.tu];
    if (!V) return;
    const d = +r.huong, cs = Math.cos(_mfRad(d)), sn = Math.sin(_mfRad(d));
    let len = +r.dai || 34, E = null;
    if (r.toi != null) {                        // tia chạy tới khi gặp đường kia
      const i = +r.toi, t1 = Math.tan(_mfRad(ng[i])), den = cs * t1 - sn;
      if (Math.abs(den) > 1e-6) {
        const tt = (Y[i] - (V[0] - PV) * t1 - V[1]) / den;
        if (tt > 0) { E = [V[0] + tt * cs, V[1] - tt * sn]; len = tt + (+r.qua || 0); }
      }
    }
    const tip = [V[0] + len * cs, V[1] - len * sn];
    net += _mfLine(V[0], V[1], tip[0], tip[1]);
    if (E) {
      net += _mfDot(E[0], E[1]);
      if (r.dat) chu += _mfT(E[0] + ((r.at || [0, 0])[0]), E[1] + ((r.at || [0, 0])[1]), String(r.dat));
    }
    if (r.ten) chu += _mfT(tip[0] + ((r.tenAt || [0, 0])[0]), tip[1] + ((r.tenAt || [0, 0])[1]), String(r.ten));
    if (Array.isArray(r.cung) && r.cung.length === 2) {
      const a0 = +r.cung[0], a1 = +r.cung[1];
      chu += _mfWedge(V[0], V[1], 18, a0, d, 'c') + _mfWedge(V[0], V[1], 18, d, a1, 'c')
        + _mfAtick(V[0], V[1], 18, (a0 + d) / 2, 'c') + _mfAtick(V[0], V[1], 18, (d + a1) / 2, 'c');
    }
  });
  (Array.isArray(f.them) ? f.them : []).forEach(p => {
    const i = +p.duong || 0, x = +p.x, at = p.at || [0, 14];
    net += _mfDot(x, yL(i, x));
    if (p.ten) chu += _mfT(x + at[0], yL(i, x) + at[1], String(p.ten));
  });
  return net + chu;
}

// MỘT đường thẳng bị hai đường khác cắt tại hai điểm — hình của câu "∠P₂ và
// ∠Q₂ là hai góc gì?". Khác `cat-tuyen` ở chỗ hai giao điểm nằm trên CÙNG một
// đường; vẽ nó theo khuôn cat-tuyen là đang bịa thêm chuyện b ∥ c.
//   { "t":"cat-hai-duong", "ten":"a",
//     "giao":[{"ten":"P","huong":70,"tenDuong":"b","goc":{"tt":"1"}}, …] }
function _mfqCatHaiDuong(f) {
  const y = 68;
  let net = _mfLine(10, y, 190, y), chu = '';
  if (f.ten) chu += _mfT(194, y - 6, String(f.ten), 'end');
  const gs = (Array.isArray(f.giao) ? f.giao : []).slice(0, 2);
  const xs = gs.length === 1 ? [100] : [62, 140];
  gs.forEach((g, i) => {
    const V = [xs[i], y], th = Math.min(160, Math.max(20, +g.huong || 70));
    const cs = Math.cos(_mfRad(th)), sn = Math.sin(_mfRad(th));
    const up = 52 / sn, dn = 46 / sn;
    net += _mfLine(V[0] - dn * cs, y + dn * sn, V[0] + up * cs, y - up * sn) + _mfDot(V[0], V[1]);
    if (g.tenDuong) chu += _mfT(V[0] + up * cs + (th > 90 ? -8 : 8), y - up * sn - 1, String(g.tenDuong));
    const b = _mfBienO(0, th), goc = g.goc || {};
    Object.keys(b).forEach(o => { chu += _mfVeO(V[0], V[1], b[o][0], b[o][1], goc[o]); });
    if (g.ten) {
      const q = _mfChoTen(V, b, g.noi, 'dp');
      chu += _mfT(q[0], q[1] + 4, String(g.ten));
    }
  });
  return net + chu;
}

// ---- bốn hình để CHỌN --------------------------------------------------
// Ba câu trong năm đề cho bốn hình rồi hỏi "hình nào…". Bốn phương án ấy VỐN
// là bốn cái hình, nên mỗi phương án phải là một hình vẽ riêng, nếu không thì
// câu hỏi không còn gì để trả lời. Bốn ô xếp 2×2 (100×60 mỗi ô) chứ không xếp
// một hàng: một hàng bốn ô rộng 50 thì cát tuyến nghiêng 40° chạy hết bề
// ngang ô trước khi kịp gặp đường thứ hai.
const _MF_O4 = [[0, 0], [100, 0], [0, 60], [100, 60]];

function _mfKhung4(hinh, cap, ve) {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const o = _MF_O4[i];
    out += ve(hinh[i] || {}, o[0], o[1], i);
    const s = (cap || [])[i];
    if (s) out += _mfT(o[0] + 50, o[1] + 57, String(s), 'middle', 'mf-cap');
  }
  return out;
}

// "Hình vẽ nào sau đây có hai đường thẳng song song?" — bốn ô, mỗi ô hai
// đường bị một cát tuyến cắt. Độ nghiêng của hai đường SUY RA từ hai số đo
// đánh dấu: ô nào hai số ăn khớp thì hai đường vẽ ra song song thật, ô nào
// lệch thì vẽ ra lệch. Vẽ bốn ô y hệt nhau rồi ghi bốn cặp số khác nhau là
// hình nói dối, và bé không còn cách nào chọn ngoài đoán.
function _mfqChonSongSong(f) {
  return _mfKhung4(f.hinh || [], f.cap, (h, ox, oy) => {
    const marks = [h.tren, h.duoi];
    const d = marks.map(m => {
      const o = (m || {}).o || 'tp';
      const g = /(\d+(?:[.,]\d+)?)/.exec(String((m || {}).goc || ''));
      const s = (m || {}).vuong ? 90 : (g ? parseFloat(g[1].replace(',', '.')) : 60);
      return (o === 'tp' || o === 'dt') ? s : 180 - s;
    });
    const th = (d[0] + d[1]) / 2, phi = [th - d[0], th - d[1]];
    const y = [oy + 18, oy + 42], cx = ox + 50, xa = ox + 16, xb = ox + 84;
    const yL = (i, x) => y[i] - (x - cx) * Math.tan(_mfRad(phi[i]));
    let out = '';
    for (let i = 0; i < 2; i++) out += _mfLine(xa, yL(i, xa), xb, yL(i, xb));
    const A = [cx + (y[1] - y[0]) / Math.tan(_mfRad(th)) / 2, 0];
    A[1] = yL(0, A[0]);
    const cs = Math.cos(_mfRad(th)), sn = Math.sin(_mfRad(th)), t1 = Math.tan(_mfRad(phi[1]));
    const den = cs * t1 - sn;
    const t = Math.abs(den) < 1e-6 ? 0 : (y[1] - (A[0] - cx) * t1 - A[1]) / den;
    const B = [A[0] + t * cs, A[1] - t * sn];
    const bx = yy => A[0] + (A[1] - yy) / Math.tan(_mfRad(th));
    out += _mfLine(bx(y[0] - 12), y[0] - 12, bx(y[1] + 7), y[1] + 7);
    [[A, 0], [B, 1]].forEach(pair => {
      const Q = pair[0], i = pair[1], m = marks[i];
      out += _mfDot(Q[0], Q[1]);
      if (!m) return;
      const b = _mfBienO(phi[i], th), o = m.o || 'tp';
      if (m.vuong) { out += _mfRight(Q[0], Q[1], 10, b[o][0], 'b'); return; }
      // Nhãn quay VÀO dải giữa hai đường thì đẩy xa ra (chỗ ấy rộng), quay ra
      // ngoài thì kéo lại gần (ra xa nữa là chữ trèo khỏi ô).
      const vao = Math.sin(_mfRad((b[o][0] + b[o][1]) / 2)) * (i ? 1 : -1) > 0;
      out += _mfVeO(Q[0], Q[1], b[o][0], b[o][1], { n: String(m.goc), r: vao ? 30 : 22, quat: true });
    });
    return out;
  });
}

// "Hình nào dưới đây có cặp góc đối đỉnh?" — bốn ô, mỗi ô một (hoặc hai)
// đỉnh với các tia đi ra từ đó. `tia` là hướng các tia (độ), `nhan[i]` là tên
// của góc nằm giữa tia i và tia kế tiếp. Có cặp đối đỉnh hay không đọc ra từ
// CHÍNH các hướng ấy, nên hình không thể nói ngược với đáp án.
function _mfqBonGoc(f) {
  return _mfKhung4(f.hinh || [], f.cap, (h, ox, oy) => {
    let out = '';
    (Array.isArray(h.dinh) ? h.dinh : []).forEach(d => {
      const at = Array.isArray(d.at) ? d.at : [0, 0];
      const V = [ox + 50 + at[0], oy + 24 + at[1]];
      const tia = (Array.isArray(d.tia) ? d.tia : []).map(Number).sort((a, b) => a - b);
      tia.forEach(a => { out += _mfRay(V[0], V[1], 22, a); });
      tia.forEach((a, i) => {
        const s = String((d.nhan || [])[i] == null ? '' : (d.nhan || [])[i]);
        if (!s) return;
        const b = i === tia.length - 1 ? tia[0] + 360 : tia[i + 1];
        // Ô góc càng hẹp thì nhãn càng phải lùi ra xa đỉnh: chỗ hẹp giữa hai
        // tia không đủ chỗ cho một con số, chữ sẽ nằm đè lên chính hai tia ấy.
        const p = _mfP(V[0], V[1], (b - a) < 55 ? 18 : 14, (a + b) / 2);
        out += _mfT(p[0], p[1] + 4, s);
      });
      out += _mfDot(V[0], V[1]);
    });
    return out;
  });
}

// "Hình nào sau đây là hình hộp chữ nhật?" — bốn đồ vật. Phương án của đề là
// bốn tấm ảnh chụp; vẽ lại thành bốn hình khối để bé vẫn chọn được bằng mắt.
function _mfKhoi(kind, cx, cy) {
  if (kind === 'trai-tim') {                    // hộp bánh hình trái tim
    const w = 16, top = cy - 8, bot = cy + 11;
    const tim = dy => `<path class="mf-l" d="M${_mfN(cx)} ${_mfN(bot + dy)} `
      + `C${_mfN(cx - w)} ${_mfN(top + dy + 3)} ${_mfN(cx - w)} ${_mfN(top + dy - 8)} ${_mfN(cx)} ${_mfN(top + dy)} `
      + `C${_mfN(cx + w)} ${_mfN(top + dy - 8)} ${_mfN(cx + w)} ${_mfN(top + dy + 3)} ${_mfN(cx)} ${_mfN(bot + dy)} Z"/>`;
    return tim(0) + tim(8)
      + _mfLine(cx - 12, cy - 7.5, cx - 12, cy + 0.5) + _mfLine(cx + 12, cy - 7.5, cx + 12, cy + 0.5)
      + _mfLine(cx, cy + 11, cx, cy + 19);
  }
  if (kind === 'bat') {                         // cái bát: miệng tròn, thành cong
    const t = 19, b = 10, yt = cy - 10, yb = cy + 16;
    return `<path class="mf-d" d="M${_mfN(cx - t)} ${_mfN(yt)} A ${t} 6 0 0 0 ${_mfN(cx + t)} ${_mfN(yt)}"/>`
      + `<path class="mf-l" d="M${_mfN(cx - t)} ${_mfN(yt)} A ${t} 6 0 0 1 ${_mfN(cx + t)} ${_mfN(yt)}"/>`
      + `<path class="mf-l" d="M${_mfN(cx - t)} ${_mfN(yt)} L${_mfN(cx - b)} ${_mfN(yb)} `
      + `A ${b} 4 0 0 0 ${_mfN(cx + b)} ${_mfN(yb)} L${_mfN(cx + t)} ${_mfN(yt)}"/>`;
  }
  if (kind === 'nem') {                         // cái nêm: lăng trụ đứng tam giác
    const F = [[cx - 24, cy + 13], [cx + 19, cy + 13], [cx - 24, cy - 6]];
    const B = F.map(p => [p[0] + 12, p[1] - 9]);
    return _mfPoly(F, 'mf-l mf-tri')
      + _mfLine(F[1][0], F[1][1], B[1][0], B[1][1]) + _mfLine(F[2][0], F[2][1], B[2][0], B[2][1])
      + _mfLine(B[1][0], B[1][1], B[2][0], B[2][1])
      + _mfLine(F[0][0], F[0][1], B[0][0], B[0][1], 'mf-d')
      + _mfLine(B[0][0], B[0][1], B[1][0], B[1][1], 'mf-d')
      + _mfLine(B[0][0], B[0][1], B[2][0], B[2][1], 'mf-d');
  }
  const D = [[cx - 22, cy + 14], [cx + 12, cy + 14], [cx + 24, cy + 4], [cx - 10, cy + 4]];
  const T = D.map(p => [p[0], p[1] - 18]);
  let out = '';
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const hid = (i === 2 || i === 3) ? 'mf-d' : null;
    out += _mfLine(D[i][0], D[i][1], D[j][0], D[j][1], hid)
      + _mfLine(T[i][0], T[i][1], T[j][0], T[j][1])
      + _mfLine(D[i][0], D[i][1], T[i][0], T[i][1], i === 3 ? 'mf-d' : null);
  }
  return out;
}

function _mfqChonKhoi(f) {
  const ks = Array.isArray(f.khoi) ? f.khoi : [];
  return _mfKhung4(ks.map(k => ({ k })), f.cap, (h, ox, oy) => _mfKhoi(h.k, ox + 50, oy + 22));
}

// ---- bảng số liệu ------------------------------------------------------
// Hai câu Chương 5 cho dữ liệu bằng một cái BẢNG, và cái bảng ấy là toàn bộ
// đề. Bảng dựng bằng SVG chứ không cắt ảnh: chữ vẫn sắc, vẫn đổi màu theo
// theme, vẫn đọc được khi mất mạng. Bảng XOAY DỌC (mỗi mục một hàng) vì màn
// hình điện thoại cao hơn là rộng — năm cột chữ Việt xếp ngang thì cột nào
// cũng cụt mất một nửa.
//   { "t":"bang", "cot":["Học sinh","Điểm"], "hang":[["Minh","8"], …] }
function _mfqBang(f) {
  const cot = (Array.isArray(f.cot) ? f.cot : []).map(String);
  const hang = (Array.isArray(f.hang) ? f.hang : [])
    .map(r => (Array.isArray(r) ? r : [r]).map(x => (x == null ? '' : String(x))));
  if (cot.length < 2 || !hang.length) return '';
  const rows = [cot].concat(hang), n = cot.length, W = 176;
  const rong = [];
  for (let c = 0; c < n; c++) {
    let m = 0;
    rows.forEach(r => { m = Math.max(m, [...(r[c] || '')].length); });
    rong.push(m * 5.4 + 12);
  }
  const tong = rong.reduce((a, b) => a + b, 0);
  // Bảng nào chữ dài quá khổ thì CO CHỮ lại cho vừa ô, chứ không để chữ tràn
  // ra ngoài đường kẻ — một cái tiêu đề bị cắt cụt thì bảng mất luôn nghĩa.
  const k = Math.min(W / tong, 1.6);
  const w = rong.map(v => v * k), rongTong = tong * k;
  const co = Math.min(10, 10 * W / tong);
  const x0 = (200 - rongTong) / 2, yTop = 8, yBot = 112, h = (yBot - yTop) / rows.length;
  let out = '';
  for (let i = 0; i <= rows.length; i++) out += _mfLine(x0, yTop + i * h, x0 + rongTong, yTop + i * h, 'mf-l mf-w');
  let x = x0;
  for (let c = 0; c <= n; c++) { out += _mfLine(x, yTop, x, yBot, 'mf-l mf-w'); x += w[c] || 0; }
  rows.forEach((r, i) => {
    let cx = x0;
    for (let c = 0; c < n; c++) {
      if (r[c]) {
        out += `<text class="mf-t${i ? ' mf-cap' : ''}" x="${_mfN(cx + w[c] / 2)}" `
          + `y="${_mfN(yTop + i * h + h / 2 + co * 0.35)}" text-anchor="middle" `
          + `style="font-size:${_mfN(co)}px">${r[c]}</text>`;
      }
      cx += w[c];
    }
  });
  return out;
}

// ---- hai bình nước -----------------------------------------------------
// Câu "đổ nước từ bình 1 sang bình 2": ba số đo của bình 2 (21, 28, 35 cm)
// CHỈ có trên hình, đề bài không hề nhắc — không có hình thì câu này không
// giải được. Bình 2 là lăng trụ đứng có đáy tam giác vuông nằm NGANG, miệng
// quay lên; vẽ đúng thế đứng ấy thì bé mới thấy vì sao diện tích đáy là
// 21·28/2 còn chiều cao là quãng nước dâng lên.
function _mfqHaiBinhNuoc(f) {
  const b1 = f.b1 || {}, b2 = f.b2 || {};
  const D = [[8, 104], [52, 104], [64, 94], [20, 94]];
  const T = D.map(p => [p[0], p[1] - 44]);
  const W = D.map(p => [p[0], p[1] - 40]);
  let out = '';
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out += _mfLine(D[i][0], D[i][1], D[j][0], D[j][1], (i === 2 || i === 3) ? 'mf-d' : null)
      + _mfLine(T[i][0], T[i][1], T[j][0], T[j][1])
      + _mfLine(D[i][0], D[i][1], T[i][0], T[i][1], i === 3 ? 'mf-d' : null);
  }
  out += _mfPoly(W, 'mf-box mf-b');
  const t = [[90, 44], [154, 32], [120, 64]];
  const b = t.map(p => [p[0], p[1] + 40]);
  const w = t.map(p => [p[0], p[1] + 12]);
  out += _mfPoly(t, 'mf-l mf-tri')
    + _mfLine(t[0][0], t[0][1], b[0][0], b[0][1]) + _mfLine(t[1][0], t[1][1], b[1][0], b[1][1])
    + _mfLine(t[2][0], t[2][1], b[2][0], b[2][1])
    + _mfLine(b[0][0], b[0][1], b[2][0], b[2][1]) + _mfLine(b[2][0], b[2][1], b[1][0], b[1][1])
    + _mfLine(b[0][0], b[0][1], b[1][0], b[1][1], 'mf-d')
    + _mfPoly(w, 'mf-box mf-b')
    + _mfCorner(t[2], t[0], t[1], 9)
    + _mfLine(159, t[1][1], 159, w[1][1], 'mf-tick mf-a')
    + _mfLine(156, t[1][1], 162, t[1][1], 'mf-tick mf-a')
    + _mfLine(156, w[1][1], 162, w[1][1], 'mf-tick mf-a');
  const put = (x, y, s, an) => (s ? _mfT(x, y, String(s), an, 'mf-val mf-b') : '');
  const day = b2.day || [];
  return out
    + put(36, 44, b1.canh, 'middle') + put(122, 20, day[0], 'middle')
    + put(88, 112, day[1], 'middle') + put(156, 102, day[2], 'start')
    + put(196, 40, b2.hut, 'end')
    + _mfT(30, 118, String(b1.ten || 'Bình 1'), 'middle', 'mf-cap')
    + _mfT(124, 118, String(b2.ten || 'Bình 2'), 'middle', 'mf-cap');
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
  'duong-xien': _mfqDuongXien,
  'dong-quy': _mfqDongQuy,
  'hop-chu-nhat': _mfqHinhHop,
  'lap-phuong': _mfqHinhHop,
  'lang-tru-tam-giac': _mfqLangTru,
  'lang-tru-tu-giac': _mfqLangTru,
  'cat-tuyen': _mfqCatTuyen,
  'cat-hai-duong': _mfqCatHaiDuong,
  'chon-song-song': _mfqChonSongSong,
  'bon-goc': _mfqBonGoc,
  'chon-khoi': _mfqChonKhoi,
  'bang': _mfqBang,
  'hai-binh-nuoc': _mfqHaiBinhNuoc,
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
