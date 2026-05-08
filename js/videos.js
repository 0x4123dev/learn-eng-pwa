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

const IELTS_SPEAKING_VIDEO_SOURCES = {
    shadowDaily: {
        youtubeId: 'HEdN8TOd_wI',
        channel: 'ez english practice',
        duration: '18:37',
        title: 'Repeat After Me: Master IELTS Daily Routine Questions'
    },
    part1Hometown: {
        youtubeId: 'rdCl6Fm2a5w',
        channel: 'IELTS Speaking Assistant',
        duration: 'Short',
        title: 'IELTS Speaking Part 1: Hometown Model Answer'
    },
    workStudy: {
        youtubeId: 'Y3X8pnD6sVk',
        channel: 'Emuallim',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Do You Work or Are You a Student?'
    },
    familyPart1: {
        youtubeId: 'MSUMQk4gxbI',
        channel: 'Tiny Talks',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Family Sample Answers'
    },
    foodPart1: {
        youtubeId: 'UUs1Fp7-D-M',
        channel: 'IELTS with Charles',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Food and Cooking Sample Answers'
    },
    hobbiesPart1: {
        youtubeId: '4Hl-iRtHbWc',
        channel: 'Learnivo',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Hobbies Practice'
    },
    weatherPart1: {
        youtubeId: 'jQq6Yb_yESM',
        channel: 'English Speaking Success',
        duration: 'Short',
        title: 'IELTS Speaking Part 1: Weather Answer'
    },
    sportsPart1: {
        youtubeId: 'MlwYFG9l_Ho',
        channel: 'IELTS PERFECTION',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Sport Sample Answers'
    },
    musicPart1: {
        youtubeId: 'Fg_G-5gxR3U',
        channel: 'ielts.studio',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Music Sample Answers'
    },
    readingPart1: {
        youtubeId: 'PWJlS9vUXuo',
        channel: 'The English A2Z Guide',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Books Sample Answers'
    },
    friendsPart1: {
        youtubeId: 'ePlvjvig_Zk',
        channel: 'IELTSlab',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Friends Sample Answers'
    },
    clothesPart1: {
        youtubeId: '135rDy86j7Q',
        channel: 'IELTS Anika',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Clothes Sample Answers'
    },
    shoppingPart1: {
        youtubeId: 'W14sc3P1RN4',
        channel: 'IELTSlab',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Shopping Sample Answers'
    },
    transportPart1: {
        youtubeId: 'njp1AaqhX8Y',
        channel: 'beat english',
        duration: 'Part 1',
        title: 'IELTS Speaking Part 1: Transportation Sample Answers'
    },
    part2Place: {
        youtubeId: 'mKhyIxWL3gQ',
        channel: 'KevinTeachesMe',
        duration: 'IELTS lesson',
        title: 'IELTS Speaking Part 2: Describe a Place'
    },
    part2PlaceGuide: {
        youtubeId: 'Q6CRhJkSk9w',
        channel: 'IELTS BANGLADESH',
        duration: 'IELTS lesson',
        title: 'IELTS Speaking Part 2: Describe a Place Guide'
    },
    part3Topics: {
        youtubeId: 'FlDdmUr-BxA',
        channel: 'Smart IELTS Academy',
        duration: 'Part 3',
        title: 'IELTS Speaking Part 3 Band 9 Sample Answers'
    },
    technologyTest: {
        youtubeId: 'FlDdmUr-BxA',
        channel: 'Smart IELTS Academy',
        duration: 'Part 3',
        title: 'IELTS Speaking Part 3 Band 9 Sample Answers: Environment, Education, Technology, Work & Society'
    },
    fullGiftTest: {
        youtubeId: 'KGZQvLYj2hM',
        channel: 'IELTS SHARING',
        duration: 'Full test',
        title: 'Full IELTS Speaking Test Sample'
    },
    fullTopicBook: {
        youtubeId: 'cnFUwu-jLNI',
        channel: 'IELTS SHARING',
        duration: 'Full test',
        title: 'IELTS Speaking Full Part 1, Part 2, Part 3'
    },
    fullPractice: {
        youtubeId: 'OORG_6VPc1g',
        channel: 'IELTS ve TOEFL',
        duration: 'Full test',
        title: 'IELTS Speaking Part 1, Part 2, Part 3'
    }
};

const IELTS_SPEAKING_VERIFIED_SOURCE_BY_LESSON = {
    1: 'part1Hometown',
    2: 'workStudy',
    3: 'part1Hometown',
    4: 'familyPart1',
    5: 'shadowDaily',
    6: 'foodPart1',
    7: 'hobbiesPart1',
    8: 'weatherPart1',
    9: 'sportsPart1',
    10: 'musicPart1',
    11: 'readingPart1',
    12: 'friendsPart1',
    13: 'clothesPart1',
    14: 'shoppingPart1',
    15: 'transportPart1',
    16: 'part1Hometown',
    19: 'shadowDaily',
    23: 'part2Place',
    25: 'part2PlaceGuide',
    27: 'part2Place',
    28: 'part2Place',
    29: 'technologyTest',
    30: 'technologyTest',
    35: 'part3Topics',
    36: 'part3Topics',
    37: 'technologyTest',
    38: 'part3Topics',
    39: 'part3Topics',
    40: 'part3Topics',
    41: 'fullGiftTest',
    43: 'part2PlaceGuide',
    44: 'part3Topics',
    45: 'part3Topics',
    46: 'fullGiftTest',
    47: 'technologyTest',
    48: 'part2PlaceGuide',
    49: 'part3Topics',
    50: 'fullPractice'
};

const IELTS_SPEAKING_CURRICULUM = [
    { level: 'beginner', part: 'Part 1', topic: 'Name, hometown, basic introduction', focus: 'Answer in 2 short sentences with clear pronunciation.', source: 'part1Hometown' },
    { level: 'beginner', part: 'Part 1', topic: 'Work or study', focus: 'Use present simple and explain one reason.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Home and accommodation', focus: 'Describe where you live with simple adjectives.', source: 'part1Hometown' },
    { level: 'beginner', part: 'Part 1', topic: 'Family', focus: 'Use family vocabulary and one personal detail.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Daily routine', focus: 'Use time phrases and repeat natural rhythm.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Food', focus: 'Say what you like, then give a simple reason.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Hobbies', focus: 'Use frequency words: usually, often, sometimes.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Weather', focus: 'Compare two types of weather.', source: 'part1Hometown' },
    { level: 'beginner', part: 'Part 1', topic: 'Sports', focus: 'Say whether you like sport and why.', source: 'shadowDaily' },
    { level: 'beginner', part: 'Part 1', topic: 'Music', focus: 'Describe your taste with one example.', source: 'fullTopicBook' },
    { level: 'beginner', part: 'Part 1', topic: 'Reading', focus: 'Talk about books, stories, or online reading.', source: 'fullGiftTest' },
    { level: 'beginner', part: 'Part 1', topic: 'Friends', focus: 'Use personality adjectives naturally.', source: 'fullPractice' },
    { level: 'beginner', part: 'Part 1', topic: 'Clothes', focus: 'Describe style, color, and comfort.', source: 'fullPractice' },
    { level: 'beginner', part: 'Part 1', topic: 'Shopping', focus: 'Give short answers about habits and preferences.', source: 'fullPractice' },
    { level: 'beginner', part: 'Part 1', topic: 'Transport', focus: 'Explain how you travel and why.', source: 'part1Hometown' },
    { level: 'elementary', part: 'Part 1 to Part 2', topic: 'Describe your hometown', focus: 'Expand from a short answer into a 45-second answer.', source: 'part1Hometown' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a family member', focus: 'Structure: who, what they are like, why you like them.', source: 'fullPractice' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a friend', focus: 'Add one story to make the answer personal.', source: 'fullPractice' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe your daily routine', focus: 'Use sequence language: first, after that, later.', source: 'shadowDaily' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe your favorite food', focus: 'Explain taste, memory, and occasion.', source: 'shadowDaily' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a hobby', focus: 'Say when you started and why you continue.', source: 'fullTopicBook' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a book', focus: 'Summarize the topic without retelling everything.', source: 'fullGiftTest' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a place you like', focus: 'Use sensory details and location phrases.', source: 'part2Place' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a gift', focus: 'Explain who gave it and why it mattered.', source: 'fullGiftTest' },
    { level: 'elementary', part: 'Part 2', topic: 'Describe a photo', focus: 'Describe people, place, and feeling.', source: 'part2PlaceGuide' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a journey', focus: 'Build a story with beginning, middle, and end.', source: 'part2PlaceGuide' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a city', focus: 'Compare the city with your hometown.', source: 'part2Place' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a quiet place', focus: 'Use the Triple E pattern: explain, example, emotion.', source: 'part2Place' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a useful object', focus: 'Explain function, frequency, and benefit.', source: 'technologyTest' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a piece of technology', focus: 'Use cause and effect language.', source: 'technologyTest' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a skill you learned', focus: 'Mention difficulty, progress, and result.', source: 'shadowDaily' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a time you helped someone', focus: 'Show clear past tense storytelling.', source: 'fullPractice' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a memorable event', focus: 'Explain why the event stayed in your memory.', source: 'fullTopicBook' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe a person who inspires you', focus: 'Use examples of actions, not only adjectives.', source: 'fullPractice' },
    { level: 'intermediate', part: 'Part 2', topic: 'Describe an interesting job', focus: 'Talk about skills, responsibilities, and future interest.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Education opinions', focus: 'Give opinion, reason, example, and contrast.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Technology and society', focus: 'Discuss benefits and drawbacks.', source: 'technologyTest' },
    { level: 'upper', part: 'Part 3', topic: 'Environment', focus: 'Use abstract nouns and solution language.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Health', focus: 'Compare personal habits and public policy.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Work and career', focus: 'Discuss trends and future predictions.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Books and reading', focus: 'Compare past and present habits.', source: 'fullGiftTest' },
    { level: 'upper', part: 'Part 3', topic: 'Shopping and consumer habits', focus: 'Talk about society, advertising, and choices.', source: 'fullPractice' },
    { level: 'upper', part: 'Part 3', topic: 'Cities and transport', focus: 'Use comparison and problem-solution structure.', source: 'part2PlaceGuide' },
    { level: 'upper', part: 'Part 3', topic: 'Culture and art', focus: 'Move from personal examples to social ideas.', source: 'part3Topics' },
    { level: 'upper', part: 'Part 3', topic: 'Family and generations', focus: 'Compare age groups and changing values.', source: 'part3Topics' },
    { level: 'advanced', part: 'Full Test', topic: 'Hometown, books, and reading', focus: 'Complete all three parts without stopping.', source: 'fullGiftTest' },
    { level: 'advanced', part: 'Full Test', topic: 'Work, technology, and modern life', focus: 'Record yourself and check fluency.', source: 'technologyTest' },
    { level: 'advanced', part: 'Full Test', topic: 'Travel, places, and cities', focus: 'Speak for the full Part 2 time.', source: 'part2PlaceGuide' },
    { level: 'advanced', part: 'Full Test', topic: 'Education, society, and opinions', focus: 'Support every opinion with one example.', source: 'part3Topics' },
    { level: 'advanced', part: 'Full Test', topic: 'Mock exam: mixed IELTS speaking', focus: 'Simulate the exam: listen, pause, answer, review.', source: 'fullPractice' }
];

const IELTS_SPEAKING_LESSON_CONTENT = {
    1: { modelLines: ['My name is Linh, and I am a student from Da Nang.', 'I would describe my hometown as friendly, lively, and easy to live in.', 'One thing I like about it is that the beach is close to the city center.'], frames: ['My name is...', 'I come from...', 'It is a... city', 'One thing I like is...'] },
    2: { modelLines: ['At the moment, I am studying English because it is useful for my future.', 'I usually study in the evening when my house is quiet.', 'The subject I enjoy most is speaking because I can express my ideas.'], frames: ['At the moment, I...', 'I usually...', 'The subject I enjoy is...', 'It helps me...'] },
    3: { modelLines: ['I live in an apartment with my family.', 'It is not very large, but it is comfortable and convenient.', 'My favorite room is my bedroom because I can study and relax there.'], frames: ['I live in...', 'It is not..., but...', 'My favorite room is...', 'because...'] },
    4: { modelLines: ['I live with my parents and my younger brother.', 'We are quite close because we usually eat dinner together.', 'The person I talk to most is my mother because she understands me well.'], frames: ['I live with...', 'We are quite...', 'The person I talk to most is...', 'because...'] },
    5: { modelLines: ['On a normal day, I wake up at around six thirty.', 'After breakfast, I go to school and spend most of the day studying.', 'In the evening, I do homework and watch a short English video.'], frames: ['On a normal day...', 'After that...', 'Most of the day...', 'In the evening...'] },
    6: { modelLines: ['My favorite food is noodle soup because it is warm and filling.', 'I usually eat it with my family on the weekend.', 'I think food is important because it connects people.'], frames: ['My favorite food is...', 'I usually eat it...', 'It tastes...', 'Food is important because...'] },
    7: { modelLines: ['One hobby I really enjoy is listening to music.', 'I usually do it after school because it helps me relax.', 'I would like to try photography in the future.'], frames: ['One hobby I enjoy is...', 'I usually do it...', 'It helps me...', 'In the future, I want to...'] },
    8: { modelLines: ['I prefer sunny weather because it makes me feel energetic.', 'In my country, the weather can be very hot in summer.', 'When it rains, I usually stay at home and read or watch videos.'], frames: ['I prefer... weather', 'In my country...', 'When it rains...', 'It makes me feel...'] },
    9: { modelLines: ['I am not a professional athlete, but I enjoy playing badminton.', 'Sport is good for young people because it keeps them healthy.', 'I prefer team sports because they are more exciting.'], frames: ['I enjoy playing...', 'Sport is good because...', 'I prefer... sports', 'They are more...'] },
    10: { modelLines: ['I listen to music almost every day.', 'My favorite kind of music is pop because the rhythm is easy to follow.', 'Music helps me improve my pronunciation when I sing along.'], frames: ['I listen to...', 'My favorite kind is...', 'It helps me...', 'When I feel..., I...'] },
    11: { modelLines: ['I do not read long books often, but I read short articles online.', 'Reading in English helps me learn new words naturally.', 'I prefer stories with simple language and interesting characters.'], frames: ['I read...', 'I prefer...', 'Reading helps me...', 'The last thing I read was...'] },
    12: { modelLines: ['My best friend is cheerful and easy to talk to.', 'We met at school, and we usually study together.', 'A good friend should be honest and supportive.'], frames: ['My best friend is...', 'We met...', 'We usually...', 'A good friend should...'] },
    13: { modelLines: ['I usually wear casual clothes because they are comfortable.', 'For special occasions, I prefer a shirt and dark trousers.', 'I think clothes can show a little bit of someone’s personality.'], frames: ['I usually wear...', 'For special occasions...', 'I prefer...', 'Clothes can show...'] },
    14: { modelLines: ['I go shopping when I need something, not just for fun.', 'I prefer shopping online because it saves time.', 'However, for clothes, I like trying things on before buying them.'], frames: ['I go shopping when...', 'I prefer shopping...', 'It saves...', 'However, for..., I...'] },
    15: { modelLines: ['I usually travel around my city by motorbike or bus.', 'Public transport is cheaper, but it is not always convenient.', 'In the future, I hope my city has better trains and buses.'], frames: ['I usually travel by...', 'It is cheaper but...', 'In the future...', 'My city needs...'] },
    16: { modelLines: ['I would like to describe my hometown, which is a coastal city.', 'It has beautiful beaches, friendly people, and many small cafes.', 'I feel proud of it because it is peaceful but still modern.'], frames: ['I would like to describe...', 'It is located...', 'It is famous for...', 'I feel proud because...'] },
    17: { modelLines: ['I would like to talk about my older sister.', 'She is patient, hard-working, and always willing to help me.', 'I admire her because she stays calm even when she has problems.'], frames: ['I would like to talk about...', 'He/She is...', 'One thing I admire is...', 'I feel... because...'] },
    18: { modelLines: ['I would like to describe a close friend from my class.', 'We became friends because we both enjoyed learning English.', 'What I like most about him is that he is reliable and funny.'], frames: ['I met this friend...', 'We became friends because...', 'He/She is...', 'What I like most is...'] },
    19: { modelLines: ['I would like to describe my usual school day.', 'It starts quite early, so I have to prepare my bag the night before.', 'Although it can be tiring, I like having a clear routine.'], frames: ['My routine starts...', 'After that...', 'The busiest part is...', 'Although it is..., I...'] },
    20: { modelLines: ['I would like to talk about a dish called pho.', 'It is a noodle soup with beef or chicken and fresh herbs.', 'I like it because it reminds me of meals with my family.'], frames: ['The food is called...', 'It is made with...', 'I usually eat it...', 'It reminds me of...'] },
    21: { modelLines: ['I would like to describe my hobby, which is drawing.', 'I started doing it when I was a child because I liked cartoons.', 'Now it helps me relax and express my imagination.'], frames: ['My hobby is...', 'I started...', 'I usually do it...', 'It helps me...'] },
    22: { modelLines: ['I would like to talk about a book I enjoyed.', 'The story was simple, but the message was meaningful.', 'It taught me that small actions can change someone’s life.'], frames: ['The book is about...', 'The main character...', 'The message is...', 'I would recommend it because...'] },
    23: { modelLines: ['I would like to describe a quiet cafe near my home.', 'It has soft music, warm lights, and a comfortable atmosphere.', 'I go there when I need to study or think clearly.'], frames: ['The place is...', 'It is located...', 'The atmosphere is...', 'I go there when...'] },
    24: { modelLines: ['I would like to describe a watch my father gave me.', 'It was not expensive, but it was meaningful because it marked my birthday.', 'I still keep it because it reminds me to use time wisely.'], frames: ['The gift was...', 'It was given by...', 'I received it when...', 'It was special because...'] },
    25: { modelLines: ['I would like to describe a photo from a family trip.', 'In the picture, we are standing near the sea and smiling.', 'I like this photo because it captures a happy moment in my life.'], frames: ['The photo shows...', 'It was taken...', 'In the picture...', 'I like it because...'] },
    26: { modelLines: ['I would like to describe a journey to another city.', 'The journey took several hours, but the scenery was beautiful.', 'It was memorable because I traveled with people I care about.'], frames: ['The journey was to...', 'It took...', 'During the trip...', 'It was memorable because...'] },
    27: { modelLines: ['I would like to talk about Ho Chi Minh City.', 'It is busy, modern, and full of opportunities.', 'Although it can be crowded, I enjoy its energy and food culture.'], frames: ['The city is...', 'It is known for...', 'Although it is...', 'I like it because...'] },
    28: { modelLines: ['I would like to describe a quiet library in my school.', 'It is a place where students can read, study, and concentrate.', 'I like it because the silence helps me think more deeply.'], frames: ['The quiet place is...', 'People go there to...', 'I usually...', 'It helps me...'] },
    29: { modelLines: ['I would like to describe my smartphone.', 'I use it to study English, take photos, and communicate with friends.', 'It is useful because it gives me information quickly.'], frames: ['The object is...', 'I use it for...', 'It is useful because...', 'Without it, I would...'] },
    30: { modelLines: ['I would like to talk about video-call technology.', 'It allows people to study or work together even when they are far apart.', 'I think it is valuable because it saves time and connects families.'], frames: ['The technology is...', 'It allows people to...', 'One benefit is...', 'One problem is...'] },
    31: { modelLines: ['I would like to describe a skill I learned: speaking English more confidently.', 'At first, I was nervous and often paused too much.', 'After practicing every day, I became more comfortable expressing my ideas.'], frames: ['The skill I learned was...', 'At first...', 'I improved by...', 'Now I can...'] },
    32: { modelLines: ['I would like to describe a time I helped a classmate with homework.', 'He was confused, so I explained the task step by step.', 'I felt happy because helping him also helped me understand the lesson better.'], frames: ['I helped...', 'The problem was...', 'I did this by...', 'I felt... because...'] },
    33: { modelLines: ['I would like to describe my first school performance.', 'I was nervous before going on stage, but my friends encouraged me.', 'It became memorable because I realized I could be brave.'], frames: ['The event happened...', 'Before it started...', 'During the event...', 'I remember it because...'] },
    34: { modelLines: ['I would like to describe a teacher who inspires me.', 'She explains difficult ideas in a simple and encouraging way.', 'I respect her because she makes students believe they can improve.'], frames: ['The person is...', 'He/She inspires me because...', 'One example is...', 'Because of this person, I...'] },
    35: { modelLines: ['I would like to talk about being a software developer.', 'This job seems interesting because it combines creativity and problem solving.', 'I think it would be challenging, but also rewarding.'], frames: ['The job is...', 'It involves...', 'It seems interesting because...', 'I would need to...'] },
    36: { modelLines: ['In my opinion, education should teach both knowledge and life skills.', 'For example, students need communication skills as well as exam preparation.', 'However, schools also have to keep academic standards high.'], frames: ['In my opinion...', 'For example...', 'This is important because...', 'However, schools should...'] },
    37: { modelLines: ['Technology has changed the way people communicate and learn.', 'One advantage is that information is easier to access than before.', 'On the other hand, people may spend too much time on screens.'], frames: ['Technology has changed...', 'One advantage is...', 'A possible drawback is...', 'In the future...'] },
    38: { modelLines: ['I believe environmental protection should be a shared responsibility.', 'Governments can make rules, but individuals also need better habits.', 'For instance, people can reduce plastic use and save electricity.'], frames: ['I believe...', 'Governments can...', 'Individuals should...', 'For instance...'] },
    39: { modelLines: ['Health is strongly connected to daily habits.', 'People should exercise regularly and avoid too much processed food.', 'However, governments also need to make healthcare affordable.'], frames: ['Health is connected to...', 'People should...', 'Governments need to...', 'A good example is...'] },
    40: { modelLines: ['The world of work is changing quickly because of technology.', 'Some jobs may disappear, but new types of work will also appear.', 'That is why people need to keep learning throughout their careers.'], frames: ['Work is changing because...', 'Some jobs...', 'People need to...', 'In the future...'] },
    41: { modelLines: ['Reading is still important even though many people watch videos now.', 'Books can improve concentration and imagination.', 'However, digital reading is more convenient for busy people.'], frames: ['Reading is important because...', 'Books can...', 'Digital reading...', 'Compared with the past...'] },
    42: { modelLines: ['Consumer habits are influenced by advertising and social media.', 'Some people buy things they do not really need.', 'I think schools should teach young people how to spend money wisely.'], frames: ['Consumer habits are influenced by...', 'Some people...', 'I think...', 'A solution could be...'] },
    43: { modelLines: ['Large cities need efficient public transport.', 'If buses and trains are reliable, fewer people will use private cars.', 'This can reduce traffic and improve air quality.'], frames: ['Large cities need...', 'If..., then...', 'This can reduce...', 'Another solution is...'] },
    44: { modelLines: ['Art and culture help people understand their identity.', 'Museums, music, and festivals can connect generations.', 'However, culture also needs to change so young people stay interested.'], frames: ['Art and culture help...', 'They can connect...', 'However...', 'Young people can...'] },
    45: { modelLines: ['Family relationships have changed in many modern societies.', 'Young people are more independent than in the past.', 'Even so, older family members still play an important role in giving advice.'], frames: ['Family relationships have...', 'Young people are...', 'Older people...', 'Even so...'] },
    46: { modelLines: ['For Part 1, I will answer naturally and add a short reason.', 'For Part 2, I will organize my answer with clear stages and examples.', 'For Part 3, I will explain my opinion and compare different views.'], frames: ['Part 1: answer + reason', 'Part 2: story + details', 'Part 3: opinion + example', 'Review one weak point'] },
    47: { modelLines: ['When talking about technology, I should mention both convenience and risk.', 'For work topics, I can discuss skills, motivation, and future changes.', 'I will try to use examples from my own life, not memorized answers.'], frames: ['Convenience...', 'Risk...', 'At work...', 'In the future...'] },
    48: { modelLines: ['For travel topics, I can describe places using sights, sounds, and feelings.', 'For city questions, I should compare advantages and disadvantages.', 'I will speak clearly and avoid rushing in Part 2.'], frames: ['The place...', 'The atmosphere...', 'One advantage...', 'One disadvantage...'] },
    49: { modelLines: ['Education and society questions need clear opinions.', 'I should support my ideas with examples from school or daily life.', 'If I disagree with an idea, I can still explain it politely.'], frames: ['I believe...', 'This matters because...', 'For example...', 'Some people argue...'] },
    50: { modelLines: ['In this mock test, I will focus on speaking continuously.', 'If I make a mistake, I will correct myself and continue.', 'After the test, I will review fluency, vocabulary, grammar, and pronunciation.'], frames: ['Keep speaking', 'Correct and continue', 'Use examples', 'Review all four criteria'] }
};

function buildIELTSSpeakingLessons() {
    return IELTS_SPEAKING_CURRICULUM.map((item, idx) => {
        const lessonNo = idx + 1;
        const sourceKey = IELTS_SPEAKING_VERIFIED_SOURCE_BY_LESSON[lessonNo];
        const source = sourceKey ? IELTS_SPEAKING_VIDEO_SOURCES[sourceKey] : null;
        const lessonId = `ielts-speaking-${String(lessonNo).padStart(2, '0')}`;
        return {
            id: lessonId,
            youtubeId: source ? source.youtubeId : null,
            title: `Lesson ${lessonNo}: ${item.topic}`,
            channel: source ? source.channel : 'FlashLingo IELTS Coach',
            duration: source ? source.duration : 'Practice',
            level: item.level,
            category: 'ielts-speaking',
            icon: lessonNo <= 15 ? '🗣️' : lessonNo <= 35 ? '🎙️' : lessonNo <= 45 ? '💬' : '🏆',
            description: `${item.part} practice. ${item.focus}`,
            speakingPart: item.part,
            lessonNo: lessonNo,
            mode: lessonNo <= 15 ? 'Listen → Repeat' : lessonNo <= 35 ? 'Listen → Repeat → 1-minute answer' : 'Listen → Answer → Record yourself',
            sourceTitle: source ? source.title : 'Practice prompt',
            sourceUrl: source ? `https://www.youtube.com/watch?v=${source.youtubeId}` : '',
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent('IELTS Speaking ' + item.topic + ' sample answers repeat after me')}`,
            speakingPrompts: getIELTSSpeakingPrompts(item, lessonNo),
            checkpoints: getIELTSSpeakingCheckpoints(lessonNo),
            modelLines: getIELTSSpeakingModelLines(item, lessonNo),
            answerFrames: getIELTSSpeakingFrames(item, lessonNo),
            timerConfig: getIELTSSpeakingTimerConfig(lessonNo),
            vocabulary: getIELTSSpeakingVocabulary(item.topic, lessonNo),
            quiz: getIELTSSpeakingQuiz(item, lessonNo)
        };
    });
}

function getIELTSSpeakingPrompts(item, lessonNo) {
    if (lessonNo <= 15) {
        return [
            `Answer this Part 1 question: ${item.topic}.`,
            'Repeat one model sentence from the video.',
            'Answer again using your own real information.'
        ];
    }
    if (lessonNo <= 35) {
        return [
            `Prepare a cue card about: ${item.topic}.`,
            'Speak for 60 seconds. Use who/what/where/when/why details.',
            'Repeat the best sentence from the video with the same stress and intonation.'
        ];
    }
    if (lessonNo <= 45) {
        return [
            `Give an opinion about: ${item.topic}.`,
            'Add one reason and one example.',
            'Try a contrast sentence: "However, some people believe..."'
        ];
    }
    return [
        `Run a full IELTS Speaking practice on: ${item.topic}.`,
        'Pause the video after each examiner question and answer out loud.',
        'Record yourself, then replay and check fluency, vocabulary, grammar, and pronunciation.'
    ];
}

function getIELTSSpeakingCheckpoints(lessonNo) {
    if (lessonNo <= 15) return ['Listen once', 'Repeat sentence by sentence', 'Answer personally'];
    if (lessonNo <= 35) return ['Watch the model', 'Plan for 1 minute', 'Speak for 1-2 minutes'];
    if (lessonNo <= 45) return ['Listen to the opinion', 'Repeat linking phrases', 'Give your own opinion'];
    return ['Start full test', 'Pause and answer', 'Replay your recording'];
}

function getIELTSSpeakingModelLines(item, lessonNo) {
    const content = IELTS_SPEAKING_LESSON_CONTENT[lessonNo];
    if (content && content.modelLines) return content.modelLines;
    const topic = item.topic.replace(/^Describe\s+/i, '').toLowerCase();
    if (lessonNo <= 15) {
        return [
            `I would say ${topic} is quite important in my daily life.`,
            `The main reason is that it helps me express myself more naturally.`,
            `For example, I can give a short answer and then add one personal detail.`
        ];
    }
    if (lessonNo <= 35) {
        return [
            `I would like to talk about ${topic}.`,
            `It was memorable because there was a clear story behind it.`,
            `What made it special for me was the feeling I had at that time.`
        ];
    }
    if (lessonNo <= 45) {
        return [
            `In my opinion, ${topic} can affect people in several different ways.`,
            `One clear advantage is that it can make life more convenient.`,
            `However, there are also some drawbacks, especially when people depend on it too much.`
        ];
    }
    return [
        `For Part 1, answer naturally and add one reason.`,
        `For Part 2, organize your answer with past, details, and feelings.`,
        `For Part 3, give an opinion, support it, and compare another viewpoint.`
    ];
}

function getIELTSSpeakingFrames(item, lessonNo) {
    const content = IELTS_SPEAKING_LESSON_CONTENT[lessonNo];
    if (content && content.frames) return content.frames;
    if (lessonNo <= 15) {
        return [
            'I usually...',
            'I prefer... because...',
            'For example...',
            'Compared with the past, I...'
        ];
    }
    if (lessonNo <= 35) {
        return [
            'I would like to talk about...',
            'This happened when...',
            'The reason I remember it is...',
            'Overall, it was...'
        ];
    }
    if (lessonNo <= 45) {
        return [
            'In my opinion...',
            'The main reason is...',
            'For instance...',
            'On the other hand...'
        ];
    }
    return [
        'Part 1: answer + reason',
        'Part 2: story + details + feeling',
        'Part 3: opinion + example + contrast',
        'Review: fluency, vocabulary, grammar, pronunciation'
    ];
}

function getIELTSSpeakingTimerConfig(lessonNo) {
    if (lessonNo <= 15) return { prep: 0, speak: 20, label: 'Part 1 answer' };
    if (lessonNo <= 35) return { prep: 60, speak: 120, label: 'Part 2 long turn' };
    if (lessonNo <= 45) return { prep: 10, speak: 45, label: 'Part 3 opinion' };
    return { prep: 60, speak: 300, label: 'Full test round' };
}

function getIELTSSpeakingVocabulary(topic, lessonNo) {
    const common = [
        { word: 'fluency', phonetic: '/ˈfluːənsi/', meaning: 'sự lưu loát' },
        { word: 'coherence', phonetic: '/koʊˈhɪrəns/', meaning: 'sự mạch lạc' },
        { word: 'pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃn/', meaning: 'phát âm' }
    ];
    const part1 = [
        { word: 'usually', phonetic: '/ˈjuːʒuəli/', meaning: 'thường xuyên' },
        { word: 'because', phonetic: '/bɪˈkɔːz/', meaning: 'bởi vì' }
    ];
    const part2 = [
        { word: 'memorable', phonetic: '/ˈmemərəbl/', meaning: 'đáng nhớ' },
        { word: 'experience', phonetic: '/ɪkˈspɪriəns/', meaning: 'trải nghiệm' }
    ];
    const part3 = [
        { word: 'advantage', phonetic: '/ədˈvæntɪdʒ/', meaning: 'lợi thế' },
        { word: 'drawback', phonetic: '/ˈdrɔːbæk/', meaning: 'bất lợi' }
    ];
    const topicWord = topic.split(/[,\s]+/).find(w => w.length > 5) || 'speaking';
    const dynamic = { word: topicWord.toLowerCase(), phonetic: '', meaning: 'từ khóa chủ đề' };
    return [dynamic, ...common, ...(lessonNo <= 15 ? part1 : lessonNo <= 35 ? part2 : part3)];
}

function getIELTSSpeakingQuiz(item, lessonNo) {
    const answerLength = lessonNo <= 15 ? '2-3 sentences' : lessonNo <= 35 ? '1-2 minutes' : '30-60 seconds with reasons';
    return [
        { q: `What should you practice in this lesson?`, opts: [item.topic, 'Random vocabulary only', 'Silent reading'], answer: 0 },
        { q: `Best answer length for ${item.part}?`, opts: ['One word only', answerLength, 'Ten minutes'], answer: 1 },
        { q: 'What should you do after listening to the model?', opts: ['Close the app', 'Repeat and answer with your own idea', 'Memorize every word exactly'], answer: 1 }
    ];
}

VIDEO_LIBRARY.push(...buildIELTSSpeakingLessons());

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
    'ielts-speaking': { name: 'IELTS Speaking', icon: '🎙️' },
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

const IELTS_PART_FILTERS = {
    all: { name: 'All', icon: '🎙️' },
    part1: { name: 'Part 1', icon: '1️⃣' },
    part2: { name: 'Part 2', icon: '2️⃣' },
    part3: { name: 'Part 3', icon: '3️⃣' },
    mock: { name: 'Mock Test', icon: '🏆' },
    weak: { name: 'Weak', icon: '🎯' }
};

const IELTS_SPEAKING_CRITERIA = [
    { id: 'fluency', name: 'Fluency', short: 'Flow' },
    { id: 'vocabulary', name: 'Vocabulary', short: 'Words' },
    { id: 'grammar', name: 'Grammar', short: 'Grammar' },
    { id: 'pronunciation', name: 'Pronunciation', short: 'Sound' }
];

// ==================== STATE ====================
let videoState = {
    currentVideo: null,
    player: null,
    selectedCourse: 'ielts',
    selectedIELTSPart: 'all',
    selectedLevel: 'all',
    selectedCategory: 'all',
    quizAnswers: [],
    quizStep: 0,
    apiReady: false,
    mediaRecorder: null,
    recordingStream: null,
    recordingChunks: [],
    recordingUrl: null,
    isRecording: false,
    recordingMade: false,
    timerInterval: null,
    timerLabel: '',
    timerLeft: 0,
    shadowIndex: 0,
    shadowActive: false
};

function getVideoEmbedId(video) {
    if (Object.prototype.hasOwnProperty.call(video, 'youtubeId')) return video.youtubeId;
    return video.id;
}

function getVideoProgressId(video) {
    return video.id;
}

function getIELTSPartKey(video) {
    if (!video || video.category !== 'ielts-speaking') return 'library';
    if (video.speakingPart === 'Part 1') return 'part1';
    if (video.speakingPart && video.speakingPart.includes('Part 2')) return 'part2';
    if (video.speakingPart === 'Part 3') return 'part3';
    if (video.speakingPart === 'Full Test') return 'mock';
    return 'all';
}

function escapeVideoJsString(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function getCourseVideos() {
    return VIDEO_LIBRARY.filter(v => {
        const isIELTS = v.category === 'ielts-speaking';
        return videoState.selectedCourse === 'ielts' ? isIELTS : !isIELTS;
    });
}

function getSpeakingRatingOverall(rating) {
    if (!rating) return 0;
    if (typeof rating.bestOverall === 'number') return rating.bestOverall;
    if (typeof rating.overall === 'number') return rating.overall;
    if (typeof rating.score === 'number') return rating.score;
    const criteria = rating.criteria || {};
    const scores = IELTS_SPEAKING_CRITERIA.map(c => criteria[c.id]).filter(n => typeof n === 'number');
    if (scores.length === 0) return 0;
    return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

function getSpeakingCriteriaAverage(criteria) {
    const scores = IELTS_SPEAKING_CRITERIA.map(c => criteria && criteria[c.id]).filter(n => typeof n === 'number');
    if (scores.length === 0) return 0;
    return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

function getIELTSSpeakingProgressStats(stats) {
    stats = normalizeVideoStats(stats);
    const lessons = VIDEO_LIBRARY.filter(v => v.category === 'ielts-speaking');
    const ratings = stats.speakingRatings || {};
    const completed = lessons.filter(v => stats.watched.includes(v.id) || (ratings[v.id] && ratings[v.id].completedAt));
    const rated = lessons.map(v => getSpeakingRatingOverall(ratings[v.id])).filter(n => n > 0);
    const avg = rated.length ? rated.reduce((sum, n) => sum + n, 0) / rated.length : 0;
    const recordings = lessons.filter(v => ratings[v.id] && ratings[v.id].recordingMade).length;
    let streak = 0;
    for (const lesson of lessons) {
        if (stats.watched.includes(lesson.id) || (ratings[lesson.id] && ratings[lesson.id].completedAt)) streak++;
        else break;
    }
    const weakLessonIds = lessons
        .map(v => ({ id: v.id, lessonNo: v.lessonNo, score: getSpeakingRatingOverall(ratings[v.id]) }))
        .filter(v => v.score > 0 && v.score < 3.5)
        .sort((a, b) => a.score - b.score || a.lessonNo - b.lessonNo)
        .map(v => v.id);
    return {
        total: lessons.length,
        completed: completed.length,
        recordings,
        ratings: rated.length,
        averageRating: avg,
        streak,
        weakLessonIds
    };
}

function speakSpeakingText(text) {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
        if (typeof speakWord === 'function') speakWord(text);
        return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
}

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
    const courseVideos = getCourseVideos();
    const speakingStats = getIELTSSpeakingProgressStats(stats);
    const filtered = getFilteredVideos();

    const levelTabs = videoState.selectedCourse === 'ielts'
        ? Object.keys(IELTS_PART_FILTERS).map(k => {
            const meta = IELTS_PART_FILTERS[k];
            const count = k === 'all'
                ? courseVideos.length
                : k === 'weak'
                    ? speakingStats.weakLessonIds.length
                    : courseVideos.filter(v => getIELTSPartKey(v) === k).length;
            const active = videoState.selectedIELTSPart === k ? 'active' : '';
            return `<button class="vl-tab ${active}" onclick="filterIELTSPart('${k}')">${meta.icon} ${meta.name} <span class="vl-tab-count">${count}</span></button>`;
        }).join('')
        : ['all', ...Object.keys(VIDEO_LEVELS)].map(k => {
            const isAll = k === 'all';
            const lbl = isAll ? '🎬 All' : `${VIDEO_LEVELS[k].icon} ${VIDEO_LEVELS[k].name}`;
            const count = isAll ? courseVideos.length : courseVideos.filter(v => v.level === k).length;
            const active = videoState.selectedLevel === k ? 'active' : '';
            return `<button class="vl-tab ${active}" onclick="filterVideoLevel('${k}')">${lbl} <span class="vl-tab-count">${count}</span></button>`;
        }).join('');

    const catKeys = Object.keys(VIDEO_CATEGORIES).filter(k =>
        videoState.selectedCourse === 'ielts' ? k === 'all' : k !== 'ielts-speaking'
    );
    const catChips = catKeys.map(k => {
        const active = videoState.selectedCategory === k ? 'active' : '';
        return `<button class="vc-chip ${active}" onclick="filterVideoCategory('${k}')">${VIDEO_CATEGORIES[k].icon} ${VIDEO_CATEGORIES[k].name}</button>`;
    }).join('');

    const cards = filtered.map(v => {
        const level = VIDEO_LEVELS[v.level] || VIDEO_LEVELS.beginner;
        const progressId = getVideoProgressId(v);
        const watched = stats.watched.includes(progressId);
        const stars = stats.stars[progressId] || 0;
        const starStr = stars > 0 ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';
        const embedId = getVideoEmbedId(v);
        const thumbStyle = embedId ? `style="background-image: url('https://img.youtube.com/vi/${embedId}/mqdefault.jpg')"` : '';
        const thumbClass = embedId ? 'vc-thumb' : 'vc-thumb vc-thumb-practice';
        const lessonBadge = v.lessonNo ? `<div class="vc-lesson-badge">Lesson ${v.lessonNo}</div>` : '';
        const speakingMeta = v.speakingPart ? `<span class="vc-speaking-part">${v.speakingPart}</span>` : '';
        const videoBadge = v.category === 'ielts-speaking'
            ? `<span class="vc-source-badge ${embedId ? 'has-video' : 'practice-only'}">${embedId ? 'Video' : 'Practice'}</span>`
            : '';
        return `
        <div class="vc-card ${watched ? 'watched' : ''}" onclick="openVideoPlayer('${v.id}')">
            <div class="${thumbClass}" ${thumbStyle}>
                <div class="vc-play-icon">▶</div>
                <div class="vc-duration">${v.duration}</div>
                ${lessonBadge}
                ${watched ? '<div class="vc-watched-badge">✅</div>' : ''}
            </div>
            <div class="vc-info">
                <div class="vc-title">${v.icon} ${v.title}</div>
                <div class="vc-meta">
                    <span class="vc-level-badge" style="background:${level.color}">${level.icon} ${level.name}</span>
                    ${speakingMeta}
                    ${videoBadge}
                    ${starStr ? `<span class="vc-stars">${starStr}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    const courseIds = courseVideos.map(getVideoProgressId);
    const watchedCount = courseIds.filter(id => stats.watched.includes(id)).length;
    const totalStars = courseIds.reduce((sum, id) => sum + (stats.stars[id] || 0), 0);
    const maxStars = courseVideos.length * 3;
    const wordsLearned = stats.wordsLearned.length;
    const courseTitle = videoState.selectedCourse === 'ielts' ? '🎙️ IELTS Speaking Path' : '🎬 Video Lessons';
    const gridClass = videoState.selectedCourse === 'ielts' ? 'vc-grid vc-grid-ielts' : 'vc-grid';
    const statsHtml = videoState.selectedCourse === 'ielts' ? `
                <div class="vs-stat"><span class="vs-stat-val">${speakingStats.completed}/${speakingStats.total}</span><span class="vs-stat-lbl">Done</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${speakingStats.recordings}/${speakingStats.ratings}</span><span class="vs-stat-lbl">Rec/Rate</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${speakingStats.averageRating ? speakingStats.averageRating.toFixed(1) : '-'}</span><span class="vs-stat-lbl">Avg</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${speakingStats.streak}</span><span class="vs-stat-lbl">Streak</span></div>
    ` : `
                <div class="vs-stat"><span class="vs-stat-val">${watchedCount}</span><span class="vs-stat-lbl">Watched</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${totalStars}/${maxStars}</span><span class="vs-stat-lbl">Stars</span></div>
                <div class="vs-stat"><span class="vs-stat-val">${wordsLearned}</span><span class="vs-stat-lbl">Words</span></div>
    `;

    container.innerHTML = `
        <div class="vs-header">
            <div class="vs-title">${courseTitle}</div>
            <div class="vs-stats-row">
                ${statsHtml}
            </div>
        </div>
        <div class="vs-course-tabs">
            <button class="vs-course-tab ${videoState.selectedCourse === 'ielts' ? 'active' : ''}" onclick="switchVideoCourse('ielts')">🎙️ IELTS Path</button>
            <button class="vs-course-tab ${videoState.selectedCourse === 'library' ? 'active' : ''}" onclick="switchVideoCourse('library')">🎬 Library</button>
        </div>
        <div class="vl-tabs-scroll">${levelTabs}</div>
        ${videoState.selectedCourse === 'library' ? `<div class="vc-chips-scroll">${catChips}</div>` : ''}
        <div class="${gridClass}">${cards || '<div class="vc-empty">No videos found for this filter.</div>'}</div>
    `;
}

function switchVideoCourse(course) {
    videoState.selectedCourse = course;
    videoState.selectedIELTSPart = 'all';
    videoState.selectedLevel = 'all';
    videoState.selectedCategory = 'all';
    renderVideoScreen();
}

function filterIELTSPart(part) {
    videoState.selectedIELTSPart = part;
    renderVideoScreen();
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
    const stats = getVideoStats();
    const speakingStats = getIELTSSpeakingProgressStats(stats);
    const videos = getCourseVideos().filter(v => {
        if (videoState.selectedCourse === 'ielts') {
            if (videoState.selectedIELTSPart === 'weak') return speakingStats.weakLessonIds.includes(v.id);
            if (videoState.selectedIELTSPart !== 'all' && getIELTSPartKey(v) !== videoState.selectedIELTSPart) return false;
            return true;
        }
        if (videoState.selectedLevel !== 'all' && v.level !== videoState.selectedLevel) return false;
        if (videoState.selectedCategory !== 'all' && v.category !== videoState.selectedCategory) return false;
        return true;
    });
    if (videoState.selectedCourse === 'ielts' && videoState.selectedIELTSPart === 'weak') {
        const weakOrder = new Map(speakingStats.weakLessonIds.map((id, idx) => [id, idx]));
        return videos.sort((a, b) => (weakOrder.get(a.id) || 0) - (weakOrder.get(b.id) || 0));
    }
    return videos;
}

// ==================== VIDEO PLAYER ====================
function openVideoPlayer(videoId) {
    const video = VIDEO_LIBRARY.find(v => v.id === videoId);
    if (!video) return;

    videoState.currentVideo = video;
    videoState.quizAnswers = [];
    videoState.quizStep = 0;
    videoState.shadowIndex = 0;
    videoState.shadowActive = false;
    stopSpeakingTimer(false);
    resetSpeakingRecording();

    if (getVideoEmbedId(video)) loadYouTubeAPI();

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
    const prevStars = stats.stars[getVideoProgressId(v)] || 0;
    const embedId = getVideoEmbedId(v);

    const vocabHtml = v.vocabulary.map(w =>
        `<div class="vp-word" onclick="speakWord('${w.word.replace(/'/g, "\\'")}')">
            <div class="vp-word-en">${w.word} 🔊</div>
            <div class="vp-word-pho">${w.phonetic}</div>
            <div class="vp-word-vi">${w.meaning}</div>
        </div>`
    ).join('');
    const playerHtml = embedId ? `
            <div class="vp-player-wrap">
                <div id="ytPlayerContainer"></div>
                <div class="vp-offline-msg" id="vpOfflineMsg" style="display:none;">
                    📡 Internet needed to play video
                </div>
            </div>
    ` : `
            <div class="vp-player-wrap vp-practice-wrap">
                <div class="vp-practice-player">
                    <div class="vp-practice-icon">🎙️</div>
                    <div class="vp-practice-title">Practice lesson</div>
                    <div class="vp-practice-subtitle">No exact verified video yet. Use the model lines, record your answer, then replace the video from the search link.</div>
                </div>
            </div>
    `;
    const speakingHtml = v.speakingPrompts ? `
        <div class="vp-speaking-panel">
            <div class="vp-speaking-head">
                <div>
                    <div class="vp-speaking-label">IELTS Speaking ${v.lessonNo ? 'Lesson ' + v.lessonNo : ''}</div>
                    <div class="vp-speaking-mode">${v.mode || v.speakingPart || 'Listen and repeat'}</div>
                </div>
                <div class="vp-speaking-part">${v.speakingPart || ''}</div>
            </div>
            <div class="vp-checkpoints">
                ${(v.checkpoints || []).map(c => `<span>${c}</span>`).join('')}
            </div>
            <div class="vp-timer-panel" id="vpTimerPanel">${getSpeakingTimerHTML(v)}</div>
            <div class="vp-shadow-panel" id="vpShadowPanel">${getShadowPracticeHTML(v)}</div>
            <div class="vp-model-lines">
                <div class="vp-mini-title">Model lines</div>
                ${(v.modelLines || []).map(line => `
                    <button class="vp-model-line" onclick="speakSpeakingText('${escapeVideoJsString(line)}')">
                        <span>🔊</span>
                        <span>${line}</span>
                    </button>
                `).join('')}
            </div>
            <div class="vp-answer-frames">
                <div class="vp-mini-title">Answer frames</div>
                <div class="vp-frame-list">
                    ${(v.answerFrames || []).map(frame => `<span>${frame}</span>`).join('')}
                </div>
            </div>
            <div class="vp-prompts">
                <div class="vp-mini-title">Practice prompts</div>
                ${v.speakingPrompts.map((p, i) => `
                    <div class="vp-prompt">
                        <div class="vp-prompt-num">${i + 1}</div>
                        <div class="vp-prompt-text">${p}</div>
                    </div>
                `).join('')}
            </div>
            <div class="vp-recorder" id="vpRecorder">${getSpeakingRecorderHTML(v)}</div>
            ${v.sourceUrl ? `<a class="vp-source-link" href="${v.sourceUrl}" target="_blank" rel="noopener">Open source video</a>` : ''}
            ${v.searchUrl ? `<a class="vp-source-link" href="${v.searchUrl}" target="_blank" rel="noopener">${v.sourceUrl ? 'Find better match' : 'Find matching video'}</a>` : ''}
        </div>
    ` : '';

    overlay.innerHTML = `
        <div class="vp-container">
            <div class="vp-top-bar">
                <button class="vp-back" onclick="closeVideoPlayer()">← Back</button>
                <div class="vp-level-badge" style="background:${level.gradient}">${level.icon} ${level.name}</div>
                ${prevStars > 0 ? `<div class="vp-prev-stars">${'⭐'.repeat(prevStars)}</div>` : ''}
            </div>
            <div class="vp-title">${v.icon} ${v.title}</div>
            <div class="vp-channel">${v.channel} · ${v.duration}</div>

            ${playerHtml}

            <div class="vp-desc">${v.description}</div>
            ${speakingHtml}

            <div class="vp-section-title">📚 Key Vocabulary</div>
            <div class="vp-words-grid">${vocabHtml}</div>

            <button class="vp-quiz-btn" onclick="${v.speakingPrompts ? 'completeSpeakingPractice()' : 'startVideoQuiz()'}">${v.speakingPrompts ? '✅ Complete Speaking Practice' : '🧠 Take Quiz'}${v.speakingPrompts ? '' : ` (${v.quiz.length} questions)`}</button>
        </div>
    `;

    // Create YouTube player
    if (embedId) setTimeout(() => createYTPlayer(embedId), 100);
}

function getSpeakingTimerHTML(video) {
    const cfg = video && video.timerConfig ? video.timerConfig : { prep: 0, speak: 30, label: 'Speaking' };
    const active = videoState.timerLeft > 0;
    return `
        <div class="vp-mini-title">Timed practice</div>
        <div class="vp-timer-display">
            <div class="vp-timer-time">${active ? formatSpeakingTimer(videoState.timerLeft) : cfg.label}</div>
            <div class="vp-timer-label">${active ? videoState.timerLabel : `${cfg.prep ? cfg.prep + 's prep · ' : ''}${cfg.speak}s speak`}</div>
        </div>
        <div class="vp-timer-actions">
            ${cfg.prep ? `<button onclick="startSpeakingTimer(${cfg.prep}, 'Prepare')">Prep</button>` : ''}
            <button onclick="startSpeakingTimer(${cfg.speak}, 'Speak')">Speak</button>
            <button onclick="stopSpeakingTimer()">Reset</button>
        </div>
    `;
}

function formatSpeakingTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function renderSpeakingTimer() {
    const el = document.getElementById('vpTimerPanel');
    if (el) el.innerHTML = getSpeakingTimerHTML(videoState.currentVideo);
}

function startSpeakingTimer(seconds, label) {
    stopSpeakingTimer(false);
    videoState.timerLeft = seconds;
    videoState.timerLabel = label;
    renderSpeakingTimer();
    videoState.timerInterval = setInterval(() => {
        videoState.timerLeft--;
        if (videoState.timerLeft <= 0) {
            stopSpeakingTimer(false);
            showToast(`${label} time finished`);
            return;
        }
        renderSpeakingTimer();
    }, 1000);
}

function stopSpeakingTimer(render) {
    if (videoState.timerInterval) {
        clearInterval(videoState.timerInterval);
        videoState.timerInterval = null;
    }
    videoState.timerLeft = 0;
    videoState.timerLabel = '';
    if (render !== false) renderSpeakingTimer();
}

function getShadowPracticeHTML(video) {
    const lines = (video && video.modelLines) || [];
    if (lines.length === 0) return '';
    const idx = Math.min(videoState.shadowIndex || 0, lines.length - 1);
    return `
        <div class="vp-mini-title">Shadow mode</div>
        <div class="vp-shadow-line">${videoState.shadowActive ? lines[idx] : 'Play one model line, pause, then repeat it aloud.'}</div>
        <div class="vp-shadow-actions">
            <button onclick="startShadowPractice()">Start</button>
            <button onclick="playCurrentShadowLine()" ${videoState.shadowActive ? '' : 'disabled'}>Play line</button>
            <button onclick="nextShadowLine()" ${videoState.shadowActive ? '' : 'disabled'}>Next</button>
        </div>
        ${videoState.shadowActive ? `<div class="vp-shadow-count">Line ${idx + 1}/${lines.length}</div>` : ''}
    `;
}

function renderShadowPractice() {
    const el = document.getElementById('vpShadowPanel');
    if (el) el.innerHTML = getShadowPracticeHTML(videoState.currentVideo);
}

function startShadowPractice() {
    videoState.shadowActive = true;
    videoState.shadowIndex = 0;
    renderShadowPractice();
    playCurrentShadowLine();
}

function playCurrentShadowLine() {
    const lines = (videoState.currentVideo && videoState.currentVideo.modelLines) || [];
    if (lines.length === 0) return;
    const idx = Math.min(videoState.shadowIndex || 0, lines.length - 1);
    speakSpeakingText(lines[idx]);
}

function nextShadowLine() {
    const lines = (videoState.currentVideo && videoState.currentVideo.modelLines) || [];
    if (lines.length === 0) return;
    videoState.shadowIndex = Math.min((videoState.shadowIndex || 0) + 1, lines.length - 1);
    renderShadowPractice();
    playCurrentShadowLine();
}

function getSpeakingRecorderHTML(video) {
    if (!video || !video.speakingPrompts) return '';
    const stats = getVideoStats();
    const rating = stats.speakingRatings && stats.speakingRatings[getVideoProgressId(video)];
    const criteria = rating && rating.criteria ? rating.criteria : {};
    const ratingHtml = IELTS_SPEAKING_CRITERIA.map(c => {
        const buttons = [1, 2, 3, 4, 5].map(score => {
            const active = criteria[c.id] === score ? 'active' : '';
            return `<button class="vp-rate-btn ${active}" onclick="rateSpeakingCriterion('${c.id}', ${score})">${score}</button>`;
        }).join('');
        return `
            <div class="vp-criterion-row">
                <div class="vp-criterion-name">${c.short}</div>
                <div class="vp-rating-buttons">${buttons}</div>
            </div>
        `;
    }).join('');
    const attemptOverall = getSpeakingCriteriaAverage(criteria);
    const bestOverall = getSpeakingRatingOverall(rating);
    return `
        <div class="vp-recorder-title">Record your answer</div>
        <div class="vp-record-note">Recording stays in this session. Your best self-rating is saved.</div>
        <div class="vp-recorder-actions">
            ${videoState.isRecording
                ? '<button class="vp-record-btn stop" onclick="stopSpeakingRecording()">■ Stop</button>'
                : '<button class="vp-record-btn" onclick="startSpeakingRecording()">● Record</button>'}
            <button class="vp-record-btn secondary" onclick="playSpeakingRecording()" ${videoState.recordingUrl ? '' : 'disabled'}>▶ Play</button>
            ${videoState.recordingUrl ? `<a class="vp-record-download" href="${videoState.recordingUrl}" download="${video.id}.webm">Save</a>` : ''}
        </div>
        <div class="vp-rating">
            <span>IELTS self-score</span>
            <span>${attemptOverall ? attemptOverall.toFixed(1) + '/5' : 'Rate all 4 areas'}</span>
        </div>
        <div class="vp-criteria-list">${ratingHtml}</div>
        ${bestOverall ? `<div class="vp-rating-saved">Best saved: ${bestOverall.toFixed(1)}/5</div>` : ''}
    `;
}

function renderSpeakingRecorder() {
    const el = document.getElementById('vpRecorder');
    if (el) el.innerHTML = getSpeakingRecorderHTML(videoState.currentVideo);
}

function resetSpeakingRecording() {
    if (videoState.mediaRecorder && videoState.mediaRecorder.state !== 'inactive') {
        try { videoState.mediaRecorder.stop(); } catch(e) {}
    }
    if (videoState.recordingStream) {
        videoState.recordingStream.getTracks().forEach(track => track.stop());
    }
    if (videoState.recordingUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(videoState.recordingUrl);
    }
    videoState.mediaRecorder = null;
    videoState.recordingStream = null;
    videoState.recordingChunks = [];
    videoState.recordingUrl = null;
    videoState.isRecording = false;
    videoState.recordingMade = false;
}

async function startSpeakingRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        showToast('Recording is not supported on this browser');
        return;
    }
    try {
        resetSpeakingRecording();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        videoState.recordingStream = stream;
        videoState.recordingChunks = [];
        const recorder = new MediaRecorder(stream);
        videoState.mediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) videoState.recordingChunks.push(e.data);
        };
        recorder.onstop = () => {
            const mimeType = videoState.mediaRecorder && videoState.mediaRecorder.mimeType ? videoState.mediaRecorder.mimeType : 'audio/webm';
            const blob = new Blob(videoState.recordingChunks, { type: mimeType });
            videoState.recordingUrl = URL.createObjectURL(blob);
            videoState.isRecording = false;
            videoState.recordingMade = true;
            if (videoState.recordingStream) {
                videoState.recordingStream.getTracks().forEach(track => track.stop());
                videoState.recordingStream = null;
            }
            renderSpeakingRecorder();
        };
        recorder.start();
        videoState.isRecording = true;
        renderSpeakingRecorder();
    } catch (e) {
        showToast('Microphone permission is needed to record');
    }
}

function stopSpeakingRecording() {
    if (!videoState.mediaRecorder || videoState.mediaRecorder.state === 'inactive') return;
    videoState.mediaRecorder.stop();
}

function playSpeakingRecording() {
    if (!videoState.recordingUrl) {
        showToast('Record your answer first');
        return;
    }
    const audio = new Audio(videoState.recordingUrl);
    audio.play();
}

function rateSpeakingCriterion(criteriaId, score) {
    const video = videoState.currentVideo;
    if (!video) return;
    const stats = getVideoStats();
    if (!stats.speakingRatings) stats.speakingRatings = {};
    const progressId = getVideoProgressId(video);
    const existing = stats.speakingRatings[progressId] || {};
    const criteria = Object.assign({}, existing.criteria || {});
    criteria[criteriaId] = score;
    const attemptOverall = getSpeakingCriteriaAverage(criteria);
    const hasAllCriteria = IELTS_SPEAKING_CRITERIA.every(c => typeof criteria[c.id] === 'number');
    const legacyCriteriaComplete = existing.criteria && IELTS_SPEAKING_CRITERIA.every(c => typeof existing.criteria[c.id] === 'number');
    let bestOverall = typeof existing.bestOverall === 'number'
        ? existing.bestOverall
        : legacyCriteriaComplete
            ? getSpeakingCriteriaAverage(existing.criteria)
            : typeof existing.overall === 'number'
                ? existing.overall
                : typeof existing.score === 'number'
                    ? existing.score
                    : 0;
    let bestCriteria = existing.bestCriteria || (legacyCriteriaComplete ? existing.criteria : null);
    if (hasAllCriteria && attemptOverall >= bestOverall) {
        bestOverall = attemptOverall;
        bestCriteria = Object.assign({}, criteria);
    }
    stats.speakingRatings[progressId] = {
        criteria,
        attemptOverall,
        overall: bestOverall,
        bestOverall,
        bestCriteria,
        date: Date.now(),
        completedAt: existing.completedAt || null,
        recordingMade: existing.recordingMade || videoState.recordingMade || false
    };
    saveVideoStats(stats);
    renderSpeakingRecorder();
}

function completeSpeakingPractice() {
    const video = videoState.currentVideo;
    if (!video) return;
    const stats = getVideoStats();
    const progressId = getVideoProgressId(video);
    const rating = stats.speakingRatings[progressId];
    const hasAllCriteria = rating && rating.criteria &&
        IELTS_SPEAKING_CRITERIA.every(c => typeof rating.criteria[c.id] === 'number');
    if (!hasAllCriteria) {
        showToast('Rate fluency, vocabulary, grammar, and pronunciation first');
        return;
    }
    const wasCompleted = stats.watched.includes(progressId);
    if (!wasCompleted) stats.watched.push(progressId);
    const attemptOverall = getSpeakingCriteriaAverage(rating.criteria);
    if (typeof rating.bestOverall !== 'number' || attemptOverall >= rating.bestOverall) {
        rating.bestOverall = attemptOverall;
        rating.bestCriteria = Object.assign({}, rating.criteria);
    }
    rating.overall = rating.bestOverall;
    rating.attemptOverall = attemptOverall;
    rating.completedAt = Date.now();
    rating.recordingMade = rating.recordingMade || videoState.recordingMade || false;
    stats.speakingRatings[progressId] = rating;
    const points = wasCompleted ? 0 : Math.max(5, Math.round(getSpeakingRatingOverall(rating) * 3));
    if (typeof appState !== 'undefined' && appState) {
        appState.points = (appState.points || 0) + points;
    }
    saveVideoStats(stats);
    showSpeakingPracticeResults(video, rating, points);
}

function showSpeakingPracticeResults(video, rating, points) {
    const overlay = document.getElementById('videoPlayerOverlay');
    const overall = getSpeakingRatingOverall(rating);
    const pointsText = points > 0 ? `+${points} points` : 'Practice saved';
    const displayCriteria = rating.bestCriteria || rating.criteria;
    const criteriaHtml = IELTS_SPEAKING_CRITERIA.map(c => `
        <div class="vq-result-line">
            <span>${c.name}</span>
            <strong>${displayCriteria[c.id]}/5</strong>
        </div>
    `).join('');
    overlay.innerHTML = `
        <div class="vq-results">
            <div class="vq-emoji">🎙️</div>
            <div class="vq-score">Speaking practice complete</div>
            <div class="vq-points">Best ${overall.toFixed(1)}/5 · ${pointsText}</div>
            <div class="vq-speaking-breakdown">${criteriaHtml}</div>
            <div class="vq-actions">
                <button class="vq-btn-retry" onclick="renderVideoPlayer()">Practice Again</button>
                <button class="vq-btn-back" onclick="closeVideoPlayer()">Back to IELTS Path</button>
            </div>
        </div>
    `;
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
    stopSpeakingTimer(false);
    resetSpeakingRecording();

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
    const points = stars * 5;

    // Save stats
    const stats = getVideoStats();
    const progressId = getVideoProgressId(v);
    if (!stats.watched.includes(progressId)) stats.watched.push(progressId);
    stats.stars[progressId] = Math.max(stats.stars[progressId] || 0, stars);
    v.vocabulary.forEach(w => {
        if (!stats.wordsLearned.includes(w.word)) stats.wordsLearned.push(w.word);
    });
    stats.totalQuizzes++;

    // Update global points
    if (typeof appState !== 'undefined' && appState && points > 0) {
        appState.points = (appState.points || 0) + points;
    }
    saveVideoStats(stats);

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
function normalizeVideoStats(stats) {
    stats = stats || {};
    if (!Array.isArray(stats.watched)) stats.watched = [];
    if (!stats.stars || typeof stats.stars !== 'object') stats.stars = {};
    if (!Array.isArray(stats.wordsLearned)) stats.wordsLearned = [];
    if (!stats.speakingRatings || typeof stats.speakingRatings !== 'object') stats.speakingRatings = {};
    if (typeof stats.totalQuizzes !== 'number') stats.totalQuizzes = 0;
    return stats;
}

function getVideoStats() {
    if (typeof appState !== 'undefined' && appState && appState.videoStats) {
        return normalizeVideoStats(appState.videoStats);
    }
    return normalizeVideoStats();
}

function saveVideoStats(stats) {
    if (typeof appState !== 'undefined' && appState) {
        appState.videoStats = normalizeVideoStats(stats);
        if (typeof currentUser !== 'undefined' && currentUser) {
            saveUserData(currentUser, appState);
        } else {
            saveUserData();
        }
    }
}
