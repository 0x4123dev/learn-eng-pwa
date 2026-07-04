// exam-data.js — Full mock-exam bank (HCMC Grade-10 entrance, 2026 reference).
// Each exam has 40 questions. Explanations follow the Grammar Unit-12 style:
// a 🔑 signal line + rule, then per-wrong-option ✗ notes (for MCQ) or a model
// answer (for text questions). More exams (2, 3, 4) can be appended to EXAMS.

// ---- Shared reading material -------------------------------------------------

const EXAM1_CLOZE = `Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.`;

const EXAM1_READING = `I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.`;

const EXAM1_WORDBANK = ['eating habits', 'have habits', 'develop the habit', 'let it become a habit', 'break the habit'];

// ---- EXAM 1 ------------------------------------------------------------------

const EXAM_1_QUESTIONS = [
    // --- Phonetics: pronunciation & stress (1–4) ---
    { n: 1, type: 'mcq', section: 'Phonetics', q: 'Which word has the underlined part pronounced differently from the others?',
      options: ['avoi<u>ded</u>', 'frighten<u>ed</u>', 'atten<u>ded</u>', 'sugges<u>ted</u>'], correct: 1,
      explanation: '🔑 Focus: the sound of the <b>-ed</b> ending.<br>After /t/ or /d/, <b>-ed</b> is pronounced /ɪd/: avoi<u>ded</u>, atten<u>ded</u>, sugges<u>ted</u> all end /ɪd/.<br>✗ <b>frightened</b> /ˈfraɪtnd/ — here -ed is just /d/, so it is the odd one out.' },
    { n: 2, type: 'mcq', section: 'Phonetics', q: 'Which word has the underlined part pronounced differently from the others?',
      options: ['ch<u>e</u>mist', 's<u>e</u>nsor', 'p<u>e</u>ncil', 'd<u>e</u>vice'], correct: 3,
      explanation: '🔑 Focus: the underlined vowel “e”.<br>ch<u>e</u>mist /ˈkemɪst/, s<u>e</u>nsor /ˈsensə/, p<u>e</u>ncil /ˈpensl/ all have the short /e/ sound.<br>✗ <b>device</b> /dɪˈvaɪs/ — the “e” is pronounced /ɪ/, so it differs from the others.' },
    { n: 3, type: 'mcq', section: 'Phonetics', q: 'Which word has a different stress pattern from the others?',
      options: ['listen', 'control', 'begin', 'decide'], correct: 0,
      explanation: '🔑 Focus: word stress.<br>con<b>TROL</b>, be<b>GIN</b>, de<b>CIDE</b> are all stressed on the SECOND syllable.<br>✗ <b>LIS</b>-ten is stressed on the FIRST syllable — the odd one out.' },
    { n: 4, type: 'mcq', section: 'Phonetics', q: 'Which word has a different stress pattern from the others?',
      options: ['brilliant', 'beautiful', 'natural', 'important'], correct: 3,
      explanation: '🔑 Focus: word stress.<br><b>BRIL</b>-liant, <b>BEAU</b>-ti-ful, <b>NAT</b>-u-ral are all stressed on the FIRST syllable.<br>✗ im-<b>POR</b>-tant is stressed on the SECOND syllable — the odd one out.' },

    // --- Vocabulary & grammar MCQ (5–16) ---
    { n: 5, type: 'mcq', section: 'Language use', q: 'Where should I put the vegetables you bought at the supermarket? — You\'d better put them ___ the fridge.',
      options: ['in', 'with', 'at', 'to'], correct: 0,
      explanation: '🔑 Signal: “the fridge” — an enclosed space.<br>We put things <b>in</b> the fridge; “in” is used for containers / enclosed spaces.<br>✗ with / at / to don\'t express being inside something.' },
    { n: 6, type: 'mcq', section: 'Language use', q: 'I haven\'t had any revision for the English exam. — You should start now, ___ it will be too late.',
      options: ['and', 'nor', 'so', 'or'], correct: 3,
      explanation: '🔑 Signal: “start now, ___ it will be too late.”<br><b>or</b> warns of a bad result: do X, OR (else) something bad happens.<br>✗ and just adds; nor needs a negative; so shows a result, not a warning.' },
    { n: 7, type: 'mcq', section: 'Language use', q: 'Have you ever visited the Museum of Fine Arts? — Yes, I ___ there with my classmates last summer.',
      options: ['go', 'am going', 'went', 'have been'], correct: 2,
      explanation: '🔑 Signal: “last summer” → Past Simple.<br>A finished past time needs the past form <b>went</b>.<br>✗ go (present) / am going (present continuous) don\'t fit a past time.<br>✗ have been (present perfect) can\'t sit with a finished-time marker like “last summer”.' },
    { n: 8, type: 'mcq', section: 'Language use', q: 'The new metro system in Ho Chi Minh City is useful. — It is. It reduces ___.',
      options: ['traffic jams', 'power cuts', 'building sites', 'road signs'], correct: 0,
      explanation: '🔑 Signal: a metro takes cars off the road.<br>A metro reduces road congestion, i.e. <b>traffic jams</b>.<br>✗ power cuts / building sites / road signs aren\'t reduced by a metro.' },
    { n: 9, type: 'mcq', section: 'Language use', q: 'What\'s your cousin like? — He\'s ___. He always tells the truth.',
      options: ['careful', 'noisy', 'honest', 'busy'], correct: 2,
      explanation: '🔑 Signal: “He always tells the truth.”<br>Someone who always tells the truth is <b>honest</b>.<br>✗ careful / noisy / busy don\'t describe truthfulness.' },
    { n: 10, type: 'mcq', section: 'Language use', q: 'This smart watch has features ___ can track your sleep patterns and heart rate.',
      options: ['who', 'whom', 'that', 'whose'], correct: 2,
      explanation: '🔑 Signal: the noun is a THING (“features”).<br>Use <b>that</b> (or which) as the relative pronoun for things.<br>✗ who / whom are for people; whose shows possession.' },
    { n: 11, type: 'mcq', section: 'Language use', q: 'You should watch English movies without ___ to improve your listening skills.',
      options: ['themes', 'subtitles', 'lyrics', 'details'], correct: 1,
      explanation: '🔑 Signal: “to improve your listening skills.”<br>Watching WITHOUT <b>subtitles</b> forces you to rely on listening.<br>✗ themes / lyrics / details don\'t relate to reading text on screen.' },
    { n: 12, type: 'mcq', section: 'Language use', q: 'A cleaning robot is really ___ for family life.',
      options: ['convenient', 'stressful', 'dangerous', 'talkative'], correct: 0,
      explanation: '🔑 Signal: a cleaning robot helps with housework.<br>Something that makes life easier is <b>convenient</b>.<br>✗ stressful / dangerous / talkative are negative or irrelevant here.' },
    { n: 13, type: 'mcq', section: 'Language use', q: 'Linda: ___  Jimmy: I\'ve got a terrible stomachache.',
      options: ['What are you doing?', 'What\'s the matter with you?', 'What\'s your plan for the weekend?', 'What are you up to?'], correct: 1,
      explanation: '🔑 Signal: the reply is “I\'ve got a terrible stomachache.”<br><b>What\'s the matter with you?</b> asks about a problem / health — matching the reply.<br>✗ the others ask about plans or current activity, not a problem.' },
    { n: 14, type: 'mcq', section: 'Language use', q: 'Would you like a cup of tea? — ___. I have had enough already.',
      options: ['No problem', 'Sure', 'Yes, please', 'No, thanks'], correct: 3,
      explanation: '🔑 Signal: “I have had enough already.” → a polite refusal.<br><b>No, thanks</b> politely declines the offer.<br>✗ No problem / Sure / Yes, please all accept, which contradicts “enough already”.' },
    { n: 15, type: 'mcq', section: 'Language use', q: 'What does the sign say? (A crossed-out “E-CIG” symbol.)',
      options: ['You should not use batteries here', 'You must not use electricity for charging devices', 'E-cigarettes are not allowed here', 'All electronic devices are banned'], correct: 2,
      explanation: '🔑 Signal: an “E-CIG” image with a line through it.<br>A crossed-out e-cigarette means <b>E-cigarettes are not allowed here</b>.<br>✗ the others talk about batteries / charging / all devices — not what the sign shows.' },
    { n: 16, type: 'mcq', section: 'Language use', q: 'What does the notice tell us? “Sales Tomorrow — Half price for two weeks only.”',
      options: ['Some items in this store will soon be free of charge', 'It\'s possible to get cheap items in this shop now', 'The special sale will last for 14 days', 'You can buy only two items at half price tomorrow'], correct: 2,
      explanation: '🔑 Signal: “Half price for two weeks only.”<br>Two weeks = 14 days, so <b>the sale will last for 14 days</b>.<br>✗ items aren\'t free; the sale starts tomorrow (not now); there is no two-item limit.' },

    // --- Cloze passage: deepfakes (17–22) ---
    { n: 17, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (17):',
      options: ['appearing', 'appear', 'to appear', 'appeared'], correct: 1,
      explanation: '🔑 Signal: “makes a person ___” → make + object + BARE infinitive.<br>After make + somebody, use the bare infinitive: <b>appear</b>.<br>✗ appearing / to appear / appeared don\'t follow the “make somebody do” pattern.' },
    { n: 18, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (18):',
      options: ['bigger', 'deeper', 'harder', 'easier'], correct: 3,
      explanation: '🔑 Signal: “cheaper to produce, and ___ to spread.”<br>The parallel comparative fits meaning: fake content is <b>easier</b> to spread.<br>✗ bigger / deeper / harder don\'t match “easy to spread”.' },
    { n: 19, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (19):',
      options: ['When', 'That', 'While', 'Though'], correct: 0,
      explanation: '🔑 Signal: “___ a deepfake is released, it continues to influence…”<br><b>When</b> (= once) introduces the time it happens, then its lasting effect.<br>✗ That / While / Though don\'t give this “once it happens” meaning.' },
    { n: 20, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (20):',
      options: ['way', 'style', 'fame', 'form'], correct: 2,
      explanation: '🔑 Signal: “could damage a person\'s ___.”<br>A fake video harms someone\'s reputation / good name, i.e. their <b>fame</b>.<br>✗ way / style / form don\'t collocate with “damage a person\'s ___”.' },
    { n: 21, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (21):',
      options: ['in', 'for', 'on', 'with'], correct: 2,
      explanation: '🔑 Signal: fixed collocation “have an effect ON”.<br>“Effect” takes the preposition <b>on</b>: a bad effect on the public.<br>✗ in / for / with aren\'t used with “effect” here.' },
    { n: 22, type: 'mcq', section: 'Cloze', passage: EXAM1_CLOZE, q: 'Blank (22):',
      options: ['Luckily', 'Dangerously', 'Hopefully', 'Traditionally'], correct: 1,
      explanation: '🔑 Signal: the sentence escalates a harm (people doubt ALL real information).<br><b>Dangerously</b> marks this as a serious, harmful effect.<br>✗ Luckily / Hopefully are positive; Traditionally is about custom — none fit a warning.' },

    // --- Reading passage: mountain hiking (23–28) ---
    { n: 23, type: 'tf', section: 'Reading', passage: EXAM1_READING, q: 'True or False: Pitons are equipment which hikers use.',
      options: ['True', 'False'], correct: 1,
      explanation: '🔑 The writer uses “feet, not ropes or pitons.”<br>Pitons are CLIMBING gear; the writer (a hiker) does NOT use them → the statement is <b>False</b>.' },
    { n: 24, type: 'tf', section: 'Reading', passage: EXAM1_READING, q: 'True or False: The writer started his Cliff Trail hike from the bottom of the Mansfield.',
      options: ['True', 'False'], correct: 1,
      explanation: '🔑 “Cliff Trail starts near the top, so I took a van there.”<br>He started near the TOP, not from the bottom → <b>False</b>.' },
    { n: 25, type: 'tf', section: 'Reading', passage: EXAM1_READING, q: 'True or False: The writer and the guide went down, up, and straight across the side of the mountain.',
      options: ['True', 'False'], correct: 0,
      explanation: '🔑 “climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain.”<br>Down, up, and across — the statement matches → <b>True</b>.' },
    { n: 26, type: 'tf', section: 'Reading', passage: EXAM1_READING, q: 'True or False: The writer and the guide reached the summit in the afternoon.',
      options: ['True', 'False'], correct: 0,
      explanation: '🔑 “reached the summit around 3 p.m.”<br>3 p.m. is in the afternoon → <b>True</b>.' },
    { n: 27, type: 'mcq', section: 'Reading', passage: EXAM1_READING, q: 'What is the best title of the passage?',
      options: ['Mount Mansfield – the Highest Peak of Vermont', 'Great Help from Local Guides', 'Mountain Climbing – A Risky Sport', 'Cliff Trail – The Hike of A Lifetime'], correct: 3,
      explanation: '🔑 The whole passage describes one special hike on Cliff Trail.<br><b>Cliff Trail – The Hike of A Lifetime</b> best fits the main idea.<br>✗ the others focus on one detail (the peak, the guide) or the wrong activity (climbing).' },
    { n: 28, type: 'mcq', section: 'Reading', passage: EXAM1_READING, q: 'What were the writer\'s feelings during the hike?',
      options: ['fear and excitement', 'worry and regret', 'annoyance and boredom', 'fun and tiredness'], correct: 0,
      explanation: '🔑 Signal: “I was both scared and excited.”<br>Scared + excited = <b>fear and excitement</b>.<br>✗ worry/regret, annoyance/boredom, fun/tiredness aren\'t stated.' },

    // --- Word form (29–34) — type the correct form ---
    { n: 29, type: 'text', section: 'Word form', q: 'The world is becoming a ___ (GLOBE) village thanks to communication technology.',
      accept: ['global'], answer: 'global',
      explanation: '🔑 Signal: “a ___ village” — an adjective before a noun.<br>“globe” → adjective <b>global</b> (a global village).' },
    { n: 30, type: 'text', section: 'Word form', q: 'We are looking forward to ___ (ENTERTAIN) the audience with our impressive variety show.',
      accept: ['entertaining'], answer: 'entertaining',
      explanation: '🔑 Signal: “look forward to” + <b>V-ing</b>.<br>“entertain” → <b>entertaining</b>.' },
    { n: 31, type: 'text', section: 'Word form', q: 'The old lady was ___ (PATIENCE) enough to wait for her turn at the busy bank.',
      accept: ['patient'], answer: 'patient',
      explanation: '🔑 Signal: “was ___ enough” — an adjective after “was”.<br>“patience” (noun) → adjective <b>patient</b>.' },
    { n: 32, type: 'text', section: 'Word form', q: 'The virtual ___ (EXHIBIT) has taken place since May 19th, 2026.',
      accept: ['exhibition'], answer: 'exhibition',
      explanation: '🔑 Signal: “The virtual ___” — a noun is needed.<br>“exhibit” → noun <b>exhibition</b>.' },
    { n: 33, type: 'text', section: 'Word form', q: 'Some music-streaming platforms have ___ (LEGAL) published songs without permission.',
      accept: ['illegally'], answer: 'illegally',
      explanation: '🔑 Signal: “without permission” + an adverb describing “published”.<br>“legal” → opposite adverb <b>illegally</b>.' },
    { n: 34, type: 'text', section: 'Word form', q: 'In the 19th century, many ___ (EXPLORE) made great discoveries which changed the world.',
      accept: ['explorers'], answer: 'explorers',
      explanation: '🔑 Signal: “many ___ made” — a plural person-noun.<br>“explore” → person noun, plural <b>explorers</b>.' },

    // --- Fill in the blank from word bank (35–36) ---
    { n: 35, type: 'text', section: 'Word bank', bank: EXAM1_WORDBANK, q: 'I\'m trying to ___ of staying up late.',
      accept: ['break the habit'], answer: 'break the habit',
      explanation: '🔑 Signal: “trying to ___ of staying up late” — stop a bad habit.<br>You <b>break the habit</b> of a bad routine.' },
    { n: 36, type: 'text', section: 'Word bank', bank: EXAM1_WORDBANK, q: 'Your ___ play an important role in body weight control.',
      accept: ['eating habits'], answer: 'eating habits',
      explanation: '🔑 Signal: “Your ___ … body weight control.”<br>What affects body weight is your <b>eating habits</b>.' },

    // --- Sentence transformation / rewrite (37–40) ---
    { n: 37, type: 'text', section: 'Rewrite', q: 'Brenda doesn\'t have her own locker at school, and she really wants to have one.\n→ Brenda wishes she ___',
      accept: ['had her own locker at school', 'had her own locker'], answer: 'had her own locker at school',
      explanation: '🔑 Signal: “wish” + Past Simple for an unreal present wish.<br>Brenda wishes she <b>had her own locker (at school)</b>.' },
    { n: 38, type: 'text', section: 'Rewrite', q: 'It doesn\'t matter to Lucie to help her friends with exercises after class.\n→ Lucie doesn\'t mind ___',
      accept: ['helping her friends with exercises after class', 'helping her friends with exercises', 'helping her friends'], answer: 'helping her friends with exercises after class',
      explanation: '🔑 Signal: “don\'t mind” + <b>V-ing</b>.<br>Lucie doesn\'t mind <b>helping her friends with exercises after class</b>.' },
    { n: 39, type: 'text', section: 'Rewrite', q: 'There are no roses left in the shop.\n→ The shop has run ___',
      accept: ['out of roses'], answer: 'out of roses',
      explanation: '🔑 Signal: “run out of” = have none left.<br>The shop has run <b>out of roses</b>.' },
    { n: 40, type: 'text', section: 'Rewrite', q: 'Despite the practicality of the project, nobody wanted to carry it out.\n→ Although the project ___',
      accept: ['was practical, nobody wanted to carry it out', 'was practical nobody wanted to carry it out', 'was practical'], answer: 'was practical, nobody wanted to carry it out',
      explanation: '🔑 Signal: “Despite + noun” → “Although + clause”.<br>Although the project <b>was practical, nobody wanted to carry it out</b>.' },
];

// Master list of exams. Add EXAM_2_QUESTIONS, etc. here later.
const EXAMS = [
    {
        id: 'exam1',
        title: 'Exam 1',
        subtitle: 'HCMC Grade-10 Entrance · 2026 (reference)',
        durationMin: 40,
        questions: EXAM_1_QUESTIONS,
    },
];

function getExam(examId) {
    return EXAMS.find(e => e.id === examId) || null;
}
