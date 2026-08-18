// units-hk2-data.js — HK2 word bank for the Topics → Grade 4 tab.
//
// Source: "Tiếng Anh 4 – Global Success – Sách học sinh, Tập hai" (NXB Giáo dục
// Việt Nam & Macmillan, 2023). The words are the complete Wordlist (pages 74
// and 75) — all 100 entries, each placed in the book unit that teaches it, per
// the Book map (pages 4-5) and the lesson pages themselves.
//
// Unlike HK1 this set needs no extras: the Wordlist already covers every unit
// generously, so HK2 is the book's own hundred words and nothing else.
//
// Same shape as HK1 (js/units-hk1-data.js): the book's ten units (11..20) are
// merged two-by-two into five practice units, renumbered 1..5.
//   unit — the practice unit shown on the card (1..5)
//   book — the unit number printed in the textbook (11..20)
//
// Schema: { unit, book, en, vi, emoji }. emoji is the "picture"; a pure
// digits/colon string renders as a number card.

const UNIT_HK2_TITLES = {
  1: 'My home · Jobs',
  2: 'Appearance · Daily activities',
  3: "My family's weekends · Weather",
  4: 'In the city · At the shopping centre',
  5: 'The animal world · At summer camp',
};

const UNIT_HK2_BOOKS = { 1: [11, 12], 2: [13, 14], 3: [15, 16], 4: [17, 18], 5: [19, 20] };

const UNIT_WORDS_HK2 = [
  // ══ Unit 1 = book units 11-12 — Book Unit 11: My home (Where do you live?) ══
  { unit: 1, book: 11, en: 'road', vi: 'con đường, đường phố', emoji: '🛣️' },
  { unit: 1, book: 11, en: 'street', vi: 'phố, đường phố', emoji: '🏙️🛣️' },
  { unit: 1, book: 11, en: 'live', vi: 'sống, sinh sống', emoji: '🏡' },
  { unit: 1, book: 11, en: 'big', vi: 'to, lớn (kích thước)', emoji: '🐘' },
  { unit: 1, book: 11, en: 'busy', vi: 'bận rộn, nhộn nhịp', emoji: '🚗🚕🚙' },
  { unit: 1, book: 11, en: 'noisy', vi: 'ồn ào, om sòm, huyên náo', emoji: '🔊😖' },
  { unit: 1, book: 11, en: 'quiet', vi: 'yên tĩnh, tĩnh mịch', emoji: '🤫' },
  { unit: 1, book: 11, en: 'in', vi: 'trong, ở (đi với tên đường / phố)', emoji: '📍' },
  //    Book Unit 12: Jobs (What does he / she do?)
  { unit: 1, book: 12, en: 'actor', vi: 'diễn viên (nam)', emoji: '🎭' },
  { unit: 1, book: 12, en: 'farmer', vi: 'nông dân', emoji: '👨‍🌾' },
  { unit: 1, book: 12, en: 'nurse', vi: 'y tá, điều dưỡng viên', emoji: '🧑‍⚕️' },
  { unit: 1, book: 12, en: 'office worker', vi: 'nhân viên văn phòng', emoji: '👔' },
  { unit: 1, book: 12, en: 'policeman', vi: 'cảnh sát (nam)', emoji: '👮' },
  { unit: 1, book: 12, en: 'factory', vi: 'nhà máy', emoji: '🏭' },
  { unit: 1, book: 12, en: 'farm', vi: 'trang trại', emoji: '🚜🌾' },
  { unit: 1, book: 12, en: 'hospital', vi: 'bệnh viện', emoji: '🏥' },
  { unit: 1, book: 12, en: 'nursing home', vi: 'viện điều dưỡng', emoji: '🏨🧓' },

  // ══ Unit 2 = book units 13-14 — Book Unit 13: Appearance (What does he look like?) ══
  { unit: 2, book: 13, en: 'tall', vi: 'cao', emoji: '📏🔺' },
  { unit: 2, book: 13, en: 'short', vi: 'thấp, ngắn', emoji: '📏🔻' },
  { unit: 2, book: 13, en: 'slim', vi: 'mảnh mai', emoji: '🎋' },
  { unit: 2, book: 13, en: 'long', vi: 'dài', emoji: '📏➡️' },
  { unit: 2, book: 13, en: 'round', vi: 'tròn', emoji: '⭕' },
  { unit: 2, book: 13, en: 'eye', vi: 'mắt', emoji: '👁️' },
  { unit: 2, book: 13, en: 'face', vi: 'khuôn mặt', emoji: '😊' },
  { unit: 2, book: 13, en: 'hair', vi: 'tóc', emoji: '💇' },
  { unit: 2, book: 13, en: 'like', vi: 'giống như (look like)', emoji: '🪞' },
  //    Book Unit 14: Daily activities (When do you watch TV?)
  { unit: 2, book: 14, en: 'morning', vi: 'buổi sáng', emoji: '🌅' },
  { unit: 2, book: 14, en: 'noon', vi: 'buổi trưa', emoji: '🌞' },
  { unit: 2, book: 14, en: 'afternoon', vi: 'buổi chiều', emoji: '🌇' },
  { unit: 2, book: 14, en: 'evening', vi: 'buổi tối', emoji: '🌃' },
  { unit: 2, book: 14, en: 'do the housework', vi: 'làm việc nhà', emoji: '🧽' },
  { unit: 2, book: 14, en: 'clean the floor', vi: 'lau sàn nhà', emoji: '🧹' },
  { unit: 2, book: 14, en: 'help with the cooking', vi: 'giúp đỡ việc nấu ăn', emoji: '🍳🤝' },
  { unit: 2, book: 14, en: 'cooking', vi: 'việc nấu nướng', emoji: '🍳' },
  { unit: 2, book: 14, en: 'wash', vi: 'giặt (quần áo), rửa (bát đĩa)', emoji: '🧼🧺' },
  { unit: 2, book: 14, en: 'watch', vi: 'xem', emoji: '👀📺' },

  // ══ Unit 3 = book units 15-16 — Book Unit 15: My family's weekends ══
  { unit: 3, book: 15, en: 'cinema', vi: 'rạp chiếu phim', emoji: '🎬' },
  { unit: 3, book: 15, en: 'shopping centre', vi: 'trung tâm mua sắm', emoji: '🛍️' },
  { unit: 3, book: 15, en: 'sports centre', vi: 'trung tâm thể thao', emoji: '🏟️' },
  { unit: 3, book: 15, en: 'swimming pool', vi: 'bể bơi', emoji: '🏊' },
  { unit: 3, book: 15, en: 'centre', vi: 'trung tâm', emoji: '🎯' },
  { unit: 3, book: 15, en: 'do yoga', vi: 'tập yoga', emoji: '🧘' },
  { unit: 3, book: 15, en: 'play tennis', vi: 'chơi quần vợt', emoji: '🎾' },
  { unit: 3, book: 15, en: 'meal', vi: 'bữa ăn', emoji: '🍽️' },
  { unit: 3, book: 15, en: 'film', vi: 'phim', emoji: '🎥' },
  { unit: 3, book: 15, en: 'television', vi: 'truyền hình', emoji: '📺' },
  //    Book Unit 16: Weather (What was the weather like last weekend?)
  { unit: 3, book: 16, en: 'weather', vi: 'thời tiết', emoji: '🌤️' },
  { unit: 3, book: 16, en: 'sunny', vi: 'có nắng', emoji: '☀️' },
  { unit: 3, book: 16, en: 'rainy', vi: 'có mưa', emoji: '🌧️' },
  { unit: 3, book: 16, en: 'cloudy', vi: 'có mây, nhiều mây', emoji: '☁️' },
  { unit: 3, book: 16, en: 'windy', vi: 'có gió', emoji: '💨' },
  { unit: 3, book: 16, en: 'bakery', vi: 'hiệu bánh mì', emoji: '🥖' },
  { unit: 3, book: 16, en: 'bookshop', vi: 'hiệu sách', emoji: '📚🏬' },
  { unit: 3, book: 16, en: 'food stall', vi: 'quầy hàng thực phẩm', emoji: '🍢' },
  { unit: 3, book: 16, en: 'water park', vi: 'công viên nước', emoji: '🎢💦' },
  { unit: 3, book: 16, en: 'supermarket', vi: 'siêu thị', emoji: '🛒' },
  { unit: 3, book: 16, en: 'me', vi: 'tớ, tôi (đi với me)', emoji: '🙋' },

  // ══ Unit 4 = book units 17-18 — Book Unit 17: In the city (How can I get to ...?) ══
  { unit: 4, book: 17, en: 'road sign', vi: 'biển chỉ đường', emoji: '🪧' },
  { unit: 4, book: 17, en: 'get to', vi: 'đến (địa điểm)', emoji: '🚶📍' },
  { unit: 4, book: 17, en: 'go straight', vi: 'đi thẳng', emoji: '⬆️' },
  { unit: 4, book: 17, en: 'left', vi: 'bên trái', emoji: '⬅️' },
  { unit: 4, book: 17, en: 'right', vi: 'bên phải', emoji: '➡️' },
  { unit: 4, book: 17, en: 'stop', vi: 'dừng lại', emoji: '🛑' },
  { unit: 4, book: 17, en: 'turn', vi: 'rẽ', emoji: '↩️' },
  { unit: 4, book: 17, en: 'turn left', vi: 'rẽ trái', emoji: '⬅️↩️' },
  { unit: 4, book: 17, en: 'turn right', vi: 'rẽ phải', emoji: '➡️↪️' },
  { unit: 4, book: 17, en: 'turn round', vi: 'quay lại, đổi hướng ngược lại', emoji: '🔃' },
  //    Book Unit 18: At the shopping centre (Where's the bookshop?)
  { unit: 4, book: 18, en: 'behind', vi: 'đằng sau', emoji: '🔙' },
  { unit: 4, book: 18, en: 'between', vi: 'ở giữa', emoji: '🟦🔴🟦' },
  { unit: 4, book: 18, en: 'near', vi: 'ở gần', emoji: '🟦🔴' },
  { unit: 4, book: 18, en: 'opposite', vi: 'đối diện', emoji: '🟦↔️🔴' },
  { unit: 4, book: 18, en: 'gift shop', vi: 'cửa hàng quà tặng', emoji: '🎁🏬' },
  { unit: 4, book: 18, en: 'skirt', vi: 'váy', emoji: '👗' },
  { unit: 4, book: 18, en: 'T-shirt', vi: 'áo thun', emoji: '👕' },
  { unit: 4, book: 18, en: 'dong', vi: 'đồng (tiền Việt Nam)', emoji: '💵' },
  { unit: 4, book: 18, en: 'thousand', vi: 'nghìn', emoji: '1000' },

  // ══ Unit 5 = book units 19-20 — Book Unit 19: The animal world ══
  { unit: 5, book: 19, en: 'crocodile', vi: 'cá sấu', emoji: '🐊' },
  { unit: 5, book: 19, en: 'giraffe', vi: 'hươu cao cổ', emoji: '🦒' },
  { unit: 5, book: 19, en: 'hippo', vi: 'hà mã', emoji: '🦛' },
  { unit: 5, book: 19, en: 'lion', vi: 'con sư tử', emoji: '🦁' },
  { unit: 5, book: 19, en: 'roar', vi: 'gầm, rống lên (hổ, sư tử)', emoji: '🦁💢' },
  { unit: 5, book: 19, en: 'loudly', vi: 'ầm ĩ, inh ỏi', emoji: '📢' },
  { unit: 5, book: 19, en: 'quickly', vi: 'nhanh, mau chóng', emoji: '💨🏃' },
  { unit: 5, book: 19, en: 'beautifully', vi: 'đẹp đẽ', emoji: '💃✨' },
  { unit: 5, book: 19, en: 'merrily', vi: 'vui, vui vẻ', emoji: '🎶😊' },
  { unit: 5, book: 19, en: 'burrow', vi: 'hang (cáy, thỏ)', emoji: '🕳️🐇' },
  { unit: 5, book: 19, en: 'den', vi: 'hang, ổ (sư tử)', emoji: '🕳️🦁' },
  { unit: 5, book: 19, en: 'web', vi: 'mạng (nhện)', emoji: '🕸️' },
  //    Book Unit 20: At summer camp (What's he / she doing?)
  { unit: 5, book: 20, en: 'build a campfire', vi: 'đốt lửa trại', emoji: '🔥' },
  { unit: 5, book: 20, en: 'dance around the campfire', vi: 'nhảy, múa quanh lửa trại', emoji: '💃🔥' },
  { unit: 5, book: 20, en: 'around', vi: 'xung quanh', emoji: '🔄' },
  { unit: 5, book: 20, en: 'put up a tent', vi: 'dựng lều, cắm trại', emoji: '⛺' },
  { unit: 5, book: 20, en: 'tent', vi: 'trại, lều (ở nơi cắm trại)', emoji: '🏕️' },
  { unit: 5, book: 20, en: 'play card games', vi: 'chơi bài', emoji: '🃏' },
  { unit: 5, book: 20, en: 'play tug of war', vi: 'chơi kéo co', emoji: '🪢' },
  { unit: 5, book: 20, en: 'sing songs', vi: 'hát', emoji: '🎤' },
  { unit: 5, book: 20, en: 'take a photo', vi: 'chụp ảnh', emoji: '📸' },
  { unit: 5, book: 20, en: 'photo', vi: 'bức ảnh', emoji: '🖼️' },
  { unit: 5, book: 20, en: 'tell a story', vi: 'kể chuyện', emoji: '📖🗣️' },
  { unit: 5, book: 20, en: 'email', vi: 'gửi thư điện tử', emoji: '📧' },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UNIT_WORDS_HK2, UNIT_HK2_TITLES, UNIT_HK2_BOOKS };
}
