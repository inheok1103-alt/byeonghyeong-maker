/* ===========================================================================
   Ray English — 출제의도 로직 하네스 (다중 API "토론" 파이프라인)
   각 무료 API가 ① 제안 → ② 서로 비평·수정 → ③ 합의(심판 통합) 하며
   문항을 (A)분류(스키마 메타데이터) 또는 (B)생성 한다. knowledge/intent_db.json 참조.

   실행:
     node selfllm/intent_harness.js --list
     node selfllm/intent_harness.js --online --classify "문항 텍스트..."
     node selfllm/intent_harness.js --online --generate 빈칸(어구) "영어 지문..."
   키(토론에 2개↑ 권장): 환경변수 GEMINI_KEY/GROQ_KEY/CEREBRAS_KEY/MISTRAL_KEY/OPENROUTER_KEY
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;

var realFetch = global.fetch ? global.fetch.bind(global) : null;
global.fetch = async function (url, init) {
  var u = String((url && url.url) || url);
  if (!/^https?:\/\//.test(u)) { var p = path.join(ROOT, u.split("?")[0]); if (!fs.existsSync(p)) return new Response("404", { status: 404 }); return new Response(fs.readFileSync(p, "utf8"), { status: 200 }); }
  if (!ONLINE) return new Response(JSON.stringify({ error: "offline" }), { status: 200 });
  return realFetch(u, init);
};
global.window = {};
require(ROOT + "/api_team.js"); var T = window.APITEAM;
var KEYS = { geminiKey: process.env.GEMINI_KEY || "", groqKey: process.env.GROQ_KEY || "", cerebrasKey: process.env.CEREBRAS_KEY || "", mistralKey: process.env.MISTRAL_KEY || "", openrouterKey: process.env.OPENROUTER_KEY || "" };
if (ONLINE) T.configure(KEYS);

var DB = JSON.parse(fs.readFileSync(ROOT + "/knowledge/intent_db.json", "utf8"));
var ALL = ["gemini", "groq", "cerebras", "mistral", "openrouter", "pollinations"];
function liveProviders() {
  if (!ONLINE) return [];
  var live = ALL.filter(function (p) { return p === "pollinations" || KEYS[p + "Key"]; });
  return live.length ? live : ["pollinations"];
}
function parseJSON(raw) { if (!raw) return null; var s = String(raw).replace(/```json/gi, "```").replace(/```/g, "").trim(); var a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }

/* 지식 요약(프롬프트 주입용) */
function logicBrief() { return DB.logic_rules.map(function (l) { return l.code + " " + l.name + "(" + l.core + ")"; }).join("; "); }
function errorBrief() { return DB.error_codes.map(function (e) { return e.code + " " + e.name; }).join("; "); }
var SCHEMA_KEYS = Object.keys(DB.schema);
var SYS = "너는 한국 고1 영어 내신 출제·분석 전문가다. 출제의도 로직(L01~L12)과 오답코드(E01~E20)를 알고, 정확한 JSON만 출력한다.";

/* ===================== 토론 엔진: 제안→비평→합의 ===================== */
async function propose(provider, userPrompt) {
  try { return parseJSON(await T.llmRaw([{ role: "system", content: SYS }, { role: "user", content: userPrompt }], { forceProvider: provider, json: true, temperature: 0.5, timeout: 60000 })); }
  catch (e) { return null; }
}
async function debate(userPromptFor, critiqueFor, synthFor) {
  var provs = liveProviders();
  log("① 제안 — " + provs.join(", "));
  var r1 = [];
  for (var i = 0; i < provs.length; i++) { var q = await propose(provs[i], userPromptFor()); if (q) r1.push({ by: provs[i], v: q }); }
  if (!r1.length) return { ok: false, why: "제안 없음(온라인/키 확인)" };
  if (r1.length === 1) return { ok: true, final: r1[0].v, rounds: { propose: r1 }, note: "제공자 1개 — 단독(토론 생략)" };
  log("② 토론 — 서로 비평·수정 (" + r1.length + "개 안)");
  var r2 = [];
  for (var j = 0; j < provs.length; j++) { var rev = await propose(provs[j], critiqueFor(r1)); if (rev) r2.push({ by: provs[j], v: rev }); }
  var pool = (r2.length ? r2 : r1);
  log("③ 합의 — 심판 통합");
  var judge = provs[0];
  var fin = await propose(judge, synthFor(pool));
  return { ok: !!fin, final: fin || pool[0].v, rounds: { propose: r1, critique: r2, judge: judge }, providers: provs };
}

/* ===================== (A) 문항 분류 ===================== */
async function classify(itemText) {
  var up = function () {
    return "[문항]\n" + itemText + "\n\n위 문항을 다음 스키마로 분류하라. logic_type은 " + logicBrief() +
      " 중 하나(코드). common_wrong_reasons는 " + errorBrief() + " 중 해당 코드들.\nJSON 키: " + SCHEMA_KEYS.join(", ") + "\nJSON만 출력.";
  };
  var crit = function (r1) {
    return "[문항]\n" + itemText + "\n\n[다른 분석가들의 분류]\n" + r1.map(function (x, i) { return (i + 1) + ") " + JSON.stringify(x.v); }).join("\n") +
      "\n\n이들의 오류(유형 오판·로직 오배정·오답코드 누락)를 지적하고, 네가 보기에 가장 정확한 분류를 같은 스키마 JSON으로 다시 출력하라.";
  };
  var synth = function (pool) {
    return "[문항]\n" + itemText + "\n\n[검토된 분류들]\n" + pool.map(function (x, i) { return (i + 1) + ") " + JSON.stringify(x.v); }).join("\n") +
      "\n\n합의로 가장 정확한 최종 분류 하나를 같은 스키마 JSON으로만 출력. type_surface·logic_type·trap_type·common_wrong_reasons를 특히 정확히.";
  };
  return debate(up, crit, synth);
}

/* ===================== (B) 문항 생성 ===================== */
function genTemplate(type) { var g = DB.gen_prompts.find(function (p) { return type.indexOf(p.type) >= 0 || p.type.indexOf(type) >= 0; }); return g ? g.template : ("'" + type + "' 유형의 정확한 변형문항을 JSON{instruction,passage,choices,answer,explanation}으로 만들라."); }
async function generate(passage, type) {
  var tmpl = genTemplate(type);
  var up = function () { return "[유형] " + type + "\n[지문]\n" + passage + "\n\n[생성 지침] " + tmpl + "\n정답 근거와 각 오답의 결함코드(E..)를 explanation에 넣어라. JSON만."; };
  var crit = function (r1) {
    return "[지문]\n" + passage + "\n\n[다른 출제자들의 '" + type + "' 문항 초안]\n" + r1.map(function (x, i) { return (i + 1) + ") " + JSON.stringify(x.v); }).join("\n") +
      "\n\n정답 정확성·오답 매력도·발문 명료성을 비평하고, 더 나은 문항을 같은 JSON으로 다시 출력하라.";
  };
  var synth = function (pool) {
    return "[지문]\n" + passage + "\n\n[검토된 초안들]\n" + pool.map(function (x, i) { return (i + 1) + ") " + JSON.stringify(x.v); }).join("\n") +
      "\n\n가장 정확·매력적인 최종 문항 하나로 통합해 JSON{instruction,passage,choices,answer,explanation}으로만 출력.";
  };
  // 기계형은 코드가 정답 보증(오프라인도 가능) → 토론은 표현/해설만 보강
  if (!ONLINE && /순서|삽입|연결어|첫글자/.test(type) && T.generateOne) {
    try { var q = await T.generateOne(passage, type, { fast: true, ctx: {} }); if (q) return { ok: true, final: q, note: "코드빌더(정답100%, 오프라인)" }; } catch (e) {}
  }
  return debate(up, crit, synth);
}

/* ===================== CLI ===================== */
var _logs = []; function log(m) { _logs.push(m); process.stdout.write("  · " + m + "\n"); }
(async () => {
  await T.loadTypeDB("knowledge/types_v2.json").catch(function () {});
  var a = process.argv;
  if (a.indexOf("--list") >= 0) {
    console.log("=== 출제의도 로직 DB ===");
    console.log("로직 " + DB.logic_rules.length + " · 오답코드 " + DB.error_codes.length + " · 예시항목 " + DB.items.length + " · 루브릭 " + DB.essay_rubrics.length + " · 생성프롬프트 " + DB.gen_prompts.length + " · 드릴 " + DB.drills.length);
    console.log("\n로직: " + DB.logic_rules.map(function (l) { return l.code; }).join(" "));
    console.log("오답: " + DB.error_codes.map(function (e) { return e.code; }).join(" "));
    console.log("살아있는 제공자(토론): " + (liveProviders().join(", ") || "없음(--online+키 필요)"));
    return;
  }
  var res, mode;
  var ci = a.indexOf("--classify"), gi = a.indexOf("--generate");
  if (ci >= 0) { mode = "분류"; res = await classify(a[ci + 1] || ""); }
  else if (gi >= 0) { mode = "생성"; res = await generate(a[gi + 2] || a[gi + 1] || "", a[gi + 1] || "빈칸(어구)"); }
  else { console.log("사용: --list | --online --classify \"문항\" | --online --generate 유형 \"지문\""); return; }
  console.log("\n===== " + mode + " 결과 =====");
  if (res && res.ok !== false) { console.log(JSON.stringify(res.final, null, 2)); if (res.note) console.log("(" + res.note + ")"); if (res.providers) console.log("토론 참여: " + res.providers.join(" + ")); }
  else { console.log("✗ " + (res && res.why || "실패") + " — --online 과 키(2개↑)를 확인하세요."); }
})();

module.exports = { classify: classify, generate: generate, DB: DB, liveProviders: liveProviders };
