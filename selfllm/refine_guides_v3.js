/* 심화 출제 게이트 v3 — Ray's Drill 어법·어휘·서술형 심화로직(knowledge/rays_drill_deep_logic.md) 흡수.
   어법=FMU·범주/기능·레지스터·패턴 게이트, 어휘=어휘단위·의미장·연어 게이트, 서술형=Clarity·힌트사다리·허용답안 3층.
   재실행 안전(◆심화 marker). */
var fs = require("fs");
var P = __dirname + "/../knowledge/types_v2.json";
var d = JSON.parse(fs.readFileSync(P, "utf8")); var ts = d.types || d;

var GATE_GRAM = " ◆심화(어법게이트): ①범주/기능 분리 — 해설은 품사명이 아니라 문장 내 기능(주어/보어/수식어)으로 근거 서술 ②Form-Meaning-Use 3층 통과 — 형태 공식만으로 풀리는 문제 금지, 의미 차이가 분명하고 문맥이 판단에 기여해야 함 ③register — 구어체·문체 차이를 오류로 단정 금지(written standard 기준) ④construction 패턴 단위 타게팅(allow A to V, stop A from -ing 등) ⑤두 형태가 모두 가능하면 그 밑줄 재선정(모호성 게이트). 해설=구조+의미+사용 조건.";
var GATE_VOC = " ◆심화(어휘게이트): 출제 단위를 명시(word/word family/collocation/chunk/pattern). semantic field 4개 이상 구성 후 정답·오답 전부 같은 품사·같은 의미장에서. 오답은 문맥 논리·정도(부분→전부)·결합(연어)·초점 중 하나만 어긋나게 — 표면상 자연스러운 것만. 금지: 사전 뜻 암기형, 품사 다른 오답, 문맥 없이 제거되는 오답. 정답 단어가 지문 다른 곳에 그대로 노출 금지. 해설에 문맥 기능(대조/인과/재진술 중 무엇에 기여) 포함.";
var GATE_CR = " ◆심화(서술형게이트): 모범답안 선작성 후 Clarity 검증 — ①핵심 행위자=주어 ②핵심 의미=동사(명사화 과잉 금지) ③구정보→신정보 흐름. 힌트사다리 H1(뜻)→H2(+필수어)→H3(+단어수)→H4(+첫단어)→H5(+주어/시작구)→H6(+핵심동사)에서 수준 선택 — 첫 단어가 The/It처럼 약하면 주어·시작구 제공, 조건 단어가 주어와 겹치면 다른 핵심어로 교체. 단어수=모범답안 실측(띄어쓰기 기준, 축약형·하이픈어=1단어). 허용답안 3층(A모범/B동의변형/C부분감점)과 조건↔채점기준 1:1 연결.";
var GATE_CONN = " ◆심화(담화게이트): 연결어=담화관계 표지(Zufferey). 정답 관계(인과/결과/대조/양보/부연/예시/재진술/조건/시간/요약)를 먼저 타게팅, 오답은 서로 다른 담화관계의 표지로 구성. 해설은 '뜻이 ~라서'가 아니라 '앞 문장=X, 뒤 문장=Y이므로 Z관계'로 서술.";

var n = 0;
ts.forEach(function (t) {
  var g = t.guide || ""; if (g.indexOf("◆심화(") >= 0) return;
  var add = "";
  if (/어법|어형변형|틀린문장|문장전환/.test(t.type)) add = GATE_GRAM;
  if (/어휘|유의어|영영|첫글자|본문찾아쓰기/.test(t.type)) add += GATE_VOC;
  if (/영작|서술|해석|고쳐쓰기|완성|요약빈칸|어법수정|어형변형|문장전환|지칭명시/.test(t.type)) add += GATE_CR;
  if (/연결어/.test(t.type)) add = GATE_CONN;
  if (add) { t.guide = g + add; n++; }
});
d.meta = d.meta || {}; d.meta.deepGates = "심화게이트 v3(FMU·어휘단위·Clarity·담화) " + n + "종";
fs.writeFileSync(P, JSON.stringify(d, null, 1));
console.log("심화게이트 주입:", n, "종");
