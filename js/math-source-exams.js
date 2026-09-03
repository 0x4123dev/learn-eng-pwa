// Five real 2025-2026 HK1 papers transcribed from the PDFs supplied by the
// user. Wording, numbers, order and choices follow the source papers.
//
// The tự luận questions are NOT self-assessed. Every one of them carries
// answerParts — the final results the child types after working the problem on
// paper — and the app marks those, so a wrong answer costs the mark exactly as
// it would at school. Only the WORKING stays on paper; a proof still cannot be
// graded by string matching, so those questions ask for the conclusion the
// proof arrives at rather than the proof itself.
//
// (This note used to say the opposite, long after the code had moved on. It
// was believed. tests/math-source-exams.test.js now checks the claim rather
// than leaving it to a comment.)
//
// Every figure here is DRAWN — a `fig` spec that js/math-figures.js turns into
// SVG — not a crop of the scanned page. The twenty-two figures used to be
// `_srcCrop` boxes cut straight out of assets/math-exams/*.jpg: blurry on a
// phone, stuck in light theme, unreadable when zoomed, and heavier than the
// whole rest of the app. The scans are still in the repo, but only as the
// thing a human LOOKS at while redrawing; nothing in the app loads them.

function _srcMcq(id, n, ch, topic, q, options, correct, answer, explanation, fig, sourceIssue) {
  const out = { id, n, ch, topic, q, options, correct, answer, explanation };
  if (fig) out.fig = fig;
  if (sourceIssue) out.sourceIssue = sourceIssue;
  return out;
}

function _srcWritten(id, n, ch, topic, q, answer, explanation, fig) {
  const out = { id, n, ch, topic, q, type: 'written', answer, explanation };
  if (fig) out.fig = fig;
  return out;
}

const MATH_SOURCE_EXAMS = [
  {
    id: 'hk1-source-1', title: 'HK1 1', school: 'THCS Trần Quý Cáp - Đà Nẵng',
    sourceFile: 'de-cuoi-ky-1-toan-7-nam-2025-2026-truong-thcs-tran-quy-cap-da-nang.pdf',
    questions: [
      _srcMcq('s1-1', 1, 1, 'I. Trắc nghiệm - Câu 1', 'Câu 1. Số hữu tỉ được viết dưới dạng số thập phân nào dưới đây?',
        ['hữu hạn.', 'vô hạn tuần hoàn.', 'hữu hạn hoặc vô hạn tuần hoàn.', 'vô hạn không tuần hoàn.'], 2,
        'hữu hạn hoặc vô hạn tuần hoàn.', '🔑 Số hữu tỉ có biểu diễn thập phân hữu hạn hoặc vô hạn tuần hoàn.'),
      _srcMcq('s1-2', 2, 1, 'I. Trắc nghiệm - Câu 2', 'Câu 2. Tập hợp các số hữu tỉ kí hiệu là',
        ['I.', 'ℚ.', 'ℤ.', 'ℕ.'], 1, 'ℚ.', '🔑 Tập hợp số hữu tỉ được kí hiệu là ℚ.'),
      _srcMcq('s1-3', 3, 2, 'I. Trắc nghiệm - Câu 3', 'Câu 3. Căn bậc hai số học của số dương a kí hiệu là',
        ['a.', '√a.', '|a|.', 'a².'], 1, '√a.', '🔑 Căn bậc hai số học của a được kí hiệu là √a.'),
      _srcMcq('s1-4', 4, 2, 'I. Trắc nghiệm - Câu 4', 'Câu 4. Tập hợp các số vô tỉ, kí hiệu là',
        ['ℕ.', 'I.', 'ℚ.', 'ℝ.'], 1, 'I.', '🔑 Theo kí hiệu dùng trong đề, tập hợp số vô tỉ là I.'),
      _srcMcq('s1-5', 5, 2, 'I. Trắc nghiệm - Câu 5', 'Câu 5. Trong các khẳng định sau, khẳng định nào đúng?',
        ['√2 ∈ I.', '4/5 ∈ ℤ.', '−9/2 ∉ ℚ.', '−7 ∈ ℕ.'], 0, '√2 ∈ I.', '🔑 √2 là số vô tỉ. Các khẳng định còn lại đều sai.'),
      _srcMcq('s1-6', 6, 2, 'I. Trắc nghiệm - Câu 6', 'Câu 6. Tập hợp các số thực, kí hiệu là',
        ['ℤ.', 'I.', 'ℚ.', 'ℝ.'], 3, 'ℝ.', '🔑 Tập hợp số thực được kí hiệu là ℝ.'),
      _srcMcq('s1-7', 7, 3, 'I. Trắc nghiệm - Câu 7', 'Câu 7. Qua điểm A nằm ngoài đường thẳng a, vẽ được … đường thẳng song song với a.',
        ['một và chỉ một;', 'hai;', 'ba;', 'vô số.'], 0, 'một và chỉ một;', '🔑 Theo tiên đề Euclid, có một và chỉ một đường thẳng như vậy.'),
      _srcMcq('s1-8', 8, 3, 'I. Trắc nghiệm - Câu 8', 'Câu 8. Trong các khẳng định sau, khẳng định nào là định lí?',
        ['Tổng số đo ba góc của một tam giác bằng 180°.', 'Tổng hai góc nhọn của tam giác vuông bằng 100°.', 'Một tam giác bất kỳ luôn luôn có ít nhất một góc tù.', 'Căn bậc hai số học của một số dương bao giờ cũng nhỏ hơn 0.'], 0,
        'Tổng số đo ba góc của một tam giác bằng 180°.', '🔑 Đây là định lí tổng ba góc của một tam giác.'),
      _srcMcq('s1-9', 9, 4, 'I. Trắc nghiệm - Câu 9', 'Câu 9. Cho tam giác ABC và tam giác DEF có: AB = EF; BC = FD; AC = ED; ∠A = ∠E; ∠B = ∠F; ∠C = ∠D. Hãy chọn cách viết đúng.',
        ['△ABC = △DEF.', '△ABC = △FDE.', '△ABC = △EFD.', '△ACB = △DEF.'], 2,
        '△ABC = △EFD.', '🔑 Thứ tự tương ứng là A↔E, B↔F, C↔D nên △ABC = △EFD.'),
      _srcMcq('s1-10', 10, 4, 'I. Trắc nghiệm - Câu 10', 'Câu 10. Tam giác cân là tam giác có',
        ['ba cạnh bằng nhau.', 'hai cạnh bằng nhau.', 'một góc vuông.', 'một góc nhọn.'], 1,
        'hai cạnh bằng nhau.', '🔑 Tam giác cân là tam giác có hai cạnh bằng nhau.'),
      _srcMcq('s1-11', 11, 5, 'I. Trắc nghiệm - Câu 11', 'Câu 11. Hoạt động nào sau đây là thu thập dữ liệu?',
        ['Trực nhật.', 'Ghi danh sách học sinh đi học trễ.', 'Học bài.', 'Chơi bóng đá.'], 1,
        'Ghi danh sách học sinh đi học trễ.', '🔑 Ghi danh sách là hoạt động thu thập và lưu lại dữ liệu.'),
      _srcMcq('s1-12', 12, 5, 'I. Trắc nghiệm - Câu 12', 'Câu 12. Biểu đồ hình quạt tròn thống kê tỉ lệ điểm kiểm tra cuối học kì I khối 7. Biết không có học sinh dưới 5,0. Số học sinh đạt điểm từ 9,0 đến 10,0 chiếm tỉ lệ là',
        ['10%.', '14%.', '15%.', '20%.'], null, '9% (đề gốc không có phương án đúng)',
        '🔑 Các phần đã biết là 50% + 25% + 16% = 91%, nên phần còn lại là <b>9%</b>. PDF gốc không có 9% trong bốn lựa chọn; đây là lỗi của đề nguồn và câu này không trừ điểm.',
        { t: 'pie-chart', segments: [{ label: '5,1–6,4', value: 50 }, { label: '6,5–8,0', value: 25 }, { label: '8,1–8,9', value: 16 }, { label: '9,0–10,0', value: 9, text: '?' }] },
        'Các phần cộng lại cho kết quả 9%, nhưng đề gốc thiếu lựa chọn 9%. (Trong ảnh của đề gốc, màu các ô chú giải còn không khớp với màu các hình quạt; hình vẽ lại ở đây đã sửa chỗ đó.)'),
      _srcWritten('s1-13', 13, 2, 'II. Tự luận - Bài 1 (1,0 điểm)', 'Bài 1 (1,0 điểm). Tính: a) √9 + √81 − √16; b) √49 + √25 − √121.',
        'a) 8; b) 1.', '🔑 a) 3 + 9 − 4 = <b>8</b>.<br>🔑 b) 7 + 5 − 11 = <b>1</b>.'),
      _srcWritten('s1-14', 14, 2, 'II. Tự luận - Bài 2 (1,0 điểm)', 'Bài 2 (1,0 điểm). a) Dựa vào khái niệm căn bậc hai số học, tìm căn bậc hai số học của 49 và 0,25. b) Một đám đất hình vuông có diện tích 1000 m². Tính độ dài cạnh hình vuông (làm tròn đến chữ số thập phân thứ nhất).',
        'a) 7 và 0,5; b) 31,6 m.', '🔑 a) √49 = <b>7</b>; √0,25 = <b>0,5</b>.<br>🔑 b) Cạnh là √1000 ≈ <b>31,6 m</b>.'),
      _srcWritten('s1-15', 15, 3, 'II. Tự luận - Bài 3 (0,5 điểm)', 'Bài 3 (0,5 điểm). Hình vẽ cho biết xx′ // yy′ và ∠ABy′ = 55°. Tính ∠xAB.',
        '55°.', '🔑 Đề gốc vẽ hai đường thẳng xx′, yy′ song song nhưng không viết điều đó ra; ở đây ghi thêm cho rõ, vì nếu không có nó thì không tính được góc.<br>🔑 Với xx′ // yy′ và cát tuyến m, ∠xAB và ∠ABy′ là hai góc so le trong nên ∠xAB = <b>55°</b>.',
        { t: 'cat-tuyen', par: true, dau: [['x', 'x′'], ['y', 'y′']],
          cat: [{ ten: 'm', diem: ['A', 'B'], noi: ['tt', 'dt'], goc: { A: { dt: '?' }, B: { tp: '55°' } } }] }),
      _srcWritten('s1-16', 16, 5, 'II. Tự luận - Bài 4 (0,75 điểm)', 'Bài 4 (0,75 điểm). Biểu đồ thể hiện thời gian giải một bài toán của học sinh lớp 7/4. Lập bảng thống kê. Nếu giải trong 5 phút thì nhận thưởng, lớp có bao nhiêu bạn được nhận thưởng?',
        'Bảng: 5 phút - 2 bạn; 7 phút - 6 bạn; 9 phút - 8 bạn; 11 phút - 10 bạn. Có 2 bạn nhận thưởng.',
        '🔑 Đọc các điểm trên biểu đồ được bảng: (5;2), (7;6), (9;8), (11;10). Chỉ nhóm 5 phút đạt điều kiện nên có <b>2 bạn</b> nhận thưởng.',
        { t: 'line-chart', labels: ['5', '7', '9', '11'], values: [2, 6, 8, 10],
          truc: ['Thời gian (phút)', 'Số học sinh'] }),
      _srcWritten('s1-17', 17, 1, 'II. Tự luận - Bài 5 (0,75 điểm)', 'Bài 5 (0,75 điểm). Tính (0,5 + 7/3)·(4,5 − 7/3).',
        '221/36.', '🔑 (1/2 + 7/3)(9/2 − 7/3) = 17/6 · 13/6 = <b>221/36</b>.'),
      _srcWritten('s1-18', 18, 4, 'II. Tự luận - Bài 6 (2,0 điểm)', 'Bài 6 (2,0 điểm). Cho tam giác ABC có ba góc nhọn và AB < AC, M là trung điểm AB. Trên tia đối của tia MC lấy D sao cho MC = MD. a) Chứng minh △ADM = △BCM. b) Chứng minh AD // BC.',
        'a) △ADM = △BCM theo c-g-c. b) AD // BC.',
        '🔑 a) AM = MB (M là trung điểm AB), MD = MC (giả thiết), ∠AMD = ∠BMC (đối đỉnh), nên △ADM = △BCM theo c-g-c.<br>🔑 b) Suy ra ∠DAM = ∠CBM. Đây là một cặp góc so le trong nên <b>AD // BC</b>.'),
      _srcWritten('s1-19', 19, 4, 'II. Tự luận - Bài 7 (1,0 điểm)', 'Bài 7 (1,0 điểm). Một tam giác vuông có hai cạnh góc vuông x cm và 2x cm (x > 0), diện tích bằng 150 cm². Tính x, làm tròn đến độ chính xác 0,05.',
        'x ≈ 12,2 cm.', '🔑 1/2·x·2x = 150 nên x² = 150. Vì x > 0, x = √150 ≈ 12,247…<br>🔑 Làm tròn với độ chính xác 0,05 nghĩa là làm tròn đến hàng phần mười (vì 0,05 là nửa của 0,1), nên x ≈ <b>12,2 cm</b>.')
    ]
  },

  {
    id: 'hk1-source-2', title: 'HK1 2', school: 'THCS Phạm Hữu Lầu - TP.HCM',
    sourceFile: 'de-cuoi-hoc-ki-1-toan-7-nam-2025-2026-truong-thcs-pham-huu-lau-tp-hcm.pdf',
    questions: [
      _srcMcq('s2-1', 1, 1, 'I. Trắc nghiệm - Câu 1', 'Câu 1. Kết quả viết dưới dạng lũy thừa của phép tính (−1/2)⁴·(−1/2) là:', ['(−1/2)⁵', '(−1/2)⁴', '(−1/2)³', '1/32'], 0, '(−1/2)⁵', '🔑 Nhân hai lũy thừa cùng cơ số: 4 + 1 = 5.'),
      _srcMcq('s2-2', 2, 1, 'I. Trắc nghiệm - Câu 2', 'Câu 2. Phân số nào biểu diễn được dưới dạng số thập phân hữu hạn?', ['11/30', '7/8', '−4/21', '−2/27'], 1, '7/8', '🔑 Quy tắc: rút gọn phân số về tối giản rồi phân tích MẪU ra thừa số nguyên tố. Phân số viết được thành số thập phân HỮU HẠN khi mẫu chỉ chứa thừa số 2 và/hoặc 5; còn thừa bất kì thừa số nguyên tố nào khác thì là số thập phân vô hạn tuần hoàn.<br>🔑 Mẫu 8 = 2³ chỉ gồm thừa số 2, nên 7/8 = <b>0,875</b> — hữu hạn.<br>✗ 11/30: mẫu 30 = 2 · 3 · 5 còn thừa số 3, nên 11/30 = 0,3(6) — vô hạn tuần hoàn.<br>✗ −4/21: mẫu 21 = 3 · 7 không có thừa số 2 hay 5 nào.<br>✗ −2/27: mẫu 27 = 3³ tuy chỉ có MỘT loại thừa số nguyên tố, nhưng đó là 3 chứ không phải 2 hay 5, nên −2/27 = −0,(074) vẫn là số thập phân vô hạn tuần hoàn. Điều quan trọng không phải là mẫu có mấy loại thừa số, mà là các thừa số đó phải là 2 hoặc 5.'),
      _srcMcq('s2-3', 3, 2, 'I. Trắc nghiệm - Câu 3', 'Câu 3. Làm tròn số √84 đến hàng phần mười:', ['9,1', '9,16', '9,17', '9,2'], 3, '9,2', '🔑 √84 ≈ 9,165…, làm tròn đến hàng phần mười được 9,2.'),
      _srcMcq('s2-4', 4, 2, 'I. Trắc nghiệm - Câu 4', 'Câu 4. Phát biểu nào sau đây là đúng?', ['√3 ∈ ℕ', '9/11 ∉ ℚ', '3,572 ∈ ℝ', '9,3(05) ∈ I'], 2, '3,572 ∈ ℝ', '🔑 3,572 là số thập phân hữu hạn nên là số hữu tỉ, mà mọi số hữu tỉ đều là số thực, vậy 3,572 ∈ ℝ.<br>✗ √3 = 1,732… không viết được thành số tự nhiên nên √3 ∉ ℕ.<br>✗ 9/11 là một phân số nên 9/11 ∈ ℚ.<br>✗ 9,3(05) là số thập phân vô hạn <b>tuần hoàn</b> nên nó là số hữu tỉ, không phải số vô tỉ.'),
      _srcMcq('s2-5', 5, 6, 'I. Trắc nghiệm - Câu 5', 'Câu 5. Mặt đáy của hình lăng trụ đứng ở hình bên là:', ['EAD và FBC', 'ABCD và ABFE', 'ABFE', 'ABCD'], 0, 'EAD và FBC', '🔑 Hai mặt đáy song song và bằng nhau là hai tam giác EAD và FBC.', { t: 'lang-tru-tam-giac', v: [['A', 'D', 'E'], ['B', 'C', 'F']] }),
      _srcMcq('s2-6', 6, 3, 'I. Trắc nghiệm - Câu 6', 'Câu 6. Tia Oz là tia phân giác của ∠mOn, biết ∠mOz = 36°. Số đo ∠mOn bằng:', ['36°', '18°', '72°', '144°'], 2, '72°', '🔑 Tia phân giác chia góc làm hai phần bằng nhau nên ∠mOn = 2·36° = 72°.'),
      _srcMcq('s2-7', 7, 3, 'I. Trắc nghiệm - Câu 7', 'Câu 7. Quan sát hình vẽ, ∠P₂ và ∠Q₂ là:', ['Hai góc kề bù', 'Hai góc đối đỉnh', 'Hai góc đồng vị', 'Hai góc so le trong'], 3, 'Hai góc so le trong', '🔑 Hai góc nằm giữa hai đường thẳng và ở hai phía của đường cắt.', { t: 'cat-hai-duong', ten: 'a', giao: [{ ten: 'P', huong: 70, tenDuong: 'b', noi: { deg: 305, r: 30 }, goc: { tp: '4', tt: '1', dt: '3', dp: '2' } }, { ten: 'Q', huong: 110, tenDuong: 'c', noi: { deg: 235, r: 30 }, goc: { tp: '3', tt: '2', dt: '1', dp: '4' } }] }),
      _srcMcq('s2-8', 8, 3, 'I. Trắc nghiệm - Câu 8', 'Câu 8. Hình vẽ nào sau đây có hai đường thẳng song song?', ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], 1, 'Hình 2', '🔑 Ở Hình 2 có một cặp góc so le trong bằng nhau 65°, nên hai đường thẳng song song.', { t: 'chon-song-song', cap: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], hinh: [{ tren: { o: 'dt', vuong: true }, duoi: { o: 'tp', goc: '60°' } }, { tren: { o: 'dp', goc: '65°' }, duoi: { o: 'tt', goc: '65°' } }, { tren: { o: 'dp', goc: '35°' }, duoi: { o: 'tt', goc: '40°' } }, { tren: { o: 'tp', goc: '89°' }, duoi: { o: 'tp', goc: '80°' } }] }),
      _srcWritten('s2-9', 9, 1, 'II. Tự luận - Câu 1 (2 điểm)', 'Câu 1 (2 điểm). Thực hiện phép tính: a) 2/5 + 5/3 − 7/10; b) (1/3 − 5/4 : |3/2|) + 3/4; c) 1 2/3·√(3²/4) + √((−3)²/4)·1 1/3 − 1²/|−2|.', 'a) 41/30; b) 1/4; c) 4.', '🔑 a) = <b>41/30</b>.<br>🔑 b) 1/3 − 5/6 + 3/4 = <b>1/4</b>.<br>🔑 c) 5/3·3/2 + 3/2·4/3 − 1/2 = <b>4</b>.'),
      _srcWritten('s2-10', 10, 1, 'II. Tự luận - Câu 2 (2 điểm)', 'Câu 2 (2 điểm). Tìm x: a) 2 1/5 + x = 3/5; b) 2,5x − 3/4 = (1/2)²; c) |5/9 − x| = (3/2)³ − (3/2)².', 'a) x = −8/5; b) x = 2/5; c) x = −41/72 hoặc x = 121/72.', '🔑 a) x = 3/5 − 11/5 = <b>−8/5</b>.<br>🔑 b) 2,5x = 1 nên x = <b>2/5</b>.<br>🔑 c) Vế phải bằng 9/8; giải hai trường hợp được <b>−41/72</b> hoặc <b>121/72</b>.'),
      _srcWritten('s2-11', 11, 6, 'II. Tự luận - Câu 3 (1,5 điểm)', 'Câu 3 (1,5 điểm). a) Hộp sữa hình hộp chữ nhật dài 7 cm, rộng 5 cm, cao 15 cm. Tính diện tích xung quanh và thể tích. b) Đổ nước từ bình lập phương cạnh 20 cm, mực nước cao 18 cm sang bình lăng trụ đứng tam giác như hình; mực nước cách miệng 10 cm. Tính diện tích thủy tinh của bình 2, không có nắp, làm tròn đến hàng đơn vị.', 'a) Sxq = 360 cm², V = 525 cm³. b) Khoảng 3191 cm².', '🔑 a) Sxq = 2(7+5)·15 = <b>360 cm²</b>; V = 7·5·15 = <b>525 cm³</b>.<br>🔑 b) Thể tích nước là 20·20·18 = 7200 cm³. Đáy bình 2 là tam giác vuông có hai cạnh góc vuông 21 cm và 28 cm (cạnh huyền 35 cm, vì 21² + 28² = 35²) nên diện tích đáy là 21·28/2 = 294 cm². Nước trong bình 2 cao 7200 : 294 ≈ 24,5 cm; mực nước cách miệng 10 cm nên bình cao 7200/294 + 10 ≈ 34,5 cm. Bình không có nắp nên diện tích kính = một mặt đáy + ba mặt bên = 294 + (21+28+35)·(7200/294+10) ≈ <b>3191 cm²</b>.', { t: 'hai-binh-nuoc', b1: { ten: 'Bình 1', canh: '20 cm' }, b2: { ten: 'Bình 2', day: ['35 cm', '21 cm', '28 cm'], hut: '10 cm' } }),
      _srcWritten('s2-12', 12, 3, 'II. Tự luận - Câu 4 (1,5 điểm)', 'Câu 4 (1,5 điểm). Cho hình vẽ: a) Chứng minh AD // BC. b) Biết ∠D₁ = 72°. Tính ∠D₂, ∠C₃. c) Cz là tia phân giác của ∠xCy. Tính ∠xCz.', 'a) AD // BC. b) ∠D₂ = 72°, ∠C₃ = 72°. c) ∠xCz = 54°.', '🔑 a) AD và BC cùng vuông góc với AB nên AD // BC.<br>🔑 b) ∠D₂ đối đỉnh với ∠D₁ nên ∠D₂ = <b>72°</b>.<br>🔑 Trên hình, góc 3 nằm bên phải đường xiên và phía trên BC, còn góc D₂ cũng nằm bên phải đường xiên và phía trên AD: hai góc này ĐỒNG VỊ. Vì AD // BC nên ∠C₃ = ∠D₂ = <b>72°</b>. (Nói cách khác, ∠C₃ so le trong với ∠D₁ nên cũng bằng 72°.)<br>🔑 c) Tia Cy là tia đối của tia CD, nên ∠xCy kề bù với ∠C₃: ∠xCy = 180° − 72° = 108°. Cz là phân giác của ∠xCy nên ∠xCz = 108° : 2 = <b>54°</b>.', { t: 'cat-tuyen', y: [26, 78], dau: [[null, null], [null, 'x']],
        cat: [{ a: 90, x: 0.24, diem: ['A', 'B'], vuong: true, noi: ['tt', 'dt'] },
              { x: 0.7, diem: ['D', 'C'], duoi: 'y', noi: ['tt', { deg: 200, r: 30 }],
                goc: { D: { dt: { n: '1', so: '72°' }, tp: '2' }, C: { tp: '3' } } }],
        tia: [{ tu: 'C', huong: 306, ten: 'z', dai: 36, tenAt: [6, 6], cung: [252, 360] }] }),
      _srcWritten('s2-13', 13, 1, 'II. Tự luận - Câu 5 (1 điểm)', 'Câu 5 (1 điểm). Điện thoại có giá niêm yết 40 triệu đồng, giảm 30%. a) Hùng phải trả bao nhiêu? b) Giá đã giảm đem lại lợi nhuận 5% so với giá gốc. Muốn lợi nhuận 20% thì phải bán giảm bao nhiêu phần trăm so với giá niêm yết?', 'a) 28 triệu đồng. b) Giảm 20%.', '🔑 a) 40·70% = <b>28 triệu đồng</b>.<br>🔑 b) Giá vốn = 28/1,05 = 80/3 triệu. Giá bán để lãi 20% là 32 triệu, tức bằng 80% giá niêm yết, nên <b>giảm 20%</b>.')
    ]
  },

  {
    id: 'hk1-source-3', title: 'HK1 3', school: 'THCS An Điền - TP.HCM',
    sourceFile: 'de-cuoi-ki-1-toan-7-nam-2025-2026-truong-thcs-an-dien-tp-hcm.pdf',
    questions: [
      _srcMcq('s3-1',1,1,'I. Trắc nghiệm - Câu 1','Câu 1. Trong các số sau, số nào là số hữu tỉ?',['√5','−2/5','−√3','6/0'],1,'−2/5','🔑 Số hữu tỉ là số viết được dưới dạng a/b với a, b ∈ ℤ và b ≠ 0, nên <b>−2/5</b> là số hữu tỉ.<br>✗ √5 và −√3 là số vô tỉ (thập phân vô hạn không tuần hoàn).<br>✗ 6/0 không phải là số, vì mẫu bằng 0.'),
      _srcMcq('s3-2',2,1,'I. Trắc nghiệm - Câu 2','Câu 2. Kết quả của phép tính 5⁷/5³ là:',['5¹⁰','5²¹','1','5⁴'],3,'5⁴','🔑 5⁷/5³ = 5⁷⁻³ = 5⁴.'),
      _srcMcq('s3-3',3,2,'I. Trắc nghiệm - Câu 3','Câu 3. Kết quả của phép tính √(4/25) là:',['2/5','17/5','5/5','16/5'],0,'2/5','🔑 √(4/25) = √4/√25 = <b>2/5</b>.'),
      _srcMcq('s3-4',4,1,'I. Trắc nghiệm - Câu 4','Câu 4. Số đối của số 4/29 là:',['−2/6','−4/92','−4/29','29/4'],2,'−4/29','🔑 Số đối của a là −a, vì a + (−a) = 0. Vậy số đối của 4/29 là <b>−4/29</b>.<br>✗ 29/4 là số NGHỊCH ĐẢO của 4/29, không phải số đối.'),
      _srcMcq('s3-5',5,1,'I. Trắc nghiệm - Câu 5','Câu 5. Cho đẳng thức x·y = −2·5. Tỉ lệ thức nào đúng?',['x/5 = −2/y','x/5 = y/(−2)','x/y = −2/5','x/(−5) = −2/y'],0,'x/5 = −2/y','🔑 Tích chéo của x/5 = −2/y là xy = −10.'),
      _srcMcq('s3-6',6,2,'I. Trắc nghiệm - Câu 6','Câu 6. Làm tròn số 2024 đến hàng chục là:',['3000','2020','2030','2000'],1,'2020','🔑 Chữ số hàng đơn vị là 4 nên làm tròn xuống 2020.'),
      _srcMcq('s3-7',7,1,'I. Trắc nghiệm - Câu 7','Câu 7. Kết quả phép tính −7/8 + 1 là:',['−1/8','−2/7','−4/8','1/8'],3,'1/8','🔑 −7/8 + 8/8 = 1/8.'),
      _srcMcq('s3-8',8,1,'I. Trắc nghiệm - Câu 8','Câu 8. Giá trị của x trong tỉ lệ thức x/27 = −2/3,6 là:',['1,5','1,8','12,5','−15'],3,'−15','🔑 x = 27·(−2)/3,6 = −15.'),
      _srcMcq('s3-9',9,6,'I. Trắc nghiệm - Câu 9','Câu 9. Số cạnh của hình hộp chữ nhật là:',['12','6','8','10'],0,'12','🔑 Hình hộp chữ nhật có 8 đỉnh, 6 mặt và <b>12 cạnh</b>.'),
      _srcMcq('s3-10',10,3,'I. Trắc nghiệm - Câu 10','Câu 10. Cho hình vẽ, hãy chọn khẳng định đúng:',['∠A₃ và ∠B₁ là hai góc đồng vị.','∠A₃ và ∠B₃ là hai góc so le trong.','∠A₃ và ∠B₁ là hai góc so le trong.','∠A₃ và ∠B₁ là hai góc đối đỉnh.'],2,'∠A₃ và ∠B₁ là hai góc so le trong.','🔑 Hai góc nằm giữa a, b và ở hai phía của c.',{ t: 'cat-tuyen', ten: ['a', 'b'], nghieng: [7, -4],
        cat: [{ a: 68, ten: 'c', diem: ['A', 'B'], noi: [{ deg: 126, r: 30 }, { deg: 214, r: 30 }],
                goc: { A: { tt: '1', tp: '2', dp: '3', dt: '4' }, B: { tt: '1', tp: '2', dp: '3', dt: '4' } } }] }),
      _srcMcq('s3-11',11,6,'I. Trắc nghiệm - Câu 11','Câu 11. Hình lập phương có cạnh 5 cm. Diện tích xung quanh bằng:',['144 cm²','100 cm²','216 cm²','14,4 cm²'],1,'100 cm²','🔑 Sxq = 4·5² = 100 cm².'),
      _srcMcq('s3-12',12,3,'I. Trắc nghiệm - Câu 12','Câu 12. Tìm số đo x trong hình vẽ, biết a // b:',['x = 30°','x = 120°','x = 60°','x = 180°'],2,'x = 60°','🔑 Hai góc so le trong bằng nhau nên x = 60°.',{ t: 'cat-tuyen', par: true, ten: ['a', 'b'],
        cat: [{ diem: ['A', 'B'], noi: ['tp', 'dt'], goc: { A: { dt: 'x' }, B: { tp: '60°' } } }] }),
      _srcWritten('s3-13',13,1,'II. Tự luận - Câu 13 (1,5 điểm)','Câu 13 (1,5 điểm). Thực hiện phép tính: a) −5/11 + 3/17 − 6/11 + 14/17 + 2025; b) 5/9·1/3 + 4/9·1/3; c) 1/2 + 3/2·4/3 + √4.','a) 2025; b) 1/3; c) 9/2.','🔑 a) Gom các phân số cùng mẫu được −1 + 1 + 2025 = <b>2025</b>.<br>🔑 b) 1/3·(5/9+4/9) = <b>1/3</b>.<br>🔑 c) 1/2 + 2 + 2 = <b>9/2</b>.'),
      _srcWritten('s3-14',14,1,'II. Tự luận - Câu 14 (1 điểm)','Câu 14 (1 điểm). Tìm x: a) x − 7/8 = 0,2; b) 1/2 − (x − 4/5) = 11/15.','a) x = 43/40; b) x = 17/30.','🔑 a) x = 1/5 + 7/8 = <b>43/40</b>.<br>🔑 b) x − 4/5 = 1/2 − 11/15 = −7/30, nên x = 4/5 − 7/30 = <b>17/30</b>.'),
      _srcWritten('s3-15',15,1,'II. Tự luận - Câu 15 (1,5 điểm)','Câu 15 (1,5 điểm). Số viên bi của Minh, Hùng, Dũng tỉ lệ với 2; 4; 5. Tính số viên bi của mỗi bạn, biết cả ba có 44 viên.','Minh 8 viên; Hùng 16 viên; Dũng 20 viên.','🔑 Tổng phần là 2+4+5=11; mỗi phần là 44/11=4. Vậy số bi lần lượt là <b>8, 16, 20</b>.'),
      _srcWritten('s3-16',16,6,'II. Tự luận - Câu 16 (1 điểm)','Câu 16 (1 điểm). Hộp bánh rán hình hộp chữ nhật dài 20 cm, rộng 12 cm, cao 8 cm. a) Tính diện tích xung quanh. b) Tính thể tích.','a) 512 cm²; b) 1920 cm³.','🔑 a) 2(20+12)·8 = <b>512 cm²</b>.<br>🔑 b) 20·12·8 = <b>1920 cm³</b>.'),
      _srcWritten('s3-17',17,3,'II. Tự luận - Câu 17 (2 điểm)','Câu 17 (2 điểm). Cho hình vẽ, trong đó a là đường thẳng đi qua A và C, b là đường thẳng đi qua B và D: a) Đường thẳng a có song song với b không? Vì sao? b) Cho ∠A₁ = 50°, tính ∠B₁, ∠B₂.','a) a // b. b) ∠B₁ = 50°, ∠B₂ = 130°.','🔑 a) Theo kí hiệu (hai cung tròn giống nhau) trên hình, ∠C₁ = ∠D₁. Đây là hai góc đồng vị tạo bởi cát tuyến CD cắt a và b, nên <b>a // b</b>.<br>🔑 b) ∠B₁ và ∠A₁ là hai góc đồng vị tạo bởi cát tuyến AB cắt hai đường thẳng song song a, b, nên ∠B₁ = ∠A₁ = <b>50°</b>.<br>🔑 ∠B₂ kề bù với ∠B₁ nên ∠B₂ = 180° − 50° = <b>130°</b>.',{ t: 'cat-tuyen', ten: ['a', 'b'],
        cat: [{ x: 0.28, diem: ['A', 'B'], noi: ['tt', { deg: 215, r: 28 }],
                goc: { A: { tp: { n: '1', so: '50°' } }, B: { tp: '1', tt: '2' } } },
              { a: 110, x: 0.78, diem: ['C', 'D'], noi: [{ deg: 250, r: 16 }, 'dp'],
                goc: { C: { tp: { n: '1', bang: 2 } }, D: { tp: { n: '1', bang: 2 } } } }] })
    ]
  },

  {
    id: 'hk1-source-4', title: 'HK1 4', school: 'THCS Tương Bình Hiệp - TP.HCM',
    sourceFile: 'de-cuoi-ky-1-toan-7-nam-2025-2026-truong-thcs-tuong-binh-hiep-tp-hcm.pdf',
    questions: [
      _srcMcq('s4-1',1,1,'I. Trắc nghiệm - Câu 1','Câu 1. Tập hợp các số hữu tỉ được kí hiệu là:',['N','Z','Q','R'],2,'Q','🔑 Tập số hữu tỉ kí hiệu là Q (ℚ).'),
      _srcMcq('s4-2',2,2,'I. Trắc nghiệm - Câu 2','Câu 2. Giá trị của √225 là:',['−15','15','225','−225'],1,'15','🔑 Căn bậc hai số học của một số không âm luôn KHÔNG ÂM, nên √225 = <b>15</b> (vì 15² = 225).<br>✗ −15 cũng có bình phương bằng 225, nhưng nó là số âm nên không phải căn bậc hai số học.'),
      _srcMcq('s4-3',3,2,'I. Trắc nghiệm - Câu 3','Câu 3. Giá trị tuyệt đối của 3/(−2) là:',['−3/2','3/2','2/(−3)','3/(−2)'],1,'3/2','🔑 |−3/2| = 3/2.'),
      _srcMcq('s4-4',4,1,'I. Trắc nghiệm - Câu 4','Câu 4. Chọn câu đúng. Nếu a·d = b·c và a,b,c,d ≠ 0 thì:',['a/b = c/d','d/a = b/c','a/b = d/c','a/c = d/b'],0,'a/b = c/d','🔑 a/b = c/d có tích chéo ad = bc.'),
      _srcMcq('s4-5',5,1,'I. Trắc nghiệm - Câu 5','Câu 5. Thứ tự thực hiện đúng trong biểu thức có dấu ngoặc là:',['{ } → ( ) → [ ]','{ } → [ ] → ( )','( ) → [ ] → { }','( ) → { } → [ ]'],2,'( ) → [ ] → { }','🔑 Thực hiện ngoặc tròn, rồi ngoặc vuông, rồi ngoặc nhọn.'),
      _srcMcq('s4-6',6,6,'I. Trắc nghiệm - Câu 6','Câu 6. Các cạnh bên của hình hộp chữ nhật ABCD.A′B′C′D′ là:',['AA′, BB′, CC′, DD′','AB, AA′, DD′, BC′','AC, BA, CC′, AD','A′C′, B′D′, AB, CD'],0,'AA′, BB′, CC′, DD′','🔑 Bốn cạnh nối hai đáy tương ứng là AA′, BB′, CC′, DD′.',{ t: 'hop-chu-nhat', v: [['A′', 'D′', 'C′', 'B′'], ['A', 'D', 'C', 'B']] }),
      _srcMcq('s4-7',7,6,'I. Trắc nghiệm - Câu 7','Câu 7. Mỗi mặt bên của hình lăng trụ đứng tam giác là:',['Tam giác','Hình thang cân','Hình vuông','Hình chữ nhật'],3,'Hình chữ nhật','🔑 Mặt bên của lăng trụ đứng là hình chữ nhật.'),
      _srcMcq('s4-8',8,3,'I. Trắc nghiệm - Câu 8','Câu 8. Quan sát hình vẽ. Góc kề bù với góc aOb là:',['∠bOc','∠bOd','∠dOc','∠aOc'],1,'∠bOd','🔑 Oa và Od là hai tia đối nhau, nên ∠aOb và ∠bOd kề bù.',{ t: 'ke-bu', a: 135, names: ['d', 'a', 'b'], r2: { deg: 72, name: 'c' } }),
      _srcMcq('s4-9',9,3,'I. Trắc nghiệm - Câu 9','Câu 9. Phát biểu đúng nhất của “Tiên đề Euclid” là:',['Qua một điểm ở ngoài một đường thẳng chỉ có một đường thẳng song song với đường thẳng đó','Qua một điểm ở ngoài một đường thẳng có vô số đường thẳng song song với đường thẳng đó','Qua một điểm ở ngoài một đường thẳng có ít nhất một đường thẳng song song với đường thẳng đó','Chỉ có một đường thẳng song song với đường thẳng cho trước'],0,'Qua một điểm ở ngoài một đường thẳng chỉ có một đường thẳng song song với đường thẳng đó','🔑 Đây là phát biểu đầy đủ của tiên đề Euclid.'),
      _srcMcq('s4-10',10,3,'I. Trắc nghiệm - Câu 10','Câu 10. Để Ot là tia phân giác của góc xOy thì:',['Tia Ot nằm trong góc xOy.','∠xOt = ∠yOt','Tia Ot nằm trong góc xOy và ∠xOt = ∠yOt','Tia Ot nằm giữa.'],2,'Tia Ot nằm trong góc xOy và ∠xOt = ∠yOt','🔑 Cần đồng thời điều kiện nằm trong góc và chia góc thành hai góc bằng nhau.'),
      _srcMcq('s4-11',11,3,'I. Trắc nghiệm - Câu 11','Câu 11. Giả thiết của định lí “Nếu hai đường thẳng phân biệt cùng vuông góc với một đường thẳng khác thì hai đường thẳng đó song song với nhau” là:',['hai đường thẳng đó song song với nhau','toàn bộ mệnh đề đã nêu','hai đường thẳng phân biệt cùng vuông góc','hai đường thẳng phân biệt cùng vuông góc với một đường thẳng khác'],3,'hai đường thẳng phân biệt cùng vuông góc với một đường thẳng khác','🔑 Giả thiết là phần đứng sau “Nếu” và trước “thì”.'),
      _srcMcq('s4-12',12,4,'I. Trắc nghiệm - Câu 12','Câu 12. Tổng ba góc của một tam giác bằng:',['90°','120°','180°','360°'],2,'180°','🔑 Tổng ba góc của một tam giác bằng 180°.'),
      _srcWritten('s4-13',13,2,'II. Tự luận - Câu 13 (1 điểm)','Câu 13 (1 điểm). a) Tìm x, biết |x| = 11/5. b) Tìm số đối của các số thực: −2/3; 1 2/3; 0; 1,25; −2025.','a) x = ±11/5. b) 2/3; −5/3 (tức −1 2/3); 0; −1,25; 2025.','🔑 a) <b>x = 11/5 hoặc x = −11/5</b>.<br>🔑 b) Đổi dấu từng số (riêng 0 đối của nó vẫn là 0).'),
      _srcWritten('s4-14',14,1,'II. Tự luận - Câu 14 (1 điểm)','Câu 14 (1 điểm). a) Lập tất cả các tỉ lệ thức từ 8·(−6) = 4·(−12). b) Tìm x, y biết x/3 = y/5 và x + y = −32.','a) 8/4 = −12/−6; 8/−12 = 4/−6; −12/8 = −6/4; 4/8 = −6/−12. b) x = −12, y = −20.','🔑 a) Viết 8·(−6) = 4·(−12) thành a·d = b·c với a = 8, d = −6, b = 4, c = −12. Đổi chỗ các số hạng theo bốn cách được: <b>8/4 = −12/−6</b>; <b>8/−12 = 4/−6</b>; <b>−12/8 = −6/4</b>; <b>4/8 = −6/−12</b>.<br>🔑 b) Theo tính chất dãy tỉ số bằng nhau: x/3 = y/5 = (x+y)/(3+5) = −32/8 = −4, nên <b>x = −12, y = −20</b>.'),
      _srcWritten('s4-15',15,1,'II. Tự luận - Câu 15 (2 điểm)','Câu 15 (2 điểm). a) Một công nhân làm 25 sản phẩm trong 40 phút. Cần bao nhiêu phút để làm 50 sản phẩm, năng suất không đổi? b) Bánh răng 120 răng quay 15 vòng/phút, khớp bánh thứ hai quay 9 vòng/phút. Bánh thứ hai có bao nhiêu răng?','a) 80 phút. b) 200 răng.','🔑 a) Tỉ lệ thuận: 40·50/25 = <b>80 phút</b>.<br>🔑 b) Tỉ lệ nghịch: 120·15/9 = <b>200 răng</b>.'),
      _srcWritten('s4-16',16,6,'II. Tự luận - Câu 16 (0,5 điểm)','Câu 16 (0,5 điểm). Khối bê tông là lăng trụ đứng tam giác có kích thước như hình. Tính thể tích.','1848 m³.','🔑 V = (1/2·7·24)·22 = <b>1848 m³</b>.',{ t: 'lang-tru-tam-giac', vuong: 'A', v: false, day: ['24 m', '', '7 m'], cao: '22 m' }),
      _srcWritten('s4-17',17,3,'II. Tự luận - Câu 17 (0,5 điểm)','Câu 17 (0,5 điểm). Cho hình vẽ, biết a // b và ∠B₁ = 130°. Tính ∠A₁ và ∠A₂.','∠A₁ = 130°, ∠A₂ = 50°.','🔑 Vì a // b nên ∠A₁ = ∠B₁ = <b>130°</b> (hai góc đồng vị).<br>🔑 ∠A₁ và ∠A₂ kề bù nên ∠A₂ = 180° − 130° = <b>50°</b>.',{ t: 'cat-tuyen', par: true, ten: ['a', 'b'], y: [28, 80],
        cat: [{ diem: ['A', 'B'], noi: [{ deg: 115, r: 22 }, 'tt'],
                goc: { A: { dt: '2', dp: '1' }, B: { dp: { n: '1', so: '130°' } } } }] }),
      _srcWritten('s4-18',18,3,'II. Tự luận - Câu 18 (1 điểm)','Câu 18 (1 điểm). a) Cho định lí: Nếu c cắt a, b và có một cặp góc so le trong bằng nhau thì a, b song song. Vẽ hình, viết giả thiết và kết luận bằng kí hiệu. b) Cho △ABC có ∠C = 35°, ∠A = 65°. Tính ∠B.','a) GT: c cắt a,b; một cặp góc so le trong bằng nhau. KL: a // b. b) ∠B = 80°.','🔑 a) Viết đúng GT và KL như trên.<br>🔑 b) ∠B = 180° − 65° − 35° = <b>80°</b>.',{ t: 'tam-giac', v: ['B', 'A', 'C'], angles: { B: '?', A: '65°', C: '35°' } }),
      _srcWritten('s4-19',19,1,'II. Tự luận - Câu 19 (1 điểm)','Câu 19 (1 điểm). Tìm x ∈ Q biết (−6/7)^(3x+4) = 36/49.','x = −2/3.','🔑 36/49 = (−6/7)² nên 3x + 4 = 2, suy ra <b>x = −2/3</b>.')
    ]
  },

  {
    id: 'hk1-source-5', title: 'HK1 5', school: 'THCS Lý Thánh Tông - TP.HCM',
    sourceFile: 'de-hoc-ki-1-toan-7-nam-2025-2026-truong-thcs-ly-thanh-tong-tp-hcm.pdf',
    questions: [
      _srcMcq('s5-1',1,1,'I. Trắc nghiệm - Câu 1','Câu 1. Chọn phát biểu đúng:',['√5 ∈ ℕ','5/8 ∈ ℚ','5/9 ∈ I','3,125 ∈ ℤ'],1,'5/8 ∈ ℚ','🔑 5/8 viết được dưới dạng a/b với a, b ∈ ℤ, b ≠ 0 nên <b>5/8 ∈ ℚ</b>.<br>✗ √5 là số vô tỉ nên không thuộc ℕ.<br>✗ 5/9 = 0,(5) là số thập phân vô hạn TUẦN HOÀN, nên nó là số hữu tỉ chứ không phải số vô tỉ.<br>✗ 3,125 không phải số nguyên.'),
      _srcMcq('s5-2',2,1,'I. Trắc nghiệm - Câu 2','Câu 2. Kết quả (1/3)⁷ : (1/3)⁴ được viết dưới dạng lũy thừa là:',['(1/3)¹¹','(1/3)²⁸','(1/3)³','(1/3)²'],2,'(1/3)³','🔑 Chia hai lũy thừa cùng cơ số: 7−4=3.'),
      _srcMcq('s5-3',3,2,'I. Trắc nghiệm - Câu 3','Câu 3. √81 bằng:',['9','18','81','9²'],0,'9','🔑 √81 = 9.'),
      _srcMcq('s5-4',4,2,'I. Trắc nghiệm - Câu 4','Câu 4. Cho |x| = 9 thì x là:',['x = 3','x = −9','x = 3 hoặc x = −3','x = 9 hoặc x = −9'],3,'x = 9 hoặc x = −9','🔑 |x|=9 có hai nghiệm x=±9.'),
      _srcMcq('s5-5',5,2,'I. Trắc nghiệm - Câu 5','Câu 5. Làm tròn 19,257 đến hàng phần trăm được:',['19,26','19,25','19','19,258'],0,'19,26','🔑 Chữ số hàng phần nghìn là 7 nên làm tròn lên 19,26.'),
      _srcMcq('s5-6',6,6,'I. Trắc nghiệm - Câu 6','Câu 6. Hình nào sau đây là hình hộp chữ nhật?',['Hình 1','Hình 2','Hình 3','Hình 4'],3,'Hình 4','🔑 Hình 4 là hình hộp chữ nhật.',{ t: 'chon-khoi', cap: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], khoi: ['trai-tim', 'bat', 'nem', 'hop'] }),
      _srcMcq('s5-7',7,3,'I. Trắc nghiệm - Câu 7','Câu 7. Hình nào dưới đây có cặp góc đối đỉnh?',['Hình a','Hình b','Hình c','Hình d'],2,'Hình c','🔑 Hình c có hai đường thẳng cắt nhau, tạo cặp góc đối đỉnh.',{ t: 'bon-goc', cap: ['Hình a (đỉnh M)', 'Hình b (đỉnh N)', 'Hình c (đỉnh O)', 'Hình d (P và Q)'],
        hinh: [{ dinh: [{ tia: [0, 55, 180, 270], nhan: ['2', '1', '4', '3'] }] },
               { dinh: [{ tia: [0, 180, 215, 325], nhan: ['', '5', '', '6'] }] },
               { dinh: [{ tia: [20, 110, 200, 290], nhan: ['7', '10', '9', '8'] }] },
               { dinh: [{ tia: [186, 226], nhan: ['1', ''], at: [-20, 8] },
                        { tia: [14, 54], nhan: ['2', ''], at: [20, -8] }] }] }),
      _srcMcq('s5-8',8,5,'I. Trắc nghiệm - Câu 8','Câu 8. Điểm kiểm tra học kì I môn Toán của 5 bạn Minh, Mai, Hưng, Lan, Nhung được ghi lại trong bảng. Kết quả của ai bị ghi nhầm?',['Minh','Lan','Hưng','Nhung'],1,'Lan','🔑 Điểm kiểm tra theo thang 10 nên 10,5 là không hợp lệ; đó là điểm của Lan.',{ t: 'bang', cot: ['Học sinh', 'Điểm'], hang: [['Minh', '8'], ['Mai', '8,5'], ['Hưng', '7,5'], ['Lan', '10,5'], ['Nhung', '9']] }),
      _srcWritten('s5-9',9,1,'II. Tự luận - Câu 1 (1,5 điểm)','Câu 1 (1,5 điểm). Tính: a) −8/15·1/7 + −8/15·2/7 + −8/15·4/7; b) (−4/3)² + √49 − |−2/3|.','a) −8/15; b) 73/9.','🔑 a) −8/15·(1/7+2/7+4/7) = <b>−8/15</b>.<br>🔑 b) 16/9 + 7 − 2/3 = <b>73/9</b>.'),
      _srcWritten('s5-10',10,1,'II. Tự luận - Câu 2 (1,5 điểm)','Câu 2 (1,5 điểm). Tìm x: a) 2x − 1/3 = 1/2; b) 5^(x+4) − 3·5^(x+3) = 2·5¹¹.','a) x = 5/12; b) x = 8.','🔑 a) 2x = 5/6 nên <b>x=5/12</b>.<br>🔑 b) 2·5^(x+3)=2·5¹¹ nên x+3=11, <b>x=8</b>.'),
      _srcWritten('s5-11',11,5,'II. Tự luận - Câu 3 (1 điểm)','Câu 3 (1 điểm). Bảng dữ liệu cho biết khả năng tự nấu ăn của tất cả học sinh lớp 7A. a) Phân loại dữ liệu trong bảng theo tiêu chí định tính và định lượng. b) Lớp 7A có bao nhiêu học sinh? Tính tỉ lệ phần trăm của loại “Giỏi” so với cả lớp.','a) Khả năng tự nấu ăn là định tính; số bạn là định lượng. b) 40 học sinh; 15%.','🔑 a) Các mức xếp loại là dữ liệu định tính; số học sinh là dữ liệu định lượng.<br>🔑 b) Tổng 15+15+6+4=<b>40</b>; tỉ lệ Giỏi là 6/40·100%=<b>15%</b>.',{ t: 'bang', cot: ['Khả năng tự nấu ăn', 'Số bạn tự đánh giá'], hang: [['Không đạt', '15'], ['Đạt', '15'], ['Giỏi', '6'], ['Xuất sắc', '4']] }),
      _srcWritten('s5-12',12,1,'II. Tự luận - Câu 4 (1 điểm)','Câu 4 (1 điểm). Cửa hàng giảm 20%, khách thân thiết giảm thêm 15% trên giá đã giảm. a) Váy niêm yết 1 200 000 đồng, chị Lan phải trả bao nhiêu? b) Chị trả tổng 1 496 000 đồng cho váy và giày. Giá niêm yết đôi giày là bao nhiêu?','a) 816 000 đồng. b) 1 000 000 đồng.','🔑 Hệ số sau hai lần giảm là 0,8·0,85=0,68.<br>🔑 a) 1 200 000·0,68=<b>816 000 đồng</b>.<br>🔑 b) Tiền giày đã giảm là 680 000; giá niêm yết 680 000/0,68=<b>1 000 000 đồng</b>.'),
      _srcWritten('s5-13',13,6,'II. Tự luận - Câu 5 (1 điểm)','Câu 5 (1 điểm). Thùng thép không nắp dạng lăng trụ đứng tam giác, dài 75 cm; tam giác đáy có ba cạnh 60 cm, 80 cm, 100 cm. a) Tính thể tích. b) Tính diện tích thép cần dùng theo m².','a) 180 000 cm³. b) 1,53 m².','🔑 Tam giác 60-80-100 vuông, diện tích đáy = 60·80/2=2400 cm².<br>🔑 a) V=2400·75=<b>180 000 cm³</b>.<br>🔑 b) Diện tích kín là 2·2400+(60+80+100)·75=22800 cm². Mặt hở (theo hình) là mặt nghiêng 100 cm × 75 cm = 7500 cm², nên diện tích thép là 22800 − 7500 = 15300 cm² = <b>1,53 m²</b>.',{ t: 'lang-tru-tam-giac', vuong: 'A', v: false, ho: 1, day: ['80 cm', '100 cm', '60 cm'], cao: '75 cm' }),
      _srcWritten('s5-14',14,3,'II. Tự luận - Câu 6 (2 điểm)','Câu 6 (2 điểm). Cho hình vẽ biết ∠G₁ = 80°, ∠F₁ = 80°, ∠B₁ = 60°. a) Chứng minh m // n. b) Tính ∠D₁, ∠D₃. c) Dx là tia phân giác của ∠BDH, cắt m tại E. Tính ∠BED.','a) m // n. b) ∠D₁ = 60°, ∠D₃ = 120°. c) ∠BED = 60°.','🔑 a) ∠G₁ = ∠F₁ = 80° là hai góc đồng vị nên <b>m // n</b>.<br>🔑 b) ∠D₁ và ∠B₁ là hai góc đồng vị (cùng ở phía trên đường thẳng của mình và cùng bên trái cát tuyến BD) nên ∠D₁ = ∠B₁ = <b>60°</b>.<br>🔑 Góc 3 nằm phía dưới n, cùng bên trái cát tuyến, nên ∠D₃ KỀ BÙ với ∠D₁: ∠D₃ = 180° − 60° = <b>120°</b>. (Góc đối đỉnh với ∠D₁ là ∠D₂, đề không hỏi.)<br>🔑 c) ∠BDH = 180° − ∠D₁ = 120°; Dx là tia phân giác nên ∠BDE = 60°. Lại có ∠DBE = ∠B₁ = 60° (đối đỉnh), nên trong △BDE: <b>∠BED = 180° − 60° − 60° = 60°</b>.',{ t: 'cat-tuyen', y: [30, 84], dau: [['m', null], ['n', null]],
        cat: [{ x: 0.24, diem: ['G', 'F'], noi: [{ deg: 310, r: 14 }, { deg: 40, r: 14 }],
                goc: { G: { dt: { n: '1', so: '80°' } }, F: { dt: { n: '1', so: '80°' } } } },
              { x: 0.62, diem: ['B', 'D'], noi: ['tp', { deg: 30, r: 20 }],
                goc: { B: { tt: { n: '1', so: '60°' } },
                       D: { tt: { n: '1', r: 18 }, dt: { n: '3', r: 18 }, dp: { n: '2', r: 20 } } } }],
        tia: [{ tu: 'D', huong: 60, toi: 0, qua: 14, dat: 'E', at: [8, 12], ten: 'x', tenAt: [6, -4] }],
        them: [{ duong: 1, x: 178, ten: 'H', at: [0, 14] }] })
    ]
  }
];

// Final-result boxes for the written section. The child still writes the full
// calculation/proof on the whiteboard; these short, ordered fields let the app
// check every requested result without pretending it can judge handwriting.
const MATH_SOURCE_ANSWER_PARTS = {
  's1-13': [['a', '8'], ['b', '1']],
  's1-14': [['a · √49', '7'], ['a · √0,25', '0,5', ['0.5']], ['b · Cạnh hình vuông (m)', '31,6', ['31.6']]],
  's1-15': [['∠xAB (độ)', '55']],
  's1-16': [['5 phút (bạn)', '2'], ['7 phút (bạn)', '6'], ['9 phút (bạn)', '8'], ['11 phút (bạn)', '10'], ['Được thưởng (bạn)', '2']],
  's1-17': [['Kết quả', '221/36']],
  's1-18': [['a · Trường hợp bằng nhau (cạnh – góc – cạnh, viết tắt c-g-c)', 'c-g-c'], ['b · Kết luận', 'AD//BC']],
  's1-19': [['x (cm)', '12,2', ['12.2']]],

  's2-9': [['a', '41/30'], ['b', '1/4'], ['c', '4']],
  's2-10': [['a · x', '−8/5'], ['b · x', '2/5'], ['c · Nghiệm âm', '−41/72'], ['c · Nghiệm dương', '121/72']],
  's2-11': [['a · Diện tích xung quanh (cm²)', '360'], ['a · Thể tích (cm³)', '525'], ['b · Diện tích kính (cm²)', '3191']],
  's2-12': [['a · Kết luận', 'AD//BC'], ['b · ∠D₂ (độ)', '72'], ['b · ∠C₃ (độ)', '72'], ['c · ∠xCz (độ)', '54']],
  's2-13': [['a · Số tiền trả (triệu đồng)', '28'], ['b · Mức giảm (%)', '20']],

  's3-13': [['a', '2025'], ['b', '1/3'], ['c', '9/2', ['4,5']]],
  's3-14': [['a · x', '43/40', ['1,075']], ['b · x', '17/30']],
  's3-15': [['Minh (viên)', '8'], ['Hùng (viên)', '16'], ['Dũng (viên)', '20']],
  's3-16': [['a · Diện tích xung quanh (cm²)', '512'], ['b · Thể tích (cm³)', '1920']],
  's3-17': [['a · Kết luận', 'a//b'], ['b · ∠B₁ (độ)', '50'], ['b · ∠B₂ (độ)', '130']],

  's4-13': [['a · Nghiệm dương', '11/5'], ['a · Nghiệm âm', '−11/5'], ['b · Số đối của −2/3', '2/3'], ['b · Số đối của 1 2/3 (viết dạng phân số)', '−5/3'], ['b · Số đối của 0', '0'], ['b · Số đối của 1,25', '−1,25', ['-1.25']], ['b · Số đối của −2025', '2025']],
  's4-14': [['a · Bắt đầu bằng 8/4', '8/4=−12/−6', ['8/4=(−12)/(−6)', '−12/−6=8/4']], ['a · Bắt đầu bằng 8/−12', '8/−12=4/−6', ['8/(−12)=4/(−6)', '4/−6=8/−12']], ['a · Bắt đầu bằng −12/8', '−12/8=−6/4', ['(−12)/8=(−6)/4', '−6/4=−12/8']], ['a · Bắt đầu bằng 4/8', '4/8=−6/−12', ['4/8=(−6)/(−12)', '−6/−12=4/8']], ['b · x', '−12'], ['b · y', '−20']],
  's4-15': [['a · Thời gian (phút)', '80'], ['b · Số răng', '200']],
  's4-16': [['Thể tích (m³)', '1848']],
  's4-17': [['∠A₁ (độ)', '130'], ['∠A₂ (độ)', '50']],
  's4-18': [['a · Kết luận', 'a//b'], ['b · ∠B (độ)', '80']],
  's4-19': [['x', '−2/3']],

  's5-9': [['a', '−8/15'], ['b', '73/9']],
  's5-10': [['a · x', '5/12'], ['b · x', '8']],
  's5-11': [['a · Loại dữ liệu (xếp loại; số bạn)', 'định tính;định lượng'], ['b · Số học sinh', '40'], ['b · Tỉ lệ Giỏi (%)', '15']],
  's5-12': [['a · Số tiền trả (đồng)', '816000'], ['b · Giá niêm yết giày (đồng)', '1000000']],
  's5-13': [['a · Thể tích (cm³)', '180000'], ['b · Diện tích thép (m²)', '1,53', ['1.53']]],
  's5-14': [['a · Kết luận', 'm//n'], ['b · ∠D₁ (độ)', '60'], ['b · ∠D₃ (độ)', '120'], ['c · ∠BED (độ)', '60']]
};

const MATH_SOURCE_SYMBOL_KEYS = {
  's1-18': ['c-g-c', 'AD', '//', 'BC'],
  's2-12': ['AD', '//', 'BC'],
  's3-17': ['a', '//', 'b'],
  's4-14': ['='],
  's4-18': ['a', '//', 'b'],
  's5-11': ['định tính', ';', 'định lượng'],
  's5-14': ['m', '//', 'n']
};

for (const exam of MATH_SOURCE_EXAMS) {
  for (const q of exam.questions) {
    const parts = MATH_SOURCE_ANSWER_PARTS[q.id];
    if (!parts) continue;
    q.answerParts = parts.map(part => ({ label: part[0], answer: part[1], accept: part[2] || [] }));
    q.keys = MATH_SOURCE_SYMBOL_KEYS[q.id] || [];
    q.workNote = /chứng minh|vẽ hình|lập bảng|phân loại/i.test(q.q)
      ? 'Làm đầy đủ phần trình bày trên bảng nháp, rồi nhập các kết quả hoặc kết luận cuối cùng theo thứ tự bên dưới.'
      : 'Làm bài trên bảng nháp, rồi nhập từng kết quả cuối cùng theo thứ tự bên dưới.';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MATH_SOURCE_EXAMS };
}
