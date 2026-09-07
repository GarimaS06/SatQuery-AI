"""Command-line entry point for Person C VQA.

Backend selection is via the PERSON_C_BACKEND environment variable or
the --backend argument.  See docs/person_c.md for details.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .service import PersonCVQAService, _get_backend, _VALID_BACKENDS
from .vqa_types import GeoChatConfig, MoondreamConfig

_DEFAULT_BACKEND = "moondream2"


def main() -> int:
    parser = argparse.ArgumentParser(description="Person C remote-sensing VQA boundary")
    parser.add_argument("--image", required=True, help="Path to a PNG image")
    parser.add_argument("--question", required=True, help="Natural-language question")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use CPU-safe mock inference (overrides PERSON_C_BACKEND)",
    )
    parser.add_argument(
        "--backend",
        choices=["mock", "moondream2", "geochat"],
        default=None,
        help="Explicit backend override (default: PERSON_C_BACKEND env var, then moondream2)",
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        help="Local model checkpoint directory (GeoChat or Moondream2 weights)",
    )
    parser.add_argument(
        "--model-base",
        type=Path,
        help="Base model path when loading an unmerged LoRA adapter (GeoChat only)",
    )
    parser.add_argument(
        "--geochat-repo-path",
        type=Path,
        help="Existing checkout of official GeoChat code (GeoChat only)",
    )
    parser.add_argument(
        "--load-4bit",
        action="store_true",
        help="4-bit loading (GeoChat real mode only)",
    )
    parser.add_argument(
        "--load-8bit",
        action="store_true",
        help="8-bit loading (GeoChat real mode only)",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Device for real mode: cuda | cpu | auto (default: auto)",
    )
    args = parser.parse_args()

    # Resolve effective backend.
    effective_backend = "mock" if args.mock else (args.backend or _get_backend())

    config: GeoChatConfig | MoondreamConfig
    if effective_backend == "geochat":
        if args.model_path is None:
            parser.error("GeoChat real mode requires --model-path.")
        config = GeoChatConfig(
            mode="real",
            model_path=args.model_path,
            model_base=args.model_base,
            geochat_repo_path=args.geochat_repo_path,
            load_4bit=args.load_4bit,
            load_8bit=args.load_8bit,
            device=args.device if args.device != "auto" else "cuda",
        )
    elif effective_backend == "moondream2":
        model_path = args.model_path
        if model_path is None:
            env_path = os.getenv("PERSON_C_MODEL_PATH")
            if env_path:
                model_path = Path(env_path)
        if model_path is None:
            parser.error(
                "Moondream2 real mode requires --model-path pointing to the downloaded weights.\n"
                "Download once with:\n"
                "  python -c \"from huggingface_hub import snapshot_download; "
                "snapshot_download('vikhyatk/moondream2', revision='2025-06-21', "
                "local_dir='weights/moondream2')\""
            )
        config = MoondreamConfig(model_path=model_path, device=args.device)
    else:
        config = GeoChatConfig(mode="mock")

    result = PersonCVQAService(config).answer(args.image, args.question)
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.status != "error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
