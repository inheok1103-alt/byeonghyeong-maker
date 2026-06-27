/* 출제·변형 지식 데이터 (오프라인 기본값). 온라인이면 무료 API로 보강된다.
   브라우저에서는 전역 K, node에서는 module.exports 로 노출. */
var K = {
  SENTIMENT: {
    "기쁜·행복한": "happy joy joyful delighted glad pleased cheerful merry thrilled elated content delight wonderful smiling overjoyed",
    "들뜬·신난": "excited eager enthusiastic energetic lively animated exhilarated thrill festive playful",
    "슬픈·우울한": "sad sorrow unhappy depressed miserable gloomy heartbroken tearful melancholy grief mournful despair cry weep downcast",
    "두려운·불안한": "afraid fear scared frightened terrified nervous anxious worried uneasy tense apprehensive panic dread alarmed shaking trembling",
    "화난·짜증난": "angry anger furious annoyed irritated mad enraged frustrated resentful indignant upset outraged",
    "차분한·평온한": "calm peaceful relaxed serene tranquil composed quiet soothed restful gentle settled",
    "안도하는": "relieved relief reassured comforted finally safe secure",
    "놀란": "surprised astonished amazed shocked startled stunned astounded speechless",
    "자랑스러운·만족한": "proud pride satisfied accomplished fulfilled triumphant confident gratified",
    "실망한·낙담한": "disappointed discouraged dejected hopeless disheartened regret frustrated crestfallen",
    "외로운": "lonely alone isolated lonesome solitary abandoned",
    "감동한·고마운": "moved touched grateful thankful appreciative inspired heartwarming",
    "부끄러운·당황한": "embarrassed ashamed humiliated awkward flustered shy bashful",
    "지루한·무관심한": "bored indifferent uninterested weary dull tedious",
    "희망찬·기대하는": "hopeful optimistic expectant promising bright eager longing",
    "혼란스러운": "confused puzzled bewildered perplexed uncertain lost baffled",
    "질투·부러운": "jealous envious envy covetous",
    "후회·자책": "regret remorse guilty sorry ashamed",
    "결연한·의지": "determined resolute committed firm steadfast dedicated",
    "그리운·향수": "nostalgic homesick longing yearning"
  },
  PURPOSE: {
    "감사": "thank thanks grateful appreciate appreciation gratitude indebted",
    "사과": "sorry apologize apology regret apologies forgive inconvenience",
    "요청·부탁": "request kindly please appreciate grateful favor permission",
    "안내·공지": "inform announce notice notify schedule details information remind regarding update",
    "광고·홍보": "offer sale discount special product purchase deal limited introducing promotion",
    "초대": "invite invitation welcome celebrate ceremony attend reception gathering",
    "항의·불만": "complaint complain unfair unacceptable dissatisfied refund disappointed",
    "충고·권유": "should ought recommend suggest advise advice better encourage urge",
    "축하": "congratulations congratulate achievement award honored milestone",
    "격려·독려": "encourage cheer support believe achieve overcome motivate inspire",
    "경고·주의": "warning caution danger avoid careful risk hazard prohibited beware",
    "설득·주장": "must should believe argue important necessary essential convince persuade",
    "문의·질문": "wonder inquire whether question clarify",
    "거절·사양": "regret unable cannot decline unfortunately afraid"
  },
  ANTONYMS: {
    "increase":"decrease","decrease":"increase","rise":"fall","fall":"rise","expand":"shrink","shrink":"expand",
    "improve":"worsen","worsen":"improve","strengthen":"weaken","weaken":"strengthen","accept":"reject","reject":"accept",
    "include":"exclude","exclude":"include","allow":"prevent","prevent":"allow","encourage":"discourage","discourage":"encourage",
    "support":"oppose","oppose":"support","connect":"separate","separate":"connect","create":"destroy","destroy":"create",
    "gather":"scatter","scatter":"gather","remember":"forget","forget":"remember","appear":"disappear","disappear":"appear",
    "succeed":"fail","fail":"succeed","win":"lose","lose":"win","agree":"disagree","disagree":"agree","reveal":"conceal","conceal":"reveal",
    "expose":"hide","hide":"expose","unite":"divide","divide":"unite","advance":"retreat","praise":"criticize","criticize":"praise",
    "begin":"finish","raise":"lower","lower":"raise","maximize":"minimize","tighten":"loosen",
    "positive":"negative","negative":"positive","active":"passive","passive":"active","natural":"artificial","artificial":"natural",
    "similar":"different","different":"similar","common":"rare","rare":"common","simple":"complex","complex":"simple",
    "easy":"difficult","difficult":"easy","strong":"weak","weak":"strong","high":"low","low":"high","large":"small","small":"large",
    "wide":"narrow","narrow":"wide","fast":"slow","slow":"fast","early":"late","late":"early","ancient":"modern","modern":"ancient",
    "useful":"useless","useless":"useful","harmful":"harmless","visible":"invisible","invisible":"visible","possible":"impossible","impossible":"possible",
    "abstract":"concrete","concrete":"abstract","general":"specific","specific":"general","temporary":"permanent","permanent":"temporary",
    "internal":"external","external":"internal","major":"minor","minor":"major","flexible":"rigid","optimistic":"pessimistic","familiar":"strange",
    "majority":"minority","minority":"majority","presence":"absence","absence":"presence","benefit":"harm","harm":"benefit",
    "advantage":"disadvantage","growth":"decline","decline":"growth","order":"chaos","freedom":"restriction","success":"failure",
    "wealth":"poverty","demand":"supply","cause":"effect","question":"answer","profit":"loss","unity":"division"
  },
  CONFUSABLES: {
    "affect":"effect","effect":"affect","adapt":"adopt","adopt":"adapt","principal":"principle","principle":"principal",
    "economic":"economical","economical":"economic","sensible":"sensitive","sensitive":"sensible","respectful":"respective",
    "respective":"respectful","considerable":"considerate","considerate":"considerable","industrial":"industrious","industrious":"industrial",
    "imaginary":"imaginative","imaginative":"imaginary","successful":"successive","successive":"successful","literal":"literary","literary":"literal",
    "moral":"morale","personal":"personnel","personnel":"personal","conscience":"conscious","conscious":"conscience","device":"devise","devise":"device",
    "complement":"compliment","compliment":"complement","stationary":"stationery","stationery":"stationary","later":"latter","latter":"later",
    "desert":"dessert","loose":"lose","quiet":"quite","quite":"quiet","accept":"except","except":"accept","advice":"advise","advise":"advice",
    "breath":"breathe","breathe":"breath","elicit":"illicit","assure":"ensure","farther":"further"
  },
  SYNONYMS: {
    "important":"significant","significant":"crucial","crucial":"essential","big":"large","small":"tiny","help":"assist","assist":"aid",
    "show":"reveal","reveal":"demonstrate","make":"produce","produce":"generate","use":"utilize","begin":"start","start":"commence",
    "end":"conclude","increase":"grow","grow":"expand","reduce":"lower","idea":"concept","concept":"notion","problem":"issue","issue":"challenge",
    "result":"outcome","outcome":"consequence","method":"approach","approach":"strategy","effect":"impact","impact":"influence","change":"shift",
    "danger":"risk","risk":"threat","benefit":"advantage","advantage":"merit","research":"study","study":"investigation","evidence":"proof",
    "behavior":"conduct","natural":"innate","innate":"inherent","people":"individuals","money":"funds","job":"task","goal":"objective","objective":"aim",
    "happy":"content","sad":"unhappy","fast":"rapid","hard":"difficult","ability":"capacity","capacity":"capability","growth":"development",
    "control":"regulation","improve":"enhance","enhance":"boost","think":"believe","want":"desire","get":"obtain","obtain":"acquire",
    "find":"discover","keep":"maintain","maintain":"preserve","stop":"cease","choose":"select","need":"require","smart":"intelligent",
    "strong":"powerful","rich":"wealthy","old":"ancient","new":"novel","true":"accurate"
  },
  ABSTRACT_PHRASES: [
    "a lack of evidence","the opposite effect","a sense of belonging","the bigger picture","trial and error","cause and effect",
    "a turning point","common ground","long-term benefits","short-term gains","a matter of choice","the heart of the problem",
    "social cooperation","individual freedom","personal experience","scientific reasoning","an unexpected outcome","a deeper understanding",
    "mutual trust","shared responsibility","economic pressure","cultural difference","emotional support","physical effort","a fresh perspective",
    "the right balance","constant practice","careful planning","a false assumption","a natural process","human nature","a hidden cost",
    "the driving force","a double-edged sword","the bottom line","limited resources","endless possibilities","a vicious cycle","the root cause",
    "a key factor","a powerful tool","an open question","growing demand","rapid change","lasting impact","collective effort","personal growth"
  ],
  TOPIC_TEMPLATES: [
    "the importance of {a} in understanding {b}","how {a} influences {b}","the relationship between {a} and {b}",
    "why {a} matters for {b}","the role of {a} in {b}","{a} as a key to {b}","the connection between {a} and {b}",
    "the effect of {a} on {b}","ways that {a} shapes {b}","the value of {a} for {b}"
  ],
  TITLE_TEMPLATES: [
    "{A} and {B}: A Closer Look","Rethinking {A}: The Power of {B}","Why {A} Shapes {B}","{A}: More Than Meets the Eye",
    "The Hidden Link Between {A} and {B}","Understanding {A} Through {B}","{A}: A New Perspective","What {A} Teaches Us About {B}",
    "The Surprising Truth About {A}","{A} Matters More Than You Think"
  ],
  OFF_TOPICS: [
    "the history of ancient trade routes","tips for growing vegetables at home","the rules of a popular board game",
    "how to repair a bicycle tire","a review of a new smartphone model","the migration of arctic birds",
    "planning a budget for a family trip","the basics of classical music","the daily routine of a firefighter",
    "how to bake traditional bread","the design of medieval castles","training tips for marathon runners"
  ],
  IDIOMS: {
    "break the ice": {m:"to make people feel relaxed in a social situation", d:["to ruin a friendly mood","to refuse to speak first","to repeat a familiar story","to end a long argument"]},
    "turn back the clock": {m:"to return to an earlier time or condition", d:["to delay an easy decision","to measure time accurately","to plan for the future","to waste valuable time"]},
    "a piece of cake": {m:"something very easy to do", d:["a tasty reward","a difficult challenge","a small portion","an unfair share"]},
    "hit the books": {m:"to study hard", d:["to give up studying","to write a book","to relax after class","to lose one's notes"]},
    "under the weather": {m:"feeling slightly ill", d:["caught in a storm","in a great mood","outdoors all day","unsure about plans"]},
    "once in a blue moon": {m:"very rarely", d:["every single day","at midnight","during winter","without any reason"]},
    "the tip of the iceberg": {m:"a small visible part of a much larger problem", d:["a cold and distant place","the end of a journey","an easy first step","a clear final answer"]},
    "cost an arm and a leg": {m:"to be very expensive", d:["to be a great bargain","to cause an injury","to take a long time","to be freely given"]},
    "get out of hand": {m:"to become difficult to control", d:["to be handed over","to calm down quickly","to slip from a grip","to finish neatly"]},
    "on the same page": {m:"in agreement or sharing the same understanding", d:["reading the same book","in the same room","at the same speed","on the wrong track"]},
    "a blessing in disguise": {m:"a good thing that seemed bad at first", d:["a hidden danger","an obvious gift","a costly mistake","a religious symbol"]},
    "cut corners": {m:"to do something cheaply or carelessly to save effort", d:["to take the long way","to follow every rule","to improve quality","to turn sharply"]},
    "back to square one": {m:"back to the starting point with no progress", d:["at the final stage","ahead of schedule","in a new place","halfway finished"]},
    "see eye to eye": {m:"to agree completely", d:["to stare in anger","to meet in person","to look away","to compete fiercely"]},
    "in the long run": {m:"over a long period of time in the future", d:["right at this moment","during a race","for a short while","in the distant past"]},
    "draw the line": {m:"to set a limit on what is acceptable", d:["to make a drawing","to wait in a queue","to connect two points","to start a fight"]},
    "a double-edged sword": {m:"something with both good and bad effects", d:["a dangerous weapon","a fair decision","a useless tool","a clear advantage"]},
    "keep an eye on": {m:"to watch or monitor carefully", d:["to ignore completely","to fall asleep","to look for something lost","to close one's eyes"]},
    "pay off": {m:"to result in success after effort", d:["to lose money","to give up","to take a loan","to start over"]},
    "give up": {m:"to stop trying", d:["to lift upward","to keep going","to offer help","to grow taller"]},
    "carry out": {m:"to perform or complete a task", d:["to remove an object","to cancel a plan","to bring inside","to delay a duty"]},
    "come up with": {m:"to think of an idea or plan", d:["to climb higher","to arrive late","to agree fully","to run out of ideas"]},
    "look up to": {m:"to admire and respect someone", d:["to search online","to look toward the sky","to ignore advice","to feel superior"]},
    "run out of": {m:"to use up all of something", d:["to leave quickly","to gather more","to win a race","to escape danger"]},
    "stand out": {m:"to be clearly noticeable or impressive", d:["to wait outside","to blend in","to remain seated","to step back"]},
    "put off": {m:"to postpone or delay", d:["to switch on","to finish early","to take away","to dress up"]},
    "bring about": {m:"to cause something to happen", d:["to carry nearby","to prevent change","to talk about","to move around"]},
    "make up for": {m:"to compensate for something", d:["to invent a story","to apply cosmetics","to give up on","to add up numbers"]},
    "take for granted": {m:"to fail to appreciate something familiar", d:["to receive a gift","to be very thankful","to ask permission","to grant a wish"]},
    "go the extra mile": {m:"to make more effort than expected", d:["to take a shortcut","to travel far","to do the minimum","to give up early"]},
    "hit the nail on the head": {m:"to describe something exactly right", d:["to make a mistake","to build a house","to hurt oneself","to miss the point"]},
    "burn the midnight oil": {m:"to work or study late into the night", d:["to waste resources","to sleep early","to light a candle","to relax at home"]},
    "out of the blue": {m:"suddenly and unexpectedly", d:["after long planning","from the sky","in a sad mood","as expected"]},
    "the last straw": {m:"the final problem that makes a situation unbearable", d:["a lucky chance","the best choice","a small reward","the first sign"]}
  },
  PERSON_NOUNS: "people those anyone everyone someone person student students teacher teachers child children man men woman women friend friends author writer writers scientist scientists doctor doctors worker workers researcher researchers patient patients customer customers parent parents player players citizen citizens member members artist artists leader leaders employee employees".split(" "),
  GERUND_VERBS: "enjoy finish avoid mind consider suggest admit deny postpone practice quit recommend imagine risk involve include keep delay resist appreciate dislike escape miss".split(" "),
  IRREGULAR_PP: {make:"made",take:"taken",give:"given",write:"written",speak:"spoken",break:"broken",choose:"chosen",build:"built",find:"found",know:"known",grow:"grown",show:"shown",bring:"brought",buy:"bought",teach:"taught",think:"thought",see:"seen",leave:"left",hold:"held",drive:"driven",eat:"eaten",fall:"fallen",forget:"forgotten",hide:"hidden",ride:"ridden",steal:"stolen",wear:"worn",throw:"thrown",draw:"drawn",freeze:"frozen",beat:"beaten",bite:"bitten",send:"sent",spend:"spent",keep:"kept",feel:"felt",mean:"meant"},
  DEGREE_SWAP: {all:"few",few:"all",always:"never",never:"always",most:"some",some:"most",more:"less",less:"more",increase:"decrease",many:"no",everyone:"no one",everything:"nothing",both:"neither",often:"rarely",rarely:"often",usually:"seldom",majority:"minority",greater:"smaller",higher:"lower",faster:"slower",easier:"harder"},
  WORD_POS_BANK: {
    noun: "system process result effect factor reason method theory pattern source value benefit problem concept feature change quality nature aspect approach element structure context purpose evidence behavior society culture economy environment technology knowledge experience attention balance growth function role impact attitude resource strategy decision relationship community individual perception emotion memory ability progress tradition principle standard practice condition situation tendency".split(" "),
    verb: "increase reduce affect create produce explain reflect support reveal suggest require provide cause prevent improve maintain develop achieve involve replace describe contain expand consider determine influence encourage establish promote recognize represent demonstrate indicate generate measure observe perform respond transform adapt contribute distinguish emerge enable ensure express obtain pursue regard remain".split(" "),
    adj: "important natural complex basic similar useful possible serious common modern specific general positive negative limited recent particular significant relevant simple difficult clear major minor broad narrow obvious crucial essential effective efficient flexible stable visible familiar typical accurate reliable diverse distinct constant gradual potential practical reasonable remarkable sufficient consistent dominant".split(" "),
    adv: "however therefore moreover instead rather simply clearly mainly largely usually finally recently directly slightly strongly fully widely particularly significantly increasingly essentially relatively frequently eventually generally specifically naturally obviously primarily ultimately accordingly".split(" ")
  },
  CUE1: "however therefore thus moreover furthermore instead finally also yet although because this these those they it but so then meanwhile similarly likewise consequently nevertheless besides additionally first second third".split(" "),
  CUE2: ["in addition","in fact","in contrast","for example","for instance","as a result","on the other","in other words","in this","at first","for these"],
  GUIDELINES: {
    "목적 추론": {의도:"글쓴이의 의사소통 목적(안내·요청·감사·홍보 등)을 파악하는가.", 변형:"도입·맺음 문장의 어조 표현을 단서로 남기고 세부 정보는 배경으로.", 오답:"목적을 우리말로 제시, 인접 의도(안내↔홍보)를 매력 오답으로.", 유의:"소재가 아니라 글을 쓴 의도. 단정이 어려우면 서술형."},
    "심경 추론": {의도:"화자의 심경/심경 변화를 추론.", 변형:"감정 형용사·상황 묘사를 단서로(변화형 A→B).", 오답:"유사 감정·반대 감정을 섞는다.", 유의:"사건이 아니라 감정."},
    "주장 추론": {의도:"필자의 핵심 주장을 한 문장으로.", 변형:"should·must 등 당위 문장을 부각.", 오답:"부분 진술·일반 상식.", 유의:"글 전체를 포괄."},
    "함의 추론": {의도:"밑줄 관용·비유 표현의 함축 의미.", 변형:"관용어에 밑줄.", 오답:"표면적 직역·무관한 뜻.", 유의:"이 글에서의 의미."},
    "요지 추론": {의도:"글의 중심 생각.", 변형:"반복 핵심어·결론 문장 단서.", 오답:"지엽·확대해석.", 유의:"사실 나열이 아닌 주제."},
    "주제 추론": {의도:"중심 화제를 적정 범위로.", 변형:"핵심어 결합.", 오답:"너무 넓음/좁음·무관.", 유의:"글 전체 대표."},
    "제목 추론": {의도:"함축적 표제.", 변형:"핵심어+메시지.", 오답:"부분일치·과장.", 유의:"포괄적·매력적."},
    "내용 일치": {의도:"세부 정보 대조.", 변형:"선택지는 본문 순서대로.", 오답:"숫자·인과·부정·반의어 왜곡.", 유의:"본문 근거로만."},
    "내용 불일치": {의도:"어긋나는 진술 찾기.", 변형:"넷은 사실, 하나만 왜곡.", 오답:"왜곡도 문법은 자연.", 유의:"본문 순서대로."},
    "어법 추론": {의도:"관계사·분사·수일치·태·to부정사 변별.", 변형:"밑줄 5곳 서로 다른 영역.", 오답:"정답 외 4곳은 정확.", 유의:"한 곳만 명백히 오류."},
    "어휘 추론": {의도:"문맥상 낱말 적절성.", 변형:"반의어·혼동어 교체.", 오답:"같은 품사·유사 철자.", 유의:"문맥 단서로 판별."},
    "빈칸 추론": {의도:"글의 논리로 빈칸 추론.", 변형:"주제문 핵심 어구를 빈칸.", 오답:"같은 품사·비슷한 길이.", 유의:"글 전체 논리로 결정."},
    "무관한 문장": {의도:"통일성.", 변형:"주제어는 겹치되 논지 이탈.", 오답:"—", 유의:"앞뒤 단서로 식별."},
    "순서 추론": {의도:"응집성.", 변형:"연결사·지시어·대명사 단서.", 오답:"그럴듯한 오배열.", 유의:"첫 글 단서 명확."},
    "문장 삽입": {의도:"흐름.", 변형:"지시어·연결사로 앞뒤 단서.", 오답:"인접 위치.", 유의:"한 곳만 자연."},
    "요약문 완성하기": {의도:"재진술.", 변형:"(A)(B)에 동의어·상위어.", 오답:"—", 유의:"그대로 옮기지 않기."},
    "지칭 추론": {의도:"대명사 지시 대상.", 변형:"문두 인칭대명사.", 오답:"같은 글의 다른 명사.", 유의:"직전 문장 주어 우선."}
  }
};
/* 데이터 추가 축적 — 위 사전들에 병합 (knowledge.py 와 동기화) */
Object.assign(K.IDIOMS, {
  "the ball is in your court": {m:"it is now your turn to take action or decide", d:["the game has ended","you have lost a point","someone else will decide","the rules have changed"]},
  "kill two birds with one stone": {m:"to achieve two goals with a single action", d:["to harm two people at once","to waste time and money","to make a difficult choice","to repeat the same task"]},
  "bite the bullet": {m:"to face a difficult situation bravely", d:["to refuse a hard task","to act without thinking","to chew very slowly","to complain loudly"]},
  "on cloud nine": {m:"extremely happy", d:["high in the sky","lost in thought","very confused","deeply worried"]},
  "spill the beans": {m:"to reveal a secret", d:["to waste food","to make a mess","to keep quiet","to start cooking"]},
  "the elephant in the room": {m:"an obvious problem that people avoid discussing", d:["a very large animal","a crowded place","a tiny detail","a popular topic"]},
  "beat around the bush": {m:"to avoid talking about the main point", d:["to search in a garden","to speak very directly","to lose an argument","to walk in circles"]},
  "call it a day": {m:"to stop working for the day", d:["to name an event","to start a new project","to take a short break","to check the time"]},
  "get cold feet": {m:"to become nervous and hesitate before doing something", d:["to feel physically cold","to act with confidence","to walk in the snow","to fall asleep"]},
  "in a nutshell": {m:"in a brief and simple way", d:["in great detail","inside a small box","with much difficulty","in a confusing manner"]},
  "jump on the bandwagon": {m:"to join a popular trend", d:["to start a parade","to reject an idea","to lead a movement","to leave a group"]},
  "let sleeping dogs lie": {m:"to avoid disturbing a situation that could cause trouble", d:["to take a long nap","to solve a problem now","to wake everyone up","to tell the truth"]},
  "the best of both worlds": {m:"a situation combining the advantages of two different things", d:["a difficult decision","the worst possible result","a faraway planet","an unfair contest"]},
  "throw in the towel": {m:"to give up", d:["to clean the floor","to start a fight","to win a match","to offer help"]},
  "add fuel to the fire": {m:"to make a bad situation worse", d:["to solve a conflict","to light a candle","to warm a house","to calm someone down"]},
  "wrap your head around": {m:"to manage to understand something difficult", d:["to wear a hat","to forget completely","to feel dizzy","to ignore a problem"]},
  "back to the drawing board": {m:"to start planning again after a failure", d:["to finish a drawing","to reach a final answer","to return home","to take an art class"]},
  "pull yourself together": {m:"to regain control of your emotions", d:["to gather your things","to fall apart","to exercise hard","to stand up straight"]}
});
Object.assign(K.ANTONYMS, {
  "praise":"blame","blame":"praise","reward":"punish","punish":"reward","attract":"repel","repel":"attract",
  "permit":"forbid","forbid":"permit","import":"export","export":"import","ascend":"descend","descend":"ascend",
  "construct":"demolish","transparent":"opaque","opaque":"transparent","abundant":"scarce","scarce":"abundant",
  "fertile":"barren","barren":"fertile","vague":"precise","precise":"vague","humble":"arrogant","arrogant":"humble",
  "generous":"selfish","selfish":"generous","brave":"cowardly","cowardly":"brave","public":"private","private":"public",
  "voluntary":"compulsory","compulsory":"voluntary","emerge":"vanish","vanish":"emerge","tame":"wild","wild":"tame"
});
Object.assign(K.SYNONYMS, {
  "huge":"enormous","tiny":"minute","quick":"swift","clever":"smart","brave":"courageous","calm":"peaceful",
  "angry":"furious","famous":"renowned","strange":"peculiar","wealthy":"affluent","poor":"impoverished",
  "modern":"contemporary","difficult":"demanding","easy":"effortless","begin":"initiate","answer":"respond",
  "build":"construct","destroy":"ruin","protect":"safeguard","allow":"permit"
});

/* 분야별 콜로케이션·예문 (워크플로우 생성·검수, 자동 생성됨) */
K.COLLOCATIONS = ["conduct research", "carry out an experiment", "test a hypothesis", "collect data", "analyze the results", "draw a conclusion", "scientific evidence", "peer review", "control group", "research findings", "the scientific method", "make a discovery", "publish a study", "observe a phenomenon", "form a theory", "review the literature", "verify the results", "a controlled experiment", "express emotion", "cope with stress", "regulate emotions", "ease anxiety", "boost self-esteem", "overcome fear", "manage anger", "relieve tension", "trigger a response", "shape behavior", "feel overwhelmed", "build resilience", "process grief", "calm the mind", "lift one's mood", "control impulses", "deal with frustration", "seek support", "cultural diversity", "social norms", "cultural heritage", "social identity", "shared values", "cultural background", "ethnic minority", "social change", "popular culture", "cultural identity", "social structure", "preserve traditions", "cultural exchange", "social inequality", "collective identity", "respect differences", "cultural practices", "social cohesion", "supply and demand", "make a profit", "cut costs", "launch a product", "enter the market", "raise prices", "boost sales", "create jobs", "run a business", "meet demand", "attract investors", "expand abroad", "go bankrupt", "build a brand", "increase productivity", "negotiate a deal", "gain market share", "stimulate growth", "climate change", "global warming", "greenhouse gas emissions", "renewable energy", "fossil fuels", "carbon footprint", "natural resources", "endangered species", "preserve biodiversity", "protect the environment", "reduce waste", "air pollution", "rising sea levels", "conserve energy", "sustainable development", "ecosystem balance", "recycle materials", "social media platform", "spread of misinformation", "digital technology", "streaming service", "online content", "share information", "internet access", "screen time", "media literacy", "go viral", "smart device", "mobile application", "data privacy", "news outlet", "stay connected", "search engine", "personal data", "instant messaging", "acquire knowledge", "develop skills", "take an exam", "do homework", "attend a lecture", "pass a course", "memorize facts", "ask a question", "solve a problem", "review notes", "take notes", "set a goal", "make progress", "give feedback", "improve performance", "learn a language", "broaden one's horizons", "apply for college", "chronic illness", "immune system", "side effects", "balanced diet", "physical activity", "blood pressure", "mental health", "medical treatment", "prevent disease", "make a diagnosis", "prescribe medication", "boost immunity", "public health", "clinical trial", "ease the symptoms", "regular check-up", "lower the risk", "recover from surgery", "the passage of time", "over the course of time", "as time goes by", "stand the test of time", "a turning point", "undergo a transformation", "adapt to change", "bring about change", "a gradual shift", "a lasting impact", "fade over time", "the pace of change", "embrace change", "a temporary phase", "change over time", "a fleeting moment", "close friend", "spend time together", "make friends", "keep in touch", "get along with", "have an argument", "share a meal", "do household chores", "run errands", "stay up late", "build trust", "settle a disagreement", "give advice", "lend a hand", "take care of", "catch up with"];
K.FIELD_EXAMPLES = {"과학·연구": ["Scientists conduct research to understand how the natural world functions and to solve real problems.", "Before accepting a theory, researchers test their hypothesis through carefully designed and repeated experiments.", "A controlled experiment uses a control group so that scientists can measure the effect of one variable.", "When researchers analyze the results, they look for clear patterns hidden within large amounts of data.", "Reliable conclusions depend on scientific evidence that other experts can examine and reproduce.", "Peer review allows independent scientists to check a study before it is published in a journal.", "The scientific method encourages people to question assumptions and to gather evidence rather than guess.", "Researchers often review the literature to learn what previous studies have already discovered about a topic.", "A single experiment rarely proves anything, so scientists repeat their work to verify the results.", "Careful observation of a phenomenon can lead to a discovery that changes how we understand nature."], "감정·심리": ["People often hide their true feelings because they fear being judged by those around them.", "Regular exercise can reduce anxiety and help the brain release chemicals that improve mood.", "When we feel stressed, our heart beats faster and our muscles become noticeably tense.", "Talking openly about worries with a trusted friend can ease emotional pain and build trust.", "Children gradually learn to manage their anger by watching how adults handle difficult situations.", "A positive mindset helps people stay calm and recover more quickly from painful setbacks.", "Strong emotions like fear and joy can shape the decisions we make every single day.", "Practicing gratitude each morning tends to boost self-esteem and lift a person's overall mood.", "Deep breathing slows the heart rate and helps the mind relax during moments of panic.", "Empathy allows us to understand the feelings of others and respond with genuine kindness."], "사회·문화": ["Cultural diversity enriches a society by introducing new ideas, customs, and ways of seeing the world.", "Social norms shape how people behave, often without anyone questioning where these unwritten rules come from.", "Many communities work hard to preserve traditions that connect younger generations to their cultural heritage.", "People from different cultural backgrounds may interpret the same gesture in surprisingly contrasting ways.", "Shared values help hold a community together, even when its members disagree on smaller matters.", "Globalization spreads popular culture quickly, allowing music and films to cross borders within hours.", "Respecting differences among people fosters social cohesion and reduces unnecessary conflict in diverse neighborhoods.", "Language reflects cultural identity, so losing a language often means losing a unique way of thinking.", "Social inequality persists when certain groups lack equal access to education, healthcare, and opportunity.", "Festivals offer a meaningful chance for cultural exchange, letting strangers share food, stories, and laughter."], "경제·경영": ["When demand for a product rises faster than supply, prices tend to increase until the market reaches a new balance.", "Many small businesses struggle to make a profit during their first few years because they must cover heavy start-up costs.", "Companies often cut costs by automating routine tasks, though this can sometimes reduce the number of available jobs.", "A strong brand allows a firm to charge higher prices because loyal customers trust the quality of its goods.", "Investors usually compare the risks and rewards carefully before they decide where to put their money.", "When a country lowers taxes on businesses, some economists argue that this helps stimulate growth and create jobs.", "Firms that fail to meet the changing needs of consumers may quickly lose market share to newer competitors.", "Advertising aims to boost sales by persuading people that a particular product will improve their daily lives.", "Global trade allows companies to buy cheaper materials abroad and sell their finished products to a wider market.", "A sudden rise in unemployment often reduces consumer spending, which can slow down the entire economy."], "환경·자연": ["Burning fossil fuels releases greenhouse gases that gradually warm the planet and disrupt natural weather patterns.", "Forests absorb carbon dioxide from the air and provide a home for countless plant and animal species.", "Renewable energy from sunlight and wind produces electricity without polluting the surrounding air and water.", "Recycling paper, glass, and plastic helps reduce waste and conserves the limited resources our planet offers.", "Rising temperatures cause polar ice to melt, which slowly raises sea levels around coastal regions.", "Protecting endangered species requires preserving the natural habitats where they find food and safely raise their young.", "Air pollution from factories and vehicles harms human health and damages delicate ecosystems over time.", "Planting trees and reducing energy use are simple ways ordinary people can lower their carbon footprint.", "Healthy oceans support a rich variety of life and help regulate the temperature of the entire planet.", "Sustainable farming protects the soil and water so that future generations can still grow enough food."], "기술·매체": ["Social media platforms allow people to share information instantly with friends and followers around the world.", "Many teenagers spend hours of screen time each day watching videos and browsing online content.", "The rapid spread of misinformation online makes media literacy an essential skill for young students.", "Streaming services let users watch films and listen to music without downloading any large files.", "Smart devices collect personal data, so users should pay close attention to their privacy settings.", "A search engine helps people find reliable information among millions of pages on the internet.", "Mobile applications make it easy to stay connected with family even when they live far away.", "When a short video goes viral, it can reach millions of viewers within a single day.", "Reliable news outlets check their facts carefully before they publish stories for the public.", "Limited internet access in some regions still prevents many students from joining online classes."], "교육·학습": ["Students who review their notes regularly tend to remember information far longer than those who do not.", "A good teacher encourages learners to ask questions instead of simply memorizing facts for an exam.", "Setting clear goals helps students make steady progress and stay motivated throughout the school year.", "Learning a new language broadens your horizons and helps you understand other cultures more deeply.", "Many schools now use technology to help students develop skills that they will need in the future.", "Regular feedback from a teacher allows learners to correct their mistakes and improve their performance.", "Reading widely is one of the best ways to acquire knowledge across many different subjects.", "Working in groups teaches students how to share ideas and solve problems together effectively.", "Curiosity drives people to explore new topics and keep learning long after they leave school.", "Practicing a skill a little every day usually produces better results than studying for many hours at once."], "건강·의학": ["A balanced diet and regular exercise help strengthen the immune system and prevent many common diseases.", "Doctors often advise patients to lower their blood pressure by reducing salt and managing daily stress.", "Many medications produce side effects, so people should follow the prescribed dose with great care.", "Getting enough sleep each night supports both mental health and the body's ability to fight infection.", "Regular check-ups allow doctors to detect health problems early and begin treatment before they grow serious.", "Washing your hands often is a simple habit that helps prevent the spread of harmful bacteria.", "Chronic illnesses such as diabetes require careful diet, steady exercise, and ongoing medical treatment over time.", "Vaccines train the immune system to recognize and destroy dangerous viruses before they cause severe disease.", "Drinking enough water keeps the body hydrated and supports healthy digestion, circulation, and clear thinking.", "Smoking damages the lungs and raises the risk of heart disease, so quitting greatly improves overall health."], "시간·변화": ["As time goes by, traditions slowly fade and new customs take their place in society.", "The passage of time changes how people remember even their most important shared experiences.", "Cities undergo a constant transformation as old buildings give way to modern structures.", "People who adapt to change tend to feel less stress when their circumstances shift suddenly.", "A single turning point in someone's life can alter the direction of their entire future.", "Small habits, repeated daily over the course of time, gradually shape a person's character.", "Some friendships stand the test of time, while others slowly fade after years apart.", "The pace of change in technology often makes older devices feel outdated within a few years.", "A gradual shift in climate affects which crops farmers can grow in a region.", "Even a fleeting moment of kindness can leave a lasting impact on a stranger's day."], "일상·인간관계": ["Good friends often spend time together and support each other through difficult moments in their lives.", "Many people run errands on weekends so they can relax during the busy workweek ahead.", "Sharing a meal with family helps members stay connected and talk about their daily experiences.", "Honest communication builds trust and makes relationships stronger over time among close friends.", "When neighbors lend a hand, everyday tasks become easier and the community grows friendlier.", "Most students wake up early to prepare for school and finish their morning routines on time.", "Couples who settle disagreements calmly usually keep their relationship healthy and respectful for years.", "People often keep in touch with old friends through messages, calls, and occasional visits.", "Doing household chores together teaches children responsibility and helps the whole family work as a team.", "In their spare time, many teenagers enjoy hobbies that let them relax and make new friends."]};
if (typeof module !== "undefined" && module.exports) module.exports = K;
