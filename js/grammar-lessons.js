// grammar-lessons.js — Theory notes for the Grammar tab.
// Summaries of vocabulary, pronunciation, and grammar for each unit
// (Units 1-11), drawn from the Life Elementary / A2-B1 textbooks so users
// can review the lesson before doing a quiz.
//
// v3.36: every unit consolidated to 4 sub-lessons (a/b/c/d) — the last
// three originals (d/e/f) merged into a single "d" card to keep the UI
// compact.

const GRAMMAR_LESSONS = [
    {
        unitId: 'unit1',
        title: 'People',
        icon: '👋',
        color: '#3a86ff',
        intro: 'Introduce yourself, talk about families, and use the verb "be" (am/is/are).',
        iCanGoals: [
            'Use the verb be in sentences',
            'Talk about personal information',
            'Talk about families',
            'Use possessive \'s and possessive adjectives',
            'Use everyday verbs',
            'Introduce myself and other people'
        ],
        lessons: [
            {
                id: '1a',
                title: 'Explorers',
                page: '10-11',
                topicTags: ['personal information', 'be (am/is/are)', 'be negative', 'be questions', 'contracted forms'],
                vocabulary: {
                    title: 'Personal information',
                    words: [
                        'first name',
                        'surname',
                        'job',
                        'occupation',
                        'place of birth',
                        'married',
                        'single',
                        'relationship',
                        'photographer',
                        'journalist',
                        'explorer',
                        'filmmaker',
                        'teacher',
                        'student',
                        'businessman'
                    ],
                    note: 'Beverley & Dereck Joubert are National Geographic explorers and filmmakers in Botswana.'
                },
                pronunciation: {
                    title: 'Contracted forms of "be"',
                    rule: 'In spoken English we usually contract the verb "be". Learn the contractions and listen for them.',
                    examples: [
                        '\'m  = am  (I\'m a photographer)',
                        '\'re = are (You/We/They\'re married)',
                        '\'s  = is  (He/She/It\'s from South Africa)',
                        '\'m not = am not  (I\'m not a journalist)',
                        'aren\'t = are not (We aren\'t here today)',
                        'isn\'t  = is not  (He isn\'t from South America)'
                    ]
                },
                grammar: [
                    {
                        title: 'be (am/is/are)',
                        rule: 'Use "be" to talk about names, jobs, nationality, age, marital status, etc. Form changes with the subject.',
                        form: [
                            {
                                label: 'I',
                                text: 'I am / I\'m'
                            },
                            {
                                label: 'you/we/they',
                                text: 'you/we/they are / \'re'
                            },
                            {
                                label: 'he/she/it',
                                text: 'he/she/it is / \'s'
                            }
                        ],
                        examples: [
                            'I\'m a photographer.',
                            'You\'re married.',
                            'He\'s from South Africa.',
                            'We\'re here for a holiday.',
                            'She is single. (She\'s single.)',
                            'They are explorers. (They\'re explorers.)'
                        ]
                    },
                    {
                        title: 'be — negative and questions',
                        rule: 'Negative: subject + be + NOT. Question: be + subject? Short answers use the full pronoun + be (no contraction at end of YES answer).',
                        examples: [
                            'I\'m not a journalist.',
                            'He isn\'t from South America.',
                            'They aren\'t married.',
                            'What\'s your name? — My name\'s Mike.',
                            'Where are they from? — They\'re from Brazil.',
                            'How old is he? — He\'s thirty-six.',
                            'Are you from Botswana? — Yes, I am. / No, I\'m not.',
                            'Is she single? — Yes, she is. / No, she isn\'t.'
                        ]
                    }
                ]
            },
            {
                id: '1b',
                title: 'A family in Kenya',
                page: '12-13',
                topicTags: ['family', 'possessive \'s', 'possessive adjectives', 'same or different sounds', 'word roots'],
                vocabulary: [
                    {
                        title: 'Family',
                        words: ['aunt', 'cousin', 'father', 'grandparent', 'half-brother', 'mother', 'mother-in-law', 'nephew', 'niece', 'parent', 'stepbrother', 'uncle'],
                        note: 'Men only: father, grandfather, half-brother, nephew, stepbrother, uncle. Women only: aunt, mother, mother-in-law, niece. Both: cousin, grandparent, parent.'
                    },
                    {
                        title: 'Word roots',
                        words: [
                            'mother → grandmother → stepmother → mother-in-law',
                            'father → grandfather → stepfather → father-in-law',
                            'sister → stepsister → half-sister → sister-in-law',
                            'brother → stepbrother → half-brother → brother-in-law'
                        ],
                        note: 'Learn one root word, then build the family by adding "grand-", "step-", "half-", or "-in-law".'
                    }
                ],
                pronunciation: {
                    title: 'Same or different sounds',
                    rule: 'Some pronouns and their possessive forms sound IDENTICAL (homophones). Others have slightly different vowel sounds.',
                    examples: [
                        'they\'re / their — SAME /ðeə(r)/',
                        'he\'s /hiːz/ vs his /hɪz/ — DIFFERENT',
                        'its / it\'s — SAME /ɪts/',
                        'are /ɑː(r)/ vs our /aʊə(r)/ — DIFFERENT',
                        'you\'re / your — SAME /jʊə(r)/'
                    ]
                },
                grammar: [
                    {
                        title: 'Possessive \'s',
                        rule: 'Add \'s to a name or noun to show possession (ownership / family relation).',
                        examples: [
                            'Mike\'s wife is a teacher.',
                            'Louise\'s mother is Meave.',
                            'Mike and Sally\'s home is in Canada. (two owners → \'s only on the second name)',
                            'Note: \'s can also = "is" — "She\'s a teacher" (\'s = is). Use context to tell.'
                        ]
                    },
                    {
                        title: 'Possessive adjectives',
                        rule: 'Every subject pronoun has a matching possessive adjective. Use them BEFORE a noun.',
                        form: [
                            {
                                label: 'I',
                                text: 'my'
                            },
                            {
                                label: 'you',
                                text: 'your'
                            },
                            {
                                label: 'he',
                                text: 'his'
                            },
                            {
                                label: 'she',
                                text: 'her'
                            },
                            {
                                label: 'it',
                                text: 'its (no apostrophe!)'
                            },
                            {
                                label: 'we',
                                text: 'our'
                            },
                            {
                                label: 'they',
                                text: 'their'
                            }
                        ],
                        examples: [
                            'She\'s MY sister.',
                            'What\'s YOUR name?',
                            'HIS name is Charlie.',
                            'OUR family is from Asia.',
                            'THEIR cousins are both girls.'
                        ]
                    }
                ]
            },
            {
                id: '1c',
                title: 'The face of seven billion people',
                page: '14-15',
                topicTags: ['numbers', 'percentages', 'everyday verbs', 'word focus: in'],
                vocabulary: [
                    {
                        title: 'Numbers & percentages',
                        words: [
                            '1 billion',
                            '1.3 billion (one point three billion)',
                            '3.5 billion',
                            '5.5 billion',
                            '7 billion',
                            '23% (twenty-three per cent)',
                            '38%',
                            '51%'
                        ],
                        note: 'The decimal point is read as "point". 1.3 = "one point three". "Per cent" (BrE) / "percent" (AmE).'
                    },
                    {
                        title: 'Everyday verbs',
                        words: ['have', 'live', 'speak', 'use', 'work'],
                        note: 'Common pairings: live + IN a place, speak + a language, work + IN an industry, have + a possession, use + a tool.'
                    }
                ],
                grammar: [
                    {
                        title: 'Word focus: in',
                        rule: 'Three common uses of "in" for place/work.',
                        form: [
                            {
                                label: 'a',
                                text: 'in + a country (in the United Kingdom)'
                            },
                            {
                                label: 'b',
                                text: 'in + a city or region (in Mexico City)'
                            },
                            {
                                label: 'c',
                                text: 'in + a type of work / industry (in the service industry)'
                            }
                        ],
                        examples: [
                            '21 million people live IN Mexico City.',
                            'There are 65 million people IN the United Kingdom.',
                            '40% of the population work IN the service industry.',
                            '49% live IN the countryside.'
                        ]
                    }
                ]
            },
            {
                id: '1d',
                title: 'First-day skills + world party',
                page: '16-19',
                topicTags: ['alphabet', 'spelling', 'meeting people', 'writing personal description', 'and / but', 'world party', 'video lesson'],
                vocabulary: {
                    title: 'Video — World party (1f)',
                    words: ['seven billion', 'square feet', 'square mile', 'foot (feet)', 'mile', 'centimetre', 'kilometre', 'compare', 'average', 'a bit'],
                    note: 'USA uses feet/miles; the metric world uses centimetres/kilometres. 1 foot ≈ 30 cm; 1 mile ≈ 1.6 km. The video shows Chinese New Year in Singapore.'
                },
                pronunciation: {
                    title: 'Spelling — the English alphabet (1d)',
                    rule: 'Each letter has its own name. Practise spelling personal info: name, surname, country, job.',
                    examples: [
                        'A /eɪ/  B /biː/  C /siː/  D /diː/  E /iː/',
                        'F /ef/  G /dʒiː/  H /eɪtʃ/  I /aɪ/  J /dʒeɪ/',
                        'W /ˈdʌb(ə)l juː/  X /eks/  Y /waɪ/  Z /zed/ (BrE) /ziː/ (AmE)',
                        '"Can you spell your first name?" — "It\'s Pablo. P-A-B-L-O."',
                        '"Can you repeat that?" — "Sure. P-A-B-L-O."'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Meeting people for the first time (1d)',
                        rule: 'Standard phrases for introducing yourself, introducing another person, and saying goodbye.',
                        examples: [
                            'Introducing yourself: Hello … / Hi … — My name\'s … / I\'m … — I\'m from … — Nice to meet you. — Nice to meet you, too.',
                            'Introducing another person: This is … — He\'s / She\'s from …',
                            'Saying goodbye: See you later. — It was nice meeting you. — Goodbye. / Bye.'
                        ]
                    },
                    {
                        title: 'Writing skill — "and" and "but" (1e)',
                        rule: 'Use "and" to add EXTRA / similar information. Use "but" to show a DIFFERENCE or contrast. Note: use a comma before "but" when joining two clauses.',
                        examples: [
                            '"I\'m 21 AND my sister is 21." (same/parallel info → and)',
                            '"I live in Spain, BUT I\'m from Argentina." (Spain ≠ Argentina → but)',
                            '"I\'m from England, BUT I study in the USA."',
                            '"He\'s from Germany, BUT he works in Russia."',
                            'Tip: when starting from two short sentences, choose AND if they match, BUT if they contrast.'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit2',
        title: 'Possessions',
        icon: '🏠',
        color: '#06D6A0',
        intro: 'Describe rooms, talk about objects you own, and shop in English.',
        iCanGoals: [
            'Talk about furniture and objects in the house',
            'Use there is / there are',
            'Use prepositions of place',
            'Make singular and plural nouns',
            'Use this, that, these, those',
            'Say currencies, countries and nationalities',
            'Ask about and buy objects in a shop'
        ],
        lessons: [
            {
                id: '2a',
                title: 'A place called home',
                page: '22-23',
                topicTags: ['furniture', 'there is/are', 'prepositions of place'],
                vocabulary: {
                    title: 'Furniture',
                    words: [
                        'sofa',
                        'armchair',
                        'chair',
                        'television (TV)',
                        'desk',
                        'lamp',
                        'computer',
                        'pictures',
                        'blinds',
                        'curtains',
                        'cupboards and drawers',
                        'rug',
                        'plant',
                        'carpet',
                        'shelves'
                    ],
                    note: 'The four families live in the Evergreen Tower in Seoul, South Korea. Every apartment has a living room, kitchen, bathroom and 2 bedrooms.'
                },
                grammar: [
                    {
                        title: 'there is / there are',
                        rule: 'Use "there is/are" to say what exists in a place. Singular → there is. Plural → there are. Use "any" with negatives and questions.',
                        form: [
                            {
                                label: '+',
                                text: 'There\'s a living room. / There are two bedrooms.'
                            },
                            {
                                label: '−',
                                text: 'There isn\'t a table. / There aren\'t any beds.'
                            },
                            {
                                label: '?',
                                text: 'Is there a sofa? — Yes, there is. / Are there any pictures? — No, there aren\'t.'
                            }
                        ],
                        examples: [
                            'There\'s a sofa on the right.',
                            'There are pictures on the wall.',
                            'There isn\'t a rug in this apartment.',
                            'Are there any books? — No, there aren\'t.',
                            'How many pictures are there? — There are three.'
                        ]
                    },
                    {
                        title: 'Prepositions of place',
                        rule: 'Tell where things are in relation to other things.',
                        examples: [
                            'in (the box) — inside',
                            'on (the desk) — touching the top',
                            'next to (the bed) — beside',
                            'under (the table) — below',
                            'above (the door) — higher, not touching',
                            'between (X and Y) — in the middle of two things',
                            'behind (the sofa) — at the back of',
                            'in front of (the window) — directly before',
                            'opposite (the TV) — facing',
                            'on the left / on the right / in the middle'
                        ]
                    }
                ]
            },
            {
                id: '2b',
                title: 'My possessions',
                page: '24-25',
                topicTags: ['useful objects', 'plural nouns', 'this/that/these/those', '/ɪ/ or /iː/'],
                vocabulary: {
                    title: 'Useful objects',
                    words: ['boots', 'bottle', 'camera', 'first-aid kit', 'gloves', 'hat', 'knife', 'map', 'mobile phone', 'pens', 'torch'],
                    note: 'Andy Torbet is a Scottish adventurer who climbs, dives and kayaks. These are the things in his rucksack.'
                },
                pronunciation: {
                    title: '/ɪ/ vs /iː/',
                    rule: 'Two similar vowel sounds. /ɪ/ is SHORT (this, big, pink, it). /iː/ is LONG (these, keys, green, read).',
                    examples: [
                        '/ɪ/ — this, big, pink, it',
                        '/iː/ — these, keys, green, read',
                        'Listen for length: /iː/ is held longer than /ɪ/.'
                    ]
                },
                grammar: [
                    {
                        title: 'Plural nouns — spelling rules',
                        rule: 'Most nouns add -s. Special rules for words ending in -ch/-sh/-s, -y, -f/-fe. Some are irregular.',
                        form: [
                            {
                                label: '+s',
                                text: 'normal: boot → boots, glove → gloves'
                            },
                            {
                                label: '+es',
                                text: 'sh, s, ch, x, ss, z — torch → torches, bus → buses, class → classes, box → boxes, buzz → buzzes. Mẹo: "sháng say, chiều xỉn, sung sướng, zô"'
                            },
                            {
                                label: '-ies',
                                text: 'consonant + -y: country → countries, family → families'
                            },
                            {
                                label: '-ves',
                                text: '-f/-fe: knife → knives, shelf → shelves, life → lives'
                            },
                            {
                                label: 'irreg.',
                                text: 'man → men, woman → women, person → people, child → children, foot → feet, tooth → teeth, mouse → mice'
                            }
                        ],
                        examples: [
                            'one map → two maps',
                            'one mobile phone → two mobile phones',
                            'one camera → two cameras',
                            'one life → two lives',
                            'one wife → two wives',
                            'one city → two cities'
                        ]
                    },
                    {
                        title: 'this, that, these, those',
                        rule: 'Demonstratives change with NUMBER (singular/plural) and DISTANCE (near/far).',
                        form: [
                            {
                                label: 'near sing.',
                                text: 'this (one thing near you)'
                            },
                            {
                                label: 'far sing.',
                                text: 'that (one thing away from you)'
                            },
                            {
                                label: 'near plur.',
                                text: 'these (many things near you)'
                            },
                            {
                                label: 'far plur.',
                                text: 'those (many things away from you)'
                            }
                        ],
                        examples: [
                            'What\'s this? — It\'s a first-aid kit.',
                            'What\'s that? — It\'s my camera.',
                            'What are these? — They\'re my pens.',
                            'What are those? — They\'re Andy\'s gloves.',
                            'Is this torch Andy\'s? / Are those your boots?'
                        ]
                    }
                ]
            },
            {
                id: '2c',
                title: 'Global objects',
                page: '26-27',
                topicTags: ['countries and nationalities', 'word stress', 'suffixes'],
                vocabulary: {
                    title: 'Countries and nationalities',
                    words: [
                        'Britain → British',
                        'Germany → German',
                        'Austria → Austrian',
                        'Netherlands → Dutch',
                        'Canada → Canadian',
                        'Italy → Italian',
                        'Belgium → Belgian',
                        'England → English',
                        'Spain → Spanish',
                        'France → French',
                        'Brazil → Brazilian',
                        'Poland → Polish',
                        'Vietnam → Vietnamese'
                    ],
                    note: 'Common nationality endings: -ish (Polish, Spanish), -n (Italian, German), -ian (Canadian, Brazilian), -ese (Vietnamese, Japanese, Chinese). Some are irregular: French, Dutch.'
                },
                pronunciation: {
                    title: 'Word stress in nationalities',
                    rule: 'Most country/nationality words are stressed on the FIRST syllable. Words ending in -ese are stressed on the LAST syllable.',
                    examples: [
                        'BRItain / BRItish (first syllable)',
                        'iTAlian / aMErican (second syllable)',
                        'japaNESE / vietnaMESE / portuGUESE (last syllable, -ese ending)'
                    ]
                },
                grammar: [
                    {
                        title: 'The Mini — a global product',
                        rule: 'A car can be "from" different places: company, parts, factory. This shows globalisation.',
                        examples: [
                            'The Mini was a British car until 2000.',
                            'BMW (German) is the producer now.',
                            'The factory is still in Oxford, England.',
                            'There are 2,500 parts from many different countries (Europe + North America).'
                        ]
                    }
                ]
            },
            {
                id: '2d',
                title: 'Shopping + adverts + photos',
                page: '28-31',
                topicTags: [
                    'prices and currencies',
                    'shopping',
                    'word focus: one/ones',
                    'contrastive stress',
                    'adjectives',
                    'adjective order',
                    'writing adverts',
                    'video lesson',
                    'a thousand words'
                ],
                vocabulary: [
                    {
                        title: 'Prices and currencies (2d)',
                        words: [
                            '£ pounds (UK)',
                            '$ dollars (USA)',
                            '€ euros (EU)',
                            '¥ yen (Japan)',
                            '£2.50 = two pounds fifty',
                            '£111.11 = a hundred and eleven pounds eleven'
                        ],
                        note: 'Common shopping phrases: "Can I help you?" / "I\'d like..." / "How much is it?" / "Are there other colours?" / "These ones are red." / "How much are they?"'
                    },
                    {
                        title: 'Adjectives and their opposites (2e)',
                        words: ['old ↔ modern/new', 'bad ↔ good', 'useless ↔ useful', 'slow ↔ fast', 'small ↔ big/large', 'expensive ↔ cheap']
                    },
                    {
                        title: 'Video — Key phrases (2f)',
                        words: [
                            'I miss you',
                            'Please forward',
                            'Good luck!',
                            'apartment',
                            'bicycle',
                            'box',
                            'cake',
                            'camera',
                            'lamp',
                            'letterbox',
                            'package',
                            'pen',
                            'plant'
                        ],
                        note: '"A picture says a thousand words." A photographer in Los Angeles sends his camera to Nasim in Boston.'
                    }
                ],
                pronunciation: {
                    title: 'Contrastive stress (1) (2d)',
                    rule: 'When you contrast two things with this/that/these/those, STRONG stress on the demonstrative highlights the difference.',
                    examples: ['This ball is nice, but THAT one is horrible!', 'These gloves are small, but THOSE ones are large.']
                },
                grammar: [
                    {
                        title: 'Word focus: one / ones (2d)',
                        rule: 'Use "one" / "ones" to AVOID repeating a noun. Singular → one. Plural → ones.',
                        examples: [
                            'I\'d like a glass of water. A small ONE, please. (= a small glass)',
                            'I\'d like two T-shirts. Small ONES, please. (= small T-shirts)',
                            'This ball is nice, but that ONE is horrible.',
                            'These gloves are small, but those ONES are large.'
                        ]
                    },
                    {
                        title: 'Writing skill — Adjective order (2e)',
                        rule: 'When using multiple adjectives, follow this order: OPINION → SIZE → AGE → COLOUR → NATIONALITY → NOUN.',
                        form: [
                            {
                                label: 'Opinion',
                                text: 'useful, nice, lovely, beautiful'
                            },
                            {
                                label: 'Size',
                                text: 'large, small'
                            },
                            {
                                label: 'Age',
                                text: 'modern, new, old'
                            },
                            {
                                label: 'Colour',
                                text: 'white, grey, red'
                            },
                            {
                                label: 'Nation.',
                                text: 'Japanese, Italian, French'
                            }
                        ],
                        examples: [
                            'It\'s a fast, new, Japanese motorbike. (opinion + age + nationality)',
                            'A useful, modern, white desk and chair. (opinion + age + colour)',
                            'They\'re lovely red gloves. (opinion + colour)',
                            'There are two beautiful, old, Italian chairs for sale.',
                            'For sale: a large, modern, white house.'
                        ]
                    },
                    {
                        title: 'Two patterns to describe (2e)',
                        rule: 'You can describe an object in two ways with the same meaning.',
                        examples: [
                            'The desk is modern. = It\'s a modern desk.',
                            'The car is old. = It\'s an old car.',
                            'These laptops are slow. = They\'re slow laptops.'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit3',
        title: 'Places',
        icon: '🏙️',
        color: '#FFD60A',
        intro: 'Describe cities, talk about your job and routines using the present simple, and ask for directions.',
        iCanGoals: [
            'Tell the time',
            'Describe a town or city',
            'Talk about places of work',
            'Use the present simple',
            'Ask questions with the present simple',
            'Ask for and give directions'
        ],
        lessons: [
            {
                id: '3a',
                title: 'No-car zones',
                page: '34-35',
                topicTags: ['describing cities', 'present simple (I/you/we/they)'],
                vocabulary: {
                    title: 'Describing cities',
                    words: [
                        'free',
                        'expensive ↔ cheap',
                        'popular',
                        'polluted',
                        'noisy ↔ quiet',
                        'crowded',
                        'modern ↔ old',
                        'beautiful ↔ ugly',
                        'clean ↔ dirty',
                        'big ↔ small',
                        'relaxing'
                    ],
                    note: 'No-car zones — areas for people, bicycles and public transport only. Examples: London parks, Tokyo (Ginza), Bogotá, Melbourne (Bourke Street).'
                },
                grammar: [
                    {
                        title: 'Present simple — I/you/we/they',
                        rule: 'Use the present simple for facts, routines and habits. With I/you/we/they, use the BASE form. Negative and question forms use the auxiliary "do".',
                        form: [
                            {
                                label: '+',
                                text: 'I/you/we/they + base verb (have, live, like…)'
                            },
                            {
                                label: '−',
                                text: 'I/you/we/they + don\'t + base verb'
                            },
                            {
                                label: '?',
                                text: 'Do + I/you/we/they + base verb? — Yes, I do. / No, I don\'t.'
                            }
                        ],
                        examples: [
                            'I live in the city centre.',
                            'We don\'t have a car. We go everywhere by bicycle.',
                            'Do you like shopping? — Yes, I do. / No, I don\'t.',
                            'Where do you live? — In the city centre.',
                            'What time do you finish work? — At about three o\'clock.'
                        ]
                    }
                ]
            },
            {
                id: '3b',
                title: 'Places of work',
                page: '36-37',
                topicTags: ['places of work', 'present simple (he/she/it)', '-s endings'],
                vocabulary: {
                    title: 'Places of work',
                    words: [
                        'accountant — office',
                        'doctor — hospital',
                        'pilot — plane',
                        'sailor — ship/boat',
                        'teacher — classroom',
                        'sales assistant — shop',
                        'waiter — restaurant'
                    ]
                },
                pronunciation: {
                    title: '-s endings: /s/, /z/, /ɪz/',
                    rule: 'The 3rd-person -s has THREE possible sounds depending on the final sound of the verb. Mẹo tiếng Việt: "Ông Sáu Sang Sông Chạy Xe SH" → /ɪz/; "Thời Fong Kiến Phương Tây" → /s/; còn lại → /z/.',
                    examples: [
                        '/ɪz/ — sau âm xuýt (s/z/sh/ch/x/ge): finishes, teaches, watches, judges, boxes — nhớ qua câu "Ông Sáu Sang Sông Chạy Xe SH"',
                        '/s/ — sau phụ âm vô thanh (t, f, k, p, th-vô-thanh): works, meets, starts, laughs — nhớ qua "Thời Fong Kiến Phương Tây"',
                        '/z/ — mặc định (sau âm hữu thanh hoặc nguyên âm): lives, goes, studies, travels, plays'
                    ]
                },
                grammar: [
                    {
                        title: 'Present simple — he/she/it',
                        rule: 'For he/she/it, ADD -s (or -es/-ies). In negatives and questions, use "does/doesn\'t" + BASE verb.',
                        form: [
                            {
                                label: '+',
                                text: 'He/She/It + verb-s (works, has, does, studies)'
                            },
                            {
                                label: '−',
                                text: 'He/She/It + doesn\'t + base verb'
                            },
                            {
                                label: '?',
                                text: 'Does + he/she/it + base verb? — Yes, she does. / No, she doesn\'t.'
                            }
                        ],
                        examples: [
                            'He works in a shop.',
                            'She studies places under the sea.',
                            'He has exams soon. (have → has)',
                            'She doesn\'t live in London.',
                            'Does he have children? — Yes, he does. / No, he doesn\'t.',
                            'What does Beverly do? — She\'s a marine archaeologist.'
                        ]
                    }
                ]
            },
            {
                id: '3c',
                title: 'Places and languages',
                page: '38-39',
                topicTags: ['ordinal numbers', 'cardinal numbers', 'collocations'],
                vocabulary: {
                    title: 'Numbers — cardinal vs ordinal',
                    words: [
                        'Cardinal: one, two, three, four…',
                        'Ordinal: 1st first, 2nd second, 3rd third, 4th fourth, 5th fifth, 9th ninth, 12th twelfth, 21st twenty-first, 100th one hundredth'
                    ],
                    note: 'Cardinal numbers tell quantity (how many). Ordinal numbers tell position (1st, 2nd, 3rd…). For 21+, only the LAST word becomes ordinal: 21st = twenty-first.'
                },
                pronunciation: {
                    title: 'Ordinal numbers',
                    rule: 'Most ordinals end in /θ/ ("th"). Exceptions: 1st, 2nd, 3rd.',
                    examples: ['third /θɜːd/  fourth /fɔːθ/  fifth /fɪfθ/  twelfth /twelfθ/', 'first /fɜːst/  second /ˈsekənd/']
                },
                grammar: [
                    {
                        title: 'Wordbuilding — adjective + noun collocations',
                        rule: 'Some words are commonly used together. Learn them as one chunk.',
                        examples: [
                            'first language (your native language)',
                            'second language (one you learn later)',
                            'official language (used by the government)',
                            'native speaker (learned the language as a child)',
                            'Over 1 billion speakers of Chinese — Mandarin is in 1st place.',
                            'English is in 4th place as a first language.'
                        ]
                    }
                ]
            },
            {
                id: '3d',
                title: 'Atlanta + city description + Cowley Road',
                page: '40-43',
                topicTags: ['places in a city', 'giving directions', 'writing description', 'capital letters', 'video lesson', 'Oxford'],
                vocabulary: [
                    {
                        title: 'Places in a city (3d)',
                        words: [
                            'car park',
                            'museum',
                            'hotel',
                            'library',
                            'theatre',
                            'park',
                            'post office',
                            'aquarium',
                            'cinema',
                            'gym / sports centre',
                            'art gallery',
                            'visitor centre'
                        ]
                    },
                    {
                        title: 'Video — Cowley Road, Oxford (3f)',
                        words: [
                            'post office',
                            'community',
                            'pre-schooler',
                            'medical centre',
                            'ingredients',
                            'traffic lights',
                            'mosque',
                            'sports centre',
                            'supermarket'
                        ]
                    }
                ],
                grammar: [
                    {
                        title: 'Real life — Giving directions (3d)',
                        rule: 'Useful phrases for asking where things are and giving directions.',
                        examples: [
                            'Asking: Where is …? / I\'d like to go to … / Is it near here?',
                            'Distance: It\'s near here. / It\'s about ten minutes away.',
                            'Go past the … (past = alongside and beyond)',
                            'Go across … (cross to the other side)',
                            'Go straight up … (continue forward)',
                            'Take the first street on the left/right. / Turn left. / Turn right.'
                        ]
                    },
                    {
                        title: 'Writing skill — Capital letters (3e)',
                        rule: 'In English, USE a capital letter for: start of sentence, the pronoun I, names of people/cities/places, countries/nationalities/languages, days/months, streets/parks/squares.',
                        examples: [
                            'I\'m from Australia. (start, pronoun I, country)',
                            'I love Sydney. (city)',
                            'I love the winter in Moscow.',
                            'December is my favourite month. (month)',
                            'On Saturdays I meet friends. (day)',
                            'I go to Narrabeen Beach. (place)',
                            'NO capital for: seasons (winter), parts of the day (evening).'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit4',
        title: 'Free time',
        icon: '🎮',
        color: '#FB8500',
        intro: 'Talk about free-time activities, frequency, and what you can/can\'t do.',
        iCanGoals: [
            'Talk about likes and dislikes',
            'Use like / love + -ing',
            'Talk about my daily life',
            'Use adverbs and expressions of frequency',
            'Talk about my abilities with can/can\'t',
            'Write short emails'
        ],
        lessons: [
            {
                id: '4a',
                title: '100% identical?',
                page: '46-47',
                topicTags: ['collocations', 'like/love + -ing', '/ŋ/'],
                vocabulary: {
                    title: 'Verb + noun collocations',
                    words: [
                        'go: swimming, running, cycling, camping, shopping',
                        'play: football, computer games, golf, the guitar',
                        'do: yoga, Taekwondo, the housework',
                        'watch: TV, films',
                        'read: a magazine, a book',
                        'meet: friends',
                        'have: a coffee, a meal',
                        'make: phone calls, a cake',
                        'use: social media, the internet'
                    ]
                },
                pronunciation: {
                    title: '/ŋ/ — the -ing sound',
                    rule: 'The "-ing" ending of verbs is pronounced /ɪŋ/. The final letter "g" is NOT pronounced separately — /ŋ/ is one nasal sound.',
                    examples: ['playing /ˈpleɪɪŋ/', 'listening /ˈlɪs(ə)nɪŋ/', 'singing /ˈsɪŋɪŋ/ — has /ŋ/ twice!', 'doing /ˈduːɪŋ/']
                },
                grammar: [
                    {
                        title: 'like / love (+ noun / -ing)',
                        rule: 'After like / love / don\'t like / hate, use a NOUN or the -ING form of a verb.',
                        examples: [
                            'They love books. (love + noun)',
                            'They love playing golf. (love + -ing)',
                            'They don\'t like the same football teams. (like + noun)',
                            'She likes swimming. (likes + -ing)',
                            'I don\'t like dancing.',
                            'Do they like doing the same things?'
                        ]
                    }
                ]
            },
            {
                id: '4b',
                title: 'Free time in the Arctic',
                page: '48-49',
                topicTags: ['everyday activities', 'adverbs of frequency', 'expressions of frequency'],
                vocabulary: {
                    title: 'Everyday activities',
                    words: [
                        'do online shopping',
                        'go for a walk',
                        'have a coffee',
                        'make phone calls',
                        'play online games',
                        'read a book',
                        'browse the internet',
                        'text friends',
                        'use social media',
                        'watch videos'
                    ],
                    note: 'Norbert Rosing is a National Geographic photographer who works in the Arctic.'
                },
                grammar: [
                    {
                        title: 'Adverbs of frequency',
                        rule: 'These tell HOW OFTEN something happens. Position: AFTER "be", BEFORE other verbs.',
                        form: [
                            {
                                label: '100%',
                                text: 'always'
                            },
                            {
                                label: '~80%',
                                text: 'usually'
                            },
                            {
                                label: '~60%',
                                text: 'often'
                            },
                            {
                                label: '~40%',
                                text: 'sometimes'
                            },
                            {
                                label: '~20%',
                                text: 'not often'
                            },
                            {
                                label: '0%',
                                text: 'never'
                            }
                        ],
                        examples: [
                            'I\'m often away at the weekend. (after "be")',
                            'I don\'t often watch TV.',
                            'I never play computer games.',
                            'He\'s never bored.'
                        ]
                    },
                    {
                        title: 'Expressions of frequency',
                        rule: 'Specific frequencies use phrases like "once a year", "every day". They usually go at the END of a sentence.',
                        examples: [
                            'He goes once a year.',
                            'I drink coffee twice a day.',
                            'We visit my cousins in the summer.',
                            'You can see polar bears every day (between August and November).',
                            'How often do you go to the gym?'
                        ]
                    }
                ]
            },
            {
                id: '4c',
                title: 'Extreme sports',
                page: '50-51',
                topicTags: ['sports', 'can/can\'t'],
                vocabulary: {
                    title: 'Sports',
                    words: [
                        'baseball',
                        'basketball',
                        'boxing',
                        'cricket',
                        'cycling',
                        'football (UK) / soccer (US)',
                        'ice hockey',
                        'running',
                        'sailing',
                        'skiing',
                        'surfing',
                        'swimming',
                        'tennis'
                    ],
                    note: 'Use "play" with ball sports (play football). Use "go" with -ing activities (go swimming). Use "do" with martial arts (do Taekwondo).'
                },
                pronunciation: {
                    title: 'can vs can\'t',
                    rule: 'Positive "can" is usually unstressed (weak form /kən/). Negative "can\'t" is stressed and clearer (/kɑːnt/ in BrE).',
                    examples: [
                        'I /kən/ swim. (weak — positive)',
                        'I /kɑːnt/ play tennis. (strong — negative)',
                        'CAN you play the guitar? (strong in question)'
                    ]
                },
                grammar: [
                    {
                        title: 'can / can\'t (+ adverb)',
                        rule: '"can" is a modal verb showing ability. Same form for all subjects (NO -s). Followed by the BASE form of the verb.',
                        form: [
                            {
                                label: '+',
                                text: 'Subject + can + base verb'
                            },
                            {
                                label: '−',
                                text: 'Subject + can\'t (cannot) + base verb'
                            },
                            {
                                label: '?',
                                text: 'Can + subject + base verb? — Yes, I can. / No, I can\'t.'
                            },
                            {
                                label: 'adv',
                                text: 'Adverbs of degree go after: very well / a bit. "How well…?"'
                            }
                        ],
                        examples: [
                            'He can jump between 20 and 30 metres.',
                            'He can\'t see very well.',
                            'Can you speak French? — Yes, I can. / No, I can\'t.',
                            'I can speak French a bit.',
                            'How well can you swim?'
                        ]
                    }
                ]
            },
            {
                id: '4d',
                title: 'A gap year + short emails + free time',
                page: '52-55',
                topicTags: ['gap year', 'abilities and interests', 'sentence stress', 'writing short emails', 'video lesson', 'free time'],
                vocabulary: [
                    {
                        title: 'Gap year (4d)',
                        words: ['gap year', 'volunteer', 'volunteer work', 'orphan', 'cub', 'enthusiastic', 'good at + -ing']
                    },
                    {
                        title: 'Video — Free-time passions (4f)',
                        words: ['passion', 'hobby', 'free-time activity', 'I love …', 'I really enjoy …']
                    }
                ],
                pronunciation: {
                    title: 'Sentence stress (4d)',
                    rule: 'Stress CONTENT words (nouns, main verbs, adjectives, adverbs). Don\'t stress function words (a, the, of, am).',
                    examples: [
                        'Are you GOOD at WRITING?',
                        'I\'m GOOD at WRITING.',
                        'CAN you TEACH?',
                        'I CAN\'T speak ENGLISH very WELL.',
                        'I LOVE ANimals!'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Talking about abilities and interests (4d)',
                        rule: 'Common phrases for asking and saying what you can do and what you like.',
                        examples: [
                            'Are you good at teaching?',
                            'How well can you speak English?',
                            'Can you teach?',
                            'Do you like animals?',
                            'I can speak English well.',
                            'I can\'t go for eighteen months.',
                            'I\'m (not very) good at writing.',
                            'I (don\'t) like animals. / I love them!'
                        ]
                    },
                    {
                        title: 'Writing skill — Short emails (4e)',
                        rule: 'In short, friendly emails: use informal greetings (Hi …), contractions (I\'m, I\'d), and casual sign-offs.',
                        examples: [
                            'Hi Sarah, / Hello Tom,',
                            'I\'m great, thanks! / I\'d love to come.',
                            'Looking forward to seeing you. / See you soon.',
                            'Bye / Cheers / Best wishes,'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit5',
        title: 'Food',
        icon: '🍽️',
        color: '#EF476F',
        intro: 'Talk about food, quantities, food labels, and ordering meals.',
        iCanGoals: [
            'Talk about food I like and eat',
            'Use a/an, some and any with countable and uncountable nouns',
            'Use a lot of, much and many',
            'Ask How many / How much for quantities',
            'Talk about food labels and healthy eating',
            'Order a meal in a restaurant'
        ],
        lessons: [
            {
                id: '5a',
                title: 'Famous for food',
                page: '58-59',
                topicTags: ['food', 'countable/uncountable', '/tʃ/ or /dʒ/'],
                vocabulary: {
                    title: 'Food',
                    words: [
                        'cheese',
                        'chicken',
                        'chips',
                        'eggs',
                        'fish',
                        'juice',
                        'lamb',
                        'lemons',
                        'lentils',
                        'nuts',
                        'onions',
                        'oranges',
                        'pasta',
                        'peppers',
                        'potatoes',
                        'prawns',
                        'raisins',
                        'rice',
                        'salt',
                        'pepper'
                    ],
                    note: 'Popular dishes: pizza (Italy), ceviche (Peru), satay (Indonesia), kabsa (Saudi Arabia), pierogi (Poland), curry (India).'
                },
                pronunciation: {
                    title: '/tʃ/ vs /dʒ/',
                    rule: '/tʃ/ is voiceless (as in "chicken", "cheese"). /dʒ/ is voiced (as in "juice", "orange").',
                    examples: ['/tʃ/ — chicken, cheese, church, watch', '/dʒ/ — juice, orange, general, large']
                },
                grammar: [
                    {
                        title: 'Countable vs uncountable nouns + a/an, some, any',
                        rule: 'Countable nouns can be counted (one egg, two eggs). Uncountable nouns can\'t be counted (some water — NOT "two waters").',
                        form: [
                            {
                                label: 'a / an',
                                text: 'singular COUNTABLE: an onion, a banana'
                            },
                            {
                                label: 'some',
                                text: 'PLURAL countable AND UNCOUNTABLE — in POSITIVE sentences: some onions, some water'
                            },
                            {
                                label: 'any',
                                text: 'PLURAL countable AND UNCOUNTABLE — in NEGATIVE sentences and QUESTIONS: any carrots, any bread'
                            }
                        ],
                        examples: [
                            'Cook the chicken with an onion. (singular countable)',
                            'You need some meat and some onions and tomatoes. (some + positive)',
                            'I don\'t use any carrots. (any + negative)',
                            'Do you have any bread? (any + question)'
                        ]
                    }
                ]
            },
            {
                id: '5b',
                title: 'Top five food markets',
                page: '60-61',
                topicTags: ['food markets', 'a lot of / much / many', 'quantities and containers', 'how much/how many'],
                vocabulary: {
                    title: 'Quantities and containers',
                    words: [
                        'a bag of rice',
                        'a bottle of water/sauce',
                        'a glass of water',
                        'a kilo of flour',
                        'a packet of pasta',
                        'a piece of pizza',
                        'a slice of cake',
                        'a tin of tuna'
                    ],
                    note: 'Famous markets in Unit 5b: St Lawrence (Toronto), Castries (Saint Lucia), Kreta Ayer (Singapore), La Vucciria (Palermo, Italy), Borough Market (London — 1,000 years old).'
                },
                grammar: [
                    {
                        title: 'a lot of / much / many',
                        rule: 'a lot of — works with countable AND uncountable, mainly in POSITIVES. much/many — mainly in NEGATIVES and QUESTIONS.',
                        form: [
                            {
                                label: 'a lot of',
                                text: 'countable plural + uncountable (positive sentences)'
                            },
                            {
                                label: 'many',
                                text: 'countable plural (negatives & questions)'
                            },
                            {
                                label: 'much',
                                text: 'uncountable (negatives & questions)'
                            }
                        ],
                        examples: [
                            'There are a lot of shops here. / There\'s a lot of food.',
                            'There aren\'t many markets. / There isn\'t much food.',
                            'Do you eat a lot of / many apples? — No, not many.',
                            'Do you eat a lot of / much cheese? — No, not much.'
                        ]
                    },
                    {
                        title: 'How many / How much',
                        rule: 'Ask "How many" with countable plural nouns. Ask "How much" with uncountable nouns.',
                        examples: [
                            'How many bananas do you want? — Six, please.',
                            'How much rice do you want? — A kilo.',
                            'How many tins of tuna do you need? — Four tins.',
                            'How much cheese would you like? — Half a kilo, please.'
                        ]
                    }
                ]
            },
            {
                id: '5c',
                title: 'An eater\'s guide to food labels',
                page: '62-63',
                topicTags: ['food labels', 'word focus: mean'],
                vocabulary: {
                    title: 'Food labels',
                    words: [
                        'superfood',
                        'natural',
                        'best before',
                        'low fat',
                        'calorie',
                        'portion',
                        'ingredients',
                        'vitamins',
                        'traffic lights (red/orange/green)'
                    ],
                    note: 'Don\'t trust the word "superfood" — anyone can use it. "Best before" = the food is best before this date, but you CAN still eat it afterwards. Low-fat food often has lots of sugar!'
                },
                grammar: [
                    {
                        title: 'Word focus: mean',
                        rule: '"Mean" has different uses depending on context.',
                        examples: [
                            'Red MEANS the food is unhealthy. (= shows / signals)',
                            'The word "healthy" MEANS the food is good for you. (= explains a word)',
                            'Do you know what I MEAN? (= asking for understanding)',
                            'I see what you MEAN. (= I understand)',
                            'Your pizza is delicious. I MEAN it! (= I\'m serious)',
                            'We went out last Friday — I MEAN last Saturday. (= correcting yourself)'
                        ]
                    }
                ]
            },
            {
                id: '5d',
                title: 'At the restaurant + instructions + world food quiz',
                page: '64-67',
                topicTags: ['menus', 'ordering a meal', 'contracted forms', 'writing instructions', 'video lesson', 'world food'],
                vocabulary: [
                    {
                        title: 'Menus (5d)',
                        words: [
                            'Starters (1st course)',
                            'Main courses (2nd, biggest)',
                            'Desserts (sweet finish)',
                            'Drinks',
                            'garlic bread',
                            'soup',
                            'salad',
                            'pizza',
                            'burger',
                            'fries',
                            'smoothie',
                            'bottle of water',
                            'iced tea'
                        ]
                    },
                    {
                        title: 'Video — World food quiz (5f)',
                        words: ['street food', 'spicy', 'sweet', 'sour', 'salty', 'fresh', 'vegetarian']
                    }
                ],
                pronunciation: {
                    title: 'Contracted forms (5d)',
                    rule: 'In restaurant orders, contractions sound natural: I\'d = I would, I\'ll = I will.',
                    examples: ['I\'d /aɪd/ like a coffee.', 'I\'ll /aɪl/ have a pizza.']
                },
                grammar: [
                    {
                        title: 'Real life — Ordering a meal (5d)',
                        rule: 'Common phrases when ordering food in a restaurant.',
                        examples: [
                            'Here is the menu. (waiter)',
                            'Can I get you anything to drink first? (waiter)',
                            'I\'d like a bottle of water, please.',
                            'I don\'t want a starter.',
                            'I\'ll have a seafood pizza.',
                            'I\'d also like a dessert.',
                            'Are you ready to order? (waiter)',
                            'That was delicious.',
                            'Can I get you anything else? (waiter)',
                            'Could we have the bill, please?'
                        ]
                    },
                    {
                        title: 'Writing skill — Instructions (5e)',
                        rule: 'Recipes and instructions use the IMPERATIVE form (base verb, no subject). Use simple, clear language.',
                        examples: ['Cook the chicken with an onion.', 'Add some salt and pepper.', 'Serve with rice.', 'Don\'t use too much oil.']
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit6',
        title: 'Past lives',
        icon: '🕰️',
        color: '#9B59B6',
        intro: 'Talk about people, places, and events in the past using was/were and the past simple.',
        iCanGoals: [
            'Use the verb be in the past (was/were)',
            'Use the past simple to talk about finished events',
            'Ask and answer questions about the past',
            'Use time expressions (yesterday, in 1799, last March…)',
            'Use opinion adjectives',
            'Ask what people did last night / at the weekend',
            'Write formal and informal thank-you messages'
        ],
        lessons: [
            {
                id: '6a',
                title: 'Famous faces',
                page: '70-71',
                topicTags: ['famous faces', 'was/were', 'past simple regular', 'time expressions', '-ed endings'],
                vocabulary: [
                    {
                        title: 'Famous faces & money',
                        words: [
                            'president',
                            'queen',
                            'scientist',
                            'musician',
                            'writer',
                            'artist',
                            'currency',
                            'note',
                            'coin',
                            'dollar',
                            'euro',
                            'pound',
                            'peso'
                        ],
                        note: 'Famous on money: George Washington (US 1-dollar), Frida Kahlo & Diego Rivera (Mexican 500-peso), Queen Elizabeth (UK notes). Euro notes show buildings/maps — NO famous people.'
                    },
                    {
                        title: 'Time expressions (past → present)',
                        words: [
                            'when I was a child',
                            'before the 18th century',
                            'in 1799',
                            'during the 19th century',
                            'the sixties',
                            'in 2000',
                            'last March',
                            'a week ago',
                            'last Monday evening',
                            'on January 1st, 2000',
                            'yesterday',
                            'this morning'
                        ],
                        note: 'Use IN with months/years/centuries (in 1799). Use ON with specific dates (on January 1st). Use ago AFTER the number (a week ago).'
                    }
                ],
                pronunciation: {
                    title: '-ed endings: /t/, /d/, /ɪd/',
                    rule: 'The "-ed" ending of regular past verbs has THREE sounds.',
                    examples: [
                        '/t/ — after voiceless sounds (k, p, s, ʃ, tʃ, f): liked, worked, watched, finished',
                        '/d/ — after voiced sounds (b, g, l, m, n, v, vowels): lived, played, travelled, called',
                        '/ɪd/ — after t or d sounds (EXTRA syllable): wanted, started, visited, painted, decided'
                    ]
                },
                grammar: [
                    {
                        title: 'was / were — past simple of "be"',
                        rule: 'I/he/she/it → was. You/we/they → were. Same negative and question patterns as present.',
                        form: [
                            {
                                label: '+',
                                text: 'George Washington WAS the first US president.'
                            },
                            {
                                label: '−',
                                text: 'His face WASN\'T on the dollar. There WEREN\'T any famous people on euros.'
                            },
                            {
                                label: '?',
                                text: 'When WAS he born? WERE they famous? Yes, they were. / No, they weren\'t.'
                            }
                        ],
                        examples: [
                            'I was a child in the nineties.',
                            'They were Mexican artists.',
                            'Where were you yesterday? — I was at home.',
                            'Was she at home? — Yes, she was. / No, she wasn\'t.'
                        ]
                    },
                    {
                        title: 'Past simple — regular verbs',
                        rule: 'Use the past simple for FINISHED actions and events in the past. Regular verbs add -ed.',
                        form: [
                            {
                                label: '+',
                                text: 'verb + -ed (worked, lived, studied, travelled)'
                            },
                            {
                                label: 'spell.',
                                text: '-e → +d (live → lived). Consonant + y → -ied (study → studied). BrE doubles -l (travel → travelled).'
                            }
                        ],
                        examples: [
                            'They worked in Mexico City.',
                            'He lived in the 18th century.',
                            'She studied art.',
                            'They travelled in Europe.',
                            'Frida painted self-portraits.'
                        ]
                    }
                ]
            },
            {
                id: '6b',
                title: 'Visiting the past',
                page: '72-73',
                topicTags: ['visiting the past', 'past simple irregular', 'past simple negative', 'past simple questions'],
                vocabulary: {
                    title: 'Visiting the past — Mustang caves',
                    words: ['cave', 'mountain', 'century', 'river', 'family', 'humans', 'Mustang region', 'Nepal'],
                    note: 'Yandu Bista grew up in a cave in northern Nepal. Humans made these caves about 3,000 years ago. People lived in them until the 15th century. Yandu\'s family moved to a town, but she says: "I like living in a cave."'
                },
                grammar: [
                    {
                        title: 'Past simple — irregular verbs',
                        rule: 'Many common verbs do NOT add -ed. They have their own past form. Learn them by heart!',
                        examples: [
                            'go → went       have → had      do → did',
                            'make → made    bring → brought  build → built',
                            'grow → grew    leave → left    see → saw',
                            'meet → met     take → took     write → wrote',
                            'come → came    get → got       buy → bought',
                            'See page 182 of the textbook for a full list of irregular verbs.'
                        ]
                    },
                    {
                        title: 'Past simple — negatives and questions',
                        rule: 'For ALL subjects (I/you/he/she/it/we/they): didn\'t + base verb. Did + subject + base verb? Use the BASE form after did/didn\'t — NOT the past form.',
                        form: [
                            {
                                label: '+',
                                text: 'I/he/she/it/we/they grew up in a cave.'
                            },
                            {
                                label: '−',
                                text: 'I/he/she/it/we/they DIDN\'T live in a house. (NOT "didn\'t lived")'
                            },
                            {
                                label: '?',
                                text: 'What DID you DO at the weekend? — I met some friends.'
                            },
                            {
                                label: 'Y/N',
                                text: 'DID you go to the cinema? — Yes, I did. / No, I didn\'t.'
                            }
                        ],
                        examples: [
                            'They didn\'t have water in the cave.',
                            'She didn\'t live in a house.',
                            'Where did you go yesterday? — I went to the museum.',
                            'Did you have fun? — Yes, I did.',
                            'NOTE: For "be" use was/were directly: Were they at home? — Yes, they were.'
                        ]
                    }
                ]
            },
            {
                id: '6c',
                title: 'Lifelogging',
                page: '74-75',
                topicTags: ['lifelogging', 'word focus: write'],
                vocabulary: {
                    title: 'Lifelogging',
                    words: ['diary', 'lifelogger', 'blog', 'photographs', 'fitness tracker', 'video', 'comments', 'social media'],
                    note: 'Samuel Pepys (17th century) wrote the most famous diary in English. Gordon Bell became the first "lifelogger" in 2000 — he wore a camera that automatically took a picture every 30 seconds. Today we lifelog with photos, social media posts, and fitness trackers.'
                },
                grammar: [
                    {
                        title: 'Word focus: write',
                        rule: 'The verb "write" combines with different prepositions and objects to make different meanings.',
                        examples: [
                            'write ABOUT history — the topic of your writing',
                            'write A diary — what you write (an article/journal)',
                            'write TO your grandparents — the person you send to',
                            'write DOWN a word — note it on paper (phrasal verb)'
                        ]
                    }
                ]
            },
            {
                id: '6d',
                title: 'How was your evening? + Thanks! + objects video',
                page: '76-79',
                topicTags: [
                    'asking what people did',
                    'opinion adjectives',
                    'intonation',
                    'thank you messages',
                    'formal and informal',
                    'video lesson',
                    'museum objects'
                ],
                vocabulary: [
                    {
                        title: 'Opinion adjectives (positive → negative) (6d)',
                        words: [
                            'fantastic / great / very good 😀',
                            'OK / fine / nice / not bad 🙂',
                            'fun / funny 😄',
                            'boring 😐',
                            'terrible / not very good 😞'
                        ],
                        note: 'fun = enjoyable (an activity). funny = makes you laugh (a joke, a film). They are NOT the same!'
                    },
                    {
                        title: 'Video — Objects from the past (6f)',
                        words: ['museum', 'object', 'history', 'precious', 'ancient', 'discover', 'century', 'civilization']
                    }
                ],
                pronunciation: {
                    title: 'Intonation — matching your tone to your opinion (6d)',
                    rule: 'Strong opinions need lively/animated intonation. Neutral opinions sound flat. Make your voice match how you feel.',
                    examples: [
                        '"Fantastic!" — enthusiastic, voice goes up',
                        '"Terrible!" — strong falling tone, drawn out',
                        '"OK" / "Fine" — flat, neutral',
                        '"Not bad" with flat tone = slightly positive (British understatement)'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Asking what people did (6d)',
                        rule: 'Useful phrases for asking and answering about past events.',
                        examples: [
                            'How was your evening / weekend / holiday?',
                            'Did you have a good evening / weekend? Did you have a good time?',
                            'Did you have fun last night? — It was great / fun / OK / not much.',
                            'Activity: What did you do? — I went for a walk. / I watched TV.',
                            'Place: Where did you go? — To a café / a party / the cinema.',
                            'People: Who were you with? — A friend / friends / my family.',
                            'How many: Were there many people there? — Yes, lots! / No, not many.'
                        ]
                    },
                    {
                        title: 'Writing skill — Formal vs informal thank-you messages (6e)',
                        rule: 'Match the style to your relationship. Informal for friends/family; formal for clients/teachers/strangers.',
                        form: [
                            {
                                label: 'Greet',
                                text: 'Informal: Hi! / Hello! · Formal: Dear Mr/Mrs Smith,'
                            },
                            {
                                label: 'Thank',
                                text: 'Informal: Thanks for… · Formal: Thank you very much for…'
                            },
                            {
                                label: 'Future',
                                text: 'Informal: See you again soon! · Formal: I look forward to hearing from you.'
                            },
                            {
                                label: 'End',
                                text: 'Informal: Love / Cheers / Bye · Formal: Yours sincerely / Best regards'
                            }
                        ],
                        examples: [
                            'Informal: "Hi! Thanks for coming to my party. I really liked the present! See you again soon. Love, Ginny"',
                            'Formal: "Dear Nadia, Thank you very much for your work in Rio. The conference was very successful. Best regards, Sanjit"'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit7',
        title: 'Journeys',
        icon: '🐞',
        color: '#10B981',
        intro: 'Compare animals, places and ways of travelling using comparatives and superlatives.',
        iCanGoals: [
            'Use comparative adjectives to compare two things',
            'Use superlative adjectives to compare one thing with all others',
            'Use everyday adjectives and their opposites',
            'Talk about ways of travelling',
            'Talk about money (borrow, lend, change, cash, credit card)',
            'Make polite requests (Can I…? Could I…?)'
        ],
        lessons: [
            {
                id: '7a',
                title: 'Animal journeys',
                page: '82-83',
                topicTags: ['adjectives', 'animal journeys', 'comparative adjectives', 'stressed and weak syllables'],
                vocabulary: [
                    {
                        title: 'Adjectives & opposites',
                        words: ['clean ↔ dirty', 'difficult ↔ easy', 'fast ↔ slow', 'safe ↔ dangerous', 'cold ↔ hot', 'huge ↔ tiny', 'long ↔ short'],
                        note: 'Use these adjectives to describe commutes, transportation, cities, and the weather.'
                    },
                    {
                        title: 'Animal journeys',
                        words: [
                            'saiga antelope (35 km/day, Central Asia)',
                            'tree frog (~30 m/year)',
                            'loggerhead turtle (~14,000 km / 15 years)',
                            'migration',
                            'calf (baby saiga)'
                        ],
                        note: 'Every year, animals around the world go on long, difficult journeys called migrations.'
                    }
                ],
                pronunciation: {
                    title: 'Stressed and weak syllables',
                    rule: 'In long words, ONE syllable is STRESSED (louder, longer, clearer). Other syllables are WEAK — often with the schwa /ə/.',
                    examples: [
                        'AFrica  /ˈæfrɪkə/  — stress on AF; final "a" is /ə/ schwa',
                        'EUrope  /ˈjʊərəp/  — stress on EU; "rope" is weak /rəp/',
                        'ausTRAlia  — stress on TRA',
                        'anTARCtica — stress on TARC',
                        '"than" between comparatives is weak: /ðən/ (NOT /ðæn/)'
                    ]
                },
                grammar: [
                    {
                        title: 'Comparative adjectives',
                        rule: 'Use the comparative to compare TWO things or groups. Add "than" after the comparative.',
                        form: [
                            {
                                label: 'short',
                                text: '+ -er (big → bigger, cheap → cheaper, fast → faster)'
                            },
                            {
                                label: '-e',
                                text: '+ -r (safe → safer)'
                            },
                            {
                                label: 'cons.+y',
                                text: '-y → -ier (easy → easier)'
                            },
                            {
                                label: 'long',
                                text: 'more + adjective (expensive → more expensive)'
                            },
                            {
                                label: 'irreg.',
                                text: 'good → better, bad → worse'
                            }
                        ],
                        examples: [
                            'Turtles have longer journeys than tree frogs.',
                            'Tree frogs have shorter journeys than saiga antelopes.',
                            'The female saiga\'s journey is more dangerous than the male\'s.',
                            'Australia is hotter than Antarctica.',
                            'Rock climbing is more fun than surfing. (opinion)'
                        ]
                    }
                ]
            },
            {
                id: '7b',
                title: 'The deepest place on Earth',
                page: '84-85',
                topicTags: ['ways of traveling', 'superlative adjectives', 'Mariana Trench'],
                vocabulary: {
                    title: 'Ways of traveling — collocations',
                    words: [
                        'go BY + bicycle/train/car',
                        'travel BY + train/bus/plane/boat',
                        'take + a taxi/a bus/the train',
                        'walk · ride · drive · fly'
                    ],
                    note: 'James Cameron travelled to the Mariana Trench — the deepest place in the ocean — in his submarine, the Deepsea Challenger. He\'s also the filmmaker behind Titanic and Avatar.'
                },
                grammar: [
                    {
                        title: 'Superlative adjectives',
                        rule: 'Use the superlative to compare ONE thing with ALL the other things in a group. Use "the" before the superlative.',
                        form: [
                            {
                                label: 'short',
                                text: 'the + -est (big → the biggest, fast → the fastest)'
                            },
                            {
                                label: '-e',
                                text: 'the + -st (safe → the safest)'
                            },
                            {
                                label: 'cons.+y',
                                text: '-y → -iest (easy → the easiest)'
                            },
                            {
                                label: 'long',
                                text: 'the most + adjective (the most expensive)'
                            },
                            {
                                label: 'irreg.',
                                text: 'good → the best, bad → the worst'
                            }
                        ],
                        examples: [
                            'The Mariana Trench is the deepest place in the ocean.',
                            'This fish has the biggest teeth of any fish for its size.',
                            'Titanic is the most popular movie by James Cameron.',
                            'Avatar was the most expensive movie.',
                            'Dublin is the most famous city in Ireland.'
                        ]
                    }
                ]
            },
            {
                id: '7c',
                title: 'Visit Colombia!',
                page: '86-87',
                topicTags: ['Colombia', 'word focus: time'],
                vocabulary: {
                    title: 'Colombian cities',
                    words: [
                        'Bogotá (capital)',
                        'Cartagena (Caribbean port, friendly)',
                        'Medellín (Botero, sculptures, cable car)',
                        'Cali (salsa, music, dance festivals)',
                        'Ciudad Perdida ("Lost City", 4-day trek, 1,241 steps)'
                    ],
                    note: 'Colombia has more than just Bogotá. Each city has its own character — beaches, sculptures, salsa, or ancient ruins.'
                },
                grammar: [
                    {
                        title: 'Word focus: time',
                        rule: 'Time pairs with different verbs and prepositions to make common phrases.',
                        examples: [
                            'have a good time = enjoy yourself / have fun',
                            'have time FOR + noun (have time for sports)',
                            'spend time + -ing / with (spend time with family)',
                            'save time = finish in less time (save time by taking a taxi)'
                        ]
                    }
                ]
            },
            {
                id: '7d',
                title: 'Travel money + travel blog + final journey',
                page: '88-91',
                topicTags: ['money', 'making requests', 'travel blog', 'so and because', 'video lesson', 'final journey', 'sockeye salmon'],
                vocabulary: [
                    {
                        title: 'Money (7d)',
                        words: [
                            'borrow (you take from someone)',
                            'lend (you give to someone)',
                            'cash (notes + coins)',
                            'credit card',
                            'change dollars INTO euros',
                            'spend money ON',
                            'pay BY credit card / pay FOR something',
                            'buy a ticket',
                            'ATM (cash machine)'
                        ],
                        note: 'Common confusion: BORROW = take temporarily / LEND = give temporarily. "Can you LEND me $10?" / "Can I BORROW $10?"'
                    },
                    {
                        title: 'Video — sockeye salmon (7f)',
                        words: [
                            'skin',
                            'shallow ↔ deep',
                            'smooth ↔ rough',
                            'decay (body breaks down)',
                            'lay eggs',
                            'turn (change colour)',
                            'brown bears',
                            'one in a thousand'
                        ],
                        note: 'In Alaska, sockeye salmon swim up shallow rivers to lay their eggs. Only one in every thousand finishes the journey — many are caught by brown bears.'
                    }
                ],
                grammar: [
                    {
                        title: 'Real life — Making requests (7d)',
                        rule: 'Polite request: Can I…? / Can you…? / Could I…? — followed by the base verb.',
                        form: [
                            {
                                label: 'Ask',
                                text: 'Can I change …? / Can you give me …? / Could I have …?'
                            },
                            {
                                label: 'Yes',
                                text: 'Yes, of course. / Sure. / Certainly.'
                            },
                            {
                                label: 'No',
                                text: 'I\'m sorry, but … / I\'m afraid I don\'t …'
                            }
                        ],
                        examples: [
                            'Can I change one hundred dollars into euros? — Yes, of course.',
                            'Can you give me the euros in tens?',
                            'Could I borrow your phone, please?',
                            'I\'m sorry, but I don\'t have any change.'
                        ]
                    },
                    {
                        title: 'Writing skill — so and because (7e)',
                        rule: 'BECAUSE gives the REASON. SO gives the ACTION/RESULT. Choose based on what comes next.',
                        form: [
                            {
                                label: 'because',
                                text: 'action, BECAUSE + reason'
                            },
                            {
                                label: 'so',
                                text: 'reason, SO + action'
                            }
                        ],
                        examples: [
                            'We called a taxi BECAUSE we were late for the meeting. (action + reason)',
                            'The train was late, SO we waited on the platform. (reason + action)',
                            'I felt sorry for the bus driver BECAUSE he looked sad.',
                            'I wanted a hot meal, SO I left the bus.',
                            'It started raining, SO they ran home.'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit8',
        title: 'Appearance',
        icon: '👔',
        color: '#F472B6',
        intro: 'Talk about clothes, festivals, and people\'s appearance using present continuous and have got.',
        iCanGoals: [
            'Talk about clothes',
            'Talk about faces and parts of the body',
            'Use the present continuous with the present simple',
            'Use have got to talk about appearance',
            'Describe a picture or photo'
        ],
        lessons: [
            {
                id: '8a',
                title: 'Global fashions',
                page: '94-95',
                topicTags: ['clothes', 'present continuous', 'present simple vs continuous', '/s/ vs /ʃ/'],
                vocabulary: {
                    title: 'Clothes',
                    words: [
                        'bag',
                        'belt',
                        'coat',
                        'dress',
                        'jacket',
                        'jeans',
                        'leggings',
                        'scarf',
                        'shirt',
                        'shoes',
                        'shorts',
                        'skirt',
                        'socks',
                        'suit',
                        'sunglasses',
                        'tie',
                        'top',
                        'trousers',
                        'trainers',
                        'T-shirt',
                        'uniform'
                    ]
                },
                pronunciation: {
                    title: '/s/ and /ʃ/',
                    rule: 'The letter "s" can sound /s/ (suit, socks, sunglasses) or /ʃ/ (shoes, shirt, shorts). "Sh" is always /ʃ/.',
                    examples: ['/s/ — suit, socks, skirt, sunglasses', '/ʃ/ — shoes, shirt, shorts']
                },
                grammar: [
                    {
                        title: 'Present continuous',
                        rule: 'Use the present continuous for: an action you can see, an action happening now or around the time of speaking, or a changing action.',
                        form: [
                            {
                                label: '+',
                                text: 'Subject + am/is/are + verb-ing'
                            },
                            {
                                label: '−',
                                text: 'Subject + am/is/are + NOT + verb-ing'
                            },
                            {
                                label: '?',
                                text: 'Am/Is/Are + subject + verb-ing?'
                            }
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
                id: '8b',
                title: 'People at festivals',
                page: '96-97',
                topicTags: ['face & body', 'have got', 'sound and spelling'],
                vocabulary: {
                    title: 'Face and body',
                    words: [
                        'arm',
                        'beard',
                        'ear',
                        'eye',
                        'foot',
                        'hair',
                        'hand',
                        'head',
                        'leg',
                        'mouth',
                        'neck',
                        'nose',
                        'shoulder'
                    ]
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
                            {
                                label: '+',
                                text: 'I\'ve got / He\'s got / They\'ve got + ...'
                            },
                            {
                                label: '−',
                                text: 'I haven\'t got / He hasn\'t got + ...'
                            },
                            {
                                label: '?',
                                text: 'Have I got? / Has he got? — Yes, he has. / No, he hasn\'t.'
                            }
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
                id: '8c',
                title: 'Pink and blue',
                page: '98-99',
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
                id: '8d',
                title: 'Talking about photos + short messages + festivals',
                page: '100-103',
                topicTags: ['describing photos', 'silent letters', 'writing short messages', 'KISS rules', 'festival adjectives', 'video lesson'],
                vocabulary: [
                    {
                        title: 'Festival adjectives (8f)',
                        words: ['boring', 'colourful', 'crowded', 'exciting', 'fun', 'loud', 'noisy', 'popular', 'quiet', 'relaxing']
                    },
                    {
                        title: 'Festival/parade objects (8f)',
                        words: ['clarinet', 'clown', 'costume', 'glove', 'jewellery', 'mask', 'trumpet', 'fireworks', 'drums']
                    }
                ],
                pronunciation: {
                    title: 'Silent letters (8d)',
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
                        title: 'Real life — Talking about pictures and photos (8d)',
                        rule: 'Useful phrases for describing what you see in a photograph.',
                        examples: [
                            'Introduce: This photo shows … / I can see …',
                            'Location: On the left/right, in the middle, at the front/back',
                            'People: She looks happy / sad / bored / nervous. He is reading / sleeping / thinking.',
                            'Opinion: I think …, I like it because it\'s a beautiful picture.'
                        ]
                    },
                    {
                        title: 'Writing skill — The KISS rules (Keep It Short and Simple) (8e)',
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
            }
        ]
    },
    {
        unitId: 'unit9',
        title: 'Entertainment',
        icon: '🎬',
        color: '#A78BFA',
        intro: 'Talk about films, TV, art, and arrange to go out using "be going to" and the infinitive of purpose.',
        iCanGoals: [
            'Talk about future plans with be going to',
            'Use the infinitive of purpose correctly',
            'Talk about different types of films and TV programmes',
            'Talk about nature',
            'Invite someone',
            'Make arrangements'
        ],
        lessons: [
            {
                id: '9a',
                title: 'The Tallgrass Film Festival',
                page: '106-107',
                topicTags: ['films', 'be going to', '/tə/'],
                vocabulary: {
                    title: 'Films',
                    words: ['animation', 'comedy', 'documentary', 'fantasy', 'horror film', 'romantic comedy', 'science-fiction film', 'thriller'],
                    note: 'See vs watch: "I went TO SEE a film at the cinema" (the event). "I like WATCHING films with friends" (the activity).'
                },
                pronunciation: {
                    title: '/tə/ — weak "to"',
                    rule: 'In connected speech, "to" before a verb is reduced to a weak /tə/ sound.',
                    examples: ['I\'m going /tə/ buy a ticket.', 'Are you going /tə/ see the film?', 'I\'m going /tə/ watch it later.']
                },
                grammar: [
                    {
                        title: 'be going to (for plans)',
                        rule: 'Use "be going to" + base verb to talk about future plans (something already decided).',
                        form: [
                            {
                                label: '+',
                                text: 'Subject + am/is/are + going to + base verb'
                            },
                            {
                                label: '−',
                                text: 'Subject + am/is/are NOT + going to + base verb'
                            },
                            {
                                label: '?',
                                text: 'Am/Is/Are + subject + going to + base verb?'
                            }
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
                id: '9b',
                title: 'What\'s the future for TV?',
                page: '108-109',
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
                id: '9c',
                title: 'Nature in art',
                page: '110-111',
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
                id: '9d',
                title: 'Making arrangements + reviews + wildlife video',
                page: '112-115',
                topicTags: ['inviting', 'arrangements', 'enthusiasm stress', 'reviews', 'sense verbs', 'wildlife', 'video lesson'],
                vocabulary: {
                    title: 'Wildlife filming (9f)',
                    words: ['rainforest', 'camera trap', 'species', 'team', 'kinkajou', 'ocelot', 'Honduras', 'wildlife', 'documentary'],
                    note: 'A camera trap takes photos automatically when an animal moves in front of it. "Species" = type or group of animals (e.g., leopards are a species of big cat).'
                },
                pronunciation: {
                    title: 'Showing enthusiasm — stress on the key word (9d)',
                    rule: 'When you accept an invitation enthusiastically, put strong stress on one key word to sound excited.',
                    examples: ['I\'d LOVE to!', 'I\'d really LIKE to!', 'That\'s GREAT!', 'That sounds FANTASTIC!']
                },
                grammar: [
                    {
                        title: 'Real life — Inviting and making arrangements (9d)',
                        rule: 'Common phrases for inviting someone, responding to an invitation, and arranging a time/place.',
                        examples: [
                            'Inviting: Would you like to come? — Are you free? — Do you want to go?',
                            'Accepting: Thanks. I\'d love to. / That\'s great.',
                            'Refusing: I\'m sorry, but I\'m working late tonight.',
                            'Arranging: What time does it start? — Let\'s meet at seven. — See you at seven.'
                        ]
                    },
                    {
                        title: 'Writing skill — Sense verbs in reviews (9e)',
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
            }
        ]
    },
    {
        unitId: 'unit10',
        title: 'Learning',
        icon: '📚',
        color: '#60A5FA',
        intro: 'Talk about subjects, experiences, memory, and habits using the present perfect and past simple.',
        iCanGoals: [
            'Use the present perfect correctly',
            'Ask about past experiences',
            'Talk about subjects',
            'Talk about learning',
            'Check and clarify information'
        ],
        lessons: [
            {
                id: '10a',
                title: 'What have we learned?',
                page: '117-119',
                topicTags: ['subjects', 'learning verbs', 'synonyms & antonyms', 'present perfect'],
                vocabulary: [
                    {
                        title: 'School subjects',
                        words: ['history', 'physics', 'literature', 'geography', 'biology', 'mathematics', 'chemistry', 'IT (information technology)'],
                        note: 'Each subject studies a different topic: history → the past · physics → heat, light, energy · literature → books · geography → places · biology → living things · mathematics → numbers · chemistry → chemicals · IT → computers.'
                    },
                    {
                        title: 'Learning verbs',
                        words: [
                            'learn',
                            'study',
                            'pass',
                            'fail',
                            'forget',
                            'remember',
                            'know',
                            'understand',
                            'teach',
                            'discover',
                            'invent',
                            'design',
                            'practise'
                        ],
                        note: 'Synonyms — words with similar meanings: learn = study. Antonyms — words with opposite meanings: pass ≠ fail.'
                    }
                ],
                grammar: [
                    {
                        title: 'Present perfect',
                        rule: 'Use the present perfect to talk about something that happened in the past but is connected to NOW (we don\'t say exactly when).',
                        form: [
                            {
                                label: '+',
                                text: 'Subject + have/has + past participle'
                            },
                            {
                                label: '−',
                                text: 'Subject + haven\'t/hasn\'t + past participle'
                            },
                            {
                                label: '?',
                                text: 'Have/Has + subject + past participle?'
                            }
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
                id: '10b',
                title: 'How good is your memory?',
                page: '120-121',
                topicTags: ['memory', 'present perfect vs past simple', '-ed endings'],
                vocabulary: {
                    title: 'Things to remember',
                    words: ['names and faces', 'directions', 'addresses', 'telephone numbers', 'dates', 'facts', 'shopping lists', 'songs']
                },
                pronunciation: {
                    title: 'Past tense -ed endings',
                    rule: 'The "-ed" ending of regular past tense verbs has THREE different sounds depending on the last sound of the base verb.',
                    examples: [
                        '/t/ — after voiceless sounds (k, p, s, ʃ, tʃ, f): washed, watched, stopped, helped',
                        '/d/ — after voiced sounds (b, g, l, m, n, v, vowels): loved, played, called, opened',
                        '/ɪd/ — after t or d sounds (extra syllable): wanted, started, decided, needed'
                    ]
                },
                grammar: [
                    {
                        title: 'Present perfect vs Past simple',
                        rule: 'Both tenses talk about the past. The choice depends on whether we say WHEN it happened.',
                        form: [
                            {
                                label: 'Past simple',
                                text: 'when we KNOW or SAY the exact time'
                            },
                            {
                                label: 'Present perfect',
                                text: 'when we DON\'T say or know the exact time'
                            }
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
                id: '10c',
                title: 'Good learning habits',
                page: '122-123',
                topicTags: ['daily habits', 'word focus: up'],
                vocabulary: {
                    title: 'Daily habits',
                    words: [
                        'drinking coffee',
                        'brushing teeth',
                        'swimming',
                        'biting fingernails',
                        'eating chocolate',
                        'checking phone',
                        'smoking',
                        'practising guitar',
                        'putting sugar in tea',
                        'eating breakfast',
                        'learning new words'
                    ]
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
                id: '10d',
                title: 'Communication problems + voicemail + memory video',
                page: '124-127',
                topicTags: ['checking & clarifying', 'contrastive stress', 'email & websites', 'imperatives', 'memory', 'video lesson'],
                vocabulary: [
                    {
                        title: 'Email addresses & websites (10e)',
                        words: ['@ = at', '. = dot', '_ = underscore', '/ = slash', '- = hyphen'],
                        note: 'Example: j_jones@hotmail.co.uk → "j underscore jones at hotmail dot co dot uk"'
                    },
                    {
                        title: 'Language learning (10f)',
                        words: ['alphabet', 'classroom', 'pronunciation', 'memorize', 'repeat', 'translate', 'vocabulary', 'practice', 'fluent']
                    }
                ],
                pronunciation: {
                    title: 'Contrastive stress (10d)',
                    rule: 'When you correct information, put strong stress on the corrected word — that signals the change to the listener.',
                    examples: [
                        'A: Is that three in the MORNING? — B: No, in the AFTERNOON.',
                        'A: Was that the ENCASA Hotel? — B: No, the ANCASA Hotel. A for apple.',
                        'A: Is that E for England? — B: No, it\'s A for apple.'
                    ]
                },
                grammar: [
                    {
                        title: 'Real life — Checking and clarifying (10d)',
                        rule: 'When you can\'t hear or understand on the phone, use these phrases to check the information.',
                        examples: [
                            'Is that three in the morning? — No, in the afternoon.',
                            'Was that the Encasa Hotel? — No, the Ancasa Hotel. A for apple.',
                            'The number is 603 2169 2266. — So that\'s 603 2169 2266.',
                            'Have you called our colleagues? — Yes, I have.',
                            'Have you emailed me all the designs? — No, I haven\'t.'
                        ]
                    },
                    {
                        title: 'Writing skill — Imperatives in messages (10e)',
                        rule: 'When you write a phone message, simplify what the speaker said by using the IMPERATIVE form (= just the base verb, no subject).',
                        examples: [
                            'Speaker: "He can download them from this address: omarox.com/a-1"',
                            'Message: "Download them from omarox.com/a-1."',
                            'Speaker: "Can you call Jim back this evening?"',
                            'Message: "Call Jim back this evening."'
                        ]
                    }
                ]
            }
        ]
    },
    {
        unitId: 'unit11',
        title: 'Tourism',
        icon: '✈️',
        color: '#34D399',
        intro: 'Plan trips, give advice and suggestions, and use have to / can / should for rules and recommendations.',
        iCanGoals: [
            'Talk about visiting another country',
            'Give advice with should or shouldn\'t',
            'Talk about necessity and possibility',
            'Talk about places, people and things',
            'Talk about tourism',
            'Make suggestions and talk about holidays'
        ],
        lessons: [
            {
                id: '11a',
                title: 'Planning a trip',
                page: '130-131',
                topicTags: ['in another country', 'have to / can', '/hæftə/'],
                vocabulary: {
                    title: 'In another country',
                    words: [
                        'climate',
                        'currency',
                        'licence',
                        'multicultural',
                        'right-hand side',
                        'temperature',
                        'visa',
                        'language',
                        'road travel',
                        'weather',
                        'money',
                        'visas'
                    ]
                },
                pronunciation: {
                    title: '/hæftə/',
                    rule: '"have to" is pronounced /hæftə/ in connected speech (one quick word, not two).',
                    examples: ['I /hæftə/ get a visa.', 'You /hæftə/ start work at nine.', 'Tourists don\'t /hæftə/ get a new licence.']
                },
                grammar: [
                    {
                        title: 'have to / don\'t have to / can / can\'t',
                        rule: 'Use these modals to talk about rules. They are followed by the BASE FORM of the main verb.',
                        form: [
                            {
                                label: 'have to',
                                text: 'necessary (a rule you must follow)'
                            },
                            {
                                label: 'don\'t have to',
                                text: 'not necessary (it\'s your choice)'
                            },
                            {
                                label: 'can',
                                text: 'possible / allowed'
                            },
                            {
                                label: 'can\'t',
                                text: 'not possible / not allowed'
                            }
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
                id: '11b',
                title: 'On holiday',
                page: '132-133',
                topicTags: ['tourism', 'word families', 'should/shouldn\'t', 'word focus: take'],
                vocabulary: [
                    {
                        title: 'Tourism vocabulary',
                        words: [
                            'return ticket',
                            'single ticket',
                            'carry-on bag',
                            'book the hotel',
                            'rent a car',
                            'buy souvenirs',
                            'tour guide',
                            'sightseeing',
                            'public transport',
                            'local food',
                            'check in'
                        ],
                        note: 'Word families — when you learn a new word, learn the family: tour (verb) → tourism (noun) → tourist (person) → tour guide (collocation).'
                    },
                    {
                        title: 'Tourism categories',
                        words: [
                            'Type of holiday: camping, hiking, sightseeing',
                            'Type of ticket: return, single',
                            'Things you buy: souvenirs',
                            'Other people: tour guide, tourist'
                        ]
                    }
                ],
                grammar: [
                    {
                        title: 'should / shouldn\'t',
                        rule: 'Use should/shouldn\'t to give ADVICE. Followed by the base form. No auxiliary do/does in negatives or questions.',
                        form: [
                            {
                                label: '+',
                                text: 'Subject + should + base verb'
                            },
                            {
                                label: '−',
                                text: 'Subject + shouldn\'t + base verb'
                            },
                            {
                                label: '?',
                                text: 'Should + subject + base verb?'
                            }
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
                id: '11c',
                title: 'Should I go there?',
                page: '134-135',
                topicTags: ['Antarctica', 'reasons for/against', 'something / nobody / anywhere'],
                grammar: [
                    {
                        title: 'something, nobody, anywhere — compound pronouns',
                        rule: 'Combine some-/any-/no- with -thing/-body/-where to talk about people, places, and objects/activities.',
                        form: [
                            {
                                label: '-thing',
                                text: 'an object or activity'
                            },
                            {
                                label: '-body',
                                text: 'a person'
                            },
                            {
                                label: '-where',
                                text: 'a place'
                            }
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
                id: '11d',
                title: 'A holiday in S. America + questionnaires + London tour',
                page: '136-139',
                topicTags: [
                    'making suggestions',
                    '/ʌ/ /ʊ/ /uː/',
                    'questionnaire',
                    'hotel & questionnaire',
                    'writing: questionnaire',
                    'open & closed questions',
                    'London buildings',
                    'video lesson'
                ],
                vocabulary: {
                    title: 'London landmarks (11f)',
                    words: [
                        'the Shard',
                        'the Gherkin',
                        'the Cheesegrater',
                        'the Walkie-Talkie',
                        'Tower Bridge',
                        'River Thames',
                        'the Tower of London',
                        'football pitch'
                    ],
                    note: 'London buildings often get nicknames from their shape: the Gherkin (cucumber-shaped), the Cheesegrater, the Walkie-Talkie. The Shard is the tallest building in western Europe.'
                },
                pronunciation: {
                    title: '/ʌ/, /ʊ/ or /uː/ (11d)',
                    rule: 'Three vowel sounds that look similar in spelling but sound different. Listen carefully and learn each word\'s sound.',
                    examples: ['/ʌ/ — bus, but, love', '/ʊ/ — could, should, book', '/uː/ — cruise, food, you']
                },
                grammar: [
                    {
                        title: 'Real life — Making suggestions (11d)',
                        rule: 'Several common phrases to suggest an idea and to respond.',
                        examples: [
                            'Suggesting: You SHOULD go there. — How about visiting the Himalayas? — Can I make a suggestion?',
                            'Suggesting: Why don\'t you go on a tour? — You COULD travel on your own.',
                            'Responding +: Maybe you\'re right. / That\'s a really good idea.',
                            'Responding −: But the disadvantage is that it\'s expensive. / But the advantage is that it\'s with a tour guide.'
                        ]
                    },
                    {
                        title: 'Writing skill — Closed and open questions (11e)',
                        rule: 'Good questionnaires use BOTH types. Closed = yes/no answer. Open = longer answer.',
                        examples: [
                            'CLOSED — Did the tour guide answer all your questions? (yes/no)',
                            'CLOSED — Were all our staff polite and helpful? (yes/no)',
                            'OPEN — How was your bus tour? (longer answer)',
                            'OPEN — What other suggestions can you make? (longer answer)',
                            'Tip: Ask a closed question first, then a follow-up open question for more detail.'
                        ]
                    },
                    {
                        title: 'Real life — Giving a tour (11f)',
                        rule: 'Useful phrases for guiding visitors around a place.',
                        examples: [
                            'Opening: Good morning and welcome to the tour! Today, I\'m going to show you around the city of London.',
                            'Pointing things out: This is … (the River Thames / Tower Bridge / The Shard, etc.) It\'s famous because …',
                            'Moving on: Now let\'s look at another famous London sight.',
                            'Directions: Straight ahead / To the right / Further to the right, you can see …',
                            'Closing: That\'s the end of the tour. Do you have any questions?'
                        ]
                    }
                ]
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

// ==================== GRAMMAR TIPS (v3.40 — Vietnamese mnemonics) ====================
// A small lookup of memorable Vietnamese mnemonics attached to specific grammar
// topics. When the user finishes a question whose `topic` matches one of these
// patterns, the tip is rendered below the explanation (visible whether they got
// the question right OR wrong, so the rule sticks).
const GRAMMAR_TIPS = [
    {
        // -s endings on present-simple 3rd person verbs AND on regular plurals.
        // Matches Unit 3's "-s endings" topic, Unit 8's "final s: /s/ vs /z/"
        // / "sound and spelling", Unit 9 + 10's "underlined letter (final s …)"
        // and Unit 2's "plural nouns" pronunciation.
        match: /-s endings|final s.*\/s\/|final s.*\/z\/|final s.*\/iz\/|plural -s|plural nouns?\s*$|sound spelling.*final s|sound and spelling.*final s|underlined letter \(final s|underlined letter \(s: \/s\//i,
        id: 's-endings',
        title: '💡 Mẹo phát âm -s / -es',
        bodyHTML: `
            <div class="tip-row">
                <span class="tip-tag tip-tag-iz">/ɪz/</span>
                <div>
                    Sau âm <strong>xuýt</strong> (âm gió rít):
                    <em>Ông Sáu Sang Sông Chạy Xe SH</em>
                    → các từ kết thúc bằng <strong>s, z, sh, ch, x, ge/dge</strong>.
                    <span class="tip-eg">VD: buses, watches, finishes, judges, boxes</span>
                </div>
            </div>
            <div class="tip-row">
                <span class="tip-tag tip-tag-s">/s/</span>
                <div>
                    Sau <strong>phụ âm vô thanh</strong> (không làm rung cổ họng):
                    <em>Thời Fong Kiến Phương Tây</em>
                    → các từ kết thúc bằng <strong>t, f/ph, k/c, p, th (voiceless)</strong>.
                    <span class="tip-eg">VD: stops, writes, kicks, laughs, months</span>
                </div>
            </div>
            <div class="tip-row">
                <span class="tip-tag tip-tag-z">/z/</span>
                <div>
                    <strong>Mặc định</strong> cho mọi trường hợp còn lại — sau âm hữu thanh hoặc nguyên âm.
                    <span class="tip-eg">VD: needs, plays, loves, dogs, studies</span>
                </div>
            </div>
        `
    },
    {
        // -ed past-tense endings (separate rule but same family of mnemonics)
        match: /-ed endings?|past tense.*-?ed|past simple regular|underlined letter.*\/ed\/|sound spelling.*-ed/i,
        id: 'ed-endings',
        title: '💡 Mẹo phát âm -ed',
        bodyHTML: `
            <div class="tip-row">
                <span class="tip-tag tip-tag-iz">/ɪd/</span>
                <div>
                    Sau <strong>t</strong> hoặc <strong>d</strong> — thêm 1 âm tiết.
                    <span class="tip-eg">VD: wanted, started, visited, painted, decided</span>
                </div>
            </div>
            <div class="tip-row">
                <span class="tip-tag tip-tag-s">/t/</span>
                <div>
                    Sau <strong>phụ âm vô thanh</strong>: <em>Thời Fong Kiến Phương Tây</em>
                    → các từ kết thúc bằng <strong>k, p, f/ph, s, sh, ch, th (vô thanh)</strong>.
                    <span class="tip-eg">VD: liked, worked, watched, finished, asked</span>
                </div>
            </div>
            <div class="tip-row">
                <span class="tip-tag tip-tag-z">/d/</span>
                <div>
                    <strong>Mặc định</strong> sau âm hữu thanh hoặc nguyên âm.
                    <span class="tip-eg">VD: lived, played, travelled, called, opened</span>
                </div>
            </div>
        `
    }
];

// Returns the matching tip object for a given question (by topic), or null.
function getGrammarTipForQuestion(q) {
    if (!q || !q.topic) return null;
    for (const tip of GRAMMAR_TIPS) {
        if (tip.match.test(q.topic)) return tip;
    }
    return null;
}

// Render a tip object to HTML (for the result screen of a grammar question).
function renderGrammarTipHTML(tip) {
    if (!tip) return '';
    return `
        <div class="grammar-tip" data-tip-id="${tip.id}">
            <div class="grammar-tip-title">${tip.title}</div>
            <div class="grammar-tip-body">${tip.bodyHTML}</div>
        </div>
    `;
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
    // Use explicit undefined check so max=0 returns an empty array correctly.
    const limit = (typeof max === 'number') ? max : 10;
    return shuffled.slice(0, limit);
}
