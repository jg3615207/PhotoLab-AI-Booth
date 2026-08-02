import random
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

    # ── Beauty Mode Presets (non-AI) ─────────────────────────────────
    {"id": "beauty-soft", "name": "✨ Soft Skin", "name_zh": "✨ 柔膚自然", "description": "Subtle skin smoothing, natural look"},
    {"id": "beauty-glow", "name": "✨ Dreamy Glow", "name_zh": "✨ 夢幻柔光", "description": "Soft-focus portrait glow effect"},
    {"id": "beauty-bright", "name": "✨ Bright Portrait", "name_zh": "✨ 明亮人像", "description": "Brightened, warm, clean portrait"},
    {"id": "beauty-porcelain", "name": "✨ Porcelain", "name_zh": "✨ 瓷肌美顏", "description": "Strong smoothing, magazine-cover skin"},
    {"id": "beauty-face", "name": "✨ Face Mesh Beauty", "name_zh": "✨ 468點智慧美顏", "description": "MediaPipe FaceMesh skin smoothing + Canny edge detail"},
    {"id": "beauty-face-v2", "name": "✨ FabSoften 468 Beauty v2", "name_zh": "✨ 468點智慧美顏 v2", "description": "MediaPipe 468 Mesh + FabSoften frequency texture restoration & guided feathering"},
]

def get_available_filters():
    return FILTER_PRESETS

def apply_filter(pil_img: Image.Image, filter_preset: str) -> Image.Image:
    """Applies a named filter preset to a PIL Image (RGB format). Returns modified PIL Image."""
    if not filter_preset or filter_preset == "none":
        return pil_img

    preset = filter_preset.lower().strip()

    # ── Colour / Tone Filters ────────────────────────────────────────
    if preset in ["bw", "grayscale", "black_and_white"]:
        bw = ImageOps.grayscale(pil_img).convert("RGB")
        enh = ImageEnhance.Contrast(bw)
        return enh.enhance(1.15)

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
        enh_sat = ImageEnhance.Color(pil_img)
        img = enh_sat.enhance(1.40)
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
        enh_con = ImageEnhance.Contrast(pil_img)
        img = enh_con.enhance(1.45)
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
        return _beauty_soft(pil_img)

    elif preset == "beauty-glow":
        return _beauty_glow(pil_img)

    elif preset == "beauty-bright":
        return _beauty_bright(pil_img)

    elif preset == "beauty-porcelain":
        return _beauty_porcelain(pil_img)

    elif preset in ["beauty-face-v2", "beauty-facemesh-v2", "facemesh-v2", "v2"]:
        return _beauty_facemesh_v2(pil_img)

    elif preset in ["beauty-face", "beauty-facemesh", "facemesh"]:
        return _beauty_facemesh_aware(pil_img)

    return pil_img


# ═════════════════════════════════════════════════════════════════════
# Beauty helpers (PIL / MediaPipe / OpenCV — pure local computation)
# ═════════════════════════════════════════════════════════════════════

def _beauty_soft(pil_img: Image.Image) -> Image.Image:
    """Subtle skin smoothing — light Gaussian blur blended at 30 % with original."""
    smoothed = pil_img.filter(ImageFilter.GaussianBlur(radius=3))
    result = Image.blend(pil_img, smoothed, alpha=0.30)
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


def _beauty_facemesh_v2(pil_img: Image.Image) -> Image.Image:
    """
    ✨ 468點智慧美顏 v2 (MediaPipe 468 Mesh + FabSoften Texture Restoration & Guided Feathering).
    Combines:
    1. MediaPipe 468 3D Face Mesh geometry for 100% accurate feature exclusion.
    2. FabSoften Frequency Separation: Bilateral blemish removal + high-frequency skin pore restoration.
    3. FabSoften Guided Feathering: Edge-preserving skin mask blending via Guided Filtering.
    4. Sparkling Eye Sharpening: Unsharp contrast sharpening over eyes, eyelids & eyebrows.
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
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            # Step 1: Bilateral smoothing for skin blemish & redness removal
            smoothed_bgr = cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75)

            # Step 2: FabSoften High-Frequency Texture Extraction & Restoration
            # Extract fine micro-textures (pores, fine details) from original photo
            blur_guide = cv2.GaussianBlur(img_bgr, (5, 5), 0)
            high_freq_texture = img_bgr.astype(np.float32) - blur_guide.astype(np.float32)

            # Re-composite high-frequency texture onto smoothed skin (35% intensity)
            restored_skin_bgr = smoothed_bgr.astype(np.float32) + (high_freq_texture * 0.35)
            restored_skin_bgr = np.clip(restored_skin_bgr, 0, 255).astype(np.uint8)

            # Step 3: Unsharp sharpening filter for eye & eyebrow enhancement
            sharpen_kernel = np.array([[0, -0.4, 0], [-0.4, 2.6, -0.4], [0, -0.4, 0]], dtype=np.float32)
            sharpened_bgr = cv2.filter2D(img_bgr, -1, sharpen_kernel)

            # Step 4: Build MediaPipe 468-point face oval & feature masks
            skin_mask = np.zeros((h_img, w_img), dtype=np.float32)
            eye_feature_mask = np.zeros((h_img, w_img), dtype=np.float32)

            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark

                def get_pts(indices):
                    return np.array([
                        [int(landmarks[idx].x * w_img), int(landmarks[idx].y * h_img)]
                        for idx in indices
                    ], dtype=np.int32)

                # Face Oval
                face_pts = get_pts(_FACEMESH_OVAL)
                face_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)
                cv2.fillConvexPoly(face_mask_raw, cv2.convexHull(face_pts), 255)

                # Feature Exclusion (Eyes, Eyebrows, Lips)
                no_smooth_mask = np.zeros((h_img, w_img), dtype=np.uint8)
                eye_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)

                for feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW, _FACEMESH_LIPS]:
                    pts = get_pts(feature_indices)
                    hull = cv2.convexHull(pts)
                    cv2.fillPoly(no_smooth_mask, [hull], 255)
                    if feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW]:
                        cv2.fillPoly(eye_mask_raw, [hull], 255)

                # Dilate feature mask by 15px to protect eyelids, eyelashes & eye contours
                dil_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
                no_smooth_dilated = cv2.dilate(no_smooth_mask, dil_kernel, iterations=1)
                eye_mask_dilated = cv2.dilate(eye_mask_raw, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), iterations=1)

                skin_mask_face = face_mask_raw.copy()
                skin_mask_face[no_smooth_dilated > 0] = 0

                skin_mask = np.maximum(skin_mask, skin_mask_face.astype(np.float32) / 255.0)
                eye_feature_mask = np.maximum(eye_feature_mask, eye_mask_dilated.astype(np.float32) / 255.0)

            # Step 5: FabSoften Guided Feathering for seamless skin edge transitions
            skin_mask_guided = _guided_feathering(skin_mask, gray, radius=8, eps=1e-3)
            skin_mask_3ch = np.stack([skin_mask_guided] * 3, axis=-1)

            eye_mask_blurred = cv2.GaussianBlur(eye_feature_mask, (5, 5), 0)
            eye_mask_3ch = np.stack([eye_mask_blurred] * 3, axis=-1)

            # Composite:
            # 1. Apply FabSoften smoothed + texture-restored skin where skin_mask > 0
            res = (img_bgr * (1.0 - skin_mask_3ch) + restored_skin_bgr * skin_mask_3ch)

            # 2. Apply Eye Sharpening where eye_feature_mask > 0
            res = (res * (1.0 - eye_mask_3ch * 0.5) + sharpened_bgr * (eye_mask_3ch * 0.5))
            res = np.clip(res, 0, 255).astype(np.uint8)

            result_pil = Image.fromarray(cv2.cvtColor(res, cv2.COLOR_BGR2RGB))
            result_pil = ImageEnhance.Brightness(result_pil).enhance(1.03)
            result_pil = ImageEnhance.Color(result_pil).enhance(1.03)
            return result_pil

    except Exception:
        return _beauty_facemesh_aware(pil_img)


def _beauty_facemesh_aware(pil_img: Image.Image) -> Image.Image:
    """
    Precision Skin-Only Beauty Filter using Google MediaPipe 468-point Face Mesh.
    Pipeline (inspired by GPUImage BeautifyFace):
    1. Detects face 3D mesh points.
    2. Builds precise skin mask (Face oval MINUS Eyes, Eyelashes, Eyebrows, Lips).
    3. Dilates feature exclusion zones to guarantee eyes/eyelashes/brows are 100% protected.
    4. Smooths skin with edge-preserving bilateral filter.
    5. Canny Edge Detail Overlay — extracts fine skin texture edges from the original
       and composites them back onto the smoothed result to prevent the "plastic doll" look.
    6. Applies unsharp sharpening filter specifically over eye/eyebrow regions for crisp, sparkling eyes.
    Falls back to OpenCV Haar cascade or PIL soft blur if MediaPipe is unavailable.
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
                return _beauty_opencv_fallback(pil_img)

            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            # Edge-preserving bilateral skin smoothing
            smoothed_bgr = cv2.bilateralFilter(img_bgr, d=9, sigmaColor=75, sigmaSpace=75)

            # ── Canny Edge Detail Extraction ─────────────────────────
            canny_edges = cv2.Canny(gray, threshold1=50, threshold2=150)
            canny_edges = cv2.GaussianBlur(canny_edges, (3, 3), 0)
            edge_overlay = canny_edges.astype(np.float32) / 255.0

            # Unsharp sharpening filter for eye enhancement
            sharpen_kernel = np.array([[0, -0.4, 0], [-0.4, 2.6, -0.4], [0, -0.4, 0]], dtype=np.float32)
            sharpened_bgr = cv2.filter2D(img_bgr, -1, sharpen_kernel)

            # Initialize masks
            skin_mask = np.zeros((h_img, w_img), dtype=np.float32)
            eye_feature_mask = np.zeros((h_img, w_img), dtype=np.float32)

            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark

                def get_pts(indices):
                    return np.array([
                        [int(landmarks[idx].x * w_img), int(landmarks[idx].y * h_img)]
                        for idx in indices
                    ], dtype=np.int32)

                # 1. Fill Face Oval (skin area)
                face_pts = get_pts(_FACEMESH_OVAL)
                face_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)
                cv2.fillConvexPoly(face_mask_raw, cv2.convexHull(face_pts), 255)

                # 2. Build feature exclusion mask (Eyes, Eyebrows, Lips)
                no_smooth_mask = np.zeros((h_img, w_img), dtype=np.uint8)
                eye_mask_raw = np.zeros((h_img, w_img), dtype=np.uint8)

                for feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW, _FACEMESH_LIPS]:
                    pts = get_pts(feature_indices)
                    hull = cv2.convexHull(pts)
                    cv2.fillPoly(no_smooth_mask, [hull], 255)
                    if feature_indices in [_FACEMESH_LEFT_EYE, _FACEMESH_RIGHT_EYE, _FACEMESH_LEFT_EYEBROW, _FACEMESH_RIGHT_EYEBROW]:
                        cv2.fillPoly(eye_mask_raw, [hull], 255)

                # Dilate feature mask by 15px to protect eyelids, eyelashes & eye contours
                dil_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
                no_smooth_dilated = cv2.dilate(no_smooth_mask, dil_kernel, iterations=1)
                eye_mask_dilated = cv2.dilate(eye_mask_raw, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), iterations=1)

                # Skin mask = Face Oval MINUS dilated feature mask
                skin_mask_face = face_mask_raw.copy()
                skin_mask_face[no_smooth_dilated > 0] = 0

                skin_mask = np.maximum(skin_mask, skin_mask_face.astype(np.float32) / 255.0)
                eye_feature_mask = np.maximum(eye_feature_mask, eye_mask_dilated.astype(np.float32) / 255.0)

            # Feather skin mask with small 5px kernel
            skin_mask_blurred = cv2.GaussianBlur(skin_mask, (5, 5), 0)
            skin_mask_3ch = np.stack([skin_mask_blurred] * 3, axis=-1)

            # Feather eye sharpening mask
            eye_mask_blurred = cv2.GaussianBlur(eye_feature_mask, (5, 5), 0)
            eye_mask_3ch = np.stack([eye_mask_blurred] * 3, axis=-1)

            # Step 1: Smooth skin where skin_mask > 0
            res = (img_bgr * (1.0 - skin_mask_3ch) + smoothed_bgr * skin_mask_3ch)

            # Step 2: Canny Edge Detail Overlay
            edge_in_skin = edge_overlay * skin_mask_blurred
            edge_in_skin_3ch = np.stack([edge_in_skin] * 3, axis=-1)
            edge_detail_strength = 0.4
            res = res * (1.0 - edge_in_skin_3ch * edge_detail_strength) + img_bgr * (edge_in_skin_3ch * edge_detail_strength)

            # Step 3: Sharpen eyes & eyebrows where eye_feature_mask > 0
            res = (res * (1.0 - eye_mask_3ch * 0.5) + sharpened_bgr * (eye_mask_3ch * 0.5))
            res = np.clip(res, 0, 255).astype(np.uint8)

            result_pil = Image.fromarray(cv2.cvtColor(res, cv2.COLOR_BGR2RGB))
            result_pil = ImageEnhance.Brightness(result_pil).enhance(1.02)
            result_pil = ImageEnhance.Color(result_pil).enhance(1.02)
            return result_pil

    except ImportError:
        return _beauty_opencv_fallback(pil_img)
    except Exception:
        return _beauty_opencv_fallback(pil_img)


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


def apply_filter_file(src_path: str, dest_path: str, filter_preset: str) -> str:
    """Reads src_path image, applies filter_preset, saves to dest_path. Returns dest_path."""
    img = Image.open(src_path).convert("RGB")
    filtered = apply_filter(img, filter_preset)
    filtered.save(dest_path, "JPEG", quality=95)
    return dest_path
