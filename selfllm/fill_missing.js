/* 누락 유형 채우기 — 지정 유형을 재시도 생성해 세트에 병합.
   사용: node selfllm/fill_missing.js <set.json> <지문파일> <level> <유형1,유형2,...> */
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

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) {}
  var setFile = process.argv[2], pg = fs.readFileSync(process.argv[3], "utf8").trim(), level = process.argv[4] || "중";
  var types = (process.argv[5] || "").split(",").filter(Boolean);
  var set = JSON.parse(fs.readFileSync(setFile, "utf8"));
  for (var i = 0; i < types.length; i++) {
    var q = null;
    for (var r = 0; r < 3 && !q; r++) { try { q = await T.generateOne(pg, types[i], { level: level }); } catch (e) {} }
    if (q) { set.items.push(q); console.error("  ✓ " + types[i] + " 채움"); } else console.error("  ✗ " + types[i] + " 실패");
  }
  // 원 순서 정렬(요약/빈칸/어휘를 제자리로) — 지정 순서 우선
  var ORDER = ["요지","주제","제목","필자주장","함의","밑줄함의","어법","어휘","빈칸","글의순서","문장삽입","무관문장","내용일치","요약문AB","어법수정","서술형","전체문장배열"];
  set.items.sort(function (a, b) { var ia = ORDER.indexOf(a.type), ib = ORDER.indexOf(b.type); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  fs.writeFileSync(setFile, JSON.stringify(set, null, 1));
  console.error("WROTE " + setFile + " — 총 " + set.items.length + "문항");
})().catch(function (e) { console.error("FILL_ERR", (e && e.message || e)); process.exit(1); });
