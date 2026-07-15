# -*- coding: utf-8 -*-
"""ray_app.py — RAY 올인원 제작기 (로컬 독립 프로그램, 딸깍 실행)
한 대시보드에서 전 도구: 문제제작·분석지·워크북·AI메이커 + 수업PPT/학생용 + 24h 뇌·검수함.
로컬 서버가 기존 브라우저 도구(exam/sheet/workbook/ai_maker...)까지 함께 서빙 → 진짜 올인원.
실행: python ray_app.py  (또는 RAY_제작기.bat 더블클릭) → http://127.0.0.1:8777 자동 열림."""
import sys, io, os, json, threading, webbrowser, subprocess, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__))
WEBROOT = os.path.dirname(HERE)   # 기존 HTML 도구들이 있는 web/ 루트
PORT = int(os.environ.get("RAY_PORT", "8777"))
OUT_DIR = os.path.expanduser(r"~/Downloads/수능특강/_RAY수업보드")
CT = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
      ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"}

TOOLS = [
    ("exam.html", "📝", "문제 제작기", "변형·유형별 17유형 출제"),
    ("ai_maker.html", "🤖", "AI 메이커", "LLM 자동출제 + 정답검증"),
    ("sheet.html", "🔎", "분석지", "구조·직독직해·어휘"),
    ("workbook.html", "📚", "워크북", "오프라인 워크북"),
    ("studio.html", "🎬", "스튜디오", "세트 편집·조판"),
    ("report.html", "📊", "리포트", "학습·출제 리포트"),
]

def PAGE():
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

def _py(*args, timeout=240):
    r = subprocess.run([sys.executable, *[os.path.join(HERE, a) if a.endswith(".py") else a for a in args]],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    return (r.stdout or "") + (r.stderr or "")

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        try: self.wfile.write(b)
        except Exception: pass
    def log_message(self, *a): pass
    def _static(self, path):
        rel = urllib.parse.unquote(path.lstrip("/")).split("?")[0]
        full = os.path.normpath(os.path.join(WEBROOT, rel))
        if not full.startswith(WEBROOT) or not os.path.isfile(full): return False
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f: self._send(200, f.read(), CT.get(ext, "application/octet-stream"))
        return True
    def do_GET(self):
        if self.path == "/" or self.path == "/index_app": return self._send(200, PAGE(), "text/html; charset=utf-8")
        if self.path == "/status":
            import ray_studio
            st = {}
            for f in ["brain_state.json", "brain_knowledge.json"]:
                try: st[f] = json.load(io.open(os.path.join(HERE, f), encoding="utf-8"))
                except Exception: st[f] = {}
            paid = "OFF(무료)"
            try:
                import claude_router; paid = "활성" if claude_router.available() else "OFF(무료)"
            except Exception: pass
            return self._send(200, json.dumps({
                "tokens": st["brain_state.json"].get("tokens", 0), "budget": os.environ.get("RAY_DAILY_TOKENS", "80000"),
                "vocab": len(st["brain_knowledge.json"].get("glossary", {})), "runs": st["brain_state.json"].get("runs_total", 0),
                "review": len(ray_studio.review_pending()), "paid": paid}, ensure_ascii=False))
        if self.path == "/review":
            import ray_studio; return self._send(200, json.dumps({"items": ray_studio.review_pending()}, ensure_ascii=False))
        if self._static(self.path): return
        return self._send(404, "{}")
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); raw = self.rfile.read(n).decode("utf-8") if n else "{}"
        if self.path == "/open":
            try: os.startfile(OUT_DIR)
            except Exception: pass
            return self._send(200, "{}")
        if self.path == "/make":
            d = json.loads(raw or "{}"); base = "app_" + time.strftime("%H%M%S")
            out = _py("ray_studio.py", "text", d.get("passage", ""), d.get("kind", "reading"), base)
            tail = "\n".join([l for l in out.splitlines() if "·" in l or "SAVED" in l][-9:])
            return self._send(200, json.dumps({"log": tail or out[-500:]}, ensure_ascii=False))
        return self._send(404, "{}")

def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"RAY 올인원 제작기 실행 → http://127.0.0.1:{PORT}  (종료 Ctrl+C)")
    threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: print("종료")

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    main()
