/* ===========================================================================
   Ray English 자체LLM — 진화 엔진 (생성 → 검증 → 축적 → 벤치마크 → 승격게이트)
   "절대 나빠지지 않으면서 매번 올라가는" 자기개선 루프의 PC측 오케스트레이터.

   한 번 실행:
     node selfllm/evolve.js                      (벤치마크 보장 + 데이터 재생성·흡수 + 로그)
     node selfllm/evolve.js --bench-only         (홀드아웃 gold 벤치마크만 재생성)
     node selfllm/evolve.js --online             (+ 무료 신경다발 앙상블로 추론형 증류)

   산출:
     selfllm/benchmark.jsonl        정답 아는 고정 시험셋(학습에 안 섞임 = 퇴화 감시)
     selfllm/benchmark_holdout.json 학습 제외용 지문 서명(build_dataset가 읽어 뺌)
     selfllm/evolve_log.json        회차별 성장 기록
   승격판정(모델 점수)은 GPU가 있는 곳에서:  python selfllm/eval_model.py
   =========================================================================== */
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var ONLINE = process.argv.indexOf("--online") >= 0;
var BENCH_ONLY = process.argv.indexOf("--bench-only") >= 0;
var HOLD_N = 40, PER_TYPE = 12;
var prose = require("./prose.js");

// api_team 로드(코드빌더로 gold 벤치마크 생성)
var realFetch = global.fetch ? global.fetch.bind(global) : null;
global.fetch = async function (url, init) {
  var u = String((url && url.url) || url);
  if (!/^https?:\/\//.test(u)) { var p = path.join(ROOT, u.split("?")[0]); if (!fs.existsSync(p)) return new Response("404", { status: 404 }); return new Response(fs.readFileSync(p, "utf8"), { status: 200 }); }
  if (!ONLINE) return new Response(JSON.stringify({ error: "offline" }), { status: 200 });
  return realFetch(u, init);
};
global.window = {};
require(ROOT + "/api_team.js"); var T = window.APITEAM;
var CODE_TYPES = ["글의순서", "문장삽입", "연결어빈칸", "첫글자어휘"];
var CIRC = ["①", "②", "③", "④", "⑤"];

function stamp() { try { return new Date().toISOString().slice(0, 19).replace("T", " "); } catch (e) { return "unknown"; } }
function count(file) { try { return fs.readFileSync(ROOT + "/selfllm/" + file, "utf8").split("\n").filter(Boolean).length; } catch (e) { return 0; } }
function typeStats() {
  var by = {}; try { fs.readFileSync(ROOT + "/selfllm/train.jsonl", "utf8").split("\n").filter(Boolean).forEach(function (l) { try { var u = JSON.parse(l).messages[1].content; var t = /워크북/.test(u) ? "워크북" : ((u.match(/\[유형\]\s*([^\n]+)/) || [])[1] || "?").trim(); by[t] = (by[t] || 0) + 1; } catch (e) {} }); } catch (e) {}
  return by;
}

async function buildBenchmark() {
  await T.loadTypeDB("knowledge/types_v2.json").catch(function () {});
  var passages = prose.loadProse(ROOT, fs);
  // 결정론적 홀드아웃: 해시 하위 HOLD_N '지문'을 고정 선택(유형 편향 없음 → 희귀유형을 빼가지 않음).
  // 벤치마크는 그 지문들이 만들어내는 유형만큼만(연결어 등 희귀형은 적어도 무방 — 퇴화 감시가 목적).
  var ranked = passages.map(function (p) { return { p: p, h: prose.hstr(p) }; }).sort(function (a, b) { return a.h - b.h; });
  var holdPassages = ranked.slice(0, HOLD_N).map(function (x) { return x.p; });
  var holdout = {}, bench = [], per = {};
  for (var i = 0; i < holdPassages.length; i++) {
    var pg = holdPassages[i]; holdout[pg.slice(0, 60)] = 1;
    for (var t = 0; t < CODE_TYPES.length; t++) {
      var ty = CODE_TYPES[t];
      try { var q = await T.generateOne(pg, ty, { fast: true, ctx: {} }); if (q && q.answer) { bench.push(JSON.stringify({ type: ty, passage: pg, instruction: q.instruction, choices: q.choices || [], answer: q.answer })); per[ty] = (per[ty] || 0) + 1; } } catch (e) {}
    }
  }
  fs.writeFileSync(ROOT + "/selfllm/benchmark.jsonl", bench.join("\n") + "\n");
  fs.writeFileSync(ROOT + "/selfllm/benchmark_holdout.json", JSON.stringify({ built: stamp(), holdout: holdout }, null, 0));
  console.log("벤치마크 " + bench.length + "문항(gold) · 홀드아웃 지문 " + Object.keys(holdout).length + "개 학습제외 표시");
  return { bench: bench.length, hold: Object.keys(holdout).length, per: per };
}

function run(cmd) { console.log("· " + cmd); try { var out = cp.execSync("node " + cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); var last = out.trim().split("\n").slice(-2).join(" | "); console.log("  → " + last); return true; } catch (e) { console.log("  ✗ " + (e.message || "").split("\n")[0]); return false; } }

(async () => {
  console.log("===== Ray English 진화 엔진 · " + stamp() + " =====");
  // 1) 벤치마크 보장(없거나 --bench-only면 (재)생성)
  var haveBench = fs.existsSync(ROOT + "/selfllm/benchmark.jsonl");
  if (!haveBench || BENCH_ONLY) { console.log("[벤치마크] 홀드아웃 gold 생성…"); await buildBenchmark(); }
  else console.log("[벤치마크] 기존 " + count("benchmark.jsonl") + "문항 유지(공정 비교 위해 고정)");
  if (BENCH_ONLY) return;

  var before = count("train.jsonl");
  // 2) 축적: 코드빌더(홀드아웃 제외 재생성) + 오픈시험데이터 흡수 [+ 온라인 증류]
  console.log("[성장] 데이터 생성·흡수…");
  run("selfllm/build_dataset.js 2500 8 --fresh");     // 코드 4유형(홀드아웃 자동 제외)
  run("selfllm/ingest_github.js 300");                 // CLOTH 실제시험 빈칸(정답100%)
  if (ONLINE) console.log("  (온라인 증류: node selfllm/build_dataset.js 300 2 --online 로 추론형 추가 가능)");

  // 3) 로그
  var after = count("train.jsonl"), by = typeStats();
  var log = []; try { log = JSON.parse(fs.readFileSync(ROOT + "/selfllm/evolve_log.json", "utf8")); } catch (e) {}
  log.push({ at: stamp(), total: after, added: after - before, benchmark: count("benchmark.jsonl"), byType: by });
  fs.writeFileSync(ROOT + "/selfllm/evolve_log.json", JSON.stringify(log, null, 1));

  console.log("\n===== 진화 1회차 완료 =====");
  console.log("학습셋 " + before + " → " + after + " (+" + (after - before) + ") · 벤치마크 " + count("benchmark.jsonl") + "(고정)");
  console.log("유형별: " + Object.keys(by).map(function (k) { return k + " " + by[k]; }).join(" · "));
  console.log("누적 회차: " + log.length);
  console.log("\n다음: Colab/Ollama에서  python selfllm/eval_model.py  → 벤치마크 점수 측정 → '오를 때만' 새 모델 승격(퇴화 차단)");
})();
