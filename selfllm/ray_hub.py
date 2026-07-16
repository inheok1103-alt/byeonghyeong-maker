# -*- coding: utf-8 -*-
"""ray_hub.py — 단일 공유 버스 (어디서 치든 동시동작)
Claude 세션(이 챗)·GPT 세션·로컬 앱·CLI 어디서 요청하든 같은 파일 상태를 보고 처리한다.
통합 대상:
  · _fable/requests(페이블 출제/검수 요청) + _fable/responses
  · _review_queue.jsonl(어법·독해 문항 검수 대기)
  · brain_state.json(뇌 토큰·연구)  · activity.log(모든 세션 공통 활동로그)
아무 세션이나: hub.post(...) 로 일감 등록 → hub.pending() 로 어디서든 동일 백로그 조회."""
import os, io, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
ACTIVITY = os.path.join(HERE, "activity.log")

def _now(): return time.strftime("%Y-%m-%d %H:%M:%S")

def log(source, event, detail=""):
    """모든 세션 공통 활동로그(append-only). source=claude|gpt|app|cli|brain"""
    line = json.dumps({"ts": _now(), "src": source, "ev": event, "detail": str(detail)[:300]}, ensure_ascii=False)
    with io.open(ACTIVITY, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def pending():
    """모든 채널의 미처리 일감을 하나로. 어느 세션에서 호출해도 동일 결과."""
    items = []
    try:
        import ray_bridge
        for r in ray_bridge.list_requests("open"):
            items.append({"ch": "fable", "id": r["rid"], "kind": r.get("kind"),
                          "ts": r.get("ts"), "who": "페이블(출제/검수)", "detail": r.get("instruction", "")[:90]})
    except Exception: pass
    try:
        import ray_studio
        for r in ray_studio.review_pending():
            items.append({"ch": "review", "id": r.get("rid") or r.get("header"), "kind": r.get("kind"),
                          "ts": r.get("ts"), "who": "관리자 검수", "detail": r.get("header", "")})
    except Exception: pass
    items.sort(key=lambda x: x.get("ts") or "", reverse=True)
    return items

def status():
    st = {"fable_open": 0, "review_pending": 0, "brain_tokens": 0, "research_last": "-", "activity": 0}
    try:
        import ray_bridge; st["fable_open"] = len(ray_bridge.list_requests("open"))
    except Exception: pass
    try:
        import ray_studio; st["review_pending"] = len(ray_studio.review_pending())
    except Exception: pass
    try:
        s = json.load(io.open(os.path.join(HERE, "brain_state.json"), encoding="utf-8"))
        st["brain_tokens"] = s.get("tokens", 0); st["research_last"] = s.get("research_last", "-")
    except Exception: pass
    try:
        st["activity"] = sum(1 for _ in io.open(ACTIVITY, encoding="utf-8")) if os.path.exists(ACTIVITY) else 0
    except Exception: pass
    st["total_backlog"] = st["fable_open"] + st["review_pending"]
    return st

def recent(n=12):
    if not os.path.exists(ACTIVITY): return []
    lines = io.open(ACTIVITY, encoding="utf-8").read().splitlines()[-n:]
    out = []
    for l in lines:
        try: out.append(json.loads(l))
        except Exception: pass
    return out

if __name__ == "__main__":
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["status"]
    if a[0] == "status":
        s = status(); print(f"통합 백로그 {s['total_backlog']}건 (페이블 {s['fable_open']} · 검수 {s['review_pending']}) · 뇌토큰 {s['brain_tokens']} · 활동 {s['activity']}줄")
    elif a[0] == "pending":
        for it in pending(): print(f"  [{it['ch']}] {it.get('kind')} · {it.get('who')} · {it.get('detail','')[:60]}")
    elif a[0] == "log" and len(a) > 2:
        log(a[1], a[2], " ".join(a[3:])); print("logged")
    elif a[0] == "recent":
        for r in recent(): print(f"  {r.get('ts')} [{r.get('src')}] {r.get('ev')} {r.get('detail','')[:50]}")
