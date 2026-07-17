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
import auto_markup, ray_llm, ray_escalate, ray_bridge, qtypes
KB = os.path.join(HERE, "brain_knowledge.json")

ROLE_COLOR = [(r"도입|정의|화제", "cyan"), (r"통념|배경|일반", "red"), (r"전환|반전|역접|대조|however", "green"),
              (r"대안|설명|부연|예시|근거", "cyan"), (r"심화|전개", "blue"), (r"핵심|결론|주제|요지|주장", "magenta"),
              (r"마무리|정리", "gold")]
def role_color(role):
    for pat, c in ROLE_COLOR:
        if re.search(pat, str(role), re.I): return c
    return "blue"

def log(m): print(f"  · {m}")

REVIEW_QUEUE = os.path.join(HERE, "_review_queue.jsonl")
def review_enqueue(item):
    import time as _t
    item["ts"] = _t.strftime("%Y-%m-%d %H:%M"); item["status"] = "pending"
    with io.open(REVIEW_QUEUE, "a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")
def review_pending():
    if not os.path.exists(REVIEW_QUEUE): return []
    out = []
    for l in io.open(REVIEW_QUEUE, encoding="utf-8").read().splitlines():
        if l.strip():
            try:
                d = json.loads(l)
                if d.get("status") == "pending": out.append(d)
            except Exception: pass
    return out

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

def playbook_preamble(qt):
    """★ 되먹임: 학습된 유형 출제방식·출제의도·오답설계를 생성 프롬프트에 주입."""
    if not qt: return ""
    try:
        pb = load_kb().get("type_playbook", {}).get(qt)
        if not pb or pb.get("samples", 0) < 1: return ""
        lines = [f"[학습된 '{qt}' 출제방식 — 표본 {pb['samples']}건]"]
        if pb.get("distractors"):
            top = sorted(pb["distractors"].items(), key=lambda x: -x[1])
            lines.append("오답 5개를 다음 유형으로 다양하게 설계하라: " + ", ".join(k for k, _ in top[:5]))
        if pb.get("intents"):
            lines.append("검증된 출제의도 예: " + pb["intents"][-1][:120])
        return "\n".join(lines) + "\n\n"
    except Exception:
        return ""

def analyze_with_brain(passage, template=BRAIN_PROMPT, topic="지문분석", extra=""):
    log("뇌(API)에게 지문 분석 요청 중…")
    prompt = ray_escalate.lessons_preamble() + extra + template.replace("{PASSAGE}", passage)
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
    # ★ 연결어 학습 게이트: 기능어(and/or/that/if…) 오학습 차단 — 지문이 지저분해지는 원인
    BAN = set(kb.get("banned_connectives", [])) | {
        "and", "or", "that", "which", "who", "when", "while", "but", "if", "then", "so",
        "including", "also", "either", "neither", "where", "because", "as", "to", "of",
        "in", "the", "a", "an", "it", "this", "these", "rather", "indeed", "yet", "however"}
    def _ok(c):
        s = str(c).strip()
        if not re.match(r"^[A-Za-z]", s): return False
        if s.lower() in BAN: return False
        if len(s.split()) == 1 and len(s) <= 4: return False        # 짧은 단일 기능어
        if len(s.split()) == 1 and s.lower() not in {"however", "nevertheless", "nonetheless",
            "therefore", "thus", "hence", "meanwhile", "moreover", "furthermore", "instead",
            "besides", "otherwise", "consequently"}: return False   # 단일어는 화이트리스트만
        return True
    for c in (brain.get("connectives") or []):
        if _ok(c) and c not in auto_markup.CONNECTIVES and c not in kb.setdefault("connectives_extra", []):
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

def validate_reading(data):
    """무료 API 문항 품질 검증. 문제 리스트 반환(빈 리스트=합격)."""
    import re as _re
    ch = data.get("choices", []); ans = data.get("answer", 0)
    passage = _re.sub(r"<<.*?>>", "", str(data.get("passage", "")))
    txts = [_re.sub(r"<<.*?>>", "", str(c.get("text", "") if isinstance(c, dict) else c)).strip() for c in ch]
    probs = []
    if len(ch) < 4: probs.append(f"선지 {len(ch)}개(4개 미만)")
    if not (isinstance(ans, int) and 1 <= ans <= max(len(ch), 1)): probs.append(f"정답번호 무효({ans})")
    if any(_re.fullmatch(r"(기타|모두|모두\s*다|없음|정답\s*없음|all|none|etc\.?|위\s*모두)", t.lower()) for t in txts if t):
        probs.append("필러 선지(기타/모두/none)")
    vb = sum(1 for t in txts if len(t) > 24 and t[:40] in passage)
    if vb >= 2: probs.append(f"선지 {vb}개가 지문 문장 복사")
    if len([t for t in txts if t]) < len(ch): probs.append("빈 선지")
    return probs

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

DISTRACTOR_TAX = [
    (r"부분|소재일 뿐|일부만|지엽", "부분소재"),
    (r"반대|정반대|상충|우위가 아니라|오히려", "반대방향"),
    (r"언급.*없|나오지 않|무관|초점이 아니|전혀", "무관·미언급"),
    (r"비유|예시일 뿐|사례일 뿐|도입", "예시·비유오인"),
    (r"과장|지나치|too|과잉|일반화", "과잉일반화"),
]
def learn_from_deck(data):
    """★ 학습 동시진행: 제작된 덱에서 유형 출제방식·출제의도·오답설계를 뇌에 축적."""
    try:
        kb = load_kb(); pb = kb.setdefault("type_playbook", {})
        qt = data.get("answer_label") or ("어법" if data.get("points") else "독해")
        meta = str(data.get("meta", "")); verified = ("페이블" in meta) or ("GPT" in meta) or ("검수완료" in meta)
        rec = pb.setdefault(qt, {"samples": 0, "verified": 0, "stems": [], "distractors": {}, "intents": [], "examples": []})
        rec["samples"] += 1
        if verified: rec["verified"] += 1
        st = data.get("stem", "")
        if st and st not in rec["stems"]: rec["stems"] = (rec["stems"] + [st])[-6:]
        # 오답설계 분류(출제방식 학습)
        for w in data.get("wrong", []):
            txt = str(w.get("text", "")); cat = "기타"
            for pat, name in DISTRACTOR_TAX:
                if re.search(pat, txt): cat = name; break
            rec["distractors"][cat] = rec["distractors"].get(cat, 0) + 1
        # 출제의도(정답 근거) — 검증된 것 우선 축적
        rat = data.get("rationale") or data.get("explanation_core") or ""
        if rat and verified:
            rec["intents"] = (rec["intents"] + [rat[:180]])[-5:]
        if verified:
            ex = {"header": data.get("header", ""), "answer": data.get("answer"),
                  "answer_plain": (data.get("answer_plain") or "")[:80]}
            rec["examples"] = (rec["examples"] + [ex])[-4:]
        kb["stats"] = kb.get("stats", {}); kb["stats"]["decks_learned"] = kb["stats"].get("decks_learned", 0) + 1
        save_kb(kb)
        log(f"학습: '{qt}' 유형 출제방식 축적(표본 {rec['samples']}·검증 {rec['verified']}·오답유형 {list(rec['distractors'])})")
        try:
            import ray_hub; ray_hub.log("brain", "learn_deck", f"{qt} · verified={verified}")
        except Exception: pass
    except Exception as e:
        log(f"학습 스킵({str(e)[:40]})")

def render(data_json, base):
    os.makedirs(OUT_DIR, exist_ok=True)
    learn_from_deck(data_json)   # ★ 제작과 동시에 학습
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
    # 유형 라우팅: kind가 연구 유형명(제목/주제/빈칸/어휘/함의…)이면 등급에 따라 경로 결정
    qt = kind if kind in qtypes.TYPES else None
    if qt:
        g = qtypes.grade(qt)
        log(f"유형 '{qt}' (등급 {g}) — {qtypes.TYPES[qt]['note']}")
        if g == "FABLE" and qt != "어법":
            # 어휘 등 정밀형: 페이블 브릿지로 출제 요청(어법과 동일 프로토콜)
            rid = ray_bridge.request("author_question", {"passage": passage, "qtype": qt, "header": header},
                instruction=f"'{qt}' 유형 문항을 출제하라. result 스키마: reading 데이터 JSON(question/choices/answer/rationale/wrong 포함) 또는 points형.")
            fab = ray_bridge.get_response(rid)
            if fab and fab.get("result"):
                data = fab["result"]; data.setdefault("kind", "reading"); data.setdefault("header", header)
                data["meta"] = meta + " · ✅페이블 출제"
                out = render(data, base); log(f"페이블 출제 반영 완료 ({time.time()-t0:.0f}s)"); return out
            log(f"'{qt}' 페이블 요청 접수(rid={rid}) — 이 챗에서 출제 후 재실행 시 확정")
        kind = "grammar" if qt == "어법" else "reading"
    log(f"지문 {len(passage)}자 · 종류={kind}" + (f" · 유형={qt}" if qt else ""))
    global BRAIN_PROMPT
    if qt and kind == "reading":
        BRAIN_PROMPT = BRAIN_PROMPT.replace('"type":"제목|주제|요지|빈칸"', f'"type":"{qt}"').replace(
            '"stem":"발문(한글)"', f'"stem":"{qtypes.stem(qt)}"')
    try:
        if kind == "grammar":
            # 1) 무료 자동: 생성 → 검증 → 실패 시 재생성 (검증은 실측상 신뢰성 있음: 가짜오류 거부/진짜오류 통과)
            data = None; cand = None; tries = int(os.environ.get("RAY_GRAMMAR_TRIES", "3"))
            for attempt in range(tries):
                brain = analyze_with_brain(passage, BRAIN_PROMPT_GRAMMAR, topic="어법분석")
                cand = build_grammar_json(passage, meta, header, brain)
                ok, reason = verify_grammar(passage, cand)
                if ok:
                    cand["meta"] = meta + " · ✅자동검증 통과(무료)"; data = cand
                    log(f"어법 자동검증 통과 {attempt+1}회차 → 확정 (정답 {cand.get('answer')})")
                    ray_escalate.learn("어법검증", True, reason); break
                log(f"어법 자동검증 미통과 {attempt+1}회차: {reason[:45]} → 재생성")
            # 2) 무료 반복 실패 → 페이블(이 챗) 연동 요청. 페이블 응답 있으면 확정.
            if data is None:
                pts = (cand and cand.get("points")) or []
                rid = ray_bridge.request("grammar_error", {
                    "passage": passage, "header": header,
                    "candidates": [{"word": p.get("underline"), "label": p.get("label")} for p in pts]},
                    instruction=("무료 자동생성이 유효 오류를 못 만들었다. 어법 출제점 1곳을 명확한 오류로 지정하라. "
                                 "result 스키마: {answer_word:원문 그대로 어구, error_form:틀린 형태, correct:올바른 형태, "
                                 "label:문법항목, why:근거, explanation:정답해설}. that↔which 등 양쪽 허용 금지."))
                fab = ray_bridge.get_response(rid)
                if fab and fab.get("result"):
                    r = fab["result"]; aw = str(r.get("answer_word", "")).strip()
                    if r.get("points"):   # 페이블이 5포인트 전체를 출제한 경우(권장)
                        pts5 = r["points"]
                        for p in pts5:
                            p["is_answer"] = bool(p.get("is_answer")) or (str(p.get("word", "")).strip() == aw)
                            if p["is_answer"]: p["error_form"] = r.get("error_form") or p.get("error_form")
                        brain = {"grammar_points": pts5, "glosses": r.get("glosses", {}),
                                 "explanation_core": r.get("explanation", ""), "hook": r.get("hook", {}),
                                 "flow": r.get("flow", []), "vocab": r.get("vocab", [])}
                    else:
                        brain = {"grammar_points": [{"word": aw, "label": r.get("label", ""), "is_answer": True,
                                                     "error_form": r.get("error_form"), "why": r.get("why", "")}],
                                 "glosses": {}, "explanation_core": r.get("explanation", ""), "hook": {}, "flow": [], "vocab": []}
                    data = build_grammar_json(passage, meta, header, brain)
                    data["meta"] = meta + " · ✅페이블 검수완료"
                    log(f"페이블 응답 반영 → 최종 확정 (정답 {data.get('answer')})")
                    ray_escalate.learn("어법검증", True, "페이블 검수 확정")
                else:
                    data = cand or build_grammar_json(passage, meta, header, {})
                    data["_review"] = "pending"; data["meta"] = meta + " · 🕒페이블 검수대기"
                    review_enqueue({"kind": "grammar", "header": header, "rid": rid, "json": os.path.join(HERE, f"_studio_{base}.json")})
                    log(f"어법 무료 {tries}회 실패 → 페이블 연동 요청 (rid={rid}). 이 챗 검수 후 재실행 시 확정.")
        else:
            brain = analyze_with_brain(passage, extra=playbook_preamble(qt)); data = build_reading_json(passage, meta, header, brain)
            probs = validate_reading(data)
            if probs:   # ★ 무료 문항 품질 미달 → 페이블 출제로 승격
                log("문항 품질 미달: " + "; ".join(probs) + " → 페이블 출제 요청")
                rid = ray_bridge.request("author_question",
                    {"passage": passage, "qtype": qt or "제목", "header": header,
                     "one_liner": brain.get("one_liner", ""), "issues": probs},
                    instruction=(f"'{qt or '제목'}' 유형 문항을 출제하라. 무료 자동생성 실패({'; '.join(probs)}). "
                                 "규칙: 선지에 지문 문장 복사 금지·필러(기타/모두) 금지, 정답 1~5 명시, 오답 4개 매력도 확보. "
                                 "result 스키마: {stem, choices[5], answer, answer_plain, rationale, wrong[4]}"))
                fab = ray_bridge.get_response(rid)
                if fab and fab.get("result"):
                    fr = fab["result"]
                    for k in ("stem", "answer", "answer_plain", "rationale", "wrong"):
                        if fr.get(k) is not None: data[k] = fr[k]
                    if fr.get("choices"):
                        data["choices"] = [{"n": i+1, "text": (c.get("text") if isinstance(c, dict) else c),
                                            **({"correct": True} if i+1 == int(fr.get("answer", 1)) else {})}
                                           for i, c in enumerate(fr["choices"][:5])]
                    data["meta"] = meta + " · ✅페이블 출제"
                    log(f"페이블 문항 반영 (정답 {data.get('answer')})")
                    ray_escalate.learn("독해문항", True, "페이블 출제")
                else:   # 페이블 응답 없음 → 분석은 살리고 엉터리 문항은 버림
                    data["choices"] = []; data["answer"] = 1
                    data["stem"] = f"[문항 준비 중 · 페이블 검수 대기] {qtypes.stem(qt) if qt else ''}"
                    data["_review"] = "pending"; data["meta"] = meta + " · 🕒페이블 문항 대기(분석만 완성)"
                    review_enqueue({"kind": "reading", "qtype": qt, "header": header, "rid": rid,
                                    "issues": probs, "json": os.path.join(HERE, f"_studio_{base}.json")})
                    log(f"엉터리 문항 폐기 → 분석 덱만 출하 + 페이블 검수요청(rid={rid})")
                    ray_escalate.learn("독해문항", False, "; ".join(probs))
    except Exception as e:
        log(f"뇌 분석 실패({str(e)[:60]}) → 폴백"); data = offline_reading_json(passage, meta, header)
    out = render(data, base)
    log(f"완료 ({time.time()-t0:.0f}s) · 폴더 {OUT_DIR}")
    return out

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    a = sys.argv[1:] or ["text", "This is a sample passage. However, it shows the flow."]
    if a[0] == "text":
        make(a[1], a[2] if len(a) > 2 else "reading", header="RAY 자동제작", base=(a[3] if len(a) > 3 else "text"))
    elif a[0] == "file":
        make(io.open(a[1], encoding="utf-8").read(), header=os.path.basename(a[1]), base="file")
    elif a[0] == "chapter":
        pl = subprocess.run([sys.executable, os.path.join(HERE, "lesson_ppt_pipeline.py"), "extract", a[1], a[2] if len(a) > 2 else "GW"],
                            capture_output=True, text=True, encoding="utf-8")
        stub = json.loads(pl.stdout[pl.stdout.find("{"):pl.stdout.rfind("}")+1])
        make(stub["passage"], "grammar" if a[1] == "11" else "reading", meta=stub.get("meta", ""),
             header=stub.get("header", ""), base=f"{a[1]}강_{a[2] if len(a)>2 else 'GW'}")
