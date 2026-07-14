# -*- coding: utf-8 -*-
"""merge_mock.py — 4지문 세트를 실물 동화고 순서(선택형16 → 논술형5)로 병합."""
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

def load(n):
    try: return json.load(io.open(f"selfllm/_mock_p{n}.json", encoding="utf-8"))
    except Exception as e: print(f"p{n} 로드 실패: {e}"); return {"items": []}

sets = [load(i) for i in (1, 2, 3, 4)]
def is_essay(q): return not q.get("choices") or len(q.get("choices", [])) < 4

mcq, essays = [], []
for s in sets:
    for q in s.get("items", []):
        if not q: continue
        # 각 문항에 자기 지문 보장(동형모고는 문항별 지문)
        if not q.get("passage"): q["passage"] = s.get("passage", "")
        (essays if is_essay(q) else mcq).append(q)

merged = {"mode": "donghwa-mock", "passage": "", "level": "중",
          "count": len(mcq) + len(essays), "mcq": len(mcq), "essay": len(essays),
          "items": mcq + essays}
json.dump(merged, io.open("selfllm/_mock_set.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"병합: 선택형 {len(mcq)} + 논술형 {len(essays)} = {merged['count']}문항")
for i, q in enumerate(merged["items"], 1):
    print(f"  {i:2}. {q['type']} (정답 {q.get('answer')})")
