// Essays data extracted from admission essay collection
// Difficulty levels: 1=Beginner, 2=Intermediate, 3=Advanced
const essayLevels = [
    {
        id: 'beginner',
        title: 'Beginner',
        subtitle: 'Simple words, short sentences, everyday topics',
        icon: '🌱',
        color: '#26A69A'
    },
    {
        id: 'intermediate',
        title: 'Intermediate',
        subtitle: 'Richer vocabulary, longer sentences, personal narratives',
        icon: '🌿',
        color: '#FF7043'
    },
    {
        id: 'advanced',
        title: 'Advanced',
        subtitle: 'Academic vocabulary, complex structures, technical topics',
        icon: '🌳',
        color: '#7E57C2'
    }
];

const essays = [
    // === COMMON APP PERSONAL STATEMENTS ===
    {
        id: 1,
        category: 'common-app',
        level: 'beginner',
        title: 'Hello, Future',
        author: 'Heqing "Amy" Zhang',
        school: 'Hamilton College',
        tags: ['Resilience', 'Writing', 'Bookending'],
        content: `On the day my first novel was rejected, I was baking pies. Or rather, I was gathering the necessary stamina for our church's annual pie sale. Ten hours of rolling crusts and peeling apples and kneading butter and sugar into the crumble topping, all the while drowning in the cinnamon air, surrounded by near-literal mountains of pies that we were forbidden to touch. (It was, I think, our pastor's method of drilling the meaning of temptation into heads — he always preached about Eden the following Sunday.)

I sat on my couch and counted the minutes until the agony of pie-making, (almost) forgetting the novel that was currently with the acquisitions board of one of the biggest publishing houses in the world. To be fair, I hadn't known that the acquisitions meeting would be held that day. I did know that two — two! — senior editors wanted to make all of my impossible dreams come true. I knew that the marketing and sales people had already looked over my manuscript — something that usually happened post-contract. I knew the meeting had been pushed back twice already by an unsympathetic hurricane that had left downtown Manhattan under several feet of water. I knew this was it. This had to be it. It was my turn.

I had slogged through the query trenches in search of an agent. I had collected enough rejection letters to wallpaper my room. I had found an agent who hadn't run away when I finally told her that I was 15, who loved my story almost as much as I did, who submitted it and lured two — two! — senior editors to take a risk on it.

Hello, future? I'm ready for my happily ever after. Love, Amy.

Phone call from my agent. Sweaty palms and dizziness, a tap of a shaking finger to a smudged screen. Small talk and stalling. A sigh and, at last, the news, that the publisher had a similar novel on her list and vetoed the editors. That there was no heat in the flooded building and they had rejected everything and had gone home early. Stomach in throat, swallow. False laugh, assurances of next time. End call. Tears.

Hello, Amy? Sucks, doesn't it? Love, the future.

It sucked so monumentally that I bought a pie and ate it in one sitting. It'll be okay. It'll be okay. I fell asleep like that: okay, okay, okay, and I almost believed it. After all, the next day was the beginning of National Novel Writing Month. I had an outline and a story to tell: one of imaginary friends, Newton's Laws of Motion, a car out of control, a crash into a tree.

Okay, okay, okay. A ringing in the ungodly hours of morning. Phone call from a friend. Bleary eyes and words still spinning: okay, okay, okay. A mumbled what the heck? in place of a greeting, another hurricane in the answer. A classmate, a car out of control, a crash into a tree.

We used to have gym together, I didn't know him too well, and I never would. Those were the facts — no opinions, no emotions I could translate into ink on a page, touch, understand. The words were gone. I sat at my computer with my fingers on the keys, shaking, sweating, smudging, but there was nothing to say.

Everyone went to the memorial service and everyone brought flowers, and in the silence, we cried. And there was anger, too, later — a bursting, a hush that imploded. I went home after the service and threw my laptop open and wrote about all that was unfair, and there was a lot to write about. The month passed, and I won NaNoWriMo. I revised the novel and sent it to my agent who began the submission process once again.

It sold in three days.

Hello, future? I'm not afraid. Love, Amy.`
    },
    {
        id: 2,
        category: 'common-app',
        level: 'beginner',
        title: 'Seven Feet Tall',
        author: 'Alexander Wear',
        school: 'Hamilton College',
        tags: ['Identity', 'Montage', 'Self-acceptance'],
        content: `Walking down a busy street, I see the quick glances and turned heads. The murmurs and giggles trickle toward me. I try to ignore the buzz, interspersed with, "Oh my God!" and the occasional, "Damn!" Then, a complete stranger asks for a picture, so I stand with people foreign to me and politely smile and laugh. After the click of the camera, they go on their way. Sometimes I wish I weren't so tall. Maybe then I could take a friend to a movie and just blend into the crowd.

Attention from strangers is nothing new to me. Questions about my height dominate almost every public interaction. My friends say my height is just a physical quality and not a personality trait. However, when I reflect on my life, I realize that my height has shaped my character in many ways and has helped to define the person I am.

I learned how to be comfortable in my own skin. If I had the introverted personality my older brother had in high school, I'd probably be overwhelmed by the constant public attention. Even as a young child, parents at the sidelines of my baseball games, as well as the umpire, would, in front of all my teammates, demand by birth certificate to prove my age. I grew acquainted early on with the fact that I am abnormally tall and stick out about the crowd. It's just the way it is. Being self-conscious about it would be paralyzing.

I learned how to be kind. When I was younger, some parents in my neighborhood deemed me a bully because I was so much larger than children my age. I had to be extra welcoming and gentle simply to play with other children. Of course, now my coaches wish I weren't quite so kind on the basketball court.

I learned humility. At 7 feet tall, everyone expects me to be an amazing basketball player. They come expecting to see Dirk Nowitzki, and instead they might see a performance more like Will Ferrell in Semi-Pro. I have learned to be humble and to work even harder than my peers to meet their (and my) expectations.

I developed a sense of lightheartedness. When people playfully make fun of my height, I laugh at myself too. On my first day of high school, a girl dropped her books in a busy hallway. I crouched down to her level and gathered some of her notebooks. As we both stood up, her eyes widened as I kept rising over her. Dumbfounded, she dropped her books again. Embarrassed, we both laughed and picked up the books a second time.

All of these lessons have defined me. People unfamiliar to me have always wanted to engage me in lengthy conversations, so I have had to become comfortable interacting with all kinds of people. Looking back, I realize that through years of such encounters, I have become a confident, articulate person. Being a 7-footer is both a blessing and a curse, but in the end, accepting who you are is the first step to happiness.`
    },
    {
        id: 3,
        category: 'common-app',
        level: 'beginner',
        title: 'The Shoelace',
        author: 'Tara Cicic',
        school: 'Hamilton College',
        tags: ['Cultural Identity', 'Heritage', 'Reflection'],
        content: `I am here because my great-grandfather tied his shoelace. It was World War I, and he was a Montenegrin fighting in the American army in France. His fellow soldiers surged across the field, but he paused for the briefest of moments because his laces had come undone. Those ahead of him were blown to bits. Years later, as Montenegro was facing a civil war, the communists came to his home. His village was small, and he knew the men who knocked on his door. But this familiarity meant nothing, for when they saw him they thought of the word America, stamped across a land where the poor were stripped of their rights and where the fierce and volatile Balkan temper would not do.

As his neighbors ransacked his home, his wife had thrust his good pair of shoes at him. "Take them," she had urged. "Wear them." But he did not, for he knew that he could not run. I also cannot run, but I wear my new shoes with great ease and comfort. I wear the secret guilt, the belief in equality, the obsession with culture, and the worship of rational thinking and education that becomes the certain kind of American that I am. None of these things are costumes. I believe in and feel them all sincerely, but they are not who I am. They may be a part, but I can say with certainty that they are not all.

I was born in Belgrade and Serbian was my first language, but these things seem nearly inconsequential when compared to the number of years that I've spent in America and the fact that English is by far my superior tongue. We visit every two or three years or so. Everybody is there, my entire collection of cousins and aunts and grandparents neatly totted up in a scattering of villages and cities, arms open with the promise of a few sneaky sips of rakia and bites of kajmak. I love them, I truly do. I love the flat roof on my grandparents' home, the familiar sounds of the cicadas, the cows that they had when I was 7, and even the goats that I have not met yet. But they are not me, those things. They are something else.

Take a few bounds away from my immediate family, and I do not know anyone's names. Somebody is always falling ill, or drinking too much, or making trouble for themselves. We speak of them sometimes, or pity them, but we do not go to their weddings or funerals. And yet I feel worried, not for them, but for myself. The Serbs and Montenegrins are people of complicated histories, and as I watch the documentaries my father made during the civil war there, I am gripped with fear and fascination. Those strange people can be so hateful. They cry and beat their hearts at the thought of Serbian loss in the Battle of Kosovo in 1389. This kind of nationalism makes me cringe. I do not want to be that way. But is there not something beautiful in that kind of passion and emotion? What does it say of me that I sometimes cannot help but romanticize something I know to be destructive and oppressive? This is why I worry.

They are not me, I tell myself, and I am right. But can they not be just a part? Can they not be a tiny sliver, or maybe even a sizeable chunk, comparable even to the American in me? Must I relegate them to nothing at all? For if those shoes, the ones my grandfather bent to tie in the middle of that blazing battlefield in France, are not mine, then why do I think of them so often?`
    },
    // === SUPPLEMENTAL ESSAYS ===
    {
        id: 4,
        category: 'supplemental',
        level: 'beginner',
        title: 'The Bus Stop',
        author: 'Nathaniel Colburn',
        school: 'Hamilton College',
        tags: ['Empathy', 'Perspective', 'Growth'],
        content: `Keeping my head down and avoiding eye contact, I tried not to attract attention. Drunken shrieks and moans reverberated through the darkening light of the bus stop, while silhouettes and shadows danced about. My heart pounding, I hoped I would survive the next 40 minutes. I had never seen the homeless at the stop act so deranged. But I had never been there so late.

It was well past sundown. A man passed out on the next bench awoke only to shout and drink. One screamed racial slurs and curses at another while they both staggered around. Another lacked an arm and had the most baleful gaze I had ever seen. As much as I tried to empathize and feel compassion, I couldn't stymie a feeling of terror and revulsion.

After a few long minutes, a shadow detached itself from the opposite benches, came over and sat down next to me. Squinting, I took in her kind, wrinkled face. Ah, thank god, a kindred soul enduring the same thing. "Missed the bus?" she asked. "Y-yeah," I mumbled. "You certainly chose the wrong time to do that. Where're you headed?" Her voice was scratchy, like a smoker's, but she spoke well. "Home." "Ah, homes. When I was a bit older than you, my home was a car. Can you believe that my car, an old Toyota, got 50 miles to the gallon? I could drive from here to San Francisco in one sitting."

No, I couldn't. The more we talked, the more I enjoyed her company and forgot about the craziness around me. She grew up in San Francisco and loved to travel. She loved helping people and went to church. Before I could learn more, a homeless man staggered up to me and asked me for money. I was so uncomfortable I relented.

My friend turned to me and advised, "Don't ever give a homeless person money. Give them food. The stereotype is true — they buy drugs and alcohol. Look around you." Stunned and feeling naïve, I promised to do so. We talked more until my stomach rumbled and I remarked that I hadn't eaten since lunch. Just then a bus arrived — apparently hers. She procured two hardboiled eggs from her pocket and offered them to me. I politely declined, and she went to get her stuff. But wait, why was she carrying eggs in her pocket? When the woman emerged from the other side of the stop, she boarded the bus with a sleeping bag and backpack. She was homeless! She smiled down at me, the bus left, and I sat there in quiet shock.

I explored the stop anew. Drugs, alcohol, missing limbs were no longer terrifying. Now, I saw the symptoms of sickness, a sad lifestyle that did no harm except to those who lived it.

The homeless lady probably has no idea what an effect she had on me. Because of her, I swore to look through the top layers of every situation. Now that I have a car, I never go to the bus stop, but I know its lesson, at least, will continue to take me places. I hope my expanded empathy and open-mindedness will allow me to feel at home in any foreign situation and connect with all people. Next time I might even accept a hardboiled egg straight out of a stranger's coat pocket.`
    },
    {
        id: 5,
        category: 'supplemental',
        level: 'beginner',
        title: 'Tunnel Vision',
        author: 'Joe Pucci',
        school: 'Hamilton College',
        tags: ['Courage', 'Regret', 'Seize the moment'],
        content: `Attempting to juke people like an NFL running back, I slithered my way through the tunnel to the A-Train on 42nd Street during rush hour. I often try to block out the hectic surroundings by isolating myself in music, but I can never seem to get out of the real life time-lapse. In photography, a time-lapse is a technique at which the frame rate is lower than that used to view the sequence, thus, when the sequence is played at normal speed, it gives the effect that time is moving faster, or lapsing. In a Manhattan subway tunnel, a real life time-lapse gives the illusion that thousands are moving around you in one single moment. Luckily, that afternoon, the frame rate was higher than the actual visual sequence.

The crowd shoved their way toward the platform as the screeching train echoed through the underpass. The doors opened and I pushed my way toward the already full train. After five seconds, I began to worry, fearing that the door would close and I would be stuck longer in the blistering, underground cave. The tall, brunette girl in front of me inched her way over the gap between the rusted train and the yellow platform, but one misstep turned my time-lapse upside down.

In slow motion, one vertebra at a time, she fell through the gap toward the tracks as the train doors closed. I slipped my hands out of my skinny jeans and reached under her arms as her head neared the platform. I hoisted her up and the sensor doors reopened as we entered the train. I threw my headphones around my shoulders, clumsily turned down my embarrassing music, and asked if she was okay. My pause had lasted for all of about two seconds. No one on the train noticed, not even her mom.

This isn't a heroic tale or a love story, although I felt like it was at the moment. I felt like I had done something much bigger than me, and I also felt like this beautiful girl and I would naturally connect over what just happened. But this wasn't the case. Instead, I checked on her, smiled, and around 10 seconds after my "lifesaving" moment, immediately isolated myself back into the music. I couldn't bring out my inner-confidence. I simply stood there thinking of something to say, only to be left mute.

It's easy to say what you want to do, but nearly impossible to bring yourself to do all those things. Life is about taking risks, not about conforming and hiding behind invisible walls. I tend not to struggle with personal adventure; I've jumped off 50-foot cliffs and rode the biggest roller coaster dozens of times; however, I do fear being judged and messing up when stepping toward the plate. Life's too short to live with regret though. My life wasn't dramatically transposed during this incident, but the things I didn't do are a constant reminder to stomp on the shortlist of opportunities I'm given. For that girl, she was a vertebra away from not having another chance. When that moment comes for me, I don't want to have any regrets. I look back at this brief moment with such rue because I feel that my time-lapse was flipped for a reason, yet I couldn't grasp the opportunity.

The music was a place to buy myself more time, a place to quickly think about the next move. But the top-half of the sandglass was empty and the girl got off at the next stop, roughly 30 seconds later. My eyes were fixed on her as she left the train and headed for the stairs. The train began to move when she glanced through the window and mouthed the words, "Thank you."`
    },
    {
        id: 6,
        category: 'supplemental',
        level: 'beginner',
        title: 'Windows',
        author: 'Irina Rojas',
        school: 'Hamilton College',
        tags: ['Hurricane Katrina', 'Resilience', 'Medicine'],
        content: `An eerie silence draped over New Orleans on a humid morning as the insects scampered back into their burrows. It was Saturday morning and I was still lying in bed, playing with the mood ring that my best friend, Anna, had given me as a good luck charm going into fourth grade. It was turquoise, meaning "tranquility." However, as I focused on the footsteps downstairs, I could tell that both of my parents were in a rush and that Mama was nervous, which was rare. Something was different.

I ran down to grab breakfast, but the voice of the news reporter and the hurricane alert noise coming from the kitchen television distracted me. The words on the bottom of the screen read, "mandatory evacuation." Papa told me to pack some toys for myself and for Rafa, my little brother. I figured we wouldn't need much since there were so many activities in Houston, where we'd evacuated to before. This time, though, the highways were too congested to get there safely. Instead, we headed to Charity Hospital since Papa, a neuroradiologist, was on call. With our previous experiences of nothing but strong winds and lights-out for a day or two, my parents decided it would be best for the four of us to stay together.

We were assigned to a small room on the 14th floor with two tiny twin beds. That night, the rain pounded on the old windows, like an angry crowd getting more and more agitated. At 1 a.m., a fierce air pressure in the room created a sharp pain in my ears, awakening us, only a mere second before the windows imploded. Shards of glass flew around the room, forcing us to hide in a stuffy hallway storage closet. We huddled around the handheld radio's static for the next five hours.

After the hurricane passed, I could tell Mama was distressed, yet she still managed to smile and say, "Te quiero mucho mi amor, todo va a estar bien." The next morning, one of the doctors urged us to look out the window. I simply stood there, holding Papa's sweaty hand, listening to the muddy waters from the Mississippi rushing in.

No one expected what would come next. In the basement, the emergency generators flooded, and the smell of rotting corpses from the morgue grew, getting stronger with the heat. In the lobby, people broke into the vending machines, stealing and selling the food. We didn't have any clean water either, so showers soon became Purell sanitation wipes, and toilets became buckets to throw out the window. During the day, my parents were busy, so Rafa and I painted "SOS" on bed sheets and hung them outside. At night, we played cards, and I silently sat next to a nurse who thought about the dog she had left at home. No one knew if our homes or friends were okay, nor when we'd be rescued, but I didn't cry. I was in survival mode.

A week later, we were rescued on swamp boats. That year, I attended four different schools. When it was over, I wept uncontrollably. Hurricane Katrina has challenged me. It has humbled and motivated me. I want to be a doctor, like the ones at Charity. I saw them work together, tirelessly, caring for anyone that they could, even dropping a joke here and there. I will never forget the man who gave me his secret stash of candy, or the night that we celebrated a birthday with a tuna sandwich as the cake, a Q-tip for the candle, and how they sliced it for everyone to share. We never gave up. I learned to appreciate everything and everyone around me. I became stronger.`
    },
    // === UK UCAS ===
    {
        id: 7,
        category: 'uk-ucas',
        level: 'advanced',
        title: 'Engineering at Cambridge',
        author: 'Anonymous',
        school: 'University of Cambridge',
        tags: ['Engineering', 'STEM', 'Academic passion'],
        content: `My interest in Engineering stems from a careers event at the remarkable National Physical Laboratory; here my aim to pursue a Maths and Physics related degree formed. Although they are my favourite and strongest subjects at school, I am often left keen to discover their practical applications. Engineering strikes me as the perfect way to relate exciting theories to real-world problems, giving science context.

As President of my school's Natural Sciences Society, I deliver presentations and organise talks where guest speakers discuss a wide range of topics, from 'Angular Momentum' to 'Solar Energy'. One speech on aero-engines taught me about the challenges of refining aeronautical engine efficiency. Fascinated by the notion of flight, I researched the topic in depth and wrote an article on how bumblebees fly, published in our Society Journal. Over the course of this activity, I encountered concepts such as biomechanics and aerodynamic stall, the latter of which became the subject of further personal research and another article in St Olave's Engineering Society Journal.

I enjoy problem-solving, taking an active interest in programming. I have independently completed two courses in Python, which have helped me develop the logical yet creative thought-process needed to write and debug code. They provided knowledge of Python types and structures, then moved on to object-oriented programming, algorithmic complexity and stochastic processes. The content learnt was regularly applied to the creation of games and tasks, to ensure I received a well-grounded and useful background in the language.

I was fortunate enough to gain industry experience at BAE Systems, where I led one of six teams in designing an F46 Blacksabre integrated cockpit. I gained a great appreciation for the importance of collaboration and composure as we dealt with the components' technical problems and logistical issues within the strict deadline. Following our written report and formal presentation, we were chosen as the successful contractors. I was proud to receive the prize for best individual performance during the week.

An Aerospace Headstart course furthered my teamwork skills, where we made a glider wing. Our design involved a tightly bound paper skin on a cambered aerofoil structure with a single I-beam slat, minimal ribs to lower weight and a sanded leading edge to smoothen airflow. This led us to achieve the best lift/drag ratio out of eight groups. Not only did I gain a solid foundation in aerodynamics, but I became better prepared for the intensiveness of project work, given we had just two hours to plan and make the entire model.

I have always been transfixed by the idea of reproducing science fiction; for my EPQ I explored the viability of creating the suit of Marvel superhero Falcon, including the performance of carbon nanofibre wings, the material giving them morphing and bulletproof capabilities, and how best to use turbojet engines to generate enough thrust. I also analysed the integration of these features with weapons and displays to create a fully functioning suit-system. The project cemented my impression that Engineering weaves together many areas of science to create something entirely new, a notion that greatly appeals to me.

Alongside my studies, I enjoy volunteering for the ESU, where I judge competitions at a regional level, and at a local nursing home, organising resident activities. I mentor students in KS3 Maths and am also a keen musician, obtaining Distinctions in Grade 8 piano and Grade 7 flute. Having an extensive extracurricular life both in school and out reflects my organisational talent and effective time management.

I believe my consistently high performance in A-Levels and academic competitions shows my potential to excel in this course. The world will always encounter problems, and will always require engineers to solve them. Studying Engineering at the highest level would give me the chance to help shape our future.`
    },
    {
        id: 8,
        category: 'uk-ucas',
        level: 'advanced',
        title: 'Graduate Entry Medicine',
        author: 'Anonymous',
        school: 'UK Medical School',
        tags: ['Medicine', 'Career change', 'Research'],
        content: `Since graduating from Institution in 2003 with a 2:1 in mathematics, I have established myself as a researcher in the Institute for xxx. I specialise in developing mathematical models to aid our understanding of xxx. When I first joined the institute I worked on a project to quantify the risk to humans from xxx and evaluate the risk reduction that could be achieved by different control strategies. I was asked to present this work to the Food Standards Agency and my findings were used to inform their policy decisions. For the past four years I have been working towards a PhD and, having recently submitted my thesis, I am now awaiting my viva.

Although I enjoy academic work, I have always felt that I would prefer a career where I can interact closely with people and where I can be of help in a more immediate way. In this sense medicine is a natural progression for me. Last year I spent a week shadowing a team of doctors and nurses who specialise in vascular medicine. I visited the ward, the outpatient clinic and the theatre. The experience was a fascinating insight into life in hospital and one that I enjoyed immensely. It has confirmed my commitment to a career in medicine. I used it as an opportunity to learn about the responsibilities of the different team members and about the high element of teamwork involved in medicine. My research involves collaboration with other scientists - including several clinicians - and I enjoy discussing ideas amongst a team and learning from others.

My time in hospital gave me a flavour of the rewards and challenges that a medical career offers. It highlighted that certain fields can be continuously stressful and that time management skills are crucial. The importance of leadership skills and a commitment to administration was also evident. I am confident that I could thrive in this environment. One of my interests is rock climbing and this has taught me how to make rational decisions whilst under pressure. In my free time I also run a badminton club and I am self-employed as a property manager. I would relish the opportunity to redirect the organisational skills that I have acquired from these experiences towards a career as a clinician.

During my placement in hospital, it gave me great pleasure to talk to patients about their experiences and to practise my bedside manner. My skills were later put to the test when I spent two weeks accompanying doctors who were treating HIV patients in The Gambia. Because of the language barrier, I quickly learned about the contribution that body language plays in portraying empathy towards patients. My involvement in charity work has also enabled me to improve my interpersonal skills. As an undergraduate, I was part of a group that took underprivileged children on summer holidays. Some of the children had special needs and the trips were often quite challenging. Nevertheless, I enjoyed the experience and I found it incredibly rewarding. Analysing my motivation to study medicine from a more personal perspective, the chance to help patients in a more direct way than would be possible from a research position is something that would be deeply fulfilling.`
    },
    // === LAW SCHOOL ===
    {
        id: 9,
        category: 'law-school',
        level: 'advanced',
        title: 'From Healthcare to Health Law',
        author: 'Anonymous',
        school: 'Law School',
        tags: ['Health Law', 'COVID-19', 'Career change'],
        content: `Ever since I was a little girl, I thought that I wanted to work in the medical field. To me, those who did were superheroes. As I grew older, I began to pursue my desire to be in the medical field so that I too could one day be a superhero. When I started my healthcare career a few years ago, I was eager and optimistic. Unbeknownst to me, the field would come to drastically change, and I would uncover disheartening truths about the healthcare industry that would make me question my ambitions.

In 2020, the world began to battle COVID-19, and healthcare hasn't been the same since. By personally working on the front-line during the COVID-19 pandemic, it became quite apparent to me that the healthcare system is broken. This pandemic has shed light on just how inadequate the public health industry is. The unfortunate truth was revealed that healthcare is, at its core, a business. Providers in the private sector are often faced with the dilemma of wanting to treat a patient who truly needs their help but being limited by the rules and regulations of the corporation they work for. Even the widely utilized COVID-19 test requires insurance at most private companies. If a patient does not have medical insurance, they are forced to pay exorbitant amounts for this necessary, potentially life-saving test. Despite the fact that providers and staff are empathetic to the patient's situation, unless the patient is able to pay the business, there is not much they can do to help.

Furthermore, burnout has reached new heights among healthcare professionals in the United States since the start of the COVID-19 pandemic. With the high patient volume that many clinics are seeing, patients are often turned away at the door due to a lack of resources and staffing. The demand placed on medical personnel during this pandemic has surpassed the expectations placed on them in the past, causing an unfortunate decline in patient care. Medical providers are asking for help from a system that will not answer their call. The healthcare industry has not only failed its providers, but it has proven to be ineffective in its ability to give adequate care to patients with nowhere else to turn.

I believe that unless action is taken toward improving such an overwhelmed industry, the patients and medical providers are going to suffer. It is this new outlook on the healthcare industry that has motivated me to pursue a career in health law. I want to work to fix this fragmented, unjust system. I want to protect the patients' and providers' rights. Medical providers should not be forced by their employers to turn patients away because of their socioeconomic status. And, patients should not feel as though they have nowhere to turn when they are in desperate need of help. Studying health law will give me the tools necessary to construct public policy that can address the fundamental issues that are plaguing the healthcare industry today. It will allow me to defend policies that promote greater access to more affordable and higher quality healthcare. It will also give me the opportunity to protect providers from any legal liabilities they might be subjected to due to the regulations placed on them by their employers.

I know that I have what it takes to succeed in this pursuit of an education and eventual career in health law. My background in the study of biology and my direct work with patients and providers will bring a unique perspective to my future law school community, as well as the legal profession. By pursuing an education in health law, I intend to enter a profession that aligns with the interest and knowledge I have discovered and developed through real world experience.

By being involved in health law, I will be able to accomplish things in healthcare I had not even imagined when I began my journey in healthcare years ago. I believe it will give me an opportunity to ensure patients receive quality care at a level that is unencumbered by the rules and regulations of the business that is healthcare. A career in health law is the solution to ensuring that a patients' inalienable healthcare rights are respected, and that the medical providers can administer the care they know to be medically necessary. I know that as a future proponent of health law, I can and will become the superhero I had once hoped to be.`
    },
    {
        id: 10,
        category: 'law-school',
        level: 'intermediate',
        title: 'Filotimo',
        author: 'Anonymous',
        school: 'Law School',
        tags: ['Greek heritage', 'Community service', 'Identity'],
        content: `Filotimo. This little eight-letter, four-syllable word eludes explanation. I can't quite put my finger on an exact definition, and neither can Google Translate or any Greek-American dictionary or translator. Nevertheless, I will do my best to define it: filotimo is a Greek word that embodies the foundational Greek principles of honor, duty, dignity, hospitality, and warmth.

Living through the values of filotimo means being selfless and helping others, not in expectation of reward but in the fulfillment of a sense of duty and virtue. Prior to even knowing such a word existed, these were the values I grew up with in the Greek-American community and the pillars with which I have unconsciously structured my life.

The root of my passion for filotimo comes from my parents: two natives of a small island in the Cycladic cluster of the Aegean Sea, Andros. Every summer, we vacation to Greece to relax and reunite with family on our breaks off from school. Andros is my home away from home. But in the endless summers I spent soaking in the sun and strolling through the towns, I often blissfully got swept up in the winds of oblivion, ignorant to the urgent state of affairs in my little hometown, as I was clouded by my youthful naivite. The island was in a financial slump, not only because of the country-wide recession, but also because of the island's ongoing struggle to allure a tourist crowd and make enough during the summer months to support the locals for the entire year. With every passing summer, I slowly became more aware of the unstocked shops that no longer sold my favorite Greek chocolates, and I noticed the pharmacy disappear on one corner of the agora while the butcher shop disappeared on the next. The community and the people I grew up with who gave life to the island were packing their bags and boarding up their buildings to find jobs elsewhere. What once was my hometown's steady breath was now a vanishing gasp for air.

While others gave up, my parents took this crisis as a call to action. As board members of the Andros Society of USA, a Greek-American organization devoted to forging a community of Andriotes across the United States, they kick-started fundraising efforts and charity galas to raise money and help the locals in their time of need. Through their selflessness and passion for filotimo, they inspired me to be a part of the effort towards reconstructing the island and giving back to a cause that hit close to home. I have sold numerous raffles and ads for our society's journal, consistently promoted and raised awareness on social media platforms, and, above all else, invested countless hours towards creating a better future for my home away from home. At our last gala alone, I was a major player in the effort that raised over $30,000 to fund medical supplies for the island's only hospital.

I have devoted myself to doing everything I can to help others, both abroad, through the Andros Society's major philanthropic efforts and locally, through my church community, to give back to soup kitchens and natural disaster relief programs. Essentially, choosing a career in law satisfies not only my passion for academia but my drive for helping others and putting the values that I was raised with into practice. Whether it's being the person who will stand up for a small Greek community in the middle of the Aegean or the person who will stand before a court in the state of New York to defend a client or a company, filotimo is what I put into practice in everything I do. For these reasons, I am confident that my dedication to contribute towards a greater good and my passion for living by the values of filotimo will be invaluable in my future as an attorney.`
    },
    {
        id: 11,
        category: 'law-school',
        level: 'intermediate',
        title: 'Family Law & Child Welfare',
        author: 'Anonymous',
        school: 'Law School',
        tags: ['Family Law', 'Social work', 'Advocacy'],
        content: `In January 2021, I spent nearly six hours sitting in Bliss County Family Court with one of my clients, a single mother of a toddler, while her abusive, estranged husband sat across the room. It was the day of their custody hearing, and my client had been agonizing for weeks about whether she would be granted sole custody of her daughter. I reassured her and reminded her that she was her child's only caregiver and provider — and with good reason, on account of her husband's alcoholism and physical and emotional abuse.

When my client asked me to accompany her to the courthouse, I told her I would only be able to wait with her, because as a non-lawyer I did not have any authority to speak on her behalf. She understood, and I realized she wanted me there as a moral support. She was afraid her husband would try to manipulate her into some informal custody arrangement, and she thought that as long as I was there, he would not approach her, and she would not be tempted to acquiesce to his hypothetical demands. She was right, and the outcome of the hearing was in her favor. I was happy for my client and relieved that her daughter would remain in the right hands. And although I was glad that I could be of help to my client, I felt frustrated that I could not advocate further for her that day.

On paper, my role as a case planner for a child welfare agency is about checking boxes: assessing the condition of the child's home; checking for suspicious marks or bruises; requesting medical and educational records; and making referrals for community-based services. In reality, the job is all that plus more: waiting with parents in courthouses, welfare offices, and schools; grocery shopping with a family struggling to make ends meet; reading mail to an illiterate mother; hugging a crying toddler; discussing the importance of safe sex with a rebellious teenager; listening to the many trials and tribulations of primarily low-income people of color dealing with generational trauma; trying to support and advocate for them in any way I can; and feeling defeated when I can only do so much for them within the confines of my position.

I value being a point of contact for the families I have served over the past two and a half years. I believe it is meaningful work to direct a person asking for help to a resource or organization that can better support them. But I dream of a future where, when a 12-year-old tells me she wants her aunt to adopt her, I can help them on that journey. Or when a mother asks me for advice on how to respond to her abusive ex's petition for visitation with their children, I can formulate a plan with her and advocate for her in front of a judge. Or when an undocumented parent asks me for legal assistance, I can confidently provide it to them rather than give them information for Legal Aid and hope for the best. These exchanges are real, and they reaffirm my intent to practice family law every day.

My desire to pursue family law did not begin with my work in child welfare. It first occurred to me when I was a freshman journalism student with a vague interest in law, and it was a future I could envision for myself. On the cusp of graduating, I found an opportunity to work in child welfare through the nonprofit Fostering Change for Children. I spent July 2018 with my cohort in an intensive child welfare training at Columbia University's School of Social Work and subsequently started my role as a case planner. This work is challenging, at times grueling, and emotional; yet above all else, it is restorative and fulfilling. Nowadays, I view family law as a vehicle to be a stronger and more effective advocate for resilient children and the parents and caregivers who work within their capacities every day to keep those children safe and healthy.`
    },
    {
        id: 12,
        category: 'law-school',
        level: 'advanced',
        title: 'Criminal Justice & Compromise',
        author: 'Anonymous',
        school: 'Columbia Law School',
        tags: ['Criminal Justice', 'Activism', 'Growth'],
        content: `When I first moved to the Deep South, I was applying for a visual anthropology MA program. Armed with a DSLR and VideoMic Pro, I documented the local Black Lives Matter movement in North Carolina. But social justice work quickly drew me in, and within a few weeks, I turned from an observer into a participant. Within four months, I found myself standing arm-in-arm in a crowd of activists, surrounded by riot gear police and the National Guard, demanding change during the Charlotte Uprising following the shooting of Keith Scott. I remember marching past the towering Mecklenburg County Jail to see the long rows of rectangular cell windows. Dozens of cell lights began to flicker. The inmates seemed to be saying that they knew we were out there fighting for their rights. After that moment, I decided to dedicate my life to concrete, practical approaches to criminal justice reform through law and advocacy, instead of pursuing visual anthropology.

As a documentarian and organizer in Asheville, I worked deeply within anarchist circles to execute and document acts of civil disobedience, like police station sit-ins, demonstrations outside city officials' homes, and road blockades. I not only learned that water-based sunscreen is preferable to oil-based sunscreen (it's easier to clean out of your eyes if you get pepper sprayed), I also learned that having radical politics can alienate a lot of people, including those you're trying to help.

For example, it was difficult for our "affinity group" (the building block of anarchist organizations) to collaborate with moderate black organizations in order to make improvements to the police department because many anarchist organizers I worked with wouldn't compromise their radical beliefs. This was incredibly frustrating for me. I remember one morning calling my dad, who runs a nonprofit, and mentioning the difficulty I faced. With a laugh, he told me he's spent the last 30 years of his career compromising.

I realize that he and my step-mom have to compromise often in order to effectively help people. This was a turning point for me. My affinity group couldn't surmount challenges we faced because we refused to work within the city's legal framework for ideological reasons. But navigating the legal system is often necessary to help those impacted by the justice system or to work to reform it. This is why I want to attend law school.

Columbia Law School is the perfect place to prepare me for this challenge. Columbia's unique social justice curriculum (classes like "Lawyering for Change," the "Racial Justice Litigation Workshop," and the "Law and Organizing for Social Change Externship") will pair well with my statistical research and programming background when creating innovative, data-backed policy solutions to criminal justice problems. In fact, scholarship by Columbia's Philip Genty into the collateral damage of the criminal justice system on families very closely relates to the kind of independent research I hope to engage in and publish in the Columbia Journal of Race and Law. Building upon my volunteer work with the Children of Inmates program in South Florida, I am eager to participate in the "Challenging the Consequences of Mass Incarceration Clinic". Because, to family members of inmates, those also impacted by the criminal justice system, criminals are much more than just flickering lights.`
    },
    // === IVY LEAGUE & TOP UNIVERSITIES ===
    {
        id: 13,
        category: 'ivy-league',
        level: 'intermediate',
        title: 'Finding Voice Through Adversity',
        author: 'Anonymous',
        school: 'Harvard University',
        tags: ['Resilience', 'Writing', 'Domestic hardship'],
        content: `When I turned twelve, my stepdad turned violent. He became a different person overnight, physical and emotional abuse came in waves. You might say that my upbringing was characterized by my parents morphing everyday objects into weapons and me trying to morph into the perfect white walls.

I found solace in books. When things got particularly bad, I would hide in my closet with a flashlight and read. Words became my fortress. I read everything from Harry Potter to Dostoevsky, from comic books to encyclopedias. The worlds between those pages were so much safer, so much kinder than my own.

Eventually, reading wasn't enough. I needed to create my own worlds. I started writing stories in seventh grade, scribbling in notebooks during lunch. My English teacher, Mrs. Rodriguez, noticed. She didn't ask questions about my home life, but she started lending me her personal collection of poetry books. She told me that writing was the most powerful form of self-advocacy.

By ninth grade, I had filled seventeen notebooks. I started an anonymous blog where I shared yoga practices, breathing exercises, and affirmations for other teenagers going through difficult times. What began as a personal coping mechanism became a community. Within six months, the blog had over two thousand regular readers. Teenagers from across the country emailed me their stories, their fears, their small victories.

The blog eventually generated enough income through affiliate links that I could help my mother save money to leave. It took us eighteen months of secret planning. The night we left, I packed only three things: my laptop, my favorite notebook, and the first book Mrs. Rodriguez had lent me.

I used to think my childhood was something to overcome, a chapter to get past so the real story could begin. But I've come to understand that it is the story. Every word I write carries the weight of those years, and that weight gives my writing gravity. The scared kid in the closet with a flashlight taught me that stories can save lives, sometimes quite literally.

I want to study literature and psychology at Harvard because I believe in the therapeutic power of narrative. I've seen it work in my own life and in the lives of the thousands of teenagers who found my blog when they needed it most. My past is not a wound I'm nursing; it's the foundation I'm building on.`
    },
    {
        id: 14,
        category: 'ivy-league',
        level: 'intermediate',
        title: 'Rotting Flesh and Healing Hands',
        author: 'Anonymous',
        school: 'Duke University',
        tags: ['Medicine', 'Shadowing', 'Ethics'],
        content: `As soon as the patient room door opened, the worst stench I have ever encountered hit me square in the face. Though I had never smelled it before, I knew instinctively what it was: rotting flesh.

The patient, a frail woman in her seventies, lay on the examination table with her right leg propped up on a pillow. Her foot was wrapped in layers of gauze that had yellowed and browned in uneven patches. The surgeon I was shadowing, Dr. Patel, greeted her warmly, as if the smell didn't exist. He asked about her grandchildren, her garden, whether she'd been watching her favorite cooking shows. Only after several minutes of genuine conversation did he turn his attention to her leg.

As he carefully unwound the bandages, I fought the urge to look away. The tissue beneath was necrotic, blackened and crumbling at the edges. Dr. Patel examined it with the same calm focus he might bring to reading a newspaper. He explained to the patient, gently but directly, that the gangrene had progressed. Amputation was no longer optional.

What happened next changed my understanding of medicine forever. The patient didn't cry. She didn't argue. She looked at Dr. Patel and said, "I trust you. You've always been honest with me." There was a relationship there, built over years of appointments, of difficult conversations, of small kindnesses. She trusted him not because he had the best surgical technique, though he did, but because he had always treated her as a person first and a patient second.

After she was wheeled to pre-op, I asked Dr. Patel how he managed the emotional weight of telling someone they were going to lose a limb. He paused, then said something I've carried with me ever since: "We hurt to heal. That's the fundamental paradox of surgery. Every cut we make is an act of violence in service of compassion."

That afternoon I watched the amputation. It was brutal and precise and somehow beautiful. I saw the coordination of the surgical team, the careful respect they showed even to tissue that was being removed. I saw Dr. Patel check on the patient three times before his shift ended.

I entered that hospital hoping to confirm my interest in medicine. I left understanding that medicine is not a career defined by technical mastery. It is defined by the capacity to hold another person's suffering, to sit with it, to honor it, and then to act. The stench of rotting flesh has faded from my memory. What remains is the image of a woman who placed her life in another person's hands, and a surgeon worthy of that trust.`
    },
    {
        id: 15,
        category: 'ivy-league',
        level: 'advanced',
        title: 'True Learning',
        author: 'Anonymous',
        school: 'Stanford University',
        tags: ['Education', 'Discovery', 'Collaboration'],
        content: `In most conventional classrooms, we are taught to memorize material. We study information to regurgitate it on a test and forget it the following day. I thought this was learning. But this past summer, I realized I was wrong.

I attended the SPK Program, a five-week enrichment course studying Physical Science at a local university. On the first day, our professor presented us with a challenge: using only the materials on our desks, a length of tubing, two cups, and a basin of water, we had to figure out how to transfer water from one cup to another without lifting either cup.

No textbook. No lecture. No instructions.

For twenty minutes, we fumbled. We tried blowing into the tube. We tried creating seals with our hands. We tried tilting the basin. Nothing worked. Then a girl named Sarah said, "What if we suck the air out of the tube while one end is in the water?" We tried it. Water flowed upward through the tube and into the second cup. We had independently discovered a siphon.

Our professor was grinning. "You just learned something that took ancient engineers generations to figure out. And not one of you will ever forget how a siphon works." He was right. That moment fundamentally changed my relationship with knowledge.

Over the following weeks, we derived equations from observation rather than memorizing them from a board. We built circuits before learning Ohm's Law. We dropped objects from the roof before studying gravitational acceleration. Every concept arrived through experience first and vocabulary second.

But the most valuable lesson wasn't about physics. It was about collaboration. Sarah's insight with the siphon taught me that learning is inherently social. No one person holds all the pieces. Throughout the program, I watched students with different strengths combine their perspectives to solve problems that none of us could have solved alone. The math-minded students could quantify what the intuitive students could feel. The creative thinkers could see possibilities that the analytical thinkers had dismissed.

I returned to my regular school in September feeling like I'd been given a new pair of glasses. The world hadn't changed, but the way I saw it had. I started a study group where we worked through problems collaboratively before looking at the textbook solutions. I began asking "why" before "how." I realized that true learning isn't the accumulation of facts. It's the process of working together to solve the problems around us.

That five-week program taught me more about learning than sixteen years of formal education. Not because the content was better, but because the approach was fundamentally different. Knowledge isn't something you receive. It's something you build.`
    },
    {
        id: 16,
        category: 'ivy-league',
        level: 'advanced',
        title: 'Yellow Fever and Small Steps',
        author: 'Anonymous',
        school: 'University of Pennsylvania',
        tags: ['Global Health', 'Research', 'Advocacy'],
        content: `When I was thirteen and visiting Liberia, I contracted what turned out to be yellow fever. I was lucky. I had access to a hospital, to clean water, to medicine. I recovered in two weeks. But the experience haunted me because I knew that for many Liberians, yellow fever was a death sentence. Not because the disease is inherently fatal, but because the infrastructure to treat it simply doesn't exist.

Yellow fever shouldn't be fatal, but in Africa it often is. I couldn't believe that such a solvable issue could be so severe. A single vaccination prevents it entirely. Clean water and basic medical care can treat it. The problem isn't medical; it's systemic. It's about access, infrastructure, and political will.

That realization became the foundation of everything I've done since. During my sophomore year, I founded my high school's chapter of the African Disease Prevention Project. We started small, hosting bake sales and information sessions. Most of my classmates had never heard of yellow fever, let alone understood why it remained deadly in certain parts of the world. Educating them was the first step.

Over three years, our chapter raised nearly three thousand dollars. That money funded mosquito nets, water purification tablets, and educational materials for a village health clinic in rural Liberia. It wasn't going to end yellow fever. But it was going to save lives, one village at a time.

Simultaneously, I pursued research at UCLA's Genomics Lab, studying cancer cell mutations under Dr. Sarah Chen. The work was meticulous and often frustrating, hours of pipetting and data analysis that sometimes led nowhere. But the discipline of research taught me something crucial: progress in health doesn't come from grand gestures. It comes from the patient accumulation of small, verifiable steps.

One afternoon in the lab, after a particularly discouraging week of inconclusive results, Dr. Chen told me something that reframed my entire approach: "Science isn't about eureka moments. It's about showing up, day after day, and being willing to be wrong." That advice applied not just to the microscope but to everything: to fundraising when donations are slow, to advocacy when people don't want to listen, to the long, unglamorous work of building systems that save lives.

I've learned that the distance between a problem and its solution is measured not in breakthroughs but in footsteps. The thirteen-year-old with yellow fever in a Liberian hospital bed couldn't have imagined that his illness would lead to a life dedicated to global health. But taking small steps, often, is the best approach to solving even the most overwhelming problems. I plan to continue taking those steps at Penn, where the integration of research and real-world application isn't just encouraged but embedded in the university's DNA.`
    },
    {
        id: 17,
        category: 'ivy-league',
        level: 'advanced',
        title: 'Overcoming ADHD and Bias',
        author: 'Anonymous',
        school: 'Yale University',
        tags: ['ADHD', 'Advocacy', 'Resilience'],
        content: `I was a straight A student until I got to high school, where my calm evenings cooking dinner for my siblings turned into hours watching videos, followed by the frantic attempt to finish homework around four in the morning. My grades didn't drop immediately. They eroded slowly, like a coastline, each semester losing a little more ground.

My parents took me to three different doctors. The first said I was lazy. The second said I was anxious. The third, after a forty-five minute appointment, told my mother that because I had maintained high grades through middle school, I couldn't possibly have ADHD. "High-achieving students don't have attention disorders," he said. What he meant, though he'd never admit it, was that a Black girl from a middle-class family didn't fit his mental image of ADHD.

It was our school librarian, Ms. Thompson, who first suggested I might be struggling with attention regulation rather than motivation. She'd noticed that I could read for hours when the subject interested me but couldn't sit through a fifteen-minute lecture on a topic I found unstimulating. She gave me articles about ADHD in women and girls, about how it presents differently than the hyperactive stereotype, about the systematic under-diagnosis in communities of color.

Armed with research, I found a doctor who was willing to listen. The diagnosis, when it finally came during junior year, was simultaneously devastating and liberating. Devastating because I'd spent two years believing I was broken. Liberating because I finally had a framework for understanding my brain.

But diagnosis was only the beginning. My school had already removed me from two AP courses, citing my declining performance. I had to advocate for my reinstatement, which meant sitting in a meeting with administrators who had already decided I was in over my head. I brought research. I brought my test scores. I brought a letter from my new doctor. I brought Ms. Thompson, who stood beside me and said, "This student is one of the most intellectually curious people I've ever met. She doesn't need fewer challenges. She needs the right support."

I was reinstated. I graduated with honors.

The experience taught me that systems designed to help students often fail the students who don't fit expected patterns. I became an advocate, first for myself, then for others. I now mentor younger students who are struggling with similar issues, helping them navigate the diagnostic process and advocate for accommodations.

I've come to see my ADHD not as a limitation but as a different operating system. My brain doesn't work the way traditional classrooms expect it to, but it works beautifully when engaged. I can see connections that others miss. I can hyperfocus on problems that fascinate me with an intensity that borders on obsessive. I've learned that engagement requires relevance, and that's not a weakness. It's a design specification.`
    },
    // === JOHNS HOPKINS ===
    {
        id: 18,
        category: 'jhu',
        level: 'beginner',
        title: 'A Splash of Color',
        author: 'Emily O.',
        school: 'Johns Hopkins University',
        tags: ['Self-discovery', 'Confidence', 'Broadcasting'],
        content: `I stare into my bathroom mirror as I remove the mask. For the first time, I will attend high school showing my full face. I need to be beautiful, just like the girls on my TikTok feed. I examine each video, searching for the common thread. A hot pink blush gleams on each girl's cheek. Despite the stark contrast between my pale Irish skin spattered with freckles and that of the sun-kissed influencers, I race to Target to search for the infamous Revlon Insta-Blush which comes in stick form, making it foolproof. Or, so I thought.

On the first day of school, I optimistically swipe the stick across my face, waiting for instant beautification. But, my embarrassingly pink cheeks redden as they attract a different type of attention. I quickly banish the blush stick to the back of my makeup drawer. In need of a confidence boost, I vow to add color into my life instead of my face.

An opportunity presents itself near the end of freshman year as I sit in World History class with my friends Hannah and Julia. Suddenly, they thrust their iPads in my face. They smirk, informing me that "Glenbard West is looking for its next weather reporter." I join them in laughter but steal a second look at the email. My eyes betray me. Both catch my second glance.

"Oh my gosh, Emily, I dare you!" Hannah screeches. I shrug, click the sign-up link and hastily complete the form. Later, I am invited to submit an audition video. I scoff and close the email, certain I'd quickly become a social pariah. Yet, this could be my chance to add a splash of color, to take a risk and attempt something new. I grab my umbrella as a prop, hit record and recite the script. A week later, an email entitled, CONGRATULATIONS WEATHERWOMAN!, arrives. What have I gotten myself into?!

Suddenly, it's time to compose my first report, to enter the eye of the storm. Conscious that every word will be broadcast to all of my peers, I keep it straightforward, simply presenting the forecast. Boring. I know something is missing. So, I create a catchy sign-off, "Keep it Cool in the Castle West" which references our school's castle-like logo.

On recording day, I stare into my bathroom mirror once again. My eyes drift toward a single tube of coral blush I had been given two years prior. Its soft, sunset orange hue in stark contrast to that TikTok trending hot pink. I slowly dab the Glossier Cloud Paint blush onto my cheeks. It gives my pale skin a natural glow, one that emulates my happiness. My confidence shines as I record my first segment.

Later, when the broadcast projects into my classroom, my nerves take over. I bury myself into my iPad, trying to disappear. After class, I venture into the hallway, eyes glued to the floor. "Great job with the weather!" someone yells. Another waves. I shoot upright, scanning from one smiling face to another.

As I record more and more broadcasts, even people I hadn't known before begin to say "hi" to me across campus. I'd always been one with a small, tight circle of good friends, but unexpectedly, my social network broadens as my campus "celebrity" grows. As I forge connections with new peers, my confidence builds. I expand my role within the broadcast and my school. I no longer recite the bare minimum but rather, report on sporting events and dare to write my own jokes. Contributing to our school spirit in this small way makes me proud. By trying new things and breaking the cage of conformity, I've also learned to love myself and my differences from the girls on social media. I wear my coral blush with pride for the freshman girl in Target. She finally learned how to be herself.`
    },
    {
        id: 19,
        category: 'jhu',
        level: 'beginner',
        title: 'Conquering',
        author: 'Faith W.',
        school: 'Johns Hopkins University',
        tags: ['Public speaking', 'Leadership', 'Growth'],
        content: `I remember being surprised at how weak my arm felt, as if I was holding a dumbbell instead of a microphone. Standing in front of all of my high school classmates at our weekly Monday Meeting, I could feel my heartbeat in my ears as I studied the small silver holes in the head of the microphone and momentarily wished I was small enough to fit into one of them and disappear. I looked down at the short Women's History month fact I had prepared and began to read. It wasn't until I felt someone come up next to me and gently push the microphone closer to my face that I realized that no one could hear me. I finished a few seconds later and fought tears as I returned to my seat amid a smattering of polite applause.

I mostly felt embarrassed; I had failed at such a simple task and allowed my nerves to hijack my voice. For the rest of the meeting, I watched our Student Body President, a brilliant, charismatic senior make announcements and crack jokes with an apparent ease that I couldn't fathom. I had so much respect and admiration for his public speaking skills. I wished I had the courage to be up there, self-assured and composed. As my embarrassment ebbed I felt another feeling boiling up in me; a sudden resolve. I wanted to get up there one day and try again.

Naturally a reserved person, adjusting to a new school freshman year had been difficult. I found a weird solace in hiding behind the masks we were still wearing at the time, covering most of my face made it easier to remain in my own little bubble, quietly observing others. Given my shyness, I was a bit surprised when a teacher encouraged me to run for Student Council. I surprised myself even more when I decided to run. The idea of being one of the student leaders who I so admired, up there leading the meetings, scared me, and yet it simultaneously drew me in like a magnet for reasons that I couldn't have fully articulated at the time. It was precisely the fear that made me want to try. I wanted to prove to myself that I could conquer it.

This inescapable pull towards things that scare me has extended into every aspect of my life, from public speaking to basketball to academics. Aside from the responsibility I feel to myself, I often think about people less fortunate than I am; my cousins in Florida, family members in Jamaica, and girls just like me around the world who will never have access to an education. Many of them will never have the chance to take an AP science class, give a TEDx talk, or run for Student Council. I feel that I owe it to them, too, to take advantage of every opportunity, even the daunting ones. Getting out of my comfort zone is not just a personal obligation; it's a privilege and a blessing.

Now, in front of my classmates as Student Body President, holding the microphone doesn't trigger the waves of panic it once did. I no longer study the holes in the microphone; thanks to experience, I have gradually felt empowerment take the place of horror when I have the microphone in my hand. Recently, an underclassman told me that even though she loves being in Student Council, she would never run for President, because she could never get up there and speak like I do. She said it flippantly, like it was just a fact, but I saw so much of myself in her and immediately pushed back. She can. Because I did. Ultimately, that's the best part of holding the microphone, being an example and encouraging those who I'll eventually pass it on to, like so many others did for me.`
    },
    {
        id: 20,
        category: 'jhu',
        level: 'advanced',
        title: 'Building a Universe',
        author: 'Shotaro O.',
        school: 'Johns Hopkins University',
        tags: ['Worldbuilding', 'Creativity', 'Curiosity'],
        content: `Just outlining the coastlines took a month. On the solid, 22-inch by 30-inch sheet of white paper I was working on, I couldn't just press the "undo" button if my highlighter happened to slip. I had spent two months creating a rough draft, and an additional month transferring that onto the final copy with a pencil. I then outlined that with a pen, which I was now going over with a highlighter. Messing up at this point meant losing four months of hard work. The stakes were high, but I was enjoying the process. I was already thinking about other details I could expand upon next. A steampunk society experiencing rapid technological advancements, I'd decided, would be the setting of this fantasy world. I imagined the technologies I could introduce in this setting. I thought about the economic and cultural indications these technologies would have on civilizations in this world. Meanwhile I continued to carefully move my highlighter.

"Worldbuilding" is a process of creating a fictional universe of your own; developing anything from the geography and climate of a continent to the annual holidays of a specific culture. The easiest way to visualize the process is to think about works by some fantasy authors, like J.R.R. Tolkien, or game developers. Though I am neither, this hobby is an important part of who I am; it reflects my interests, my curiosity, and my growth.

One reason I love worldbuilding is because of the sheer amount of questions I can ask. Research is critical to the process. The questions I've recently asked involved history (I looked at how historical nomadic empires rose to power), geology (I studied plate tectonics for a more realistic map), primatology (I researched about Great ape language to explore possibilities of interspecies communication), and computer science (I wanted to know whether computers could be invented by civilizations without electricity). The questions that worldbuilding forces me to ask open my eyes to new subjects I didn't even know existed, and this in turn enables me to work with more sophisticated worldbuilding ideas.

Worldbuilding also allows me to show my own personality within my fantasy world. The amount of detail into the world's history is reflective of my love for the subject. My passion for abstract strategy board games (like chess and checkers) has motivated me to develop a similar board game for my world. The extensive government systems of my republics and empires reflect my strong understanding of the legal system, gained through my participation in the school Mock Trial.

Two months later, standing over my finished map, I immediately noticed some flaws. I'd drawn the continents a bit too small, leaving an awkward blob of blank space on the top left of the map. On the bottom, the map legend's design was noticeably underwhelming. Overall, things could definitely be better.

And yet, gazing over my creation what I most prominently felt was pride. This moment was perhaps my favorite part about worldbuilding, taking a step back and seeing what I managed to create from scratch. In 6 months, my map came to contain three continents, over one hundred islands, over fifty countries, and over sixty major cities, along with road networks, major rivers, and mountain ranges. I'd also developed various sophisticated histories, cultures, and technologies accompanying the individual societies. Worldbuilding shows you what's in your mind: stuff that amazes even yourself.

Even when the map is finished, the worldbuilding journey continues on. I'm still researching. I'm still reflecting my other passions onto my creations. My next map may identify earthquake hotspots, and it definitely will have a better organized legend. My next civilization may be built by apes, and it will surely have developed mechanical computers. Fusing knowledge, experience and imagination, the possibilities of worldbuilding are truly endless. As long as I continue to grow and learn, my world continues growing with me. I find that very exciting.`
    },
    {
        id: 21,
        category: 'jhu',
        level: 'advanced',
        title: 'Be the Salt of the Earth',
        author: 'Maria G.',
        school: 'Johns Hopkins University',
        tags: ['Culture', 'Identity', 'Diplomacy'],
        content: `"No le pongas demasiada sal!" My mom, anticipating a bitter taste from the soup, alarmed me. Yet curious like a five-year-old, I felt it was my mission to discover the secrets behind the little white container in front of me. Standing still, making noise at a shake, laid the salt. Deciding to empty half the recipient, my mom and I laughed the second I tasted our alphabet soup.

Composed of primarily sodium chloride, salt is a staple for food and culture. At the same time, the element is an equal symbol for health, preservation, and connection. Seen time again in history, salt was a compensation for Roman Empire's soldiers, a source of currency for ancient China, and an exchange in the Gulf Coast from the Olmec people. Globally, a little of it goes the long way.

Ironically, for the entirety of my early adolescence, I underestimated the value of salt in the human body. How could such a small grain be worth immense value? It appeared like an exaggeration. Despite my assumption, fainting in the presence of heat conversely transformed this mindset. Then, I was not surprised to know I battled with low blood pressure. To prevent injuries, I was advised to intake balanced meals. Most importantly, moving from one state to another forced me to keep track of possible imbalance in my body at the end of my junior year.

With an opposing view of the country, I was intrigued at smoky undertones of sea salt in brown rice, at a piece of boiled egg with table salt, or at a pinch of pink salt in a fresh avocado. Unable to eat foods with high sodium, I grew appreciation at the appearance of soul meals in new places. Mere glimpses at dishes fueled my taste examinations. While exchanging interactions with a diverse school population throughout lunch time, I met teenagers and teachers with a history of resilience, migration, and adaptation. Fascinated by the mural of cultures, each little grain of salt in my vision embodied human connection, presenting roots and traditions with pride. My new communities were an open door to discover distinct salt flavor profiles.

Throughout my personal progress of adaptation with moving, I discovered my love for the range of policies, economies, and customs bounded in the world. Enamored by the study of international relations, my pursuit for educating on the states of societies, financial positions, dearth of rights, and extent of access to resources arrived naturally. In a similar way that I enhance my knowledge of salt's contributions, I am committed for my expatiating my passion towards diplomacy. Exhibiting my devotion for the protection of interests and sustaining peace, the epiphany of helping not just my home countries in the US and Mexico but vulnerable groups at developing countries became my mission.

At the gaze of a welcoming sun, I practice addressing and collaborating changes particularly towards the rights of children and teenagers in my community. Implementing the first UNICEF Club at my school and district, I advocate for young children that are underrepresented, mistreated, yet are equally deserving of education and a bright tomorrow. By promoting the organization's mission, I aspire to transform beyond fixed generational chains of knowledge. Similarly, my engagement with my state's Civic Education Coalition, enlarges my infatuation of governance, civic education, and establishing a democratic future. Through my continuous experience with domestic relationships, I prepare for connections and transformations at a larger global scale.

As a person with a close connection to salt, its presence revolutionized my life purpose. Now, every grain of salt is an insight of diversity in our world and human interactions. Appreciating the intricate connection between individuals and nations, salt awakened my passion for revealing paths with solutions. In fact, I consider salt's impact on Earth as an embodiment of motivation for building systematic change. Salt is truly a symbol of our globe's shared essence.`
    }
];
