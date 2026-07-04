# -*- coding: utf-8 -*-
# =============================================================================
#  Ray English 자체 LLM — 무료 Colab GPU 파인튜닝 (QLoRA · Unsloth)
#  결과: 우리 데이터로 학습한 "Ray English 출제 모델" 파일을 HuggingFace에 소유
#
#  사용법 (https://colab.research.google.com 에서):
#   0) 런타임 → 런타임 유형 변경 → GPU(T4) 선택  [무료]
#   1) 이 파일 내용을 셀에 붙여넣거나, 셀별(#%%)로 나눠 실행
#   2) selfllm/train.jsonl 을 Colab에 업로드(왼쪽 폴더 아이콘 → 업로드)
#   3) HF_TOKEN 에 HuggingFace 쓰기 토큰 입력(huggingface.co/settings/tokens, 무료)
#   4) 순서대로 실행 → 30~60분 후 우리 모델이 HF에 올라감(파일 소유)
#
#  베이스 모델: Qwen2.5-3B-Instruct (한국어·영어 우수, 무료 T4에서 QLoRA 가능)
# =============================================================================

# %% [1] 설치 (Unsloth = 무료 T4에서 2배 빠르고 메모리 절약)
# !pip install -q "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install -q --no-deps trl peft accelerate bitsandbytes

# %% [2] 설정
BASE_MODEL   = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"   # 무료 T4용 4bit. 더 크게: 7B로 교체 가능(T4 빠듯)
DATA_PATH    = "train.jsonl"          # 2)에서 업로드한 파일
HF_REPO      = "your-username/ray-english-exam-3b"   # ← 본인 HF 계정으로 변경
HF_TOKEN     = ""                     # ← HuggingFace 쓰기 토큰
MAX_SEQ_LEN  = 2048
EPOCHS       = 2                      # 데이터 많으면 1~2, 적으면 3

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

# %% [4] 데이터 로드 → Qwen 채팅 템플릿 적용
from datasets import load_dataset
ds = load_dataset("json", data_files = DATA_PATH, split = "train")
def fmt(ex):
    return { "text": tokenizer.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False) }
ds = ds.map(fmt)
print("학습 샘플:", len(ds))
print(ds[0]["text"][:400])

# %% [5] 학습 (QLoRA)
from trl import SFTTrainer
from transformers import TrainingArguments
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
trainer.train()

# %% [6] 빠른 시험 — 우리 모델이 출제하는지 확인
FastLanguageModel.for_inference(model)
msgs = [
  {"role":"system","content":"너는 임용을 통과한 한국 고등학교 영어 내신 변형문제 출제 전문가다. 지문을 분석해 정확한 문항·워크북·분석을 만든다."},
  {"role":"user","content":"[유형] 글의순서\n[지문]\nWhen our actions clash with our beliefs, we feel an uncomfortable tension that the mind is eager to remove. Instead of admitting we were wrong, we quietly reshape our beliefs until they fit what we have already done.\n\n위 지문으로 '글의순서' 유형의 변형문항을 만들어라."},
]
inputs = tokenizer.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True, return_tensors="pt").to("cuda")
out = model.generate(input_ids=inputs, max_new_tokens=400, temperature=0.5, do_sample=True)
print(tokenizer.decode(out[0][inputs.shape[1]:], skip_special_tokens=True))

# %% [7] 저장 — HuggingFace에 우리 모델 업로드(파일 소유) + GGUF(Ollama용)
# LoRA 어댑터 + 병합 모델을 HF에 push
model.push_to_hub_merged(HF_REPO, tokenizer, save_method="merged_16bit", token=HF_TOKEN)
# Ollama에서 바로 쓸 수 있는 GGUF(q4_k_m)도 HF에 push
model.push_to_hub_gguf(HF_REPO + "-gguf", tokenizer, quantization_method="q4_k_m", token=HF_TOKEN)
print("완료! 내 모델:", "https://huggingface.co/" + HF_REPO)
print("Ollama로 쓰기(고사양 PC):  ollama run hf.co/" + HF_REPO + "-gguf")
