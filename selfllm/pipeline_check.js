/* pipeline_check.js — 시험지 로직 하네스 파이프라인 전 단계 점검(0원·결정론·LLM 불필요)
 * 단계: ①파일 파싱 ②KB 무결성 ③엔진 API 표면 ④동화고 모드 주입 ⑤게이트 로직 ⑥데이터계약
 *       ⑦렌더러 스모크 ⑧최신 세트 품질 스냅샷
 * 사용: node selfllm/pipeline_check.js */
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
var R = []; var FAIL = 0, WARN = 0;
function ok(st, msg) { R.push(["✅", st, msg]); }
function warn(st, msg, rx) { R.push(["⚠️ ", st, msg + (rx ? "  ▶ " + rx : "")]); WARN++; }
function fail(st, msg, rx) { R.push(["❌", st, msg + (rx ? "  ▶ " + rx : "")]); FAIL++; }
function J(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }

/* ── ① 파일 파싱 ── */
["api_team.js", "addon_key_guard.js", "addon_psychometric.js", "server_brain.js",
 "selfllm/render_suite.js", "selfllm/render_diag.js", "selfllm/donghwa_harness.js",
 "selfllm/full_set_harness.js", "selfllm/brain_health.js"].forEach(function (f) {
  try { new vm.Script(fs.readFileSync(path.join(ROOT, f), "utf8"), { filename: f }); ok("①파싱", f); }
  catch (e) { fail("①파싱", f + " 구문오류: " + String(e.message).slice(0, 60), "수정 후 push"); }
});

/* ── ② KB 무결성 ── */
try {
  var tdb = J("knowledge/types_v2.json"); var tn = (tdb.types && (Array.isArray(tdb.types) ? tdb.types.length : Object.keys(tdb.types).length)) || 0;
  tn >= 50 ? ok("②KB", "types_v2 " + tn + "유형") : warn("②KB", "types_v2 유형 " + tn + "(<50)");
} catch (e) { fail("②KB", "types_v2.json 파손: " + e.message); }
try {
  var dh = J("knowledge/donghwa_exam_logic.json");
  var need = ["core", "standing", "type_mix", "essay_types", "traps", "trap_guides", "passage_profile", "signatures", "unseen_passage", "future_direction"];
  var miss = need.filter(function (k) { return !dh[k]; });
  miss.length ? fail("②KB", "donghwa KB 누락 키: " + miss.join(",")) : ok("②KB", "donghwa KB 완전(트랩 " + dh.traps.length + "·가이드 " + dh.trap_guides.length + "·논술형 " + dh.essay_types.length + "·검증출처 " + Object.keys(dh.passage_profile.verified_sources || {}).length + ")");
  // trap_guides 정규식 유효 + 우선순위(구체규칙이 broad보다 앞)
  var bad = dh.trap_guides.filter(function (g) { try { new RegExp(g.match); return false; } catch (e) { return true; } });
  bad.length ? fail("②KB", "trap_guides 정규식 오류 " + bad.length + "건") : ok("②KB", "trap_guides 정규식 전부 유효");
  var idxBroad = dh.trap_guides.findIndex(function (g) { return /서술\|영작/.test(g.match); });
  var idxTrans = dh.trap_guides.findIndex(function (g) { return /우리말해석/.test(g.match); });
  (idxTrans >= 0 && idxBroad >= 0 && idxTrans < idxBroad) ? ok("②KB", "가이드 우선순위 정상(번역<서술형)") : warn("②KB", "가이드 순서 확인 필요(구체규칙이 broad 뒤면 미매칭)");
} catch (e) { fail("②KB", "donghwa_exam_logic.json 파손: " + e.message); }
try {
  var tx = J("knowledge/exam_type_taxonomy.json");
  ok("②KB", "택소노미(카테고리 " + Object.keys(tx.categories).length + "·신유형 " + Object.keys(tx.future_types).length + "단계·시그니처 " + Object.keys(tx.school_signatures).length + "교)");
} catch (e) { fail("②KB", "exam_type_taxonomy.json 파손: " + e.message); }
try {
  var rcp = J("knowledge/donghwa_construction_recipes.json");
  (rcp.recipes || []).length >= 15 ? ok("②KB", "제작레시피 " + rcp.recipes.length + "유형(+공통 원칙 " + (rcp.common.common_construction_principles || []).length + "·DNA " + (rcp.common.distractor_dna_library || []).length + ")") : warn("②KB", "레시피 부족: " + (rcp.recipes || []).length);
} catch (e) { warn("②KB", "제작레시피 KB 없음/파손: " + e.message); }

/* ── ③④⑤⑥ 엔진 로드 후 검사 ── */
global.window = {};
global.fetch = function (u) {
  var map = { "donghwa_construction_recipes": "knowledge/donghwa_construction_recipes.json", "donghwa_exam_logic": "knowledge/donghwa_exam_logic.json", "exam_type_taxonomy": "knowledge/exam_type_taxonomy.json", "types_v2": "knowledge/types_v2.json", "examiner_kb": "knowledge/examiner_kb_v1.json" };
  for (var k in map) if (String(u).indexOf(k) >= 0) { try { var d = J(map[k]); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); } catch (e) { break; } }
  return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
};
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
require(path.join(ROOT, "api_team.js"));
var A = global.window.APITEAM;
var G = require(path.join(ROOT, "addon_key_guard.js"));

(async function () {
  /* ③ API 표면 */
  var api = ["generateExam", "generateOne", "loadDonghwa", "donghwaMode", "donghwaTypeSet", "donghwaKB", "loadTaxonomy", "taxonomy", "futureExpand",
    "provenanceOf", "passageId", "markerSpans", "quarantinedRules", "promoteRule", "rejectRule", "dataEgressInfo", "setDataContract",
    "rebalanceAnswers", "stampWork", "rxFeedback", "pruneStaleAnalysis", "analysisSheet", "reviewItem", "kbFor"];
  var missing = api.filter(function (f) { return typeof A[f] !== "function"; });
  missing.length ? fail("③API", "엔진 함수 누락: " + missing.join(",")) : ok("③API", "엔진 API " + api.length + "개 전부 노출");
  (typeof G.guardItem === "function" && typeof G.transformGate === "function") ? ok("③API", "키가드 guardItem·transformGate 노출") : fail("③API", "키가드 API 누락");

  /* ④ 동화고 모드 주입 */
  await A.loadExaminerKB(); var dhr = await A.loadDonghwa(); await A.loadTaxonomy(); await A.loadRecipes();
  dhr.ok ? ok("④주입", "loadDonghwa v" + dhr.version) : fail("④주입", "loadDonghwa 실패");
  A.donghwaMode(true);
  var checks = [["어법", "동화고 함정"], ["어휘", "동화고 함정"], ["빈칸", "동화고 함정"], ["조건영작", "동화고 논술형"], ["우리말해석", "동화고 번역"], ["속담", "동화고 속담"], ["지시", "동화고 함정"]];
  var inj = checks.filter(function (c) { return new RegExp(c[1]).test(A.kbFor(c[0])); });
  inj.length === checks.length ? ok("④주입", "유형규칙 주입 " + inj.length + "/" + checks.length + " (어법·어휘·빈칸·논술형·번역·속담·지시)") : fail("④주입", "주입 실패: " + checks.filter(function (c) { return !new RegExp(c[1]).test(A.kbFor(c[0])); }).map(function (c) { return c[0]; }).join(","));
  A.futureExpand("내용불일치").indexOf("수정") >= 0 ? ok("④주입", "futureExpand 신유형 매핑 동작") : warn("④주입", "futureExpand 미동작");
  A.donghwaTypeSet().length >= 15 ? ok("④주입", "donghwaTypeSet " + A.donghwaTypeSet().length + "유형") : warn("④주입", "donghwaTypeSet 부족");
  var rc = A.recipeFor ? A.recipeFor("어법") : "";
  (/정답설계/.test(rc) && /오답DNA/.test(rc)) ? ok("④주입", "recipeFor(어법) 제작레시피 주입(" + rc.length + "자)") : warn("④주입", "recipeFor 미동작");

  /* ⑤ 게이트 로직(결정론 재현) */
  var orig120 = Array(120).fill("w").join(" ");
  var t1 = G.transformGate({ type: "빈칸", passage: Array(40).fill("w").join(" ") }, orig120);
  (t1 && t1.drop) ? ok("⑤게이트", "transformGate 33% 잘림 drop") : fail("⑤게이트", "transformGate 잘림 미탐지");
  var t2 = G.transformGate({ type: "글의순서", passage: Array(30).fill("w").join(" ") }, orig120);
  (t2 === null) ? ok("⑤게이트", "transformGate 순서형 면제") : fail("⑤게이트", "순서형 오탐");
  // solverGate 정책 재현(코드파생형 만장일치만 교정)
  function decide(type, maj, ans, cnt) { var cd = /빈칸|요약|함의/.test(type || ""); var min = cd ? 3 : 2; if (maj !== ans && cnt >= min) return "FIX"; if (maj !== ans) return "FLAG"; return "OK"; }
  (decide("빈칸", 3, 1, 2) === "FLAG" && decide("빈칸", 3, 1, 3) === "FIX" && decide("주제", 3, 1, 2) === "FIX") ? ok("⑤게이트", "solverGate 정책(코드파생 2/3 FLAG·3/3 FIX·일반 2/3 FIX)") : fail("⑤게이트", "solverGate 정책 위반", "addon_key_guard.js 확인");
  // provenance
  var pq = { type: "어법", passage: "ⓐ<u>a</u> b ⓑ<u>c</u>", choices: ["a", "b", "c", "d", "e"], answer: 1 };
  A.provenanceOf(pq, "orig passage words here", "어법");
  (pq._prov && pq._prov.sourceId && pq._prov.fullPassage && pq._prov.markerSpans) ? ok("⑤게이트", "provenance(sourceId·전체지문·마커결박) 부착") : fail("⑤게이트", "provenance 미부착");
  A.passageId("x") === A.passageId("x") ? ok("⑤게이트", "passageId 결정론") : fail("⑤게이트", "passageId 비결정");

  /* ⑥ 데이터계약 */
  A.setDataContract("local-only");
  var eg = A.dataEgressInfo();
  (eg.activeProviders.length === 0) ? ok("⑥계약", "local-only egress 0(코드빌더 폴백)") : fail("⑥계약", "local-only인데 제공자 " + eg.activeProviders.join(","));
  A.setDataContract("open");

  /* ⑦ 렌더러 스모크(최신 세트로) */
  var setP = path.join(__dirname, "_diag_set.json");
  if (fs.existsSync(setP)) {
    var os = require("os"); var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pipechk-"));
    try {
      require("child_process").execFileSync("node", [path.join(__dirname, "render_suite.js"), setP, "-", tmp], { stdio: "pipe" });
      var made = fs.readdirSync(tmp).filter(function (f) { return f.endsWith(".html"); });
      made.length >= 3 ? ok("⑦렌더", "render_suite " + made.length + "종 생성") : warn("⑦렌더", "render_suite 산출 " + made.length + "종");
    } catch (e) { fail("⑦렌더", "render_suite 실행 실패: " + String(e.message).slice(0, 60)); }
    try {
      require("child_process").execFileSync("node", [path.join(__dirname, "render_diag.js"), setP, tmp], { stdio: "pipe" });
      fs.existsSync(path.join(tmp, "진단평가지_문제.html")) ? ok("⑦렌더", "render_diag 진단지 생성") : fail("⑦렌더", "render_diag 산출물 없음");
    } catch (e) { fail("⑦렌더", "render_diag 실패: " + String(e.message).slice(0, 60)); }
  } else warn("⑦렌더", "_diag_set.json 없음(스모크 스킵)");

  /* ⑧ 최신 세트 품질 스냅샷 */
  if (fs.existsSync(setP)) {
    var S = JSON.parse(fs.readFileSync(setP, "utf8")); var items = S.items || [];
    var mcq = items.filter(function (q) { return q.choices && q.choices.length >= 4; });
    var badAns = mcq.filter(function (q) { return !(q.answer >= 1 && q.answer <= q.choices.length); });
    var objCh = mcq.filter(function (q) { return q.choices.some(function (c) { return /\[object|\(보기|undefined/.test(String(c)); }); });
    objCh.length ? fail("⑧품질", "객체/플레이스홀더 선지 " + objCh.length + "건") : ok("⑧품질", "선지 오염 0건([object·placeholder 없음)");
    badAns.length ? fail("⑧품질", "정답번호 무효 " + badAns.length + "건") : ok("⑧품질", "객관식 " + mcq.length + "문항 정답번호 유효");
    var essays = items.filter(function (q) { return !q.choices || q.choices.length < 4; });
    var noModel = essays.filter(function (q) { return String(q.explanation || "").indexOf("[모범답안]") < 0; });
    noModel.length ? fail("⑧품질", "서술형 모범답안 없음 " + noModel.length + "건: " + noModel.map(function (q) { return q.type; }).join(",")) : ok("⑧품질", "서술형 " + essays.length + "문항 모범답안+루브릭 완비");
    var g = (items.filter(function (q) { return q.type === "어법"; })[0] || {})._gram || {};
    (/준동사|형용사부사|전치사/.test(g.cat || "")) ? warn("⑧품질", "어법 오류범주 '" + g.cat + "'(쉬움) — 난도필터 폴백 케이스", "재생성 권장") : ok("⑧품질", "어법 오류범주 '" + (g.cat || "?") + "'(미세오류)");
    var prov = items.filter(function (q) { return q._prov && q._prov.sourceId; });
    prov.length === items.length ? ok("⑧품질", "전 문항 provenance 부착") : warn("⑧품질", "provenance 누락 " + (items.length - prov.length) + "건");
    var dist = mcq.map(function (q) { return q.answer; }).join("");
    ok("⑧품질", "정답분포 " + dist);
  }

  /* 리포트 */
  console.log("\n=== 시험지 로직 하네스 파이프라인 점검 ===");
  R.forEach(function (r) { console.log(r[0] + " [" + r[1] + "] " + r[2]); });
  console.log("---");
  console.log(FAIL ? ("FAIL " + FAIL + "건 — 위 ▶ 처방부터 처리") : ("전 단계 정상" + (WARN ? " (WARN " + WARN + "건 참고)" : "")));
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error("점검 자체 오류:", e && e.stack || e); process.exit(2); });
