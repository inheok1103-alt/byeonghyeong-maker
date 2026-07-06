/* ===========================================================================
   Ray English — 분야별 무료 신경다발(Mixture-of-Agents) 파이프라인 하네스
   여러 무료 모델을 "제안 → 집계(MoA) → 검증"으로 엮어 프론티어급에 근접.
   유형(분야)마다 전담 파이프라인을 갖고, 기계형은 코드가 정답 100% 보증.

   실행:
     node selfllm/neural_bundle.js --list                 (분야별 하네스 구성 보기)
     node selfllm/neural_bundle.js 글의순서 3              (해당 분야 파이프라인 1회 시연)
     node selfllm/neural_bundle.js --online 주제 3         (무료모델 앙상블 가동, 키 필요)
   키: 환경변수 GEMINI_KEY/GROQ_KEY/CEREBRAS_KEY/MISTRAL_KEY/OPENROUTER_KEY
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;
var prose = require("./prose.js");

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

var ALL_PROVIDERS = ["gemini", "groq", "cerebras", "mistral", "openrouter", "pollinations"];
var CIRC = ["①", "②", "③", "④", "⑤"];

/* ======================= 분야별 신경다발 하네스 정의 =======================
   mode:code     → 코드빌더가 정답까지 생성(앙상블 불필요, 오히려 더 정확)
   mode:ensemble → 무료모델 n개 제안 → 집계(MoA) → 검증. hint=분야 특화 지시.
   data          → 이 분야에 유리한 오픈 데이터셋(ingest_github.js가 채움)          */
var FIELDS = {
  "글의순서":   { mode: "code" },
  "문장삽입":   { mode: "code" },
  "연결어빈칸": { mode: "code" },
  "첫글자어휘": { mode: "code" },
  "빈칸(어구)": { mode: "ensemble", n: 3, choices: 5, data: "cloth", hint: "지문 핵심 논지가 걸리는 어구를 빈칸으로. 오답은 같은 품사·유사 난이도로 매력있게." },
  "어법(밑줄)": { mode: "ensemble", n: 3, choices: 5, hint: "밑줄 5곳 중 어법상 틀린 1곳. 수일치·시제·태·관계사·병렬 등 실제 오류 유형으로." },
  "어휘(밑줄)": { mode: "ensemble", n: 3, choices: 5, hint: "문맥상 낱말 쓰임이 부적절한 1곳. 반의어·유사어 함정." },
  "밑줄함의":   { mode: "ensemble", n: 3, choices: 5, hint: "밑줄 구절의 문맥적 함의를 묻기. 표면의미 오답을 매력적으로." },
  "주제":       { mode: "ensemble", n: 3, choices: 5, hint: "지문 전체를 아우르는 주제. 지엽·과대·과소 진술을 오답으로." },
  "제목":       { mode: "ensemble", n: 3, choices: 5, hint: "함축적이되 지문 전체를 대표하는 제목. 부분·비약 오답." },
  "요지":       { mode: "ensemble", n: 3, choices: 5, hint: "필자의 주장/요지 한국어 선지. 반대·지엽 오답." },
  "내용불일치": { mode: "ensemble", n: 3, choices: 5, hint: "지문 사실과 불일치하는 1개. 나머지는 지문 근거로 참." },
  "요약문AB":   { mode: "ensemble", n: 2, choices: 5, hint: "한 문장 요약의 (A)(B) 빈칸에 들어갈 낱말쌍. 패러프레이즈." },
  "무관문장":   { mode: "ensemble", n: 3, choices: 5, hint: "글의 흐름과 무관한 1문장. 표면 어휘는 겹치되 논지 이탈." }
};

/* ------- 무료 제안자(살아있는 것만) ------- */
function liveProviders() {
  if (!ONLINE) return [];
  var live = [];
  ALL_PROVIDERS.forEach(function (p) {
    if (p === "pollinations") { live.push(p); return; }   // 무키 폴백
    if (KEYS[p + "Key"]) live.push(p);
  });
  return live;
}

/* ------- 분야 특화 프롬프트(파이프라인 1단계: 제안) ------- */
function proposePrompt(passage, field, cfg) {
  var ch = cfg.choices || 5;
  // ExamLogic 체계: pi=정답 선지의 패러프레이즈 지수(PI0 원문~PI3 의미재진술), distractors=오답별 함정코드(의미 SM01~13/구문 SY01~07)+why_wrong
  var spec = /요약|해석|서술|영작/.test(field)
    ? '{"instruction":"발문(한국어)","passage":"조작된 지문(필요시)","choices":["①..","..."],"answer":정답번호(1~' + ch + '),"pi":"PI0|PI1|PI2|PI3","distractors":[{"n":오답번호,"trap":"SM01~SM13|SY01~SY07","why":"왜 틀렸는지 한 줄"}],"explanation":"정답근거+[변형지수]+[오답분석](한국어, 3문장↑)"}'
    : '{"instruction":"발문(한국어)","passage":"필요시 표시된 지문(밑줄·빈칸 등)","choices":["선지1",".."],"answer":정답번호(1~' + ch + '),"pi":"PI0|PI1|PI2|PI3","distractors":[{"n":오답번호,"trap":"SM01~SM13|SY01~SY07","why":"왜 틀렸는지 한 줄"}],"explanation":"정답근거+[변형지수]+[오답분석](한국어, 3문장↑)"}';
  var sys = "너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 반드시 정확한 정답과, 서로 다른 함정(의미 SM/구문 SY)을 하나씩 쓴 매력적 오답을 만든다. JSON만 출력.";
  var user = "[유형] " + field + "\n[분야 지침] " + (cfg.hint || "") + "\n[지문]\n" + passage +
    "\n\n위 지문으로 '" + field + "' " + ch + "지선다 변형문항 1개를 만들어라. 선지 " + ch + "개, 정답 1개. 각 오답엔 서로 다른 함정코드와 why를 붙여라.\nJSON 형식(이것만 출력):\n" + spec;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}
function parseQ(raw) {
  if (!raw) return null;
  var s = String(raw).replace(/```json/gi, "```").replace(/```/g, "").trim();
  var a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null;
  try { var q = JSON.parse(s.slice(a, b + 1)); if (q && q.instruction && q.choices && q.choices.length >= 3) { q.answer = parseInt(q.answer, 10) || 1; return q; } } catch (e) {}
  return null;
}

/* ------- 파이프라인 2단계: 집계(MoA) — 후보들을 심판모델이 최종 1개로 통합 ------- */
async function aggregate(passage, field, cands, providers) {
  if (cands.length === 1) return cands[0];
  var judge = providers[0] || "pollinations";
  var listed = cands.map(function (q, i) { return "후보" + (i + 1) + ": " + JSON.stringify(q); }).join("\n");
  var msgs = [
    { role: "system", content: "너는 내신 영어 출제 검수 심판이다. 여러 후보 문항 중 정답이 명백히 옳고 오답이 가장 매력적인 것을 골라, 필요하면 다듬어 최종 1개로 통합한다. JSON만 출력." },
    { role: "user", content: "[유형] " + field + "\n[지문]\n" + passage + "\n\n[후보들]\n" + listed + "\n\n가장 정확·매력적인 최종 문항 1개를 JSON으로만 출력(instruction,passage?,choices,answer,pi,distractors,explanation). pi(PI0~3)와 오답별 trap/why를 유지·보정하라." }
  ];
  try { var r = await T.llmRaw(msgs, { forceProvider: judge, json: true, temperature: 0.2, timeout: 60000 }); var q = parseQ(r); if (q) return q; } catch (e) {}
  return cands[0];   // 집계 실패 시 첫 후보
}

/* ------- 파이프라인 3단계: 검증(코드 + 앙상블 교차검수) ------- */
function codeSanity(q, cfg) {
  if (!q || !q.instruction || !q.choices) return false;
  if (q.choices.length < 3) return false;
  if (!(q.answer >= 1 && q.answer <= q.choices.length)) return false;
  if (new Set(q.choices.map(function (c) { return String(c).trim(); })).size !== q.choices.length) return false;   // 중복 선지 금지
  if (String(q.explanation || "").length < 20) return false;
  return true;
}
async function verify(q, passage, field, providers) {
  if (!codeSanity(q, FIELDS[field])) return { ok: false, why: "코드검증 실패(형식·정답범위·중복선지)" };
  if (T.reviewItem) {
    try { var rv = await T.reviewItem(q, q.passage || passage, {}); if (rv && /불가|오류|틀/.test(String(rv.verdict || "") + String(rv.reason || ""))) return { ok: false, why: "검수 반려: " + (rv.reason || rv.verdict) }; } catch (e) {}
  }
  return { ok: true };
}

/* ======================= 분야 실행(하네스 엔진) ======================= */
async function runField(passage, field) {
  var cfg = FIELDS[field]; if (!cfg) return { field: field, ok: false, why: "미정의 분야" };
  // 기계형: 코드빌더가 정답까지 생성(무료·오프라인·정답 100%)
  if (cfg.mode === "code") {
    try { var q = await T.generateOne(passage, field, { fast: true, ctx: {} }); if (q) { q.type = field; return { field: field, mode: "code", ok: true, q: q, team: ["code-builder"] }; } } catch (e) {}
    return { field: field, mode: "code", ok: false, why: "코드빌더 실패(지문 조건 불충족)" };
  }
  // 추론형: 무료 신경다발(MoA)
  var providers = liveProviders();
  if (!providers.length) return { field: field, mode: "ensemble", ok: false, why: "온라인 아님/무료키 없음 — 이 분야는 --online + 키 필요" };
  var use = providers.slice(0, cfg.n || 3);
  var cands = [];
  for (var i = 0; i < use.length; i++) {
    try { var r = await T.llmRaw(proposePrompt(passage, field, cfg), { forceProvider: use[i], json: true, temperature: 0.6, timeout: 60000 }); var q = parseQ(r); if (q) { q._by = use[i]; cands.push(q); } } catch (e) {}
  }
  if (!cands.length) return { field: field, mode: "ensemble", ok: false, why: "모든 제안자 무응답", team: use };
  var merged = await aggregate(passage, field, cands, use);
  var v = await verify(merged, passage, field, use);
  merged.type = field;
  return { field: field, mode: "ensemble", ok: v.ok, why: v.why, q: merged, team: use, proposals: cands.length };
}

/* ======================= CLI ======================= */
async function _cli() {
  await T.loadTypeDB("knowledge/types_v2.json").catch(function () {});
  if (ONLINE) { await T.loadReviewDB("knowledge/review_core_v2.json").catch(function () {}); await T.loadExaminerKB("knowledge/examiner_kb_v1.json").catch(function () {}); }

  if (process.argv.indexOf("--list") >= 0) {
    console.log("=== 분야별 신경다발 파이프라인 하네스 ===");
    Object.keys(FIELDS).forEach(function (f) { var c = FIELDS[f]; console.log("· " + f.padEnd(10) + " → " + (c.mode === "code" ? "코드빌더(정답100%·무료)" : "무료앙상블 " + (c.n || 3) + "제안→MoA집계→검증" + (c.data ? " [데이터:" + c.data + "]" : ""))); });
    console.log("\n무료 제안자 후보: " + ALL_PROVIDERS.join(", ") + "  (--online + 키로 활성)");
    console.log("현재 살아있는 제안자: " + (liveProviders().join(", ") || "없음(오프라인)"));
    return;
  }

  var args = process.argv.slice(2).filter(function (a) { return a !== "--online"; });
  var field = args[0] || "글의순서";
  var idx = parseInt(args[1], 10) || 0;
  var passages = prose.loadProse(ROOT, fs);
  var pg = passages[idx % passages.length];
  console.log("분야: " + field + " · 지문#" + idx + " (" + (pg.match(/[A-Za-z]+/g) || []).length + "단어)\n");
  var res = await runField(pg, field);
  if (res.ok) {
    var q = res.q;
    console.log("팀: " + (res.team || []).join("+") + (res.proposals ? " · 제안 " + res.proposals + "개→집계" : "") + " · 모드: " + res.mode + "\n");
    console.log("[발문] " + q.instruction);
    if (q.passage) console.log("[지문] " + String(q.passage).replace(/<\/?u>/g, "").slice(0, 200) + "…");
    (q.choices || []).forEach(function (c, i) { console.log((CIRC[i] || i + 1) + " " + c); });
    console.log("[정답] " + (CIRC[q.answer - 1] || q.answer));
    console.log("[해설] " + String(q.explanation || "").slice(0, 300));
  } else {
    console.log("✗ 생성 실패: " + res.why + (res.team ? " (팀: " + res.team.join("+") + ")" : ""));
  }
}
if (require.main === module) _cli();

module.exports = { FIELDS: FIELDS, runField: runField, liveProviders: liveProviders };
