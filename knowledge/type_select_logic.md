# OP_TYPE_SELECT 유형 선택 로직 v1.0 (반영: ai_maker.html TSEL 블록)

단일 출제 유형 선택이 기본, 다문항은 토글. 지문 구조 신호로 유형을 REC(추천)/OK/DIS(부적합) 판정. 원문서: EXAMLOGIC OP_TYPE_SELECT LOGIC v1.0 (2026-07-07).

## 핵심 규칙
- TSEL-R01 기본 = 단일 유형 선택(라디오 동작). "다문항 모드" 토글 ON 시 다중 선택(R02), OFF 복귀 시 마지막 선택 유지(R03/R04).
- 판정 우선순위: DIS > REC > OK.
- DIS는 차단이 아니라 안내: 회색 표시 + 클릭 시 이유·해결 버튼(막다른 길 금지). 강행 시 경고 후 진행 + 검수 플래그(R22).
- REC 기본값(추천 유형 전무 시): 요지·주제·제목 (R21).

## 구조 신호 → DIS 규칙 (코드 스캔, LLM 불필요)
| 신호 | DIS 유형(이름 패턴) | 해결 |
|---|---|---|
| 단어수 < 120 | 순서·삽입·무관 | 📈 지문 늘리기(OP_EXTEND) |
| 수치·도표 없음 | 도표·계산 | — |
| 문법 포인트 부족 | 어법 | 🔄 구문 변형(②) |
| 대조 구조 아님 | 대비·대조 | — |
| 서사·감정 어휘 없음 | 심경·분위기·일화 | — |
| 실용문 형식 아님 | 안내문·실용·목적 | — |

## 신호 기반 추가 REC (휴리스틱)
- 대조 표지(however/in contrast/whereas…) 존재 → 요약·빈칸 추천
- 서사 신호(felt/smiled/heart sank…) 존재 → 심경·함의 추천

## TS(지문구조)→유형 결정 테이블 (원문서 PART 7, TS 분류기 연결 시 사용)
```json
{"ts_recommend":{"TS01":["MC_CLAIM","MC_MAIN_IDEA","MC_TITLE"],"TS02":["MC_TITLE","MC_MAIN_IDEA","MC_BLANK"],"TS03":["MC_TOPIC","MC_TITLE","SR_SUMMARY"],"TS04":["MC_BLANK","MC_ORDER","SR_STRUCTURE"],"TS05":["SR_CONTRAST","MC_SUMMARY","MC_TITLE"],"TS06":["MC_MAIN_IDEA","MC_BLANK"],"TS07":["MC_VOCAB","MC_TITLE","SR_CONTRAST"],"TS08":["MC_TOPIC","MC_VOCAB"],"TS09":["MC_ORDER","MC_INSERTION"],"TS10":["MC_BLANK","MC_MATCH","MC_SUMMARY"],"TS11":["MC_BLANK","MC_MAIN_IDEA"],"TS12":["MC_INSERTION","MC_BLANK","MC_TITLE"],"TS13":["MC_BLANK","MC_TOPIC"],"TS14":["MC_MOOD","SR_COMMENTARY"]},
"ts_disable":{"TS08":["MC_ORDER"],"TS14":["MC_GRAMMAR","MC_CHART","SR_CALCULATION"]},
"signal_disable_rules":{"wordcount_lt_120":["MC_ORDER","MC_INSERTION","MC_IRRELEVANT"],"no_numeric":["MC_CHART","SR_CALCULATION"],"grammar_points_lt_5":["MC_GRAMMAR"],"not_contrast":["SR_CONTRAST"],"no_narrative":["MC_MOOD","SR_COMMENTARY"],"not_practical":["MC_PRACTICAL","MC_PURPOSE"]},
"fallback":{"no_ts":"apply_signal_rules_only","no_rec":["MC_MAIN_IDEA","MC_TOPIC","MC_TITLE"],"forced_dis":"warn_then_proceed_and_force_hitl"}}
```

## ST코드 ↔ 우리 유형명 매핑(패턴)
MC_ORDER=순서 · MC_INSERTION=삽입 · MC_IRRELEVANT=무관 · MC_GRAMMAR=어법 · MC_VOCAB=어휘 · MC_BLANK=빈칸 · MC_TITLE=제목 · MC_TOPIC=주제 · MC_MAIN_IDEA=요지 · MC_CLAIM=주장 · MC_SUMMARY/SR_SUMMARY=요약 · MC_MOOD=심경/분위기 · MC_CHART=도표 · MC_MATCH/MISMATCH=내용일치/불일치 · MC_PRACTICAL=안내문/실용 · MC_PURPOSE=목적 · SR_CONTRAST=대비/대조 · SR_CALCULATION=계산 · SR_COMMENTARY=일화/commentary · SR_*=서술형 계열

## UI 구현 위치
- ai_maker.html: `TSEL` 블록(tselSignals/tselJudge/tselUpdate/tselShowDis/tselForce/tselChipChange), #recRow(🎯 이 지문 추천), #disHelp, "다문항 모드" 토글(#multiTypes), `.types label.dis` 스타일.
- 갱신 훅: workCount()·onPassage()·buildTypeChips() 끝에서 tselUpdate().
