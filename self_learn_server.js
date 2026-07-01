// 서버(클라우드 루틴)가 실행: 스스로 출제→자가비평→규칙 학습→learned_rules.json 갱신. 탭/PC와 무관.
global.window = {}; require("./api_team.js"); var T = window.APITEAM; var fs = require("fs");
var RAW = "https://raw.githubusercontent.com/inheok1103-alt/byeonghyeong-maker/master/";
function pick(a, n) { var o = a.slice(); for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = o[i]; o[i] = o[j]; o[j] = t; } return o.slice(0, n); }
(async () => {
  await T.loadTypeDB(RAW + "types.json?_t=" + Date.now());
  await T.loadCorpus(RAW + "corpus/");
  var existing = []; try { existing = (JSON.parse(fs.readFileSync("corpus/learned_rules.json", "utf8")).rules) || []; } catch (e) {}
  T.applyLearned(existing);
  var types = pick(["빈칸", "함의", "주제", "제목", "어법", "어휘", "요약", "내용불일치", "조건영작", "어법수정", "배열영작", "영영풀이"], 3);
  var got = [], samples = [];
  for (var i = 0; i < types.length; i++) {
    var cp = (T.corpusPassage ? T.corpusPassage({}) : null);
    var pg = cp && cp.text ? cp.text : "Happiness is culturally constructed rather than a universal personal achievement, shaped by whether a culture prioritizes individual success or collective harmony.";
    try { var r = await T.selfLearnStep(pg, types[i], { teachers: 2 }); if (r && r.learned) got.push({ type: types[i], score: r.score, rule: r.learned }); } catch (e) {}
    try { var q = await T.generateOne(pg, types[i], { fast: true }); if (q) samples.push({ type: q.type, instruction: q.instruction, choices: q.choices || [], answer: q.answer, explanation: q.explanation }); } catch (e) {}
  }
  var all = T.learnedRules();
  fs.writeFileSync("corpus/learned_rules.json", JSON.stringify({ updated: new Date().toISOString(), count: all.length, rules: all }, null, 1));
  fs.writeFileSync("corpus/self_samples.json", JSON.stringify({ updated: new Date().toISOString(), samples: samples.slice(0, 12) }, null, 1));
  console.log("자가학습 완료 · 신규규칙 " + got.length + " · 총 " + all.length + " · 샘플 " + samples.length);
  got.forEach(function (g) { console.log("  [" + g.type + " " + g.score + "점] " + g.rule); });
})().catch(function (e) { console.log("ERR", e.message); });
