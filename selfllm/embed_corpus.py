# -*- coding: utf-8 -*-
# =============================================================================
#  Ray English — 코퍼스 bge-m3 임베딩 (Vector RAG 데이터 생성)
#  passage_db 지문을 bge-m3(1024d)로 임베딩 → int8 양자화 → corpus/passage_vecs.json
#  브라우저 RAG(raytools.js)의 ①Vector 백엔드가 이 파일을 읽어 코사인 유사검색.
#
#  실행(무료, GPU 불필요 — CPU도 됨):  python selfllm/embed_corpus.py
#  Colab/Kaggle에서도 동일. 최초 1회만.
# =============================================================================
import json, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "corpus", "passage_vecs.json")

def load_passages():
    p = json.load(open(os.path.join(ROOT, "corpus", "passage_db.json"), encoding="utf-8"))
    arr = p.get("passages", p) if isinstance(p, dict) else p
    out = []
    for x in arr:
        t = x if isinstance(x, str) else x.get("text", "")
        t = re.sub(r"\s+", " ", str(t)).strip()
        w = len(re.findall(r"[A-Za-z]+", t))
        if 40 <= len(t) and w >= 20:
            out.append(t)
    # 중복 제거(앞 80자 기준)
    seen, uniq = set(), []
    for t in out:
        k = t[:80]
        if k not in seen:
            seen.add(k); uniq.append(t)
    return uniq

def main():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("sentence-transformers 설치 중…"); os.system(sys.executable + " -m pip install -q sentence-transformers")
        from sentence_transformers import SentenceTransformer
    import numpy as np
    passages = load_passages()
    TMP = OUT + ".part.npy"   # 이어하기: 중간 저장(중단돼도 재실행하면 이어서)
    done = 0; parts = None
    if os.path.exists(TMP):
        parts = np.load(TMP); done = parts.shape[0]
        print("이어하기: %d/%d 이미 완료 → 이어서 진행" % (done, len(passages)))
    print("지문 %d개 임베딩 (bge-m3, CPU 가능·최초 모델 다운로드 ~2GB)…" % len(passages))
    model = SentenceTransformer("BAAI/bge-m3")
    model.max_seq_length = 512   # 지문은 220단어 이하 → 512토큰이면 무손실. 활성화 메모리 대폭 절감(저RAM PC 대응)
    CHUNK = 64
    for i in range(done, len(passages), CHUNK):
        batch = passages[i:i + CHUNK]
        e = model.encode(batch, batch_size=4, normalize_embeddings=True, show_progress_bar=False)
        e = np.asarray(e, dtype="float32")
        parts = e if parts is None else np.vstack([parts, e])
        np.save(TMP, parts)
        print("  %d/%d" % (min(i + CHUNK, len(passages)), len(passages)), flush=True)
    embs = parts
    q = np.clip(np.round(embs * 127), -127, 127).astype("int8")   # int8 양자화(코사인은 스케일 무관)
    meta = [p[:180] for p in passages]
    json.dump({"model": "bge-m3", "dim": int(embs.shape[1]), "count": len(passages),
               "meta": meta, "vectors": q.tolist()},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    try: os.remove(TMP)
    except OSError: pass
    mb = os.path.getsize(OUT) / 1e6
    print("완료 → %s (%d지문 · %.1fMB)" % (OUT, len(passages), mb))
    print("이제 raytools의 Vector 검색이 이 파일을 씀. (쿼리 임베딩은 워커/HF무료추론 경유 예정)")

if __name__ == "__main__":
    main()
