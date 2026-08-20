// math-luythua.js — Ôn tập chương 2&3: gói 20 câu chuyên bảng công thức lũy thừa.
//
// Một menu riêng trong Luyện tập (Toán 7 · Học kì 1), tách khỏi ngân hàng 5
// chương của math-data.js: mục tiêu của gói là thuộc TRỌN 8 công thức trong
// bảng LŨY THỪA, nên một lượt hỏi đủ cả 20 câu thay vì rút 10 câu ngẫu nhiên.
//
// 8 công thức được phủ (mỗi công thức có câu nhận diện + câu áp dụng số):
//   x⁰ = 1 (x ≠ 0)      x¹ = x
//   xᵐ · xⁿ = xᵐ⁺ⁿ      xᵐ : xⁿ = xᵐ⁻ⁿ
//   (xᵐ)ⁿ = xᵐⁿ         (xy)ⁿ = xⁿyⁿ
//   (x/y)ⁿ = xⁿ/yⁿ      x⁻ⁿ = 1/xⁿ
//
// Cùng schema với MATH_QUESTIONS (id/ch/topic/q/options/correct/answer/
// explanation) để tái dùng nguyên khung quiz, retry drill và bảng "câu hay
// sai". `ch` là chuỗi 'lt23' — các pin đếm theo chương 1–5 không đụng tới gói
// này. Bất biến (20 câu, 4 lựa chọn, đáp án rải đều A–D, 🔑 + ✗ đủ 3 ý) được
// khóa trong tests/math-luythua.test.js.

const MATH_LT_CHAPTER = 'lt23';
const MATH_LT_LABEL = 'Ôn tập chương 2&3 · Lũy thừa';

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
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_LT_CHAPTER, MATH_LT_LABEL, MATH_LT_QUESTIONS };
}
