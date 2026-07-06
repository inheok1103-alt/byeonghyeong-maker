/* ===========================================================================
   Ray English — 하이브리드 RAG 라우터 하네스
   질문 성격에 따라 5개 백엔드로 라우팅·융합:
     ① Vector(유사의미, bge-m3)  ② Keyword(정확문구)  ③ SQL(수치·집계)
     ④ Graph/Ontology(관계)     ⑤ API(실시간·최신)
   데이터: corpus/passage_db.json · knowledge/intent_db.json · (선택)corpus/passage_vecs.json

   실행:
     node selfllm/rag.js "빈칸 유형 비율"                 (자동 라우팅)
     node selfllm/rag.js --kw "cognitive dissonance"      (정확 문구)
     node selfllm/rag.js --sql "type_surface"             (집계: 필드별 카운트)
     node selfllm/rag.js --graph L01                      (관계: L/E/D 연결)
     node selfllm/rag.js --online --api "출처 <문장>"       (실시간 검색)
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
if (ONLINE) T.configure({ geminiKey: process.env.GEMINI_KEY || "", groqKey: process.env.GROQ_KEY || "", cerebrasKey: process.env.CEREBRAS_KEY || "", mistralKey: process.env.MISTRAL_KEY || "", proxyUrl: process.env.RAY_PROXY || "" });

var PASSAGES = prose.loadProse(ROOT, fs);
var DB = JSON.parse(fs.readFileSync(ROOT + "/knowledge/intent_db.json", "utf8"));
var VECS = null; try { VECS = JSON.parse(fs.readFileSync(ROOT + "/corpus/passage_vecs.json", "utf8")); } catch (e) {}

/* ---------- ② Keyword: 정확 문구/토큰 매칭 ---------- */
function keyword(q, k) {
  var ql = q.toLowerCase(), toks = ql.split(/\s+/).filter(function (w) { return w.length > 2; });
  var scored = PASSAGES.map(function (p) {
    var pl = p.toLowerCase(); var s = 0;
    if (pl.indexOf(ql) >= 0) s += 100;                                   // 정확 구문 최우선
    toks.forEach(function (t) { if (pl.indexOf(t) >= 0) s += 1; });
    return { p: p, s: s };
  }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  return scored.slice(0, k || 5).map(function (x) { return { score: x.s, text: x.p.slice(0, 160) + "…" }; });
}

/* ---------- ① Vector: 유사 의미(bge-m3 사전임베딩) ---------- */
function cosine(a, b) { var d = 0, na = 0, nb = 0; for (var i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9); }
async function vector(q, k) {
  if (!VECS || !VECS.vectors) return { fallback: "keyword(임베딩 없음 — selfllm/embed_corpus.py로 생성)", results: keyword(q, k) };
  var qv = null;
  if (ONLINE && T.embedQuery) { try { qv = await T.embedQuery(q); } catch (e) {} }
  if (!qv) return { fallback: "keyword(쿼리 임베딩 불가 — 온라인+임베더 필요)", results: keyword(q, k) };
  var scored = VECS.vectors.map(function (v, i) { return { i: i, s: cosine(qv, v) }; }).sort(function (a, b) { return b.s - a.s; });
  return { results: scored.slice(0, k || 5).map(function (x) { return { score: +x.s.toFixed(3), text: (VECS.meta && VECS.meta[x.i] || "").slice(0, 160) + "…" }; }) };
}

/* ---------- ③ SQL: 수치·집계(groupBy over intent_db.items) ---------- */
function sql(field, filterFn) {
  var items = DB.items.filter(filterFn || function () { return true; });
  if (!field) return { total: items.length, avg_score: +(items.reduce(function (s, x) { return s + (x.score || 0); }, 0) / Math.max(1, items.length)).toFixed(2) };
  var g = {}; items.forEach(function (x) { var vals = Array.isArray(x[field]) ? x[field] : [x[field]]; vals.forEach(function (v) { g[v] = (g[v] || 0) + 1; }); });
  var rows = Object.keys(g).map(function (k) { return { key: k, count: g[k], pct: +(g[k] / items.length * 100).toFixed(1) }; }).sort(function (a, b) { return b.count - a.count; });
  return { field: field, n: items.length, rows: rows };
}

/* ---------- ④ Graph/Ontology: L↔E↔D↔type 관계 ---------- */
function graph(node) {
  node = String(node).toUpperCase();
  var nb = { logic: {}, errors: {}, drills: {}, types: {} };
  DB.items.forEach(function (it) {
    var L = it.logic_type, Es = it.common_wrong_reasons || [], Ds = it.teaching_drill || [], ty = it.type_surface;
    var hit = (L === node) || Es.indexOf(node) >= 0 || Ds.indexOf(node) >= 0 || (ty && ty.toUpperCase().indexOf(node) >= 0);
    if (!hit) return;
    if (L && L !== node) nb.logic[L] = (nb.logic[L] || 0) + 1;
    Es.forEach(function (e) { if (e !== node) nb.errors[e] = (nb.errors[e] || 0) + 1; });
    Ds.forEach(function (d) { if (d !== node) nb.drills[d] = (nb.drills[d] || 0) + 1; });
    if (ty) nb.types[ty] = (nb.types[ty] || 0) + 1;
  });
  function name(code) { var r = (DB.logic_rules.find(function (x) { return x.code === code; }) || DB.error_codes.find(function (x) { return x.code === code; }) || DB.drills.find(function (x) { return x.code === code; })); return r ? (r.name || r.goal || "") : ""; }
  function top(o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return k + (name(k) ? "(" + name(k) + ")" : "") + "×" + o[k]; }); }
  return { node: node, name: name(node), 연결_로직: top(nb.logic), 연결_오답: top(nb.errors), 연결_드릴: top(nb.drills), 연결_유형: top(nb.types) };
}

/* ---------- ⑤ API: 실시간·최신 ---------- */
async function api(q) {
  if (!ONLINE) return { error: "오프라인 — --online 필요" };
  var out = {};
  try { if (T.findSource) out.source = await T.findSource(q).catch(function () { return null; }); } catch (e) {}
  try { if (T.wiki) out.wiki = await T.wiki(q.split(/\s+/).slice(0, 3).join(" ")).catch(function () { return null; }); } catch (e) {}
  try { if (T.datamuse) out.related = await T.datamuse(q.split(/\s+/)[0], "ml").catch(function () { return null; }); } catch (e) {}
  return out;
}

/* ---------- 라우터: 질문 성격 → 백엔드 ---------- */
function route(q) {
  if (/집계|비율|몇\s*[%개]|평균|분포|통계|count|avg|per/i.test(q)) return "sql";
  if (/관계|연결|엮|반의|유의|온톨|graph|L\d\d|E\d\d|D\d\d/i.test(q)) return "graph";
  if (/유사|비슷|semantic|의미/i.test(q)) return "vector";
  if (/최신|실시간|출처|검색|위키|뜻|정의/i.test(q)) return "api";
  if (/"|정확|원문|구문|phrase/i.test(q)) return "keyword";
  return "vector";   // 기본: 의미검색(임베딩 없으면 keyword 폴백)
}

/* ---------- CLI ---------- */
(async () => {
  var a = process.argv, q;
  function grab(flag) { var i = a.indexOf(flag); return i >= 0 ? a.slice(i + 1).filter(function (x) { return x !== "--online"; })[0] : null; }
  if ((q = grab("--kw")) != null) return console.log(JSON.stringify(keyword(q, 6), null, 1));
  if ((q = grab("--sql")) != null) return console.log(JSON.stringify(sql(q === "-" ? null : q), null, 1));
  if ((q = grab("--graph")) != null) return console.log(JSON.stringify(graph(q), null, 1));
  if ((q = grab("--vector")) != null) return console.log(JSON.stringify(await vector(q, 6), null, 1));
  if ((q = grab("--api")) != null) return console.log(JSON.stringify(await api(q), null, 1));
  q = a.slice(2).filter(function (x) { return x !== "--online"; }).join(" ");
  if (!q) { console.log("사용: rag.js \"질문\"  |  --kw/--sql/--graph/--vector/--online --api  <값>"); console.log("데이터: 지문 " + PASSAGES.length + " · 항목 " + DB.items.length + " · 벡터 " + (VECS ? "있음" : "없음(embed_corpus.py)")); return; }
  var b = route(q); console.log("[라우터] → " + b + " 백엔드\n");
  var r = b === "sql" ? sql(/type|유형/.test(q) ? "type_surface" : (/school|학교/.test(q) ? "school" : (/logic|로직/.test(q) ? "logic_type" : (/오답|error/.test(q) ? "common_wrong_reasons" : null))))
    : b === "graph" ? graph((q.match(/[LED]\d\d/i) || [q])[0])
      : b === "keyword" ? keyword(q, 6)
        : b === "api" ? await api(q)
          : await vector(q, 6);
  console.log(JSON.stringify(r, null, 1));
})();

module.exports = { keyword: keyword, vector: vector, sql: sql, graph: graph, api: api, route: route };
