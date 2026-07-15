# -*- coding: utf-8 -*-
"""ray_bridge.py — 프로그램 ↔ 페이블(이 챗의 Claude) 파일기반 연동 (추가비용 0)
프로그램이 '신뢰 필요' 작업(어법 오류 출제·최종 검수)을 페이블에게 요청서로 넘기고,
페이블(이 챗의 나)이 응답 파일을 쓰면 프로그램이 이어받아 최종 완성한다. API 과금 없음(나는 이미 여기 있음).

폴더: _fable/requests/<id>.json (프로그램→페이블) · _fable/responses/<id>.json (페이블→프로그램)

프로그램 측:
  rid = bridge.request("grammar_error", {...})   # 요청 접수
  resp = bridge.get_response(rid)                # 페이블 응답 있으면 dict, 없으면 None
페이블(이 챗) 측:
  bridge.list_requests("open")                   # 처리할 요청 보기
  bridge.answer(rid, {...})                       # 응답 작성 → 프로그램이 픽업"""
import os, io, json, time, hashlib
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "_fable")
REQ = os.path.join(BASE, "requests"); RES = os.path.join(BASE, "responses")
for d in (REQ, RES): os.makedirs(d, exist_ok=True)

def _rid(kind, payload):
    h = hashlib.sha1((kind + json.dumps(payload, ensure_ascii=False, sort_keys=True)).encode("utf-8")).hexdigest()[:10]
    return f"{kind}_{h}"

def request(kind, payload, instruction=""):
    """프로그램 → 페이블 요청 접수. rid 반환. 이미 응답 있으면 그대로 재사용."""
    rid = _rid(kind, payload)
    p = os.path.join(REQ, rid + ".json")
    obj = {"rid": rid, "kind": kind, "ts": time.strftime("%Y-%m-%d %H:%M"),
           "status": "open", "instruction": instruction, "payload": payload}
    json.dump(obj, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return rid

def get_response(rid):
    p = os.path.join(RES, rid + ".json")
    if os.path.exists(p):
        try: return json.load(io.open(p, encoding="utf-8"))
        except Exception: return None
    return None

def list_requests(status="open"):
    out = []
    for fn in sorted(os.listdir(REQ)):
        if not fn.endswith(".json"): continue
        try:
            d = json.load(io.open(os.path.join(REQ, fn), encoding="utf-8"))
            answered = os.path.exists(os.path.join(RES, d["rid"] + ".json"))
            d["_answered"] = answered
            if status is None or (status == "open" and not answered) or (status == "answered" and answered):
                out.append(d)
        except Exception: pass
    return out

def answer(rid, result):
    """페이블(이 챗) → 프로그램 응답 작성."""
    p = os.path.join(RES, rid + ".json")
    obj = {"rid": rid, "ts": time.strftime("%Y-%m-%d %H:%M"), "by": "fable", "result": result}
    json.dump(obj, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 요청 상태 갱신
    rp = os.path.join(REQ, rid + ".json")
    if os.path.exists(rp):
        d = json.load(io.open(rp, encoding="utf-8")); d["status"] = "answered"
        json.dump(d, io.open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return p

if __name__ == "__main__":
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["list"]
    if a[0] == "list":
        for r in list_requests("open"):
            print(f"[열림] {r['rid']} · {r['kind']} · {r['ts']}")
            print("  지시:", r.get("instruction", "")[:80])
    elif a[0] == "answered":
        for r in list_requests("answered"): print(f"[완료] {r['rid']}")
    elif a[0] == "show":
        rid = a[1]; p = os.path.join(REQ, rid + ".json")
        print(io.open(p, encoding="utf-8").read())
