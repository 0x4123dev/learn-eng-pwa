// math-glossary.js — định nghĩa các khái niệm của Chương 3 và Chương 4,
// hiện dưới mỗi câu hỏi dưới dạng gợi ý bấm-để-mở.
//
// Chương 3 và 4 là hai chương DÀY THUẬT NGỮ nhất của Toán 7 tập 1: một câu
// hỏi về tia phân giác của góc bẹt cần bé nhớ CẢ HAI định nghĩa trước khi
// tính được gì. Bé quên một chữ là mất luôn câu hỏi, dù phép tính chỉ là
// 180 : 2. Gợi ý trả lại định nghĩa ngay tại chỗ, thay vì bắt bé rời bài
// làm đi tìm trong tab Lý thuyết.
//
// MATH_GLOSSARY[i] = { ch, t: tên khái niệm, m: [chuỗi để dò], d: định nghĩa }
// Ghép với câu hỏi theo `topic` và theo thuật ngữ xuất hiện trong đề bài —
// KHÔNG gắn tay từng câu, để một câu được viết lại vẫn tự khớp đúng.

const MATH_GLOSSARY = [
  {"ch":3,"t":"Góc bẹt","m":["góc bẹt"],"d":"Góc có số đo <b>180°</b>. Hai cạnh của nó là hai tia đối nhau nên nằm thẳng hàng."},
  {"ch":3,"t":"Tia phân giác","m":["tia phân giác"],"d":"Tia nằm giữa hai cạnh của một góc và chia góc đó thành <b>hai góc bằng nhau</b>. Mỗi góc con bằng một nửa góc ban đầu."},
  {"ch":3,"t":"Góc nhọn · góc vuông · góc tù","m":["góc nhọn","góc tù"],"d":"Góc nhọn: nhỏ hơn 90°. Góc vuông: đúng <b>90°</b>. Góc tù: lớn hơn 90° và nhỏ hơn 180°."},
  {"ch":3,"t":"Hai góc kề bù","m":["kề bù"],"d":"Hai góc <b>chung một cạnh</b> và hai cạnh còn lại là hai tia đối nhau. Tổng hai góc kề bù luôn bằng <b>180°</b>."},
  {"ch":3,"t":"Hai góc đối đỉnh","m":["đối đỉnh"],"d":"Hai góc mà mỗi cạnh của góc này là tia đối của một cạnh góc kia. Hai góc đối đỉnh thì <b>bằng nhau</b>."},
  {"ch":3,"t":"Hai đường thẳng cắt nhau","m":["cắt nhau"],"d":"Hai đường thẳng có <b>đúng một điểm chung</b>. Bốn góc tạo thành có tổng bằng <b>360°</b>, từng cặp đối đỉnh bằng nhau."},
  {"ch":3,"t":"Hai góc so le trong","m":["so le trong"],"d":"Một đường thẳng cắt hai đường thẳng khác. Cặp góc <b>nằm trong</b> hai đường thẳng đó và ở <b>hai phía</b> của đường cắt là hai góc so le trong."},
  {"ch":3,"t":"Hai góc đồng vị","m":["đồng vị"],"d":"Cặp góc ở <b>cùng một phía</b> của đường cắt và ở <b>cùng vị trí</b> so với mỗi đường thẳng (cùng trên, hoặc cùng dưới)."},
  {"ch":3,"t":"Hai góc trong cùng phía","m":["trong cùng phía"],"d":"Cặp góc nằm trong hai đường thẳng và ở <b>cùng một phía</b> của đường cắt. Khi hai đường thẳng song song, tổng của chúng bằng <b>180°</b>."},
  {"ch":3,"t":"Hai đường thẳng song song (a ∥ b)","m":["song song","a ∥ b","∥"],"d":"Hai đường thẳng <b>không có điểm chung</b> nào, dù kéo dài mãi."},
  {"ch":3,"t":"Hai đường thẳng vuông góc (a ⊥ b)","m":["vuông góc","a ⊥ b","⊥"],"d":"Hai đường thẳng cắt nhau tạo thành <b>bốn góc vuông</b> (mỗi góc 90°)."},
  {"ch":3,"t":"Dấu hiệu nhận biết hai đường thẳng song song","m":["dấu hiệu nhận biết"],"d":"Đi từ góc <b>suy ra</b> song song: nếu đường cắt tạo được một cặp góc <b>so le trong bằng nhau</b> (hoặc đồng vị bằng nhau, hoặc trong cùng phía bù nhau) thì hai đường thẳng song song."},
  {"ch":3,"t":"Tính chất hai đường thẳng song song","m":["tính chất hai đường thẳng song song"],"d":"Chiều ngược lại: <b>đã biết</b> a ∥ b thì các góc so le trong bằng nhau, các góc đồng vị bằng nhau, hai góc trong cùng phía bù nhau."},
  {"ch":3,"t":"Tiên đề Euclid","m":["tiên đề euclid","euclid"],"d":"Qua một điểm ở ngoài một đường thẳng, chỉ vẽ được <b>đúng một</b> đường thẳng song song với đường thẳng đó."},
  {"ch":3,"t":"Quan hệ vuông góc — song song","m":["quan hệ vuông góc"],"d":"Cùng vuông góc với một đường thì song song: a ⊥ c và b ⊥ c ⇒ <b>a ∥ b</b>. Vuông góc với một trong hai đường song song thì vuông góc với đường kia: a ∥ b và c ⊥ a ⇒ <b>c ⊥ b</b>."},
  {"ch":3,"t":"Định lí · giả thiết · kết luận","m":["định lí","giả thiết","kết luận","mệnh đề"],"d":"Định lí thường viết dạng “<b>Nếu …</b> thì …”. Phần sau chữ “Nếu” là <b>giả thiết</b> (điều đã cho), phần sau chữ “thì” là <b>kết luận</b> (điều phải suy ra)."},
  {"ch":4,"t":"Tổng ba góc trong một tam giác","m":["tổng ba góc","tổng ba góc trong"],"d":"Ba góc trong của một tam giác luôn cộng lại bằng <b>180°</b>."},
  {"ch":4,"t":"Góc ngoài của tam giác","m":["góc ngoài"],"d":"Góc <b>kề bù</b> với một góc trong của tam giác. Mỗi góc ngoài bằng <b>tổng hai góc trong không kề</b> với nó."},
  {"ch":4,"t":"Tam giác vuông","m":["tam giác vuông","vuông tại"],"d":"Tam giác có <b>một góc 90°</b>. Hai góc nhọn còn lại <b>phụ nhau</b> — cộng lại bằng 90°."},
  {"ch":4,"t":"Cạnh huyền · cạnh góc vuông","m":["cạnh huyền","cạnh góc vuông"],"d":"Trong tam giác vuông: hai cạnh tạo nên góc vuông gọi là <b>cạnh góc vuông</b>; cạnh còn lại, đối diện góc vuông, là <b>cạnh huyền</b> và luôn dài nhất."},
  {"ch":4,"t":"Tam giác cân","m":["tam giác cân"],"d":"Tam giác có <b>hai cạnh bằng nhau</b> (hai cạnh bên). Hai <b>góc ở đáy bằng nhau</b>, và ngược lại — hai góc bằng nhau thì tam giác cân."},
  {"ch":4,"t":"Tam giác đều","m":["tam giác đều"],"d":"Tam giác có <b>ba cạnh bằng nhau</b>. Khi đó ba góc cũng bằng nhau và mỗi góc bằng <b>60°</b>."},
  {"ch":4,"t":"Hai tam giác bằng nhau","m":["tam giác bằng nhau","hai tam giác bằng nhau","kí hiệu tam giác"],"d":"Hai tam giác có các <b>cạnh tương ứng</b> và các <b>góc tương ứng</b> bằng nhau. Viết △ABC = △DEF thì phải đúng thứ tự đỉnh: A↔D, B↔E, C↔F."},
  {"ch":4,"t":"Trường hợp cạnh – cạnh – cạnh (c-c-c)","m":["c-c-c","cạnh – cạnh – cạnh","trường hợp c-c-c"],"d":"<b>Ba cạnh</b> của tam giác này bằng ba cạnh của tam giác kia thì hai tam giác bằng nhau."},
  {"ch":4,"t":"Trường hợp cạnh – góc – cạnh (c-g-c)","m":["c-g-c","cạnh – góc – cạnh","trường hợp c-g-c","xen giữa"],"d":"<b>Hai cạnh</b> và góc <b>xen giữa hai cạnh đó</b> bằng nhau. Góc phải nằm GIỮA hai cạnh đã cho, không phải góc bất kì."},
  {"ch":4,"t":"Trường hợp góc – cạnh – góc (g-c-g)","m":["g-c-g","góc – cạnh – góc","trường hợp g-c-g"],"d":"<b>Một cạnh</b> và <b>hai góc kề</b> cạnh đó bằng nhau. Cạnh phải nằm GIỮA hai góc đã cho."},
  {"ch":4,"t":"Vì sao không có trường hợp g-g-g","m":["g-g-g","không hợp lệ","không phải là trường hợp"],"d":"Ba góc bằng nhau chỉ cho hai tam giác <b>cùng hình dạng</b>, không cùng kích thước — phóng to một tam giác thì ba góc vẫn y nguyên. Nên góc – góc – góc <b>không</b> là trường hợp bằng nhau."},
  {"ch":4,"t":"Tam giác vuông bằng nhau","m":["tam giác vuông bằng nhau"],"d":"Vì đã có sẵn một góc 90° bằng nhau nên chỉ cần thêm hai yếu tố: hai cạnh góc vuông; cạnh góc vuông – góc nhọn kề; <b>cạnh huyền – góc nhọn</b>; hoặc <b>cạnh huyền – cạnh góc vuông</b>."},
  {"ch":4,"t":"Trung điểm","m":["trung điểm"],"d":"Điểm nằm <b>giữa</b> hai đầu một đoạn thẳng và <b>cách đều</b> hai đầu đó."},
  {"ch":4,"t":"Đường trung trực của đoạn thẳng","m":["đường trung trực","trung trực"],"d":"Đường thẳng <b>vuông góc</b> với đoạn thẳng tại <b>trung điểm</b> của nó. Mọi điểm nằm trên đường trung trực đều <b>cách đều hai đầu</b> đoạn thẳng."}
];

if (typeof module !== 'undefined' && module.exports) { module.exports = { MATH_GLOSSARY }; }
