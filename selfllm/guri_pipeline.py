# -*- coding: utf-8 -*-
"""guri_pipeline.py — 구리여고 자료 총정리 하네스 (교과서/모의고사 이원 트랙)
어떤 자료를 언제 쓰는지(수업 사이클)를 로직으로 굳히고, 단계별 산출을 자동화한다.

명령:
  python guri_pipeline.py inventory                  # 전체 자료 현황
  python guri_pipeline.py plan textbook <과>         # 교과서 수업 사이클 플랜(파일 경로 포함)
  python guri_pipeline.py plan mock <연도> <월>      # 학평 대비 사이클 플랜
  python guri_pipeline.py make textbook <과> <섹션#> <유형>   # 지문 추출→제작기(판서+학생용)
  python guri_pipeline.py make mock <연도> <월>      # 해당 회차 최적 소스 안내+추출 준비
"""
import sys, io, os, re, json, glob, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.expanduser(r"~/Downloads/구리여고")
MOCK = os.path.join(BASE, "모의고사")
OUT  = os.path.join(BASE, "_RAY제작물")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ══════════════════════════════════════════════════════════════
# 트랙 1 · 교과서(내신) — 수업 사이클: 예습→본수업→연습→적용→직전
# ══════════════════════════════════════════════════════════════
TEXTBOOK_CYCLE = [
 ("1. 예습(수업 전)",   "00_본문(원문)",          "본문 원문 지문 — RAY 제작기의 입력 소스이기도 함"),
 ("1. 예습(수업 전)",   "03_단어시험",            "과별 WORD TEST — 수업 전 단어 선행 암기·주간 단어시험"),
 ("2. 본수업(판서)",    "_RAY제작물",             "★우리 시스템 산출: 판서 PPT(hook→문제→분석→직독직해→흐름→정답)"),
 ("2. 본수업(참고)",    "01_내용정리(분석)",       "출판사 분석자료 — 페이블 보강 내용과 대조·보완용 교사 참고"),
 ("3. 연습(숙제)",      "04_워크북_10단계/단계별", "1해석지→2·3빈칸→4해석→5동사형→6어법선택→7어색한곳→8순서→9영작→10Check 순서로 주차별 숙제"),
 ("3. 연습(복습)",      "_RAY제작물",             "★학생용 인쇄본(문제면+해설면) — 수업 복습 과제"),
 ("4. 적용(시험 2주전)","05_예상문제_학생용",      "예상문제 1~4회 실전 풀이(학생 배부)"),
 ("4. 적용(채점)",      "06_예상문제_교사용",      "교사용 정답지로 채점·해설"),
 ("5. 직전(시험 1주전)","02_어법_GrammarBuildUp", "과별 어법 총정리 — 어법 변형 출제 소스 + 직전 정리"),
 ("5. 직전(마무리)",    "04_워크북_10단계/통합본", "10단계 통합본 1회독으로 본문 최종 점검"),
]

# ══════════════════════════════════════════════════════════════
# 트랙 2 · 모의고사(학평) — 대비 사이클: 기출→분석→변형→어휘→직전
# ══════════════════════════════════════════════════════════════
MOCK_CYCLE = [
 ("1. 기출 실전",      ["01_변형문제_문제만", "00_변형문제_해설포함"], "기출·변형 문제 풀이(문제만→채점은 해설포함판). 2022+는 02_예상문제가 실전 대체"),
 ("2. 정밀 분석",      ["03_지문분석", "아잉카/상세분석"],            "★수업의 중심 — 문항별 구문·해석 분석. RAY 판서 덱 제작의 근거 소스"),
 ("2. 본수업(판서)",   ["_RAY제작물"],                                "★우리 시스템 산출: 회차·문항별 판서 덱(원문은 예상문제 통합본에서 추출)"),
 ("3. 변형 대비",      ["아잉카/변형문제", "02_예상문제"],            "변형문제 세트(학생용 hwp/pdf)·예상문제 통합본 — 내신형 재출제 대비"),
 ("4. 어휘 정리",      ["05_단어장", "아잉카/어휘List", "아잉카/동반의어"], "단어장 1~4단계 → 어휘List → 동반의어(고급). 주간 어휘시험 소스"),
 ("5. 반복 훈련",      ["06_워크북", "아잉카/워크북"],                "6~10단계 워크북 — 지문 체화(해석→빈칸→영작)"),
 ("6. 직전 보강",      ["아잉카/직전보강", "04_파이널체크"],          "시험 직전 어법·어휘 총정리 + FINAL CHECK(T·F)"),
]

def _count(p):
    return sum(len(fs) for _, _, fs in os.walk(p)) if os.path.isdir(p) else 0

def _find(folder, *pats, track="auto"):
    """폴더(하위 포함)에서 패턴 전부를 포함하는 파일 검색. track: textbook|mock|auto(양쪽 시도)."""
    roots = []
    if track in ("textbook", "auto"): roots.append(os.path.join(BASE, folder))
    if track in ("mock", "auto"): roots.append(os.path.join(MOCK, folder))
    hits = []
    for root in roots:
        if not os.path.isdir(root): continue
        for r, _, fs in os.walk(root):
            for f in fs:
                if all(re.search(p, f) for p in pats): hits.append(os.path.join(r, f))
    return sorted(hits)

def inventory():
    print("═" * 62)
    print(" 구리여고 자료 인벤토리")
    print("═" * 62)
    print("\n▌트랙 1 · 교과서(공통영어2 · NE능률 오선영) — 내신")
    for d in ["00_본문(원문)", "01_내용정리(분석)", "02_어법_GrammarBuildUp", "03_단어시험",
              "04_워크북_10단계", "05_예상문제_학생용", "06_예상문제_교사용"]:
        print(f"   {d:26} {_count(os.path.join(BASE,d)):>4}개")
    print(f"   {'_RAY제작물(시스템 산출)':24} {_count(OUT):>4}개")
    print("\n▌트랙 2 · 모의고사(고1 학평 2009~2026)")
    for d in ["00_변형문제_해설포함", "01_변형문제_문제만", "02_예상문제", "03_지문분석",
              "04_파이널체크", "05_단어장", "06_워크북"]:
        print(f"   {d:26} {_count(os.path.join(MOCK,d)):>4}개")
    ay = os.path.join(MOCK, "아잉카")
    print(f"   아잉카/                    {_count(ay):>4}개")
    for s in sorted(os.listdir(ay)) if os.path.isdir(ay) else []:
        if os.path.isdir(os.path.join(ay, s)):
            print(f"      └ {s:20} {_count(os.path.join(ay,s)):>4}개")

def plan_textbook(lesson):
    print("═" * 62)
    print(f" 교과서 {lesson}과 수업 사이클 플랜 (내신 트랙)")
    print("═" * 62)
    pat = f"_{lesson}과_"
    for stage, folder, desc in TEXTBOOK_CYCLE:
        print(f"\n▌{stage} — {folder}")
        print(f"   용도: {desc}")
        if folder == "_RAY제작물":
            hits = sorted(glob.glob(os.path.join(OUT, f"교과서_{lesson}과_*")))
            for h in hits[:4]: print(f"   · {os.path.basename(h)}")
            if not hits: print(f"   · (미제작 — make textbook {lesson} <섹션#> <유형> 으로 생성)")
        else:
            hits = _find(folder, re.escape(pat))
            for h in hits[:5]: print(f"   · {os.path.basename(h)}")
            if not hits: print("   · (해당 과 파일 없음)")
    print("\n▶ 제작 명령: python guri_pipeline.py make textbook", lesson, "<섹션#> <제목|주제|빈칸|어법>")

def plan_mock(year, month):
    print("═" * 62)
    print(f" 모의고사 {year}년 {month}월 학평 대비 플랜 (수능형 트랙)")
    print("═" * 62)
    mm = month.zfill(2)
    pats = [rf"{year}년.*{int(month)}월|{year}년.*{mm}월|{mm}월.*{year}년|{year}년_{mm}월"]
    for stage, folders, desc in MOCK_CYCLE:
        print(f"\n▌{stage}")
        print(f"   용도: {desc}")
        shown = 0
        for folder in folders:
            if folder == "_RAY제작물":
                hits = sorted(glob.glob(os.path.join(OUT, f"모의고사_{year}*{month}월*")))
            else:
                root = os.path.join(MOCK, folder)
                hits = []
                for r, _, fs in os.walk(root):
                    for f in fs:
                        if re.search(pats[0], f): hits.append(os.path.join(r, f))
            for h in sorted(hits)[:3]:
                print(f"   · [{folder}] {os.path.basename(h)[:58]}")
                shown += 1
        if not shown: print("   · (해당 회차 자료 없음)")
    print(f"\n▶ 지문 추출 소스 우선순위: 02_예상문제 통합본(깨끗한 원문) → 03_지문분석(구문 섞임 주의)")
    print(f"▶ 제작 명령: python guri_pipeline.py make mock {year} {month}")

def make_textbook(lesson, sec, qtype):
    src = json.load(io.open(os.path.join(BASE, "_추출_전체.json"), encoding="utf-8"))
    sections = src.get(str(lesson), {}).get("sections", [])
    if not (1 <= int(sec) <= len(sections)):
        print(f"섹션 범위 오류: {lesson}과는 1~{len(sections)}"); return
    s = sections[int(sec)-1]
    print(f"지문: {lesson}과 S{sec} · {s['head'][:40]} · {s['chars']}자 · 유형={qtype}")
    base = f"guri_L{lesson}_S{sec}"
    r = subprocess.run([sys.executable, os.path.join(HERE, "ray_studio.py"), "text", s["text"], qtype, base],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((r.stdout or "")[-500:])
    print("※ 무료 초안 완료. 어법·어휘·빈칸은 페이블 검수 후 확정 권장(이 챗에서 '검수해').")

def make_mock(year, month):
    mm = str(int(month))
    # 최적 소스: 예상문제 통합본(문제+정답) → 지문분석
    cands = _find("02_예상문제", rf"{year}년", rf"{mm}월", r"문제\+정답\)", track="mock")
    if not cands: cands = _find("02_예상문제", rf"{year}년", rf"{mm}월", track="mock")
    ana = _find("03_지문분석", rf"{year}년", rf"{mm}월", track="mock")
    print(f"회차: {year}년 {mm}월 학평")
    print("  원문 소스(우선):", os.path.basename(cands[0]) if cands else "없음")
    print("  분석 소스(근거):", os.path.basename(ana[0]) if ana else "없음")
    if not cands and not ana:
        print("  → 해당 회차 자료가 없습니다. inventory로 보유 회차 확인.")
        return
    print("\n▶ 다음 단계(권장 흐름):")
    print("   1) 예상문제 통합본에서 문항 지문 추출(변형오류 원문 복원 필요 — 페이블)")
    print("   2) ray_studio 유형별 제작 → 페이블 보강(직독직해) → GPT 교차검수")
    print("   3) 판서 PPT + 학생용 → _RAY제작물/")
    print("   ※ 이 챗에서 '{}년 {}월 NN번 만들어줘'라고 하면 전 과정을 실행합니다.".format(year, mm))

if __name__ == "__main__":
    a = sys.argv[1:] or ["inventory"]
    c = a[0]
    if c == "inventory": inventory()
    elif c == "plan" and len(a) >= 3 and a[1] == "textbook": plan_textbook(a[2])
    elif c == "plan" and len(a) >= 4 and a[1] == "mock": plan_mock(a[2], a[3])
    elif c == "make" and len(a) >= 5 and a[1] == "textbook": make_textbook(a[2], a[3], a[4])
    elif c == "make" and len(a) >= 4 and a[1] == "mock": make_mock(a[2], a[3])
    else: print(__doc__)
