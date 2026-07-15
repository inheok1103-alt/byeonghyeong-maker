# -*- coding: utf-8 -*-
"""ray_studio.py — RAY 올인원 제작 오케스트레이터 (로컬 + 뇌 API 연결)
지문 하나 → [뇌(ray_llm)가 분석] → 판서 수업PPT + 학생용 인쇄본 자동 생성.
뇌 실패 시 오프라인 auto_markup 으로 폴백(항상 결과 나옴). 뇌가 배운 뜻풀이는 brain_knowledge에 축적.

사용:
  python ray_studio.py text "<원문 지문...>" [reading|grammar]
  python ray_studio.py chapter <강> <GW|01..>        # 로컬 수능특강에서 발췌 후 자동제작
  python ray_studio.py file <passage.txt>"""
import sys, io, os, json, re, subprocess, time
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.expanduser(r"~/Downloads/수능특강/_RAY수업보드")
import auto_markup, ray_llm, ray_escalate
KB = os.path.join(HERE, "brain_knowledge.json")

ROLE_COLOR = [(r"도입|정의|화제", "cyan"), (r"통념|배경|일반", "red"), (r"전환|반전|역접|대조|however", "green"),
              (r"대안|설명|부연|예시|근거", "cyan"), (r"심화|전개", "blue"), (r"핵심|결론|주제|요지|주장", "magenta"),
              (r"마무리|정리", "gold")]
def role_color(role):
    for pat, c in ROLE_COLOR:
        if re.search(pat, str(role), re.I): return c
    return "blue"

def log(m): print(f"  · {m}")

def load_kb():
    if os.path.exists(KB):
        try: return json.load(io.open(KB, encoding="utf-8"))
        except Exception: pass
    return {"glossary": {}, "connectives_extra": [], "stopwords_extra": [], "stats": {"runs": 0}}
def save_kb(kb): json.dump(kb, io.open(KB, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

BRAIN_PROMPT = """당신은 한국 고등 영어 내신·수능 출제 및 수업자료 제작 전문가(RAY 출제자 뇌)다.
아래 영어 지문을 분석해 '수업용' 자료 데이터를 JSON으로만 출력하라. 설명·코드블록 금지, 순수 JSON만.

지문:
\"\"\"{PASSAGE}\"\"\"

요구 스키마(모든 키 필수, 한국어 값):
{{
 "topic": "지문 주제(한글 20자 이내)",
 "one_liner": "한 줄 요지(한글 40자 이내)",
 "key_concepts": ["대조/핵심 명사1(영문 소문자)", "핵심 명사2(영문 소문자)"],
 "glosses": {{"영어단어(원문에 있는 어려운 단어, 소문자)": "한국어뜻(짧게)"}},  // 6~9개
 "connectives": ["원문에 실제로 있는 연결어/담화표지(영문 그대로)"],            // 있는 것만
 "hook": {{"title":"흥미유발 제목(한글)","lead":"배경 도입 1문장(한글)",
          "cards":[{{"head":"카드제목","body":"배경지식 설명(한글 45자내)"}}],  // 정확히 4개
          "bridge":"지문으로 잇는 질문(한글)"}},
 "flow": [{{"n":1,"role":"도입·정의 등 역할(한글)","note":"해당 문장 요약(한글 40자내)"}}],  // 지문 문장 수만큼(최대 7)
 "question": {{"type":"제목|주제|요지|빈칸","stem":"발문(한글)","choices":["영문 선택지 5개"],"answer":1}},
 "answer_plain": "정답 선택지 영문 전체",
 "rationale": "정답 근거(한글, 지문 요지문 인용 포함)",
 "wrong": [{{"n":2,"text":"오답 근거(한글)"}}],   // 정답 제외 4개
 "vocab": [{{"w":"영어","m":"한국어뜻"}}]          // 8개
}}
반드시 유효한 JSON 하나만 출력."""

BRAIN_PROMPT_GRAMMAR = """당신은 한국 수능·내신 영어 어법(어법 정확성 파악) 출제 전문가(RAY 출제자 뇌)다.
아래 영어 지문에서 '어법상 틀린 것 고르기' 문항을 만들 데이터를 JSON으로만 출력하라. 순수 JSON만.

지문(원문, 모두 정문):
\"\"\"{PASSAGE}\"\"\"

지침:
- 지문에서 어법 출제점 5곳을 '원문에 실제로 있는 짧은 어구'로 고른다(수일치·분사·관계사·태·부정사/동명사·대동사·병렬 등 다양하게).
- 그 중 정확히 1곳만 '틀린 형태(error_form)'로 바꿔 정답으로 만든다. 나머지 4곳은 정문.
- error_form 은 자연스럽지만 명확히 틀린 형태(예: is→are, copying→copy, which→in which 반대 등).

스키마(한국어 값):
{{
 "topic":"주제(한글20자내)","one_liner":"요지(한글40자내)",
 "glosses":{{"어려운영어단어(소문자)":"한국어뜻"}},   // 5개
 "grammar_points":[   // 정확히 5개, 지문 등장 순서대로
   {{"word":"원문에 있는 정확한 어구","label":"문법항목(한글)","is_answer":false,"error_form":null,"why":"정오 판정 근거(한글)"}}
 ],
 "answer": 3,                     // is_answer=true 인 것의 번호(1~5)
 "explanation_core":"정답이 왜 틀렸고 올바른 형태는 무엇인지(한글)",
 "hook":{{"title":"흥미제목","lead":"도입1문장","cards":[{{"head":"","body":""}}],"bridge":"질문"}},  // cards 4개
 "flow":[{{"n":1,"role":"역할","note":"문장요약"}}],   // 지문 문장 수만큼(최대7)
 "vocab":[{{"w":"영어","m":"뜻"}}]   // 6개
}}
정확히 1개만 is_answer=true. 유효 JSON 하나만."""

def analyze_with_brain(passage, template=BRAIN_PROMPT, topic="지문분석"):
    log("뇌(API)에게 지문 분석 요청 중…")
    prompt = ray_escalate.lessons_preamble() + template.replace("{PASSAGE}", passage)
    def local():
        data, prov = ray_llm.ask_json([{"role": "user", "content": prompt}], temperature=0.35, timeout=90)
        data["_provider"] = prov; log(f"뇌 응답 (provider={prov})"); return data
    def repair(fixed):   # GPT 하청이 복구한 JSON
        fixed["_provider"] = "gpt-하청"; log("GPT 하청으로 분석 복구"); return fixed
    return ray_escalate.guarded(local, repair=repair, context=prompt[:1500], topic=topic)

def build_reading_json(passage, meta, header, brain):
    kb = load_kb()
    # 뇌가 준 뜻풀이·연결어를 지식에 축적(품질 향상)
    kb.setdefault("glossary", {}).update({k.lower(): v for k, v in (brain.get("glosses") or {}).items()})
    for c in (brain.get("connectives") or []):
        if c not in auto_markup.CONNECTIVES and c not in kb.setdefault("connectives_extra", []):
            kb["connectives_extra"].append(c)
    kb.setdefault("stats", {})["runs"] = kb.get("stats", {}).get("runs", 0) + 1
    save_kb(kb)
    # 마크업 조립(뇌 key_concepts + 축적 지식)
    mk = auto_markup.mark_passage(passage, kb=kb, key_concepts=[k.lower() for k in (brain.get("key_concepts") or [])][:2])
    # 흐름 색 부여
    flow = []
    for f in (brain.get("flow") or []):
        flow.append({"n": f.get("n"), "role": f.get("role", ""), "cl": role_color(f.get("role", "")), "note": f.get("note", "")})
    if not flow: flow = auto_markup.infer_flow(passage)
    q = brain.get("question", {})
    ans = int(q.get("answer", 1))
    choices = [{"n": i+1, "text": t, **({"correct": True} if i+1 == ans else {})} for i, t in enumerate(q.get("choices", [])[:5])]
    hook = brain.get("hook", {})
    for cd in hook.get("cards", [])[:4]:
        cd.setdefault("cl", role_color(cd.get("head", "")))
    legend = mk["legend"]
    return {
        "kind": "reading", "header": header, "meta": meta,
        "stem": q.get("stem", "다음 글의 제목으로 가장 적절한 것은?"),
        "hook": {"title": hook.get("title", brain.get("topic", "오늘의 배경지식")),
                 "lead": hook.get("lead", brain.get("one_liner", "")),
                 "cards": [{"cl": cd.get("cl", "cyan"), "head": cd.get("head", ""), "body": cd.get("body", "")} for cd in hook.get("cards", [])[:4]],
                 "bridge": hook.get("bridge", "")},
        "passage": mk["marked"], "legend": legend, "footnotes": mk["footnotes"],
        "choices": choices, "answer": ans, "answer_label": q.get("type", "정답"),
        "answer_plain": brain.get("answer_plain", ""),
        "rationale": brain.get("rationale", ""),
        "flow": flow,
        "logic": {"rows": [{"arrow": "요지", "acol": "magenta", "expr": brain.get("one_liner", ""), "tag": "main", "note": brain.get("topic", "")}],
                  "banner": brain.get("one_liner", "")},
        "wrong": brain.get("wrong", []),
        "vocab": brain.get("vocab", []),
        "_provider": brain.get("_provider", "")
    }

def build_grammar_json(passage, meta, header, brain):
    kb = load_kb()
    kb.setdefault("glossary", {}).update({k.lower(): v for k, v in (brain.get("glosses") or {}).items()}); save_kb(kb)
    circ = "①②③④⑤"
    pts_in = [p for p in (brain.get("grammar_points") or []) if str(p.get("word", "")).strip()][:5]
    # 정답 지정 검증(정확히 1개)
    ans_flags = [i for i, p in enumerate(pts_in) if p.get("is_answer")]
    ans_i = ans_flags[0] if ans_flags else (int(brain.get("answer", 1)) - 1)
    ans_i = max(0, min(ans_i, len(pts_in) - 1))
    marked = passage; holders = []; points = []
    for i, pt in enumerate(pts_in):
        w = str(pt["word"]).strip(); is_ans = (i == ans_i)
        shown = str(pt.get("error_form") or "").strip() if is_ans and pt.get("error_form") else w
        ph = f"@@P{i}@@"
        pat = re.compile(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z])")
        marked = pat.sub(ph, marked, count=1) if pat.search(marked) else marked.replace(w, ph, 1)
        holders.append((ph, i + 1, shown))
        points.append({"n": i + 1, "underline": shown, "label": pt.get("label", ""),
                       "verdict": "X" if is_ans else "O",
                       **({"correct": w, "answer": True} if is_ans else {}), "why": pt.get("why", "")})
    for ph, n, shown in holders:
        marked = marked.replace(ph, f"{circ[n-1]}<<{shown}|u,cc>>")
    hook = brain.get("hook", {})
    for cd in hook.get("cards", [])[:4]: cd.setdefault("cl", role_color(cd.get("head", "")))
    flow = [{"n": f.get("n"), "role": f.get("role", ""), "cl": role_color(f.get("role", "")), "note": f.get("note", "")}
            for f in (brain.get("flow") or [])]
    gloss = {k.lower(): v for k, v in (brain.get("glosses") or {}).items()}
    return {
        "kind": "grammar", "header": header, "meta": meta,
        "stem": "다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?",
        "hook": {"title": hook.get("title", brain.get("topic", "오늘의 어법")),
                 "lead": hook.get("lead", brain.get("one_liner", "")),
                 "cards": [{"cl": cd.get("cl", "cyan"), "head": cd.get("head", ""), "body": cd.get("body", "")} for cd in hook.get("cards", [])[:4]],
                 "bridge": hook.get("bridge", "")},
        "passage": marked,
        "legend": [{"sw": "gold", "label": "어법 밑줄 ①~⑤"}, {"sw": "green", "label": "연결어"}],
        "footnotes": [f"{w} {m}" for w, m in list(gloss.items())[:4]],
        "points": points, "answer": ans_i + 1,
        "explanation_core": brain.get("explanation_core", ""),
        "flow": flow, "vocab": brain.get("vocab", []), "_provider": brain.get("_provider", "")
    }

VERIFY_GRAMMAR_PROMPT = """엄격한 영어 어법 검증관이다. 아래 '어법상 틀린 것 고르기' 문항이 타당한지 검증하라.
정답으로 지정된 밑줄이 '명확히 어법상 틀렸고' 원래 형태가 '명확히 맞으며', 나머지 4개가 '모두 맞아야' 타당하다.
둘 다 허용되는 경우(that/which 제한적 관계절 등)나 애매하면 반드시 valid=false.

원문: \"\"\"{PASSAGE}\"\"\"
정답 지정: ⑤번호 {N} — 지문엔 틀린형태 '{ERR}' 로 제시, 올바른형태 '{OK}' (문법항목: {LABEL})
근거주장: {WHY}

JSON만: {{"valid": true|false, "reason": "판정 근거(한글 한 문장)"}}"""

def verify_grammar(passage, data):
    ans = next((p for p in data.get("points", []) if p.get("answer")), None)
    if not ans: return False, "정답 미지정"
    prompt = (VERIFY_GRAMMAR_PROMPT.replace("{PASSAGE}", passage).replace("{N}", str(ans["n"]))
              .replace("{ERR}", str(ans.get("underline", ""))).replace("{OK}", str(ans.get("correct", "")))
              .replace("{LABEL}", str(ans.get("label", ""))).replace("{WHY}", str(ans.get("why", ""))))
    try:
        r, prov = ray_llm.ask_json([{"role": "user", "content": prompt}], temperature=0.1, timeout=60)
        return bool(r.get("valid")), str(r.get("reason", ""))
    except Exception as e:
        return False, f"검증 호출 실패: {e}"

def offline_reading_json(passage, meta, header):
    log("오프라인 폴백(auto_markup)으로 제작")
    kb = load_kb(); mk = auto_markup.mark_passage(passage, kb=kb)
    flow = auto_markup.infer_flow(passage)
    return {"kind": "reading", "header": header, "meta": meta, "stem": "다음 글의 주제로 가장 적절한 것은?",
            "hook": {"title": "오늘의 지문", "lead": mk["key_concepts"][0] if mk["key_concepts"] else "",
                     "cards": [{"cl": "cyan", "head": "핵심어", "body": ", ".join(mk["key_concepts"])}], "bridge": "무엇에 관한 글인가?"},
            "passage": mk["marked"], "legend": mk["legend"], "footnotes": mk["footnotes"],
            "choices": [], "answer": 1, "answer_label": "주제", "answer_plain": "",
            "rationale": "(오프라인 생성 — 뇌 미연결)", "flow": flow, "logic": {"rows": [], "banner": ""},
            "wrong": [], "vocab": []}

def render(data_json, base):
    os.makedirs(OUT_DIR, exist_ok=True)
    src = os.path.join(HERE, f"_studio_{base}.json")
    json.dump(data_json, io.open(src, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ppt = os.path.join(OUT_DIR, f"판서_{base}.pptx")
    r1 = subprocess.run([sys.executable, os.path.join(HERE, "board_highlight_pptx.py"), src, ppt])
    log(f"수업 PPT: {os.path.basename(ppt)} ({'OK' if r1.returncode==0 else '실패'})")
    html = os.path.join(HERE, f"_studio_{base}.html")
    subprocess.run([sys.executable, os.path.join(HERE, "student_handout_html.py"), src, html])
    log(f"학생용 HTML 생성 (PDF는 lesson_ppt_pipeline pdf 또는 Edge print)")
    return {"json": src, "pptx": ppt, "student_html": html}

def make(passage, kind="reading", meta="RAY 올인원", header="RAY 수업", base="studio"):
    t0 = time.time()
    log(f"지문 {len(passage)}자 · 종류={kind}")
    try:
        if kind == "grammar":
            brain = analyze_with_brain(passage, BRAIN_PROMPT_GRAMMAR, topic="어법분석")
            data = build_grammar_json(passage, meta, header, brain)
            ok, reason = verify_grammar(passage, data)   # 검증 게이트
            if ok:
                log(f"어법 검증 통과 ✓ ({reason[:40]})"); ray_escalate.learn("어법검증", True, reason)
            else:
                log(f"어법 검증 실패 ✗ → 관리자 에스컬레이션: {reason[:50]}")
                data["_warning"] = f"자동검증 미통과: {reason}"; data["meta"] = (meta + " · ⚠검증필요")
                ray_escalate.to_manager(f"어법 {header} 자동생성 문항 검증 실패", reason, ["local", "verify"])
                ray_escalate.learn("어법검증", False, reason)
        else:
            brain = analyze_with_brain(passage); data = build_reading_json(passage, meta, header, brain)
    except Exception as e:
        log(f"뇌 분석 실패({str(e)[:60]}) → 폴백"); data = offline_reading_json(passage, meta, header)
    out = render(data, base)
    log(f"완료 ({time.time()-t0:.0f}s) · 폴더 {OUT_DIR}")
    return out

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["text", "This is a sample passage. However, it shows the flow."]
    if a[0] == "text":
        make(a[1], a[2] if len(a) > 2 else "reading", header="RAY 자동제작", base="text")
    elif a[0] == "file":
        make(io.open(a[1], encoding="utf-8").read(), header=os.path.basename(a[1]), base="file")
    elif a[0] == "chapter":
        pl = subprocess.run([sys.executable, os.path.join(HERE, "lesson_ppt_pipeline.py"), "extract", a[1], a[2] if len(a) > 2 else "GW"],
                            capture_output=True, text=True, encoding="utf-8")
        stub = json.loads(pl.stdout[pl.stdout.find("{"):pl.stdout.rfind("}")+1])
        make(stub["passage"], "grammar" if a[1] == "11" else "reading", meta=stub.get("meta", ""),
             header=stub.get("header", ""), base=f"{a[1]}강_{a[2] if len(a)>2 else 'GW'}")
