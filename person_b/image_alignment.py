import numpy as np
import cv2
from skimage.metrics import structural_similarity


def align_images(before: np.ndarray, after: np.ndarray) -> dict:
    """Align two HxWx3 images using ECC registration if SSIM < 0.70."""
    ssim_before = 0.0
    try:
        # 1. Convert to uint8 for OpenCV compatibility
        before_u8 = (before * 255).astype(np.uint8)
        after_u8 = (after * 255).astype(np.uint8)

        # 2. Convert to grayscale
        gray_before = cv2.cvtColor(before_u8, cv2.COLOR_RGB2GRAY)
        gray_after = cv2.cvtColor(after_u8, cv2.COLOR_RGB2GRAY)

        # 3. Compute SSIM between the two grayscale images
        ssim_before_val, _ = structural_similarity(gray_before, gray_after, full=True)
        ssim_before = float(ssim_before_val)

        # 4. Check if alignment is already sufficient
        if ssim_before >= 0.70:
            return {
                "aligned_after": after,
                "ssim_before": ssim_before,
                "ssim_after": ssim_before,
                "registration_applied": False,
                "alignment_quality": "good",
                "warning": "",
            }

        # 5. Attempt ECC registration
        try:
            # a. Create warp matrix
            warp_matrix = np.eye(2, 3, dtype=np.float32)

            # b. Set termination criteria
            criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-7)

            # c. Run ECC
            _, warp_matrix = cv2.findTransformECC(
                gray_before, gray_after,
                warp_matrix, cv2.MOTION_TRANSLATION, criteria
            )

            # d. Apply warp
            h, w = before_u8.shape[:2]
            aligned_u8 = cv2.warpAffine(
                after_u8, warp_matrix, (w, h),
                flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP
            )

            # e. Convert back to float32
            aligned_after = aligned_u8.astype(np.float32) / 255.0

            # f. Recompute SSIM
            gray_aligned = cv2.cvtColor(aligned_u8, cv2.COLOR_RGB2GRAY)
            ssim_after_val, _ = structural_similarity(gray_before, gray_aligned, full=True)
            ssim_after = float(ssim_after_val)

            # 6. Decide alignment_quality from ssim_after
            if ssim_after >= 0.70:
                alignment_quality = "good"
                warning = ""
            elif ssim_after >= 0.40:
                alignment_quality = "acceptable"
                warning = "Partial alignment. Results may have minor noise."
            else:
                alignment_quality = "poor"
                warning = "Images poorly aligned. Change detection may be unreliable."

            # 7. Return result
            return {
                "aligned_after": aligned_after,
                "ssim_before": ssim_before,
                "ssim_after": ssim_after,
                "registration_applied": True,
                "alignment_quality": alignment_quality,
                "warning": warning,
            }

        except Exception:
            return {
                "aligned_after": after,
                "ssim_before": ssim_before,
                "ssim_after": ssim_before,
                "registration_applied": False,
                "alignment_quality": "unknown",
                "warning": "Automatic registration failed. Using original image.",
            }

    except Exception:
        return {
            "aligned_after": after,
            "ssim_before": ssim_before,
            "ssim_after": ssim_before,
            "registration_applied": False,
            "alignment_quality": "unknown",
            "warning": "Automatic registration failed. Using original image.",
        }

