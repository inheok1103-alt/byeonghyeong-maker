/* 전 과정 하네스 — 한 지문으로 generateExam(빌더→키가드→유일성→정답분산→stampWork) 전 파이프라인 실행.
   사용: node selfllm/full_set_harness.js <지문파일> [out.json] [level]  */
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
try { eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8")); } catch (e) { console.error("guard 경고:", e.message); }   // 키가드 장착(전 과정)
var T = global.window.APITEAM;
if (!T) { console.error("APITEAM 미노출"); process.exit(1); }

// 한 지문 세트: 실전 수능 유형 순서에 가깝게
var TYPES = ["요지", "주제", "제목", "필자주장", "밑줄함의", "어법", "어휘", "빈칸", "글의순서", "문장삽입", "무관문장", "내용일치", "요약문AB", "어법수정", "서술형", "전체문장배열"];

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) { console.error("typeDB 실패:", e.message); }
  var pgFile = process.argv[2] || path.join(__dirname, "pg_expl.txt");
  var outFile = process.argv[3] || path.join(__dirname, "_full_set.json");
  var level = process.argv[4] || "중";
  var pg = fs.readFileSync(pgFile, "utf8").trim();
  var t0 = Date.now();
  var items = await T.generateExam(pg, TYPES, { level: level, onType: function (t, ev) { if (ev === "done" || ev === "fail") console.error("  · " + t + " " + ev); } });
  var ans = items.filter(function (q) { return q && q.choices && q.choices.length >= 4 && q.answer >= 1; }).map(function (q) { return q.answer; });
  var out = { passage: pg, level: level, count: items.length, requested: TYPES.length, ms: Date.now() - t0, answerDist: ans.join(""), items: items };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.error("WROTE " + outFile + " — " + items.length + "/" + TYPES.length + " 문항, " + Math.round((Date.now() - t0) / 1000) + "s, 정답분포=" + ans.join(""));
})().catch(function (e) { console.error("SET_ERR", (e && e.stack || e).toString().slice(0, 500)); process.exit(1); });
