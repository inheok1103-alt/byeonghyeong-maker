# Ray's Drill 어법·어휘·서술형 심화 출제 로직

작성일: 2026-07-08  
목적: Ray's Drill 문제은행에서 특히 품질 편차가 크게 발생하는 `어법`, `어휘`, `서술형` 문항을 안정적으로 생성·검수하기 위한 심화 규격  
적용 대상: 고1 영어 내신 대비 문제은행, Ray's 동형모고, 정답해설지, GitHub 하네스

---

## 0. 이 문서의 핵심

어법, 어휘, 서술형은 영어 내신에서 변별력이 크지만 동시에 오류가 가장 많이 생기는 영역이다.

문제가 생기는 이유는 다음과 같다.

- 어법은 답이 둘 이상 가능해지기 쉽다.
- 어휘는 단어장 암기형으로 흐르기 쉽다.
- 서술형은 힌트가 부족하면 학생이 실제로 쓸 수 없다.
- 조건부 영작은 단어 수가 틀리기 쉽다.
- 선지가 이상하면 문항 전체가 무너진다.
- 해설이 약하면 학생이 왜 틀렸는지 알 수 없다.

따라서 이 문서는 세 영역을 다음 방식으로 고정한다.

```text
어법: 문장 구조와 문맥 속 언어형식을 측정한다.
어휘: 사전 뜻이 아니라 문맥상 의미·결합·논리 기능을 측정한다.
서술형: 모범답안에서 조건을 역산하고 채점 기준까지 함께 설계한다.
```

---

## 1. 연구 반영 원칙

### 1.1 학생평가 관점

문항은 성취기준과 평가 목표에 맞아야 한다.  
단순히 어려운 문장을 고르는 것이 아니라, 어떤 능력을 평가하려는지 먼저 정해야 한다.

이 문서에서 세 영역의 평가 목표는 다음과 같다.

| 영역 | 평가 목표 |
|---|---|
| 어법 | 문장 구조, 수식 관계, 절 구조, 문맥상 형태 선택 능력 |
| 어휘 | 문맥상 의미, collocation, 논리 기능, 의미장 구분 능력 |
| 서술형 | 지문 이해를 바탕으로 제한 조건 안에서 의미 있는 영어 문장을 구성하는 능력 |

### 1.2 선택형 문항 제작 관점

객관식 문항은 반드시 하나의 최선답을 가져야 한다.  
오답은 틀렸지만 그럴듯해야 한다.

어법·어휘 선지에서 특히 지켜야 할 점:

- 모든 선택지가 문법적으로 발문과 맞아야 한다.
- 정답만 길거나 구체적이면 안 된다.
- 오답은 실제 학생이 할 법한 오류를 반영해야 한다.
- `all of the above`, `none of the above`, `둘 다 가능`식 선택지는 피한다.
- 선지끼리 의미 범주가 겹쳐 두 개가 답처럼 보이면 안 된다.

### 1.3 서·논술형 평가 관점

서술형은 발문, 자료, 조건, 채점기준이 함께 있어야 안정적이다.

서술형에서 특히 지켜야 할 점:

- 학생이 써야 할 답의 내용과 범위를 발문/조건에서 명확히 제시한다.
- 조건이 너무 적으면 답이 불가능해지고, 너무 많으면 혼란을 준다.
- 조건에 들어간 제약은 채점기준에도 반영한다.
- 채점 요소, 배점, 부분점 기준이 있어야 한다.
- 모범답안과 허용답안을 함께 준비한다.

---

## 2. 어법 출제 로직 총론

### 2.1 어법 문항의 정의

Ray's Drill에서 어법 문항은 “문법 지식 암기”가 아니라 다음을 평가한다.

```text
문장 구조를 파악하고,
문맥 속에서 필요한 형태를 선택하며,
왜 그 형태가 맞는지 설명할 수 있는 능력
```

### 2.2 좋은 어법 문항의 조건

좋은 어법 문항은 다음 조건을 만족한다.

- 정답 근거가 문장 안에 명확하다.
- 고1 수준에서 설명 가능하다.
- 문맥이 판단에 기여한다.
- 답이 하나뿐이다.
- 해설이 구조 분석으로 가능하다.
- 단순 암기보다 문장 해석이 필요하다.

### 2.3 나쁜 어법 문항

다음은 제거 또는 재작성 대상이다.

- 원어민도 판단이 갈릴 표현
- 두 형태가 모두 가능한 문장
- 문맥 없이 문법 공식만으로 맞히는 문제
- 지문 의미를 훼손한 오류 삽입
- 너무 대학 문법적인 함정
- 해설이 “관용적으로 그렇다”에 머무는 문제
- 선택지 중 하나만 문법적으로 어색해서 바로 보이는 문제

---

## 3. 어법 포인트 분류 체계

### 3.1 1군: 고1 내신 핵심 어법

가장 우선적으로 출제한다.

| 포인트 | 측정 내용 | 대표 오류 |
|---|---|---|
| 수일치 | 주어와 동사의 수 일치 | The effects is |
| 시제 | 시간 관계와 동사 형태 | has happened vs happened |
| 태 | 능동/수동 의미 관계 | is shaped vs shapes |
| 준동사 | to부정사/동명사/분사 | allow them create |
| 관계사 | 선행사와 절 기능 | which vs where |
| 분사 | 능동/수동 수식 | surprising/surprised |
| 병렬 | 같은 구조의 반복 | to read and writing |
| 접속사/전치사 | 절/구 연결 | because vs because of |
| 명사절 | that/what/whether | what he said vs that he said |
| 비교 | than/as, 비교 대상 | more better |

### 3.2 2군: 변별용 어법

상위권 변별에 사용하되 과도하게 쓰지 않는다.

| 포인트 | 사용 조건 |
|---|---|
| 도치 | 부정어/장소구 도치가 명확할 때 |
| 가정법 | 시제 대비가 명확할 때 |
| 강조구문 | it-that 구조가 선명할 때 |
| 삽입절 | 주어-동사 거리 조절이 필요할 때 |
| 동격 | 명사와 that절 관계가 명확할 때 |
| 복합관계사 | 문맥상 의미가 명확할 때 |

### 3.3 금지 또는 주의 포인트

다음은 일반 고1 내신 문제은행에서 남발하지 않는다.

- 미세한 관사 차이
- 원어민 직관에 의존하는 전치사
- 방언/문체 차이
- 지나치게 복잡한 가정법 혼합
- 사전상 둘 다 가능한 동사 패턴
- 의미 차이가 거의 없는 준동사 선택

---

## 4. 어법 문항 유형별 로직

### 4.1 밑줄 어법 5지선다

형식:

```text
다음 글의 밑줄 친 부분 중 어법상 틀린 것은?
```

생성 로직:

```text
1. 지문에서 구조가 선명한 문장 5곳을 고른다.
2. 4곳은 정확한 원문 또는 자연스러운 변형으로 둔다.
3. 1곳에 명확한 오류를 삽입한다.
4. 오류는 고1 수준 문법 포인트로 제한한다.
5. 정답 근거를 한 문장 안에서 설명할 수 있어야 한다.
```

검수:

- 밑줄 5개가 모두 비슷한 길이인가?
- 정답만 너무 이상하게 튀지 않는가?
- 오류가 실제로 하나뿐인가?
- 해설이 구조 분석으로 가능한가?

### 4.2 어법상 옳은 것 고르기

형식:

```text
다음 글의 밑줄 친 부분 중 어법상 옳은 것은?
```

주의:

이 유형은 오답 4개가 모두 명확히 틀려야 하므로 제작 난도가 높다.  
품질이 흔들리면 “틀린 것 고르기”가 더 안전하다.

생성 로직:

```text
1. 정답 1곳은 원문 구조를 유지한다.
2. 오답 4곳은 서로 다른 문법 오류로 만든다.
3. 오답 오류가 너무 노골적이지 않게 한다.
4. 모든 오류는 해설 가능해야 한다.
```

### 4.3 두 선택지 중 고르기

형식:

```text
(A), (B), (C)의 각 네모 안에서 어법에 맞는 표현으로 가장 적절한 것은?
```

장점:

- 실제 내신에서 자주 쓰인다.
- 여러 문법 포인트를 한 문항에 묶을 수 있다.
- 선지 번호 조합으로 변별 가능하다.

생성 로직:

```text
1. 지문 안에 A/B/C 세 지점을 만든다.
2. 각 지점은 서로 다른 어법 포인트를 측정한다.
3. 각 선택쌍은 둘 중 하나만 가능해야 한다.
4. 선택쌍의 품사와 형태를 비슷하게 맞춘다.
5. 정답 조합을 ①~⑤에 배치한다.
```

주의:

- A/B/C 중 하나가 애매하면 문항 전체가 무너진다.
- 선택쌍이 의미상 둘 다 가능하면 실패다.

### 4.4 어법 오류 교정 서술형

형식:

```text
다음 글에서 어법상 틀린 곳 7개 중 4개를 찾아 바르게 고쳐 쓰시오.
```

생성 로직:

```text
1. 변형 지문 또는 원문 기반 지문을 준비한다.
2. 오류 후보 10개를 만든다.
3. 그중 명확하고 고1 수준인 7개만 남긴다.
4. 학생은 4개만 고치게 한다.
5. 해설에는 7개 전체를 제공한다.
6. 채점 기준에는 오류 위치와 수정 형태를 모두 반영한다.
```

좋은 오류 조합:

```text
수일치 1개
태 1개
준동사 1개
관계사 1개
분사 1개
병렬 1개
접속사/전치사 1개
```

나쁜 오류 조합:

```text
수일치만 4개
전치사 감각만 5개
둘 다 가능한 준동사 2개
문맥상 판단이 어려운 관사 2개
```

---

## 5. 어법 오류 삽입 규칙

### 5.1 오류는 “작지만 명확하게” 만든다

좋은 오류:

```text
The experiences that shape taste are formed early.
→ The experiences that shapes taste are formed early.
```

왜 좋은가:

- 수일치 오류가 명확하다.
- 고1 수준에서 설명 가능하다.
- 원문 의미는 유지된다.

나쁜 오류:

```text
The subtle negotiation of embodied historical dispositions...
```

왜 나쁜가:

- 문장 자체가 과도하게 어렵다.
- 학생이 문법이 아니라 어휘 난이도 때문에 틀린다.

### 5.2 오류 삽입 금지 조건

다음 경우 오류 삽입 금지:

- 원문 의미가 바뀐다.
- 지문 논리가 깨진다.
- 오류가 너무 눈에 띈다.
- 정답이 두 개 이상 된다.
- 오류 설명에 고급 문법 논쟁이 필요하다.

### 5.3 오류 후보 선별표

| 후보 질문 | 통과 기준 |
|---|---|
| 오류가 하나로 확정되는가? | 예 |
| 고1 문법으로 설명 가능한가? | 예 |
| 해설이 2~4문장으로 가능한가? | 예 |
| 원문 의미가 보존되는가? | 예 |
| 다른 오류와 포인트가 겹치지 않는가? | 예 |

---

## 6. 어법 난이도 조절

### 6.1 쉬움

- 주어와 동사가 가까움
- 오류 포인트가 하나
- 문장 길이가 짧음
- 해석 없이 구조만 봐도 판단 가능

예:

```text
The result are surprising. → is
```

### 6.2 표준

- 주어와 동사 사이에 수식어가 있음
- 문맥 해석이 약간 필요함
- 절 구조 파악 필요

예:

```text
The pleasure that children experience is shaped by their social background.
```

### 6.3 어려움

- 삽입구가 있음
- 절이 2개 이상 연결됨
- 의미상 능동/수동 판단 필요
- 병렬 구조가 길게 이어짐

단, 어려움 단계에서도 정답 근거는 명확해야 한다.

---

## 7. 어법 해설 로직

### 7.1 해설 기본 구조

어법 해설은 항상 다음 순서를 따른다.

```text
1. 정답 위치
2. 오류 유형
3. 문장 구조
4. 왜 틀렸는지
5. 올바른 형태
6. 해석
```

### 7.2 예시

```text
정답: ③ shapes → shape
오류 유형: 수일치
구조: 주어는 복수명사 experiences이고, that절은 수식어이다.
해설: 동사 shapes는 단수 주어에 맞는 형태이므로 복수 주어 experiences와 일치하지 않는다.
수정: experiences shape
해석: 아이들이 경험하는 즐거움은 사회적 배경에 의해 형성된다.
```

---

## 8. 어휘 출제 로직 총론

### 8.1 어휘 문항의 정의

Ray's Drill에서 어휘 문항은 단어 뜻 암기가 아니라 다음을 평가한다.

```text
문맥 속에서 단어의 의미, 기능, 결합, 뉘앙스를 판단하는 능력
```

### 8.2 좋은 어휘 문항

좋은 어휘 문항은 다음 조건을 만족한다.

- 문맥을 읽어야 풀린다.
- 정답 단어가 지문 논리에 기여한다.
- 오답이 같은 의미장 안에 있어 그럴듯하다.
- 단어 난이도보다 문맥 판단이 핵심이다.
- 해설에서 왜 그 단어가 필요한지 설명 가능하다.

### 8.3 나쁜 어휘 문항

- 단어장 뜻만 알면 풀림
- 오답이 너무 엉뚱함
- 정답만 품사가 다름
- collocation이 깨져 바로 보임
- 고1 수준을 심하게 벗어난 동의어 나열
- 지문 핵심과 무관한 지엽 단어 출제

---

## 9. 어휘 포인트 분류

### 9.1 의미 중심 포인트

| 포인트 | 설명 |
|---|---|
| 핵심 개념어 | 글의 주제를 이루는 단어 |
| 대조어 | however, but 뒤 의미 반전 |
| 인과 동사 | lead to, result in, shape, cause |
| 태도 형용사 | beneficial, harmful, misleading |
| 정도 부사 | merely, fully, partly, necessarily |
| 추상명사 | influence, condition, relation, experience |

### 9.2 결합 중심 포인트

| 포인트 | 예 |
|---|---|
| 동사+목적어 | make a decision, raise awareness |
| 형용사+명사 | social condition, subjective experience |
| 전치사 결합 | depend on, be rooted in |
| 구동사 | go back to, come out with |
| 관용 표현 | in other words, according to |

### 9.3 형태 중심 포인트

| 포인트 | 예 |
|---|---|
| 품사 변환 | influence/influential |
| 접두사 | un-, dis-, re- |
| 접미사 | -tion, -ity, -ive |
| 파생어 | condition/conditioned/conditioning |
| 혼동어 | affect/effect, economic/economical |

---

## 10. 어휘 문항 유형별 로직

### 10.1 문맥상 의미

형식:

```text
밑줄 친 단어의 문맥상 의미로 가장 적절한 것은?
```

생성 로직:

```text
1. 사전 뜻이 여러 개인 단어를 고른다.
2. 지문 속 의미를 확정한다.
3. 정답은 문맥 의미를 자연스럽게 풀어 쓴다.
4. 오답은 다른 뜻, 표면 뜻, 과잉 해석, 반대 맥락으로 만든다.
```

주의:

학생용 선지에 “사전적 의미”, “문자적 의미”라고 쓰지 않는다.

### 10.2 어휘 적절성

형식:

```text
다음 글의 밑줄 친 낱말 중 문맥상 쓰임이 적절하지 않은 것은?
```

생성 로직:

```text
1. 지문 핵심 논리에 영향을 주는 단어 5개를 고른다.
2. 4개는 문맥상 적절하게 둔다.
3. 1개는 같은 품사이지만 의미 방향이 어긋나는 단어로 바꾼다.
4. 오류 단어는 문맥을 읽어야 판단되게 한다.
```

좋은 오류:

```text
conditioned → independent
```

문제점:

- 사회적으로 조건지어진다는 문맥에서 independent는 논리 반대가 된다.

### 10.3 어휘 대체

형식:

```text
밑줄 친 단어와 바꾸어 쓸 수 있는 말로 가장 적절한 것은?
```

생성 로직:

```text
1. 문맥상 의미가 선명한 단어를 고른다.
2. 정답은 의미와 문법 환경을 모두 만족해야 한다.
3. 오답은 뜻은 비슷하나 결합이 안 되거나, 문맥상 초점이 다른 단어로 만든다.
```

검수:

- 정답 단어가 같은 품사인가?
- collocation이 유지되는가?
- 문맥상 의미가 같은가?
- 오답도 표면적으로 그럴듯한가?

### 10.4 어휘 빈칸

형식:

```text
다음 빈칸에 들어갈 말로 가장 적절한 것은?
```

어휘 빈칸은 일반 빈칸보다 단어 선택에 초점이 있다.

생성 로직:

```text
1. 핵심 개념어 또는 논리 동사를 빈칸 처리한다.
2. 정답과 오답은 같은 품사로 만든다.
3. 오답은 같은 의미장 안에서 문맥 논리가 다른 단어로 만든다.
4. 정답이 지문 다른 곳에 그대로 노출되지 않게 한다.
```

---

## 11. 어휘 오답 설계

### 11.1 의미장 오답

같은 분야의 단어라서 그럴듯하지만 문맥상 틀린 오답.

예:

```text
shape / reflect / ignore / replace / simplify
```

### 11.2 반대 방향 오답

논리 방향을 반대로 만드는 오답.

예:

```text
conditioned ↔ independent
rooted ↔ separated
influenced ↔ isolated
```

### 11.3 정도 왜곡 오답

필자의 강도를 바꾸는 오답.

예:

```text
partly → completely
often → always
can → must
```

### 11.4 결합 오류 오답

뜻은 비슷하지만 영어 결합이 어색한 오답.

주의:

이 오답은 너무 쉬워질 수 있으므로 표면적으로 자연스러운 것만 사용한다.

### 11.5 품사 함정 금지

정답만 명사이고 오답은 동사인 식으로 만들면 안 된다.  
품사가 다르면 학생이 문맥이 아니라 형태로 답을 맞힌다.

---

## 12. 어휘 난이도 조절

### 12.1 교육과정 어휘 기준

기본 어휘는 교육과정 3,000개 어휘 체계를 기준으로 난이도를 본다.  
고1 공통영어 수준에서는 너무 특수한 학술어를 정답 핵심으로 남발하지 않는다.

### 12.2 쉬움

- 기본 어휘
- 문맥 단서 가까움
- 오답 의미 차이 큼
- 품사와 구조가 단순

### 12.3 표준

- 기본 어휘 + 약간의 추상어
- 문맥 단서가 앞뒤 2문장에 있음
- 오답이 같은 의미장에 있음
- collocation 판단 필요

### 12.4 어려움

- 추상명사 또는 다의어
- 문맥 단서가 지문 전체에 있음
- 오답이 의미상 매우 가까움
- 필자 태도와 논리 방향 판단 필요

주의:

어려운 어휘 문항도 지문 안 단서로 풀 수 있어야 한다.

---

## 13. 어휘 해설 로직

### 13.1 해설 기본 구조

```text
1. 정답 단어
2. 문맥상 의미
3. 정답 근거
4. 오답이 틀린 이유
5. 관련 표현
6. 해석
```

### 13.2 예시

```text
정답: conditioned
문맥상 의미: 사회적 조건의 영향을 받아 형성된
근거: 뒤에서 family, social group, class-specific experiences가 제시된다.
오답 해설: independent는 사회적 영향과 분리되어 있다는 뜻이므로 글의 핵심 논리와 반대다.
관련 표현: socially conditioned experiences
```

---

## 14. 서술형 출제 로직 총론

### 14.1 서술형의 정의

Ray's Drill에서 서술형은 학생에게 막연한 자유영작을 시키는 것이 아니다.

정의:

```text
지문 이해를 바탕으로,
명확한 조건 안에서,
채점 가능한 영어 답안을 작성하게 하는 문항
```

### 14.2 서술형 기본 원칙

- 모범답안을 먼저 만든다.
- 조건은 모범답안에서 역산한다.
- 단어 수는 실제로 센다.
- 한국어 뜻 또는 충분한 힌트를 준다.
- 고1 학생이 실제로 쓸 수 있어야 한다.
- 채점 기준을 함께 만든다.
- 허용 답안을 준비한다.

---

## 15. 서술형 유형 분류

### 15.1 주제문 서술형

측정:

- 글 전체 핵심을 영어 한 문장으로 구성

형식:

```text
다음 글의 핵심 내용을 12단어 이내의 영어 한 문장으로 쓰시오.
```

필수:

- 주어 또는 시작구 제공 여부 판단
- 필수어 2~4개
- 단어 수
- 허용 답안

### 15.2 내용 이해 서술형

측정:

- 지문 근거를 바탕으로 질문에 답하기

형식:

```text
필자가 말하는 social conditions가 개인의 경험에 어떤 영향을 주는지 영어로 쓰시오.
```

주의:

- 답이 너무 자유로워지지 않게 조건을 준다.
- 지문 한 문장 베끼기만으로 끝나지 않게 한다.

### 15.3 조건부 영작

측정:

- 한국어 의미를 조건에 맞게 영어 문장으로 구성

형식:

```text
<조건>에 맞게 다음 우리말을 영어 한 문장으로 쓰시오.
```

필수:

- 한국어 뜻
- 단어 수
- 필수어
- 어형 변화 가능 여부
- 필요 시 시작구

### 15.4 어법 교정 서술형

측정:

- 지문 속 어법 오류 인식과 수정

형식:

```text
다음 글에서 어법상 틀린 곳 7개 중 4개를 찾아 바르게 고쳐 쓰시오.
```

장점:

- 채점 기준을 명확히 만들 수 있다.
- 부분 점수 설계가 쉽다.
- 실제 내신형 변별에 좋다.

### 15.5 인터뷰형 서술형

측정:

- 지문 내용을 다른 담화 상황으로 전환

형식:

```text
다음 인터뷰에서 전문가의 답변이 되도록 글의 핵심 내용을 영어 한 문장으로 쓰시오.
```

장점:

- 단순 암기를 피할 수 있다.
- 주제문 작성과 내용 이해를 결합할 수 있다.

### 15.6 삽화 기반 서술형

측정:

- 지문 내용과 시각 상황 연결

형식:

```text
그림이 나타내는 상황을 글의 핵심 내용과 연결하여 영어 한 문장으로 쓰시오.
```

주의:

- 삽화만 보고 답이 나오면 안 된다.
- 지문 근거가 필요해야 한다.

---

## 16. 서술형 힌트 설계

### 16.1 힌트 사다리

| 단계 | 제공 정보 | 사용 상황 |
|---|---|---|
| H0 | 힌트 거의 없음 | 매우 쉬운 단답 |
| H1 | 한국어 뜻 | 짧은 기본 영작 |
| H2 | 한국어 뜻 + 필수어 | 표준 영작 |
| H3 | 한국어 뜻 + 필수어 + 단어 수 | 일반 내신형 |
| H4 | H3 + 첫 단어 | 구조가 조금 어려움 |
| H5 | H3 + 주어/시작구 | 첫 단어만으로 불가능 |
| H6 | H5 + 접속사/핵심 동사 | 복문 또는 추상 주제문 |

### 16.2 한국어 뜻 제공 규칙

한국어 뜻을 주는 경우:

- 필수어를 2~4개 정도 제공
- 단어 수 정확히 제시
- 어형 변화 가능 여부 표시

한국어 뜻을 주지 않는 경우:

- 필수어를 더 많이 제공
- 주어 또는 시작구를 제공
- 답의 방향을 발문에서 명확히 제시

### 16.3 첫 단어 vs 주어

첫 단어만 주면 안 되는 경우:

- The, A, It, This처럼 시작이 너무 약함
- 주어 선택이 핵심 난점임
- 문장 구조가 복잡함
- 필수어가 주어와 겹침

이 경우:

```text
첫 단어 제공 → 주어 제공
주어 제공도 부족 → 시작구 제공
시작구도 부족 → 핵심 동사까지 제공
```

예:

나쁜 조건:

```text
첫 단어: The
필수어: reopen, ticket offices, staff
```

개선:

```text
시작구: The theater should
필수어: reopen, ticket offices, staff
```

### 16.4 조건 단어와 주어 중복 처리

조건 단어가 주어와 겹치면 학생에게 실질 힌트가 줄어든다.

예:

```text
주어: Social conditions
필수어: social, conditions, shape
```

이 경우 `social`, `conditions`는 힌트 가치가 낮다.  
대신 다음처럼 바꾼다.

```text
주어: Social conditions
필수어: shape, experience, taste
```

---

## 17. 서술형 단어 수 로직

### 17.1 단어 수는 반드시 모범답안 기준

절차:

```text
1. 모범답안을 먼저 쓴다.
2. 불필요한 어려운 표현을 줄인다.
3. 단어 수를 센다.
4. 조건에 반영한다.
5. 허용 답안이 있으면 단어 수 범위를 둔다.
```

### 17.2 단어 수 세기 기준

권장:

- 띄어쓰기 기준
- 축약형은 하나로 계산
- 하이픈 표현은 하나로 계산
- 구두점은 단어 수에 포함하지 않음

예:

```text
people's = 1
well-known = 1
doesn't = 1
social conditions = 2
```

### 17.3 단어 수 조건 방식

정확한 답이 하나일 때:

```text
10단어로 쓰시오.
```

허용 답안이 여러 개일 때:

```text
10~12단어로 쓰시오.
```

너무 복잡한 주제문일 때:

```text
12단어 이내로 쓰시오.
```

주의:

단어 수가 평가 목표가 아니면 지나치게 엄격하게 만들지 않는다.

---

## 18. 서술형 채점 기준 로직

### 18.1 채점 기준 필수 요소

서술형은 반드시 다음을 포함한다.

```text
모범답안
허용답안
채점 요소
배점
부분점 기준
감점 기준
무효 기준
```

### 18.2 주제문 서술형 채점 예시

문항:

```text
다음 글의 핵심 내용을 11단어로 쓰시오.
조건: social conditions, shape, aesthetic experience를 모두 사용할 것.
```

모범답안:

```text
Social conditions shape aesthetic experience from the earliest stages of life.
```

채점 기준:

| 요소 | 배점 | 기준 |
|---|---:|---|
| 핵심 의미 | 2 | 사회적 조건이 미적 경험을 형성한다는 의미 포함 |
| 필수어 사용 | 1 | social conditions, shape, aesthetic experience 사용 |
| 문법 정확성 | 1 | 주어-동사, 전치사, 명사구 구조 정확 |
| 단어 수 | 1 | 11단어 조건 충족 |

감점:

- 필수어 하나 누락: -0.5
- 의미는 맞지만 문법 오류 있음: -0.5~-1
- 단어 수 1개 초과/부족: -0.5
- 핵심 의미 반대: 0점

### 18.3 어법 교정 서술형 채점 예시

형식:

```text
7개 오류 중 4개 수정, 각 1점
```

채점:

```text
오류 위치 정확 + 수정 정확 = 1점
오류 위치만 맞고 수정 틀림 = 0.5점
수정은 맞지만 위치 불명확 = 0.5점
정확한 표현을 틀리게 고침 = 0점
```

---

## 19. 서술형 난이도 조절

### 19.1 쉬움

- 한국어 뜻 제공
- 필수어 3개 이상 제공
- 주어 제공
- 단문
- 단어 수 8~10단어

### 19.2 표준

- 한국어 뜻 제공
- 필수어 2~4개
- 필요 시 시작구 제공
- 단문 또는 짧은 복문
- 단어 수 10~14단어

### 19.3 어려움

- 한국어 뜻 일부만 제공 또는 질문형
- 필수어 3~5개
- 주제 추론 필요
- 복문 가능
- 단어 수 12~16단어

단, 어려움에서도 학생이 답을 구성할 수 있는 구조 단서는 제공해야 한다.

---

## 20. 어법·어휘·서술형 결합 문항

### 20.1 결합이 필요한 이유

실제 내신은 한 문항에서 독해, 어휘, 어법, 서술형이 결합되는 경우가 많다.

예:

- 지문 내용 이해 후 핵심 문장을 조건부 영작
- 어휘 빈칸 후 그 이유를 해설에서 구문 분석
- 어법 오류 수정 후 문장 해석

### 20.2 좋은 결합

```text
내용 이해 + 주제문 서술형
어휘 빈칸 + 논리관계
어법 교정 + 핵심문장 복원
인터뷰형 + 주제문 작성
삽화형 + 내용 이해 서술형
```

### 20.3 나쁜 결합

```text
빈칸 + 삽입 + 순서 조작을 한 공통 지문에 모두 넣음
어법 오류가 너무 많아 독해 자체가 불가능함
서술형 조건이 너무 많아 발문이 더 어려움
어휘가 너무 어려워 내용 이해를 방해함
```

---

## 21. 심화 하네스 규격

### 21.1 어법 검수 필드

문항 JSON에 다음 필드를 추가한다.

```json
{
  "grammar_points": ["subject_verb_agreement", "voice"],
  "grammar_error_count": 1,
  "grammar_evidence": "주어 experiences가 복수이므로 동사는 shape가 되어야 한다.",
  "grammar_level": "G10_standard",
  "ambiguous_grammar_risk": false
}
```

### 21.2 어휘 검수 필드

```json
{
  "vocab_target": "conditioned",
  "vocab_focus": "contextual_meaning",
  "semantic_field": ["shape", "influence", "condition", "determine"],
  "collocation_check": true,
  "curriculum_vocab_level": "common_high",
  "vocab_risk": "abstract_but_context_supported"
}
```

### 21.3 서술형 검수 필드

```json
{
  "constructed_response": true,
  "model_answer": "",
  "word_count": 0,
  "word_count_policy": "space_based",
  "korean_meaning": "",
  "given_words": [],
  "inflection_allowed": true,
  "starter": "",
  "subject_given": false,
  "hint_level": "H3",
  "rubric": [],
  "acceptable_variants": [],
  "scoring_notes": ""
}
```

---

## 22. 자동 검수 로직

### 22.1 어법 자동 검수

검사:

```text
grammar_points 존재
grammar_evidence 존재
어법 문항인데 표시 지점 존재
오류 개수와 정답 개수 일치
ambiguous_grammar_risk가 true이면 ready 불가
```

의사코드:

```js
function validateGrammarItem(item) {
  const errors = [];
  if (!item.question_type.includes("어법")) return errors;

  if (!item.grammar_points || item.grammar_points.length === 0) {
    errors.push("grammar_points 누락");
  }
  if (!item.grammar_evidence) {
    errors.push("grammar_evidence 누락");
  }
  if (item.ambiguous_grammar_risk === true) {
    errors.push("어법 판단 애매성 위험");
  }
  if (!item.common_passage.includes("[[") && !item.common_passage.includes("__")) {
    errors.push("어법 표시 지점 누락");
  }
  return errors;
}
```

### 22.2 어휘 자동 검수

검사:

```text
vocab_target 존재
vocab_focus 존재
semantic_field 존재
정답과 오답 품사 일치
금지 패턴 없음
정답이 지문에 과도하게 반복 노출되지 않음
```

의사코드:

```js
function validateVocabItem(item) {
  const errors = [];
  if (!item.question_type.includes("어휘")) return errors;

  if (!item.vocab_target) errors.push("vocab_target 누락");
  if (!item.vocab_focus) errors.push("vocab_focus 누락");
  if (!item.semantic_field || item.semantic_field.length < 3) {
    errors.push("semantic_field 부족");
  }
  if (item.vocab_risk === "unsupported_advanced_word") {
    errors.push("문맥 단서 없는 고난도 어휘");
  }
  return errors;
}
```

### 22.3 서술형 자동 검수

검사:

```text
model_answer 존재
word_count 일치
힌트 수준 적정
한국어 뜻 없으면 given_words 충분
긴 문항이면 starter 또는 subject 제공
rubric 존재
acceptable_variants 존재 여부 확인
```

의사코드:

```js
function countWords(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function validateConstructedResponse(item) {
  const errors = [];
  if (!item.constructed_response) return errors;

  if (!item.model_answer) errors.push("model_answer 누락");
  if (countWords(item.model_answer) !== item.word_count) {
    errors.push("word_count 불일치");
  }

  const hasMeaning = Boolean(item.korean_meaning);
  const givenCount = item.given_words ? item.given_words.length : 0;
  const longAnswer = item.word_count >= 10;

  if (!hasMeaning && givenCount < 4) {
    errors.push("한국어 뜻이 없으면 필수어 4개 이상 권장");
  }
  if (longAnswer && !item.starter && !item.subject_given) {
    errors.push("긴 서술형은 starter 또는 subject 필요");
  }
  if (!item.rubric || item.rubric.length === 0) {
    errors.push("rubric 누락");
  }
  return errors;
}
```

---

## 23. 생성 프롬프트

### 23.1 어법 생성 프롬프트

```text
다음 지문에서 고1 내신형 어법 문항을 제작하라.

조건:
1. 문장 구조로 설명 가능한 포인트만 사용한다.
2. 수일치, 시제, 태, 준동사, 관계사, 분사, 병렬, 접속사/전치사 중에서 고른다.
3. 답이 둘 이상 가능한 표현은 사용하지 않는다.
4. 지문 의미를 훼손하지 않는다.
5. 정답 근거를 구조 분석으로 제시한다.
6. 서술형 교정 문항이면 오류 7개 중 4개 수정형으로 만들고, 해설에는 7개 모두 제시한다.

출력:
- 문제
- 정답
- grammar_points
- 정답 근거
- 해설
- 난이도
- 애매성 위험 여부
```

### 23.2 어휘 생성 프롬프트

```text
다음 지문에서 고1 내신형 어휘 문항을 제작하라.

조건:
1. 단어장 뜻이 아니라 문맥상 의미를 묻는다.
2. 핵심 개념어, 대조어, 인과 동사, 태도 형용사, 정도 부사, collocation 중 하나를 포인트로 삼는다.
3. 정답과 오답은 같은 품사와 비슷한 의미장 안에서 만든다.
4. 오답은 문맥 논리, 정도, 결합, 초점 중 하나가 어긋나야 한다.
5. 고1 수준을 심하게 벗어난 어휘는 문맥 단서가 충분할 때만 사용한다.

출력:
- 문제
- 정답
- vocab_target
- vocab_focus
- semantic_field
- 오답별 오류 논리
- 해설
```

### 23.3 서술형 생성 프롬프트

```text
다음 지문에서 고1 내신형 서술형 문항을 제작하라.

조건:
1. 모범답안을 먼저 만든다.
2. 단어 수를 정확히 계산한다.
3. 한국어 뜻, 필수어, 어형 변화 가능 여부를 제시한다.
4. 첫 단어만으로 어려우면 주어 또는 시작구를 제공한다.
5. 한국어 뜻을 주지 않을 경우 필수어와 구조 힌트를 더 제공한다.
6. 조건에 들어간 요소는 채점기준에 반영한다.
7. 허용 답안과 감점 기준을 제시한다.

출력:
- 문제
- 조건
- 모범답안
- 단어 수
- 허용 답안
- 채점 기준
- 감점 기준
- 난이도 조정 이유
```

---

## 24. 최종 체크리스트

### 24.1 어법

- [ ] 정답이 하나인가
- [ ] 고1 수준에서 설명 가능한가
- [ ] 문장 구조 근거가 있는가
- [ ] 원문 의미를 훼손하지 않았는가
- [ ] 오류 포인트가 반복되지 않는가
- [ ] 해설에 구조 분석이 있는가

### 24.2 어휘

- [ ] 문맥을 읽어야 풀리는가
- [ ] 정답과 오답 품사가 맞는가
- [ ] 오답이 같은 의미장 안에 있는가
- [ ] 정답만 너무 쉬운 단서가 있는가
- [ ] 고난도 어휘에 문맥 단서가 있는가
- [ ] 해설에 문맥상 의미가 설명되어 있는가

### 24.3 서술형

- [ ] 모범답안을 먼저 만들었는가
- [ ] 단어 수가 정확한가
- [ ] 한국어 뜻 또는 충분한 힌트가 있는가
- [ ] 첫 단어만으로 부족하면 주어/시작구를 제공했는가
- [ ] 조건 단어와 주어가 겹치지 않는가
- [ ] 채점 기준이 있는가
- [ ] 허용 답안이 있는가
- [ ] 고1 학생이 실제로 쓸 수 있는가

---

## 25. 참고 자료

이 문서는 다음 자료의 방향을 Ray's Drill 제작 규칙으로 재구성했다.

- KICE 학생평가지원포털: https://stas.moe.go.kr/
- 경상남도교육청, 2023 영어과 선택형문항제작 도움자료집: https://www.gne.go.kr/user/bbs/BD_selectBbs.do?q_bbsDocNo=1602766&q_bbsSn=1464
- 인천광역시교육청, 고등학교 학생평가 안내 자료: https://www.ice.go.kr/upload/board/529/2020/03/1583373041111.pdf
- 광주광역시교육청, 영어과 서술형 평가 문항 개발 자료: https://gice.gen.go.kr/boardDownload.es?bid=0027&list_no=247&seq=1
- 2022 개정 영어과 교육과정 기본 어휘 목록 관련 자료: https://www.goe.go.kr/resource/old/BBSMSTR_000000030136/BBS_202307111028067791.pdf
- University of Wisconsin, multiple-choice item writing guidance: https://wisc.pb.unizin.org/mtle/chapter/writing-good-multiple-choice-test-questions/

---

## 26. 운영 결론

어법, 어휘, 서술형의 최종 운영 원칙은 다음이다.

```text
어법은 구조로 설명 가능한 것만 낸다.
어휘는 문맥으로 판단 가능한 것만 낸다.
서술형은 모범답안에서 조건을 역산한다.
```

그리고 배부용 최종본에서는 다음을 지킨다.

```text
애매한 어법은 버린다.
단어장식 어휘는 버린다.
힌트 부족 서술형은 보강하거나 버린다.
채점 기준 없는 서술형은 완성본에 넣지 않는다.
```

---

## 27. PC 내 영어학 원서 스캔 반영

### 27.1 스캔 범위

PC 내부에서 영어학·영문법·어휘·담화·작문 관련 원서를 검색했고, 다음 폴더에서 핵심 자료를 확인했다.

```text
C:\Users\이인혁\Desktop\원서모음
C:\Users\이인혁\Desktop\원서모음\English_Grammar
C:\Users\이인혁\Desktop\원서모음\English_Syntax
C:\Users\이인혁\Desktop\원서모음\Cognitive_Linguistics
C:\Users\이인혁\Desktop\원서모음\Dictionaries_Vocabulary
C:\Users\이인혁\Desktop\원서모음\Semantics_Pragmatics
C:\Users\이인혁\Desktop\원서모음\Reading_Writing
```

검색 결과는 다음 보조 파일에 남겼다.

```text
book_candidates.json
book_toc_scan_summary.json
```

### 27.2 반영한 핵심 원서

| 영역 | 원서 | 로직에 반영한 핵심 |
|---|---|---|
| 현대 영문법 | Huddleston, Pullum & Reynolds, *A Student's Introduction to English Grammar* | 범주(category)와 기능(function)을 분리하여 어법 근거를 세움 |
| 코퍼스 기반 문법 | Biber et al., *Grammar of Spoken and Written English* | 문법 판단에 register와 written standard를 반영 |
| 교육문법 | Larsen-Freeman & Celce-Murcia, *The Grammar Book* | form-meaning-use 삼각형을 어법 출제의 기본 게이트로 사용 |
| 교사용 문법 | *Grammar for English Language Teachers* | 학습자 오류와 설명 가능성을 어법 문항 품질 기준에 포함 |
| 인지문법 | Radden & Dirven, *Cognitive English Grammar* | 문법을 의미 구성 방식으로 보고, 수동태·시제·전치사·관사 판단에 의미틀을 부여 |
| 인지문법 | Langacker, *Essentials of Cognitive Grammar* | construal, profiling, figure-ground 관점을 어법/어휘 해설에 반영 |
| 어휘문법 | *Lexical Grammar* | 단어가 아니라 chunk, pattern, collocation 단위로 어휘 문항 설계 |
| 학술어휘 | McCarthy & O'Dell, *Academic Vocabulary in Use* | academic function, word family, collocation 기반 어휘 출제 |
| 담화 연결 | Zufferey & Degand, *Connectives and Discourse Relations* | 연결어를 의미관계 표지로 보고 discourse relation을 명시 |
| 작문 명료성 | Williams & Bizup, *Style: Lessons in Clarity and Grace* | 서술형 답안의 주어-동사 명료성, old-to-new 정보 흐름 반영 |
| 코퍼스 문법 | *Collins COBUILD English Grammar* | 실제 사용 패턴 중심의 phrase grammar와 learner-friendly 설명 반영 |

---

## 28. 원서 기반 신규 상위 게이트

기존 로직은 `정답 하나`, `고1 수준`, `힌트 충분성`을 중심으로 했으나, 원서 연구를 반영해 다음 상위 게이트를 추가한다.

### 28.1 Form-Meaning-Use Gate

어법 문항은 반드시 세 층을 모두 통과해야 한다.

| 층 | 질문 | FAIL 조건 |
|---|---|---|
| Form | 형태와 구조가 맞는가? | 문법 형태만 보고도 애매함 |
| Meaning | 의미 차이가 분명한가? | 두 형태가 의미상 모두 가능 |
| Use | 실제 문맥/담화에서 자연스러운가? | 문맥상 둘 다 허용 |

예:

```text
단순히 because와 because of를 묻는 것이 아니라,
뒤에 절이 오는지 구가 오는지(Form),
원인 관계가 맞는지(Meaning),
문맥상 원인 제시가 필요한지(Use)를 함께 확인한다.
```

### 28.2 Category-Function Gate

Huddleston/Pullum식 분석을 반영해, 어법 문항은 품사 이름만으로 판단하지 않는다.

구분:

```text
category = noun, verb, adjective, preposition, subordinator 등 형태 범주
function = subject, object, predicative complement, modifier, adjunct 등 문장 내 기능
```

출제 적용:

- 명사구가 주어인지 목적어인지 확인한다.
- 전치사구가 보어인지 부사어인지 확인한다.
- 관계절이 명사를 수식하는지, 명사절이 문장 성분인지 구분한다.
- 분사구가 능동 수식인지 수동 수식인지 의미 기능으로 판단한다.

FAIL:

```text
품사명만 물어보고 문장 기능이 출제 근거에 반영되지 않는 문항
```

### 28.3 Register Gate

Biber식 코퍼스 문법 관점을 반영해, “틀렸다”와 “문체가 다르다”를 구분한다.

검수 질문:

- 이 표현은 문법적으로 틀린가, 아니면 구어체/문어체 차이인가?
- 내신 지필평가의 표준 문어 영어 기준에서 부적절한가?
- 회화체에서는 가능하지만 academic/written register에서는 피하는 표현인가?

출제 적용:

- 지필평가에서는 written standard를 기본으로 한다.
- 구어체 축약, informal ellipsis, conversation marker는 어법 오류로 단정하지 않는다.
- register 차이를 묻고 싶다면 “문체상 가장 적절한 표현” 유형으로 따로 낸다.

FAIL:

```text
구어에서는 자연스러운 표현을 무조건 어법 오류로 처리
```

### 28.4 Construction/Pattern Gate

Construction Grammar와 lexical grammar를 반영해, 단어 하나가 아니라 패턴 단위로 출제한다.

출제 단위:

```text
verb + object
verb + object + to-infinitive
adjective + preposition
noun + that-clause
be + past participle + by-phrase
not only A but also B
make it possible for A to V
```

적용:

- 어휘 문제는 단어 뜻이 아니라 함께 쓰이는 패턴을 본다.
- 어법 문제는 구조 틀을 보고 필요한 형태를 묻는다.
- 서술형은 학생이 사용할 construction을 조건으로 제공할 수 있다.

FAIL:

```text
단어 하나만 물어보고 실제 결합 패턴을 무시
```

### 28.5 Discourse Relation Gate

Connectives and discourse relations 관점을 반영해, 연결어는 단순 뜻이 아니라 담화 관계 표지로 본다.

관계 분류:

- cause
- result
- contrast
- concession
- elaboration
- exemplification
- reformulation
- condition
- temporal sequence
- summary/conclusion

적용:

- 연결어 빈칸은 반드시 앞뒤 관계를 태깅한다.
- 오답은 다른 담화 관계를 나타내는 연결어로 만든다.
- 해설은 “뜻이 ~라서”가 아니라 “앞뒤 문장이 대조/결과/예시 관계라서”로 쓴다.

### 28.6 Clarity Gate

Style 원서를 반영해, 서술형 모범답안은 문법적으로 맞는 것뿐 아니라 명료해야 한다.

검수 질문:

- 주어가 답의 핵심 행위자/개념인가?
- 동사가 핵심 행동/관계를 드러내는가?
- 불필요한 명사화가 많은가?
- 익숙한 정보에서 새 정보로 흐르는가?
- 너무 긴 도입구 때문에 핵심 동사가 늦게 나오는가?

FAIL:

```text
문법은 맞지만 학생이 쓰기 어렵고 의미가 흐릿한 모범답안
```

---

## 29. 어법 로직 원서 반영판

### 29.1 기존 어법 로직의 문제

기존 어법 문제는 다음 위험이 있었다.

- 문법 공식만 묻는다.
- 형태만 보고 정답을 고르게 한다.
- 실제 사용 가능성을 검토하지 않는다.
- 의미 차이가 약한 선택지를 만든다.
- 문장 기능 분석 없이 품사명만 해설한다.

### 29.2 개선된 어법 생성 순서

```text
1. 원문 문장 구조를 분석한다.
2. category와 function을 분리한다.
3. form-meaning-use 세 층 중 어느 층을 측정할지 정한다.
4. register를 확인한다.
5. construction pattern을 태깅한다.
6. 오류를 삽입하거나 선택쌍을 만든다.
7. 정답 근거를 구조+의미+사용 조건으로 쓴다.
8. 애매성 위험을 검사한다.
```

### 29.3 어법 문항 필드 확장

```json
{
  "grammar_category": "verb phrase",
  "grammar_function": "predicator",
  "form_target": "subject-verb agreement",
  "meaning_contrast": "plural subject requires base present form",
  "use_condition": "standard written English",
  "register": "written_academic",
  "construction_pattern": "NP + relative clause + VP",
  "ambiguity_risk": false
}
```

### 29.4 어법 포인트별 원서 반영 규칙

#### 수일치

핵심:

```text
주어의 category가 아니라 function을 먼저 확인한다.
```

출제 규칙:

- 긴 수식어를 걷어내고 진짜 주어를 찾게 한다.
- 관계절/전치사구/분사구 안 명사가 동사를 끌어당기는 오답을 만든다.
- 해설은 “가까운 명사가 아니라 문장 주어와 일치”로 쓴다.

좋은 포인트:

```text
The experiences that shape one's taste are socially conditioned.
```

나쁜 포인트:

```text
The books is on the desk.
```

너무 쉬워서 변별이 약하다.

#### 태

핵심:

```text
태는 형태 문제가 아니라 사건을 어느 관점에서 보느냐의 문제다.
```

출제 규칙:

- 행위자보다 영향을 받는 대상이 중심이면 수동태가 자연스럽다.
- by-phrase가 없어도 수동태가 가능하다는 점을 반영한다.
- 능동/수동 선택은 의미역으로 설명한다.

오답 DNA:

- 영향을 받는 대상을 행위자로 오해
- 사회적 조건이 경험을 형성한다는 관계를 반대로 처리

#### 시제와 상

핵심:

```text
시제는 시간 위치, 상은 사건을 바라보는 방식이다.
```

출제 규칙:

- 단순현재는 일반 사실/반복/논리 명제에 사용한다.
- 현재완료는 과거 사건의 현재 관련성을 요구한다.
- 진행형은 진행 중인 과정성을 드러낸다.
- 지문 주제가 일반 설명이면 단순현재가 기본이다.

#### 관계사

핵심:

```text
관계사는 선행사와 절 내부 기능을 동시에 확인한다.
```

출제 규칙:

- who/which/that만 묻지 말고, 관계절 내부의 빈 기능을 보게 한다.
- where/when은 선행사가 장소/시간이라는 이유만으로 쓰지 않는다. 절 내부에서 부사 기능이어야 한다.
- what은 선행사를 포함한 명사절이므로 관계대명사 that과 구분한다.

#### 분사

핵심:

```text
분사는 수식 대상과의 의미 관계가 능동인지 수동인지 본다.
```

출제 규칙:

- 감정 동사는 학생 오류가 많으므로 변별에 좋다.
- 현재분사는 유발하는 쪽, 과거분사는 영향을 받은 쪽이라는 기계식만으로 끝내지 말고 문맥 의미를 확인한다.

#### 준동사

핵심:

```text
동사 패턴이 준동사 선택을 결정한다.
```

출제 규칙:

- allow A to V
- let A V
- make it possible for A to V
- be used to V / be used to -ing 구분
- stop A from -ing

해설은 “이 동사는 to부정사를 취한다”를 넘어서, 구조 패턴을 제시한다.

#### 접속사/전치사

핵심:

```text
절을 이끄는지, 명사구를 이끄는지 form으로 확인하고, 의미관계를 meaning으로 확인한다.
```

출제 규칙:

- because + clause
- because of + NP
- although + clause
- despite + NP/-ing
- during + NP
- while + clause

#### 병렬

핵심:

```text
병렬은 같은 의미 기능을 하는 요소가 같은 문법 형식으로 놓이는 것이다.
```

출제 규칙:

- 단순히 A and B 형태가 아니라 A와 B가 같은 function인지 확인한다.
- to V and V-ing 같은 표면 오류보다, 같은 역할의 구/절 구조를 맞추게 한다.

---

## 30. 어휘 로직 원서 반영판

### 30.1 기존 어휘 로직의 문제

기존 어휘 문항은 다음 위험이 있었다.

- 단어 뜻만 묻는다.
- 품사만 맞추면 답이 보인다.
- 오답이 의미장 밖이라 너무 쉽다.
- collocation을 무시한다.
- academic function을 보지 않는다.
- 단어와 문법 패턴을 분리해서 본다.

### 30.2 개선된 어휘 생성 순서

```text
1. target word를 고른다.
2. lemma, word family, phrase, chunk 중 출제 단위를 정한다.
3. semantic field를 만든다.
4. collocation/pattern을 확인한다.
5. discourse function을 확인한다.
6. 정답과 오답을 같은 품사·같은 의미장 안에서 만든다.
7. 문맥상 왜 정답인지 해설한다.
```

### 30.3 어휘 문항 필드 확장

```json
{
  "vocab_unit": "chunk",
  "target_expression": "be rooted in",
  "word_family": ["root", "rooted", "rooting"],
  "semantic_field": ["origin", "basis", "source", "foundation"],
  "collocation_pattern": "be rooted in + abstract noun",
  "academic_function": "cause_basis",
  "discourse_function": "explanation",
  "register": "academic_written"
}
```

### 30.4 어휘 출제 단위

| 단위 | 설명 | 예 |
|---|---|---|
| word | 단일 단어 | shape |
| word family | 파생형 묶음 | condition, conditioned, conditioning |
| collocation | 자연스러운 결합 | socially conditioned |
| chunk | 덩어리 표현 | be rooted in |
| pattern | 문법-어휘 결합 | allow A to V |
| discourse marker | 담화 표지 | in other words |

### 30.5 lexical grammar 반영 규칙

어휘 문항은 단어와 문법을 분리하지 않는다.

예:

```text
access는 단어 뜻만 묻지 않는다.
access to + resource 패턴으로 본다.
```

```text
influence는 명사/동사 모두 가능하므로,
문장 안 function과 pattern을 같이 확인한다.
```

```text
conditioned는 '조건화된'이라는 뜻뿐 아니라,
socially conditioned experiences라는 chunk 안에서 의미가 완성된다.
```

### 30.6 academic vocabulary 반영 규칙

학술어휘는 의미뿐 아니라 기능으로 출제한다.

기능 분류:

- define
- classify
- compare
- contrast
- cause
- result
- exemplify
- summarize
- evaluate
- qualify

예:

```text
according to = 출처/관점 제시
in other words = 재진술
therefore = 결과
however = 대조
specific = 범위 제한
manifest = 드러나다/나타나다
```

출제 규칙:

- 단어 뜻보다 글 안에서 어떤 기능을 하는지 묻는다.
- 오답은 같은 학술 기능군 안에서 만든다.
- 해설은 문맥 기능을 포함한다.

### 30.7 semantic field 오답 설계

정답과 오답은 같은 의미장 안에 둔다.

예:

```text
shape
affect
reflect
determine
ignore
```

이 중 어떤 단어가 정답인지는 문맥의 강도와 방향으로 결정한다.

오답 설계:

- reflect: 영향을 받는 것이 아니라 반영한다는 의미로 초점 이동
- determine: 지나치게 강한 결정론으로 과잉
- ignore: 글의 방향과 반대
- affect: 너무 일반적이어서 핵심 관계 약화

### 30.8 collocation Gate

어휘 선지는 뜻만 맞아도 안 되고 결합도 맞아야 한다.

검수 질문:

- 정답이 해당 명사/동사와 자연스럽게 결합하는가?
- 오답이 결합 오류 때문에 너무 쉽게 제거되지는 않는가?
- collocation 자체를 묻는 문항인가, 문맥 의미를 묻는 문항인가?

FAIL:

```text
오답이 영어 결합상 말이 안 되어 학생이 문맥 없이 제거 가능
```

---

## 31. 서술형 로직 원서 반영판

### 31.1 기존 서술형 로직의 문제

기존 서술형은 다음 위험이 있었다.

- 정답을 먼저 만들지 않고 조건을 잡음
- 첫 단어만 던져줘서 학생이 못 씀
- 단어 수가 틀림
- 문법적으로는 맞지만 너무 어색한 모범답안
- 채점 기준이 없음
- 허용 답안이 없어 채점 분쟁 가능

### 31.2 개선된 서술형 생성 순서

```text
1. 지문 핵심 의미를 한국어로 확정한다.
2. 영어 모범답안을 먼저 만든다.
3. Style Gate로 답안 명료성을 검수한다.
4. Form-Meaning-Use Gate로 문법/의미/사용을 확인한다.
5. 단어 수를 계산한다.
6. 힌트 수준을 정한다.
7. 조건을 작성한다.
8. 허용 답안을 만든다.
9. 채점 기준과 감점 기준을 만든다.
```

### 31.3 Clarity Gate 세부 규칙

Style 원서의 명료성 원칙을 서술형에 맞게 바꾼다.

#### 주어 규칙

모범답안의 주어는 답의 핵심 대상이어야 한다.

좋음:

```text
Social conditions shape aesthetic experience.
```

약함:

```text
It is social conditions that have an effect on aesthetic experience.
```

두 번째 문장은 문법적으로 가능하지만 학생용 모범답안으로는 불필요하게 무겁다.

#### 동사 규칙

핵심 의미는 명사화보다 동사로 드러낸다.

좋음:

```text
Social conditions shape taste.
```

약함:

```text
Social conditions have an influence on the formation of taste.
```

둘 다 가능하지만, 내신 서술형 모범답안은 전자가 더 채점하기 쉽다.

#### 정보 흐름 규칙

익숙한 정보에서 새 정보로 간다.

예:

```text
Social conditions shape individual taste from early childhood.
```

`social conditions`가 지문에서 이미 나온 핵심어라면 주어로 두고, 새 정보인 `individual taste`를 뒤에 둔다.

### 31.4 서술형 힌트의 construction화

힌트는 단어만 주지 말고 필요한 경우 construction을 준다.

예:

```text
조건:
1. 10단어로 쓸 것
2. shape, experience, society를 사용할 것
3. 주어는 A person's experiences로 시작할 것
```

더 명확한 조건:

```text
조건:
1. 10~12단어로 쓸 것
2. shape A's view of B 구조를 사용할 것
3. society, experience를 반드시 포함할 것
```

construction을 주면 학생이 문장 뼈대를 잡을 수 있다.

### 31.5 허용 답안 설계

서술형은 단일 문장만 답으로 두면 채점 분쟁이 생긴다.

허용 답안은 세 층으로 만든다.

| 층 | 설명 |
|---|---|
| A안 | 모범답안 |
| B안 | 단어 순서나 표현은 다르지만 의미 동일 |
| C안 | 문법 오류가 조금 있으나 핵심 의미 유지 |

예:

```text
A: Social conditions shape aesthetic experience from early childhood.
B: Aesthetic experience is shaped by social conditions from early childhood.
C: Social conditions shapes aesthetic experience from early childhood.  
   핵심 의미는 맞지만 수일치 오류로 감점
```

### 31.6 서술형 채점 기준 강화

채점 기준은 조건과 반드시 연결한다.

예:

```text
조건:
1. 10~12단어
2. shape, social conditions, aesthetic experience 사용
3. from early childhood 의미 포함
```

채점 기준:

| 요소 | 배점 | 기준 |
|---|---:|---|
| 핵심 의미 | 2 | 사회적 조건이 미적 경험을 형성한다는 의미 |
| 시간/발달 의미 | 1 | early childhood/from the beginning 의미 |
| 필수어 사용 | 1 | 제시어 사용 및 어형 적절 |
| 문법 | 1 | 수일치, 태, 전치사 등 |
| 단어 수 | 1 | 조건 범위 충족 |

조건에 있는 것은 채점 기준에 들어가야 한다.

---

## 32. 담화 연결어 로직 강화

### 32.1 연결어는 어휘이면서 담화문법이다

연결어 문제는 단어 뜻 문제가 아니다.  
앞뒤 문장이 어떤 담화 관계인지 판단하는 문제다.

### 32.2 discourse relation 태깅

문항 생성 전 다음 중 하나를 태깅한다.

```json
{
  "discourse_relation": "contrast",
  "left_context_function": "common expectation",
  "right_context_function": "author's correction",
  "connective_answer": "however"
}
```

### 32.3 오답 설계

| 정답 관계 | 오답 관계 |
|---|---|
| contrast | cause, example, addition |
| result | contrast, condition, restatement |
| example | result, concession, summary |
| reformulation | cause, contrast, temporal |
| concession | simple contrast, result, addition |

### 32.4 해설

나쁜 해설:

```text
however는 그러나라는 뜻이므로 정답이다.
```

좋은 해설:

```text
앞 문장은 일반적인 기대를 제시하고, 뒤 문장은 그 기대와 반대되는 실제 결과를 제시한다.
따라서 두 문장은 대조 관계이며, 이를 표시하는 however가 적절하다.
```

---

## 33. 업데이트된 하네스 필드

### 33.1 어법 확장 필드

```json
{
  "form_meaning_use": {
    "form": "subject-verb agreement",
    "meaning": "plural experiences perform the shaping",
    "use": "standard written explanation"
  },
  "category_function": {
    "category": "noun phrase",
    "function": "subject"
  },
  "register_check": "written_standard",
  "construction_pattern": "NP + relative clause + VP",
  "ambiguity_risk": false
}
```

### 33.2 어휘 확장 필드

```json
{
  "lexical_unit_type": "chunk",
  "target_expression": "be rooted in",
  "semantic_field": ["basis", "source", "origin", "foundation"],
  "collocation_pattern": "be rooted in + abstract/social experience",
  "academic_function": "explanation_of_basis",
  "discourse_relation": null
}
```

### 33.3 서술형 확장 필드

```json
{
  "clarity_check": {
    "character_subject": true,
    "action_verb": true,
    "old_to_new_flow": true,
    "nominalization_overload": false
  },
  "construction_hint": "shape A's experience",
  "answer_variants": {
    "A_full": "",
    "B_equivalent": [],
    "C_partial": []
  }
}
```

---

## 34. 업데이트된 자동 검수 규칙

### 34.1 어법 자동 검수 추가

```js
function validateFormMeaningUse(item) {
  const errors = [];
  if (!item.question_type.includes("어법")) return errors;

  if (!item.form_meaning_use) {
    errors.push("form_meaning_use 누락");
  } else {
    for (const key of ["form", "meaning", "use"]) {
      if (!item.form_meaning_use[key]) errors.push(`form_meaning_use.${key} 누락`);
    }
  }

  if (!item.category_function) {
    errors.push("category_function 누락");
  }

  if (item.ambiguity_risk === true) {
    errors.push("어법 애매성 위험: ready 불가");
  }

  return errors;
}
```

### 34.2 어휘 자동 검수 추가

```js
function validateLexicalGrammar(item) {
  const errors = [];
  if (!item.question_type.includes("어휘")) return errors;

  if (!item.lexical_unit_type) errors.push("lexical_unit_type 누락");
  if (!item.semantic_field || item.semantic_field.length < 3) {
    errors.push("semantic_field는 최소 3개 이상");
  }
  if (!item.collocation_pattern && item.lexical_unit_type !== "word") {
    errors.push("chunk/pattern 문항은 collocation_pattern 필요");
  }

  return errors;
}
```

### 34.3 서술형 자동 검수 추가

```js
function validateClarity(item) {
  const errors = [];
  if (!item.constructed_response) return errors;

  if (!item.clarity_check) {
    errors.push("clarity_check 누락");
    return errors;
  }

  if (!item.clarity_check.character_subject) {
    errors.push("모범답안 주어가 핵심 대상이 아님");
  }
  if (!item.clarity_check.action_verb) {
    errors.push("핵심 의미가 동사로 드러나지 않음");
  }
  if (item.clarity_check.nominalization_overload) {
    errors.push("명사화 과잉");
  }

  return errors;
}
```

---

## 35. 원서 반영 후 최종 운영 원칙

### 35.1 어법

```text
형태만 맞추는 문제가 아니라,
형태-의미-사용을 함께 판단하는 문제로 만든다.
```

필수:

- category/function 분리
- form/meaning/use 태깅
- register 확인
- construction pattern 제시
- 애매성 위험 검사

### 35.2 어휘

```text
단어 하나의 뜻이 아니라,
단어가 들어가는 의미장·결합·담화 기능을 묻는다.
```

필수:

- lexical unit 지정
- semantic field 구성
- collocation/pattern 확인
- academic/discourse function 태깅
- 품사와 문맥 동시 검수

### 35.3 서술형

```text
학생에게 어려운 문장을 던지는 것이 아니라,
명료한 모범답안에서 조건과 채점 기준을 역산한다.
```

필수:

- 모범답안 우선
- clarity gate
- construction hint
- word count 검증
- answer variants
- rubric 연결

---

## 36. PC 원서 반영 출제 프롬프트

### 36.1 어법 심화 프롬프트

```text
다음 지문으로 어법 문항을 제작하라.

반드시 다음 분석을 먼저 수행하라.
1. target 문장의 category와 function을 구분하라.
2. form-meaning-use 세 층을 각각 설명하라.
3. register가 written standard인지 확인하라.
4. construction pattern을 태깅하라.
5. 답이 둘 이상 가능하면 문항을 폐기하라.

문항 생성:
- 고1 내신 수준으로 만들 것
- 정답 근거는 구조+의미+사용 조건으로 설명할 것
- 해설에는 왜 다른 선택지가 안 되는지 밝힐 것
```

### 36.2 어휘 심화 프롬프트

```text
다음 지문으로 어휘 문항을 제작하라.

반드시 다음 분석을 먼저 수행하라.
1. target expression이 word, word family, collocation, chunk, pattern 중 무엇인지 정하라.
2. semantic field를 4개 이상 구성하라.
3. collocation pattern을 확인하라.
4. academic/discourse function을 태깅하라.
5. 오답은 같은 의미장 안에서 만들되 문맥 기능이 어긋나게 하라.

금지:
- 단어장 뜻만 묻기
- 품사가 다른 오답
- 문맥 없이 제거되는 오답
```

### 36.3 서술형 심화 프롬프트

```text
다음 지문으로 서술형 문항을 제작하라.

절차:
1. 핵심 의미를 한국어로 확정한다.
2. 모범답안을 먼저 영어로 쓴다.
3. 모범답안이 character-subject, action-verb, old-to-new flow를 만족하는지 확인한다.
4. 단어 수를 계산한다.
5. 한국어 뜻, 필수어, construction hint, starter/subject 제공 여부를 정한다.
6. A/B/C 허용 답안을 만든다.
7. 조건과 채점 기준을 1:1로 연결한다.

금지:
- 첫 단어만 주고 긴 문장 요구
- 단어 수 미검증
- 채점 기준 없는 서술형
```
