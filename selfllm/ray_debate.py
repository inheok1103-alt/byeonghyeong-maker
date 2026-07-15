# -*- coding: utf-8 -*-
"""ray_debate.py — 페이블(Claude) ↔ ChatGPT 실시간 토론 하네스 (추가비용 0)
GPT 발언은 무료(pollinations gpt-oss) 자동. 페이블(Claude) 발언은 이 챗의 나가 브릿지로 실시간 참여.
전사(transcript)를 _debate/<주제>.md 에 누적.

사용:
  python ray_debate.py start "<토론 주제>"     # 토론 시작(GPT 오프닝) → 페이블 차례 요청 생성
  python ray_debate.py gpt "<주제>"            # 현재 전사에 GPT 다음 발언 추가
  python ray_debate.py show "<주제>"           # 전사 보기
페이블(이 챗) 차례: ray_bridge 로 온 요청을 읽고 answer() 로 반박 작성 → gpt 로 이어감."""
import sys, io, os, json, time, re, hashlib
HERE = os.path.dirname(os.path.abspath(__file__))
import ray_llm, ray_bridge
DBASE = os.path.join(HERE, "_debate"); os.makedirs(DBASE, exist_ok=True)

def _path(topic): return os.path.join(DBASE, re.sub(r"[^\w가-힣]+", "_", topic)[:40] + ".md")
def load(topic):
    p = _path(topic); return io.open(p, encoding="utf-8").read() if os.path.exists(p) else f"# 토론: {topic}\n\n"
def save(topic, text): io.open(_path(topic), "w", encoding="utf-8").write(text)
def add(topic, speaker, text):
    t = load(topic) + f"\n**{speaker}**: {text.strip()}\n"; save(topic, t); return t

GPT_SYS = "너는 토론자 'ChatGPT'다. 한국 영어교육 실무 관점에서 논리적으로, 3~5문장으로 간결하게 주장/반박하라. 상대(Claude)의 마지막 발언이 있으면 그것을 직접 반박하라."
def gpt_turn(topic):
    transcript = load(topic)
    msgs = [{"role": "system", "content": GPT_SYS},
            {"role": "user", "content": f"토론 주제: {topic}\n\n지금까지 전사:\n{transcript}\n\nChatGPT의 다음 발언만 출력:"}]
    reply, prov = ray_llm.ask(msgs, temperature=0.7, timeout=60)
    add(topic, "ChatGPT", reply)
    # 페이블 차례 요청 생성(이 챗의 Claude가 반박하도록)
    rid = ray_bridge.request("debate_turn", {"topic": topic, "transcript": load(topic)},
                             instruction="위 토론에서 'Claude(페이블)'의 다음 반박 발언을 3~5문장으로 작성하라. result 스키마: {reply:발언}")
    return reply, rid

def fable_from_bridge(topic):
    """페이블(이 챗)이 브릿지에 남긴 응답을 전사에 반영."""
    for r in ray_bridge.list_requests("answered"):
        if r["kind"] == "debate_turn" and r["payload"].get("topic") == topic:
            resp = ray_bridge.get_response(r["rid"])
            if resp:
                add(topic, "Claude(페이블)", resp["result"].get("reply", ""))
                return resp["result"].get("reply", "")
    return None

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["show", "test"]
    if a[0] == "start":
        topic = a[1]; save(topic, f"# 토론: {topic}\n\n(주제: {topic})\n")
        reply, rid = gpt_turn(topic)
        print(f"[ChatGPT 오프닝]\n{reply}\n\n→ 페이블 차례 요청 생성(rid={rid}). 이 챗에서 반박 작성.")
    elif a[0] == "gpt":
        reply, rid = gpt_turn(a[1]); print(f"[ChatGPT]\n{reply}\n(rid={rid})")
    elif a[0] == "show":
        print(load(a[1]))
