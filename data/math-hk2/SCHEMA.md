# data/math-hk2 — Toán 7 Học kì 2, ngân hàng luyện tập

`base.json` là 500 câu gốc (100 câu × 5 chương, m6-1…m10-100), trích một lần
từ `js/math-data-hk2.js` khi bản đó còn viết tay. Các tệp `ch<N>-add-<NN>.json`
là câu bổ sung, mỗi tệp một tác giả. `scripts/build-math-hk2-data.js` ghép
base + bổ sung thành `js/math-data-hk2.js` — KHÔNG sửa tay tệp js nữa.

Kiểm tra một tệp: `node scripts/validate-math-hk2.js data/math-hk2/ch6-add-03.json`

## Tệp bổ sung

```json
{ "ch": 6, "file": "03", "questions": [ …đúng 20 câu… ] }
```

Id: `m<ch>-<số>`, số = 100 + (NN − 1) × 20 + (1…20). Tệp `ch6-add-03.json`
giữ m6-141 … m6-160. Không được trùng, không được lệch.

## Câu trắc nghiệm

```json
{ "id": "m6-141", "ch": 6, "topic": "Đại lượng tỉ lệ thuận",
  "q": "Biết y tỉ lệ thuận với x theo hệ số tỉ lệ 3. Khi x = −4 thì y bằng bao nhiêu?",
  "options": ["y = −12", "y = 12", "y = −7", "y = −4/3"], "correct": 0, "answer": "y = −12",
  "explanation": "🔑 <b>Lý thuyết:</b> … (SGK tr. N)<br>🔑 <b>Áp dụng:</b> …<br>✗ …<br>✗ …<br>✗ …" }
```

- `options`: 4 phương án khác nhau; `answer` PHẢI bằng đúng `options[correct]`.
- Ba phương án sai là ba lỗi học sinh hay mắc (đổi dấu, quên hệ số, nhầm
  tỉ lệ thuận/nghịch, cộng thay vì nhân…), không phải số bịa.
- Vị trí đáp án đúng rải đều A–D trong tệp (khoảng 5 câu mỗi vị trí).

## Câu tự nhập số (`calc`)

```json
{ "id": "m7-152", "ch": 7, "topic": "Đa thức một biến", "type": "calc", "keys": [],
  "q": "Cho P(x) = 3x² − 5x + 2. Tính P(−1).",
  "answer": "10",
  "explanation": "🔑 …<br>✗ 0 — nếu quên rằng (−1)² = 1 dương…<br>✗ −4 — …<br>✗ 6 — …" }
```

- `answer` là ĐÚNG MỘT SỐ: số nguyên có dấu (`−12`, dùng dấu trừ Unicode `−`
  hoặc `-` đều được) hoặc phân số tối giản `a/b`. Không thập phân, không đơn
  vị, không chữ. Đề phải ra được một số như vậy.
- Không có `options`, không có `correct`.
- Ba dòng ✗ nêu ba KẾT QUẢ SAI hay gặp và vì sao.
- Lưu ý: bất kỳ câu trắc nghiệm nào có `answer` là một số thuần cũng sẽ bị
  build tự động đổi thành `calc` — nên nếu muốn giữ trắc nghiệm, đáp án phải
  mang chữ/ký hiệu (ví dụ `y = −12`, `x = 3 hoặc x = −3`).

## Lời giải (`explanation`) — mọi câu

- Mở đầu `🔑 <b>Lý thuyết:</b>` nêu quy tắc / định nghĩa, kèm trang SGK Kết
  nối tri thức Tập hai `(SGK tr. N)`; rồi `<br>🔑 <b>Áp dụng:</b>` giải từng
  bước, có thể `<b>Bước 1 —</b>`, `<b>Bước 2 —</b>`.
- Kết thúc bằng ĐÚNG BA dòng `<br>✗ …`.
- Chỉ dùng thẻ `<b>` và `<br>`. Dấu "<" trong toán viết là `&lt;` hoặc bằng
  chữ ("nhỏ hơn"); không bao giờ để "<" trần.
- Không được chứa `undefined`, `null`, `NaN`.

## Ký hiệu toán

Luỹ thừa bằng chữ trên: x², x³, a⁴. Dấu trừ: `−`. Nhân: `·` hoặc `×`.
Phân số: `a/b`. Căn: `√`. Không dùng LaTeX, không dùng `^`.

## Nhãn `topic` — chỉ dùng đúng các nhãn sau

- Chương 6: `Tỉ lệ thức`, `Tính chất của dãy tỉ số bằng nhau`,
  `Đại lượng tỉ lệ thuận`, `Đại lượng tỉ lệ nghịch`
- Chương 7: `Biểu thức đại số`, `Đa thức một biến`,
  `Phép cộng và phép trừ đa thức một biến`, `Phép nhân đa thức một biến`,
  `Phép chia đa thức một biến`

Nhãn hiện ngay trên đầu câu hỏi, nên nhãn không được trùng với đáp án.

## Những điều KHÔNG làm

- Không `fig`, không nhắc "hình vẽ / hình bên": chương 6–7 là đại số.
- Không lặp lại đề của 100 câu gốc trong chương (đọc chúng trước:
  `node -e 'require("./data/math-hk2/base.json").questions.filter(q=>q.ch===6).forEach(q=>console.log(q.id, q.q))'`).
- Không lặp lại đề trong cùng tệp; đổi số liệu chưa đủ — đổi cả tình huống.
