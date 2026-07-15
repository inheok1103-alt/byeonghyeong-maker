# -*- coding: utf-8 -*-
"""ray.py — RAY 올인원 제작기 마스터 진입점 (전 기능 단일 CLI, 추가비용 0)
지문 하나 → 뇌(무료 API) 분석 → 판서 수업PPT + 학생용까지 순서대로 자동.

  python ray.py make "<영어 지문...>"     # 올인원 생성(뇌 API 분석 → PPT+학생용)
  python ray.py chapter 7 04              # 로컬 수능특강에서 발췌 후 자동제작
  python ray.py brain [once|loop|sleep|study N]   # 24시간 뇌(토큰배분·학습·수면)
  python ray.py enqueue "<지문>"          # 뇌 큐에 넣기(데몬이 실시간 처리)
  python ray.py collab                    # GPT(FINAL 폴더)와 교차검증·대조
  python ray.py inbox                     # 관리자(Claude) 수신함(자동해결 실패건)
  python ray.py lessons                   # 축적된 교훈
  python ray.py status                    # 전체 상태 한눈에

계층(전부 무료 기본): 로컬 제작기 → 무료 뇌(ray-proxy·pollinations) → GPT 하청(무료) → 관리자(세션 중 Claude).
Claude 유료 API 계층은 RAY_ALLOW_PAID=1 옵트인 때만(기본 OFF = 추가비용 없음)."""
import sys, io, os, json, subprocess
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
def run(mod, *args): return subprocess.run([sys.executable, os.path.join(HERE, mod), *args])

def status():
    import ray_escalate
    st = {}
    for f in ["brain_state.json", "brain_knowledge.json"]:
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            try: st[f] = json.load(io.open(p, encoding="utf-8"))
            except Exception: pass
    s = st.get("brain_state.json", {}); k = st.get("brain_knowledge.json", {})
    print("═══ RAY 제작기 상태 ═══")
    print(f" 뇌: 오늘 토큰 {s.get('tokens',0)}/{os.environ.get('RAY_DAILY_TOKENS','80000')} · 호출 {s.get('calls',0)} · 누적생성 {s.get('runs_total',0)}")
    print(f" 지식: 어휘 {len(k.get('glossary',{}))}개 · 학습 {k.get('stats',{}).get('studied',0)} · 마지막수면 {k.get('stats',{}).get('last_sleep','-')}")
    inbox = ray_escalate.manager_inbox("open")
    print(f" 관리자 수신함(미해결): {len(inbox)}건")
    for it in inbox[:3]: print(f"   - {it['ts']} {it['task'][:40]} :: {it['error'][:40]}")
    print(f" 최근 교훈: {len(ray_escalate.recent_lessons(20))}건")
    try:
        import claude_router
        print(f" Claude 유료계층: {'활성(옵트인)' if claude_router.available() else 'OFF(추가비용 0)'}")
    except Exception: pass

if __name__ == "__main__":
    a = sys.argv[1:] or ["status"]
    c = a[0]
    if c == "make": run("ray_studio.py", "text", a[1], a[2] if len(a) > 2 else "reading")
    elif c == "chapter": run("ray_studio.py", "chapter", *a[1:])
    elif c == "brain": run("brain_daemon.py", *(a[1:] or ["once"]))
    elif c == "enqueue": run("brain_daemon.py", "enqueue", a[1])
    elif c == "collab": run("ray_collab.py", "scan")
    elif c == "inbox": run("ray_escalate.py", "inbox")
    elif c == "lessons": run("ray_escalate.py", "lessons")
    elif c == "status": status()
    else: print(__doc__)
