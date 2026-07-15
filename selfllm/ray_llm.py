# -*- coding: utf-8 -*-
"""ray_llm.py — 로컬 ↔ 기존 뇌(API) 커넥터
api_team.js / server_brain.js 와 동일한 체인에 연결:
  1) ray-proxy (Cloudflare Worker, 서버측 키회전·폴백)  2) pollinations (무키, 항상 됨)
POST {messages, temperature, json} → content(str).  API 키 없이도 동작(pollinations 폴백)."""
import os, json, urllib.request, urllib.error

RAY_PROXY = os.environ.get("RAY_PROXY", "https://ray-proxy.gen1103.workers.dev")
POLLINATIONS = "https://text.pollinations.ai/openai"

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RAYbrain/1.0"
def _post(url, payload, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json", "User-Agent": _UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def ask(messages, temperature=0.4, json_mode=False, timeout=60):
    """뇌에게 물어봄. ray-proxy → pollinations 폴백. content 문자열 반환."""
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    # 1) ray-proxy (기존 프록시 체인: groq→gemini→cerebras→mistral→openrouter→pollinations)
    try:
        d = _post(RAY_PROXY, {"messages": messages, "temperature": temperature, "json": bool(json_mode)}, timeout)
        c = d.get("content") or (d.get("choices", [{}])[0].get("message", {}) or {}).get("content")
        if c: return c.strip(), d.get("provider", "proxy")
    except Exception:
        pass
    # 2) pollinations 무키 폴백
    try:
        d = _post(POLLINATIONS, {"model": "openai", "messages": messages, "temperature": temperature,
                                 **({"response_format": {"type": "json_object"}} if json_mode else {})}, timeout)
        c = d["choices"][0]["message"]["content"]
        return c.strip(), "pollinations"
    except Exception as e:
        raise RuntimeError(f"뇌 연결 실패(proxy·pollinations 모두): {e}")

def ask_json(messages, temperature=0.3, timeout=75, retries=2):
    """JSON 응답을 파싱해 dict 반환(코드블록/잡텍스트 제거)."""
    last = ""
    for _ in range(retries + 1):
        content, prov = ask(messages, temperature, json_mode=True, timeout=timeout)
        last = content
        s = content.strip()
        if "```" in s:
            import re
            m = re.search(r"```(?:json)?\s*(.+?)```", s, re.S)
            if m: s = m.group(1).strip()
        a, b = s.find("{"), s.rfind("}")
        if a >= 0 and b > a:
            try: return json.loads(s[a:b+1]), prov
            except Exception: pass
    raise ValueError(f"JSON 파싱 실패. 원문 앞부분: {last[:200]}")

if __name__ == "__main__":
    import sys
    q = sys.argv[1] if len(sys.argv) > 1 else "Say RAY brain online in Korean, 5 words."
    c, p = ask(q)
    print(f"[{p}] {c}")
