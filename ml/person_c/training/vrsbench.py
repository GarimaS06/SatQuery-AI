"""VRSBench train-split validation and GeoChat SFT-format preparation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError


class VRSBenchTrainingError(ValueError):
    pass


@dataclass(frozen=True)
class TrainingExample:
    image: str
    conversations: list[dict[str, str]]

    def to_geochat_record(self) -> dict:
        return {"image": self.image, "conversations": self.conversations}


class VRSBenchTrainingAdapter:
    """Filter official VRSBench train records to VQA SFT examples.

    `VRSBench_train.json` already follows the GeoChat/LLaVA supervised format.
    No prompt rewriting occurs: the adapter validates and preserves the
    `<image>\n[vqa] ...` human instruction and its GPT answer verbatim.
    """

    ANNOTATION_FILE = "VRSBench_train.json"

    def __init__(self, dataset_path: str | Path, images_dir: str | Path | None = None) -> None:
        self.root = Path(dataset_path)
        self.annotation_path = self.root / self.ANNOTATION_FILE
        self.images_dir = Path(images_dir) if images_dir else self.root / "Images_train"

    def load_vqa_examples(self, max_samples: int | None = None, verify_images: bool = True) -> list[TrainingExample]:
        if max_samples is not None and max_samples < 1:
            raise VRSBenchTrainingError("max_samples must be positive when supplied.")
        if not self.annotation_path.is_file():
            raise VRSBenchTrainingError(f"Missing official VRSBench training annotations: {self.annotation_path}")
        if not self.images_dir.is_dir():
            raise VRSBenchTrainingError(f"Missing extracted VRSBench training image directory: {self.images_dir}")
        try:
            records = json.loads(self.annotation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise VRSBenchTrainingError(f"Could not parse VRSBench training annotations: {exc}") from exc
        if not isinstance(records, list):
            raise VRSBenchTrainingError("VRSBench_train.json must be a JSON array.")

        examples: list[TrainingExample] = []
        for index, record in enumerate(records):
            example = self._parse_vqa_record(record, index)
            if example is None:
                continue
            if verify_images:
                self._verify_image(example.image, index)
            examples.append(example)
            if max_samples is not None and len(examples) >= max_samples:
                break
        if not examples:
            raise VRSBenchTrainingError("No valid `[vqa]` examples were found in VRSBench_train.json.")
        return examples

    def _parse_vqa_record(self, record: object, index: int) -> TrainingExample | None:
        if not isinstance(record, dict):
            raise VRSBenchTrainingError(f"Training record at index {index} must be an object.")
        if "image" not in record or "conversations" not in record:
            raise VRSBenchTrainingError(f"Training record at index {index} requires image and conversations fields.")
        image, conversations = record["image"], record["conversations"]
        if not isinstance(image, str) or not image or Path(image).name != image:
            raise VRSBenchTrainingError(f"Training record at index {index} has an unsafe or invalid image field.")
        if not isinstance(conversations, list) or len(conversations) != 2:
            raise VRSBenchTrainingError(f"Training record at index {index} must contain one human/GPT conversation pair.")
        human, assistant = conversations
        if not all(isinstance(item, dict) for item in conversations):
            raise VRSBenchTrainingError(f"Training record at index {index} has invalid conversation objects.")
        if human.get("from") != "human" or assistant.get("from") != "gpt":
            raise VRSBenchTrainingError(f"Training record at index {index} must use human then gpt roles.")
        if not isinstance(human.get("value"), str) or not isinstance(assistant.get("value"), str):
            raise VRSBenchTrainingError(f"Training record at index {index} has non-text conversation values.")
        if "[vqa]" not in human["value"].lower():
            return None
        if "<image>" not in human["value"].lower() or not assistant["value"].strip():
            raise VRSBenchTrainingError(f"VQA record at index {index} must contain <image> and a non-empty answer.")
        return TrainingExample(image=image, conversations=[{"from": "human", "value": human["value"]}, {"from": "gpt", "value": assistant["value"]}])

    def _verify_image(self, filename: str, index: int) -> None:
        path = self.images_dir / filename
        if not path.is_file():
            raise VRSBenchTrainingError(f"Missing training image at record {index}: {path}")
        try:
            with Image.open(path) as image:
                image.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise VRSBenchTrainingError(f"Unreadable training image at record {index}: {path}") from exc

    @staticmethod
    def write_geochat_json(examples: list[TrainingExample], output_path: str | Path) -> None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([example.to_geochat_record() for example in examples], indent=2), encoding="utf-8")
