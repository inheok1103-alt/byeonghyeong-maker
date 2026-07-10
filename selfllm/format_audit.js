/* 형식 전수검사 하네스 — suite.json이 4개 산출물(분석지·문제지·동형모고·워크북) 형식 요건을 충족하는지 검사.
   규격: knowledge/output_formats.md. 사용: node selfllm/format_audit.js [suite.json] */
var fs = require("fs"), path = require("path");
var s = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, "_suite.json"), "utf8"));
var a = s.analysis || {}, items = s.items || [];
var fails = [], warns = [];
function ok(name, cond, warn) { if (cond) { console.log("  ✅ " + name); } else { (warn ? warns : fails).push(name); console.log((warn ? "  ⚠ " : "  ✗ ") + name); } }

console.log("=== F1 분석지 ===");
ok("주제·주장 존재", !!(a.topic && a.thesis));
ok("성분 전 문장(" + ((a.components || []).length) + "/" + ((a.sents || []).length) + ")", (a.components || []).length >= (a.sents || []).length - 1);
ok("성분 [SVOCM] 형식", (a.components || []).every(function (c) { return /\[[SVOCM]\s/.test(c.parse || ""); }) && (a.components || []).length > 0);
ok("흐름(flow) 존재", (a.flow || []).length >= 3);
ok("출제플로 데이터", (a.examFlow || []).length >= 3, true);

console.log("=== F2 문제지 ===");
var mcq = items.filter(function (q) { return q.choices && q.choices.length >= 4; });
var essay = items.filter(function (q) { return !q.choices || !q.choices.length; });
ok("전 문항 발문", items.every(function (q) { return q.instruction; }));
ok("MCQ 선지 5개", mcq.every(function (q) { return q.choices.length === 5; }));
var rxN = mcq.filter(function (q) { return /\[오답 진단·처방\]/.test(q.explanation || ""); }).length;
ok("Rx 부착 " + rxN + "/" + mcq.length, rxN >= mcq.length - 1);
ok("서술형 루브릭", essay.every(function (q) { return /채점 루브릭/.test(q.explanation || ""); }));

console.log("=== F3 동형모고 ===");
var MOCKNO = { "필자주장": 20, "함의": 21, "밑줄함의": 21, "요지": 22, "주제": 23, "제목": 24, "내용일치": 26, "어법": 29, "어휘": 30, "빈칸": 31, "무관문장": 35, "글의순서": 36, "문장삽입": 38, "요약문AB": 40 };
var mockable = items.filter(function (q) { return MOCKNO[q.type]; });
var extra = items.filter(function (q) { return !MOCKNO[q.type]; });
ok("수능 매핑 문항 " + mockable.length + "개(≥10)", mockable.length >= 10);
ok("[3점] 후보 존재", mockable.some(function (q) { return /함의|빈칸|순서|삽입/.test(q.type); }));
ok("서답형 분리 " + extra.length + "개", true);
ok("정답표 데이터(전 MCQ answer 유효)", mcq.every(function (q) { return q.answer >= 1 && q.answer <= 5; }));
ok("동형 지문 독립(각 문항 지문 보유 또는 공통지문 대체 가능)", items.every(function (q) { return (q.passage && q.passage.length > 50) || s.passage; }));

console.log("=== F4 워크북 ===");
var withWork = items.filter(function (q) { return q._work && q._work.steps && q._work.steps.length; });
ok("전 문항 _work " + withWork.length + "/" + items.length, withWork.length === items.length);
var g5 = items.filter(function (q) { return (q.type === "어법" || q.type === "어휘") && q._work; });
ok("어법·어휘 5단계", g5.every(function (q) { return q._work.steps.length === 5; }) && g5.length > 0);
var CIRC = ["①", "②", "③", "④", "⑤"], MK = ["ⓐ", "ⓑ", "ⓒ", "ⓓ", "ⓔ"];
var desync = 0;
withWork.forEach(function (q) {
  if (!q.choices || !q.choices.length) return;
  var st = q._work.steps.find(function (x) { return x.input === "pick"; }); if (!st) return;
  var m = String(st.reveal.answer).match(/[①②③④⑤ⓐ-ⓔ]/); if (!m) return;
  var rev = (CIRC.indexOf(m[0]) >= 0 ? CIRC.indexOf(m[0]) : MK.indexOf(m[0])) + 1;
  if (rev !== q.answer) desync++;
});
ok("reveal==answer 정합(desync " + desync + ")", desync === 0);

console.log("\n=== 형식 검사 결과 ===");
console.log(fails.length === 0 ? ("✅ 전 형식 합격" + (warns.length ? (" (경고 " + warns.length + ")") : "")) : ("✗ 불합격 " + fails.length + "건: " + fails.join(" / ")));
process.exit(fails.length ? 1 : 0);
