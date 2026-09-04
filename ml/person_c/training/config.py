"""Configuration and command rendering for future GeoChat LoRA training."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class LoRAConfig:
    rank: int = 64
    alpha: int = 16
    dropout: float = 0.05
    bias: str = "none"

    def validate(self) -> None:
        if self.rank < 1 or self.alpha < 1:
            raise ValueError("LoRA rank and alpha must be positive.")
        if not 0 <= self.dropout < 1:
            raise ValueError("LoRA dropout must be in [0, 1).")
        if self.bias not in {"none", "all", "lora_only"}:
            raise ValueError("LoRA bias must be none, all, or lora_only.")


@dataclass(frozen=True)
class TrainingConfig:
    base_model_path: Path
    geochat_repo_path: Path
    training_dataset_path: Path
    output_dir: Path = Path("outputs/person_c/geochat_vrsbench_lora")
    validation_dataset_path: Path | None = None
    device: str = "cuda"
    quantization: str = "none"  # Official LoRA default. `4bit` is experimental GeoChat trainer support.
    lora: LoRAConfig = field(default_factory=LoRAConfig)
    learning_rate: float = 2e-4
    batch_size: int = 1
    gradient_accumulation: int = 16
    epochs: int = 1
    max_samples: int | None = None
    seed: int = 42
    model_max_length: int = 2048
    deepspeed_config: str = "scripts/zero3_offload.json"

    def validate(self, require_local_assets: bool = False) -> None:
        self.lora.validate()
        if self.quantization not in {"none", "4bit"}:
            raise ValueError("quantization must be 'none' (documented LoRA) or '4bit'.")
        if self.learning_rate <= 0 or self.batch_size < 1 or self.gradient_accumulation < 1 or self.epochs < 1:
            raise ValueError("Learning rate, batch size, gradient accumulation, and epochs must be positive.")
        if self.max_samples is not None and self.max_samples < 1:
            raise ValueError("max_samples must be positive when supplied.")
        if require_local_assets:
            for label, path in (("training_dataset_path", self.training_dataset_path), ("geochat_repo_path", self.geochat_repo_path)):
                if not path.is_dir():
                    raise ValueError(f"{label} must be an existing directory: {path}")

    def to_dict(self) -> dict:
        data = asdict(self)
        for key in ("base_model_path", "geochat_repo_path", "training_dataset_path", "output_dir", "validation_dataset_path"):
            if data[key] is not None:
                data[key] = str(data[key])
        return data
