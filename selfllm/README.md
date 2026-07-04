# Ray English 자체 LLM — 우리 전용 출제 모델 만들기 (무료)

원서 197권 코퍼스 + 코드검증 출제 시스템을 **선생님(teacher)** 삼아, 소형 오픈모델을 우리 데이터로 파인튜닝해 **우리 전용 "Ray English 출제 모델"** 파일을 소유합니다. 전부 무료(무료 클라우드 GPU)로 가능합니다.

## 원리
- 우리 **코드제어 빌더**(글의순서·문장삽입·연결어·첫글자 등)는 LLM 없이 **정답까지 검증된 문항**을 무제한 생성 → 공짜·고품질 학습 라벨
- 무한모드 키가 있으면 **전 유형 + 워크북 + 분석지**까지 검수 통과분만 데이터화(고밀도)
- 이 데이터로 Qwen2.5-3B를 QLoRA 파인튜닝 → 우리 문제 스타일을 체화한 모델

## 순서

### 1) 학습 데이터 만들기 (내 PC, 무료)
```bash
cd "C:\Users\이인혁\Desktop\변형문제생성기\web"

# 무료·오프라인 (LLM 불필요) — 코드제어 4유형, 밀도 높게
node selfllm/build_dataset.js 400 3 --fresh

# 여러 번 돌리면 이어붙어 밀도가 계속 올라감(--fresh 빼면 누적)
node selfllm/build_dataset.js 400 3
node selfllm/build_dataset.js 500 4

# (선택) 고밀도·전유형 — 무한모드 키를 환경변수로
set GEMINI_KEY=AIza...   &&  set GROQ_KEY=gsk_...   &&  set CEREBRAS_KEY=csk-...
node selfllm/build_dataset.js 300 2 --online
```
→ `selfllm/train.jsonl` 생성(누적). 최소 500~1000줄이면 학습 시작 가능, 많을수록 좋음.

### 2) 무료 GPU에서 학습 (Colab) — 턴키
> 데이터(`train.jsonl`)는 저장소에 포함되어 있어 **노트북이 자동 다운로드**합니다. 업로드 불필요.
> 직접 만든 데이터로 학습하려면 1)에서 만든 `train.jsonl`을 업로드하면 자동다운로드를 건너뜁니다.

1. https://colab.research.google.com → 새 노트북 → **런타임 유형: GPU(T4)**
2. `selfllm/finetune_colab.py` 내용을 셀에 붙여넣기(또는 셀별 실행)
3. `[2] 설정`의 `HF_USERNAME`만 본인 HuggingFace 아이디로 변경(`MODEL_SIZE`는 3B 권장, 7B 선택)
4. 순서대로 실행 → `[7]`에서 **쓰기 토큰**을 물어보면 붙여넣기(huggingface.co/settings/tokens)
5. 30~60분 후 **내 모델이 HuggingFace에 업로드**(파일 소유) — 3B 병합모델 + GGUF(Ollama용)

### 3) 우리 모델 쓰기
- **고사양 PC/서버(Ollama)**: `ollama run hf.co/<내계정>/ray-english-exam-3b-gguf` → 무제한·무료
- **출제자 뇌 앱에 연결**: 무한모드 → 로컬 AI(Ollama)에 위 모델명 입력 → 우리 모델로 출제
- **HuggingFace 무료 추론**: Inference API/Spaces로 호스팅

## 진화 엔진 + 무료 신경다발 (점점 완벽해지는 루프)

한 번 만든 모델로 끝이 아니라, **절대 나빠지지 않으면서 매번 올라가는** 자기개선 루프.

```bash
# 1) 데이터 성장 + 벤치마크 보장(한 방)  — 생성→흡수→홀드아웃 gold 고정
node selfllm/evolve.js
#    · build_dataset(코드 4유형, 홀드아웃 자동제외) + ingest_github(실제시험 빈칸)
#    · benchmark.jsonl(정답 아는 시험셋, 학습에 안 섞임) + evolve_log.json 기록

# 2) (무료 증류) 분야별 신경다발 = 무료모델 여러 개를 제안→집계(MoA)→검증
node selfllm/neural_bundle.js --list          # 유형별 전담 파이프라인 보기
node selfllm/neural_bundle.js --online 주제 3  # 무료키로 앙상블 가동(추론형)

# 3) GitHub/HF 오픈 시험데이터 더 흡수(도메인 보강, 정답100%)
node selfllm/ingest_github.js 500             # CLOTH 실제 영어시험 빈칸

# 4) 재학습 후 승격 게이트(퇴화 차단) — 오를 때만 새 모델 채택
python selfllm/eval_model.py --ollama ray-english-exam-3b   # 또는 Colab에서 evaluate_colab(model,tokenizer)
```

- **기계형(순서·삽입·연결어·첫글자)** → 코드가 정답 100% 보증(앙상블 불필요)
- **추론형(빈칸·어법·주제·제목·함의…)** → 무료 신경다발(MoA)로 프론티어급 근접 → 우리 모델에 **증류**
- **퇴화 차단** → benchmark.jsonl 점수가 오를 때만 승격(`benchmark_scores.json`에 기록)
- 24시간 뇌(GitHub Actions)에 `evolve.js`를 걸면 자동으로 데이터가 계속 성장

## 참고
- 베이스 3B는 무료 T4에 맞춘 선택. 더 좋은 품질은 7B(T4 빠듯) 또는 유료 GPU에서 14B.
- 이 PC(RAM 7.7GB·GPU 없음)에선 학습·구동 불가 → 학습은 Colab, 구동은 HF/고사양기기.
- 데이터는 돌릴수록 밀도가 오르니, 틈틈이 `build_dataset.js`를 재실행해 train.jsonl을 키우세요.
