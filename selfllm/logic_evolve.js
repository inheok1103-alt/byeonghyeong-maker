/* ===========================================================================
   Ray English — 로직 진화 하네스 (배운 로직을 개발·개선·발전)
   대상: knowledge/intent_db.json 의 로직 자산(L01~12 · E01~20 · SM/SY · PI · 드릴 · 생성프롬프트)

   파이프라인:  ①수집(누적 시험지·DB 사용통계) → ②감사(빈틈·불균형 탐지)
             → ③제안(온라인: 다중 API 토론으로 신규 함정·드릴·프롬프트 초안)
             → ④검증(스키마·중복·참조 무결성) → ⑤스테이징(proposals — 승인 전 원본 불변)
             → ⑥승격(--promote i: 검토 후 intent_db에 정식 반영 + 버전업)

   실행:
     node selfllm/logic_evolve.js                 (오프라인 감사 + 리포트 + 갭 스테이징)
     node selfllm/logic_evolve.js --online        (+ 다중 API 토론 제안 생성)
     node selfllm/logic_evolve.js --list          (스테이징된 제안 목록)
     node selfllm/logic_evolve.js --promote 2     (제안 2번을 intent_db에 정식 반영)
   산출: knowledge/logic_proposals.json(스테이징) · knowledge/logic_evolve_log.json(회차 기록)
   원칙: 자동으로 원본 로직을 바꾸지 않는다(모델 승격게이트와 동일 — 사람 승인 후 반영).
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;
var DBP = ROOT + "/knowledge/intent_db.json";
var PROPP = ROOT + "/knowledge/logic_proposals.json";
var LOGP = ROOT + "/knowledge/logic_evolve_log.json";

var realFetch = global.fetch ? global.fetch.bind(global) : null;
global.fetch = async function (url, init) {
  var u = String((url && url.url) || url);
  if (!/^https?:\/\//.test(u)) { var p = path.join(ROOT, u.split("?")[0]); if (!fs.existsSync(p)) return new Response("404", { status: 404 }); return new Response(fs.readFileSync(p, "utf8"), { status: 200 }); }
  if (!ONLINE) return new Response(JSON.stringify({ error: "offline" }), { status: 200 });
  return realFetch(u, init);
};
global.window = {};
require(ROOT + "/api_team.js"); var T = window.APITEAM;
if (ONLINE) T.configure({ geminiKey: process.env.GEMINI_KEY || "", groqKey: process.env.GROQ_KEY || "", cerebrasKey: process.env.CEREBRAS_KEY || "", mistralKey: process.env.MISTRAL_KEY || "", proxyUrl: process.env.RAY_PROXY || "https://ray-proxy.gen1103.workers.dev" });

function load(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } }
function save(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 1)); }
function stamp() { try { return new Date().toISOString().slice(0, 16).replace("T", " "); } catch (e) { return ""; } }
function parseJSON(raw) { if (!raw) return null; var s = String(raw).replace(/```json/gi, "```").replace(/```/g, "").trim(); var a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }

/* ── ① 수집: DB + 누적 시험지(intent_store) 사용 통계 ── */
function usage(db, store) {
  var items = db.items.slice();
  Object.keys((store && store.schools) || {}).forEach(function (k) { items = items.concat(store.schools[k].items || []); });
  function cnt(field) { var g = {}; items.forEach(function (x) { var v = x[field]; (Array.isArray(v) ? v : [v]).forEach(function (c) { if (c) { c = String(c).split(":")[0].trim(); g[c] = (g[c] || 0) + 1; } }); }); return g; }
  return { n: items.length, L: cnt("logic_type"), E: cnt("common_wrong_reasons"), D: cnt("teaching_drill"), PI: cnt("paraphrase_index"),
    SM: cnt("semantic_trap_codes"), SY: cnt("syntactic_trap_codes"), TYPE: cnt("type_surface") };
}

/* ── ② 감사: 빈틈·불균형 ── */
function audit(db, u) {
  var gaps = [];
  db.logic_rules.forEach(function (l) { var c = u.L[l.code] || 0; if (c < 2) gaps.push({ kind: "로직 예시 부족", code: l.code, name: l.name, count: c, need: "이 로직의 실제 문항 예시를 items/시험지 누적으로 " + (2 - c) + "개 이상 보강" }); });
  db.error_codes.forEach(function (e) { if (!u.E[e.code]) gaps.push({ kind: "미사용 오답코드", code: e.code, name: e.name, count: 0, need: "이 오류를 유발하는 함정 설계·드릴 연결 예시 필요" }); });
  (db.semantic_traps || []).forEach(function (t) { if (!u.SM[t.code]) gaps.push({ kind: "미사용 의미함정", code: t.code, name: t.name, count: 0, need: "이 함정을 쓰는 오답 설계 예시(distractor_analysis) 필요" }); });
  (db.syntactic_traps || []).forEach(function (t) { if (!u.SY[t.code]) gaps.push({ kind: "미사용 구문함정", code: t.code, name: t.name, count: 0, need: "이 함정을 쓰는 오답 설계 예시 필요" }); });
  (db.drills || []).forEach(function (d) { if (!u.D[d.code]) gaps.push({ kind: "미연결 드릴", code: d.code, name: d.goal, count: 0, need: "이 드릴을 처방하는 문항 예시/오답코드 연결 필요" }); });
  var tot = Object.values(u.PI).reduce(function (a, b) { return a + b; }, 0) || 1;
  ["PI0", "PI1", "PI2", "PI3"].forEach(function (p) { var r = (u.PI[p] || 0) / tot; if (r < 0.08) gaps.push({ kind: "PI 불균형", code: p, name: "변형지수 " + p, count: u.PI[p] || 0, need: "전체의 " + Math.round(r * 100) + "%뿐 — 이 변형 수준의 문항·생성규칙 보강" }); });
  Object.keys(u.TYPE).forEach(function (ty) { var has = db.gen_prompts.some(function (g) { return ty.indexOf(g.type.split("(")[0].slice(0, 2)) >= 0 || g.type.indexOf(ty.slice(0, 2)) >= 0; }); if (!has && u.TYPE[ty] >= 2) gaps.push({ kind: "생성프롬프트 부재", code: ty, name: ty, count: u.TYPE[ty], need: "이 유형 전용 gen_prompt(함정·PI 지시 포함) 신설" }); });
  return gaps;
}

/* ── ③ 제안(온라인): 다중 API가 갭을 놓고 초안→비평→통합 ── */
async function propose(db, gaps) {
  var provs = ["groq", "mistral", "cerebras"].filter(function (p) { return process.env[p.toUpperCase() + "_KEY"]; });
  if (!provs.length) provs = ["proxy"];
  var out = [];
  for (var gi = 0; gi < Math.min(3, gaps.length); gi++) {
    var g = gaps[gi];
    var sys = "너는 한국 고1 영어 내신 출제 로직 설계자다. 기존 체계(L01~12,E01~20,SM01~13,SY01~07,PI0~3,D01~13)와 중복되지 않는 '구체적 개선안'을 JSON으로만 낸다.";
    var ask = "[갭] " + g.kind + " · " + g.code + " " + g.name + " — " + g.need +
      "\n\n이 갭을 메울 개선안 1개를 JSON으로: {\"target\":\"drill|semantic_trap|syntactic_trap|gen_prompt|item_example\",\"payload\":{...해당 스키마},\"why\":\"근거 한 줄\"}. 기존 코드와 중복 금지, 새 코드는 다음 번호 사용.";
    var drafts = [];
    for (var i = 0; i < provs.length; i++) {
      try { var r = await T.llmRaw([{ role: "system", content: sys }, { role: "user", content: ask }], { forceProvider: provs[i], json: true, temperature: 0.5, timeout: 60000 }); var o = parseJSON(r); if (o && o.target && o.payload) drafts.push(o); } catch (e) {}
    }
    if (!drafts.length) continue;
    var fin = drafts[0];
    if (drafts.length > 1) {   // 비평·통합 1라운드
      try { var r2 = await T.llmRaw([{ role: "system", content: sys }, { role: "user", content: "[갭] " + g.code + "\n[초안들]\n" + drafts.map(function (d, i) { return (i + 1) + ") " + JSON.stringify(d); }).join("\n") + "\n\n가장 실전적인 최종안 1개로 통합해 같은 JSON으로만 출력." }], { forceProvider: provs[0], json: true, temperature: 0.3, timeout: 60000 }); var o2 = parseJSON(r2); if (o2 && o2.target) fin = o2; } catch (e) {}
    }
    fin.gap = g; out.push(fin);
  }
  return out;
}

/* ── ④ 검증: 스키마·중복·참조 ── */
function validate(db, p) {
  var pay = p.payload || {};
  if (p.target === "drill") return pay.code && pay.goal && !(db.drills || []).some(function (d) { return d.code === pay.code || d.goal === pay.goal; });
  if (p.target === "semantic_trap") return pay.code && pay.name && !(db.semantic_traps || []).some(function (t) { return t.code === pay.code || t.name === pay.name; });
  if (p.target === "syntactic_trap") return pay.code && pay.name && !(db.syntactic_traps || []).some(function (t) { return t.code === pay.code || t.name === pay.name; });
  if (p.target === "gen_prompt") return pay.type && pay.template && !(db.gen_prompts || []).some(function (g) { return g.type === pay.type; });
  if (p.target === "item_example") return pay.exam_id && pay.type_surface && pay.logic_type;
  return false;
}

/* ── ⑥ 승격: 검토 끝난 제안을 정식 반영(버전업) ── */
function promote(idx) {
  var db = load(DBP, null), props = load(PROPP, { proposals: [] });
  var p = props.proposals[idx];
  if (!db || !p) { console.log("제안 " + idx + " 없음. --list 로 확인"); return; }
  if (!validate(db, p)) { console.log("✗ 검증 실패(중복/스키마) — 반영 안 함"); return; }
  var MAP = { drill: "drills", semantic_trap: "semantic_traps", syntactic_trap: "syntactic_traps", gen_prompt: "gen_prompts", item_example: "items" };
  db[MAP[p.target]].push(p.payload);
  var v = String(db.meta.version).split("."); db.meta.version = v[0] + "." + (+v[1] + 1);
  db.meta.note = (db.meta.note || "") + " [v" + db.meta.version + " 로직진화: " + p.target + " " + (p.payload.code || p.payload.type || "") + " 승격]";
  save(DBP, db);
  p.promoted = stamp(); save(PROPP, props);
  console.log("✅ 승격 완료 → intent_db v" + db.meta.version + " (" + p.target + ": " + (p.payload.code || p.payload.type || p.payload.exam_id) + ")");
  console.log("커밋·push 하면 사이트·하네스 전체에 반영됩니다.");
}

/* ── CLI ── */
(async () => {
  var a = process.argv;
  if (a.indexOf("--promote") >= 0) return promote(+a[a.indexOf("--promote") + 1]);
  var props = load(PROPP, { proposals: [] });
  if (a.indexOf("--list") >= 0) {
    console.log("=== 스테이징된 로직 제안 " + props.proposals.length + "건 ===");
    props.proposals.forEach(function (p, i) { console.log(i + ". [" + p.target + "] " + (p.payload && (p.payload.code || p.payload.type || p.payload.exam_id) || "?") + " — " + (p.why || "") + (p.promoted ? "  (✅ " + p.promoted + " 승격됨)" : "")); });
    console.log("\n승격: node selfllm/logic_evolve.js --promote <번호>");
    return;
  }
  var db = load(DBP, null); if (!db) return console.log("intent_db.json 없음");
  var store = load(ROOT + "/knowledge/intent_store.json", null);
  var u = usage(db, store);
  var gaps = audit(db, u);
  console.log("===== 로직 진화 · " + stamp() + " =====");
  console.log("근거 문항 " + u.n + "개(예시 " + db.items.length + " + 누적 시험지 " + (u.n - db.items.length) + ")");
  console.log("\n[감사] 갭 " + gaps.length + "건:");
  gaps.slice(0, 12).forEach(function (g, i) { console.log("  " + (i + 1) + ". (" + g.kind + ") " + g.code + " " + g.name + " ×" + g.count + " → " + g.need); });
  if (gaps.length > 12) console.log("  … 외 " + (gaps.length - 12) + "건");
  var news = [];
  if (ONLINE && gaps.length) {
    console.log("\n[토론 제안] 다중 API로 상위 갭 개선안 생성 중…");
    news = await propose(db, gaps);
    news.forEach(function (p) { if (validate(db, p)) { props.proposals.push(p); console.log("  + [" + p.target + "] " + (p.payload.code || p.payload.type || "") + " — " + (p.why || "")); } else console.log("  ✗ 검증 탈락: " + p.target); });
    save(PROPP, props);
  } else if (gaps.length) {
    console.log("\n(--online 을 붙이면 다중 API 토론으로 위 갭들의 개선안 초안을 자동 생성해 스테이징합니다)");
  }
  var log = load(LOGP, []); log.push({ at: stamp(), evidence: u.n, gaps: gaps.length, proposed: news.length, staged: props.proposals.filter(function (p) { return !p.promoted; }).length });
  save(LOGP, log);
  console.log("\n요약: 갭 " + gaps.length + " · 신규 제안 " + news.length + " · 승인 대기 " + props.proposals.filter(function (p) { return !p.promoted; }).length + " · 회차 " + log.length);
  console.log("검토: --list · 반영: --promote <번호> (원본은 승인 전 불변 — 퇴화 방지 게이트)");
})();
