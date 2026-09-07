"""Tests for MoondreamAdapter, MoondreamConfig, and PERSON_C_BACKEND routing.

All tests are mock/stub — no model download or GPU required.
The adapter is never actually loaded; we patch the relevant import paths.
"""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from ml.person_c.moondream_adapter import (
    MOONDREAM_HF_REPO,
    MOONDREAM_REVISION,
    MoondreamAdapter,
    MoondreamLoadError,
)
from ml.person_c.vqa_types import GeoChatConfig, MoondreamConfig


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_pil_image():
    """Return a minimal valid PIL.Image."""
    from PIL import Image
    return Image.new("RGB", (32, 32), color=(128, 128, 128))


def _stubbed_adapter(model_path: Path | None = None, device: str = "cpu") -> MoondreamAdapter:
    """Return an adapter with model/tokenizer stubs already injected."""
    adapter = MoondreamAdapter(model_path=model_path, device=device)
    adapter.model = MagicMock()
    adapter.tokenizer = MagicMock()
    adapter._device = device
    return adapter


# ── MoondreamAdapter unit tests ───────────────────────────────────────────────

class TestMoondreamAdapterConstants(unittest.TestCase):
    def test_pinned_revision_is_defined(self):
        self.assertEqual(MOONDREAM_REVISION, "2025-06-21")

    def test_hf_repo_is_correct(self):
        self.assertEqual(MOONDREAM_HF_REPO, "vikhyatk/moondream2")


class TestMoondreamAdapterNotLoaded(unittest.TestCase):
    def test_loaded_is_false_before_load(self):
        adapter = MoondreamAdapter()
        self.assertFalse(adapter.loaded)

    def test_answer_raises_if_not_loaded(self):
        adapter = MoondreamAdapter()
        img = _make_pil_image()
        with self.assertRaises(MoondreamLoadError):
            adapter.answer(img, "What is this?")

    def test_caption_raises_if_not_loaded(self):
        adapter = MoondreamAdapter()
        img = _make_pil_image()
        with self.assertRaises(MoondreamLoadError):
            adapter.caption(img)


class TestMoondreamAdapterLoadErrors(unittest.TestCase):
    def test_load_raises_when_model_path_none(self):
        """No model_path → MoondreamLoadError with setup instructions."""
        adapter = MoondreamAdapter(model_path=None, device="cpu")
        with self.assertRaises(MoondreamLoadError) as ctx:
            adapter.load()
        self.assertIn("snapshot_download", str(ctx.exception))

    def test_load_raises_when_model_path_not_exist(self):
        """Non-existent model_path → MoondreamLoadError."""
        adapter = MoondreamAdapter(model_path=Path("/nonexistent/path/moondream2"), device="cpu")
        with self.assertRaises(MoondreamLoadError) as ctx:
            adapter.load()
        self.assertIn("does not exist", str(ctx.exception))

    def test_load_raises_when_transformers_missing(self, tmp_path=None):
        """If transformers is not installed → MoondreamLoadError."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            adapter = MoondreamAdapter(model_path=Path(tmp), device="cpu")
            with patch.dict("sys.modules", {"transformers": None}):
                with self.assertRaises((MoondreamLoadError, ImportError)):
                    adapter.load()


class TestMoondreamAdapterInference(unittest.TestCase):
    """Stub-based inference tests — no real model loaded."""

    def test_answer_calls_encode_and_answer_question(self):
        img = _make_pil_image()
        adapter = _stubbed_adapter(device="cpu")
        adapter.model.encode_image.return_value = MagicMock()
        adapter.model.answer_question.return_value = "A field."
        result = adapter.answer(img, "What is this?")
        self.assertEqual(result, "A field.")
        adapter.model.encode_image.assert_called_once_with(img)

    def test_caption_calls_model_caption(self):
        img = _make_pil_image()
        adapter = _stubbed_adapter(device="cpu")
        adapter.model.caption.return_value = {"caption": "A green field."}
        result = adapter.caption(img)
        self.assertEqual(result, "A green field.")
        adapter.model.caption.assert_called_once_with(img, length="normal")

    def test_caption_length_forwarded(self):
        img = _make_pil_image()
        adapter = _stubbed_adapter(device="cpu")
        adapter.model.caption.return_value = {"caption": "Short."}
        adapter.caption(img, length="short")
        adapter.model.caption.assert_called_once_with(img, length="short")

    def test_answer_runtime_error_wraps_as_load_error(self):
        img = _make_pil_image()
        adapter = _stubbed_adapter(device="cpu")
        adapter.model.encode_image.side_effect = RuntimeError("generic error")
        with self.assertRaises(MoondreamLoadError):
            adapter.answer(img, "What is this?")

    def test_loaded_is_true_after_stub_injection(self):
        adapter = _stubbed_adapter()
        self.assertTrue(adapter.loaded)


# ── MoondreamConfig tests ─────────────────────────────────────────────────────

class TestMoondreamConfig(unittest.TestCase):
    def test_default_device_is_auto(self):
        cfg = MoondreamConfig()
        self.assertEqual(cfg.device, "auto")

    def test_default_model_path_is_none(self):
        cfg = MoondreamConfig()
        self.assertIsNone(cfg.model_path)

    def test_default_caption_length_is_normal(self):
        cfg = MoondreamConfig()
        self.assertEqual(cfg.caption_length, "normal")

    def test_frozen(self):
        cfg = MoondreamConfig()
        with self.assertRaises((AttributeError, TypeError)):
            cfg.device = "cuda"  # type: ignore[misc]


# ── PERSON_C_BACKEND routing tests ────────────────────────────────────────────

class TestPersonCBackendRouting(unittest.TestCase):
    """Test that PERSON_C_BACKEND drives the right adapter selection."""

    def _make_vqa_service(self, backend_env: str | None):
        from ml.person_c.service import PersonCVQAService
        env = {"PERSON_C_BACKEND": backend_env} if backend_env is not None else {}
        with patch.dict(os.environ, env, clear=False):
            # Use explicit backend kwarg to avoid env leaking from outer test env.
            svc = PersonCVQAService(backend=backend_env or "moondream2")
        return svc

    def test_backend_mock_sets_adapter_none(self):
        from ml.person_c.service import PersonCVQAService
        svc = PersonCVQAService(backend="mock")
        self.assertEqual(svc._backend, "mock")
        self.assertIsNone(svc._adapter)

    def test_backend_moondream2_creates_moondream_adapter(self):
        from ml.person_c.service import PersonCVQAService
        svc = PersonCVQAService(backend="moondream2")
        self.assertEqual(svc._backend, "moondream2")
        self.assertIsInstance(svc._adapter, MoondreamAdapter)

    def test_backend_geochat_config_is_respected(self):
        from ml.person_c.service import PersonCVQAService
        from ml.person_c.geochat_adapter import GeoChatAdapter
        cfg = GeoChatConfig(mode="real", model_path=Path("/fake/geochat"))
        svc = PersonCVQAService(config=cfg)
        self.assertEqual(svc._backend, "geochat")
        self.assertIsInstance(svc._adapter, GeoChatAdapter)

    def test_backend_moondream_config_is_respected(self):
        from ml.person_c.service import PersonCVQAService
        cfg = MoondreamConfig(model_path=Path("/fake/moondream"))
        svc = PersonCVQAService(config=cfg)
        self.assertEqual(svc._backend, "moondream2")
        self.assertIsInstance(svc._adapter, MoondreamAdapter)

    def test_invalid_backend_env_falls_back_to_moondream2(self):
        from ml.person_c.service import _get_backend
        with patch.dict(os.environ, {"PERSON_C_BACKEND": "invalid_value"}):
            self.assertEqual(_get_backend(), "moondream2")

    def test_default_backend_env_is_moondream2(self):
        from ml.person_c.service import _get_backend
        env_without_backend = {k: v for k, v in os.environ.items() if k != "PERSON_C_BACKEND"}
        with patch.dict(os.environ, env_without_backend, clear=True):
            self.assertEqual(_get_backend(), "moondream2")

    def test_mock_backend_vqa_returns_mock_status(self):
        """End-to-end: mock backend returns VQAResult(status='mock')."""
        import tempfile
        from PIL import Image
        from ml.person_c.service import PersonCVQAService
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            img = Image.new("RGB", (64, 64))
            img.save(f.name)
            tmp_path = f.name
        svc = PersonCVQAService(backend="mock")
        result = svc.answer(tmp_path, "What is this?")
        self.assertEqual(result.status, "mock")
        os.unlink(tmp_path)

    def test_moondream2_backend_load_error_returns_error_result(self):
        """Moondream2 backend with no model_path → error result, no crash."""
        import tempfile
        from PIL import Image
        from ml.person_c.service import PersonCVQAService
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            img = Image.new("RGB", (64, 64))
            img.save(f.name)
            tmp_path = f.name
        # MoondreamConfig with model_path=None → MoondreamLoadError → error result
        cfg = MoondreamConfig(model_path=None)
        svc = PersonCVQAService(config=cfg)
        result = svc.answer(tmp_path, "What is shown?")
        self.assertEqual(result.status, "error")
        self.assertIsNotNone(result.error)
        self.assertIn("snapshot_download", result.error)
        os.unlink(tmp_path)


# ── Captioning backend routing tests ─────────────────────────────────────────

class TestCaptioningBackendRouting(unittest.TestCase):
    def test_captioning_mock_backend(self):
        import tempfile
        from PIL import Image
        from ml.person_c.captioning import PersonCCaptioningService
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            img = Image.new("RGB", (64, 64))
            img.save(f.name)
            tmp_path = f.name
        svc = PersonCCaptioningService(backend="mock")
        result = svc.caption(tmp_path)
        self.assertEqual(result.status, "mock")
        os.unlink(tmp_path)

    def test_captioning_moondream2_no_weights_returns_error(self):
        import tempfile
        from PIL import Image
        from ml.person_c.captioning import PersonCCaptioningService
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            img = Image.new("RGB", (64, 64))
            img.save(f.name)
            tmp_path = f.name
        cfg = MoondreamConfig(model_path=None)
        svc = PersonCCaptioningService(config=cfg)
        result = svc.caption(tmp_path)
        self.assertEqual(result.status, "error")
        self.assertIn("snapshot_download", result.error)
        os.unlink(tmp_path)

    def test_captioning_moondream2_backend_selection(self):
        from ml.person_c.captioning import PersonCCaptioningService
        svc = PersonCCaptioningService(backend="moondream2")
        self.assertEqual(svc._backend, "moondream2")
        self.assertIsInstance(svc._adapter, MoondreamAdapter)

    def test_vqa_uses_person_c_model_path_env_var(self):
        from ml.person_c.service import PersonCVQAService
        fake_path = "/fake/weights/moondream2"
        with patch.dict(os.environ, {"PERSON_C_BACKEND": "moondream2", "PERSON_C_MODEL_PATH": fake_path}):
            svc = PersonCVQAService()
            self.assertEqual(svc._backend, "moondream2")
            self.assertIsInstance(svc._adapter, MoondreamAdapter)
            self.assertEqual(svc._adapter.model_path, Path(fake_path))

    def test_captioning_uses_person_c_model_path_env_var(self):
        from ml.person_c.captioning import PersonCCaptioningService
        fake_path = "/fake/weights/moondream2"
        with patch.dict(os.environ, {"PERSON_C_BACKEND": "moondream2", "PERSON_C_MODEL_PATH": fake_path}):
            svc = PersonCCaptioningService()
            self.assertEqual(svc._backend, "moondream2")
            self.assertIsInstance(svc._adapter, MoondreamAdapter)
            self.assertEqual(svc._adapter.model_path, Path(fake_path))

    def test_vqa_prefers_explicit_config_over_env_var(self):
        from ml.person_c.service import PersonCVQAService
        fake_env_path = "/fake/env/weights"
        explicit_path = Path("/explicit/weights")
        with patch.dict(os.environ, {"PERSON_C_BACKEND": "moondream2", "PERSON_C_MODEL_PATH": fake_env_path}):
            cfg = MoondreamConfig(model_path=explicit_path)
            svc = PersonCVQAService(config=cfg)
            self.assertEqual(svc._adapter.model_path, explicit_path)


if __name__ == "__main__":
    unittest.main()
