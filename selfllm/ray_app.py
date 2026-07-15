# -*- coding: utf-8 -*-
"""ray_app.py — RAY 제작기 로컬 독립 프로그램 (더블클릭 실행 → 브라우저 UI)
지문 붙여넣고 버튼 → 뇌(무료 API)가 자동제작. 어법은 '관리자(페이블) 검수 대기'로 보류.
실행: python ray_app.py   (또는 RAY_제작기.bat 더블클릭) → http://127.0.0.1:8777 자동 열림"""
import sys, io, os, json, threading, webbrowser, subprocess, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("RAY_PORT", "8777"))
OUT_DIR = os.path.expanduser(r"~/Downloads/수능특강/_RAY수업보드")

PAGE = """<!DOCTYPE html><html lang=ko><head><meta charset=utf-8><title>RAY 제작기 · 로컬</title>
<style>
:root{--bg:#0b0c10;--pan:#15171e;--pan2:#1d2029;--ln:#2a2e3a;--ink:#f2f3f5;--mut:#9aa3b0;--gold:#d8b968}
*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI","맑은 고딕",sans-serif}
body{background:var(--bg);color:var(--ink);padding:26px 20px 60px;max-width:940px;margin:0 auto}
.tag{background:var(--gold);color:#14151a;font-weight:700;font-size:12px;padding:3px 10px;border-radius:6px}
h1{font-size:26px;margin:10px 0 2px}.sub{color:var(--mut);font-size:14px}
.rule{height:2px;background:var(--gold);margin:14px 0 22px;border-radius:2px}
textarea{width:100%;height:150px;background:var(--pan);color:var(--ink);border:1px solid var(--ln);border-radius:10px;padding:12px;font-size:14px;resize:vertical}
.row{display:flex;gap:10px;margin:12px 0;flex-wrap:wrap;align-items:center}
select,button{background:var(--pan2);color:var(--ink);border:1px solid var(--ln);border-radius:8px;padding:10px 14px;font-size:14px;cursor:pointer}
button.go{background:var(--gold);color:#14151a;font-weight:700;border:0}
button:hover{filter:brightness(1.12)}
.card{background:var(--pan);border:1px solid var(--ln);border-radius:12px;padding:16px;margin:14px 0}
.card h3{font-size:15px;color:var(--gold);margin-bottom:8px}
#log{white-space:pre-wrap;font-size:12.5px;color:#cdd4de;background:#0f1116;border:1px solid var(--ln);border-radius:10px;padding:12px;min-height:60px;max-height:280px;overflow:auto}
.k{color:var(--mut)}.v{color:var(--ink);font-weight:700}
a{color:#e8d5a5}
.badge{display:inline-block;background:var(--pan2);border:1px solid var(--ln);border-radius:6px;padding:2px 8px;font-size:12px;margin-right:6px}
</style></head><body>
<span class=tag>RAY ENGLISH · 로컬 제작기</span>
<h1>수업자료 올인원 제작기</h1>
<div class=sub>지문 붙여넣기 → 뇌(무료 API)가 판서 PPT + 학생용 자동 생성. 어법은 관리자(페이블) 검수 대기.</div>
<div class=rule></div>

<div class=card>
  <h3>1. 지문 입력</h3>
  <textarea id=psg placeholder="영어 지문을 붙여넣으세요..."></textarea>
  <div class=row>
    <select id=kind><option value=reading>독해(제목·주제·빈칸)</option><option value=grammar>어법(밑줄 틀린 것)</option></select>
    <button class=go onclick=make()>🚀 제작 시작</button>
    <span class=k id=hint>어법은 자동확정 없이 검수 대기함으로 보류됩니다.</span>
  </div>
</div>

<div class=card><h3>2. 진행 로그</h3><div id=log>대기 중…</div></div>

<div class=card>
  <h3>3. 상태 · 검수 대기함</h3>
  <div class=row>
    <button onclick=stat()>상태 새로고침</button>
    <button onclick=review()>어법 검수 대기함</button>
    <span class=v id=port></span>
  </div>
  <div id=status class=sub></div>
</div>
<div class=sub>결과 폴더: <a href="#" onclick="fetch('/open',{method:'POST'});return false">_RAY수업보드 열기</a> · 페이블(이 챗) 검수: 대기 문항을 관리자에게 요청하세요.</div>
<script>
const L=document.getElementById('log');
function log(t){L.textContent=t;}
async function make(){
  const p=document.getElementById('psg').value.trim(); if(!p){log('지문을 넣어주세요');return;}
  const k=document.getElementById('kind').value;
  log('제작 중… (뇌 분석 → 마크업 → 렌더, 약 10~15초)');
  try{const r=await fetch('/make',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passage:p,kind:k})});
    const d=await r.json(); log(d.log||JSON.stringify(d));}
  catch(e){log('오류: '+e);}
}
async function stat(){const r=await fetch('/status');const d=await r.json();
  document.getElementById('status').innerHTML=
   `뇌 토큰 <b>${d.tokens}/${d.budget}</b> · 지식 <b>${d.vocab}</b>개 · 누적생성 <b>${d.runs}</b> · 검수대기 <b>${d.review}</b>건 · 유료계층 ${d.paid}`;}
async function review(){const r=await fetch('/review');const d=await r.json();
  document.getElementById('status').innerHTML='<b>어법 검수 대기함('+d.items.length+'건)</b><br>'+
   (d.items.map(x=>`• ${x.header} 정답${x.answer} ${x.error_form}→${x.correct} [${x.label}] ${x.auto_verify?'✓자동통과':'⚠검수필요'}`).join('<br>')||'없음');}
document.getElementById('port').textContent='http://127.0.0.1:__PORT__';
stat();
</script></body></html>"""

def _py(*args, timeout=200):
    r = subprocess.run([sys.executable, *[os.path.join(HERE, a) if a.endswith(".py") else a for a in args]],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    return (r.stdout or "") + (r.stderr or "")

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == "/": return self._send(200, PAGE.replace("__PORT__", str(PORT)), "text/html; charset=utf-8")
        if self.path == "/status":
            import ray_studio, ray_escalate
            st = {}
            for f in ["brain_state.json", "brain_knowledge.json"]:
                p = os.path.join(HERE, f)
                try: st[f] = json.load(io.open(p, encoding="utf-8"))
                except Exception: st[f] = {}
            paid = "OFF(무료)"
            try:
                import claude_router; paid = "활성(옵트인)" if claude_router.available() else "OFF(무료)"
            except Exception: pass
            return self._send(200, json.dumps({
                "tokens": st["brain_state.json"].get("tokens", 0), "budget": os.environ.get("RAY_DAILY_TOKENS", "80000"),
                "vocab": len(st["brain_knowledge.json"].get("glossary", {})), "runs": st["brain_state.json"].get("runs_total", 0),
                "review": len(ray_studio.review_pending()), "paid": paid}, ensure_ascii=False))
        if self.path == "/review":
            import ray_studio
            return self._send(200, json.dumps({"items": ray_studio.review_pending()}, ensure_ascii=False))
        return self._send(404, "{}")
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); raw = self.rfile.read(n).decode("utf-8") if n else "{}"
        if self.path == "/open":
            try: os.startfile(OUT_DIR)
            except Exception: pass
            return self._send(200, "{}")
        if self.path == "/make":
            d = json.loads(raw or "{}"); psg = d.get("passage", ""); kind = d.get("kind", "reading")
            base = "app_" + time.strftime("%H%M%S")
            out = _py("ray_studio.py", "text", psg, kind, base)
            # ray_studio.text 는 base=text 고정 → 직접 make로 base 지정하려면 별도. 여기선 로그만 반환.
            tail = "\n".join([l for l in out.splitlines() if "·" in l or "SAVED" in l][-8:])
            return self._send(200, json.dumps({"log": tail or out[-500:], "folder": OUT_DIR}, ensure_ascii=False))
        return self._send(404, "{}")

def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"RAY 제작기 로컬 실행 → http://127.0.0.1:{PORT}  (종료: Ctrl+C)")
    threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: print("종료")

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    main()
