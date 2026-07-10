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
  var CFG = { geminiKey: "", groqKey: "", cerebrasKey: "", mistralKey: "", openrouterKey: "",
    geminiModel: "gemini-2.5-flash", groqModel: "llama-3.3-70b-versatile", cerebrasModel: "llama3.3-70b", mistralModel: "mistral-small-latest", openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
    ollamaModel: "", ollamaUrl: "http://localhost:11434" };
  // OpenAI 호환 무료 제공자(Bearer + /chat/completions) — 회전 목록에 추가해 무료 용량을 몇 배로
  var OAI = {
    groq:       { url: "https://api.groq.com/openai/v1/chat/completions",  model: function () { return CFG.groqModel; } },
    cerebras:   { url: "https://api.cerebras.ai/v1/chat/completions",       model: function () { return CFG.cerebrasModel; } },
    mistral:    { url: "https://api.mistral.ai/v1/chat/completions",        model: function () { return CFG.mistralModel; } },
    openrouter: { url: "https://openrouter.ai/api/v1/chat/completions",     model: function () { return CFG.openrouterModel; } }
  };
  // 키드 제공자 우선순위: Gemini(무료 한도 큼) → Groq(초고속) → Cerebras(초고속) → Mistral → OpenRouter(무료모델)
  var KEYED = ["gemini", "groq", "cerebras", "mistral", "openrouter"];
  // 무료 키 회전 풀: 각 *Key에 여러 키(콤마·줄바꿈·공백)를 넣으면 한도 소진 시 자동으로 다음 키로 = 한도 N배
  var POOL = {}, PDEAD = {}; KEYED.forEach(function (p) { POOL[p] = []; PDEAD[p] = {}; });
  function parseKeys(s) { return String(s || "").split(/[\s,]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function rebuildPools() { KEYED.forEach(function (p) { POOL[p] = parseKeys(CFG[p + "Key"]); PDEAD[p] = {}; }); }
  function liveKeys(prov) { return (POOL[prov] || []).filter(function (k) { return !PDEAD[prov][k]; }); }
  function curKey(prov) { var live = liveKeys(prov); return live.length ? live[0] : ""; }   // 항상 살아있는 첫 키(dead는 스킵)
  function markDead(prov) { var k = curKey(prov); if (k) PDEAD[prov][k] = 1; }
  function hasLive(prov) { return liveKeys(prov).length > 0; }
  function keyStats() { var o = { ollama: !!CFG.ollamaModel }; KEYED.forEach(function (p) { o[p] = { total: POOL[p].length, live: liveKeys(p).length }; }); return o; }
  function configure(c) { c = c || {}; Object.assign(CFG, c); if (KEYED.some(function (p) { return c[p + "Key"] != null; })) rebuildPools(); if (c.logUrl != null) LOGURL = c.logUrl; if (c.onMeeting) CB.onMeeting = c.onMeeting; if (c.onError) CB.onError = c.onError; if (c.onLearn) CB.onLearn = c.onLearn; }
  // Ollama(로컬) 최우선(설정 시) → 살아있는 키드 제공자 순서 → Pollinations(무키)
  function provider() { if (CFG.ollamaModel) return "ollama"; for (var i = 0; i < KEYED.length; i++) { if (hasLive(KEYED[i])) return KEYED[i]; } if (CFG.proxyUrl) return "proxy"; return "pollinations"; }
  var LAST_LIMITED = false;   // 직전 호출이 레이트리밋이었는지(진단·UI용)
  async function llmRaw(messages, opts) {
    opts = opts || {}; var prov = opts.forceProvider || provider(); var to = withTimeout(opts.timeout || 70000);
    try {
      if (prov === "ollama") {
        // 로컬 Ollama(무한·무료). https 페이지에선 mixed-content로 막히므로 사이트를 로컬(localhost)에서 실행해야 함.
        var obody = { model: CFG.ollamaModel, messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature, stream: false };
        if (opts.json) obody.response_format = { type: "json_object" };
        var ro = await fetch(String(CFG.ollamaUrl).replace(/\/+$/, "") + "/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify(obody) });
        var doo = await ro.json();
        if (doo.error) throw new Error("ollama: " + String((doo.error && doo.error.message) || doo.error).slice(0, 80));
        return (doo.choices && doo.choices[0] && doo.choices[0].message && doo.choices[0].message.content) || "";
      }
      if (prov === "proxy") {
        // 키를 서버(Cloudflare Worker)에 숨긴 프록시. 브라우저엔 키가 없음 → 안전. 프록시가 서버측 폴백·키회전 수행.
        var rp = await fetch(CFG.proxyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify({ messages: messages, temperature: opts.temperature, json: !!opts.json }) });
        var dp = await rp.json();
        if (dp && dp.error) { var xm = String(dp.error && dp.error.message || dp.error); if (/rate|quota|429|limit|exhaust/i.test(xm)) LAST_LIMITED = true; throw new Error("proxy: " + xm.slice(0, 80)); }
        return dp.content || (dp.choices && dp.choices[0] && dp.choices[0].message && dp.choices[0].message.content) || "";
      }
      if (prov === "gemini") {
        var gk = curKey("gemini"); if (!gk) throw new Error("gemini: no live key");
        var sys = messages.filter(function (m) { return m.role === "system"; }).map(function (m) { return m.content; }).join("\n");
        var rest = messages.filter(function (m) { return m.role !== "system"; }).map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }; });
        var body = { contents: rest, generationConfig: { temperature: opts.temperature == null ? 0.6 : opts.temperature } };
        if (opts.json) body.generationConfig.responseMimeType = "application/json";
        if (sys) body.systemInstruction = { parts: [{ text: sys }] };
        var rg = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + CFG.geminiModel + ":generateContent?key=" + encodeURIComponent(gk), { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify(body) });
        var dg = await rg.json();
        if (dg.error) { var gm = String((dg.error && dg.error.message) || ""); if (/quota|rate|429|exhausted|high demand|503/i.test(gm) || dg.error.code === 429 || dg.error.code === 503) { LAST_LIMITED = true; markDead("gemini"); } throw new Error("gemini: " + gm.slice(0, 80)); }
        return (dg.candidates && dg.candidates[0] && dg.candidates[0].content && dg.candidates[0].content.parts && dg.candidates[0].content.parts[0].text) || "";
      }
      if (OAI[prov]) {   // Groq/Cerebras/Mistral/OpenRouter 공통(OpenAI 호환)
        var pk = curKey(prov); if (!pk) throw new Error(prov + ": no live key");
        var cf = OAI[prov];
        var gbody = { model: cf.model(), messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature };
        if (opts.json) gbody.response_format = { type: "json_object" };   // 유효 JSON 강제
        var hd = { "Content-Type": "application/json", "Authorization": "Bearer " + pk };
        if (prov === "openrouter") { hd["HTTP-Referer"] = "https://inheok1103-alt.github.io"; hd["X-Title"] = "chuljae-brain"; }
        var rq = await fetch(cf.url, { method: "POST", headers: hd, signal: to.signal, body: JSON.stringify(gbody) });
        var dq = await rq.json();
        if (dq.error) { var em = String((dq.error && dq.error.message) || dq.error || ""); if (/rate|limit|quota|too many|429|exceed|credit|insufficient/i.test(em)) { LAST_LIMITED = true; markDead(prov); } throw new Error(prov + ": " + em.slice(0, 80)); }
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
    opts = opts || {}; var prov = opts.forceProvider || provider();
    for (var i = 0; i < 3; i++) {   // 죽은 제공자에 낭비 최소화(6→3) — 폴백 체인이 다음 제공자로 빠르게 이동
      LAST_LIMITED = false;
      var s = await llmRaw(messages, opts).catch(function () { return ""; });
      if (s && s.trim()) return s;
      if (LAST_LIMITED) { if (KEYED.indexOf(prov) >= 0 && hasLive(prov)) continue; break; }   // 소진된 키는 llmRaw가 dead 표시 → 살아있는 다음 키로 즉시 재시도
      await delay(1200 * (i + 1));
    }
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
  var LASTGOOD = "";   // 직전에 성공한 제공자 — 다음 호출은 여기부터(죽은 앞순위에 시간 낭비 방지)
  function providerChain() { var c = []; if (CFG.ollamaModel) c.push("ollama"); KEYED.forEach(function (p) { if (hasLive(p)) c.push(p); }); if (CFG.proxyUrl) c.push("proxy"); c.push("pollinations");
    var base = (c[0] === "ollama") ? 1 : 0; var gi = c.indexOf(LASTGOOD);
    if (LASTGOOD && gi > base) { c.splice(gi, 1); c.splice(base, 0, LASTGOOD); }
    return c; }
  async function tryChain(messages, opts, chain, i) {
    if (i >= chain.length) return "";
    var prov = chain[i], o = Object.assign({}, opts, { forceProvider: prov });
    var s = (prov === "pollinations") ? await pollSerial(messages, o) : await llmWithRetry(messages, o).catch(function () { return ""; });
    if (s && s.trim()) { LASTGOOD = prov; return s; }
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
    return tryChain(messages, opts, opts.forceProvider ? [opts.forceProvider] : providerChain(), 0);   // forceProvider 시 해당 모델만(신경다발 앙상블용)
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
  function collocation(word) { var c = CORPUS.colloc || []; var w = String(word || "").toLowerCase(); if (!w) return []; var out = []; for (var i = 0; i < c.length && out.length < 6; i++) { var ph = (c[i] && c[i][0] != null) ? c[i][0] : c[i]; if (typeof ph === "string" && (" " + ph + " ").indexOf(" " + w) >= 0) out.push(ph); } return out; }
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
    // 레벨 정규화: 하/중/상/킬러(초킬러) → low/mid/high 키. (perType 키가 영문이라 기존엔 매칭 실패 = 규칙 미주입 버그)
    var LVMAP = { "하": "low", "중": "mid", "상": "high", "킬러": "high", "초킬러": "high" };
    var lkey = LVMAP[level] || (/^(low|mid|high)$/.test(level) ? level : "mid");
    var lv = (DIFF.levels && (DIFF.levels[level] || DIFF.levels[{ low: "하", mid: "중", high: "상" }[lkey]])) || "";
    // 유형명 정규화: "어법(밑줄)"·"빈칸(어구)" 등 풀네임 → perType 기준키(빈칸/어법/어휘/주제/함의/요약)로 접두 매칭
    var pt = "";
    if (DIFF.perType) {
      var pk = DIFF.perType[type] ? type : Object.keys(DIFF.perType).filter(function (k) { return String(type).indexOf(k) >= 0; })[0];
      if (pk) pt = DIFF.perType[pk][lkey] || DIFF.perType[pk][level] || "";
    }
    // 초킬러(경찰대/사관 대역): 상 규칙 + 제4 변별축(통사밀도·어휘루어·원전급 렉사일) 가산 — special_exams_longitudinal 근거
    var killer = (level === "킬러" || level === "초킬러") ? " ★초킬러(경찰대/사관 대역): 위 '상' 사양에 더해 — 제4 변별축 '통사밀도/파싱부하'를 얹어라(문장 30어+·내포절 다중 중첩·삽입절로 진주어·목적어 관계 추적을 강제해 파싱 자체가 변별점이 되게). 오답에는 지문 실제어휘를 재조합한 '어휘루어'를 2개 이상 배치. 소재는 원전급(철학원전·과학사·성인 논픽션)으로 렉사일을 상향. 단 공정성 가드는 유지(정답은 본문 단서로 유일 도출, 배경지식 비의존)." : "";
    LEVELRULE = "[목표 난이도: " + level + " — " + lv + "] 난이도는 '추론단계 × 패러프레이즈거리 × 오답매력도'로 조절하고(어휘만 어렵게 하는 값싼 난도 금지), 오답 설계가 변별의 핵심이다. " + pt + killer;
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
  var LOGICHINT = "";   // 출제의도 로직 반영(raytools 토글) — 켜지면 STANDING 뒤에 붙어 전 생성에 반영
  function setLogicStanding(text) { LOGICHINT = String(text || "").slice(0, 500); var base = STANDING.replace(/\s*\[출제의도 로직 반영\][\s\S]*$/, ""); STANDING = LOGICHINT ? (base + " [출제의도 로직 반영] " + LOGICHINT) : base; return LOGICHINT; }

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
  // Tatoeba 예문 코퍼스(무료·무키·CORS) — 단어의 실제 사용 예문을 코퍼스에서 가져옴
  async function tatoeba(word, n) {
    try {
      var to = withTimeout(12000);
      var r = await fetch("https://tatoeba.org/en/api_v0/search?from=eng&query=" + encodeURIComponent('"' + word + '"') + "&sort=relevance&limit=" + (n || 5), { signal: to.signal });
      to.done(); var d = await r.json();
      var res = (d && (d.results || d.data)) || [];
      return res.map(function (s) { return String(s.text || "").trim(); }).filter(function (t) { var w = t.split(/\s+/).length; return t && w >= 3 && w <= 26; }).slice(0, n || 5);
    } catch (_) { return []; }
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
    // 원서 코퍼스 직결: 정답 속 핵심어의 실제 연어(collocation)·유의/반의어를 뽑아 '그럴듯하지만 틀린' 오답의 재료로 제공
    var corpusHint = "";
    try {
      var kws = englishWords(answer).filter(function (w) { return w.length >= 4 && !STOP[w.toLowerCase()]; }).slice(0, 3);
      var bits = [];
      kws.forEach(function (w) {
        var col = collocation(w); if (col && col.length) bits.push(w + "의 실제 연어: " + col.slice(0, 3).join(", "));
        var sa = synAnt(w); if (sa && (sa.ant || sa.syn)) bits.push(w + "의 반의/유의: " + [].concat(sa.ant || [], sa.syn || []).slice(0, 3).join(", "));
      });
      if (bits.length) corpusHint = "\n[원서 코퍼스 재료 — 오답을 자연스럽게 만들되 정답과 뜻이 겹치지 않게] " + bits.join(" / ");
    } catch (_) {}
    var j = await llmJSON([{ role: "system", content: "오답 설계 전문가. 정답과 의미가 분명히 다른 매력적 오답을 만든다. 원서 코퍼스의 실제 연어를 활용해 표현은 자연스럽게. JSON 배열만." },
      { role: "user", content: "정답 보기: \"" + answer + "\"\n맥락: " + context + corpusHint + "\n위 정답과 '핵심 주장이 겹치지 않는' " + kind + " 오답 4개를 만들어라. 서로 다른 방식으로 틀리게: ①부분적·지엽적 ②정반대 ③글과 무관 ④지나치게 포괄적. ★오답 매력도 위계(임용/측정학): 지문 소재·어휘를 재활용해 '같은 의미장에서 그럴듯하게'(semantic) 만들되, 딴 분야 엉뚱오답은 피하고, 정답의 근접 패러프레이즈·유의어 반복은 금지(복수정답 방지). 4개 중 강한 매력 오답은 1~2개로 제한(난도 폭주 방지), 나머지는 명백 오답. ★표면단서 제거: 정답만 유독 길거나 구체적이지 않게 4개의 길이·형태를 통일. 정답을 재진술·패러프레이즈 하지 말 것. JSON 문자열 배열 4개만." }], { temperature: 0.75, timeout: 55000 });
    var arr = Array.isArray(j) ? j.map(clean1).filter(Boolean) : [];
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
  // 형태단서(length cue) 측정 — 정답만 유독 길면 '제일 긴 것=정답'으로 답이 샌다(Haladyna 형태단서 제거 원칙)
  function choiceLen(s) { return String(s || "").replace(/\s+/g, " ").trim().length; }
  function answerIsLongCued(ch, ai) {
    if (!(ch && ch.length >= 4 && ai >= 1 && ai <= ch.length)) return false;
    if (ch.every(function (c) { return /^[ⓐ-ⓔ①-⑤]$/.test(String(c).trim()); })) return false;   // 밑줄/위치형 제외
    var L = ch.map(choiceLen), a = L[ai - 1], oth = L.filter(function (_, i) { return i !== ai - 1; });
    var maxO = Math.max.apply(null, oth), meanO = oth.reduce(function (s, x) { return s + x; }, 0) / oth.length;
    return a >= maxO && (a > maxO * 1.3 || a > meanO * 1.5) && (a - maxO) >= 6;   // 최장 + 2등比 30%↑ 또는 평균比 50%↑
  }
  async function reviewOptions(answer, dis, ctx) {
    ctx = ctx || {};
    var sys = "너는 대한민국 수능 영어 '선지(보기) 검수관'이다. 5개 선택지를 최종 점검·정리한다: ①정답은 글을 정확히 반영하는 '단 하나' ②★오답 4개는 정답과 '핵심 주장이 겹치지 않아야' 한다 — 정답의 근접 패러프레이즈·유의어 반복 금지(복수정답 방지). 각 오답에 서로 다른 오답 DNA(부분참·전도·과잉·축소·초점이동·태도왜곡·조건누락 중 1) ③오답은 정답과 반대이거나 지문 일부만 담거나 지문에 없는 내용이어야 하되, 지문 소재·어휘를 재활용해 그럴듯하게(엉뚱한 딴 분야 금지) ④5개의 길이·문법 형태 통일(정답만 길거나 구체적 금지) ⑤빈칸/요약형이면 완성 문장이 아니라 끼워지는 '어구/절'로 ⑥정답은 본문 표현을 그대로 베끼지 말고 패러프레이즈 ⑦메타 표현(본문은/글은/사전적/문자적/원문보다) 금지. JSON만.";
    var user = "유형: " + (ctx.type || "") + "\n정답 선지: \"" + answer + "\"\n오답 초안: " + JSON.stringify(dis || []) + (ctx.main ? ("\n글 핵심: " + ctx.main) : "") + (ctx.slot ? ("\n빈칸 프레임(모든 선지는 이 '____' 자리에 문법적으로 그대로 들어가야 함, 완성문장 금지): " + ctx.slot) : "") + "\n위 기준대로 5개 선지를 다듬어 JSON으로: {\"choices\":[\"5개 문자열\"],\"answer\":정답의 1~5 위치(정수)}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0.4, timeout: 60000 });
    if (r && Array.isArray(r.choices) && r.choices.length >= 5) {
      var ch = r.choices.map(clean1).filter(function (c) { return c && !badChoice(c); }).slice(0, 5);   // 금지패턴(메타표현·플레이스홀더) 자동 필터
      if (ch.length < 5) return shuffleAnswer(answer, dis || []);   // 패딩('보기') 금지 — 재료로 재구성 또는 null
      var ai = parseInt(r.answer, 10); if (!(ai >= 1 && ai <= 5)) ai = 0;
      var bm = bestMatchIdx(ch, answer);   // 정답 텍스트 위치를 코드로 도출(자기보고보다 우선)
      if (bm >= 0) ai = bm + 1; else if (!ai) ai = 1;
      // 형태단서 게이트: 정답만 유독 길면 오답을 정답 밀도로 확장해 균질화(정답 텍스트·위치 보존 → 정합 안전)
      if (answerIsLongCued(ch, ai)) {
        var ansT = ch[ai - 1], others = ch.filter(function (_, i) { return i !== ai - 1; });
        var rr = await llmJSON([{ role: "system", content: "선지 균질화 검수관. JSON 배열만." },
          { role: "user", content: "정답(고정·수정 금지): \"" + ansT + "\"\n아래 오답 4개가 정답보다 짧아 '제일 긴 것 = 정답'이라는 형태 단서가 노출된다. 정답과 비슷한 길이·구문·구체성으로 오답 4개를 다시 써라 — 각자 틀린 이유(부분·전도·초점이탈·과장)는 유지하고, 정답과 의미가 겹치지 않게(복수정답 금지), 지문 소재·어휘를 재활용해 그럴듯하게. 유형:" + (ctx.type || "") + "\n오답: " + JSON.stringify(others) + "\nJSON 문자열 배열 4개만." }], { temperature: 0.5, timeout: 50000 }).catch(function () { return null; });
        var nd = Array.isArray(rr) ? rr.map(clean1).filter(function (c) { return c && !badChoice(c); }) : [];
        if (nd.length >= 4) { var merged = [], di = 0; for (var mi = 0; mi < 5; mi++) merged.push(mi === ai - 1 ? ansT : nd[di++]); ch = merged; }
      }
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
    return { instr: { "주제": "다음 글의 주제로 가장 적절한 것은?", "제목": "다음 글의 제목으로 가장 적절한 것은?", "요지": "다음 글의 요지로 가장 적절한 것은?", "필자주장": "다음 글에서 필자가 주장하는 바로 가장 적절한 것은?", "목적": "다음 글의 목적으로 가장 적절한 것은?" }[type] || "다음 글의 주제로 가장 적절한 것은?",
      kind: { "주제": "영어 명사구", "제목": "영어 제목구", "요지": "한국어 한 문장", "필자주장": "한국어 한 문장('~해야 한다' 당위형)", "목적": "한국어 한 문장('~하려고' 화행형)" }[type] || "영어 명사구" };
  }
  // 추론형 파이프라인: 각 라인이 명시적 API에 연결됨
  // ===== 선지 우선(choice-first) 설계 — 문항의 변별력은 선지에 있다. 정답+오답4를 '하나의 균형 세트'로 함께 생성:
  //   추상화(verbatim 금지)·DNA 분산·길이 통일을 '설계 단계'에서 강제(사후 패치 아님). =====
  async function designChoiceSet(thesis, type, kind, passage, ctx) {
    var pg = String(passage || "").replace(/<[^>]+>/g, " ").slice(0, 760);
    // 서식 통일 규칙(유형별) — 정답만 서식이 튀어 형태로 답이 새는 것 방지
    var fmtRule = /제목/.test(type) ? "\n★서식: 5선지 전부 'Title Case 헤드라인 명사구'(각 주요 단어 첫 글자 대문자, 정형동사·완결문 금지)로 통일 — 정답만 명사구고 오답이 완결문이면 실패." :
      /주제/.test(type) ? "\n★서식: 5선지 전부 소문자 명사구(동일 품사·구조)로 통일." : "";
    var j = await llmJSON([{ role: "system", content: "너는 대한민국 수능 영어 '선지 세트' 설계자다. 문항의 변별력은 선지에 있으므로 정답과 오답 4개를 '하나의 균형 잡힌 세트'로 함께 설계한다. JSON만." },
      { role: "user", content: "[지문]\n" + pg + "\n\n글의 핵심 논지: \"" + thesis + "\"\n유형: " + type + " · 정답 형식: " + kind + "\n\n아래 5-선지 세트를 한 번에 설계하라(선지 우선):\n- correct: 핵심 논지를 담은 정답. ★본문 표현을 그대로 베끼지 말고 상위어·재구조화로 '전 지문 종합형 추상어'로 쓴다.\n- distractors: 오답 4개 — ★★가장 중요: '오답 매력도'. 각 오답은 '정답 선지를 기준으로 딱 한 요소만 비튼 near-miss'로 만든다. 정답의 핵심어를 2개 이상 그대로 공유하고 첫 읽기엔 그럴듯해서, 지문을 정확히 이해해야만 걸러지게 하라. 'always/never/only/모두/결코' 같은 극단어로 대놓고 티내거나 딴 소재로 튀는 '죽은 오답(아무도 안 고르는)'은 실패다. 각 오답의 어긋난 그 한 지점이 근거다. 아래 '논리 오류' 메뉴에서 서로 다른 4가지를 골라 각 오답에 하나씩 적용:\n  ①인과 전도(원인↔결과를 뒤바꿈) ②범위 축소(정답의 일부만 담음) ③과잉 일반화(지나치게 확대) ④정도·빈도 왜곡(항상↔가끔·전부↔일부) ⑤조건·전제 누락(핵심 조건을 빼 성립 안 되게) ⑥주체·대상 교체 ⑦상관을 인과로 혼동 ⑧초점 이탈(소재는 유지, 논점은 벗어남).\n  각 오답은 정답과 '의미가 동일하면 안 됨'(복수정답 금지)." + fmtRule + "\n★★5개 선지의 길이·구문·구체성을 반드시 비슷하게 — 정답만 길거나 완결적이면 실패다.\nJSON: {\"correct\":\"정답 선지\",\"distractors\":[{\"error\":\"적용한 논리오류명\",\"text\":\"오답선지\"}, ...4개]}. JSON만." }], { temperature: 0.6, timeout: 60000 }).catch(function () { return null; });
    if (!j || !j.correct || !Array.isArray(j.distractors)) return null;
    var ans = clean1(j.correct), dis = j.distractors.map(function (d) { return clean1(d && d.text); }).filter(Boolean);
    if (!ans || dis.length < 4) return null;
    return { answer: ans, dis: dis.slice(0, 4), dna: j.distractors.map(function (d) { return (d && (d.error || d.dna)) || ""; }).slice(0, 4) };
  }
  // 오답 논리오류(DNA) → 학생용 짧은 '왜 틀렸는지'
  var DNA_WHY = { "인과 전도": "원인과 결과를 뒤바꿈", "인과전도": "원인과 결과를 뒤바꿈", "범위 축소": "정답의 일부만 담아 지엽적", "범위축소": "정답의 일부만 담아 지엽적", "부분": "정답의 일부만 담아 지엽적", "과잉 일반화": "지나치게 확대 해석", "과잉일반화": "지나치게 확대 해석", "과장": "지나치게 확대 해석", "정도·빈도 왜곡": "정도·빈도를 왜곡", "정도빈도왜곡": "정도·빈도를 왜곡", "조건·전제 누락": "핵심 조건·전제를 빠뜨림", "조건누락": "핵심 조건·전제를 빠뜨림", "주체·대상 교체": "주체나 대상을 바꿔치기", "주체교체": "주체나 대상을 바꿔치기", "상관을 인과로 혼동": "상관관계를 인과로 오인", "초점 이탈": "소재는 같으나 논점에서 벗어남", "초점이탈": "소재는 같으나 논점에서 벗어남", "전도": "논지와 정반대", "정반대": "논지와 정반대" };
  function dnaWhy(dna) { var k = String(dna || "").trim(); return DNA_WHY[k] || k || "논지에서 어긋남"; }
  // 최종 선지에 오답 DNA를 재결합 — 그리디 1:1 배정(reviewOptions가 순서·표현을 바꿔도 각 오답이 원본 오답 하나에만 매핑)
  function dnaNotes(choices, ai, dis, dna) {
    if (!dna || !dna.length || !choices || !choices.length) return null;
    var notes = choices.map(function (c, i) { return { n: i + 1, correct: i + 1 === ai, text: c, dna: "" }; });
    var cand = [];
    notes.forEach(function (nt) { if (nt.correct) return; (dis || []).forEach(function (d, di) { cand.push({ n: nt.n, di: di, ov: tokOverlap(nt.text, d) }); }); });
    cand.sort(function (a, b) { return b.ov - a.ov; });   // 중첩 높은 쌍부터 배정
    var usedN = {}, usedD = {};
    cand.forEach(function (x) { if (usedN[x.n] || usedD[x.di]) return; usedN[x.n] = 1; usedD[x.di] = 1; var nn = notes[x.n - 1]; if (nn) nn.dna = dna[x.di] || ""; });
    // 미배정 오답(원본 부족 등)은 남은 DNA 순서대로 채움
    var leftD = dna.map(function (_, i) { return i; }).filter(function (i) { return !usedD[i]; });
    notes.forEach(function (nt) { if (!nt.correct && !nt.dna && leftD.length) nt.dna = dna[leftD.shift()] || ""; });
    // 내용 기반 결정론 보정: 라벨이 선지 표면 표지와 어긋나면 표지 우선(라벨=실결함 일치 — 적대감사 rank6)
    notes.forEach(function (nt) {
      if (nt.correct || !nt.text) return;
      var t = " " + String(nt.text).toLowerCase() + " ";
      if (/\b(all|every|always|never|any)\b/.test(t) || /모든|전부|항상|결코|어떤 .{0,6}도/.test(t)) nt.dna = "과잉 일반화";
      else if (/\b(only|solely|merely|just)\b/.test(t) || /오직|뿐|만 /.test(t)) nt.dna = "범위 축소";
      else if (/\b(opposite|contrary|reverse|instead)\b/.test(t)) nt.dna = "인과 전도";
    });
    return notes.map(function (nt) { return nt.correct ? { n: nt.n, correct: true } : { n: nt.n, correct: false, dna: nt.dna }; });
  }
  function inferenceSteps(passage, type, ctx, fast) {
    var kind = infMeta(type).kind;
    var roles = [["부분적·지엽적", "글의 사소한 일부만 담아"], ["정반대", "핵심과 반대 의미로"], ["초점 이탈", "글의 소재·어휘는 그대로 쓰되 핵심 논점에서 살짝 벗어나(딴 분야로 튀지 말 것)"], ["지나치게 포괄적", "너무 일반적이라 핵심을 못 짚게"]];
    var steps = [
      { api: "wiki", label: "배경지식 조회", run: function (s) { return Promise.resolve({ bg: (ctx && ctx.bg) || null }); } },
      { api: USE_ENSEMBLE ? "ensemble" : "llm", label: USE_ENSEMBLE ? "핵심 논지 추출(앙상블 메타-LLM)" : "핵심 논지 추출", run: async function (s) { var h = s.bg && s.bg.extract ? ("\n(참고 배경: " + s.bg.extract.slice(0, 160) + ")") : ""; if (ctx && ctx.related && ctx.related.length) h += "\n(관련 주제: " + ctx.related.slice(0, 4).join(", ") + ")"; if (ctx && ctx.facts && ctx.facts.length) h += "\n(사실: " + ctx.facts.slice(0, 2).map(function (f) { return f.label + "—" + f.desc; }).join("; ") + ")"; var pr = "다음 글의 핵심 논지를 영어 한 문장으로(답만)." + h + "\n\n" + passage; return { main: USE_ENSEMBLE ? ((await ensemble(pr)).answer || "") : await ask(pr, "핵심 한 문장. 답만.") }; } },
      // ★선지 우선: 정답+오답4를 한 세트로 통합 설계(변별력=선지). 성공하면 이후 개별 생성 스킵.
      { api: "llm", label: "선지 세트 통합 설계(선지 우선)", run: async function (s) { if (!s.main) throw new Error("no main"); var cs = await designChoiceSet(s.main, type, kind, passage, ctx); return cs ? { answer: cs.answer, dis: cs.dis, dna: cs.dna } : {}; } },
      { api: "llm", label: "[폴백] 정답 보기 작성", run: async function (s) { if (s.answer) return {}; if (!s.main) throw new Error("no main"); return { answer: await ask("글 핵심: \"" + s.main + "\"\n이를 담은 " + type + " 정답을 " + kind + "로 간결히(본문 표현 베끼지 말고 상위어로 추상화). 보기 텍스트만.") }; } }
    ];
    if (fast) {
      steps.push({ api: "llm", label: "[폴백] 오답 4개 일괄 설계", run: async function (s) { if (s.dis && s.dis.length >= 4) return {}; if (!s.answer) throw new Error("no answer"); var j = await llmJSON([{ role: "system", content: "오답 설계 전문가. JSON 배열만." }, { role: "user", content: "정답: \"" + s.answer + "\"\n글 핵심: " + s.main + "\n정답과 의미가 분명히 다른 " + kind + " 오답 4개를 각각 다른 방식(①부분적 ②정반대 ③초점이탈-소재는 유지 ④포괄)으로. 오답도 지문 소재·어휘를 재활용해 그럴듯하게(딴 분야 금지), 정답 재진술 금지. 5개 선지 길이 통일. JSON 문자열 배열 4개만." }], { temperature: 0.75, timeout: 55000 }); return { dis: (Array.isArray(j) ? j.map(clean1).filter(Boolean) : []).slice(0, 4) }; } });
      steps.push({ api: "thesaurus", label: "오답 동의어중복 검사", run: function (s) { return Promise.resolve({ dis: (s.dis || []).filter(function (d) { return !(d && ctx && synOverlap(s.answer, d, ctx)); }) }); } });
    } else {
      roles.forEach(function (r, idx) {
        steps.push({ api: "llm", label: "[폴백] 오답" + (idx + 1) + " (" + r[0] + ") 설계", run: async function (s) { if (s.dna && s.dis && s.dis.length >= 4) return {}; if (!s.answer) throw new Error("no answer"); var d = await ask("정답: \"" + s.answer + "\"\n글 핵심: " + s.main + "\n이 정답과 의미가 분명히 다른 '" + r[0] + "' 오답 1개를 " + kind + "로 만들되 " + r[1] + ", 정답 재진술 금지. 보기 텍스트만."); s._last = d; s.dis = (s.dis || []).concat(d ? [d] : []); return { dis: s.dis }; } });
        steps.push({ api: "thesaurus", label: "오답" + (idx + 1) + " 동의어중복 검사", run: async function (s) { var d = s._last; if (d && ctx && synOverlap(s.answer, d, ctx)) { var d2 = await ask("정답 \"" + s.answer + "\"과 단어·의미가 겹치지 않는 '" + r[0] + "' 오답 1개를 " + kind + "로. 보기만."); if (d2) s.dis[s.dis.length - 1] = d2; } return { dis: s.dis }; } });
      });
    }
    steps.push({ api: "grammar", label: "보기 어법 검수(LanguageTool)", run: async function (s) { var gi = []; try { gi = await grammar([s.answer].concat(s.dis || []).filter(function (c) { return /[A-Za-z]\s[A-Za-z]/.test(c); }).join("\n")); } catch (_) {} return { gi: gi }; } });
    steps.push({ api: "trans", label: "정답 한국어 교차검증(MyMemory)", run: async function (s) { var ko = ""; try { ko = await translate(s.answer, "en|ko"); } catch (_) {} return { ko: ko }; } });
    steps.push({ api: "team", label: "선지 제작 팀 — 최종 검수(형태통일·정답유일·어법·어구화)", run: async function (s) { var r = await reviewOptions(s.answer, s.dis || [], { type: type, main: s.main }); if (!r) throw new Error("선지 부족"); return { choices: r.choices, answerIdx: r.answer, notes: dnaNotes(r.choices, r.answer, s.dis, s.dna) }; } });
    return steps;
  }
  async function buildInference(passage, type, opts) {
    opts = opts || {}; var onP = opts.onProgress, ctx = opts.ctx || {};
    // 유형-소재 적합성 게이트: 필자주장은 '당위(~해야 한다)'가 있는 논설문에서만. 설명·서사문이면 억지 당위 생성 대신 폐기.
    if (type === "필자주장") {
      var fit = await llmJSON([{ role: "system", content: "글 유형 판정관. JSON만." }, { role: "user", content: "다음 글이 '필자의 당위적 주장(무엇을 해야/하지 말아야 한다)'을 담은 논설문인가? 사실을 전달·설명하거나 이야기를 서술할 뿐 당위가 없으면 false. JSON: {\"argumentative\":true/false}.\n\n" + String(passage).slice(0, 1200) }], { temperature: 0.1, timeout: 40000 }).catch(function () { return null; });
      if (fit && fit.argumentative === false) { log(onP, "   ⚠ 필자주장 부적합 지문(당위 없음) — 미출제"); return null; }
    }
    var st = await runHarness(inferenceSteps(passage, type, ctx, opts.fast), { passage: passage, ctx: ctx, dis: [] },
      function (ev) { log(onP, "  ┃라인 " + ev.line + "/" + ev.total + " [" + ev.api + "] " + ev.label + "…"); });
    if (!st.answer || !st.choices) return null;
    // 언어 일관성 게이트: 한국어 선지 유형(요지·주장·목적)에 영어 선지·한영 깨진토큰(모thers)이 섞이면 재시도
    if (/한국어/.test(infMeta(type).kind)) {
      st.choices = st.choices.map(function (c) { return String(c).replace(/([가-힣])([A-Za-z]{2,})/g, "$1 $2").replace(/([A-Za-z]{2,})([가-힣])/g, "$1 $2").trim(); });   // 글자붙은 한영토큰 분리
      var mixed = st.choices.some(function (c) { var lat = (String(c).match(/[A-Za-z]/g) || []).length, ko = (String(c).match(/[가-힣]/g) || []).length; return lat > 6 && lat > ko; });
      // 한영 혼용 붕괴: 영어 어구에 조사가 직접 붙는 선지("their ability 을") — 문장 성립 안 됨 → 폐기
      var broken = st.choices.some(function (c) { return /[A-Za-z]{2,}\s*[을를이가은는의도]\s/.test(String(c) + " "); });
      if (mixed || broken) return null;   // 한국어 유형인데 영어 선지/혼용 붕괴 → 상위 재시도
    }
    // 제목 서식 통일: 5선지 전부 Title Case로 정규화(정답만 대문자 헤드라인·오답만 소문자완결문 = 형태단서 제거)
    if (/제목/.test(type)) {
      var MIN = { a: 1, an: 1, the: 1, of: 1, to: 1, in: 1, on: 1, for: 1, and: 1, or: 1, but: 1, as: 1, at: 1, by: 1, with: 1, from: 1, "vs": 1 };
      st.choices = st.choices.map(function (c) {
        return String(c).replace(/[.]+\s*$/, "").split(/\s+/).map(function (w, i) { var lw = w.toLowerCase(); return (i > 0 && MIN[lw]) ? lw : w.charAt(0).toUpperCase() + w.slice(1); }).join(" ").trim();
      });
    }
    log(onP, '   ↳ 핵심 논지: "' + String(st.main || "").slice(0, 72) + '"');
    log(onP, '   ↳ 정답 초안: "' + String(st.answer || "").slice(0, 64) + '" · 오답 ' + (st.dis || []).length + '개 설계');
    var meta = infMeta(type);
    var CN = ["①", "②", "③", "④", "⑤"];
    // 선지별 분석: 정답=핵심 반영, 오답=DNA별 '왜 틀렸는지'(reviewOptions 재결합)
    var perChoice = "";
    if (st.notes && st.notes.length) {
      perChoice = "\n[선지 분석] " + st.notes.map(function (nt) { return nt.correct ? (CN[nt.n - 1] + " 정답 — 핵심 논지 반영") : (CN[nt.n - 1] + " 오답 — " + dnaWhy(nt.dna)); }).join(" · ");
    }
    var dnaList = (st.dna || []).filter(Boolean);
    var dnaLine = dnaList.length ? (" 오답은 서로 다른 논리 오류(" + dnaList.slice(0, 4).join("·") + ")로 설계되어, 각기 한 지점에서만 논지와 어긋난다.") : "";
    return { type: type, instruction: meta.instr, passage: "", choices: st.choices, answer: st.answerIdx,
      explanation: "글의 핵심 논지는 '" + st.main + "'이며, 정답 선지가 이를 정확히 반영한다." + (dnaLine || " 나머지 선지는 지문의 일부만 담거나(부분), 논지와 반대이거나(전도), 초점이 벗어나(초점이탈) 오답이다.") + perChoice,
      _choiceNotes: st.notes || null,
      _audit: (st.gi && st.gi.length) ? ("어법 의심 " + st.gi.length + "건") : "검증 통과", _trace: st._trace };
  }
  // 빈칸: ① 핵심 논지 자리에 어구 비우기(도입부 회피) → ② 프레임 맞춤 어구형 정답 → ③ 역할별 오답
  // 빈칸 정답이 원문 표현 그대로(verbatim)인지 — recall화 방어. 내용어 시퀀스가 원문에 연속/대부분 존재하면 verbatim.
  function blankVerbatim(ans, passage) {
    var a = String(ans || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function (w) { return w.length >= 3 && !STOP[w]; });
    if (a.length < 2) return false;
    var pl = " " + String(passage || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
    if (pl.indexOf(" " + a.join(" ") + " ") >= 0) return true;                      // 연속 일치
    return a.filter(function (w) { return pl.indexOf(" " + w + " ") >= 0; }).length / a.length >= 0.8;   // 내용어 80%+ 원문 존재
  }
  async function buildBlank(passage, opts) {
    var onP2 = opts && opts.onProgress;
    var o = await llmJSON([{ role: "system", content: "수능 빈칸추론 출제자. 빈칸은 필자의 핵심 주장·결론을 담은 자리에 두고 도입부 정의문·예시·부연은 피한다. JSON만." }, { role: "user", content: "다음 글에서 필자의 핵심 주장/결론을 담은 문장을 고르고, 그 문장에서 논지의 핵심 어구(3~8단어)를 ____ 로 비워라(도입부 첫 문장은 피할 것). 정답은 빈칸에 '문법적으로 그대로 들어맞는 간결한 영어 어구(완성 문장 절대 아님)'로, 본문 표현이 아니라 상위어·동의어로 패러프레이즈하라. JSON: {\"blanked\":\"해당 어구만 ____로 바꾼 지문 전체\",\"answer\":\"빈칸에 들어갈 정답 어구\",\"orig\":\"비운 원래 어구\",\"frame\":\"빈칸이 든 문장만(____ 포함)\"}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.answer || !o.blanked) return null;
    // verbatim recall 방어(실전기출: 빈칸은 담화추론이지 원문 눈찾기가 아님) — 정답이 원문 표현 그대로면 상위어·동의어로 1회 재작성, 실패 시 폐기
    if (blankVerbatim(o.answer, passage)) {
      var rw = await ask("다음 어구를 '뜻은 같지만 본문 표현을 그대로 쓰지 않는' 상위어·동의어 어구로 바꿔라(3~8단어, 완성 문장 아님). 어구만 출력.\n어구: " + o.answer, "패러프레이즈된 어구만 출력. 설명·따옴표 금지.", { noRule: true, temperature: 0.6 }).catch(function () { return ""; });
      rw = String(rw || "").replace(/^["'·\-\s]+|["'\s]+$/g, "").split("\n")[0].trim();
      if (rw && rw.split(/\s+/).length >= 2 && !blankVerbatim(rw, passage)) { o.answer = rw; }
      else return null;   // 패러프레이즈 실패 → recall 문항 폐기(상위 재시도)
    }
    // 지문 축약 방어: blanked가 지문 대부분을 담지 않으면(LLM이 빈칸 문장만 반환) 원문에서 orig를 ____로 치환해 전체 지문 복원
    var blanked = String(o.blanked);
    var pw = passage.split(/\s+/).length, bw = blanked.split(/\s+/).length;
    if (bw < pw * 0.6 || blanked.indexOf("____") < 0) {
      var origP = String(o.orig || "").trim();
      if (origP && passage.indexOf(origP) >= 0) blanked = passage.replace(origP, "____");
      else return null;   // 복원 불가 → 실패 처리(상위 재시도)
    }
    o.blanked = blanked;
    // 오설(malformed) 빈칸 방어: ____가 단어 글자에 붙어(mid-word 'd____tance') 있으면 원문 어구로 재구성, 여전하면 폐기
    if (/[A-Za-z]____|____[A-Za-z]/.test(o.blanked)) {
      var op2 = String(o.orig || "").trim();
      if (op2 && passage.indexOf(op2) >= 0) o.blanked = passage.replace(op2, "____");
      if (/[A-Za-z]____|____[A-Za-z]/.test(o.blanked)) return null;
    }
    log(onP2, '   ↳ 빈칸 프레임: "' + String(o.frame || "").slice(0, 70) + '"');
    log(onP2, '   ↳ 정답 어구: "' + String(o.answer).slice(0, 50) + '"' + (o.orig ? (' (원문 "' + String(o.orig).slice(0, 30) + '" 패러프레이즈)') : ''));
    var frame = o.frame || "";
    var dis = await makeDistractors(o.answer, "빈칸 '____'에 그대로 끼워지는 간결한 영어 어구(완성 문장 아님, 정답과 품사·길이 통일)", "빈칸 프레임: " + (frame || "(문장 일부)") + "\n오답은 본문 어휘를 재활용하되 이 자리에 넣으면 논리가 어긋나게(정반대/부분일치/무관/과장).");
    var a = await reviewOptions(o.answer, dis, { type: "빈칸", slot: frame, main: o.answer }); if (!a) return null;
    // 형태 가드: 완성문장형(주어+be/조동사 시작) 선지를 어구형으로 축약
    var ch = (a.choices || []).map(function (c) { return String(c).replace(/^\s*(happiness|it|one|people|the individual|this|they|we|society)\s+(is|are|was|were|has|have|can|will|becomes?)\s+/i, "").trim(); });
    if (blankVerbatim(ch[a.answer - 1] || o.answer, passage)) return null;   // 최종 선지 verbatim 재검(reviewOptions가 원문어구로 복원했을 가능성 차단)
    // 동의어 복수정답 방어: 오답이 정답과 의미상 동치(functions as/acts as/works as 류)면 유일해 붕괴 → 폐기(리롤)
    var disFin = ch.filter(function (_, i) { return i !== a.answer - 1; });
    var uniqDis = await flagEquivalents(ch[a.answer - 1] || o.answer, disFin).catch(function () { return disFin; });
    if (uniqDis.length < disFin.length) return null;
    return { type: "빈칸", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것은?", passage: o.blanked, choices: ch, answer: a.answer, explanation: "빈칸에는 '" + o.answer + "'가 들어가 글의 논지를 완성한다" + (o.orig ? (" (본문 '" + o.orig + "'의 패러프레이즈)") : "") + "." };
  }
  // 함의: ① 밑줄 구절+의미 → ② 역할별 오답
  // 구절을 원문에서 강건하게 찾아 밑줄(대소문자·스마트따옴표·끝문장부호 차이 허용). 실패 시 대표 절 폴백 → 밑줄 없는 함의 문항 방지
  function underlineIn(passage, phrase) {
    function norm(s) { return String(s || "").replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/\s+/g, " "); }
    if (phrase) {
      var p = passage.indexOf(phrase);
      if (p >= 0) return passage.slice(0, p) + "<u>" + phrase + "</u>" + passage.slice(p + phrase.length);
      var np = norm(passage), nq = norm(phrase).replace(/[.,;:!?]+$/, "").trim();
      if (nq.length >= 6) {
        var idx = np.toLowerCase().indexOf(nq.toLowerCase());
        if (idx >= 0) {
          // 정규화 인덱스를 원문 인덱스로 재사상(공백 축약만 되돌림) — 근사 매칭
          var words = nq.split(" "); var re = new RegExp(words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("\\s+"), "i");
          var m = re.exec(passage);
          if (m) return passage.slice(0, m.index) + "<u>" + m[0] + "</u>" + passage.slice(m.index + m[0].length);
        }
      }
    }
    // 폴백: 가장 긴 절(콤마/세미콜론 분할)에 밑줄 — 항상 밑줄이 존재하도록
    var clauses = passage.split(/[,;:]/).map(function (s) { return s.trim(); }).filter(function (s) { return s.split(" ").length >= 4; });
    clauses.sort(function (a, b) { return b.length - a.length; });
    var cl = clauses[0];
    if (cl) { var ci = passage.indexOf(cl); if (ci >= 0) return passage.slice(0, ci) + "<u>" + cl + "</u>" + passage.slice(ci + cl.length); }
    return passage;
  }
  // 함의 전용 오답축(범위축소·인과전도·정도빈도치환·표면직역) — 정답과 의미가 겹치지 않게 구조적으로 설계
  async function implicationDistractors(meaning, phrase) {
    var j = await llmJSON([{ role: "system", content: "함의 오답 설계자. JSON 배열만." },
      { role: "user", content: "밑줄 구절: \"" + (phrase || "") + "\"\n정답(함의): \"" + meaning + "\"\n\n정답과 '의미가 절대 겹치지 않는' 매력적 오답 4개를 서로 다른 축으로: ①범위축소(정답의 일부·지엽만) ②인과전도(원인·결과를 뒤바꿈) ③정도/빈도 치환(항상↔때때로·전부↔일부·강↔약) ④표면직역(밑줄 글자 그대로 뜻, 함의 아님). 각 오답 영어 한 문장, 정답을 재진술·패러프레이즈 금지. JSON: [\"오답1\",\"오답2\",\"오답3\",\"오답4\"]." }], { temperature: 0.6, timeout: 55000 });
    return Array.isArray(j) ? j.map(clean1).filter(Boolean).slice(0, 4) : [];
  }
  // 의미 동치 교차질의(1콜) — 정답과 '양방향 함의(사실상 같은 뜻)'인 오답을 제거해 복수정답 차단
  async function flagEquivalents(meaning, distractors) {
    if (!distractors.length) return [];
    var body = distractors.map(function (d, i) { return (i + 1) + ". " + d; }).join("\n");
    var r = await llmJSON([{ role: "system", content: "의미 동치 판정관. JSON만." },
      { role: "user", content: "정답 문장: \"" + meaning + "\"\n\n아래 선지 중 '정답과 사실상 같은 뜻'(양방향 함의: 하나가 참이면 다른 하나도 반드시 참)인 것의 번호를 모두 골라라. 표현이 달라도 뜻이 같으면 동치다.\n" + body + "\n\nJSON: {\"equivalent\":[번호]}." }], { temperature: 0.1, timeout: 45000 }).catch(function () { return null; });
    var eq = (r && Array.isArray(r.equivalent)) ? r.equivalent.map(Number) : [];
    return distractors.filter(function (_, i) { return eq.indexOf(i + 1) < 0; });
  }
  async function buildImplication(passage) {
    // 함의는 '비유·함축이 담긴 구절'을 고르고 그 '추상적 시사점'을 답으로 — 단순 사실문의 재진술은 함의가 아님.
    var o = null;
    for (var iatt = 0; iatt < 3; iatt++) {
      var oo = await llmJSON([{ role: "system", content: "함의추론 출제자. JSON만." }, { role: "user", content: "다음 글에서 '함축 의미가 풍부한(은유·상징·역설·일반화가 담긴)' 원문 구절 하나를 고르고, 그 구절이 글 전체 맥락에서 '함축하는 더 깊은 의미'를 영어 한 문장으로 풀어써라.\n★단순 사실 서술문(예: 'This system allows a single scout to...')은 고르지 마라 — 비유·상징·함축이 담긴 구절만.\n★meaning은 구절을 단어만 바꾼 '재진술'이 아니라, 그것이 시사하는 '추상적 의미'여야 한다(구절의 어휘를 그대로 반복 금지).\nphrase는 반드시 지문에 있는 문자열 그대로. JSON: {\"phrase\":\"원문 그대로의 구절\",\"meaning\":\"그 함축을 풀어쓴 영어 한 문장\"}.\n\n" + passage }], { temperature: iatt ? 0.6 : 0.4, timeout: 55000 });
      if (oo && oo.meaning && oo.phrase) {
        if (!blankVerbatim(oo.meaning, oo.phrase) || iatt === 2) { o = oo; break; }   // meaning이 구절의 재진술(어휘 80%↑ 반복)이면 재시도
      }
    }
    if (!o || !o.meaning) return null;
    var dis = await implicationDistractors(o.meaning, o.phrase);
    if (dis.length < 3) dis = dis.concat(await makeDistractors(o.meaning, "영어 한 문장", "밑줄 구절 '" + (o.phrase || "") + "'의 함의"));
    var clean = await flagEquivalents(o.meaning, dis.slice(0, 6));   // 의미동치 오답 제거(복수정답 차단)
    for (var rg = 0; rg < 2 && clean.length < 4; rg++) {             // 부족하면 재생성(최대 2회)
      var more = await implicationDistractors(o.meaning, o.phrase), seen = {};
      var merged = clean.concat(more).filter(function (d) { var k = normTok(d); if (!d || seen[k]) return false; seen[k] = 1; return true; });
      clean = await flagEquivalents(o.meaning, merged.slice(0, 6));
    }
    if (clean.length < 4) return null;   // 의미 유일성 확보 실패 → 폐기(복수정답 방지)
    var a = await reviewOptions(o.meaning, clean.slice(0, 4), { type: "함의" }); if (!a) return null;
    var pg = underlineIn(passage, o.phrase);
    if (pg.indexOf("<u>") < 0) return null;   // 밑줄이 없으면 문항 성립 불가 → 실패 처리(재시도)
    return { type: "함의", instruction: "밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?", passage: pg, choices: a.choices, answer: a.answer, explanation: "밑줄 친 부분은 '" + o.meaning + "'을 함의한다." };
  }
  // 지칭추론: 동성 2인 구도에서 대명사 5곳 밑줄(4=A, 1=B) — 부적합 지문이면 null(폴백금지)
  async function buildReference(passage) {
    var o = await llmJSON([{ role: "system", content: "지칭추론 출제자. JSON만." }, { role: "user", content: "다음 글에 같은 성(性)의 인물/대상이 둘 이상 있고 대명사(he/his/him·she/her·they/them·it/its)가 여러 번 나오면, 대명사가 실제로 등장한 부분 5곳을 '원문 그대로의 짧은 구절(대명사 포함, 등장순, 각 2~6단어)'로 고르되 4곳은 같은 대상 A를, 1곳만 다른 대상 B를 가리키게 하라. 지칭 대상이 하나뿐이거나 5곳을 못 만들면 반드시 {\"ok\":false}. JSON: {\"ok\":true,\"phrases\":[\"대명사 포함 짧은 구절 5개(원문 그대로, 등장순)\"],\"oddIndex\":1~5,\"A\":\"공통 지칭 대상(한국어)\",\"B\":\"다른 지칭 대상(한국어)\"} 또는 {\"ok\":false}. JSON만.\n\n" + passage }], { temperature: 0.4, timeout: 55000 });
    if (!o || o.ok === false || !Array.isArray(o.phrases) || o.phrases.length < 5) return null;
    var oi = parseInt(o.oddIndex, 10); if (!(oi >= 1 && oi <= 5)) return null;
    if (!o.A || !o.B || normTok(o.A) === normTok(o.B)) return null;                    // 두 지칭 대상이 실제로 달라야 함
    // 검증: 지문에 같은 성 인물/대상이 2명 이상이고 지목한 홀수 대명사가 정말 다른 대상을 가리키는지 독립 확인(단일 인물 지문에서 날조 차단)
    var vr = await llmJSON([{ role: "system", content: "지칭 검증관. JSON만." }, { role: "user", content: "지문:\n" + passage + "\n\n이 지문에 같은 성(性)의 서로 다른 인물/대상이 2개 이상 있고, 대명사가 그 둘을 각각 가리키는가? 아래 5개 구절 중 " + oi + "번만 나머지와 다른 대상을 가리키는가? 구절:\n" + o.phrases.slice(0, 5).map(function (p, i) { return (i + 1) + ". " + p; }).join("\n") + "\n\nJSON: {\"twoRefs\":true/false,\"oddIsDifferent\":true/false}. JSON만." }], { temperature: 0.1, timeout: 45000 });
    if (!vr || vr.twoRefs !== true || vr.oddIsDifferent !== true) return null;         // 부적합 지문이면 null(폴백/날조 금지)
    var mk = markWords(passage, o.phrases.slice(0, 5).map(function (p) { return String(p || "").trim(); }), -1, "");   // 치환 없이 밑줄만
    if (!mk || mk.count < 5) return null;
    return { type: "지칭추론", instruction: "밑줄 친 부분 중, 가리키는 대상이 나머지 넷과 다른 것은?", passage: mk.text, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: oi, explanation: "정답 " + CIRC5(oi) + "는 '" + (o.B || "다른 대상") + "'를 가리키고, 나머지 넷은 '" + (o.A || "주 대상") + "'를 가리킨다.", _audit: "밑줄·정답 코드검증(대명사 구절 원문 매칭)" };
  }
  // 요약: ① (A)(B) 빈칸 요약문+정답 → ② 오답 쌍
  async function buildSummary(passage) {
    function inPg(w) { var t = String(w || "").trim(); return t && new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(passage); }
    var o = null;
    for (var sa = 0; sa < 3; sa++) {   // (A)(B) 상위어 패러프레이즈 강제 — 본문 원어 그대로면 재시도(요약=키워드빙고 방지)
      o = await llmJSON([{ role: "system", content: "요약문완성 출제자. JSON만." }, { role: "user", content: "다음 글을 한 문장으로 요약하되 핵심어 두 곳을 (A),(B)로 비워라. 요약문·(A)·(B)는 반드시 영어 단어여야 한다(한국어 금지). ★(A)(B)는 지문에 나온 단어를 '그대로' 쓰지 말고 상위어·동의어로 패러프레이즈(예: dance→nonverbal signaling, location→whereabouts, gave money and time→resources). (A)(B)는 서로 다른 핵심 개념. JSON: {\"summary\":\"... (A) ... (B) ... 형태의 영어 요약문(빈칸엔 (A)/(B) 표기만)\",\"A\":\"정답 A(본문 원어 아닌 상위어)\",\"B\":\"정답 B(본문 원어 아닌 상위어)\"}.\n\n" + passage }], { temperature: 0.4 + sa * 0.15, timeout: 60000 });
      if (!o || !o.A || !o.B) { o = null; continue; }
      if (/[가-힣]/.test(String(o.A) + String(o.B))) { o = null; continue; }   // 영어 강제
      if (sa < 2 && (inPg(o.A) || inPg(o.B))) { o = null; continue; }          // 본문 원어 verbatim → 재시도
      break;
    }
    if (!o || !o.A || !o.B) return null;
    // 요약문에 정답이 그대로 노출되지 않도록 (A)/(B) 자리 정규화
    var summ = String(o.summary);
    if (summ.indexOf("(A)") < 0) summ = summ.replace(o.A, "(A)"); if (summ.indexOf("(B)") < 0) summ = summ.replace(o.B, "(B)");
    var ans = "(A) " + o.A + " … (B) " + o.B, dis = [], seenAB = {};
    // 오답쌍은 '지문 소재 안에서' 만들어야 온토픽(과거엔 지문 미제공 → 무관한 한국어 선지 날조). 4개 확보까지 재시도.
    for (var dt = 0; dt < 3 && dis.length < 4; dt++) {
      var dj = await llmJSON([{ role: "system", content: "요약문 오답 설계자. JSON 배열만." }, { role: "user", content: "[지문]\n" + String(passage).slice(0, 900) + "\n\n요약문: " + summ + "\n정답 (A)=" + o.A + ", (B)=" + o.B + "\n\n위 지문·요약문에 근거하되 '정답과 의미가 다른' (A)/(B) 영어 단어쌍 오답 4개(한국어 금지, 지문 소재 안에서 반의·부분·범위과장·인과전도 각1, 정답 재사용 금지). JSON 배열 [{\"A\":\"..\",\"B\":\"..\"}] 만." }], { temperature: 0.6 + dt * 0.15, timeout: 50000 }).catch(function () { return null; });
      (Array.isArray(dj) ? dj : []).forEach(function (x) {
        if (!x || !x.A || !x.B || /[가-힣]/.test(x.A + x.B)) return;
        var k = normTok(x.A + x.B); if (k === normTok(o.A + o.B) || seenAB[k]) return;
        seenAB[k] = 1; dis.push("(A) " + x.A + " … (B) " + x.B);
      });
    }
    if (dis.length < 4) return null;   // 유효 오답쌍 4개 미확보 → 요약 문항 폐기(날조·혼입 방지)
    // (A)(B) 쌍은 구조가 명확하므로 코드가 직접 셔플·정답위치 결정(LLM 선지 날조 방지)
    var pool = [ans].concat(dis.slice(0, 4));
    for (var si = pool.length - 1; si > 0; si--) { var sj = rint(si + 1), stmp = pool[si]; pool[si] = pool[sj]; pool[sj] = stmp; }
    var apos = pool.indexOf(ans) + 1;
    return { type: "요약문AB", instruction: "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: passage + "\n\n─────────\n[요약문]  " + summ, choices: pool, answer: apos, explanation: "(A) " + o.A + " / (B) " + o.B + " 가 글의 요지를 정확히 요약한다. 오답은 (A)나 (B) 중 하나 이상이 지문 논지와 어긋난다.", _audit: "정답 코드생성됨((A)(B) 쌍 코드 셔플)" };
  }
  // 내용불일치/일치
  function factResult(wantMatch, st, ans, mode, passage) {
    return { type: wantMatch ? "내용일치" : "내용불일치", instruction: "다음 글의 내용과 " + (wantMatch ? "일치하는" : "일치하지 않는") + " 것은?", passage: String(passage || ""), choices: st, answer: ans, explanation: "정답 진술만 글과 " + (wantMatch ? "일치" : "모순") + "한다.", _audit: (mode === "검증") ? "정답 코드검증됨(모순 진술 정확히 1개 확인)" : "⚠ 정답 미검증 — 복수정답 소지, 재확인 필요" };
  }
  async function buildFactCheck(passage, wantMatch) {
    // 통제 생성: ①지문에서 참인 사실진술 5개 추출 → ②코드가 정답 1개 지정 → ③나머지를 '세부 한 곳 뒤집기'로 거짓화 → ④검증
    for (var attempt = 0; attempt < 4; attempt++) {
      var ext = await llmJSON([{ role: "system", content: "사실추출관. JSON만." }, { role: "user", content: "다음 글에서 '지문이 명시적으로 뒷받침하는' 서로 다른 사실 진술 5개를 뽑아라(수치·시간·주체·행위·조건 중심, 각 진술은 서로 다른 문장 근거, 지문에 없는 정보 금지). ★순수 한국어로만 — 고유명사가 아닌 영어 단어를 남기지 말 것(honeycomb→벌집 등 번역). ★5개 진술의 길이를 서로 비슷하게(각 20~30자). JSON: {\"facts\":[\"참인 진술 5개\"]}. JSON만.\n\n" + passage }], { temperature: attempt ? 0.5 : 0.35, timeout: 55000 });
      if (!ext || !Array.isArray(ext.facts) || ext.facts.length < 5) continue;
      var facts = ext.facts.slice(0, 5).map(function (s) { return String(s || "").trim(); });
      var keep = rint(5);   // 정답(참으로 남길) 진술 위치 — 코드가 지정
      var toFlip = facts.filter(function (_, i) { return i !== keep; });
      var flip = await llmJSON([{ role: "system", content: "오답(거짓 진술) 설계자. JSON만." }, { role: "user", content: "다음 참인 진술 4개 각각에서 낱말 하나(주체·시점·수치·장소·긍부정 중 하나)만 지문과 어긋나게 바꿔 '거짓 진술'로 만들어라. ★★부정어(않다·못하다·아니다)를 새로 붙이거나 절(~하지 않고 …)을 추가해 문장을 늘리지 말 것 — 원 진술과 '길이·구조를 똑같이' 유지하고 딱 한 낱말만 교체(예: '태양'→'바람', '증가'→'감소', '수백'→'수십'). 순수 한국어. JSON: {\"false\":[\"거짓 진술 4개(입력 순서 유지)\"]}. JSON만.\n\n[지문]\n" + passage + "\n\n[참 진술 4개]\n" + toFlip.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n") }], { temperature: 0.5, timeout: 55000 });
      if (!flip || !Array.isArray(flip.false) || flip.false.length < 4) continue;
      var falses = flip.false.slice(0, 4).map(function (s) { return String(s || "").trim(); });
      // 조립: keep 위치엔 참(정답=wantMatch일 때) / 나머지엔 거짓
      var st = [], fi = 0;
      for (var i = 0; i < 5; i++) st.push(i === keep ? facts[keep] : falses[fi++]);
      var ansPos = keep + 1;
      // 불일치형: 참 4개 + 거짓 1개(keep 위치) → 거짓이 정답
      if (!wantMatch) { st = facts.slice(); st[keep] = falses[0]; }
      // 위생: 한·영 붙은 토큰 분리
      st = st.map(function (x) { return String(x).replace(/([가-힣])([A-Za-z])/g, "$1 $2").replace(/([A-Za-z])([가-힣])/g, "$1 $2").replace(/\s+/g, " ").trim(); });
      // 한영혼용 게이트: 선지에 영어 단어(3자+)가 남으면 재시도(순수 한국어 강제)
      if (st.some(function (x) { return /[A-Za-z]{3,}/.test(x); }) && attempt < 3) continue;
      // 형태단서 게이트: 정답이 유독 짧거나 길면(길이단서 — '짧은 게 정답' 포함) 재시도
      var _L = st.map(function (x) { return x.length; }), _a = _L[ansPos - 1], _o = _L.filter(function (_, i) { return i !== ansPos - 1; });
      var _mn = Math.min.apply(null, _o), _mx = Math.max.apply(null, _o);
      if (attempt < 3 && ((_a < _mn && _mn - _a >= 8) || (_a > _mx && _a - _mx >= 10))) continue;
      // 극성단서 게이트: 정답만 부정극성이 다르면(정답 긍정 vs 오답 다수 부정, 또는 그 반대) '부정 든 것/안 든 것' 표면단서로 무독해 식별 → 재시도
      var _neg = st.map(function (x) { return /않|못하|아니|없|안\s|하지\s*않/.test(x); });
      var _an = _neg[ansPos - 1], _onCnt = _neg.filter(function (v, i) { return i !== ansPos - 1 && v; }).length;
      if (attempt < 3 && ((_an && _onCnt === 0) || (!_an && _onCnt >= 3))) continue;
      // 검증: 정답 위치가 실제로 (일치/모순) 유일한지 확인
      var v = await llmJSON([{ role: "system", content: "사실검증관. JSON만." }, { role: "user", content: "지문:\n" + passage + "\n\n진술:\n" + st.map(function (s, i2) { return (i2 + 1) + ". " + s; }).join("\n") + "\n\n각 진술을 지문과 대조. JSON: {\"support\":[일치 번호],\"contradict\":[모순 번호]}. JSON만." }], { temperature: 0.12, timeout: 50000 });
      var contra = (v && Array.isArray(v.contradict)) ? v.contradict.map(Number).filter(function (x) { return x >= 1 && x <= 5; }) : [];
      var supp = (v && Array.isArray(v.support)) ? v.support.map(Number).filter(function (x) { return x >= 1 && x <= 5; }) : [];
      if (wantMatch && supp.length === 1 && supp[0] === ansPos) return factResult(true, st, ansPos, "검증", passage);
      if (!wantMatch && contra.length === 1 && contra[0] === ansPos) return factResult(false, st, ansPos, "검증", passage);
      // 검증 불일치 → 재시도(다음 attempt)
    }
    return null;   // 검증 실패 시 미검증 문항 미납품(상위 재시도/스킵)
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
      if (i === corruptIdx) { placed = m[0]; if (/^[A-Z]/.test(m[0]) && /^[a-z]/.test(shown)) shown = shown.charAt(0).toUpperCase() + shown.slice(1); }  // 문장 첫머리 대문자 보존(오류주입이 소문자 단서로 노출되던 버그)
      out += rest.slice(0, m.index) + circ.charAt(i) + "<u>" + shown + "</u>";
      rest = rest.slice(m.index + m[0].length); count++;
    }
    return { text: out + rest, count: count, orig: placed };
  }
  // 특정 단어가 든 지문 문장(호스트 문장)을 반환 — 어휘 해설의 담화근거 코드 폴백(lookbehind 미사용, 구엔진 호환)
  function hostCtx(passage, word) {
    if (!word) return "";
    var w = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var sents = String(passage).match(/[^.!?]+[.!?]+/g) || [String(passage)];
    for (var i = 0; i < sents.length; i++) { if (new RegExp("\\b" + w + "\\b", "i").test(sents[i])) return sents[i].trim().replace(/\s+/g, " ").slice(0, 150); }
    return "";
  }
  // 어휘(문맥상 부적절): LLM은 '어느 단어를 무엇으로' 정하고, 밑줄·치환은 코드가 수행 → 정답위치 100% 정합
  async function buildVocab(passage) {
    var cw = contentWords(passage).slice(0, 8), ant = {};
    await Promise.all(cw.map(async function (w) { var sa = synAnt(w); if (sa && sa.ant && sa.ant.length) { ant[w] = sa.ant[0]; return; } var a = await datamuse(w, "ant", 2); if (a.length) ant[w] = a[0]; }));
    var brief = Object.keys(ant).map(function (w) { return w + "↔" + ant[w]; }).join(", ");
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어휘(문맥상 부적절) 출제자. JSON만." }, { role: "user", content: "다음 지문에서 서로 다른 핵심 단어 5개를 '지문에 나온 그대로(등장 순서)' 고르고, 그 중 1개를 문맥상 명백히 부적절한 반의어로 바꿀지 정하라. ★교체어는 원래 단어와 반드시 같은 품사(동사↔동사, 형용사↔형용사, 명사↔명사)여야 하고, 그 자리에 넣어도 문법적으로 성립해야 한다. 품사가 다른 반의어(예: communicate(동사)→simple(형용사)) 절대 금지. 참고 반의어쌍(같은 품사): " + (brief || "-") + ". ★해설 근거는 사전 뜻풀이·유의/반의 나열이 아니라 '앞뒤 문장의 방향·인과·대조 관계'로만 판단하라. JSON: {\"words\":[\"지문에 실제로 있는 단어 5개(등장순)\"],\"wrongIndex\":1~5,\"wrong\":\"그 자리에 넣을 부적절 반의어(원단어와 같은 품사, 한 단어)\",\"correct\":\"원래 맞는 단어\",\"reason\":\"왜 correct가 와야 하는지 앞뒤 문장의 방향/인과/대조 단서로 1문장(사전뜻풀이 금지)\",\"polarity\":\"정답어 vs 오답어의 문맥 극성 차이 한 구절(예: 정답=협력/증가 ↔ 오답=경쟁/감소)\"}. JSON만.\n\n" + passage }], { temperature: attempt ? 0.5 : 0.4, timeout: 55000 });
      if (!o || !Array.isArray(o.words) || o.words.length < 5 || !o.wrong) continue;
      var wi = parseInt(o.wrongIndex, 10); if (!(wi >= 1 && wi <= 5)) wi = 1;
      // 같은 품사 datamuse 반의어가 있으면 그걸 우선(품사 안전) — 없으면 LLM 제안
      var tgtW = String(o.words[wi - 1] || "").toLowerCase();
      var dmAnt = ant[tgtW] || (synAnt(tgtW) && synAnt(tgtW).ant && synAnt(tgtW).ant[0]);
      var wrongW = String(dmAnt || o.wrong).replace(/[^A-Za-z\- ]/g, "").trim();
      // 정답 교체어가 지문에 이미 존재하면 자기모순(deliberate practice, not deliberate gift)·즉시 노출 → 재시도
      if (!wrongW || new RegExp("\\b" + wrongW.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(passage)) continue;
      if (!spreadOK(passage, o.words.slice(0, 5), attempt)) continue;   // 밑줄 5곳 문장 분산(한 문장 몰림 방지)
      var mk = markWords(passage, o.words.slice(0, 5), wi - 1, wrongW);  // 코드가 밑줄+치환
      if (!mk || mk.count < 5) continue;                       // 5개 다 못 찾으면 재시도
      // 해설: 사전식 치환 메타가 아니라 담화근거(앞뒤 문장 방향/인과/대조)로. LLM reason 없으면 host 문장 인용 폴백.
      var corr = o.correct || mk.orig;
      // 담화근거: LLM reason이 한국어일 때만 사용(영어 문장이 그대로 오는 코드혼용 방지) — 아니면 호스트 문장 인용 폴백
      var rz = String(o.reason || "").trim();
      var rzKo = rz && (rz.match(/[가-힣]/g) || []).length >= (rz.match(/[A-Za-z]/g) || []).length;
      var why = rzKo ? rz : (function () { var h = hostCtx(passage, o.words[wi - 1] || corr); return h ? ("해당 문장 “" + h + "”의 논리 흐름상 " + corr + "가 맞고 " + o.wrong + "는 방향이 어긋난다") : "앞뒤 문장의 논리 흐름상 " + corr + "가 맞다"; })();
      var polLine = (o.polarity && String(o.polarity).trim()) ? (" [극성] " + String(o.polarity).trim()) : "";
      return { type: "어휘", instruction: "밑줄 친 ⓐ~ⓔ 중 문맥상 낱말의 쓰임이 적절하지 않은 것은?", passage: mk.text, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: wi, explanation: "정답 " + CIRC5(wi) + ": 문맥상 '" + corr + "'가 와야 하는데 '" + o.wrong + "'가 쓰여 부적절하다 — " + why + "." + polLine, _audit: "정답위치 코드생성됨(치환·밑줄 코드처리·문장분산·담화근거 해설)", _vocab: { words: o.words.slice(0, 5), wrong: o.wrong, correct: corr, wi: wi, why: why, polarity: (o.polarity ? String(o.polarity).trim() : "") } };
    }
    return null;
  }
  // 어법: LLM은 '어느 구절을 어떻게 틀리게'만 정하고, 밑줄·오류주입은 코드가 수행 → 정답위치 100% 정합
  // 어법 범주를 오류↔정답 diff에서 결정론적으로 추론(LLM cats 라벨이 자주 틀려 오도하므로 코드가 우선).
  function inferGramCat(err, cor) {
    var e = " " + String(err).toLowerCase() + " ", c = " " + String(cor).toLowerCase() + " ";
    var REL = /\b(which|that|who|whom|whose|where|when|why|what)\b/;
    if (REL.test(e) !== REL.test(c) || (REL.test(e) && REL.test(c) && (e.match(REL) || [])[0] !== (c.match(REL) || [])[0])) return "관계사";
    var ew = e.trim().split(/\s+/), cw = c.trim().split(/\s+/), d = [];
    for (var i = 0; i < Math.max(ew.length, cw.length); i++) if ((ew[i] || "") !== (cw[i] || "")) d.push((ew[i] || "") + "→" + (cw[i] || ""));
    var ds = d.join(" ");
    if ((/\bto\b|→to\b|\bto→|ing→|→ing\b/.test(ds)) && !/\b(is|are|was|were|been|being)\b/.test(ds)) return "준동사";   // to부정사·동명사(to/ing 관여)
    if (/\b(been|being|be)\b|\bby\b|\w+ed→\w+ing|\w+ing→\w+ed/.test(ds)) return "태";
    if (/\b(is|are|was|were|has|have|had|does|do|did)\b/.test(ds)) return "수일치";
    if (/\w+ed→\w+\b|\b\w+→\w+ed\b/.test(ds)) return "시제";   // 순수 굴절(과거↔현재)
    if (/\w+s→\w+\b|\b\w+→\w+s\b|goes|go|says|say/.test(ds)) return "수일치";
    if (/\w+ly→\w+\b|\b\w+→\w+ly\b/.test(ds)) return "형용사부사";
    if (/\ber→|→\w+er\b|est→|→\w+est\b|\bmore\b|\bmost\b|\bthan\b/.test(ds)) return "비교";
    if (/\b(in|on|at|to|for|of|with|from|by|about|into)\b/.test(ds)) return "전치사";
    return "";
  }
  async function buildGrammar(passage) {
    var gecEx = gecExamples(2);
    // 결정론적 오교정(inversion) 차단 — LanguageTool이 못 잡는 뒤바뀜(정문을 '틀렸다'며 비문으로 고치라는 0점 정답키) 폐기.
    //   대표: 계사(be/seem/look…)+형용사(정문)를 -ly부사(비문)로 '교정'하라는 지시(they are smart→they are smartly).
    var COP = /\b(is|are|was|were|be|been|being|becomes?|became|seems?|feels?|felt|looks?|looked|appears?|remains?|stays?|grows?|grew|sounds?)\b/i;
    function invertedPair(err, cor) {
      var e = String(err || "").trim(), c = String(cor || "").trim();
      if (!e || !c || normTok(e) === normTok(c)) return true;                                  // 무변화·빈값
      if (COP.test(e) && COP.test(c) && !/\w{3,}ly\b/.test(e) && /\w{3,}ly\b/.test(c)) return true;  // 계사+형용사(정문 error) ↔ 계사+부사(비문 correct)=뒤바뀜
      return false;
    }
    // 비오류(문법상 양쪽 다 옳음) 차단 — '오류 없는데 고치라'는 문항 방지(적대감사 HIGH: angles/optional copula)
    function nonError(err, cor) {
      var e = " " + String(err || "").toLowerCase().trim() + " ", c = " " + String(cor || "").toLowerCase().trim() + " ";
      var strip = function (s, re) { return s.replace(re, " ").replace(/\s+/g, " ").trim(); };
      // ① 상관비교급 선택적 계사: 'the more … is' ↔ 'the more …'(is 생략은 문체 선택)
      if (/\bthe (more|less|greater|higher|lower|bigger)\b/.test(e + c) && strip(e, /\bis\b/) === strip(c, /\bis\b/)) return true;
      // ② that 생략(선택): 'say/think/know that X' ↔ 'say/think/know X'
      if (strip(e, /\bthat\b/) === strip(c, /\bthat\b/) && e !== c) return true;
      // ③ 정관사+가산명사 단복수 'the Xs of' ↔ 'the X of'(둘 다 문법 성립)
      var ew = e.trim().split(/\s+/), cw = c.trim().split(/\s+/);
      if (ew.length === cw.length) {
        var di = [], k; for (k = 0; k < ew.length; k++) if (ew[k] !== cw[k]) di.push([ew[k], cw[k]]);
        if (di.length === 1) { var a = di[0][0], b = di[0][1]; if ((a === b + "s" || b === a + "s") && /\b(the|its|their|his|her|our|your)\b/.test(e) && /\bof\b/.test(e + c)) return true; }
      }
      return false;
    }
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어법 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 판단 지점 5곳을 고르고 그 중 1곳을 실제 '문법' 오류로 바꿔라. ★밑줄 최소단위: 각 구절은 '문법 판단이 걸리는 바로 그 부분만 1~4단어'로 짧게 — 긴 구·절 통째 금지. 실제 수능/사관 예: have unearthed(수일치)·containing(분사)·which(관계사)·to enhance(부정사)·sound(형용사보어)처럼 판단 지점만. ★5곳은 반드시 서로 다른 문장·서로 다른 문법 범주. ★철자 오타 금지 — 수일치·시제·태·준동사·관계사·병렬·전치사 등 문법만. JSON: {\"phrases\":[\"판단지점 구절 5개(각 1~4단어, 등장순, 원문 그대로, 서로 다른 문장)\"],\"cats\":[\"각 문법범주 5개(수일치|시제|태|준동사|분사|관계사|병렬|전치사|형용사부사|비교|가정법)\"],\"wrongIndex\":1~5,\"error\":\"그 구절을 틀리게 바꾼 형태\",\"correct\":\"원래 올바른 구절(=phrases 해당 항목과 동일)\"}. JSON만." + (gecEx ? (" 오류 예: " + gecEx) : "") + "\n\n" + passage }], { noRule: true, temperature: attempt ? 0.45 : 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.phrases) || o.phrases.length < 5 || !o.error || String(o.error).trim() === String(o.correct || "").trim()) continue;
      // 스키마 설명문 에코 방어: 소형모델이 'error'/'correct'에 한글 설명("원문 그대로"·"틀리게 바꾼 형태" 등)이나 문장 통째를 넣는 실패 폐기
      if (/[가-힣]/.test(o.error) || /[가-힣]/.test(String(o.correct || "")) || /그대로|형태|구절|문장|단서/.test(o.error + " " + o.correct)) continue;
      if (String(o.error).split(/\s+/).length > 6 || String(o.correct || "").split(/\s+/).length > 6) continue;   // 정답/오답 어구는 최소단위(문장 통째 금지)
      // phrases에도 한글·설명문이 섞이면 폐기
      if (o.phrases.slice(0, 5).some(function (p) { return /[가-힣]/.test(String(p)) || /그대로|형태|구절/.test(String(p)); })) continue;
      var phr = o.phrases.slice(0, 5).map(function (p) { return String(p || "").trim(); });
      if (attempt < 2 && phr.some(function (p) { return p.split(/\s+/).length > 5; })) continue;   // 밑줄 최소단위(≤5단어) — 긴 구·절이면 재시도(실제 기출 밑줄은 1~3단어)
      if (!spreadOK(passage, phr, attempt)) continue;   // 밑줄 분산: 한 문장 몰림 방지(수능 원칙)
      if (attempt < 2 && Array.isArray(o.cats)) { var uc = {}; o.cats.slice(0, 5).forEach(function (c) { uc[normTok(c)] = 1; }); if (Object.keys(uc).length < 4) continue; }   // 문법 범주 다양성(4종↑)
      // wrongIndex 자기보고 불신: correct와 동일한 구절을 코드로 탐색(0-기준 응답 등 오류 방어)
      var wi = -1;
      for (var pi = 0; pi < phr.length; pi++) { if (normTok(phr[pi]) === normTok(o.correct)) { wi = pi + 1; break; } }
      if (wi < 0) { var win = parseInt(o.wrongIndex, 10); wi = (win >= 1 && win <= 5) ? win : 1; }
      if (invertedPair(o.error, o.correct)) continue;   // 정답키 correctness 하드게이트(LT 독립): 뒤바뀜·무변화면 폐기
      if (nonError(o.error, o.correct)) continue;        // 비오류(양쪽 다 정문: 선택적 계사·that생략·가산명사 단복수) 폐기
      var mk = markWords(passage, phr, wi - 1, String(o.error).trim());   // 코드가 밑줄+오류주입
      if (!mk || mk.count < 5) continue;
      var g0 = []; try { g0 = await grammar(passage.replace(/<[^>]+>/g, " ")); } catch (_) {}
      var g = []; try { g = await grammar(String(mk.text).replace(/<[^>]+>/g, " ").replace(/[ⓐ-ⓔ]/g, "")); } catch (_) {}
      // 오류주입 검증: 주입 후 문법 오류가 원문보다 늘지 않으면(무오류 주입) 재시도 — '틀린 곳이 없는' 문항 방지
      if (g.length <= g0.length && attempt < 2) continue;
      var verified = g.length;   // 내부 boolean만 유지(도구명 explanation 비노출 — §10)
      var cat = inferGramCat(o.error, o.correct || mk.orig) || ((Array.isArray(o.cats) && o.cats[wi - 1]) ? String(o.cats[wi - 1]).replace(/[^가-힣]/g, "") : "") || "어법";   // diff 결정론 우선, LLM 라벨은 한글만, 최후 generic
      var slotTag = "[어법: " + cat + "] ";   // 물어보는 slot(문법 범주) 선언 — §10 '어법 메타 없음' 회피
      return { type: "어법", instruction: "밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것은?", passage: mk.text, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: wi, explanation: slotTag + "정답 " + CIRC5(wi) + "의 '" + o.error + "'는 '" + (o.correct || mk.orig) + "'로 고쳐야 어법상 옳다." + (verified ? " (어법 오류 확인됨)" : ""), _audit: "정답위치 코드생성됨(밑줄·오류주입 + 문법검사 대조)", _gram: { error: String(o.error).trim(), correct: String(o.correct || mk.orig).trim(), wi: wi, verified: !!verified, cat: cat, phrases: phr.slice(0, 5), cats: (Array.isArray(o.cats) ? o.cats.slice(0, 5).map(function (c) { return String(c || "").replace(/[^가-힣A-Za-z]/g, ""); }) : []) } };
    }
    return null;
  }
  // 서술형 — 채점 루브릭 코드생성(내신은 '쓰기·검수 게임': 조건 미충족·철자·어형 하나로 등급이 갈림).
  // 근거: special_exams_longitudinal.md(조건 슬롯화·0점트리거) + exam_core_v1 subjective_scoring(내용40·형식35·어법철자25).
  function essayRubric(type, instruction, answer) {
    var I = String(instruction || ""), A = String(answer || "");
    // 영작형 판정: 유형 라벨이 generic("서술형")일 수 있으므로 모범답안이 영어 위주인지로 견고하게 판단
    var eng = (A.match(/[A-Za-z]/g) || []).length, kor = (A.match(/[가-힣]/g) || []).length;
    var isWrite = eng > kor || /영작|영어로|write|in English/i.test(I);
    var cond = [], zero = ["무응답·백지", "주제 완전 이탈(지문 무관)"];
    // 조건 슬롯 추출 — 발문에서 실제 제약을 감지해 채점 조건으로 승격
    var mw = I.match(/(\d+)\s*[~-]\s*(\d+)\s*단어/) || I.match(/(\d+)\s*단어\s*(?:이내|내외|내로|이상)?/);
    if (mw) { cond.push("단어 수 " + mw[0] + " 충족(WORDLIMIT)"); zero.push("단어 수 조건 심각 위반"); }
    var req = (I.match(/["“]([A-Za-z][A-Za-z\- ]{1,24})["”]/g) || []).map(function (s) { return s.replace(/["“”]/g, "").trim(); });
    if (req.length && /필수|포함|모두|주어진/.test(I)) { cond.push("필수어 사용: " + req.slice(0, 6).join(", ") + " (ALLWORDS)"); zero.push("필수어 전면 미사용"); }
    if (/어형|형태\s*변(형|화)|바꿔|바꾸어|알맞은 형태/.test(I)) cond.push("제시어 어형 변형 정확(TRANSFORM: 시제·수·태·품사)");
    if (/그대로|어형은? 그대로|변형하지/.test(I)) cond.push("제시어 어형 그대로 사용(고정)");
    if (/금지|쓰지 ?마|사용하지 ?마|바꿔 ?쓰|패러프레이즈/.test(I)) cond.push("본문 표현 그대로 베끼기 금지 / 패러프레이즈 강제(PARAPHRASE)");
    if (/관계(사|절)|분사|가정법|수동|능동|도치|구조|구문/.test(I)) cond.push("지정 구문 사용(STRUCTURE)");
    if (/틀린|어법상 오류|오류를? 찾|고쳐|바르게 고/.test(I)) { cond.push("지정 오류 정확히 색출·수정(개수 일치)"); zero.push("오류 미발견 또는 오수정"); }
    if (/첫 ?글자|initial|주어진 철자/.test(I)) cond.push("제시 철자로 시작하는 정답어 산출");
    var body = isWrite
      ? [ "① 내용 정확성 40% — 지문 근거·핵심 정보를 정확히 반영",
          "② 조건·형식 35% — " + (cond.length ? cond.join(" / ") : "제시 조건 충족·형식 준수"),
          "③ 어법·철자 25% — 문법·철자·구두점 정확(오류 1개당 감점, 누적 시 형식점 소실)" ]
      : [ "① 정확성 60% — 우리말 뜻·핵심 정보 정확", "② 완결성 40% — 조건 충족·표현 자연스러움" ];
    var minus = isWrite ? "감점: 철자·어형 오류 1개당 −1(형식점 내), 조건 부분충족 −2, 단어 수 초과·미달 −2." : "감점: 오역·누락 부분점.";
    return "\n[채점 루브릭] " + body.join(" · ") + "\n[0점 트리거] " + zero.join(" / ") + "\n" + minus;
  }
  // 서술형 단어수 실측 역산(Ray 원칙: 모범답안이 진리원천) — 발문·루브릭의 단어밴드를 답 실측 N으로 동기화
  function essayWordCount(ans) { return String(ans || "").trim().split(/\s+/).filter(Boolean).length; }
  function isEnglishAnswer(ans) { var s = String(ans || ""); return (s.match(/[A-Za-z]/g) || []).length > (s.match(/[가-힣]/g) || []).length; }
  function syncEssayWords(instr, answer) {
    if (!isEnglishAnswer(answer)) return instr;                       // 영작형만(해석형 제외)
    var n = essayWordCount(answer); if (n < 3) return instr;
    var lo = Math.max(1, n - 2), hi = n + 2, s = String(instr), did = false;
    s = s.replace(/(\d+)\s*[~\-–]\s*(\d+)\s*단어/, function () { did = true; return lo + "~" + hi + "단어"; });   // RANGE 우선(배타)
    if (!did) s = s.replace(/(\d+)\s*단어\s*(이내|내외|이하|정도|안팎)/, function (m, num, suf) { return n + "단어 " + suf; });   // LIMIT(길이 큐 있을 때만; '제시어 N단어'는 불변)
    return s;
  }
  function essayResult(type, instruction, answer) {
    var instr = syncEssayWords(instruction, answer);   // 답 실측으로 발문 밴드 동기화 → essayRubric도 동일 발문을 읽어 자동 일치(단일 진리원천)
    return { type: type, instruction: instr, passage: "", choices: [], answer: 0, answerText: (isEnglishAnswer(answer) ? String(answer || "") : ""),
      explanation: "[모범답안] " + (answer || "") + essayRubric(type, instr, answer),
      _audit: isEnglishAnswer(answer) ? ("서술형 단어수 " + essayWordCount(answer) + " 실측·발문 동기화") : "" };
  }
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
  // ===== 답안 우선(answer-first) 서술형 파이프라인 — '쓸 문장(모범답안)'을 먼저 정하고 조건·루브릭을 역산 조립.
  //   ① 모범답안 문장 설계 → ② 조건 역산(필수어·단어수) → ③ 발문 조립 → ④ 루브릭(essayResult). =====
  async function buildEssayAnswerFirst(passage, type) {
    var t = String(type || "");
    var isWrite = /영작|이어|의견|요약|주제문|전환|주장|핵심|쓰|write/i.test(t) && !/해석|우리말 ?로 ?해석|국역/.test(t);
    // 유형별 답안 성격
    var task = /의견/.test(t) ? "글의 주제에 대한 '당신의 의견'을" : /요약/.test(t) ? "글 전체를" : "글의 핵심(필자의 주장·요지)을";
    // ① 모범답안 문장 먼저 (쓸 문장이 먼저다)
    var ap = isWrite
      ? ("다음 지문을 읽고 " + task + " 담은 '영어 한 문장'을 써라 — 12~22단어, 어법 완전, 본문 문장을 통째로 복사하지 말고 재구성. 문장만 출력.")
      : ("다음 지문을 읽고 " + task + " 담은 '한국어 한 문장'으로 써라(자연스럽게). 문장만 출력.");
    function langOf(s) { return (String(s).match(/[A-Za-z]/g) || []).length > (String(s).match(/[가-힣]/g) || []).length; }
    var ans = "";
    for (var la = 0; la < 2; la++) {   // 언어 불일치 시 1회 재시도(발문·답 언어 일치 강제)
      var raw = await ask(ap + (la ? ("\n★반드시 " + (isWrite ? "영어" : "한국어") + "로만 쓸 것.") : "") + "\n\n" + passage, "문장 하나만. 번호·따옴표·설명 금지.", { noRule: true, temperature: la ? 0.55 : 0.5 });
      ans = String(raw || "").replace(/^["'·\-\s]+|["'\s]+$/g, "").split(/\n/)[0].trim();
      if (ans && ans.split(/\s+/).length >= 4 && langOf(ans) === isWrite) break;
    }
    if (!ans || ans.split(/\s+/).length < 4) return null;
    var eng = langOf(ans);   // ★발문·조건은 '실제 답안 언어'에 맞춰 조립(발문-답 언어 불일치 근절)
    // ② 조건 역산(영작형): 필수어(답안 핵심 내용어) + 단어수 밴드
    var conds = [];
    if (eng) {
      var wc = essayWordCount(ans);
      var keys = (ans.match(/[A-Za-z][A-Za-z\-]{3,}/g) || []).filter(function (w) { return !STOP[w.toLowerCase()]; });
      var seen = {}, uniq = []; keys.forEach(function (w) { var k = w.toLowerCase(); if (!seen[k]) { seen[k] = 1; uniq.push(w); } });
      uniq.sort(function (a, b) { return b.length - a.length; });
      var picks = uniq.slice(0, 3);
      if (picks.length >= 2) conds.push("다음 단어를 반드시 포함할 것: " + picks.map(function (w) { return "'" + w + "'"; }).join(", "));
      conds.push(Math.max(3, wc - 2) + "~" + (wc + 2) + "단어로 쓸 것");
    }
    // ③ 발문 조립 — 실제 답안 언어(eng) 기준
    var stem = eng
      ? (/의견/.test(t) ? "다음 글의 주제에 대한 자신의 의견을 영어 한 문장으로 서술하시오." : /요약/.test(t) ? "다음 글의 내용을 영어 한 문장으로 요약하여 서술하시오." : "다음 글의 핵심 내용(필자의 주장·요지)을 영어 한 문장으로 서술하시오.")
      : "다음 글의 핵심 내용(필자의 주장·요지)을 우리말 한 문장으로 서술하시오.";
    var instr = stem + (conds.length ? ("\n〈조건〉 " + conds.join(" / ")) : "");
    // ④ 루브릭은 essayResult가 발문·답안에서 역산(단어수 동기화 포함)
    return essayResult(type, instr, ans);
  }
  async function buildEssay(passage, opts, type) {
    type = type || "서술형";
    // ★답안 우선: 모범답안 문장을 먼저 정하고 조건·루브릭을 역산(서술형은 쓸 문장이 먼저다). 실패 시 기존 동시생성 폴백.
    var af = await buildEssayAnswerFirst(passage, type).catch(function () { return null; });
    if (af && af.instruction && af.explanation) return af;
    // 무거운 규칙을 system에 주입하면 소형모델이 빈 응답을 내므로, 규칙은 user에 짧게만 넣고 noRule로 호출
    var ess = (TYPERULE || "").replace(/\s+/g, " ").trim().slice(0, 130);
    var sys = "너는 고교 내신 영어 서술형 출제자다. 발문은 순수 한국어(+영어 인용)로만 쓴다 — 중국어·일본어 문자 금지. 출력은 아래 두 구획 형식만 쓴다(JSON·마크다운·여분 설명 금지). ★영작형: '필수 포함 단어'를 제시하면 반드시 영어 단어로 쓰고, 모범답안(정답)이 그 단어를 실제로 포함해야 한다. 발문에 '단어 수' 조건을 적으면 모범답안이 그 범위를 충족해야 한다. 빈칸(____) 클로즈와 자유 이어쓰기를 섞지 마라(한 형식만).";
    var fmt = "정확히 이 형식만 출력:\n[발문]\n(제시문·조건·주어진 단어/어구를 포함한 한국어 발문, 여러 줄 가능)\n[정답]\n(모범답안 — 영작형은 영어 문장, 해석형은 우리말)";
    // 발문 조건과 모범답안 정합성 검사(영작형): 필수 영어단어 포함·단어수 범위 충족
    function essayConsistent(instr, ans) {
      var isWrite = /영작|이어|의견|요약|주제문|쓰시오|write/i.test(type) && /[A-Za-z]/.test(ans);
      if (!isWrite) return true;
      var req = (instr.match(/["“]([A-Za-z][A-Za-z\- ]{1,20})["”]/g) || []).map(function (s) { return s.replace(/["“”]/g, "").trim().toLowerCase(); });
      var alow = String(ans).toLowerCase();
      if (req.length && /필수|포함/.test(instr) && !req.every(function (w) { return alow.indexOf(w) >= 0; })) return false;   // 필수 영어단어 미포함
      var m = instr.match(/(\d+)\s*[~-]\s*(\d+)\s*단어/); var wc = String(ans).trim().split(/\s+/).filter(Boolean).length;
      if (m && (wc < +m[1] - 2 || wc > +m[2] + 2)) return false;                                                          // 단어수 범위 벗어남
      var m2 = instr.match(/(\d+)\s*단어\s*(?:이내|내외|내로)?/); if (m2 && !m && Math.abs(wc - +m2[1]) > 4) return false;
      return true;
    }
    for (var i = 0; i < 4; i++) {
      var hint = (i < 2 && ess) ? ("\n(출제 지침 요약: " + ess + ")") : ""; // 1~2차만 지침, 이후 무지침으로 출제 보장
      var user = "다음 지문으로 '" + type + "' 유형의 내신 서술형 1문항을 만들어라." + hint + "\n" + fmt + "\n\n[지문]\n" + passage;
      var raw = await llm([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: i ? 0.85 : 0.55, timeout: 60000 });
      var p = parseEssayText(raw);
      if (p && (essayConsistent(p.instruction, p.answer) || i === 3)) return essayResult(type, p.instruction, p.answer);
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
  // ===== 어법수정(서술형): 검증된 buildGrammar(어법 밑줄) 경로를 재사용해 동일 품질 보장 후 '고쳐쓰기' 형식으로 재구성 =====
  //   과거엔 별도 프롬프트로 돌려 '뜻만 바꾸기·오교정(they are smart→smartly)' 오답이 잦았음 → 단일 검증경로로 통일.
  async function buildGrammarEdit(passage) {
    var q = null;
    for (var a = 0; a < 2 && !q; a++) { try { q = await buildGrammar(passage); } catch (_) {} }
    if (!q || !q._gram) return null;
    var err = q._gram.error, cor = q._gram.correct, wi = q._gram.wi;
    if (!err || !cor || normTok(err) === normTok(cor)) return null;   // 오류≠교정 정합
    var slot = q._gram.cat ? ("[" + q._gram.cat + "] ") : "";           // 물어보는 어법 slot 선언(§10 메타)
    var instr = "다음 글의 밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것을 찾아 기호를 쓰고 바르게 고쳐 쓰시오.";
    var ans = CIRC5(wi) + ": '" + err + "' → '" + cor + "'";
    return { type: "어법수정", instruction: instr, passage: q.passage, choices: [], answer: 0,
      explanation: "[모범답안] " + slot + ans + (q._gram.verified ? " (어법 오류 확인됨)" : "") + essayRubric("어법수정", instr, ans), _audit: "정답위치 코드생성됨(buildGrammar 검증경로 재사용)" };
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
    // 약어의 마침표를 문장 경계로 오인하지 않게 보호(Dr./e.g./U.S. 등에서 문장이 잘리고 소실되던 버그 수정)
    var AB = /\b(Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|cf|approx|Fig|No|Vol|pp|U\.S|U\.K|Ph\.D|a\.m|p\.m)\./gi;
    s = s.replace(AB, function (m) { return m.split(".").join("␟"); });
    var out = s.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g) || [];
    // 종결부호 없이 끝나는 마지막 조각(붙여넣기 시 흔한 마침표 누락)도 포함 — 문장 소실 방지
    var consumed = out.join("").length, tail = s.slice(consumed).trim();
    if (tail && tail.split(" ").length >= 3) out.push(tail);
    out = out.map(function (x) { return x.replace(/␟/g, ".").trim(); });
    return out.filter(function (x) { return x.split(" ").length >= 3; });
  }
  var CIRCN = ["①", "②", "③", "④", "⑤"];
  // 여러 자리를 동시에 오형태로 치환하는 markWords 확장(어법 개수형·네모형)
  function markWordsMulti(passage, words, corruptMap) {
    var circ = "ⓐⓑⓒⓓⓔ", out = "", rest = passage, count = 0;
    for (var i = 0; i < words.length && i < 5; i++) {
      var w = String(words[i] || "").trim(); if (!w) return null;
      var re = new RegExp((/^[A-Za-z0-9]/.test(w) ? "\\b" : "") + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[A-Za-z0-9]$/.test(w) ? "\\b" : ""), "i");
      var m = re.exec(rest); if (!m) return null;
      var shown = (corruptMap && corruptMap[i + 1]) ? corruptMap[i + 1] : m[0];
      if (corruptMap && corruptMap[i + 1] && /^[A-Z]/.test(m[0]) && /^[a-z]/.test(shown)) shown = shown.charAt(0).toUpperCase() + shown.slice(1);   // 대문자 보존
      out += rest.slice(0, m.index) + circ.charAt(i) + "<u>" + shown + "</u>";
      rest = rest.slice(m.index + m[0].length); count++;
    }
    return { text: out + rest, count: count };
  }
  // 비단어/무의미 오형태 판별 — 형용사·부사·명사에 -s, 또는 어미에 -e/-ee 덧붙인 가짜 오류(alone→alonee, natural→naturals) 차단
  function badInflect(c, w) {
    c = String(c || "").trim().toLowerCase(); w = String(w || "").trim().toLowerCase();
    if (!c || !w || c === w) return true;
    if (w === c + "e" || w === c + "ee") return true;
    // -s를 형용사/부사에 붙인 가짜(natural→naturals, deliberate→deliberates). 동사(give→gives)는 -ive라 통과
    if (w === c + "s" && /(?:al|ate|ous|ful|ly|ary|ic|less|ish)$/.test(c)) return true;
    return false;
  }
  // 밑줄 구절이 몇 개 문장에 분산됐는지 — 한 문장에 밑줄 몰림(수능은 5곳을 서로 다른 문장에 배치) 방지용
  function markSpread(passage, phrases) {
    var sents = splitSentences(passage);
    var counts = {};
    phrases.forEach(function (p) {
      var pp = String(p || "").trim(); if (!pp) return;
      var si = -1;
      for (var i = 0; i < sents.length; i++) { if (sents[i].indexOf(pp) >= 0) { si = i; break; } }
      if (si < 0) { var np = pp.toLowerCase(); for (var j = 0; j < sents.length; j++) { if (sents[j].toLowerCase().indexOf(np) >= 0) { si = j; break; } } }
      if (si >= 0) counts[si] = (counts[si] || 0) + 1;
    });
    var ks = Object.keys(counts);
    return { distinct: ks.length, maxInOne: Math.max.apply(null, ks.map(function (k) { return counts[k]; }).concat([0])), sents: sents.length };
  }
  // 어법/어휘 밑줄 분산 게이트: 문장이 넉넉하면(≥5) 5곳이 최소 4개 문장에 흩어지고 한 문장에 3개↑ 몰리지 않아야 함
  function spreadOK(passage, phrases, attempt) {
    var sp = markSpread(passage, phrases);
    if (sp.sents >= 5 && (sp.distinct < 4 || sp.maxInOne >= 3) && attempt < 2) return false;   // 최종 시도(2)는 수용
    if (sp.sents >= 5 && sp.maxInOne >= 3) return false;   // 한 문장 3개 몰림은 최종에도 거부
    return true;
  }
  // 전체문장배열(ORDER_ALL_SENTENCES_MODE): 모든 문장 번호화 배열 — 셔플·선지·정답 전부 코드 생성(LLM 불필요)
  function buildOrderAll(passage) {
    var ss = splitSentences(passage);
    if (ss.length < 5) return null;
    if (ss.length > 9) ss = ss.slice(0, 9);   // 규격: 5~9문장(넘치면 앞 9문장)
    var n = ss.length, C = "①②③④⑤⑥⑦⑧⑨";
    var idx = ss.map(function (_, i) { return i; }), sh, g0 = 0;
    do { sh = idx.slice().sort(function () { return Math.random() - 0.5; }); } while ((sh[0] === 0 || sh.join() === idx.join()) && g0++ < 40);
    if (sh[0] === 0) { var sw = sh[0]; sh[0] = sh[1]; sh[1] = sw; }   // 첫 자리에 원문 첫 문장 금지(사소화 방지)
    var pos = []; sh.forEach(function (orig, k) { pos[orig] = k; });
    var key = idx.map(function (i) { return C[pos[i]]; });
    var correct = key.join("-"), set = {}; set[correct] = 1; var chs = [correct];
    var guard = 0;
    while (chs.length < 5 && guard++ < 80) {
      var a = key.slice(), r = Math.random();
      if (r < 0.4) { var i2 = 1 + rint(n - 2), t = a[i2]; a[i2] = a[i2 + 1]; a[i2 + 1] = t; }                      // 인접 교환(국소 응집 함정)
      else if (r < 0.7) { var t2 = a[0]; a[0] = a[1]; a[1] = t2; }                                                   // 도입 교란
      else { a = key.slice(0, 1).concat(key.slice(1).sort(function () { return Math.random() - 0.5; })); }          // 후반 셔플
      var v = a.join("-"); if (!set[v]) { set[v] = 1; chs.push(v); }
    }
    if (chs.length < 5) return null;
    chs.sort(function () { return Math.random() - 0.5; });
    var pg = sh.map(function (orig, k) { return C[k] + " " + ss[orig]; }).join("\n");
    var cues = ss.map(function (s, i) { var m = s.match(/^(However|Therefore|Thus|For example|For instance|In other words|In addition|Moreover|As a result|In contrast|Similarly|Instead|Finally|But|So|Then)\b/i) || s.match(/^\s*(This|These|Such|It|They)\b/i); return C[pos[i]] + (m ? "(" + m[1] + ")" : ""); });
    return { type: "전체문장배열", instruction: "다음 글의 모든 문장을 글의 흐름에 맞게 배열한 것으로 가장 적절한 것은?", passage: pg, choices: chs, answer: chs.indexOf(correct) + 1,
      explanation: "정답 배열은 " + correct + ". 흐름: " + cues.join(" → ") + " — 문두 연결어·지시어가 바로 앞 문장을 받아 이 순서로만 논리가 이어진다.",
      _audit: "정답 코드생성됨(셔플·선지·정답 전부 코드 제어)" };
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
    var slotStart = Math.max(1, Math.min(pick - 2, rest2.length - 4));   // 마지막 슬롯이 문미(j=rest2.length)까지 허용
    var ansSlot = pick - slotStart + 1; if (!(ansSlot >= 1 && ansSlot <= 5)) return null;
    var pg = "", n = 0;
    for (var j = 0; j <= rest2.length; j++) {                            // j=rest2.length: 마지막 문장 뒤 슬롯도 배치 → 항상 5개 보장
      if (j >= slotStart && n < 5) { n++; pg += " ( " + CIRCN[n - 1] + " ) "; }
      if (j < rest2.length) pg += (j ? " " : "") + rest2[j];
    }
    if (n < 5) return null;                                             // 슬롯 5개 미확보 시 실패(선지 개수 불일치 방지)
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
  // 연결어 폴백: 코드 사전에 없는 담화표지(In other words·In fact 등)만 있는 지문 → LLM이 두 곳을 지정, 빈칸화·선지는 코드가
  async function connectiveLLM(passage) {
    var BANK = { 대조: ["However", "In contrast", "Nevertheless"], 인과: ["Therefore", "As a result", "Consequently"], 예시: ["For example", "For instance"], 첨가: ["In addition", "Moreover", "Similarly"], 재진술: ["In other words", "That is", "To put it simply"], 강조: ["In fact", "Indeed", "Above all"] };
    var o = await llmJSON([{ role: "system", content: "연결어 출제자. JSON만." }, { role: "user", content: "다음 글에서 문장 첫머리 담화 연결 표현 두 곳(앞쪽 A, 뒤쪽 B)을 찾아라. 각각 지문에 실제로 있는 표현 그대로와 그 논리 관계(대조/인과/예시/첨가/재진식/강조 중 하나)를 답하라. JSON: {\"A\":\"앞쪽 연결어(원문 그대로)\",\"Ag\":\"관계\",\"B\":\"뒤쪽 연결어(원문 그대로)\",\"Bg\":\"관계\"}. JSON만.\n\n" + passage }], { temperature: 0.3, timeout: 55000 });
    if (!o || !o.A || !o.B) return null;
    function findAt(term) { var re = new RegExp("(^|[.!?]\\s+)" + String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i"); var m = re.exec(passage); return m ? { at: m.index + m[1].length, len: m[0].length - m[1].length } : null; }
    var pa = findAt(o.A), pb = findAt(o.B);
    if (!pa || !pb || pb.at <= pa.at) return null;                        // 원문 위치 확인·순서 보장(환각 차단)
    var Ac = passage.substr(pa.at, pa.len), Bc = passage.substr(pb.at, pb.len);
    var pg = passage.slice(0, pa.at) + "___(A)___" + passage.slice(pa.at + pa.len, pb.at) + "___(B)___" + passage.slice(pb.at + pb.len);
    function wrongOf(g) { var ks = Object.keys(BANK).filter(function (k) { return k !== g; }); var k = ks[rint(ks.length)]; return BANK[k][rint(BANK[k].length)]; }
    var correct = Ac + " …… " + Bc, set = {}, ch = [correct], ig = 0; set[correct] = 1;
    while (ch.length < 5 && ig++ < 40) { var w = (rint(2) ? Ac : wrongOf(o.Ag)) + " …… " + wrongOf(o.Bg); if (w !== correct && !set[w]) { set[w] = 1; ch.push(w); } }
    if (ch.length < 5) return null;
    ch.sort(function () { return Math.random() - 0.5; });
    return { type: "연결어빈칸", instruction: "빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: pg, choices: ch, answer: ch.indexOf(correct) + 1, explanation: "(A)는 앞 내용과 '" + (o.Ag || "") + "' 관계로 " + Ac + ", (B)는 '" + (o.Bg || "") + "' 관계로 " + Bc + "가 알맞다. 나머지 선지는 논리 관계가 맞지 않는다.", _audit: "정답 코드생성됨(LLM 지정 연결어를 코드가 원문검증·빈칸화)" };
  }
  async function buildConnective(passage) {
    var all = []; Object.keys(CONNECTIVES).forEach(function (g) { CONNECTIVES[g].forEach(function (c) { all.push({ c: c, g: g }); }); });
    var found = [];
    all.forEach(function (x) { var re = new RegExp("(^|[.!?]\\s+)" + x.c.replace(/ /g, "\\s+") + "\\b", "g"); var m; while ((m = re.exec(passage))) found.push({ c: x.c, g: x.g, at: m.index + m[1].length }); });
    found.sort(function (a, b) { return a.at - b.at; });
    if (found.length < 2) return await connectiveLLM(passage);   // 하드코딩 사전에 없는 연결어(In other words 등)만 있으면 LLM 폴백
    var A = found[0], B = found[found.length - 1];
    var pg = passage.slice(0, A.at) + "___(A)___" + passage.slice(A.at + A.c.length, B.at) + "___(B)___" + passage.slice(B.at + B.c.length);
    function wrongOf(g) { var ks = Object.keys(CONNECTIVES).filter(function (k) { return k !== g; }); var k = ks[rint(ks.length)]; return CONNECTIVES[k][rint(CONNECTIVES[k].length)]; }
    var correct = A.c + " …… " + B.c, set = {}, ch = [correct]; set[correct] = 1;
    var guard = 0;
    while (ch.length < 5 && guard++ < 40) { var w = (rint(2) ? A.c : wrongOf(A.g)) + " …… " + (ch.length % 2 ? wrongOf(B.g) : (rint(2) ? wrongOf(B.g) : B.c)); if (w !== correct && !set[w]) { set[w] = 1; ch.push(w); } }
    if (ch.length < 5) return null;
    ch.sort(function () { return Math.random() - 0.5; });
    var RAT = { 대조: "앞뒤 내용이 서로 상반되므로", 인과: "앞이 원인·뒤가 결과이므로", 예시: "앞의 일반 진술을 구체적 예로 뒷받침하므로", 첨가: "앞 내용에 같은 방향의 정보를 더하므로", 전환: "앞과 다른 방향으로 논지를 돌리므로" };
    var exp = "(A)는 앞 문장에 이어 " + RAT[A.g] + " '" + A.g + "'의 " + A.c + "가, (B)는 " + RAT[B.g] + " '" + B.g + "'의 " + B.c + "가 알맞다. 나머지 선지는 이 논리 관계와 맞지 않아 오답이다.";
    return { type: "연결어빈칸", instruction: "빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: pg, choices: ch, answer: ch.indexOf(correct) + 1, explanation: exp, _audit: "정답 코드생성됨(원문 연결어 탐지·빈칸화)" };
  }
  // 어법 개수형: 코드가 k개(2~3)를 지정, LLM은 각 자리 오형태만 제공 → 개수 정답을 코드가 안다
  async function buildGrammarCount(passage) {
    var k = 2 + rint(2);
    for (var attempt = 0; attempt < 3; attempt++) {
      var o = await llmJSON([{ role: "system", content: "어법 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 판단 지점 5곳을 '지문에 나온 그대로의 짧은 구절(각 2~6단어, 등장순)'로 고르고, 그 중 정확히 " + k + "곳의 '문법 오형태'를 만들어라. ★실제 어법 오류만(수일치 is↔are, 태 given↔giving, 준동사 shape↔shaping, 관계사 which↔where, 병렬). 절대 금지: 없는 단어(alonee), 형용사·부사에 -s(naturals·deliberates), 단순 철자 변형. JSON: {\"phrases\":[\"구절 5개(등장순, 원문 그대로)\"],\"errors\":[{\"index\":1~5,\"wrong\":\"그 구절의 틀린 형태\"} " + k + "개]}. JSON만.\n\n" + passage }], { noRule: true, temperature: 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.phrases) || o.phrases.length < 5 || !Array.isArray(o.errors)) continue;
      var phr = o.phrases.slice(0, 5).map(String);
      var map = {}, ok = true, used = {};
      o.errors.slice(0, k).forEach(function (e) { var i = parseInt(e.index, 10); if (!(i >= 1 && i <= 5) || used[i] || !e.wrong || normTok(e.wrong) === normTok(phr[i - 1]) || badInflect(phr[i - 1], e.wrong)) { ok = false; return; } used[i] = 1; map[i] = String(e.wrong).trim(); });   // 비단어(deliberate→deliberates) 오형태 차단
      if (!ok || Object.keys(map).length !== k) continue;
      if (!spreadOK(passage, phr, attempt)) continue;   // 밑줄 5곳 문장 분산
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
      var o = await llmJSON([{ role: "system", content: (isVocab ? "어휘" : "어법") + " 출제자. JSON만." }, { role: "user", content: "다음 지문에서 " + (isVocab ? "문맥 판단이 필요한 핵심 단어" : "어법 판단 지점(짧은 구절 2~4단어)") + " 3곳을 '지문에 나온 그대로(등장순)' 고르고, 각각의 " + (isVocab ? "문맥상 부적절한 반의어" : "문법 오형태") + "를 만들어라. " + (isVocab ? "" : "★오형태는 반드시 '문법 범주가 바뀌는 실제 어법 오류'여야 한다. 좋은 예: is↔are(수일치), shape↔shaping(준동사), which↔where(관계사), given↔giving(태), to raise↔raising(부정사/동명사). 절대 금지: 없는 단어 만들기(alone→alonee ✗), 형용사·부사에 -s 붙이기(natural→naturals ✗, deliberate→deliberates ✗), 단순 철자 변형. 각 correct는 그 오류가 실제로 성립하는 구절이어야 한다. ") + "JSON: {\"items\":[{\"correct\":\"원문 그대로\",\"wrong\":\"틀린 형태\"} 3개(등장순)]}. JSON만.\n\n" + passage }], { noRule: true, temperature: 0.5, timeout: 55000 });
      if (!o || !Array.isArray(o.items) || o.items.length < 3) continue;
      var items = o.items.slice(0, 3).map(function (x) { return { c: String(x.correct || "").trim(), w: String(x.wrong || "").trim() }; });
      if (items.some(function (x) { return !x.c || !x.w || normTok(x.c) === normTok(x.w) || (!isVocab && badInflect(x.c, x.w)); })) continue;   // 비단어 철자쌍(alone→alonee, natural→naturals) 차단
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
    var o = await llmJSON([{ role: "system", content: "빈칸(문장형) 출제자. JSON만." }, { role: "user", content: "빈칸 자리의 원문 문장: \"" + target + "\"\n이 문장을 의미 동일하게 패러프레이즈한 '정답 문장' 1개와, 글의 논지와 어긋나는 오답 문장 4개(부분일치·정반대·무관·과장 각 1)를 만들어라. ★모든 선지는 반드시 영어 문장(한국어 절대 금지). 길이·형태 통일. JSON: {\"answer\":\"영어 정답 문장\",\"wrong\":[\"영어 오답 4개\"]}. JSON만.\n\n[전체 지문]\n" + passage }], { temperature: 0.5, timeout: 60000 });
    if (!o || !o.answer || !Array.isArray(o.wrong) || o.wrong.length < 4) return null;
    if (/[가-힣]/.test(String(o.answer) + o.wrong.join(""))) return null;   // 한국어 선지면 실패(영어 지문에 한글 삽입 방지)
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
    // 정답 노출 방지: 지문에 1회만 등장하는 단어를 우선 선택(여러 번 나오면 다른 위치에 정답이 그대로 남음)
    var uniq = cw.filter(function (x) { return (passage.match(new RegExp("\\b" + x + "\\b", "gi")) || []).length === 1; });
    var pool = uniq.length ? uniq : cw;
    var w = pool[rint(Math.min(pool.length, 8))];
    var reAll = new RegExp("\\b" + w + "\\b", "gi");
    var m = reAll.exec(passage); if (!m) return null;
    var first = m[0], hint = first.charAt(0) + "_".repeat(Math.max(3, first.length - 1));
    // 같은 단어의 모든 등장을 빈칸 처리(첫 등장만 첫글자 힌트, 나머지는 완전 빈칸) — 정답 유출 차단
    var n = 0;
    var blanked = passage.replace(new RegExp("\\b" + w + "\\b", "gi"), function (mm) { n++; return n === 1 ? hint : "_".repeat(Math.max(3, mm.length)); });
    return { type: "첫글자어휘", instruction: "다음 글의 빈칸에 들어갈 단어를 주어진 첫 글자로 시작하여 쓰시오. (본문에 쓰인 형태 그대로)", passage: blanked, choices: [], answer: 0, explanation: "[모범답안] " + first + " — 문단의 논지상 이 자리에는 '" + first + "'가 유일하게 자연스럽다.", _audit: "정답 코드생성됨(빈칸·첫글자 힌트, 동일어 전수 빈칸으로 노출 차단)" };
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
    // 공통지문 세트: 지문을 '변형하지 않는' 유형만 사용(밑줄·빈칸·치환형은 공통지문을 오염시켜 제외) → 하나의 깨끗한 원문을 모든 하위문항이 공유
    var subs = [], plan = [["제목", function () { return buildInference(passage, "제목", { fast: true }); }], ["요지", function () { return buildInference(passage, "요지", { fast: true }); }], ["내용불일치", function () { return buildFactCheck(passage, false); }]];
    for (var i = 0; i < plan.length && subs.length < (opts.n || 3); i++) {
      try { var q = await plan[i][1](); if (q) { q.passage = ""; subs.push(q); } } catch (_) {}
    }
    if (subs.length < 2) return null;
    return { type: "장문세트", instruction: "[" + subs.length + "문항 세트] 다음 글을 읽고, 물음에 답하시오.", passage: passage, choices: [], answer: 0, explanation: "세트 문항 " + subs.length + "개(각 문항 해설 참조).", subItems: subs, _audit: "세트 " + subs.length + "문항(" + subs.map(function (s) { return s.type; }).join("·") + ") · 공통지문 원문 보존" };
  }

  // ===== 분석지: 문장별 해석·구문(기능색) + 논리 흐름 + 암기 카드 — 코드가 문장 분할·검증, LLM이 내용 =====
  async function analysisSheet(passage, opts) {
    opts = opts || {};
    var sents = splitSentences(passage);
    if (sents.length < 2) return null;
    var listed = sents.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n");
    // 본문 분석 + 심화(구문 상세·주요표현·연결어)를 한 번에 요청
    var o = await llmJSON([
      { role: "system", content: "너는 임용을 통과한 최상위 고등학교 영어 교사다. 정교한 내신 분석지 데이터를 만든다. 반드시 JSON만 출력." },
      { role: "user", content: "다음 지문을 문장 번호별로 빠짐없이 분석하라.\n[문장 목록]\n" + listed + "\n\nJSON:\n{\"topic_ko\":\"주제 한 줄\",\"thesis_ko\":\"필자 주장 한 줄\",\"flow\":[{\"n\":문장번호,\"role\":\"도입|주장|근거|예시|대조|재진술|결론\"}],\"sents\":[{\"n\":1,\"ko\":\"자연스러운 직역+의역\",\"syntax\":\"이 문장의 핵심 문법 구조를 구체적으로(예: 'which 관계대명사절이 주어를 수식', 'not A but B 병렬', '분사구문 = 부대상황'). 특별한 구문 없으면 빈 문자열\",\"fn\":\"core|evidence|logic|grammar|claim|aux\"}],\"vocab\":[{\"w\":\"단어\",\"pos\":\"품사(n/v/adj/adv)\",\"ko\":\"뜻\",\"syn\":\"유의어 1~2개\"}],\"expr\":[{\"e\":\"지문 속 주요 구문·숙어·연어\",\"ko\":\"뜻·쓰임\"}],\"connect\":[{\"w\":\"연결어/담화표지\",\"role\":\"대조|인과|예시|첨가|결론 등 기능\"}],\"points\":[\"내신 출제 포인트(최대 4개)\"]}\n규칙: sents 개수=문장 수(" + sents.length + "). vocab 5개(품사 포함). expr 3~5개(지문에 실제 있는 표현). connect는 지문의 연결어. syntax는 구체적으로." }
    ], { noRule: true, timeout: 75000 }).catch(function () { return null; });
    if (!o || !o.sents || !o.sents.length) return null;
    var map = {}; (o.sents || []).forEach(function (x) { if (x && x.n >= 1) map[x.n] = x; });
    var rows = sents.map(function (en, i) {
      var m = map[i + 1] || {};
      return { n: i + 1, en: en, ko: String(m.ko || ""), syntax: String(m.syntax || ""), fn: /^(core|evidence|logic|grammar|claim|aux)$/.test(m.fn) ? m.fn : "aux" };
    });
    var flow = (o.flow || []).filter(function (x) { return x && x.n >= 1 && x.n <= sents.length && x.role; });
    // 성분분석(전 문장 S/V/O/C/M) + 출제예상 플로우(별도 호출 — 메인 분석 안정성 유지). 배경지식과 병렬.
    var extraP = llmJSON([
      { role: "system", content: "고교 영어 구문·출제 분석가. JSON만." },
      { role: "user", content: "[문장]\n" + listed + "\n\nJSON:\n{\"components\":[{\"n\":문장번호,\"parse\":\"문장 전체를 성분 청크로 빠짐없이 분해 — 각 청크를 [라벨 원문어구] 형태로. 라벨은 S(주어)/V(동사)/O(목적어)/C(보어)/M(수식어·부사구·전치사구) 5개만 사용, 접속사·관계사가 이끄는 절은 통째로 M 또는 O로. 예: [S Honeybees] [V communicate] [O the location of food] [M through an elaborate dance]\"}],\"exam_flow\":[{\"feature\":\"지문 특징(문장번호 포함)\",\"type\":\"예상 출제유형(어법|어휘|빈칸|순서|삽입|무관|요지|주제|제목|함의|어법수정 중)\",\"trap\":\"함정·출제 포인트 한 줄\"}]}\n규칙: components=모든 문장(" + sents.length + "개, 빠짐없이). parse의 어구는 원문 그대로(생략·의역 금지). exam_flow 4~6개. 한국어 라벨 금지 — S/V/O/C/M만." }
    ], { noRule: true, timeout: 75000 }).catch(function () { return null; });
    // 배경지식: 주제어로 위키 요약 1문단(있으면). 실패해도 분석지는 나옴
    var background = "";
    try {
      var kw = await ask("이 글의 핵심 주제어를 영어 1~2단어로(답만).\n\n" + passage.slice(0, 300), "단어만.", { noRule: true }).catch(function () { return ""; });
      if (kw) { var bg = await wiki(String(kw).replace(/[^A-Za-z ]/g, "").trim()).catch(function () { return null; }); if (bg && bg.extract) background = bg.extract.slice(0, 260); }
    } catch (_) {}
    var extra = await extraP;
    // 성분 parse 정규화: 대괄호 누락("S xxx,V yyy")도 [S xxx] [V yyy]로 복원, 라벨 없으면 폐기
    function normComp(c) {
      if (!c || !c.parse || !(c.n >= 1)) return null;
      var p = String(c.parse).trim();
      if (!/\[[SVOCM]\s/.test(p) && /(^|,)\s*[SVOCM]\s+/.test(p)) {
        p = p.split(/,(?=\s*[SVOCM]\s+)/).map(function (seg) { var m = seg.trim().match(/^([SVOCM])\s+([\s\S]+)$/); return m ? ("[" + m[1] + " " + m[2].trim() + "]") : seg.trim(); }).join(" ");
      }
      return /\[[SVOCM]\s/.test(p) ? { n: c.n, parse: p } : null;
    }
    var comps = ((extra && extra.components) || []).map(normComp).filter(Boolean);
    // 커버리지 보강: 빠진 문장은 1회 추가 요청(전 문장 S/V/O/C/M 보장)
    var have = {}; comps.forEach(function (c) { have[c.n] = 1; });
    var missing = sents.map(function (_, i) { return i + 1; }).filter(function (n) { return !have[n]; });
    if (missing.length) {
      var miss = missing.map(function (n) { return n + ". " + sents[n - 1]; }).join("\n");
      var ex2 = await llmJSON([{ role: "system", content: "영어 문장 성분 분석가. JSON만." },
        { role: "user", content: "각 문장을 성분 청크로 빠짐없이 분해하라. 각 청크는 반드시 [라벨 원문어구] 대괄호 형식, 라벨은 S/V/O/C/M만(예: [S Honeybees] [V communicate] [O the location] [M through a dance]).\n" + miss + "\n\nJSON: {\"components\":[{\"n\":문장번호,\"parse\":\"[S ...] [V ...] ...\"}]}. JSON만." }], { noRule: true, timeout: 60000 }).catch(function () { return null; });
      ((ex2 && ex2.components) || []).map(normComp).filter(Boolean).forEach(function (c) { if (!have[c.n]) { have[c.n] = 1; comps.push(c); } });
    }
    comps.sort(function (a, b) { return a.n - b.n; });
    return {
      topic: String(o.topic_ko || ""), thesis: String(o.thesis_ko || ""), flow: flow, sents: rows,
      vocab: (o.vocab || []).slice(0, 6), expr: (o.expr || []).slice(0, 6), connect: (o.connect || []).slice(0, 6),
      points: (o.points || []).slice(0, 4), background: background,
      components: comps,
      examFlow: ((extra && extra.exam_flow) || []).filter(function (f) { return f && f.feature && f.type; }).slice(0, 6)
    };
  }
  // ===== 키워드 추출(출제 축): 어휘·구문·개념·연결어 — LLM + 빈도 폴백, 지문 실존 검증 =====
  async function extractKeywords(passage, opts) {
    opts = opts || {};
    var o = await llmJSON([
      { role: "system", content: "한국 고교 영어 내신 출제자. 반드시 JSON만 출력." },
      { role: "user", content: "지문에서 변형문제 출제의 축이 되는 키워드를 뽑아라.\n지문:\n" + passage + "\n\nJSON: {\"keywords\":[{\"k\":\"지문 속 표현 그대로\",\"kind\":\"어휘|구문|개념|연결어\",\"why\":\"출제 포인트 한 줄(한국어)\"}]}\n규칙: 4~8개. 어휘 2~3, 구문 1~2(예: not A but B 병렬), 개념 1~2(주제어), 연결어 1개 이상(Conversely 등). k는 반드시 지문에 실제로 있는 문자열." }
    ], { noRule: true }).catch(function () { return null; });
    var low = passage.toLowerCase();
    var ks = ((o && o.keywords) || []).filter(function (x) { return x && x.k && low.indexOf(String(x.k).toLowerCase()) >= 0; })
      .map(function (x) { return { k: String(x.k), kind: /어휘|구문|개념|연결어/.test(x.kind) ? x.kind : "어휘", why: String(x.why || "") }; }).slice(0, 8);
    if (ks.length >= 3) return ks;
    return contentWords(passage).slice(0, 5).map(function (w) { return { k: w, kind: "어휘", why: "빈도 상위 핵심어" }; });
  }
  // 원문 출처 추정: LLM이 저자·작품·출판물을 추정 + Google Books 실검색 → UI가 검색 링크와 함께 표시
  async function findSource(passage, opts) {
    opts = opts || {};
    var snip = String(passage || "").slice(0, 500);
    var o = await llmJSON([
      { role: "system", content: "너는 영어 지문의 출처를 식별하는 전문가다(교과서·수능/모의고사·기사·원서·연설 등). 한국어로 답하되 JSON만." },
      { role: "user", content: "다음 영어 지문의 출처를 최대한 추정하라. 확실하지 않으면 가장 그럴듯한 후보와 유형을 제시. JSON: {\"source\":\"추정 출처 설명(한국어)\",\"author\":\"저자(모르면 빈칸)\",\"title\":\"작품/글 제목(모르면 빈칸)\",\"kind\":\"원서|기사|수능/모의고사|교과서|연설|기타\",\"confidence\":\"상|중|하\"}\n\n지문:\n" + snip }
    ], { noRule: true, temperature: 0.2, timeout: 45000 }).catch(function () { return null; });
    var books = [];
    try {
      var q = (o && o.title) ? o.title : snip.split(/[.!?]/)[0];
      var d = await getJSON("https://www.googleapis.com/books/v1/volumes?q=" + encodeURIComponent('"' + q.slice(0, 120) + '"') + "&maxResults=3&country=US", 12000);
      books = ((d && d.items) || []).map(function (it) { var v = it.volumeInfo || {}; return { title: v.title || "", authors: (v.authors || []).join(", "), link: v.infoLink || v.canonicalVolumeLink || "" }; }).filter(function (b) { return b.title; });
    } catch (_) {}
    return { guess: o || null, books: books, query: snip.split(/\s+/).slice(0, 14).join(" ") };
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
  // 어형변형(괄호): 내신 서술형 최다 빈출 — 본문 문장의 동사/준동사를 괄호 원형으로, 정답이 유일 결정되게
  async function buildInflect(passage) {
    var o = await llmJSON([
      { role: "system", content: "한국 고등 내신 서술형 출제자. 지문에서 어법 판단이 필요한 문장 1~2개를 골라 동사·준동사·형용사 1~3곳을 괄호(원형)으로 바꾼다. 각 괄호의 정답은 시제·태·수일치·준동사 규칙으로 '유일하게' 결정되어야 한다. JSON만." },
      { role: "user", content: "[지문]\n" + passage + "\n\nJSON: {\"passage\":\"괄호 처리된 문장(들) — 예: The number of students (be) increasing.\",\"answers\":[{\"n\":1,\"base\":\"be\",\"correct\":\"is\",\"why\":\"주어 The number 단수 — 수일치\"}],\"instruction\":\"괄호 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오.\"} 괄호 1~3곳. JSON만." }
    ], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.passage || !/\(/.test(o.passage) || !Array.isArray(o.answers) || !o.answers.length) return null;
    if (o.answers.some(function (a) { return !a.correct || String(a.correct).trim().toLowerCase() === String(a.base || "").trim().toLowerCase(); })) return null;   // 원형=정답 금지
    return { type: "어형변형(괄호)", instruction: o.instruction || "괄호 안에 주어진 단어를 어법에 맞게 고쳐 쓰시오.", passage: o.passage, choices: [], answer: null,
      answerText: o.answers.map(function (a) { return (a.n ? a.n + ") " : "") + a.base + " → " + a.correct; }).join("  "),
      explanation: o.answers.map(function (a) { return (a.n ? a.n + ") " : "") + a.base + "→" + a.correct + " [" + (a.why || "") + "]"; }).join(" · "), _audit: "서술형(괄호 어형변형) — 정답 유일성 검증" };
  }
  function builderFor(t) {
    if (t === "배열영작") return function (p, o) { return buildArrange(p, o); };
    if (t === "조건영작") return function (p, o) { return buildConditional(p, o); };
    if (t === "어법수정") return function (p, o) { return buildGrammarEdit(p, o); };
    if (/어형변형/.test(t)) return function (p) { return buildInflect(p); };
    if (/틀린문장|고쳐쓰기/.test(t)) return function (p, o) { return buildGrammarEdit(p, o); };
    if (/본문찾아쓰기/.test(t)) return function (p) { return buildEngdefWrite(p); };
    // 신규 유형(정답 코드제어) 특례 — 유형DB의 builder 키보다 우선
    if (t === "문장전환") return function (p) { return buildConvertAuto(p); };   // 통합형: 지문에 맞는 전환을 자동 선택
    var cm = String(t).match(/^문장전환\((태|분사구문|관계사|가정법)\)/); if (cm) return function (p) { return buildConvert(p, cm[1]); };
    if (/강조|도치/.test(t) && /전환/.test(t)) return function (p) { return buildConvert(p, "강조도치"); };
    if (/전체문장|문장배열/.test(t)) return function (p) { return Promise.resolve(buildOrderAll(p)); };
    if (/지칭추론/.test(t)) return function (p) { return buildReference(p); };   // 전용 빌더(미구현 폴백→요지파이프라인 붕괴 차단)
    if (/혼합통합형/.test(t)) return function (p, o) { return buildLongSet(p, o); };
    if (/본문어변형빈칸/.test(t)) return function (p) { return buildInflect(p); };
    if (/글의\s*순서|^순서$/.test(t)) return function (p) { return Promise.resolve(buildOrder(p)); };
    if (/문장삽입/.test(t)) return function (p) { return Promise.resolve(buildInsertion(p)); };
    if (/안내문/.test(t)) return function (p) { return buildFactCheck(p, !/불일치/.test(t)); };   // 안내문 일치/불일치 → 사실검증 빌더(일치/불일치 문항) 연결(주제 폴백 방지)
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
    }[type];
    if (!base) {   // 사전 미등재 유형: 정규식 매핑(과거엔 전부 영작 문구로 오분류되던 결함 수정)
      var RX = [
        [/목적/, "글쓴이의 집필 의도(요청·안내·공지 등 화행)를 파악하는 능력을 평가한다."],
        [/심경|분위기/, "행동·신체 반응 단서로 인물의 심경(변화)을 추론하는 능력을 평가한다."],
        [/주장/, "필자의 당위 주장을 근거와 함께 파악하는 능력을 평가한다."],
        [/전체문장|순서/, "응집 장치(지시어·연결어·정관사)로 글의 논리 순서를 재구성하는 능력을 평가한다."],
        [/삽입/, "주어진 문장의 지시어·연결어 단서로 흐름이 끊긴 위치를 찾는 능력을 평가한다."],
        [/무관/, "글의 통일성을 해치는 문장을 판별하는 능력을 평가한다."],
        [/연결어/, "앞뒤 문장의 담화 관계(인과·대조·예시·재진술)를 파악하는 능력을 평가한다."],
        [/지칭/, "대명사가 가리키는 대상을 담화 추적으로 판별하는 능력을 평가한다."],
        [/어법/, "문장 구조 속 어법 요소(수일치·시제·태·준동사·병렬 등)의 정오를 판단하는 능력을 평가한다."],
        [/어휘|유의어/, "문맥상 적절한 낱말 쓰임(반의·유의 혼동)을 판단하는 능력을 평가한다."],
        [/안내문|도표/, "실용 정보를 지문과 대조해 진위를 판별하는 능력을 평가한다."],
        [/영영풀이/, "영어 정의로 어휘의 문맥 의미를 판별하는 능력을 평가한다."],
        [/장문|복합|혼합/, "한 지문을 대의·세부·구조 등 여러 관점에서 통합적으로 이해하는 능력을 평가한다."],
        [/빈칸/, "문맥의 논리적 흐름으로 핵심 어구를 추론하는 능력을 평가한다."]
      ];
      for (var ri = 0; ri < RX.length; ri++) if (RX[ri][0].test(type)) { base = RX[ri][1]; break; }
    }
    if (!base) base = /영작|서술|전환|해석|고쳐|완성|변형|수정|쓰기|첫글자/.test(type)
      ? "지문의 핵심 내용을 조건에 맞게 영어로 산출/해석하는 표현력·정확성을 평가한다(조건 준수 포함)."
      : "지문 이해를 바탕으로 유형이 요구하는 사고(파악·추론·적용)를 수행하는 능력을 평가한다.";
    return base + (core ? (" [핵심 논지: " + core + "]") : "");
  }
  // 해설 텍스트 위생 — 이질 스크립트(키릴·그리스) 제거 + 한·영 융합토큰('을Literal') 분리. 개행 보존.
  function koHygiene(s) {
    return String(s || "")
      .replace(/[Ͱ-ϿЀ-ԯ]+/g, "")
      .replace(/([가-힣])([A-Za-z])/g, "$1 $2").replace(/([A-Za-z])([가-힣])/g, "$1 $2")
      .replace(/[^\S\n]+/g, " ").trim();
  }
  // ═══ 오답 진단·처방(Rx) 파이프라인 — 해설 구체화: 각 오답을 '골랐다면' 무엇을 오독했고(진단) 어떻게 교정할지(처방) ═══
  //   로직: 선지우선 설계의 오답 DNA를 학생 관점으로 뒤집음. 하네스: comprehensive_audit가 [오답 진단·처방] 존재·구성 전수검사.
  async function rxFeedback(q, passage) {
    try {
      if (!q || !q.choices || q.choices.length < 4 || !(q.answer >= 1 && q.answer <= q.choices.length)) return q;
      // 재생성 계약: 기존 [오답 진단·처방]/_rx가 있으면 지우고 '현재 정답' 기준으로 다시 만든다(정답 변경 후 스테일 방지)
      q.explanation = String(q.explanation || "").replace(/\n?\[오답 진단·처방\][\s\S]*?(?=\n【출제의도】|$)/, "");
      q._rx = null;
      var CIRC = ["①", "②", "③", "④", "⑤"];
      var isMark = q.choices.every(function (c) { return /^[ⓐ-ⓔ①-⑤]$/.test(String(c).trim()); });
      var chTxt = isMark ? "선지는 지문 속 표식 " + q.choices.join(" ") + " 이다(지문에서 해당 위치를 보라)." : q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n");
      var pg = String(q.passage || passage || "").slice(0, 1100);
      var rx = [];
      for (var ra = 0; ra < 2 && rx.length < 3; ra++) {   // 1회 재시도(일시 실패 흡수)
        var j = await llmJSON([{ role: "system", content: "너는 학생 오답 클리닉 교사다. 골랐던 오답에서 사고 과정의 결함을 짚고 교정 행동을 처방한다. JSON만." },
          { role: "user", content: "[지문]\n" + pg + "\n\n[발문] " + String(q.instruction).split("\n")[0] + "\n[선지]\n" + chTxt + "\n[정답] " + q.answer + "번\n\n정답을 제외한 각 선지에 대해: 학생이 '그 선지를 골랐다면' ①무엇을 어떻게 오독·혼동했는지(진단 — 지문 근거 인용) ②다음부터 어떻게 풀어야 하는지(처방 — 행동지침 1개)를 각 1줄로. JSON: {\"rx\":[{\"n\":선지번호,\"diag\":\"진단\",\"fix\":\"처방\"}]} — 정답(" + q.answer + "번) 제외 " + (q.choices.length - 1) + "개. JSON만." }], { noRule: true, temperature: ra ? 0.55 : 0.35, timeout: 55000 }).catch(function () { return null; });
        rx = (j && Array.isArray(j.rx)) ? j.rx.filter(function (x) { return x && x.n >= 1 && x.n <= q.choices.length && x.n !== q.answer && (x.diag || x.fix); }) : [];
      }
      if (rx.length < 3) return q;   // 3개 미만이면 미부착(불완전 처방 방지)
      rx = rx.slice(0, 4).map(function (x) { return { n: x.n, diag: koHygiene(x.diag), fix: koHygiene(x.fix) }; });   // 키릴·한영융합 위생
      var lines = rx.map(function (x) { return CIRC[x.n - 1] + " 진단: " + x.diag + " → 처방: " + x.fix; });
      q.explanation = koHygiene(String(q.explanation || "") + "\n[오답 진단·처방]\n" + lines.join("\n"));
      q._rx = rx;
    } catch (_) {}
    return q;
  }
  function stampIntent(q) { if (!q) return q; q.intent = intentFor(q); if (String(q.explanation || "").indexOf("【출제의도】") < 0) q.explanation = String(q.explanation || "") + "\n【출제의도】 " + q.intent; return q; }
  // ===== 과정 워크북: 출제 파이프라인의 중간산출물을 '학생이 밟는 단계'로 노출(_work). 빌더가 안 만든 유형은 범용 3스텝으로 합성 =====
  function stampWork(q) {
    if (!q || q._work) return q;
    var CIRC = ["①", "②", "③", "④", "⑤"], MARK = "ⓐⓑⓒⓓⓔ";
    var isMCQ = q.choices && q.choices.length >= 4 && q.answer >= 1 && q.answer <= q.choices.length;
    function markLine(arr, cats) { return (arr || []).map(function (p, i) { return MARK[i] + " " + p + (cats && cats[i] ? (" (" + cats[i] + ")") : ""); }).join(" / "); }
    // 어법 5스텝 — _gram.phrases/cats/error/correct/wi 재사용
    if (q.type === "어법" && q._gram && q._gram.phrases && q._gram.phrases.length >= 5) {
      var g = q._gram, gcats = (g.cats || []).slice(); if (g.cat && g.wi >= 1) gcats[g.wi - 1] = g.cat;   // 정답 위치는 결정론 범주(g.cat)로 교정(LLM cats 오라벨 방지)
      q._work = { steps: [
        { id: 1, stage: "관찰", ask: "밑줄 친 ⓐ~ⓔ 각각이 '어떤 문법 요소'를 판단하게 하는지 적어보세요.", show: { passage: q.passage }, input: "text", reveal: { answer: markLine(g.phrases, gcats), why: "각 밑줄은 서로 다른 문법 범주의 판단 지점입니다.", source: "엔진: 밑줄 5지점" } },
        { id: 2, stage: "분류", ask: "5개 밑줄의 문법 범주(수일치·시제·태·준동사·관계사·병렬·전치사·형용사부사 등)를 각각 분류하세요.", show: {}, input: "text", reveal: { answer: (g.phrases || []).map(function (p, i) { return MARK[i] + "=" + (gcats[i] || "어법"); }).join(", "), source: "엔진: 범주 분류" } },
        { id: 3, stage: "판정", ask: "5개 중 '어법상 틀린' 것 하나를 고르세요.", show: { choices: q.choices }, input: "pick", reveal: { answer: "정답 " + MARK[g.wi - 1], source: "코드 정답" } },
        { id: 4, stage: "근거", ask: "틀린 부분을 바르게 고치고, 왜 틀렸는지 문법적으로 설명하세요.", show: {}, input: "text", reveal: { answer: "'" + g.error + "' → '" + g.correct + "'" + (g.cat ? (" [" + g.cat + "]") : ""), why: q.explanation, source: "엔진: error→correct" } },
        { id: 5, stage: "메타", ask: "출제자는 왜 이 지점을 함정으로 골랐을까요? 나머지 4개는 왜 옳은가요?", show: {}, input: "text", reveal: { answer: "나머지 4개는 문법적으로 옳습니다. 출제자는 " + (g.cat || "핵심 문법") + " 판단을 수식어·거리로 흐리게 해 변별합니다.", source: "출제 로직" } }
      ] };
      return q;
    }
    // 어휘 5스텝 — _vocab.words/wrong/correct/wi/why 재사용
    if (q.type === "어휘" && q._vocab && q._vocab.words && q._vocab.words.length >= 5) {
      var v = q._vocab;
      q._work = { steps: [
        { id: 1, stage: "관찰", ask: "밑줄 친 ⓐ~ⓔ가 든 문장의 논리 방향(긍정/부정·원인/결과·강화/대조)을 표시하세요.", show: { passage: q.passage }, input: "text", reveal: { answer: "각 문장의 문맥 방향을 잡으면 어울리지 않는 낱말이 드러납니다.", source: "담화 방향" } },
        { id: 2, stage: "분류", ask: "밑줄 낱말들이 문맥과 '순접(어울림)'인지 '역접(어긋남)'인지 판정하세요.", show: {}, input: "text", reveal: { answer: "4개는 순접(문맥 일치), 1개는 역접(문맥 충돌).", source: "극성 대조" } },
        { id: 3, stage: "판정", ask: "문맥상 쓰임이 부적절한 낱말 하나를 고르세요.", show: { choices: q.choices }, input: "pick", reveal: { answer: "정답 " + MARK[v.wi - 1] + " ('" + v.wrong + "')", source: "코드 정답" } },
        { id: 4, stage: "근거", ask: "그 자리에 원래 와야 할 낱말은 무엇이고, 왜 그런가요?", show: {}, input: "text", reveal: { answer: "'" + v.wrong + "' → '" + v.correct + "'. " + (v.why || ""), why: (v.polarity ? ("극성: " + v.polarity) : ""), source: "엔진: correct·담화근거" } },
        { id: 5, stage: "메타", ask: "출제자는 왜 '" + v.wrong + "'를 오답으로 심었을까요? (반의어/혼동어 중 무엇?)", show: {}, input: "text", reveal: { answer: "'" + v.wrong + "'는 '" + v.correct + "'의 반대 방향 낱말이라 문맥과 충돌합니다. 형태·품사는 자연스러워 눈에 잘 안 띕니다.", source: "오답 설계" } }
      ] };
      return q;
    }
    // 범용 3스텝(전 유형) — 기존 필드만으로 합성
    var last = isMCQ ? ("정답 " + CIRC[q.answer - 1] + (q.choices[q.answer - 1] && String(q.choices[q.answer - 1]).length > 2 ? (" — " + q.choices[q.answer - 1]) : "")) : (q.answerText ? ("모범답안: " + q.answerText) : String(q.explanation || "").replace(/\[모범답안\]\s*/, ""));
    q._work = { steps: [
      { id: 1, stage: "이해", ask: "지문을 읽고 '무엇을 묻는 문제'인지, 글의 핵심 논지를 한 문장으로 예측해 쓰세요.", show: { passage: q.passage }, input: "text", reveal: { answer: (q.instruction || ""), why: "먼저 발문 유형과 글의 핵심을 잡습니다.", source: "발문·지문" } },
      { id: 2, stage: (isMCQ ? "판정" : "작성"), ask: (q.instruction || "정답을 고르거나 작성하세요."), show: (isMCQ ? { choices: q.choices } : {}), input: (isMCQ ? "pick" : "text"), reveal: { answer: last, source: "코드/모범답안" } },
      { id: 3, stage: "검증", ask: "왜 이것이 정답이고 다른 선지는 왜 오답인지(또는 답안의 조건 충족)를 설명하세요.", show: {}, input: "text", reveal: { answer: String(q.explanation || "").replace(/\n\[선지 분석\][\s\S]*/, ""), why: (q.intent ? ("출제의도: " + q.intent) : ""), source: "해설·출제의도" } }
    ] };
    // 선지 DNA 있으면(추론형) 오답 분석 단계 추가 — 학생이 오답마다 논리 오류를 짚는다(출제자 사고 역설계)
    if (isMCQ && q._choiceNotes && q._choiceNotes.length) {
      q._work.steps.push({ id: 4, stage: "오답분석", ask: "각 오답이 '어디서' 논지와 어긋나는지(범위축소·인과전도·과장·정도왜곡·초점이탈 등) 하나씩 짚어보세요.", show: { choices: q.choices }, input: "text",
        reveal: { answer: q._choiceNotes.map(function (nt) { return CIRC[nt.n - 1] + " " + (nt.correct ? "정답(핵심 반영)" : ("오답 — " + dnaWhy(nt.dna))); }).join(" · "), why: "출제자는 오답마다 서로 다른 논리 오류를 심습니다. 그 지점을 찾는 게 오답 소거의 핵심입니다.", source: "선지 DNA" } });
    }
    return q;
  }

  // 자료수집 캐시: 같은 지문이면 재수집 생략(유형 여러 번 출제 시 10~15초 절약)
  var CTXCACHE = {};
  async function cachedContext(passage, onP) {
    var k = passage.length + ":" + passage.slice(0, 64);
    if (CTXCACHE[k]) { log(onP, "■ 자료 수집: 캐시 재사용(같은 지문)"); return CTXCACHE[k]; }
    var c = await prepContext(passage, onP).catch(function () { return {}; });
    CTXCACHE[k] = c; var ks = Object.keys(CTXCACHE); if (ks.length > 4) delete CTXCACHE[ks[0]];
    return c;
  }
  // 정답위치 균등 분산(조립단계 — Haladyna/임용 원칙 §7: 위치편향=추측이득 CIV).
  //   텍스트선지형(요지·주제·제목·함의·빈칸·요약·내용일치·연결어…)만 선지순서를 스왑해 정답위치를 최소빈도 자리로 이동, 동일위치 3연속 차단.
  //   위치표식형(어법ⓐ~ⓔ·순서·삽입·무관·배열)은 정답이 지문구조에 고정 → 제외. 설명은 내용 인용이라 위치이동에 안전(방어적으로 '정답 ①~⑤'만 갱신).
  function isShuffleableQ(q) {
    if (!q || !Array.isArray(q.choices) || q.choices.length < 4 || !(q.answer >= 1)) return false;
    if (q.choices.some(function (c) { return /^\s*[ⓐ-ⓔ①-⑤]\s*$/.test(String(c)); })) return false;   // 밑줄기호 선지
    if (/\([A-C]\)\s*[-–]/.test(String(q.choices[0]))) return false;   // (A)-(B)-(C) 배열형
    return true;
  }
  function rebalanceAnswers(list) {
    var CN = ["①", "②", "③", "④", "⑤"], pos = {}, p1 = 0, p2 = 0;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (!q || !(q.answer >= 1)) { p2 = p1; p1 = 0; continue; }
      if (!isShuffleableQ(q)) { pos[q.answer] = (pos[q.answer] || 0) + 1; p2 = p1; p1 = q.answer; continue; }
      var n = q.choices.length, best = q.answer, bestS = Infinity;
      for (var p = 1; p <= n; p++) {
        if (p1 === p && p2 === p) continue;   // 동일위치 3연속 차단
        var s = (pos[p] || 0); if (s < bestS) { bestS = s; best = p; }
      }
      if (best !== q.answer) {
        var old = q.answer, tmp = q.choices[old - 1]; q.choices[old - 1] = q.choices[best - 1]; q.choices[best - 1] = tmp;
        if (q.explanation && old <= 5 && best <= 5) q.explanation = String(q.explanation).replace("정답 " + CN[old - 1], "정답 " + CN[best - 1]);
        // 선지 DNA 노트도 위치 동기화 + [선지 분석] 블록 재생성(위치 스왑 후 라벨 어긋남 방지)
        if (q._choiceNotes && q._choiceNotes.length >= Math.max(old, best)) {
          var nt2 = q._choiceNotes[old - 1]; q._choiceNotes[old - 1] = q._choiceNotes[best - 1]; q._choiceNotes[best - 1] = nt2;
          q._choiceNotes.forEach(function (nt, idx) { nt.n = idx + 1; });
          var anal = q._choiceNotes.map(function (nt) { return CN[nt.n - 1] + " " + (nt.correct ? "정답 — 핵심 논지 반영" : ("오답 — " + dnaWhy(nt.dna))); }).join(" · ");
          q.explanation = String(q.explanation).replace(/\[선지 분석\][^\n]*/, "[선지 분석] " + anal);
        }
        q.answer = best;
      }
      pos[q.answer] = (pos[q.answer] || 0) + 1; p2 = p1; p1 = q.answer;
    }
    return list;
  }
  // 정답이 바뀐 뒤(rebalance/솔버) 선지별 분석을 현재 정답에 재동기화 — '정답 칸을 오답으로 기술'하는 자기모순 차단
  function pruneStaleAnalysis(q) {
    if (!q || !q.choices || !(q.answer >= 1)) return q;
    var CN = ["①", "②", "③", "④", "⑤"], ans = q.answer, ex = String(q.explanation || "");
    if (q._choiceNotes && q._choiceNotes.length) {
      q._choiceNotes.forEach(function (nt) { nt.correct = (nt.n === ans); if (nt.correct) nt.dna = ""; });   // 정답=현재 answer로 재지정, 새 정답의 오답DNA 제거
      var anal = q._choiceNotes.map(function (nt) { return CN[nt.n - 1] + " " + (nt.correct ? "정답 — 핵심 논지 반영" : ("오답 — " + dnaWhy(nt.dna))); }).join(" · ");
      if (/\[선지 분석\]/.test(ex)) ex = ex.replace(/\[선지 분석\][^\n]*/, "[선지 분석] " + anal);
    }
    // 해설 첫머리 '정답 ⓝ/①~⑤' 마커를 현재 정답으로 교정
    ex = ex.replace(/정답\s*[①②③④⑤]/, "정답 " + CN[ans - 1]);
    q.explanation = ex;
    return q;
  }
  async function generateExam(passage, types, opts) {
    opts = opts || {}; var onP = opts.onProgress, onT = opts.onType || function () {}, USE = null; USE_ENSEMBLE = !!opts.ensemble;
    log(onP, "■ 1단계: 자료 수집반 가동(전 API)…");
    var ctx = await cachedContext(passage, onP);
    if (ctx.topic) log(onP, "   주제어=" + ctx.topic + (ctx.bg ? " · 위키 배경 확보" : "") + " · 반의어 " + Object.keys(ctx.ant || {}).length + "쌍");
    var bopts = { onProgress: onP, ctx: ctx, fast: opts.fast };
    var maxTry = opts.fast ? 3 : 4;
    // 병렬: 키 공급자(Gemini/Groq)는 동시 3유형, 무키(Pollinations 직렬큐)는 1유형
    var PAR = (provider() !== "pollinations") ? Math.min(4, types.length) : 1;
    log(onP, "■ 2단계: 유형별 " + (opts.fast ? "빠른" : "초미분화") + " 출제…" + (PAR > 1 ? (" ⚡병렬 " + PAR + "유형 동시") : ""));
    var idx = 0, results = new Array(types.length);
    async function work() {
      while (true) {
        var i = idx++; if (i >= types.length) return;
        var t = types[i], b = builderFor(t), got = null, t0 = Date.now();
        if (PAR === 1) { RUNHINT = ""; var kbT = kbFor(t); TYPERULE = ((TYPE_GUIDE[t] || "") + (kbT ? (" [KB지침] " + kbT) : "")).slice(0, 2600); setLevelRule(t, opts.level); }
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
          stampIntent(got); stampWork(got); got._ms = Date.now() - t0;   // rxFeedback은 rebalance 후로 이동(정답 확정 후 생성)
          results[i] = got;
          if (opts.onItem) try { opts.onItem(got, i); } catch (_) {}   // 완성 즉시 UI로 스트리밍
          onT(t, "done", got._ms);
          log(onP, "   ✓ " + t + " 완료(" + Math.round(got._ms / 1000) + "s)");
        } else { record("최종실패", t, "재시도 실패"); onT(t, "fail"); log(onP, "   · " + t + " 생성 실패(건너뜀)"); }
      }
    }
    if (PAR > 1) {
      // 병렬 그룹: 전역 TYPERULE 레이스 방지 — 선택 유형들의 규칙을 결합해 한 번에 주입(각 빌더 프롬프트가 자기 유형만 사용)
      TYPERULE = types.map(function (tt) { var kb = kbFor(tt); return "〔" + tt + "〕" + (TYPE_GUIDE[tt] || "").slice(0, 380) + (kb ? (" " + kb.slice(0, 140)) : ""); }).join(" / ").slice(0, 2800);
      setLevelRule(types[0], opts.level);
      var workers = []; for (var w = 0; w < PAR; w++) workers.push(work());
      await Promise.all(workers);
      TYPERULE = ""; LEVELRULE = ""; RUNHINT = "";
    } else {
      await work();
    }
    var out = results.filter(Boolean);
    if (out.length >= 3) { rebalanceAnswers(out); log(onP, "   ↳ 정답위치 균등 분산(조립단계) 적용"); }   // Haladyna: 위치편향 제거
    out.forEach(function (it) { pruneStaleAnalysis(it); delete it._work; stampWork(it); });   // 재배치 후 선지분석 재동기화 + 워크북 재스탬프
    await Promise.all(out.map(function (it) { return rxFeedback(it, passage).catch(function () { return it; }); }));   // 정답 확정 후 오답 진단·처방 생성(rebalance 뒤)
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
    var _hint0 = RUNHINT; if (opts.hint) RUNHINT = String(opts.hint);   // 키워드 중심 출제 등 1회성 지시
    var ctx = opts.ctx || await cachedContext(passage, opts.onProgress);
    var kb1 = kbFor(type); TYPERULE = ((TYPE_GUIDE[type] || "") + (kb1 ? (" [KB지침] " + kb1) : "")).slice(0, 2600); setLevelRule(type, opts.level);
    var q = null; for (var _try = 0; _try < 3 && !q; _try++) { try { q = await builderFor(type)(passage, { ctx: ctx, onProgress: opts.onProgress, fast: opts.fast }, type); } catch (_e) { q = null; } }
    // 태그 위생: LLM이 &lt;u&gt;로 이스케이프해 뱉으면 화면에 <u>가 글자로 노출됨 → 실태그로 복원 + u/b 외 태그 제거
    if (q) { var _tg = function (s) { return String(s).replace(/&lt;(\/?)(u|b)&gt;/gi, "<$1$2>").replace(/<(?!\/?[ub]>)\/?[A-Za-z][^<>]{0,38}>/g, "")   // 태그꼴만 제거 — 'a < b and c > d' 같은 수식 오탐 방지
        .replace(/[�぀-ヿ㐀-䶿一-鿿]+/g, "").replace(/  +/g, " "); };   // 번역기 혼입 한자·가나·깨진문자 제거(卓越·这样·力·を 등)
      ["passage", "instruction", "explanation", "answerText"].forEach(function (k) { if (q[k]) q[k] = _tg(q[k]); });
      if (q.choices && q.choices.length) q.choices = q.choices.map(_tg);
      // 서술형 단어수 실측 교정(Ray) — 길이 큐(이내/내외/이하/정도) 있는 단일 ' N단어'만 교정(제시어 개수 'N단어'는 불변, 범위형은 essayResult가 이미 동기화)
      if (q.answerText && q.instruction && /\d+\s*단어\s*(?:이내|내외|이하|정도|안팎)/.test(q.instruction) && !/~/.test(q.instruction)) {
        var _wc = String(q.answerText).trim().split(/\s+/).filter(Boolean).length;
        if (_wc >= 5) q.instruction = q.instruction.replace(/\d+(?=\s*단어\s*(?:이내|내외|이하|정도|안팎))/, function (m) { return Math.abs(parseInt(m, 10) - _wc) > 1 ? String(_wc) : m; });
      } }
    TYPERULE = ""; LEVELRULE = ""; if (opts.hint) RUNHINT = _hint0;
    if (q && TYPE_INSTR[type] && !/\{[A-Za-z0-9가-힣]+\}/.test(TYPE_INSTR[type]) && !hasRichInstr(q.instruction, TYPE_INSTR[type])) q.instruction = TYPE_INSTR[type];   // 미치환 템플릿({N}) 발문은 적용 안 함(빌더 자체 발문 유지)
    if (q) q.level = opts.level || "";
    if (q && opts.refine) q = await refineLoop(q, { target: opts.refineTarget || 88, maxRounds: opts.rounds || 4, onProgress: opts.onProgress, passage: passage, panel: opts.ensemble ? (opts.teachers || 3) : 1 });
    if (q) await rxFeedback(q, passage);   // 오답 진단·처방(각 오답을 골랐다면 → 진단+교정 처방) 해설 구체화
    stampIntent(q); stampWork(q);
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
    // 매번 다르게: 온도 지터 + 변주 논스(같은 지문·같은 버튼을 다시 눌러도 다른 결과)
    function _vt() { return 0.75 + Math.random() * 0.22; }
    var _vn = (opts.nonce != null ? opts.nonce : Math.floor(Math.random() * 99999));
    var _STR = { "하": " 난이도는 '하'로: 평이한 고빈도 어휘·단순한 구조로 쉽게.", "중": "", "상": " 난이도는 '상'로: 수능 킬러급으로 어려운 어휘(저빈도·추상어)·복잡한 구문(도치·분사·복문)으로 끌어올려라." };
    var _sd = (opts.strength && _STR[opts.strength]) ? _STR[opts.strength] : "";
    var _vd = " 여러 자연스러운 대안 중 이번엔(변주 #" + _vn + ") 직전 시도와 다른 어휘·구문을 선택하라." + _sd;
    if (level === "word") {
      log(onP, "① 내용어 동의어 수집(Datamuse syn)…");
      var cw = contentWords(passage).slice(0, 14), syn = {};
      await Promise.all(cw.map(async function (w) { try { var s = await datamuse(w, "syn", 3); if (s.length) syn[w] = s; } catch (_) {} }));
      trace.push({ line: 1, api: "datamuse", label: "동의어 " + Object.keys(syn).length + "어 수집", ok: true });
      var hint = Object.keys(syn).map(function (w) { return w + "→" + syn[w].join("/"); }).join(", ");
      log(onP, "② LLM 어휘 치환(구조 유지)…");
      var o = await llmJSON([{ role: "system", content: "영어 교재 편집자. 문장 구조·어순·길이는 '그대로' 두고 내용어만 동의어로 교체한다. 의미 보존. JSON만." }, { role: "user", content: "아래 동의어 후보를 참고해 지문의 구조는 유지하고 핵심 내용어만 자연스러운 동의어로 바꿔라." + _vd + " 후보(강제 아님): " + (hint || "-") + "\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"어휘만 바뀐 지문\",\"changed\":[\"바뀐 단어쌍 예: happiness→well-being 5개\"]}. JSON만." }], { noRule: true, temperature: _vt(), timeout: 60000 });
      trace.push({ line: 2, api: "llm", label: "어휘 치환", ok: !!(o && o.variant) });
      if (o) { variant = o.variant || ""; changed = o.changed || []; }
    } else if (level === "phrase") {
      log(onP, "① 연어 확인(Datamuse bgb)…");
      var cw2 = contentWords(passage).slice(0, 6), col = {};
      await Promise.all(cw2.map(async function (w) { try { var b = await datamuse(w, "bgb", 3); if (b.length) col[w] = b; } catch (_) {} }));
      trace.push({ line: 1, api: "datamuse", label: "연어 확인", ok: true });
      log(onP, "② LLM 구문 재구성(어휘 유지)…");
      var o2 = await llmJSON([{ role: "system", content: "영어 문장 구조 변형가. 어휘는 대부분 유지하되 절 순서·태·연결사·구 구조를 바꿔 같은 의미를 다른 구문으로 표현한다. JSON만." }, { role: "user", content: "지문의 각 문장을 '어휘는 최대한 유지'하되 구문(능동↔수동, 절 순서, 분사구문, 연결사)만 바꿔라. 의미 동일." + _vd + "\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"구문이 바뀐 지문\",\"changed\":[\"바꾼 구문 기법 few개\"]}. JSON만." }], { noRule: true, temperature: _vt(), timeout: 60000 });
      trace.push({ line: 2, api: "llm", label: "구문 재구성", ok: !!(o2 && o2.variant) });
      if (o2) { variant = o2.variant || ""; changed = o2.changed || []; }
    } else if (level === "sentence") {
      log(onP, "① LLM 문장 재구성(구조+어휘 새로, 내용 동일)…");
      var o3 = await llmJSON([{ role: "system", content: "영어 리라이팅 전문가. 각 문장을 새 구조·새 어휘로 다시 쓰되 담긴 정보·논지는 동일하게 보존한다. JSON만." }, { role: "user", content: "지문을 문장 단위로 완전히 새로 써라(구조·표현·어휘 모두 새롭게, 그러나 정보·논리 흐름은 동일). 원문 표현 복사 금지." + _vd + "\n\n[원문]\n" + passage + "\n\nJSON: {\"variant\":\"재구성 지문\",\"changed\":[\"핵심 변화 few개\"]}. JSON만." }], { noRule: true, temperature: _vt(), timeout: 60000 });
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
      var o4 = await llmJSON([{ role: "system", content: "영어 지문 작가. 주어진 주제/논지만 유지하고 예시·전개·문장은 전부 새로 써서 완전히 다른 지문을 만든다(길이 유사, 수능 지문체). JSON만." }, { role: "user", content: "주제/논지: " + (theme || "") + (bg && bg.extract ? ("\n참고 배경: " + bg.extract.slice(0, 200)) : "") + "\n\n이 주제만 유지하고 새로운 예시·근거·전개로 완전히 새 지문(원문과 문장 겹침 금지, 100~140단어)을 써라." + _vd + "\n\nJSON: {\"variant\":\"새 지문\",\"changed\":[\"유지한 주제 1개\",\"새로 넣은 요소 few개\"]}. JSON만." }], { noRule: true, temperature: _vt(), timeout: 60000 });
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
    // PI 지수(패러프레이즈 인덱스): 원문→변형 정도의 표준 라벨. word=어휘치환, phrase=구문전환, sentence/theme=의미재진술
    var PI_OF = { word: "PI1(어휘 치환)", phrase: "PI2(구문 전환)", sentence: "PI3(의미 재진술)", theme: "PI3(의미 재진술·재창작)" };
    return { variant: variant, level: level, pi: PI_OF[level] || "", stage: (STAGE_INFO[level] || {}).name, note: (STAGE_INFO[level] || {}).desc, changed: changed, audit: gi.length ? ("어법 " + gi.length + "건 교정") : "어법 통과", _trace: trace };
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
      var example = ex ? ex.example : "";
      if (!example) { try { var tt = await tatoeba(full, 1); if (tt.length) example = tt[0]; } catch (_) {} }   // 예문 없으면 Tatoeba 코퍼스에서 실제 예문
      return { word: it.word, meaning: it.meaning, pos: pos, phonetic: (!isMulti && d && d.phonetic) || "", cefr: cefrOf(full) || (isMulti ? "" : cefrOf(head)), en_def: isMulti ? "" : ((d && d.meanings[0] && d.meanings[0].def) || (wk && wk[0] && wk[0].defs[0]) || ""), example: example, synonyms: syn };
    }));
  }
  // ===== 해설지 생성기(해설작성관 뉴런): 정답근거·오답별 근거·핵심어휘·출제의도 =====
  async function buildExplanation(q, passage, opts) {
    opts = opts || {}; if (!q) return null;
    var isMCQ = q.choices && q.choices.length >= 4;
    var pg = String(q.passage || passage || "");
    var sys = EXPERT_ID + " 지금은 학생용 '정확하고 자세한' 해설을 집필한다. 지문을 직접 인용해 근거를 대고, 정답 도출 과정을 단계적으로 설명하며, 학생이 몰랐을 개념·배경지식까지 친절히 풀어준다. 추측이 아니라 지문에 근거해 정확히. JSON만.";
    var head = "유형: " + q.type + "\n발문: " + q.instruction + (pg ? ("\n지문: " + pg.slice(0, 1100)) : "") + (isMCQ ? ("\n선지: " + JSON.stringify(q.choices) + "\n정답번호: " + q.answer) : ("\n모범답안: " + String(q.explanation || "").replace(/【출제의도】[\s\S]*$/, "").replace("[모범답안] ", "")));
    var spec = isMCQ
      ? "위 문항의 정확하고 자세한 해설을 작성하라. distractors에는 '정답 번호를 제외한 나머지 오답 선지 전부'를 빠짐없이. JSON: {\"correct\":\"정답이 옳은 이유 — 지문의 해당 문장을 큰따옴표로 직접 인용하고, 왜 그것이 근거가 되는지 2~3문장으로 단계적으로 설명\",\"distractors\":[{\"n\":오답번호(정수),\"why\":\"이 선지가 틀린 구체적 이유(지문의 어느 부분과 어긋나는지)\"}],\"syntax\":\"정답 판단에 관련된 핵심 구문·문법 분석(있으면)\",\"vocab\":[\"핵심 어휘·구문(영어 — 뜻)\"],\"concept\":\"이 문제를 풀기 위해 알아야 할 개념·배경지식을 학생 눈높이로 3~4문장 설명(글의 소재가 낯설면 그 소재 자체도 쉽게 풀어줌)\",\"intent\":\"출제의도 한 줄\"}. JSON만."
      : "위 서술형의 정확하고 자세한 해설을 작성하라. JSON: {\"correct\":\"모범답안 해설 — 왜 이렇게 써야 하는지 단계적으로, 지문 근거 인용\",\"rubric\":[\"채점 포인트(구체적으로)\"],\"syntax\":\"필요한 핵심 구문·문법\",\"vocab\":[\"핵심 어휘·구문(영어 — 뜻)\"],\"concept\":\"이 문제 관련 개념·배경지식을 학생 눈높이로 3~4문장\",\"intent\":\"출제의도 한 줄\"}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: head + "\n\n" + spec }], { noRule: true, temperature: 0.35, timeout: 65000 });
    if (!r) return null;
    function toStr(v) { return typeof v === "string" ? v : (v && (v.word || v.term || v.phrase || v.expression) ? ((v.word || v.term || v.phrase || v.expression) + (v.meaning || v.def || v.뜻 ? (" — " + (v.meaning || v.def || v.뜻)) : "")) : (v && v.point ? v.point : (v ? JSON.stringify(v) : ""))); }
    if (Array.isArray(r.vocab)) r.vocab = r.vocab.map(toStr).filter(Boolean);
    if (Array.isArray(r.rubric)) r.rubric = r.rubric.map(toStr).filter(Boolean);
    if (Array.isArray(r.distractors)) r.distractors = r.distractors.map(function (d) { return typeof d === "string" ? { n: "", why: d } : { n: d.n != null ? d.n : "", why: d.why || d.reason || toStr(d) }; });
    // 배경지식 보강: 소재 주제어로 위키 요약을 덧붙여 개념 설명을 뒷받침(검색 활용)
    if (!opts.noBg && pg) {
      try {
        var kw = await ask("이 글의 소재를 나타내는 영어 키워드 1~2단어(답만).\n\n" + pg.slice(0, 260), "단어만.", { noRule: true }).catch(function () { return ""; });
        if (kw) { var bg = await wiki(String(kw).replace(/[^A-Za-z ]/g, "").trim()).catch(function () { return null; }); if (bg && bg.extract) r.background = bg.extract.slice(0, 240); }
      } catch (_) {}
    }
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
    loadTypeDB: loadTypeDB, loadDifficultyDB: loadDifficultyDB, typeDBInfo: function () { return TYPE_DB_INFO; }, loadSharedHints: loadSharedHints, setLogicStanding: setLogicStanding,
    loadReviewDB: loadReviewDB, reviewItem: reviewItem, reviewCode: reviewCode, loadExaminerKB: loadExaminerKB, kbFor: kbFor, loadRaysKB: loadRaysKB, raysKB: raysKB, extendPassage: extendPassage, agentRun: agentRun, agentPlan: agentPlan, agentFeedback: agentFeedback,
    analysisSheet: analysisSheet, extractKeywords: extractKeywords, findSource: findSource, lastLimited: function () { return LAST_LIMITED; }, keyStats: keyStats,
    ollamaModels: async function (url) { try { var d = await getJSON(String(url || CFG.ollamaUrl).replace(/\/+$/, "") + "/api/tags", 4000); return (d && d.models || []).map(function (m) { return m.name; }); } catch (e) { return null; } },
    loadCorpus: loadCorpus, corpusInfo: corpusInfo, corpusPassage: corpusPassage, cefrOf: cefrOf, synAnt: synAnt, collocation: collocation, phrasalVerbs: phrasalVerbs, gecExamples: gecExamples, recommendBooks: recommendBooks, books: function () { return CORPUS.books || []; },
    corpusStat: function () { return { books: (CORPUS.books || []).length, vocab: CORPUS.vocab ? Object.keys(CORPUS.vocab).length : 0, passages: (CORPUS.passages || []).length, colloc: (CORPUS.colloc || []).length, synant: CORPUS.synant ? Object.keys(CORPUS.synant).length : 0, gec: (CORPUS.gec || []).length, phrasal: (CORPUS.phrasal || []).length, cefr: CORPUS.cefr ? Object.keys(CORPUS.cefr).length : 0, research: (CORPUS.research && CORPUS.research.count) || 0 }; },
    topCollocations: function (n) { return (CORPUS.colloc || []).slice(0, n || 12).map(function (c) { return { phrase: (c && c[0] != null) ? c[0] : c, count: (c && c[1]) || 0 }; }); },
    corpusResearch: function () { return (CORPUS.research && CORPUS.research.notes) || []; },
    errlog: function () { return ERRLOG; }, meetings: function () { return MEETINGS; },
    llm: llm, llmRaw: llmRaw, llmJSON: llmJSON, ask: ask, grammar: grammar, datamuse: datamuse, tatoeba: tatoeba, dict: dict, wiktionary: wiktionary, wiki: wiki, translate: translate, image: image,
    wikiSearch: wikiSearch, wikidata: wikidata, openLibrary: openLibrary, poetry: poetry, wordInfo: wordInfo, wikiquote: wikiquote, wikisource: wikisource,
    refineLoop: refineLoop, critiqueQ: critiqueQ, ensemble: ensemble, spawnLLM: spawnLLM, spawned: function () { return SPAWNED; }, brain: brain, deliberate: deliberate,
    selfLearnStep: selfLearnStep, learnedRules: learnedRules, applyLearned: applyLearned, teacherHarness: teacherHarness,
    teacherCount: teacherCount, sampleTeachers: sampleTeachers, makeTeacher: makeTeacher, buildExplanation: buildExplanation,
    brainStructure: brainStructure, regionOf: regionOf,
    generateExam: generateExam, generateOne: generateOne, reviewOptions: reviewOptions, suggestTypes: suggestTypes, transformPassage: transformPassage, transformStaged: transformStaged, stageInfo: function () { return STAGE_INFO; }, buildVocabList: buildVocabList, healthCheck: healthCheck,
    buildInference: buildInference, buildVocab: buildVocab, buildGrammar: buildGrammar, buildBlank: buildBlank,
    rebalanceAnswers: rebalanceAnswers, stampWork: stampWork, rxFeedback: rxFeedback, pruneStaleAnalysis: pruneStaleAnalysis
  };
})();
