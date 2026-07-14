# -*- coding: utf-8 -*-
"""student_handout_html.py — 학생 배부용 인쇄본(흰 배경 A4) 생성
같은 _hl_*.json 데이터 → 2쪽: ①문제(스스로 표시) ②해설(색·볼드·밑줄 표시).
사용: python student_handout_html.py <data.json> <out.html>
이후 Edge --print-to-pdf 로 PDF화."""
import sys, io, json, re, html

L=json.load(io.open(sys.argv[1],encoding="utf-8")); OUT=sys.argv[2]
KIND=L.get("kind","reading"); P=L; CIRC="①②③④⑤⑥⑦⑧⑨⑩"
# 인쇄용(흰 배경) 팔레트 — 진한 색
HLB={"red":("#f6d4d4","#a5281f"),"magenta":("#f7d3e7","#9c1f6e"),"pink":("#fbdcec","#8e2f66"),
     "blue":("#d4e6f6","#1c5a92"),"cyan":("#cdeff0","#0f7377"),"green":("#d3f0dd","#166b38"),
     "yellow":("#fbeec2","#8a6a10"),"orange":("#fbe0cb","#a45a1c"),"purple":("#e6dcf7","#5f3fa0")}
TCB={"red":"#c0392b","magenta":"#a93286","pink":"#b03a72","blue":"#2471a3","cyan":"#12868b",
     "green":"#1e8449","yellow":"#8a6a10","orange":"#b9770e","purple":"#6c3fb0","gold":"#8a6d1a","white":"#1a1a1a"}
SWB={"green":"#1e8449","red":"#c0392b","magenta":"#a93286","blue":"#2471a3","gold":"#a98a2a",
     "yellow":"#c8a415","orange":"#c47a20","cyan":"#12868b","purple":"#6c3fb0"}
def esc(s): return html.escape(str(s))
def strip_mk(text): return re.sub(r'<<(.*?)(?:\|[^>]*)?>>', lambda m: m.group(1), str(text))
def attrs(a):
    d={}
    for t in a.split(","):
        t=t.strip()
        if not t: continue
        if "=" in t: k,v=t.split("=",1); d[k.strip()]=v.strip()
        else: d[t]=True
    return d
def md_html(text, marked=True):
    """마크업 → HTML. marked=False면 색/하이라이트 제거(문제면용, 밑줄·번호는 유지)."""
    out=[]
    for tok in re.split(r'(<<.*?>>)',text):
        if not tok: continue
        if tok.startswith("<<") and tok.endswith(">>"):
            inner=tok[2:-2]; txt,_,att=inner.partition("|"); a=attrs(att); t=esc(txt)
            ul="u" in a; it="it" in a
            if not marked:
                # 문제면: 색 없음. 어법(①~⑤) 밑줄만 유지, 리딩 분석용 밑줄·이탤릭·뜻풀이는 제거
                s=t
                if ul and KIND=="grammar": s=f"<u>{s}</u>"
                out.append(s)
                continue
            style=""; wrap_open=""; wrap_close=""
            if "co" in a: bg,fg=HLB["green"]; style=f"background:{bg};color:{fg};font-weight:700;padding:0 3px;border-radius:3px"
            elif "cc" in a: style=f"color:{TCB['gold']};font-weight:700"
            if "hl" in a and a["hl"] in HLB: bg,fg=HLB[a["hl"]]; style=f"background:{bg};color:{fg};font-weight:700;padding:0 3px;border-radius:3px"
            if "tc" in a and a["tc"] in TCB: style=f"color:{TCB[a['tc']]};font-weight:700"
            s=f'<span style="{style}">{t}</span>' if style else t
            if ul: s=f"<u>{s}</u>"
            if it: s=f"<i>{s}</i>"
            out.append(s)
            if "g" in a and a["g"] is not True: out.append(f'<span class="g">({esc(a["g"])})</span>')
        else:
            out.append(esc(tok))
    return "".join(out)

stem=L.get("stem","다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?" if KIND=="reading" else "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?")
# ── 페이지 1: 문제 ──
choices_html=""
if KIND=="reading":
    for c in L.get("choices",[]):
        choices_html+=f'<div class="ch">{CIRC[c.get("n",1)-1]} {esc(strip_mk(c.get("text","")))}</div>'
else:
    choices_html='<div class="hint">밑줄 <b>①~⑤</b> 중 어법상 틀린 것 하나를 고르시오.</div>'
vocab=L.get("footnotes",[]) or [v.get("w","")+" "+v.get("m","") for v in L.get("vocab",[])]
vocab_html="".join(f"<span>· {esc(v)}</span>" for v in vocab)
note_lines="".join('<div class="nl"></div>' for _ in range(6))

# ── 페이지 2: 해설 ──
ans_badge=CIRC[L.get("answer",1)-1]
if KIND=="reading":
    rationale=esc(L.get("rationale","")); ansplain=esc(strip_mk(L.get("answer_plain","")))
    flow_html="".join(f'<div class="fl"><b style="color:{SWB.get(f.get("cl"),"#a98a2a")}">({f.get("n")}) {esc(f.get("role",""))}</b> {esc(f.get("note",""))}</div>' for f in L.get("flow",[]))
    wrong_html="".join(f'<div class="wr"><b>{CIRC[w.get("n",1)-1]}</b> {esc(w.get("text",""))}</div>' for w in L.get("wrong",[]))
    ans_block=f'''<div class="ansrow"><div class="badge">정답<br><b>{ans_badge}</b></div>
      <div class="ansbody"><div class="ap"><b>{L.get("answer_label","정답")} =</b> {ansplain}</div><div class="rt">{rationale}</div></div></div>
      <div class="sec">글의 흐름</div>{flow_html}
      <div class="sec">오답 근거</div>{wrong_html}'''
else:
    rows=""
    for pt in L.get("points",[]):
        isX=str(pt.get("verdict","")).upper()=="X"; c="#c0392b" if isX else "#1e8449"
        corr=f' → <b style="color:#1e8449">{esc(pt.get("correct",""))}</b>' if isX and pt.get("correct") else ""
        rows+=f'''<tr><td style="text-align:center;color:{c};font-weight:800">{CIRC[pt.get("n",1)-1]}</td>
          <td><b style="color:{c}">{esc(pt.get("underline",""))}</b>{corr}</td>
          <td style="color:{c};font-weight:700">{esc(pt.get("label",""))}</td>
          <td>{esc(pt.get("why",""))}</td>
          <td style="text-align:center;color:{c};font-weight:800">{"X" if isX else "O"}</td></tr>'''
    ans_block=f'''<div class="ansrow"><div class="badge">정답<br><b>{ans_badge}</b></div>
      <div class="ansbody"><div class="rt">{esc(L.get("explanation_core",""))}</div></div></div>
      <table class="pts"><tr><th>#</th><th>밑줄</th><th>문법</th><th>근거</th><th>판정</th></tr>{rows}</table>'''

H=f'''<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
@page{{size:A4;margin:11mm 13mm}}
*{{box-sizing:border-box}} body{{font-family:"Segoe UI","맑은 고딕",sans-serif;color:#1a1a1a;font-size:10.7pt;line-height:1.42;margin:0}}
.sheet{{padding:0}} .pb{{page-break-before:always}}
.hd{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #b8962f;padding-bottom:5px;margin-bottom:9px}}
.hd .t{{font-size:16pt;font-weight:800}} .hd .m{{color:#666;font-size:9.5pt}}
.fields{{display:flex;gap:14px;margin:8px 0 12px;color:#444;font-size:10pt}}
.fields span{{border:1px solid #ccc;border-radius:6px;padding:5px 12px}}
.stem{{font-weight:800;font-size:12pt;margin:10px 0 8px}}
.passage{{border:1px solid #ddd;border-radius:8px;padding:11px 13px;background:#fcfcfa;text-align:justify;line-height:1.62}}
.passage.mk{{line-height:1.72}}
.g{{color:#8a8a8a;font-size:.82em}}
.ch{{margin:6px 2px;font-size:11pt}} .hint{{margin:8px 2px;color:#555}}
.vocab{{margin-top:10px;padding:8px 12px;background:#f4f2ea;border-radius:8px;font-size:9.5pt;color:#5a4a1a;display:flex;flex-wrap:wrap;gap:4px 16px}}
.guide{{margin-top:10px;color:#777;font-size:9.5pt}}
.notes{{margin-top:6px}} .nl{{border-bottom:1px dashed #ccc;height:22px}}
.ansrow{{display:flex;gap:10px;margin:4px 0 8px}}
.badge{{min-width:74px;text-align:center;border:2px solid #b8962f;border-radius:10px;padding:6px;font-size:9.5pt;color:#666}} .badge b{{font-size:21pt;color:#1a1a1a}}
.ansbody{{flex:1;background:#faf8f2;border:1px solid #e6ddc4;border-radius:10px;padding:8px 12px}}
.ap{{font-size:11pt;margin-bottom:3px}} .rt{{color:#333}}
.sec{{font-weight:800;color:#b8962f;border-left:4px solid #b8962f;padding-left:8px;margin:8px 0 4px}}
.fl{{padding:2.5px 2px;border-bottom:1px solid #eee}} .wr{{padding:2px 2px;color:#333}}
.pts{{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:4px}}
.pts th{{background:#f0ece0;padding:6px;border:1px solid #ddd}} .pts td{{padding:6px;border:1px solid #e5e5e5;vertical-align:top}}
.ft{{margin-top:10px;color:#999;font-size:8.5pt;border-top:1px solid #eee;padding-top:6px}}
</style></head><body>
<div class="sheet">
  <div class="hd"><div class="t">{esc(L.get("header",""))}</div><div class="m">{esc(L.get("meta",""))}</div></div>
  <div class="fields"><span>이름</span><span>반</span><span>날짜</span><span>점수 &nbsp;/100</span></div>
  <div class="stem">{esc(stem)}</div>
  <div class="passage">{md_html(P["passage"],marked=False)}</div>
  {choices_html}
  <div class="vocab">{vocab_html}</div>
  <div class="guide">▶ 스스로: 연결어에 ○, 핵심어에 밑줄, 방향이 바뀌는 곳에 ↔ 를 표시하며 읽으세요.</div>
  <div class="notes">{note_lines}</div>
  <div class="ft">이인혁 영어 · RAY ENGLISH · 학생용 문제</div>
</div>
<div class="sheet pb">
  <div class="hd"><div class="t">해설 · {esc(L.get("header",""))}</div><div class="m">복습용 — 색·볼드·밑줄로 흐름 표시</div></div>
  {ans_block}
  <div class="sec">지문 분석 (연결어·핵심개념·흐름)</div>
  <div class="passage mk">{md_html(P["passage"],marked=True)}</div>
  <div class="vocab">{vocab_html}</div>
  <div class="ft">이인혁 영어 · RAY ENGLISH · 학생용 해설</div>
</div>
</body></html>'''
io.open(OUT,"w",encoding="utf-8").write(H)
print("HTML",OUT)
