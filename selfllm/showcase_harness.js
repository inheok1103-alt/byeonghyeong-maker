/* 쇼케이스 하네스 — 한 지문으로 분석지 + 전 유형 시험지를 함께 생성(시뮬레이션 데모용).
   사용: node selfllm/showcase_harness.js <지문파일> [out.json] [level] */
var fs = require("fs"), path = require("path");
global.window = {};
var rf = global.fetch;
global.fetch = function (u, o) { u = String(u);
  if (u.indexOf("types_v2.json") >= 0) { var d = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/types_v2.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); }
  if (u.indexOf("intent_db.json") >= 0) { try { var d2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/intent_db.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d2); } }); } catch (e) {} }
  return rf(u, o); };
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8"));
var T = global.window.APITEAM;
if (!T) { console.error("APITEAM 미노출"); process.exit(1); }

var TYPES = ["요지", "주제", "제목", "필자주장", "밑줄함의", "어법", "어휘", "빈칸", "글의순서", "문장삽입", "무관문장", "내용일치", "요약문AB", "어법수정", "서술형", "전체문장배열"];

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) {}
  var pg = fs.readFileSync(process.argv[2] || path.join(__dirname, "pg_arg.txt"), "utf8").trim();
  var outFile = process.argv[3] || path.join(__dirname, "_showcase.json");
  var level = process.argv[4] || "상";
  var t0 = Date.now();
  console.error("① 분석지 생성…");
  var analysis = null; try { analysis = await T.analysisSheet(pg, {}); } catch (e) { console.error("  분석지 실패:", e.message); }
  console.error("  분석지 " + (analysis ? "OK (문장 " + (analysis.sents || []).length + ", 어휘 " + (analysis.vocab || []).length + ")" : "실패"));
  console.error("② 전 유형 시험지 생성…");
  var items = await T.generateExam(pg, TYPES, { level: level, onType: function (t, ev) { if (ev === "done" || ev === "fail") console.error("  · " + t + " " + ev); } });
  var out = { passage: pg, level: level, ms: Date.now() - t0, analysis: analysis, items: items };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.error("WROTE " + outFile + " — 분석지" + (analysis ? "✓" : "✗") + " · 문항 " + items.length + "/" + TYPES.length + " · " + Math.round((Date.now() - t0) / 1000) + "s");
})().catch(function (e) { console.error("SHOWCASE_ERR", (e && e.stack || e).toString().slice(0, 500)); process.exit(1); });
