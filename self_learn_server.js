// 서버(GitHub Actions/클라우드)가 실행: 스스로 출제→자가비평→규칙 학습 + 교사 회의 1건 → DB 갱신. 탭/PC 무관.
global.window = {}; require("./api_team.js"); var T = window.APITEAM; var fs = require("fs");
if (process.env.GROQ_API_KEY) { T.configure({ groqKey: process.env.GROQ_API_KEY }); console.log("Groq 키 적용됨(병렬·고속)"); } else { console.log("Groq 키 없음 — Pollinations(무키)로 작동"); }
var RAW = "https://raw.githubusercontent.com/inheok1103-alt/byeonghyeong-maker/master/";
function pick(a, n) { var o = a.slice(); for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = o[i]; o[i] = o[j]; o[j] = t; } return o.slice(0, n); }
function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } }
(async () => {
  await T.loadTypeDB(RAW + "types.json?_t=" + Date.now());
  await T.loadCorpus(RAW + "corpus/");
  T.applyLearned(readJSON("corpus/learned_rules.json", {}).rules || []);
  var nowISO = new Date().toISOString();
  // 1) 자가학습: 3유형 스스로 출제→자가비평→규칙
  var types = pick(["빈칸", "함의", "주제", "제목", "어법", "어휘", "요약", "내용불일치", "조건영작", "어법수정", "배열영작", "영영풀이"], 3);
  var got = [], samples = [];
  for (var i = 0; i < types.length; i++) {
    var cp = T.corpusPassage ? T.corpusPassage({}) : null;
    var pg = cp && cp.text ? cp.text : "Happiness is culturally constructed rather than a universal personal achievement, shaped by whether a culture prioritizes individual success or collective harmony.";
    try { var r = await T.selfLearnStep(pg, types[i], { teachers: 2 }); if (r && r.learned) got.push({ type: types[i], score: r.score, rule: r.learned }); } catch (e) {}
    try { var q = await T.generateOne(pg, types[i], { fast: true }); if (q) samples.push({ type: q.type, instruction: q.instruction, choices: q.choices || [], answer: q.answer, explanation: q.explanation }); } catch (e) {}
  }
  var all = T.learnedRules();
  fs.writeFileSync("corpus/learned_rules.json", JSON.stringify({ updated: nowISO, count: all.length, rules: all }, null, 1));
  fs.writeFileSync("corpus/self_samples.json", JSON.stringify({ updated: nowISO, samples: samples.slice(0, 12) }, null, 1));
  // 2) 교사 회의 1건 → 회의 DB 누적
  var TOPICS = ["빈칸 오답의 매력도·비중복 강화", "함의 유형 함정 설계", "어법 난이도 상향 기법", "서술형 채점 기준 정교화", "어휘 반의어 오답 선정", "요약빈칸 정답어 선정", "내용불일치 미묘한 왜곡", "지문 난이도(CEFR)별 배치"];
  var topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  var meetDB = readJSON("corpus/live_meetings.json", { updated: "", count: 0, meetings: [] });
  try {
    var d = await T.deliberate(topic, { teachers: 3 });
    if (d) { meetDB.meetings.unshift({ t: nowISO.slice(0, 16).replace("T", " "), topic: topic, verdict: d.verdict, reason: d.reason, dialogue: d.dialogue || [] }); }
  } catch (e) {}
  meetDB.meetings = meetDB.meetings.slice(0, 100); meetDB.count = meetDB.meetings.length; meetDB.updated = nowISO;
  fs.writeFileSync("corpus/live_meetings.json", JSON.stringify(meetDB, null, 1));
  console.log("자가학습 신규규칙 " + got.length + " · 총규칙 " + all.length + " · 샘플 " + samples.length + " · 회의 누적 " + meetDB.count);
})().catch(function (e) { console.log("ERR", e.message); process.exitCode = 0; });
