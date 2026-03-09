// topic-vocab.js - Topic-based vocabulary with visual cards

// ==================== SVG ILLUSTRATIONS ====================
const TOPIC_SVGS = {
    apartment: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="8" width="60" height="84" rx="3" fill="#5B8CCC"/>' +
        '<rect x="20" y="8" width="60" height="10" rx="3" fill="#4A7AB5"/>' +
        '<g fill="rgba(255,255,255,0.85)">' +
        '<rect x="28" y="24" width="9" height="8" rx="1"/><rect x="45" y="24" width="9" height="8" rx="1"/><rect x="62" y="24" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="38" width="9" height="8" rx="1"/><rect x="45" y="38" width="9" height="8" rx="1"/><rect x="62" y="38" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="52" width="9" height="8" rx="1"/><rect x="45" y="52" width="9" height="8" rx="1"/><rect x="62" y="52" width="9" height="8" rx="1"/>' +
        '<rect x="28" y="66" width="9" height="8" rx="1"/><rect x="62" y="66" width="9" height="8" rx="1"/>' +
        '</g><rect x="43" y="66" width="14" height="18" rx="2" fill="#8B6914"/>' +
        '<rect x="45" y="52" width="9" height="8" rx="1" fill="#FFF3CD"/>' +
        '</svg>',

    dormitory: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="25" width="80" height="67" rx="3" fill="#B87333"/>' +
        '<rect x="10" y="25" width="80" height="12" rx="3" fill="#A0522D"/>' +
        '<g fill="rgba(255,255,255,0.8)">' +
        '<rect x="18" y="42" width="10" height="9" rx="1"/><rect x="34" y="42" width="10" height="9" rx="1"/><rect x="56" y="42" width="10" height="9" rx="1"/><rect x="72" y="42" width="10" height="9" rx="1"/>' +
        '<rect x="18" y="58" width="10" height="9" rx="1"/><rect x="34" y="58" width="10" height="9" rx="1"/><rect x="56" y="58" width="10" height="9" rx="1"/><rect x="72" y="58" width="10" height="9" rx="1"/>' +
        '</g><rect x="43" y="72" width="14" height="20" rx="2" fill="#654321"/>' +
        '<rect x="35" y="28" width="30" height="7" rx="2" fill="rgba(255,255,255,0.3)"/>' +
        '</svg>',

    villa: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="20" y="40" width="60" height="52" rx="2" fill="#FFF8DC"/>' +
        '<polygon points="15,42 50,15 85,42" fill="#CC4444"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="28" y="50" width="12" height="14" rx="1"/><rect x="60" y="50" width="12" height="14" rx="1"/>' +
        '</g><rect x="43" y="68" width="14" height="24" rx="2" fill="#8B6914"/>' +
        '<circle cx="54" cy="81" r="1.5" fill="#DAA520"/>' +
        '<circle cx="82" cy="70" r="8" fill="#228B22"/><circle cx="18" cy="72" r="6" fill="#228B22"/>' +
        '</svg>',

    mansion: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="35" width="80" height="57" rx="2" fill="#F5DEB3"/>' +
        '<polygon points="5,37 50,12 95,37" fill="#8B7355"/>' +
        '<rect x="25" y="37" width="4" height="40" fill="#D2B48C"/><rect x="40" y="37" width="4" height="40" fill="#D2B48C"/>' +
        '<rect x="56" y="37" width="4" height="40" fill="#D2B48C"/><rect x="71" y="37" width="4" height="40" fill="#D2B48C"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="30" y="45" width="9" height="11" rx="1"/><rect x="46" y="45" width="9" height="11" rx="1"/><rect x="61" y="45" width="9" height="11" rx="1"/>' +
        '</g><rect x="43" y="70" width="14" height="22" rx="2" fill="#654321"/>' +
        '<polygon points="43,23 50,16 57,23" fill="#DAA520"/>' +
        '</svg>',

    bungalow: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="15" y="50" width="70" height="42" rx="2" fill="#DEB887"/>' +
        '<polygon points="10,52 50,28 90,52" fill="#E67E22"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="22" y="58" width="14" height="12" rx="1"/><rect x="64" y="58" width="14" height="12" rx="1"/>' +
        '</g><rect x="43" y="62" width="14" height="28" rx="2" fill="#8B6914"/>' +
        '<circle cx="54" cy="77" r="1.5" fill="#DAA520"/>' +
        '</svg>',

    cottage: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="22" y="45" width="56" height="47" rx="2" fill="#D2B48C"/>' +
        '<polygon points="17,47 50,22 83,47" fill="#8B4513"/>' +
        '<rect x="66" y="22" width="8" height="20" rx="1" fill="#A0522D"/>' +
        '<ellipse cx="70" cy="18" rx="6" ry="4" fill="rgba(200,200,200,0.5)"/>' +
        '<g fill="rgba(135,206,250,0.7)">' +
        '<rect x="30" y="54" width="12" height="12" rx="1"/><rect x="58" y="54" width="12" height="12" rx="1"/>' +
        '</g><rect x="43" y="68" width="14" height="24" rx="2" fill="#654321"/>' +
        '<rect x="28" y="80" width="6" height="4" fill="#FF6B6B"/><rect x="35" y="80" width="6" height="4" fill="#FFD93D"/>' +
        '</svg>',

    hut: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="25" y="50" width="50" height="42" rx="1" fill="#A0522D"/>' +
        '<polygon points="18,52 50,18 82,52" fill="#DAA520"/>' +
        '<line x1="50" y1="18" x2="30" y2="48" stroke="#C4A35A" stroke-width="2"/>' +
        '<line x1="50" y1="18" x2="70" y2="48" stroke="#C4A35A" stroke-width="2"/>' +
        '<rect x="40" y="65" width="14" height="27" rx="1" fill="#654321"/>' +
        '<rect x="58" y="60" width="8" height="8" rx="1" fill="rgba(255,255,255,0.4)"/>' +
        '</svg>',

    basement: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="40" width="100" height="4" fill="#8B7355"/>' +
        '<rect x="20" y="10" width="60" height="32" rx="2" fill="#DEB887"/>' +
        '<polygon points="15,12 50,0 85,12" fill="#CC4444"/>' +
        '<g fill="rgba(135,206,250,0.7)"><rect x="30" y="18" width="10" height="10" rx="1"/><rect x="60" y="18" width="10" height="10" rx="1"/></g>' +
        '<rect x="20" y="44" width="60" height="50" rx="2" fill="#708090"/>' +
        '<g fill="rgba(255,255,255,0.3)">' +
        '<rect x="28" y="52" width="9" height="7" rx="1"/><rect x="45" y="52" width="9" height="7" rx="1"/><rect x="62" y="52" width="9" height="7" rx="1"/>' +
        '</g>' +
        '<rect x="42" y="64" width="16" height="30" rx="1" fill="#556B7F"/>' +
        '<text x="50" y="80" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="10">B</text>' +
        '</svg>',

    castle: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="25" y="30" width="50" height="62" rx="1" fill="#A9A9A9"/>' +
        '<rect x="10" y="20" width="20" height="72" rx="1" fill="#808080"/>' +
        '<rect x="70" y="20" width="20" height="72" rx="1" fill="#808080"/>' +
        '<g fill="#696969"><rect x="10" y="14" width="5" height="8"/><rect x="18" y="14" width="5" height="8"/><rect x="25" y="14" width="5" height="8"/>' +
        '<rect x="70" y="14" width="5" height="8"/><rect x="78" y="14" width="5" height="8"/><rect x="85" y="14" width="5" height="8"/></g>' +
        '<polygon points="40,30 50,18 60,30" fill="#A9A9A9"/>' +
        '<rect x="43" y="60" width="14" height="32" rx="6 6 0 0" fill="#654321"/>' +
        '<g fill="rgba(255,255,255,0.3)"><rect x="32" y="40" width="8" height="10" rx="1"/><rect x="60" y="40" width="8" height="10" rx="1"/></g>' +
        '<line x1="20" y1="10" x2="20" y2="4" stroke="#666" stroke-width="1.5"/><polygon points="20,4 26,7 20,7" fill="#CC4444"/>' +
        '</svg>',

    temple: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="15" y="60" width="70" height="32" rx="2" fill="#DC143C"/>' +
        '<rect x="20" y="40" width="60" height="22" rx="2" fill="#B22222"/>' +
        '<rect x="28" y="25" width="44" height="17" rx="2" fill="#DC143C"/>' +
        '<polygon points="12,62 50,45 88,62" fill="#FFD700"/>' +
        '<polygon points="18,42 50,28 82,42" fill="#FFD700"/>' +
        '<polygon points="26,27 50,14 74,27" fill="#FFD700"/>' +
        '<rect x="43" y="70" width="14" height="22" rx="2" fill="#8B0000"/>' +
        '<g fill="rgba(255,255,255,0.3)"><rect x="22" y="68" width="8" height="8" rx="1"/><rect x="70" y="68" width="8" height="8" rx="1"/></g>' +
        '</svg>',

    church: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="40" width="60" height="52" rx="2" fill="#F5F5DC"/>' +
        '<polygon points="15,42 50,22 85,42" fill="#4169E1"/>' +
        '<rect x="45" y="8" width="10" height="35" rx="1" fill="#F5F5DC"/>' +
        '<rect x="42" y="4" width="16" height="4" rx="1" fill="#FFD700"/>' +
        '<line x1="50" y1="0" x2="50" y2="8" stroke="#FFD700" stroke-width="2"/>' +
        '<line x1="45" y1="5" x2="55" y2="5" stroke="#FFD700" stroke-width="2"/>' +
        '<rect x="43" y="70" width="14" height="22" rx="2" fill="#8B6914"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="28" y="50" width="10" height="14" rx="4"/><rect x="62" y="50" width="10" height="14" rx="4"/>' +
        '</g>' +
        '<circle cx="50" cy="34" r="3" fill="#FFD700"/>' +
        '</svg>',

    manor: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5" y="88" width="90" height="6" rx="2" fill="#90EE90"/>' +
        '<rect x="30" y="35" width="40" height="55" rx="2" fill="#F5DEB3"/>' +
        '<rect x="5" y="45" width="28" height="45" rx="2" fill="#EED9B7"/>' +
        '<rect x="67" y="45" width="28" height="45" rx="2" fill="#EED9B7"/>' +
        '<polygon points="27,37 50,18 73,37" fill="#8B4513"/>' +
        '<polygon points="3,47 19,35 35,47" fill="#A0522D"/>' +
        '<polygon points="65,47 81,35 97,47" fill="#A0522D"/>' +
        '<g fill="rgba(135,206,250,0.6)">' +
        '<rect x="37" y="44" width="8" height="10" rx="1"/><rect x="55" y="44" width="8" height="10" rx="1"/>' +
        '<rect x="11" y="54" width="7" height="9" rx="1"/><rect x="73" y="54" width="7" height="9" rx="1"/>' +
        '</g>' +
        '<rect x="44" y="65" width="12" height="23" rx="2" fill="#654321"/>' +
        '</svg>'
};

// ==================== HOUSE VOCABULARY DATA ====================
const TOPIC_HOUSE_VOCAB = [
    // --- Buildings (12) ---
    { en: 'apartment', ipa: '/əˈpɑːrtmənt/', vi: 'căn hộ', emoji: '🏢', color: '#E3F2FD', category: 'Buildings', ex: 'She lives in a small apartment downtown.' },
    { en: 'dormitory', ipa: '/ˈdɔːrmɪtɔːri/', vi: 'ký túc xá', emoji: '🏫', color: '#FBE9E7', category: 'Buildings', ex: 'The students share a dormitory room.' },
    { en: 'villa', ipa: '/ˈvɪlə/', vi: 'biệt thự', emoji: '🏡', color: '#E8F5E9', category: 'Buildings', ex: 'They rented a villa by the beach.' },
    { en: 'mansion', ipa: '/ˈmænʃən/', vi: 'dinh thự', emoji: '🏛️', color: '#FFF8E1', category: 'Buildings', ex: 'The mansion has twenty rooms.' },
    { en: 'bungalow', ipa: '/ˈbʌŋɡəloʊ/', vi: 'nhà một tầng', emoji: '🏠', color: '#FFF3E0', category: 'Buildings', ex: 'They bought a cozy bungalow near the lake.' },
    { en: 'cottage', ipa: '/ˈkɑːtɪdʒ/', vi: 'nhà tranh nhỏ', emoji: '🏘️', color: '#EFEBE9', category: 'Buildings', ex: 'The cottage is in the countryside.' },
    { en: 'hut', ipa: '/hʌt/', vi: 'túp lều', emoji: '🛖', color: '#F3E5F5', category: 'Buildings', ex: 'The fisherman lived in a small hut.' },
    { en: 'basement', ipa: '/ˈbeɪsmənt/', vi: 'tầng hầm', emoji: '⬇️', color: '#ECEFF1', category: 'Buildings', ex: 'The basement is used for storage.' },
    { en: 'castle', ipa: '/ˈkæsəl/', vi: 'lâu đài', emoji: '🏰', color: '#E8EAF6', category: 'Buildings', ex: 'The old castle sits on a hill.' },
    { en: 'temple', ipa: '/ˈtempəl/', vi: 'đền', emoji: '⛩️', color: '#FCE4EC', category: 'Buildings', ex: 'They visited an ancient temple.' },
    { en: 'church', ipa: '/tʃɜːrtʃ/', vi: 'nhà thờ', emoji: '⛪', color: '#E1F5FE', category: 'Buildings', ex: 'The church bells ring every Sunday.' },
    { en: 'manor', ipa: '/ˈmænər/', vi: 'trang viên', emoji: '🏡', color: '#F1F8E9', category: 'Buildings', ex: 'The lord lived in the manor house.' },

    // --- Kitchen & Dining (25) ---
    { en: 'spoon', ipa: '/spuːn/', vi: 'thìa', emoji: '🥄', color: '#FFF3E0', category: 'Kitchen', ex: 'She stirred the soup with a spoon.' },
    { en: 'fork', ipa: '/fɔːrk/', vi: 'nĩa', emoji: '🍴', color: '#FFF3E0', category: 'Kitchen', ex: 'He picked up the fork to eat.' },
    { en: 'knife', ipa: '/naɪf/', vi: 'dao', emoji: '🔪', color: '#FFF3E0', category: 'Kitchen', ex: 'Be careful with the sharp knife.' },
    { en: 'plate', ipa: '/pleɪt/', vi: 'đĩa', emoji: '🍽️', color: '#FFF3E0', category: 'Kitchen', ex: 'Put the food on the plate.' },
    { en: 'bowl', ipa: '/boʊl/', vi: 'tô', emoji: '🥣', color: '#FFF3E0', category: 'Kitchen', ex: 'I ate a bowl of rice.' },
    { en: 'cup', ipa: '/kʌp/', vi: 'tách', emoji: '☕', color: '#FFF3E0', category: 'Kitchen', ex: 'Would you like a cup of tea?' },
    { en: 'glass', ipa: '/ɡlæs/', vi: 'ly', emoji: '🥛', color: '#FFF3E0', category: 'Kitchen', ex: 'Pour the water into the glass.' },
    { en: 'pot', ipa: '/pɑːt/', vi: 'nồi', emoji: '🍲', color: '#FFF3E0', category: 'Kitchen', ex: 'The soup is boiling in the pot.' },
    { en: 'pan', ipa: '/pæn/', vi: 'chảo', emoji: '🍳', color: '#FFF3E0', category: 'Kitchen', ex: 'Fry the eggs in the pan.' },
    { en: 'kettle', ipa: '/ˈketl/', vi: 'ấm đun nước', emoji: '🫖', color: '#FFF3E0', category: 'Kitchen', ex: 'The kettle is boiling.' },
    { en: 'oven', ipa: '/ˈʌvən/', vi: 'lò nướng', emoji: '🔲', color: '#FFF3E0', category: 'Kitchen', ex: 'Bake the cake in the oven.' },
    { en: 'stove', ipa: '/stoʊv/', vi: 'bếp', emoji: '♨️', color: '#FFF3E0', category: 'Kitchen', ex: 'She cooked dinner on the stove.' },
    { en: 'microwave', ipa: '/ˈmaɪkroʊweɪv/', vi: 'lò vi sóng', emoji: '📡', color: '#FFF3E0', category: 'Kitchen', ex: 'Heat the food in the microwave.' },
    { en: 'refrigerator', ipa: '/rɪˈfrɪdʒəreɪtər/', vi: 'tủ lạnh', emoji: '🧊', color: '#FFF3E0', category: 'Kitchen', ex: 'Keep the milk in the refrigerator.' },
    { en: 'toaster', ipa: '/ˈtoʊstər/', vi: 'máy nướng bánh mì', emoji: '🍞', color: '#FFF3E0', category: 'Kitchen', ex: 'I made toast with the toaster.' },
    { en: 'sink', ipa: '/sɪŋk/', vi: 'bồn rửa', emoji: '🚰', color: '#FFF3E0', category: 'Kitchen', ex: 'Wash the dishes in the sink.' },
    { en: 'chopsticks', ipa: '/ˈtʃɑːpstɪks/', vi: 'đũa', emoji: '🥢', color: '#FFF3E0', category: 'Kitchen', ex: 'She eats with chopsticks.' },
    { en: 'bottle', ipa: '/ˈbɑːtl/', vi: 'chai', emoji: '🍶', color: '#FFF3E0', category: 'Kitchen', ex: 'Open the bottle of water.' },
    { en: 'jar', ipa: '/dʒɑːr/', vi: 'lọ', emoji: '🏺', color: '#FFF3E0', category: 'Kitchen', ex: 'The jam is in the jar.' },
    { en: 'tray', ipa: '/treɪ/', vi: 'khay', emoji: '🍽️', color: '#FFF3E0', category: 'Kitchen', ex: 'Carry the drinks on a tray.' },
    { en: 'cabinet', ipa: '/ˈkæbɪnət/', vi: 'tủ bếp', emoji: '🗄️', color: '#FFF3E0', category: 'Kitchen', ex: 'The cups are in the cabinet.' },
    { en: 'blender', ipa: '/ˈblendər/', vi: 'máy xay sinh tố', emoji: '🫙', color: '#FFF3E0', category: 'Kitchen', ex: 'Make a smoothie with the blender.' },
    { en: 'napkin', ipa: '/ˈnæpkɪn/', vi: 'khăn ăn', emoji: '🧻', color: '#FFF3E0', category: 'Kitchen', ex: 'Wipe your hands with a napkin.' },
    { en: 'apron', ipa: '/ˈeɪprən/', vi: 'tạp dề', emoji: '👨‍🍳', color: '#FFF3E0', category: 'Kitchen', ex: 'Wear an apron when cooking.' },
    { en: 'dishwasher', ipa: '/ˈdɪʃwɑːʃər/', vi: 'máy rửa bát', emoji: '🫧', color: '#FFF3E0', category: 'Kitchen', ex: 'Put the plates in the dishwasher.' },

    // --- Bedroom (15) ---
    { en: 'bed', ipa: '/bed/', vi: 'giường', emoji: '🛏️', color: '#EDE7F6', category: 'Bedroom', ex: 'The bed is very comfortable.' },
    { en: 'pillow', ipa: '/ˈpɪloʊ/', vi: 'gối', emoji: '💤', color: '#EDE7F6', category: 'Bedroom', ex: 'I need a soft pillow to sleep.' },
    { en: 'blanket', ipa: '/ˈblæŋkɪt/', vi: 'chăn', emoji: '🧣', color: '#EDE7F6', category: 'Bedroom', ex: 'Cover yourself with the blanket.' },
    { en: 'mattress', ipa: '/ˈmætrɪs/', vi: 'nệm', emoji: '🛌', color: '#EDE7F6', category: 'Bedroom', ex: 'This mattress is very firm.' },
    { en: 'curtain', ipa: '/ˈkɜːrtn/', vi: 'rèm cửa', emoji: '🪟', color: '#EDE7F6', category: 'Bedroom', ex: 'Close the curtains at night.' },
    { en: 'wardrobe', ipa: '/ˈwɔːrdroʊb/', vi: 'tủ quần áo', emoji: '👗', color: '#EDE7F6', category: 'Bedroom', ex: 'Hang your clothes in the wardrobe.' },
    { en: 'lamp', ipa: '/læmp/', vi: 'đèn', emoji: '💡', color: '#EDE7F6', category: 'Bedroom', ex: 'Turn on the lamp to read.' },
    { en: 'mirror', ipa: '/ˈmɪrər/', vi: 'gương', emoji: '🪞', color: '#EDE7F6', category: 'Bedroom', ex: 'Look at yourself in the mirror.' },
    { en: 'hanger', ipa: '/ˈhæŋər/', vi: 'móc áo', emoji: '🪝', color: '#EDE7F6', category: 'Bedroom', ex: 'Put the shirt on a hanger.' },
    { en: 'drawer', ipa: '/drɔːr/', vi: 'ngăn kéo', emoji: '🗃️', color: '#EDE7F6', category: 'Bedroom', ex: 'The socks are in the drawer.' },
    { en: 'sheet', ipa: '/ʃiːt/', vi: 'ga trải giường', emoji: '🛏️', color: '#EDE7F6', category: 'Bedroom', ex: 'Change the bed sheets weekly.' },
    { en: 'rug', ipa: '/rʌɡ/', vi: 'thảm nhỏ', emoji: '🟫', color: '#EDE7F6', category: 'Bedroom', ex: 'There is a rug beside the bed.' },
    { en: 'carpet', ipa: '/ˈkɑːrpɪt/', vi: 'thảm trải sàn', emoji: '🟤', color: '#EDE7F6', category: 'Bedroom', ex: 'The carpet covers the whole floor.' },
    { en: 'closet', ipa: '/ˈklɑːzɪt/', vi: 'tủ đồ', emoji: '🚪', color: '#EDE7F6', category: 'Bedroom', ex: 'Keep your shoes in the closet.' },
    { en: 'dresser', ipa: '/ˈdresər/', vi: 'bàn trang điểm', emoji: '💄', color: '#EDE7F6', category: 'Bedroom', ex: 'The dresser has a large mirror.' },

    // --- Bathroom (15) ---
    { en: 'towel', ipa: '/taʊəl/', vi: 'khăn tắm', emoji: '🧖', color: '#E0F7FA', category: 'Bathroom', ex: 'Dry yourself with a towel.' },
    { en: 'soap', ipa: '/soʊp/', vi: 'xà phòng', emoji: '🧼', color: '#E0F7FA', category: 'Bathroom', ex: 'Wash your hands with soap.' },
    { en: 'shampoo', ipa: '/ʃæmˈpuː/', vi: 'dầu gội', emoji: '🧴', color: '#E0F7FA', category: 'Bathroom', ex: 'Use shampoo to wash your hair.' },
    { en: 'toothbrush', ipa: '/ˈtuːθbrʌʃ/', vi: 'bàn chải đánh răng', emoji: '🪥', color: '#E0F7FA', category: 'Bathroom', ex: 'Brush your teeth with a toothbrush.' },
    { en: 'toothpaste', ipa: '/ˈtuːθpeɪst/', vi: 'kem đánh răng', emoji: '🦷', color: '#E0F7FA', category: 'Bathroom', ex: 'Put toothpaste on the brush.' },
    { en: 'shower', ipa: '/ˈʃaʊər/', vi: 'vòi sen', emoji: '🚿', color: '#E0F7FA', category: 'Bathroom', ex: 'I take a shower every morning.' },
    { en: 'bathtub', ipa: '/ˈbæθtʌb/', vi: 'bồn tắm', emoji: '🛁', color: '#E0F7FA', category: 'Bathroom', ex: 'The baby is playing in the bathtub.' },
    { en: 'toilet', ipa: '/ˈtɔɪlɪt/', vi: 'bồn cầu', emoji: '🚽', color: '#E0F7FA', category: 'Bathroom', ex: 'Flush the toilet after use.' },
    { en: 'faucet', ipa: '/ˈfɔːsɪt/', vi: 'vòi nước', emoji: '🚰', color: '#E0F7FA', category: 'Bathroom', ex: 'Turn off the faucet to save water.' },
    { en: 'razor', ipa: '/ˈreɪzər/', vi: 'dao cạo', emoji: '🪒', color: '#E0F7FA', category: 'Bathroom', ex: 'He shaves with a razor.' },
    { en: 'comb', ipa: '/koʊm/', vi: 'lược', emoji: '🪮', color: '#E0F7FA', category: 'Bathroom', ex: 'Comb your hair before going out.' },
    { en: 'sponge', ipa: '/spʌndʒ/', vi: 'miếng bọt biển', emoji: '🧽', color: '#E0F7FA', category: 'Bathroom', ex: 'Clean the sink with a sponge.' },
    { en: 'tissue', ipa: '/ˈtɪʃuː/', vi: 'khăn giấy', emoji: '🧻', color: '#E0F7FA', category: 'Bathroom', ex: 'Take a tissue from the box.' },
    { en: 'scale', ipa: '/skeɪl/', vi: 'cân', emoji: '⚖️', color: '#E0F7FA', category: 'Bathroom', ex: 'Step on the scale to check your weight.' },
    { en: 'hairdryer', ipa: '/ˈherdraɪər/', vi: 'máy sấy tóc', emoji: '💇', color: '#E0F7FA', category: 'Bathroom', ex: 'Use the hairdryer after washing your hair.' },

    // --- Living Room (15) ---
    { en: 'sofa', ipa: '/ˈsoʊfə/', vi: 'ghế sofa', emoji: '🛋️', color: '#FCE4EC', category: 'Living Room', ex: 'Sit down on the sofa.' },
    { en: 'television', ipa: '/ˈtelɪvɪʒn/', vi: 'ti vi', emoji: '📺', color: '#FCE4EC', category: 'Living Room', ex: 'We watch television after dinner.' },
    { en: 'remote', ipa: '/rɪˈmoʊt/', vi: 'điều khiển', emoji: '📱', color: '#FCE4EC', category: 'Living Room', ex: 'Pass me the remote control.' },
    { en: 'bookshelf', ipa: '/ˈbʊkʃelf/', vi: 'kệ sách', emoji: '📚', color: '#FCE4EC', category: 'Living Room', ex: 'The bookshelf is full of novels.' },
    { en: 'cushion', ipa: '/ˈkʊʃn/', vi: 'đệm tựa', emoji: '🟫', color: '#FCE4EC', category: 'Living Room', ex: 'Put a cushion behind your back.' },
    { en: 'vase', ipa: '/veɪs/', vi: 'lọ hoa', emoji: '🏺', color: '#FCE4EC', category: 'Living Room', ex: 'Put the flowers in the vase.' },
    { en: 'painting', ipa: '/ˈpeɪntɪŋ/', vi: 'bức tranh', emoji: '🖼️', color: '#FCE4EC', category: 'Living Room', ex: 'There is a beautiful painting on the wall.' },
    { en: 'clock', ipa: '/klɑːk/', vi: 'đồng hồ', emoji: '🕐', color: '#FCE4EC', category: 'Living Room', ex: 'The clock on the wall shows ten.' },
    { en: 'table', ipa: '/ˈteɪbl/', vi: 'bàn', emoji: '🪑', color: '#FCE4EC', category: 'Living Room', ex: 'Put the books on the table.' },
    { en: 'chair', ipa: '/tʃer/', vi: 'ghế', emoji: '💺', color: '#FCE4EC', category: 'Living Room', ex: 'Please sit on the chair.' },
    { en: 'armchair', ipa: '/ˈɑːrmtʃer/', vi: 'ghế bành', emoji: '🛋️', color: '#FCE4EC', category: 'Living Room', ex: 'Grandpa reads in his armchair.' },
    { en: 'fireplace', ipa: '/ˈfaɪərpleɪs/', vi: 'lò sưởi', emoji: '🔥', color: '#FCE4EC', category: 'Living Room', ex: 'The fireplace keeps the room warm.' },
    { en: 'candle', ipa: '/ˈkændl/', vi: 'nến', emoji: '🕯️', color: '#FCE4EC', category: 'Living Room', ex: 'Light the candle for dinner.' },
    { en: 'fan', ipa: '/fæn/', vi: 'quạt', emoji: '🌀', color: '#FCE4EC', category: 'Living Room', ex: 'Turn on the fan, it is hot.' },
    { en: 'shelf', ipa: '/ʃelf/', vi: 'kệ', emoji: '📦', color: '#FCE4EC', category: 'Living Room', ex: 'Put the photo on the shelf.' },

    // --- Household & Cleaning (15) ---
    { en: 'broom', ipa: '/bruːm/', vi: 'chổi', emoji: '🧹', color: '#E8F5E9', category: 'Household', ex: 'Sweep the floor with a broom.' },
    { en: 'mop', ipa: '/mɑːp/', vi: 'cây lau nhà', emoji: '🧹', color: '#E8F5E9', category: 'Household', ex: 'Mop the kitchen floor.' },
    { en: 'bucket', ipa: '/ˈbʌkɪt/', vi: 'xô', emoji: '🪣', color: '#E8F5E9', category: 'Household', ex: 'Fill the bucket with water.' },
    { en: 'vacuum', ipa: '/ˈvækjuːm/', vi: 'máy hút bụi', emoji: '🧹', color: '#E8F5E9', category: 'Household', ex: 'Vacuum the carpet every week.' },
    { en: 'iron', ipa: '/ˈaɪərn/', vi: 'bàn ủi', emoji: '👔', color: '#E8F5E9', category: 'Household', ex: 'Iron your shirt before work.' },
    { en: 'key', ipa: '/kiː/', vi: 'chìa khóa', emoji: '🔑', color: '#E8F5E9', category: 'Household', ex: 'Do not forget your house key.' },
    { en: 'lock', ipa: '/lɑːk/', vi: 'ổ khóa', emoji: '🔒', color: '#E8F5E9', category: 'Household', ex: 'Lock the door when you leave.' },
    { en: 'plug', ipa: '/plʌɡ/', vi: 'phích cắm', emoji: '🔌', color: '#E8F5E9', category: 'Household', ex: 'Plug in the charger.' },
    { en: 'basket', ipa: '/ˈbæskɪt/', vi: 'giỏ', emoji: '🧺', color: '#E8F5E9', category: 'Household', ex: 'Put the dirty clothes in the basket.' },
    { en: 'detergent', ipa: '/dɪˈtɜːrdʒənt/', vi: 'nước giặt', emoji: '🧴', color: '#E8F5E9', category: 'Household', ex: 'Add detergent to the washing machine.' },
    { en: 'dustpan', ipa: '/ˈdʌstpæn/', vi: 'hót rác', emoji: '🧹', color: '#E8F5E9', category: 'Household', ex: 'Use the dustpan to collect the dirt.' },
    { en: 'clothespin', ipa: '/ˈkloʊðzpɪn/', vi: 'kẹp phơi đồ', emoji: '📌', color: '#E8F5E9', category: 'Household', ex: 'Hang the shirt with a clothespin.' },
    { en: 'trash can', ipa: '/træʃ kæn/', vi: 'thùng rác', emoji: '🗑️', color: '#E8F5E9', category: 'Household', ex: 'Throw it in the trash can.' },
    { en: 'switch', ipa: '/swɪtʃ/', vi: 'công tắc', emoji: '🔘', color: '#E8F5E9', category: 'Household', ex: 'Turn off the light switch.' },
    { en: 'socket', ipa: '/ˈsɑːkɪt/', vi: 'ổ cắm điện', emoji: '🔌', color: '#E8F5E9', category: 'Household', ex: 'Plug the lamp into the socket.' },

    // --- House Parts (15) ---
    { en: 'door', ipa: '/dɔːr/', vi: 'cửa', emoji: '🚪', color: '#E3F2FD', category: 'House Parts', ex: 'Please close the door.' },
    { en: 'window', ipa: '/ˈwɪndoʊ/', vi: 'cửa sổ', emoji: '🪟', color: '#E3F2FD', category: 'House Parts', ex: 'Open the window for fresh air.' },
    { en: 'wall', ipa: '/wɔːl/', vi: 'tường', emoji: '🧱', color: '#E3F2FD', category: 'House Parts', ex: 'Hang the picture on the wall.' },
    { en: 'ceiling', ipa: '/ˈsiːlɪŋ/', vi: 'trần nhà', emoji: '⬆️', color: '#E3F2FD', category: 'House Parts', ex: 'The ceiling is painted white.' },
    { en: 'floor', ipa: '/flɔːr/', vi: 'sàn nhà', emoji: '⬇️', color: '#E3F2FD', category: 'House Parts', ex: 'The floor is made of wood.' },
    { en: 'stairs', ipa: '/sterz/', vi: 'cầu thang', emoji: '🪜', color: '#E3F2FD', category: 'House Parts', ex: 'Walk up the stairs to the bedroom.' },
    { en: 'roof', ipa: '/ruːf/', vi: 'mái nhà', emoji: '🏠', color: '#E3F2FD', category: 'House Parts', ex: 'The roof needs to be repaired.' },
    { en: 'chimney', ipa: '/ˈtʃɪmni/', vi: 'ống khói', emoji: '🏭', color: '#E3F2FD', category: 'House Parts', ex: 'Smoke comes out of the chimney.' },
    { en: 'fence', ipa: '/fens/', vi: 'hàng rào', emoji: '🏗️', color: '#E3F2FD', category: 'House Parts', ex: 'The garden has a wooden fence.' },
    { en: 'gate', ipa: '/ɡeɪt/', vi: 'cổng', emoji: '🚧', color: '#E3F2FD', category: 'House Parts', ex: 'Open the gate for the car.' },
    { en: 'garage', ipa: '/ɡəˈrɑːʒ/', vi: 'nhà để xe', emoji: '🚗', color: '#E3F2FD', category: 'House Parts', ex: 'Park the car in the garage.' },
    { en: 'balcony', ipa: '/ˈbælkəni/', vi: 'ban công', emoji: '🏢', color: '#E3F2FD', category: 'House Parts', ex: 'She drinks coffee on the balcony.' },
    { en: 'garden', ipa: '/ˈɡɑːrdn/', vi: 'vườn', emoji: '🌳', color: '#E3F2FD', category: 'House Parts', ex: 'The children play in the garden.' },
    { en: 'porch', ipa: '/pɔːrtʃ/', vi: 'hiên nhà', emoji: '🏡', color: '#E3F2FD', category: 'House Parts', ex: 'We sit on the porch in the evening.' },
    { en: 'attic', ipa: '/ˈætɪk/', vi: 'gác mái', emoji: '🔺', color: '#E3F2FD', category: 'House Parts', ex: 'Old boxes are stored in the attic.' }
];

// Category display order and icons
const TOPIC_CATEGORIES = [
    { key: 'Buildings', icon: '🏗️', label: 'Building Types' },
    { key: 'Kitchen', icon: '🍴', label: 'Kitchen & Dining' },
    { key: 'Bedroom', icon: '🛏️', label: 'Bedroom' },
    { key: 'Bathroom', icon: '🚿', label: 'Bathroom' },
    { key: 'Living Room', icon: '🛋️', label: 'Living Room' },
    { key: 'Household', icon: '🧹', label: 'Household & Cleaning' },
    { key: 'House Parts', icon: '🚪', label: 'House Parts' }
];

// ==================== TOPIC VIEW RENDERING ====================
function renderTopicView() {
    const lessonStartCard = document.getElementById('lessonStartCard');

    // Hide regular lesson sections
    document.querySelectorAll('.section-title').forEach(el => el.style.display = 'none');
    document.getElementById('lessonHistory').style.display = 'none';
    const mistakesContainer = document.getElementById('mistakesContainer');
    if (mistakesContainer) mistakesContainer.style.display = 'none';
    const historyTabs = document.querySelector('.history-tabs');
    if (historyTabs) historyTabs.style.display = 'none';
    const reviewCard = document.getElementById('reviewCard');
    if (reviewCard) reviewCard.style.display = 'none';

    // Build cards grouped by category
    let html = '';

    TOPIC_CATEGORIES.forEach(cat => {
        const words = TOPIC_HOUSE_VOCAB.filter(w => w.category === cat.key);
        if (words.length === 0) return;

        html += `<div class="topic-category-header">${cat.icon} ${cat.label} <span class="topic-cat-count">${words.length}</span></div>`;
        html += '<div class="topic-cards-grid">';

        words.forEach(word => {
            const svg = TOPIC_SVGS[word.en];
            const imgContent = svg
                ? `<div class="topic-card-img">${svg}</div>`
                : `<div class="topic-card-emoji">${word.emoji}</div>`;

            html += `
                <div class="topic-card" style="background:${word.color}" onclick="speakWord('${word.en.replace(/'/g, "\\'")}')">
                    ${imgContent}
                    <div class="topic-card-word">${word.en}</div>
                    <div class="topic-card-ipa">${word.ipa}</div>
                    <div class="topic-card-vi">${word.vi}</div>
                </div>
            `;
        });

        html += '</div>';

        // Practice button for each category
        html += `<button class="topic-practice-btn" onclick="startTopicPractice('${cat.key}')">
            🎯 Practice ${cat.label}
        </button>`;
    });

    // Random practice all button
    html += `
        <div class="topic-practice-section">
            <button class="topic-practice-btn topic-practice-all" onclick="startTopicPractice('all')">
                ⚡ Practice All (Random 5)
            </button>
        </div>
    `;

    lessonStartCard.style.background = 'transparent';
    lessonStartCard.style.boxShadow = 'none';
    lessonStartCard.style.padding = '0';
    lessonStartCard.innerHTML = html;
}

// ==================== TOPIC PRACTICE (MATCHING GAME) ====================
function startTopicPractice(category) {
    let practiceWords;

    if (category === 'all') {
        practiceWords = shuffleArray([...TOPIC_HOUSE_VOCAB]).slice(0, 5);
    } else {
        const catWords = TOPIC_HOUSE_VOCAB.filter(w => w.category === category);
        practiceWords = shuffleArray([...catWords]).slice(0, Math.min(6, catWords.length));
    }

    if (practiceWords.length < 2) return;

    lessonState = {
        lessonNumber: -2,
        words: practiceWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: practiceWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isPracticeSession: true,
        isTopicPractice: true,
        _startTime: Date.now(),
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    preloadLessonAudio(practiceWords);
    renderMatchingRound();
}

// ==================== RESTORE TOPIC VIEW STATE ====================
function restoreNormalView() {
    document.querySelectorAll('.section-title').forEach(el => el.style.display = '');
    document.getElementById('lessonHistory').style.display = '';
    const mistakesContainer = document.getElementById('mistakesContainer');
    if (mistakesContainer) mistakesContainer.style.display = '';
    const historyTabs = document.querySelector('.history-tabs');
    if (historyTabs) historyTabs.style.display = '';

    const lessonStartCard = document.getElementById('lessonStartCard');
    lessonStartCard.style.boxShadow = '';
    lessonStartCard.style.padding = '';
}
