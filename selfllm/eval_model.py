# -*- coding: utf-8 -*-
# =============================================================================
#  Ray English 자체LLM — 벤치마크 채점 · 승격 게이트 (퇴화 차단)
#  benchmark.jsonl(정답 아는 홀드아웃 gold)로 모델을 채점 → "오를 때만 승격".
#
#  두 지표:
#   · gen_valid  = 생성 문항의 형식 유효율(모델 본업: 발문·선지·정답범위·중복없음)
#   · solve_acc  = 고정 gold문항 풀이 정확도(지문 이해·정답 판단력)
#
#  실행 A) Colab(학습 직후, 메모리의 model 사용):
#     from selfllm.eval_model import evaluate_colab
#     evaluate_colab(model, tokenizer)
#  실행 B) 배포 후 Ollama:
#     python selfllm/eval_model.py --ollama ray-english-exam-3b
# =============================================================================
import json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.join(HERE, "benchmark.jsonl")
SCORES = os.path.join(HERE, "benchmark_scores.json")
SYS = "너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 지문을 분석해 정확한 문항·워크북·분석을 만든다."
CIRC = "①②③④⑤"

def load_bench():
    with open(BENCH, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def gen_prompt(item):
    return ("[유형] " + item["type"] + "\n[지문]\n" + item["passage"] +
            "\n\n위 지문으로 '" + item["type"] + "' 유형의 변형문항을 만들어라.")

def solve_prompt(item):
    ch = "\n".join((CIRC[i] if i < 5 else str(i+1)) + " " + str(c) for i, c in enumerate(item["choices"]))
    return ("다음 문제의 정답 번호만 숫자로 답하라(1~%d).\n[유형] %s\n[지문]\n%s\n%s\n\n정답 번호:"
            % (len(item["choices"]), item["type"], item["passage"], ch))

def parse_answer(text, n):
    for i, c in enumerate(CIRC[:n]):
        if c in text: return i + 1
    m = re.search(r"정답[^0-9]*([1-5])", text) or re.search(r"\b([1-5])\b", text)
    return int(m.group(1)) if m else 0

def valid_gen(text):
    if "[발문]" not in text and "?" not in text: return False
    choices = re.findall(r"[①②③④⑤]\s*\S", text)
    if len(choices) < 3: return False
    if not re.search(r"\[정답\][^\n]*[①②③④⑤1-5]", text): return False
    return True

def score(ask_fn):
    """ask_fn(messages)->str 를 받아 벤치마크 채점"""
    items = load_bench()
    by = {}
    gv_ok = gv_n = sa_ok = sa_n = 0
    for it in items:
        t = it["type"]; by.setdefault(t, {"gv":0,"gvn":0,"sa":0,"san":0})
        # 1) 생성 형식 유효
        try:
            g = ask_fn([{"role":"system","content":SYS},{"role":"user","content":gen_prompt(it)}])
            ok = valid_gen(g); gv_ok += ok; gv_n += 1; by[t]["gv"] += ok; by[t]["gvn"] += 1
        except Exception: gv_n += 1; by[t]["gvn"] += 1
        # 2) 고정 gold 풀이 정확
        if it.get("answer"):
            try:
                s = ask_fn([{"role":"system","content":SYS},{"role":"user","content":solve_prompt(it)}])
                hit = (parse_answer(s, len(it["choices"])) == it["answer"]); sa_ok += hit; sa_n += 1; by[t]["sa"] += hit; by[t]["san"] += 1
            except Exception: sa_n += 1; by[t]["san"] += 1
    res = {"n": len(items),
           "gen_valid": round(gv_ok / max(1, gv_n), 3),
           "solve_acc": round(sa_ok / max(1, sa_n), 3),
           "byType": {t: {"gen_valid": round(v["gv"]/max(1,v["gvn"]),2), "solve_acc": round(v["sa"]/max(1,v["san"]),2)} for t, v in by.items()}}
    return res

def gate_and_log(res, version):
    hist = []
    if os.path.exists(SCORES):
        try: hist = json.load(open(SCORES, encoding="utf-8"))
        except Exception: hist = []
    prev = hist[-1] if hist else None
    combined = res["gen_valid"] * 0.5 + res["solve_acc"] * 0.5
    res["combined"] = round(combined, 3); res["version"] = version
    verdict = "FIRST"
    if prev:
        pc = prev.get("combined", 0)
        verdict = "PROMOTE ✅ (이전 %.3f → %.3f)" % (pc, combined) if combined >= pc else "HOLD ⛔ 퇴화 (이전 %.3f → %.3f) — 기존 모델 유지" % (pc, combined)
    hist.append(res); json.dump(hist, open(SCORES, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n===== 벤치마크 결과 (%s) =====" % version)
    print("생성 형식 유효율 gen_valid = %.1f%%" % (res["gen_valid"]*100))
    print("고정문항 풀이 정확 solve_acc = %.1f%%" % (res["solve_acc"]*100))
    print("종합 combined = %.3f" % combined)
    print("유형별:", json.dumps(res["byType"], ensure_ascii=False))
    print("승격 판정:", verdict)
    return res

def evaluate_colab(model, tokenizer, version="colab-latest", max_new_tokens=380):
    import torch
    def ask(messages):
        ids = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt").to(model.device)
        out = model.generate(input_ids=ids, max_new_tokens=max_new_tokens, temperature=0.3, do_sample=True)
        return tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True)
    return gate_and_log(score(ask), version)

def evaluate_ollama(model_name, url="http://localhost:11434"):
    def ask(messages):
        body = json.dumps({"model": model_name, "messages": messages, "stream": False, "options": {"temperature": 0.3}}).encode()
        req = urllib.request.Request(url.rstrip("/") + "/api/chat", data=body, headers={"Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(req, timeout=120))["message"]["content"]
    return gate_and_log(score(ask), "ollama:" + model_name)

if __name__ == "__main__":
    if "--ollama" in sys.argv:
        evaluate_ollama(sys.argv[sys.argv.index("--ollama") + 1])
    else:
        print("사용: python selfllm/eval_model.py --ollama <모델명>  (또는 Colab에서 evaluate_colab(model,tokenizer))")
        print("벤치마크 문항수:", len(load_bench()) if os.path.exists(BENCH) else "없음(먼저 node selfllm/evolve.js --bench-only)")
