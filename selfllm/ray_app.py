# -*- coding: utf-8 -*-
"""RAY English Production OS browser workspace.

The local 8792 server is the product surface. It serves every authoring tool,
the local knowledge index, file intake, QA, and Claude/Codex collaboration in
one browser shell without requiring a paid API route.
"""
import sys, io, os, json, threading, webbrowser, subprocess, time, urllib.parse
import hashlib, re
from email.parser import BytesParser
from email.policy import default as email_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__))
SYSTEM_ROOT = os.path.abspath(
    os.environ.get("RAY_OS_ROOT") or os.path.join(HERE, "..", "..", "..", "..")
)
WEBROOT = os.path.dirname(HERE)   # 기존 HTML 도구들이 있는 web/ 루트
PORT = int(os.environ.get("RAY_PORT", "8792"))
OUT_DIR = os.path.join(SYSTEM_ROOT, "03_CLASS_BOARDS", "LIVE_board_outputs")
LOCAL_DATA = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "RAYEnglish")
UPLOAD_DIR = os.path.join(LOCAL_DATA, "uploads")
MAX_UPLOAD_BYTES = 80 * 1024 * 1024
SUPPORTED_UPLOADS = {
    ".pdf", ".docx", ".pptx", ".hwp", ".hwpx", ".xlsx",
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff",
    ".txt", ".md", ".csv", ".json",
}
DEBATE_JOBS = {}
DEBATE_LOCK = threading.Lock()
CT = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
      ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}

TOOLS = [
    ("exam.html", "Q", "문제 제작", "17개 문항 유형"),
    ("ai_maker.html", "AI", "AI 메이커", "출제·정답 검증"),
    ("sheet.html", "AN", "분석지", "구조·구문·어휘"),
    ("workbook.html", "WB", "워크북", "학생용 교재"),
    ("board_maker.html", "ST", "수업보드", "PPT·판서·세트"),
    ("report.html", "RP", "리포트", "학습·출제 기록"),
]

WORKSPACE_MODULES = [
    {"key": "app", "label": "제작 엔진", "description": "8792 서버와 자동화 소스", "path": os.path.join(SYSTEM_ROOT, "01_ACTIVE_APP")},
    {"key": "analysis", "label": "분석지", "description": "SECTIO·THE ANATOMY·출력", "path": os.path.join(SYSTEM_ROOT, "02_ANALYSIS_SHEETS")},
    {"key": "boards", "label": "수업보드", "description": "PPT 템플릿·EBS·라이브 출력", "path": os.path.join(SYSTEM_ROOT, "03_CLASS_BOARDS")},
    {"key": "questions", "label": "문제은행", "description": "유형 하네스·문항 제작기", "path": os.path.join(SYSTEM_ROOT, "04_QUESTION_BANK")},
    {"key": "schools", "label": "학교·브랜드", "description": "동화고 등 학교별 운영 자료", "path": os.path.join(SYSTEM_ROOT, "05_BRAND_AND_SCHOOL")},
    {"key": "outputs", "label": "최종 결과물", "description": "배포용 PDF·PPTX·DOCX", "path": os.path.join(SYSTEM_ROOT, "06_OUTPUT_LIBRARY")},
    {"key": "knowledge", "label": "지식·설계", "description": "로직·MD·JSON·검수 기록", "path": os.path.join(SYSTEM_ROOT, "07_KNOWLEDGE_AND_MD")},
    {"key": "references", "label": "참고 자료", "description": "교재·원서·연구 자료", "path": os.path.join(SYSTEM_ROOT, "08_REFERENCE_LIBRARY")},
    {"key": "system", "label": "시스템 원장", "description": "매니페스트·검증·이식 기록", "path": os.path.join(SYSTEM_ROOT, "99_MANIFEST")},
]
WORKSPACE_BY_KEY = {item["key"]: item for item in WORKSPACE_MODULES}
RECENT_EXTENSIONS = {".pdf", ".pptx", ".docx", ".xlsx", ".md", ".html", ".png", ".jpg", ".jpeg"}
RECENT_SKIP_DIRS = {".git", "node_modules", "__pycache__", "temp", "tmp", "cache", ".ray_ocr"}
WORKSPACE_CACHE = {"at": 0.0, "payload": None}
WORKSPACE_LOCK = threading.Lock()

def PAGE_LEGACY():
    cards = "".join(
        f'<a class=tool href="/{u}" target=_blank><div class=ic>{ic}</div><h4>{t}</h4><p>{d}</p></a>'
        for u, ic, t, d in TOOLS)
    return """<!DOCTYPE html><html lang=ko><head><meta charset=utf-8><title>RAY 올인원 제작기</title>
<style>
:root{--bg:#0b0c10;--pan:#15171e;--pan2:#1d2029;--ln:#2a2e3a;--ink:#f2f3f5;--mut:#9aa3b0;--gold:#d8b968}
*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI","맑은 고딕",sans-serif}
body{background:var(--bg);color:var(--ink);padding:26px 20px 60px;max-width:1000px;margin:0 auto}
.tag{background:var(--gold);color:#14151a;font-weight:700;font-size:12px;padding:3px 10px;border-radius:6px}
h1{font-size:27px;margin:10px 0 2px}.sub{color:var(--mut);font-size:14px}
.rule{height:2px;background:var(--gold);margin:14px 0 20px;border-radius:2px}
h3{font-size:15px;margin:22px 0 10px;display:flex;align-items:center;gap:8px}h3::before{content:"";width:8px;height:17px;background:var(--gold);border-radius:3px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
a.tool{display:block;text-decoration:none;background:var(--pan);border:1px solid var(--ln);border-radius:12px;padding:15px;transition:.13s}
a.tool:hover{border-color:var(--gold);transform:translateY(-2px)}a.tool .ic{font-size:23px}a.tool h4{color:var(--ink);font-size:15px;margin:7px 0 3px}a.tool p{color:var(--mut);font-size:12px}
.card{background:var(--pan);border:1px solid var(--ln);border-radius:12px;padding:16px;margin:10px 0}
textarea{width:100%;height:130px;background:var(--pan2);color:var(--ink);border:1px solid var(--ln);border-radius:10px;padding:12px;font-size:14px;resize:vertical}
.row{display:flex;gap:10px;margin:12px 0 0;flex-wrap:wrap;align-items:center}
select,button{background:var(--pan2);color:var(--ink);border:1px solid var(--ln);border-radius:8px;padding:10px 14px;font-size:14px;cursor:pointer}
button.go{background:var(--gold);color:#14151a;font-weight:700;border:0}button:hover{filter:brightness(1.12)}
#log{white-space:pre-wrap;font-size:12.5px;color:#cdd4de;background:#0f1116;border:1px solid var(--ln);border-radius:10px;padding:12px;min-height:44px;max-height:240px;overflow:auto;margin-top:10px}
#status{color:var(--mut);font-size:13px;margin-top:8px}.k{color:var(--mut)}a{color:#e8d5a5}
</style></head><body>
<span class=tag>RAY ENGLISH · 올인원 제작기 · 로컬</span>
<h1>모든 제작을 한 곳에서</h1>
<div class=sub>문제제작·분석지·워크북·AI메이커 + 수업PPT/학생용 자동생성 + 24시간 뇌. 추가비용 0.</div>
<div class=rule></div>

<h3>제작 도구</h3>
<div class=grid>__CARDS__</div>

<h3>수업 자료 자동생성 (지문 → 판서 PPT + 학생용)</h3>
<div class=card>
  <textarea id=psg placeholder="영어 지문을 붙여넣으세요..."></textarea>
  <div class=row>
    <select id=kind><option value=reading>독해(제목·주제·빈칸)</option><option value=grammar>어법(무료 자동+검증, 실패시 페이블)</option></select>
    <button class=go onclick=make()>🚀 제작 시작</button>
    <button onclick=stat()>상태</button><button onclick=review()>검수함</button>
    <span class=k>결과: <a href="#" onclick="fetch('/open',{method:'POST'});return false">_RAY수업보드 열기</a></span>
  </div>
  <div id=log>대기 중…</div>
  <div id=status></div>
</div>
<div class=sub>페이블(이 챗) 연동: 어법이 무료로 안 풀리면 <b>_fable/requests</b>에 요청 → VS Code의 Claude(페이블)가 검수 → 자동 확정.</div>

<h3>AI 대화 (GPT 자유 호출 · 무료)</h3>
<div class=card>
  <div id=chat style="max-height:260px;overflow:auto;font-size:13.5px;line-height:1.5"></div>
  <div class=row>
    <input id=cin placeholder="GPT에게 무엇이든 물어보세요 (출제 아이디어·검수·번역·해설...)" style="flex:1;background:var(--pan2);color:var(--ink);border:1px solid var(--ln);border-radius:8px;padding:10px 12px;font-size:14px" onkeydown="if(event.key==='Enter')chat()">
    <button class=go onclick=chat()>보내기</button>
    <button onclick="CH=[];document.getElementById('chat').innerHTML=''">초기화</button>
  </div>
  <div class=sub style="margin-top:6px">모델: GPT(gpt-oss, 무료 pollinations) · Claude(페이블)는 VS Code의 이 챗에서 직접 대화하세요.</div>
</div>
<script>
let CH=[];
async function chat(){const i=document.getElementById('cin');const q=i.value.trim();if(!q)return;i.value='';
 CH.push({role:'user',content:q});render();CH.push({role:'assistant',content:'…'});render();
 try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:CH.slice(0,-1)})});
  const d=await r.json();CH[CH.length-1]={role:'assistant',content:d.reply||('오류: '+(d.error||'응답 없음'))};}
 catch(e){CH[CH.length-1]={role:'assistant',content:'오류: '+e};}render();}
function render(){document.getElementById('chat').innerHTML=CH.map(m=>
  `<div style="margin:7px 0"><b style="color:${m.role==='user'?'#d8b968':'#6fe39a'}">${m.role==='user'?'나':'GPT'}</b> ${(m.content||'').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>`).join('');
  const c=document.getElementById('chat');c.scrollTop=c.scrollHeight;}
</script>
<script>
const L=document.getElementById('log');function log(t){L.textContent=t;}
async function make(){const p=document.getElementById('psg').value.trim();if(!p){log('지문을 넣어주세요');return;}
 const k=document.getElementById('kind').value;log('제작 중… (뇌 분석→마크업→렌더, 약 10~20초)');
 try{const r=await fetch('/make',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passage:p,kind:k})});
  const d=await r.json();log(d.log||JSON.stringify(d));stat();}catch(e){log('오류: '+e);}}
async function stat(){const r=await fetch('/status');const d=await r.json();
 document.getElementById('status').innerHTML=`뇌 토큰 <b>${d.tokens}/${d.budget}</b> · 지식 <b>${d.vocab}</b>개 · 누적생성 <b>${d.runs}</b> · 검수대기 <b>${d.review}</b>건 · 유료 ${d.paid}`;}
async function review(){const r=await fetch('/review');const d=await r.json();
 document.getElementById('status').innerHTML='<b>검수 대기('+d.items.length+'건)</b> '+(d.items.map(x=>x.header).join(', ')||'없음');}
stat();
</script></body></html>""".replace("__CARDS__", cards)


def PAGE():
    cards = "".join(
        f'<button class="tool" type="button" data-tool="{os.path.splitext(u)[0]}" '
        f'onclick="openTool(\'{os.path.splitext(u)[0]}\')" title="{d}">'
        f'<span class="tool-icon">{ic}</span><span><b>{t}</b><small>{d}</small></span></button>'
        for u, ic, t, d in TOOLS
    )
    tool_data = json.dumps({
        os.path.splitext(url)[0]: {"url": f"/{url}", "title": title, "description": description}
        for url, _icon, title, description in TOOLS
    }, ensure_ascii=False)
    return r"""<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RAY English Production OS</title>
<style>
:root{--bg:#0b0d11;--surface:#15181e;--surface2:#1b1f27;--line:#303640;--ink:#f5f6f7;--muted:#9ca6b1;--gold:#dfbd64;--teal:#4fc4b2;--coral:#ed7f75;--blue:#73a8ff;--green:#75d39a}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI","Malgun Gothic",sans-serif;font-size:14px;letter-spacing:0}
button,input,select,textarea{font:inherit;letter-spacing:0}.shell{width:min(1480px,calc(100% - 32px));margin:0 auto;padding:18px 0 48px}
[hidden]{display:none!important}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid var(--line);padding:0 0 14px}.brand{display:flex;align-items:center;gap:12px}.brand-button{border:0;background:transparent;color:var(--ink);padding:0;text-align:left;cursor:pointer}.brand-button:hover .brand-mark{box-shadow:0 0 0 2px #dfbd6438}.brand span.brand-mark{width:38px;height:38px;display:grid;place-items:center;background:var(--gold);color:#111318;font-size:14px;font-weight:900;border-radius:6px;margin:0}.brand strong{display:block;font-size:17px}.brand span{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.badges{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.badge{border:1px solid var(--line);color:var(--muted);padding:5px 8px;border-radius:5px;font-size:11px}.badge.live{border-color:#2f6659;color:var(--teal)}.badge.free{border-color:#6c5a2e;color:var(--gold)}
.toolbar{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:14px 0}.tool{min-width:0;min-height:62px;display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;text-align:left;cursor:pointer;background:var(--surface);border:1px solid var(--line);padding:10px;border-radius:7px}.tool:hover{border-color:var(--gold);background:#191c22}.tool.active{border-color:var(--gold);background:#1d1b15}.tool>span:last-child{min-width:0}.tool-icon{width:31px;height:31px;display:grid;place-items:center;border:1px solid #615534;color:var(--gold);font-size:11px;font-weight:800;border-radius:5px;flex:0 0 auto}.tool b,.tool small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tool b{font-size:13px}.tool small{font-size:10.5px;color:var(--muted);margin-top:3px}
.tool-workspace{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}.tool-frame-head{height:54px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:0 12px;border-bottom:1px solid var(--line);background:#11141a}.tool-frame-title{min-width:0}.tool-frame-title b,.tool-frame-title span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tool-frame-title b{font-size:13px}.tool-frame-title span{font-size:10.5px;color:var(--muted);margin-top:2px}.icon-button{width:36px;height:36px;border:1px solid var(--line);border-radius:6px;background:var(--surface2);color:var(--ink);cursor:pointer;font-size:16px}.icon-button:hover{border-color:var(--gold);color:var(--gold)}.tool-frame{display:block;width:100%;height:calc(100vh - 126px);min-height:720px;border:0;background:#0b0d11}.frame-loading{position:absolute;inset:54px 0 0;display:grid;place-items:center;background:#0b0d11;color:var(--muted);font-size:12px}.tool-frame-wrap{position:relative}.tool-frame-wrap.loaded .frame-loading{display:none}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:19px 0 8px}.section-head h2{font-size:15px;margin:0}.section-head h2 span{color:var(--gold);margin-right:7px}.section-head p{margin:0;color:var(--muted);font-size:11px}
.workspace{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.75fr);background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden}.source{padding:16px;border-right:1px solid var(--line)}.controls{padding:16px;background:#12151a}
.source-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.file-line{min-width:0}.file-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.file-meta{color:var(--muted);font-size:11px;margin-top:3px}.format-strip{display:flex;gap:4px;flex-wrap:wrap}.format-strip span{font-size:9px;color:#aab2bb;border:1px solid var(--line);padding:3px 5px;border-radius:4px}
.file-button,.btn{height:38px;border:1px solid var(--line);border-radius:6px;background:var(--surface2);color:var(--ink);padding:0 12px;cursor:pointer}.file-button:hover,.btn:hover{border-color:var(--gold)}.file-button{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}.file-button input{display:none}
#dropzone{border:1px dashed #454d59;border-radius:7px;padding:10px;background:#11141a;transition:.15s}#dropzone.over{border-color:var(--teal);background:#111b1a}textarea{display:block;width:100%;min-height:265px;resize:vertical;background:transparent;border:0;outline:0;color:var(--ink);line-height:1.62;font-family:"Segoe UI","Malgun Gothic",sans-serif;font-size:14px}textarea::placeholder{color:#68727f}
details{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}summary{color:var(--muted);font-size:11px;cursor:pointer}.extract{white-space:pre-wrap;color:#c4cad1;font-size:11.5px;line-height:1.55;max-height:220px;overflow:auto;margin-top:8px}
.control-group{margin-bottom:17px}.control-group label{display:block;font-size:11px;color:var(--muted);margin-bottom:7px;text-transform:uppercase;font-weight:700}.seg{display:grid;grid-template-columns:1fr 1fr;gap:6px}.seg button{height:42px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);border-radius:6px;cursor:pointer}.seg button.active{color:#17191e;background:var(--gold);border-color:var(--gold);font-weight:800}
.primary{width:100%;height:44px;border:0;border-radius:6px;background:var(--gold);color:#111318;font-weight:800;cursor:pointer}.primary:disabled,.file-button.disabled{opacity:.45;cursor:wait}.minor-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.minor-row .btn{width:100%}
.progress{height:4px;background:#252a32;margin:17px 0 10px;overflow:hidden;border-radius:2px}.progress span{display:block;height:100%;width:0;background:var(--teal);transition:width .25s}.progress.busy span{width:72%;animation:pulse 1.2s ease-in-out infinite alternate}@keyframes pulse{from{transform:translateX(-35%)}to{transform:translateX(45%)}}
#log{min-height:83px;max-height:150px;overflow:auto;white-space:pre-wrap;color:#d2d7dc;font-size:11.5px;line-height:1.55;border-top:1px solid var(--line);padding-top:10px}.runtime{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.metric{border-left:2px solid var(--line);padding:5px 0 5px 8px}.metric b{display:block;font-size:12px}.metric span{font-size:10px;color:var(--muted)}
.brain{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px}.brain input,.chat-input{height:40px;background:var(--surface2);border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:0 11px;outline:0}.brain input:focus,.chat-input:focus{border-color:var(--teal)}.brain-results{grid-column:1/-1;display:grid;gap:5px}.brain-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;text-align:left;background:#11141a;border:1px solid #252b33;color:var(--ink);padding:8px 10px;border-radius:5px;cursor:pointer}.brain-result:hover{border-color:var(--blue)}.brain-result b{display:block;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brain-result small{display:block;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.brain-result em{font-style:normal;color:var(--blue);font-size:10px;align-self:center}
.library-panel{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}.library-column{min-width:0;padding:12px 14px}.library-column+ .library-column{border-left:1px solid var(--line);background:#12151a}.library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 8px;border-bottom:1px solid var(--line)}.library-head b{font-size:12px}.library-actions{display:flex;gap:6px}.small-button{height:30px;border:1px solid var(--line);border-radius:5px;background:var(--surface2);color:var(--muted);padding:0 9px;cursor:pointer;font-size:10px}.small-button:hover{border-color:var(--gold);color:var(--ink)}.module-list,.recent-list{display:grid}.module-row,.recent-row{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;border:0;border-bottom:1px solid #272c34;background:transparent;color:var(--ink);padding:10px 2px;cursor:pointer}.module-row:hover,.recent-row:hover{background:#171b21}.module-row:last-child,.recent-row:last-child{border-bottom:0}.module-row b,.module-row small,.recent-row b,.recent-row small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.module-row b,.recent-row b{font-size:11.5px}.module-row small,.recent-row small{font-size:10px;color:var(--muted);margin-top:2px}.row-meta{color:var(--blue);font-size:10px;white-space:nowrap}.file-ext{min-width:38px;text-align:center;color:var(--gold);border:1px solid #615534;padding:3px 5px;border-radius:4px;font-size:9px}.verification-line{color:var(--muted);font-size:10px}.verification-line.pass{color:var(--green)}.verification-line.fail{color:var(--coral)}
.chat-panel{min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px}.chat-head{min-width:0;display:flex;align-items:center;gap:10px}.provider-switch{min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;flex:1}.provider-btn{min-width:0;min-height:38px;display:flex;align-items:center;justify-content:center;gap:7px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid var(--line);background:var(--surface2);color:var(--muted);border-radius:6px;cursor:pointer;font-size:11.5px}.provider-btn:hover{border-color:var(--blue);color:var(--ink)}.provider-btn.active{border-color:var(--gold);color:var(--gold);background:#1d1b15;font-weight:800}.provider-btn:disabled{opacity:.38;cursor:not-allowed}.provider-dot{width:6px;height:6px;border-radius:50%;background:#59616d;flex:0 0 auto}.provider-dot.ready{background:var(--green);box-shadow:0 0 0 2px #75d39a22}.provider-btn.limited .provider-dot{background:var(--coral)}.chat-context{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;white-space:nowrap;cursor:pointer}.chat-context input{accent-color:var(--gold)}.provider-note{min-height:24px;padding:7px 1px 6px;color:var(--muted);font-size:10.5px;border-bottom:1px solid var(--line)}.chat{max-height:260px;min-height:66px;overflow:auto;line-height:1.55;font-size:12.5px;padding-top:4px}.chat-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:7px;margin-top:8px}.chat-role{color:var(--teal);font-weight:800;margin-right:7px}.chat-role.user{color:var(--gold)}.claude-call{border-color:#5c4b80;color:#c8b4ff}
.debate-bar[hidden]{display:none!important}.debate-bar{display:grid;grid-template-columns:minmax(150px,1fr) auto auto 38px;gap:7px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}.debate-live{display:flex;align-items:center;gap:7px;min-width:0;color:#cbd2da;font-size:11px}.debate-live span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live-pulse{width:7px;height:7px;border-radius:50%;background:#59616d;flex:0 0 auto}.live-pulse.busy{background:var(--coral);box-shadow:0 0 0 3px #f27c6b20;animation:livePulse 1s ease-in-out infinite alternate}@keyframes livePulse{to{transform:scale(1.35);box-shadow:0 0 0 6px #f27c6b0c}}.debate-rounds{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:10.5px;white-space:nowrap}.debate-rounds select{height:34px;min-width:112px;background:var(--surface2);border:1px solid var(--line);border-radius:5px;color:var(--ink);padding:0 7px}.debate-start{border-color:#2f6659;color:var(--teal);font-weight:800}.debate-stop{width:38px;padding:0;border-color:#693a3a;color:var(--coral);font-size:14px}.debate-stop:disabled,.debate-start:disabled{opacity:.4;cursor:not-allowed}.chat{max-height:340px}.chat-message{margin:7px 0;white-space:pre-wrap}.chat-role.claude{color:#c8b4ff}.chat-role.codex{color:#70d8d3}
.toast{position:fixed;right:18px;bottom:18px;max-width:min(390px,calc(100% - 36px));background:#20242c;border:1px solid var(--line);color:var(--ink);padding:11px 13px;border-radius:6px;box-shadow:0 16px 50px #0008;opacity:0;transform:translateY(8px);pointer-events:none;transition:.18s}.toast.show{opacity:1;transform:none}.ok{color:var(--green)}.error{color:var(--coral)}
@media(max-width:900px){.toolbar{grid-template-columns:repeat(3,1fr)}.workspace{grid-template-columns:1fr}.source{border-right:0;border-bottom:1px solid var(--line)}.library-panel{grid-template-columns:1fr}.library-column+ .library-column{border-left:0;border-top:1px solid var(--line)}.tool-frame{height:calc(100vh - 116px);min-height:640px}}
@media(max-width:560px){.shell{width:min(100% - 20px,1240px);padding-top:10px;overflow:hidden}.topbar{align-items:flex-start}.badges{display:none}.toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.workspace,.source,.controls,.brain{min-width:0}.source-top{align-items:flex-start;flex-direction:column}.file-button{width:100%;justify-content:center}.seg,.minor-row{grid-template-columns:repeat(2,minmax(0,1fr))}.seg button,.minor-row .btn{min-width:0;overflow:hidden;text-overflow:ellipsis}.chat-head{align-items:stretch;flex-direction:column}.provider-switch{width:100%}.provider-btn{padding:0 3px;gap:3px;font-size:8.8px}.chat-context{justify-content:flex-end}.chat-row{grid-template-columns:repeat(3,minmax(0,1fr))}.chat-row .btn{min-width:0;padding:0 5px;overflow:hidden;text-overflow:ellipsis}.chat-input{grid-column:1/-1}}
@media(max-width:560px){.debate-bar{grid-template-columns:minmax(0,1fr) 102px 38px}.debate-live{grid-column:1/-1}.debate-rounds{min-width:0}.debate-rounds select{min-width:0;width:104px}.debate-start{min-width:0;padding:0 7px;font-size:11px}}
</style></head><body><div class="shell">
<header class="topbar"><button class="brand brand-button" type="button" onclick="openHome()" title="통합 홈"><span class="brand-mark">R</span><span><strong>RAY English</strong><span>Browser Production OS · 127.0.0.1:8792</span></span></button><div class="badges"><span class="badge live">LOCAL WEB</span><span class="badge free">추가비용 0</span><span class="badge" id="brainBadge">기억 확인 중</span></div></header>
<nav class="toolbar">__CARDS__</nav>

<main id="homeWorkspace">
<div class="section-head"><h2><span>01</span>소스와 제작</h2><p id="sourceState">새 작업</p></div>
<section class="workspace">
  <div class="source">
    <div class="source-top"><div class="file-line"><div class="file-name" id="fileName">원본 파일 또는 영어 지문</div><div class="file-meta" id="fileMeta">로컬 추출 대기</div></div>
      <label class="file-button" id="fileButton"><span>+</span> 파일 선택<input id="fileInput" type="file" accept=".pdf,.docx,.pptx,.hwp,.hwpx,.xlsx,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.txt,.md,.csv,.json"></label></div>
    <div class="format-strip"><span>PDF</span><span>DOCX</span><span>PPTX</span><span>HWP/X</span><span>XLSX</span><span>PNG/JPG</span></div>
    <div id="dropzone"><textarea id="psg" placeholder="영어 지문을 입력하거나 파일을 선택하세요."></textarea></div>
    <details id="extractDetails" hidden><summary>전체 추출 텍스트</summary><div class="extract" id="fullExtract"></div></details>
  </div>
  <aside class="controls">
    <div class="control-group"><label>제작 모드</label><div class="seg"><button type="button" class="active" data-kind="reading">독해</button><button type="button" data-kind="grammar">어법</button></div></div>
    <button class="primary" id="makeButton" onclick="make()">제작 시작</button>
    <div class="minor-row"><button class="btn" onclick="stat()">상태 갱신</button><button class="btn" onclick="review()">검수함</button></div>
    <div class="progress" id="progress"><span></span></div><div id="log">대기 중</div>
    <div class="runtime"><div class="metric"><b id="metricKnowledge">-</b><span>지식</span></div><div class="metric"><b id="metricRuns">-</b><span>누적 생성</span></div><div class="metric"><b id="metricReview">-</b><span>검수 대기</span></div><div class="metric"><b id="metricPaid">OFF</b><span>유료 경로</span></div></div>
    <div class="minor-row"><button class="btn" onclick="fetch('/open',{method:'POST'});toast('결과 폴더를 열었습니다')">결과 폴더</button><button class="btn" onclick="clearSource()">소스 초기화</button></div>
  </aside>
</section>

<div class="section-head"><h2><span>02</span>컴퓨터 기억</h2><p id="brainState">로컬 색인</p></div>
<section class="brain"><input id="brainQuery" placeholder="학교, 지문, 문항 유형, 핵심어" onkeydown="if(event.key==='Enter')brainSearch()"><button class="btn" onclick="brainSearch()">검색</button><div class="brain-results" id="brainResults"></div></section>

<div class="section-head"><h2><span>03</span>조력 대화</h2><p>@claude · @협업</p></div>
<section class="chat-panel">
  <div class="chat-head"><div class="provider-switch" id="providerSwitch">
    <button class="provider-btn active" data-provider="auto" onclick="selectProvider('auto')" title="요청을 분석해 Fable/Opus/Sonnet/GPT 중 자동 선택"><span class="provider-dot"></span>스마트 자동</button>
    <button class="provider-btn" data-provider="ray" onclick="selectProvider('ray')"><span class="provider-dot"></span>RAY Free</button>
    <button class="provider-btn" data-provider="codex" onclick="selectProvider('codex')"><span class="provider-dot"></span>ChatGPT · Codex</button>
    <button class="provider-btn" data-provider="claude" onclick="selectProvider('claude')"><span class="provider-dot"></span>Claude</button>
    <button class="provider-btn" data-provider="collab" onclick="selectProvider('collab')"><span class="provider-dot"></span>Claude ↔ Codex</button>
  </div><label class="chat-context" title="현재 입력된 영어 지문을 대화 맥락에 포함"><input type="checkbox" id="chatContext">현재 지문</label></div>
  <div class="provider-note" id="providerNote">구독 연결 상태를 확인 중입니다.</div>
  <div class="chat" id="chat"></div><div class="chat-row"><input class="chat-input" id="cin" placeholder="출제 아이디어, 번역, 해설" onkeydown="if(event.key==='Enter')chat()"><button class="btn claude-call" onclick="callClaude()">Claude 호출</button><button class="btn" id="chatSend" onclick="chat()">보내기</button><button class="btn" onclick="CH=[];renderChat()">초기화</button></div>
</section>

<div class="section-head"><h2><span>04</span>통합 자료실</h2><p id="systemState">시스템 원장 확인 중</p></div>
<section class="library-panel">
  <div class="library-column"><div class="library-head"><b>제작 생태계</b><div class="library-actions"><button class="small-button" onclick="openSystemRoot()">루트 열기</button><button class="small-button" onclick="loadWorkspace(true)">새로고침</button></div></div><div class="module-list" id="moduleList"><div class="file-meta">자료실을 읽는 중</div></div></div>
  <div class="library-column"><div class="library-head"><b>최근 결과물</b><div class="library-actions"><button class="small-button" id="verifyButton" onclick="runVerification()">전체 검증</button></div></div><div class="recent-list" id="recentList"><div class="file-meta">최근 파일을 찾는 중</div></div></div>
</section>
</main>

<section class="tool-workspace" id="toolWorkspace" hidden>
  <div class="tool-frame-head"><button class="icon-button" type="button" onclick="openHome()" title="통합 홈" aria-label="통합 홈">←</button><div class="tool-frame-title"><b id="toolTitle">도구</b><span id="toolDescription">RAY English 작업 캔버스</span></div><button class="icon-button" type="button" onclick="openToolExternal()" title="새 탭으로 열기" aria-label="새 탭으로 열기">↗</button></div>
  <div class="tool-frame-wrap" id="toolFrameWrap"><div class="frame-loading">작업 도구를 불러오는 중</div><iframe class="tool-frame" id="toolFrame" title="RAY English 작업 도구"></iframe></div>
</section>
</div><div class="toast" id="toast"></div>
<script>
const TOOL_DATA=__TOOLS_JSON__;
let CH=[],selectedKind='reading',busy=false,chatProvider='auto',chatProviders={},debateBusy=false,debateController=null,debateJobId='',activeTool='';
const $=id=>document.getElementById(id), log=t=>{$('log').textContent=t};
function openHome(updateHistory=true){activeTool='';$('homeWorkspace').hidden=false;$('toolWorkspace').hidden=true;document.querySelectorAll('.tool').forEach(button=>button.classList.remove('active'));if(updateHistory&&location.hash!=='#home')history.pushState({},'',location.pathname+'#home');document.title='RAY English Production OS'}
function openTool(key,updateHistory=true){const meta=TOOL_DATA[key];if(!meta)return;activeTool=key;$('homeWorkspace').hidden=true;$('toolWorkspace').hidden=false;$('toolTitle').textContent=meta.title;$('toolDescription').textContent=meta.description;document.querySelectorAll('.tool').forEach(button=>button.classList.toggle('active',button.dataset.tool===key));const frame=$('toolFrame');if(frame.getAttribute('src')!==meta.url){$('toolFrameWrap').classList.remove('loaded');frame.src=meta.url}if(updateHistory&&location.hash!==`#tool=${key}`)history.pushState({},'',location.pathname+`#tool=${key}`);document.title=`${meta.title} | RAY English`}
function openToolExternal(){if(activeTool&&TOOL_DATA[activeTool])window.open(TOOL_DATA[activeTool].url,'_blank','noopener')}
function routeWorkspace(){const match=location.hash.match(/^#tool=([A-Za-z0-9_-]+)$/);if(match&&TOOL_DATA[match[1]])openTool(match[1],false);else openHome(false)}
$('toolFrame').addEventListener('load',()=>$('toolFrameWrap').classList.add('loaded'));
window.addEventListener('popstate',routeWorkspace);
function moduleRow(item){const button=document.createElement('button');button.className='module-row';button.type='button';const copy=document.createElement('span'),title=document.createElement('b'),description=document.createElement('small'),meta=document.createElement('span');title.textContent=item.label;description.textContent=item.description;copy.append(title,description);meta.className='row-meta';meta.textContent=item.exists?`${item.folders}개 폴더 · 열기`:'경로 확인';button.append(copy,meta);button.onclick=()=>openWorkspace(item.key);return button}
function recentRow(item){const button=document.createElement('button');button.className='recent-row';button.type='button';const copy=document.createElement('span'),title=document.createElement('b'),description=document.createElement('small'),ext=document.createElement('span');title.textContent=item.name;description.textContent=`${item.modified_label} · ${item.size_mb}MB · ${item.relative}`;copy.append(title,description);ext.className='file-ext';ext.textContent=item.extension;button.append(copy,ext);button.onclick=()=>openWorkspaceFile(item.path);return button}
function renderWorkspace(data){const modules=$('moduleList'),recent=$('recentList');modules.innerHTML='';recent.innerHTML='';(data.modules||[]).forEach(item=>modules.append(moduleRow(item)));(data.recent||[]).forEach(item=>recent.append(recentRow(item)));if(!(data.recent||[]).length)recent.innerHTML='<div class="file-meta">최근 결과물이 없습니다.</div>';const verify=data.verification||{},passed=verify.pass===true;$('systemState').textContent=verify.checked_at?`검증 ${passed?'PASS':'확인 필요'} · 링크 ${verify.links_total||0}개`:'검증 기록 없음';$('systemState').className='verification-line '+(verify.checked_at?(passed?'pass':'fail'):'')}
async function loadWorkspace(force=false){try{const response=await fetch('/workspace'+(force?'?refresh=1':'')),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'자료실을 읽지 못했습니다.');renderWorkspace(data)}catch(error){$('systemState').textContent=error.message;$('systemState').className='verification-line fail'}}
async function openWorkspace(key){try{const response=await fetch('/workspace/open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})}),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'폴더를 열지 못했습니다.');toast(`${data.label||'자료실'}을 열었습니다`)}catch(error){toast(error.message,true)}}
function openSystemRoot(){openWorkspace('root')}
async function openWorkspaceFile(path){try{const response=await fetch('/workspace/open-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})}),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'파일을 열지 못했습니다.')}catch(error){toast(error.message,true)}}
async function runVerification(){const button=$('verifyButton');button.disabled=true;button.textContent='검증 중';try{const response=await fetch('/system/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'검증 실패');toast(data.pass?'전체 검증 PASS':'확인이 필요한 항목이 있습니다',!data.pass);await loadWorkspace(true)}catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent='전체 검증'}}
function setBusy(value,message){busy=value;$('makeButton').disabled=value;$('fileButton').classList.toggle('disabled',value);$('progress').classList.toggle('busy',value);if(message)log(message)}
function toast(message,isError=false){const el=$('toast');el.textContent=message;el.className='toast show '+(isError?'error':'ok');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.className='toast',2600)}
document.querySelectorAll('.seg button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('active'));button.classList.add('active');selectedKind=button.dataset.kind});
const drop=$('dropzone'),fileInput=$('fileInput');fileInput.onchange=()=>fileInput.files[0]&&ingestFile(fileInput.files[0]);
['dragenter','dragover'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',event=>event.dataTransfer.files[0]&&ingestFile(event.dataTransfer.files[0]));
async function ingestFile(file){if(busy)return;setBusy(true,file.name+' 읽는 중');$('fileName').textContent=file.name;$('fileMeta').textContent='로컬 추출·OCR 진행 중';$('sourceState').textContent='파일 처리 중';
 const data=new FormData();data.append('file',file,file.name);const started=performance.now();
 try{const response=await fetch('/ingest',{method:'POST',body:data});const result=await response.json();if(!response.ok||result.error)throw new Error(result.error||'파일 처리 실패');
  $('psg').value=result.passage||result.text||'';$('fullExtract').textContent=result.text||'';$('extractDetails').hidden=!result.text;
  $('fileMeta').textContent=`${result.format.toUpperCase()} · 전체 ${Number(result.characters).toLocaleString()}자 · 본문 ${Number(result.passage_characters).toLocaleString()}자 · ${result.seconds}초`;
  $('sourceState').textContent='추출 완료';log('본문을 확인한 뒤 제작 모드를 선택하세요.');toast('파일을 로컬에서 읽었습니다');stat();
 }catch(error){$('fileMeta').textContent='처리 실패';$('sourceState').textContent='오류';log('오류: '+error.message);toast(error.message,true)}finally{setBusy(false)}}
async function make(){const passage=$('psg').value.trim();if(!passage){toast('영어 지문이 없습니다',true);return}setBusy(true,'분석과 조판을 진행 중');$('sourceState').textContent='제작 중';
 try{const response=await fetch('/make',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passage,kind:selectedKind})});const result=await response.json();if(result.error)throw new Error(result.error);log(result.log||'제작 완료');$('sourceState').textContent='제작 완료';toast('제작이 완료되었습니다');stat()}
 catch(error){log('오류: '+error.message);$('sourceState').textContent='제작 실패';toast(error.message,true)}finally{setBusy(false)}}
function providerLabel(id){const state=chatProviders[id]||{};return state.label||(id==='codex'?'ChatGPT · Codex':id==='claude'?'Claude':id==='collab'?'Claude ↔ Codex':id==='auto'?'스마트 자동':'RAY Free')}
function updateProviderNote(message=''){const state=chatProviders[chatProvider]||{};$('providerNote').textContent=message||(state.mode?`${state.mode} · ${state.billing||''}`:'연결 상태 확인 중')}
function selectProvider(id){const state=chatProviders[id];if(state&&state.available===false)return;chatProvider=id;document.querySelectorAll('.provider-btn').forEach(button=>button.classList.toggle('active',button.dataset.provider===id));updateProviderNote()}
function renderProviders(states){chatProviders=states||{};document.querySelectorAll('.provider-btn').forEach(button=>{const state=chatProviders[button.dataset.provider]||{};button.disabled=state.available===false;button.title=state.mode||'';button.querySelector('.provider-dot').classList.toggle('ready',state.available!==false);if(state.label)button.childNodes[button.childNodes.length-1].textContent=state.label});if(chatProviders[chatProvider]&&chatProviders[chatProvider].available===false)selectProvider('ray');else selectProvider(chatProvider)}
async function stat(){try{const r=await fetch('/status'),d=await r.json();$('metricKnowledge').textContent=Number(d.vocab||0).toLocaleString();$('metricRuns').textContent=Number(d.runs||0).toLocaleString();$('metricReview').textContent=Number(d.review||0).toLocaleString();$('metricPaid').textContent=String(d.paid||'OFF').replace(/\(.+\)/,'');const b=d.brain||{};$('brainBadge').textContent=b.status==='indexing'?'기억 색인 중':'기억 준비';$('brainState').textContent=`${Number(b.total_files||b.scanned||0).toLocaleString()}개 · ${b.status||'대기'}`;renderProviders(d.providers||{});}catch(error){$('brainBadge').textContent='기억 연결 확인'}}
async function review(){try{const r=await fetch('/review'),d=await r.json();log(d.items.length?d.items.map(x=>x.header).join('\n'):'검수 대기 없음')}catch(error){log('검수함 오류: '+error.message)}}
async function brainSearch(){const query=$('brainQuery').value.trim();if(!query)return;const box=$('brainResults');box.innerHTML='<div class="file-meta">검색 중</div>';
 try{const r=await fetch('/brain/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})}),d=await r.json();box.innerHTML='';if(!d.items||!d.items.length){box.innerHTML='<div class="file-meta">검색 결과 없음</div>';return}d.items.forEach(item=>{const button=document.createElement('button');button.className='brain-result';const text=document.createElement('span'),name=document.createElement('b'),excerpt=document.createElement('small'),action=document.createElement('em');name.textContent=item.name||'';excerpt.textContent=item.excerpt||item.path||'';action.textContent='열기';text.append(name,excerpt);button.append(text,action);button.onclick=()=>fetch('/brain/open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:item.path})});box.append(button)})}
 catch(error){box.innerHTML='<div class="file-meta error">'+error.message.replace(/</g,'&lt;')+'</div>'}}
function clearSource(){$('psg').value='';$('fullExtract').textContent='';$('extractDetails').hidden=true;$('fileInput').value='';$('fileName').textContent='원본 파일 또는 영어 지문';$('fileMeta').textContent='로컬 추출 대기';$('sourceState').textContent='새 작업';log('대기 중')}
function callClaude(){const state=chatProviders.claude||{};if(state.available===false){toast('Claude 구독 로그인을 확인해 주세요',true);return}const input=$('cin');if(!input.value.trim()){if(!CH.length){toast('Claude에게 보낼 내용을 입력하세요',true);return}input.value='지금까지의 대화를 검토하고, 빠진 점과 수정안을 제시해 줘.'}selectProvider('claude');chat('claude')}
async function chat(forcedProvider=''){const input=$('cin');let query=input.value.trim();if(!query)return;let activeProvider=forcedProvider||chatProvider;if(/^@(auto|자동|스마트)(?:\s+|$)/i.test(query)){activeProvider='auto';query=query.replace(/^@(auto|자동|스마트)(?:\s+|$)/i,'').trim()}else if(/^@claude(?:\s+|$)/i.test(query)){activeProvider='claude';query=query.replace(/^@claude(?:\s+|$)/i,'').trim()}else if(/^@(협업|회의|collab)(?:\s+|$)/i.test(query)){activeProvider='collab';query=query.replace(/^@(협업|회의|collab)(?:\s+|$)/i,'').trim()}if(!query){toast('호출 뒤에 질문을 입력하세요',true);return}selectProvider(activeProvider);input.value='';const send=$('chatSend');send.disabled=true;CH.push({role:'user',content:query},{role:'assistant',content:'응답 중',provider:providerLabel(activeProvider)});renderChat();try{const context=$('chatContext').checked?$('psg').value.trim().slice(0,12000):'';const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:activeProvider,messages:CH.slice(0,-1),context})}),d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'응답 없음');CH[CH.length-1]={role:'assistant',content:d.reply,provider:d.provider_label||providerLabel(activeProvider)};updateProviderNote(`${d.provider_label||providerLabel(activeProvider)} · 응답 완료`)}catch(error){CH[CH.length-1]={role:'assistant',content:'오류: '+error.message,provider:providerLabel(activeProvider)};updateProviderNote(error.message);const button=document.querySelector(`[data-provider="${activeProvider}"]`);if(button&&/한도|limit|429/i.test(error.message))button.classList.add('limited')}finally{send.disabled=false;renderChat()}}
function installDebateUI(){const note=$('providerNote');if(!note||$('debateBar'))return;note.insertAdjacentHTML('afterend',`<div class="debate-bar" id="debateBar" hidden><div class="debate-live"><span class="live-pulse" id="debatePulse"></span><span id="debateState">논제를 입력하면 두 모델이 차례로 검토합니다.</span></div><label class="debate-rounds">라운드<select id="debateRounds"><option value="1">1회 · 2호출</option><option value="2">2회 · 4호출</option><option value="3">3회 · 6호출</option></select></label><button class="btn debate-start" id="debateStart" onclick="startDebate()">실시간 토론</button><button class="btn debate-stop" id="debateStop" onclick="stopDebate()" title="토론 즉시 중지" aria-label="토론 즉시 중지" disabled>■</button></div>`);const buttons=document.querySelectorAll('.chat-row .btn');if(buttons[0])buttons[0].id='claudeCall';if(buttons[2]){buttons[2].id='chatClear';buttons[2].onclick=clearChat}const input=$('cin');input.addEventListener('keydown',event=>{if(event.key==='Enter'&&chatProvider==='collab'){event.preventDefault();event.stopImmediatePropagation();startDebate()}},true)}
function selectProvider(id){const state=chatProviders[id];if(state&&state.available===false)return;chatProvider=id;document.querySelectorAll('.provider-btn').forEach(button=>button.classList.toggle('active',button.dataset.provider===id));if($('debateBar'))$('debateBar').hidden=id!=='collab';updateProviderNote(id==='collab'?'논제와 라운드를 정한 뒤 실시간 토론을 시작하세요.':'')}
function setDebateBusy(value,message=''){debateBusy=value;$('debateStart').disabled=value;$('debateStop').disabled=!value;$('chatSend').disabled=value;$('claudeCall').disabled=value;$('chatClear').disabled=value;$('debateRounds').disabled=value;$('cin').disabled=value;$('debatePulse').classList.toggle('busy',value);if(message)$('debateState').textContent=message}
function clearChat(){if(debateBusy){toast('진행 중인 토론을 먼저 중지해 주세요',true);return}CH=[];renderChat();if($('debateState'))$('debateState').textContent='논제를 입력하면 두 모델이 차례로 검토합니다.'}
function debateEvent(event){if(event.type==='start'){$('debateState').textContent=`${event.rounds}라운드 시작 · 최대 ${event.model_calls_planned}회 호출`;return}if(event.type==='status'){$('debateState').textContent=event.message||`${event.speaker} 검토 중`;updateProviderNote($('debateState').textContent);return}if(event.type==='turn'){CH.push({role:'assistant',content:event.content||'',provider:event.speaker||event.provider||'토론자',agent:String(event.speaker||'').toLowerCase(),round:event.round});renderChat();$('debateState').textContent=`${event.round}라운드 · ${event.speaker} 발언 완료`;return}if(event.type==='done'){$('debateState').textContent=`토론 완료 · ${event.rounds}라운드 · ${event.model_calls}회 호출`;updateProviderNote('Claude와 Codex의 최종 토론이 완료되었습니다.');return}if(event.type==='stopped'){$('debateState').textContent='사용자가 토론을 중지했습니다.';return}if(event.type==='error')throw new Error(event.error||'토론 응답 오류')}
async function startDebate(){if(debateBusy)return;selectProvider('collab');const input=$('cin');let topic=input.value.trim();if(!topic){const last=[...CH].reverse().find(message=>message.role==='user');topic=last?last.content:''}if(!topic){toast('두 모델이 토론할 논제를 입력하세요',true);return}if(input.value.trim()){CH.push({role:'user',content:topic});input.value='';renderChat()}const rounds=Math.max(1,Math.min(3,Number($('debateRounds').value)||1));debateJobId=(window.crypto&&crypto.randomUUID?crypto.randomUUID():`debate-${Date.now()}`).replace(/[^A-Za-z0-9_-]/g,'');debateController=new AbortController();setDebateBusy(true,`${rounds}라운드 연결 중`);const context=$('chatContext').checked?$('psg').value.trim().slice(0,12000):'';try{const response=await fetch('/chat/debate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job_id:debateJobId,rounds,messages:CH,context}),signal:debateController.signal});if(!response.ok)throw new Error((await response.json()).error||'토론을 시작하지 못했습니다.');if(!response.body)throw new Error('이 브라우저는 실시간 응답을 지원하지 않습니다.');const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';while(true){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});const lines=pending.split('\n');pending=lines.pop()||'';for(const line of lines){if(line.trim())debateEvent(JSON.parse(line))}}pending+=decoder.decode();if(pending.trim())debateEvent(JSON.parse(pending))}catch(error){if(error.name!=='AbortError'){CH.push({role:'assistant',content:'토론 오류: '+error.message,provider:'시스템'});renderChat();$('debateState').textContent=error.message;updateProviderNote(error.message);if(/한도|limit|429/i.test(error.message)){const claude=document.querySelector('[data-provider="claude"]');if(claude)claude.classList.add('limited');toast('Claude 사용 한도 재개 뒤 같은 버튼으로 다시 시작할 수 있습니다.',true)}}}finally{setDebateBusy(false);debateController=null;debateJobId=''}}
async function stopDebate(){if(!debateBusy)return;const jobId=debateJobId;$('debateState').textContent='토론 중지 요청 중';try{await fetch('/chat/debate/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job_id:jobId})})}catch(error){}if(debateController)debateController.abort();setDebateBusy(false,'토론을 중지했습니다.')}
function renderChat(){const box=$('chat');box.innerHTML='';CH.forEach(message=>{const row=document.createElement('div'),role=document.createElement('span'),text=document.createTextNode(message.content||''),agent=String(message.agent||message.provider||'').toLowerCase();row.className='chat-message';role.className='chat-role '+(message.role==='user'?'user':agent.includes('claude')?'claude':agent.includes('codex')?'codex':'');role.textContent=message.role==='user'?'나':`${message.provider||'RAY'}${message.round?` · ${message.round}R`:''}`;row.append(role,text);box.append(row)});box.scrollTop=box.scrollHeight}
installDebateUI();
routeWorkspace();
stat();
loadWorkspace();
</script></body></html>""".replace("__CARDS__", cards).replace("__TOOLS_JSON__", tool_data)

def _py(*args, timeout=240):
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    r = subprocess.run(
        [sys.executable, *[os.path.join(HERE, a) if a.endswith(".py") else a for a in args]],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        env=env,
    )
    output = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        raise RuntimeError(output.strip()[-600:] or f"worker exit {r.returncode}")
    return output


def _parse_upload(content_type, body):
    envelope = (
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8")
        + body
    )
    message = BytesParser(policy=email_policy).parsebytes(envelope)
    if not message.is_multipart():
        raise ValueError("파일 전송 형식이 올바르지 않습니다.")
    for part in message.iter_parts():
        if part.get_content_disposition() != "form-data":
            continue
        filename = part.get_filename()
        if filename:
            return os.path.basename(filename), part.get_payload(decode=True) or b""
    raise ValueError("선택된 파일이 없습니다.")


def _save_upload(filename, payload):
    extension = os.path.splitext(filename)[1].lower()
    if extension not in SUPPORTED_UPLOADS:
        raise ValueError(f"지원하지 않는 형식입니다: {extension or '확장자 없음'}")
    if not payload:
        raise ValueError("빈 파일입니다.")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = re.sub(r"[^0-9A-Za-z가-힣._ -]+", "_", filename).strip(" ._") or f"source{extension}"
    digest = hashlib.sha256(payload).hexdigest()[:10]
    path = os.path.join(UPLOAD_DIR, f"{digest}_{safe_name}")
    if not os.path.isfile(path) or os.path.getsize(path) != len(payload):
        with open(path, "wb") as handle:
            handle.write(payload)
    return path, extension


def _remember_file(path):
    brain = os.path.join(HERE, "ray_local_brain.py")
    if not os.path.isfile(brain):
        return
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NO_WINDOW | subprocess.BELOW_NORMAL_PRIORITY_CLASS
    try:
        subprocess.Popen(
            [sys.executable, brain, "ingest", path],
            cwd=HERE,
            env=os.environ.copy(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
        )
    except Exception:
        pass


def _brain_state():
    path = os.path.join(LOCAL_DATA, "brain", "state.json")
    try:
        return json.load(io.open(path, encoding="utf-8"))
    except Exception:
        return {"status": "not_started", "scanned": 0, "total_files": 0}


def _module_summary(item):
    path = item["path"]
    files = folders = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False):
                files += 1
            elif entry.is_dir(follow_symlinks=False):
                folders += 1
    except OSError:
        pass
    return {
        "key": item["key"], "label": item["label"],
        "description": item["description"], "path": path,
        "exists": os.path.isdir(path), "files": files, "folders": folders,
    }


def _recent_workspace_files(limit=14):
    roots = [
        OUT_DIR,
        os.path.join(SYSTEM_ROOT, "03_CLASS_BOARDS", "CLASS_templates", "FINAL"),
        os.path.join(SYSTEM_ROOT, "06_OUTPUT_LIBRARY"),
        os.path.join(SYSTEM_ROOT, "02_ANALYSIS_SHEETS", "ANALYSIS_workspace", "outputs"),
    ]
    found = {}
    for base in roots:
        if not os.path.isdir(base):
            continue
        base_depth = base.rstrip(os.sep).count(os.sep)
        for current, dirs, names in os.walk(base):
            depth = current.rstrip(os.sep).count(os.sep) - base_depth
            dirs[:] = [
                name for name in dirs
                if name.casefold() not in RECENT_SKIP_DIRS and depth < 3
            ]
            for name in names:
                if name.startswith("~$") or name.startswith("."):
                    continue
                extension = os.path.splitext(name)[1].lower()
                if extension not in RECENT_EXTENSIONS:
                    continue
                full = os.path.abspath(os.path.join(current, name))
                try:
                    modified = os.path.getmtime(full)
                    size = os.path.getsize(full)
                except OSError:
                    continue
                identity = os.path.normcase(os.path.realpath(full))
                previous = found.get(identity)
                if previous and previous["modified"] >= modified:
                    continue
                try:
                    relative = os.path.relpath(full, SYSTEM_ROOT)
                except ValueError:
                    relative = full
                found[identity] = {
                    "name": name, "path": full, "relative": relative,
                    "extension": extension.lstrip(".").upper(),
                    "modified": modified, "modified_label": time.strftime("%m.%d %H:%M", time.localtime(modified)),
                    "size_mb": round(size / 1024 / 1024, 1),
                }
    return sorted(found.values(), key=lambda item: item["modified"], reverse=True)[:limit]


def _workspace_payload(force=False):
    now = time.time()
    with WORKSPACE_LOCK:
        if not force and WORKSPACE_CACHE["payload"] and now - WORKSPACE_CACHE["at"] < 30:
            return WORKSPACE_CACHE["payload"]
        verification_path = os.path.join(SYSTEM_ROOT, "99_MANIFEST", "last_verification.json")
        try:
            verification = json.load(io.open(verification_path, encoding="utf-8-sig"))
        except Exception:
            verification = {}
        payload = {
            "modules": [_module_summary(item) for item in WORKSPACE_MODULES],
            "recent": _recent_workspace_files(),
            "verification": verification,
            "system_root": SYSTEM_ROOT,
        }
        WORKSPACE_CACHE.update({"at": now, "payload": payload})
        return payload


def _is_workspace_path(path):
    candidate = os.path.abspath(path)
    for item in WORKSPACE_MODULES:
        root = os.path.abspath(item["path"])
        try:
            if os.path.commonpath((root, candidate)) == root:
                return True
        except ValueError:
            continue
    return False

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        try: self.wfile.write(b)
        except Exception: pass
    def log_message(self, *a): pass
    def _stream_headers(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
    def _stream_event(self, payload):
        try:
            line = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
            self.wfile.write(line.encode("utf-8")); self.wfile.flush()
            return True
        except Exception:
            return False
    def _static(self, path):
        rel = urllib.parse.unquote(path.lstrip("/")).split("?")[0]
        full = os.path.normpath(os.path.join(WEBROOT, rel))
        try:
            inside = os.path.commonpath((WEBROOT, full)) == os.path.normpath(WEBROOT)
        except ValueError:
            inside = False
        if not inside or not os.path.isfile(full): return False
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f: self._send(200, f.read(), CT.get(ext, "application/octet-stream"))
        return True
    def do_GET(self):
        if self.path == "/" or self.path == "/index_app": return self._send(200, PAGE(), "text/html; charset=utf-8")
        if self.path.split("?", 1)[0] == "/board/asset":
            try:
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                path = os.path.abspath(str((query.get("path") or [""])[0]))
                if not _is_workspace_path(path):
                    raise ValueError("통합 자료실 밖의 파일은 표시할 수 없습니다.")
                extension = os.path.splitext(path)[1].lower()
                if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
                    raise ValueError("미리보기 이미지 형식이 아닙니다.")
                if not os.path.isfile(path):
                    raise ValueError("미리보기 파일을 찾을 수 없습니다.")
                with open(path, "rb") as stream:
                    return self._send(200, stream.read(), CT.get(extension, "application/octet-stream"))
            except ValueError as exc:
                return self._send(400, json.dumps({"error": str(exc)}, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path.split("?", 1)[0] == "/workspace":
            force = "refresh=1" in self.path
            return self._send(200, json.dumps(_workspace_payload(force=force), ensure_ascii=False))
        if self.path == "/status":
            import ray_studio
            st = {}
            for f in ["brain_state.json", "brain_knowledge.json"]:
                try: st[f] = json.load(io.open(os.path.join(HERE, f), encoding="utf-8"))
                except Exception: st[f] = {}
            paid = "OFF(무료)"
            if os.environ.get("RAY_ALLOW_PAID", "0") == "1":
                try:
                    import claude_router; paid = "활성" if claude_router.available() else "OFF(무료)"
                except Exception: pass
            try:
                import ray_chat_bridge
                providers = ray_chat_bridge.provider_status()
            except Exception:
                providers = {"ray": {"id": "ray", "label": "RAY Free", "available": True,
                                      "mode": "무료 폴백", "billing": "API 키 미사용"}}
            with DEBATE_LOCK:
                active_debates = len(DEBATE_JOBS)
            try:
                import ray_hub; hub = ray_hub.status(); backlog = hub["total_backlog"]; fable_open = hub["fable_open"]
            except Exception: backlog = len(ray_studio.review_pending()); fable_open = 0
            return self._send(200, json.dumps({
                "tokens": st["brain_state.json"].get("tokens", 0), "budget": os.environ.get("RAY_DAILY_TOKENS", "80000"),
                "vocab": len(st["brain_knowledge.json"].get("glossary", {})), "runs": st["brain_state.json"].get("runs_total", 0),
                "review": backlog, "fable_open": fable_open, "paid": paid, "brain": _brain_state(),
                "formats": sorted(SUPPORTED_UPLOADS), "providers": providers,
                "active_debates": active_debates,
                "app_dir": HERE, "system_root": SYSTEM_ROOT}, ensure_ascii=False))
        if self.path == "/review":
            try:
                import ray_hub; return self._send(200, json.dumps({"items": ray_hub.pending()}, ensure_ascii=False))
            except Exception:
                import ray_studio; return self._send(200, json.dumps({"items": ray_studio.review_pending()}, ensure_ascii=False))
        if self._static(self.path): return
        return self._send(404, "{}")
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        if n > MAX_UPLOAD_BYTES:
            return self._send(413, json.dumps({"error": "파일은 80MB까지 처리할 수 있습니다."}, ensure_ascii=False))
        body = self.rfile.read(n) if n else b"{}"
        if self.path == "/ingest":
            started = time.perf_counter()
            try:
                filename, payload = _parse_upload(self.headers.get("Content-Type", ""), body)
                path, extension = _save_upload(filename, payload)
                import ray_ingest
                text = ray_ingest.ingest(path)
                if not text.strip():
                    raise ValueError("파일에서 읽을 수 있는 텍스트를 찾지 못했습니다.")
                passage = ray_ingest.extract_english_passage(text)
                _remember_file(path)
                result = {
                    "source_name": filename,
                    "format": extension.lstrip("."),
                    "characters": len(text),
                    "passage_characters": len(passage),
                    "seconds": round(time.perf_counter() - started, 2),
                    "text": text[:500_000],
                    "passage": passage,
                    "local_only": True,
                }
                return self._send(200, json.dumps(result, ensure_ascii=False))
            except ValueError as exc:
                return self._send(400, json.dumps({"error": str(exc)}, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": f"파일 처리 실패: {str(exc)[:180]}"}, ensure_ascii=False))
        try:
            raw = body.decode("utf-8-sig") if body else "{}"
        except UnicodeDecodeError:
            return self._send(400, json.dumps({"error": "요청을 읽을 수 없습니다."}, ensure_ascii=False))
        if self.path in {"/board/build", "/board/build-combined"}:
            try:
                import ray_board_web
                payload = json.loads(raw or "{}")
                result = ray_board_web.build_combined(payload) if self.path.endswith("build-combined") else ray_board_web.build(payload)
                with WORKSPACE_LOCK:
                    WORKSPACE_CACHE.update({"at": 0.0, "payload": None})
                return self._send(200, json.dumps(result, ensure_ascii=False))
            except ValueError as exc:
                return self._send(400, json.dumps({"error": str(exc)}, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": str(exc)[:1800]}, ensure_ascii=False))
        if self.path == "/board/open-output":
            try:
                import ray_board_web
                os.makedirs(ray_board_web.OUTPUT_DIR, exist_ok=True)
                os.startfile(str(ray_board_web.OUTPUT_DIR))
                return self._send(200, json.dumps({"opened": True}, ensure_ascii=False))
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/chat/debate/stop":
            try:
                d = json.loads(raw or "{}")
                job_id = str(d.get("job_id") or "")[:100]
                with DEBATE_LOCK:
                    stop_event = DEBATE_JOBS.get(job_id)
                if stop_event:
                    stop_event.set()
                return self._send(200, json.dumps({
                    "job_id": job_id, "stopped": bool(stop_event),
                }, ensure_ascii=False))
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/workspace/open":
            try:
                d = json.loads(raw or "{}")
                key = str(d.get("key") or "")
                if key == "root":
                    path, label = SYSTEM_ROOT, "통합 루트"
                else:
                    item = WORKSPACE_BY_KEY.get(key)
                    if not item:
                        raise ValueError("등록되지 않은 자료실입니다.")
                    path, label = item["path"], item["label"]
                if not os.path.isdir(path):
                    raise ValueError("자료실 경로를 찾을 수 없습니다.")
                os.startfile(path)
                return self._send(200, json.dumps({"opened": True, "label": label}, ensure_ascii=False))
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/workspace/open-file":
            try:
                d = json.loads(raw or "{}")
                path = os.path.abspath(str(d.get("path") or ""))
                if not _is_workspace_path(path):
                    raise ValueError("통합 자료실 밖의 파일은 열 수 없습니다.")
                if not os.path.isfile(path):
                    raise ValueError("파일을 찾을 수 없습니다.")
                os.startfile(path)
                return self._send(200, json.dumps({"opened": True}, ensure_ascii=False))
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/system/verify":
            try:
                script = os.path.join(SYSTEM_ROOT, "99_MANIFEST", "VERIFY_SYSTEM.ps1")
                if not os.path.isfile(script):
                    raise ValueError("시스템 검증 스크립트를 찾을 수 없습니다.")
                completed = subprocess.run(
                    ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script],
                    cwd=SYSTEM_ROOT, capture_output=True, timeout=90,
                    text=True, encoding="utf-8", errors="replace",
                )
                if completed.returncode != 0:
                    raise RuntimeError((completed.stderr or completed.stdout or "검증 실패")[-500:])
                result_path = os.path.join(SYSTEM_ROOT, "99_MANIFEST", "last_verification.json")
                result = json.load(io.open(result_path, encoding="utf-8-sig"))
                with WORKSPACE_LOCK:
                    WORKSPACE_CACHE.update({"at": 0.0, "payload": None})
                return self._send(200, json.dumps(result, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": str(exc)[:500]}, ensure_ascii=False))
        if self.path == "/chat/debate":
            try:
                d = json.loads(raw or "{}")
                job_id = re.sub(r"[^A-Za-z0-9_-]", "", str(d.get("job_id") or ""))[:80]
                if not job_id:
                    job_id = f"debate-{int(time.time() * 1000)}-{threading.get_ident()}"
                rounds = max(1, min(3, int(d.get("rounds") or 1)))
                messages = d.get("messages", [])
                context = str(d.get("context") or "")[:12_000]
                stop_event = threading.Event()
                with DEBATE_LOCK:
                    previous = DEBATE_JOBS.get(job_id)
                    if previous:
                        previous.set()
                    DEBATE_JOBS[job_id] = stop_event
                self.close_connection = True
                self._stream_headers()
                if not self._stream_event({
                    "type": "start", "job_id": job_id, "rounds": rounds,
                    "model_calls_planned": rounds * 2, "metered_api": False,
                }):
                    stop_event.set()
                    with DEBATE_LOCK:
                        if DEBATE_JOBS.get(job_id) is stop_event:
                            DEBATE_JOBS.pop(job_id, None)
                    return
                try:
                    import ray_chat_bridge
                    for event in ray_chat_bridge.debate(
                        messages,
                        context=context,
                        rounds=rounds,
                        timeout=150,
                        cancel_event=stop_event,
                    ):
                        event["job_id"] = job_id
                        if not self._stream_event(event):
                            stop_event.set()
                            break
                except Exception as exc:
                    event_type = "stopped" if getattr(exc, "status_code", 500) == 499 else "error"
                    self._stream_event({
                        "type": event_type,
                        "job_id": job_id,
                        "error": str(exc)[:600],
                        "provider": getattr(exc, "provider", "debate"),
                        "metered_api": False,
                    })
                finally:
                    with DEBATE_LOCK:
                        if DEBATE_JOBS.get(job_id) is stop_event:
                            DEBATE_JOBS.pop(job_id, None)
                return
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:300]}, ensure_ascii=False))
        if self.path == "/open":
            try: os.startfile(OUT_DIR)
            except Exception: pass
            return self._send(200, "{}")
        if self.path == "/make":
            try:
                d = json.loads(raw or "{}"); base = "app_" + time.strftime("%H%M%S")
                passage = str(d.get("passage", "")).strip()
                if len(passage) < 40:
                    raise ValueError("영어 지문이 너무 짧습니다.")
                out = _py("ray_studio.py", "text", passage, d.get("kind", "reading"), base)
                tail = "\n".join([l for l in out.splitlines() if "·" in l or "SAVED" in l][-9:])
                return self._send(200, json.dumps({"log": tail or out[-500:]}, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/brain/search":
            try:
                d = json.loads(raw or "{}"); query = str(d.get("query", "")).strip()
                if not query:
                    return self._send(200, json.dumps({"items": []}, ensure_ascii=False))
                output = _py("ray_local_brain.py", "search", query, "--limit", "20", "--json", timeout=45)
                items = json.loads(output or "[]")
                return self._send(200, json.dumps({"items": items}, ensure_ascii=False))
            except Exception as exc:
                return self._send(500, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/brain/open":
            try:
                d = json.loads(raw or "{}"); path = os.path.abspath(str(d.get("path", "")))
                if not os.path.isfile(path):
                    raise ValueError("파일을 찾을 수 없습니다.")
                os.startfile(path)
                return self._send(200, "{}")
            except Exception as exc:
                return self._send(400, json.dumps({"error": str(exc)[:180]}, ensure_ascii=False))
        if self.path == "/chat":
            try:
                d = json.loads(raw or "{}")
                import ray_chat_bridge
                provider = str(d.get("provider") or "ray")
                reply, label = ray_chat_bridge.ask(
                    provider,
                    d.get("messages", []),
                    context=str(d.get("context") or ""),
                    timeout=150,
                )
                return self._send(200, json.dumps({
                    "reply": reply, "provider": provider, "provider_label": label,
                    "metered_api": False,
                }, ensure_ascii=False))
            except Exception as exc:
                status = getattr(exc, "status_code", 502)
                provider = getattr(exc, "provider", "bridge")
                return self._send(status, json.dumps({
                    "error": str(exc)[:500], "provider": provider, "metered_api": False,
                }, ensure_ascii=False))
        return self._send(404, "{}")

def main():
    url = f"http://127.0.0.1:{PORT}"
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    except OSError as exc:
        print(f"RAY English가 이미 실행 중이거나 {PORT} 포트를 사용할 수 없습니다: {exc}")
        if os.environ.get("RAY_NO_BROWSER", "0") != "1":
            webbrowser.open(url)
        return
    srv.daemon_threads = True
    print("=" * 48); print(f" RAY 올인원 제작기 실행됨 → {url}"); print(" 브라우저가 자동으로 열립니다. (종료: 이 창에서 Ctrl+C)"); print("=" * 48)
    if os.environ.get("RAY_NO_BROWSER", "0") != "1":
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: print("종료")

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    main()
