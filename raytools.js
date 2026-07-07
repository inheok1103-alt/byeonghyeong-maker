/* ===========================================================================
   Ray English — 브라우저 통합 도구 (제작기 UI에 붙는 기능들)
   ① 시험지 누적(학교별, localStorage)  ② RAG 검색(Keyword/SQL/Graph)
   ③ 출제의도 로직(생성·해설 반영)
   knowledge/intent_db.json 을 로드해서 동작. window.RAYTOOLS 로 노출.
   =========================================================================== */
(function () {
  var DB = null, PASSAGES = null;
  var STORE_KEY = "ray_exam_store";

  async function loadDB() {
    if (DB) return DB;
    try { DB = await fetch("knowledge/intent_db.json?_t=" + Date.now()).then(function (r) { return r.json(); }); } catch (e) { DB = { logic_rules: [], error_codes: [], items: [], drills: [] }; }
    return DB;
  }
  async function passages() {
    if (PASSAGES) return PASSAGES;
    try { var p = await fetch("corpus/passage_db.json").then(function (r) { return r.json(); }); var arr = p.passages || p; PASSAGES = arr.map(function (x) { return typeof x === "string" ? x : (x.text || ""); }).filter(function (t) { return t && t.length > 40; }); } catch (e) { PASSAGES = []; }
    return PASSAGES;
  }

  /* ---------- ① 시험지 누적 ---------- */
  var TYPEMAP = [
    [/순서로|이어질\s*글의\s*순서/, "글의 순서", "L05"], [/들어가기에\s*가장\s*적절한\s*곳|주어진\s*문장/, "문장 삽입", "L06"],
    [/빈칸.*연결|연결.*빈칸|\(A\).*\(B\)/, "연결어 빈칸", "L01"], [/빈칸에\s*들어갈/, "빈칸(어구)", "L04"],
    [/제목으로/, "제목", "L02"], [/주제로|요지로|필자가\s*주장/, "주제", "L03"], [/어법상|어법/, "어법(밑줄)", "L08"],
    [/낱말의\s*쓰임|어휘/, "어휘(밑줄)", "L09"], [/의미하는\s*바|함의|가리키는/, "함의(밑줄)", "L10"],
    [/일치하지\s*않는|불일치/, "내용 불일치", "L11"], [/일치하는/, "내용 일치", "L11"], [/요약문/, "요약문(A/B)", "L12"],
    [/무관한\s*문장|흐름과\s*무관/, "무관 문장", "L07"], [/영작|조건에\s*맞게/, "서술형(조건 영작)", "L08"]
  ];
  function splitItems(text) {
    var t = String(text).replace(/\r/g, ""); var parts = t.split(/\n(?=\s*\d{1,2}\s*[.)]\s)/);
    return parts.map(function (s) { return s.trim(); }).filter(function (s) { var m = s.match(/[A-Za-z]/g); return s.length > 20 && m && m.length > 12; });
  }
  function coFrom(field, logic) { var g = {}; (DB.items || []).forEach(function (it) { if (it.logic_type === logic || (it.logic_type || "").indexOf(logic) === 0) (it[field] || []).forEach(function (e) { g[e] = (g[e] || 0) + 1; }); }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).slice(0, 3); }
  // PI(패러프레이즈 지수) 기본값: 로직별 전형값 — PI0 원문 그대로 · PI1 어휘치환 · PI2 구문전환 · PI3 의미재진술
  var PI_BY_LOGIC = { L01: "PI0", L05: "PI0", L06: "PI0", L08: "PI0", L09: "PI0", L07: "PI1", L11: "PI1", L03: "PI2", L04: "PI2", L02: "PI3", L10: "PI3", L12: "PI3" };
  function classify(itemText, meta, no) {
    var type = "미분류", logic = "";
    for (var i = 0; i < TYPEMAP.length; i++) { if (TYPEMAP[i][0].test(itemText)) { type = TYPEMAP[i][1]; logic = TYPEMAP[i][2]; break; } }
    var lr = (DB.logic_rules || []).find(function (l) { return l.code === logic; });
    var sc = (itemText.match(/\[(\d(?:\.\d)?)\s*점\]/) || [])[1];
    return { exam_id: meta.school + "_" + meta.year + "_" + meta.exam, school: meta.school, year: +meta.year || 0, exam_name: meta.exam, item_no: no,
      score: sc ? +sc : null, type_surface: type, logic_type: logic + (lr ? ": " + lr.name : ""), intent_core: lr ? lr.core : "",
      paraphrase_index: PI_BY_LOGIC[logic] || "PI1",
      trap_type: lr ? lr.test : "", semantic_trap_codes: coFrom("semantic_trap_codes", logic), syntactic_trap_codes: coFrom("syntactic_trap_codes", logic),
      common_wrong_reasons: coFrom("common_wrong_reasons", logic), teaching_drill: coFrom("teaching_drill", logic),
      stub: itemText.slice(0, 90).replace(/\n/g, " ") };
  }
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { schools: {} }; } catch (e) { return { schools: {} }; } }
  function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }
  async function examAdd(text, meta) {
    await loadDB(); var store = loadStore(), items = splitItems(text);
    var sch = store.schools[meta.school] || (store.schools[meta.school] = { items: [] }); var added = 0;
    items.forEach(function (it, i) { var m = classify(it, meta, i + 1); var sig = m.exam_id + "#" + m.item_no; if (!sch.items.some(function (x) { return (x.exam_id + "#" + x.item_no) === sig; })) { sch.items.push(m); added++; } });
    saveStore(store); return { added: added, school: meta.school, schoolTotal: sch.items.length, total: Object.keys(store.schools).reduce(function (a, k) { return a + store.schools[k].items.length; }, 0) };
  }
  function examReport(school) {
    var store = loadStore();
    function dist(items, field) { var g = {}; items.forEach(function (x) { var v = Array.isArray(x[field]) ? x[field] : [x[field]]; v.forEach(function (k) { if (k) g[k] = (g[k] || 0) + 1; }); }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).map(function (k) { return k + " " + g[k]; }); }
    if (school) { var sc = store.schools[school]; if (!sc) return null; return { school: school, n: sc.items.length, 유형분포: dist(sc.items, "type_surface"), 로직분포: dist(sc.items, "logic_type"), 변형지수: dist(sc.items, "paraphrase_index"), 함정분포: dist(sc.items, "semantic_trap_codes").concat(dist(sc.items, "syntactic_trap_codes")), 흔한오답: dist(sc.items, "common_wrong_reasons"), items: sc.items }; }
    return Object.keys(store.schools).map(function (k) { return { school: k, n: store.schools[k].items.length, 유형: dist(store.schools[k].items, "type_surface").slice(0, 4) }; });
  }

  /* ---------- ② RAG (Keyword/SQL/Graph) ---------- */
  async function ragKeyword(q, k) {
    var ps = await passages(); var ql = q.toLowerCase(), toks = ql.split(/\s+/).filter(function (w) { return w.length > 2; });
    return ps.map(function (p) { var pl = p.toLowerCase(), s = 0; if (pl.indexOf(ql) >= 0) s += 100; toks.forEach(function (t) { if (pl.indexOf(t) >= 0) s += 1; }); return { s: s, p: p }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, k || 5).map(function (x) { return { score: x.s, text: x.p.slice(0, 200) + "…" }; });
  }
  async function ragSQL(field) {
    await loadDB(); var items = DB.items || [];
    var g = {}; items.forEach(function (x) { var v = Array.isArray(x[field]) ? x[field] : [x[field]]; v.forEach(function (k) { if (k) g[k] = (g[k] || 0) + 1; }); });
    return Object.keys(g).map(function (k) { return { key: k, count: g[k], pct: +(g[k] / items.length * 100).toFixed(1) }; }).sort(function (a, b) { return b.count - a.count; });
  }
  async function ragGraph(node) {
    await loadDB(); node = String(node).toUpperCase(); var nb = { logic: {}, errors: {}, drills: {}, types: {}, traps: {} };
    (DB.items || []).forEach(function (it) {
      var L = it.logic_type || "", Es = it.common_wrong_reasons || [], Ds = it.teaching_drill || [], ty = it.type_surface;
      var Tr = (it.semantic_trap_codes || []).concat(it.syntactic_trap_codes || []);
      if (!(L.indexOf(node) === 0 || Es.indexOf(node) >= 0 || Ds.indexOf(node) >= 0 || Tr.indexOf(node) >= 0)) return;
      if (L && L.indexOf(node) !== 0) nb.logic[L] = (nb.logic[L] || 0) + 1;
      Es.forEach(function (e) { if (e !== node) nb.errors[e] = (nb.errors[e] || 0) + 1; }); Ds.forEach(function (d) { if (d !== node) nb.drills[d] = (nb.drills[d] || 0) + 1; });
      Tr.forEach(function (t) { if (t !== node) nb.traps[t] = (nb.traps[t] || 0) + 1; }); if (ty) nb.types[ty] = (nb.types[ty] || 0) + 1;
    });
    function nm(c) { var r = (DB.logic_rules || []).find(function (x) { return x.code === c; }) || (DB.error_codes || []).find(function (x) { return x.code === c; }) || (DB.drills || []).find(function (x) { return x.code === c; }) || (DB.semantic_traps || []).find(function (x) { return x.code === c; }) || (DB.syntactic_traps || []).find(function (x) { return x.code === c; }); return r ? (r.name || r.goal || "") : ""; }
    function top(o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return k + (nm(k) ? "(" + nm(k) + ")" : "") + "×" + o[k]; }); }
    return { node: node, name: nm(node), 오답: top(nb.errors), 함정: top(nb.traps), 드릴: top(nb.drills), 유형: top(nb.types) };
  }

  /* ---------- ③ 출제의도 로직 → 생성 힌트 ---------- */
  var TYPE2LOGIC = { "글의순서": "L05", "문장삽입": "L06", "연결어빈칸": "L01", "빈칸": "L04", "제목": "L02", "주제": "L03", "요지": "L03", "어법": "L08", "어휘": "L09", "함의": "L10", "내용불일치": "L11", "내용일치": "L11", "요약": "L12", "무관": "L07" };
  async function logicHint(type) {
    await loadDB();
    // 창의 서술형(CSR01~10): 서술형 계열이면 회전 배정 — 매번 다른 창의 과제(반박·관점전환·제목창작·연결복원…)
    if (/서술형|영작|창의/.test(type || "") && DB.creative_sr && DB.creative_sr.length) {
      var pick = DB.creative_sr[Math.floor(Math.random() * DB.creative_sr.length)];
      return "[창의 서술형 " + pick.code + " " + pick.name + "] 과제: " + pick.task + ". 조건: " + (pick.conditions || []).join(" · ") + ". 루브릭: " + (pick.rubric || []).map(function (r) { return r.c + " " + r.p + "점"; }).join(", ") + ". 흔한 감점: " + (pick.errors || []).join("·") + ". " + (pick.gen || "");
    }
    var code = null; Object.keys(TYPE2LOGIC).forEach(function (k) { if (type && type.indexOf(k) >= 0 && !code) code = TYPE2LOGIC[k]; });
    if (!code) return "";
    var lr = (DB.logic_rules || []).find(function (l) { return l.code === code; }); if (!lr) return "";
    var errs = coFrom2("common_wrong_reasons", code), sms = coFrom2("semantic_trap_codes", code), sys = coFrom2("syntactic_trap_codes", code);
    var pi = { L01: "PI0", L05: "PI0", L06: "PI0", L08: "PI0", L09: "PI0", L07: "PI1", L11: "PI1", L03: "PI2", L04: "PI2", L02: "PI3", L10: "PI3", L12: "PI3" }[code] || "PI1";
    return "[출제의도 " + code + " " + lr.name + "] " + lr.core + ". 검증: " + lr.test + ". 정답 선지는 " + pi + " 수준 패러프레이즈, 각 오답은 서로 다른 함정코드(" + (sms.concat(sys).join("·") || "SM01·SM02") + " 등 의미SM/구문SY)를 하나씩 쓰고, 해설에 [변형지수 " + pi + "]와 [오답분석] ①코드-왜 틀림 형식을 명시.";
  }
  function coFrom2(field, logic) { var g = {}; (DB.items || []).forEach(function (it) { if ((it.logic_type || "").indexOf(logic) === 0) (it[field] || []).forEach(function (e) { g[e] = (g[e] || 0) + 1; }); }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).slice(0, 3); }

  window.RAYTOOLS = {
    loadDB: loadDB, examAdd: examAdd, examReport: examReport, splitItems: splitItems,
    ragKeyword: ragKeyword, ragSQL: ragSQL, ragGraph: ragGraph, logicHint: logicHint,
    schools: function () { return Object.keys(loadStore().schools); }
  };
})();
