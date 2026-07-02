/* gas_bridge.gs — 오류 로그 + 사용자 요청 큐 (Google Apps Script 웹앱)
 * 배포: 스프레드시트 연결 스크립트 → 배포 > 웹앱 > 액세스 '모든 사용자' → URL을
 *       ① Actions Secret GAS_URL  ② ai_maker.html의 FEEDURL(config.json logUrl) 에 등록.
 * 시트: log(ts,type,payload) / queue(ts,request,user,status,verdict,reason) — 없으면 자동 생성 */
const SS = SpreadsheetApp.getActiveSpreadsheet();
function sh(n, heads) { let s = SS.getSheetByName(n); if (!s) { s = SS.insertSheet(n); if (heads && heads.length) s.appendRow(heads); } return s; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function body(e) { try { if (e.postData && e.postData.contents) return JSON.parse(e.postData.contents); } catch (_) {} return (e && e.parameter) || {}; }

function doPost(e) {
  const b = body(e);
  if (b.kind === "request") {                 // 브라우저 → 요청 접수(다음 시각 뇌가 심의)
    sh("queue", ["ts","request","user","status","verdict","reason"])
      .appendRow([new Date(), String(b.request || "").slice(0, 1000), b.user || "", "pending", "", ""]);
    return out({ ok: true, queued: true });
  }
  if (b.kind === "resolve") {                 // 뇌 → 심의 결과 기록
    const s = sh("queue", ["ts","request","user","status","verdict","reason"]);
    const row = Number(b.row);
    if (row > 1 && row <= s.getLastRow())
      s.getRange(row, 4, 1, 3).setValues([["done", b.verdict || "", String(b.reason || "").slice(0, 500)]]);
    return out({ ok: true, resolved: row });
  }
  sh("log", ["ts","type","payload"]).appendRow([new Date(), b.type || "log", JSON.stringify(b).slice(0, 5000)]); // 기존 오류로그 유지
  return out({ ok: true, logged: true });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.queue === "1") {                      // 뇌 → 대기 요청 조회(최대 5)
    const v = sh("queue", ["ts","request","user","status","verdict","reason"]).getDataRange().getValues();
    const q = [];
    for (let i = 1; i < v.length && q.length < 5; i++) if (v[i][3] === "pending") q.push({ row: i + 1, request: v[i][1] });
    return out({ queue: q });
  }
  if (p.hints === "1") {                      // 기존 힌트 경로 유지
    const v = sh("log", ["ts","type","payload"]).getDataRange().getValues().slice(-8);
    return out({ hints: v.map(r => String(r[2]).slice(0, 180)) });
  }
  return out({ alive: true, ts: new Date() });
}
