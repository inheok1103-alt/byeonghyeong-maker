/* 동화고 모드 하네스 — loadDonghwa+donghwaMode(true) 후 donghwaTypeSet으로 generateExam.
   실물 동화고 기말과 대조하기 위한 동화고형 세트 생성.
   사용: node selfllm/donghwa_harness.js <지문파일> <out.json> [level] */
var fs = require("fs"), path = require("path");
global.window = {};
var realFetch = global.fetch;
global.fetch = function (url, opts) {
  var u = String(url), map = {
    "types_v2.json": "../knowledge/types_v2.json",
    "donghwa_exam_logic.json": "../knowledge/donghwa_exam_logic.json",
    "exam_type_taxonomy.json": "../knowledge/exam_type_taxonomy.json",
    "donghwa_construction_recipes.json": "../knowledge/donghwa_construction_recipes.json",
    "examiner_kb_v1.json": "../knowledge/examiner_kb_v1.json",
    "review_core_v2.json": "../knowledge/review_core_v2.json"
  };
  for (var k in map) { if (map.hasOwnProperty(k) && u.indexOf(k) >= 0) { try { var d = JSON.parse(fs.readFileSync(path.join(__dirname, map[k]), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); } catch (e) { break; } } }
  return realFetch(url, opts);
};
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
try { eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8")); } catch (e) { console.error("guard 경고:", e.message); }
var T = global.window.APITEAM;
if (!T) { console.error("APITEAM 미노출"); process.exit(1); }

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); } catch (e) {}
  try { await T.loadExaminerKB("knowledge/examiner_kb_v1.json"); } catch (e) {}
  var dh = await T.loadDonghwa("knowledge/donghwa_exam_logic.json"); console.error("동화고 KB:", JSON.stringify(dh));
  await T.loadTaxonomy("knowledge/exam_type_taxonomy.json").catch(function () {});
  var rcs = await T.loadRecipes("knowledge/donghwa_construction_recipes.json").catch(function () { return {}; }); console.error("레시피:", JSON.stringify(rcs));
  T.donghwaMode(true); console.error("동화고 모드 ON · 유형세트:", T.donghwaTypeSet().join(","));
  var pgFile = process.argv[2], outFile = process.argv[3], level = process.argv[4] || "중";
  var pg = fs.readFileSync(pgFile, "utf8").trim();
  var TYPES = process.argv[5] ? String(process.argv[5]).split(",").map(function (s) { return s.trim(); }).filter(Boolean) : T.donghwaTypeSet();
  var t0 = Date.now();
  var items = await T.generateExam(pg, TYPES, { level: level, onType: function (t, ev) { if (ev === "done" || ev === "fail") console.error("  · " + t + " " + ev); } });
  var made = items.map(function (q) { return q && q.type; }).filter(Boolean);
  var out = { mode: "donghwa", passage: pg, level: level, count: items.length, requested: TYPES.length, skipped: TYPES.filter(function (t) { return made.indexOf(t) < 0; }), ms: Date.now() - t0, items: items };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.error("WROTE " + outFile + " — " + items.length + "/" + TYPES.length + " 문항, " + Math.round((Date.now() - t0) / 1000) + "s");
})().catch(function (e) { console.error("ERR", (e && e.stack || e).toString().slice(0, 400)); process.exit(1); });
