# -*- coding: utf-8 -*-
"""lesson_ppt_pipeline.py — 수업용 판서 PPT 제작 하네스(파이프라인)
로컬 이번년도 수능특강 → 지문 '그대로' 발췌 → 하이라이트 JSON → PPTX → PDF.

명령:
  python lesson_ppt_pipeline.py list                     # 강 구조 출력
  python lesson_ppt_pipeline.py extract <강> <GW|01..>   # 지문 그대로 발췌(마크업 골격 포함) → stdout/JSON
  python lesson_ppt_pipeline.py render <data.json> [out.pptx]   # 판서 PPTX 렌더
  python lesson_ppt_pipeline.py pdf <file.pptx>          # LibreOffice로 PDF 변환
  python lesson_ppt_pipeline.py build <manifest.json>    # 여러 덱 일괄 생성(+PDF)
  python lesson_ppt_pipeline.py all                      # 기본 매니페스트로 전체 재생성

전제: board_highlight_pptx.py 와 같은 폴더. 수능특강 PDF는 다운로드\수능특강\ 에 위치."""
import sys, io, os, json, re, subprocess, unicodedata
HERE=os.path.dirname(os.path.abspath(__file__))
STX_DIR=os.path.expanduser(r"~/Downloads/수능특강")
OUT_DIR=os.path.join(STX_DIR,"_RAY수업보드")
SOFFICE=r"C:/Program Files/LibreOffice/program/soffice.exe"
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8",errors="replace")

# 강 → 통합본 시작쪽(2027 수능특강 영어)
TONG_START={1:1,2:6,3:11,4:16,5:21,6:26,7:31,8:36,9:41,10:46,11:51,12:56,13:61,14:66,15:71,
 16:76,17:83,18:90,19:95,20:100,21:105,22:109,23:113,24:117,25:121,26:125,27:129,28:133,29:137,30:141,31:145}
CH_TITLE={1:"글의 목적",2:"심경 변화",3:"함축 의미",4:"요지",5:"주장",6:"주제",7:"제목",8:"도표",
 9:"내용일치(설명문)",10:"내용일치(실용문)",11:"어법 정확성",12:"어휘 적절성",13:"빈칸(1)",14:"빈칸(2)",
 15:"무관 문장",16:"글의 순서",17:"문장 삽입",18:"문단 요약",19:"장문(1)",20:"장문(2)"}

def _find(sub):
    for fn in os.listdir(STX_DIR):
        if sub in unicodedata.normalize('NFC',fn): return os.path.join(STX_DIR,fn)
    return None
def _open(sub):
    import fitz
    p=_find(sub)
    if not p: raise SystemExit(f"[에러] 수능특강 '{sub}' PDF를 {STX_DIR} 에서 찾지 못함")
    return fitz.open(p)

def cmd_list():
    d=_open("통합본"); print("=== 2027 수능특강 <영어> 강 구조 ===")
    import re as _re
    for i in range(d.page_count):
        m=_re.search(r'(\d{2})강\s*[–-]\s*([^\n★]+)',d[i].get_text())
        if m and int(m.group(1)) in TONG_START and TONG_START[int(m.group(1))]==i+1:
            print(f"  {m.group(1)}강 (p{i+1:>3})  {m.group(2).strip()}")

def _chapter_text(d,ch):
    a=TONG_START[ch]-1; b=TONG_START.get(ch+1,d.page_count+1)-1
    return "\n".join(d[i].get_text() for i in range(a,min(b,d.page_count)))
def _clean(t):
    t=re.sub(r'★[^\n]*★','',t); t=re.sub(r'2027학년도[^\n]*','',t)
    t=re.sub(r'-\s*\d+\s*-','',t); t=re.sub(r'\d{2}강[^\n]*','',t); t=re.sub(r'page\s*\d+','',t)
    return re.sub(r'[❶-❿]','',re.sub(r'\n{2,}','\n',t)).strip()

def cmd_extract(ch,which):
    ch=int(ch); d=_open("통합본"); txt=_chapter_text(d,ch)
    if which.upper()=="GW":
        m=re.search(r'(\d{4}학년도.*?\[[^\]]+\])(.*?)(?=\n\d{2}\.\s*\[|\Z)',txt,re.S)
        hdr=m.group(1) if m else "Gateway"; body=m.group(2) if m else txt[:1500]
    else:
        w=which.zfill(2)
        m=re.search(r'\n'+w+r'\.\s*\[([^\]]+)\](.*?)(?=\n\d{2}\.\s*\[|\Z)',txt,re.S)
        hdr=f"{w}. "+(m.group(1) if m else ""); body=m.group(2) if m else ""
    body=_clean(body)
    stub={"kind":"grammar" if ch==11 else "reading",
          "header":f"{ch:02d}강 {which}. {CH_TITLE.get(ch,'')}",
          "meta":f"고3 · EBS 수능특강 {ch:02d}강 · {CH_TITLE.get(ch,'')} · 그대로 발췌",
          "_source_header":hdr.strip(),
          "passage":body,  # ← 여기에 <<...>> 마크업을 입혀 분석 완성
          "_todo":"passage에 연결어(co)/핵심개념(hl=)/뜻풀이(g=)/밑줄(u) 마크업을 입히고 hook·flow·answer를 채우시오."}
    print(json.dumps(stub,ensure_ascii=False,indent=1))
    return stub

def cmd_render(data,out=None):
    if not out:
        base=json.load(io.open(data,encoding="utf-8")).get("header","deck").replace(" ","_").replace(".","")
        out=os.path.join(OUT_DIR,f"판서_{base}.pptx")
    r=subprocess.run([sys.executable,os.path.join(HERE,"board_highlight_pptx.py"),data,out])
    return out if r.returncode==0 else None

def cmd_pdf(pptx):
    os.makedirs(OUT_DIR,exist_ok=True)
    inst=f"file:///C:/Users/Public/lo_pipe_{abs(hash(pptx))%9999}"
    subprocess.run([SOFFICE,"--headless",f"-env:UserInstallation={inst}","--convert-to","pdf",
                    "--outdir",os.path.dirname(pptx),pptx],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print("PDF →",os.path.splitext(pptx)[0]+".pdf")

def cmd_build(manifest):
    man=json.load(io.open(manifest,encoding="utf-8")); made=[]
    for item in man.get("decks",[]):
        src=os.path.join(HERE,item["json"]) if not os.path.isabs(item["json"]) else item["json"]
        out=os.path.join(OUT_DIR,item["out"])
        print(f"▶ {item['out']}")
        if cmd_render(src,out):
            made.append(out)
            if man.get("pdf",True): cmd_pdf(out)
    print(f"\n완료 {len(made)}개 · 폴더: {OUT_DIR}")

DEFAULT_MANIFEST={"pdf":True,"decks":[
 {"json":"_hl_read07.json","out":"판서_리딩_07강04_리미티드애니메이션.pptx"},
 {"json":"_hl_gram11.json","out":"판서_어법_11강01_슈퍼마켓은유.pptx"},
 {"json":"_hl_33.json","out":"판서_33_빈칸_규범과기대.pptx"}]}
def cmd_all():
    mp=os.path.join(HERE,"_manifest_default.json"); json.dump(DEFAULT_MANIFEST,io.open(mp,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
    cmd_build(mp)

if __name__=="__main__":
    a=sys.argv[1:] or ["all"]
    c=a[0]
    if c=="list": cmd_list()
    elif c=="extract": cmd_extract(a[1],a[2] if len(a)>2 else "GW")
    elif c=="render": cmd_render(a[1],a[2] if len(a)>2 else None)
    elif c=="pdf": cmd_pdf(a[1])
    elif c=="build": cmd_build(a[1])
    elif c=="all": cmd_all()
    else: print(__doc__)
