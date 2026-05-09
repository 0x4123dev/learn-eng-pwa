// grammar-lessons.js — Theory notes for the Grammar tab.
// Summaries of vocabulary, pronunciation, and grammar for each unit
// (Units 8–11), drawn from the Life A2-B1 / TAGT 2 textbook so users can
// review the lesson before doing a quiz.

const GRAMMAR_LESSONS = [
    // ============================================================
    //  UNIT 8 — APPEARANCE
    // ============================================================
    {
        unitId: 'unit8',
        title: 'Appearance',
        icon: '👗',
        color: '#F472B6',
        intro: 'Talk about clothes, festivals, and people\'s appearance using present continuous and have got.',
        lessons: [
            {
                id: '8a', title: 'Global fashions', page: '94-95',
                topicTags: ['clothes', 'present continuous', 'present simple vs continuous', '/s/ vs /ʃ/'],
                vocabulary: {
                    title: 'Clothes',
                    words: ['bag', 'belt', 'coat', 'dress', 'jacket', 'jeans', 'leggings', 'scarf', 'shirt', 'shoes', 'shorts', 'skirt', 'socks', 'suit', 'sunglasses', 'tie', 'top', 'trousers', 'trainers', 'T-shirt', 'uniform']
                },
                pronunciation: {
                    title: '/s/ and /ʃ/',
                    rule: 'The letter "s" can sound /s/ (suit, socks, sunglasses) or /ʃ/ (shoes, shirt, shorts). "Sh" is always /ʃ/.',
                    examples: [
                        '/s/ — suit, socks, skirt, sunglasses',
                        '/ʃ/ — shoes, shirt, shorts'
                    ]
                },
                grammar: [
                    {
                        title: 'Present continuous',
                        rule: 'Use the present continuous for: an action you can see, an action happening now or around the time of speaking, or a changing action.',
                        form: [
                            { label: '+', text: 'Subject + am/is/are + verb-ing' },
                            { label: '−', text: 'Subject + am/is/are + NOT + verb-ing' },
                            { label: '?', text: 'Am/Is/Are + subject + verb-ing?' }
                        ],
                        examples: [
                            'The two women in the photo are making bags.',
                            'The company is training more workers.',
                            'Rags2Riches started in 2007 and it\'s still growing today.',
                            'I\'m not working this week. I\'m on holiday.',
                            'He isn\'t wearing a coat. He looks cold.',
                            'What are you wearing?',
                            'Is she buying that bag? — Yes, she is. / No, she isn\'t.'
                        ]
                    },
                    {
                        title: 'Present simple vs present continuous',
                        rule: 'Use present simple for facts and routines. Use present continuous for actions now or around the time of speaking.',
                        examples: [
                            'Rajo Laurel normally designs clothes for the rich and famous (routine).',
                            'At the moment, he\'s designing some new bags for Rags2Riches (now).',
                            'Today she is visiting an important customer at the office.',
                            'Usually he doesn\'t go to the gym during the week.'
                        ]
                    }
                ]
            },
            {
                id: '8b', title: 'People at festivals', page: '96-97',
                topicTags: ['face & body', 'have got', 'sound and spelling'],
                vocabulary: {
                    title: 'Face and body',
                    words: ['arm', 'beard', 'ear', 'eye', 'foot', 'hair', 'hand', 'head', 'leg', 'mouth', 'neck', 'nose', 'shoulder']
                },
                pronunciation: {
                    title: 'Sound and spelling — vowel sounds',
                    rule: 'Same letters can have different vowel sounds. Match words by SOUND, not spelling.',
                    examples: [
                        'head — leg (/e/)',
                        'shoes — suit (/uː/)',
                        'beard — ears (/ɪə/)',
                        'eye — tie (/aɪ/)',
                        'feet — jeans (/iː/)',
                        'nose — coat (/əʊ/)'
                    ]
                },
                grammar: [
                    {
                        title: 'have got',
                        rule: 'Use have got for: appearance, possessions, family. Same meaning as "have", but used a lot in spoken British English.',
                        form: [
                            { label: '+', text: 'I\'ve got / He\'s got / They\'ve got + ...' },
                            { label: '−', text: 'I haven\'t got / He hasn\'t got + ...' },
                            { label: '?', text: 'Have I got? / Has he got? — Yes, he has. / No, he hasn\'t.' }
                        ],
                        examples: [
                            'I\'ve got one sister. (I have one sister.)',
                            'He hasn\'t got a beard.',
                            'Have they got a car? — Yes, they have. / No, they haven\'t.',
                            'She\'s got long hair and blue eyes.',
                            'Note: He\'s tall = he is. He\'s got long hair = he has.'
                        ]
                    }
                ]
            },
            {
                id: '8c', title: 'Pink and blue', page: '98-99',
                topicTags: ['toys', 'word focus: like'],
                vocabulary: {
                    title: 'Possessions and toys',
                    words: ['toy', 'doll', 'jewellery', 'make-up', 'unusual', 'superhero', 'dinosaur', 'advertisement', 'possessions']
                },
                grammar: [
                    {
                        title: 'Word focus: like',
                        rule: 'The word "like" has three different uses. Choose the right meaning by context.',
                        examples: [
                            'There are blue toys LIKE robots, dinosaurs and superheroes. → such as',
                            'Girls LIKE pink make-up, clothes, or toys for cooking. → love / enjoy',
                            'Many of these girls were LIKE Seowoo and had lots of pink things. → similar to'
                        ]
                    }
                ]
            },
            {
                id: '8d', title: 'Talking about photos', page: '100',
                topicTags: ['describing photos', 'silent letters'],
                pronunciation: {
                    title: 'Silent letters',
                    rule: 'Some letters are written but not pronounced. Listen carefully to which letter is silent.',
                    examples: [
                        'interesting (silent e — middle e)',
                        'sometimes (silent e — final e)',
                        'everyday (silent e)',
                        'listening (silent t)',
                        'blonde (silent e)',
                        'closely (silent e)'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Talking about pictures and photos',
                        rule: 'Useful phrases for describing what you see in a photograph.',
                        examples: [
                            'Introduce: This photo shows … / I can see …',
                            'Location: On the left/right, in the middle, at the front/back',
                            'People: She looks happy / sad / bored / nervous. He is reading / sleeping / thinking.',
                            'Opinion: I think …, I like it because it\'s a beautiful picture.'
                        ]
                    }
                ]
            },
            {
                id: '8e', title: 'Short and simple', page: '101',
                topicTags: ['writing short messages', 'KISS rules'],
                grammar: [
                    {
                        title: 'Writing skill — The KISS rules (Keep It Short and Simple)',
                        rule: 'When you send short messages, follow these six rules to keep them clear and quick.',
                        examples: [
                            '1. Don\'t add unnecessary information.',
                            '2. Use numbers (not words) where possible. ("Let\'s speak at 2" not "at two")',
                            '3. Don\'t use long sentences with lots of conjunctions.',
                            '4. Don\'t use two sentences when one is enough.',
                            '5. Use less formal words and phrases.',
                            '6. Miss out some words such as pronouns and auxiliary verbs. ("Please call me" not "Please can you call me")'
                        ]
                    }
                ]
            },
            {
                id: '8f', title: 'Festivals and special events', page: '102-103',
                topicTags: ['festival adjectives', 'video lesson'],
                vocabulary: {
                    title: 'Festival adjectives',
                    words: ['boring', 'colourful', 'crowded', 'exciting', 'fun', 'loud', 'noisy', 'popular', 'quiet', 'relaxing']
                }
            }
        ]
    },

    // ============================================================
    //  UNIT 9 — ENTERTAINMENT
    // ============================================================
    {
        unitId: 'unit9',
        title: 'Entertainment',
        icon: '🎬',
        color: '#A78BFA',
        intro: 'Talk about films, TV, art, and arrange to go out using "be going to" and the infinitive of purpose.',
        lessons: [
            {
                id: '9a', title: 'The Tallgrass Film Festival', page: '106-107',
                topicTags: ['films', 'be going to', '/tə/'],
                vocabulary: {
                    title: 'Films',
                    words: ['animation', 'comedy', 'documentary', 'fantasy', 'horror film', 'romantic comedy', 'science-fiction film', 'thriller'],
                    note: 'See vs watch: "I went TO SEE a film at the cinema" (the event). "I like WATCHING films with friends" (the activity).'
                },
                pronunciation: {
                    title: '/tə/ — weak "to"',
                    rule: 'In connected speech, "to" before a verb is reduced to a weak /tə/ sound.',
                    examples: [
                        'I\'m going /tə/ buy a ticket.',
                        'Are you going /tə/ see the film?',
                        'I\'m going /tə/ watch it later.'
                    ]
                },
                grammar: [
                    {
                        title: 'be going to (for plans)',
                        rule: 'Use "be going to" + base verb to talk about future plans (something already decided).',
                        form: [
                            { label: '+', text: 'Subject + am/is/are + going to + base verb' },
                            { label: '−', text: 'Subject + am/is/are NOT + going to + base verb' },
                            { label: '?', text: 'Am/Is/Are + subject + going to + base verb?' }
                        ],
                        examples: [
                            'I\'m going to buy a ticket for the next film.',
                            'I\'m not going to stay out late.',
                            'What are you going to see?',
                            'Are you going to see the film? — Yes, I am. / No, I\'m not.',
                            'Tip: We don\'t usually say "going to GO". Say "I\'m going to work" not "I\'m going to go to work".'
                        ]
                    }
                ]
            },
            {
                id: '9b', title: "What's the future for TV?", page: '108-109',
                topicTags: ['TV programmes', 'infinitive of purpose'],
                vocabulary: {
                    title: 'TV programmes & opinions',
                    words: ['sports programme', 'comedy show', 'quiz show', 'horror film', 'drama series', 'wildlife documentary', 'the news'],
                    note: 'Adjectives to describe shows: funny, interesting, violent, scary, exciting, fun, boring.'
                },
                grammar: [
                    {
                        title: 'Infinitive of purpose',
                        rule: 'Use TO + base verb to give the REASON for an action (= "in order to").',
                        examples: [
                            'Turn on the TV TO WATCH the news.',
                            'Go online TO FIND a "How to" video.',
                            'I\'m going to record this film TO WATCH it later.',
                            'I\'m going to London tomorrow TO MEET some friends.',
                            'Q: Why are you going? — A: To meet some friends.'
                        ]
                    }
                ]
            },
            {
                id: '9c', title: 'Nature in art', page: '110-111',
                topicTags: ['nature', 'like vs prefer'],
                vocabulary: {
                    title: 'Nature',
                    words: ['birds', 'flowers', 'grass', 'lakes', 'leaves', 'mountains', 'rocks', 'sea', 'sky', 'trees', 'landscape']
                },
                grammar: [
                    {
                        title: 'like vs prefer',
                        rule: '"Prefer" means like one thing more than another. Use it to compare two options.',
                        examples: [
                            'Many people LIKE Witkiewicz\'s paintings of people\'s faces, but I PREFER his paintings of landscapes.',
                            'I PREFER his other paintings, but many people love the sunflower paintings.',
                            'A: Which picture do you prefer? 1 or 2? — B: I prefer 2 because…'
                        ]
                    }
                ]
            },
            {
                id: '9d', title: 'Making arrangements', page: '112',
                topicTags: ['inviting', 'arrangements', 'enthusiasm stress'],
                pronunciation: {
                    title: 'Showing enthusiasm — stress on the key word',
                    rule: 'When you accept an invitation enthusiastically, put strong stress on one key word to sound excited.',
                    examples: [
                        'I\'d LOVE to!',
                        'I\'d really LIKE to!',
                        'That\'s GREAT!',
                        'That sounds FANTASTIC!'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Inviting and making arrangements',
                        rule: 'Common phrases for inviting someone, responding to an invitation, and arranging a time/place.',
                        examples: [
                            'Inviting: Would you like to come? — Are you free? — Do you want to go?',
                            'Accepting: Thanks. I\'d love to. / That\'s great.',
                            'Refusing: I\'m sorry, but I\'m working late tonight.',
                            'Arranging: What time does it start? — Let\'s meet at seven. — See you at seven.'
                        ]
                    }
                ]
            },
            {
                id: '9e', title: 'It looks amazing!', page: '113',
                topicTags: ['reviews', 'sense verbs'],
                grammar: [
                    {
                        title: 'Writing skill — Sense verbs in reviews',
                        rule: 'Use sense verbs + adjective to give your opinion in reviews. The five sense verbs are: look, feel, sound, taste, smell.',
                        examples: [
                            'They look amazing! (sight)',
                            'It tasted great. (taste)',
                            'It sounds very slow. (sound)',
                            'It smells awful! (smell)',
                            'I felt scared at the beginning. (feel)'
                        ]
                    }
                ]
            },
            {
                id: '9f', title: 'Filming wildlife', page: '114-115',
                topicTags: ['wildlife', 'video lesson'],
                vocabulary: {
                    title: 'Wildlife filming',
                    words: ['camera trap', 'rainforest', 'kinkajou', 'ocelot', 'Honduras', 'wildlife', 'documentary']
                }
            }
        ]
    },

    // ============================================================
    //  UNIT 10 — LEARNING
    // ============================================================
    {
        unitId: 'unit10',
        title: 'Learning',
        icon: '📚',
        color: '#60A5FA',
        intro: 'Talk about subjects, experiences, memory, and habits using the present perfect and past simple.',
        lessons: [
            {
                id: '10a', title: 'What have we learned?', page: '118-119',
                topicTags: ['learning verbs', 'synonyms & antonyms', 'present perfect'],
                vocabulary: {
                    title: 'Learning verbs',
                    words: ['learn', 'study', 'pass', 'fail', 'forget', 'remember', 'know', 'understand', 'teach', 'discover', 'invent', 'design', 'practise'],
                    note: 'Synonyms — words with similar meanings: learn = study. Antonyms — words with opposite meanings: pass ≠ fail.'
                },
                grammar: [
                    {
                        title: 'Present perfect',
                        rule: 'Use the present perfect to talk about something that happened in the past but is connected to NOW (we don\'t say exactly when).',
                        form: [
                            { label: '+', text: 'Subject + have/has + past participle' },
                            { label: '−', text: 'Subject + haven\'t/hasn\'t + past participle' },
                            { label: '?', text: 'Have/Has + subject + past participle?' }
                        ],
                        examples: [
                            'I\'ve learned the vocabulary for the test.',
                            'He\'s invented a new robot.',
                            'We\'ve discovered a new type of medicine.',
                            'I haven\'t done my homework. He hasn\'t passed the exam.',
                            'Have you forgotten his phone number? — Yes, I have. / No, I haven\'t.',
                            'Note: Regular verbs add -ed (learn → learned). Irregular verbs have their own forms (do → done, go → been/gone).'
                        ]
                    },
                    {
                        title: 'Have you ever …?',
                        rule: 'Use "Have you ever ...?" to ask about past experiences. Use "never" in negative answers.',
                        examples: [
                            'Have you ever studied French? — No, I\'ve never studied French.',
                            'Have you ever failed a test? — Yes, I have. I\'ve failed my driving test twice!',
                            'Have you ever met a famous person?'
                        ]
                    }
                ]
            },
            {
                id: '10b', title: 'How good is your memory?', page: '120-121',
                topicTags: ['memory', 'present perfect vs past simple'],
                vocabulary: {
                    title: 'Things to remember',
                    words: ['names and faces', 'directions', 'addresses', 'telephone numbers', 'dates', 'facts', 'shopping lists', 'songs']
                },
                grammar: [
                    {
                        title: 'Present perfect vs Past simple',
                        rule: 'Both tenses talk about the past. The choice depends on whether we say WHEN it happened.',
                        form: [
                            { label: 'Past simple', text: 'when we KNOW or SAY the exact time' },
                            { label: 'Present perfect', text: 'when we DON\'T say or know the exact time' }
                        ],
                        examples: [
                            'Nelson HAS WON the USA Memory Championship four times. (general — no exact time)',
                            'He WON the competition in 2011, 2012, 2014 and again in 2015. (exact times)',
                            'My friend HAS PASSED his maths exam twice. He FAILED it last year and this year.',
                            'Have you ever studied in another country? — Yes, I\'ve studied in Mexico. (experience)',
                            'When did you study there? — I studied in Mexico in 1993. (specific time)'
                        ]
                    }
                ]
            },
            {
                id: '10c', title: 'Good learning habits', page: '122-123',
                topicTags: ['daily habits', 'word focus: up'],
                vocabulary: {
                    title: 'Daily habits',
                    words: ['drinking coffee', 'brushing teeth', 'swimming', 'biting fingernails', 'eating chocolate', 'checking phone', 'smoking', 'practising guitar', 'putting sugar in tea', 'eating breakfast', 'learning new words']
                },
                grammar: [
                    {
                        title: 'Word focus: up',
                        rule: 'Many phrasal verbs combine a verb with "up". Each combination has its own meaning.',
                        examples: [
                            'get up = get out of bed (He gets up at 6.30 a.m.)',
                            'wake up = stop sleeping (We wake up at seven every day.)',
                            'give up = stop doing a bad habit (They want to give up smoking.)',
                            'go up = increase (The cost of food goes up in the winter.)',
                            'dress up = wear fun or nice clothes (I always dress up for a party.)'
                        ]
                    }
                ]
            },
            {
                id: '10d', title: 'Communication problems', page: '124',
                topicTags: ['checking & clarifying', 'contrastive stress'],
                pronunciation: {
                    title: 'Contrastive stress',
                    rule: 'When you correct information, put strong stress on the corrected word — that signals the change to the listener.',
                    examples: [
                        'A: Is that three in the MORNING? — B: No, in the AFTERNOON.',
                        'A: Was that the ENCASA Hotel? — B: No, the ANCASA Hotel. A for apple.',
                        'A: Is that E for England? — B: No, it\'s A for apple.'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Checking and clarifying',
                        rule: 'When you can\'t hear or understand on the phone, use these phrases to check the information.',
                        examples: [
                            'Is that three in the morning? — No, in the afternoon.',
                            'Was that the Encasa Hotel? — No, the Ancasa Hotel. A for apple.',
                            'The number is 603 2169 2266. — So that\'s 603 2169 2266.',
                            'Have you called our colleagues? — Yes, I have.',
                            'Have you emailed me all the designs? — No, I haven\'t.'
                        ]
                    }
                ]
            },
            {
                id: '10e', title: 'Please leave a message', page: '125',
                topicTags: ['email & websites', 'imperatives'],
                vocabulary: {
                    title: 'Email addresses & websites',
                    words: ['@ = at', '. = dot', '_ = underscore', '/ = slash', '- = hyphen'],
                    note: 'Example: j_jones@hotmail.co.uk → "j underscore jones at hotmail dot co dot uk"'
                },
                grammar: [
                    {
                        title: 'Writing skill — Imperatives in messages',
                        rule: 'When you write a phone message, simplify what the speaker said by using the IMPERATIVE form (= just the base verb, no subject).',
                        examples: [
                            'Speaker: "He can download them from this address: omarox.com/a-1"',
                            'Message: "Download them from omarox.com/a-1."',
                            'Speaker: "Can you call Jim back this evening?"',
                            'Message: "Call Jim back this evening."'
                        ]
                    }
                ]
            },
            {
                id: '10f', title: 'Memory and language learning', page: '126-127',
                topicTags: ['memory', 'video lesson'],
                vocabulary: {
                    title: 'Language learning',
                    words: ['alphabet', 'classroom', 'pronunciation', 'memorize', 'repeat', 'translate', 'vocabulary', 'practice', 'fluent']
                }
            }
        ]
    },

    // ============================================================
    //  UNIT 11 — TOURISM
    // ============================================================
    {
        unitId: 'unit11',
        title: 'Tourism',
        icon: '✈️',
        color: '#34D399',
        intro: 'Plan trips, give advice and suggestions, and use have to / can / should for rules and recommendations.',
        lessons: [
            {
                id: '11a', title: 'Planning a trip', page: '130-131',
                topicTags: ['in another country', 'have to / can', '/hæftə/'],
                vocabulary: {
                    title: 'In another country',
                    words: ['climate', 'currency', 'licence', 'multicultural', 'right-hand side', 'temperature', 'visa', 'language', 'road travel', 'weather', 'money', 'visas']
                },
                pronunciation: {
                    title: '/hæftə/',
                    rule: '"have to" is pronounced /hæftə/ in connected speech (one quick word, not two).',
                    examples: [
                        'I /hæftə/ get a visa.',
                        'You /hæftə/ start work at nine.',
                        'Tourists don\'t /hæftə/ get a new licence.'
                    ]
                },
                grammar: [
                    {
                        title: 'have to / don\'t have to / can / can\'t',
                        rule: 'Use these modals to talk about rules. They are followed by the BASE FORM of the main verb.',
                        form: [
                            { label: 'have to', text: 'necessary (a rule you must follow)' },
                            { label: "don't have to", text: 'not necessary (it\'s your choice)' },
                            { label: 'can', text: 'possible / allowed' },
                            { label: "can't", text: 'not possible / not allowed' }
                        ],
                        examples: [
                            'You HAVE TO get a holiday visa from the Australian Embassy.',
                            'Tourists DON\'T HAVE TO get a new driving licence.',
                            'Tourists CAN stay for a maximum of six months.',
                            'You CAN\'T work in Australia without a work visa.',
                            'Business class passengers don\'t have to wait.',
                            'All passengers have to show their passport.'
                        ]
                    }
                ]
            },
            {
                id: '11b', title: 'On holiday', page: '132-133',
                topicTags: ['tourism', 'word families', "should/shouldn't", 'word focus: take'],
                vocabulary: {
                    title: 'Tourism',
                    words: ['return ticket', 'single ticket', 'carry-on bag', 'book the hotel', 'rent a car', 'buy souvenirs', 'tour guide', 'sightseeing', 'public transport', 'local food', 'check in'],
                    note: 'Word families — when you learn a new word, learn the family: tour (verb) → tourism (noun) → tourist (person) → tour guide.'
                },
                grammar: [
                    {
                        title: 'should / shouldn\'t',
                        rule: 'Use should/shouldn\'t to give ADVICE. Followed by the base form. No auxiliary do/does in negatives or questions.',
                        form: [
                            { label: '+', text: 'Subject + should + base verb' },
                            { label: '−', text: 'Subject + shouldn\'t + base verb' },
                            { label: '?', text: 'Should + subject + base verb?' }
                        ],
                        examples: [
                            'You SHOULD rent a car.',
                            'You SHOULDN\'T go in the winter.',
                            'SHOULD I go with a tour guide? — Yes, you should. / No, you shouldn\'t.',
                            'You should take a holiday. You shouldn\'t take the bus.'
                        ]
                    },
                    {
                        title: 'Word focus: take',
                        rule: '"Take" pairs with different types of nouns to form common collocations.',
                        examples: [
                            'take + time when you stop work: take a break, take a holiday',
                            'take + type of transport: take a taxi, take the bus',
                            'take + an object: take an umbrella, take some words'
                        ]
                    }
                ]
            },
            {
                id: '11c', title: 'Should I go there?', page: '134-135',
                topicTags: ['Antarctica', 'reasons for/against', 'something / nobody / anywhere'],
                grammar: [
                    {
                        title: 'something, nobody, anywhere — compound pronouns',
                        rule: 'Combine some-/any-/no- with -thing/-body/-where to talk about people, places, and objects/activities.',
                        form: [
                            { label: '-thing', text: 'an object or activity' },
                            { label: '-body', text: 'a person' },
                            { label: '-where', text: 'a place' }
                        ],
                        examples: [
                            'I\'d like to do SOMETHING exciting. (positive sentence → some-)',
                            'There isn\'t ANYTHING in my bag! (negative sentence → any-)',
                            'Is there ANYWHERE in the world without other people? (question → any-)',
                            'NOBODY lives there. (no- = positive verb but negative meaning)',
                            'I need something to eat. — Does anyone want to go sightseeing with me?'
                        ]
                    }
                ]
            },
            {
                id: '11d', title: 'A holiday in South America', page: '136',
                topicTags: ['making suggestions', '/ʌ/ /ʊ/ /uː/'],
                pronunciation: {
                    title: '/ʌ/, /ʊ/ or /uː/',
                    rule: 'Three vowel sounds that look similar in spelling but sound different. Listen carefully and learn each word\'s sound.',
                    examples: [
                        '/ʌ/ — bus, but, love',
                        '/ʊ/ — could, should, book',
                        '/uː/ — cruise, food, you'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Making suggestions',
                        rule: 'Several common phrases to suggest an idea and to respond.',
                        examples: [
                            'Suggesting: You SHOULD go there. — How about visiting the Himalayas? — Can I make a suggestion?',
                            'Suggesting: Why don\'t you go on a tour? — You COULD travel on your own.',
                            'Responding +: Maybe you\'re right. / That\'s a really good idea.',
                            'Responding −: But the disadvantage is that it\'s expensive. / But the advantage is that it\'s with a tour guide.'
                        ]
                    }
                ]
            },
            {
                id: '11e', title: 'A questionnaire', page: '137',
                topicTags: ['hotel feedback', 'open & closed questions'],
                grammar: [
                    {
                        title: 'Writing skill — Closed and open questions',
                        rule: 'Good questionnaires use BOTH types. Closed = yes/no answer. Open = longer answer.',
                        examples: [
                            'CLOSED — Did the tour guide answer all your questions? (yes/no)',
                            'CLOSED — Were all our staff polite and helpful? (yes/no)',
                            'OPEN — How was your bus tour? (longer answer)',
                            'OPEN — What other suggestions can you make? (longer answer)',
                            'Tip: Ask a closed question first, then a follow-up open question for more detail.'
                        ]
                    }
                ]
            },
            {
                id: '11f', title: 'A tour of London', page: '138-139',
                topicTags: ['London buildings', 'video lesson'],
                vocabulary: {
                    title: 'London landmarks',
                    words: ['the Shard', 'the Gherkin', 'the Cheesegrater', 'the Walkie-Talkie', 'Tower Bridge', 'River Thames', 'football pitch']
                }
            }
        ]
    }
];

// ==================== HELPERS ====================

function getGrammarLessonsForUnit(unitId) {
    const u = GRAMMAR_LESSONS.find(x => x.unitId === unitId);
    return u ? u.lessons : [];
}

function getGrammarLesson(unitId, lessonId) {
    const lessons = getGrammarLessonsForUnit(unitId);
    return lessons.find(l => l.id === lessonId) || null;
}

// Build a quiz from the question bank that matches a lesson's topicTags.
// Returns an array of question objects (or [] if no matches).
function getLessonPracticeQuestions(unitId, lessonId, max) {
    const lesson = getGrammarLesson(unitId, lessonId);
    if (!lesson || !lesson.topicTags) return [];
    const unit = (typeof getGrammarUnit === 'function') ? getGrammarUnit(unitId) : null;
    if (!unit) return [];
    const tags = lesson.topicTags.map(t => t.toLowerCase());
    const matched = unit.questions.filter(q => {
        const t = (q.topic || '').toLowerCase();
        return tags.some(tag => t.includes(tag) || tag.includes(t));
    });
    // Shuffle deterministically-randomly
    const shuffled = matched.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, max || 10);
}
