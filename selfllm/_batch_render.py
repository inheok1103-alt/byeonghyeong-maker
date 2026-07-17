# -*- coding: utf-8 -*-
"""_batch_render.py — 워크플로 출제 결과 → 판서 PPT + 학생용 일괄 렌더
★ 빈칸 유형은 지문에서 원문장이 반드시 빈칸으로 치환됐는지 검증(정답 노출 방지)."""
import sys, io, os, json, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.expanduser(r"~/Downloads/구리여고/_RAY제작물")
os.makedirs(OUT, exist_ok=True)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import auto_markup

SRC_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "_batch_src.json")
WF_PATH  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "_wf_out.json")
SRC = json.load(io.open(SRC_PATH, encoding="utf-8"))
if isinstance(SRC, list): SRC = {a["id"]: a for a in SRC}
W = json.load(io.open(WF_PATH, encoding="utf-8"))
KB = json.load(io.open(os.path.join(HERE, "brain_knowledge.json"), encoding="utf-8"))

def blank_out(psg, blank_sentence):
    stem = re.split(r'_{3,}', blank_sentence)[0].strip().rstrip(',')
    if len(stem) < 8: return psg, False
    for s in re.split(r'(?<=[.!?])\s+', psg):
        if s.strip().startswith(stem[:min(len(stem), 45)]):
            return psg.replace(s.strip(), blank_sentence.strip(), 1), True
    key = stem.split()[-4:] if len(stem.split()) >= 4 else stem.split()
    for s in re.split(r'(?<=[.!?])\s+', psg):
        if all(k in s for k in key):
            return psg.replace(s.strip(), blank_sentence.strip(), 1), True
    return psg, False

def build(idd, d):
    it = SRC[idd]; psg = it["text"]
    if d.get("blank_sentence"):
        psg, ok_blank = blank_out(psg, d["blank_sentence"])
        if not ok_blank:
            print(f"  X {idd} 빈칸 치환 실패 → 정답 노출 위험, 스킵")
            return None
    mk = auto_markup.mark_passage(psg, kb=KB, key_concepts=None)
    return {
        "kind": "reading",
        "header": f"구리여고 공통영어2 {it['lesson']}과 · {it['head'][:28]}",
        "meta": f"NE능률(오선영) · {it['qtype']} · 페이블 출제 + 적대적 검증",
        "stem": d["stem"], "answer_label": it["qtype"],
        "hook": d["hook"], "passage": mk["marked"], "legend": mk["legend"], "footnotes": mk["footnotes"],
        "choices": [{"n": c["n"], "text": c["text"], **({"correct": True} if c["n"] == d["answer"] else {})}
                    for c in d["choices"]],
        "answer": d["answer"], "answer_plain": d["answer_plain"], "rationale": d["rationale"],
        "wrong": d["wrong"], "flow": d["flow"], "sents": d["sents"], "vocab": d["vocab"],
        "logic": {"rows": [{"arrow": "요지", "acol": "magenta", "expr": d.get("logic_banner", ""), "tag": "main", "note": ""}],
                  "banner": d.get("logic_banner", "")},
    }

ok = 0; skip = 0
for idd in sorted(W["decks"]):
    data = build(idd, W["decks"][idd])
    if not data: skip += 1; continue
    ans_txt = [c["text"] for c in data["choices"] if c.get("correct")][0]
    plain = re.sub(r'<<(.*?)(?:\|[^>]*)?>>', r'\1', data["passage"])
    if len(ans_txt) > 20 and ans_txt.lower()[:30] in plain.lower():
        print(f"  ! {idd} 정답 문구가 지문에 노출됨")
    src = os.path.join(HERE, f"_studio_{idd}.json")
    json.dump(data, io.open(src, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    it = SRC[idd]
    name = f"{it['lesson']}과_{idd}_{it['qtype']}"
    r = subprocess.run([sys.executable, os.path.join(HERE, "board_highlight_pptx.py"), src,
                        os.path.join(OUT, f"교과서_{name}_판서.pptx")], capture_output=True, text=True)
    subprocess.run([sys.executable, os.path.join(HERE, "student_handout_html.py"), src,
                    os.path.join(OUT, f"_stu_{idd}.html")], capture_output=True)
    print(f"  {'OK  ' if r.returncode == 0 else '실패 '}{name}")
    ok += 1
print(f"\n렌더 {ok}건 · 스킵 {skip}건 → {OUT}")
