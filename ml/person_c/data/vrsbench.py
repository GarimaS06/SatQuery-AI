"""Adapter for manually downloaded VRSBench VQA evaluation annotations."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


class VRSBenchDatasetError(ValueError):
    """Raised when a local VRSBench VQA layout is incomplete or malformed."""


@dataclass(frozen=True)
class VRSBenchRecord:
    sample_id: int | str
    image_id: str
    image_path: Path
    question: str
    ground_truth: str
    question_type: str


class VRSBenchDataset:
    """Read the official `VRSBench_EVAL_vqa.json` split without downloads.

    The official Hugging Face release provides `VRSBench_EVAL_vqa.json` and
    `Images_val.zip`. After manual extraction, this adapter expects:

        <root>/VRSBench_EVAL_vqa.json
        <root>/Images_val/<image_id>
    """

    ANNOTATION_FILE = "VRSBench_EVAL_vqa.json"

    def __init__(self, dataset_path: str | Path, split: str = "val", images_dir: str | Path | None = None) -> None:
        self.root = Path(dataset_path)
        self.split = split.lower()
        if self.split not in {"val", "eval", "evaluation"}:
            raise VRSBenchDatasetError(
                "Person C VQA baseline supports the official VRSBench validation/evaluation split only "
                "(VRSBench_EVAL_vqa.json)."
            )
        self.annotation_path = self.root / self.ANNOTATION_FILE
        self.images_dir = Path(images_dir) if images_dir else self.root / "Images_val"

    def load_records(self, max_samples: int | None = None) -> list[VRSBenchRecord]:
        if max_samples is not None and max_samples < 1:
            raise VRSBenchDatasetError("max_samples must be positive when supplied.")
        if not self.annotation_path.is_file():
            raise VRSBenchDatasetError(f"Missing official VRSBench VQA annotations: {self.annotation_path}")
        if not self.images_dir.is_dir():
            raise VRSBenchDatasetError(f"Missing extracted VRSBench image directory: {self.images_dir}")
        try:
            raw_records = json.loads(self.annotation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise VRSBenchDatasetError(f"Could not parse VRSBench annotations: {exc}") from exc
        if not isinstance(raw_records, list):
            raise VRSBenchDatasetError("Official VRSBench VQA annotations must be a JSON array.")

        records: list[VRSBenchRecord] = []
        for index, raw in enumerate(raw_records):
            records.append(self._parse_record(raw, index))
            if max_samples is not None and len(records) >= max_samples:
                break
        return records

    def _parse_record(self, raw: object, index: int) -> VRSBenchRecord:
        if not isinstance(raw, dict):
            raise VRSBenchDatasetError(f"Annotation at index {index} must be an object.")
        required = ("image_id", "question", "ground_truth", "question_id", "type")
        missing = [field for field in required if field not in raw]
        if missing:
            raise VRSBenchDatasetError(f"Annotation at index {index} is missing required field(s): {', '.join(missing)}")
        values = {field: raw[field] for field in required}
        if not all(isinstance(values[field], str) and values[field].strip() for field in ("image_id", "question", "ground_truth", "type")):
            raise VRSBenchDatasetError(f"Annotation at index {index} has an empty or invalid VQA text field.")
        image_id = values["image_id"]
        image_path = self.images_dir / image_id
        if image_path.name != image_id:
            raise VRSBenchDatasetError(f"Annotation at index {index} has an unsafe image_id: {image_id}")
        return VRSBenchRecord(
            sample_id=values["question_id"],
            image_id=image_id,
            image_path=image_path,
            question=values["question"].strip(),
            ground_truth=values["ground_truth"].strip(),
            question_type=values["type"].strip(),
        )

    @staticmethod
    def ensure_image_exists(record: VRSBenchRecord) -> None:
        if not record.image_path.is_file():
            raise VRSBenchDatasetError(f"Missing VRSBench image for sample {record.sample_id}: {record.image_path}")
