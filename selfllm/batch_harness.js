/* 배치 하네스 — 실제 api_team.generateOne을 여러 유형에 걸쳐 1프로세스로 돌려 실물 출력 수집.
   실전기출 보정리포트(Ray_Drill_실전추출) 대비 비교용 ground-truth 생성.
   사용: node selfllm/batch_harness.js [out.json]  (기본: selfllm/_batch_out.json) */
var fs = require("fs"), path = require("path");
global.window = {};
var realFetch = global.fetch;
global.fetch = function (url, opts) {
  var u = String(url);
  if (u.indexOf("types_v2.json") >= 0) { var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/types_v2.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(data); } }); }
  if (u.indexOf("intent_db.json") >= 0) { try { var d2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/intent_db.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d2); } }); } catch (e) {} }
  return realFetch(url, opts);
};
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
try { eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8")); } catch (e) { console.error("guard 경고:", e.message); }
var T = global.window.APITEAM;
if (!T) { console.error("APITEAM 미노출"); process.exit(1); }

// 실전기출 보정 리포트의 타입 → 엔진 유형명 + 적합 지문 + 목표 난이도
var PLAN = [
  { real: "contextual_vocabulary",         type: "어휘(밑줄)",     pg: "pg_arg.txt",    lv: "상" },
  { real: "blank_logic",                   type: "빈칸(어구)",     pg: "pg_expl.txt",   lv: "상" },
  { real: "grammar_underlined",            type: "어법(밑줄)",     pg: "pg_arg.txt",    lv: "상" },
  { real: "implied_meaning",               type: "밑줄함의",       pg: "pg_arg.txt",    lv: "상" },
  { real: "subjective_topic_sentence",     type: "주제문완성",     pg: "pg_expl.txt",   lv: "중" },
  { real: "paragraph_order",               type: "글의순서",       pg: "pg_narr.txt",   lv: "중" },
  { real: "main_idea",                     type: "요지",           pg: "pg_arg.txt",    lv: "중" },
  { real: "detail_true_false",             type: "내용일치",       pg: "pg_bio.txt",    lv: "중" },
  { real: "irrelevant_sentence",           type: "무관문장",       pg: "pg_expl.txt",   lv: "중" },
  { real: "title",                         type: "제목",           pg: "pg_expl.txt",   lv: "중" },
  { real: "summary_completion",            type: "요약문AB",       pg: "pg_expl.txt",   lv: "상" },
  { real: "grammar_correction_subjective", type: "어법수정",       pg: "pg_arg.txt",    lv: "중" },
  { real: "sentence_insertion",            type: "문장삽입",       pg: "pg_narr.txt",   lv: "중" },
  { real: "all_sentence_order",            type: "전체문장배열",   pg: "pg_narr.txt",   lv: "중" }
];

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) { console.error("typeDB 실패:", e.message); }
  var out = [];
  for (var i = 0; i < PLAN.length; i++) {
    var p = PLAN[i];
    var pg = fs.readFileSync(path.join(__dirname, p.pg), "utf8").trim();
    var t0 = Date.now(), q = null, err = null;
    try { q = await T.generateOne(pg, p.type, { level: p.lv }); } catch (e) { err = (e && e.message || e).toString().slice(0, 200); }
    out.push({ real: p.real, type: p.type, lv: p.lv, pg: p.pg, ms: Date.now() - t0, ok: !!q, err: err, q: q });
    console.error("[" + (i + 1) + "/" + PLAN.length + "] " + p.real + " (" + p.type + ") " + (q ? "OK " + (Date.now() - t0) + "ms" : "FAIL " + (err || "null")));
  }
  var outFile = process.argv[2] || path.join(__dirname, "_batch_out.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.error("WROTE " + outFile + " (" + out.filter(function (x) { return x.ok; }).length + "/" + out.length + " ok)");
})().catch(function (e) { console.error("BATCH_ERR", (e && e.stack || e).toString().slice(0, 400)); process.exit(1); });
