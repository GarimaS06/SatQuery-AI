from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
import subprocess
import sys

from PIL import Image

from ml.person_c import GeoChatConfig, PersonCVQAService
from ml.person_c.geochat_adapter import GeoChatAdapter, GeoChatLoadError
from ml.person_c.image_processing import prepare_image


class PersonCVQATests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.service = PersonCVQAService(GeoChatConfig(mode="mock"))

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def png(self, name: str, size: tuple[int, int], mode: str = "RGB") -> Path:
        path = self.root / name
        color = (10, 20, 30, 100) if mode == "RGBA" else (10, 20, 30)
        Image.new(mode, size, color).save(path, "PNG")
        return path

    def test_valid_png_image_and_mock_inference(self) -> None:
        result = self.service.answer(self.png("valid.png", (800, 600)), "Is there water?", {"request_id": "x"})
        self.assertEqual(result.status, "mock")
        self.assertIn("MOCK TEST OUTPUT", result.answer)
        self.assertTrue(any("Mock mode" in warning for warning in result.warnings))
        self.assertEqual(result.metadata["request_id"], "x")

    def test_missing_image(self) -> None:
        result = self.service.answer(self.root / "missing.png", "What is visible?")
        self.assertEqual(result.status, "error")
        self.assertIn("does not exist", result.error)

    def test_invalid_image(self) -> None:
        bad = self.root / "bad.png"
        bad.write_text("not a PNG", encoding="utf-8")
        result = self.service.answer(bad, "What is visible?")
        self.assertEqual(result.status, "error")
        self.assertIn("Could not decode", result.error)

    def test_question_validation(self) -> None:
        self.assertEqual(self.service.answer(self.png("q.png", (10, 10)), "   ").status, "error")
        self.assertEqual(self.service.answer(self.png("q2.png", (10, 10)), "x" * 1001).status, "error")

    def test_small_image_is_not_enlarged(self) -> None:
        prepared = prepare_image(self.png("small.png", (200, 150)))
        self.assertEqual((prepared.width, prepared.height), (200, 150))
        self.assertFalse(prepared.was_resized)

    def test_oversized_image_is_downscaled_with_aspect_ratio(self) -> None:
        prepared = prepare_image(self.png("large.png", (4096, 1024)))
        self.assertEqual((prepared.width, prepared.height), (2048, 512))
        self.assertTrue(prepared.was_resized)

    def test_rgb_conversion(self) -> None:
        prepared = prepare_image(self.png("rgba.png", (100, 100), mode="RGBA"))
        self.assertEqual(prepared.image.mode, "RGB")
        self.assertTrue(prepared.converted_to_rgb)

    def test_model_loading_failure_is_structured(self) -> None:
        service = PersonCVQAService(GeoChatConfig(mode="real", model_path=self.root / "not-a-model"))
        result = service.answer(self.png("real.png", (10, 10)), "What is here?")
        self.assertEqual(result.status, "error")
        self.assertIn("existing local checkpoint", result.error)

    def test_conservative_geochat_vram_thresholds(self) -> None:
        self.assertEqual(GeoChatAdapter(GeoChatConfig(mode="real", load_4bit=True)).required_cuda_vram_gib(), 12)
        self.assertEqual(GeoChatAdapter(GeoChatConfig(mode="real", load_8bit=True)).required_cuda_vram_gib(), 12)
        self.assertEqual(GeoChatAdapter(GeoChatConfig(mode="real")).required_cuda_vram_gib(), 20)
        with self.assertRaises(GeoChatLoadError):
            GeoChatAdapter(GeoChatConfig(mode="real", load_4bit=True, load_8bit=True)).required_cuda_vram_gib()

    def test_output_structure(self) -> None:
        result = self.service.answer(self.png("output.png", (10, 10)), "What is here?")
        self.assertEqual(
            set(result.to_dict()), {"answer", "model_name", "status", "warnings", "error", "metadata"}
        )

    def test_mock_cli_is_cpu_safe(self) -> None:
        image = self.png("cli.png", (12, 12))
        repository_root = Path(__file__).resolve().parents[2]
        completed = subprocess.run(
            [
                sys.executable,
                "-m",
                "ml.person_c.cli",
                "--mock",
                "--image",
                str(image),
                "--question",
                "Is this a valid image?",
            ],
            cwd=repository_root,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn('"status": "mock"', completed.stdout)

    def test_cli_accepts_model_base_argument(self) -> None:
        image = self.png("cli_mb.png", (12, 12))
        repository_root = Path(__file__).resolve().parents[2]
        completed = subprocess.run(
            [
                sys.executable,
                "-m",
                "ml.person_c.cli",
                "--mock",
                "--image",
                str(image),
                "--question",
                "Is this a valid image?",
                "--model-base",
                str(self.root / "base_model"),
            ],
            cwd=repository_root,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn('"status": "mock"', completed.stdout)


if __name__ == "__main__":
    unittest.main()
