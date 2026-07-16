# -*- coding: utf-8 -*-
"""ray_router.py — 지능형 작업 라우터 (어디서 치든 가장 적합한 모델로 분배)
요청 텍스트/작업종류를 분석해 실행자와 티어를 고른다. 라우팅 자체는 무료(키워드·규칙, LLM 미사용).
클로드: fable(최고 신뢰) · opus(강한 추론) · sonnet(빠름/저렴)
GPT(codex 구독): high(심층 리서치) · low(빠른 아이디어)
무료뇌: 직독직해·구조·어휘 분석 등 대량 서술.

route(text) -> {"executor","model","effort","reason","tier"}
plan(text)  -> [route, ...]  (복합 요청을 단계로 분해해 각기 라우팅)"""
import re

# (정규식, executor, model/effort, tier라벨, 이유)
RULES = [
    # ── Claude Fable : 오류 창작·정밀 판정·최종 신뢰 ──
    (r"어법|문법|틀린|수일치|분사|관계사|어순|비문|정오|맞았|틀렸", "claude", "fable", "정밀·신뢰", "어법 정오는 최고 신뢰 필요"),
    (r"어휘\s*문항|반의어|문맥상.*낱말|낱말.*적절", "claude", "fable", "정밀·신뢰", "어휘 교체 정밀성"),
    (r"출제|문항\s*만들|정답\s*(확정|검증|판정)|오답\s*설계|변형\s*문제|킬러", "claude", "fable", "출제·판정", "문항 창작·정답 확정"),
    (r"검수|검증|최종\s*확정|믿을|신뢰|리스크|위험\s*검토", "claude", "fable", "검수", "최종 신뢰 판정"),
    # ── Claude Opus : 강한 추론·심화 해설·설계 ──
    (r"해설|왜\s|근거|논리|추론|분석해|구조\s*설계|커리큘럼|교재\s*설계|알고리즘|아키텍처|리팩터|디자인", "claude", "opus", "심화추론", "복잡한 추론·설계"),
    # ── Claude Sonnet : 빠름/저렴·대량·단순 ──
    (r"번역|요약|정리|포맷|목록|표로|간단|짧게|바꿔|정돈|맞춤법|오타|리스트", "claude", "sonnet", "고속", "빠르고 저렴한 반복 작업"),
    # ── GPT(codex) high : 심층 리서치·대안 관점 ──
    (r"리서치|조사|최신|트렌드|사례\s*조사|비교\s*분석|시장|경쟁|자료\s*찾|근거\s*수집|심층", "codex", "high", "GPT심층", "외부지식 심층 리서치는 GPT"),
    # ── GPT(codex) low : 빠른 아이디어·2nd opinion ──
    (r"아이디어|브레인스토밍|다른\s*관점|2nd|세컨|반론|비판적으로|한번\s*더\s*봐", "codex", "low", "GPT아이디어", "빠른 대안·반론"),
]
DEFAULT = ("claude", "sonnet", "고속", "일반 대화는 저렴·빠른 Sonnet")

def route(text):
    t = str(text or "")
    for pat, ex, mt, tier, why in RULES:
        if re.search(pat, t):
            r = {"executor": ex, "tier": tier, "reason": why}
            if ex == "claude": r["model"] = mt; r["effort"] = None
            else: r["model"] = "gpt"; r["effort"] = mt
            return r
    ex, mt, tier, why = DEFAULT
    return {"executor": ex, "model": mt, "effort": None, "tier": tier, "reason": why}

def plan(text):
    """복합 요청 분해: '그리고/,/→/및' 로 나뉜 하위요청을 각기 라우팅. 단일이면 1개."""
    parts = [p.strip() for p in re.split(r"\s*(?:그리고|그다음|→|;|·)\s*|\n+", str(text or "")) if p.strip()]
    if len(parts) <= 1: return [dict(route(text), step=text)]
    return [dict(route(p), step=p) for p in parts[:6]]

def explain(text):
    r = route(text)
    who = {"fable": "Claude·페이블", "opus": "Claude·오퍼스", "sonnet": "Claude·Sonnet",
           "gpt": f"GPT·{r.get('effort')}"}.get(r["model"], r["model"])
    return f"{who} ({r['tier']}) — {r['reason']}"

if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    tests = sys.argv[1:] or [
        "이 어법 문항 정답이 맞는지 검수해줘", "이 지문 요약해줘", "빈칸 문제 변형해서 출제해줘",
        "미국 비만 통계 최신 자료 조사해줘", "이 해설 논리가 맞는지 분석해줘", "제목 아이디어 브레인스토밍",
        "이거 번역하고 그리고 어법 오류 3개 넣어서 출제해줘"]
    for t in tests:
        print(f"  「{t[:32]}…」")
        for r in plan(t):
            who = {"fable":"Claude·페이블","opus":"Claude·오퍼스","sonnet":"Claude·Sonnet","gpt":f"GPT·{r.get('effort')}"}.get(r["model"])
            print(f"      → {who} [{r['tier']}] {r['reason']}")
