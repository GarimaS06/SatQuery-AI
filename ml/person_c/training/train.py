"""Prepare a future GeoChat/VRSBench LoRA job; never launches training."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import LoRAConfig, TrainingConfig
from .vrsbench import VRSBenchTrainingAdapter, VRSBenchTrainingError


def prepare_dry_run(config: TrainingConfig) -> dict:
    """Validate assets and write exact GeoChat SFT JSON/output metadata only."""

    config.validate(require_local_assets=True)
    adapter = VRSBenchTrainingAdapter(config.training_dataset_path)
    examples = adapter.load_vqa_examples(config.max_samples, verify_images=True)
    prepared_path = config.output_dir / "prepared_vrsbench_vqa.json"
    VRSBenchTrainingAdapter.write_geochat_json(examples, prepared_path)
    config.output_dir.mkdir(parents=True, exist_ok=True)
    (config.output_dir / "adapter").mkdir(exist_ok=True)
    (config.output_dir / "config.json").write_text(json.dumps(config.to_dict(), indent=2), encoding="utf-8")
    (config.output_dir / "README.md").write_text(
        "# GeoChat VRSBench LoRA\n\nStatus: pipeline preparation / dry run only. No adapter, metrics, "
        "training loss, or benchmark score has been produced.\n",
        encoding="utf-8",
    )
    return {
        "status": "DRY_RUN",
        "training_examples": len(examples),
        "prepared_data_path": str(prepared_path),
        "adapter_output_path": str(config.output_dir / "adapter"),
        "model_initialization": "not attempted; no checkpoint is downloaded or loaded during dry run",
        "effective_configuration": config.to_dict(),
        "future_training_command": render_geochat_command(config, prepared_path),
    }


def render_geochat_command(config: TrainingConfig, prepared_path: Path) -> list[str]:
    """Render supported official trainer arguments without executing them."""

    trainer = config.geochat_repo_path / "geochat" / "train" / "train_mem.py"
    deepspeed_candidate = Path(config.deepspeed_config)
    if deepspeed_candidate.is_file():
        deepspeed = deepspeed_candidate
    elif (config.geochat_repo_path / config.deepspeed_config).is_file():
        deepspeed = config.geochat_repo_path / config.deepspeed_config
    elif deepspeed_candidate.is_absolute():
        deepspeed = deepspeed_candidate
    else:
        deepspeed = config.geochat_repo_path / config.deepspeed_config

    command = [
        "deepspeed", "--include", "localhost:0", str(trainer),
        "--deepspeed", str(deepspeed),
        "--lora_enable", "True",
        "--lora_r", str(config.lora.rank),
        "--lora_alpha", str(config.lora.alpha),
        "--lora_dropout", str(config.lora.dropout),
        "--lora_bias", config.lora.bias,
        "--model_name_or_path", str(config.base_model_path),
        "--version", "v1",
        "--data_path", str(prepared_path),
        "--image_folder", str(config.training_dataset_path / "Images_train"),
        "--vision_tower", "openai/clip-vit-large-patch14-336",
        "--mm_projector_type", "mlp2x_gelu",
        "--mm_vision_select_layer", "-2",
        "--mm_use_im_start_end", "False",
        "--mm_use_im_patch_token", "False",
        "--image_aspect_ratio", "pad",
        "--bf16", "True",
        "--output_dir", str(config.output_dir / "adapter"),
        "--num_train_epochs", str(config.epochs),
        "--per_device_train_batch_size", str(config.batch_size),
        "--gradient_accumulation_steps", str(config.gradient_accumulation),
        "--evaluation_strategy", "no",
        "--save_strategy", "epoch",
        "--save_total_limit", "1",
        "--learning_rate", str(config.learning_rate),
        "--weight_decay", "0.0",
        "--warmup_ratio", "0.03",
        "--lr_scheduler_type", "cosine",
        "--model_max_length", str(config.model_max_length),
        "--gradient_checkpointing", "True",
        "--lazy_preprocess", "True",
        "--seed", str(config.seed),
    ]
    if config.quantization == "4bit":
        command.extend(["--bits", "4", "--double_quant", "True", "--quant_type", "nf4"])
    return command


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare GeoChat VRSBench LoRA training; no training is launched.")
    parser.add_argument("--dry-run", action="store_true", required=True)
    parser.add_argument("--base-model-path", type=Path, required=True)
    parser.add_argument("--geochat-repo-path", type=Path, required=True)
    parser.add_argument("--training-dataset-path", type=Path, required=True)
    parser.add_argument("--validation-dataset-path", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("outputs/person_c/geochat_vrsbench_lora"))
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--quantization", choices=("none", "4bit"), default="none")
    parser.add_argument("--lora-rank", type=int, default=64)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--max-samples", type=int)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--deepspeed-config", default="scripts/zero3_offload.json", help="Path to DeepSpeed config JSON")
    args = parser.parse_args()
    config = TrainingConfig(
        args.base_model_path, args.geochat_repo_path, args.training_dataset_path, args.output_dir,
        args.validation_dataset_path, args.device, args.quantization,
        LoRAConfig(args.lora_rank, args.lora_alpha, args.lora_dropout), args.learning_rate,
        args.batch_size, args.gradient_accumulation, args.epochs, args.max_samples, args.seed,
        deepspeed_config=args.deepspeed_config,
    )
    try:
        report = prepare_dry_run(config)
    except (ValueError, VRSBenchTrainingError) as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
