/* board_data_harness.js — 지문 → 수업 JSON(기획서 §17 스키마)
 * analysisSheet(문장·성분·흐름) + 수업메타(첫대면·결속·핵심문장 행분리) + 동화고 문항(주제) + 조건영작
 * 사용: node selfllm/board_data_harness.js <지문파일> <out.json> [제목] */
var fs = require("fs"), path = require("path");
global.window = {};
var realFetch = global.fetch;
global.fetch = function (url, opts) {
  var u = String(url), map = {
    "types_v2.json": "../knowledge/types_v2.json",
    "donghwa_exam_logic.json": "../knowledge/donghwa_exam_logic.json",
    "donghwa_construction_recipes.json": "../knowledge/donghwa_construction_recipes.json",
    "exam_type_taxonomy.json": "../knowledge/exam_type_taxonomy.json",
    "examiner_kb_v1.json": "../knowledge/examiner_kb_v1.json"
  };
  for (var k in map) { if (map.hasOwnProperty(k) && u.indexOf(k) >= 0) { try { var d = JSON.parse(fs.readFileSync(path.join(__dirname, map[k]), "utf8")); return Promise.resolve({ ok: true, json: function () { return Promise.resolve(d); } }); } catch (e) { break; } } }
  return realFetch(url, opts);
};
eval(fs.readFileSync(path.join(__dirname, "../api_team.js"), "utf8"));
try { eval(fs.readFileSync(path.join(__dirname, "../addon_key_guard.js"), "utf8")); } catch (e) {}
var T = global.window.APITEAM;

(async function () {
  T.configure({ proxyUrl: "https://ray-proxy.gen1103.workers.dev" });
  try { await T.loadTypeDB("knowledge/types_v2.json"); await T.loadExaminerKB(); } catch (e) {}
  await T.loadDonghwa(); await T.loadTaxonomy().catch(function () {}); await T.loadRecipes().catch(function () {});
  T.donghwaMode(true);
  var pgFile = process.argv[2], outFile = process.argv[3] || "selfllm/_lesson.json";
  var title = process.argv[4] || "";
  var QTYPE = process.argv[5] || "주제", WTYPE = process.argv[6] || "조건영작";
  var pg = fs.readFileSync(pgFile, "utf8").trim();
  var t0 = Date.now();

  console.error("① 분석지 데이터…");
  var an = await T.analysisSheet(pg, {});
  if (!an) { console.error("분석 실패"); process.exit(1); }

  console.error("② 수업 메타(첫대면·결속·핵심문장)…");
  var listed = (an.sents || []).map(function (s) { return s.n + ". " + s.en; }).join("\n");
  var meta = await T.llmJSON([
    { role: "system", content: "너는 고교 영어 수업 설계자다. JSON만." },
    { role: "user", content: "다음 지문의 수업 메타를 만들어라.\n" + listed +
      "\n\nJSON: {\"title_ko\":\"수업 대제목(질문형, 한국어 15자 이내)\",\"memo\":{\"material\":\"소재(한국어 명사구)\",\"direction\":\"방향(통념반박/문제제기/설명/주장 중)\",\"shift\":\"(n) 전환어\",\"conclusion\":\"예상 결론(한국어 한 문장)\"},\"key_sentence_n\":핵심(주장)문장 번호,\"key_lines\":[\"핵심문장을 의미단위 2~4행으로 분리(원문 그대로, 행당 10~13단어)\"],\"cohesion\":[{\"from\":\"앞 표현(원문)\",\"to\":\"재지시 표현(원문)\"} 2~3쌍],\"core3\":[\"구조 핵심 한 문장(한국어)\",\"논리 핵심 한 문장\",\"시험적용 핵심 한 문장\"],\"wrong_codes\":[{\"code\":\"F|S|WR\",\"miss\":\"놓친 것(한국어 12자내)\",\"fix\":\"처방(한국어 15자내)\"} 3개]}. JSON만." }
  ], { noRule: true, timeout: 70000 });
  if (!meta) meta = {};

  console.error("③ 동화고 문항(" + QTYPE + ")…");
  var q = null;
  for (var a = 0; a < 2 && !q; a++) { q = await T.generateOne(pg, QTYPE, { fast: true }).catch(function () { return null; }); }

  console.error("④ 서술형(" + WTYPE + ")…");
  var w = null;
  for (var a2 = 0; a2 < 2 && !w; a2++) { w = await T.generateOne(pg, WTYPE, { fast: true }).catch(function () { return null; }); }

  var lesson = {
    "class": { school: "동화고", grade: "1", lesson: "R08", date: new Date().toISOString().slice(0, 10) },
    passage: {
      title: title || (meta.title_ko || ""),
      topic: an.topic || "", text: (an.sents || []).map(function (s) { return s.en; }),
      ko: (an.sents || []).map(function (s) { return s.ko; }),
      syntax: (an.sents || []).map(function (s) { return s.syntax; }),
      fn: (an.sents || []).map(function (s) { return s.fn; }),
      key_sentence: meta.key_sentence_n || ((an.sents || []).length),
      key_lines: meta.key_lines || []
    },
    analysis: {
      material: (meta.memo && meta.memo.material) || an.topic || "",
      direction: (meta.memo && meta.memo.direction) || "",
      shift: (meta.memo && meta.memo.shift) || "",
      conclusion: (meta.memo && meta.memo.conclusion) || an.thesis || "",
      main_idea_ko: an.thesis || "",
      logic: (an.flow || []).map(function (f) { return { n: f.n, role: f.role, note: f.note || "" }; }),
      components: an.components || [],
      cohesion: meta.cohesion || [],
      vocab: an.vocab || [], points: an.points || [], examFlow: an.examFlow || []
    },
    question: q ? { type: q.type, stem: q.instruction, passage: q.passage || "", choices: q.choices, answer: q.answer, explanation: q.explanation } : null,
    writing: w ? { instruction: w.instruction, explanation: w.explanation } : null,
    core3: meta.core3 || [], wrong_codes: meta.wrong_codes || []
  };
  fs.writeFileSync(outFile, JSON.stringify(lesson, null, 1));
  console.error("WROTE " + outFile + " — 문장 " + lesson.passage.text.length + " · 문항 " + (q ? "OK" : "실패") + " · 영작 " + (w ? "OK" : "실패") + " · " + Math.round((Date.now() - t0) / 1000) + "s");
})().catch(function (e) { console.error("ERR", (e && e.stack || e).toString().slice(0, 400)); process.exit(1); });
