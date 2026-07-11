# 게이트 커버리지 매트릭스 (Codex ⑤: format-only → 의미·언어·평가·변형·렌더)

Codex 판정은 "포맷 검사만 있고 의미/평가 검사가 없다"였음. 아래는 현재 파이프라인이 5개 게이트 범주를 어떻게 충족하는지의 대응표.
파이프라인 순서(addon_key_guard.js `guardItem`): hygiene → codeGate → uniquenessGate → **transformGate** → solverGate, 그 위에 psychometric(addon_psychometric.js)·rxFeedback·provenance.

| Codex 범주 | 목적 | 구현 게이트 | 위치 | 판정 |
|---|---|---|---|---|
| **언어(linguistic)** | 문법성·오류어 실존·위치 정합 | `codeGate`(어법 오류어 지문 실존+밑줄 위치 검증, 어휘 변조 정확히 1곳), `grammar()`=LanguageTool, `nonError`/`invertedPair`(허위 오류 배제) | addon_key_guard.js:25, api_team.js `buildGrammar` | ✅ |
| **의미(semantic)** | 복수정답 차단·근접 패러프레이즈·정답 유일성 | `uniquenessGate`(양방향 토큰중복 임계, 명사구형 완화), `designChoiceSet`(추상화·오답 DNA), `flagEquivalents`(양방향 동치 제거) | addon_key_guard.js:78, api_team.js | ✅ |
| **평가(assessment)** | 정답키 교차검증·변별도·난이도·형태단서 | `solverGate`(블라인드 솔버 2~3표 다수결), `PSY.panel`(능력계층 솔버 변별도·오답효율), `formCue`(길이·완결성 단서 양방향), `leakTest` | addon_key_guard.js:51, addon_psychometric.js | ✅ |
| **변형(transformation)** | 원문 온전 변형·정보손실/잘림 차단(보존 마스크) | `transformGate`(전체지문형 subset·truncation 차단: <50% drop, <72% flag; 순서·삽입·요약 면제), `provenanceOf`(원문/변형 전체지문·wordCount 보존) | addon_key_guard.js:97, api_team.js `provenanceOf` | ✅ (신규) |
| **렌더(render)** | 표식·태그·플레이스홀더 무결성 | `hygiene`(플레이스홀더 선지·무효 정답번호 차단), 태그 위생 `_tg`(이스케이프 복원·이물문자 제거), `markerSpans`(마커 위치 결박 검증) | addon_key_guard.js:97, api_team.js generateOne:2478 | ✅ |

## 판정
- 5개 범주 모두 실행 게이트로 커버됨. "포맷 전용"이 아니라 의미(복수정답)·평가(솔버·심리측정)·변형(잘림)·언어(오류어 실존)·렌더(위생)까지 코드 결정론+LLM 다수결로 검증.
- 신규(이번 라운드): **transformGate** — Codex `source_passage_truncated_or_subset_only`(15건) 직접 대응. 전체지문형이 원문의 부분집합으로 잘리면 폐기.
- 각 문항은 `_prov`(sourceId·variantId·전체지문·choiceMeta 위치결박)를 부착 → 사후 추적·재검증 가능.

## 남은 한계(정직한 기록)
- 변형 보존은 **길이 비율 휴리스틱**이지 명제 단위 보존 마스크는 아님. 명제 그래프(Codex의 canonical passage graph) 전면 도입 시 명제별 preservation mask로 격상 예정.
- solverGate·psychometric은 LLM 솔버 품질에 의존 → 저성능 폴백(pollinations) 시 판정 신뢰도 하락. 데이터계약 local-only 모드에서는 코드 결정론 게이트(codeGate/uniqueness/transform/hygiene)만으로 방어.
