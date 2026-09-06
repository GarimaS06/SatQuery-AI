from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ml.person_c import CaptionResult, GeoChatConfig, PersonCCaptioningService
from ml.person_c.captioning import DEFAULT_CAPTION_PROMPT
from ml.person_c.geochat_adapter import GeoChatAdapter, GeoChatLoadError
from ml.person_c.image_processing import prepare_image


class PersonCCaptioningTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.service = PersonCCaptioningService(GeoChatConfig(mode="mock"))

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def png(self, name: str, size: tuple[int, int], mode: str = "RGB") -> Path:
        path = self.root / name
        color = (10, 20, 30, 100) if mode == "RGBA" else (10, 20, 30)
        Image.new(mode, size, color).save(path, "PNG")
        return path

    def test_valid_png_image_and_mock_captioning(self) -> None:
        result = self.service.caption(self.png("valid.png", (800, 600)), metadata={"request_id": "cap-1"})
        self.assertEqual(result.status, "mock")
        self.assertIsNotNone(result.caption)
        self.assertIn("MOCK TEST OUTPUT", result.caption)
        self.assertTrue(any("Mock mode" in warning for warning in result.warnings))
        self.assertEqual(result.metadata["request_id"], "cap-1")
        self.assertEqual(result.metadata["prompt"], DEFAULT_CAPTION_PROMPT)

    def test_generate_caption_alias(self) -> None:
        result = self.service.generate_caption(self.png("valid_alias.png", (400, 300)))
        self.assertEqual(result.status, "mock")
        self.assertIn("MOCK TEST OUTPUT", result.caption)

    def test_custom_prompt(self) -> None:
        custom = "[caption] Give a concise summary of the terrain."
        result = self.service.caption(self.png("custom.png", (400, 300)), prompt=custom)
        self.assertEqual(result.status, "mock")
        self.assertEqual(result.metadata["prompt"], custom)

    def test_invalid_prompt(self) -> None:
        self.assertEqual(self.service.caption(self.png("p1.png", (10, 10)), prompt="   ").status, "error")
        self.assertEqual(self.service.caption(self.png("p2.png", (10, 10)), prompt="x" * 1001).status, "error")

    def test_missing_image(self) -> None:
        result = self.service.caption(self.root / "missing.png")
        self.assertEqual(result.status, "error")
        self.assertIn("does not exist", result.error)

    def test_invalid_image(self) -> None:
        bad = self.root / "bad.png"
        bad.write_text("not a PNG", encoding="utf-8")
        result = self.service.caption(bad)
        self.assertEqual(result.status, "error")
        self.assertIn("Could not decode", result.error)

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

    def test_caption_result_structure(self) -> None:
        result = self.service.caption(self.png("structure.png", (10, 10)))
        self.assertIsInstance(result, CaptionResult)
        self.assertEqual(
            set(result.to_dict()),
            {"caption", "model_name", "status", "warnings", "error", "metadata"},
        )

    def test_model_loading_failure_is_structured(self) -> None:
        service = PersonCCaptioningService(GeoChatConfig(mode="real", model_path=self.root / "not-a-model"))
        result = service.caption(self.png("real.png", (10, 10)))
        self.assertEqual(result.status, "error")
        self.assertIn("existing local checkpoint", result.error)

    def test_mock_captioning_cli_is_cpu_safe(self) -> None:
        image = self.png("cli.png", (12, 12))
        repository_root = Path(__file__).resolve().parents[2]
        completed = subprocess.run(
            [
                sys.executable,
                "-m",
                "ml.person_c.captioning",
                "--mock",
                "--image",
                str(image),
            ],
            cwd=repository_root,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn('"status": "mock"', completed.stdout)
        self.assertIn('"caption": "MOCK TEST OUTPUT', completed.stdout)


if __name__ == "__main__":
    unittest.main()
