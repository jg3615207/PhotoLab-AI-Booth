import random
import json
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, ImageFilter

# ── Colour / Tone & Beauty Presets ───────────────────────────────────
FILTER_PRESETS = [
    {"id": "none", "name": "Original", "name_zh": "原圖原色", "description": "No color filter applied"},
    {"id": "bw", "name": "Black & White", "name_zh": "黑白經典", "description": "Classic monochrome black & white"},
    {"id": "sepia", "name": "Sepia", "name_zh": "復古懷舊", "description": "Warm retro sepia tone"},
    {"id": "vintage", "name": "Vintage", "name_zh": "膠片底片", "description": "Faded film vintage aesthetic"},
    {"id": "vivid", "name": "Vivid", "name_zh": "鮮艷色彩", "description": "Boosted colors and contrast"},
    {"id": "warm", "name": "Warm Glow", "name_zh": "暖陽柔光", "description": "Warm golden hour tone"},
    {"id": "cool", "name": "Cool Tone", "name_zh": "冷調沉穩", "description": "Cool cinematic blue tone"},
    {"id": "high-contrast", "name": "High Contrast", "name_zh": "高對比", "description": "Dramatic high contrast"},
    {"id": "film-grain", "name": "Film Grain", "name_zh": "顆粒底片", "description": "Analog film with subtle texture"},

    # ── Non-AI Algorithmic Beauty Mode Presets ───────────────────────
    {"id": "beauty-soft", "name": "✨ Soft Skin", "name_zh": "✨ 柔膚自然", "description": "Subtle skin smoothing, natural look"},
    {"id": "beauty-glow", "name": "✨ Dreamy Glow", "name_zh": "✨ 夢幻柔光", "description": "Soft-focus portrait glow effect"},
    {"id": "beauty-bright", "name": "✨ Bright Portrait", "name_zh": "✨ 明亮人像", "description": "Brightened, warm, clean portrait"},
    {"id": "beauty-porcelain", "name": "✨ Porcelain", "name_zh": "✨ 瓷肌美顏", "description": "Strong smoothing, magazine-cover skin"},
    {"id": "beauty-face", "name": "✨ Face Mesh Beauty", "name_zh": "✨ 468點智慧美顏", "description": "MediaPipe FaceMesh skin smoothing + Canny edge detail"},
    {"id": "beauty-face-v2", "name": "✨ FabSoften 468 Beauty v2", "name_zh": "✨ 468點智慧美顏 v2", "description": "MediaPipe 468 Mesh + FabSoften 3-frequency texture restoration & zero-blur eyes"},

    # ── Local AI GAN/Transformer Beauty Models (PyTorch CUDA) ────────
    {"id": "ai-gfpgan", "name": "🤖 GFPGAN AI 智慧修容", "name_zh": "🤖 GFPGAN AI 智慧修容", "description": "Tencent GFPGAN v1.4 face restoration & blemish removal"},
    {"id": "ai-codeformer", "name": "🤖 CodeFormer AI 靈魂修容", "name_zh": "🤖 CodeFormer AI 靈魂修容", "description": "Transformer-based CodeFormer facial restoration"},
    {"id": "ai-realesrgan", "name": "🤖 Real-ESRGAN AI 極致清晰", "name_zh": "🤖 Real-ESRGAN AI 極致清晰", "description": "Real-ESRGAN local face super-resolution & detail enhancement"},
]

def get_available_filters():
    return FILTER_PRESETS

def apply_filter(pil_img: Image.Image, filter_preset: str, filter_params: dict = None) -> Image.Image:
    """Applies a named filter preset to a PIL Image (RGB format) with optional custom parameters."""
    if not filter_preset or filter_preset == "none":
        return pil_img

    params = filter_params or {}
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except Exception:
            params = {}

    preset = filter_preset.lower().strip()

    # ── Colour / Tone Filters ────────────────────────────────────────
    if preset in ["bw", "grayscale", "black_and_white"]:
        bw = ImageOps.grayscale(pil_img).convert("RGB")
        enh = ImageEnhance.Contrast(bw)
        mult = float(params.get("filter_intensity", 1.15))
        return enh.enhance(mult)

    elif preset == "sepia":
        sepia_matrix = (
            0.393, 0.769, 0.189, 0,
            0.349, 0.686, 0.168, 0,
            0.272, 0.534, 0.131, 0
        )
        return pil_img.convert("RGB", sepia_matrix)

    elif preset == "vintage":
        vint_matrix = (
            0.95, 0.05, 0.00, 0,
            0.00, 0.90, 0.05, 0,
            0.05, 0.00, 0.80, 0
        )
        img = pil_img.convert("RGB", vint_matrix)
        img = ImageEnhance.Color(img).enhance(0.80)
        return ImageEnhance.Contrast(img).enhance(0.92)

    elif preset == "vivid":
        mult = float(params.get("filter_intensity", 1.40))
        enh_sat = ImageEnhance.Color(pil_img)
        img = enh_sat.enhance(mult)
        enh_con = ImageEnhance.Contrast(img)
        return enh_con.enhance(1.20)

    elif preset == "warm":
        warm_matrix = (
            1.10, 0.00, 0.00, 0,
            0.00, 1.02, 0.00, 0,
            0.00, 0.00, 0.88, 0
        )
        return pil_img.convert("RGB", warm_matrix)

    elif preset == "cool":
        cool_matrix = (
            0.88, 0.00, 0.00, 0,
            0.00, 0.98, 0.00, 0,
            0.00, 0.00, 1.12, 0
        )
        return pil_img.convert("RGB", cool_matrix)

    elif preset == "high-contrast":
        mult = float(params.get("filter_intensity", 1.45))
        enh_con = ImageEnhance.Contrast(pil_img)
        img = enh_con.enhance(mult)
        enh_sat = ImageEnhance.Color(img)
        return enh_sat.enhance(1.10)

    elif preset == "film-grain":
        w, h = pil_img.size
        nw, nh = w // 2, h // 2
        noise_data = bytes([random.randint(110, 145) for _ in range(nw * nh)])
        noise_img = Image.frombytes("L", (nw, nh), noise_data).resize((w, h), Image.BILINEAR).convert("RGB")
        grained = Image.blend(pil_img, noise_img, alpha=0.08)
        enh_sat = ImageEnhance.Color(grained)
        return enh_sat.enhance(0.90)

    # ── Beauty Mode Presets (non-AI) ─────────────────────────────────
    elif preset == "beauty-soft":
        alpha = float(params.get("beauty_blend_alpha", 0.30))
        return _beauty_soft(pil_img, alpha=alpha)

    elif preset == "beauty-glow":
        return _beauty_glow(pil_img)

    elif preset == "beauty-bright":
        return _beauty_bright(pil_img)

    elif preset == "beauty-porcelain":
        return _beauty_porcelain(pil_img)

    elif preset in ["beauty-face-v2", "beauty-facemesh-v2", "facemesh-v2", "v2"]:
        mid_suppress = float(params.get("v2_mid_freq_suppress", 0.30))
        high_restore = float(params.get("v2_high_freq_restore", 0.35))
        eye_sharpen = float(params.get("v2_eye_sharpen", 0.50))
        return _beauty_facemesh_v2(pil_img, mid_suppress=mid_suppress, high_restore=high_restore, eye_sharpen=eye_sharpen)

    elif preset in ["beauty-face", "beauty-facemesh", "facemesh"]:
        canny_strength = float(params.get("canny_strength", 0.40))
        eye_dilation = int(params.get("eye_dilation", 15))
        return _beauty_facemesh_aware(pil_img, canny_strength=canny_strength, eye_dilation=eye_dilation)

    # ── Local AI GAN/Transformer Beauty Filters (PyTorch / CUDA) ──────
    elif preset in ["ai-gfpgan", "gfpgan"]:
        weight = float(params.get("gfpgan_weight", 0.50))
        only_center = bool(params.get("gfpgan_only_center", False))
        return _ai_gfpgan(pil_img, weight=weight, only_center=only_center)

    elif preset in ["ai-codeformer", "codeformer"]:
        fidelity = float(params.get("codeformer_fidelity", 0.60))
        return _ai_codeformer(pil_img, fidelity=fidelity)

    elif preset in ["ai-realesrgan", "realesrgan"]:
        return _ai_realesrgan(pil_img)

    return pil_img


# ═════════════════════════════════════════════════════════════════════
# Beauty helpers (PIL / MediaPipe / OpenCV — pure local computation)
# ═════════════════════════════════════════════════════════════════════

def _beauty_soft(pil_img: Image.Image, alpha: float = 0.30) -> Image.Image:
    """Subtle skin smoothing — light Gaussian blur blended with original."""
    smoothed = pil_img.filter(ImageFilter.GaussianBlur(radius=3))
    result = Image.blend(pil_img, smoothed, alpha=np.clip(alpha, 0.05, 1.0))
    result = ImageEnhance.Brightness(result).enhance(1.03)
    result = ImageEnhance.Color(result).enhance(1.05)
    return result


def _beauty_glow(pil_img: Image.Image) -> Image.Image:
    """Dreamy soft-focus glow — bright blurred layer composited via screen blend."""
    bright = ImageEnhance.Brightness(pil_img).enhance(1.2)
    glow_layer = bright.filter(ImageFilter.GaussianBlur(radius=12))

    base_arr = np.array(pil_img, dtype=np.float32) / 255.0
    glow_arr = np.array(glow_layer, dtype=np.float32) / 255.0
    screen = 1.0 - (1.0 - base_arr) * (1.0 - glow_arr)
    screen = np.clip(screen * 255, 0, 255).astype(np.uint8)

    result = Image.fromarray(screen)
    result = Image.blend(pil_img, result, alpha=0.40)
    result = ImageEnhance.Color(result).enhance(0.95)
    return result


def _beauty_bright(pil_img: Image.Image) -> Image.Image:
    """Clean bright portrait — slight exposure lift + warm tint + gentle smoothing."""
    smoothed = pil_img.filter(ImageFilter.GaussianBlur(radius=2))
    img = Image.blend(pil_img, smoothed, alpha=0.20)
    img = ImageEnhance.Brightness(img).enhance(1.10)
    img = ImageEnhance.Contrast(img).enhance(1.05)

    warm_matrix = (
        1.06, 0.00, 0.00, 0,
        0.00, 1.02, 0.00, 0,
        0.00, 0.00, 0.92, 0
    )
    return img.convert("RGB", warm_matrix)


def _beauty_porcelain(pil_img: Image.Image) -> Image.Image:
    """Strong magazine-cover smoothing — heavier blur + brightness + saturation reduction."""
    smoothed = pil_img.filter(ImageFilter.GaussianBlur(radius=5))
    img = Image.blend(pil_img, smoothed, alpha=0.50)
    img = ImageEnhance.Sharpness(img).enhance(1.30)
    img = ImageEnhance.Brightness(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(0.85)
    img = ImageEnhance.Contrast(img).enhance(0.95)
    return img


# ── MediaPipe 468-Point FaceMesh Landmark Indices ───────────────────
_FACEMESH_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
_FACEMESH_LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
_FACEMESH_RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]
_FACEMESH_LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
_FACEMESH_LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
_FACEMESH_RIGHT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]


def _guided_feathering(mask: np.ndarray, guide_gray: np.ndarray, radius: int = 8, eps: float = 1e-3) -> np.ndarray:
    """
    FabSoften Guided Feathering:
    Uses OpenCV Guided Filter to align skin mask edges seamlessly with real image
    edge boundaries (jawline, hairline), eliminating harsh mask artifacts.
    """
    try:
        import cv2
        if hasattr(cv2, 'ximgproc') and hasattr(cv2.ximgproc, 'guidedFilter'):
            mask_u8 = (mask * 255.0).astype(np.uint8)
            filtered = cv2.ximgproc.guidedFilter(guide=guide_gray, src=mask_u8, radius=radius, eps=eps)
            return filtered.astype(np.float32) / 255.0
        else:
            return cv2.GaussianBlur(mask, (5, 5), 0)
    except Exception:
        import cv2
        return cv2.GaussianBlur(mask, (5, 5), 0)


def _beauty_facemesh_v2(
    pil_img: Image.Image,
    mid_suppress: float = 0.30,
    high_restore: float = 0.35,
    eye_sharpen: float = 0.50
) -> Image.Image:
    """
    ✨ 468點智慧美顏 v2 (MediaPipe 468 Mesh + FabSoften 3-Frequency Separation + Guided Feathering).
    Param customizable:
    - mid_suppress: Blemishes/acne suppression ratio (0.1 = strong, 0.7 = mild)
    - high_restore: High-frequency skin pore restoration strength (0.0 - 1.0)
    - eye_sharpen: Eye & eyebrow contrast sharpening intensity (0.0 - 1.0)
    """
    try:
        import cv2
        import mediapipe as mp

        mp_face_mesh = mp.solutions.face_mesh
        img_rgb = np.array(pil_img)
        h_img, w_img = img_rgb.shape[:2]

        with mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=4,
            refine_landmarks=True,
            min_detection_confidence=0.5
        ) as face_mesh:
            results = face_mesh.process(img_rgb)

            if not results.multi_face_landmarks:
                return _beauty_facemesh_aware(pil_img)

            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            img_float = img_bgr.astype(np.float32)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            # ── 1. True 3-Frequency Separation (FabSoften Architecture) ──────────────
            low_freq = cv2.GaussianBlur(img_float, (21, 21), 0)
            mid_guide = cv2.GaussianBlur(img_float, (7, 7), 0)
            mid_freq = mid_guide - low_freq
            high_freq = img_float - mid_guide

            bilateral_bgr = cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75).astype(np.float32)

            restored_skin = bilateral_bgr + (mid_freq * np.clip(mid_suppress, 0.05, 0.9)) + (high_freq * np.clip(high_restore, 0.0, 1.0))
            restored_skin_bgr = np.clip(restored_skin, 0, 255).astype(np.uint8)

            # ── 2. Unsharp sharpening filter directly on ORIGINAL image for eyes ─────
            sharpen_factor = np.clip(eye_sharpen, 0.0, 1.0)
            sharpen_kernel = np.array([[0, -0.4 * sharpen_factor, 0], [-0.4 * sharpen_factor, 1.0 + 3.2 * sharpen_factor, -0.4 * sharpen_factor], [0, -0.4 * sharpen_factor, 0]], dtype=np.float32)
            sharpened_eye_bgr = cv2.filter2D(img_bgr, -1, sharpen_kernel)

            # ── 3. Build MediaPipe 468-point face oval & feature masks ──────────────
            skin_mask = np.zeros((h_img, w_img), dtype=np.float32)
            eye_exclusion_mask = np.zeros((h_img, w_img), dtype=np.uint8)

            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark

                def get_pts(indices):
                    return np.array([
                        [int(landmarks[idx].x * w_img), int(landmarks[idx].y * h_img)]
                        for idx in indices
                    ], dtype=np.int32)

                face_pts = get_pts(_FACEMESH_OVAL)
                face_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)
                cv2.fillConvexPoly(face_mask_raw, cv2.convexHull(face_pts), 255)

                no_smooth_mask = np.zeros((h_img, w_img), dtype=np.uint8)
                eye_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)

                for feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW, _FACEMESH_LIPS]:
                    pts = get_pts(feature_indices)
                    hull = cv2.convexHull(pts)
                    cv2.fillPoly(no_smooth_mask, [hull], 255)
                    if feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW]:
                        cv2.fillPoly(eye_mask_raw, [hull], 255)

                dil_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))
                no_smooth_dilated = cv2.dilate(no_smooth_mask, dil_kernel, iterations=1)
                eye_mask_dilated = cv2.dilate(eye_mask_raw, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), iterations=1)

                skin_mask_face = face_mask_raw.copy()
                skin_mask_face[no_smooth_dilated > 0] = 0

                skin_mask = np.maximum(skin_mask, skin_mask_face.astype(np.float32) / 255.0)
                eye_exclusion_mask = np.maximum(eye_exclusion_mask, eye_mask_dilated)

            # ── 4. FabSoften Guided Feathering for smooth skin edge transitions ─────
            skin_mask_guided = _guided_feathering(skin_mask, gray, radius=8, eps=1e-3)
            skin_mask_guided[eye_exclusion_mask > 0] = 0.0
            skin_mask_3ch = np.stack([skin_mask_guided] * 3, axis=-1)

            # ── 5. Composite: Smooth skin on cheeks, 100% UNBLURRED + SHARPENED on eyes ────
            res = (img_bgr * (1.0 - skin_mask_3ch) + restored_skin_bgr * skin_mask_3ch)

            eye_mask_float = (eye_exclusion_mask.astype(np.float32) / 255.0)
            eye_mask_blurred = cv2.GaussianBlur(eye_mask_float, (5, 5), 0)
            eye_mask_3ch = np.stack([eye_mask_blurred] * 3, axis=-1)

            res = (res * (1.0 - eye_mask_3ch) + sharpened_eye_bgr * eye_mask_3ch)
            res = np.clip(res, 0, 255).astype(np.uint8)

            result_pil = Image.fromarray(cv2.cvtColor(res, cv2.COLOR_BGR2RGB))
            result_pil = ImageEnhance.Brightness(result_pil).enhance(1.02)
            result_pil = ImageEnhance.Color(result_pil).enhance(1.02)
            return result_pil

    except Exception:
        return _beauty_facemesh_aware(pil_img)


def _beauty_facemesh_aware(
    pil_img: Image.Image,
    canny_strength: float = 0.40,
    eye_dilation: int = 15
) -> Image.Image:
    """Precision Skin-Only Beauty Filter using Google MediaPipe 468-point Face Mesh."""
    try:
        import cv2
        import mediapipe as mp

        mp_face_mesh = mp.solutions.face_mesh
        img_rgb = np.array(pil_img)
        h_img, w_img = img_rgb.shape[:2]

        with mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=4,
            refine_landmarks=True,
            min_detection_confidence=0.5
        ) as face_mesh:
            results = face_mesh.process(img_rgb)

            if not results.multi_face_landmarks:
                return _beauty_opencv_fallback(pil_img)

            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            smoothed_bgr = cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75)

            canny_edges = cv2.Canny(gray, threshold1=50, threshold2=150)
            canny_edges = cv2.GaussianBlur(canny_edges, (3, 3), 0)
            edge_overlay = canny_edges.astype(np.float32) / 255.0

            sharpen_kernel = np.array([[0, -0.5, 0], [-0.5, 3.0, -0.5], [0, -0.5, 0]], dtype=np.float32)
            sharpened_eye_bgr = cv2.filter2D(img_bgr, -1, sharpen_kernel)

            skin_mask = np.zeros((h_img, w_img), dtype=np.float32)
            eye_exclusion_mask = np.zeros((h_img, w_img), dtype=np.uint8)

            d_size = max(5, int(eye_dilation))
            dil_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (d_size | 1, d_size | 1))

            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark

                def get_pts(indices):
                    return np.array([
                        [int(landmarks[idx].x * w_img), int(landmarks[idx].y * h_img)]
                        for idx in indices
                    ], dtype=np.int32)

                face_pts = get_pts(_FACEMESH_OVAL)
                face_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)
                cv2.fillConvexPoly(face_mask_raw, cv2.convexHull(face_pts), 255)

                no_smooth_mask = np.zeros((h_img, w_img), dtype=np.uint8)
                eye_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)

                for feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW, _FACEMESH_LIPS]:
                    pts = get_pts(feature_indices)
                    hull = cv2.convexHull(pts)
                    cv2.fillPoly(no_smooth_mask, [hull], 255)
                    if feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW]:
                        cv2.fillPoly(eye_mask_raw, [hull], 255)

                no_smooth_dilated = cv2.dilate(no_smooth_mask, dil_kernel, iterations=1)
                eye_mask_dilated = cv2.dilate(eye_mask_raw, dil_kernel, iterations=1)

                skin_mask_face = face_mask_raw.copy()
                skin_mask_face[no_smooth_dilated > 0] = 0

                skin_mask = np.maximum(skin_mask, skin_mask_face.astype(np.float32) / 255.0)
                eye_exclusion_mask = np.maximum(eye_exclusion_mask, eye_mask_dilated)

            skin_mask_blurred = cv2.GaussianBlur(skin_mask, (5, 5), 0)
            skin_mask_blurred[eye_exclusion_mask > 0] = 0.0
            skin_mask_3ch = np.stack([skin_mask_blurred] * 3, axis=-1)

            res = (img_bgr * (1.0 - skin_mask_3ch) + smoothed_bgr * skin_mask_3ch)

            edge_in_skin = edge_overlay * skin_mask_blurred
            edge_in_skin_3ch = np.stack([edge_in_skin] * 3, axis=-1)
            c_factor = np.clip(canny_strength, 0.0, 1.0)
            res = res * (1.0 - edge_in_skin_3ch * c_factor) + img_bgr * (edge_in_skin_3ch * c_factor)

            eye_mask_float = (eye_exclusion_mask.astype(np.float32) / 255.0)
            eye_mask_blurred = cv2.GaussianBlur(eye_mask_float, (5, 5), 0)
            eye_mask_3ch = np.stack([eye_mask_blurred] * 3, axis=-1)

            res = (res * (1.0 - eye_mask_3ch) + sharpened_eye_bgr * eye_mask_3ch)
            res = np.clip(res, 0, 255).astype(np.uint8)

            result_pil = Image.fromarray(cv2.cvtColor(res, cv2.COLOR_BGR2RGB))
            result_pil = ImageEnhance.Brightness(result_pil).enhance(1.02)
            result_pil = ImageEnhance.Color(result_pil).enhance(1.02)
            return result_pil

    except ImportError:
        return _beauty_opencv_fallback(pil_img)
    except Exception:
        return _beauty_opencv_fallback(pil_img)


# ═════════════════════════════════════════════════════════════════════
# Local AI GAN / Transformer Models (GFPGAN, CodeFormer, Real-ESRGAN)
# ═════════════════════════════════════════════════════════════════════

_GFPGAN_MODEL = None

def _get_gfpgan_model():
    global _GFPGAN_MODEL
    if _GFPGAN_MODEL is None:
        try:
            import torch
            from gfpgan import GFPGANer
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            _GFPGAN_MODEL = GFPGANer(
                model_path='https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth',
                upscale=1,
                arch='clean',
                channel_multiplier=2,
                bg_upsampler=None,
                device=device
            )
        except Exception as e:
            print(f"[GFPGAN] Error initializing model: {e}")
            _GFPGAN_MODEL = False
    return _GFPGAN_MODEL if _GFPGAN_MODEL is not False else None


def _ai_gfpgan(pil_img: Image.Image, weight: float = 0.50, only_center: bool = False) -> Image.Image:
    """🤖 GFPGAN v1.4 Local AI Face Restoration & Enhancement (CUDA accelerated)."""
    try:
        import cv2
        gfp = _get_gfpgan_model()
        if gfp is None:
            return _beauty_facemesh_v2(pil_img)

        img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        cropped_faces, restored_faces, restored_img = gfp.enhance(
            img_bgr,
            has_aligned=False,
            only_center_face=bool(only_center),
            paste_back=True,
            weight=np.clip(float(weight), 0.0, 1.0)
        )

        if restored_img is not None:
            res_rgb = cv2.cvtColor(restored_img, cv2.COLOR_BGR2RGB)
            return Image.fromarray(res_rgb)
        return _beauty_facemesh_v2(pil_img)
    except Exception as e:
        print(f"[GFPGAN Filter] Error: {e}")
        return _beauty_facemesh_v2(pil_img)


def _ai_codeformer(pil_img: Image.Image, fidelity: float = 0.60) -> Image.Image:
    """🤖 CodeFormer Local AI Face Restoration with Tunable Fidelity (w=0.6)."""
    import tempfile, os
    try:
        import cv2
        import codeformer.app as ca
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
        pil_img.save(tmp_path, "JPEG", quality=95)

        restored_result = ca.inference_app(
            image=tmp_path,
            background_enhance=False,
            face_upsample=False,
            upscale=1,
            codeformer_fidelity=np.clip(float(fidelity), 0.0, 1.0)
        )
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass

        restored_img = restored_result[0] if isinstance(restored_result, tuple) else restored_result

        if restored_img is not None and hasattr(restored_img, 'shape'):
            res_rgb = cv2.cvtColor(restored_img, cv2.COLOR_BGR2RGB)
            return Image.fromarray(res_rgb)
        return _beauty_facemesh_v2(pil_img)
    except Exception as e:
        print(f"[CodeFormer Filter] Error: {e}")
        return _beauty_facemesh_v2(pil_img)


def _ai_realesrgan(pil_img: Image.Image) -> Image.Image:
    """🤖 Real-ESRGAN Local AI Clarity & Super-Resolution Pass."""
    try:
        import cv2
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet

        img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
        upsampler = RealESRGANer(
            scale=2,
            model_path='https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',
            model=model,
            tile=400,
            tile_pad=10,
            pre_pad=0,
            half=True
        )
        output, _ = upsampler.enhance(img_bgr, outscale=1)
        res_rgb = cv2.cvtColor(output, cv2.COLOR_BGR2RGB)
        return Image.fromarray(res_rgb)
    except Exception as e:
        print(f"[RealESRGAN Filter] Error: {e}")
        return _beauty_facemesh_v2(pil_img)


def _beauty_opencv_fallback(pil_img: Image.Image) -> Image.Image:
    """Haar Cascade face bounding box fallback if MediaPipe is unavailable."""
    try:
        import cv2
        img_cv = np.array(pil_img)[:, :, ::-1]
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        import os
        if not os.path.exists(cascade_path):
            return _beauty_soft(pil_img)

        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            return _beauty_soft(pil_img)

        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60))

        if len(faces) == 0:
            return _beauty_soft(pil_img)

        result = img_cv.copy()
        h_img, w_img = img_cv.shape[:2]

        for (x, y, w, h) in faces:
            pad_x, pad_y = int(w * 0.15), int(h * 0.20)
            x1, y1 = max(0, x - pad_x), max(0, y - pad_y)
            x2, y2 = min(w_img, x + w + pad_x), min(h_img, y + h + pad_y)

            face_roi = img_cv[y1:y2, x1:x2]
            smoothed_face = cv2.bilateralFilter(face_roi, d=9, sigmaColor=75, sigmaSpace=75)

            mask = np.zeros((y2 - y1, x2 - x1), dtype=np.float32)
            cv2.ellipse(mask, ((x2 - x1) // 2, (y2 - y1) // 2), ((x2 - x1) // 2, (y2 - y1) // 2), 0, 0, 360, 1.0, -1)
            mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=max(1, (x2 - x1) // 8))
            mask_3ch = np.stack([mask] * 3, axis=-1)

            result[y1:y2, x1:x2] = (smoothed_face * mask_3ch + face_roi * (1.0 - mask_3ch)).astype(np.uint8)

        result_pil = Image.fromarray(result[:, :, ::-1])
        return ImageEnhance.Brightness(result_pil).enhance(1.03)

    except Exception:
        return _beauty_soft(pil_img)


def apply_filter_file(src_path: str, dest_path: str, filter_preset: str, filter_params: dict = None) -> str:
    """Reads src_path image, applies filter_preset with parameters, saves to dest_path. Returns dest_path."""
    img = Image.open(src_path).convert("RGB")
    filtered = apply_filter(img, filter_preset, filter_params)
    filtered.save(dest_path, "JPEG", quality=95)
    return dest_path
