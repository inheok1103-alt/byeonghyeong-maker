# 출제의도 로직 DB — 지침 문서 (고1 영어 내신)

고1 내신 시험(구리·의정부·휘경 등) 분석에서 도출한 **출제의도 로직**을 코드화하고, 여러 무료 AI가 **서로 토론하며** 문항을 분류·생성하는 파이프라인의 설계 문서.

- **구조화 데이터**: `knowledge/intent_db.json` (스키마·로직 L01~L12·오답 E01~E20·예시 20항목·루브릭 6·생성프롬프트 6·드릴 12)
- **토론 하네스**: `selfllm/intent_harness.js` (제안 → 비평 → 합의)

---

## 1. 목표·산출물
| 산출물 | 위치 |
|---|---|
| 출제의도 로직 지침(본 문서) | `intent_logic.md` |
| 문항 메타데이터 스키마 + 예시 ≥20 | `intent_db.json` → `schema`, `items` |
| 오답 진단 코드북 E01~E20 | `intent_db.json` → `error_codes` |
| 서술형 루브릭 6유형 | `intent_db.json` → `essay_rubrics` |
| 유형별 생성 프롬프트 6종 | `intent_db.json` → `gen_prompts` |
| 수업용 드릴 12종 | `intent_db.json` → `drills` |
| 다중 API 토론 파이프라인 | `intent_harness.js` |

## 2. 방법론
내신 시험 이미지에서 학교·학년·출제년도·문항번호·배점·유형을 파악하고, OCR 불가 시 수작업 전사. 각 문항을 **유형(type_surface)·지문구조(text_structure)·핵심 출제의도(intent_core)·오답유도(trap_type)** 로 분류하고, **출제 로직(L코드)** 과 **흔한 오답 원인(E코드)** 을 부착한다. 예: 구리고 2023 1번 = "연결어" 유형, 문장관계(예시/추가/역접/결과) 판별 요구 → **L01**, 흔한 오답 **E05(관계 오판)·E01(예시-주장 혼동)**.

## 3. 출제 로직 L01~L12 (요지)
각 로직 = "무엇을(intent) / 어떤 신호로(signal) / 어떻게 검증(test)". 상세는 `intent_db.json`.

- **L01 연결어·문장관계** — 인접 명제의 방향(예시/추가/역접/결과/대조) 판별
- **L02 제목·압축** — 전체를 함축적으로 압축(과소·과대 배제)
- **L03 주제·요지** — 필자 주장 추출(예시를 주장으로 오인 금지)
- **L04 빈칸·핵심어구** — 주제문 핵심 복원(표면 반복어 낚시 배제)
- **L05 글의 순서** — 지시어·연결어·정관사로 유일 흐름 복원
- **L06 문장 삽입** — 대명사 근거 부재/급전환 지점 탐지
- **L07 무관 문장** — 주제 이탈 1문장 식별
- **L08 어법** — 수일치·시제·태·관계사·병렬·준동사
- **L09 어휘·문맥** — 문장 극성 대비 어휘 적합성
- **L10 함의·추론** — 표면 너머 필자 의도
- **L11 내용 일치/불일치** — 한정어·부정어·수치 대조
- **L12 요약·패러프레이즈** — 상위어·동의어 재진술(A/B)

## 4. 오답 진단 코드북 E01~E20
학생 오답을 **원인 코드**로 진단 → 대응 **드릴(D)** 연결. 대표 몇 개:

- **E01 예시-주장 혼동** → D02 · **E02 범위 왜곡** → D05 · **E03 단어 낚시** → D04
- **E05 연결어 관계 오판** → D01 · **E15 부정어 놓침** → D05 · **E17 역접 무시** → D07
- 전체 20종·원인·교정팁은 `intent_db.json` → `error_codes`.

## 5. 다중 API "토론" 파이프라인 (핵심)
여러 무료 API가 한 문항을 놓고 **토론**해 정확도를 끌어올린다:

```
① 제안(propose)   각 API가 독립적으로 분류/문항 초안 생성
② 비평(critique)  각 API가 '남들의 안'을 보고 오류 지적 + 자기 안 수정
③ 합의(synthesize) 심판 API가 검토된 안들을 최종 1개로 통합
```

- **기계형(순서·삽입·연결어·첫글자)**: 코드빌더가 정답 100% 보장 → 토론은 표현·해설만 보강(오프라인도 가능).
- **추론형·분류**: 온라인 토론(제공자 2개↑ 권장).

### 사용법
```bash
node selfllm/intent_harness.js --list                                  # DB 구성 보기
node selfllm/intent_harness.js --online --classify "문항 텍스트..."      # 토론 분류 → 메타데이터 JSON
node selfllm/intent_harness.js --online --generate 빈칸(어구) "지문..."  # 토론 생성 → 문항 JSON
```
키(환경변수): `GEMINI_KEY GROQ_KEY CEREBRAS_KEY MISTRAL_KEY OPENROUTER_KEY` — 2개 이상이면 실제 토론.

## 6. 메타데이터 스키마 (요지)
`exam_id · school · year · exam_name · item_no · score · type_surface · **logic_type(L)** · topic_domain · text_structure · intent_core · required_operation · evidence_location · **trap_type** · **common_wrong_reasons(E)** · **teaching_drill(D)** · generation_rule · sample_correct_answer · sample_student_wrong_answers`

## 7. 확장 방법
- 실제 기출 이미지 확보 시 `items`에 전사·분류 추가(스키마 준수).
- 하네스 `classify()`로 새 문항을 자동 분류 → `items`에 축적 → 데이터가 커질수록 로직 정밀도 상승.
- 생성물은 코드측 정답검증 통과분만 채택(퇴화 방지).

---
관련: `selfllm/neural_bundle.js`(분야별 신경다발) · `selfllm/evolve.js`(진화 엔진) · `knowledge/types_v2.json`(유형 DB)
