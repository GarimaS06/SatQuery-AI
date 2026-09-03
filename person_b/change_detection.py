import numpy as np
import cv2
import scipy.ndimage
import matplotlib.pyplot as plt
from pathlib import Path

from person_b.output_schema import AnalysisResult

Path("outputs").mkdir(exist_ok=True)


def detect_changes(before: np.ndarray, after: np.ndarray,
                   pixel_size_m: float = None) -> AnalysisResult:
    """Detect changes between two HxWx3 images using pixel differencing and morphology."""
    try:
        # 1. Validate input shapes
        if before.shape != after.shape:
            return AnalysisResult(
                success=False,
                analysis_type="change_detection",
                result={},
                evidence={},
                output_files={},
                error="Before and after images must have the same shape."
            )

        # 2. Convert both to grayscale by averaging across colour channels
        before_gray = before.mean(axis=2)
        after_gray = after.mean(axis=2)

        # 3. Compute absolute pixel difference
        diff = np.abs(before_gray - after_gray)

        # 4. Threshold at 0.15
        binary_mask = (diff > 0.15).astype(np.uint8)

        # 5. Morphological cleanup using scipy.ndimage
        cleaned = scipy.ndimage.binary_opening(binary_mask, iterations=2)
        cleaned = scipy.ndimage.binary_closing(cleaned, iterations=3)
        cleaned = cleaned.astype(np.uint8)

        # 6. Count changed pixels
        changed_pixels = int(cleaned.sum())
        total_pixels = before_gray.size
        changed_percentage = round((changed_pixels / total_pixels) * 100, 2)

        # 7. Calculate area
        if pixel_size_m is not None:
            pixel_area_km2 = (pixel_size_m ** 2) / 1_000_000
            changed_area_km2 = round(changed_pixels * pixel_area_km2, 4)
            area_note = f"{changed_area_km2} km2"
        else:
            changed_area_km2 = None
            area_note = "Unavailable: no spatial resolution metadata provided."

        warnings = (
            ["pixel_size_m not provided. Area calculation skipped."]
            if pixel_size_m is None
            else []
        )

        # 8. Create and save change map visualization
        vis = (before * 255).astype(np.uint8).copy()
        vis[cleaned == 1] = [255, 0, 0]

        plt.figure(figsize=(8, 6))
        plt.imshow(vis)
        plt.title("Change Detection Map — Changed Areas in Red")
        plt.axis("off")
        plt.savefig("outputs/change_map.png", dpi=150, bbox_inches="tight")
        plt.close()

        # 9. Return structured result
        return AnalysisResult(
            success=True,
            analysis_type="change_detection",
            result={
                "changed_pixels": changed_pixels,
                "total_pixels": total_pixels,
                "changed_percentage": changed_percentage
            },
            evidence={
                "changed_area_km2": changed_area_km2,
                "area_note": area_note
            },
            output_files={"map": "outputs/change_map.png"},
            warnings=warnings
        )

    except Exception as e:
        return AnalysisResult(
            success=False,
            analysis_type="change_detection",
            result={},
            evidence={},
            output_files={},
            error=f"Change detection failed: {str(e)}"
        )

