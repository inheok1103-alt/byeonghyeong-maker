# -*- coding: utf-8 -*-
"""ray_ingest.py — 다양한 파일에서 지문(텍스트) 추출
지원: PDF · DOCX · PPTX · HWP · PNG/JPG(무료 비전 OCR) · TXT
사용:
  python ray_ingest.py <파일경로>            # 추출 텍스트 출력
  from ray_ingest import ingest; ingest(path) # 라이브러리
이미지/스캔PDF는 로컬 OCR이 없으면 무료 비전 LLM(pollinations)으로 인식(추가비용 0)."""
import sys, io, os, json, re, base64, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
_UA = "Mozilla/5.0 RAYingest/1.0"

def _clean(t): return re.sub(r"[ \t]+\n", "\n", re.sub(r"\n{3,}", "\n\n", (t or "").strip()))

def read_txt(p): return io.open(p, encoding="utf-8", errors="replace").read()

def read_docx(p):
    import docx
    d = docx.Document(p)
    parts = [para.text for para in d.paragraphs]
    for tbl in d.tables:
        for row in tbl.rows: parts.append("\t".join(c.text for c in row.cells))
    return "\n".join(parts)

def read_pptx(p):
    from pptx import Presentation
    prs = Presentation(p); out = []
    for s in prs.slides:
        for sh in s.shapes:
            if sh.has_text_frame:
                for para in sh.text_frame.paragraphs:
                    out.append("".join(r.text for r in para.runs) or para.text)
    return "\n".join(x for x in out if x)

def read_hwp(p):
    """HWP: 미리보기 텍스트(PrvText) 스트림 추출(olefile). 대부분의 지문 추출에 충분."""
    import olefile
    ole = olefile.OleFileIO(p)
    try:
        if ole.exists("PrvText"):
            return ole.openstream("PrvText").read().decode("utf-16-le", errors="ignore")
        # 폴백: 텍스트 유사 스트림 긁기
        chunks = []
        for entry in ole.listdir():
            name = "/".join(entry)
            if "Text" in name or "Body" in name:
                try: chunks.append(ole.openstream(entry).read().decode("utf-16-le", errors="ignore"))
                except Exception: pass
        return "\n".join(chunks)
    finally:
        ole.close()

def _shrink_png(png_bytes, max_bytes=1000000):
    """OCR.space 무료 1MB 한도 대응: 크면 다운스케일."""
    if len(png_bytes) <= max_bytes: return png_bytes
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    for scale in (0.75, 0.55, 0.4, 0.3):
        buf = io.BytesIO(); im.resize((int(im.width * scale), int(im.height * scale))).save(buf, "JPEG", quality=80)
        if buf.tell() <= max_bytes: return buf.getvalue(), "jpg"
    buf = io.BytesIO(); im.resize((int(im.width * 0.25), int(im.height * 0.25))).save(buf, "JPEG", quality=70)
    return buf.getvalue(), "jpg"

def _vision_ocr(png_bytes):
    """무료 OCR(OCR.space, 공개키 helloworld) → 실패 시 pollinations 비전 폴백. 추가비용 0."""
    import urllib.parse
    shr = _shrink_png(png_bytes); fmt = "png"
    if isinstance(shr, tuple): png_bytes, fmt = shr
    b64 = f"data:image/{fmt};base64," + base64.b64encode(png_bytes).decode()
    try:
        data = urllib.parse.urlencode({"apikey": os.environ.get("OCR_SPACE_KEY", "helloworld"),
            "base64Image": b64, "language": "eng", "isOverlayRequired": "false", "OCREngine": "2",
            "scale": "true", "detectOrientation": "true"}).encode()
        req = urllib.request.Request("https://api.ocr.space/parse/image", data=data, headers={"User-Agent": _UA})
        d = json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace"))
        if not d.get("IsErroredOnProcessing") and d.get("ParsedResults"):
            return d["ParsedResults"][0].get("ParsedText", "").strip()
    except Exception:
        pass
    # 폴백: pollinations 비전
    try:
        body = {"model": "openai", "messages": [{"role": "user", "content": [
            {"type": "text", "text": "Transcribe all text in this image exactly. Output only text."},
            {"type": "image_url", "image_url": {"url": b64}}]}], "temperature": 0}
        req = urllib.request.Request("https://text.pollinations.ai/openai",
                                     data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "User-Agent": _UA})
        d = json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace"))
        return d["choices"][0]["message"]["content"]
    except Exception as e:
        return f"(OCR 실패: {e})"

def read_image(p):
    return _vision_ocr(io.open(p, "rb").read())

def read_pdf(p):
    import fitz
    d = fitz.open(p); txt = "\n".join(d[i].get_text() for i in range(d.page_count))
    if len(txt.strip()) >= 40:
        return txt
    # 텍스트 거의 없음 → 스캔/이미지 PDF → 비전 OCR(앞 3쪽)
    out = []
    for i in range(min(d.page_count, 3)):
        try: out.append(_vision_ocr(d[i].get_pixmap(dpi=150).tobytes("png")))
        except Exception as e: out.append(f"(OCR 실패 p{i+1}: {e})")
    return "\n".join(out)

READERS = {".txt": read_txt, ".md": read_txt, ".docx": read_docx, ".pptx": read_pptx,
           ".hwp": read_hwp, ".pdf": read_pdf, ".png": read_image, ".jpg": read_image,
           ".jpeg": read_image, ".bmp": read_image, ".webp": read_image}

def ingest(path):
    ext = os.path.splitext(path)[1].lower()
    fn = READERS.get(ext)
    if not fn: raise ValueError(f"지원하지 않는 형식: {ext} (지원: {', '.join(READERS)})")
    return _clean(fn(path))

def extract_english_passage(text, min_words=25):
    """추출 텍스트에서 가장 그럴듯한 '영어 지문' 한 덩어리를 고름(문항용)."""
    # 영어 비중 높은 문단 우선
    paras = re.split(r"\n\s*\n", text)
    scored = []
    for para in paras:
        eng = len(re.findall(r"[A-Za-z]", para)); tot = len(re.sub(r"\s", "", para)) or 1
        words = len(re.findall(r"[A-Za-z]+", para))
        if words >= min_words and eng / tot > 0.6: scored.append((words, para.strip()))
    if scored:
        scored.sort(reverse=True); return re.sub(r"\s+", " ", scored[0][1])
    return re.sub(r"\s+", " ", text)[:2000]

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if len(sys.argv) < 2: print(__doc__); sys.exit()
    t = ingest(sys.argv[1])
    print("=== 추출 텍스트 (앞 800자) ===\n" + t[:800])
    print("\n=== 자동 선별 영어 지문 ===\n" + extract_english_passage(t)[:800])
