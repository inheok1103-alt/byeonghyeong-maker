/* ===========================================================================
   Ray English 자체 LLM — 학습 데이터 생성기 (밀도 최대화)
   passage_db(원서 2110지문) × 빌더 → 정답검증된 문항/워크북/분석 → 파인튜닝 JSONL

   [무료·오프라인]  node selfllm/build_dataset.js  [지문수=400] [변형수=3]
       → 코드제어 4유형(글의순서·문장삽입·연결어·첫글자)만, LLM 불필요·무제한

   [고밀도·온라인]  node selfllm/build_dataset.js  400 2 --online
       → 무한모드 키로 전 유형 + 워크북(문제편/해설편) + 지문분석까지, 검수 통과분만
         (환경변수 또는 아래 KEYS에 키를 넣어야 함)

   출력: selfllm/train.jsonl  (chat 포맷)  ·  이어붙이므로 여러 번 돌려 밀도 누적
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;
var N = parseInt(process.argv[2], 10) || 400;
var VAR = parseInt(process.argv[3], 10) || 3;   // 지문·유형당 변형 개수(밀도)
var APPEND = process.argv.indexOf("--fresh") < 0;   // 기본은 이어붙여 밀도 누적

var realFetch = global.fetch ? global.fetch.bind(global) : (typeof fetch !== "undefined" ? fetch : null);
global.fetch = async function (url, init) {
  var u = String((url && url.url) || url);
  if (!/^https?:\/\//.test(u)) { var p = path.join(ROOT, u.split("?")[0]); if (!fs.existsSync(p)) return new Response("404", { status: 404 }); return new Response(fs.readFileSync(p, "utf8"), { status: 200 }); }
  if (!ONLINE) return new Response(JSON.stringify({ error: "offline" }), { status: 200 });   // 오프라인: 외부 즉시 실패 → 코드 빌더만
  return realFetch(u, init);
};
global.window = {};
require(ROOT + "/api_team.js"); var T = window.APITEAM;

// 온라인 모드 키(무한모드) — 환경변수 우선, 없으면 여기에 직접
var KEYS = { geminiKey: process.env.GEMINI_KEY || "", groqKey: process.env.GROQ_KEY || "", cerebrasKey: process.env.CEREBRAS_KEY || "", mistralKey: process.env.MISTRAL_KEY || "", openrouterKey: process.env.OPENROUTER_KEY || "" };
if (ONLINE) T.configure(KEYS);

var CODE_TYPES = ["글의순서", "문장삽입", "연결어빈칸", "첫글자어휘"];
var LLM_TYPES = ["빈칸(어구)", "어법(밑줄)", "어휘(밑줄)", "밑줄함의", "주제", "제목", "요지", "내용불일치", "요약문AB", "무관문장", "조건영작", "우리말해석", "서술형(자유)"];
var CIRC = ["①", "②", "③", "④", "⑤"];
var SYS = "너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 지문을 분석해 정확한 문항·워크북·분석을 만든다.";

function fmtQ(q) {
  var s = "[발문] " + String(q.instruction || "").trim() + "\n";
  if (q.passage) s += "[지문]\n" + String(q.passage).replace(/<\/?u>/g, "") + "\n";
  if (q.choices && q.choices.length) q.choices.forEach(function (c, i) { s += (CIRC[i] || (i + 1)) + " " + c + "\n"; });
  s += "[정답] " + (q.answer ? (CIRC[q.answer - 1] || q.answer) : "서술형") + "\n[해설] " + String(q.explanation || "").replace(/【출제의도】[\s\S]*$/, "").trim();
  return s;
}
function recQ(passage, type, q) { return { messages: [{ role: "system", content: SYS }, { role: "user", content: "[유형] " + type + "\n[지문]\n" + passage + "\n\n위 지문으로 '" + type + "' 유형의 변형문항을 만들어라." }, { role: "assistant", content: fmtQ(q) }] }; }
function ok(q, type) { if (!q || !q.instruction) return false; if (type !== "첫글자어휘" && type !== "우리말해석" && !/서술|영작|해석/.test(type)) { if (!q.choices || q.choices.length < 3) return false; if (!(q.answer >= 1 && q.answer <= q.choices.length)) return false; } if (/\(보기/.test(JSON.stringify(q.choices || []))) return false; return true; }

(async () => {
  await T.loadTypeDB("knowledge/types_v2.json").catch(function () {});
  if (ONLINE) { await T.loadExaminerKB("knowledge/examiner_kb_v1.json").catch(function () {}); await T.loadRaysKB("knowledge/rays_drill_kb.json").catch(function () {}); await T.loadReviewDB("knowledge/review_core_v2.json").catch(function () {}); }
  var pdb = JSON.parse(fs.readFileSync(ROOT + "/corpus/passage_db.json", "utf8"));
  var passages = (pdb.passages || pdb).map(function (x) { return typeof x === "string" ? x : (x.text || ""); }).filter(function (t) { var w = (t.match(/[A-Za-z]+/g) || []).length; return w >= 70 && w <= 220 && (t.match(/[.!?]/g) || []).length >= 4; });
  for (var s = passages.length - 1; s > 0; s--) { var r = Math.floor(Math.random() * (s + 1)); var tmp = passages[s]; passages[s] = passages[r]; passages[r] = tmp; }   // 셔플: 실행마다 다른 지문
  var TARGET = N * (ONLINE ? 1 : 4), CAP = Math.ceil(TARGET / (ONLINE ? 6 : 3));   // 유형 균형 캡
  // 기존 train.jsonl 서명 로드 → 실행 간 중복 제거(밀도 누적 안전)
  function sig(pg, t, q) { return String(pg).slice(0, 50) + "|" + t + "|" + (q.choices || []).join("~").slice(0, 90) + "|" + (q.answer || 0); }   // 지문+유형+선지+정답 = 고유
  var existSig = {}, existType = {};
  if (APPEND) { try { fs.readFileSync(ROOT + "/selfllm/train.jsonl", "utf8").split("\n").filter(Boolean).forEach(function (l) { try { var o = JSON.parse(l); var u = o.messages[1].content; var pm = u.match(/\[지문\]\n([\s\S]+?)\n\n위/); var tm = u.match(/\[유형\]\s*([^\n]+)/); var t = tm ? tm[1].trim() : "?"; var am = o.messages[2].content.match(/\[정답\]\s*(\S+)/); existSig[String(pm ? pm[1] : "").slice(0, 50) + "|" + t] = (existSig[String(pm ? pm[1] : "").slice(0, 50) + "|" + t] || 0) + 1; existType[t] = (existType[t] || 0) + 1; } catch (e) {} }); } catch (e) {} }
  var buf = [];
  var made = 0, byType = {}, seen = {}, types = ONLINE ? CODE_TYPES.concat(LLM_TYPES) : CODE_TYPES;
  function add(pg, t, q) { if (!ok(q, t)) return false; var s = sig(pg, t, q); if (seen[s]) return false; if ((byType[t] || 0) + (existType[t] || 0) >= CAP) return false; var pk = String(pg).slice(0, 50) + "|" + t; if ((existSig[pk] || 0) >= 4) return false; seen[s] = 1; buf.push(JSON.stringify(recQ(pg, t, q))); made++; byType[t] = (byType[t] || 0) + 1; return true; }

  for (var i = 0; i < passages.length && made < TARGET; i++) {
    var pg = passages[i];
    for (var j = 0; j < types.length; j++) {
      var t = types[j];
      var reps = (CODE_TYPES.indexOf(t) >= 0) ? VAR : 1;   // 코드유형은 변형 여러 개(밀도), LLM유형은 1개(비용)
      var seen = {};
      for (var v = 0; v < reps; v++) {
        // 오프라인: 빈 ctx를 넘겨 cachedContext(LLM 시도·백오프)를 건너뜀 → 코드 빌더만 즉시 실행
        var opts = ONLINE ? { fast: true } : { fast: true, ctx: {} };
        var q = null; try { q = await T.generateOne(pg, t, opts); } catch (e) { q = null; }
        if (ONLINE && q && T.reviewItem) { try { var rv = await T.reviewItem(q, q.passage || pg, {}); if (rv && /불가/.test(String(rv.verdict || ""))) q = null; } catch (e) {} }   // 검수 통과분만
        if (q) add(pg, t, q);
      }
    }
    // 온라인: 워크북·분석 태스크도 학습(가끔)
    if (ONLINE && i % 8 === 0 && T.analysisSheet) {
      try { var d = await T.analysisSheet(pg, {}); if (d && d.sents) { var body = d.sents.map(function (s) { return s.n + ". " + s.en + " → " + s.ko + (s.syntax ? (" [구문: " + s.syntax + "]") : ""); }).join("\n"); buf.push(JSON.stringify({ messages: [{ role: "system", content: SYS }, { role: "user", content: "[지문]\n" + pg + "\n\n위 지문을 문장별로 해석하고 구문을 분석하라(분석지)." }, { role: "assistant", content: "[주제] " + (d.topic || "") + "\n[문장 분석]\n" + body }] })); made++; byType["분석지"] = (byType["분석지"] || 0) + 1; }
      } catch (e) {}
    }
    if (i % 25 === 0) process.stdout.write("\r지문 " + i + "/" + passages.length + " · 샘플 " + made + " …   ");
  }
  if (!APPEND || made) { try { var ss = JSON.parse(fs.readFileSync(ROOT + "/corpus/self_samples.json", "utf8")).samples || []; ss.forEach(function (s) { if (s && s.q && s.q.instruction) add(s.q.passage || "(지문 생략)", s.type, s.q); }); } catch (e) {} }
  var payload = buf.join("\n") + (buf.length ? "\n" : "");
  if (APPEND) fs.appendFileSync(ROOT + "/selfllm/train.jsonl", payload); else fs.writeFileSync(ROOT + "/selfllm/train.jsonl", payload);
  var total = 0; try { total = fs.readFileSync(ROOT + "/selfllm/train.jsonl", "utf8").split("\n").filter(Boolean).length; } catch (e) {}
  console.log("\n\n===== 학습 데이터 " + (ONLINE ? "고밀도(온라인)" : "무료(오프라인)") + " 생성 완료 =====");
  console.log("이번 생성 " + made + "샘플 · 유형별: " + Object.keys(byType).map(function (k) { return k + " " + byType[k]; }).join(" · "));
  console.log("누적 train.jsonl 총 " + total + "샘플 (여러 번 돌리면 밀도 계속 상승)");
  console.log("다음: Colab에서 selfllm/finetune_colab.py 실행(무료 GPU) → 우리 전용 모델 학습·소유");
})();
