# -*- coding: utf-8 -*-
"""claude_router.py — Claude 다버전 역할별 라우팅 하네스 (비용가드 내장)
역할에 맞는 Claude 모델을 Anthropic API로 호출하는 '선택적' 계층.

★ 추가비용 금지 원칙: Anthropic API는 유료 → 기본 완전 차단(available()=False).
   RAY_ALLOW_PAID=1 을 명시로 켠 경우에만 동작. 켜지 않으면 무료 경로(ray-proxy·pollinations)만 사용.
   → 무료 관리자 계층 = '세션 중의 Claude(나)'가 _manager_inbox.jsonl 을 직접 처리(추가비용 0).

역할 → 모델(옵트인 시):
  manager   Fable 5 · reasoning Opus 4.8 · draft Sonnet 5 · fast Haiku 4.5"""
import os, io, json, urllib.request

ROLE_MODEL = {
    "manager":   "claude-fable-5",
    "reasoning": "claude-opus-4-8",
    "draft":     "claude-sonnet-5",
    "fast":      "claude-haiku-4-5-20251001",
}
API = "https://api.anthropic.com/v1/messages"

def available():
    # 비용가드: 유료 API는 명시 옵트인(RAY_ALLOW_PAID=1) + 키가 둘 다 있어야만 활성. 기본 OFF = 추가비용 0.
    return os.environ.get("RAY_ALLOW_PAID") == "1" and bool(os.environ.get("ANTHROPIC_API_KEY"))

def ask(role, messages, system=None, max_tokens=2048, temperature=0.4):
    """역할에 맞는 Claude 모델 호출. 키 없으면 예외(→ 상위 계층 폴백)."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY 없음 — Claude 계층 비활성(상위 폴백)")
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    model = ROLE_MODEL.get(role, ROLE_MODEL["draft"])
    body = {"model": model, "max_tokens": max_tokens, "temperature": temperature, "messages": messages}
    if system: body["system"] = system
    req = urllib.request.Request(API, data=json.dumps(body).encode("utf-8"), headers={
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"})
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode("utf-8", "replace"))
    parts = [b.get("text", "") for b in d.get("content", []) if b.get("type") == "text"]
    return "".join(parts).strip(), model

def route(task_kind):
    """작업 종류 → 역할 자동 매핑."""
    k = str(task_kind).lower()
    if any(x in k for x in ["관리", "조정", "최종", "manager", "reconcile", "결정"]): return "manager"
    if any(x in k for x in ["검수", "추론", "어법", "정답", "reasoning", "verify", "hard"]): return "reasoning"
    if any(x in k for x in ["분류", "태그", "빠른", "fast", "classify", "quick"]): return "fast"
    return "draft"

if __name__ == "__main__":
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    print("Claude 계층 활성:", available(), "· 역할맵:", json.dumps(ROLE_MODEL, ensure_ascii=False))
    if available() and len(sys.argv) > 2:
        c, m = ask(sys.argv[1], sys.argv[2]); print(f"[{m}] {c[:200]}")
