# -*- coding: utf-8 -*-
# =============================================================================
#  Ray English 자체 LLM — 무료 Colab GPU 파인튜닝 (QLoRA · Unsloth)  [턴키]
#  결과: 우리 데이터로 학습한 "Ray English 출제 모델"을 HuggingFace에 소유
#
#  ▶ 준비물 2개(둘 다 무료):
#     · Google 계정 (Colab)         · HuggingFace 계정+쓰기토큰
#       토큰 발급: https://huggingface.co/settings/tokens (New token → Write)
#
#  ▶ 실행법 (https://colab.research.google.com):
#     0) 런타임 → 런타임 유형 변경 → 하드웨어 가속기 → T4 GPU 선택  [무료]
#     1) 이 파일 전체를 셀 하나에 붙여넣고 실행 (또는 #%% 블록별로 순서대로)
#     2) train.jsonl 은 [4]에서 우리 저장소에서 자동 다운로드됨 — 업로드 불필요!
#     3) [7]에서 HF 토큰을 물어보면 붙여넣기 → 30~60분 후 내 HF에 모델 소유
# =============================================================================

# %% [1] 설치 (Unsloth = 무료 T4에서 2배 빠르고 메모리 절약)
# !pip install -q "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install -q --no-deps trl peft accelerate bitsandbytes huggingface_hub

# %% [2] 설정 — 여기만 취향껏 바꾸면 됨
MODEL_SIZE   = "3B"                    # "3B"(무료 T4 권장) 또는 "7B"(느리지만 더 똑똑, T4 빠듯)
HF_USERNAME  = "your-username"         # ← 본인 HuggingFace 아이디로 변경 (예: inheok1103)
MAX_SEQ_LEN  = 2048
EPOCHS       = 3                       # 샘플 ~1.4천 → 3 epoch 적정(적으면 학습부족, 많으면 과적합)
DATA_URL     = "https://raw.githubusercontent.com/inheok1103-alt/byeonghyeong-maker/master/selfllm/train.jsonl"

BASE_MODEL = {"3B": "unsloth/Qwen2.5-3B-Instruct-bnb-4bit",
              "7B": "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"}[MODEL_SIZE]
HF_REPO    = HF_USERNAME + "/ray-english-exam-" + MODEL_SIZE.lower()

# %% [3] 모델 로드 (4bit) + LoRA 부착
from unsloth import FastLanguageModel
import torch
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = BASE_MODEL, max_seq_length = MAX_SEQ_LEN,
    dtype = None, load_in_4bit = True,
)
model = FastLanguageModel.get_peft_model(
    model, r = 16, lora_alpha = 16, lora_dropout = 0,
    target_modules = ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing = "unsloth", random_state = 3407,
)

# %% [4] 데이터 자동 다운로드(우리 저장소) → Qwen 채팅 템플릿 적용
import os
if not os.path.exists("train.jsonl"):
    import urllib.request
    urllib.request.urlretrieve(DATA_URL, "train.jsonl")   # 저장소에서 바로 받기 — 업로드 불필요
    print("train.jsonl 다운로드 완료")
from datasets import load_dataset
ds = load_dataset("json", data_files = "train.jsonl", split = "train")
def fmt(ex):
    return { "text": tokenizer.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False) }
ds = ds.map(fmt)
print("학습 샘플:", len(ds))
print("--- 샘플 미리보기 ---")
print(ds[0]["text"][:500])

# %% [5] 학습 (QLoRA) — assistant(정답) 부분만 학습하도록 마스킹
from trl import SFTTrainer
from transformers import TrainingArguments
try:
    from unsloth.chat_templates import train_on_responses_only
    _mask = True
except Exception:
    _mask = False
trainer = SFTTrainer(
    model = model, tokenizer = tokenizer, train_dataset = ds,
    dataset_text_field = "text", max_seq_length = MAX_SEQ_LEN, packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2, gradient_accumulation_steps = 4,
        warmup_steps = 10, num_train_epochs = EPOCHS, learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(), bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 10, optim = "adamw_8bit", weight_decay = 0.01,
        lr_scheduler_type = "linear", seed = 3407, output_dir = "outputs",
    ),
)
if _mask:  # 발문/지문(질문)은 손실에서 제외 → 정답 생성력만 강화
    try:
        trainer = train_on_responses_only(trainer,
            instruction_part="<|im_start|>user\n", response_part="<|im_start|>assistant\n")
    except Exception as e:
        print("마스킹 생략:", e)
trainer.train()

# %% [6] 빠른 시험 — 우리 모델이 실제로 출제하는지 확인
FastLanguageModel.for_inference(model)
msgs = [
  {"role":"system","content":"너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 지문을 분석해 정확한 문항·워크북·분석을 만든다."},
  {"role":"user","content":"[유형] 글의순서\n[지문]\nWhen our actions clash with our beliefs, we feel an uncomfortable tension that the mind is eager to remove. Instead of admitting we were wrong, we quietly reshape our beliefs until they fit what we have already done.\n\n위 지문으로 '글의순서' 유형의 변형문항을 만들어라."},
]
inputs = tokenizer.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True, return_tensors="pt").to("cuda")
out = model.generate(input_ids=inputs, max_new_tokens=400, temperature=0.5, do_sample=True)
print(tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))

# %% [7] 저장 — HuggingFace에 우리 모델 업로드(파일 소유) + GGUF(Ollama용)
from getpass import getpass
HF_TOKEN = getpass("HuggingFace 쓰기 토큰 붙여넣기(입력 숨김): ").strip()
# 병합 16bit 모델(파일 소유) push
model.push_to_hub_merged(HF_REPO, tokenizer, save_method="merged_16bit", token=HF_TOKEN)
# Ollama에서 바로 쓰는 GGUF(q4_k_m)도 push
model.push_to_hub_gguf(HF_REPO + "-gguf", tokenizer, quantization_method="q4_k_m", token=HF_TOKEN)
print("\n완료! 내 모델:", "https://huggingface.co/" + HF_REPO)
print("Ollama로 쓰기(고사양 PC/서버):  ollama run hf.co/" + HF_REPO + "-gguf")
print("→ 출제자 뇌 앱에서 무한모드가 이 로컬 모델(Ollama)을 1순위로 자동 사용")
