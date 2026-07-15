# -*- coding: utf-8 -*-
"""brain_daemon.py — RAY 24시간 뇌 (토큰 배분 · 실시간 반응 · 품질향상 · 매일 수면)
기존 뇌 API(ray_llm)에 연결. 토큰 한도 안에서 24시간 균등 분산해 항상 살아있음.

핵심:
- 토큰 예산: 하루 DAILY_BUDGET 안에서 '지금 시각까지 허용량'만 소비(24h 균등 페이싱) → 고갈 방지
- 실시간: 짧은 간격 폴링, 큐(_brain_queue.jsonl / 구글 gas queue)에 요청 오면 즉시 처리
- 품질향상: 유휴 시간엔 '학습'(어려운 단어 뜻·출제 팁을 뇌에 물어 지식 축적)
- 매일 수면(sleep): 지식 정리 — 중복 제거, 오류/빈 기억 삭제, 상위 N개만 남겨 용량 축소, 압축 저장

사용:
  python brain_daemon.py loop            # 24시간 상주(Ctrl+C 종료)
  python brain_daemon.py once            # 1틱만
  python brain_daemon.py sleep           # 수면(지식 정리) 강제 실행
  python brain_daemon.py study 5         # 5회 학습(지식 축적)
  python brain_daemon.py enqueue "<지문>"# 생성 요청 큐에 추가"""
import sys, io, os, json, re, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
import ray_llm
KB = os.path.join(HERE, "brain_knowledge.json")
STATE = os.path.join(HERE, "brain_state.json")
QUEUE = os.path.join(HERE, "_brain_queue.jsonl")
SLEEPLOG = os.path.join(HERE, "brain_sleep_log.txt")

# ── 토큰 예산(Groq TPD 10만 함정 회피: 여유롭게 8만) ──
DAILY_BUDGET = int(os.environ.get("RAY_DAILY_TOKENS", "80000"))
POLL_SEC = int(os.environ.get("RAY_POLL", "25"))       # 실시간 폴링 간격
SLEEP_HOUR = int(os.environ.get("RAY_SLEEP_HOUR", "4")) # 새벽 4시에 수면
GLOSSARY_CAP = 2500                                     # 지식 상한(용량 관리)

def now(): return time.localtime()
def today(): return time.strftime("%Y-%m-%d", now())
def hour(): return now().tm_hour
def jload(p, d):
    try: return json.load(io.open(p, encoding="utf-8"))
    except Exception: return d
def jsave(p, o): json.dump(o, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def load_state():
    s = jload(STATE, {})
    if s.get("date") != today():
        s = {"date": today(), "tokens": 0, "calls": 0, "last_sleep": s.get("last_sleep", ""),
             "runs_total": s.get("runs_total", 0), "quality": s.get("quality", 0.0)}
        jsave(STATE, s)
    return s

def est_tokens(text): return max(1, len(str(text)) // 3)   # 대략치(프롬프트+응답)

def paced_allow(est):
    """지금 시각까지 균등 배분 허용량 안이면 True (24시간 분산)."""
    s = load_state()
    allow_by_now = DAILY_BUDGET * (hour() * 60 + now().tm_min + 1) / (24 * 60)
    return (s["tokens"] + est) <= min(DAILY_BUDGET, allow_by_now + est)

def spend(tokens):
    s = load_state(); s["tokens"] += int(tokens); s["calls"] += 1; jsave(STATE, s)

def brain_call(messages, temperature=0.4, json_mode=False):
    est = est_tokens(json.dumps(messages, ensure_ascii=False))
    if not paced_allow(est):
        raise RuntimeError("토큰 페이싱 한도 — 다음 시각까지 대기(예산 보호)")
    if json_mode: r, prov = ray_llm.ask_json(messages, temperature)
    else: r, prov = ray_llm.ask(messages, temperature)
    spend(est + est_tokens(json.dumps(r, ensure_ascii=False)))
    return r, prov

# ── 지식(용량·품질 관리) ──
def load_kb():
    return jload(KB, {"glossary": {}, "connectives_extra": [], "stopwords_extra": [],
                      "usage": {}, "errors": [], "stats": {"studied": 0}})
def save_kb(kb): jsave(KB, kb)

# ── 학습: 유휴 시 지식 축적(품질 향상) ──
STUDY_PROMPT = """한국 고등 영어 지문에 자주 나오는 어려운 어휘 8개와 짧은 한국어 뜻을 JSON으로만.
형식: {"glossary":{"word":"뜻",...}}  중복·쉬운 단어 금지, 수능 빈출 위주."""
def study(times=1):
    kb = load_kb(); added = 0
    for _ in range(times):
        try:
            d, prov = brain_call([{"role": "user", "content": STUDY_PROMPT}], 0.7, json_mode=True)
            for w, m in (d.get("glossary") or {}).items():
                w = re.sub(r"[^A-Za-z\-]", "", w).lower()
                if w and w not in kb["glossary"]:
                    kb["glossary"][w] = str(m)[:24]; added += 1
        except Exception as e:
            kb.setdefault("errors", []).append({"t": today(), "e": str(e)[:80]}); break
    kb.setdefault("stats", {})["studied"] = kb["stats"].get("studied", 0) + added
    save_kb(kb); print(f"  · 학습 +{added}개 (총 {len(kb['glossary'])})"); return added

# ── 생성 요청 처리(실시간) ──
def enqueue(passage, kind="reading"):
    with io.open(QUEUE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": time.time(), "passage": passage, "kind": kind}, ensure_ascii=False) + "\n")
    print("  · 큐 추가")
def pop_queue():
    if not os.path.exists(QUEUE): return None
    lines = io.open(QUEUE, encoding="utf-8").read().splitlines()
    lines = [l for l in lines if l.strip()]
    if not lines: return None
    item = json.loads(lines[0]); io.open(QUEUE, "w", encoding="utf-8").write("\n".join(lines[1:]) + ("\n" if lines[1:] else ""))
    return item
def process(item):
    base = "queue_" + time.strftime("%H%M%S")
    r = subprocess.run([sys.executable, os.path.join(HERE, "ray_studio.py"), "text", item["passage"], item.get("kind", "reading")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = "완료" in (r.stdout or "")
    s = load_state(); s["runs_total"] = s.get("runs_total", 0) + 1; jsave(STATE, s)
    print(f"  · 요청 처리 {'OK' if ok else '실패'}")
    return ok

# ── 매일 GPT 공동연구(하루 1개, 토큰 여유 시 추가) ──
RESEARCH_DIR = os.path.join(HERE, "_research"); os.makedirs(RESEARCH_DIR, exist_ok=True)
RESEARCH_AGENDA = [
    "빈칸 문항에서 정답 상위어(패러프레이즈)와 지문 핵심어의 거리 기준",
    "오답 매력도를 높이는 5원칙(소재재활용·복수정답위험 회피)",
    "글의 순서 문항의 결속 신호(지시어·관사·연결어) 우선순위",
    "어법 문항 함정 유형 분포와 수일치·분사·관계사 출제 비율",
    "함축 의미 문항의 밑줄 선정 기준 — 은유 vs 재진술",
    "요약문 (A)(B) 쌍의 품사 조합과 오답 설계",
    "내용불일치 문항에서 '사실 왜곡'의 자연스러운 강도 조절",
    "무관문장 문항 — 소재는 같고 논지만 다른 문장의 생성 공식",
    "어휘 문항 반의어 교체 시 문맥 성립 위험(복수정답) 차단법",
    "제목 문항 오답 4종 공식(부분소재·과잉일반화·반대방향·무관)",
]
def daily_research(bonus=False):
    """GPT와 연구 1회: 주제 선정→GPT 심층 의견→핵심 정리→지식 반영. _research/에 저장."""
    s = load_state(); idx = int(s.get("research_idx", 0)) % len(RESEARCH_AGENDA)
    topic = RESEARCH_AGENDA[idx]
    tag = "bonus" if bonus else "daily"
    print(f"  · GPT 공동연구({tag}) 시작: {topic[:40]}")
    try:
        q = (f"너는 한국 수능·내신 영어 출제 연구자다. 주제: {topic}\n"
             "실무에 바로 쓸 체크리스트(5~8항)와 흔한 실패사례 2개를 한국어로 간결히 정리하라.")
        reply, prov = brain_call([{"role": "user", "content": q}], 0.5)
        fn = os.path.join(RESEARCH_DIR, f"{today()}_{'b' if bonus else 'd'}_{idx:02d}.md")
        io.open(fn, "w", encoding="utf-8").write(f"# {topic}\n\n({today()} · {prov} · {tag})\n\n{reply}\n")
        s = load_state(); s["research_idx"] = idx + 1; s["research_last"] = today()
        s["research_count"] = s.get("research_count", 0) + 1; jsave(STATE, s)
        # 교훈으로도 요약 반영
        try:
            import ray_escalate; ray_escalate.learn("GPT연구", True, f"{topic[:40]} 정리 저장")
        except Exception: pass
        print(f"  · 연구 저장: {os.path.basename(fn)}")
        return True
    except Exception as e:
        print("  · 연구 실패:", str(e)[:60]); return False

# ── 수면: 매일 지식 정리(용량 축소 + 오류기억 삭제 + 압축) ──
def sleep_consolidate():
    kb = load_kb(); before = os.path.getsize(KB) if os.path.exists(KB) else 0
    g = kb.get("glossary", {}); usage = kb.get("usage", {})
    # 1) 빈/오류 항목 제거
    g = {w: m for w, m in g.items() if w and m and not re.search(r"error|없음|실패|undefined", str(m), re.I)}
    # 2) 중복(같은 뜻 다른 표기) 정리 — 소문자 키 기준 이미 유일
    # 3) 상한 초과 시 사용빈도 낮은 것부터 삭제(용량 축소)
    if len(g) > GLOSSARY_CAP:
        ranked = sorted(g.keys(), key=lambda w: usage.get(w, 0))
        for w in ranked[:len(g) - GLOSSARY_CAP]: g.pop(w, None)
    kb["glossary"] = g
    # 4) 오류 로그는 최근 20개만 남기고 비움(불필요한 기억 삭제)
    kb["errors"] = (kb.get("errors", []))[-5:]
    # 5) 연결어 중복 제거
    kb["connectives_extra"] = sorted(set(kb.get("connectives_extra", [])))
    kb.setdefault("stats", {})["last_sleep"] = today()
    save_kb(kb)
    s = load_state(); s["last_sleep"] = today(); jsave(STATE, s)
    after = os.path.getsize(KB)
    msg = f"[{today()} {time.strftime('%H:%M')}] 수면 완료 — 어휘 {len(g)}개, 용량 {before}→{after}B (Δ{after-before})"
    io.open(SLEEPLOG, "a", encoding="utf-8").write(msg + "\n"); print("  · " + msg)
    return msg

def sync_github():
    """지식·상태를 GitHub에 커밋(로컬↔GitHub 연결). 실패해도 무시."""
    try:
        subprocess.run(["git", "-C", HERE, "add", "brain_knowledge.json", "brain_state.json", "brain_sleep_log.txt"],
                       capture_output=True)
        r = subprocess.run(["git", "-C", HERE, "commit", "-q", "-m", f"🧠 brain {today()} 지식/수면 동기화 [skip ci]"],
                           capture_output=True, text=True)
        print("  · GitHub 커밋", "OK" if r.returncode == 0 else "(변경없음)")
    except Exception as e:
        print("  · GitHub 동기화 스킵:", str(e)[:50])

def tick():
    s = load_state()
    print(f"[{today()} {time.strftime('%H:%M')}] 토큰 {s['tokens']}/{DAILY_BUDGET} · 호출 {s['calls']} · 누적생성 {s.get('runs_total',0)}")
    item = pop_queue()
    if item:
        if paced_allow(est_tokens(item["passage"])): process(item)
        else: print("  · 예산 대기(요청 보류)"); enqueue(item["passage"], item.get("kind", "reading"))
        return
    # 매일 GPT 공동연구: 하루 1개 필수(9시 이후), 저녁에 예산 50%+ 남으면 보너스 1개 추가
    if hour() >= 9 and s.get("research_last") != today() and paced_allow(3000):
        daily_research(); return
    if hour() >= 18 and s.get("research_last") == today() and s.get("research_bonus_last") != today() \
       and s["tokens"] < DAILY_BUDGET * 0.5 and paced_allow(3000):
        if daily_research(bonus=True):
            s = load_state(); s["research_bonus_last"] = today(); jsave(STATE, s)
        return
    # 유휴: 학습으로 품질 향상(페이싱 여유 있을 때만)
    if paced_allow(2000): study(1)
    else: print("  · 유휴(예산 페이싱 대기)")

def loop():
    print(f"RAY 뇌 상주 시작 · 하루예산 {DAILY_BUDGET}토큰 · 폴링 {POLL_SEC}s · 수면 {SLEEP_HOUR}시")
    while True:
        try:
            tick()
            s = load_state()
            if hour() == SLEEP_HOUR and s.get("last_sleep") != today():
                sleep_consolidate(); sync_github()
        except KeyboardInterrupt:
            print("종료"); break
        except Exception as e:
            print("  · tick 오류:", str(e)[:80])
        time.sleep(POLL_SEC)

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["once"]
    if a[0] == "loop": loop()
    elif a[0] == "once": tick()
    elif a[0] == "sleep": sleep_consolidate()
    elif a[0] == "study": study(int(a[1]) if len(a) > 1 else 3)
    elif a[0] == "enqueue": enqueue(a[1])
    elif a[0] == "sync": sync_github()
    else: print(__doc__)
