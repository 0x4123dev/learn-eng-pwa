// exam-data.js — Full mock-exam bank (HCMC Grade-10 entrance style).
// Each exam has 40 questions. Explanations follow the Grammar Unit-12 style:
// a 🔑 signal line + rule, then per-wrong-option ✗ notes (for MCQ/TF) or a
// model answer (for text questions). More exams can be appended to EXAMS.
// Exam 1 explanations expanded + Exam 2 authored via multi-agent workflow.

const EXAMS = [
  {
    "id": "exam1",
    "title": "Exam 1",
    "subtitle": "HCMC Grade-10 Entrance · 2026 (reference)",
    "durationMin": 40,
    "questions": [
      {
        "n": 1,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has the underlined part pronounced differently from the others?",
        "options": [
          "avoi<u>ded</u>",
          "frighten<u>ed</u>",
          "atten<u>ded</u>",
          "sugges<u>ted</u>"
        ],
        "correct": 1,
        "explanation": "🔑 Focus: the pronunciation of the <b>-ed</b> ending.<br>Rule: after a voiceless consonant sound (like /t/), -ed is /t/; after a voiced consonant/vowel sound it is normally /d/; but after the sounds <b>/t/ or /d/</b> themselves, -ed forms an extra syllable and is pronounced <b>/ɪd/</b>.<br>✓ avoi<u>ded</u> /əˈvɔɪdɪd/, atten<u>ded</u> /əˈtendɪd/ and sugges<u>ted</u> /səˈdʒestɪd/ all end in a /d/ or /t/ sound before -ed, so the ending is pronounced /ɪd/.<br>✗ <b>frighten<u>ed</u></b> /ˈfraɪtnd/ — the base verb \"frighten\" ends in /n/ (a nasal, not /t/ or /d/), so -ed is simply pronounced /d/, not /ɪd/ — this makes it the odd one out.<br>✗ avoided, attended, suggested — these are the three \"same\" words, not distractors; they all share the /ɪd/ sound and are correctly excluded from the answer.<br>Exam tip: always check the sound immediately before -ed, not the spelling — \"frighten\" looks similar to the others but its final consonant sound is different."
      },
      {
        "n": 2,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has the underlined part pronounced differently from the others?",
        "options": [
          "ch<u>e</u>mist",
          "s<u>e</u>nsor",
          "p<u>e</u>ncil",
          "d<u>e</u>vice"
        ],
        "correct": 3,
        "explanation": "🔑 Focus: how the letter <b>\"e\"</b> is pronounced in each underlined syllable.<br>Rule: in a closed/stressed syllable followed by a single consonant, \"e\" is usually the short front vowel <b>/e/</b> (as in \"bed\"). Ch<u>e</u>mist /ˈkemɪst/, s<u>e</u>nsor /ˈsensə(r)/, and p<u>e</u>ncil /ˈpensl/ all follow this pattern — the \"e\" stays a pure short /e/.<br>The correct answer, <b>device</b> /dɪˈvaɪs/, breaks the pattern: the first syllable is unstressed, so its \"e\" reduces to the weak vowel <b>/ɪ/</b>, not /e/ — making it the odd one out.<br>✗ <b>chemist</b> — \"e\" = /e/, matches the group (not the answer).<br>✗ <b>sensor</b> — \"e\" = /e/, matches the group (not the answer).<br>✗ <b>pencil</b> — \"e\" = /e/, matches the group (not the answer).<br>Tip: always check whether the syllable is <b>stressed</b> — unstressed syllables often weaken to /ɪ/ or /ə/, which is exactly what happens in \"device\"."
      },
      {
        "n": 3,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has a different stress pattern from the others?",
        "options": [
          "listen",
          "control",
          "begin",
          "decide"
        ],
        "correct": 0,
        "explanation": "🔑 Focus: <b>word stress</b> in two-syllable words.<br>Rule: many common two-syllable verbs (especially those borrowed from French/Latin) are stressed on the SECOND syllable, while native English words often stress the FIRST.<br>con<b>TROL</b> /kənˈtrəʊl/, be<b>GIN</b> /bɪˈɡɪn/, and de<b>CIDE</b> /dɪˈsaɪd/ all put the stress on syllable 2 — the vowel there is said louder, longer, and clearer, while the first syllable reduces to a weak /ə/ or /ɪ/ sound.<br>✗ <b>control</b> — stressed con<b>TROL</b> (2nd syllable), fits the pattern, not the odd one out.<br>✗ <b>begin</b> — stressed be<b>GIN</b> (2nd syllable), fits the pattern, not the odd one out.<br>✗ <b>decide</b> — stressed de<b>CIDE</b> (2nd syllable), fits the pattern, not the odd one out.<br>✓ <b>LIS</b>-ten /ˈlɪsn/ is stressed on the FIRST syllable, breaking the pattern shared by the other three — making it the correct answer."
      },
      {
        "n": 4,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has a different stress pattern from the others?",
        "options": [
          "brilliant",
          "beautiful",
          "natural",
          "important"
        ],
        "correct": 3,
        "explanation": "🔑 Focus: word stress patterns in multi-syllable adjectives.<br>Count the syllables and locate the strongest (loudest) one: <b>BRIL</b>-liant (2 syllables), <b>BEAU</b>-ti-ful (3 syllables), <b>NAT</b>-u-ral (3 syllables) — all three place the main stress on the very FIRST syllable.<br><b>im-POR-tant</b> (3 syllables) breaks this pattern because its main stress falls on the SECOND syllable, /ɪmˈpɔːtənt/, making it the odd one out.<br>✗ <b>brilliant</b> /ˈbrɪliənt/ — stressed on syllable 1, matches the majority pattern, not the answer.<br>✗ <b>beautiful</b> /ˈbjuːtɪfl/ — stressed on syllable 1, matches the majority pattern, not the answer.<br>✗ <b>natural</b> /ˈnætʃrəl/ — stressed on syllable 1, matches the majority pattern, not the answer.<br>Tip: many 3-syllable adjectives ending in <b>-ful</b> or <b>-al</b> keep first-syllable stress, while words like <b>important</b>, <b>familiar</b>, and <b>enormous</b> are exceptions stressed on the second syllable — always check a dictionary for stress marks rather than assuming a fixed rule."
      },
      {
        "n": 5,
        "type": "mcq",
        "section": "Language use",
        "q": "Where should I put the vegetables you bought at the supermarket? — You'd better put them ___ the fridge.",
        "options": [
          "in",
          "with",
          "at",
          "to"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: “the fridge” — a piece of furniture / equipment functioning as an <b>enclosed space</b> you store things inside.<br>Rule: the preposition <b>in</b> is used with containers, rooms, and enclosed spaces to show that something is located inside them — so we say put something <b>in</b> the fridge (also in the cupboard, in the drawer, in a box).<br>Because vegetables need to be stored inside the fridge to stay fresh, <b>in</b> is the only preposition that correctly expresses that meaning here.<br>✗ with — shows accompaniment or means (“cook with oil”), not location inside something; it doesn't make sense with “put the vegetables ___ the fridge”.<br>✗ at — used for a specific point or place (“at the door”, “at home”), not for being inside an enclosed container.<br>✗ to — used to express direction/movement toward a destination (“go to the fridge”), not the resulting position of the vegetables once stored."
      },
      {
        "n": 6,
        "type": "mcq",
        "section": "Language use",
        "q": "I haven't had any revision for the English exam. — You should start now, ___ it will be too late.",
        "options": [
          "and",
          "nor",
          "so",
          "or"
        ],
        "correct": 3,
        "explanation": "🔑 Signal: the second clause is a <b>warning of a bad consequence</b> — \"You should start now, ___ it will be too late.\"<br>Rule: <b>or</b> (= \"or else\") joins an imperative/advice clause to a negative result that will happen if the advice is NOT followed — \"Do X, or Y (bad thing) will happen.\" Here \"start now\" is the advice, and \"it will be too late\" is the unwanted consequence of failing to do it, so <b>or</b> is correct.<br>✗ <b>and</b> — simply adds one fact to another with no warning meaning; \"start now and it will be too late\" makes no logical sense as a consequence.<br>✗ <b>nor</b> — used to add a second negative idea after a negative clause (e.g. \"I don't smoke, nor do I drink\"); it cannot follow a positive imperative like \"start now\" and does not express a warning.<br>✗ <b>so</b> — introduces a result that follows FROM the action just mentioned (\"I studied, so I passed\"), which would wrongly suggest starting now CAUSES it to be too late — the opposite of the intended warning meaning."
      },
      {
        "n": 7,
        "type": "mcq",
        "section": "Language use",
        "q": "Have you ever visited the Museum of Fine Arts? — Yes, I ___ there with my classmates last summer.",
        "options": [
          "go",
          "am going",
          "went",
          "have been"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: \"last summer\" — a finished time marker in the past.<br>Rule: when a specific, completed time in the past is named (last summer, yesterday, in 2020), use the <b>Past Simple</b>, not the present perfect. \"Have you ever visited...?\" opens with present perfect (unspecified time), but the reply pins the action to \"last summer,\" so the tense must switch to Past Simple: <b>went</b>.<br>✗ go — this is the base/present form; it cannot express a completed past action at all.<br>✗ am going — present continuous describes a current or planned action, not something that already happened last summer.<br>✗ have been — present perfect is used for experiences with no fixed time (\"Have you ever visited...\") or for repeated/continuing situations, but it clashes with a definite past-time expression like \"last summer\"; once a specific past time is stated, English requires Past Simple instead."
      },
      {
        "n": 8,
        "type": "mcq",
        "section": "Language use",
        "q": "The new metro system in Ho Chi Minh City is useful. — It is. It reduces ___.",
        "options": [
          "traffic jams",
          "power cuts",
          "building sites",
          "road signs"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: \"The new metro system... reduces ___\" — think about what problem a metro (underground/urban rail) directly solves.<br>Rule: a metro system takes large numbers of commuters off the streets and off private vehicles, so its main practical benefit is cutting down road congestion — i.e. <b>traffic jams</b>. The verb \"reduces\" needs an object that a transport system logically decreases.<br>✗ <b>power cuts</b> — a power cut is an electricity-supply interruption; a metro is powered by electricity, it doesn't prevent outages.<br>✗ <b>building sites</b> — refers to construction areas, unrelated to congestion or transport flow.<br>✗ <b>road signs</b> — traffic signs are informational fixtures on the road; a metro has no effect on how many signs exist.<br>✓ Only <b>traffic jams</b> logically completes \"It reduces ___,\" matching the real-world function of a metro system."
      },
      {
        "n": 9,
        "type": "mcq",
        "section": "Language use",
        "q": "What's your cousin like? — He's ___. He always tells the truth.",
        "options": [
          "careful",
          "noisy",
          "honest",
          "busy"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: \"He always tells the truth.\"<br>This clue is a definition-style paraphrase: the missing adjective must describe a person's <b>character</b> that matches \"always telling the truth.\" The adjective <strong>honest</strong> means telling the truth and not lying or cheating, so it directly restates the clue given in the second sentence — this is the classic vocabulary-question pattern of \"description → matching trait word.\"<br>✗ <b>careful</b> — describes someone who avoids mistakes or danger (e.g. a careful driver), not someone linked to truth-telling.<br>✗ <b>noisy</b> — describes loud sound/behaviour, completely unrelated to honesty or truthfulness.<br>✗ <b>busy</b> — describes having a lot to do or being occupied with work, not a personality trait about truth.<br>Because only <b>honest</b> logically completes the cause-effect link between \"He's ___\" and \"He always tells the truth,\" it is the correct choice."
      },
      {
        "n": 10,
        "type": "mcq",
        "section": "Language use",
        "q": "This smart watch has features ___ can track your sleep patterns and heart rate.",
        "options": [
          "who",
          "whom",
          "that",
          "whose"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: the antecedent “features” is a THING, and the blank is the SUBJECT of the relative clause (“___ can track…”).<br>Rule: to introduce a defining relative clause about a thing acting as the clause's subject, use <b>that</b> (which is also possible, but only <b>that</b> is offered here).<br>✗ who — used for people as subject (e.g. \"the man who called\"), not for objects like \"features\".<br>✗ whom — used for people as the OBJECT of the clause (e.g. \"the man whom I met\"); wrong both for being a person-pronoun and for being an object form.<br>✗ whose — shows possession (\"features whose design…\"), but here the blank is the subject of \"can track\", not a possessive link, so it leaves the clause without a subject."
      },
      {
        "n": 11,
        "type": "mcq",
        "section": "Language use",
        "q": "You should watch English movies without ___ to improve your listening skills.",
        "options": [
          "themes",
          "subtitles",
          "lyrics",
          "details"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"watch English movies without ___ to improve your listening skills.\"<br>The purpose clause \"to improve your listening skills\" tells us the missing word must be something that, when removed, forces the learner to rely purely on their ears rather than their eyes. On-screen text that shows the dialogue in written form is called <b>subtitles</b> — watching WITHOUT subtitles means you cannot read along, so you must listen carefully to understand, which directly builds listening skill.<br>✗ <b>themes</b> — refers to the subject/topic of a film (e.g. love, war, friendship); removing \"themes\" has nothing to do with listening practice.<br>✗ <b>lyrics</b> — the words of a song, not of a movie's dialogue; movies aren't described as having \"lyrics\", so this doesn't fit the context.<br>✗ <b>details</b> — too vague/general; it doesn't refer to the specific on-screen text that helps viewers read instead of listen, so removing \"details\" wouldn't logically connect to improving listening.<br>✓ Only <b>subtitles</b> names the exact feature (on-screen captions) whose absence trains the ear, matching the stated goal in the sentence."
      },
      {
        "n": 12,
        "type": "mcq",
        "section": "Language use",
        "q": "A cleaning robot is really ___ for family life.",
        "options": [
          "convenient",
          "stressful",
          "dangerous",
          "talkative"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: \"A cleaning robot ... for family life\" — the blank needs an adjective describing how a helpful household device affects daily life.<br>A device that automatically does housework and saves people time and effort is described as <b>convenient</b> (= useful, easy to use, making a task simpler). This is the standard adjective used for gadgets, services, or arrangements that make life easier — exactly what a cleaning robot does.<br>✗ <b>stressful</b> — means causing worry or pressure; a labor-saving robot reduces stress, it doesn't cause it.<br>✗ <b>dangerous</b> — means risky or harmful; nothing in the sentence suggests the robot poses a threat.<br>✗ <b>talkative</b> — means \"fond of talking a lot\", an adjective for people/animals, not for a household appliance, and has no logical link to \"family life\" here."
      },
      {
        "n": 13,
        "type": "mcq",
        "section": "Language use",
        "q": "Linda: ___  Jimmy: I've got a terrible stomachache.",
        "options": [
          "What are you doing?",
          "What's the matter with you?",
          "What's your plan for the weekend?",
          "What are you up to?"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: Jimmy's reply is \"I've got a terrible stomachache\" — a statement of a physical problem/complaint, so Linda's question must be the kind that invites talk of a problem or how someone feels.<br>Rule: \"What's the matter (with you)?\" is the fixed English expression used to ask what is wrong with someone — typically prompting an answer about pain, illness, or trouble, exactly matching a stomachache reply.<br>✗ What are you doing? — asks about a present action in progress; a natural reply would describe an activity (\"I'm watching TV\"), not a symptom.<br>✗ What's your plan for the weekend? — asks about future plans/intentions, which has no logical connection to a sudden stomachache.<br>✗ What are you up to? — an informal way of asking what someone is currently doing or planning, again about activity, not health.<br>Answer: B — What's the matter with you?"
      },
      {
        "n": 14,
        "type": "mcq",
        "section": "Language use",
        "q": "Would you like a cup of tea? — ___. I have had enough already.",
        "options": [
          "No problem",
          "Sure",
          "Yes, please",
          "No, thanks"
        ],
        "correct": 3,
        "explanation": "🔑 Signal: \"___. I have had enough already.\" — the reason given AFTER the blank shows the speaker is turning the offer down.<br>Rule: when someone offers something (\"Would you like...?\") and you want to REFUSE it, English uses the fixed polite-refusal formula <b>No, thanks</b> (not \"No, thank you\" alone, but the same idea) — \"no\" signals refusal, \"thanks\" keeps it polite; \"I have had enough already\" then explains WHY you are refusing (you don't need more tea).<br>✗ <b>No problem</b> — this is a response to an apology or a request for a favour (e.g. \"Sorry to bother you.\" — \"No problem.\"), not a way to answer an offer of food/drink.<br>✗ <b>Sure</b> — an informal way of AGREEING/accepting (\"Sure, I'd love some\"), which contradicts \"I have had enough already\".<br>✗ <b>Yes, please</b> — the standard way to ACCEPT an offer; logically clashes with the stated reason for refusing.<br>Note: had this been an acceptance (\"I'm quite thirsty\"), \"Yes, please\" would have been correct — always match the accept/refuse phrase to the justification that follows it."
      },
      {
        "n": 15,
        "type": "mcq",
        "section": "Language use",
        "q": "What does the sign say? (A crossed-out “E-CIG” symbol.)",
        "options": [
          "You should not use batteries here",
          "You must not use electricity for charging devices",
          "E-cigarettes are not allowed here",
          "All electronic devices are banned"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: a circular prohibition sign showing an “E-CIG” (e-cigarette/vape) icon with a diagonal line crossing it out.<br>Rule: in public-sign language, a red circle with a diagonal bar through a picture means that the pictured thing/action is <b>forbidden in this location</b> — it is a \"No ___\" sign, not an instruction about how to use something. Since the icon inside the circle is specifically an e-cigarette (not a plug, battery, or generic device symbol), the sign is banning vaping here, so the correct reading is <b>E-cigarettes are not allowed here</b>.<br>✗ <b>You should not use batteries here</b> — there is no battery icon on the sign, and \"should not\" is far too weak for a red prohibition symbol, which expresses a strict rule (\"must not\"), not mere advice.<br>✗ <b>You must not use electricity for charging devices</b> — the icon is an e-cigarette shape, not a plug/charging symbol, so this misreads the picture as being about charging electronics in general.<br>✗ <b>All electronic devices are banned</b> — over-generalises: the crossed-out icon names one specific item (e-cigarettes), not \"all\" electronics such as phones or laptops, so this goes beyond what the sign actually shows."
      },
      {
        "n": 16,
        "type": "mcq",
        "section": "Language use",
        "q": "What does the notice tell us? “Sales Tomorrow — Half price for two weeks only.”",
        "options": [
          "Some items in this store will soon be free of charge",
          "It's possible to get cheap items in this shop now",
          "The special sale will last for 14 days",
          "You can buy only two items at half price tomorrow"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: “Half price for <b>two weeks only</b>.”<br>The notice announces a discount period, not a free giveaway: items are reduced to 50% of their normal price, and this offer is limited to a fixed duration of two weeks = 14 days — so <b>the special sale will last for 14 days</b> is the accurate paraphrase.<br>✗ Some items in this store will soon be free of charge — “half price” means 50% off, not 0% (not free).<br>✗ It's possible to get cheap items in this shop now — the notice says “Sales <b>Tomorrow</b>”, meaning the sale has not started yet, so “now” is wrong.<br>✗ You can buy only two items at half price tomorrow — “two weeks” describes the <b>duration</b> of the sale, not a limit of two items purchased."
      },
      {
        "n": 17,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (17):",
        "options": [
          "appearing",
          "appear",
          "to appear",
          "appeared"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"makes a person <b>___</b> to say or do something\" — the causative verb <b>make</b> + object + verb.<br>Rule: after <b>make somebody</b> (active voice, causative meaning \"cause/force someone to do something\"), the following verb must be the <b>bare infinitive</b> (no \"to\"), e.g. \"make him laugh\", \"make her cry\", \"make a person <strong>appear</strong>\". This is a fixed pattern — unlike verbs such as \"want/expect/allow\" which take a \"to-infinitive\" after the object, \"make\" (and \"let\", \"help\") drop the \"to\".<br>✗ <b>appearing</b> — a gerund/present participle; \"make\" is not followed by an \"-ing\" form after its object (that pattern belongs to verbs like \"keep somebody doing\").<br>✗ <b>to appear</b> — a full to-infinitive; this is the pattern for verbs like \"want/ask/expect + object + to-infinitive\", not for the causative \"make\" in the active voice.<br>✗ <b>appeared</b> — a past participle/past tense form; it cannot follow \"make + object\" as the main describing verb, and it would wrongly imply a passive/completed meaning rather than the bare infinitive required here.<br>✓ <b>appear</b> is correct: it is the bare infinitive that completes the \"make + object + bare infinitive\" structure."
      },
      {
        "n": 18,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (18):",
        "options": [
          "bigger",
          "deeper",
          "harder",
          "easier"
        ],
        "correct": 3,
        "explanation": "🔑 Signal: the parallel structure “more realistic, <b>cheaper</b> to produce, and ___ to spread.”<br>Rule: the sentence lists three comparative adjectives joined by commas and “and”, each followed by a <b>to-infinitive</b> showing what has become easier to do with advancing AI (more realistic / cheaper to produce / ___ to spread). For the list to make logical and grammatical sense, the third comparative must continue the same positive idea that technology has made deepfakes simpler to create and distribute, so <b>easier</b> (comparative of “easy”) is required: easier <i>to spread</i> = simpler to share/distribute widely, e.g. online.<br>✗ <b>bigger</b> — describes size/scale, not ease of distribution; “bigger to spread” is not meaningful.<br>✗ <b>deeper</b> — describes depth (physical or figurative), unrelated to how simple something is to circulate.<br>✗ <b>harder</b> — is the OPPOSITE meaning required; the passage is describing advances that make deepfakes MORE accessible, not more difficult to spread."
      },
      {
        "n": 19,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (19):",
        "options": [
          "When",
          "That",
          "While",
          "Though"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: \"___ a deepfake is released, it continues to influence public opinion.\" — a time clause linking one event to an ongoing consequence.<br>Rule: <b>when</b> (here meaning \"once/as soon as\") introduces an adverbial clause of TIME, showing that from the moment the first action happens (the deepfake is released), a second, continuing action follows (it keeps influencing opinion). This cause-then-continuation link is exactly the logic of the sentence, so <b>When</b> is correct.<br>✗ <b>That</b> — introduces a noun clause or defining relative clause (e.g. \"the fact that…\"), not an adverbial clause of time; it cannot connect a triggering event to its lasting effect.<br>✗ <b>While</b> — signals two actions happening AT THE SAME TIME or a contrast (\"while X, Y\"); it does not express the \"once it starts, the effect continues afterward\" sequence needed here.<br>✗ <b>Though</b> — introduces a clause of CONCESSION/contrast (\"although\"), implying the main clause is surprising given the first clause; there is no contrast intended between the release of a deepfake and its continuing influence, so it doesn't fit the meaning."
      },
      {
        "n": 20,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (20):",
        "options": [
          "way",
          "style",
          "fame",
          "form"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: \"A convincing fake video ... could damage a person's ___\" — the blank must be a noun collocating with the verb <b>damage</b> in the context of a person's public image.<br>Rule: the fixed collocation <b>damage somebody's reputation</b> (their good name/how others see them) is the standard way to talk about harm done to a person's public standing; here \"fame\" is used in that same sense of one's public image/standing, which a fake video can tarnish.<br>✗ <b>way</b> — means a manner or method of doing something; you don't \"damage a person's way\", it has no meaning as an object of \"damage\" here.<br>✗ <b>style</b> — refers to a manner of dress, writing, or behaviour; a video harms someone's public image, not their personal style.<br>✗ <b>form</b> — usually means shape, type, or physical condition (e.g. \"in good form\"); it does not collocate with \"damage a person's ___\" in the sense of reputation.<br>✓ <b>fame</b> (= how well-known and well-regarded someone is) is the only option that logically fits \"damage\" — a deepfake can ruin how the public perceives that person."
      },
      {
        "n": 21,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (21):",
        "options": [
          "in",
          "for",
          "on",
          "with"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: fixed noun + preposition collocation “(an) effect <b>on</b> someone/something”.<br>The noun <b>effect</b> always pairs with the preposition <b>on</b> when naming who or what is affected — “a bad effect on the public,” “an effect on the economy.” This is a fixed pattern to memorize, not a preposition chosen for its literal meaning.<br>✗ <b>in</b> — suggests location/containment (“in the public”), not how “effect” combines with its object.<br>✗ <b>for</b> — implies purpose or benefit (“good for the public”), a different collocation, not used with “effect.”<br>✗ <b>with</b> — implies accompaniment or means (“with the public”), not the required fixed pairing.<br>Correct: <b>on</b> — “Misinformation has a bad effect <b>on</b> the public even after it is corrected.”"
      },
      {
        "n": 22,
        "type": "mcq",
        "section": "Cloze",
        "passage": "Deepfake technology has challenged the relationship between seeing and believing. A deepfake is a digitally changed image, video or audio recording that makes a person <b>(17)&nbsp;___</b> to say or do something they never actually said or did. Although image controlling is not new, recent advances in artificial intelligence have made the deepfake more realistic, cheaper to produce, and <b>(18)&nbsp;___</b> to spread. As a result, deepfakes have come into entertainment, business and personal life. <b>(19)&nbsp;___</b> a deepfake is released, it continues to influence public opinion. A convincing fake video at a sensitive moment could damage a person's <b>(20)&nbsp;___</b>, affect opinions, or create panic before the truth is proved. Misinformation has a bad effect <b>(21)&nbsp;___</b> the public even after it is corrected. <b>(22)&nbsp;___</b>, deepfakes even make the public disbelieve and doubt all real information. Therefore, everyone should treat information with caution.",
        "q": "Blank (22):",
        "options": [
          "Luckily",
          "Dangerously",
          "Hopefully",
          "Traditionally"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: the sentence escalates the harm described just before it — misinformation \"has a bad effect on the public <b>even after it is corrected</b>\", and blank (22) introduces an even worse consequence: deepfakes make people \"disbelieve and doubt <b>all</b> real information.\"<br>Rule: this blank needs a sentence adverb that frames the coming clause as a serious, harmful, or worrying outcome — a \"bad-news\" connector, not a positive or neutral one. <b>Dangerously</b> (= in a way that causes harm or risk) is the only option that signals \"and here is the alarming next stage of the problem,\" matching the passage's warning tone and leading naturally into the closing advice \"Therefore, everyone should treat information with caution.\"<br>✗ <b>Luckily</b> — means \"fortunately\", introducing GOOD news; it would contradict the negative idea of people losing trust in all real information.<br>✗ <b>Hopefully</b> — expresses a wish for a positive outcome (\"it is hoped that…\"); it clashes with the certain, negative fact being stated.<br>✗ <b>Traditionally</b> — means \"according to custom/how things have long been done\"; it has no connection to a worsening consequence and doesn't fit the cause-effect logic of the passage."
      },
      {
        "n": 23,
        "type": "tf",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "True or False: Pitons are equipment which hikers use.",
        "options": [
          "True",
          "False"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: “I do a lot of mountain <b>hiking, not climbing</b>... using feet, <b>not ropes or pitons</b>.”<br>Rule: for True/False reading questions, check the statement word-for-word against what the passage actually says — a word appearing in the passage does not make a claim about it true.<br>The writer opens by drawing a clear line between <b>hiking</b> (what he does, using only feet) and <b>climbing</b> (which uses ropes and pitons). He explicitly says he does <b>not</b> use pitons, so pitons are equipment for climbers, not for hikers like him.<br>✗ True — this reverses the passage’s own contrast; the writer names pitons specifically to say he avoids them as a hiker, so the statement contradicts the text.<br>Correct answer: <b>False</b>."
      },
      {
        "n": 24,
        "type": "tf",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "True or False: The writer started his Cliff Trail hike from the bottom of the Mansfield.",
        "options": [
          "True",
          "False"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: “Cliff Trail starts near the <b>top</b>, so I took a van there.”<br>Rule: for True/False reading questions, match the statement against the exact location detail given in the passage rather than an assumption about how hikes usually begin.<br>The passage states Cliff Trail begins near the <b>top</b> of Mount Mansfield — the writer took a <b>van</b> up to that starting point; he did not walk up from the base.<br>The claim that he \"started from the bottom\" is the opposite of what the text says, so the statement is <b>False</b>.<br>✗ True — would only be correct if the passage said he began at the base and climbed upward from there, which contradicts the actual account."
      },
      {
        "n": 25,
        "type": "tf",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "True or False: The writer and the guide went down, up, and straight across the side of the mountain.",
        "options": [
          "True",
          "False"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: “we <b>climbed down</b> wooden ladders, <b>passed up</b> rock faces, and <b>crossed</b> the side of the mountain.”<br>Rule: for True/False reading questions, match the statement's sequence of actions against the exact order and content given in the passage — every part of a compound claim (down, up, across) must be verified, not just one part.<br>The passage describes three distinct movements in this order: going <b>down</b> wooden ladders, going <b>up</b> over rock faces, and going <b>straight across</b> the side of the mountain. The statement \"went down, up, and straight across\" reproduces all three actions accurately, so it is fully supported by the text.<br>✗ False — would be correct only if the passage described a single direction of travel (e.g., only upward, as in typical climbing) or omitted one of the three movements; since all three verbs (down/up/across) are explicitly present, rejecting the statement contradicts the text.<br>Correct answer: <b>True</b>."
      },
      {
        "n": 26,
        "type": "tf",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "True or False: The writer and the guide reached the summit in the afternoon.",
        "options": [
          "True",
          "False"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: \"We started at 10 a.m., reached the summit around <b>3 p.m.</b>, and stopped there for a long slow look at Vermont.\"<br>Rule: for True/False reading questions, match the statement against the passage's exact facts — here the key detail is the CLOCK TIME the summit was reached, not the time they started or how long the hike took.<br><b>3 p.m.</b> falls within the afternoon (the period from noon until evening), so \"reached the summit in the afternoon\" accurately restates the passage.<br>✗ False — would wrongly claim the passage contradicts this; but the passage states the exact time (3 p.m.) and it does fall in the afternoon, so there is no contradiction — False is not supported by the text.<br>Note: don't confuse the <b>start</b> time (10 a.m., morning) with the <b>summit-arrival</b> time (3 p.m., afternoon) — the question asks specifically about reaching the summit.<br>Correct answer: <b>True</b>."
      },
      {
        "n": 27,
        "type": "mcq",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "What is the best title of the passage?",
        "options": [
          "Mount Mansfield – the Highest Peak of Vermont",
          "Great Help from Local Guides",
          "Mountain Climbing – A Risky Sport",
          "Cliff Trail – The Hike of A Lifetime"
        ],
        "correct": 3,
        "explanation": "🔑 Focus: identifying the passage's <b>main idea</b> to choose the best title.<br>Rule: the best title must sum up the WHOLE passage, not just one supporting detail. The writer opens by naming a specific route — \"Cliff Trail on Vermont's highest peak\" — calls it \"the hike of a lifetime,\" and then spends every paragraph describing that single, unforgettable hike (the descent on ladders, using hands/arms/shoulders, feeling \"scared and excited,\" reaching the summit, the \"marvellous\" view). Since the whole text centers on this one extraordinary experience, <b>Cliff Trail – The Hike of A Lifetime</b> is the only option that captures the passage's overall purpose and tone.<br>✗ <b>Mount Mansfield – the Highest Peak of Vermont</b> — only restates a background fact (the mountain's height/location) mentioned in one sentence; it ignores the actual story of the hike itself.<br>✗ <b>Great Help from Local Guides</b> — the guide is mentioned only briefly (he \"pushed and pulled\" the writer through hard spots); this is a minor supporting detail, not the passage's focus.<br>✗ <b>Mountain Climbing – A Risky Sport</b> — factually wrong and contradicts the text: the writer explicitly says \"I do a lot of mountain <b>hiking, not climbing</b>,\" and never frames the trip as risky/dangerous.<br>Correct answer: <b>D — Cliff Trail – The Hike of A Lifetime</b>, as it reflects the passage's central topic and the writer's own description of the experience."
      },
      {
        "n": 28,
        "type": "mcq",
        "section": "Reading",
        "passage": "I do a lot of mountain hiking, not climbing, so you know I'm talking about using feet, not ropes or pitons, to get me wherever I want, but my first law of relaxation is never to do a sport where a mistake can mean death. I recently discovered the hike of a lifetime: Cliff Trail on Vermont's highest peak, the 4,393-foot (1,338-meter) Mount Mansfield. There are many ways to climb the Mansfield, but Cliff Trail starts near the top, so I took a van there. I was hiking with a local guide.<br><br>When we reached our destination, we hiked down a short path to Cliff Trail. For the rest of the morning, instead of going ever upwards, we climbed down wooden ladders, passed up rock faces, and crossed the side of the mountain. Besides mostly using feet, we used hands to hold onto roots, arms to pull us over steep rocks, and shoulders to get through narrow passages. Occasionally, my guide pushed and pulled me through the difficult spots. I was both scared and excited.<br><br>We started at 10 a.m., reached the summit around 3 p.m., and stopped there for a long slow look at Vermont. The view was marvellous.",
        "q": "What were the writer's feelings during the hike?",
        "options": [
          "fear and excitement",
          "worry and regret",
          "annoyance and boredom",
          "fun and tiredness"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: “I was both scared and excited.” — the writer names his emotions directly, right after describing the guide pushing and pulling him through the difficult spots on the cliff.<br>This is a <b>detail question about feelings</b>: match the adjectives in the passage to their noun forms in the options. “Scared” = <b>fear</b>, and “excited” = <b>excitement</b>, so <b>fear and excitement</b> is the only option restating both feelings the writer actually reports.<br>✗ <b>worry and regret</b> — the writer never expresses regret about the hike or ongoing worry; he ends by calling the summit view “marvellous,” which shows satisfaction, not regret.<br>✗ <b>annoyance and boredom</b> — nothing in the text suggests he was bored or irritated; the passage instead emphasizes an intense, engaging (not tedious) climb.<br>✗ <b>fun and tiredness</b> — “fun” and “tiredness” are never mentioned; the only feelings named in the passage are fear (scared) and excitement, not enjoyment or fatigue."
      },
      {
        "n": 29,
        "type": "text",
        "section": "Word form",
        "q": "The world is becoming a ___ (GLOBE) village thanks to communication technology.",
        "accept": [
          "global"
        ],
        "answer": "global",
        "explanation": "🔑 Signal: “a ___ village” — a blank between the article “a” and the noun “village” must be an adjective that modifies it.<br><b>Rule:</b> ARTICLE + ___ + NOUN = adjective slot. The root word given is GLOBE (noun, \"the earth/world\"); its adjective form is global (\"worldwide, covering the whole world\").<br>\"a <strong>global</strong> village\" is a fixed expression meaning the world has become so connected by technology that it feels like one small community.<br>✗ globe — this is the bare noun form; a noun cannot directly modify another noun in this slot (\"globe village\" is not a recognized phrase).<br>✗ globally — this is the adverb form, used to modify verbs/adjectives (e.g. \"connected globally\"), not nouns, so it cannot sit directly before \"village\".<br>✗ globalize / globalization — these are the verb and process-noun forms; neither fits the ARTICLE + ___ + NOUN adjective slot."
      },
      {
        "n": 30,
        "type": "text",
        "section": "Word form",
        "q": "We are looking forward to ___ (ENTERTAIN) the audience with our impressive variety show.",
        "accept": [
          "entertaining"
        ],
        "answer": "entertaining",
        "explanation": "🔑 Signal: the fixed phrase \"look forward to\" + a blank needing (ENTERTAIN).<br>Rule: after the preposition <b>to</b> in \"look forward to\", \"be used to\", \"get used to\", \"object to\", etc., <b>to</b> behaves as a preposition, not part of an infinitive — so it must be followed by a <b>gerund (V-ing)</b>, never a bare or to-infinitive verb.<br>\"entertain\" (verb) → gerund <strong>entertaining</strong>, giving \"looking forward to <strong>entertaining</strong> the audience\".<br>✗ entertain — a bare infinitive; wrong because \"to\" here is prepositional, not the infinitive marker, so V-ing is required.<br>✗ to entertain — treats \"to\" as an infinitive marker, but \"look forward to\" already ends in \"to\", so adding another \"to entertain\" is redundant and ungrammatical.<br>✗ entertained — a past participle/past form, which does not fit after a preposition; only the gerund form works in this slot."
      },
      {
        "n": 31,
        "type": "text",
        "section": "Word form",
        "q": "The old lady was ___ (PATIENCE) enough to wait for her turn at the busy bank.",
        "accept": [
          "patient"
        ],
        "answer": "patient",
        "explanation": "🔑 Signal: “was ___ enough (to wait...)” — the gap sits between the linking verb <b>was</b> and <b>enough</b>, a slot that must be filled by an <b>adjective</b> describing the subject “the old lady”.<br>Rule: <b>ADJECTIVE + enough (+ to-infinitive)</b> describes a quality sufficient to do something; the base word PATIENCE is a noun and must be converted to its adjective form.<br>PATIENCE (noun) → <strong>patient</strong> (adjective), meaning able to wait calmly without complaint — exactly what “waiting for her turn” describes.<br>✗ patience — stays a noun (e.g. “she had patience”); a noun cannot follow “was” + “enough” in this slot, it needs “with patience” or a different structure.<br>✗ patiently — an adverb; adverbs modify verbs/adjectives, not a noun (“the old lady”) directly after “was”, and “enough” after an adverb here would be ungrammatical in this frame.<br>✗ impatient / impatience — reverses the meaning; the context (waiting calmly for her turn) requires the positive quality, not its opposite."
      },
      {
        "n": 32,
        "type": "text",
        "section": "Word form",
        "q": "The virtual ___ (EXHIBIT) has taken place since May 19th, 2026.",
        "accept": [
          "exhibition"
        ],
        "answer": "exhibition",
        "explanation": "🔑 Signal: “The virtual ___ has taken place” — the blank follows the article/adjective pair “The virtual” and is the subject of the verb “has taken place”, so it must be a <b>noun</b>.<br>Rule: many verbs form their event/action noun with the suffix <b>-ion/-ition</b> (exhibit → exhibit<b>ion</b>, act → act<b>ion</b>, invite → invit<b>ation</b>).<br>“Exhibit” alone can already be a noun, but it then means one displayed item/object (“an exhibit in a museum”); the organized public event or show where things are displayed is called an <b>exhibition</b>, which is the meaning needed here — a virtual (online) exhibition that has been running since May 19th.<br>Model answer: <strong>exhibition</strong>.<br>Derivation: EXHIBIT (verb, “to display publicly”) + suffix <b>-ition</b> → EXHIBITION (noun, “a public display/show”), correctly filling the noun slot after “The virtual”."
      },
      {
        "n": 33,
        "type": "text",
        "section": "Word form",
        "q": "Some music-streaming platforms have ___ (LEGAL) published songs without permission.",
        "accept": [
          "illegally"
        ],
        "answer": "illegally",
        "explanation": "🔑 Signal: “have ___ published songs” — the blank sits between the auxiliary <b>have</b> and the past participle <b>published</b>, a slot that modifies the verb, so it must be an <b>adverb</b>.<br><b>Rule:</b> HAVE + ___ + PAST PARTICIPLE = adverb slot describing how the action was done. The root word <b>LEGAL</b> is an adjective meaning \"allowed by law\"; here the context \"<b>without permission</b>\" shows the action was NOT lawful, so we need its negative adverb form: legal → illegal (prefix il- before an l) → <b>illegally</b> (adverb, \"in an unlawful way\").<br>“have <strong>illegally</strong> published songs without permission” = have published songs in a way that breaks the law.<br>✗ legally — this is the adverb but with the wrong (positive) meaning; it would say the platforms published songs lawfully, contradicting “without permission”.<br>✗ legal / illegal — these are adjective forms; an adjective cannot modify a verb (published), so it cannot fill this slot.<br>✗ legality / illegality — these are noun forms (\"the state of being lawful/unlawful\"), which cannot describe how the verb “published” was performed."
      },
      {
        "n": 34,
        "type": "text",
        "section": "Word form",
        "q": "In the 19th century, many ___ (EXPLORE) made great discoveries which changed the world.",
        "accept": [
          "explorers"
        ],
        "answer": "explorers",
        "explanation": "🔑 Signal: <b>“many ___ made”</b> — “many” quantifies a countable noun, and that noun is the subject performing the action “made great discoveries”, so a <b>person-noun</b> (agent) in the <b>plural</b> is required, not a verb or adjective.<br>Rule: the verb <b>explore</b> takes the agent suffix <b>-er</b> to name “a person who explores” → <b>explorer</b>; since “many” + a plural subject + plural verb “made” all signal plurality, add <b>-s</b> → <strong>explorers</strong>.<br>Derivation: explore (verb) → explorer (noun, agent) → explorers (plural noun, subject of “made”).<br>✗ explore — this is the bare verb; “many ___” needs a noun, not a verb, and there is no second verb slot before “made”.<br>✗ explorer (singular) — grammatically a noun but clashes with the plural quantifier “many” and the plural verb “made”.<br>✗ exploration — this means “the act of exploring” (an abstract/uncountable-leaning noun), not a person, so it cannot be the ones who “made discoveries”."
      },
      {
        "n": 35,
        "type": "text",
        "section": "Word bank",
        "bank": [
          "eating habits",
          "have habits",
          "develop the habit",
          "let it become a habit",
          "break the habit"
        ],
        "q": "I'm trying to ___ of staying up late.",
        "accept": [
          "break the habit"
        ],
        "answer": "break the habit",
        "explanation": "🔑 Signal: <b>“trying to ___ <u>of</u> staying up late”</b> — the preposition <b>“of”</b> right after the blank is the key clue, because only the collocation <b>break the habit <u>of</u> (doing something)</b> is followed by “of”, and “trying to” signals an effort to stop an unwanted behavior.<br>Rule: <b>break the habit (of + V-ing)</b> is the fixed idiom meaning “to make an effort to stop doing something you regularly and unhealthily do”, which fits “staying up late” perfectly.<br>Model answer: I'm trying to <strong>break the habit</strong> of staying up late.<br>✗ eating habits — a noun phrase (plural “habits” you have), not a verb phrase after “trying to”, and it doesn't collocate with “of + V-ing”.<br>✗ have habits — “trying to have habits of staying up late” reverses the meaning (it would mean wanting to acquire the habit, not stop it).<br>✗ develop the habit — means the opposite: to start/build a new habit, not end an existing bad one.<br>✗ let it become a habit — also means allowing a behavior to start, contradicting “trying to” stop it; it also doesn't fit grammatically after “trying to ___ of”."
      },
      {
        "n": 36,
        "type": "text",
        "section": "Word bank",
        "bank": [
          "eating habits",
          "have habits",
          "develop the habit",
          "let it become a habit",
          "break the habit"
        ],
        "q": "Your ___ play an important role in body weight control.",
        "accept": [
          "eating habits"
        ],
        "answer": "eating habits",
        "explanation": "🔑 Signal: \"Your ___ … play an important role in <b>body weight control</b>.\"<br>The blank needs a plural noun phrase naming the daily behavior around food that determines weight gain or loss — this is a common collocation in health/nutrition topics.<br>Rule: <b>eating habits</b> = the regular patterns of what, when, and how much a person eats; it collocates with verbs like \"affect/influence/control\" and nouns like \"weight,\" \"health,\" \"diet.\"<br>Model answer: Your <strong>eating habits</strong> play an important role in body weight control.<br>Note: The noun must stay plural (\"habits,\" not \"habit\") because it refers to a set of recurring behaviors, and it must be a noun phrase (not a verb form) to fit the subject position of the sentence — \"eat habit\" or \"eating habit\" (singular) would be grammatically and semantically incomplete."
      },
      {
        "n": 37,
        "type": "text",
        "section": "Rewrite",
        "q": "Brenda doesn't have her own locker at school, and she really wants to have one.\n→ Brenda wishes she ___",
        "accept": [
          "had her own locker at school",
          "had her own locker"
        ],
        "answer": "had her own locker at school",
        "explanation": "🔑 Focus: <b>wish</b> + Past Simple to express an <b>unreal/hypothetical wish about the present</b>.<br>Rule: when someone wishes their current situation were different, use \"<b>wish + subject + Past Simple</b>\" (a \"wishing-past\" that shows the opposite of present reality, not an actual past action). Since Brenda's real situation is \"she doesn't have her own locker,\" the wish form flips the negative present into an affirmative past-tense verb: \"she <b>had</b>.\"<br>Model answer: Brenda wishes she <strong>had her own locker (at school)</strong>.<br>Derivation: original two clauses — \"Brenda doesn't have her own locker at school\" (fact) + \"she really wants to have one\" (desire) — are merged into a single \"wish\" sentence. The negative present \"doesn't have\" becomes the affirmative past-simple \"had\" (not \"didn't have,\" because <b>wish</b> already carries the negative meaning; doubling the negative would be wrong). \"at school\" is optional but keeps the original detail.<br>✗ has her own locker at school — wrong tense; present simple after \"wish\" would (incorrectly) describe a real fact, not a contrary-to-fact wish.<br>✗ doesn't have her own locker at school — repeats the negative fact itself instead of expressing the wish for the opposite.<br>✗ will have her own locker at school — \"wish + would\" is used for wishing someone/something ELSE would change or complaining about annoying habits/future actions, not for the speaker's own present state."
      },
      {
        "n": 38,
        "type": "text",
        "section": "Rewrite",
        "q": "It doesn't matter to Lucie to help her friends with exercises after class.\n→ Lucie doesn't mind ___",
        "accept": [
          "helping her friends with exercises after class",
          "helping her friends with exercises",
          "helping her friends"
        ],
        "answer": "helping her friends with exercises after class",
        "explanation": "🔑 Signal: <b>“It doesn't matter to sb <u>to</u> V”</b> being rewritten with <b>“doesn't mind”</b> — this expression of indifference must be paraphrased using the fixed pattern <b>mind + V-ing</b>, never “mind + to-infinitive”.<br>Rule: <b>mind</b> is a verb that takes a <b>gerund</b> object (mind doing sth), so the original infinitive “to help” must be converted to the gerund <b>helping</b>, while the rest of the sentence (“her friends with exercises after class”) carries over unchanged since it is simply the object/adverbial of that action.<br>Model answer: Lucie doesn't mind <strong>helping her friends with exercises after class</strong>.<br>Derivation: It doesn't matter to Lucie <u>to help</u> (infinitive, “matter” pattern) → Lucie doesn't mind <u>helping</u> (gerund, “mind” pattern) — same meaning (Lucie is willing/indifferent about doing it), different verb pattern.<br>✗ to help her friends... — “mind” cannot be followed by a to-infinitive; only “mind + V-ing” is grammatical.<br>✗ help her friends... (bare infinitive) — same error: a bare or to-infinitive after “mind” is ungrammatical.<br>✗ helps/helped her friends... — “mind” must be followed by a non-finite verb form (gerund), not a conjugated present or past tense verb."
      },
      {
        "n": 39,
        "type": "text",
        "section": "Rewrite",
        "q": "There are no roses left in the shop.\n→ The shop has run ___",
        "accept": [
          "out of roses"
        ],
        "answer": "out of roses",
        "explanation": "🔑 Signal: the original sentence \"There are <b>no roses left</b>\" means the shop's supply of roses is completely finished, and the target stem \"The shop has run ___\" forces the fixed phrasal verb <b>run out of</b>.<br>Rule: <b>run out of + (noun)</b> = to have used up or sold all of something, so that none remains; it is the standard paraphrase for \"there is/are no ... left\" and always takes \"of\" before the noun it refers to.<br>Because \"has run\" is already given in the Present Perfect, only the particle + object combination <b>out of roses</b> completes the collocation correctly, matching the meaning \"the shop no longer has any roses to sell.\"<br>Model answer: The shop has run <strong>out of roses</strong>.<br>Derivation: \"no roses left\" (adjective phrase describing the shop's stock) is transformed into the verb phrase \"run out of roses\" (the shop as subject performing the action of exhausting its stock) — the same real-world fact, expressed with a different subject and verb structure.<br>Note: \"run out\" alone (without \"of roses\") would be grammatically incomplete here, since the stem explicitly asks what the shop has run — the object \"roses\" must follow \"out of\"."
      },
      {
        "n": 40,
        "type": "text",
        "section": "Rewrite",
        "q": "Despite the practicality of the project, nobody wanted to carry it out.\n→ Although the project ___",
        "accept": [
          "was practical, nobody wanted to carry it out",
          "was practical nobody wanted to carry it out",
          "was practical"
        ],
        "answer": "was practical, nobody wanted to carry it out",
        "explanation": "🔑 Signal: “<b>Despite</b> + noun phrase” must be converted into “<b>Although</b> + subject + verb (clause)”.<br><b>Rule:</b> Despite/In spite of are prepositions and are followed by a <b>noun / noun phrase / V-ing</b> (here: “the practicality of the project”), while Although/Though/Even though are conjunctions and must be followed by a <b>full clause</b> (subject + verb). So the noun “practicality” must be turned back into the adjective it came from — <b>practical</b> — and given its own subject and verb: “the project <b>was practical</b>”.<br>Derivation: practicality (noun) → practical (adjective); “the practicality of the project” → “the project was practical”. The second clause “nobody wanted to carry it out” is simply carried over unchanged, joined by a comma since “Although” now opens the sentence.<br>Model answer: Although the project <strong>was practical, nobody wanted to carry it out.</strong><br>✗ “Although the project practicality…” — keeps the noun form after Although; a conjunction needs a verb (was), not a bare noun phrase, so this is not a grammatical clause.<br>✗ “Although the project's practicality, nobody wanted…” — still a noun phrase (no verb), so it fails the same clause requirement; Although can never be directly followed by a noun/possessive phrase.<br>✗ Omitting the comma before “nobody” — when the Although-clause comes first, a comma is required to separate it from the main clause, matching the original two-part meaning (project was practical / but no one acted on it)."
      }
    ]
  },
  {
    "id": "exam2",
    "title": "Exam 2",
    "subtitle": "HCMC Grade-10 Entrance · Practice Set 2",
    "durationMin": 40,
    "questions": [
      {
        "n": 1,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has the underlined part pronounced differently from the others?",
        "options": [
          "wash<u>ed</u>",
          "stopp<u>ed</u>",
          "need<u>ed</u>",
          "laugh<u>ed</u>"
        ],
        "correct": 2,
        "explanation": "🔑 Focus: the sound of the <b>-ed</b> ending.<br>Rule: after a voiceless sound (/ʃ/, /p/, /f/) the <b>-ed</b> is pronounced /t/; after /t/ or /d/ it is /ɪd/ and adds an extra syllable.<br>✗ <b>washed</b> /wɒʃt/ — ends /t/, fits the pattern, not the odd one out.<br>✗ <b>stopped</b> /stɒpt/ — ends /t/, fits the pattern, not the odd one out.<br>✗ <b>laughed</b> /lɑːft/ — ends /t/, fits the pattern, not the odd one out.<br>✓ <b>needed</b> /ˈniːdɪd/ — after the /d/ sound the -ed becomes /ɪd/, an extra syllable, so it is the odd word out.",
        "answer": "needed",
        "accept": [
          "needed",
          "c"
        ]
      },
      {
        "n": 2,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has the underlined part pronounced differently from the others?",
        "options": [
          "book<u>s</u>",
          "map<u>s</u>",
          "dog<u>s</u>",
          "cat<u>s</u>"
        ],
        "correct": 2,
        "explanation": "🔑 Focus: the sound of the final <b>-s</b>.<br>Rule: after a voiceless consonant (/k/, /p/, /t/) the plural <b>-s</b> is pronounced /s/; after a voiced sound it becomes /z/.<br>✗ <b>books</b> /bʊks/ — after /k/, the -s is /s/, not the odd one out.<br>✗ <b>maps</b> /mæps/ — after /p/, the -s is /s/, not the odd one out.<br>✗ <b>cats</b> /kæts/ — after /t/, the -s is /s/, not the odd one out.<br>✓ <b>dogs</b> /dɒɡz/ — after the voiced /ɡ/, the -s is pronounced /z/, so it differs from the others.",
        "answer": "dogs",
        "accept": [
          "dogs",
          "c"
        ]
      },
      {
        "n": 3,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has a different stress pattern from the others?",
        "options": [
          "teacher",
          "open",
          "enjoy",
          "happy"
        ],
        "correct": 2,
        "explanation": "🔑 Focus: <b>word stress</b> in two-syllable words.<br>Rule: most common two-syllable nouns and adjectives are stressed on the FIRST syllable, while many two-syllable verbs take the stress on the SECOND syllable.<br>✗ <b>TEA</b>-cher /ˈtiːtʃə/ — noun stressed on syllable 1, fits the pattern, not the odd one out.<br>✗ <b>O</b>-pen /ˈəʊpən/ — stressed on syllable 1, fits the pattern, not the odd one out.<br>✗ <b>HAP</b>-py /ˈhæpi/ — adjective stressed on syllable 1, fits the pattern, not the odd one out.<br>✓ en-<b>JOY</b> /ɪnˈdʒɔɪ/ — this verb is stressed on the SECOND syllable, breaking the pattern shared by the other three, so it is the correct answer.",
        "answer": "enjoy",
        "accept": [
          "enjoy",
          "c"
        ]
      },
      {
        "n": 4,
        "type": "mcq",
        "section": "Phonetics",
        "q": "Which word has a different stress pattern from the others?",
        "options": [
          "technology",
          "photography",
          "develop",
          "engineer"
        ],
        "correct": 3,
        "explanation": "🔑 Focus: word stress in longer words.<br>Rule: words ending in <b>-logy</b>/<b>-graphy</b> put the stress on the syllable before the ending (the antepenultimate), and here the odd word ends in <b>-eer</b>, which pulls stress to the last syllable.<br>✗ tech-<b>NO</b>-lo-gy /tekˈnɒlədʒi/ — stressed on the 2nd syllable, not the odd one out.<br>✗ pho-<b>TO</b>-gra-phy /fəˈtɒɡrəfi/ — stressed on the 2nd syllable, not the odd one out.<br>✗ de-<b>VE</b>-lop /dɪˈveləp/ — stressed on the 2nd syllable, not the odd one out.<br>✓ en-gi-<b>NEER</b> /ˌendʒɪˈnɪə/ — the suffix -eer takes the stress, so it is stressed on the LAST (3rd) syllable, making it the odd one out.",
        "answer": "engineer",
        "accept": [
          "engineer",
          "d"
        ]
      },
      {
        "n": 5,
        "type": "mcq",
        "section": "Language use",
        "q": "Where did you leave my umbrella? — Don't worry, I hung it ___ the door in the hallway.",
        "options": [
          "on",
          "in",
          "of",
          "among"
        ],
        "correct": 0,
        "explanation": "🔑 Signal: hanging something against a flat surface — \"the door\".<br>Rule: we use <b>on</b> for contact with a surface, so an umbrella hung against a door is <b>on</b> the door.<br>✗ in — used for enclosed spaces / containers (\"in the box\"), but a door isn't a container.<br>✗ of — shows possession or belonging (\"the handle of the door\"), not position.<br>✗ among — means surrounded by three or more things (\"among the trees\"); there is only one door here."
      },
      {
        "n": 6,
        "type": "mcq",
        "section": "Language use",
        "q": "Why didn't you come to the picnic yesterday? — I wanted to, ___ I had to look after my little sister.",
        "options": [
          "so",
          "but",
          "or",
          "and"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: a wish (\"I wanted to\") set against a reason it didn't happen.<br>Rule: <b>but</b> joins two contrasting ideas — the intention and the obstacle that blocked it.<br>✗ so — shows a result, but staying home wasn't the result of wanting to go.<br>✗ or — offers an alternative or a warning, not a contrast.<br>✗ and — simply adds information; it doesn't signal the contrast between wanting to go and being unable to."
      },
      {
        "n": 7,
        "type": "mcq",
        "section": "Language use",
        "q": "You look tired this morning. — Yes, I ___ my homework until midnight last night.",
        "options": [
          "do",
          "have done",
          "was doing",
          "am doing"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: \"until midnight last night\" describes an action that went on over a stretch of past time.<br>Rule: the Past Continuous <b>was doing</b> shows an activity in progress across a period in the past (up until midnight).<br>✗ do — present simple; can't describe last night.<br>✗ have done — present perfect can't be used with a finished-time marker like \"last night\".<br>✗ am doing — present continuous refers to now, not to a past night."
      },
      {
        "n": 8,
        "type": "mcq",
        "section": "Language use",
        "q": "Our school has started using solar panels on the roof. — Great! That will help save ___.",
        "options": [
          "homework",
          "electricity",
          "friendship",
          "traffic"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"solar panels\" generate power from the sun.<br>Rule: solar panels produce their own power, so the school uses less from the grid and saves <b>electricity</b>.<br>✗ homework — a school task, unrelated to solar power.<br>✗ friendship — cannot be \"saved\" by panels; it makes no sense here.<br>✗ traffic — reduced by transport measures, not by rooftop panels."
      },
      {
        "n": 9,
        "type": "mcq",
        "section": "Language use",
        "q": "What do you think of your new classmate? — She's very ___. She shares her things and helps everyone.",
        "options": [
          "lazy",
          "generous",
          "strict",
          "shy"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"She shares her things and helps everyone.\"<br>Rule: a person who freely gives and shares with others is <b>generous</b>.<br>✗ lazy — means unwilling to work; the opposite of someone who helps everyone.<br>✗ strict — means demanding strong obedience to rules; not about sharing.<br>✗ shy — means nervous with people; it doesn't describe generosity."
      },
      {
        "n": 10,
        "type": "mcq",
        "section": "Language use",
        "q": "That's the writer ___ new novel won the national prize last month.",
        "options": [
          "who",
          "which",
          "whose",
          "whom"
        ],
        "correct": 2,
        "explanation": "🔑 Signal: the blank links \"the writer\" to something belonging to that writer — \"___ new novel\".<br>Rule: to show possession in a relative clause we use <b>whose</b> (= the writer's novel).<br>✗ who — is the subject form for people (\"the writer who won\"), but here we need a possessive, not a subject.<br>✗ which — refers to things, not people, and cannot show possession before a noun like this.<br>✗ whom — is the object form for people (\"the writer whom I met\"); it can't join a noun to its owner."
      },
      {
        "n": 11,
        "type": "mcq",
        "section": "Language use",
        "q": "Before the interview, remember to ___ a good first impression on the manager.",
        "options": [
          "do",
          "make",
          "take",
          "get"
        ],
        "correct": 1,
        "explanation": "🔑 Signal: the fixed collocation with \"impression\".<br>Rule: in English we <b>make</b> an impression — \"make a good impression\" is the standard collocation.<br>✗ do — we \"do homework / do the dishes\", but not \"do an impression\" in this sense.<br>✗ take — we \"take a photo / take a break\", not \"take an impression\".<br>✗ get — we \"get a chance / get a result\", but \"get a good impression\" is not the set phrase for the person trying to impress."
      },
      {
        "n": 12,
        "type": "mcq",
        "section": "Language use",
        "q": "Waiter: Here is your soup, sir. — Customer: ___",
        "options": [
          "Never mind.",
          "Thank you very much.",
          "I'm afraid not.",
          "It doesn't matter."
        ],
        "correct": 1,
        "explanation": "🔑 Signal: a waiter serving food is doing something for the customer, so the natural response is to thank him.<br>Rule: <b>Thank you very much</b> is the polite reply when someone brings or gives you something.<br>✗ Never mind — used to tell someone not to worry about a small problem; there is no problem here.<br>✗ I'm afraid not — a polite way to say \"no\"; nothing has been asked to refuse.<br>✗ It doesn't matter — reassures someone after an apology or mistake, which doesn't fit being served soup."
      },
      {
        "n": 13,
        "type": "mcq",
        "section": "Language use",
        "q": "Would you like me to carry that heavy box for you? — ___ I can manage it myself.",
        "options": [
          "Yes, please do.",
          "That's very kind, but no.",
          "Of course you can.",
          "I'd love that."
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"I can manage it myself\" signals a polite refusal of the offer of help.<br>Rule: <b>That's very kind, but no</b> politely thanks the person yet turns the help down, matching \"I can manage it myself\".<br>✗ Yes, please do — accepts the help, contradicting \"I can manage it myself\".<br>✗ Of course you can — grants permission, which doesn't fit answering an offer of help.<br>✗ I'd love that — happily accepts, which clashes with refusing the help."
      },
      {
        "n": 14,
        "type": "mcq",
        "section": "Language use",
        "q": "What's wrong with Nam? He looks upset. — ___",
        "options": [
          "He is the tallest boy in class.",
          "He failed his driving test this morning.",
          "He enjoys playing football on Sundays.",
          "He lives near the school gate."
        ],
        "correct": 1,
        "explanation": "🔑 Signal: \"He looks upset\" asks for a reason that explains a bad or sad feeling.<br>Rule: a cause of being upset must be something negative, so <b>He failed his driving test this morning</b> logically explains the sadness.<br>✗ He is the tallest boy in class — a neutral fact, not a reason for being upset.<br>✗ He enjoys playing football on Sundays — describes a hobby he likes, the opposite of upsetting.<br>✗ He lives near the school gate — gives his location, unrelated to his mood."
      },
      {
        "n": 15,
        "type": "mcq",
        "section": "Language use",
        "q": "What does the sign mean? (A drawing of a hand holding a phone with a red line crossing it.)",
        "options": [
          "You may use your phone quietly here.",
          "Mobile phones are not allowed here.",
          "You can charge your phone here.",
          "Phone calls are free in this area."
        ],
        "correct": 1,
        "explanation": "🔑 Signal: a red line crossing the picture means \"do not\" / \"forbidden\".<br>Rule: a crossed-out phone symbol tells people that <b>mobile phones are not allowed here</b>.<br>✗ You may use your phone quietly here — a red line signals a ban, not permission.<br>✗ You can charge your phone here — the sign shows prohibition, not a charging point.<br>✗ Phone calls are free in this area — the sign is about banning phones, not about cost."
      },
      {
        "n": 16,
        "type": "mcq",
        "section": "Language use",
        "q": "What does the notice tell us? \"LIBRARY CLOSED FOR REPAIRS — Reopening on Monday, 15 March.\"",
        "options": [
          "The library will never open again.",
          "The library is open for repairs today.",
          "The library is shut now but will open again on 15 March.",
          "Readers must repair the library themselves."
        ],
        "correct": 2,
        "explanation": "🔑 Signal: \"CLOSED FOR REPAIRS\" plus \"Reopening on Monday, 15 March.\"<br>Rule: the notice says the library is temporarily shut for repair work and gives the date it will open again, so <b>the library is shut now but will open again on 15 March</b> is the accurate paraphrase.<br>✗ The library will never open again — a reopening date is given, so it is only a temporary closure.<br>✗ The library is open for repairs today — \"CLOSED\" means it is shut, not open.<br>✗ Readers must repair the library themselves — the staff are carrying out repairs; nothing asks readers to do the work."
      },
      {
        "n": 17,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (17):",
        "options": [
          "falling",
          "fell",
          "fall",
          "being fallen"
        ],
        "correct": 2,
        "answer": "fall",
        "explanation": "🔑 Signal: “has helped the price ___ dramatically” → <b>help</b> + object + <b>bare infinitive</b>.<br>Rule: after <b>help</b> + an object (here <i>the price</i>), English uses the bare infinitive <b>fall</b>: “new technology has helped the price <b>fall</b>” = caused/enabled the price to drop. (The <i>to</i>-infinitive is also grammatical after <i>help</i>, but no <i>to fall</i> option is offered here, so the answer is unambiguous.)<br>✗ <b>falling</b> — a gerund/present participle; <b>help</b> + object is not followed by an -ing form.<br>✗ <b>fell</b> — a past-tense finite verb; you cannot put a tensed verb after <b>help + object</b>, which requires an infinitive.<br>✗ <b>being fallen</b> — a passive/participial form; <i>fall</i> is intransitive and has no passive, so this is doubly wrong.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 18,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (18):",
        "options": [
          "cheap",
          "cheaper",
          "cheapest",
          "as cheap"
        ],
        "correct": 1,
        "answer": "cheaper",
        "explanation": "🔑 Signal: the word “<b>than</b>” later in the clause (“…often ___ <b>than</b> burning coal or gas”).<br>Rule: <b>than</b> is the marker of a <b>comparative</b> structure, so the adjective must be in its comparative form. The comparative of the one-syllable adjective <i>cheap</i> is <b>cheaper</b>: “generating electricity from sunlight is often <b>cheaper than</b> burning coal or gas.”<br>✗ <b>cheap</b> — the base (positive) form cannot be used before <b>than</b>; “cheap than” is ungrammatical.<br>✗ <b>cheapest</b> — a superlative; superlatives take <i>the</i> and do not combine with <b>than</b> in this way.<br>✗ <b>as cheap</b> — belongs to the <i>as … as</i> equality pattern, which needs a second <b>as</b>, not <b>than</b>.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 19,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (19):",
        "options": [
          "Because",
          "Although",
          "Unless",
          "So"
        ],
        "correct": 1,
        "answer": "Although",
        "explanation": "🔑 Signal: a contrast between a problem (“the sun does not shine at night”) and a solution (“engineers have developed powerful batteries”).<br>Rule: a concessive conjunction is needed to link an unfavourable fact with an unexpected positive result. <b>Although</b> = “even though / despite the fact that”, correctly signalling that the night-time problem is overcome: <b>Although</b> the sun does not shine at night, batteries store energy.<br>✗ <b>Because</b> — gives a cause/reason, but the second clause is a solution, not a consequence of darkness.<br>✗ <b>Unless</b> — means “if … not / except if”, introducing a condition, which distorts the meaning.<br>✗ <b>So</b> — expresses result and cannot begin this subordinate clause; “So the sun does not shine…, engineers…” makes no logical sense.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 20,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (20):",
        "options": [
          "habit",
          "interest",
          "dependence",
          "attention"
        ],
        "correct": 2,
        "answer": "dependence",
        "explanation": "🔑 Signal: “reduce their ___ <b>on</b> the national grid” — a noun that collocates with <b>on</b> and means “reliance”.<br>Rule: the fixed collocation is <b>dependence on</b> something = the state of relying on it. Reducing your <b>dependence</b> on the grid means relying on it less, which fits families producing their own solar power.<br>✗ <b>habit</b> — collocates with <i>of (doing)</i>, not <i>on the grid</i>; a “habit on the national grid” is meaningless.<br>✗ <b>interest</b> — “interest in” (a topic) or “interest on” (a loan); neither sense means reliance on the grid.<br>✗ <b>attention</b> — “pay attention to”; it concerns focus, not the reliance meaning required here.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 21,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (21):",
        "options": [
          "on",
          "in",
          "at",
          "from"
        ],
        "correct": 0,
        "answer": "on",
        "explanation": "🔑 Signal: the verb + preposition collocation “<b>depend on</b>”.<br>Rule: the verb <b>depend</b> is always followed by <b>on</b> (or <i>upon</i>) when naming what something relies on: “solar energy still depends heavily <b>on</b> the weather.” This is a fixed pattern, not a preposition chosen for literal meaning.<br>✗ <b>in</b> — used for location/time (<i>in the room</i>, <i>in May</i>), never with <b>depend</b>.<br>✗ <b>at</b> — used for points/places (<i>at school</i>); “depend at” is not English.<br>✗ <b>from</b> — signals origin/source (<i>come from</i>); it does not pair with <b>depend</b>.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 22,
        "type": "mcq",
        "section": "Cloze",
        "q": "Blank (22):",
        "options": [
          "Therefore",
          "However",
          "Moreover",
          "Otherwise"
        ],
        "correct": 1,
        "answer": "However",
        "explanation": "🔑 Signal: a contrast between a drawback (“cloudy regions produce far less power”) and an optimistic outlook (“solar power will play a central role”).<br>Rule: a contrasting connecting adverb is needed to move from the limitation to the positive prediction. <b>However</b> = “but / in spite of that”, correctly introducing the hopeful conclusion despite the weather problem.<br>✗ <b>Therefore</b> — shows result/consequence, but the next idea contrasts with the previous one rather than following from it.<br>✗ <b>Moreover</b> — adds a further similar point; here the ideas are opposed, not added.<br>✗ <b>Otherwise</b> — means “if not / or else”, introducing an alternative condition, which does not fit the contrast.",
        "passage": "Solar power has quickly become one of the most promising sources of clean energy in the world. In the past, installing solar panels was expensive, but new technology has helped the price <b>(17)&nbsp;___</b> dramatically over the last decade. Today, generating electricity from sunlight is often <b>(18)&nbsp;___</b> than burning coal or gas, which makes it attractive to both households and governments. <b>(19)&nbsp;___</b> the sun does not shine at night, engineers have developed powerful batteries that store energy for later use. Rooftop panels also allow families to reduce their <b>(20)&nbsp;___</b> on the national grid and even sell extra electricity back to power companies. Of course, solar energy still depends heavily <b>(21)&nbsp;___</b> the weather, and cloudy regions produce far less power than sunny ones. <b>(22)&nbsp;___</b>, as costs continue to drop and storage improves, many experts believe that solar power will play a central role in the fight against climate change."
      },
      {
        "n": 23,
        "type": "tf",
        "section": "Reading",
        "q": "True or False: Maria first noticed the seahorses were disappearing when she was sixteen years old.",
        "options": [
          "True",
          "False"
        ],
        "correct": 0,
        "explanation": "🔑 Focus: the opening sentence gives Maria's age at the moment she noticed the problem.<br>Rule: for True/False reading questions, match the statement against the precise fact stated in the passage rather than a rough estimate.<br>The passage begins: “When Maria Santos was only <b>sixteen</b>, she <b>noticed that the seahorses</b> near her village... <b>were disappearing</b>.” This directly confirms she first noticed the problem at sixteen, so the statement is <b>True</b>.<br>✗ False — would only be correct if the text gave a different age or said she noticed it later; it does not, so this contradicts the passage.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 24,
        "type": "tf",
        "section": "Reading",
        "q": "True or False: The seahorses disappeared only because of pollution from the town.",
        "options": [
          "True",
          "False"
        ],
        "correct": 1,
        "explanation": "🔑 Focus: the word “<b>only</b>” and the two causes given in the passage.<br>Rule: a statement with “only” is False if the passage names more than one cause.<br>The text lists <b>two</b> reasons: “<b>Fishermen had been catching them</b> to sell as souvenirs, <b>and pollution</b> from the town had killed much of the seagrass.” Because catching by fishermen was also a cause, pollution was <b>not the only</b> reason, so the statement is <b>False</b>.<br>✗ True — this ignores the fishermen, whom the passage clearly names as a separate cause, so it misreads the text.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 25,
        "type": "tf",
        "section": "Reading",
        "q": "True or False: Maria trained twelve villagers to help protect the bay.",
        "options": [
          "True",
          "False"
        ],
        "correct": 0,
        "explanation": "🔑 Focus: the exact number of villagers Maria trained.<br>Rule: check the number word in the statement against the number word in the passage.<br>The passage states: “She also <b>trained twelve villagers</b> to guard the zone and to replant seagrass by hand.” The statement repeats this detail exactly, so it is <b>True</b>.<br>✗ False — would only be correct if the passage gave a different number or said she worked alone; instead it clearly says twelve villagers were trained.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 26,
        "type": "tf",
        "section": "Reading",
        "q": "True or False: After the project, the number of seahorses in Blue Bay fell below forty.",
        "options": [
          "True",
          "False"
        ],
        "correct": 1,
        "explanation": "🔑 Focus: the direction of change — the passage says the number went <b>up</b>, not down.<br>Rule: compare the movement (rise/fall) stated in the passage with the movement claimed in the statement.<br>The text says: “the number of seahorses... had <b>risen from about forty to more than six hundred</b>.” The population <b>increased</b> greatly, so the claim that it “fell below forty” is the opposite of the truth, making the statement <b>False</b>.<br>✗ True — would require the passage to describe a decline; instead it reports a dramatic rise from forty to over six hundred.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 27,
        "type": "mcq",
        "section": "Reading",
        "q": "What is the best title for the passage?",
        "options": [
          "The Dangers of Ocean Pollution",
          "A Teenager Who Rescued a Species",
          "How to Become a Marine Biologist",
          "Diving Holidays in the Philippines"
        ],
        "correct": 1,
        "explanation": "🔑 Focus: a title must cover the <b>whole</b> passage, not one detail.<br>The passage tells the story of a young girl who noticed the seahorses vanishing and, through her own effort, brought them back — so <b>A Teenager Who Rescued a Species</b> captures the main idea best.<br>✗ <b>The Dangers of Ocean Pollution</b> — pollution is only one cause mentioned briefly; the passage is about the rescue, not about pollution in general.<br>✗ <b>How to Become a Marine Biologist</b> — Maria becoming a biologist is a single closing detail, not the subject of the passage; the text gives no advice on training for that career.<br>✗ <b>Diving Holidays in the Philippines</b> — diving tourists appear in only one sentence as a result of the project; the passage is not a travel guide.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 28,
        "type": "mcq",
        "section": "Reading",
        "q": "In the last paragraph, the word \"remarkable\" is closest in meaning to ___.",
        "options": [
          "ordinary",
          "impressive",
          "expensive",
          "temporary"
        ],
        "correct": 1,
        "explanation": "🔑 Focus: vocabulary-in-context — read the sentence around “remarkable.”<br>Rule: use the surrounding evidence to decide the meaning. The passage says “The results were <b>remarkable</b>. Within four years, the number of seahorses... had risen from about forty to more than six hundred.” A rise this large is striking and admirable, so <b>remarkable</b> here means <b>impressive</b>.<br>✗ <b>ordinary</b> — this is the opposite; a roughly fifteen-fold rise is anything but ordinary, and the passage highlights it as special.<br>✗ <b>expensive</b> — “remarkable” describes the results, not their cost; nothing says the outcome cost a lot of money.<br>✗ <b>temporary</b> — the passage shows a lasting recovery over four years, not a short-lived one, so “temporary” does not fit.",
        "passage": "<b>Saving the Seahorses of Blue Bay</b><br><br>When Maria Santos was only sixteen, she noticed that the seahorses near her village in the Philippines were disappearing. Every summer she used to see dozens of them clinging to the seagrass in the shallow water of Blue Bay. But by the time she finished high school, she could hardly find a single one. Fishermen had been catching them to sell as souvenirs, and pollution from the town had killed much of the seagrass they lived in.<br><br>Instead of giving up, Maria decided to act. She spent two years studying the bay, counting the remaining seahorses and mapping the healthiest patches of seagrass. Then she persuaded the local council to mark a small area of the bay as a protected zone where fishing was banned. She also trained twelve villagers to guard the zone and to replant seagrass by hand.<br><br>The results were remarkable. Within four years, the number of seahorses in Blue Bay had risen from about forty to more than six hundred. Tourists now pay to dive there, which brings money to the village. Maria, who is now a marine biologist, says the project proves that ordinary people, not only governments, can rescue a threatened species."
      },
      {
        "n": 29,
        "type": "text",
        "section": "Word form",
        "q": "Living in a big city can be very ___ (STRESS) for people who prefer a quiet life.",
        "accept": [
          "stressful"
        ],
        "answer": "stressful",
        "explanation": "🔑 Signal: “can be very ___” — after the linking verb <b>“can be”</b> and the intensifier <b>“very”</b>, the blank describes the subject (“living in a big city”), so it must be an <b>adjective</b>.<br><b>Rule:</b> BE + (very) + ___ = adjective slot. The root word <b>STRESS</b> is a noun (“mental pressure”); adding the suffix <b>-ful</b> (“full of”) turns it into the adjective <b>stressful</b> (“causing stress”).<br>Model answer: “can be very <strong>stressful</strong>” = able to cause a lot of pressure or worry.<br>Derivation: STRESS (noun) + <b>-ful</b> → STRESSFUL (adjective), correctly filling the adjective slot after “be very”."
      },
      {
        "n": 30,
        "type": "text",
        "section": "Word form",
        "q": "The volunteers are dedicated to ___ (PROTECT) endangered animals in the national park.",
        "accept": [
          "protecting"
        ],
        "answer": "protecting",
        "explanation": "🔑 Signal: “be dedicated to” + <b>V-ing</b>.<br><b>Rule:</b> in the fixed phrase <b>“be dedicated to”</b>, “to” is a preposition, so the verb after it must take the gerund <b>-ing</b> form, not the bare infinitive.<br>Model answer: “are dedicated to <strong>protecting</strong>” = are committed to the work of protecting them.<br>Derivation: PROTECT (verb) + <b>-ing</b> → PROTECTING (gerund) after the preposition “to”."
      },
      {
        "n": 31,
        "type": "text",
        "section": "Word form",
        "q": "Our new manager is always ___ (HELP) when the staff run into problems at work.",
        "accept": [
          "helpful"
        ],
        "answer": "helpful",
        "explanation": "🔑 Signal: “is always ___” — an adjective after the linking verb “is” (with the adverb of frequency “always” in between).<br><b>Rule:</b> BE + ___ = adjective slot describing the subject “manager”. The root <b>HELP</b> is a verb/noun; the suffix <b>-ful</b> forms the adjective <b>helpful</b> (“giving useful help”).<br>Model answer: “is always <strong>helpful</strong>” = is always ready and willing to help.<br>Derivation: HELP + <b>-ful</b> → HELPFUL (adjective)."
      },
      {
        "n": 32,
        "type": "text",
        "section": "Word form",
        "q": "The government has announced a new ___ (DECIDE) about the school holiday schedule.",
        "accept": [
          "decision"
        ],
        "answer": "decision",
        "explanation": "🔑 Signal: “a new ___ about” — the blank follows the article/adjective pair “a new” and is the object of “announced”, so it must be a <b>noun</b>.<br><b>Rule:</b> ARTICLE + ADJECTIVE + ___ = noun slot. Many verbs form their result-noun with the suffix <b>-sion/-ion</b> (decide → deci<b>sion</b>, discuss → discus<b>sion</b>).<br>Model answer: “a new <strong>decision</strong>” = a choice that has been made.<br>Derivation: DECIDE (verb, “to make a choice”) → drop <b>-de</b> and add <b>-sion</b> → DECISION (noun), filling the noun slot after “a new”."
      },
      {
        "n": 33,
        "type": "text",
        "section": "Word form",
        "q": "The children behaved so ___ (POLITE) that the teacher praised them in front of the whole class.",
        "accept": [
          "politely"
        ],
        "answer": "politely",
        "explanation": "🔑 Signal: “behaved so ___” — the blank modifies the verb <b>“behaved”</b>, describing HOW the children acted, so it must be an <b>adverb</b>.<br><b>Rule:</b> VERB + (so) + ___ = adverb slot. Form the adverb from the adjective <b>POLITE</b> by adding <b>-ly</b> → <b>politely</b> (“in a well-mannered way”).<br>Model answer: “behaved so <strong>politely</strong>” = acted in a very well-mannered way.<br>Derivation: POLITE (adjective) + <b>-ly</b> → POLITELY (adverb), correctly describing the verb “behaved” rather than a noun."
      },
      {
        "n": 34,
        "type": "text",
        "section": "Word form",
        "q": "During the flood, several brave ___ (FIGHT) rescued families trapped on their rooftops.",
        "accept": [
          "fighters"
        ],
        "answer": "fighters",
        "explanation": "🔑 Signal: <b>“several brave ___ rescued”</b> — “several” quantifies a countable noun, and that noun is the plural subject performing the past-tense action “rescued”, so a <b>plural person-noun (agent)</b> is required.<br><b>Rule:</b> the verb <b>fight</b> takes the agent suffix <b>-er</b> to name “a person who fights” → <b>fighter</b>; “several” signals plurality, so add <b>-s</b> → <strong>fighters</strong>. (Here it means rescuers battling the flood.)<br>Model answer: “several brave <strong>fighters</strong> rescued families” = several courageous people who fight/rescue.<br>Derivation: fight (verb) → fighter (noun, agent) → fighters (plural noun, subject of “rescued”)."
      },
      {
        "n": 35,
        "type": "text",
        "section": "Word bank",
        "q": "They spent too much on the holiday, so by the end of the trip they had completely ___ and had to borrow from a friend.",
        "accept": [
          "run out of money",
          "ran out of money",
          "run out of money.",
          "run out"
        ],
        "answer": "run out of money",
        "explanation": "🔑 Signal: <b>\"by the end of the trip they had completely ___ and had to borrow\"</b> — the past-perfect frame <b>\"had ___\"</b> plus the result <b>\"had to borrow\"</b> shows they had none left, and only <b>run out of money</b> is the phrasal verb that fits after \"had\" and carries the built-in preposition pattern <b>run out <u>of</u> (something)</b>.<br>Rule: <b>run out of money</b> means \"to use up all of your money so that none is left\"; the past participle \"run\" combines with \"had\" to form the past perfect, matching \"they had completely run out of money\".<br>Model answer: they had completely <strong>run out of money</strong> and had to borrow from a friend.<br>Derivation: run (base) → run (past participle) after \"had\", keeping the fixed collocation \"run out of + noun\".<br>✗ save money — the opposite meaning; if they had saved money they would not need to borrow.<br>✗ make money — means \"to earn money\", which contradicts spending too much and then borrowing.<br>✗ waste money — grammatically possible but wrong in meaning: it stresses spending foolishly, not having zero money left, and \"had wasted money and had to borrow\" does not explain that nothing remained.<br>✗ spend money wisely — means the exact opposite of overspending on a holiday, so it clashes with \"spent too much\".",
        "bank": [
          "save money",
          "waste money",
          "make money",
          "run out of money",
          "spend money wisely"
        ]
      },
      {
        "n": 36,
        "type": "text",
        "section": "Word bank",
        "q": "Instead of buying things you don't really need, you should learn to ___ so that your budget lasts the whole month.",
        "accept": [
          "spend money wisely",
          "spend money wisely.",
          "spend wisely"
        ],
        "answer": "spend money wisely",
        "explanation": "🔑 Signal: <b>\"Instead of buying things you don't really need … so that your budget lasts the whole month\"</b> — the contrast with careless buying and the goal of making a budget last point to spending in a smart, careful way, which is exactly <b>spend money wisely</b>.<br>Rule: the adverb <b>wisely</b> modifies the verb <b>spend</b> to mean \"use your money in a sensible, well-planned way\"; \"learn to\" is followed by the base form <b>spend</b>, so the phrase fits grammatically as \"learn to spend money wisely\".<br>Model answer: you should learn to <strong>spend money wisely</strong> so that your budget lasts the whole month.<br>Derivation: spend (base verb after \"to\") + money (object) + wisely (manner adverb) → the fixed collocation for careful spending.<br>✗ waste money — the opposite of the intended meaning; wasting money would make the budget run out, not last.<br>✗ run out of money — a result (having none left), not something you \"learn to\" do on purpose, so it makes no sense after \"learn to\".<br>✗ make money — means \"to earn\", but the sentence is about how to use money you already have, not how to earn it.<br>✗ save money — close in spirit, but the clue \"Instead of buying things\" plus \"so that your budget lasts\" is about how you spend, and only \"spend money wisely\" directly contrasts with the careless \"buying things you don't really need\".",
        "bank": [
          "save money",
          "waste money",
          "make money",
          "run out of money",
          "spend money wisely"
        ]
      },
      {
        "n": 37,
        "type": "text",
        "section": "Rewrite",
        "q": "When he was a boy, Martin played the violin every weekend, but he doesn't anymore.\n→ Martin used ___",
        "accept": [
          "to play the violin every weekend",
          "to play the violin every weekend when he was a boy"
        ],
        "answer": "to play the violin every weekend",
        "explanation": "🔑 Signal: A discontinued <b>past habit</b> (“when he was a boy… but he doesn't anymore”) is rewritten with <b>used to</b>.<br><b>Rule:</b> <b>“used to + bare infinitive”</b> describes something that was true or repeated in the past but is no longer the case now. The stem already supplies “Martin used”, so it must be completed with the to-infinitive of the past action.<br>Model answer: Martin used <strong>to play the violin every weekend</strong>.<br>Derivation: “played… every weekend, but not anymore” (repeated past action, now stopped) → “used <u>to play</u>… every weekend”. The adverbial “every weekend” carries over unchanged.<br>Note: after “used” you need the <b>to-infinitive</b> (to play), never “used playing” or “used to played” — the base verb follows “to”."
      },
      {
        "n": 38,
        "type": "text",
        "section": "Rewrite",
        "q": "\"I will call you tomorrow,\" Sophie said to me.\n→ Sophie told me that she ___",
        "accept": [
          "would call me the next day",
          "would call me the following day"
        ],
        "answer": "would call me the next day",
        "explanation": "🔑 Signal: Direct speech → <b>reported (indirect) speech</b> after the reporting verb <b>told</b> in the past.<br><b>Rule:</b> When the reporting verb is in the past (“told”), the tense <b>backshifts</b>: <b>will → would</b>. Pronouns shift to the speaker's viewpoint (<b>you → me</b>, I → she), and the time word must shift too: <b>tomorrow → the next day / the following day</b>.<br>Model answer: Sophie told me that she <strong>would call me the next day</strong>.<br>Derivation: “I <u>will</u> call <u>you</u> <u>tomorrow</u>” → “she <u>would</u> call <u>me</u> <u>the next day</u>”. Note “told” takes an object (me) directly, unlike “said”.<br>Caution: leaving “tomorrow” unchanged (“would call me tomorrow”) is incorrect in full backshifted reported speech, so the time reference must become “the next/following day”."
      },
      {
        "n": 39,
        "type": "text",
        "section": "Rewrite",
        "q": "The soup was so spicy that nobody could finish it.\n→ It was such ___",
        "accept": [
          "a spicy soup that nobody could finish it"
        ],
        "answer": "a spicy soup that nobody could finish it",
        "explanation": "🔑 Signal: Rewriting <b>“so + adjective + that”</b> as <b>“such + a/an + adjective + noun + that”</b>.<br><b>Rule:</b> <b>so</b> is followed by an <b>adjective/adverb alone</b> (so spicy), whereas <b>such</b> is followed by a <b>noun phrase</b> — article + adjective + noun (such a spicy soup). Here “soup” refers to one countable serving/dish, so the article <b>a</b> is required (“such spicy soup”, dropping the article, is ungrammatical for a singular countable noun). The result clause “that nobody could finish it” carries over unchanged.<br>Model answer: It was such <strong>a spicy soup that nobody could finish it</strong>.<br>Derivation: “so spicy that…” (adjective) → “such a spicy soup that…” (article + adjective + noun). Meaning is identical: the extreme spiciness caused the result."
      },
      {
        "n": 40,
        "type": "text",
        "section": "Rewrite",
        "q": "Although Daniel felt very tired, he kept working until midnight.\n→ Despite ___",
        "accept": [
          "feeling very tired, he kept working until midnight",
          "his tiredness, he kept working until midnight"
        ],
        "answer": "feeling very tired, he kept working until midnight",
        "explanation": "🔑 Signal: “<b>Although</b> + clause” must be converted into “<b>Despite</b> + noun / noun phrase / V-ing”.<br><b>Rule:</b> Although/Though are conjunctions taking a <b>full clause</b> (subject + verb: “Daniel felt very tired”), while Despite/In spite of are prepositions taking a <b>noun, noun phrase, or gerund (V-ing)</b>. So the clause “Daniel felt very tired” becomes the gerund phrase <b>feeling very tired</b> (or the noun phrase <b>his tiredness</b>). The main clause “he kept working until midnight” must be carried over unchanged, joined by a comma.<br>Model answer: Despite <strong>feeling very tired, he kept working until midnight</strong>.<br>Derivation: “Daniel felt very tired” (clause) → “feeling very tired” (V-ing) / “his tiredness” (noun phrase). Never write “Despite he felt tired” — a preposition cannot be followed by a subject + finite verb."
      }
    ]
  }
];

function getExam(examId) {
    return EXAMS.find(e => e.id === examId) || null;
}
