/* ===========================================================================
   Ray English — GitHub/HF 오픈 시험데이터 흡수기 (도메인 보강 + 정답100% gold)
   우리 코퍼스(언어학 원서) 약점을 "실제 영어시험 지문/문항"으로 메운다.

   현재 소스: CLOTH(중·고 영어시험 빈칸) — 정답+실제 오답이 통째로 있어
              LLM 없이 정답 100% 보장 '빈칸(어휘)' 학습샘플 생성.

   실행:  node selfllm/ingest_github.js [개수=300]
   출력:  selfllm/train.jsonl 에 이어붙임(중복 자동 제거)
   =========================================================================== */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var N = parseInt(process.argv[2], 10) || 300;
var SYS = "너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 지문을 분석해 정확한 문항·워크북·분석을 만든다.";
var CIRC = ["①", "②", "③", "④", "⑤"];
var realFetch = global.fetch ? global.fetch.bind(global) : null;
if (!realFetch) { console.error("이 Node엔 fetch가 없습니다(Node 18+ 필요)."); process.exit(1); }

async function hfRows(dataset, config, split, offset, length) {
  var url = "https://datasets-server.huggingface.co/rows?dataset=" + encodeURIComponent(dataset) + "&config=" + config + "&split=" + split + "&offset=" + offset + "&length=" + length;
  var r = await realFetch(url); if (!r.ok) throw new Error("HTTP " + r.status); var j = await r.json();
  return (j.rows || []).map(function (x) { return x.row; });
}
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function fmtQ(instruction, passage, choices, ans, explanation) {
  var s = "[발문] " + instruction + "\n[지문]\n" + passage + "\n";
  choices.forEach(function (c, i) { s += CIRC[i] + " " + c + "\n"; });
  return s + "[정답] " + CIRC[ans] + "\n[해설] " + explanation;
}
function recQ(type, passage, instruction, choices, ans, explanation) {
  return JSON.stringify({ messages: [
    { role: "system", content: SYS },
    { role: "user", content: "[유형] " + type + "\n[지문]\n" + passage + "\n\n위 지문으로 '" + type + "' 유형의 변형문항을 만들어라." },
    { role: "assistant", content: fmtQ(instruction, passage, choices, ans, explanation) }
  ] });
}

(async () => {
  // 기존 서명 로드(중복 방지)
  var seen = {};
  try { fs.readFileSync(ROOT + "/selfllm/train.jsonl", "utf8").split("\n").filter(Boolean).forEach(function (l) { try { var o = JSON.parse(l); var a = o.messages[2].content; seen[a.slice(0, 60)] = 1; } catch (e) {} }); } catch (e) {}

  var buf = [], added = 0, skip = 0, page = 100;
  console.log("CLOTH(실제 영어시험 빈칸) 흡수 시작 — 목표 " + N + "개…");
  for (var off = 0; added < N && off < N * 3; off += page) {
    var rows;
    try { rows = await hfRows("AndyChiang/cloth", "default", "train", off, Math.min(page, 100)); }
    catch (e) { console.log("페이지 " + off + " 실패: " + e.message); break; }
    if (!rows.length) break;
    for (var i = 0; i < rows.length && added < N; i++) {
      var r = rows[i]; var sent = String(r.sentence || ""), ans = String(r.answer || "").trim(), dis = (r.distractors || []).map(String);
      if (!sent || !ans || dis.length < 2) { skip++; continue; }
      if (!/\[?MASK\]?|_{2,}|\bblank\b/i.test(sent) && sent.indexOf(ans) < 0) { skip++; continue; }
      var passage = sent.replace(/\s*\[?MASK\]?\s*/g, " ______ ").replace(/_{2,}/g, "______").replace(/\s+/g, " ").trim();
      if (passage.indexOf("______") < 0) passage = passage.replace(ans, "______");
      if ((passage.match(/[A-Za-z]+/g) || []).length < 6) { skip++; continue; }
      var opts = shuffle([ans].concat(dis.slice(0, 3)));
      var ai = opts.indexOf(ans); if (ai < 0) { skip++; continue; }
      var exp = "정답은 '" + ans + "'. 실제 영어시험(CLOTH) 문항으로, 문맥상 빈칸에는 '" + ans + "'가 자연스럽다. 오답 " + dis.slice(0, 3).map(function (d) { return "'" + d + "'"; }).join("·") + "은(는) 문맥·연어상 부적절하다.";
      var rec = recQ("빈칸(어휘)", passage, "빈칸에 들어갈 말로 가장 적절한 것은?", opts, ai, exp);
      var sig = JSON.parse(rec).messages[2].content.slice(0, 60);
      if (seen[sig]) { skip++; continue; }
      seen[sig] = 1; buf.push(rec); added++;
    }
    process.stdout.write("\r흡수 " + added + "/" + N + " (건너뜀 " + skip + ")…   ");
  }
  // 왕복검증 후 이어붙이기
  var clean = buf.filter(function (l) { try { JSON.parse(l); return true; } catch (e) { return false; } });
  if (clean.length) fs.appendFileSync(ROOT + "/selfllm/train.jsonl", clean.join("\n") + "\n");
  var total = 0; try { total = fs.readFileSync(ROOT + "/selfllm/train.jsonl", "utf8").split("\n").filter(Boolean).length; } catch (e) {}
  console.log("\n\n===== 오픈 시험데이터 흡수 완료 =====");
  console.log("추가 " + clean.length + "개 (빈칸어휘·실제시험·정답100%) · 건너뜀 " + skip);
  console.log("누적 train.jsonl 총 " + total + "샘플");
})();
