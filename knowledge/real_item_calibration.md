# 실전기출 보정 출제로직 (Extractable Real-Calibrated Production Logic)

근거: Ray_Drill 정확추출 비교리포트(2026-07-09, 수용 385파일·8357 문항블록) + 보정출제로직 v12. 원칙: **커버리지(만들 수 있나) ≠ 빈도(얼마나 실어야 하나)**. 가상 전유형 시뮬은 '능력 리허설'일 뿐, 최종 분포·밀도·표식빈도는 실전 추출 코퍼스로 보정한다.

## 0. 잠금 베이스라인(측정치, 문항쿼터 아님 — '압력')
| 지표 | 실물 | 시뮬 | 함의 |
|---|---|---|---|
| 표식조작 비율 | **0.924** | 0.467 | 실전 92% 문항이 '공통지문 안'에 표식조작. 표식형 공급을 시뮬보다 훨씬 늘려라 |
| 서술형 신호율 | **0.468** | 0.267 | 서술형 압력 상향. answer-first 생성 필수 |
| 정답위치 최대점유 | — | 0.636 | 시뮬 분포를 실전분포로 쓰지 마라. 조립단계에서 균등 배정 |

## 1. 타입 압력 티어 ↔ 엔진 유형 매핑
| Tier | 실전 타입 | 엔진 유형 | 빌더 | 표식형 | 현 상태(2026-07-09 배치검증) |
|---|---|---|---|---|---|
| **A** | contextual_vocabulary | 어휘(밑줄) | buildVocab | ✔ | OK(문맥치환·문장분산) |
| **A** | blank_logic | 빈칸(어구/문장) | buildBlank | ✔(____) | OK(담화논리) |
| **A** | grammar_underlined | 어법(밑줄) | buildGrammar | ✔(ⓐ~ⓔ) | OK(최소단위·문법검사·_gram) |
| B | implied_meaning | 밑줄함의 | buildImplication | ✔(<u>) | OK |
| B | subjective_topic_sentence | 주제문완성 | buildEssay | — | OK(+루브릭) |
| B | paragraph_order | 글의순서 | buildOrder | ✔(A/B/C) | OK |
| B | main_idea | 요지 | buildInference | — | OK |
| B | detail_true_false | 내용일치 | buildFactCheck | — | OK(통제생성) |
| B | irrelevant_sentence | 무관문장 | buildIrrelevant | ✔(①~⑤) | OK |
| C | title | 제목 | buildInference | — | OK(대문자) |
| C | summary_completion | 요약문AB | buildSummary | ✔(A/B빈칸) | 수정완료(발문 QC노트 누출 제거) |
| C | interview_subjective | (인터뷰 서술형) | buildEssay | — | 전달형식일 뿐 별도 스킬 아님 |
| C | grammar_correction_subjective | 어법수정 | buildGrammarEdit | ✔ | 수정완료(buildGrammar 재사용, 오교정 근절) |
| C | sentence_insertion | 문장삽입 | buildInsertion | ✔(①~⑤) | OK(공통지문 내 표식) |
| **D** | all_sentence_order | 전체문장배열 | buildOrderAll | ✔ | OK(고변별, 남용금지) |

## 2. 공급 대역(대량 문제은행) & 세트 조립
- **은행 공급 비중**: Tier A 35–45% · Tier B 35–45% · Tier C 15–25% · Tier D 0–5%. (세트당 쿼터 아님, 은행 공급 밴드)
- **세트 조립**: 설정된 문항수 프로파일을 먼저 보존 → Tier A 복수 클러스터, Tier B 복수 클러스터, Tier C 1~2 클러스터, Tier D 선택. 표식조작 빈번하되 '무거운 지문조작 표식형 2개 연속' 금지. 서술형은 프로파일대로, 단 약한 프롬프트 피하려 변형 충분히 확보.

## 3. 표식조작(marked-operation) 보정 — 실물 0.924
표식형 = blank_marked·underlined·order_marked·irrelevant_numbered·insertion_marked·order_all_sentences.
- 표식은 반드시 **공통지문 안**에 보여야(밑줄/번호/____/ⓐ~ⓔ).
- 발문 본문에 choices·조건·정답란·주어진문장은 OK, **두 번째 완전지문 금지**.
- 표식 클러스터가 이웃 문항에 정답 누출 금지. 무거운 표식 2개 연속 배치 금지.

## 4. 서술형 보정 — answer-first(코드 순서 강제)
1) 모범답안 먼저 작성 → 2) **최종답에서 정확 단어수 산출**(추측 금지) → 3) 한국어뜻 제공여부 결정 → 4) 미제공 시 힌트강화 → 5) 필수어가 주제와 겹치면 다른 단서 → 6) **채점 루브릭 부착**(essayRubric: 내용40·형식35·어법철자25 + 0점트리거). 통사변형-only 서술형을 기본값으로 삼지 마라.

## 5. 어법·어휘 로직
- 어법: 물어보는 **slot(자리/결합가/경제성/정보보존)** 선언. 오답 = position/economy/data-preservation 실패. 로직 제시 후 한국 교육과정 용어로 매핑.
- 어휘: 문맥치환·대조·연어·범위·어조·지시 제약. **사전식 meta 선지 금지.** 선지 길이·문법역할 유사, 오답은 분명한 이유로 매력적.

## 6. 선지·정답 로직 §7 → **엔진 구현: rebalanceAnswers()**
- 정답위치는 **조립 시 배정**(가상 리허설 분포 사용 금지). 위치편중·**동일위치 3연속 차단**. → `api_team.js:rebalanceAnswers`가 generateExam 조립 후 텍스트선지형만 스왑 배정(위치표식형 제외).
- 선지 길이 균질, 오답은 범위·인과·논리·어조·지시·문법slot로 차별.

## 7. Export 차단 조건 §10 (자동 게이트 대상)
① 유형빈도를 시뮬에서 복사 ② 표식이 공통지문 밖 ③ 서술형 단어수 추측 ④ 어휘 선지 사전식 ⑤ 어법 메타 없음 ⑥ 지문맵 누락 ⑦ 레이아웃 밀집·지문 반복. — 하나라도 참이면 export 차단.

## 8. 뇌 연동
이 보정표를 연구층에 편입 → server_brain이 세트 조립 시 티어 밴드·표식빈도·서술형비중을 참조, 측정하네스(addon_psychometric)가 Export 차단 §10을 문항 게이트로 실행. 실패 패턴은 logic_evolve로 환류.
