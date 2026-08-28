// units-posthk-data.js — Post-HK word bank for the Topics → Grade 4 tab.
//
// Source: the end-of-book glossaries of the two English-medium subject books
// the class uses after the semester exam:
//
//   • "Global Maths 4"   — Glossary, pages 76-79 (A → whole number)
//   • "Global Science 4" — Glossary, pages 74-79 (amount → wooden)
//
// Both glossaries in full, less one word: 75 maths terms and 122 science terms,
// 197 in all. "dong" is dropped — the currency is not vocabulary worth a card.
// The English and the Vietnamese are the book's own, except "soft": the book
// glosses it "(âm thanh) nhỏ" because it teaches the word in the loud/soft pair
// of the sound unit, and the everyday sense is the one worth carrying. The
// glossary's
// third column (IPA) and fourth (which book unit teaches the word) are not
// carried, because nothing in the tab renders them — a word card shows the
// word, its meaning and a picture, and the pronunciation comes from the
// recording rather than from a transcription a child cannot read yet.
//
// The five practice units are grouped by SUBJECT AND TOPIC rather than by the
// glossary's alphabet. "acute angle" and "average" sit next to each other in a
// glossary and nowhere else: one is a shape, the other is arithmetic, and a
// child meeting them in the same breath learns neither. Maths splits in two
// (numbers/operations, then fractions/shapes/measures) and science in three
// (matter and energy, living things, then food and health).

const UNIT_WORDS_POSTHK = [
  // ── Unit 1 · Maths: numbers, money and the four operations ──────────────
  { unit: 1, book: 1, en: 'add', vi: 'thêm vào', emoji: '➕' },
  { unit: 1, book: 1, en: 'average', vi: 'trung bình cộng', emoji: '📊' },
  { unit: 1, book: 1, en: 'cost', vi: 'giá', emoji: '🏷️' },
  { unit: 1, book: 1, en: 'difference', vi: 'hiệu', emoji: '➖' },
  { unit: 1, book: 1, en: 'divide', vi: 'chia', emoji: '➗' },
  { unit: 1, book: 1, en: 'divided', vi: 'được chia cho', emoji: '➗' },
  { unit: 1, book: 1, en: 'dividend', vi: 'số bị chia', emoji: '🔢' },
  { unit: 1, book: 1, en: 'division', vi: 'phép chia', emoji: '➗' },
  { unit: 1, book: 1, en: 'divisor', vi: 'số chia', emoji: '🔢' },
  { unit: 1, book: 1, en: 'equal', vi: 'bằng', emoji: '🟰' },
  { unit: 1, book: 1, en: 'even', vi: 'chẵn', emoji: '2️⃣' },
  { unit: 1, book: 1, en: 'greater (than)', vi: 'lớn hơn', emoji: '⬆️' },
  { unit: 1, book: 1, en: 'hidden pair', vi: 'cặp số chưa biết', emoji: '🕵️' },
  { unit: 1, book: 1, en: 'how much', vi: '(giá) bao nhiêu', emoji: '❓' },
  { unit: 1, book: 1, en: 'hundred thousands', vi: 'hàng trăm nghìn', emoji: '💯' },
  { unit: 1, book: 1, en: 'last digit', vi: 'chữ số cuối', emoji: '🔚' },
  { unit: 1, book: 1, en: '(the) least', vi: 'ít nhất', emoji: '🥉' },
  { unit: 1, book: 1, en: 'less (than)', vi: 'ít hơn', emoji: '⬇️' },
  { unit: 1, book: 1, en: 'million', vi: 'triệu', emoji: '🔢' },
  { unit: 1, book: 1, en: 'money', vi: 'tiền', emoji: '💰' },
  { unit: 1, book: 1, en: 'more (than)', vi: 'nhiều hơn', emoji: '⬆️' },
  { unit: 1, book: 1, en: '(the) most', vi: 'nhiều nhất', emoji: '🥇' },
  { unit: 1, book: 1, en: 'multiplied', vi: 'được nhân với', emoji: '✖️' },
  { unit: 1, book: 1, en: 'multiply', vi: 'nhân', emoji: '✖️' },
  { unit: 1, book: 1, en: 'nearest', vi: 'gần nhất', emoji: '📍' },
  { unit: 1, book: 1, en: 'odd', vi: 'lẻ', emoji: '1️⃣' },
  { unit: 1, book: 1, en: 'quotient', vi: 'thương số', emoji: '➗' },
  { unit: 1, book: 1, en: 'remainder', vi: 'số dư', emoji: '🔸' },
  { unit: 1, book: 1, en: 'remove', vi: 'bỏ đi', emoji: '🗑️' },
  { unit: 1, book: 1, en: 'round', vi: 'làm tròn', emoji: '⭕' },
  { unit: 1, book: 1, en: 'rounded', vi: 'được làm tròn', emoji: '⭕' },
  { unit: 1, book: 1, en: 'six-digit number', vi: 'số có sáu chữ số', emoji: '🔢' },
  { unit: 1, book: 1, en: 'smaller (than)', vi: 'nhỏ hơn', emoji: '⬇️' },
  { unit: 1, book: 1, en: 'sum', vi: 'tổng cộng', emoji: '🧮' },
  { unit: 1, book: 1, en: 'value', vi: 'giá trị', emoji: '💎' },
  { unit: 1, book: 1, en: 'whole number', vi: 'số tự nhiên', emoji: '🔟' },

  // ── Unit 2 · Maths: fractions, shapes and measuring ─────────────────────
  { unit: 2, book: 2, en: 'acute angle', vi: 'góc nhọn', emoji: '📐' },
  { unit: 2, book: 2, en: 'addition of fractions', vi: 'phép cộng phân số', emoji: '➕' },
  { unit: 2, book: 2, en: 'angle', vi: 'góc', emoji: '📐' },
  { unit: 2, book: 2, en: 'area', vi: 'diện tích', emoji: '🟦' },
  { unit: 2, book: 2, en: 'bar chart', vi: 'biểu đồ cột', emoji: '📊' },
  { unit: 2, book: 2, en: 'century', vi: 'thế kỉ', emoji: '📆' },
  { unit: 2, book: 2, en: 'closed bracket', vi: 'dấu đóng ngoặc', emoji: '🔣' },
  { unit: 2, book: 2, en: 'degree', vi: 'độ', emoji: '📐' },
  { unit: 2, book: 2, en: 'denominator', vi: 'mẫu số', emoji: '🔽' },
  { unit: 2, book: 2, en: 'division of fractions', vi: 'phép chia phân số', emoji: '➗' },
  { unit: 2, book: 2, en: 'equivalent fractions', vi: 'phân số bằng nhau', emoji: '🟰' },
  { unit: 2, book: 2, en: 'expand', vi: 'mở rộng (phân số)', emoji: '↔️' },
  { unit: 2, book: 2, en: 'favourite', vi: 'yêu thích', emoji: '❤️' },
  { unit: 2, book: 2, en: 'fraction', vi: 'phân số', emoji: '🍕' },
  { unit: 2, book: 2, en: 'fraction comparison', vi: 'so sánh phân số', emoji: '⚖️' },
  { unit: 2, book: 2, en: 'fraction of a number', vi: 'phân số của một số', emoji: '🍰' },
  { unit: 2, book: 2, en: 'numerator', vi: 'tử số', emoji: '🔼' },
  { unit: 2, book: 2, en: 'numerical data', vi: 'số liệu', emoji: '📋' },
  { unit: 2, book: 2, en: 'obtuse angle', vi: 'góc tù', emoji: '📐' },
  { unit: 2, book: 2, en: 'open bracket', vi: 'dấu mở ngoặc', emoji: '🔣' },
  { unit: 2, book: 2, en: 'opposite sides', vi: 'các cạnh đối diện', emoji: '▭' },
  { unit: 2, book: 2, en: 'parallel lines', vi: 'đường thẳng song song', emoji: '🛤️' },
  { unit: 2, book: 2, en: 'parallelogram', vi: 'hình bình hành', emoji: '▱' },
  { unit: 2, book: 2, en: 'perpendicular lines', vi: 'đường thẳng vuông góc', emoji: '✚' },
  { unit: 2, book: 2, en: 'protractor', vi: 'thước đo góc', emoji: '📐' },
  { unit: 2, book: 2, en: 'quintal', vi: 'tạ', emoji: '⚖️' },
  { unit: 2, book: 2, en: 'reduce', vi: 'rút gọn (phân số)', emoji: '✂️' },
  { unit: 2, book: 2, en: 'right angle', vi: 'góc vuông', emoji: '📐' },
  { unit: 2, book: 2, en: 'second', vi: 'giây', emoji: '⏱️' },
  { unit: 2, book: 2, en: 'set square', vi: 'ê ke', emoji: '📐' },
  { unit: 2, book: 2, en: 'size', vi: 'kích thước, độ lớn', emoji: '📏' },
  { unit: 2, book: 2, en: 'square centimetre', vi: 'xăng-ti-mét vuông', emoji: '🟨' },
  { unit: 2, book: 2, en: 'square decimetre', vi: 'đề-xi-mét vuông', emoji: '🟧' },
  { unit: 2, book: 2, en: 'square metre', vi: 'mét vuông', emoji: '🟥' },
  { unit: 2, book: 2, en: 'square millimetre', vi: 'mi-li-mét vuông', emoji: '🟩' },
  { unit: 2, book: 2, en: 'straight angle', vi: 'góc bẹt', emoji: '📏' },
  { unit: 2, book: 2, en: 'subtraction of fractions', vi: 'phép trừ phân số', emoji: '➖' },
  { unit: 2, book: 2, en: 'three-fourths', vi: 'ba phần tư', emoji: '🕐' },
  { unit: 2, book: 2, en: 'ton', vi: 'tấn', emoji: '🚛' },

  // ── Unit 3 · Science: matter, energy, light and sound ───────────────────
  { unit: 3, book: 3, en: 'be made of', vi: 'được làm bằng', emoji: '🧱' },
  { unit: 3, book: 3, en: 'bell', vi: 'chuông', emoji: '🔔' },
  { unit: 3, book: 3, en: 'block', vi: 'chắn', emoji: '🚧' },
  { unit: 3, book: 3, en: 'blow', vi: 'thổi', emoji: '💨' },
  { unit: 3, book: 3, en: 'burn', vi: 'cháy, đốt', emoji: '🔥' },
  { unit: 3, book: 3, en: 'carbon dioxide', vi: 'khí các-bô-níc', emoji: '💨' },
  { unit: 3, book: 3, en: 'clear', vi: 'trong suốt', emoji: '🪟' },
  { unit: 3, book: 3, en: 'conduction', vi: 'sự truyền nhiệt, dẫn nhiệt', emoji: '🌡️' },
  { unit: 3, book: 3, en: 'drum', vi: '(cái) trống', emoji: '🥁' },
  { unit: 3, book: 3, en: 'drumhead', vi: 'mặt trống', emoji: '🥁' },
  { unit: 3, book: 3, en: 'easily', vi: 'dễ dàng', emoji: '👌' },
  { unit: 3, book: 3, en: 'energy', vi: 'năng lượng', emoji: '⚡' },
  { unit: 3, book: 3, en: 'fire', vi: 'lửa', emoji: '🔥' },
  { unit: 3, book: 3, en: 'gas', vi: 'thể khí', emoji: '💨' },
  { unit: 3, book: 3, en: 'guitar string', vi: 'dây đàn ghi-ta', emoji: '🎸' },
  { unit: 3, book: 3, en: 'heat', vi: 'nhiệt', emoji: '🌡️' },
  { unit: 3, book: 3, en: 'lamp', vi: 'đèn bàn', emoji: '💡' },
  { unit: 3, book: 3, en: 'light', vi: 'ánh sáng', emoji: '💡' },
  { unit: 3, book: 3, en: 'light source', vi: 'nguồn sáng', emoji: '🔦' },
  { unit: 3, book: 3, en: 'liquid', vi: 'thể lỏng', emoji: '💧' },
  { unit: 3, book: 3, en: 'loud', vi: '(âm thanh) to', emoji: '📢' },
  { unit: 3, book: 3, en: 'matter', vi: 'chất', emoji: '🧊' },
  { unit: 3, book: 3, en: 'metal', vi: 'kim loại', emoji: '🔩' },
  { unit: 3, book: 3, en: 'move through', vi: 'truyền qua', emoji: '↔️' },
  { unit: 3, book: 3, en: 'nitrogen', vi: 'khí ni-tơ', emoji: '💨' },
  { unit: 3, book: 3, en: 'noisy', vi: 'ồn ào', emoji: '📣' },
  { unit: 3, book: 3, en: 'oxygen', vi: 'khí ô-xi', emoji: '🫁' },
  { unit: 3, book: 3, en: 'pan pipes', vi: 'sáo ống', emoji: '🎶' },
  { unit: 3, book: 3, en: 'plastic', vi: 'nhựa', emoji: '🧴' },
  { unit: 3, book: 3, en: 'ring', vi: 'rung, reo (chuông)', emoji: '🔔' },
  { unit: 3, book: 3, en: 'send', vi: 'toả ra, phát (khói)', emoji: '📤' },
  { unit: 3, book: 3, en: 'shadow', vi: 'bóng', emoji: '🌚' },
  { unit: 3, book: 3, en: 'smoke', vi: 'khói', emoji: '💨' },
  { unit: 3, book: 3, en: 'soft', vi: 'mềm', emoji: '🧸' },
  { unit: 3, book: 3, en: 'solid', vi: 'thể rắn', emoji: '🧊' },
  { unit: 3, book: 3, en: 'sound', vi: 'âm thanh', emoji: '🔊' },
  { unit: 3, book: 3, en: 'state', vi: 'thể', emoji: '🔄' },
  { unit: 3, book: 3, en: 'sunlight', vi: 'ánh sáng mặt trời', emoji: '☀️' },
  { unit: 3, book: 3, en: 'torch', vi: 'đèn pin', emoji: '🔦' },
  { unit: 3, book: 3, en: 'vibrate', vi: 'rung động', emoji: '📳' },
  { unit: 3, book: 3, en: 'violin string', vi: 'dây đàn vi-ô-lông', emoji: '🎻' },
  { unit: 3, book: 3, en: 'wood', vi: 'gỗ', emoji: '🪵' },
  { unit: 3, book: 3, en: 'wooden', vi: 'làm bằng gỗ', emoji: '🪑' },

  // ── Unit 4 · Science: living things and food chains ─────────────────────
  { unit: 4, book: 4, en: 'bark', vi: 'sủa', emoji: '🐕' },
  { unit: 4, book: 4, en: 'bear', vi: 'con gấu', emoji: '🐻' },
  { unit: 4, book: 4, en: 'butterfly', vi: 'con bướm', emoji: '🦋' },
  { unit: 4, book: 4, en: 'button mushroom', vi: 'nấm mỡ', emoji: '🍄' },
  { unit: 4, book: 4, en: 'cap', vi: 'mũ (nấm)', emoji: '🍄' },
  { unit: 4, book: 4, en: 'carnivore', vi: 'động vật ăn thịt', emoji: '🦁' },
  { unit: 4, book: 4, en: 'caterpillar', vi: 'sâu bướm', emoji: '🐛' },
  { unit: 4, book: 4, en: 'come from', vi: 'đến từ', emoji: '📍' },
  { unit: 4, book: 4, en: 'consume', vi: 'tiêu thụ', emoji: '🍽️' },
  { unit: 4, book: 4, en: 'consumer', vi: 'sinh vật tiêu thụ', emoji: '🐰' },
  { unit: 4, book: 4, en: 'cowshed', vi: 'chuồng bò', emoji: '🐄' },
  { unit: 4, book: 4, en: 'crocodile', vi: 'con cá sấu', emoji: '🐊' },
  { unit: 4, book: 4, en: 'eagle', vi: 'con chim đại bàng', emoji: '🦅' },
  { unit: 4, book: 4, en: 'environment', vi: 'môi trường', emoji: '🌍' },
  { unit: 4, book: 4, en: 'food chain', vi: 'chuỗi thức ăn', emoji: '🔗' },
  { unit: 4, book: 4, en: 'grass', vi: 'cỏ', emoji: '🌿' },
  { unit: 4, book: 4, en: 'grow', vi: 'phát triển', emoji: '🌱' },
  { unit: 4, book: 4, en: 'herbivore', vi: 'động vật ăn cỏ', emoji: '🐮' },
  { unit: 4, book: 4, en: 'kind', vi: 'loại', emoji: '🏷️' },
  { unit: 4, book: 4, en: 'living thing', vi: 'sinh vật', emoji: '🌳' },
  { unit: 4, book: 4, en: "make one's own food", vi: 'tự tổng hợp được chất hữu cơ', emoji: '🌿' },
  { unit: 4, book: 4, en: 'mouse', vi: 'con chuột', emoji: '🐭' },
  { unit: 4, book: 4, en: 'mushroom', vi: 'nấm', emoji: '🍄' },
  { unit: 4, book: 4, en: 'mycelium', vi: 'sợi nấm', emoji: '🕸️' },
  { unit: 4, book: 4, en: 'omnivore', vi: 'động vật ăn tạp', emoji: '🐷' },
  { unit: 4, book: 4, en: 'poisonous', vi: 'có độc', emoji: '☠️' },
  { unit: 4, book: 4, en: 'producer', vi: 'sinh vật sản xuất', emoji: '🌱' },
  { unit: 4, book: 4, en: 'rice plant', vi: 'cây lúa', emoji: '🌾' },
  { unit: 4, book: 4, en: 'shark', vi: 'con cá mập', emoji: '🦈' },
  { unit: 4, book: 4, en: 'snake', vi: 'con rắn', emoji: '🐍' },
  { unit: 4, book: 4, en: 'soil', vi: 'đất', emoji: '🟫' },
  { unit: 4, book: 4, en: 'stem', vi: 'thân', emoji: '🌿' },
  { unit: 4, book: 4, en: 'straw mushroom', vi: 'nấm rơm', emoji: '🍄' },
  { unit: 4, book: 4, en: 'take in', vi: 'hấp thụ', emoji: '🫗' },
  { unit: 4, book: 4, en: 'top', vi: 'đỉnh, phía trên đầu', emoji: '🔝' },
  { unit: 4, book: 4, en: 'under', vi: 'ở dưới', emoji: '⬇️' },

  // ── Unit 5 · Science: food, health and everyday science ─────────────────
  { unit: 5, book: 5, en: 'amount', vi: 'số lượng', emoji: '🔢' },
  { unit: 5, book: 5, en: 'balanced', vi: 'cân bằng', emoji: '⚖️' },
  { unit: 5, book: 5, en: 'butter', vi: 'bơ', emoji: '🧈' },
  { unit: 5, book: 5, en: 'carbohydrate', vi: 'chất bột đường', emoji: '🍞' },
  { unit: 5, book: 5, en: 'clean', vi: 'sạch sẽ', emoji: '🧼' },
  { unit: 5, book: 5, en: 'cook', vi: 'nấu', emoji: '👨‍🍳' },
  { unit: 5, book: 5, en: 'diet', vi: 'chế độ ăn uống', emoji: '🥗' },
  { unit: 5, book: 5, en: 'dirty', vi: 'bẩn', emoji: '🦠' },
  { unit: 5, book: 5, en: 'DIY (Do It Yourself)', vi: 'tự làm, tự chế tạo', emoji: '🔧' },
  { unit: 5, book: 5, en: 'drinking straw', vi: 'ống hút', emoji: '🥤' },
  { unit: 5, book: 5, en: 'enough', vi: 'đủ dùng', emoji: '👍' },
  { unit: 5, book: 5, en: 'exercise', vi: 'tập thể dục', emoji: '🏃' },
  { unit: 5, book: 5, en: 'extra', vi: 'thêm', emoji: '➕' },
  { unit: 5, book: 5, en: 'fat', vi: 'chất béo', emoji: '🥑' },
  { unit: 5, book: 5, en: 'flyer', vi: 'tờ rơi', emoji: '📄' },
  { unit: 5, book: 5, en: 'food pyramid', vi: 'tháp dinh dưỡng', emoji: '🔺' },
  { unit: 5, book: 5, en: 'fresh', vi: 'trong lành', emoji: '🌬️' },
  { unit: 5, book: 5, en: 'healthy', vi: 'khoẻ mạnh', emoji: '💪' },
  { unit: 5, book: 5, en: 'meat', vi: 'thịt', emoji: '🥩' },
  { unit: 5, book: 5, en: 'mineral', vi: 'khoáng chất', emoji: '🧂' },
  { unit: 5, book: 5, en: 'must', vi: 'phải', emoji: '❗' },
  { unit: 5, book: 5, en: "mustn't", vi: 'không được phép', emoji: '🚫' },
  { unit: 5, book: 5, en: 'need', vi: 'cần', emoji: '🙏' },
  { unit: 5, book: 5, en: 'nutrient', vi: 'chất dinh dưỡng', emoji: '🥦' },
  { unit: 5, book: 5, en: 'oil', vi: 'dầu', emoji: '🫒' },
  { unit: 5, book: 5, en: 'overweight', vi: 'thừa cân, béo phì', emoji: '⚖️' },
  { unit: 5, book: 5, en: 'pour', vi: 'đổ', emoji: '🫗' },
  { unit: 5, book: 5, en: 'protein', vi: 'chất đạm', emoji: '🥚' },
  { unit: 5, book: 5, en: 'public transport', vi: 'phương tiện công cộng', emoji: '🚌' },
  { unit: 5, book: 5, en: 'rice', vi: 'gạo, cơm', emoji: '🍚' },
  { unit: 5, book: 5, en: 'right', vi: 'thích hợp', emoji: '✅' },
  { unit: 5, book: 5, en: 'rubbish', vi: 'rác thải', emoji: '🗑️' },
  { unit: 5, book: 5, en: 'smell', vi: 'mùi', emoji: '👃' },
  { unit: 5, book: 5, en: 'spoon', vi: 'cái thìa', emoji: '🥄' },
  { unit: 5, book: 5, en: 'taste', vi: 'vị', emoji: '👅' },
  { unit: 5, book: 5, en: 'throw', vi: 'ném, vứt', emoji: '🤾' },
  { unit: 5, book: 5, en: 'too little', vi: 'quá ít', emoji: '🤏' },
  { unit: 5, book: 5, en: 'too much', vi: 'quá nhiều', emoji: '🙌' },
  { unit: 5, book: 5, en: 'tray', vi: 'cái khay', emoji: '🍽️' },
  { unit: 5, book: 5, en: 'underweight', vi: 'nhẹ cân', emoji: '🪶' },
  { unit: 5, book: 5, en: 'vegetable', vi: 'rau củ', emoji: '🥕' },
  { unit: 5, book: 5, en: 'vitamin', vi: 'vi-ta-min', emoji: '💊' },
  { unit: 5, book: 5, en: 'waste', vi: 'lãng phí', emoji: '♻️' },
];

// What each practice unit covers. The card shows this under the unit number,
// so it says the subject out loud — the two books are taught in the same tab.
const UNIT_POSTHK_TITLES = {
  1: 'Maths · Numbers, money and the four operations',
  2: 'Maths · Fractions, shapes and measuring',
  3: 'Science · Matter, energy, light and sound',
  4: 'Science · Living things and food chains',
  5: 'Science · Food, health and everyday science',
};

// The other sets map a practice unit onto the textbook units it merges. These
// words come from a glossary at the back of a book rather than from any one
// unit of it, so what a card can usefully point at is the BOOK.
const UNIT_POSTHK_BOOKS = null;

// Which book each unit is drawn from, for the label on the card.
const UNIT_POSTHK_SOURCE = {
  1: 'Global Maths 4',
  2: 'Global Maths 4',
  3: 'Global Science 4',
  4: 'Global Science 4',
  5: 'Global Science 4',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UNIT_WORDS_POSTHK, UNIT_POSTHK_TITLES, UNIT_POSTHK_BOOKS, UNIT_POSTHK_SOURCE };
}
