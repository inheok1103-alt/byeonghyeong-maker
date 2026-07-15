# -*- coding: utf-8 -*-
"""auto_markup.py — 오프라인 자동 마크업 엔진 (제작기 키스톤)
원문 지문(plain) → 판서 마크업 <<...>> + 흐름(flow) + 범례(legend) + 각주(footnotes) 자동 생성.
API 키 불필요. 로컬 지식(brain_knowledge.json)으로 연결어/뜻풀이/핵심어가 점점 똑똑해짐.

핵심 규칙:
- 연결어/담화표지 → co(초록 하이라이트)
- 대조·역접 구조어 → cc(골드 볼드)
- 어려운 단어 → g=뜻(인라인 글로스, 로컬 사전)
- 반복되는 핵심 명사 2개 → hl=red / hl=magenta (핵심개념쌍)
- 정답/빈칸 관련 표현은 데이터에서 수동 지정(자동은 보수적으로)

사용:
  python auto_markup.py "<원문...>"                # 마크업 결과 JSON → stdout
  from auto_markup import mark_passage             # 라이브러리로 사용"""
import sys, io, os, json, re, collections
HERE = os.path.dirname(os.path.abspath(__file__))
KB_PATH = os.path.join(HERE, "brain_knowledge.json")

# ── 연결어/담화표지 (co = 초록 하이라이트) ──
CONNECTIVES = [
    "For example", "For instance", "In other words", "That is", "In fact", "Indeed",
    "As a result", "As a consequence", "In addition", "Moreover", "Furthermore", "Besides",
    "On the other hand", "In contrast", "By contrast", "Instead", "Rather",
    "In short", "In sum", "To sum up", "In conclusion", "Overall", "After all",
    "At the same time", "Meanwhile", "In the meantime", "Above all", "In particular",
    "First of all", "To begin with", "In the case of", "In the end", "From that point on",
    "On the contrary", "Of course", "In this way", "In this sense", "As such",
]
# ── 역접·인과·양보 구조어 (cc = 골드 볼드) ──
STRUCTURE_WORDS = [
    "However", "But", "Yet", "Nevertheless", "Nonetheless", "Still", "Although", "Though",
    "Even though", "Even if", "Despite", "In spite of", "While", "Whereas", "Whether",
    "Therefore", "Thus", "Hence", "So", "Because", "Since", "Unless", "If",
    "Not only", "But also", "Whether", "Otherwise", "Then",
]
# ── 흐름 역할 판정용 신호 ──
ROLE_SIGNALS = [
    (r"\b(However|But|Yet|Nevertheless|In contrast|On the other hand|Instead)\b", "전환·반전", "green", 2),
    (r"\b(Therefore|Thus|Hence|As a result|In conclusion|In short|Overall)\b", "결론·귀결", "gold", 3),
    (r"\b(For example|For instance|In particular|In the case of|such as)\b", "예시·부연", "cyan", 1),
    (r"\b(Because|Since|due to|owing to)\b", "이유·근거", "blue", 1),
]

def load_kb():
    if os.path.exists(KB_PATH):
        try: return json.load(io.open(KB_PATH, encoding="utf-8"))
        except Exception: pass
    return {"glossary": {}, "connectives_extra": [], "stopwords_extra": [], "stats": {}}

# 기본 글로스 사전 (brain_knowledge.json 이 우선; 없으면 이걸 사용)
BASE_GLOSS = {
    "acclaimed":"격찬받는","exquisite":"정교한","verbatim":"말 그대로","encyclopedia":"백과사전",
    "endeavor":"헛된 노력이 되는 노력","metaphor":"은유","metaphors":"은유","abstract":"추상적인",
    "simulation":"모의","simulations":"모의","suspension":"유예","indulge":"몰두하다","aligned":"정렬된",
    "mutual":"상호의","norms":"규범","deviate":"벗어나다","deviations":"이탈","empirical":"경험적인",
    "incentives":"유인","adopt":"채택하다","self-enforcing":"자기강제적인","coordinate":"조율하다",
    "foraging":"수렵채집","ecological":"생태의","accumulate":"축적하다","exceed":"능가하다",
    "inventive":"발명의","ground-breaking":"획기적인","solely":"오로지","comparison":"비교",
    "constraints":"제약","reinforced":"강화된","institutional":"제도적인","prioritized":"우선시한",
    "confront":"직면하게 하다","confronted":"직면하게 한","phenomenon":"현상","implication":"함의",
    "arbitrary":"임의적인","subsequent":"다음의","inherent":"내재된","prevalent":"만연한",
    "compelling":"설득력 있는","profound":"심오한","subtle":"미묘한","notion":"개념","paradox":"역설",
}
STOPWORDS = set("""the a an of to in on at for and or but with as by from into over under about
that this these those which who whom whose what when where while whether why how
would could should might must will shall can may do does did done have has had having being been be am is are was were
their there they them then than thus so such some more most much many each every both either neither
other another same very just only also even still yet ever never always often about above after again against
because before between during through under over into onto upon within without across along around
here your our its his her him she he you they we it one two three not no nor too out off down up
thing things people way ways time times part parts kind kinds lot lots something anything everything nothing
make makes made making take takes took get gets got give gives given use uses used using
say says said know knows knew think thinks thought come comes came go goes went become becomes became
first second third last next new old good bad high low long short small large great little
according including regarding concerning despite toward towards""".split())

def _wc(word): return re.sub(r"[^A-Za-z\-]", "", word).lower()

def detect_key_concepts(text, kb):
    """반복 등장하는 핵심 명사 top2 → 색 쌍 배정(red, magenta)."""
    words = re.findall(r"\b[A-Za-z][A-Za-z\-]{3,}\b", text)
    stop = STOPWORDS | set(kb.get("stopwords_extra", []))
    freq = collections.Counter()
    for w in words:
        lw = w.lower()
        if lw in stop or lw[0].isupper() and words.index(w) != 0: pass
        if lw in stop: continue
        freq[lw] += 1
    # 3회 이상 반복 & 소문자 명사류만
    cands = [(w, c) for w, c in freq.most_common(12) if c >= 3 and w not in stop and len(w) > 3]
    return [w for w, _ in cands[:2]]

def mark_passage(text, kb=None, key_concepts=None, gloss_max=8, answer_blank=True):
    if kb is None: kb = load_kb()
    gloss = dict(BASE_GLOSS); gloss.update(kb.get("glossary", {}))
    conn = CONNECTIVES + kb.get("connectives_extra", [])
    text = re.sub(r"\s+", " ", text).strip()

    # 1) 연결어(문두 우선, 긴 것부터)
    spans = []  # (start,end,markup)
    for phrase in sorted(conn, key=len, reverse=True):
        for m in re.finditer(r"(?<![A-Za-z])" + re.escape(phrase) + r"(?![A-Za-z])", text):
            spans.append((m.start(), m.end(), "co"))
    # 2) 구조어
    for phrase in sorted(STRUCTURE_WORDS, key=len, reverse=True):
        for m in re.finditer(r"(?<![A-Za-z])" + re.escape(phrase) + r"(?![A-Za-z])", text):
            spans.append((m.start(), m.end(), "cc"))
    # 겹침 제거(먼저 등록된 긴 span 우선)
    spans.sort(key=lambda s: (s[0], -(s[1]-s[0])))
    chosen = []; occupied = []
    for st, en, kind in spans:
        if any(not (en <= a or st >= b) for a, b in occupied): continue
        chosen.append((st, en, kind)); occupied.append((st, en))
    chosen.sort()

    # 3) 핵심개념 색쌍
    if key_concepts is None: key_concepts = detect_key_concepts(text, kb)
    concept_color = {}
    if len(key_concepts) >= 1: concept_color[key_concepts[0]] = "red"
    if len(key_concepts) >= 2: concept_color[key_concepts[1]] = "magenta"

    # 4) 글로스 대상(어려운 단어) 선정
    gloss_hits = []
    for m in re.finditer(r"\b[A-Za-z][A-Za-z\-]{5,}\b", text):
        lw = _wc(m.group(0))
        if lw in gloss and lw not in [g[0] for g in gloss_hits]:
            gloss_hits.append((lw, m.start(), m.end()))
    gloss_hits = gloss_hits[:gloss_max]
    gloss_spans = {st: (en, lw) for lw, st, en in gloss_hits}

    # 5) 조립: 문자 단위로 스캔하며 마크업 삽입
    out = []; i = 0; conn_map = {st: (en, kind) for st, en, kind in chosen}
    while i < len(text):
        if i in conn_map:
            en, kind = conn_map[i]; out.append(f"<<{text[i:en]}|{kind}>>"); i = en; continue
        if i in gloss_spans:
            en, lw = gloss_spans[i]; out.append(f"<<{text[i:en]}|g={gloss[lw]}>>"); i = en; continue
        # 핵심개념(소문자 단어 경계)
        m = re.match(r"[A-Za-z][A-Za-z\-]*", text[i:])
        if m:
            w = m.group(0); lw = w.lower()
            if lw in concept_color and (i == 0 or not text[i-1].isalpha()):
                out.append(f"<<{w}|hl={concept_color[lw]}>>"); i += len(w); continue
            out.append(w); i += len(w); continue
        out.append(text[i]); i += 1
    marked = "".join(out)

    # 6) 빈칸 표시 보존(원문에 ___ 있으면)
    marked = re.sub(r"_{3,}", "______________", marked)

    # 범례/각주 자동
    legend = [{"sw": "green", "label": "연결어"}]
    if "red" in concept_color.values(): legend.append({"sw": "red", "label": key_concepts[0]})
    if "magenta" in concept_color.values(): legend.append({"sw": "magenta", "label": key_concepts[1]})
    legend.append({"sw": "gold", "label": "구조어(역접·인과)"})
    footnotes = [f"{lw} {gloss[lw]}" for lw, _, _ in gloss_hits[:4]]

    return {"marked": marked, "key_concepts": key_concepts, "legend": legend, "footnotes": footnotes,
            "gloss_used": {lw: gloss[lw] for lw, _, _ in gloss_hits}}

def infer_flow(text):
    """문장 분할 → 역할 라벨/색 자동 부여(휴리스틱)."""
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z“\"])", re.sub(r"\s+", " ", text).strip())
    flow = []
    for n, s in enumerate(sents, 1):
        role, cl = ("도입·전개", "cyan") if n == 1 else ("전개", "blue")
        for pat, r, c, _ in ROLE_SIGNALS:
            if re.search(pat, s): role, cl = r, c; break
        if n == len(sents) and role == "전개": role, cl = "마무리", "gold"
        note = s if len(s) <= 90 else s[:88] + "…"
        flow.append({"n": n, "role": role, "cl": cl, "note": note})
    return flow

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    r = mark_passage(raw); r["flow"] = infer_flow(raw)
    print(json.dumps(r, ensure_ascii=False, indent=1))
