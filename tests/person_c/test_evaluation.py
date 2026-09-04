from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ml.person_c import GeoChatConfig, PersonCVQAService
from ml.person_c.data.vrsbench import VRSBenchDataset, VRSBenchDatasetError
from ml.person_c.evaluation import Prediction, VRSBenchEvaluationConfig, VRSBenchEvaluator, calculate_vrsbench_metrics


class VRSBenchEvaluationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "VRSBench"
        self.images = self.root / "Images_val"
        self.images.mkdir(parents=True)
        Image.new("RGB", (32, 24), (10, 20, 30)).save(self.images / "sample.png", "PNG")
        self.records = [
            {
                "image_id": "sample.png",
                "question": "Is there water?",
                "ground_truth": "yes",
                "dataset": "RSBench",
                "question_id": 7,
                "type": "object existence",
            },
            {
                "image_id": "sample.png",
                "question": "How many vehicles are there?",
                "ground_truth": "2",
                "dataset": "RSBench",
                "question_id": 8,
                "type": "object quantity",
            },
        ]
        (self.root / "VRSBench_EVAL_vqa.json").write_text(json.dumps(self.records), encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_dataset_record_parsing_and_max_samples(self) -> None:
        dataset = VRSBenchDataset(self.root)
        records = dataset.load_records(max_samples=1)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].sample_id, 7)
        self.assertEqual(records[0].image_id, "sample.png")
        self.assertEqual(records[0].ground_truth, "yes")

    def test_malformed_annotation_is_rejected(self) -> None:
        (self.root / "VRSBench_EVAL_vqa.json").write_text(json.dumps([{"image_id": "sample.png"}]), encoding="utf-8")
        with self.assertRaisesRegex(VRSBenchDatasetError, "missing required"):
            VRSBenchDataset(self.root).load_records()

    def test_missing_annotation_and_image_handling(self) -> None:
        missing_root = self.root.parent / "missing"
        with self.assertRaisesRegex(VRSBenchDatasetError, "Missing official"):
            VRSBenchDataset(missing_root).load_records()
        records = VRSBenchDataset(self.root).load_records()
        (self.images / "sample.png").unlink()
        with self.assertRaisesRegex(VRSBenchDatasetError, "Missing VRSBench image"):
            VRSBenchDataset.ensure_image_exists(records[0])

    def test_metric_calculation_on_synthetic_predictions(self) -> None:
        predictions = [
            Prediction(1, "a.png", "q", "yes", "yes", "object existence", "ready", correct=True),
            Prediction(2, "b.png", "q", "2", "3", "object quantity", "ready", correct=False),
            Prediction(3, "c.png", "q", "yes", "yes", "object existence", "ready", correct=True),
        ]
        metrics = calculate_vrsbench_metrics(predictions, "synthetic", False)
        self.assertEqual(metrics["overall_accuracy_percent"], 66.6667)
        self.assertEqual(metrics["per_type_accuracy_percent"]["object existence"], 100.0)
        self.assertEqual(metrics["per_type_accuracy_percent"]["object quantity"], 0.0)
        self.assertIn("object color", metrics["missing_official_types"])
        self.assertNotIn("object existence", metrics["missing_official_types"])
        self.assertNotIn("object quantity", metrics["missing_official_types"])

    def test_mock_evaluation_and_output_generation(self) -> None:
        output_dir = self.root.parent / "outputs"
        evaluator = VRSBenchEvaluator(
            PersonCVQAService(GeoChatConfig(mode="mock")),
            VRSBenchEvaluationConfig(self.root, output_dir, max_samples=1),
        )
        report = evaluator.run()
        self.assertEqual(report["status"], "MOCK")
        self.assertEqual(report["evaluated_samples"], 1)
        self.assertEqual(report["metrics"], {})
        self.assertTrue((output_dir / "vrsbench_vqa_predictions.json").is_file())
        self.assertTrue((output_dir / "vrsbench_vqa_results.json").is_file())
        saved_predictions = json.loads((output_dir / "vrsbench_vqa_predictions.json").read_text(encoding="utf-8"))
        self.assertEqual(saved_predictions[0]["sample_id"], 7)
        self.assertIn("MOCK TEST OUTPUT", saved_predictions[0]["prediction"])

    def test_evaluation_records_missing_image_as_error(self) -> None:
        (self.images / "sample.png").unlink()
        output_dir = self.root.parent / "missing-image-output"
        report = VRSBenchEvaluator(
            PersonCVQAService(GeoChatConfig(mode="mock")),
            VRSBenchEvaluationConfig(self.root, output_dir),
        ).run()
        self.assertEqual(report["errors"], 2)

    def test_mock_evaluation_cli(self) -> None:
        output_dir = self.root.parent / "cli-output"
        repository_root = Path(__file__).resolve().parents[2]
        completed = subprocess.run(
            [
                sys.executable,
                "-m",
                "ml.person_c.evaluation",
                "--mock",
                "--dataset-path",
                str(self.root),
                "--output-dir",
                str(output_dir),
                "--max-samples",
                "1",
            ],
            cwd=repository_root,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn('"status": "MOCK"', completed.stdout)


if __name__ == "__main__":
    unittest.main()
