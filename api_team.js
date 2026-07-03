/* 무료 API 베스트팀 (Free API Dream Team) · api_team.js
 * 영어 내신/수능 — 지문 변형·문제 출제·단어장. 전원 무료·무키·CORS.
 * 설계: 단계를 잘게 미분화(이해→정답→역할별 오답→검증). LLM 호출은 자동 직렬화.
 * window.APITEAM. */
(function () {
  "use strict";
  var ROSTER = [
    { key: "llm", name: "수석 출제관", member: "Pollinations · GPT-OSS 20B", role: "단계별 생성·종합(무키 LLM)", url: "https://text.pollinations.ai/openai" },
    { key: "grammar", name: "어법 검수관", member: "LanguageTool", role: "영어 어법 검증", url: "https://api.languagetool.org/v2/check" },
    { key: "thesaurus", name: "오답 설계관", member: "Datamuse", role: "반의어(어휘교체)·동의어(중복차단)", url: "https://api.datamuse.com/words" },
    { key: "dict", name: "사전 담당", member: "Free Dictionary", role: "정의·예문", url: "https://api.dictionaryapi.dev" },
    { key: "wikt", name: "어원 담당", member: "Wiktionary REST", role: "품사·어원", url: "https://en.wiktionary.org/api/rest_v1" },
    { key: "wiki", name: "배경지식 담당", member: "Wikipedia REST", role: "주제 배경", url: "https://en.wikipedia.org/api/rest_v1" },
    { key: "trans", name: "번역 검수관", member: "MyMemory", role: "한국어 뜻 교차검증", url: "https://api.mymemory.translated.net/get" },
    { key: "image", name: "삽화 디자이너", member: "Pollinations Image (FLUX)", role: "개념 삽화", url: "https://image.pollinations.ai" }
  ];
  var BEST_TYPES = ["어법", "어휘", "빈칸", "주제", "제목", "함의", "요약", "내용불일치", "서술형"];
  // 자기개선 레이어 상태
  var RUNHINT = "", STANDING = "", TYPERULE = "", LEVELRULE = "", DIFF = null, ERRLOG = [], MEETINGS = [], LOGURL = "", CB = {}, USE_ENSEMBLE = false;
  // 목표 정체성: '한 명의 출제자 뇌' — 임용 통과 최상위 영어교사(짧게: 긴 한국어 system은 소형모델 빈응답 유발)
  var EXPERT_ID = "너는 임용고시를 통과한 최상위권 고등학교 영어 교사이자 수능·내신 출제 전문가다.";

  function withTimeout(ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms || 45000); return { signal: c.signal, done: function () { clearTimeout(t); } }; }
  async function getJSON(url, ms) { var to = withTimeout(ms); try { return await (await fetch(url, { signal: to.signal })).json(); } finally { to.done(); } }
  function log(cb, m) { if (typeof cb === "function") try { cb(m); } catch (_) {} }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rint(n) { return Math.floor(Math.random() * n); }

  /* ---------- LLM 공급자 (키리스 기본 + 선택 무료키 업그레이드) ----------
   * 키 미입력 → Pollinations(무키). Gemini/Groq '무료키' 입력 시 그쪽으로 라우팅.
   * 키는 사용자 브라우저(localStorage)에만 저장 — 공개 코드엔 절대 안 들어감. */
  var CFG = { geminiKey: "", groqKey: "", geminiModel: "gemini-2.5-flash", groqModel: "llama-3.3-70b-versatile" };
  function configure(c) { c = c || {}; Object.assign(CFG, c); if (c.logUrl != null) LOGURL = c.logUrl; if (c.onMeeting) CB.onMeeting = c.onMeeting; if (c.onError) CB.onError = c.onError; if (c.onLearn) CB.onLearn = c.onLearn; }
  function provider() { return CFG.geminiKey ? "gemini" : (CFG.groqKey ? "groq" : "pollinations"); }
  var LAST_LIMITED = false;   // 직전 호출이 레이트리밋이었는지(진단·UI용)
  async function llmRaw(messages, opts) {
    opts = opts || {}; var prov = opts.forceProvider || provider(); var to = withTimeout(opts.timeout || 70000);
    try {
      if (prov === "gemini") {
        var sys = messages.filter(function (m) { return m.role === "system"; }).map(function (m) { return m.content; }).join("\n");
        var rest = messages.filter(function (m) { return m.role !== "system"; }).map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }; });
        var body = { contents: rest, generationConfig: { temperature: opts.temperature == null ? 0.6 : opts.temperature } };
        if (opts.json) body.generationConfig.responseMimeType = "application/json";
        if (sys) body.systemInstruction = { parts: [{ text: sys }] };
        var rg = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + CFG.geminiModel + ":generateContent?key=" + encodeURIComponent(CFG.geminiKey), { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify(body) });
        var dg = await rg.json();
        if (dg.error) { var gm = String((dg.error && dg.error.message) || ""); if (/quota|rate|429|exhausted|high demand|503/i.test(gm) || dg.error.code === 429 || dg.error.code === 503) LAST_LIMITED = true; throw new Error("gemini: " + gm.slice(0, 80)); }
        return (dg.candidates && dg.candidates[0] && dg.candidates[0].content && dg.candidates[0].content.parts && dg.candidates[0].content.parts[0].text) || "";
      }
      if (prov === "groq") {
        var gbody = { model: CFG.groqModel, messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature };
        if (opts.json) gbody.response_format = { type: "json_object" };   // 유효 JSON 강제 → 파싱실패·빈응답 격감
        var rq = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.groqKey }, signal: to.signal, body: JSON.stringify(gbody) });
        var dq = await rq.json();
        if (dq.error) { var em = String((dq.error && dq.error.message) || ""); if (/rate limit|quota|too many|429/i.test(em)) { LAST_LIMITED = true; } throw new Error("groq: " + em.slice(0, 80)); }
        return (dq.choices && dq.choices[0] && dq.choices[0].message && dq.choices[0].message.content) || "";
      }
      // Pollinations는 response_format 미지원(보내면 오류) → 프롬프트의 'JSON만' 지시에 의존
      var pbody = { model: "openai", messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature, seed: opts.seed, private: true };
      var r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify(pbody) });
      var d = await r.json();
      if (d && d.error) { var pm = String((d.error && d.error.message) || d.error); if (/rate|quota|429|exhausted|budget|time/i.test(pm)) LAST_LIMITED = true; throw new Error("pollinations: " + pm.slice(0, 80)); }
      return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
    } finally { to.done(); }
  }
  async function llmWithRetry(messages, opts) {
    for (var i = 0; i < 4; i++) { LAST_LIMITED = false; var s = await llmRaw(messages, opts).catch(function () { return ""; }); if (s && s.trim()) return s; if (LAST_LIMITED) break; await delay(1200 * (i + 1)); }
    return "";
  }
  var _llmQ = Promise.resolve();
  // Pollinations 직렬 큐(동시성 불가) — 폴백에도 사용
  function pollSerial(messages, opts) {
    var o = Object.assign({}, opts, { forceProvider: "pollinations" });
    var p = _llmQ.then(function () { return llmWithRetry(messages, o); }, function () { return llmWithRetry(messages, o); });
    _llmQ = p.then(function () { return delay(300); }, function () { return delay(300); });
    return p;
  }
  // 연결된 공급자 폴백 체인: Gemini(키) → Groq(키) → Pollinations(무료). 앞이 실패/레이트리밋이면 다음으로.
  function providerChain() { var c = []; if (CFG.geminiKey) c.push("gemini"); if (CFG.groqKey) c.push("groq"); c.push("pollinations"); return c; }
  async function tryChain(messages, opts, chain, i) {
    if (i >= chain.length) return "";
    var prov = chain[i], o = Object.assign({}, opts, { forceProvider: prov });
    var s = (prov === "pollinations") ? await pollSerial(messages, o) : await llmWithRetry(messages, o).catch(function () { return ""; });
    if (s && s.trim()) return s;
    return tryChain(messages, opts, chain, i + 1);   // 다음 공급자로 폴백
  }
  function llm(messages, opts) {
    opts = opts || {};
    var sysadd = "";
    if (!opts.noRule) {
      if (TYPERULE) sysadd += "\n[이 유형의 수능 출제 규칙 — 반드시 준수] " + TYPERULE;
      if (LEVELRULE) sysadd += "\n" + LEVELRULE;
      if (KB && KB.core) sysadd += "\n[출제 대원칙(지식베이스)] " + KB.core;   // 5대 대원칙 + 매력적 오답 설계 원리
      var extra = [STANDING, RUNHINT].filter(Boolean).join(" / ");
      if (extra) sysadd += "\n[누적·회의 개선지침] " + extra;
    }
    if (sysadd) {
      var hasSys = messages.some(function (m) { return m.role === "system"; });
      messages = hasSys ? messages.map(function (m) { return m.role === "system" ? { role: "system", content: m.content + sysadd } : m; })
        : [{ role: "system", content: sysadd.trim() }].concat(messages);
    }
    return tryChain(messages, opts, providerChain(), 0);
  }
  async function llmJSON(messages, opts) { opts = opts || {}; opts.json = true; return extractJSON(await llm(messages, opts)); }
  function extractJSON(raw) {
    if (!raw) return null;
    raw = String(raw).replace(/```json/gi, "```").replace(/```/g, "").trim();
    var cand = [], s = raw.indexOf("["), e = raw.lastIndexOf("]"), s2 = raw.indexOf("{"), e2 = raw.lastIndexOf("}");
    if (s !== -1 && e > s) cand.push([s, raw.slice(s, e + 1)]);
    if (s2 !== -1 && e2 > s2) cand.push([s2, raw.slice(s2, e2 + 1)]);
    cand.sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < cand.length; i++) { try { return JSON.parse(cand[i][1]); } catch (_) {} }
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function clean1(s) { return String(s || "").replace(/```/g, "").replace(/^\s*[-*\d.]+\s*/, "").replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0].trim(); }
  async function ask(prompt, sys, opts) { return clean1(await llm([{ role: "system", content: sys || "간결하게 답만 출력. 설명·따옴표·마크다운 금지." }, { role: "user", content: prompt }], Object.assign({ temperature: 0.4, timeout: 50000 }, opts || {}))); }

  /* ===== 뉴럴 메시: 뉴런=API/모드, 시냅스=데이터 흐름(극한 상호연결) ===== */
  var MESH = (function () {
    var N = [
      { key: "ds_syn", name: "동의어", group: "입력", api: "Datamuse" }, { key: "ds_ant", name: "반의어", group: "입력", api: "Datamuse" },
      { key: "ds_trg", name: "연상어", group: "입력", api: "Datamuse" }, { key: "ds_gen", name: "상위어", group: "입력", api: "Datamuse" },
      { key: "ds_spc", name: "하위어", group: "입력", api: "Datamuse" }, { key: "ds_jja", name: "수식형용사", group: "입력", api: "Datamuse" },
      { key: "ds_hom", name: "동음이의", group: "입력", api: "Datamuse" }, { key: "ds_bg", name: "앞뒤연어", group: "입력", api: "Datamuse" },
      { key: "dict_def", name: "정의", group: "입력", api: "Free Dictionary" }, { key: "dict_ex", name: "예문", group: "입력", api: "Free Dictionary" },
      { key: "dict_pron", name: "발음", group: "입력", api: "Free Dictionary" }, { key: "wikt_ety", name: "어원", group: "입력", api: "Wiktionary" },
      { key: "wiki_bg", name: "배경지식", group: "입력", api: "Wikipedia" }, { key: "gbooks", name: "실제용례", group: "입력", api: "Google Books" },
      { key: "trans_ko", name: "한국어뜻", group: "입력", api: "MyMemory" },
      { key: "ds_bga", name: "앞연어", group: "입력", api: "Datamuse" }, { key: "ds_bgb", name: "뒤연어", group: "입력", api: "Datamuse" },
      { key: "ds_jjb", name: "형용사연상", group: "입력", api: "Datamuse" }, { key: "ds_sp", name: "철자변형", group: "입력", api: "Datamuse" },
      { key: "wiki_rel", name: "관련주제", group: "입력", api: "Wikipedia" }, { key: "wikidata", name: "구조화사실", group: "입력", api: "Wikidata" },
      { key: "openlib", name: "도서정보", group: "입력", api: "OpenLibrary" }, { key: "poetry", name: "문학용례", group: "입력", api: "PoetryDB" },
      { key: "ds_rhy", name: "운율", group: "입력", api: "Datamuse" }, { key: "word_freq", name: "빈도난이도", group: "입력", api: "Datamuse" },
      { key: "wikiquote", name: "인용문", group: "입력", api: "Wikiquote" }, { key: "wikisrc", name: "문학원문", group: "입력", api: "Wikisource" },
      { key: "gh_cefr", name: "CEFR등급", group: "학습DB", api: "CEFR-J(GitHub)" }, { key: "gh_synant", name: "유의반의", group: "학습DB", api: "Fernald(GitHub)" },
      { key: "gh_phrasal", name: "구동사", group: "학습DB", api: "phrasal-verbs(GitHub)" }, { key: "gh_gec", name: "어법오류패턴", group: "학습DB", api: "JFLEG(GitHub)" },
      { key: "gh_freq", name: "상용어빈도", group: "학습DB", api: "google-10k(GitHub)" }, { key: "gh_corpus", name: "원서코퍼스", group: "학습DB", api: "원서·카톡(로컬)" },
      { key: "gh_books", name: "교재DB582", group: "학습DB", api: "이인혁 마스터DB" },
      { key: "llm_main", name: "핵심논지", group: "이해", api: "Pollinations" }, { key: "llm_ans", name: "정답작성", group: "생성", api: "Pollinations" },
      { key: "llm_dis", name: "오답설계", group: "생성", api: "Pollinations" },
      { key: "critic", name: "선지검수관", group: "검증", api: "Pollinations" }, { key: "grammar", name: "어법검수", group: "검증", api: "LanguageTool" },
      { key: "ds_dup", name: "중복차단", group: "검증", api: "Datamuse" }, { key: "trans_chk", name: "번역검증", group: "검증", api: "MyMemory" },
      { key: "colloc_chk", name: "연어검증", group: "검증", api: "Datamuse" },
      { key: "meeting", name: "API회의", group: "피드백", api: "Pollinations" }, { key: "image", name: "삽화", group: "출력", api: "Pollinations Image" }
    ];
    var inputs = N.filter(function (n) { return n.group === "입력"; }).map(function (n) { return n.key; });
    var S = [];
    inputs.forEach(function (k) { S.push([k, "llm_main"]); });                       // 모든 입력 → 핵심논지
    inputs.forEach(function (k) { if (/^ds_|^dict_|gbooks/.test(k)) S.push([k, "llm_dis"]); }); // 어휘성 입력 → 오답설계
    ["ds_syn", "ds_ant", "ds_trg", "dict_def", "gbooks", "wiki_bg"].forEach(function (k) { S.push([k, "llm_ans"]); }); // 정답작성 보강
    S.push(["llm_main", "llm_ans"], ["llm_ans", "llm_dis"]);
    S.push(["llm_dis", "ds_dup"], ["llm_dis", "critic"], ["llm_ans", "critic"]);
    S.push(["critic", "grammar"], ["grammar", "critic"], ["llm_ans", "trans_chk"], ["trans_chk", "critic"]);
    S.push(["grammar", "meeting"], ["ds_dup", "meeting"], ["critic", "meeting"], ["meeting", "llm_main"], ["meeting", "llm_dis"]);
    S.push(["llm_main", "image"], ["wiki_bg", "image"]);
    // 신규 뉴런 시냅스: 연어→어법/연어검증→검수, 지식→정답/오답/삽화
    S.push(["ds_bga", "grammar"], ["ds_bgb", "grammar"], ["ds_bga", "colloc_chk"], ["ds_bgb", "colloc_chk"], ["colloc_chk", "critic"], ["colloc_chk", "llm_ans"], ["colloc_chk", "meeting"]);
    S.push(["wiki_rel", "llm_ans"], ["wiki_rel", "image"], ["wikidata", "llm_ans"], ["wikidata", "llm_dis"], ["openlib", "llm_dis"], ["poetry", "llm_dis"], ["poetry", "llm_ans"]);
    // 운율·빈도난이도·인용문·문학원문
    S.push(["ds_rhy", "llm_dis"], ["word_freq", "critic"], ["word_freq", "llm_dis"], ["wikiquote", "llm_ans"], ["wikiquote", "llm_main"], ["wikisrc", "llm_dis"]);
    // GitHub 학습DB를 API 뉴런과 엮음(신경다발)
    var learndb = N.filter(function (n) { return n.group === "학습DB"; }).map(function (n) { return n.key; });
    learndb.forEach(function (k) { S.push([k, "llm_main"]); });
    S.push(["gh_cefr", "critic"], ["gh_cefr", "word_freq"], ["gh_freq", "gh_cefr"]);
    S.push(["gh_synant", "llm_dis"], ["gh_synant", "ds_dup"], ["gh_synant", "critic"], ["gh_synant", "ds_ant"]);
    S.push(["gh_phrasal", "llm_ans"], ["gh_phrasal", "llm_dis"], ["gh_phrasal", "dict_def"]);
    S.push(["gh_gec", "grammar"], ["gh_gec", "critic"], ["gh_gec", "llm_ans"]);
    S.push(["gh_corpus", "llm_main"], ["gh_corpus", "image"], ["gh_corpus", "wiki_bg"]);
    S.push(["gh_books", "llm_main"], ["gh_books", "critic"], ["gh_books", "meeting"]);
    return { neurons: N, synapses: S, groups: ["입력", "학습DB", "이해", "생성", "검증", "피드백", "출력"], roster: ROSTER };
  })();
  function topology() {
    var deg = {}; MESH.neurons.forEach(function (n) { deg[n.key] = 0; });
    MESH.synapses.forEach(function (e) { deg[e[0]] = (deg[e[0]] || 0) + 1; deg[e[1]] = (deg[e[1]] || 0) + 1; });
    return { neurons: MESH.neurons.length, synapses: MESH.synapses.length,
      byNeuron: MESH.neurons.map(function (n) { return { key: n.key, name: n.name, api: n.api, group: n.group, degree: deg[n.key] }; }).sort(function (a, b) { return b.degree - a.degree; }) };
  }
  // ===== 뇌 구조 + 역할 분담: 각 뉴런/기능을 실제 뇌 영역으로 매핑(조직도·3D 시각화용) =====
  var BRAIN = [
    { region: "간뇌 · 시상(라우팅)", anat: "Diencephalon/Thalamus", fn: "감각 입력 라우팅·주의 게이팅·항상성(자가학습 트리거)", group: "간뇌", pos: [0, 0.35, 0.05],
      roles: ["입력 라우팅관 — 어떤 자료 API를 활성화할지 결정", "게이팅관 — 속도(빠른/정밀)·유형별 필요 자료 선택", "항상성관 — 유휴 시 자가학습 루프 기동"],
      harness: ["① 지문 수신·토큰화·내용어 추출", "② 유형별 필요 자료 결정(라우팅 테이블)", "③ 감각피질 API군 활성화 신호", "④ 대뇌피질(이해)로 전달"] },
    { region: "감각·지각 피질", anat: "Sensory Cortex", fn: "외부 지식을 받아들여 지각", group: "입력", pos: [0, 1.1, 0.2],
      roles: ["자료조사관 — Datamuse(동의·반의·연상·상하위·수식·연어·철자·운율)", "사전관 — Free Dictionary(정의·예문·발음)", "어원관 — Wiktionary", "배경지식관 — Wikipedia·Wikidata·OpenLibrary·PoetryDB·Wikiquote·Wikisource", "난이도지각관 — CEFR·코퍼스 빈도", "한국어뜻관 — MyMemory"],
      harness: ["① 내용어 8개 선별", "② Datamuse 12모드 병렬 호출(동의/반의/연상/상하위/연어/철자/운율…)", "③ 사전·어원·발음 병렬", "④ 위키·Wikidata·도서·인용 배경 병렬", "⑤ CEFR·빈도 난이도 태깅", "⑥ ctx 컨텍스트 조립"] },
    { region: "대뇌피질 · 베르니케 영역", anat: "Wernicke's Area", fn: "언어 이해 — 글의 핵심 논지 파악", group: "이해", pos: [-1.0, 0.1, 0.4],
      roles: ["논지분석관 — 핵심 논지 한 문장 추출"],
      harness: ["① 배경·관련주제·사실 결합", "② 지문 논지 구조 파악(대조·인과)", "③ 핵심 논지 영어 1문장 산출", "④ 브로카로 전달"] },
    { region: "대뇌피질 · 브로카 영역", anat: "Broca's Area", fn: "언어 생성 — 정답·오답·발문 산출", group: "생성", pos: [1.0, 0.2, 0.5],
      roles: ["정답작성관 — 정답 보기/정답문", "오답설계관 — 역할별 매력적 오답 4개"],
      harness: ["① 핵심논지→정답 보기 작성", "② 역할별 오답 4개 설계(부분/정반대/무관/과장)", "③ 유의반의·연어로 오답 정교화", "④ 발문 조립→전전두엽으로"] },
    { region: "전전두엽", anat: "Prefrontal Cortex", fn: "고등 판단·검증·의사결정", group: "검증", pos: [0, 0.5, 1.2],
      roles: ["선지검수관 — 형태통일·정답유일·어구화", "어법검수관 — LanguageTool", "중복차단관 — Datamuse", "번역검증관 — MyMemory", "연어검증관 — Datamuse"],
      harness: ["① 5선지 형태·길이 통일", "② 정답 유일성 검사", "③ 어법 검수(LanguageTool)", "④ 동의어 중복 차단(Datamuse)", "⑤ 정답 한국어 교차검증(MyMemory)", "⑥ 최종 선지 확정"] },
    { region: "중뇌 · 각성(주의)", anat: "Midbrain", fn: "각성·주의 배분 — 활성 뉴런 선택·속도 조절", group: "중뇌", pos: [0, -0.55, 0.6],
      roles: ["주의관 — 이번 과제에 필요한 뉴런/API만 활성", "속도관 — fast/정밀·재귀 라운드 수 조절"],
      harness: ["① 과제 난이도·유형 감지", "② 활성 뉴런셋 선택", "③ 재귀/앙상블 on·off·라운드 결정", "④ 소뇌 정교화 위임"] },
    { region: "소뇌 · 정교화", anat: "Cerebellum", fn: "반복 미세조정 — 재귀 상호작용 수렴", pos: [0, -0.8, -0.5],
      roles: ["재귀개선관 — 검수↔재작성 수렴", "단계변형관 — 단어→구문→문장→주제"],
      harness: ["① 교사 패널 채점(N인 합의)", "② 결함 목록 도출", "③ 결함 기반 재작성", "④ 점수 수렴/목표 도달까지 반복", "⑤ 최고점 버전 채택"] },
    { region: "변연계", anat: "Limbic System", fn: "피드백·동기·자기개선", group: "피드백", pos: [0, -0.3, 0.1],
      roles: ["회의진행관 — 오류 시 API 회의 소집", "요청심의관 — 사용자 요청 교사회의 심의", "자가학습관 — 결함→일반화 규칙 학습→STANDING"],
      harness: ["① 오류/요청 감지", "② 교사 회의 소집(대화문)", "③ 합의 판정·개선지시", "④ 규칙 학습·누적(learned_rules)"] },
    { region: "운동 피질 · 출력", anat: "Motor Cortex", fn: "산출·표현", group: "출력", pos: [0, 0.9, -0.9],
      roles: ["삽화주문관 — Pollinations Image", "정답지·출제의도 기재관", "해설지·단어장 산출관"],
      harness: ["① 문항 조립(발문·지문·선지·정답)", "② 출제의도 기재", "③ 해설지·단어장 산출(요청 시)", "④ 삽화 주문(선택)"] },
    { region: "연합 피질 · 교사군집", anat: "Association Cortex", fn: "통합 고등사고 — 교사 다관점 합성", group: "창발", pos: [0, -0.1, -1.1],
      roles: ["교사군집 — 전공·성향별 표집(96,000)", "회의의장 — 합의 판정", "앙상블 — 다관점 초안 합성"],
      harness: ["① 교사 K명 표집(전공×성향×경력)", "② 각 교사 하네스: 초안→자기점검·보완", "③ 상호 비평", "④ 종합 편집자가 최종 합성"] },
    { region: "해마 · 학습DB", anat: "Hippocampus", fn: "기억·학습 저장 — GitHub·원서를 API와 엮음", group: "학습DB", pos: [0, -1.0, 0.35],
      roles: ["CEFR등급·유의반의·구동사·JFLEG어법·상용어(GitHub)", "원서 코퍼스·교재DB 582종(로컬/마스터)", "24h 연구·자가학습 규칙 누적"],
      harness: ["① 코퍼스·GitHub DB 로드", "② 어휘 인출(CEFR·유의반의·구동사)", "③ 지문·교재 추천 인출", "④ 학습규칙(STANDING) 적용", "⑤ 신규 규칙 기억 저장"] }
  ];
  var BRAIN_EXTRA = [
    { region: "뇌량 · 시냅스", anat: "Corpus Callosum", fn: "영역 간 연결(신경다발)", roles: ["시냅스 — 다중 API 엮음(개별 API는 멍청 → 항상 엮기)"],
      harness: ["① 영역 산출물 전달", "② 다중 API 결과 병합", "③ 다음 영역 입력으로 라우팅"] },
    { region: "전뇌 통합 · brain()", anat: "Whole-brain", fn: "분해→검색→다관점→자기비판→개선 총괄", roles: ["통합 추론 엔진 — 최종 합성은 최강 모델이 담당"],
      harness: ["① 과제 분해(하위질문·키워드)", "② 지식 검색(위키·사전·Datamuse)", "③ 다관점 사유(앙상블)", "④ 자기비판(교사 패널)", "⑤ 개선·최종 합성"] },
    { region: "24시간 항상성 · 서버 루틴", anat: "Autonomic (24/7)", fn: "PC 꺼져도 항시 사고·회의·학습·자료 연결", roles: ["자가학습 실행기(매시간)", "교사군집 브레인(매시간)", "일일 리포트·유형연구", "실시간 API·GitHub 동적 연결"],
      harness: ["① 저장소 pull", "② 스스로 출제·회의·연구", "③ 필요 시 API·GitHub 자료 연결·import", "④ learned_rules·아카이브 커밋", "⑤ 브라우저가 로드해 반영"] }
  ];
  function brainStructure() {
    var m = topology();
    var regions = BRAIN.map(function (b) { var ns = m.byNeuron.filter(function (n) { return n.group === b.group; }); return { region: b.region, anat: b.anat, fn: b.fn, group: b.group, pos: b.pos, roles: b.roles, harness: b.harness || [], neurons: ns.map(function (n) { return { name: n.name, degree: n.degree, key: n.key }; }), count: ns.length }; });
    return { regions: regions, extra: BRAIN_EXTRA, totalNeurons: m.neurons, totalSynapses: m.synapses, teachers: (typeof TEACHER_POP !== "undefined" ? TEACHER_POP : 0) };
  }
  function regionOf(group) { for (var i = 0; i < BRAIN.length; i++) if (BRAIN[i].group === group) return BRAIN[i]; return null; }

  /* ===== 자기개선: 오류기록(+구글) + API 회의 ===== */
  function postGoogle(entry) { if (!LOGURL) return; try { fetch(LOGURL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(entry) }); } catch (_) {} }
  function record(stage, type, detail) { var e = { t: stage, type: type, detail: detail }; ERRLOG.push(e); try { if (CB.onError) CB.onError(e); } catch (_) {} postGoogle(Object.assign({ kind: "error" }, e)); return e; }
  async function convene(type, attemptInfo) {
    var sys = "너는 영어 출제 '무료 API 팀'의 회의 진행자다. 팀원(편집장·어법검수관·오답설계관·자료조사관)이 방금 문제를 놓고 짧게 토론하고 합의된 개선책을 도출한다. JSON만.";
    var user = "문제 상황: '" + type + "' 문항 생성에서 " + attemptInfo + ".\n각 팀원이 한 줄씩 원인·의견을 내고, 합의된 '다음 시도용 개선지시(영어 출제에 바로 반영할 한 문장)'를 정하라. JSON: {\"discussion\":[{\"role\":\"역할\",\"opinion\":\"의견\"}],\"hint\":\"개선지시 한 문장\"}.";
    var m = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0.5, timeout: 50000 });
    var rec = { type: type, when: attemptInfo, discussion: (m && m.discussion) || [], hint: (m && m.hint) || "" };
    MEETINGS.push(rec); try { if (CB.onMeeting) CB.onMeeting(rec); } catch (_) {} postGoogle(Object.assign({ kind: "meeting" }, rec));
    return rec;
  }
  // 난이도 DB 로드 + 유형·레벨별 난이도 규칙 주입
  async function loadDifficultyDB(url) {
    try { var r = await fetch(url, { cache: "no-store" }); DIFF = await r.json(); return { ok: true, levels: DIFF.levels ? Object.keys(DIFF.levels) : [] }; } catch (e) { return { ok: false, error: String(e) }; }
  }

  // ===== 검수관(사용자 검수프롬프트 15절차 계승·발전): 코드검증 선행 → 유형별 LLM 검수 → 구조화 판정 =====
  var REVIEWDB = null;
  async function loadReviewDB(url) {
    try { var r = await fetch(url || "knowledge/review_core_v2.json", { cache: "no-store" }); REVIEWDB = await r.json(); return { ok: true, version: (REVIEWDB.meta && REVIEWDB.meta.version) || "?" }; } catch (e) { return { ok: false, error: String(e) }; }
  }
  // ===== 출제자 지식베이스(사용자 매뉴얼 v1 증류): 대원칙은 생성 전반에, 유형별 KB는 TYPERULE에 병합 =====
  var KB = null, KB_GUIDES = [];
  async function loadExaminerKB(url) {
    try {
      var r = await fetch(url || "knowledge/examiner_kb_v1.json", { cache: "no-store" }); KB = await r.json();
      KB_GUIDES = (KB.guides || []).map(function (g) { return { re: new RegExp(g.match), rule: g.rule }; });
      return { ok: true, guides: KB_GUIDES.length, version: (KB.meta && KB.meta.version) || "?" };
    } catch (e) { return { ok: false, error: String(e) }; }
  }
  function kbFor(type) {
    var t = String(type || ""), out = "";
    for (var i = 0; i < KB_GUIDES.length; i++) { if (KB_GUIDES[i].re.test(t)) { out = KB_GUIDES[i].rule; break; } }
    if (KB && KB.subjective && /영작|서술|전환|해석|명시|쓰기|완성|수정|어형|첫글자|도치|강조/.test(t)) out += (out ? " " : "") + "[채점원리] " + KB.subjective;
    return out;
  }
  // Rays Drill KB(동형모고 스펙·오답 DNA·선지 금지패턴)
  var RAYS = null;
  async function loadRaysKB(url) {
    try { var r = await fetch(url || "knowledge/rays_drill_kb.json", { cache: "no-store" }); RAYS = await r.json(); return { ok: true, version: (RAYS.meta && RAYS.meta.version) || "?" }; } catch (e) { return { ok: false, error: String(e) }; }
  }
  function raysKB() { return RAYS; }
  // 선지 금지패턴(메타표현·플레이스홀더) — Rays 5.4 자동 필터
  function badChoice(c) {
    var pats = (RAYS && RAYS.banned_patterns) || ["본문은", "글은", "사전적", "문자적", "원문보다", "undefined", "NaN", "(보기"];
    var s = String(c || "");
    return !s.trim() || pats.some(function (p) { return s.indexOf(p) >= 0; });
  }
  function reviewSectionFor(type) {
    var s = (REVIEWDB && REVIEWDB.sections) || {}; var t = String(type || "");
    if (/어법|전환|도치|강조/.test(t)) return s["어법"] || "";
    if (/어휘|영영|낱말|첫글자/.test(t)) return s["어휘"] || "";
    if (/빈칸|요약문|요약/.test(t)) return s["빈칸"] || "";
    if (/순서/.test(t)) return s["순서"] || "";
    if (/삽입/.test(t)) return s["삽입"] || "";
    if (/영작|서술|해석|주제문|명시|수정/.test(t)) return s["서술형"] || "";
    return s["공통훅"] || "";
  }
  // ① 코드 결정론 검증: 원문 보존 diff·형식·정답번호·선지 중복/길이 불균형(정답 노출)
  function reviewCode(q, original) {
    var f = [];
    var isLabel = q.choices && q.choices.length >= 4 && q.choices.every(function (c) { return String(c).trim().length <= 3; });
    if (q.choices && q.choices.length >= 4) {
      if (!(q.answer >= 1 && q.answer <= q.choices.length)) f.push("정답번호 무효(" + q.answer + ")");
      var seen = {};
      q.choices.forEach(function (c, i) { var k = normTok(c); if (k && seen[k] != null) f.push("선지 " + (seen[k] + 1) + "·" + (i + 1) + "번 중복(동일 의미 표기)"); if (k) seen[k] = i; });
      if (!isLabel) {
        var lens = q.choices.map(function (c) { return String(c).length; });
        var mx = Math.max.apply(null, lens), mn = Math.min.apply(null, lens);
        if (mn > 0 && mx / mn > 1.8) f.push("선지 길이 불균형(최장/최단 " + (mx / mn).toFixed(1) + "배)");
        if (mn > 0 && String(q.choices[q.answer - 1] || "").length === mx && mx / mn > 1.5) f.push("정답 선지가 가장 긺(정답 노출 위험)");
      }
    }
    if (!String(q.explanation || "").trim()) f.push("해설 누락");
    if (/[一-鿿぀-ヿ]/.test(String(q.instruction || "") + String(q.explanation || ""))) f.push("발문/해설에 중국어·일본어 문자 혼입(한국어로 교체 필요)");
    if (q.passage && original) {
      var plain = String(q.passage).replace(/<[^>]+>/g, "").replace(/[ⓐ-ⓔ]/g, "").replace(/\s+/g, " ").trim();
      var orig = String(original).replace(/\s+/g, " ").trim();
      if (plain && orig && normTok(plain) !== normTok(orig) && plain.length > orig.length * 0.5) {
        var setA = {}; orig.split(" ").forEach(function (w) { var k = normTok(w); if (k) setA[k] = (setA[k] || 0) + 1; });
        var added = []; plain.split(" ").forEach(function (w) { var k = normTok(w); if (!k) return; if (setA[k]) setA[k]--; else added.push(w); });
        var removed = []; for (var k2 in setA) { for (var c2 = 0; c2 < setA[k2]; c2++) removed.push(k2); }
        if (added.length || removed.length) {
          var intended = /어법|어휘|빈칸|낱말|수정/.test(String(q.type || ""));   // 이 유형들은 원문 변형이 정상 출제장치
          f.push("원문 변형 " + (intended ? "확인(이 유형의 정상 출제장치)" : "감지(의도적 출제장치인지 확인 필요)") + " — 추가어[" + added.slice(0, 6).join(",") + "] 소실어[" + removed.slice(0, 6).join(",") + "]");
        }
      }
    }
    return f;
  }
  // ② 솔버 교차검증(발전분): 검수관과 독립적으로 문제를 3회 풀어 다수결 → 기록 정답과 대조(정답키 오류 탐지)
  async function reviewSolve(q, original) {
    if (!(q.choices && q.choices.length >= 4)) return null;
    var CIRC = ["①", "②", "③", "④", "⑤"];
    var pg = String(q.passage || original || "").slice(0, 1400);
    if (!pg) return null;
    var user = q.instruction + "\n\n[지문]\n" + pg + "\n\n" + q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n") + "\n\n정답 번호만 출력(1~5).";
    var votes = [];
    for (var i = 0; i < 3; i++) {
      var r = await llm([{ role: "system", content: "너는 대한민국 고등학교 영어 수석 교사다. 발문과 지문·선지를 근거로 정답 '번호만'(1~5) 출력한다. 설명 금지." }, { role: "user", content: user }], { noRule: true, temperature: [0.2, 0.5, 0.8][i], timeout: 45000 }).catch(function () { return ""; });
      var d = (String(r).match(/[1-5]/) || [])[0]; if (d) votes.push(+d);
    }
    if (!votes.length) return null;
    var tally = {}; votes.forEach(function (v) { tally[v] = (tally[v] || 0) + 1; });
    var maj = +Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
    return { votes: votes, majority: maj, count: tally[maj] };
  }
  // ③ LLM 검수(v2: LITE 규칙 시스템 + 유형별 섹션 + 분석 먼저·판정 마지막) → ④ 판정 기준표 코드 집행
  async function reviewItem(q, original, opts) {
    opts = opts || {};
    if (!q) return null;
    var code = reviewCode(q, original || "");
    var R = REVIEWDB || {};
    var sec = reviewSectionFor(q.type);
    var sys = (R.identity || "너는 고등학교 영어 내신·수능형 문항 검수자다. 실제 출제 시 정답 시비가 없는지를 기준으로 점검한다.") +
      "\n[규칙] " + ((R.rules || []).join(" / ") || "판단 근거는 지문 축자 인용, 근거 없으면 그 선지는 정답 불인정 / 발문 극성과 정답 방향 일치 확인 / 각 오답마다 '그것이 정답'이라는 최선의 논증을 세우고 지문 근거로 반박 — 반박 불가면 복수정답 / 허용 가능한 어법을 오답 처리 금지 / 판단 불가면 지어내지 말고 보류") +
      (sec ? ("\n[" + q.type + " 검수] " + sec.slice(0, 380)) : "") +
      "\n[민감쌍] " + (R.paraphrase_pairs || "may/must, some/all, often/invariably, contribute to/cause, not necessarily/never, if/only if, suggest/prove") +
      "\n[판정표] 사용 불가=" + ((R.verdict_table && R.verdict_table["사용 불가"]) || "정답 오류·복수 정답·정답 없음·극성 반전·유령 오류/근거") + " / 수정 후 사용 가능=그 외 오류 존재 / 사용 가능=오류 없음." +
      "\n★분석을 전부 마친 뒤 verdict를 '마지막에' 결정하라. 판정을 먼저 정하고 정당화하지 마라.";
    var CIRC = ["①", "②", "③", "④", "⑤"];
    var user = "[유형] " + q.type + "\n[발문] " + q.instruction +
      "\n[원문]\n" + String(original || "(원문 미제공 — 기억 대조 금지, 지문 내적 결함만)").slice(0, 1500) +
      (q.passage && q.passage !== original ? ("\n\n[지문(문항용·변형 표기 포함)]\n" + String(q.passage).slice(0, 1500)) : "") +
      (q.choices && q.choices.length ? ("\n\n[선택지]\n" + q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n")) : "") +
      "\n\n[정답] " + (q.answer || "(서술형)") + "\n[해설] " + String(q.explanation || "").slice(0, 600) +
      (code.length ? ("\n\n[코드 사전검증 소견 — 판단에 반영]\n- " + code.join("\n- ")) : "") +
      "\n\n검수 후 JSON만 출력(키 순서 = 분석 순서, verdict는 반드시 마지막에 결정): {\"choices\":[{\"n\":1,\"ok\":\"정답|오답|보류\",\"evi\":\"본문 축자 근거(없으면 '본문 근거 없음')\",\"advocacy\":\"이 선지가 정답이라는 최선 논증→반박(오답만)\",\"note\":\"모호성(없으면 빈문자)\"}],\"errors\":[{\"at\":\"위치\",\"type\":\"유형\",\"issue\":\"문제점\",\"fix\":\"수정방법\"}],\"presented\":" + (q.answer || 0) + ",\"realAnswer\":실제정답번호(서술형은 0),\"unique\":true,\"multi\":\"복수정답 가능성(없으면 빈문자)\",\"fixExp\":\"보완 해설(불필요시 빈문자)\",\"fixChoices\":null,\"fixAnswer\":0,\"verdict\":\"사용 가능|수정 후 사용 가능|사용 불가\"}. 서술형이면 choices는 빈 배열.";
    // LLM 검수와 솔버 교차검증을 병렬 수행(서로 독립)
    var pair = await Promise.all([
      llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: 0.2, timeout: 90000 }).catch(function () { return null; }),
      reviewSolve(q, original).catch(function () { return null; })
    ]);
    var v = pair[0], sv = pair[1];
    if (!v || !v.verdict) v = { verdict: (code.length ? "수정 후 사용 가능" : "검수 실패(LLM 무응답)"), errors: code.map(function (c) { return { at: "코드검증", type: "형식/원문", issue: c, fix: "" }; }), choices: [], unique: null, multi: "", fail: !code.length };
    if (!/사용 가능|수정 후|사용 불가/.test(String(v.verdict))) v.verdict = (code.length || (v.errors || []).length) ? "수정 후 사용 가능" : "사용 가능";
    v._code = code; v.solver = sv;
    // ④ 판정 기준표 코드 집행(LLM이 관대해도 코드가 격상)
    var ra = parseInt(v.realAnswer, 10);
    if (q.answer >= 1 && ra >= 1 && ra <= 5 && ra !== q.answer) { v.verdict = "사용 불가"; v.unique = false; v.multi = (v.multi ? v.multi + " / " : "") + "검수관 판정 실제 정답 " + ra + "번(기록 " + q.answer + "번) — 정답 키 오류"; if (!(v.fixAnswer >= 1)) v.fixAnswer = ra; }
    if (sv && sv.count >= 2 && q.answer >= 1 && sv.majority !== q.answer) { v.verdict = "사용 불가"; v.unique = false; v.multi = (v.multi ? v.multi + " / " : "") + "독립 솔버 " + sv.count + "/" + sv.votes.length + "표가 " + sv.majority + "번 선택(기록 " + q.answer + "번) — 정답 키 오류 의심"; if (!(v.fixAnswer >= 1)) v.fixAnswer = sv.majority; }
    if ((v.unique === false || String(v.multi || "").length > 2) && !/불가/.test(v.verdict)) v.verdict = "사용 불가";   // 기준표: 복수정답=사용 불가
    return v;
  }
  // 원서 코퍼스 런타임 학습: 어휘난이도밴드·콜로케이션·등급별 지문 로드 → 난이도/어휘 판정에 반영
  var CORPUS = { vocab: null, passages: [], colloc: [], research: null, cefr: null, common: null, synant: null, phrasal: null, gec: null, books: null };
  function synAnt(word) { return (CORPUS.synant && CORPUS.synant[String(word || "").toLowerCase()]) || null; }
  function phrasalVerbs() { return CORPUS.phrasal || []; }
  function gecExamples(k) { var g = CORPUS.gec || []; if (!g.length) return ""; var out = []; for (var i = 0; i < (k || 2); i++) { var e = g[rint(g.length)]; if (e) out.push("'" + e.err + "' → '" + e.fix + "'"); } return out.join(" | "); }
  function recommendBooks(opts) { opts = opts || {}; var bs = CORPUS.books || []; var r = bs.filter(function (b) { return (!opts.skill || (b.skill || "").indexOf(opts.skill) >= 0) && (!opts.grade || (b.grade || "").indexOf(opts.grade) >= 0) && (!opts.weak || (b.weak || []).some(function (w) { return w.indexOf(opts.weak) >= 0; })); }); return (r.length ? r : bs).slice(0, opts.n || 8); }
  var CEFR_BAND = { A1: "기초", A2: "쉬움", B1: "보통", B2: "보통", C1: "고급", C2: "희귀" };
  async function loadCorpus(base) {
    base = base || "corpus/"; var t = "?_t=" + (new Date()).getTime();
    try { var v = await getJSON(base + "vocab_db.json" + t, 15000); if (v && v.db) CORPUS.vocab = v.db; } catch (_) {}
    try { var p = await getJSON(base + "passage_db.json" + t, 20000); if (p && p.passages) CORPUS.passages = p.passages; } catch (_) {}
    try { var c = await getJSON(base + "collocation_db.json" + t, 15000); if (c && c.collocations) CORPUS.colloc = c.collocations; } catch (_) {}
    try { var rr = await getJSON(base + "corpus_research.json" + t, 15000); if (rr) CORPUS.research = rr; } catch (_) {}
    try { var ce = await getJSON(base + "cefr_db.json" + t, 15000); if (ce && ce.level) { CORPUS.cefr = ce.level; CORPUS.common = {}; (ce.common || []).forEach(function (w, i) { CORPUS.common[w] = i + 1; }); } } catch (_) {}
    try { var sa = await getJSON(base + "synant.json" + t, 15000); if (sa && sa.map) CORPUS.synant = sa.map; } catch (_) {}
    try { var pv = await getJSON(base + "phrasal_verbs.json" + t, 15000); if (pv && pv.verbs) CORPUS.phrasal = pv.verbs; } catch (_) {}
    try { var gc = await getJSON(base + "gec_pairs.json" + t, 15000); if (gc && gc.pairs) CORPUS.gec = gc.pairs; } catch (_) {}
    try { var bk = await getJSON(base + "book_db.json" + t, 20000); if (bk && bk.books) CORPUS.books = bk.books; } catch (_) {}
    return { vocab: CORPUS.vocab ? Object.keys(CORPUS.vocab).length : 0, passages: (CORPUS.passages || []).length, colloc: (CORPUS.colloc || []).length, research: (CORPUS.research && CORPUS.research.count) || 0, cefr: CORPUS.cefr ? Object.keys(CORPUS.cefr).length : 0, synant: CORPUS.synant ? Object.keys(CORPUS.synant).length : 0, phrasal: (CORPUS.phrasal || []).length, gec: (CORPUS.gec || []).length, books: (CORPUS.books || []).length };
  }
  function cefrOf(word) { return (CORPUS.cefr && CORPUS.cefr[String(word || "").toLowerCase()]) || ""; }
  function corpusInfo() { return { vocab: CORPUS.vocab ? Object.keys(CORPUS.vocab).length : 0, passages: (CORPUS.passages || []).length, colloc: (CORPUS.colloc || []).length, research: (CORPUS.research && CORPUS.research.count) || 0 }; }
  function corpusPassage(opts) {
    opts = opts || {}; var arr = CORPUS.passages || [];
    if (opts.level) { var f = arr.filter(function (p) { return p.difficulty === opts.level; }); if (f.length) arr = f; }
    if (opts.category) { var g = arr.filter(function (p) { return p.category === opts.category; }); if (g.length) arr = g; }
    if (!arr.length) return null;
    return arr[rint(arr.length)];
  }
  function setLevelRule(type, level) {
    if (!level || !DIFF) { LEVELRULE = ""; return; }
    var lv = (DIFF.levels && DIFF.levels[level]) || "";
    var pt = (DIFF.perType && DIFF.perType[type] && DIFF.perType[type][level]) || "";
    LEVELRULE = "[목표 난이도: " + level + " — " + lv + "] 난이도는 '추론단계 × 패러프레이즈거리 × 오답매력도'로 조절하고(어휘만 어렵게 하는 값싼 난도 금지), 오답 설계가 변별의 핵심이다. " + pt;
  }
  // 공유 DB(또는 patterns.json)에서 누적 개선지침/기출 분석을 불러와 모든 출제에 반영
  async function loadSharedHints(url) {
    try {
      var r = await fetch(url, { cache: "no-store" }); var d = await r.json();
      var arr = Array.isArray(d) ? d : (d.hints || d.rules || []);
      arr = arr.map(function (x) { return typeof x === "string" ? x : (x && (x.hint || x.rule)); }).filter(Boolean);
      if (arr.length) STANDING = arr.slice(-10).join(" / ").slice(0, 800);
      return { ok: true, count: arr.length };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  /* ---------- 비-LLM API (병렬 가능) ---------- */
  async function grammar(text) {
    if (!text) return []; var to = withTimeout(25000);
    try {
      var r = await fetch("https://api.languagetool.org/v2/check", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: to.signal, body: "language=en-US&text=" + encodeURIComponent(text) });
      var d = await r.json();
      return (d.matches || []).filter(function (m) { return !m.rule || !m.rule.category || m.rule.category.id !== "TYPOGRAPHY"; })
        .map(function (m) { return { msg: m.message, bad: text.substr(m.offset, m.length), fix: (m.replacements || [])[0] && m.replacements[0].value }; });
    } catch (_) { return []; } finally { to.done(); }
  }
  async function datamuse(word, rel, max) {
    var map = { syn: "rel_syn", ant: "rel_ant", trg: "rel_trg", spc: "rel_spc", gen: "rel_gen", jja: "rel_jja", jjb: "rel_jjb", hom: "rel_hom", bga: "rel_bga", bgb: "rel_bgb", cns: "rel_cns", par: "rel_par", rhy: "rel_rhy", ml: "ml" };
    var q = rel === "sp" ? ("sp=" + encodeURIComponent(word)) : ((map[rel] || "ml") + "=" + encodeURIComponent(word));
    try { var d = await getJSON("https://api.datamuse.com/words?" + q + "&max=" + (max || 10), 12000); return (d || []).map(function (x) { return x.word; }); }
    catch (_) { return []; }
  }
  async function dict(word) {
    try {
      var d = await getJSON("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word), 12000);
      if (!Array.isArray(d)) return null; var out = { word: word, phonetic: d[0].phonetic || "", meanings: [] };
      d.forEach(function (en) { (en.meanings || []).forEach(function (m) { (m.definitions || []).slice(0, 2).forEach(function (df) { out.meanings.push({ pos: m.partOfSpeech, def: df.definition, example: df.example || "" }); }); }); });
      return out;
    } catch (_) { return null; }
  }
  async function wiktionary(word) {
    try { var d = await getJSON("https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(word), 12000);
      return (d.en || []).map(function (p) { return { pos: p.partOfSpeech, defs: (p.definitions || []).map(function (x) { return (x.definition || "").replace(/<[^>]+>/g, ""); }).slice(0, 2) }; }); } catch (_) { return null; }
  }
  async function wiki(topic) { try { var d = await getJSON("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(String(topic).replace(/\s+/g, "_")), 12000); return { title: d.title, extract: d.extract }; } catch (_) { return null; } }
  async function translate(text, pair) { try { var d = await getJSON("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + (pair || "en|ko"), 12000); return (d.responseData && d.responseData.translatedText) || ""; } catch (_) { return ""; } }
  function image(prompt, w, h) { return "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=" + (w || 640) + "&height=" + (h || 480) + "&nologo=true&model=flux"; }
  async function googleBooks(phrase) {
    try { var d = await getJSON("https://www.googleapis.com/books/v1/volumes?q=" + encodeURIComponent('"' + phrase + '"') + "&maxResults=2&country=US", 12000);
      var it = (d.items || [])[0]; return (it && it.searchInfo && it.searchInfo.textSnippet) || (it && it.volumeInfo && it.volumeInfo.description) || ""; } catch (_) { return ""; }
  }
  // 신규 무료·무키·CORS API (실측 검증 완료)
  async function wikiSearch(query) { try { var d = await getJSON("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(query) + "&srlimit=6&format=json&origin=*", 12000); return ((d.query && d.query.search) || []).map(function (x) { return x.title; }); } catch (_) { return []; } }
  async function wikidata(query) { try { var d = await getJSON("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + encodeURIComponent(query) + "&language=en&format=json&origin=*&limit=4", 12000); return ((d.search) || []).map(function (x) { return { label: x.label, desc: x.description || "" }; }).filter(function (x) { return x.desc; }); } catch (_) { return []; } }
  async function openLibrary(query) { try { var d = await getJSON("https://openlibrary.org/search.json?q=" + encodeURIComponent(query) + "&limit=2&fields=title,author_name,first_sentence,subject", 12000); var it = (d.docs || [])[0]; if (!it) return null; var fs = it.first_sentence; return { title: it.title, author: (it.author_name || [])[0] || "", sentence: (fs && (fs.value || fs[0])) || "", subjects: (it.subject || []).slice(0, 6) }; } catch (_) { return null; } }
  async function poetry(topic) { try { var d = await getJSON("https://poetrydb.org/lines/" + encodeURIComponent(topic), 12000); if (!Array.isArray(d)) return []; var lines = []; d.slice(0, 3).forEach(function (p) { (p.lines || []).forEach(function (l) { if (l && l.trim().length > 20) lines.push(l.trim()); }); }); return lines.slice(0, 5); } catch (_) { return []; } }
  // Datamuse 메타데이터: 빈도(백만당)·품사·음절 → 어휘 난이도 산정
  async function wordInfo(word) {
    var wl = String(word || "").toLowerCase();
    if (CORPUS.cefr && CORPUS.cefr[wl]) { var cf = CORPUS.cefr[wl]; return { word: wl, cefr: cf, level: CEFR_BAND[cf] || "보통", freq: (CORPUS.common && CORPUS.common[wl]) || 0, syll: 0, pos: "", source: "cefr" }; }
    if (CORPUS.vocab && CORPUS.vocab[wl]) { var e = CORPUS.vocab[wl]; return { word: wl, freq: e.pm, syll: 0, pos: "", level: e.level, docs: e.docs, source: "corpus" }; }
    try { var d = await getJSON("https://api.datamuse.com/words?sp=" + encodeURIComponent(word) + "&md=fps&max=1", 12000); var it = (d || [])[0]; if (!it) return null; var f = 0, pos = ""; (it.tags || []).forEach(function (t) { if (t.indexOf("f:") === 0) f = parseFloat(t.slice(2)) || 0; else if (/^[a-z]+$/.test(t)) pos = pos || t; }); return { word: it.word, freq: f, syll: it.numSyllables || 0, pos: pos, level: f > 20 ? "쉬움" : f > 3 ? "보통" : "어려움", source: "datamuse" }; } catch (_) { return null; } }
  async function wikiquote(topic) { try { var d = await getJSON("https://en.wikiquote.org/api/rest_v1/page/summary/" + encodeURIComponent(String(topic).replace(/\s+/g, "_")), 12000); return d.extract || ""; } catch (_) { return ""; } }
  async function wikisource(topic) { try { var d = await getJSON("https://en.wikisource.org/api/rest_v1/page/summary/" + encodeURIComponent(String(topic).replace(/\s+/g, "_")), 12000); return d.extract || ""; } catch (_) { return ""; } }

  /* ---------- 공통 보조 ---------- */
  function englishWords(s) { return (String(s).match(/[A-Za-z][A-Za-z'\-]{2,}/g) || []); }
  var STOP = { about: 1, above: 1, after: 1, again: 1, their: 1, there: 1, these: 1, those: 1, which: 1, while: 1, would: 1, could: 1, should: 1, other: 1, where: 1, when: 1, that: 1, this: 1, with: 1, from: 1, they: 1, them: 1, then: 1, than: 1, into: 1, only: 1, some: 1, such: 1, also: 1, each: 1, more: 1, most: 1, much: 1, even: 1, here: 1, your: 1, because: 1, however: 1, therefore: 1 };
  function contentWords(passage) { var f = {}; englishWords(passage).forEach(function (w) { var l = w.toLowerCase(); if (l.length >= 5 && !STOP[l]) f[l] = (f[l] || 0) + 1; }); return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }); }
  function shuffleAnswer(answer, distractors) {
    var all = [answer].concat((distractors || []).filter(Boolean).slice(0, 4));
    if (all.length < 5) return null;   // 플레이스홀더('보기 부족')를 시험지에 싣지 않는다 — 실패 처리 후 재시도
    for (var i = all.length - 1; i > 0; i--) { var j = rint(i + 1), t = all[i]; all[i] = all[j]; all[j] = t; }
    return { choices: all, answer: all.indexOf(answer) + 1 };
  }
  // 역할별 오답 4개 (미분화: 정답과 의미가 겹치지 않게)
  async function makeDistractors(answer, kind, context) {
    var j = await llmJSON([{ role: "system", content: "오답 설계 전문가. 정답과 의미가 분명히 다른 매력적 오답을 만든다. JSON 배열만." },
      { role: "user", content: "정답 보기: \"" + answer + "\"\n맥락: " + context + "\n위 정답과 '의미가 겹치지 않는' " + kind + " 오답 4개를 만들어라. 서로 다른 방식으로 틀리게: ①부분적·지엽적 ②정반대 ③글과 무관 ④지나치게 포괄적. 정답을 재진술·패러프레이즈 하지 말 것. JSON 문자열 배열 4개만." }], { temperature: 0.75, timeout: 55000 });
    var arr = Array.isArray(j) ? j.map(clean1).filter(Boolean) : [];
    // Datamuse 중복 차단: 정답 동의어와 겹치는 오답 1차 제거(미세 보강)
    return arr.slice(0, 4);
  }

  /* ====================== 미분화 빌더(유형별) ====================== */
  // ===== 컨텍스트 사전수집: 모든 비-LLM API 병렬 (반의어·동의어·정의·배경지식) =====
  async function prepContext(passage, onP) {
    log(onP, "· 자료 수집반(Datamuse 동의/반의/연상/연어 + 사전·위키·관련검색·Google Books) 병렬 가동…");
    var cw = contentWords(passage).slice(0, 8), ant = {}, syn = {}, trg = {}, colloc = {}, defs = {}, freq = {};
    await Promise.all(cw.map(async function (w) {
      try { var a = await datamuse(w, "ant", 2); if (a.length) ant[w] = a[0]; } catch (_) {}
      try { var s = await datamuse(w, "syn", 5); if (s.length) syn[w] = s; } catch (_) {}
      try { var t = await datamuse(w, "trg", 4); if (t.length) trg[w] = t; } catch (_) {}
    }));
    await Promise.all(cw.slice(0, 5).map(async function (w) {
      try { var d = await dict(w); if (d && d.meanings[0]) defs[w] = d.meanings[0].def; } catch (_) {}
      try { var b = await datamuse(w, "bgb", 3); if (b.length) colloc[w] = b; } catch (_) {}
      try { var fi = await wordInfo(w); if (fi) freq[w] = fi.level; } catch (_) {}
    }));
    var topic = await ask("다음 글의 핵심 주제를 영어 1~3단어(명사)로. 단어만.\n\n" + passage.slice(0, 500)).catch(function () { return ""; });
    var bg = null, related = [], facts = [], quote = "";
    if (topic) {
      try { bg = await wiki(topic); } catch (_) {}
      try { related = await wikiSearch(topic); } catch (_) {}
      try { facts = await wikidata(topic); } catch (_) {}
      try { quote = await wikiquote(topic); } catch (_) {}
    }
    return { cw: cw, ant: ant, syn: syn, trg: trg, colloc: colloc, defs: defs, freq: freq, bg: bg, topic: topic, related: related, facts: facts, quote: quote };
  }
  function synOverlap(answer, distractor, ctx) {
    var pool = {}; englishWords(answer).forEach(function (w) { (ctx.syn && ctx.syn[w.toLowerCase()] || []).forEach(function (s) { pool[s] = 1; }); });
    return englishWords(distractor).some(function (w) { return pool[w.toLowerCase()]; });
  }
  // ===== 정답 '위치' 코드검증 유틸: 밑줄(<u>..</u>) 블록을 순서대로 뽑고, 특정 표현이 든 블록 인덱스를 찾음 =====
  function uBlocks(passage) { return (String(passage).match(/<u>([^<]+)<\/u>/g) || []).map(function (m) { return m.replace(/<\/?u>/g, ""); }); }
  function normTok(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
  function idxContaining(blocks, needle) { var n = normTok(needle); if (!n) return -1; for (var i = 0; i < blocks.length; i++) { var b = normTok(blocks[i]); if (b && (b.indexOf(n) >= 0 || n.indexOf(b) >= 0)) return i; } return -1; }
  function CIRC5(i) { return "ⓐⓑⓒⓓⓔ".charAt(i - 1) || String(i); }
  function tokSet(s) { var o = {}; normTok(s).split(" ").forEach(function (w) { if (w.length > 2) o[w] = 1; }); return o; }
  function tokOverlap(a, b) { var A = tokSet(a), B = tokSet(b), n = 0, d = 0; for (var k in B) { d++; if (A[k]) n++; } return d ? n / d : 0; }
  // 선지들 중 target(정답 텍스트)과 확실히 가장 겹치는 하나를 찾음(확연히 우세할 때만; 아니면 -1)
  function bestMatchIdx(choices, target) { var bi = -1, bs = 0, sec = 0; for (var i = 0; i < choices.length; i++) { var s = tokOverlap(target, choices[i]); if (s > bs) { sec = bs; bs = s; bi = i; } else if (s > sec) sec = s; } return (bs >= 0.5 && bs >= sec + 0.25) ? bi : -1; }

  // ===== 선지 제작 팀: 5개 선지를 최종 검수·정리(형태통일·정답유일·어법·어구화) =====
  async function reviewOptions(answer, dis, ctx) {
    ctx = ctx || {};
    var sys = "너는 대한민국 수능 영어 '선지(보기) 검수관'이다. 5개 선택지를 최종 점검·정리한다: ①정답은 글을 정확히 반영하는 '단 하나' ②오답 4개는 서로 및 정답과 의미가 겹치지 않게, 각 오답에 오답 DNA(부분참·전도·과잉·축소·초점이동·태도왜곡·조건누락 중 1)를 부여해 매력적으로(본문 단어 일부 재활용) ③5개의 길이·문법 형태를 서로 통일(정답만 길거나 구체적 금지) ④어법 오류 수정 ⑤빈칸/요약형이면 완성 문장이 아니라 끼워지는 '어구/절'로 ⑥정답은 본문 표현을 그대로 베끼지 말고 패러프레이즈 ⑦메타 표현(본문은/글은/사전적/문자적/원문보다) 금지. JSON만.";
    var user = "유형: " + (ctx.type || "") + "\n정답 선지: \"" + answer + "\"\n오답 초안: " + JSON.stringify(dis || []) + (ctx.main ? ("\n글 핵심: " + ctx.main) : "") + (ctx.slot ? ("\n빈칸 프레임(모든 선지는 이 '____' 자리에 문법적으로 그대로 들어가야 함, 완성문장 금지): " + ctx.slot) : "") + "\n위 기준대로 5개 선지를 다듬어 JSON으로: {\"choices\":[\"5개 문자열\"],\"answer\":정답의 1~5 위치(정수)}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0.4, timeout: 60000 });
    if (r && Array.isArray(r.choices) && r.choices.length >= 5) {
      var ch = r.choices.map(clean1).filter(function (c) { return c && !badChoice(c); }).slice(0, 5);   // 금지패턴(메타표현·플레이스홀더) 자동 필터
      if (ch.length < 5) return shuffleAnswer(answer, dis || []);   // 패딩('보기') 금지 — 재료로 재구성 또는 null
      var ai = parseInt(r.answer, 10); if (!(ai >= 1 && ai <= 5)) ai = 0;
      var bm = bestMatchIdx(ch, answer);   // 정답 텍스트 위치를 코드로 도출(자기보고보다 우선)
      if (bm >= 0) ai = bm + 1; else if (!ai) ai = 1;
      return { choices: ch, answer: ai };
    }
    return shuffleAnswer(answer, dis || []);
  }

  // ===== 하네스: 파이프라인(라인=API+동작)을 순차 실행하며 트레이스 기록 =====
  async function runHarness(steps, state, onStep) {
    var trace = [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i], t0 = Date.now();
      if (onStep) onStep({ line: i + 1, total: steps.length, api: s.api, label: s.label });
      var patch = null; try { patch = await s.run(state); } catch (e) { patch = { __err: String((e && e.message) || e) }; }
      if (patch && !patch.__err) Object.assign(state, patch);
      trace.push({ line: i + 1, api: s.api, label: s.label, ms: Date.now() - t0, ok: !(patch && patch.__err) });
    }
    state._trace = trace; return state;
  }
  function infMeta(type) {
    return { instr: { "주제": "다음 글의 주제로 가장 적절한 것은?", "제목": "다음 글의 제목으로 가장 적절한 것은?", "요지": "다음 글의 요지로 가장 적절한 것은?" }[type] || "다음 글의 주제로 가장 적절한 것은?",
      kind: { "주제": "영어 명사구", "제목": "영어 제목구", "요지": "한국어 한 문장" }[type] || "영어 명사구" };
  }
  // 추론형 파이프라인: 각 라인이 명시적 API에 연결됨
  function inferenceSteps(passage, type, ctx, fast) {
    var kind = infMeta(type).kind;
    var roles = [["부분적·지엽적", "글의 사소한 일부만 담아"], ["정반대", "핵심과 반대 의미로"], ["글과 무관", "글에 없는 다른 주제로"], ["지나치게 포괄적", "너무 일반적이라 핵심을 못 짚게"]];
    var steps = [
      { api: "wiki", label: "배경지식 조회", run: function (s) { return Promise.resolve({ bg: (ctx && ctx.bg) || null }); } },
      { api: USE_ENSEMBLE ? "ensemble" : "llm", label: USE_ENSEMBLE ? "핵심 논지 추출(앙상블 메타-LLM)" : "핵심 논지 추출", run: async function (s) { var h = s.bg && s.bg.extract ? ("\n(참고 배경: " + s.bg.extract.slice(0, 160) + ")") : ""; if (ctx && ctx.related && ctx.related.length) h += "\n(관련 주제: " + ctx.related.slice(0, 4).join(", ") + ")"; if (ctx && ctx.facts && ctx.facts.length) h += "\n(사실: " + ctx.facts.slice(0, 2).map(function (f) { return f.label + "—" + f.desc; }).join("; ") + ")"; var pr = "다음 글의 핵심 논지를 영어 한 문장으로(답만)." + h + "\n\n" + passage; return { main: USE_ENSEMBLE ? ((await ensemble(pr)).answer || "") : await ask(pr, "핵심 한 문장. 답만.") }; } },
      { api: "llm", label: "정답 보기 작성", run: async function (s) { if (!s.main) throw new Error("no main"); return { answer: await ask("글 핵심: \"" + s.main + "\"\n이를 담은 " + type + " 정답을 " + kind + "로 간결히. 보기 텍스트만.") }; } }
    ];
    if (fast) {
      steps.push({ api: "llm", label: "오답 4개 일괄 설계", run: async function (s) { if (!s.answer) throw new Error("no answer"); var j = await llmJSON([{ role: "system", content: "오답 설계 전문가. JSON 배열만." }, { role: "user", content: "정답: \"" + s.answer + "\"\n글 핵심: " + s.main + "\n정답과 의미가 분명히 다른 " + kind + " 오답 4개를 각각 다른 방식(①부분적 ②정반대 ③무관 ④포괄)으로. 정답 재진술 금지. JSON 문자열 배열 4개만." }], { temperature: 0.75, timeout: 55000 }); return { dis: (Array.isArray(j) ? j.map(clean1).filter(Boolean) : []).slice(0, 4) }; } });
      steps.push({ api: "thesaurus", label: "오답 동의어중복 일괄검사", run: function (s) { return Promise.resolve({ dis: (s.dis || []).filter(function (d) { return !(d && ctx && synOverlap(s.answer, d, ctx)); }) }); } });
    } else {
      roles.forEach(function (r, idx) {
        steps.push({ api: "llm", label: "오답" + (idx + 1) + " (" + r[0] + ") 설계", run: async function (s) { if (!s.answer) throw new Error("no answer"); var d = await ask("정답: \"" + s.answer + "\"\n글 핵심: " + s.main + "\n이 정답과 의미가 분명히 다른 '" + r[0] + "' 오답 1개를 " + kind + "로 만들되 " + r[1] + ", 정답 재진술 금지. 보기 텍스트만."); s._last = d; s.dis = (s.dis || []).concat(d ? [d] : []); return { dis: s.dis }; } });
        steps.push({ api: "thesaurus", label: "오답" + (idx + 1) + " 동의어중복 검사", run: async function (s) { var d = s._last; if (d && ctx && synOverlap(s.answer, d, ctx)) { var d2 = await ask("정답 \"" + s.answer + "\"과 단어·의미가 겹치지 않는 '" + r[0] + "' 오답 1개를 " + kind + "로. 보기만."); if (d2) s.dis[s.dis.length - 1] = d2; } return { dis: s.dis }; } });
      });
    }
    steps.push({ api: "grammar", label: "보기 어법 검수(LanguageTool)", run: async function (s) { var gi = []; try { gi = await grammar([s.answer].concat(s.dis || []).filter(function (c) { return /[A-Za-z]\s[A-Za-z]/.test(c); }).join("\n")); } catch (_) {} return { gi: gi }; } });
    steps.push({ api: "trans", label: "정답 한국어 교차검증(MyMemory)", run: async function (s) { var ko = ""; try { ko = await translate(s.answer, "en|ko"); } catch (_) {} return { ko: ko }; } });
    steps.push({ api: "team", label: "선지 제작 팀 — 최종 검수(형태통일·정답유일·어법·어구화)", run: async function (s) { var r = await reviewOptions(s.answer, s.dis || [], { type: type, main: s.main }); if (!r) throw new Error("선지 부족"); return { choices: r.choices, answerIdx: r.answer }; } });
    return steps;
  }
  async function buildInference(passage, type, opts) {
    opts = opts || {}; var onP = opts.onProgress, ctx = opts.ctx || {};
    var st = await runHarness(inferenceSteps(passage, type, ctx, opts.fast), { passage: passage, ctx: ctx, dis: [] },
      function (ev) { log(onP, "  ┃라인 " + ev.line + "/" + ev.total + " [" + ev.api + "] " + ev.label + "…"); });
    if (!st.answer || !st.choices) return null;
    log(onP, '   ↳ 핵심 논지: "' + String(st.main || "").slice(0, 72) + '"');
    log(onP, '   ↳ 정답 초안: "' + String(st.answer || "").slice(0, 64) + '" · 오답 ' + (st.dis || []).length + '개 설계');
    var meta = infMeta(type);
    return { type: type, instruction: meta.instr, passage: "", choices: st.choices, answer: st.answerIdx,
      explanation: "글의 핵심 논지는 '" + st.main + "'이며 정답" + (st.ko ? (" (" + st.ko + ")") : "") + "이 이를 반영한다.",
      _audit: (st.gi && st.gi.length) ? ("어법 의심 " + st.gi.length + "건") : "검증 통과", _trace: st._trace };
  }
  // 빈칸: ① 핵심 논지 자리에 어구 비우기(도입부 회피) → ② 프레임 맞춤 어구형 정답 → ③ 역할별 오답
  async function buildBlank(passage, opts) {
    var onP2 = opts && opts.onProgress;
    var o = await llmJSON([{ role: "system", content: "수능 빈칸추론 출제자. 빈칸은 필자의 핵심 주장·결론을 담은 자리에 두고 도입부 정의문·예시·부연은 피한다. JSON만." }, { role: "user", content: "다음 글에서 필자의 핵심 주장/결론을 담은 문장을 고르고, 그 문장에서 논지의 핵심 어구(3~8단어)를 ____ 로 비워라(도입부 첫 문장은 피할 것). 정답은 빈칸에 '문법적으로 그대로 들어맞는 간결한 영어 어구(완성 문장 절대 아님)'로, 본문 표현이 아니라 상위어·동의어로 패러프레이즈하라. JSON: {\"blanked\":\"해당 어구만 ____로 바꾼 지문 전체\",\"answer\":\"빈칸에 들어갈 정답 어구\",\"orig\":\"비운 원래 어구\",\"frame\":\"빈칸이 든 문장만(____ 포함)\"}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.answer || !o.blanked) return null;
    log(onP2, '   ↳ 빈칸 프레임: "' + String(o.frame || "").slice(0, 70) + '"');
    log(onP2, '   ↳ 정답 어구: "' + String(o.answer).slice(0, 50) + '"' + (o.orig ? (' (원문 "' + String(o.orig).slice(0, 30) + '" 패러프레이즈)') : ''));
    var frame = o.frame || "";
    var dis = await makeDistractors(o.answer, "빈칸 '____'에 그대로 끼워지는 간결한 영어 어구(완성 문장 아님, 정답과 품사·길이 통일)", "빈칸 프레임: " + (frame || "(문장 일부)") + "\n오답은 본문 어휘를 재활용하되 이 자리에 넣으면 논리가 어긋나게(정반대/부분일치/무관/과장).");
    var a = await reviewOptions(o.answer, dis, { type: "빈칸", slot: frame, main: o.answer }); if (!a) return null;
    // 형태 가드: 완성문장형(주어+be/조동사 시작) 선지를 어구형으로 축약
    var ch = (a.choices || []).map(function (c) { return String(c).replace(/^\s*(happiness|it|one|people|the individual|this|they|we|society)\s+(is|are|was|were|has|have|can|will|becomes?)\s+/i, "").trim(); });
    return { type: "빈칸", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것은?", passage: o.blanked, choices: ch, answer: a.answer, explanation: "빈칸에는 '" + o.answer + "'가 들어가 글의 논지를 완성한다" + (o.orig ? (" (본문 '" + o.orig + "'의 패러프레이즈)") : "") + "." };
  }
  // 함의: ① 밑줄 구절+의미 → ② 역할별 오답
  async function buildImplication(passage) {
    var o = await llmJSON([{ role: "system", content: "함의추론 출제자. JSON만." }, { role: "user", content: "다음 글에서 함축 의미가 풍부한 '원문 구절' 하나와 그 문맥상 의미를 정하라. JSON: {\"phrase\":\"원문 그대로의 구절\",\"meaning\":\"그 함축 의미를 풀어쓴 영어 한 문장\"}.\n\n" + passage }], { temperature: 0.4, timeout: 55000 });
    if (!o || !o.meaning) return null;
    var dis = await makeDistractors(o.meaning, "영어 한 문장", "밑줄 구절 '" + (o.phrase || "") + "'의 함의");
    var a = await reviewOptions(o.meaning, dis, { type: "함의" }); if (!a) return null;
    var pg = o.phrase && passage.indexOf(o.phrase) >= 0 ? passage.replace(o.phrase, "<u>" + o.phrase + "</u>") : passage;
    return { type: "함의", instruction: "밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?", passage: pg, choices: a.choices, answer: a.answer, explanation: "밑줄 친 부분은 '" + o.meaning + "'을 함의한다." };
  }
  // 요약: ① (A)(B) 빈칸 요약문+정답 → ② 오답 쌍
  async function buildSummary(passage) {
    var o = await llmJSON([{ role: "system", content: "요약문완성 출제자. JSON만." }, { role: "user", content: "다음 글을 한 문장으로 요약하되 핵심어 두 곳을 (A),(B)로 비워라. JSON: {\"summary\":\"... (A) ... (B) ... 형태의 영어 요약문\",\"A\":\"정답 A 단어\",\"B\":\"정답 B 단어\"}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.A || !o.B) return null;
    var dj = await llmJSON([{ role: "system", content: "오답 설계자. JSON만." }, { role: "user", content: "정답 (A)=" + o.A + ", (B)=" + o.B + " 와 의미가 다른 (A)/(B) 쌍 오답 4개. JSON 배열 [{\"A\":\"..\",\"B\":\"..\"}, ...] 만." }], { temperature: 0.7, timeout: 50000 });
    var ans = "(A) " + o.A + " … (B) " + o.B;
    var dis = (Array.isArray(dj) ? dj : []).slice(0, 4).map(function (x) { return "(A) " + x.A + " … (B) " + x.B; });
    var a = await reviewOptions(ans, dis, { type: "요약" }); if (!a) return null;
    return { type: "요약", instruction: "다음 요약문의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: o.summary, choices: a.choices, answer: a.answer, explanation: "(A) " + o.A + " / (B) " + o.B + " 가 글의 요지를 정확히 요약한다." };
  }
  // 내용불일치/일치
  function factResult(wantMatch, st, ans, mode) {
    return { type: wantMatch ? "내용일치" : "내용불일치", instruction: "다음 글의 내용과 " + (wantMatch ? "일치하는" : "일치하지 않는") + " 것은?", passage: "", choices: st, answer: ans, explanation: "정답 진술만 글과 " + (wantMatch ? "일치" : "모순") + "한다.", _audit: (mode === "검증") ? "정답 코드검증됨(모순 진술 정확히 1개 확인)" : "⚠ 정답 미검증 — 복수정답 소지, 재확인 필요" };
  }
  async function buildFactCheck(passage, wantMatch) {
    var last = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "내용일치 출제자. JSON만." }, { role: "user", content: "다음 글의 내용에 관한 한국어 진술 5개를 만들어라. 정확히 1개만 글과 '" + (wantMatch ? "일치" : "불일치(모순)") + "'하고 나머지 4개는 그 반대가 되게 하라. 서로 모순되지 않도록(오답끼리도 지문과 " + (wantMatch ? "모순" : "일치") + ") 주의. JSON: {\"statements\":[\"진술 5개\"],\"answer\":정답번호1~5}.\n\n" + passage }], { temperature: attempt ? 0.5 : 0.4, timeout: 60000 });
      if (!o || !Array.isArray(o.statements) || o.statements.length < 5) continue;
      var st = o.statements.slice(0, 5); last = { st: st, answer: parseInt(o.answer, 10) };
      // 검증: 각 진술이 지문과 모순되는지 별도 LLM으로 판정 → 정답을 코드로 도출(복수정답 차단)
      var v = await llmJSON([{ role: "system", content: "너는 냉정한 사실검증관이다. 각 진술이 '지문 내용'과 논리적으로 모순되는지만 본다. JSON만." }, { role: "user", content: "지문:\n" + passage + "\n\n진술:\n" + st.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n") + "\n\n지문과 '모순되는(불일치)' 진술 번호만 배열로. JSON: {\"contradict\":[번호]}. JSON만." }], { temperature: 0.15, timeout: 55000 });
      var contra = (v && Array.isArray(v.contradict)) ? v.contradict.map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x >= 1 && x <= 5; }) : null;
      if (contra) {
        if (!wantMatch && contra.length === 1) return factResult(false, st, contra[0], "검증");                 // 불일치 1개
        if (wantMatch) { var m = [1, 2, 3, 4, 5].filter(function (n) { return contra.indexOf(n) < 0; }); if (m.length === 1) return factResult(true, st, m[0], "검증"); }  // 일치(=비모순) 1개
      }
      // 복수정답/검증불가 → 재시도
    }
    if (last && last.st) return factResult(wantMatch, last.st, (last.answer >= 1 && last.answer <= 5) ? last.answer : 1, "미검증");
    return null;
  }
  // 지문 속 단어 5개를 등장순으로 ⓐ~ⓔ<u>밑줄</u> 표시하고, corruptIdx 자리는 wrongWord로 '코드가' 치환
  function markWords(passage, words, corruptIdx, wrongWord) {
    var circ = "ⓐⓑⓒⓓⓔ", out = "", rest = passage, count = 0, placed = "";
    for (var i = 0; i < words.length && i < 5; i++) {
      var w = String(words[i] || "").trim(); if (!w) return null;
      // \b는 단어문자 옆에서만 성립 — 구절이 문장부호로 시작/끝나면 경계 생략(마침표 끝 구절 매칭 실패 방지)
      var re = new RegExp((/^[A-Za-z0-9]/.test(w) ? "\\b" : "") + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[A-Za-z0-9]$/.test(w) ? "\\b" : ""), "i");
      var m = re.exec(rest); if (!m) return null;              // 등장순으로 못 찾으면 실패 → 재시도
      var shown = (i === corruptIdx) ? wrongWord : m[0];
      if (i === corruptIdx) placed = m[0];                     // 원래 단어 기록
      out += rest.slice(0, m.index) + circ.charAt(i) + "<u>" + shown + "</u>";
      rest = rest.slice(m.index + m[0].length); count++;
    }
    return { text: out + rest, count: count, orig: placed };
  }
  // 어휘(문맥상 부적절): LLM은 '어느 단어를 무엇으로' 정하고, 밑줄·치환은 코드가 수행 → 정답위치 100% 정합
  async function buildVocab(passage) {
    var cw = contentWords(passage).slice(0, 8), ant = {};
    await Promise.all(cw.map(async function (w) { var sa = synAnt(w); if (sa && sa.ant && sa.ant.length) { ant[w] = sa.ant[0]; return; } var a = await datamuse(w, "ant", 2); if (a.length) ant[w] = a[0]; }));
    var brief = Object.keys(ant).map(function (w) { return w + "↔" + ant[w]; }).join(", ");
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어휘(문맥상 부적절) 출제자. JSON만." }, { role: "user", content: "다음 지문에서 서로 다른 핵심 단어 5개를 '지문에 나온 그대로(등장 순서)' 고르고, 그 중 1개를 문맥상 명백히 부적절한 반의어로 바꿀지 정하라. 참고 반의어쌍: " + (brief || "-") + ". JSON: {\"words\":[\"지문에 실제로 있는 단어 5개(등장순)\"],\"wrongIndex\":1~5,\"wrong\":\"그 자리에 넣을 부적절 반의어(한 단어)\",\"correct\":\"원래 맞는 단어\"}. JSON만.\n\n" + passage }], { temperature: attempt ? 0.5 : 0.4, timeout: 55000 });
      if (!o || !Array.isArray(o.words) || o.words.length < 5 || !o.wrong) continue;
      var wi = parseInt(o.wrongIndex, 10); if (!(wi >= 1 && wi <= 5)) wi = 1;
      var mk = markWords(passage, o.words.slice(0, 5), wi - 1, String(o.wrong).replace(/[^A-Za-z\- ]/g, "").trim());  // 코드가 밑줄+치환
      if (!mk || mk.count < 5) continue;                       // 5개 다 못 찾으면 재시도
      return { type: "어휘", instruction: "밑줄 친 ⓐ~ⓔ 중 문맥상 낱말의 쓰임이 적절하지 않은 것은?", passage: mk.text, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: wi, explanation: "정답 " + CIRC5(wi) + "는 '" + o.wrong + "'인데 문맥상 원래의 '" + (o.correct || mk.orig) + "'가 적절하다.", _audit: "정답위치 코드생성됨(치환·밑줄 모두 코드처리)" };
    }
    return null;
  }
  // 어법: LLM은 '어느 구절을 어떻게 틀리게'만 정하고, 밑줄·오류주입은 코드가 수행 → 정답위치 100% 정합
  async function buildGrammar(passage) {
    var gecEx = gecExamples(2);
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어법 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 판단 지점 5곳을 '지문에 나온 그대로의 짧은 구절(각 2~7단어, 문장 전체 복사 금지, 등장 순서)'로 고르고, 그 중 1곳을 실제 '문법' 오류로 바꿔라. ★철자 오타 금지 — 수일치·시제·태(능/수동)·준동사(to부정사/동명사/분사)·관계사·병렬·전치사 등 문법 오류만. JSON: {\"phrases\":[\"짧은 구절 5개(등장순, 원문 그대로)\"],\"wrongIndex\":1~5,\"error\":\"그 구절을 문법적으로 틀리게 바꾼 형태\",\"correct\":\"원래 올바른 구절(=phrases의 해당 항목과 동일)\"}. JSON만." + (gecEx ? (" 오류 유형 예: " + gecEx) : "") + "\n\n" + passage }], { noRule: true, temperature: attempt ? 0.45 : 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.phrases) || o.phrases.length < 5 || !o.error || String(o.error).trim() === String(o.correct || "").trim()) continue;
      var phr = o.phrases.slice(0, 5).map(function (p) { return String(p || "").trim(); });
      if (attempt < 2 && phr.some(function (p) { return p.split(/\s+/).length > 8; })) continue;   // 문장통째 구절 → 짧은 어구로 재시도(마지막 시도는 수용)
      // wrongIndex 자기보고 불신: correct와 동일한 구절을 코드로 탐색(0-기준 응답 등 오류 방어)
      var wi = -1;
      for (var pi = 0; pi < phr.length; pi++) { if (normTok(phr[pi]) === normTok(o.correct)) { wi = pi + 1; break; } }
      if (wi < 0) { var win = parseInt(o.wrongIndex, 10); wi = (win >= 1 && win <= 5) ? win : 1; }
      var mk = markWords(passage, phr, wi - 1, String(o.error).trim());   // 코드가 밑줄+오류주입
      if (!mk || mk.count < 5) continue;
      var g = []; try { g = await grammar(String(mk.text).replace(/<[^>]+>/g, " ").replace(/[ⓐ-ⓔ]/g, "")); } catch (_) {}
      var verified = g.length ? (" (LanguageTool 확인: " + g.slice(0, 2).map(function (x) { return x.bad; }).join(", ") + ")") : "";
      return { type: "어법", instruction: "밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것은?", passage: mk.text, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: wi, explanation: "정답 " + CIRC5(wi) + "의 '" + o.error + "'는 '" + (o.correct || mk.orig) + "'로 고쳐야 어법상 옳다." + verified, _audit: "정답위치 코드생성됨(밑줄·오류주입 모두 코드처리)" };
    }
    return null;
  }
  // 서술형
  function essayResult(type, instruction, answer) { return { type: type, instruction: instruction, passage: "", choices: [], answer: 0, explanation: "[모범답안] " + (answer || "") }; }
  // 서술형 파싱: [발문]…[정답] 구획(따옴표·목록·여러 줄에 안 깨짐) → 발문:/정답: 라벨 → JSON 순으로 견고하게
  function parseEssayText(raw) {
    raw = String(raw || "").replace(/```[a-z]*\n?/gi, "").trim();
    var m = raw.match(/\[\s*발문\s*\]\s*([\s\S]*?)\s*\[\s*정답\s*\]\s*([\s\S]*)$/);
    if (m && m[1].trim()) return { instruction: m[1].trim(), answer: (m[2] || "").trim() };
    var im = (raw.match(/발문\s*[:：]\s*([\s\S]*?)(?:\n\s*정답\s*[:：])/) || [])[1];
    var am = (raw.match(/정답\s*[:：]\s*([\s\S]*)$/) || [])[1];
    if (im && im.trim()) return { instruction: im.trim(), answer: (am || "").trim() };
    return null;
  }
  async function buildEssay(passage, opts, type) {
    type = type || "서술형";
    // 무거운 규칙을 system에 주입하면 소형모델이 빈 응답을 내므로, 규칙은 user에 짧게만 넣고 noRule로 호출
    var ess = (TYPERULE || "").replace(/\s+/g, " ").trim().slice(0, 130);
    var sys = "너는 고교 내신 영어 서술형 출제자다. 발문은 순수 한국어(+영어 인용)로만 쓴다 — 중국어·일본어 문자 금지. 출력은 아래 두 구획 형식만 쓴다(JSON·마크다운·여분 설명 금지).";
    var fmt = "정확히 이 형식만 출력:\n[발문]\n(제시문·조건·주어진 단어/어구를 포함한 한국어 발문, 여러 줄 가능)\n[정답]\n(모범답안 — 영작형은 영어 문장, 해석형은 우리말)";
    for (var i = 0; i < 4; i++) {
      var hint = (i < 2 && ess) ? ("\n(출제 지침 요약: " + ess + ")") : ""; // 1~2차만 지침, 이후 무지침으로 출제 보장
      var user = "다음 지문으로 '" + type + "' 유형의 내신 서술형 1문항을 만들어라." + hint + "\n" + fmt + "\n\n[지문]\n" + passage;
      var raw = await llm([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: i ? 0.85 : 0.55, timeout: 60000 });
      var p = parseEssayText(raw);
      if (p) return essayResult(type, p.instruction, p.answer);
    }
    // 최후 폴백: JSON 강제(무규칙)
    var o = await llmJSON([{ role: "system", content: "고교 영어 서술형 출제자. 유효한 JSON 한 개만, 문자열 값 안에서는 큰따옴표 대신 작은따옴표(')." }, { role: "user", content: "다음 지문으로 '" + type + "' 서술형 1문항. JSON: {\"instruction\":\"한국어 발문\",\"answer\":\"모범답안\"}. JSON만.\n\n[지문]\n" + passage }], { noRule: true, temperature: 0.7, timeout: 60000 });
    if (o && o.instruction) return essayResult(type, o.instruction, o.answer);
    return null;
  }
  // ===== 배열영작: LLM(정답문장) → MyMemory(번역) → 코드(셔플) → LanguageTool(검증) 다중 API 협업 =====
  async function buildArrange(passage) {
    var sent = await ask("다음 글의 핵심을 담은, 어법상 완전한 영어 문장 하나(8~14단어). 문장만 출력.\n\n" + passage, "영어 문장 하나만. 번호·따옴표·설명 금지.", { noRule: true, temperature: 0.5 });
    sent = String(sent || "").replace(/^["'·\-\s]+|["'\s]+$/g, "").split("\n")[0].trim();
    var words = sent.replace(/[.?!]+$/, "").split(/\s+/).filter(Boolean);
    if (words.length < 4 || words.length > 18) return null;
    var ko = await translate(sent.replace(/[.?!]+$/, ""), "en|ko").catch(function () { return ""; });
    var sh = words.slice();
    for (var i = sh.length - 1; i > 0; i--) { var j = rint(i + 1), t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
    if (sh.join(" ") === words.join(" ") && words.length > 1) { var a = sh[0]; sh[0] = sh[1]; sh[1] = a; }
    var gi = []; try { gi = await grammar(sent); } catch (_) {}
    var instr = "다음 우리말과 일치하도록 괄호 안에 주어진 단어를 모두 바르게 배열하여 영작하시오.\n〈조건〉 주어진 단어를 모두, 한 번씩만 사용하고 어형은 그대로 쓸 것.\n우리말: " + (ko || "(번역 생략)") + "\n주어진 단어: ( " + sh.join(" / ") + " )";
    return { type: "배열영작", instruction: instr, passage: "", choices: [], answer: 0,
      explanation: "[모범답안] " + sent.replace(/[.?!]*$/, "."),
      _audit: gi.length ? ("어법 의심 " + gi.length + "건") : "어법 검증 통과",
      _trace: [{ line: 1, api: "llm", label: "정답문장 생성", ok: !!sent }, { line: 2, api: "trans", label: "MyMemory 번역", ok: !!ko }, { line: 3, api: "code", label: "단어 셔플", ok: true }, { line: 4, api: "grammar", label: "LanguageTool 검증", ok: true }] };
  }
  // ===== 조건영작: LLM(정답문장) → 코드(핵심어 추출) → MyMemory(번역) → 코드(조건박스) 다중 API 협업 =====
  async function buildConditional(passage) {
    var sent = await ask("다음 글의 핵심을 담은 어법상 완전한 영어 문장 하나(7~14단어). 문장만 출력.\n\n" + passage, "영어 문장 하나만. 번호·따옴표·설명 금지.", { noRule: true, temperature: 0.5 });
    sent = String(sent || "").replace(/^["'·\-\s]+|["'\s]+$/g, "").split("\n")[0].trim();
    var words = sent.replace(/[.?!]+$/, "").split(/\s+/).filter(Boolean);
    if (words.length < 4) return null;
    var cws = contentWords(sent);
    var keys = cws.slice(0, 3); if (!keys.length) keys = words.filter(function (w) { return w.length >= 4; }).slice(0, 3);
    var ko = await translate(sent.replace(/[.?!]+$/, ""), "en|ko").catch(function () { return ""; });
    // KB 원칙(정답 폐쇄성): 조건 3개(제시어 전부 사용·어형 변화 허용·총 단어 수)로 정답의 경우의 수를 닫는다 — 단어 수는 모범답안에서 '코드가' 계산
    var instr = "다음 우리말과 일치하도록 주어진 단어를 모두 활용하여 영작하시오.\n〈조건〉 ① 주어진 단어를 모두 사용할 것 (필요시 어형 변화 가능)\n〈조건〉 ② 총 " + words.length + "단어의 한 문장으로 쓸 것 (축약형은 한 단어로 계산)\n〈조건〉 ③ 다른 단어를 추가할 수 있음\n우리말: " + (ko || "(번역 참조 불가 — 모범답안 기준 채점)") + "\n주어진 단어: ( " + keys.join(" / ") + " )";
    return { type: "조건영작", instruction: instr, passage: "", choices: [], answer: 0,
      explanation: "[모범답안] " + sent.replace(/[.?!]*$/, ".") + " (채점: 내용 40%+조건 준수 35%+어법·철자 25%, 조건 위반 1개당 감점 · 철자 감점 상한 1회)",
      _audit: "조건 3종 코드조립(단어 수 " + words.length + " 검산됨)",
      _trace: [{ line: 1, api: "llm", label: "정답문장 생성", ok: !!sent }, { line: 2, api: "code", label: "제시어 3개 추출", ok: !!keys.length }, { line: 3, api: "trans", label: "MyMemory 번역", ok: !!ko }, { line: 4, api: "code", label: "조건 3종 조립(단어수 검산)", ok: true }] };
  }
  // ===== 어법수정(서술형): 어법(밑줄) 성공 패턴과 동일한 '코드 주입' — LLM은 구절·오형태만, 밑줄·주입·위치는 코드가 =====
  async function buildGrammarEdit(passage) {
    for (var attempt = 0; attempt < 3; attempt++) {
      var gecEx = gecExamples(2);
      var o = await llmJSON([{ role: "system", content: "고교 어법 서술형 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 판단 지점 5곳을 '지문에 나온 그대로의 짧은 구절(각 2~7단어, 문장 전체 복사 금지, 등장 순서)'로 고르고, 그 중 1곳을 실제 '문법' 오류로 바꿔라. ★철자 오타 금지 — 수일치·시제·태·준동사·관계사·병렬·전치사 등 문법 오류만." + (gecEx ? (" 오류 유형 예: " + gecEx) : "") + " JSON: {\"phrases\":[\"짧은 구절 5개(등장순, 원문 그대로)\"],\"wrongIndex\":1~5,\"error\":\"그 구절의 틀린 형태\",\"correct\":\"원래 올바른 구절(=phrases의 해당 항목과 동일)\"}. JSON만.\n\n" + passage }], { noRule: true, temperature: attempt ? 0.5 : 0.4, timeout: 55000 });
      if (o && Array.isArray(o.phrases) && o.phrases.length >= 5 && o.error && String(o.error).trim() !== String(o.correct || "").trim()) {
        var phr = o.phrases.slice(0, 5).map(function (p) { return String(p || "").trim(); });
        if (attempt < 2 && phr.some(function (p) { return p.split(/\s+/).length > 8; })) continue;   // 문장통째 → 짧은 어구로 재시도
        var wi = -1;
        for (var pi = 0; pi < phr.length; pi++) { if (normTok(phr[pi]) === normTok(o.correct)) { wi = pi + 1; break; } }
        if (wi < 0) { var win = parseInt(o.wrongIndex, 10); wi = (win >= 1 && win <= 5) ? win : 1; }
        var mk = markWords(passage, phr, wi - 1, String(o.error).trim());
        if (!mk || mk.count < 5) continue;
        var verified = ""; try { var g = await grammar(String(mk.text).replace(/<[^>]+>/g, " ").replace(/[ⓐ-ⓔ]/g, "")); if (g.length) verified = " (LanguageTool: " + g.slice(0, 2).map(function (x) { return x.bad; }).join(", ") + " 확인)"; } catch (_) {}
        return { type: "어법수정", instruction: "다음 글의 밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것을 찾아 기호를 쓰고 바르게 고쳐 쓰시오.", passage: mk.text, choices: [], answer: 0,
          explanation: "[모범답안] " + CIRC5(wi) + ": '" + o.error + "' → '" + (o.correct || mk.orig) + "'" + verified, _audit: "정답위치 코드생성됨(밑줄·오류주입 모두 코드처리)" };
      }
    }
    return null;
  }

  /* ===== 재귀 상호작용: 검수 뉴런 ↔ 재작성 뉴런이 수렴까지 반복(recurrent refinement) ===== */
  async function critiqueQ(q, passage, personaSys) {
    var isMCQ = q.choices && q.choices.length >= 4;
    var pg = String(q.passage || passage || "");
    var sys = (personaSys || EXPERT_ID) + " 지금은 문항 심사위원으로서 아래 루브릭으로 0~100점 채점한다: 90+ 실제 출제 가능 수준, 80~89 소폭 수정 필요, 65~79 결함 있음, 65 미만 재작성. 관대하지도 가혹하지도 않게 '실제 수능/내신 기준'으로 매기고 구체적 결함을 짚는다. JSON만.";
    var body = isMCQ
      ? ("유형:" + q.type + "\n발문:" + q.instruction + "\n지문:" + (pg ? pg.slice(0, 800) : "(지문 없음)") + "\n선지:" + JSON.stringify(q.choices) + "\n정답번호:" + q.answer)
      : ("유형:" + q.type + "\n발문:" + q.instruction + "\n(원지문: " + pg.slice(0, 500) + ")\n정답:" + String(q.explanation || "").replace("[모범답안] ", ""));
    var user = body + "\n\n[평가기준] ①정답의 유일성·타당성 ②오답의 매력도와 상호 비중복 ③선지 형태·길이 통일 ④어법 정확성 ⑤발문 명료성·조건 충분성 ⑥난이도 적정(추론단계·패러프레이즈거리). JSON: {\"score\":0~100,\"issues\":[\"결함 한 줄씩(없으면 빈 배열)\"],\"fix\":\"가장 중요한 개선지시 한 문장\"}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: 0.3, timeout: 55000 });
    return (r && typeof r.score !== "undefined") ? { score: parseInt(r.score, 10) || 0, issues: r.issues || [], fix: r.fix || "" } : { score: 0, issues: ["평가 실패"], fix: "" };
  }
  async function applyFix(q, crit, passage) {
    var isMCQ = q.choices && q.choices.length >= 4;
    var pg = String(q.passage || passage || "");
    if (isMCQ) {
      // ⓐ~ⓔ 라벨형(어법·어휘)은 선지가 지문의 밑줄 위치와 묶여 있어, 선지를 재작성하면 포맷이 깨진다 → 원본 유지
      var isLabel = q.choices.every(function (c) { return String(c).trim().length <= 3; });
      if (isLabel) return null;
      var sys = "너는 수능 영어 선지 개선 전문가다. 지적된 결함을 모두 해소해 5개 선지를 다시 다듬는다(정답의 '내용'은 지문에 맞게 유지, 위치는 바뀌어도 됨). JSON만.";
      var user = "유형:" + q.type + (pg ? ("\n지문:" + pg.slice(0, 800)) : "") + "\n발문:" + q.instruction + "\n현재 선지:" + JSON.stringify(q.choices) + "\n정답번호:" + q.answer + "\n지적 결함:" + JSON.stringify(crit.issues || []) + "\n개선지시:" + (crit.fix || "") + "\nJSON: {\"choices\":[\"5개\"],\"answer\":정답위치(정수)}. JSON만.";
      var rr = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: 0.5, timeout: 55000 });
      if (rr && Array.isArray(rr.choices) && rr.choices.length >= 4) { var ch = rr.choices.map(clean1).filter(Boolean).slice(0, 5); while (ch.length < 5) ch.push("(보기)"); var ai = parseInt(rr.answer, 10); if (!(ai >= 1 && ai <= 5)) ai = 1; return Object.assign({}, q, { choices: ch, answer: ai }); }
      return null;
    }
    var sys2 = "너는 내신 영어 서술형 개선 전문가다. 지적 결함을 반영해 발문/정답을 다듬는다. 아래 두 구획 형식만.";
    var user2 = "유형:" + q.type + "\n현재 발문:" + q.instruction + "\n현재 정답:" + String(q.explanation || "").replace("[모범답안] ", "") + "\n지적 결함:" + JSON.stringify(crit.issues || []) + "\n개선지시:" + (crit.fix || "") + "\n\n[발문]\n(개선된 발문)\n[정답]\n(개선된 정답)";
    var raw = await llm([{ role: "system", content: sys2 }, { role: "user", content: user2 }], { noRule: true, temperature: 0.5, timeout: 55000 });
    var p = parseEssayText(raw); if (p) return Object.assign({}, q, { instruction: p.instruction, explanation: "[모범답안] " + p.answer });
    return null;
  }
  // 교사 검토단: N명 교사가 각자 채점 → 결함 합집합·평균점수(엮음)
  async function panelCritique(q, passage, n) {
    n = Math.max(1, n || 1);
    if (n === 1) return await critiqueQ(q, passage);
    var teachers = sampleTeachers(n, (String(q.type || "") + String(q.instruction || "")).length);
    var critResults = await Promise.all(teachers.map(function (t) { return critiqueQ(q, passage, t.sys).catch(function () { return null; }); }));
    var crits = critResults.filter(Boolean);
    if (!crits.length) return { score: 0, issues: ["평가 실패"], fix: "" };
    var issues = []; crits.forEach(function (c) { (c.issues || []).forEach(function (x) { if (issues.indexOf(x) < 0) issues.push(x); }); });
    var score = Math.round(crits.reduce(function (s, c) { return s + (c.score || 0); }, 0) / crits.length);
    var fix = (crits.filter(function (c) { return c.fix; })[0] || {}).fix || "";
    return { score: score, issues: issues.slice(0, 6), fix: fix, panel: crits.length };
  }
  // 수렴까지(또는 목표점수·최대라운드까지) 재귀 반복. best(최고점 버전)를 반환.
  async function refineLoop(q, opts) {
    if (!q) return q; opts = opts || {}; var target = opts.target || 88, maxR = opts.maxRounds || 4, onP = opts.onProgress, passage = opts.passage || "", panel = opts.panel || 1;
    var best = q, bestScore = -1, cur = q, stale = 0, rounds = [];
    for (var r = 1; r <= maxR; r++) {
      var c = await panelCritique(cur, passage, panel);
      rounds.push({ round: r, score: c.score, issues: (c.issues || []).slice(0, 3) });
      log(onP, "  🔁 상호작용 라운드 " + r + " — 검수 " + c.score + "점" + (c.panel ? (" (교사 " + c.panel + "명 합의)") : "") + ((c.issues && c.issues.length) ? (" · " + c.issues.slice(0, 2).join("; ")) : " · 결함 없음"));
      try { if (CB.onRefine) CB.onRefine({ round: r, score: c.score, type: q.type }); } catch (_) {}
      if (c.score > bestScore) { bestScore = c.score; best = cur; stale = 0; } else { stale++; }
      if (c.score >= target) break;
      if (stale >= 2) { log(onP, "  · 수렴(추가 개선 없음) — 반복 종료"); break; }
      var improved = await applyFix(cur, c, passage); if (!improved) { stale++; continue; }
      cur = improved;
    }
    best._refine = { rounds: rounds, finalScore: bestScore }; return best;
  }

  /* ===== 자가학습: 스스로 만들고 → 교사 패널 자가비평 → 결함에서 일반화 규칙 학습 → STANDING에 반영 ===== */
  var LEARNED = [];
  function learnedRules() { return LEARNED.slice(); }
  function applyLearned(rules) { LEARNED = (rules || []).map(function (r) { return (r && r.rule) || r; }).filter(function (r) { return typeof r === "string" && r; }).slice(-60); STANDING = LEARNED.slice(-12).join(" / ").slice(0, 900); return LEARNED.length; }
  async function selfLearnStep(passage, type, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    var q = await generateOne(passage, type, { fast: true }).catch(function () { return null; });
    if (!q) return { type: type, score: 0, learned: null, fail: true };
    var c = await panelCritique(q, passage, opts.teachers || 2);
    if (!c || c.score >= (opts.target || 88) || !(c.issues && c.issues.length)) return { type: type, score: c ? c.score : 0, learned: null };
    var rule = await ask("다음 '" + type + "' 문항의 결함으로부터, 앞으로 모든 출제에 적용할 '일반화된 개선 규칙' 한 문장을 한국어로 도출하라(구체적·실행가능, 특정 지문에 국한 금지).\n결함: " + JSON.stringify((c.issues || []).slice(0, 3)) + "\n개선지시: " + (c.fix || ""), "규칙 한 문장만.", { noRule: true, temperature: 0.4 });
    rule = String(rule || "").trim();
    if (rule.length > 8 && LEARNED.indexOf(rule) < 0) { LEARNED.push(rule); if (LEARNED.length > 60) LEARNED = LEARNED.slice(-60); STANDING = LEARNED.slice(-12).join(" / ").slice(0, 900); try { if (CB.onLearn) CB.onLearn({ type: type, score: c.score, rule: rule }); } catch (_) {} return { type: type, score: c.score, learned: rule, issues: (c.issues || []).slice(0, 2) }; }
    return { type: type, score: c.score, learned: null };
  }

  /* ===== 창발: 뉴런망 위에서 새 LLM을 창조(동적 뉴런) + 앙상블 메타-LLM ===== */
  var SPAWNED = [];
  function spawnLLM(name, persona) {
    var key = "llm_spawn_" + (SPAWNED.length + 1);
    var neuron = { key: key, name: name || ("창발LLM" + (SPAWNED.length + 1)), group: "창발", api: "Pollinations", persona: persona || "" };
    MESH.neurons.push(neuron);
    MESH.synapses.push([key, "llm_main"], ["llm_main", key], [key, "critic"], [key, "llm_ans"], [key, "llm_dis"]);
    if (MESH.groups.indexOf("창발") < 0) MESH.groups.splice(2, 0, "창발");
    SPAWNED.push(neuron);
    var fn = function (prompt, o) { return ask(prompt, persona || "간결하게 답만 출력.", Object.assign({ noRule: true }, o || {})); };
    fn.neuron = neuron; return fn;
  }
  // 앙상블 메타-LLM: N개 페르소나가 각자 사유 → 상호 비평·통합 → 하나의 상위 답(창발적 '새 LLM')
  // 각 교사별 하네스 파이프라인: 라인1 초안 → 라인2 자기점검·보완 (라인별 트레이스)
  async function teacherHarness(teacher, prompt, temp) {
    var trace = [];
    var draft = await llm([{ role: "system", content: teacher.sys }, { role: "user", content: prompt }], { noRule: true, temperature: temp || 0.6, timeout: 55000 }).catch(function () { return ""; });
    draft = String(draft || "").trim();
    trace.push({ line: 1, api: "llm", label: "초안 작성(" + (teacher.special || "") + ")", ok: !!draft });
    if (!draft) return { who: teacher.name, output: "", draft: "", steps: trace, teacher: teacher };
    var checked = await llm([{ role: "system", content: teacher.sys + " 너의 초안을 스스로 점검해 오류·약점을 보완한다." }, { role: "user", content: "과제:\n" + prompt + "\n\n내 초안:\n" + draft + "\n\n오류·약점을 보완한 '개선된 최종 기여'만 출력(설명 없이)." }], { noRule: true, temperature: 0.4, timeout: 55000 }).catch(function () { return ""; });
    checked = String(checked || "").trim();
    trace.push({ line: 2, api: "llm", label: "자기 점검·보완", ok: !!checked });
    return { who: teacher.name, special: teacher.special, output: checked || draft, draft: draft, steps: trace, teacher: teacher };
  }
  async function ensemble(prompt, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    var personas = opts.personas || sampleTeachers(opts.teachers || 3, opts.seed || (prompt ? String(prompt).length : 1));
    log(onP, "  🧬 교사군집 " + TEACHER_POP.toLocaleString() + "명 중 " + personas.length + "명 소집 → 각자 하네스(초안→자기점검) → 합성…");
    var draftResults = await Promise.all(personas.map(function (p, i) {
      return teacherHarness(p, prompt, 0.55 + 0.12 * i).then(function (h) { return (h && h.output) ? { who: p.name, text: h.output, steps: h.steps, draft: h.draft, special: h.special } : null; }, function () { return null; });
    }));
    var drafts = draftResults.filter(Boolean);
    if (!drafts.length) return { answer: "", drafts: [] };
    if (drafts.length === 1) return { answer: drafts[0].text, drafts: drafts };
    var body = drafts.map(function (x, i) { return "초안" + (i + 1) + " [" + x.who + "]:\n" + x.text; }).join("\n\n");
    var synth = await llm([{ role: "system", content: "너는 여러 전문가의 초안을 통합해 하나의 최고 최종답을 만드는 종합 편집자다." }, { role: "user", content: "같은 과제에 대한 " + drafts.length + "개 전문가 초안이다. 장점을 통합하고 오류·중복을 제거해 '하나의 최종답'만 작성하라(초안 언급 없이 완성된 답만).\n\n" + body }], { noRule: true, temperature: 0.3, timeout: 60000 });
    return { answer: (synth && synth.trim()) || drafts[0].text, drafts: drafts };
  }
  // ===== 무한 교사군집: 각 교사=1뉴런. 인덱스→결정론적 고유 페르소나(개념상 수억·수조) =====
  var T_SPECIAL = ["통사·어법", "어휘·연어", "독해·논리", "화용·함의", "작문·서술형", "듣기·구어체", "영미문학", "언어학 이론", "평가·측정", "교육과정·성취기준", "논증 구조", "담화·응집성"];
  var T_STYLE = ["평가원 수능형", "최상위 내신형", "EBS 연계형", "논리독해 심화형", "어법 킬러형", "빈칸 추론 심화형", "함정 설계형", "실용·상황형", "패러프레이즈 정교형", "서술형 채점 정밀형"];
  var T_TRAIT = ["엄정·보수적", "창의·도전적", "학생 눈높이", "변별 극대화", "공정성 최우선", "간결·명료", "고전적 정석", "실험적"];
  var T_ALMA = ["사범대 영어교육", "영문학", "언어학", "영어영문 교육대학원"];
  function makeTeacher(i) {
    i = Math.abs(i | 0);
    var a = T_SPECIAL[i % T_SPECIAL.length];
    var b = T_STYLE[Math.floor(i / T_SPECIAL.length) % T_STYLE.length];
    var c = T_TRAIT[Math.floor(i / (T_SPECIAL.length * T_STYLE.length)) % T_TRAIT.length];
    var d = T_ALMA[Math.floor(i / (T_SPECIAL.length * T_STYLE.length * T_TRAIT.length)) % T_ALMA.length];
    var yrs = 8 + (i % 25); // 경력 8~32년 — 인덱스마다 달라 사실상 무한 변주
    var name = "교사#" + (i + 1) + " (" + a + "·" + b + ")";
    var sys = "너는 " + a + "·" + b + " 전문의 베테랑 영어 출제교사다(경력 " + yrs + "년, 성향 " + c + "). 수능·내신 출제 원칙에 정통하며 이 관점을 견지한다.";
    return { idx: i, name: name, special: a, style: b, trait: c, alma: d, years: yrs, sys: sys };
  }
  // 조합 공간 = 12×10×8×4×25 = 96,000 고유 페르소나(차원 확장·인덱스 확대로 사실상 무한: makeTeacher(임의 큰 수))
  var TEACHER_POP = 96000;
  function teacherCount() { return TEACHER_POP; }
  function sampleTeachers(k, seed) {
    k = Math.max(1, k || 5); seed = Math.abs((seed | 0)) || 1; var out = [], used = {};
    for (var j = 0; j < k; j++) { var idx = (seed * 2654435761 + j * 40503 + j * j * 733) % TEACHER_POP; idx = Math.abs(idx); while (used[idx]) idx = (idx + 1) % TEACHER_POP; used[idx] = 1; out.push(makeTeacher(idx)); }
    return out;
  }
  // 뉴런망에 대표 교사 3인 상시 배치(런타임에 sampleTeachers로 수백~수천 명 소집 가능)
  [7, 314, 2718].forEach(function (i) { var t = makeTeacher(i); spawnLLM(t.name, t.sys); });

  // ===== brain: 무료 API 신경다발을 '나(Claude)처럼' 엮은 범용 추론 엔진 =====
  // 분해 → 지식검색(API 뉴런) → 다관점 사유(앙상블) → 자기비판 → 개선(수렴) → 기억
  async function brain(task, opts) {
    opts = opts || {}; var onP = opts.onProgress, maxR = opts.rounds || 2, trace = { steps: [] };
    log(onP, "🧠 [1/5] 작업 이해·분해…");
    var plan = await llmJSON([{ role: "system", content: "너는 복잡한 과제를 분해하는 분석가다. JSON만." }, { role: "user", content: "다음 과제 수행을 위해 (a)핵심 하위질문 2~4개, (b)조사가 필요한 영어 키워드 1~3개를 정하라.\n과제: " + task + "\nJSON: {\"subquestions\":[..],\"keywords\":[..]}. JSON만." }], { noRule: true, temperature: 0.4, timeout: 55000 });
    var kws = (plan && plan.keywords) || []; trace.steps.push({ step: "분해", data: plan });
    log(onP, "🧠 [2/5] 지식 검색(Wikipedia·Wikidata·사전·Datamuse)…");
    var facts = [];
    for (var i = 0; i < Math.min(kws.length, 3); i++) {
      var k = kws[i];
      try { var w = await wiki(k); if (w && w.extract) facts.push("[" + k + "] " + w.extract.slice(0, 220)); } catch (_) {}
      try { var wd = await wikidata(k); if (wd && wd.length) facts.push("[" + k + " 정의] " + wd[0].desc); } catch (_) {}
      try { var dd = await dict(k); if (dd && dd.meanings[0]) facts.push("[" + k + " 뜻] " + dd.meanings[0].def); } catch (_) {}
    }
    trace.steps.push({ step: "검색", data: facts });
    var ctx = facts.length ? ("\n\n[조사된 배경지식]\n" + facts.join("\n")) : "";
    log(onP, "🧠 [3/5] 다관점 사유(앙상블 페르소나 합성)…");
    var en = await ensemble(task + ctx, { onProgress: onP }); var answer = en.answer || "";
    trace.steps.push({ step: "앙상블", drafts: en.drafts });
    var scores = [];
    for (var r = 1; r <= maxR; r++) {
      log(onP, "🧠 [4/5] 자기비판 라운드 " + r + "…");
      var crit = await llmJSON([{ role: "system", content: EXPERT_ID + " 지금은 검토자로서 루브릭(90+ 우수, 80~89 소폭수정, 65~79 결함, 65미만 재작성)으로 채점한다. JSON만." }, { role: "user", content: "과제: " + task + "\n현재 답:\n" + answer + ctx + "\n\n이 답의 결함·누락·사실오류를 지적하고 위 루브릭으로 채점하라. JSON: {\"score\":정수,\"issues\":[\"결함\"],\"fix\":\"개선지시 한 문장\"}. JSON만." }], { noRule: true, temperature: 0.3, timeout: 55000 });
      scores.push(crit && crit.score); trace.steps.push({ step: "비판" + r, data: crit });
      if (!crit || (crit.score || 0) >= 90 || !(crit.issues && crit.issues.length)) break;
      log(onP, "🧠 [5/5] 개선 라운드 " + r + "…");
      var imp = await llm([{ role: "system", content: "너는 지적사항을 반영해 답을 개선하는 편집자다. 개선된 최종답만 출력." }, { role: "user", content: "과제: " + task + "\n기존 답:\n" + answer + "\n지적: " + JSON.stringify(crit.issues) + "\n개선지시: " + (crit.fix || "") + ctx + "\n\n결함을 모두 해소한 '개선된 최종답'만 출력하라(설명·머리말 없이 답만)." }], { noRule: true, temperature: 0.5, timeout: 60000 });
      if (imp && imp.trim().length > 10) answer = imp.trim();
    }
    log(onP, "🧠 완료");
    return { answer: answer, facts: facts, scores: scores, reasoning: trace };
  }

  // ===== 거버넌스: 사용자 요청을 '교사 회의(대화문)'로 심의 → 반영/반려 판정(공지용) =====
  async function deliberate(request, opts) {
    opts = opts || {}; var onP = opts.onProgress, n = opts.teachers || 4;
    var teachers = sampleTeachers(n, String(request || "").length);
    log(onP, "🗣 교사 회의 소집 — " + teachers.length + "명 심의…");
    var dialogue = [];
    for (var i = 0; i < teachers.length; i++) {
      var prev = dialogue.map(function (d) { return d.speaker + ": " + d.text; }).join("\n");
      var stance = i === 0 ? "너는 이 요청을 처음 검토한다. 찬반 입장을 정하고 근거와 '구체적 구현 방법'을 제시하라."
        : i === 1 ? "너는 비판적 검토자 역할이다. 반드시 '우려·반박·리스크'를 최소 한 가지 제기하라(앞 발언에 그냥 동의만 하지 마라)."
          : "너는 앞 발언들을 절충·보완하거나 '새로운 관점/조건'을 추가하라. 이미 나온 말의 반복은 금지.";
      var v = await llm([{ role: "system", content: teachers[i].sys + " 지금은 시스템 개선 회의 중이다. 한국어 대화체로 짧고 구체적으로, 전문가답게 말한다." }, { role: "user", content: "[사용자 요청]\n" + request + (prev ? ("\n\n[지금까지 회의]\n" + prev) : "") + "\n\n" + stance + " 1~3문장." }], { noRule: true, temperature: 0.72, timeout: 55000 });
      if (v && v.trim()) { dialogue.push({ speaker: teachers[i].name, text: v.trim() }); log(onP, "  💬 " + teachers[i].name + ": " + v.trim().slice(0, 60)); }
    }
    var vr = await llmJSON([{ role: "system", content: EXPERT_ID + " 회의 의장으로서 합의를 종합해 판정한다. JSON만." }, { role: "user", content: "[요청]\n" + request + "\n\n[회의록]\n" + dialogue.map(function (d) { return d.speaker + ": " + d.text; }).join("\n") + "\n\n합의 판정을 JSON으로: {\"verdict\":\"반영|부분반영|보류|반려 중 하나\",\"reason\":\"핵심 이유 1~2문장\",\"how\":\"반영한다면 구체적 방법/변경점\",\"priority\":\"상|중|하\"}. JSON만." }], { noRule: true, temperature: 0.3, timeout: 55000 });
    var res = vr || { verdict: "보류", reason: "판정 실패", how: "", priority: "중" };
    res.dialogue = dialogue; res.request = request; res.teachers = teachers.length;
    return res;
  }

  // ===== 신규 유형 빌더군: 정답을 '코드가' 알거나 검증하는 설계 =====
  function splitSentences(p) {
    var s = String(p || "").replace(/\s+/g, " ").trim();
    var out = s.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g) || [];
    return out.map(function (x) { return x.trim(); }).filter(function (x) { return x.split(" ").length >= 3; });
  }
  var CIRCN = ["①", "②", "③", "④", "⑤"];
  // 여러 자리를 동시에 오형태로 치환하는 markWords 확장(어법 개수형·네모형)
  function markWordsMulti(passage, words, corruptMap) {
    var circ = "ⓐⓑⓒⓓⓔ", out = "", rest = passage, count = 0;
    for (var i = 0; i < words.length && i < 5; i++) {
      var w = String(words[i] || "").trim(); if (!w) return null;
      var re = new RegExp((/^[A-Za-z0-9]/.test(w) ? "\\b" : "") + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[A-Za-z0-9]$/.test(w) ? "\\b" : ""), "i");
      var m = re.exec(rest); if (!m) return null;
      out += rest.slice(0, m.index) + circ.charAt(i) + "<u>" + (corruptMap && corruptMap[i + 1] ? corruptMap[i + 1] : m[0]) + "</u>";
      rest = rest.slice(m.index + m[0].length); count++;
    }
    return { text: out + rest, count: count };
  }
  // 글의순서: 코드가 지문을 도입+3덩이로 분할·셔플 → 정답 배열을 코드가 안다(LLM 불요)
  function buildOrder(passage) {
    var ss = splitSentences(passage);
    if (ss.length < 5) return null;
    var lead = ss.slice(0, 1).join(" ");
    var rest = ss.slice(1);
    var k = Math.floor(rest.length / 3), cut1 = k, cut2 = 2 * k + (rest.length % 3 > 1 ? 1 : 0);
    var chunks = [rest.slice(0, cut1).join(" "), rest.slice(cut1, cut2).join(" "), rest.slice(cut2).join(" ")];
    if (chunks.some(function (c) { return c.split(" ").length < 5; })) return null;
    var labels = ["A", "B", "C"], perm;
    do { perm = labels.slice().sort(function () { return Math.random() - 0.5; }); } while (perm.join("") === "ABC");
    // perm[i] = 원문 i번째 덩이에 붙은 라벨 → 정답 순서는 perm 그대로
    var byLabel = {}; perm.forEach(function (L, i) { byLabel[L] = chunks[i]; });
    var correct = perm.join("");
    var CHO = ["(A) - (C) - (B)", "(B) - (A) - (C)", "(B) - (C) - (A)", "(C) - (A) - (B)", "(C) - (B) - (A)"];
    var key = "(" + correct[0] + ") - (" + correct[1] + ") - (" + correct[2] + ")";
    var ai = CHO.indexOf(key); if (ai < 0) return null;   // ABC는 위 do-while로 배제됨
    var pg = lead + "\n\n(A) " + byLabel["A"] + "\n\n(B) " + byLabel["B"] + "\n\n(C) " + byLabel["C"];
    return { type: "글의순서", instruction: "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?", passage: pg, choices: CHO, answer: ai + 1, explanation: "원문 전개 순서는 " + key + "이다. 각 단락의 지시어·연결어가 앞 내용을 받아 이 순서로만 논리가 이어진다.", _audit: "정답 코드생성됨(분할·셔플을 코드가 수행)" };
  }
  // 문장삽입: 코드가 문장 1개를 뽑고 ①~⑤ 위치를 찍는다 → 정답 위치를 코드가 안다
  function buildInsertion(passage) {
    var ss = splitSentences(passage);
    if (ss.length < 6) return null;
    var cand = [];
    for (var i = 2; i < ss.length - 1; i++) { if (/^(However|For example|For instance|Therefore|Thus|Instead|In addition|Moreover|As a result|In contrast|Similarly|Nevertheless)\b/i.test(ss[i]) || /\b(this|these|such|it|they)\b/i.test(ss[i].split(" ").slice(0, 4).join(" "))) cand.push(i); }
    var pick = cand.length ? cand[rint(cand.length)] : (2 + rint(ss.length - 3));
    var given = ss[pick];
    var rest2 = ss.slice(0, pick).concat(ss.slice(pick + 1));
    // 삽입 슬롯 5개: 정답(pick 위치=rest2에서 pick 앞 경계) 포함 연속 5경계
    var slotStart = Math.max(1, Math.min(pick - 2, rest2.length - 4));   // 경계 인덱스(문장 j 앞) j=slotStart..slotStart+4
    var ansSlot = pick - slotStart + 1; if (!(ansSlot >= 1 && ansSlot <= 5)) return null;
    var pg = "", n = 0;
    for (var j = 0; j < rest2.length; j++) {
      if (j >= slotStart && j < slotStart + 5) { n++; pg += " ( " + CIRCN[n - 1] + " ) "; }
      pg += (j ? " " : "") + rest2[j];
    }
    return { type: "문장삽입", instruction: "글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?", passage: "[주어진 문장] " + given + "\n\n" + pg.trim(), choices: CIRCN.slice(), answer: ansSlot, explanation: "주어진 문장의 연결 단서가 " + CIRCN[ansSlot - 1] + " 앞뒤 문장과만 자연스럽게 이어진다(원문 위치).", _audit: "정답 코드생성됨(추출·슬롯 배치를 코드가 수행)" };
  }
  // 무관문장: LLM이 '소재는 같지만 논지 이탈' 문장 1개 작성 → 코드가 삽입 위치를 정한다
  async function buildIrrelevant(passage) {
    var ss = splitSentences(passage);
    if (ss.length < 5) return null;
    var o = null;
    for (var att = 0; att < 3 && !o; att++) {   // 내부 재시도(LLM 1콜짜리 재료 수급의 변동성 흡수)
      var r0 = await llmJSON([{ role: "system", content: "무관문장 출제자. JSON만." }, { role: "user", content: "다음 글의 소재·핵심 명사는 재사용하되 글의 논지에서는 벗어난 '그럴듯한 무관 문장' 1개를 영어로 만들어라(너무 무관하면 쉬워짐 — 미세하게 이탈). JSON: {\"sentence\":\"영어 한 문장\"}.\n\n" + passage }], { temperature: att ? 0.75 : 0.6, timeout: 55000 });
      if (r0 && r0.sentence && String(r0.sentence).split(" ").length >= 5) o = r0;
    }
    if (!o) return null;
    var body = ss.slice(1, 5); if (body.length < 4) return null;
    var pos = 1 + rint(4);   // 1~4번째 사이 + 삽입 후 ①~⑤
    var withIt = body.slice(0, pos).concat([String(o.sentence).trim()]).concat(body.slice(pos));
    var pg = ss[0] + " " + withIt.slice(0, 5).map(function (s, i) { return CIRCN[i] + " " + s; }).join(" ") + " " + ss.slice(5).join(" ");
    return { type: "무관문장", instruction: "다음 글에서 전체 흐름과 관계 없는 문장은?", passage: pg.trim(), choices: CIRCN.slice(), answer: pos + 1, explanation: "해당 문장은 소재는 같지만 글의 논지(주장 전개)에서 벗어난다. 제거하면 앞뒤가 자연스럽게 이어진다.", _audit: "정답 코드생성됨(삽입 위치를 코드가 결정)" };
  }
  // 연결어빈칸: 지문 속 연결어를 코드가 탐지·빈칸화 → 정답 쌍을 코드가 안다
  var CONNECTIVES = { 대조: ["However", "In contrast", "Nevertheless", "On the other hand"], 인과: ["Therefore", "Thus", "As a result", "Consequently"], 예시: ["For example", "For instance"], 첨가: ["In addition", "Moreover", "Furthermore", "Similarly"], 전환: ["Instead", "Meanwhile", "Otherwise"] };
  function buildConnective(passage) {
    var all = []; Object.keys(CONNECTIVES).forEach(function (g) { CONNECTIVES[g].forEach(function (c) { all.push({ c: c, g: g }); }); });
    var found = [];
    all.forEach(function (x) { var re = new RegExp("(^|[.!?]\\s+)" + x.c.replace(/ /g, "\\s+") + "\\b", "g"); var m; while ((m = re.exec(passage))) found.push({ c: x.c, g: x.g, at: m.index + m[1].length }); });
    found.sort(function (a, b) { return a.at - b.at; });
    if (found.length < 2) return null;
    var A = found[0], B = found[found.length - 1];
    var pg = passage.slice(0, A.at) + "___(A)___" + passage.slice(A.at + A.c.length, B.at) + "___(B)___" + passage.slice(B.at + B.c.length);
    function wrongOf(g) { var ks = Object.keys(CONNECTIVES).filter(function (k) { return k !== g; }); var k = ks[rint(ks.length)]; return CONNECTIVES[k][rint(CONNECTIVES[k].length)]; }
    var correct = A.c + " …… " + B.c, set = {}, ch = [correct]; set[correct] = 1;
    var guard = 0;
    while (ch.length < 5 && guard++ < 40) { var w = (rint(2) ? A.c : wrongOf(A.g)) + " …… " + (ch.length % 2 ? wrongOf(B.g) : (rint(2) ? wrongOf(B.g) : B.c)); if (w !== correct && !set[w]) { set[w] = 1; ch.push(w); } }
    if (ch.length < 5) return null;
    ch.sort(function () { return Math.random() - 0.5; });
    return { type: "연결어빈칸", instruction: "빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: pg, choices: ch, answer: ch.indexOf(correct) + 1, explanation: "(A)에는 " + A.c + "(" + A.g + "), (B)에는 " + B.c + "(" + B.g + ")가 앞뒤 문장의 논리 관계와 일치한다.", _audit: "정답 코드생성됨(원문 연결어 탐지·빈칸화)" };
  }
  // 어법 개수형: 코드가 k개(2~3)를 지정, LLM은 각 자리 오형태만 제공 → 개수 정답을 코드가 안다
  async function buildGrammarCount(passage) {
    var k = 2 + rint(2);
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어법 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 판단 지점 5곳을 '지문에 나온 그대로의 짧은 구절(각 2~6단어, 등장순)'로 고르고, 그 중 정확히 " + k + "곳의 '문법 오형태'를 만들어라(철자 오타 금지 — 수일치·태·준동사·관계사·병렬 등). JSON: {\"phrases\":[\"구절 5개(등장순, 원문 그대로)\"],\"errors\":[{\"index\":1~5,\"wrong\":\"그 구절의 틀린 형태\"} " + k + "개]}. JSON만.\n\n" + passage }], { noRule: true, temperature: 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.phrases) || o.phrases.length < 5 || !Array.isArray(o.errors)) continue;
      var phr = o.phrases.slice(0, 5).map(String);
      var map = {}, ok = true, used = {};
      o.errors.slice(0, k).forEach(function (e) { var i = parseInt(e.index, 10); if (!(i >= 1 && i <= 5) || used[i] || !e.wrong || normTok(e.wrong) === normTok(phr[i - 1])) { ok = false; return; } used[i] = 1; map[i] = String(e.wrong).trim(); });
      if (!ok || Object.keys(map).length !== k) continue;
      var mk = markWordsMulti(passage, phr, map);
      if (!mk || mk.count < 5) continue;
      return { type: "어법개수형", instruction: "밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것의 개수는?", passage: mk.text, choices: ["1개", "2개", "3개", "4개", "5개"], answer: k, explanation: "틀린 곳은 " + Object.keys(map).map(function (i) { return CIRC5(+i) + "(" + map[i] + " → " + phr[i - 1] + ")"; }).join(", ") + " — 총 " + k + "개.", _audit: "정답 코드생성됨(오류 " + k + "개를 코드가 주입)" };
    }
    return null;
  }
  // 네모 (A)(B)(C)형(어법/어휘): 코드가 [옳음/틀림] 배열과 정답 조합을 결정
  async function buildBoxABC(passage, mode) {
    var isVocab = mode === "vocab";
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: (isVocab ? "어휘" : "어법") + " 출제자. JSON만." }, { role: "user", content: "다음 지문에서 " + (isVocab ? "문맥 판단이 필요한 핵심 단어" : "어법 판단 지점(짧은 구절 2~4단어)") + " 3곳을 '지문에 나온 그대로(등장순)' 고르고, 각각의 " + (isVocab ? "문맥상 부적절한 반의어" : "문법 오형태(철자 오타 금지)") + "를 만들어라. JSON: {\"items\":[{\"correct\":\"원문 그대로\",\"wrong\":\"틀린 형태\"} 3개(등장순)]}. JSON만.\n\n" + passage }], { noRule: true, temperature: 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.items) || o.items.length < 3) continue;
      var items = o.items.slice(0, 3).map(function (x) { return { c: String(x.correct || "").trim(), w: String(x.wrong || "").trim() }; });
      if (items.some(function (x) { return !x.c || !x.w || normTok(x.c) === normTok(x.w); })) continue;
      // 코드가 순서대로 (A)(B)(C) 네모 삽입 + 각 네모의 [좌/우] 배열 랜덤
      var rest = passage, out = "", okAll = true, keyArr = [];
      var LBL = ["(A)", "(B)", "(C)"];
      for (var i = 0; i < 3; i++) {
        var w = items[i].c;
        var re = new RegExp((/^[A-Za-z0-9]/.test(w) ? "\\b" : "") + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[A-Za-z0-9]$/.test(w) ? "\\b" : ""), "i");
        var m = re.exec(rest); if (!m) { okAll = false; break; }
        var flip = rint(2);   // 0: [정/오], 1: [오/정]
        var box = LBL[i] + " [" + (flip ? items[i].w : m[0]) + " / " + (flip ? m[0] : items[i].w) + "]";
        keyArr.push(m[0]);
        out += rest.slice(0, m.index) + box; rest = rest.slice(m.index + m[0].length);
      }
      if (!okAll) continue;
      var pg = out + rest;
      var correct = "(A) " + keyArr[0] + " - (B) " + keyArr[1] + " - (C) " + keyArr[2];
      var ch = [correct], set = {}; set[correct] = 1;
      var guard = 0;
      while (ch.length < 5 && guard++ < 40) {
        var pick = keyArr.map(function (kk, i2) { return rint(2) ? kk : items[i2].w; });
        var s = "(A) " + pick[0] + " - (B) " + pick[1] + " - (C) " + pick[2];
        if (!set[s]) { set[s] = 1; ch.push(s); }
      }
      if (ch.length < 5) continue;
      ch.sort(function () { return Math.random() - 0.5; });
      return { type: isVocab ? "네모어휘ABC" : "네모어법ABC", instruction: "(A), (B), (C)의 각 네모 안에서 " + (isVocab ? "문맥에 맞는 낱말로" : "어법에 맞는 표현으로") + " 가장 적절한 것은?", passage: pg, choices: ch, answer: ch.indexOf(correct) + 1, explanation: "정답 조합: " + correct + ". 각 네모에서 " + (isVocab ? "문맥 극성" : "문법 규칙") + "상 원문 형태만 성립한다.", _audit: "정답 코드생성됨(네모·조합을 코드가 구성)" };
    }
    return null;
  }
  // 영영풀이 일치: Free Dictionary 정의 4개 정상 + 1개는 다른 단어 정의로 스왑(코드 제어)
  async function buildEngdefMatch(passage) {
    var cw = contentWords(passage).filter(function (w) { return w.length >= 4; }).slice(0, 16);
    var defs = [], seen = {};
    for (var i = 0; i < cw.length && defs.length < 6; i++) {
      var w0 = String(cw[i]).toLowerCase();
      // 굴절형 정규화 시도: 원형 우선 조회(사전 적중률↑)
      var cands = [w0]; if (/ies$/.test(w0)) cands.push(w0.replace(/ies$/, "y")); if (/es$/.test(w0)) cands.push(w0.replace(/es$/, "")); if (/s$/.test(w0)) cands.push(w0.replace(/s$/, "")); if (/ed$/.test(w0)) cands.push(w0.replace(/ed$/, ""), w0.replace(/d$/, "")); if (/ing$/.test(w0)) cands.push(w0.replace(/ing$/, ""), w0.replace(/ing$/, "e"));
      for (var c = 0; c < cands.length; c++) {
        if (seen[cands[c]]) continue; seen[cands[c]] = 1;
        try { var d = await dict(cands[c]); var dd = d && (d.def || (d.meanings && d.meanings[0] && d.meanings[0].def)); if (dd && dd.length > 12) { defs.push({ w: cw[i], def: dd }); break; } } catch (_) {}
      }
    }
    if (defs.length < 6) return null;
    // markWords는 '등장순' 매칭 — contentWords는 빈도순이므로 지문 내 첫 등장 위치로 정렬
    var pl2 = passage.toLowerCase();
    defs.forEach(function (x) { x.at = pl2.indexOf(String(x.w).toLowerCase()); });
    defs = defs.filter(function (x) { return x.at >= 0; }).sort(function (a, b) { return a.at - b.at; });
    if (defs.length < 6) return null;
    var spare = defs.pop();                                   // 마지막 등장 단어를 스왑용 예비로
    var five = defs.slice(0, 5);
    var swap = rint(5);
    var shown = five.map(function (x, i) { return { w: x.w, def: (i === swap ? spare.def : x.def) }; });
    var mk = markWords(passage, five.map(function (x) { return x.w; }), -1, "");
    if (!mk || mk.count < 5) return null;
    return { type: "영영풀이일치", instruction: "밑줄 친 ⓐ~ⓔ의 영영풀이로 적절하지 않은 것은?", passage: mk.text, choices: shown.map(function (x, i) { return x.w + ": " + String(x.def).slice(0, 80); }), answer: swap + 1, explanation: "정답 " + CIRC5(swap + 1) + "의 풀이는 '" + spare.w + "'의 정의이다. '" + five[swap].w + "'의 올바른 풀이: " + String(five[swap].def).slice(0, 80), _audit: "정답 코드생성됨(정의 스왑을 코드가 수행·Free Dictionary 검증)" };
  }
  // 빈칸(문장): 결론부 문장 전체를 비우고 정답은 그 문장(재진술), 오답은 역할별
  async function buildBlankSentence(passage) {
    var ss = splitSentences(passage);
    if (ss.length < 4) return null;
    var idx = ss.length - 1 - rint(2);   // 마지막 또는 그 앞 문장
    var target = ss[idx];
    var pg = ss.map(function (s, i) { return i === idx ? "[                         ]" : s; }).join(" ");
    var o = await llmJSON([{ role: "system", content: "빈칸(문장형) 출제자. JSON만." }, { role: "user", content: "빈칸 자리의 원문 문장: \"" + target + "\"\n이 문장을 의미 동일하게 패러프레이즈한 '정답 문장' 1개와, 글의 논지와 어긋나는 오답 문장 4개(부분일치·정반대·무관·과장 각 1)를 만들어라. 길이·형태 통일. JSON: {\"answer\":\"정답 문장\",\"wrong\":[\"오답 4개\"]}. JSON만.\n\n[전체 지문]\n" + passage }], { temperature: 0.5, timeout: 60000 });
    if (!o || !o.answer || !Array.isArray(o.wrong) || o.wrong.length < 4) return null;
    var ch = [String(o.answer)].concat(o.wrong.slice(0, 4).map(String));
    ch.sort(function () { return Math.random() - 0.5; });
    var ai = ch.indexOf(String(o.answer)) + 1;
    return { type: "빈칸(문장)", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것은?", passage: pg, choices: ch, answer: ai, explanation: "빈칸에는 원문 '" + target + "'의 재진술인 정답이 들어가야 글의 결론이 완성된다.", _audit: "빈칸 위치 코드선정(결론부)·정답 재진술" };
  }
  // 문장전환 전용: 원문 문장 실존 + 전환 형태를 코드가 검증
  var CONVERT_SPEC = {
    "태": { req: "능동↔수동으로 전환(by구 처리 명시)", check: function (s) { return /\b(is|are|was|were|be|been|being)\s+\w+(ed|en|wn|ne)\b/i.test(s) || /\bby\b/i.test(s); } },
    "분사구문": { req: "부사절을 분사구문으로(또는 역방향) 전환. 의미상 주어 일치 확인", check: function (s) { return /^(Having|Being|\w+ing|\w+ed)\b/.test(s.trim()) || /,\s*(having|being|\w+ing)\b/i.test(s); } },
    "관계사": { req: "두 문장을 관계사로 결합(또는 관계사절 분해)", check: function (s) { return /\b(who|whose|whom|which|that|where|when)\b/i.test(s); } },
    "가정법": { req: "직설법↔가정법 전환(시제 대응·극성 반전 유의)", check: function (s) { return /\b(if|wish|would|could|might|had)\b/i.test(s); } },
    "강조도치": { req: "It ~ that 강조 또는 부정어 도치(Never/Only 등, 주어-조동사 도치)", check: function (s) { return /^(It\s+(is|was)\b|Never\b|Only\b|Not until\b|Hardly\b|Little\b)/i.test(s.trim()); } }
  };
  async function buildConvert(passage, subtype) {
    var spec = CONVERT_SPEC[subtype] || CONVERT_SPEC["태"];
    var ss = splitSentences(passage);
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "문장전환 서술형 출제자. JSON만." }, { role: "user", content: "다음 지문에서 '" + subtype + " 전환'에 적합한 문장 1개를 '원문 그대로' 고르고 전환하라. 요구: " + spec.req + ". JSON: {\"sentence\":\"지문 속 원문 문장 그대로\",\"converted\":\"전환된 문장\",\"point\":\"전환 포인트 한 줄\"}. JSON만.\n\n" + passage }], { noRule: true, temperature: attempt ? 0.6 : 0.4, timeout: 55000 });
      if (!o || !o.sentence || !o.converted) continue;
      var si = idxContaining(ss, o.sentence);
      if (si < 0) continue;                                   // 원문에 없는 문장(유령) → 재시도
      if (normTok(o.sentence) === normTok(o.converted)) continue;
      if (!spec.check(String(o.converted))) continue;         // 전환 형태 마커 검증
      var instr = "다음 문장을 " + ({ "태": "수동태(또는 능동태)", "분사구문": "분사구문을 사용한 문장으로", "관계사": "관계사를 사용하여 한 문장으로", "가정법": "가정법 문장으로", "강조도치": "강조(It ~ that) 또는 도치 구문으로" }[subtype] || subtype) + " 바꿔 쓰시오.\n[원문] " + ss[si] + "\n〈조건〉 주어진 문장의 의미·시제를 유지할 것.";
      return { type: "문장전환(" + subtype + ")", instruction: instr, passage: "", choices: [], answer: 0, explanation: "[모범답안] " + o.converted + (o.point ? (" (포인트: " + o.point + ")") : ""), _audit: "원문 실존·전환형태 코드검증됨" };
    }
    return null;
  }
  // 우리말해석 전용: '코드가' 복문 하나를 선택해 발문에 원문을 반드시 포함(발문에 영어 원문 부재 결함 해결)
  async function buildTranslateKo(passage) {
    var ss = splitSentences(passage);
    if (!ss.length) return null;
    var scored = ss.map(function (s, i) { return { s: s, i: i, sc: (s.split(" ").length >= 12 ? 2 : 0) + (/\b(who|which|that|whose|although|because|while|if|when)\b/i.test(s) ? 2 : 0) + (/\b(is|are|was|were)\s+\w+(ed|en)\b/i.test(s) ? 1 : 0) }; });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var target = scored[0].s;
    var ko = "";
    try { ko = await translate(target.replace(/[.?!]+$/, ""), "en|ko"); } catch (_) {}
    var o = await llmJSON([{ role: "system", content: "우리말 해석 서술형 출제·채점자. JSON만." }, { role: "user", content: "다음 영어 문장의 정확한 우리말 모범 해석과 구문 포인트 1개를 제시하라." + (ko ? (" 참고 기계번역(다듬을 것): " + ko) : "") + " JSON: {\"ko\":\"모범 해석(자연스러운 한국어 한 문장)\",\"point\":\"구문 포인트(예: 관계사절, 수동태)\"}. JSON만.\n\n" + target }], { noRule: true, temperature: 0.3, timeout: 55000 });
    var best = (o && o.ko) ? String(o.ko) : ko;
    if (!best || best.length < 8) return null;
    return { type: "우리말해석", instruction: "다음 밑줄 친 문장을 우리말로 해석하시오.\n[원문] " + target, passage: "", choices: [], answer: 0, explanation: "[모범답안] " + best + ((o && o.point) ? (" (구문 포인트: " + o.point + " — 반영 여부가 채점 축)") : ""), _audit: "대상 문장 코드선정(복문 우선)·원문 발문 포함" };
  }
  // 첫글자어휘 전용: '코드가' 단어를 고르고 빈칸·첫글자 힌트 생성 → 정답을 코드가 안다
  function buildInitialVocab(passage) {
    var cw = contentWords(passage).filter(function (w) { return w.length >= 5 && /^[a-z]+$/i.test(w); });
    if (!cw.length) return null;
    var w = cw[rint(Math.min(cw.length, 8))];
    var re = new RegExp("\\b" + w + "\\b", "i");
    var m = re.exec(passage); if (!m) return null;
    var blanked = passage.slice(0, m.index) + w.charAt(0) + "_".repeat(Math.max(3, w.length - 1)) + passage.slice(m.index + m[0].length);
    return { type: "첫글자어휘", instruction: "다음 글의 빈칸에 들어갈 단어를 주어진 첫 글자로 시작하여 쓰시오. (본문에 쓰인 형태 그대로)", passage: blanked, choices: [], answer: 0, explanation: "[모범답안] " + m[0] + " — 문단의 논지상 이 자리에는 '" + m[0] + "'가 유일하게 자연스럽다.", _audit: "정답 코드생성됨(빈칸·첫글자 힌트를 코드가 구성)" };
  }
  // 지문 늘리기(증편): 논지·문체 유지 + 부연·예시 추가, 원문 문장 보존을 '코드로' 검증
  async function extendPassage(passage, opts) {
    opts = opts || {};
    var addN = opts.addSentences || 3;
    for (var attempt = 0; attempt < 2; attempt++) {
      var o = await llmJSON([{ role: "system", content: "영어 지문 증편 편집자. 원문 문장은 한 단어도 바꾸지 않고 그대로 유지한다. JSON만." }, { role: "user", content: "다음 글의 논지·문체·시제를 유지하면서, 자연스러운 위치에 부연·예시·근거 문장 " + addN + "개를 추가해 지문을 확장하라. 원문 문장은 삭제·수정 금지(모두 그대로 포함). 추가 문장은 글 주제에 대한 사실적 상식 범위로. JSON: {\"extended\":\"확장된 지문 전체\",\"added\":[\"추가한 문장들\"]}. JSON만.\n\n" + passage }], { temperature: attempt ? 0.65 : 0.5, timeout: 75000 });
      if (!o || !o.extended || String(o.extended).length < passage.length) continue;
      var extNorm = normTok(o.extended);
      var lost = splitSentences(passage).filter(function (s2) { return extNorm.indexOf(normTok(s2)) < 0; });
      if (lost.length && attempt === 0) continue;   // 원문 훼손 → 1회 재시도
      return { extended: String(o.extended).trim(), added: (o.added || []).map(String), preserved: lost.length === 0, lostCount: lost.length };
    }
    return null;
  }
  // 영영풀이 단어쓰기: 정의를 Free Dictionary에서 '코드가' 확보해 발문에 조립(정의 부재·순환정의 차단)
  async function buildEngdefWrite(passage) {
    var cw = contentWords(passage).filter(function (w) { return w.length >= 5 && /^[a-z]+$/i.test(w); }).slice(0, 12);
    for (var i = 0; i < cw.length; i++) {
      var w = String(cw[i]).toLowerCase();
      try {
        var d = await dict(w); var dd = d && (d.def || (d.meanings && d.meanings[0] && d.meanings[0].def));
        if (!dd || dd.length < 15) continue;
        if (normTok(dd).indexOf(normTok(w)) >= 0) continue;   // 순환정의(정의에 정답 노출) 차단 — 검수 v2 지적사항
        return { type: "영영풀이단어쓰기", instruction: "다음 영영풀이에 해당하는 단어를 본문에서 찾아 쓰시오. (첫 글자: " + w.charAt(0) + ")\n[영영풀이] " + String(dd).slice(0, 160), passage: "", choices: [], answer: 0, explanation: "[모범답안] " + w + " (본문에 쓰인 형태 그대로 인정, 굴절형은 채점 시 명시)", _audit: "정의 실제사전 확보·순환정의 차단·첫글자 코드조립" };
      } catch (_) {}
    }
    return null;
  }
  // 문장전환(통합): 지문을 스캔해 '이 지문에 맞는' 전환 유형을 자동 선택 → buildConvert 위임
  async function buildConvertAuto(passage) {
    var ss = splitSentences(passage), cand = [];
    var hasRel = ss.some(function (s) { return /\b(who|whose|whom|which|that)\b/i.test(s) && s.split(" ").length >= 8; });
    var hasPassiveable = ss.some(function (s) { return /\b(is|are|was|were|has|have|had)\b/i.test(s) && /\b\w+(ed|en)\b/.test(s); });
    var hasAdvCl = ss.some(function (s) { return /\b(Because|Although|While|When|After|Before|Since|As)\b/i.test(s); });
    var hasIf = ss.some(function (s) { return /\bif\b/i.test(s); });
    if (hasPassiveable) cand.push("태");
    if (hasAdvCl) cand.push("분사구문");
    if (hasRel) cand.push("관계사");
    if (hasIf) cand.push("가정법");
    cand.push("강조도치");                                     // 어떤 지문이든 가능(It~that 강조)
    // 지문 특징에 맞는 후보 중 무작위 1개 → 실패 시 다음 후보로 폴백
    cand.sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < cand.length; i++) {
      var q = await buildConvert(passage, cand[i]).catch(function () { return null; });
      if (q) { q.type = "문장전환"; q._audit = (q._audit || "") + " · 지문 분석으로 '" + cand[i] + "' 전환 자동 선택"; return q; }
    }
    return null;
  }
  // 장문세트: 1지문 2~3문항(동형 모의고사용) — 기존 빌더 재사용, subItems로 반환
  async function buildLongSet(passage, opts) {
    opts = opts || {};
    var subs = [], setPg = passage, plan = [["제목", function () { return buildInference(passage, "제목", { fast: true }); }], ["어휘", function () { return buildVocab(passage); }], ["내용불일치", function () { return buildFactCheck(passage, false); }]];
    for (var i = 0; i < plan.length && subs.length < (opts.n || 3); i++) {
      try { var q = await plan[i][1](); if (q) { if (q.passage && q.passage !== passage) setPg = q.passage; q.passage = ""; subs.push(q); } } catch (_) {}
    }
    if (subs.length < 2) return null;
    return { type: "장문세트", instruction: "[" + subs.length + "문항 세트] 다음 글을 읽고, 물음에 답하시오.", passage: setPg, choices: [], answer: 0, explanation: "세트 문항 " + subs.length + "개(각 문항 해설 참조).", subItems: subs, _audit: "세트 " + subs.length + "문항(" + subs.map(function (s) { return s.type; }).join("·") + ")" + (setPg !== passage ? " · 조작 공통지문 반영" : "") };
  }

  var BUILDERS = {
    "주제": function (p, o) { return buildInference(p, "주제", o); }, "제목": function (p, o) { return buildInference(p, "제목", o); }, "요지": function (p, o) { return buildInference(p, "요지", o); },
    "빈칸": buildBlank, "함의": buildImplication, "요약": buildSummary,
    "내용불일치": function (p, o) { return buildFactCheck(p, false, o); }, "내용일치": function (p, o) { return buildFactCheck(p, true, o); },
    "어휘": buildVocab, "어법": buildGrammar, "서술형": buildEssay
  };

  // ===== 내신 유형 DB (외부 JSON에서 실시간 로드) =====
  var TYPE_GUIDE = {}, TYPE_INSTR = {}, TYPE_BUILDER_HINT = {}, TYPE_DB_INFO = { source: "내장 기본", count: BEST_TYPES.length, at: "" };
  var BUILDER_BY_KEY = {
    inference: function (p, o, t) { return buildInference(p, t, o); },
    vocab: function (p, o) { return buildVocab(p, o); }, grammar: function (p, o) { return buildGrammar(p, o); },
    blank: function (p, o) { return buildBlank(p, o); }, implication: function (p, o) { return buildImplication(p, o); },
    summary: function (p, o) { return buildSummary(p, o); }, factcheck0: function (p, o) { return buildFactCheck(p, false, o); },
    factcheck1: function (p, o) { return buildFactCheck(p, true, o); }, essay: function (p, o, t) { return buildEssay(p, o, t); }
  };
  // 빌더 발문이 '내용'(조건·원문·우리말·제시어·다행)을 담고 있으면 유형DB 표준 발문으로 덮지 않는다(서술형 조건 소실 방지)
  function hasRichInstr(instr, stem) {
    var s2 = String(instr || "");
    if (!s2) return false;
    if (/〈조건〉|\[원문\]|우리말\s*:|주어진 단어|제시어|괄호 안|첫 글자|\n/.test(s2)) return true;
    return s2.length > String(stem || "").length + 25;
  }
  function builderFor(t) {
    if (t === "배열영작") return function (p, o) { return buildArrange(p, o); };
    if (t === "조건영작") return function (p, o) { return buildConditional(p, o); };
    if (t === "어법수정") return function (p, o) { return buildGrammarEdit(p, o); };
    // 신규 유형(정답 코드제어) 특례 — 유형DB의 builder 키보다 우선
    if (t === "문장전환") return function (p) { return buildConvertAuto(p); };   // 통합형: 지문에 맞는 전환을 자동 선택
    var cm = String(t).match(/^문장전환\((태|분사구문|관계사|가정법)\)/); if (cm) return function (p) { return buildConvert(p, cm[1]); };
    if (/강조|도치/.test(t) && /전환/.test(t)) return function (p) { return buildConvert(p, "강조도치"); };
    if (/글의\s*순서|^순서$/.test(t)) return function (p) { return Promise.resolve(buildOrder(p)); };
    if (/문장삽입/.test(t)) return function (p) { return Promise.resolve(buildInsertion(p)); };
    if (/무관/.test(t)) return function (p) { return buildIrrelevant(p); };
    if (/연결어/.test(t)) return function (p) { return Promise.resolve(buildConnective(p)); };
    if (/어법개수/.test(t)) return function (p) { return buildGrammarCount(p); };
    if (/네모어법/.test(t)) return function (p) { return buildBoxABC(p, "grammar"); };
    if (/네모어휘/.test(t)) return function (p) { return buildBoxABC(p, "vocab"); };
    if (/영영풀이일치/.test(t)) return function (p) { return buildEngdefMatch(p); };
    if (/영영풀이단어|영영풀이.*쓰기/.test(t)) return function (p) { return buildEngdefWrite(p); };
    if (/빈칸\(문장\)/.test(t)) return function (p) { return buildBlankSentence(p); };
    if (/장문세트|복합세트/.test(t)) return function (p, o) { return buildLongSet(p, o); };
    if (/우리말해석|해석/.test(t)) return function (p) { return buildTranslateKo(p); };
    if (/첫글자/.test(t)) return function (p) { return buildInitialVocab(p); };
    var hint = TYPE_BUILDER_HINT[t];
    if (hint && BUILDER_BY_KEY[hint]) return function (p, o) { return BUILDER_BY_KEY[hint](p, o, t); };
    return BUILDERS[t] || function (p, o) { return buildInference(p, t, o); };
  }
  // 외부 유형 DB(JSON 배열 [{type,guide,instruction,builder,on}]) 로드 → 실시간 반영
  async function loadTypeDB(url) {
    try {
      var r = await fetch(url, { cache: "no-store" }); var data = await r.json();
      var arr = Array.isArray(data) ? data : (data.types || []);
      var active = [];
      arr.forEach(function (it) {
        if (!it || !it.type) return;
        if (it.guide) TYPE_GUIDE[it.type] = it.guide;
        if (it.instruction) TYPE_INSTR[it.type] = it.instruction;
        if (it.builder) TYPE_BUILDER_HINT[it.type] = it.builder;
        if (it.on !== false) active.push(it.type);
      });
      if (active.length) { BEST_TYPES.length = 0; active.forEach(function (t) { BEST_TYPES.push(t); }); }
      TYPE_DB_INFO = { source: url, count: active.length, at: "" };
      return { ok: true, count: active.length, types: active };
    } catch (e) { return { ok: false, error: String(e), types: BEST_TYPES.slice() }; }
  }

  // ===== 지문 분석 → 예상 출제 유형 판단(적합도+근거) =====
  async function suggestTypes(passage, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    log(onP, "· 지문 신호 분석(길이·구문)…");
    var words = (passage.match(/[A-Za-z]+/g) || []).length;
    var sents = (passage.match(/[.!?]/g) || []).length;
    var hasQuote = /["'“”]/.test(passage), hasConn = /\b(however|therefore|thus|moreover|in contrast|for example|on the other hand)\b/i.test(passage);
    var stat = "단어 " + words + "개, 문장 약 " + sents + "개" + (hasConn ? ", 연결사 풍부" : "") + (hasQuote ? ", 인용/대화 포함" : "");
    log(onP, "· 출제 유형 판단(LLM)…");
    var j = await llmJSON([
      { role: "system", content: "한국 수능·고교 내신 영어 출제 분석가. 주어진 지문의 논지 구조·추상도·서사성·어휘 수준을 보고 어떤 유형이 잘 출제될지 판단한다. JSON 배열만." },
      { role: "user", content: "다음 지문(" + stat + ")을 분석해, 아래 유형 중 출제 가능성이 높은 순으로 평가하라: " + BEST_TYPES.join(", ") +
        ".\n각 항목 {\"type\":\"유형\",\"fit\":\"상|중|하\",\"reason\":\"한 줄 근거(한국어)\"}. 가능성 높은 순으로 6~8개. JSON 배열만.\n\n[지문]\n" + passage }
    ], { temperature: 0.4, timeout: 60000 });
    var arr = Array.isArray(j) ? j : (j && j.types) || [];
    arr = arr.filter(function (x) { return x && x.type; });
    var order = { "상": 0, "중": 1, "하": 2 };
    arr.sort(function (a, b) { return (order[a.fit] == null ? 3 : order[a.fit]) - (order[b.fit] == null ? 3 : order[b.fit]); });
    return { stat: stat, types: arr };
  }

  // 메인: ① 모든 API로 컨텍스트 사전수집 → ② 유형마다 초미분화 직렬 생성(유형별 3회 재시도)
  // 출제의도(정답지 필수): 유형별 평가 목표 + 구체 논지
  function intentFor(q) {
    var type = q.type || "", core = "";
    var m = /핵심 논지는 '([^']+)'/.exec(q.explanation || ""); if (m) core = m[1];
    var base = {
      "주제": "글 전체를 관통하는 중심 생각을 파악하고, 지엽·정반대·무관·과잉일반화 오답과 변별하는 능력을 평가한다.",
      "제목": "글의 핵심을 함축적으로 대표하는 제목을 고르는 능력을 평가한다.",
      "요지": "필자의 주장을 한 문장으로 요약·판단하는 능력을 평가한다.",
      "빈칸": "문맥의 논리적 흐름으로 핵심 어구를 추론하고, 형태 단서가 아닌 의미로 정답을 고르는 능력을 평가한다.",
      "함의": "밑줄 친 표현의 표면 의미가 아닌 문맥상 함축을 추론하는 능력을 평가한다.",
      "요약": "글의 요지를 한 문장으로 압축하며 두 핵심어(A·B)를 정확히 채우는 능력을 평가한다.",
      "어법": "문장 구조 속 어법 요소(수일치·시제·태·준동사·병렬 등)의 정오를 판단하는 능력을 평가한다.",
      "어휘": "문맥상 적절한 낱말 쓰임(반의·유의 혼동)을 판단하는 능력을 평가한다.",
      "내용불일치": "세부 정보를 지문과 대조해 '일치하지 않는' 진술을 찾는 능력을 평가한다.",
      "내용일치": "세부 정보를 지문과 대조해 '일치하는' 진술을 찾는 능력을 평가한다."
    }[type] || "지문의 핵심 내용을 조건에 맞게 영어로 산출/해석하는 표현력·정확성을 평가한다(조건 준수 포함).";
    return base + (core ? (" [핵심 논지: " + core + "]") : "");
  }
  function stampIntent(q) { if (!q) return q; q.intent = intentFor(q); if (String(q.explanation || "").indexOf("【출제의도】") < 0) q.explanation = String(q.explanation || "") + "\n【출제의도】 " + q.intent; return q; }

  // 자료수집 캐시: 같은 지문이면 재수집 생략(유형 여러 번 출제 시 10~15초 절약)
  var CTXCACHE = {};
  async function cachedContext(passage, onP) {
    var k = passage.length + ":" + passage.slice(0, 64);
    if (CTXCACHE[k]) { log(onP, "■ 자료 수집: 캐시 재사용(같은 지문)"); return CTXCACHE[k]; }
    var c = await prepContext(passage, onP).catch(function () { return {}; });
    CTXCACHE[k] = c; var ks = Object.keys(CTXCACHE); if (ks.length > 4) delete CTXCACHE[ks[0]];
    return c;
  }
  async function generateExam(passage, types, opts) {
    opts = opts || {}; var onP = opts.onProgress, onT = opts.onType || function () {}, USE = null; USE_ENSEMBLE = !!opts.ensemble;
    log(onP, "■ 1단계: 자료 수집반 가동(전 API)…");
    var ctx = await cachedContext(passage, onP);
    if (ctx.topic) log(onP, "   주제어=" + ctx.topic + (ctx.bg ? " · 위키 배경 확보" : "") + " · 반의어 " + Object.keys(ctx.ant || {}).length + "쌍");
    var bopts = { onProgress: onP, ctx: ctx, fast: opts.fast };
    var maxTry = opts.fast ? 3 : 4;
    // 병렬: 키 공급자(Gemini/Groq)는 동시 3유형, 무키(Pollinations 직렬큐)는 1유형
    var PAR = (provider() !== "pollinations") ? Math.min(3, types.length) : 1;
    log(onP, "■ 2단계: 유형별 " + (opts.fast ? "빠른" : "초미분화") + " 출제…" + (PAR > 1 ? (" ⚡병렬 " + PAR + "유형 동시") : ""));
    var idx = 0, results = new Array(types.length);
    async function work() {
      while (true) {
        var i = idx++; if (i >= types.length) return;
        var t = types[i], b = builderFor(t), got = null, t0 = Date.now();
        if (PAR === 1) { RUNHINT = ""; var kbT = kbFor(t); TYPERULE = ((TYPE_GUIDE[t] || "") + (kbT ? (" [KB지침] " + kbT) : "")).slice(0, 950); setLevelRule(t, opts.level); }
        onT(t, "start");
        for (var attempt = 1; attempt <= maxTry && !got; attempt++) {
          if (attempt > 1) onT(t, "retry", attempt);
          log(onP, "〔" + t + "〕" + (attempt > 1 ? "재시도 " + attempt + " " : "") + "출제 중…");
          try { var q = await b(passage, bopts, t); if (q && q.instruction) got = q; } catch (e) {}
          if (!got && attempt === 1 && !opts.fast) {   // 빠른 모드에선 회의 생략(즉시 재시도) — 속도
            record("출제실패", t, "1차 시도 실패");
            log(onP, "   ⚑ API 회의 소집(" + t + ") — 오류 토론·개선…");
            var mt = await convene(t, "1차 시도 실패").catch(function () { return { hint: "" }; });
            RUNHINT = mt.hint || "";
            if (mt.hint) log(onP, "   ↳ 합의 개선지시: " + mt.hint);
          }
        }
        if (PAR === 1) { RUNHINT = ""; TYPERULE = ""; LEVELRULE = ""; }
        if (got) {
          if (TYPE_INSTR[t] && !hasRichInstr(got.instruction, TYPE_INSTR[t])) got.instruction = TYPE_INSTR[t]; got.level = opts.level || "";
          if (opts.refine) { log(onP, "  ↻ 재귀 상호작용 개선(" + t + ") — 검수↔재작성 수렴까지…"); got = await refineLoop(got, { target: opts.refineTarget || 88, maxRounds: opts.rounds || 4, onProgress: onP, passage: passage, panel: opts.ensemble ? (opts.teachers || 3) : 1 }); }
          stampIntent(got); got._ms = Date.now() - t0;
          results[i] = got;
          if (opts.onItem) try { opts.onItem(got, i); } catch (_) {}   // 완성 즉시 UI로 스트리밍
          onT(t, "done", got._ms);
          log(onP, "   ✓ " + t + " 완료(" + Math.round(got._ms / 1000) + "s)");
        } else { record("최종실패", t, "재시도 실패"); onT(t, "fail"); log(onP, "   · " + t + " 생성 실패(건너뜀)"); }
      }
    }
    if (PAR > 1) {
      // 병렬 그룹: 전역 TYPERULE 레이스 방지 — 선택 유형들의 규칙을 결합해 한 번에 주입(각 빌더 프롬프트가 자기 유형만 사용)
      TYPERULE = types.map(function (tt) { var kb = kbFor(tt); return "〔" + tt + "〕" + (TYPE_GUIDE[tt] || "").slice(0, 200) + (kb ? (" " + kb.slice(0, 140)) : ""); }).join(" / ").slice(0, 1900);
      setLevelRule(types[0], opts.level);
      var workers = []; for (var w = 0; w < PAR; w++) workers.push(work());
      await Promise.all(workers);
      TYPERULE = ""; LEVELRULE = ""; RUNHINT = "";
    } else {
      await work();
    }
    var out = results.filter(Boolean);
    log(onP, "✓ 완료 — " + out.length + "/" + types.length + "문항");
    return out;
  }

  // ===== 출제 에이전트(무료 스택 에이전틱 루프): 목표 → 계획 → 생성 → 검수 → 자가수정 → 납품 =====
  async function agentPlan(goal, passage) {
    var PENDING = ["도표일치", "지칭추론", "어법복수선택", "유의어대치부적절", "혼합통합형", "문장전환(태)", "문장전환(분사구문)", "문장전환(관계사)", "문장전환(가정법)", "강조·도치전환"];
    var avail = Object.keys(TYPE_INSTR).filter(function (t) { return PENDING.indexOf(t) < 0; }); if (!avail.length) avail = BEST_TYPES.slice();
    var o = await llmJSON([{ role: "system", content: "너는 고교 영어 출제 계획 수립자다. JSON만." }, { role: "user", content: "사용 가능 유형: " + avail.join(", ") + "\n\n지문(특성 판단용):\n" + String(passage).slice(0, 900) + "\n\n출제 목표: \"" + goal + "\"\n\n목표를 해석해 계획을 세워라. 유형은 반드시 '사용 가능 유형' 목록에서 고르고, 목표에 유형·문항수 지정이 없으면 지문 특성에 맞게 4~6문항을 선정하라(서술형 요구 시 서술 계열 포함). JSON: {\"types\":[\"유형명 배열\"],\"level\":\"하|중|상\",\"note\":\"선정 근거 한 줄\"}. JSON만." }], { noRule: true, temperature: 0.3, timeout: 60000 });
    if (!o || !Array.isArray(o.types) || !o.types.length) return null;
    o.types = o.types.map(String).filter(function (t) { return avail.indexOf(t) >= 0; }).slice(0, 26);
    if (!o.types.length) return null;
    return o;
  }
  async function agentRun(passage, goal, opts) {
    opts = opts || {}; var onP = opts.onProgress, onT = opts.onType || function () {};
    log(onP, "🤖 에이전트 가동 — 목표: " + goal);
    log(onP, "① 계획 수립 중(지문 분석 + 목표 해석)…");
    var plan = await agentPlan(goal, passage);
    if (!plan) { log(onP, "   ✗ 계획 수립 실패 — 목표를 조금 더 구체적으로 적어주세요"); return null; }
    log(onP, "📋 계획: " + plan.types.join(", ") + " · 난이도 " + (plan.level || "중") + (plan.note ? (" — " + plan.note) : ""));
    if (opts.onPlanned) try { opts.onPlanned(plan); } catch (_) {}
    var out = [];
    for (var i = 0; i < plan.types.length; i++) {
      var t = plan.types[i], q = null, verdict = "", t0 = Date.now();
      onT(t, "start");
      for (var att = 0; att < 3 && !q; att++) {
        if (att > 0) onT(t, "retry", att + 1);
        var cand = await generateOne(passage, t, { fast: opts.fast !== false, level: plan.level, onProgress: onP }).catch(function () { return null; });
        if (!cand) { log(onP, "   ✗ " + t + " 생성 실패(" + (att + 1) + "차) — 재시도"); continue; }
        log(onP, "   🔍 검수관 투입(" + t + ") — 코드검증→선지 독립판정→솔버 교차…");
        var rv = await reviewItem(cand, passage, {}).catch(function () { return null; });
        verdict = rv ? rv.verdict : "검수 불가(그대로 납품 보류)";
        if (rv && /불가/.test(String(rv.verdict))) {
          var fixed = false;
          if (rv.fixAnswer >= 1 && rv.fixAnswer <= 5 && cand.choices && cand.choices.length >= 4) { cand.answer = rv.fixAnswer; fixed = true; }
          if (rv.fixChoices && rv.fixChoices.length >= 4) { cand.choices = rv.fixChoices.slice(0, 5).map(String); fixed = true; }
          if (rv.fixExp && String(rv.fixExp).length > 5) { cand.explanation = String(rv.fixExp); fixed = true; }
          if (fixed) { cand._audit = ((cand._audit ? cand._audit + " · " : "") + "에이전트: 검수 수정안 적용 후 통과"); verdict = "수정 후 사용 가능(수정 적용됨)"; q = cand; log(onP, "   ✏ 검수 수정안 적용 → 통과"); }
          else { log(onP, "   ♻ 검수 '사용 불가'(" + String(rv.multi || (rv.errors && rv.errors[0] && rv.errors[0].issue) || "").slice(0, 50) + ") → 재생성"); continue; }
        } else { q = cand; }
      }
      if (q) { q._verdict = verdict; q._ms = Date.now() - t0; if (opts.onItem) try { opts.onItem(q, i); } catch (_) {} out.push(q); onT(t, "done", q._ms); log(onP, "   ✅ " + t + " 확정 — 검수 판정: " + verdict); }
      else { onT(t, "fail"); log(onP, "   ✗ " + t + " 3차 시도 후 포기(불량 문항은 납품하지 않음)"); }
    }
    log(onP, "🤖 에이전트 완료 — " + out.length + "/" + plan.types.length + "문항 · 전 문항 검수 게이트 통과분만 납품");
    return { items: out, plan: plan };
  }
  // 에이전트 피드백 반영: 작성자 피드백 해석 → 대상 문항 수정/재생성/유형교체 → 검수 게이트 재통과
  async function agentFeedback(items, feedback, passage, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    var brief = items.map(function (q, i) { return (i + 1) + ". [" + q.type + "] " + String(q.instruction).split("\n")[0].slice(0, 55); }).join("\n");
    var o = await llmJSON([{ role: "system", content: "너는 출제 피드백 해석기다. JSON만." }, { role: "user", content: "현재 문항 목록:\n" + brief + "\n\n작성자 피드백: \"" + feedback + "\"\n\n해석해서 JSON으로: {\"targets\":[적용할 문항 번호 배열 — '전부/다/모두'면 모든 번호],\"mode\":\"revise(문항 다듬기)|regenerate(새로 생성)\",\"newType\":\"유형 교체 요구 시 유형명(없으면 빈문자)\",\"hint\":\"수정/생성에 주입할 구체 지시 한두 문장(한국어)\"}. JSON만." }], { noRule: true, temperature: 0.3, timeout: 60000 });
    if (!o || !Array.isArray(o.targets) || !o.targets.length) return null;
    var report = [];
    for (var k = 0; k < o.targets.length && k < items.length; k++) {
      var no = parseInt(o.targets[k], 10); var i = no - 1; var cur = items[i];
      if (!cur) { report.push(no + "번: 없는 문항"); continue; }
      log(onP, "🔧 " + no + "번(" + cur.type + ") 피드백 반영 중 — " + (o.hint || feedback).slice(0, 50));
      if (o.mode === "regenerate" || o.newType) {
        RUNHINT = "작성자 피드백(반드시 반영): " + (o.hint || feedback);
        var t = o.newType || cur.type;
        var nq = await generateOne(passage, t, { fast: true, onProgress: onP }).catch(function () { return null; });
        RUNHINT = "";
        if (nq) {
          var rv1 = await reviewItem(nq, passage, {}).catch(function () { return null; });
          if (!(rv1 && /불가/.test(String(rv1.verdict)))) { nq._verdict = rv1 ? rv1.verdict : "검수 보류"; items[i] = nq; report.push(no + "번: " + (o.newType ? ("유형 교체 → " + t) : "재생성") + " 완료 · 검수 " + nq._verdict); continue; }
        }
        report.push(no + "번: 재생성이 검수를 통과하지 못해 원본 유지");
      } else {
        var rj = await llmJSON([{ role: "system", content: "너는 문항 수정 전문가다. 피드백'만' 반영하고 나머지는 유지한다. JSON만." }, { role: "user", content: "[지문]\n" + String(passage).slice(0, 1200) + "\n\n[현재 문항]\n발문: " + cur.instruction + (cur.choices && cur.choices.length ? ("\n선지:\n" + cur.choices.map(function (c, j) { return (j + 1) + ". " + c; }).join("\n")) : "") + "\n정답: " + (cur.answer || "(서술형)") + "\n해설: " + String(cur.explanation).slice(0, 300) + "\n\n[작성자 피드백]\n" + (o.hint || feedback) + "\n\n피드백을 반영해 수정하라. 바뀌는 필드만 채우고 안 바뀌면 null: {\"instruction\":null,\"choices\":null,\"answer\":0,\"explanation\":null}. JSON만." }], { noRule: true, temperature: 0.45, timeout: 75000 });
        if (rj && (rj.instruction || (rj.choices && rj.choices.length) || rj.answer || rj.explanation)) {
          var trial = JSON.parse(JSON.stringify(cur));
          if (rj.instruction) trial.instruction = String(rj.instruction);
          if (rj.choices && rj.choices.length >= 4) trial.choices = rj.choices.slice(0, 5).map(String);
          if (rj.answer >= 1 && rj.answer <= 5) trial.answer = parseInt(rj.answer, 10);
          if (rj.explanation) trial.explanation = String(rj.explanation);
          var rv2 = await reviewItem(trial, passage, {}).catch(function () { return null; });
          if (!(rv2 && /불가/.test(String(rv2.verdict)))) {
            trial._verdict = rv2 ? rv2.verdict : "검수 보류"; trial._audit = ((cur._audit ? cur._audit + " · " : "") + "피드백 반영됨");
            items[i] = trial; report.push(no + "번: 피드백 반영 완료 · 검수 " + trial._verdict); continue;
          }
          report.push(no + "번: 수정본이 검수 '사용 불가' — 원본 유지(사유: " + String((rv2 && (rv2.multi || (rv2.errors && rv2.errors[0] && rv2.errors[0].issue))) || "").slice(0, 60) + ")");
        } else report.push(no + "번: 수정안 생성 실패 — 원본 유지");
      }
    }
    return { items: items, report: report, hint: o.hint || "" };
  }
  // 단일 문항 재생성(개별 문항 🔄용)
  async function generateOne(passage, type, opts) {
    opts = opts || {}; USE_ENSEMBLE = !!opts.ensemble;
    var ctx = opts.ctx || await cachedContext(passage, opts.onProgress);
    var kb1 = kbFor(type); TYPERULE = ((TYPE_GUIDE[type] || "") + (kb1 ? (" [KB지침] " + kb1) : "")).slice(0, 950); setLevelRule(type, opts.level);
    var q = null; for (var _try = 0; _try < 3 && !q; _try++) { try { q = await builderFor(type)(passage, { ctx: ctx, onProgress: opts.onProgress, fast: opts.fast }, type); } catch (_e) { q = null; } }
    TYPERULE = ""; LEVELRULE = "";
    if (q && TYPE_INSTR[type] && !hasRichInstr(q.instruction, TYPE_INSTR[type])) q.instruction = TYPE_INSTR[type];
    if (q) q.level = opts.level || "";
    if (q && opts.refine) q = await refineLoop(q, { target: opts.refineTarget || 88, maxRounds: opts.rounds || 4, onProgress: opts.onProgress, passage: passage, panel: opts.ensemble ? (opts.teachers || 3) : 1 });
    stampIntent(q);
    return q;
  }

  async function transformPassage(passage, mode, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    var modeMap = { paraphrase: "같은 의미·길이로 패러프레이즈(난이도 유지).", simplify: "더 쉬운 어휘·문장으로.", harder: "더 학술적·고난도 어휘·복문으로.", blank: "핵심 한 곳을 ____ 로 비운 빈칸 지문.", cloze: "핵심 5개를 ⓐ~ⓔ <u>밑줄</u>." };
    log(onP, "① LLM 변형…");
    var o = await llmJSON([{ role: "system", content: "영어 교재 편집자. 의미 보존." }, { role: "user", content: (modeMap[mode] || modeMap.paraphrase) + "\n\n[원문]\n" + passage + "\n\n출력 JSON: {\"variant\":\"변형 지문\",\"note\":\"바꾼 점 한 줄\"}. JSON만." }], { temperature: 0.6, timeout: 60000 });
    if (!o || !o.variant) return { variant: "", note: "생성 실패" };
    log(onP, "② 어법 검증…");
    var g = await grammar(String(o.variant).replace(/<[^>]+>/g, " ").replace(/_{2,}/g, " x "));
    if (g.length) { log(onP, "③ 어법 " + g.length + "건 수정…"); var fix = await llmJSON([{ role: "system", content: "영어 교정." }, { role: "user", content: "어법만 고쳐라(의미·표시 유지). 지적: " + g.slice(0, 6).map(function (x) { return '"' + x.bad + '"' + (x.fix ? "→" + x.fix : ""); }).join(", ") + "\n\n" + o.variant + "\n\n출력 JSON: {\"variant\":\"...\"}. JSON만." }], { temperature: 0.2, timeout: 50000 }); if (fix && fix.variant) o.variant = fix.variant; }
    log(onP, "✓ 완료"); return o;
  }

  // ===== 단계별 지문 변형(세분화): 단어→구문→문장→주제유지, 단계마다 다중 API 협업 =====
  var STAGE_INFO = {
    word: { name: "1단계 단어 변형", desc: "문장 구조·어순·길이는 그대로 두고 내용어만 동의어로 교체(의미 100% 보존)" },
    phrase: { name: "2단계 구문 변형", desc: "어휘는 대부분 유지하되 절 순서·태(수동/능동)·연결사·구 구조를 바꿈" },
    sentence: { name: "3단계 문장 재구성", desc: "각 문장을 새 구조+새 어휘로 다시 쓰되 내용(정보)은 동일하게" },
    theme: { name: "4단계 주제만 유지", desc: "주제/논지만 남기고 예시·전개·문장을 전부 새로 써서 완전히 새 지문 생성" }
  };
  async function transformStaged(passage, level, opts) {
    opts = opts || {}; var onP = opts.onProgress; level = level || "word";
    var trace = [], variant = "", changed = [];
    if (level === "word") {
      log(onP, "① 내용어 동의어 수집(Datamuse syn)…");
      var cw = contentWords(passage).slice(0, 14), syn = {};
      await Promise.all(cw.map(async function (w) { try { var s = await datamuse(w, "syn", 3); if (s.length) syn[w] = s; } catch (_) {} }));
      trace.push({ line: 1, api: "datamuse", label: "동의어 " + Object.keys(syn).length + "어 수집", ok: true });
      var hint = Object.keys(syn).map(function (w) { return w + "→" + syn[w].join("/"); }).join(", ");
      log(onP, "② LLM 어휘 치환(구조 유지)…");
      var o = await llmJSON([{ role: "system", content: "영어 교재 편집자. 문장 구조·어순·길이는 '그대로' 두고 내용어만 동의어로 교체한다. 의미 보존. JSON만." }, { role: "user", content: "아래 동의어 후보를 참고해 지문의 구조는 유지하고 핵심 내용어만 자연스러운 동의어로 바꿔라. 후보(강제 아님): " + (hint || "-") + "\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"어휘만 바뀐 지문\",\"changed\":[\"바뀐 단어쌍 예: happiness→well-being 5개\"]}. JSON만." }], { noRule: true, temperature: 0.5, timeout: 60000 });
      trace.push({ line: 2, api: "llm", label: "어휘 치환", ok: !!(o && o.variant) });
      if (o) { variant = o.variant || ""; changed = o.changed || []; }
    } else if (level === "phrase") {
      log(onP, "① 연어 확인(Datamuse bgb)…");
      var cw2 = contentWords(passage).slice(0, 6), col = {};
      await Promise.all(cw2.map(async function (w) { try { var b = await datamuse(w, "bgb", 3); if (b.length) col[w] = b; } catch (_) {} }));
      trace.push({ line: 1, api: "datamuse", label: "연어 확인", ok: true });
      log(onP, "② LLM 구문 재구성(어휘 유지)…");
      var o2 = await llmJSON([{ role: "system", content: "영어 문장 구조 변형가. 어휘는 대부분 유지하되 절 순서·태·연결사·구 구조를 바꿔 같은 의미를 다른 구문으로 표현한다. JSON만." }, { role: "user", content: "지문의 각 문장을 '어휘는 최대한 유지'하되 구문(능동↔수동, 절 순서, 분사구문, 연결사)만 바꿔라. 의미 동일.\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"구문이 바뀐 지문\",\"changed\":[\"바꾼 구문 기법 few개\"]}. JSON만." }], { noRule: true, temperature: 0.55, timeout: 60000 });
      trace.push({ line: 2, api: "llm", label: "구문 재구성", ok: !!(o2 && o2.variant) });
      if (o2) { variant = o2.variant || ""; changed = o2.changed || []; }
    } else if (level === "sentence") {
      log(onP, "① LLM 문장 재구성(구조+어휘 새로, 내용 동일)…");
      var o3 = await llmJSON([{ role: "system", content: "영어 리라이팅 전문가. 각 문장을 새 구조·새 어휘로 다시 쓰되 담긴 정보·논지는 동일하게 보존한다. JSON만." }, { role: "user", content: "지문을 문장 단위로 완전히 새로 써라(구조·표현·어휘 모두 새롭게, 그러나 정보·논리 흐름은 동일). 원문 표현 복사 금지.\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"재구성 지문\",\"changed\":[\"핵심 변화 few개\"]}. JSON만." }], { noRule: true, temperature: 0.6, timeout: 60000 });
      trace.push({ line: 1, api: "llm", label: "문장 재구성", ok: !!(o3 && o3.variant) });
      if (o3) { variant = o3.variant || ""; changed = o3.changed || []; }
    } else { // theme
      log(onP, "① 주제·논지 추출…");
      var theme = await ask("이 글의 주제와 핵심 논지를 영어 한 문장으로(답만).\n\n" + passage, "한 문장. 답만.", { noRule: true });
      trace.push({ line: 1, api: "llm", label: "주제 추출", ok: !!theme });
      log(onP, "② 관련 배경 조회(Wikipedia)…");
      var kw = await ask("이 글의 핵심 주제어를 영어 1~2단어로(답만).\n\n" + passage.slice(0, 300), "단어만.", { noRule: true }).catch(function () { return ""; });
      var bg = kw ? await wiki(kw).catch(function () { return null; }) : null;
      trace.push({ line: 2, api: "wiki", label: "배경 조회", ok: !!bg });
      log(onP, "③ 주제 유지·전면 재창작…");
      var o4 = await llmJSON([{ role: "system", content: "영어 지문 작가. 주어진 주제/논지만 유지하고 예시·전개·문장은 전부 새로 써서 완전히 다른 지문을 만든다(길이 유사, 수능 지문체). JSON만." }, { role: "user", content: "주제/논지: " + (theme || "") + (bg && bg.extract ? ("\n참고 배경: " + bg.extract.slice(0, 200)) : "") + "\n\n이 주제만 유지하고 새로운 예시·근거·전개로 완전히 새 지문(원문과 문장 겹침 금지, 100~140단어)을 써라.\n\nJSON: {\"variant\":\"새 지문\",\"changed\":[\"유지한 주제 1개\",\"새로 넣은 요소 few개\"]}. JSON만." }], { noRule: true, temperature: 0.7, timeout: 60000 });
      trace.push({ line: 3, api: "llm", label: "주제유지 재창작", ok: !!(o4 && o4.variant) });
      if (o4) { variant = o4.variant || ""; changed = o4.changed || []; }
    }
    // 플레이스홀더/빈약 변형 방어: variant가 실제 영어 지문이 아니면(예시문구 복사·짧음) 평문으로 직접 재요청
    function _bad(v) { v = String(v || "").trim(); return v.length < 40 || (v.match(/[A-Za-z]{2,}/g) || []).length < 8 || /^(어휘만|구문이|재구성|새 지문|변형|<)/.test(v); }
    if (_bad(variant)) {
      var fb = { word: "지문의 문장 구조·어순은 그대로 두고 '내용어만 동의어로 교체'한 영어 지문 전문을 출력하라.", phrase: "어휘는 유지하되 구문(태·절 순서·연결사·분사구문)만 바꾼 영어 지문 전문을 출력하라.", sentence: "각 문장을 새 구조·새 어휘로 다시 쓴(정보 동일) 영어 지문 전문을 출력하라.", theme: "이 지문의 주제만 유지하고 예시·전개를 전부 새로 쓴 새 영어 지문(100~140단어)을 출력하라." }[level] || "지문을 자연스럽게 변형한 영어 지문 전문을 출력하라.";
      log(onP, "  ↻ 변형 결과 보강(평문 재요청)…");
      var raw = await llm([{ role: "system", content: "영어 교재 편집자. '영어 지문 본문만' 출력한다(JSON·설명·머리말·따옴표 금지)." }, { role: "user", content: fb + "\n\n[원문]\n" + passage }], { noRule: true, temperature: 0.5, timeout: 60000 });
      raw = String(raw || "").replace(/```/g, "").trim();
      if (!_bad(raw)) { variant = raw; if (!changed.length) changed = ["평문 재생성"]; }
    }
    if (!variant || _bad(variant)) return { variant: "", level: level, note: (STAGE_INFO[level] || {}).name + " 생성 실패", changed: [], _trace: trace };
    // 공통 검증: LanguageTool 어법 + (주제단계) 원문 비중복 확인
    log(onP, "④ 어법 검증(LanguageTool)…");
    var gi = []; try { gi = await grammar(String(variant).replace(/<[^>]+>/g, " ")); } catch (_) {}
    trace.push({ line: trace.length + 1, api: "grammar", label: "어법 검증 " + (gi.length ? (gi.length + "건") : "통과"), ok: true });
    if (gi.length) {
      var fix = await llmJSON([{ role: "system", content: "영어 교정. 의미 유지, 어법만." }, { role: "user", content: "어법만 고쳐라. 지적: " + gi.slice(0, 6).map(function (x) { return '"' + x.bad + '"' + (x.fix ? "→" + x.fix : ""); }).join(", ") + "\n\n" + variant + "\n\nJSON: {\"variant\":\"...\"}. JSON만." }], { noRule: true, temperature: 0.2, timeout: 50000 });
      if (fix && fix.variant) variant = fix.variant;
    }
    log(onP, "✓ " + (STAGE_INFO[level] || {}).name + " 완료");
    return { variant: variant, level: level, stage: (STAGE_INFO[level] || {}).name, note: (STAGE_INFO[level] || {}).desc, changed: changed, audit: gi.length ? ("어법 " + gi.length + "건 교정") : "어법 통과", _trace: trace };
  }

  async function buildVocabList(passage, opts) {
    opts = opts || {}; var onP = opts.onProgress, n = opts.n || 12;
    log(onP, "① LLM 표제어 선정…");
    var pick = await llmJSON([{ role: "system", content: "영어 교사. 핵심 단어/숙어를 난이도순." }, { role: "user", content: "다음 지문에서 핵심 단어·숙어 " + n + "개를 JSON 배열로: [{\"word\":\"기본형\",\"meaning\":\"한국어 뜻\"}]. JSON만.\n\n" + passage }], { temperature: 0.3, timeout: 60000 });
    var base = Array.isArray(pick) ? pick : (pick && pick.words) || [];
    log(onP, "② 사전·어원·유의어·번역 동시 보강…");
    return await Promise.all(base.slice(0, n).map(async function (it) {
      var full = (it.word || "").trim(), isMulti = /\s/.test(full), head = full.toLowerCase().split(/\s+/)[0];
      var d = null, wk = null, syn = [];
      // 다단어 표제어(예: social harmony)는 첫 단어만 조회하면 엉뚱한 뜻/예문 → 사전조회 생략(LLM 뜻 사용)
      if (!isMulti && head) { try { d = await dict(head); } catch (_) {} try { wk = await wiktionary(head); } catch (_) {} try { syn = await datamuse(head, "syn", 4); } catch (_) {} }
      var ex = d && d.meanings.find(function (m) { return m.example; }), pos = isMulti ? "phrase" : ((d && d.meanings[0] && d.meanings[0].pos) || (wk && wk[0] && wk[0].pos) || "");
      return { word: it.word, meaning: it.meaning, pos: pos, phonetic: (!isMulti && d && d.phonetic) || "", cefr: cefrOf(full) || (isMulti ? "" : cefrOf(head)), en_def: isMulti ? "" : ((d && d.meanings[0] && d.meanings[0].def) || (wk && wk[0] && wk[0].defs[0]) || ""), example: ex ? ex.example : "", synonyms: syn };
    }));
  }
  // ===== 해설지 생성기(해설작성관 뉴런): 정답근거·오답별 근거·핵심어휘·출제의도 =====
  async function buildExplanation(q, passage, opts) {
    opts = opts || {}; if (!q) return null;
    var isMCQ = q.choices && q.choices.length >= 4;
    var pg = String(q.passage || passage || "");
    var sys = EXPERT_ID + " 지금은 학생용 상세 해설을 집필한다. 지문 근거를 인용하고 명료하게. JSON만.";
    var head = "유형: " + q.type + "\n발문: " + q.instruction + (pg ? ("\n지문: " + pg.slice(0, 900)) : "") + (isMCQ ? ("\n선지: " + JSON.stringify(q.choices) + "\n정답번호: " + q.answer) : ("\n모범답안: " + String(q.explanation || "").replace(/【출제의도】[\s\S]*$/, "").replace("[모범답안] ", "")));
    var spec = isMCQ
      ? "위 문항의 상세 해설을 작성하라. distractors에는 '정답 번호를 제외한 나머지 오답 선지 전부'를 각각 하나씩(빠짐없이) 넣어라. JSON: {\"correct\":\"정답이 옳은 이유(지문 근거 인용)\",\"distractors\":[{\"n\":오답번호(정수),\"why\":\"이 선지가 틀린 구체적 이유\"}],\"vocab\":[\"핵심 어휘·구문 몇 개(영어-뜻)\"],\"intent\":\"출제의도 한 줄\"}. JSON만."
      : "위 서술형의 상세 해설을 작성하라. JSON: {\"correct\":\"모범답안 해설·핵심 포인트\",\"rubric\":[\"채점 포인트 몇 개\"],\"vocab\":[\"핵심 어휘·구문(영어-뜻)\"],\"intent\":\"출제의도 한 줄\"}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: head + "\n\n" + spec }], { noRule: true, temperature: 0.4, timeout: 60000 });
    if (!r) return null;
    function toStr(v) { return typeof v === "string" ? v : (v && (v.word || v.term || v.phrase || v.expression) ? ((v.word || v.term || v.phrase || v.expression) + (v.meaning || v.def || v.뜻 ? (" — " + (v.meaning || v.def || v.뜻)) : "")) : (v && v.point ? v.point : (v ? JSON.stringify(v) : ""))); }
    if (Array.isArray(r.vocab)) r.vocab = r.vocab.map(toStr).filter(Boolean);
    if (Array.isArray(r.rubric)) r.rubric = r.rubric.map(toStr).filter(Boolean);
    if (Array.isArray(r.distractors)) r.distractors = r.distractors.map(function (d) { return typeof d === "string" ? { n: "", why: d } : { n: d.n != null ? d.n : "", why: d.why || d.reason || toStr(d) }; });
    r.type = q.type; r.isMCQ = isMCQ; return r;
  }

  async function healthCheck() {
    async function timeIt(fn) { var t = Date.now(); try { return { ok: !!(await fn()), ms: Date.now() - t }; } catch (e) { return { ok: false, ms: Date.now() - t }; } }
    var checks = {
      llm: function () { return llmRaw([{ role: "user", content: "reply with: ok" }], { timeout: 30000 }).then(function (s) { return /ok/i.test(s); }); },
      grammar: function () { return grammar("He go home.").then(function (m) { return m.length >= 1; }); },
      thesaurus: function () { return datamuse("happy", "syn", 3).then(function (a) { return a.length > 0; }); },
      dict: function () { return dict("improve").then(function (d) { return d && d.meanings.length > 0; }); },
      wikt: function () { return wiktionary("improve").then(function (a) { return a && a.length > 0; }); },
      wiki: function () { return wiki("Photosynthesis").then(function (d) { return d && d.extract; }); },
      trans: function () { return translate("hello", "en|ko").then(function (s) { return s.length > 0; }); },
      image: function () { return Promise.resolve(true); }
    };
    var res = {}; await Promise.all(ROSTER.map(async function (m) { res[m.key] = await timeIt(checks[m.key]); }));
    return ROSTER.map(function (m) { return Object.assign({}, m, res[m.key]); });
  }

  // ===== 명시적 파이프라인 정의(라인=담당 API). UI 표시·문서용 =====
  var PIPE_STATIC = {
    "어휘": [{ api: "core", label: "핵심어 5개 추출" }, { api: "thesaurus", label: "반의어 수집(Datamuse)" }, { api: "llm", label: "ⓐ~ⓔ 밑줄+1곳 반의어 교체" }, { api: "grammar", label: "교체 적절성 검증" }, { api: "core", label: "정답 확정" }],
    "어법": [{ api: "llm", label: "ⓐ~ⓔ 밑줄+1곳 어법오류 주입" }, { api: "grammar", label: "LanguageTool 오류 검증" }, { api: "core", label: "정답 확정" }],
    "빈칸": [{ api: "llm", label: "핵심어구 빈칸화" }, { api: "llm", label: "정답 어구 확정" }, { api: "llm", label: "오답①~④ 역할별 설계" }, { api: "thesaurus", label: "동의어중복 검사" }, { api: "core", label: "보기 배치" }],
    "함의": [{ api: "llm", label: "밑줄 구절+함의 도출" }, { api: "llm", label: "오답①~④ 설계" }, { api: "thesaurus", label: "중복 검사" }, { api: "core", label: "보기 배치" }],
    "요약": [{ api: "llm", label: "(A)(B) 빈칸 요약문" }, { api: "llm", label: "정답 쌍 확정" }, { api: "llm", label: "오답 쌍 4개" }, { api: "core", label: "보기 배치" }],
    "내용불일치": [{ api: "llm", label: "진술 5개(1개 모순)" }, { api: "core", label: "정답 확정" }],
    "서술형": [{ api: "llm", label: "서술형 발문 작성" }, { api: "llm", label: "모범답안 작성" }]
  };
  function pipelineOf(type) {
    if (["주제", "제목", "요지"].indexOf(type) >= 0) return inferenceSteps("", type, {}).map(function (s) { return { api: s.api, label: s.label }; });
    return PIPE_STATIC[type] || [];
  }

  window.APITEAM = {
    roster: ROSTER, BEST_TYPES: BEST_TYPES, mesh: MESH, topology: topology, googleBooks: googleBooks, pipeline: pipelineOf, runHarness: runHarness, configure: configure, provider: provider, convene: convene,
    loadTypeDB: loadTypeDB, loadDifficultyDB: loadDifficultyDB, typeDBInfo: function () { return TYPE_DB_INFO; }, loadSharedHints: loadSharedHints,
    loadReviewDB: loadReviewDB, reviewItem: reviewItem, reviewCode: reviewCode, loadExaminerKB: loadExaminerKB, kbFor: kbFor, loadRaysKB: loadRaysKB, raysKB: raysKB, extendPassage: extendPassage, agentRun: agentRun, agentPlan: agentPlan, agentFeedback: agentFeedback,
    loadCorpus: loadCorpus, corpusInfo: corpusInfo, corpusPassage: corpusPassage, cefrOf: cefrOf, synAnt: synAnt, phrasalVerbs: phrasalVerbs, gecExamples: gecExamples, recommendBooks: recommendBooks, books: function () { return CORPUS.books || []; },
    errlog: function () { return ERRLOG; }, meetings: function () { return MEETINGS; },
    llm: llm, llmJSON: llmJSON, ask: ask, grammar: grammar, datamuse: datamuse, dict: dict, wiktionary: wiktionary, wiki: wiki, translate: translate, image: image,
    wikiSearch: wikiSearch, wikidata: wikidata, openLibrary: openLibrary, poetry: poetry, wordInfo: wordInfo, wikiquote: wikiquote, wikisource: wikisource,
    refineLoop: refineLoop, critiqueQ: critiqueQ, ensemble: ensemble, spawnLLM: spawnLLM, spawned: function () { return SPAWNED; }, brain: brain, deliberate: deliberate,
    selfLearnStep: selfLearnStep, learnedRules: learnedRules, applyLearned: applyLearned, teacherHarness: teacherHarness,
    teacherCount: teacherCount, sampleTeachers: sampleTeachers, makeTeacher: makeTeacher, buildExplanation: buildExplanation,
    brainStructure: brainStructure, regionOf: regionOf,
    generateExam: generateExam, generateOne: generateOne, reviewOptions: reviewOptions, suggestTypes: suggestTypes, transformPassage: transformPassage, transformStaged: transformStaged, stageInfo: function () { return STAGE_INFO; }, buildVocabList: buildVocabList, healthCheck: healthCheck,
    buildInference: buildInference, buildVocab: buildVocab, buildGrammar: buildGrammar, buildBlank: buildBlank
  };
})();
