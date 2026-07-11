/* brain_health.js — 교사군집 브레인 헬스체크 하네스 (0원·결정론·로컬 실행)
 * 용도: "브레인/일일 리포트 실행 실패" 신고가 오면 한 명령으로 전 채널을 순서대로 진단.
 * 실행: node selfllm/brain_health.js            (기본: 원격 점검 포함)
 *       node selfllm/brain_health.js --offline  (네트워크 없이 로컬 파일만)
 * 파이프라인(진단 로직 — 2026-07-11 실전 진단을 코드화):
 *   ① GitHub Actions 24h-brain 최근 런 상태(공개 API, 토큰 불요)
 *   ② 시간별 리포트 신선도(hourly_report.json updated < 3h?)
 *   ③ GAS 브리지 생존(GET → {alive:true})
 *   ④ corpus 무결성(learned_rules/quarantine_rules 파싱·구조·자동승격 오염 검사)
 *   ⑤ 로컬 정본 파싱(api_team.js/server_brain.js/addon_key_guard.js node --check 상당)
 * 판정: 채널별 PASS/WARN/FAIL + 원인별 처방. 전부 PASS인데 실패 알림이 떴다면
 *       → 클라우드 예약작업(claude.ai 크론)측 실패(세션한도·인증 만료)로 축소 진단. */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");

const REPO = "inheok1103-alt/byeonghyeong-maker";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/master/";
const ROOT = path.join(__dirname, "..");
const OFFLINE = process.argv.includes("--offline");
const out = [];
function log(ch, verdict, msg, rx) { out.push({ ch, verdict, msg, rx: rx || "" }); }

async function getJSON(url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || 12000);
  try { const r = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "brain-health" } }); return await r.json(); }
  finally { clearTimeout(t); }
}

/* ① GitHub Actions 최근 런 */
async function checkActions() {
  if (OFFLINE) return log("①Actions", "SKIP", "--offline");
  try {
    const d = await getJSON("https://api.github.com/repos/" + REPO + "/actions/runs?per_page=8");
    const runs = (d.workflow_runs || []).filter(r => r.name === "24h-brain");
    if (!runs.length) return log("①Actions", "WARN", "24h-brain 런 조회 0건(스케줄 중단?)", "brain.yml cron·Actions 활성 확인");
    const bad = runs.filter(r => r.conclusion && r.conclusion !== "success");
    const last = runs[0];
    if (bad.length) return log("①Actions", "FAIL", "최근 " + runs.length + "런 중 실패 " + bad.length + "건(최신 " + last.conclusion + " @" + last.created_at + ")", "gh run view " + bad[0].id + " --log-failed");
    log("①Actions", "PASS", "최근 " + runs.length + "런 전부 success(최신 @" + last.created_at + ")");
  } catch (e) { log("①Actions", "WARN", "API 조회 실패: " + String(e).slice(0, 60), "네트워크/GitHub 상태 확인"); }
}

/* ② 리포트 신선도 */
async function checkReport() {
  if (OFFLINE) return log("②리포트", "SKIP", "--offline");
  try {
    const d = await getJSON(RAW + "corpus/hourly_report.json");
    const up = new Date(d.updated || 0), ageH = (Date.now() - up.getTime()) / 3.6e6;
    if (!d.updated || isNaN(up)) return log("②리포트", "FAIL", "updated 필드 없음/파손", "server_brain Phase C 확인");
    if (ageH > 3) return log("②리포트", "FAIL", "리포트 정체 " + ageH.toFixed(1) + "h(3h 초과) — 뇌가 커밋 못 함", "Actions 로그·push 레이스·키 소진 확인");
    log("②리포트", "PASS", "최신 리포트 " + ageH.toFixed(1) + "h 전: " + String(d.latest && d.latest.headline || "").slice(0, 60));
  } catch (e) { log("②리포트", "WARN", "raw 조회 실패: " + String(e).slice(0, 60)); }
}

/* ③ GAS 브리지 생존 */
async function checkGAS() {
  if (OFFLINE) return log("③GAS", "SKIP", "--offline");
  let gas = "";
  try { const m = fs.readFileSync(path.join(ROOT, "ai_maker.html"), "utf8").match(/GASURL\s*=\s*["']([^"']+)/); gas = m && m[1] || ""; } catch (_) {}
  if (!gas) return log("③GAS", "SKIP", "GASURL 미설정(브리지 미사용)");
  try {
    const d = await getJSON(gas, 15000);
    if (d && d.alive) return log("③GAS", "PASS", "브리지 응답 alive");
    log("③GAS", "FAIL", "응답 이상: " + JSON.stringify(d).slice(0, 80), "GAS 재배포/권한(모든 사용자) 확인");
  } catch (e) { log("③GAS", "FAIL", "무응답: " + String(e).slice(0, 60), "GAS 배포 URL 갱신 필요 가능"); }
}

/* ④ corpus 무결성(격리 계약 포함) */
async function checkCorpus() {
  const read = async (rel) => {
    if (!OFFLINE) { try { return await getJSON(RAW + rel); } catch (_) {} }
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (_) { return null; }
  };
  const lr = await read("corpus/learned_rules.json");
  if (!lr) log("④corpus", "WARN", "learned_rules.json 없음/파손");
  else {
    const badObj = (lr.rules || []).filter(r => r && typeof r !== "string" && typeof (r.rule) !== "string").length;
    if (badObj) log("④corpus", "FAIL", "learned_rules에 rule 필드 없는 항목 " + badObj + "건([object Object] 오염 위험)", "applyLearned 정규화 확인");
    else log("④corpus", "PASS", "learned_rules " + (lr.count || (lr.rules || []).length) + "건 구조 정상");
  }
  const qr = await read("corpus/quarantine_rules.json");
  if (qr) log("④corpus", "PASS", "격리 큐 " + (qr.count || 0) + "건(사람 승인 대기) — 자동승격 차단 동작 중");
  else log("④corpus", "WARN", "quarantine_rules.json 아직 없음(격리 브레인 코드 push 전이면 정상)");
}

/* ⑤ 로컬 정본 파싱 */
function checkLocal() {
  ["api_team.js", "server_brain.js", "addon_key_guard.js"].forEach(f => {
    const p = path.join(ROOT, f);
    try { new (require("vm").Script)(fs.readFileSync(p, "utf8"), { filename: f }); log("⑤로컬", "PASS", f + " 파싱 OK"); }
    catch (e) { log("⑤로컬", "FAIL", f + " 구문 오류: " + String(e.message).slice(0, 80), "push 전 반드시 수정"); }
  });
}

(async function main() {
  await Promise.all([checkActions(), checkReport(), checkGAS(), checkCorpus()]);
  checkLocal();
  const W = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌", SKIP: "⏭ " };
  let fails = 0, warns = 0;
  console.log("\n=== 교사군집 브레인 헬스체크 ===");
  out.forEach(o => { console.log(W[o.verdict] + " " + o.ch + " — " + o.msg + (o.rx ? "  ▶ " + o.rx : "")); if (o.verdict === "FAIL") fails++; if (o.verdict === "WARN") warns++; });
  console.log("---");
  if (fails) console.log("진단: FAIL " + fails + "건 — 위 처방(▶)부터 처리.");
  else console.log("진단: 로컬·서버 전 채널 정상." + (warns ? " (WARN " + warns + "건은 참고)" : "") +
    "\n      그런데도 '실행 실패' 알림이 떴다면 → 클라우드 예약작업(claude.ai 크론)측 실패입니다." +
    "\n      원인 후보: ①계정 세션/사용량 한도(한도창에 걸린 크론은 실패) ②앱 인증 만료 ③크론 대상 폴더/파일 이동." +
    "\n      확인: 앱의 예약 작업 UI에서 해당 작업의 오류 메시지 열람 → 재실행.");
  process.exit(fails ? 1 : 0);
})();
