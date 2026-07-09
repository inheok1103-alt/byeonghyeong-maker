/* 엔진 완전 구동 하네스 — 브라우저 없이 실제 api_team.generateOne 경로(빌더+TYPERULE+위생+검증)를 실행.
   사용: node selfllm/engine_harness.js "<유형명>" [지문파일]   (기본 지문: selfllm/test_passage.txt)
   출력: JSON {q, ms} 또는 HARNESS_ERR */
var fs = require("fs"), path = require("path");
global.window = {};
var realFetch = global.fetch;
global.fetch = function (url, opts) {
  var u = String(url);
  if (u.indexOf("types_v2.json") >= 0) {
    var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/types_v2.json"), "utf8"));
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(data); } });
  }
  if (u.indexOf("intent_db.json") >= 0) {
    try { var d2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../knowledge/intent_db.json"), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d2); } }); } catch (e) { }
  }
  return realFetch(url, opts);
};
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
var T = global.window.APITEAM;
if (!T) { console.error("HARNESS_ERR APITEAM 미노출"); process.exit(1); }

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) { console.error("typeDB 로드 실패:", e.message); }
  var type = process.argv[2] || "전체문장배열";
  var pgFile = process.argv[3] || path.join(__dirname, "test_passage.txt");
  var pg = fs.readFileSync(pgFile, "utf8").trim();
  var t0 = Date.now();
  var q = await T.generateOne(pg, type, {});
  console.log(JSON.stringify({ ms: Date.now() - t0, q: q }, null, 1));
})().catch(function (e) { console.error("HARNESS_ERR", (e && e.stack || e).toString().slice(0, 400)); process.exit(1); });
