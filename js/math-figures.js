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

function _mfCutBase(parallel) {
  return _mfLine(12, 35, 188, 35)
    + _mfLine(12, 90, 188, 90)
    + _mfLine(55.5, 15, 124.5, 110)
    + (parallel ? _mfPar(12, 35, 188, 35, 0.85) + _mfPar(12, 90, 188, 90, 0.85) : '')
    + _mfT(194, 31, 'a', 'end') + _mfT(194, 86, 'b', 'end') + _mfT(50, 14, 'c', 'end');
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
    + _mfRight(100, 84, 12, 0, 'a') + _mfRight(100, 84, 12, 90, 'a')
    + _mfTicks(40, 84, 100, 84, 1, 'b') + _mfTicks(100, 84, 160, 84, 1, 'b')
    + _mfTicks(100, 30, 40, 84, 2, 'c') + _mfTicks(100, 30, 160, 84, 2, 'c')
    + _mfDot(40, 84) + _mfDot(100, 84) + _mfDot(160, 84) + _mfDot(100, 30)
    + _mfT(34, 89, 'A', 'end') + _mfT(93, 99, 'M', 'end') + _mfT(166, 89, 'B', 'start')
    + _mfT(109, 34, 'P', 'start') + _mfT(108, 16, 'd', 'start')
    + _mfT(100, 118, 'P trên d ⇒ PA = PB', 'middle', 'mf-cap')),
};

// Trả về '' cho id lạ: một mục từ điển chưa có hình vẫn hiện được định nghĩa
// chứ không làm vỡ cả bảng gợi ý.
function mathFigureHTML(id) {
  if (!id) return '';
  const svg = MATH_FIGURES[id];
  return svg ? `<div class="math-hint-figwrap">${svg}</div>` : '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_FIGURES, mathFigureHTML };
}
