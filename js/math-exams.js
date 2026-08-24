// math-exams.js — Đề thi thử cuối học kì 1 (Toán 7, Tập 1).
//
// Ten 25-question mock papers (HK1 Exam 1..10), modeled on real 2025-2026
// đề cuối kì 1 from five schools (Trần Quý Cáp, Phạm Hữu Lầu, An Điền,
// Tương Bình Hiệp, Lý Thánh Tông): same ma trận shape — 12 nhận-biết
// questions then 13 thông-hiểu/vận-dụng ones — with fresh numbers, authored
// and verified by parallel agents. Question schema matches the practice bank
// (ch/topic/q/options/correct/answer/explanation) plus per-exam n.
//
// Exams are taken in đề order (not shuffled) with no time limit —
// js/math.js startMathExam() runs them through the same quiz UI as practice.

const MATH_EXAMS = [
 {
  "id": "hk1-exam1",
  "title": "HK1 Exam 1",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Tập hợp các số hữu tỉ được kí hiệu bằng chữ nào sau đây?",
    "options": [
     "ℕ",
     "ℤ",
     "ℚ",
     "ℝ"
    ],
    "correct": 2,
    "answer": "ℚ",
    "explanation": "🔑 Tập hợp các số hữu tỉ kí hiệu là ℚ.<br>✗ ℕ: đây là kí hiệu tập hợp số tự nhiên.<br>✗ ℤ: đây là kí hiệu tập hợp số nguyên.<br>✗ ℝ: đây là kí hiệu tập hợp số thực.",
    "source": "hk1-exam1-TN1"
   },
   {
    "n": 2,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Trong bốn số sau, số nào là số hữu tỉ âm?",
    "options": [
     "−4/11",
     "5/9",
     "0",
     "3"
    ],
    "correct": 0,
    "answer": "−4/11",
    "explanation": "🔑 Số hữu tỉ âm là số hữu tỉ nhỏ hơn 0; trong bốn số, chỉ −4/11 nhỏ hơn 0.<br>✗ 5/9: là số hữu tỉ dương vì lớn hơn 0.<br>✗ 0: không phải số hữu tỉ âm cũng không phải số hữu tỉ dương.<br>✗ 3: là số hữu tỉ dương vì lớn hơn 0.",
    "source": "hk1-exam1-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Căn bậc hai số học của số dương a được kí hiệu là gì?",
    "options": [
     "−√a",
     "a²",
     "2√a",
     "√a"
    ],
    "correct": 3,
    "answer": "√a",
    "explanation": "🔑 Căn bậc hai số học của số dương a là √a (số không âm có bình phương bằng a).<br>✗ −√a: đây là số đối của căn bậc hai số học, không phải kí hiệu đúng.<br>✗ a²: đây là bình phương của a, không phải căn bậc hai.<br>✗ 2√a: tự thêm hệ số 2 vào căn bậc hai, không đúng với định nghĩa.",
    "source": "hk1-exam1-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Trong bốn số sau, giá trị tuyệt đối của số nào bằng chính số đó?",
    "options": [
     "−9",
     "6",
     "−1/4",
     "−0,5"
    ],
    "correct": 1,
    "answer": "6",
    "explanation": "🔑 Giá trị tuyệt đối của một số dương bằng chính nó; 6 > 0 nên |6| = 6.<br>✗ −9: là số âm nên |−9| = 9 (số đối), không bằng chính nó.<br>✗ −1/4: là số âm nên |−1/4| = 1/4, không bằng chính nó.<br>✗ −0,5: là số âm nên |−0,5| = 0,5, không bằng chính nó.",
    "source": "hk1-exam1-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 7,483 đến chữ số thập phân thứ nhất, ta được kết quả nào?",
    "options": [
     "7,4",
     "7,48",
     "7,5",
     "7,483"
    ],
    "correct": 2,
    "answer": "7,5",
    "explanation": "🔑 Làm tròn 7,483 đến chữ số thập phân thứ nhất: nhìn chữ số hàng phần trăm là 8 (≥5) nên làm tròn chữ số hàng phần mười 4 lên 5, được 7,5.<br>✗ 7,4: giữ nguyên chữ số hàng phần mười mà không làm tròn lên.<br>✗ 7,48: đây là làm tròn đến chữ số thập phân thứ hai, không đúng yêu cầu.<br>✗ 7,483: đây là giữ nguyên số ban đầu, chưa làm tròn.",
    "source": "hk1-exam1-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Lũy thừa bậc chẵn của một số âm là số như thế nào?",
    "options": [
     "Luôn là số dương",
     "Luôn là số âm",
     "Luôn bằng 0",
     "Có thể dương hoặc âm tùy cơ số"
    ],
    "correct": 0,
    "answer": "Luôn là số dương",
    "explanation": "🔑 Với n chẵn, (−a)ⁿ = aⁿ vì các thừa số âm triệt tiêu dấu theo cặp nên kết quả luôn dương, ví dụ (−2)⁴ = 16.<br>✗ Luôn là số âm: sai vì tích một số chẵn thừa số âm cho kết quả dương.<br>✗ Luôn bằng 0: chỉ đúng khi cơ số bằng 0, không phải luôn luôn.<br>✗ Có thể dương hoặc âm tùy cơ số: sai vì dấu của kết quả chỉ phụ thuộc vào số mũ chẵn hay lẻ, không phụ thuộc độ lớn cơ số.",
    "source": "hk1-exam1-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc đối đỉnh",
    "q": "Hai góc được gọi là đối đỉnh khi nào?",
    "fig": {
     "t": "doi-dinh",
     "a": 50,
     "l": [
      "∠1",
      "",
      "∠3",
      ""
     ]
    },
    "options": [
     "Hai góc có chung một cạnh và tổng bằng 180°",
     "Hai góc có số đo bằng nhau",
     "Hai góc cùng nằm trên một đường thẳng",
     "Mỗi cạnh của góc này là tia đối của một cạnh góc kia"
    ],
    "correct": 3,
    "answer": "Mỗi cạnh của góc này là tia đối của một cạnh góc kia",
    "explanation": "🔑 Định nghĩa: hai góc đối đỉnh là hai góc mà mỗi cạnh của góc này là tia đối của một cạnh góc kia.<br>✗ Hai góc có chung một cạnh và tổng bằng 180°: đây là định nghĩa hai góc kề bù, không phải đối đỉnh.<br>✗ Hai góc có số đo bằng nhau: đây là TÍNH CHẤT (hệ quả), không phải định nghĩa — hai góc bằng nhau chưa chắc đối đỉnh.<br>✗ Hai góc cùng nằm trên một đường thẳng: không phải là định nghĩa của góc đối đỉnh.",
    "source": "hk1-exam1-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠mOn = 96° và Ot là tia phân giác của ∠mOn. Số đo ∠mOt bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 96,
     "names": [
      "m",
      "n",
      "t",
      "O"
     ],
     "lw": "96°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "24°",
     "48°",
     "96°",
     "192°"
    ],
    "correct": 1,
    "answer": "48°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau: ∠mOt = ∠tOn = ½∠mOn = ½ · 96° = 48°.<br>✗ 24°: là ¼ của góc ∠mOn, không phải một nửa.<br>✗ 96°: là số đo cả góc ∠mOn, không phải một nửa.<br>✗ 192°: là gấp đôi ∠mOn (nhân nhầm thay vì chia).",
    "source": "hk1-exam1-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Tiên đề Euclid",
    "q": "Điền cụm từ thích hợp vào chỗ trống: “Qua một điểm M nằm ngoài đường thẳng d, ta vẽ được … đường thẳng đi qua M và song song với d.”",
    "fig": {
     "t": "euclid",
     "m": "point"
    },
    "options": [
     "hai",
     "đúng một",
     "ba",
     "vô số"
    ],
    "correct": 1,
    "answer": "đúng một",
    "explanation": "🔑 Tiên đề Euclid: qua một điểm nằm ngoài một đường thẳng, chỉ vẽ được đúng một đường thẳng song song với đường thẳng đó.<br>✗ hai: sai vì tiên đề khẳng định chỉ có đúng một đường thẳng song song, không phải hai.<br>✗ ba: sai vì không thể có ba đường thẳng cùng đi qua M và đều song song với d.<br>✗ vô số: sai vì đây là số đường thẳng bất kì đi qua M nói chung, không phải riêng các đường song song với d.",
    "source": "hk1-exam1-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Định lí",
    "q": "Định lí “Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì chúng song song với nhau” có giả thiết (GT) là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó cắt nhau",
     "Đường thẳng thứ ba vuông góc với cả hai đường thẳng kia và chúng song song"
    ],
    "correct": 0,
    "answer": "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
    "explanation": "🔑 Một định lí có dạng “Nếu A thì B”: phần GT (giả thiết) là điều cho trước — ở đây là “hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba”; phần KL (kết luận) là điều suy ra — “chúng song song với nhau”.<br>✗ Hai đường thẳng đó song song với nhau: đây là phần KẾT LUẬN, không phải giả thiết.<br>✗ Hai đường thẳng đó cắt nhau: không xuất hiện trong định lí này.<br>✗ Đường thẳng thứ ba vuông góc với cả hai đường thẳng kia và chúng song song: gộp cả GT và KL thành một, không đúng vai trò của giả thiết riêng.",
    "source": "hk1-exam1-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác DEF có ∠D = 48°, ∠E = 97°. Số đo ∠F bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "D",
      "E",
      "F"
     ],
     "angles": {
      "D": "48°",
      "E": "97°",
      "F": "?"
     }
    },
    "options": [
     "45°",
     "55°",
     "65°",
     "35°"
    ],
    "correct": 3,
    "answer": "35°",
    "explanation": "🔑 Tổng ba góc trong tam giác bằng 180°: ∠F = 180° − ∠D − ∠E = 180° − 48° − 97° = 35°.<br>✗ 45°: tính nhầm 180° − 48° − 87° hoặc cộng sai.<br>✗ 55°: lấy nhầm 180° − 48° − 77°.<br>✗ 65°: lấy nhầm 180° − 97° − 18°, một phép trừ sai.",
    "source": "hk1-exam1-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Thu thập dữ liệu",
    "q": "Hoạt động nào sau đây là thu thập dữ liệu?",
    "options": [
     "Quét lớp học",
     "Phỏng vấn từng bạn trong lớp về môn thể thao yêu thích",
     "Ăn sáng trước khi đến trường",
     "Xếp hàng vào lớp"
    ],
    "correct": 1,
    "answer": "Phỏng vấn từng bạn trong lớp về môn thể thao yêu thích",
    "explanation": "🔑 Thu thập dữ liệu là hành động ghi nhận thông tin/số liệu; phỏng vấn từng bạn để ghi lại môn thể thao yêu thích chính là thu thập dữ liệu.<br>✗ Quét lớp học: là việc lao động, không liên quan đến ghi nhận số liệu.<br>✗ Ăn sáng trước khi đến trường: là sinh hoạt cá nhân, không phải thu thập dữ liệu.<br>✗ Xếp hàng vào lớp: là hoạt động thường ngày, không ghi nhận số liệu nào.",
    "source": "hk1-exam1-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Tính chất phép tính",
    "q": "Tính bằng cách hợp lí: 5/9 · 3/7 + 5/9 · 4/7.",
    "options": [
     "5/7",
     "1",
     "5/9",
     "9/5"
    ],
    "correct": 2,
    "answer": "5/9",
    "explanation": "🔑 Áp dụng tính chất phân phối của phép nhân đối với phép cộng: 5/9 · 3/7 + 5/9 · 4/7 = 5/9 · (3/7 + 4/7) = 5/9 · 1 = 5/9.<br>✗ 5/7: nhầm lẫn giữa 5/9 và 3/7 khi rút gọn.<br>✗ 1: tính 3/7 + 4/7 = 1 rồi quên nhân với 5/9.<br>✗ 9/5: viết ngược tử số và mẫu số của 5/9 trong kết quả.",
    "source": "hk1-exam1-TL13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết x + 2/9 = 7/9.",
    "options": [
     "5/9",
     "9/9",
     "9/2",
     "1"
    ],
    "correct": 0,
    "answer": "5/9",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 7/9 − 2/9 = 5/9.<br>✗ 9/9: cộng nhầm 7/9 + 2/9 thay vì trừ.<br>✗ 9/2: viết ngược tử số và mẫu số của kết quả đúng.<br>✗ 1: rút gọn sai 5/9 thành 1.",
    "source": "hk1-exam1-TL14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết x³ = −27.",
    "options": [
     "3",
     "9",
     "−9",
     "−3"
    ],
    "correct": 3,
    "answer": "−3",
    "explanation": "🔑 (−3)³ = (−3)·(−3)·(−3) = −27 nên x = −3.<br>✗ 3: vì 3³ = 27 (dương), không bằng −27.<br>✗ 9: đây là (−3)² chứ không phải (−3)³.<br>✗ −9: tính nhầm (−3)·3 thay vì (−3)³.",
    "source": "hk1-exam1-TL15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Một cửa hàng bán một chiếc áo với giá gốc 250 000 đồng, sau đó giảm giá 1/5 giá gốc. Hỏi giá bán chiếc áo sau khi giảm giá là bao nhiêu đồng?",
    "options": [
     "50 000 đồng",
     "300 000 đồng",
     "200 000 đồng",
     "225 000 đồng"
    ],
    "correct": 2,
    "answer": "200 000 đồng",
    "explanation": "🔑 Số tiền được giảm = 1/5 · 250 000 = 50 000 (đồng); giá bán sau khi giảm = 250 000 − 50 000 = 200 000 (đồng).<br>✗ 50 000 đồng: đây là số tiền được giảm, chưa trừ vào giá gốc để ra giá bán.<br>✗ 300 000 đồng: cộng nhầm số tiền giảm vào giá gốc thay vì trừ đi.<br>✗ 225 000 đồng: tính nhầm số tiền giảm bằng 1/10 giá gốc (25 000 đồng) thay vì đúng 1/5 (50 000 đồng).",
    "source": "hk1-exam1-TL16"
   },
   {
    "n": 17,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Tính: √64 − |−9| + 1/2 · 6.",
    "options": [
     "4",
     "20",
     "2",
     "−4"
    ],
    "correct": 2,
    "answer": "2",
    "explanation": "🔑 Tính lần lượt: √64 = 8; |−9| = 9; 1/2 · 6 = 3. Vậy 8 − 9 + 3 = 2.<br>✗ 4: cộng nhầm 8+9-3 rồi tính sai thứ tự.<br>✗ 20: cộng cả ba số 8+9+3 thay vì thực hiện đúng phép trừ và cộng.<br>✗ −4: đổi dấu nhầm thành 8−9−3.",
    "source": "hk1-exam1-TL17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết |x − 4| = 6.",
    "options": [
     "x = 10 hoặc x = −2",
     "x = 10",
     "x = −2",
     "x = 2 hoặc x = −10"
    ],
    "correct": 0,
    "answer": "x = 10 hoặc x = −2",
    "explanation": "🔑 |x − 4| = 6 nghĩa là x − 4 = 6 hoặc x − 4 = −6, suy ra x = 10 hoặc x = −2.<br>✗ x = 10: đúng nhưng thiếu trường hợp còn lại x = −2.<br>✗ x = −2: đúng nhưng thiếu trường hợp còn lại x = 10.<br>✗ x = 2 hoặc x = −10: tính sai dấu khi giải từng trường hợp.",
    "source": "hk1-exam1-TL18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Một mảnh vườn hình vuông có diện tích 200 m². Tính độ dài cạnh mảnh vườn (làm tròn kết quả đến chữ số thập phân thứ nhất).",
    "options": [
     "14,0 m",
     "10,0 m",
     "20,0 m",
     "14,1 m"
    ],
    "correct": 3,
    "answer": "14,1 m",
    "explanation": "🔑 Cạnh hình vuông = √diện tích = √200 ≈ 14,142 m; chữ số hàng phần trăm là 4 (nhỏ hơn 5) nên giữ nguyên chữ số hàng phần mười, làm tròn đến chữ số thập phân thứ nhất được 14,1 m.<br>✗ 14,0 m: làm tròn nhầm xuống hàng đơn vị thay vì đến chữ số thập phân thứ nhất.<br>✗ 10,0 m: nhầm √200 với √100.<br>✗ 20,0 m: tính sai, coi cạnh gấp 10 lần thực tế.",
    "source": "hk1-exam1-TL19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Sắp xếp các số √9, |−4|, 7/2, √25 theo thứ tự tăng dần.",
    "options": [
     "|−4| < √9 < 7/2 < √25",
     "√9 < 7/2 < |−4| < √25",
     "√25 < |−4| < 7/2 < √9",
     "7/2 < √9 < |−4| < √25"
    ],
    "correct": 1,
    "answer": "√9 < 7/2 < |−4| < √25",
    "explanation": "🔑 Tính giá trị từng số: √9 = 3; 7/2 = 3,5; |−4| = 4; √25 = 5. Sắp xếp tăng dần: 3 &lt; 3,5 &lt; 4 &lt; 5, tức √9 &lt; 7/2 &lt; |−4| &lt; √25.<br>✗ |−4| &lt; √9 &lt; 7/2 &lt; √25: xếp sai vị trí của |−4| = 4, phải đứng sau 7/2 = 3,5.<br>✗ √25 &lt; |−4| &lt; 7/2 &lt; √9: xếp hoàn toàn ngược (giảm dần thay vì tăng dần).<br>✗ 7/2 &lt; √9 &lt; |−4| &lt; √25: xếp sai vị trí của 7/2 = 3,5 (phải đứng sau √9 = 3).",
    "source": "hk1-exam1-TL20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho hai đường thẳng song song a và b, bị cắt bởi đường thẳng c tại hai điểm phân biệt. Một góc so le trong tạo bởi c và a bằng 62°. Góc kề bù với góc so le trong tương ứng tạo bởi c và b bằng bao nhiêu?",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A3": "62°",
      "B2": "?"
     }
    },
    "options": [
     "62°",
     "28°",
     "118°",
     "180°"
    ],
    "correct": 2,
    "answer": "118°",
    "explanation": "🔑 Vì a ∥ b nên cặp góc so le trong bằng nhau, góc so le trong tạo bởi c và b cũng bằng 62°; góc kề bù với nó là 180° − 62° = 118°.<br>✗ 62°: đây là số đo góc so le trong, chưa lấy kề bù.<br>✗ 28°: tính nhầm 90° − 62° thay vì 180° − 62°.<br>✗ 180°: nhầm lẫn cho rằng góc kề bù luôn bằng góc bẹt, quên trừ đi 62°.",
    "source": "hk1-exam1-TL21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Cho tam giác PQR, gọi K là trung điểm của QR. Trên tia đối của tia KP lấy điểm S sao cho KS = KP. Hãy chọn kết luận đúng.",
    "fig": {
     "t": "doi-tia",
     "v": [
      "Q",
      "R",
      "P",
      "S",
      "K"
     ]
    },
    "options": [
     "△KQS = △KRP theo trường hợp c-g-c",
     "△KQS = △KRP theo trường hợp c-c-c",
     "△KQS = △KPR theo trường hợp g-c-g",
     "△KQS và △KRP không thể kết luận bằng nhau"
    ],
    "correct": 0,
    "answer": "△KQS = △KRP theo trường hợp c-g-c",
    "explanation": "🔑 K là trung điểm QR nên KQ = KR; theo giả thiết KS = KP; ∠QKS và ∠RKP là hai góc đối đỉnh (vì Q, K, R thẳng hàng và P, K, S thẳng hàng) nên bằng nhau. Vậy △KQS = △KRP theo trường hợp c-g-c (góc xen giữa hai cặp cạnh bằng nhau là góc đối đỉnh tại K).<br>✗ △KQS = △KRP theo trường hợp c-c-c: đề bài không cho biết QS = RP hay bất kỳ cặp cạnh thứ ba nào, chỉ có hai cặp cạnh và một góc xen giữa.<br>✗ △KQS = △KPR theo trường hợp g-c-g: ghi sai thứ tự đỉnh tương ứng (S phải ứng với P, không phải R) và không đúng trường hợp đã dùng.<br>✗ △KQS và △KRP không thể kết luận bằng nhau: sai vì đã đủ hai cạnh và góc xen giữa (c-g-c) để kết luận bằng nhau.",
    "source": "hk1-exam1-TL22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác vuông",
    "q": "Một tam giác vuông có độ dài hai cạnh góc vuông lần lượt là x (cm) và 3x (cm) (x > 0), diện tích tam giác bằng 54 cm². Giá trị của x là bao nhiêu?",
    "fig": {
     "t": "tam-giac-vuong",
     "v": [
      "A",
      "B",
      "C"
     ],
     "sides": [
      "3x",
      "x"
     ],
     "area": "S = 54 cm²"
    },
    "options": [
     "9",
     "6",
     "18",
     "3"
    ],
    "correct": 1,
    "answer": "6",
    "explanation": "🔑 Diện tích tam giác vuông = (cạnh góc vuông thứ nhất · cạnh góc vuông thứ hai) : 2 = (x · 3x) : 2 = 3x²/2. Từ 3x²/2 = 54 suy ra x² = 36, mà x > 0 nên x = 6.<br>✗ 9: giải sai phương trình, quên chia 3 sau khi có x² = 36.<br>✗ 18: nhầm x² = 54 · 3 thay vì tính đúng 54 · 2 : 3.<br>✗ 3: lấy nhầm căn bậc hai của 9 thay vì đúng của 36.",
    "source": "hk1-exam1-TL23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng ghi lại số lượt khách tham quan một bảo tàng: tháng 1: 80; tháng 2: 95; tháng 3: 110; tháng 4: 130. Tổng số lượt khách trong 4 tháng đó là bao nhiêu?",
    "fig": { "t": "line-chart", "labels": ["T1", "T2", "T3", "T4"], "values": [80, 95, 110, 130] },
    "options": [
     "405",
     "425",
     "395",
     "415"
    ],
    "correct": 3,
    "answer": "415",
    "explanation": "🔑 Tổng số lượt khách = 80 + 95 + 110 + 130 = 415 (lượt).<br>✗ 405: cộng thiếu hoặc nhầm một số hạng.<br>✗ 425: cộng thừa 10 do tính nhầm một số hạng.<br>✗ 395: cộng thiếu 20, có thể do bỏ sót một chữ số khi cộng.",
    "source": "hk1-exam1-TL24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Lớp 7B có 50 học sinh. Biểu đồ hình quạt tròn về phương tiện đến trường cho biết: đi bộ 20%, xe đạp 36%, xe buýt 24%, còn lại là được người thân đưa đón. Hỏi có bao nhiêu bạn được người thân đưa đón?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Đi bộ", "value": 20 }, { "label": "Xe đạp", "value": 36 }, { "label": "Xe buýt", "value": 24 }, { "label": "Đưa đón", "value": 20, "text": "?" }] },
    "options": [
     "10",
     "12",
     "18",
     "20"
    ],
    "correct": 0,
    "answer": "10",
    "explanation": "🔑 Tỉ lệ phần trăm được người thân đưa đón = 100% − 20% − 36% − 24% = 20%; số bạn tương ứng = 20% · 50 = 10 (bạn).<br>✗ 12: tính nhầm tỉ lệ còn lại thành 24% rồi lấy 24% của 50, nhầm với tỉ lệ đi xe buýt.<br>✗ 18: nhầm lẫn lấy 36% của 50 (tỉ lệ xe đạp) thay vì tỉ lệ còn lại.<br>✗ 20: nhầm đáp số với tỉ lệ phần trăm (20%) mà quên nhân với tổng số học sinh 50.",
    "source": "hk1-exam1-TL25"
   }
  ],
  "report": {
   "structureVsPdf": "25 câu theo ma trận house spec (ch1:7 ch2:7 ch3:5 ch4:3 ch5:3, Q1-12 nhận biết, Q13-25 TL-converted) mirrors the Trần Quý Cáp đề (12 TN + 7 TL, 40/30/30, cùng chủ đề: kí hiệu Q, căn bậc hai, GTTĐ, làm tròn, Tiên đề Euclid, GT/KL định lí, tam giác, biểu đồ; TL Bài5/Bài6/Bài7/Bài2b có bài tương ứng cùng dạng nhưng số mới.",
   "edits": [
    {
     "n": 9,
     "what": "Đổi từ câu thông hiểu \"dấu hiệu KHÔNG đủ\" (4 lựa chọn phải suy luận đúng/sai) sang câu nhận biết đúng mức độ: điền khuyết Tiên đề Euclid, khớp Câu 7 của đề gốc và đúng vị trí nhận biết trong Q1-12."
    },
    {
     "n": 16,
     "what": "Thay bài toán \"chia 90 người theo tỉ lệ 2:3:4\" (vi phạm rule E — tỉ lệ thức/chia tỉ lệ thuộc chương 6 Tập 2, và trùng collisions-1.json) bằng bài toán giảm giá 1/5 trên giá gốc 250 000đ, đáp án 200 000đ — vẫn ch1/Bài toán thực tế/vận dụng, số mới, không dùng tỉ lệ chia phần."
    }
   ]
  }
 },
 {
  "id": "hk1-exam2",
  "title": "HK1 Exam 2",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Cách viết nào sau đây khẳng định đúng số 17 là một số hữu tỉ?",
    "options": [
     "17 ∈ ℚ",
     "17 ∈ ℕ nhưng 17 ∉ ℚ",
     "17 ∉ ℚ",
     "17 ∈ ℤ nhưng 17 ∉ ℚ"
    ],
    "correct": 0,
    "answer": "17 ∈ ℚ",
    "explanation": "🔑 Mọi số nguyên đều là số hữu tỉ vì viết được dưới dạng a/1, nên 17 = 17/1 ∈ ℚ.<br>✗ 17 ∈ ℕ nhưng 17 ∉ ℚ: sai vì 17 vừa là số tự nhiên vừa là số hữu tỉ, không loại trừ nhau.<br>✗ 17 ∉ ℚ: sai vì 17 hoàn toàn viết được dưới dạng a/b nên thuộc ℚ.<br>✗ 17 ∈ ℤ nhưng 17 ∉ ℚ: sai vì mọi số nguyên đều thuộc tập số hữu tỉ ℚ.",
    "source": "hk1-exam2-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Số 0,101101110... có phần thập phân kéo dài mãi nhưng không lặp lại theo chu kì. Số này thuộc loại số nào?",
    "options": [
     "Số hữu tỉ vì viết được dưới dạng thập phân",
     "Số vô tỉ",
     "Số nguyên",
     "Số tự nhiên"
    ],
    "correct": 1,
    "answer": "Số vô tỉ",
    "explanation": "🔑 Số thập phân vô hạn KHÔNG tuần hoàn là số vô tỉ, nên 0,101101110... là số vô tỉ.<br>✗ Số hữu tỉ vì viết được dưới dạng thập phân: sai vì số hữu tỉ chỉ gồm thập phân hữu hạn hoặc vô hạn TUẦN HOÀN.<br>✗ Số nguyên: số nguyên không có phần thập phân.<br>✗ Số tự nhiên: số tự nhiên là số nguyên không âm, không có phần thập phân.",
    "source": "hk1-exam2-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Căn bậc hai số học của 169 bằng bao nhiêu?",
    "options": [
     "−13",
     "26",
     "13",
     "84,5"
    ],
    "correct": 2,
    "answer": "13",
    "explanation": "🔑 Vì 13 ≥ 0 và 13² = 169 nên căn bậc hai số học của 169 là 13.<br>✗ −13: là số đối của căn bậc hai số học, không thỏa điều kiện không âm.<br>✗ 26: nhầm nhân đôi 13 thay vì lấy chính kết quả căn bậc hai.<br>✗ 84,5: là kết quả phép chia 169 : 2, không liên quan đến phép khai căn.",
    "source": "hk1-exam2-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Giá trị tuyệt đối của số −9 là số nào?",
    "options": [
     "−9",
     "0",
     "1/9",
     "9"
    ],
    "correct": 3,
    "answer": "9",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm bằng số đối của nó: |−9| = số đối của −9 = 9.<br>✗ −9: đây là chính số đã cho, không phải giá trị tuyệt đối của nó.<br>✗ 0: chỉ đúng khi số đã cho bằng 0, ở đây số đã cho là −9 ≠ 0.<br>✗ 1/9: nhầm giá trị tuyệt đối với nghịch đảo.",
    "source": "hk1-exam2-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 5,247 đến hàng phần mười, ta được kết quả nào?",
    "options": [
     "5,2",
     "5,3",
     "5,25",
     "5"
    ],
    "correct": 0,
    "answer": "5,2",
    "explanation": "🔑 Chữ số hàng phần mười là 2; chữ số ngay sau đó (hàng phần trăm) là 4 &lt; 5 nên giữ nguyên, làm tròn 5,247 ≈ 5,2.<br>✗ 5,3: làm tròn sai vì đã tăng chữ số hàng phần mười trong khi chữ số bỏ đi là 4, chưa đủ điều kiện tăng.<br>✗ 5,25: đây là làm tròn đến hàng phần trăm, không phải hàng phần mười theo yêu cầu.<br>✗ 5: đã làm tròn đến hàng đơn vị thay vì hàng phần mười.",
    "source": "hk1-exam2-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Với n là số tự nhiên lớn hơn 1, lũy thừa xⁿ được định nghĩa là tích của bao nhiêu thừa số x?",
    "options": [
     "n − 1 thừa số x",
     "n thừa số x",
     "x thừa số n",
     "2n thừa số x"
    ],
    "correct": 1,
    "answer": "n thừa số x",
    "explanation": "🔑 Theo định nghĩa, xⁿ = x · x · … · x (n thừa số x), với n là số tự nhiên lớn hơn 1.<br>✗ n − 1 thừa số x: thiếu một thừa số so với định nghĩa.<br>✗ x thừa số n: nhầm vai trò cơ số x và số mũ n.<br>✗ 2n thừa số x: nhân đôi số thừa số không đúng định nghĩa.",
    "source": "hk1-exam2-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc đối đỉnh",
    "q": "Hai đường thẳng cắt nhau tại O tạo thành hai góc đối đỉnh ∠aOb và ∠cOd. Biết ∠aOb = 63°. Số đo ∠cOd bằng bao nhiêu?",
    "fig": {
     "t": "doi-dinh",
     "a": 63,
     "l": [
      "63°",
      "",
      "?",
      ""
     ]
    },
    "options": [
     "27°",
     "117°",
     "63°",
     "126°"
    ],
    "correct": 2,
    "answer": "63°",
    "explanation": "🔑 Hai góc đối đỉnh thì bằng nhau, nên ∠cOd = ∠aOb = 63°.<br>✗ 27°: đây là 90° − 63°, không phải cách tính góc đối đỉnh.<br>✗ 117°: đây là góc kề bù với 63° (180° − 63°), không phải góc đối đỉnh.<br>✗ 126°: nhầm gấp đôi 63°, không đúng tính chất góc đối đỉnh.",
    "source": "hk1-exam2-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Tia Oz là tia phân giác của ∠xOy, biết ∠xOy = 54°. Số đo ∠xOz bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 54,
     "lw": "54°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "54°",
     "108°",
     "36°",
     "27°"
    ],
    "correct": 3,
    "answer": "27°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau, mỗi góc bằng một nửa góc ban đầu: ∠xOz = 54° : 2 = 27°.<br>✗ 54°: đây là số đo cả góc ∠xOy, không phải một nửa.<br>✗ 108°: nhầm nhân đôi 54° thay vì chia đôi.<br>✗ 36°: không liên quan đến phép chia đôi của 54°.",
    "source": "hk1-exam2-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng phân biệt a và b, tạo thành một cặp góc đồng vị đều có số đo 75°. Hai đường thẳng a và b có song song với nhau không?",
    "fig": {
     "t": "cut2",
     "angles": {
      "A1": "75°",
      "B1": "75°"
     }
    },
    "options": [
     "Có, vì một cặp góc đồng vị bằng nhau",
     "Không, vì góc đồng vị phải bằng 90° mới suy ra song song",
     "Không thể kết luận vì thiếu góc so le trong",
     "Có, nhưng chỉ khi c vuông góc với a"
    ],
    "correct": 0,
    "answer": "Có, vì một cặp góc đồng vị bằng nhau",
    "explanation": "🔑 Dấu hiệu nhận biết: nếu một cặp góc đồng vị bằng nhau thì hai đường thẳng đó song song. Ở đây góc đồng vị đều bằng 75° nên a ∥ b.<br>✗ Không, vì góc đồng vị phải bằng 90°: sai, dấu hiệu chỉ cần hai góc đồng vị bằng nhau, không cần bằng 90°.<br>✗ Không thể kết luận vì thiếu góc so le trong: sai, chỉ cần MỘT cặp góc đồng vị bằng nhau là đủ.<br>✗ Có, nhưng chỉ khi c vuông góc với a: thêm điều kiện không cần thiết, dấu hiệu không yêu cầu điều đó.",
    "source": "hk1-exam2-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Định lí",
    "q": "Trong một định lí toán học, điều đã cho biết (dùng làm căn cứ để suy ra điều cần chứng minh) được gọi là gì?",
    "options": [
     "Kết luận",
     "Giả thiết",
     "Chứng minh",
     "Hệ quả"
    ],
    "correct": 1,
    "answer": "Giả thiết",
    "explanation": "🔑 Một định lí gồm hai phần: Giả thiết (điều đã cho biết) và Kết luận (điều suy ra được). Phần điều đã cho biết gọi là giả thiết.<br>✗ Kết luận: là điều SUY RA được từ giả thiết, không phải điều đã cho biết.<br>✗ Chứng minh: là quá trình lập luận để đi từ giả thiết đến kết luận, không phải một phần của phát biểu định lí.<br>✗ Hệ quả: là định lí được suy ra trực tiếp từ một định lí khác, không phải tên gọi của phần đã cho biết.",
    "source": "hk1-exam2-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác ABC có ∠A = 75°, ∠B = 45°. Số đo ∠C bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "A": "75°",
      "B": "45°",
      "C": "?"
     }
    },
    "options": [
     "70°",
     "80°",
     "60°",
     "50°"
    ],
    "correct": 2,
    "answer": "60°",
    "explanation": "🔑 Tổng ba góc của một tam giác bằng 180°: ∠C = 180° − 75° − 45° = 60°.<br>✗ 70°: tính sai hiệu do chỉ trừ một góc trong hai góc đã cho.<br>✗ 80°: cộng trừ nhầm giữa hai góc đã cho rồi tính sai kết quả.<br>✗ 50°: trừ nhầm 180° − 75° − 45° do tính toán sai bước.",
    "source": "hk1-exam2-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Số quyển sách mỗi bạn trong lớp 7E mượn ở thư viện trong một tháng là loại dữ liệu nào?",
    "options": [
     "Định tính (không là số)",
     "Không phải là dữ liệu",
     "Định tính có thể sắp thứ tự",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Số quyển sách mượn được biểu diễn bằng số nên đây là dữ liệu định lượng.<br>✗ Định tính (không là số): sai vì số quyển sách là một con số đếm được.<br>✗ Không phải là dữ liệu: sai vì đây là thông tin thu thập được từ các bạn học sinh, hoàn toàn là dữ liệu.<br>✗ Định tính có thể sắp thứ tự: sai vì dữ liệu định tính chỉ dùng cho các giá trị KHÔNG phải số.",
    "source": "hk1-exam2-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Thực hiện phép tính: 3/4 + 5/6 − 7/12.",
    "options": [
     "1",
     "2",
     "1/2",
     "7/12"
    ],
    "correct": 0,
    "answer": "1",
    "explanation": "🔑 Quy đồng mẫu chung 12: 3/4 = 9/12, 5/6 = 10/12, 7/12 giữ nguyên. Tính: 9/12 + 10/12 − 7/12 = 12/12 = 1.<br>✗ 2: cộng nhầm cả ba tử số 9, 10, 7 với nhau rồi tính sai.<br>✗ 1/2: quy đồng sai mẫu số chung của ba phân số.<br>✗ 7/12: quên cộng hai phân số đầu, chỉ lấy kết quả phân số cuối.",
    "source": "hk1-exam2-TL1a"
   },
   {
    "n": 14,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Thực hiện phép tính: 1 1/5 · √(5²/4) + √((−5)²/4) · 2 2/5 − 2²/|−4|.",
    "options": [
     "9",
     "8",
     "7",
     "10"
    ],
    "correct": 1,
    "answer": "8",
    "explanation": "🔑 √(5²/4) = √(25/4) = 5/2 và √((−5)²/4) = √(25/4) = 5/2. Tính: 1 1/5 · 5/2 = 6/5 · 5/2 = 3; 5/2 · 2 2/5 = 5/2 · 12/5 = 6; 2²/|−4| = 4/4 = 1. Kết quả: 3 + 6 − 1 = 8.<br>✗ 9: quên trừ số hạng cuối (4/4 = 1), chỉ cộng 3 + 6.<br>✗ 7: tính nhầm 2²/|−4| = 2 thay vì 1 rồi lấy 3 + 6 − 2.<br>✗ 10: cộng nhầm cả ba số hạng 3 + 6 + 1 thay vì trừ số hạng cuối.",
    "source": "hk1-exam2-TL1b"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: 1 1/2 + x = 5/2.",
    "options": [
     "4",
     "2",
     "1",
     "1/2"
    ],
    "correct": 2,
    "answer": "1",
    "explanation": "🔑 Chuyển 1 1/2 (= 3/2) sang vế phải và đổi dấu: x = 5/2 − 3/2 = 1.<br>✗ 4: cộng nhầm hai vế thay vì trừ (5/2 + 3/2 = 4).<br>✗ 2: quy đồng sai mẫu số khi trừ hai phân số.<br>✗ 1/2: trừ nhầm tử số mà quên quy đồng đúng mẫu.",
    "source": "hk1-exam2-TL2a"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết: 2x − 5/9 = (1/3)².",
    "options": [
     "2/3",
     "4/9",
     "2/9",
     "1/3"
    ],
    "correct": 3,
    "answer": "1/3",
    "explanation": "🔑 (1/3)² = 1/9. Chuyển vế: 2x = 1/9 + 5/9 = 6/9 = 2/3. Suy ra x = (2/3) : 2 = 1/3.<br>✗ 2/3: quên chia cho 2, dừng lại ở giá trị của 2x.<br>✗ 4/9: tính sai (1/3)² thành 1/3 rồi cộng nhầm 1/3 + 5/9 = 8/9, chia 2 ra 4/9.<br>✗ 2/9: trừ nhầm 5/9 − 1/9 = 4/9 thay vì cộng, rồi chia 2 ra 2/9.",
    "source": "hk1-exam2-TL2b"
   },
   {
    "n": 17,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x − 2/9| = (4/3)² − 1.",
    "options": [
     "x = 1 hoặc x = −5/9",
     "x = 1 (chỉ một giá trị)",
     "x = 7/9 hoặc x = −7/9",
     "x = 5/9 hoặc x = −1/9"
    ],
    "correct": 0,
    "answer": "x = 1 hoặc x = −5/9",
    "explanation": "🔑 (4/3)² − 1 = 16/9 − 9/9 = 7/9. Với |x − 2/9| = 7/9, có hai trường hợp: x − 2/9 = 7/9 ⇒ x = 1; hoặc x − 2/9 = −7/9 ⇒ x = −5/9.<br>✗ x = 1 (chỉ một giá trị): bỏ sót trường hợp âm của giá trị tuyệt đối.<br>✗ x = 7/9 hoặc x = −7/9: nhầm giá trị của biểu thức trong dấu GTTĐ với chính giá trị x, quên cộng thêm 2/9.<br>✗ x = 5/9 hoặc x = −1/9: tính sai (4/3)² thành 4/3 rồi lấy 4/3 − 1 = 1/3, cộng/trừ 2/9 theo hai trường hợp cho kết quả sai này.",
    "source": "hk1-exam2-TL2c"
   },
   {
    "n": 18,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Một cửa hàng điện máy bán một chiếc laptop với giá niêm yết 18 triệu đồng. Nhân dịp khai trương, cửa hàng giảm giá 20% so với giá niêm yết. Hỏi khách hàng phải trả bao nhiêu tiền khi mua chiếc laptop đó?",
    "options": [
     "16 triệu đồng",
     "14,4 triệu đồng",
     "3,6 triệu đồng",
     "21,6 triệu đồng"
    ],
    "correct": 1,
    "answer": "14,4 triệu đồng",
    "explanation": "🔑 Số tiền được giảm là 18 × 20% = 3,6 triệu đồng. Giá phải trả = 18 − 3,6 = 14,4 triệu đồng.<br>✗ 16 triệu đồng: tính nhầm mức giảm là 2 triệu thay vì 3,6 triệu.<br>✗ 3,6 triệu đồng: đây chỉ là số tiền ĐƯỢC GIẢM, chưa trừ vào giá niêm yết.<br>✗ 21,6 triệu đồng: cộng nhầm số tiền giảm vào giá niêm yết thay vì trừ đi.",
    "source": "hk1-exam2-TL3a"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh vườn hình vuông có diện tích 196 m². Tính chu vi mảnh vườn đó.",
    "options": [
     "98 m",
     "14 m",
     "56 m",
     "784 m"
    ],
    "correct": 2,
    "answer": "56 m",
    "explanation": "🔑 Cạnh mảnh vườn là căn bậc hai số học của diện tích: √196 = 14 (m). Chu vi hình vuông = 4 × cạnh = 4 × 14 = 56 (m).<br>✗ 98 m: tính sai, không qua đúng bước tính cạnh rồi nhân 4.<br>✗ 14 m: đây là ĐỘ DÀI CẠNH, chưa nhân với 4 để ra chu vi.<br>✗ 784 m: nhân nhầm diện tích với 4 (196 × 4) thay vì tính cạnh trước.",
    "source": "hk1-exam2-TL3b"
   },
   {
    "n": 20,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Một vòi nước chảy trong 1 giờ được 2/5 bể; một vòi nước khác chảy trong 1 giờ được 3/10 bể. Nếu mở đồng thời cả hai vòi trong 1 giờ thì được bao nhiêu phần bể nước?",
    "options": [
     "1/2 bể",
     "1/10 bể",
     "2/5 bể",
     "7/10 bể"
    ],
    "correct": 3,
    "answer": "7/10 bể",
    "explanation": "🔑 Quy đồng mẫu số chung 10: 2/5 = 4/10. Lượng nước hai vòi chảy được trong 1 giờ: 4/10 + 3/10 = 7/10 (bể).<br>✗ 1/2 bể: quên quy đồng 2/5 thành 4/10, cộng nhầm tử số 2 với 3 trên mẫu chung 10: (2 + 3)/10 = 5/10 = 1/2.<br>✗ 1/10 bể: trừ hai phân số thay vì cộng: 4/10 − 3/10 = 1/10.<br>✗ 2/5 bể: quên cộng phần của vòi thứ hai, chỉ lấy kết quả của vòi thứ nhất.",
    "source": "hk1-exam2-TL3c"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho hai đường thẳng a ∥ b cùng bị cắt bởi đường thẳng c. Tại giao điểm của c với a có một góc bằng 64°. Gọi α là góc so le trong với góc đó tại giao điểm của c với b. Tính số đo góc kề bù với α.",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A3": "64°",
      "B1": "α",
      "B2": "?"
     }
    },
    "options": [
     "116°",
     "64°",
     "26°",
     "128°"
    ],
    "correct": 0,
    "answer": "116°",
    "explanation": "🔑 Vì a ∥ b nên hai góc so le trong bằng nhau: α = 64°. Góc kề bù với α có số đo 180° − 64° = 116°.<br>✗ 64°: đây là số đo của α, chưa lấy kề bù.<br>✗ 26°: tính nhầm 90° − 64° thay vì 180° − 64°.<br>✗ 128°: nhân đôi 64° thay vì lấy kề bù theo công thức 180° − α.",
    "source": "hk1-exam2-TL4"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "△DEF và △GHK có DE = GH, ∠D = ∠G, DF = GK. Hai tam giác bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "D",
       "E",
       "F"
      ],
      [
       "G",
       "H",
       "K"
      ]
     ]
    },
    "options": [
     "góc – cạnh – góc (g-c-g)",
     "cạnh – góc – cạnh (c-g-c)",
     "cạnh – cạnh – cạnh (c-c-c)",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "cạnh – góc – cạnh (c-g-c)",
    "explanation": "🔑 ∠D nằm xen giữa hai cạnh DE và DF (tương ứng ∠G xen giữa GH và GK), cùng với DE = GH, DF = GK, đủ điều kiện trường hợp cạnh - góc - cạnh (c-g-c).<br>✗ góc – cạnh – góc: g-c-g cần hai góc và cạnh xen giữa hai góc đó, ở đây chỉ có một góc được cho.<br>✗ cạnh – cạnh – cạnh: c-c-c cần ba cặp cạnh bằng nhau, ở đây chỉ có hai cặp cạnh.<br>✗ Không đủ dữ kiện để kết luận: sai vì dữ kiện đã đủ cho trường hợp c-g-c.",
    "source": "hk1-exam2-TL5a"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "△ABC cân tại A có ∠B = 68°. Số đo góc ở đỉnh A bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "B": "68°",
      "A": "?"
     }
    },
    "options": [
     "68°",
     "56°",
     "44°",
     "112°"
    ],
    "correct": 2,
    "answer": "44°",
    "explanation": "🔑 Tam giác cân tại A nên ∠B = ∠C = 68°. Tổng ba góc bằng 180°: ∠A = 180° − 68° − 68° = 44°.<br>✗ 68°: nhầm góc ở đỉnh A với góc ở đáy B hoặc C.<br>✗ 56°: tính sai bước lấy 180° trừ tổng hai góc đáy.<br>✗ 112°: cộng nhầm hai góc đáy thay vì lấy 180° trừ đi tổng hai góc đáy.",
    "source": "hk1-exam2-TL5b"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ quạt tròn về hình thức giải trí yêu thích của học sinh khối 7 cho biết: Đọc sách 20%, Chơi thể thao 35%, Xem phim 30%, còn lại là Nghe nhạc. Nghe nhạc chiếm bao nhiêu phần trăm?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Đọc sách", "value": 20 }, { "label": "Thể thao", "value": 35 }, { "label": "Xem phim", "value": 30 }, { "label": "Nghe nhạc", "value": 15, "text": "?" }] },
    "options": [
     "20%",
     "25%",
     "10%",
     "15%"
    ],
    "correct": 3,
    "answer": "15%",
    "explanation": "🔑 Tổng các tỉ lệ trong biểu đồ quạt tròn luôn bằng 100%: Nghe nhạc = 100% − 20% − 35% − 30% = 15%.<br>✗ 20%: nhầm với tỉ lệ của Đọc sách.<br>✗ 25%: cộng trừ sai một trong các tỉ lệ đã cho.<br>✗ 10%: tính sai tổng ba tỉ lệ đã cho trước khi lấy 100% trừ đi.",
    "source": "hk1-exam2-TL6a"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Số lượt xe đạp công cộng được thuê tại một trạm theo từng tháng: tháng 5: 80 lượt; tháng 6: 95 lượt; tháng 7: 130 lượt; tháng 8: 110 lượt. So với tháng liền trước, tháng nào có số lượt thuê GIẢM?",
    "options": [
     "Tháng 8",
     "Tháng 6",
     "Tháng 7",
     "Không có tháng nào giảm"
    ],
    "correct": 0,
    "answer": "Tháng 8",
    "explanation": "🔑 So sánh từng tháng với tháng liền trước: tháng 6 (95) tăng so với tháng 5 (80); tháng 7 (130) tăng so với tháng 6 (95); tháng 8 (110) GIẢM so với tháng 7 (130). Vậy tháng 8 là tháng có số lượt thuê giảm.<br>✗ Tháng 6: tháng 6 có số lượt TĂNG so với tháng 5, không giảm.<br>✗ Tháng 7: tháng 7 có số lượt TĂNG so với tháng 6, không giảm.<br>✗ Không có tháng nào giảm: sai vì tháng 8 giảm so với tháng 7 (110 &lt; 130).",
    "source": "hk1-exam2-TL6b"
   }
  ],
  "report": {
   "structureVsPdf": "25 câu theo đúng EXAM-SPEC (không sao y đề 8TN+5TL của THCS Phạm Hữu Lầu): Q1-12 nhận biết đúng thứ tự chủ đề, quota ch1:7 ch2:7 ch3:5 ch4:3 ch5:3 đạt chính xác, đã bỏ toàn bộ câu hình khối 3D (lăng trụ, hộp chữ nhật) của đề gốc vì ngoài chương trình HK1.",
   "edits": [
    {
     "n": 1,
     "what": "Đổi số 9 → 17 để tránh trùng dữ liệu số với Câu 4 (đề PDF dùng số 9 trong 9/11 và 9,3(05))."
    },
    {
     "n": 9,
     "what": "Đổi góc đồng vị 72° → 75° để tránh trùng với D̂1 = 72° trong bài đường thẳng song song (Câu 4b, đề PDF)."
    },
    {
     "n": 16,
     "what": "Viết lại toàn bộ: đổi hệ số 1,5x → 2x, phân số 1/4 → 5/9, và (1/2)² → (1/3)² để không trùng vế phải (1/2)² của Câu 2b (đề PDF); đáp số mới = 1/3, đã tính lại và kiểm tra 4 nhiễu."
    },
    {
     "n": 17,
     "what": "Viết lại toàn bộ: đổi cơ số (3/2)² → (4/3)² và số trừ 1/4 → 2/9 để không trùng (3/2)² của Câu 2c (đề PDF); đáp số mới = x = 1 hoặc x = −5/9, đã tính lại và kiểm tra 4 nhiễu."
    },
    {
     "n": 20,
     "what": "Thay hoàn toàn câu 'chia 45 công nhân theo tỉ lệ 2:3:4' bằng bài toán cộng hai phân số thực tế (hai vòi nước chảy bể) vì vi phạm quy tắc E — chia theo tỉ lệ a:b:c thuộc tỉ lệ thức/dãy tỉ số bằng nhau (chương 6, Tập 2), ngoài phạm vi HK1 Toán 7; đây cũng là câu bị đánh dấu trùng lặp ở collisions-2.json nên được thay dạng bài mới hoàn toàn thay vì chỉ đổi số."
    }
   ]
  }
 },
 {
  "id": "hk1-exam3",
  "title": "HK1 Exam 3",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Tập hợp số",
    "q": "Khẳng định nào sau đây đúng?",
    "options": [
     "Số 5 là số tự nhiên nhưng không là số nguyên",
     "Mọi số nguyên đều là số hữu tỉ",
     "Mọi số hữu tỉ đều là số nguyên",
     "Số 0 không phải là số hữu tỉ"
    ],
    "correct": 1,
    "answer": "Mọi số nguyên đều là số hữu tỉ",
    "explanation": "🔑 Mỗi số nguyên n đều viết được dưới dạng phân số n/1 nên n là số hữu tỉ; vậy mọi số nguyên đều là số hữu tỉ.<br>✗ Số 5 là số tự nhiên nhưng không là số nguyên: sai vì mọi số tự nhiên đều là số nguyên, 5 vẫn là số nguyên.<br>✗ Mọi số hữu tỉ đều là số nguyên: sai vì số hữu tỉ như 1/2 không phải là số nguyên.<br>✗ Số 0 không phải là số hữu tỉ: sai vì 0 = 0/1 nên 0 là số hữu tỉ.",
    "source": "hk1-exam3-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Trong các số sau, số nào là số vô tỉ?",
    "options": [
     "√16",
     "−7/3",
     "0,25",
     "√20"
    ],
    "correct": 3,
    "answer": "√20",
    "explanation": "🔑 20 không phải là bình phương của một số nguyên nào nên √20 là số thập phân vô hạn không tuần hoàn — số vô tỉ.<br>✗ √16: bằng 4, là số nguyên nên là số hữu tỉ.<br>✗ −7/3: là phân số nên là số hữu tỉ.<br>✗ 0,25: là số thập phân hữu hạn nên là số hữu tỉ.",
    "source": "hk1-exam3-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Giá trị của √169 là bao nhiêu?",
    "options": [
     "14",
     "84,5",
     "−13",
     "13"
    ],
    "correct": 3,
    "answer": "13",
    "explanation": "🔑 Vì 13² = 169 và 13 ≥ 0 nên √169 = 13 (căn bậc hai số học của 169).<br>✗ 14: 14² = 196 ≠ 169, tính nhầm số cần bình phương.<br>✗ 84,5: nhầm lấy 169 chia 2.<br>✗ −13: căn bậc hai số học luôn không âm, không lấy giá trị âm.",
    "source": "hk1-exam3-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tính |−12|.",
    "options": [
     "−12",
     "0",
     "1/12",
     "12"
    ],
    "correct": 3,
    "answer": "12",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm bằng số đối của nó: |−12| = 12.<br>✗ −12: nhầm giữ nguyên dấu âm, quên lấy số đối.<br>✗ 0: nhầm với trường hợp |0| = 0.<br>✗ 1/12: nhầm với số nghịch đảo.",
    "source": "hk1-exam3-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 7 483 đến hàng trăm.",
    "options": [
     "7 400",
     "7 500",
     "7 480",
     "7 000"
    ],
    "correct": 1,
    "answer": "7 500",
    "explanation": "🔑 Chữ số hàng chục của 7 483 là 8 (≥ 5) nên hàng trăm tăng thêm 1: 7 483 ≈ 7 500.<br>✗ 7 400: làm tròn xuống sai vì chữ số hàng chục là 8, phải làm tròn lên.<br>✗ 7 480: đây là làm tròn đến hàng chục, không phải hàng trăm.<br>✗ 7 000: làm tròn nhầm đến hàng nghìn.",
    "source": "hk1-exam3-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Công thức nào sau đây đúng khi nhân hai lũy thừa cùng cơ số a (a ≠ 0)?",
    "options": [
     "aᵐ · aⁿ = aᵐⁿ",
     "aᵐ · aⁿ = aᵐ⁻ⁿ",
     "aᵐ · aⁿ = aᵐ⁺ⁿ",
     "aᵐ · aⁿ = (a²)ᵐ⁺ⁿ"
    ],
    "correct": 2,
    "answer": "aᵐ · aⁿ = aᵐ⁺ⁿ",
    "explanation": "🔑 Khi nhân hai lũy thừa cùng cơ số, ta giữ nguyên cơ số và cộng các số mũ: aᵐ · aⁿ = aᵐ⁺ⁿ.<br>✗ aᵐ · aⁿ = aᵐⁿ: nhầm với công thức lũy thừa của lũy thừa (aᵐ)ⁿ.<br>✗ aᵐ · aⁿ = aᵐ⁻ⁿ: nhầm dấu, đây là công thức chia hai lũy thừa cùng cơ số.<br>✗ aᵐ · aⁿ = (a²)ᵐ⁺ⁿ: tự thêm bình phương cơ số không có căn cứ.",
    "source": "hk1-exam3-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc đối đỉnh",
    "q": "Hai đường thẳng cắt nhau tại O tạo thành bốn góc, trong đó có một góc bằng 72°. Góc đối đỉnh với góc 72° đó bằng bao nhiêu?",
    "fig": {
     "t": "doi-dinh",
     "a": 72,
     "l": [
      "72°",
      "",
      "?",
      ""
     ]
    },
    "options": [
     "18°",
     "108°",
     "144°",
     "72°"
    ],
    "correct": 3,
    "answer": "72°",
    "explanation": "🔑 Hai góc đối đỉnh thì bằng nhau, nên góc đối đỉnh với góc 72° cũng bằng 72°.<br>✗ 18°: nhầm lấy 90° − 72°.<br>✗ 108°: nhầm tính góc kề bù rồi tính sai.<br>✗ 144°: nhầm nhân đôi 72°.",
    "source": "hk1-exam3-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠xOy = 130° và Oz là tia phân giác của ∠xOy. Số đo ∠xOz bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 130,
     "lw": "130°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "130°",
     "260°",
     "50°",
     "65°"
    ],
    "correct": 3,
    "answer": "65°",
    "explanation": "🔑 Oz là tia phân giác của ∠xOy nên ∠xOz = ∠zOy = ½ · ∠xOy = ½ · 130° = 65°.<br>✗ 130°: nhầm lấy cả góc ∠xOy.<br>✗ 260°: nhầm nhân đôi thay vì chia đôi.<br>✗ 50°: tính sai phép chia 130° cho 2.",
    "source": "hk1-exam3-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng phân biệt m và n, tạo thành một cặp góc trong cùng phía có tổng số đo bằng 180°. Kết luận nào sau đây đúng?",
    "fig": {
     "t": "cut2",
     "names": [
      "m",
      "n",
      "c"
     ],
     "angles": {
      "A4": "∠A",
      "B1": "∠B"
     }
    },
    "options": [
     "m và n cắt nhau tại một điểm trên c",
     "m vuông góc với n",
     "Không thể kết luận gì về m và n",
     "m song song với n"
    ],
    "correct": 3,
    "answer": "m song song với n",
    "explanation": "🔑 Nếu một cặp góc trong cùng phía bù nhau (tổng bằng 180°) thì hai đường thẳng đó song song với nhau — đây là một dấu hiệu nhận biết hai đường thẳng song song.<br>✗ m và n cắt nhau tại một điểm trên c: sai vì hai góc trong cùng phía bù nhau là dấu hiệu của song song, không phải cắt nhau.<br>✗ m vuông góc với n: không có căn cứ, tổng 180° của góc trong cùng phía không suy ra vuông góc.<br>✗ Không thể kết luận gì: sai vì đây chính là một dấu hiệu nhận biết song song.",
    "source": "hk1-exam3-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Định lí, giả thiết và kết luận",
    "q": "Cho định lí: 'Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì chúng song song với nhau.' Giả thiết (GT) của định lí này là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Ba đường thẳng đôi một cắt nhau",
     "Hai đường thẳng đó bằng nhau"
    ],
    "correct": 0,
    "answer": "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
    "explanation": "🔑 Trong một định lí có dạng 'Nếu ... thì ...', phần sau 'Nếu' là giả thiết (GT) — điều đã cho biết trước; phần sau 'thì' là kết luận (KL) — điều suy ra được. Ở đây GT là 'hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba'.<br>✗ Hai đường thẳng đó song song với nhau: đây là kết luận (KL) của định lí, không phải giả thiết.<br>✗ Ba đường thẳng đôi một cắt nhau: không phải nội dung của định lí này.<br>✗ Hai đường thẳng đó bằng nhau: khái niệm 'bằng nhau' không dùng cho đường thẳng trong định lí này.",
    "source": "hk1-exam3-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác ABC có ∠A = 55°, ∠B = 65°. Số đo ∠C bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "A": "55°",
      "B": "65°",
      "C": "?"
     }
    },
    "options": [
     "50°",
     "70°",
     "60°",
     "120°"
    ],
    "correct": 2,
    "answer": "60°",
    "explanation": "🔑 Tổng ba góc trong một tam giác bằng 180°, nên ∠C = 180° − ∠A − ∠B = 180° − 55° − 65° = 60°.<br>✗ 50°: tính sai phép trừ.<br>✗ 70°: cộng nhầm 55° và 65° rồi trừ sai.<br>✗ 120°: quên trừ đúng, tính nhầm số.",
    "source": "hk1-exam3-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Thời gian tự học ở nhà mỗi ngày (tính bằng phút) của các bạn học sinh lớp 7A là loại dữ liệu nào?",
    "options": [
     "Định tính, vì mỗi bạn có thời gian khác nhau",
     "Không phải là dữ liệu",
     "Định lượng, vì là dữ liệu ở dạng số",
     "Định tính, không thể sắp thứ tự"
    ],
    "correct": 2,
    "answer": "Định lượng, vì là dữ liệu ở dạng số",
    "explanation": "🔑 Thời gian tự học được ghi lại bằng số phút, đây là dữ liệu dạng số nên là dữ liệu định lượng.<br>✗ Định tính, vì mỗi bạn có thời gian khác nhau: sự khác nhau giữa các giá trị không quyết định loại dữ liệu, ở đây dữ liệu là số nên định lượng.<br>✗ Không phải là dữ liệu: sai, đây vẫn là một loại dữ liệu thống kê.<br>✗ Định tính, không thể sắp thứ tự: sai vì dữ liệu số luôn định lượng, không phải định tính.",
    "source": "hk1-exam3-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Phép tính với số hữu tỉ",
    "q": "Thực hiện phép tính: 4/13 + 7/19 + 9/13 + 12/19 + 2026",
    "options": [
     "2026",
     "2027",
     "2028",
     "2029"
    ],
    "correct": 2,
    "answer": "2028",
    "explanation": "🔑 Nhóm các phân số cùng mẫu: (4/13 + 9/13) + (7/19 + 12/19) + 2026 = 13/13 + 19/19 + 2026 = 1 + 1 + 2026 = 2028.<br>✗ 2026: quên cộng thêm hai số 1 từ các nhóm phân số.<br>✗ 2027: chỉ cộng thêm 1, bỏ sót một nhóm phân số.<br>✗ 2029: cộng thừa 1 đơn vị do tính sai một nhóm phân số.",
    "source": "hk1-exam3-TL1"
   },
   {
    "n": 14,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Thực hiện phép tính: |−7| + √25 − (3/5) · (5/3)",
    "options": [
     "11",
     "13",
     "9",
     "12"
    ],
    "correct": 0,
    "answer": "11",
    "explanation": "🔑 |−7| = 7; √25 = 5; (3/5)·(5/3) = 1 (hai phân số nghịch đảo nhau). Vậy 7 + 5 − 1 = 11.<br>✗ 13: quên trừ đi 1, chỉ tính 7 + 5 + 1.<br>✗ 9: tính nhầm (3/5)·(5/3) = 3 rồi lấy 7 + 5 − 3.<br>✗ 12: nhầm √25 với 6, tính thành 7 + 6 − 1.",
    "source": "hk1-exam3-TL2"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: x − 3/10 = 0,4",
    "options": [
     "x = 7/10",
     "x = 1/10",
     "x = 1",
     "x = 0,1"
    ],
    "correct": 0,
    "answer": "x = 7/10",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 0,4 + 3/10 = 4/10 + 3/10 = 7/10.<br>✗ x = 1/10: trừ nhầm thay vì cộng khi chuyển vế.<br>✗ x = 1: cộng nhầm 0,4 với 3/10 do quy đồng sai.<br>✗ x = 0,1: tính sai phép cộng phân số với số thập phân.",
    "source": "hk1-exam3-TL3"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết: 3ˣ = 81",
    "options": [
     "x = 3",
     "x = 4",
     "x = 27",
     "x = 5"
    ],
    "correct": 1,
    "answer": "x = 4",
    "explanation": "🔑 Ta có 81 = 3⁴ nên 3ˣ = 3⁴ suy ra x = 4.<br>✗ x = 3: nhầm 81 = 3³ (thực chất 3³ = 27).<br>✗ x = 27: nhầm lẫn giữa số mũ và kết quả của 3³.<br>✗ x = 5: tính sai vì 3⁵ = 243 ≠ 81.",
    "source": "hk1-exam3-TL4"
   },
   {
    "n": 17,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x − 2| = 5",
    "options": [
     "x = 7 hoặc x = −3",
     "x = 7 hoặc x = 3",
     "x = 3",
     "x = −7 hoặc x = 3"
    ],
    "correct": 0,
    "answer": "x = 7 hoặc x = −3",
    "explanation": "🔑 |x − 2| = 5 nghĩa là x − 2 = 5 hoặc x − 2 = −5. Trường hợp 1: x = 5 + 2 = 7. Trường hợp 2: x = −5 + 2 = −3. Vậy x = 7 hoặc x = −3.<br>✗ x = 7 hoặc x = 3: tính sai trường hợp thứ hai (nhầm dấu khi cộng).<br>✗ x = 3: chỉ xét một trường hợp và tính nhầm phép cộng.<br>✗ x = −7 hoặc x = 3: nhầm dấu ở cả hai trường hợp.",
    "source": "hk1-exam3-TL5"
   },
   {
    "n": 18,
    "ch": 1,
    "topic": "Bài toán thực tế: tỉ số phần trăm",
    "q": "Một chiếc áo có giá niêm yết 250 000 đồng được giảm giá 20%. Hỏi giá bán của chiếc áo sau khi giảm giá là bao nhiêu?",
    "options": [
     "230 000 đồng",
     "200 000 đồng",
     "50 000 đồng",
     "225 000 đồng"
    ],
    "correct": 1,
    "answer": "200 000 đồng",
    "explanation": "🔑 Số tiền được giảm là 250 000 × 20% = 50 000 đồng. Giá bán sau khi giảm là 250 000 − 50 000 = 200 000 đồng.<br>✗ 230 000 đồng: tính nhầm số tiền giảm chỉ bằng 8%.<br>✗ 50 000 đồng: chỉ tính ra số tiền được giảm, quên trừ vào giá gốc.<br>✗ 225 000 đồng: tính nhầm mức giảm thành 10% thay vì 20%.",
    "source": "hk1-exam3-TL6"
   },
   {
    "n": 19,
    "ch": 1,
    "topic": "Bài toán thực tế: phân số của một số",
    "q": "Một lớp có 40 học sinh. Số học sinh giỏi chiếm 1/4 số học sinh cả lớp, số học sinh khá chiếm 2/5 số học sinh cả lớp, còn lại là học sinh trung bình. Hỏi lớp có bao nhiêu học sinh trung bình?",
    "options": [
     "10 học sinh",
     "16 học sinh",
     "14 học sinh",
     "26 học sinh"
    ],
    "correct": 2,
    "answer": "14 học sinh",
    "explanation": "🔑 Số học sinh giỏi: 40 × 1/4 = 10 (bạn). Số học sinh khá: 40 × 2/5 = 16 (bạn). Số học sinh trung bình: 40 − 10 − 16 = 14 (bạn).<br>✗ 10 học sinh: đây là số học sinh giỏi, không phải trung bình.<br>✗ 16 học sinh: đây là số học sinh khá, không phải trung bình.<br>✗ 26 học sinh: quên trừ số học sinh giỏi, chỉ lấy 40 − 14.",
    "source": "hk1-exam3-TL7"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Một mảnh đất hình vuông có diện tích 196 m². Tính độ dài cạnh của mảnh đất đó.",
    "options": [
     "14 m",
     "13 m",
     "84,5 m",
     "98 m"
    ],
    "correct": 0,
    "answer": "14 m",
    "explanation": "🔑 Cạnh hình vuông là căn bậc hai của diện tích: √196 = 14 (vì 14² = 196), vậy cạnh dài 14 m.<br>✗ 13 m: nhầm với 13² = 169 ≠ 196.<br>✗ 84,5 m: nhầm lấy diện tích chia 2 thay vì tính căn bậc hai.<br>✗ 98 m: nhầm lấy nửa diện tích.",
    "source": "hk1-exam3-TL8"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng song song a và b lần lượt tại A và B, tạo thành ∠A₁ = 70° (∠A₁ và ∠B₁ là hai góc đồng vị). Biết ∠B₁ và ∠B₂ là hai góc kề bù, tính ∠B₂.",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A1": "70°",
      "B2": "?"
     }
    },
    "options": [
     "70°",
     "110°",
     "100°",
     "20°"
    ],
    "correct": 1,
    "answer": "110°",
    "explanation": "🔑 Vì a ∥ b nên ∠B₁ = ∠A₁ = 70° (hai góc đồng vị). Mặt khác ∠B₁ và ∠B₂ kề bù nên ∠B₂ = 180° − ∠B₁ = 180° − 70° = 110°.<br>✗ 70°: nhầm lấy luôn giá trị của ∠B₁ mà không tính góc kề bù.<br>✗ 100°: tính sai phép trừ 180° − 70°.<br>✗ 20°: nhầm lấy 90° − 70°.",
    "source": "hk1-exam3-TL9"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Cho △ABC và △MNP có AB = MN, ∠B = ∠N, BC = NP. Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "B",
       "A",
       "C"
      ],
      [
       "N",
       "M",
       "P"
      ]
     ]
    },
    "options": [
     "cạnh – cạnh – cạnh (c-c-c)",
     "cạnh – góc – cạnh (c-g-c)",
     "góc – cạnh – góc (g-c-g)",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "cạnh – góc – cạnh (c-g-c)",
    "explanation": "🔑 Hai cạnh AB = MN, BC = NP và góc xen giữa hai cạnh đó là ∠B = ∠N bằng nhau, nên △ABC = △MNP theo trường hợp cạnh - góc - cạnh (c-g-c).<br>✗ cạnh – cạnh – cạnh: dữ kiện đã cho có một góc bằng nhau, không phải ba cạnh.<br>✗ góc – cạnh – góc: dữ kiện có hai cạnh và một góc, không phải hai góc và một cạnh.<br>✗ Không đủ dữ kiện: sai vì ∠B, ∠N nằm xen giữa hai cặp cạnh đã cho nên đủ điều kiện c-g-c.",
    "source": "hk1-exam3-TL10"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Cho tam giác ABC cân tại A (AB = AC), tia phân giác của ∠A cắt BC tại D. Vì sao △ABD = △ACD?",
    "fig": {
     "t": "trung-tuyen",
     "v": [
      "A",
      "B",
      "C"
     ],
     "mid": "D"
    },
    "options": [
     "Vì AB = AC, ∠BAD = ∠CAD, AD là cạnh chung nên theo trường hợp c-g-c",
     "Vì AB = AC, BD = CD, AD là cạnh chung nên theo trường hợp c-c-c",
     "Vì ∠B = ∠C, ∠BAD = ∠CAD nên theo trường hợp g-c-g",
     "Vì AB = AC, AD = AD nên hai tam giác luôn bằng nhau"
    ],
    "correct": 0,
    "answer": "Vì AB = AC, ∠BAD = ∠CAD, AD là cạnh chung nên theo trường hợp c-g-c",
    "explanation": "🔑 AB = AC (giả thiết tam giác cân), ∠BAD = ∠CAD (AD là tia phân giác của ∠A), AD là cạnh chung — góc xen giữa các cặp cạnh tương ứng, nên △ABD = △ACD theo trường hợp cạnh - góc - cạnh (c-g-c).<br>✗ Vì AB = AC, BD = CD, AD là cạnh chung (c-c-c): BD = CD chưa được cho biết trong giả thiết, đây là điều cần chứng minh chứ không phải dữ kiện có sẵn.<br>✗ Vì ∠B = ∠C, ∠BAD = ∠CAD (g-c-g): thiếu cạnh kề với cả hai góc, dữ kiện đã cho không phải hai góc và cạnh xen giữa.<br>✗ Vì AB = AC, AD = AD hai tam giác luôn bằng nhau: chỉ hai cạnh bằng nhau (một cạnh là cạnh chung) không đủ để kết luận, còn thiếu góc xen giữa.",
    "source": "hk1-exam3-TL11"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ hình quạt tròn về hình thức giải trí của học sinh lớp 7C cho biết: Đọc sách 35%, Xem phim 25%, Chơi thể thao 30%, còn lại là hoạt động khác. Hoạt động khác chiếm bao nhiêu phần trăm?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Đọc sách", "value": 35 }, { "label": "Xem phim", "value": 25 }, { "label": "Thể thao", "value": 30 }, { "label": "Khác", "value": 10, "text": "?" }] },
    "options": [
     "5%",
     "10%",
     "15%",
     "20%"
    ],
    "correct": 1,
    "answer": "10%",
    "explanation": "🔑 Tổng các tỉ lệ phần trăm trong biểu đồ quạt tròn luôn bằng 100%, nên hoạt động khác chiếm 100% − 35% − 25% − 30% = 10%.<br>✗ 5%: tính sai phép trừ liên tiếp.<br>✗ 15%: cộng nhầm hai trong ba tỉ lệ đã cho.<br>✗ 20%: chỉ trừ hai trong ba tỉ lệ đã cho, quên trừ 30%.",
    "source": "hk1-exam3-TL12"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng cho biết số lượt sách được mượn tại thư viện trường qua các tháng: tháng 9: 80 quyển; tháng 10: 95 quyển; tháng 11: 110 quyển; tháng 12: 125 quyển. Tổng số lượt sách được mượn trong 4 tháng đó là bao nhiêu quyển?",
    "fig": { "t": "line-chart", "labels": ["T9", "T10", "T11", "T12"], "values": [80, 95, 110, 125] },
    "options": [
     "380 quyển",
     "400 quyển",
     "410 quyển",
     "425 quyển"
    ],
    "correct": 2,
    "answer": "410 quyển",
    "explanation": "🔑 Tổng số lượt sách mượn trong 4 tháng là 80 + 95 + 110 + 125 = 410 (quyển).<br>✗ 380 quyển: cộng thiếu một tháng trong bốn tháng.<br>✗ 400 quyển: tính sai phép cộng liên tiếp.<br>✗ 425 quyển: cộng thừa 15 do tính nhầm một số hạng.",
    "source": "hk1-exam3-TL13"
   }
  ],
  "report": {
   "structureVsPdf": "Matches EXAM-SPEC order/quota (Q1-12 nhận biết, Q13-25 TL, ch1:7 ch2:7 ch3:5 ch4:3 ch5:3); model PDF's tỉ lệ thức and hình hộp items correctly excluded per curriculum doctrine, feel/word-problem coverage otherwise mirrored with fresh numbers.",
   "edits": [
    {
     "n": 1,
     "what": "Rewrote stem/options (collision #1: reused ℕ⊂ℤ⊂ℚ chain shape) — now tests a true/false claim about number-set membership without the ⊂ notation, same ch1 'tập hợp số' nhận biết slot."
    }
   ]
  }
 },
 {
  "id": "hk1-exam4",
  "title": "HK1 Exam 4",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Kí hiệu ℚ dùng để chỉ tập hợp số nào?",
    "options": [
     "Số hữu tỉ",
     "Số tự nhiên",
     "Số nguyên",
     "Số thực"
    ],
    "correct": 0,
    "answer": "Số hữu tỉ",
    "explanation": "🔑 Theo quy ước, ℚ là kí hiệu của tập hợp số hữu tỉ.<br>✗ Số tự nhiên: tập hợp này kí hiệu là ℕ.<br>✗ Số nguyên: tập hợp này kí hiệu là ℤ.<br>✗ Số thực: tập hợp này kí hiệu là ℝ.",
    "source": "hk1exam4-TN1"
   },
   {
    "n": 2,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Trong các số sau, số nào là số hữu tỉ: −9; √11; 3,020020002…; π?",
    "options": [
     "√11",
     "−9",
     "3,020020002…",
     "π"
    ],
    "correct": 1,
    "answer": "−9",
    "explanation": "🔑 −9 = −9/1 viết được dưới dạng phân số a/b (a, b ∈ ℤ, b ≠ 0) nên là số hữu tỉ.<br>✗ √11: 11 không phải số chính phương nên √11 là số vô tỉ.<br>✗ 3,020020002…: số thập phân vô hạn không tuần hoàn nên là số vô tỉ.<br>✗ π: là số thập phân vô hạn không tuần hoàn, số vô tỉ.",
    "source": "hk1exam4-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Giá trị của √289 là bao nhiêu?",
    "options": [
     "−17",
     "289",
     "17",
     "−289"
    ],
    "correct": 2,
    "answer": "17",
    "explanation": "🔑 Vì 17² = 289 và 17 ≥ 0 nên √289 = 17 (căn bậc hai số học).<br>✗ −17: là số đối của căn bậc hai số học, không phải giá trị của √289.<br>✗ 289: đây là số dưới dấu căn, không phải giá trị của √289.<br>✗ −289: không liên quan đến phép tính căn bậc hai của 289.",
    "source": "hk1exam4-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Giá trị tuyệt đối của 5/−4 là bao nhiêu?",
    "options": [
     "−5/4",
     "4/−5",
     "5/−4",
     "5/4"
    ],
    "correct": 3,
    "answer": "5/4",
    "explanation": "🔑 Vì 5/−4 = −5/4 là số âm, nên giá trị tuyệt đối của nó là số đối của nó: |5/−4| = 5/4.<br>✗ −5/4: đây chính là số đã cho ở dạng số đối, không phải giá trị tuyệt đối (giá trị tuyệt đối luôn không âm).<br>✗ 4/−5: nhầm giữa tử và mẫu khi đổi dấu.<br>✗ 5/−4: đây là số ban đầu, chưa lấy giá trị tuyệt đối.",
    "source": "hk1exam4-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 8,362 đến hàng phần mười.",
    "options": [
     "8,4",
     "8,3",
     "8,36",
     "8,362"
    ],
    "correct": 0,
    "answer": "8,4",
    "explanation": "🔑 Số 8,362 có chữ số hàng phần mười là 3; chữ số ngay sau đó (hàng phần trăm) là 6 ≥ 5 nên làm tròn lên: 8,362 ≈ 8,4.<br>✗ 8,3: giữ nguyên chữ số hàng phần mười, quên làm tròn lên dù chữ số sau là 6 ≥ 5.<br>✗ 8,36: làm tròn đến hàng phần trăm chứ không phải hàng phần mười.<br>✗ 8,362: đây là số ban đầu, chưa được làm tròn.",
    "source": "hk1exam4-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Đẳng thức nào sau đây SAI với mọi x ≠ 0 và m, n là các số tự nhiên (m > n)?",
    "options": [
     "xᵐ · xⁿ = xᵐ⁺ⁿ",
     "xᵐ : xⁿ = xᵐ/ⁿ",
     "(xᵐ)ⁿ = xᵐⁿ",
     "(xy)ⁿ = xⁿyⁿ"
    ],
    "correct": 1,
    "answer": "xᵐ : xⁿ = xᵐ/ⁿ",
    "explanation": "🔑 Quy tắc chia hai lũy thừa cùng cơ số là xᵐ : xⁿ = xᵐ⁻ⁿ (trừ số mũ), không phải chia số mũ như xᵐ/ⁿ.<br>✗ xᵐ · xⁿ = xᵐ⁺ⁿ: đây là công thức đúng khi nhân hai lũy thừa cùng cơ số.<br>✗ (xᵐ)ⁿ = xᵐⁿ: đây là công thức đúng của lũy thừa của một lũy thừa.<br>✗ (xy)ⁿ = xⁿyⁿ: đây là công thức đúng của lũy thừa của một tích.",
    "source": "hk1exam4-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc đối đỉnh",
    "q": "Hai góc được gọi là đối đỉnh khi nào?",
    "fig": {
     "t": "doi-dinh",
     "a": 50,
     "l": [
      "∠1",
      "",
      "∠3",
      ""
     ]
    },
    "options": [
     "Khi hai góc có chung một cạnh và tổng số đo bằng 180°",
     "Khi hai góc cùng có số đo 90°",
     "Khi mỗi cạnh của góc này là tia đối của một cạnh của góc kia",
     "Khi hai góc có số đo bằng nhau"
    ],
    "correct": 2,
    "answer": "Khi mỗi cạnh của góc này là tia đối của một cạnh của góc kia",
    "explanation": "🔑 Định nghĩa: hai góc đối đỉnh là hai góc mà mỗi cạnh của góc này là tia đối của một cạnh của góc kia.<br>✗ Khi hai góc có chung một cạnh và tổng số đo bằng 180°: đây là định nghĩa của hai góc kề bù, không phải đối đỉnh.<br>✗ Khi hai góc cùng có số đo 90°: không liên quan đến định nghĩa hai góc đối đỉnh.<br>✗ Khi hai góc có số đo bằng nhau: đây chỉ là một tính chất (hệ quả), không phải định nghĩa của hai góc đối đỉnh.",
    "source": "hk1exam4-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Khi Oz là tia phân giác của ∠xOy, tia Oz có vị trí như thế nào so với hai tia Ox, Oy?",
    "fig": {
     "t": "phan-giac",
     "w": 100
    },
    "options": [
     "Oz là tia đối của Ox",
     "Oz vuông góc với Ox",
     "Oz trùng với Ox",
     "Oz nằm giữa hai tia Ox và Oy"
    ],
    "correct": 3,
    "answer": "Oz nằm giữa hai tia Ox và Oy",
    "explanation": "🔑 Theo định nghĩa, tia phân giác Oz của ∠xOy là tia nằm giữa hai tia Ox, Oy và chia góc đó thành hai góc bằng nhau.<br>✗ Oz là tia đối của Ox: nếu vậy Oz không nằm trong góc xOy, trái với định nghĩa tia phân giác.<br>✗ Oz vuông góc với Ox: chỉ đúng trong trường hợp đặc biệt ∠xOy = 180°, không đúng với mọi góc.<br>✗ Oz trùng với Ox: khi đó góc xOz = 0°, không chia đôi được góc xOy.",
    "source": "hk1exam4-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng a và b, tạo thành một cặp góc trong cùng phía có tổng số đo bằng 180°. Kết luận nào sau đây đúng?",
    "fig": {
     "t": "cut2",
     "angles": {
      "A4": "∠A",
      "B1": "∠B"
     }
    },
    "options": [
     "a ∥ b",
     "a ⊥ b",
     "a và b cắt nhau tại một điểm trên c",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 0,
    "answer": "a ∥ b",
    "explanation": "🔑 Dấu hiệu nhận biết hai đường thẳng song song: nếu một cặp góc trong cùng phía có tổng số đo bằng 180° thì hai đường thẳng đó song song.<br>✗ a ⊥ b: không thể suy ra vuông góc chỉ từ dữ kiện góc trong cùng phía bù nhau.<br>✗ a và b cắt nhau tại một điểm trên c: mâu thuẫn với kết luận song song rút ra từ dấu hiệu.<br>✗ Không đủ dữ kiện để kết luận: dữ kiện góc trong cùng phía bù nhau chính là một dấu hiệu đủ để kết luận song song.",
    "source": "hk1exam4-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Giả thiết - Kết luận",
    "q": "Cho định lí: “Nếu hai đường thẳng phân biệt cùng song song với một đường thẳng thứ ba thì hai đường thẳng đó song song với nhau.” Kết luận (KL) của định lí này là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "par3"
    },
    "options": [
     "Hai đường thẳng phân biệt cùng song song với một đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó vuông góc với nhau",
     "Hai đường thẳng đó cắt nhau"
    ],
    "correct": 1,
    "answer": "Hai đường thẳng đó song song với nhau",
    "explanation": "🔑 Trong một định lí dạng “Nếu … thì …”, phần sau “thì” là kết luận (KL); ở đây KL là: hai đường thẳng đó song song với nhau.<br>✗ Hai đường thẳng phân biệt cùng song song với một đường thẳng thứ ba: đây là phần giả thiết (GT), đứng sau “Nếu”.<br>✗ Hai đường thẳng đó vuông góc với nhau: không phải nội dung của định lí đã cho.<br>✗ Hai đường thẳng đó cắt nhau: trái ngược với kết luận đúng của định lí.",
    "source": "hk1exam4-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác cân là tam giác có đặc điểm gì?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "A",
      "B",
      "C"
     ]
    },
    "options": [
     "Có ba cạnh bằng nhau",
     "Có một góc vuông",
     "Có hai cạnh bằng nhau",
     "Có ba góc bằng nhau"
    ],
    "correct": 2,
    "answer": "Có hai cạnh bằng nhau",
    "explanation": "🔑 Định nghĩa: tam giác cân là tam giác có hai cạnh bằng nhau (hai cạnh đó gọi là hai cạnh bên).<br>✗ Có ba cạnh bằng nhau: đó là định nghĩa của tam giác đều, một trường hợp đặc biệt của tam giác cân.<br>✗ Có một góc vuông: đó là đặc điểm của tam giác vuông, không phải tam giác cân.<br>✗ Có ba góc bằng nhau: đó cũng là đặc điểm riêng của tam giác đều.",
    "source": "hk1exam4-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Thời gian tự học mỗi ngày (tính bằng giờ) của các bạn trong lớp là loại dữ liệu nào?",
    "options": [
     "Định tính, có thể sắp thứ tự",
     "Định tính, không thể sắp thứ tự",
     "Không phải là dữ liệu thống kê",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Thời gian tự học được biểu diễn bằng số (giờ) nên đây là dữ liệu định lượng.<br>✗ Định tính, có thể sắp thứ tự: sai vì dữ liệu này là số đo được, không phải các mức phân loại.<br>✗ Định tính, không thể sắp thứ tự: sai vì đây là dữ liệu dạng số, không phải dạng chữ/nhãn.<br>✗ Không phải là dữ liệu thống kê: sai vì đây vẫn là một dữ liệu thống kê hợp lệ, chỉ thuộc loại định lượng.",
    "source": "hk1exam4-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Tính: 2/3 + 1/6 − 1/2.",
    "options": [
     "1/3",
     "2/3",
     "1/6",
     "1"
    ],
    "correct": 0,
    "answer": "1/3",
    "explanation": "🔑 Quy đồng mẫu số 6: 2/3 + 1/6 − 1/2 = 4/6 + 1/6 − 3/6 = 2/6 = 1/3.<br>✗ 2/3: đây là số hạng đầu tiên, chưa cộng trừ hết các số hạng còn lại.<br>✗ 1/6: quy đồng sai mẫu số hoặc tính nhầm tử số.<br>✗ 1: cộng nhầm dấu trừ thành dấu cộng ở số hạng −1/2.",
    "source": "hk1exam4-TL13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Áp dụng chuyển vế",
    "q": "Tìm x, biết: x − 3/8 = 1/4.",
    "options": [
     "x = 1/8",
     "x = 5/8",
     "x = −5/8",
     "x = 7/8"
    ],
    "correct": 1,
    "answer": "x = 5/8",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 1/4 + 3/8 = 2/8 + 3/8 = 5/8.<br>✗ x = 1/8: quy đồng sai mẫu số khi cộng hai phân số.<br>✗ x = −5/8: chuyển vế nhưng quên đổi dấu số hạng −3/8 thành +3/8.<br>✗ x = 7/8: cộng nhầm tử số (2 + 3 tính sai) khi đã quy đồng đúng mẫu.",
    "source": "hk1exam4-TL14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm số tự nhiên x, biết: (2/3) mũ (x + 1) = 4/9.",
    "options": [
     "x = 2",
     "x = 3",
     "x = 1",
     "x = 0"
    ],
    "correct": 2,
    "answer": "x = 1",
    "explanation": "🔑 Ta có 4/9 = (2/3)², nên (2/3) mũ (x + 1) = (2/3)² suy ra x + 1 = 2, do đó x = 1.<br>✗ x = 2: nhầm x + 1 = 2 thành x = 2, quên trừ 1.<br>✗ x = 3: tính sai số mũ của 4/9 (không phải lũy thừa bậc 3 của 2/3).<br>✗ x = 0: nhầm 4/9 với (2/3)¹.",
    "source": "hk1exam4-TL15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Một chiếc áo có giá 320 000 đồng được giảm giá 25%. Hỏi sau khi giảm giá, chiếc áo có giá bao nhiêu?",
    "options": [
     "300 000 đồng",
     "80 000 đồng",
     "288 000 đồng",
     "240 000 đồng"
    ],
    "correct": 3,
    "answer": "240 000 đồng",
    "explanation": "🔑 Số tiền được giảm: 320 000 × 25% = 80 000 (đồng). Giá sau khi giảm: 320 000 − 80 000 = 240 000 (đồng).<br>✗ 300 000 đồng: trừ nhầm 20 000 thay vì 80 000.<br>✗ 80 000 đồng: đây là số tiền được giảm, chưa trừ vào giá gốc.<br>✗ 288 000 đồng: tính nhầm mức giảm là 10% thay vì 25%.",
    "source": "hk1exam4-TL16"
   },
   {
    "n": 17,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Tính: √121 − |−11| + √9.",
    "options": [
     "3",
     "25",
     "14",
     "−3"
    ],
    "correct": 0,
    "answer": "3",
    "explanation": "🔑 √121 = 11; |−11| = 11; √9 = 3. Vậy √121 − |−11| + √9 = 11 − 11 + 3 = 3.<br>✗ 25: cộng cả ba số 11 + 11 + 3 mà không trừ số hạng thứ hai.<br>✗ 14: bỏ sót số hạng |−11|, chỉ tính 11 + 3.<br>✗ −3: tính đúng độ lớn nhưng nhầm dấu kết quả cuối.",
    "source": "hk1exam4-TL17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x − 5| = 9.",
    "options": [
     "x = 14 hoặc x = 4",
     "x = 14 hoặc x = −4",
     "x = 4 hoặc x = −14",
     "x = 9 hoặc x = −9"
    ],
    "correct": 1,
    "answer": "x = 14 hoặc x = −4",
    "explanation": "🔑 |x − 5| = 9 nghĩa là x − 5 = 9 hoặc x − 5 = −9, suy ra x = 14 hoặc x = −4.<br>✗ x = 14 hoặc x = 4: tính sai trường hợp thứ hai, quên đổi dấu 9 (phải là x − 5 = −9).<br>✗ x = 4 hoặc x = −14: cộng nhầm 5 vào 9 và −9 (lẫn lộn phép tính).<br>✗ x = 9 hoặc x = −9: quên chuyển vế số 5, lấy luôn 9 và −9 làm đáp số.",
    "source": "hk1exam4-TL18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh đất hình vuông có diện tích 144 m². Hỏi cạnh của mảnh đất dài bao nhiêu mét?",
    "options": [
     "72 m",
     "24 m",
     "12 m",
     "14,4 m"
    ],
    "correct": 2,
    "answer": "12 m",
    "explanation": "🔑 Cạnh của hình vuông là căn bậc hai số học của diện tích: √144 = 12 (m).<br>✗ 72 m: lấy nhầm một nửa diện tích thay vì tính căn bậc hai.<br>✗ 24 m: nhầm cạnh bằng diện tích chia 6, không đúng công thức.<br>✗ 14,4 m: nhầm 144 với 14,4 rồi lấy luôn làm đáp số.",
    "source": "hk1exam4-TL19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Tìm x, biết x² = 64 và x > 0.",
    "options": [
     "x = −8",
     "x = 32",
     "x = 16",
     "x = 8"
    ],
    "correct": 3,
    "answer": "x = 8",
    "explanation": "🔑 Vì x > 0 và x² = 64 = 8², nên x = 8 (căn bậc hai số học của 64).<br>✗ x = −8: tuy (−8)² = 64 nhưng không thỏa điều kiện x > 0.<br>✗ x = 32: nhầm 64 chia 2, không phải phép khai căn.<br>✗ x = 16: nhầm 64 chia 4, không đúng với x² = 64.",
    "source": "hk1exam4-TL20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho a ∥ b, đường thẳng c cắt a tại A và cắt b tại B. Biết góc tạo bởi c và a bằng 115°. Gọi ∠B₁ là góc tạo bởi c và b ở vị trí đồng vị với góc đó, và ∠B₂ là góc kề bù với ∠B₁. Tính ∠B₁ và ∠B₂.",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A1": "115°",
      "B1": "? B₁",
      "B2": "? B₂"
     }
    },
    "options": [
     "∠B₁ = 115°; ∠B₂ = 65°",
     "∠B₁ = 65°; ∠B₂ = 115°",
     "∠B₁ = 115°; ∠B₂ = 115°",
     "∠B₁ = 65°; ∠B₂ = 65°"
    ],
    "correct": 0,
    "answer": "∠B₁ = 115°; ∠B₂ = 65°",
    "explanation": "🔑 Vì a ∥ b nên hai góc đồng vị bằng nhau: ∠B₁ = 115°. Vì ∠B₁ và ∠B₂ kề bù nên ∠B₂ = 180° − 115° = 65°.<br>✗ ∠B₁ = 65°; ∠B₂ = 115°: đảo ngược vai trò hai góc, nhầm đồng vị với kề bù.<br>✗ ∠B₁ = 115°; ∠B₂ = 115°: quên tính chất kề bù có tổng 180°, coi ∠B₂ bằng luôn ∠B₁.<br>✗ ∠B₁ = 65°; ∠B₂ = 65°: tính nhầm góc đồng vị bằng góc trong cùng phía (180° − 115°) ngay từ đầu.",
    "source": "hk1exam4-TL21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Cho △MNP và △XYZ có MN = XY, ∠M = ∠X, MP = XZ. Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "M",
       "N",
       "P"
      ],
      [
       "X",
       "Y",
       "Z"
      ]
     ]
    },
    "options": [
     "c-c-c (cạnh - cạnh - cạnh)",
     "c-g-c (cạnh - góc - cạnh)",
     "g-c-g (góc - cạnh - góc)",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "c-g-c (cạnh - góc - cạnh)",
    "explanation": "🔑 Góc ∠M xen giữa hai cạnh MN, MP (và ∠X xen giữa XY, XZ), cùng với MN = XY, MP = XZ, nên △MNP = △XYZ theo trường hợp c-g-c.<br>✗ c-c-c (cạnh - cạnh - cạnh): đề bài không cho biết cạnh NP và YZ bằng nhau.<br>✗ g-c-g (góc - cạnh - góc): đề bài chỉ cho một góc bằng nhau, không đủ hai góc để dùng trường hợp này.<br>✗ Không đủ dữ kiện để kết luận: sai vì hai cạnh và góc xen giữa đã đủ điều kiện c-g-c.",
    "source": "hk1exam4-TL22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác ABC cân tại A, biết góc ở đáy ∠B = 58°. Tính số đo góc ở đỉnh ∠A.",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "B": "58°",
      "A": "?"
     }
    },
    "options": [
     "58°",
     "122°",
     "64°",
     "61°"
    ],
    "correct": 2,
    "answer": "64°",
    "explanation": "🔑 Tam giác cân tại A nên ∠B = ∠C = 58°. Áp dụng tổng ba góc: ∠A = 180° − 58° − 58° = 64°.<br>✗ 58°: nhầm góc ở đỉnh bằng góc ở đáy.<br>✗ 122°: tính 180° − 58° mà quên trừ tiếp góc ∠C còn lại.<br>✗ 61°: chia đôi sai phần còn lại (180° − 58°) cho 2 thay vì trừ đúng hai lần 58°.",
    "source": "hk1exam4-TL23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ hình quạt tròn về hoạt động giải trí yêu thích của lớp 7C cho biết: đọc sách 30%, xem phim 20%, chơi thể thao 15%, còn lại là nghe nhạc. Hỏi tỉ lệ học sinh thích nghe nhạc là bao nhiêu?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Đọc sách", "value": 30 }, { "label": "Xem phim", "value": 20 }, { "label": "Thể thao", "value": 15 }, { "label": "Nghe nhạc", "value": 35, "text": "?" }] },
    "options": [
     "30%",
     "65%",
     "15%",
     "35%"
    ],
    "correct": 3,
    "answer": "35%",
    "explanation": "🔑 Tổng các tỉ lệ trong biểu đồ quạt tròn luôn bằng 100%, nên tỉ lệ nghe nhạc = 100% − 30% − 20% − 15% = 35%.<br>✗ 30%: nhầm với tỉ lệ của đọc sách.<br>✗ 65%: cộng nhầm ba tỉ lệ đã cho (30% + 20% + 15%) mà quên lấy 100% trừ đi.<br>✗ 15%: nhầm với tỉ lệ của chơi thể thao.",
    "source": "hk1exam4-TL24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Số cây xanh trồng thêm mỗi năm tại một trường học: năm 2021: 40 cây; năm 2022: 55 cây; năm 2023: 70 cây; năm 2024: 60 cây. Năm nào số cây trồng thêm GIẢM so với năm liền trước?",
    "options": [
     "Năm 2024",
     "Năm 2022",
     "Năm 2023",
     "Không có năm nào giảm"
    ],
    "correct": 0,
    "answer": "Năm 2024",
    "explanation": "🔑 So sánh từng năm với năm liền trước: 2022 tăng (55 > 40), 2023 tăng (70 > 55), 2024 giảm (60 &lt; 70). Vậy năm 2024 số cây trồng thêm giảm so với năm liền trước.<br>✗ Năm 2022: số cây tăng so với 2021 (55 > 40), không phải giảm.<br>✗ Năm 2023: số cây tăng so với 2022 (70 > 55), không phải giảm.<br>✗ Không có năm nào giảm: sai vì năm 2024 có số liệu giảm so với 2023.",
    "source": "hk1exam4-TL25"
   }
  ],
  "report": {
   "structureVsPdf": "Model PDF has only 12 TN + 7 TL (19 câu) and includes banned ch6/ch10 content (tỉ lệ thức, đại lượng tỉ lệ, thể tích lăng trụ) that curriculum rule E requires dropping; this exam instead follows the full 25-question EXAM-SPEC structure (Q1-12 nhận biết in spec order, Q13-25 TL-style) covering the same allowed skills with quota ch1:7 ch2:7 ch3:5 ch4:3 ch5:3 exactly met.",
   "edits": [
    {
     "n": 3,
     "what": "Collision with Exam 3 câu 3 (√169): changed to √289 (answer 17), fresh numbers, same dạng."
    },
    {
     "n": 5,
     "what": "7,483 was the literal example number from EXAM-SPEC.md, duplicated verbatim across 6 sibling exams (n5 in Exam1/4/5/6/9/10); changed to 8,362 (rounds to 8,4) for freshness."
    },
    {
     "n": 15,
     "what": "Rule D violation: caret '^' used for variable exponent (2/3)^(x+1); rewritten as '(2/3) mũ (x + 1)' in stem and explanation. Math unchanged (x=1)."
    },
    {
     "n": 16,
     "what": "Exact duplicate of Exam 3 câu 18 (250 000 đồng, giảm 20%); changed to 320 000 đồng giảm 25% -> 240 000 đồng, recomputed distractors."
    },
    {
     "n": 18,
     "what": "Exact duplicate of Exam 6 câu 19 (|x − 3| = 7); changed to |x − 5| = 9 -> x = 14 hoặc x = −4, recomputed distractors."
    },
    {
     "n": 22,
     "what": "Near-duplicate of Exam 6/7 câu 22 (identical △ABC/△DEF, AB=DE ∠A=∠D AC=DF setup) and close to a BANK.md c-g-c exemplar; relabeled to △MNP/△XYZ (MN=XY, ∠M=∠X, MP=XZ), same c-g-c answer."
    },
    {
     "n": 23,
     "what": "Duplicate of Exam 8 câu 23 (∠B = 72° base angle); changed to ∠B = 58° -> ∠A = 64°, recomputed distractors."
    }
   ]
  }
 },
 {
  "id": "hk1-exam5",
  "title": "HK1 Exam 5",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Chọn phát biểu ĐÚNG trong các câu sau:",
    "options": [
     "−7 ∈ ℕ",
     "4/9 ∈ ℚ",
     "0 ∈ ℤ nhưng 0 ∉ ℚ",
     "2,5 ∈ ℤ"
    ],
    "correct": 1,
    "answer": "4/9 ∈ ℚ",
    "explanation": "🔑 Mọi phân số a/b (a, b ∈ ℤ, b ≠ 0) đều là số hữu tỉ, viết x ∈ ℚ; ở đây 4/9 ∈ ℚ là đúng.<br>✗ −7 ∈ ℕ: sai vì ℕ chỉ gồm các số tự nhiên (0, 1, 2, …), không có số âm.<br>✗ 0 ∈ ℤ nhưng 0 ∉ ℚ: sai vì mọi số nguyên đều là số hữu tỉ, 0 = 0/1 nên 0 ∈ ℚ.<br>✗ 2,5 ∈ ℤ: sai vì 2,5 là số thập phân, không phải số nguyên.",
    "source": "hk1e5-Q1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Chọn khẳng định ĐÚNG trong các câu sau:",
    "options": [
     "0,777... (chữ số 7 lặp lại mãi) là số vô tỉ",
     "√5 là số hữu tỉ vì viết được dưới dạng căn",
     "1,414213562... (không lặp lại) là số vô tỉ",
     "Mọi số vô tỉ đều viết được dưới dạng phân số a/b"
    ],
    "correct": 2,
    "answer": "1,414213562... (không lặp lại) là số vô tỉ",
    "explanation": "🔑 Số thập phân vô hạn KHÔNG tuần hoàn là số vô tỉ; 1,414213562... không có nhóm chữ số lặp lại nên là số vô tỉ.<br>✗ 0,777...: chữ số 7 lặp lại mãi nên đây là số thập phân vô hạn tuần hoàn, tức là số hữu tỉ, không phải số vô tỉ.<br>✗ √5 là số hữu tỉ: sai vì √5 không viết được dưới dạng phân số a/b nên là số vô tỉ.<br>✗ Mọi số vô tỉ đều viết được dưới dạng phân số a/b: sai, đây chính là điều KHÔNG thể làm được với số vô tỉ theo định nghĩa.",
    "source": "hk1e5-Q2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "√144 bằng bao nhiêu?",
    "options": [
     "72",
     "12²",
     "−12",
     "12"
    ],
    "correct": 3,
    "answer": "12",
    "explanation": "🔑 Vì 12² = 144 nên căn bậc hai số học của 144 là √144 = 12.<br>✗ 72: nhầm lấy 144 chia 2 thay vì tìm số mà bình phương bằng 144.<br>✗ 12²: nhầm giữ nguyên dạng bình phương thay vì tính ra giá trị.<br>✗ −12: căn bậc hai số học luôn không âm, chỉ lấy giá trị dương.",
    "source": "hk1e5-Q3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tính |−15|.",
    "options": [
     "15",
     "−15",
     "0",
     "15 và −15"
    ],
    "correct": 0,
    "answer": "15",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm bằng số đối của nó: |−15| = 15.<br>✗ −15: nhầm giữ nguyên dấu âm, quên lấy số đối.<br>✗ 0: nhầm với trường hợp |0| = 0.<br>✗ 15 và −15: nhầm với bài toán tìm x khi biết |x| = 15 (hai giá trị), còn đây là tính |−15| ra một kết quả duy nhất.",
    "source": "hk1e5-Q4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Giá trị gần đúng khi làm tròn số 7,483 đến hàng phần trăm là:",
    "options": [
     "7,49",
     "7,48",
     "7,5",
     "7,483"
    ],
    "correct": 1,
    "answer": "7,48",
    "explanation": "🔑 Chữ số hàng phần nghìn là 3 (nhỏ hơn 5) nên giữ nguyên hàng phần trăm: 7,483 ≈ 7,48.<br>✗ 7,49: làm tròn sai, tăng hàng phần trăm dù chữ số bỏ đi là 3 (nhỏ hơn 5).<br>✗ 7,5: nhầm làm tròn đến hàng phần mười thay vì hàng phần trăm.<br>✗ 7,483: chưa làm tròn, vẫn giữ nguyên số ban đầu.",
    "source": "hk1e5-Q5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Kết quả của 3⁶ : 3² là gì?",
    "options": [
     "3⁸",
     "3¹²",
     "3⁴",
     "3³"
    ],
    "correct": 2,
    "answer": "3⁴",
    "explanation": "🔑 Khi chia hai lũy thừa cùng cơ số, giữ nguyên cơ số và trừ số mũ: 3⁶ : 3² = 3⁶⁻² = 3⁴.<br>✗ 3⁸: nhầm cộng số mũ (6 + 2) như khi nhân hai lũy thừa cùng cơ số.<br>✗ 3¹²: nhầm nhân hai số mũ (6 × 2) như công thức lũy thừa của lũy thừa.<br>✗ 3³: trừ số mũ sai (nhầm 6 − 2 − 1).",
    "source": "hk1e5-Q6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc kề bù",
    "q": "Hai đường thẳng cắt nhau tạo thành bốn góc, trong đó có một góc bằng 55°. Góc kề bù với góc 55° đó bằng bao nhiêu?",
    "fig": {
     "t": "doi-dinh",
     "a": 55,
     "l": [
      "55°",
      "?",
      "",
      ""
     ]
    },
    "options": [
     "55°",
     "35°",
     "235°",
     "125°"
    ],
    "correct": 3,
    "answer": "125°",
    "explanation": "🔑 Hai góc kề bù có tổng số đo bằng 180°, nên góc kề bù với 55° là 180° − 55° = 125°.<br>✗ 55°: nhầm với góc đối đỉnh (bằng nhau), không phải góc kề bù.<br>✗ 35°: nhầm tính 90° − 55° thay vì 180° trừ đi — hai góc kề bù có tổng 180°, không phải 90°.<br>✗ 235°: cộng nhầm 180° + 55° thay vì lấy 180° trừ đi.",
    "source": "hk1e5-Q7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠xOy = 54° và Oz là tia phân giác của ∠xOy. Số đo ∠xOz bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 54,
     "lw": "54°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "27°",
     "54°",
     "108°",
     "13,5°"
    ],
    "correct": 0,
    "answer": "27°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau: ∠xOz = ∠xOy : 2 = 54° : 2 = 27°.<br>✗ 54°: nhầm lấy nguyên số đo góc ban đầu.<br>✗ 108°: nhầm nhân đôi 54° thay vì chia đôi.<br>✗ 13,5°: nhầm chia cho 4 thay vì chia cho 2.",
    "source": "hk1e5-Q8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng t cắt hai đường thẳng phân biệt p và q, tạo thành một cặp góc so le trong đều bằng 72°. Kết luận nào sau đây đúng?",
    "fig": {
     "t": "cut2",
     "names": [
      "p",
      "q",
      "t"
     ],
     "angles": {
      "A3": "72°",
      "B1": "72°"
     }
    },
    "options": [
     "p ∥ q vì cặp góc so le trong bù nhau",
     "p ∥ q vì cặp góc so le trong bằng nhau",
     "p không song song với q",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "p ∥ q vì cặp góc so le trong bằng nhau",
    "explanation": "🔑 Dấu hiệu nhận biết hai đường thẳng song song: nếu một cặp góc so le trong bằng nhau thì hai đường thẳng đó song song. Ở đây cặp so le trong đều bằng 72° nên p ∥ q.<br>✗ p ∥ q vì cặp góc so le trong bù nhau: sai, dấu hiệu áp dụng khi hai góc BẰNG NHAU, không phải bù nhau.<br>✗ p không song song với q: sai vì đã có cặp so le trong bằng nhau, đủ điều kiện kết luận song song.<br>✗ Không đủ dữ kiện để kết luận: sai vì một cặp góc so le trong bằng nhau là đủ để áp dụng dấu hiệu.",
    "source": "hk1e5-Q9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Giả thiết – Kết luận",
    "q": "Cho định lí: Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì chúng song song với nhau. Phần nào của định lí là Kết luận (KL)?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
     "Có một đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó vuông góc với nhau"
    ],
    "correct": 2,
    "answer": "Hai đường thẳng đó song song với nhau",
    "explanation": "🔑 Trong định lí dạng Nếu A thì B, phần sau thì là Kết luận (KL); ở đây KL là: hai đường thẳng đó song song với nhau.<br>✗ Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba: đây là phần Giả thiết (GT) — điều đã cho, đứng sau Nếu.<br>✗ Có một đường thẳng thứ ba: không phải cách phát biểu Kết luận của định lí này.<br>✗ Hai đường thẳng đó vuông góc với nhau: nhầm lẫn, việc vuông góc với đường thứ ba thuộc Giả thiết, không phải Kết luận.",
    "source": "hk1e5-Q10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác ABC có ∠A = 48°, ∠B = 77°. Số đo ∠C bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "A": "48°",
      "B": "77°",
      "C": "?"
     }
    },
    "options": [
     "125°",
     "132°",
     "180°",
     "55°"
    ],
    "correct": 3,
    "answer": "55°",
    "explanation": "🔑 Tổng ba góc của một tam giác bằng 180°: ∠C = 180° − 48° − 77° = 55°.<br>✗ 125°: nhầm cộng hai góc đã cho (48° + 77°) rồi lấy làm ∠C.<br>✗ 132°: chỉ trừ một góc (180° − 48°), quên trừ tiếp góc B.<br>✗ 180°: nhầm lấy luôn tổng ba góc của tam giác làm số đo ∠C.",
    "source": "hk1e5-Q11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Thể loại truyện yêu thích của các bạn trong lớp (Trinh thám, Khoa học viễn tưởng, Ngôn tình, Lịch sử) là loại dữ liệu nào?",
    "options": [
     "Định tính (không là số)",
     "Định lượng (là số)",
     "Vừa định lượng vừa định tính",
     "Không phải dữ liệu"
    ],
    "correct": 0,
    "answer": "Định tính (không là số)",
    "explanation": "🔑 Dữ liệu không biểu diễn bằng số (tên thể loại truyện) là dữ liệu định tính.<br>✗ Định lượng (là số): sai vì thể loại truyện không phải là số liệu.<br>✗ Vừa định lượng vừa định tính: sai vì một dữ liệu chỉ thuộc đúng một trong hai loại.<br>✗ Không phải dữ liệu: sai vì đây vẫn là dữ liệu thống kê hợp lệ, chỉ là dạng định tính.",
    "source": "hk1e5-Q12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Thực hiện phép tính: (−9/11)·(1/6) + (−9/11)·(2/6) + (−9/11)·(3/6)",
    "options": [
     "9/11",
     "−9/11",
     "−9/66",
     "−27/11"
    ],
    "correct": 1,
    "answer": "−9/11",
    "explanation": "🔑 Đặt nhân tử chung −9/11: kết quả = (−9/11)·(1/6 + 2/6 + 3/6) = (−9/11)·(6/6) = (−9/11)·1 = −9/11.<br>✗ 9/11: nhầm dấu, quên giữ dấu âm khi nhân với 1.<br>✗ −9/66: nhầm cộng ba mẫu số lại với nhau thay vì cộng ba tử số cùng mẫu 6.<br>✗ −27/11: nhầm cộng tử số 1 + 2 + 3 = 6 rồi bỏ qua mẫu, nhân sai thành −9/11 × 3.",
    "source": "hk1e5-Q13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: 3x − 2/5 = 3/5",
    "options": [
     "1/15",
     "1/5",
     "1/3",
     "3"
    ],
    "correct": 2,
    "answer": "1/3",
    "explanation": "🔑 Chuyển vế: 3x = 3/5 + 2/5 = 5/5 = 1, suy ra x = 1 : 3 = 1/3.<br>✗ 1/15: nhầm nhân 3 vào mẫu số thay vì lấy 1 chia cho 3.<br>✗ 1/5: quên chia cho 3, dừng lại ở 3x = 1 rồi ghi nhầm x = 1/5.<br>✗ 3: nhầm dấu khi chuyển vế, tính 3x = 3/5 − 2/5 = 1/5 rồi nhân chéo sai.",
    "source": "hk1e5-Q14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết: 4 mũ (x + 3) − 2·4 mũ (x + 2) = 2·4⁶",
    "options": [
     "x = 6",
     "x = 8",
     "x = 2",
     "x = 4"
    ],
    "correct": 3,
    "answer": "x = 4",
    "explanation": "🔑 Đưa về cùng lũy thừa 4 mũ (x + 2): 4 mũ (x + 3) = 4·4 mũ (x + 2), nên 4·4 mũ (x + 2) − 2·4 mũ (x + 2) = 2·4 mũ (x + 2) = 2·4⁶, suy ra 4 mũ (x + 2) = 4⁶, tức x + 2 = 6, vậy x = 4.<br>✗ x = 6: nhầm lấy luôn số mũ ở vế phải (4⁶) làm giá trị x, bỏ qua bước rút gọn hệ số.<br>✗ x = 8: nhầm cộng 2 + 6 thay vì giải x + 2 = 6 bằng phép trừ.<br>✗ x = 2: nhầm coi x + 3 = 6 (quên hệ số 2 ở lũy thừa) rồi giải sai.",
    "source": "hk1e5-Q15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán giảm giá",
    "q": "Một cửa hàng giảm giá 25% cho tất cả sản phẩm nhân dịp khai trương. Khách hàng có thẻ thành viên được giảm thêm 20% trên giá đã giảm. Bạn Hoa có thẻ thành viên, mua một chiếc balo giá niêm yết 1 000 000 đồng. Hỏi bạn Hoa phải trả bao nhiêu tiền?",
    "options": [
     "600 000 đồng",
     "750 000 đồng",
     "550 000 đồng",
     "800 000 đồng"
    ],
    "correct": 0,
    "answer": "600 000 đồng",
    "explanation": "🔑 Giá sau khi giảm 25%: 1 000 000 × (1 − 25%) = 750 000 đồng. Giảm thêm 20% trên giá đã giảm: 750 000 × (1 − 20%) = 600 000 đồng.<br>✗ 750 000 đồng: chỉ tính giảm 25% lần đầu, quên trừ tiếp 20% cho thẻ thành viên.<br>✗ 550 000 đồng: nhầm cộng hai mức giảm (25% + 20% = 45%) rồi trừ thẳng vào 1 000 000, sai vì mức giảm thứ hai tính trên giá ĐÃ giảm.<br>✗ 800 000 đồng: chỉ áp dụng một mức giảm 20% trên giá gốc, bỏ qua mức giảm 25%.",
    "source": "hk1e5-Q16"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Bài toán chia nhóm",
    "q": "Lớp 7A có 36 học sinh, dự định chia thành các nhóm học tập sao cho số học sinh mỗi nhóm bằng 1/9 số học sinh cả lớp. Hỏi mỗi nhóm có bao nhiêu học sinh?",
    "options": [
     "9",
     "4",
     "6",
     "3"
    ],
    "correct": 1,
    "answer": "4",
    "explanation": "🔑 Số học sinh mỗi nhóm = 36 × 1/9 = 4 (học sinh).<br>✗ 9: nhầm lấy số nhóm (36 : 4 = 9) làm số học sinh mỗi nhóm.<br>✗ 6: tính nhầm do nhớ sai phân số thành 1/6.<br>✗ 3: tính sai phép nhân 36 × 1/9.",
    "source": "hk1e5-Q17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Thực hiện phép tính: (1/2)² + √36 − |−1/4|",
    "options": [
     "6,5",
     "6,25",
     "6",
     "36"
    ],
    "correct": 2,
    "answer": "6",
    "explanation": "🔑 (1/2)² = 1/4; √36 = 6; |−1/4| = 1/4. Kết quả = 1/4 + 6 − 1/4 = 6.<br>✗ 6,5: nhầm dấu, cộng |−1/4| thay vì trừ (1/4 + 6 + 1/4 = 6,5).<br>✗ 6,25: nhầm (1/2)² = 1/2, quên bình phương cả mẫu số (1/2 + 6 − 1/4 = 6,25).<br>✗ 36: nhầm √36 = 36, quên lấy căn bậc hai và giữ nguyên số dưới dấu căn.",
    "source": "hk1e5-Q18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x − 3| = 7",
    "options": [
     "x = 10",
     "x = −4",
     "x = 4 hoặc x = −10",
     "x = 10 hoặc x = −4"
    ],
    "correct": 3,
    "answer": "x = 10 hoặc x = −4",
    "explanation": "🔑 |x − 3| = 7 có hai trường hợp: x − 3 = 7 → x = 10, hoặc x − 3 = −7 → x = −4.<br>✗ x = 10: mới chỉ xét một trường hợp, thiếu nghiệm âm.<br>✗ x = −4: mới chỉ xét một trường hợp, thiếu nghiệm dương.<br>✗ x = 4 hoặc x = −10: nhầm chuyển vế, tính x = 7 − 3 và x = −7 − 3 thay vì cộng 3 vào hai vế.",
    "source": "hk1e5-Q19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh vườn hình vuông có diện tích 196 m². Hỏi độ dài cạnh của mảnh vườn đó là bao nhiêu mét?",
    "options": [
     "14 m",
     "49 m",
     "98 m",
     "13 m"
    ],
    "correct": 0,
    "answer": "14 m",
    "explanation": "🔑 Cạnh hình vuông = √(diện tích) = √196 = 14 (m).<br>✗ 49 m: nhầm lấy 196 : 4 thay vì lấy căn bậc hai.<br>✗ 98 m: nhầm lấy 196 : 2 thay vì lấy căn bậc hai.<br>✗ 13 m: ước lượng sai vì 13² = 169 ≠ 196.",
    "source": "hk1e5-Q20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho m ∥ n, cùng bị đường thẳng t cắt tại hai điểm phân biệt. Một góc tạo bởi t và m bằng 65°, và góc so le trong với nó (tạo bởi t và n) cũng bằng 65° vì m ∥ n. Góc kề bù với góc so le trong 65° đó (tại giao điểm của t và n) bằng bao nhiêu?",
    "fig": {
     "t": "cut2",
     "par": true,
     "names": [
      "m",
      "n",
      "t"
     ],
     "angles": {
      "A3": "65°",
      "B1": "65°",
      "B2": "?"
     }
    },
    "options": [
     "65°",
     "115°",
     "25°",
     "245°"
    ],
    "correct": 1,
    "answer": "115°",
    "explanation": "🔑 Góc kề bù với góc so le trong 65° bằng 180° − 65° = 115°.<br>✗ 65°: nhầm với chính góc so le trong, không phải góc kề bù của nó.<br>✗ 25°: nhầm tính 90° − 65° thay vì 180° trừ đi — hai góc kề bù có tổng 180°, không phải 90°.<br>✗ 245°: cộng nhầm 180° + 65° thay vì lấy 180° trừ đi.",
    "source": "hk1e5-Q21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Một giá đỡ hình chữ V có hai thanh OA và OB bằng nhau (OA = OB), thanh chống OC là tia phân giác của ∠AOB. Vì sao △OAC = △OBC?",
    "fig": {
     "t": "trung-tuyen",
     "v": [
      "O",
      "A",
      "B"
     ],
     "mid": "C"
    },
    "options": [
     "Vì OA = OB, OC chung, ∠AOC = ∠BOC nên bằng nhau theo trường hợp c-c-c",
     "Không đủ dữ kiện để kết luận hai tam giác bằng nhau",
     "Vì OA = OB, OC chung, ∠AOC = ∠BOC (do OC là tia phân giác) nên bằng nhau theo trường hợp c-g-c",
     "Vì OA = OB và AC = BC nên bằng nhau theo trường hợp c-c-c"
    ],
    "correct": 2,
    "answer": "Vì OA = OB, OC chung, ∠AOC = ∠BOC (do OC là tia phân giác) nên bằng nhau theo trường hợp c-g-c",
    "explanation": "🔑 Ta có OA = OB (giả thiết), OC là cạnh chung, và ∠AOC = ∠BOC vì OC là tia phân giác của ∠AOB. Đây là hai cạnh và góc xen giữa chúng bằng nhau, nên △OAC = △OBC theo trường hợp c-g-c.<br>✗ Phương án ghi trường hợp c-c-c ở dòng đầu: sai vì chỉ có hai cạnh và một góc bằng nhau, chưa biết AC = BC nên không dùng được c-c-c.<br>✗ Không đủ dữ kiện để kết luận: sai vì đã đủ hai cạnh và góc xen giữa để dùng c-g-c.<br>✗ Phương án nêu AC = BC làm căn cứ: sai vì AC = BC chưa được cho biết, đó là điều cần suy ra chứ không phải giả thiết.",
    "source": "hk1e5-Q22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Một miếng bìa hình tam giác cân có góc ở đỉnh bằng 36°. Mỗi góc ở đáy của tam giác đó bằng bao nhiêu độ?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "A": "36°",
      "B": "?",
      "C": "?"
     }
    },
    "options": [
     "82°",
     "144°",
     "36°",
     "72°"
    ],
    "correct": 3,
    "answer": "72°",
    "explanation": "🔑 Tam giác cân có tổng ba góc bằng 180°, hai góc ở đáy bằng nhau: mỗi góc ở đáy = (180° − 36°) : 2 = 72°.<br>✗ 82°: tính sai phép chia, đáng lẽ 144° : 2 = 72° chứ không phải 82°.<br>✗ 144°: quên chia đôi, chỉ lấy 180° − 36°.<br>✗ 36°: nhầm góc ở đáy bằng góc ở đỉnh.",
    "source": "hk1e5-Q23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Tỉ lệ phần trăm",
    "q": "Kết quả khảo sát mức độ yêu thích đọc sách của học sinh lớp 7B được ghi lại: Rất thích: 18 bạn; Thích: 22 bạn; Bình thường: 8 bạn; Không thích: 2 bạn. Tỉ lệ phần trăm học sinh Rất thích đọc sách so với cả lớp là bao nhiêu?",
    "options": [
     "36%",
     "18%",
     "44%",
     "22%"
    ],
    "correct": 0,
    "answer": "36%",
    "explanation": "🔑 Tổng số học sinh cả lớp: 18 + 22 + 8 + 2 = 50 (bạn). Tỉ lệ nhóm Rất thích: 18 : 50 × 100% = 36%.<br>✗ 18%: nhầm lấy luôn số bạn (18) làm phần trăm, quên chia cho tổng số học sinh.<br>✗ 44%: nhầm tính tỉ lệ của nhóm Thích (22 : 50 = 44%) thay vì nhóm Rất thích.<br>✗ 22%: nhầm lấy số bạn của nhóm Thích (22) làm phần trăm.",
    "source": "hk1e5-Q24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng ghi số xe đạp bán được của một cửa hàng: tháng 6: 40 chiếc; tháng 7: 55 chiếc; tháng 8: 65 chiếc; tháng 9: 90 chiếc. Tháng nào có mức tăng so với tháng liền trước là lớn nhất?",
    "fig": { "t": "line-chart", "labels": ["T6", "T7", "T8", "T9"], "values": [40, 55, 65, 90] },
    "options": [
     "Tháng 7",
     "Tháng 9",
     "Tháng 8",
     "Không tháng nào tăng"
    ],
    "correct": 1,
    "answer": "Tháng 9",
    "explanation": "🔑 Mức tăng từng tháng: tháng 7 tăng 15 (55 − 40), tháng 8 tăng 10 (65 − 55), tháng 9 tăng 25 (90 − 65). Mức tăng lớn nhất là tháng 9, tăng 25 chiếc.<br>✗ Tháng 7: mức tăng chỉ 15, không phải lớn nhất.<br>✗ Tháng 8: mức tăng chỉ 10, nhỏ nhất trong ba tháng.<br>✗ Không tháng nào tăng: sai vì cả ba tháng đều tăng so với tháng liền trước.",
    "source": "hk1e5-Q25"
   }
  ],
  "report": {
   "structureVsPdf": "25 câu (Q1-12 nhận biết theo đúng thứ tự spec, Q13-25 TL); quota ch1:7 ch2:7 ch3:5 ch4:3 ch5:3 khớp ma trận; đã loại nội dung lăng trụ/hình hộp (chương 10) của đề mẫu, thay bằng câu cùng độ khó thuộc 5 chương app hỗ trợ.",
   "edits": [
    {
     "n": 5,
     "what": "Explanation dùng bare '<' không đúng khoảng trắng ('(nhỏ hơn 5)') → viết lại bằng chữ '(nhỏ hơn 5)' theo RULES."
    },
    {
     "n": 15,
     "what": "Stem/explanation dùng caret '4^(x+3)' vi phạm RULES (cấm ^) → viết lại bằng chữ 'mũ': '4 mũ (x + 3)'."
    },
    {
     "n": 18,
     "what": "Trùng hằng số với đề mẫu (đề mẫu dùng √49 ở Câu 1b Tự luận) → đổi thành √36, tính lại đáp án đúng = 6 và 3 nhiễu tương ứng."
    },
    {
     "n": 21,
     "what": "Trùng số đo 72° với câu 9 trong cùng đề (không đa dạng) → đổi thành 65°, tính lại đáp án đúng = 115° và các nhiễu."
    }
   ]
  }
 },
 {
  "id": "hk1-exam6",
  "title": "HK1 Exam 6",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Tập hợp các số hữu tỉ được kí hiệu là gì?",
    "options": [
     "ℚ",
     "ℕ",
     "ℤ",
     "ℝ"
    ],
    "correct": 0,
    "answer": "ℚ",
    "explanation": "🔑 Tập hợp các số hữu tỉ được kí hiệu là ℚ.<br>✗ ℕ: đây là kí hiệu tập hợp số tự nhiên.<br>✗ ℤ: đây là kí hiệu tập hợp số nguyên.<br>✗ ℝ: đây là kí hiệu tập hợp số thực (rộng hơn ℚ).",
    "source": "hk1e6-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Số 0,454545... (nhóm chữ số 45 lặp lại mãi) là loại số thập phân nào?",
    "options": [
     "Thập phân vô hạn không tuần hoàn, là số vô tỉ",
     "Thập phân vô hạn tuần hoàn, là số hữu tỉ",
     "Thập phân hữu hạn, là số hữu tỉ",
     "Thập phân vô hạn tuần hoàn, là số vô tỉ"
    ],
    "correct": 1,
    "answer": "Thập phân vô hạn tuần hoàn, là số hữu tỉ",
    "explanation": "🔑 Phần thập phân có nhóm '45' lặp lại mãi mãi nên đây là số thập phân vô hạn tuần hoàn, và mọi số thập phân vô hạn tuần hoàn đều là số hữu tỉ.<br>✗ Thập phân vô hạn không tuần hoàn, là số vô tỉ: sai vì chữ số có lặp lại theo chu kì '45'.<br>✗ Thập phân hữu hạn, là số hữu tỉ: sai vì phần thập phân kéo dài vô hạn, không dừng.<br>✗ Thập phân vô hạn tuần hoàn, là số vô tỉ: sai vì số thập phân vô hạn tuần hoàn luôn là số hữu tỉ, không phải vô tỉ.",
    "source": "hk1e6-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Căn bậc hai số học của một số dương a được kí hiệu là gì?",
    "options": [
     "a",
     "|a|",
     "√a",
     "a²"
    ],
    "correct": 2,
    "answer": "√a",
    "explanation": "🔑 Căn bậc hai số học của số dương a được kí hiệu là √a (số không âm mà bình phương bằng a).<br>✗ a: đây là chính số a, không phải kí hiệu căn.<br>✗ |a|: đây là kí hiệu giá trị tuyệt đối của a.<br>✗ a²: đây là kí hiệu bình phương của a.",
    "source": "hk1e6-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tính |−23|.",
    "options": [
     "−23",
     "0",
     "46",
     "23"
    ],
    "correct": 3,
    "answer": "23",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm là số đối của nó: |−23| = 23.<br>✗ −23: đây là số đã cho, chưa lấy giá trị tuyệt đối.<br>✗ 0: chỉ đúng khi số bên trong bằng 0.<br>✗ 46: nhân nhầm với 2 thay vì lấy số đối.",
    "source": "hk1e6-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 7,483 đến chữ số thập phân thứ nhất.",
    "options": [
     "7,5",
     "7,4",
     "7,48",
     "7,0"
    ],
    "correct": 0,
    "answer": "7,5",
    "explanation": "🔑 Chữ số thập phân thứ hai là 8 (≥ 5) nên làm tròn lên: 7,483 ≈ 7,5.<br>✗ 7,4: giữ nguyên chữ số hàng thập phân thứ nhất mà không làm tròn lên.<br>✗ 7,48: đây là làm tròn đến chữ số thập phân thứ hai, không đúng yêu cầu.<br>✗ 7,0: làm tròn đến hàng đơn vị, không đúng yêu cầu đến chữ số thập phân thứ nhất.",
    "source": "hk1e6-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Với n là số tự nhiên khác 0, giá trị của 0ⁿ là bao nhiêu?",
    "options": [
     "1",
     "0",
     "n",
     "Không xác định"
    ],
    "correct": 1,
    "answer": "0",
    "explanation": "🔑 Với n ≠ 0, 0ⁿ = 0 vì 0 nhân với chính nó nhiều lần vẫn bằng 0.<br>✗ 1: đó là giá trị của x⁰ khi x ≠ 0, không áp dụng cho cơ số 0.<br>✗ n: nhầm cơ số với số mũ.<br>✗ Không xác định: 0ⁿ vẫn có nghĩa và xác định khi n > 0.",
    "source": "hk1e6-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc kề bù",
    "q": "Hai góc kề bù có một góc bằng 72°. Số đo góc còn lại là bao nhiêu?",
    "fig": {
     "t": "ke-bu",
     "a": 72,
     "l": [
      "72°",
      "?"
     ]
    },
    "options": [
     "72°",
     "18°",
     "108°",
     "162°"
    ],
    "correct": 2,
    "answer": "108°",
    "explanation": "🔑 Hai góc kề bù có tổng số đo bằng 180°, nên góc còn lại = 180° − 72° = 108°.<br>✗ 72°: nhầm là hai góc kề bù luôn bằng nhau.<br>✗ 18°: tính nhầm 90° − 72°.<br>✗ 162°: tính nhầm 180° − 18°.",
    "source": "hk1e6-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠xOy = 46° và Oz là tia phân giác của ∠xOy. Số đo ∠xOz bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 46,
     "lw": "46°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "46°",
     "92°",
     "11,5°",
     "23°"
    ],
    "correct": 3,
    "answer": "23°",
    "explanation": "🔑 Oz là tia phân giác nên ∠xOz = ∠zOy = ½∠xOy = ½ · 46° = 23°.<br>✗ 46°: nhầm ∠xOz bằng cả góc ∠xOy.<br>✗ 92°: tính nhầm gấp đôi thay vì chia đôi.<br>✗ 11,5°: chia nhầm cho 4 thay vì chia cho 2.",
    "source": "hk1e6-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Hai đường thẳng song song",
    "q": "Hai đường thẳng phân biệt trong cùng một mặt phẳng mà không cắt nhau thì được gọi là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "two-lines"
    },
    "options": [
     "Hai đường thẳng song song",
     "Hai đường thẳng vuông góc",
     "Hai đường thẳng trùng nhau",
     "Hai đường thẳng cắt nhau"
    ],
    "correct": 0,
    "answer": "Hai đường thẳng song song",
    "explanation": "🔑 Theo định nghĩa, hai đường thẳng phân biệt không có điểm chung (không cắt nhau) được gọi là hai đường thẳng song song.<br>✗ Hai đường thẳng vuông góc: đây là trường hợp đặc biệt của hai đường thẳng CẮT nhau tạo góc 90°.<br>✗ Hai đường thẳng trùng nhau: đây là trường hợp có vô số điểm chung, không phải hai đường thẳng phân biệt không cắt nhau.<br>✗ Hai đường thẳng cắt nhau: đây là trường hợp có đúng một điểm chung, trái với giả thiết không cắt nhau.",
    "source": "hk1e6-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Khái niệm định lí",
    "q": "Trong một định lí, phần nêu ra điều đã cho biết trước được gọi là gì?",
    "options": [
     "Kết luận",
     "Giả thiết",
     "Chứng minh",
     "Định nghĩa"
    ],
    "correct": 1,
    "answer": "Giả thiết",
    "explanation": "🔑 Một định lí gồm hai phần: giả thiết (điều cho biết trước) và kết luận (điều suy ra); phần cho trước gọi là giả thiết.<br>✗ Kết luận: đây là phần được suy ra từ giả thiết, không phải điều cho trước.<br>✗ Chứng minh: đây là quá trình lập luận để đi từ giả thiết đến kết luận, không phải một phần cấu tạo định lí.<br>✗ Định nghĩa: đây là một khái niệm khác dùng để giải thích một thuật ngữ, không phải thành phần của định lí.",
    "source": "hk1e6-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác ABC có ∠A = 72°, ∠B = 55°. Số đo ∠C là bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "A",
      "B",
      "C"
     ],
     "angles": {
      "A": "72°",
      "B": "55°",
      "C": "?"
     }
    },
    "options": [
     "55°",
     "72°",
     "53°",
     "127°"
    ],
    "correct": 2,
    "answer": "53°",
    "explanation": "🔑 Tổng ba góc trong tam giác bằng 180°, nên ∠C = 180° − 72° − 55° = 53°.<br>✗ 55°: nhầm với số đo ∠B đã cho.<br>✗ 72°: nhầm với số đo ∠A đã cho.<br>✗ 127°: quên trừ, chỉ cộng 72° + 55°.",
    "source": "hk1e6-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Số lượng sách mỗi bạn mượn trong tháng (0; 1; 2; 3; …) là loại dữ liệu nào?",
    "options": [
     "Định tính (không là số)",
     "Không phải dữ liệu",
     "Định tính có thể sắp thứ tự",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Số lượng sách mượn là các con số đếm được (0; 1; 2; 3; …) nên đây là dữ liệu định lượng.<br>✗ Định tính (không là số): sai vì số lượng sách chính là các con số, đo đếm được.<br>✗ Không phải dữ liệu: sai vì đây vẫn là thông tin thống kê được, là dữ liệu hợp lệ.<br>✗ Định tính có thể sắp thứ tự: sai vì đây là dữ liệu dạng số (định lượng), không phải dữ liệu định tính.",
    "source": "hk1e6-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tính giá trị biểu thức: 5/6 − 1/3 · (−1)².",
    "options": [
     "1/2",
     "7/6",
     "2/3",
     "−1/6"
    ],
    "correct": 0,
    "answer": "1/2",
    "explanation": "🔑 Tính lũy thừa trước: (−1)² = 1, được 5/6 − 1/3 · 1 = 5/6 − 2/6 = 3/6 = 1/2.<br>✗ 7/6: quên bình phương, tính (−1)² = −1 nên ra 5/6 + 1/3.<br>✗ 2/3: đổi sai 1/3 thành 1/6 rồi trừ nhầm.<br>✗ −1/6: trừ nhầm thứ tự 1/3 − 5/6.",
    "source": "hk1e6-TL1"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết x − 5/8 = 1/8. Giá trị của x là bao nhiêu?",
    "options": [
     "1/2",
     "3/4",
     "−1/2",
     "1"
    ],
    "correct": 1,
    "answer": "3/4",
    "explanation": "🔑 Quy tắc chuyển vế: x − 5/8 = 1/8 ⇒ x = 1/8 + 5/8 = 6/8 = 3/4.<br>✗ 1/2: nhầm là x = 5/8 − 1/8.<br>✗ −1/2: quên đổi dấu, tính x = 1/8 − 5/8.<br>✗ 1: cộng nhầm 5/8 + 3/8 thay vì 5/8 + 1/8.",
    "source": "hk1e6-TL2"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm số tự nhiên x, biết 3ˣ = 81.",
    "options": [
     "3",
     "5",
     "4",
     "27"
    ],
    "correct": 2,
    "answer": "4",
    "explanation": "🔑 3⁴ = 81 nên x = 4.<br>✗ 3: vì 3³ = 27 ≠ 81, chưa đủ số mũ.<br>✗ 5: vì 3⁵ = 243 ≠ 81, số mũ lớn hơn cần thiết.<br>✗ 27: nhầm lấy 81 : 3 = 27 rồi lấy làm x.",
    "source": "hk1e6-TL3"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán giảm giá",
    "q": "Một chiếc áo có giá gốc 250 000 đồng được giảm giá 12%. Hỏi giá bán sau khi giảm là bao nhiêu?",
    "options": [
     "215 000 đồng",
     "230 000 đồng",
     "30 000 đồng",
     "220 000 đồng"
    ],
    "correct": 3,
    "answer": "220 000 đồng",
    "explanation": "🔑 Số tiền giảm = 250 000 · 12% = 30 000 đồng; giá bán = 250 000 − 30 000 = 220 000 đồng.<br>✗ 215 000 đồng: tính sai số tiền giảm rồi trừ nhầm.<br>✗ 230 000 đồng: trừ nhầm số tiền giảm.<br>✗ 30 000 đồng: đây là số tiền được giảm, không phải giá bán.",
    "source": "hk1e6-TL4"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Số đối",
    "q": "Tổng của một số hữu tỉ x và số đối của 7/4 bằng 5/4. Tìm x.",
    "options": [
     "3",
     "−1/2",
     "−3",
     "3/2"
    ],
    "correct": 0,
    "answer": "3",
    "explanation": "🔑 Số đối của 7/4 là −7/4; theo đề bài x + (−7/4) = 5/4, suy ra x = 5/4 + 7/4 = 12/4 = 3.<br>✗ −1/2: quên lấy số đối, giải nhầm phương trình x + 7/4 = 5/4.<br>✗ −3: đổi dấu nhầm cả hai vế, tính x = −5/4 − 7/4.<br>✗ 3/2: cộng nhầm tử số trên cùng mẫu 8, tính (5+7)/8 thay vì quy đồng đúng mẫu 4.",
    "source": "hk1e6-TL5"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Tính √144 + |−11| − √64.",
    "options": [
     "8",
     "15",
     "31",
     "−7"
    ],
    "correct": 1,
    "answer": "15",
    "explanation": "🔑 √144 = 12, |−11| = 11, √64 = 8, nên 12 + 11 − 8 = 15.<br>✗ 8: chỉ tính √64 mà bỏ sót hai số hạng đầu.<br>✗ 31: cộng nhầm dấu trừ thành dấu cộng ở số hạng cuối (12 + 11 + 8).<br>✗ −7: lấy |−11| = −11 thay vì 11 (số đối).",
    "source": "hk1e6-TL6"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết |x − 3| = 7.",
    "options": [
     "x = 10 hoặc x = 4",
     "x = 7 hoặc x = −7",
     "x = 10 hoặc x = −4",
     "x = 4 hoặc x = −10"
    ],
    "correct": 2,
    "answer": "x = 10 hoặc x = −4",
    "explanation": "🔑 |x − 3| = 7 nghĩa là x − 3 = 7 hoặc x − 3 = −7, suy ra x = 10 hoặc x = −4.<br>✗ x = 10 hoặc x = 4: tính sai trường hợp thứ hai, quên đổi dấu đúng (3 − 7 = −4 chứ không phải 4).<br>✗ x = 7 hoặc x = −7: nhầm lẫn giữa |x − 3| = 7 với |x| = 7.<br>✗ x = 4 hoặc x = −10: đổi dấu nhầm ở cả hai trường hợp.",
    "source": "hk1e6-TL7"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Một mảnh đất hình vuông có diện tích 760 m². Tính độ dài cạnh mảnh đất đó (làm tròn kết quả đến chữ số thập phân thứ nhất).",
    "options": [
     "27,5 m",
     "27,57 m",
     "760 m",
     "27,6 m"
    ],
    "correct": 3,
    "answer": "27,6 m",
    "explanation": "🔑 Cạnh = √760 ≈ 27,568 m; làm tròn đến chữ số thập phân thứ nhất được 27,6 m.<br>✗ 27,5 m: làm tròn xuống sai, bỏ qua chữ số hàng phần trăm là 6 (phải làm tròn lên).<br>✗ 27,57 m: làm tròn đến chữ số thập phân thứ hai, không đúng yêu cầu đề bài.<br>✗ 760 m: quên lấy căn bậc hai, lấy luôn diện tích làm cạnh.",
    "source": "hk1e6-TL8"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Góc so le trong",
    "q": "Cho hai đường thẳng a và b song song với nhau, bị cắt bởi đường thẳng c, tạo thành một góc so le trong bằng 72°. Tính số đo góc kề bù với góc so le trong còn lại.",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A3": "72°",
      "B2": "?"
     }
    },
    "options": [
     "108°",
     "72°",
     "18°",
     "36°"
    ],
    "correct": 0,
    "answer": "108°",
    "explanation": "🔑 Vì a ∥ b nên hai góc so le trong bằng nhau, góc so le trong còn lại cũng bằng 72°. Góc kề bù với nó bằng 180° − 72° = 108°.<br>✗ 72°: đây là số đo góc so le trong còn lại, chưa lấy kề bù.<br>✗ 18°: tính nhầm 90° − 72°.<br>✗ 36°: tính nhầm bằng cách chia đôi 72°.",
    "source": "hk1e6-TL9"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Tam giác ABC và tam giác DEF có AB = DE, ∠A = ∠D, AC = DF. Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "A",
       "B",
       "C"
      ],
      [
       "D",
       "E",
       "F"
      ]
     ]
    },
    "options": [
     "c-c-c (cạnh - cạnh - cạnh)",
     "c-g-c (cạnh - góc - cạnh)",
     "g-c-g (góc - cạnh - góc)",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "c-g-c (cạnh - góc - cạnh)",
    "explanation": "🔑 AB = DE, AC = DF và góc xen giữa hai cạnh đó là ∠A = ∠D bằng nhau, nên △ABC = △DEF theo trường hợp c-g-c.<br>✗ c-c-c (cạnh - cạnh - cạnh): dữ kiện chỉ có hai cặp cạnh bằng nhau, không phải ba cặp cạnh.<br>✗ g-c-g (góc - cạnh - góc): dữ kiện có hai cặp cạnh và một góc, không phải hai góc và một cạnh.<br>✗ Không đủ dữ kiện để kết luận: sai vì góc ∠A đã cho đúng là góc xen giữa AB và AC nên đủ điều kiện c-g-c.",
    "source": "hk1e6-TL10"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác vuông",
    "q": "Một mảnh đất hình tam giác vuông có độ dài hai cạnh góc vuông lần lượt là x (m) và 2x (m) (x > 0), diện tích mảnh đất bằng 128 m². Tính x (làm tròn kết quả đến chữ số thập phân thứ hai).",
    "fig": {
     "t": "tam-giac-vuong",
     "v": [
      "A",
      "B",
      "C"
     ],
     "sides": [
      "2x",
      "x"
     ],
     "area": "S = 128 m²"
    },
    "options": [
     "8,00 m",
     "11,32 m",
     "11,31 m",
     "22,63 m"
    ],
    "correct": 2,
    "answer": "11,31 m",
    "explanation": "🔑 Diện tích tam giác vuông = (x · 2x) : 2 = x² = 128, suy ra x = √128 ≈ 11,3137, làm tròn đến chữ số thập phân thứ hai được x ≈ 11,31 m.<br>✗ 8,00 m: quên chia đôi diện tích, giải nhầm 2x² = 128.<br>✗ 11,32 m: làm tròn sai chiều ở chữ số hàng phần nghìn.<br>✗ 22,63 m: đây là độ dài cạnh 2x chứ không phải x.",
    "source": "hk1e6-TL11"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ quạt tròn về phương tiện đến trường của lớp 7B cho biết: xe đạp 35%, đi bộ 25%, xe buýt 20%, phần còn lại là được đưa đón bằng ô tô. Tỉ lệ học sinh được đưa đón bằng ô tô chiếm bao nhiêu phần trăm?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Xe đạp", "value": 35 }, { "label": "Đi bộ", "value": 25 }, { "label": "Xe buýt", "value": 20 }, { "label": "Ô tô", "value": 20, "text": "?" }] },
    "options": [
     "15%",
     "25%",
     "30%",
     "20%"
    ],
    "correct": 3,
    "answer": "20%",
    "explanation": "🔑 Tổng tỉ lệ phần trăm của biểu đồ quạt tròn bằng 100%: 100% − 35% − 25% − 20% = 20%.<br>✗ 15%: cộng nhầm ba tỉ lệ đã cho thành 85% thay vì 80%.<br>✗ 25%: nhầm với tỉ lệ đi bộ đã cho.<br>✗ 30%: cộng thiếu một tỉ lệ khi tính tổng ba phần đã biết.",
    "source": "hk1e6-TL12"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng ghi lại số xe đạp bán được của một cửa hàng: tháng 1: 40 xe; tháng 2: 55 xe; tháng 3: 65 xe; tháng 4: 80 xe. Tổng số xe đạp cửa hàng bán được trong 4 tháng đó là bao nhiêu?",
    "fig": { "t": "line-chart", "labels": ["T1", "T2", "T3", "T4"], "values": [40, 55, 65, 80] },
    "options": [
     "240 xe",
     "220 xe",
     "200 xe",
     "260 xe"
    ],
    "correct": 0,
    "answer": "240 xe",
    "explanation": "🔑 Tổng số xe = 40 + 55 + 65 + 80 = 240 xe.<br>✗ 220 xe: cộng thiếu, bỏ sót 20 xe khi tính tổng.<br>✗ 200 xe: cộng nhầm, chỉ lấy ba tháng đầu (40 + 55 + 65 = 160) rồi cộng sai.<br>✗ 260 xe: cộng thừa 20 xe so với kết quả đúng.",
    "source": "hk1e6-TL13"
   }
  ],
  "report": {
   "structureVsPdf": "Q1-12 nhận biết follow the spec topic order (kí hiệu tập → hữu tỉ/vô tỉ → căn bậc hai → GTTĐ → làm tròn → lũy thừa → góc kề bù → tia phân giác → song song → định lí → tam giác → dữ liệu), matching the model paper skill coverage; chapter quota exact 7/7/5/3/3, correct-answer spread 7/6/6/6.",
   "edits": [
    {
     "n": 4,
     "what": "Collision with Exam 5 #4 (|−15|) — changed constant to |−23|=23, all distractors and explanation renumbered."
    },
    {
     "n": 8,
     "what": "Collision with Exam 5 #8 (∠xOy=54°) — changed to ∠xOy=46°, ∠xOz=23°, distractors and explanation renumbered."
    },
    {
     "n": 17,
     "what": "Duplicate of Exam 1 #16 AND used chia tỉ lệ (chương 6, Tập 2 — forbidden by curriculum rule E). Dropped and replaced with a ch1 số-đối/chuyển-vế problem: \"x + số đối của 7/4 = 5/4\" (x=3), topic changed Chia tỉ lệ → Số đối."
    },
    {
     "n": 18,
     "what": "√81 duplicated an exact constant from the model PDF (Bài 1a: √9+√81−√16). Changed to √144+|−11|−√64=15 to stay fresh vs. the model paper."
    }
   ]
  }
 },
 {
  "id": "hk1-exam7",
  "title": "HK1 Exam 7",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Trong các số sau, số nào là số hữu tỉ âm?",
    "options": [
     "−5/8",
     "5/8",
     "0",
     "3"
    ],
    "correct": 0,
    "answer": "−5/8",
    "explanation": "🔑 Số hữu tỉ âm là số hữu tỉ nhỏ hơn 0; trong bốn số, chỉ −5/8 &lt; 0 nên là số hữu tỉ âm.<br>✗ 5/8: là số hữu tỉ dương vì lớn hơn 0.<br>✗ 0: không là số âm cũng không là số dương.<br>✗ 3: là số hữu tỉ dương (viết được 3 = 3/1) lớn hơn 0.",
    "source": "hk1-exam7-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Trong bốn số sau, số nào là số vô tỉ?",
    "options": [
     "1,272727...",
     "√7",
     "−8/3",
     "5,5"
    ],
    "correct": 1,
    "answer": "√7",
    "explanation": "🔑 Số vô tỉ là số thập phân vô hạn KHÔNG tuần hoàn; √7 = 2,6457513... không tuần hoàn nên là số vô tỉ, còn ba số kia đều là số hữu tỉ.<br>✗ 1,272727...: là số thập phân vô hạn TUẦN HOÀN (nhóm 27 lặp lại) nên là số hữu tỉ.<br>✗ −8/3: là phân số nên là số hữu tỉ.<br>✗ 5,5: là số thập phân hữu hạn nên là số hữu tỉ.",
    "source": "hk1-exam7-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Căn bậc hai số học của 169 là số nào?",
    "options": [
     "−13",
     "84,5",
     "13",
     "13 và −13"
    ],
    "correct": 2,
    "answer": "13",
    "explanation": "🔑 Căn bậc hai số học của một số a ≥ 0 là số x ≥ 0 sao cho x² = a; vì 13² = 169 và 13 ≥ 0 nên √169 = 13.<br>✗ −13: tuy (−13)² = 169 nhưng −13 &lt; 0 nên không phải là căn bậc hai số học.<br>✗ 84,5: là kết quả của phép tính sai 169 : 2, không liên quan đến căn bậc hai.<br>✗ 13 và −13: đây là cả hai căn bậc hai của 169, còn căn bậc hai SỐ HỌC chỉ lấy giá trị không âm.",
    "source": "hk1-exam7-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tính |−18|.",
    "options": [
     "−18",
     "0",
     "1/18",
     "18"
    ],
    "correct": 3,
    "answer": "18",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm bằng số đối của nó: |−18| = 18.<br>✗ −18: đây là giữ nguyên dấu âm, không lấy số đối.<br>✗ 0: chỉ đúng khi số đã cho bằng 0, không phải trường hợp này.<br>✗ 1/18: nhầm giá trị tuyệt đối với số nghịch đảo.",
    "source": "hk1-exam7-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 5,2749 đến hàng phần trăm.",
    "options": [
     "5,27",
     "5,28",
     "5,3",
     "5,275"
    ],
    "correct": 0,
    "answer": "5,27",
    "explanation": "🔑 Làm tròn đến hàng phần trăm: giữ hai chữ số thập phân, xét chữ số hàng phần nghìn (4) để làm tròn; vì 4 &lt; 5 nên giữ nguyên: 5,2749 ≈ 5,27.<br>✗ 5,28: làm tròn lên sai vì chữ số hàng phần nghìn là 4 (nhỏ hơn 5) nên không được làm tròn lên.<br>✗ 5,3: đây là làm tròn đến hàng phần mười, không đúng yêu cầu hàng phần trăm.<br>✗ 5,275: chưa làm tròn, chỉ là cắt bớt chữ số cuối.",
    "source": "hk1-exam7-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Lũy thừa bậc n của số hữu tỉ x (n là số tự nhiên, n > 1) được định nghĩa là gì?",
    "options": [
     "xⁿ = x · n",
     "xⁿ = x · x · … · x (n thừa số x)",
     "xⁿ = x + x + … + x (n số hạng)",
     "xⁿ = n · n · … · n (x thừa số n)"
    ],
    "correct": 1,
    "answer": "xⁿ = x · x · … · x (n thừa số x)",
    "explanation": "🔑 Theo định nghĩa, lũy thừa bậc n của x là tích của n thừa số bằng nhau, mỗi thừa số bằng x: xⁿ = x · x · … · x (n thừa số x).<br>✗ xⁿ = x · n: nhầm lũy thừa với phép nhân x với n.<br>✗ xⁿ = x + x + … + x (n số hạng): đây là công thức của tích n · x (phép cộng lặp), không phải lũy thừa.<br>✗ xⁿ = n · n · … · n (x thừa số n): nhầm vai trò của cơ số và số mũ.",
    "source": "hk1-exam7-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc đối đỉnh",
    "q": "Hai góc được gọi là hai góc đối đỉnh khi nào?",
    "fig": {
     "t": "doi-dinh",
     "a": 50,
     "l": [
      "∠1",
      "",
      "∠3",
      ""
     ]
    },
    "options": [
     "Hai góc có chung một cạnh và tổng số đo bằng 180°",
     "Hai góc bằng nhau và cùng chung đỉnh",
     "Mỗi cạnh của góc này là tia đối của một cạnh góc kia",
     "Hai góc có chung đỉnh và không có cạnh nào trùng nhau"
    ],
    "correct": 2,
    "answer": "Mỗi cạnh của góc này là tia đối của một cạnh góc kia",
    "explanation": "🔑 Định nghĩa: hai góc đối đỉnh là hai góc mà mỗi cạnh của góc này là tia đối của một cạnh của góc kia.<br>✗ Hai góc có chung một cạnh và tổng số đo bằng 180°: đây là định nghĩa của hai góc KỀ BÙ, không phải đối đỉnh.<br>✗ Hai góc bằng nhau và cùng chung đỉnh: hai góc đối đỉnh thì bằng nhau nhưng đây không phải định nghĩa (hai góc bằng nhau chung đỉnh chưa chắc đối đỉnh).<br>✗ Hai góc có chung đỉnh và không có cạnh nào trùng nhau: điều kiện này chưa đủ và không đúng với định nghĩa đối đỉnh.",
    "source": "hk1-exam7-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠mIn = 56° và Ip là tia phân giác của ∠mIn. Số đo ∠mIp bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 56,
     "names": [
      "m",
      "n",
      "p",
      "I"
     ],
     "lw": "56°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "56°",
     "112°",
     "14°",
     "28°"
    ],
    "correct": 3,
    "answer": "28°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau, mỗi góc bằng nửa góc ban đầu: ∠mIp = 56° : 2 = 28°.<br>✗ 56°: đây là số đo cả góc ∠mIn, chưa chia đôi.<br>✗ 112°: nhầm phép chia đôi thành phép nhân đôi (56° × 2).<br>✗ 14°: chia góc cho 4 thay vì chia cho 2.",
    "source": "hk1-exam7-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng phân biệt a và b, tạo thành một cặp góc trong cùng phía có tổng số đo bằng 180°. Kết luận nào đúng?",
    "fig": {
     "t": "cut2",
     "angles": {
      "A4": "∠A",
      "B1": "∠B"
     }
    },
    "options": [
     "a ∥ b",
     "a ⊥ b",
     "a và b cắt nhau",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 0,
    "answer": "a ∥ b",
    "explanation": "🔑 Dấu hiệu nhận biết: nếu một cặp góc trong cùng phía có tổng số đo bằng 180° thì hai đường thẳng đó song song, nên a ∥ b.<br>✗ a ⊥ b: không thể kết luận vuông góc chỉ từ dữ kiện góc trong cùng phía bù nhau.<br>✗ a và b cắt nhau: sai vì hai đường thẳng phân biệt chỉ cắt nhau khi KHÔNG song song, trái với dấu hiệu đã cho.<br>✗ Không đủ dữ kiện để kết luận: sai vì tổng hai góc trong cùng phía bằng 180° chính là dấu hiệu đủ để kết luận song song.",
    "source": "hk1-exam7-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Định lí – Giả thiết, kết luận",
    "q": "Trong một định lí toán học được phát biểu dưới dạng 'Nếu … thì …', phần đứng sau từ 'Nếu' được gọi là gì?",
    "options": [
     "Kết luận (KL)",
     "Giả thiết (GT)",
     "Định nghĩa",
     "Tiên đề"
    ],
    "correct": 1,
    "answer": "Giả thiết (GT)",
    "explanation": "🔑 Trong định lí dạng 'Nếu A thì B', phần A (điều đã cho, đứng sau 'Nếu') gọi là giả thiết (GT); phần B (điều suy ra, đứng sau 'thì') gọi là kết luận (KL).<br>✗ Kết luận (KL): đây là phần đứng sau từ 'thì', không phải sau từ 'Nếu'.<br>✗ Định nghĩa: định nghĩa là cách giải thích một khái niệm, khác với giả thiết của định lí.<br>✗ Tiên đề: tiên đề là khẳng định được thừa nhận không chứng minh, không phải là một phần cấu trúc của định lí.",
    "source": "hk1-exam7-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác DEF có ∠D = 75°, ∠E = 45°. Số đo ∠F bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "D",
      "E",
      "F"
     ],
     "angles": {
      "D": "75°",
      "E": "45°",
      "F": "?"
     }
    },
    "options": [
     "70°",
     "55°",
     "60°",
     "65°"
    ],
    "correct": 2,
    "answer": "60°",
    "explanation": "🔑 Tổng ba góc trong một tam giác bằng 180°, nên ∠F = 180° − 75° − 45° = 60°.<br>✗ 70°: tính nhầm phép trừ 180° − 75° − 45°.<br>✗ 55°: cộng nhầm hai góc đã cho (75° + 45° = 120°) rồi trừ sai cho 180°.<br>✗ 65°: trừ thiếu hoặc thừa một vài độ do tính nhầm.",
    "source": "hk1-exam7-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Số lượng sách mỗi bạn mượn trong tháng tại thư viện trường là loại dữ liệu nào?",
    "options": [
     "Định tính (không là số)",
     "Không phải là dữ liệu",
     "Định tính có thể sắp thứ tự",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Dữ liệu định lượng là dữ liệu ở dạng số; số lượng sách mượn được đếm bằng số (0, 1, 2, …) nên là dữ liệu định lượng.<br>✗ Định tính (không là số): sai vì số lượng sách là con số đếm được, không phải nhãn/tên gọi.<br>✗ Không phải là dữ liệu: sai vì đây vẫn là một loại dữ liệu thống kê hợp lệ.<br>✗ Định tính có thể sắp thứ tự: nhầm dữ liệu định lượng với dữ liệu định tính có thứ tự (như xếp loại Giỏi/Khá/…).",
    "source": "hk1-exam7-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: x + 5/6 = 1/4.",
    "options": [
     "−7/12",
     "7/12",
     "−13/12",
     "13/12"
    ],
    "correct": 0,
    "answer": "−7/12",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 1/4 − 5/6 = 3/12 − 10/12 = −7/12.<br>✗ 7/12: làm mất dấu trừ khi quy đồng, quên số âm.<br>✗ −13/12: cộng nhầm 1/4 và 5/6 thay vì trừ (3/12 + 10/12 = 13/12) rồi giữ dấu âm.<br>✗ 13/12: cộng nhầm hai phân số thay vì trừ.",
    "source": "hk1-exam7-TL1a"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Tìm x, biết: x³ = −64.",
    "options": [
     "4",
     "−4",
     "−8",
     "8"
    ],
    "correct": 1,
    "answer": "−4",
    "explanation": "🔑 Vì (−4)³ = (−4) · (−4) · (−4) = −64, nên x = −4.<br>✗ 4: vì 4³ = 64 (dương), không bằng −64.<br>✗ −8: vì (−8)³ = −512, không bằng −64.<br>✗ 8: dấu và giá trị đều sai vì 8³ = 512.",
    "source": "hk1-exam7-TL1b"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Bốn phép tính với số hữu tỉ",
    "q": "Thực hiện phép tính: 3/5 + 2/3 − 4/15.",
    "options": [
     "23/15",
     "−1/3",
     "1",
     "7/15"
    ],
    "correct": 2,
    "answer": "1",
    "explanation": "🔑 Quy đồng mẫu 15: 3/5 = 9/15, 2/3 = 10/15, giữ 4/15; tính 9/15 + 10/15 − 4/15 = 15/15 = 1.<br>✗ 23/15: cộng nhầm dấu, lấy 9/15 + 10/15 + 4/15 thay vì trừ số hạng cuối.<br>✗ −1/3: đổi nhầm dấu số hạng thứ hai, tính 9/15 − 10/15 − 4/15 = −5/15 = −1/3.<br>✗ 7/15: quy đồng sai 4/15 thành 12/15 rồi tính 9/15 + 10/15 − 12/15 = 7/15.",
    "source": "hk1-exam7-TL1c"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Giảm giá phần trăm",
    "q": "Một cửa hàng thời trang bán một chiếc áo khoác với giá niêm yết 800 000 đồng. Nhân dịp khai trương, cửa hàng giảm giá 10%, sau đó giảm tiếp 5% trên giá đã giảm cho khách hàng thành viên. Hỏi khách hàng thành viên phải trả bao nhiêu tiền để mua chiếc áo khoác đó?",
    "options": [
     "760 000 đồng",
     "640 000 đồng",
     "720 000 đồng",
     "684 000 đồng"
    ],
    "correct": 3,
    "answer": "684 000 đồng",
    "explanation": "🔑 Giảm 10% lần một: 800 000 × 0,9 = 720 000 đồng; giảm tiếp 5% trên giá mới: 720 000 × 0,95 = 684 000 đồng.<br>✗ 760 000 đồng: chỉ tính giảm 5% trên giá niêm yết, bỏ sót lần giảm 10% đầu tiên.<br>✗ 640 000 đồng: nhầm cộng gộp hai mức giảm thành 20% (10% + 10%) rồi trừ thẳng vào giá niêm yết: 800 000 × 0,8 = 640 000.<br>✗ 720 000 đồng: mới chỉ tính giảm giá lần một (10%), quên giảm tiếp 5% lần hai.",
    "source": "hk1-exam7-TL5a"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Bài toán thực tế với phân số",
    "q": "Một đội tình nguyện có 90 người. Ban tổ chức chia 2/5 số người vào nhóm hỗ trợ y tế, 1/3 số người vào nhóm hậu cần, số còn lại vào nhóm truyền thông. Hỏi nhóm truyền thông có bao nhiêu người?",
    "options": [
     "24",
     "30",
     "36",
     "54"
    ],
    "correct": 0,
    "answer": "24",
    "explanation": "🔑 Nhóm y tế: 90 × 2/5 = 36 người; nhóm hậu cần: 90 × 1/3 = 30 người; nhóm truyền thông: 90 − 36 − 30 = 24 người.<br>✗ 30: đây là số người nhóm hậu cần, không phải nhóm truyền thông.<br>✗ 36: đây là số người nhóm y tế, không phải nhóm truyền thông.<br>✗ 54: chỉ trừ đi nhóm y tế (90 − 36 = 54), quên trừ tiếp nhóm hậu cần.",
    "source": "hk1-exam7-TL2"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Thực hiện phép tính: √64 + |−15| − √25.",
    "options": [
     "−12",
     "18",
     "23",
     "28"
    ],
    "correct": 1,
    "answer": "18",
    "explanation": "🔑 Tính từng số hạng: √64 = 8, |−15| = 15, √25 = 5; sau đó 8 + 15 − 5 = 18.<br>✗ −12: đổi dấu nhầm |−15| thành −15 rồi tính 8 − 15 − 5 = −12.<br>✗ 23: quên trừ √25, chỉ tính 8 + 15 = 23.<br>✗ 28: cộng nhầm cả ba số thay vì trừ số hạng cuối: 8 + 15 + 5 = 28.",
    "source": "hk1-exam7-TL1d"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x + 2| = 9.",
    "options": [
     "x = 7",
     "x = −11",
     "x = 7 hoặc x = −11",
     "x = 11 hoặc x = −7"
    ],
    "correct": 2,
    "answer": "x = 7 hoặc x = −11",
    "explanation": "🔑 Với |x + 2| = 9, xảy ra hai trường hợp: x + 2 = 9 ⇒ x = 7, hoặc x + 2 = −9 ⇒ x = −11. Vậy x = 7 hoặc x = −11.<br>✗ x = 7: chỉ xét trường hợp x + 2 = 9, bỏ sót trường hợp còn lại.<br>✗ x = −11: chỉ xét trường hợp x + 2 = −9, bỏ sót trường hợp x + 2 = 9.<br>✗ x = 11 hoặc x = −7: đổi dấu ngược khi chuyển 2 sang vế phải, tính sai bước chuyển vế.",
    "source": "hk1-exam7-TL2c"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một khu vườn hình vuông có diện tích 225 m². Tính chu vi khu vườn đó.",
    "options": [
     "15 m",
     "225 m",
     "30 m",
     "60 m"
    ],
    "correct": 3,
    "answer": "60 m",
    "explanation": "🔑 Cạnh của khu vườn: √225 = 15 m; chu vi hình vuông bằng 4 lần cạnh: 15 × 4 = 60 m.<br>✗ 15 m: đây là độ dài một cạnh, chưa nhân với 4 để ra chu vi.<br>✗ 225 m: nhầm số đo diện tích (m²) thành chu vi (m).<br>✗ 30 m: nhầm công thức chu vi hình chữ nhật (2 × cạnh) thay vì hình vuông (4 × cạnh).",
    "source": "hk1-exam7-TL3b"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho a ∥ b và đường thẳng c cắt a tại A, cắt b tại B. Biết một góc tại đỉnh A bằng 72° và góc đó so le trong với một góc tại đỉnh B. Số đo góc kề bù với góc tại đỉnh B nói trên bằng bao nhiêu?",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A3": "72°",
      "B2": "?"
     }
    },
    "options": [
     "108°",
     "72°",
     "18°",
     "252°"
    ],
    "correct": 0,
    "answer": "108°",
    "explanation": "🔑 Vì a ∥ b nên hai góc so le trong bằng nhau: góc tại B = 72°; góc kề bù với góc đó bằng 180° − 72° = 108°.<br>✗ 72°: đây mới là số đo góc so le trong tại B, chưa tính tiếp góc kề bù.<br>✗ 18°: tính nhầm hai góc kề bù có tổng bằng 90° thay vì 180°.<br>✗ 252°: tính sai phép trừ, cộng 180° + 72° thay vì lấy 180° − 72°.",
    "source": "hk1-exam7-TL4a"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Tam giác ABC và tam giác DEF có AB = DE, ∠A = ∠D, AC = DF (góc A xen giữa hai cạnh AB và AC; góc D xen giữa hai cạnh DE và DF). Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "A",
       "B",
       "C"
      ],
      [
       "D",
       "E",
       "F"
      ]
     ]
    },
    "options": [
     "cạnh – cạnh – cạnh (c-c-c)",
     "cạnh – góc – cạnh (c-g-c)",
     "góc – cạnh – góc (g-c-g)",
     "Cạnh huyền - góc nhọn"
    ],
    "correct": 1,
    "answer": "cạnh – góc – cạnh (c-g-c)",
    "explanation": "🔑 Hai cạnh AB = DE, AC = DF và góc xen giữa hai cạnh đó bằng nhau (∠A = ∠D) nên △ABC = △DEF theo trường hợp cạnh - góc - cạnh (c-g-c).<br>✗ cạnh – cạnh – cạnh: sai vì chỉ có hai cặp cạnh bằng nhau, không có thông tin về cạnh BC = EF.<br>✗ góc – cạnh – góc: sai vì trường hợp này cần hai góc và cạnh xen giữa, còn dữ kiện đề bài cho hai cạnh và một góc.<br>✗ Cạnh huyền - góc nhọn: sai vì đề bài không cho biết hai tam giác vuông.",
    "source": "hk1-exam7-TL4b"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác MNP cân tại M có ∠N = 68°. Số đo ∠M bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "M",
      "N",
      "P"
     ],
     "angles": {
      "N": "68°",
      "M": "?"
     }
    },
    "options": [
     "68°",
     "112°",
     "44°",
     "56°"
    ],
    "correct": 2,
    "answer": "44°",
    "explanation": "🔑 Tam giác cân tại M có hai góc ở đáy bằng nhau: ∠N = ∠P = 68°; suy ra ∠M = 180° − 68° − 68° = 44°.<br>✗ 68°: nhầm góc ở đỉnh M bằng góc ở đáy, trong khi chỉ hai góc đáy N, P mới bằng nhau.<br>✗ 112°: mới trừ một góc đáy (180° − 68° = 112°), quên trừ tiếp góc đáy còn lại.<br>✗ 56°: tính sai phép trừ 180° − 68° − 68°.",
    "source": "hk1-exam7-TL4c"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Khảo sát 160 học sinh khối 7 về việc có mua sắm online vào đợt giảm giá cuối năm hay không, biểu đồ quạt tròn cho biết 65% học sinh trả lời 'Có mua sắm'. Hỏi có bao nhiêu học sinh trả lời 'Có mua sắm'?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Có", "value": 65 }, { "label": "Không", "value": 35, "text": "?" }] },
    "options": [
     "65 học sinh",
     "96 học sinh",
     "56 học sinh",
     "104 học sinh"
    ],
    "correct": 3,
    "answer": "104 học sinh",
    "explanation": "🔑 Số học sinh trả lời 'Có mua sắm' bằng 65% của 160: 160 × 0,65 = 104 học sinh.<br>✗ 65 học sinh: nhầm lấy đúng con số phần trăm làm số học sinh, quên nhân với tổng số 160.<br>✗ 96 học sinh: tính nhầm 160 × 60% do đọc sai tỉ lệ phần trăm.<br>✗ 56 học sinh: đây là số học sinh trả lời 'Không mua sắm' (160 × 35%), không phải số trả lời 'Có mua sắm'.",
    "source": "hk1-exam7-TL5b"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng cho biết số lượt khách mua hàng tại một cửa hàng trong đợt khuyến mãi: ngày 1: 40 lượt; ngày 2: 55 lượt; ngày 3: 65 lượt; ngày 4: 80 lượt. Tổng số lượt khách mua hàng trong 4 ngày đó là bao nhiêu?",
    "fig": { "t": "line-chart", "labels": ["N1", "N2", "N3", "N4"], "values": [40, 55, 65, 80] },
    "options": [
     "240 lượt",
     "200 lượt",
     "160 lượt",
     "245 lượt"
    ],
    "correct": 0,
    "answer": "240 lượt",
    "explanation": "🔑 Tổng số lượt khách 4 ngày: 40 + 55 + 65 + 80 = 240 lượt.<br>✗ 200 lượt: quên cộng số lượt khách ngày 1 (bỏ sót 40).<br>✗ 160 lượt: quên cộng số lượt khách ngày 4 (bỏ sót 80).<br>✗ 245 lượt: cộng nhầm số liệu ngày 4 thành 85 thay vì 80.",
    "source": "hk1-exam7-TL5c"
   }
  ],
  "report": {
   "structureVsPdf": "TN1-12 order already mirrors the mẫu's ma trận (số hữu tỉ→vô tỉ→căn bậc hai→GTTĐ→làm tròn→lũy thừa→góc đối đỉnh→tia phân giác→dấu hiệu song song→GT/KL→tổng ba góc→loại dữ liệu); chapter quota ch1:7 ch2:7 ch3:5 ch4:3 ch5:3 was already exact; no chương 6/10 content found; numbers already fresh vs the PDF (no reused constants); only fix needed was the Exam-6 collision on Q19.",
   "edits": [
    {
     "n": 19,
     "what": "Q19 duplicated Exam 6 Q19 (|x−3|=7). Changed to |x+2|=9 with new distractors/explanation and answer x = 7 hoặc x = −11 (correct index kept at 2 to preserve the A/B/C/D spread: 7/6/6/6)."
    }
   ]
  }
 },
 {
  "id": "hk1-exam8",
  "title": "HK1 Exam 8",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Trong bốn số sau, số nào là số hữu tỉ?",
    "options": [
     "√11",
     "−5/0",
     "−3/7",
     "−√6"
    ],
    "correct": 2,
    "answer": "−3/7",
    "explanation": "🔑 Số hữu tỉ là số viết được dưới dạng a/b với a, b ∈ ℤ, b ≠ 0: −3/7 thỏa mãn điều kiện đó.<br>✗ √11: 11 không phải số chính phương nên √11 là số vô tỉ.<br>✗ −5/0: mẫu số bằng 0 nên không phải là số hữu tỉ.<br>✗ −√6: 6 không phải số chính phương nên −√6 là số vô tỉ.",
    "source": "hk1-exam8-Q1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Trong các số sau, số nào là số vô tỉ?",
    "options": [
     "0,555... (chữ số 5 lặp lại)",
     "7/11",
     "−2,75",
     "√17"
    ],
    "correct": 3,
    "answer": "√17",
    "explanation": "🔑 17 không phải là bình phương của một số hữu tỉ nên √17 là số thập phân vô hạn không tuần hoàn — số vô tỉ.<br>✗ 0,555...: là số thập phân vô hạn tuần hoàn nên là số hữu tỉ.<br>✗ 7/11: là số hữu tỉ vì viết được dưới dạng phân số.<br>✗ −2,75: là số thập phân hữu hạn nên là số hữu tỉ.",
    "source": "hk1-exam8-Q2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Giá trị của √196 là bao nhiêu?",
    "options": [
     "13",
     "14",
     "15",
     "196"
    ],
    "correct": 1,
    "answer": "14",
    "explanation": "🔑 Vì 14² = 196 và 14 ≥ 0 nên √196 = 14 (định nghĩa căn bậc hai số học).<br>✗ 13: vì 13² = 169 ≠ 196.<br>✗ 15: vì 15² = 225 ≠ 196.<br>✗ 196: nhầm giữa số dưới căn và kết quả của căn bậc hai.",
    "source": "hk1-exam8-Q3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Số −17 là số âm. Vậy |−17| bằng gì?",
    "options": [
     "Chính nó, tức là −17",
     "Số đối của nó, tức là 17",
     "0",
     "Số đối của 17, tức là −17"
    ],
    "correct": 1,
    "answer": "Số đối của nó, tức là 17",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm bằng số đối của nó: |−17| = 17.<br>✗ Chính nó, tức là −17: đây là quy tắc cho số dương, không áp dụng cho số âm.<br>✗ 0: chỉ đúng khi số đó bằng 0.<br>✗ Số đối của 17, tức là −17: nhầm lấy số đối của 17 thay vì của −17.",
    "source": "hk1-exam8-Q4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 7 483 đến hàng trăm là bao nhiêu?",
    "options": [
     "7400",
     "7500",
     "7480",
     "7000"
    ],
    "correct": 1,
    "answer": "7500",
    "explanation": "🔑 Hàng trăm của 7 483 là chữ số 4; chữ số hàng chục liền sau là 8 ≥ 5 nên làm tròn lên: 7 483 ≈ 7 500.<br>✗ 7400: làm tròn xuống sai vì chữ số hàng chục là 8 ≥ 5, phải làm tròn lên.<br>✗ 7480: đây là làm tròn đến hàng chục, không phải hàng trăm.<br>✗ 7000: đây là làm tròn đến hàng nghìn, không đúng yêu cầu.",
    "source": "hk1-exam8-Q5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Trong bốn công thức lũy thừa sau (x, y ≠ 0), công thức nào viết ĐÚNG?",
    "options": [
     "xᵐ · xⁿ = xᵐⁿ",
     "xᵐ : xⁿ = xᵐ⁺ⁿ",
     "(xᵐ)ⁿ = xᵐ⁺ⁿ",
     "(xy)ⁿ = xⁿyⁿ"
    ],
    "correct": 3,
    "answer": "(xy)ⁿ = xⁿyⁿ",
    "explanation": "🔑 Lũy thừa của một tích: (xy)ⁿ = xⁿyⁿ.<br>✗ xᵐ · xⁿ = xᵐⁿ: nhầm phép nhân hai lũy thừa cùng cơ số, đúng phải là xᵐ⁺ⁿ (cộng số mũ).<br>✗ xᵐ : xⁿ = xᵐ⁺ⁿ: nhầm phép chia hai lũy thừa cùng cơ số, đúng phải là xᵐ⁻ⁿ (trừ số mũ).<br>✗ (xᵐ)ⁿ = xᵐ⁺ⁿ: nhầm lũy thừa của lũy thừa, đúng phải là xᵐⁿ (nhân số mũ).",
    "source": "hk1-exam8-Q6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc kề bù",
    "q": "Hai đường thẳng cắt nhau tại một điểm tạo thành bốn góc, trong đó có một góc bằng 52°. Góc kề bù với góc 52° có số đo bằng bao nhiêu?",
    "fig": {
     "t": "doi-dinh",
     "a": 52,
     "l": [
      "52°",
      "?",
      "",
      ""
     ]
    },
    "options": [
     "52°",
     "38°",
     "128°",
     "148°"
    ],
    "correct": 2,
    "answer": "128°",
    "explanation": "🔑 Hai góc kề bù có tổng số đo bằng 180°: góc kề bù = 180° − 52° = 128°.<br>✗ 52°: đây là số đo của góc đối đỉnh với góc đã cho, không phải góc kề bù.<br>✗ 38°: học sinh tính nhầm 90° − 52° = 38°, đây không phải là góc kề bù (kề bù phải bằng 180° − 52°).<br>✗ 148°: tính nhầm 180° − 52° thành 148°.",
    "source": "hk1-exam8-Q7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠mOn = 130° và Ot là tia phân giác của ∠mOn. Số đo ∠mOt bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 130,
     "names": [
      "m",
      "n",
      "t",
      "O"
     ],
     "lw": "130°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "130°",
     "65°",
     "260°",
     "50°"
    ],
    "correct": 1,
    "answer": "65°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau: ∠mOt = ∠tOn = ½·130° = 65°.<br>✗ 130°: là số đo của cả góc ∠mOn, chưa chia đôi.<br>✗ 260°: tính nhầm 130° × 2 thay vì chia 2.<br>✗ 50°: là kết quả của phép tính không liên quan (180° − 130°).",
    "source": "hk1-exam8-Q8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Dấu hiệu nhận biết hai đường thẳng song song",
    "q": "Đường thẳng c cắt hai đường thẳng phân biệt m và n, tạo thành một cặp góc so le trong cùng bằng 78°. Kết luận nào sau đây ĐÚNG?",
    "fig": {
     "t": "cut2",
     "names": [
      "m",
      "n",
      "c"
     ],
     "angles": {
      "A3": "78°",
      "B1": "78°"
     }
    },
    "options": [
     "m ∥ n vì có một cặp góc so le trong bằng nhau",
     "m ∥ n vì có một cặp góc đồng vị bằng nhau",
     "m và n cắt nhau",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 0,
    "answer": "m ∥ n vì có một cặp góc so le trong bằng nhau",
    "explanation": "🔑 Dấu hiệu nhận biết hai đường thẳng song song: nếu một cặp góc so le trong bằng nhau thì hai đường thẳng đó song song, nên m ∥ n.<br>✗ m ∥ n vì có một cặp góc đồng vị bằng nhau: sai vì đề cho góc so le trong, không phải góc đồng vị.<br>✗ m và n cắt nhau: trái với dấu hiệu vừa nêu.<br>✗ Không đủ dữ kiện để kết luận: sai vì một cặp góc so le trong bằng nhau đã đủ để kết luận song song.",
    "source": "hk1-exam8-Q9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Giả thiết và kết luận",
    "q": "Định lí: “Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì chúng song song với nhau.” Phần Giả thiết (GT) của định lí này là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó cắt nhau",
     "Đường thẳng thứ ba vuông góc với chính nó",
     "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba"
    ],
    "correct": 3,
    "answer": "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
    "explanation": "🔑 Trong một định lí “Nếu A thì B”, phần sau “Nếu” là Giả thiết (GT): ở đây GT là “hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba”.<br>✗ Hai đường thẳng đó song song với nhau: đây là phần Kết luận (KL), không phải Giả thiết.<br>✗ Hai đường thẳng đó cắt nhau: không xuất hiện trong định lí này.<br>✗ Đường thẳng thứ ba vuông góc với chính nó: không phải nội dung của định lí.",
    "source": "hk1-exam8-Q10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác DEF có ∠D = 47°, ∠E = 81°. Số đo ∠F bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "D",
      "E",
      "F"
     ],
     "angles": {
      "D": "47°",
      "E": "81°",
      "F": "?"
     }
    },
    "options": [
     "128°",
     "42°",
     "52°",
     "62°"
    ],
    "correct": 2,
    "answer": "52°",
    "explanation": "🔑 Tổng ba góc trong một tam giác bằng 180°: ∠F = 180° − 47° − 81° = 52°.<br>✗ 128°: tính nhầm bằng cách cộng 47° + 81° thay vì lấy 180° trừ đi.<br>✗ 42°: trừ sai một trong hai góc.<br>✗ 62°: cộng/trừ nhầm một chữ số trong phép tính.",
    "source": "hk1-exam8-Q11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Chọn biểu đồ",
    "q": "Muốn biểu diễn tỉ lệ phần trăm học sinh khối 7 chọn từng loại nhạc cụ yêu thích (piano, guitar, trống, violin) trong câu lạc bộ âm nhạc, nên dùng loại biểu đồ nào?",
    "options": [
     "Biểu đồ đoạn thẳng",
     "Biểu đồ hình quạt tròn",
     "Không thể biểu diễn bằng biểu đồ",
     "Ghi thành một danh sách các con số rời rạc"
    ],
    "correct": 1,
    "answer": "Biểu đồ hình quạt tròn",
    "explanation": "🔑 Khi cần biểu diễn tỉ lệ phần trăm của từng thành phần (mỗi loại nhạc cụ) so với toàn thể, ta dùng biểu đồ hình quạt tròn.<br>✗ Biểu đồ đoạn thẳng: dùng để biểu diễn sự thay đổi của một đại lượng theo thời gian, không phù hợp với tỉ lệ %.<br>✗ Không thể biểu diễn bằng biểu đồ: sai vì hoàn toàn có thể dùng biểu đồ quạt tròn.<br>✗ Ghi thành một danh sách các con số rời rạc: không giúp so sánh trực quan tỉ lệ giữa các loại.",
    "source": "hk1-exam8-Q12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Phép tính với số hữu tỉ",
    "q": "Thực hiện phép tính: (−7/13) + 5/9 + (−6/13) + 4/9 + 2026",
    "options": [
     "2026",
     "2025",
     "0",
     "−2026"
    ],
    "correct": 0,
    "answer": "2026",
    "explanation": "🔑 Nhóm các số hạng có cùng mẫu: [(−7/13) + (−6/13)] + [5/9 + 4/9] + 2026 = (−1) + 1 + 2026 = 2026.<br>✗ 2025: cộng nhầm kết quả nhóm phân số vào 2026 sai thành trừ 1.<br>✗ 0: quên cộng số 2026 vào kết quả.<br>✗ −2026: nhầm dấu khi nhóm các phân số, đổi cả biểu thức thành số đối.",
    "source": "hk1-exam8-Q13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: x − 5/6 = 0,5",
    "options": [
     "1/3",
     "−1/3",
     "2/3",
     "4/3"
    ],
    "correct": 3,
    "answer": "4/3",
    "explanation": "🔑 Quy tắc chuyển vế: x = 0,5 + 5/6 = 3/6 + 5/6 = 8/6 = 4/3.<br>✗ 1/3: tính nhầm 5/6 − 0,5 rồi rút gọn sai.<br>✗ −1/3: đổi dấu 5/6 rồi cộng sai.<br>✗ 2/3: cộng nhầm 3/6 + 5/6 rồi rút gọn sai.",
    "source": "hk1-exam8-Q14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x (x là số tự nhiên), biết: 3ˣ = 81",
    "options": [
     "3",
     "4",
     "5",
     "27"
    ],
    "correct": 1,
    "answer": "4",
    "explanation": "🔑 Viết 81 dưới dạng lũy thừa cơ số 3: 81 = 3⁴, mà 3ˣ = 81 nên x = 4.<br>✗ 3: vì 3³ = 27 ≠ 81.<br>✗ 5: vì 3⁵ = 243 ≠ 81.<br>✗ 27: nhầm giá trị 3³ với số mũ x cần tìm.",
    "source": "hk1-exam8-Q15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Một chiếc cặp sách có giá niêm yết 350 000 đồng, được giảm giá 20% trong đợt khai giảng. Giá bán sau khi giảm là bao nhiêu?",
    "options": [
     "70 000 đồng",
     "330 000 đồng",
     "280 000 đồng",
     "315 000 đồng"
    ],
    "correct": 2,
    "answer": "280 000 đồng",
    "explanation": "🔑 Số tiền giảm: 350 000 × 20% = 70 000 đồng. Giá bán = 350 000 − 70 000 = 280 000 đồng.<br>✗ 70 000 đồng: đây chỉ là số tiền được giảm, chưa lấy giá gốc trừ đi.<br>✗ 330 000 đồng: trừ nhầm 20 000 đồng thay vì 70 000 đồng.<br>✗ 315 000 đồng: nhầm mức giảm 20% thành 10%.",
    "source": "hk1-exam8-Q16"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Bài toán thực tế",
    "q": "Trong 4 tháng đầu năm, một cửa hàng có lãi (số dương) hoặc lỗ (số âm) như sau: tháng 1 lãi 3/5 triệu đồng, tháng 2 lỗ 1/4 triệu đồng, tháng 3 lãi 7/20 triệu đồng, tháng 4 lỗ 2/5 triệu đồng. Hỏi sau 4 tháng, cửa hàng lãi hay lỗ bao nhiêu triệu đồng?",
    "options": [
     "Lỗ 1/20 triệu đồng",
     "Lãi 3/10 triệu đồng",
     "Lãi 11/10 triệu đồng",
     "Lỗ 3/10 triệu đồng"
    ],
    "correct": 1,
    "answer": "Lãi 3/10 triệu đồng",
    "explanation": "🔑 Quy đồng mẫu 20: 3/5 − 1/4 + 7/20 − 2/5 = 12/20 − 5/20 + 7/20 − 8/20 = 6/20 = 3/10 (triệu đồng); kết quả dương nên cửa hàng lãi 3/10 triệu đồng.<br>✗ Lỗ 1/20 triệu đồng: quên cộng số lãi tháng 3, tính 12/20 − 5/20 − 8/20 = −1/20.<br>✗ Lãi 11/10 triệu đồng: quên đổi dấu số lỗ tháng 4, tính 12/20 − 5/20 + 7/20 + 8/20.<br>✗ Lỗ 3/10 triệu đồng: tính đúng độ lớn nhưng ghi nhầm dấu của kết quả cuối.",
    "source": "hk1-exam8-Q17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Thực hiện phép tính: √144 − |−9| + √16",
    "options": [
     "7",
     "25",
     "−1",
     "17"
    ],
    "correct": 0,
    "answer": "7",
    "explanation": "🔑 √144 = 12; |−9| = 9 (số đối của số âm); √16 = 4. Vậy 12 − 9 + 4 = 7.<br>✗ 25: cộng nhầm cả ba số thay vì trừ ở giữa: 12 + 9 + 4.<br>✗ −1: nhầm dấu, tính 9 − 12 + 4.<br>✗ 17: tính sai thứ tự, gộp thành 12 + (9 − 4).",
    "source": "hk1-exam8-Q18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x + 4| = 9",
    "options": [
     "x = 9 hoặc x = −9",
     "x = 5 hoặc x = 13",
     "x = 5 hoặc x = −13",
     "x = −5 hoặc x = 13"
    ],
    "correct": 2,
    "answer": "x = 5 hoặc x = −13",
    "explanation": "🔑 |x + 4| = 9 nghĩa là x + 4 = 9 hoặc x + 4 = −9, suy ra x = 5 hoặc x = −13.<br>✗ x = 9 hoặc x = −9: nhầm lấy trực tiếp 9 và −9 làm giá trị của x, quên trừ đi 4.<br>✗ x = 5 hoặc x = 13: quên đổi dấu ở trường hợp thứ hai (x + 4 = −9).<br>✗ x = −5 hoặc x = 13: tính sai dấu ở cả hai trường hợp.",
    "source": "hk1-exam8-Q19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh sân hình vuông có diện tích 169 m². Người ta muốn rào xung quanh mảnh sân bằng lưới thép. Độ dài một cạnh của mảnh sân là bao nhiêu?",
    "options": [
     "13 m",
     "84,5 m",
     "42,25 m",
     "26 m"
    ],
    "correct": 0,
    "answer": "13 m",
    "explanation": "🔑 Cạnh hình vuông là căn bậc hai số học của diện tích: √169 = 13 (m).<br>✗ 84,5 m: lấy nhầm diện tích chia 2.<br>✗ 42,25 m: lấy nhầm diện tích chia 4.<br>✗ 26 m: nhầm cạnh với hai lần cạnh.",
    "source": "hk1-exam8-Q20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho hai đường thẳng song song p và q bị cắt bởi đường thẳng c. Biết một góc đồng vị tạo bởi c và p bằng 63°. Góc kề bù với góc đồng vị tương ứng tạo bởi c và q bằng bao nhiêu?",
    "fig": {
     "t": "cut2",
     "par": true,
     "names": [
      "p",
      "q",
      "c"
     ],
     "angles": {
      "A1": "63°",
      "B2": "?"
     }
    },
    "options": [
     "63°",
     "27°",
     "153°",
     "117°"
    ],
    "correct": 3,
    "answer": "117°",
    "explanation": "🔑 Vì p ∥ q nên góc đồng vị tương ứng tạo bởi c và q cũng bằng 63° (tính chất hai đường thẳng song song); góc kề bù với nó bằng 180° − 63° = 117°.<br>✗ 63°: đây là số đo góc đồng vị, chưa lấy kề bù.<br>✗ 27°: nhầm lấy 90° − 63° (không phải phép tính của góc kề bù).<br>✗ 153°: tính sai 180° − 63° thành 153°.",
    "source": "hk1-exam8-Q21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Tam giác GHI và tam giác XYZ có GH = XY, HI = YZ và ∠H = ∠Y (góc xen giữa hai cạnh GH và HI). Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "H",
       "G",
       "I"
      ],
      [
       "Y",
       "X",
       "Z"
      ]
     ]
    },
    "options": [
     "c-c-c (cạnh - cạnh - cạnh)",
     "g-c-g (góc - cạnh - góc)",
     "c-g-c (cạnh - góc - cạnh)",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 2,
    "answer": "c-g-c (cạnh - góc - cạnh)",
    "explanation": "🔑 Hai cặp cạnh bằng nhau (GH = XY, HI = YZ) và góc xen giữa hai cạnh đó bằng nhau (∠H = ∠Y) nên △GHI = △XYZ theo trường hợp c-g-c.<br>✗ cạnh – cạnh – cạnh: sai vì đề chỉ cho hai cặp cạnh, không có cặp cạnh thứ ba.<br>✗ góc – cạnh – góc: sai vì dữ kiện cho hai cạnh và một góc xen giữa, không phải hai góc và một cạnh.<br>✗ Không đủ dữ kiện để kết luận: sai vì dữ kiện đã đủ điều kiện của trường hợp c-g-c.",
    "source": "hk1-exam8-Q22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác KLM cân tại K, biết góc ở đáy ∠L = 72°. Số đo góc ở đỉnh ∠K bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "K",
      "L",
      "M"
     ],
     "angles": {
      "L": "72°",
      "K": "?"
     }
    },
    "options": [
     "36°",
     "72°",
     "108°",
     "144°"
    ],
    "correct": 0,
    "answer": "36°",
    "explanation": "🔑 Tam giác cân tại K có ∠L = ∠M = 72°; tổng ba góc bằng 180° nên ∠K = 180° − 72° − 72° = 36°.<br>✗ 72°: nhầm góc ở đỉnh với góc ở đáy.<br>✗ 108°: tính nhầm 180° − 72° mà quên trừ thêm một góc đáy nữa.<br>✗ 144°: nhầm lấy 72° × 2 làm góc ở đỉnh thay vì lấy 180° trừ đi.",
    "source": "hk1-exam8-Q23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ quạt tròn về phương tiện đến trường của học sinh khối 7 cho biết: đi bộ 35%, xe đạp 40%, được đưa đón 15%, phần còn lại là xe buýt. Xe buýt chiếm bao nhiêu phần trăm?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Đi bộ", "value": 35 }, { "label": "Xe đạp", "value": 40 }, { "label": "Đưa đón", "value": 15 }, { "label": "Xe buýt", "value": 10, "text": "?" }] },
    "options": [
     "15%",
     "20%",
     "90%",
     "10%"
    ],
    "correct": 3,
    "answer": "10%",
    "explanation": "🔑 Tổng các tỉ lệ trong biểu đồ quạt tròn luôn bằng 100%: 100% − 35% − 40% − 15% = 10%.<br>✗ 15%: nhầm với tỉ lệ của phần “được đưa đón”.<br>✗ 20%: cộng sai các tỉ lệ đã cho trước khi trừ.<br>✗ 90%: quên trừ cho 100%, chỉ cộng ba tỉ lệ đã biết.",
    "source": "hk1-exam8-Q24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng cho biết số lượt bạn đọc mượn sách ở thư viện trường: tháng 1: 90; tháng 2: 110; tháng 3: 130; tháng 4: 150. Tổng số lượt mượn sách trong bốn tháng đó là bao nhiêu?",
    "fig": { "t": "line-chart", "labels": ["T1", "T2", "T3", "T4"], "values": [90, 110, 130, 150] },
    "options": [
     "480 lượt",
     "150 lượt",
     "380 lượt",
     "440 lượt"
    ],
    "correct": 0,
    "answer": "480 lượt",
    "explanation": "🔑 Tổng số lượt mượn bốn tháng: 90 + 110 + 130 + 150 = 480 (lượt).<br>✗ 150 lượt: chỉ lấy số liệu của riêng tháng 4, quên cộng ba tháng còn lại.<br>✗ 380 lượt: cộng thiếu một tháng trong bốn tháng.<br>✗ 440 lượt: cộng sai một trong các số liệu khi thực hiện phép cộng.",
    "source": "hk1-exam8-Q25"
   }
  ],
  "report": {
   "structureVsPdf": "25 Q (12 TN nhận biết + 13 TL) mirrors the model's 12 TN + 10 TL sub-parts converted 1:1 to MCQ; ch quota 7/7/5/3/3 matches spec; skill coverage (số hữu tỉ, số thực/căn/GTTĐ/làm tròn, góc & song song, tam giác, dữ liệu) mirrors the model paper's kinds of items, though the model's own paper substitutes tỉ lệ thức and hình hộp chữ nhật for our app's tam giác/dữ liệu chapters.",
   "edits": [
    {
     "n": 2,
     "what": "Fixed collision with Exam 3 câu 2 (same 'số vô tỉ' stem/dạng): kept the recognition dạng, replaced every constant (√20→√17, 0,777...→0,555..., 5/9→7/11, −1,25→−2,75) and moved the correct answer to option D for spread."
    },
    {
     "n": 17,
     "what": "Dropped the tỉ lệ thức / dãy tỉ số bằng nhau 'trồng cây 3:4:5' question — forbidden by curriculum rule E (chương 6, Tập 2) and separately flagged as a collision — and replaced it with a fresh ch1 real-world lãi/lỗ (profit/loss) signed-fraction word problem, recomputed and re-verified (3/5 − 1/4 + 7/20 − 2/5 = 3/10)."
    },
    {
     "n": [
      7,
      21
     ],
     "what": "Reworded distractor explanations at Q7 and Q21 to remove the forbidden term 'góc phụ' (complementary angles, not in Toán 7 Tập 1) without changing any question, answer, or math."
    },
    {
     "n": 19,
     "what": "Removed the forbidden '±' symbol from the explanation text ('±9' → '9 và −9'), no change to answer."
    },
    {
     "n": "all",
     "what": "Normalized every 'source' field to the hk1-exam8-Q<n> format (was an inconsistent TN#/TL#a/TL#b scheme with duplicated-looking TL17/TL17a/TL17b and TL13/TL13b tags); now unique and unambiguous per question."
    }
   ]
  }
 },
 {
  "id": "hk1-exam9",
  "title": "HK1 Exam 9",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Kí hiệu ℚ được dùng để chỉ tập hợp số nào?",
    "options": [
     "Số hữu tỉ",
     "Số nguyên",
     "Số tự nhiên",
     "Số thực"
    ],
    "correct": 0,
    "answer": "Số hữu tỉ",
    "explanation": "🔑 Kí hiệu ℚ dùng để chỉ tập hợp các số hữu tỉ.<br>✗ Số nguyên: tập hợp số nguyên được kí hiệu là ℤ.<br>✗ Số tự nhiên: tập hợp số tự nhiên được kí hiệu là ℕ.<br>✗ Số thực: tập hợp số thực được kí hiệu là ℝ.",
    "source": "hk1-exam9-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Trong các số sau, số nào là số vô tỉ?",
    "options": [
     "0,666...",
     "√7",
     "−5/9",
     "3,25"
    ],
    "correct": 1,
    "answer": "√7",
    "explanation": "🔑 √7 không phải là căn bậc hai đúng của một số chính phương nên là số thập phân vô hạn không tuần hoàn → số vô tỉ.<br>✗ 0,666...: là số thập phân vô hạn tuần hoàn (chu kì 6) nên là số hữu tỉ.<br>✗ −5/9: là phân số nên là số hữu tỉ.<br>✗ 3,25: là số thập phân hữu hạn nên là số hữu tỉ.",
    "source": "hk1-exam9-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Giá trị của √121 là bao nhiêu?",
    "options": [
     "−11",
     "60,5",
     "11",
     "121"
    ],
    "correct": 2,
    "answer": "11",
    "explanation": "🔑 Vì 11² = 121 và 11 ≥ 0 nên √121 = 11 (căn bậc hai số học chỉ lấy giá trị không âm).<br>✗ −11: là số đối của 11, không phải căn bậc hai số học (kết quả của √ không thể âm).<br>✗ 60,5: là kết quả của phép chia 121 : 2, không liên quan đến căn bậc hai.<br>✗ 121: là số dưới dấu căn, không phải kết quả của √121.",
    "source": "hk1-exam9-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Giá trị tuyệt đối của số hữu tỉ −9/4 là số nào?",
    "options": [
     "−9/4",
     "4/9",
     "−4/9",
     "9/4"
    ],
    "correct": 3,
    "answer": "9/4",
    "explanation": "🔑 Vì −9/4 là số âm nên giá trị tuyệt đối của nó là số đối của nó: |−9/4| = 9/4.<br>✗ −9/4: đây là chính số ban đầu, giá trị tuyệt đối không thể âm.<br>✗ 4/9: đảo ngược tử và mẫu so với số đối đúng.<br>✗ −4/9: vừa đảo ngược tử mẫu vừa sai dấu.",
    "source": "hk1-exam9-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 5,368 đến chữ số thập phân thứ nhất, ta được kết quả nào?",
    "options": [
     "5,4",
     "5,3",
     "5,37",
     "5,368"
    ],
    "correct": 0,
    "answer": "5,4",
    "explanation": "🔑 Chữ số hàng phần trăm là 6 ≥ 5 nên làm tròn chữ số hàng phần mười từ 3 lên 4: 5,368 ≈ 5,4.<br>✗ 5,3: giữ nguyên chữ số hàng phần mười, quên làm tròn lên.<br>✗ 5,37: làm tròn đến hàng phần trăm thay vì hàng phần mười theo yêu cầu.<br>✗ 5,368: giữ nguyên số ban đầu, chưa làm tròn.",
    "source": "hk1-exam9-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Với n là số tự nhiên lớn hơn 1, lũy thừa xⁿ được định nghĩa là gì?",
    "options": [
     "Tích của x và n",
     "Tích của n thừa số x",
     "Tổng của n số hạng x",
     "Thương của x cho n"
    ],
    "correct": 1,
    "answer": "Tích của n thừa số x",
    "explanation": "🔑 Theo định nghĩa, xⁿ = x · x · … · x (n thừa số x, với n là số tự nhiên lớn hơn 1).<br>✗ Tích của x và n: nhầm lũy thừa với phép nhân đơn giản x · n.<br>✗ Tổng của n số hạng x: nhầm lũy thừa với phép cộng lặp (x + x + … + x).<br>✗ Thương của x cho n: không liên quan đến định nghĩa lũy thừa.",
    "source": "hk1-exam9-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc kề bù",
    "q": "Hai góc kề bù là hai góc thoả mãn điều kiện nào?",
    "fig": {
     "t": "ke-bu",
     "a": 125,
     "l": [
      "∠1",
      "∠2"
     ]
    },
    "options": [
     "Có chung đỉnh và hai cạnh của góc này là tia đối của hai cạnh góc kia",
     "Có chung đỉnh và bằng nhau",
     "Có chung một cạnh, hai cạnh còn lại là hai tia đối nhau",
     "Có chung đỉnh và hai cạnh trùng nhau"
    ],
    "correct": 2,
    "answer": "Có chung một cạnh, hai cạnh còn lại là hai tia đối nhau",
    "explanation": "🔑 Hai góc kề bù là hai góc có chung một cạnh, còn hai cạnh kia là hai tia đối nhau (tổng số đo bằng 180°).<br>✗ Có chung đỉnh và hai cạnh của góc này là tia đối của hai cạnh góc kia: đây là định nghĩa hai góc đối đỉnh, không phải kề bù.<br>✗ Có chung đỉnh và bằng nhau: không phải điều kiện của kề bù (kề bù không yêu cầu bằng nhau).<br>✗ Có chung đỉnh và hai cạnh trùng nhau: khi đó hai góc trùng nhau, không phải kề bù.",
    "source": "hk1-exam9-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Nếu Ot là tia phân giác của ∠mOn thì đẳng thức nào sau đây đúng?",
    "fig": {
     "t": "phan-giac",
     "w": 100,
     "names": [
      "m",
      "n",
      "t",
      "O"
     ]
    },
    "options": [
     "∠mOt + ∠tOn = 90°",
     "∠mOt = 2∠mOn",
     "∠mOt = ∠mOn",
     "∠mOt = ∠tOn = ½∠mOn"
    ],
    "correct": 3,
    "answer": "∠mOt = ∠tOn = ½∠mOn",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau, mỗi góc bằng nửa góc ban đầu: ∠mOt = ∠tOn = ½∠mOn.<br>✗ ∠mOt + ∠tOn = 90°: sai, tổng hai góc đó phải bằng ∠mOn chứ không phải 90°.<br>✗ ∠mOt = 2∠mOn: đảo ngược quan hệ, góc được chia nhỏ hơn góc ban đầu chứ không gấp đôi.<br>✗ ∠mOt = ∠mOn: nhầm góc được chia với góc ban đầu.",
    "source": "hk1-exam9-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Tiên đề Euclid",
    "q": "Phát biểu nào sau đây đúng với Tiên đề Euclid?",
    "fig": {
     "t": "euclid",
     "m": "point"
    },
    "options": [
     "Qua một điểm ở ngoài một đường thẳng, chỉ có một đường thẳng song song với đường thẳng đó",
     "Qua một điểm ở ngoài một đường thẳng, có vô số đường thẳng song song với đường thẳng đó",
     "Qua một điểm bất kì, luôn kẻ được một đường thẳng song song với một đường thẳng cho trước",
     "Hai đường thẳng phân biệt luôn song song với nhau"
    ],
    "correct": 0,
    "answer": "Qua một điểm ở ngoài một đường thẳng, chỉ có một đường thẳng song song với đường thẳng đó",
    "explanation": "🔑 Tiên đề Euclid: qua một điểm ở ngoài một đường thẳng, chỉ có một đường thẳng song song với đường thẳng đó.<br>✗ Có vô số đường thẳng song song: sai, tiên đề khẳng định chỉ có đúng một.<br>✗ Qua một điểm bất kì...: thiếu điều kiện điểm phải nằm ngoài đường thẳng đã cho.<br>✗ Hai đường thẳng phân biệt luôn song song với nhau: sai, hai đường thẳng phân biệt có thể cắt nhau.",
    "source": "hk1-exam9-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Giả thiết - Kết luận",
    "q": "Cho định lí: 'Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì hai đường thẳng đó song song với nhau.' Kết luận của định lí này là gì?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó vuông góc với nhau",
     "Đường thẳng thứ ba song song với hai đường thẳng kia"
    ],
    "correct": 1,
    "answer": "Hai đường thẳng đó song song với nhau",
    "explanation": "🔑 Trong định lí dạng 'Nếu A thì B', phần B (sau chữ 'thì') là kết luận: ở đây kết luận là 'hai đường thẳng đó song song với nhau'.<br>✗ Hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba: đây là giả thiết (phần sau chữ 'Nếu'), không phải kết luận.<br>✗ Hai đường thẳng đó vuông góc với nhau: không phải nội dung của định lí này.<br>✗ Đường thẳng thứ ba song song với hai đường thẳng kia: không đúng với nội dung định lí, cũng không phải kết luận được nêu.",
    "source": "hk1-exam9-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác DEF có ∠D = 72° và ∠E = 45°. Số đo ∠F bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "D",
      "E",
      "F"
     ],
     "angles": {
      "D": "72°",
      "E": "45°",
      "F": "?"
     }
    },
    "options": [
     "53°",
     "117°",
     "63°",
     "108°"
    ],
    "correct": 2,
    "answer": "63°",
    "explanation": "🔑 Tổng ba góc trong tam giác bằng 180°, nên ∠F = 180° − 72° − 45° = 63°.<br>✗ 53°: tính sai phép trừ liên tiếp.<br>✗ 117°: đây là tổng ∠D + ∠E = 72° + 45°, quên trừ cho 180°.<br>✗ 108°: lấy 180° − 72° mà quên trừ tiếp 45°.",
    "source": "hk1-exam9-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Số đôi giày mà cửa hàng bán được mỗi ngày trong tuần là loại dữ liệu nào?",
    "options": [
     "Định tính (không là số)",
     "Không phải dữ liệu",
     "Định tính có thể sắp thứ tự",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Số đôi giày bán được là các con số đếm được nên đây là dữ liệu định lượng.<br>✗ Định tính (không là số): sai vì số đôi giày chính là số liệu, đo đếm được.<br>✗ Không phải dữ liệu: sai, đây vẫn là một loại dữ liệu thống kê hợp lệ.<br>✗ Định tính có thể sắp thứ tự: nhầm với dữ liệu không phải số như xếp loại.",
    "source": "hk1-exam9-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết x + 5/6 = 7/6.",
    "options": [
     "1/3",
     "2",
     "−1/3",
     "1/6"
    ],
    "correct": 0,
    "answer": "1/3",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 7/6 − 5/6 = 2/6 = 1/3.<br>✗ 2: cộng nhầm hai vế thay vì trừ (7/6 + 5/6 = 2).<br>✗ −1/3: trừ ngược vế, tính nhầm x = 5/6 − 7/6.<br>✗ 1/6: tính sai mẫu số khi trừ, ra 2/12 thay vì 2/6.",
    "source": "hk1-exam9-TL13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết x − 2,7 = 4,3.",
    "options": [
     "1,6",
     "7",
     "−1,6",
     "−7"
    ],
    "correct": 1,
    "answer": "7",
    "explanation": "🔑 Áp dụng quy tắc chuyển vế: x = 4,3 + 2,7 = 7.<br>✗ 1,6: trừ nhầm hai vế (4,3 − 2,7) thay vì cộng.<br>✗ −1,6: vừa trừ nhầm vừa sai dấu.<br>✗ −7: chuyển vế mà quên đổi dấu số 2,7 (giữ nguyên phép trừ).",
    "source": "hk1-exam9-TL14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm số tự nhiên x, biết (−2/3)³ˣ⁻² = 16/81.",
    "options": [
     "2/3",
     "−2",
     "2",
     "4"
    ],
    "correct": 2,
    "answer": "2",
    "explanation": "🔑 Vì 16/81 = (2/3)⁴ = (−2/3)⁴ nên (−2/3)³ˣ⁻² = (−2/3)⁴, suy ra 3x − 2 = 4, do đó 3x = 6 và x = 2.<br>✗ 2/3: giải sai bước cộng, tính nhầm 3x = 2 thay vì 3x = 6.<br>✗ −2: đổi dấu kết quả cuối cùng mà không có căn cứ.<br>✗ 4: dừng lại ở giá trị của số mũ (3x − 2 = 4) mà quên giải tiếp để tìm x.",
    "source": "hk1-exam9-TL15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết x³ = −64.",
    "options": [
     "4",
     "−8",
     "8",
     "−4"
    ],
    "correct": 3,
    "answer": "−4",
    "explanation": "🔑 Vì (−4)³ = −64 nên x = −4 (lũy thừa bậc lẻ của số âm cho kết quả âm).<br>✗ 4: bỏ qua dấu âm, trong khi 4³ = 64 ≠ −64.<br>✗ −8: nhầm lũy thừa bậc ba với việc tính rồi đổi dấu √64.<br>✗ 8: nhầm với √64 = 8 mà không để ý dấu âm và số mũ của đề bài.",
    "source": "hk1-exam9-TL16"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Tính toán với số hữu tỉ",
    "q": "Một chiếc ba lô có giá gốc 320 000 đồng được giảm giá 15%. Hỏi giá bán sau khi giảm là bao nhiêu?",
    "options": [
     "272 000 đồng",
     "288 000 đồng",
     "48 000 đồng",
     "368 000 đồng"
    ],
    "correct": 0,
    "answer": "272 000 đồng",
    "explanation": "🔑 Số tiền giảm là 320 000 × 15% = 48 000 (đồng), giá bán sau khi giảm là 320 000 − 48 000 = 272 000 (đồng).<br>✗ 288 000 đồng: tính sai số tiền giảm (nhầm 10% thay vì 15%).<br>✗ 48 000 đồng: đây chỉ là số tiền được giảm, chưa trừ vào giá gốc.<br>✗ 368 000 đồng: cộng nhầm số tiền giảm vào giá gốc thay vì trừ.",
    "source": "hk1-exam9-TL17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Tính giá trị biểu thức: √81 − |−5| + 2/3 · 3/4.",
    "options": [
     "4",
     "9/2",
     "5",
     "19/2"
    ],
    "correct": 1,
    "answer": "9/2",
    "explanation": "🔑 Ta có √81 = 9; |−5| = 5; 2/3 · 3/4 = 1/2. Vậy biểu thức = 9 − 5 + 1/2 = 4 + 1/2 = 9/2.<br>✗ 4: quên cộng thêm 1/2 (dừng lại ở 9 − 5 = 4).<br>✗ 5: tính sai 2/3 · 3/4 = 1 (nhân nhầm) rồi cộng ra 9 − 5 + 1 = 5.<br>✗ 19/2: tính sai |−5| thành −5 rồi lấy 9 − (−5) + 1/2, quên rằng giá trị tuyệt đối luôn không âm.",
    "source": "hk1-exam9-TL18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết |x − 3| = 8.",
    "options": [
     "x = 11 hoặc x = 5",
     "x = −11 hoặc x = 5",
     "x = 11 hoặc x = −5",
     "x = 8 hoặc x = −8"
    ],
    "correct": 2,
    "answer": "x = 11 hoặc x = −5",
    "explanation": "🔑 |x − 3| = 8 nghĩa là x − 3 = 8 hoặc x − 3 = −8, suy ra x = 11 hoặc x = −5.<br>✗ x = 11 hoặc x = 5: tính sai trường hợp thứ hai, quên đổi dấu 8 khi chuyển vế (đúng ra là 3 − 8 = −5).<br>✗ x = −11 hoặc x = 5: sai dấu ở cả hai trường hợp.<br>✗ x = 8 hoặc x = −8: nhầm lẫn coi x − 3 chính là x, bỏ qua số 3.",
    "source": "hk1-exam9-TL19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh vườn hình vuông có diện tích 196 m². Hỏi độ dài cạnh của mảnh vườn là bao nhiêu mét?",
    "options": [
     "13 m",
     "98 m",
     "28 m",
     "14 m"
    ],
    "correct": 3,
    "answer": "14 m",
    "explanation": "🔑 Cạnh hình vuông là căn bậc hai số học của diện tích: √196 = 14 (m).<br>✗ 13 m: nhớ nhầm 13² = 169 ≠ 196.<br>✗ 98 m: lấy nhầm một nửa diện tích (196 : 2) thay vì tính căn bậc hai.<br>✗ 28 m: nhân đôi kết quả đúng do nhầm chu vi với cạnh.",
    "source": "hk1-exam9-TL20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Tính chất hai đường thẳng song song",
    "q": "Cho hai đường thẳng song song a và b bị cắt bởi đường thẳng c. Một góc tạo bởi c và a có số đo 105°. Góc so le trong với nó (tạo bởi c và b) có số đo bao nhiêu?",
    "fig": {
     "t": "cut2",
     "par": true,
     "angles": {
      "A3": "105°",
      "B1": "?"
     }
    },
    "options": [
     "105°",
     "75°",
     "55°",
     "150°"
    ],
    "correct": 0,
    "answer": "105°",
    "explanation": "🔑 Vì a ∥ b nên hai góc so le trong bằng nhau: góc so le trong tương ứng cũng bằng 105°.<br>✗ 75°: đây là góc kề bù với 105° (180° − 105°), không phải góc so le trong.<br>✗ 55°: một số không có cơ sở tính toán từ dữ kiện đề bài.<br>✗ 150°: tính sai, không phải kết quả của quan hệ so le trong hay kề bù nào từ 105°.",
    "source": "hk1-exam9-TL21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Tam giác vuông",
    "q": "Tam giác GHI vuông tại G và tam giác JKL vuông tại J có HI = KL, ∠H = ∠K. Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac-vuong",
     "m": "ch-gn",
     "v": [
      [
       "G",
       "H",
       "I"
      ],
      [
       "J",
       "K",
       "L"
      ]
     ]
    },
    "options": [
     "Cạnh góc vuông - góc nhọn kề",
     "Cạnh huyền - góc nhọn",
     "Hai cạnh góc vuông",
     "Không đủ dữ kiện để kết luận"
    ],
    "correct": 1,
    "answer": "Cạnh huyền - góc nhọn",
    "explanation": "🔑 HI và KL là cạnh huyền (đối diện góc vuông), ∠H = ∠K là một góc nhọn tương ứng bằng nhau, nên hai tam giác vuông bằng nhau theo trường hợp cạnh huyền - góc nhọn.<br>✗ Cạnh góc vuông - góc nhọn kề: sai vì HI, KL là cạnh huyền chứ không phải cạnh góc vuông.<br>✗ Hai cạnh góc vuông: đề bài không cho biết hai cạnh góc vuông nào bằng nhau.<br>✗ Không đủ dữ kiện để kết luận: sai, cạnh huyền và một góc nhọn tương ứng đã đủ để kết luận bằng nhau.",
    "source": "hk1-exam9-TL22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác XYZ cân tại X có góc ở đỉnh ∠X = 52°. Số đo mỗi góc ở đáy bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "X",
      "Y",
      "Z"
     ],
     "angles": {
      "X": "52°",
      "Y": "?",
      "Z": "?"
     }
    },
    "options": [
     "128°",
     "74°",
     "64°",
     "94°"
    ],
    "correct": 2,
    "answer": "64°",
    "explanation": "🔑 Tam giác cân có hai góc ở đáy bằng nhau: ∠Y = ∠Z = (180° − 52°) : 2 = 64°.<br>✗ 128°: đây là tổng hai góc ở đáy (180° − 52°), quên chia đôi.<br>✗ 74°: tính sai phép trừ hoặc chia.<br>✗ 94°: một kết quả tính sai không có cơ sở từ 180° − 52°.",
    "source": "hk1-exam9-TL23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Đọc biểu đồ quạt tròn",
    "q": "Biểu đồ hình quạt tròn về hoạt động ngoại khóa yêu thích của lớp 7A cho biết: bóng đá 35%, cầu lông 25%, bơi lội 15%, phần còn lại là cờ vua. Nếu lớp có 32 học sinh, có bao nhiêu bạn thích cờ vua?",
    "fig": { "t": "pie-chart", "segments": [{ "label": "Bóng đá", "value": 35 }, { "label": "Cầu lông", "value": 25 }, { "label": "Bơi lội", "value": 15 }, { "label": "Cờ vua", "value": 25, "text": "?" }] },
    "options": [
     "14 bạn",
     "6 bạn",
     "25 bạn",
     "8 bạn"
    ],
    "correct": 3,
    "answer": "8 bạn",
    "explanation": "🔑 Tỉ lệ thích cờ vua là 100% − 35% − 25% − 15% = 25%; số bạn thích cờ vua là 32 × 25% = 8 (bạn).<br>✗ 14 bạn: tính sai tỉ lệ còn lại trước khi nhân với tổng số học sinh.<br>✗ 6 bạn: tính nhầm phép nhân 32 × 25%.<br>✗ 25 bạn: nhầm lẫn lấy luôn số phần trăm (25) làm số bạn, quên nhân với tổng số học sinh.",
    "source": "hk1-exam9-TL24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng cho biết số lượt bạn đọc mượn sách ở thư viện: tháng 6: 80; tháng 7: 95; tháng 8: 110; tháng 9: 90. Nhận xét nào sau đây đúng?",
    "fig": { "t": "line-chart", "labels": ["T6", "T7", "T8", "T9"], "values": [80, 95, 110, 90] },
    "options": [
     "Số lượt mượn tăng dần từ tháng 6 đến tháng 8 rồi giảm ở tháng 9",
     "Số lượt mượn giảm dần đều qua các tháng",
     "Số lượt mượn không đổi từ tháng 6 đến tháng 9",
     "Số lượt mượn tăng dần đều suốt bốn tháng"
    ],
    "correct": 0,
    "answer": "Số lượt mượn tăng dần từ tháng 6 đến tháng 8 rồi giảm ở tháng 9",
    "explanation": "🔑 Từ 80 → 95 → 110 số lượt mượn tăng liên tục (tháng 6 đến tháng 8), rồi giảm xuống 90 ở tháng 9 — đúng như nhận xét đầu tiên.<br>✗ Số lượt mượn giảm dần đều qua các tháng: sai vì ba tháng đầu số liệu đang tăng.<br>✗ Số lượt mượn không đổi từ tháng 6 đến tháng 9: sai vì các số liệu 80, 95, 110, 90 đều khác nhau.<br>✗ Số lượt mượn tăng dần đều suốt bốn tháng: sai vì tháng 9 số liệu giảm xuống còn 90.",
    "source": "hk1-exam9-TL25"
   }
  ],
  "report": {
   "structureVsPdf": "Matches: Q1-12 nhận biết follow the spec topic order (kí hiệu tập hợp, vô tỉ nhận diện, căn bậc hai, GTTĐ, làm tròn, lũy thừa, kề bù, tia phân giác, Euclid, GT-KL, tổng ba góc, loại dữ liệu); Q13-25 TL-style; chapter quota exactly ch1:7 ch2:7 ch3:5 ch4:3 ch5:3; no chương 6/10 content present; n=1..25 already complete/contiguous, no missing slot.",
   "edits": [
    {
     "n": 1,
     "what": "Collision w/ Exam 6 câu 1 (identical stem, no numeric constant to vary): reworded from \"kí hiệu → tên tập hợp\" to reverse framing \"ℚ → tên tập hợp\", same nhận-biết dạng, fresh phrasing, correct answer unchanged."
    },
    {
     "n": 3,
     "what": "Collision w/ Exam 4 câu 3: changed √169=13 to √121=11 (all distractors recomputed: −11, 121÷2=60,5, 121)."
    },
    {
     "n": 5,
     "what": "Collision w/ Exam 1 câu 5: changed làm tròn 7,483→7,5 to 5,368→5,4 (distractors recomputed: 5,3 / 5,37 / 5,368)."
    },
    {
     "n": 15,
     "what": "RULES violation: stem/explanation used caret (−2/3)^(3x−2); rewrote with unicode superscripts (−2/3)³ˣ⁻² — math unchanged, still x=2."
    },
    {
     "n": 17,
     "what": "Collision w/ Exam 6 câu 16 (áo 250 000đ, giảm 12%): changed to ba lô 320 000đ, giảm 15% → 272 000đ; all three distractors recomputed to match the new numbers (288 000 / 48 000 / 368 000)."
    }
   ]
  }
 },
 {
  "id": "hk1-exam10",
  "title": "HK1 Exam 10",
  "questions": [
   {
    "n": 1,
    "ch": 1,
    "topic": "Số hữu tỉ",
    "q": "Chọn phát biểu đúng trong các câu sau:",
    "options": [
     "8/9 ∈ ℚ",
     "√11 ∈ ℕ",
     "5/12 là số vô tỉ",
     "4,25 ∈ ℤ"
    ],
    "correct": 0,
    "answer": "8/9 ∈ ℚ",
    "explanation": "🔑 Mọi phân số a/b (a, b ∈ ℤ, b ≠ 0) đều là số hữu tỉ, nên 8/9 ∈ ℚ đúng.<br>✗ √11 ∈ ℕ: √11 không phải số tự nhiên vì 11 không là số chính phương.<br>✗ 5/12 là số vô tỉ: sai vì 5/12 viết được dưới dạng phân số nên là số hữu tỉ, không phải số vô tỉ.<br>✗ 4,25 ∈ ℤ: 4,25 là số thập phân, không phải số nguyên.",
    "source": "hk1e10-TN1"
   },
   {
    "n": 2,
    "ch": 2,
    "topic": "Số thực và số thập phân",
    "q": "Trong các số sau, số nào là số vô tỉ?",
    "options": [
     "0,626262...",
     "√19",
     "7/8",
     "−3,5"
    ],
    "correct": 1,
    "answer": "√19",
    "explanation": "🔑 Số vô tỉ là số thập phân vô hạn không tuần hoàn; vì 19 không là số chính phương nên √19 là số vô tỉ.<br>✗ 0,626262...: có nhóm 62 lặp lại mãi nên là số thập phân vô hạn tuần hoàn, thuộc ℚ.<br>✗ 7/8: là phân số nên là số hữu tỉ.<br>✗ −3,5: là số thập phân hữu hạn nên là số hữu tỉ.",
    "source": "hk1e10-TN2"
   },
   {
    "n": 3,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Căn bậc hai số học của 144 bằng bao nhiêu?",
    "options": [
     "−12",
     "72",
     "12",
     "12 hoặc −12"
    ],
    "correct": 2,
    "answer": "12",
    "explanation": "🔑 Căn bậc hai số học của một số a ≥ 0 là số x ≥ 0 sao cho x² = a; vì 12² = 144 nên √144 = 12.<br>✗ −12: căn bậc hai số học luôn không âm, không lấy giá trị âm.<br>✗ 72: là một nửa của 144, không liên quan đến phép khai căn.<br>✗ 12 hoặc −12: đó là hai số có bình phương bằng 144, nhưng căn bậc hai số học chỉ lấy giá trị không âm là 12.",
    "source": "hk1e10-TN3"
   },
   {
    "n": 4,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Giá trị tuyệt đối của số −14 bằng bao nhiêu?",
    "options": [
     "−14",
     "0",
     "196",
     "14"
    ],
    "correct": 3,
    "answer": "14",
    "explanation": "🔑 Giá trị tuyệt đối của một số âm là số đối của nó: |−14| = 14.<br>✗ −14: đó chính là số ban đầu, không phải giá trị tuyệt đối.<br>✗ 0: chỉ đúng khi số ban đầu là 0.<br>✗ 196: là bình phương của 14, không phải giá trị tuyệt đối.",
    "source": "hk1e10-TN4"
   },
   {
    "n": 5,
    "ch": 2,
    "topic": "Làm tròn số",
    "q": "Làm tròn số 7,483 đến hàng phần trăm ta được kết quả nào?",
    "options": [
     "7,48",
     "7,49",
     "7,5",
     "7"
    ],
    "correct": 0,
    "answer": "7,48",
    "explanation": "🔑 Làm tròn đến hàng phần trăm: giữ hai chữ số thập phân, xét chữ số hàng phần nghìn (3) để quyết định; vì 3 &lt; 5 nên giữ nguyên: 7,483 ≈ 7,48.<br>✗ 7,49: làm tròn sai, tăng chữ số hàng phần trăm dù chữ số bỏ đi là 3 &lt; 5.<br>✗ 7,5: đó là làm tròn đến hàng phần mười, không đúng yêu cầu đến hàng phần trăm.<br>✗ 7: đó là làm tròn đến hàng đơn vị, không đúng yêu cầu.",
    "source": "hk1e10-TN5"
   },
   {
    "n": 6,
    "ch": 1,
    "topic": "Lũy thừa",
    "q": "Với n là số tự nhiên khác 0, lũy thừa xⁿ được định nghĩa là gì?",
    "options": [
     "Tổng của n số hạng x",
     "Tích của n thừa số x",
     "Tích của x với n",
     "Thương của x cho n"
    ],
    "correct": 1,
    "answer": "Tích của n thừa số x",
    "explanation": "🔑 Theo định nghĩa, xⁿ là tích của n thừa số x (x nhân với chính nó n lần): xⁿ = x · x · … · x (n thừa số).<br>✗ Tổng của n số hạng x: đó là công thức của phép nhân n·x, không phải lũy thừa.<br>✗ Tích của x với n: đó chỉ là x·n, không đúng định nghĩa lũy thừa.<br>✗ Thương của x cho n: không liên quan đến định nghĩa lũy thừa.",
    "source": "hk1e10-TN6"
   },
   {
    "n": 7,
    "ch": 3,
    "topic": "Hai góc kề bù",
    "q": "Hai góc ∠aOb và ∠bOc là hai góc kề bù, biết ∠aOb = 115°. Số đo ∠bOc bằng bao nhiêu?",
    "fig": {
     "t": "ke-bu",
     "a": 115,
     "names": [
      "a",
      "c",
      "b"
     ],
     "l": [
      "115°",
      "?"
     ]
    },
    "options": [
     "115°",
     "75°",
     "65°",
     "25°"
    ],
    "correct": 2,
    "answer": "65°",
    "explanation": "🔑 Hai góc kề bù có tổng số đo bằng 180°, nên ∠bOc = 180° − 115° = 65°.<br>✗ 115°: đó là số đo của ∠aOb, không phải góc còn lại.<br>✗ 75°: trừ nhầm 190° − 115° = 75°.<br>✗ 25°: trừ nhầm 140° − 115° = 25°.",
    "source": "hk1e10-TN7"
   },
   {
    "n": 8,
    "ch": 3,
    "topic": "Tia phân giác",
    "q": "Cho ∠mOn = 54° và Ot là tia phân giác của ∠mOn. Số đo ∠mOt bằng bao nhiêu?",
    "fig": {
     "t": "phan-giac",
     "w": 54,
     "names": [
      "m",
      "n",
      "t",
      "O"
     ],
     "lw": "54°",
     "lh": [
      "?",
      ""
     ]
    },
    "options": [
     "54°",
     "108°",
     "13,5°",
     "27°"
    ],
    "correct": 3,
    "answer": "27°",
    "explanation": "🔑 Tia phân giác chia góc thành hai góc bằng nhau và bằng nửa góc ban đầu: ∠mOt = 54° : 2 = 27°.<br>✗ 54°: đó là số đo cả góc ∠mOn, không phải một nửa.<br>✗ 108°: nhầm dấu phép tính, lấy 54° · 2 thay vì chia 2.<br>✗ 13,5°: nhầm chia cho 4 thay vì chia cho 2.",
    "source": "hk1e10-TN8"
   },
   {
    "n": 9,
    "ch": 3,
    "topic": "Tiên đề Euclid",
    "q": "Cho điểm K không nằm trên đường thẳng d. Phát biểu nào sau đây đúng theo tiên đề Euclid?",
    "fig": {
     "t": "euclid",
     "m": "point"
    },
    "options": [
     "Có duy nhất một đường thẳng qua K song song với d",
     "Có vô số đường thẳng qua K song song với d",
     "Không có đường thẳng nào qua K song song với d",
     "Có đúng hai đường thẳng qua K song song với d"
    ],
    "correct": 0,
    "answer": "Có duy nhất một đường thẳng qua K song song với d",
    "explanation": "🔑 Tiên đề Euclid: qua một điểm nằm ngoài một đường thẳng, có một và chỉ một đường thẳng song song với đường thẳng đó, nên qua K có duy nhất một đường thẳng song song với d.<br>✗ Có vô số đường thẳng qua K song song với d: sai, tiên đề khẳng định chỉ có một.<br>✗ Không có đường thẳng nào: sai, luôn tồn tại đúng một đường thẳng như vậy.<br>✗ Có đúng hai đường thẳng: sai, chỉ có duy nhất một, không phải hai.",
    "source": "hk1e10-TN9"
   },
   {
    "n": 10,
    "ch": 3,
    "topic": "Giả thiết - Kết luận",
    "q": "Định lí: “Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng thứ ba thì chúng song song với nhau”. Đâu là phần Kết luận (KL) của định lí này?",
    "fig": {
     "t": "vuong-song",
     "m": "perp2"
    },
    "options": [
     "Hai đường thẳng đó cùng vuông góc với đường thẳng thứ ba",
     "Hai đường thẳng đó song song với nhau",
     "Hai đường thẳng đó phân biệt",
     "Có một đường thẳng thứ ba"
    ],
    "correct": 1,
    "answer": "Hai đường thẳng đó song song với nhau",
    "explanation": "🔑 Trong một định lí, phần sau “thì” là Kết luận (KL): ở đây KL là “hai đường thẳng đó song song với nhau”.<br>✗ Hai đường thẳng đó cùng vuông góc với đường thẳng thứ ba: đây là phần Giả thiết (GT), nằm sau “Nếu”.<br>✗ Hai đường thẳng đó phân biệt: cũng thuộc phần Giả thiết, là điều kiện cho trước.<br>✗ Có một đường thẳng thứ ba: chỉ là một chi tiết của giả thiết, không phải kết luận.",
    "source": "hk1e10-TN10"
   },
   {
    "n": 11,
    "ch": 4,
    "topic": "Tổng ba góc",
    "q": "Tam giác DEF có ∠D = 72° và ∠E = 55°. Số đo ∠F bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac",
     "v": [
      "D",
      "E",
      "F"
     ],
     "angles": {
      "D": "72°",
      "E": "55°",
      "F": "?"
     }
    },
    "options": [
     "127°",
     "17°",
     "53°",
     "108°"
    ],
    "correct": 2,
    "answer": "53°",
    "explanation": "🔑 Tổng ba góc trong một tam giác bằng 180°, nên ∠F = 180° − 72° − 55° = 53°.<br>✗ 127°: nhầm cộng 72° + 55° mà quên trừ khỏi 180°.<br>✗ 17°: nhầm phép tính, lấy 72° − 55°.<br>✗ 108°: nhầm phép tính 180° − 72° mà quên trừ tiếp 55°.",
    "source": "hk1e10-TN11"
   },
   {
    "n": 12,
    "ch": 5,
    "topic": "Loại dữ liệu",
    "q": "Thời gian tự học ở nhà mỗi ngày (tính bằng phút) của các bạn trong lớp 7B là loại dữ liệu nào?",
    "options": [
     "Định tính, có thể sắp thứ tự",
     "Định tính, không thể sắp thứ tự",
     "Không phải là dữ liệu thống kê",
     "Định lượng (là số)"
    ],
    "correct": 3,
    "answer": "Định lượng (là số)",
    "explanation": "🔑 Thời gian tính bằng phút là các con số đo đếm được nên thuộc dữ liệu định lượng.<br>✗ Định tính, có thể sắp thứ tự: sai vì dữ liệu này là số đo, không phải các mức xếp hạng bằng chữ.<br>✗ Định tính, không thể sắp thứ tự: sai vì đây là số liệu, không phải nhãn phân loại.<br>✗ Không phải là dữ liệu thống kê: sai vì đây rõ ràng là một dữ liệu có thể thu thập và thống kê.",
    "source": "hk1e10-TN12"
   },
   {
    "n": 13,
    "ch": 1,
    "topic": "Phép tính với số hữu tỉ",
    "q": "Tính giá trị của biểu thức: (−9/11)·3/8 + (−9/11)·2/8 + (−9/11)·3/8",
    "options": [
     "−9/11",
     "9/11",
     "−27/11",
     "−9/88"
    ],
    "correct": 0,
    "answer": "−9/11",
    "explanation": "🔑 Đặt nhân tử chung −9/11: biểu thức = (−9/11)·(3/8+2/8+3/8) = (−9/11)·(8/8) = (−9/11)·1 = −9/11.<br>✗ 9/11: nhầm dấu, bỏ mất dấu âm của thừa số chung −9/11.<br>✗ −27/11: nhầm cộng ba lần −9/11 mà không đặt nhân tử chung với tổng phân số trong ngoặc.<br>✗ −9/88: nhầm nhân mẫu số 11 với 8 thay vì rút gọn 8/8 = 1.",
    "source": "hk1e10-TL13"
   },
   {
    "n": 14,
    "ch": 1,
    "topic": "Chuyển vế",
    "q": "Tìm x, biết: 3x − 2/5 = 7/5",
    "options": [
     "9/5",
     "3/5",
     "−3/5",
     "5/3"
    ],
    "correct": 1,
    "answer": "3/5",
    "explanation": "🔑 Chuyển vế: 3x = 7/5 + 2/5 = 9/5, suy ra x = 9/5 : 3 = 3/5.<br>✗ 9/5: dừng lại sau khi chuyển vế, quên chia tiếp cho 3.<br>✗ −3/5: chuyển vế sai dấu, tính nhầm 3x = 2/5 − 7/5.<br>✗ 5/3: nhầm lấy nghịch đảo của kết quả đúng 3/5.",
    "source": "hk1e10-TL14"
   },
   {
    "n": 15,
    "ch": 1,
    "topic": "Áp dụng lũy thừa",
    "q": "Tìm x, biết: 3 mũ (x + 3) − 2 · 3 mũ (x + 2) = 3⁹",
    "options": [
     "x = 9",
     "x = 6",
     "x = 7",
     "x = 11"
    ],
    "correct": 2,
    "answer": "x = 7",
    "explanation": "🔑 Đưa về cùng lũy thừa 3 mũ (x + 2): 3 mũ (x + 3) − 2 · 3 mũ (x + 2) = 3 mũ (x + 2) · 3 − 2 · 3 mũ (x + 2) = 3 mũ (x + 2) · (3 − 2) = 3 mũ (x + 2). Vậy 3 mũ (x + 2) = 3⁹, suy ra x + 2 = 9, x = 7.<br>✗ x = 9: nhầm đồng nhất trực tiếp số mũ (x + 2) với 9 rồi lấy luôn x = 9 mà không trừ 2.<br>✗ x = 6: nhầm dấu, cho x + 3 = 9 rồi trừ thêm 2 một cách sai.<br>✗ x = 11: nhầm cộng số mũ 9 + 2 thay vì trừ.",
    "source": "hk1e10-TL15"
   },
   {
    "n": 16,
    "ch": 1,
    "topic": "Bài toán thực tế với phân số",
    "q": "Một bể nước đang chứa đầy (coi dung tích cả bể là 1 đơn vị). Buổi sáng, người ta dùng hết 3/8 bể để tưới cây; buổi chiều bơm thêm vào một lượng bằng 1/4 bể. Hỏi lúc này bể chứa bằng bao nhiêu phần so với lúc đầy?",
    "options": [
     "3/4 bể",
     "3/8 bể",
     "5/8 bể",
     "7/8 bể"
    ],
    "correct": 3,
    "answer": "7/8 bể",
    "explanation": "🔑 Coi cả bể là 1. Sau buổi sáng còn lại 1 − 3/8 = 5/8 bể; bơm thêm 1/4 bể vào buổi chiều: 5/8 + 1/4 = 5/8 + 2/8 = 7/8 bể.<br>✗ 3/4 bể: cộng nhầm tử số mà quên quy đồng mẫu số của 1/4, tính 8 − 3 + 1 = 6 rồi lấy 6/8 = 3/4.<br>✗ 3/8 bể: nhầm dấu, trừ tiếp 1/4 thay vì cộng thêm vào: 5/8 − 2/8 = 3/8.<br>✗ 5/8 bể: quên cộng lượng nước bơm thêm vào buổi chiều, chỉ tính đến sau buổi sáng.",
    "source": "hk1e10-TL16"
   },
   {
    "n": 17,
    "ch": 1,
    "topic": "Bài toán giảm giá",
    "q": "Nhân dịp Tết, một cửa hàng quần áo giảm giá 30% cho tất cả sản phẩm; khách hàng thân thiết được giảm thêm 10% trên giá đã giảm. Chị Hoa là khách thân thiết, mua một chiếc áo khoác và trả 504 000 đồng. Hỏi giá niêm yết ban đầu của chiếc áo khoác là bao nhiêu?",
    "options": [
     "800 000 đồng",
     "720 000 đồng",
     "840 000 đồng",
     "630 000 đồng"
    ],
    "correct": 0,
    "answer": "800 000 đồng",
    "explanation": "🔑 Giá sau khi giảm 30% rồi giảm thêm 10% trên giá đã giảm là P·0,7·0,9 = 0,63P. Từ 0,63P = 504 000, suy ra P = 504 000 : 0,63 = 800 000 đồng.<br>✗ 720 000 đồng: chỉ tính một lần giảm 30%, quên phần giảm thêm 10%: 504 000 : 0,7 = 720 000.<br>✗ 840 000 đồng: nhầm cộng hai mức giảm thành 40% rồi tính 504 000 : 0,6 = 840 000.<br>✗ 630 000 đồng: nhầm gộp hai mức giảm thành một lần giảm 20%: 504 000 : 0,8 = 630 000.",
    "source": "hk1e10-TL17"
   },
   {
    "n": 18,
    "ch": 2,
    "topic": "Áp dụng tính toán",
    "q": "Tính giá trị của biểu thức: (−2)³ + √36 − |−5|",
    "options": [
     "9",
     "−7",
     "−5",
     "3"
    ],
    "correct": 1,
    "answer": "−7",
    "explanation": "🔑 Tính từng phần: (−2)³ = −8; √36 = 6; |−5| = 5. Biểu thức = −8 + 6 − 5 = −7.<br>✗ 9: nhầm dấu của (−2)³, tính thành +8 rồi 8 + 6 − 5 = 9.<br>✗ −5: nhầm lẫn (−2)³ = −2·3 = −6 (nhân thay vì lũy thừa) rồi −6 + 6 − 5 = −5.<br>✗ 3: nhầm dấu phép trừ cuối, cộng thêm |−5| thay vì trừ: −8 + 6 + 5 = 3.",
    "source": "hk1e10-TL18"
   },
   {
    "n": 19,
    "ch": 2,
    "topic": "Giá trị tuyệt đối",
    "q": "Tìm x, biết: |x − 4| = 11",
    "options": [
     "x = 15",
     "x = 7 hoặc x = −15",
     "x = 15 hoặc x = −7",
     "x = 11 hoặc x = −11"
    ],
    "correct": 2,
    "answer": "x = 15 hoặc x = −7",
    "explanation": "🔑 |x − 4| = 11 có hai trường hợp: x − 4 = 11 hoặc x − 4 = −11, suy ra x = 15 hoặc x = −7.<br>✗ x = 15: chỉ xét trường hợp x − 4 = 11, bỏ sót trường hợp x − 4 = −11.<br>✗ x = 7 hoặc x = −15: chuyển vế quên đổi dấu, tính x = 11 − 4 hoặc x = −11 − 4 thay vì cộng 4.<br>✗ x = 11 hoặc x = −11: bỏ qua hẳn số −4 trong biểu thức, coi như giải |x| = 11.",
    "source": "hk1e10-TL19"
   },
   {
    "n": 20,
    "ch": 2,
    "topic": "Căn bậc hai số học",
    "q": "Một mảnh vườn hình vuông có diện tích 130 m². Tính độ dài cạnh mảnh vườn (làm tròn kết quả đến hàng phần mười).",
    "options": [
     "11,5 m",
     "11,3 m",
     "11 m",
     "11,4 m"
    ],
    "correct": 3,
    "answer": "11,4 m",
    "explanation": "🔑 Cạnh hình vuông là √130 ≈ 11,4018 m; làm tròn đến hàng phần mười (xét chữ số hàng phần trăm là 0 &lt; 5) ta được 11,4 m.<br>✗ 11,5 m: làm tròn sai, tăng chữ số hàng phần mười dù chữ số hàng phần trăm là 0 &lt; 5.<br>✗ 11,3 m: làm tròn xuống nhầm, không xét đúng chữ số hàng phần trăm.<br>✗ 11 m: làm tròn đến hàng đơn vị, không đúng yêu cầu đến hàng phần mười.",
    "source": "hk1e10-TL20"
   },
   {
    "n": 21,
    "ch": 3,
    "topic": "Góc so le trong",
    "q": "Cho p ∥ q, đường thẳng c cắt p tại A và cắt q tại B. Tại A, góc ∠1 và góc ∠2 là hai góc kề bù, biết ∠1 = 110°. Góc ∠2 và một góc tại B là hai góc so le trong. Tính số đo góc tại B đó.",
    "fig": {
     "t": "cut2",
     "par": true,
     "names": [
      "p",
      "q",
      "c"
     ],
     "angles": {
      "A4": "110°",
      "A3": "∠2",
      "B1": "?"
     }
    },
    "options": [
     "70°",
     "110°",
     "50°",
     "130°"
    ],
    "correct": 0,
    "answer": "70°",
    "explanation": "🔑 Trước tiên tính ∠2 = 180° − ∠1 = 180° − 110° = 70° (hai góc kề bù). Vì p ∥ q nên hai góc so le trong bằng nhau, suy ra góc tại B = ∠2 = 70°.<br>✗ 110°: nhầm lấy luôn ∠1 làm góc so le trong, bỏ qua bước tính ∠2 qua kề bù.<br>✗ 50°: trừ nhầm 180° − 110° = 50° do đặt tính sai.<br>✗ 130°: nhầm lấy góc kề bù theo hướng ngược, cộng nhầm 20° vào 110°.",
    "source": "hk1e10-TL21"
   },
   {
    "n": 22,
    "ch": 4,
    "topic": "Trường hợp c-g-c",
    "q": "Cho △ABC và △DEF có AB = DE, AC = DF và ∠A = ∠D (∠A là góc xen giữa AB và AC). Hai tam giác này bằng nhau theo trường hợp nào?",
    "fig": {
     "t": "hai-tam-giac",
     "m": "cgc",
     "v": [
      [
       "A",
       "B",
       "C"
      ],
      [
       "D",
       "E",
       "F"
      ]
     ]
    },
    "options": [
     "cạnh – cạnh – cạnh (c-c-c)",
     "cạnh – góc – cạnh (c-g-c)",
     "góc – cạnh – góc (g-c-g)",
     "Không đủ điều kiện để kết luận"
    ],
    "correct": 1,
    "answer": "cạnh – góc – cạnh (c-g-c)",
    "explanation": "🔑 Hai cạnh AB = DE, AC = DF và góc xen giữa ∠A = ∠D bằng nhau nên △ABC = △DEF theo trường hợp cạnh - góc - cạnh (c-g-c).<br>✗ cạnh – cạnh – cạnh: cần cả ba cặp cạnh bằng nhau, nhưng đề chỉ cho hai cặp cạnh và một góc.<br>✗ góc – cạnh – góc: cần hai góc và cạnh xen giữa, không phù hợp với dữ kiện đã cho.<br>✗ Không đủ điều kiện: sai vì góc ∠A xen giữa đúng hai cạnh AB, AC đã cho nên đủ điều kiện c-g-c.",
    "source": "hk1e10-TL22"
   },
   {
    "n": 23,
    "ch": 4,
    "topic": "Tam giác cân",
    "q": "Tam giác MNP cân tại M, biết ∠N = 68°. Số đo ∠M bằng bao nhiêu?",
    "fig": {
     "t": "tam-giac-can",
     "v": [
      "M",
      "N",
      "P"
     ],
     "angles": {
      "N": "68°",
      "M": "?"
     }
    },
    "options": [
     "68°",
     "112°",
     "44°",
     "56°"
    ],
    "correct": 2,
    "answer": "44°",
    "explanation": "🔑 Tam giác cân tại M có hai góc đáy bằng nhau: ∠N = ∠P = 68°. Áp dụng tổng ba góc: ∠M = 180° − 68° − 68° = 44°.<br>✗ 68°: nhầm lấy luôn số đo góc đáy làm góc ở đỉnh.<br>✗ 112°: nhầm cộng 68° + 44° do tính sai góc còn lại.<br>✗ 56°: nhầm chia đôi 112° mà không tính đúng tổng ba góc trước.",
    "source": "hk1e10-TL23"
   },
   {
    "n": 24,
    "ch": 5,
    "topic": "Tỉ lệ phần trăm",
    "q": "Khảo sát sở thích đọc sách của 50 học sinh lớp 7 cho kết quả: Truyện tranh: 20 bạn; Khoa học: 12 bạn; Văn học: 10 bạn; còn lại thích Báo/Tạp chí. Tỉ lệ phần trăm học sinh thích Báo/Tạp chí là bao nhiêu?",
    "options": [
     "24%",
     "20%",
     "8%",
     "16%"
    ],
    "correct": 3,
    "answer": "16%",
    "explanation": "🔑 Số bạn thích Báo/Tạp chí = 50 − (20+12+10) = 8 bạn. Tỉ lệ phần trăm = 8/50 · 100% = 16%.<br>✗ 24%: nhầm lấy số bạn thích Khoa học (12) làm số bạn thích Báo/Tạp chí rồi tính 12/50 · 100% = 24%.<br>✗ 20%: nhầm lấy số bạn thích Văn học (10) làm số bạn thích Báo/Tạp chí rồi tính 10/50 · 100% = 20%.<br>✗ 8%: nhầm lấy luôn số bạn (8) làm tỉ lệ phần trăm mà quên nhân với 100% và chia cho 50.",
    "source": "hk1e10-TL24"
   },
   {
    "n": 25,
    "ch": 5,
    "topic": "Đọc biểu đồ đoạn thẳng",
    "q": "Biểu đồ đoạn thẳng cho biết số lượt bạn đọc mượn truyện ở thư viện trường: tháng 1: 80; tháng 2: 90; tháng 3: 95; tháng 4: 100. Số lượt mượn truyện tháng 4 tăng bao nhiêu phần trăm so với tháng 1?",
    "fig": { "t": "line-chart", "labels": ["T1", "T2", "T3", "T4"], "values": [80, 90, 95, 100] },
    "options": [
     "25%",
     "20%",
     "80%",
     "12,5%"
    ],
    "correct": 0,
    "answer": "25%",
    "explanation": "🔑 Mức tăng = 100 − 80 = 20 (lượt). Tỉ lệ tăng so với tháng 1 = 20/80 · 100% = 25%.<br>✗ 20%: nhầm lấy mẫu số là số liệu tháng 4 thay vì tháng 1, tính 20/100 · 100%.<br>✗ 80%: nhầm tính tỉ số tháng 1 so với tháng 4 (80/100) thay vì tính phần trăm tăng thêm.<br>✗ 12,5%: nhầm mức tăng chỉ là 10 (lấy nửa chênh lệch) rồi tính 10/80 · 100%.",
    "source": "hk1e10-TL25"
   }
  ],
  "report": {
   "structureVsPdf": "Matches the model's 8 TN + 6 TL shape (nhận biết Q1-12 in the spec's topic order, TL word problems for %, phân số, góc, tam giác, thống kê); chapter quota ch1:7 ch2:7 ch3:5 ch4:3 ch5:3 hit exactly; dropped the model's 3D-solid lăng trụ câu and its hình hộp TN câu (chương 10, out of curriculum) and kept its discount/tia phân giác/song song dạng bài with fresh numbers.",
   "edits": [
    {
     "n": 1,
     "what": "Option '5/12 ∈ I' used the forbidden symbol I; rewrote as words '5/12 là số vô tỉ' and updated the matching ✗ line (rule D)."
    },
    {
     "n": 15,
     "what": "Stem/explanation used caret '3^(x+3)' notation; rewrote as '3 mũ (x + 3)' / '3 mũ (x + 2)' per rule D (no caret)."
    },
    {
     "n": 16,
     "what": "Dropped: '45 công nhân chia theo tỉ lệ 2:3:4' was both a duplicate of Exam 2 #20 and a forbidden tỉ lệ-thức/chia-tỉ-lệ dạng (chương 6, Tập 2). Replaced with a same-difficulty ch1 two-step fraction word problem (bể nước tưới cây rồi bơm thêm), fresh numbers, correct kept at option 4 to preserve the answer-position spread."
    },
    {
     "n": 18,
     "what": "Original used √81, which is exactly the model PDF's Câu 3 (TN) number — reused-number risk under rule B. Swapped to √36 and rebalanced (−2)³ + √36 − |−5| = −7, with a new plausible slip set."
    },
    {
     "n": 19,
     "what": "Original |x − 4| = 9 reused the model PDF's Câu 4 constant (9) for the same GTTĐ-equation dạng. Changed to |x − 4| = 11 (x = 15 or x = −7) with matching distractor logic, for freshness vs the model paper."
    }
   ]
  }
 }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_EXAMS };
}
