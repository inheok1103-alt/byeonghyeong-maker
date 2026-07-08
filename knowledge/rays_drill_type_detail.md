# Ray's Drill 유형별 출제 로직 상세

이 문서는 Ray's Drill 문제은행과 동형모의고사를 만들 때, 각 문항 유형을 어떤 논리로 설계할지 정리한 유형별 제작 매뉴얼이다.  
핵심은 “유형 이름만 따라 만드는 것”이 아니라, 지문의 성격에 맞는 유형을 고르고, 그 유형이 요구하는 방식으로 지문·발문·선지·해설을 함께 설계하는 것이다.

---

## 0. 유형별 공통 원칙

### 0.1 모든 유형에 적용되는 기본 로직

모든 문항은 다음 순서로 만든다.

```text
지문 기능 분석
→ 적합 유형 선택
→ 유형별 지문 조작 결정
→ 정답 근거 확정
→ 오답 설계 또는 서술형 조건 설계
→ 해설 포인트 작성
→ 품질 검수
```

### 0.2 유형 선택의 핵심

지문에 맞지 않는 유형을 억지로 만들지 않는다.

| 지문 특징 | 우선 유형 |
|---|---|
| 핵심 주장 선명 | 주제, 요지, 제목, 주제문 서술형 |
| 논리 전개 뚜렷 | 빈칸, 연결어, 순서, 삽입 |
| 예시와 일반화 구조 | 순서, 삽입, 요약문, 어색한 문장 |
| 세부정보 풍부 | 일치/불일치, 내용 이해 |
| 문장 구조가 좋음 | 어법, 어법 교정 서술형, 핵심문장 복원 |
| 대화 흐름이 중요 | 목적, 의도, 응답 완성, 인터뷰형 |
| 개념 대비가 뚜렷 | 빈칸, 요지, 어색한 문장, 요약문 |

### 0.3 모든 객관식 선지 원칙

좋은 객관식은 정답 하나와 기능적 오답 네 개로 구성된다.

오답 DNA:

- 부분 참/전체 거짓
- 인과관계 전도
- 범위 과잉 일반화
- 범위 축소
- 초점 이동
- 필자 태도 왜곡
- 조건 누락
- 세부정보 혼동
- 지시어 혼동

자동 제거 대상:

```text
본문은
글은
사전적
문자적
원문보다
근거 없이
글 밖
전체 결론이 충분히
undefined
NaN
...
…
깨진 문자
```

---

## 1. 주제 유형

### 1.1 측정 능력

주제 유형은 글 전체가 다루는 중심 화제를 묻는다.  
학생이 사례, 세부정보, 배경 설명을 넘어 글 전체를 관통하는 핵심 개념을 파악하는지 평가한다.

### 1.2 적합한 지문

- 핵심 개념이 반복되는 설명문
- 사례가 하나의 일반적 결론으로 수렴하는 글
- 소재보다 글의 관점이 중요한 지문
- 첫 문단에서 문제 제기, 마지막 문단에서 일반화가 이루어지는 글

### 1.3 부적합한 지문

- 사건 나열만 있고 중심 논지가 약한 글
- 안내문처럼 목적이 더 중요한 글
- 대화문처럼 상황 이해가 우선인 글
- 세부정보 문제에 더 적합한 정보문

### 1.4 제작 로직

```text
1. 지문 전체를 한 문장으로 요약한다.
2. 그 문장에서 소재와 논지를 분리한다.
3. 정답은 소재 + 논지를 모두 포함하게 쓴다.
4. 오답은 소재만 맞거나, 논지만 비틀거나, 범위를 과장하게 만든다.
5. 정답만 유독 추상적이거나 길지 않게 조정한다.
```

### 1.5 정답 설계

정답은 다음 조건을 만족해야 한다.

- 글 전체를 포괄한다.
- 사례가 아니라 일반화된 내용이다.
- 필자의 관점 또는 설명 방향을 반영한다.
- 너무 넓지도 좁지도 않다.

### 1.6 오답 설계

| 오답 유형 | 설계 방식 |
|---|---|
| 사례 일반화 | 지문 속 한 사례를 전체 주제로 둔갑 |
| 범위 과잉 | 제한된 주장을 보편 명제로 확장 |
| 초점 이동 | 핵심 논점 대신 주변 소재를 중심화 |
| 인과 전도 | 원인과 결과를 뒤집음 |
| 태도 약화 | 필자의 결론을 단순 정보로 약화 |

### 1.7 검수 질문

- 정답이 사례가 아니라 글 전체의 화제인가?
- 오답도 지문 일부와 연결되는가?
- 정답만 너무 길거나 추상적인가?
- 두 개 이상의 선지가 주제로 가능하지 않은가?

---

## 2. 요지 유형

### 2.1 측정 능력

요지 유형은 필자가 궁극적으로 말하려는 바를 묻는다.  
주제보다 결론성과 주장성이 강하다.

### 2.2 적합한 지문

- 근거가 결론으로 수렴하는 글
- 필자의 판단이 드러나는 글
- 어떤 현상의 의미나 시사점을 설명하는 글
- 마지막 문장 또는 결론부가 강한 글

### 2.3 제작 로직

```text
1. 지문의 결론 문장을 찾는다.
2. 결론이 직접 없으면 근거들의 공통 방향을 일반화한다.
3. 정답은 “그래서 무엇을 말하는가?”에 답하게 쓴다.
4. 오답은 근거, 사례, 배경을 결론처럼 보이게 만든다.
```

### 2.4 정답 설계

- 필자의 결론 방향을 담는다.
- 단순 소재가 아니라 메시지다.
- 필요하면 “~해야 한다”, “~가 중요하다”, “~라고 볼 수 있다”의 형태를 취한다.

### 2.5 오답 설계

- 근거를 결론으로 착각
- 배경 설명을 핵심 메시지로 착각
- 필자의 강도를 과장
- 필자의 강도를 약화
- 지문 일부의 반대 입장을 결론으로 제시

### 2.6 주제와 요지 구분

| 구분 | 주제 | 요지 |
|---|---|---|
| 질문 | 무엇에 관한 글인가 | 필자가 말하려는 바는 무엇인가 |
| 성격 | 소재+초점 | 결론+메시지 |
| 정답 형태 | 명사구 가능 | 문장형 선호 |

---

## 3. 제목 유형

### 3.1 측정 능력

제목 유형은 글의 핵심 내용을 간결하고 적절한 표현으로 압축하는 능력을 본다.

### 3.2 적합한 지문

- 중심 소재가 선명한 글
- 핵심 대비나 은유가 있는 글
- 제목으로 압축하기 좋은 결론이 있는 글

### 3.3 제작 로직

```text
1. 주제와 요지를 먼저 확정한다.
2. 정답 제목은 소재와 논지를 함께 담는다.
3. 너무 설명문처럼 긴 제목은 피한다.
4. 오답은 소재만 맞거나 논지 방향을 틀리게 만든다.
```

### 3.4 정답 설계

- 간결하다.
- 글 전체를 대표한다.
- 과장하거나 감성적으로 치우치지 않는다.
- 제목만 보고도 글의 핵심 방향을 예측할 수 있다.

### 3.5 오답 설계

- 소재만 맞고 결론이 없음
- 결론은 맞지만 소재가 다름
- 너무 좁은 세부정보
- 너무 넓은 일반론
- 필자 태도와 어긋나는 표현

---

## 4. 주장 유형

### 4.1 측정 능력

주장 유형은 필자의 권고, 당위, 평가, 해결책을 파악하는 능력을 평가한다.

### 4.2 적합한 지문

- 문제 상황과 해결책이 있는 글
- 필자의 당위 표현이 있는 글
- 독자에게 행동 변화를 요구하는 글
- 사회적·윤리적 판단이 담긴 글

### 4.3 부적합한 지문

- 순수 설명문
- 객관적 소개문
- 사건이나 정보 나열문
- 결론이 판단이 아니라 설명인 글

### 4.4 제작 로직

```text
1. 필자가 요구하거나 권하는 행동을 찾는다.
2. 그 행동의 이유를 근거로 확인한다.
3. 정답은 행동 방향과 이유를 함께 담게 한다.
4. 오답은 행동 방향, 대상, 강도를 비튼다.
```

### 4.5 오답 설계

- 권고 대상을 바꿈
- 문제 원인을 바꿈
- 해결책을 반대로 제시
- 필자의 강도를 과장
- 설명 정보를 주장처럼 제시

---

## 5. 목적 유형

### 5.1 측정 능력

목적 유형은 글쓴이가 글을 쓴 의도를 파악하는 유형이다.

### 5.2 적합한 지문

- 안내문
- 공지문
- 이메일
- 편지
- 연설문
- 광고문
- 대화문
- 인터뷰 자료

### 5.3 제작 로직

```text
1. 글의 상황을 파악한다.
2. 발신자와 수신자를 확인한다.
3. 글쓴이가 독자에게 원하는 반응을 찾는다.
4. 정답은 요청/안내/설득/사과/감사/경고 등 기능으로 쓴다.
5. 오답은 상황은 비슷하지만 의도가 다른 것으로 만든다.
```

### 5.4 오답 설계

- 안내를 요청으로 바꿈
- 사과를 항의로 바꿈
- 홍보를 경고로 바꿈
- 정보 제공을 설득으로 바꿈
- 대상 독자를 바꿈

---

## 6. 내용 일치 유형

### 6.1 측정 능력

내용 일치는 지문 속 세부정보를 정확히 확인하는 능력을 본다.

### 6.2 적합한 지문

- 인물, 사건, 수치, 장소, 조건이 많은 지문
- 설명 대상의 특징이 여러 개 제시된 지문
- 시간 순서가 있는 글

### 6.3 제작 로직

```text
1. 지문에서 검증 가능한 정보 5개를 뽑는다.
2. 정답 선지는 지문과 정확히 일치하게 쓴다.
3. 오답 선지는 주체, 시간, 조건, 수량, 원인 중 하나를 바꾼다.
4. 모든 선지가 지문 근거 위치를 갖게 한다.
```

### 6.4 오답 변형 방식

- 주체 변경
- 대상 변경
- 시간 변경
- 수량 변경
- 장소 변경
- 조건 누락
- 원인/결과 뒤집기
- 정도 표현 바꾸기

### 6.5 검수 질문

- 선지마다 지문 근거가 있는가?
- 오답이 지문 밖 정보를 무작위로 넣은 것은 아닌가?
- 정답 선지만 지나치게 자세하지 않은가?

---

## 7. 내용 불일치 유형

### 7.1 측정 능력

불일치 유형은 지문을 정확히 읽고 틀린 정보를 찾아내는 능력을 본다.

### 7.2 제작 로직

```text
1. 맞는 선지 4개와 틀린 선지 1개를 만든다.
2. 틀린 선지는 지문 정보 중 하나만 교묘히 바꾼다.
3. 맞는 선지도 너무 쉬운 복붙이 되지 않게 패러프레이즈한다.
4. 틀린 선지가 문장 길이로 드러나지 않게 한다.
```

### 7.3 좋은 불일치 오답

나쁜 방식:

```text
지문에 전혀 없는 내용을 갑자기 넣음
```

좋은 방식:

```text
지문에 나온 정보의 주체, 조건, 정도, 순서 중 하나를 바꿈
```

### 7.4 검수 질문

- 틀린 선지가 하나뿐인가?
- 맞는 선지 4개도 지문과 정확히 대응되는가?
- 틀린 선지가 너무 노골적이지 않은가?

---

## 8. 빈칸 유형

### 8.1 측정 능력

빈칸은 문맥과 논리를 통해 빠진 핵심 표현을 복원하는 능력을 평가한다.

### 8.2 좋은 빈칸 위치

| 위치 | 품질 |
|---|---|
| 결론 핵심어 | 매우 좋음 |
| 대조 뒤 반전 표현 | 매우 좋음 |
| 인과관계 결과 | 좋음 |
| 예시를 일반화하는 표현 | 좋음 |
| 요약 표현 | 좋음 |
| 단순 세부 명사 | 약함 |
| 고유명사/수치 | 금지 |

### 8.3 제작 로직

```text
1. 지문의 논리 구조를 표시한다.
2. 결론, 대조, 인과, 일반화 지점 중 하나를 고른다.
3. 해당 표현을 실제 공통 지문에서 빈칸 처리한다.
4. 정답은 앞뒤 문맥을 모두 만족하게 한다.
5. 오답은 품사와 문법은 맞지만 논리 방향이 어긋나게 만든다.
```

### 8.4 선지 설계

정답:

- 앞 문장과 뒤 문장 모두에 맞음
- 글 전체의 논리와 일치
- 품사와 구조가 자연스러움

오답:

- 앞 문장에는 맞지만 뒤 문장에는 안 맞음
- 뒤 문장에는 맞지만 앞 문장에는 안 맞음
- 핵심 논리 방향 반대
- 범위가 너무 넓거나 좁음
- 지문 일부 사례에만 맞음

### 8.5 검수 질문

- 빈칸 없이도 답이 너무 쉽게 보이는가?
- 정답이 지문 다른 곳에 그대로 노출되어 있는가?
- 오답들도 문법적으로 들어갈 수 있는가?
- 논리상 정답이 하나뿐인가?

---

## 9. 함축 의미 유형

### 9.1 측정 능력

함축 의미는 밑줄 친 표현이 문맥 속에서 갖는 의미를 파악하는 유형이다.

### 9.2 적합한 지문

- 비유 표현이 있는 지문
- 추상 개념을 구체 표현으로 설명하는 지문
- 문맥상 의미가 사전적 의미와 다른 표현이 있는 지문

### 9.3 제작 로직

```text
1. 문맥 의존적인 표현을 고른다.
2. 그 표현의 사전적 의미가 아니라 글 속 기능을 파악한다.
3. 정답은 문맥상 의미를 자연스럽게 풀어 쓴다.
4. 오답은 문자적 의미, 과잉 해석, 일부 문맥만 반영하게 만든다.
```

### 9.4 주의

학생용 선지에 “문자적 의미”, “사전적 의미” 같은 말을 쓰지 않는다.  
그런 표현은 제작자 내부 기준으로만 사용한다.

### 9.5 오답 설계

- 표현의 표면 의미만 반영
- 앞 문맥만 반영
- 뒤 문맥만 반영
- 결론 방향과 반대
- 너무 넓은 추상화

---

## 10. 어휘 유형

### 10.1 측정 능력

어휘 유형은 단어의 사전적 뜻보다 문맥상 적절성을 판단하는 능력을 본다.

### 10.2 유형 구분

- 문맥상 적절한 낱말
- 문맥상 부적절한 낱말
- 밑줄 친 단어의 의미
- 대체 가능한 표현
- 어휘 변형 지문 기반 빈칸

### 10.3 제작 로직

```text
1. 지문에서 의미 방향이 중요한 단어를 고른다.
2. 해당 단어가 문맥에서 어떤 역할을 하는지 파악한다.
3. 정답 또는 오류 단어를 정한다.
4. 오답은 의미장 안에서 헷갈릴 만한 단어로 구성한다.
```

### 10.4 좋은 어휘 포인트

- 대조 관계를 결정하는 단어
- 인과관계를 드러내는 동사
- 필자 태도를 나타내는 형용사
- 핵심 개념을 압축하는 명사
- 문맥상 의미가 사전 뜻과 달라지는 단어

### 10.5 금지

- 너무 지엽적인 단어
- 단어장 암기로만 맞히는 문항
- 문맥 없이도 답이 되는 문항
- 고1 범위를 심하게 벗어난 동의어 나열

---

## 11. 어법 객관식 유형

### 11.1 측정 능력

어법 유형은 문장 구조와 문맥 속 언어 형식을 판단하는 능력을 본다.

### 11.2 권장 포인트

- 수일치
- 시제
- 태
- 관계사
- 분사
- 준동사
- 병렬
- 비교
- 접속사/전치사
- 명사절/부사절
- 대명사 지칭

### 11.3 제작 로직

```text
1. 지문에서 구조가 선명한 문장을 찾는다.
2. 고1 수준에서 설명 가능한 문법 포인트를 고른다.
3. 정답 근거가 문장 안에 명확히 있도록 한다.
4. 오답 또는 오류는 문맥과 구조를 보면 판단 가능하게 만든다.
```

### 11.4 좋은 어법 문항

- 문장 구조 분석이 필요함
- 지문 맥락이 약간 필요함
- 정답 근거가 명확함
- 해설에서 학교 문법으로 설명 가능함

### 11.5 나쁜 어법 문항

- 원어민도 판단이 갈림
- 두 형태가 모두 가능함
- 문맥과 무관한 문법 퍼즐
- 지나치게 지엽적임
- 구문 변환만을 위한 부자연스러운 문장

---

## 12. 연결어 유형

### 12.1 측정 능력

연결어 유형은 문장 또는 문단 사이의 논리 관계를 파악하는 능력을 본다.

### 12.2 주요 관계

- 순접
- 대조
- 양보
- 인과
- 예시
- 재진술
- 결론
- 추가
- 전환

### 12.3 제작 로직

```text
1. 앞뒤 문장의 의미 관계를 확정한다.
2. 연결어를 빈칸 처리한다.
3. 정답은 관계를 가장 정확히 드러내게 한다.
4. 오답은 표면적으로 가능하지만 실제 논리관계가 다른 것으로 구성한다.
```

### 12.4 오답 설계

- 대조 자리에 인과
- 인과 자리에 예시
- 예시 자리에 결론
- 재진술 자리에 전환
- 순접 자리에 양보

### 12.5 검수 질문

- 앞뒤 관계가 하나로 명확한가?
- 연결어 없이도 문맥상 관계가 보이는가?
- 오답도 문법적으로는 자연스러운가?

---

## 13. 문장삽입 유형

### 13.1 측정 능력

문장삽입은 지문 응집성, 지시어, 연결어, 정보 순서를 파악하는 능력을 본다.

### 13.2 핵심 원칙

삽입할 문장은 반드시 공통 지문에서 제거되어야 한다.

### 13.3 제작 로직

```text
1. 원문에서 응집성이 강한 문장을 고른다.
2. 그 문장을 지문에서 제거한다.
3. 남은 지문에 (A)~(E)를 넣는다.
4. 제거 문장을 [주어진 문장]으로 제시한다.
5. 정답 근거를 최소 2개 이상 확보한다.
```

### 13.4 좋은 삽입 문장

- this, these, such, it, they 등 지시어가 있음
- however, therefore, for example 등 연결어가 있음
- 앞 문장 내용을 받아 확장함
- 뒤 문장의 예시나 결론을 준비함
- 아무 위치에나 들어가지 않음

### 13.5 오답 위치 설계

- 앞 문장과만 연결됨
- 뒤 문장과만 연결됨
- 지시어 선행사가 없음
- 예시와 일반화 순서가 뒤집힘
- 대조 관계가 깨짐

### 13.6 검수 질문

- 삽입 문장이 지문 안에 그대로 남아 있지 않은가?
- 정답 위치 근거가 명확한가?
- 다른 위치도 정답으로 주장 가능하지 않은가?

---

## 14. 글의 순서 유형

### 14.1 측정 능력

글의 순서는 문장 또는 문단의 담화 기능과 논리 전개를 파악하는 능력을 본다.

### 14.2 제작 로직

```text
1. 지문을 기능 단위로 3개 블록으로 나눈다.
2. 각 블록의 담화 기능을 표시한다.
3. 연결어, 대명사, 반복어 단서를 유지한다.
4. 정답 순서를 정한다.
5. 오답 순서는 논리 기능이 깨지게 만든다.
```

### 14.3 블록 기능

- 도입
- 문제 제기
- 배경 설명
- 원인
- 사례
- 반전
- 해결
- 결론

### 14.4 좋은 분할

- 첫 블록이 배경이나 문제 제기
- 두 번째 블록이 확장 또는 사례
- 세 번째 블록이 결론 또는 재진술
- 블록 사이에 지시어와 연결어 단서가 있음

### 14.5 나쁜 분할

- 아무 문장이나 기계적으로 자름
- 블록들이 각각 독립적으로 완결됨
- 순서 단서가 없음
- 원문 암기 없이는 풀 수 없음

---

## 15. 어색한 문장 유형

### 15.1 측정 능력

어색한 문장은 문단 통일성과 논리 흐름을 파악하는 능력을 본다.

### 15.2 제작 로직

```text
1. 원 지문의 주제와 전개 방향을 확정한다.
2. 같은 소재권에 있지만 논리 기능이 다른 문장을 만든다.
3. 그 문장을 지문 중간에 삽입한다.
4. 주변 문장과의 연결 붕괴를 정답 근거로 삼는다.
```

### 15.3 좋은 어색한 문장

- 소재는 비슷함
- 결론 방향은 다름
- 전후 연결을 깨뜨림
- 너무 노골적으로 튀지 않음

### 15.4 나쁜 어색한 문장

- 완전히 다른 소재
- 문체가 너무 다름
- 다른 문장도 어색해 보임
- 정답 근거가 느낌뿐임

---

## 16. 요약문 완성 유형

### 16.1 측정 능력

요약문 완성은 지문 전체의 핵심 내용을 압축하고 재구성하는 능력을 본다.

### 16.2 제작 로직

```text
1. 지문을 1~2문장으로 요약한다.
2. 핵심 개념 1~2개를 빈칸 처리한다.
3. 정답은 원문어 또는 패러프레이즈로 만든다.
4. 오답은 범위, 초점, 논리 관계를 비튼다.
```

### 16.3 좋은 요약문

- 지문 전체를 포괄함
- 세부 사례가 아니라 중심 논리를 담음
- 원문 표현을 그대로 복붙하지 않음
- 빈칸이 핵심 개념임

### 16.4 오답 설계

- 사례를 핵심어로 둔갑
- 원인과 결과 전도
- 결론 범위 과장
- 필자 태도 왜곡
- 핵심 대비 약화

---

## 17. 지칭 추론 유형

### 17.1 측정 능력

지칭 추론은 대명사나 지시어가 가리키는 대상을 문맥 속에서 파악하는 능력을 본다.

### 17.2 적합한 지문

- 인물이나 개념이 여럿 등장
- this, that, these, those, it, they가 자주 등장
- 앞뒤 문맥 연결이 중요한 글

### 17.3 제작 로직

```text
1. 지칭 대상이 명확하지만 즉시 obvious하지 않은 지시어를 고른다.
2. 지칭 대상 후보를 선지로 만든다.
3. 오답은 가까운 명사, 같은 범주의 다른 개념, 앞 문장의 다른 요소로 만든다.
```

### 17.4 검수 질문

- 지칭 대상이 하나로 확정되는가?
- 문법적 수와 의미가 모두 맞는가?
- 가까운 명사만 보고 찍는 문제가 아닌가?

---

## 18. 근거문장 찾기 유형

### 18.1 측정 능력

근거문장 찾기는 특정 결론이나 답을 뒷받침하는 문장을 지문에서 찾는 능력을 본다.

### 18.2 제작 로직

```text
1. 지문의 핵심 결론이나 세부 판단을 정한다.
2. 그 판단을 직접 뒷받침하는 근거 문장을 찾는다.
3. 선지는 문장 번호 또는 위치로 구성한다.
4. 오답은 관련은 있지만 직접 근거가 아닌 문장으로 만든다.
```

### 18.3 좋은 오답

- 배경 설명
- 예시 문장
- 반대 입장 문장
- 결론과 관련은 있으나 직접 근거는 아닌 문장

---

## 19. 대화문 유형

### 19.1 측정 능력

대화문은 상황, 화자의 의도, 응답의 적절성, 정보 흐름을 파악하는 능력을 본다.

### 19.2 적합 유형

- 목적
- 의도
- 응답 완성
- 내용 일치
- 빈칸 대화 완성
- 인터뷰형 서술형

### 19.3 제작 로직

```text
1. 대화의 상황을 파악한다.
2. 화자 관계와 목적을 정리한다.
3. 빈칸 또는 응답 위치를 고른다.
4. 정답은 앞뒤 발화의 기능을 만족하게 한다.
5. 오답은 말은 되지만 상황, 태도, 정보가 어긋나게 만든다.
```

### 19.4 오답 설계

- 상대 질문에 답하지 않음
- 지나치게 무례한 반응
- 앞서 나온 정보와 충돌
- 대화 목적과 다른 응답
- 화자 관계에 맞지 않는 말투

---

## 20. 인터뷰형 유형

### 20.1 측정 능력

인터뷰형은 지문 내용을 다른 담화 상황으로 전환해 이해하는 능력을 본다.

### 20.2 제작 로직

```text
1. 원문 핵심 내용을 인터뷰 상황으로 바꾼다.
2. 질문자는 핵심 논점을 묻는다.
3. 답변자는 지문 내용을 바탕으로 대답한다.
4. 빈칸, 응답 완성, 주제문 서술형으로 출제한다.
```

### 20.3 좋은 인터뷰형

- 원문 내용이 담화 상황에 자연스럽게 변환됨
- 질문이 핵심 논지를 겨냥함
- 답변이 지문 근거로 해결됨
- 단순 말바꾸기가 아니라 이해를 요구함

### 20.4 서술형 활용

```text
다음 인터뷰에서 전문가의 답변이 되도록,
글의 핵심 내용을 영어 한 문장으로 쓰시오.
```

이 경우 주제문 서술형과 결합하기 좋다.

---

## 21. 삽화형 유형

### 21.1 측정 능력

삽화형은 지문 내용을 시각 상황과 연결해 이해하는 능력을 본다.

### 21.2 제작 로직

```text
1. 지문의 핵심 장면, 대립, 과정, 관계를 시각화한다.
2. 삽화가 답을 직접 노출하지 않도록 한다.
3. 삽화는 문제 상황 이해를 돕는 보조 자료로 둔다.
4. 객관식 또는 서술형과 결합한다.
```

### 21.3 적합한 지문

- 과정 설명
- 사회적 상황
- 인물 인터뷰
- 두 관점의 대립
- 실험 또는 관찰

### 21.4 금지

- 삽화만 보고 답이 나옴
- 지문보다 삽화 정보가 더 많음
- 장식용 이미지
- 흑백 인쇄 시 알아보기 어려운 이미지

---

## 22. 주제문 서술형

### 22.1 측정 능력

주제문 서술형은 글의 중심 내용을 영어 한 문장으로 재구성하는 능력을 본다.

### 22.2 제작 로직

```text
1. 지문의 핵심 결론을 먼저 한 문장으로 쓴다.
2. 고1 수준의 어휘와 구조로 조정한다.
3. 단어 수를 계산한다.
4. 필요한 필수어와 시작구를 정한다.
5. 채점 기준과 허용 답안을 만든다.
```

### 22.3 조건 제공

기본:

- 한국어 뜻
- 단어 수
- 필수 단어
- 어형 변화 가능 여부

필요 시:

- 주어
- 시작구
- 접속사
- 핵심 동사

### 22.4 검수 질문

- 모범답안이 자연스러운가?
- 단어 수가 정확한가?
- 학생이 조건만 보고 실제로 쓸 수 있는가?
- 너무 자유영작이 되어 채점이 어려운가?

---

## 23. 내용 이해 서술형

### 23.1 측정 능력

내용 이해 서술형은 지문 정보를 영어 또는 한국어로 간단히 재구성하는 능력을 본다.

### 23.2 제작 로직

```text
1. 지문에서 핵심 질문 하나를 만든다.
2. 답은 지문에 근거하되 그대로 베끼지 않아도 되게 한다.
3. 답의 범위를 명확히 한다.
4. 채점 기준을 2~3요소로 나눈다.
```

### 23.3 좋은 문항

- 답이 너무 길지 않음
- 지문 근거가 분명함
- 채점 기준이 명확함
- 부분 점수를 줄 수 있음

### 23.4 나쁜 문항

- 답이 너무 자유로움
- 정답 범위가 애매함
- 지문 한 문장을 통째로 베끼는 문제
- 한국어로도 답하기 어려운 추상 질문

---

## 24. 조건부 영작 서술형

### 24.1 측정 능력

조건부 영작은 지문 이해와 영어 문장 구성 능력을 함께 본다.

### 24.2 제작 로직

```text
1. 모범답안을 먼저 만든다.
2. 단어 수를 정확히 센다.
3. 필수 단어를 고른다.
4. 어형 변화 가능 여부를 명시한다.
5. 한국어 뜻 또는 충분한 힌트를 제공한다.
6. 필요하면 주어 또는 시작구를 제공한다.
```

### 24.3 힌트 제공 규칙

| 상황 | 처리 |
|---|---|
| 한국어 뜻 제공 | 필수어는 적당히 제공 |
| 한국어 뜻 미제공 | 필수어를 더 많이 제공 |
| 첫 단어만으로 어려움 | 주어 또는 시작구 제공 |
| 필수어가 주어와 겹침 | 다른 핵심어를 힌트로 제공 |
| 구조가 복잡함 | 접속사 또는 동사 제공 |

### 24.4 검수 질문

- 정답을 먼저 만들었는가?
- 단어 수가 정확한가?
- 필수어가 충분한가?
- 힌트가 너무 적어 불가능하지 않은가?
- 힌트가 너무 많아 베껴쓰기만 되는가?

---

## 25. 어법 교정 서술형

### 25.1 측정 능력

어법 교정 서술형은 문맥 속 문법 오류를 찾아 수정하는 능력을 본다.

### 25.2 대표 형식

```text
다음 글에서 어법상 틀린 곳 7개 중 4개를 찾아 바르게 고쳐 쓰시오.
```

### 25.3 제작 로직

```text
1. 원문 또는 변형 지문을 준비한다.
2. 고1 수준 어법 오류 7개를 삽입한다.
3. 오류 유형이 겹치지 않게 한다.
4. 학생은 4개만 고치게 하여 부담을 조절한다.
5. 해설에는 7개 모두의 정답과 근거를 제시한다.
```

### 25.4 오류 후보

- 수일치
- 시제
- 능동/수동
- 관계사
- 분사
- 준동사
- 병렬
- 비교
- 접속사/전치사
- 대명사 수일치

### 25.5 검수 질문

- 모든 오류가 실제로 오류인가?
- 고칠 답이 하나로 정해지는가?
- 같은 문법 포인트만 반복하지 않는가?
- 원문 의미가 훼손되지 않았는가?

---

## 26. 핵심문장 복원 서술형

### 26.1 측정 능력

핵심문장 복원은 지문 중심 문장을 조건에 맞게 다시 쓰는 능력을 본다.

### 26.2 제작 로직

```text
1. 지문의 핵심 문장을 고른다.
2. 문장 일부를 빈칸 처리하거나 단어 배열로 제시한다.
3. 필요한 단어와 구조 힌트를 제공한다.
4. 정답은 원문 그대로 또는 의미 보존 변형으로 허용한다.
```

### 26.3 주의

이 유형은 구문변환만 묻는 문제로 흐르지 않게 한다.  
항상 내용 이해와 연결되어야 한다.

---

## 27. 배열 영작 유형

### 27.1 측정 능력

배열 영작은 주어진 단어를 문맥에 맞는 영어 문장으로 배열하는 능력을 본다.

### 27.2 제작 로직

```text
1. 정답 문장을 먼저 만든다.
2. 단어 또는 구 단위로 나눈다.
3. 필요하면 어형 변화 가능 조건을 둔다.
4. 주어가 불명확하면 주어 또는 시작구를 제공한다.
5. 답이 여러 개 가능하지 않도록 조건을 조정한다.
```

### 27.3 금지

- 단어만 던져놓고 구조 힌트 없음
- the 같은 첫 단어만 제공
- 단어 수와 정답 불일치
- 여러 문장이 가능한 배열

---

## 28. 유형 조합 로직

### 28.1 한 지문 1문항

사용:

- 지문이 짧음
- 핵심 포인트가 하나
- 난이도가 높음

추천 조합:

- 빈칸 1
- 어법 1
- 주제문 서술형 1

### 28.2 한 지문 2문항

사용:

- 내용 이해와 언어 형식 포인트가 모두 있음

추천 조합:

- 주제 + 어법
- 일치/불일치 + 빈칸
- 제목 + 문장삽입
- 내용 이해 + 서술형

### 28.3 한 지문 3문항

사용:

- 지문이 길고 논리 구조가 풍부함

추천 조합:

- 주제 + 빈칸 + 어법
- 일치/불일치 + 삽입 + 서술형
- 순서 + 어색한 문장 + 요약문

금지:

- 빈칸 + 삽입 + 순서를 한 공통 지문에 동시에 조작
- 앞 문항 선지가 뒤 문항 답을 노출
- 같은 근거 문장만 반복 사용

---

## 29. 유형별 난이도 조절

### 29.1 쉬움

- 원문 그대로
- 근거가 가까움
- 오답이 비교적 명확함
- 한국어 뜻과 단어 힌트 충분

### 29.2 표준

- 어휘 또는 구문 일부 변형
- 근거가 2문장 이상 걸쳐 있음
- 오답이 부분적으로 그럴듯함
- 서술형 조건이 명확함

### 29.3 어려움

- 전체 변형
- 근거가 지문 전체에 퍼져 있음
- 오답이 논리적으로 매력적임
- 서술형은 주제문·요약 중심
- 단, 힌트는 여전히 충분해야 함

---

## 30. 유형별 최종 검수표

| 유형 | 핵심 검수 |
|---|---|
| 주제 | 사례가 아니라 전체 주제인가 |
| 요지 | 필자의 결론인가 |
| 제목 | 소재와 논지를 모두 담는가 |
| 주장 | 실제 주장성이 있는 지문인가 |
| 목적 | 글쓴이 의도가 명확한가 |
| 일치/불일치 | 선지마다 근거가 있는가 |
| 빈칸 | 앞뒤 문맥 모두로 풀리는가 |
| 함축 | 문맥상 의미를 묻는가 |
| 어휘 | 문맥 판단이 필요한가 |
| 어법 | 정답 근거가 하나인가 |
| 연결어 | 논리 관계가 명확한가 |
| 삽입 | 삽입 문장이 지문에서 제거됐는가 |
| 순서 | 블록 기능이 살아 있는가 |
| 어색한 문장 | 소재는 비슷하고 논리만 어긋나는가 |
| 요약문 | 전체 내용을 압축하는가 |
| 지칭 | 지칭 대상이 하나인가 |
| 대화문 | 상황과 응답이 자연스러운가 |
| 인터뷰 | 원문 이해를 담화 전환으로 묻는가 |
| 삽화 | 삽화가 답을 노출하지 않는가 |
| 주제문 서술형 | 모범답안과 단어 수가 정확한가 |
| 조건부 영작 | 힌트가 충분한가 |
| 어법 교정 | 오류가 명확하고 고1 수준인가 |

---

## 31. 유형별 제작 프롬프트 템플릿

### 31.1 객관식 공통

```text
다음 지문으로 [유형명] 문항을 제작하라.

조건:
1. 지문에 맞는 경우에만 해당 유형을 사용한다.
2. 필요한 경우 공통 지문 안에 조작을 반영한다.
3. 정답 근거를 먼저 확정한다.
4. 오답 4개는 기능적 오답으로 만든다.
5. 선지 길이와 문체를 비슷하게 맞춘다.
6. 정답은 하나만 가능해야 한다.
7. 해설에는 출제의도, 정답 근거, 오답별 이유를 포함한다.
```

### 31.2 서술형 공통

```text
다음 지문으로 [서술형 유형명] 문항을 제작하라.

조건:
1. 모범답안을 먼저 작성한다.
2. 단어 수를 정확히 계산한다.
3. 한국어 뜻, 필수어, 어형 변화 가능 여부를 제시한다.
4. 필요하면 주어 또는 시작구를 제공한다.
5. 허용 답안과 채점 기준을 함께 작성한다.
6. 학생이 실제로 쓸 수 있는 난이도로 조정한다.
```

---

## 32. 운영 결론

유형별 출제 로직의 핵심은 다음이다.

```text
지문 성격에 맞는 유형을 고른다.
유형이 요구하는 방식으로 지문을 조작한다.
정답 근거를 먼저 확정한다.
오답은 학생의 실제 오독을 반영한다.
서술형은 모범답안에서 조건을 역산한다.
최종본에는 검수된 문항만 남긴다.
```

---

## 33. 유형별 로직을 실제 제작 단위로 바꾸는 방법

앞의 1~32장은 유형별 원리를 설명한다.  
실제 제작에서는 이 원리를 그대로 문항 카드, JSON 데이터, 검수 게이트, GitHub 이슈/PR 단위로 쪼개야 한다.

### 33.1 문항 하나는 반드시 카드로 관리한다

문항 하나는 단순한 문제 텍스트가 아니라 다음 정보를 포함한 제작 카드다.

```text
문항 ID
출처 ID
원천 지문
변형 지문
문항 유형
측정 능력
공통 지문 조작 방식
발문
선지
정답
정답 근거
오답 DNA
출제의도
해설
어휘
구문
배경지식
품질 점수
검수 상태
```

문항 카드가 없으면 나중에 다음 문제가 생긴다.

- 정답 근거가 사라짐
- 오답을 왜 만들었는지 설명 불가
- 해설지 확장이 어려움
- 같은 지문에서 중복 문항이 생김
- GitHub 이슈로 추적하기 어려움
- Claude/Codex가 서로 무엇을 검수해야 하는지 모름

### 33.2 유형별 문항 카드 공통 템플릿

```yaml
item_id:
source_id:
source_label:
transformation_level: T0 | T1 | T2 | T3
question_type:
cognitive_target:
common_passage_mode:
common_passage:
prompt:
question_body:
choices:
answer:
evidence:
distractor_dna:
intent:
explanation:
vocab_notes:
syntax_notes:
background_note:
quality_score:
status: draft | needs_review | revised | ready | rejected
review_notes:
```

### 33.3 객관식 문항 카드 필수 검수

객관식은 다음을 통과해야 한다.

```text
choices가 정확히 5개인가
정답이 choices 안에 있는가
정답이 하나뿐인가
각 오답에 오답 DNA가 있는가
정답 근거 문장이 있는가
선지 금지 패턴이 없는가
선지 길이가 지나치게 불균형하지 않은가
공통 지문 조작이 유형과 일치하는가
```

### 33.4 서술형 문항 카드 필수 검수

서술형은 다음을 통과해야 한다.

```text
model_answer가 있는가
word_count가 model_answer와 일치하는가
korean_meaning 또는 충분한 힌트가 있는가
given_words가 적절한가
inflection_allowed가 명시되어 있는가
starter 또는 subject 제공이 필요한지 판단했는가
rubric이 있는가
acceptable_variants가 필요한 경우 제공되었는가
```

---

## 34. 유형별 `common_passage_mode` 표준

문항 유형은 반드시 공통 지문 조작 모드와 연결되어야 한다.

| 유형 | mode | 지문 처리 |
|---|---|---|
| 주제 | plain | 원문 또는 변형 지문 그대로 |
| 요지 | plain | 원문 또는 변형 지문 그대로 |
| 제목 | plain | 원문 또는 변형 지문 그대로 |
| 주장 | plain | 원문 또는 변형 지문 그대로 |
| 목적 | plain | 원문 또는 대화/안내문 형태 유지 |
| 내용 일치 | plain | 원문 또는 변형 지문 그대로 |
| 내용 불일치 | plain | 원문 또는 변형 지문 그대로 |
| 빈칸 | blank_marked | 정답 구간을 `________` 처리 |
| 함축 의미 | underlined | 밑줄 표현 표시 |
| 어휘 | underlined | 판단 대상 단어 표시 |
| 어법 | grammar_marked | 밑줄 또는 번호 표시 |
| 연결어 | connector_blank | 연결어 위치를 빈칸 처리 |
| 문장삽입 | insertion_marked | 삽입 문장을 제거하고 위치 표시 |
| 글의 순서 | order_marked | 블록 A/B/C 분리 |
| 어색한 문장 | irrelevant_numbered | 문장 번호 부여 후 어색한 문장 삽입 |
| 요약문 | summary_blank | 지문 + 요약문 빈칸 |
| 지칭 추론 | reference_marked | 지시어 표시 |
| 근거문장 찾기 | sentence_numbered | 문장 번호 부여 |
| 대화문 | dialogue_plain 또는 dialogue_blank | 대화 흐름 유지 또는 응답 빈칸 |
| 인터뷰형 | interview_transform | 원문을 인터뷰 상황으로 변환 |
| 삽화형 | visual_context | 삽화 + 지문/문항 결합 |
| 주제문 서술형 | cr_theme_sentence | 지문 유지, 답안 조건 제공 |
| 조건부 영작 | cr_guided_writing | 조건과 힌트 제공 |
| 어법 교정 서술형 | cr_grammar_correction | 오류 삽입 지문 제공 |

### 34.1 mode 불일치 시 즉시 FAIL

다음은 실패다.

```text
문장삽입인데 mode가 plain
빈칸인데 common_passage에 blank가 없음
어법인데 표시된 지점이 없음
순서인데 블록이 분리되지 않음
어색한 문장인데 문장 번호가 없음
서술형인데 model_answer가 없음
```

---

## 35. 유형별 생성 알고리즘

### 35.1 주제 생성 알고리즘

```text
INPUT: source passage
1. passage의 반복 개념을 추출한다.
2. 결론 문장 또는 마지막 일반화 문장을 찾는다.
3. 소재 noun phrase와 논지 predicate를 분리한다.
4. 정답 선지는 소재+논지를 모두 담는다.
5. 오답 4개는 다음 DNA로 만든다.
   - 사례 일반화
   - 범위 과잉
   - 초점 이동
   - 태도 왜곡
6. 다섯 선지의 추상도를 맞춘다.
7. 정답만 길거나 구체적이면 재작성한다.
OUTPUT: topic item
```

### 35.2 요지 생성 알고리즘

```text
INPUT: source passage
1. 필자의 최종 결론을 찾는다.
2. 결론이 명시되지 않으면 근거들의 공통 방향을 추론한다.
3. 정답은 문장형으로 만든다.
4. 오답은 근거/사례/배경을 결론으로 오해하게 만든다.
5. 정답과 오답 모두 같은 정도의 일반성을 갖게 한다.
OUTPUT: main idea item
```

### 35.3 제목 생성 알고리즘

```text
INPUT: source passage
1. 주제와 요지를 먼저 만든다.
2. 둘을 압축한 제목형 표현을 만든다.
3. 정답은 소재와 논지를 동시에 담는다.
4. 오답은 소재만 맞거나 논지만 틀리게 만든다.
5. 제목 길이는 대체로 비슷하게 맞춘다.
OUTPUT: title item
```

### 35.4 빈칸 생성 알고리즘

```text
INPUT: source passage
1. 논리 구조를 표시한다.
   - 도입
   - 배경
   - 대조
   - 원인
   - 결과
   - 예시
   - 결론
2. 결론/대조/인과/일반화 지점 중 하나를 고른다.
3. 정답 표현을 제거하고 blank를 삽입한다.
4. 정답 선지는 원래 표현 또는 자연스러운 패러프레이즈로 만든다.
5. 오답은 품사와 문법은 맞지만 논리 방향이 틀리게 만든다.
6. 정답 표현이 지문 다른 곳에 노출되는지 확인한다.
OUTPUT: blank item
```

### 35.5 문장삽입 생성 알고리즘

```text
INPUT: source passage
1. 지시어, 연결어, 반복어가 있는 문장을 후보로 뽑는다.
2. 후보 문장이 앞 문장을 받고 뒤 문장을 여는지 확인한다.
3. 해당 문장을 지문에서 제거한다.
4. 남은 지문에 위치 표시를 넣는다.
5. 정답 위치 근거를 2개 이상 확보한다.
6. 오답 위치는 앞뒤 한쪽만 그럴듯하게 만든다.
7. 제거 문장이 지문에 남아 있지 않은지 검사한다.
OUTPUT: insertion item
```

### 35.6 글의 순서 생성 알고리즘

```text
INPUT: source passage
1. 담화 기능 단위로 3블록을 만든다.
2. 각 블록의 기능을 태깅한다.
   - 도입
   - 배경
   - 문제
   - 사례
   - 반전
   - 결론
3. 블록 사이 연결 단서를 보존한다.
4. 정답 순서를 정한다.
5. 오답 순서는 기능 연결이 깨지도록 만든다.
6. 블록 하나만 읽고도 순서가 확정되지 않게 조정한다.
OUTPUT: order item
```

### 35.7 어법 생성 알고리즘

```text
INPUT: source passage
1. 구조가 선명한 문장을 찾는다.
2. 고1 수준 문법 포인트를 태깅한다.
3. 정답 근거가 문장 안에서 확인되는지 검토한다.
4. 객관식이면 5개 지점 중 1개 오류 또는 1개 정답을 만든다.
5. 서술형이면 오류 7개 중 4개 수정형으로 확장한다.
6. 원문 의미를 훼손하지 않는다.
OUTPUT: grammar item
```

### 35.8 일치/불일치 생성 알고리즘

```text
INPUT: source passage
1. 검증 가능한 정보 단위 5개를 추출한다.
2. 각 정보 단위에 근거 문장을 연결한다.
3. 일치형은 정답 1개와 오답 4개를 만든다.
4. 불일치형은 맞는 선지 4개와 틀린 선지 1개를 만든다.
5. 오답은 주체/조건/시간/수량/원인/결과 중 하나만 바꾼다.
6. 선지 길이와 정보량을 맞춘다.
OUTPUT: factual item
```

### 35.9 서술형 생성 알고리즘

```text
INPUT: source passage
1. 학생에게 요구할 답을 먼저 쓴다.
2. 답이 지문 이해 기반인지 확인한다.
3. 모범답안을 고1 수준으로 다듬는다.
4. 단어 수를 정확히 센다.
5. 한국어 뜻, 필수어, 어형 변화 가능 여부를 정한다.
6. 첫 단어만으로 부족하면 주어 또는 시작구를 제공한다.
7. 채점 기준과 허용 답안을 작성한다.
OUTPUT: constructed response item
```

---

## 36. 유형별 실패 사례와 수정법

### 36.1 주제 유형 실패

실패:

```text
정답이 지문 속 사례 하나만 말한다.
```

수정:

```text
사례가 뒷받침하는 일반 원리를 정답으로 바꾼다.
```

### 36.2 빈칸 유형 실패

실패:

```text
빈칸에 들어갈 말이 지문 앞에 그대로 반복되어 있다.
```

수정:

```text
반복어가 아니라 결론을 압축하는 표현을 빈칸으로 삼는다.
```

### 36.3 삽입 유형 실패

실패:

```text
삽입 문장이 공통 지문 안에 그대로 남아 있다.
```

수정:

```text
삽입 문장을 실제로 제거하고, 제거된 위치 후보를 표시한다.
```

### 36.4 어법 유형 실패

실패:

```text
정답이 두 개 이상 가능하다.
```

수정:

```text
문맥과 구조상 하나만 가능하도록 문장 또는 선택지를 수정한다.
```

### 36.5 서술형 실패

실패:

```text
첫 단어만 주고 너무 긴 문장을 요구한다.
```

수정:

```text
주어, 핵심 동사, 필수어, 한국어 뜻을 제공한다.
```

---

## 37. GitHub 팩 개요

이 장부터는 Ray's Drill 출제 시스템을 GitHub 레포로 관리하기 위한 운영팩이다.  
목표는 문제 제작, 검수, 수정, 조판, 배포를 이슈와 PR 단위로 추적하는 것이다.

### 37.1 GitHub 팩이 필요한 이유

문제 제작은 파일만 많아지면 금방 통제가 무너진다.  
GitHub 팩을 붙이면 다음이 가능해진다.

- 지문 범위 변경 추적
- 문항 오류 이슈화
- 선지 품질 수정 PR 관리
- Claude/Codex 검수 역할 분리
- JSON 스키마 검증 자동화
- DOCX 생성 실패 추적
- 완성본과 중간 산출물 분리
- 회차별 변경 이력 보존

### 37.2 권장 레포 이름

```text
rays-drill-assessment-bank
rays-drill-english-bank
rays-drill-pipeline
uijeongbu-high-final-drill
```

### 37.3 권장 브랜치 전략

```text
main
  배부 가능한 최종본만 유지

develop
  검수 통과 전 문제은행 작업

source/*
  지문 추출 및 source_manifest 작업

items/*
  문항 생성 작업

review/*
  선지/해설/서술형 검수 작업

layout/*
  DOCX/PDF 조판 작업

release/*
  회차별 최종본 준비
```

---

## 38. GitHub 레포 폴더 구조

권장 구조:

```text
rays-drill-assessment-bank/
  README.md
  Rays_Drill_유형별_출제로직_상세.md
  docs/
    00_scope.md
    01_type_logic.md
    02_choice_policy.md
    03_constructed_response_policy.md
    04_layout_policy.md
    05_quality_gates.md
  sources/
    source_manifest.json
    raw/
    normalized/
    transformed/
  item_bank/
    draft/
    reviewed/
    ready/
    rejected/
    item_bank.json
  prompts/
    passage_analysis.md
    item_generation.md
    choice_rewrite.md
    cr_difficulty_adjust.md
    final_audit.md
  schemas/
    item.schema.json
    source.schema.json
    audit.schema.json
  scripts/
    validate_item_bank.js
    validate_sources.js
    validate_choices.js
    validate_constructed_response.js
    assemble_docx.py
    export_pdf.py
  audits/
    choice_quality_audit.md
    source_coverage_audit.md
    docx_layout_audit.md
  outputs/
    docx/
    pdf/
    answer_keys/
  .github/
    ISSUE_TEMPLATE/
      item_error.yml
      choice_quality.yml
      source_scope.yml
      cr_difficulty.yml
      layout_bug.yml
    workflows/
      validate-bank.yml
    pull_request_template.md
```

---

## 39. GitHub README 템플릿

```md
# Ray's Drill Assessment Bank

고등학교 영어 내신 대비 문제은행 및 동형모의고사 제작 레포입니다.

## 목표

- 원문 정보량 보존
- 유형별 지문 조작 정직성 확보
- 기능적 오답 기반 선지 설계
- 현실적인 서술형 조건 제공
- DOCX/PDF 실전 시험지 조판
- 자동/수동 검수 기반 배부용 품질 확보

## 핵심 원칙

1. 지문은 줄이지 않는다.
2. 빈칸/삽입/어법 조작은 공통 지문 안에 반영한다.
3. 한 지문당 1~3문항만 낸다.
4. 선지는 매력적 오답으로 설계한다.
5. 서술형은 모범답안에서 조건을 역산한다.
6. 최종본에는 검수 통과 문항만 넣는다.

## 주요 폴더

| 폴더 | 설명 |
|---|---|
| `sources/` | 원문, 정규화 지문, 변형 지문 |
| `item_bank/` | 문항 JSON |
| `prompts/` | 제작/검수 프롬프트 |
| `schemas/` | JSON 스키마 |
| `scripts/` | 검수 및 조판 스크립트 |
| `audits/` | 검수 리포트 |
| `outputs/` | DOCX/PDF 완성본 |

## 품질 게이트

- G1 Source Gate
- G2 Passage Gate
- G3 Operation Gate
- G4 Choice Gate
- G5 Answer Gate
- G6 Constructed Response Gate
- G7 Explanation Gate
- G8 Layout Gate

## 배부 기준

문항 품질 점수 10점 이상만 배부용으로 이동합니다.
```

---

## 40. GitHub Issue Template: 문항 오류

파일 경로:

```text
.github/ISSUE_TEMPLATE/item_error.yml
```

내용:

```yaml
name: Item Error
description: 문항 오류, 정답 오류, 유형 불일치 제보
title: "[ITEM] "
labels: ["item-error", "needs-review"]
body:
  - type: input
    id: item_id
    attributes:
      label: Item ID
      description: 오류가 있는 문항 ID
      placeholder: RDB-SL04-001
    validations:
      required: true

  - type: dropdown
    id: error_type
    attributes:
      label: 오류 유형
      options:
        - 정답 오류
        - 정답 2개 가능
        - 발문 오류
        - 유형 불일치
        - 지문 조작 미반영
        - 해설 오류
        - 기타
    validations:
      required: true

  - type: textarea
    id: detail
    attributes:
      label: 상세 내용
      description: 어떤 점이 문제인지 구체적으로 적어주세요.
    validations:
      required: true

  - type: textarea
    id: expected_fix
    attributes:
      label: 수정 제안
      description: 가능하면 수정 방향을 적어주세요.
```

---

## 41. GitHub Issue Template: 선지 품질

파일 경로:

```text
.github/ISSUE_TEMPLATE/choice_quality.yml
```

내용:

```yaml
name: Choice Quality
description: 이상한 선지, 매력도 낮은 오답, 선지 길이 불균형 제보
title: "[CHOICE] "
labels: ["choice-quality", "needs-rewrite"]
body:
  - type: input
    id: item_id
    attributes:
      label: Item ID
      placeholder: RDB-SL04-001
    validations:
      required: true

  - type: checkboxes
    id: issue_points
    attributes:
      label: 선지 문제
      options:
        - label: 정답만 지나치게 길거나 구체적임
        - label: 오답이 너무 명백함
        - label: 오답이 본문과 무관함
        - label: 두 개 이상 정답 가능
        - label: 선지 한국어가 어색함
        - label: 메타 표현이 들어감
        - label: 깨진 문자 또는 이상 기호 있음

  - type: textarea
    id: bad_choices
    attributes:
      label: 문제되는 선지
      description: 문제가 되는 선지를 붙여 넣어주세요.
    validations:
      required: true

  - type: textarea
    id: rewrite_direction
    attributes:
      label: 재작성 방향
      description: 어떤 오답 DNA로 고치면 좋을지 적어주세요.
```

---

## 42. GitHub Issue Template: 서술형 난이도

파일 경로:

```text
.github/ISSUE_TEMPLATE/cr_difficulty.yml
```

내용:

```yaml
name: Constructed Response Difficulty
description: 서술형 힌트 부족, 단어 수 오류, 답안 조건 문제 제보
title: "[CR] "
labels: ["constructed-response", "difficulty"]
body:
  - type: input
    id: item_id
    attributes:
      label: Item ID
      placeholder: RDB-SL04-CR001
    validations:
      required: true

  - type: checkboxes
    id: issue_points
    attributes:
      label: 문제 유형
      options:
        - label: 한국어 뜻이 없음
        - label: 단어 수가 틀림
        - label: 필수어가 부족함
        - label: 첫 단어만으로는 쓰기 어려움
        - label: 주어가 필요함
        - label: 조건 단어와 주어가 겹침
        - label: 모범답안이 부자연스러움
        - label: 허용 답안 범위가 없음

  - type: textarea
    id: current_prompt
    attributes:
      label: 현재 서술형 문항
    validations:
      required: true

  - type: textarea
    id: suggested_revision
    attributes:
      label: 수정 제안
```

---

## 43. GitHub Issue Template: 지문 범위

파일 경로:

```text
.github/ISSUE_TEMPLATE/source_scope.yml
```

내용:

```yaml
name: Source Scope
description: 출제 범위, Gateway 제외, 대화문 포함 여부 확인
title: "[SOURCE] "
labels: ["source-scope"]
body:
  - type: input
    id: source_id
    attributes:
      label: Source ID
      placeholder: SL04_EX01

  - type: checkboxes
    id: scope_check
    attributes:
      label: 범위 확인
      options:
        - label: Gateway 제외 필요
        - label: 대화문 포함 필요
        - label: 추가 지문 제외 필요
        - label: 특정 번호만 출제
        - label: 원문 누락 의심

  - type: textarea
    id: detail
    attributes:
      label: 상세 범위 지시
    validations:
      required: true
```

---

## 44. GitHub Issue Template: 조판 오류

파일 경로:

```text
.github/ISSUE_TEMPLATE/layout_bug.yml
```

내용:

```yaml
name: Layout Bug
description: DOCX/PDF 조판 오류, 글머리표, 잘림, 간격 문제
title: "[LAYOUT] "
labels: ["layout", "docx"]
body:
  - type: input
    id: file
    attributes:
      label: 파일명
      placeholder: Ray_Drill_Bank_문제편.docx
    validations:
      required: true

  - type: checkboxes
    id: issue_points
    attributes:
      label: 조판 문제
      options:
        - label: 글이 잘림
        - label: 문단 앞 글머리표가 붙음
        - label: 문제 간격이 너무 촘촘함
        - label: 선지가 지문과 붙어 있음
        - label: 답안란이 중복됨
        - label: 2단 조판이 깨짐
        - label: 깨진 문자가 있음

  - type: textarea
    id: detail
    attributes:
      label: 상세 설명
```

---

## 45. Pull Request Template

파일 경로:

```text
.github/pull_request_template.md
```

내용:

```md
## 작업 내용

- 

## 변경 유형

- [ ] 지문 추가/수정
- [ ] 문항 추가
- [ ] 선지 정비
- [ ] 서술형 난이도 조정
- [ ] 해설 보강
- [ ] DOCX 조판
- [ ] 하네스/스크립트 수정
- [ ] 기타

## 범위 확인

- [ ] 출제 범위가 맞다.
- [ ] 제외 지문이 반영되었다.
- [ ] 지문을 임의로 줄이지 않았다.
- [ ] 대화문 포함/제외 지시를 반영했다.

## 유형 조작 확인

- [ ] 빈칸은 공통 지문 안에 실제로 반영되었다.
- [ ] 삽입 문장은 공통 지문에서 제거되었다.
- [ ] 어법 문항은 표시 지점이 있다.
- [ ] 순서 문항은 블록이 분리되어 있다.
- [ ] 어색한 문장은 실제 지문 안에 삽입되었다.
- [ ] 문제용 지문을 중복 제공하지 않았다.

## 선지 확인

- [ ] 정답은 하나만 가능하다.
- [ ] 오답 4개는 기능적 오답이다.
- [ ] 선지 길이와 문체가 비슷하다.
- [ ] 금지 패턴이 없다.
- [ ] 정답번호가 과도하게 몰리지 않는다.

## 서술형 확인

- [ ] 모범답안을 먼저 작성했다.
- [ ] 단어 수가 정확하다.
- [ ] 한국어 뜻 또는 충분한 힌트가 있다.
- [ ] 필요한 경우 주어/시작구를 제공했다.
- [ ] 채점 기준이 있다.

## 해설 확인

- [ ] 출제의도가 있다.
- [ ] 정답 근거가 있다.
- [ ] 오답 해설이 있다.
- [ ] 어휘 정리가 있다.
- [ ] 구문 정리가 있다.
- [ ] 배경지식 중복을 줄였다.

## 조판 확인

- [ ] DOCX가 열린다.
- [ ] 2단 조판이 유지된다.
- [ ] 문단 글머리표 오염이 없다.
- [ ] 글이 잘리지 않는다.
- [ ] 문제 간격이 충분하다.

## 검수 결과

- 통과 문항 수:
- 수정 필요 문항 수:
- 제외 문항 수:
```

---

## 46. JSON Schema: item.schema.json

파일 경로:

```text
schemas/item.schema.json
```

내용:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Ray's Drill Item",
  "type": "object",
  "required": [
    "item_id",
    "source_id",
    "question_type",
    "common_passage_mode",
    "common_passage",
    "prompt",
    "answer",
    "intent",
    "evidence",
    "status"
  ],
  "properties": {
    "item_id": {
      "type": "string",
      "pattern": "^RDB-[A-Za-z0-9_-]+$"
    },
    "source_id": {
      "type": "string"
    },
    "source_label": {
      "type": "string"
    },
    "transformation_level": {
      "type": "string",
      "enum": ["T0", "T1", "T2", "T3"]
    },
    "question_type": {
      "type": "string"
    },
    "cognitive_target": {
      "type": "string"
    },
    "common_passage_mode": {
      "type": "string",
      "enum": [
        "plain",
        "blank_marked",
        "underlined",
        "grammar_marked",
        "connector_blank",
        "insertion_marked",
        "order_marked",
        "irrelevant_numbered",
        "summary_blank",
        "reference_marked",
        "sentence_numbered",
        "dialogue_plain",
        "dialogue_blank",
        "interview_transform",
        "visual_context",
        "cr_theme_sentence",
        "cr_guided_writing",
        "cr_grammar_correction"
      ]
    },
    "common_passage": {
      "type": "string",
      "minLength": 20
    },
    "prompt": {
      "type": "string",
      "minLength": 5
    },
    "question_body": {
      "type": "string"
    },
    "choices": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 0,
      "maxItems": 5
    },
    "answer": {
      "type": "string"
    },
    "evidence": {
      "type": "string"
    },
    "distractor_dna": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "부분참",
          "인과전도",
          "범위과잉",
          "범위축소",
          "초점이동",
          "태도왜곡",
          "조건누락",
          "지시어혼동",
          "세부정보혼동"
        ]
      }
    },
    "intent": {
      "type": "string"
    },
    "explanation": {
      "type": "string"
    },
    "vocab_notes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "syntax_notes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "background_note": {
      "type": "string"
    },
    "constructed_response": {
      "type": "boolean"
    },
    "model_answer": {
      "type": "string"
    },
    "word_count": {
      "type": "integer",
      "minimum": 0
    },
    "korean_meaning": {
      "type": "string"
    },
    "given_words": {
      "type": "array",
      "items": { "type": "string" }
    },
    "inflection_allowed": {
      "type": "boolean"
    },
    "starter": {
      "type": "string"
    },
    "rubric": {
      "type": "array",
      "items": { "type": "string" }
    },
    "acceptable_variants": {
      "type": "array",
      "items": { "type": "string" }
    },
    "quality_score": {
      "type": ["integer", "null"],
      "minimum": 0,
      "maximum": 12
    },
    "status": {
      "type": "string",
      "enum": ["draft", "needs_review", "revised", "ready", "rejected"]
    }
  }
}
```

---

## 47. JSON Schema: source.schema.json

파일 경로:

```text
schemas/source.schema.json
```

내용:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Ray's Drill Source",
  "type": "object",
  "required": [
    "source_id",
    "source_label",
    "source_type",
    "include",
    "gateway",
    "text"
  ],
  "properties": {
    "source_id": {
      "type": "string"
    },
    "source_label": {
      "type": "string"
    },
    "source_type": {
      "type": "string",
      "enum": [
        "suteuk_light",
        "textbook",
        "mock_exam",
        "dialogue",
        "supplement",
        "other"
      ]
    },
    "lesson": {
      "type": "string"
    },
    "passage_no": {
      "type": "string"
    },
    "include": {
      "type": "boolean"
    },
    "gateway": {
      "type": "boolean"
    },
    "dialogue": {
      "type": "boolean"
    },
    "text": {
      "type": "string",
      "minLength": 20
    },
    "notes": {
      "type": "string"
    }
  }
}
```

---

## 48. GitHub Actions Workflow: validate-bank.yml

파일 경로:

```text
.github/workflows/validate-bank.yml
```

내용:

```yaml
name: Validate Ray's Drill Bank

on:
  pull_request:
    paths:
      - "sources/**"
      - "item_bank/**"
      - "schemas/**"
      - "scripts/**"
      - "docs/**"
  push:
    branches:
      - main
      - develop

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Node dependencies
        run: |
          npm ci || npm install

      - name: Validate source manifest
        run: |
          node scripts/validate_sources.js

      - name: Validate item bank schema
        run: |
          node scripts/validate_item_bank.js

      - name: Validate choices
        run: |
          node scripts/validate_choices.js

      - name: Validate constructed responses
        run: |
          node scripts/validate_constructed_response.js

      - name: Upload audit reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: audit-reports
          path: audits/
```

---

## 49. validate_choices.js 규격

파일 경로:

```text
scripts/validate_choices.js
```

핵심 로직:

```js
const fs = require("fs");

const BAD_PATTERNS = [
  "본문은",
  "글은",
  "사전적",
  "문자적",
  "원문보다",
  "근거 없이",
  "글 밖",
  "전체 결론이 충분히",
  "undefined",
  "NaN",
  "...",
  "…"
];

function loadBank() {
  return JSON.parse(fs.readFileSync("item_bank/item_bank.json", "utf8"));
}

function choiceLengthStats(choices) {
  const lengths = choices.map((choice) => choice.replace(/\s+/g, "").length);
  return {
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    ratio: Math.max(...lengths) / Math.max(1, Math.min(...lengths))
  };
}

function validateChoices(item) {
  const errors = [];

  if (!item.constructed_response) {
    if (!Array.isArray(item.choices) || item.choices.length !== 5) {
      errors.push("객관식 choices는 5개여야 합니다.");
      return errors;
    }

    if (!item.choices.includes(item.answer)) {
      errors.push("answer가 choices 안에 없습니다.");
    }

    for (const choice of item.choices) {
      for (const pattern of BAD_PATTERNS) {
        if (choice.includes(pattern)) {
          errors.push(`금지 패턴 포함: ${pattern}`);
        }
      }
    }

    const stats = choiceLengthStats(item.choices);
    if (stats.ratio > 2.2) {
      errors.push(`선지 길이 불균형: ${stats.ratio.toFixed(2)}`);
    }

    if (!item.distractor_dna || item.distractor_dna.length < 4) {
      errors.push("오답 DNA가 부족합니다.");
    }
  }

  return errors;
}

function main() {
  const bank = loadBank();
  const items = Array.isArray(bank) ? bank : bank.items;
  const failures = [];

  for (const item of items) {
    const errors = validateChoices(item);
    if (errors.length) {
      failures.push({ item_id: item.item_id, errors });
    }
  }

  fs.mkdirSync("audits", { recursive: true });
  fs.writeFileSync(
    "audits/choice_quality_audit.json",
    JSON.stringify({ failures }, null, 2),
    "utf8"
  );

  if (failures.length) {
    console.error(`${failures.length} choice quality failures`);
    process.exit(1);
  }
}

main();
```

---

## 50. validate_constructed_response.js 규격

파일 경로:

```text
scripts/validate_constructed_response.js
```

핵심 로직:

```js
const fs = require("fs");

function loadBank() {
  return JSON.parse(fs.readFileSync("item_bank/item_bank.json", "utf8"));
}

function countWords(text) {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function validateCR(item) {
  const errors = [];

  if (!item.constructed_response) return errors;

  if (!item.model_answer) {
    errors.push("model_answer가 없습니다.");
  }

  if (typeof item.word_count === "number" && item.model_answer) {
    const actual = countWords(item.model_answer);
    if (actual !== item.word_count) {
      errors.push(`단어 수 불일치: expected ${item.word_count}, actual ${actual}`);
    }
  }

  const hasMeaning = Boolean(item.korean_meaning && item.korean_meaning.trim());
  const hintCount = Array.isArray(item.given_words) ? item.given_words.length : 0;
  const hasStarter = Boolean(item.starter && item.starter.trim());

  if (!hasMeaning && hintCount < 4) {
    errors.push("한국어 뜻이 없으면 given_words를 더 많이 제공해야 합니다.");
  }

  if ((item.word_count || 0) >= 10 && !hasStarter && hintCount < 4) {
    errors.push("긴 서술형은 starter 또는 충분한 필수어가 필요합니다.");
  }

  if (!Array.isArray(item.rubric) || item.rubric.length === 0) {
    errors.push("채점 기준 rubric이 없습니다.");
  }

  return errors;
}

function main() {
  const bank = loadBank();
  const items = Array.isArray(bank) ? bank : bank.items;
  const failures = [];

  for (const item of items) {
    const errors = validateCR(item);
    if (errors.length) failures.push({ item_id: item.item_id, errors });
  }

  fs.mkdirSync("audits", { recursive: true });
  fs.writeFileSync(
    "audits/constructed_response_audit.json",
    JSON.stringify({ failures }, null, 2),
    "utf8"
  );

  if (failures.length) {
    console.error(`${failures.length} constructed response failures`);
    process.exit(1);
  }
}

main();
```

---

## 51. validate_item_bank.js 규격

파일 경로:

```text
scripts/validate_item_bank.js
```

검사 항목:

```text
item_id 중복
source_id 누락
question_type 누락
common_passage 누락
mode와 유형 불일치
지문 축약 표시
정답 누락
출제의도 누락
근거 누락
```

핵심 의사코드:

```js
function validateMode(item) {
  const type = item.question_type;
  const mode = item.common_passage_mode;
  const passage = item.common_passage || "";

  if (type.includes("문장삽입") && mode !== "insertion_marked") {
    return "문장삽입은 insertion_marked mode여야 합니다.";
  }

  if (type.includes("빈칸") && !passage.includes("________")) {
    return "빈칸 문항은 지문 안에 ________가 있어야 합니다.";
  }

  if (type.includes("순서") && mode !== "order_marked") {
    return "순서 문항은 order_marked mode여야 합니다.";
  }

  if (type.includes("어법") && !mode.includes("grammar") && !mode.includes("underlined")) {
    return "어법 문항은 문법 표시가 필요합니다.";
  }

  return null;
}
```

---

## 52. source_manifest.json 예시

파일 경로:

```text
sources/source_manifest.json
```

예시:

```json
{
  "project": "Ray's Drill",
  "scope": "수특라이트 04, 05, 07강 Gateway 제외",
  "created_at": "2026-07-08",
  "sources": [
    {
      "source_id": "SL04_EX01",
      "source_label": "수특라이트 04강 Exercise 01",
      "source_type": "suteuk_light",
      "lesson": "04",
      "passage_no": "Exercise 01",
      "include": true,
      "gateway": false,
      "dialogue": false,
      "text": "원문 전체",
      "notes": "지문 축약 금지"
    },
    {
      "source_id": "SL04_GATEWAY",
      "source_label": "수특라이트 04강 Gateway",
      "source_type": "suteuk_light",
      "lesson": "04",
      "passage_no": "Gateway",
      "include": false,
      "gateway": true,
      "dialogue": false,
      "text": "",
      "notes": "사용자 지시로 제외"
    }
  ]
}
```

---

## 53. 품질 라벨 체계

GitHub 라벨:

```text
source-scope
item-draft
choice-quality
constructed-response
grammar
layout
docx
answer-key
needs-review
needs-rewrite
ready
rejected
release-candidate
```

라벨 운용:

| 라벨 | 의미 |
|---|---|
| source-scope | 범위/출처 이슈 |
| item-draft | 문항 초안 |
| choice-quality | 선지 품질 문제 |
| constructed-response | 서술형 관련 |
| grammar | 어법 문항 관련 |
| layout | 조판 문제 |
| docx | DOCX 산출물 |
| answer-key | 정답/해설 |
| needs-review | 검수 필요 |
| needs-rewrite | 재작성 필요 |
| ready | 배부 가능 |
| rejected | 제외 |
| release-candidate | 최종본 후보 |

---

## 54. Milestone 운용

권장 마일스톤:

```text
M1 Source Lock
M2 Draft Item Bank
M3 Choice Rewrite
M4 CR Difficulty Pass
M5 Explanation Expansion
M6 DOCX Layout
M7 Final Audit
M8 Release
```

각 마일스톤 완료 조건:

| 마일스톤 | 완료 조건 |
|---|---|
| M1 | source_manifest 확정, 제외 지문 표시 |
| M2 | 문항 초안 생성 |
| M3 | 선지 금지 패턴 0건 |
| M4 | 서술형 단어 수 오류 0건 |
| M5 | 해설 필수 항목 누락 0건 |
| M6 | DOCX 열림, 2단 조판 확인 |
| M7 | 최종 감사 리포트 통과 |
| M8 | release 폴더에 최종본 배치 |

---

## 55. Release Checklist

릴리즈 직전 체크리스트:

```md
# Release Checklist

## 범위

- [ ] source_manifest가 최신이다.
- [ ] 제외 지문이 반영되었다.
- [ ] Gateway 제외 지시가 반영되었다.
- [ ] 대화문 포함/제외 지시가 반영되었다.

## 문항

- [ ] item_id 중복이 없다.
- [ ] 한 지문당 1~3문항 원칙을 지켰다.
- [ ] 유형이 다양하다.
- [ ] 같은 지문 문항끼리 답을 노출하지 않는다.

## 지문 조작

- [ ] 빈칸 조작이 지문 안에 반영되었다.
- [ ] 삽입 문장이 지문에서 제거되었다.
- [ ] 순서 블록이 실제로 분리되었다.
- [ ] 어법 표시가 있다.
- [ ] 문제용 지문을 중복 제공하지 않았다.

## 선지

- [ ] 금지 패턴 0건
- [ ] 정답 하나
- [ ] 오답 DNA 있음
- [ ] 선지 길이 균형
- [ ] 정답번호 3연속 없음

## 서술형

- [ ] model_answer 있음
- [ ] word_count 일치
- [ ] korean_meaning 또는 충분한 힌트 있음
- [ ] starter/subject 필요 여부 확인
- [ ] rubric 있음

## 해설

- [ ] 정답 근거 있음
- [ ] 오답 해설 있음
- [ ] 어휘 정리 있음
- [ ] 구문 정리 있음
- [ ] 배경지식 중복 최소화

## 조판

- [ ] DOCX 열림
- [ ] 2단 조판 유지
- [ ] 글머리표 오염 없음
- [ ] 지문 잘림 없음
- [ ] 문제 간 여백 충분

## 산출

- [ ] 학생용 DOCX
- [ ] 정답해설 DOCX
- [ ] 필요 시 PDF
- [ ] audit report
- [ ] release note
```

---

## 56. Release Note 템플릿

```md
# Ray's Drill Release Note

버전:
날짜:
범위:

## 포함 자료

- 

## 제외 자료

- 

## 문항 수

- 객관식:
- 서술형:
- 총 문항:

## 유형 분포

| 유형 | 문항 수 |
|---|---|
| 주제 | |
| 요지 | |
| 빈칸 | |
| 삽입 | |
| 순서 | |
| 어법 | |
| 서술형 | |

## 주요 변경

- 

## 검수 결과

- 선지 금지 패턴:
- 정답번호 3연속:
- 서술형 단어 수 오류:
- DOCX 조판 오류:

## 남은 리스크

- 
```

---

## 57. GitHub 팩 운영 결론

GitHub 팩의 목표는 파일을 예쁘게 정리하는 것이 아니다.  
목표는 출제 품질을 추적 가능한 작업 단위로 쪼개는 것이다.

최소 운영 단위:

```text
source_manifest
item_bank.json
item.schema.json
choice_quality_audit
constructed_response_audit
PR template
Issue templates
validate-bank workflow
release checklist
```

이 구성이 있으면 다음이 가능해진다.

- 어떤 지문에서 어떤 문항이 나왔는지 추적
- 왜 이 선지가 오답인지 추적
- 서술형 단어 수 오류 자동 탐지
- 삽입/빈칸 지문 조작 누락 탐지
- DOCX 완성본 이전에 품질 컷
- Claude/Codex가 같은 기준으로 검수

---

## 58. 최종 통합 원칙

이 문서의 전체 구조는 다음 한 줄로 압축된다.

```text
유형별 출제 로직을 문항 카드로 만들고,
문항 카드를 JSON으로 관리하고,
JSON을 GitHub 검수팩으로 통과시킨 뒤,
DOCX 시험지로 조립한다.
```

Ray's Drill은 감으로 찍어내는 문제 묶음이 아니라,  
**지문 보존 → 유형 조작 → 기능적 오답 → 서술형 현실화 → GitHub 검수 → 실전 조판**으로 이어지는 제작 시스템이다.

---

## 59. 어법·어휘·서술형 심화 로직 연결

어법, 어휘, 서술형은 문항 오류와 품질 편차가 가장 크게 발생하는 영역이므로 별도 심화 규격으로 관리한다.

연결 문서:

```text
Rays_Drill_어법_어휘_서술형_심화출제로직.md
```

해당 문서는 다음을 상세히 규정한다.

- 어법 포인트 분류
- 어법 오류 삽입 규칙
- 어법 객관식/서술형 교정 문항 생성 로직
- 어휘 포인트 분류
- 문맥상 의미, 어휘 적절성, 어휘 대체, 어휘 빈칸 제작 로직
- 어휘 오답 의미장 설계
- 서술형 힌트 사다리
- 단어 수 산정 기준
- 채점 기준과 부분점 설계
- 어법·어휘·서술형 전용 JSON 필드
- 자동 검수 의사코드
- 생성 프롬프트

운영 원칙:

```text
어법은 구조로 설명 가능한 것만 낸다.
어휘는 문맥으로 판단 가능한 것만 낸다.
서술형은 모범답안에서 조건을 역산한다.
```
---

## 41. Full-Passage Multi-Item Harness V2

태그: `FULL_PASSAGE_MULTI_ITEM_HARNESS_V2`, `PASSAGE_CLUSTER_POLICY_V2`, `ORDER_ALL_SENTENCES_MODE`

### 41.1 기본 생성 단위

기존 방식의 약점은 문항을 먼저 만들면서 지문이 문항마다 잘게 소모된다는 점이다.  
이후 제작은 반드시 다음 단위로 시작한다.

```json
{
  "passageClusterId": "MOCK2026_03_Q21_C01",
  "sourcePassageId": "2026_03_G1_Q21",
  "sourceSentenceCount": 7,
  "sourcePropositionCount": 9,
  "transformLevel": "T0|T1|T2|T3|T4",
  "commonPassageMode": "plain|blank_marked|insertion_marked|order_marked|order_all_sentences|irrelevant_numbered|underlined",
  "items": ["Q01", "Q02", "Q21"],
  "fullPassageMap": []
}
```

`item`은 단독으로 존재하지 않는다. 모든 문항은 반드시 하나의 `passageClusterId`에 속한다.

### 41.2 클러스터별 권장 문항 조합

| 지문 성격 | 1문항 | 2문항 | 3문항 |
|---|---|---|---|
| 핵심 주장 선명 | 주제/제목 | 주제 + 내용일치 | 주제 + 어휘 + 주제문 서술형 |
| 대조 구조 | 요지 | 빈칸 + 내용불일치 | 빈칸 + 어휘 + 요약문 |
| 인과 구조 | 내용일치 | 원인결과 + 어법 | 원인결과 + 빈칸 + 내용서술형 |
| 예시-일반화 | 제목 | 순서 + 내용일치 | 순서 + 삽입 + 요약 |
| 문법 포인트 강함 | 어법 | 어법 + 내용이해 | 어법 + 어휘 + 어법교정 서술형 |

금지 조합:

- 같은 공통지문에 `blank_marked`와 `insertion_marked`를 동시에 무리하게 넣기
- 삽입할 문장을 지문에서 제거하지 않고 아래에 따로 또 주기
- 지문 하나를 주고, 문제 아래에 문제풀이용 변형 지문을 다시 주기
- 3문항 클러스터에서 세 문항이 모두 같은 근거 문장만 보게 만들기

### 41.3 Full Passage Map

전체 지문 보존 검수는 `fullPassageMap`으로 한다.

```json
[
  {
    "sourceSentence": "S1",
    "sourceFunction": "topic_introduction",
    "targetLocation": "P1-S1",
    "status": "kept|merged|split|paraphrased",
    "lostInformation": false
  }
]
```

통과 조건:

- 모든 source sentence가 targetLocation을 가진다.
- `lostInformation: true`가 0개여야 한다.
- 병합/분리는 가능하지만 정보 단위가 사라지면 FAIL이다.
- T3 전체 변형형도 원문 명제 수의 90~110% 범위를 유지한다.
- 내용상 중요도가 낮아 보이는 예시도 임의 삭제하지 않는다. 삭제 대신 압축·병합으로 대응한다.

### 41.4 순서형 세부 알고리즘

순서형은 두 종류다.

#### A. Block Order

```text
도입문 제시
(A) 예시 또는 반론
(B) 전개 또는 결과
(C) 핵심 결론
```

적합한 경우:

- 문단 또는 기능 블록이 분명함
- 단락 간 연결어가 살아 있음
- 3~4개 블록으로 나눠도 정보 누락이 없음

#### B. Order All Sentences

```text
다음 글의 모든 문장을 글의 흐름에 맞게 배열하시오.
① ...
② ...
③ ...
④ ...
⑤ ...
⑥ ...
```

적합한 경우:

- 전체 지문이 5~9문장
- 문장마다 담화 기능이 다름
- 시간 순서, 인과, 대조, 예시-일반화 단서가 분명함
- 모든 문장을 배열해도 과도하게 퍼즐화되지 않음

검수:

- 모든 원문 문장이 선택지/배열 대상에 포함되어야 한다.
- 정답 배열에 빠지는 문장이 있으면 FAIL.
- 단순 연결어 하나만 보고 맞히는 문제가 되면 FAIL.
- 문장 길이가 지나치게 불균형하면 변형으로 길이와 난이도를 조절한다.

### 41.5 내부 10회 반복 시뮬레이션 결과를 로직에 반영하는 법

실제 시험지 파일을 만들지 않고도 다음 10회 점검을 내부적으로 돌린다.

```text
Loop 01: source passage → cluster화 가능성 점검
Loop 02: fullPassageMap 작성
Loop 03: T0/T1/T2/T3 변형 후보 생성
Loop 04: 1~3문항 조합 후보 생성
Loop 05: 공통지문 조작 충돌 검사
Loop 06: 전체 지문 누락 검사
Loop 07: 선지 매력도와 길이 균형 검사
Loop 08: 서술형 현실성 검사
Loop 09: 학생이 앞문항 답으로 뒷문항을 풀 수 있는지 검사
Loop 10: 조판상 공통지문-문항 묶음이 자연스러운지 검사
```

반복 결과에서 하나라도 FAIL이면 문제를 더 만드는 것이 아니라 **지문 클러스터 설계로 되돌아간다.**
---

## 42. Question Count Options V1

태그: `QUESTION_COUNT_OPTIONS_V1`

정정: “문형”이 아니라 **문제수** 옵션이다.  
동형모의고사 조립 단계는 다음 문제수를 지원한다.

```json
{
  "supportedQuestionCounts": [26, 28, 32, 34, 36, 38, 40],
  "defaultQuestionCount": 26,
  "fixedQuestionCount": false
}
```

문제수별 생성 알고리즘:

1. `questionCount`를 먼저 선택한다.
2. 해당 문제수에 맞는 `clusterCount` 범위를 정한다.
3. 지문 클러스터를 먼저 배치한다.
4. 각 클러스터에 1~3문항을 배정한다.
5. 객관식/서술형 비율을 문제수에 맞춰 조정한다.
6. 전체 지문 보존과 다문항 클러스터 비율을 검수한다.

권장값:

| questionCount | clusterCount | minMultiItemClusters |
|---:|---:|---:|
| 26 | 9~12 | 6 |
| 28 | 10~13 | 6 |
| 32 | 11~15 | 7 |
| 34 | 12~16 | 8 |
| 36 | 12~17 | 8 |
| 38 | 13~18 | 9 |
| 40 | 14~20 | 10 |

중요:

- 문제수가 늘어났다고 한 지문에 4문항 이상을 억지로 붙이지 않는다.
- 문제수가 늘어나면 지문 클러스터 수를 늘린다.
- 순서형 전체문장배열, 어법교정, 주제문 서술형, 요약문 서술형을 확장 문항수에서 더 적극적으로 배치한다.
- 26문항 규격은 `default`이며, 28~40은 `extended` 규격이다.
---

## 43. Standardized Assembly Templates V1

태그: `STANDARDIZED_ASSEMBLY_TEMPLATES_V1`

문항 배치는 매번 새로 발명하지 않는다.  
생성기는 다음 표준 템플릿 중 하나를 고른 뒤, 문제수와 지문 클러스터 수에 맞게 확장한다.

### 43.1 Cluster Role Codes

| Code | Cluster Role | 대표 유형 |
|---|---|---|
| C | Comprehension | 내용일치, 불일치, 주제, 제목, 요지 |
| V | Vocabulary | 문맥어휘, 어휘 변형, 대체어 |
| G | Grammar | 어법 객관식, 어법교정 서술형 |
| L | Logic | 빈칸, 연결어, 요약문 완성 |
| O | Order | 글의 순서, 전체 문장 배열 |
| I | Insertion | 문장삽입, 무관문 |
| W | Writing Theme | 주제문, 내용이해 서술형 |
| S | Summary/Interview | 요약문, 인터뷰형 서술형 |
| X | Complex | 복합 변별 클러스터 |

### 43.2 Template Library

```json
{
  "STANDARD_A_BALANCED_RAMP": ["C", "V", "G", "L", "C", "O", "V", "G", "I", "W", "S", "X"],
  "STANDARD_B_INTERLEAVED_GRAMMAR": ["C", "G", "V", "C", "L", "G", "O", "W", "V", "I", "S", "X"],
  "STANDARD_C_LOGIC_HEAVY": ["C", "V", "L", "C", "O", "G", "I", "W", "L", "S", "G", "X"]
}
```

### 43.3 Selection Algorithm

```text
1. questionCount를 선택한다.
2. 지문 범위의 성격을 판단한다.
   - 어법 포인트가 많으면 B
   - 수능형 논리 지문이 많으면 C
   - 균형형이면 A
3. clusterCount가 12보다 크면 C/V/G/L 보강 클러스터를 삽입한다.
4. 표시형 클러스터 L/O/I가 붙으면 위치를 한 칸 이동한다.
5. W/S/X는 후반 중심으로 두되, 하나는 중반에 배치 가능하다.
6. 최종적으로 정답번호 분포와 같은 유형 연속을 검수한다.
```

### 43.4 Expansion Rules

| questionCount | 기본 템플릿 | 추가 우선순위 |
|---:|---|---|
| 26 | A/B/C 그대로 | 없음 또는 C 1개 조정 |
| 28 | A/B/C + 1 cluster | C 또는 V |
| 32 | A/B/C + 2~3 clusters | C, G, L |
| 34 | A/B/C + 3~4 clusters | C, V, G, L |
| 36 | A/B/C + 4~5 clusters | C, G, L, O |
| 38 | A/B/C + 5~6 clusters | C, V, G, L, I |
| 40 | A/B/C + 6~8 clusters | C, V, G, L, O, W |

### 43.5 Guardrails

- 정례 템플릿은 배치용이지 문항 복붙용이 아니다.
- 같은 지문 클러스터가 4문항 이상이 되면 새 변형 클러스터로 분리한다.
- C만 앞에 과밀하게 두지 않는다.
- G만 한 구역에 몰지 않는다.
- L/O/I 표시형은 붙이지 않는다.
- 서술형은 모두 후반에만 몰지 말고, 긴 세트에서는 중반에 1개 배치한다.
## 44. Internal Mock Simulation Feedback Loop

Tag: `INTERNAL_MOCK_SIMULATION_V1`

이 문서의 유형 로직은 실제 산출물을 만들기 전에 내부 동형모의고사 조립 시뮬레이션으로 한 번 더 검증한다. 시뮬레이션은 문제지 파일을 만들지 않고, 문항 수/클러스터 수/유형 역할/문항 배분만 돌린다.

### 44.1 Stress Findings

1차 stress run은 `1,722`개 조합을 돌렸고, 다음 결함을 발견했다.

| finding | meaning | logic repair |
|---|---|---|
| `too_few_clusters_for_max_3_items` | 클러스터 수가 적어 한 지문 4문항 이상 위험 | 26/28/32/34 최소 클러스터 수 상향 |
| `adjacent_marked_operation_clusters` | L/O/I 표시형 유형이 연속 배치됨 | STANDARD_C 재배열, 표시형 인접 금지 |
| `missing_W_or_S_subjective_role` | 템플릿 압축 중 서술형 축 손실 | W/S 보존 규칙 추가 |

### 44.2 Locked Rules

- 한 공통 지문 클러스터는 1~3문항만 허용한다.
- 26문항은 최소 9클러스터에서 시작한다.
- `STANDARD_C_LOGIC_HEAVY`는 `C-V-L-C-O-G-I-W-L-S-G-X`로 사용한다.
- 템플릿 내부 순서는 임의 회전하지 않고, 세트 간 A/B/C 패밀리만 순환한다.
- 축약된 템플릿에서도 W/S 서술형 역할은 반드시 남긴다.
- 모든 문제수 프로필 `26/28/32/34/36/38/40`은 내부 조립 시뮬레이션을 통과해야 한다.

### 44.3 Current Locked Result

수정 후 허용 조합 `333/333`이 통과했다. 따라서 완성본 export 전 필수 명령은 다음과 같다.

```bash
node 문제은행_파이프라인_하네스/scripts/simulate_mock_assembly.cjs
node 문제은행_파이프라인_하네스/scripts/validate_harness.cjs
```

이 두 단계가 통과하지 않으면 DOCX/PDF를 만들지 않는다.
## 45. Self-Make Dry-Run Logic

Tag: `SELF_MAKE_DRY_RUN_V1`

유형별 로직은 최종 export 전에 실제 문제은행 조립 실험을 통과해야 한다. 이 단계는 문제를 새로 쓰는 단계가 아니라, 이미 만든 item bank가 실제 시험지 구조로 뽑힐 수 있는지 확인하는 단계다.

### 45.1 Stable 26-Item Assembly

```text
C-V-G-L-C-O-V-G-I-W-S-X
3-3-3-1-3-1-3-3-1-1-1-3
```

의미:

- C: 내용이해/주제/제목
- V: 문맥 어휘/어휘 변형
- G: 어법/구문/논리 관계
- L: 빈칸/요약 논리
- O: 글의 순서/전체문장 배열
- I: 문장삽입/무관문
- W: 주제문/내용이해 서술형
- S: 요약문/인터뷰형 서술형
- X: 복합 고변별 클러스터

### 45.2 Marked Operation Item Count

L/O/I는 기본적으로 1문항 클러스터다. 표시형 유형은 공통 지문 내부에 빈칸, 삽입 위치, 문장 번호, 무관문 번호가 이미 박혀 있으므로, 같은 printed passage에 여러 표시형을 덧붙이면 학생이 서로 참고해서 풀 가능성이 커진다.

다문항을 붙일 수 있는 곳은 C/V/G/X다. 단, 한 클러스터는 3문항을 넘지 않는다.

### 45.3 Role Compatibility

실제 문제은행에는 특정 역할 공급이 부족할 수 있다. 따라서 다음 호환 규칙을 쓴다.

```json
{
  "C": ["C", "W", "G", "S"],
  "V": ["V", "C", "G"],
  "G": ["G", "C", "W"],
  "L": ["L"],
  "O": ["O"],
  "I": ["I"],
  "W": ["W", "S"],
  "S": ["S", "W"],
  "X": ["C", "V", "G", "L", "O", "I", "W", "S"]
}
```

단, V/O는 희소 역할이므로 다른 역할이 먼저 소비하지 않게 보존한다.

### 45.4 Export Gate

드라이런에서 다음이 모두 맞아야 assembly pass다.

- 26문항
- 객관식 20
- 서술형 6
- 12클러스터
- 같은 지문 연속 0
- 정답번호 3연속 0
- 모든 클러스터 1~3문항

그러나 assembly pass는 export pass가 아니다. `fullPassageMap`, 서술형 정확 단어수, 힌트 정책, 채점기준이 없으면 export를 막는다.

### 45.5 Current Rule Outcome

현재 dry-run 결과는 다음 로직으로 저장한다.

```text
ASSEMBLY_PASS_EXPORT_BLOCKED_UNTIL_ENRICHED
```

즉 지금 은행은 26문항 세트로 뽑을 수 있지만, 배부본이 되려면 enrichment metadata가 먼저 붙어야 한다.
## 46. Virtual All-Type Production Logic

Tag: `VIRTUAL_ALL_TYPE_PRODUCTION_V1`

실제 문제지를 만들기 전에 전체 유형을 한 번 가상 출제한다. 목적은 학생용 결과물 생산이 아니라, 유형별 약점을 미리 드러내고 그 오류를 로직으로 환류하는 것이다.

### 46.1 반드시 한 번씩 가상 출제할 유형

- `main_idea`
- `title`
- `detail_true_false`
- `contextual_vocabulary`
- `grammar_underlined`
- `blank_logic`
- `sentence_insertion`
- `paragraph_order`
- `irrelevant_sentence`
- `summary_completion`
- `subjective_topic_sentence`
- `interview_subjective`
- `grammar_correction_subjective`
- `all_sentence_order`
- `implied_meaning`

### 46.2 가상 출제 중 실제로 잡힌 오류

1차 virtual run에서 다음 오류가 잡혔다.

| id | 오류 | 개선 |
|---|---|---|
| `VAT-F1` | 서술형 단어수를 사람이 추정해서 modelAnswer 실제 단어수와 어긋남 | modelAnswer를 먼저 쓰고, 그 답안에서 exactWordCount를 계산 |
| `VAT-F2` | 어법 수정형 marked mode인데 오류 문장이 commonPassage에 직접 박히지 않음 | marked/underlined/correction 조작은 반드시 commonPassage 안에 반영 |

수정 후 최종 virtual run은 `VIRTUAL_GENERATION_PASS`다.

### 46.3 전체유형 공통 게이트

- 객관식은 5지선다, 정답 텍스트-선지 동기화, 정답 위치 메타, 선지별 distractor logic을 가져야 한다.
- marked-operation 유형은 지문 자체에 조작이 들어가야 한다.
- 서술형은 answer-first다. 답안을 먼저 만들고 단어수를 계산한 뒤 조건을 만든다.
- 한국어 뜻을 주지 않는 서술형은 starter, subject, required words, key nouns 등 힌트를 더 많이 줘야 한다.
- 어법 유형은 `AI_GRAMMAR_CORE_LOGIC_V1`에 따라 axiom trace, data process, validation trap, curriculum mapping을 가져야 한다.

### 46.4 필수 명령

```bash
node 문제은행_파이프라인_하네스/scripts/virtual_all_type_generation_report.cjs
node 문제은행_파이프라인_하네스/scripts/validate_harness.cjs
```

전체유형 가상 출제에서 오류가 나오면, 오류를 문항만 고쳐 닫지 말고 repair rule로 승격한 뒤 하네스에 반영한다.
