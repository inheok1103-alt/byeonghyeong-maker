/* compile_types.js — knowledge/exam_core_v1.json + exam_types_v1.json → knowledge/types_v2.json
 * 산출 계약: api_team.js loadTypeDB 호환 [{type, instruction, builder, on, guide}]
 * guide는 시스템 프롬프트(TYPERULE)로 주입되므로 소형모델 빈응답 방지를 위해 640자 상한으로 증류한다. */
const fs = require("fs");
const path = require("path");
const K = p => JSON.parse(fs.readFileSync(path.join(__dirname, "knowledge", p), "utf8"));
const core = K("exam_core_v1.json"), db = K("exam_types_v1.json");

const rName = id => (core.distractor_rules[id] || "").split(":")[0];
const tName = id => (core.traps[id] || "").split(/[—:]/)[0].trim();
const CAP = 640;

function distill(t) {
  const seg = [];
  seg.push("[의도] " + t.intent);
  seg.push("[정답] " + t.answer + (t.kind ? (" 선지형식=" + t.kind + "." ) : ""));
  if (t.distractors) {
    const roles = (t.distractors.roles || []).map(rName).join("·");
    seg.push("[오답] 역할=" + roles + ". " + (t.distractors.note || ""));
  }
  if (t.traps && t.traps.length) seg.push("[함정] " + t.traps.map(tName).join("; "));
  if (t.levers && t.levers["상"]) seg.push("[상급] " + t.levers["상"]);
  if (t.rubric) seg.push("[채점] " + t.rubric);
  if (t.transform) seg.push("[변형] " + t.transform);
  const qc = (t.qc || []).slice(0, 2).join("; ");
  if (qc) seg.push("[QC] " + qc);
  seg.push("[공통] 선지 길이±10%·형태통일·상호배타, 정답 재진술 금지, 절대어 주의.");
  // 상한 증류: 뒤 세그먼트부터 줄이되 [의도][정답][오답]은 보존
  let out = seg.join(" / ");
  while (out.length > CAP && seg.length > 3) { seg.splice(seg.length - 2, 1); out = seg.join(" / "); }
  if (out.length > CAP) out = out.slice(0, CAP - 1) + "…";
  return out;
}

const MODE = process.argv.includes("--full") ? "full" : "safe";
const rows = db.types.map(t => ({
  type: t.type,
  instruction: (t.stems && t.stems[0]) || "",
  builder: t.builder || "",
  on: MODE === "full" ? t.impl !== "builder-needed" : !!t.on_safe,
  guide: distill(t),
  // 앱은 아래 확장 필드를 무시하지만 서버 루틴·차기 빌더가 사용
  _impl: t.impl, _cat: t.cat, _freq: t.freq, _id: t.id
}));

const out = { updated: new Date().toISOString(), source: "exam_core_v1+exam_types_v1", mode: MODE, count: rows.filter(r => r.on).length, types: rows };
fs.writeFileSync(path.join(__dirname, "knowledge", "types_v2.json"), JSON.stringify(out, null, 1));

const on = rows.filter(r => r.on), off = rows.filter(r => !r.on);
console.log("컴파일 완료 → knowledge/types_v2.json (" + MODE + " 모드)");
console.log("  활성 " + on.length + "종: " + on.map(r => r.type).join(", "));
console.log("  대기 " + off.length + "종(빌더 개발 필요, guide는 선탑재): " + off.map(r => r.type).join(", "));
const gl = rows.map(r => r.guide.length);
console.log("  guide 길이: 평균 " + Math.round(gl.reduce((a, b) => a + b) / gl.length) + "자 · 최대 " + Math.max(...gl) + "자 (상한 " + CAP + ")");
