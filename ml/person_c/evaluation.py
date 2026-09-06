"""Reproducible VRSBench VQA baseline evaluation for Person C.

The official final VRSBench VQA protocol uses an OpenAI semantic judge after
deterministic matching checks. That external judge is opt-in and never called
by mock mode or the test suite.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .data.vrsbench import VRSBenchDataset, VRSBenchDatasetError, VRSBenchRecord
from .service import PersonCVQAService
from .vqa_types import GeoChatConfig

OFFICIAL_VQA_TYPES = (
    "object category",
    "object existence",
    "object quantity",
    "object color",
    "object shape",
    "object size",
    "object position",
    "object direction",
    "scene type",
    "reasoning",
)


@dataclass(frozen=True)
class VRSBenchEvaluationConfig:
    dataset_path: Path
    output_dir: Path
    split: str = "val"
    max_samples: int | None = None
    images_dir: Path | None = None
    judge_mode: str = "official-gpt"
    openai_model: str = "gpt-4o-mini"


@dataclass
class Prediction:
    sample_id: int | str
    image_id: str
    question: str
    ground_truth: str
    prediction: str | None
    question_type: str
    inference_status: str
    inference_error: str | None = None
    correct: bool | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class VQAJudge(Protocol):
    name: str
    official: bool

    def matches(self, record: VRSBenchRecord, prediction: str) -> bool:
        """Return semantic answer correctness for a non-empty prediction."""


class OfficialVRSBenchGPTJudge:
    """Official VRSBench VQA matching flow, using the published GPT prompt."""

    name = "vrsbench_vqa_semantic_accuracy_gpt"
    official = True

    def __init__(self, model: str = "gpt-4o-mini", api_key: str | None = None) -> None:
        self.model = model
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("Official VRSBench GPT judging requires OPENAI_API_KEY.")

    def matches(self, record: VRSBenchRecord, prediction: str) -> bool:
        ground_truth = record.ground_truth.lower().strip()
        predicted = prediction.lower().strip()
        # These deterministic checks exactly precede the GPT call in the
        # official evaluator notebook.
        if ground_truth in predicted:
            return True
        if ground_truth in {"yes", "no", *map(str, range(100))}:
            return ground_truth == predicted

        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("Official GPT judging requires the existing project dependency httpx.") from exc

        prompt = (
            f"Question: {record.question}\nGround Truth Answer: {ground_truth}\n"
            f"Predicted Answer: {predicted}\nDoes the predicted answer match the ground truth? "
            "Answer 1 for match and 0 for not match. Use semantic meaning not exact match. "
            "Synonyms are also treated as a match, e.g., football and soccer, playground and ground track field, "
            "building and rooftop, pond and swimming pool. Do not explain the reason.\n"
        )
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
                "max_tokens": 100,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        if answer not in {"0", "1"}:
            raise RuntimeError(f"Official VRSBench judge returned an invalid decision: {answer!r}")
        return answer == "1"


class LocalPrecheckJudge:
    """Deterministic subset of the official checks; not a benchmark metric."""

    name = "local_precheck_accuracy_not_official"
    official = False

    def matches(self, record: VRSBenchRecord, prediction: str) -> bool:
        ground_truth = record.ground_truth.lower().strip()
        predicted = prediction.lower().strip()
        if ground_truth in predicted:
            return True
        if ground_truth in {"yes", "no", *map(str, range(100))}:
            return ground_truth == predicted
        return False


class VRSBenchEvaluator:
    def __init__(self, service: PersonCVQAService, config: VRSBenchEvaluationConfig, judge: VQAJudge | None = None) -> None:
        self.service = service
        self.config = config
        self.judge = judge

    def run(self) -> dict:
        dataset = VRSBenchDataset(self.config.dataset_path, self.config.split, self.config.images_dir)
        records = dataset.load_records(self.config.max_samples)
        predictions: list[Prediction] = []
        is_mock = self.service.config.mode == "mock"

        for record in records:
            try:
                dataset.ensure_image_exists(record)
                result = self.service.answer(record.image_path, record.question, {"vrsbench_question_id": record.sample_id})
            except VRSBenchDatasetError as exc:
                result = None
                predictions.append(
                    Prediction(record.sample_id, record.image_id, record.question, record.ground_truth, None,
                               record.question_type, "error", str(exc))
                )
                continue

            prediction = result.answer if result and result.status in {"ready", "mock"} else None
            item = Prediction(
                record.sample_id,
                record.image_id,
                record.question,
                record.ground_truth,
                prediction,
                record.question_type,
                result.status if result else "error",
                result.error if result else "Unknown inference error.",
            )
            if not is_mock and prediction is not None and self.judge is not None:
                item.correct = self.judge.matches(record, prediction)
            predictions.append(item)

        report = self._build_report(predictions, is_mock)
        self._write_outputs(predictions, report)
        return report

    def _build_report(self, predictions: list[Prediction], is_mock: bool) -> dict:
        report = {
            "status": "MOCK" if is_mock else "complete",
            "model_name": self.service.config.model_name,
            "dataset_name": "VRSBench",
            "split": self.config.split,
            "evaluated_samples": len(predictions),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "configuration": {
                "dataset_path": str(self.config.dataset_path),
                "images_dir": str(self.config.images_dir) if self.config.images_dir else None,
                "max_samples": self.config.max_samples,
                "model_mode": self.service.config.mode,
                "judge_mode": self.config.judge_mode,
            },
            "metrics": {},
            "errors": sum(1 for item in predictions if item.inference_status == "error"),
        }
        if is_mock:
            report["warning"] = "MOCK evaluation: predictions and scores are not real VRSBench benchmark results."
        elif self.judge is None:
            report["status"] = "incomplete"
            report["warning"] = "No VRSBench judge was configured; no benchmark metric was computed."
        else:
            report["metrics"] = calculate_vrsbench_metrics(predictions, self.judge.name, self.judge.official)
        return report

    def _write_outputs(self, predictions: list[Prediction], report: dict) -> None:
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        (self.config.output_dir / "vrsbench_vqa_predictions.json").write_text(
            json.dumps([item.to_dict() for item in predictions], indent=2), encoding="utf-8"
        )
        (self.config.output_dir / "vrsbench_vqa_results.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )


def calculate_vrsbench_metrics(predictions: list[Prediction], metric_name: str, official: bool) -> dict:
    """Compute the overall and per-type accuracies reported by VRSBench."""

    judged = [item for item in predictions if item.correct is not None]
    if not judged:
        return {
            "name": metric_name,
            "official": official,
            "overall_accuracy_percent": None,
            "per_type_accuracy_percent": {},
            "macro_type_accuracy_percent": None,
            "missing_official_types": list(OFFICIAL_VQA_TYPES),
        }
    correct = sum(item.correct for item in judged)
    by_type: dict[str, list[bool]] = defaultdict(list)
    for item in judged:
        question_type = item.question_type.lower()
        if question_type in {"image", "rural or urban"}:
            question_type = "scene type"
        by_type[question_type].append(bool(item.correct))
    per_type = {key: round(sum(values) / len(values) * 100, 4) for key, values in sorted(by_type.items())}
    missing_official = [t for t in OFFICIAL_VQA_TYPES if t not in per_type]
    return {
        "name": metric_name,
        "official": official,
        "overall_accuracy_percent": round(correct / len(judged) * 100, 4),
        "per_type_accuracy_percent": per_type,
        "macro_type_accuracy_percent": round(sum(per_type.values()) / len(per_type), 4),
        "judged_samples": len(judged),
        "missing_official_types": missing_official,
    }


def _build_service(args: argparse.Namespace) -> PersonCVQAService:
    return PersonCVQAService(
        GeoChatConfig(
            mode="mock" if args.mock else "real",
            model_path=args.model_path,
            model_base=getattr(args, "model_base", None),
            geochat_repo_path=args.geochat_repo_path,
            device=args.device,
            load_4bit=args.load_4bit,
            load_8bit=args.load_8bit,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Person C VRSBench VQA evaluator")
    parser.add_argument("--dataset-path", type=Path, required=True, help="Manually extracted VRSBench release root")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--images-dir", type=Path, help="Override the default <dataset-path>/Images_val")
    parser.add_argument("--split", default="val", choices=("val", "eval", "evaluation"))
    parser.add_argument("--max-samples", type=int, help="Evaluate only the first N official annotation records")
    parser.add_argument("--mock", action="store_true", help="Run mock inference; outputs are explicitly non-benchmark")
    parser.add_argument("--model-path", type=Path, help="Existing local GeoChat checkpoint directory")
    parser.add_argument("--model-base", type=Path, help="Base model path when loading an unmerged LoRA adapter")
    parser.add_argument("--geochat-repo-path", type=Path, help="Existing checkout of official GeoChat")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--load-4bit", action="store_true")
    parser.add_argument("--load-8bit", action="store_true")
    parser.add_argument("--judge", default="official-gpt", choices=("official-gpt", "local-precheck"))
    parser.add_argument("--openai-model", default="gpt-4o-mini")
    args = parser.parse_args()
    if not args.mock and args.model_path is None:
        parser.error("Real evaluation requires --model-path. Use --mock for a CPU-only pipeline check.")

    try:
        judge: VQAJudge | None
        if args.mock:
            judge = None
        elif args.judge == "official-gpt":
            judge = OfficialVRSBenchGPTJudge(args.openai_model)
        else:
            judge = LocalPrecheckJudge()
        evaluator = VRSBenchEvaluator(
            _build_service(args),
            VRSBenchEvaluationConfig(args.dataset_path, args.output_dir, args.split, args.max_samples, args.images_dir, args.judge, args.openai_model),
            judge,
        )
        report = evaluator.run()
    except (VRSBenchDatasetError, ValueError, RuntimeError) as exc:
        parser.error(str(exc))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
