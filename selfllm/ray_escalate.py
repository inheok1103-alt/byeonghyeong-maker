# -*- coding: utf-8 -*-
"""ray_escalate.py — 3계층 문제해결 하네스 + 교훈 학습
계층: ① 제작기 자가해결(local) → ② GPT 하청(subcontract) → ③ 관리자(Claude) 보고
매 실행마다 '교훈(lesson)'을 남겨 다음 실행 프롬프트에 반영(지속 품질 향상).

- learn(): 교훈을 brain_lessons.jsonl 에 축적
- recent_lessons(): 최근 교훈 요약 → 뇌 프롬프트에 주입
- gpt_subcontract(): 로컬이 못 푼 문제를 GPT(gpt-oss)에게 하청
- to_manager(): 그래도 안 되면 관리자(Claude) 수신함(_manager_inbox.jsonl)에 보고
- guarded(): 위 계층을 자동으로 태우는 실행기"""
import os, io, json, time, re
HERE = os.path.dirname(os.path.abspath(__file__))
import ray_llm
LESSONS = os.path.join(HERE, "brain_lessons.jsonl")
INBOX = os.path.join(HERE, "_manager_inbox.jsonl")

def _append(path, obj):
    with io.open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def learn(topic, ok, note, tier="local"):
    _append(LESSONS, {"ts": time.strftime("%Y-%m-%d %H:%M"), "topic": topic, "ok": bool(ok), "tier": tier, "note": str(note)[:200]})

def recent_lessons(n=6):
    if not os.path.exists(LESSONS): return []
    lines = [l for l in io.open(LESSONS, encoding="utf-8").read().splitlines() if l.strip()]
    out = []
    for l in lines[-40:]:
        try:
            d = json.loads(l)
            if d.get("note") and not d.get("ok"): out.append("⚠ " + d["note"])
            elif d.get("note") and d.get("ok"): out.append("✓ " + d["note"])
        except Exception: pass
    # 중복 제거, 실패교훈 우선
    seen = [];
    for x in out:
        if x not in seen: seen.append(x)
    return seen[-n:]

def lessons_preamble():
    ls = recent_lessons()
    if not ls: return ""
    return "지난 실행에서 얻은 교훈(반드시 반영):\n" + "\n".join(f"- {x}" for x in ls) + "\n\n"

def gpt_subcontract(problem, context="", want_json=True):
    """로컬이 못 푼 문제를 GPT(gpt-oss)에게 하청. pollinations model=openai 강제."""
    msg = [{"role": "system", "content": "너는 RAY 제작기의 하청 엔지니어(GPT)다. 문제를 정확한 결과물로 해결하라."},
           {"role": "user", "content": f"[문제]\n{problem}\n\n[맥락]\n{context}\n\n결과만 출력."}]
    prev = os.environ.get("RAY_PROXY", "")
    try:
        os.environ["RAY_PROXY"] = ""   # 프록시 우회 → 순수 pollinations(gpt-oss) 하청
        if want_json:
            d, prov = ray_llm.ask_json(msg, temperature=0.2); learn("gpt하청", True, "GPT가 JSON 복구/해결", "gpt"); return d
        r, prov = ray_llm.ask(msg, temperature=0.2); learn("gpt하청", True, "GPT 응답", "gpt"); return r
    except Exception as e:
        learn("gpt하청", False, f"GPT 하청 실패: {e}", "gpt"); raise
    finally:
        os.environ["RAY_PROXY"] = prev

def to_manager(task, error, attempts):
    """관리자(Claude) 수신함에 보고 — 자동으로 못 푼 문제."""
    _append(INBOX, {"ts": time.strftime("%Y-%m-%d %H:%M"), "task": str(task)[:300],
                    "error": str(error)[:300], "attempts": attempts, "status": "open"})
    learn("관리자보고", False, f"관리자(Claude) 에스컬레이션: {str(error)[:80]}", "manager")

def manager_inbox(status="open"):
    if not os.path.exists(INBOX): return []
    out = []
    for l in io.open(INBOX, encoding="utf-8").read().splitlines():
        if l.strip():
            try:
                d = json.loads(l)
                if status is None or d.get("status") == status: out.append(d)
            except Exception: pass
    return out

def guarded(fn, *, repair=None, context="", topic="task"):
    """① local fn() → 실패 시 ② GPT 하청(repair가 있으면 결과로 재시도) → ③ 관리자 보고."""
    attempts = []
    try:
        r = fn(); learn(topic, True, f"{topic} 자가해결", "local"); return r
    except Exception as e1:
        attempts.append(f"local: {str(e1)[:80]}")
        learn(topic, False, f"자가해결 실패: {str(e1)[:80]}", "local")
        # ② Claude 계층(역할별 모델 라우팅)
        try:
            import claude_router
            if claude_router.available() and repair is not None:
                role = claude_router.route(topic)
                txt, model = claude_router.ask(role, f"다음 실패를 JSON 결과로 복구: {e1}\n맥락:\n{context}", max_tokens=2048)
                fixed = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
                r = repair(fixed); learn(topic, True, f"Claude({model}) 복구", "claude"); return r
        except Exception as ec:
            attempts.append(f"claude: {str(ec)[:60]}")
        # ③ GPT 하청
        try:
            if repair is not None:
                fixed = gpt_subcontract(f"{topic} 실패를 복구하라: {e1}", context, want_json=True)
                r = repair(fixed); learn(topic, True, "GPT 하청으로 복구", "gpt"); return r
        except Exception as e2:
            attempts.append(f"gpt: {str(e2)[:80]}")
        # ④ 관리자 보고
        to_manager(topic, e1, attempts)
        raise

if __name__ == "__main__":
    import sys
    a = sys.argv[1:] or ["lessons"]
    if a[0] == "lessons":
        print("최근 교훈:"); [print("  ", x) for x in recent_lessons(10)] or print("  (없음)")
    elif a[0] == "inbox":
        items = manager_inbox("open")
        print(f"관리자 수신함(미해결 {len(items)}건):")
        for it in items: print(f"  - [{it['ts']}] {it['task'][:60]} :: {it['error'][:60]}")
    elif a[0] == "learn":
        learn(a[1], True, a[2] if len(a) > 2 else ""); print("교훈 기록")
