# RAY 올인원 제작기 — 시스템 지도 (로직·파이프라인·하네스)

> 지문 하나 → 뇌(무료 API) 분석 → 판서 수업PPT + 학생용까지 **순서대로 자동**.
> **추가비용 0** 원칙(유료 Claude API는 옵트인 OFF가 기본). 로컬↔GitHub↔Google↔GPT 상호작용.

## 한 줄 사용
```
python ray.py make "<영어 지문>"     # 올인원 자동제작
python ray.py brain loop            # 24시간 뇌 상주(토큰 배분·학습·수면)
python ray.py status                # 전체 상태
```

## 파이프라인 (지문 → 결과, 순서대로)
```
[지문 입력]
   │
   ▼  ray_studio.py (오케스트레이터)
1. 교훈 주입   ─ ray_escalate.lessons_preamble() : 지난 실패 교훈을 프롬프트에 반영(품질↑)
2. 뇌 분석     ─ ray_llm.ask_json() : ray-proxy→pollinations(무료) 로 주제·hook·흐름·문항·정답 생성
      └(실패 시) 에스컬레이션 사다리 ↓
3. 마크업 조립 ─ auto_markup.mark_passage() : 연결어(초록)·핵심어·뜻풀이·구조어 자동 색칠
4. 지식 축적   ─ brain_knowledge.json 에 뇌가 준 뜻풀이·연결어 저장(매번 똑똑해짐)
5. 렌더        ─ board_highlight_pptx.py(판서 PPT) + student_handout_html.py(학생용 A4)
   │
   ▼
[판서 수업PPT + 학생용 인쇄본]  →  Downloads\수능특강\_RAY수업보드\
```

## 에스컬레이션 하네스 (자가해결 → 도움요청)  · ray_escalate.py
```
① 로컬 제작기 자가해결
     └실패→ ② Claude 계층(역할별: Fable5 관리 / Opus 추론 / Sonnet 초안 / Haiku 고속)   ※유료→기본 OFF
              └실패/OFF→ ③ GPT 하청(pollinations gpt-oss, 무료)
                          └실패→ ④ 관리자(세션 중 Claude=나) _manager_inbox.jsonl 로 보고
매 단계 '교훈' 기록 → brain_lessons.jsonl → 다음 실행 프롬프트에 자동 반영(지속 향상)
```

## 24시간 뇌 (토큰 배분·실시간·수면)  · brain_daemon.py
- **토큰 배분**: 하루 8만 토큰을 24h 균등 페이싱 → 어느 시각도 고갈 없이 항상 살아있음(Groq 10만 함정 회피)
- **실시간**: 큐(_brain_queue.jsonl / 구글 gas queue) 폴링, 요청 오면 즉시 생성
- **품질향상**: 유휴 시 '학습'(빈출 어휘·팁을 뇌에 물어 지식 축적)
- **매일 수면(새벽 4시)**: 지식 정리 — 중복·오류·빈 기억 삭제, 상한 초과분 삭제(용량↓), 압축 저장 → brain_sleep_log.txt

## 상호작용 (로컬 ↔ GitHub ↔ Google ↔ GPT)
- **로컬↔GitHub**: brain_daemon.sync_github() — 지식/수면/상태를 커밋([skip ci]). 저장소 byeonghyeong-maker.
- **로컬↔Google**: gas_bridge.gs(오류로그·요청큐 → 구글시트). config.json logUrl 설정 시 활성.
- **로컬↔GPT**: ray_collab.py — GPT의 FINAL 폴더(검수보고서·PPTX) 스캔→교차검증→_handoff\reconcile.md.
  · 교차검증 실적: 문제선정·검정보드 스타일·어법 정답(copy→copying) **양측 독립 수렴 = 신뢰 확보**.
- **역할 분담**: 로컬=자동·24/7 · GPT=심층 QA·연구 · Claude=조정·최종판단.

## 모듈 지도  (Desktop\변형문제생성기\web\selfllm\)
| 파일 | 역할 |
|---|---|
| `ray.py` | 마스터 CLI(전 기능 단일 진입) |
| `ray_studio.py` | 올인원 오케스트레이터(지문→PPT+학생용) |
| `ray_llm.py` | 무료 뇌 커넥터(ray-proxy→pollinations) |
| `auto_markup.py` | 오프라인 자동 마크업(연결어·핵심어·뜻풀이) |
| `brain_daemon.py` | 24h 뇌(토큰배분·학습·수면) |
| `ray_escalate.py` | 3계층 에스컬레이션 + 교훈 학습 |
| `claude_router.py` | Claude 역할별 모델 라우팅(비용가드 OFF 기본) |
| `ray_collab.py` | GPT 협업·교차검증 채널 |
| `board_highlight_pptx.py` | 판서(검정·하이라이트) 수업 PPT 엔진 |
| `student_handout_html.py` | 학생용 인쇄본(흰 A4) |
| `lesson_ppt_pipeline.py` | 발췌·렌더·PDF·배치 하네스 |

## 비용 원칙
- 기본 경로 전부 **무료**(ray-proxy 서버측 무료티어 / pollinations 무키 / groq·gemini 무료).
- 유료 Claude API는 `RAY_ALLOW_PAID=1` + 키가 있을 때만. **미설정 시 추가비용 0.**
