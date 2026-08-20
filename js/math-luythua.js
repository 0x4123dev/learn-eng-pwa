// math-luythua.js — Ôn tập chương 1&2: 20 câu công thức lũy thừa + 20 bài tính căn.
//
// Một menu riêng trong Luyện tập (Toán 7 · Học kì 1), tách khỏi ngân hàng 5
// chương của math-data.js. Một lượt hỏi đủ cả 40 câu (chỉ xáo thứ tự):
// mục tiêu là thuộc TRỌN bảng lũy thừa và tính nhuyễn căn bậc hai của các số
// chính phương, không phải rút 10 câu ngẫu nhiên như lượt của các chương.
//
// Nửa đầu — 20 câu trắc nghiệm phủ 8 công thức trong bảng LŨY THỪA
// (mỗi công thức có câu nhận diện + câu áp dụng số):
//   x⁰ = 1 (x ≠ 0)      x¹ = x
//   xᵐ · xⁿ = xᵐ⁺ⁿ      xᵐ : xⁿ = xᵐ⁻ⁿ
//   (xᵐ)ⁿ = xᵐⁿ         (xy)ⁿ = xⁿyⁿ
//   (x/y)ⁿ = xⁿ/yⁿ      x⁻ⁿ = 1/xⁿ
//
// Nửa sau — 20 câu type:'calc' (bé tự tính rồi gõ đáp số trên keypad):
// √4 … √625 qua 20 số chính phương, xen kẽ dạng "Tính √n" và "x² = n".
//
// Cùng schema với MATH_QUESTIONS để tái dùng nguyên khung quiz, keypad,
// retry drill và bảng "câu hay sai". `ch` là chuỗi 'lt12' — các pin đếm theo
// chương 1–5 không đụng tới gói này. Bất biến (40 câu, 4 lựa chọn/MCQ, đáp án
// rải đều A–D, 🔑 + ✗, đáp số căn đúng bình phương) được khóa trong
// tests/math-luythua.test.js.

const MATH_LT_CHAPTER = 'lt12';
const MATH_LT_LABEL = 'Ôn tập chương 1&2 · Lũy thừa & Căn bậc hai';

const MATH_LT_QUESTIONS = [
  {
    id: 'mlt-1', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Với x ≠ 0, x⁰ bằng bao nhiêu?',
    options: ['0', '1', 'x', '−1'],
    correct: 1, answer: '1',
    explanation: '🔑 Quy ước: mọi số khác 0 có số mũ 0 đều bằng 1, nên x⁰ = 1. Ví dụ 9⁰ = 1, (−5)⁰ = 1.<br>✗ 0: nhầm số mũ 0 thành kết quả 0.<br>✗ x: đó là x¹, vì x¹ = x.<br>✗ −1: không quy ước nào cho ra −1.'
  },
  {
    id: 'mlt-2', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'x¹ bằng bao nhiêu?',
    options: ['x', '1', '0', 'x·x'],
    correct: 0, answer: 'x',
    explanation: '🔑 Số mũ 1 giữ nguyên cơ số: x¹ = x. Ví dụ 7¹ = 7.<br>✗ 1: đó là x⁰ (với x ≠ 0).<br>✗ 0: không công thức nào cho ra 0.<br>✗ x·x: đó là x².'
  },
  {
    id: 'mlt-3', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Nhân hai lũy thừa cùng cơ số: xᵐ · xⁿ = ?',
    options: ['xᵐⁿ', 'xᵐ⁻ⁿ', 'xᵐ⁺ⁿ', '(x·x)ᵐ⁺ⁿ'],
    correct: 2, answer: 'xᵐ⁺ⁿ',
    explanation: '🔑 Nhân hai lũy thừa cùng cơ số: giữ nguyên cơ số, CỘNG hai số mũ — xᵐ · xⁿ = xᵐ⁺ⁿ.<br>✗ xᵐⁿ: nhân số mũ là công thức của (xᵐ)ⁿ.<br>✗ xᵐ⁻ⁿ: trừ số mũ là công thức của phép chia.<br>✗ (x·x)ᵐ⁺ⁿ: cơ số phải giữ nguyên là x.'
  },
  {
    id: 'mlt-4', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Chia hai lũy thừa cùng cơ số (x ≠ 0): xᵐ : xⁿ = ?',
    options: ['xᵐ⁺ⁿ', 'xⁿ⁻ᵐ', 'xᵐⁿ', 'xᵐ⁻ⁿ'],
    correct: 3, answer: 'xᵐ⁻ⁿ',
    explanation: '🔑 Chia hai lũy thừa cùng cơ số: giữ nguyên cơ số, TRỪ số mũ (mũ của số bị chia trừ mũ của số chia) — xᵐ : xⁿ = xᵐ⁻ⁿ.<br>✗ xᵐ⁺ⁿ: cộng số mũ là công thức của phép nhân.<br>✗ xⁿ⁻ᵐ: trừ ngược thứ tự, số mũ bị trái dấu.<br>✗ xᵐⁿ: nhân số mũ là công thức của (xᵐ)ⁿ.'
  },
  {
    id: 'mlt-5', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Lũy thừa của lũy thừa: (xᵐ)ⁿ = ?',
    options: ['xᵐ⁺ⁿ', 'xᵐⁿ', 'xᵐ⁻ⁿ', 'xᵐ + xⁿ'],
    correct: 1, answer: 'xᵐⁿ',
    explanation: '🔑 Lũy thừa của lũy thừa: giữ nguyên cơ số, NHÂN hai số mũ — (xᵐ)ⁿ = xᵐⁿ.<br>✗ xᵐ⁺ⁿ: cộng số mũ là công thức của xᵐ · xⁿ.<br>✗ xᵐ⁻ⁿ: trừ số mũ là công thức của phép chia.<br>✗ xᵐ + xⁿ: lũy thừa không tách được thành tổng.'
  },
  {
    id: 'mlt-6', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Lũy thừa của một tích: (xy)ⁿ = ?',
    options: ['xⁿyⁿ', 'xyⁿ', 'xⁿ + yⁿ', '(x + y)ⁿ'],
    correct: 0, answer: 'xⁿyⁿ',
    explanation: '🔑 Lũy thừa của một tích: MỖI thừa số đều được nâng lên mũ n — (xy)ⁿ = xⁿyⁿ.<br>✗ xyⁿ: chỉ y có mũ, quên mất mũ của x.<br>✗ xⁿ + yⁿ: tích không biến thành tổng.<br>✗ (x + y)ⁿ: đề bài là tích xy, không phải tổng x + y.'
  },
  {
    id: 'mlt-7', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Lũy thừa của một thương (y ≠ 0): (x/y)ⁿ = ?',
    options: ['x/yⁿ', 'xⁿ/y', 'xⁿ − yⁿ', 'xⁿ/yⁿ'],
    correct: 3, answer: 'xⁿ/yⁿ',
    explanation: '🔑 Lũy thừa của một thương: CẢ tử và mẫu đều được nâng lên mũ n — (x/y)ⁿ = xⁿ/yⁿ.<br>✗ x/yⁿ: quên mất mũ của tử.<br>✗ xⁿ/y: quên mất mũ của mẫu.<br>✗ xⁿ − yⁿ: thương không biến thành hiệu.'
  },
  {
    id: 'mlt-8', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Với x ≠ 0, lũy thừa với số mũ âm: x⁻ⁿ = ?',
    options: ['−xⁿ', '−(1/xⁿ)', '1/xⁿ', 'xⁿ'],
    correct: 2, answer: '1/xⁿ',
    explanation: '🔑 Số mũ âm nghĩa là NGHỊCH ĐẢO của lũy thừa mũ dương: x⁻ⁿ = 1/xⁿ. Ví dụ 2⁻³ = 1/2³ = 1/8.<br>✗ −xⁿ: mũ âm không làm kết quả thành số âm.<br>✗ −(1/xⁿ): cũng không thêm dấu trừ vào nghịch đảo.<br>✗ xⁿ: bỏ mất dấu âm của số mũ.'
  },
  {
    id: 'mlt-9', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '2³ · 2² bằng?',
    options: ['4⁵', '2⁵', '2⁶', '4⁶'],
    correct: 1, answer: '2⁵',
    explanation: '🔑 Nhân cùng cơ số thì cộng số mũ: 2³ · 2² = 2³⁺² = 2⁵ = 32.<br>✗ 4⁵: cơ số phải giữ nguyên là 2, không được nhân 2·2.<br>✗ 2⁶: số mũ là 3 + 2 = 5, không phải 3 · 2.<br>✗ 4⁶: sai cả cơ số lẫn số mũ.'
  },
  {
    id: 'mlt-10', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '5⁶ : 5⁴ bằng bao nhiêu?',
    options: ['5¹⁰', '5²⁴', '1', '25'],
    correct: 3, answer: '25',
    explanation: '🔑 Chia cùng cơ số thì trừ số mũ: 5⁶ : 5⁴ = 5⁶⁻⁴ = 5² = 25.<br>✗ 5¹⁰: cộng số mũ là công thức của phép nhân.<br>✗ 5²⁴: nhân số mũ là công thức của (5⁶)⁴.<br>✗ 1: chỉ khi hai lũy thừa bằng nhau, ví dụ 5⁴ : 5⁴.'
  },
  {
    id: 'mlt-11', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '(3²)³ bằng?',
    options: ['3⁶', '3⁵', '9⁶', '6⁶'],
    correct: 0, answer: '3⁶',
    explanation: '🔑 Lũy thừa của lũy thừa thì nhân số mũ: (3²)³ = 3⁶ (vì 2 · 3 = 6), bằng 729.<br>✗ 3⁵: cộng số mũ là công thức của 3² · 3³.<br>✗ 9⁶: cơ số phải giữ nguyên là 3.<br>✗ 6⁶: không được nhân cơ số với số mũ.'
  },
  {
    id: 'mlt-12', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '(2 · 5)³ được viết thành?',
    options: ['2 · 5³', '2³ + 5³', '2³ · 5³', '(2 + 5)³'],
    correct: 2, answer: '2³ · 5³',
    explanation: '🔑 (xy)ⁿ = xⁿyⁿ nên (2·5)³ = 2³ · 5³ = 8 · 125 = 1000 — đúng bằng 10³.<br>✗ 2 · 5³: quên mất mũ của 2.<br>✗ 2³ + 5³: tích không thành tổng (8 + 125 = 133 ≠ 1000).<br>✗ (2 + 5)³: 7³ = 343 ≠ 1000.'
  },
  {
    id: 'mlt-13', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '(−7)⁰ bằng?',
    options: ['1', '−7', '0', '−1'],
    correct: 0, answer: '1',
    explanation: '🔑 Mọi số khác 0 có số mũ 0 đều bằng 1: (−7)⁰ = 1. Dấu âm của cơ số không làm đổi kết quả.<br>✗ −7: đó là (−7)¹.<br>✗ 0: nhầm số mũ 0 thành kết quả 0.<br>✗ −1: cơ số âm không kéo được dấu trừ ra ngoài.'
  },
  {
    id: 'mlt-14', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '(2/3)² bằng?',
    options: ['4/3', '4/9', '2/9', '4/6'],
    correct: 1, answer: '4/9',
    explanation: '🔑 (x/y)ⁿ = xⁿ/yⁿ nên (2/3)² = 2²/3² = 4/9.<br>✗ 4/3: quên mất mũ của mẫu.<br>✗ 2/9: quên mất mũ của tử.<br>✗ 4/6: mẫu là 3² = 9, không phải 3 · 2.'
  },
  {
    id: 'mlt-15', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '2⁻³ bằng?',
    options: ['−8', '−6', '1/6', '1/8'],
    correct: 3, answer: '1/8',
    explanation: '🔑 x⁻ⁿ = 1/xⁿ nên 2⁻³ = 1/2³ = 1/8.<br>✗ −8: số mũ âm không cho kết quả âm.<br>✗ −6: không được nhân 2 · 3 rồi thêm dấu trừ.<br>✗ 1/6: mẫu là 2³ = 8, không phải 2 · 3.'
  },
  {
    id: 'mlt-16', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Kết quả xᵐ⁺ⁿ là của phép tính nào?',
    options: ['xᵐ · xⁿ', 'xᵐ : xⁿ', '(xᵐ)ⁿ', 'xᵐ + xⁿ'],
    correct: 0, answer: 'xᵐ · xⁿ',
    explanation: '🔑 Cộng số mũ xuất hiện khi NHÂN hai lũy thừa cùng cơ số: xᵐ · xⁿ = xᵐ⁺ⁿ.<br>✗ xᵐ : xⁿ: cho xᵐ⁻ⁿ.<br>✗ (xᵐ)ⁿ: cho xᵐⁿ.<br>✗ xᵐ + xⁿ: phép cộng không gộp được thành một lũy thừa.'
  },
  {
    id: 'mlt-17', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Kết quả xᵐ⁻ⁿ là của phép tính nào (x ≠ 0)?',
    options: ['xᵐ · xⁿ', '(xᵐ)ⁿ', 'xᵐ : xⁿ', 'xⁿ : xᵐ'],
    correct: 2, answer: 'xᵐ : xⁿ',
    explanation: '🔑 Trừ số mũ xuất hiện khi CHIA hai lũy thừa cùng cơ số: xᵐ : xⁿ = xᵐ⁻ⁿ.<br>✗ xᵐ · xⁿ: cho xᵐ⁺ⁿ.<br>✗ (xᵐ)ⁿ: cho xᵐⁿ.<br>✗ xⁿ : xᵐ: cho xⁿ⁻ᵐ, số mũ ngược dấu.'
  },
  {
    id: 'mlt-18', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: '3² · 3⁵ bằng?',
    options: ['9⁷', '3⁷', '3¹⁰', '9¹⁰'],
    correct: 1, answer: '3⁷',
    explanation: '🔑 Nhân cùng cơ số thì cộng số mũ: 3² · 3⁵ = 3²⁺⁵ = 3⁷.<br>✗ 9⁷: cơ số phải giữ nguyên là 3.<br>✗ 3¹⁰: số mũ là 2 + 5 = 7, không phải 2 · 5.<br>✗ 9¹⁰: sai cả cơ số lẫn số mũ.'
  },
  {
    id: 'mlt-19', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Công thức nào dưới đây SAI?',
    options: ['(xy)ⁿ = xⁿyⁿ', '(xᵐ)ⁿ = xᵐⁿ', 'x⁰ = 1 (x ≠ 0)', 'xᵐ : xⁿ = xᵐⁿ'],
    correct: 3, answer: 'xᵐ : xⁿ = xᵐⁿ',
    explanation: '🔑 Chia hai lũy thừa cùng cơ số phải TRỪ số mũ: xᵐ : xⁿ = xᵐ⁻ⁿ — viết xᵐⁿ là sai.<br>✗ (xy)ⁿ = xⁿyⁿ: công thức đúng — lũy thừa của một tích.<br>✗ (xᵐ)ⁿ = xᵐⁿ: công thức đúng — lũy thừa của lũy thừa.<br>✗ x⁰ = 1: công thức đúng — quy ước với x ≠ 0.'
  },
  {
    id: 'mlt-20', ch: MATH_LT_CHAPTER, topic: 'Lũy thừa',
    q: 'Viết 1/x⁴ (x ≠ 0) dưới dạng lũy thừa của x:',
    options: ['x⁴', '−x⁴', 'x⁻⁴', '−x⁻⁴'],
    correct: 2, answer: 'x⁻⁴',
    explanation: '🔑 1/xⁿ = x⁻ⁿ nên 1/x⁴ = x⁻⁴.<br>✗ x⁴: là nghịch đảo của 1/x⁴, không bằng nó.<br>✗ −x⁴: phân số 1/x⁴ không mang dấu trừ.<br>✗ −x⁻⁴: số mũ âm không sinh thêm dấu trừ.'
    },

  // ---- 20 bài tính căn bậc hai (type:'calc' — gõ đáp số trên keypad) ----
  {
    id: 'mlt-c1', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √4',
    answer: '2', accept: [], keys: [],
    explanation: '🔑 √4 = 2 vì 2² = 4 và 2 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c2', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √9',
    answer: '3', accept: [], keys: [],
    explanation: '🔑 √9 = 3 vì 3² = 9 và 3 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c3', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √16',
    answer: '4', accept: [], keys: [],
    explanation: '🔑 √16 = 4 vì 4² = 16 và 4 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c4', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tìm x > 0 biết x² = 25. Vậy x = ?',
    answer: '5', accept: [], keys: [],
    explanation: '🔑 x > 0 và x² = 25 thì x = √25 = 5, vì 5² = 25.'
  },
  {
    id: 'mlt-c5', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √36',
    answer: '6', accept: [], keys: [],
    explanation: '🔑 √36 = 6 vì 6² = 36 và 6 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c6', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √49',
    answer: '7', accept: [], keys: [],
    explanation: '🔑 √49 = 7 vì 7² = 49 và 7 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c7', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √64',
    answer: '8', accept: [], keys: [],
    explanation: '🔑 √64 = 8 vì 8² = 64 và 8 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c8', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √81',
    answer: '9', accept: [], keys: [],
    explanation: '🔑 √81 = 9 vì 9² = 81 và 9 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c9', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √100',
    answer: '10', accept: [], keys: [],
    explanation: '🔑 √100 = 10 vì 10² = 100 và 10 > 0 — căn bậc hai số học luôn là số không âm.'
  },
  {
    id: 'mlt-c10', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √121',
    answer: '11', accept: [], keys: [],
    explanation: '🔑 √121 = 11 vì 11² = 121 và 11 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 10² = 100 &lt; 121 &lt; 12² = 144, nên thử 11.'
  },
  {
    id: 'mlt-c11', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tìm x > 0 biết x² = 144. Vậy x = ?',
    answer: '12', accept: [], keys: [],
    explanation: '🔑 x > 0 và x² = 144 thì x = √144 = 12, vì 12² = 144.<br>Mẹo ước lượng: 11² = 121 &lt; 144 &lt; 13² = 169, nên thử 12.'
  },
  {
    id: 'mlt-c12', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √169',
    answer: '13', accept: [], keys: [],
    explanation: '🔑 √169 = 13 vì 13² = 169 và 13 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 12² = 144 &lt; 169 &lt; 14² = 196, nên thử 13.'
  },
  {
    id: 'mlt-c13', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √196',
    answer: '14', accept: [], keys: [],
    explanation: '🔑 √196 = 14 vì 14² = 196 và 14 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 13² = 169 &lt; 196 &lt; 15² = 225, nên thử 14.'
  },
  {
    id: 'mlt-c14', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tìm x > 0 biết x² = 225. Vậy x = ?',
    answer: '15', accept: [], keys: [],
    explanation: '🔑 x > 0 và x² = 225 thì x = √225 = 15, vì 15² = 225.<br>Mẹo ước lượng: 14² = 196 &lt; 225 &lt; 16² = 256, nên thử 15.'
  },
  {
    id: 'mlt-c15', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √256',
    answer: '16', accept: [], keys: [],
    explanation: '🔑 √256 = 16 vì 16² = 256 và 16 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 15² = 225 &lt; 256 &lt; 17² = 289, nên thử 16.'
  },
  {
    id: 'mlt-c16', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √289',
    answer: '17', accept: [], keys: [],
    explanation: '🔑 √289 = 17 vì 17² = 289 và 17 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 16² = 256 &lt; 289 &lt; 18² = 324, nên thử 17.'
  },
  {
    id: 'mlt-c17', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tìm x > 0 biết x² = 324. Vậy x = ?',
    answer: '18', accept: [], keys: [],
    explanation: '🔑 x > 0 và x² = 324 thì x = √324 = 18, vì 18² = 324.<br>Mẹo ước lượng: 17² = 289 &lt; 324 &lt; 19² = 361, nên thử 18.'
  },
  {
    id: 'mlt-c18', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √361',
    answer: '19', accept: [], keys: [],
    explanation: '🔑 √361 = 19 vì 19² = 361 và 19 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 18² = 324 &lt; 361 &lt; 20² = 400, nên thử 19.'
  },
  {
    id: 'mlt-c19', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tìm x > 0 biết x² = 400. Vậy x = ?',
    answer: '20', accept: [], keys: [],
    explanation: '🔑 x > 0 và x² = 400 thì x = √400 = 20, vì 20² = 400.<br>Mẹo ước lượng: 19² = 361 &lt; 400 &lt; 21² = 441, nên thử 20.'
  },
  {
    id: 'mlt-c20', ch: MATH_LT_CHAPTER, type: 'calc', topic: 'Căn bậc hai',
    q: 'Tính √625',
    answer: '25', accept: [], keys: [],
    explanation: '🔑 √625 = 25 vì 25² = 625 và 25 > 0 — căn bậc hai số học luôn là số không âm.<br>Mẹo ước lượng: 24² = 576 &lt; 625 &lt; 26² = 676, nên thử 25.'
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_LT_CHAPTER, MATH_LT_LABEL, MATH_LT_QUESTIONS };
}
