# Person C: Remote-Sensing VQA Foundation

## Selected model

The selected model is [GeoChat-7B](https://github.com/mbzuai-oryx/GeoChat), a GeoChat remote-sensing instruction-tuned vision-language model. It was selected because it supports remote-sensing VQA, captions, and grounding, and has documented LoRA fine-tuning and RSVQA/VRSBench evaluation paths. This module does not substitute a generic VLM.

## Input assumptions and preprocessing ownership

Person A supplies a single rendered satellite image as a PNG, normally RGB, at no more than 2048 x 2048 pixels, with aspect ratio preserved. Person C validates the PNG/PIL image, converts non-RGB modes to RGB, downscales only images exceeding 2048 pixels, and never enlarges small images.

GeoChat-specific preprocessing remains here, not in `preprocessing/`: its official code pads to square using the processor mean and then preprocesses at 504 x 504. This operation is only reached in real mode.

## Mock mode

Mock mode is the default and needs only Pillow. It loads no model, needs no GPU, and returns an explicitly marked `MOCK TEST OUTPUT` result.

```powershell
python -m ml.person_c.cli --mock --image path\\to\\image.png --question "Is there water?"
```

## Real-model status and hardware

The GeoChat adapter follows the official `load_pretrained_model` and batch-VQA input flow, but it intentionally requires an existing local checkpoint directory and official GeoChat code checkout. It never downloads weights automatically.

Official GeoChat uses a 32-layer, 4096-hidden-size LLaMA/Vicuna 7B backbone plus `openai/clip-vit-large-patch14-336`. Its configuration uses padded 504 x 504 image preprocessing. The official loader supports `load_8bit` and 4-bit NF4 through `BitsAndBytesConfig` (`float16` compute, double quantization); this is inference quantization, not QLoRA training, and does not change GeoChat's architecture.

The current RTX 3050 Laptop GPU has 6 GiB dedicated VRAM. It is **not a safe GeoChat-7B inference target**:

- FP16 requires about 20 GiB dedicated VRAM for stable single-image inference.
- 8-bit requires about 12 GiB dedicated VRAM in this setup.
- 4-bit has the smallest supported weight representation but still requires about 12 GiB dedicated VRAM once the 504px vision tower, image tokens/KV cache, and CUDA runtime headroom are included.
- CPU offload is not enabled. GeoChat's official loader still force-moves the vision tower to the requested device and has no supported multimodal CPU-offload configuration. The 16 GB system RAM must not be treated as extra VRAM; it also lacks reliable headroom for a 7B runtime.

Real mode therefore performs a conservative CUDA-VRAM preflight before model loading. It will refuse the 6 GiB GPU rather than partially load and fail with an out-of-memory error. The safe deployment target is a cloud L4 or A10G GPU with **24 GiB VRAM** and at least 32 GB system RAM, using official 4-bit loading. A 24 GiB GPU also provides safer FP16 headroom for short requests; no training is included here.

### Future cloud setup (not run by this milestone)

Use a Python 3.10 CUDA environment, clone the official GeoChat repository outside this project, then install its pinned package manifest. The official manifest pins `torch==2.0.1`, `transformers==4.31.0`, `accelerate==0.21.0`, `peft==0.4.0`, and `bitsandbytes==0.41.0`.

```bash
git clone https://github.com/mbzuai-oryx/GeoChat.git /opt/GeoChat
conda create -n geochat python=3.10 -y
conda activate geochat
pip install -e /opt/GeoChat
```

After manually downloading the official `MBZUAI/geochat-7B` checkpoint into `/models/geochat-7B`, run the Person C wrapper from this repository:

```bash
python -m ml.person_c.cli --image /data/example.png --question "Is there water?" --model-path /models/geochat-7B --geochat-repo-path /opt/GeoChat --load-4bit --device cuda
```

No checkpoint or dependency for real GeoChat inference has been downloaded or installed by this project.

The internal `VQAResult` is a Person C-only structure. It will be adapted to Person B's `AnalysisResult` only after that schema is confirmed.

## VRSBench VQA baseline evaluation

[VRSBench](https://github.com/lx709/VRSBench) is the selected primary benchmark because its 29,614 remote-sensing images include 123,221 VQA pairs as well as future captioning and referring tasks. This milestone implements only its VQA validation/evaluation path, before any fine-tuning.

Download the official VRSBench release manually from its [Hugging Face dataset page](https://huggingface.co/datasets/xiang709/VRSBench); do not use this project to fetch it. Extract the validation images and place the official VQA evaluation JSON as follows:

```text
<vrsbench-root>/
  VRSBench_EVAL_vqa.json
  Images_val/
    P0003_0002.png
    ...
```

The official evaluation records contain `image_id`, `question`, `ground_truth`, `question_id`, and `type`. VRSBench supplies train and validation assets; this baseline intentionally accepts only the official validation/evaluation VQA file, not the training file.

VRSBench's final VQA protocol reports semantic accuracy: it first accepts ground-truth containment and exact `yes`/`no`/0–99 matches, then uses the benchmark's published GPT judge prompt for remaining open answers. The evaluator reports that overall accuracy and per-question-type accuracy only with `--judge official-gpt` and `OPENAI_API_KEY`. `--judge local-precheck` is a development-only, explicitly non-official subset. Mock mode emits no benchmark metric.

CPU-only 10-record pipeline check (requires manually supplied tiny/full local dataset files, but no weights):

```powershell
python -m ml.person_c.evaluation --mock --dataset-path C:\data\VRSBench --output-dir outputs\vrsbench_mock --max-samples 10
```

Real 10-record cloud-GPU baseline evaluation uses manually installed GeoChat, manually downloaded checkpoint, and the official semantic judge:

```bash
export OPENAI_API_KEY="..."
python -m ml.person_c.evaluation --dataset-path /data/VRSBench --output-dir /outputs/vrsbench_geochat_10 --max-samples 10 --model-path /models/geochat-7B --geochat-repo-path /opt/GeoChat --load-4bit --device cuda --judge official-gpt
```

For the full validation evaluation, omit `--max-samples`. GeoChat baseline evaluation and future VRSBench fine-tuning are distinct; no training is started or implied by this evaluator.

## VRSBench LoRA adaptation pipeline

This repository now prepares, but does not execute, a real remote-sensing adaptation job. It uses the official VRSBench `VRSBench_train.json` training split, whose public records already contain `image` and a two-turn `conversations` list. Person C filters only records whose human instruction contains `[vqa]`, validates the matching image in `Images_train/`, and writes the exact GeoChat/LLaVA SFT payload unchanged:

```json
{
  "image": "00002_0000.png",
  "conversations": [
    {"from": "human", "value": "<image>\n[vqa] ..."},
    {"from": "gpt", "value": "..."}
  ]
}
```

VRSBench is real remote-sensing data derived from DOTA-v2/DIOR imagery with human-verified annotations. Manually obtain `VRSBench_train.json` and `Images_train.zip` from the official dataset release, then extract:

```text
<vrsbench-train-root>/
  VRSBench_train.json
  Images_train/
    00002_0000.png
    ...
```

The default method is **LoRA**, following GeoChat's documented `finetune_lora.sh`: rank 64, alpha 16, dropout 0.05, language-model linear targets selected by GeoChat's official trainer. The trainer excludes `vision_tower`, `vision_resampler`, and `mm_projector` from LoRA target discovery; the vision tower remains frozen for this adaptation. The official GeoChat trainer has a 4-bit code path, but its standalone `finetune_qlora.sh` is explicitly labelled for original LLaVA rather than LLaVA-v1.5. Therefore the prepared, documented baseline is LoRA (`--quantization none`); 4-bit is available only as an explicit future cloud experiment, not claimed as a validated GeoChat-v1.5 QLoRA recipe.

Dry-run preparation validates images and records, creates `prepared_vrsbench_vqa.json`, `config.json`, an empty future `adapter/` location, and a README. It does not load a model, initialize a tokenizer, invoke DeepSpeed, or create training metrics:

```bash
python -m ml.person_c.training.train --dry-run --base-model-path /models/geochat-7B --geochat-repo-path /opt/GeoChat --training-dataset-path /data/VRSBench --output-dir outputs/person_c/geochat_vrsbench_lora --max-samples 10
```

The dry run prints the exact future command. On a cloud GPU, use a 24 GB GPU minimum (40 GB preferred) with at least 64 GB host RAM when using GeoChat's documented ZeRO-3 CPU offload configuration. After manual asset provisioning and dry-run review, the rendered command invokes GeoChat's official `geochat/train/train_mem.py` with LoRA enabled. It writes an unmerged PEFT adapter to `outputs/person_c/geochat_vrsbench_lora/adapter/`; later inference must load it on top of the original GeoChat checkpoint using the official loader's `model_base` + LoRA path flow. Do not run GeoChat's merge script for this project stage.

This is pipeline preparation only. No fine-tuned adapter, loss, accuracy, or VRSBench improvement has been produced. Baseline GeoChat refers to the original remote-sensing checkpoint; fine-tuned GeoChat will refer only to a future, separately documented VRSBench LoRA adapter.

## Remote-Sensing Scene Captioning

### Rationale: Captioning vs. Grounding

Person C is responsible for remote-sensing VQA plus either **scene captioning** or **text-guided grounding**. Scene captioning was selected as the primary path for this milestone because:
1. **Lower-risk hackathon delivery path**: Captioning directly leverages GeoChat's vision-language generation capabilities without introducing brittle bounding box string-coordinate parsing, IoU post-processing, or spatial annotation mismatches.
2. **Architecture reuse**: Scene captioning reuses the exact same model loader, 504px vision tower preprocessing, and greedy generation pipeline as VQA, maintaining an identical memory and safety footprint.
3. **Natural synergy with natural-language assistant goals**: Global image captions provide immediate holistic context for downstream user queries.

### Instruction Format and Generation

GeoChat was instruction-tuned on multimodal remote-sensing tasks using standard instruction tags. For scene captioning, Person C uses the official prompt format:
`[caption] Describe the given remote sensing image in detail.`
Custom captioning prompts (e.g., focused on specific terrain or objects) are also supported via the `--prompt` argument.

### Captioning Mock Mode

Mock mode requires only Pillow and returns a structured `CaptionResult` with `"MOCK TEST OUTPUT"` status without loading weights:

```powershell
python -m ml.person_c.captioning --mock --image path\to\image.png
```

### Real-Model Captioning on Cloud GPU

On a CUDA device with $\ge 12\text{ GiB}$ dedicated VRAM (e.g. cloud L4/A10G with 24 GiB), run real captioning with:

```bash
python -m ml.person_c.captioning --image /data/example.png --model-path /models/geochat-7B --geochat-repo-path /opt/GeoChat --load-4bit --device cuda
```

The returned `CaptionResult` contains `caption`, `model_name`, `status`, `warnings`, `error`, and `metadata` (including image dimensions and the prompt used).

## Deferred work

Text-guided grounding, real LoRA/QLoRA training execution, router integration, API/frontend endpoints, and paired-image support are deliberately out of scope for this milestone.

## Backend selection: PERSON_C_BACKEND

Person C VQA and captioning services select their inference engine from the environment variable `PERSON_C_BACKEND`:

| Value | Meaning | Default? |
|---|---|---|
| `moondream2` | Local vikhyatk/moondream2 (fp16, ~4 GiB VRAM) | **Yes** |
| `mock` | CPU-safe stub, no weights | — |
| `geochat` | Local MBZUAI/geochat-7B (≥12 GiB VRAM, cloud only) | — |

If the variable is unset or contains an unrecognised value, `moondream2` is used. This mirrors Person A's `ROUTER_ENABLED` pattern in `preprocessing/services/routerService.js`.

```powershell
# explicitly select mock (useful in CI)
$env:PERSON_C_BACKEND = "mock"

# switch to GeoChat on a cloud GPU
$env:PERSON_C_BACKEND = "geochat"
```

## Moondream2 — local prototype backend

### Disclaimer: Moondream2 is a vanilla general-purpose VLM

**Moondream2 is NOT the remote-sensing-adapted model.** It is a general-purpose visual language model with no fine-tuning on remote-sensing imagery or VRSBench. It does not claim performance equivalent to GeoChat-7B on RSVQA/VRSBench metrics. It is used here purely as a local prototype inference backend that fits on the RTX 3050 Laptop 6 GB GPU, to demonstrate the end-to-end inference pipeline while GeoChat-7B remains reserved for the final cloud ML evaluation.

**Final ML backend is GeoChat-7B**, evaluated on VRSBench with LoRA/QLoRA adaptation. Moondream2 answers are not benchmark claims.

### Why Moondream2 for prototyping

- Fits in ~4 GiB VRAM in fp16 — compatible with RTX 3050 Laptop 6 GB.
- Loads via standard HuggingFace Transformers (no separate code checkout needed).
- Provides real end-to-end inference for VQA (`image + question → answer`) and captioning (`image → caption`) immediately on local hardware.
- Enables integration testing with Person D's router tools before cloud GPU is available.

### trust_remote_code

Moondream2 uses custom model code in its HuggingFace repository. Loading requires `trust_remote_code=True`. This is explicitly set in `MoondreamAdapter`. Review the model card at <https://huggingface.co/vikhyatk/moondream2> before deploying in a production environment.

### Pinned revision

The adapter pins `revision="2025-06-21"` (latest entry in `vikhyatk/moondream2/blob/main/versions.txt` at implementation time). Pinning prevents silent API breakage when upstream updates the repository. To upgrade: change `MOONDREAM_REVISION` in `ml/person_c/moondream_adapter.py` and verify the `answer_question` / `caption` method signatures.

### Install requirements

```bash
pip install transformers>=4.36.0 accelerate einops torch Pillow huggingface_hub
```

### One-time weight download (do once, then local-only)

```bash
python -c "from huggingface_hub import snapshot_download; \
snapshot_download('vikhyatk/moondream2', revision='2025-06-21', local_dir='weights/moondream2')"
```

This downloads ~3.9 GiB. After download, set `PERSON_C_BACKEND=moondream2` and pass `--model-path weights/moondream2`.

### Real local VQA (Moondream2)

```powershell
py -3.13 -m ml.person_c.cli --backend moondream2 --model-path weights/moondream2 --image path\to\image.png --question "What land cover type is visible?"
```

### Real local captioning (Moondream2)

```powershell
py -3.13 -m ml.person_c.captioning --backend moondream2 --model-path weights/moondream2 --image path\to\image.png
```

### Device handling

- CUDA detected → model loaded in fp16 on CUDA.
- CUDA absent → CPU fallback (slower but functional, no crash).
- Runtime OOM on CUDA → model moved to CPU automatically, inference retried once.
- Weights not found locally → `MoondreamLoadError` with setup command, no crash.
