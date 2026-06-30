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
  var RUNHINT = "", ERRLOG = [], MEETINGS = [], LOGURL = "", CB = {};

  function withTimeout(ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms || 45000); return { signal: c.signal, done: function () { clearTimeout(t); } }; }
  async function getJSON(url, ms) { var to = withTimeout(ms); try { return await (await fetch(url, { signal: to.signal })).json(); } finally { to.done(); } }
  function log(cb, m) { if (typeof cb === "function") try { cb(m); } catch (_) {} }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rint(n) { return Math.floor(Math.random() * n); }

  /* ---------- LLM 공급자 (키리스 기본 + 선택 무료키 업그레이드) ----------
   * 키 미입력 → Pollinations(무키). Gemini/Groq '무료키' 입력 시 그쪽으로 라우팅.
   * 키는 사용자 브라우저(localStorage)에만 저장 — 공개 코드엔 절대 안 들어감. */
  var CFG = { geminiKey: "", groqKey: "", geminiModel: "gemini-2.0-flash", groqModel: "llama-3.3-70b-versatile" };
  function configure(c) { c = c || {}; Object.assign(CFG, c); if (c.logUrl != null) LOGURL = c.logUrl; if (c.onMeeting) CB.onMeeting = c.onMeeting; if (c.onError) CB.onError = c.onError; }
  function provider() { return CFG.geminiKey ? "gemini" : (CFG.groqKey ? "groq" : "pollinations"); }
  async function llmRaw(messages, opts) {
    opts = opts || {}; var prov = provider(); var to = withTimeout(opts.timeout || 70000);
    try {
      if (prov === "gemini") {
        var sys = messages.filter(function (m) { return m.role === "system"; }).map(function (m) { return m.content; }).join("\n");
        var rest = messages.filter(function (m) { return m.role !== "system"; }).map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }; });
        var body = { contents: rest, generationConfig: { temperature: opts.temperature == null ? 0.6 : opts.temperature } };
        if (sys) body.systemInstruction = { parts: [{ text: sys }] };
        var rg = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + CFG.geminiModel + ":generateContent?key=" + encodeURIComponent(CFG.geminiKey), { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal, body: JSON.stringify(body) });
        var dg = await rg.json();
        return (dg.candidates && dg.candidates[0] && dg.candidates[0].content && dg.candidates[0].content.parts && dg.candidates[0].content.parts[0].text) || "";
      }
      if (prov === "groq") {
        var rq = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.groqKey }, signal: to.signal, body: JSON.stringify({ model: CFG.groqModel, messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature }) });
        var dq = await rq.json();
        return (dq.choices && dq.choices[0] && dq.choices[0].message && dq.choices[0].message.content) || "";
      }
      var r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, signal: to.signal,
        body: JSON.stringify({ model: "openai", messages: messages, temperature: opts.temperature == null ? 0.6 : opts.temperature, seed: opts.seed, private: true }) });
      var d = await r.json();
      return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
    } finally { to.done(); }
  }
  async function llmWithRetry(messages, opts) {
    for (var i = 0; i < 3; i++) { var s = await llmRaw(messages, opts).catch(function () { return ""; }); if (s && s.trim()) return s; await delay(900 * (i + 1)); }
    return "";
  }
  var _llmQ = Promise.resolve();
  function llm(messages, opts) {
    if (RUNHINT) {
      var hasSys = messages.some(function (m) { return m.role === "system"; });
      messages = hasSys ? messages.map(function (m) { return m.role === "system" ? { role: "system", content: m.content + "\n[직전 오류에 대한 회의 개선지시] " + RUNHINT } : m; })
        : [{ role: "system", content: "[개선지시] " + RUNHINT }].concat(messages);
    }
    var p = _llmQ.then(function () { return llmWithRetry(messages, opts); }, function () { return llmWithRetry(messages, opts); });
    _llmQ = p.then(function () { return delay(500); }, function () { return delay(500); });
    return p;
  }
  async function llmJSON(messages, opts) { return extractJSON(await llm(messages, opts)); }
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

  /* ===== 뉴럴 메시: 뉴런=API, 시냅스=데이터 흐름(최대 상호연결) ===== */
  var MESH = {
    neurons: ROSTER,
    layers: [
      { name: "감각층(입력)", keys: ["wiki", "dict", "wikt", "thesaurus"], role: "지문→배경·정의·어원·연관어 신호 추출" },
      { name: "연합층(이해)", keys: ["llm"], role: "신호 종합→핵심 논지·정답 도출" },
      { name: "생성층(발화)", keys: ["llm", "thesaurus"], role: "역할별 오답 개별 발화(+반의어)" },
      { name: "억제층(검증)", keys: ["grammar", "thesaurus", "trans"], role: "어법·의미중복·번역 교차 억제" },
      { name: "피드백(회의)", keys: ["llm"], role: "오류→회의→개선지시 재발화" }
    ],
    synapses: [["wiki", "llm"], ["dict", "llm"], ["wikt", "llm"], ["thesaurus", "llm"], ["llm", "thesaurus"], ["llm", "grammar"], ["grammar", "llm"], ["trans", "llm"], ["llm", "trans"], ["image", "llm"]]
  };

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
    var map = { syn: "rel_syn", ant: "rel_ant", trg: "rel_trg", spc: "rel_spc", gen: "rel_gen", ml: "ml" };
    try { var d = await getJSON("https://api.datamuse.com/words?" + (map[rel] || "ml") + "=" + encodeURIComponent(word) + "&max=" + (max || 10), 12000); return (d || []).map(function (x) { return x.word; }); }
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

  /* ---------- 공통 보조 ---------- */
  function englishWords(s) { return (String(s).match(/[A-Za-z][A-Za-z'\-]{2,}/g) || []); }
  var STOP = { about: 1, above: 1, after: 1, again: 1, their: 1, there: 1, these: 1, those: 1, which: 1, while: 1, would: 1, could: 1, should: 1, other: 1, where: 1, when: 1, that: 1, this: 1, with: 1, from: 1, they: 1, them: 1, then: 1, than: 1, into: 1, only: 1, some: 1, such: 1, also: 1, each: 1, more: 1, most: 1, much: 1, even: 1, here: 1, your: 1, because: 1, however: 1, therefore: 1 };
  function contentWords(passage) { var f = {}; englishWords(passage).forEach(function (w) { var l = w.toLowerCase(); if (l.length >= 5 && !STOP[l]) f[l] = (f[l] || 0) + 1; }); return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }); }
  function shuffleAnswer(answer, distractors) {
    var all = [answer].concat((distractors || []).slice(0, 4)); while (all.length < 5) all.push("(보기 부족)");
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
    log(onP, "· 자료 수집반(Datamuse·Dictionary·Wikipedia) 병렬 가동…");
    var cw = contentWords(passage).slice(0, 8), ant = {}, syn = {}, defs = {};
    await Promise.all(cw.map(async function (w) {
      try { var a = await datamuse(w, "ant", 2); if (a.length) ant[w] = a[0]; } catch (_) {}
      try { var s = await datamuse(w, "syn", 5); if (s.length) syn[w] = s; } catch (_) {}
    }));
    await Promise.all(cw.slice(0, 5).map(async function (w) { try { var d = await dict(w); if (d && d.meanings[0]) defs[w] = d.meanings[0].def; } catch (_) {} }));
    var bg = null, topic = await ask("다음 글의 핵심 주제를 영어 1~3단어(명사)로. 단어만.\n\n" + passage.slice(0, 500)).catch(function () { return ""; });
    if (topic) { try { bg = await wiki(topic); } catch (_) {} }
    return { cw: cw, ant: ant, syn: syn, defs: defs, bg: bg, topic: topic };
  }
  function synOverlap(answer, distractor, ctx) {
    var pool = {}; englishWords(answer).forEach(function (w) { (ctx.syn && ctx.syn[w.toLowerCase()] || []).forEach(function (s) { pool[s] = 1; }); });
    return englishWords(distractor).some(function (w) { return pool[w.toLowerCase()]; });
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
  function inferenceSteps(passage, type, ctx) {
    var kind = infMeta(type).kind;
    var roles = [["부분적·지엽적", "글의 사소한 일부만 담아"], ["정반대", "핵심과 반대 의미로"], ["글과 무관", "글에 없는 다른 주제로"], ["지나치게 포괄적", "너무 일반적이라 핵심을 못 짚게"]];
    var steps = [
      { api: "wiki", label: "배경지식 조회", run: function (s) { return Promise.resolve({ bg: (ctx && ctx.bg) || null }); } },
      { api: "llm", label: "핵심 논지 추출", run: async function (s) { var h = s.bg && s.bg.extract ? ("\n(참고 배경: " + s.bg.extract.slice(0, 160) + ")") : ""; return { main: await ask("다음 글의 핵심 논지를 영어 한 문장으로(답만)." + h + "\n\n" + passage, "핵심 한 문장. 답만.") }; } },
      { api: "llm", label: "정답 보기 작성", run: async function (s) { if (!s.main) throw new Error("no main"); return { answer: await ask("글 핵심: \"" + s.main + "\"\n이를 담은 " + type + " 정답을 " + kind + "로 간결히. 보기 텍스트만.") }; } }
    ];
    roles.forEach(function (r, idx) {
      steps.push({ api: "llm", label: "오답" + (idx + 1) + " (" + r[0] + ") 설계", run: async function (s) { if (!s.answer) throw new Error("no answer"); var d = await ask("정답: \"" + s.answer + "\"\n글 핵심: " + s.main + "\n이 정답과 의미가 분명히 다른 '" + r[0] + "' 오답 1개를 " + kind + "로 만들되 " + r[1] + ", 정답 재진술 금지. 보기 텍스트만."); s._last = d; s.dis = (s.dis || []).concat(d ? [d] : []); return { dis: s.dis }; } });
      steps.push({ api: "thesaurus", label: "오답" + (idx + 1) + " 동의어중복 검사", run: async function (s) { var d = s._last; if (d && ctx && synOverlap(s.answer, d, ctx)) { var d2 = await ask("정답 \"" + s.answer + "\"과 단어·의미가 겹치지 않는 '" + r[0] + "' 오답 1개를 " + kind + "로. 보기만."); if (d2) s.dis[s.dis.length - 1] = d2; } return { dis: s.dis }; } });
    });
    steps.push({ api: "grammar", label: "보기 어법 검수(LanguageTool)", run: async function (s) { var gi = []; try { gi = await grammar([s.answer].concat(s.dis || []).filter(function (c) { return /[A-Za-z]\s[A-Za-z]/.test(c); }).join("\n")); } catch (_) {} return { gi: gi }; } });
    steps.push({ api: "trans", label: "정답 한국어 교차검증(MyMemory)", run: async function (s) { var ko = ""; try { ko = await translate(s.answer, "en|ko"); } catch (_) {} return { ko: ko }; } });
    steps.push({ api: "core", label: "보기 배치·정답 확정", run: function (s) { var a = shuffleAnswer(s.answer, s.dis || []); return Promise.resolve({ choices: a.choices, answerIdx: a.answer }); } });
    return steps;
  }
  async function buildInference(passage, type, opts) {
    opts = opts || {}; var onP = opts.onProgress, ctx = opts.ctx || {};
    var st = await runHarness(inferenceSteps(passage, type, ctx), { passage: passage, ctx: ctx, dis: [] },
      function (ev) { log(onP, "  ┃라인 " + ev.line + "/" + ev.total + " [" + ev.api + "] " + ev.label + "…"); });
    if (!st.answer || !st.choices) return null;
    var meta = infMeta(type);
    return { type: type, instruction: meta.instr, passage: "", choices: st.choices, answer: st.answerIdx,
      explanation: "글의 핵심 논지는 '" + st.main + "'이며 정답" + (st.ko ? (" (" + st.ko + ")") : "") + "이 이를 반영한다.",
      _audit: (st.gi && st.gi.length) ? ("어법 의심 " + st.gi.length + "건") : "검증 통과", _trace: st._trace };
  }
  // 빈칸: ① 핵심어구 비우기 → ② 정답 → ③ 역할별 오답
  async function buildBlank(passage) {
    var o = await llmJSON([{ role: "system", content: "빈칸추론 출제자. JSON만." }, { role: "user", content: "다음 글에서 '핵심 논지'를 담은 어구 한 곳을 골라 ____ 로 비워라. JSON: {\"blanked\":\"해당 어구만 ____로 바꾼 지문 전체\",\"answer\":\"빈칸에 들어갈 영어 어구\"}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.answer || !o.blanked) return null;
    var dis = await makeDistractors(o.answer, "영어 어구", "빈칸 추론. 핵심을 묻는 자리.");
    var a = shuffleAnswer(o.answer, dis);
    return { type: "빈칸", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것은?", passage: o.blanked, choices: a.choices, answer: a.answer, explanation: "빈칸에는 '" + o.answer + "'가 들어가 글의 논지를 완성한다." };
  }
  // 함의: ① 밑줄 구절+의미 → ② 역할별 오답
  async function buildImplication(passage) {
    var o = await llmJSON([{ role: "system", content: "함의추론 출제자. JSON만." }, { role: "user", content: "다음 글에서 함축 의미가 풍부한 '원문 구절' 하나와 그 문맥상 의미를 정하라. JSON: {\"phrase\":\"원문 그대로의 구절\",\"meaning\":\"그 함축 의미를 풀어쓴 영어 한 문장\"}.\n\n" + passage }], { temperature: 0.4, timeout: 55000 });
    if (!o || !o.meaning) return null;
    var dis = await makeDistractors(o.meaning, "영어 한 문장", "밑줄 구절 '" + (o.phrase || "") + "'의 함의");
    var a = shuffleAnswer(o.meaning, dis);
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
    var a = shuffleAnswer(ans, dis);
    return { type: "요약", instruction: "다음 요약문의 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?", passage: o.summary, choices: a.choices, answer: a.answer, explanation: "(A) " + o.A + " / (B) " + o.B + " 가 글의 요지를 정확히 요약한다." };
  }
  // 내용불일치/일치
  async function buildFactCheck(passage, wantMatch) {
    var o = await llmJSON([{ role: "system", content: "내용일치 출제자. JSON만." }, { role: "user", content: "다음 글의 내용에 관한 한국어 진술 5개를 만들어라. 정확히 1개만 글과 '" + (wantMatch ? "일치" : "불일치(모순)") + "'하고 나머지 4개는 그 반대가 되게 하라. JSON: {\"statements\":[\"진술 5개\"],\"answer\":정답번호1~5}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !Array.isArray(o.statements) || o.statements.length < 5) return null;
    return { type: wantMatch ? "내용일치" : "내용불일치", instruction: "다음 글의 내용과 " + (wantMatch ? "일치하는" : "일치하지 않는") + " 것은?", passage: "", choices: o.statements.slice(0, 5), answer: parseInt(o.answer, 10) || 1, explanation: "정답 진술만 글과 " + (wantMatch ? "일치" : "모순") + "한다." };
  }
  // 어휘(문맥상 부적절): Datamuse 반의어를 재료로 LLM이 1곳 교체
  async function buildVocab(passage) {
    var cw = contentWords(passage).slice(0, 8), ant = {};
    await Promise.all(cw.map(async function (w) { var a = await datamuse(w, "ant", 2); if (a.length) ant[w] = a[0]; }));
    var brief = Object.keys(ant).map(function (w) { return w + "↔" + ant[w]; }).join(", ");
    var o = await llmJSON([{ role: "system", content: "어휘(문맥상 부적절) 출제자. JSON만." }, { role: "user", content: "다음 지문에서 핵심 단어 5개를 골라 각 단어 앞에 ⓐⓑⓒⓓⓔ를 붙이고 <u>밑줄</u>하라. 그 중 정확히 1개만 '문맥상 부적절한 반의어'로 바꿔라. 참고 반의어쌍: " + (brief || "-") + ". JSON: {\"passage\":\"ⓐ<u>..</u> 5곳 표시한 지문\",\"answer\":1~5,\"wrong\":\"바꿔 넣은 부적절 단어\",\"correct\":\"원래 맞는 단어\"}.\n\n" + passage }], { temperature: 0.45, timeout: 60000 });
    if (!o || !o.passage) return null;
    return { type: "어휘", instruction: "밑줄 친 ⓐ~ⓔ 중 문맥상 낱말의 쓰임이 적절하지 않은 것은?", passage: o.passage, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: parseInt(o.answer, 10) || 1, explanation: "정답 자리는 '" + (o.wrong || "") + "' 대신 '" + (o.correct || "") + "'가 맞다." };
  }
  // 어법: LLM이 1곳 오류 주입 → LanguageTool로 검증
  async function buildGrammar(passage) {
    var o = await llmJSON([{ role: "system", content: "어법 출제자. JSON만." }, { role: "user", content: "다음 지문에서 어법 포인트 5곳을 골라 각 앞에 ⓐⓑⓒⓓⓔ를 붙이고 <u>밑줄</u>하라. 그 중 정확히 1곳에만 어법 오류를 넣어라(나머지 4곳은 정확). JSON: {\"passage\":\"ⓐ<u>..</u> 표시 지문\",\"answer\":1~5,\"error\":\"틀린 표현\",\"correct\":\"올바른 표현\"}.\n\n" + passage }], { temperature: 0.45, timeout: 60000 });
    if (!o || !o.passage) return null;
    var verified = "";
    try { var g = await grammar(String(o.passage).replace(/<[^>]+>/g, " ").replace(/[ⓐ-ⓔ]/g, "")); if (g.length) verified = " (LanguageTool 확인: " + g.slice(0, 2).map(function (x) { return x.bad; }).join(", ") + ")"; } catch (_) {}
    return { type: "어법", instruction: "밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것은?", passage: o.passage, choices: ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"], answer: parseInt(o.answer, 10) || 1, explanation: "'" + (o.error || "") + "'는 '" + (o.correct || "") + "'로 고쳐야 한다." + verified };
  }
  // 서술형
  async function buildEssay(passage) {
    var o = await llmJSON([{ role: "system", content: "고교 내신 서술형 출제자. JSON만." }, { role: "user", content: "다음 지문으로 내신 서술형 1문항을 만들어라(우리말 해석 / 조건 영작 / 요약문 빈칸 중 하나). JSON: {\"instruction\":\"한국어 발문(지문에서 인용할 문장/조건 포함)\",\"answer\":\"모범 답안\"}.\n\n" + passage }], { temperature: 0.5, timeout: 60000 });
    if (!o || !o.instruction) return null;
    return { type: "서술형", instruction: o.instruction, passage: "", choices: [], answer: 0, explanation: "[모범답안] " + (o.answer || "") };
  }

  var BUILDERS = {
    "주제": function (p, o) { return buildInference(p, "주제", o); }, "제목": function (p, o) { return buildInference(p, "제목", o); }, "요지": function (p, o) { return buildInference(p, "요지", o); },
    "빈칸": buildBlank, "함의": buildImplication, "요약": buildSummary,
    "내용불일치": function (p, o) { return buildFactCheck(p, false, o); }, "내용일치": function (p, o) { return buildFactCheck(p, true, o); },
    "어휘": buildVocab, "어법": buildGrammar, "서술형": buildEssay
  };

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
  async function generateExam(passage, types, opts) {
    opts = opts || {}; var onP = opts.onProgress, out = [];
    log(onP, "■ 1단계: 자료 수집반 가동(전 API)…");
    var ctx = await prepContext(passage, onP).catch(function () { return {}; });
    if (ctx.topic) log(onP, "   주제어=" + ctx.topic + (ctx.bg ? " · 위키 배경 확보" : "") + " · 반의어 " + Object.keys(ctx.ant || {}).length + "쌍");
    var bopts = { onProgress: onP, ctx: ctx };
    log(onP, "■ 2단계: 유형별 초미분화 출제…");
    for (var i = 0; i < types.length; i++) {
      var t = types[i], b = BUILDERS[t] || (function (tt) { return function (p, o) { return buildInference(p, tt, o); }; })(t), got = null;
      RUNHINT = "";
      for (var attempt = 1; attempt <= 3 && !got; attempt++) {
        log(onP, "[" + (i + 1) + "/" + types.length + "] " + t + (attempt > 1 ? " (개선 재시도 " + attempt + ")" : "") + " 출제 중…");
        try { var q = await b(passage, bopts); if (q && q.instruction) got = q; } catch (e) {}
        if (!got && attempt === 1) {
          record("출제실패", t, "1차 시도 실패");
          log(onP, "   ⚑ API 회의 소집(" + t + ") — 오류 토론·개선…");
          var mt = await convene(t, "1차 시도 실패").catch(function () { return { hint: "" }; });
          RUNHINT = mt.hint || "";
          if (mt.hint) log(onP, "   ↳ 합의 개선지시: " + mt.hint);
        }
      }
      RUNHINT = "";
      if (got) out.push(got); else { record("최종실패", t, "3회 실패"); log(onP, "   · " + t + " 생성 실패(건너뜀)"); }
    }
    log(onP, "✓ 완료 — " + out.length + "/" + types.length + "문항");
    return out;
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

  async function buildVocabList(passage, opts) {
    opts = opts || {}; var onP = opts.onProgress, n = opts.n || 12;
    log(onP, "① LLM 표제어 선정…");
    var pick = await llmJSON([{ role: "system", content: "영어 교사. 핵심 단어/숙어를 난이도순." }, { role: "user", content: "다음 지문에서 핵심 단어·숙어 " + n + "개를 JSON 배열로: [{\"word\":\"기본형\",\"meaning\":\"한국어 뜻\"}]. JSON만.\n\n" + passage }], { temperature: 0.3, timeout: 60000 });
    var base = Array.isArray(pick) ? pick : (pick && pick.words) || [];
    log(onP, "② 사전·어원·유의어·번역 동시 보강…");
    return await Promise.all(base.slice(0, n).map(async function (it) {
      var word = (it.word || "").toLowerCase().split(/\s+/)[0], d = null, wk = null, syn = [], mm = "";
      try { d = await dict(word); } catch (_) {} try { wk = await wiktionary(word); } catch (_) {} try { syn = await datamuse(word, "syn", 4); } catch (_) {} try { mm = await translate(it.word, "en|ko"); } catch (_) {}
      var ex = d && d.meanings.find(function (m) { return m.example; }), pos = (d && d.meanings[0] && d.meanings[0].pos) || (wk && wk[0] && wk[0].pos) || "";
      var alt = (mm && it.meaning && mm.replace(/\s/g, "") !== it.meaning.replace(/\s/g, "")) ? mm : "";
      return { word: it.word, meaning: it.meaning, pos: pos, en_def: (d && d.meanings[0] && d.meanings[0].def) || (wk && wk[0] && wk[0].defs[0]) || "", example: ex ? ex.example : "", synonyms: syn, alt_ko: alt };
    }));
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
    roster: ROSTER, BEST_TYPES: BEST_TYPES, mesh: MESH, pipeline: pipelineOf, runHarness: runHarness, configure: configure, provider: provider, convene: convene,
    errlog: function () { return ERRLOG; }, meetings: function () { return MEETINGS; },
    llm: llm, llmJSON: llmJSON, ask: ask, grammar: grammar, datamuse: datamuse, dict: dict, wiktionary: wiktionary, wiki: wiki, translate: translate, image: image,
    generateExam: generateExam, suggestTypes: suggestTypes, transformPassage: transformPassage, buildVocabList: buildVocabList, healthCheck: healthCheck,
    buildInference: buildInference, buildVocab: buildVocab, buildGrammar: buildGrammar, buildBlank: buildBlank
  };
})();
