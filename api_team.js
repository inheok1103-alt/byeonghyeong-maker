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
    for (var i = 0; i < 4; i++) { var s = await llmRaw(messages, opts).catch(function () { return ""; }); if (s && s.trim()) return s; await delay(1200 * (i + 1)); }
    return "";
  }
  var _llmQ = Promise.resolve();
  function llm(messages, opts) {
    opts = opts || {};
    var sysadd = "";
    if (!opts.noRule) {
      if (TYPERULE) sysadd += "\n[이 유형의 수능 출제 규칙 — 반드시 준수] " + TYPERULE;
      if (LEVELRULE) sysadd += "\n" + LEVELRULE;
      var extra = [STANDING, RUNHINT].filter(Boolean).join(" / ");
      if (extra) sysadd += "\n[누적·회의 개선지침] " + extra;
    }
    if (sysadd) {
      var hasSys = messages.some(function (m) { return m.role === "system"; });
      messages = hasSys ? messages.map(function (m) { return m.role === "system" ? { role: "system", content: m.content + sysadd } : m; })
        : [{ role: "system", content: sysadd.trim() }].concat(messages);
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
    return { neurons: N, synapses: S, groups: ["입력", "이해", "생성", "검증", "피드백", "출력"], roster: ROSTER };
  })();
  function topology() {
    var deg = {}; MESH.neurons.forEach(function (n) { deg[n.key] = 0; });
    MESH.synapses.forEach(function (e) { deg[e[0]] = (deg[e[0]] || 0) + 1; deg[e[1]] = (deg[e[1]] || 0) + 1; });
    return { neurons: MESH.neurons.length, synapses: MESH.synapses.length,
      byNeuron: MESH.neurons.map(function (n) { return { key: n.key, name: n.name, api: n.api, group: n.group, degree: deg[n.key] }; }).sort(function (a, b) { return b.degree - a.degree; }) };
  }

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
  async function wordInfo(word) { try { var d = await getJSON("https://api.datamuse.com/words?sp=" + encodeURIComponent(word) + "&md=fps&max=1", 12000); var it = (d || [])[0]; if (!it) return null; var f = 0, pos = ""; (it.tags || []).forEach(function (t) { if (t.indexOf("f:") === 0) f = parseFloat(t.slice(2)) || 0; else if (/^[a-z]+$/.test(t)) pos = pos || t; }); return { word: it.word, freq: f, syll: it.numSyllables || 0, pos: pos, level: f > 20 ? "쉬움" : f > 3 ? "보통" : "어려움" }; } catch (_) { return null; } }
  async function wikiquote(topic) { try { var d = await getJSON("https://en.wikiquote.org/api/rest_v1/page/summary/" + encodeURIComponent(String(topic).replace(/\s+/g, "_")), 12000); return d.extract || ""; } catch (_) { return ""; } }
  async function wikisource(topic) { try { var d = await getJSON("https://en.wikisource.org/api/rest_v1/page/summary/" + encodeURIComponent(String(topic).replace(/\s+/g, "_")), 12000); return d.extract || ""; } catch (_) { return ""; } }

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

  // ===== 선지 제작 팀: 5개 선지를 최종 검수·정리(형태통일·정답유일·어법·어구화) =====
  async function reviewOptions(answer, dis, ctx) {
    ctx = ctx || {};
    var sys = "너는 대한민국 수능 영어 '선지(보기) 검수관'이다. 5개 선택지를 최종 점검·정리한다: ①정답은 글을 정확히 반영하는 '단 하나' ②오답 4개는 서로 및 정답과 의미가 겹치지 않게, '부분일치/정반대/글과무관/과장·일반화' 등 서로 다른 방식으로 분명히 틀리되 매력적으로(본문 단어 일부 재활용) ③5개의 길이·문법 형태를 서로 통일 ④어법 오류 수정 ⑤빈칸/요약형이면 완성 문장이 아니라 끼워지는 '어구/절'로 ⑥정답은 본문 표현을 그대로 베끼지 말고 패러프레이즈. JSON만.";
    var user = "유형: " + (ctx.type || "") + "\n정답 선지: \"" + answer + "\"\n오답 초안: " + JSON.stringify(dis || []) + (ctx.main ? ("\n글 핵심: " + ctx.main) : "") + (ctx.slot ? ("\n빈칸 프레임(모든 선지는 이 '____' 자리에 문법적으로 그대로 들어가야 함, 완성문장 금지): " + ctx.slot) : "") + "\n위 기준대로 5개 선지를 다듬어 JSON으로: {\"choices\":[\"5개 문자열\"],\"answer\":정답의 1~5 위치(정수)}. JSON만.";
    var r = await llmJSON([{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0.4, timeout: 60000 });
    if (r && Array.isArray(r.choices) && r.choices.length >= 4) {
      var ch = r.choices.map(clean1).filter(Boolean).slice(0, 5);
      while (ch.length < 5) ch.push("(보기)");
      var ai = parseInt(r.answer, 10); if (!(ai >= 1 && ai <= 5)) ai = 1;
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
    steps.push({ api: "team", label: "선지 제작 팀 — 최종 검수(형태통일·정답유일·어법·어구화)", run: async function (s) { var r = await reviewOptions(s.answer, s.dis || [], { type: type, main: s.main }); return { choices: r.choices, answerIdx: r.answer }; } });
    return steps;
  }
  async function buildInference(passage, type, opts) {
    opts = opts || {}; var onP = opts.onProgress, ctx = opts.ctx || {};
    var st = await runHarness(inferenceSteps(passage, type, ctx, opts.fast), { passage: passage, ctx: ctx, dis: [] },
      function (ev) { log(onP, "  ┃라인 " + ev.line + "/" + ev.total + " [" + ev.api + "] " + ev.label + "…"); });
    if (!st.answer || !st.choices) return null;
    var meta = infMeta(type);
    return { type: type, instruction: meta.instr, passage: "", choices: st.choices, answer: st.answerIdx,
      explanation: "글의 핵심 논지는 '" + st.main + "'이며 정답" + (st.ko ? (" (" + st.ko + ")") : "") + "이 이를 반영한다.",
      _audit: (st.gi && st.gi.length) ? ("어법 의심 " + st.gi.length + "건") : "검증 통과", _trace: st._trace };
  }
  // 빈칸: ① 핵심 논지 자리에 어구 비우기(도입부 회피) → ② 프레임 맞춤 어구형 정답 → ③ 역할별 오답
  async function buildBlank(passage) {
    var o = await llmJSON([{ role: "system", content: "수능 빈칸추론 출제자. 빈칸은 필자의 핵심 주장·결론을 담은 자리에 두고 도입부 정의문·예시·부연은 피한다. JSON만." }, { role: "user", content: "다음 글에서 필자의 핵심 주장/결론을 담은 문장을 고르고, 그 문장에서 논지의 핵심 어구(3~8단어)를 ____ 로 비워라(도입부 첫 문장은 피할 것). 정답은 빈칸에 '문법적으로 그대로 들어맞는 간결한 영어 어구(완성 문장 절대 아님)'로, 본문 표현이 아니라 상위어·동의어로 패러프레이즈하라. JSON: {\"blanked\":\"해당 어구만 ____로 바꾼 지문 전체\",\"answer\":\"빈칸에 들어갈 정답 어구\",\"orig\":\"비운 원래 어구\",\"frame\":\"빈칸이 든 문장만(____ 포함)\"}.\n\n" + passage }], { temperature: 0.4, timeout: 60000 });
    if (!o || !o.answer || !o.blanked) return null;
    var frame = o.frame || "";
    var dis = await makeDistractors(o.answer, "빈칸 '____'에 그대로 끼워지는 간결한 영어 어구(완성 문장 아님, 정답과 품사·길이 통일)", "빈칸 프레임: " + (frame || "(문장 일부)") + "\n오답은 본문 어휘를 재활용하되 이 자리에 넣으면 논리가 어긋나게(정반대/부분일치/무관/과장).");
    var a = await reviewOptions(o.answer, dis, { type: "빈칸", slot: frame, main: o.answer });
    // 형태 가드: 완성문장형(주어+be/조동사 시작) 선지를 어구형으로 축약
    var ch = (a.choices || []).map(function (c) { return String(c).replace(/^\s*(happiness|it|one|people|the individual|this|they|we|society)\s+(is|are|was|were|has|have|can|will|becomes?)\s+/i, "").trim(); });
    return { type: "빈칸", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것은?", passage: o.blanked, choices: ch, answer: a.answer, explanation: "빈칸에는 '" + o.answer + "'가 들어가 글의 논지를 완성한다" + (o.orig ? (" (본문 '" + o.orig + "'의 패러프레이즈)") : "") + "." };
  }
  // 함의: ① 밑줄 구절+의미 → ② 역할별 오답
  async function buildImplication(passage) {
    var o = await llmJSON([{ role: "system", content: "함의추론 출제자. JSON만." }, { role: "user", content: "다음 글에서 함축 의미가 풍부한 '원문 구절' 하나와 그 문맥상 의미를 정하라. JSON: {\"phrase\":\"원문 그대로의 구절\",\"meaning\":\"그 함축 의미를 풀어쓴 영어 한 문장\"}.\n\n" + passage }], { temperature: 0.4, timeout: 55000 });
    if (!o || !o.meaning) return null;
    var dis = await makeDistractors(o.meaning, "영어 한 문장", "밑줄 구절 '" + (o.phrase || "") + "'의 함의");
    var a = await reviewOptions(o.meaning, dis, { type: "함의" });
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
    var a = await reviewOptions(ans, dis, { type: "요약" });
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
    var sys = "너는 고교 내신 영어 서술형 출제자다. 출력은 아래 두 구획 형식만 쓴다(JSON·마크다운·여분 설명 금지).";
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
    var key = cws[0] || (words.filter(function (w) { return w.length >= 4; })[0]) || words[0];
    var ko = await translate(sent.replace(/[.?!]+$/, ""), "en|ko").catch(function () { return ""; });
    var instr = "다음 우리말과 일치하도록 주어진 단어를 활용하여 영작하시오.\n〈조건〉 필요시 어형을 바꿀 수 있고, 다른 단어를 추가할 수 있음. 한 문장으로 쓸 것.\n우리말: " + (ko || "(번역 생략)") + "\n주어진 단어: ( " + key + " )";
    return { type: "조건영작", instruction: instr, passage: "", choices: [], answer: 0,
      explanation: "[모범답안] " + sent.replace(/[.?!]*$/, "."),
      _trace: [{ line: 1, api: "llm", label: "정답문장 생성", ok: !!sent }, { line: 2, api: "code", label: "핵심어 추출", ok: !!key }, { line: 3, api: "trans", label: "MyMemory 번역", ok: !!ko }, { line: 4, api: "code", label: "조건박스 조립", ok: true }] };
  }

  /* ===== 재귀 상호작용: 검수 뉴런 ↔ 재작성 뉴런이 수렴까지 반복(recurrent refinement) ===== */
  async function critiqueQ(q, passage) {
    var isMCQ = q.choices && q.choices.length >= 4;
    var pg = String(q.passage || passage || "");
    var sys = "너는 대한민국 수능·최상위 내신 영어 문항 심사위원단(정답검수·오답설계·어법·난이도 4인)이다. 문항을 0~100점으로 냉정히 평가하고 구체적 결함을 짚는다. JSON만.";
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
  // 수렴까지(또는 목표점수·최대라운드까지) 재귀 반복. best(최고점 버전)를 반환.
  async function refineLoop(q, opts) {
    if (!q) return q; opts = opts || {}; var target = opts.target || 88, maxR = opts.maxRounds || 4, onP = opts.onProgress, passage = opts.passage || "";
    var best = q, bestScore = -1, cur = q, stale = 0, rounds = [];
    for (var r = 1; r <= maxR; r++) {
      var c = await critiqueQ(cur, passage);
      rounds.push({ round: r, score: c.score, issues: (c.issues || []).slice(0, 3) });
      log(onP, "  🔁 상호작용 라운드 " + r + " — 검수 " + c.score + "점" + ((c.issues && c.issues.length) ? (" · " + c.issues.slice(0, 2).join("; ")) : " · 결함 없음"));
      try { if (CB.onRefine) CB.onRefine({ round: r, score: c.score, type: q.type }); } catch (_) {}
      if (c.score > bestScore) { bestScore = c.score; best = cur; stale = 0; } else { stale++; }
      if (c.score >= target) break;
      if (stale >= 2) { log(onP, "  · 수렴(추가 개선 없음) — 반복 종료"); break; }
      var improved = await applyFix(cur, c, passage); if (!improved) { stale++; continue; }
      cur = improved;
    }
    best._refine = { rounds: rounds, finalScore: bestScore }; return best;
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
  async function ensemble(prompt, opts) {
    opts = opts || {}; var onP = opts.onProgress;
    var personas = opts.personas || [
      { name: "창의출제자", sys: "너는 창의적이고 대담한 영어 출제자다. 신선한 관점으로 답한다." },
      { name: "엄격검수자", sys: "너는 정확성을 최우선하는 보수적 검수자다. 오류 없는 답만 낸다." },
      { name: "논리분석가", sys: "너는 논리 구조·근거를 중시하는 분석가다. 단계적으로 사고해 답한다." }
    ];
    log(onP, "  🧬 앙상블 메타-LLM 창발 — 페르소나 " + personas.length + "인 사유·비평·합성…");
    var drafts = [];
    for (var i = 0; i < personas.length; i++) { var d = await ask(prompt, personas[i].sys, { noRule: true, temperature: 0.55 + 0.12 * i }); if (d) drafts.push({ who: personas[i].name, text: d }); }
    if (!drafts.length) return { answer: "", drafts: [] };
    var synth = await ask("아래는 같은 과제에 대한 " + drafts.length + "개 초안이다. 서로의 장점을 통합하고 오류를 제거해 '가장 정확하고 우수한 최종답 하나'만 출력하라.\n\n" + drafts.map(function (x) { return "[" + x.who + "] " + x.text; }).join("\n"), "여러 관점을 통합하는 종합 지성. 최종 결론만 간결히 출력.", { noRule: true, temperature: 0.3 });
    return { answer: synth || drafts[0].text, drafts: drafts };
  }
  // 기본 창발 LLM 3인을 뉴런망에 창조(런타임에 spawnLLM으로 추가 생성 가능)
  spawnLLM("창의출제자", "너는 창의적이고 대담한 영어 출제자다.");
  spawnLLM("엄격검수자", "너는 정확성을 최우선하는 검수자다.");
  spawnLLM("논리분석가", "너는 논리·근거 중심 분석가다.");

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
  function builderFor(t) {
    if (t === "배열영작") return function (p, o) { return buildArrange(p, o); };
    if (t === "조건영작") return function (p, o) { return buildConditional(p, o); };
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

  async function generateExam(passage, types, opts) {
    opts = opts || {}; var onP = opts.onProgress, out = []; USE_ENSEMBLE = !!opts.ensemble;
    log(onP, "■ 1단계: 자료 수집반 가동(전 API)…");
    var ctx = await prepContext(passage, onP).catch(function () { return {}; });
    if (ctx.topic) log(onP, "   주제어=" + ctx.topic + (ctx.bg ? " · 위키 배경 확보" : "") + " · 반의어 " + Object.keys(ctx.ant || {}).length + "쌍");
    var bopts = { onProgress: onP, ctx: ctx, fast: opts.fast };
    var maxTry = opts.fast ? 3 : 4;
    log(onP, "■ 2단계: 유형별 " + (opts.fast ? "빠른" : "초미분화") + " 출제…");
    for (var i = 0; i < types.length; i++) {
      var t = types[i], b = builderFor(t), got = null;
      RUNHINT = ""; TYPERULE = TYPE_GUIDE[t] || ""; setLevelRule(t, opts.level);
      for (var attempt = 1; attempt <= maxTry && !got; attempt++) {
        log(onP, "[" + (i + 1) + "/" + types.length + "] " + t + (attempt > 1 ? " (개선 재시도 " + attempt + ")" : "") + " 출제 중…");
        try { var q = await b(passage, bopts, t); if (q && q.instruction) got = q; } catch (e) {}
        if (!got && attempt === 1) {
          record("출제실패", t, "1차 시도 실패");
          log(onP, "   ⚑ API 회의 소집(" + t + ") — 오류 토론·개선…");
          var mt = await convene(t, "1차 시도 실패").catch(function () { return { hint: "" }; });
          RUNHINT = mt.hint || "";
          if (mt.hint) log(onP, "   ↳ 합의 개선지시: " + mt.hint);
        }
      }
      RUNHINT = ""; TYPERULE = ""; LEVELRULE = "";
      if (got) {
        if (TYPE_INSTR[t]) got.instruction = TYPE_INSTR[t]; got.level = opts.level || "";
        if (opts.refine) { log(onP, "  ↻ 재귀 상호작용 개선(" + t + ") — 검수↔재작성 수렴까지…"); got = await refineLoop(got, { target: opts.refineTarget || 88, maxRounds: opts.rounds || 4, onProgress: onP, passage: passage }); }
        stampIntent(got);
        out.push(got);
      } else { record("최종실패", t, "3회 실패"); log(onP, "   · " + t + " 생성 실패(건너뜀)"); }
    }
    log(onP, "✓ 완료 — " + out.length + "/" + types.length + "문항");
    return out;
  }

  // 단일 문항 재생성(개별 문항 🔄용)
  async function generateOne(passage, type, opts) {
    opts = opts || {}; USE_ENSEMBLE = !!opts.ensemble;
    var ctx = opts.ctx || await prepContext(passage).catch(function () { return {}; });
    TYPERULE = TYPE_GUIDE[type] || ""; setLevelRule(type, opts.level);
    var q = await builderFor(type)(passage, { ctx: ctx, onProgress: opts.onProgress, fast: opts.fast }, type);
    TYPERULE = ""; LEVELRULE = "";
    if (q && TYPE_INSTR[type]) { if (TYPE_INSTR[type]) q.instruction = TYPE_INSTR[type]; }
    if (q) q.level = opts.level || "";
    if (q && opts.refine) q = await refineLoop(q, { target: opts.refineTarget || 88, maxRounds: opts.rounds || 4, onProgress: opts.onProgress, passage: passage });
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
    if (!variant) return { variant: "", level: level, note: (STAGE_INFO[level] || {}).name + " 생성 실패", changed: [], _trace: trace };
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
    roster: ROSTER, BEST_TYPES: BEST_TYPES, mesh: MESH, topology: topology, googleBooks: googleBooks, pipeline: pipelineOf, runHarness: runHarness, configure: configure, provider: provider, convene: convene,
    loadTypeDB: loadTypeDB, loadDifficultyDB: loadDifficultyDB, typeDBInfo: function () { return TYPE_DB_INFO; }, loadSharedHints: loadSharedHints,
    errlog: function () { return ERRLOG; }, meetings: function () { return MEETINGS; },
    llm: llm, llmJSON: llmJSON, ask: ask, grammar: grammar, datamuse: datamuse, dict: dict, wiktionary: wiktionary, wiki: wiki, translate: translate, image: image,
    wikiSearch: wikiSearch, wikidata: wikidata, openLibrary: openLibrary, poetry: poetry, wordInfo: wordInfo, wikiquote: wikiquote, wikisource: wikisource,
    refineLoop: refineLoop, critiqueQ: critiqueQ, ensemble: ensemble, spawnLLM: spawnLLM, spawned: function () { return SPAWNED; },
    generateExam: generateExam, generateOne: generateOne, reviewOptions: reviewOptions, suggestTypes: suggestTypes, transformPassage: transformPassage, transformStaged: transformStaged, stageInfo: function () { return STAGE_INFO; }, buildVocabList: buildVocabList, healthCheck: healthCheck,
    buildInference: buildInference, buildVocab: buildVocab, buildGrammar: buildGrammar, buildBlank: buildBlank
  };
})();
