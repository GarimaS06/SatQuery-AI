from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ml.person_c.training.config import LoRAConfig, TrainingConfig
from ml.person_c.training.train import prepare_dry_run
from ml.person_c.training.vrsbench import VRSBenchTrainingAdapter, VRSBenchTrainingError


class TrainingPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dataset = self.root / "VRSBench"
        images = self.dataset / "Images_train"
        images.mkdir(parents=True)
        Image.new("RGB", (24, 24), (1, 2, 3)).save(images / "sample.png")
        self.vqa = {
            "id": "Final_Data/v1.2",
            "image": "sample.png",
            "conversations": [
                {"from": "human", "value": "<image>\n[vqa] Is there water?"},
                {"from": "gpt", "value": "yes"},
            ],
        }
        self.caption = {
            "id": "Final_Data/v1.2", "image": "sample.png",
            "conversations": [{"from": "human", "value": "<image>\n[caption] Describe."}, {"from": "gpt", "value": "A scene."}],
        }
        (self.dataset / "VRSBench_train.json").write_text(json.dumps([self.caption, self.vqa]), encoding="utf-8")
        self.geo = self.root / "GeoChat"
        (self.geo / "geochat" / "train").mkdir(parents=True)
        (self.geo / "geochat" / "train" / "train_mem.py").write_text("# placeholder", encoding="utf-8")
        self.base = self.root / "geochat-7B"
        self.base.mkdir()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def config(self, **changes: object) -> TrainingConfig:
        values = dict(base_model_path=self.base, geochat_repo_path=self.geo, training_dataset_path=self.dataset,
                      output_dir=self.root / "outputs", max_samples=1)
        values.update(changes)
        return TrainingConfig(**values)

    def test_configuration_validation_and_lora(self) -> None:
        self.config().validate(require_local_assets=True)
        with self.assertRaises(ValueError):
            LoRAConfig(rank=0).validate()
        with self.assertRaises(ValueError):
            self.config(quantization="8bit").validate()

    def test_dataset_conversion_preserves_geochat_format(self) -> None:
        examples = VRSBenchTrainingAdapter(self.dataset).load_vqa_examples()
        self.assertEqual(len(examples), 1)
        record = examples[0].to_geochat_record()
        self.assertEqual(record["image"], "sample.png")
        self.assertIn("<image>\n[vqa]", record["conversations"][0]["value"])
        self.assertEqual(record["conversations"][1]["value"], "yes")

    def test_missing_dataset_and_malformed_record(self) -> None:
        with self.assertRaisesRegex(VRSBenchTrainingError, "Missing official"):
            VRSBenchTrainingAdapter(self.root / "missing").load_vqa_examples()
        (self.dataset / "VRSBench_train.json").write_text(json.dumps([{"image": "sample.png"}]), encoding="utf-8")
        with self.assertRaisesRegex(VRSBenchTrainingError, "requires image and conversations"):
            VRSBenchTrainingAdapter(self.dataset).load_vqa_examples()

    def test_max_samples_and_dry_run_output(self) -> None:
        report = prepare_dry_run(self.config())
        self.assertEqual(report["status"], "DRY_RUN")
        self.assertEqual(report["training_examples"], 1)
        self.assertTrue((self.root / "outputs" / "config.json").is_file())
        self.assertTrue((self.root / "outputs" / "prepared_vrsbench_vqa.json").is_file())
        self.assertTrue((self.root / "outputs" / "adapter").is_dir())
        self.assertIn("--lora_enable", report["future_training_command"])
        self.assertNotIn("training_metrics.json", [path.name for path in (self.root / "outputs").iterdir()])

    def test_missing_training_image(self) -> None:
        (self.dataset / "Images_train" / "sample.png").unlink()
        with self.assertRaisesRegex(VRSBenchTrainingError, "Missing training image"):
            VRSBenchTrainingAdapter(self.dataset).load_vqa_examples()

    def test_configurable_deepspeed_path(self) -> None:
        custom_ds = self.root / "custom_zero3.json"
        custom_ds.write_text("{}", encoding="utf-8")
        report = prepare_dry_run(self.config(deepspeed_config=str(custom_ds)))
        self.assertIn(str(custom_ds), report["future_training_command"])


if __name__ == "__main__":
    unittest.main()
