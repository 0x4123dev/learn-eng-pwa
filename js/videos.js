// videos.js - Learn English with Short Videos

const VIDEO_LIBRARY = [
    // ==================== BEGINNER (15 videos) ====================
    {
        id: 'GbzMC6qAzVU', title: 'Meet My Family',
        channel: 'British Council Kids', duration: '3:20', level: 'beginner',
        category: 'daily-life', icon: '👨‍👩‍👧‍👦',
        description: 'Learn family vocabulary with a fun animated story.',
        vocabulary: [
            { word: 'family', phonetic: '/ˈfæm.əl.i/', meaning: 'gia đình' },
            { word: 'mother', phonetic: '/ˈmʌð.ər/', meaning: 'mẹ' },
            { word: 'father', phonetic: '/ˈfɑː.ðər/', meaning: 'bố' },
            { word: 'brother', phonetic: '/ˈbrʌð.ər/', meaning: 'anh/em trai' },
            { word: 'sister', phonetic: '/ˈsɪs.tər/', meaning: 'chị/em gái' }
        ],
        quiz: [
            { q: 'What is the word for "mẹ" in English?', opts: ['Mother', 'Father', 'Sister'], answer: 0 },
            { q: 'Who is your parent\'s son?', opts: ['Sister', 'Brother', 'Mother'], answer: 1 },
            { q: '"Family" means...', opts: ['Bạn bè', 'Gia đình', 'Trường học'], answer: 1 }
        ]
    },
    {
        id: 'DL0MZSQQOn8', title: 'The ABC Song',
        channel: 'KidsTV123', duration: '2:10', level: 'beginner',
        category: 'fun', icon: '🔤',
        description: 'Sing along and learn the English alphabet!',
        vocabulary: [
            { word: 'alphabet', phonetic: '/ˈæl.fə.bet/', meaning: 'bảng chữ cái' },
            { word: 'letter', phonetic: '/ˈlet.ər/', meaning: 'chữ cái' },
            { word: 'sing', phonetic: '/sɪŋ/', meaning: 'hát' },
            { word: 'learn', phonetic: '/lɜːrn/', meaning: 'học' }
        ],
        quiz: [
            { q: 'How many letters are in the English alphabet?', opts: ['24', '26', '28'], answer: 1 },
            { q: '"Sing" means...', opts: ['Đọc', 'Hát', 'Viết'], answer: 1 },
            { q: 'What comes after A, B, C?', opts: ['E, F, G', 'D, E, F', 'C, D, E'], answer: 1 }
        ]
    },
    {
        id: 'Yx8FWt-bqp0', title: 'Greetings & Introductions',
        channel: 'Shaw English', duration: '4:15', level: 'beginner',
        category: 'daily-life', icon: '👋',
        description: 'How to say hello and introduce yourself in English.',
        vocabulary: [
            { word: 'hello', phonetic: '/həˈloʊ/', meaning: 'xin chào' },
            { word: 'name', phonetic: '/neɪm/', meaning: 'tên' },
            { word: 'nice', phonetic: '/naɪs/', meaning: 'vui/đẹp' },
            { word: 'meet', phonetic: '/miːt/', meaning: 'gặp' },
            { word: 'goodbye', phonetic: '/ɡʊdˈbaɪ/', meaning: 'tạm biệt' }
        ],
        quiz: [
            { q: '"Nice to meet you" is used when...', opts: ['You leave', 'You meet someone new', 'You eat'], answer: 1 },
            { q: 'How do you ask someone\'s name?', opts: ['How old are you?', 'What is your name?', 'Where are you?'], answer: 1 },
            { q: '"Goodbye" means...', opts: ['Xin chào', 'Cảm ơn', 'Tạm biệt'], answer: 2 }
        ]
    },
    {
        id: 'kPsRUWSb3ik', title: 'At the Supermarket',
        channel: 'VOA Learning English', duration: '3:45', level: 'beginner',
        category: 'daily-life', icon: '🛒',
        description: 'Learn useful words for shopping at the supermarket.',
        vocabulary: [
            { word: 'buy', phonetic: '/baɪ/', meaning: 'mua' },
            { word: 'price', phonetic: '/praɪs/', meaning: 'giá' },
            { word: 'cheap', phonetic: '/tʃiːp/', meaning: 'rẻ' },
            { word: 'expensive', phonetic: '/ɪkˈspen.sɪv/', meaning: 'đắt' },
            { word: 'money', phonetic: '/ˈmʌn.i/', meaning: 'tiền' }
        ],
        quiz: [
            { q: 'The opposite of "cheap" is...', opts: ['Big', 'Expensive', 'Small'], answer: 1 },
            { q: '"Buy" means...', opts: ['Bán', 'Mua', 'Ăn'], answer: 1 },
            { q: 'You use _____ to buy things.', opts: ['Time', 'Money', 'Food'], answer: 1 }
        ]
    },
    {
        id: '3z9-ixNl9yw', title: 'Colors & Shapes',
        channel: 'English with Jennifer', duration: '3:00', level: 'beginner',
        category: 'fun', icon: '🎨',
        description: 'Learn colors and basic shapes in English.',
        vocabulary: [
            { word: 'red', phonetic: '/red/', meaning: 'đỏ' },
            { word: 'blue', phonetic: '/bluː/', meaning: 'xanh dương' },
            { word: 'circle', phonetic: '/ˈsɜːr.kəl/', meaning: 'hình tròn' },
            { word: 'square', phonetic: '/skwer/', meaning: 'hình vuông' },
            { word: 'yellow', phonetic: '/ˈjel.oʊ/', meaning: 'vàng' }
        ],
        quiz: [
            { q: 'The color of the sky is...', opts: ['Red', 'Blue', 'Green'], answer: 1 },
            { q: 'A "circle" is...', opts: ['Hình vuông', 'Hình tròn', 'Hình tam giác'], answer: 1 },
            { q: 'Bananas are _____ color.', opts: ['Blue', 'Red', 'Yellow'], answer: 2 }
        ]
    },
    {
        id: 'hrliAdaVMEI', title: 'Numbers 1 to 100',
        channel: 'EnglishClass101', duration: '4:30', level: 'beginner',
        category: 'fun', icon: '🔢',
        description: 'Master counting from 1 to 100 in English.',
        vocabulary: [
            { word: 'number', phonetic: '/ˈnʌm.bər/', meaning: 'số' },
            { word: 'count', phonetic: '/kaʊnt/', meaning: 'đếm' },
            { word: 'hundred', phonetic: '/ˈhʌn.drəd/', meaning: 'một trăm' },
            { word: 'first', phonetic: '/fɜːrst/', meaning: 'đầu tiên' },
            { word: 'last', phonetic: '/læst/', meaning: 'cuối cùng' }
        ],
        quiz: [
            { q: 'What number comes after nineteen?', opts: ['Eighteen', 'Twenty', 'Thirty'], answer: 1 },
            { q: '"Hundred" means...', opts: ['Mười', 'Một trăm', 'Một nghìn'], answer: 1 },
            { q: '"First" is the opposite of...', opts: ['Last', 'Second', 'Next'], answer: 0 }
        ]
    },
    {
        id: '0LLPBJkSf2Q', title: 'My Daily Routine',
        channel: 'English Addict', duration: '5:00', level: 'beginner',
        category: 'daily-life', icon: '⏰',
        description: 'Learn to talk about your daily routine in English.',
        vocabulary: [
            { word: 'wake up', phonetic: '/weɪk ʌp/', meaning: 'thức dậy' },
            { word: 'breakfast', phonetic: '/ˈbrek.fəst/', meaning: 'bữa sáng' },
            { word: 'school', phonetic: '/skuːl/', meaning: 'trường học' },
            { word: 'homework', phonetic: '/ˈhoʊm.wɜːrk/', meaning: 'bài tập về nhà' },
            { word: 'sleep', phonetic: '/sliːp/', meaning: 'ngủ' }
        ],
        quiz: [
            { q: 'You eat _____ in the morning.', opts: ['Dinner', 'Lunch', 'Breakfast'], answer: 2 },
            { q: '"Wake up" means...', opts: ['Ngủ', 'Thức dậy', 'Ăn'], answer: 1 },
            { q: 'Children go to _____ to learn.', opts: ['Hospital', 'School', 'Market'], answer: 1 }
        ]
    },
    {
        id: 'yVKPf-P34X0', title: 'Animals in English',
        channel: 'Papa Teach Me', duration: '3:30', level: 'beginner',
        category: 'fun', icon: '🐾',
        description: 'Learn animal names and sounds in English.',
        vocabulary: [
            { word: 'dog', phonetic: '/dɔːɡ/', meaning: 'chó' },
            { word: 'cat', phonetic: '/kæt/', meaning: 'mèo' },
            { word: 'bird', phonetic: '/bɜːrd/', meaning: 'chim' },
            { word: 'fish', phonetic: '/fɪʃ/', meaning: 'cá' },
            { word: 'elephant', phonetic: '/ˈel.ə.fənt/', meaning: 'voi' }
        ],
        quiz: [
            { q: 'A "dog" says...', opts: ['Meow', 'Woof', 'Moo'], answer: 1 },
            { q: 'Which animal lives in water?', opts: ['Dog', 'Bird', 'Fish'], answer: 2 },
            { q: 'The biggest animal here is...', opts: ['Cat', 'Elephant', 'Dog'], answer: 1 }
        ]
    },
    {
        id: 'p_B0MulkqpA', title: 'Food & Drinks',
        channel: 'Go Natural English', duration: '4:00', level: 'beginner',
        category: 'daily-life', icon: '🍕',
        description: 'Learn common food and drink words in English.',
        vocabulary: [
            { word: 'water', phonetic: '/ˈwɔː.tər/', meaning: 'nước' },
            { word: 'bread', phonetic: '/bred/', meaning: 'bánh mì' },
            { word: 'rice', phonetic: '/raɪs/', meaning: 'cơm/gạo' },
            { word: 'fruit', phonetic: '/fruːt/', meaning: 'trái cây' },
            { word: 'delicious', phonetic: '/dɪˈlɪʃ.əs/', meaning: 'ngon' }
        ],
        quiz: [
            { q: '"Water" means...', opts: ['Nước', 'Sữa', 'Trà'], answer: 0 },
            { q: 'Apples and bananas are...', opts: ['Vegetables', 'Fruit', 'Meat'], answer: 1 },
            { q: '"Delicious" describes food that is...', opts: ['Bad', 'Very good', 'Hot'], answer: 1 }
        ]
    },
    {
        id: '1PGgf8fHXkY', title: 'What\'s the Weather?',
        channel: 'Daily English', duration: '3:15', level: 'beginner',
        category: 'daily-life', icon: '🌤️',
        description: 'Talk about weather in English - sunny, rainy, cloudy and more.',
        vocabulary: [
            { word: 'sunny', phonetic: '/ˈsʌn.i/', meaning: 'nắng' },
            { word: 'rainy', phonetic: '/ˈreɪ.ni/', meaning: 'mưa' },
            { word: 'cold', phonetic: '/koʊld/', meaning: 'lạnh' },
            { word: 'hot', phonetic: '/hɑːt/', meaning: 'nóng' },
            { word: 'weather', phonetic: '/ˈweð.ər/', meaning: 'thời tiết' }
        ],
        quiz: [
            { q: 'When the sun shines, it is...', opts: ['Rainy', 'Sunny', 'Cloudy'], answer: 1 },
            { q: 'The opposite of "hot" is...', opts: ['Cold', 'Warm', 'Sunny'], answer: 0 },
            { q: '"Weather" means...', opts: ['Mưa', 'Thời tiết', 'Gió'], answer: 1 }
        ]
    },
    {
        id: 'MhAaiamabQo', title: 'In the Classroom',
        channel: 'English Conversation', duration: '3:40', level: 'beginner',
        category: 'school', icon: '🏫',
        description: 'Learn classroom vocabulary and phrases.',
        vocabulary: [
            { word: 'teacher', phonetic: '/ˈtiː.tʃər/', meaning: 'giáo viên' },
            { word: 'student', phonetic: '/ˈstuː.dənt/', meaning: 'học sinh' },
            { word: 'book', phonetic: '/bʊk/', meaning: 'sách' },
            { word: 'pencil', phonetic: '/ˈpen.səl/', meaning: 'bút chì' },
            { word: 'question', phonetic: '/ˈkwes.tʃən/', meaning: 'câu hỏi' }
        ],
        quiz: [
            { q: 'A _____ teaches students.', opts: ['Doctor', 'Teacher', 'Driver'], answer: 1 },
            { q: 'You write with a...', opts: ['Book', 'Pencil', 'Desk'], answer: 1 },
            { q: '"Question" means...', opts: ['Câu trả lời', 'Câu hỏi', 'Bài học'], answer: 1 }
        ]
    },
    {
        id: 'K75XMQClMIY', title: 'Body Parts Song',
        channel: 'Zen English', duration: '2:45', level: 'beginner',
        category: 'fun', icon: '🦴',
        description: 'Learn body parts with a catchy song.',
        vocabulary: [
            { word: 'head', phonetic: '/hed/', meaning: 'đầu' },
            { word: 'hand', phonetic: '/hænd/', meaning: 'bàn tay' },
            { word: 'eyes', phonetic: '/aɪz/', meaning: 'mắt' },
            { word: 'mouth', phonetic: '/maʊθ/', meaning: 'miệng' },
            { word: 'feet', phonetic: '/fiːt/', meaning: 'bàn chân' }
        ],
        quiz: [
            { q: 'You see with your...', opts: ['Ears', 'Eyes', 'Mouth'], answer: 1 },
            { q: '"Hand" means...', opts: ['Chân', 'Bàn tay', 'Đầu'], answer: 1 },
            { q: 'Your _____ is at the top of your body.', opts: ['Feet', 'Hand', 'Head'], answer: 2 }
        ]
    },
    {
        id: 'TnYX8MKWjsk', title: 'Telling the Time',
        channel: 'VOA Learning English', duration: '4:10', level: 'beginner',
        category: 'daily-life', icon: '🕐',
        description: 'Learn how to tell time and ask "What time is it?"',
        vocabulary: [
            { word: 'clock', phonetic: '/klɑːk/', meaning: 'đồng hồ' },
            { word: 'hour', phonetic: '/aʊr/', meaning: 'giờ' },
            { word: 'minute', phonetic: '/ˈmɪn.ɪt/', meaning: 'phút' },
            { word: 'morning', phonetic: '/ˈmɔːr.nɪŋ/', meaning: 'buổi sáng' },
            { word: 'afternoon', phonetic: '/ˌæf.tərˈnuːn/', meaning: 'buổi chiều' }
        ],
        quiz: [
            { q: 'One hour has _____ minutes.', opts: ['30', '60', '100'], answer: 1 },
            { q: '8 AM is in the...', opts: ['Morning', 'Afternoon', 'Night'], answer: 0 },
            { q: '"Clock" means...', opts: ['Đồng hồ', 'Thời gian', 'Ngày'], answer: 0 }
        ]
    },
    {
        id: 'uR4E-WnaAMM', title: 'How to Say English Sounds',
        channel: 'Pronunciation Pro', duration: '5:20', level: 'beginner',
        category: 'pronunciation', icon: '🗣️',
        description: 'Practice basic English pronunciation and sounds.',
        vocabulary: [
            { word: 'sound', phonetic: '/saʊnd/', meaning: 'âm thanh' },
            { word: 'speak', phonetic: '/spiːk/', meaning: 'nói' },
            { word: 'listen', phonetic: '/ˈlɪs.ən/', meaning: 'nghe' },
            { word: 'practice', phonetic: '/ˈpræk.tɪs/', meaning: 'luyện tập' },
            { word: 'pronounce', phonetic: '/prəˈnaʊns/', meaning: 'phát âm' }
        ],
        quiz: [
            { q: '"Listen" means...', opts: ['Nói', 'Nghe', 'Đọc'], answer: 1 },
            { q: 'To get better, you need to...', opts: ['Sleep', 'Practice', 'Eat'], answer: 1 },
            { q: '"Speak" is similar to...', opts: ['Walk', 'Talk', 'Run'], answer: 1 }
        ]
    },
    {
        id: 'r2Ryt7fj7V8', title: 'Feelings & Emotions',
        channel: 'Rachel\'s English', duration: '4:45', level: 'beginner',
        category: 'daily-life', icon: '😊',
        description: 'Express your feelings - happy, sad, angry, excited.',
        vocabulary: [
            { word: 'happy', phonetic: '/ˈhæp.i/', meaning: 'vui' },
            { word: 'sad', phonetic: '/sæd/', meaning: 'buồn' },
            { word: 'angry', phonetic: '/ˈæŋ.ɡri/', meaning: 'tức giận' },
            { word: 'scared', phonetic: '/skerd/', meaning: 'sợ hãi' },
            { word: 'excited', phonetic: '/ɪkˈsaɪ.tɪd/', meaning: 'hào hứng' }
        ],
        quiz: [
            { q: 'The opposite of "happy" is...', opts: ['Excited', 'Sad', 'Angry'], answer: 1 },
            { q: 'When you are afraid, you feel...', opts: ['Happy', 'Angry', 'Scared'], answer: 2 },
            { q: '"Excited" means...', opts: ['Buồn', 'Hào hứng', 'Mệt'], answer: 1 }
        ]
    },

    // ==================== ELEMENTARY (12 videos) ====================
    {
        id: 'OCLXF2D0jM4', title: 'Ordering at a Restaurant',
        channel: 'BBC 6 Minute English', duration: '6:00', level: 'elementary',
        category: 'daily-life', icon: '🍽️',
        description: 'Practice ordering food and drinks at a restaurant.',
        vocabulary: [
            { word: 'menu', phonetic: '/ˈmen.juː/', meaning: 'thực đơn' },
            { word: 'order', phonetic: '/ˈɔːr.dər/', meaning: 'gọi món' },
            { word: 'waiter', phonetic: '/ˈweɪ.tər/', meaning: 'người phục vụ' },
            { word: 'bill', phonetic: '/bɪl/', meaning: 'hóa đơn' },
            { word: 'tip', phonetic: '/tɪp/', meaning: 'tiền boa' }
        ],
        quiz: [
            { q: 'A "waiter" works at a...', opts: ['Hospital', 'Restaurant', 'School'], answer: 1 },
            { q: 'You ask for the _____ to pay.', opts: ['Menu', 'Bill', 'Tip'], answer: 1 },
            { q: '"Order" in a restaurant means...', opts: ['Ra lệnh', 'Gọi món', 'Nấu ăn'], answer: 1 }
        ]
    },
    {
        id: 'ngo8RF1Tjb8', title: 'Asking for Directions',
        channel: 'Accent\'s Way', duration: '5:30', level: 'elementary',
        category: 'travel', icon: '🗺️',
        description: 'How to ask and give directions in English.',
        vocabulary: [
            { word: 'turn left', phonetic: '/tɜːrn left/', meaning: 'rẽ trái' },
            { word: 'turn right', phonetic: '/tɜːrn raɪt/', meaning: 'rẽ phải' },
            { word: 'straight', phonetic: '/streɪt/', meaning: 'thẳng' },
            { word: 'near', phonetic: '/nɪr/', meaning: 'gần' },
            { word: 'far', phonetic: '/fɑːr/', meaning: 'xa' }
        ],
        quiz: [
            { q: 'The opposite of "left" is...', opts: ['Up', 'Right', 'Down'], answer: 1 },
            { q: '"Go straight" means...', opts: ['Rẽ phải', 'Đi thẳng', 'Quay lại'], answer: 1 },
            { q: '"Near" is the opposite of...', opts: ['Close', 'Far', 'Here'], answer: 1 }
        ]
    },
    {
        id: 'JtrNmhzAGds', title: 'At the Airport',
        channel: 'Oxford English Now', duration: '5:15', level: 'elementary',
        category: 'travel', icon: '✈️',
        description: 'Essential English for traveling by plane.',
        vocabulary: [
            { word: 'passport', phonetic: '/ˈpæs.pɔːrt/', meaning: 'hộ chiếu' },
            { word: 'flight', phonetic: '/flaɪt/', meaning: 'chuyến bay' },
            { word: 'gate', phonetic: '/ɡeɪt/', meaning: 'cổng/cửa' },
            { word: 'luggage', phonetic: '/ˈlʌɡ.ɪdʒ/', meaning: 'hành lý' },
            { word: 'boarding pass', phonetic: '/ˈbɔːr.dɪŋ pæs/', meaning: 'thẻ lên máy bay' }
        ],
        quiz: [
            { q: 'You need a _____ to travel abroad.', opts: ['Ticket', 'Passport', 'Map'], answer: 1 },
            { q: '"Luggage" is your...', opts: ['Food', 'Bags', 'Ticket'], answer: 1 },
            { q: 'A "flight" is a trip by...', opts: ['Car', 'Plane', 'Bus'], answer: 1 }
        ]
    },
    {
        id: 'ZiMhsXhtBOs', title: 'Shopping for Clothes',
        channel: 'mmmEnglish', duration: '5:45', level: 'elementary',
        category: 'daily-life', icon: '👕',
        description: 'Learn to shop for clothes - sizes, colors, and prices.',
        vocabulary: [
            { word: 'size', phonetic: '/saɪz/', meaning: 'kích cỡ' },
            { word: 'try on', phonetic: '/traɪ ɑːn/', meaning: 'thử đồ' },
            { word: 'fitting room', phonetic: '/ˈfɪt.ɪŋ ruːm/', meaning: 'phòng thử đồ' },
            { word: 'discount', phonetic: '/ˈdɪs.kaʊnt/', meaning: 'giảm giá' },
            { word: 'receipt', phonetic: '/rɪˈsiːt/', meaning: 'hóa đơn' }
        ],
        quiz: [
            { q: 'Before buying, you should _____ clothes.', opts: ['Wash', 'Try on', 'Return'], answer: 1 },
            { q: 'A "discount" means the price is...', opts: ['Higher', 'Lower', 'Same'], answer: 1 },
            { q: '"Size" means...', opts: ['Màu sắc', 'Kích cỡ', 'Chất liệu'], answer: 1 }
        ]
    },
    {
        id: 'mvGw2jASaA8', title: 'Making a Phone Call',
        channel: 'Business English', duration: '4:50', level: 'elementary',
        category: 'daily-life', icon: '📱',
        description: 'Practice phone conversation skills in English.',
        vocabulary: [
            { word: 'call', phonetic: '/kɔːl/', meaning: 'gọi điện' },
            { word: 'message', phonetic: '/ˈmes.ɪdʒ/', meaning: 'tin nhắn' },
            { word: 'hold on', phonetic: '/hoʊld ɑːn/', meaning: 'chờ một chút' },
            { word: 'hang up', phonetic: '/hæŋ ʌp/', meaning: 'cúp máy' },
            { word: 'busy', phonetic: '/ˈbɪz.i/', meaning: 'bận' }
        ],
        quiz: [
            { q: '"Hold on" means...', opts: ['Giữ chặt', 'Chờ một chút', 'Cúp máy'], answer: 1 },
            { q: 'When you finish a call, you...', opts: ['Hold on', 'Hang up', 'Call back'], answer: 1 },
            { q: 'If someone can\'t talk, they are...', opts: ['Free', 'Busy', 'Happy'], answer: 1 }
        ]
    },
    {
        id: 'IaiwHAFDXRk', title: 'Past Tense Made Easy',
        channel: 'Rachel\'s English', duration: '6:00', level: 'elementary',
        category: 'grammar', icon: '📖',
        description: 'Learn how to talk about things that happened in the past.',
        vocabulary: [
            { word: 'went', phonetic: '/went/', meaning: 'đã đi' },
            { word: 'ate', phonetic: '/eɪt/', meaning: 'đã ăn' },
            { word: 'saw', phonetic: '/sɔː/', meaning: 'đã thấy' },
            { word: 'yesterday', phonetic: '/ˈjes.tər.deɪ/', meaning: 'hôm qua' },
            { word: 'ago', phonetic: '/əˈɡoʊ/', meaning: 'trước đây' }
        ],
        quiz: [
            { q: 'The past tense of "go" is...', opts: ['Goed', 'Went', 'Gone'], answer: 1 },
            { q: '"Yesterday" means...', opts: ['Hôm nay', 'Hôm qua', 'Ngày mai'], answer: 1 },
            { q: '"I _____ a movie last night."', opts: ['See', 'Seed', 'Saw'], answer: 2 }
        ]
    },
    {
        id: '6Qw8EAVE4ik', title: 'Hobbies & Free Time',
        channel: 'FluentU English', duration: '4:20', level: 'elementary',
        category: 'daily-life', icon: '🎮',
        description: 'Talk about your hobbies and what you like to do.',
        vocabulary: [
            { word: 'hobby', phonetic: '/ˈhɑː.bi/', meaning: 'sở thích' },
            { word: 'enjoy', phonetic: '/ɪnˈdʒɔɪ/', meaning: 'thưởng thức' },
            { word: 'reading', phonetic: '/ˈriː.dɪŋ/', meaning: 'đọc sách' },
            { word: 'swimming', phonetic: '/ˈswɪm.ɪŋ/', meaning: 'bơi lội' },
            { word: 'painting', phonetic: '/ˈpeɪn.tɪŋ/', meaning: 'vẽ tranh' }
        ],
        quiz: [
            { q: 'A "hobby" is something you do for...', opts: ['Work', 'Fun', 'School'], answer: 1 },
            { q: '"Enjoy" means...', opts: ['Ghét', 'Thưởng thức', 'Ngừng'], answer: 1 },
            { q: 'Which is a water activity?', opts: ['Reading', 'Painting', 'Swimming'], answer: 2 }
        ]
    },
    {
        id: 'A8uB7EPJQYI', title: 'Describing People',
        channel: 'FluentU English', duration: '4:40', level: 'elementary',
        category: 'daily-life', icon: '🧑',
        description: 'Learn adjectives to describe how people look and act.',
        vocabulary: [
            { word: 'tall', phonetic: '/tɔːl/', meaning: 'cao' },
            { word: 'short', phonetic: '/ʃɔːrt/', meaning: 'thấp/ngắn' },
            { word: 'beautiful', phonetic: '/ˈbjuː.tɪ.fəl/', meaning: 'đẹp' },
            { word: 'kind', phonetic: '/kaɪnd/', meaning: 'tốt bụng' },
            { word: 'funny', phonetic: '/ˈfʌn.i/', meaning: 'hài hước' }
        ],
        quiz: [
            { q: 'The opposite of "tall" is...', opts: ['Big', 'Short', 'Fat'], answer: 1 },
            { q: 'A "funny" person makes you...', opts: ['Cry', 'Laugh', 'Sleep'], answer: 1 },
            { q: '"Kind" means...', opts: ['Xấu', 'Tốt bụng', 'Buồn'], answer: 1 }
        ]
    },
    {
        id: 'dMLHx7JE76s', title: 'At the Doctor',
        channel: 'FluentU English', duration: '5:10', level: 'elementary',
        category: 'daily-life', icon: '🏥',
        description: 'Health vocabulary and talking to a doctor.',
        vocabulary: [
            { word: 'sick', phonetic: '/sɪk/', meaning: 'ốm/bệnh' },
            { word: 'headache', phonetic: '/ˈhed.eɪk/', meaning: 'đau đầu' },
            { word: 'medicine', phonetic: '/ˈmed.ɪ.sən/', meaning: 'thuốc' },
            { word: 'fever', phonetic: '/ˈfiː.vər/', meaning: 'sốt' },
            { word: 'healthy', phonetic: '/ˈhel.θi/', meaning: 'khỏe mạnh' }
        ],
        quiz: [
            { q: 'When you have a high temperature, you have a...', opts: ['Headache', 'Fever', 'Cough'], answer: 1 },
            { q: '"Medicine" helps you get...', opts: ['Sicker', 'Better', 'Taller'], answer: 1 },
            { q: 'The opposite of "sick" is...', opts: ['Healthy', 'Tired', 'Sad'], answer: 0 }
        ]
    },
    {
        id: 'chH61UDwYpY', title: 'Nature & Environment',
        channel: 'PBS Nature', duration: '5:00', level: 'elementary',
        category: 'science', icon: '🌿',
        description: 'Learn about nature, plants and the environment.',
        vocabulary: [
            { word: 'tree', phonetic: '/triː/', meaning: 'cây' },
            { word: 'river', phonetic: '/ˈrɪv.ər/', meaning: 'sông' },
            { word: 'mountain', phonetic: '/ˈmaʊn.tən/', meaning: 'núi' },
            { word: 'forest', phonetic: '/ˈfɔːr.ɪst/', meaning: 'rừng' },
            { word: 'ocean', phonetic: '/ˈoʊ.ʃən/', meaning: 'đại dương' }
        ],
        quiz: [
            { q: 'A very large body of water is an...', opts: ['River', 'Lake', 'Ocean'], answer: 2 },
            { q: 'Many trees together form a...', opts: ['Garden', 'Forest', 'Park'], answer: 1 },
            { q: '"Mountain" means...', opts: ['Núi', 'Sông', 'Biển'], answer: 0 }
        ]
    },
    {
        id: 'S9zWp1frfUY', title: 'Famous Speeches - Simple',
        channel: 'English Speeches', duration: '5:30', level: 'elementary',
        category: 'culture', icon: '🎤',
        description: 'Listen to easy parts of famous English speeches.',
        vocabulary: [
            { word: 'speech', phonetic: '/spiːtʃ/', meaning: 'bài phát biểu' },
            { word: 'dream', phonetic: '/driːm/', meaning: 'giấc mơ' },
            { word: 'believe', phonetic: '/bɪˈliːv/', meaning: 'tin tưởng' },
            { word: 'change', phonetic: '/tʃeɪndʒ/', meaning: 'thay đổi' },
            { word: 'together', phonetic: '/təˈɡeð.ər/', meaning: 'cùng nhau' }
        ],
        quiz: [
            { q: '"I have a _____" is a famous speech.', opts: ['Plan', 'Dream', 'Question'], answer: 1 },
            { q: '"Believe" means...', opts: ['Nghi ngờ', 'Tin tưởng', 'Quên'], answer: 1 },
            { q: '"Together" means doing things...', opts: ['Alone', 'With others', 'Later'], answer: 1 }
        ]
    },
    {
        id: 'zgjfrQEr9sA', title: 'Fun Facts in English',
        channel: 'Mental Floss', duration: '4:30', level: 'elementary',
        category: 'fun', icon: '🧠',
        description: 'Learn surprising facts while practicing English.',
        vocabulary: [
            { word: 'fact', phonetic: '/fækt/', meaning: 'sự thật' },
            { word: 'amazing', phonetic: '/əˈmeɪ.zɪŋ/', meaning: 'tuyệt vời' },
            { word: 'discover', phonetic: '/dɪˈskʌv.ər/', meaning: 'khám phá' },
            { word: 'world', phonetic: '/wɜːrld/', meaning: 'thế giới' },
            { word: 'interesting', phonetic: '/ˈɪn.trə.stɪŋ/', meaning: 'thú vị' }
        ],
        quiz: [
            { q: '"Amazing" means something is very...', opts: ['Boring', 'Wonderful', 'Scary'], answer: 1 },
            { q: '"Discover" means to...', opts: ['Lose', 'Find', 'Forget'], answer: 1 },
            { q: 'A "fact" is something that is...', opts: ['False', 'True', 'Funny'], answer: 1 }
        ]
    },

    // ==================== INTERMEDIATE (13 videos) ====================
    {
        id: '3AV2Mvjv1JY', title: 'Movie Scene: Hotel Check-in',
        channel: 'Learn English with TV', duration: '5:00', level: 'intermediate',
        category: 'movies', icon: '🏨',
        description: 'Practice hotel vocabulary from a real movie scene.',
        vocabulary: [
            { word: 'reservation', phonetic: '/ˌrez.ərˈveɪ.ʃən/', meaning: 'đặt trước' },
            { word: 'check in', phonetic: '/tʃek ɪn/', meaning: 'làm thủ tục' },
            { word: 'available', phonetic: '/əˈveɪ.lə.bəl/', meaning: 'còn trống' },
            { word: 'suite', phonetic: '/swiːt/', meaning: 'phòng hạng sang' },
            { word: 'receptionist', phonetic: '/rɪˈsep.ʃən.ɪst/', meaning: 'lễ tân' },
            { word: 'accommodation', phonetic: '/əˌkɑː.məˈdeɪ.ʃən/', meaning: 'chỗ ở' },
            { word: 'complimentary', phonetic: '/ˌkɑːm.plɪˈmen.tər.i/', meaning: 'miễn phí' }
        ],
        quiz: [
            { q: 'You make a _____ before arriving at a hotel.', opts: ['Payment', 'Reservation', 'Complaint'], answer: 1 },
            { q: 'The _____ welcomes guests at the front desk.', opts: ['Chef', 'Receptionist', 'Cleaner'], answer: 1 },
            { q: '"Available" means...', opts: ['Busy', 'Full', 'Free to use'], answer: 2 }
        ]
    },
    {
        id: 'P6FORpg0KVo', title: 'TED Talk: The Power of Reading',
        channel: 'TED Talks', duration: '6:00', level: 'intermediate',
        category: 'culture', icon: '📚',
        description: 'An inspiring talk about why reading matters.',
        vocabulary: [
            { word: 'imagination', phonetic: '/ɪˌmædʒ.ɪˈneɪ.ʃən/', meaning: 'trí tưởng tượng' },
            { word: 'knowledge', phonetic: '/ˈnɑː.lɪdʒ/', meaning: 'kiến thức' },
            { word: 'inspire', phonetic: '/ɪnˈspaɪr/', meaning: 'truyền cảm hứng' },
            { word: 'opportunity', phonetic: '/ˌɑː.pərˈtuː.nə.ti/', meaning: 'cơ hội' },
            { word: 'perspective', phonetic: '/pərˈspek.tɪv/', meaning: 'góc nhìn' }
        ],
        quiz: [
            { q: '"Imagination" helps you...', opts: ['Sleep better', 'Create new ideas', 'Run faster'], answer: 1 },
            { q: '"Knowledge" comes from...', opts: ['Sleeping', 'Learning', 'Eating'], answer: 1 },
            { q: '"Inspire" means to...', opts: ['Discourage', 'Motivate', 'Confuse'], answer: 1 }
        ]
    },
    {
        id: '-ZRsLhaukn8', title: 'How Things Are Made',
        channel: 'Crash Course', duration: '5:30', level: 'intermediate',
        category: 'science', icon: '🏭',
        description: 'Learn about manufacturing and how everyday items are made.',
        vocabulary: [
            { word: 'manufacture', phonetic: '/ˌmæn.jəˈfæk.tʃər/', meaning: 'sản xuất' },
            { word: 'process', phonetic: '/ˈprɑː.ses/', meaning: 'quy trình' },
            { word: 'material', phonetic: '/məˈtɪr.i.əl/', meaning: 'nguyên liệu' },
            { word: 'design', phonetic: '/dɪˈzaɪn/', meaning: 'thiết kế' },
            { word: 'quality', phonetic: '/ˈkwɑː.lə.ti/', meaning: 'chất lượng' }
        ],
        quiz: [
            { q: '"Material" is what something is _____ of.', opts: ['Made', 'Sold', 'Bought'], answer: 0 },
            { q: '"Quality" describes how _____ something is.', opts: ['Big', 'Good', 'Fast'], answer: 1 },
            { q: '"Process" means...', opts: ['Kết quả', 'Quy trình', 'Sản phẩm'], answer: 1 }
        ]
    },
    {
        id: 'up8BUFWtRhM', title: 'Amazing Planet Earth',
        channel: 'National Geographic', duration: '5:45', level: 'intermediate',
        category: 'science', icon: '🌍',
        description: 'Explore our planet with stunning visuals and narration.',
        vocabulary: [
            { word: 'species', phonetic: '/ˈspiː.ʃiːz/', meaning: 'loài' },
            { word: 'habitat', phonetic: '/ˈhæb.ɪ.tæt/', meaning: 'môi trường sống' },
            { word: 'ecosystem', phonetic: '/ˈiː.koʊˌsɪs.təm/', meaning: 'hệ sinh thái' },
            { word: 'survive', phonetic: '/sərˈvaɪv/', meaning: 'sống sót' },
            { word: 'extinct', phonetic: '/ɪkˈstɪŋkt/', meaning: 'tuyệt chủng' }
        ],
        quiz: [
            { q: 'A "habitat" is where an animal...', opts: ['Eats', 'Lives', 'Sleeps'], answer: 1 },
            { q: 'Dinosaurs are now...', opts: ['Alive', 'Extinct', 'Small'], answer: 1 },
            { q: '"Survive" means to...', opts: ['Die', 'Stay alive', 'Run away'], answer: 1 }
        ]
    },
    {
        id: 'onfvACq-ZSc', title: 'Understanding Song Lyrics',
        channel: 'Music English', duration: '3:30', level: 'intermediate',
        category: 'music', icon: '🎵',
        description: 'Learn English expressions through popular song lyrics.',
        vocabulary: [
            { word: 'lyrics', phonetic: '/ˈlɪr.ɪks/', meaning: 'lời bài hát' },
            { word: 'chorus', phonetic: '/ˈkɔːr.əs/', meaning: 'điệp khúc' },
            { word: 'rhythm', phonetic: '/ˈrɪð.əm/', meaning: 'nhịp điệu' },
            { word: 'melody', phonetic: '/ˈmel.ə.di/', meaning: 'giai điệu' },
            { word: 'verse', phonetic: '/vɜːrs/', meaning: 'câu/đoạn thơ' }
        ],
        quiz: [
            { q: 'The words of a song are called...', opts: ['Notes', 'Lyrics', 'Melody'], answer: 1 },
            { q: 'The part that repeats is the...', opts: ['Verse', 'Bridge', 'Chorus'], answer: 2 },
            { q: '"Rhythm" means...', opts: ['Âm lượng', 'Nhịp điệu', 'Lời hát'], answer: 1 }
        ]
    },
    {
        id: 'idT98H8TK-U', title: 'Job Interview English',
        channel: 'English Addict', duration: '6:00', level: 'intermediate',
        category: 'daily-life', icon: '💼',
        description: 'Practice common job interview questions and answers.',
        vocabulary: [
            { word: 'experience', phonetic: '/ɪkˈspɪr.i.əns/', meaning: 'kinh nghiệm' },
            { word: 'strength', phonetic: '/streŋθ/', meaning: 'điểm mạnh' },
            { word: 'weakness', phonetic: '/ˈwiːk.nəs/', meaning: 'điểm yếu' },
            { word: 'salary', phonetic: '/ˈsæl.ər.i/', meaning: 'lương' },
            { word: 'qualified', phonetic: '/ˈkwɑː.lɪ.faɪd/', meaning: 'đủ điều kiện' }
        ],
        quiz: [
            { q: '"Experience" means your past...', opts: ['Education', 'Work history', 'Age'], answer: 1 },
            { q: 'The opposite of "strength" is...', opts: ['Power', 'Weakness', 'Skill'], answer: 1 },
            { q: '"Salary" is the _____ you earn.', opts: ['Time', 'Money', 'Points'], answer: 1 }
        ]
    },
    {
        id: 'PZTeilj-kN4', title: 'Movie Scene: Making Friends',
        channel: 'Learn English with TV', duration: '4:30', level: 'intermediate',
        category: 'movies', icon: '🤝',
        description: 'Watch how characters in movies make new friends.',
        vocabulary: [
            { word: 'introduce', phonetic: '/ˌɪn.trəˈduːs/', meaning: 'giới thiệu' },
            { word: 'common', phonetic: '/ˈkɑː.mən/', meaning: 'chung' },
            { word: 'personality', phonetic: '/ˌpɜːr.sənˈæl.ə.ti/', meaning: 'tính cách' },
            { word: 'trust', phonetic: '/trʌst/', meaning: 'tin tưởng' },
            { word: 'support', phonetic: '/səˈpɔːrt/', meaning: 'ủng hộ' },
            { word: 'acquaintance', phonetic: '/əˈkweɪn.təns/', meaning: 'người quen' },
            { word: 'bond', phonetic: '/bɑːnd/', meaning: 'sự gắn kết' }
        ],
        quiz: [
            { q: 'When you _____ someone, you tell others their name.', opts: ['Support', 'Introduce', 'Trust'], answer: 1 },
            { q: 'Good friends _____ each other.', opts: ['Ignore', 'Support', 'Judge'], answer: 1 },
            { q: '"Common" interests means you both...', opts: ['Dislike it', 'Like the same thing', 'Compete'], answer: 1 }
        ]
    },
    {
        id: 'O4LLfwTbuq8', title: 'English Idioms Explained',
        channel: 'BBC Learning English', duration: '5:00', level: 'intermediate',
        category: 'grammar', icon: '💡',
        description: 'Learn common English idioms with fun examples.',
        vocabulary: [
            { word: 'break a leg', phonetic: '', meaning: 'chúc may mắn' },
            { word: 'piece of cake', phonetic: '', meaning: 'dễ như ăn bánh' },
            { word: 'hit the books', phonetic: '', meaning: 'học bài chăm chỉ' },
            { word: 'under the weather', phonetic: '', meaning: 'không khỏe' },
            { word: 'cost an arm and a leg', phonetic: '', meaning: 'rất đắt đỏ' },
            { word: 'spill the beans', phonetic: '', meaning: 'tiết lộ bí mật' },
            { word: 'once in a blue moon', phonetic: '', meaning: 'hiếm khi/rất hiếm' }
        ],
        quiz: [
            { q: '"Piece of cake" means something is...', opts: ['Delicious', 'Easy', 'Expensive'], answer: 1 },
            { q: '"Under the weather" means feeling...', opts: ['Happy', 'Sick', 'Cold'], answer: 1 },
            { q: '"Break a leg" is said to wish someone...', opts: ['Bad luck', 'Good luck', 'Pain'], answer: 1 }
        ]
    },
    {
        id: 'VNPjd0jNVGI', title: 'Comparing Things in English',
        channel: 'English with Lucy', duration: '5:30', level: 'intermediate',
        category: 'grammar', icon: '⚖️',
        description: 'Master comparatives and superlatives.',
        vocabulary: [
            { word: 'bigger', phonetic: '/ˈbɪɡ.ər/', meaning: 'lớn hơn' },
            { word: 'the best', phonetic: '/ðə best/', meaning: 'tốt nhất' },
            { word: 'more expensive', phonetic: '', meaning: 'đắt hơn' },
            { word: 'less', phonetic: '/les/', meaning: 'ít hơn' },
            { word: 'similar', phonetic: '/ˈsɪm.ə.lər/', meaning: 'tương tự' }
        ],
        quiz: [
            { q: 'An elephant is _____ than a cat.', opts: ['Small', 'Bigger', 'Faster'], answer: 1 },
            { q: '"The best" means the _____ of all.', opts: ['Worst', 'Good', 'Most good'], answer: 2 },
            { q: '"Less" is the opposite of...', opts: ['More', 'Fewer', 'Little'], answer: 0 }
        ]
    },
    {
        id: 'CI0Kr4e4vzI', title: 'Talking About the Future',
        channel: 'EasyTeaching', duration: '5:15', level: 'intermediate',
        category: 'grammar', icon: '🔮',
        description: 'Will, going to, and other future tense expressions.',
        vocabulary: [
            { word: 'will', phonetic: '/wɪl/', meaning: 'sẽ' },
            { word: 'plan', phonetic: '/plæn/', meaning: 'kế hoạch' },
            { word: 'predict', phonetic: '/prɪˈdɪkt/', meaning: 'dự đoán' },
            { word: 'probably', phonetic: '/ˈprɑː.bə.bli/', meaning: 'có lẽ' },
            { word: 'definitely', phonetic: '/ˈdef.ɪ.nət.li/', meaning: 'chắc chắn' }
        ],
        quiz: [
            { q: '"I will go" talks about the...', opts: ['Past', 'Present', 'Future'], answer: 2 },
            { q: '"Probably" means it is...', opts: ['Certain', 'Likely', 'Impossible'], answer: 1 },
            { q: '"Definitely" means you are very...', opts: ['Unsure', 'Sure', 'Scared'], answer: 1 }
        ]
    },
    {
        id: 'k_d2Vxc6No8', title: 'Movie Scene: Funny Moments',
        channel: 'Learn English with TV', duration: '4:45', level: 'intermediate',
        category: 'movies', icon: '😂',
        description: 'Learn humor and comedy expressions from movie scenes.',
        vocabulary: [
            { word: 'hilarious', phonetic: '/hɪˈler.i.əs/', meaning: 'cực kỳ hài' },
            { word: 'joke', phonetic: '/dʒoʊk/', meaning: 'câu đùa' },
            { word: 'punchline', phonetic: '/ˈpʌntʃ.laɪn/', meaning: 'câu chốt hài' },
            { word: 'sarcasm', phonetic: '/ˈsɑːr.kæz.əm/', meaning: 'mỉa mai' },
            { word: 'witty', phonetic: '/ˈwɪt.i/', meaning: 'hài hước/dí dỏm' },
            { word: 'crack up', phonetic: '/kræk ʌp/', meaning: 'cười bể bụng' },
            { word: 'absurd', phonetic: '/əbˈsɜːrd/', meaning: 'vô lý/phi lý' }
        ],
        quiz: [
            { q: '"Hilarious" means very...', opts: ['Sad', 'Funny', 'Scary'], answer: 1 },
            { q: 'The funny ending of a joke is the...', opts: ['Start', 'Middle', 'Punchline'], answer: 2 },
            { q: '"Sarcasm" means saying the _____ of what you mean.', opts: ['Same', 'Opposite', 'Nothing'], answer: 1 }
        ]
    },
    {
        id: 'ffqp6f0_rzw', title: 'Debate: Is Social Media Good?',
        channel: 'BBC Learning English', duration: '6:00', level: 'intermediate',
        category: 'culture', icon: '📲',
        description: 'Listen to arguments for and against social media.',
        vocabulary: [
            { word: 'advantage', phonetic: '/ədˈvæn.tɪdʒ/', meaning: 'ưu điểm' },
            { word: 'disadvantage', phonetic: '/ˌdɪs.ədˈvæn.tɪdʒ/', meaning: 'nhược điểm' },
            { word: 'addiction', phonetic: '/əˈdɪk.ʃən/', meaning: 'nghiện' },
            { word: 'connection', phonetic: '/kəˈnek.ʃən/', meaning: 'kết nối' },
            { word: 'privacy', phonetic: '/ˈpraɪ.və.si/', meaning: 'sự riêng tư' }
        ],
        quiz: [
            { q: 'An "advantage" is something...', opts: ['Bad', 'Good', 'Boring'], answer: 1 },
            { q: '"Privacy" means keeping things...', opts: ['Public', 'Private', 'Shared'], answer: 1 },
            { q: '"Addiction" means you _____ stop.', opts: ['Can easily', 'Can\'t', 'Want to'], answer: 1 }
        ]
    },
    {
        id: 'xvf23ZCPgFQ', title: 'English Slang Explained',
        channel: 'English Fluency Journey', duration: '4:50', level: 'intermediate',
        category: 'culture', icon: '🗯️',
        description: 'Understand modern English slang words and phrases.',
        vocabulary: [
            { word: 'chill', phonetic: '/tʃɪl/', meaning: 'thư giãn' },
            { word: 'ghost', phonetic: '/ɡoʊst/', meaning: 'bỏ rơi (lặng)' },
            { word: 'vibe', phonetic: '/vaɪb/', meaning: 'cảm giác/không khí' },
            { word: 'slay', phonetic: '/sleɪ/', meaning: 'làm tốt lắm' },
            { word: 'no cap', phonetic: '', meaning: 'không nói dối' }
        ],
        quiz: [
            { q: '"Chill" in slang means to...', opts: ['Be cold', 'Relax', 'Run'], answer: 1 },
            { q: '"Ghost someone" means to...', opts: ['Scare them', 'Stop replying', 'Help them'], answer: 1 },
            { q: '"Good vibes" means a _____ feeling.', opts: ['Bad', 'Positive', 'Scary'], answer: 1 }
        ]
    },

    // ==================== UPPER-INTERMEDIATE (6 videos) ====================
    {
        id: 'x3Yx2fj-AEs', title: 'TED: The Science of Happiness',
        channel: 'TED Talks', duration: '6:00', level: 'upper',
        category: 'culture', icon: '🧪',
        description: 'What does science say about being happy?',
        vocabulary: [
            { word: 'contentment', phonetic: '/kənˈtent.mənt/', meaning: 'sự hài lòng' },
            { word: 'gratitude', phonetic: '/ˈɡræt.ɪ.tuːd/', meaning: 'lòng biết ơn' },
            { word: 'resilience', phonetic: '/rɪˈzɪl.jəns/', meaning: 'khả năng phục hồi' },
            { word: 'mindfulness', phonetic: '/ˈmaɪnd.fəl.nəs/', meaning: 'sự chánh niệm' },
            { word: 'well-being', phonetic: '/ˌwelˈbiː.ɪŋ/', meaning: 'sức khỏe tinh thần' },
            { word: 'fulfillment', phonetic: '/fʊlˈfɪl.mənt/', meaning: 'sự viên mãn' },
            { word: 'compassion', phonetic: '/kəmˈpæʃ.ən/', meaning: 'lòng trắc ẩn' }
        ],
        quiz: [
            { q: '"Gratitude" means being...', opts: ['Greedy', 'Thankful', 'Angry'], answer: 1 },
            { q: '"Resilience" helps you _____ from difficulties.', opts: ['Run', 'Recover', 'Hide'], answer: 1 },
            { q: '"Well-being" refers to your overall...', opts: ['Wealth', 'Health and happiness', 'Intelligence'], answer: 1 }
        ]
    },
    {
        id: 'lQJKmRD1gYg', title: 'Business Negotiation Scene',
        channel: 'Business English Learning', duration: '5:30', level: 'upper',
        category: 'movies', icon: '🤝',
        description: 'Watch a tense business negotiation from a famous show.',
        vocabulary: [
            { word: 'negotiate', phonetic: '/nɪˈɡoʊ.ʃi.eɪt/', meaning: 'đàm phán' },
            { word: 'compromise', phonetic: '/ˈkɑːm.prə.maɪz/', meaning: 'thỏa hiệp' },
            { word: 'deadline', phonetic: '/ˈded.laɪn/', meaning: 'hạn chót' },
            { word: 'proposal', phonetic: '/prəˈpoʊ.zəl/', meaning: 'đề xuất' },
            { word: 'leverage', phonetic: '/ˈlev.ər.ɪdʒ/', meaning: 'đòn bẩy' },
            { word: 'stakeholder', phonetic: '/ˈsteɪkˌhoʊl.dər/', meaning: 'bên liên quan' },
            { word: 'bottom line', phonetic: '/ˈbɑː.təm laɪn/', meaning: 'điểm mấu chốt' }
        ],
        quiz: [
            { q: '"Compromise" means both sides...', opts: ['Win everything', 'Give up something', 'Fight more'], answer: 1 },
            { q: 'A "deadline" is the last...', opts: ['Day', 'Chance', 'Time to finish'], answer: 2 },
            { q: '"Negotiate" means to...', opts: ['Demand', 'Discuss terms', 'Give up'], answer: 1 }
        ]
    },
    {
        id: 'gAHUTKm_1n0', title: 'Advanced Pronunciation Tips',
        channel: 'English Pronunciation', duration: '6:00', level: 'upper',
        category: 'pronunciation', icon: '🎯',
        description: 'Master connected speech and natural pronunciation.',
        vocabulary: [
            { word: 'intonation', phonetic: '/ˌɪn.təˈneɪ.ʃən/', meaning: 'ngữ điệu' },
            { word: 'stress', phonetic: '/stres/', meaning: 'trọng âm' },
            { word: 'syllable', phonetic: '/ˈsɪl.ə.bəl/', meaning: 'âm tiết' },
            { word: 'linking', phonetic: '/ˈlɪŋ.kɪŋ/', meaning: 'nối âm' },
            { word: 'reduction', phonetic: '/rɪˈdʌk.ʃən/', meaning: 'rút gọn âm' }
        ],
        quiz: [
            { q: '"Intonation" is how your voice goes _____.', opts: ['Quiet', 'Up and down', 'Fast'], answer: 1 },
            { q: 'Word "stress" means saying a part...', opts: ['Louder', 'Softer', 'Slower'], answer: 0 },
            { q: '"Linking" in speech means...', opts: ['Pausing', 'Connecting sounds', 'Speaking slowly'], answer: 1 }
        ]
    },
    {
        id: 'lXgfX1y60Gw', title: 'Movie Scene: Courtroom Drama',
        channel: 'Learn English with TV', duration: '5:45', level: 'upper',
        category: 'movies', icon: '⚖️',
        description: 'Legal English from an intense courtroom movie scene.',
        vocabulary: [
            { word: 'evidence', phonetic: '/ˈev.ɪ.dəns/', meaning: 'bằng chứng' },
            { word: 'testimony', phonetic: '/ˈtes.tɪ.moʊ.ni/', meaning: 'lời khai' },
            { word: 'verdict', phonetic: '/ˈvɜːr.dɪkt/', meaning: 'phán quyết' },
            { word: 'objection', phonetic: '/əbˈdʒek.ʃən/', meaning: 'phản đối' },
            { word: 'justice', phonetic: '/ˈdʒʌs.tɪs/', meaning: 'công lý' },
            { word: 'prosecutor', phonetic: '/ˈprɑː.sɪ.kjuː.tər/', meaning: 'công tố viên' },
            { word: 'defendant', phonetic: '/dɪˈfen.dənt/', meaning: 'bị cáo' },
            { word: 'cross-examine', phonetic: '/krɔːs ɪɡˈzæm.ɪn/', meaning: 'thẩm vấn chéo' }
        ],
        quiz: [
            { q: '"Evidence" is used to _____ something.', opts: ['Hide', 'Prove', 'Forget'], answer: 1 },
            { q: 'The final decision in court is the...', opts: ['Objection', 'Testimony', 'Verdict'], answer: 2 },
            { q: '"Justice" means things are...', opts: ['Unfair', 'Fair', 'Fast'], answer: 1 }
        ]
    },
    {
        id: 'kIpaDW3RwtY', title: 'Academic Writing Tips',
        channel: 'Oxford English', duration: '6:00', level: 'upper',
        category: 'grammar', icon: '✍️',
        description: 'Improve your formal and academic writing skills.',
        vocabulary: [
            { word: 'thesis', phonetic: '/ˈθiː.sɪs/', meaning: 'luận điểm' },
            { word: 'argument', phonetic: '/ˈɑːr.ɡjə.mənt/', meaning: 'lập luận' },
            { word: 'furthermore', phonetic: '/ˌfɜːr.ðərˈmɔːr/', meaning: 'hơn nữa' },
            { word: 'consequently', phonetic: '/ˈkɑːn.sə.kwent.li/', meaning: 'do đó' },
            { word: 'conclude', phonetic: '/kənˈkluːd/', meaning: 'kết luận' }
        ],
        quiz: [
            { q: 'A "thesis" is the main...', opts: ['Question', 'Idea', 'Problem'], answer: 1 },
            { q: '"Furthermore" is used to...', opts: ['Disagree', 'Add more', 'Conclude'], answer: 1 },
            { q: '"Conclude" means to...', opts: ['Start', 'Continue', 'End/Finish'], answer: 2 }
        ]
    },
    {
        id: 'c9eZ5HktBiI', title: 'Understanding British Humor',
        channel: 'BBC Learning English', duration: '5:30', level: 'upper',
        category: 'culture', icon: '🇬🇧',
        description: 'Why British humor is dry, witty and hard to understand.',
        vocabulary: [
            { word: 'irony', phonetic: '/ˈaɪ.rə.ni/', meaning: 'sự mỉa mai' },
            { word: 'understatement', phonetic: '/ˈʌn.dər.steɪt.mənt/', meaning: 'nói giảm' },
            { word: 'deadpan', phonetic: '/ˈded.pæn/', meaning: 'mặt lạnh/vô cảm' },
            { word: 'self-deprecating', phonetic: '', meaning: 'tự chế giễu mình' },
            { word: 'subtle', phonetic: '/ˈsʌt.əl/', meaning: 'tinh tế/tế nhị' },
            { word: 'dry humor', phonetic: '/draɪ ˈhjuː.mər/', meaning: 'hài khô/hài nhạt' },
            { word: 'tongue-in-cheek', phonetic: '/tʌŋ ɪn tʃiːk/', meaning: 'nói đùa/châm biếm nhẹ' }
        ],
        quiz: [
            { q: '"Irony" means saying something _____ what you mean.', opts: ['Exactly', 'Similar to', 'Opposite to'], answer: 2 },
            { q: '"Subtle" humor is...', opts: ['Obvious and loud', 'Quiet and clever', 'Rude'], answer: 1 },
            { q: '"Self-deprecating" means making fun of...', opts: ['Others', 'Yourself', 'Animals'], answer: 1 }
        ]
    },

    // ==================== ADVANCED (4 videos) ====================
    {
        id: 'NdDU_BBJW9Y', title: 'TED: How Language Shapes Thinking',
        channel: 'TED Talks', duration: '6:00', level: 'advanced',
        category: 'science', icon: '🧠',
        description: 'Explore how different languages shape how we think.',
        vocabulary: [
            { word: 'cognitive', phonetic: '/ˈkɑːɡ.nə.tɪv/', meaning: 'nhận thức' },
            { word: 'perception', phonetic: '/pərˈsep.ʃən/', meaning: 'tri giác/cảm nhận' },
            { word: 'bilingual', phonetic: '/baɪˈlɪŋ.ɡwəl/', meaning: 'song ngữ' },
            { word: 'linguistic', phonetic: '/lɪŋˈɡwɪs.tɪk/', meaning: 'ngôn ngữ học' },
            { word: 'phenomenon', phonetic: '/fɪˈnɑː.mə.nɑːn/', meaning: 'hiện tượng' },
            { word: 'syntax', phonetic: '/ˈsɪn.tæks/', meaning: 'cú pháp' },
            { word: 'semantics', phonetic: '/sɪˈmæn.tɪks/', meaning: 'ngữ nghĩa học' }
        ],
        quiz: [
            { q: '"Bilingual" means speaking _____ languages.', opts: ['One', 'Two', 'Many'], answer: 1 },
            { q: '"Cognitive" relates to...', opts: ['Physical strength', 'Thinking', 'Emotions'], answer: 1 },
            { q: '"Phenomenon" means an observable...', opts: ['Problem', 'Event', 'Animal'], answer: 1 }
        ]
    },
    {
        id: 'WxZfg-r11vU', title: 'Shakespeare Made Simple',
        channel: 'Crash Course Literature', duration: '6:00', level: 'advanced',
        category: 'culture', icon: '🎭',
        description: 'Understand Shakespeare\'s language and lasting impact.',
        vocabulary: [
            { word: 'thou', phonetic: '/ðaʊ/', meaning: 'ngươi (cổ)' },
            { word: 'tragedy', phonetic: '/ˈtrædʒ.ə.di/', meaning: 'bi kịch' },
            { word: 'metaphor', phonetic: '/ˈmet.ə.fɔːr/', meaning: 'ẩn dụ' },
            { word: 'soliloquy', phonetic: '/səˈlɪl.ə.kwi/', meaning: 'độc thoại' },
            { word: 'eloquent', phonetic: '/ˈel.ə.kwənt/', meaning: 'hùng biện' },
            { word: 'iambic pentameter', phonetic: '/aɪˌæm.bɪk penˈtæm.ɪ.tər/', meaning: 'thể thơ ngũ bộ' },
            { word: 'protagonist', phonetic: '/proʊˈtæɡ.ə.nɪst/', meaning: 'nhân vật chính' }
        ],
        quiz: [
            { q: '"Thou" is an old English word for...', opts: ['I', 'You', 'They'], answer: 1 },
            { q: 'A "tragedy" ends...', opts: ['Happily', 'Sadly', 'Mysteriously'], answer: 1 },
            { q: 'A "metaphor" compares things...', opts: ['Using "like"', 'Without "like"', 'Using numbers'], answer: 1 }
        ]
    },
    {
        id: 'LOMbySJTKpg', title: 'Philosophical Debates in English',
        channel: 'Philosophy Tube', duration: '6:00', level: 'advanced',
        category: 'culture', icon: '🤔',
        description: 'Engage with deep philosophical ideas in English.',
        vocabulary: [
            { word: 'ethics', phonetic: '/ˈeθ.ɪks/', meaning: 'đạo đức' },
            { word: 'consciousness', phonetic: '/ˈkɑːn.ʃəs.nəs/', meaning: 'ý thức' },
            { word: 'existential', phonetic: '/ˌeɡ.zɪˈsten.ʃəl/', meaning: 'hiện sinh' },
            { word: 'paradox', phonetic: '/ˈpær.ə.dɑːks/', meaning: 'nghịch lý' },
            { word: 'hypothesis', phonetic: '/haɪˈpɑː.θə.sɪs/', meaning: 'giả thuyết' },
            { word: 'empirical', phonetic: '/ɪmˈpɪr.ɪ.kəl/', meaning: 'thực nghiệm' },
            { word: 'epistemology', phonetic: '/ɪˌpɪs.tɪˈmɑː.lə.dʒi/', meaning: 'nhận thức luận' }
        ],
        quiz: [
            { q: '"Ethics" is the study of...', opts: ['Science', 'Right and wrong', 'Language'], answer: 1 },
            { q: 'A "paradox" seems to _____ itself.', opts: ['Support', 'Contradict', 'Explain'], answer: 1 },
            { q: '"Hypothesis" is an educated...', opts: ['Answer', 'Guess', 'Fact'], answer: 1 }
        ]
    },
    {
        id: 'JwzdGxDXS8s', title: 'Advanced English: Nuance & Tone',
        channel: 'English with Lucy', duration: '5:45', level: 'advanced',
        category: 'grammar', icon: '🎓',
        description: 'Master the subtle differences in English expression.',
        vocabulary: [
            { word: 'nuance', phonetic: '/ˈnuː.ɑːns/', meaning: 'sắc thái' },
            { word: 'connotation', phonetic: '/ˌkɑː.nəˈteɪ.ʃən/', meaning: 'hàm ý/ý nghĩa ngầm' },
            { word: 'ambiguity', phonetic: '/ˌæm.bɪˈɡjuː.ə.ti/', meaning: 'sự mơ hồ' },
            { word: 'rhetoric', phonetic: '/ˈret.ər.ɪk/', meaning: 'tu từ học' },
            { word: 'eloquence', phonetic: '/ˈel.ə.kwəns/', meaning: 'sự hùng biện' },
            { word: 'euphemism', phonetic: '/ˈjuː.fə.mɪz.əm/', meaning: 'cách nói giảm nói tránh' },
            { word: 'colloquial', phonetic: '/kəˈloʊ.kwi.əl/', meaning: 'thông tục/khẩu ngữ' }
        ],
        quiz: [
            { q: '"Nuance" means a _____ difference.', opts: ['Huge', 'Subtle', 'Obvious'], answer: 1 },
            { q: '"Ambiguity" means something can be understood in...', opts: ['One way', 'Multiple ways', 'No way'], answer: 1 },
            { q: '"Connotation" is the _____ meaning of a word.', opts: ['Literal', 'Hidden/implied', 'Dictionary'], answer: 1 }
        ]
    }
];

// ==================== VIDEO LEVELS CONFIG ====================
const VIDEO_LEVELS = {
    beginner:     { name: 'Beginner',           icon: '🌱', color: '#4CAF50', gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
    elementary:   { name: 'Elementary',          icon: '🌿', color: '#2196F3', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    intermediate: { name: 'Intermediate',        icon: '🌳', color: '#FF9800', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    upper:        { name: 'Upper-Intermediate',  icon: '⭐', color: '#E91E63', gradient: 'linear-gradient(135deg, #ff6a00, #ee0979)' },
    advanced:     { name: 'Advanced',            icon: '🏆', color: '#9C27B0', gradient: 'linear-gradient(135deg, #6a11cb, #2575fc)' }
};

const VIDEO_CATEGORIES = {
    all:            { name: 'All',           icon: '🎬' },
    'daily-life':   { name: 'Daily Life',    icon: '🏠' },
    travel:         { name: 'Travel',        icon: '✈️' },
    movies:         { name: 'Movies',        icon: '🎥' },
    grammar:        { name: 'Grammar',       icon: '📖' },
    fun:            { name: 'Fun',           icon: '🎉' },
    school:         { name: 'School',        icon: '🏫' },
    science:        { name: 'Science',       icon: '🔬' },
    culture:        { name: 'Culture',       icon: '🌍' },
    music:          { name: 'Music',         icon: '🎵' },
    pronunciation:  { name: 'Pronunciation', icon: '🗣️' }
};

// ==================== STATE ====================
let videoState = {
    currentVideo: null,
    player: null,
    selectedLevel: 'all',
    selectedCategory: 'all',
    quizAnswers: [],
    quizStep: 0,
    apiReady: false
};

// ==================== YOUTUBE API ====================
function loadYouTubeAPI() {
    if (videoState.apiReady || document.getElementById('ytApiScript')) return;
    const tag = document.createElement('script');
    tag.id = 'ytApiScript';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function onYouTubeIframeAPIReady() {
    videoState.apiReady = true;
}

// ==================== VIDEO SCREEN (BROWSE) ====================
function switchToVideoScreen() {
    // Close any overlays
    document.querySelectorAll('.bubbles-overlay, .music-menu-overlay').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('videoScreen').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.target) event.target.closest('.nav-item')?.classList.add('active');

    renderVideoScreen();
}

function renderVideoScreen() {
    const container = document.getElementById('videoScreen');
    const stats = getVideoStats();
    const filtered = getFilteredVideos();

    const levelKeys = ['all', ...Object.keys(VIDEO_LEVELS)];
    const levelTabs = levelKeys.map(k => {
        const isAll = k === 'all';
        const lbl = isAll ? '🎬 All' : `${VIDEO_LEVELS[k].icon} ${VIDEO_LEVELS[k].name}`;
        const count = isAll ? VIDEO_LIBRARY.length : VIDEO_LIBRARY.filter(v => v.level === k).length;
        const active = videoState.selectedLevel === k ? 'active' : '';
        return `<button class="vl-tab ${active}" onclick="filterVideoLevel('${k}')">${lbl} <span class="vl-tab-count">${count}</span></button>`;
    }).join('');

    const catKeys = Object.keys(VIDEO_CATEGORIES);
    const catChips = catKeys.map(k => {
        const active = videoState.selectedCategory === k ? 'active' : '';
        return `<button class="vc-chip ${active}" onclick="filterVideoCategory('${k}')">${VIDEO_CATEGORIES[k].icon} ${VIDEO_CATEGORIES[k].name}</button>`;
    }).join('');

    const cards = filtered.map(v => {
        const level = VIDEO_LEVELS[v.level] || VIDEO_LEVELS.beginner;
        const watched = stats.watched.includes(v.id);
        const stars = stats.stars[v.id] || 0;
        const starStr = stars > 0 ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';
        const thumb = `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`;
        return `
        <div class="vc-card ${watched ? 'watched' : ''}" onclick="openVideoPlayer('${v.id}')">
            <div class="vc-thumb" style="background-image: url('${thumb}')">
                <div class="vc-play-icon">▶</div>
                <div class="vc-duration">${v.duration}</div>
                ${watched ? '<div class="vc-watched-badge">✅</div>' : ''}
            </div>
            <div class="vc-info">
                <div class="vc-title">${v.icon} ${v.title}</div>
                <div class="vc-meta">
                    <span class="vc-level-badge" style="background:${level.color}">${level.icon} ${level.name}</span>
                    ${starStr ? `<span class="vc-stars">${starStr}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    const watchedCount = stats.watched.length;
    const totalStars = Object.values(stats.stars).reduce((a, b) => a + b, 0);
    const maxStars = VIDEO_LIBRARY.length * 3;
    const wordsLearned = stats.wordsLearned.length;

    container.innerHTML = `
        <div class="vs-header">
            <div class="vs-title">🎬 Video Lessons</div>
            <div class="vs-stats-row">
                <div class="vs-stat"><span class="vs-stat-val">${watchedCount}</span><span class="vs-stat-lbl">Watched</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${totalStars}/${maxStars}</span><span class="vs-stat-lbl">Stars</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${wordsLearned}</span><span class="vs-stat-lbl">Words</span></div>
            </div>
        </div>
        <div class="vl-tabs-scroll">${levelTabs}</div>
        <div class="vc-chips-scroll">${catChips}</div>
        <div class="vc-grid">${cards || '<div class="vc-empty">No videos found for this filter.</div>'}</div>
    `;
}

function filterVideoLevel(level) {
    videoState.selectedLevel = level;
    renderVideoScreen();
}

function filterVideoCategory(cat) {
    videoState.selectedCategory = cat;
    renderVideoScreen();
}

function getFilteredVideos() {
    return VIDEO_LIBRARY.filter(v => {
        if (videoState.selectedLevel !== 'all' && v.level !== videoState.selectedLevel) return false;
        if (videoState.selectedCategory !== 'all' && v.category !== videoState.selectedCategory) return false;
        return true;
    });
}

// ==================== VIDEO PLAYER ====================
function openVideoPlayer(videoId) {
    const video = VIDEO_LIBRARY.find(v => v.id === videoId);
    if (!video) return;

    videoState.currentVideo = video;
    videoState.quizAnswers = [];
    videoState.quizStep = 0;

    loadYouTubeAPI();

    const overlay = document.getElementById('videoPlayerOverlay');
    overlay.classList.add('active');

    renderVideoPlayer();
}

function renderVideoPlayer() {
    const v = videoState.currentVideo;
    if (!v) return;
    const overlay = document.getElementById('videoPlayerOverlay');
    const level = VIDEO_LEVELS[v.level] || VIDEO_LEVELS.beginner;
    const stats = getVideoStats();
    const prevStars = stats.stars[v.id] || 0;

    const vocabHtml = v.vocabulary.map(w =>
        `<div class="vp-word" onclick="speakWord('${w.word.replace(/'/g, "\\'")}')">
            <div class="vp-word-en">${w.word} 🔊</div>
            <div class="vp-word-pho">${w.phonetic}</div>
            <div class="vp-word-vi">${w.meaning}</div>
        </div>`
    ).join('');

    overlay.innerHTML = `
        <div class="vp-container">
            <div class="vp-top-bar">
                <button class="vp-back" onclick="closeVideoPlayer()">← Back</button>
                <div class="vp-level-badge" style="background:${level.gradient}">${level.icon} ${level.name}</div>
                ${prevStars > 0 ? `<div class="vp-prev-stars">${'⭐'.repeat(prevStars)}</div>` : ''}
            </div>
            <div class="vp-title">${v.icon} ${v.title}</div>
            <div class="vp-channel">${v.channel} · ${v.duration}</div>

            <div class="vp-player-wrap">
                <div id="ytPlayerContainer"></div>
                <div class="vp-offline-msg" id="vpOfflineMsg" style="display:none;">
                    📡 Internet needed to play video
                </div>
            </div>

            <div class="vp-desc">${v.description}</div>

            <div class="vp-section-title">📚 Key Vocabulary</div>
            <div class="vp-words-grid">${vocabHtml}</div>

            <button class="vp-quiz-btn" onclick="startVideoQuiz()">🧠 Take Quiz (${v.quiz.length} questions)</button>
        </div>
    `;

    // Create YouTube player
    setTimeout(() => createYTPlayer(v.id), 100);
}

function createYTPlayer(videoId) {
    const container = document.getElementById('ytPlayerContainer');
    if (!container) return;

    if (videoState.player && typeof videoState.player.destroy === 'function') {
        videoState.player.destroy();
        videoState.player = null;
    }

    if (videoState.apiReady && typeof YT !== 'undefined' && YT.Player) {
        videoState.player = new YT.Player('ytPlayerContainer', {
            videoId: videoId,
            width: '100%',
            height: '100%',
            playerVars: {
                cc_load_policy: 1,
                cc_lang_pref: 'en',
                rel: 0,
                modestbranding: 1,
                playsinline: 1
            },
            events: {
                onError: (e) => {
                    const msg = document.getElementById('vpOfflineMsg');
                    if (msg) {
                        const code = e && e.data;
                        msg.textContent = code === 150 || code === 101
                            ? '🚫 This video is not available for embedding'
                            : '📡 Video unavailable - check your connection';
                        msg.style.display = 'flex';
                    }
                }
            }
        });
    } else {
        // API not ready yet, use iframe fallback
        container.innerHTML = `<iframe
            src="https://www.youtube.com/embed/${videoId}?cc_load_policy=1&cc_lang_pref=en&rel=0&modestbranding=1&playsinline=1"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            style="width:100%;height:100%;border-radius:12px;"
        ></iframe>`;
    }
}

function closeVideoPlayer() {
    const overlay = document.getElementById('videoPlayerOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';

    if (videoState.player && typeof videoState.player.destroy === 'function') {
        videoState.player.destroy();
        videoState.player = null;
    }

    renderVideoScreen();
}

// ==================== QUIZ ====================
function startVideoQuiz() {
    videoState.quizStep = 0;
    videoState.quizAnswers = [];
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const v = videoState.currentVideo;
    const q = v.quiz[videoState.quizStep];
    const overlay = document.getElementById('videoPlayerOverlay');
    const progress = ((videoState.quizStep) / v.quiz.length * 100);

    const optsHtml = q.opts.map((opt, i) =>
        `<button class="vq-opt" onclick="answerVideoQuiz(${i})">${opt}</button>`
    ).join('');

    overlay.innerHTML = `
        <div class="vq-container">
            <div class="vq-header">
                <button class="vp-back" onclick="renderVideoPlayer()">← Back to Video</button>
                <div class="vq-progress-text">${videoState.quizStep + 1} / ${v.quiz.length}</div>
            </div>
            <div class="vq-progress-bar"><div class="vq-progress-fill" style="width:${progress}%"></div></div>
            <div class="vq-question">${q.q}</div>
            <div class="vq-options">${optsHtml}</div>
        </div>
    `;
}

function answerVideoQuiz(idx) {
    const v = videoState.currentVideo;
    const q = v.quiz[videoState.quizStep];
    const correct = idx === q.answer;
    videoState.quizAnswers.push(correct);

    // Show feedback
    const opts = document.querySelectorAll('.vq-opt');
    opts.forEach((o, i) => {
        o.disabled = true;
        if (i === q.answer) o.classList.add('correct');
        if (i === idx && !correct) o.classList.add('wrong');
    });

    setTimeout(() => {
        videoState.quizStep++;
        if (videoState.quizStep < v.quiz.length) {
            renderQuizQuestion();
        } else {
            showVideoQuizResults();
        }
    }, 800);
}

function showVideoQuizResults() {
    const v = videoState.currentVideo;
    const correctCount = videoState.quizAnswers.filter(a => a).length;
    const total = v.quiz.length;
    const stars = correctCount === total ? 3 : correctCount >= total * 0.66 ? 2 : correctCount >= 1 ? 1 : 0;

    // Save stats
    const stats = getVideoStats();
    if (!stats.watched.includes(v.id)) stats.watched.push(v.id);
    stats.stars[v.id] = Math.max(stats.stars[v.id] || 0, stars);
    v.vocabulary.forEach(w => {
        if (!stats.wordsLearned.includes(w.word)) stats.wordsLearned.push(w.word);
    });
    stats.totalQuizzes++;
    saveVideoStats(stats);

    // Update global points
    const points = stars * 5;
    if (typeof appState !== 'undefined' && points > 0) {
        appState.points += points;
        saveUserData();
    }

    const overlay = document.getElementById('videoPlayerOverlay');
    const starsHtml = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const emoji = stars === 3 ? '🎉' : stars === 2 ? '👏' : stars === 1 ? '👍' : '💪';

    overlay.innerHTML = `
        <div class="vq-results">
            <div class="vq-emoji">${emoji}</div>
            <div class="vq-stars-big">${starsHtml}</div>
            <div class="vq-score">${correctCount} / ${total} correct</div>
            <div class="vq-points">+${points} points</div>
            <div class="vq-words-earned">📚 ${v.vocabulary.length} words learned!</div>
            <div class="vq-actions">
                <button class="vq-btn-retry" onclick="startVideoQuiz()">🔄 Retry</button>
                <button class="vq-btn-back" onclick="closeVideoPlayer()">📋 Back to Videos</button>
            </div>
        </div>
    `;
}

// ==================== STATS (localStorage) ====================
function getVideoStats() {
    if (typeof appState !== 'undefined' && appState.videoStats) return appState.videoStats;
    return { watched: [], stars: {}, wordsLearned: [], totalQuizzes: 0 };
}

function saveVideoStats(stats) {
    if (typeof appState !== 'undefined') {
        appState.videoStats = stats;
        saveUserData();
    }
}
