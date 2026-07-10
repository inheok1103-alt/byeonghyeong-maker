/* 스위트 파이프라인 — 한 지문 → 분석지+전유형(문제지·동형모고·워크북 데이터) → 형식 전수검사(format_audit).
   규격: knowledge/output_formats.md. 사용: node selfllm/suite_harness.js <지문파일> [out.json] [level] */
var fs = require("fs"), path = require("path"), cp = require("child_process");
global.window = {};
var rf = global.fetch;
global.fetch = function (u, o) { u = String(u);
  if (u.indexOf("types_v2.json") >= 0) { var d = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/types_v2.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); }
  if (u.indexOf("intent_db.json") >= 0) { try { var d2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/intent_db.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d2); } }); } catch (e) {} }
  return rf(u, o); };
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8"));
var T = global.window.APITEAM;

var TYPES = ["요지", "주제", "제목", "필자주장", "밑줄함의", "어법", "어휘", "빈칸", "글의순서", "문장삽입", "무관문장", "내용일치", "요약문AB", "어법수정", "서술형", "전체문장배열"];

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) {}
  var pg = fs.readFileSync(process.argv[2] || path.join(__dirname, "pg_expl.txt"), "utf8").trim();
  var outFile = process.argv[3] || path.join(__dirname, "_suite.json");
  var level = process.argv[4] || "상";
  var t0 = Date.now();
  console.error("① 분석지…");
  var analysis = null; try { analysis = await T.analysisSheet(pg, {}); } catch (e) {}
  console.error("  " + (analysis ? ("OK 성분 " + (analysis.components || []).length + "/" + (analysis.sents || []).length) : "실패"));
  console.error("② 전 유형 생성(키가드·정답분산·Rx·워크북 스탬프)…");
  var items = await T.generateExam(pg, TYPES, { level: level, onType: function (t, ev) { if (ev === "done" || ev === "fail") console.error("  · " + t + " " + ev); } });
  // 누락 유형 1회 보충
  var haveT = {}; items.forEach(function (q) { haveT[q.type] = 1; });
  var alias = { "밑줄함의": "함의" };
  for (var i = 0; i < TYPES.length; i++) {
    var t = TYPES[i], key = alias[t] || t;
    if (haveT[key] || haveT[t]) continue;
    var q = await T.generateOne(pg, t, { level: level }).catch(function () { return null; });
    if (q) { items.push(q); console.error("  ↺ " + t + " 보충"); }
  }
  T.rebalanceAnswers(items); items.forEach(function (q) { delete q._work; T.stampWork(q); });   // 보충 후 재분산·재스탬프
  var suite = { passage: pg, level: level, ms: Date.now() - t0, analysis: analysis, items: items };
  fs.writeFileSync(outFile, JSON.stringify(suite, null, 1));
  console.error("WROTE " + outFile + " — 문항 " + items.length + "/" + TYPES.length + " · " + Math.round((Date.now() - t0) / 1000) + "s");
  console.error("③ 형식 전수검사(format_audit)…");
  try { console.error(cp.execSync("node \"" + path.join(__dirname, "format_audit.js") + "\" \"" + outFile + "\"", { encoding: "utf8" })); }
  catch (e) { console.error(e.stdout || e.message); process.exit(1); }
})().catch(function (e) { console.error("SUITE_ERR", (e && e.stack || e).toString().slice(0, 500)); process.exit(1); });
