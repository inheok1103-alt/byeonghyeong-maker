/* ===========================================================================
   Ray English — 시험지 → 출제의도 로직 생성·누적·학교별 정리
   시험지 텍스트를 넣으면 ① 문항 분리 → ② 각 문항 분류(로직/오답/트랩) →
   ③ knowledge/intent_store.json 에 누적(학교별) → ④ 학교별 통계 리포트.
   분류는 --online 시 다중 API 토론(intent_harness), 오프라인은 규칙기반 quick 분류.

   실행:
     node selfllm/exam_ingest.js --add "<시험지 텍스트>" --school 구리고 --year 2023 --exam 기말 [--online]
     node selfllm/exam_ingest.js --school 구리고        (그 학교 누적·통계)
     node selfllm/exam_ingest.js --list                 (전체 학교 요약)
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;
var STORE = ROOT + "/knowledge/intent_store.json";
var DB = JSON.parse(fs.readFileSync(ROOT + "/knowledge/intent_db.json", "utf8"));

function arg(f) { var i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; }
function load() { try { return JSON.parse(fs.readFileSync(STORE, "utf8")); } catch (e) { return { updated: "", total: 0, schools: {} }; } }
function stamp() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ""; } }

/* ---------- ① 문항 분리 ---------- */
function splitItems(text) {
  var t = String(text).replace(/\r/g, "");
  var parts = t.split(/\n(?=\s*\d{1,2}\s*[.)]\s)/);   // 줄머리 "12. " / "12) " 기준
  if (parts.length < 2) parts = t.split(/\n(?=\s*\[?\d{1,2}\]?\s*번)/);  // "12번"
  return parts.map(function (s) { return s.trim(); }).filter(function (s) { var m = s.match(/[A-Za-z]/g); return s.length > 20 && m && m.length > 15; });
}

/* ---------- ② 규칙기반 quick 분류(오프라인) ---------- */
var TYPEMAP = [
  [/순서로|이어질\s*글의\s*순서/, "글의 순서", "L05"],
  [/들어가기에\s*가장\s*적절한\s*곳|주어진\s*문장/, "문장 삽입", "L06"],
  [/빈칸.*연결|연결.*빈칸|\(A\).*\(B\)/, "연결어 빈칸", "L01"],
  [/빈칸에\s*들어갈/, "빈칸(어구)", "L04"],
  [/제목으로/, "제목", "L02"],
  [/주제로|요지로|필자가\s*주장/, "주제", "L03"],
  [/어법상|밑줄\s*친.*어법/, "어법(밑줄)", "L08"],
  [/낱말의\s*쓰임|어휘/, "어휘(밑줄)", "L09"],
  [/의미하는\s*바|함의|가리키는/, "함의(밑줄)", "L10"],
  [/일치하지\s*않는|불일치/, "내용 불일치", "L11"],
  [/일치하는/, "내용 일치", "L11"],
  [/요약문/, "요약문(A/B)", "L12"],
  [/무관한\s*문장|흐름과\s*무관/, "무관 문장", "L07"],
  [/영작|조건에\s*맞게/, "서술형(조건 영작)", "L08"]
];
function topErrorsFor(logic) {   // DB 예시에서 같은 로직의 흔한 오답코드
  var g = {}; DB.items.forEach(function (it) { if (it.logic_type === logic) (it.common_wrong_reasons || []).forEach(function (e) { g[e] = (g[e] || 0) + 1; }); });
  return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).slice(0, 3);
}
function drillsFor(logic) { var g = {}; DB.items.forEach(function (it) { if (it.logic_type === logic) (it.teaching_drill || []).forEach(function (d) { g[d] = (g[d] || 0) + 1; }); }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).slice(0, 2); }
function quickClassify(itemText, meta, no) {
  var type = "미분류", logic = "";
  for (var i = 0; i < TYPEMAP.length; i++) { if (TYPEMAP[i][0].test(itemText)) { type = TYPEMAP[i][1]; logic = TYPEMAP[i][2]; break; } }
  var lr = DB.logic_rules.find(function (l) { return l.code === logic; });
  return {
    exam_id: meta.school + "_" + meta.year + "_" + meta.exam, school: meta.school, year: +meta.year || 0, exam_name: meta.exam, item_no: no,
    score: (itemText.match(/\[(\d(?:\.\d)?)\s*점\]/) || [])[1] ? +(itemText.match(/\[(\d(?:\.\d)?)\s*점\]/)[1]) : null,
    type_surface: type, logic_type: logic + (lr ? ": " + lr.name : ""), intent_core: lr ? lr.core : "",
    trap_type: lr ? lr.test : "", common_wrong_reasons: topErrorsFor(logic), teaching_drill: drillsFor(logic),
    _method: "quick(규칙기반)", _stub: itemText.slice(0, 90).replace(/\n/g, " ")
  };
}

/* ---------- ③ 누적(학교별, 중복제거) ---------- */
function ingest(text, meta) {
  var store = load(), items = splitItems(text);
  var sch = store.schools[meta.school] || (store.schools[meta.school] = { items: [] });
  var added = 0;
  items.forEach(function (it, idx) {
    var m = quickClassify(it, meta, idx + 1);
    var sig = m.exam_id + "#" + m.item_no;
    if (sch.items.some(function (x) { return (x.exam_id + "#" + x.item_no) === sig; })) return;
    sch.items.push(m); added++;
  });
  store.updated = stamp(); store.total = Object.keys(store.schools).reduce(function (s, k) { return s + store.schools[k].items.length; }, 0);
  fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
  return { added: added, school: meta.school, schoolTotal: sch.items.length, grandTotal: store.total };
}

/* ---------- ④ 리포트 ---------- */
function stats(items) {
  function dist(field) { var g = {}; items.forEach(function (x) { var v = Array.isArray(x[field]) ? x[field] : [x[field]]; v.forEach(function (k) { if (k) g[k] = (g[k] || 0) + 1; }); }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).map(function (k) { return k + " " + g[k]; }); }
  return { 유형분포: dist("type_surface"), 로직분포: dist("logic_type"), 흔한오답: dist("common_wrong_reasons") };
}

(async () => {
  if (process.argv.indexOf("--list") >= 0) {
    var s = load(); console.log("=== 누적 시험지 로직 (갱신 " + s.updated + ") ===");
    console.log("총 " + s.total + "문항 · 학교 " + Object.keys(s.schools).length + "곳");
    Object.keys(s.schools).forEach(function (k) { console.log("· " + k + ": " + s.schools[k].items.length + "문항 — " + stats(s.schools[k].items).유형분포.slice(0, 4).join(", ")); });
    return;
  }
  var school = arg("--school");
  if (school && process.argv.indexOf("--add") < 0) {
    var st = load(), sc = st.schools[school];
    if (!sc) return console.log("'" + school + "' 누적 없음. 먼저 --add 로 시험지를 넣으세요.");
    console.log("=== " + school + " (" + sc.items.length + "문항) ===");
    var s = stats(sc.items);
    console.log("유형분포: " + s.유형분포.join(" · ") + "\n로직분포: " + s.로직분포.join(" · ") + "\n흔한오답: " + s.흔한오답.join(" · "));
    console.log("\n문항:"); sc.items.forEach(function (x) { console.log("  " + x.item_no + ". [" + x.type_surface + "/" + x.logic_type + "] " + (x._stub || "")); });
    return;
  }
  var text = arg("--add");
  if (!text) { console.log("사용: --add \"<시험지>\" --school 구리고 --year 2023 --exam 기말 [--online] | --school <이름> | --list"); return; }
  var meta = { school: school || "미상", year: arg("--year") || "", exam: arg("--exam") || "시험" };
  if (ONLINE) {
    try {
      var IH = require("./intent_harness.js"); var items = splitItems(text), store = load();
      var sch = store.schools[meta.school] || (store.schools[meta.school] = { items: [] });
      console.log("다중 API 토론 분류 " + items.length + "문항…");
      for (var i = 0; i < items.length; i++) { var r = await IH.classify(items[i]).catch(function () { return null; }); var m = (r && r.ok !== false) ? Object.assign({ exam_id: meta.school + "_" + meta.year + "_" + meta.exam, item_no: i + 1, _method: "debate" }, r.final) : quickClassify(items[i], meta, i + 1); var sig = (m.exam_id || "") + "#" + m.item_no; if (!sch.items.some(function (x) { return (x.exam_id + "#" + x.item_no) === sig; })) sch.items.push(m); }
      store.updated = stamp(); store.total = Object.keys(store.schools).reduce(function (s, k) { return s + store.schools[k].items.length; }, 0);
      fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
      return console.log("누적 완료(토론) · " + meta.school + " " + sch.items.length + "문항 · 전체 " + store.total);
    } catch (e) { console.log("온라인 분류 실패 → 규칙기반으로 진행: " + e.message); }
  }
  var res = ingest(text, meta);
  console.log("누적 완료(규칙기반) · " + res.school + " +" + res.added + " → " + res.schoolTotal + "문항 · 전체 " + res.grandTotal);
  console.log("리포트: node selfllm/exam_ingest.js --school " + res.school);
})();

module.exports = { ingest: ingest, splitItems: splitItems, quickClassify: quickClassify };
