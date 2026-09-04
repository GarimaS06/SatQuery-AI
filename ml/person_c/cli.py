"""CPU-safe command-line entry point for Person C mock VQA."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .service import PersonCVQAService
from .types import GeoChatConfig


def main() -> int:
    parser = argparse.ArgumentParser(description="Person C remote-sensing VQA boundary")
    parser.add_argument("--image", required=True, help="Path to a PNG image")
    parser.add_argument("--question", required=True, help="Natural-language question")
    parser.add_argument("--mock", action="store_true", help="Use CPU-safe mock inference (recommended for now)")
    parser.add_argument("--model-path", type=Path, help="Existing local GeoChat checkpoint directory")
    parser.add_argument("--model-base", type=Path, help="Base model path when loading an unmerged LoRA adapter")
    parser.add_argument("--geochat-repo-path", type=Path, help="Existing checkout of official GeoChat code")
    parser.add_argument("--load-4bit", action="store_true", help="Request official GeoChat 4-bit loading in real mode")
    parser.add_argument("--load-8bit", action="store_true", help="Request official GeoChat 8-bit loading in real mode")
    parser.add_argument("--device", default="cuda", help="CUDA device for real mode (default: cuda)")
    args = parser.parse_args()

    if not args.mock and args.model_path is None:
        parser.error("Real mode requires --model-path. Use --mock to avoid loading weights.")

    config = GeoChatConfig(
        mode="mock" if args.mock else "real",
        model_path=args.model_path,
        model_base=args.model_base,
        geochat_repo_path=args.geochat_repo_path,
        load_4bit=args.load_4bit,
        load_8bit=args.load_8bit,
        device=args.device,
    )
    result = PersonCVQAService(config).answer(args.image, args.question)
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.status != "error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
