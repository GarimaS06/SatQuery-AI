import sys
import os
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
import torchvision.transforms.functional as TF
import matplotlib.pyplot as plt
from pathlib import Path
from person_b.output_schema import AnalysisResult

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHANGEFORMER_ROOT = Path(os.environ.get("CHANGEFORMER_ROOT", PROJECT_ROOT / "ChangeFormer")).resolve()
if str(CHANGEFORMER_ROOT) not in sys.path:
    sys.path.insert(0, str(CHANGEFORMER_ROOT))

import models
try:
    from models.ChangeFormer import ChangeFormerV6
except Exception:
    ChangeFormerV6 = None

Path("outputs").mkdir(exist_ok=True)

CHECKPOINT_PATH = (
    "checkpoints/ChangeFormer_LEVIR/"
    "CD_ChangeFormerV6_LEVIR_b16_lr0.0001_adamw_train_test_200_"
    "linear_ce_multi_train_True_multi_infer_False_shuffle_AB_False_embed_dim_256/"
    "best_ckpt.pt"
)


def run_changeformer(
    before: np.ndarray,
    after: np.ndarray,
    checkpoint_path: str = CHECKPOINT_PATH,
    pixel_size_m: float = None
) -> AnalysisResult:

    try:
        # 1. Validate shapes
        if before.shape != after.shape:
            return AnalysisResult(
                success=False,
                analysis_type="changeformer",
                result={}, evidence={}, output_files={},
                error="Before and after images must have the same shape."
            )

        # 2. Check checkpoint exists
        if not os.path.exists(checkpoint_path):
            return AnalysisResult(
                success=False,
                analysis_type="changeformer",
                result={}, evidence={}, output_files={},
                error=f"Checkpoint not found: {checkpoint_path}"
            )

        # 3. Set device
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # 4. Load model
        global ChangeFormerV6
        if ChangeFormerV6 is None:
            from models.ChangeFormer import ChangeFormerV6
        model = ChangeFormerV6(embed_dim=256)
        ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        model.load_state_dict(ckpt["model_G_state_dict"])
        model.eval()
        model.to(device)

        # 5. Preprocess — store original size, resize to 256x256
        orig_h, orig_w = before.shape[:2]

        def preprocess(img_array):
            pil = Image.fromarray((img_array * 255).astype(np.uint8))
            pil = pil.resize((256, 256), Image.BILINEAR)
            tensor = TF.to_tensor(pil)
            return tensor.unsqueeze(0).to(device)

        t1 = preprocess(before)
        t2 = preprocess(after)

        # 6. Run inference
        with torch.no_grad():
            output = model(t1, t2)

        pred = output[-1]
        mask_256 = torch.argmax(pred, dim=1).squeeze(0)

        # 7. Resize mask back to original dimensions
        mask_tensor = mask_256.float().unsqueeze(0).unsqueeze(0)
        mask_resized = F.interpolate(
            mask_tensor,
            size=(orig_h, orig_w),
            mode="nearest"
        )
        mask = mask_resized.squeeze().cpu().numpy().astype(np.uint8)

        # 8. Count changed pixels
        changed_pixels = int(mask.sum())
        total_pixels = mask.size
        changed_percentage = round((changed_pixels / total_pixels) * 100, 2)

        # 9. Calculate area
        if pixel_size_m is not None:
            pixel_area_km2 = (pixel_size_m ** 2) / 1_000_000
            changed_area_km2 = round(changed_pixels * pixel_area_km2, 4)
            area_note = f"{changed_area_km2} km2"
            area_warnings = []
        else:
            changed_area_km2 = None
            area_note = "Unavailable: no spatial resolution metadata provided."
            area_warnings = ["pixel_size_m not provided. Area calculation skipped."]

        # 10. Save visualization
        vis = (before * 255).astype(np.uint8).copy()
        vis[mask == 1] = [255, 0, 0]
        plt.figure(figsize=(8, 6))
        plt.imshow(vis)
        plt.title("ChangeFormer Change Detection — Changed Areas in Red")
        plt.axis("off")
        plt.savefig("outputs/changeformer_map.png", dpi=150, bbox_inches="tight")
        plt.close()

        # 11. Return result
        return AnalysisResult(
            success=True,
            analysis_type="changeformer",
            result={
                "changed_pixels": changed_pixels,
                "total_pixels": total_pixels,
                "changed_percentage": changed_percentage
            },
            evidence={
                "changed_area_km2": changed_area_km2,
                "area_note": area_note
            },
            output_files={"map": "outputs/changeformer_map.png"},
            metadata={
                "device": str(device),
                "checkpoint": checkpoint_path,
                "input_size_original": [orig_h, orig_w],
                "input_size_model": [256, 256]
            },
            warnings=area_warnings
        )

    except Exception as e:
        return AnalysisResult(
            success=False,
            analysis_type="changeformer",
            result={}, evidence={}, output_files={},
            error=f"ChangeFormer inference failed: {str(e)}"
        )

