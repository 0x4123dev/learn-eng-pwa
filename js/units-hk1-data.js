// units-hk1-data.js — HK1 word bank for the Topics → Grade 4 tab.
//
// Source: "Tiếng Anh 4 – Global Success – Sách học sinh, Tập một" (NXB Giáo dục
// Việt Nam & Macmillan, 2023). The words are the complete Wordlist (pages 78,
// 79, 80) — every single entry is here, placed in the book unit that teaches
// it, per the Book map (pages 4-5) and the lesson pages themselves.
//
// A handful of words the Book map teaches but the Wordlist leaves out (they
// were already learnt in Grade 3) are included too, so a unit reads like the
// lesson does: fifteen, listen to music, juice, water, swim, cook, draw,
// playground, June, July.
//
// The book's ten units are paired into FIVE practice units. Ten units meant
// 8-13 words each, so a "10 words" run kept asking nearly the whole unit; a
// paired unit holds ~20, and every run is ten fresh-feeling words out of it.
//   unit — the practice unit shown on the card, renumbered 1..5
//   book — the unit number printed in the textbook (1..10), kept so a word can
//          always be traced back to its lesson
//
// Schema: { unit, book, en, vi, emoji } — `unit`/`en`/`vi`/`emoji` match
// UNIT_WORDS (js/units-data.js). emoji is the "picture"; a pure digits/colon
// string renders as a number card.

const UNIT_HK1_TITLES = {
  1: 'My friends · Time and daily routines',
  2: 'My week · My birthday party',
  3: 'Things we can do · Our school facilities',
  4: 'Our timetables · My favourite subjects',
  5: 'Our sports day · Our summer holidays',
};

// Which textbook units each practice unit covers — shown on the card so a
// child can find the lesson in the book.
const UNIT_HK1_BOOKS = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10] };

const UNIT_WORDS_HK1 = [
  // ══ Unit 1 = book units 1-2 — Book Unit 1: My friends (Where are you from?) ══
  { unit: 1, book: 1, en: 'America', vi: 'nước Hoa Kì', emoji: '🇺🇸' },
  { unit: 1, book: 1, en: 'Australia', vi: 'nước Ô-xtơ-rây-li-a', emoji: '🇦🇺' },
  { unit: 1, book: 1, en: 'Britain', vi: 'nước Anh', emoji: '🇬🇧' },
  { unit: 1, book: 1, en: 'Japan', vi: 'nước Nhật', emoji: '🇯🇵' },
  { unit: 1, book: 1, en: 'Malaysia', vi: 'nước Ma-lay-xi-a', emoji: '🇲🇾' },
  { unit: 1, book: 1, en: 'Singapore', vi: 'nước Xinh-ga-po', emoji: '🇸🇬' },
  { unit: 1, book: 1, en: 'Thailand', vi: 'nước Thái Lan', emoji: '🇹🇭' },
  { unit: 1, book: 1, en: 'Viet Nam', vi: 'nước Việt Nam', emoji: '🇻🇳' },
  //    Book Unit 2: Time and daily routines (What time is it?)
  { unit: 1, book: 2, en: "o'clock", vi: 'giờ (dùng sau giờ chẵn)', emoji: '🕗' },
  { unit: 1, book: 2, en: 'fifteen', vi: 'số 15 (mười lăm phút)', emoji: '15' },
  { unit: 1, book: 2, en: 'thirty', vi: 'số 30 (ba mươi phút)', emoji: '30' },
  { unit: 1, book: 2, en: 'forty-five', vi: 'số 45 (bốn lăm phút)', emoji: '45' },
  { unit: 1, book: 2, en: 'get up', vi: 'thức dậy', emoji: '⏰' },
  { unit: 1, book: 2, en: 'have breakfast', vi: 'dùng bữa sáng', emoji: '🥣' },
  { unit: 1, book: 2, en: 'go to school', vi: 'đi học', emoji: '🎒' },
  { unit: 1, book: 2, en: 'go to bed', vi: 'đi ngủ', emoji: '🛏️' },
  { unit: 1, book: 2, en: 'wash', vi: 'rửa (rửa mặt)', emoji: '🧼' },

  // ══ Unit 2 = book units 3-4 — Book Unit 3: My week (What day is it today?) ══
  { unit: 2, book: 3, en: 'Monday', vi: 'thứ Hai', emoji: '📅2️⃣' },
  { unit: 2, book: 3, en: 'Tuesday', vi: 'thứ Ba', emoji: '📅3️⃣' },
  { unit: 2, book: 3, en: 'Wednesday', vi: 'thứ Tư', emoji: '📅4️⃣' },
  { unit: 2, book: 3, en: 'Thursday', vi: 'thứ Năm', emoji: '📅5️⃣' },
  { unit: 2, book: 3, en: 'Friday', vi: 'thứ Sáu', emoji: '📅6️⃣' },
  { unit: 2, book: 3, en: 'Saturday', vi: 'thứ Bảy', emoji: '📅7️⃣' },
  { unit: 2, book: 3, en: 'Sunday', vi: 'Chủ Nhật', emoji: '📅🌞' },
  { unit: 2, book: 3, en: 'weekday', vi: 'ngày trong tuần (thứ Hai đến thứ Sáu)', emoji: '🏫📅' },
  { unit: 2, book: 3, en: 'weekend', vi: 'ngày cuối tuần (thứ Bảy và Chủ Nhật)', emoji: '🎉📅' },
  { unit: 2, book: 3, en: 'housework', vi: 'việc nhà', emoji: '🧹' },
  { unit: 2, book: 3, en: 'study', vi: 'học, nghiên cứu', emoji: '📖' },
  { unit: 2, book: 3, en: 'stay at home', vi: 'ở nhà', emoji: '🏠' },
  { unit: 2, book: 3, en: 'listen to music', vi: 'nghe nhạc', emoji: '🎧' },
  //    Book Unit 4: My birthday party (When's your birthday?)
  { unit: 2, book: 4, en: 'January', vi: 'tháng Giêng', emoji: '🗓️1️⃣' },
  { unit: 2, book: 4, en: 'February', vi: 'tháng Hai', emoji: '🗓️2️⃣' },
  { unit: 2, book: 4, en: 'March', vi: 'tháng Ba', emoji: '🗓️3️⃣' },
  { unit: 2, book: 4, en: 'April', vi: 'tháng Tư', emoji: '🗓️4️⃣' },
  { unit: 2, book: 4, en: 'May', vi: 'tháng Năm', emoji: '🗓️5️⃣' },
  { unit: 2, book: 4, en: 'birthday', vi: 'ngày sinh', emoji: '🎂' },
  { unit: 2, book: 4, en: 'party', vi: 'buổi tiệc', emoji: '🎉' },
  { unit: 2, book: 4, en: 'chips', vi: 'khoai tây rán', emoji: '🍟' },
  { unit: 2, book: 4, en: 'grape', vi: 'quả nho', emoji: '🍇' },
  { unit: 2, book: 4, en: 'jam', vi: 'mứt', emoji: '🍓🍞' },
  { unit: 2, book: 4, en: 'lemonade', vi: 'nước chanh', emoji: '🍋🥤' },
  { unit: 2, book: 4, en: 'juice', vi: 'nước ép trái cây', emoji: '🧃' },
  { unit: 2, book: 4, en: 'water', vi: 'nước', emoji: '💧' },

  // ══ Unit 3 = book units 5-6 — Book Unit 5: Things we can do (+ Starter: outdoor activities) ══
  { unit: 3, book: 5, en: 'can', vi: 'có thể, biết (làm gì)', emoji: '💪' },
  { unit: 3, book: 5, en: 'jump', vi: 'nhảy', emoji: '🤸' },
  { unit: 3, book: 5, en: 'swim', vi: 'bơi', emoji: '🏊' },
  { unit: 3, book: 5, en: 'cook', vi: 'nấu ăn', emoji: '👨‍🍳' },
  { unit: 3, book: 5, en: 'draw', vi: 'vẽ', emoji: '✏️' },
  { unit: 3, book: 5, en: 'play the guitar', vi: 'chơi đàn ghi ta', emoji: '🎸' },
  { unit: 3, book: 5, en: 'play the piano', vi: 'chơi đàn piano', emoji: '🎹' },
  { unit: 3, book: 5, en: 'ride a bike', vi: 'đạp xe', emoji: '🚴' },
  { unit: 3, book: 5, en: 'ride a horse', vi: 'cưỡi ngựa', emoji: '🏇' },
  { unit: 3, book: 5, en: 'roller skate', vi: 'trượt patanh', emoji: '🛼' },
  { unit: 3, book: 5, en: 'activity', vi: 'hoạt động', emoji: '🤾' },
  { unit: 3, book: 5, en: 'outdoor', vi: 'ngoài trời', emoji: '🌳' },
  //    Book Unit 6: Our school facilities (Where's your school?)
  { unit: 3, book: 6, en: 'city', vi: 'thành phố', emoji: '🏙️' },
  { unit: 3, book: 6, en: 'town', vi: 'thị trấn', emoji: '🏘️' },
  { unit: 3, book: 6, en: 'village', vi: 'ngôi làng', emoji: '🛖' },
  { unit: 3, book: 6, en: 'mountains', vi: 'vùng núi', emoji: '⛰️' },
  { unit: 3, book: 6, en: 'building', vi: 'toà nhà', emoji: '🏢' },
  { unit: 3, book: 6, en: 'computer room', vi: 'phòng máy tính', emoji: '💻' },
  { unit: 3, book: 6, en: 'garden', vi: 'vườn', emoji: '🌷' },
  { unit: 3, book: 6, en: 'school garden', vi: 'vườn trường', emoji: '🌻🏫' },
  { unit: 3, book: 6, en: 'playground', vi: 'sân chơi', emoji: '🛝' },

  // ══ Unit 4 = book units 7-8 — Book Unit 7: Our timetables (What subjects do you have today?) ══
  { unit: 4, book: 7, en: 'art', vi: 'môn Mĩ thuật', emoji: '🎨' },
  { unit: 4, book: 7, en: 'English', vi: 'môn Tiếng Anh', emoji: '🇬🇧📖' },
  { unit: 4, book: 7, en: 'maths', vi: 'môn Toán, toán học', emoji: '➗' },
  { unit: 4, book: 7, en: 'music', vi: 'môn Âm nhạc', emoji: '🎵' },
  { unit: 4, book: 7, en: 'science', vi: 'môn Khoa học', emoji: '🔬' },
  { unit: 4, book: 7, en: 'Vietnamese', vi: 'môn Tiếng Việt', emoji: '🇻🇳📖' },
  { unit: 4, book: 7, en: 'history and geography', vi: 'môn Lịch sử và Địa lí', emoji: '📜🌏' },
  { unit: 4, book: 7, en: 'subject', vi: 'môn học', emoji: '📚' },
  { unit: 4, book: 7, en: 'today', vi: 'hôm nay', emoji: '📆' },
  { unit: 4, book: 7, en: 'when', vi: 'khi nào', emoji: '🕐❓' },
  //    Book Unit 8: My favourite subjects (Why do you like ...?)
  { unit: 4, book: 8, en: 'IT', vi: 'môn Tin học (Công nghệ thông tin)', emoji: '🖥️' },
  { unit: 4, book: 8, en: 'PE', vi: 'môn Thể dục (Giáo dục thể chất)', emoji: '⚽' },
  { unit: 4, book: 8, en: 'English teacher', vi: 'giáo viên dạy Tiếng Anh', emoji: '👩‍🏫' },
  { unit: 4, book: 8, en: 'maths teacher', vi: 'giáo viên dạy Toán', emoji: '🧑‍🏫' },
  { unit: 4, book: 8, en: 'painter', vi: 'hoạ sĩ', emoji: '👨‍🎨' },
  { unit: 4, book: 8, en: 'because', vi: 'bởi vì', emoji: '💬' },
  { unit: 4, book: 8, en: 'why', vi: 'tại sao', emoji: '❓' },
  { unit: 4, book: 8, en: 'story', vi: 'chuyện, câu chuyện', emoji: '📕' },

  // ══ Unit 5 = book units 9-10 — Book Unit 9: Our sports day (When's your sports day?) ══
  { unit: 5, book: 9, en: 'June', vi: 'tháng Sáu', emoji: '🗓️6️⃣' },
  { unit: 5, book: 9, en: 'July', vi: 'tháng Bảy', emoji: '🗓️7️⃣' },
  { unit: 5, book: 9, en: 'August', vi: 'tháng Tám', emoji: '🗓️8️⃣' },
  { unit: 5, book: 9, en: 'September', vi: 'tháng Chín', emoji: '🗓️9️⃣' },
  { unit: 5, book: 9, en: 'October', vi: 'tháng Mười', emoji: '🗓️🔟' },
  { unit: 5, book: 9, en: 'November', vi: 'tháng Mười Một', emoji: '🗓️1️⃣1️⃣' },
  { unit: 5, book: 9, en: 'December', vi: 'tháng Mười Hai', emoji: '🗓️1️⃣2️⃣' },
  { unit: 5, book: 9, en: 'sports day', vi: 'ngày hội thể thao', emoji: '🏅' },
  //    Book Unit 10: Our summer holidays (Where were you last summer?)
  { unit: 5, book: 10, en: 'beach', vi: 'bãi biển', emoji: '🏖️' },
  { unit: 5, book: 10, en: 'campsite', vi: 'địa điểm cắm trại', emoji: '⛺' },
  { unit: 5, book: 10, en: 'countryside', vi: 'nông thôn, vùng quê', emoji: '🌾' },
  { unit: 5, book: 10, en: 'Bangkok', vi: 'Băng Cốc (thủ đô của nước Thái Lan)', emoji: '🇹🇭🛕' },
  { unit: 5, book: 10, en: 'London', vi: 'Luân Đôn (thủ đô của nước Anh)', emoji: '🇬🇧🕰️' },
  { unit: 5, book: 10, en: 'Sydney', vi: 'Xít-ni (thành phố của nước Ô-xtơ-rây-li-a)', emoji: '🇦🇺🎭' },
  { unit: 5, book: 10, en: 'Tokyo', vi: 'Tô-ki-ô (thủ đô của nước Nhật)', emoji: '🇯🇵🗼' },
  { unit: 5, book: 10, en: 'last', vi: 'trước, lần trước', emoji: '⏪' },
  { unit: 5, book: 10, en: 'yesterday', vi: 'ngày hôm qua', emoji: '📆⏪' },
  { unit: 5, book: 10, en: 'hat', vi: 'cái mũ', emoji: '👒' },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UNIT_WORDS_HK1, UNIT_HK1_TITLES, UNIT_HK1_BOOKS };
}
