/* 쇼케이스 부분 패치 — 전수검사 지적사항만 재생성해 병합(풀 재생성 회피).
   ①분석 재생성(전문장 S/V/O/C/M 정규화·보강) ②필자주장 재생성(혼용붕괴·근접오답 게이트) ③어휘 Rx 재부착 */
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
  var setFile = process.argv[2] || path.join(__dirname, "_showcase3.json");
  var s = JSON.parse(fs.readFileSync(setFile, "utf8"));
  var pg = s.passage;

  // ① 분석 재생성(전 문장 성분)
  console.error("① 분석지 재생성…");
  var an = null; try { an = await T.analysisSheet(pg, {}); } catch (e) {}
  if (an && an.components && an.components.length) { s.analysis = an; console.error("  ✓ 성분 " + an.components.length + "/" + an.sents.length + "문장"); }
  else console.error("  ✗ 분석 재생성 실패(기존 유지)");

  // ② 필자주장 재생성(최대 3회 — 혼용붕괴 게이트는 엔진, 근접오답은 여기서 검사)
  console.error("② 필자주장 재생성…");
  var STOPW = { "의": 1, "을": 1, "를": 1, "이": 1, "가": 1, "은": 1, "는": 1, "한다": 1, "해야": 1 };
  function toks(x) { return String(x).toLowerCase().replace(/[^a-z가-힣0-9 ]/g, " ").split(/\s+/).filter(function (w) { return w.length >= 2 && !STOPW[w]; }); }
  function ovl(a, b) { var A = toks(a); if (!A.length) return 0; var B = {}; toks(b).forEach(function (w) { B[w] = 1; }); return A.filter(function (w) { return B[w]; }).length / A.length; }
  for (var r = 0; r < 3; r++) {
    var q = await T.generateOne(pg, "필자주장", { level: s.level || "상" }).catch(function () { return null; });
    if (!q) continue;
    var ans = q.choices[q.answer - 1], bad = false;
    q.choices.forEach(function (c, i) { if (i !== q.answer - 1 && Math.min(ovl(ans, c), ovl(c, ans)) >= 0.6) bad = true; });
    if (bad) { console.error("  · 재시도(근접오답)"); continue; }
    var idx = s.items.findIndex(function (x) { return x.type === "필자주장"; });
    if (idx >= 0) s.items[idx] = q; else s.items.push(q);
    console.error("  ✓ 교체 완료"); break;
  }

  // ③ 어휘 Rx 재부착(누락 문항 전부)
  console.error("③ 누락 Rx 재부착…");
  for (var i = 0; i < s.items.length; i++) {
    var it = s.items[i];
    if (it.choices && it.choices.length >= 4 && !/\[오답 진단·처방\]/.test(it.explanation || "")) {
      // generateOne 내부의 rxFeedback을 직접 쓸 수 없어(비노출) 동일 로직 인라인 호출 대신 재생성은 과함 → APITEAM에 노출된 경우만
      if (T.rxFeedback) { await T.rxFeedback(it, pg); console.error("  · " + it.type + " → " + (/\[오답 진단·처방\]/.test(it.explanation) ? "부착✓" : "실패")); }
    }
  }
  fs.writeFileSync(setFile, JSON.stringify(s, null, 1));
  console.error("WROTE " + setFile);
})().catch(function (e) { console.error("PATCH_ERR", (e && e.stack || e).toString().slice(0, 400)); process.exit(1); });
